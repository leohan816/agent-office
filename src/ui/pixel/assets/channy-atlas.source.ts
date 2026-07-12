import type { IndexedPixelAtlasSource, IndexedPixelFrameSource } from './atlas-builder.js';
import { LIVING_OFFICE_PALETTE } from './palette.js';

export const CHANNY_ANIMATION_SOURCE_SPECS = [
  ...directional('channy.walk', 6, 240),
  { animationId: 'channy.stop', frameCount: 1, durationMs: 1300 },
  { animationId: 'channy.sniff', frameCount: 3, durationMs: 450 },
  ...directional('channy.roam', 6, 240),
  ...directional('channy.sit', 3, 500),
  { animationId: 'channy.eat', frameCount: 4, durationMs: 320 },
  { animationId: 'channy.drink', frameCount: 4, durationMs: 320 },
  { animationId: 'channy.sleep', frameCount: 4, durationMs: 650 },
  { animationId: 'channy.play', frameCount: 6, durationMs: 280 },
  { animationId: 'channy.react-waiting-leo', frameCount: 3, durationMs: 350 },
  { animationId: 'channy.react-blocked', frameCount: 3, durationMs: 350 },
  { animationId: 'channy.react-complete', frameCount: 4, durationMs: 200 },
  { animationId: 'channy.react-stale-offline', frameCount: 1, durationMs: 0 },
] as const;

const palette = {
  '.': LIVING_OFFICE_PALETTE.transparent,
  I: LIVING_OFFICE_PALETTE.ink,
  D: LIVING_OFFICE_PALETTE.channy,
  S: LIVING_OFFICE_PALETTE.channyShadow,
  C: LIVING_OFFICE_PALETTE.cream,
} as const;

const baseRows = [
  '................................................',
  '................................................',
  '..................II............................',
  '................IICCI...........................',
  '...............ICCCCI..............III..........',
  '..........ISS.ICCCCCI............ICCCI..........',
  '.........ISCCIICCCCCII.........IICCCCI..........',
  '........ISCCCCCCCCCCCCIIIIIIIIICCCCCI...........',
  '........ISCCCCCCCCCCCCCCCCCCCCCCCCCCI...........',
  '.........ISCCCCCCCCCCCCCCCCCCCCCCCCCI...........',
  '..........ISCCCCCCCCCCCCCCCCCCCCCCCI............',
  '...........ISCCCCCCCCCCCCCCCCCCCCCI.............',
  '............ISCCCCCCCCCCCCCCCCCCCI..............',
  '.............ISSSSSSSSSSSSSSSSSSI...............',
  '..............IIIII.......IIIII.................',
  '..............I...I.......I...I.................',
  '..............I...I.......I...I.................',
  '.............II...II.....II...II................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
];

export const CHANNY_ATLAS_SOURCE: IndexedPixelAtlasSource = {
  atlasId: 'channy.v1',
  catalogVersion: '1',
  paletteId: 'agent-office.warm-retro.v1',
  palette,
  frames: CHANNY_ANIMATION_SOURCE_SPECS.flatMap((animation) =>
    Array.from({ length: animation.frameCount }, (_, index): IndexedPixelFrameSource => ({
      frameId: `${animation.animationId}.${index}`,
      width: 48,
      height: 40,
      rows: channyVariant(baseRows, index),
      pivotX: 24,
      pivotY: 36,
      anchorFootX: 24,
      anchorFootY: 36,
      durationMs: animation.durationMs,
      allowedMirrorX: animation.animationId.endsWith('.east') || animation.animationId.endsWith('.west'),
      semanticLayer: 'CHANNY_NON_ACTOR',
    }))),
};

function directional(prefix: string, frameCount: number, durationMs: number) {
  return ['north', 'south', 'east', 'west'].map((direction) => ({
    animationId: `${prefix}.${direction}`,
    frameCount,
    durationMs,
  }));
}

function channyVariant(rows: readonly string[], index: number): readonly string[] {
  if (index % 2 === 0) return rows;
  return rows.map((row, y) => y >= 14 && y <= 17 ? `.${row.slice(0, -1)}` : row);
}
