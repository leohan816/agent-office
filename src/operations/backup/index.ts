import { constants } from 'node:fs';
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
} from 'node:fs/promises';
import path from 'node:path';

import { DomainError } from '../../contracts/types.js';
import { assertUtcTimestamp } from '../../domain/time/index.js';
import { writeAtomicCanonicalJson } from '../../persistence/file-store/atomic-file.js';
import { StoreError } from '../../persistence/file-store/errors.js';
import { hashCanonical, isSha256, sha256Bytes } from '../../persistence/file-store/hashing.js';
import {
  FILE_MODE,
  fsyncDirectory,
  isNodeError,
  readStateRootFormat,
  validateStateRoot,
} from '../../persistence/file-store/path-safety.js';
import type {
  BackupCompleteMarker,
  BackupDirectoryEntry,
  BackupFileEntry,
  BackupReceipt,
  BuildCompatibilityDescriptor,
  CheckpointBackupManifest,
} from '../types.js';

const DIRECTORY_MODE = 0o700;
const BACKUP_ID = /^[A-Z0-9][A-Z0-9._-]{0,127}$/u;
const EXCLUDED_TOP_LEVEL = new Set(['locks', 'backups']);

export interface CreateCheckpointBackupOptions {
  readonly sourceRoot: string;
  readonly backupParent: string;
  readonly backupId: string;
  readonly missionId: string;
  readonly createdAt: string;
  readonly completedAt: string;
  readonly sourceSequence: number;
  readonly sourceEventHash: string;
  readonly projectionHash: string;
  readonly build: BuildCompatibilityDescriptor;
}

export interface VerifiedCheckpointBackup {
  readonly root: string;
  readonly dataRoot: string;
  readonly manifest: CheckpointBackupManifest;
  readonly complete: BackupCompleteMarker;
}

export async function createCheckpointBackup(
  options: CreateCheckpointBackupOptions,
): Promise<BackupReceipt> {
  assertBackupOptions(options);
  const sourceRoot = await validateStateRoot(options.sourceRoot);
  await assertWriterStopped(sourceRoot);
  const sourceFormat = await readStateRootFormat(sourceRoot);
  const backupParent = await ensureOwnerOnlyDirectory(options.backupParent);
  assertSafeBackupParent(sourceRoot, backupParent);
  const target = path.join(backupParent, options.backupId);
  await createExclusiveDirectory(target);
  const dataRoot = path.join(target, 'data');
  await createExclusiveDirectory(dataRoot);

  const snapshot = await scanSourceTree(sourceRoot);
  assertCheckpointFiles(snapshot.files, options.missionId);
  for (const directory of snapshot.directories) {
    await createExclusiveDirectory(path.join(dataRoot, directory.path), true);
  }
  for (const file of snapshot.files) {
    const source = path.join(sourceRoot, file.path);
    const destination = path.join(dataRoot, file.path);
    await writePrivateExclusive(destination, await readFile(source));
  }
  const manifest: CheckpointBackupManifest = {
    schemaVersion: 'agent-office.checkpoint-backup.v1',
    backupId: options.backupId,
    createdAt: options.createdAt,
    sourceStateRootId: sourceFormat.stateRootId,
    missionId: options.missionId,
    sourceSequence: options.sourceSequence,
    sourceEventHash: options.sourceEventHash,
    projectionHash: options.projectionHash,
    stateRootFormatVersion: 1,
    eventEnvelopeVersion: 1,
    projectionSchemaVersion: 'agent-office.mission-projection.v1',
    build: options.build,
    directories: snapshot.directories,
    files: snapshot.files,
  };
  const manifestHash = hashCanonical(manifest);
  await writeAtomicCanonicalJson(path.join(target, 'BACKUP_MANIFEST.json'), manifest);
  const complete: BackupCompleteMarker = {
    schemaVersion: 'agent-office.checkpoint-backup-complete.v1',
    backupId: options.backupId,
    completedAt: options.completedAt,
    manifestHash,
  };
  await writeAtomicCanonicalJson(path.join(target, 'COMPLETE.json'), complete);
  await fsyncDirectory(target);
  await fsyncDirectory(backupParent);
  return {
    schemaVersion: 'agent-office.backup-receipt.v1',
    backupId: options.backupId,
    backupRoot: target,
    manifestHash,
    sourceSequence: options.sourceSequence,
    sourceEventHash: options.sourceEventHash,
    projectionHash: options.projectionHash,
    fileCount: snapshot.files.length,
    byteCount: snapshot.files.reduce((total, entry) => total + entry.size, 0),
    completedAt: options.completedAt,
  };
}

