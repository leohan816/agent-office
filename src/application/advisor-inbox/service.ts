import {
  buildAdvisorGatewayReceipt,
  type AdvisorGateway,
  type AdvisorGatewayReceipt,
  type AdvisorNotificationRequest,
} from '../../adapters/gateways/advisor.js';
import { DomainError, type ActorReference, type SourceArtifactRef } from '../../contracts/types.js';
import { asJsonValue } from '../../contracts/validation.js';
import { assertResumeProof } from '../../domain/decisions/resume-proof.js';
import type { EventEnvelope, EventType } from '../../domain/events/index.js';
import { assertSubmitAdvisorMessage, type SubmitAdvisorMessage } from '../../domain/messages/index.js';
import { assertUtcTimestamp, assertUuidV7 } from '../../domain/time/index.js';
import { ImmutableArtifactStore } from '../../persistence/file-store/artifact-store.js';
import { EventStore, type AppendReceipt } from '../../persistence/file-store/event-store.js';
import { hashCanonical, isSha256 } from '../../persistence/file-store/hashing.js';
import { projectAdvisorInbox } from './projector.js';
import { ADVISOR_INTAKE_CLASSIFICATIONS } from './types.js';
import type {
  AdvisorInboxPolicy,
  AdvisorInboxProjection,
  AdvisorInboxRuntime,
  AdvisorMessagePersistenceReceipt,
  AdvisorMessageProjection,
  ApplicationCommandContext,
  CloseAdvisorMessage,
  DecisionAuthorityEvidenceVerifier,
  LinkAdvisorDecision,
  NotificationProjection,
  RecordAdvisorAcknowledgement,
  RecordAdvisorIntake,
  ResumeAdvisorWork,
} from './types.js';

const SERVICE_ACTOR: ActorReference = { role: 'LOCAL_OPERATOR', subjectId: 'agent-office' };

export class AdvisorInboxService {
  public constructor(
    private readonly eventStore: EventStore,
    private readonly artifacts: ImmutableArtifactStore,
    private readonly gateway: AdvisorGateway,
    private readonly runtime: AdvisorInboxRuntime,
    private readonly policy: AdvisorInboxPolicy,
    private readonly authorityEvidenceVerifier: DecisionAuthorityEvidenceVerifier,
  ) {}

  public project(): AdvisorInboxProjection {
    return projectAdvisorInbox(this.eventStore.readAll());
  }

