import { useEffect, useMemo, useRef } from 'react';

import type { PixelGraphicsPort, PixelPodInput, PixelWorldLayout } from './contracts.js';
import { createPixelTexture, PixelSprite } from './pixi-public-export-bridge.js';

export interface FacilitySpritesProps {
  readonly layout: PixelWorldLayout;
  readonly pods: readonly PixelPodInput[];
  readonly selectedPodId: string;
}

export function FacilitySprites({ layout, pods, selectedPodId }: FacilitySpritesProps) {
  const deferredDestroyRef = useRef<number | null>(null);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = layout.width;
    canvas.height = layout.height;
    const context = canvas.getContext('2d', { alpha: true });
    if (context === null) throw new TypeError('pixel facility Canvas 2D context unavailable');
    context.imageSmoothingEnabled = false;
    drawOfficeFacilities(new CanvasGraphicsPort(context, canvas), layout, pods, selectedPodId);
    const created = createPixelTexture(canvas);
    created.source.scaleMode = 'nearest';
    return created;
  }, [layout, pods, selectedPodId]);
  useEffect(() => {
    if (deferredDestroyRef.current !== null) {
      window.clearTimeout(deferredDestroyRef.current);
      deferredDestroyRef.current = null;
    }
    return () => {
      deferredDestroyRef.current = window.setTimeout(() => texture.destroy(true), 0);
    };
  }, [texture]);
  return <PixelSprite roundPixels texture={texture} />;
}

export function drawOfficeFacilities(
  graphics: PixelGraphicsPort,
  layout: PixelWorldLayout,
  pods: readonly PixelPodInput[],
  selectedPodId: string,
): void {
  graphics.clear();
  graphics.rect(0, 0, layout.width, layout.height).fill(0xe8e4dc);
  graphics.roundRect(12, 12, layout.width - 24, layout.height - 24, 12)
    .fill(0xf7f3eb)
    .stroke({ color: 0x817d78, width: 6 });

  // Warm parquet field with deterministic seams.
  graphics.rect(24, 24, layout.width - 48, layout.height - 48).fill(0xd7bc97);
  for (let y = 24; y < layout.height - 24; y += 32) {
    for (let x = 24; x < layout.width - 24; x += 64) {
      const offset = (Math.floor(y / 32) % 2) * 32;
      const boardX = x + offset;
      const boardWidth = Math.min(58, layout.width - 24 - boardX);
      if (boardWidth <= 0) continue;
      graphics.rect(boardX, y, boardWidth, 28).fill({ color: 0xebd8bc, alpha: 0.72 });
      graphics.rect(boardX, y + 27, boardWidth, 1).fill({ color: 0xb99d7e, alpha: 0.46 });
    }
  }

  drawFacilityBand(graphics, layout);
  drawMainWalkway(graphics, layout);
  for (const podLayout of layout.pods) {
    const pod = pods.find((candidate) => candidate.podId === podLayout.podId);
    if (pod !== undefined) drawPod(graphics, podLayout, pod, pod.podId === selectedPodId);
  }
  drawPlants(graphics, layout);
}

class CanvasGraphicsPort implements PixelGraphicsPort {
  constructor(
    private readonly context: CanvasRenderingContext2D,
    private readonly canvas: HTMLCanvasElement,
  ) {}

  clear(): PixelGraphicsPort {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    return this;
  }

  rect(x: number, y: number, width: number, height: number): PixelGraphicsPort {
    this.context.beginPath();
    this.context.rect(x, y, width, height);
    return this;
  }

  roundRect(x: number, y: number, width: number, height: number, radius: number): PixelGraphicsPort {
    this.context.beginPath();
    this.context.roundRect(x, y, width, height, radius);
    return this;
  }

  ellipse(x: number, y: number, radiusX: number, radiusY: number): PixelGraphicsPort {
    this.context.beginPath();
    this.context.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
    return this;
  }

  circle(x: number, y: number, radius: number): PixelGraphicsPort {
    return this.ellipse(x, y, radius, radius);
  }

