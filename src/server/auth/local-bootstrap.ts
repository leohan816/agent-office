import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';

import { assertUtcTimestamp } from '../../domain/time/index.js';
import { HttpBoundaryError } from '../http/errors.js';
import type {
  AuthenticationProvider,
  AuthenticationSession,
  BrowserCapability,
} from './index.js';

export const LOCAL_BOOTSTRAP_PROOF_BYTES = 32;
export const LOCAL_BOOTSTRAP_PROOF_LIFETIME_MS = 15 * 60_000;
export const LOCAL_BOOTSTRAP_SESSION_LIFETIME_MS = 15 * 60_000;
export const LOCAL_BOOTSTRAP_PROOF_FILE_MAX_BYTES = 4 * 1024;
export const LOCAL_BOOTSTRAP_SUBJECT_ID = 'local-bootstrap-leo';
export const LOCAL_BOOTSTRAP_CAPABILITIES = ['viewer', 'leo_input'] as const satisfies readonly BrowserCapability[];

export interface LocalBootstrapAuthenticationProviderOptions {
  readonly proofDeliveryPath: string;
  readonly origin: string;
  readonly now: () => string;
  readonly proofLifetimeMs?: number;
  readonly sessionLifetimeMs?: number;
}

interface PendingProof {
  readonly descriptorId: string;
  readonly expiresAt: string;
  readonly salt: Buffer;
  readonly verifier: Buffer;
  readonly fileIdentity: {
    readonly device: number;
    readonly inode: number;
  };
}

export interface LocalBootstrapProofDeliveryDocument {
  readonly schemaVersion: 'agent-office.local-bootstrap-proof.v1';
  readonly descriptorId: string;
  readonly proof: string;
  readonly expiresAt: string;
  readonly origin: string;
}

export class LocalBootstrapAuthenticationProvider implements AuthenticationProvider {
  private readonly sessions = new Map<string, AuthenticationSession>();
  private readonly proofLifetimeMs: number;
  private readonly sessionLifetimeMs: number;
  private pending: PendingProof | undefined;
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;
  private started = false;
  private closed = false;

  public constructor(private readonly options: LocalBootstrapAuthenticationProviderOptions) {
    if (
      !path.isAbsolute(options.proofDeliveryPath) ||
      options.proofDeliveryPath.length > 4096 ||
      options.proofDeliveryPath.includes('\0') ||
      options.origin !== 'http://127.0.0.1:4317'
    ) {
      throw unavailable();
    }
    this.proofLifetimeMs = boundedLifetime(
      options.proofLifetimeMs ?? LOCAL_BOOTSTRAP_PROOF_LIFETIME_MS,
    );
    this.sessionLifetimeMs = boundedLifetime(
      options.sessionLifetimeMs ?? LOCAL_BOOTSTRAP_SESSION_LIFETIME_MS,
    );
  }

  public async beginLocalBootstrap(): Promise<{
    readonly descriptorId: string;
    readonly expiresAt: string;
    readonly testOnly: false;
  }> {
    if (this.started || this.closed) throw unavailable();
    this.started = true;
    const now = this.now();
    const descriptorId = opaqueValue();
    const expiresAt = new Date(Date.parse(now) + this.proofLifetimeMs).toISOString();
    const proofBytes = randomBytes(LOCAL_BOOTSTRAP_PROOF_BYTES);
    const proof = proofBytes.toString('base64url');
    proofBytes.fill(0);
    const salt = randomBytes(32);
    const verifier = proofVerifier(salt, proof);
    const output = Buffer.from(`${JSON.stringify({
      schemaVersion: 'agent-office.local-bootstrap-proof.v1',
      descriptorId,
      proof,
      expiresAt,
      origin: this.options.origin,
    } satisfies LocalBootstrapProofDeliveryDocument)}\n`, 'utf8');
    try {
      const fileIdentity = await writeProofFile(this.options.proofDeliveryPath, output);
      this.pending = { descriptorId, expiresAt, salt, verifier, fileIdentity };
      this.expiryTimer = setTimeout(() => {
        const pending = this.pending;
        if (pending !== undefined) void this.expirePending(pending).catch(() => undefined);
      }, this.proofLifetimeMs);
      return { descriptorId, expiresAt, testOnly: false };
    } catch {
      salt.fill(0);
      verifier.fill(0);
      throw unavailable();
    } finally {
      output.fill(0);
    }
  }

  public async exchangeOneTimeProof(proof: string): Promise<AuthenticationSession> {
    const pending = this.pending;
    if (
      pending === undefined ||
      this.closed ||
      !/^[A-Za-z0-9_-]{43}$/u.test(proof)
    ) {
      throw authenticationRequired();
    }
    if (Date.parse(this.now()) >= Date.parse(pending.expiresAt)) {
      await this.expirePending(pending).catch(() => undefined);
      throw authenticationRequired();
    }
    const candidate = proofVerifier(pending.salt, proof);
    const valid = candidate.byteLength === pending.verifier.byteLength &&
      timingSafeEqual(candidate, pending.verifier);
    candidate.fill(0);
    if (!valid) throw authenticationRequired();

    this.consumePending(pending);
    try {
      await removeExactProofFile(this.options.proofDeliveryPath, pending.fileIdentity);
    } catch {
      throw unavailable();
    } finally {
      pending.salt.fill(0);
      pending.verifier.fill(0);
    }
    const now = this.now();
    const session: AuthenticationSession = {
      subjectId: LOCAL_BOOTSTRAP_SUBJECT_ID,
      capabilities: [...LOCAL_BOOTSTRAP_CAPABILITIES],
      sessionHandle: opaqueValue(),
      expiresAt: new Date(Date.parse(now) + this.sessionLifetimeMs).toISOString(),
    };
    this.sessions.set(session.sessionHandle, session);
    return session;
  }

