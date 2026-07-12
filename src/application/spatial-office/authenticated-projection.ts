import type { ObservationPresentation } from '../hosts/freshness.js';
import type { MissionProjection } from '../projections/mission-projector.js';
import type { DashboardViewModel, DashboardWorkUnitViewModel } from '../queries/dashboard-view-model.js';
import { isRecord } from '../../contracts/validation.js';
import {
  assertActivityCompatible,
  projectRequiredObservable,
} from '../../domain/activity/index.js';
import type { EventEnvelope } from '../../domain/events/index.js';
import type { MissionManifest } from '../../domain/manifest/index.js';
import { assertUtcTimestamp, assertUuidV7 } from '../../domain/time/index.js';
import type { WorkUnitState } from '../../domain/state-machines/work-unit.js';
import type { RoleSceneProjection, SceneConnectionState } from '../../ui/scene/types.js';
import type {
  SpatialCueEvidenceKind,
  SpatialCueFactInput,
  SpatialCueFactKind,
} from '../../ui/spatial/cue-projector.js';
import {
  FOUNDATION_ADVISOR_TEAM_ID,
  FOUNDATION_ADVISOR_TEAM_ROLES,
  VIBENEWS_ADVISOR_TEAM_ID,
  VIBENEWS_ADVISOR_TEAM_ROLES,
  resolveSpatialAssignments,
  type AdvisorTeamAuthorityInput,
  type SpatialActorRegistrationInput,
  type SpatialWorkAssignmentInput,
} from './assignment-resolver.js';
import { projectSpatialOffice } from './projector.js';
import type {
  SpatialAlertSummary,
  SpatialAuthorityStatus,
  SpatialConnectionState,
  SpatialDisplayFact,
  SpatialEvidenceFreshness,
  SpatialEvidenceSummary,
  SpatialMissionBoard,
  SpatialMissionSummary,
  SpatialOfficeProjectionV1,
  SpatialOperationalState,
  SpatialProgressFact,
  SpatialSourceManifestRef,
  SpatialTruthState,
} from './types.js';
import { parseSpatialOfficeProjection } from './validation.js';

export const AUTHENTICATED_SPATIAL_PRESENTATION_SCHEMA_VERSION =
  'agent-office.authenticated-spatial-presentation.v1' as const;

export const AUTHENTICATED_SPATIAL_CUE_SLICE_SCHEMA_VERSION =
  'agent-office.authenticated-spatial-cue-slice.v1' as const;

export interface AuthenticatedSpatialActorObservationInput {
  readonly roleInstanceId: string;
  readonly actorRole: string;
  readonly projectId: string;
  readonly hostId: string;
  readonly presentation: ObservationPresentation;
  readonly connectionState: SceneConnectionState;
  readonly evidenceRefs: readonly string[];
}

export interface AuthenticatedSpatialObservationInput {
  readonly manifestStatus: 'VERIFIED' | 'UNVERIFIED' | 'STALE' | 'DIRTY' | 'INVALID' | 'MISSING';
  readonly manifestEvidenceId: string;
  readonly refreshedAt: string;
  readonly actors: Readonly<Record<string, AuthenticatedSpatialActorObservationInput>>;
}

export interface AuthenticatedSpatialCueSliceV1 {
  readonly schemaVersion: typeof AUTHENTICATED_SPATIAL_CUE_SLICE_SCHEMA_VERSION;
  readonly projectionRevision: number;
  readonly evaluatedAt: string;
  readonly activityEffectiveFrom?: string;
  readonly podId: string;
  readonly roleInstanceId: string;
  readonly missionId: string;
  readonly manifestVersion: string;
  readonly missionSequence: number;
  readonly acceptedEventIds: readonly string[];
  readonly fact: SpatialCueFactInput;
}

export interface AuthenticatedSpatialPresentationV1 {
  readonly schemaVersion: typeof AUTHENTICATED_SPATIAL_PRESENTATION_SCHEMA_VERSION;
  readonly projection: SpatialOfficeProjectionV1;
  readonly cueSlices: readonly AuthenticatedSpatialCueSliceV1[];
}

export interface AuthenticatedSpatialProjectionInput {
  readonly manifest: MissionManifest;
  readonly mission: MissionProjection;
  readonly dashboard: DashboardViewModel;
  readonly sceneRoles: readonly RoleSceneProjection[];
  readonly events: readonly EventEnvelope[];
  readonly observations: AuthenticatedSpatialObservationInput;
  readonly projectionRevision: number;
  readonly alertSummary: SpatialAlertSummary;
}

