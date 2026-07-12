// Agent Office Batch A — committed accepted-evidence (B) validation and arbitration.
//
// Contract §2.3.1 (schema/validity/dedup/selection), §2.3.1 U1 (sessionProcess cross-kind
// arbitration), §2.3.2 (aiRuntimeState total arbitration). This module owns only facts that are
// genuinely ABSENT from the runtime projection (process/identity/model/effort + ai_ready/ai_error).
// It never carries mission/workUnit/activity/operationalState, stores nothing, and reads no clock.
import { assertUtcTimestamp, isUuidV7 } from '../../domain/time/index.js';
import {
  SESSION_PROCESS_UNKNOWN,
  type AcceptedEvidenceKind,
  type AcceptedEvidenceRecord,
  type AiRuntimeState,
  type OrganizationDiagnostic,
  type SessionProcess,
} from './types.js';

const EVIDENCE_REF_PATTERN = /^sha256:[0-9a-f]{64}$/u;

const PROCESS_KINDS = ['process_detected', 'process_absent', 'process_offline'] as const;
type ProcessKind = (typeof PROCESS_KINDS)[number];
const PROCESS_KIND_VALUE: Readonly<Record<ProcessKind, SessionProcess>> = {
  process_detected: 'AI_PROCESS_DETECTED',
  process_absent: 'NO_AI_PROCESS',
  process_offline: 'SESSION_OFFLINE',
};

const ATTESTATION_KINDS = ['ai_identity_attestation', 'model_attestation', 'effort_attestation'] as const;
export type AttestationKind = (typeof ATTESTATION_KINDS)[number];

export function isUtcTimestamp(value: string): boolean {
  try {
    assertUtcTimestamp(value);
    return true;
  } catch {
    return false;
  }
}

export function isAttestationKind(kind: AcceptedEvidenceKind): kind is AttestationKind {
  return (ATTESTATION_KINDS as readonly string[]).includes(kind);
}

/**
 * Structural + currency validity (contract §2.3.1). A record contributes only if the schema,
 * evidenceId, evidenceRef, acceptance, provenance, sourceEventIds and timestamps are well-formed,
 * it is effective (`effectiveFrom <= evaluatedAt`, i.e. the fact has taken effect), and it is not
 * expired (`optionalExpiresAt` absent or `> evaluatedAt`). Recency alone is never proof.
 * The attestation value-in-allowed-token check is applied at join time (needs the (A) row).
 */
