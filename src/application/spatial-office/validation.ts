import {
  SPATIAL_ADVISOR_RESPONSIBILITY_STATUSES,
  SPATIAL_ASSIGNMENT_STATUSES,
  SPATIAL_AUTHORITY_STATUSES,
  SPATIAL_CONNECTION_STATES,
  SPATIAL_EVIDENCE_FRESHNESS,
  SPATIAL_OFFICE_COMPATIBILITY_MODES,
  SPATIAL_OFFICE_FLOOR_MODE,
  SPATIAL_OFFICE_SCHEMA_VERSION,
  SPATIAL_OPERATIONAL_STATES,
  SPATIAL_PRESENTATION_SCOPES,
  SPATIAL_TRUTH_STATES,
  type SpatialActorAssignmentView,
  type SpatialActorProjection,
  type SpatialDisplayFact,
  type SpatialEvidenceFact,
  type SpatialMissionBoard,
  type SpatialMissionRef,
  type SpatialMissionSummary,
  type SpatialOfficeProjectionV1,
  type SpatialProgressFact,
  type SpatialSourceManifestRef,
  type SpatialTeamPodProjection,
} from './types.js';

const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/u;
const SHA_256 = /^[a-f0-9]{64}$/u;
const GIT_COMMIT = /^[a-f0-9]{40}$/u;
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const RFC_3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const UNSAFE_DISPLAY =
  /(?:(?:^|\s)(?:\/|~\/|\.\.?\/|[A-Za-z]:\\)|[%$@]\d+|\b(?:tmux|ssh|tcp|http|https|ws|wss):\/\/|\b(?:bearer|password|credential|private[_ -]?key|api[_ -]?key|access[_ -]?token|secret)\b|-----BEGIN)/iu;
const RAW_TARGET = /(?:^|\s)[A-Za-z0-9._-]+:[A-Za-z0-9._-]+(?:\.\d+)?(?:\s|$)/u;
const PATH_SHAPED = /(?:^|[\s=])(?:(?:[A-Za-z0-9._-]+\/){2,}[A-Za-z0-9._-]+|[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+|[A-Za-z]:\\)/u;

const PROJECTION_KEYS = [
  'schemaVersion',
  'projectionRevision',
  'evaluatedAt',
  'initiativeRef',
  'floorMode',
  'selectedPodId',
  'identityCatalogVersion',
  'pods',
  'actorsByRoleInstanceId',
  'selectedMissionBoard',
  'channyPresentation',
  'sourceManifestRefs',
  'sourceEventIds',
  'compatibilityMode',
] as const;

export class SpatialProjectionValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'SpatialProjectionValidationError';
  }
}

export function parseSpatialOfficeProjection(value: unknown): SpatialOfficeProjectionV1 {
  const projection = expectRecord(value, 'projection');
  assertExactKeys(projection, PROJECTION_KEYS, 'projection');
  assertEqual(projection.schemaVersion, SPATIAL_OFFICE_SCHEMA_VERSION, 'schemaVersion');
  assertNonNegativeInteger(projection.projectionRevision, 'projectionRevision');
  assertTimestamp(projection.evaluatedAt, 'evaluatedAt');
  assertStableId(projection.initiativeRef, 'initiativeRef');
  assertEqual(projection.floorMode, SPATIAL_OFFICE_FLOOR_MODE, 'floorMode');
  assertNullableStableId(projection.selectedPodId, 'selectedPodId');
  assertVersion(projection.identityCatalogVersion, 'identityCatalogVersion');
  assertEnum(projection.compatibilityMode, SPATIAL_OFFICE_COMPATIBILITY_MODES, 'compatibilityMode');
  if (projection.channyPresentation !== null) {
    fail('channyPresentation must remain null in AO12-A');
  }

  const pods = expectArray(projection.pods, 'pods');
  pods.forEach((pod, index) => validatePod(pod, `pods[${String(index)}]`));
  assertSortedUnique(pods, (pod) => expectRecord(pod, 'pod').projectId, 'pods.projectId');

  const actors = expectRecord(projection.actorsByRoleInstanceId, 'actorsByRoleInstanceId');
  for (const roleInstanceId of Object.keys(actors)) {
    assertStableId(roleInstanceId, 'actorsByRoleInstanceId key');
    validateActor(actors[roleInstanceId], roleInstanceId);
  }

  if (projection.selectedMissionBoard !== null) {
    validateMissionBoard(projection.selectedMissionBoard, 'selectedMissionBoard');
  }

  const manifestRefs = expectArray(projection.sourceManifestRefs, 'sourceManifestRefs');
  manifestRefs.forEach((ref, index) => validateManifestRef(ref, `sourceManifestRefs[${String(index)}]`));
  assertSortedUnique(manifestRefs, manifestRefKey, 'sourceManifestRefs');

  const sourceEventIds = expectArray(projection.sourceEventIds, 'sourceEventIds');
  sourceEventIds.forEach((id, index) =>
    assertStringPattern(id, UUID_V7, `sourceEventIds[${String(index)}]`));
  assertSortedUnique(sourceEventIds, (id) => id, 'sourceEventIds');

  validateProjectionReferences(projection, pods, actors, manifestRefs);
  return projection as unknown as SpatialOfficeProjectionV1;
}

