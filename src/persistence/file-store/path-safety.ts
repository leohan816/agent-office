import { constants } from 'node:fs';
import { chmod, lstat, mkdir, open, readFile, realpath, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

import { canonicalBytes } from './canonical-json.js';
import { StoreError } from './errors.js';

const DIRECTORY_MODE = 0o700;
export const FILE_MODE = 0o600;

const REQUIRED_DIRECTORIES = [
  'locks',
  'manifests',
  'streams',
  'artifacts',
  'projections',
  'indexes',
  'checkpoints',
  'quarantine',
  'audit',
  'backups',
] as const;

export interface StateRootFormat {
  readonly schemaVersion: 'agent-office.state-root.v1';
  readonly formatVersion: 1;
  readonly stateRootId: string;
  readonly initializedAt: string;
}

export async function initializeStateRoot(
  root: string,
  options: { readonly stateRootId: string; readonly initializedAt: string },
): Promise<string> {
  if (!path.isAbsolute(root)) {
    throw new StoreError('STATE_ROOT_INVALID', 'state root must be absolute');
  }
  await mkdir(root, { recursive: true, mode: DIRECTORY_MODE });
  const rootInfo = await lstat(root);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) {
    throw new StoreError('STATE_ROOT_INVALID', 'state root must be a non-symlink directory');
  }
  assertOwnedByCurrentUser(rootInfo.uid, root);
  await chmod(root, DIRECTORY_MODE);
  const canonicalRoot = await realpath(root);
  for (const relative of REQUIRED_DIRECTORIES) {
    const directory = path.join(canonicalRoot, relative);
    await mkdir(directory, { recursive: true, mode: DIRECTORY_MODE });
    const info = await lstat(directory);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new StoreError('STATE_ROOT_INVALID', `${relative} must be a non-symlink directory`);
    }
    assertOwnedByCurrentUser(info.uid, directory);
    await chmod(directory, DIRECTORY_MODE);
  }
  const format: StateRootFormat = {
    schemaVersion: 'agent-office.state-root.v1',
    formatVersion: 1,
    stateRootId: options.stateRootId,
    initializedAt: options.initializedAt,
  };
  const formatPath = path.join(canonicalRoot, 'FORMAT.json');
  let handle: import('node:fs/promises').FileHandle | undefined;
  let created = false;
  try {
    handle = await open(
      formatPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      FILE_MODE,
    );
    created = true;
    const bytes = Buffer.concat([canonicalBytes(format), Buffer.from('\n', 'utf8')]);
    const result = await handle.write(bytes, 0, bytes.byteLength, 0);
    if (result.bytesWritten !== bytes.byteLength) {
      throw new StoreError('IO_DURABILITY_FAILED', 'short state-root format write');
    }
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fsyncDirectory(canonicalRoot);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (isNodeError(error, 'EEXIST')) {
      const existing = await readStateRootFormat(canonicalRoot);
      if (existing.stateRootId !== format.stateRootId) {
        throw new StoreError('STATE_ROOT_INVALID', 'state-root identity does not match initialization request');
      }
    } else {
      if (created) await unlink(formatPath).catch(() => undefined);
      throw error;
    }
  }
  return validateStateRoot(canonicalRoot);
}

export async function validateStateRoot(root: string): Promise<string> {
  try {
    return await validateStateRootUnsafe(root);
  } catch (error) {
    if (error instanceof StoreError) throw error;
    throw new StoreError('STATE_ROOT_INVALID', 'state root validation failed', { cause: error });
  }
}

async function validateStateRootUnsafe(root: string): Promise<string> {
  if (!path.isAbsolute(root)) {
    throw new StoreError('STATE_ROOT_INVALID', 'state root must be absolute');
  }
  const rootInfo = await lstat(root);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) {
    throw new StoreError('STATE_ROOT_INVALID', 'state root must be a non-symlink directory');
  }
  assertOwnedByCurrentUser(rootInfo.uid, root);
  if ((rootInfo.mode & 0o077) !== 0) {
    throw new StoreError('STATE_ROOT_INVALID', 'state root permissions are not owner-only');
  }
  const canonicalRoot = await realpath(root);
  for (const relative of REQUIRED_DIRECTORIES) {
    const directory = path.join(canonicalRoot, relative);
    const info = await lstat(directory);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new StoreError('STATE_ROOT_INVALID', `${relative} must be a non-symlink directory`);
    }
    assertOwnedByCurrentUser(info.uid, directory);
    if ((info.mode & 0o077) !== 0) {
      throw new StoreError('STATE_ROOT_INVALID', `${relative} permissions are not owner-only`);
    }
  }
  await readStateRootFormat(canonicalRoot);
  return canonicalRoot;
}

