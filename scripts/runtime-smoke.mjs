import { createServer } from 'node:net';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { startAgentOfficeComposition } from '../dist/core/runtime/composition.js';
import { initializeStateRoot } from '../dist/core/persistence/file-store/path-safety.js';
import { parseArguments } from '../dist/core/runtime/cli.js';
import {
  createCurrentTestObservationRunner,
  createExplicitTestOperationalConfiguration,
} from './runtime-test-fixture.mjs';

const appRoot = path.resolve(import.meta.dirname, '..');
const stateRoot = await mkdtemp(path.join(tmpdir(), 'agent-office-runtime-smoke-'));
let composition;

try {
  const observationTime = new Date().toISOString();
  await initializeStateRoot(stateRoot, {
    stateRootId: 'runtime-smoke-disposable',
    initializedAt: new Date().toISOString(),
  });
  const port = await reservePort();
  const operationalConfiguration = await createExplicitTestOperationalConfiguration(appRoot);
  composition = await startAgentOfficeComposition({
    configuration: {
      schemaVersion: 'agent-office.loopback-deployment.v1',
      networkMode: 'LOOPBACK_PRIVATE',
      bindAddresses: ['127.0.0.1'],
      port,
      allowedHosts: [`127.0.0.1:${port}`],
      authProvider: 'NONE_READ_ONLY',
      mutationMode: 'DISABLED',
      cors: false,
      trustProxy: false,
      tls: false,
      hsts: false,
    },
    appRoot,
    stateRoot,
    staticRoot: path.join(appRoot, 'dist/dashboard'),
    operationalConfiguration,
    readonlyToolRunner: createCurrentTestObservationRunner(appRoot, observationTime),
    buildId: 'agent-office-runtime-explicit-input-smoke',
  });
  const origin = composition.primaryOrigin;
  const shellResponse = await fetch(origin);
  const shell = await shellResponse.text();
  const assetPath = /(?:src|href)="(\/assets\/[A-Za-z0-9._-]+)"/u.exec(shell)?.[1];
  if (assetPath === undefined) throw new Error('BUILT_ASSET_MISSING');
  const assetResponse = await fetch(`${origin}${assetPath}`);
  const assetBody = await assetResponse.text();
  const statusResponse = await fetch(`${origin}/api/v1/status`);
  const status = await statusResponse.json();
  const projectionResponse = await fetch(`${origin}/api/v1/projection`);
  const projectionFailure = await projectionResponse.json();
  await composition.close();
  composition = undefined;
  const listenerRebind = await canBind(port);
  let writerLockReleased = false;
  try {
    await access(path.join(stateRoot, 'locks', 'writer.lock'));
  } catch (error) {
    writerLockReleased = error instanceof Error && 'code' in error && error.code === 'ENOENT';
  }
  requireSmoke(shellResponse.status === 200, 'SHELL_STATUS_INVALID');
  requireSmoke(assetResponse.status === 200, 'ASSET_STATUS_INVALID');
  requireSmoke(
    assetResponse.headers.get('cache-control') === 'public, max-age=31536000, immutable',
    'ASSET_CACHE_INVALID',
  );
  requireSmoke(!assetBody.includes('Synthetic critical alert boundary fixture'), 'FIXTURE_LEAKED');
  requireSmoke(statusResponse.status === 200, 'STATUS_ENDPOINT_INVALID');
  requireSmoke(status.startupState === 'AUTH_BLOCKED', 'STARTUP_STATE_INVALID');
  requireSmoke(status.authMode === 'UNAVAILABLE_READ_ONLY', 'AUTH_MODE_INVALID');
  requireSmoke(status.mutationMode === 'DISABLED', 'MUTATION_MODE_INVALID');
  requireSmoke(status.deliveryMode === 'MANUAL_FALLBACK_REQUIRED', 'DELIVERY_MODE_INVALID');
  requireSmoke(projectionResponse.status === 503, 'PROJECTION_STATUS_INVALID');
  requireSmoke(projectionFailure.code === 'AUTH_PROVIDER_UNAVAILABLE', 'PROJECTION_CODE_INVALID');
  requireSmoke(listenerRebind, 'LISTENER_NOT_RELEASED');
  requireSmoke(writerLockReleased, 'WRITER_LOCK_NOT_RELEASED');
  let noFixtureFallback = false;
  try {
    parseArguments(['--state-root', stateRoot]);
  } catch {
    noFixtureFallback = true;
  }
  requireSmoke(noFixtureFallback, 'RUNTIME_CONFIG_FALLBACK_PRESENT');
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 'agent-office.runtime-smoke.v1',
    bind: '127.0.0.1',
    shellStatus: shellResponse.status,
    assetStatus: assetResponse.status,
    assetCache: assetResponse.headers.get('cache-control'),
    statusCode: statusResponse.status,
    startupState: status.startupState,
    authMode: status.authMode,
    mutationMode: status.mutationMode,
    deliveryMode: status.deliveryMode,
    projectionStatus: projectionResponse.status,
    projectionCode: projectionFailure.code,
    listenerRebind,
    writerLockReleased,
    explicitManifestSourceId: operationalConfiguration.missionSourceId,
    noFixtureFallback,
  })}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    schemaVersion: 'agent-office.runtime-smoke-error.v1',
    code: error instanceof Error ? error.message.replace(/[^A-Z0-9._-]/gu, '_') : 'UNKNOWN',
  })}\n`);
  process.exitCode = 1;
} finally {
  await composition?.close().catch(() => undefined);
  await rm(stateRoot, { recursive: true, force: true });
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('LISTENER_ADDRESS_MISSING');
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function canBind(port) {
  const server = createServer();
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
    return true;
  } finally {
    await new Promise((resolve) => server.close(() => resolve()));
  }
}

function requireSmoke(condition, code) {
  if (!condition) throw new Error(code);
}