export function serializeSpatialOfficeProjection(value: unknown): string {
  const projection = parseSpatialOfficeProjection(value);
  return JSON.stringify(canonicalize(projection));
}

function validatePod(value: unknown, path: string): asserts value is SpatialTeamPodProjection {
  const pod = expectRecord(value, path);
  assertExactKeys(pod, [
    'podId',
    'advisorTeamId',
    'projectId',
    'displayName',
    'projectIdentity',
    'authorityStatus',
    'evidenceFreshness',
    'connectionState',
    'responsibleAdvisorRoleInstanceId',
    'responsibleAdvisorDisplayIdentity',
    'selectedMissionRef',
    'missionSummaries',
    'missionBoardSummary',
    'actorAssignments',
    'currentMainMission',
    'currentActor',
    'operationalState',
    'gateBlockerSummary',
    'alertSummary',
    'evidenceSummary',
    'selected',
    'recognizableOfficeArea',
    'fullChoreographyEnabled',
  ], path);
  assertStableId(pod.podId, `${path}.podId`);
  assertStableId(pod.advisorTeamId, `${path}.advisorTeamId`);
  assertStableId(pod.projectId, `${path}.projectId`);
  assertSafeDisplay(pod.displayName, `${path}.displayName`);
  if (pod.podId !== podIdForProject(pod.projectId)) {
    fail(`${path}.podId is not bound to projectId`);
  }
  const identity = expectRecord(pod.projectIdentity, `${path}.projectIdentity`);
  assertExactKeys(identity, ['catalogEntryId', 'textId', 'displayName'], `${path}.projectIdentity`);
  assertStableId(identity.catalogEntryId, `${path}.projectIdentity.catalogEntryId`);
  assertStableId(identity.textId, `${path}.projectIdentity.textId`);
  assertSafeDisplay(identity.displayName, `${path}.projectIdentity.displayName`);
  assertEnum(pod.authorityStatus, SPATIAL_AUTHORITY_STATUSES, `${path}.authorityStatus`);
  assertEnum(pod.evidenceFreshness, SPATIAL_EVIDENCE_FRESHNESS, `${path}.evidenceFreshness`);
  assertEnum(pod.connectionState, SPATIAL_CONNECTION_STATES, `${path}.connectionState`);
  assertNullableStableId(pod.responsibleAdvisorRoleInstanceId, `${path}.responsibleAdvisorRoleInstanceId`);
  validateDisplayFact(pod.responsibleAdvisorDisplayIdentity, `${path}.responsibleAdvisorDisplayIdentity`);
  validateNullableMissionRef(pod.selectedMissionRef, `${path}.selectedMissionRef`);
  const summaries = expectArray(pod.missionSummaries, `${path}.missionSummaries`);
  summaries.forEach((summary, index) => validateMissionSummary(summary, `${path}.missionSummaries[${String(index)}]`));
  assertSortedUnique(summaries, (summary) => missionRefKey(expectRecord(summary, 'missionSummary').missionRef), `${path}.missionSummaries`);
  if (pod.missionBoardSummary !== null) {
    validateMissionBoard(pod.missionBoardSummary, `${path}.missionBoardSummary`);
  }
  const assignments = expectArray(pod.actorAssignments, `${path}.actorAssignments`);
  assignments.forEach((assignment, index) => validateAssignmentView(assignment, `${path}.actorAssignments[${String(index)}]`));
  assertSortedUnique(assignments, assignmentViewKey, `${path}.actorAssignments`);
  validateDisplayFact(pod.currentMainMission, `${path}.currentMainMission`);
  validateDisplayFact(pod.currentActor, `${path}.currentActor`);
  assertEnum(pod.operationalState, SPATIAL_OPERATIONAL_STATES, `${path}.operationalState`);
  validateDisplayFact(pod.gateBlockerSummary, `${path}.gateBlockerSummary`);
  const alerts = expectRecord(pod.alertSummary, `${path}.alertSummary`);
  assertExactKeys(alerts, ['severity', 'openCount'], `${path}.alertSummary`);
  assertEnum(alerts.severity, ['NONE', 'INFO', 'WARNING', 'CRITICAL'] as const, `${path}.alertSummary.severity`);
  assertNonNegativeInteger(alerts.openCount, `${path}.alertSummary.openCount`);
  const evidence = expectRecord(pod.evidenceSummary, `${path}.evidenceSummary`);
  assertExactKeys(evidence, ['verifiedCount', 'latest'], `${path}.evidenceSummary`);
  assertNonNegativeInteger(evidence.verifiedCount, `${path}.evidenceSummary.verifiedCount`);
  validateEvidenceFact(evidence.latest, `${path}.evidenceSummary.latest`);
  assertBoolean(pod.selected, `${path}.selected`);
  assertEqual(pod.recognizableOfficeArea, true, `${path}.recognizableOfficeArea`);
  assertBoolean(pod.fullChoreographyEnabled, `${path}.fullChoreographyEnabled`);
  if (pod.fullChoreographyEnabled && !pod.selected) {
    fail(`${path}.fullChoreographyEnabled requires selected pod`);
  }
}

