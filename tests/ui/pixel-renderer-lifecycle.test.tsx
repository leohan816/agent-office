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

  it('publishes ready/backend only after a successful init and degrades a failed init to static (SIR-1)', async () => {
    const [host, chunk] = await Promise.all([
      readFile(path.resolve(import.meta.dirname, '../../src/ui/pixel/pixel-render-host.tsx'), 'utf8'),
      readFile(path.resolve(import.meta.dirname, '../../src/ui/pixel/production-pixel-office-chunk.tsx'), 'utf8'),
    ]);
    // Readiness/backend are gated on a completed onInit — never advertised before initialization.
    expect(host).toContain('setInitialized(true)');
    expect(host).toContain("initialized ? 'PIXEL_READY' : 'PIXEL_INITIALIZING'");
    expect(host).toMatch(/data-pixel-backend=\{effectiveStatic \? 'DOM_STATIC' : initialized \? backend : 'PENDING'\}/u);
    // A synchronous init error (boundary) and an unresolved async init (timeout) both fail closed to static.
    expect(host).toContain('RENDERER_INITIALIZATION_TIMEOUT');
    expect(host).toMatch(/onError=\{\(message\) => \{[\s\S]*setFallbackReason\(message\)[\s\S]*onBackend\('DOM_STATIC'\)/u);
    // CSP-safe Pixi is registered inside the sole production lazy chunk without weakening the CSP.
    expect(chunk).toContain("import 'pixi.js/unsafe-eval'");
  });

  it('never advertises a parent backend before init and uses production (not prototype/tour) copy (I2-1/I2-4)', async () => {
    const [scene, hud] = await Promise.all([
      readFile(path.resolve(import.meta.dirname, '../../src/ui/pixel/production-pixel-world-scene.tsx'), 'utf8'),
      readFile(path.resolve(import.meta.dirname, '../../src/ui/pixel/living-office-hud.tsx'), 'utf8'),
    ]);
    // I2-1: the parent starts PENDING (never WEBGL/CANVAS) until the child host reports a successful onInit.
    expect(scene).toContain("useState<PixelRendererBackend | 'PENDING'>(forceStatic ? 'DOM_STATIC' : 'PENDING')");
    expect(scene).toContain('surfaceKind="PRODUCTION"');
    // The shared HUD renders PENDING truthfully as INITIALIZING.
    expect(hud).toContain("backend === 'PENDING' ? 'INITIALIZING'");
    // I2-4: authenticated production wording, not the prototype/tour labels (which the prototype keeps).
    expect(hud).toContain("production ? 'Office renderer status' : 'Prototype status'");
    expect(hud).toContain("running ? 'CONTINUOUS AMBIENT' : 'STATIC OFFICE'");
    // I2-4: the parent commits a new frame only at a bounded meaningful Channy transition (no 30fps updates).
    expect(scene).toContain('if (next.channy.animation !== lastChannyStateRef.current)');
  });
});
