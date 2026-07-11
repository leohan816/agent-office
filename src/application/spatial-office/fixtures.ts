import {
  FOUNDATION_ADVISOR_TEAM_ID,
  VIBENEWS_ADVISOR_TEAM_ID,
  resolveSpatialAssignments,
  type AdvisorTeamAuthorityInput,
  type SpatialActorRegistrationInput,
  type SpatialWorkAssignmentInput,
} from './assignment-resolver.js';
import type {
  SpatialDisplayFact,
  SpatialEvidenceSummary,
  SpatialMissionBoard,
  SpatialMissionSummary,
  SpatialSourceManifestRef,
} from './types.js';
import type {
  SpatialOfficeProjectorInput,
  SpatialRegisteredProjectInput,
  SpatialVerifiedMissionInput,
} from './projector.js';

const EVALUATED_AT = '2026-07-11T12:00:00.000Z';
const FOUNDATION_ADVISOR_ID = 'advisor.foundation.primary';
const VIBENEWS_ADVISOR_ID = 'advisor.vibenews.primary';
const CONTROL_ID = 'control.foundation.primary';
const FOUNDATION_WORKER_ID = 'worker.foundation.primary';
const COSMILE_WORKER_ID = 'worker.cosmile.primary';
const SIASIU_WORKER_ID = 'worker.siasiu.primary';
const AGENT_OFFICE_WORKER_ID = 'worker.agent-office.primary';
const VIBENEWS_WORKER_ID = 'worker.vibenews.primary';
const VIBENEWS_DESIGNER_ID = 'designer.vibenews.primary';
const VIBENEWS_REVIEWER_ID = 'reviewer.vibenews.primary';

export function createSpatialOfficeFixtureInput(): SpatialOfficeProjectorInput {
  const teams: readonly AdvisorTeamAuthorityInput[] = [
    {
      advisorTeamId: FOUNDATION_ADVISOR_TEAM_ID,
      responsibleAdvisorRoleInstanceIds: [FOUNDATION_ADVISOR_ID],
      memberRoleInstanceIds: [
        FOUNDATION_ADVISOR_ID,
        CONTROL_ID,
        FOUNDATION_WORKER_ID,
        COSMILE_WORKER_ID,
        SIASIU_WORKER_ID,
        AGENT_OFFICE_WORKER_ID,
      ].sort(),
      authorityEvidenceStatus: 'VERIFIED',
      authorityEvidenceRef: 'authority.foundation-team.v1',
    },
    {
      advisorTeamId: VIBENEWS_ADVISOR_TEAM_ID,
      responsibleAdvisorRoleInstanceIds: [VIBENEWS_ADVISOR_ID],
      memberRoleInstanceIds: [
        VIBENEWS_ADVISOR_ID,
        VIBENEWS_WORKER_ID,
        VIBENEWS_DESIGNER_ID,
        VIBENEWS_REVIEWER_ID,
      ].sort(),
      authorityEvidenceStatus: 'VERIFIED',
      authorityEvidenceRef: 'authority.vibenews-team.v1',
    },
  ];
  const actors: readonly SpatialActorRegistrationInput[] = [
    actor(FOUNDATION_ADVISOR_ID, 'Foundation Advisor', 'Advisor model', 'agent-office', 'source.agent-office'),
    actor(CONTROL_ID, 'Control', 'Control model', 'agent-office', 'source.agent-office'),
    actor(FOUNDATION_WORKER_ID, 'Foundation Worker', 'Foundation model', 'agent-office', 'source.agent-office'),
    actor(COSMILE_WORKER_ID, 'Cosmile Worker', 'Cosmile model', 'agent-office', 'source.agent-office'),
    actor(SIASIU_WORKER_ID, 'SIASIU Worker', 'SIASIU model', 'agent-office', 'source.agent-office'),
    actor(AGENT_OFFICE_WORKER_ID, 'Agent Office Worker', 'Worker model', 'agent-office', 'source.agent-office'),
    actor(VIBENEWS_ADVISOR_ID, 'VibeNews Advisor', 'Vibe Advisor model', 'vibenews', 'source.vibenews'),
    actor(VIBENEWS_WORKER_ID, 'VibeNews Worker', 'Vibe Worker model', 'vibenews', 'source.vibenews'),
    actor(VIBENEWS_DESIGNER_ID, 'VibeNews Designer', 'Vibe Designer model', 'vibenews', 'source.vibenews'),
    actor(
      VIBENEWS_REVIEWER_ID,
      'VibeNews Reviewer',
      'Vibe Reviewer model',
      'vibenews',
      'source.vibenews',
      true,
    ),
  ];
  const workAssignments: readonly SpatialWorkAssignmentInput[] = [
    assignment(
      'agent-office',
      'mission-ao12',
      'AO12-IWU-01',
      AGENT_OFFICE_WORKER_ID,
      'Agent Office Worker',
      'source.agent-office',
      '00000000-0000-7000-8000-000000000101',
    ),
    assignment(
      'vibenews',
      'mission-vibe',
      'VIBE-IWU-01',
      VIBENEWS_WORKER_ID,
      'VibeNews Worker',
      'source.vibenews',
      '00000000-0000-7000-8000-000000000102',
    ),
  ];
  return {
    projectionRevision: 12,
    evaluatedAt: EVALUATED_AT,
    initiativeRef: 'initiative.agent-office',
    identityCatalogVersion: '1.0.0',
    projects: [
      project('agent-office', 'Agent Office', FOUNDATION_ADVISOR_TEAM_ID, FOUNDATION_ADVISOR_ID, 'Advisor model'),
      project('vibenews', 'VibeNews', VIBENEWS_ADVISOR_TEAM_ID, VIBENEWS_ADVISOR_ID, 'Vibe Advisor model'),
    ],
    missions: [
      mission(
        'agent-office',
        'mission-ao12',
        'Agent Office M1.2',
        FOUNDATION_ADVISOR_TEAM_ID,
        'Foundation Advisor',
        'Advisor model',
        'Worker model',
        'AO12-IWU-01',
        '00000000-0000-7000-8000-000000000101',
      ),
      mission(
        'vibenews',
        'mission-vibe',
        'VibeNews private mission',
        VIBENEWS_ADVISOR_TEAM_ID,
        'VibeNews Advisor',
        'Vibe Advisor model',
        'Vibe Worker model',
        'VIBE-IWU-01',
        '00000000-0000-7000-8000-000000000102',
      ),
    ],
    assignments: resolveSpatialAssignments({ teams, actors, workAssignments }),
    sourceEventIds: [
      '00000000-0000-7000-8000-000000000101',
      '00000000-0000-7000-8000-000000000102',
    ],
    selection: { explicitPodId: null, explicitMissionRef: null, deepLinkedMissionRef: null },
  };
}

