import type { PixelPoint, PixelWorldLayout } from './contracts.js';
import { PIXEL_TILE_SIZE, tileKey } from './world-layout.js';

interface SearchNode {
  readonly x: number;
  readonly y: number;
  readonly g: number;
  readonly h: number;
  readonly parentKey: string | null;
}

export function findBoundedPixelRoute(
  layout: PixelWorldLayout,
  start: PixelPoint,
  goal: PixelPoint,
): readonly PixelPoint[] {
  const startTile = toTile(start);
  const goalTile = toTile(goal);
  const startKey = tileKey(startTile.x, startTile.y);
  const goalKey = tileKey(goalTile.x, goalTile.y);
  if (!isWalkable(layout, startTile.x, startTile.y, startKey, goalKey)) return [];
  if (!isWalkable(layout, goalTile.x, goalTile.y, startKey, goalKey)) return [];

  const open = new Map<string, SearchNode>();
  const closed = new Set<string>();
  const nodes = new Map<string, SearchNode>();
  const startNode: SearchNode = {
    ...startTile,
    g: 0,
    h: manhattan(startTile.x, startTile.y, goalTile.x, goalTile.y),
    parentKey: null,
  };
  open.set(startKey, startNode);
  nodes.set(startKey, startNode);

  while (open.size > 0) {
    const currentEntry = [...open.entries()].sort(compareOpenEntries)[0];
    if (currentEntry === undefined) break;
    const [currentKey, current] = currentEntry;
    open.delete(currentKey);
    if (currentKey === goalKey) return reconstruct(nodes, currentKey);
    closed.add(currentKey);

    for (const neighbour of neighbours(current.x, current.y)) {
      const neighbourKey = tileKey(neighbour.x, neighbour.y);
      if (closed.has(neighbourKey)) continue;
      if (!isWalkable(layout, neighbour.x, neighbour.y, startKey, goalKey)) continue;
      const candidateG = current.g + 1;
      const known = nodes.get(neighbourKey);
      if (known !== undefined && candidateG >= known.g) continue;
      const next: SearchNode = {
        ...neighbour,
        g: candidateG,
        h: manhattan(neighbour.x, neighbour.y, goalTile.x, goalTile.y),
        parentKey: currentKey,
      };
      nodes.set(neighbourKey, next);
      open.set(neighbourKey, next);
    }
  }
  return [];
}

export function samplePixelRoute(points: readonly PixelPoint[], progress: number): PixelPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0] ?? { x: 0, y: 0 };
  const bounded = Math.max(0, Math.min(1, progress));
  const scaled = bounded * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(scaled));
  const from = points[index] ?? points[0] ?? { x: 0, y: 0 };
  const to = points[index + 1] ?? from;
  const local = scaled - index;
  return {
    x: Math.round(from.x + (to.x - from.x) * local),
    y: Math.round(from.y + (to.y - from.y) * local),
  };
}

function toTile(point: PixelPoint): PixelPoint {
  return {
    x: Math.floor(point.x / PIXEL_TILE_SIZE),
    y: Math.floor(point.y / PIXEL_TILE_SIZE),
  };
}

function isWalkable(
  layout: PixelWorldLayout,
  x: number,
  y: number,
  startKey: string,
  goalKey: string,
): boolean {
  const key = tileKey(x, y);
  if (key === startKey || key === goalKey) return true;
  const widthTiles = layout.width / PIXEL_TILE_SIZE;
  const heightTiles = layout.height / PIXEL_TILE_SIZE;
  return x > 0
    && y > 0
    && x < widthTiles - 1
    && y < heightTiles - 1
    && !layout.blockedTiles.has(key);
}

function neighbours(x: number, y: number): readonly PixelPoint[] {
  return [
    { x, y: y - 1 },
    { x: x - 1, y },
    { x: x + 1, y },
    { x, y: y + 1 },
  ];
}

function manhattan(x: number, y: number, targetX: number, targetY: number): number {
  return Math.abs(targetX - x) + Math.abs(targetY - y);
}

function compareOpenEntries(
  left: readonly [string, SearchNode],
  right: readonly [string, SearchNode],
): number {
  const leftScore = left[1].g + left[1].h;
  const rightScore = right[1].g + right[1].h;
  return leftScore - rightScore
    || left[1].h - right[1].h
    || left[1].y - right[1].y
    || left[1].x - right[1].x
    || left[0].localeCompare(right[0], 'en');
}

function reconstruct(nodes: ReadonlyMap<string, SearchNode>, goalKey: string): readonly PixelPoint[] {
  const reversed: PixelPoint[] = [];
  let currentKey: string | null = goalKey;
  while (currentKey !== null) {
    const node = nodes.get(currentKey);
    if (node === undefined) return [];
    reversed.push({
      x: node.x * PIXEL_TILE_SIZE + PIXEL_TILE_SIZE / 2,
      y: node.y * PIXEL_TILE_SIZE + PIXEL_TILE_SIZE / 2,
    });
    currentKey = node.parentKey;
  }
  return reversed.reverse();
}
