import { useEffect, useMemo, useState } from 'react';

import { Dashboard } from '../dashboard.js';
import { RuntimeBoundary } from '../pwa/runtime-boundary.js';
import {
  AgentOfficeRuntimeClient,
  type RuntimeClientState,
} from './client.js';

export interface ProductionRuntimeAppProps {
  readonly client: AgentOfficeRuntimeClient;
}

export function ProductionRuntimeApp({ client }: ProductionRuntimeAppProps) {
  const [state, setState] = useState<RuntimeClientState>(() => client.snapshot());
  useEffect(() => {
    const unsubscribe = client.subscribe(setState);
    void client.start();
    return () => {
      unsubscribe();
      client.stop();
    };
  }, [client]);
  const actionPort = useMemo(() => client.communicationActionPort(), [client, state]);
  const runtimeBoundary = {
    authState: state.subject === undefined ? 'AUTH_BLOCKED' as const : 'TEST_AUTHENTICATED' as const,
    mutationState: actionPort === undefined ? 'READ_ONLY' as const : 'TEST_MUTATION_ENABLED' as const,
    deliveryState:
      state.status?.deliveryMode === 'ENABLED'
        ? 'READY' as const
        : state.status?.deliveryMode === 'DISABLED'
          ? 'DISABLED' as const
          : 'MANUAL_FALLBACK_REQUIRED' as const,
  };
  const projection = state.projection;
  if (projection?.dashboard !== undefined && projection.communication !== undefined) {
    return (
      <Dashboard
        model={projection.dashboard}
        communicationModel={projection.communication}
        {...(actionPort === undefined ? {} : { communicationActionPort: actionPort })}
        runtimeBoundary={runtimeBoundary}
        showOfficeScene={false}
      />
    );
  }
  return (
    <div className="app-shell production-runtime-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div>
            <p className="eyebrow">AGENT OFFICE / M01</p>
            <h1>Private runtime</h1>
          </div>
        </div>
        <div className="topbar-status" aria-label="Runtime status">
          <span className="status-token">APPLICATION RUNTIME</span>
          <span className="status-token">{state.phase}</span>
          <span className="status-token">SSE: {state.sseState}</span>
        </div>
      </header>
      <RuntimeBoundary {...runtimeBoundary} />
      <main className="runtime-fail-closed" aria-labelledby="runtime-fail-closed-heading">
        <p className="eyebrow">FAIL-CLOSED APPLICATION STATE</p>
        <h2 id="runtime-fail-closed-heading">
          {state.phase === 'AUTH_BLOCKED' ? 'AUTH_BLOCKED / READ_ONLY' : state.phase}
        </h2>
        <p>
          The built loopback shell is available, but the protected projection and Advisor
          mutations require an approved authenticated session.
        </p>
        <dl className="communication-metadata">
          <div><dt>NETWORK</dt><dd>LOOPBACK_PRIVATE</dd></div>
          <div><dt>STARTUP</dt><dd>{state.status?.startupState ?? 'STATUS_UNAVAILABLE'}</dd></div>
          <div><dt>MUTATION</dt><dd>{state.status?.mutationMode ?? 'DISABLED'}</dd></div>
          <div><dt>PROJECTION</dt><dd>{state.lastErrorCode ?? 'AUTHENTICATION_REQUIRED'}</dd></div>
          <div><dt>SSE</dt><dd>{state.sseState}</dd></div>
        </dl>
        <p>No synthetic fixture, localhost identity, NoAuth provider, or role-dispatch path is active.</p>
      </main>
    </div>
  );
}
