import { createServer, type Server } from 'node:net';
import {
  access,
  chmod,
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inspect } from 'node:util';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LOCAL_BOOTSTRAP_CAPABILITIES,
  LOCAL_BOOTSTRAP_PROOF_FILE_MAX_BYTES,
  LOCAL_BOOTSTRAP_SUBJECT_ID,
  LocalBootstrapAuthenticationProvider,
  type LocalBootstrapProofDeliveryDocument,
} from '../../src/server/index.js';
import { FIXED_TIME } from '../helpers/fixtures.js';

const roots: string[] = [];
const providers: LocalBootstrapAuthenticationProvider[] = [];
const sockets: Server[] = [];

afterEach(async () => {
  await Promise.all(providers.splice(0).map((provider) => provider.close().catch(() => undefined)));
  await Promise.all(sockets.splice(0).map((server) => new Promise<void>((resolve) => {
    server.close(() => resolve());
  })));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  vi.restoreAllMocks();
});

describe('production LocalBootstrap authentication provider', () => {
  it('delivers one high-entropy proof to a bounded 0600 file, retains only a verifier, and consumes once', async () => {
    const fixture = await providerFixture();
    const stdout = vi.spyOn(process.stdout, 'write');
    const stderr = vi.spyOn(process.stderr, 'write');
    const descriptor = await fixture.provider.beginLocalBootstrap();
    const delivery = await readDelivery(fixture.proofPath);
    const info = await lstat(fixture.proofPath);

    expect(delivery).toMatchObject({
      schemaVersion: 'agent-office.local-bootstrap-proof.v1',
      descriptorId: descriptor.descriptorId,
      expiresAt: descriptor.expiresAt,
      origin: 'http://127.0.0.1:4317',
    });
    expect(delivery.proof).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(info.isFile()).toBe(true);
    expect(info.mode & 0o777).toBe(0o600);
    if (process.getuid !== undefined) expect(info.uid).toBe(process.getuid());
    expect(info.size).toBeLessThanOrEqual(LOCAL_BOOTSTRAP_PROOF_FILE_MAX_BYTES);
    expect(inspect(fixture.provider, { depth: 6 })).not.toContain(delivery.proof);
    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).not.toHaveBeenCalled();

    const session = await fixture.provider.exchangeOneTimeProof(delivery.proof);
    expect(session).toMatchObject({
      subjectId: LOCAL_BOOTSTRAP_SUBJECT_ID,
      capabilities: LOCAL_BOOTSTRAP_CAPABILITIES,
    });
    await expect(access(fixture.proofPath)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fixture.provider.exchangeOneTimeProof(delivery.proof)).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
    });
    await expect(fixture.provider.validateSession(session.sessionHandle)).resolves.toMatchObject({
      subjectId: LOCAL_BOOTSTRAP_SUBJECT_ID,
    });
  });

  it('generates distinct proofs and never accepts caller-shaped low-entropy material', async () => {
    const first = await providerFixture('first');
    const second = await providerFixture('second');
    await first.provider.beginLocalBootstrap();
    await second.provider.beginLocalBootstrap();
    const firstDelivery = await readDelivery(first.proofPath);
    const secondDelivery = await readDelivery(second.proofPath);
    expect(firstDelivery.proof).not.toBe(secondDelivery.proof);
    await expect(first.provider.exchangeOneTimeProof('caller-selected-proof')).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
    });
  });

  it('expires and removes a pending proof without resurrecting it after restart', async () => {
    let now = FIXED_TIME;
    const fixture = await providerFixture('expiry', () => now, 1_000);
    await fixture.provider.beginLocalBootstrap();
    const expiredProof = (await readDelivery(fixture.proofPath)).proof;
    now = new Date(Date.parse(FIXED_TIME) + 1_000).toISOString();
    await expect(fixture.provider.exchangeOneTimeProof(expiredProof)).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
    });
    await expect(access(fixture.proofPath)).rejects.toMatchObject({ code: 'ENOENT' });

    const restarted = createProvider(fixture.proofPath, () => now);
    await restarted.beginLocalBootstrap();
    const replacement = await readDelivery(fixture.proofPath);
    expect(replacement.proof).not.toBe(expiredProof);
    await expect(restarted.exchangeOneTimeProof(expiredProof)).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
    });
  });

  it('fails restart closed while an ambiguous pre-existing delivery file remains', async () => {
    const fixture = await providerFixture('restart');
    await fixture.provider.beginLocalBootstrap();
    const original = await readFile(fixture.proofPath);
    const restarted = createProvider(fixture.proofPath, () => FIXED_TIME);
    await expect(restarted.beginLocalBootstrap()).rejects.toMatchObject({
      code: 'AUTH_PROVIDER_UNAVAILABLE',
    });
    expect(await readFile(fixture.proofPath)).toEqual(original);
  });

  it.each([
    ['group-accessible-directory', 0o750],
    ['other-accessible-directory', 0o701],
  ] as const)('rejects an insecure owner directory: %s', async (_label, mode) => {
    const fixture = await providerFixture('directory-mode');
    await chmod(path.dirname(fixture.proofPath), mode);
    await expect(fixture.provider.beginLocalBootstrap()).rejects.toMatchObject({
      code: 'AUTH_PROVIDER_UNAVAILABLE',
    });
    await expect(access(fixture.proofPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects symlinked directories and pre-existing regular, symlink, and socket outputs without overwrite', async () => {
    const root = await secureRoot('hostile-output');
    const realDirectory = path.join(root, 'real');
    const linkedDirectory = path.join(root, 'linked');
    await mkdir(realDirectory, { mode: 0o700 });
    await symlink(realDirectory, linkedDirectory);
    const linkedProvider = createProvider(path.join(linkedDirectory, 'proof.json'), () => FIXED_TIME);
    await expect(linkedProvider.beginLocalBootstrap()).rejects.toMatchObject({
      code: 'AUTH_PROVIDER_UNAVAILABLE',
    });

    const regularPath = path.join(realDirectory, 'regular.json');
    await writeFile(regularPath, 'preserve-me', { mode: 0o600 });
    const regularProvider = createProvider(regularPath, () => FIXED_TIME);
    await expect(regularProvider.beginLocalBootstrap()).rejects.toMatchObject({
      code: 'AUTH_PROVIDER_UNAVAILABLE',
    });
    expect(await readFile(regularPath, 'utf8')).toBe('preserve-me');

    const target = path.join(realDirectory, 'target.json');
    const linkedPath = path.join(realDirectory, 'proof-link.json');
    await writeFile(target, 'preserve-target', { mode: 0o600 });
    await symlink(target, linkedPath);
    const symlinkProvider = createProvider(linkedPath, () => FIXED_TIME);
    await expect(symlinkProvider.beginLocalBootstrap()).rejects.toMatchObject({
      code: 'AUTH_PROVIDER_UNAVAILABLE',
    });
    expect(await readFile(target, 'utf8')).toBe('preserve-target');

    const socketPath = path.join(realDirectory, 'proof.sock');
    const socket = createServer();
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('error', reject);
      socket.listen(socketPath, resolve);
    });
    const socketProvider = createProvider(socketPath, () => FIXED_TIME);
    await expect(socketProvider.beginLocalBootstrap()).rejects.toMatchObject({
      code: 'AUTH_PROVIDER_UNAVAILABLE',
    });
    expect((await lstat(socketPath)).isSocket()).toBe(true);
  });

  it('fails exchange closed if the delivered file mode changes before consumption', async () => {
    const fixture = await providerFixture('mode-race');
    await fixture.provider.beginLocalBootstrap();
    const delivery = await readDelivery(fixture.proofPath);
    await chmod(fixture.proofPath, 0o620);
    await expect(fixture.provider.exchangeOneTimeProof(delivery.proof)).rejects.toMatchObject({
      code: 'AUTH_PROVIDER_UNAVAILABLE',
    });
    await expect(fixture.provider.exchangeOneTimeProof(delivery.proof)).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
    });
  });
});

