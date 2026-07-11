// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PwaRuntimeController } from '../../src/pwa/registration.js';
import { RuntimeBoundary } from '../../src/ui/pwa/runtime-boundary.js';

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('visible private/offline/PWA runtime boundary', () => {
  it('shows loopback, read-only, auth-blocked, delivery fallback, and offline safety', async () => {
    const controller = new PwaRuntimeController();
    render(<RuntimeBoundary controller={controller} />);
    for (const label of [
      'LOOPBACK_PRIVATE',
      'READ_ONLY',
      'AUTH_BLOCKED',
      'MANUAL_FALLBACK_REQUIRED',
      'SW: UNSUPPORTED',
    ]) {
      expect(screen.getByText(label)).not.toBeNull();
    }
    fireEvent(window, new Event('offline'));
    await vi.waitFor(() => expect(screen.getByText('OFFLINE_READ_ONLY')).not.toBeNull());
    expect(screen.getByRole('status').textContent).toContain('Mutations and background queueing are disabled');
    expect(screen.getByText('PWA recovery')).not.toBeNull();
  });

  it('exposes a user-initiated install action only after an install prompt', async () => {
    const controller = new PwaRuntimeController();
    const prompt = vi.fn<() => Promise<void>>(() => Promise.resolve());
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.defineProperties(event, {
      prompt: { value: prompt },
      userChoice: { value: Promise.resolve({ outcome: 'dismissed' }) },
    });
    render(<RuntimeBoundary controller={controller} />);
    expect(screen.queryByRole('button', { name: /Install/u })).toBeNull();
    fireEvent(window, event);
    const install = await screen.findByRole('button', { name: /Install/u });
    fireEvent.click(install);
    await vi.waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: /Install/u })).toBeNull());
  });

  it('shows a waiting worker update and activates it only after the user clicks', async () => {
    const postMessage = vi.fn();
    const serviceWorker = new EventTarget() as EventTarget & {
      controller: object;
      register: () => Promise<ServiceWorkerRegistration>;
    };
    const registration = new EventTarget() as ServiceWorkerRegistration;
    Object.defineProperties(registration, {
      waiting: { value: { postMessage } },
      installing: { value: null },
    });
    serviceWorker.controller = {};
    serviceWorker.register = () => Promise.resolve(registration);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: serviceWorker,
    });
    const controller = new PwaRuntimeController();
    render(<RuntimeBoundary controller={controller} />);
    const update = await screen.findByRole('button', { name: /Update available/u });
    expect(postMessage).not.toHaveBeenCalled();
    fireEvent.click(update);
    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });
});
