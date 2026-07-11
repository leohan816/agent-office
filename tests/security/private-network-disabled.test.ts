import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_LOOPBACK_CONFIGURATION,
  assertPrivateDeploymentConfiguration,
  loadPrivateDeploymentConfiguration,
  type LocalBootstrapPrivateDeploymentConfiguration,
} from '../../src/server/index.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('private deployment configuration', () => {
  it('is loopback-only, read-only without auth, and makes no TLS/HSTS/CORS/proxy claim', async () => {
    const configured = JSON.parse(
      await readFile(new URL('../../config/agent-office.loopback.json', import.meta.url), 'utf8'),
    ) as unknown;
    expect(() => assertPrivateDeploymentConfiguration(configured)).not.toThrow();
    expect(configured).toEqual(DEFAULT_LOOPBACK_CONFIGURATION);
  });

  it('rejects private-network, wildcard, mutation, provider, proxy, and TLS changes', () => {
    for (const mutation of [
      { bindAddresses: ['0.0.0.0'] },
      { allowedHosts: ['agent-office.local:4317'] },
      { authProvider: 'OIDC' },
      { mutationMode: 'ENABLED' },
      { cors: true },
      { trustProxy: true },
      { tls: true },
      { hsts: true },
    ]) {
      expect(() => assertPrivateDeploymentConfiguration({
        ...DEFAULT_LOOPBACK_CONFIGURATION,
        ...mutation,
      })).toThrow();
    }
  });

  it('accepts only the exact v2 loopback LocalBootstrap and mutation pairing at port 4317', () => {
    expect(() => assertPrivateDeploymentConfiguration(localBootstrapConfiguration())).not.toThrow();
    for (const mutation of [
      { port: 4318, allowedHosts: ['127.0.0.1:4318'] },
      { bindAddresses: ['::1'], allowedHosts: ['[::1]:4317'] },
      { authProvider: 'NONE_READ_ONLY' },
      { mutationMode: 'DISABLED' },
      { bootstrapProofFile: 'relative/proof.json' },
      { bootstrapProofFile: '/tmp/proof.json', allowedHosts: ['localhost:4317'] },
      { trustProxy: true },
      { tls: true },
    ]) {
      expect(() => assertPrivateDeploymentConfiguration({
        ...localBootstrapConfiguration(),
        ...mutation,
      })).toThrow();
    }
  });

  it.each([
    ['0400', 0o400, true],
    ['0600', 0o600, true],
    ['0620', 0o620, false],
    ['0602', 0o602, false],
    ['0666', 0o666, false],
  ] as const)('enforces trusted deployment config mode %s', async (_label, mode, accepted) => {
    const root = await mkdtemp(path.join(tmpdir(), 'agent-office-deployment-config-mode-'));
    roots.push(root);
    const configPath = path.join(root, 'deployment.json');
    await writeFile(configPath, `${JSON.stringify(localBootstrapConfiguration())}\n`, { mode: 0o600 });
    await chmod(configPath, mode);
    const operation = loadPrivateDeploymentConfiguration(configPath);
    if (accepted) {
      await expect(operation).resolves.toMatchObject({ authProvider: 'LOCAL_BOOTSTRAP' });
    } else {
      await expect(operation).rejects.toMatchObject({ code: 'INVALID_SCHEMA' });
    }
  });
});

function localBootstrapConfiguration(): LocalBootstrapPrivateDeploymentConfiguration {
  return {
    schemaVersion: 'agent-office.loopback-deployment.v2',
    networkMode: 'LOOPBACK_PRIVATE',
    bindAddresses: ['127.0.0.1'],
    port: 4317,
    allowedHosts: ['127.0.0.1:4317'],
    authProvider: 'LOCAL_BOOTSTRAP',
    mutationMode: 'ENABLED_LOCAL_BOOTSTRAP',
    bootstrapProofFile: '/tmp/agent-office-test-bootstrap/proof.json',
    cors: false,
    trustProxy: false,
    tls: false,
    hsts: false,
  };
}