function actor(
  roleInstanceId: string,
  actorRole: string,
  displayIdentity: string,
  projectId: string,
  sourceId: string,
  independentReviewer = false,
): SpatialActorRegistrationInput {
  return {
    roleInstanceId,
    actorRole,
    displayIdentity,
    projectId,
    hostId: 'host.loopback-fixture',
    sourceId,
    evidenceFreshness: 'CURRENT',
    connectionState: 'CONNECTED',
    active: true,
    independentReviewer,
  };
}

function assignment(
  projectId: string,
  missionId: string,
  workUnitId: string,
  roleInstanceId: string,
  expectedActorRole: string,
  sourceId: string,
  currentActivitySourceEventId: string,
): SpatialWorkAssignmentInput {
  return {
    assignmentRef: { projectId, missionId, workUnitId },
    expectedActorRole,
    candidateRoleInstanceIds: [roleInstanceId],
    hostId: 'host.loopback-fixture',
    sourceId,
    sourceVerified: true,
    nonterminal: true,
    currentActivitySourceEventId,
    acceptedEventIds: [currentActivitySourceEventId],
    reviewerAssignment: false,
  };
}

function project(
  projectId: string,
  displayName: string,
  advisorTeamId: string,
  responsibleAdvisorRoleInstanceId: string,
  advisorDisplayIdentity: string,
): SpatialRegisteredProjectInput {
  return {
    projectId,
    displayName,
    advisorTeamId,
    projectIdentity: {
      catalogEntryId: `identity.${projectId}`,
      textId: projectId,
      displayName,
    },
    authorityStatus: 'VERIFIED',
    evidenceFreshness: 'CURRENT',
    connectionState: 'CONNECTED',
    responsibleAdvisorRoleInstanceId,
    responsibleAdvisorDisplayIdentity: known(advisorDisplayIdentity),
    alertSummary: { severity: 'NONE', openCount: 0 },
    evidenceSummary: evidenceSummary(`evidence.${projectId}.latest`),
  };
}

function mission(
  projectId: string,
  missionId: string,
  displayName: string,
  teamName: string,
  advisorName: string,
  advisorIdentity: string,
  actorIdentity: string,
  workUnitId: string,
  sourceEventId: string,
): SpatialVerifiedMissionInput {
  const sourceManifestRef: SpatialSourceManifestRef = {
    projectId,
    missionId,
    manifestVersion: '1.0.0',
    sourceCommit: '1111111111111111111111111111111111111111',
    sourceSha256: projectId === 'agent-office'
      ? 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      : 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  };
  const missionSummary: SpatialMissionSummary = {
    missionRef: { projectId, missionId },
    displayName,
    manifestVersion: sourceManifestRef.manifestVersion,
    operationalState: 'WORKING',
    workUnitProgress: { state: 'KNOWN', completed: 0, total: 4 },
    gateProgress: { state: 'KNOWN', completed: 0, total: 1 },
    blockerSummary: unknown(),
  };
  const missionBoard: SpatialMissionBoard = {
    missionRef: { projectId, missionId },
    teamName: known(teamName),
    projectName: known(projectId === 'agent-office' ? 'Agent Office' : 'VibeNews'),
    responsibleAdvisor: known(advisorName),
    responsibleAdvisorDisplayIdentity: known(advisorIdentity),
    currentMission: known(displayName),
    currentPhaseOrWorkUnit: known(workUnitId),
    currentActorDisplayIdentity: known(actorIdentity),
    assignedReviewer: unknown(),
    nextActorOrHandoff: unknown(),
    workUnitProgress: missionSummary.workUnitProgress,
    requiredGateProgress: missionSummary.gateProgress,
    blocker: unknown(),
    leoGptDecisionState: known('PENDING'),
    latestVerifiedEvidence: {
      state: 'KNOWN',
      verifiedAt: EVALUATED_AT,
      evidenceRef: `evidence.${sourceEventId}`,
    },
    sourceTruthState: 'KNOWN',
  };
  return {
    sourceAuthorityVerified: true,
    mainMission: true,
    sourceManifestRef,
    missionSummary,
    missionBoard,
  };
}

function evidenceSummary(evidenceRef: string): SpatialEvidenceSummary {
  return {
    verifiedCount: 1,
    latest: { state: 'KNOWN', verifiedAt: EVALUATED_AT, evidenceRef },
  };
}

function known(value: string): SpatialDisplayFact {
  return { state: 'KNOWN', value };
}

function unknown(): SpatialDisplayFact {
  return { state: 'UNKNOWN', value: null };
}
