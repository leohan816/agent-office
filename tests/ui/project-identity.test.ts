import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  FALLBACK_PROJECT_PALETTES,
  FIXED_PROJECT_PALETTES,
  PROJECT_EDGE_STYLES,
  PROJECT_GLYPHS,
  PROJECT_IDENTITY_CATALOG_VERSION,
  PROJECT_PATTERNS,
  contrastRatio,
  deriveProjectShortLabel,
  resolveProjectIdentity,
  resolveVisibleProjectIdentities,
  sha256HexUtf8,
} from '../../src/ui/spatial/project-identity.js';

describe('AO12-B deterministic project identity', () => {
  it('pins the exact current palette families and canonical SIASIU output', () => {
    expect(Object.fromEntries(Object.entries(FIXED_PROJECT_PALETTES)
      .map(([projectId, value]) => [projectId, value.family]))).toEqual({
      cosmile: 'coral/pink',
      siasiu: 'mint/emerald',
      foundation: 'navy/blue',
      vibenews: 'purple',
      'agent-office': 'orange/amber',
      control: 'slate/charcoal with blue accent',
    });
    expect(resolveProjectIdentity('siasiu', 'SIASIU')).toMatchObject({
      schemaVersion: PROJECT_IDENTITY_CATALOG_VERSION,
      catalogEntryId: 'fixed.siasiu',
      displayName: 'SIASIU',
      fixed: true,
    });
  });

  it('implements catalog-v1 SHA-256 fallback exactly and independently of registration order', () => {
    expect(sha256HexUtf8('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const identity = resolveProjectIdentity('future-project-zeta', 'Future Project Zeta');
    const digest = sha256HexUtf8('future-project-zeta');
    const bytes = [...digest.matchAll(/../gu)].map((match) => Number.parseInt(match[0], 16));
    expect(identity.fallbackSlots).toEqual({
      hueSlot: (bytes[0] ?? -1) % FALLBACK_PROJECT_PALETTES.length,
      patternSlot: (bytes[1] ?? -1) % PROJECT_PATTERNS.length,
      glyphSlot: (bytes[2] ?? -1) % PROJECT_GLYPHS.length,
      edgeSlot: (bytes[3] ?? -1) % PROJECT_EDGE_STYLES.length,
    });
    expect(identity.collisionMarker).toBe(digest.slice(0, 8));

    const projects = [
      { projectId: 'future-project-zeta', displayName: 'Future Project Zeta' },
      { projectId: 'future-project-eta', displayName: 'Future Project Eta' },
    ] as const;
    const forward = resolveVisibleProjectIdentities(projects);
    const reverse = resolveVisibleProjectIdentities([...projects].reverse());
    expect(new Map(forward.map((item) => [item.projectId, item.catalogEntryId])))
      .toEqual(new Map(reverse.map((item) => [item.projectId, item.catalogEntryId])));
  });

  it('normalizes project IDs to NFC and derives Unicode grapheme short labels', () => {
    const decomposed = resolveProjectIdentity('Cafe\u0301', 'Cafe\u0301 Project');
    const composed = resolveProjectIdentity('Caf\u00e9', 'Caf\u00e9 Project');
    expect(decomposed.fallbackSlots).toEqual(composed.fallbackSlots);
    expect(decomposed.collisionMarker).toBe(composed.collisionMarker);
    expect(deriveProjectShortLabel('Agent Office', 'agent-office')).toBe('AO');
    expect(deriveProjectShortLabel('\ud55c\uae00', 'fallback')).toBe('\ud55c\uae00');
  });

  it('retains full text and adds stable markers for short-label and exact-tuple collisions', () => {
    const sameShortLabel = resolveVisibleProjectIdentities([
      { projectId: 'future-alpha', displayName: 'Future Alpha' },
      { projectId: 'future-amber', displayName: 'Future Amber' },
    ]);
    for (const identity of sameShortLabel) {
      expect(identity.collisionNote).toBe('PROJECT_IDENTITY_COLLISION');
      expect(identity.condensedLabel).toBe(`${identity.shortLabel}-${identity.collisionMarker}`);
      expect(identity.displayName.length).toBeGreaterThan(0);
      expect(identity.projectId.length).toBeGreaterThan(0);
    }

    const byTuple = new Map<string, ReturnType<typeof resolveProjectIdentity>>();
    let collision: readonly ReturnType<typeof resolveProjectIdentity>[] | undefined;
    for (let index = 0; index < 2000 && collision === undefined; index += 1) {
      const candidate = resolveProjectIdentity(`catalog-collision-${index}`, `Catalog ${index}`);
      const key = [candidate.palette.paletteId, candidate.pattern, candidate.glyph, candidate.edge].join('|');
      const previous = byTuple.get(key);
      if (previous === undefined) byTuple.set(key, candidate);
      else collision = [previous, candidate];
    }
    expect(collision).toBeDefined();
    expect(collision?.[0]?.collisionMarker).not.toBe(collision?.[1]?.collisionMarker);
  });

  it('measures compliant light, dark, monochrome, focus, and operational override contrast', () => {
    for (const palette of [...Object.values(FIXED_PROJECT_PALETTES), ...FALLBACK_PROJECT_PALETTES]) {
      expect(contrastRatio(palette.darkText, palette.darkSurface), `${palette.paletteId} dark text`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.lightText, palette.lightSurface), `${palette.paletteId} light text`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.monochromeText, palette.monochromeSurface), `${palette.paletteId} monochrome`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.accent, palette.darkSurface), `${palette.paletteId} essential graphic`).toBeGreaterThanOrEqual(3);
    }
    expect(contrastRatio('#75baff', '#0b0f14')).toBeGreaterThanOrEqual(3);
    expect(contrastRatio('#ff8f93', '#3a191d')).toBeGreaterThanOrEqual(3);
    expect(contrastRatio('#f1c56d', '#352a13')).toBeGreaterThanOrEqual(3);
    expect(contrastRatio('#b7a9d8', '#29223b')).toBeGreaterThanOrEqual(3);
  });

  it('pins pattern, glyph, edge, forced-color, and severity-precedence CSS without motion or storage', async () => {
    expect(PROJECT_PATTERNS).toEqual(['solid', 'diagonal', 'crosshatch', 'dots', 'horizontal', 'stepped']);
    expect(PROJECT_GLYPHS).toHaveLength(8);
    expect(PROJECT_EDGE_STYLES).toEqual(['solid', 'double', 'dashed', 'dot-dash']);
    const css = await readFile(path.resolve(import.meta.dirname, '../../src/ui/spatial/project-identity.css'), 'utf8');
    const source = await readFile(path.resolve(import.meta.dirname, '../../src/ui/spatial/project-identity.ts'), 'utf8');
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('[data-severity="CRITICAL"]');
    expect(css).toContain('[data-freshness="STALE"]');
    expect(css).toContain('[data-authority="CONFLICT"]');
    expect(css).toContain('outline-color: var(--focus)');
    expect(`${css}\n${source}`).not.toMatch(/@keyframes|\banimation\s*:|\btransition\s*:|localStorage|sessionStorage/iu);
  });
});
