// Agent Office Batch A — prototype scene (bounded, behavior-preserving; design §2.3 PR-2).
//
// The Pixi draw/render tree moved to the fixture-free `pixel-frame-stage.tsx`; this scene keeps its
// prototype projector import and provides the timeline-driven frame provider. Output is byte-equivalent.
import { useCallback, useMemo } from 'react';

import type {
  PixelPrototypeProjection,
  PixelPrototypeViewOptions,
  PixelWorldFrameV1,
  PixelWorldLayout,
} from './contracts.js';
import { projectPixelWorldFrame } from './frame-projector.js';
import { PixelFrameStage } from './pixel-frame-stage.js';

export interface PixelWorldSceneProps {
  readonly projection: PixelPrototypeProjection;
  readonly layout: PixelWorldLayout;
  readonly options: PixelPrototypeViewOptions;
  readonly running: boolean;
  readonly restartToken: number;
  readonly onFrame: (frame: PixelWorldFrameV1) => void;
  readonly onVisualFrame: (frame: PixelWorldFrameV1) => void;
  readonly onComplete: () => void;
}

export function PixelWorldScene({
  projection,
  layout,
  options,
  running,
  restartToken,
  onFrame,
  onVisualFrame,
  onComplete,
}: PixelWorldSceneProps) {
  const initialFrame = useMemo(
    () => projectPixelWorldFrame(projection, layout, options),
    [layout, options, projection],
  );
  const projectFrame = useCallback(
    (logicalTimeMs: number) => projectPixelWorldFrame(projection, layout, { ...options, logicalTimeMs }),
    [layout, options, projection],
  );
  return (
    <PixelFrameStage
      initialFrame={initialFrame}
      initialLogicalTimeMs={options.logicalTimeMs}
      layout={layout}
      onComplete={onComplete}
      onFrame={onFrame}
      onVisualFrame={onVisualFrame}
      pods={projection.pods}
      projectFrame={projectFrame}
      restartToken={restartToken}
      running={running}
      selectedPodId={initialFrame.selectedPodId}
      viewportHeight={options.viewportHeight}
      viewportWidth={options.viewportWidth}
    />
  );
}
