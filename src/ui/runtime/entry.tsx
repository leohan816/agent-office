import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AgentOfficeRuntimeClient } from './client.js';
import { ProductionRuntimeApp } from './runtime-app.js';

export function mountProductionRuntime(root: Element): void {
  const client = new AgentOfficeRuntimeClient();
  createRoot(root).render(
    <StrictMode>
      <ProductionRuntimeApp client={client} />
    </StrictMode>,
  );
}
