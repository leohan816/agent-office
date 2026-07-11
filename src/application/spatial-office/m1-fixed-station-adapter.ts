import {
  SCENE_PRECEDENCE,
  TRANSIENT_SEQUENCES,
  initializeScene,
} from '../../ui/scene/state-machine.js';
import {
  OFFICE_STATIONS,
  OFFICE_STATION_IDS,
  type OfficeStationDefinition,
  type RoleSceneProjection,
  type SceneRuntime,
  type SceneStateName,
} from '../../ui/scene/types.js';
import {
  SPATIAL_OFFICE_SCHEMA_VERSION,
  type SpatialOfficeProjectionV1,
} from './types.js';
import { parseSpatialOfficeProjection } from './validation.js';

export const M1_FIXED_STATION_ADAPTER_SCHEMA_VERSION =
  'agent-office.m1-fixed-station-adapter.v1' as const;
export const M1_MOBILE_STATIONS_PER_PAGE = 2 as const;
export const M1_MAX_CONCURRENT_CUES = 3 as const;

export type M1SpatialFallbackReason =
  | 'SPATIAL_PROJECTION_ABSENT'
  | 'UNSUPPORTED_SPATIAL_VERSION'
  | 'INVALID_SPATIAL_PROJECTION';

export interface M1FixedStationSpatialView {
  readonly schemaVersion: typeof M1_FIXED_STATION_ADAPTER_SCHEMA_VERSION;
  readonly compatibilityMode: 'M1_FIXED_STATIONS';
  readonly staticFallback: true;
  readonly fallbackReason: M1SpatialFallbackReason;
  readonly stations: readonly OfficeStationDefinition[];
  readonly scene: SceneRuntime;
  readonly precedence: Readonly<Record<SceneStateName, number>>;
  readonly transientSequences: typeof TRANSIENT_SEQUENCES;
  readonly mobileStationsPerPage: typeof M1_MOBILE_STATIONS_PER_PAGE;
  readonly maxConcurrentCues: typeof M1_MAX_CONCURRENT_CUES;
  readonly inventedProjectHistory: null;
}

export type SpatialOfficeCompatibilityView =
  | SpatialOfficeProjectionV1
  | M1FixedStationSpatialView;

export function adaptM1FixedStations(
  roles: readonly RoleSceneProjection[],
  fallbackReason: M1SpatialFallbackReason = 'SPATIAL_PROJECTION_ABSENT',
): M1FixedStationSpatialView {
  assertExactM1Roles(roles);
  return {
    schemaVersion: M1_FIXED_STATION_ADAPTER_SCHEMA_VERSION,
    compatibilityMode: 'M1_FIXED_STATIONS',
    staticFallback: true,
    fallbackReason,
    stations: OFFICE_STATIONS.map((station) => ({ ...station })),
    scene: initializeScene(roles),
    precedence: { ...SCENE_PRECEDENCE },
    transientSequences: TRANSIENT_SEQUENCES,
    mobileStationsPerPage: M1_MOBILE_STATIONS_PER_PAGE,
    maxConcurrentCues: M1_MAX_CONCURRENT_CUES,
    inventedProjectHistory: null,
  };
}

export function selectSpatialOfficeCompatibilityView(
  candidate: unknown,
  m1Roles: readonly RoleSceneProjection[],
): SpatialOfficeCompatibilityView {
  if (candidate === null || candidate === undefined) {
    return adaptM1FixedStations(m1Roles, 'SPATIAL_PROJECTION_ABSENT');
  }
  let schemaVersion: unknown;
  try {
    schemaVersion = typeof candidate === 'object' && !Array.isArray(candidate)
      ? (candidate as { readonly schemaVersion?: unknown }).schemaVersion
      : undefined;
  } catch {
    return adaptM1FixedStations(m1Roles, 'INVALID_SPATIAL_PROJECTION');
  }
  if (schemaVersion !== SPATIAL_OFFICE_SCHEMA_VERSION) {
    return adaptM1FixedStations(m1Roles, 'UNSUPPORTED_SPATIAL_VERSION');
  }
  try {
    return parseSpatialOfficeProjection(candidate);
  } catch {
    return adaptM1FixedStations(m1Roles, 'INVALID_SPATIAL_PROJECTION');
  }
}

function assertExactM1Roles(roles: readonly RoleSceneProjection[]): void {
  if (roles.length !== OFFICE_STATION_IDS.length) {
    throw new TypeError('M1 adapter requires exactly eight role projections');
  }
  roles.forEach((role, index) => {
    const station = OFFICE_STATIONS[index];
    if (
      role.stationId !== station?.id
      || role.actorRole !== station.actorRole
    ) {
      throw new TypeError('M1 adapter role order or canonical station meaning is invalid');
    }
  });
}
