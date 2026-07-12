import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import {
  focusPodCamera,
  fullOfficeCamera,
  panPixelCamera,
  zoomPixelCamera,
} from './camera.js';
import type {
  PixelCameraState,
  PixelPrototypeViewOptions,
  PixelRendererBackend,
  PixelWorldFrameV1,
} from './contracts.js';
import { LIVING_PIXEL_PROTOTYPE_PROJECTION } from './fixtures/prototype-projection.js';
import { PIXEL_PROTOTYPE_SCENARIOS } from './fixtures/prototype-scenarios.js';
import { projectPixelWorldFrame } from './frame-projector.js';
import { LivingOfficeDetailDrawer } from './living-office-detail-drawer.js';
import {
  LivingOfficeActorOverlay,
  type LivingOfficeActorOverlayHandle,
} from './living-office-actor-overlay.js';
import { LivingOfficeHud } from './living-office-hud.js';
import { LivingOfficeSemanticMirror } from './living-office-semantic-mirror.js';
import { PixelWorldChunk } from './pixel-world-chunk.js';
import { createPixelWorldLayout } from './world-layout.js';
import './living-office.css';

export function mountLivingPixelPrototype(root: Element, search: string): void {
  createRoot(root).render(
    <StrictMode>
      <LivingPixelPrototype search={search} />
    </StrictMode>,
  );
}

