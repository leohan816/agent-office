// Agent Office Batch A — committed local/static organization registry + accepted-evidence fixture.
//
// This is the committed (A) identity/organization registry and (B) accepted-evidence input for the
// Batch A local/static organization projection (contract §2.1/§2.2/§2.3.1/§3). Batch A performs NO
// live discovery; every fact here is a provenance-tagged committed record, changed only by a normal
// reviewed commit. No prototype/synthetic-fixture marker is present (production-safe).
import { ACCEPTED_EVIDENCE_SCHEMA_VERSION } from '../src/application/organization/types.js';
import type {
  AcceptedEvidenceKind,
  AcceptedEvidenceRecord,
  OrganizationRegistryRow,
} from '../src/application/organization/types.js';

const ALLOWED_AI_IDENTITIES = ['CLAUDE_OPUS_4_8', 'GPT_5_6_SOL', 'FABLE_5', 'CLAUDE_SONNET_5', 'CODEX_5_6_SOL'] as const;
const ALLOWED_MODELS = ['claude-opus-4-8', 'gpt-5.6-sol', 'fable-5', 'claude-sonnet-5', 'codex-5.6-sol'] as const;
const ALLOWED_EFFORTS = ['ULTRACODE', 'XHIGH', 'HIGH', 'MEDIUM', 'LOW'] as const;

function registryRow(
  row: Omit<OrganizationRegistryRow, 'allowedAiIdentities' | 'allowedModels' | 'allowedEfforts' | 'provenance'>,
): OrganizationRegistryRow {
  return {
    ...row,
    allowedAiIdentities: [...ALLOWED_AI_IDENTITIES],
    allowedModels: [...ALLOWED_MODELS],
    allowedEfforts: [...ALLOWED_EFFORTS],
    provenance: 'VERIFIED_REGISTRY',
  };
}

/** (A) committed identity/organization registry — stable identity + bindings + allowed tokens. */
export const ORGANIZATION_REGISTRY: readonly OrganizationRegistryRow[] = [
  registryRow({
    roleInstanceId: 'foundation-advisor',
    role: 'ADVISOR',
    project: 'FOUNDATION',
    stableDisplayName: 'Foundation Advisor',
    advisorTeam: 'FOUNDATION_ADVISOR_TEAM',
    reportsToAdvisor: 'leo-gpt',
    assignedBy: 'leo-gpt',
    returnsResultTo: 'leo-gpt',
    sessionName: 'foundation-advisor',
  }),
  registryRow({
    roleInstanceId: 'foundation-control',
    role: 'CONTROL',
    project: 'FOUNDATION',
    stableDisplayName: 'Foundation Control',
    advisorTeam: 'FOUNDATION_ADVISOR_TEAM',
    reportsToAdvisor: 'foundation-advisor',
    assignedBy: 'foundation-advisor',
    returnsResultTo: 'foundation-advisor',
    sessionName: 'foundation-control',
  }),
  registryRow({
    roleInstanceId: 'agent-office-worker',
    role: 'WORKER',
    project: 'AGENT_OFFICE',
    stableDisplayName: 'Agent Office Worker',
    advisorTeam: 'FOUNDATION_ADVISOR_TEAM',
    reportsToAdvisor: 'foundation-advisor',
    assignedBy: 'foundation-advisor',
    returnsResultTo: 'foundation-advisor',
    sessionName: 'agent-office-opus',
  }),
  registryRow({
    roleInstanceId: 'foundation-reviewer',
    role: 'REVIEWER',
    project: 'FOUNDATION',
    stableDisplayName: 'Independent Reviewer',
    advisorTeam: 'FOUNDATION_ADVISOR_TEAM',
    reportsToAdvisor: 'foundation-advisor',
    assignedBy: 'foundation-advisor',
    returnsResultTo: 'foundation-advisor',
    sessionName: 'foundation-reviewer-sol',
  }),
  registryRow({
    roleInstanceId: 'cosmile-worker',
    role: 'WORKER',
    project: 'COSMILE',
    stableDisplayName: 'Cosmile Worker',
    advisorTeam: 'FOUNDATION_ADVISOR_TEAM',
    reportsToAdvisor: 'foundation-advisor',
    assignedBy: 'foundation-advisor',
    returnsResultTo: 'foundation-advisor',
    sessionName: 'cosmile-worker',
  }),
  registryRow({
    roleInstanceId: 'siasiu-worker',
    role: 'WORKER',
    project: 'SIASIU',
    stableDisplayName: 'SIASIU Worker',
    advisorTeam: 'FOUNDATION_ADVISOR_TEAM',
    reportsToAdvisor: 'foundation-advisor',
    assignedBy: 'foundation-advisor',
    returnsResultTo: 'foundation-advisor',
    sessionName: 'siasiu-worker',
  }),
  registryRow({
    roleInstanceId: 'vibenews-advisor',
    role: 'ADVISOR',
    project: 'VIBENEWS',
    stableDisplayName: 'VibeNews Advisor',
    advisorTeam: 'VIBENEWS_ADVISOR_TEAM',
    reportsToAdvisor: 'leo-gpt',
    assignedBy: 'leo-gpt',
    returnsResultTo: 'leo-gpt',
    sessionName: 'vibenews-advisor',
  }),
  registryRow({
    roleInstanceId: 'vibenews-worker',
    role: 'WORKER',
    project: 'VIBENEWS',
    stableDisplayName: 'VibeNews Worker',
    advisorTeam: 'VIBENEWS_ADVISOR_TEAM',
    reportsToAdvisor: 'vibenews-advisor',
    assignedBy: 'vibenews-advisor',
    returnsResultTo: 'vibenews-advisor',
    sessionName: 'vibenews-worker',
  }),
];