function validateActor(value: unknown, recordKey: string): asserts value is SpatialActorProjection {
  const actor = expectRecord(value, `actorsByRoleInstanceId.${recordKey}`);
  const path = `actorsByRoleInstanceId.${recordKey}`;
  assertExactKeys(actor, [
    'roleInstanceId',
    'actorRole',
    'displayIdentity',
    'advisorTeamId',
    'teamAuthorityEvidenceRef',
    'projectId',
    'responsibleAdvisorRoleInstanceId',
    'assignmentStatus',
    'responsibleAdvisorStatus',
    'assignmentRefs',
    'activeAssignmentRef',
    'currentActivitySourceEventId',
    'presentationScope',
    'presentationPodId',
    'evidenceFreshness',
    'connectionState',
    'operationalState',
    'workReceiptAllowed',
    'taskMotionAllowed',
    'independentReviewer',
  ], path);
  assertStableId(actor.roleInstanceId, `${path}.roleInstanceId`);
  if (actor.roleInstanceId !== recordKey) {
    fail(`${path}.roleInstanceId does not match record key`);
  }
  assertSafeDisplay(actor.actorRole, `${path}.actorRole`);
  validateDisplayFact(actor.displayIdentity, `${path}.displayIdentity`);
  assertNullableStableId(actor.advisorTeamId, `${path}.advisorTeamId`);
  assertNullableStableId(actor.teamAuthorityEvidenceRef, `${path}.teamAuthorityEvidenceRef`);
  assertNullableStableId(actor.projectId, `${path}.projectId`);
  assertNullableStableId(actor.responsibleAdvisorRoleInstanceId, `${path}.responsibleAdvisorRoleInstanceId`);
  assertEnum(actor.assignmentStatus, SPATIAL_ASSIGNMENT_STATUSES, `${path}.assignmentStatus`);
  assertEnum(actor.responsibleAdvisorStatus, SPATIAL_ADVISOR_RESPONSIBILITY_STATUSES, `${path}.responsibleAdvisorStatus`);
  const refs = expectArray(actor.assignmentRefs, `${path}.assignmentRefs`);
  refs.forEach((ref, index) => validateAssignmentRef(ref, `${path}.assignmentRefs[${String(index)}]`));
  assertSortedUnique(refs, assignmentRefKey, `${path}.assignmentRefs`);
  if (actor.activeAssignmentRef !== null) {
    validateAssignmentRef(actor.activeAssignmentRef, `${path}.activeAssignmentRef`);
    if (!refs.some((ref) => assignmentRefKey(ref) === assignmentRefKey(actor.activeAssignmentRef))) {
      fail(`${path}.activeAssignmentRef is absent from assignmentRefs`);
    }
  }
  if (actor.currentActivitySourceEventId !== null) {
    assertStringPattern(
      actor.currentActivitySourceEventId,
      UUID_V7,
      `${path}.currentActivitySourceEventId`,
    );
  }
  if (
    (actor.activeAssignmentRef === null) !== (actor.currentActivitySourceEventId === null)
  ) {
    fail(`${path}.active assignment and activity source must be present together`);
  }
  assertEnum(actor.presentationScope, SPATIAL_PRESENTATION_SCOPES, `${path}.presentationScope`);
  assertNullableStableId(actor.presentationPodId, `${path}.presentationPodId`);
  assertEnum(actor.evidenceFreshness, SPATIAL_EVIDENCE_FRESHNESS, `${path}.evidenceFreshness`);
  assertEnum(actor.connectionState, SPATIAL_CONNECTION_STATES, `${path}.connectionState`);
  assertEnum(actor.operationalState, SPATIAL_OPERATIONAL_STATES, `${path}.operationalState`);
  assertBoolean(actor.workReceiptAllowed, `${path}.workReceiptAllowed`);
  assertBoolean(actor.taskMotionAllowed, `${path}.taskMotionAllowed`);
  assertBoolean(actor.independentReviewer, `${path}.independentReviewer`);
  const exactResponsibility = actor.responsibleAdvisorStatus === 'VERIFIED'
    && actor.advisorTeamId !== null
    && actor.teamAuthorityEvidenceRef !== null
    && actor.responsibleAdvisorRoleInstanceId !== null;
  if (
    actor.responsibleAdvisorStatus === 'VERIFIED'
      ? !exactResponsibility
      : actor.advisorTeamId !== null
        || actor.teamAuthorityEvidenceRef !== null
        || actor.responsibleAdvisorRoleInstanceId !== null
  ) {
    fail(`${path} Advisor responsibility references are inconsistent`);
  }
  const exactAssignment = actor.assignmentStatus === 'VERIFIED' && actor.activeAssignmentRef !== null;
  if (actor.workReceiptAllowed && (!exactResponsibility || !exactAssignment)) {
    fail(`${path}.workReceiptAllowed requires exact assignment and Advisor responsibility`);
  }
  if (actor.taskMotionAllowed && (
    !actor.workReceiptAllowed
    || actor.evidenceFreshness !== 'CURRENT'
    || actor.connectionState !== 'CONNECTED'
  )) {
    fail(`${path}.taskMotionAllowed requires current connected work eligibility`);
  }
  if (
    (actor.presentationScope === 'NONE' && actor.presentationPodId !== null)
    || (actor.presentationScope === 'TEAM_POD' && actor.presentationPodId === null)
    || (
      actor.presentationScope === 'GLOBAL_ADVISOR_HUB'
      && (
        actor.presentationPodId !== null
        || actor.responsibleAdvisorStatus !== 'VERIFIED'
        || actor.responsibleAdvisorRoleInstanceId !== actor.roleInstanceId
        || actor.taskMotionAllowed
      )
    )
  ) {
    fail(`${path}.presentationScope is inconsistent`);
  }
}

