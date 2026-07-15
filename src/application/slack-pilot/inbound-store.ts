// AS1 Multi-Team Slack Pilot — profile-local receipt, dedupe, receive-grant binding, and question state.
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_DESIGN.md §7 (durable state layout),
// §8 (envelope contract + ACK order), §8.3 (dedupe), §10 (root/thread correlation), §12.2 (atomic
// receive-grant state + root binding); docs/security/AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md
// §8.2 (receive binding + consumption), §10 (replay/correlation), §14 (state isolation).
//
// The serialized root/question transition is the SOLE receive-expiry decision point: at one linearization
// point the trusted local clock supplies boundAt/consumedAt and the business transition commits only when
// that value is strictly earlier than the grant's exclusive expiresAt. Receipt time, Slack event time,
// parse time, and dedupe-write time never freeze eligibility. Every mutable index is exact-key, versioned,
// hash-chained, bounded, and atomically replaced. State is physically per profile; a cross-profile
// reference is a global-latch contradiction, never a fallback.
import path from 'node:path';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';

import { DomainError } from '../../contracts/types.js';
import { writeAtomicCanonicalJson } from '../../persistence/file-store/atomic-file.js';
import { GENESIS_EVENT_HASH, hashCanonical, isSha256 } from '../../persistence/file-store/hashing.js';
import { ensurePrivateDirectory, isNodeError, resolveContainedPath } from '../../persistence/file-store/path-safety.js';
import { ImmutableArtifactStore, type ImmutableArtifactReceipt } from '../../persistence/file-store/artifact-store.js';
import type { AgentOfficeRuntimeIdentity } from '../../runtime/identity.js';
import {
  LIMITS,
  requireArtifactRef,
  requireGitCommit,
  requireOpaqueId,
  requireSha256,
  requireSlackTs,
  requireUtc,
} from './contracts.js';
import type { As1PilotReceiveGrantV1 } from './contracts.js';
import { assertExactKeys, assertRecord, requireEnum, requireInteger } from '../../contracts/validation.js';
import { assertAs1ProfileId, type As1Profile, type As1ProfileId } from './profiles.js';

const ARTIFACT_KIND = 'as1-slack-pilot';

// ── Receive-grant state chain (design §12.2) ─────────────────────────────────
export const AS1_RECEIVE_PHASES = [
  'UNBOUND',
  'ROOT_BOUND',
  'EXPIRED_UNBOUND',
  'EXPIRED_BOUND',
  'RETIRED_UNBOUND',
  'RETIRED_BOUND',
  'LATCHED',
] as const;
export type As1ReceivePhase = (typeof AS1_RECEIVE_PHASES)[number];

export interface As1PilotReceiveGrantStateV1 {
  readonly schemaVersion: 'agent-office.as1-pilot-receive-grant-state.v1';
  readonly receiveGrantId: string;
  readonly pilotId: string;
  readonly profileId: string;
  readonly phase: As1ReceivePhase;
  readonly rootLimit: 1;
  readonly rootSlotConsumed: boolean;
  readonly boundSourceEventId: string | null;
  readonly boundRootTs: string | null;
  readonly boundRootKeyHash: string | null;
  readonly boundReceiptArtifactRef: string | null;
  readonly boundReceiptArtifactHash: string | null;
  readonly boundMessageArtifactHash: string | null;
  readonly boundAt: string | null;
  readonly previousStateHash: string;
  readonly stateHash: string;
  readonly version: number;
}

export interface ObservedRootFacts {
  readonly sourceEventId: string;
  readonly rootTs: string;
  readonly rootKeyHash: string;
  readonly receiptArtifactRef: string;
  readonly receiptArtifactHash: string;
  readonly messageArtifactHash: string;
}

export type BindOutcome =
  | 'ROOT_BOUND'
  | 'REJECTED_ROOT_SLOT_CONSUMED'
  | 'REJECTED_RECEIVE_GRANT_EXPIRED'
  | 'REJECTED_GRANT_UNAVAILABLE';

export interface BindResult {
  readonly outcome: BindOutcome;
  readonly state: As1PilotReceiveGrantStateV1;
}

// ── Dedupe record (design §8.3) ──────────────────────────────────────────────
export interface As1DedupeRecordV1 {
  readonly schemaVersion: 'agent-office.as1-inbound-dedupe.v1';
  readonly profileId: string;
  readonly envelopeId: string;
  readonly teamId: string;
  readonly apiAppId: string;
  readonly eventId: string;
  readonly rawEnvelopeHash: string;
  readonly innerEventHash: string;
  readonly firstReceivedAt: string;
  readonly lastReceivedAt: string;
  readonly preAckClass: string;
  readonly receiveGrantStateHash: string | null;
  readonly intakeId: string | null;
  readonly terminalReason: string | null;
}

export interface DedupeInput {
  readonly envelopeId: string;
  readonly teamId: string;
  readonly apiAppId: string;
  readonly eventId: string;
  readonly rawEnvelopeHash: string;
  readonly innerEventHash: string;
  readonly preAckClass: string;
}

export type DedupeOutcome = 'inserted' | 'duplicate';

// ── Question, root-correlation, transport journal, and audit records (design §8.2, §10) ──────────────
export interface As1PendingQuestionV1 {
  readonly schemaVersion: 'agent-office.as1-pending-question.v1';
  readonly questionId: string;
  readonly rootTs: string;
  readonly expectedResponseKind: 'CLARIFICATION' | 'DECISION_RESPONSE';
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly state: 'OPEN' | 'CONSUMED';
  readonly openedAt: string;
  readonly expiresAt: string;
  readonly consumedAt: string | null;
  readonly consumedBySourceEventId: string | null;
}

export interface As1RootCorrelationV1 {
  readonly schemaVersion: 'agent-office.as1-root-correlation.v1';
  readonly rootTs: string;
  readonly rootKeyHash: string;
  readonly sourceEventId: string;
  readonly receiveGrantId: string;
  readonly bindingStateHash: string;
  readonly intakeId: string;
  readonly createdAt: string;
}

/**
 * One canonical consumed-question-reply fact for a root/intake (design §13.3): a CONSUMED pending question
 * joined to its EXACT MATERIALIZED continuation transport record. The RESULT evidence binds the count and the
 * canonical hash of the sorted set of these; a consumed question with no matching materialized reply fails closed.
 */
export interface As1ConsumedQuestionReplyV1 {
  readonly questionId: string;
  readonly expectedResponseKind: 'CLARIFICATION' | 'DECISION_RESPONSE';
  readonly consumedBySourceEventId: string;
  readonly continuationKind: 'CLARIFICATION' | 'DECISION_RESPONSE';
  readonly continuationIntakeId: string;
}

/** One durable outbox phase record with its bound immutable request/response artifact hashes (design §14). */
export interface As1OutboxRecordV1 {
  readonly outboundId: string;
  readonly phase: As1OutboxRecordPhase;
  readonly requestHash: string | null;
  readonly responseHash: string | null;
  readonly recordedAt: string;
}

export interface As1OutboxHashes {
  readonly requestHash?: string;
  readonly responseHash?: string;
}

/** One durable denial-audit record (design §9): a bounded reason and the optional source event/envelope. */
export interface As1DenialAuditV1 {
  readonly schemaVersion: 'agent-office.as1-denial-audit.v1';
  readonly reason: string;
  readonly eventId: string | null;
  readonly envelopeId: string | null;
  readonly recordedAt: string;
}

/**
 * The durable checkpoint of one accepted Advisor evidence artifact (design §13). Each record fixes the full
 * canonical envelope identity (repository/path/commit/blob/hash) AND the per-kind canonical correlation facts
 * a later stage must bind to — e.g. an ACK's advisorAckId, an INTAKE's bound advisorAckId, a QUESTION's
 * bound intake/pending-question/expected-response, a RESULT's bound intake/consumed-questions/artifact hash.
 * The correlation map is byte-derived from the reviewed envelope, so an equal envelopeHash implies an equal
 * correlation; cross-stage checks read these persisted facts rather than re-deriving from a live envelope.
 */
export interface As1AcceptedEvidenceRecordV1 {
  readonly evidenceKind: string;
  readonly evidenceId: string;
  readonly intakeId: string;
  readonly blobSha256: string;
  readonly sourceCommit: string;
  readonly repositoryId: string;
  readonly path: string;
  readonly envelopeHash: string;
  readonly correlation: Readonly<Record<string, string>>;
  readonly sequence: number;
  readonly acceptedAt: string;
}

// The single durable, hash-bound transport state machine (design §8.2/§8.3/§12.3/§15.1). Every inbound
// event advances through exactly this closed chain; illegal transitions are rejected, never overwritten.
export const AS1_TRANSPORT_STATES = [
  'PREACK_PENDING',
  'PREACK_ROOT_BOUND',
  'PREACK_CONTINUATION_CONSUMED',
  'PREACK_REJECTED',
  'TRANSPORT_ACK_RECORDED',
  'MATERIALIZED',
  'TERMINAL_NO_INTAKE',
] as const;
export type As1TransportState = (typeof AS1_TRANSPORT_STATES)[number];

export type As1PreAckDecision = 'ROOT_BOUND' | 'CONTINUATION_CONSUMED' | 'REJECTED';

/** Closed legal-transition table. A target absent from a source's list is an INVALID_TRANSITION. */
const AS1_LEGAL_TRANSPORT_TRANSITIONS: Readonly<Record<As1TransportState, readonly As1TransportState[]>> = {
  PREACK_PENDING: ['PREACK_ROOT_BOUND', 'PREACK_CONTINUATION_CONSUMED', 'PREACK_REJECTED'],
  PREACK_ROOT_BOUND: ['TRANSPORT_ACK_RECORDED'],
  PREACK_CONTINUATION_CONSUMED: ['TRANSPORT_ACK_RECORDED'],
  PREACK_REJECTED: ['TRANSPORT_ACK_RECORDED'],
  TRANSPORT_ACK_RECORDED: ['MATERIALIZED', 'TERMINAL_NO_INTAKE'],
  MATERIALIZED: [],
  TERMINAL_NO_INTAKE: [],
};

/** Observed facts durably bound at open time so recovery can re-linearize/materialize with no live envelope. */
export interface As1TransportObserved {
  readonly candidateKind: 'ROOT' | 'CONTINUATION';
  readonly sourceEventId: string;
  readonly rootTs: string;
  readonly rootKeyHash: string;
  readonly receiptArtifactRef: string;
  readonly receiptArtifactHash: string;
  readonly messageArtifactRef: string;
  readonly messageArtifactHash: string;
}

export interface As1TransportContinuationBinding {
  readonly kind: 'CLARIFICATION' | 'DECISION_RESPONSE';
  readonly originalIntakeId: string;
  readonly questionId: string;
}

export interface As1TransportRecordV1 {
  readonly schemaVersion: 'agent-office.as1-transport-record.v1';
  readonly eventId: string;
  readonly envelopeId: string;
  readonly state: As1TransportState;
  readonly rawEnvelopeHash: string;
  readonly innerEventHash: string;
  readonly observed: As1TransportObserved;
  readonly preAckDecision: As1PreAckDecision | null;
  readonly terminalReason: string | null;
  readonly bindingStateHash: string | null;
  readonly continuation: As1TransportContinuationBinding | null;
  readonly transportAckRecorded: boolean;
  readonly intakeId: string | null;
  readonly pointerArtifactRef: string | null;
  readonly recordedAt: string;
  readonly ackedAt: string | null;
  readonly materializedAt: string | null;
}

export interface CommitPreAckInput {
  readonly decision: As1PreAckDecision;
  readonly terminalReason: string | null;
  readonly bindingStateHash: string | null;
  readonly continuation: As1TransportContinuationBinding | null;
}

/** One atomic record proving both the delivery grant and its lease were consumed together (design §12.5). */
export interface As1DeliveryAuthorityConsumptionV1 {
  readonly schemaVersion: 'agent-office.as1-delivery-authority-consumption.v1';
  readonly pointerDeliveryGrantId: string;
  readonly leaseId: string;
  readonly consumedAt: string;
}

/**
 * Invariant identity/authority facts bound to a tmux delivery journal at PREPARED and preserved across it
 * (design §12.6/§12.7). Full lineage — pilot/profile/team/actor/role, grant/lease ids, pointer/source/intake,
 * destination fingerprint, and every governance/registry/global-control/profile-latch/grant snapshot hash —
 * so a recovered record can always distinguish its exact authority lineage.
 */
