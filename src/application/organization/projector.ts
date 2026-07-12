// Agent Office Batch A — one-frame organization projector (contract §2.4/§2.5/§3).
//
// Loads (A) registry, (RT) runtime work input, and (B) accepted evidence; computes the changing
// facts (never storing them back) and a FULL OUTER JOIN (union) on `roleInstanceId` into one final
// frame. (RT) is the sole truth for mission/workUnit/activity/operationalState; (B) supplies only
// facts absent from (RT); registry-only rows get changing sentinels; runtime/evidence-only rows get
// UNKNOWN identity + UNASSIGNED. STALE/INVALID/MISSING/UNVERIFIED → the field's sentinel.
import type { ObservableProjectionName } from '../../domain/activity/index.js';
import {
  arbitrateAiRuntimeState,
  dedupeByEvidenceId,
  hasCurrentSignal,
  isEffectiveValidEvidence,
  resolveAttestation,
  resolveSessionProcess,
} from './evidence.js';
import {
  normalizeAdvisorTeam,
  normalizeRegistryRole,
  normalizeRegistryText,
  partitionRegistry,
} from './registry.js';
import {
  ADVISOR_TEAM_UNASSIGNED,
  AI_IDENTITY_UNKNOWN,
  AI_RUNTIME_UNKNOWN,
  EFFORT_UNKNOWN,
  MODEL_UNKNOWN,
  OPERATIONAL_STATE_UNKNOWN,
  ORGANIZATION_UNKNOWN,
  SESSION_PROCESS_UNKNOWN,
  type AcceptedEvidenceRecord,
  type AiRuntimeState,
  type OrganizationDiagnostic,
  type OrganizationFact,
  type OrganizationFrame,
  type OrganizationFrameActor,
  type OrganizationProjectorInput,
  type OrganizationRegistryRow,
  type PixelActorFactSource,
  type PixelOperationalState,
  type RuntimeWorkInput,
  type SessionProcess,
} from './types.js';

/** Exhaustive §2.4 total map `ObservableProjectionName → PixelOperationalState` (default UNKNOWN). */
const OBSERVABLE_TO_OPERATIONAL: Readonly<Record<ObservableProjectionName, PixelOperationalState>> = {
  QUEUED: 'IDLE',
  READY: 'IDLE',
  DISPATCHING: 'ROUTING / DISPATCH',
  READING: 'WORKING',
  WORKING: 'WORKING',
  TESTING: 'TESTING',
  WRITING_RESULT: 'WORKING',
  RETURNING_RESULT: 'RETURNING_RESULT',
  REVIEWING: 'REVIEWING',
  NEEDS_PATCH: 'NEEDS_PATCH',
  WAITING_DEPENDENCY: 'WAITING_DEPENDENCY',
  WAITING_LEO: 'WAITING_LEO',
  BLOCKED: 'BLOCKED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  UNKNOWN_OR_STALE: 'UNKNOWN',
};

const ACTIVE_WORK_OBSERVABLES: ReadonlySet<ObservableProjectionName> = new Set([
  'DISPATCHING',
  'READING',
  'WORKING',
  'TESTING',
  'WRITING_RESULT',
  'RETURNING_RESULT',
  'REVIEWING',
]);
const WAITING_OBSERVABLES: ReadonlySet<ObservableProjectionName> = new Set(['WAITING_DEPENDENCY', 'WAITING_LEO']);

/**
 * Total §2.4 mapping. The record is exhaustive over `ObservableProjectionName`; the projector
 * output is the only source, so `UNKNOWN_OR_STALE` (already the projector's own "any other" bucket)
 * maps to `UNKNOWN`.
 */
export function mapOperationalState(observableName: ObservableProjectionName): PixelOperationalState {
  return OBSERVABLE_TO_OPERATIONAL[observableName];
}

const RUNTIME_DEFAULT_PROVENANCE: PixelActorFactSource = 'VERIFIED_MISSION_ARTIFACT';

function sentinel<TValue extends string>(value: TValue, status: OrganizationFact['status'] = 'MISSING'): OrganizationFact<TValue> {
  return { value, source: 'UNVERIFIED', status, evidenceTimestamp: null };
}

function verified<TValue extends string>(value: TValue, source: PixelActorFactSource, evidenceTimestamp: string | null): OrganizationFact<TValue> {
  return { value, source, status: 'VERIFIED', evidenceTimestamp };
}

