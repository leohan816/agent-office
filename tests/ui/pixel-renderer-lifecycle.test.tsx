// @vitest-environment jsdom

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { RendererResourceRegistry } from '../../src/ui/pixel/contracts.js';

describe('living pixel-office renderer lifecycle contract', () => {
  it('tracks symmetric StrictMode-safe resource acquisition and teardown', () => {
    const registry = new RendererResourceRegistry();
    for (const resource of [
      'canvases', 'tickers', 'resizeObservers', 'contextListeners', 'visibilityListeners',
    ] as const) registry.acquire(resource);
    expect(registry.snapshot()).toEqual({
      canvases: 1,
      tickers: 1,
      resizeObservers: 1,
      contextListeners: 1,
      visibilityListeners: 1,
    });
    for (const resource of [
      'canvases', 'tickers', 'resizeObservers', 'contextListeners', 'visibilityListeners',
    ] as const) registry.release(resource);
    expect(registry.snapshot()).toEqual({
      canvases: 0,
      tickers: 0,
      resizeObservers: 0,
      contextListeners: 0,
      visibilityListeners: 0,
    });
    registry.release('canvases');
    expect(registry.snapshot().canvases).toBe(0);
  });

  it('uses one private ticker and explicit context/resize/visibility cleanup in the shared host', async () => {
    const [boundary, host, clock, scene] = await Promise.all([
      readFile(path.resolve(import.meta.dirname, '../../src/ui/pixel/renderer-boundary.tsx'), 'utf8'),
      readFile(path.resolve(import.meta.dirname, '../../src/ui/pixel/pixel-render-host.tsx'), 'utf8'),
      readFile(path.resolve(import.meta.dirname, '../../src/ui/pixel/world-clock.tsx'), 'utf8'),
      readFile(path.resolve(import.meta.dirname, '../../src/ui/pixel/pixel-world-scene.tsx'), 'utf8'),
    ]);
    // Design §2.3 PR-2: ticker/context/resize/visibility lifecycle now lives in the shared host.
    expect(host).toContain('sharedTicker={false}');
    expect(host).toContain('new ResizeObserver');
    expect(host).toContain('observer.disconnect()');
    expect(host).toContain("removeEventListener('webglcontextlost'");
    expect(host).toContain("removeEventListener('visibilitychange'");
    expect(host).toContain('stopApplicationTicker(app)');
    expect(host).toContain('setApplication(null)');
    expect(host).toContain("setFallbackReason('RENDERER_CONTEXT_LOST')");
    // The prototype boundary delegates to the shared host (no duplicate lifecycle).
    expect(boundary).toContain("from './pixel-render-host.js'");
    expect(boundary).toContain('<PixelRenderHost');
    expect(clock.match(/usePixelTick\(/gu)).toHaveLength(1);
    expect(scene).not.toMatch(/setInterval|Date\.now|Math\.random/gu);
  });
});