function validateMissionSummary(value: unknown, path: string): asserts value is SpatialMissionSummary {
  const summary = expectRecord(value, path);
  assertExactKeys(summary, [
    'missionRef',
    'displayName',
    'manifestVersion',
    'operationalState',
    'workUnitProgress',
    'gateProgress',
    'blockerSummary',
  ], path);
  validateMissionRef(summary.missionRef, `${path}.missionRef`);
  assertSafeDisplay(summary.displayName, `${path}.displayName`);
  assertVersion(summary.manifestVersion, `${path}.manifestVersion`);
  assertEnum(summary.operationalState, SPATIAL_OPERATIONAL_STATES, `${path}.operationalState`);
  validateProgressFact(summary.workUnitProgress, `${path}.workUnitProgress`);
  validateProgressFact(summary.gateProgress, `${path}.gateProgress`);
  validateDisplayFact(summary.blockerSummary, `${path}.blockerSummary`);
}

function validateMissionBoard(value: unknown, path: string): asserts value is SpatialMissionBoard {
  const board = expectRecord(value, path);
  assertExactKeys(board, [
    'missionRef',
    'teamName',
    'projectName',
    'responsibleAdvisor',
    'responsibleAdvisorDisplayIdentity',
    'currentMission',
    'currentPhaseOrWorkUnit',
    'currentActorDisplayIdentity',
    'assignedReviewer',
    'nextActorOrHandoff',
    'workUnitProgress',
    'requiredGateProgress',
    'blocker',
    'leoGptDecisionState',
    'latestVerifiedEvidence',
    'sourceTruthState',
  ], path);
  validateMissionRef(board.missionRef, `${path}.missionRef`);
  for (const key of [
    'teamName',
    'projectName',
    'responsibleAdvisor',
    'responsibleAdvisorDisplayIdentity',
    'currentMission',
    'currentPhaseOrWorkUnit',
    'currentActorDisplayIdentity',
    'assignedReviewer',
    'nextActorOrHandoff',
    'blocker',
    'leoGptDecisionState',
  ] as const) {
    validateDisplayFact(board[key], `${path}.${key}`);
  }
  validateProgressFact(board.workUnitProgress, `${path}.workUnitProgress`);
  validateProgressFact(board.requiredGateProgress, `${path}.requiredGateProgress`);
  validateEvidenceFact(board.latestVerifiedEvidence, `${path}.latestVerifiedEvidence`);
  assertEnum(board.sourceTruthState, SPATIAL_TRUTH_STATES, `${path}.sourceTruthState`);
}

