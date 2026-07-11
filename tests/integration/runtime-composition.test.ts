import { createServer } from 'node:net';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import type { SubmitAdvisorMessage } from '../../src/domain/messages/index.js';
import { initializeStateRoot } from '../../src/persistence/file-store/path-safety.js';
import type { PrivateDeploymentConfiguration } from '../../src/server/config.js';
import { startAgentOfficeComposition } from '../../src/runtime/composition.js';
import type { AgentOfficeRuntimeIdentity } from '../../src/runtime/identity.js';
import { startSyntheticTestComposition } from '../../src/runtime/test-composition.js';
import {
  AgentOfficeRuntimeClient,
  type RuntimeClientState,
  type RuntimeHttpTransport,
} from '../../src/ui/runtime/client.js';
import { FIXED_TIME, MISSION_ID, uuidV7 } from '../helpers/fixtures.js';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const temporaryRoots: string[] = [];
const closeables: { close(): Promise<void> }[] = [];
const clients: AgentOfficeRuntimeClient[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) client.stop();
  await Promise.all(closeables.splice(0).map((item) => item.close().catch(() => undefined)));
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('executable loopback composition and production runtime client', () => {
  it('serves the built shell and remains AUTH_BLOCKED/read-only with no provider', async () => {
    const fixture = await compositionPaths();
    const port = await reservePort();
    const configuration = loopbackConfiguration(port);
    const composition = await startAgentOfficeComposition({
      configuration,
      ...fixture,
      buildId: 'runtime-production-test',
      runtime: deterministicRuntime(8000),
    });
    closeables.push(composition);
    const shell = await fetch(composition.primaryOrigin);
    expect(shell.status).toBe(200);
    expect(await shell.text()).toContain('agent-office-built-shell');
    const status = await fetch(`${composition.primaryOrigin}/api/v1/status`);
    expect(await status.json()).toMatchObject({
      networkMode: 'LOOPBACK_PRIVATE',
      startupState: 'AUTH_BLOCKED',
      authMode: 'UNAVAILABLE_READ_ONLY',
      mutationMode: 'DISABLED',
    });
    const projection = await fetch(`${composition.primaryOrigin}/api/v1/projection`);
    expect(projection.status).toBe(503);
    expect(await projection.json()).toMatchObject({ code: 'AUTH_PROVIDER_UNAVAILABLE' });
    const mutation = await fetch(`${composition.primaryOrigin}/api/v1/advisor/messages`, {
      method: 'POST',
      headers: productionMutationHeaders(composition.primaryOrigin),
      body: JSON.stringify(messageCommand(8100)),
    });
    expect(mutation.status).toBe(503);
    expect(await mutation.json()).toMatchObject({ code: 'AUTH_PROVIDER_UNAVAILABLE' });
    expect((await fetch(`${composition.primaryOrigin}/api/v1/workers/dispatch`, {
      method: 'POST',
      headers: productionMutationHeaders(composition.primaryOrigin),
      body: '{}',
    })).status).toBe(404);

    const origin = composition.primaryOrigin;
    await composition.close();
    removeCloseable(composition);
    await expect(fetch(`${origin}/health/live`)).rejects.toThrow();
    await expect(access(path.join(fixture.stateRoot, 'locks', 'writer.lock'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    const restarted = await startAgentOfficeComposition({
      configuration,
      ...fixture,
      buildId: 'runtime-production-restart-test',
      runtime: deterministicRuntime(8200),
    });
    closeables.push(restarted);
    expect((await fetch(`${restarted.primaryOrigin}/health/live`)).status).toBe(200);
  });

  it('loads an application projection, consumes SSE, and persists one message idempotently through the runtime client', async () => {
    const fixture = await compositionPaths();
    const port = await reservePort();
    const runtime = mutableRuntime(8300);
    let opaque = 0;
    const synthetic = await startSyntheticTestComposition({
      configuration: loopbackConfiguration(port),
      ...fixture,
      buildId: 'runtime-synthetic-test',
      runtime,
      syntheticProof: 'synthetic-runtime-proof-value',
      subjectId: 'synthetic-runtime-subject',
      capabilities: ['viewer', 'leo_input', 'advisor_operator'],
      nextOpaque: () => `synthetic_runtime_${String(opaque++).padStart(32, '0')}`,
      heartbeatMs: 20,
    });
    closeables.push(synthetic.composition);
    const client = new AgentOfficeRuntimeClient({
      origin: synthetic.composition.primaryOrigin,
      transport: syntheticTransport(
        synthetic.composition.primaryOrigin,
        synthetic.session.cookieHandle,
      ),
      reconnectDelayMs: 10,
      now: () => runtime.now(),
      nextRequestId: () => uuidV7(8400),
    });
    clients.push(client);
    await client.start();
    await waitForState(client, (state) => state.sseState === 'READY');
    expect(client.snapshot()).toMatchObject({
      phase: 'PROJECTION_READY',
      projection: {
        revision: 0,
        missionId: MISSION_ID,
        dashboard: { fixtureKind: 'APPLICATION_PROJECTION' },
        communication: { fixtureKind: 'APPLICATION_PROJECTION' },
      },
      subject: { capabilities: ['viewer', 'leo_input', 'advisor_operator'] },
    });
    const actionPort = client.communicationActionPort();
    expect(actionPort).toBeDefined();
    const command = messageCommand(8500);
    const first = await actionPort?.submitAdvisorMessage(command);
    expect(first).toMatchObject({ status: 'PERSISTED', replayed: false });
    await waitForState(client, (state) => state.projection?.revision === 1);
    const replay = await actionPort?.submitAdvisorMessage(command);
    expect(replay).toEqual({ ...first, replayed: true });
    expect(synthetic.composition.store.sequence).toBe(1);
    expect(Object.keys(synthetic.composition.inbox.project().messages)).toHaveLength(1);
  });

  it('closes SSE and removes mutation capability on session revocation and expiry', async () => {
    for (const mode of ['REVOKE', 'EXPIRE'] as const) {
      const fixture = await compositionPaths();
      const runtime = mutableRuntime(mode === 'REVOKE' ? 8600 : 8700);
      const port = await reservePort();
      let opaque = 0;
      const synthetic = await startSyntheticTestComposition({
        configuration: loopbackConfiguration(port),
        ...fixture,
        buildId: `runtime-session-${mode.toLowerCase()}-test`,
        runtime,
        syntheticProof: `synthetic-runtime-${mode.toLowerCase()}-proof`,
        subjectId: `synthetic-${mode.toLowerCase()}-subject`,
        capabilities: ['viewer', 'leo_input'],
        nextOpaque: () => `synthetic_session_${String(opaque++).padStart(32, '0')}`,
        sessionLifetimeMs: mode === 'EXPIRE' ? 25 : 60_000,
        heartbeatMs: 10,
      });
      closeables.push(synthetic.composition);
      const client = new AgentOfficeRuntimeClient({
        origin: synthetic.composition.primaryOrigin,
        transport: syntheticTransport(
          synthetic.composition.primaryOrigin,
          synthetic.session.cookieHandle,
        ),
        reconnectDelayMs: 10,
      });
      clients.push(client);
      await client.start();
      await waitForState(client, (state) => state.sseState === 'READY');
      expect(client.communicationActionPort()).toBeDefined();
      if (mode === 'REVOKE') await synthetic.sessions.revoke(synthetic.session.cookieHandle);
      else runtime.advance(100);
      await waitForState(client, (state) => state.phase === 'SESSION_EXPIRED');
      expect(client.communicationActionPort()).toBeUndefined();
      expect(synthetic.composition.sse.connectionCount()).toBe(0);
      client.stop();
      removeClient(client);
      await synthetic.composition.close();
      removeCloseable(synthetic.composition);
    }
  });

  it('keeps the synthetic UI behind the explicit test-demo build mode', async () => {
    const [main, demo, vite, playwright] = await Promise.all([
      readFile(path.join(projectRoot, 'src/ui/main.tsx'), 'utf8'),
      readFile(path.join(projectRoot, 'src/ui/demo-entry.tsx'), 'utf8'),
      readFile(path.join(projectRoot, 'vite.config.ts'), 'utf8'),
      readFile(path.join(projectRoot, 'playwright.config.ts'), 'utf8'),
    ]);
    expect(main).toContain("from 'virtual:agent-office-entry'");
    expect(main).not.toContain("./fixtures/dashboard.js");
    expect(main).not.toContain("./communication/fixtures.js");
    expect(demo).toContain('CURRENT_DASHBOARD_VIEW_MODEL');
    expect(vite).toContain("mode === 'test-demo'");
    expect(vite).toContain('src/ui/runtime/entry.tsx');
    expect(vite).toContain('src/ui/demo-entry.tsx');
    expect(playwright).toContain('build:dashboard:test');
  });
});

async function compositionPaths() {
  const root = await createTemporaryRoot('agent-office-composition-');
  const stateRoot = path.join(root, 'state');
  const staticRoot = path.join(root, 'built-dashboard');
  await initializeStateRoot(stateRoot, {
    stateRootId: `composition-${path.basename(root)}`,
    initializedAt: FIXED_TIME,
  });
  await createBuiltShell(staticRoot);
  return {
    appRoot: projectRoot,
    stateRoot,
    staticRoot,
    manifestPath: path.join(projectRoot, 'fixtures/manifests/agent-office-m01.v1.json'),
    manifestSourcePath: path.join(
      projectRoot,
      'fixtures/manifests/agent-office-m01.v1.source.json',
    ),
  };
}

async function createTemporaryRoot(prefix: string): Promise<string> {
  const { mkdtemp } = await import('node:fs/promises');
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

async function createBuiltShell(root: string): Promise<void> {
  await mkdir(path.join(root, 'assets'), { recursive: true });
  await mkdir(path.join(root, 'icons'), { recursive: true });
  await writeFile(
    path.join(root, 'index.html'),
    '<!doctype html><title>agent-office-built-shell</title><script type="module" src="/assets/app-12345678.js"></script>',
  );
  await writeFile(path.join(root, 'assets/app-12345678.js'), 'globalThis.__AO_BUILT_SHELL__ = true;');
  await writeFile(path.join(root, 'manifest.webmanifest'), '{"name":"Agent Office"}');
  await writeFile(path.join(root, 'sw.js'), 'self.addEventListener("fetch", () => {});');
  await writeFile(path.join(root, 'icons/agent-office.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await writeFile(path.join(root, 'icons/agent-office-maskable.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
}

function loopbackConfiguration(port: number): PrivateDeploymentConfiguration {
  return {
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
  };
}

function productionMutationHeaders(origin: string): Readonly<Record<string, string>> {
  return {
    Origin: origin,
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Content-Type': 'application/json; charset=utf-8',
    'X-AO-CSRF': 'synthetic-value-cannot-authorize',
  };
}

function syntheticTransport(
  origin: string,
  cookieHandle: string,
): RuntimeHttpTransport {
  return {
    fetch: (input, init = {}) => {
      const headers = new Headers(init.headers);
      headers.set('Cookie', `AO_SESSION=${cookieHandle}`);
      if (init.method === 'POST') {
        headers.set('Origin', origin);
        headers.set('Sec-Fetch-Site', 'same-origin');
        headers.set('Sec-Fetch-Mode', 'cors');
      }
      return fetch(input, { ...init, headers });
    },
  };
}

function messageCommand(sequence: number): SubmitAdvisorMessage {
  return {
    requestId: uuidV7(sequence),
    missionId: MISSION_ID,
    manifestVersion: 1,
    kind: 'CLARIFICATION',
    subject: 'Synthetic composed-runtime message',
    bodyText: 'Synthetic browser client input persists through the real application path.',
    referencedEntityIds: ['AO-WU-11'],
    clientCreatedAt: FIXED_TIME,
  };
}

function deterministicRuntime(start: number): AgentOfficeRuntimeIdentity {
  let next = start;
  return { now: () => FIXED_TIME, nextId: () => uuidV7(next++) };
}

function mutableRuntime(start: number): AgentOfficeRuntimeIdentity & { advance(milliseconds: number): void } {
  let next = start;
  let nowMs = Date.parse(FIXED_TIME);
  return {
    now: () => new Date(nowMs).toISOString(),
    nextId: () => uuidV7(next++),
    advance: (milliseconds) => {
      nowMs += milliseconds;
    },
  };
}

async function reservePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('test listener address missing');
  await new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error)));
  return address.port;
}

async function waitForState(
  client: AgentOfficeRuntimeClient,
  predicate: (state: RuntimeClientState) => boolean,
): Promise<RuntimeClientState> {
  if (predicate(client.snapshot())) return client.snapshot();
  return new Promise((resolve, reject) => {
    let unsubscribe = (): void => undefined;
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`runtime state timeout: ${JSON.stringify(client.snapshot())}`));
    }, 2_000);
    unsubscribe = client.subscribe((state) => {
      if (!predicate(state)) return;
      clearTimeout(timeout);
      unsubscribe();
      resolve(state);
    });
  });
}

function removeCloseable(closeable: { close(): Promise<void> }): void {
  const index = closeables.indexOf(closeable);
  if (index >= 0) closeables.splice(index, 1);
}

function removeClient(client: AgentOfficeRuntimeClient): void {
  const index = clients.indexOf(client);
  if (index >= 0) clients.splice(index, 1);
}