export function buildAuthenticatedSpatialPresentation(
  input: AuthenticatedSpatialProjectionInput,
): AuthenticatedSpatialPresentationV1 {
  assertProjectionInput(input);
  const acceptedEventIds = input.events
    .filter((event) => event.missionId === input.mission.missionId)
    .map((event) => event.eventId)
    .sort();
  const eventsById = new Map(input.events.map((event) => [event.eventId, event]));
  const projectIds = [...new Set(input.sceneRoles.map((role) =>
    requireActorObservation(input, role).projectId))].sort();
  const teams = projectIds.map((projectId) => teamInput(input, projectId));
  const actors = input.sceneRoles.map((role) => actorInput(input, role));
  const workAssignments = input.sceneRoles.flatMap((role) =>
    assignmentInput(input, role, acceptedEventIds));
  const assignments = resolveSpatialAssignments({ teams, actors, workAssignments });
  const evidenceSummary = projectEvidenceSummary(input);
  const projectName = projectDisplayName(input);
  const projects = projectIds.map((projectId) => {
    const projectActors = input.sceneRoles
      .map((role) => ({ role, observation: requireActorObservation(input, role) }))
      .filter(({ observation }) => observation.projectId === projectId);
    const advisorActors = projectActors.filter(({ role }) => isAdvisorRole(role.actorRole));
    const team = teams.find((candidate) => candidate.memberRoleInstanceIds.some((roleInstanceId) =>
      projectActors.some(({ role }) => role.roleInstanceId === roleInstanceId)));
    const authorityStatus: SpatialAuthorityStatus =
      input.observations.manifestStatus !== 'VERIFIED'
        ? 'UNVERIFIED'
        : advisorActors.length > 1
          ? 'CONFLICT'
          : advisorActors.length === 0 || team?.authorityEvidenceStatus !== 'VERIFIED'
            ? 'UNKNOWN'
            : 'VERIFIED';
    const advisor = advisorActors.length === 1 ? advisorActors[0]?.role : undefined;
    return {
      projectId,
      displayName: projectId === normalizedInitiativeProjectId(input.manifest)
        ? projectName
        : projectId,
      advisorTeamId: team?.advisorTeamId ?? FOUNDATION_ADVISOR_TEAM_ID,
      projectIdentity: {
        catalogEntryId: `registered.${projectId}`,
        textId: projectId,
        displayName: projectId === normalizedInitiativeProjectId(input.manifest)
          ? projectName
          : projectId,
      },
      authorityStatus,
      evidenceFreshness: worstEvidenceFreshness(projectActors.map(({ observation }) => observation.presentation)),
      connectionState: worstConnection(projectActors.map(({ observation }) => observation.connectionState)),
      responsibleAdvisorRoleInstanceId: advisor?.roleInstanceId ?? null,
      responsibleAdvisorDisplayIdentity: advisor === undefined
        ? truthFact(authorityStatus === 'CONFLICT' ? 'CONFLICT' : 'UNKNOWN')
        : knownFact(advisor.actorRole),
      alertSummary: input.alertSummary,
      evidenceSummary,
    };
  });
  const missionProjectId = normalizedInitiativeProjectId(input.manifest);
  const currentProject = projects.find((project) => project.projectId === missionProjectId)
    ?? projects[0];
  const missions = currentProject === undefined
    ? []
    : [verifiedMissionInput(input, currentProject.projectId, teams, assignments)];
  const projection = projectSpatialOffice({
    projectionRevision: input.projectionRevision,
    evaluatedAt: input.observations.refreshedAt,
    initiativeRef: input.manifest.initiative.id,
    identityCatalogVersion: 'agent-office.project-identity.v1',
    projects,
    missions,
    assignments,
    sourceEventIds: acceptedEventIds,
    selection: { explicitPodId: null, explicitMissionRef: null, deepLinkedMissionRef: null },
  });
  const cueSlices = input.sceneRoles.flatMap((role) => {
    const fact = cueFactForRole(role, eventsById, acceptedEventIds, input.observations.refreshedAt);
    if (fact === undefined || role.workUnitId === undefined) return [];
    return [{
      schemaVersion: AUTHENTICATED_SPATIAL_CUE_SLICE_SCHEMA_VERSION,
      projectionRevision: input.projectionRevision,
      evaluatedAt: input.observations.refreshedAt,
      ...(role.activity?.effectiveFrom === undefined
        ? {}
        : { activityEffectiveFrom: role.activity.effectiveFrom }),
      podId: `pod:${requireActorObservation(input, role).projectId}`,
      roleInstanceId: role.roleInstanceId,
      missionId: input.mission.missionId,
      manifestVersion: String(input.mission.manifestVersion),
      missionSequence: input.mission.sequence,
      acceptedEventIds,
      fact,
    } satisfies AuthenticatedSpatialCueSliceV1];
  }).sort((left, right) => left.roleInstanceId.localeCompare(right.roleInstanceId));
  return parseAuthenticatedSpatialPresentation({
    schemaVersion: AUTHENTICATED_SPATIAL_PRESENTATION_SCHEMA_VERSION,
    projection,
    cueSlices,
  });
}

