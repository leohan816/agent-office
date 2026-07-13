// Agent Office Batch A — production render input composition + runtime validation.
//
// Design delta §2.3 (PR-1/PR-2/PR-3), contract §3.1/§3.1.1/§3.1.2. Two untrusted boundaries:
//  (1) `parseRawLivingOfficePresentation` — validates the raw `livingOffice` subtree (contract §3.1.2)
//      before it enters client state; invalid → null (shell falls back DOM_STATIC→M1_FIXED_STATIONS).
//  (2) `parseLivingOfficeProductionRenderInput` — validates the composed seven-field render wrapper
//      (contract §3.1.1) before the lazy Pixi renderer mounts; a cast is not validation.
// The deterministic pod assembly (config + RT, no inference) is `assembleOfficeLayout` (contract §3.1).
import type { LivingOfficePresentationV1 } from '../../runtime/projection.js';
import type {
  CommittedOfficeLayoutConfigV1,
  CommittedRoleCategory,
  LivingOfficeProductionRenderInputV1,
  PixelActorInput,
  PixelOperationalState,
  PixelPodInput,
  PixelProjectIdentity,
} from '../../ui/pixel/contracts.js';
import { isUtcTimestamp } from './evidence.js';
import { DEFAULT_LOGICAL_TIME_MS, DEFAULT_VIEWPORT } from './office-layout-config.js';
import {
  ADVISOR_TEAM_UNASSIGNED,
  ADVISOR_TEAMS,
  AI_RUNTIME_STATES,
  ORGANIZATION_ROLES,
  ORGANIZATION_UNKNOWN,
  SESSION_PROCESS_VALUES,
  type OrganizationDiagnostic,
  type OrganizationFact,
  type OrganizationFrameActor,
  type PixelActorFactSource,
} from './types.js';

// Complete literal current-actor priority over all 14 PixelOperationalState values (contract §3.1).
const CURRENT_ACTOR_PRIORITY: readonly PixelOperationalState[] = [
  'WORKING', 'TESTING', 'REVIEWING', 'ROUTING / DISPATCH', 'RETURNING_RESULT', 'NEEDS_PATCH',
  'BLOCKED', 'WAITING_DEPENDENCY', 'WAITING_LEO', 'FAILED', 'CANCELLED', 'COMPLETED', 'IDLE', 'UNKNOWN',
];
const OPERATIONAL_STATES: ReadonlySet<string> = new Set(CURRENT_ACTOR_PRIORITY);
const ADVISOR_TEAM_VALUES: ReadonlySet<string> = new Set([...ADVISOR_TEAMS, ADVISOR_TEAM_UNASSIGNED]);
const AI_RUNTIME_VALUES: ReadonlySet<string> = new Set(AI_RUNTIME_STATES);
const SESSION_PROCESS_SET: ReadonlySet<string> = new Set(SESSION_PROCESS_VALUES);
const ROLE_VALUES: ReadonlySet<string> = new Set([...ORGANIZATION_ROLES, ORGANIZATION_UNKNOWN]);
const FACT_STATUS_VALUES: ReadonlySet<string> = new Set(['VERIFIED', 'UNVERIFIED', 'STALE', 'INVALID', 'MISSING']);
const FACT_SOURCE_VALUES: ReadonlySet<string> = new Set<PixelActorFactSource>([
  'VERIFIED_REGISTRY', 'VERIFIED_MISSION_ARTIFACT', 'CANONICAL_FIXTURE', 'SYNTHETIC_FIXTURE', 'UNVERIFIED',
]);
const DIAGNOSTIC_CODES: ReadonlySet<string> = new Set([
  'INVALID_REGISTRY_ROLE_INSTANCE_ID', 'DUPLICATE_REGISTRY_ROLE_INSTANCE_ID', 'EVIDENCE_ID_COLLISION',
  'SESSION_PROCESS_CONTRADICTION', 'ATTESTATION_VALUE_CONFLICT', 'RUNTIME_OWNED_FIELD_CONFLICT',
]);

