// Agent Office Batch A — prototype renderer boundary (bounded, behavior-preserving; design §2.3).
//
// The backend/lifecycle/static-fallback host moved to the fixture-free `pixel-render-host.tsx`; this
// boundary now composes that host with the prototype `PixelWorldScene`. Output is byte-equivalent.
import type {
  PixelPrototypeProjection,
  PixelPrototypeViewOptions,
  PixelRendererBackend,
  PixelWorldFrameV1,
  PixelWorldLayout,
} from './contracts.js';
import { PixelRenderHost } from './pixel-render-host.js';
import { PixelWorldScene } from './pixel-world-scene.js';

export interface PixelRendererBoundaryProps {
  readonly projection: PixelPrototypeProjection;
  readonly layout: PixelWorldLayout;
  readonly options: PixelPrototypeViewOptions;
  readonly running: boolean;
  readonly restartToken: number;
  readonly requestedBackend: 'AUTO' | 'CANVAS' | 'FAIL';
  readonly forceStatic: boolean;
  readonly onBackend: (backend: PixelRendererBackend) => void;
  readonly onFrame: (frame: PixelWorldFrameV1) => void;
  readonly onVisualFrame: (frame: PixelWorldFrameV1) => void;
  readonly onComplete: () => void;
  readonly onViewport: (width: number, height: number) => void;
}

export function PixelRendererBoundary({
  projection,
  layout,
  options,
  running,
  restartToken,
  requestedBackend,
  forceStatic,
  onBackend,
  onFrame,
  onVisualFrame,
  onComplete,
  onViewport,
}: PixelRendererBoundaryProps) {
  return (
    <PixelRenderHost
      forceStatic={forceStatic}
      layout={layout}
      onBackend={onBackend}
      onViewport={onViewport}
      requestedBackend={requestedBackend}
      running={running}
      renderScene={(sceneRunning) => (
        <PixelWorldScene
          layout={layout}
          onComplete={onComplete}
          onFrame={onFrame}
          onVisualFrame={onVisualFrame}
          options={options}
          projection={projection}
          restartToken={restartToken}
          running={sceneRunning}
        />
      )}
    />
  );
}
