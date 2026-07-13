// Agent Office Batch A — sole production Pixi lazy entry (design delta §2.3 PR-2/PR-3).
//
// This is the ONLY module the eager shell reaches via `React.lazy(() => import(...))`; it (and its
// transitive graph: production scene/boundary + PixelRenderHost/PixelFrameStage + production frame
// projector + pixi-public-export-bridge) is where Pixi lives. Before mounting the renderer it runs
// the second untrusted-boundary validator `parseLivingOfficeProductionRenderInput` (a cast is not
// validation); an invalid input fails closed to a DOM_STATIC / M1_FIXED_STATIONS fallback surface.
// CSP-safe Pixi (SIR-1): the loopback runtime serves a strict CSP (`script-src 'self'`, no
// `unsafe-eval`). Pixi's default shader/UBO code-generation uses `Function()` (eval), which that CSP
// blocks — leaving a blank canvas. The public `pixi.js/unsafe-eval` package-root export installs the
// eval-free polyfills, so WEBGL initializes under the strict CSP with no header weakening. It is a
// side-effect import placed first so it registers before any Pixi Application is constructed, and it
// stays inside this sole production Pixi lazy chunk (CD-3), never the eager shell.
import 'pixi.js/unsafe-eval';
import { useMemo } from 'react';

import { parseLivingOfficeProductionRenderInput } from '../../application/organization/production-render-input.js';
import { selectLivingOfficePresentationTier } from '../spatial/compatibility.js';
import { ProductionPixelWorldScene } from './production-pixel-world-scene.js';
import './living-office.css';

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
  const tier = selectLivingOfficePresentationTier({ renderInputOk: true, fallbackTier: 'DOM_STATIC', reducedMotion });
  return <ProductionPixelWorldScene forceStatic={tier === 'DOM_STATIC'} input={result.value} />;
}
