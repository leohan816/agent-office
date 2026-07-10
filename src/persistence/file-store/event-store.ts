import { constants } from 'node:fs';
import {
  link,
  open,
  readFile,
  readdir,
  stat,
  unlink,
} from 'node:fs/promises';
import path from 'node:path';

import type { ActorReference, JsonValue } from '../../contracts/types.js';
import { DomainError } from '../../contracts/types.js';
import {
  assertEventEnvelope,
  assertEventFollows,
  createEvent,
  type EventEnvelope,
  type EventType,
} from '../../domain/events/index.js';
import { canonicalBytes } from './canonical-json.js';
import { StoreError } from './errors.js';
import { GENESIS_EVENT_HASH, hashCanonical, sha256Bytes } from './hashing.js';
import {
  FILE_MODE,
  assertRegularOwnerOnlyFile,
  ensurePrivateDirectory,
  fsyncDirectory,
  isNodeError,
  openNoFollowForAppend,
  validateStateRoot,
} from './path-safety.js';
import { writeAtomicBytes, writeAtomicCanonicalJson } from './atomic-file.js';
import { WriterLock, type AcquireWriterLockOptions } from './writer-lock.js';

const MISSION_ID = /^[A-Z0-9][A-Z0-9._-]{0,127}$/u;
const SEGMENT_FILE = /^events-(\d{6})\.jsonl$/u;

export interface EventStoreOpenOptions {
  readonly root: string;
  readonly missionId: string;
  readonly manifestVersion: number;
  readonly maxSegmentBytes?: number;
  readonly recoverIncompleteTail?: boolean;
  readonly writer: AcquireWriterLockOptions;
}

export interface AppendEventRequest<TPayload extends JsonValue = JsonValue> {
  readonly eventId: string;
  readonly eventType: EventType;
  readonly requestId: string;
  readonly correlationId: string;
  readonly causationId: string;
  readonly predecessorEventIds?: readonly string[];
  readonly actor: ActorReference;
  readonly occurredAt: string;
  readonly receivedAt: string;
  readonly recordedAt: string;
  readonly expectedStreamVersion: number;
  readonly expectedManifestVersion: number;
  readonly payload: TPayload;
}

export interface AppendReceipt<TPayload extends JsonValue = JsonValue> {
  readonly event: EventEnvelope<TPayload>;
  readonly replayed: boolean;
}

export interface TailRecoveryReceipt {
  readonly schemaVersion: 'agent-office.tail-recovery.v1';
  readonly segment: string;
  readonly originalHash: string;
  readonly preservedRelativePath: string;
  readonly verifiedPrefixBytes: number;
  readonly quarantinedTailBytes: number;
}

interface ScanResult {
  readonly events: EventEnvelope[];
  readonly segmentNumbers: readonly number[];
  readonly lastSegmentFirstSequence: number;
  readonly tailRecoveries: readonly TailRecoveryReceipt[];
}

interface IdempotencyRecord {
  readonly requestHash: string;
  readonly event: EventEnvelope;
}

export class EventStore {
  private readonly idempotency = new Map<string, IdempotencyRecord>();
  private currentSegmentNumber: number;
  private currentSegmentBytes: number;
  private currentSegmentFirstSequence: number;
  private activeManifestVersion: number;
  private writable = true;
  private closed = false;

  private constructor(
    private readonly root: string,
    private readonly missionId: string,
    initialManifestVersion: number,
    private readonly streamDirectory: string,
    private readonly lock: WriterLock,
    private readonly maxSegmentBytes: number,
    private readonly events: EventEnvelope[],
    private readonly recoveredTails: readonly TailRecoveryReceipt[],
    scan: ScanResult,
    currentSegmentBytes: number,
  ) {
    this.currentSegmentNumber = scan.segmentNumbers.at(-1) ?? 1;
    this.currentSegmentBytes = currentSegmentBytes;
    this.currentSegmentFirstSequence = scan.lastSegmentFirstSequence;
    this.activeManifestVersion = initialManifestVersion;
    for (const event of events) {
      this.idempotency.set(event.requestId, { requestHash: requestFingerprintFromEvent(event), event });
      this.advanceManifestVersion(event);
    }
  }