function computeSessionProcess(
  records: readonly AcceptedEvidenceRecord[],
  diagnostics: OrganizationDiagnostic[],
  roleInstanceId: string,
): OrganizationFact<SessionProcess> {
  const resolution = resolveSessionProcess(records);
  if (resolution.contradiction) {
    diagnostics.push({ code: 'SESSION_PROCESS_CONTRADICTION', roleInstanceId, detail: 'contradictory process kinds; sessionProcess fails closed' });
    return sentinel(SESSION_PROCESS_UNKNOWN, 'INVALID');
  }
  if (resolution.record === null) return sentinel(SESSION_PROCESS_UNKNOWN, 'MISSING');
  return verified(resolution.value, resolution.record.provenance, resolution.record.effectiveFrom);
}

function computeAttestation(
  records: readonly AcceptedEvidenceRecord[],
  kind: 'ai_identity_attestation' | 'model_attestation' | 'effort_attestation',
  allowedTokens: readonly string[],
  unknownSentinel: string,
  diagnostics: OrganizationDiagnostic[],
  roleInstanceId: string,
): OrganizationFact {
  const resolution = resolveAttestation(records, kind, allowedTokens);
  if (resolution.conflict) {
    diagnostics.push({ code: 'ATTESTATION_VALUE_CONFLICT', roleInstanceId, detail: `${kind} has conflicting values at equal effectiveFrom; fails closed` });
    return sentinel(unknownSentinel, 'INVALID');
  }
  if (resolution.value === null || resolution.record === null) return sentinel(unknownSentinel, 'MISSING');
  return verified(resolution.value, resolution.record.provenance, resolution.record.effectiveFrom);
}

function computeAiRuntimeState(
  sessionProcess: SessionProcess,
  runtime: RuntimeWorkInput | undefined,
  records: readonly AcceptedEvidenceRecord[],
): OrganizationFact<AiRuntimeState> {
  const rtActive = runtime !== undefined && runtime.staleOrInvalid !== true;
  const observable = rtActive ? runtime.observableName : undefined;
  const errorRecord = hasCurrentSignal(records, 'ai_error');
  const readyRecord = hasCurrentSignal(records, 'ai_ready');
  const work = observable !== undefined && ACTIVE_WORK_OBSERVABLES.has(observable);
  const waiting = observable !== undefined && WAITING_OBSERVABLES.has(observable);
  const rtError = observable === 'FAILED';
  const error = rtError || errorRecord !== null;
  const ready = readyRecord !== null;
  const value = arbitrateAiRuntimeState({ sessionProcess, work, waiting, error, ready });
  if (value === AI_RUNTIME_UNKNOWN) return sentinel(AI_RUNTIME_UNKNOWN, 'MISSING');
  if (value === 'AI_ERROR') {
    return errorRecord !== null
      ? verified(value, errorRecord.provenance, errorRecord.effectiveFrom)
      : verified(value, runtime?.provenance ?? RUNTIME_DEFAULT_PROVENANCE, null);
  }
  if (value === 'AI_READY' && readyRecord !== null) return verified(value, readyRecord.provenance, readyRecord.effectiveFrom);
  return verified(value, runtime?.provenance ?? RUNTIME_DEFAULT_PROVENANCE, null);
}

function computeRuntimeText(
  runtime: RuntimeWorkInput | undefined,
  select: (input: RuntimeWorkInput) => string | null,
): OrganizationFact {
  if (runtime === undefined) return sentinel(ORGANIZATION_UNKNOWN, 'MISSING');
  if (runtime.staleOrInvalid === true) return sentinel(ORGANIZATION_UNKNOWN, 'STALE');
  const value = select(runtime);
  if (value === null || value.trim() === '') return sentinel(ORGANIZATION_UNKNOWN, 'MISSING');
  return verified(value.trim(), runtime.provenance ?? RUNTIME_DEFAULT_PROVENANCE, null);
}

function computeOperationalState(runtime: RuntimeWorkInput | undefined): OrganizationFact<PixelOperationalState> {
  if (runtime === undefined) return sentinel(OPERATIONAL_STATE_UNKNOWN, 'MISSING');
  if (runtime.staleOrInvalid === true) return sentinel(OPERATIONAL_STATE_UNKNOWN, 'STALE');
  return verified(mapOperationalState(runtime.observableName), runtime.provenance ?? RUNTIME_DEFAULT_PROVENANCE, null);
}

