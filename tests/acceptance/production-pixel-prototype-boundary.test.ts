import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { build } from 'vite';
import { beforeAll, describe, expect, it } from 'vitest';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..');
const PROTOTYPE_MARKERS = [
  'agent-office.living-pixel-prototype.synthetic.v1',
  'SYNTHETIC PROTOTYPE',
  'prototype.full-office.v1',
  'prototype.advisor-handoff.v1',
  'Replay 26-second office tour',
  'agent-office-living-office-prototype.webm',
] as const;
const OFFICE_CHUNK_FACADE = path.join(REPOSITORY_ROOT, 'src/ui/pixel/production-pixel-office-chunk.tsx');
const INDEX_HTML = path.join(REPOSITORY_ROOT, 'index.html');
const MAIN_ENTRY = path.join(REPOSITORY_ROOT, 'src/ui/main.tsx');

interface Chunk {
  readonly type: string;
  readonly fileName: string;
  readonly isEntry: boolean;
  readonly facadeModuleId: string | null;
  readonly code: string;
  readonly modules: Readonly<Record<string, unknown>>;
  readonly imports: readonly string[];
  readonly dynamicImports: readonly string[];
}

let productionChunks: readonly Chunk[] = [];

// CD-3 / PR-4 / PRC-8: one exact Vite 8.1.4 in-memory build; normalize fail-closed (reject a watcher).
async function buildInMemory(mode: 'production' | 'test-demo'): Promise<readonly Chunk[]> {
  const output = await build({
    root: REPOSITORY_ROOT,
    configFile: path.join(REPOSITORY_ROOT, 'vite.config.ts'),
    mode,
    logLevel: 'silent',
    build: { write: false },
  });
  const outputs = Array.isArray(output) ? output : [output];
  for (const single of outputs) {
    if (!('output' in single)) {
      throw new Error('CD-3 build returned a watcher, not a RolldownOutput');
    }
  }
  return outputs.flatMap((single) => (single as { readonly output: readonly Chunk[] }).output)
    .filter((entry): entry is Chunk => entry.type === 'chunk');
}

function isPixiChunk(chunk: Chunk): boolean {
  return Object.keys(chunk.modules).some((moduleId) => /@pixi|pixi\.js/u.test(moduleId));
}

function staticClosure(entry: Chunk, byFile: ReadonlyMap<string, Chunk>): readonly Chunk[] {
  const seen = new Set<string>();
  const stack = [entry.fileName];
  while (stack.length > 0) {
    const fileName = stack.pop();
    if (fileName === undefined || seen.has(fileName)) continue;
    seen.add(fileName);
    for (const next of byFile.get(fileName)?.imports ?? []) stack.push(next);
  }
  return [...seen].map((fileName) => byFile.get(fileName)).filter((chunk): chunk is Chunk => chunk !== undefined);
}

function reachableClosure(entry: Chunk, byFile: ReadonlyMap<string, Chunk>): ReadonlySet<string> {
  const seen = new Set<string>();
  const stack = [entry.fileName];
  while (stack.length > 0) {
    const fileName = stack.pop();
    if (fileName === undefined || seen.has(fileName)) continue;
    seen.add(fileName);
    const chunk = byFile.get(fileName);
    for (const next of [...(chunk?.imports ?? []), ...(chunk?.dynamicImports ?? [])]) stack.push(next);
  }
  return seen;
}

// A tree-shaking-independent static-import walker over the source graph (relative `from` imports only;
// dynamic `import('…')` edges are NOT followed).
async function staticSourceGraph(entryFiles: readonly string[]): Promise<ReadonlyMap<string, string>> {
  const graph = new Map<string, string>();
  const stack = [...entryFiles];
  while (stack.length > 0) {
    const file = stack.pop();
    if (file === undefined || graph.has(file)) continue;
    const source = await readSource(file);
    if (source === null) continue;
    graph.set(file, source);
    for (const spec of [...source.matchAll(/(?:import|export)\b[^;]*?\bfrom\s*['"](\.[^'"]+)['"]/gu)]) {
      const resolved = await resolveSource(file, spec[1] ?? '');
      if (resolved !== null) stack.push(resolved);
    }
  }
  return graph;
}