export interface As1TmuxDeliveryFacts {
  readonly receiveGrantId: string;
  readonly receiveGrantBindingHash: string;
  readonly pointerDeliveryGrantId: string;
  readonly leaseId: string;
  readonly pilotId: string;
  readonly profileId: string;
  readonly advisorTeam: string;
  readonly actorId: string;
  readonly roleInstanceId: string;
  readonly intakeId: string;
  readonly sourceEventId: string;
  readonly pointerHash: string;
  readonly destinationHash: string;
  readonly governanceSnapshotHash: string;
  readonly registrySnapshotHash: string;
  readonly globalControlSnapshotHash: string;
  readonly profileLatchSnapshotHash: string;
  readonly pointerDeliveryGrantSnapshotHash: string;
}

export interface As1TmuxDeliveryRecordV1 {
  readonly schemaVersion: 'agent-office.as1-tmux-delivery.v1';
  readonly deliveryId: string;
  readonly phase: As1TmuxDeliveryPhase;
  readonly boundFacts: As1TmuxDeliveryFacts;
  readonly recordedAt: string;
}

export type ConsumeQuestionOutcome = 'CONSUMED' | 'REJECTED_RECEIVE_GRANT_EXPIRED' | 'REJECTED_NO_OPEN_QUESTION';

export interface ConsumeQuestionResult {
  readonly outcome: ConsumeQuestionOutcome;
  readonly question: As1PendingQuestionV1 | null;
}

// ── Strict on-read record parsers (review B08) ───────────────────────────────────────────────────────────────
// Persisted per-profile state is NEVER blind-cast. Every durable index is validated on read against its EXACT
// keys, field types, hashes, enums, and phases; a corrupted/tampered/legacy record fails closed (the readers
// wrap any failure as STORE_QUARANTINED) instead of being trusted downstream.
function reqNullableOpaqueId(value: unknown, label: string): string | null {
  return value === null ? null : requireOpaqueId(value, label);
}
function reqNullableSha256(value: unknown, label: string): string | null {
  return value === null ? null : requireSha256(value, label);
}
function reqNullableUtc(value: unknown, label: string): string | null {
  return value === null ? null : requireUtc(value, label);
}
function reqNullableArtifactRef(value: unknown, label: string): string | null {
  return value === null ? null : requireArtifactRef(value, label);
}
function reqNullableSlackTs(value: unknown, label: string): string | null {
  return value === null ? null : requireSlackTs(value, label);
}
function reqSchema<T extends string>(value: unknown, expected: T, label: string): T {
  if (value !== expected) throw new DomainError('STORE_QUARANTINED', `${label} schemaVersion is not ${expected}`);
  return expected;
}
function reqBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new DomainError('STORE_QUARANTINED', `${label} must be a boolean`);
  return value;
}
function reqRootLimit(value: unknown, label: string): 1 {
  if (requireInteger(value, label, 1) !== 1) throw new DomainError('STORE_QUARANTINED', `${label} must be 1`);
  return 1;
}
/** A bounded opaque byte string (correlation facts are byte-derived from an already-validated envelope). */
function reqBoundedString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || Buffer.byteLength(value, 'utf8') > LIMITS.ARTIFACT_REF_MAX_BYTES) {
    throw new DomainError('STORE_QUARANTINED', `${label} is not a bounded string`);
  }
  return value;
}
/** Presence-only passthrough for a LEGACY consumption index (read bounded; any record fails closed upstream). */
function passthroughRecord(value: unknown): unknown {
  return value;
}

// ── Closed tmux delivery-journal phase vocabulary + legal transitions (design §12.7, review B08) ──────────────
export const AS1_TMUX_DELIVERY_PHASES = [
  'PREPARED',
  'BUFFER_LOADED',
  'PASTE_STARTED',
  'PASTE_CONFIRMED',
  'SUBMIT_STARTED',
  'TRANSPORT_RECORDED',
  'MANUAL_RECONCILIATION_REQUIRED',
] as const;
export type As1TmuxDeliveryPhase = (typeof AS1_TMUX_DELIVERY_PHASES)[number];

const AS1_TMUX_DELIVERY_PHASE_SET: ReadonlySet<string> = new Set<string>(AS1_TMUX_DELIVERY_PHASES);
function isTmuxDeliveryPhase(value: string): value is As1TmuxDeliveryPhase {
  return AS1_TMUX_DELIVERY_PHASE_SET.has(value);
}

/** The only legal tmux phase edges: strict linear progress, or MANUAL_RECONCILIATION from any nonterminal. */
const AS1_LEGAL_TMUX_TRANSITIONS: Readonly<Record<As1TmuxDeliveryPhase, readonly As1TmuxDeliveryPhase[]>> = {
  PREPARED: ['BUFFER_LOADED', 'MANUAL_RECONCILIATION_REQUIRED'],
  BUFFER_LOADED: ['PASTE_STARTED', 'MANUAL_RECONCILIATION_REQUIRED'],
  PASTE_STARTED: ['PASTE_CONFIRMED', 'MANUAL_RECONCILIATION_REQUIRED'],
  PASTE_CONFIRMED: ['SUBMIT_STARTED', 'MANUAL_RECONCILIATION_REQUIRED'],
  SUBMIT_STARTED: ['TRANSPORT_RECORDED', 'MANUAL_RECONCILIATION_REQUIRED'],
  TRANSPORT_RECORDED: [],
  MANUAL_RECONCILIATION_REQUIRED: [],
};

// ── Closed outbox phase vocabulary + legal transitions + phase/hash invariant (design §14, review B08) ────────
export const AS1_OUTBOX_PHASES = ['PREPARED', 'REQUEST_STARTED', 'RESPONSE_RECORDED', 'MANUAL_RECONCILIATION_REQUIRED'] as const;
export type As1OutboxRecordPhase = (typeof AS1_OUTBOX_PHASES)[number];

const AS1_LEGAL_OUTBOX_TRANSITIONS: Readonly<Record<As1OutboxRecordPhase, readonly As1OutboxRecordPhase[]>> = {
  PREPARED: ['PREPARED', 'REQUEST_STARTED', 'MANUAL_RECONCILIATION_REQUIRED'],
  REQUEST_STARTED: ['RESPONSE_RECORDED', 'MANUAL_RECONCILIATION_REQUIRED'],
  RESPONSE_RECORDED: [],
  MANUAL_RECONCILIATION_REQUIRED: [],
};

const AS1_OUTBOX_PHASE_SET: ReadonlySet<string> = new Set<string>(AS1_OUTBOX_PHASES);
function isOutboxPhase(value: string): value is As1OutboxRecordPhase {
  return AS1_OUTBOX_PHASE_SET.has(value);
}

/**
 * The phase↔hash invariant a durable outbox record must satisfy (design §14): the request bytes hash is bound
 * from PREPARED onward and never dropped; the response hash appears only at RESPONSE_RECORDED. Any violation is
 * corruption, never a trusted record.
 */
function assertOutboxPhaseHashInvariant(phase: As1OutboxRecordPhase, requestHash: string | null, responseHash: string | null): void {
  if (phase === 'RESPONSE_RECORDED') {
    if (requestHash === null || responseHash === null) throw new DomainError('STORE_QUARANTINED', 'RESPONSE_RECORDED requires both request and response hashes');
    return;
  }
  // PREPARED, REQUEST_STARTED, MANUAL_RECONCILIATION_REQUIRED: request bound, no response yet.
  if (requestHash === null) throw new DomainError('STORE_QUARANTINED', `${phase} requires the bound request hash`);
  if (responseHash !== null) throw new DomainError('STORE_QUARANTINED', `${phase} must not carry a response hash`);
}

/** A profile-tagged durable record whose profile MUST equal the store's closed profile, not merely be valid. */
function requireOwningProfileId(value: unknown, profile: As1Profile, label: string): As1ProfileId {
  const profileId = assertAs1ProfileId(value, label);
  if (profileId !== profile.profileId) {
    throw new DomainError('STORE_QUARANTINED', `${label} is a foreign profile in a profile-local tree`);
  }
  return profileId;
}

// ── Relational durable-state invariants (review B08) ─────────────────────────
// A strict per-field parse still accepts records whose individual fields are well-typed but whose combination
// is a semantically impossible durable state (e.g. a ROOT_BOUND receive state with no bound root, or a
// MATERIALIZED transport record with no intake). These helpers reject such records so a tampered/corrupt index
// is never trusted after restart. Each mirrors the exact writer that produces the record.

/** Receive-grant state: bound fields move together and agree with phase and rootSlotConsumed. */
function assertReceiveGrantStateInvariant(state: As1PilotReceiveGrantStateV1): void {
  const boundFields = [
    state.boundSourceEventId,
    state.boundRootTs,
    state.boundRootKeyHash,
    state.boundReceiptArtifactRef,
    state.boundReceiptArtifactHash,
    state.boundMessageArtifactHash,
    state.boundAt,
  ];
  const allNull = boundFields.every((field) => field === null);
  const allSet = boundFields.every((field) => field !== null);
  if (!allNull && !allSet) {
    throw new DomainError('STORE_QUARANTINED', 'receive-grant state has a partial root binding');
  }
  if (state.rootSlotConsumed !== allSet) {
    throw new DomainError('STORE_QUARANTINED', 'receive-grant rootSlotConsumed disagrees with the bound fields');
  }
  const unboundPhases: readonly As1ReceivePhase[] = ['UNBOUND', 'EXPIRED_UNBOUND', 'RETIRED_UNBOUND'];
  const boundPhases: readonly As1ReceivePhase[] = ['ROOT_BOUND', 'EXPIRED_BOUND', 'RETIRED_BOUND'];
  if (unboundPhases.includes(state.phase) && !allNull) {
    throw new DomainError('STORE_QUARANTINED', `receive-grant phase ${state.phase} must carry no root binding`);
  }
  if (boundPhases.includes(state.phase) && !allSet) {
    throw new DomainError('STORE_QUARANTINED', `receive-grant phase ${state.phase} must carry a complete root binding`);
  }
}

/** Pending question: OPEN has no consumption fields; CONSUMED has both. */
function assertPendingQuestionInvariant(question: As1PendingQuestionV1): void {
  if (question.state === 'OPEN') {
    if (question.consumedAt !== null || question.consumedBySourceEventId !== null) {
      throw new DomainError('STORE_QUARANTINED', 'OPEN pending question must not carry consumption fields');
    }
    return;
  }
  if (question.consumedAt === null || question.consumedBySourceEventId === null) {
    throw new DomainError('STORE_QUARANTINED', 'CONSUMED pending question must carry both consumption fields');
  }
}

/** Transport record: the closed state correlates with the pre-ACK decision, ACK flag/timestamp, continuation,
 * terminal reason, and intake/pointer/materialization fields (design §8.2/§8.3; matches the transition writers). */
