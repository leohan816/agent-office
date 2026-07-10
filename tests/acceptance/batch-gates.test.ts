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
  'tests/adapters/git-readonly.test.ts',
  'tests/adapters/artifact-manifest.test.ts',
  'tests/adapters/tmux-readonly.test.ts',
  'tests/integration/project-freshness.test.ts',
  'tests/ui/dashboard-view-model.test.ts',
  'tests/ui/korean-vocabulary.test.ts',
  'tests/ui/dashboard.component.test.tsx',
  'tests/ui/layout-contract.test.ts',
] as const;

describe('Batch A regression and Batch B scope gates', () => {
  it('contains every required Batch A/B test and deterministic verification command', async () => {
    await Promise.all(requiredTests.map((file) => access(path.join(root, file))));
    const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    expect(packageJson.dependencies).toEqual({
      'lucide-react': '1.24.0',
      react: '19.2.7',
      'react-dom': '19.2.7',
    });
    for (const script of [
      'lint',
      'typecheck',
      'test',
      'test:property',
      'test:integration',
      'test:ui',
      'build',
      'audit:dependencies',
    ]) {
      expect(typeof packageJson.scripts[script]).toBe('string');
    }
  });

  it('preserves the approved Batch A denominator while exposing only Batch B top-level surfaces', async () => {
    const manifest = await loadApprovedManifest();
    expect(manifest.workUnits).toHaveLength(15);
    expect(manifest.counting.denominator).toBe(15);
    const sourceTopLevel = await readdir(path.join(root, 'src'));
    expect(sourceTopLevel.sort()).toEqual(['adapters', 'application', 'contracts', 'domain', 'persistence', 'ui']);
    for (const forbidden of ['server', 'pwa', 'gateway']) {
      expect(sourceTopLevel).not.toContain(forbidden);
    }
  });

  it('keeps Batch C/E and forbidden mutation/network/database surfaces absent', async () => {
    const source = await readSourceTree(path.join(root, 'src'));
    expect(source).not.toMatch(/node:(?:http|https|net|tls)/u);
    expect(source).not.toMatch(/(?:express|sqlite|postgres|mysql|prisma|typeorm)/iu);
    expect(source).not.toMatch(/TmuxAdvisorGateway|HermesAdvisorGateway/u);
    expect(source).not.toMatch(/AdvisorInbox|serviceWorker|EventSource|WebSocket/u);
    expect(source).not.toMatch(/send-keys|capture-pane|run-shell|paste-buffer|load-buffer/u);
    await expect(access(path.join(root, 'src/ui/scene'))).rejects.toBeDefined();
    await expect(access(path.join(root, 'src/server'))).rejects.toBeDefined();
    await expect(access(path.join(root, 'src/pwa'))).rejects.toBeDefined();
  });
});

async function readSourceTree(directory: string): Promise<string> {
  const entries = await readdir(directory, { withFileTypes: true });
  const chunks: string[] = [];
  for (const entry of entries) {
    const current = path.join(directory, entry.name);
    if (entry.isDirectory()) chunks.push(await readSourceTree(current));
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) chunks.push(await readFile(current, 'utf8'));
  }
  return chunks.join('\n');
}
