import type { ChannyFrame, PixelGraphicsPort } from './contracts.js';

export function drawChannySprite(graphics: PixelGraphicsPort, frame: ChannyFrame): void {
  const motion = frame.animation === 'ROAM' || frame.animation === 'PLAY'
    ? frame.animationFrame % 2 === 0 ? -2 : 1
    : 0;
  const sleeping = frame.animation === 'SLEEP';
  const eating = frame.animation === 'EAT' || frame.animation === 'DRINK';
  const x = Math.round(frame.x - 24);
  const y = Math.round(frame.y - (sleeping ? 22 : 36) + motion);
  graphics.ellipse(frame.x, frame.y + 1, sleeping ? 23 : 19, 6)
    .fill({ color: 0x171925, alpha: 0.35 });
  if (sleeping) {
    graphics.roundRect(x + 5, y + 8, 38, 16, 7).fill(0xd5cdbe);
    pixelRect(graphics, x + 7, y + 5, 13, 13, 0xd5cdbe);
    pixelRect(graphics, x + 4, y + 5, 6, 11, 0x746a68);
    pixelRect(graphics, x + 10, y + 11, 5, 1, 0x252536);
    pixelRect(graphics, x + 34, y + 5 + frame.animationFrame, 8, 3, 0xebe3d2);
    return;
  }
  graphics.roundRect(x + 10, y + 15, 31, 16, 6).fill(0xd5cdbe);
  graphics.roundRect(x + (eating ? 3 : 5), y + (eating ? 18 : 9), 19, 18, 7).fill(0xebe3d2);
  pixelRect(graphics, x + 4, y + (eating ? 17 : 7), 6, 14, 0x746a68);
  pixelRect(graphics, x + 11, y + (eating ? 25 : 17), 3, 3, 0x252536);
  pixelRect(graphics, x + 17, y + (eating ? 23 : 15), 2, 2, 0x252536);
  pixelRect(graphics, x + 13, y + 29, 5, 7 + motion, 0x746a68);
  pixelRect(graphics, x + 34, y + 28, 5, 8 - motion, 0x746a68);
  pixelRect(graphics, x + 39, y + 17 + motion, 7, 4, 0xd5cdbe);
  if (frame.animation === 'REACT_WAITING_LEO') drawReaction(graphics, x + 35, y + 1, 0xf09f42, false);
  if (frame.animation === 'REACT_BLOCKED') drawReaction(graphics, x + 35, y + 1, 0xf3505b, true);
  if (eating) {
    graphics.ellipse(x + 11, frame.y + 2, 10, 4).fill(frame.animation === 'DRINK' ? 0x73c9d2 : 0xef9f42);
    pixelRect(graphics, x + 3, frame.y, 16, 3, 0x4a536b);
  }
}

function drawReaction(graphics: PixelGraphicsPort, x: number, y: number, color: number, blocked: boolean): void {
  graphics.roundRect(x, y, 12, 12, 3).fill(color);
  if (blocked) {
    pixelRect(graphics, x + 5, y + 2, 2, 6, 0x252536);
    pixelRect(graphics, x + 5, y + 9, 2, 2, 0x252536);
  } else {
    pixelRect(graphics, x + 3, y + 2, 6, 2, 0x252536);
    pixelRect(graphics, x + 7, y + 4, 2, 3, 0x252536);
    pixelRect(graphics, x + 5, y + 7, 2, 2, 0x252536);
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
