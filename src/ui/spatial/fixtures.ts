import { createSpatialOfficeFixtureInput } from '../../application/spatial-office/fixtures.js';
import { projectSpatialOffice } from '../../application/spatial-office/projector.js';
import type { SpatialOfficeProjectionV1 } from '../../application/spatial-office/types.js';
import type { SpatialActorProjection } from '../../application/spatial-office/types.js';
import { projectRequiredObservable } from '../../domain/activity/index.js';
import {
  projectSpatialCue,
  type SpatialCueFactInput,
  type SpatialCueProjectorInput,
  type SpatialCueProjectionResult,
} from './cue-projector.js';
import {
  createSpatialCueReducerState,
  reduceSpatialCues,
  type SpatialCueReducerState,
} from './cue-reducer.js';
import type { VerifiedIdlePresentationInput } from './lounge.js';
import {
  PROJECT_IDENTITY_CATALOG_VERSION,
  resolveProjectIdentity,
} from './project-identity.js';

export const STATIC_SPATIAL_OFFICE_FIXTURE_ID = 'ao12-b-static-shared-floor' as const;
export const MOTION_SPATIAL_OFFICE_FIXTURE_ID = 'ao12-c-evidence-backed-motion' as const;

export interface StaticSpatialOfficeFixture {
  readonly fixtureId: typeof STATIC_SPATIAL_OFFICE_FIXTURE_ID;
  readonly fixtureKind: 'SYNTHETIC_NON_OPERATIONAL_STATIC';
  readonly label: string;
  readonly projection: SpatialOfficeProjectionV1;
}

export interface MotionSpatialOfficeFixture {
  readonly fixtureId: typeof MOTION_SPATIAL_OFFICE_FIXTURE_ID;
  readonly fixtureKind: 'SYNTHETIC_STRUCTURED_EVENT_MOTION';
  readonly label: string;
  readonly projection: SpatialOfficeProjectionV1;
  readonly cueState: SpatialCueReducerState;
  readonly verifiedIdle: readonly VerifiedIdlePresentationInput[];
}

export function createStaticSpatialOfficeFixture(): StaticSpatialOfficeFixture {
  const source = createSpatialOfficeFixtureInput();
  const projects = source.projects.map((project) => {
    const identity = resolveProjectIdentity(project.projectId, project.displayName);
    return {
      ...project,
      projectIdentity: {
        catalogEntryId: identity.catalogEntryId,
        textId: identity.projectId,
        displayName: identity.displayName,
      },
    };
  });
  return {
    fixtureId: STATIC_SPATIAL_OFFICE_FIXTURE_ID,
    fixtureKind: 'SYNTHETIC_NON_OPERATIONAL_STATIC',
    label: 'AO12-B synthetic static shared floor',
    projection: projectSpatialOffice({
      ...source,
      identityCatalogVersion: PROJECT_IDENTITY_CATALOG_VERSION,
      projects,
    }),
  };
}

export const STATIC_SPATIAL_OFFICE_FIXTURE = createStaticSpatialOfficeFixture();

