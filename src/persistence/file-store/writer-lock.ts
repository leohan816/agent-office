import { constants } from 'node:fs';
import { link, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

import { canonicalBytes, canonicalize } from './canonical-json.js';
import { StoreError } from './errors.js';
import {
  FILE_MODE,
  ensurePrivateDirectory,
  fsyncDirectory,
  isNodeError,
  readStateRootFormat,
  validateStateRoot,
} from './path-safety.js';
import { sha256Bytes } from './hashing.js';
import { writeAtomicCanonicalJson } from './atomic-file.js';

export interface WriterLockMetadata {
  readonly schemaVersion: 'agent-office.writer-lock.v1';
  readonly pid: number;
  readonly bootId: string;
  readonly buildId: string;
  readonly stateRootId: string;
  readonly acquiredAt: string;
  readonly ownershipToken: string;
}

export interface AcquireWriterLockOptions {
  readonly buildId: string;
  readonly stateRootId: string;
  readonly acquiredAt: string;
  readonly pid?: number;
  readonly bootId?: string;
}

export class WriterLock {
  private released = false;

  private constructor(
    private readonly lockPath: string,
    private readonly metadata: WriterLockMetadata,
  ) {}

  public static async acquire(root: string, options: AcquireWriterLockOptions): Promise<WriterLock> {
    const canonicalRoot = await validateStateRoot(root);
    const format = await readStateRootFormat(canonicalRoot);
    if (format.stateRootId !== options.stateRootId) {
      throw new StoreError('STATE_ROOT_INVALID', 'writer state-root identity does not match the format marker');
    }
    const lockDirectory = await ensurePrivateDirectory(canonicalRoot, 'locks');
    const lockPath = path.join(lockDirectory, 'writer.lock');
    const metadata: WriterLockMetadata = {
      schemaVersion: 'agent-office.writer-lock.v1',
      pid: options.pid ?? process.pid,
      bootId: options.bootId ?? (await readBootId()),
      buildId: options.buildId,
      stateRootId: options.stateRootId,
      acquiredAt: options.acquiredAt,
      ownershipToken: randomBytes(32).toString('hex'),
    };
    let handle: import('node:fs/promises').FileHandle | undefined;
    let created = false;
    try {
      handle = await open(
        lockPath,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        FILE_MODE,
      );
      created = true;
      const bytes = Buffer.concat([canonicalBytes(metadata), Buffer.from('\n', 'utf8')]);
      const result = await handle.write(bytes, 0, bytes.byteLength, 0);
      if (result.bytesWritten !== bytes.byteLength) {
        throw new StoreError('IO_DURABILITY_FAILED', 'short writer-lock write');
      }
      await handle.sync();
      await handle.close();
      handle = undefined;
      await fsyncDirectory(lockDirectory);
      return new WriterLock(lockPath, metadata);
    } catch (error) {
      await handle?.close().catch(() => undefined);
      if (isNodeError(error, 'EEXIST')) {
        throw new StoreError('SECOND_WRITER_DETECTED', 'a writer lock already owns this state root');
      }
      if (created) await unlink(lockPath).catch(() => undefined);
      throw error;
    }
  }

  public async release(): Promise<void> {
    if (this.released) return;
    const current = await readFile(this.lockPath, 'utf8').catch((error: unknown) => {
      throw new StoreError('STATE_ROOT_INVALID', 'writer lock disappeared before release', { cause: error });
    });
    if (canonicalize(JSON.parse(current) as unknown) !== canonicalize(this.metadata)) {
      throw new StoreError('STATE_ROOT_INVALID', 'writer lock ownership changed unexpectedly');
    }
    await unlink(this.lockPath);
    await fsyncDirectory(path.dirname(this.lockPath));
    this.released = true;
  }

  public getMetadata(): WriterLockMetadata {
    return this.metadata;
  }

  public static async recoverStale(
    root: string,
    options: {
      readonly operatorAuthorized: boolean;
      readonly recoveredAt: string;
      readonly isProcessAlive?: (pid: number) => boolean;
    },
  ): Promise<string> {
    if (!options.operatorAuthorized) {
      throw new StoreError('SECOND_WRITER_DETECTED', 'explicit operator authority is required to recover a stale lock');
    }
    const canonicalRoot = await validateStateRoot(root);
    const lockPath = path.join(canonicalRoot, 'locks', 'writer.lock');
    const bytes = await readFile(lockPath);
    const metadata = JSON.parse(bytes.toString('utf8')) as WriterLockMetadata;
    const isAlive = options.isProcessAlive ?? defaultProcessAlive;
    if (metadata.bootId === (await readBootId()) && isAlive(metadata.pid)) {
      throw new StoreError('SECOND_WRITER_DETECTED', 'writer process is still alive');
    }
    const quarantineDirectory = await ensurePrivateDirectory(canonicalRoot, 'quarantine');
    const contentHash = sha256Bytes(bytes);
    const hashSuffix = contentHash.slice('sha256:'.length);
    const preservedPath = path.join(quarantineDirectory, `writer-lock-${hashSuffix}.json`);
    try {
      await link(lockPath, preservedPath);
    } catch (error) {
      if (!isNodeError(error, 'EEXIST') || sha256Bytes(await readFile(preservedPath)) !== contentHash) {
        throw error;
      }
    }
    await unlink(lockPath);
    await fsyncDirectory(path.dirname(lockPath));
    await fsyncDirectory(quarantineDirectory);
    await writeAtomicCanonicalJson(`${preservedPath}.recovery.json`, {
      schemaVersion: 'agent-office.writer-lock-recovery.v1',
      contentHash,
      recoveredAt: options.recoveredAt,
      originalMetadata: metadata,
    });
    return preservedPath;
  }
}

async function readBootId(): Promise<string> {
  try {
    return (await readFile('/proc/sys/kernel/random/boot_id', 'utf8')).trim();
  } catch {
    return 'BOOT_ID_UNAVAILABLE';
  }
}

function defaultProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !isNodeError(error, 'ESRCH');
  }
}
