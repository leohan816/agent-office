import { useCallback, useEffect, useRef } from 'react';

import {
  advancePixelClock,
  createPixelClockState,
  type PixelClockState,
} from './presentation-clock.js';
import { usePixelTick } from './pixi-public-export-bridge.js';

export interface WorldClockProps {
  readonly initialLogicalTimeMs: number;
  readonly running: boolean;
  readonly restartToken: number;
  readonly onStep: (logicalTimeMs: number) => void;
  readonly onComplete: () => void;
}

export function WorldClock({
  initialLogicalTimeMs,
  running,
  restartToken,
  onStep,
  onComplete,
}: WorldClockProps) {
  const stateRef = useRef<PixelClockState>(createPixelClockState(initialLogicalTimeMs));
  const onStepRef = useRef(onStep);
  const onCompleteRef = useRef(onComplete);
  const completeReportedRef = useRef(false);
  onStepRef.current = onStep;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    stateRef.current = createPixelClockState(initialLogicalTimeMs);
    completeReportedRef.current = false;
    onStepRef.current(stateRef.current.logicalTimeMs);
  }, [initialLogicalTimeMs, restartToken]);

  const tick = useCallback((ticker: { readonly deltaMS: number }) => {
    if (!running) return;
    const advanced = advancePixelClock(stateRef.current, ticker.deltaMS);
    stateRef.current = advanced.state;
    for (const logicalTimeMs of advanced.steps) onStepRef.current(logicalTimeMs);
    if (advanced.state.complete && !completeReportedRef.current) {
      completeReportedRef.current = true;
      onCompleteRef.current();
    }
  }, [running]);

  usePixelTick({ callback: tick, isEnabled: running });
  return null;
}
