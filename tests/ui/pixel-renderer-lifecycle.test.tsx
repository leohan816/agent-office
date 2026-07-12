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

  it('uses one private ticker and explicit context/resize/visibility cleanup', async () => {
    const [boundary, clock, scene] = await Promise.all([
      readFile(path.resolve(import.meta.dirname, '../../src/ui/pixel/renderer-boundary.tsx'), 'utf8'),
      readFile(path.resolve(import.meta.dirname, '../../src/ui/pixel/world-clock.tsx'), 'utf8'),
      readFile(path.resolve(import.meta.dirname, '../../src/ui/pixel/pixel-world-scene.tsx'), 'utf8'),
    ]);
    expect(boundary).toContain('sharedTicker={false}');
    expect(boundary).toContain('new ResizeObserver');
    expect(boundary).toContain('observer.disconnect()');
    expect(boundary).toContain("removeEventListener('webglcontextlost'");
    expect(boundary).toContain("removeEventListener('visibilitychange'");
    expect(boundary).toContain('stopApplicationTicker(app)');
    expect(boundary).toContain('setApplication(null)');
    expect(boundary).toContain("setFallbackReason('RENDERER_CONTEXT_LOST')");
    expect(clock.match(/usePixelTick\(/gu)).toHaveLength(1);
    expect(scene).not.toMatch(/setInterval|Date\.now|Math\.random/gu);
  });
});
