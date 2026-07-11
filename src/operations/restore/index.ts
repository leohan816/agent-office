import { constants } from 'node:fs';
import { lstat, mkdir, open, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

import { DomainError } from '../../contracts/types.js';
import { assertUtcTimestamp } from '../../domain/time/index.js';
import { StoreError } from '../../persistence/file-store/errors.js';
import { isSha256 } from '../../persistence/file-store/hashing.js';
import {
  FILE_MODE,
  fsyncDirectory,
  isNodeError,
  validateStateRoot,
} from '../../persistence/file-store/path-safety.js';
import { requireReadableBuild } from '../compatibility/index.js';
import { verifyCompleteBackup } from '../backup/index.js';
import type {
  BuildCompatibilityDescriptor,
  RestoreReceipt,
  RestoreVerificationEvidence,
} from '../types.js';

const DIRECTORY_MODE = 0o700;
const REQUIRED_STATE_DIRECTORIES = [
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

export interface RestoreCheckpointBackupOptions {
  readonly backupRoot: string;
  readonly activeRoot: string;
  readonly candidateRoot: string;
  readonly build: BuildCompatibilityDescriptor;
  readonly verifiedAt: string;
  readonly verifyCandidate: (candidateRoot: string) => Promise<RestoreVerificationEvidence>;
}

export async function restoreCheckpointBackup(
  options: RestoreCheckpointBackupOptions,
): Promise<RestoreReceipt> {
  assertUtcTimestamp(options.verifiedAt, 'restore verifiedAt');
  const backup = await verifyCompleteBackup(options.backupRoot);
  requireReadableBuild(backup.manifest, options.build);
  const activeRoot = await validateStateRoot(options.activeRoot);
  const candidateRoot = await createCandidateRoot(options.candidateRoot, backup.root, activeRoot);
  for (const required of REQUIRED_STATE_DIRECTORIES) {
    await ensureCandidateDirectory(candidateRoot, required);
  }
  for (const directory of backup.manifest.directories) {
    await ensureCandidateDirectory(candidateRoot, directory.path);
  }
  for (const file of backup.manifest.files) {
    await copyPrivateFile(
      path.join(backup.dataRoot, file.path),
      path.join(candidateRoot, file.path),
    );
  }
  await fsyncDirectory(candidateRoot);
  await validateStateRoot(candidateRoot);
  const verification = await options.verifyCandidate(candidateRoot);
  assertRestoreEvidence(verification);
  if (
    verification.lastSequence !== backup.manifest.sourceSequence ||
    verification.lastEventHash !== backup.manifest.sourceEventHash ||
    verification.projectionHash !== backup.manifest.projectionHash ||
    !verification.idempotencyVerified
  ) {
    throw new StoreError('MIDSTREAM_CORRUPTION', 'restored replay evidence does not match backup');
  }
  return {
    schemaVersion: 'agent-office.restore-receipt.v1',
    backupId: backup.manifest.backupId,
    candidateRoot,
    manifestHash: backup.complete.manifestHash,
    verification,
    selected: false,
    verifiedAt: options.verifiedAt,
  };
}

export interface RestoredRootSelectionPlan {
  readonly schemaVersion: 'agent-office.restored-root-selection.v1';
  readonly activeRoot: string;
  readonly candidateRoot: string;
  readonly serviceStopped: true;
  readonly selectedByOperation: false;
  readonly requiresExplicitOperatorSelection: true;
  readonly plannedAt: string;
}

export async function planRestoredRootSelection(input: {
  readonly activeRoot: string;
  readonly candidateRoot: string;
  readonly serviceStopped: boolean;
  readonly plannedAt: string;
}): Promise<RestoredRootSelectionPlan> {
  assertUtcTimestamp(input.plannedAt, 'selection plan time');
  if (!input.serviceStopped) {
    throw new DomainError('STORE_QUARANTINED', 'restored root selection requires a stopped service');
  }
  const activeRoot = await validateStateRoot(input.activeRoot);
  const candidateRoot = await validateStateRoot(input.candidateRoot);
  if (activeRoot === candidateRoot) {
    throw new DomainError('INVALID_SCHEMA', 'candidate root must not be the active root');
  }
  return {
    schemaVersion: 'agent-office.restored-root-selection.v1',
    activeRoot,
    candidateRoot,
    serviceStopped: true,
    selectedByOperation: false,
    requiresExplicitOperatorSelection: true,
    plannedAt: input.plannedAt,
  };
}

async function createCandidateRoot(
  candidateRoot: string,
  backupRoot: string,
  activeRoot: string,
): Promise<string> {
  if (!path.isAbsolute(candidateRoot)) {
    throw new StoreError('PATH_CONTAINMENT_FAILED', 'restore candidate root must be absolute');
  }
  try {
    await lstat(candidateRoot);
    throw new StoreError('PATH_CONTAINMENT_FAILED', 'restore candidate root already exists');
  } catch (error) {
    if (!isNodeError(error, 'ENOENT')) throw error;
  }
  const parent = await realpath(path.dirname(candidateRoot));
  const parentInfo = await lstat(parent);
  const currentUid = process.getuid?.();
  if (
    parentInfo.isSymbolicLink() ||
    !parentInfo.isDirectory() ||
    (parentInfo.mode & 0o777) !== DIRECTORY_MODE ||
    (currentUid !== undefined && parentInfo.uid !== currentUid)
  ) {
    throw new StoreError(
      'PATH_CONTAINMENT_FAILED',
      'restore candidate parent must be owner-controlled',
    );
  }
  const resolvedCandidate = path.join(parent, path.basename(candidateRoot));
  if (
    resolvedCandidate === backupRoot ||
    resolvedCandidate.startsWith(`${backupRoot}${path.sep}`) ||
    resolvedCandidate === activeRoot ||
    resolvedCandidate.startsWith(`${activeRoot}${path.sep}`)
  ) {
    throw new StoreError(
      'PATH_CONTAINMENT_FAILED',
      'restore candidate must be outside the backup and active state root',
    );
  }
  await mkdir(candidateRoot, { mode: DIRECTORY_MODE });
  const canonical = await realpath(candidateRoot);
  return canonical;
}

async function ensureCandidateDirectory(root: string, relative: string): Promise<void> {
  assertSafeRelativePath(relative);
  const directory = path.join(root, relative);
  await mkdir(directory, { recursive: true, mode: DIRECTORY_MODE });
  const info = await lstat(directory);
  if (info.isSymbolicLink() || !info.isDirectory() || (info.mode & 0o777) !== DIRECTORY_MODE) {
    throw new StoreError('PATH_CONTAINMENT_FAILED', 'restored directory is not owner-only');
  }
}

async function copyPrivateFile(source: string, destination: string): Promise<void> {
  const sourceInfo = await lstat(source);
  if (sourceInfo.isSymbolicLink() || !sourceInfo.isFile() || (sourceInfo.mode & 0o777) !== FILE_MODE) {
    throw new StoreError('PATH_CONTAINMENT_FAILED', 'backup copy source is invalid');
  }
  const bytes = await readFile(source);
  const handle = await open(
    destination,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    FILE_MODE,
  );
  try {
    const written = await handle.write(bytes, 0, bytes.byteLength, 0);
    if (written.bytesWritten !== bytes.byteLength) {
      throw new StoreError('IO_DURABILITY_FAILED', 'short restore file write');
    }
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fsyncDirectory(path.dirname(destination));
}

function assertRestoreEvidence(value: RestoreVerificationEvidence): void {
  if (
    !Number.isSafeInteger(value.eventCount) ||
    value.eventCount < 0 ||
    !Number.isSafeInteger(value.firstSequence) ||
    value.firstSequence < 0 ||
    !Number.isSafeInteger(value.lastSequence) ||
    value.lastSequence < value.firstSequence ||
    (value.eventCount === 0
      ? value.firstSequence !== 0 || value.lastSequence !== 0
      : value.firstSequence < 1 ||
        value.lastSequence - value.firstSequence + 1 !== value.eventCount) ||
    !isSha256(value.lastEventHash) ||
    !isSha256(value.projectionHash)
  ) {
    throw new StoreError('MIDSTREAM_CORRUPTION', 'restore verification evidence is invalid');
  }
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
    throw new StoreError('PATH_CONTAINMENT_FAILED', 'restore path is unsafe');
  }
}