async function readSource(file: string): Promise<string | null> {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return null;
  }
}

async function resolveSource(fromFile: string, spec: string): Promise<string | null> {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const candidate of [base.replace(/\.js$/u, '.ts'), base.replace(/\.js$/u, '.tsx'), base]) {
    if (await readSource(candidate) !== null) return candidate;
  }
  return null;
}

async function collectFiles(root: string, extension: string): Promise<readonly string[]> {
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(candidate, extension));
    else if (entry.isFile() && entry.name.endsWith(extension)) files.push(candidate);
  }
  return files.sort();
}

describe('living pixel-office production graph isolation (CD-3 / PR-4)', () => {
  beforeAll(async () => {
    productionChunks = await buildInMemory('production');
  });

  it('(a) keeps the eager shell + fallback source graph free of static Pixi / render-chain imports', async () => {
    // main.tsx imports the virtual entry (resolved to runtime/entry.tsx); walk both eager roots.
    const graph = await staticSourceGraph([MAIN_ENTRY, path.join(REPOSITORY_ROOT, 'src/ui/runtime/entry.tsx')]);
    expect(graph.has(path.join(REPOSITORY_ROOT, 'src/ui/runtime/runtime-app.tsx'))).toBe(true);
    expect(graph.has(path.join(REPOSITORY_ROOT, 'src/ui/runtime/client.ts'))).toBe(true);
    for (const [file, source] of graph) {
      const relative = file.replace(`${REPOSITORY_ROOT}/`, '');
      expect(source, relative).not.toMatch(/from\s*['"](?:@pixi\/react|pixi\.js)['"]/u);
      const staticSpecs = [...source.matchAll(/(?:import|export)\b[^;]*?\bfrom\s*['"](\.[^'"]+)['"]/gu)]
        .map((match) => match[1] ?? '');
      for (const spec of staticSpecs) {
        expect(spec, `${relative} statically imports ${spec}`)
          .not.toMatch(/production-pixel-|pixel-world-|pixel-frame-|\/frame-|frame-core|fixtures\/prototype-/u);
      }
    }
  });

  it('(b) confines Pixi to the dynamic Office chunk subtree; the eager entry closure is Pixi-free', () => {
    const byFile = new Map(productionChunks.map((chunk) => [chunk.fileName, chunk]));
    const eager = productionChunks.find((chunk) => chunk.isEntry && chunk.facadeModuleId === INDEX_HTML);
    const office = productionChunks.find((chunk) => chunk.facadeModuleId === OFFICE_CHUNK_FACADE);
    expect(eager, 'eager entry chunk with the index.html facade').toBeDefined();
    expect(office, 'production Office chunk facade').toBeDefined();
    if (eager === undefined || office === undefined) return;

    // FDR-3: main.tsx is a module INSIDE the eager chunk, not the facade (index.html is the facade).
    expect(Object.keys(eager.modules).some((moduleId) => moduleId.endsWith('/src/ui/main.tsx'))).toBe(true);
    expect(eager.facadeModuleId).toBe(INDEX_HTML);

    // The eager entry reaches the Office renderer ONLY through a dynamic-import edge.
    expect(eager.dynamicImports).toContain(office.fileName);
    const eagerStatic = staticClosure(eager, byFile);
    expect(eagerStatic.some((chunk) => isPixiChunk(chunk)), 'no Pixi in the eager static-import closure').toBe(false);
    expect([...eagerStatic].flatMap((chunk) => Object.keys(chunk.modules))
      .some((moduleId) => /production-pixel-|pixel-world-|pixel-frame-|\/frame-|fixtures\/prototype-/u.test(moduleId)))
      .toBe(false);

    // Every Pixi-bearing chunk is reachable only within the subtree rooted at the Office chunk facade.
    const officeSubtree = reachableClosure(office, byFile);
    for (const chunk of productionChunks) {
      if (isPixiChunk(chunk)) expect(officeSubtree.has(chunk.fileName), `${chunk.fileName} outside Office subtree`).toBe(true);
    }
  });

  it('(c) excludes every prototype FIXTURE marker from production and labels the Office truthfully', () => {
    const bundle = productionChunks.map((chunk) => chunk.code).join('\n');
    // Every prototype fixture identity/behaviour marker MUST be absent from production output — with no
    // exemption or filter. The prototype fixtures/timeline are never in the production graph, and the
    // shared HUD embeds no prototype default: the eyebrow is carried by the producing projector, so the
    // authenticated Office supplies its own truthful eyebrow and "SYNTHETIC PROTOTYPE" never reaches
    // production. `PIXEL_PROTOTYPE_FIXTURE_ID` is asserted by its committed value (the first marker).
    for (const marker of [...PROTOTYPE_MARKERS, 'fixtures/prototype-']) {
      expect(bundle, marker).not.toContain(marker);
    }
    const office = productionChunks.find((chunk) => chunk.facadeModuleId === OFFICE_CHUNK_FACADE);
    expect(office?.code, 'production Office renders its own truthful eyebrow')
      .toContain('AUTHENTICATED LIVING OFFICE');
  });

  it('(d) roots the production render graph fixture-free (no frame-projector / prototype-fixture edge)', async () => {
    const graph = await staticSourceGraph([OFFICE_CHUNK_FACADE]);
    const relatives = [...graph.keys()].map((file) => file.replace(`${REPOSITORY_ROOT}/`, ''));
    // The production chain is present and shares only the fixture-free primitives.
    expect(relatives).toContain('src/ui/pixel/production-frame-projector.ts');
    expect(relatives).toContain('src/ui/pixel/frame-core.ts');
    expect(relatives).toContain('src/ui/pixel/pixel-frame-stage.tsx');
    // The resolved static graph rooted at the Office chunk never reaches the prototype projector or
    // any prototype fixture module (tree-shaking-independent; membership, not source-text search).
    expect(relatives.some((relative) => relative.endsWith('src/ui/pixel/frame-projector.ts'))).toBe(false);
    expect(relatives.some((relative) => relative.includes('fixtures/prototype-'))).toBe(false);
  });

  it('emits the prototype only in test-demo and keeps its lazy chunk below 300KiB gzip', async () => {
    const outputRoot = await mkdtemp(path.join(tmpdir(), 'agent-office-pixel-test-demo-'));
    try {
      await build({
        root: REPOSITORY_ROOT,
        configFile: path.join(REPOSITORY_ROOT, 'vite.config.ts'),
        mode: 'test-demo',
        logLevel: 'silent',
        build: { outDir: outputRoot, emptyOutDir: true },
      });
      const javaScriptFiles = await collectFiles(outputRoot, '.js');
      const chunks = await Promise.all(javaScriptFiles.map(async (file) => ({ file, bytes: await readFile(file) })));
      const prototypeChunks = chunks.filter(({ bytes }) =>
        bytes.includes(Buffer.from('agent-office.living-pixel-prototype.synthetic.v1')));
      expect(prototypeChunks).toHaveLength(1);
      expect(gzipSync(prototypeChunks[0]?.bytes ?? Buffer.alloc(0), { level: 9 }).byteLength)
        .toBeLessThanOrEqual(300 * 1024);
    } finally {
      await rm(outputRoot, { recursive: true, force: true });
    }
  });

  it('pins exactly the reviewed public-root dependencies', async () => {
    const packageDocument = JSON.parse(await readFile(
      path.join(REPOSITORY_ROOT, 'package.json'),
      'utf8',
    )) as { readonly dependencies?: Readonly<Record<string, string>> };
    expect(packageDocument.dependencies?.['pixi.js']).toBe('8.19.0');
    expect(packageDocument.dependencies?.['@pixi/react']).toBe('8.0.5');
    expect(packageDocument.dependencies?.react).toBe('19.2.7');
    expect(packageDocument.dependencies?.['react-dom']).toBe('19.2.7');
  });
});