function validateDisplayFact(value: unknown, path: string): asserts value is SpatialDisplayFact {
  const fact = expectRecord(value, path);
  assertExactKeys(fact, ['state', 'value'], path);
  assertEnum(fact.state, SPATIAL_TRUTH_STATES, `${path}.state`);
  if (fact.state === 'KNOWN') {
    assertSafeDisplay(fact.value, `${path}.value`);
  } else if (fact.value !== null) {
    fail(`${path}.value must be null unless state is KNOWN`);
  }
}

function validateProgressFact(value: unknown, path: string): asserts value is SpatialProgressFact {
  const fact = expectRecord(value, path);
  assertExactKeys(fact, ['state', 'completed', 'total'], path);
  assertEnum(fact.state, SPATIAL_TRUTH_STATES, `${path}.state`);
  if (fact.state === 'KNOWN') {
    assertNonNegativeInteger(fact.completed, `${path}.completed`);
    assertNonNegativeInteger(fact.total, `${path}.total`);
    if (fact.completed > fact.total) {
      fail(`${path}.completed exceeds total`);
    }
  } else if (fact.completed !== null || fact.total !== null) {
    fail(`${path} counts must be null unless state is KNOWN`);
  }
}

function validateEvidenceFact(value: unknown, path: string): asserts value is SpatialEvidenceFact {
  const fact = expectRecord(value, path);
  assertExactKeys(fact, ['state', 'verifiedAt', 'evidenceRef'], path);
  assertEnum(fact.state, SPATIAL_TRUTH_STATES, `${path}.state`);
  if (fact.state === 'KNOWN') {
    assertTimestamp(fact.verifiedAt, `${path}.verifiedAt`);
    assertOpaqueRef(fact.evidenceRef, `${path}.evidenceRef`);
  } else if (fact.verifiedAt !== null || fact.evidenceRef !== null) {
    fail(`${path} values must be null unless state is KNOWN`);
  }
}

function validateAssignmentView(value: unknown, path: string): asserts value is SpatialActorAssignmentView {
  const view = expectRecord(value, path);
  assertExactKeys(view, ['assignmentRef', 'roleInstanceId', 'status', 'fullCharacter', 'taskMotionAllowed'], path);
  validateAssignmentRef(view.assignmentRef, `${path}.assignmentRef`);
  assertNullableStableId(view.roleInstanceId, `${path}.roleInstanceId`);
  assertEnum(view.status, SPATIAL_ASSIGNMENT_STATUSES, `${path}.status`);
  assertBoolean(view.fullCharacter, `${path}.fullCharacter`);
  assertBoolean(view.taskMotionAllowed, `${path}.taskMotionAllowed`);
  if ((view.fullCharacter || view.taskMotionAllowed) && (view.status !== 'VERIFIED' || view.roleInstanceId === null)) {
    fail(`${path} active presentation requires a verified role instance`);
  }
}

function validateAssignmentRef(value: unknown, path: string): void {
  const ref = expectRecord(value, path);
  assertExactKeys(ref, ['projectId', 'missionId', 'workUnitId'], path);
  assertStableId(ref.projectId, `${path}.projectId`);
  assertStableId(ref.missionId, `${path}.missionId`);
  assertStableId(ref.workUnitId, `${path}.workUnitId`);
}

function validateMissionRef(value: unknown, path: string): asserts value is SpatialMissionRef {
  const ref = expectRecord(value, path);
  assertExactKeys(ref, ['projectId', 'missionId'], path);
  assertStableId(ref.projectId, `${path}.projectId`);
  assertStableId(ref.missionId, `${path}.missionId`);
}

