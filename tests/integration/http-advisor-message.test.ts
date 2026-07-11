import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { HermesAdvisorGateway } from '../../src/adapters/gateways/hermes/index.js';
import { AdvisorInboxService } from '../../src/application/advisor-inbox/service.js';
import type { AdvisorInboxRuntime } from '../../src/application/advisor-inbox/types.js';
import { ImmutableArtifactStore } from '../../src/persistence/file-store/artifact-store.js';
import { EventStore } from '../../src/persistence/file-store/event-store.js';
import {
  BrowserSessionRegistry,
  InMemorySecurityAuditSink,
  TestAuthenticationProvider,
  startAgentOfficeHttpServer,
  type AgentOfficeHttpApplication,
  type BrowserSession,
} from '../../src/server/index.js';
import { advisorMessageBody, SYNTHETIC_TEST_PROOF } from '../helpers/server-fixture.js';
import { FIXED_TIME, MISSION_ID, makeStateRoot, uuidV7 } from '../helpers/fixtures.js';

const roots: string[] = [];
const servers: { close(): Promise<void> }[] = [];
const stores: EventStore[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(stores.splice(0).map((store) => store.close().catch(() => undefined)));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('HTTP to durable Batch D Advisor inbox binding', () => {
  it('returns persistence-only evidence and replays the same request after restart', async () => {
    const root = await makeStateRoot();
    roots.push(root);
    const command = advisorMessageBody(2200);
    const first = await startDurableFixture(root, 2300);
    const firstResponse = await submit(first.server.origin, first.session, command);
    expect(firstResponse.status).toBe(201);
    const receipt = await firstResponse.json() as Record<string, unknown>;
    expect(receipt).toMatchObject({
      requestId: command.requestId,
      status: 'PERSISTED',
      replayed: false,
      persistedMissionSequence: 1,
    });
    expect(receipt).not.toHaveProperty('delivery');
    expect(receipt).not.toHaveProperty('acknowledgement');
    const artifactRef = String(receipt.messageArtifactRef);
    expect(await readFile(path.join(root, artifactRef), 'utf8')).toContain(command.bodyText);
    expect(JSON.stringify(first.store.readAll())).not.toContain(command.bodyText);
    await first.server.close();
    removeServer(first.server);
    await first.store.close();
    removeStore(first.store);

    const restarted = await startDurableFixture(root, 2400);
    const replayResponse = await submit(restarted.server.origin, restarted.session, command);
    expect(replayResponse.status).toBe(201);
    expect(await replayResponse.json()).toEqual({ ...receipt, replayed: true });
    expect(restarted.store.sequence).toBe(1);

    const conflict = await submit(restarted.server.origin, restarted.session, {
      ...command,
      bodyText: 'synthetic conflicting retry',
    });
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    expect(restarted.store.sequence).toBe(1);
  });
});

async function startDurableFixture(root: string, idStart: number) {
  const store = await EventStore.open({
    root,
    missionId: MISSION_ID,
    manifestVersion: 1,
    writer: {
      buildId: 'batch-e-http-test',
      stateRootId: 'test-state-root',
      acquiredAt: FIXED_TIME,
    },
  });
  stores.push(store);
  const artifacts = await ImmutableArtifactStore.open(root);
  const runtime = runtimeIds(idStart);
  const inbox = new AdvisorInboxService(
    store,
    artifacts,
    new HermesAdvisorGateway(() => FIXED_TIME),
    runtime,
    {
      missionId: MISSION_ID,
      manifestVersion: 1,
      allowlistedEntityIds: new Set(['AO-WU-11']),
    },
  );
  const application: AgentOfficeHttpApplication = {
    readStatus: () => Promise.resolve({
      schemaVersion: 'agent-office.local-runtime-status.v1',
      networkMode: 'LOOPBACK_PRIVATE',
      startupState: 'MUTATION_READY',
      authMode: 'TEST_ONLY',
      mutationMode: 'ENABLED_TEST_ONLY',
      deliveryMode: 'DISABLED',
      sseMode: 'READY',
      projectionRevision: store.sequence,
      lastVerifiedAt: FIXED_TIME,
    }),
    readProjection: () => Promise.resolve({
      schemaVersion: 'agent-office.redacted-projection.v1',
      revision: store.sequence,
      missionId: MISSION_ID,
      notificationIds: [],
      openAlertIds: [],
    }),
    submitAdvisorMessage: (nextCommand, context) => inbox.persistMessage(nextCommand, {
      actor: { role: 'Leo/GPT', subjectId: context.subjectId },
      correlationId: context.correlationId,
      causationId: context.causationId,
      receivedAt: context.receivedAt,
    }),
    recordAdvisorAcknowledgement: () => Promise.reject(new Error('not used by fixture')),
    recordAdvisorIntake: () => Promise.reject(new Error('not used by fixture')),
    recordAdvisorDecision: () => Promise.reject(new Error('not used by fixture')),
    acknowledgeAlert: () => Promise.reject(new Error('not used by fixture')),
    disableDelivery: () => Promise.reject(new Error('not used by fixture')),
  };
  let opaque = idStart;
  const nextOpaque = (): string => `synthetic_http_${String(opaque++).padStart(32, '0')}`;
  const provider = new TestAuthenticationProvider({
    buildMode: 'TEST',
    testRuntime: true,
    identities: [{
      proof: `${SYNTHETIC_TEST_PROOF}-${idStart}`,
      subjectId: 'synthetic-leo',
      capabilities: ['viewer', 'leo_input'],
    }],
    now: () => FIXED_TIME,
    nextOpaque,
  });
  const providerSession = await provider.exchangeOneTimeProof(`${SYNTHETIC_TEST_PROOF}-${idStart}`);
  const sessions = new BrowserSessionRegistry(provider, nextOpaque, () => FIXED_TIME);
  const session = sessions.establish(providerSession);
  let httpId = idStart + 500;
  const server = await startAgentOfficeHttpServer({
    bindAddress: '127.0.0.1',
    application,
    sessions,
    audit: new InMemorySecurityAuditSink(),
    now: () => FIXED_TIME,
    nextId: () => uuidV7(httpId++),
  });
  servers.push(server);
  return { server, session, store };
}

function submit(origin: string, session: BrowserSession, body: unknown): Promise<Response> {
  return fetch(`${origin}/api/v1/advisor/messages`, {
    method: 'POST',
    headers: {
      Cookie: `AO_SESSION=${session.cookieHandle}`,
      Origin: origin,
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'cors',
      'Content-Type': 'application/json',
      'X-AO-CSRF': session.csrfToken,
    },
    body: JSON.stringify(body),
  });
}

function runtimeIds(start: number): AdvisorInboxRuntime {
  let next = start;
  return { nextId: () => uuidV7(next++), now: () => FIXED_TIME };
}

function removeServer(server: { close(): Promise<void> }): void {
  const index = servers.indexOf(server);
  if (index >= 0) servers.splice(index, 1);
}

function removeStore(store: EventStore): void {
  const index = stores.indexOf(store);
  if (index >= 0) stores.splice(index, 1);
}
