import type {
  ComponentType,
  ForwardRefExoticComponent,
  ReactNode,
  RefAttributes,
} from 'react';
import type {
  PixelApplicationPort,
  PixelContainerPort,
} from './contracts.js';

export interface PixelApplicationRefPort {
  getApplication(): PixelApplicationPort | null;
  getCanvas(): HTMLCanvasElement | null;
}

export interface PixelApplicationProps {
  readonly children: ReactNode;
  readonly antialias: boolean;
  readonly autoDensity: boolean;
  readonly autoStart: boolean;
  readonly backgroundColor: number;
  readonly className: string;
  readonly preference: 'canvas' | readonly ['webgl', 'canvas'];
  readonly resizeTo: { readonly current: HTMLDivElement | null };
  readonly resolution: number;
  readonly sharedTicker: boolean;
  readonly onInit: (application: PixelApplicationPort) => void;
}

export interface PixelBridgeGraphicsPort {
  clear(): PixelBridgeGraphicsPort;
  rect(x: number, y: number, width: number, height: number): PixelBridgeGraphicsPort;
  roundRect(x: number, y: number, width: number, height: number, radius: number): PixelBridgeGraphicsPort;
  ellipse(x: number, y: number, radiusX: number, radiusY: number): PixelBridgeGraphicsPort;
  circle(x: number, y: number, radius: number): PixelBridgeGraphicsPort;
  moveTo(x: number, y: number): PixelBridgeGraphicsPort;
  lineTo(x: number, y: number): PixelBridgeGraphicsPort;
  fill(style: number | { readonly color: number; readonly alpha?: number }): PixelBridgeGraphicsPort;
  stroke(style: { readonly color: number; readonly width: number; readonly alpha?: number }): PixelBridgeGraphicsPort;
}

export interface PixelTexturePort {
  readonly source: { scaleMode: string };
  destroy(destroySource?: boolean): void;
}

export interface PixelTickPort {
  readonly deltaMS: number;
}

export interface PixelTickOptions {
  readonly callback: (ticker: PixelTickPort) => void;
  readonly isEnabled: boolean;
}

export interface PixelContainerProps {
  readonly children?: ReactNode;
}

export interface PixelGraphicsProps {
  readonly draw: (graphics: PixelBridgeGraphicsPort) => void;
}

export interface PixelSpriteProps {
  readonly roundPixels: boolean;
  readonly texture: PixelTexturePort;
}

export interface PixelPublicExportRuntime {
  readonly contractId: 'agent-office.pixi-public-export-bridge.v1';
  readonly expectedPixiReactVersion: '8.0.5';
  readonly expectedPixiJsVersion: '8.19.0';
  readonly actualPixiJsVersion: '8.19.0';
  readonly valueNames: readonly [
    'Application', 'extend', 'useTick', 'Container',
    'Graphics', 'Sprite', 'Texture', 'VERSION',
  ];
}

export const PixelApplication: ForwardRefExoticComponent<
  PixelApplicationProps & RefAttributes<PixelApplicationRefPort>
>;
export const PixelContainer: ForwardRefExoticComponent<
  PixelContainerProps & RefAttributes<PixelContainerPort>
>;
export const PixelGraphics: ForwardRefExoticComponent<
  PixelGraphicsProps & RefAttributes<PixelBridgeGraphicsPort>
>;
export const PixelSprite: ComponentType<PixelSpriteProps>;
export const PIXEL_PUBLIC_EXPORT_RUNTIME: PixelPublicExportRuntime;
export function createPixelTexture(source: HTMLCanvasElement): PixelTexturePort;
export function usePixelTick(options: PixelTickOptions): void;
