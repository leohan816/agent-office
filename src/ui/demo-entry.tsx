import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { COMMUNICATION_CENTER_FIXTURE } from './communication/fixtures.js';
import { Dashboard } from './dashboard.js';
import { CURRENT_DASHBOARD_VIEW_MODEL } from './fixtures/dashboard.js';
import { SpatialOffice } from './spatial/spatial-office.js';
import {
  MOTION_SPATIAL_OFFICE_FIXTURE,
  STATIC_SPATIAL_OFFICE_FIXTURE,
} from './spatial/fixtures.js';
import type { SpatialPresentationTier } from './spatial/actor-zone.js';

export const STATIC_SPATIAL_DEMO_PARAMETER = 'surface=spatial-static' as const;
export const MOTION_SPATIAL_DEMO_PARAMETER = 'surface=spatial-motion' as const;

export function mountSyntheticTestDemo(root: Element): void {
  const search = root.ownerDocument.defaultView?.location.search ?? '';
  createRoot(root).render(
    <StrictMode>
      {isMotionSpatialDemoRequest(search) ? (
        <SpatialOffice
          cueState={MOTION_SPATIAL_OFFICE_FIXTURE.cueState}
          fixtureKind={MOTION_SPATIAL_OFFICE_FIXTURE.fixtureKind}
          frozenMotionProgress={motionFreezeProgress(search)}
          projection={MOTION_SPATIAL_OFFICE_FIXTURE.projection}
          requestedTier={motionTier(search)}
          surfaceKind="SYNTHETIC"
          verifiedIdle={MOTION_SPATIAL_OFFICE_FIXTURE.verifiedIdle}
        />
      ) : isStaticSpatialDemoRequest(search) ? (
        <SpatialOffice
          fixtureKind={STATIC_SPATIAL_OFFICE_FIXTURE.fixtureKind}
          projection={STATIC_SPATIAL_OFFICE_FIXTURE.projection}
          surfaceKind="SYNTHETIC"
        />
      ) : (
        <Dashboard
          model={CURRENT_DASHBOARD_VIEW_MODEL}
          communicationModel={COMMUNICATION_CENTER_FIXTURE}
        />
      )}
    </StrictMode>,
  );
}

export function isStaticSpatialDemoRequest(search: string): boolean {
  return new URLSearchParams(search).get('surface') === 'spatial-static';
}

export function isMotionSpatialDemoRequest(search: string): boolean {
  return new URLSearchParams(search).get('surface') === 'spatial-motion';
}

function motionTier(search: string): SpatialPresentationTier {
  const value = new URLSearchParams(search).get('tier');
  return value === 'restrained' ? 'RESTRAINED' : value === 'static' ? 'STATIC' : 'FULL';
}

function motionFreezeProgress(search: string): number | null {
  const value = new URLSearchParams(search).get('freeze');
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : null;
}
