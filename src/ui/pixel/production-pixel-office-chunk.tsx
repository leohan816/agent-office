// Agent Office Batch A — sole production Pixi lazy entry (design delta §2.3 PR-2/PR-3).
//
// This is the ONLY module the eager shell reaches via `React.lazy(() => import(...))`; it (and its
// transitive graph: production scene/boundary + PixelRenderHost/PixelFrameStage + production frame
// projector + pixi-public-export-bridge) is where Pixi lives. Before mounting the renderer it runs
// the second untrusted-boundary validator `parseLivingOfficeProductionRenderInput` (a cast is not
// validation); an invalid input fails closed to a DOM_STATIC / M1_FIXED_STATIONS fallback surface.
import { useMemo } from 'react';

import { parseLivingOfficeProductionRenderInput } from '../../application/organization/production-render-input.js';
import { ProductionPixelWorldScene } from './production-pixel-world-scene.js';

export interface ProductionPixelOfficeChunkProps {
  /** The composed LivingOfficeProductionRenderInputV1 (validated here at the untrusted boundary). */
  readonly renderInput: unknown;
  readonly reducedMotion: boolean;
}

export default function ProductionPixelOfficeChunk({ renderInput, reducedMotion }: ProductionPixelOfficeChunkProps) {
  const result = useMemo(() => parseLivingOfficeProductionRenderInput(renderInput), [renderInput]);
  if (!result.ok) {
    return (
      <div
        className="living-office-fallback"
        data-living-office-fallback={result.fallbackTier}
        data-living-office-fallback-reason={result.reason}
        role="status"
      >
        Living Office unavailable; showing the {result.fallbackTier === 'M1_FIXED_STATIONS'
          ? 'M1 fixed-station'
          : 'static semantic office'} fallback.
      </div>
    );
  }
  return <ProductionPixelWorldScene forceStatic={reducedMotion} input={result.value} />;
}