export function isEffectiveValidEvidence(record: AcceptedEvidenceRecord, evaluatedAt: string): boolean {
  // `schemaVersion` is enforced to the exact literal by the AcceptedEvidenceRecord type at the boundary.
  if (!isUuidV7(record.evidenceId)) return false;
  if (!EVIDENCE_REF_PATTERN.test(record.evidenceRef)) return false;
  if (record.acceptanceStatus !== 'ACCEPTED') return false;
  if (record.provenance === 'UNVERIFIED') return false;
  if (record.roleInstanceId.trim() === '') return false;
  if (record.sourceEventIds.length < 1) return false;
  for (const id of record.sourceEventIds) if (!isUuidV7(id)) return false;
  if (!isUtcTimestamp(record.observedAt)) return false;
  if (!isUtcTimestamp(record.effectiveFrom)) return false;
  if (record.optionalExpiresAt !== undefined) {
    if (!isUtcTimestamp(record.optionalExpiresAt)) return false;
    if (record.optionalExpiresAt <= record.effectiveFrom) return false;
    if (record.optionalExpiresAt <= evaluatedAt) return false; // expired: does not contribute even if newest
  }
  if (isAttestationKind(record.kind) && (record.value === undefined || record.value.trim() === '')) return false;
  if (record.effectiveFrom > evaluatedAt) return false; // not yet effective
  return true;
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/** All-contract-field equality for evidenceId replay-vs-collision (contract §2.3.1 U2). */
export function recordsFieldIdentical(left: AcceptedEvidenceRecord, right: AcceptedEvidenceRecord): boolean {
  return (
    left.evidenceRef === right.evidenceRef &&
    left.kind === right.kind &&
    left.roleInstanceId === right.roleInstanceId &&
    left.missionId === right.missionId &&
    left.workUnitId === right.workUnitId &&
    left.value === right.value &&
    left.provenance === right.provenance &&
    left.acceptanceStatus === right.acceptanceStatus &&
    left.observedAt === right.observedAt &&
    left.effectiveFrom === right.effectiveFrom &&
    left.optionalExpiresAt === right.optionalExpiresAt &&
    arraysEqual(left.sourceEventIds, right.sourceEventIds)
  );
}

/**
 * Group all records by `evidenceId` (contract §2.3.1 U2; input-order independent):
 * every record of an id field-identical → idempotent replay collapses to one; any unequal field
 * among an id → collision drops ALL records of that id + a reported diagnostic.
 */
export function dedupeByEvidenceId(records: readonly AcceptedEvidenceRecord[]): {
  readonly records: readonly AcceptedEvidenceRecord[];
  readonly diagnostics: readonly OrganizationDiagnostic[];
} {
  const groups = new Map<string, AcceptedEvidenceRecord[]>();
  for (const record of records) {
    const group = groups.get(record.evidenceId);
    if (group === undefined) groups.set(record.evidenceId, [record]);
    else group.push(record);
  }
  const kept: AcceptedEvidenceRecord[] = [];
  const diagnostics: OrganizationDiagnostic[] = [];
  for (const [evidenceId, group] of groups) {
    const [first] = group;
    if (first === undefined) continue;
    if (group.every((record) => recordsFieldIdentical(record, first))) {
      kept.push(first);
    } else {
      diagnostics.push({
        code: 'EVIDENCE_ID_COLLISION',
        roleInstanceId: group.every((record) => record.roleInstanceId === first.roleInstanceId)
          ? first.roleInstanceId
          : null,
        detail: `evidenceId ${evidenceId} bears unequal-content records; all dropped`,
      });
    }
  }
  return { records: kept, diagnostics };
}

/**
 * Deterministic selection among multiple valid same-kind records for one roleInstanceId
 * (contract §2.3.1): greatest `effectiveFrom`; on a tie, greatest `evidenceId` (lexicographic).
 */
function selectLatest(records: readonly AcceptedEvidenceRecord[]): AcceptedEvidenceRecord | undefined {
  return records.reduce<AcceptedEvidenceRecord | undefined>((best, record) => {
    if (best === undefined) return record;
    if (record.effectiveFrom > best.effectiveFrom) return record;
    if (record.effectiveFrom === best.effectiveFrom && record.evidenceId > best.evidenceId) return record;
    return best;
  }, undefined);
}

export interface SessionProcessResolution {
  readonly value: SessionProcess;
  readonly record: AcceptedEvidenceRecord | null;
  readonly contradiction: boolean;
}

/**
 * `sessionProcess` total cross-kind arbitration (contract §2.3.1 U1; conservative, order-independent).
 * Select the best record per process kind, then over the present kinds: zero → UNKNOWN; exactly one →
 * its value; two or more (contradiction) → UNKNOWN + a reported diagnostic (never a positive claim).
 */
export function resolveSessionProcess(
  actorRecords: readonly AcceptedEvidenceRecord[],
): SessionProcessResolution {
  const presentSelections = PROCESS_KINDS.map((kind) => ({
    kind,
    record: selectLatest(actorRecords.filter((record) => record.kind === kind)),
  })).filter((entry): entry is { kind: ProcessKind; record: AcceptedEvidenceRecord } => entry.record !== undefined);

  const [only] = presentSelections;
  if (presentSelections.length === 0) {
    return { value: SESSION_PROCESS_UNKNOWN, record: null, contradiction: false };
  }
  if (presentSelections.length === 1 && only !== undefined) {
    return { value: PROCESS_KIND_VALUE[only.kind], record: only.record, contradiction: false };
  }
  return { value: SESSION_PROCESS_UNKNOWN, record: null, contradiction: true };
}

export interface AttestationResolution {
  readonly value: string | null; // null → fail-closed sentinel
  readonly record: AcceptedEvidenceRecord | null;
  readonly conflict: boolean;
}

/**
 * Resolve one attestation kind (contract §2.3.1): among valid same-kind records whose `value` is in
 * the (A) allowed-token set, pick greatest `effectiveFrom`; on an `effectiveFrom` tie with conflicting
 * values, yield the fail-closed sentinel (`null`) + a conflict flag — never a silent pick.
 */
export function resolveAttestation(
  actorRecords: readonly AcceptedEvidenceRecord[],
  kind: AttestationKind,
  allowedTokens: readonly string[],
): AttestationResolution {
  const allowed = new Set(allowedTokens);
  const candidates = actorRecords.filter(
    (record) => record.kind === kind && record.value !== undefined && allowed.has(record.value),
  );
  if (candidates.length === 0) return { value: null, record: null, conflict: false };
  const maxEffectiveFrom = candidates
    .map((record) => record.effectiveFrom)
    .reduce((max, effectiveFrom) => (effectiveFrom > max ? effectiveFrom : max));
  const tied = candidates.filter((record) => record.effectiveFrom === maxEffectiveFrom);
  if (new Set(tied.map((record) => record.value)).size > 1) return { value: null, record: null, conflict: true };
  const selected = selectLatest(candidates);
  if (selected === undefined) return { value: null, record: null, conflict: false };
  return { value: selected.value ?? null, record: selected, conflict: false };
}

/** A valid `ai_ready`/`ai_error` signal is current iff at least one effective valid record exists. */
export function hasCurrentSignal(actorRecords: readonly AcceptedEvidenceRecord[], kind: 'ai_ready' | 'ai_error'): AcceptedEvidenceRecord | null {
  return selectLatest(actorRecords.filter((record) => record.kind === kind)) ?? null;
}

export interface AiRuntimeArbitrationInput {
  readonly sessionProcess: SessionProcess;
  readonly work: boolean;
  readonly waiting: boolean;
  readonly error: boolean;
  readonly ready: boolean;
}

/**
 * `aiRuntimeState` total arbitration (contract §2.3.2; every combination decided). An error always
 * surfaces; mutually-exclusive work+wait → UNKNOWN; a non-detected process forces UNKNOWN.
 */
export function arbitrateAiRuntimeState(input: AiRuntimeArbitrationInput): AiRuntimeState {
  if (input.sessionProcess !== 'AI_PROCESS_DETECTED') return 'AI_RUNTIME_UNKNOWN';
  if (input.error) return 'AI_ERROR';
  if (input.work && input.waiting) return 'AI_RUNTIME_UNKNOWN';
  if (input.work) return 'AI_WORKING';
  if (input.waiting) return 'AI_WAITING';
  if (input.ready) return 'AI_READY';
  return 'AI_RUNTIME_UNKNOWN';
}
