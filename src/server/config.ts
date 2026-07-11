import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import path from 'node:path';

import { DomainError } from '../contracts/types.js';
import { assertExactKeys, assertRecord } from '../contracts/validation.js';
import { LOOPBACK_BIND_ADDRESSES, type LoopbackBindAddress } from './network/policy.js';

export interface PrivateDeploymentConfiguration {
  readonly schemaVersion: 'agent-office.loopback-deployment.v1';
  readonly networkMode: 'LOOPBACK_PRIVATE';
  readonly bindAddresses: readonly LoopbackBindAddress[];
  readonly port: number;
  readonly allowedHosts: readonly string[];
  readonly authProvider: 'NONE_READ_ONLY';
  readonly mutationMode: 'DISABLED';
  readonly cors: false;
  readonly trustProxy: false;
  readonly tls: false;
  readonly hsts: false;
}

export const DEFAULT_LOOPBACK_CONFIGURATION: PrivateDeploymentConfiguration = {
  schemaVersion: 'agent-office.loopback-deployment.v1',
  networkMode: 'LOOPBACK_PRIVATE',
  bindAddresses: ['127.0.0.1', '::1'],
  port: 4317,
  allowedHosts: ['127.0.0.1:4317', '[::1]:4317'],
  authProvider: 'NONE_READ_ONLY',
  mutationMode: 'DISABLED',
  cors: false,
  trustProxy: false,
  tls: false,
  hsts: false,
};

export async function loadPrivateDeploymentConfiguration(
  configPath: string,
): Promise<PrivateDeploymentConfiguration> {
  if (!path.isAbsolute(configPath)) {
    throw new DomainError('INVALID_SCHEMA', 'deployment configuration path must be absolute');
  }
  let handle: import('node:fs/promises').FileHandle;
  try {
    handle = await open(configPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch {
    throw new DomainError('INVALID_SCHEMA', 'deployment configuration is unavailable');
  }
  let bytes: Buffer;
  try {
    const info = await handle.stat();
    const currentUid = process.getuid?.();
    if (
      !info.isFile() ||
      (currentUid !== undefined && info.uid !== currentUid) ||
      info.size < 1 ||
      info.size > 16 * 1024
    ) {
      throw new DomainError('INVALID_SCHEMA', 'deployment configuration file is invalid');
    }
    bytes = await handle.readFile();
  } finally {
    await handle.close();
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new DomainError('INVALID_SCHEMA', 'deployment configuration is not valid UTF-8 JSON');
  }
  assertPrivateDeploymentConfiguration(value);
  return value;
}

export function assertPrivateDeploymentConfiguration(
  value: unknown,
): asserts value is PrivateDeploymentConfiguration {
  assertRecord(value, 'PrivateDeploymentConfiguration');
  assertExactKeys(
    value,
    [
      'schemaVersion',
      'networkMode',
      'bindAddresses',
      'port',
      'allowedHosts',
      'authProvider',
      'mutationMode',
      'cors',
      'trustProxy',
      'tls',
      'hsts',
    ],
    'PrivateDeploymentConfiguration',
  );
  if (
    value.schemaVersion !== 'agent-office.loopback-deployment.v1' ||
    value.networkMode !== 'LOOPBACK_PRIVATE' ||
    !Array.isArray(value.bindAddresses) ||
    value.bindAddresses.length === 0 ||
    value.bindAddresses.some(
      (address) =>
        typeof address !== 'string' ||
        !LOOPBACK_BIND_ADDRESSES.includes(address as LoopbackBindAddress),
    ) ||
    !Number.isSafeInteger(value.port) ||
    (value.port as number) < 1 ||
    (value.port as number) > 65_535 ||
    !Array.isArray(value.allowedHosts) ||
    value.allowedHosts.length !== value.bindAddresses.length ||
    value.allowedHosts.some((host) => typeof host !== 'string') ||
    value.authProvider !== 'NONE_READ_ONLY' ||
    value.mutationMode !== 'DISABLED' ||
    value.cors !== false ||
    value.trustProxy !== false ||
    value.tls !== false ||
    value.hsts !== false
  ) {
    throw new DomainError('INVALID_SCHEMA', 'private deployment configuration is invalid');
  }
  const expectedHosts = new Set(
    (value.bindAddresses as LoopbackBindAddress[]).map((address) =>
      address === '::1' ? `[::1]:${value.port as number}` : `127.0.0.1:${value.port as number}`,
    ),
  );
  if ((value.allowedHosts as string[]).some((host) => !expectedHosts.has(host))) {
    throw new DomainError('INVALID_SCHEMA', 'deployment Host allowlist is not exact loopback');
  }
}
