import { readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { FileSecurityAuditLog } from '../../src/server/index.js';
import { FIXED_TIME, makeStateRoot, uuidV7 } from '../helpers/fixtures.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('owner-only hash-chained security audit', () => {
  it('serializes concurrent appends, survives restart, and contains redacted fields only', async () => {
    const root = await makeStateRoot();
    roots.push(root);
    const audit = await FileSecurityAuditLog.open(root);
    await Promise.all([
      audit.append(input(2700, 'ACCEPTED')),
      audit.append(input(2701, 'CSRF_REJECTED')),
      audit.append(input(2702, 'RATE_LIMITED')),
    ]);
    expect(audit.readAll().map((record) => record.sequence)).toEqual([1, 2, 3]);
    const filePath = path.join(root, 'audit', 'security-000001.jsonl');
    expect((await stat(filePath)).mode & 0o777).toBe(0o600);
    const bytes = await readFile(filePath, 'utf8');
    expect(bytes).not.toContain('synthetic-canary-secret');
    expect(bytes).not.toMatch(/cookie|csrfToken|authorization|bodyText|environment|argv/iu);
    const reopened = await FileSecurityAuditLog.open(root);
    expect(reopened.readAll()).toEqual(audit.readAll());
  });

  it('fails closed when a persisted audit hash chain is changed', async () => {
    const root = await makeStateRoot();
    roots.push(root);
    const audit = await FileSecurityAuditLog.open(root);
    await audit.append(input(2710, 'ACCEPTED'));
    const filePath = path.join(root, 'audit', 'security-000001.jsonl');
    const record = JSON.parse((await readFile(filePath, 'utf8')).trim()) as Record<string, unknown>;
    record.outcomeCode = 'TAMPERED';
    await writeFile(filePath, `${JSON.stringify(record)}\n`, { mode: 0o600 });
    await expect(FileSecurityAuditLog.open(root)).rejects.toMatchObject({
      code: 'MIDSTREAM_CORRUPTION',
    });
  });
});

function input(sequence: number, outcomeCode: string) {
  return {
    auditId: uuidV7(sequence),
    route: '/api/v1/advisor/messages',
    action: 'HTTP_POST',
    outcomeCode,
    recordedAt: FIXED_TIME,
    subjectRef: 'synthetic-subject',
    requestId: uuidV7(sequence + 100),
    correlationId: uuidV7(sequence + 200),
    payloadHash: `sha256:${'a'.repeat(64)}`,
  };
}
