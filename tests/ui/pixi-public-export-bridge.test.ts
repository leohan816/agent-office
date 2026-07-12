import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const bridgePath = path.join(root, 'src/ui/pixel/pixi-public-export-bridge.js');
const declarationPath = path.join(root, 'src/ui/pixel/pixi-public-export-bridge.d.ts');
const pixelRoot = path.join(root, 'src/ui/pixel');

let bridge = '';
let declaration = '';
let boundary = '';
let packageDocument: PackageDocument;
let lockDocument: LockDocument;
let tsconfigDocument: TsconfigDocument;
let batchGate = '';
let executablePixelSources: readonly SourceDocument[] = [];
let vite: ViteDevServer;

interface PackageDocument {
  readonly dependencies: Record<string, string>;
  readonly devDependencies: Record<string, string>;
}

interface LockDocument {
  readonly packages: Record<string, { readonly version?: string }>;
}

interface TsconfigDocument {
  readonly compilerOptions: Record<string, unknown>;
}

interface SourceDocument {
  readonly path: string;
  readonly source: string;
}

beforeAll(async () => {
  [
    bridge,
    declaration,
    boundary,
    batchGate,
    packageDocument,
    lockDocument,
    tsconfigDocument,
    executablePixelSources,
  ] = await Promise.all([
    readFile(bridgePath, 'utf8'),
    readFile(declarationPath, 'utf8'),
    readFile(path.join(pixelRoot, 'renderer-boundary.tsx'), 'utf8'),
    readFile(path.join(root, 'tests/acceptance/batch-gates.test.ts'), 'utf8'),
    readJson<PackageDocument>('package.json'),
    readJson<LockDocument>('package-lock.json'),
    readJson<TsconfigDocument>('tsconfig.json'),
    collectExecutableSources(pixelRoot),
  ]);
  vite = await createServer({
    root,
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });
});

afterAll(async () => {
  await vite.close();
});

