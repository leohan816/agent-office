import { chmod, mkdir, rm, symlink } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ImmutableArtifactStore } from '../../src/persistence/file-store/artifact-store.js';
import { makeStateRoot } from '../helpers/fixtures.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('scoped immutable artifacts', () => {
  it('uses one immutable byte identity and rejects traversal or changed bytes', async () => {
    const root = await makeStateRoot();
    roots.push(root);
    const store = await ImmutableArtifactStore.open(root);
    const first = await store.putScopedCanonicalJson('inbox', ['MISSION-1', 'REQUEST-1'], { value: 1 });
    const replay = await store.putScopedCanonicalJson('inbox', ['MISSION-1', 'REQUEST-1'], { value: 1 });
    expect(first.reused).toBe(false);
    expect(replay).toMatchObject({ reused: true, relativePath: first.relativePath, sha256: first.sha256 });
    await expect(
      store.putScopedCanonicalJson('inbox', ['MISSION-1', 'REQUEST-1'], { value: 2 }),
    ).rejects.toMatchObject({ code: 'IMMUTABLE_ARTIFACT_CONFLICT' });
    await expect(store.putScopedCanonicalJson('inbox', ['..'], { value: 1 })).rejects.toMatchObject({
      code: 'PATH_CONTAINMENT_FAILED',
    });
    await expect(store.putScopedCanonicalJson('inbox', ['/absolute'], { value: 1 })).rejects.toMatchObject({
      code: 'PATH_CONTAINMENT_FAILED',
    });
  });

  it('rejects a symlink component and enforces the configured whole-artifact bound', async () => {
    const root = await makeStateRoot();
    roots.push(root);
    const outside = `${root}-outside`;
    roots.push(outside);
    await mkdir(outside, { mode: 0o700 });
    await chmod(outside, 0o700);
    await symlink(outside, path.join(root, 'artifacts', 'linked'));
    const store = await ImmutableArtifactStore.open(root);
    await expect(store.putScopedCanonicalJson('linked', ['MISSION-1'], { value: 1 })).rejects.toMatchObject({
      code: 'PATH_CONTAINMENT_FAILED',
    });
    await expect(
      store.putScopedCanonicalJson('inbox', ['MISSION-2'], { padding: 'x'.repeat(500) }, 128),
    ).rejects.toMatchObject({ code: 'IO_DURABILITY_FAILED' });
  });
});
