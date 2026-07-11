import { chmod, mkdtemp, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { recoverMissionState } from '../../src/application/startup/recovery.js';
import {
  createCheckpointBackup,
  planRestoredRootSelection,
  restoreCheckpointBackup,
  verifyCompleteBackup,
  type BuildCompatibilityDescriptor,
} from '../../src/operations/index.js';
import { hashCanonical } from '../../src/persistence/file-store/hashing.js';
import {
  FIXED_TIME,
  appendRequest,
  loadApprovedManifest,
  makeStateRoot,
} from '../helpers/fixtures.js';

const paths: string[] = [];

const CURRENT_BUILD: BuildCompatibilityDescriptor = {
  buildId: 'batch-e-test-build',
  readableStateRootFormats: [1],
  writableStateRootFormats: [1],
  readableEventEnvelopeVersions: [1],
  writableEventEnvelopeVersions: [1],
  readableProjectionSchemaVersions: ['agent-office.mission-projection.v1'],
};

afterEach(async () => {
  await Promise.all(paths.splice(0).map((entry) => rm(entry, { recursive: true, force: true })));
});

describe('owner-controlled checkpoint backup and isolated restore', () => {
  it('writes a complete hashed checkpoint, restores outside the active root, and proves replay equivalence', async () => {
    const fixture = await completeBackup();
    const verified = await verifyCompleteBackup(fixture.receipt.backupRoot);
    expect(verified.complete.manifestHash).toBe(fixture.receipt.manifestHash);
    expect((await stat(path.join(verified.dataRoot, 'FORMAT.json'))).mode & 0o777).toBe(0o600);
    expect((await stat(path.join(verified.dataRoot, 'projections'))).mode & 0o777).toBe(0o700);
    expect(verified.manifest.sourceSequence).toBe(fixture.projection.sequence);
    const activeFormatBefore = await readFile(path.join(fixture.root, 'FORMAT.json'), 'utf8');
    const restoreParent = await privateTemp('agent-office-restore-');
    const candidate = path.join(restoreParent, 'candidate');
    const restore = await restoreCheckpointBackup({
      backupRoot: fixture.receipt.backupRoot,
      activeRoot: fixture.root,
      candidateRoot: candidate,
      build: CURRENT_BUILD,
      verifiedAt: FIXED_TIME,
      verifyCandidate: async (candidateRoot) => {
        const recovered = await recoverMissionState(fixture.manifest, {
          root: candidateRoot,
          writer: {
            buildId: CURRENT_BUILD.buildId,
            stateRootId: 'test-state-root',
            acquiredAt: FIXED_TIME,
          },
        });
        try {
          return {
            eventCount: recovered.store.readAll().length,
            firstSequence: recovered.store.readAll().at(0)?.sequence ?? 0,
            lastSequence: recovered.projection.sequence,
            lastEventHash: recovered.projection.eventHash,
            projectionHash: hashCanonical(recovered.projection),
            idempotencyVerified: true,
          };
        } finally {
          await recovered.store.close();
        }
      },
    });
    expect(restore).toMatchObject({ selected: false, candidateRoot: candidate });
    expect(restore.verification.projectionHash).toBe(fixture.receipt.projectionHash);
    expect(await readFile(path.join(fixture.root, 'FORMAT.json'), 'utf8')).toBe(activeFormatBefore);
    const plan = await planRestoredRootSelection({
      activeRoot: fixture.root,
      candidateRoot: candidate,
      serviceStopped: true,
      plannedAt: FIXED_TIME,
    });
    expect(plan).toMatchObject({
      selectedByOperation: false,
      requiresExplicitOperatorSelection: true,
      serviceStopped: true,
    });
  });

  it('rejects incomplete, hash-tampered, mode-tampered, schema-tampered, and unsafe-path backups', async () => {
    const incomplete = await completeBackup('BACKUP-INCOMPLETE');
    await unlink(path.join(incomplete.receipt.backupRoot, 'COMPLETE.json'));
    await expect(verifyCompleteBackup(incomplete.receipt.backupRoot)).rejects.toBeDefined();

    const hashTampered = await completeBackup('BACKUP-HASH');
    await writeFile(path.join(hashTampered.receipt.backupRoot, 'data', 'FORMAT.json'), '{}\n');
    await expect(verifyCompleteBackup(hashTampered.receipt.backupRoot)).rejects.toMatchObject({
      code: 'MIDSTREAM_CORRUPTION',
    });

    const modeTampered = await completeBackup('BACKUP-MODE');
    await chmod(path.join(modeTampered.receipt.backupRoot, 'data', 'FORMAT.json'), 0o644);
    await expect(verifyCompleteBackup(modeTampered.receipt.backupRoot)).rejects.toMatchObject({
      code: 'PATH_CONTAINMENT_FAILED',
    });

    const schemaTampered = await completeBackup('BACKUP-SCHEMA');
    await mutateManifest(schemaTampered.receipt.backupRoot, (manifest) => {
      manifest.schemaVersion = 'unsupported.v2';
    });
    await expect(verifyCompleteBackup(schemaTampered.receipt.backupRoot)).rejects.toBeDefined();

    const pathTampered = await completeBackup('BACKUP-PATH');
    await mutateManifest(pathTampered.receipt.backupRoot, (manifest) => {
      const files = manifest.files;
      if (Array.isArray(files) && typeof files[0] === 'object' && files[0] !== null) {
        (files[0] as Record<string, unknown>).path = '../escape';
      }
    });
    await expect(verifyCompleteBackup(pathTampered.receipt.backupRoot)).rejects.toMatchObject({
      code: 'PATH_CONTAINMENT_FAILED',
    });
  });

  it('requires a stopped writer and a readable build before creating a restore candidate', async () => {
    const root = await makeStateRoot();
    paths.push(root);
    const manifest = await loadApprovedManifest();
    const recovery = await recoverMissionState(manifest, {
      root,
      writer: {
        buildId: CURRENT_BUILD.buildId,
        stateRootId: 'test-state-root',
        acquiredAt: FIXED_TIME,
      },
    });
    const backupParent = await privateTemp('agent-office-backup-live-');
    await expect(createCheckpointBackup({
      sourceRoot: root,
      backupParent,
      backupId: 'BACKUP-LIVE',
      missionId: manifest.missionId,
      createdAt: FIXED_TIME,
      completedAt: FIXED_TIME,
      sourceSequence: recovery.projection.sequence,
      sourceEventHash: recovery.projection.eventHash,
      projectionHash: hashCanonical(recovery.projection),
      build: CURRENT_BUILD,
    })).rejects.toMatchObject({ code: 'SECOND_WRITER_DETECTED' });
    await recovery.store.close();

    const fixture = await completeBackup('BACKUP-INCOMPATIBLE');
    await expect(createCheckpointBackup({
      sourceRoot: fixture.root,
      backupParent: path.join(fixture.root, 'artifacts'),
      backupId: 'BACKUP-UNSAFE-PARENT',
      missionId: fixture.manifest.missionId,
      createdAt: FIXED_TIME,
      completedAt: FIXED_TIME,
      sourceSequence: fixture.projection.sequence,
      sourceEventHash: fixture.projection.eventHash,
      projectionHash: hashCanonical(fixture.projection),
      build: CURRENT_BUILD,
    })).rejects.toMatchObject({ code: 'PATH_CONTAINMENT_FAILED' });
    const restoreParent = await privateTemp('agent-office-restore-incompatible-');
    const candidate = path.join(restoreParent, 'candidate');
    await expect(restoreCheckpointBackup({
      backupRoot: fixture.receipt.backupRoot,
      activeRoot: fixture.root,
      candidateRoot: candidate,
      build: {
        ...CURRENT_BUILD,
        buildId: 'incompatible-build',
        readableStateRootFormats: [2],
      },
      verifiedAt: FIXED_TIME,
      verifyCandidate: () => Promise.reject(new Error('must not verify')),
    })).rejects.toMatchObject({ code: 'STORE_QUARANTINED' });
    await expect(readFile(path.join(candidate, 'FORMAT.json'))).rejects.toMatchObject({ code: 'ENOENT' });
    const activeCandidate = path.join(fixture.root, 'restore-candidate');
    await expect(restoreCheckpointBackup({
      backupRoot: fixture.receipt.backupRoot,
      activeRoot: fixture.root,
      candidateRoot: activeCandidate,
      build: CURRENT_BUILD,
      verifiedAt: FIXED_TIME,
      verifyCandidate: () => Promise.reject(new Error('must not verify')),
    })).rejects.toMatchObject({ code: 'PATH_CONTAINMENT_FAILED' });
    await expect(readFile(path.join(activeCandidate, 'FORMAT.json'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(planRestoredRootSelection({
      activeRoot: fixture.root,
      candidateRoot: fixture.root,
      serviceStopped: false,
      plannedAt: FIXED_TIME,
    })).rejects.toMatchObject({ code: 'STORE_QUARANTINED' });
  });
});

async function completeBackup(backupId = 'BACKUP-COMPLETE') {
  const root = await makeStateRoot();
  paths.push(root);
  const manifest = await loadApprovedManifest();
  const recovered = await recoverMissionState(manifest, {
    root,
    writer: {
      buildId: CURRENT_BUILD.buildId,
      stateRootId: 'test-state-root',
      acquiredAt: FIXED_TIME,
    },
  });
  await recovered.store.append(appendRequest(1, 'WorkUnitStateTransitioned', {
    workUnitId: 'AO-WU-07',
    from: 'WAITING_DEPENDENCY',
    to: 'READY',
  }));
  await recovered.store.close();
  const checkpointed = await recoverMissionState(manifest, {
    root,
    writer: {
      buildId: CURRENT_BUILD.buildId,
      stateRootId: 'test-state-root',
      acquiredAt: FIXED_TIME,
    },
  });
  const projection = checkpointed.projection;
  await checkpointed.store.close();
  const backupParent = await privateTemp('agent-office-backup-');
  const receipt = await createCheckpointBackup({
    sourceRoot: root,
    backupParent,
    backupId,
    missionId: manifest.missionId,
    createdAt: FIXED_TIME,
    completedAt: FIXED_TIME,
    sourceSequence: projection.sequence,
    sourceEventHash: projection.eventHash,
    projectionHash: hashCanonical(projection),
    build: CURRENT_BUILD,
  });
  return { root, manifest, projection, receipt };
}

async function privateTemp(prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  paths.push(directory);
  return directory;
}

async function mutateManifest(
  backupRoot: string,
  change: (manifest: Record<string, unknown>) => void,
): Promise<void> {
  const manifestPath = path.join(backupRoot, 'BACKUP_MANIFEST.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
  change(manifest);
  await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`, { mode: 0o600 });
}
