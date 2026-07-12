import type { IndexedPixelAtlasSource, IndexedPixelFrameSource } from './atlas-builder.js';
import { LIVING_OFFICE_PALETTE } from './palette.js';

export interface PixelAnimationSourceSpec {
  readonly animationId: string;
  readonly frameCount: number;
  readonly durationMs: number;
}

export const ACTOR_ANIMATION_SOURCE_SPECS = [
  ...directional('actor.idle', 4, 250),
  ...directional('actor.walk', 6, 100),
  ...directional('actor.sit', 2, 400),
  ...directional('actor.type', 4, 120),
  ...directional('actor.review', 4, 160),
  ...directional('actor.carry-document', 6, 100),
  ...directional('actor.return-result', 6, 100),
  ...directional('actor.coffee', 4, 300),
  ...directional('actor.rest', 2, 500),
  ...directional('actor.lounge', 4, 300),
  ...['READING', 'TESTING', 'WRITING_RESULT', 'WAITING_DEPENDENCY', 'WAITING_LEO', 'BLOCKED', 'COMPLETED', 'FAILED', 'CANCELLED', 'RECOVERY'].map((state) => ({
    animationId: `actor.static.${state.toLowerCase().replaceAll('_', '-')}`,
    frameCount: 1,
    durationMs: 0,
  })),
] as const satisfies readonly PixelAnimationSourceSpec[];

const baseRows = [
  '................................',
  '...........IIIIIIII.............',
  '.........IICCCCCCCCI............',
  '........ICCCCCCCCCCCI...........',
  '........ICCIICCIICCI............',
  '........ICCCCCCCCCCCI...........',
  '.........ICCCCCCCCI.............',
  '..........IIIIIIII..............',
  '.........IWWWWWWWWI.............',
  '........IWWWWWWWWWWI............',
  '.......IWWWWWWWWWWWWI...........',
  '.......IWWWWWWWWWWWWI...........',
  '.......IWWWWWWWWWWWWI...........',
  '.......IWWWWWWWWWWWWI...........',
  '........IWWWWWWWWWWI............',
  '.........IWWWWWWWWI.............',
  '..........II....II..............',
  '.........III....III.............',
  '.........III....III.............',
  '.........III....III.............',
  '........IIII....IIII............',
  '........IIII....IIII............',
  '........IIII....IIII............',
  '.......IIIII....IIIII...........',
  '.......IIIII....IIIII...........',
  '.......IIIII....IIIII...........',
  '.......IIIII....IIIII...........',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
];

const palette = {
  '.': LIVING_OFFICE_PALETTE.transparent,
  I: LIVING_OFFICE_PALETTE.ink,
  C: LIVING_OFFICE_PALETTE.cream,
  W: LIVING_OFFICE_PALETTE.slate,
} as const;

export const ACTOR_BASE_ATLAS_SOURCE: IndexedPixelAtlasSource = {
  atlasId: 'actor-base.v1',
  catalogVersion: '1',
  paletteId: 'agent-office.warm-retro.v1',
  palette,
  frames: ACTOR_ANIMATION_SOURCE_SPECS.flatMap((animation) =>
    Array.from({ length: animation.frameCount }, (_, index): IndexedPixelFrameSource => ({
      frameId: `${animation.animationId}.${index}`,
      width: 32,
      height: 48,
      rows: actorVariant(baseRows, index),
      pivotX: 16,
      pivotY: 44,
      anchorFootX: 16,
      anchorFootY: 44,
      durationMs: animation.durationMs,
      allowedMirrorX: animation.animationId.endsWith('.east') || animation.animationId.endsWith('.west'),
      semanticLayer: 'ACTOR_BASE',
    }))),
};

function directional(prefix: string, frameCount: number, durationMs: number): readonly PixelAnimationSourceSpec[] {
  return ['north', 'south', 'east', 'west'].map((direction) => ({
    animationId: `${prefix}.${direction}`,
    frameCount,
    durationMs,
  }));
}

function actorVariant(rows: readonly string[], index: number): readonly string[] {
  if (index % 2 === 0) return rows;
  return rows.map((row, rowIndex) => rowIndex >= 16 && rowIndex <= 26
    ? `${row.slice(1)}.`
    : row);
}
