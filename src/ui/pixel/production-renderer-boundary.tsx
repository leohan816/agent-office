// Agent Office Batch A — production renderer boundary (design delta §2.3 PR-2).
//
// Composes the shared fixture-free `PixelRenderHost` (backend/lifecycle/static-fallback) with the
// shared `PixelFrameStage`, fed by the fixture-free `projectLivingOfficeFrame`. Imports no
// `frame-projector` and no `fixtures/prototype-*`; the Living Office renders statically (ambient
// motion is animation-frame index only; cues are empty and there is no scripted timeline).
import { useCallback, useMemo, useState } from 'react';

import type {
  LivingOfficeProductionRenderInputV1,
  PixelPodInput,
  PixelPresentationTier,
  PixelRendererBackend,
  PixelWorldFrameV1,
  PixelWorldLayout,
} from './contracts.js';
import { PixelFrameStage } from './pixel-frame-stage.js';
import { PixelRenderHost } from './pixel-render-host.js';
import { projectLivingOfficeFrame } from './production-frame-projector.js';

export interface ProductionRendererBoundaryProps {
  readonly input: LivingOfficeProductionRenderInputV1;
  readonly pods: readonly PixelPodInput[];
  readonly layout: PixelWorldLayout;
  readonly selectedPodId: string;
  readonly running: boolean;
  readonly restartToken: number;
  readonly forceStatic: boolean;
  readonly requestedBackend: 'AUTO' | 'CANVAS' | 'FAIL';
  readonly onBackend: (backend: PixelRendererBackend) => void;
  readonly onViewport: (width: number, height: number) => void;
  readonly onFrame: (frame: PixelWorldFrameV1) => void;
  readonly onVisualFrame: (frame: PixelWorldFrameV1) => void;
  readonly onComplete: () => void;
}

export function ProductionRendererBoundary({
  input,
  pods,
  layout,
  selectedPodId,
  running,
  restartToken,
  forceStatic,
  requestedBackend,
  onBackend,
  onViewport,
  onFrame,
  onVisualFrame,
  onComplete,
}: ProductionRendererBoundaryProps) {
  const [backend, setBackend] = useState<PixelRendererBackend>(forceStatic ? 'DOM_STATIC' : 'WEBGL');
  const presentationTier: PixelPresentationTier = backend === 'DOM_STATIC'
    ? 'DOM_STATIC'
    : backend === 'CANVAS'
      ? 'PIXEL_RESTRAINED'
      : 'PIXEL_FULL';
  const handleBackend = useCallback((next: PixelRendererBackend) => {
    setBackend(next);
    onBackend(next);
  }, [onBackend]);
  const initialFrame = useMemo(
    () => projectLivingOfficeFrame(input, { presentationTier }),
    [input, presentationTier],
  );
  const projectFrame = useCallback(
    (logicalTimeMs: number) => projectLivingOfficeFrame({ ...input, logicalTimeMs }, { presentationTier }),
    [input, presentationTier],
  );
  return (
    <PixelRenderHost
      forceStatic={forceStatic}
      layout={layout}
      onBackend={handleBackend}
      onViewport={onViewport}
      requestedBackend={requestedBackend}
      running={running}
      renderScene={(sceneRunning) => (
        <PixelFrameStage
          initialFrame={initialFrame}
          initialLogicalTimeMs={input.logicalTimeMs}
          layout={layout}
          onComplete={onComplete}
          onFrame={onFrame}
          onVisualFrame={onVisualFrame}
          pods={pods}
          projectFrame={projectFrame}
          restartToken={restartToken}
          running={sceneRunning}
          selectedPodId={selectedPodId}
          viewportHeight={input.viewport.height}
          viewportWidth={input.viewport.width}
        />
      )}
    />
  );
}