  public async persistMessage(
    command: SubmitAdvisorMessage,
    context: ApplicationCommandContext,
  ): Promise<AdvisorMessagePersistenceReceipt> {
    assertSubmitAdvisorMessage(command);
    assertLeoContext(context);
    if (
      command.missionId !== this.policy.missionId ||
      command.manifestVersion !== this.policy.manifestVersion
    ) {
      throw new DomainError('MANIFEST_VERSION_CONFLICT', 'message mission authority does not match');
    }
    if (command.referencedEntityIds.some((id) => !this.policy.allowlistedEntityIds.has(id))) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'message contains a non-allowlisted entity reference');
    }
    const messagePayloadHash = hashCanonical(command);
    const prior = this.eventStore.readAll().find((event) => event.requestId === command.requestId);
    if (prior !== undefined) {
      if (
        prior.eventType !== 'AdvisorMessagePersisted' ||
        prior.actor.role !== context.actor.role ||
        prior.actor.subjectId !== context.actor.subjectId ||
        payloadString(prior, 'messagePayloadHash') !== messagePayloadHash
      ) {
        throw new DomainError('IDEMPOTENCY_KEY_REUSED', 'requestId was already used with different message bytes');
      }
      return persistenceReceipt(prior, true);
    }

    const artifact = await this.artifacts.putScopedCanonicalJson(
      'inbox',
      [command.missionId, command.requestId],
      {
        schemaVersion: 'agent-office.advisor-message-artifact.v1',
        ...command,
      },
    );
    const messageId = this.nextId();
    const event = await this.appendWithIdentity(
      'AdvisorMessagePersisted',
      command.requestId,
      context,
      command.clientCreatedAt,
      {
        messageId,
        requestId: command.requestId,
        kind: command.kind,
        subjectHash: hashCanonical(command.subject),
        referencedEntityIds: command.referencedEntityIds,
        clientCreatedAt: command.clientCreatedAt,
        messageArtifactRef: artifact.relativePath,
        messageArtifactHash: artifact.sha256,
        messagePayloadHash,
        state: 'PERSISTED',
      },
    );
    return persistenceReceipt(event, false);
  }

  public async queueMessage(messageId: string): Promise<NotificationProjection> {
    assertUuidV7(messageId, 'messageId');
    let projection = this.project();
    let message = requireMessage(projection, messageId);
    if (message.notificationId === undefined) {
      if (message.state !== 'PERSISTED') {
        throw new DomainError('INVALID_TRANSITION', 'only a persisted message can enter the outbox');
      }
      const notificationId = this.nextId();
      await this.appendInternal('AdvisorMessageDeliveryQueued', message, {
        messageId,
        notificationId,
        state: 'DELIVERY_PENDING',
      });
      projection = this.project();
      message = requireMessage(projection, messageId);
    }
    const notificationId = message.notificationId;
    if (notificationId === undefined) throw new Error('queued message has no notification identity');
    const existing = projection.notifications[notificationId];
    if (existing !== undefined) return existing;
    await this.appendInternal('NotificationQueued', message, {
      notificationId,
      messageId,
      gatewayRequest: gatewayRequest(message, notificationId),
      state: 'QUEUED',
    });
    const queued = this.project().notifications[notificationId];
    if (queued === undefined) throw new Error('durable notification queue event was not projected');
    return queued;
  }

  public async recoverOutbox(): Promise<AdvisorInboxProjection> {
    let projection = this.project();
    for (const message of Object.values(projection.messages)) {
      if (message.state === 'PERSISTED') await this.queueMessage(message.messageId);
      else if (
        message.state === 'DELIVERY_PENDING' &&
        message.notificationId !== undefined &&
        projection.notifications[message.notificationId] === undefined
      ) {
        await this.queueMessage(message.messageId);
      }
      projection = this.project();
    }
    for (const notification of Object.values(projection.notifications)) {
      if (
        notification.state === 'DELIVERING' ||
        (notification.state === 'FAILED' &&
          (notification.receipt?.status === 'MANUAL_FALLBACK_REQUIRED' ||
            notification.receipt?.status === 'DISABLED'))
      ) {
        await this.deliverNotification(notification.notificationId);
      }
      else if (
        notification.state === 'DELIVERED' ||
        notification.state === 'FAILED' ||
        notification.state === 'MANUAL_FALLBACK_REQUIRED'
      ) {
        await this.reconcileMessageDelivery(notification);
      }
      projection = this.project();
    }
    for (const message of Object.values(projection.messages)) {
      if (
        message.state === 'ACKNOWLEDGED' ||
        message.state === 'INTAKE_RECORDED' ||
        message.state === 'DECISION_LINKED' ||
        message.state === 'CLOSED'
      ) {
        await this.reconcileNotificationAcknowledgement(message);
      }
      projection = this.project();
    }
    return projection;
  }

  public async deliverNotification(notificationId: string): Promise<NotificationProjection> {
    assertUuidV7(notificationId, 'notificationId');
    let notification = requireNotification(this.project(), notificationId);
    let startedHere = false;
    if (
      notification.state === 'FAILED' &&
      notification.receipt !== undefined &&
      (notification.receipt.status === 'MANUAL_FALLBACK_REQUIRED' ||
        notification.receipt.status === 'DISABLED')
    ) {
      if (notification.receiptArtifactRef === undefined) {
        throw new DomainError('STORE_QUARANTINED', 'failed notification lacks receipt artifact');
      }
      const message = requireMessage(this.project(), notification.messageId);
      await this.appendInternal('NotificationManualFallbackRequired', message, {
        notificationId,
        messageId: notification.messageId,
        receiptArtifactRef: notification.receiptArtifactRef,
        receiptArtifactHash: notification.receipt.receiptHash,
        receipt: notification.receipt,
        state: 'MANUAL_FALLBACK_REQUIRED',
      });
      notification = requireNotification(this.project(), notificationId);
    }
    if (
      notification.state === 'DELIVERED' ||
      notification.state === 'FAILED' ||
      notification.state === 'MANUAL_FALLBACK_REQUIRED'
    ) {
      await this.reconcileMessageDelivery(notification);
      return requireNotification(this.project(), notificationId);
    }
    if (notification.state === 'QUEUED') {
      const message = requireMessage(this.project(), notification.messageId);
      await this.appendInternal('NotificationDeliveryStarted', message, {
        notificationId,
        messageId: notification.messageId,
        attempt: notification.attempt + 1,
        state: 'DELIVERING',
      });
      notification = requireNotification(this.project(), notificationId);
      startedHere = true;
    }
    if (notification.state !== 'DELIVERING') {
      throw new DomainError('INVALID_TRANSITION', 'notification is not deliverable');
    }

    const receipt =
      startedHere
        ? await this.gateway.queueAdvisorNotification(notification.request)
        : await this.gateway.getDeliveryReceipt(notificationId);
    const durableReceipt = receipt ?? ambiguousManualReceipt(notificationId, this.now());
    const artifact = await this.artifacts.putScopedCanonicalJson(
      'gateway-receipts',
      [this.policy.missionId, notificationId],
      durableReceipt,
      16 * 1024,
    );
    const message = requireMessage(this.project(), notification.messageId);
    const terminalPayload = {
      notificationId,
      messageId: notification.messageId,
      receiptArtifactRef: artifact.relativePath,
      receiptArtifactHash: artifact.sha256,
      receipt: durableReceipt,
      state: notificationTerminalState(durableReceipt),
    };
    if (
      durableReceipt.status === 'MANUAL_FALLBACK_REQUIRED' ||
      durableReceipt.status === 'DISABLED'
    ) {
      await this.appendInternal('NotificationFailed', message, {
        ...terminalPayload,
        state: 'FAILED',
      });
      await this.appendInternal('NotificationManualFallbackRequired', message, terminalPayload);
    } else {
      await this.appendInternal(notificationTerminalEvent(durableReceipt), message, terminalPayload);
    }
    notification = requireNotification(this.project(), notificationId);
    await this.reconcileMessageDelivery(notification);
    return requireNotification(this.project(), notificationId);
  }

  public async recordAcknowledgement(
    command: RecordAdvisorAcknowledgement,
    context: ApplicationCommandContext,
  ): Promise<AdvisorMessageProjection> {
    assertAdvisorContext(context);
    assertUuidV7(command.requestId, 'requestId');
    assertUuidV7(command.messageId, 'messageId');
    assertUuidV7(command.acknowledgementId, 'acknowledgementId');
    assertUtcTimestamp(command.acknowledgedAt, 'acknowledgedAt');
    assertEvidenceIdentifiers(command.evidenceRefs);
    const commandHash = commandHashWithActor(command, context.actor);
    const replay = this.findLifecycleReplay('AdvisorMessageAcknowledged', command.requestId, commandHash);
    if (replay) {
      const replayed = requireMessage(this.project(), command.messageId);
      await this.reconcileNotificationAcknowledgement(replayed);
      return requireMessage(this.project(), command.messageId);
    }
    const message = requireMessage(this.project(), command.messageId);
    if (message.state !== 'DELIVERED' && message.state !== 'MANUAL_FALLBACK_REQUIRED') {
      throw new DomainError('INVALID_TRANSITION', 'acknowledgement is separate from and follows delivery state');
    }
    const artifact = await this.artifacts.putScopedCanonicalJson(
      'advisor-acknowledgements',
      [this.policy.missionId, command.messageId, command.requestId],
      { schemaVersion: 'agent-office.advisor-acknowledgement.v1', ...command },
      16 * 1024,
    );
    await this.appendWithIdentity(
      'AdvisorMessageAcknowledged',
      command.requestId,
      context,
      command.acknowledgedAt,
      {
        messageId: command.messageId,
        acknowledgementId: command.acknowledgementId,
        acknowledgementArtifactRef: artifact.relativePath,
        acknowledgementArtifactHash: artifact.sha256,
        commandHash,
        state: 'ACKNOWLEDGED',
      },
    );
    const acknowledged = requireMessage(this.project(), command.messageId);
    await this.reconcileNotificationAcknowledgement(acknowledged);
    return requireMessage(this.project(), command.messageId);
  }

  public async recordIntake(
    command: RecordAdvisorIntake,
    context: ApplicationCommandContext,
  ): Promise<AdvisorMessageProjection> {
    assertAdvisorContext(context);
    assertUuidV7(command.requestId, 'requestId');
    assertUuidV7(command.messageId, 'messageId');
    assertUuidV7(command.intakeId, 'intakeId');
    assertUtcTimestamp(command.recordedAt, 'recordedAt');
    if (!ADVISOR_INTAKE_CLASSIFICATIONS.includes(command.classification)) {
      throw new DomainError('INVALID_SCHEMA', 'Advisor intake classification is invalid');
    }
    assertEvidenceIdentifiers(command.evidenceRefs);
    const commandHash = commandHashWithActor(command, context.actor);
    const replay = this.findLifecycleReplay('AdvisorIntakeRecorded', command.requestId, commandHash);
    if (replay) return requireMessage(this.project(), command.messageId);
    const message = requireMessage(this.project(), command.messageId);
    if (message.state !== 'ACKNOWLEDGED') {
      throw new DomainError('INVALID_TRANSITION', 'intake requires separate Advisor acknowledgement');
    }
    const artifact = await this.artifacts.putScopedCanonicalJson(
      'advisor-intake',
      [this.policy.missionId, command.messageId, command.requestId],
      { schemaVersion: 'agent-office.advisor-intake.v1', ...command },
      16 * 1024,
    );
    await this.appendWithIdentity(
      'AdvisorIntakeRecorded',
      command.requestId,
      context,
      command.recordedAt,
      {
        messageId: command.messageId,
        intakeId: command.intakeId,
        classification: command.classification,
        intakeArtifactRef: artifact.relativePath,
        intakeArtifactHash: artifact.sha256,
        commandHash,
        state: 'INTAKE_RECORDED',
      },
    );
    return requireMessage(this.project(), command.messageId);
  }

  public async linkDecision(
    command: LinkAdvisorDecision,
    context: ApplicationCommandContext,
  ): Promise<AdvisorMessageProjection> {
    assertAdvisorContext(context);
    assertUuidV7(command.requestId, 'requestId');
    assertUuidV7(command.messageId, 'messageId');
    assertUuidV7(command.decisionId, 'decisionId');
    assertUtcTimestamp(command.recordedAt, 'recordedAt');
    const claimedAuthorityRole: unknown = command.authorityRole;
    if (claimedAuthorityRole !== 'Leo/GPT' && claimedAuthorityRole !== 'Advisor') {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'decision authority role is invalid');
    }
    assertSourceArtifact(command.decisionArtifact);
    const commandHash = commandHashWithActor(command, context.actor);
    const replay = this.findLifecycleReplay('AdvisorMessageDecisionLinked', command.requestId, commandHash);
    if (replay) return requireMessage(this.project(), command.messageId);
    const message = requireMessage(this.project(), command.messageId);
    if (message.state !== 'INTAKE_RECORDED') {
      throw new DomainError('INVALID_TRANSITION', 'decision link requires canonical intake');
    }
    const authorityEvidence = await this.authorityEvidenceVerifier.verify({
      decisionId: command.decisionId,
      missionId: this.policy.missionId,
      authorityRole: command.authorityRole,
      decisionArtifact: command.decisionArtifact,
      expectedWorkUnitIds: message.referencedEntityIds,
      recordedAt: command.recordedAt,
    });
    assertVerifiedAuthorityEvidence(command, authorityEvidence, message, this.policy.missionId);
    const artifact = await this.artifacts.putScopedCanonicalJson(
      'advisor-decisions',
      [this.policy.missionId, command.messageId, command.requestId],
      {
        schemaVersion: 'agent-office.advisor-decision-link.v2',
        ...command,
        authorityEvidence,
      },
      16 * 1024,
    );
    await this.appendWithIdentity(
      'AdvisorMessageDecisionLinked',
      command.requestId,
      context,
      command.recordedAt,
      {
        messageId: command.messageId,
        decisionId: command.decisionId,
        authorityRole: command.authorityRole,
        authoritySubjectId: authorityEvidence.authoritySubjectId,
        authorityEvidenceRef: command.decisionArtifact,
        authorityEvidenceHash: authorityEvidence.evidenceHash,
        decisionScopeWorkUnitIds: authorityEvidence.scope.workUnitIds,
        decisionArtifactRef: artifact.relativePath,
        decisionArtifactHash: artifact.sha256,
        canonicalDecisionHash: command.decisionArtifact.sha256,
        commandHash,
        state: 'DECISION_LINKED',
      },
    );
    return requireMessage(this.project(), command.messageId);
  }

  public async recordResumeProof(
    command: ResumeAdvisorWork,
    context: ApplicationCommandContext,
  ): Promise<AdvisorMessageProjection> {
    assertAdvisorContext(context);
    assertUuidV7(command.requestId, 'requestId');
    assertUuidV7(command.messageId, 'messageId');
    assertUtcTimestamp(command.recordedAt, 'recordedAt');
    if (!['BLOCKED', 'WAITING_ADVISOR', 'WAITING_LEO', 'HOLD'].includes(command.from)) {
      throw new DomainError('INVALID_SCHEMA', 'resume source state is invalid');
    }
    assertResumeProof(command.proof);
    const commandHash = commandHashWithActor(command, context.actor);
    const replay = this.findLifecycleReplay('WorkUnitStateTransitioned', command.requestId, commandHash);
    if (replay) return requireMessage(this.project(), command.messageId);
    const message = requireMessage(this.project(), command.messageId);
    if (message.state !== 'DECISION_LINKED') {
      throw new DomainError('INVALID_TRANSITION', 'resume proof requires a linked decision');
    }
    const artifact = await this.artifacts.putScopedCanonicalJson(
      'resume-proofs',
      [this.policy.missionId, command.messageId, command.requestId],
      { schemaVersion: 'agent-office.work-resumed-proof.v1', ...command },
      16 * 1024,
    );
    await this.appendWithIdentity(
      'WorkUnitStateTransitioned',
      command.requestId,
      context,
      command.recordedAt,
      {
        messageId: command.messageId,
        workUnitId: command.proof.workUnitId,
        from: command.from,
        to: command.proof.resumeTo,
        resumeProofArtifactRef: artifact.relativePath,
        resumeProofArtifactHash: artifact.sha256,
        commandHash,
      },
    );
    return requireMessage(this.project(), command.messageId);
  }

  public async closeMessage(
    command: CloseAdvisorMessage,
    context: ApplicationCommandContext,
  ): Promise<AdvisorMessageProjection> {
    assertAdvisorContext(context);
    assertUuidV7(command.requestId, 'requestId');
    assertUuidV7(command.messageId, 'messageId');
    assertUtcTimestamp(command.closedAt, 'closedAt');
    if (!/^[A-Z0-9][A-Z0-9._-]{0,127}$/u.test(command.reasonCode)) {
      throw new DomainError('INVALID_SCHEMA', 'close reason code is invalid');
    }
    const commandHash = commandHashWithActor(command, context.actor);
    const replay = this.findLifecycleReplay('AdvisorMessageClosed', command.requestId, commandHash);
    if (replay) return requireMessage(this.project(), command.messageId);
    requireMessage(this.project(), command.messageId);
    await this.appendWithIdentity(
      'AdvisorMessageClosed',
      command.requestId,
      context,
      command.closedAt,
      {
        messageId: command.messageId,
        reasonCode: command.reasonCode,
        commandHash,
        state: 'CLOSED',
      },
    );
    return requireMessage(this.project(), command.messageId);
  }

  private async reconcileMessageDelivery(notification: NotificationProjection): Promise<void> {
    const message = requireMessage(this.project(), notification.messageId);
    if (message.state !== 'DELIVERY_PENDING') return;
    if (notification.receiptArtifactRef === undefined || notification.receipt === undefined) {
      throw new DomainError('STORE_QUARANTINED', 'terminal notification lacks durable receipt evidence');
    }
    const eventType =
      notification.state === 'DELIVERED'
        ? 'AdvisorMessageDelivered'
        : notification.state === 'FAILED'
          ? 'AdvisorMessageDeliveryFailed'
          : 'AdvisorMessageManualFallbackRequired';
    await this.appendInternal(eventType, message, {
      messageId: message.messageId,
      notificationId: notification.notificationId,
      receiptArtifactRef: notification.receiptArtifactRef,
      receiptHash: notification.receipt.receiptHash,
      state:
        notification.state === 'DELIVERED'
          ? 'DELIVERED'
          : notification.state === 'FAILED'
            ? 'DELIVERY_FAILED'
            : 'MANUAL_FALLBACK_REQUIRED',
    });
  }

  private async reconcileNotificationAcknowledgement(
    message: AdvisorMessageProjection,
  ): Promise<void> {
    if (message.notificationId === undefined) return;
    const notification = this.project().notifications[message.notificationId];
    if (notification?.state !== 'DELIVERED') return;
    await this.appendInternal('NotificationAcknowledged', message, {
      notificationId: notification.notificationId,
      messageId: message.messageId,
      acknowledgementArtifactRef: message.acknowledgementArtifactRef ?? 'ACKNOWLEDGEMENT_EVENT',
      state: 'ACKNOWLEDGED',
    });
  }

  private findLifecycleReplay(eventType: EventType, requestId: string, commandHash: string): boolean {
    const prior = this.eventStore.readAll().find((event) => event.requestId === requestId);
    if (prior === undefined) return false;
    if (prior.eventType !== eventType || payloadString(prior, 'commandHash') !== commandHash) {
      throw new DomainError('IDEMPOTENCY_KEY_REUSED', 'requestId was already used with different lifecycle input');
    }
    return true;
  }

  private async appendInternal(
    eventType: EventType,
    message: AdvisorMessageProjection,
    payload: unknown,
  ): Promise<EventEnvelope> {
    const now = this.now();
    const context: ApplicationCommandContext = {
      actor: SERVICE_ACTOR,
      correlationId: message.correlationId,
      causationId: message.persistedEventId,
      receivedAt: now,
    };
    return this.appendWithIdentity(eventType, this.nextId(), context, now, payload);
  }

  private async appendWithIdentity(
    eventType: EventType,
    requestId: string,
    context: ApplicationCommandContext,
    occurredAt: string,
    payload: unknown,
  ): Promise<EventEnvelope> {
    const recordedAt = this.now();
    const receipt: AppendReceipt = await this.eventStore.append({
      eventId: this.nextId(),
      eventType,
      requestId,
      correlationId: context.correlationId,
      causationId: context.causationId,
      actor: context.actor,
      occurredAt,
      receivedAt: context.receivedAt,
      recordedAt,
      expectedStreamVersion: this.eventStore.sequence,
      expectedManifestVersion: this.policy.manifestVersion,
      payload: asJsonValue(payload),
    });
    return receipt.event;
  }

  private nextId(): string {
    const id = this.runtime.nextId();
    assertUuidV7(id, 'runtime ID');
    return id;
  }

  private now(): string {
    const now = this.runtime.now();
    assertUtcTimestamp(now, 'runtime time');
    return now;
  }
}

