import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { recoverMissionState } from '../../src/application/startup/recovery.js';
import { canonicalize } from '../../src/persistence/file-store/canonical-json.js';
import {
  FIXED_TIME,
  appendRequest,
  loadApprovedManifest,
  makeStateRoot,
} from '../helpers/fixtures.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('restart and checkpoint replay', () => {
  it('rebuilds after event-before-projection crash and then uses a verified checkpoint', async () => {
    const root = await makeStateRoot();
    roots.push(root);
    const manifest = await loadApprovedManifest();
    const options = {
      root,
      writer: {
        buildId: 'test-build',
        stateRootId: 'test-state-root',
        acquiredAt: FIXED_TIME,
      },
    } as const;
    const initial = await recoverMissionState(manifest, options);
    await initial.store.append(
      appendRequest(1, 'WorkUnitStateTransitioned', {
        workUnitId: 'AO-WU-07',
        from: 'WAITING_DEPENDENCY',
        to: 'READY',
      }),
    );
    await initial.store.append(
      appendRequest(2, 'WorkUnitStateTransitioned', {
        workUnitId: 'AO-WU-07',
        from: 'READY',
        to: 'DISPATCHED',
      }),
    );
    await initial.store.close();

    const rebuilt = await recoverMissionState(manifest, options);
    expect(rebuilt.projection.sequence).toBe(2);
    expect(rebuilt.projection.workUnits['AO-WU-07']).toMatchObject({
      state: 'DISPATCHED',
      requiredObservableName: 'UNKNOWN_OR_STALE',
    });
    expect(rebuilt.usedCheckpoint).toBe(true);
    const canonicalRebuild = canonicalize(rebuilt.projection);
    await rebuilt.store.close();

    const checkpointPath = path.join(root, 'checkpoints', `${manifest.missionId}.json`);
    const checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8')) as Record<string, unknown>;
    checkpoint.projectionHash = `sha256:${'0'.repeat(64)}`;
    await writeFile(checkpointPath, `${JSON.stringify(checkpoint)}\n`, { mode: 0o600 });

    const fallbackRestart = await recoverMissionState(manifest, options);
    expect(fallbackRestart.usedCheckpoint).toBe(false);
    expect(canonicalize(fallbackRestart.projection)).toBe(canonicalRebuild);
    await fallbackRestart.store.close();

    const verifiedRestart = await recoverMissionState(manifest, options);
    expect(verifiedRestart.usedCheckpoint).toBe(true);
    expect(canonicalize(verifiedRestart.projection)).toBe(canonicalRebuild);
    expect(verifiedRestart.phases.at(-1)).toBe('MUTATION_READY');
    await verifiedRestart.store.close();
  });
});
