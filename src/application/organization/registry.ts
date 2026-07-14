// Agent Office Batch A — committed identity/organization registry (A) normalization.
//
// Contract §2.1 (identity attributes), §2.2 (organizational bindings + allowed-token metadata),
// §2.6 (fail-closed normalization). The registry is immutable per reviewed commit and stores no
// changing fact. A row without a valid `roleInstanceId` is dropped + reported (never a sentinel);
// a duplicated `roleInstanceId` drops every row of that id (no cloned identity).
import {
  ADVISOR_TEAM_UNASSIGNED,
  ADVISOR_TEAMS,
  ORGANIZATION_ROLES,
  ORGANIZATION_UNKNOWN,
  type AdvisorTeamValue,
  type OrganizationDiagnostic,
  type OrganizationFact,
  type OrganizationRegistryRow,
  type OrganizationRole,
  type PixelActorFactSource,
} from './types.js';

function verifiedFact<TValue extends string>(value: TValue, source: PixelActorFactSource): OrganizationFact<TValue> {
  return { value, source, status: 'VERIFIED', evidenceTimestamp: null };
}

/** Free-text identity/binding field → literal UNKNOWN on blank/UNVERIFIED-source (contract §2.6). */
export function normalizeRegistryText(
  value: string | null | undefined,
  provenance: PixelActorFactSource,
): OrganizationFact {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed === '') return { value: ORGANIZATION_UNKNOWN, source: provenance, status: 'MISSING', evidenceTimestamp: null };
  if (provenance === 'UNVERIFIED') return { value: ORGANIZATION_UNKNOWN, source: 'UNVERIFIED', status: 'UNVERIFIED', evidenceTimestamp: null };
  return verifiedFact(trimmed, provenance);
}

export function normalizeRegistryRole(
  value: string,
  provenance: PixelActorFactSource,
): OrganizationFact<OrganizationRole | typeof ORGANIZATION_UNKNOWN> {
  if (provenance === 'UNVERIFIED') return { value: ORGANIZATION_UNKNOWN, source: 'UNVERIFIED', status: 'UNVERIFIED', evidenceTimestamp: null };
  if ((ORGANIZATION_ROLES as readonly string[]).includes(value)) return verifiedFact(value as OrganizationRole, provenance);
  return { value: ORGANIZATION_UNKNOWN, source: provenance, status: value.trim() === '' ? 'MISSING' : 'INVALID', evidenceTimestamp: null };
}

export function normalizeAdvisorTeam(
  value: string,
  provenance: PixelActorFactSource,
): OrganizationFact<AdvisorTeamValue> {
  if (provenance === 'UNVERIFIED') return { value: ADVISOR_TEAM_UNASSIGNED, source: 'UNVERIFIED', status: 'UNVERIFIED', evidenceTimestamp: null };
  if ((ADVISOR_TEAMS as readonly string[]).includes(value)) return verifiedFact(value as AdvisorTeamValue, provenance);
  return { value: ADVISOR_TEAM_UNASSIGNED, source: provenance, status: value.trim() === '' ? 'MISSING' : 'INVALID', evidenceTimestamp: null };
}

export interface RegistryPartition {
  readonly rows: ReadonlyMap<string, OrganizationRegistryRow>;
  readonly diagnostics: readonly OrganizationDiagnostic[];
}

