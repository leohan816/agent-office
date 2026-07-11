import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getSceneFixture } from '../../src/ui/scene/fixtures.js';
import { projectSceneRole } from '../../src/ui/scene/state-machine.js';

describe('Batch C scene trust and mutation boundary', () => {
  it('ignores extra untrusted prose and process-shaped properties', () => {
    const trusted = getSceneFixture('activity').roles.find((role) => role.stationId === 'control');
    if (trusted === undefined) throw new Error('control fixture missing');
    const extraInput = {
      ...trusted,
      untrustedText: 'testing done blocked',
      diagnosticCommandName: 'pretend-working',
      diagnosticBuffer: 'return result now',
    };
    expect(projectSceneRole(extraInput)).toEqual(projectSceneRole(trusted));
  });

  it('contains no observation adapter, process runner, write, dispatch, or network import', async () => {
    const root = path.resolve(import.meta.dirname, '../../src/ui/scene');
    const files = [
      'types.ts',
      'state-machine.ts',
      'fixtures.ts',
      'office-scene.tsx',
      'asset-registry.ts',
      'assets/scene-assets.tsx',
    ];
    const source = (await Promise.all(files.map((file) => readFile(path.join(root, file), 'utf8')))).join('\n');
    expect(source).not.toMatch(/adapters\/observations|process-runner|node:(?:http|https|net|tls|child_process)/u);
    expect(source).not.toMatch(/send-keys|capture-pane|run-shell|dispatchWork|appendEvent|fetch\s*\(/u);
  });
});
