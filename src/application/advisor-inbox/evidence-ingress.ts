import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalAdvisorPointerEnvelope } from '../../adapters/gateways/advisor.js';
import type { ExactGitAuthorityReader } from '../../adapters/gateways/tmux-advisor/exact-authority.js';
import {
  EXACT_DELIVERY_ACTIVATION_MISSION,
  EXACT_DELIVERY_GOVERNED_MISSION,
  parseAdvisorDeliveryReadinessLease,
  parseSourceArtifactRef,
  type ExactAdvisorDeliveryActivation,
} from '../../adapters/gateways/tmux-advisor/exact-config.js';
import { DomainError, type SourceArtifactRef } from '../../contracts/types.js';
import {
  assertExactKeys,
  assertRecord,
  requireArray,
  requireString,
} from '../../contracts/validation.js';
import { assertResumeProof, type ResumeProof } from '../../domain/decisions/resume-proof.js';
import type { EventEnvelope } from '../../domain/events/index.js';
import { assertUtcTimestamp, assertUuidV7 } from '../../domain/time/index.js';
import { writeAtomicCanonicalJson } from '../../persistence/file-store/atomic-file.js';
import { sha256Bytes } from '../../persistence/file-store/hashing.js';
import { isNodeError, validateStateRoot } from '../../persistence/file-store/path-safety.js';
import type { EventStore } from '../../persistence/file-store/event-store.js';
import type { AgentOfficeRuntimeIdentity } from '../../runtime/identity.js';
import type { AdvisorInboxService } from './service.js';
import {
  ADVISOR_INTAKE_CLASSIFICATIONS,
  type AdvisorInboxProjection,
  type AdvisorIntakeClassification,
  type AdvisorMessageProjection,
  type ApplicationCommandContext,
  type DecisionAuthorityRole,
} from './types.js';

interface EvidenceCheckpointRecord {
  readonly path: string;
  readonly artifact: SourceArtifactRef;
  readonly status: 'OBSERVED' | 'APPLIED';
  readonly observedAt: string;
  readonly appliedAt?: string;
}

interface EvidenceCheckpointState {
  readonly schemaVersion: 'agent-office.advisor-evidence-ingress-checkpoint.v1';
  readonly records: Readonly<Record<string, EvidenceCheckpointRecord>>;
}

const EMPTY_CHECKPOINT: EvidenceCheckpointState = {
  schemaVersion: 'agent-office.advisor-evidence-ingress-checkpoint.v1',
  records: {},
};

interface ObservedEvidence {
  readonly artifact: SourceArtifactRef;
  readonly bytes: Uint8Array;
  readonly checkpointStatus: 'OBSERVED' | 'APPLIED';
}

export interface AckEvidence {
  readonly requestId: string;
  readonly messageId: string;
  readonly notificationId: string;
  readonly acknowledgementId: string;
  readonly acknowledgedAt: string;
  readonly readinessLeaseId: string;
  readonly pointerEnvelopeHash: string;
  readonly messageArtifactRef: string;
  readonly messageArtifactHash: string;
  readonly transportReceiptHash: string;
  readonly evidenceRefs: readonly string[];
}

export interface IntakeEvidence {
  readonly requestId: string;
  readonly messageId: string;
  readonly notificationId: string;
  readonly intakeId: string;
  readonly classification: AdvisorIntakeClassification;
  readonly recordedAt: string;
  readonly acknowledgementArtifact: SourceArtifactRef;
  readonly messageArtifactHash: string;
  readonly referencedWorkUnitIds: readonly string[];
  readonly evidenceRefs: readonly string[];
}

export interface DecisionEvidence {
  readonly requestId: string;
  readonly messageId: string;
  readonly decisionId: string;
  readonly decisionKind: 'ROUTINE_ROUTE' | 'LEO_GPT_DECISION';
  readonly authorityRole: DecisionAuthorityRole;
  readonly authoritySubjectId: string;
  readonly workUnitIds: readonly string[];
  readonly decidedAt: string;
  readonly intakeArtifact: SourceArtifactRef;
  readonly governingLeoAuthorityArtifact: SourceArtifactRef;
  readonly decisionAuthorityArtifact: SourceArtifactRef;
  readonly decisionCode: string;
  readonly evidenceRefs: readonly string[];
}

export interface ResumeEvidence {
  readonly requestId: string;
  readonly messageId: string;
  readonly workUnitId: string;
  readonly decisionArtifact: SourceArtifactRef;
  readonly intakeArtifact: SourceArtifactRef;
  readonly recordedAt: string;
  readonly resumeProof: ResumeProof;
}

export class AdvisorEvidenceIngress {
  private queue: Promise<void> = Promise.resolve();

  private constructor(
    private readonly activation: ExactAdvisorDeliveryActivation,
    private readonly source: ExactGitAuthorityReader,
    private readonly inbox: AdvisorInboxService,
    private readonly store: EventStore,
    private readonly runtime: AgentOfficeRuntimeIdentity,
    private readonly checkpointPath: string,
    private checkpoint: EvidenceCheckpointState,
  ) {}