  moveTo(x: number, y: number): PixelGraphicsPort {
    this.context.beginPath();
    this.context.moveTo(x, y);
    return this;
  }

  lineTo(x: number, y: number): PixelGraphicsPort {
    this.context.lineTo(x, y);
    return this;
  }

  fill(style: number | { readonly color: number; readonly alpha?: number }): PixelGraphicsPort {
    const color = typeof style === 'number' ? style : style.color;
    this.context.save();
    this.context.globalAlpha = typeof style === 'number' ? 1 : style.alpha ?? 1;
    this.context.fillStyle = cssColor(color);
    this.context.fill();
    this.context.restore();
    return this;
  }

  stroke(style: { readonly color: number; readonly width: number; readonly alpha?: number }): PixelGraphicsPort {
    this.context.save();
    this.context.globalAlpha = style.alpha ?? 1;
    this.context.strokeStyle = cssColor(style.color);
    this.context.lineWidth = style.width;
    this.context.stroke();
    this.context.restore();
    return this;
  }
}

function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function drawFacilityBand(graphics: PixelGraphicsPort, layout: PixelWorldLayout): void {
  const y = layout.facilityBand.y;
  const h = layout.facilityBand.height;
  // Glass meeting room.
  room(graphics, 42, y + 12, 250, h - 24, 0x8fc0cf, 0xe9f1f2);
  for (let x = 62; x < 280; x += 38) graphics.rect(x, y + 18, 3, h - 36).fill({ color: 0xe3fbff, alpha: 0.52 });
  graphics.roundRect(98, y + 62, 138, 42, 10).fill(0xc7a276);
  for (let chair = 0; chair < 5; chair += 1) {
    graphics.roundRect(78 + chair * 43, y + 47 + (chair % 2) * 70, 22, 18, 5).fill(0x858d94);
  }

  // Leo/GPT decision destination.
  room(graphics, 314, y + 12, 132, h - 24, 0xc9a16f, 0xf2eadf);
  graphics.roundRect(340, y + 34, 80, 72, 6).fill(0xcfc7bd);
  graphics.rect(352, y + 47, 56, 40).fill(0xfffcf4);
  graphics.rect(360, y + 56, 40, 4).fill(0xc88a50);
  graphics.rect(360, y + 68, 31, 3).fill(0x7b7d80);

  // Advisor Hub.
  room(graphics, 468, y + 12, 164, h - 24, 0x8da7b7, 0xe7ecee);
  graphics.roundRect(488, y + 72, 124, 35, 7).fill(0xc7a276);
  drawMonitor(graphics, 516, y + 42, 0x78aab6);
  drawMonitor(graphics, 560, y + 42, 0xc99b67);
  graphics.rect(481, y + 22, 138, 7).fill(0xc3d6df);

  // Independent reviewer booth.
  room(graphics, 654, y + 12, 150, h - 24, 0x9c929e, 0xefeaed);
  graphics.roundRect(675, y + 69, 110, 37, 7).fill(0xc7a276);
  drawMonitor(graphics, 713, y + 39, 0xa897b2);
  graphics.rect(669, y + 22, 120, 7).fill(0xd8ced8);

  // Coffee lounge.
  room(graphics, 826, y + 12, 206, h - 24, 0xc39b80, 0xf3e9df);
  graphics.roundRect(844, y + 63, 78, 48, 14).fill(0xcaa89c);
  graphics.roundRect(934, y + 68, 78, 43, 14).fill(0xaab4ba);
  graphics.circle(928, y + 74, 28).fill(0xb99470);
  drawCoffeeStation(graphics, 970, y + 30);

  // Channy home corner.
  room(graphics, 1054, y + 12, 170, h - 24, 0xa4b39f, 0xecefe7);
  graphics.roundRect(1070, y + 74, 72, 35, 15).fill(0xb9a5aa);
  graphics.roundRect(1077, y + 81, 58, 21, 10).fill(0xe9d8cf);
  graphics.ellipse(1172, y + 81, 18, 8).fill(0xd9aa6f);
  graphics.ellipse(1172, y + 105, 18, 8).fill(0x9bd5e3);
  graphics.rect(1080, y + 25, 120, 7).fill(0xc8d6c4);
}