export function parseAuthenticatedSpatialPresentation(
  value: unknown,
): AuthenticatedSpatialPresentationV1 {
  const presentation = requireRecord(value, 'authenticated spatial presentation');
  assertExactKeys(presentation, ['schemaVersion', 'projection', 'cueSlices'], 'authenticated spatial presentation');
  if (presentation.schemaVersion !== AUTHENTICATED_SPATIAL_PRESENTATION_SCHEMA_VERSION) {
    throw new TypeError('unsupported authenticated spatial presentation schema');
  }
  const projection = parseSpatialOfficeProjection(presentation.projection);
  assertUtcTimestamp(projection.evaluatedAt, 'spatial projection evaluatedAt');
  if (!Array.isArray(presentation.cueSlices)) {
    throw new TypeError('authenticated spatial cueSlices must be an array');
  }
  const cueSlices = presentation.cueSlices.map((candidate, index) =>
    parseCueSlice(candidate, projection, index));
  const roleIds = new Set(Object.keys(projection.actorsByRoleInstanceId));
  const podIds = new Set(projection.pods.map((pod) => pod.podId));
  for (const slice of cueSlices) {
    if (!roleIds.has(slice.roleInstanceId) || !podIds.has(slice.podId)) {
      throw new TypeError('authenticated spatial cue slice crosses projection identity');
    }
  }
  return {
    schemaVersion: AUTHENTICATED_SPATIAL_PRESENTATION_SCHEMA_VERSION,
    projection,
    cueSlices,
  };
}

function parseCueSlice(
  value: unknown,
  projection: SpatialOfficeProjectionV1,
  index: number,
): AuthenticatedSpatialCueSliceV1 {
  const path = `authenticated spatial cueSlices[${String(index)}]`;
  const slice = requireRecord(value, path);
  const expectedKeys = [
    'schemaVersion',
    'projectionRevision',
    'evaluatedAt',
    ...(Object.hasOwn(slice, 'activityEffectiveFrom') ? ['activityEffectiveFrom'] : []),
    'podId',
    'roleInstanceId',
    'missionId',
    'manifestVersion',
    'missionSequence',
    'acceptedEventIds',
    'fact',
  ];
  assertExactKeys(slice, expectedKeys, path);
  if (slice.schemaVersion !== AUTHENTICATED_SPATIAL_CUE_SLICE_SCHEMA_VERSION) {
    throw new TypeError(`${path} schema is unsupported`);
  }
  if (
    !Number.isSafeInteger(slice.projectionRevision)
    || slice.projectionRevision !== projection.projectionRevision
    || !Number.isSafeInteger(slice.missionSequence)
    || (slice.missionSequence as number) < 0
  ) {
    throw new TypeError(`${path} revision is invalid`);
  }
  const evaluatedAt = requireString(slice.evaluatedAt, `${path}.evaluatedAt`);
  const activityEffectiveFrom = slice.activityEffectiveFrom === undefined
    ? undefined
    : requireString(slice.activityEffectiveFrom, `${path}.activityEffectiveFrom`);
  assertUtcTimestamp(evaluatedAt, `${path}.evaluatedAt`);
  if (activityEffectiveFrom !== undefined) {
    assertUtcTimestamp(activityEffectiveFrom, `${path}.activityEffectiveFrom`);
  }
  if (evaluatedAt !== projection.evaluatedAt) {
    throw new TypeError(`${path} evaluatedAt does not match projection`);
  }
  const acceptedEventIds = requireStringArray(slice.acceptedEventIds, `${path}.acceptedEventIds`);
  acceptedEventIds.forEach((eventId) => assertUuidV7(eventId, `${path}.acceptedEventIds`));
  if (new Set(acceptedEventIds).size !== acceptedEventIds.length) {
    throw new TypeError(`${path}.acceptedEventIds contains duplicates`);
  }
  const fact = parseCueFact(slice.fact, path);
  if (
    fact.sourceEventIds.some((eventId) => !acceptedEventIds.includes(eventId))
    || (fact.activity?.optionalExpiresAt !== undefined
      && activityEffectiveFrom !== undefined
      && fact.activity.optionalExpiresAt <= activityEffectiveFrom)
  ) {
    throw new TypeError(`${path} source or expiry correspondence is invalid`);
  }
  return {
    schemaVersion: AUTHENTICATED_SPATIAL_CUE_SLICE_SCHEMA_VERSION,
    projectionRevision: slice.projectionRevision,
    evaluatedAt,
    ...(activityEffectiveFrom === undefined
      ? {}
      : { activityEffectiveFrom }),
    podId: requireString(slice.podId, `${path}.podId`),
    roleInstanceId: requireString(slice.roleInstanceId, `${path}.roleInstanceId`),
    missionId: requireString(slice.missionId, `${path}.missionId`),
    manifestVersion: requireString(slice.manifestVersion, `${path}.manifestVersion`),
    missionSequence: slice.missionSequence as number,
    acceptedEventIds,
    fact,
  };
}