function assertTransportRecordInvariant(record: As1TransportRecordV1): void {
  if (record.transportAckRecorded !== (record.ackedAt !== null)) {
    throw new DomainError('STORE_QUARANTINED', 'transport ACK flag and ackedAt disagree');
  }
  const acked = record.state === 'TRANSPORT_ACK_RECORDED' || record.state === 'MATERIALIZED' || record.state === 'TERMINAL_NO_INTAKE';
  if (record.transportAckRecorded !== acked) {
    throw new DomainError('STORE_QUARANTINED', `transport state ${record.state} disagrees with the ACK flag`);
  }
  if (record.state === 'PREACK_PENDING' && record.preAckDecision !== null) {
    throw new DomainError('STORE_QUARANTINED', 'PREACK_PENDING must carry no pre-ACK decision');
  }
  const requiredDecisionByState: Partial<Record<As1TransportState, As1PreAckDecision>> = {
    PREACK_ROOT_BOUND: 'ROOT_BOUND',
    PREACK_CONTINUATION_CONSUMED: 'CONTINUATION_CONSUMED',
    PREACK_REJECTED: 'REJECTED',
  };
  const requiredDecision = requiredDecisionByState[record.state];
  if (requiredDecision !== undefined && record.preAckDecision !== requiredDecision) {
    throw new DomainError('STORE_QUARANTINED', `transport state ${record.state} disagrees with its pre-ACK decision`);
  }
  if (acked && record.preAckDecision === null) {
    throw new DomainError('STORE_QUARANTINED', `transport state ${record.state} requires a committed pre-ACK decision`);
  }
  if ((record.preAckDecision === 'CONTINUATION_CONSUMED') !== (record.continuation !== null)) {
    throw new DomainError('STORE_QUARANTINED', 'transport continuation binding disagrees with the pre-ACK decision');
  }
  if (record.preAckDecision === 'REJECTED') {
    if (record.terminalReason === null) {
      throw new DomainError('STORE_QUARANTINED', 'a rejected transport decision requires a terminalReason');
    }
  } else if (record.terminalReason !== null) {
    throw new DomainError('STORE_QUARANTINED', 'only a rejected transport decision may carry a terminalReason');
  }
  const hasMaterialization = record.intakeId !== null || record.pointerArtifactRef !== null || record.materializedAt !== null;
  if (record.state === 'MATERIALIZED') {
    if (record.intakeId === null || record.pointerArtifactRef === null || record.materializedAt === null) {
      throw new DomainError('STORE_QUARANTINED', 'MATERIALIZED transport record must carry intake, pointer, and materializedAt');
    }
    if (record.preAckDecision === 'REJECTED') {
      throw new DomainError('STORE_QUARANTINED', 'a rejected decision cannot be MATERIALIZED');
    }
  } else if (hasMaterialization) {
    throw new DomainError('STORE_QUARANTINED', `transport state ${record.state} must not carry materialization fields`);
  }
  if (record.state === 'TERMINAL_NO_INTAKE' && record.preAckDecision !== 'REJECTED') {
    throw new DomainError('STORE_QUARANTINED', 'TERMINAL_NO_INTAKE requires a rejected pre-ACK decision');
  }
}

function parseDedupeRecord(profile: As1Profile): (value: unknown) => As1DedupeRecordV1 {
  return (value: unknown): As1DedupeRecordV1 => {
  assertRecord(value, 'as1 dedupe record');
  assertExactKeys(
    value,
    ['schemaVersion', 'profileId', 'envelopeId', 'teamId', 'apiAppId', 'eventId', 'rawEnvelopeHash', 'innerEventHash', 'firstReceivedAt', 'lastReceivedAt', 'preAckClass', 'receiveGrantStateHash', 'intakeId', 'terminalReason'],
    'as1 dedupe record',
  );
  return {
    schemaVersion: reqSchema(value.schemaVersion, 'agent-office.as1-inbound-dedupe.v1', 'as1 dedupe record'),
    profileId: requireOwningProfileId(value.profileId, profile, 'dedupe.profileId'),
    envelopeId: requireOpaqueId(value.envelopeId, 'dedupe.envelopeId'),
    teamId: requireOpaqueId(value.teamId, 'dedupe.teamId'),
    apiAppId: requireOpaqueId(value.apiAppId, 'dedupe.apiAppId'),
    eventId: requireOpaqueId(value.eventId, 'dedupe.eventId'),
    rawEnvelopeHash: requireSha256(value.rawEnvelopeHash, 'dedupe.rawEnvelopeHash'),
    innerEventHash: requireSha256(value.innerEventHash, 'dedupe.innerEventHash'),
    firstReceivedAt: requireUtc(value.firstReceivedAt, 'dedupe.firstReceivedAt'),
    lastReceivedAt: requireUtc(value.lastReceivedAt, 'dedupe.lastReceivedAt'),
    // preAckClass is a closed durable transport phase, not an arbitrary opaque id (review B08).
    preAckClass: requireEnum(value.preAckClass, AS1_TRANSPORT_STATES, 'dedupe.preAckClass'),
    receiveGrantStateHash: reqNullableSha256(value.receiveGrantStateHash, 'dedupe.receiveGrantStateHash'),
    intakeId: reqNullableOpaqueId(value.intakeId, 'dedupe.intakeId'),
    terminalReason: reqNullableOpaqueId(value.terminalReason, 'dedupe.terminalReason'),
  };
  };
}

function parseReceiveGrantState(value: unknown): As1PilotReceiveGrantStateV1 {
  assertRecord(value, 'as1 receive-grant state');
  assertExactKeys(
    value,
    ['schemaVersion', 'receiveGrantId', 'pilotId', 'profileId', 'phase', 'rootLimit', 'rootSlotConsumed', 'boundSourceEventId', 'boundRootTs', 'boundRootKeyHash', 'boundReceiptArtifactRef', 'boundReceiptArtifactHash', 'boundMessageArtifactHash', 'boundAt', 'previousStateHash', 'stateHash', 'version'],
    'as1 receive-grant state',
  );
  const state: As1PilotReceiveGrantStateV1 = {
    schemaVersion: reqSchema(value.schemaVersion, 'agent-office.as1-pilot-receive-grant-state.v1', 'as1 receive-grant state'),
    receiveGrantId: requireOpaqueId(value.receiveGrantId, 'state.receiveGrantId'),
    pilotId: requireOpaqueId(value.pilotId, 'state.pilotId'),
    profileId: assertAs1ProfileId(value.profileId, 'state.profileId'),
    phase: requireEnum(value.phase, AS1_RECEIVE_PHASES, 'state.phase'),
    rootLimit: reqRootLimit(value.rootLimit, 'state.rootLimit'),
    rootSlotConsumed: reqBoolean(value.rootSlotConsumed, 'state.rootSlotConsumed'),
    boundSourceEventId: reqNullableOpaqueId(value.boundSourceEventId, 'state.boundSourceEventId'),
    boundRootTs: reqNullableSlackTs(value.boundRootTs, 'state.boundRootTs'),
    boundRootKeyHash: reqNullableSha256(value.boundRootKeyHash, 'state.boundRootKeyHash'),
    boundReceiptArtifactRef: reqNullableArtifactRef(value.boundReceiptArtifactRef, 'state.boundReceiptArtifactRef'),
    boundReceiptArtifactHash: reqNullableSha256(value.boundReceiptArtifactHash, 'state.boundReceiptArtifactHash'),
    boundMessageArtifactHash: reqNullableSha256(value.boundMessageArtifactHash, 'state.boundMessageArtifactHash'),
    boundAt: reqNullableUtc(value.boundAt, 'state.boundAt'),
    previousStateHash: requireSha256(value.previousStateHash, 'state.previousStateHash'),
    stateHash: requireSha256(value.stateHash, 'state.stateHash'),
    version: requireInteger(value.version, 'state.version', 0),
  };
  assertReceiveGrantStateInvariant(state);
  return state;
}

function parsePendingQuestion(value: unknown): As1PendingQuestionV1 {
  assertRecord(value, 'as1 pending question');
  assertExactKeys(
    value,
    ['schemaVersion', 'questionId', 'rootTs', 'expectedResponseKind', 'evidenceRef', 'evidenceHash', 'state', 'openedAt', 'expiresAt', 'consumedAt', 'consumedBySourceEventId'],
    'as1 pending question',
  );
  const question: As1PendingQuestionV1 = {
    schemaVersion: reqSchema(value.schemaVersion, 'agent-office.as1-pending-question.v1', 'as1 pending question'),
    questionId: requireOpaqueId(value.questionId, 'question.questionId'),
    rootTs: requireSlackTs(value.rootTs, 'question.rootTs'),
    expectedResponseKind: requireEnum(value.expectedResponseKind, ['CLARIFICATION', 'DECISION_RESPONSE'] as const, 'question.expectedResponseKind'),
    evidenceRef: requireArtifactRef(value.evidenceRef, 'question.evidenceRef'),
    evidenceHash: requireSha256(value.evidenceHash, 'question.evidenceHash'),
    state: requireEnum(value.state, ['OPEN', 'CONSUMED'] as const, 'question.state'),
    openedAt: requireUtc(value.openedAt, 'question.openedAt'),
    expiresAt: requireUtc(value.expiresAt, 'question.expiresAt'),
    consumedAt: reqNullableUtc(value.consumedAt, 'question.consumedAt'),
    consumedBySourceEventId: reqNullableOpaqueId(value.consumedBySourceEventId, 'question.consumedBySourceEventId'),
  };
  assertPendingQuestionInvariant(question);
  return question;
}

function parseRootCorrelation(value: unknown): As1RootCorrelationV1 {
  assertRecord(value, 'as1 root correlation');
  assertExactKeys(value, ['schemaVersion', 'rootTs', 'rootKeyHash', 'sourceEventId', 'receiveGrantId', 'bindingStateHash', 'intakeId', 'createdAt'], 'as1 root correlation');
  return {
    schemaVersion: reqSchema(value.schemaVersion, 'agent-office.as1-root-correlation.v1', 'as1 root correlation'),
    rootTs: requireSlackTs(value.rootTs, 'root.rootTs'),
    rootKeyHash: requireSha256(value.rootKeyHash, 'root.rootKeyHash'),
    sourceEventId: requireOpaqueId(value.sourceEventId, 'root.sourceEventId'),
    receiveGrantId: requireOpaqueId(value.receiveGrantId, 'root.receiveGrantId'),
    bindingStateHash: requireSha256(value.bindingStateHash, 'root.bindingStateHash'),
    intakeId: requireOpaqueId(value.intakeId, 'root.intakeId'),
    createdAt: requireUtc(value.createdAt, 'root.createdAt'),
  };
}

function parseTransportObserved(value: unknown): As1TransportObserved {
  assertRecord(value, 'as1 transport observed');
  assertExactKeys(value, ['candidateKind', 'sourceEventId', 'rootTs', 'rootKeyHash', 'receiptArtifactRef', 'receiptArtifactHash', 'messageArtifactRef', 'messageArtifactHash'], 'as1 transport observed');
  return {
    candidateKind: requireEnum(value.candidateKind, ['ROOT', 'CONTINUATION'] as const, 'observed.candidateKind'),
    sourceEventId: requireOpaqueId(value.sourceEventId, 'observed.sourceEventId'),
    rootTs: requireSlackTs(value.rootTs, 'observed.rootTs'),
    rootKeyHash: requireSha256(value.rootKeyHash, 'observed.rootKeyHash'),
    receiptArtifactRef: requireArtifactRef(value.receiptArtifactRef, 'observed.receiptArtifactRef'),
    receiptArtifactHash: requireSha256(value.receiptArtifactHash, 'observed.receiptArtifactHash'),
    messageArtifactRef: requireArtifactRef(value.messageArtifactRef, 'observed.messageArtifactRef'),
    messageArtifactHash: requireSha256(value.messageArtifactHash, 'observed.messageArtifactHash'),
  };
}

function parseContinuationBinding(value: unknown): As1TransportContinuationBinding {
  assertRecord(value, 'as1 continuation binding');
  assertExactKeys(value, ['kind', 'originalIntakeId', 'questionId'], 'as1 continuation binding');
  return {
    kind: requireEnum(value.kind, ['CLARIFICATION', 'DECISION_RESPONSE'] as const, 'continuation.kind'),
    originalIntakeId: requireOpaqueId(value.originalIntakeId, 'continuation.originalIntakeId'),
    questionId: requireOpaqueId(value.questionId, 'continuation.questionId'),
  };
}

