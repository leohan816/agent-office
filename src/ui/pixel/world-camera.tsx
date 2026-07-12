import { cameraTransform } from './camera.js';
import type { PixelCameraState, PixelContainerPort } from './contracts.js';

export function applyWorldCamera(
  container: PixelContainerPort,
  camera: PixelCameraState,
  viewportWidth: number,
  viewportHeight: number,
): void {
  const transform = cameraTransform(camera, viewportWidth, viewportHeight);
  container.position.set(transform.x, transform.y);
  container.scale.set(transform.scale);
}
