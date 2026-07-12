import type {
  PixelPrototypeProjection,
  PixelPrototypeViewOptions,
  PixelRendererBackend,
  PixelWorldFrameV1,
  PixelWorldLayout,
} from './contracts.js';
import { PixelRendererBoundary } from './renderer-boundary.js';

export interface PixelWorldChunkProps {
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

export function PixelWorldChunk(props: PixelWorldChunkProps) {
  return <PixelRendererBoundary {...props} />;
}