  public static async open(options: EventStoreOpenOptions): Promise<EventStore> {
    if (!MISSION_ID.test(options.missionId)) {
      throw new StoreError('STATE_ROOT_INVALID', 'mission ID is invalid');
    }
    if (!Number.isSafeInteger(options.manifestVersion) || options.manifestVersion < 1) {
      throw new StoreError('STATE_ROOT_INVALID', 'manifest version is invalid');
    }
    const root = await validateStateRoot(options.root);
    const quarantineMarker = path.join(root, 'quarantine', 'STORE_QUARANTINED.json');
    try {
      await assertRegularOwnerOnlyFile(quarantineMarker);
      throw new StoreError('STORE_QUARANTINED', 'state root has a durable quarantine marker');
    } catch (error) {
      if (!(isNodeError(error, 'ENOENT'))) throw error;
    }

    const lock = await WriterLock.acquire(root, options.writer);
    try {
      const streamDirectory = await ensurePrivateDirectory(root, path.join('streams', options.missionId));
      await ensureInitialSegment(streamDirectory);
      const scan = await scanStore(root, streamDirectory, options.recoverIncompleteTail ?? false);
      const lastSegment = segmentPath(streamDirectory, scan.segmentNumbers.at(-1) ?? 1);
      const currentInfo = await stat(lastSegment);
      return new EventStore(
        root,
        options.missionId,
        options.manifestVersion,
        streamDirectory,
        lock,
        options.maxSegmentBytes ?? 4 * 1024 * 1024,
        [...scan.events],
        scan.tailRecoveries,
        scan,
        currentInfo.size,
      );
    } catch (error) {
      await lock.release().catch(() => undefined);
      throw error;
    }
  }

  public readAll(): readonly EventEnvelope[] {
    return [...this.events];
  }

  public getTailRecoveryReceipts(): readonly TailRecoveryReceipt[] {
    return [...this.recoveredTails];
  }

  public get sequence(): number {
    return this.events.at(-1)?.sequence ?? 0;
  }

  public get eventHash(): string {
    return this.events.at(-1)?.eventHash ?? GENESIS_EVENT_HASH;
  }

  public async append<TPayload extends JsonValue>(
    request: AppendEventRequest<TPayload>,
  ): Promise<AppendReceipt<TPayload>> {
    this.assertWritable();
    const requestHash = requestFingerprint(request, this.missionId);
    const prior = this.idempotency.get(request.requestId);
    if (prior !== undefined) {
      if (prior.requestHash !== requestHash) {
        throw new DomainError('IDEMPOTENCY_KEY_REUSED', 'requestId was already used with different payload');
      }
      return { event: prior.event as EventEnvelope<TPayload>, replayed: true };
    }
    if (request.expectedManifestVersion !== this.activeManifestVersion) {
      throw new DomainError('MANIFEST_VERSION_CONFLICT', 'manifest version does not match the active store');
    }
    if (request.expectedStreamVersion !== this.sequence) {
      throw new DomainError('STREAM_VERSION_CONFLICT', 'expected stream version is stale');
    }
    if (request.eventType === 'MissionScopeChanged') {
      scopeTargetManifestVersion(request.payload, this.activeManifestVersion);
    }

    const event = createEvent({
      eventId: request.eventId,
      eventType: request.eventType,
      missionId: this.missionId,
      sequence: this.sequence + 1,
      manifestVersion: this.activeManifestVersion,
      requestId: request.requestId,
      correlationId: request.correlationId,
      causationId: request.causationId,
      ...(request.predecessorEventIds === undefined
        ? {}
        : { predecessorEventIds: request.predecessorEventIds }),
      actor: request.actor,
      occurredAt: request.occurredAt,
      receivedAt: request.receivedAt,
      recordedAt: request.recordedAt,
      previousEventHash: this.eventHash,
      payload: request.payload,
    });
    const line = Buffer.concat([canonicalBytes(event), Buffer.from('\n', 'utf8')]);
    if (line.byteLength > this.maxSegmentBytes) {
      throw new DomainError('INVALID_SCHEMA', 'event exceeds the configured segment size');
    }
    if (this.currentSegmentBytes > 0 && this.currentSegmentBytes + line.byteLength > this.maxSegmentBytes) {
      await this.rotateSegment();
    }

    const filePath = segmentPath(this.streamDirectory, this.currentSegmentNumber);
    const handle = await openNoFollowForAppend(filePath);
    try {
      const result = await handle.write(line);
      if (result.bytesWritten !== line.byteLength) {
        throw new StoreError('IO_DURABILITY_FAILED', 'short event append');
      }
      await handle.sync();
    } catch (error) {
      this.writable = false;
      throw error;
    } finally {
      await handle.close();
    }

    this.currentSegmentBytes += line.byteLength;
    this.events.push(event);
    this.idempotency.set(event.requestId, { requestHash, event });
    this.advanceManifestVersion(event);
    try {
      await this.publishIdempotencyIndex();
    } catch (error) {
      this.writable = false;
      throw new StoreError('IO_DURABILITY_FAILED', 'event is durable but idempotency index publication failed', {
        cause: error,
      });
    }
    return { event, replayed: false };
  }

