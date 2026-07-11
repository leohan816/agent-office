import { DomainError } from '../../contracts/types.js';
import { asJsonValue, isRecord } from '../../contracts/validation.js';
import {
  ALERT_POLICIES,
  assertAlertPayload,
  foldAlertOccurrence,
  type AlertActionCode,
  type AlertRaisedPayload,
} from '../../domain/alerts/index.js';
import type { EventEnvelope, EventType } from '../../domain/events/index.js';
import {
  ALERT_TRANSITIONS,
  assertEntityTransition,
  type AlertState,
} from '../../domain/state-machines/entities.js';
import { assertUtcTimestamp, assertUuidV7 } from '../../domain/time/index.js';
import { ImmutableArtifactStore } from '../../persistence/file-store/artifact-store.js';
import { EventStore } from '../../persistence/file-store/event-store.js';
import { hashCanonical } from '../../persistence/file-store/hashing.js';
import type { AdvisorInboxRuntime, ApplicationCommandContext } from '../advisor-inbox/types.js';

export interface AdvisorAlertDetail {
  readonly initiativeId: string;
  readonly packageId: string;
  readonly missionId: string;
  readonly requestId: string;
  readonly phaseId: string;
  readonly workUnitId: string;
  readonly confirmedFacts: readonly string[];
  readonly unknowns: readonly string[];
  readonly question: string;
  readonly options: readonly string[];
  readonly recommendation: string;
  readonly safeDefault: string;
  readonly blockedCapability: string;
  readonly blockerReason: string;
  readonly resolutionOwner: string;
  readonly nextAction: string;
  readonly evidenceRefs: readonly string[];
}

export interface DurableAlertProjection {
  readonly alertId: string;
  readonly deduplicationKey: string;
  readonly state: AlertState;
  readonly payload: AlertRaisedPayload;
  readonly detailArtifactRef: string;
  readonly detailArtifactHash: string;
  readonly snoozedUntil?: string;
  readonly lastLifecycleEventId: string;
}

export interface AlertLifecycleCommand {
  readonly requestId: string;
  readonly alertId: string;
  readonly recordedAt: string;
  readonly reasonCode: string;
  readonly snoozedUntil?: string;
  readonly evidenceRefs?: readonly string[];
}

export type AlertActionIntent =
  | { readonly kind: 'COPY_GPT_PACKAGE' | 'OPEN_EVIDENCE' | 'HOLD'; readonly mutatesMission: false }
  | {
      readonly kind: 'ADVISOR_MESSAGE_DRAFT';
      readonly messageKind: 'CLARIFICATION' | 'PAUSE' | 'CANCEL';
      readonly mutatesMission: false;
    };

export class DurableAlertCenter {
  public constructor(
    private readonly eventStore: EventStore,
    private readonly artifacts: ImmutableArtifactStore,
    private readonly runtime: AdvisorInboxRuntime,
    private readonly missionId: string,
    private readonly manifestVersion: number,
  ) {}

  public project(): Readonly<Record<string, DurableAlertProjection>> {
    return projectDurableAlerts(this.eventStore.readAll());
  }

  public async raise(
    payload: AlertRaisedPayload,
    detail: AdvisorAlertDetail,
    context: ApplicationCommandContext,
  ): Promise<DurableAlertProjection> {
    assertAlertContext(context);
    assertAdvisorAlertDetail(detail);
    if (
      payload.missionId !== this.missionId ||
      payload.manifestVersion !== this.manifestVersion ||
      payload.expectedStreamVersion !== this.eventStore.sequence ||
      detail.missionId !== this.missionId ||
      detail.requestId !== payload.requestId
    ) {
      throw new DomainError('MANIFEST_VERSION_CONFLICT', 'alert authority does not match active mission');
    }
    const applicationCommandHash = hashCanonical({ payload, detail, actor: context.actor });
    const priorRequest = this.eventStore.readAll().find((event) => event.requestId === payload.requestId);
    if (priorRequest !== undefined) {
      if (
        priorRequest.eventType !== 'AlertRaised' ||
        !isRecord(priorRequest.payload) ||
        !isRecord(priorRequest.payload.messageParameters) ||
        priorRequest.payload.messageParameters.applicationCommandHash !== applicationCommandHash
      ) {
        throw new DomainError('IDEMPOTENCY_KEY_REUSED', 'alert requestId was reused with different input');
      }
      const replayed = this.project()[payloadString(priorRequest, 'alertId')];
      if (replayed === undefined) throw new DomainError('STORE_QUARANTINED', 'replayed alert is missing');
      return replayed;
    }
    const projected = this.project();
    const active = Object.values(projected).find(
      (candidate) =>
        candidate.deduplicationKey === payload.deduplicationKey &&
        candidate.state !== 'RESOLVED' &&
        candidate.state !== 'SUPPRESSED',
    );
    if (
      active !== undefined &&
      payload.sourceEventIds.every((eventId) => active.payload.sourceEventIds.includes(eventId))
    ) {
      return active;
    }
    const detailArtifact = await this.artifacts.putScopedCanonicalJson(
      'alerts',
      [this.missionId, active?.alertId ?? payload.alertId, payload.requestId],
      { schemaVersion: 'agent-office.advisor-alert-detail.v1', ...detail },
      32 * 1024,
    );
    const nextPayload: AlertRaisedPayload = active === undefined
      ? {
          ...payload,
          messageParameters: {
            ...payload.messageParameters,
            detailArtifactRef: detailArtifact.relativePath,
            detailArtifactHash: detailArtifact.sha256,
            applicationCommandHash,
          },
        }
      : {
          ...foldAlertOccurrence(active.payload, payload.lastObservedAt),
          sourceEventIds: unique([...active.payload.sourceEventIds, ...payload.sourceEventIds]),
          evidenceRefs: uniqueBy(
            [...active.payload.evidenceRefs, ...payload.evidenceRefs],
            (evidence) => evidence.artifactId,
          ),
          requestId: payload.requestId,
          expectedStreamVersion: this.eventStore.sequence,
          causationId: payload.causationId,
          correlationId: payload.correlationId,
          messageParameters: {
            ...active.payload.messageParameters,
            detailArtifactRef: detailArtifact.relativePath,
            detailArtifactHash: detailArtifact.sha256,
            applicationCommandHash,
          },
        };
    assertAlertPayload(nextPayload);
    await this.append('AlertRaised', payload.requestId, context, payload.lastObservedAt, nextPayload);
    const result = this.project()[nextPayload.alertId];
    if (result === undefined) throw new Error('durable alert did not project');
    return result;
  }