const RAW_PRESENTATION_KEYS = ['schemaVersion', 'projectionRevision', 'evaluatedAt', 'frame'] as const;
const ACTOR_ENVELOPE_FIELDS = [
  'role', 'project', 'stableDisplayName', 'advisorTeam', 'reportsToAdvisor', 'assignedBy',
  'returnsResultTo', 'sessionName', 'sessionProcess', 'aiIdentity', 'model', 'effort',
  'aiRuntimeState', 'operationalState', 'mission', 'workUnit',
] as const;
const ACTOR_KEYS = [...ACTOR_ENVELOPE_FIELDS, 'roleInstanceId', 'canReceiveWork'] as const;
const ENVELOPE_ENUM: Partial<Record<(typeof ACTOR_ENVELOPE_FIELDS)[number], ReadonlySet<string>>> = {
  role: ROLE_VALUES,
  advisorTeam: ADVISOR_TEAM_VALUES,
  sessionProcess: SESSION_PROCESS_SET,
  aiRuntimeState: AI_RUNTIME_VALUES,
  operationalState: OPERATIONAL_STATES,
};
const WRAPPER_KEYS = ['schemaVersion', 'operational', 'committedLayout', 'viewport', 'logicalTimeMs', 'selection', 'cues'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const set = new Set(keys);
  return Object.keys(value).length === keys.length && Object.keys(value).every((key) => set.has(key));
}
function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function validateEnvelope(value: unknown, field: (typeof ACTOR_ENVELOPE_FIELDS)[number]): boolean {
  if (!isRecord(value) || !hasExactKeys(value, ['value', 'source', 'status', 'evidenceTimestamp'])) return false;
  if (typeof value.value !== 'string') return false;
  if (typeof value.source !== 'string' || !FACT_SOURCE_VALUES.has(value.source)) return false;
  if (typeof value.status !== 'string' || !FACT_STATUS_VALUES.has(value.status)) return false;
  if (value.evidenceTimestamp !== null && !(typeof value.evidenceTimestamp === 'string' && isUtcTimestamp(value.evidenceTimestamp))) return false;
  const vocabulary = ENVELOPE_ENUM[field];
  if (vocabulary !== undefined && !vocabulary.has(value.value)) return false;
  return true;
}

function validateRawActor(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, ACTOR_KEYS)) return false;
  if (!isNonBlankString(value.roleInstanceId)) return false;
  if (typeof value.canReceiveWork !== 'boolean') return false;
  for (const field of ACTOR_ENVELOPE_FIELDS) if (!validateEnvelope(value[field], field)) return false;
  const advisorTeam = value.advisorTeam as { readonly value: string };
  if (advisorTeam.value === ADVISOR_TEAM_UNASSIGNED && value.canReceiveWork) return false;
  return true;
}

function validateRawDiagnostic(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, ['code', 'roleInstanceId', 'detail'])) return false;
  if (typeof value.code !== 'string' || !DIAGNOSTIC_CODES.has(value.code)) return false;
  if (value.roleInstanceId !== null && !isNonBlankString(value.roleInstanceId)) return false;
  return isNonBlankString(value.detail);
}

/**
 * First untrusted boundary (contract §3.1.2 FDR-2): validate the raw `livingOffice` subtree exactly.
 * `enclosingRevision` is the already-validated enclosing snapshot revision. Invalid → null.
 */