  public async close(): Promise<void> {
    if (this.closed) return;
    await this.lock.release();
    this.closed = true;
    this.writable = false;
  }

  private async rotateSegment(): Promise<void> {
    const filePath = segmentPath(this.streamDirectory, this.currentSegmentNumber);
    const bytes = await readFile(filePath);
    const lastEvent = this.events.at(-1);
    if (lastEvent === undefined) return;
    await writeAtomicCanonicalJson(`${filePath}.manifest.json`, {
      schemaVersion: 'agent-office.event-segment.v1',
      segment: this.currentSegmentNumber,
      sha256: sha256Bytes(bytes),
      firstSequence: this.currentSegmentFirstSequence,
      lastSequence: lastEvent.sequence,
      lastEventHash: lastEvent.eventHash,
    });
    this.currentSegmentNumber += 1;
    this.currentSegmentBytes = 0;
    this.currentSegmentFirstSequence = lastEvent.sequence + 1;
    const nextPath = segmentPath(this.streamDirectory, this.currentSegmentNumber);
    const handle = await open(
      nextPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      FILE_MODE,
    );
    await handle.sync();
    await handle.close();
    await fsyncDirectory(this.streamDirectory);
  }

  private async publishIdempotencyIndex(): Promise<void> {
    const records = [...this.idempotency.entries()]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([requestId, record]) => ({
        requestId,
        requestHash: record.requestHash,
        eventId: record.event.eventId,
        sequence: record.event.sequence,
      }));
    await writeAtomicCanonicalJson(path.join(this.root, 'indexes', 'idempotency.json'), {
      schemaVersion: 'agent-office.idempotency-index.v1',
      sourceSequence: this.sequence,
      sourceEventHash: this.eventHash,
      records,
    });
  }

  private assertWritable(): void {
    if (this.closed || !this.writable) {
      throw new StoreError('STORE_QUARANTINED', 'event store is not writable');
    }
  }

  private advanceManifestVersion(event: EventEnvelope): void {
    if (event.eventType !== 'MissionScopeChanged') return;
    this.activeManifestVersion = scopeTargetManifestVersion(event.payload, this.activeManifestVersion);
  }
}

async function ensureInitialSegment(streamDirectory: string): Promise<void> {
  const entries = await readdir(streamDirectory);
  if (entries.some((entry) => SEGMENT_FILE.test(entry))) return;
  const initialPath = segmentPath(streamDirectory, 1);
  const handle = await open(
    initialPath,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    FILE_MODE,
  );
  await handle.sync();
  await handle.close();
  await fsyncDirectory(streamDirectory);
}