export async function verifyCompleteBackup(root: string): Promise<VerifiedCheckpointBackup> {
  const canonicalRoot = await assertOwnerOnlyDirectory(root);
  const manifestPath = path.join(canonicalRoot, 'BACKUP_MANIFEST.json');
  const completePath = path.join(canonicalRoot, 'COMPLETE.json');
  await assertOwnerOnlyRegularFile(manifestPath);
  await assertOwnerOnlyRegularFile(completePath);
  const manifest = parseBackupManifest(await readFile(manifestPath, 'utf8'));
  const complete = parseCompleteMarker(await readFile(completePath, 'utf8'));
  if (complete.backupId !== manifest.backupId || complete.manifestHash !== hashCanonical(manifest)) {
    throw new StoreError('MIDSTREAM_CORRUPTION', 'backup complete marker does not match manifest');
  }
  const dataRoot = await assertOwnerOnlyDirectory(path.join(canonicalRoot, 'data'));
  for (const directory of manifest.directories) {
    assertSafeRelativePath(directory.path);
    const actual = await assertOwnerOnlyDirectory(path.join(dataRoot, directory.path));
    if (actual !== path.join(dataRoot, directory.path)) {
      throw new StoreError('PATH_CONTAINMENT_FAILED', 'backup directory realpath changed');
    }
  }
  for (const file of manifest.files) {
    assertSafeRelativePath(file.path);
    const filePath = path.join(dataRoot, file.path);
    await assertOwnerOnlyRegularFile(filePath);
    const bytes = await readFile(filePath);
    if (bytes.byteLength !== file.size || sha256Bytes(bytes) !== file.sha256) {
      throw new StoreError('MIDSTREAM_CORRUPTION', 'backup file hash or size does not match');
    }
  }
  assertCheckpointFiles(manifest.files, manifest.missionId);
  return { root: canonicalRoot, dataRoot, manifest, complete };
}

async function scanSourceTree(root: string): Promise<{
  readonly directories: readonly BackupDirectoryEntry[];
  readonly files: readonly BackupFileEntry[];
}> {
  const directories: BackupDirectoryEntry[] = [];
  const files: BackupFileEntry[] = [];
  const visit = async (relative: string): Promise<void> => {
    const current = relative.length === 0 ? root : path.join(root, relative);
    const entries = (await readdir(current, { withFileTypes: true })).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    for (const entry of entries) {
      const childRelative = relative.length === 0 ? entry.name : path.join(relative, entry.name);
      const top = childRelative.split(path.sep)[0];
      if (top !== undefined && EXCLUDED_TOP_LEVEL.has(top)) continue;
      const child = path.join(root, childRelative);
      const info = await lstat(child);
      if (info.isSymbolicLink()) {
        throw new StoreError('PATH_CONTAINMENT_FAILED', 'backup source contains a symlink');
      }
      assertCurrentOwner(info.uid, child);
      if (entry.isDirectory() && info.isDirectory()) {
        if ((info.mode & 0o777) !== DIRECTORY_MODE) {
          throw new StoreError('PATH_CONTAINMENT_FAILED', 'backup source directory mode is invalid');
        }
        directories.push({ path: childRelative, mode: '0700' });
        await visit(childRelative);
      } else if (entry.isFile() && info.isFile()) {
        if ((info.mode & 0o777) !== FILE_MODE) {
          throw new StoreError('PATH_CONTAINMENT_FAILED', 'backup source file mode is invalid');
        }
        const bytes = await readFile(child);
        files.push({
          path: childRelative,
          size: bytes.byteLength,
          mode: '0600',
          sha256: sha256Bytes(bytes),
        });
      } else {
        throw new StoreError('PATH_CONTAINMENT_FAILED', 'backup source contains a special file');
      }
    }
  };
  await visit('');
  return {
    directories: directories.sort((left, right) => left.path.localeCompare(right.path)),
    files: files.sort((left, right) => left.path.localeCompare(right.path)),
  };
}

