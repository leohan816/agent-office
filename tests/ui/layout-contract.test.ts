import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SCENE_ASSET_REGISTRY, SCENE_ASSET_SOURCE } from '../../src/ui/scene/asset-registry.js';

describe('responsive dashboard layout contract', () => {
  it('pins overflow, minimum-width, table scroller, and responsive scene pagination', async () => {
    const css = await readFile(path.resolve(import.meta.dirname, '../../src/ui/styles.css'), 'utf8');
    const [baseCss, sceneCss] = css.split('/* Batch C structured-event office scene */');
    expect(css).toContain('min-width: 320px');
    expect(css).toContain('min-width: 0');
    expect(css).toContain('overflow-wrap: anywhere');
    expect(css).toContain('overflow-x: auto');
    expect(css).toContain('@media (max-width: 767px)');
    expect(css).toContain('@media (max-width: 420px)');
    expect(baseCss).not.toMatch(/\banimation(?:-name)?\s*:/u);
    expect(baseCss).not.toMatch(/\btransition\s*:/u);
    expect(sceneCss).toContain('aspect-ratio: 16 / 6');
    expect(sceneCss).toContain('.scene-mobile-pagination');
    expect(sceneCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(sceneCss).toContain('animation-play-state: paused');
    expect(sceneCss).not.toMatch(/\btransition\s*:/u);
    expect(sceneCss).not.toMatch(/letter-spacing:\s*-/u);
  });

  it('has no service worker, remote asset, marketing hero, or nested-card component', async () => {
    const dashboard = await readFile(path.resolve(import.meta.dirname, '../../src/ui/dashboard.tsx'), 'utf8');
    const html = await readFile(path.resolve(import.meta.dirname, '../../index.html'), 'utf8');
    expect(`${dashboard}\n${html}`).not.toMatch(/serviceWorker|https?:\/\/|marketing|hero|decorative|blob/iu);
    expect(dashboard).not.toMatch(/className="card[^\n]*<[^\n]*className="card/u);
  });

  it('uses only transform and opacity inside bounded scene keyframes', async () => {
    const css = await readFile(path.resolve(import.meta.dirname, '../../src/ui/styles.css'), 'utf8');
    const keyframes = [...css.matchAll(/@keyframes\s+[^{]+\{([\s\S]*?)\n\}/gu)].map((match) => match[1] ?? '');
    expect(keyframes.length).toBeGreaterThanOrEqual(10);
    for (const body of keyframes) {
      expect(body).not.toMatch(/(?:^|[;{]\s*)(?:top|left|right|bottom|width|height|margin|padding)\s*:/mu);
    }
    const durations = [...css.matchAll(/animation:\s+[^;]*?\s(\d+)ms\b/gu)].map((match) => Number(match[1]));
    expect(durations.length).toBeGreaterThan(0);
    expect(Math.max(...durations)).toBeLessThanOrEqual(1200);
  });

  it('pins code-native scene asset dimensions, ownership, license, and source hash', async () => {
    const source = await readFile(path.resolve(import.meta.dirname, '../../src/ui/scene/assets/scene-assets.tsx'));
    expect(createHash('sha256').update(source).digest('hex')).toBe(SCENE_ASSET_SOURCE.sha256);
    expect(SCENE_ASSET_SOURCE.owner).toBe('Agent Office project-authored');
    expect(SCENE_ASSET_SOURCE.license).toContain('no third-party material');
    expect(SCENE_ASSET_REGISTRY).toEqual({
      actor: { width: 96, height: 72, viewBox: '0 0 96 72' },
      desk: { width: 120, height: 48, viewBox: '0 0 120 48' },
      document: { width: 32, height: 40, viewBox: '0 0 32 40' },
      barrier: { width: 52, height: 40, viewBox: '0 0 52 40' },
      tool: { width: 44, height: 44, viewBox: '0 0 44 44' },
      warning: { width: 44, height: 40, viewBox: '0 0 44 40' },
    });
  });
});
