import type { PixelActorFrame, PixelGraphicsPort, PixelProjectIdentity } from './contracts.js';

export function drawActorSprite(
  graphics: PixelGraphicsPort,
  frame: PixelActorFrame,
  identity: PixelProjectIdentity,
  selected: boolean,
): void {
  if (!frame.visible) return;
  const walkOffset = frame.animation === 'WALK' || frame.animation === 'CARRY_DOCUMENT'
    ? frame.animationFrame % 2 === 0 ? -2 : 1
    : 0;
  const typeOffset = frame.animation === 'TYPE' ? frame.animationFrame % 2 : 0;
  const reviewOffset = frame.animation === 'REVIEW' ? frame.animationFrame % 2 : 0;
  const x = Math.round(frame.x - 16);
  const y = Math.round(frame.y - 44 + walkOffset);

  graphics.ellipse(frame.x, frame.y + 1, 13, 5).fill({ color: 0x171925, alpha: 0.42 });
  if (selected) {
    graphics.roundRect(x - 4, y - 4, 40, 52, 8)
      .stroke({ color: identity.secondaryColor, width: 2, alpha: 0.9 });
  }

  // Hair, head, eyes and warm skin pixels.
  pixelRect(graphics, x + 9, y + 1, 14, 4, 0x2e2632);
  pixelRect(graphics, x + 7, y + 5, 18, 11, 0xffd6a3);
  pixelRect(graphics, x + 7, y + 5, 3, 8, 0x3b2e38);
  pixelRect(graphics, x + 22, y + 5, 3, 8, 0x3b2e38);
  pixelRect(graphics, x + 11, y + 9, 2, 2, 0x252536);
  pixelRect(graphics, x + 19, y + 9, 2, 2, 0x252536);
  pixelRect(graphics, x + 14, y + 13, 4, 1, 0xb65f5d);

  // Project clothing is redundant with DOM text, glyph, pattern and sign.
  pixelRect(graphics, x + 6, y + 17, 20, 18, identity.primaryColor);
  pixelRect(graphics, x + 9, y + 17, 14, 3, identity.secondaryColor);
  drawIdentityPattern(graphics, identity, x + 8, y + 22);
  pixelRect(graphics, x + 3, y + 19 + typeOffset, 4, 13, identity.primaryColor);
  pixelRect(graphics, x + 25, y + 19 - typeOffset, 4, 13, identity.primaryColor);
  pixelRect(graphics, x + 8, y + 35, 7, 9 + walkOffset, 0x35405c);
  pixelRect(graphics, x + 18, y + 35, 7, 9 - walkOffset, 0x35405c);
  pixelRect(graphics, x + 6, y + 43 + walkOffset, 10, 3, 0x252536);
  pixelRect(graphics, x + 17, y + 43 - walkOffset, 10, 3, 0x252536);

  if (frame.animation === 'TYPE') drawKeyboard(graphics, x + 3, y + 29 + typeOffset);
  if (frame.animation === 'REVIEW') drawChecklist(graphics, x + 25 + reviewOffset, y + 18);
  if (frame.animation === 'COFFEE') drawMug(graphics, x + 26, y + 21 + typeOffset);
  if (frame.carryingDocument) drawDocument(graphics, x + 25, y + 21 + walkOffset);
  if (frame.animation === 'WAITING_LEO') drawStatusMarker(graphics, x + 25, y - 3, 0xf09f42, '?');
  if (frame.animation === 'BLOCKED') drawStatusMarker(graphics, x + 25, y - 3, 0xf3505b, '!');
}

export function drawRouteDocument(graphics: PixelGraphicsPort, x: number, y: number): void {
  graphics.roundRect(x - 7, y - 9, 14, 18, 2).fill({ color: 0xffedca, alpha: 1 });
  pixelRect(graphics, x - 4, y - 5, 8, 2, 0x7b6683);
  pixelRect(graphics, x - 4, y, 6, 2, 0x9a7e78);
  pixelRect(graphics, x - 4, y + 5, 8, 1, 0x9a7e78);
}