function parseCueFact(value: unknown, path: string): SpatialCueFactInput {
  const fact = requireRecord(value, `${path}.fact`);
  const allowed = new Set([
    'factKind',
    'sourceEventIds',
    'workUnitId',
    'previousWorkUnitState',
    'workUnitState',
    'stateSourceEventId',
    'requiredObservableName',
    'activity',
    'verifiedEvidence',
    'currentZoneId',
    'recoveryStep',
    'recoveryTotalSteps',
    'recoveryReadOnly',
    'acceptedAssignmentEnd',
  ]);
  if (Object.keys(fact).some((key) => !allowed.has(key))) {
    throw new TypeError(`${path}.fact contains an unknown field`);
  }
  const sourceEventIds = requireStringArray(fact.sourceEventIds, `${path}.fact.sourceEventIds`);
  sourceEventIds.forEach((eventId) => assertUuidV7(eventId, `${path}.fact.sourceEventIds`));
  const verifiedEvidence = requireStringArray(fact.verifiedEvidence, `${path}.fact.verifiedEvidence`);
  let activity: SpatialCueFactInput['activity'];
  if (fact.activity !== undefined) {
    const record = requireRecord(fact.activity, `${path}.fact.activity`);
    const activityKeys = [
      'activity',
      'reasonCode',
      'sourceEventIds',
      ...(Object.hasOwn(record, 'optionalExpiresAt') ? ['optionalExpiresAt'] : []),
    ];
    assertExactKeys(record, activityKeys, `${path}.fact.activity`);
    const activitySourceEventIds = requireStringArray(record.sourceEventIds, `${path}.fact.activity.sourceEventIds`);
    activitySourceEventIds.forEach((eventId) => assertUuidV7(eventId, `${path}.fact.activity.sourceEventIds`));
    if (record.optionalExpiresAt !== undefined) {
      assertUtcTimestamp(requireString(record.optionalExpiresAt, `${path}.fact.activity.optionalExpiresAt`));
    }
    activity = {
      activity: requireString(record.activity, `${path}.fact.activity.activity`) as NonNullable<SpatialCueFactInput['activity']>['activity'],
      reasonCode: requireString(record.reasonCode, `${path}.fact.activity.reasonCode`),
      sourceEventIds: activitySourceEventIds,
      ...(record.optionalExpiresAt === undefined
        ? {}
        : { optionalExpiresAt: record.optionalExpiresAt as string }),
    };
  }
  return {
    factKind: requireString(fact.factKind, `${path}.fact.factKind`) as SpatialCueFactKind,
    sourceEventIds,
    ...(fact.workUnitId === undefined ? {} : { workUnitId: requireString(fact.workUnitId, `${path}.fact.workUnitId`) }),
    ...(fact.previousWorkUnitState === undefined
      ? {}
      : { previousWorkUnitState: requireString(fact.previousWorkUnitState, `${path}.fact.previousWorkUnitState`) as WorkUnitState }),
    ...(fact.workUnitState === undefined
      ? {}
      : { workUnitState: requireString(fact.workUnitState, `${path}.fact.workUnitState`) as WorkUnitState }),
    ...(fact.stateSourceEventId === undefined
      ? {}
      : { stateSourceEventId: requireString(fact.stateSourceEventId, `${path}.fact.stateSourceEventId`) }),
    ...(fact.requiredObservableName === undefined
      ? {}
      : { requiredObservableName: requireString(fact.requiredObservableName, `${path}.fact.requiredObservableName`) as NonNullable<SpatialCueFactInput['requiredObservableName']> }),
    ...(activity === undefined ? {} : { activity }),
    verifiedEvidence: verifiedEvidence as readonly SpatialCueEvidenceKind[],
    ...(fact.currentZoneId === undefined ? {} : { currentZoneId: requireString(fact.currentZoneId, `${path}.fact.currentZoneId`) }),
    ...(fact.recoveryStep === undefined ? {} : { recoveryStep: requireNumber(fact.recoveryStep, `${path}.fact.recoveryStep`) }),
    ...(fact.recoveryTotalSteps === undefined ? {} : { recoveryTotalSteps: requireNumber(fact.recoveryTotalSteps, `${path}.fact.recoveryTotalSteps`) }),
    ...(fact.recoveryReadOnly === undefined ? {} : { recoveryReadOnly: requireBoolean(fact.recoveryReadOnly, `${path}.fact.recoveryReadOnly`) }),
    ...(fact.acceptedAssignmentEnd === undefined ? {} : { acceptedAssignmentEnd: requireBoolean(fact.acceptedAssignmentEnd, `${path}.fact.acceptedAssignmentEnd`) }),
  };
}

function assertProjectionInput(input: AuthenticatedSpatialProjectionInput): void {
  if (input.observations.manifestStatus !== 'VERIFIED') {
    throw new TypeError('authenticated spatial projection requires verified manifest authority');
  }
  assertUtcTimestamp(input.observations.refreshedAt, 'authenticated spatial evaluatedAt');
  if (
    input.mission.missionId !== input.manifest.missionId
    || input.mission.manifestVersion !== input.manifest.manifestVersion
    || input.dashboard.fixtureKind !== 'APPLICATION_PROJECTION'
    || input.sceneRoles.length !== 8
  ) {
    throw new TypeError('authenticated spatial projection input correspondence is invalid');
  }
  const roleIds = new Set<string>();
  for (const role of input.sceneRoles) {
    if (roleIds.has(role.roleInstanceId) || role.missionId !== input.mission.missionId) {
      throw new TypeError('authenticated spatial role identity is missing or duplicated');
    }
    roleIds.add(role.roleInstanceId);
    assertUtcTimestamp(role.evaluatedAt, 'authenticated role evaluatedAt');
    if (role.evaluatedAt !== input.observations.refreshedAt) {
      throw new TypeError('authenticated spatial role evaluation times conflict');
    }
    if (role.activity !== undefined) assertActivityCompatible(requireWorkUnitState(role), role.activity);
    requireActorObservation(input, role);
  }
}