function validateNullableMissionRef(value: unknown, path: string): void {
  if (value !== null) {
    validateMissionRef(value, path);
  }
}

function validateManifestRef(value: unknown, path: string): asserts value is SpatialSourceManifestRef {
  const ref = expectRecord(value, path);
  assertExactKeys(ref, ['projectId', 'missionId', 'manifestVersion', 'sourceCommit', 'sourceSha256'], path);
  assertStableId(ref.projectId, `${path}.projectId`);
  assertStableId(ref.missionId, `${path}.missionId`);
  assertVersion(ref.manifestVersion, `${path}.manifestVersion`);
  assertStringPattern(ref.sourceCommit, GIT_COMMIT, `${path}.sourceCommit`);
  assertStringPattern(ref.sourceSha256, SHA_256, `${path}.sourceSha256`);
}

function validateProjectionReferences(
  projection: Record<string, unknown>,
  podValues: readonly unknown[],
  actors: Record<string, unknown>,
  manifestValues: readonly unknown[],
): void {
  const pods = podValues as readonly SpatialTeamPodProjection[];
  const manifests = manifestValues as readonly SpatialSourceManifestRef[];
  const selectedPodId = projection.selectedPodId as string | null;
  const selectedPods = pods.filter((pod) => pod.selected);
  if (selectedPodId === null) {
    if (selectedPods.length !== 0 || projection.selectedMissionBoard !== null) {
      fail('null selectedPodId requires no selected pod or selected board');
    }
  } else {
    if (selectedPods.length !== 1 || selectedPods[0]?.podId !== selectedPodId) {
      fail('selectedPodId must identify exactly one selected pod');
    }
    const selectedBoard = projection.selectedMissionBoard as SpatialMissionBoard | null;
    if (
      JSON.stringify(canonicalize(selectedBoard))
      !== JSON.stringify(canonicalize(selectedPods[0].missionBoardSummary))
    ) {
      fail('selectedMissionBoard must match the selected pod board');
    }
  }

  const podIds = new Set(pods.map((pod) => pod.podId));
  const projectIds = new Set(pods.map((pod) => pod.projectId));
  const manifestsByMission = new Map(manifests.map((manifest) => [manifestRefKey(manifest), manifest]));
  const summaryKeys = new Set<string>();
  const fullCharacterPodsByActor = new Map<string, string>();
  const taskMotionActors = new Set<string>();
  const assignmentViewKeysByActor = new Set<string>();
  const sourceEventIds = new Set(projection.sourceEventIds as readonly string[]);
  for (const pod of pods) {
    if (pod.projectIdentity.textId !== pod.projectId) {
      fail(`${pod.podId} project identity does not match projectId`);
    }
    if (pod.selectedMissionRef !== null && pod.selectedMissionRef.projectId !== pod.projectId) {
      fail(`${pod.podId} selected mission crosses project boundary`);
    }
    const responsibleAdvisor = pod.responsibleAdvisorRoleInstanceId === null
      ? undefined
      : actors[pod.responsibleAdvisorRoleInstanceId] as SpatialActorProjection | undefined;
    if (
      pod.responsibleAdvisorRoleInstanceId !== null
      && (
        responsibleAdvisor?.advisorTeamId !== pod.advisorTeamId
        || responsibleAdvisor.responsibleAdvisorRoleInstanceId
          !== pod.responsibleAdvisorRoleInstanceId
      )
    ) {
      fail(`${pod.podId} responsible Advisor reference is inconsistent`);
    }
    for (const summary of pod.missionSummaries) {
      if (summary.missionRef.projectId !== pod.projectId) {
        fail(`${pod.podId} mission summary crosses project boundary`);
      }
      const key = missionRefKey(summary.missionRef);
      const manifest = manifestsByMission.get(key);
      if (manifest === undefined) {
        fail(`${pod.podId} mission summary has no verified source manifest`);
      }
      if (manifest.manifestVersion !== summary.manifestVersion) {
        fail(`${pod.podId} mission summary manifest version is inconsistent`);
      }
      summaryKeys.add(key);
    }
    if (pod.missionBoardSummary !== null && pod.missionBoardSummary.missionRef.projectId !== pod.projectId) {
      fail(`${pod.podId} mission board crosses project boundary`);
    }
    const selectedMissionKey = pod.selectedMissionRef === null
      ? null
      : missionRefKey(pod.selectedMissionRef);
    const boardMissionKey = pod.missionBoardSummary === null
      ? null
      : missionRefKey(pod.missionBoardSummary.missionRef);
    if (
      selectedMissionKey !== boardMissionKey
      || (selectedMissionKey !== null && !summaryKeys.has(selectedMissionKey))
    ) {
      fail(`${pod.podId} selected mission and board are inconsistent`);
    }
    if (
      pod.fullChoreographyEnabled
      && (
        !pod.selected
        || pod.authorityStatus !== 'VERIFIED'
        || pod.evidenceFreshness !== 'CURRENT'
        || pod.connectionState !== 'CONNECTED'
        || pod.responsibleAdvisorRoleInstanceId === null
        || pod.missionBoardSummary === null
      )
    ) {
      fail(`${pod.podId} full choreography lacks exact current authority evidence`);
    }
    for (const assignment of pod.actorAssignments) {
      if (assignment.assignmentRef.projectId !== pod.projectId) {
        fail(`${pod.podId} assignment crosses project boundary`);
      }
      if (assignment.roleInstanceId !== null && actors[assignment.roleInstanceId] === undefined) {
        fail(`${pod.podId} assignment references an unknown actor`);
      }
      if (assignment.fullCharacter && assignment.roleInstanceId !== null) {
        if (fullCharacterPodsByActor.has(assignment.roleInstanceId)) {
          fail(`actor ${assignment.roleInstanceId} is cloned across pods`);
        }
        const actor = actors[assignment.roleInstanceId] as SpatialActorProjection;
        if (actor.presentationPodId !== pod.podId) {
          fail(`actor ${assignment.roleInstanceId} presentation pod is inconsistent`);
        }
        fullCharacterPodsByActor.set(assignment.roleInstanceId, pod.podId);
      }
      if (assignment.roleInstanceId !== null) {
        const actor = actors[assignment.roleInstanceId] as SpatialActorProjection;
        if (!actor.assignmentRefs.some((ref) =>
          assignmentRefKey(ref) === assignmentRefKey(assignment.assignmentRef))) {
          fail(`${pod.podId} assignment view is absent from its actor references`);
        }
        assignmentViewKeysByActor.add(
          `${assignment.roleInstanceId}\u0000${assignmentRefKey(assignment.assignmentRef)}`,
        );
        if (assignment.status !== actor.assignmentStatus) {
          fail(`${pod.podId} assignment status is inconsistent with its actor`);
        }
        if (assignment.taskMotionAllowed) {
          if (!pod.selected || !pod.fullChoreographyEnabled || !actor.taskMotionAllowed) {
            fail(`${pod.podId} assignment motion lacks selected current evidence`);
          }
          taskMotionActors.add(assignment.roleInstanceId);
        }
      }
    }
  }

  for (const manifest of manifests) {
    if (!projectIds.has(manifest.projectId)) {
      fail(`source manifest references unknown project ${manifest.projectId}`);
    }
    if (!summaryKeys.has(manifestRefKey(manifest))) {
      fail(`source manifest ${manifest.missionId} has no mission summary`);
    }
  }
  for (const actorValue of Object.values(actors)) {
    const actor = actorValue as SpatialActorProjection;
    if (
      actor.currentActivitySourceEventId !== null
      && !sourceEventIds.has(actor.currentActivitySourceEventId)
    ) {
      fail(`actor ${actor.roleInstanceId} activity source is not accepted by the projection`);
    }
    if (actor.projectId !== null && !projectIds.has(actor.projectId)) {
      fail(`actor ${actor.roleInstanceId} references an unknown project`);
    }
    if (actor.presentationPodId !== null && !podIds.has(actor.presentationPodId)) {
      fail(`actor ${actor.roleInstanceId} references an unknown presentation pod`);
    }
    for (const ref of actor.assignmentRefs) {
      if (!projectIds.has(ref.projectId)) {
        fail(`actor ${actor.roleInstanceId} assignment references an unknown project`);
      }
      if (!assignmentViewKeysByActor.has(`${actor.roleInstanceId}\u0000${assignmentRefKey(ref)}`)) {
        fail(`actor ${actor.roleInstanceId} assignment reference has no pod view`);
      }
    }
    if (
      actor.presentationPodId !== null
      && fullCharacterPodsByActor.get(actor.roleInstanceId) !== actor.presentationPodId
    ) {
      fail(`actor ${actor.roleInstanceId} presentation pod lacks a full-character view`);
    }
    if (actor.presentationPodId !== null && actor.presentationScope !== 'TEAM_POD') {
      fail(`actor ${actor.roleInstanceId} pod presentation scope is inconsistent`);
    }
    if (actor.taskMotionAllowed !== taskMotionActors.has(actor.roleInstanceId)) {
      fail(`actor ${actor.roleInstanceId} task motion is inconsistent with assignment views`);
    }
  }
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function expectArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    fail(`${path} must be an array`);
  }
  return value;
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  path: string,
): void {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) {
    fail(`${path} has unknown or missing fields`);
  }
}