export function createMotionSpatialOfficeFixture(): MotionSpatialOfficeFixture {
  const staticFixture = createStaticSpatialOfficeFixture();
  const projection = motionProjection(staticFixture.projection);
  const initial = reduceSpatialCues(createSpatialCueReducerState(), {
    origin: 'INITIAL_SNAPSHOT',
    projectionRevision: 12,
    projectionFingerprint: 'ao12-c-synthetic-baseline-revision-12',
    selectedPodId: 'pod:agent-office',
    fullSnapshotVerified: true,
    results: [],
  });
  const results = [
    motionCue('WAITING_LEO', 201, 'worker.agent-office.primary', 'AO12-IWU-09', 45),
    motionCue('TESTING', 202, 'control.foundation.primary', 'AO12-IWU-10', 44),
    motionCue('WORKING', 203, 'worker.foundation.primary', 'AO12-IWU-11', 43),
  ];
  const cueState = reduceSpatialCues(initial, {
    origin: 'LIVE_DELTA',
    projectionRevision: 13,
    projectionFingerprint: 'ao12-c-synthetic-live-delta-revision-13',
    selectedPodId: 'pod:agent-office',
    fullSnapshotVerified: false,
    results,
  });
  return {
    fixtureId: MOTION_SPATIAL_OFFICE_FIXTURE_ID,
    fixtureKind: 'SYNTHETIC_STRUCTURED_EVENT_MOTION',
    label: 'AO12-C synthetic accepted-event motion fixture',
    projection,
    cueState,
    verifiedIdle: [
      {
        roleInstanceId: 'worker.cosmile.primary',
        advisorTeamId: 'FOUNDATION_ADVISOR_TEAM',
        responsibleAdvisorRoleInstanceId: 'advisor.foundation.primary',
        operationalState: 'IDLE',
        evidenceFreshness: 'CURRENT',
        connectionState: 'CONNECTED',
        assignmentVerified: true,
        idleEvidenceVerified: true,
        evaluatedAt: projection.evaluatedAt,
        presentation: 'COFFEE',
      },
    ],
  };
}

export const MOTION_SPATIAL_OFFICE_FIXTURE = createMotionSpatialOfficeFixture();

function motionProjection(projection: SpatialOfficeProjectionV1): SpatialOfficeProjectionV1 {
  const assignments = [
    ['worker.agent-office.primary', 'AO12-IWU-09', 'WAITING_LEO'],
    ['control.foundation.primary', 'AO12-IWU-10', 'TESTING'],
    ['worker.foundation.primary', 'AO12-IWU-11', 'WORKING'],
  ] as const;
  const actorsByRoleInstanceId = { ...projection.actorsByRoleInstanceId };
  for (const [roleInstanceId, workUnitId, operationalState] of assignments) {
    const actor = actorsByRoleInstanceId[roleInstanceId];
    if (actor === undefined) throw new TypeError(`motion fixture actor missing: ${roleInstanceId}`);
    const assignmentRef = { projectId: 'agent-office', missionId: 'mission-ao12', workUnitId };
    actorsByRoleInstanceId[roleInstanceId] = {
      ...actor,
      assignmentStatus: 'VERIFIED',
      assignmentRefs: [assignmentRef],
      activeAssignmentRef: assignmentRef,
      currentActivitySourceEventId: eventId(200 + assignments.findIndex((entry) => entry[0] === roleInstanceId) + 1),
      presentationScope: 'TEAM_POD',
      presentationPodId: 'pod:agent-office',
      operationalState,
      workReceiptAllowed: true,
      taskMotionAllowed: true,
    } satisfies SpatialActorProjection;
  }
  const pods = projection.pods.map((pod) => {
    if (pod.podId !== 'pod:agent-office') return pod;
    const actorAssignments = assignments.map(([roleInstanceId, workUnitId]) => ({
      assignmentRef: { projectId: 'agent-office', missionId: 'mission-ao12', workUnitId },
      roleInstanceId,
      status: 'VERIFIED' as const,
      fullCharacter: true,
      taskMotionAllowed: true,
    }));
    return {
      ...pod,
      operationalState: 'WAITING_LEO' as const,
      actorAssignments,
      fullChoreographyEnabled: true,
    };
  });
  return {
    ...projection,
    projectionRevision: 13,
    pods,
    actorsByRoleInstanceId,
    sourceEventIds: [...projection.sourceEventIds, eventId(201), eventId(202), eventId(203)].sort(),
  };
}

