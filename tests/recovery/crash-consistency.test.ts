import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ImmutableArtifactStore } from '../../src/persistence/file-store/artifact-store.js';
import { EventStore } from '../../src/persistence/file-store/event-store.js';
import { WriterLock } from '../../src/persistence/file-store/writer-lock.js';
import { FIXED_TIME, MISSION_ID, appendRequest, makeStateRoot } from '../helpers/fixtures.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function openStore(root: string, maxSegmentBytes = 4096) {
  return EventStore.open({
    root,
    missionId: MISSION_ID,
    manifestVersion: 1,
    maxSegmentBytes,
    writer: {
      buildId: 'test-build',
      stateRootId: 'test-state-root',
      acquiredAt: FIXED_TIME,
    },
  });
}

describe('artifact/event crash consistency', () => {
  it('keeps an artifact-before-event crash as a harmless reusable orphan', async () => {
    const root = await makeStateRoot();
    roots.push(root);
    const artifacts = await ImmutableArtifactStore.open(root);
    const first = await artifacts.putCanonicalJson('evidence', { result: 'synthetic' });
    const second = await artifacts.putCanonicalJson('evidence', { result: 'synthetic' });
    expect(first).toMatchObject({ reused: false });
    expect(second).toMatchObject({ reused: true, sha256: first.sha256, relativePath: first.relativePath });
    const outside = `${root}-outside-artifact`;
    roots.push(outside);
    await writeFile(outside, await readFile(path.join(root, first.relativePath)), { mode: 0o600 });
    await rm(path.join(root, first.relativePath));
    await symlink(outside, path.join(root, first.relativePath));
    await expect(artifacts.putCanonicalJson('evidence', { result: 'synthetic' })).rejects.toBeDefined();
    const store = await openStore(root);
    expect(store.readAll()).toHaveLength(0);
    await store.close();
  });

  it('requires an explicit owner-only state-root format initialization', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'agent-office-uninitialized-'));
    roots.push(root);
    await expect(openStore(root)).rejects.toMatchObject({ code: 'STATE_ROOT_INVALID' });
  });

  it('recovers a stale lock only through the explicit operator-authorized primitive', async () => {
    const root = await makeStateRoot();
    roots.push(root);
    const lockPath = path.join(root, 'locks', 'writer.lock');
    await writeFile(
      lockPath,
      `${JSON.stringify({
        schemaVersion: 'agent-office.writer-lock.v1',
        pid: 999_999,
        bootId: 'stale-boot-id',
        buildId: 'stale-build',
        stateRootId: 'test-state-root',
        acquiredAt: FIXED_TIME,
        ownershipToken: 'a'.repeat(64),
      })}\n`,
      { mode: 0o600 },
    );
    await expect(
      WriterLock.recoverStale(root, { operatorAuthorized: false, recoveredAt: FIXED_TIME }),
    ).rejects.toMatchObject({ code: 'SECOND_WRITER_DETECTED' });
    const preserved = await WriterLock.recoverStale(root, {
      operatorAuthorized: true,
      recoveredAt: FIXED_TIME,
    });
    expect(path.dirname(preserved)).toBe(path.join(root, 'quarantine'));
    const store = await openStore(root);
    await store.close();
  });

  it('allows one writer only and replays a durable event after an unobserved acknowledgement', async () => {
    const root = await makeStateRoot();
    roots.push(root);
    const store = await openStore(root);
    await expect(openStore(root)).rejects.toMatchObject({
      code: 'SECOND_WRITER_DETECTED',
    });
    const request = appendRequest(1, 'EvidenceAttached', { artifactId: 'ARTIFACT-1' });
    const first = await store.append(request);
    expect(first.replayed).toBe(false);
    await store.close();

    const restarted = await openStore(root);
    const replay = await restarted.append(request);
    expect(replay.replayed).toBe(true);
    expect(replay.event.eventId).toBe(first.event.eventId);
    await expect(
      restarted.append({ ...request, payload: { artifactId: 'DIFFERENT' } }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    await expect(
      restarted.append({ ...request, eventType: 'EvidenceVerified' }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    await restarted.close();
  });

  it('rotates fsynced JSONL segments without breaking sequence or hash continuity', async () => {
    const root = await makeStateRoot();
    roots.push(root);
    const store = await openStore(root, 1200);
    for (let sequence = 1; sequence <= 8; sequence += 1) {
      await store.append(
        appendRequest(sequence, 'EvidenceAttached', {
          artifactId: `ARTIFACT-${sequence}`,
          padding: 'x'.repeat(180),
        }),
      );
    }
    expect(store.sequence).toBe(8);
    await store.close();
    const files = await readdir(path.join(root, 'streams', MISSION_ID));
    expect(files.filter((file) => file.endsWith('.jsonl')).length).toBeGreaterThan(1);
    expect(files.filter((file) => file.endsWith('.manifest.json')).length).toBeGreaterThan(0);
    const restarted = await openStore(root, 1200);
    expect(restarted.readAll().map((event) => event.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    await restarted.close();
  });
});