function gatewayRequest(
  message: AdvisorMessageProjection,
  notificationId: string,
): AdvisorNotificationRequest {
  return {
    notificationId,
    requestId: message.requestId,
    missionId: message.missionId,
    messageId: message.messageId,
    messageArtifactRef: message.messageArtifactRef,
    messageArtifactHash: message.messageArtifactHash,
    persistedEventId: message.persistedEventId,
    persistedMissionSequence: message.persistedMissionSequence,
    correlationId: message.correlationId,
  };
}

function persistenceReceipt(
  event: EventEnvelope,
  replayed: boolean,
): AdvisorMessagePersistenceReceipt {
  return {
    requestId: event.requestId,
    messageId: payloadString(event, 'messageId'),
    messageArtifactRef: payloadString(event, 'messageArtifactRef'),
    messageArtifactHash: payloadString(event, 'messageArtifactHash'),
    messagePayloadHash: payloadString(event, 'messagePayloadHash'),
    persistedEventId: event.eventId,
    persistedMissionSequence: event.sequence,
    acceptedAt: event.recordedAt,
    status: 'PERSISTED',
    replayed,
  };
}

function notificationTerminalEvent(
  receipt: AdvisorGatewayReceipt,
): 'NotificationDelivered' | 'NotificationFailed' | 'NotificationManualFallbackRequired' {
  if (receipt.status === 'DELIVERED' || receipt.status === 'ALREADY_DELIVERED') {
    return 'NotificationDelivered';
  }
  return receipt.status === 'RETRYABLE_FAILURE'
    ? 'NotificationFailed'
    : 'NotificationManualFallbackRequired';
}