  public acknowledge(
    command: AlertLifecycleCommand,
    context: ApplicationCommandContext,
  ): Promise<DurableAlertProjection> {
    return this.transition('AlertAcknowledged', 'ACKNOWLEDGED', command, context);
  }

  public snooze(
    command: AlertLifecycleCommand & { readonly snoozedUntil: string },
    context: ApplicationCommandContext,
  ): Promise<DurableAlertProjection> {
    assertUtcTimestamp(command.snoozedUntil, 'snoozedUntil');
    return this.transition('AlertSnoozed', 'SNOOZED', command, context);
  }

  public resolve(
    command: AlertLifecycleCommand & { readonly evidenceRefs: readonly string[] },
    context: ApplicationCommandContext,
  ): Promise<DurableAlertProjection> {
    if (command.evidenceRefs.length === 0) {
      throw new DomainError('EVIDENCE_MISSING_OR_STALE', 'alert resolution requires evidence');
    }
    return this.transition('AlertResolved', 'RESOLVED', command, context);
  }

  public suppress(
    command: AlertLifecycleCommand,
    context: ApplicationCommandContext,
  ): Promise<DurableAlertProjection> {
    return this.transition('AlertSuppressed', 'SUPPRESSED', command, context);
  }

  private async transition(
    eventType: EventType,
    state: AlertState,
    command: AlertLifecycleCommand,
    context: ApplicationCommandContext,
  ): Promise<DurableAlertProjection> {
    assertAlertContext(context);
    assertUuidV7(command.requestId, 'requestId');
    assertUuidV7(command.alertId, 'alertId');
    assertUtcTimestamp(command.recordedAt, 'recordedAt');
    const commandHash = hashCanonical({ command, actor: context.actor });
    const prior = this.eventStore.readAll().find((event) => event.requestId === command.requestId);
    if (prior !== undefined) {
      if (prior.eventType !== eventType || payloadString(prior, 'commandHash') !== commandHash) {
        throw new DomainError('IDEMPOTENCY_KEY_REUSED', 'alert lifecycle requestId was reused');
      }
      const replayed = this.project()[command.alertId];
      if (replayed === undefined) throw new DomainError('STORE_QUARANTINED', 'replayed alert is missing');
      return replayed;
    }
    const current = this.project()[command.alertId];
    if (current === undefined) throw new DomainError('MISSION_NOT_FOUND', 'alert was not found');
    assertEntityTransition(ALERT_TRANSITIONS, current.state, state);
    await this.append(eventType, command.requestId, context, command.recordedAt, {
      alertId: command.alertId,
      reasonCode: command.reasonCode,
      commandHash,
      state,
      ...(command.snoozedUntil === undefined ? {} : { snoozedUntil: command.snoozedUntil }),
      ...(command.evidenceRefs === undefined ? {} : { evidenceRefs: command.evidenceRefs }),
    });
    const result = this.project()[command.alertId];
    if (result === undefined) throw new Error('alert lifecycle event did not project');
    return result;
  }