// Deterministic authoring-time id/ref helpers (pure; no clock, no randomness).
function uuidV7(seed: string): string {
  return `01983000-0000-7000-8000-${seed.padStart(12, '0')}`;
}
function sha256Ref(seed: string): string {
  return `sha256:${seed.padStart(64, '0')}`;
}

let evidenceSeq = 0;
function evidence(
  kind: AcceptedEvidenceKind,
  roleInstanceId: string,
  extra: { readonly value?: string; readonly effectiveFrom?: string } = {},
): AcceptedEvidenceRecord {
  evidenceSeq += 1;
  const seed = evidenceSeq.toString(16);
  const effectiveFrom = extra.effectiveFrom ?? '2026-07-05T00:00:00.000Z';
  return {
    schemaVersion: ACCEPTED_EVIDENCE_SCHEMA_VERSION,
    evidenceId: uuidV7(`a${seed}`),
    evidenceRef: sha256Ref(`e${seed}`),
    kind,
    roleInstanceId,
    ...(extra.value === undefined ? {} : { value: extra.value }),
    provenance: 'VERIFIED_MISSION_ARTIFACT',
    acceptanceStatus: 'ACCEPTED',
    sourceEventIds: [uuidV7(`5${seed}`)],
    observedAt: effectiveFrom,
    effectiveFrom,
  };
}

/**
 * (B) committed accepted-evidence — only facts genuinely absent from the runtime projection
 * (process/identity/model/effort + ai_ready/ai_error). Deliberately varied to exercise the
 * fail-closed contract: some actors fully attested, some partial, some with no evidence (sentinels),
 * one offline, one no-process, one contradictory-free error.
 */
export const ORGANIZATION_EVIDENCE: readonly AcceptedEvidenceRecord[] = [
  // agent-office-worker: fully attested + ready.
  evidence('process_detected', 'agent-office-worker'),
  evidence('ai_identity_attestation', 'agent-office-worker', { value: 'CLAUDE_OPUS_4_8' }),
  evidence('model_attestation', 'agent-office-worker', { value: 'claude-opus-4-8' }),
  evidence('effort_attestation', 'agent-office-worker', { value: 'ULTRACODE' }),
  evidence('ai_ready', 'agent-office-worker'),
  // foundation-reviewer: identity/model/effort attested, detected, but no ready → AI_RUNTIME_UNKNOWN.
  evidence('process_detected', 'foundation-reviewer'),
  evidence('ai_identity_attestation', 'foundation-reviewer', { value: 'GPT_5_6_SOL' }),
  evidence('model_attestation', 'foundation-reviewer', { value: 'gpt-5.6-sol' }),
  evidence('effort_attestation', 'foundation-reviewer', { value: 'XHIGH' }),
  // foundation-advisor: detected + ready, no identity/model/effort → those sentinel, runtime AI_READY.
  evidence('process_detected', 'foundation-advisor'),
  evidence('ai_ready', 'foundation-advisor'),
  // foundation-control: offline → SESSION_OFFLINE, runtime UNKNOWN.
  evidence('process_offline', 'foundation-control'),
  // cosmile-worker: no AI process → NO_AI_PROCESS, runtime UNKNOWN.
  evidence('process_absent', 'cosmile-worker'),
  // siasiu-worker: NO evidence at all → every §2.3 fact fails closed to its sentinel.
  // vibenews-advisor: detected + error → AI_ERROR.
  evidence('process_detected', 'vibenews-advisor'),
  evidence('ai_error', 'vibenews-advisor'),
  // vibenews-worker: detected + full attestation + ready.
  evidence('process_detected', 'vibenews-worker'),
  evidence('ai_identity_attestation', 'vibenews-worker', { value: 'FABLE_5' }),
  evidence('model_attestation', 'vibenews-worker', { value: 'fable-5' }),
  evidence('effort_attestation', 'vibenews-worker', { value: 'HIGH' }),
  evidence('ai_ready', 'vibenews-worker'),
];

export const ORGANIZATION_FIXTURE = {
  registry: ORGANIZATION_REGISTRY,
  evidence: ORGANIZATION_EVIDENCE,
} as const;