function drawIdentityPattern(
  graphics: PixelGraphicsPort,
  identity: PixelProjectIdentity,
  x: number,
  y: number,
): void {
  if (identity.pattern === 'DOTS') {
    for (let offset = 0; offset < 15; offset += 5) pixelRect(graphics, x + offset, y + offset % 7, 2, 2, identity.secondaryColor);
  } else if (identity.pattern === 'BANDS') {
    pixelRect(graphics, x, y, 16, 2, identity.secondaryColor);
    pixelRect(graphics, x, y + 7, 16, 2, identity.secondaryColor);
  } else if (identity.pattern === 'CHECKS') {
    pixelRect(graphics, x, y, 5, 5, identity.secondaryColor);
    pixelRect(graphics, x + 8, y + 6, 5, 5, identity.secondaryColor);
  } else if (identity.pattern === 'CHEVRON') {
    pixelRect(graphics, x + 2, y + 2, 4, 3, identity.secondaryColor);
    pixelRect(graphics, x + 6, y + 5, 4, 3, identity.secondaryColor);
    pixelRect(graphics, x + 10, y + 2, 4, 3, identity.secondaryColor);
  } else if (identity.pattern === 'CROSS') {
    pixelRect(graphics, x + 6, y, 3, 11, identity.secondaryColor);
    pixelRect(graphics, x + 2, y + 4, 11, 3, identity.secondaryColor);
  } else {
    pixelRect(graphics, x, y + 3, 16, 2, identity.secondaryColor);
    pixelRect(graphics, x + 4, y, 2, 11, identity.secondaryColor);
    pixelRect(graphics, x + 11, y, 2, 11, identity.secondaryColor);
  }
}

function drawKeyboard(graphics: PixelGraphicsPort, x: number, y: number): void {
  pixelRect(graphics, x, y, 25, 6, 0x222839);
  for (let key = 0; key < 5; key += 1) pixelRect(graphics, x + 3 + key * 4, y + 2, 2, 2, 0x75d5d0);
}

function drawChecklist(graphics: PixelGraphicsPort, x: number, y: number): void {
  pixelRect(graphics, x, y, 11, 16, 0xffedca);
  for (let line = 0; line < 3; line += 1) {
    pixelRect(graphics, x + 2, y + 3 + line * 4, 2, 2, 0x5dd3a7);
    pixelRect(graphics, x + 5, y + 3 + line * 4, 4, 1, 0x4a536b);
  }
}

function drawMug(graphics: PixelGraphicsPort, x: number, y: number): void {
  pixelRect(graphics, x, y, 8, 10, 0xf7d394);
  graphics.roundRect(x + 6, y + 2, 5, 6, 2).stroke({ color: 0xf7d394, width: 2 });
  pixelRect(graphics, x + 2, y - 4, 1, 3, 0xd9e6e8);
  pixelRect(graphics, x + 5, y - 5, 1, 4, 0xd9e6e8);
}

function drawDocument(graphics: PixelGraphicsPort, x: number, y: number): void {
  pixelRect(graphics, x, y, 11, 15, 0xffedca);
  pixelRect(graphics, x + 2, y + 3, 7, 1, 0x5b6985);
  pixelRect(graphics, x + 2, y + 7, 5, 1, 0x5b6985);
}

function drawStatusMarker(
  graphics: PixelGraphicsPort,
  x: number,
  y: number,
  color: number,
  symbol: '?' | '!',
): void {
  graphics.roundRect(x, y, 14, 14, 3).fill(color);
  if (symbol === '!') {
    pixelRect(graphics, x + 6, y + 3, 2, 6, 0x252536);
    pixelRect(graphics, x + 6, y + 11, 2, 2, 0x252536);
  } else {
    pixelRect(graphics, x + 4, y + 3, 6, 2, 0x252536);
    pixelRect(graphics, x + 8, y + 5, 2, 3, 0x252536);
    pixelRect(graphics, x + 6, y + 8, 2, 2, 0x252536);
    pixelRect(graphics, x + 6, y + 11, 2, 2, 0x252536);
  }
}

function pixelRect(
  graphics: PixelGraphicsPort,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
): void {
  graphics.rect(Math.round(x), Math.round(y), Math.round(width), Math.round(height)).fill(color);
}
