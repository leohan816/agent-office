import { Application, extend, useTick } from '@pixi/react';
import { Container, Graphics, Sprite, Texture, VERSION } from 'pixi.js';
import { createElement, forwardRef } from 'react';

const CONTRACT_ID = 'agent-office.pixi-public-export-bridge.v1';
const EXPECTED_PIXI_REACT_VERSION = '8.0.5';
const EXPECTED_PIXI_JS_VERSION = '8.19.0';
const VALUE_NAMES = Object.freeze([
  'Application',
  'extend',
  'useTick',
  'Container',
  'Graphics',
  'Sprite',
  'Texture',
  'VERSION',
]);

assertComponent(Application, 'Application');
assertFunction(extend, 'extend');
assertFunction(useTick, 'useTick');
assertFunction(createElement, 'createElement');
assertFunction(forwardRef, 'forwardRef');
assertConstructor(Container, 'Container');
assertConstructor(Graphics, 'Graphics');
assertConstructor(Sprite, 'Sprite');
assertObjectOrFunction(Texture, 'Texture');
assertFunction(Texture.from, 'Texture.from');
assert(VERSION === EXPECTED_PIXI_JS_VERSION, `VERSION must equal ${EXPECTED_PIXI_JS_VERSION}`);

extend({ Container, Graphics, Sprite });

export const PIXEL_PUBLIC_EXPORT_RUNTIME = Object.freeze({
  contractId: CONTRACT_ID,
  expectedPixiReactVersion: EXPECTED_PIXI_REACT_VERSION,
  expectedPixiJsVersion: EXPECTED_PIXI_JS_VERSION,
  actualPixiJsVersion: VERSION,
  valueNames: VALUE_NAMES,
});

export const PixelApplication = forwardRef(function PixelApplication(
  { onInit, ...applicationProps },
  forwardedRef,
) {
  assertFunction(onInit, 'PixelApplication.onInit');
  return createElement(Application, {
    ...applicationProps,
    onInit(application) {
      onInit(assertApplication(application));
    },
    ref(value) {
      assignRef(forwardedRef, value === null ? null : applicationRef(value));
    },
  });
});

export const PixelContainer = forwardRef(function PixelContainer(
  { children },
  forwardedRef,
) {
  return createElement('pixiContainer', {
    children,
    ref(value) {
      assignRef(forwardedRef, value === null ? null : assertContainer(value));
    },
  });
});

export const PixelGraphics = forwardRef(function PixelGraphics(
  { draw },
  forwardedRef,
) {
  assertFunction(draw, 'PixelGraphics.draw');
  return createElement('pixiGraphics', {
    draw(graphics) {
      draw(assertGraphics(graphics));
    },
    ref(value) {
      assignRef(forwardedRef, value === null ? null : assertGraphics(value));
    },
  });
});

export function PixelSprite({ roundPixels, texture }) {
  assert(typeof roundPixels === 'boolean', 'PixelSprite.roundPixels must be boolean');
  return createElement('pixiSprite', {
    roundPixels,
    texture: assertTexture(texture),
  });
}

export function createPixelTexture(source) {
  assert(source instanceof globalThis.HTMLCanvasElement, 'createPixelTexture source must be an HTMLCanvasElement');
  return assertTexture(Texture.from(source));
}

export function usePixelTick({ callback, isEnabled }) {
  assertFunction(callback, 'usePixelTick.callback');
  assert(typeof isEnabled === 'boolean', 'usePixelTick.isEnabled must be boolean');
  useTick({
    callback(ticker) {
      assertObject(ticker, 'ticker');
      assert(Number.isFinite(ticker.deltaMS), 'ticker.deltaMS must be finite');
      callback(Object.freeze({ deltaMS: ticker.deltaMS }));
    },
    isEnabled,
  });
}

function applicationRef(value) {
  assertObject(value, 'Application ref');
  assertFunction(value.getApplication, 'Application ref.getApplication');
  assertFunction(value.getCanvas, 'Application ref.getCanvas');
  return Object.freeze({
    getApplication() {
      const application = value.getApplication();
      return application === null ? null : assertApplication(application);
    },
    getCanvas() {
      const canvas = value.getCanvas();
      assert(canvas === null || canvas instanceof globalThis.HTMLCanvasElement, 'Application ref.getCanvas returned an invalid canvas');
      return canvas;
    },
  });
}

function assertApplication(value) {
  assertObject(value, 'application');
  assert(value.canvas instanceof globalThis.HTMLCanvasElement, 'application.canvas must be an HTMLCanvasElement');
  assertObject(value.ticker, 'application.ticker');
  assertFunction(value.ticker.start, 'application.ticker.start');
  assertFunction(value.ticker.stop, 'application.ticker.stop');
  assert(Number.isFinite(value.ticker.maxFPS), 'application.ticker.maxFPS must be finite');
  assert(Number.isFinite(value.ticker.minFPS), 'application.ticker.minFPS must be finite');
  assertObject(value.renderer, 'application.renderer');
  assertObjectOrFunction(value.renderer.constructor, 'application.renderer.constructor');
  assert(typeof value.renderer.constructor.name === 'string', 'application renderer name must be a string');
  return value;
}

function assertContainer(value) {
  assertObject(value, 'container');
  assertObject(value.position, 'container.position');
  assertFunction(value.position.set, 'container.position.set');
  assertObject(value.scale, 'container.scale');
  assertFunction(value.scale.set, 'container.scale.set');
  return value;
}

function assertGraphics(value) {
  assertObject(value, 'graphics');
  for (const method of [
    'clear',
    'rect',
    'roundRect',
    'ellipse',
    'circle',
    'moveTo',
    'lineTo',
    'fill',
    'stroke',
  ]) assertFunction(value[method], `graphics.${method}`);
  return value;
}

function assertTexture(value) {
  assertObject(value, 'texture');
  assertObject(value.source, 'texture.source');
  assert(typeof value.source.scaleMode === 'string', 'texture.source.scaleMode must be a string');
  assertFunction(value.destroy, 'texture.destroy');
  return value;
}

function assignRef(ref, value) {
  if (typeof ref === 'function') ref(value);
  else if (ref !== null && typeof ref === 'object') ref.current = value;
}

function assertComponent(value, name) {
  assert(value !== null && (typeof value === 'function' || typeof value === 'object'), `${name} must be a React component value`);
}

function assertConstructor(value, name) {
  assert(typeof value === 'function', `${name} must be a constructor function`);
}

function assertFunction(value, name) {
  assert(typeof value === 'function', `${name} must be a function`);
}

function assertObject(value, name) {
  assert(value !== null && typeof value === 'object', `${name} must be an object`);
}

function assertObjectOrFunction(value, name) {
  assert(value !== null && (typeof value === 'object' || typeof value === 'function'), `${name} must be an object or function`);
}

function assert(condition, message) {
  if (!condition) throw new TypeError(`PIXEL_PUBLIC_EXPORT_COMPATIBILITY_ERROR: ${message}`);
}
