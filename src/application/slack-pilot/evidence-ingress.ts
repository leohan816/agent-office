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
import { DomainError } from '../../contracts/types.js';
import { assertExactKeys, assertRecord, requireEnum } from '../../contracts/validation.js';
import { hashCanonical } from '../../persistence/file-store/hashing.js';
import { requireArtifactRef, requireOpaqueId, requireSha256, requireUtc } from './contracts.js';
import { FOUNDATION_FORBIDDEN_ROLE_INSTANCE_ID, type As1Profile } from './profiles.js';
import type { As1ProfileInboundStore } from './inbound-store.js';

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

/** Read-only Git provenance verifier. Uses closed argv, shell:false, fixed env, bounded output. */
export interface As1GitProvenanceVerifier {
  verify(ref: As1EvidenceRef): Promise<As1EvidenceProvenance>;
}

/** The immutable authority chain the evidence must bind to — taken from the accepted pointer-delivery grant. */
export interface As1EvidenceAuthority {
  readonly authorityRepositoryId: string;
  /** The exact accepted intake / source event / pointer hash the evidence must bind to (from the store state). */
  readonly intakeId: string;
  readonly sourceEventId: string;
  readonly pointerHash: string;
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

export type As1EvidenceEnvelope =
  | (As1EvidenceCommon & As1AckBindings & { readonly kind: 'ACK'; readonly sourceEventId: string; readonly pointerHash: string; readonly advisorAckId: string; readonly acknowledgedAt: string })
  | (As1EvidenceCommon & { readonly kind: 'INTAKE'; readonly advisorAckId: string; readonly classification: string; readonly recordedAt: string })
  | (As1EvidenceCommon & { readonly kind: 'QUESTION'; readonly questionId: string; readonly expectedResponseKind: 'CLARIFICATION' | 'DECISION_RESPONSE'; readonly recordedAt: string })
  | (As1EvidenceCommon & { readonly kind: 'RESULT'; readonly resultId: string; readonly terminalStatus: string; readonly resultArtifactRef: string; readonly recordedAt: string });

const ACK_KEYS = [
  'schemaVersion', 'evidenceId', 'profileId', 'advisorTeam', 'actorId', 'roleInstanceId', 'intakeId', 'sourceEventId',
  'pointerHash', 'advisorAckId', 'acknowledgedAt',
  // The full reviewed §13.1 authority bindings (review B06): receive grant/binding, pilot, pointer-delivery
  // grant, root correlation, pointer ref, transport journal ref/hash, and the consumed delivery grant + lease.
  'receiveGrantId', 'receiveGrantBindingHash', 'pilotId', 'pointerDeliveryGrantId', 'rootCorrelationHash',
  'pointerArtifactRef', 'transportJournalRef', 'transportJournalHash', 'consumedDeliveryGrantId', 'consumedLeaseId',
] as const;
const INTAKE_KEYS = ['schemaVersion', 'evidenceId', 'profileId', 'advisorTeam', 'actorId', 'roleInstanceId', 'intakeId', 'advisorAckId', 'classification', 'recordedAt'] as const;
const QUESTION_KEYS = ['schemaVersion', 'evidenceId', 'profileId', 'advisorTeam', 'actorId', 'roleInstanceId', 'intakeId', 'questionId', 'expectedResponseKind', 'recordedAt'] as const;
const RESULT_KEYS = ['schemaVersion', 'evidenceId', 'profileId', 'advisorTeam', 'actorId', 'roleInstanceId', 'intakeId', 'resultId', 'terminalStatus', 'resultArtifactRef', 'recordedAt'] as const;

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
        transportJournalRef: requireOpaqueId(value.transportJournalRef, 'ACK.transportJournalRef'),
        transportJournalHash: requireSha256(value.transportJournalHash, 'ACK.transportJournalHash'),
        consumedDeliveryGrantId: requireOpaqueId(value.consumedDeliveryGrantId, 'ACK.consumedDeliveryGrantId'),
        consumedLeaseId: requireOpaqueId(value.consumedLeaseId, 'ACK.consumedLeaseId'),
      };
    case 'INTAKE':
      return {
        ...common,
        kind: 'INTAKE',
        advisorAckId: requireOpaqueId(value.advisorAckId, 'INTAKE.advisorAckId'),
        classification: requireEnum(value.classification, INTAKE_CLASSIFICATIONS, 'INTAKE.classification'),
        recordedAt: requireUtc(value.recordedAt, 'INTAKE.recordedAt'),
      };
    case 'QUESTION':
      return {
        ...common,
        kind: 'QUESTION',
        questionId: requireOpaqueId(value.questionId, 'QUESTION.questionId'),
        expectedResponseKind: requireEnum(value.expectedResponseKind, ['CLARIFICATION', 'DECISION_RESPONSE'] as const, 'QUESTION.expectedResponseKind'),
        recordedAt: requireUtc(value.recordedAt, 'QUESTION.recordedAt'),
      };
    case 'RESULT':
      return {
        ...common,
        kind: 'RESULT',
        resultId: requireOpaqueId(value.resultId, 'RESULT.resultId'),
        terminalStatus: requireOpaqueId(value.terminalStatus, 'RESULT.terminalStatus'),
        resultArtifactRef: requireArtifactRef(value.resultArtifactRef, 'RESULT.resultArtifactRef'),
        recordedAt: requireUtc(value.recordedAt, 'RESULT.recordedAt'),
      };
    default: {
      const exhaustive: never = kind;
      throw new DomainError('INVALID_SCHEMA', `unknown evidence kind ${String(exhaustive)}`);
    }
  }
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

