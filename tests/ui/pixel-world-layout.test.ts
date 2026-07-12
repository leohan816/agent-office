import { describe, expect, it } from 'vitest';

import { createPixelWorldLayout, PIXEL_TILE_SIZE } from '../../src/ui/pixel/world-layout.js';
import { findBoundedPixelRoute, samplePixelRoute } from '../../src/ui/pixel/pathfinder.js';
import { LIVING_PIXEL_PROTOTYPE_PROJECTION } from '../../src/ui/pixel/fixtures/prototype-projection.js';

describe('living pixel-office deterministic shared floor', () => {
  it('places every synthetic project Pod on one stable four-column floor', () => {
    const first = createPixelWorldLayout(LIVING_PIXEL_PROTOTYPE_PROJECTION.pods);
    const reversed = createPixelWorldLayout([...LIVING_PIXEL_PROTOTYPE_PROJECTION.pods].reverse());
    expect(first.layoutVersion).toBe('agent-office.pixel-world-layout.v1');
    expect(first.tileSize).toBe(16);
    expect(first.width).toBeGreaterThanOrEqual(80 * PIXEL_TILE_SIZE);
    expect(first.height).toBeGreaterThanOrEqual(48 * PIXEL_TILE_SIZE);
    expect(first.pods).toHaveLength(LIVING_PIXEL_PROTOTYPE_PROJECTION.pods.length);
    expect(first.pods).toEqual(reversed.pods);
    expect(first.pods.map((pod) => pod.projectId)).toEqual([
      'agent-office', 'control', 'cosmile', 'foundation', 'siasiu', 'vibenews',
    ]);
    expect(new Set(first.pods.map((pod) => `${pod.x}:${pod.y}`)).size).toBe(first.pods.length);
    expect(first.mainWalkway.width).toBeGreaterThan(first.width * 0.8);
  });

  it('provides all global and Pod route anchors without overlapping Pod rectangles', () => {
    const layout = createPixelWorldLayout(LIVING_PIXEL_PROTOTYPE_PROJECTION.pods);
    for (const anchorId of [
      'facility:advisor-hub',
      'facility:reviewer-booth',
      'facility:lounge',
      'facility:channy-bed',
      'facility:channy-food',
      'facility:channy-water',
      'facility:decision',
      'walkway:west',
      'walkway:center',
      'walkway:east',
    ]) {
      expect(layout.anchors[anchorId], anchorId).toBeDefined();
    }
    for (const pod of layout.pods) {
      expect(layout.anchors[pod.deskAnchor.anchorId]).toEqual(pod.deskAnchor);
      expect(layout.anchors[pod.boardAnchor.anchorId]).toEqual(pod.boardAnchor);
    }
    for (const [index, pod] of layout.pods.entries()) {
      for (const candidate of layout.pods.slice(index + 1)) {
        const overlaps = pod.x < candidate.x + candidate.width
          && pod.x + pod.width > candidate.x
          && pod.y < candidate.y + candidate.height
          && pod.y + pod.height > candidate.y;
        expect(overlaps, `${pod.podId}/${candidate.podId}`).toBe(false);
      }
    }
  });

  it('finds deterministic bounded paths with stable samples', () => {
    const layout = createPixelWorldLayout(LIVING_PIXEL_PROTOTYPE_PROJECTION.pods);
    const start = layout.anchors['walkway:west'];
    const goal = layout.anchors['walkway:east'];
    if (start === undefined || goal === undefined) throw new TypeError('walkway anchors missing');
    const route = findBoundedPixelRoute(layout, start, goal);
    expect(route.length).toBeGreaterThan(40);
    expect(route).toEqual(findBoundedPixelRoute(layout, start, goal));
    expect(route[0]).toEqual({ x: start.x, y: start.y });
    expect(route[route.length - 1]).toEqual({ x: goal.x, y: goal.y });
    expect(samplePixelRoute(route, 0)).toEqual({ x: start.x, y: start.y });
    expect(samplePixelRoute(route, 1)).toEqual({ x: goal.x, y: goal.y });
    const midpoint = samplePixelRoute(route, 0.5);
    expect(midpoint.x).toBeGreaterThan(start.x);
    expect(midpoint.x).toBeLessThan(goal.x);
  });
});