  public static async open(options: {
    readonly activation: ExactAdvisorDeliveryActivation;
    readonly source: ExactGitAuthorityReader;
    readonly inbox: AdvisorInboxService;
    readonly store: EventStore;
    readonly runtime: AgentOfficeRuntimeIdentity;
    readonly stateRoot: string;
  }): Promise<AdvisorEvidenceIngress> {
    const stateRoot = await validateStateRoot(options.stateRoot);
    const checkpointPath = path.join(stateRoot, 'indexes', 'advisor-evidence-ingress.json');
    const checkpoint = await readCheckpoint(checkpointPath);
    return new AdvisorEvidenceIngress(
      options.activation,
      options.source,
      options.inbox,
      options.store,
      options.runtime,
      checkpointPath,
      checkpoint,
    );
  }

  public async refresh(): Promise<number> {
    const operation = this.queue.then(() => this.refreshSerial());
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async refreshSerial(): Promise<number> {
    const before = this.store.sequence;
    const snapshot = await this.source.snapshot();
    if (snapshot.headCommit !== snapshot.upstreamCommit) {
      throw invalidEvidence('Advisor evidence repository HEAD is not at upstream');
    }
    await this.auditAcceptedEvidence();
    const messageIds = Object.keys(this.inbox.project().messages).sort();
    for (const messageId of messageIds) await this.refreshMessage(messageId);
    return this.store.sequence - before;
  }

  private async auditAcceptedEvidence(): Promise<void> {
    const snapshot = await this.source.snapshot();
    for (const record of Object.values(this.checkpoint.records)) {
      const current = await this.source.readUpstreamPath(record.path);
      if (
        snapshot.dirtyPaths.has(record.path) ||
        current?.ref.sha256 !== record.artifact.sha256 ||
        !(await this.source.isAncestor(record.artifact.commit, snapshot.upstreamCommit))
      ) {
        throw invalidEvidence('accepted Advisor evidence was removed or rewritten');
      }
    }
  }

  private async refreshMessage(messageId: string): Promise<void> {
    let projection = this.inbox.project();
    let message = requireMessage(projection, messageId);
    if (message.state === 'DELIVERED' || message.state === 'MANUAL_FALLBACK_REQUIRED') {
      const applied = await this.applyAck(message, projection);
      if (!applied) {
        await this.assertAbsent([
          intakePath(this.activation, messageId),
          decisionPath(this.activation, messageId),
          ...message.referencedEntityIds.map((id) => resumePath(this.activation, messageId, id)),
        ]);
        return;
      }
      projection = this.inbox.project();
      message = requireMessage(projection, messageId);
    }
    if (message.state === 'ACKNOWLEDGED') {
      const applied = await this.applyIntake(message);
      if (!applied) {
        await this.assertAbsent([
          decisionPath(this.activation, messageId),
          ...message.referencedEntityIds.map((id) => resumePath(this.activation, messageId, id)),
        ]);
        return;
      }
      projection = this.inbox.project();
      message = requireMessage(projection, messageId);
    }
    if (message.state === 'INTAKE_RECORDED') {
      if (message.intakeClassification !== 'ROUTINE_ROUTE' &&
        message.intakeClassification !== 'NEEDS_LEO_DECISION') {
        await this.assertAbsent([
          decisionPath(this.activation, messageId),
          ...message.referencedEntityIds.map((id) => resumePath(this.activation, messageId, id)),
        ]);
        return;
      }
      const applied = await this.applyDecision(message);
      if (!applied) {
        await this.assertAbsent(
          message.referencedEntityIds.map((id) => resumePath(this.activation, messageId, id)),
        );
        return;
      }
      projection = this.inbox.project();
      message = requireMessage(projection, messageId);
    }
    if (message.state === 'DECISION_LINKED') {
      for (const workUnitId of message.referencedEntityIds) {
        await this.applyResume(message, workUnitId);
      }
    }
  }

  private async applyAck(
    message: AdvisorMessageProjection,
    projection: AdvisorInboxProjection,
  ): Promise<boolean> {
    const observed = await this.observe(ackPath(this.activation, message.messageId));
    if (observed === undefined) return false;
    if (observed.checkpointStatus === 'APPLIED') return true;
    const evidence = parseAdvisorAcknowledgementEvidence(observed.bytes);
    const notificationId = message.notificationId;
    const notification = notificationId === undefined ? undefined : projection.notifications[notificationId];
    const receipt = notification?.receipt;
    const pointerBound = receipt?.transportEvidenceRefs.includes(
      `pointer:${evidence.pointerEnvelopeHash}`,
    ) === true;
    const leaseBound = receipt?.transportEvidenceRefs.includes(
      `lease:${evidence.readinessLeaseId}`,
    ) === true ||
      (receipt?.status === 'MANUAL_FALLBACK_REQUIRED' &&
        await this.validateManualReadinessLease(evidence.readinessLeaseId));
    if (
      notification === undefined || receipt === undefined ||
      (receipt.status !== 'DELIVERED' && receipt.status !== 'ALREADY_DELIVERED' &&
        receipt.status !== 'MANUAL_FALLBACK_REQUIRED') ||
      evidence.messageId !== message.messageId || evidence.notificationId !== notification.notificationId ||
      evidence.requestId === message.requestId ||
      evidence.messageArtifactRef !== message.messageArtifactRef ||
      evidence.messageArtifactHash !== message.messageArtifactHash ||
      evidence.transportReceiptHash !== receipt.receiptHash ||
      evidence.pointerEnvelopeHash !== sha256Bytes(canonicalAdvisorPointerEnvelope(notification.request)) ||
      !leaseBound || !pointerBound ||
      Date.parse(evidence.acknowledgedAt) < Date.parse(receipt.attemptedAt) ||
      Date.parse(evidence.acknowledgedAt) > Date.parse(this.runtime.now())
    ) throw invalidEvidence('Advisor acknowledgement correlations are invalid');
    await this.inbox.recordAcknowledgement(
      {
        requestId: evidence.requestId,
        messageId: evidence.messageId,
        acknowledgementId: evidence.acknowledgementId,
        acknowledgedAt: evidence.acknowledgedAt,
        evidenceRefs: evidence.evidenceRefs,
        sourceArtifact: observed.artifact,
      },
      this.context(evidence.requestId, evidence.acknowledgedAt),
    );
    await this.markApplied(observed.artifact);
    return true;
  }

  private async validateManualReadinessLease(leaseId: string): Promise<boolean> {
    const blob = await this.source.readUpstreamPath(this.activation.readinessLeasePath);
    if (blob === undefined) return false;
    const snapshot = await this.source.snapshot();
    if (
      snapshot.headCommit !== snapshot.upstreamCommit ||
      snapshot.dirtyPaths.has(this.activation.readinessLeasePath)
    ) return false;
    for (const ref of Object.values(this.activation.snapshotRefs)) {
      if (!(await this.source.isAncestor(ref.commit, blob.ref.commit))) return false;
    }
    let value: unknown;
    try {
      value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(blob.bytes)) as unknown;
    } catch {
      return false;
    }
    const lease = parseAdvisorDeliveryReadinessLease(value);
    return lease.leaseId === leaseId;
  }

