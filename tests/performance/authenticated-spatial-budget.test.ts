// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { parseAuthenticatedSpatialPresentation } from '../../src/application/spatial-office/authenticated-projection.js';
import {
  authenticatedSpatialFingerprint,
  projectAuthenticatedSpatialCues,
  selectAuthenticatedSpatialPresentation,
} from '../../src/ui/spatial/compatibility.js';
import { createSpatialCueReducerState, reduceSpatialCues } from '../../src/ui/spatial/cue-reducer.js';
import {
  authenticatedSpatialPresentationFixture,
  m1SceneRolesFixture,
} from '../helpers/authenticated-spatial.js';

describe('AO12-D authenticated spatial performance budget', () => {
  it('keeps parse, select, cue projection, and reducer p95 within 8ms', () => {
    const fixture = authenticatedSpatialPresentationFixture();
    const samples: number[] = [];
    let allSelectionsFull = true;
    for (let index = 0; index < 1_000; index += 1) {
      const startedAt = performance.now();
      const presentation = parseAuthenticatedSpatialPresentation(fixture);
      const selection = selectAuthenticatedSpatialPresentation({
        candidate: presentation,
        sceneRoles: m1SceneRolesFixture(),
      });
      const results = projectAuthenticatedSpatialCues({
        presentation,
        previousAppliedRevision: 12,
        updateOrigin: 'LIVE_DELTA',
      });
      reduceSpatialCues(createSpatialCueReducerState(), {
        origin: 'LIVE_DELTA',
        projectionRevision: 13,
        projectionFingerprint: authenticatedSpatialFingerprint(presentation),
        selectedPodId: presentation.projection.selectedPodId,
        fullSnapshotVerified: false,
        results,
      });
      allSelectionsFull &&= selection.mode === 'FULL';
      samples.push(performance.now() - startedAt);
    }
    samples.sort((left, right) => left - right);
    const p95 = samples[Math.floor(samples.length * 0.95)] ?? Number.POSITIVE_INFINITY;
    expect(allSelectionsFull).toBe(true);
    expect(p95).toBeLessThanOrEqual(8);
    if (process.env.AO12_D_REPORT_METRICS === '1') {
      process.stdout.write(`AO12_D_AUTHENTICATED_REDUCER_P95_MS=${p95.toFixed(3)}\n`);
    }
  });
});