function projectActor(
  roleInstanceId: string,
  registryRow: OrganizationRegistryRow | undefined,
  runtime: RuntimeWorkInput | undefined,
  actorEvidence: readonly AcceptedEvidenceRecord[],
  diagnostics: OrganizationDiagnostic[],
): OrganizationFrameActor {
  const provenance = registryRow?.provenance ?? 'UNVERIFIED';
  const identityText = (value: string | undefined) =>
    registryRow === undefined ? sentinel(ORGANIZATION_UNKNOWN, 'MISSING') : normalizeRegistryText(value, provenance);

  const advisorTeam = registryRow === undefined
    ? sentinel(ADVISOR_TEAM_UNASSIGNED, 'MISSING')
    : normalizeAdvisorTeam(registryRow.advisorTeam, provenance);

  const sessionProcess = computeSessionProcess(actorEvidence, diagnostics, roleInstanceId);
  const aiRuntimeState = computeAiRuntimeState(sessionProcess.value, runtime, actorEvidence);

  return {
    roleInstanceId,
    role: registryRow === undefined ? sentinel(ORGANIZATION_UNKNOWN, 'MISSING') : normalizeRegistryRole(registryRow.role, provenance),
    project: identityText(registryRow?.project),
    stableDisplayName: identityText(registryRow?.stableDisplayName),
    advisorTeam,
    reportsToAdvisor: identityText(registryRow?.reportsToAdvisor),
    assignedBy: identityText(registryRow?.assignedBy),
    returnsResultTo: identityText(registryRow?.returnsResultTo),
    sessionName: identityText(registryRow?.sessionName),
    sessionProcess,
    aiIdentity: computeAttestation(actorEvidence, 'ai_identity_attestation', registryRow?.allowedAiIdentities ?? [], AI_IDENTITY_UNKNOWN, diagnostics, roleInstanceId),
    model: computeAttestation(actorEvidence, 'model_attestation', registryRow?.allowedModels ?? [], MODEL_UNKNOWN, diagnostics, roleInstanceId),
    effort: computeAttestation(actorEvidence, 'effort_attestation', registryRow?.allowedEfforts ?? [], EFFORT_UNKNOWN, diagnostics, roleInstanceId),
    aiRuntimeState,
    operationalState: computeOperationalState(runtime),
    mission: computeRuntimeText(runtime, (input) => input.mission),
    workUnit: computeRuntimeText(runtime, (input) => input.workUnit),
    canReceiveWork: advisorTeam.value !== ADVISOR_TEAM_UNASSIGNED,
  };
}

/** Compute the one final Batch A organization frame (contract §2.5 exact flow). */
export function projectOrganizationFrame(input: OrganizationProjectorInput): OrganizationFrame {
  const diagnostics: OrganizationDiagnostic[] = [];

  const registry = partitionRegistry(input.registry);
  diagnostics.push(...registry.diagnostics);

  const deduped = dedupeByEvidenceId(input.evidence);
  diagnostics.push(...deduped.diagnostics);
  const validEvidence = deduped.records.filter((record) => isEffectiveValidEvidence(record, input.evaluatedAt));

  const evidenceByActor = new Map<string, AcceptedEvidenceRecord[]>();
  for (const record of validEvidence) {
    const group = evidenceByActor.get(record.roleInstanceId);
    if (group === undefined) evidenceByActor.set(record.roleInstanceId, [record]);
    else group.push(record);
  }

  const runtimeByActor = new Map<string, RuntimeWorkInput>();
  for (const row of input.runtime) {
    // (RT) is the sole truth; a duplicated runtime row keeps the first deterministically.
    if (!runtimeByActor.has(row.roleInstanceId)) runtimeByActor.set(row.roleInstanceId, row);
  }

  const roleInstanceIds = [
    ...new Set<string>([
      ...registry.rows.keys(),
      ...runtimeByActor.keys(),
      ...evidenceByActor.keys(),
    ]),
  ].sort((left, right) => left.localeCompare(right, 'en'));

  const actors = roleInstanceIds.map((roleInstanceId) =>
    projectActor(
      roleInstanceId,
      registry.rows.get(roleInstanceId),
      runtimeByActor.get(roleInstanceId),
      evidenceByActor.get(roleInstanceId) ?? [],
      diagnostics,
    ),
  );

  return { actors, diagnostics };
}