  private async applyIntake(message: AdvisorMessageProjection): Promise<boolean> {
    const observed = await this.observe(intakePath(this.activation, message.messageId));
    if (observed === undefined) return false;
    if (observed.checkpointStatus === 'APPLIED') return true;
    const evidence = parseAdvisorIntakeEvidence(observed.bytes);
    if (
      message.acknowledgementEvidenceRef === undefined ||
      !sameRef(evidence.acknowledgementArtifact, message.acknowledgementEvidenceRef) ||
      evidence.messageId !== message.messageId || evidence.notificationId !== message.notificationId ||
      evidence.messageArtifactHash !== message.messageArtifactHash ||
      !sameStrings(canonicalIds(evidence.referencedWorkUnitIds), canonicalIds(message.referencedEntityIds)) ||
      timelineTime(message, 'ACKNOWLEDGED') > Date.parse(evidence.recordedAt) ||
      Date.parse(evidence.recordedAt) > Date.parse(this.runtime.now()) ||
      !(await this.source.isAncestor(
        evidence.acknowledgementArtifact.commit,
        observed.artifact.commit,
      ))
    ) throw invalidEvidence('Advisor intake correlations or ordering are invalid');
    await this.inbox.recordIntake(
      {
        requestId: evidence.requestId,
        messageId: evidence.messageId,
        intakeId: evidence.intakeId,
        classification: evidence.classification,
        recordedAt: evidence.recordedAt,
        evidenceRefs: evidence.evidenceRefs,
        sourceArtifact: observed.artifact,
      },
      this.context(evidence.requestId, evidence.recordedAt),
    );
    await this.markApplied(observed.artifact);
    return true;
  }

