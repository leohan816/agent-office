import { constants } from 'node:fs';
import { link, open, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

import { canonicalBytes } from './canonical-json.js';
import { StoreError } from './errors.js';
import { sha256Bytes } from './hashing.js';
import {
  FILE_MODE,
  ensurePrivateDirectory,
  fsyncDirectory,
  isNodeError,
  validateStateRoot,
} from './path-safety.js';

const ARTIFACT_KIND = /^[a-z][a-z0-9-]{0,63}$/u;
const IDENTITY_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

export interface ImmutableArtifactReceipt {
  readonly relativePath: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly reused: boolean;
}

export class ImmutableArtifactStore {
  private constructor(private readonly root: string) {}

  public static async open(root: string): Promise<ImmutableArtifactStore> {
    return new ImmutableArtifactStore(await validateStateRoot(root));
  }

  public async putCanonicalJson(kind: string, value: unknown): Promise<ImmutableArtifactReceipt> {
    return this.putBytes(kind, Buffer.concat([canonicalBytes(value), Buffer.from('\n', 'utf8')]), 'json');
  }

  public async putScopedCanonicalJson(
    kind: string,
    identitySegments: readonly string[],
    value: unknown,
    maxByteLength = 32 * 1024,
  ): Promise<ImmutableArtifactReceipt> {
    if (
      !ARTIFACT_KIND.test(kind) ||
      identitySegments.length === 0 ||
      identitySegments.some((segment) => !IDENTITY_SEGMENT.test(segment))
    ) {
      throw new StoreError('PATH_CONTAINMENT_FAILED', 'scoped artifact identity is invalid');
    }
    const bytes = Buffer.concat([canonicalBytes(value), Buffer.from('\n', 'utf8')]);
    if (!Number.isSafeInteger(maxByteLength) || maxByteLength < 1 || bytes.byteLength > maxByteLength) {
      throw new StoreError('IO_DURABILITY_FAILED', 'scoped artifact exceeds its byte bound');
    }
    const directory = await ensurePrivateDirectory(
      this.root,
      path.join('artifacts', kind, ...identitySegments),
    );
    const sha256 = sha256Bytes(bytes);
    const filename = `${sha256.slice('sha256:'.length)}.json`;
    const existingNames = (await readdir(directory)).filter((name) => name.endsWith('.json'));
    if (existingNames.some((name) => name !== filename)) {
      throw new StoreError(
        'IMMUTABLE_ARTIFACT_CONFLICT',
        'scoped artifact identity already contains different immutable bytes',
      );
    }
    return this.putBytesInDirectory(directory, bytes, 'json');
  }

  public async putBytes(kind: string, bytes: Uint8Array, extension = 'bin'): Promise<ImmutableArtifactReceipt> {
    if (!ARTIFACT_KIND.test(kind) || !/^[a-z0-9]{1,16}$/u.test(extension)) {
      throw new StoreError('PATH_CONTAINMENT_FAILED', 'artifact kind or extension is invalid');
    }
    const directory = await ensurePrivateDirectory(this.root, path.join('artifacts', kind));
    return this.putBytesInDirectory(directory, bytes, extension);
  }

  public async readCanonicalJson(
    relativePath: string,
    expectedSha256: string,
    maxByteLength = 32 * 1024,
  ): Promise<unknown> {
    if (
      !relativePath.startsWith('artifacts/') ||
      relativePath.startsWith('/') ||
      relativePath.includes('\\') ||
      relativePath.split('/').some((segment) => segment.length === 0 || segment === '.' || segment === '..') ||
      !relativePath.endsWith('.json') ||
      !/^sha256:[0-9a-f]{64}$/u.test(expectedSha256) ||
      !Number.isSafeInteger(maxByteLength) ||
      maxByteLength < 1 ||
      maxByteLength > 1024 * 1024
    ) {
      throw new StoreError('PATH_CONTAINMENT_FAILED', 'immutable artifact read reference is invalid');
    }
    const target = path.resolve(this.root, relativePath);
    if (!target.startsWith(`${this.root}${path.sep}`)) {
      throw new StoreError('PATH_CONTAINMENT_FAILED', 'immutable artifact read escaped the state root');
    }
    const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
      .catch((error: unknown) => {
        throw new StoreError('IO_DURABILITY_FAILED', 'immutable artifact is unavailable', { cause: error });
      });
    try {
      const info = await handle.stat();
      const currentUid = process.getuid?.();
      if (
        !info.isFile() ||
        (currentUid !== undefined && info.uid !== currentUid) ||
        (info.mode & 0o077) !== 0 ||
        info.size < 1 ||
        info.size > maxByteLength
      ) {
        throw new StoreError('PATH_CONTAINMENT_FAILED', 'immutable artifact read target is invalid');
      }
      const bytes = await handle.readFile();
      if (sha256Bytes(bytes) !== expectedSha256) {
        throw new StoreError('MIDSTREAM_CORRUPTION', 'immutable artifact read hash mismatched');
      }
      try {
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
      } catch {
        throw new StoreError('MIDSTREAM_CORRUPTION', 'immutable artifact JSON is invalid');
      }
    } finally {
      await handle.close();
    }
  }

  private async putBytesInDirectory(
    directory: string,
    bytes: Uint8Array,
    extension: string,
  ): Promise<ImmutableArtifactReceipt> {
    const sha256 = sha256Bytes(bytes);
    const filename = `${sha256.slice('sha256:'.length)}.${extension}`;
    const finalPath = path.join(directory, filename);
    const temporary = path.join(directory, `.${filename}.${randomBytes(8).toString('hex')}.tmp`);
    let handle: import('node:fs/promises').FileHandle | undefined;
    try {
      handle = await open(
        temporary,
        constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        FILE_MODE,
      );
      const result = await handle.write(bytes, 0, bytes.byteLength, 0);
      if (result.bytesWritten !== bytes.byteLength) {
        throw new StoreError('IO_DURABILITY_FAILED', 'short immutable artifact write');
      }
      await handle.sync();
      const verifyBuffer = Buffer.alloc(bytes.byteLength);
      const verified = await handle.read(verifyBuffer, 0, verifyBuffer.byteLength, 0);
      if (verified.bytesRead !== bytes.byteLength || sha256Bytes(verifyBuffer) !== sha256) {
        throw new StoreError('IO_DURABILITY_FAILED', 'immutable artifact descriptor verification failed');
      }
      await handle.close();
      handle = undefined;
      try {
        await link(temporary, finalPath);
        await unlink(temporary);
        await fsyncDirectory(directory);
        return {
          relativePath: path.relative(this.root, finalPath),
          sha256,
          byteLength: bytes.byteLength,
          reused: false,
        };
      } catch (error) {
        if (!isNodeError(error, 'EEXIST')) throw error;
        const existingHandle = await open(finalPath, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          const info = await existingHandle.stat();
          const currentUid = process.getuid?.();
          if (
            !info.isFile() ||
            (currentUid !== undefined && info.uid !== currentUid) ||
            (info.mode & 0o077) !== 0
          ) {
            throw new StoreError('PATH_CONTAINMENT_FAILED', 'existing artifact is not an owner-only regular file');
          }
          const existing = await existingHandle.readFile();
          if (sha256Bytes(existing) !== sha256 || !Buffer.from(existing).equals(Buffer.from(bytes))) {
            throw new StoreError('IMMUTABLE_ARTIFACT_CONFLICT', 'content-addressed artifact conflicts with existing bytes');
          }
        } finally {
          await existingHandle.close();
        }
        await unlink(temporary);
        return {
          relativePath: path.relative(this.root, finalPath),
          sha256,
          byteLength: bytes.byteLength,
          reused: true,
        };
      }
    } catch (error) {
      await handle?.close().catch(() => undefined);
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  }
}