function parseTransportRecord(value: unknown): As1TransportRecordV1 {
  assertRecord(value, 'as1 transport record');
  assertExactKeys(
    value,
    ['schemaVersion', 'eventId', 'envelopeId', 'state', 'rawEnvelopeHash', 'innerEventHash', 'observed', 'preAckDecision', 'terminalReason', 'bindingStateHash', 'continuation', 'transportAckRecorded', 'intakeId', 'pointerArtifactRef', 'recordedAt', 'ackedAt', 'materializedAt'],
    'as1 transport record',
  );
  const record: As1TransportRecordV1 = {
    schemaVersion: reqSchema(value.schemaVersion, 'agent-office.as1-transport-record.v1', 'as1 transport record'),
    eventId: requireOpaqueId(value.eventId, 'transport.eventId'),
    envelopeId: requireOpaqueId(value.envelopeId, 'transport.envelopeId'),
    state: requireEnum(value.state, AS1_TRANSPORT_STATES, 'transport.state'),
    rawEnvelopeHash: requireSha256(value.rawEnvelopeHash, 'transport.rawEnvelopeHash'),
    innerEventHash: requireSha256(value.innerEventHash, 'transport.innerEventHash'),
    observed: parseTransportObserved(value.observed),
    preAckDecision: value.preAckDecision === null ? null : requireEnum(value.preAckDecision, ['ROOT_BOUND', 'CONTINUATION_CONSUMED', 'REJECTED'] as const, 'transport.preAckDecision'),
    terminalReason: reqNullableOpaqueId(value.terminalReason, 'transport.terminalReason'),
    bindingStateHash: reqNullableSha256(value.bindingStateHash, 'transport.bindingStateHash'),
    continuation: value.continuation === null ? null : parseContinuationBinding(value.continuation),
    transportAckRecorded: reqBoolean(value.transportAckRecorded, 'transport.transportAckRecorded'),
    intakeId: reqNullableOpaqueId(value.intakeId, 'transport.intakeId'),
    pointerArtifactRef: reqNullableArtifactRef(value.pointerArtifactRef, 'transport.pointerArtifactRef'),
    recordedAt: requireUtc(value.recordedAt, 'transport.recordedAt'),
    ackedAt: reqNullableUtc(value.ackedAt, 'transport.ackedAt'),
    materializedAt: reqNullableUtc(value.materializedAt, 'transport.materializedAt'),
  };
  assertTransportRecordInvariant(record);
  return record;
}

function parseDeliveryAuthorityConsumption(value: unknown): As1DeliveryAuthorityConsumptionV1 {
  assertRecord(value, 'as1 delivery-authority consumption');
  assertExactKeys(value, ['schemaVersion', 'pointerDeliveryGrantId', 'leaseId', 'consumedAt'], 'as1 delivery-authority consumption');
  return {
    schemaVersion: reqSchema(value.schemaVersion, 'agent-office.as1-delivery-authority-consumption.v1', 'as1 delivery-authority consumption'),
    pointerDeliveryGrantId: requireOpaqueId(value.pointerDeliveryGrantId, 'consumption.pointerDeliveryGrantId'),
    leaseId: requireOpaqueId(value.leaseId, 'consumption.leaseId'),
    consumedAt: requireUtc(value.consumedAt, 'consumption.consumedAt'),
  };
}

const TMUX_FACTS_KEYS = [
  'receiveGrantId', 'receiveGrantBindingHash', 'pointerDeliveryGrantId', 'leaseId', 'pilotId', 'profileId', 'advisorTeam',
  'actorId', 'roleInstanceId', 'intakeId', 'sourceEventId', 'pointerHash', 'destinationHash', 'governanceSnapshotHash',
  'registrySnapshotHash', 'globalControlSnapshotHash', 'profileLatchSnapshotHash', 'pointerDeliveryGrantSnapshotHash',
] as const;

/** Assert a profile-tagged fact EXACTLY equals the store's closed profile identity (cross-profile contradiction). */
function requireOwningValue(actual: string, expected: string, label: string): string {
  if (actual !== expected) {
    throw new DomainError('STORE_QUARANTINED', `${label} is a foreign profile value in a profile-local tree`);
  }
  return actual;
}

function parseTmuxDeliveryFacts(profile: As1Profile, value: unknown): As1TmuxDeliveryFacts {
  assertRecord(value, 'as1 tmux delivery facts');
  assertExactKeys(value, TMUX_FACTS_KEYS, 'as1 tmux delivery facts');
  return {
    receiveGrantId: requireOpaqueId(value.receiveGrantId, 'facts.receiveGrantId'),
    receiveGrantBindingHash: requireSha256(value.receiveGrantBindingHash, 'facts.receiveGrantBindingHash'),
    pointerDeliveryGrantId: requireOpaqueId(value.pointerDeliveryGrantId, 'facts.pointerDeliveryGrantId'),
    leaseId: requireOpaqueId(value.leaseId, 'facts.leaseId'),
    pilotId: requireOpaqueId(value.pilotId, 'facts.pilotId'),
    profileId: requireOwningValue(requireOpaqueId(value.profileId, 'facts.profileId'), profile.profileId, 'facts.profileId'),
    advisorTeam: requireOwningValue(requireOpaqueId(value.advisorTeam, 'facts.advisorTeam'), profile.advisorTeam, 'facts.advisorTeam'),
    actorId: requireOwningValue(requireOpaqueId(value.actorId, 'facts.actorId'), profile.actorId, 'facts.actorId'),
    roleInstanceId: requireOwningValue(requireOpaqueId(value.roleInstanceId, 'facts.roleInstanceId'), profile.roleInstanceId, 'facts.roleInstanceId'),
    intakeId: requireOpaqueId(value.intakeId, 'facts.intakeId'),
    sourceEventId: requireOpaqueId(value.sourceEventId, 'facts.sourceEventId'),
    pointerHash: requireSha256(value.pointerHash, 'facts.pointerHash'),
    destinationHash: requireSha256(value.destinationHash, 'facts.destinationHash'),
    governanceSnapshotHash: requireSha256(value.governanceSnapshotHash, 'facts.governanceSnapshotHash'),
    registrySnapshotHash: requireSha256(value.registrySnapshotHash, 'facts.registrySnapshotHash'),
    globalControlSnapshotHash: requireSha256(value.globalControlSnapshotHash, 'facts.globalControlSnapshotHash'),
    profileLatchSnapshotHash: requireSha256(value.profileLatchSnapshotHash, 'facts.profileLatchSnapshotHash'),
    pointerDeliveryGrantSnapshotHash: requireSha256(value.pointerDeliveryGrantSnapshotHash, 'facts.pointerDeliveryGrantSnapshotHash'),
  };
}

function parseTmuxDeliveryRecord(profile: As1Profile): (value: unknown) => As1TmuxDeliveryRecordV1 {
  return (value: unknown): As1TmuxDeliveryRecordV1 => {
    assertRecord(value, 'as1 tmux delivery record');
    assertExactKeys(value, ['schemaVersion', 'deliveryId', 'phase', 'boundFacts', 'recordedAt'], 'as1 tmux delivery record');
    return {
      schemaVersion: reqSchema(value.schemaVersion, 'agent-office.as1-tmux-delivery.v1', 'as1 tmux delivery record'),
      deliveryId: requireOpaqueId(value.deliveryId, 'tmux.deliveryId'),
      phase: requireEnum(value.phase, AS1_TMUX_DELIVERY_PHASES, 'tmux.phase'),
      boundFacts: parseTmuxDeliveryFacts(profile, value.boundFacts),
      recordedAt: requireUtc(value.recordedAt, 'tmux.recordedAt'),
    };
  };
}

/** The EXACT correlation keys each accepted-evidence kind persists — later chain binding trusts these facts. */
const AS1_CORRELATION_KEYS: Readonly<Record<string, readonly string[]>> = {
  ACK: ['advisorAckId', 'sourceEventId', 'pointerHash'],
  INTAKE: ['advisorAckId', 'acceptedAckEvidenceId', 'classification'],
  QUESTION: ['questionId', 'questionKind', 'expectedResponseKind'],
  RESULT: ['resultId', 'terminalStatus', 'resultArtifactPath', 'resultArtifactSha256'],
};

function parseAcceptedEvidence(value: unknown): As1AcceptedEvidenceRecordV1 {
  assertRecord(value, 'as1 accepted evidence');
  assertExactKeys(value, ['evidenceKind', 'evidenceId', 'intakeId', 'blobSha256', 'sourceCommit', 'repositoryId', 'path', 'envelopeHash', 'correlation', 'sequence', 'acceptedAt'], 'as1 accepted evidence');
  const evidenceKind = requireEnum(value.evidenceKind, ['ACK', 'INTAKE', 'QUESTION', 'RESULT'] as const, 'accepted-evidence.evidenceKind');
  // The correlation facts are trusted by later chain binding, so their keys are EXACT per kind (review B08).
  assertRecord(value.correlation, 'accepted-evidence.correlation');
  const rawCorrelation = value.correlation;
  const expectedKeys = AS1_CORRELATION_KEYS[evidenceKind] ?? [];
  assertExactKeys(rawCorrelation, expectedKeys, `accepted-evidence.correlation(${evidenceKind})`);
  const correlation: Record<string, string> = {};
  for (const key of expectedKeys) {
    correlation[key] = reqBoundedString(rawCorrelation[key], `accepted-evidence.correlation.${key}`);
  }
  return {
    evidenceKind,
    evidenceId: requireOpaqueId(value.evidenceId, 'accepted-evidence.evidenceId'),
    intakeId: requireOpaqueId(value.intakeId, 'accepted-evidence.intakeId'),
    blobSha256: requireSha256(value.blobSha256, 'accepted-evidence.blobSha256'),
    sourceCommit: requireGitCommit(value.sourceCommit, 'accepted-evidence.sourceCommit'),
    repositoryId: requireOpaqueId(value.repositoryId, 'accepted-evidence.repositoryId'),
    path: requireArtifactRef(value.path, 'accepted-evidence.path'),
    envelopeHash: requireSha256(value.envelopeHash, 'accepted-evidence.envelopeHash'),
    correlation,
    sequence: requireInteger(value.sequence, 'accepted-evidence.sequence', 1),
    acceptedAt: requireUtc(value.acceptedAt, 'accepted-evidence.acceptedAt'),
  };
}

function parseOutboxRecord(value: unknown): As1OutboxRecordV1 {
  assertRecord(value, 'as1 outbox record');
  assertExactKeys(value, ['outboundId', 'phase', 'requestHash', 'responseHash', 'recordedAt'], 'as1 outbox record');
  const phase = requireEnum(value.phase, AS1_OUTBOX_PHASES, 'outbox.phase');
  const requestHash = reqNullableSha256(value.requestHash, 'outbox.requestHash');
  const responseHash = reqNullableSha256(value.responseHash, 'outbox.responseHash');
  // Beyond field types: the phase↔hash invariant must hold on read (review B08).
  assertOutboxPhaseHashInvariant(phase, requestHash, responseHash);
  return {
    outboundId: requireOpaqueId(value.outboundId, 'outbox.outboundId'),
    phase,
    requestHash,
    responseHash,
    recordedAt: requireUtc(value.recordedAt, 'outbox.recordedAt'),
  };
}

function parseDenialAudit(value: unknown): As1DenialAuditV1 {
  assertRecord(value, 'as1 denial audit');
  assertExactKeys(value, ['schemaVersion', 'reason', 'eventId', 'envelopeId', 'recordedAt'], 'as1 denial audit');
  return {
    schemaVersion: reqSchema(value.schemaVersion, 'agent-office.as1-denial-audit.v1', 'as1 denial audit'),
    reason: reqBoundedString(value.reason, 'denial.reason'),
    eventId: reqNullableOpaqueId(value.eventId, 'denial.eventId'),
    envelopeId: reqNullableOpaqueId(value.envelopeId, 'denial.envelopeId'),
    recordedAt: requireUtc(value.recordedAt, 'denial.recordedAt'),
  };
}

/** Serialize all per-profile mutations to one linearizable sequence (security §15). */
class AsyncMutex {
  private tail: Promise<void> = Promise.resolve();

  public async run<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release = (): void => undefined;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

/**
 * One profile's physically isolated inbound store. Never reads or writes another profile's root; a
 * cross-profile reference is a global contradiction (raised as FORBIDDEN_TARGET), not a fallback.
 */
export class As1ProfileInboundStore {
  private readonly mutex = new AsyncMutex();

  private constructor(
    private readonly stateRoot: string,
    private readonly artifacts: ImmutableArtifactStore,
    private readonly profile: As1Profile,
    private readonly clock: AgentOfficeRuntimeIdentity,
  ) {}

  public static async open(
    stateRoot: string,
    profile: As1Profile,
    clock: AgentOfficeRuntimeIdentity,
  ): Promise<As1ProfileInboundStore> {
    const artifacts = await ImmutableArtifactStore.open(stateRoot);
    await ensurePrivateDirectory(stateRoot, path.posix.join('indexes', ARTIFACT_KIND, 'profiles', profile.profileStateSlug));
    return new As1ProfileInboundStore(stateRoot, artifacts, profile, clock);
  }

  private indexPath(name: string): string {
    return path.posix.join('indexes', ARTIFACT_KIND, 'profiles', this.profile.profileStateSlug, name);
  }