function motionCue(
  kind: 'WAITING_LEO' | 'TESTING' | 'WORKING',
  id: number,
  roleInstanceId: string,
  workUnitId: string,
  missionSequence: number,
): SpatialCueProjectionResult {
  const factByKind: Readonly<Record<typeof kind, SpatialCueFactInput>> = {
    WAITING_LEO: fixtureFact('DECISION_REQUEST_ACCEPTED', id, workUnitId, 'WAITING_LEO', 'WAITING_LEO', ['VERIFIED_DECISION_REQUEST', 'EXACT_ADVISOR_ROUTE']),
    TESTING: fixtureFact('TESTING_ACCEPTED', id, workUnitId, 'TESTING', 'TESTING', ['COMMAND_AND_EVIDENCE_REFS']),
    WORKING: fixtureFact('WORKING_ACCEPTED', id, workUnitId, 'RUNNING', 'WORKING', []),
  };
  const input: SpatialCueProjectorInput = {
    projectionSchemaVersion: 'agent-office.spatial-office-projection.v1',
    projectionRevision: 13,
    previousAppliedRevision: 12,
    evaluatedAt: '2026-07-11T12:00:00.000Z',
    updateOrigin: 'LIVE_DELTA',
    selectedPodId: 'pod:agent-office',
    pod: {
      podId: 'pod:agent-office',
      advisorTeamId: 'FOUNDATION_ADVISOR_TEAM',
      projectId: 'agent-office',
      selected: true,
      sourceAuthorityVerified: true,
      evidenceFreshness: 'CURRENT',
      connectionState: 'CONNECTED',
      responsibleAdvisorRoleInstanceIds: ['advisor.foundation.primary'],
      openAlertSeverity: 'NONE',
    },
    mission: {
      missionId: 'mission-ao12',
      manifestVersion: '1.0.0',
      manifestVerified: true,
      missionSequence,
      acceptedEventIds: [eventId(id)],
    },
    actor: {
      roleInstanceId,
      advisorTeamId: 'FOUNDATION_ADVISOR_TEAM',
      responsibleAdvisorStatus: 'VERIFIED',
      responsibleAdvisorTeamIds: ['FOUNDATION_ADVISOR_TEAM'],
      responsibleAdvisorRoleInstanceIds: ['advisor.foundation.primary'],
      assignmentStatus: 'VERIFIED',
      assignmentProjectId: 'agent-office',
      assignmentMissionId: 'mission-ao12',
      assignmentWorkUnitId: workUnitId,
      sourceBoundaryVerified: true,
      taskMotionAllowed: true,
    },
    fact: factByKind[kind],
  };
  return projectSpatialCue(input);
}

function fixtureFact(
  factKind: SpatialCueFactInput['factKind'],
  id: number,
  workUnitId: string,
  workUnitState: NonNullable<SpatialCueFactInput['workUnitState']>,
  activity: NonNullable<SpatialCueFactInput['activity']>['activity'],
  verifiedEvidence: SpatialCueFactInput['verifiedEvidence'],
): SpatialCueFactInput {
  const sourceEventId = eventId(id);
  const evaluatedAt = '2026-07-11T12:00:00.000Z';
  const activityInput = {
    activity,
    reasonCode: activity,
    sourceEventIds: [sourceEventId],
  } as const;
  return {
    factKind,
    sourceEventIds: [sourceEventId],
    workUnitId,
    workUnitState,
    stateSourceEventId: sourceEventId,
    requiredObservableName: projectRequiredObservable(
      workUnitState,
      { ...activityInput, effectiveFrom: evaluatedAt },
      evaluatedAt,
    ).requiredObservableName,
    activity: activityInput,
    verifiedEvidence,
    currentZoneId: `work:${roleInstanceIdForWorkUnit(workUnitId)}`,
  };
}

function roleInstanceIdForWorkUnit(workUnitId: string): string {
  if (workUnitId === 'AO12-IWU-09') return 'worker.agent-office.primary';
  if (workUnitId === 'AO12-IWU-10') return 'control.foundation.primary';
  return 'worker.foundation.primary';
}

function eventId(index: number): string {
  return `00000000-0000-7${index.toString(16).padStart(3, '0')}-8000-${index.toString(16).padStart(12, '0')}`;
}