function notificationTerminalState(
  receipt: AdvisorGatewayReceipt,
): 'DELIVERED' | 'FAILED' | 'MANUAL_FALLBACK_REQUIRED' {
  if (receipt.status === 'DELIVERED' || receipt.status === 'ALREADY_DELIVERED') return 'DELIVERED';
  return receipt.status === 'RETRYABLE_FAILURE' ? 'FAILED' : 'MANUAL_FALLBACK_REQUIRED';
}

function ambiguousManualReceipt(notificationId: string, now: string): AdvisorGatewayReceipt {
  return buildAdvisorGatewayReceipt({
    notificationId,
    adapter: 'MANUAL',
    adapterVersion: 'manual-reconciliation.v1',
    status: 'MANUAL_FALLBACK_REQUIRED',
    attempt: 1,
    queuedAt: now,
    attemptedAt: now,
    transportEvidenceRefs: [],
    failureCode: 'DELIVERY_RECEIPT_AMBIGUOUS',
  });
}

function requireMessage(projection: AdvisorInboxProjection, messageId: string): AdvisorMessageProjection {
  const message = projection.messages[messageId];
  if (message === undefined) throw new DomainError('MISSION_NOT_FOUND', 'Advisor message was not found');
  return message;
}

function requireNotification(
  projection: AdvisorInboxProjection,
  notificationId: string,
): NotificationProjection {
  const notification = projection.notifications[notificationId];
  if (notification === undefined) throw new DomainError('MISSION_NOT_FOUND', 'notification was not found');
  return notification;
}