function drawMainWalkway(graphics: PixelGraphicsPort, layout: PixelWorldLayout): void {
  const walkway = layout.mainWalkway;
  graphics.roundRect(walkway.x, walkway.y, walkway.width, walkway.height, 14)
    .fill(0xd2cdc4)
    .stroke({ color: 0xa8a19a, width: 2 });
  for (let x = walkway.x + 20; x < walkway.x + walkway.width - 20; x += 54) {
    graphics.rect(x, walkway.y + walkway.height / 2 - 2, 28, 4).fill({ color: 0xfaf6ee, alpha: 0.82 });
  }
}

function drawPod(
  graphics: PixelGraphicsPort,
  layout: PixelWorldLayout['pods'][number],
  pod: PixelPodInput,
  selected: boolean,
): void {
  const color = pod.projectIdentity.primaryColor;
  const secondary = pod.projectIdentity.secondaryColor;
  graphics.roundRect(layout.x, layout.y, layout.width, layout.height, 7)
    .fill({ color: 0xf2efe9, alpha: 0.96 })
    .stroke({ color: selected ? secondary : 0x99938d, width: selected ? 4 : 2 });
  graphics.rect(layout.x + 9, layout.y + 9, layout.width - 18, layout.height - 18)
    .fill({ color, alpha: selected ? 0.22 : 0.12 });
  drawRug(graphics, layout.x + 26, layout.y + 55, layout.width - 52, layout.height - 76, color, pod.projectIdentity.pattern);
  drawProjectSign(graphics, layout.x + 18, layout.y + 14, layout.width - 36, color, secondary, pod.projectIdentity.pattern);
  drawMissionBoard(graphics, layout.x + layout.width - 70, layout.y + 46, pod, color);
  drawDesk(graphics, layout.deskAnchor.x - 47, layout.deskAnchor.y - 28, color);
  drawDesk(graphics, layout.deskAnchor.x + 14, layout.deskAnchor.y - 28, secondary);
  drawLamp(graphics, layout.x + 23, layout.y + layout.height - 51, secondary);
}

function drawProjectSign(
  graphics: PixelGraphicsPort,
  x: number,
  y: number,
  width: number,
  color: number,
  secondary: number,
  pattern: PixelPodInput['projectIdentity']['pattern'],
): void {
  graphics.roundRect(x, y, width, 24, 5).fill(0x56595d).stroke({ color, width: 2 });
  graphics.rect(x + 8, y + 7, width - 16, 10).fill(color);
  if (pattern === 'DOTS' || pattern === 'CHECKS') {
    for (let px = x + 12; px < x + width - 12; px += 18) graphics.rect(px, y + 9, 5, 5).fill(secondary);
  } else if (pattern === 'BANDS' || pattern === 'GRID') {
    for (let px = x + 12; px < x + width - 12; px += 24) graphics.rect(px, y + 7, 5, 10).fill(secondary);
  } else {
    for (let px = x + 12; px < x + width - 12; px += 16) graphics.rect(px, y + 11, 8, 2).fill(secondary);
  }
}

function drawMissionBoard(graphics: PixelGraphicsPort, x: number, y: number, pod: PixelPodInput, color: number): void {
  graphics.roundRect(x, y, 50, 52, 4).fill(0xfaf7f0).stroke({ color: 0x777a7d, width: 2 });
  graphics.rect(x + 6, y + 7, 38, 5).fill(color);
  const workProgress = Math.round(36 * pod.completedWorkUnits / pod.totalWorkUnits);
  const gateProgress = Math.round(36 * pod.completedGates / pod.totalGates);
  graphics.rect(x + 7, y + 21, 36, 5).fill(0xd5d0c8);
  graphics.rect(x + 7, y + 21, workProgress, 5).fill(0x6fa6b2);
  graphics.rect(x + 7, y + 33, 36, 5).fill(0xd5d0c8);
  graphics.rect(x + 7, y + 33, gateProgress, 5).fill(0xc88a50);
  graphics.rect(x + 7, y + 44, 18, 3).fill(0x777a7d);
}