async function scanStore(
  root: string,
  streamDirectory: string,
  recoverIncompleteTail: boolean,
): Promise<ScanResult> {
  const names = (await readdir(streamDirectory))
    .filter((entry) => SEGMENT_FILE.test(entry))
    .sort();
  const segmentNumbers = names.map((name) => Number(SEGMENT_FILE.exec(name)?.[1]));
  for (const [index, name] of names.entries()) {
    if (segmentNumbers[index] !== index + 1) {
      await quarantineCorruption(root, path.join(streamDirectory, name), 'segment sequence gap');
    }
  }

  const events: EventEnvelope[] = [];
  const tailRecoveries: TailRecoveryReceipt[] = [];
  let lastSegmentFirstSequence = 1;
  for (const [index, name] of names.entries()) {
    const filePath = path.join(streamDirectory, name);
    await assertRegularOwnerOnlyFile(filePath);
    const isLast = index === names.length - 1;
    let bytes: Uint8Array = await readFile(filePath);
    if (bytes.byteLength > 0 && bytes.at(-1) !== 0x0a) {
      if (!isLast || !recoverIncompleteTail) {
        if (isLast) throw new StoreError('INCOMPLETE_TAIL', 'active segment has an incomplete tail');
        await quarantineCorruption(root, filePath, 'closed segment has an incomplete tail');
      }
      const recovery = await recoverTail(root, filePath, bytes);
      tailRecoveries.push(recovery.receipt);
      bytes = recovery.prefix;
    }
    const firstBeforeSegment = events.length + 1;
    await parseSegment(root, filePath, bytes, events);
    if (isLast) lastSegmentFirstSequence = firstBeforeSegment;
    if (!isLast) await verifySegmentManifest(root, filePath, bytes, events, firstBeforeSegment);
  }
  return { events, segmentNumbers, lastSegmentFirstSequence, tailRecoveries };
}

async function parseSegment(
  root: string,
  filePath: string,
  bytes: Uint8Array,
  events: EventEnvelope[],
): Promise<void> {
  if (bytes.byteLength === 0) return;
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return quarantineCorruption(root, filePath, 'segment contains invalid UTF-8');
  }
  const lines = text.split('\n');
  lines.pop();
  for (const line of lines) {
    if (line.length === 0) await quarantineCorruption(root, filePath, 'segment contains an empty line');
    try {
      const parsed = JSON.parse(line) as EventEnvelope;
      assertEventEnvelope(parsed);
      assertEventFollows(parsed, events.at(-1));
      events.push(parsed);
    } catch (error) {
      if (error instanceof StoreError) throw error;
      await quarantineCorruption(
        root,
        filePath,
        error instanceof Error ? `event validation failed: ${error.message}` : 'event validation failed',
      );
    }
  }
}

async function verifySegmentManifest(
  root: string,
  filePath: string,
  bytes: Uint8Array,
  events: readonly EventEnvelope[],
  firstSequence: number,
): Promise<void> {
  try {
    const raw = JSON.parse(await readFile(`${filePath}.manifest.json`, 'utf8')) as Record<string, unknown>;
    const last = events.at(-1);
    if (
      raw.schemaVersion !== 'agent-office.event-segment.v1' ||
      raw.sha256 !== sha256Bytes(bytes) ||
      raw.firstSequence !== firstSequence ||
      raw.lastSequence !== last?.sequence ||
      raw.lastEventHash !== last?.eventHash
    ) {
      await quarantineCorruption(root, filePath, 'closed segment manifest mismatch');
    }
  } catch (error) {
    if (error instanceof StoreError) throw error;
    await quarantineCorruption(root, filePath, 'closed segment manifest is missing or invalid');
  }
}