describe('Pixi public-export compatibility bridge contract', () => {
  it('imports Pixi runtime values only from the two literal public roots', () => {
    expect(bridge).toContain("from '@pixi/react'");
    expect(bridge).toContain("from 'pixi.js'");
    expect(bridge).not.toMatch(/from ['"](?:@pixi\/react|pixi\.js)\//u);
  });

  it('is the only executable pixel source that imports either Pixi package', () => {
    const importers = executablePixelSources
      .filter(({ source }) => /from ['"](?:@pixi\/react|pixi\.js)['"]/u.test(source))
      .map(({ path: sourcePath }) => sourcePath);
    expect(importers).toEqual(['src/ui/pixel/pixi-public-export-bridge.js']);
  });

  it('contains no relative node_modules import or package-internal Pixi import', () => {
    const combined = executablePixelSources.map(({ source }) => source).join('\n');
    expect(combined).not.toMatch(/node_modules|from ['"]@pixi\/react\/|from ['"]pixi\.js\//u);
  });

  it('contains no TypeScript diagnostic suppression in the pixel graph', () => {
    const combined = executablePixelSources.map(({ source }) => source).join('\n');
    expect(combined).not.toMatch(/@ts-(?:expect-error|ignore)/u);
  });

  it('exports the exact frozen runtime identity and value-name order', () => {
    expect(bridge).toContain("const CONTRACT_ID = 'agent-office.pixi-public-export-bridge.v1'");
    expect(bridge).toContain("const EXPECTED_PIXI_REACT_VERSION = '8.0.5'");
    expect(bridge).toContain("const EXPECTED_PIXI_JS_VERSION = '8.19.0'");
    expect(bridge).toContain('export const PIXEL_PUBLIC_EXPORT_RUNTIME = Object.freeze({');
    const valueNames = /const VALUE_NAMES = Object\.freeze\(\[([\s\S]*?)\]\);/u.exec(bridge)?.[1]
      ?.match(/'[A-Za-z]+'/gu);
    expect(valueNames).toEqual([
      "'Application'", "'extend'", "'useTick'", "'Container'",
      "'Graphics'", "'Sprite'", "'Texture'", "'VERSION'",
    ]);
  });

  it('exports only the bounded application, host, texture, ticker and identity surface', () => {
    const exports = [...bridge.matchAll(/export (?:const|function) ([A-Za-z0-9_]+)/gu)]
      .map((match) => match[1]);
    expect(exports).toEqual([
      'PIXEL_PUBLIC_EXPORT_RUNTIME',
      'PixelApplication',
      'PixelContainer',
      'PixelGraphics',
      'PixelSprite',
      'createPixelTexture',
      'usePixelTick',
    ]);
  });

  it('declares the exact reviewed public export names', () => {
    const valueExports = [...declaration.matchAll(/export (?:const|function) ([A-Za-z0-9_]+)/gu)]
      .map((match) => match[1]);
    expect(valueExports).toEqual([
      'PixelApplication',
      'PixelContainer',
      'PixelGraphics',
      'PixelSprite',
      'PIXEL_PUBLIC_EXPORT_RUNTIME',
      'createPixelTexture',
      'usePixelTick',
    ]);
  });

  it('keeps the declaration independent from Pixi vendor declarations', () => {
    expect(declaration).not.toMatch(/@pixi\/react|pixi\.js|node_modules/u);
    expect(declaration).toContain("from './contracts.js'");
  });

  it('contains no broad declaration escape hatch', () => {
    expect(declaration).not.toMatch(/\bany\b|declare module|declare global|\[[^\]]+\s*:\s*(?:string|number)\]/u);
    expect(declaration).not.toMatch(/@ts-(?:expect-error|ignore)/u);
  });

  it('pins the installed public-root packages exactly', () => {
    expect(packageDocument.dependencies['@pixi/react']).toBe('8.0.5');
    expect(packageDocument.dependencies['pixi.js']).toBe('8.19.0');
  });

  it('pins both public-root packages in the lockfile exactly', () => {
    expect(lockDocument.packages['node_modules/@pixi/react']?.version).toBe('8.0.5');
    expect(lockDocument.packages['node_modules/pixi.js']?.version).toBe('8.19.0');
  });

  it('preserves TypeScript 6.0.3 and strict vendor checking', () => {
    expect(packageDocument.devDependencies.typescript).toBe('6.0.3');
    expect(tsconfigDocument.compilerOptions.skipLibCheck).toBe(false);
    expect(tsconfigDocument.compilerOptions.strict).toBe(true);
  });

  it('keeps the runtime dependency gate as exact equality over five pins', () => {
    for (const pair of [
      "'@pixi/react': '8.0.5'",
      "'lucide-react': '1.24.0'",
      "'pixi.js': '8.19.0'",
      "react: '19.2.7'",
      "'react-dom': '19.2.7'",
    ]) expect(batchGate).toContain(pair);
    expect(batchGate).toContain('expect(packageJson.dependencies).toEqual({');
  });

  it('validates all public-root component and hook values at initialization', () => {
    for (const value of ['Application', 'extend', 'useTick', 'createElement', 'forwardRef']) {
      expect(bridge).toMatch(new RegExp(`assert(?:Component|Function)\\(${value}, '${value}'\\)`, 'u'));
    }
  });

  it('validates exactly the three registered constructors', () => {
    for (const value of ['Container', 'Graphics', 'Sprite']) {
      expect(bridge).toContain(`assertConstructor(${value}, '${value}')`);
    }
    expect(bridge.match(/\bextend\(/gu)).toHaveLength(1);
    expect(bridge).toContain('extend({ Container, Graphics, Sprite });');
  });

  it('fails closed on a malformed texture factory or PixiJS version', () => {
    expect(bridge).toContain("assertObjectOrFunction(Texture, 'Texture')");
    expect(bridge).toContain("assertFunction(Texture.from, 'Texture.from')");
    expect(bridge).toContain('VERSION === EXPECTED_PIXI_JS_VERSION');
    expect(bridge).toContain('PIXEL_PUBLIC_EXPORT_COMPATIBILITY_ERROR');
  });

  it('validates the application lifecycle before forwarding onInit', () => {
    for (const token of [
      'application.canvas must be an HTMLCanvasElement',
      'application.ticker.start',
      'application.ticker.stop',
      'application.ticker.maxFPS must be finite',
      'application.ticker.minFPS must be finite',
      "assertObjectOrFunction(value.renderer.constructor, 'application.renderer.constructor')",
      'application renderer name must be a string',
    ]) expect(bridge).toContain(token);
    expect(bridge).toContain('onInit(assertApplication(application));');
  });

  it('validates application ref methods before exposing them', () => {
    expect(bridge).toContain("assertFunction(value.getApplication, 'Application ref.getApplication')");
    expect(bridge).toContain("assertFunction(value.getCanvas, 'Application ref.getCanvas')");
    expect(bridge).toContain('return application === null ? null : assertApplication(application);');
  });

  it('validates the exact bounded container port', () => {
    expect(bridge).toContain("assertFunction(value.position.set, 'container.position.set')");
    expect(bridge).toContain("assertFunction(value.scale.set, 'container.scale.set')");
  });

  it('validates the exact nine-method graphics port', () => {
    const graphicsMethods = bridge.match(/ {4}'(?:clear|rect|roundRect|ellipse|circle|moveTo|lineTo|fill|stroke)',/gu) ?? [];
    expect(graphicsMethods).toHaveLength(9);
    expect(bridge).toContain('draw(assertGraphics(graphics));');
  });

  it('validates texture ownership calls before returning a texture', () => {
    expect(bridge).toContain("assertObject(value.source, 'texture.source')");
    expect(bridge).toContain('texture.source.scaleMode must be a string');
    expect(bridge).toContain("assertFunction(value.destroy, 'texture.destroy')");
  });

  it('rejects a malformed ticker before invoking the prototype callback', () => {
    expect(bridge).toContain('Number.isFinite(ticker.deltaMS)');
    expect(bridge).toContain('callback(Object.freeze({ deltaMS: ticker.deltaMS }));');
  });

  it('routes renderer errors and context loss to the complete DOM-static fallback', () => {
    expect(boundary).toContain("setFallbackReason('RENDERER_CONTEXT_LOST')");
    expect(boundary).toContain("setBackend('DOM_STATIC')");
    expect(boundary).toContain('<PixelRendererErrorBoundary');
    expect(boundary).toContain('<StaticWorldFallback');
  });

  it('resolves and transforms both public roots through the Vite boundary', async () => {
    const [pixiReact, pixi, transformed] = await Promise.all([
      vite.pluginContainer.resolveId('@pixi/react', bridgePath),
      vite.pluginContainer.resolveId('pixi.js', bridgePath),
      vite.transformRequest('/src/ui/pixel/pixi-public-export-bridge.js'),
    ]);
    expect(pixiReact?.id).toMatch(/node_modules\/(?:@pixi\/react\/lib\/index\.mjs|\.vite\/deps\/@pixi_react\.js(?:\?[^ ]*)?)$/u);
    expect(pixi?.id).toMatch(/node_modules\/(?:pixi\.js\/lib\/index\.mjs|\.vite\/deps\/pixi__js\.js(?:\?[^ ]*)?)$/u);
    expect(transformed?.code).toContain('PIXEL_PUBLIC_EXPORT_RUNTIME');
  });
});

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8')) as T;
}

async function collectExecutableSources(directory: string): Promise<readonly SourceDocument[]> {
  const documents: SourceDocument[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) documents.push(...await collectExecutableSources(absolutePath));
    else if (entry.isFile() && /\.(?:js|ts|tsx)$/u.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      documents.push({
        path: path.relative(root, absolutePath).split(path.sep).join('/'),
        source: await readFile(absolutePath, 'utf8'),
      });
    }
  }
  return documents.sort((left, right) => left.path.localeCompare(right.path, 'en'));
}
