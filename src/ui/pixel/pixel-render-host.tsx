// Agent Office Batch A — fixture-free Pixi render host (design delta §2.3 PR-2).
//
// Owns the WEBGL→CANVAS→DOM_STATIC backend selection, the Pixi-Application lifecycle, viewport/
// visibility/context-loss handling, the static fallback, and the renderer error boundary. It imports
// NO scene (prototype or production) and NO fixture; the scene is supplied by the caller via the
// `renderScene` render prop so both `renderer-boundary.tsx` and `production-renderer-boundary.tsx`
// share one host. Behaviour is extracted byte-for-byte from the previous renderer boundary.
import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type {
  PixelApplicationPort,
  PixelRendererBackend,
  PixelWorldLayout,
} from './contracts.js';
import { RendererResourceRegistry } from './contracts.js';
import {
  PIXEL_PUBLIC_EXPORT_RUNTIME,
  PixelApplication,
  type PixelApplicationRefPort,
} from './pixi-public-export-bridge.js';

// Upper bound for a successful renderer initialization before degrading to the static fallback (SIR-1).
// Generous relative to real WEBGL/CANVAS init so it only fires on a genuine stall/failure.
const RENDERER_INITIALIZATION_TIMEOUT_MS = 8000;

export interface PixelRenderHostProps {
  readonly layout: PixelWorldLayout;
  readonly running: boolean;
  readonly requestedBackend: 'AUTO' | 'CANVAS' | 'FAIL';
  readonly forceStatic: boolean;
  readonly onBackend: (backend: PixelRendererBackend) => void;
  readonly onViewport: (width: number, height: number) => void;
  /** The Pixi scene, rendered inside the live PixelApplication; `sceneRunning` folds in pause state. */
  readonly renderScene: (sceneRunning: boolean) => ReactNode;
}

