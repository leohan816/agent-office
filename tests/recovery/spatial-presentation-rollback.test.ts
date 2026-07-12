import { describe, expect, it } from 'vitest';

import { OFFICE_STATIONS } from '../../src/ui/scene/types.js';
import { selectAuthenticatedSpatialPresentation } from '../../src/ui/spatial/compatibility.js';
import {
  authenticatedSpatialPresentationFixture,
  m1SceneRolesFixture,
} from '../helpers/authenticated-spatial.js';

describe('AO12-IWU-13 presentation-only rollback', () => {
  it('returns to exact M1 fixed stations for absent, unknown, or invalid spatial data', () => {
    const roles = m1SceneRolesFixture();
    for (const candidate of [
      undefined,
      { schemaVersion: 'agent-office.authenticated-spatial-presentation.v9' },
      { schemaVersion: 'agent-office.authenticated-spatial-presentation.v1', projection: null, cueSlices: [] },
    ]) {
      const selection = selectAuthenticatedSpatialPresentation({ candidate, sceneRoles: roles });
      expect(selection.mode).toBe('M1_FIXED_STATIONS');
      expect(selection.m1View?.stations).toEqual(OFFICE_STATIONS);
      expect(selection.m1View?.scene.pendingCues).toEqual([]);
      expect(selection.m1View?.inventedProjectHistory).toBeNull();
    }
  });

  it('lowers only presentation tier on a performance miss without mutating source truth', () => {
    const candidate = authenticatedSpatialPresentationFixture();
    const before = JSON.stringify(candidate);
    const selection = selectAuthenticatedSpatialPresentation({
      candidate,
      sceneRoles: m1SceneRolesFixture(),
      requestedTier: 'RESTRAINED',
    });
    expect(selection).toMatchObject({
      mode: 'RESTRAINED',
      reasonCode: 'SPATIAL_RESTRAINED_SELECTED',
    });
    expect(JSON.stringify(candidate)).toBe(before);
  });
});
