import type {
  PixelPodInput,
  PixelPodLayout,
  PixelRect,
  PixelWorldAnchor,
  PixelWorldLayout,
} from './contracts.js';

export const PIXEL_TILE_SIZE = 16 as const;
export const PIXEL_POD_COLUMNS = 4 as const;
export const PIXEL_POD_WIDTH_TILES = 18 as const;
export const PIXEL_POD_HEIGHT_TILES = 12 as const;
export const PIXEL_MIN_WORLD_WIDTH_TILES = 80 as const;
export const PIXEL_MIN_WORLD_HEIGHT_TILES = 48 as const;

export function createPixelWorldLayout(pods: readonly PixelPodInput[]): PixelWorldLayout {
  const sorted = [...pods].sort((left, right) =>
    left.projectIdentity.projectId.localeCompare(right.projectIdentity.projectId, 'en'));
  const rowCount = Math.max(1, Math.ceil(sorted.length / PIXEL_POD_COLUMNS));
  const widthTiles = Math.max(
    PIXEL_MIN_WORLD_WIDTH_TILES,
    PIXEL_POD_COLUMNS * PIXEL_POD_WIDTH_TILES + 8,
  );
  const heightTiles = Math.max(
    PIXEL_MIN_WORLD_HEIGHT_TILES,
    14 + rowCount * PIXEL_POD_HEIGHT_TILES + 4,
  );
  const facilityBand = rectTiles(2, 2, widthTiles - 4, 9);
  const mainWalkway = rectTiles(2, 11, widthTiles - 4, 3);
  const podLayouts = sorted.map((pod, index) => createPodLayout(pod, index));
  const anchors: Record<string, PixelWorldAnchor> = {
    'facility:advisor-hub': anchor('facility:advisor-hub', 'ADVISOR_HUB', 39, 6),
    'facility:reviewer-booth': anchor('facility:reviewer-booth', 'REVIEWER_BOOTH', 52, 6),
    'facility:lounge': anchor('facility:lounge', 'LOUNGE', 64, 6),
    'facility:channy-bed': anchor('facility:channy-bed', 'CHANNY_BED', 72, 7),
    'facility:channy-food': anchor('facility:channy-food', 'CHANNY_FOOD', 76, 5),
    'facility:channy-water': anchor('facility:channy-water', 'CHANNY_WATER', 76, 8),
    'facility:decision': anchor('facility:decision', 'DECISION_DESTINATION', 27, 6),
    'walkway:west': anchor('walkway:west', 'WALKWAY', 4, 12),
    'walkway:center': anchor('walkway:center', 'WALKWAY', 40, 12),
    'walkway:east': anchor('walkway:east', 'WALKWAY', widthTiles - 5, 12),
  };
  for (const pod of podLayouts) {
    anchors[pod.deskAnchor.anchorId] = pod.deskAnchor;
    anchors[pod.boardAnchor.anchorId] = pod.boardAnchor;
  }
  return {
    layoutVersion: 'agent-office.pixel-world-layout.v1',
    tileSize: PIXEL_TILE_SIZE,
    width: widthTiles * PIXEL_TILE_SIZE,
    height: heightTiles * PIXEL_TILE_SIZE,
    floorBounds: rectTiles(0, 0, widthTiles, heightTiles),
    facilityBand,
    mainWalkway,
    pods: podLayouts,
    anchors,
    blockedTiles: createBlockedTiles(widthTiles, heightTiles, podLayouts),
  };
}

export function pointInsideWorld(layout: PixelWorldLayout, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < layout.width && y < layout.height;
}

export function tileKey(tileX: number, tileY: number): string {
  return `${tileY}:${tileX}`;
}

function createPodLayout(pod: PixelPodInput, index: number): PixelPodLayout {
  const column = index % PIXEL_POD_COLUMNS;
  const row = Math.floor(index / PIXEL_POD_COLUMNS);
  const tileX = 4 + column * PIXEL_POD_WIDTH_TILES;
  const tileY = 15 + row * PIXEL_POD_HEIGHT_TILES;
  return {
    ...rectTiles(tileX, tileY, PIXEL_POD_WIDTH_TILES - 1, PIXEL_POD_HEIGHT_TILES - 1),
    podId: pod.podId,
    projectId: pod.projectIdentity.projectId,
    deskAnchor: anchor(
      `pod:${pod.podId}:desk`,
      'POD_DESK',
      tileX + 8,
      tileY + 7,
    ),
    boardAnchor: anchor(
      `pod:${pod.podId}:board`,
      'POD_BOARD',
      tileX + 8,
      tileY + 2,
    ),
  };
}

function rectTiles(x: number, y: number, width: number, height: number): PixelRect {
  return {
    x: x * PIXEL_TILE_SIZE,
    y: y * PIXEL_TILE_SIZE,
    width: width * PIXEL_TILE_SIZE,
    height: height * PIXEL_TILE_SIZE,
  };
}

function anchor(
  anchorId: string,
  kind: PixelWorldAnchor['kind'],
  tileX: number,
  tileY: number,
): PixelWorldAnchor {
  return {
    anchorId,
    kind,
    x: tileX * PIXEL_TILE_SIZE + PIXEL_TILE_SIZE / 2,
    y: tileY * PIXEL_TILE_SIZE + PIXEL_TILE_SIZE / 2,
  };
}

function createBlockedTiles(
  widthTiles: number,
  heightTiles: number,
  pods: readonly PixelPodLayout[],
): ReadonlySet<string> {
  const blocked = new Set<string>();
  for (let x = 0; x < widthTiles; x += 1) {
    blocked.add(tileKey(x, 0));
    blocked.add(tileKey(x, heightTiles - 1));
  }
  for (let y = 0; y < heightTiles; y += 1) {
    blocked.add(tileKey(0, y));
    blocked.add(tileKey(widthTiles - 1, y));
  }
  for (const pod of pods) {
    const left = Math.floor(pod.x / PIXEL_TILE_SIZE);
    const top = Math.floor(pod.y / PIXEL_TILE_SIZE);
    const right = Math.floor((pod.x + pod.width) / PIXEL_TILE_SIZE) - 1;
    const bottom = Math.floor((pod.y + pod.height) / PIXEL_TILE_SIZE) - 1;
    for (let x = left; x <= right; x += 1) {
      blocked.add(tileKey(x, top));
      if (x !== left + 8) blocked.add(tileKey(x, bottom));
    }
    for (let y = top; y <= bottom; y += 1) {
      blocked.add(tileKey(left, y));
      blocked.add(tileKey(right, y));
    }
  }
  return blocked;
}
