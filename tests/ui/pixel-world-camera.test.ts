import { describe, expect, it } from 'vitest';

import {
  cameraTransform,
  clampPixelCamera,
  focusPodCamera,
  fullOfficeCamera,
  panPixelCamera,
  PIXEL_CAMERA_ZOOM_STEPS,
  zoomPixelCamera,
} from '../../src/ui/pixel/camera.js';
import { LIVING_PIXEL_PROTOTYPE_PROJECTION } from '../../src/ui/pixel/fixtures/prototype-projection.js';
import { createPixelWorldLayout } from '../../src/ui/pixel/world-layout.js';

describe('living pixel-office bounded presentation camera', () => {
  const layout = createPixelWorldLayout(LIVING_PIXEL_PROTOTYPE_PROJECTION.pods);

  it('fits the full office and focuses an exact Pod without moving it', () => {
    const full = fullOfficeCamera(layout, 1200, 620, 'pod:foundation');
    expect(full.mode).toBe('FULL_OFFICE');
    expect(full.centerX).toBe(layout.width / 2);
    expect(full.centerY).toBe(layout.height / 2);
    expect(full.zoom).toBeGreaterThanOrEqual(0.5);
    expect(full.zoom).toBeLessThanOrEqual(3);
    const foundation = layout.pods.find((pod) => pod.podId === 'pod:foundation');
    if (foundation === undefined) throw new TypeError('Foundation Pod missing');
    const before = { ...foundation };
    const focused = focusPodCamera(layout, foundation, foundation.podId, 1200, 620);
    expect(focused.mode).toBe('FOCUSED_POD');
    expect(focused.zoom).toBe(1.5);
    expect(focused.centerX).toBeLessThanOrEqual(layout.width - 1200 / (2 * focused.zoom));
    expect(foundation).toEqual(before);
  });

  it('clamps pan and traverses only the reviewed zoom steps', () => {
    const initial = fullOfficeCamera(layout, 1200, 620, 'pod:foundation');
    const outside = panPixelCamera(layout, initial, -99_999, 99_999);
    expect(outside.centerX).toBe(0);
    expect(outside.centerY).toBe(layout.height);
    let camera = clampPixelCamera(layout, { ...outside, zoom: 1 });
    const visited: number[] = [camera.zoom];
    for (let index = 0; index < 8; index += 1) {
      camera = zoomPixelCamera(layout, camera, 1);
      visited.push(camera.zoom);
    }
    expect(camera.zoom).toBe(3);
    expect(visited.every((zoom) => PIXEL_CAMERA_ZOOM_STEPS.includes(zoom as never))).toBe(true);
    for (let index = 0; index < 8; index += 1) camera = zoomPixelCamera(layout, camera, -1);
    expect(camera.zoom).toBe(0.5);
  });

  it('produces integer device transforms for deterministic rendering', () => {
    const camera = fullOfficeCamera(layout, 1200, 620, 'pod:foundation');
    const transform = cameraTransform(camera, 1200, 620);
    expect(Number.isInteger(transform.x)).toBe(true);
    expect(Number.isInteger(transform.y)).toBe(true);
    expect(transform.scale).toBe(camera.zoom);
  });
});