/** Drop invalid/duplicate `roleInstanceId` rows with reported diagnostics (contract §2.1/§4). */
export function partitionRegistry(rows: readonly OrganizationRegistryRow[]): RegistryPartition {
  const diagnostics: OrganizationDiagnostic[] = [];
  const byId = new Map<string, OrganizationRegistryRow[]>();
  for (const row of rows) {
    if (typeof row.roleInstanceId !== 'string' || row.roleInstanceId.trim() === '') {
      diagnostics.push({ code: 'INVALID_REGISTRY_ROLE_INSTANCE_ID', roleInstanceId: null, detail: 'registry row without a valid roleInstanceId dropped' });
      continue;
    }
    const group = byId.get(row.roleInstanceId);
    if (group === undefined) byId.set(row.roleInstanceId, [row]);
    else group.push(row);
  }
  // Accept one row per roleInstanceId (the sole join key); a duplicated id drops every row of that id.
  const byRoleInstanceId = new Map<string, OrganizationRegistryRow>();
  for (const [roleInstanceId, group] of byId) {
    if (group.length > 1) {
      diagnostics.push({ code: 'DUPLICATE_REGISTRY_ROLE_INSTANCE_ID', roleInstanceId, detail: `registry has ${group.length} rows for ${roleInstanceId}; all dropped (no cloned identity)` });
      continue;
    }
    const [only] = group;
    if (only !== undefined) byRoleInstanceId.set(roleInstanceId, only);
  }
  // Current routable identity (actorId) must be nonblank and unique across accepted rows. A blank
  // actorId drops that row; a duplicated actorId drops every sharing row — never first-win / shadow.
  const byActorId = new Map<string, { readonly roleInstanceId: string; readonly row: OrganizationRegistryRow }[]>();
  for (const [roleInstanceId, row] of byRoleInstanceId) {
    if (typeof row.actorId !== 'string' || row.actorId.trim() === '') {
      diagnostics.push({ code: 'INVALID_REGISTRY_ACTOR_ID', roleInstanceId, detail: `registry row ${roleInstanceId} without a valid actorId dropped` });
      continue;
    }
    const group = byActorId.get(row.actorId);
    if (group === undefined) byActorId.set(row.actorId, [{ roleInstanceId, row }]);
    else group.push({ roleInstanceId, row });
  }
  const resolved = new Map<string, OrganizationRegistryRow>();
  for (const [actorId, group] of byActorId) {
    if (group.length > 1) {
      diagnostics.push({
        code: 'DUPLICATE_REGISTRY_ACTOR_ID',
        roleInstanceId: null,
        detail: `registry has ${group.length} rows with actorId ${actorId} (${group.map((entry) => entry.roleInstanceId).join(', ')}); all dropped (no shadowed Actor)`,
      });
      continue;
    }
    const [only] = group;
    if (only !== undefined) resolved.set(only.roleInstanceId, only.row);
  }
  return { rows: resolved, diagnostics };
}

// ---------------------------------------------------------------------------
// (A) committed identity/organization registry data (contract §2.1/§2.2).
//
// Immutable per reviewed commit; every row is a provenance-tagged committed record (VERIFIED_REGISTRY),
// changed only by a normal reviewed commit — Batch A performs NO live discovery. Lives in `src` (not a
// repo-root fixture) so the core build (`tsconfig.build.json`, rootDir=src) emits it into `dist/core`;
// the committed test fixture `fixtures/organization-registry.ts` re-exports this authority.
// ---------------------------------------------------------------------------
const ALLOWED_AI_IDENTITIES = ['CLAUDE_OPUS_4_8', 'GPT_5_6_SOL', 'FABLE_5', 'CLAUDE_SONNET_5', 'CODEX_5_6_SOL'] as const;
const ALLOWED_MODELS = ['claude-opus-4-8', 'gpt-5.6-sol', 'fable-5', 'claude-sonnet-5', 'codex-5.6-sol'] as const;
const ALLOWED_EFFORTS = ['ULTRACODE', 'XHIGH', 'HIGH', 'MEDIUM', 'LOW'] as const;