  public validateSession(sessionHandle: string): Promise<AuthenticationSession | undefined> {
    const session = this.sessions.get(sessionHandle);
    if (session === undefined || this.closed) return Promise.resolve(undefined);
    if (Date.parse(this.now()) >= Date.parse(session.expiresAt)) {
      this.sessions.delete(sessionHandle);
      return Promise.resolve(undefined);
    }
    return Promise.resolve({ ...session, capabilities: [...session.capabilities] });
  }

  public revokeSession(sessionHandle: string): Promise<{ readonly revoked: boolean }> {
    return Promise.resolve({ revoked: this.sessions.delete(sessionHandle) });
  }

  public async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.sessions.clear();
    const pending = this.pending;
    if (pending === undefined) return;
    this.consumePending(pending);
    try {
      await removeExactProofFile(this.options.proofDeliveryPath, pending.fileIdentity);
    } finally {
      pending.salt.fill(0);
      pending.verifier.fill(0);
    }
  }

  private async expirePending(pending: PendingProof): Promise<void> {
    if (this.pending !== pending) return;
    this.consumePending(pending);
    try {
      await removeExactProofFile(this.options.proofDeliveryPath, pending.fileIdentity);
    } finally {
      pending.salt.fill(0);
      pending.verifier.fill(0);
    }
  }

  private consumePending(pending: PendingProof): void {
    if (this.pending === pending) this.pending = undefined;
    if (this.expiryTimer !== undefined) clearTimeout(this.expiryTimer);
    this.expiryTimer = undefined;
  }

  private now(): string {
    const value = this.options.now();
    assertUtcTimestamp(value, 'LocalBootstrap authentication time');
    return value;
  }
}

async function writeProofFile(
  proofPath: string,
  bytes: Buffer,
): Promise<{ readonly device: number; readonly inode: number }> {
  if (bytes.byteLength < 1 || bytes.byteLength > LOCAL_BOOTSTRAP_PROOF_FILE_MAX_BYTES) {
    throw unavailable();
  }
  const parent = path.dirname(proofPath);
  const parentInfo = await lstat(parent).catch(() => undefined);
  const canonicalParent = await realpath(parent).catch(() => undefined);
  const currentUid = process.getuid?.();
  if (
    parentInfo === undefined ||
    parentInfo.isSymbolicLink() ||
    !parentInfo.isDirectory() ||
    canonicalParent !== parent ||
    (currentUid !== undefined && parentInfo.uid !== currentUid) ||
    (parentInfo.mode & 0o077) !== 0 ||
    (parentInfo.mode & 0o300) !== 0o300
  ) {
    throw unavailable();
  }

  let handle: import('node:fs/promises').FileHandle | undefined;
  let created = false;
  try {
    handle = await open(
      proofPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    created = true;
    await handle.chmod(0o600);
    const info = await handle.stat();
    if (
      !info.isFile() ||
      (currentUid !== undefined && info.uid !== currentUid) ||
      (info.mode & 0o777) !== 0o600
    ) {
      throw unavailable();
    }
    await handle.writeFile(bytes);
    await handle.sync();
    const written = await handle.stat();
    if (written.size !== bytes.byteLength || written.size > LOCAL_BOOTSTRAP_PROOF_FILE_MAX_BYTES) {
      throw unavailable();
    }
    await handle.close();
    handle = undefined;
    await syncDirectory(parent);
    return { device: written.dev, inode: written.ino };
  } catch {
    await handle?.close().catch(() => undefined);
    if (created) await unlink(proofPath).catch(() => undefined);
    throw unavailable();
  }
}

async function removeExactProofFile(
  proofPath: string,
  expected: { readonly device: number; readonly inode: number },
): Promise<void> {
  const info = await lstat(proofPath).catch(() => undefined);
  const currentUid = process.getuid?.();
  if (
    info === undefined ||
    info.isSymbolicLink() ||
    !info.isFile() ||
    info.dev !== expected.device ||
    info.ino !== expected.inode ||
    (currentUid !== undefined && info.uid !== currentUid) ||
    (info.mode & 0o777) !== 0o600 ||
    info.size < 1 ||
    info.size > LOCAL_BOOTSTRAP_PROOF_FILE_MAX_BYTES
  ) {
    throw unavailable();
  }
  await unlink(proofPath);
  await syncDirectory(path.dirname(proofPath));
}

async function syncDirectory(directory: string): Promise<void> {
  const handle = await open(
    directory,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function proofVerifier(salt: Buffer, proof: string): Buffer {
  return createHash('sha256')
    .update('agent-office.local-bootstrap-proof.v1\0', 'utf8')
    .update(salt)
    .update(proof, 'utf8')
    .digest();
}

function opaqueValue(): string {
  return randomBytes(32).toString('base64url');
}

function boundedLifetime(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1_000 || value > 60 * 60_000) {
    throw unavailable();
  }
  return value;
}

function unavailable(): HttpBoundaryError {
  return new HttpBoundaryError(
    'AUTH_PROVIDER_UNAVAILABLE',
    503,
    'LocalBootstrap authentication provider is unavailable',
  );
}

function authenticationRequired(): HttpBoundaryError {
  return new HttpBoundaryError(
    'AUTHENTICATION_REQUIRED',
    401,
    'LocalBootstrap proof is invalid, expired, or consumed',
  );
}