function drawDesk(graphics: PixelGraphicsPort, x: number, y: number, accent: number): void {
  graphics.roundRect(x, y, 52, 26, 5).fill(0xc7a276).stroke({ color: 0x85817d, width: 2 });
  graphics.rect(x + 4, y + 22, 5, 30).fill(0x81756b);
  graphics.rect(x + 43, y + 22, 5, 30).fill(0x81756b);
  drawMonitor(graphics, x + 16, y - 17, accent);
  graphics.rect(x + 14, y + 8, 25, 6).fill(0x5a5d60);
  for (let key = 0; key < 5; key += 1) graphics.rect(x + 17 + key * 4, y + 10, 2, 2).fill(0xd4e3e6);
}

function drawMonitor(graphics: PixelGraphicsPort, x: number, y: number, glow: number): void {
  graphics.roundRect(x, y, 30, 23, 3).fill(0x56595d).stroke({ color: 0x777a7d, width: 2 });
  graphics.rect(x + 4, y + 4, 22, 14).fill({ color: glow, alpha: 0.86 });
  graphics.rect(x + 13, y + 23, 4, 6).fill(0x686b6e);
  graphics.rect(x + 8, y + 28, 14, 3).fill(0x686b6e);
}

function drawRug(
  graphics: PixelGraphicsPort,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  pattern: PixelPodInput['projectIdentity']['pattern'],
): void {
  graphics.roundRect(x, y, width, height, 8).fill({ color, alpha: 0.27 });
  if (pattern === 'DOTS' || pattern === 'CROSS') {
    for (let py = y + 10; py < y + height - 6; py += 20) {
      for (let px = x + 10; px < x + width - 6; px += 20) graphics.rect(px, py, 4, 4).fill({ color, alpha: 0.6 });
    }
  } else {
    for (let py = y + 10; py < y + height - 5; py += 14) graphics.rect(x + 8, py, width - 16, 2).fill({ color, alpha: 0.48 });
  }
}

function room(
  graphics: PixelGraphicsPort,
  x: number,
  y: number,
  width: number,
  height: number,
  accent: number,
  fill: number,
): void {
  graphics.roundRect(x, y, width, height, 8)
    .fill({ color: fill, alpha: 0.9 })
    .stroke({ color: accent, width: 2, alpha: 0.88 });
}

function drawCoffeeStation(graphics: PixelGraphicsPort, x: number, y: number): void {
  graphics.roundRect(x, y, 30, 43, 5).fill(0x707477);
  graphics.rect(x + 6, y + 7, 18, 11).fill(0xa5ccd5);
  graphics.rect(x + 11, y + 23, 8, 11).fill(0xe5c89d);
  graphics.rect(x + 5, y + 38, 20, 4).fill(0x535659);
}

function drawLamp(graphics: PixelGraphicsPort, x: number, y: number, glow: number): void {
  graphics.rect(x + 8, y + 13, 3, 29).fill(0x77726d);
  graphics.circle(x + 10, y + 8, 11).fill({ color: glow, alpha: 0.8 });
  graphics.circle(x + 10, y + 8, 17).fill({ color: glow, alpha: 0.08 });
}

function drawPlants(graphics: PixelGraphicsPort, layout: PixelWorldLayout): void {
  for (const x of [28, 300, 640, 812, 1038, layout.width - 42]) {
    const y = layout.mainWalkway.y + layout.mainWalkway.height + 8;
    graphics.roundRect(x, y + 22, 22, 20, 5).fill(0xb38465);
    graphics.circle(x + 11, y + 14, 12).fill(0x5f8f68);
    graphics.circle(x + 4, y + 8, 7).fill(0x83a67c);
    graphics.circle(x + 18, y + 6, 8).fill(0x83a67c);
  }
}
