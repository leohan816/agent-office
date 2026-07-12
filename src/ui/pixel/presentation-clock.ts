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
