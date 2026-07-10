import { appendFile, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { EventStore } from '../../src/persistence/file-store/event-store.js';
import { FIXED_TIME, MISSION_ID, appendRequest, makeStateRoot } from '../helpers/fixtures.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function openStore(root: string, recoverIncompleteTail = false) {
  return EventStore.open({
    root,
    missionId: MISSION_ID,
    manifestVersion: 1,
    recoverIncompleteTail,
    writer: {
      buildId: 'test-build',
      stateRootId: 'test-state-root',
      acquiredAt: FIXED_TIME,
    },
  });
}

function activeSegment(root: string): string {
  return path.join(root, 'streams', MISSION_ID, 'events-000001.jsonl');
}

describe('tail recovery and corruption quarantine', () => {
  it('preserves an incomplete tail and reconstructs only the verified prefix', async () => {
    const root = await makeStateRoot();
    roots.push(root);
    const store = await openStore(root);
    await store.append(appendRequest(1, 'EvidenceAttached', { artifactId: 'ARTIFACT-1' }));
    await store.close();
    await appendFile(activeSegment(root), '{"partial":');

    await expect(openStore(root)).rejects.toMatchObject({ code: 'INCOMPLETE_TAIL' });
    const recovered = await openStore(root, true);
    expect(recovered.readAll()).toHaveLength(1);
    const receipts = recovered.getTailRecoveryReceipts();
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({ quarantinedTailBytes: 11 });
    expect(typeof receipts[0]?.verifiedPrefixBytes).toBe('number');
    await recovered.close();
    const quarantineFiles = await readdir(path.join(root, 'quarantine'));
    expect(quarantineFiles.some((file) => file.startsWith('tail-'))).toBe(true);
  });

  it('never repairs or skips hash-valid-looking midstream corruption', async () => {
    const root = await makeStateRoot();
    roots.push(root);
    const store = await openStore(root);
    await store.append(appendRequest(1, 'EvidenceAttached', { artifactId: 'ARTIFACT-1' }));
    await store.append(appendRequest(2, 'EvidenceAttached', { artifactId: 'ARTIFACT-2' }));
    await store.close();
    const lines = (await readFile(activeSegment(root), 'utf8')).trimEnd().split('\n');
    const firstLine = lines[0];
    if (firstLine === undefined) throw new Error('event fixture is empty');
    const first = JSON.parse(firstLine) as Record<string, unknown>;
    first.payload = { artifactId: 'TAMPERED' };
    lines[0] = JSON.stringify(first);
    await writeFile(activeSegment(root), `${lines.join('\n')}\n`, { mode: 0o600 });

    await expect(openStore(root)).rejects.toMatchObject({
      code: 'MIDSTREAM_CORRUPTION',
    });
    expect(
      JSON.parse(await readFile(path.join(root, 'quarantine', 'STORE_QUARANTINED.json'), 'utf8')),
    ).toMatchObject({ schemaVersion: 'agent-office.store-quarantine.v1' });
    await expect(openStore(root)).rejects.toMatchObject({ code: 'STORE_QUARANTINED' });
  });
});