function assertLeoContext(context: ApplicationCommandContext): void {
  assertContext(context);
  if (context.actor.role !== 'Leo/GPT') {
    throw new DomainError('UNAUTHORIZED_ACTOR', 'only Leo/GPT can submit an Advisor message');
  }
}

function assertAdvisorContext(context: ApplicationCommandContext): void {
  assertContext(context);
  if (context.actor.role !== 'Advisor') {
    throw new DomainError('UNAUTHORIZED_ACTOR', 'only Advisor can record acknowledgement or intake evidence');
  }
}

function assertContext(context: ApplicationCommandContext): void {
  assertUuidV7(context.correlationId, 'correlationId');
  assertUuidV7(context.causationId, 'causationId');
  assertUtcTimestamp(context.receivedAt, 'receivedAt');
  if (context.actor.subjectId.length === 0) {
    throw new DomainError('UNAUTHORIZED_ACTOR', 'application actor subject is missing');
  }
}

function payloadString(event: EventEnvelope, key: string): string {
  if (typeof event.payload !== 'object' || event.payload === null || Array.isArray(event.payload)) {
    throw new DomainError('STORE_QUARANTINED', 'event payload is not an object');
  }
  const value = event.payload[key];
  if (typeof value !== 'string') throw new DomainError('STORE_QUARANTINED', `${key} is missing`);
  return value;
}

