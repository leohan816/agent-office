import { describe, expect, it } from 'vitest';

import { createSpatialOfficeFixtureInput } from '../../src/application/spatial-office/fixtures.js';
import {
  adaptM1FixedStations,
  M1_MAX_CONCURRENT_CUES,
  M1_MOBILE_STATIONS_PER_PAGE,
  selectSpatialOfficeCompatibilityView,
} from '../../src/application/spatial-office/m1-fixed-station-adapter.js';
import { projectSpatialOffice } from '../../src/application/spatial-office/projector.js';
import { SCENE_PRECEDENCE, TRANSIENT_SEQUENCES } from '../../src/ui/scene/state-machine.js';
import {
  OFFICE_STATIONS,
  type RoleSceneProjection,
} from '../../src/ui/scene/types.js';

describe('AO12-IWU-02 M1 fixed-station compatibility adapter', () => {
  it('preserves exact station order, coordinates, state precedence, routes, and limits', () => {
    const view = adaptM1FixedStations(m1Roles());
    expect(view.compatibilityMode).toBe('M1_FIXED_STATIONS');
    expect(view.staticFallback).toBe(true);
    expect(view.stations).toEqual(OFFICE_STATIONS);
    expect(view.stations.map(({ id, column, row }) => [id, column, row])).toEqual([
      ['leo', 0, 0],
      ['advisor', 1, 0],
      ['control', 2, 0],
      ['fable5', 3, 0],
      ['foundation', 0, 1],
      ['siasiu', 1, 1],
      ['cosmile', 2, 1],
      ['agent-office', 3, 1],
    ]);
    expect(view.precedence).toEqual(SCENE_PRECEDENCE);
    expect(view.transientSequences).toBe(TRANSIENT_SEQUENCES);
    expect(view.mobileStationsPerPage).toBe(M1_MOBILE_STATIONS_PER_PAGE);
    expect(view.mobileStationsPerPage).toBe(2);
    expect(view.maxConcurrentCues).toBe(M1_MAX_CONCURRENT_CUES);
    expect(view.maxConcurrentCues).toBe(3);
    expect(view.scene.pendingCues).toEqual([]);
    expect(view.inventedProjectHistory).toBeNull();
  });

  it('retains valid v1 spatial data and falls back statically for absent, unknown, or invalid data', () => {
    const roles = m1Roles();
    const projection = projectSpatialOffice(createSpatialOfficeFixtureInput());
    expect(selectSpatialOfficeCompatibilityView(projection, roles)).toBe(projection);
    expect(selectSpatialOfficeCompatibilityView(null, roles)).toMatchObject({
      compatibilityMode: 'M1_FIXED_STATIONS',
      fallbackReason: 'SPATIAL_PROJECTION_ABSENT',
    });
    expect(selectSpatialOfficeCompatibilityView({ schemaVersion: 'future.v9' }, roles)).toMatchObject({
      compatibilityMode: 'M1_FIXED_STATIONS',
      fallbackReason: 'UNSUPPORTED_SPATIAL_VERSION',
    });
    expect(selectSpatialOfficeCompatibilityView({
      schemaVersion: 'agent-office.spatial-office-projection.v1',
    }, roles)).toMatchObject({
      compatibilityMode: 'M1_FIXED_STATIONS',
      fallbackReason: 'INVALID_SPATIAL_PROJECTION',
    });
  });

  it('rejects a missing, reordered, or relabelled canonical M1 station role', () => {
    const roles = m1Roles();
    const first = roles[0];
    const second = roles[1];
    if (first === undefined || second === undefined) throw new Error('M1 role fixture missing');
    expect(() => adaptM1FixedStations(roles.slice(1))).toThrow(/exactly eight/u);
    expect(() => adaptM1FixedStations([second, first, ...roles.slice(2)])).toThrow(
      /order or canonical station meaning/u,
    );
    expect(() => adaptM1FixedStations(roles.map((role) =>
      role.stationId === 'siasiu' ? { ...role, actorRole: 'Worker' } : role))).toThrow(
      /order or canonical station meaning/u,
    );
  });
});

function m1Roles(): readonly RoleSceneProjection[] {
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
