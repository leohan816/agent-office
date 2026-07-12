import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';
import { build } from 'vite';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..');
const DESIGN_BASE = '9611d0da1479ca5e7a9677641fe767a6b39b4a38';
const PROTOTYPE_MARKERS = [
  'agent-office.living-pixel-prototype.synthetic.v1',
  'SYNTHETIC PROTOTYPE',
  'prototype.full-office.v1',
  'prototype.advisor-handoff.v1',
  'Replay 26-second office tour',
  'agent-office-living-office-prototype.webm',
] as const;

describe('living pixel-office production graph isolation', () => {
  it('emits zero Pixi, fixture, timeline and media markers in a fresh production build', async () => {
    const outputRoot = await mkdtemp(path.join(tmpdir(), 'agent-office-pixel-production-'));
    try {
      await build({
        root: REPOSITORY_ROOT,
        configFile: path.join(REPOSITORY_ROOT, 'vite.config.ts'),
        mode: 'production',
        logLevel: 'silent',
        build: { outDir: outputRoot, emptyOutDir: true },
      });
      const javaScriptFiles = await collectFiles(outputRoot, '.js');
      const bundle = (await Promise.all(javaScriptFiles.map((file) => readFile(file, 'utf8')))).join('\n');
      for (const marker of [...PROTOTYPE_MARKERS, '@pixi/react', 'pixi.js']) {
        expect(bundle, marker).not.toContain(marker);
      }
    } finally {
      await rm(outputRoot, { recursive: true, force: true });
    }
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
      const chunks = await Promise.all(javaScriptFiles.map(async (file) => ({
        file,
        bytes: await readFile(file),
      })));
      const prototypeChunks = chunks.filter(({ bytes }) =>
        bytes.includes(Buffer.from('agent-office.living-pixel-prototype.synthetic.v1')));
      expect(prototypeChunks).toHaveLength(1);
      expect(gzipSync(prototypeChunks[0]?.bytes ?? Buffer.alloc(0), { level: 9 }).byteLength)
        .toBeLessThanOrEqual(300 * 1024);
    } finally {
      await rm(outputRoot, { recursive: true, force: true });
    }
  });

  it('pins exactly the reviewed dependencies and leaves production source fixture-free', async () => {
    const packageDocument = JSON.parse(await readFile(
      path.join(REPOSITORY_ROOT, 'package.json'),
      'utf8',
    )) as { readonly dependencies?: Readonly<Record<string, string>> };
    expect(packageDocument.dependencies?.['pixi.js']).toBe('8.19.0');
    expect(packageDocument.dependencies?.['@pixi/react']).toBe('8.0.5');
    expect(packageDocument.dependencies?.react).toBe('19.2.7');
    expect(packageDocument.dependencies?.['react-dom']).toBe('19.2.7');
    for (const source of [
      'src/ui/runtime/entry.tsx',
      'src/ui/runtime/runtime-app.tsx',
      'src/ui/dashboard.tsx',
    ]) {
      const content = await readFile(path.join(REPOSITORY_ROOT, source), 'utf8');
      expect(content).not.toMatch(/ui\/pixel|pixel\/fixtures|living-pixel-prototype|@pixi\/react|pixi\.js/u);
    }
    const productionDelta = spawnSync('git', [
      'diff', '--name-only', DESIGN_BASE, '--',
      'src/ui/runtime/entry.tsx', 'src/ui/runtime/runtime-app.tsx',
      'src/ui/dashboard.tsx', 'vite.config.ts', 'index.html',
    ], { cwd: REPOSITORY_ROOT, encoding: 'utf8' });
    expect(productionDelta.status).toBe(0);
    expect(productionDelta.stdout.trim()).toBe('');
  });
});

async function collectFiles(root: string, extension: string): Promise<readonly string[]> {
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(candidate, extension));
    else if (entry.isFile() && entry.name.endsWith(extension)) files.push(candidate);
  }
  return files.sort();
}