  private async applyDecision(message: AdvisorMessageProjection): Promise<boolean> {
    const observed = await this.observe(decisionPath(this.activation, message.messageId));
    if (observed === undefined) return false;
    if (observed.checkpointStatus === 'APPLIED') return true;
    const evidence = parseAdvisorDecisionEvidence(observed.bytes);
    if (
      message.intakeEvidenceRef === undefined ||
      !sameRef(evidence.intakeArtifact, message.intakeEvidenceRef) ||
      evidence.messageId !== message.messageId ||
      !sameStrings(canonicalIds(evidence.workUnitIds), canonicalIds(message.referencedEntityIds)) ||
      timelineTime(message, 'INTAKE_RECORDED') > Date.parse(evidence.decidedAt) ||
      Date.parse(evidence.decidedAt) > Date.parse(this.runtime.now()) ||
      !(await this.source.isAncestor(evidence.intakeArtifact.commit, observed.artifact.commit)) ||
      !(await this.source.isAncestor(
        evidence.decisionAuthorityArtifact.commit,
        observed.artifact.commit,
      )) ||
      !(await this.source.isAncestor(
        evidence.governingLeoAuthorityArtifact.commit,
        observed.artifact.commit,
      ))
    ) throw invalidEvidence('Advisor decision correlations or ordering are invalid');
    if (evidence.authorityRole === 'Advisor') {
      if (
        evidence.decisionKind !== 'ROUTINE_ROUTE' ||
        evidence.authoritySubjectId !== 'agent-office-advisor' ||
        evidence.decisionCode !== 'ROUTE_ALREADY_AUTHORIZED_WORK' ||
        message.intakeClassification !== 'ROUTINE_ROUTE' ||
        !sameRef(evidence.governingLeoAuthorityArtifact, this.activation.snapshotRefs.optionADecision)
      ) throw invalidEvidence('Advisor attempted a material or ungoverned decision');
    } else if (
      evidence.decisionKind !== 'LEO_GPT_DECISION' ||
      message.intakeClassification !== 'NEEDS_LEO_DECISION'
    ) {
      throw invalidEvidence('Leo/GPT decision evidence is required for this intake');
    }
    await this.inbox.linkDecision(
      {
        requestId: evidence.requestId,
        messageId: evidence.messageId,
        decisionId: evidence.decisionId,
        authorityRole: evidence.authorityRole,
        decisionArtifact: evidence.decisionAuthorityArtifact,
        recordedAt: evidence.decidedAt,
        sourceArtifact: observed.artifact,
      },
      this.context(evidence.requestId, evidence.decidedAt),
    );
    await this.markApplied(observed.artifact);
    return true;
  }

  private async applyResume(
    message: AdvisorMessageProjection,
    workUnitId: string,
  ): Promise<boolean> {
    const observed = await this.observe(resumePath(this.activation, message.messageId, workUnitId));
    if (observed === undefined) return false;
    if (observed.checkpointStatus === 'APPLIED') return true;
    const evidence = parseAdvisorResumeEvidence(observed.bytes);
    const waiting = findWaitingEvent(this.store.readAll(), workUnitId, evidence.resumeProof.waitingEventId);
    if (
      message.intakeEvidenceRef === undefined || message.authorityEvidenceRef === undefined ||
      evidence.messageId !== message.messageId || evidence.workUnitId !== workUnitId ||
      !sameRef(evidence.intakeArtifact, message.intakeEvidenceRef) ||
      !sameRef(evidence.decisionArtifact, message.authorityEvidenceRef) ||
      evidence.resumeProof.workUnitId !== workUnitId ||
      evidence.resumeProof.decisionArtifactHash !== evidence.decisionArtifact.sha256 ||
      evidence.resumeProof.intakeArtifactHash !== evidence.intakeArtifact.sha256 ||
      evidence.resumeProof.expectedStreamVersion !== this.store.sequence ||
      waiting?.from !== evidence.resumeProof.previousState ||
      timelineTime(message, 'DECISION_LINKED') > Date.parse(evidence.recordedAt) ||
      Date.parse(evidence.recordedAt) > Date.parse(this.runtime.now()) ||
      !(await this.source.isAncestor(evidence.decisionArtifact.commit, observed.artifact.commit)) ||
      !(await this.source.isAncestor(evidence.intakeArtifact.commit, observed.artifact.commit))
    ) throw invalidEvidence('Advisor resume proof correlations or concurrency are invalid');
    await this.inbox.recordResumeProof(
      {
        requestId: evidence.requestId,
        messageId: evidence.messageId,
        from: waiting.to,
        proof: evidence.resumeProof,
        recordedAt: evidence.recordedAt,
        sourceArtifact: observed.artifact,
      },
      this.context(evidence.requestId, evidence.recordedAt),
    );
    await this.markApplied(observed.artifact);
    return true;
  }

