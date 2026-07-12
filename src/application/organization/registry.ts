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
  const resolved = new Map<string, OrganizationRegistryRow>();
  for (const [roleInstanceId, group] of byId) {
    if (group.length > 1) {
      diagnostics.push({ code: 'DUPLICATE_REGISTRY_ROLE_INSTANCE_ID', roleInstanceId, detail: `registry has ${group.length} rows for ${roleInstanceId}; all dropped (no cloned identity)` });
      continue;
    }
    const [only] = group;
    if (only !== undefined) resolved.set(roleInstanceId, only);
  }
  return { rows: resolved, diagnostics };
}
