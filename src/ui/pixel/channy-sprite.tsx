import type { ChannyFrame, PixelGraphicsPort } from './contracts.js';

export function drawChannySprite(graphics: PixelGraphicsPort, frame: ChannyFrame): void {
  const walking = frame.animation === 'WALK' || frame.animation === 'ROAM' || frame.animation === 'PLAY';
  const motion = walking
    ? frame.animationFrame % 2 === 0 ? -1 : 1
    : 0;
  const sleeping = frame.animation === 'SLEEP';
  const eating = frame.animation === 'EAT' || frame.animation === 'DRINK';
  const sniffing = frame.animation === 'SNIFF';
  const sitting = frame.animation === 'SIT';
  const x = Math.round(frame.x - 24);
  const y = Math.round(frame.y - (sleeping ? 22 : 37) + motion);
  graphics.ellipse(frame.x, frame.y + 1, sleeping ? 23 : 19, 6)
    .fill({ color: 0x5c5b58, alpha: 0.2 });
  if (sleeping) {
    graphics.ellipse(x + 27, y + 15, 18, 10).fill(0xd7d4cf);
    graphics.circle(x + 13, y + 13, 10).fill(0xf2eee6);
    graphics.circle(x + 9, y + 10, 5).fill(0xf7f3eb);
    graphics.roundRect(x + 2, y + 14, 14, 6, 3).fill(0xc8c5c0);
    pixelRect(graphics, x + 2, y + 9, 5, 11, 0x686665);
    pixelRect(graphics, x + 3, y + 16, 2, 2, 0x343638);
    pixelRect(graphics, x + 10, y + 13, 4, 1, 0x4d4f50);
    pixelRect(graphics, x + 36, y + 7 + frame.animationFrame, 8, 3, 0xe7e2d9);
    return;
  }

  const headY = y + (eating ? 19 : sniffing ? 14 : sitting ? 9 : 8);
  const bodyY = y + (sitting ? 18 : 15);
  // Bedlington silhouette: wool cap, narrow muzzle, arched back and slim legs.
  graphics.ellipse(x + 30, bodyY + 7, sitting ? 13 : 18, sitting ? 12 : 11).fill(0xd7d4cf);
  graphics.circle(x + 23, bodyY + 2, 10).fill(0xe6e2da);
  graphics.circle(x + 34, bodyY + 1, 10).fill(0xe0ddd7);
  graphics.circle(x + 15, headY + 4, 10).fill(0xf2eee6);
  graphics.circle(x + 10, headY + 1, 6).fill(0xf7f3eb);
  graphics.circle(x + 18, headY, 6).fill(0xeeeae2);
  graphics.roundRect(x + 1, headY + 5, 15, 7, 3).fill(0xc8c5c0);
  pixelRect(graphics, x + 4, headY - 1, 5, 13, 0x686665);
  pixelRect(graphics, x + 1, headY + 8, 3, 3, 0x343638);
  pixelRect(graphics, x + 12, headY + 5, 2, 2, 0x343638);
  pixelRect(graphics, x + 18, bodyY + 12, 3, sitting ? 10 : 15 + motion, 0x9b9894);
  pixelRect(graphics, x + 37, bodyY + 11, 3, sitting ? 8 : 16 - motion, 0x9b9894);
  pixelRect(graphics, x + 17, frame.y - 2, 7, 3, 0x686665);
  pixelRect(graphics, x + 36, frame.y - 2, 7, 3, 0x686665);
  pixelRect(graphics, x + 42, bodyY + 1 + motion, 6, 3, 0xd7d4cf);
  if (frame.animation === 'REACT_WAITING_LEO') drawReaction(graphics, x + 35, y + 1, 0xf09f42, false);
  if (frame.animation === 'REACT_BLOCKED') drawReaction(graphics, x + 35, y + 1, 0xf3505b, true);
  if (eating) {
    graphics.ellipse(x + 10, frame.y + 2, 10, 4).fill(frame.animation === 'DRINK' ? 0x9bd5e3 : 0xd9aa6f);
    pixelRect(graphics, x + 2, frame.y, 16, 3, 0x6f7070);
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