  /** Persist the immutable owner-only envelope receipt and raw-message artifacts (design §8.2 step 4). */
  public async persistReceipt(
    eventId: string,
    envelopeCanonical: unknown,
    rawText: string,
  ): Promise<{
    readonly receiptArtifactRef: string;
    readonly receiptArtifactHash: string;
    readonly messageArtifactRef: string;
    readonly messageArtifactHash: string;
  }> {
    const receipt = await this.artifacts.putScopedCanonicalJson(
      ARTIFACT_KIND,
      [this.profile.profileStateSlug, 'inbound', eventId],
      envelopeCanonical,
    );
    const message = await this.artifacts.putScopedBytes(
      ARTIFACT_KIND,
      [this.profile.profileStateSlug, 'inbound-message', eventId],
      Buffer.from(rawText, 'utf8'),
      'txt',
      LIMITS.MESSAGE_TEXT_MAX_BYTES + 1,
    );
    return {
      receiptArtifactRef: receipt.relativePath,
      receiptArtifactHash: receipt.sha256,
      messageArtifactRef: message.relativePath,
      messageArtifactHash: message.sha256,
    };
  }

  /** Insert both dedupe identities atomically (design §8.3). Duplicate on same bytes; corruption on new bytes. */
  public async insertDedupe(input: DedupeInput): Promise<DedupeOutcome> {
    return this.mutex.run(async () => {
      const records = await this.readJsonArray(this.indexPath('inbound-dedupe.json'), parseDedupeRecord(this.profile), LIMITS.ENVELOPE_DEDUPE_PER_PROFILE);
      const now = this.clock.now();
      const byEnvelope = records.find((r) => r.envelopeId === input.envelopeId);
      const byEvent = records.find(
        (r) => r.teamId === input.teamId && r.apiAppId === input.apiAppId && r.eventId === input.eventId,
      );
      if (byEnvelope !== undefined || byEvent !== undefined) {
        const existing = byEnvelope ?? byEvent;
        if (existing === undefined) {
          throw new DomainError('STORE_QUARANTINED', 'dedupe lookup returned an impossible state');
        }
        if (existing.rawEnvelopeHash !== input.rawEnvelopeHash || existing.innerEventHash !== input.innerEventHash) {
          // Same identity, different bytes → corruption/attack (security §10). Quarantine.
          throw new DomainError('STORE_QUARANTINED', 'dedupe identity reused with different bytes');
        }
        return 'duplicate';
      }
      if (records.length >= LIMITS.ENVELOPE_DEDUPE_PER_PROFILE) {
        throw new DomainError('STORE_QUARANTINED', 'dedupe capacity exhausted; no silent eviction');
      }
      const record: As1DedupeRecordV1 = {
        schemaVersion: 'agent-office.as1-inbound-dedupe.v1',
        profileId: this.profile.profileId,
        envelopeId: input.envelopeId,
        teamId: input.teamId,
        apiAppId: input.apiAppId,
        eventId: input.eventId,
        rawEnvelopeHash: input.rawEnvelopeHash,
        innerEventHash: input.innerEventHash,
        firstReceivedAt: now,
        lastReceivedAt: now,
        preAckClass: input.preAckClass,
        receiveGrantStateHash: null,
        intakeId: null,
        terminalReason: null,
      };
      await this.writeJsonArray(this.indexPath('inbound-dedupe.json'), [...records, record]);
      return 'inserted';
    });
  }

  /** Initialize the UNBOUND receive-grant state if absent; otherwise return the verified current tail. */
  public async initReceiveGrantState(grant: As1PilotReceiveGrantV1): Promise<As1PilotReceiveGrantStateV1> {
    return this.mutex.run(async () => {
      this.assertGrantBelongsToProfile(grant);
      const chain = await this.loadReceiveChain(grant.receiveGrantId);
      const tail = chain.at(-1);
      if (tail !== undefined) return tail;
      const record = this.sealReceiveState(
        {
          schemaVersion: 'agent-office.as1-pilot-receive-grant-state.v1',
          receiveGrantId: grant.receiveGrantId,
          pilotId: grant.pilotId,
          profileId: this.profile.profileId,
          phase: 'UNBOUND',
          rootLimit: 1,
          rootSlotConsumed: false,
          boundSourceEventId: null,
          boundRootTs: null,
          boundRootKeyHash: null,
          boundReceiptArtifactRef: null,
          boundReceiptArtifactHash: null,
          boundMessageArtifactHash: null,
          boundAt: null,
        },
        GENESIS_EVENT_HASH,
        1,
      );
      await this.writeJsonArray(this.receiveStatePath(grant.receiveGrantId), [record]);
      return record;
    });
  }

  /**
   * The atomic first-root binding (design §12.2/§12.3). Serialized: read tail, obtain the trusted-local
   * linearization time exactly once, and commit UNBOUND -> ROOT_BOUND only when boundAt < expiresAt.
   * At or after expiry, commit the terminal EXPIRED_UNBOUND record instead. A slot already consumed loses.
   */
  public async bindFirstRoot(grant: As1PilotReceiveGrantV1, observed: ObservedRootFacts): Promise<BindResult> {
    return this.mutex.run(async () => {
      this.assertGrantBelongsToProfile(grant);
      const chain = await this.loadReceiveChain(grant.receiveGrantId);
      const tail = chain.at(-1);
      if (tail === undefined) {
        throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'receive-grant state has not been initialized');
      }
      if (tail.phase === 'ROOT_BOUND') {
        // Idempotent resume: this exact event already committed the binding (crash-after-transition). Do not
        // repeat the transition and do not treat one's own committed root as a slot-consumed rejection.
        if (tail.boundSourceEventId === observed.sourceEventId) {
          return { outcome: 'ROOT_BOUND', state: tail };
        }
        return { outcome: 'REJECTED_ROOT_SLOT_CONSUMED', state: tail };
      }
      if (tail.phase !== 'UNBOUND') {
        return { outcome: 'REJECTED_GRANT_UNAVAILABLE', state: tail };
      }
      // Sole expiry decision point — one trusted-local clock read at the serialized linearization point.
      const boundAt = this.clock.now();
      if (!(Date.parse(boundAt) < Date.parse(grant.expiresAt))) {
        const expired = this.appendReceiveState(chain, tail, {
          phase: 'EXPIRED_UNBOUND',
          rootSlotConsumed: false,
          boundSourceEventId: null,
          boundRootTs: null,
          boundRootKeyHash: null,
          boundReceiptArtifactRef: null,
          boundReceiptArtifactHash: null,
          boundMessageArtifactHash: null,
          boundAt: null,
        });
        await this.writeJsonArray(this.receiveStatePath(grant.receiveGrantId), [...chain, expired]);
        return { outcome: 'REJECTED_RECEIVE_GRANT_EXPIRED', state: expired };
      }
      const bound = this.appendReceiveState(chain, tail, {
        phase: 'ROOT_BOUND',
        rootSlotConsumed: true,
        boundSourceEventId: observed.sourceEventId,
        boundRootTs: observed.rootTs,
        boundRootKeyHash: observed.rootKeyHash,
        boundReceiptArtifactRef: observed.receiptArtifactRef,
        boundReceiptArtifactHash: observed.receiptArtifactHash,
        boundMessageArtifactHash: observed.messageArtifactHash,
        boundAt,
      });
      await this.writeJsonArray(this.receiveStatePath(grant.receiveGrantId), [...chain, bound]);
      // The immutable binding artifact (design §10) — binds the root key without any future intakeId.
      await this.artifacts.putScopedCanonicalJson(
        ARTIFACT_KIND,
        [this.profile.profileStateSlug, 'receive-grant-bindings', grant.receiveGrantId],
        {
          schemaVersion: 'agent-office.as1-receive-grant-binding.v1',
          receiveGrantId: grant.receiveGrantId,
          profileId: this.profile.profileId,
          bindingStateHash: bound.stateHash,
          sourceEventId: observed.sourceEventId,
          rootTs: observed.rootTs,
          rootKeyHash: observed.rootKeyHash,
          receiptArtifactRef: observed.receiptArtifactRef,
          receiptArtifactHash: observed.receiptArtifactHash,
          messageArtifactHash: observed.messageArtifactHash,
          boundAt,
        },
      );
      return { outcome: 'ROOT_BOUND', state: bound };
    });
  }

