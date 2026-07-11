import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOOPBACK_CONFIGURATION,
  assertPrivateDeploymentConfiguration,
} from '../../src/server/index.js';

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
});