function teamInput(
  input: AuthenticatedSpatialProjectionInput,
  projectId: string,
): AdvisorTeamAuthorityInput {
  const projectRoles = input.sceneRoles.filter((role) =>
    requireActorObservation(input, role).projectId === projectId);
  const vibeMembers = projectRoles.filter((role) =>
    VIBENEWS_ADVISOR_TEAM_ROLES.includes(role.actorRole as (typeof VIBENEWS_ADVISOR_TEAM_ROLES)[number]));
  const foundationMembers = projectRoles.filter((role) =>
    FOUNDATION_ADVISOR_TEAM_ROLES.includes(role.actorRole as (typeof FOUNDATION_ADVISOR_TEAM_ROLES)[number]));
  const members = vibeMembers.length > foundationMembers.length ? vibeMembers : foundationMembers;
  const advisorTeamId = members === vibeMembers && vibeMembers.length > 0
    ? VIBENEWS_ADVISOR_TEAM_ID
    : FOUNDATION_ADVISOR_TEAM_ID;
  const responsibleAdvisorRoleInstanceIds = members
    .filter((role) => isAdvisorRole(role.actorRole))
    .map((role) => role.roleInstanceId)
    .sort();
  return {
    advisorTeamId,
    responsibleAdvisorRoleInstanceIds,
    memberRoleInstanceIds: members.map((role) => role.roleInstanceId).sort(),
    authorityEvidenceStatus: responsibleAdvisorRoleInstanceIds.length > 1
      ? 'CONFLICT'
      : responsibleAdvisorRoleInstanceIds.length === 1
        ? 'VERIFIED'
        : 'UNVERIFIED',
    authorityEvidenceRef: responsibleAdvisorRoleInstanceIds.length === 1
      ? input.observations.manifestEvidenceId
      : null,
  };
}

function actorInput(
  input: AuthenticatedSpatialProjectionInput,
  role: RoleSceneProjection,
): SpatialActorRegistrationInput {
  const observation = requireActorObservation(input, role);
  return {
    roleInstanceId: role.roleInstanceId,
    actorRole: role.actorRole,
    displayIdentity: role.actorRole,
    projectId: observation.projectId,
    hostId: observation.hostId,
    sourceId: requireSourceId(observation),
    evidenceFreshness: evidenceFreshness(observation.presentation),
    connectionState: observation.connectionState,
    active: role.workUnitId !== undefined,
    independentReviewer: role.actorRole.includes('Reviewer'),
  };
}

function assignmentInput(
  input: AuthenticatedSpatialProjectionInput,
  role: RoleSceneProjection,
  acceptedEventIds: readonly string[],
): readonly SpatialWorkAssignmentInput[] {
  if (role.workUnitId === undefined) return [];
  const observation = requireActorObservation(input, role);
  const currentActivitySourceEventId = role.activity === undefined
    ? null
    : role.stateSourceEventId ?? role.activity.sourceEventIds[0] ?? null;
  return [{
    assignmentRef: {
      projectId: observation.projectId,
      missionId: input.mission.missionId,
      workUnitId: role.workUnitId,
    },
    expectedActorRole: role.actorRole,
    candidateRoleInstanceIds: [role.roleInstanceId],
    hostId: observation.hostId,
    sourceId: requireSourceId(observation),
    sourceVerified: !['CONFLICT', 'ERROR', 'UNKNOWN'].includes(observation.presentation),
    nonterminal: role.workUnitState !== undefined
      && !['COMPLETED', 'CANCELLED'].includes(role.workUnitState),
    currentActivitySourceEventId,
    acceptedEventIds,
    reviewerAssignment: role.actorRole.includes('Reviewer'),
  }];
}

