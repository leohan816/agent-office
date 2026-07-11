import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { COMMUNICATION_CENTER_FIXTURE } from './communication/fixtures.js';
import { Dashboard } from './dashboard.js';
import { CURRENT_DASHBOARD_VIEW_MODEL } from './fixtures/dashboard.js';

export function mountSyntheticTestDemo(root: Element): void {
  createRoot(root).render(
    <StrictMode>
      <Dashboard
        model={CURRENT_DASHBOARD_VIEW_MODEL}
        communicationModel={COMMUNICATION_CENTER_FIXTURE}
      />
    </StrictMode>,
  );
}
