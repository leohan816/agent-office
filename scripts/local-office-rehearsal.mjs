// Agent Office Batch A — local Living Office loopback rehearsal (WU-08).
//
// Documented start/open/verify/stop procedure, rehearsed directly on 127.0.0.1:
//   1. verify the fresh production build emits the Office as a SEPARATE lazy chunk while the eager
//      entry stays Pixi-free (CD-3 at the built-artifact level);
//   2. START the loopback-only private runtime (LOOPBACK_PRIVATE, NONE_READ_ONLY);
//   3. OPEN the served shell + a hashed asset; VERIFY status (AUTH_BLOCKED) and the fail-closed
//      protected projection (503, auth required — no fixture/office data leaks unauthenticated);
//   4. STOP the runtime and verify a clean teardown: the port rebinds and the writer lock is released
//      (zero retained listener / lock).
// Run after `npm run build`. This script starts no delivery, creates no credential, sends no tmux
// input, and touches no protected/live system.
import { createServer } from 'node:net';
import { access, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { startAgentOfficeComposition } from '../dist/core/runtime/composition.js';
import { initializeStateRoot } from '../dist/core/persistence/file-store/path-safety.js';
import {
  createCurrentTestObservationRunner,
  createExplicitTestOperationalConfiguration,
} from './runtime-test-fixture.mjs';

const appRoot = path.resolve(import.meta.dirname, '..');
const distDashboard = path.join(appRoot, 'dist/dashboard');
const stateRoot = await mkdtemp(path.join(tmpdir(), 'agent-office-living-office-rehearsal-'));
let composition;

function require(condition, code) {
  if (!condition) throw new Error(code);
}

try {
  // 1. Built-artifact Office isolation (CD-3): the eager index chunk is Pixi-free; the Office renderer
  //    lives in a separate lazy chunk that carries the truthful production eyebrow, not fixtures.
  const assetsDir = path.join(distDashboard, 'assets');
  const assetFiles = (await readdir(assetsDir)).filter((name) => name.endsWith('.js'));
  const assetBodies = new Map(await Promise.all(assetFiles.map(async (name) =>
    [name, await readFile(path.join(assetsDir, name), 'utf8')])));
  const officeChunks = [...assetBodies].filter(([, body]) => body.includes('AUTHENTICATED LIVING OFFICE'));
  const pixiChunks = [...assetBodies].filter(([, body]) => /@pixi|pixi\.js/u.test(body));
  const indexHtml = await readFile(path.join(distDashboard, 'index.html'), 'utf8');
  const eagerEntry = /src="(\/assets\/index-[A-Za-z0-9._-]+\.js)"/u.exec(indexHtml)?.[1];
  require(eagerEntry !== undefined, 'EAGER_ENTRY_MISSING');
  const eagerBody = assetBodies.get(path.basename(eagerEntry)) ?? '';
  require(officeChunks.length >= 1, 'OFFICE_CHUNK_MISSING');
  require(pixiChunks.length >= 1, 'PIXI_CHUNK_MISSING');
  require(!/@pixi|pixi\.js/u.test(eagerBody), 'EAGER_ENTRY_NOT_PIXI_FREE');
  require(!eagerBody.includes('SYNTHETIC PROTOTYPE'), 'EAGER_ENTRY_PROTOTYPE_MARKER');

  // 2-3. START + OPEN + VERIFY on loopback.
  const observationTime = new Date().toISOString();
  await initializeStateRoot(stateRoot, { stateRootId: 'living-office-rehearsal', initializedAt: observationTime });
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
    staticRoot: distDashboard,
    operationalConfiguration,
    readonlyToolRunner: createCurrentTestObservationRunner(appRoot, observationTime),
    buildId: 'agent-office-living-office-rehearsal',
  });
  const origin = composition.primaryOrigin;
  const shellResponse = await fetch(origin);
  const shell = await shellResponse.text();
  const assetPath = /(?:src|href)="(\/assets\/[A-Za-z0-9._-]+)"/u.exec(shell)?.[1];
  require(assetPath !== undefined, 'BUILT_ASSET_MISSING');
  const assetResponse = await fetch(`${origin}${assetPath}`);
  const statusResponse = await fetch(`${origin}/api/v1/status`);
  const status = await statusResponse.json();
  const projectionResponse = await fetch(`${origin}/api/v1/projection`);
  const projectionFailure = await projectionResponse.json();

  // 4. STOP + verify clean teardown.
  await composition.close();
  composition = undefined;
  const listenerRebind = await canBind(port);
  let writerLockReleased = false;
  try {
    await access(path.join(stateRoot, 'locks', 'writer.lock'));
  } catch (error) {
    writerLockReleased = error instanceof Error && 'code' in error && error.code === 'ENOENT';
  }

  require(shellResponse.status === 200, 'SHELL_STATUS_INVALID');
  require(assetResponse.status === 200, 'ASSET_STATUS_INVALID');
  require(status.startupState === 'AUTH_BLOCKED', 'STARTUP_STATE_INVALID');
  require(status.authMode === 'UNAVAILABLE_READ_ONLY', 'AUTH_MODE_INVALID');
  require(status.mutationMode === 'DISABLED', 'MUTATION_MODE_INVALID');
  require(projectionResponse.status === 503, 'PROJECTION_NOT_FAIL_CLOSED');
  require(projectionFailure.code === 'AUTH_PROVIDER_UNAVAILABLE', 'PROJECTION_CODE_INVALID');
  require(listenerRebind, 'LISTENER_NOT_RELEASED');
  require(writerLockReleased, 'WRITER_LOCK_NOT_RELEASED');

  process.stdout.write(`${JSON.stringify({
    schemaVersion: 'agent-office.living-office-rehearsal.v1',
    bind: '127.0.0.1',
    officeChunkCount: officeChunks.length,
    officeChunk: officeChunks[0]?.[0],
    pixiChunkCount: pixiChunks.length,
    eagerEntry: path.basename(eagerEntry),
    eagerPixiFree: !/@pixi|pixi\.js/u.test(eagerBody),
    shellStatus: shellResponse.status,
    assetStatus: assetResponse.status,
    startupState: status.startupState,
    authMode: status.authMode,
    mutationMode: status.mutationMode,
    projectionStatus: projectionResponse.status,
    projectionCode: projectionFailure.code,
    listenerRebind,
    writerLockReleased,
  })}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    schemaVersion: 'agent-office.living-office-rehearsal-error.v1',
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