async function providerFixture(
  label = 'provider',
  now: () => string = () => FIXED_TIME,
  proofLifetimeMs?: number,
) {
  const root = await secureRoot(label);
  const directory = path.join(root, 'proof-delivery');
  await mkdir(directory, { mode: 0o700 });
  const proofPath = path.join(directory, 'local-bootstrap.json');
  const provider = createProvider(proofPath, now, proofLifetimeMs);
  return { provider, proofPath };
}

function createProvider(
  proofPath: string,
  now: () => string,
  proofLifetimeMs?: number,
): LocalBootstrapAuthenticationProvider {
  const provider = new LocalBootstrapAuthenticationProvider({
    proofDeliveryPath: proofPath,
    origin: 'http://127.0.0.1:4317',
    now,
    ...(proofLifetimeMs === undefined ? {} : { proofLifetimeMs }),
  });
  providers.push(provider);
  return provider;
}

async function secureRoot(label: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), `agent-office-local-bootstrap-${label}-`));
  roots.push(root);
  await chmod(root, 0o700);
  return root;
}

async function readDelivery(proofPath: string): Promise<LocalBootstrapProofDeliveryDocument> {
  return JSON.parse(await readFile(proofPath, 'utf8')) as LocalBootstrapProofDeliveryDocument;
}
