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
  // I2-1: no backend is advertised until the child render host reports a successful onInit; the parent
  // starts PENDING (or DOM_STATIC when reduced-motion) so the HUD never shows WEBGL/CANVAS pre-init.
  const [backend, setBackend] = useState<PixelRendererBackend | 'PENDING'>(forceStatic ? 'DOM_STATIC' : 'PENDING');
  const [viewport, setViewport] = useState({ width: input.viewport.width, height: input.viewport.height });
  // SIR-5: the Living Office is a continuous ambient surface (no 26s tour). Restart the shared clock at
  // each completion so the fixture-free eight-state Channy routine loops. Reduced-motion stays static.
  const [restartToken, setRestartToken] = useState(0);
  const overlayRef = useRef<LivingOfficeActorOverlayHandle>(null);
  const lastChannyStateRef = useRef(initialFrame.channy.animation);

  const onVisualFrame = useCallback((next: PixelWorldFrameV1) => {
    overlayRef.current?.updatePositions(next);
    // I2-4: keep the semantic mirror/HUD frame in parity with the canvas — commit the frame only at a
    // bounded meaningful transition (a new Channy ambient state), never on every animation frame.
    if (next.channy.animation !== lastChannyStateRef.current) {
      lastChannyStateRef.current = next.channy.animation;
      setFrame(next);
    }
  }, []);
  const onLoopComplete = useCallback(() => setRestartToken((token) => token + 1), []);
  const onViewport = useCallback((width: number, height: number) => {
    setViewport((current) => current.width === width && current.height === height ? current : { width, height });
  }, []);

  // A5-2: the authoritative expected visible-actor id set, published straight from the production frame
  // (not derived from the label/roster DOM), so the exact cardinality gates cannot false-pass by sourcing
  // their own expected set from the elements they test.
  const visibleActorIds = frame.actorFrames
    .filter((actor) => actor.visible && actor.organizationFacts !== undefined)
    .map((actor) => actor.roleInstanceId);
  return (
    <section
      aria-label="Living pixel-office"
      className="living-office-surface"
      data-living-office-surface="true"
      data-office-actor-ids={JSON.stringify(visibleActorIds)}
    >
      <LivingOfficeHud
        backend={backend}
        complete={false}
        frame={frame}
        running={!forceStatic}
        surfaceKind="PRODUCTION"
      />
      <section aria-label="Living pixel-office world" className="living-office-stage">
        <ProductionRendererBoundary
          forceStatic={forceStatic}
          input={input}
          layout={layout}
          onBackend={setBackend}
          onComplete={onLoopComplete}
          onFrame={setFrame}
          onViewport={onViewport}
          onVisualFrame={onVisualFrame}
          pods={assembly.pods}
          requestedBackend="AUTO"
          restartToken={restartToken}
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
      <LivingOfficeSemanticMirror
        frame={frame}
        onOpenActor={(actorId, invoker) => overlayRef.current?.openActorDrawer(actorId, invoker)}
        projection={structural}
        surfaceKind="PRODUCTION"
      />
    </section>
  );
}
