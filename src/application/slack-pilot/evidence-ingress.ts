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
import {
  requireArtifactRef,
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

/** Read-only Git provenance verifier. Uses closed argv, shell:false, fixed env, bounded output. */
export interface As1GitProvenanceVerifier {
  verify(ref: As1EvidenceRef): Promise<As1EvidenceProvenance>;
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
      return { advisorAckId: envelope.advisorAckId, classification: envelope.classification };
    case 'QUESTION':
      return { questionId: envelope.questionId, expectedResponseKind: envelope.expectedResponseKind };
    case 'RESULT':
      return { resultId: envelope.resultId, terminalStatus: envelope.terminalStatus, resultArtifactRef: envelope.resultArtifactRef };
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
 *   • INTAKE  → its advisorAckId must equal the exact accepted ACK's advisorAckId.
 *   • QUESTION → its questionId must not collide with an already-accepted, differing question.
 *   • RESULT  → the accepted intake it closes must be one the Advisor accepted, never one it rejected.
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
      return envelope.advisorAckId === ack.correlation.advisorAckId ? null : 'EVIDENCE_INTAKE_ACK_MISMATCH';
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
      return intake.correlation.classification === 'REJECTED_BY_ADVISOR' ? 'EVIDENCE_RESULT_INTAKE_NOT_ACCEPTED' : null;
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
  /** The durable transport-journal artifact locator; its integrity HASH is recomputed here, never trusted. */
  readonly transportJournalRef: string;
  readonly consumption: As1DeliveryAuthorityConsumptionV1;
}

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
  if (st.boundSourceEventId !== null) requireEqual(st.boundSourceEventId, root.sourceEventId, 'state/root boundSourceEventId');

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

  // 8. Both grants agree on the authority repository; the two frozen source commits come from the typed grants.
  requireEqual(rg.authorityRepositoryId, pdg.authorityRepositoryId, 'grant/pdg authorityRepositoryId');

  const acceptedAck: As1AckBindings = {
    receiveGrantId: rg.receiveGrantId,
    receiveGrantBindingHash: pdg.receiveGrantBindingHash,
    pilotId: rg.pilotId,
    pointerDeliveryGrantId: pdg.pointerDeliveryGrantId,
    rootCorrelationHash,
    pointerArtifactRef: pdg.pointerArtifactRef,
    transportJournalRef: records.transportJournalRef,
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
    // match and descent from BOTH grant source commits (bound into the verifier snapshots) (review B06).
    const provenance = await this.verifier.verify(ref);
    if (!provenance.upstreamAncestral) return this.quarantine('EVIDENCE_NOT_ANCESTRAL');
    if (!provenance.firstAddition) return this.quarantine('EVIDENCE_NOT_FIRST_ADDITION');
    if (provenance.dirty) return this.quarantine('EVIDENCE_DIRTY_TREE');
    if (!provenance.contentVerified) return this.quarantine('EVIDENCE_CONTENT_MISMATCH');
    if (!provenance.descendsFromBothSnapshots) return this.quarantine('EVIDENCE_SNAPSHOT_DESCENT');

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
    const acceptedForIntake = accepted.filter((e) => e.intakeId === envelope.intakeId);
    const orderCode = this.checkStageOrder(kind, acceptedForIntake.map((e) => e.evidenceKind));
    if (orderCode !== null) return this.quarantine(orderCode);

    // Beyond mere stage PRESENCE, each new stage must bind the EXACT referenced facts of its accepted
    // predecessors via their persisted canonical correlation (review B06): an INTAKE binds the exact accepted
    // ACK's advisorAckId; a QUESTION may not diverge from an already-accepted question of the same id; a RESULT
    // may only close an intake the Advisor actually accepted (never a rejected one). Existing-stage-presence is
    // insufficient — a wrong referenced id/fact quarantines and latches even though the predecessor exists.
    const bindingCode = bindToAcceptedChain(envelope, acceptedForIntake);
    if (bindingCode !== null) return this.quarantine(bindingCode);

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