async function recoverTail(
  root: string,
  filePath: string,
  original: Uint8Array,
): Promise<{ readonly receipt: TailRecoveryReceipt; readonly prefix: Uint8Array }> {
  const lastNewline = original.lastIndexOf(0x0a);
  const prefix = lastNewline < 0 ? Buffer.alloc(0) : original.subarray(0, lastNewline + 1);
  const originalHash = sha256Bytes(original);
  const quarantineDirectory = await ensurePrivateDirectory(root, 'quarantine');
  const preserved = path.join(
    quarantineDirectory,
    `tail-${originalHash.slice('sha256:'.length)}-${path.basename(filePath)}`,
  );
  try {
    await link(filePath, preserved);
  } catch (error) {
    if (!isNodeError(error, 'EEXIST') || sha256Bytes(await readFile(preserved)) !== originalHash) throw error;
  }
  await fsyncDirectory(quarantineDirectory);
  await unlink(filePath);
  await writeAtomicBytes(filePath, prefix);
  const receipt: TailRecoveryReceipt = {
    schemaVersion: 'agent-office.tail-recovery.v1',
    segment: path.basename(filePath),
    originalHash,
    preservedRelativePath: path.relative(root, preserved),
    verifiedPrefixBytes: prefix.byteLength,
    quarantinedTailBytes: original.byteLength - prefix.byteLength,
  };
  await writeAtomicCanonicalJson(`${preserved}.recovery.json`, receipt);
  return { receipt, prefix };
}

async function quarantineCorruption(root: string, filePath: string, reason: string): Promise<never> {
  const bytes = await readFile(filePath).catch(() => Buffer.alloc(0));
  const sourceHash = sha256Bytes(bytes);
  const quarantineDirectory = await ensurePrivateDirectory(root, 'quarantine');
  const preserved = path.join(
    quarantineDirectory,
    `corrupt-${sourceHash.slice('sha256:'.length)}-${path.basename(filePath)}`,
  );
  try {
    await link(filePath, preserved);
  } catch (error) {
    if (!isNodeError(error, 'EEXIST')) throw error;
  }
  await fsyncDirectory(quarantineDirectory);
  const marker = {
    schemaVersion: 'agent-office.store-quarantine.v1',
    sourceRelativePath: path.relative(root, filePath),
    preservedRelativePath: path.relative(root, preserved),
    sourceHash,
    reason,
  };
  const markerPath = path.join(quarantineDirectory, 'STORE_QUARANTINED.json');
  try {
    const handle = await open(
      markerPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      FILE_MODE,
    );
    const markerBytes = Buffer.concat([canonicalBytes(marker), Buffer.from('\n', 'utf8')]);
    await handle.writeFile(markerBytes);
    await handle.sync();
    await handle.close();
    await fsyncDirectory(quarantineDirectory);
  } catch (error) {
    if (!isNodeError(error, 'EEXIST')) throw error;
  }
  throw new StoreError('MIDSTREAM_CORRUPTION', reason);
}

function segmentPath(streamDirectory: string, number: number): string {
  return path.join(streamDirectory, `events-${String(number).padStart(6, '0')}.jsonl`);
}

function requestFingerprint(request: AppendEventRequest, missionId: string): string {
  return hashCanonical({
    eventType: request.eventType,
    eventVersion: 1,
    missionId,
    manifestVersion: request.expectedManifestVersion,
    requestId: request.requestId,
    correlationId: request.correlationId,
    causationId: request.causationId,
    predecessorEventIds: request.predecessorEventIds ?? [],
    actor: request.actor,
    occurredAt: request.occurredAt,
    expectedStreamVersion: request.expectedStreamVersion,
    payload: request.payload,
  });
}

function requestFingerprintFromEvent(event: EventEnvelope): string {
  return hashCanonical({
    eventType: event.eventType,
    eventVersion: event.eventVersion,
    missionId: event.missionId,
    manifestVersion: event.manifestVersion,
    requestId: event.requestId,
    correlationId: event.correlationId,
    causationId: event.causationId,
    predecessorEventIds: event.predecessorEventIds,
    actor: event.actor,
    occurredAt: event.occurredAt,
    expectedStreamVersion: event.sequence - 1,
    payload: event.payload,
  });
}

function scopeTargetManifestVersion(payload: JsonValue, activeManifestVersion: number): number {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload) ||
    typeof payload.fromManifestVersion !== 'number' ||
    typeof payload.toManifestVersion !== 'number' ||
    payload.fromManifestVersion !== activeManifestVersion ||
    payload.toManifestVersion !== activeManifestVersion + 1
  ) {
    throw new DomainError('MANIFEST_VERSION_CONFLICT', 'scope event manifest versions are not consecutive');
  }
  return payload.toManifestVersion;
}
