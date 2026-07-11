import type { SpatialAssignmentResolution } from './assignment-resolver.js';
import {
  SPATIAL_OFFICE_FLOOR_MODE,
  SPATIAL_OFFICE_SCHEMA_VERSION,
  type SpatialAlertSummary,
  type SpatialAuthorityStatus,
  type SpatialConnectionState,
  type SpatialDisplayFact,
  type SpatialEvidenceFreshness,
  type SpatialEvidenceSummary,
  type SpatialMissionBoard,
  type SpatialMissionRef,
  type SpatialMissionSummary,
  type SpatialOfficeProjectionV1,
  type SpatialProjectIdentityRef,
  type SpatialProjectionSelection,
  type SpatialSourceManifestRef,
  type SpatialTeamPodProjection,
} from './types.js';
import { parseSpatialOfficeProjection } from './validation.js';

export interface SpatialRegisteredProjectInput {
  readonly projectId: string;
  readonly displayName: string;
  readonly advisorTeamId: string;
  readonly projectIdentity: SpatialProjectIdentityRef;
  readonly authorityStatus: SpatialAuthorityStatus;
  readonly evidenceFreshness: SpatialEvidenceFreshness;
  readonly connectionState: SpatialConnectionState;
  readonly responsibleAdvisorRoleInstanceId: string | null;
  readonly responsibleAdvisorDisplayIdentity: SpatialDisplayFact;
  readonly alertSummary: SpatialAlertSummary;
  readonly evidenceSummary: SpatialEvidenceSummary;
}

export interface SpatialVerifiedMissionInput {
  readonly sourceAuthorityVerified: boolean;
  readonly mainMission: boolean;
  readonly sourceManifestRef: SpatialSourceManifestRef;
  readonly missionSummary: SpatialMissionSummary;
  readonly missionBoard: SpatialMissionBoard;
}

export interface SpatialOfficeProjectorInput {
  readonly projectionRevision: number;
  readonly evaluatedAt: string;
  readonly initiativeRef: string;
  readonly identityCatalogVersion: string;
  readonly projects: readonly SpatialRegisteredProjectInput[];
  readonly missions: readonly SpatialVerifiedMissionInput[];
  readonly assignments: SpatialAssignmentResolution;
  readonly sourceEventIds: readonly string[];
  readonly selection: SpatialProjectionSelection;
}

export function projectSpatialOffice(input: SpatialOfficeProjectorInput): SpatialOfficeProjectionV1 {
  const projects = [...input.projects].sort((left, right) =>
    compareStableText(left.projectId, right.projectId));
  assertUniqueProjects(projects);
  const selectedPodId = selectPodId(projects, input.missions, input.selection);
  const verifiedMissions = input.missions
    .filter((mission) => mission.sourceAuthorityVerified)
    .sort((left, right) => compareStableText(missionKey(left), missionKey(right)));
  assertUniqueMissions(verifiedMissions);
  assertSingleMainMission(verifiedMissions);

  const pods = projects.map((project) => projectPod(
    project,
    verifiedMissions.filter((mission) => mission.sourceManifestRef.projectId === project.projectId),
    input.assignments,
    selectedPodId,
    input.selection,
  ));
  const selectedPod = pods.find((pod) => pod.podId === selectedPodId);
  const actorsByRoleInstanceId = normalizeActorRecord(input.assignments.actorsByRoleInstanceId, pods);
  const projection: SpatialOfficeProjectionV1 = {
    schemaVersion: SPATIAL_OFFICE_SCHEMA_VERSION,
    projectionRevision: input.projectionRevision,
    evaluatedAt: input.evaluatedAt,
    initiativeRef: input.initiativeRef,
    floorMode: SPATIAL_OFFICE_FLOOR_MODE,
    selectedPodId,
    identityCatalogVersion: input.identityCatalogVersion,
    pods,
    actorsByRoleInstanceId,
    selectedMissionBoard: selectedPod?.missionBoardSummary ?? null,
    channyPresentation: null,
    sourceManifestRefs: verifiedMissions.map((mission) => mission.sourceManifestRef),
    sourceEventIds: [...new Set(input.sourceEventIds)].sort(),
    compatibilityMode: 'M1_2_TEAM_PODS',
  };
  return parseSpatialOfficeProjection(projection);
}