function committedRegistryRow(
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

/**
 * (A) committed identity/organization registry — immutable internal identity (`roleInstanceId`,
 * the sole evidence join key) + current routable identity (`actorId`) + bindings + allowed tokens.
 *
 * Pre-AS1 identity migration (config-only): the continuing former Foundation Advisor keeps its
 * immutable `roleInstanceId` `foundation-advisor` (retaining every evidence record joined to it) and
 * is now the Agent Office Advisor with `actorId` `agent-office-advisor`. A newly created Foundation
 * Advisor gets a fresh internal key `foundation-advisor-20260714-01` (and thus no historical
 * evidence) with the current routable `actorId` `foundation-advisor`. Route fields carry routable
 * `actorId` values (except external authority `leo-gpt`); evidence still joins only by `roleInstanceId`.
 */
export const ORGANIZATION_REGISTRY: readonly OrganizationRegistryRow[] = [
  // Continuing former Foundation Advisor, now Agent Office Advisor. Immutable join key retained;
  // routable identity + team/project migrated to Agent Office. Keeps its `foundation-advisor` evidence.
  committedRegistryRow({
    roleInstanceId: 'foundation-advisor',
    actorId: 'agent-office-advisor',
    role: 'ADVISOR',
    project: 'AGENT_OFFICE',
    stableDisplayName: 'Agent Office Advisor',
    advisorTeam: 'AGENT_OFFICE_ADVISOR_TEAM',
    reportsToAdvisor: 'leo-gpt',
    assignedBy: 'leo-gpt',
    returnsResultTo: 'leo-gpt',
    sessionName: 'agent-office-advisor',
  }),
  // Newly created Foundation Advisor: new internal key (no historical evidence), routable actorId
  // `foundation-advisor`, responsible Advisor of the Foundation Team.
  committedRegistryRow({
    roleInstanceId: 'foundation-advisor-20260714-01',
    actorId: 'foundation-advisor',
    role: 'ADVISOR',
    project: 'FOUNDATION',
    stableDisplayName: 'Foundation Advisor',
    advisorTeam: 'FOUNDATION_ADVISOR_TEAM',
    reportsToAdvisor: 'leo-gpt',
    assignedBy: 'leo-gpt',
    returnsResultTo: 'leo-gpt',
    sessionName: 'foundation-advisor',
  }),
  committedRegistryRow({
    roleInstanceId: 'foundation-control',
    actorId: 'foundation-control',
    role: 'CONTROL',
    project: 'FOUNDATION',
    stableDisplayName: 'Foundation Control',
    advisorTeam: 'FOUNDATION_ADVISOR_TEAM',
    reportsToAdvisor: 'foundation-advisor',
    assignedBy: 'foundation-advisor',
    returnsResultTo: 'foundation-advisor',
    sessionName: 'foundation-control',
  }),
  // Agent Office Worker re-parented to the Agent Office Team; routes through the Agent Office Advisor.
  committedRegistryRow({
    roleInstanceId: 'agent-office-worker',
    actorId: 'agent-office-worker',
    role: 'WORKER',
    project: 'AGENT_OFFICE',
    stableDisplayName: 'Agent Office Worker',
    advisorTeam: 'AGENT_OFFICE_ADVISOR_TEAM',
    reportsToAdvisor: 'agent-office-advisor',
    assignedBy: 'agent-office-advisor',
    returnsResultTo: 'agent-office-advisor',
    sessionName: 'agent-office-opus',
  }),
  // Continuing reviewed Reviewer migrated to the Agent Office Reviewer. Immutable join key retained
  // (keeps its committed evidence); routable identity + project/team/route/session migrated. Reviewer
  // verdict independence is unchanged; only assignment/result routing goes through the Advisor.
  committedRegistryRow({
    roleInstanceId: 'foundation-reviewer',
    actorId: 'agent-office-reviewer',
    role: 'REVIEWER',
    project: 'AGENT_OFFICE',
    stableDisplayName: 'Independent Reviewer',
    advisorTeam: 'AGENT_OFFICE_ADVISOR_TEAM',
    reportsToAdvisor: 'agent-office-advisor',
    assignedBy: 'agent-office-advisor',
    returnsResultTo: 'agent-office-advisor',
    sessionName: 'agent-office-reviewer',
  }),
  // Registry-only Agent Office Designer (no historical evidence).
  committedRegistryRow({
    roleInstanceId: 'agent-office-designer',
    actorId: 'agent-office-designer',
    role: 'DESIGNER',
    project: 'AGENT_OFFICE',
    stableDisplayName: 'Agent Office Designer',
    advisorTeam: 'AGENT_OFFICE_ADVISOR_TEAM',
    reportsToAdvisor: 'agent-office-advisor',
    assignedBy: 'agent-office-advisor',
    returnsResultTo: 'agent-office-advisor',
    sessionName: 'agent-office-designer',
  }),
  committedRegistryRow({
    roleInstanceId: 'cosmile-worker',
    actorId: 'cosmile-worker',
    role: 'WORKER',
    project: 'COSMILE',
    stableDisplayName: 'Cosmile Worker',
    advisorTeam: 'FOUNDATION_ADVISOR_TEAM',
    reportsToAdvisor: 'foundation-advisor',
    assignedBy: 'foundation-advisor',
    returnsResultTo: 'foundation-advisor',
    sessionName: 'cosmile',
  }),
  committedRegistryRow({
    roleInstanceId: 'siasiu-worker',
    actorId: 'siasiu-worker',
    role: 'WORKER',
    project: 'SIASIU',
    stableDisplayName: 'SIASIU Worker',
    advisorTeam: 'FOUNDATION_ADVISOR_TEAM',
    reportsToAdvisor: 'foundation-advisor',
    assignedBy: 'foundation-advisor',
    returnsResultTo: 'foundation-advisor',
    sessionName: 'siasiu',
  }),
  // Registry-only Foundation Designer (no historical evidence).
  committedRegistryRow({
    roleInstanceId: 'foundation-designer',
    actorId: 'foundation-designer',
    role: 'DESIGNER',
    project: 'FOUNDATION',
    stableDisplayName: 'Foundation Designer',
    advisorTeam: 'FOUNDATION_ADVISOR_TEAM',
    reportsToAdvisor: 'foundation-advisor',
    assignedBy: 'foundation-advisor',
    returnsResultTo: 'foundation-advisor',
    sessionName: 'foundation-designer',
  }),
  // Foundation Worker (session `foundation`); routes through the Foundation Advisor.
  committedRegistryRow({
    roleInstanceId: 'foundation-worker',
    actorId: 'foundation-worker',
    role: 'WORKER',
    project: 'FOUNDATION',
    stableDisplayName: 'Foundation Worker',
    advisorTeam: 'FOUNDATION_ADVISOR_TEAM',
    reportsToAdvisor: 'foundation-advisor',
    assignedBy: 'foundation-advisor',
    returnsResultTo: 'foundation-advisor',
    sessionName: 'foundation',
  }),
  // Current independent Foundation Reviewer (session `foundation-reviewer-fable5`); assignment/result
  // route through the Foundation Advisor while verdict independence is unchanged. No historical evidence.
  committedRegistryRow({
    roleInstanceId: 'foundation-reviewer-fable5',
    actorId: 'foundation-reviewer-fable5',
    role: 'REVIEWER',
    project: 'FOUNDATION',
    stableDisplayName: 'Foundation Reviewer',
    advisorTeam: 'FOUNDATION_ADVISOR_TEAM',
    reportsToAdvisor: 'foundation-advisor',
    assignedBy: 'foundation-advisor',
    returnsResultTo: 'foundation-advisor',
    sessionName: 'foundation-reviewer-fable5',
  }),
  // VibeNews rows are read-only: only the mechanical addition of `actorId` (same existing identifier).
  committedRegistryRow({
    roleInstanceId: 'vibenews-advisor',
    actorId: 'vibenews-advisor',
    role: 'ADVISOR',
    project: 'VIBENEWS',
    stableDisplayName: 'VibeNews Advisor',
    advisorTeam: 'VIBENEWS_ADVISOR_TEAM',
    reportsToAdvisor: 'leo-gpt',
    assignedBy: 'leo-gpt',
    returnsResultTo: 'leo-gpt',
    sessionName: 'vibenews-advisor',
  }),
  committedRegistryRow({
    roleInstanceId: 'vibenews-worker',
    actorId: 'vibenews-worker',
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
