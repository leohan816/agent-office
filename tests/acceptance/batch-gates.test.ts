import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadApprovedManifest } from '../helpers/fixtures.js';

const root = path.resolve(import.meta.dirname, '../..');

const requiredTests = [
  'tests/domain/manifest.test.ts',
  'tests/property/scope-counting.test.ts',
  'tests/domain/event-envelope.test.ts',
  'tests/persistence/hash-chain.test.ts',
  'tests/domain/transitions.test.ts',
  'tests/property/transition-matrix.test.ts',
  'tests/contract/required-observable-conformance.test.ts',
  'tests/domain/writing-result-activity.test.ts',
  'tests/contract/blocker-alert-vocabulary.test.ts',
  'tests/snapshot/gpt-package.test.ts',
  'tests/persistence/replay.test.ts',
  'tests/recovery/crash-consistency.test.ts',
  'tests/recovery/restart-replay.test.ts',
  'tests/recovery/corruption-quarantine.test.ts',
  'tests/acceptance/batch-gates.test.ts',
] as const;

describe('Batch A scope gates', () => {
  it('contains every required Batch A test and deterministic verification command', async () => {
    await Promise.all(requiredTests.map((file) => access(path.join(root, file))));
    const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as {
      dependencies?: unknown;
      scripts: Record<string, string>;
    };
    expect(packageJson.dependencies).toBeUndefined();
    for (const script of [
      'lint',
      'typecheck',
      'test',
      'test:property',
      'test:integration',
      'build',
      'audit:dependencies',
    ]) {
      expect(typeof packageJson.scripts[script]).toBe('string');
    }
  });

  it('projects the approved denominator while excluding all later-batch surfaces', async () => {
    const manifest = await loadApprovedManifest();
    expect(manifest.workUnits).toHaveLength(15);
    expect(manifest.counting.denominator).toBe(15);
    const sourceTopLevel = await readdir(path.join(root, 'src'));
    expect(sourceTopLevel.sort()).toEqual(['application', 'contracts', 'domain', 'persistence']);
    for (const forbidden of ['ui', 'server', 'pwa', 'adapters', 'gateway']) {
      expect(sourceTopLevel).not.toContain(forbidden);
    }
  });

  it('has no database, network server, shell execution, auth, or production implementation imports', async () => {
    const source = await readSourceTree(path.join(root, 'src'));
    expect(source).not.toMatch(/node:(?:child_process|http|https|net|tls)/u);
    expect(source).not.toMatch(/(?:express|react|sqlite|postgres|mysql|prisma|typeorm)/iu);
    expect(source).not.toMatch(/TmuxAdvisorGateway|HermesAdvisorGateway/u);
  });
});

async function readSourceTree(directory: string): Promise<string> {
  const entries = await readdir(directory, { withFileTypes: true });
  const chunks: string[] = [];
  for (const entry of entries) {
    const current = path.join(directory, entry.name);
    if (entry.isDirectory()) chunks.push(await readSourceTree(current));
    else if (entry.name.endsWith('.ts')) chunks.push(await readFile(current, 'utf8'));
  }
  return chunks.join('\n');
}