export function parseRawLivingOfficePresentation(
  value: unknown,
  enclosingRevision: number,
): LivingOfficePresentationV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, RAW_PRESENTATION_KEYS)) return null;
  if (value.schemaVersion !== 'agent-office.living-office-presentation.v1') return null;
  if (typeof value.projectionRevision !== 'number' || !Number.isSafeInteger(value.projectionRevision)) return null;
  if (value.projectionRevision < 0 || value.projectionRevision !== enclosingRevision) return null;
  if (typeof value.evaluatedAt !== 'string' || !isUtcTimestamp(value.evaluatedAt)) return null;
  const frame = value.frame;
  if (!isRecord(frame) || !hasExactKeys(frame, ['actors', 'diagnostics'])) return null;
  if (!Array.isArray(frame.actors) || !Array.isArray(frame.diagnostics)) return null;
  if (!frame.actors.every(validateRawActor)) return null;
  if (!frame.diagnostics.every(validateRawDiagnostic)) return null;
  const seen = new Set<string>();
  for (const actor of frame.actors as readonly { readonly roleInstanceId: string }[]) {
    if (seen.has(actor.roleInstanceId)) return null; // duplicate roleInstanceId fails closed
    seen.add(actor.roleInstanceId);
  }
  return value as unknown as LivingOfficePresentationV1;
}

function truncate(value: string, max = 48): string {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}
function operationalRank(state: PixelOperationalState): number {
  const index = CURRENT_ACTOR_PRIORITY.indexOf(state);
  return index < 0 ? CURRENT_ACTOR_PRIORITY.length : index;
}

export interface OfficeLayoutAssembly {
  readonly pods: readonly PixelPodInput[];
  readonly actors: readonly PixelActorInput[];
  readonly diagnostics: readonly OrganizationDiagnostic[];
  readonly fallbackTier: 'NONE' | 'M1_FIXED_STATIONS';
}

/** Deterministic pod/actor assembly from committed config + RT actors (contract §3.1; no inference). */
export function assembleOfficeLayout(
  operational: LivingOfficePresentationV1,
  committedLayout: CommittedOfficeLayoutConfigV1,
): OfficeLayoutAssembly {
  const diagnostics: OrganizationDiagnostic[] = [];
  const actorsById = new Map<string, OrganizationFrameActor>();
  for (const actor of operational.frame.actors) actorsById.set(actor.roleInstanceId, actor);

  // Membership: an actor in more than one pod is dropped from all pods (no cloned membership).
  const membershipCount = new Map<string, number>();
  for (const pod of committedLayout.pods) {
    for (const id of pod.memberRoleInstanceIds) membershipCount.set(id, (membershipCount.get(id) ?? 0) + 1);
  }
  const multiPod = new Set([...membershipCount].filter(([, count]) => count > 1).map(([id]) => id));
  for (const id of multiPod) diagnostics.push({ code: 'RUNTIME_OWNED_FIELD_CONFLICT', roleInstanceId: id, detail: `actor ${id} listed in multiple pods; dropped from all` });

  const pods: PixelPodInput[] = [];
  const actorInputs: PixelActorInput[] = [];
  const orderedPods = [...committedLayout.pods].sort((left, right) => left.podId.localeCompare(right.podId, 'en'));

  for (const pod of orderedPods) {
    const members = pod.memberRoleInstanceIds
      .filter((id) => !multiPod.has(id))
      .map((id) => actorsById.get(id))
      .filter((actor): actor is OrganizationFrameActor => actor !== undefined);
    if (members.length === 0) {
      diagnostics.push({ code: 'RUNTIME_OWNED_FIELD_CONFLICT', roleInstanceId: pod.podId, detail: `pod ${pod.podId} has no resolved members; omitted` });
      continue;
    }
    const responsible = pod.responsibleAdvisorRoleInstanceId === null
      ? undefined
      : members.find((actor) =>
        actor.roleInstanceId === pod.responsibleAdvisorRoleInstanceId
        && actor.role.value === 'ADVISOR'
        && actor.advisorTeam.value === pod.advisorTeamId);
    if (responsible === undefined) {
      diagnostics.push({ code: 'RUNTIME_OWNED_FIELD_CONFLICT', roleInstanceId: pod.podId, detail: `pod ${pod.podId} lacks exactly one matching-Team ADVISOR responsible; omitted` });
      continue;
    }
    const current = members.reduce((best, actor) => {
      const delta = operationalRank(actor.operationalState.value) - operationalRank(best.operationalState.value);
      if (delta < 0) return actor;
      if (delta === 0 && actor.roleInstanceId.localeCompare(best.roleInstanceId, 'en') < 0) return actor;
      return best;
    });
    const identity: PixelProjectIdentity = committedLayout.projectIdentityByProject[pod.projectKey] ?? committedLayout.defaultProjectIdentity;
    const sortedMemberIds = members.map((actor) => actor.roleInstanceId).sort((left, right) => left.localeCompare(right, 'en'));

    pods.push({
      podId: pod.podId,
      advisorTeamId: pod.advisorTeamId,
      responsibleAdvisorRoleInstanceId: responsible.roleInstanceId,
      projectIdentity: identity,
      missionShortLabel: truncate(current.mission.value),
      currentWorkUnitShortId: truncate(current.workUnit.value, 24),
      currentActorRoleInstanceId: current.roleInstanceId,
      operationalState: current.operationalState.value,
      completedWorkUnits: 0,
      totalWorkUnits: 0,
      completedGates: 0,
      totalGates: 0,
      blockerSummary: null,
      actorRoleInstanceIds: sortedMemberIds,
    });

    for (const actor of members) {
      const roleCategory: CommittedRoleCategory = actor.role.value === ORGANIZATION_UNKNOWN
        ? committedLayout.defaultRoleCategory
        : committedLayout.roleCategoryByRole[actor.role.value];
      actorInputs.push({
        roleInstanceId: actor.roleInstanceId,
        displayName: actor.stableDisplayName.value,
        roleCategory: roleCategoryToPixel(roleCategory),
        advisorTeamId: pod.advisorTeamId,
        responsibleAdvisorRoleInstanceId: responsible.roleInstanceId,
        projectId: identity.projectId,
        assignmentVerified: actor.canReceiveWork,
        presentationPodId: pod.podId,
        facts: legacyFactsInput(actor),
        organizationFacts: actor,
      });
    }
  }

  return { pods, actors: actorInputs, diagnostics, fallbackTier: pods.length === 0 ? 'M1_FIXED_STATIONS' : 'NONE' };
}

