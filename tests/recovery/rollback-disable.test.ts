import { rm } from 'node:fs/promises';

import { afterEach, describe, expect, it } from 'vitest';

import {
  DurableDeliveryControl,
  assessBuildCompatibility,
  createRollbackPlan,
  type BuildCompatibilityDescriptor,
  type CheckpointBackupManifest,
} from '../../src/operations/index.js';
import { FIXED_TIME, MISSION_ID, makeStateRoot, uuidV7 } from '../helpers/fixtures.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('rollback compatibility and app-local delivery disable', () => {
  it('permits writes only for a stopped, read-write compatible rollback without downgrade', () => {
    const manifest = backupManifest();
    const readWrite = build('read-write', [1], [1]);
    const readOnly = build('read-only', [1], [2]);
    const incompatible = build('incompatible', [2], [2]);
    expect(assessBuildCompatibility(manifest, readWrite)).toBe('READ_WRITE_COMPATIBLE');
    expect(assessBuildCompatibility(manifest, readOnly)).toBe('READ_ONLY_COMPATIBLE');
    expect(assessBuildCompatibility(manifest, incompatible)).toBe('INCOMPATIBLE');
    expect(createRollbackPlan({
      currentBuildId: 'current',
      targetBuild: readWrite,
      manifest,
      serviceStopped: true,
      createdAt: FIXED_TIME,
    })).toMatchObject({ mutationEnableAllowed: true, destructiveDowngrade: false });
    expect(createRollbackPlan({
      currentBuildId: 'current',
      targetBuild: readOnly,
      manifest,
      serviceStopped: true,
      createdAt: FIXED_TIME,
    })).toMatchObject({ mutationEnableAllowed: false, destructiveDowngrade: false });
    expect(createRollbackPlan({
      currentBuildId: 'current',
      targetBuild: readWrite,
      manifest,
      serviceStopped: false,
      createdAt: FIXED_TIME,
    })).toMatchObject({ mutationEnableAllowed: false, destructiveDowngrade: false });
  });

  it('defaults delivery off and durably replays the same disable request after restart', async () => {
    const root = await makeStateRoot();
    roots.push(root);
    const command = {
      requestId: uuidV7(2500),
      disabledAt: FIXED_TIME,
      reasonCode: 'OPERATOR_DISABLE',
      subjectId: 'synthetic-advisor',
      correlationId: uuidV7(2501),
      causationId: uuidV7(2502),
      receivedAt: FIXED_TIME,
    };
    const first = await DurableDeliveryControl.open(root);
    expect(first.project()).toEqual({
      mode: 'DISABLED_DEFAULT',
      receiptCount: 0,
      transitionCount: 0,
    });
    expect(await first.disable(command)).toMatchObject({ status: 'DISABLED', replayed: false });
    const restarted = await DurableDeliveryControl.open(root);
    expect(restarted.project()).toMatchObject({
      mode: 'DISABLED_LATCHED',
      receiptCount: 1,
      transitionCount: 1,
      lastReasonCode: 'OPERATOR_DISABLE',
    });
    expect(await restarted.disable(command)).toMatchObject({ status: 'DISABLED', replayed: true });
    await expect(restarted.disable({
      ...command,
      reasonCode: 'CONFLICTING_REASON',
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });
});

function build(
  buildId: string,
  readableStateRootFormats: readonly number[],
  writableStateRootFormats: readonly number[],
): BuildCompatibilityDescriptor {
  return {
    buildId,
    readableStateRootFormats,
    writableStateRootFormats,
    readableEventEnvelopeVersions: [1],
    writableEventEnvelopeVersions: [1],
    readableProjectionSchemaVersions: ['agent-office.mission-projection.v1'],
  };
}

function backupManifest(): CheckpointBackupManifest {
  return {
    schemaVersion: 'agent-office.checkpoint-backup.v1',
    backupId: 'BACKUP-ROLLBACK',
    createdAt: FIXED_TIME,
    sourceStateRootId: 'test-state-root',
    missionId: MISSION_ID,
    sourceSequence: 0,
    sourceEventHash: `sha256:${'0'.repeat(64)}`,
    projectionHash: `sha256:${'1'.repeat(64)}`,
    stateRootFormatVersion: 1,
    eventEnvelopeVersion: 1,
    projectionSchemaVersion: 'agent-office.mission-projection.v1',
    build: build('source', [1], [1]),
    directories: [],
    files: [],
  };
}
