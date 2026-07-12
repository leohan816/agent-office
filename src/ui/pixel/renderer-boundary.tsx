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
  PixelPrototypeProjection,
  PixelPrototypeViewOptions,
  PixelRendererBackend,
  PixelWorldFrameV1,
  PixelWorldLayout,
} from './contracts.js';
import { RendererResourceRegistry } from './contracts.js';
import { PixelWorldScene } from './pixel-world-scene.js';
import {
  PIXEL_PUBLIC_EXPORT_RUNTIME,
  PixelApplication,
  type PixelApplicationRefPort,
} from './pixi-public-export-bridge.js';

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
  onComplete,
  onViewport,
}: PixelRendererBoundaryProps) {
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
    onBackend(resolvedBackend);
  }, [onBackend, requestedBackend]);
  const retry = () => {
    setFallbackReason(null);
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
      data-pixel-backend={effectiveStatic ? 'DOM_STATIC' : backend}
      data-pixel-renderer-status={effectiveStatic ? fallbackReason ?? 'STATIC_REQUESTED' : 'PIXEL_READY'}
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
            setFallbackReason(message);
            setBackend('DOM_STATIC');
            onBackend('DOM_STATIC');
          }}
        >
          <PixelApplication
            antialias={false}
            autoDensity
            autoStart={running}
            backgroundColor={0x1b2032}
            className="pixel-world-canvas"
            onInit={onInit}
            preference={preference}
            ref={applicationRef}
            resizeTo={viewportRef}
            resolution={1}
            sharedTicker={false}
          >
            <PixelWorldScene
              layout={layout}
              onComplete={onComplete}
              onFrame={onFrame}
              options={options}
              projection={projection}
              restartToken={restartToken}
              running={running && !paused}
            />
          </PixelApplication>
        </PixelRendererErrorBoundary>
      )}
      <span className="pixel-renderer-badge" aria-hidden="true">
        {effectiveStatic ? 'DOM STATIC' : backend}
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