  private async append(
    eventType: EventType,
    requestId: string,
    context: ApplicationCommandContext,
    occurredAt: string,
    payload: unknown,
  ): Promise<void> {
    await this.eventStore.append({
      eventId: this.nextId(),
      eventType,
      requestId,
      correlationId: context.correlationId,
      causationId: context.causationId,
      actor: context.actor,
      occurredAt,
      receivedAt: context.receivedAt,
      recordedAt: this.now(),
      expectedStreamVersion: this.eventStore.sequence,
      expectedManifestVersion: this.manifestVersion,
      payload: asJsonValue(payload),
    });
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

export function projectDurableAlerts(
  events: readonly EventEnvelope[],
): Readonly<Record<string, DurableAlertProjection>> {
  const alerts: Record<string, DurableAlertProjection> = {};
  for (const event of events) {
    if (!event.eventType.startsWith('Alert')) continue;
    if (!isRecord(event.payload)) throw new DomainError('STORE_QUARANTINED', 'alert event payload is invalid');
    const alertId = payloadString(event, 'alertId');
    if (event.eventType === 'AlertRaised') {
      const payload = event.payload as unknown as AlertRaisedPayload;
      assertAlertPayload(payload);
      const detailArtifactRef = parameterString(payload, 'detailArtifactRef');
      const detailArtifactHash = parameterString(payload, 'detailArtifactHash');
      const prior = alerts[alertId];
      alerts[alertId] = {
        alertId,
        deduplicationKey: payload.deduplicationKey,
        state: prior?.state ?? 'OPEN',
        payload,
        detailArtifactRef,
        detailArtifactHash,
        ...(prior?.snoozedUntil === undefined ? {} : { snoozedUntil: prior.snoozedUntil }),
        lastLifecycleEventId: event.eventId,
      };
      continue;
    }
    const current = alerts[alertId];
    if (current === undefined) throw new DomainError('STORE_QUARANTINED', 'alert lifecycle has no raised event');
    const nextState = alertEventState(event.eventType);
    assertEntityTransition(ALERT_TRANSITIONS, current.state, nextState);
    const snoozedUntil =
      event.eventType === 'AlertSnoozed' ? payloadString(event, 'snoozedUntil') : undefined;
    alerts[alertId] = {
      ...current,
      state: nextState,
      ...(snoozedUntil === undefined ? {} : { snoozedUntil }),
      lastLifecycleEventId: event.eventId,
    };
  }
  return alerts;
}

export function alertActionIntent(action: AlertActionCode): AlertActionIntent {
  switch (action) {
    case 'COPY_GPT_PACKAGE':
    case 'OPEN_EVIDENCE':
    case 'HOLD':
      return { kind: action, mutatesMission: false };
    case 'REPLY_TO_ADVISOR':
      return { kind: 'ADVISOR_MESSAGE_DRAFT', messageKind: 'CLARIFICATION', mutatesMission: false };
    case 'PAUSE_MISSION':
      return { kind: 'ADVISOR_MESSAGE_DRAFT', messageKind: 'PAUSE', mutatesMission: false };
    case 'CANCEL_MISSION':
      return { kind: 'ADVISOR_MESSAGE_DRAFT', messageKind: 'CANCEL', mutatesMission: false };
  }
}

export function assertAdvisorAlertDetail(detail: AdvisorAlertDetail): void {
  assertUuidV7(detail.requestId, 'alert detail requestId');
  const scalarFields = [
    detail.initiativeId,
    detail.packageId,
    detail.missionId,
    detail.phaseId,
    detail.workUnitId,
    detail.question,
    detail.recommendation,
    detail.safeDefault,
    detail.blockedCapability,
    detail.blockerReason,
    detail.resolutionOwner,
    detail.nextAction,
  ];
  if (
    scalarFields.some((value) => value.length === 0 || Array.from(value).length > 2_000) ||
    detail.confirmedFacts.length > 50 ||
    detail.unknowns.length > 50 ||
    detail.options.length > 20 ||
    detail.evidenceRefs.length > 50 ||
    /[^\P{Cc}\n\t]/u.test(scalarFields.join('\n'))
  ) {
    throw new DomainError('INVALID_SCHEMA', 'alert detail exceeds its closed content bounds');
  }
}

function alertEventState(eventType: EventType): AlertState {
  switch (eventType) {
    case 'AlertAcknowledged':
      return 'ACKNOWLEDGED';
    case 'AlertSnoozed':
      return 'SNOOZED';
    case 'AlertResolved':
      return 'RESOLVED';
    case 'AlertSuppressed':
      return 'SUPPRESSED';
    default:
      throw new DomainError('STORE_QUARANTINED', 'unexpected alert lifecycle event');
  }
}

function assertAlertContext(context: ApplicationCommandContext): void {
  if (context.actor.role !== 'Leo/GPT' && context.actor.role !== 'Advisor') {
    throw new DomainError('UNAUTHORIZED_ACTOR', 'alert application requires Leo/GPT or Advisor');
  }
  assertUuidV7(context.correlationId, 'correlationId');
  assertUuidV7(context.causationId, 'causationId');
  assertUtcTimestamp(context.receivedAt, 'receivedAt');
}

function parameterString(payload: AlertRaisedPayload, key: string): string {
  const value = payload.messageParameters[key];
  if (typeof value !== 'string') throw new DomainError('STORE_QUARANTINED', `${key} is missing`);
  return value;
}

function payloadString(event: EventEnvelope, key: string): string {
  if (!isRecord(event.payload) || typeof event.payload[key] !== 'string') {
    throw new DomainError('STORE_QUARANTINED', `${key} is missing`);
  }
  return event.payload[key];
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function uniqueBy<T>(values: readonly T[], key: (value: T) => string): readonly T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const id = key(value);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export { ALERT_POLICIES };