function assertCheckpointFiles(files: readonly BackupFileEntry[], missionId: string): void {
  const names = new Set(files.map((entry) => entry.path));
  const exactRequired = [
    'FORMAT.json',
    path.join('projections', `${missionId}.json`),
    path.join('checkpoints', `${missionId}.json`),
    path.join('indexes', 'idempotency.json'),
  ];
  if (
    exactRequired.some((required) => !names.has(required)) ||
    ![...names].some((name) =>
      new RegExp(`^streams/${escapeRegex(missionId)}/events-\\d{6}\\.jsonl$`, 'u').test(
        name.split(path.sep).join('/'),
      ),
    )
  ) {
    throw new StoreError('STATE_ROOT_INVALID', 'backup source lacks a complete checkpoint');
  }
}

function assertBackupOptions(options: CreateCheckpointBackupOptions): void {
  if (!BACKUP_ID.test(options.backupId) || !/^[A-Z0-9][A-Z0-9._-]{0,127}$/u.test(options.missionId)) {
    throw new DomainError('INVALID_SCHEMA', 'backup identity is invalid');
  }
  assertUtcTimestamp(options.createdAt, 'backup createdAt');
  assertUtcTimestamp(options.completedAt, 'backup completedAt');
  if (
    Date.parse(options.completedAt) < Date.parse(options.createdAt) ||
    !Number.isSafeInteger(options.sourceSequence) ||
    options.sourceSequence < 0 ||
    !isSha256(options.sourceEventHash) ||
    !isSha256(options.projectionHash)
  ) {
    throw new DomainError('INVALID_SCHEMA', 'backup source metadata is invalid');
  }
  assertBuildDescriptor(options.build);
}

function assertBuildDescriptor(build: unknown): asserts build is BuildCompatibilityDescriptor {
  if (
    typeof build !== 'object' ||
    build === null ||
    !('buildId' in build) ||
    typeof build.buildId !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(build.buildId) ||
    !('readableStateRootFormats' in build) ||
    !Array.isArray(build.readableStateRootFormats) ||
    build.readableStateRootFormats.length === 0 ||
    !positiveVersions(build.readableStateRootFormats) ||
    !('writableStateRootFormats' in build) ||
    !Array.isArray(build.writableStateRootFormats) ||
    build.writableStateRootFormats.length === 0 ||
    !positiveVersions(build.writableStateRootFormats) ||
    !('readableEventEnvelopeVersions' in build) ||
    !Array.isArray(build.readableEventEnvelopeVersions) ||
    build.readableEventEnvelopeVersions.length === 0 ||
    !positiveVersions(build.readableEventEnvelopeVersions) ||
    !('writableEventEnvelopeVersions' in build) ||
    !Array.isArray(build.writableEventEnvelopeVersions) ||
    build.writableEventEnvelopeVersions.length === 0 ||
    !positiveVersions(build.writableEventEnvelopeVersions) ||
    !('readableProjectionSchemaVersions' in build) ||
    !Array.isArray(build.readableProjectionSchemaVersions) ||
    build.readableProjectionSchemaVersions.length === 0 ||
    !(build.readableProjectionSchemaVersions as readonly unknown[]).every(
      (version) =>
        typeof version === 'string' &&
        /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(version),
    )
  ) {
    throw new DomainError('INVALID_SCHEMA', 'build compatibility descriptor is invalid');
  }
}

