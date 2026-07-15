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
import { requireOpaqueId } from './contracts.js';
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
  readonly authoritySourceCommit: string;
}

/** Persist the durable profile latch (a stable bounded reason code). Backed by the canonical control record. */
export type As1EvidenceLatch = (reasonCode: string) => Promise<void>;

export interface As1EvidenceEnvelope {
  readonly schemaVersion: string;
  readonly evidenceId: string;
  readonly intakeId: string;
  readonly advisorTeam: string;
  readonly actorId: string;
  readonly roleInstanceId: string;
}

const ACK_KEYS = ['schemaVersion', 'evidenceId', 'profileId', 'advisorTeam', 'actorId', 'roleInstanceId', 'intakeId', 'sourceEventId', 'pointerHash', 'advisorAckId', 'acknowledgedAt'] as const;
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
 * Validate an evidence record against its exact schema and the selected profile's immutable lineage. The
 * profileId, advisorTeam, actorId, and roleInstanceId must all equal the closed profile; Foundation may
 * never carry the historical foundation-advisor join key.
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
  if (kind === 'INTAKE') {
    requireEnum(value.classification, INTAKE_CLASSIFICATIONS, 'INTAKE.classification');
  }
  return {
    schemaVersion: SCHEMA_VERSIONS[kind],
    evidenceId: requireOpaqueId(value.evidenceId, `${kind}.evidenceId`),
    intakeId: requireOpaqueId(value.intakeId, `${kind}.intakeId`),
    advisorTeam,
    actorId,
    roleInstanceId,
  };
}

export type EvidenceIngestOutcome = 'ACCEPTED' | 'QUARANTINED';

export interface EvidenceIngestResult {
  readonly outcome: EvidenceIngestOutcome;
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
    } catch (error) {
      return this.quarantine('EVIDENCE_SCHEMA_REJECTED', error instanceof DomainError ? error.message : 'schema rejected');
    }

    // The evidence repository/path must bind to the grant-fixed authority chain; Slack cannot supply either.
    if (ref.repositoryId !== this.authority.authorityRepositoryId) {
      return this.quarantine('EVIDENCE_WRONG_REPOSITORY', 'evidence repository does not match the delivery-grant authority');
    }
    const expectedPrefix = `${this.evidencePrefix}/${envelope.intakeId}/`;
    if (!ref.path.startsWith(expectedPrefix) || ref.path.includes('..')) {
      return this.quarantine('EVIDENCE_WRONG_PREFIX', 'evidence path is outside the grant-fixed profile prefix');
    }

    // Real read-only Git/content provenance: every gate must hold, including a byte-for-byte blob content
    // match and descent from BOTH frozen authority snapshots (review B06).
    const provenance = await this.verifier.verify(ref);
    if (!provenance.upstreamAncestral) return this.quarantine('EVIDENCE_NOT_ANCESTRAL', 'evidence is not upstream-ancestral');
    if (!provenance.firstAddition) return this.quarantine('EVIDENCE_NOT_FIRST_ADDITION', 'evidence path is not a single first addition');
    if (provenance.dirty) return this.quarantine('EVIDENCE_DIRTY_TREE', 'evidence tree is dirty for this path');
    if (!provenance.contentVerified) return this.quarantine('EVIDENCE_CONTENT_MISMATCH', 'committed blob bytes do not match the claimed hash');
    if (!provenance.descendsFromBothSnapshots) return this.quarantine('EVIDENCE_SNAPSHOT_DESCENT', 'evidence commit does not descend from both frozen snapshots');

    const priorForIntake = (await this.store.readAcceptedEvidence()).filter((e) => e.intakeId === envelope.intakeId);
    const orderError = this.checkStageOrder(kind, priorForIntake.map((e) => e.evidenceKind));
    if (orderError !== null) return this.quarantine('EVIDENCE_STAGE_ORDER', orderError);

    try {
      const sequence = await this.store.appendAcceptedEvidence({
        evidenceKind: kind,
        evidenceId: envelope.evidenceId,
        intakeId: envelope.intakeId,
        blobSha256: ref.blobSha256,
        sourceCommit: ref.sourceCommit,
      });
      return { outcome: 'ACCEPTED', reason: 'ok', sequence };
    } catch (error) {
      // A duplicate-equality violation or capacity failure is a durable contradiction — latch the profile.
      return this.quarantine('EVIDENCE_APPEND_QUARANTINED', error instanceof DomainError ? error.message : 'append failed');
    }
  }

  private checkStageOrder(kind: As1EvidenceKind, priorKinds: readonly string[]): string | null {
    const hasAck = priorKinds.includes('ACK');
    const hasIntake = priorKinds.includes('INTAKE');
    const hasResult = priorKinds.includes('RESULT');
    if (hasResult) return 'evidence arrived after the final RESULT';
    switch (kind) {
      case 'ACK':
        return priorKinds.length === 0 ? null : 'ACK must be the first evidence for an intake';
      case 'INTAKE':
        if (!hasAck) return 'INTAKE requires a prior accepted ACK';
        return hasIntake ? 'INTAKE already accepted' : null;
      case 'QUESTION':
        return hasIntake ? null : 'QUESTION requires a prior accepted INTAKE';
      case 'RESULT':
        return hasIntake ? null : 'RESULT requires a prior accepted INTAKE';
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
  private async quarantine(reasonCode: string, detail: string): Promise<EvidenceIngestResult> {
    await this.latch(reasonCode);
    return { outcome: 'QUARANTINED', reason: detail, sequence: null };
  }
}
