import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { assertUtcTimestamp, assertUuidV7 } from '../../domain/time/index.js';
import { canonicalBytes } from '../../persistence/file-store/canonical-json.js';
import { StoreError } from '../../persistence/file-store/errors.js';
import { GENESIS_EVENT_HASH, hashCanonical, isSha256 } from '../../persistence/file-store/hashing.js';
import {
  assertRegularOwnerOnlyFile,
  ensurePrivateDirectory,
  isNodeError,
  openNoFollowForAppend,
  validateStateRoot,
} from '../../persistence/file-store/path-safety.js';

export interface SecurityAuditInput {
  readonly auditId: string;
  readonly route: string;
  readonly action: string;
  readonly outcomeCode: string;
  readonly recordedAt: string;
  readonly subjectRef?: string;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly payloadHash?: string;
}

export interface SecurityAuditRecord extends SecurityAuditInput {
  readonly schemaVersion: 'agent-office.security-audit.v1';
  readonly sequence: number;
  readonly previousAuditHash: string;
  readonly auditHash: string;
}

export interface SecurityAuditSink {
  append(input: SecurityAuditInput): Promise<SecurityAuditRecord>;
}

export class InMemorySecurityAuditSink implements SecurityAuditSink {
  private readonly records: SecurityAuditRecord[] = [];

  public append(input: SecurityAuditInput): Promise<SecurityAuditRecord> {
    const record = buildAuditRecord(input, this.records.at(-1));
    this.records.push(record);
    return Promise.resolve(record);
  }

  public readAll(): readonly SecurityAuditRecord[] {
    return [...this.records];
  }
}

export class FileSecurityAuditLog implements SecurityAuditSink {
  private queue: Promise<void> = Promise.resolve();

  private constructor(
    private readonly filePath: string,
    private readonly records: SecurityAuditRecord[],
  ) {}

  public static async open(root: string): Promise<FileSecurityAuditLog> {
    const canonicalRoot = await validateStateRoot(root);
    const directory = await ensurePrivateDirectory(canonicalRoot, 'audit');
    const filePath = path.join(directory, 'security-000001.jsonl');
    const handle = await openNoFollowForAppend(filePath);
    await handle.sync();
    await handle.close();
    await assertRegularOwnerOnlyFile(filePath);
    const bytes = await readFile(filePath);
    return new FileSecurityAuditLog(filePath, parseAuditLog(bytes));
  }

  public append(input: SecurityAuditInput): Promise<SecurityAuditRecord> {
    const operation = this.queue.then(() => this.appendSerial(input));
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async appendSerial(input: SecurityAuditInput): Promise<SecurityAuditRecord> {
    const record = buildAuditRecord(input, this.records.at(-1));
    const bytes = Buffer.concat([canonicalBytes(record), Buffer.from('\n', 'utf8')]);
    const handle = await openNoFollowForAppend(this.filePath);
    try {
      const written = await handle.write(bytes);
      if (written.bytesWritten !== bytes.byteLength) {
        throw new StoreError('IO_DURABILITY_FAILED', 'short security audit append');
      }
      await handle.sync();
    } finally {
      await handle.close();
    }
    this.records.push(record);
    return record;
  }

  public readAll(): readonly SecurityAuditRecord[] {
    return [...this.records];
  }
}

function buildAuditRecord(
  input: SecurityAuditInput,
  previous: SecurityAuditRecord | undefined,
): SecurityAuditRecord {
  assertAuditInput(input);
  const withoutHash = {
    schemaVersion: 'agent-office.security-audit.v1' as const,
    sequence: (previous?.sequence ?? 0) + 1,
    previousAuditHash: previous?.auditHash ?? GENESIS_EVENT_HASH,
    ...input,
  };
  return { ...withoutHash, auditHash: hashCanonical(withoutHash) };
}

function parseAuditLog(bytes: Uint8Array): SecurityAuditRecord[] {
  if (bytes.byteLength === 0) return [];
  if (bytes.at(-1) !== 0x0a) {
    throw new StoreError('INCOMPLETE_TAIL', 'security audit has an incomplete tail');
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new StoreError('MIDSTREAM_CORRUPTION', 'security audit is not valid UTF-8');
  }
  const records: SecurityAuditRecord[] = [];
  const lines = text.split('\n');
  lines.pop();
  for (const line of lines) {
    let value: unknown;
    try {
      value = JSON.parse(line) as unknown;
    } catch {
      throw new StoreError('MIDSTREAM_CORRUPTION', 'security audit contains invalid JSON');
    }
    assertAuditRecord(value, records.at(-1));
    records.push(value);
  }
  return records;
}

function assertAuditInput(input: SecurityAuditInput): void {
  assertUuidV7(input.auditId, 'security audit ID');
  assertUtcTimestamp(input.recordedAt, 'security audit time');
  if (!/^\/[A-Za-z0-9/_:.-]{0,191}$/u.test(input.route)) {
    throw new StoreError('IO_DURABILITY_FAILED', 'security audit route is invalid');
  }
  for (const [label, value] of [
    ['action', input.action],
    ['outcomeCode', input.outcomeCode],
  ] as const) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/u.test(value)) {
      throw new StoreError('IO_DURABILITY_FAILED', `security audit ${label} is invalid`);
    }
  }
  if (input.subjectRef !== undefined && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(input.subjectRef)) {
    throw new StoreError('IO_DURABILITY_FAILED', 'security audit subject is invalid');
  }
  if (input.requestId !== undefined) assertUuidV7(input.requestId, 'security audit requestId');
  if (input.correlationId !== undefined) assertUuidV7(input.correlationId, 'security audit correlationId');
  if (input.payloadHash !== undefined && !isSha256(input.payloadHash)) {
    throw new StoreError('IO_DURABILITY_FAILED', 'security audit payload hash is invalid');
  }
}

function assertAuditRecord(
  value: unknown,
  previous: SecurityAuditRecord | undefined,
): asserts value is SecurityAuditRecord {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('schemaVersion' in value) ||
    value.schemaVersion !== 'agent-office.security-audit.v1' ||
    !('sequence' in value) ||
    value.sequence !== (previous?.sequence ?? 0) + 1 ||
    !('previousAuditHash' in value) ||
    value.previousAuditHash !== (previous?.auditHash ?? GENESIS_EVENT_HASH) ||
    !('auditHash' in value) ||
    typeof value.auditHash !== 'string'
  ) {
    throw new StoreError('MIDSTREAM_CORRUPTION', 'security audit envelope is invalid');
  }
  const record = value as SecurityAuditRecord;
  assertAuditInput(record);
  const { auditHash, ...withoutHash } = record;
  if (!isSha256(auditHash) || hashCanonical(withoutHash) !== auditHash) {
    throw new StoreError('MIDSTREAM_CORRUPTION', 'security audit hash chain is invalid');
  }
}

export async function securityAuditExists(root: string): Promise<boolean> {
  try {
    await assertRegularOwnerOnlyFile(path.join(root, 'audit', 'security-000001.jsonl'));
    return true;
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) return false;
    throw error;
  }
}