function projectPod(
  project: SpatialRegisteredProjectInput,
  missions: readonly SpatialVerifiedMissionInput[],
  assignments: SpatialAssignmentResolution,
  selectedPodId: string | null,
  selection: SpatialProjectionSelection,
): SpatialTeamPodProjection {
  const selected = selectedPodId === podIdForProject(project.projectId);
  const requestedMissionRef = !selected
    ? null
    : selection.deepLinkedMissionRef?.projectId === project.projectId
      ? selection.deepLinkedMissionRef
      : selection.explicitMissionRef?.projectId === project.projectId
        ? selection.explicitMissionRef
        : null;
  const selectedMission = selectMission(missions, requestedMissionRef);
  const selectedMissionRef = selectedMission?.sourceManifestRef === undefined
    ? null
    : missionRef(selectedMission.sourceManifestRef);
  const missionBoardSummary = selectedMission?.missionBoard ?? null;
  const exactSource = project.authorityStatus === 'VERIFIED'
    && project.evidenceFreshness === 'CURRENT'
    && project.connectionState === 'CONNECTED'
    && project.responsibleAdvisorRoleInstanceId !== null
    && selectedMission !== undefined;
  const assignmentViews = assignments.assignmentViews
    .filter((view) => view.assignmentRef.projectId === project.projectId)
    .map((view) => {
      if (view.roleInstanceId === null) return view;
      const actor = assignments.actorsByRoleInstanceId[view.roleInstanceId];
      const fullCharacter = exactSource
        && actor?.presentationPodId === podIdForProject(project.projectId);
      return {
        ...view,
        fullCharacter,
        taskMotionAllowed: selected && fullCharacter && actor.taskMotionAllowed,
      };
    });
  const currentActors = Object.values(assignments.actorsByRoleInstanceId)
    .filter((actor) => actor.activeAssignmentRef?.projectId === project.projectId)
    .sort((left, right) => compareStableText(left.roleInstanceId, right.roleInstanceId));
  const missionSummaries = missions.map((mission) => mission.missionSummary);
  const currentMainMission = missions.find((mission) => mission.mainMission)?.missionSummary;

  return {
    podId: podIdForProject(project.projectId),
    advisorTeamId: project.advisorTeamId,
    projectId: project.projectId,
    displayName: project.displayName,
    projectIdentity: project.projectIdentity,
    authorityStatus: project.authorityStatus,
    evidenceFreshness: project.evidenceFreshness,
    connectionState: project.connectionState,
    responsibleAdvisorRoleInstanceId: project.responsibleAdvisorRoleInstanceId,
    responsibleAdvisorDisplayIdentity: project.responsibleAdvisorDisplayIdentity,
    selectedMissionRef,
    missionSummaries,
    missionBoardSummary,
    actorAssignments: assignmentViews,
    currentMainMission: currentMainMission === undefined
      ? unknownFact()
      : knownFact(currentMainMission.displayName),
    currentActor: currentActorFact(currentActors),
    operationalState: currentMainMission?.operationalState ?? 'UNKNOWN',
    gateBlockerSummary: currentMainMission?.blockerSummary ?? unknownFact(),
    alertSummary: project.alertSummary,
    evidenceSummary: project.evidenceSummary,
    selected,
    recognizableOfficeArea: true,
    fullChoreographyEnabled: selected && exactSource,
  };
}

function selectPodId(
  projects: readonly SpatialRegisteredProjectInput[],
  missions: readonly SpatialVerifiedMissionInput[],
  selection: SpatialProjectionSelection,
): string | null {
  if (selection.explicitPodId !== null) {
    const explicit = projects.find((project) => podIdForProject(project.projectId) === selection.explicitPodId);
    if (explicit !== undefined) return selection.explicitPodId;
  }
  if (selection.deepLinkedMissionRef !== null) {
    const deepLink = selection.deepLinkedMissionRef;
    const valid = missions.some((mission) =>
      mission.sourceAuthorityVerified
      && mission.sourceManifestRef.projectId === deepLink.projectId
      && mission.sourceManifestRef.missionId === deepLink.missionId)
      && projects.some((project) => project.projectId === deepLink.projectId);
    if (valid) return podIdForProject(deepLink.projectId);
  }
  const first = projects[0];
  return first === undefined ? null : podIdForProject(first.projectId);
}

