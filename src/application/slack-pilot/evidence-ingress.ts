// AS1 Multi-Team Slack Pilot — profile-specific Advisor evidence ingress and Git-provenance verification.
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_DESIGN.md §13 (evidence source +
// ACK/intake/outbound/result); docs/security/AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md §11
// (evidence authority security). AS1 evidence is committed/pushed Git evidence under two non-overlapping
// prefixes fixed by the selected pointer-delivery grant. A Slack field cannot supply a repository or path.
// Each new evidence path must have exactly one Git-addition history, be upstream-ancestral, descend from
// the grant snapshot chains, and remain byte-identical after first acceptance. Later evidence appearing
// before its predecessor is an authority defect, not a queue hint. Rewrite, deletion, dirty state, wrong
// ancestry, premature stage, wrong profile, wrong actor lineage, or wrong root quarantines the profile.
// Foundation evidence must carry roleInstanceId foundation-advisor-20260714-01; the historical
// foundation-advisor join key is invalid for Foundation output.
import { DomainError, type SourceArtifactRef } from '../../contracts/types.js';
import { assertExactKeys, assertRecord, requireEnum, requireInteger } from '../../contracts/validation.js';
import { hashCanonical } from '../../persistence/file-store/hashing.js';
import {
  parseContainedPointerRef,
  requireArtifactRef,
  requireBoundedMessageText,
  requireGitCommit,
  requireOpaqueId,
  requireSha256,
  requireUtc,
  type As1PilotReceiveGrantV1,
  type As1PointerDeliveryGrantV1,
} from './contracts.js';
import { FOUNDATION_FORBIDDEN_ROLE_INSTANCE_ID, type As1Profile } from './profiles.js';
import type {
  As1AcceptedEvidenceRecordV1,
  As1DeliveryAuthorityConsumptionV1,
  As1PilotReceiveGrantStateV1,
  As1ProfileInboundStore,
  As1RootCorrelationV1,
  As1TmuxDeliveryRecordV1,
} from './inbound-store.js';

export type As1EvidenceKind = 'ACK' | 'INTAKE' | 'QUESTION' | 'RESULT';

/** A committed Git evidence reference; the only trusted source of an evidence artifact (security §4.5). */
export interface As1EvidenceRef {
  readonly repositoryId: string;
  readonly sourceCommit: string;
  readonly path: string;
  readonly blobSha256: string;
}

/**
 * Result of the real read-only Git/content provenance check (design §13). `contentVerified` means the exact
 * committed blob's bytes hash to the claimed blobSha256; `descendsFromBothSnapshots` means the source commit
 * descends from BOTH frozen authority snapshot commits. All must hold for acceptance.
 */
export interface As1EvidenceProvenance {
  readonly upstreamAncestral: boolean;
  readonly firstAddition: boolean;
  readonly dirty: boolean;
  readonly contentVerified: boolean;
  readonly descendsFromBothSnapshots: boolean;
}

/**
 * Read-only Git provenance verifier. Uses closed argv, shell:false, fixed env, bounded output. The two frozen
 * authority snapshot commits are passed on EVERY call (from the accepted authority), not baked into a
 * separately-constructed verifier, so the descent proof is always bound to this evidence's exact authority.
 */
export interface As1GitProvenanceVerifier {
  verify(ref: As1EvidenceRef, snapshotCommits: readonly string[]): Promise<As1EvidenceProvenance>;
}

/** The immutable authority chain the evidence must bind to — taken from the accepted pointer-delivery grant. */
export interface As1EvidenceAuthority {
  readonly authorityRepositoryId: string;
  /** The non-overlapping evidence prefix fixed by the selected pointer-delivery grant (design §13). */
  readonly evidencePrefix: string;
  /** The exact accepted intake / source event / pointer hash the evidence must bind to (from the store state). */
  readonly intakeId: string;
  readonly sourceEventId: string;
  readonly pointerHash: string;
  /** The immutable root correlation Slack timestamp — used to idempotently open the profile-local question. */
  readonly rootTs: string;
  /** The accepted receive grant's expiry — the exact bound the profile-local pending question inherits. */
  readonly receiveGrantExpiresAt: string;
  /**
   * A typed, construction-trusted snapshot of the accepted immutable authority/store state (the accepted
   * receive-grant binding, pilot, pointer-delivery grant, root correlation, pointer ref, terminal transport
   * journal ref/hash, and the atomically-consumed delivery grant + lease). The composition derives it from
   * those exact records; every ACK binding is compared against it (review B06).
   */
  readonly acceptedAck: As1AckBindings;
  /** The two grant source commits the evidence commit MUST descend from (bound into the verifier snapshots). */
  readonly receiveGrantSourceCommit: string;
  readonly pointerDeliveryGrantSourceCommit: string;
}

/** Persist the durable profile latch (a stable bounded reason code). Backed by the canonical control record. */
export type As1EvidenceLatch = (reasonCode: string) => Promise<void>;

interface As1EvidenceCommon {
  readonly schemaVersion: string;
  readonly evidenceId: string;
  readonly intakeId: string;
  readonly advisorTeam: string;
  readonly actorId: string;
  readonly roleInstanceId: string;
}

/** The full per-kind evidence envelope — every reviewed field is retained and validated (review B06). */
/** The full §13.1 ACK authority bindings the evidence carries and the ingress correlates against accepted state. */
export interface As1AckBindings {
  readonly receiveGrantId: string;
  readonly receiveGrantBindingHash: string;
  readonly pilotId: string;
  readonly pointerDeliveryGrantId: string;
  readonly rootCorrelationHash: string;
  readonly pointerArtifactRef: string;
  readonly transportJournalRef: string;
  readonly transportJournalHash: string;
  readonly consumedDeliveryGrantId: string;
  readonly consumedLeaseId: string;
}

/**
 * The embedded, closed RESULT outbound record (design §13.3). It is validated at ingest and B07 sends EXACTLY
 * this parsed record — there is no pre-send reconstruction and therefore no send-time circular dependency. Its
 * durable result reference is the repository's canonical `SourceArtifactRef` (repository/commit/path/sha256).
 */
export interface As1ResultOutboundRecord {
  readonly kind: 'RESULT';
  readonly intakeId: string;
  readonly resultId: string;
  readonly terminalStatus: string;
  readonly resultArtifact: SourceArtifactRef;
  readonly summary: string;
}

export type As1EvidenceEnvelope =
  | (As1EvidenceCommon & As1AckBindings & { readonly kind: 'ACK'; readonly sourceEventId: string; readonly pointerHash: string; readonly advisorAckId: string; readonly acknowledgedAt: string })
  | (As1EvidenceCommon & { readonly kind: 'INTAKE'; readonly advisorAckId: string; readonly acceptedAckEvidenceId: string; readonly acceptedAckEnvelopeHash: string; readonly classification: string; readonly recordedAt: string })
  | (As1EvidenceCommon & { readonly kind: 'QUESTION'; readonly questionId: string; readonly questionKind: string; readonly expectedResponseKind: 'CLARIFICATION' | 'DECISION_RESPONSE'; readonly questionText: string; readonly recordedAt: string })
  | (As1EvidenceCommon & {
      readonly kind: 'RESULT';
      readonly resultId: string;
      readonly terminalStatus: string;
      readonly acceptedIntakeEvidenceId: string;
      readonly acceptedIntakeEvidenceHash: string;
      readonly resultArtifact: SourceArtifactRef;
      readonly consumedQuestionReplyCount: number;
      readonly consumedQuestionReplySetHash: string;
      readonly outboundRecord: As1ResultOutboundRecord;
      readonly outboundRecordHash: string;
      readonly recordedAt: string;
    });

const ACK_KEYS = [
  'schemaVersion', 'evidenceId', 'profileId', 'advisorTeam', 'actorId', 'roleInstanceId', 'intakeId', 'sourceEventId',
  'pointerHash', 'advisorAckId', 'acknowledgedAt',
  // The full reviewed §13.1 authority bindings (review B06): receive grant/binding, pilot, pointer-delivery
  // grant, root correlation, pointer ref, transport journal ref/hash, and the consumed delivery grant + lease.
  'receiveGrantId', 'receiveGrantBindingHash', 'pilotId', 'pointerDeliveryGrantId', 'rootCorrelationHash',
  'pointerArtifactRef', 'transportJournalRef', 'transportJournalHash', 'consumedDeliveryGrantId', 'consumedLeaseId',
] as const;
const INTAKE_KEYS = [
  'schemaVersion', 'evidenceId', 'profileId', 'advisorTeam', 'actorId', 'roleInstanceId', 'intakeId',
  'advisorAckId', 'acceptedAckEvidenceId', 'acceptedAckEnvelopeHash', 'classification', 'recordedAt',
] as const;
const QUESTION_KEYS = [
  'schemaVersion', 'evidenceId', 'profileId', 'advisorTeam', 'actorId', 'roleInstanceId', 'intakeId',
  'questionId', 'questionKind', 'expectedResponseKind', 'questionText', 'recordedAt',
] as const;
const RESULT_KEYS = [
  'schemaVersion', 'evidenceId', 'profileId', 'advisorTeam', 'actorId', 'roleInstanceId', 'intakeId',
  'resultId', 'terminalStatus', 'acceptedIntakeEvidenceId', 'acceptedIntakeEvidenceHash', 'resultArtifact',
  'consumedQuestionReplyCount', 'consumedQuestionReplySetHash', 'outboundRecord', 'outboundRecordHash', 'recordedAt',
] as const;

const SCHEMA_VERSIONS: Record<As1EvidenceKind, string> = {
  ACK: 'agent-office.as1-advisor-ack.v1',
  INTAKE: 'agent-office.as1-advisor-intake.v1',
  QUESTION: 'agent-office.as1-advisor-outbound.v1',
  RESULT: 'agent-office.as1-advisor-result.v1',
};

const KEY_SETS: Record<As1EvidenceKind, readonly string[]> = {
  ACK: ACK_KEYS,
  INTAKE: INTAKE_KEYS,
  QUESTION: QUESTION_KEYS,
  RESULT: RESULT_KEYS,
};

export const INTAKE_CLASSIFICATIONS = [
  'ACCEPTED_NEW_MISSION',
  'CLARIFICATION_RECORDED',
  'DECISION_RESPONSE_RECORDED',
  'REJECTED_BY_ADVISOR',
] as const;

const SOURCE_ARTIFACT_REF_KEYS = ['repository', 'commit', 'path', 'sha256'] as const;

/**
 * Parse the repository's canonical `SourceArtifactRef` (src/contracts/types.ts): exact keys repository/commit/
 * path/sha256. This is the reviewed contract shape — NOT the verifier-internal As1EvidenceRef. AS1 authority is
 * `agent-office`, so this does not reuse the foundation-docs-only tmux parser.
 */
function requireSourceArtifactRef(value: unknown, label: string): SourceArtifactRef {
  assertRecord(value, label);
  assertExactKeys(value, SOURCE_ARTIFACT_REF_KEYS, label);
  return {
    repository: requireOpaqueId(value.repository, `${label}.repository`),
    commit: requireGitCommit(value.commit, `${label}.commit`),
    path: requireArtifactRef(value.path, `${label}.path`),
    sha256: requireSha256(value.sha256, `${label}.sha256`),
  };
}

/**
 * Map a validated canonical `SourceArtifactRef` into the verifier-internal `As1EvidenceRef` at the provenance
 * boundary — a pure field rename (repository→repositoryId, commit→sourceCommit, sha256→blobSha256) with no
 * revalidation. Kept separate so ACK/pointer evidence refs are never re-shaped and the canonical contract is not
 * redefined; the equality-preserving field map is exercised directly in tests.
 */
export function sourceArtifactRefToEvidenceRef(ref: SourceArtifactRef): As1EvidenceRef {
  return { repositoryId: ref.repository, sourceCommit: ref.commit, path: ref.path, blobSha256: ref.sha256 };
}

const RESULT_OUTBOUND_KEYS = ['kind', 'intakeId', 'resultId', 'terminalStatus', 'resultArtifact', 'summary'] as const;

/** Parse the embedded closed RESULT outbound record (design §13.3): exact keys, bounded summary, exact artifact. */
function requireResultOutboundRecord(value: unknown, label: string): As1ResultOutboundRecord {
  assertRecord(value, label);
  assertExactKeys(value, RESULT_OUTBOUND_KEYS, label);
  if (value.kind !== 'RESULT') {
    throw new DomainError('INVALID_SCHEMA', `${label}.kind must be RESULT`);
  }
  return {
    kind: 'RESULT',
    intakeId: requireOpaqueId(value.intakeId, `${label}.intakeId`),
    resultId: requireOpaqueId(value.resultId, `${label}.resultId`),
    terminalStatus: requireOpaqueId(value.terminalStatus, `${label}.terminalStatus`),
    resultArtifact: requireSourceArtifactRef(value.resultArtifact, `${label}.resultArtifact`),
    summary: requireBoundedMessageText(value.summary, `${label}.summary`),
  };
}

/** True only when two canonical SourceArtifactRefs are byte-identical on every field. */
function sourceArtifactRefEqual(a: SourceArtifactRef, b: SourceArtifactRef): boolean {
  return a.repository === b.repository && a.commit === b.commit && a.path === b.path && a.sha256 === b.sha256;
}

/**
 * Validate an evidence record against its EXACT full schema, the selected profile's immutable lineage, and
 * every reviewed per-kind field (review B06). The profileId, advisorTeam, actorId, and roleInstanceId must
 * equal the closed profile; Foundation may never carry the historical foundation-advisor join key.
 */
export function parseEvidenceEnvelope(kind: As1EvidenceKind, value: unknown, profile: As1Profile): As1EvidenceEnvelope {
  assertRecord(value, `as1 advisor ${kind} evidence`);
  assertExactKeys(value, KEY_SETS[kind], `as1 advisor ${kind} evidence`);
  if (value.schemaVersion !== SCHEMA_VERSIONS[kind]) {
    throw new DomainError('INVALID_SCHEMA', `as1 advisor ${kind} evidence schemaVersion is unsupported`);
  }
  if (value.profileId !== profile.profileId) {
    throw new DomainError('FORBIDDEN_TARGET', `as1 advisor ${kind} evidence names a different profile`);
  }
  const advisorTeam = requireOpaqueId(value.advisorTeam, `${kind}.advisorTeam`);
  const actorId = requireOpaqueId(value.actorId, `${kind}.actorId`);
  const roleInstanceId = requireOpaqueId(value.roleInstanceId, `${kind}.roleInstanceId`);
  if (advisorTeam !== profile.advisorTeam || actorId !== profile.actorId || roleInstanceId !== profile.roleInstanceId) {
    throw new DomainError('UNAUTHORIZED_ACTOR', `as1 advisor ${kind} evidence lineage does not match the profile`);
  }
  if (profile.profileId === 'FOUNDATION_ADVISOR' && roleInstanceId === FOUNDATION_FORBIDDEN_ROLE_INSTANCE_ID) {
    throw new DomainError('UNAUTHORIZED_ACTOR', 'foundation evidence must not use the historical join key');
  }
  const common: As1EvidenceCommon = {
    schemaVersion: SCHEMA_VERSIONS[kind],
    evidenceId: requireOpaqueId(value.evidenceId, `${kind}.evidenceId`),
    intakeId: requireOpaqueId(value.intakeId, `${kind}.intakeId`),
    advisorTeam,
    actorId,
    roleInstanceId,
  };
  switch (kind) {
    case 'ACK':
      return {
        ...common,
        kind: 'ACK',
        sourceEventId: requireOpaqueId(value.sourceEventId, 'ACK.sourceEventId'),
        pointerHash: requireSha256(value.pointerHash, 'ACK.pointerHash'),
        advisorAckId: requireOpaqueId(value.advisorAckId, 'ACK.advisorAckId'),
        acknowledgedAt: requireUtc(value.acknowledgedAt, 'ACK.acknowledgedAt'),
        receiveGrantId: requireOpaqueId(value.receiveGrantId, 'ACK.receiveGrantId'),
        receiveGrantBindingHash: requireSha256(value.receiveGrantBindingHash, 'ACK.receiveGrantBindingHash'),
        pilotId: requireOpaqueId(value.pilotId, 'ACK.pilotId'),
        pointerDeliveryGrantId: requireOpaqueId(value.pointerDeliveryGrantId, 'ACK.pointerDeliveryGrantId'),
        rootCorrelationHash: requireSha256(value.rootCorrelationHash, 'ACK.rootCorrelationHash'),
        pointerArtifactRef: requireArtifactRef(value.pointerArtifactRef, 'ACK.pointerArtifactRef'),
        transportJournalRef: requireArtifactRef(value.transportJournalRef, 'ACK.transportJournalRef'),
        transportJournalHash: requireSha256(value.transportJournalHash, 'ACK.transportJournalHash'),
        consumedDeliveryGrantId: requireOpaqueId(value.consumedDeliveryGrantId, 'ACK.consumedDeliveryGrantId'),
        consumedLeaseId: requireOpaqueId(value.consumedLeaseId, 'ACK.consumedLeaseId'),
      };
    case 'INTAKE':
      return {
        ...common,
        kind: 'INTAKE',
        advisorAckId: requireOpaqueId(value.advisorAckId, 'INTAKE.advisorAckId'),
        acceptedAckEvidenceId: requireOpaqueId(value.acceptedAckEvidenceId, 'INTAKE.acceptedAckEvidenceId'),
        acceptedAckEnvelopeHash: requireSha256(value.acceptedAckEnvelopeHash, 'INTAKE.acceptedAckEnvelopeHash'),
        classification: requireEnum(value.classification, INTAKE_CLASSIFICATIONS, 'INTAKE.classification'),
        recordedAt: requireUtc(value.recordedAt, 'INTAKE.recordedAt'),
      };
    case 'QUESTION':
      return {
        ...common,
        kind: 'QUESTION',
        questionId: requireOpaqueId(value.questionId, 'QUESTION.questionId'),
        questionKind: requireOpaqueId(value.questionKind, 'QUESTION.questionKind'),
        expectedResponseKind: requireEnum(value.expectedResponseKind, ['CLARIFICATION', 'DECISION_RESPONSE'] as const, 'QUESTION.expectedResponseKind'),
        questionText: requireBoundedMessageText(value.questionText, 'QUESTION.questionText'),
        recordedAt: requireUtc(value.recordedAt, 'QUESTION.recordedAt'),
      };
    case 'RESULT':
      return parseResultEnvelope(common, value);
    default: {
      const exhaustive: never = kind;
      throw new DomainError('INVALID_SCHEMA', `unknown evidence kind ${String(exhaustive)}`);
    }
  }
}

/**
 * Parse and internally validate the closed RESULT envelope (design §13.3): the exact durable result
 * SourceArtifactRef, the consumed-question-reply count + canonical set hash, and the embedded closed RESULT
 * outbound record — whose fields must agree with the RESULT and whose canonical hash must equal outboundRecordHash.
 */
function parseResultEnvelope(common: As1EvidenceCommon, value: Record<string, unknown>): As1EvidenceEnvelope {
  const resultId = requireOpaqueId(value.resultId, 'RESULT.resultId');
  const terminalStatus = requireOpaqueId(value.terminalStatus, 'RESULT.terminalStatus');
  const resultArtifact = requireSourceArtifactRef(value.resultArtifact, 'RESULT.resultArtifact');
  const outboundRecord = requireResultOutboundRecord(value.outboundRecord, 'RESULT.outboundRecord');
  const outboundRecordHash = requireSha256(value.outboundRecordHash, 'RESULT.outboundRecordHash');
  // The embedded outbound record must agree with the RESULT it belongs to, and its canonical hash must bind it.
  if (
    outboundRecord.intakeId !== common.intakeId ||
    outboundRecord.resultId !== resultId ||
    outboundRecord.terminalStatus !== terminalStatus ||
    !sourceArtifactRefEqual(outboundRecord.resultArtifact, resultArtifact)
  ) {
    throw new DomainError('INVALID_SCHEMA', 'RESULT.outboundRecord fields disagree with the RESULT evidence');
  }
  if (hashCanonical(outboundRecord) !== outboundRecordHash) {
    throw new DomainError('INVALID_SCHEMA', 'RESULT.outboundRecordHash does not bind the embedded outbound record');
  }
  return {
    ...common,
    kind: 'RESULT',
    resultId,
    terminalStatus,
    acceptedIntakeEvidenceId: requireOpaqueId(value.acceptedIntakeEvidenceId, 'RESULT.acceptedIntakeEvidenceId'),
    acceptedIntakeEvidenceHash: requireSha256(value.acceptedIntakeEvidenceHash, 'RESULT.acceptedIntakeEvidenceHash'),
    resultArtifact,
    consumedQuestionReplyCount: requireInteger(value.consumedQuestionReplyCount, 'RESULT.consumedQuestionReplyCount', 0),
    consumedQuestionReplySetHash: requireSha256(value.consumedQuestionReplySetHash, 'RESULT.consumedQuestionReplySetHash'),
    outboundRecord,
    outboundRecordHash,
    recordedAt: requireUtc(value.recordedAt, 'RESULT.recordedAt'),
  };
}

/** Compare every §13.1 ACK binding to the accepted authority snapshot; returns a stable code on any mismatch. */
function ackBindingMismatch(ack: As1AckBindings, accepted: As1AckBindings): string | null {
  const fields: readonly (keyof As1AckBindings)[] = [
    'receiveGrantId',
    'receiveGrantBindingHash',
    'pilotId',
    'pointerDeliveryGrantId',
    'rootCorrelationHash',
    'pointerArtifactRef',
    'transportJournalRef',
    'transportJournalHash',
    'consumedDeliveryGrantId',
    'consumedLeaseId',
  ];
  for (const field of fields) {
    if (ack[field] !== accepted[field]) return `EVIDENCE_ACK_BINDING_${field.replace(/([a-z])([A-Z])/gu, '$1_$2').toUpperCase()}`;
  }
  return null;
}

/**
 * The per-kind canonical correlation facts persisted with an accepted evidence record so a later stage can
 * bind the EXACT referenced id/fact of its predecessor (review B06). Byte-derived from the reviewed envelope,
 * so an equal envelopeHash implies an equal correlation — cross-stage checks read these persisted facts.
 */
function correlationOf(envelope: As1EvidenceEnvelope): Readonly<Record<string, string>> {
  switch (envelope.kind) {
    case 'ACK':
      return { advisorAckId: envelope.advisorAckId, sourceEventId: envelope.sourceEventId, pointerHash: envelope.pointerHash };
    case 'INTAKE':
      return {
        advisorAckId: envelope.advisorAckId,
        acceptedAckEvidenceId: envelope.acceptedAckEvidenceId,
        classification: envelope.classification,
      };
    case 'QUESTION':
      return { questionId: envelope.questionId, questionKind: envelope.questionKind, expectedResponseKind: envelope.expectedResponseKind };
    case 'RESULT':
      return {
        resultId: envelope.resultId,
        terminalStatus: envelope.terminalStatus,
        resultArtifactPath: envelope.resultArtifact.path,
        resultArtifactSha256: envelope.resultArtifact.sha256,
      };
    default: {
      const exhaustive: never = envelope;
      throw new DomainError('INVALID_SCHEMA', `unknown evidence kind ${String(exhaustive)}`);
    }
  }
}

/**
 * Bind a genuinely-new stage to the EXACT persisted facts of its accepted predecessors (review B06). This runs
 * only after the closed stage order already proved the predecessors are present, so every branch here is a
 * referenced-id/fact check, not a presence check:
 *   • INTAKE  → its advisorAckId + acceptedAckEvidenceId + acceptedAckEnvelopeHash must match the EXACT accepted
 *     ACK checkpoint record (id + canonical envelope hash), not merely any ACK.
 *   • QUESTION → its questionId must not collide with an already-accepted, differing question.
 *   • RESULT  → its acceptedIntakeEvidenceId + acceptedIntakeEvidenceHash must match the EXACT accepted INTAKE
 *     checkpoint, and that intake must be one the Advisor accepted, never one it rejected.
 * A wrong referenced fact returns a stable bounded code; the caller quarantines AND durably latches.
 */
function bindToAcceptedChain(
  envelope: As1EvidenceEnvelope,
  acceptedForIntake: readonly As1AcceptedEvidenceRecordV1[],
): string | null {
  switch (envelope.kind) {
    case 'ACK':
      return null;
    case 'INTAKE': {
      const ack = acceptedForIntake.find((e) => e.evidenceKind === 'ACK');
      if (ack === undefined) return 'EVIDENCE_ORDER_INTAKE_NEEDS_ACK';
      if (envelope.advisorAckId !== ack.correlation.advisorAckId) return 'EVIDENCE_INTAKE_ACK_MISMATCH';
      if (envelope.acceptedAckEvidenceId !== ack.evidenceId) return 'EVIDENCE_INTAKE_ACK_EVIDENCE_MISMATCH';
      if (envelope.acceptedAckEnvelopeHash !== ack.envelopeHash) return 'EVIDENCE_INTAKE_ACK_ENVELOPE_MISMATCH';
      return null;
    }
    case 'QUESTION': {
      const clash = acceptedForIntake.find(
        (e) => e.evidenceKind === 'QUESTION' && e.correlation.questionId === envelope.questionId && e.evidenceId !== envelope.evidenceId,
      );
      return clash === undefined ? null : 'EVIDENCE_QUESTION_DIVERGENT';
    }
    case 'RESULT': {
      const intake = acceptedForIntake.find((e) => e.evidenceKind === 'INTAKE');
      if (intake === undefined) return 'EVIDENCE_ORDER_RESULT_NEEDS_INTAKE';
      if (envelope.acceptedIntakeEvidenceId !== intake.evidenceId) return 'EVIDENCE_RESULT_INTAKE_EVIDENCE_MISMATCH';
      if (envelope.acceptedIntakeEvidenceHash !== intake.envelopeHash) return 'EVIDENCE_RESULT_INTAKE_ENVELOPE_MISMATCH';
      if (intake.correlation.classification === 'REJECTED_BY_ADVISOR') return 'EVIDENCE_RESULT_INTAKE_NOT_ACCEPTED';
      return null;
    }
    default: {
      const exhaustive: never = envelope;
      throw new DomainError('INVALID_SCHEMA', `unknown evidence kind ${String(exhaustive)}`);
    }
  }
}

/**
 * The ACTUAL typed accepted artifacts the production composition derives the immutable evidence authority from
 * (review B06): the accepted receive grant AND its post-bind state, the accepted pointer-delivery grant, the
 * terminal (`TRANSPORT_RECORDED`) tmux delivery journal record whose bound facts carry the delivery lineage, the
 * accepted root correlation, the durable transport-journal artifact reference, and the single atomic
 * delivery-authority consumption. No truncated shapes, no hand-assembled source-commit strings, no free
 * authority snapshot: every authority field is read from one of these typed artifacts.
 */
export interface As1AcceptedAuthorityRecords {
  readonly receiveGrant: As1PilotReceiveGrantV1;
  readonly receiveGrantState: As1PilotReceiveGrantStateV1;
  readonly pointerDeliveryGrant: As1PointerDeliveryGrantV1;
  readonly terminalDelivery: As1TmuxDeliveryRecordV1;
  readonly rootCorrelation: As1RootCorrelationV1;
  readonly consumption: As1DeliveryAuthorityConsumptionV1;
}

/** The three closed BOUND receive-grant phases — a `*_UNBOUND`/`LATCHED` state is never an accepted binding. */
const AS1_BOUND_RECEIVE_PHASES: ReadonlySet<string> = new Set(['ROOT_BOUND', 'EXPIRED_BOUND', 'RETIRED_BOUND']);

/**
 * The concrete PRODUCTION derivation of the immutable evidence authority (including the §13.1 `acceptedAck`
 * snapshot) from the ACTUAL typed accepted artifacts (review B06). It fails closed on ANY inconsistency between
 * those artifacts, recomputes the root-correlation hash with the EXACT service materialization formula, verifies
 * the pointer-delivery-grant snapshot hash and the transport-journal hash against the canonical bytes, and
 * requires a terminal `TRANSPORT_RECORDED` delivery — so a mismatched or partial set can never yield an authority
 * the ingress would then compare evidence against. This is the single source of the `acceptedAck` snapshot.
 */
export function buildEvidenceAuthority(records: As1AcceptedAuthorityRecords): As1EvidenceAuthority {
  const { receiveGrant: rg, receiveGrantState: st, pointerDeliveryGrant: pdg, terminalDelivery: td, rootCorrelation: root, consumption: cons } = records;
  const facts = td.boundFacts;
  const requireEqual = (a: string, b: string, code: string): void => {
    if (a !== b) throw new DomainError('STORE_QUARANTINED', `evidence authority derivation inconsistency: ${code}`);
  };

  // 1. The delivery journal must be terminally delivered (design §12.7), never a nonterminal/reconciled phase.
  if (td.phase !== 'TRANSPORT_RECORDED') {
    throw new DomainError('STORE_QUARANTINED', 'evidence authority derivation requires a TRANSPORT_RECORDED delivery journal');
  }

  // 2. Profile identity/lineage agree across receive grant, pointer-delivery grant, and delivery facts.
  requireEqual(rg.profileId, pdg.profileId, 'grant/pdg profileId');
  requireEqual(pdg.profileId, facts.profileId, 'pdg/facts profileId');
  requireEqual(pdg.advisorTeam, facts.advisorTeam, 'pdg/facts advisorTeam');
  requireEqual(pdg.actorId, facts.actorId, 'pdg/facts actorId');
  requireEqual(pdg.roleInstanceId, facts.roleInstanceId, 'pdg/facts roleInstanceId');

  // 3. Receive grant + its post-bind state + pointer-delivery grant + facts agree on the receive-grant binding.
  requireEqual(st.receiveGrantId, rg.receiveGrantId, 'state/grant receiveGrantId');
  requireEqual(st.pilotId, rg.pilotId, 'state/grant pilotId');
  requireEqual(pdg.receiveGrantId, rg.receiveGrantId, 'pdg/grant receiveGrantId');
  requireEqual(facts.receiveGrantId, rg.receiveGrantId, 'facts/grant receiveGrantId');
  requireEqual(root.receiveGrantId, rg.receiveGrantId, 'root/grant receiveGrantId');
  requireEqual(pdg.pilotId, rg.pilotId, 'pdg/grant pilotId');
  requireEqual(facts.pilotId, rg.pilotId, 'facts/grant pilotId');
  requireEqual(st.stateHash, pdg.receiveGrantBindingHash, 'state/pdg receiveGrantBindingHash');
  requireEqual(facts.receiveGrantBindingHash, pdg.receiveGrantBindingHash, 'facts/pdg receiveGrantBindingHash');
  requireEqual(root.bindingStateHash, pdg.receiveGrantBindingHash, 'root/pdg bindingStateHash');

  // 3b. The receive-grant state must be the ACTUAL accepted BOUND state, not merely a matching stateHash: same
  //     profile, root slot consumed, a bound (never *_UNBOUND / LATCHED) phase, and every bound-lineage field
  //     present and equal to the root correlation. boundAt must be a canonical UTC strictly before grant expiry.
  requireEqual(st.profileId, rg.profileId, 'state/grant profileId');
  if (!st.rootSlotConsumed) {
    throw new DomainError('STORE_QUARANTINED', 'evidence authority derivation: receive-grant state root slot is not consumed');
  }
  if (!AS1_BOUND_RECEIVE_PHASES.has(st.phase)) {
    throw new DomainError('STORE_QUARANTINED', 'evidence authority derivation: receive-grant state is not in a bound phase');
  }
  const requireBound = (value: string | null, field: string): string => {
    if (value === null) {
      throw new DomainError('STORE_QUARANTINED', `evidence authority derivation: receive-grant state ${field} is not bound`);
    }
    return value;
  };
  const boundSourceEventId = requireBound(st.boundSourceEventId, 'boundSourceEventId');
  const boundRootTs = requireBound(st.boundRootTs, 'boundRootTs');
  const boundRootKeyHash = requireBound(st.boundRootKeyHash, 'boundRootKeyHash');
  const boundAt = requireBound(st.boundAt, 'boundAt');
  requireBound(st.boundReceiptArtifactRef, 'boundReceiptArtifactRef');
  requireBound(st.boundReceiptArtifactHash, 'boundReceiptArtifactHash');
  requireBound(st.boundMessageArtifactHash, 'boundMessageArtifactHash');
  requireEqual(boundSourceEventId, root.sourceEventId, 'state/root boundSourceEventId');
  requireEqual(boundRootTs, root.rootTs, 'state/root boundRootTs');
  requireEqual(boundRootKeyHash, root.rootKeyHash, 'state/root boundRootKeyHash');
  try {
    requireUtc(boundAt, 'receive-grant state boundAt');
  } catch {
    throw new DomainError('STORE_QUARANTINED', 'evidence authority derivation: receive-grant state boundAt is not a canonical UTC timestamp');
  }
  if (!(Date.parse(boundAt) < Date.parse(rg.expiresAt))) {
    throw new DomainError('STORE_QUARANTINED', 'evidence authority derivation: receive-grant state boundAt is not before the grant expiry');
  }

  // 4. Intake and source event agree across root correlation, pointer-delivery grant, and delivery facts.
  requireEqual(root.intakeId, pdg.intakeId, 'root/pdg intakeId');
  requireEqual(facts.intakeId, pdg.intakeId, 'facts/pdg intakeId');
  requireEqual(root.sourceEventId, pdg.sourceEventId, 'root/pdg sourceEventId');
  requireEqual(facts.sourceEventId, pdg.sourceEventId, 'facts/pdg sourceEventId');

  // 5. The root-correlation hash is recomputed with the EXACT service materialization formula (service.ts) and
  //    must equal the pointer-delivery grant's committed value — the two are NOT interchangeable with rootKeyHash.
  const rootCorrelationHash = hashCanonical({
    rootKeyHash: root.rootKeyHash,
    bindingStateHash: root.bindingStateHash,
    sourceEventId: root.sourceEventId,
    rootTs: root.rootTs,
    intakeId: root.intakeId,
  });
  requireEqual(rootCorrelationHash, pdg.rootCorrelationHash, 'rootCorrelationHash service formula');

  // 6. Pointer ref/hash and every governance/registry/global-control/profile-latch snapshot hash agree across
  //    the receive grant, the pointer-delivery grant, and the delivery facts; the pointer-delivery-grant snapshot
  //    hash the facts carry must equal the canonical bytes of THIS pointer-delivery grant (B04 lease invariant).
  requireEqual(facts.pointerHash, pdg.pointerHash, 'facts/pdg pointerHash');
  requireEqual(rg.governanceSnapshotHash, pdg.governanceSnapshotHash, 'grant/pdg governanceSnapshotHash');
  requireEqual(rg.registrySnapshotHash, pdg.registrySnapshotHash, 'grant/pdg registrySnapshotHash');
  requireEqual(rg.globalControlSnapshotHash, pdg.globalControlSnapshotHash, 'grant/pdg globalControlSnapshotHash');
  requireEqual(rg.profileLatchSnapshotHash, pdg.profileLatchSnapshotHash, 'grant/pdg profileLatchSnapshotHash');
  requireEqual(facts.governanceSnapshotHash, pdg.governanceSnapshotHash, 'facts/pdg governanceSnapshotHash');
  requireEqual(facts.registrySnapshotHash, pdg.registrySnapshotHash, 'facts/pdg registrySnapshotHash');
  requireEqual(facts.globalControlSnapshotHash, pdg.globalControlSnapshotHash, 'facts/pdg globalControlSnapshotHash');
  requireEqual(facts.profileLatchSnapshotHash, pdg.profileLatchSnapshotHash, 'facts/pdg profileLatchSnapshotHash');
  requireEqual(facts.pointerDeliveryGrantSnapshotHash, hashCanonical(pdg), 'facts pointerDeliveryGrantSnapshotHash');

  // 7. The single atomic consumption binds THIS pointer-delivery grant and the lease the facts were bound to.
  requireEqual(cons.pointerDeliveryGrantId, pdg.pointerDeliveryGrantId, 'consumption/pdg pointerDeliveryGrantId');
  requireEqual(cons.pointerDeliveryGrantId, facts.pointerDeliveryGrantId, 'consumption/facts pointerDeliveryGrantId');
  requireEqual(cons.leaseId, facts.leaseId, 'consumption/facts leaseId');

  // 8. Both grants agree on the authority repository AND the authority root; the two frozen source commits come
  //    from the typed grants.
  requireEqual(rg.authorityRepositoryId, pdg.authorityRepositoryId, 'grant/pdg authorityRepositoryId');
  requireEqual(rg.authorityRootId, pdg.authorityRootId, 'grant/pdg authorityRootId');

  // 9. The terminal delivery journal's deliveryId MUST equal the deliveryId the pointer-delivery grant's own
  //    pointerArtifactRef encodes, parsed by the SINGLE shared contained-pointer parser (the same one the exact
  //    tmux transport uses). The transport-journal REF is then DERIVED from the profile-local store layout — never
  //    a free caller string — and the HASH is recomputed from the canonical terminal-delivery record bytes.
  const pointer = parseContainedPointerRef(pdg);
  requireEqual(td.deliveryId, pointer.deliveryId, 'terminalDelivery/pdg deliveryId');
  const transportJournalRef = `indexes/as1-slack-pilot/profiles/${pointer.profileStateSlug}/tmux-delivery.json`;

  const acceptedAck: As1AckBindings = {
    receiveGrantId: rg.receiveGrantId,
    receiveGrantBindingHash: pdg.receiveGrantBindingHash,
    pilotId: rg.pilotId,
    pointerDeliveryGrantId: pdg.pointerDeliveryGrantId,
    rootCorrelationHash,
    pointerArtifactRef: pdg.pointerArtifactRef,
    transportJournalRef,
    // Recompute the journal hash from the canonical terminal-delivery record bytes — never a free hash input.
    transportJournalHash: hashCanonical(td),
    consumedDeliveryGrantId: cons.pointerDeliveryGrantId,
    consumedLeaseId: cons.leaseId,
  };
  return {
    authorityRepositoryId: pdg.authorityRepositoryId,
    evidencePrefix: pdg.evidencePrefix,
    intakeId: pdg.intakeId,
    sourceEventId: pdg.sourceEventId,
    pointerHash: pdg.pointerHash,
    rootTs: root.rootTs,
    receiveGrantExpiresAt: rg.expiresAt,
    acceptedAck,
    receiveGrantSourceCommit: rg.authoritySourceCommit,
    pointerDeliveryGrantSourceCommit: pdg.authoritySourceCommit,
  };
}

export type EvidenceIngestOutcome = 'ACCEPTED' | 'QUARANTINED';

export interface EvidenceIngestResult {
  readonly outcome: EvidenceIngestOutcome;
  /** A stable bounded reason CODE on quarantine — never raw detail (review B06). `ok` on acceptance. */
  readonly reason: string;
  readonly sequence: number | null;
}

/** The RESULT variant of the closed evidence envelope union. */
type As1ResultEnvelope = Extract<As1EvidenceEnvelope, { kind: 'RESULT' }>;

/** The accepted-evidence checkpoint entry the ingress appends (matches As1ProfileInboundStore.appendAcceptedEvidence). */
interface As1AcceptedEvidenceEntry {
  readonly evidenceKind: string;
  readonly evidenceId: string;
  readonly intakeId: string;
  readonly blobSha256: string;
  readonly sourceCommit: string;
  readonly repositoryId: string;
  readonly path: string;
  readonly envelopeHash: string;
  readonly correlation: Readonly<Record<string, string>>;
}

/** Profile-bound, ordered, immutable evidence ingress. Fails closed AND durably latches on any defect. */
export class As1EvidenceIngress {
  public constructor(
    private readonly profile: As1Profile,
    private readonly store: As1ProfileInboundStore,
    private readonly verifier: As1GitProvenanceVerifier,
    private readonly authority: As1EvidenceAuthority,
    private readonly latch: As1EvidenceLatch,
  ) {}

  public async ingest(kind: As1EvidenceKind, value: unknown, ref: As1EvidenceRef): Promise<EvidenceIngestResult> {
    let envelope: As1EvidenceEnvelope;
    try {
      envelope = parseEvidenceEnvelope(kind, value, this.profile);
    } catch {
      return this.quarantine('EVIDENCE_SCHEMA_REJECTED');
    }

    // Bind the evidence ENVELOPE FACTS to the immutable accepted store state (via the grant-derived authority),
    // so a permissive/fake provenance boolean can NEVER approve an unrelated ref (review B06).
    if (envelope.intakeId !== this.authority.intakeId) {
      return this.quarantine('EVIDENCE_WRONG_INTAKE');
    }
    if (envelope.kind === 'ACK') {
      if (envelope.sourceEventId !== this.authority.sourceEventId) return this.quarantine('EVIDENCE_WRONG_SOURCE_EVENT');
      if (envelope.pointerHash !== this.authority.pointerHash) return this.quarantine('EVIDENCE_WRONG_POINTER');
      // Every §13.1 ACK binding must equal the accepted immutable authority/store snapshot (review B06).
      const mismatch = ackBindingMismatch(envelope, this.authority.acceptedAck);
      if (mismatch !== null) return this.quarantine(mismatch);
    }

    // The evidence repository/path bind to the grant-fixed authority chain; Slack cannot supply either.
    if (ref.repositoryId !== this.authority.authorityRepositoryId) {
      return this.quarantine('EVIDENCE_WRONG_REPOSITORY');
    }
    const expectedPrefix = `${this.authority.evidencePrefix}/${envelope.intakeId}/`;
    if (!ref.path.startsWith(expectedPrefix) || ref.path.includes('..')) {
      return this.quarantine('EVIDENCE_WRONG_PREFIX');
    }

    // Real read-only Git/content provenance: every gate must hold, including a byte-for-byte blob content
    // match and descent from BOTH grant source commits — passed per call from the accepted authority (review B06).
    const provenanceCode = await this.verifyProvenance(ref);
    if (provenanceCode !== null) return this.quarantine(provenanceCode);

    // The full canonical envelope hash is bound so a re-observation must match on EVERY field, not a partial
    // tuple; the per-kind canonical correlation facts are persisted so a later stage can bind the EXACT
    // referenced id/fact of an accepted predecessor rather than merely its presence (review B06).
    const entry = {
      evidenceKind: kind,
      evidenceId: envelope.evidenceId,
      intakeId: envelope.intakeId,
      blobSha256: ref.blobSha256,
      sourceCommit: ref.sourceCommit,
      repositoryId: ref.repositoryId,
      path: ref.path,
      envelopeHash: hashCanonical(value),
      correlation: correlationOf(envelope),
    };
    const accepted = await this.store.readAcceptedEvidence();

    // Re-observing the EXACT same committed evidence is a normal polling/restart case: after full provenance
    // validation, route a same-evidenceId submission through exact checkpoint equality BEFORE stage-order.
    // An exact match is idempotent ACCEPTED (and re-runs the idempotent post-accept side effect); any same-id
    // envelope/ref divergence durably latches (review B06).
    if (accepted.some((e) => e.evidenceId === envelope.evidenceId)) {
      return this.acceptAndFinalize(envelope, entry, ref, 'EVIDENCE_DUPLICATE_DIVERGENCE');
    }

    // A genuinely new evidence id must satisfy the closed stage order for its intake.
    const acceptedForIntake = accepted.filter((e) => e.intakeId === envelope.intakeId);
    const orderCode = this.checkStageOrder(kind, acceptedForIntake.map((e) => e.evidenceKind));
    if (orderCode !== null) return this.quarantine(orderCode);

    // Beyond mere stage PRESENCE, each new stage must bind the EXACT referenced facts of its accepted
    // predecessors via their persisted canonical correlation (review B06): an INTAKE binds the exact accepted
    // ACK checkpoint; a QUESTION may not diverge from an already-accepted question of the same id; a RESULT
    // binds the exact accepted INTAKE checkpoint and may only close an intake the Advisor accepted. Existing
    // stage-presence is insufficient — a wrong referenced id/fact quarantines and latches even though it exists.
    const bindingCode = bindToAcceptedChain(envelope, acceptedForIntake);
    if (bindingCode !== null) return this.quarantine(bindingCode);

    // A RESULT additionally binds its durable result SourceArtifactRef (verified through the SAME Git/content
    // authority chain) and the deterministically derived consumed-question-reply set (count + canonical hash).
    if (envelope.kind === 'RESULT') {
      const resultCode = await this.bindResult(envelope);
      if (resultCode !== null) return this.quarantine(resultCode);
    }

    return this.acceptAndFinalize(envelope, entry, ref, 'EVIDENCE_APPEND_QUARANTINED');
  }

  /**
   * Append the accepted-evidence checkpoint, then run the idempotent post-accept side effect: for a QUESTION,
   * exact-idempotently open the profile-local pending question from the authority root/expiry and the evidence
   * ref/hash (design §13.3). Running it on BOTH the fresh and re-observed paths closes the crash gap between the
   * checkpoint append and the question open on restart.
   */
  private async acceptAndFinalize(
    envelope: As1EvidenceEnvelope,
    entry: As1AcceptedEvidenceEntry,
    ref: As1EvidenceRef,
    appendFailCode: string,
  ): Promise<EvidenceIngestResult> {
    let sequence: number;
    try {
      sequence = await this.store.appendAcceptedEvidence(entry);
    } catch {
      return this.quarantine(appendFailCode);
    }
    if (envelope.kind === 'QUESTION') {
      try {
        await this.store.openQuestion({
          questionId: envelope.questionId,
          rootTs: this.authority.rootTs,
          expectedResponseKind: envelope.expectedResponseKind,
          evidenceRef: ref.path,
          evidenceHash: ref.blobSha256,
          openedAt: envelope.recordedAt,
          expiresAt: this.authority.receiveGrantExpiresAt,
        });
      } catch {
        return this.quarantine('EVIDENCE_QUESTION_OPEN_QUARANTINED');
      }
    }
    return { outcome: 'ACCEPTED', reason: 'ok', sequence };
  }

  /** Verify the RESULT's durable result artifact and bind the deterministically derived consumed-reply set. */
  private async bindResult(envelope: As1ResultEnvelope): Promise<string | null> {
    const artifactRef = sourceArtifactRefToEvidenceRef(envelope.resultArtifact);
    if (artifactRef.repositoryId !== this.authority.authorityRepositoryId) return 'EVIDENCE_RESULT_ARTIFACT_WRONG_REPOSITORY';
    const expectedPrefix = `${this.authority.evidencePrefix}/${envelope.intakeId}/`;
    if (!artifactRef.path.startsWith(expectedPrefix) || artifactRef.path.includes('..')) return 'EVIDENCE_RESULT_ARTIFACT_WRONG_PREFIX';
    const provCode = await this.verifyProvenance(artifactRef, 'EVIDENCE_RESULT_ARTIFACT');
    if (provCode !== null) return provCode;

    let replies: readonly unknown[];
    try {
      replies = await this.store.deriveConsumedQuestionReplies(this.authority.rootTs, envelope.intakeId);
    } catch {
      return 'EVIDENCE_RESULT_CONSUMED_SET_QUARANTINED';
    }
    if (envelope.consumedQuestionReplyCount !== replies.length) return 'EVIDENCE_RESULT_CONSUMED_COUNT_MISMATCH';
    if (envelope.consumedQuestionReplySetHash !== hashCanonical(replies)) return 'EVIDENCE_RESULT_CONSUMED_SET_MISMATCH';
    return null;
  }

  /**
   * Run the real read-only Git/content provenance check, passing the two frozen authority snapshot commits per
   * call (review B06). Returns a stable bounded `<prefix>_*` code on the first unmet gate, or null when all hold.
   */
  private async verifyProvenance(ref: As1EvidenceRef, prefix = 'EVIDENCE'): Promise<string | null> {
    const p = await this.verifier.verify(ref, [
      this.authority.receiveGrantSourceCommit,
      this.authority.pointerDeliveryGrantSourceCommit,
    ]);
    if (!p.upstreamAncestral) return `${prefix}_NOT_ANCESTRAL`;
    if (!p.firstAddition) return `${prefix}_NOT_FIRST_ADDITION`;
    if (p.dirty) return `${prefix}_DIRTY_TREE`;
    if (!p.contentVerified) return `${prefix}_CONTENT_MISMATCH`;
    if (!p.descendsFromBothSnapshots) return `${prefix}_SNAPSHOT_DESCENT`;
    return null;
  }

  private checkStageOrder(kind: As1EvidenceKind, priorKinds: readonly string[]): string | null {
    const hasAck = priorKinds.includes('ACK');
    const hasIntake = priorKinds.includes('INTAKE');
    const hasResult = priorKinds.includes('RESULT');
    if (hasResult) return 'EVIDENCE_ORDER_AFTER_RESULT';
    switch (kind) {
      case 'ACK':
        return priorKinds.length === 0 ? null : 'EVIDENCE_ORDER_ACK_NOT_FIRST';
      case 'INTAKE':
        if (!hasAck) return 'EVIDENCE_ORDER_INTAKE_NEEDS_ACK';
        return hasIntake ? 'EVIDENCE_ORDER_INTAKE_DUPLICATE' : null;
      case 'QUESTION':
        return hasIntake ? null : 'EVIDENCE_ORDER_QUESTION_NEEDS_INTAKE';
      case 'RESULT':
        return hasIntake ? null : 'EVIDENCE_ORDER_RESULT_NEEDS_INTAKE';
      default: {
        const exhaustive: never = kind;
        return `unknown evidence kind ${String(exhaustive)}`;
      }
    }
  }

  /**
   * Every provenance/order/append contradiction quarantines AND durably latches the profile with a stable
   * bounded reason CODE (never a raw message), so a rewrite/deletion/wrong-ancestry defect is never forgotten.
   */
  private async quarantine(reasonCode: string): Promise<EvidenceIngestResult> {
    await this.latch(reasonCode);
    return { outcome: 'QUARANTINED', reason: reasonCode, sequence: null };
  }
}
