import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { COMMUNICATION_CENTER_FIXTURE } from './communication/fixtures.js';
import { Dashboard } from './dashboard.js';
import { CURRENT_DASHBOARD_VIEW_MODEL } from './fixtures/dashboard.js';
import { SpatialOffice } from './spatial/spatial-office.js';

export const STATIC_SPATIAL_DEMO_PARAMETER = 'surface=spatial-static' as const;

export function mountSyntheticTestDemo(root: Element): void {
  const search = root.ownerDocument.defaultView?.location.search ?? '';
  createRoot(root).render(
    <StrictMode>
      {isStaticSpatialDemoRequest(search) ? (
        <SpatialOffice />
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
