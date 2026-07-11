import { useSyncExternalStore } from 'react';

export type ServiceWorkerStatus =
  | 'UNSUPPORTED'
  | 'REGISTERING'
  | 'READY'
  | 'UPDATE_AVAILABLE'
  | 'RECOVERY_REQUIRED';

export interface PwaRuntimeState {
  readonly online: boolean;
  readonly serviceWorkerStatus: ServiceWorkerStatus;
  readonly installAvailable: boolean;
}

interface InstallPromptEvent extends Event {
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
  prompt(): Promise<void>;
}

const SERVER_SNAPSHOT: PwaRuntimeState = {
  online: true,
  serviceWorkerStatus: 'UNSUPPORTED',
  installAvailable: false,
};

export class PwaRuntimeController {
  private state: PwaRuntimeState = {
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    serviceWorkerStatus: 'UNSUPPORTED',
    installAvailable: false,
  };
  private readonly listeners = new Set<() => void>();
  private registration?: ServiceWorkerRegistration;
  private installPrompt: InstallPromptEvent | undefined;
  private started = false;
  private updateActivationRequested = false;

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public getSnapshot = (): PwaRuntimeState => this.state;

  public getServerSnapshot = (): PwaRuntimeState => SERVER_SNAPSHOT;

  public start(): void {
    if (this.started || typeof window === 'undefined' || typeof navigator === 'undefined') return;
    this.started = true;
    window.addEventListener('online', this.onOnline);
    window.addEventListener('offline', this.onOffline);
    window.addEventListener('beforeinstallprompt', this.onInstallPrompt);
    if (!('serviceWorker' in navigator)) return;
    this.update({ serviceWorkerStatus: 'REGISTERING' });
    navigator.serviceWorker.addEventListener('message', this.onServiceWorkerMessage);
    navigator.serviceWorker.addEventListener('controllerchange', this.onControllerChange);
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((registration) => {
      this.registration = registration;
      this.update({
        serviceWorkerStatus: registration.waiting === null ? 'READY' : 'UPDATE_AVAILABLE',
      });
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller !== null) {
            this.update({ serviceWorkerStatus: 'UPDATE_AVAILABLE' });
          }
        });
      });
    }).catch(() => {
      this.update({ serviceWorkerStatus: 'RECOVERY_REQUIRED' });
    });
  }

  public async requestInstall(): Promise<void> {
    const prompt = this.installPrompt;
    if (prompt === undefined) return;
    await prompt.prompt();
    await prompt.userChoice;
    this.installPrompt = undefined;
    this.update({ installAvailable: false });
  }

  public activateUpdate(): void {
    const waiting = this.registration?.waiting;
    if (waiting === undefined || waiting === null) return;
    this.updateActivationRequested = true;
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  public async recoverServiceWorker(): Promise<void> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if (typeof caches !== 'undefined') {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('agent-office-shell-'))
          .map((name) => caches.delete(name)),
      );
    }
    window.location.reload();
  }

  public stop(): void {
    if (!this.started || typeof window === 'undefined' || typeof navigator === 'undefined') return;
    this.started = false;
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('offline', this.onOffline);
    window.removeEventListener('beforeinstallprompt', this.onInstallPrompt);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('message', this.onServiceWorkerMessage);
      navigator.serviceWorker.removeEventListener('controllerchange', this.onControllerChange);
    }
  }

  private readonly onOnline = (): void => this.update({ online: true });
  private readonly onOffline = (): void => this.update({ online: false });

  private readonly onInstallPrompt = (event: Event): void => {
    event.preventDefault();
    this.installPrompt = event as InstallPromptEvent;
    this.update({ installAvailable: true });
  };

  private readonly onServiceWorkerMessage = (event: MessageEvent<unknown>): void => {
    if (
      typeof event.data === 'object' &&
      event.data !== null &&
      'type' in event.data &&
      event.data.type === 'UPDATE_AVAILABLE'
    ) {
      this.update({ serviceWorkerStatus: 'UPDATE_AVAILABLE' });
    }
  };

  private readonly onControllerChange = (): void => {
    if (!this.updateActivationRequested) return;
    this.updateActivationRequested = false;
    window.location.reload();
  };

  private update(change: Partial<PwaRuntimeState>): void {
    const next = { ...this.state, ...change };
    if (
      next.online === this.state.online &&
      next.serviceWorkerStatus === this.state.serviceWorkerStatus &&
      next.installAvailable === this.state.installAvailable
    ) {
      return;
    }
    this.state = next;
    for (const listener of this.listeners) listener();
  }
}

export const pwaRuntimeController = new PwaRuntimeController();

export function usePwaRuntimeState(
  controller: PwaRuntimeController = pwaRuntimeController,
): PwaRuntimeState {
  return useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot,
  );
}
