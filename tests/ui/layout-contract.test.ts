import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('responsive dashboard layout contract', () => {
  it('pins overflow, minimum-width, table scroller, and mobile rules without work animation', async () => {
    const css = await readFile(path.resolve(import.meta.dirname, '../../src/ui/styles.css'), 'utf8');
    expect(css).toContain('min-width: 320px');
    expect(css).toContain('min-width: 0');
    expect(css).toContain('overflow-wrap: anywhere');
    expect(css).toContain('overflow-x: auto');
    expect(css).toContain('@media (max-width: 767px)');
    expect(css).toContain('@media (max-width: 420px)');
    expect(css).not.toMatch(/\banimation(?:-name)?\s*:/u);
    expect(css).not.toMatch(/\btransition\s*:/u);
  });

  it('has no service worker, remote asset, marketing hero, or nested-card component', async () => {
    const dashboard = await readFile(path.resolve(import.meta.dirname, '../../src/ui/dashboard.tsx'), 'utf8');
    const html = await readFile(path.resolve(import.meta.dirname, '../../index.html'), 'utf8');
    expect(`${dashboard}\n${html}`).not.toMatch(/serviceWorker|https?:\/\/|marketing|hero|decorative|blob/iu);
    expect(dashboard).not.toMatch(/className="card[^\n]*<[^\n]*className="card/u);
  });
});
