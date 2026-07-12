import type { IndexedPixelAtlasSource, IndexedPixelFrameSource } from './atlas-builder.js';
import { LIVING_OFFICE_PALETTE } from './palette.js';

const palette = {
  '.': LIVING_OFFICE_PALETTE.transparent,
  I: LIVING_OFFICE_PALETTE.ink,
  A: LIVING_OFFICE_PALETTE.amber,
  B: LIVING_OFFICE_PALETTE.foundation,
  C: LIVING_OFFICE_PALETTE.coral,
  M: LIVING_OFFICE_PALETTE.mint,
  V: LIVING_OFFICE_PALETTE.vibe,
  S: LIVING_OFFICE_PALETTE.control,
} as const;

const projectKeys = [
  ['agent-office', 'A'],
  ['foundation', 'B'],
  ['cosmile', 'C'],
  ['siasiu', 'M'],
  ['vibenews', 'V'],
  ['control', 'S'],
] as const;

export const ACTOR_IDENTITY_ATLAS_SOURCE: IndexedPixelAtlasSource = {
  atlasId: 'actor-identity.v1',
  catalogVersion: '1',
  paletteId: 'agent-office.warm-retro.v1',
  palette,
  frames: projectKeys.map(([projectId, key], index): IndexedPixelFrameSource => ({
    frameId: `identity.${projectId}`,
    width: 32,
    height: 48,
    rows: identityRows(key, index),
    pivotX: 16,
    pivotY: 44,
    anchorFootX: 16,
    anchorFootY: 44,
    durationMs: 0,
    allowedMirrorX: false,
    semanticLayer: 'PROJECT_IDENTITY',
  })),
};

function identityRows(key: string, variant: number): readonly string[] {
  return Array.from({ length: 48 }, (_, y) => Array.from({ length: 32 }, (_, x) => {
    if (y < 9 || y > 22 || x < 7 || x > 24) return '.';
    if (x === 7 || x === 24 || y === 9 || y === 22) return 'I';
    const marked = variant % 3 === 0
      ? (x + y) % 4 === 0
      : variant % 3 === 1
        ? y % 4 < 2
        : (x - y + 32) % 5 < 2;
    return marked ? key : '.';
  }).join(''));
}