export function PixelRenderHost({
  layout,
  running,
  requestedBackend,
  forceStatic,
  onBackend,
  onViewport,
  renderScene,
}: PixelRenderHostProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const applicationRef = useRef<PixelApplicationRefPort>(null);
  const registryRef = useRef(new RendererResourceRegistry());
  const [application, setApplication] = useState<PixelApplicationPort | null>(null);
  const [rendererKey, setRendererKey] = useState(0);
  const [fallbackReason, setFallbackReason] = useState<string | null>(
    requestedBackend === 'FAIL' ? 'RENDERER_INITIALIZATION_FORCED_FAILURE' : null,
  );
  const [paused, setPaused] = useState(false);
  const [backend, setBackend] = useState<PixelRendererBackend>(forceStatic ? 'DOM_STATIC' : 'WEBGL');
  // SIR-1: `initialized` is set only after a successful `onInit`. Backend/`PIXEL_READY` are never
  // advertised before the renderer actually initializes; a failed initialization degrades to static.
  const [initialized, setInitialized] = useState(false);
  const effectiveStatic = forceStatic || fallbackReason !== null;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null) return;
    const report = () => onViewport(
      Math.max(1, Math.round(viewport.clientWidth)),
      Math.max(1, Math.round(viewport.clientHeight)),
    );
    report();
    const observer = new ResizeObserver(report);
    registryRef.current.acquire('resizeObservers');
    observer.observe(viewport);
    return () => {
      observer.disconnect();
      registryRef.current.release('resizeObservers');
    };
  }, [onViewport]);

  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    const onOrientation = () => setPaused(false);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('orientationchange', onOrientation);
    registryRef.current.acquire('visibilityListeners');
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('orientationchange', onOrientation);
      registryRef.current.release('visibilityListeners');
    };
  }, []);

  useEffect(() => {
    if (application === null) return;
    const canvas = application.canvas;
    const onContextLost = (event: Event) => {
      event.preventDefault();
      stopApplicationTicker(application);
      setApplication(null);
      setInitialized(false);
      setFallbackReason('RENDERER_CONTEXT_LOST');
      setBackend('DOM_STATIC');
      onBackend('DOM_STATIC');
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('contextlost', onContextLost);
    registryRef.current.acquire('contextListeners');
    return () => {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('contextlost', onContextLost);
      registryRef.current.release('contextListeners');
    };
  }, [application, onBackend]);

  useEffect(() => {
    if (application === null) return;
    const ticker = applicationTicker(application);
    if (ticker === null) return;
    if (running && !paused && !effectiveStatic) ticker.start();
    else ticker.stop();
  }, [application, effectiveStatic, paused, running]);

  useEffect(() => () => {
    const app = applicationRef.current?.getApplication();
    if (app !== null && app !== undefined) stopApplicationTicker(app);
  }, []);

  useEffect(() => {
    if (forceStatic) {
      setBackend('DOM_STATIC');
      onBackend('DOM_STATIC');
    }
  }, [forceStatic, onBackend]);

  // SIR-1: bound initialization. If `onInit` never completes (e.g. an asynchronous renderer/context
  // failure that precedes it), degrade truthfully to DOM_STATIC instead of advertising a ready state
  // the renderer never reached. A successful `onInit` sets `initialized` and clears this timer.
  useEffect(() => {
    if (forceStatic || fallbackReason !== null || initialized) return;
    const timer = window.setTimeout(() => {
      setFallbackReason('RENDERER_INITIALIZATION_TIMEOUT');
      setBackend('DOM_STATIC');
      onBackend('DOM_STATIC');
    }, RENDERER_INITIALIZATION_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [forceStatic, fallbackReason, initialized, onBackend, rendererKey]);

  const preference = useMemo(
    () => requestedBackend === 'CANVAS' ? 'canvas' as const : ['webgl', 'canvas'] as const,
    [requestedBackend],
  );
  const onInit = useCallback((app: PixelApplicationPort) => {
    const canvas = app.canvas;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('data-pixel-canvas', 'true');
    canvas.setAttribute('tabindex', '-1');
    app.ticker.maxFPS = 30;
    app.ticker.minFPS = 15;
    const rendererName = app.renderer.constructor.name.toLowerCase();
    const resolvedBackend: PixelRendererBackend = rendererName.includes('canvas') ? 'CANVAS' : 'WEBGL';
    if (requestedBackend === 'CANVAS' && resolvedBackend !== 'CANVAS') {
      stopApplicationTicker(app);
      setApplication(null);
      setFallbackReason('CANVAS_CORE_SUBSET_UNSUPPORTED');
      setBackend('DOM_STATIC');
      onBackend('DOM_STATIC');
      return;
    }
    setApplication(app);
    setBackend(resolvedBackend);
    setInitialized(true);
    onBackend(resolvedBackend);
  }, [onBackend, requestedBackend]);
  const retry = () => {
    setFallbackReason(null);
    setInitialized(false);
    setRendererKey((current) => current + 1);
  };
  const snapshot = registryRef.current.snapshot();

  return (
    <div
      className="pixel-world-viewport"
      data-context-listeners={snapshot.contextListeners}
      data-pixi-bridge-contract={PIXEL_PUBLIC_EXPORT_RUNTIME.contractId}
      data-pixi-js-version={PIXEL_PUBLIC_EXPORT_RUNTIME.actualPixiJsVersion}
      data-pixi-react-version={PIXEL_PUBLIC_EXPORT_RUNTIME.expectedPixiReactVersion}
      data-pixi-runtime-values={PIXEL_PUBLIC_EXPORT_RUNTIME.valueNames.join(',')}
      data-pixel-backend={effectiveStatic ? 'DOM_STATIC' : initialized ? backend : 'PENDING'}
      data-pixel-renderer-status={effectiveStatic
        ? fallbackReason ?? 'STATIC_REQUESTED'
        : initialized ? 'PIXEL_READY' : 'PIXEL_INITIALIZING'}
      data-resize-observers={snapshot.resizeObservers}
      ref={viewportRef}
    >
      {effectiveStatic ? (
        <StaticWorldFallback
          layout={layout}
          reason={fallbackReason ?? 'STATIC_PRESENTATION_REQUESTED'}
          retry={fallbackReason === 'RENDERER_CONTEXT_LOST' ? retry : null}
        />
      ) : (
        <PixelRendererErrorBoundary
          key={rendererKey}
          onError={(message) => {
            setApplication(null);
            setInitialized(false);
            setFallbackReason(message);
            setBackend('DOM_STATIC');
            onBackend('DOM_STATIC');
          }}
        >
          <PixelApplication
            antialias={false}
            autoDensity
            autoStart={running}
            backgroundColor={0xe8e4dc}
            className="pixel-world-canvas"
            onInit={onInit}
            preference={preference}
            ref={applicationRef}
            resizeTo={viewportRef}
            resolution={1}
            sharedTicker={false}
          >
            {renderScene(running && !paused)}
          </PixelApplication>
        </PixelRendererErrorBoundary>
      )}
      <span className="pixel-renderer-badge" aria-hidden="true">
        {effectiveStatic ? 'DOM STATIC' : initialized ? backend : 'INITIALIZING'}
      </span>
    </div>
  );
}

function applicationTicker(application: PixelApplicationPort): PixelApplicationPort['ticker'] | null {
  return (application as PixelApplicationPort & { readonly ticker: PixelApplicationPort['ticker'] | null }).ticker;
}

function stopApplicationTicker(application: PixelApplicationPort): void {
  applicationTicker(application)?.stop();
}

function StaticWorldFallback({
  layout,
  reason,
  retry,
}: {
  readonly layout: PixelWorldLayout;
  readonly reason: string;
  readonly retry: (() => void) | null;
}) {
  return (
    <div className="pixel-static-world" data-static-reason={reason}>
      <div aria-hidden="true" className="pixel-static-world__facility">STATIC SEMANTIC OFFICE</div>
      <div aria-hidden="true" className="pixel-static-world__walkway" />
      <div aria-hidden="true" className="pixel-static-world__pods">
        {layout.pods.map((pod) => <span key={pod.podId} />)}
      </div>
      {retry === null ? null : (
        <button className="pixel-static-world__retry" onClick={retry} type="button">
          Retry renderer once
        </button>
      )}
    </div>
  );
}

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly onError: (message: string) => void;
}

interface ErrorBoundaryState {
  readonly failed: boolean;
}

class PixelRendererErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    const message = error instanceof Error ? error.message : 'PIXEL_RENDERER_UNKNOWN_FAILURE';
    this.props.onError(`PIXEL_RENDERER_FAILURE:${message}`);
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