  /** Record a terminal EXPIRED_UNBOUND when the grant expires before any root/question (design §12.3). */
  public async recordExpiryBeforeRoot(grant: As1PilotReceiveGrantV1): Promise<As1PilotReceiveGrantStateV1> {
    return this.mutex.run(async () => {
      this.assertGrantBelongsToProfile(grant);
      const chain = await this.loadReceiveChain(grant.receiveGrantId);
      const tail = chain.at(-1);
      if (tail === undefined) {
        throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'receive-grant state has not been initialized');
      }
      if (tail.phase !== 'UNBOUND') return tail;
      const expired = this.appendReceiveState(chain, tail, {
        phase: 'EXPIRED_UNBOUND',
        rootSlotConsumed: false,
        boundSourceEventId: null,
        boundRootTs: null,
        boundRootKeyHash: null,
        boundReceiptArtifactRef: null,
        boundReceiptArtifactHash: null,
        boundMessageArtifactHash: null,
        boundAt: null,
      });
      await this.writeJsonArray(this.receiveStatePath(grant.receiveGrantId), [...chain, expired]);
      return expired;
    });
  }

  public async readReceiveGrantState(receiveGrantId: string): Promise<As1PilotReceiveGrantStateV1 | null> {
    const chain = await this.loadReceiveChain(receiveGrantId);
    return chain.at(-1) ?? null;
  }

  // ── Question state (design §10) ───────────────────────────────────────────
  /** Open exactly one pending question per root (design §9: one open pending question per root). */
  public async openQuestion(question: {
    readonly questionId: string;
    readonly rootTs: string;
    readonly expectedResponseKind: 'CLARIFICATION' | 'DECISION_RESPONSE';
    readonly evidenceRef: string;
    readonly evidenceHash: string;
    readonly openedAt: string;
    readonly expiresAt: string;
  }): Promise<As1PendingQuestionV1> {
    return this.mutex.run(async () => {
      const questions = await this.readJsonArray(this.indexPath('pending-questions.json'), parsePendingQuestion, LIMITS.QUESTION_HISTORY_PER_PROFILE);
      // Exact-idempotent restart: a re-open of the SAME questionId with identical immutable opening fields
      // (root, response kind, evidence ref/hash, openedAt, expiresAt) returns the existing record (the ingress
      // re-observes accepted QUESTION evidence on restart); any divergence on the same id is a durable
      // contradiction, never a silent second question. The state/consumed fields stay lifecycle-managed.
      const existing = questions.find((q) => q.questionId === question.questionId);
      if (existing !== undefined) {
        if (
          existing.rootTs !== question.rootTs ||
          existing.expectedResponseKind !== question.expectedResponseKind ||
          existing.evidenceRef !== question.evidenceRef ||
          existing.evidenceHash !== question.evidenceHash ||
          existing.openedAt !== question.openedAt ||
          existing.expiresAt !== question.expiresAt
        ) {
          throw new DomainError('STORE_QUARANTINED', 'pending question id re-opened with a different root/binding');
        }
        return existing;
      }
      const openForRoot = questions.filter((q) => q.rootTs === question.rootTs && q.state === 'OPEN');
      if (openForRoot.length >= LIMITS.OPEN_QUESTIONS_PER_ROOT) {
        throw new DomainError('INVALID_TRANSITION', 'a root already has an open pending question');
      }
      if (questions.length >= LIMITS.QUESTION_HISTORY_PER_PROFILE) {
        throw new DomainError('STORE_QUARANTINED', 'question history capacity exhausted; no silent eviction');
      }
      const record: As1PendingQuestionV1 = {
        schemaVersion: 'agent-office.as1-pending-question.v1',
        questionId: question.questionId,
        rootTs: question.rootTs,
        expectedResponseKind: question.expectedResponseKind,
        evidenceRef: question.evidenceRef,
        evidenceHash: question.evidenceHash,
        state: 'OPEN',
        openedAt: question.openedAt,
        expiresAt: question.expiresAt,
        consumedAt: null,
        consumedBySourceEventId: null,
      };
      await this.writeJsonArray(this.indexPath('pending-questions.json'), [...questions, record]);
      return record;
    });
  }

  public async findOpenQuestionForRoot(rootTs: string): Promise<As1PendingQuestionV1 | null> {
    const questions = await this.readJsonArray(this.indexPath('pending-questions.json'), parsePendingQuestion, LIMITS.QUESTION_HISTORY_PER_PROFILE);
    return questions.find((q) => q.rootTs === rootTs && q.state === 'OPEN') ?? null;
  }

  /**
   * Deterministically derive the consumed-question-reply set for a root/intake (design §13.3): every CONSUMED
   * pending question joined to its EXACT MATERIALIZED continuation transport record (matched on questionId,
   * originalIntakeId, rootTs, and consuming event), sorted canonically by questionId. A consumed question with
   * no matching materialized continuation — or a missing consuming event — fails closed. Used to bind a RESULT.
   */
  public async deriveConsumedQuestionReplies(rootTs: string, intakeId: string): Promise<readonly As1ConsumedQuestionReplyV1[]> {
    const questions = (await this.readJsonArray(this.indexPath('pending-questions.json'), parsePendingQuestion, LIMITS.QUESTION_HISTORY_PER_PROFILE)).filter(
      (q) => q.rootTs === rootTs && q.state === 'CONSUMED',
    );
    const transports = await this.readJsonArray(this.indexPath('transport-journal.json'), parseTransportRecord, LIMITS.RECEIPT_RECORDS_PER_PROFILE);
    const entries: As1ConsumedQuestionReplyV1[] = [];
    for (const q of questions) {
      if (q.consumedBySourceEventId === null) {
        throw new DomainError('STORE_QUARANTINED', 'consumed question has no recorded consuming event');
      }
      const reply = transports.find(
        (r) =>
          r.state === 'MATERIALIZED' &&
          r.continuation !== null &&
          r.continuation.questionId === q.questionId &&
          r.continuation.originalIntakeId === intakeId &&
          r.observed.rootTs === rootTs &&
          r.eventId === q.consumedBySourceEventId,
      );
      if (reply?.continuation == null || reply.intakeId === null) {
        throw new DomainError('STORE_QUARANTINED', 'consumed question lacks its exact materialized continuation transport record');
      }
      entries.push({
        questionId: q.questionId,
        expectedResponseKind: q.expectedResponseKind,
        consumedBySourceEventId: q.consumedBySourceEventId,
        continuationKind: reply.continuation.kind,
        continuationIntakeId: reply.intakeId,
      });
    }
    entries.sort((a, b) => (a.questionId < b.questionId ? -1 : a.questionId > b.questionId ? 1 : 0));
    return entries;
  }

  /**
   * Atomically consume the single open question for a root before ACK (design §10/§12.2). The trusted-local
   * consumedAt is read at the serialized linearization point and the transition commits only when
   * consumedAt < grant.expiresAt; otherwise a terminal expiry rejection is returned and nothing consumed.
   */
  public async consumeQuestion(
    grant: As1PilotReceiveGrantV1,
    rootTs: string,
    sourceEventId: string,
  ): Promise<ConsumeQuestionResult> {
    return this.mutex.run(async () => {
      this.assertGrantBelongsToProfile(grant);
      const questions = await this.readJsonArray(this.indexPath('pending-questions.json'), parsePendingQuestion, LIMITS.QUESTION_HISTORY_PER_PROFILE);
      const index = questions.findIndex((q) => q.rootTs === rootTs && q.state === 'OPEN');
      const open = index >= 0 ? questions[index] : undefined;
      if (open === undefined) {
        // Idempotent resume: this exact event already consumed the sole question (crash-after-transition).
        const mine = questions.find((q) => q.rootTs === rootTs && q.state === 'CONSUMED' && q.consumedBySourceEventId === sourceEventId);
        if (mine !== undefined) {
          return { outcome: 'CONSUMED', question: mine };
        }
        return { outcome: 'REJECTED_NO_OPEN_QUESTION', question: null };
      }
      const consumedAt = this.clock.now();
      if (!(Date.parse(consumedAt) < Date.parse(grant.expiresAt))) {
        return { outcome: 'REJECTED_RECEIVE_GRANT_EXPIRED', question: open };
      }
      const consumed: As1PendingQuestionV1 = {
        ...open,
        state: 'CONSUMED',
        consumedAt,
        consumedBySourceEventId: sourceEventId,
      };
      const next = [...questions];
      next[index] = consumed;
      await this.writeJsonArray(this.indexPath('pending-questions.json'), next);
      return { outcome: 'CONSUMED', question: consumed };
    });
  }

  // ── Root correlation (design §10) ─────────────────────────────────────────
  public async recordRootCorrelation(record: Omit<As1RootCorrelationV1, 'schemaVersion' | 'createdAt'>): Promise<void> {
    await this.mutex.run(async () => {
      const records = await this.readJsonArray(this.indexPath('root-correlations.json'), parseRootCorrelation, LIMITS.INTAKE_CORRELATIONS_PER_PROFILE);
      const existing = records.find((r) => r.rootTs === record.rootTs);
      if (existing !== undefined) {
        // Idempotent ONLY on exact immutable equality (review B08). A divergent duplicate — the same rootTs with
        // any different immutable correlation field — is corruption/attack and fails closed; matching rootTs
        // alone is insufficient and must never be silently accepted.
        if (
          existing.rootKeyHash !== record.rootKeyHash ||
          existing.sourceEventId !== record.sourceEventId ||
          existing.receiveGrantId !== record.receiveGrantId ||
          existing.bindingStateHash !== record.bindingStateHash ||
          existing.intakeId !== record.intakeId
        ) {
          throw new DomainError('STORE_QUARANTINED', 'a divergent root correlation already exists for this rootTs');
        }
        return;
      }
      if (records.length >= LIMITS.INTAKE_CORRELATIONS_PER_PROFILE) {
        throw new DomainError('STORE_QUARANTINED', 'root-correlation capacity exhausted; no silent eviction');
      }
      const next: As1RootCorrelationV1 = {
        schemaVersion: 'agent-office.as1-root-correlation.v1',
        createdAt: this.clock.now(),
        ...record,
      };
      await this.writeJsonArray(this.indexPath('root-correlations.json'), [...records, next]);
    });
  }

  /** Resolve the immutable accepted root correlation for an intake (design §10/§14 outbound root binding). */
  public async findRootByIntakeId(intakeId: string): Promise<As1RootCorrelationV1 | null> {
    const records = await this.readJsonArray(this.indexPath('root-correlations.json'), parseRootCorrelation, LIMITS.INTAKE_CORRELATIONS_PER_PROFILE);
    return records.find((r) => r.intakeId === intakeId) ?? null;
  }

  public async findRootByThreadTs(threadTs: string): Promise<As1RootCorrelationV1 | null> {
    const records = await this.readJsonArray(this.indexPath('root-correlations.json'), parseRootCorrelation, LIMITS.INTAKE_CORRELATIONS_PER_PROFILE);
    return records.find((r) => r.rootTs === threadTs) ?? null;
  }

  // ── Transport journal — the durable hash-bound state machine (design §8.2/§8.3/§12.3/§15.1) ─────────
  /**
   * Open the `PREACK_PENDING` transport record, binding the immutable bytes and observed facts. Idempotent:
   * a re-delivery of the same event returns the existing record only when every bound byte/fact matches;
   * any divergence is corruption/attack and quarantines the profile (never a silent overwrite).
   */
  public async openTransport(
    eventId: string,
    envelopeId: string,
    rawEnvelopeHash: string,
    innerEventHash: string,
    observed: As1TransportObserved,
  ): Promise<As1TransportRecordV1> {
    return this.mutex.run(async () => {
      const records = await this.readJsonArray(this.indexPath('transport-journal.json'), parseTransportRecord, LIMITS.RECEIPT_RECORDS_PER_PROFILE);
      const existing = records.find((r) => r.eventId === eventId);
      if (existing !== undefined) {
        if (
          existing.envelopeId !== envelopeId ||
          existing.rawEnvelopeHash !== rawEnvelopeHash ||
          existing.innerEventHash !== innerEventHash ||
          existing.observed.sourceEventId !== observed.sourceEventId ||
          existing.observed.rootTs !== observed.rootTs ||
          existing.observed.rootKeyHash !== observed.rootKeyHash ||
          existing.observed.receiptArtifactHash !== observed.receiptArtifactHash ||
          existing.observed.messageArtifactHash !== observed.messageArtifactHash ||
          existing.observed.candidateKind !== observed.candidateKind
        ) {
          throw new DomainError('STORE_QUARANTINED', 'transport identity reused with different bytes or facts');
        }
        return existing;
      }
      if (records.length >= LIMITS.RECEIPT_RECORDS_PER_PROFILE) {
        throw new DomainError('STORE_QUARANTINED', 'transport journal capacity exhausted; no silent eviction');
      }
      const record: As1TransportRecordV1 = {
        schemaVersion: 'agent-office.as1-transport-record.v1',
        eventId,
        envelopeId,
        state: 'PREACK_PENDING',
        rawEnvelopeHash,
        innerEventHash,
        observed,
        preAckDecision: null,
        terminalReason: null,
        bindingStateHash: null,
        continuation: null,
        transportAckRecorded: false,
        intakeId: null,
        pointerArtifactRef: null,
        recordedAt: this.clock.now(),
        ackedAt: null,
        materializedAt: null,
      };
      await this.writeJsonArray(this.indexPath('transport-journal.json'), [...records, record]);
      return record;
    });
  }

  /**
   * Open a transport record for an ACKable POLICY rejection DIRECTLY in the committed `PREACK_REJECTED` state
   * (review B02). Unlike `openTransport` there is no `PREACK_PENDING` window, so a crash before ACK is recovered
   * by reproducing the exact durable rejection — recovery never re-derives a root/continuation bind for a policy-
   * rejected event. Idempotent: a re-delivery returns the existing record only when every bound byte/fact and the
   * committed rejection reason match; any divergence quarantines the profile.
   */
  public async openRejectedTransport(
    eventId: string,
    envelopeId: string,
    rawEnvelopeHash: string,
    innerEventHash: string,
    observed: As1TransportObserved,
    terminalReason: string,
  ): Promise<As1TransportRecordV1> {
    return this.mutex.run(async () => {
      const records = await this.readJsonArray(this.indexPath('transport-journal.json'), parseTransportRecord, LIMITS.RECEIPT_RECORDS_PER_PROFILE);
      const existing = records.find((r) => r.eventId === eventId);
      if (existing !== undefined) {
        if (
          existing.envelopeId !== envelopeId ||
          existing.rawEnvelopeHash !== rawEnvelopeHash ||
          existing.innerEventHash !== innerEventHash ||
          existing.observed.sourceEventId !== observed.sourceEventId ||
          existing.observed.rootTs !== observed.rootTs ||
          existing.observed.rootKeyHash !== observed.rootKeyHash ||
          existing.observed.receiptArtifactHash !== observed.receiptArtifactHash ||
          existing.observed.messageArtifactHash !== observed.messageArtifactHash ||
          existing.observed.candidateKind !== observed.candidateKind
        ) {
          throw new DomainError('STORE_QUARANTINED', 'transport identity reused with different bytes or facts');
        }
        // A prior delivery already opened this event; it must be (or have advanced from) the SAME rejection.
        if (existing.preAckDecision !== 'REJECTED') {
          throw new DomainError('STORE_QUARANTINED', 'transport identity reused with a non-rejected decision');
        }
        if (existing.terminalReason !== terminalReason) {
          throw new DomainError('STORE_QUARANTINED', 'transport rejection reason is immutable once bound');
        }
        return existing;
      }
      if (records.length >= LIMITS.RECEIPT_RECORDS_PER_PROFILE) {
        throw new DomainError('STORE_QUARANTINED', 'transport journal capacity exhausted; no silent eviction');
      }
      const record: As1TransportRecordV1 = {
        schemaVersion: 'agent-office.as1-transport-record.v1',
        eventId,
        envelopeId,
        state: 'PREACK_REJECTED',
        rawEnvelopeHash,
        innerEventHash,
        observed,
        preAckDecision: 'REJECTED',
        terminalReason,
        bindingStateHash: null,
        continuation: null,
        transportAckRecorded: false,
        intakeId: null,
        pointerArtifactRef: null,
        recordedAt: this.clock.now(),
        ackedAt: null,
        materializedAt: null,
      };
      await this.writeJsonArray(this.indexPath('transport-journal.json'), [...records, record]);
      return record;
    });
  }

  /** `PREACK_PENDING -> PREACK_{ROOT_BOUND|CONTINUATION_CONSUMED|REJECTED}`. Idempotent on the same decision. */
  public async commitPreAckDecision(eventId: string, input: CommitPreAckInput): Promise<As1TransportRecordV1> {
    const target: As1TransportState =
      input.decision === 'ROOT_BOUND'
        ? 'PREACK_ROOT_BOUND'
        : input.decision === 'CONTINUATION_CONSUMED'
          ? 'PREACK_CONTINUATION_CONSUMED'
          : 'PREACK_REJECTED';
    return this.transition(eventId, target, (existing) => {
      if (existing.preAckDecision !== null && existing.preAckDecision !== input.decision) {
        throw new DomainError('INVALID_TRANSITION', 'a different pre-ACK decision is already committed');
      }
      return {
        ...existing,
        state: target,
        preAckDecision: input.decision,
        terminalReason: input.terminalReason,
        bindingStateHash: input.bindingStateHash,
        continuation: input.continuation,
      };
    });
  }

  /** `PREACK_* -> TRANSPORT_ACK_RECORDED`. This is the sole durable meaning of "the Socket ACK happened". */
  public async commitTransportAck(eventId: string): Promise<As1TransportRecordV1> {
    return this.transition(eventId, 'TRANSPORT_ACK_RECORDED', (existing) => ({
      ...existing,
      state: 'TRANSPORT_ACK_RECORDED',
      transportAckRecorded: true,
      ackedAt: existing.ackedAt ?? this.clock.now(),
    }));
  }

  /** `TRANSPORT_ACK_RECORDED -> MATERIALIZED` for a bound/consumed decision. Idempotent (one intake only). */
  public async commitMaterialized(eventId: string, intakeId: string, pointerArtifactRef: string): Promise<void> {
    await this.transition(eventId, 'MATERIALIZED', (existing) => {
      if (existing.preAckDecision === 'REJECTED') {
        throw new DomainError('INVALID_TRANSITION', 'a rejected decision cannot materialize an intake');
      }
      if (existing.state === 'MATERIALIZED') {
        if (existing.intakeId !== intakeId) {
          throw new DomainError('INVALID_TRANSITION', 'a different intake is already materialized for this event');
        }
        return existing;
      }
      return {
        ...existing,
        state: 'MATERIALIZED',
        intakeId,
        pointerArtifactRef,
        materializedAt: existing.materializedAt ?? this.clock.now(),
      };
    });
  }

  /** `TRANSPORT_ACK_RECORDED -> TERMINAL_NO_INTAKE` for a rejected decision. Idempotent. */
  public async commitTerminalNoIntake(eventId: string): Promise<void> {
    await this.transition(eventId, 'TERMINAL_NO_INTAKE', (existing) => {
      if (existing.preAckDecision !== 'REJECTED') {
        throw new DomainError('INVALID_TRANSITION', 'only a rejected decision reaches TERMINAL_NO_INTAKE');
      }
      return { ...existing, state: 'TERMINAL_NO_INTAKE' };
    });
  }

  public async readTransport(eventId: string): Promise<As1TransportRecordV1 | null> {
    const records = await this.readJsonArray(this.indexPath('transport-journal.json'), parseTransportRecord, LIMITS.RECEIPT_RECORDS_PER_PROFILE);
    return records.find((r) => r.eventId === eventId) ?? null;
  }

  /** Every non-terminal transport record, oldest first — the input to bounded startup recovery (§15.1). */
  public async listNonTerminalTransport(): Promise<readonly As1TransportRecordV1[]> {
    const records = await this.readJsonArray(this.indexPath('transport-journal.json'), parseTransportRecord, LIMITS.RECEIPT_RECORDS_PER_PROFILE);
    return records.filter((r) => r.state !== 'MATERIALIZED' && r.state !== 'TERMINAL_NO_INTAKE');
  }

  /** Apply one legal, hash-bound transition. A target absent from the source's legal set is rejected. */
  private async transition(
    eventId: string,
    target: As1TransportState,
    update: (existing: As1TransportRecordV1) => As1TransportRecordV1,
  ): Promise<As1TransportRecordV1> {
    return this.mutex.run(async () => {
      const records = await this.readJsonArray(this.indexPath('transport-journal.json'), parseTransportRecord, LIMITS.RECEIPT_RECORDS_PER_PROFILE);
      const index = records.findIndex((r) => r.eventId === eventId);
      const existing = index >= 0 ? records[index] : undefined;
      if (existing === undefined) {
        throw new DomainError('INVALID_TRANSITION', 'transport record must be opened before any transition');
      }
      if (existing.state === target) {
        // Idempotent replay of an already-committed transition: verify via the same update path, do not rewrite.
        return update(existing);
      }
      if (!AS1_LEGAL_TRANSPORT_TRANSITIONS[existing.state].includes(target)) {
        throw new DomainError('INVALID_TRANSITION', `illegal transport transition ${existing.state} -> ${target}`);
      }
      const next = update(existing);
      const copy = [...records];
      copy[index] = next;
      await this.writeJsonArray(this.indexPath('transport-journal.json'), copy);
      return next;
    });
  }

  // ── Minimal denial audit (design §9) ──────────────────────────────────────
  public async recordDenialAudit(reason: string, eventId: string | null, envelopeId: string | null): Promise<void> {
    await this.mutex.run(async () => {
      const records = await this.readJsonArray(this.indexPath('denial-audit.json'), parseDenialAudit, LIMITS.DENIAL_AUDIT_PER_PROFILE);
      if (records.length >= LIMITS.DENIAL_AUDIT_PER_PROFILE) {
        throw new DomainError('STORE_QUARANTINED', 'denial-audit capacity exhausted; no silent eviction');
      }
      await this.writeJsonArray(this.indexPath('denial-audit.json'), [
        ...records,
        {
          schemaVersion: 'agent-office.as1-denial-audit.v1',
          reason,
          eventId,
          envelopeId,
          recordedAt: this.clock.now(),
        },
      ]);
    });
  }

  // ── Immutable intake / pointer artifacts (design §11, §12.6) ──────────────
  public async persistIntakeArtifact(intakeId: string, intake: unknown): Promise<ImmutableArtifactReceipt> {
    return this.artifacts.putScopedCanonicalJson(ARTIFACT_KIND, [this.profile.profileStateSlug, 'intake', intakeId], intake);
  }

  public async persistPointerArtifact(deliveryId: string, pointer: unknown): Promise<ImmutableArtifactReceipt> {
    return this.artifacts.putScopedCanonicalJson(
      ARTIFACT_KIND,
      [this.profile.profileStateSlug, 'pointers', deliveryId],
      pointer,
    );
  }

  // ── Tmux delivery journal + one-use delivery-authority consumption (design §12.5/§12.7) ────────────
  /**
   * Record the tmux delivery phase, binding the invariant identity/hash facts on the first (PREPARED) write.
   * Every later transition preserves those exact facts (a change is corruption), never resumes a terminal
   * journal, and — because PREPARED is written before authority consumption — no consumption is unjournaled.
   */
  public async recordTmuxPhase(deliveryId: string, phase: string, facts?: As1TmuxDeliveryFacts): Promise<void> {
    await this.mutex.run(async () => {
      // Reject an unknown phase up front; only the closed vocabulary is representable (review B08).
      if (!isTmuxDeliveryPhase(phase)) {
        throw new DomainError('INVALID_TRANSITION', 'unknown tmux delivery phase');
      }
      const records = await this.readJsonArray(this.indexPath('tmux-delivery.json'), parseTmuxDeliveryRecord(this.profile), LIMITS.POINTER_LEASE_CAPABILITY_JOURNAL_PER_PROFILE);
      const index = records.findIndex((r) => r.deliveryId === deliveryId);
      const now = this.clock.now();
      if (index < 0) {
        if (facts === undefined) {
          throw new DomainError('INVALID_TRANSITION', 'a new tmux delivery journal must bind its invariant facts');
        }
        if (phase !== 'PREPARED') {
          throw new DomainError('INVALID_TRANSITION', 'a new tmux delivery journal must start at PREPARED');
        }
        if (records.length >= LIMITS.POINTER_LEASE_CAPABILITY_JOURNAL_PER_PROFILE) {
          throw new DomainError('STORE_QUARANTINED', 'tmux delivery journal capacity exhausted; no silent eviction');
        }
        const record: As1TmuxDeliveryRecordV1 = {
          schemaVersion: 'agent-office.as1-tmux-delivery.v1',
          deliveryId,
          phase,
          boundFacts: facts,
          recordedAt: now,
        };
        await this.writeJsonArray(this.indexPath('tmux-delivery.json'), [...records, record]);
        return;
      }
      const existing = records[index];
      if (existing === undefined) {
        throw new DomainError('STORE_QUARANTINED', 'tmux delivery journal returned an impossible state');
      }
      // The invariant facts are checked BEFORE any idempotent-return: same phase + different facts is
      // corruption, never a silent no-op (design §12.7, review B04).
      if (facts !== undefined && hashCanonical(facts) !== hashCanonical(existing.boundFacts)) {
        throw new DomainError('STORE_QUARANTINED', 'tmux delivery bound facts changed across the hash chain');
      }
      if (existing.phase === phase) return; // idempotent replay of the exact same phase and facts
      // Only a legal successor of the current phase is accepted; terminals have no successor (review B08).
      if (!AS1_LEGAL_TMUX_TRANSITIONS[existing.phase].includes(phase)) {
        throw new DomainError('INVALID_TRANSITION', `illegal tmux delivery transition ${existing.phase} -> ${phase}`);
      }
      const next: As1TmuxDeliveryRecordV1 = { ...existing, phase, recordedAt: now };
      const copy = [...records];
      copy[index] = next;
      await this.writeJsonArray(this.indexPath('tmux-delivery.json'), copy);
    });
  }

  public async readTmuxPhase(deliveryId: string): Promise<string | null> {
    const records = await this.readJsonArray(this.indexPath('tmux-delivery.json'), parseTmuxDeliveryRecord(this.profile), LIMITS.POINTER_LEASE_CAPABILITY_JOURNAL_PER_PROFILE);
    return records.find((r) => r.deliveryId === deliveryId)?.phase ?? null;
  }

  // ── Durable outbound Slack outbox (design §14) ────────────────────────────
  public async persistOutboundArtifact(outboundId: string, rendered: unknown): Promise<ImmutableArtifactReceipt> {
    return this.artifacts.putScopedCanonicalJson(
      ARTIFACT_KIND,
      [this.profile.profileStateSlug, 'outbound', outboundId],
      rendered,
    );
  }

  /**
   * Advance the durable outbox phase and bind the immutable request/response artifact hashes (design §14). The
   * request hash is written at PREPARED and the response hash at RESPONSE_RECORDED; both are PRESERVED across a
   * later phase update so the terminal record proves exactly which bytes were prepared and (if any) recorded.
   */
  public async recordOutboxPhase(outboundId: string, phase: string, hashes?: As1OutboxHashes): Promise<void> {
    await this.mutex.run(async () => {
      if (!isOutboxPhase(phase)) {
        throw new DomainError('INVALID_TRANSITION', 'unknown outbox phase');
      }
      const records = await this.readJsonArray(this.indexPath('slack-outbox.json'), parseOutboxRecord, LIMITS.OUTBOX_PER_PROFILE);
      const index = records.findIndex((r) => r.outboundId === outboundId);
      const prior = index >= 0 ? records[index] : undefined;
      // Enforce the closed legal transition (a new record must START at PREPARED).
      if (prior === undefined) {
        if (phase !== 'PREPARED') throw new DomainError('INVALID_TRANSITION', 'a new outbox record must start at PREPARED');
      } else if (!AS1_LEGAL_OUTBOX_TRANSITIONS[prior.phase].includes(phase)) {
        throw new DomainError('INVALID_TRANSITION', `illegal outbox transition ${prior.phase} -> ${phase}`);
      }
      const requestHash = hashes?.requestHash ?? prior?.requestHash ?? null;
      const responseHash = hashes?.responseHash ?? prior?.responseHash ?? null;
      // Hash immutability: a bound request/response hash can never change (same phase + differing hash = corruption).
      if (prior?.requestHash != null && requestHash !== prior.requestHash) {
        throw new DomainError('STORE_QUARANTINED', 'outbox request hash is immutable once bound');
      }
      if (prior?.responseHash != null && responseHash !== prior.responseHash) {
        throw new DomainError('STORE_QUARANTINED', 'outbox response hash is immutable once bound');
      }
      // The resulting record must satisfy the phase↔hash invariant.
      assertOutboxPhaseHashInvariant(phase, requestHash, responseHash);
      const record: As1OutboxRecordV1 = { outboundId, phase, requestHash, responseHash, recordedAt: this.clock.now() };
      if (index >= 0) {
        const copy = [...records];
        copy[index] = record;
        await this.writeJsonArray(this.indexPath('slack-outbox.json'), copy);
      } else {
        if (records.length >= LIMITS.OUTBOX_PER_PROFILE) {
          throw new DomainError('STORE_QUARANTINED', 'outbox capacity exhausted; no silent eviction');
        }
        await this.writeJsonArray(this.indexPath('slack-outbox.json'), [...records, record]);
      }
    });
  }

  public async readOutboxPhase(outboundId: string): Promise<string | null> {
    const records = await this.readJsonArray(this.indexPath('slack-outbox.json'), parseOutboxRecord, LIMITS.OUTBOX_PER_PROFILE);
    return records.find((r) => r.outboundId === outboundId)?.phase ?? null;
  }

  public async readOutboxRecord(outboundId: string): Promise<As1OutboxRecordV1 | null> {
    const records = await this.readJsonArray(this.indexPath('slack-outbox.json'), parseOutboxRecord, LIMITS.OUTBOX_PER_PROFILE);
    return records.find((r) => r.outboundId === outboundId) ?? null;
  }

  // ── Advisor evidence ingress log (design §13) ─────────────────────────────
  public async appendAcceptedEvidence(entry: {
    readonly evidenceKind: string;
    readonly evidenceId: string;
    readonly intakeId: string;
    readonly blobSha256: string;
    readonly sourceCommit: string;
    readonly repositoryId: string;
    readonly path: string;
    readonly envelopeHash: string;
    /** Per-kind canonical correlation facts exposed for cross-stage binding (review B06). */
    readonly correlation: Readonly<Record<string, string>>;
  }): Promise<number> {
    return this.mutex.run(async () => {
      const records = await this.readJsonArray(this.indexPath('evidence-ingress-checkpoint.json'), parseAcceptedEvidence, LIMITS.EVIDENCE_INGRESS_PER_PROFILE);
      const existing = records.find((r) => r.evidenceId === entry.evidenceId);
      if (existing !== undefined) {
        // Exact duplicate equality: the re-accepted evidence must match on the FULL canonical envelope hash
        // AND repository/path/commit/blob/kind/intake — not a partial tuple (review B06). Any divergence
        // (including a missing legacy field) is a durable contradiction.
        if (
          existing.envelopeHash !== entry.envelopeHash ||
          existing.evidenceKind !== entry.evidenceKind ||
          existing.intakeId !== entry.intakeId ||
          existing.sourceCommit !== entry.sourceCommit ||
          existing.repositoryId !== entry.repositoryId ||
          existing.path !== entry.path ||
          existing.blobSha256 !== entry.blobSha256
        ) {
          throw new DomainError('STORE_QUARANTINED', 'evidence id re-accepted with different envelope/repository/path/commit/kind/intake/bytes');
        }
        return records.length;
      }
      if (records.length >= LIMITS.EVIDENCE_INGRESS_PER_PROFILE) {
        throw new DomainError('STORE_QUARANTINED', 'evidence ingress capacity exhausted; no silent eviction');
      }
      const sequence = records.length + 1;
      await this.writeJsonArray(this.indexPath('evidence-ingress-checkpoint.json'), [
        ...records,
        { ...entry, sequence, acceptedAt: this.clock.now() },
      ]);
      return sequence;
    });
  }

  public async readAcceptedEvidence(): Promise<readonly As1AcceptedEvidenceRecordV1[]> {
    return this.readJsonArray(this.indexPath('evidence-ingress-checkpoint.json'), parseAcceptedEvidence, LIMITS.EVIDENCE_INGRESS_PER_PROFILE);
  }

  /**
   * Consume the delivery grant + lease exactly once, in a SINGLE atomic write (design §12.5). Both ids live
   * in one index so a crash can never consume only one side; reuse of either id returns false. Permanent.
   */
  public async consumeDeliveryAuthority(pointerDeliveryGrantId: string, leaseId: string): Promise<boolean> {
    return this.mutex.run(async () => {
      // Fail closed on legacy two-file consumption state: a prior version's separately-written grant/lease
      // indexes must never be silently ignored, or already-consumed authority could be re-delivered.
      const legacyGrants = await this.readJsonArray(this.indexPath('pointer-delivery-grant-consumption.json'), passthroughRecord, LIMITS.PARSED_ARRAY_MAX);
      const legacyLeases = await this.readJsonArray(this.indexPath('readiness-lease-consumption.json'), passthroughRecord, LIMITS.PARSED_ARRAY_MAX);
      if (legacyGrants.length > 0 || legacyLeases.length > 0) {
        throw new DomainError('STORE_QUARANTINED', 'legacy delivery-authority consumption state present; requires a reviewed migration');
      }
      const records = await this.readJsonArray(
        this.indexPath('delivery-authority-consumption.json'),
        parseDeliveryAuthorityConsumption,
        LIMITS.POINTER_LEASE_CAPABILITY_JOURNAL_PER_PROFILE,
      );
      if (records.some((r) => r.pointerDeliveryGrantId === pointerDeliveryGrantId || r.leaseId === leaseId)) {
        return false;
      }
      if (records.length >= LIMITS.POINTER_LEASE_CAPABILITY_JOURNAL_PER_PROFILE) {
        throw new DomainError('STORE_QUARANTINED', 'delivery-authority consumption capacity exhausted; no silent eviction');
      }
      const record: As1DeliveryAuthorityConsumptionV1 = {
        schemaVersion: 'agent-office.as1-delivery-authority-consumption.v1',
        pointerDeliveryGrantId,
        leaseId,
        consumedAt: this.clock.now(),
      };
      await this.writeJsonArray(this.indexPath('delivery-authority-consumption.json'), [...records, record]);
      return true;
    });
  }

  private assertGrantBelongsToProfile(grant: As1PilotReceiveGrantV1): void {
    if (grant.profileId !== this.profile.profileId) {
      // A cross-profile grant must never be read through the selected profile (security §14.2).
      throw new DomainError('FORBIDDEN_TARGET', 'receive grant profile does not match this profile store');
    }
  }

  private receiveStatePath(receiveGrantId: string): string {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(receiveGrantId)) {
      throw new DomainError('INVALID_SCHEMA', 'receiveGrantId is not a bounded contained identity');
    }
    return this.indexPath(path.posix.join('receive-grant-state', `${receiveGrantId}.json`));
  }

  private async loadReceiveChain(receiveGrantId: string): Promise<As1PilotReceiveGrantStateV1[]> {
    const records = await this.readJsonArray(this.receiveStatePath(receiveGrantId), parseReceiveGrantState, LIMITS.POINTER_LEASE_CAPABILITY_JOURNAL_PER_PROFILE);
    let previous: string = GENESIS_EVENT_HASH;
    for (const [index, record] of records.entries()) {
      if (
        record.previousStateHash !== previous ||
        record.version !== index + 1 ||
        !isSha256(record.stateHash) ||
        record.stateHash !== this.computeStateHash(record)
      ) {
        throw new DomainError('STORE_QUARANTINED', 'receive-grant state chain is corrupt');
      }
      if (record.profileId !== this.profile.profileId) {
        throw new DomainError('FORBIDDEN_TARGET', 'receive-grant state references a foreign profile');
      }
      previous = record.stateHash;
    }
    return records;
  }

  private appendReceiveState(
    chain: readonly As1PilotReceiveGrantStateV1[],
    tail: As1PilotReceiveGrantStateV1,
    change: Pick<
      As1PilotReceiveGrantStateV1,
      | 'phase'
      | 'rootSlotConsumed'
      | 'boundSourceEventId'
      | 'boundRootTs'
      | 'boundRootKeyHash'
      | 'boundReceiptArtifactRef'
      | 'boundReceiptArtifactHash'
      | 'boundMessageArtifactHash'
      | 'boundAt'
    >,
  ): As1PilotReceiveGrantStateV1 {
    return this.sealReceiveState(
      {
        schemaVersion: 'agent-office.as1-pilot-receive-grant-state.v1',
        receiveGrantId: tail.receiveGrantId,
        pilotId: tail.pilotId,
        profileId: tail.profileId,
        rootLimit: 1,
        ...change,
      },
      tail.stateHash,
      chain.length + 1,
    );
  }

  private sealReceiveState(
    body: Omit<As1PilotReceiveGrantStateV1, 'previousStateHash' | 'stateHash' | 'version'>,
    previousStateHash: string,
    version: number,
  ): As1PilotReceiveGrantStateV1 {
    const withoutHash = { ...body, previousStateHash, version };
    return { ...withoutHash, stateHash: hashCanonical(withoutHash) };
  }

  private computeStateHash(record: As1PilotReceiveGrantStateV1): string {
    const rest: Record<string, unknown> = { ...record };
    Reflect.deleteProperty(rest, 'stateHash');
    return hashCanonical(rest);
  }

  /**
   * Read a durable per-profile index and STRICTLY parse every record (review B08). No blind `as T[]` cast: each
   * entry passes an exact-key/type/hash/phase parser, and ANY validation failure (or an over-capacity file) fails
   * closed as STORE_QUARANTINED so a corrupted/tampered/legacy index is never trusted downstream.
   */
  private async readJsonArray<T>(relative: string, parse: (value: unknown, index: number) => T, maxRecords: number): Promise<T[]> {
    const target = await resolveContainedPath(this.stateRoot, relative, { allowMissingLeaf: true });
    let handle: import('node:fs/promises').FileHandle;
    try {
      handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) return [];
      throw error;
    }
    try {
      // Enforce the fixed durable-file byte ceiling on the pinned fd BEFORE allocating/reading/parsing, so a
      // tampered file with arbitrarily large whitespace or one overlarge record fails closed (review B08). The
      // same open fd is stat'd and read, so there is no TOCTOU window.
      const stat = await handle.stat();
      if (stat.size > LIMITS.DURABLE_FILE_MAX_BYTES) {
        throw new DomainError('STORE_QUARANTINED', `profile index ${relative} exceeds the ${String(LIMITS.DURABLE_FILE_MAX_BYTES)}-byte durable-file bound`);
      }
      const bytes = await handle.readFile();
      const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (!Array.isArray(parsed)) {
        throw new DomainError('STORE_QUARANTINED', 'profile index is not an array');
      }
      // Enforce the declared per-index count bound on EVERY read (not only before append), so an oversized
      // (grown/tampered/replayed) index fails closed before any record is trusted (review B08).
      if (parsed.length > maxRecords) {
        throw new DomainError('STORE_QUARANTINED', `profile index ${relative} exceeds its ${String(maxRecords)}-record bound`);
      }
      return parsed.map((item, index) => {
        try {
          return parse(item, index);
        } catch (error) {
          if (error instanceof DomainError && error.code === 'STORE_QUARANTINED') throw error;
          throw new DomainError('STORE_QUARANTINED', `profile index ${relative} record ${String(index)} failed strict validation`);
        }
      });
    } finally {
      await handle.close();
    }
  }

  private async writeJsonArray(relative: string, value: readonly unknown[]): Promise<void> {
    await this.ensureParent(relative);
    const target = await resolveContainedPath(this.stateRoot, relative, { allowMissingLeaf: true });
    await writeAtomicCanonicalJson(target, value);
  }

  private async ensureParent(relative: string): Promise<void> {
    const parent = path.posix.dirname(relative);
    await ensurePrivateDirectory(this.stateRoot, parent);
  }
}

/** The canonical root key (design §10). Never contains raw content; derived from validated identities. */
export function rootKeyHash(
  profileId: string,
  workspaceId: string,
  appId: string,
  channelId: string,
  rootTs: string,
): string {
  return hashCanonical({ profileId, workspaceId, appId, channelId, rootTs });
}