  private async observe(relativePath: string): Promise<ObservedEvidence | undefined> {
    const existing = this.checkpoint.records[relativePath];
    const current = await this.source.readUpstreamPath(relativePath);
    if (current === undefined) {
      if (existing !== undefined) throw invalidEvidence('accepted Advisor evidence was removed');
      return undefined;
    }
    const snapshot = await this.source.snapshot();
    if (snapshot.dirtyPaths.has(relativePath)) throw invalidEvidence('Advisor evidence path is dirty');
    if (existing !== undefined) {
      if (existing.artifact.sha256 !== current.ref.sha256) {
        throw invalidEvidence('accepted Advisor evidence was rewritten');
      }
      const exact = await this.source.readExact(existing.artifact);
      return { artifact: existing.artifact, bytes: exact.bytes, checkpointStatus: existing.status };
    }
    const history = await this.source.pathHistory(relativePath);
    if (history.length !== 1) {
      throw invalidEvidence('new Advisor evidence must be one immutable Git addition');
    }
    const commit = history[0];
    if (commit === undefined || !(await this.source.isAncestor(commit, snapshot.upstreamCommit))) {
      throw invalidEvidence('Advisor evidence commit is not upstream-ancestral');
    }
    for (const ref of Object.values(this.activation.snapshotRefs)) {
      if (!(await this.source.isAncestor(ref.commit, commit))) {
        throw invalidEvidence('Advisor evidence predates a required authority snapshot');
      }
    }
    const artifact: SourceArtifactRef = {
      repository: 'foundation-docs',
      commit,
      path: relativePath,
      sha256: current.ref.sha256,
    };
    const exact = await this.source.readExact(artifact);
    if (sha256Bytes(exact.bytes) !== artifact.sha256) throw invalidEvidence('Advisor evidence hash mismatched');
    await this.setCheckpoint({
      path: relativePath,
      artifact,
      status: 'OBSERVED',
      observedAt: this.runtime.now(),
    });
    return { artifact, bytes: exact.bytes, checkpointStatus: 'OBSERVED' };
  }

  private async markApplied(artifact: SourceArtifactRef): Promise<void> {
    const prior = this.checkpoint.records[artifact.path];
    if (prior === undefined || !sameRef(prior.artifact, artifact)) {
      throw new DomainError('STORE_QUARANTINED', 'Advisor evidence checkpoint identity mismatched');
    }
    await this.setCheckpoint({ ...prior, status: 'APPLIED', appliedAt: this.runtime.now() });
  }

  private async setCheckpoint(record: EvidenceCheckpointRecord): Promise<void> {
    const next: EvidenceCheckpointState = {
      ...this.checkpoint,
      records: { ...this.checkpoint.records, [record.path]: record },
    };
    await writeAtomicCanonicalJson(this.checkpointPath, next);
    this.checkpoint = next;
  }

  private async assertAbsent(paths: readonly string[]): Promise<void> {
    for (const relativePath of paths) {
      if (await this.source.readUpstreamPath(relativePath) !== undefined) {
        throw invalidEvidence('Advisor evidence stage appeared before its required predecessor');
      }
    }
  }

  private context(requestId: string, receivedAt: string): ApplicationCommandContext {
    return {
      actor: { role: 'Advisor', subjectId: 'agent-office-advisor' },
      correlationId: requestId,
      causationId: requestId,
      receivedAt,
    };
  }
}

export function parseAdvisorAcknowledgementEvidence(bytes: Uint8Array): AckEvidence {
  const value = jsonRecord(bytes, 'Advisor acknowledgement evidence');
  assertExactKeys(value, [
    'schemaVersion', 'missionId', 'activationMissionId', 'requestId', 'messageId',
    'notificationId', 'acknowledgementId', 'acknowledgedAt', 'advisorRole',
    'advisorSubjectId', 'destination', 'readinessLeaseId', 'pointerEnvelopeHash',
    'messageArtifactRef', 'messageArtifactHash', 'transportReceiptHash',
    'artifactReadStatus', 'evidenceRefs',
  ], 'Advisor acknowledgement evidence');
  if (
    value.schemaVersion !== 'agent-office.advisor-acknowledgement-evidence.v1' ||
    value.missionId !== EXACT_DELIVERY_GOVERNED_MISSION ||
    value.activationMissionId !== EXACT_DELIVERY_ACTIVATION_MISSION ||
    value.advisorRole !== 'Advisor' || value.advisorSubjectId !== 'agent-office-advisor' ||
    value.artifactReadStatus !== 'VERIFIED'
  ) throw invalidEvidence('Advisor acknowledgement authority is invalid');
  assertExactDestination(value.destination);
  return {
    requestId: uuid(value.requestId, 'ACK requestId'),
    messageId: uuid(value.messageId, 'ACK messageId'),
    notificationId: uuid(value.notificationId, 'ACK notificationId'),
    acknowledgementId: uuid(value.acknowledgementId, 'acknowledgementId'),
    acknowledgedAt: timestamp(value.acknowledgedAt, 'acknowledgedAt'),
    readinessLeaseId: uuid(value.readinessLeaseId, 'readinessLeaseId'),
    pointerEnvelopeHash: sha(value.pointerEnvelopeHash, 'pointerEnvelopeHash'),
    messageArtifactRef: relativeArtifact(value.messageArtifactRef, 'messageArtifactRef'),
    messageArtifactHash: sha(value.messageArtifactHash, 'messageArtifactHash'),
    transportReceiptHash: sha(value.transportReceiptHash, 'transportReceiptHash'),
    evidenceRefs: evidenceRefs(value.evidenceRefs),
  };
}