function roleCategoryToPixel(category: CommittedRoleCategory): PixelActorInput['roleCategory'] {
  switch (category) {
    case 'LEO_DECISION': return 'LEO_DECISION';
    case 'ADVISOR_ROUTING': return 'ADVISOR_ROUTING';
    case 'CONTROL_RECOVERY': return 'CONTROL_RECOVERY';
    case 'INDEPENDENT_REVIEW': return 'INDEPENDENT_REVIEW';
    case 'WORKER_BUILD': return 'WORKER_BUILD';
    case 'GENERIC_REGISTERED': return 'GENERIC_REGISTERED';
  }
}

function factInput(fact: OrganizationFact): { readonly value: string; readonly source: PixelActorFactSource } {
  return { value: fact.value, source: fact.source };
}
function legacyFactsInput(actor: OrganizationFrameActor): PixelActorInput['facts'] {
  return {
    role: factInput(actor.role),
    project: factInput(actor.project),
    advisorTeam: factInput(actor.advisorTeam),
    reportsToAdvisor: factInput(actor.reportsToAdvisor),
    sessionName: factInput(actor.sessionName),
    model: factInput(actor.model),
    state: factInput(actor.operationalState),
    mission: factInput(actor.mission),
    workUnit: factInput(actor.workUnit),
    evidenceFreshness: factInput(actor.aiRuntimeState),
  };
}

export type ProductionRenderInputResult =
  | { readonly ok: true; readonly value: LivingOfficeProductionRenderInputV1 }
  | { readonly ok: false; readonly reason: string; readonly fallbackTier: 'DOM_STATIC' | 'M1_FIXED_STATIONS' };

function finiteAbove(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum;
}

/**
 * Second untrusted boundary (contract §3.1.1/PR-3): validate the composed render wrapper exactly.
 * Branches on runtime typeof/enum-membership; a cast is not validation. Fails closed to a tier.
 */
