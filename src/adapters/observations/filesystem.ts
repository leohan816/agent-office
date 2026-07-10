import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';

import { ObservationError } from './errors.js';

export interface BoundedFileRead {
  readonly bytes: Uint8Array;
  readonly size: number;
}

export async function readBoundedRegularFile(
  canonicalRoot: string,
  relativePath: string,
  maxBytes: number,
): Promise<BoundedFileRead> {
  validateObservationRelativePath(relativePath);
  if (!path.isAbsolute(canonicalRoot) || !Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new ObservationError('CONFIG_INVALID', 'bounded file read configuration is invalid');
  }
  const root = await realpath(canonicalRoot);
  const candidate = path.resolve(root, relativePath);
  if (!candidate.startsWith(`${root}${path.sep}`)) {
    throw new ObservationError('PATH_REJECTED', 'observed path escapes its trusted root');
  }
  await assertNoSymlinkPath(root, candidate);
  let handle: import('node:fs/promises').FileHandle | undefined;
  try {
    handle = await open(candidate, constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = await handle.stat();
    if (!info.isFile()) {
      throw new ObservationError('FILE_NOT_REGULAR', 'observed path is not a regular file');
    }
    if (info.size > maxBytes) {
      throw new ObservationError('SIZE_LIMIT_EXCEEDED', 'observed file exceeds its fixed byte cap');
    }
    const descriptorTarget = await realpath(`/proc/self/fd/${handle.fd}`);
    if (descriptorTarget !== candidate || !descriptorTarget.startsWith(`${root}${path.sep}`)) {
      throw new ObservationError('PATH_REJECTED', 'opened descriptor escaped its trusted root');
    }
    const bytes = await handle.readFile();
    if (bytes.byteLength > maxBytes) {
      throw new ObservationError('SIZE_LIMIT_EXCEEDED', 'observed file grew beyond its fixed byte cap');
    }
    return { bytes, size: bytes.byteLength };
  } catch (error) {
    if (error instanceof ObservationError) throw error;
    if (isNodeError(error, 'ENOENT')) {
      throw new ObservationError('FILE_MISSING', 'observed file does not exist', { cause: error });
    }
    if (isNodeError(error, 'ELOOP')) {
      throw new ObservationError('SYMLINK_REJECTED', 'observed file is a symlink', { cause: error });
    }
    throw new ObservationError('PATH_REJECTED', 'bounded file read failed closed', { cause: error });
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

export function validateObservationRelativePath(relativePath: string): void {
  const components = relativePath.split('/');
  if (
    relativePath.length === 0 ||
    path.isAbsolute(relativePath) ||
    relativePath.includes('\\') ||
    relativePath.includes('\u0000') ||
    components.some((component) => component === '' || component === '.' || component === '..')
  ) {
    throw new ObservationError('PATH_REJECTED', 'observed path is not an allowlisted relative path');
  }
}

async function assertNoSymlinkPath(root: string, candidate: string): Promise<void> {
  const relative = path.relative(root, candidate);
  let current = root;
  for (const component of relative.split(path.sep)) {
    current = path.join(current, component);
    let info: Awaited<ReturnType<typeof lstat>>;
    try {
      info = await lstat(current);
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) {
        throw new ObservationError('FILE_MISSING', 'observed file does not exist', { cause: error });
      }
      throw error;
    }
    if (info.isSymbolicLink()) {
      throw new ObservationError('SYMLINK_REJECTED', 'symlink components are forbidden');
    }
    if (current !== candidate && !info.isDirectory()) {
      throw new ObservationError('PATH_REJECTED', 'observed parent is not a directory');
    }
    if (current === candidate && !info.isFile()) {
      throw new ObservationError('FILE_NOT_REGULAR', 'observed path is not a regular file');
    }
  }
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === code;
}