export function parseAdvisorIntakeEvidence(bytes: Uint8Array): IntakeEvidence {
  const value = jsonRecord(bytes, 'Advisor intake evidence');
  assertExactKeys(value, [
    'schemaVersion', 'missionId', 'requestId', 'messageId', 'notificationId', 'intakeId',
    'classification', 'recordedAt', 'acknowledgementArtifact', 'messageArtifactHash',
    'referencedWorkUnitIds', 'evidenceRefs',
  ], 'Advisor intake evidence');
  if (
    value.schemaVersion !== 'agent-office.advisor-intake-evidence.v1' ||
    value.missionId !== EXACT_DELIVERY_GOVERNED_MISSION ||
    !ADVISOR_INTAKE_CLASSIFICATIONS.includes(value.classification as AdvisorIntakeClassification)
  ) throw invalidEvidence('Advisor intake vocabulary is invalid');
  return {
    requestId: uuid(value.requestId, 'intake requestId'),
    messageId: uuid(value.messageId, 'intake messageId'),
    notificationId: uuid(value.notificationId, 'intake notificationId'),
    intakeId: uuid(value.intakeId, 'intakeId'),
    classification: value.classification as AdvisorIntakeClassification,
    recordedAt: timestamp(value.recordedAt, 'intake recordedAt'),
    acknowledgementArtifact: parseSourceArtifactRef(value.acknowledgementArtifact, 'acknowledgementArtifact'),
    messageArtifactHash: sha(value.messageArtifactHash, 'messageArtifactHash'),
    referencedWorkUnitIds: workUnitIds(value.referencedWorkUnitIds),
    evidenceRefs: evidenceRefs(value.evidenceRefs),
  };
}

export function parseAdvisorDecisionEvidence(bytes: Uint8Array): DecisionEvidence {
  const value = jsonRecord(bytes, 'Advisor decision evidence');
  assertExactKeys(value, [
    'schemaVersion', 'missionId', 'requestId', 'messageId', 'decisionId', 'decisionKind',
    'authorityRole', 'authoritySubjectId', 'scope', 'decidedAt', 'intakeArtifact',
    'governingLeoAuthorityArtifact', 'decisionAuthorityArtifact', 'decisionCode', 'evidenceRefs',
  ], 'Advisor decision evidence');
  assertRecord(value.scope, 'Advisor decision scope');
  assertExactKeys(value.scope, ['kind', 'workUnitIds'], 'Advisor decision scope');
  if (
    value.schemaVersion !== 'agent-office.advisor-decision-evidence.v1' ||
    value.missionId !== EXACT_DELIVERY_GOVERNED_MISSION || value.scope.kind !== 'WORK_UNIT_SET' ||
    (value.decisionKind !== 'ROUTINE_ROUTE' && value.decisionKind !== 'LEO_GPT_DECISION') ||
    (value.authorityRole !== 'Advisor' && value.authorityRole !== 'Leo/GPT')
  ) throw invalidEvidence('Advisor decision vocabulary is invalid');
  const authoritySubjectId = boundedSubject(value.authoritySubjectId, 'authoritySubjectId');
  const decisionCode = requireString(value.decisionCode, 'decisionCode', { maxLength: 128 });
  if (!/^[A-Z][A-Z0-9_]{0,127}$/u.test(decisionCode)) throw invalidEvidence('decisionCode is invalid');
  return {
    requestId: uuid(value.requestId, 'decision requestId'),
    messageId: uuid(value.messageId, 'decision messageId'),
    decisionId: uuid(value.decisionId, 'decisionId'),
    decisionKind: value.decisionKind,
    authorityRole: value.authorityRole,
    authoritySubjectId,
    workUnitIds: workUnitIds(value.scope.workUnitIds),
    decidedAt: timestamp(value.decidedAt, 'decidedAt'),
    intakeArtifact: parseSourceArtifactRef(value.intakeArtifact, 'intakeArtifact'),
    governingLeoAuthorityArtifact: parseSourceArtifactRef(
      value.governingLeoAuthorityArtifact,
      'governingLeoAuthorityArtifact',
    ),
    decisionAuthorityArtifact: parseSourceArtifactRef(
      value.decisionAuthorityArtifact,
      'decisionAuthorityArtifact',
    ),
    decisionCode,
    evidenceRefs: evidenceRefs(value.evidenceRefs),
  };
}

export function parseAdvisorResumeEvidence(bytes: Uint8Array): ResumeEvidence {
  const value = jsonRecord(bytes, 'Advisor resume evidence');
  assertExactKeys(value, [
    'schemaVersion', 'missionId', 'requestId', 'messageId', 'workUnitId',
    'decisionArtifact', 'intakeArtifact', 'recordedAt', 'resumeProof',
  ], 'Advisor resume evidence');
  if (
    value.schemaVersion !== 'agent-office.advisor-resume-evidence.v1' ||
    value.missionId !== EXACT_DELIVERY_GOVERNED_MISSION
  ) throw invalidEvidence('Advisor resume vocabulary is invalid');
  assertResumeProof(value.resumeProof);
  return {
    requestId: uuid(value.requestId, 'resume requestId'),
    messageId: uuid(value.messageId, 'resume messageId'),
    workUnitId: workUnit(value.workUnitId, 'resume workUnitId'),
    decisionArtifact: parseSourceArtifactRef(value.decisionArtifact, 'decisionArtifact'),
    intakeArtifact: parseSourceArtifactRef(value.intakeArtifact, 'intakeArtifact'),
    recordedAt: timestamp(value.recordedAt, 'resume recordedAt'),
    resumeProof: value.resumeProof,
  };
}

