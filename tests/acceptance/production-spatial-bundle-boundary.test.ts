import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { build } from 'vite';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..');
const PRODUCTION_SPATIAL_SOURCE = path.join(
  REPOSITORY_ROOT,
  'src/ui/spatial/spatial-office.tsx',
);
const SYNTHETIC_DEMO_SOURCE = path.join(REPOSITORY_ROOT, 'src/ui/demo-entry.tsx');
const FORBIDDEN_PRODUCTION_MARKERS = [
  'SYNTHETIC_NON_OPERATIONAL_STATIC',
  'SYNTHETIC_STRUCTURED_EVENT_MOTION',
  'AO12-C synthetic accepted-event motion fixture',
  'ao12-b-static-shared-floor',
  'ao12-c-evidence-backed-motion',
  'AO12-B synthetic static shared floor',
] as const;

describe('AO12-D-A1 production spatial bundle boundary', () => {
  it('requires an explicit projection and keeps fixture injection in the test-demo entry', async () => {
    const [productionSource, demoSource] = await Promise.all([
      readFile(PRODUCTION_SPATIAL_SOURCE, 'utf8'),
      readFile(SYNTHETIC_DEMO_SOURCE, 'utf8'),
    ]);

    expect(productionSource).not.toContain("from './fixtures.js'");
    expect(productionSource).not.toContain('STATIC_SPATIAL_OFFICE_FIXTURE');
    expect(productionSource).toContain('readonly projection: SpatialOfficeProjectionV1;');
    expect(productionSource).not.toMatch(/readonly projection\?\s*:/u);

    for (const fixture of [
      'STATIC_SPATIAL_OFFICE_FIXTURE',
      'MOTION_SPATIAL_OFFICE_FIXTURE',
    ]) {
      expect(demoSource).toContain(`fixtureKind={${fixture}.fixtureKind}`);
      expect(demoSource).toContain(`projection={${fixture}.projection}`);
    }
    expect(demoSource.match(/surfaceKind="SYNTHETIC"/gu)).toHaveLength(2);
  });

  it('requires an explicit validated Living Office render input and keeps the pixel production chain fixture-free', async () => {
    const [chunk, scene, boundary, projector, contracts, renderInput] = await Promise.all([
      readFile(path.join(REPOSITORY_ROOT, 'src/ui/pixel/production-pixel-office-chunk.tsx'), 'utf8'),
      readFile(path.join(REPOSITORY_ROOT, 'src/ui/pixel/production-pixel-world-scene.tsx'), 'utf8'),
      readFile(path.join(REPOSITORY_ROOT, 'src/ui/pixel/production-renderer-boundary.tsx'), 'utf8'),
      readFile(path.join(REPOSITORY_ROOT, 'src/ui/pixel/production-frame-projector.ts'), 'utf8'),
      readFile(path.join(REPOSITORY_ROOT, 'src/ui/pixel/contracts.ts'), 'utf8'),
      readFile(path.join(REPOSITORY_ROOT, 'src/application/organization/production-render-input.ts'), 'utf8'),
    ]);
    // Explicit, non-optional render input validated at runtime (PR-3; a cast is not validation).
    expect(contracts).toContain('readonly operational: LivingOfficePresentationV1;');
    expect(contracts).not.toMatch(/LivingOfficeProductionRenderInputV1[^{]*\{[^}]*operational\?\s*:/u);
    expect(chunk).toContain('parseLivingOfficeProductionRenderInput(renderInput)');
    expect(renderInput).toContain('export function parseLivingOfficeProductionRenderInput');
    // The pixel production chain imports no fixture module, no prototype projector, no Pixi package.
    for (const source of [chunk, scene, boundary, projector]) {
      expect(source).not.toMatch(/from\s*['"]\.\/fixtures\//u);
      expect(source).not.toMatch(/from\s*['"]\.\/frame-projector\.js['"]/u);
      expect(source).not.toMatch(/from\s*['"](?:@pixi\/react|pixi\.js)['"]/u);
    }
  });

  it('emits no synthetic spatial fixture marker in a fresh production build', async () => {
    const outputRoot = await mkdtemp(path.join(tmpdir(), 'agent-office-production-bundle-'));
    try {
      await build({
        root: REPOSITORY_ROOT,
        configFile: path.join(REPOSITORY_ROOT, 'vite.config.ts'),
        mode: 'production',
        logLevel: 'silent',
        build: {
          outDir: outputRoot,
          emptyOutDir: true,
        },
      });
      const javaScriptFiles = await collectJavaScriptFiles(outputRoot);
      expect(javaScriptFiles.length).toBeGreaterThan(0);
      const bundle = (await Promise.all(
        javaScriptFiles.map((file) => readFile(file, 'utf8')),
      )).join('\n');
      for (const marker of FORBIDDEN_PRODUCTION_MARKERS) {
        expect(bundle, marker).not.toContain(marker);
      }
    } finally {
      await rm(outputRoot, { recursive: true, force: true });
    }
  });
});

async function collectJavaScriptFiles(root: string): Promise<readonly string[]> {
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await collectJavaScriptFiles(candidate));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(candidate);
  }
  return files.sort();
}
