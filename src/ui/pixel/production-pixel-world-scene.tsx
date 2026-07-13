// Agent Office Batch A — production Living Office scene composition (design delta §2.3 PR-2).
//
// The DOM-level composition: the Pixi canvas (ProductionRendererBoundary → PixelRenderHost +
// PixelFrameStage) plus the fixture-free DOM overlay/HUD/semantic-mirror, all driven by the shared
// production frame. It passes {pods}+frame to the overlay/mirror and frame to the HUD (PRC-7).
// Imports no `frame-projector` and no `fixtures/prototype-*`.
import { useCallback, useMemo, useRef, useState } from 'react';

import { assembleOfficeLayout } from '../../application/organization/production-render-input.js';
import type {
  LivingOfficeProductionRenderInputV1,
  PixelRendererBackend,
  PixelWorldFrameV1,
} from './contracts.js';
import {
  LivingOfficeActorOverlay,
  type LivingOfficeActorOverlayHandle,
} from './living-office-actor-overlay.js';
import { LivingOfficeHud } from './living-office-hud.js';
import { LivingOfficeSemanticMirror } from './living-office-semantic-mirror.js';
import { projectLivingOfficeFrame } from './production-frame-projector.js';
import { ProductionRendererBoundary } from './production-renderer-boundary.js';
import { createPixelWorldLayout } from './world-layout.js';

export interface ProductionPixelWorldSceneProps {
  readonly input: LivingOfficeProductionRenderInputV1;
  readonly forceStatic: boolean;
}

export function ProductionPixelWorldScene({ input, forceStatic }: ProductionPixelWorldSceneProps) {
  const assembly = useMemo(() => assembleOfficeLayout(input.operational, input.committedLayout), [input]);
  const layout = useMemo(() => createPixelWorldLayout(assembly.pods), [assembly]);
  const structural = useMemo(() => ({ pods: assembly.pods }), [assembly]);
  const selectedPodId = input.selection.selectedPodId;
  const initialFrame = useMemo(
    () => projectLivingOfficeFrame(input, { presentationTier: forceStatic ? 'DOM_STATIC' : 'PIXEL_FULL' }),
    [forceStatic, input],
  );
  const [frame, setFrame] = useState<PixelWorldFrameV1>(initialFrame);
  const [backend, setBackend] = useState<PixelRendererBackend>(forceStatic ? 'DOM_STATIC' : 'WEBGL');
  const [viewport, setViewport] = useState({ width: input.viewport.width, height: input.viewport.height });
  const overlayRef = useRef<LivingOfficeActorOverlayHandle>(null);

  const onVisualFrame = useCallback((next: PixelWorldFrameV1) => {
    overlayRef.current?.updatePositions(next);
  }, []);
  const onViewport = useCallback((width: number, height: number) => {
    setViewport((current) => current.width === width && current.height === height ? current : { width, height });
  }, []);

  return (
    <section aria-label="Living pixel-office" className="living-office-surface" data-living-office-surface="true">
      <LivingOfficeHud
        backend={backend}
        complete={false}
        frame={frame}
        running={!forceStatic}
      />
      <section aria-label="Living pixel-office world" className="living-office-stage">
        <ProductionRendererBoundary
          forceStatic={forceStatic}
          input={input}
          layout={layout}
          onBackend={setBackend}
          onComplete={noop}
          onFrame={setFrame}
          onViewport={onViewport}
          onVisualFrame={onVisualFrame}
          pods={assembly.pods}
          requestedBackend="AUTO"
          restartToken={0}
          running={!forceStatic}
          selectedPodId={selectedPodId}
        />
        <LivingOfficeActorOverlay
          frame={frame}
          projection={structural}
          ref={overlayRef}
          viewportHeight={viewport.height}
          viewportWidth={viewport.width}
        />
      </section>
      <LivingOfficeSemanticMirror frame={frame} projection={structural} />
    </section>
  );
}

function noop(): void {
  // The Living Office has no scripted completion (no 26s tour); the ambient scene never "completes".
}