function verifiedMissionInput(
  input: AuthenticatedSpatialProjectionInput,
  projectId: string,
  teams: readonly AdvisorTeamAuthorityInput[],
  assignments: ReturnType<typeof resolveSpatialAssignments>,
) {
  const sourceManifestRef: SpatialSourceManifestRef = {
    projectId,
    missionId: input.mission.missionId,
    manifestVersion: String(input.mission.manifestVersion),
    sourceCommit: input.manifest.source.commit,
    sourceSha256: input.manifest.source.sha256.replace(/^sha256:/u, ''),
  };
  const selectedWorkUnit = selectCurrentWorkUnit(input.dashboard);
  const missionRef = { projectId, missionId: input.mission.missionId };
  const blocker = blockerFact(selectedWorkUnit);
  const workUnitProgress: SpatialProgressFact = {
    state: 'KNOWN',
    completed: input.mission.numerator,
    total: input.mission.denominator,
  };
  const gateProgress: SpatialProgressFact = {
    state: 'KNOWN',
    completed: input.dashboard.requiredGateProgress.passed,
    total: input.dashboard.requiredGateProgress.denominator,
  };
  const missionSummary: SpatialMissionSummary = {
    missionRef,
    displayName: input.manifest.package.labelKo,
    manifestVersion: sourceManifestRef.manifestVersion,
    operationalState: operationalState(selectedWorkUnit),
    workUnitProgress,
    gateProgress,
    blockerSummary: blocker,
  };
  const projectActors = Object.values(assignments.actorsByRoleInstanceId)
    .filter((actor) => actor.projectId === projectId);
  const activeActors = projectActors.filter((actor) => actor.activeAssignmentRef !== null);
  const currentActorDisplayIdentity = activeActors.length === 1
    ? activeActors[0]?.displayIdentity ?? truthFact('UNKNOWN')
    : activeActors.length > 1
      ? truthFact('CONFLICT')
      : truthFact('UNKNOWN');
  const team = teams.find((candidate) => candidate.memberRoleInstanceIds.some((roleInstanceId) =>
    projectActors.some((actor) => actor.roleInstanceId === roleInstanceId)));
  const responsibleAdvisorId = team?.responsibleAdvisorRoleInstanceIds.length === 1
    ? team.responsibleAdvisorRoleInstanceIds[0]
    : undefined;
  const responsibleAdvisor = responsibleAdvisorId === undefined
    ? truthFact(team?.authorityEvidenceStatus === 'CONFLICT' ? 'CONFLICT' : 'UNKNOWN')
    : assignments.actorsByRoleInstanceId[responsibleAdvisorId]?.displayIdentity ?? truthFact('UNKNOWN');
  const reviewers = input.sceneRoles.filter((role) => role.actorRole.includes('Reviewer'));
  const latestVerifiedEvidence = projectEvidenceSummary(input).latest;
  const board: SpatialMissionBoard = {
    missionRef,
    teamName: team === undefined ? truthFact('UNKNOWN') : knownFact(team.advisorTeamId),
    projectName: knownFact(projectDisplayName(input)),
    responsibleAdvisor,
    responsibleAdvisorDisplayIdentity: responsibleAdvisor,
    currentMission: knownFact(input.manifest.package.labelKo),
    currentPhaseOrWorkUnit: selectedWorkUnit === undefined
      ? truthFact('UNKNOWN')
      : knownFact(selectedWorkUnit.id),
    currentActorDisplayIdentity,
    assignedReviewer: reviewers.length === 1
      ? knownFact(reviewers[0]?.actorRole ?? 'Reviewer')
      : truthFact(reviewers.length > 1 ? 'CONFLICT' : 'UNKNOWN'),
    nextActorOrHandoff: truthFact('UNKNOWN'),
    workUnitProgress,
    requiredGateProgress: gateProgress,
    blocker,
    leoGptDecisionState: selectedWorkUnit?.state === 'WAITING_LEO'
      ? knownFact('WAITING_LEO')
      : knownFact('NO_OPEN_DECISION'),
    latestVerifiedEvidence,
    sourceTruthState: sourceTruth(input.observations.manifestStatus),
  };
  return {
    sourceAuthorityVerified: input.observations.manifestStatus === 'VERIFIED',
    mainMission: true,
    sourceManifestRef,
    missionSummary,
    missionBoard: board,
  };
}

function cueFactForRole(
  role: RoleSceneProjection,
  eventsById: ReadonlyMap<string, EventEnvelope>,
  acceptedEventIds: readonly string[],
  evaluatedAt: string,
): SpatialCueFactInput | undefined {
  if (
    role.workUnitId === undefined
    || role.workUnitState === undefined
    || role.stateSourceEventId === undefined
    || !acceptedEventIds.includes(role.stateSourceEventId)
  ) return undefined;
  if (role.activity !== undefined) assertActivityCompatible(role.workUnitState, role.activity);
  const sourceEventIds = [...new Set([
    role.stateSourceEventId,
    ...(role.activity?.sourceEventIds ?? []),
  ])].filter((eventId) => acceptedEventIds.includes(eventId)).sort();
  if (sourceEventIds.length === 0) return undefined;
  const referencedEvents = sourceEventIds.flatMap((eventId) => {
    const event = eventsById.get(eventId);
    return event === undefined ? [] : [event];
  });
  const factKind = cueFactKind(role, referencedEvents);
  if (factKind === undefined) return undefined;
  const stateEvent = eventsById.get(role.stateSourceEventId);
  const previousWorkUnitState = stateEvent?.eventType === 'WorkUnitStateTransitioned'
    && isRecord(stateEvent.payload)
    && typeof stateEvent.payload.from === 'string'
      ? stateEvent.payload.from as WorkUnitState
      : undefined;
  const requiredObservableName = projectRequiredObservable(
    role.workUnitState,
    role.activity,
    evaluatedAt,
  ).requiredObservableName;
  return {
    factKind,
    sourceEventIds,
    workUnitId: role.workUnitId,
    ...(previousWorkUnitState === undefined ? {} : { previousWorkUnitState }),
    workUnitState: role.workUnitState,
    stateSourceEventId: role.stateSourceEventId,
    requiredObservableName,
    ...(role.activity === undefined
      ? {}
      : {
          activity: {
            activity: role.activity.activity,
            reasonCode: role.activity.reasonCode,
            sourceEventIds: role.activity.sourceEventIds,
            ...(role.activity.optionalExpiresAt === undefined
              ? {}
              : { optionalExpiresAt: role.activity.optionalExpiresAt }),
          },
        }),
    verifiedEvidence: verifiedEvidenceKinds(role, referencedEvents),
    ...(role.recovery === undefined
      ? {}
      : {
          recoveryStep: role.recovery.step,
          recoveryTotalSteps: role.recovery.totalSteps,
          recoveryReadOnly: role.recovery.readOnly,
        }),
    ...(['COMPLETED', 'FAILED', 'CANCELLED'].includes(role.workUnitState)
      ? { acceptedAssignmentEnd: true }
      : {}),
  };
}

