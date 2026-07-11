import { Download, RefreshCcw, Shield, Wifi, WifiOff, Wrench } from 'lucide-react';
import { useEffect } from 'react';

import {
  pwaRuntimeController,
  type PwaRuntimeController,
  usePwaRuntimeState,
} from '../../pwa/registration.js';

export interface RuntimeBoundaryProps {
  readonly controller?: PwaRuntimeController;
  readonly authState?: 'AUTH_BLOCKED' | 'LOGIN_REQUIRED' | 'LOCAL_BOOTSTRAP_AUTHENTICATED' | 'TEST_AUTHENTICATED';
  readonly mutationState?: 'READ_ONLY' | 'LOCAL_BOOTSTRAP_ENABLED' | 'TEST_MUTATION_ENABLED';
  readonly deliveryState?: 'MANUAL_FALLBACK_REQUIRED' | 'DISABLED' | 'READY';
  readonly onLogout?: () => Promise<void>;
}

export function RuntimeBoundary({
  controller = pwaRuntimeController,
  authState = 'AUTH_BLOCKED',
  mutationState = 'READ_ONLY',
  deliveryState = 'MANUAL_FALLBACK_REQUIRED',
  onLogout,
}: RuntimeBoundaryProps) {
  const pwa = usePwaRuntimeState(controller);
  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);
  return (
    <section className="runtime-boundary" aria-label="Private runtime boundary">
      <div className="runtime-boundary-states">
        <span className="runtime-state runtime-state-private">
          <Shield aria-hidden="true" size={16} /> LOOPBACK_PRIVATE
        </span>
        <span className="runtime-state">{mutationState}</span>
        <span className="runtime-state">{authState}</span>
        <span className="runtime-state runtime-state-warning">{deliveryState}</span>
        <span className={`runtime-state ${pwa.online ? 'runtime-state-online' : 'runtime-state-offline'}`}>
          {pwa.online ? <Wifi aria-hidden="true" size={16} /> : <WifiOff aria-hidden="true" size={16} />}
          {pwa.online ? 'ONLINE' : 'OFFLINE_READ_ONLY'}
        </span>
        <span className="runtime-state">SW: {pwa.serviceWorkerStatus}</span>
      </div>
      <div className="runtime-boundary-actions">
        {onLogout === undefined ? null : (
          <button type="button" onClick={() => void onLogout()}>
            Logout
          </button>
        )}
        {pwa.installAvailable ? (
          <button type="button" onClick={() => void controller.requestInstall()}>
            <Download aria-hidden="true" size={16} /> Install
          </button>
        ) : null}
        {pwa.serviceWorkerStatus === 'UPDATE_AVAILABLE' ? (
          <button type="button" onClick={() => controller.activateUpdate()}>
            <RefreshCcw aria-hidden="true" size={16} /> Update available
          </button>
        ) : null}
        <details className="service-worker-recovery">
          <summary><Wrench aria-hidden="true" size={16} /> PWA recovery</summary>
          <p>Unregister the static shell worker and reload. Server data is not deleted.</p>
          <button type="button" onClick={() => void controller.recoverServiceWorker()}>
            Unregister and reload
          </button>
        </details>
      </div>
      {!pwa.online ? (
        <p className="runtime-offline-warning" role="status">
          Offline shell: last verified projection only. Mutations and background queueing are disabled.
        </p>
      ) : null}
    </section>
  );
}