function assertExactDestination(value: unknown): void {
  assertRecord(value, 'Advisor evidence destination');
  assertExactKeys(value, [
    'sessionName', 'sessionId', 'windowId', 'windowIndex', 'paneIndex', 'paneId',
    'workspace', 'currentCommand',
  ], 'Advisor evidence destination');
  if (
    value.sessionName !== 'agent-office-advisor' || value.sessionId !== '$26' || value.windowId !== '@26' ||
    value.windowIndex !== 0 || value.paneIndex !== 0 || value.paneId !== '%26' ||
    value.workspace !== '/home/leo/Project/agent-office' || value.currentCommand !== 'codex'
  ) throw invalidEvidence('Advisor evidence destination is not the fixed pane');
}

function findWaitingEvent(
  events: readonly EventEnvelope[],
  workUnitId: string,
  waitingEventId: string,
): { readonly from: ResumeProof['previousState']; readonly to: 'BLOCKED' | 'WAITING_ADVISOR' | 'WAITING_LEO' | 'HOLD' } | undefined {
  const event = events.find((candidate) => candidate.eventId === waitingEventId);
  const latestWorkUnitEvent = [...events].reverse().find((candidate) =>
    candidate.eventType === 'WorkUnitStateTransitioned' &&
    typeof candidate.payload === 'object' && candidate.payload !== null &&
    !Array.isArray(candidate.payload) && candidate.payload.workUnitId === workUnitId);
  if (event?.eventType !== 'WorkUnitStateTransitioned' ||
    latestWorkUnitEvent?.eventId !== waitingEventId ||
    typeof event.payload !== 'object' || event.payload === null || Array.isArray(event.payload)) return undefined;
  const from = event.payload.from;
  const to = event.payload.to;
  if (
    event.payload.workUnitId !== workUnitId ||
    typeof from !== 'string' ||
    !['READY', 'DISPATCHED', 'RUNNING', 'TESTING', 'REVIEW_PENDING', 'NEEDS_PATCH'].includes(from) ||
    typeof to !== 'string' ||
    !['BLOCKED', 'WAITING_ADVISOR', 'WAITING_LEO', 'HOLD'].includes(to)
  ) return undefined;
  return { from: from as ResumeProof['previousState'], to: to as 'BLOCKED' | 'WAITING_ADVISOR' | 'WAITING_LEO' | 'HOLD' };
}

function ackPath(activation: ExactAdvisorDeliveryActivation, messageId: string): string {
  return evidencePath(activation, messageId, '01_ACKNOWLEDGEMENT.json');
}

function intakePath(activation: ExactAdvisorDeliveryActivation, messageId: string): string {
  return evidencePath(activation, messageId, '02_INTAKE.json');
}

function decisionPath(activation: ExactAdvisorDeliveryActivation, messageId: string): string {
  return evidencePath(activation, messageId, '03_DECISION.json');
}

function resumePath(
  activation: ExactAdvisorDeliveryActivation,
  messageId: string,
  workUnitId: string,
): string {
  workUnit(workUnitId, 'workUnitId');
  return evidencePath(activation, messageId, `04_RESUME_${workUnitId}.json`);
}

function evidencePath(
  activation: ExactAdvisorDeliveryActivation,
  messageId: string,
  filename: string,
): string {
  assertUuidV7(messageId, 'messageId');
  if (!/^[A-Z0-9][A-Z0-9_.-]{0,191}\.json$/u.test(filename)) {
    throw invalidEvidence('derived Advisor evidence filename is invalid');
  }
  return `${activation.advisorEvidencePrefix}/${messageId}/${filename}`;
}

function jsonRecord(bytes: Uint8Array, label: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw invalidEvidence(`${label} is not valid UTF-8 JSON`);
  }
  assertRecord(value, label);
  return value;
}

function uuid(value: unknown, label: string): string {
  const result = requireString(value, label, { maxLength: 36 });
  assertUuidV7(result, label);
  return result;
}

function timestamp(value: unknown, label: string): string {
  const result = requireString(value, label, { maxLength: 32 });
  assertUtcTimestamp(result, label);
  return result;
}

function sha(value: unknown, label: string): string {
  const result = requireString(value, label, { maxLength: 71 });
  if (!/^sha256:[0-9a-f]{64}$/u.test(result)) throw invalidEvidence(`${label} is invalid`);
  return result;
}

function evidenceRefs(value: unknown): readonly string[] {
  const values = requireArray(value, 'evidenceRefs').map((item) =>
    requireString(item, 'evidenceRef', { maxLength: 256 }));
  if (
    values.length > 32 ||
    values.some((item) => !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u.test(item))
  ) throw invalidEvidence('evidenceRefs are invalid');
  return values;
}