export type EvidenceIngestOutcome = 'ACCEPTED' | 'QUARANTINED';

export interface EvidenceIngestResult {
  readonly outcome: EvidenceIngestOutcome;
  /** A stable bounded reason CODE on quarantine — never raw detail (review B06). `ok` on acceptance. */
  readonly reason: string;
  readonly sequence: number | null;
}

/** Profile-bound, ordered, immutable evidence ingress. Fails closed AND durably latches on any defect. */
export class As1EvidenceIngress {
  public constructor(
    private readonly profile: As1Profile,
    private readonly store: As1ProfileInboundStore,
    private readonly verifier: As1GitProvenanceVerifier,
    private readonly evidencePrefix: string,
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
    const expectedPrefix = `${this.evidencePrefix}/${envelope.intakeId}/`;
    if (!ref.path.startsWith(expectedPrefix) || ref.path.includes('..')) {
      return this.quarantine('EVIDENCE_WRONG_PREFIX');
    }

    // Real read-only Git/content provenance: every gate must hold, including a byte-for-byte blob content
    // match and descent from BOTH grant source commits (bound into the verifier snapshots) (review B06).
    const provenance = await this.verifier.verify(ref);
    if (!provenance.upstreamAncestral) return this.quarantine('EVIDENCE_NOT_ANCESTRAL');
    if (!provenance.firstAddition) return this.quarantine('EVIDENCE_NOT_FIRST_ADDITION');
    if (provenance.dirty) return this.quarantine('EVIDENCE_DIRTY_TREE');
    if (!provenance.contentVerified) return this.quarantine('EVIDENCE_CONTENT_MISMATCH');
    if (!provenance.descendsFromBothSnapshots) return this.quarantine('EVIDENCE_SNAPSHOT_DESCENT');

    // The full canonical envelope hash is bound so a re-observation must match on EVERY field, not a partial tuple.
    const entry = {
      evidenceKind: kind,
      evidenceId: envelope.evidenceId,
      intakeId: envelope.intakeId,
      blobSha256: ref.blobSha256,
      sourceCommit: ref.sourceCommit,
      repositoryId: ref.repositoryId,
      path: ref.path,
      envelopeHash: hashCanonical(value),
    };
    const accepted = await this.store.readAcceptedEvidence();

    // Re-observing the EXACT same committed evidence is a normal polling/restart case: after full provenance
    // validation, route a same-evidenceId submission through exact checkpoint equality BEFORE stage-order.
    // An exact match is idempotent ACCEPTED; any same-id envelope/ref divergence durably latches (review B06).
    if (accepted.some((e) => e.evidenceId === envelope.evidenceId)) {
      try {
        const sequence = await this.store.appendAcceptedEvidence(entry);
        return { outcome: 'ACCEPTED', reason: 'ok', sequence };
      } catch {
        return this.quarantine('EVIDENCE_DUPLICATE_DIVERGENCE');
      }
    }

    // A genuinely new evidence id must satisfy the closed stage order for its intake.
    const orderCode = this.checkStageOrder(kind, accepted.filter((e) => e.intakeId === envelope.intakeId).map((e) => e.evidenceKind));
    if (orderCode !== null) return this.quarantine(orderCode);

    try {
      const sequence = await this.store.appendAcceptedEvidence(entry);
      return { outcome: 'ACCEPTED', reason: 'ok', sequence };
    } catch {
      // A capacity failure (or a race-losing divergence) is a durable contradiction — latch the profile.
      return this.quarantine('EVIDENCE_APPEND_QUARANTINED');
    }
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