function selectMission(
  missions: readonly SpatialVerifiedMissionInput[],
  requested: SpatialMissionRef | null,
): SpatialVerifiedMissionInput | undefined {
  if (requested !== null) {
    const match = missions.find((mission) =>
      mission.sourceManifestRef.projectId === requested.projectId
      && mission.sourceManifestRef.missionId === requested.missionId);
    if (match !== undefined) return match;
  }
  return missions.find((mission) => mission.mainMission);
}

function normalizeActorRecord(
  actors: Readonly<Record<string, import('./types.js').SpatialActorProjection>>,
  pods: readonly SpatialTeamPodProjection[],
): Readonly<Record<string, import('./types.js').SpatialActorProjection>> {
  const fullCharacterIds = new Set(pods.flatMap((pod) => pod.actorAssignments
    .filter((assignment): assignment is typeof assignment & { readonly roleInstanceId: string } =>
      assignment.fullCharacter && assignment.roleInstanceId !== null)
    .map((assignment) => assignment.roleInstanceId)));
  const taskMotionIds = new Set(pods.flatMap((pod) => pod.actorAssignments
    .filter((assignment): assignment is typeof assignment & { readonly roleInstanceId: string } =>
      assignment.taskMotionAllowed && assignment.roleInstanceId !== null)
    .map((assignment) => assignment.roleInstanceId)));
  return Object.fromEntries(Object.entries(actors)
    .sort(([left], [right]) => compareStableText(left, right))
    .map(([roleInstanceId, actor]) => [
      roleInstanceId,
      actor.presentationPodId !== null && !fullCharacterIds.has(roleInstanceId)
        ? {
            ...actor,
            presentationScope: 'NONE',
            presentationPodId: null,
            taskMotionAllowed: false,
          }
        : actor.taskMotionAllowed && !taskMotionIds.has(roleInstanceId)
          ? { ...actor, taskMotionAllowed: false }
          : actor,
    ]));
}

function assertUniqueProjects(projects: readonly SpatialRegisteredProjectInput[]): void {
  const ids = projects.map((project) => project.projectId);
  if (new Set(ids).size !== ids.length) {
    throw new TypeError('spatial projector received duplicate project IDs');
  }
}

function assertUniqueMissions(missions: readonly SpatialVerifiedMissionInput[]): void {
  const keys = missions.map(missionKey);
  if (new Set(keys).size !== keys.length) {
    throw new TypeError('spatial projector received duplicate verified missions');
  }
}

function assertSingleMainMission(missions: readonly SpatialVerifiedMissionInput[]): void {
  const mainByProject = new Set<string>();
  for (const mission of missions) {
    if (!mission.mainMission) continue;
    if (mainByProject.has(mission.sourceManifestRef.projectId)) {
      throw new TypeError('spatial projector received multiple main missions for one project');
    }
    mainByProject.add(mission.sourceManifestRef.projectId);
  }
}

function missionKey(mission: SpatialVerifiedMissionInput): string {
  return `${mission.sourceManifestRef.projectId}\u0000${mission.sourceManifestRef.missionId}`;
}

function missionRef(source: SpatialSourceManifestRef): SpatialMissionRef {
  return { projectId: source.projectId, missionId: source.missionId };
}

function podIdForProject(projectId: string): string {
  return `pod:${projectId}`;
}

function knownFact(value: string): SpatialDisplayFact {
  return { state: 'KNOWN', value };
}

function unknownFact(): SpatialDisplayFact {
  return { state: 'UNKNOWN', value: null };
}

function currentActorFact(
  actors: readonly import('./types.js').SpatialActorProjection[],
): SpatialDisplayFact {
  if (actors.length === 0) return unknownFact();
  if (actors.some((actor) => actor.displayIdentity.state === 'CONFLICT')) {
    return { state: 'CONFLICT', value: null };
  }
  if (actors.some((actor) => actor.displayIdentity.state === 'STALE')) {
    return { state: 'STALE', value: null };
  }
  if (actors.some((actor) => actor.displayIdentity.state !== 'KNOWN')) {
    return unknownFact();
  }
  const values = actors.map((actor) => actor.displayIdentity.value);
  if (values.some((value) => value === null)) return unknownFact();
  return knownFact(values.join(', '));
}

function compareStableText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