function cueFactKind(
  role: RoleSceneProjection,
  referencedEvents: readonly EventEnvelope[],
): SpatialCueFactKind | undefined {
  if (role.recovery !== undefined) return 'RECOVERY_STEP_ACCEPTED';
  switch (role.activity?.activity) {
    case 'DELIVERY': return 'WORKUNIT_DISPATCH_ACCEPTED';
    case 'READING': return 'READING_ACCEPTED';
    case 'WORKING': return 'WORKING_ACCEPTED';
    case 'TESTING': return 'TESTING_ACCEPTED';
    case 'WRITING_RESULT': return 'RESULT_DRAFT_ACCEPTED';
    case 'REVIEW': return 'REVIEW_ACTIVITY_ACCEPTED';
    case 'BLOCKED': return 'BLOCKER_ACCEPTED';
    case 'WAITING_LEO': return 'DECISION_REQUEST_ACCEPTED';
    case 'RESULT_RETURN': return 'RESULT_ACCEPTED';
    case 'RECOVERY': return 'RECOVERY_STEP_ACCEPTED';
    case 'IDLE': return 'VERIFIED_IDLE_ACCEPTED';
    case undefined:
      break;
  }
  if (role.workUnitState === 'NEEDS_PATCH') return 'PATCH_RETURN_ACCEPTED';
  if (role.workUnitState === 'COMPLETED') return 'COMPLETION_ACKNOWLEDGEMENT_ACCEPTED';
  if (referencedEvents.some((event) => event.eventType === 'ReviewResultRecorded')) {
    return 'REVIEW_VERDICT_ACCEPTED';
  }
  return undefined;
}

function verifiedEvidenceKinds(
  role: RoleSceneProjection,
  events: readonly EventEnvelope[],
): readonly SpatialCueEvidenceKind[] {
  const kinds = new Set<SpatialCueEvidenceKind>();
  const types = new Set(events.map((event) => event.eventType));
  if (types.has('WorkUnitStateTransitioned')) kinds.add('STRUCTURED_HANDOFF');
  if (types.has('AdvisorMessageDelivered') || types.has('AdvisorIntakeRecorded')) kinds.add('EXACT_ADVISOR_ROUTE');
  if (types.has('AdvisorMessageAcknowledged') || types.has('EvidenceVerified')) kinds.add('IMMUTABLE_INPUT_OR_ACK');
  if (types.has('EvidenceAttached') || types.has('EvidenceVerified')) kinds.add('COMMAND_AND_EVIDENCE_REFS');
  if (role.activity?.activity === 'WRITING_RESULT' && types.has('RoleActivityChanged')) kinds.add('RESULT_DRAFT_STARTED');
  if (role.actorRole.includes('Reviewer')) kinds.add('EXACT_INDEPENDENT_REVIEWER');
  if (types.has('ReviewResultRecorded')) kinds.add('VERIFIED_REVIEW_VERDICT');
  if (types.has('BlockerOpened')) kinds.add('VERIFIED_BLOCKER');
  if (types.has('DecisionRequested')) kinds.add('VERIFIED_DECISION_REQUEST');
  if (types.has('EvidenceVerified') && role.workUnitState === 'RESULT_REPORTED') kinds.add('VERIFIED_RESULT_AND_POINTER');
  if (role.actorRole.includes('Worker')) kinds.add('EXACT_ASSIGNED_WORKER');
  if (role.workUnitState === 'COMPLETED' && types.has('EvidenceVerified')) kinds.add('CANONICAL_COMPLETION');
  if (types.has('AdvisorMessageAcknowledged') || types.has('NotificationAcknowledged')) kinds.add('STRUCTURED_ACKNOWLEDGEMENT');
  if (role.recovery !== undefined && types.has('RecoveryCompleted')) kinds.add('VERIFIED_RECOVERY_STEP');
  if (role.activity?.activity === 'IDLE') kinds.add('VERIFIED_IDLE');
  return [...kinds].sort();
}

function projectEvidenceSummary(input: AuthenticatedSpatialProjectionInput): SpatialEvidenceSummary {
  const verified = input.dashboard.evidence.filter((evidence) => evidence.verificationState === 'VERIFIED');
  const latest = verified[0];
  return {
    verifiedCount: verified.length,
    latest: latest === undefined
      ? { state: 'UNKNOWN', verifiedAt: null, evidenceRef: null }
      : {
          state: 'KNOWN',
          verifiedAt: input.observations.refreshedAt,
          evidenceRef: latest.evidenceId,
        },
  };
}

function selectCurrentWorkUnit(dashboard: DashboardViewModel): DashboardWorkUnitViewModel | undefined {
  return dashboard.workUnits.find((workUnit) =>
    !['COMPLETED', 'CANCELLED'].includes(workUnit.state)) ?? dashboard.workUnits.at(-1);
}