export function LivingPixelPrototype({ search }: { readonly search: string }) {
  const parameters = useMemo(() => new URLSearchParams(search), [search]);
  const scenario = useMemo(() => {
    const scenarioId = parameters.get('scene');
    return scenarioId === null
      ? null
      : PIXEL_PROTOTYPE_SCENARIOS.find((candidate) => candidate.scenarioId === scenarioId) ?? null;
  }, [parameters]);
  const layout = useMemo(
    () => createPixelWorldLayout(LIVING_PIXEL_PROTOTYPE_PROJECTION.pods),
    [],
  );
  const initialLogicalTimeMs = scenario?.logicalTimeMs
    ?? parseLogicalTime(parameters.get('time'));
  const frozen = scenario !== null || parameters.has('time');
  const [viewport, setViewport] = useState({
    width: Math.max(1, window.innerWidth),
    height: Math.max(1, Math.min(620, window.innerHeight - 260)),
  });
  const initialSelectedPodId = scenarioSelectedPod(scenario?.scenarioId)
    ?? LIVING_PIXEL_PROTOTYPE_PROJECTION.selectedPodId;
  const [selectedPodId, setSelectedPodId] = useState(initialSelectedPodId);
  const [cameraOverride, setCameraOverride] = useState<PixelCameraState | null>(null);
  const [backend, setBackend] = useState<PixelRendererBackend>('WEBGL');
  const [running, setRunning] = useState(!frozen && parameters.get('autoplay') !== '0');
  const [complete, setComplete] = useState(false);
  const [restartToken, setRestartToken] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAutomatic, setDetailAutomatic] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    scenario?.reducedMotion === true || window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const detailInvokerRef = useRef<HTMLButtonElement>(null);
  const actorOverlayRef = useRef<LivingOfficeActorOverlayHandle>(null);
  const requestedBackend = parameters.get('backend') === 'canvas'
    ? 'CANVAS'
    : parameters.get('renderer') === 'fail'
      ? 'FAIL'
      : 'AUTO';
  const forceStatic = reducedMotion || scenario?.reducedMotion === true;
  const presentationTier = forceStatic ? 'DOM_STATIC' : 'PIXEL_FULL';
  const options: PixelPrototypeViewOptions = useMemo(() => ({
    selectedPodId,
    logicalTimeMs: initialLogicalTimeMs,
    presentationTier,
    scenarioId: scenario?.scenarioId ?? null,
    cameraOverride,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  }), [cameraOverride, initialLogicalTimeMs, presentationTier, scenario?.scenarioId, selectedPodId, viewport.height, viewport.width]);
  const [frame, setFrame] = useState<PixelWorldFrameV1>(() =>
    projectPixelWorldFrame(LIVING_PIXEL_PROTOTYPE_PROJECTION, layout, options));

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(scenario?.reducedMotion === true || media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [scenario?.reducedMotion]);

  useEffect(() => {
    if (forceStatic) setRunning(false);
  }, [forceStatic]);

  const onFrame = useCallback((nextFrame: PixelWorldFrameV1) => {
    setFrame(nextFrame);
    if (nextFrame.sceneId === 'detail-open') {
      setDetailAutomatic(true);
      setDetailOpen(true);
    } else if (nextFrame.sceneId === 'detail-return') {
      setDetailOpen(false);
      setDetailAutomatic(false);
    }
  }, []);
  const onViewport = useCallback((width: number, height: number) => {
    setViewport((current) => current.width === width && current.height === height
      ? current
      : { width, height });
  }, []);
  const onVisualFrame = useCallback((nextFrame: PixelWorldFrameV1) => {
    actorOverlayRef.current?.updatePositions(nextFrame);
  }, []);
  const replay = () => {
    setComplete(false);
    setDetailOpen(false);
    setDetailAutomatic(false);
    setCameraOverride(null);
    setRestartToken((current) => current + 1);
    setRunning(true);
  };
  const selectPod = (podId: string) => {
    setSelectedPodId(podId);
    const pod = layout.pods.find((candidate) => candidate.podId === podId);
    if (pod !== undefined) setCameraOverride(focusPodCamera(
      layout,
      pod,
      podId,
      viewport.width,
      viewport.height,
    ));
  };
  const selectedIndex = LIVING_PIXEL_PROTOTYPE_PROJECTION.pods.findIndex((pod) => pod.podId === frame.selectedPodId);
  const navigatePod = (direction: -1 | 1) => {
    const count = LIVING_PIXEL_PROTOTYPE_PROJECTION.pods.length;
    const nextIndex = ((Math.max(0, selectedIndex) + direction) % count + count) % count;
    const pod = LIVING_PIXEL_PROTOTYPE_PROJECTION.pods[nextIndex];
    if (pod !== undefined) selectPod(pod.podId);
  };
  const camera = frame.camera;
  const setFullOffice = () => setCameraOverride(fullOfficeCamera(
    layout,
    viewport.width,
    viewport.height,
    frame.selectedPodId,
  ));
  const setFocusedPod = () => {
    const pod = layout.pods.find((candidate) => candidate.podId === frame.selectedPodId);
    if (pod !== undefined) setCameraOverride(focusPodCamera(
      layout,
      pod,
      frame.selectedPodId,
      viewport.width,
      viewport.height,
    ));
  };

  return (
    <main
      className="living-office-prototype"
      data-prototype-complete={complete}
      data-prototype-fixture={LIVING_PIXEL_PROTOTYPE_PROJECTION.fixtureId}
      data-prototype-scene={frame.sceneId}
      data-synthetic-prototype="true"
      id="living-pixel-prototype"
    >
      <a className="skip-link" href="#living-office-status">Skip to prototype status</a>
      <a className="skip-link" href="#living-office-semantic">Skip to semantic office</a>
      <LivingOfficeHud backend={backend} complete={complete} frame={frame} running={running} />
      <nav aria-label="Advisor Team Pod navigation" className="living-office-team-nav">
        <button aria-label="Previous Team" onClick={() => navigatePod(-1)} type="button">&lt;</button>
        <div>
          {LIVING_PIXEL_PROTOTYPE_PROJECTION.pods.map((pod) => (
            <button
              aria-current={pod.podId === frame.selectedPodId ? 'true' : undefined}
              data-project={pod.projectIdentity.projectId}
              key={pod.podId}
              onClick={() => selectPod(pod.podId)}
              type="button"
            >
              <span aria-hidden="true">{pod.projectIdentity.glyph}</span>
              {pod.projectIdentity.displayName}
            </button>
          ))}
        </div>
        <button aria-label="Next Team" onClick={() => navigatePod(1)} type="button">&gt;</button>
      </nav>
      <section aria-label="Living pixel-office world" className="living-office-stage">
        <PixelWorldChunk
          forceStatic={forceStatic}
          layout={layout}
          onBackend={setBackend}
          onComplete={() => {
            setComplete(true);
            setRunning(false);
          }}
          onFrame={onFrame}
          onVisualFrame={onVisualFrame}
          onViewport={onViewport}
          options={options}
          projection={LIVING_PIXEL_PROTOTYPE_PROJECTION}
          requestedBackend={requestedBackend}
          restartToken={restartToken}
          running={running}
        />
        <LivingOfficeActorOverlay
          frame={frame}
          projection={LIVING_PIXEL_PROTOTYPE_PROJECTION}
          ref={actorOverlayRef}
          viewportHeight={viewport.height}
          viewportWidth={viewport.width}
        />
        <div
          aria-label="Office camera controls"
          className="living-office-camera-controls"
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            const commands: Readonly<Record<string, () => void>> = {
              ArrowLeft: () => setCameraOverride(panPixelCamera(layout, camera, -80, 0, viewport.width, viewport.height)),
              ArrowUp: () => setCameraOverride(panPixelCamera(layout, camera, 0, -80, viewport.width, viewport.height)),
              ArrowDown: () => setCameraOverride(panPixelCamera(layout, camera, 0, 80, viewport.width, viewport.height)),
              ArrowRight: () => setCameraOverride(panPixelCamera(layout, camera, 80, 0, viewport.width, viewport.height)),
              '-': () => setCameraOverride(zoomPixelCamera(layout, camera, -1, viewport.width, viewport.height)),
              '+': () => setCameraOverride(zoomPixelCamera(layout, camera, 1, viewport.width, viewport.height)),
              '=': () => setCameraOverride(zoomPixelCamera(layout, camera, 1, viewport.width, viewport.height)),
              Home: setFullOffice,
              Enter: setFocusedPod,
            };
            const command = commands[event.key];
            if (command === undefined) return;
            event.preventDefault();
            command();
          }}
          role="group"
          tabIndex={0}
        >
          <button aria-label="Pan left" onClick={() => setCameraOverride(panPixelCamera(layout, camera, -80, 0, viewport.width, viewport.height))} type="button">Left</button>
          <button aria-label="Pan up" onClick={() => setCameraOverride(panPixelCamera(layout, camera, 0, -80, viewport.width, viewport.height))} type="button">Up</button>
          <button aria-label="Pan down" onClick={() => setCameraOverride(panPixelCamera(layout, camera, 0, 80, viewport.width, viewport.height))} type="button">Down</button>
          <button aria-label="Pan right" onClick={() => setCameraOverride(panPixelCamera(layout, camera, 80, 0, viewport.width, viewport.height))} type="button">Right</button>
          <button aria-label="Zoom out" onClick={() => setCameraOverride(zoomPixelCamera(layout, camera, -1, viewport.width, viewport.height))} type="button">-</button>
          <button aria-label="Zoom in" onClick={() => setCameraOverride(zoomPixelCamera(layout, camera, 1, viewport.width, viewport.height))} type="button">+</button>
          <button onClick={setFocusedPod} type="button">Focus selected Team</button>
          <button onClick={setFullOffice} type="button">Full office</button>
        </div>
        <div className="living-office-scene-card" aria-hidden="true">
          <span>{Math.round(frame.logicalTimeMs / 100) / 10}s</span>
          <strong>{frame.sceneId.replaceAll('-', ' ')}</strong>
        </div>
      </section>
      <div className="living-office-actions">
        <button data-prototype-replay onClick={replay} type="button">Replay 26-second office tour</button>
        <button
          onClick={() => {
            setDetailAutomatic(false);
            setDetailOpen(true);
          }}
          ref={detailInvokerRef}
          type="button"
        >
          Open technical detail
        </button>
        <button onClick={() => setReducedMotion((current) => !current)} type="button">
          {forceStatic ? 'Enable pixel motion' : 'Use static presentation'}
        </button>
        <a href="/">Open unchanged M1 fallback</a>
      </div>
      <LivingOfficeDetailDrawer
        automatic={detailAutomatic}
        frame={frame}
        invokerRef={detailInvokerRef}
        onClose={() => setDetailOpen(false)}
        open={detailOpen}
      />
      <LivingOfficeSemanticMirror frame={frame} projection={LIVING_PIXEL_PROTOTYPE_PROJECTION} />
      <footer>
        Synthetic fixture only. Pixel position, animation, camera, props, and Channy carry no authority,
        assignment, evidence, delivery, review, decision, approval, or completion meaning.
      </footer>
    </main>
  );
}

function parseLogicalTime(value: string | null): number {
  if (value === null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(26_000, parsed)) : 0;
}

function scenarioSelectedPod(scenarioId: string | undefined): string | null {
  if (scenarioId === 'vibenews-active') return 'pod:vibenews';
  if (scenarioId === 'lounge-idle') return 'pod:cosmile';
  if (scenarioId === 'foundation-active' || scenarioId === 'mobile-foundation') return 'pod:foundation';
  if (scenarioId === undefined || scenarioId === 'full-office') return null;
  return 'pod:agent-office';
}
