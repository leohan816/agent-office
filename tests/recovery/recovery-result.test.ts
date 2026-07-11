import { readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  writeRecoveryResult,
  type RecoveryResultDocument,
} from '../../src/operations/index.js';
import { FIXED_TIME, MISSION_ID, makeStateRoot, uuidV7 } from '../helpers/fixtures.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('evidence-bearing immutable recovery result', () => {
  it('writes a bounded result with replay, idempotency, state, and forbidden-scope proof', async () => {
    const root = await makeStateRoot();
    roots.push(root);
    const document = recoveryResult();
    const receipt = await writeRecoveryResult(root, document);
    expect(receipt.relativePath).toMatch(/^artifacts\/recovery\//u);
    expect((await stat(path.join(root, receipt.relativePath))).mode & 0o777).toBe(0o600);
    const stored = await readFile(path.join(root, receipt.relativePath), 'utf8');
    expect(JSON.parse(stored)).toEqual(document);
    expect(stored).not.toContain('synthetic-canary-secret');
    expect(stored).not.toContain('/home/');
    const replay = await writeRecoveryResult(root, document);
    expect(replay).toMatchObject({ sha256: receipt.sha256, reused: true });
  });

  it('rejects incomplete idempotency, inconsistent denominators, and replay hash mismatch', async () => {
    const root = await makeStateRoot();
    roots.push(root);
    const valid = recoveryResult();
    await expect(writeRecoveryResult(root, {
      ...valid,
      idempotency: { ...valid.idempotency, conflictingInputRejected: false },
    })).rejects.toMatchObject({ code: 'INVALID_SCHEMA' });
    await expect(writeRecoveryResult(root, {
      ...valid,
      after: { ...valid.after, manifestWorkUnitCount: 2 },
    })).rejects.toMatchObject({ code: 'INVALID_SCHEMA' });
    await expect(writeRecoveryResult(root, {
      ...valid,
      replay: { ...valid.replay, deterministicProjectionHash: `sha256:${'9'.repeat(64)}` },
    })).rejects.toMatchObject({ code: 'INVALID_SCHEMA' });
  });
});

function recoveryResult(): RecoveryResultDocument {
  const sourceEventHash = `sha256:${'2'.repeat(64)}`;
  const projectionHash = `sha256:${'3'.repeat(64)}`;
  return {
    schemaVersion: 'agent-office.recovery-result.v1',
    incidentId: uuidV7(2600),
    recoveryId: uuidV7(2601),
    missionId: MISSION_ID,
    actor: { role: 'Advisor', subjectId: 'synthetic-advisor' },
    build: { buildId: 'batch-e-test', commit: 'a'.repeat(40) },
    stateRootId: 'test-state-root',
    mode: 'RESTORE_VERIFICATION',
    failureClassification: 'INCOMPLETE_TAIL',
    stopAuthorityRoute: 'Advisor:recovery-review',
    hashes: [
      { kind: 'BACKUP', referenceId: 'BACKUP-1', sha256: `sha256:${'1'.repeat(64)}` },
      { kind: 'CHECKPOINT', referenceId: 'CHECKPOINT-1', sha256: projectionHash },
    ],
    sourceSequence: 3,
    sourceEventHash,
    projectionHash,
    replay: {
      eventCount: 3,
      firstSequence: 1,
      lastSequence: 3,
      lastEventHash: sourceEventHash,
      deterministicProjectionHash: projectionHash,
    },
    idempotency: {
      requestId: uuidV7(2602),
      sameInputReplayed: true,
      conflictingInputRejected: true,
    },
    before: {
      manifestWorkUnitCount: 1,
      workUnitStates: { HOLD: 1 },
      openBlockerCount: 1,
      openDecisionCount: 0,
      openAlertCount: 1,
    },
    after: {
      manifestWorkUnitCount: 1,
      workUnitStates: { READY: 1 },
      openBlockerCount: 0,
      openDecisionCount: 0,
      openAlertCount: 0,
    },
    steps: [
      { stepId: 'VERIFY-BACKUP', harnessAction: 'verify complete backup', outcomeCode: 'PASS', elapsedMs: 7 },
      { stepId: 'REPLAY', harnessAction: 'replay isolated candidate', outcomeCode: 'PASS', elapsedMs: 11 },
    ],
    controls: {
      readOnlyStartupReceipt: 'operations/read-only-startup.json',
      mutationReenableReceipt: 'operations/mutation-reenable.json',
    },
    forbiddenScopeUnchanged: {
      noSecrets: true,
      noDatabase: true,
      noPublicExposure: true,
      noProductionAccess: true,
      noOffHostBackup: true,
    },
    totalElapsedMs: 18,
    advisorAuditRoute: 'foundation-docs/advisor/recovery-result',
    independentReviewRequired: true,
    completedAt: FIXED_TIME,
  };
}