function operationalState(workUnit: DashboardWorkUnitViewModel | undefined): SpatialOperationalState {
  if (workUnit === undefined) return 'UNKNOWN';
  switch (workUnit.stateName) {
    case 'QUEUED':
    case 'READY': return 'IDLE';
    case 'DISPATCHING': return 'ROUTING_DISPATCH';
    case 'READING':
    case 'WORKING':
    case 'WRITING_RESULT': return 'WORKING';
    case 'TESTING': return 'TESTING';
    case 'RETURNING_RESULT': return 'RETURNING_RESULT';
    case 'REVIEWING': return 'REVIEWING';
    case 'NEEDS_PATCH': return 'NEEDS_PATCH';
    case 'WAITING_DEPENDENCY': return 'WAITING_DEPENDENCY';
    case 'WAITING_LEO': return 'WAITING_LEO';
    case 'BLOCKED': return 'BLOCKED';
    case 'COMPLETED': return 'COMPLETED';
    case 'FAILED': return 'FAILED';
    case 'CANCELLED': return 'CANCELLED';
    case 'WAITING_ADVISOR':
    case 'HOLD':
    case 'UNKNOWN_OR_STALE': return 'UNKNOWN';
  }
}

function blockerFact(workUnit: DashboardWorkUnitViewModel | undefined): SpatialDisplayFact {
  if (workUnit?.blocker !== undefined) return knownFact(workUnit.blocker.reason);
  return workUnit?.state === 'BLOCKED' ? knownFact('BLOCKED') : truthFact('UNKNOWN');
}

function projectDisplayName(input: AuthenticatedSpatialProjectionInput): string {
  return input.manifest.initiative.id === 'AGENT_OFFICE'
    ? 'Agent Office'
    : input.manifest.initiative.labelKo;
}

function normalizedInitiativeProjectId(manifest: MissionManifest): string {
  return manifest.initiative.id.toLocaleLowerCase('en-US').replaceAll('_', '-');
}

function sourceTruth(status: AuthenticatedSpatialObservationInput['manifestStatus']): SpatialTruthState {
  if (status === 'VERIFIED') return 'KNOWN';
  if (status === 'STALE') return 'STALE';
  if (status === 'DIRTY' || status === 'INVALID') return 'CONFLICT';
  return 'UNKNOWN';
}

function evidenceFreshness(presentation: ObservationPresentation): SpatialEvidenceFreshness {
  return presentation === 'OFFLINE' ? 'STALE' : presentation;
}

function worstEvidenceFreshness(values: readonly ObservationPresentation[]): SpatialEvidenceFreshness {
  const ranking: Readonly<Record<ObservationPresentation, number>> = {
    CURRENT: 0,
    UNKNOWN: 1,
    STALE: 2,
    OFFLINE: 3,
    ERROR: 4,
    CONFLICT: 5,
  };
  const worst = values.reduce<ObservationPresentation>((current, candidate) =>
    ranking[candidate] > ranking[current] ? candidate : current, 'CURRENT');
  return evidenceFreshness(worst);
}

function worstConnection(values: readonly SceneConnectionState[]): SpatialConnectionState {
  const ranking: Readonly<Record<SceneConnectionState, number>> = {
    CONNECTED: 0,
    UNKNOWN: 1,
    OFFLINE: 2,
    CONFLICT: 3,
  };
  return values.reduce<SpatialConnectionState>((current, candidate) =>
    ranking[candidate] > ranking[current] ? candidate : current, 'CONNECTED');
}

function knownFact(value: string): SpatialDisplayFact {
  return { state: 'KNOWN', value };
}

function truthFact(state: Exclude<SpatialTruthState, 'KNOWN'>): SpatialDisplayFact {
  return { state, value: null };
}

function isAdvisorRole(actorRole: string): boolean {
  return actorRole === 'Advisor' || actorRole === 'Foundation Advisor' || actorRole === 'VibeNews Advisor';
}

function requireActorObservation(
  input: AuthenticatedSpatialProjectionInput,
  role: RoleSceneProjection,
): AuthenticatedSpatialActorObservationInput {
  const observation = input.observations.actors[role.roleInstanceId];
  if (
    observation?.roleInstanceId !== role.roleInstanceId
    || observation.actorRole !== role.actorRole
  ) {
    throw new TypeError('authenticated spatial actor registration correspondence is invalid');
  }
  return observation;
}

function requireSourceId(observation: AuthenticatedSpatialActorObservationInput): string {
  const sourceId = observation.evidenceRefs[0];
  if (sourceId === undefined || sourceId.length === 0) {
    throw new TypeError('authenticated spatial actor has no accepted evidence source');
  }
  return sourceId;
}

function requireWorkUnitState(role: RoleSceneProjection): WorkUnitState {
  if (role.workUnitState === undefined) {
    throw new TypeError('authenticated spatial activity has no WorkUnit state');
  }
  return role.workUnitState;
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError(`${path} must be an object`);
  return value;
}

function assertExactKeys(value: Record<string, unknown>, expected: readonly string[], path: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new TypeError(`${path} has unknown or missing fields`);
  }
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${path} must be a string`);
  return value;
}

function requireStringArray(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`);
  return value.map((candidate, index) => requireString(candidate, `${path}[${String(index)}]`));
}

function requireNumber(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new TypeError(`${path} must be a nonnegative integer`);
  return value as number;
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new TypeError(`${path} must be a boolean`);
  return value;
}