export function parseLivingOfficeProductionRenderInput(raw: unknown): ProductionRenderInputResult {
  if (!isRecord(raw) || !hasExactKeys(raw, WRAPPER_KEYS)) {
    return { ok: false, reason: 'WRAPPER_SHAPE', fallbackTier: 'DOM_STATIC' };
  }
  if (raw.schemaVersion !== 'agent-office.living-office-production-render-input.v1') {
    return { ok: false, reason: 'WRAPPER_SCHEMA', fallbackTier: 'DOM_STATIC' };
  }
  const operational = isRecord(raw.operational) && typeof raw.operational.projectionRevision === 'number'
    ? parseRawLivingOfficePresentation(raw.operational, raw.operational.projectionRevision)
    : null;
  if (operational === null) return { ok: false, reason: 'OPERATIONAL', fallbackTier: 'DOM_STATIC' };
  if (!isRecord(raw.committedLayout) || raw.committedLayout.schemaVersion !== 'agent-office.committed-office-layout-config.v1') {
    return { ok: false, reason: 'LAYOUT_SCHEMA', fallbackTier: 'DOM_STATIC' };
  }
  if (!Array.isArray(raw.cues) || raw.cues.length !== 0) {
    return { ok: false, reason: 'CUES_NON_EMPTY', fallbackTier: 'DOM_STATIC' };
  }
  const committedLayout = raw.committedLayout as unknown as CommittedOfficeLayoutConfigV1;
  const assembly = assembleOfficeLayout(operational, committedLayout);
  if (assembly.fallbackTier === 'M1_FIXED_STATIONS') {
    return { ok: false, reason: 'NO_VALID_PODS', fallbackTier: 'M1_FIXED_STATIONS' };
  }
  const rawViewport = isRecord(raw.viewport) ? raw.viewport : {};
  const viewport = {
    width: finiteAbove(rawViewport.width, Number.MIN_VALUE) ? rawViewport.width : DEFAULT_VIEWPORT.width,
    height: finiteAbove(rawViewport.height, Number.MIN_VALUE) ? rawViewport.height : DEFAULT_VIEWPORT.height,
  };
  const logicalTimeMs = finiteAbove(raw.logicalTimeMs, 0) ? raw.logicalTimeMs : DEFAULT_LOGICAL_TIME_MS;
  const requestedSelection = isRecord(raw.selection) && typeof raw.selection.selectedPodId === 'string'
    ? raw.selection.selectedPodId
    : '';
  const validPodIds = new Set(assembly.pods.map((pod) => pod.podId));
  const selectedPodId = validPodIds.has(requestedSelection)
    ? requestedSelection
    : validPodIds.has(committedLayout.selectedDefaultPodId)
      ? committedLayout.selectedDefaultPodId
      : null;
  if (selectedPodId === null) return { ok: false, reason: 'SELECTION', fallbackTier: 'M1_FIXED_STATIONS' };

  return {
    ok: true,
    value: {
      schemaVersion: 'agent-office.living-office-production-render-input.v1',
      operational,
      committedLayout,
      viewport,
      logicalTimeMs,
      selection: { selectedPodId },
      cues: [],
    },
  };
}

/** Compose the wrapper from an already-validated operational view + committed layout (helper for callers). */
export function composeLivingOfficeProductionRenderInput(input: {
  readonly operational: LivingOfficePresentationV1;
  readonly committedLayout: CommittedOfficeLayoutConfigV1;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly selectedPodId: string;
  readonly logicalTimeMs: number;
}): LivingOfficeProductionRenderInputV1 {
  return {
    schemaVersion: 'agent-office.living-office-production-render-input.v1',
    operational: input.operational,
    committedLayout: input.committedLayout,
    viewport: input.viewport,
    logicalTimeMs: input.logicalTimeMs,
    selection: { selectedPodId: input.selectedPodId },
    cues: [],
  };
}
