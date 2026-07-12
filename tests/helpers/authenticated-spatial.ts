import {
  AUTHENTICATED_SPATIAL_CUE_SLICE_SCHEMA_VERSION,
  AUTHENTICATED_SPATIAL_PRESENTATION_SCHEMA_VERSION,
  type AuthenticatedSpatialPresentationV1,
} from '../../src/application/spatial-office/authenticated-projection.js';
import { MOTION_SPATIAL_OFFICE_FIXTURE } from '../../src/ui/spatial/fixtures.js';
import {
  OFFICE_STATIONS,
  type RoleSceneProjection,
} from '../../src/ui/scene/types.js';

const WORKING_EVENT_ID = '00000000-0000-70cb-8000-0000000000cb';

export function authenticatedSpatialPresentationFixture(): AuthenticatedSpatialPresentationV1 {
  const projection = structuredClone(MOTION_SPATIAL_OFFICE_FIXTURE.projection);
  return {
    schemaVersion: AUTHENTICATED_SPATIAL_PRESENTATION_SCHEMA_VERSION,
    projection,
    cueSlices: [{
      schemaVersion: AUTHENTICATED_SPATIAL_CUE_SLICE_SCHEMA_VERSION,
      projectionRevision: projection.projectionRevision,
      evaluatedAt: projection.evaluatedAt,
      activityEffectiveFrom: projection.evaluatedAt,
      podId: 'pod:agent-office',
      roleInstanceId: 'worker.foundation.primary',
      missionId: 'mission-ao12',
      manifestVersion: '1.0.0',
      missionSequence: 43,
      acceptedEventIds: projection.sourceEventIds,
      fact: {
        factKind: 'WORKING_ACCEPTED',
        sourceEventIds: [WORKING_EVENT_ID],
        workUnitId: 'AO12-IWU-11',
        workUnitState: 'RUNNING',
        stateSourceEventId: WORKING_EVENT_ID,
        requiredObservableName: 'WORKING',
        activity: {
          activity: 'WORKING',
          reasonCode: 'WORKING',
          sourceEventIds: [WORKING_EVENT_ID],
        },
        verifiedEvidence: [],
      },
    }],
  };
}

export function m1SceneRolesFixture(): readonly RoleSceneProjection[] {
  return OFFICE_STATIONS.map((station, index) => ({
    projectionRevision: 1,
    missionSequence: index,
    roleInstanceId: `role.${station.id}`,
    stationId: station.id,
    actorRole: station.actorRole,
    evaluatedAt: '2026-07-11T12:00:00.000Z',
    acceptedEventIds: [],
    evidenceFreshness: 'CURRENT',
    connectionState: 'CONNECTED',
    openAlertSeverity: 'NONE',
  }));
}
