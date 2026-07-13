import type { ChannyAnimation } from './contracts.js';

export const PIXEL_PROTOTYPE_DURATION_MS = 26_000 as const;
export const PIXEL_FIXED_STEP_MS = 1000 / 30;
export const PIXEL_MAX_CATCH_UP_STEPS = 2 as const;

export interface PixelClockState {
  readonly logicalTimeMs: number;
  readonly accumulatorMs: number;
  readonly complete: boolean;
}

export interface PixelClockAdvance {
  readonly state: PixelClockState;
  readonly steps: readonly number[];
  readonly droppedWallTimeMs: number;
}

export function createPixelClockState(logicalTimeMs = 0): PixelClockState {
  const bounded = clampPrototypeTime(logicalTimeMs);
  return {
    logicalTimeMs: bounded,
    accumulatorMs: 0,
    complete: bounded >= PIXEL_PROTOTYPE_DURATION_MS,
  };
}

export function advancePixelClock(state: PixelClockState, wallDeltaMs: number): PixelClockAdvance {
  if (state.complete) return { state, steps: [], droppedWallTimeMs: Math.max(0, wallDeltaMs) };
  const safeDelta = Number.isFinite(wallDeltaMs) ? Math.max(0, wallDeltaMs) : 0;
  let accumulator = state.accumulatorMs + safeDelta;
  const availableSteps = Math.floor(accumulator / PIXEL_FIXED_STEP_MS);
  const stepCount = Math.min(PIXEL_MAX_CATCH_UP_STEPS, availableSteps);
  const droppedSteps = Math.max(0, availableSteps - stepCount);
  const droppedWallTimeMs = droppedSteps * PIXEL_FIXED_STEP_MS;
  accumulator -= (stepCount + droppedSteps) * PIXEL_FIXED_STEP_MS;
  const steps: number[] = [];
  let logicalTimeMs = state.logicalTimeMs;
  for (let index = 0; index < stepCount; index += 1) {
    logicalTimeMs = clampPrototypeTime(logicalTimeMs + PIXEL_FIXED_STEP_MS);
    steps.push(logicalTimeMs);
  }
  return {
    state: {
      logicalTimeMs,
      accumulatorMs: accumulator,
      complete: logicalTimeMs >= PIXEL_PROTOTYPE_DURATION_MS,
    },
    steps,
    droppedWallTimeMs,
  };
}

export function clampPrototypeTime(logicalTimeMs: number): number {
  if (!Number.isFinite(logicalTimeMs)) return 0;
  return Math.max(0, Math.min(PIXEL_PROTOTYPE_DURATION_MS, logicalTimeMs));
}

// ── SIR-5: fixture-free production ambient Channy clock. ──────────────────────────────────────────
// Drives the authenticated Living Office's ambient Bedlington through its eight presentation states
// purely from the monotonic logical time, with NO operational input. It reads no prototype timeline/
// scenario/projection fixture, no actor/mission/authority state, and produces no operational evidence,
// dispatch, recovery, or inference. Channy stays `authorityRole: none`; position/animation carry no
// assignment, delivery, review, or completion meaning. Every state falls inside the shared 0..26000ms
// clock window; the production scene restarts the clock at completion for continuous ambient motion.

export interface ChannyAmbientPose {
  readonly animation: ChannyAnimation;
  readonly fromAnchorId: string;
  readonly toAnchorId: string;
  /** Raw 0..1 position within the current segment; the projector applies easing + anchor interpolation. */
  readonly progress: number;
}

interface ChannyAmbientSegment {
  readonly animation: ChannyAnimation;
  readonly fromAnchorId: string;
  readonly toAnchorId: string;
  readonly durationMs: number;
}

// A calm looping routine covering every one of the eight states exactly. WALK segments move between
// two facility anchors; the rest rest at one. All eight states begin within the 0..26000ms window.
const CHANNY_AMBIENT_SEQUENCE: readonly ChannyAmbientSegment[] = [
  { animation: 'STOP', fromAnchorId: 'facility:channy-bed', toAnchorId: 'facility:channy-bed', durationMs: 1600 },
  { animation: 'WALK', fromAnchorId: 'facility:channy-bed', toAnchorId: 'facility:channy-food', durationMs: 2600 },
  { animation: 'SNIFF', fromAnchorId: 'facility:channy-food', toAnchorId: 'facility:channy-food', durationMs: 1400 },
  { animation: 'EAT', fromAnchorId: 'facility:channy-food', toAnchorId: 'facility:channy-food', durationMs: 3000 },
  { animation: 'WALK', fromAnchorId: 'facility:channy-food', toAnchorId: 'facility:channy-water', durationMs: 1800 },
  { animation: 'DRINK', fromAnchorId: 'facility:channy-water', toAnchorId: 'facility:channy-water', durationMs: 2400 },
  { animation: 'WALK', fromAnchorId: 'facility:channy-water', toAnchorId: 'facility:lounge', durationMs: 2800 },
  { animation: 'PLAY', fromAnchorId: 'facility:lounge', toAnchorId: 'facility:lounge', durationMs: 2600 },
  { animation: 'SIT', fromAnchorId: 'facility:lounge', toAnchorId: 'facility:lounge', durationMs: 2000 },
  { animation: 'WALK', fromAnchorId: 'facility:lounge', toAnchorId: 'facility:channy-bed', durationMs: 2800 },
  { animation: 'SLEEP', fromAnchorId: 'facility:channy-bed', toAnchorId: 'facility:channy-bed', durationMs: 3000 },
];

/** The exact eight ambient states the routine cycles through (order-independent). */
export const CHANNY_AMBIENT_STATES: readonly ChannyAnimation[] = [
  'WALK', 'STOP', 'SNIFF', 'SIT', 'EAT', 'DRINK', 'SLEEP', 'PLAY',
];
export const CHANNY_AMBIENT_LOOP_MS = CHANNY_AMBIENT_SEQUENCE.reduce((total, segment) => total + segment.durationMs, 0);

/**
 * Resolve the ambient Channy pose at a monotonic logical time. Loops over the fixed routine; a
 * non-finite or negative time resolves to the routine's resting start. No operational meaning derived.
 */
export function productionChannyAmbientPose(logicalTimeMs: number): ChannyAmbientPose {
  const bounded = Number.isFinite(logicalTimeMs) && logicalTimeMs > 0 ? logicalTimeMs : 0;
  const phase = bounded % CHANNY_AMBIENT_LOOP_MS;
  let elapsed = 0;
  for (const segment of CHANNY_AMBIENT_SEQUENCE) {
    if (phase < elapsed + segment.durationMs) {
      return {
        animation: segment.animation,
        fromAnchorId: segment.fromAnchorId,
        toAnchorId: segment.toAnchorId,
        progress: (phase - elapsed) / segment.durationMs,
      };
    }
    elapsed += segment.durationMs;
  }
  return { animation: 'STOP', fromAnchorId: 'facility:channy-bed', toAnchorId: 'facility:channy-bed', progress: 0 };
}