function positiveVersions(value: readonly unknown[]): boolean {
  return value.every(
    (version) => typeof version === 'number' && Number.isSafeInteger(version) && version > 0,
  );
}

function parseBackupManifest(text: string): CheckpointBackupManifest {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new StoreError('MIDSTREAM_CORRUPTION', 'backup manifest is invalid JSON');
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    !('schemaVersion' in value) ||
    value.schemaVersion !== 'agent-office.checkpoint-backup.v1' ||
    !('backupId' in value) ||
    typeof value.backupId !== 'string' ||
    !('createdAt' in value) ||
    typeof value.createdAt !== 'string' ||
    !('sourceStateRootId' in value) ||
    typeof value.sourceStateRootId !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value.sourceStateRootId) ||
    !('missionId' in value) ||
    typeof value.missionId !== 'string' ||
    !('files' in value) ||
    !Array.isArray(value.files) ||
    !('directories' in value) ||
    !Array.isArray(value.directories) ||
    !('build' in value) ||
    !('stateRootFormatVersion' in value) ||
    value.stateRootFormatVersion !== 1 ||
    !('eventEnvelopeVersion' in value) ||
    value.eventEnvelopeVersion !== 1 ||
    !('projectionSchemaVersion' in value) ||
    value.projectionSchemaVersion !== 'agent-office.mission-projection.v1'
  ) {
    throw new StoreError('MIDSTREAM_CORRUPTION', 'backup manifest schema is invalid');
  }
  const manifest = value as CheckpointBackupManifest;
  assertBackupOptions({
    sourceRoot: '/validated-separately',
    backupParent: '/validated-separately',
    backupId: manifest.backupId,
    missionId: manifest.missionId,
    createdAt: manifest.createdAt,
    completedAt: manifest.createdAt,
    sourceSequence: manifest.sourceSequence,
    sourceEventHash: manifest.sourceEventHash,
    projectionHash: manifest.projectionHash,
    build: manifest.build,
  });
  for (const entry of value.directories as readonly unknown[]) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      !('mode' in entry) ||
      entry.mode !== '0700' ||
      !('path' in entry) ||
      typeof entry.path !== 'string'
    ) {
      throw new StoreError('MIDSTREAM_CORRUPTION', 'backup directory manifest mode is invalid');
    }
    assertSafeRelativePath(entry.path);
  }
  for (const entry of value.files as readonly unknown[]) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      !('mode' in entry) ||
      entry.mode !== '0600' ||
      !('path' in entry) ||
      typeof entry.path !== 'string' ||
      !('size' in entry) ||
      typeof entry.size !== 'number' ||
      !Number.isSafeInteger(entry.size) ||
      entry.size < 0 ||
      !('sha256' in entry) ||
      typeof entry.sha256 !== 'string' ||
      !isSha256(entry.sha256)
    ) {
      throw new StoreError('MIDSTREAM_CORRUPTION', 'backup file manifest entry is invalid');
    }
    assertSafeRelativePath(entry.path);
  }
  return manifest;
}

function parseCompleteMarker(text: string): BackupCompleteMarker {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new StoreError('MIDSTREAM_CORRUPTION', 'backup complete marker is invalid JSON');
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    !('schemaVersion' in value) ||
    value.schemaVersion !== 'agent-office.checkpoint-backup-complete.v1' ||
    !('backupId' in value) ||
    typeof value.backupId !== 'string' ||
    !('completedAt' in value) ||
    typeof value.completedAt !== 'string' ||
    !('manifestHash' in value) ||
    typeof value.manifestHash !== 'string' ||
    !isSha256(value.manifestHash)
  ) {
    throw new StoreError('MIDSTREAM_CORRUPTION', 'backup complete marker schema is invalid');
  }
  assertUtcTimestamp(value.completedAt, 'backup completedAt');
  return value as BackupCompleteMarker;
}

