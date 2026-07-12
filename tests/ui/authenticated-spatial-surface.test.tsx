// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Dashboard } from '../../src/ui/dashboard.js';
import { CURRENT_DASHBOARD_VIEW_MODEL } from '../../src/ui/fixtures/dashboard.js';
import { projectAuthenticatedSpatialCues } from '../../src/ui/spatial/compatibility.js';
import {
  createSpatialCueReducerState,
  reduceSpatialCues,
} from '../../src/ui/spatial/cue-reducer.js';
import { authenticatedSpatialPresentationFixture } from '../helpers/authenticated-spatial.js';

afterEach(cleanup);

beforeEach(() => {
  installMatchMedia(false);
});

describe('AO12-IWU-12 authenticated spatial application surface', () => {
  it('replaces the M1 scene only on a validated authenticated spatial selection', () => {
    const presentation = authenticatedSpatialPresentationFixture();
    const cueState = liveCueState(presentation);
    const { container } = render(
      <Dashboard
        authenticatedSpatial={{
          projection: presentation.projection,
          cueState,
          requestedTier: 'FULL',
          selectionReason: 'SPATIAL_FULL_SELECTED',
        }}
        model={CURRENT_DASHBOARD_VIEW_MODEL}
        showOfficeScene
      />,
    );
    expect(container.querySelector('#office-scene')).toBeNull();
    const spatialOffice = container.querySelector('#spatial-office');
    expect(spatialOffice?.getAttribute('data-fixture-kind')).toBe('AUTHENTICATED_APPLICATION_PROJECTION');
    expect(spatialOffice?.getAttribute('data-motion-tier')).toBe('FULL');
    expect(spatialOffice?.getAttribute('data-selection-reason')).toBe('SPATIAL_FULL_SELECTED');
    expect(screen.getByRole('heading', { name: 'Authenticated spatial office' })).not.toBeNull();
    expect(container.querySelector('[data-cue-kind="WORKING"]')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Actor and zone state list' })).not.toBeNull();
    expect(screen.queryByText(/Synthetic test\/demo only/u)).toBeNull();
  });

  it('keeps equivalent semantic facts and zero route motion under reduced motion', () => {
    installMatchMedia(true);
    const presentation = authenticatedSpatialPresentationFixture();
    const { container } = render(
      <Dashboard
        authenticatedSpatial={{
          projection: presentation.projection,
          cueState: liveCueState(presentation),
          requestedTier: 'FULL',
          selectionReason: 'SPATIAL_STATIC_REDUCED_MOTION',
        }}
        model={CURRENT_DASHBOARD_VIEW_MODEL}
      />,
    );
    expect(container.querySelector('#spatial-office')?.getAttribute('data-motion-tier')).toBe('STATIC');
    expect(container.querySelector('[data-motion-cue]')).toBeNull();
    expect(screen.getAllByText(/WORKING \/ VERIFIED \/ CURRENT \/ CONNECTED/u).length).toBeGreaterThan(0);
  });
});

function liveCueState(presentation: ReturnType<typeof authenticatedSpatialPresentationFixture>) {
  const initial = reduceSpatialCues(createSpatialCueReducerState(), {
    origin: 'INITIAL_SNAPSHOT',
    projectionRevision: presentation.projection.projectionRevision - 1,
    projectionFingerprint: 'authenticated-spatial-before-live',
    selectedPodId: presentation.projection.selectedPodId,
    fullSnapshotVerified: true,
    results: [],
  });
  return reduceSpatialCues(initial, {
    origin: 'LIVE_DELTA',
    projectionRevision: presentation.projection.projectionRevision,
    projectionFingerprint: 'authenticated-spatial-live',
    selectedPodId: presentation.projection.selectedPodId,
    fullSnapshotVerified: false,
    results: projectAuthenticatedSpatialCues({
      presentation,
      previousAppliedRevision: initial.appliedRevision,
      updateOrigin: 'LIVE_DELTA',
    }),
  });
}

function installMatchMedia(reducedMotion: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' ? reducedMotion : false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => true,
    }),
  });
}