function workUnitIds(value: unknown): readonly string[] {
  const values = requireArray(value, 'workUnitIds').map((item) => workUnit(item, 'workUnitId'));
  if (values.length < 1 || values.length > 21 || new Set(values).size !== values.length) {
    throw invalidEvidence('workUnitIds are empty, duplicated, or unbounded');
  }
  return values;
}

function workUnit(value: unknown, label: string): string {
  const result = requireString(value, label, { maxLength: 128 });
  if (!/^AO-WU-[0-9]{2}$/u.test(result)) throw invalidEvidence(`${label} is invalid`);
  return result;
}

function boundedSubject(value: unknown, label: string): string {
  const result = requireString(value, label, { maxLength: 128 });
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(result)) throw invalidEvidence(`${label} is invalid`);
  return result;
}

function relativeArtifact(value: unknown, label: string): string {
  const result = requireString(value, label, { maxLength: 4096 });
  if (!result.startsWith('artifacts/inbox/') || result.includes('..') || result.includes('\\')) {
    throw invalidEvidence(`${label} is invalid`);
  }
  return result;
}

function canonicalIds(values: readonly string[]): readonly string[] {
  return [...values].sort();
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameRef(left: SourceArtifactRef, right: SourceArtifactRef): boolean {
  return left.repository === right.repository && left.commit === right.commit &&
    left.path === right.path && left.sha256 === right.sha256;
}

function timelineTime(message: AdvisorMessageProjection, state: string): number {
  const entry = message.timeline.find((candidate) => candidate.state === state);
  if (entry === undefined) throw invalidEvidence(`required ${state} timeline entry is absent`);
  return Date.parse(entry.recordedAt);
}

function requireMessage(projection: AdvisorInboxProjection, messageId: string): AdvisorMessageProjection {
  const message = projection.messages[messageId];
  if (message === undefined) throw invalidEvidence('Advisor evidence message is unknown');
  return message;
}

async function readCheckpoint(filePath: string): Promise<EvidenceCheckpointState> {
  let text: string;
  try {
    text = await readFile(filePath, 'utf8');
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) return EMPTY_CHECKPOINT;
    throw error;
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new DomainError('STORE_QUARANTINED', 'Advisor evidence checkpoint is invalid JSON');
  }
  if (
    typeof value !== 'object' || value === null || Array.isArray(value) ||
    !('schemaVersion' in value) || value.schemaVersion !== 'agent-office.advisor-evidence-ingress-checkpoint.v1' ||
    !('records' in value) || typeof value.records !== 'object' || value.records === null ||
    Array.isArray(value.records) || Object.keys(value.records).length > 256
  ) throw new DomainError('STORE_QUARANTINED', 'Advisor evidence checkpoint is invalid');
  const checkpointObject = value as Record<string, unknown>;
  if (
    Object.keys(checkpointObject).length !== 2 ||
    Object.keys(checkpointObject).some((key) => !['schemaVersion', 'records'].includes(key))
  ) throw new DomainError('STORE_QUARANTINED', 'Advisor evidence checkpoint shape is invalid');
  for (const [relativePath, raw] of Object.entries(value.records)) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new DomainError('STORE_QUARANTINED', 'Advisor evidence checkpoint record is invalid');
    }
    const record = raw as Record<string, unknown>;
    const expectedKeys = [
      'path', 'artifact', 'status', 'observedAt',
      ...(record.appliedAt === undefined ? [] : ['appliedAt']),
    ];
    if (
      Object.keys(record).length !== expectedKeys.length ||
      Object.keys(record).some((key) => !expectedKeys.includes(key))
    ) throw new DomainError('STORE_QUARANTINED', 'Advisor evidence checkpoint record shape is invalid');
    if (record.path !== relativePath || (record.status !== 'OBSERVED' && record.status !== 'APPLIED')) {
      throw new DomainError('STORE_QUARANTINED', 'Advisor evidence checkpoint identity is invalid');
    }
    const artifact = parseSourceArtifactRef(record.artifact, 'checkpoint artifact');
    const observedAt = timestamp(record.observedAt, 'checkpoint observedAt');
    const appliedAt = record.appliedAt === undefined
      ? undefined
      : timestamp(record.appliedAt, 'checkpoint appliedAt');
    if (
      artifact.path !== relativePath ||
      (record.status === 'APPLIED') !== (appliedAt !== undefined) ||
      (appliedAt !== undefined && Date.parse(appliedAt) < Date.parse(observedAt))
    ) throw new DomainError('STORE_QUARANTINED', 'Advisor evidence checkpoint invariant is invalid');
  }
  return value as unknown as EvidenceCheckpointState;
}

function invalidEvidence(message: string): DomainError {
  return new DomainError('AUTHORITY_ARTIFACT_INVALID', message);
}