function assertStableId(value: unknown, path: string): asserts value is string {
  assertStringPattern(value, STABLE_ID, path);
  if (hasForbiddenCurrentName(value)) {
    fail(`${path} uses a forbidden current product name`);
  }
}

function assertNullableStableId(value: unknown, path: string): void {
  if (value !== null) {
    assertStableId(value, path);
  }
}

function assertVersion(value: unknown, path: string): asserts value is string {
  assertStringPattern(value, VERSION, path);
}

function assertOpaqueRef(value: unknown, path: string): asserts value is string {
  assertStringPattern(value, STABLE_ID, path);
}

function assertTimestamp(value: unknown, path: string): asserts value is string {
  assertStringPattern(value, RFC_3339, path);
  if (Number.isNaN(Date.parse(value))) {
    fail(`${path} must be a valid RFC3339 UTC timestamp`);
  }
}

function assertSafeDisplay(value: unknown, path: string): asserts value is string {
  if (
    typeof value !== 'string'
    || value.trim() !== value
    || value.length === 0
    || value.length > 256
    || hasForbiddenControl(value)
    || hasForbiddenCurrentName(value)
    || UNSAFE_DISPLAY.test(value)
    || RAW_TARGET.test(value)
    || PATH_SHAPED.test(value.replaceAll('Leo/GPT', ''))
  ) {
    fail(`${path} must be a redacted registered display value`);
  }
}

function hasForbiddenControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

function hasForbiddenCurrentName(value: string): boolean {
  const latin = String.fromCodePoint(115, 104, 97, 115, 104, 117);
  const korean = String.fromCodePoint(0xc0e4, 0xc288);
  return value.toLowerCase().includes(latin) || value.includes(korean);
}

function assertStringPattern(
  value: unknown,
  pattern: RegExp,
  path: string,
): asserts value is string {
  if (typeof value !== 'string' || !pattern.test(value)) {
    fail(`${path} has an invalid format`);
  }
}

function assertBoolean(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    fail(`${path} must be boolean`);
  }
}

function assertNonNegativeInteger(value: unknown, path: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    fail(`${path} must be a non-negative integer`);
  }
}

function assertEqual<T>(value: unknown, expected: T, path: string): asserts value is T {
  if (value !== expected) {
    fail(`${path} must equal ${String(expected)}`);
  }
}

function assertEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): asserts value is T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    fail(`${path} has an unsupported value`);
  }
}

function assertSortedUnique<T>(
  values: readonly T[],
  keyOf: (value: T) => unknown,
  path: string,
): void {
  let previous: string | undefined;
  for (const value of values) {
    const key = keyOf(value);
    if (typeof key !== 'string') {
      fail(`${path} has an invalid sort key`);
    }
    if (previous !== undefined && key <= previous) {
      fail(`${path} must be uniquely sorted`);
    }
    previous = key;
  }
}

function podIdForProject(projectId: string): string {
  return `pod:${projectId}`;
}

function missionRefKey(value: unknown): string {
  const ref = value as SpatialMissionRef;
  return `${ref.projectId}\u0000${ref.missionId}`;
}

function manifestRefKey(value: unknown): string {
  const ref = value as SpatialSourceManifestRef;
  return missionRefKey(ref);
}

function assignmentRefKey(value: unknown): string {
  const ref = value as { readonly projectId: string; readonly missionId: string; readonly workUnitId: string };
  return `${ref.projectId}\u0000${ref.missionId}\u0000${ref.workUnitId}`;
}

function assignmentViewKey(value: unknown): string {
  const view = value as SpatialActorAssignmentView;
  return `${assignmentRefKey(view.assignmentRef)}\u0000${view.roleInstanceId ?? ''}`;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value !== null && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      output[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return output;
  }
  return value;
}

function fail(message: string): never {
  throw new SpatialProjectionValidationError(message);
}
