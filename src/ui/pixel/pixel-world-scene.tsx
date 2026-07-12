import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import { drawActorSprite, drawRouteDocument } from './actor-sprite.js';
import { drawChannySprite } from './channy-sprite.js';
import type {
  PixelPrototypeProjection,
  PixelPrototypeViewOptions,
  PixelContainerPort,
  PixelGraphicsPort,
  PixelWorldFrameV1,
  PixelWorldLayout,
} from './contracts.js';
import { FacilitySprites } from './facility-sprites.js';
import { projectPixelWorldFrame } from './frame-projector.js';
import { samplePixelRoute } from './pathfinder.js';
import { PixelContainer, PixelGraphics } from './pixi-public-export-bridge.js';
import { applyWorldCamera } from './world-camera.js';
import { WorldClock } from './world-clock.js';

export interface PixelWorldSceneProps {
  readonly projection: PixelPrototypeProjection;
  readonly layout: PixelWorldLayout;
  readonly options: PixelPrototypeViewOptions;
  readonly running: boolean;
  readonly restartToken: number;
  readonly onFrame: (frame: PixelWorldFrameV1) => void;
  readonly onComplete: () => void;
}

export function PixelWorldScene({
  projection,
  layout,
  options,
  running,
  restartToken,
  onFrame,
  onComplete,
}: PixelWorldSceneProps) {
  const worldRef = useRef<PixelContainerPort>(null);
  const dynamicRef = useRef<PixelGraphicsPort>(null);
  const lastSceneIdRef = useRef<string | null>(null);
  const initialFrame = useMemo(
    () => projectPixelWorldFrame(projection, layout, options),
    [layout, options, projection],
  );

  const renderFrame = useCallback((frame: PixelWorldFrameV1) => {
    const world = worldRef.current;
    const graphics = dynamicRef.current;
    if (world === null || graphics === null) return;
    applyWorldCamera(world, frame.camera, options.viewportWidth, options.viewportHeight);
    drawDynamicFrame(graphics, frame, projection);
    if (lastSceneIdRef.current !== frame.sceneId) {
      lastSceneIdRef.current = frame.sceneId;
      onFrame(frame);
    }
  }, [onFrame, options.viewportHeight, options.viewportWidth, projection]);

  useLayoutEffect(() => {
    lastSceneIdRef.current = null;
    renderFrame(initialFrame);
  }, [initialFrame, renderFrame]);

  const onStep = useCallback((logicalTimeMs: number) => {
    renderFrame(projectPixelWorldFrame(projection, layout, {
      ...options,
      logicalTimeMs,
    }));
  }, [layout, options, projection, renderFrame]);

  return (
    <>
      <PixelContainer ref={worldRef}>
        <FacilitySprites
          layout={layout}
          pods={projection.pods}
          selectedPodId={initialFrame.selectedPodId}
        />
        <PixelGraphics draw={() => undefined} ref={dynamicRef} />
      </PixelContainer>
      <WorldClock
        initialLogicalTimeMs={options.logicalTimeMs}
        onComplete={onComplete}
        onStep={onStep}
        restartToken={restartToken}
        running={running}
      />
    </>
  );
}

export function drawDynamicFrame(
  graphics: PixelGraphicsPort,
  frame: PixelWorldFrameV1,
  projection: PixelPrototypeProjection,
): void {
  graphics.clear();
  if (frame.route !== null) drawRoute(graphics, frame);
  const sortedActors = [...frame.actorFrames].sort((left, right) =>
    left.y - right.y || left.roleInstanceId.localeCompare(right.roleInstanceId, 'en'));
  for (const actor of sortedActors) {
    const pod = projection.pods.find((candidate) => candidate.podId === actor.podId);
    if (pod === undefined) continue;
    drawActorSprite(graphics, actor, pod.projectIdentity, actor.podId === frame.selectedPodId);
  }
  drawChannySprite(graphics, frame.channy);
  if (frame.route !== null && frame.route.kind === 'DELIVERY') {
    const point = samplePixelRoute(frame.route.points, frame.route.progress);
    drawRouteDocument(graphics, point.x + 17, point.y - 22);
  }
  if (frame.hud.operationalState === 'BLOCKED') {
    graphics.roundRect(56, 210, 1168, 15, 4).fill({ color: 0xf3505b, alpha: 0.82 });
    for (let x = 72; x < 1200; x += 42) {
      graphics.rect(x, 210, 18, 15).fill({ color: 0x252536, alpha: 0.72 });
    }
  }
}

function drawRoute(graphics: PixelGraphicsPort, frame: PixelWorldFrameV1): void {
  const route = frame.route;
  if (route === null || route.points.length < 2) return;
  const first = route.points[0];
  if (first === undefined) return;
  graphics.moveTo(first.x, first.y);
  for (const point of route.points.slice(1)) graphics.lineTo(point.x, point.y);
  graphics.stroke({ color: 0xffe0a3, width: 4, alpha: 0.25 });
  const progressPoint = samplePixelRoute(route.points, route.progress);
  graphics.circle(progressPoint.x, progressPoint.y, 8)
    .stroke({ color: route.kind === 'WAITING_LEO' ? 0xef9f42 : 0x71ddd2, width: 3, alpha: 0.9 });
}
