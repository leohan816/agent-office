import { constants } from 'node:fs';
import { link, open, unlink } from 'node:fs/promises';
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

  public async putBytes(kind: string, bytes: Uint8Array, extension = 'bin'): Promise<ImmutableArtifactReceipt> {
    if (!ARTIFACT_KIND.test(kind) || !/^[a-z0-9]{1,16}$/u.test(extension)) {
      throw new StoreError('PATH_CONTAINMENT_FAILED', 'artifact kind or extension is invalid');
    }
    const directory = await ensurePrivateDirectory(this.root, path.join('artifacts', kind));
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