async function assertWriterStopped(root: string): Promise<void> {
  try {
    await lstat(path.join(root, 'locks', 'writer.lock'));
    throw new StoreError('SECOND_WRITER_DETECTED', 'backup requires a stopped writer');
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) return;
    throw error;
  }
}

async function ensureOwnerOnlyDirectory(directory: string): Promise<string> {
  if (!path.isAbsolute(directory)) {
    throw new StoreError('PATH_CONTAINMENT_FAILED', 'backup directory must be absolute');
  }
  try {
    await mkdir(directory, { recursive: true, mode: DIRECTORY_MODE });
  } catch (error) {
    throw new StoreError('IO_DURABILITY_FAILED', 'backup directory could not be created', { cause: error });
  }
  return assertOwnerOnlyDirectory(directory);
}

async function assertOwnerOnlyDirectory(directory: string): Promise<string> {
  const info = await lstat(directory);
  if (info.isSymbolicLink() || !info.isDirectory() || (info.mode & 0o777) !== DIRECTORY_MODE) {
    throw new StoreError('PATH_CONTAINMENT_FAILED', 'expected an owner-only directory');
  }
  assertCurrentOwner(info.uid, directory);
  return realpath(directory);
}

async function createExclusiveDirectory(directory: string, allowExisting = false): Promise<void> {
  try {
    await mkdir(directory, { mode: DIRECTORY_MODE });
  } catch (error) {
    if (!allowExisting || !isNodeError(error, 'EEXIST')) throw error;
  }
  await assertOwnerOnlyDirectory(directory);
}

async function assertOwnerOnlyRegularFile(filePath: string): Promise<void> {
  const info = await lstat(filePath);
  if (info.isSymbolicLink() || !info.isFile() || (info.mode & 0o777) !== FILE_MODE) {
    throw new StoreError('PATH_CONTAINMENT_FAILED', 'expected an owner-only backup file');
  }
  assertCurrentOwner(info.uid, filePath);
}

async function writePrivateExclusive(filePath: string, bytes: Uint8Array): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true, mode: DIRECTORY_MODE });
  const handle = await open(
    filePath,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    FILE_MODE,
  );
  try {
    const written = await handle.write(bytes, 0, bytes.byteLength, 0);
    if (written.bytesWritten !== bytes.byteLength) {
      throw new StoreError('IO_DURABILITY_FAILED', 'short backup file write');
    }
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fsyncDirectory(path.dirname(filePath));
}

function assertSafeRelativePath(relative: string): void {
  if (
    relative.length === 0 ||
    path.isAbsolute(relative) ||
    relative.includes('\0') ||
    relative.includes('\\') ||
    relative.split('/').includes('..') ||
    relative.split(path.sep).includes('..')
  ) {
    throw new StoreError('PATH_CONTAINMENT_FAILED', 'backup manifest path is unsafe');
  }
}

function assertCurrentOwner(uid: number, label: string): void {
  const current = process.getuid?.();
  if (current !== undefined && uid !== current) {
    throw new StoreError('PATH_CONTAINMENT_FAILED', `${label} is not owned by the current user`);
  }
}

function assertSafeBackupParent(sourceRoot: string, backupParent: string): void {
  if (
    backupParent.startsWith(`${sourceRoot}${path.sep}`) &&
    backupParent !== path.join(sourceRoot, 'backups')
  ) {
    throw new StoreError(
      'PATH_CONTAINMENT_FAILED',
      'backup destination inside the state root must be its dedicated backups directory',
    );
  }
  if (backupParent === sourceRoot) {
    throw new StoreError('PATH_CONTAINMENT_FAILED', 'backup destination cannot be the state root');
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
