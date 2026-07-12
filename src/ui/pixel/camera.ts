import type {
  PixelCameraState,
  PixelPodLayout,
  PixelWorldLayout,
} from './contracts.js';

export const PIXEL_CAMERA_ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3] as const;

export function fullOfficeCamera(
  layout: PixelWorldLayout,
  viewportWidth: number,
  viewportHeight: number,
  selectedPodId: string,
): PixelCameraState {
  const safeWidth = Math.max(1, viewportWidth - 32);
  const safeHeight = Math.max(1, viewportHeight - 32);
  const fit = Math.min(safeWidth / layout.width, safeHeight / layout.height);
  return {
    centerX: layout.width / 2,
    centerY: layout.height / 2,
    zoom: clampContinuousZoom(fit),
    mode: 'FULL_OFFICE',
    selectedPodId,
  };
}

export function focusPodCamera(
  layout: PixelWorldLayout,
  pod: PixelPodLayout,
  selectedPodId: string,
  viewportWidth: number,
  viewportHeight: number,
): PixelCameraState {
  const mobile = viewportWidth < 768;
  return clampPixelCamera(layout, {
    centerX: pod.x + pod.width / 2,
    centerY: pod.y + pod.height / 2,
    zoom: mobile ? 1 : 1.5,
    mode: 'FOCUSED_POD',
    selectedPodId,
  }, viewportWidth, viewportHeight);
}

export function panPixelCamera(
  layout: PixelWorldLayout,
  camera: PixelCameraState,
  deltaX: number,
  deltaY: number,
  viewportWidth = 0,
  viewportHeight = 0,
): PixelCameraState {
  return clampPixelCamera(layout, {
    ...camera,
    centerX: camera.centerX + deltaX / camera.zoom,
    centerY: camera.centerY + deltaY / camera.zoom,
    mode: 'MANUAL',
  }, viewportWidth, viewportHeight);
}

export function zoomPixelCamera(
  layout: PixelWorldLayout,
  camera: PixelCameraState,
  direction: -1 | 1,
  viewportWidth = 0,
  viewportHeight = 0,
): PixelCameraState {
  const index = nearestZoomStepIndex(camera.zoom);
  const nextIndex = Math.max(0, Math.min(PIXEL_CAMERA_ZOOM_STEPS.length - 1, index + direction));
  return clampPixelCamera(layout, {
    ...camera,
    zoom: PIXEL_CAMERA_ZOOM_STEPS[nextIndex] ?? 1,
    mode: 'MANUAL',
  }, viewportWidth, viewportHeight);
}

export function clampPixelCamera(
  layout: PixelWorldLayout,
  camera: PixelCameraState,
  viewportWidth = 0,
  viewportHeight = 0,
): PixelCameraState {
  const zoom = clampContinuousZoom(camera.zoom);
  const horizontalHalfSpan = viewportWidth > 0 ? viewportWidth / (2 * zoom) : 0;
  const verticalHalfSpan = viewportHeight > 0 ? viewportHeight / (2 * zoom) : 0;
  return {
    ...camera,
    centerX: clampCenter(camera.centerX, layout.width, horizontalHalfSpan),
    centerY: clampCenter(camera.centerY, layout.height, verticalHalfSpan),
    zoom,
  };
}

export function cameraTransform(
  camera: PixelCameraState,
  viewportWidth: number,
  viewportHeight: number,
): { readonly x: number; readonly y: number; readonly scale: number } {
  return {
    x: Math.round(viewportWidth / 2 - camera.centerX * camera.zoom),
    y: Math.round(viewportHeight / 2 - camera.centerY * camera.zoom),
    scale: camera.zoom,
  };
}

function nearestZoomStepIndex(zoom: number): number {
  let nearest = 0;
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < PIXEL_CAMERA_ZOOM_STEPS.length; index += 1) {
    const candidate = PIXEL_CAMERA_ZOOM_STEPS[index];
    if (candidate === undefined) continue;
    const nextDistance = Math.abs(candidate - zoom);
    if (nextDistance < distance) {
      nearest = index;
      distance = nextDistance;
    }
  }
  return nearest;
}

function clampContinuousZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.max(0.5, Math.min(3, Math.round(zoom * 1000) / 1000));
}

function clampCenter(value: number, worldSpan: number, viewportHalfSpan: number): number {
  if (viewportHalfSpan <= 0) return Math.round(Math.max(0, Math.min(worldSpan, value)));
  if (viewportHalfSpan * 2 >= worldSpan) return Math.round(worldSpan / 2);
  return Math.round(Math.max(viewportHalfSpan, Math.min(worldSpan - viewportHalfSpan, value)));
}