export async function readStateRootFormat(root: string): Promise<StateRootFormat> {
  const formatPath = path.join(root, 'FORMAT.json');
  await assertRegularOwnerOnlyFile(formatPath);
  let value: unknown;
  try {
    value = JSON.parse(await readFile(formatPath, 'utf8')) as unknown;
  } catch (error) {
    throw new StoreError('STATE_ROOT_INVALID', 'state-root format marker is invalid JSON', { cause: error });
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    !('schemaVersion' in value) ||
    value.schemaVersion !== 'agent-office.state-root.v1' ||
    !('formatVersion' in value) ||
    value.formatVersion !== 1 ||
    !('stateRootId' in value) ||
    typeof value.stateRootId !== 'string' ||
    value.stateRootId.length === 0 ||
    !('initializedAt' in value) ||
    typeof value.initializedAt !== 'string'
  ) {
    throw new StoreError('STATE_ROOT_INVALID', 'state-root format marker is unsupported');
  }
  return value as StateRootFormat;
}

export async function ensurePrivateDirectory(root: string, relative: string): Promise<string> {
  const target = await resolveContainedPath(root, relative, { allowMissingLeaf: true });
  await mkdir(target, { recursive: true, mode: DIRECTORY_MODE });
  const info = await lstat(target);
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new StoreError('PATH_CONTAINMENT_FAILED', 'target directory is not a regular directory');
  }
  assertOwnedByCurrentUser(info.uid, target);
  await chmod(target, DIRECTORY_MODE);
  await assertNoSymlinkComponents(root, target);
  return target;
}

export async function resolveContainedPath(
  root: string,
  relative: string,
  options: { readonly allowMissingLeaf?: boolean } = {},
): Promise<string> {
  if (
    relative.length === 0 ||
    path.isAbsolute(relative) ||
    relative.includes('\0') ||
    relative.split(/[\\/]/u).includes('..')
  ) {
    throw new StoreError('PATH_CONTAINMENT_FAILED', 'relative path is unsafe');
  }
  const canonicalRoot = await realpath(root);
  const candidate = path.resolve(canonicalRoot, relative);
  if (candidate !== canonicalRoot && !candidate.startsWith(`${canonicalRoot}${path.sep}`)) {
    throw new StoreError('PATH_CONTAINMENT_FAILED', 'path escapes the state root');
  }
  await assertNoSymlinkComponents(canonicalRoot, candidate, options.allowMissingLeaf ?? false);
  return candidate;
}

export async function assertRegularOwnerOnlyFile(filePath: string): Promise<void> {
  const info = await lstat(filePath);
  if (info.isSymbolicLink() || !info.isFile()) {
    throw new StoreError('PATH_CONTAINMENT_FAILED', 'expected a regular non-symlink file');
  }
  assertOwnedByCurrentUser(info.uid, filePath);
  if ((info.mode & 0o077) !== 0) {
    throw new StoreError('PATH_CONTAINMENT_FAILED', 'file permissions are not owner-only');
  }
}

export async function openNoFollowForAppend(filePath: string): Promise<import('node:fs/promises').FileHandle> {
  const flags = constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW;
  const handle = await open(filePath, flags, FILE_MODE);
  await handle.chmod(FILE_MODE);
  const info = await handle.stat();
  if (!info.isFile()) {
    await handle.close();
    throw new StoreError('PATH_CONTAINMENT_FAILED', 'append target is not a regular file');
  }
  assertOwnedByCurrentUser(info.uid, filePath);
  return handle;
}

export async function fsyncDirectory(directory: string): Promise<void> {
  const handle = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function assertNoSymlinkComponents(
  root: string,
  candidate: string,
  allowMissingLeaf = false,
): Promise<void> {
  const relative = path.relative(root, candidate);
  const parts = relative === '' ? [] : relative.split(path.sep);
  let current = root;
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) {
        throw new StoreError('PATH_CONTAINMENT_FAILED', 'symlink components are forbidden');
      }
      if (index < parts.length - 1 && !info.isDirectory()) {
        throw new StoreError('PATH_CONTAINMENT_FAILED', 'non-directory path component');
      }
    } catch (error) {
      if (isNodeError(error, 'ENOENT') && allowMissingLeaf) return;
      throw error;
    }
  }
}

function assertOwnedByCurrentUser(uid: number, label: string): void {
  const currentUid = process.getuid?.();
  if (currentUid !== undefined && uid !== currentUid) {
    throw new StoreError('STATE_ROOT_INVALID', `${label} is not owned by the current user`);
  }
}

export function isNodeError(error: unknown, code?: string): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as NodeJS.ErrnoException).code === 'string' &&
    (code === undefined || (error as NodeJS.ErrnoException).code === code)
  );
}

export async function assertLocalDirectory(root: string): Promise<void> {
  const info = await stat(root);
  if (!info.isDirectory()) {
    throw new StoreError('STATE_ROOT_INVALID', 'state root is not a directory');
  }
}