function assertEvidenceIdentifiers(values: readonly string[]): void {
  if (values.length > 50 || values.some((value) => !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/u.test(value))) {
    throw new DomainError('INVALID_SCHEMA', 'evidence references are not bounded identifiers');
  }
}

function assertSourceArtifact(value: SourceArtifactRef): void {
  if (
    value.repository.length === 0 ||
    !/^[0-9a-f]{40}$/u.test(value.commit) ||
    value.path.length === 0 ||
    value.path.startsWith('/') ||
    value.path.split('/').includes('..') ||
    !isSha256(value.sha256)
  ) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'decision artifact reference is invalid');
  }
}

function assertVerifiedAuthorityEvidence(
  command: LinkAdvisorDecision,
  evidence: Awaited<ReturnType<DecisionAuthorityEvidenceVerifier['verify']>>,
  message: AdvisorMessageProjection,
  missionId: string,
): void {
  const expectedScope = [...message.referencedEntityIds].sort();
  const actualScope = [...evidence.scope.workUnitIds].sort();
  const evidenceSchemaVersion: unknown = evidence.schemaVersion;
  const evidenceScopeKind: unknown = evidence.scope.kind;
  const { evidenceHash, ...evidenceCore } = evidence;
  if (
    evidenceSchemaVersion !== 'agent-office.verified-decision-authority.v1' ||
    evidence.decisionId !== command.decisionId ||
    evidence.missionId !== missionId ||
    evidence.authorityRole !== command.authorityRole ||
    evidenceScopeKind !== 'WORK_UNIT_SET' ||
    evidence.decisionArtifact.repository !== command.decisionArtifact.repository ||
    evidence.decisionArtifact.commit !== command.decisionArtifact.commit ||
    evidence.decisionArtifact.path !== command.decisionArtifact.path ||
    evidence.decisionArtifact.sha256 !== command.decisionArtifact.sha256 ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(evidence.authoritySubjectId) ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/u.test(evidence.verifierId) ||
    !isSha256(evidenceHash) ||
    hashCanonical(evidenceCore) !== evidenceHash ||
    Date.parse(evidence.decidedAt) > Date.parse(command.recordedAt) ||
    Date.parse(evidence.verifiedAt) < Date.parse(evidence.decidedAt) ||
    expectedScope.length === 0 ||
    expectedScope.length !== actualScope.length ||
    expectedScope.some((value, index) => value !== actualScope[index])
  ) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'verified decision authority evidence mismatched');
  }
  assertUtcTimestamp(evidence.decidedAt, 'authority decision time');
  assertUtcTimestamp(evidence.verifiedAt, 'authority verification time');
}

function commandHashWithActor(command: unknown, actor: ActorReference): string {
  return hashCanonical({ command, actor });
}
