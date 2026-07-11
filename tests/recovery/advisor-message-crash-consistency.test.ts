import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  AdvisorGateway,
  AdvisorGatewayHealth,
} from '../../src/adapters/gateways/advisor.js';
import { AdvisorInboxService } from '../../src/application/advisor-inbox/service.js';
import type { AdvisorInboxRuntime } from '../../src/application/advisor-inbox/types.js';
import { ImmutableArtifactStore } from '../../src/persistence/file-store/artifact-store.js';
import { EventStore } from '../../src/persistence/file-store/event-store.js';
import { FIXED_TIME, MISSION_ID, makeStateRoot, uuidV7 } from '../helpers/fixtures.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Advisor message crash boundaries', () => {
  it('reuses an orphan message artifact and returns the durable event receipt after restart', async () => {
    const root = await makeStateRoot();
    roots.push(root);
    const command = messageCommand();
    const artifacts = await ImmutableArtifactStore.open(root);
    await artifacts.putScopedCanonicalJson('inbox', [MISSION_ID, command.requestId], {
      schemaVersion: 'agent-office.advisor-message-artifact.v1',
      ...command,
    });
    let store = await openStore(root);
    let service = makeService(store, artifacts, new InertGateway(), idRuntime(900));
    const first = await service.persistMessage(command, leoContext());
    await store.close();

    store = await openStore(root);
    service = makeService(store, await ImmutableArtifactStore.open(root), new InertGateway(), idRuntime(950));
    const replay = await service.persistMessage(command, leoContext());
    expect(replay).toEqual({ ...first, replayed: true });
    expect(store.sequence).toBe(1);
    const files = await readdir(path.join(root, 'artifacts', 'inbox', MISSION_ID, command.requestId));
    expect(files.filter((name) => name.endsWith('.json'))).toHaveLength(1);
    await store.close();
  });

  it('rebuilds a queue event after an outbox crash without losing the persisted message', async () => {
    const root = await makeStateRoot();
    roots.push(root);
    let store = await openStore(root);
    const artifacts = await ImmutableArtifactStore.open(root);
    let runtime = idRuntime(1000);
    let service = makeService(store, artifacts, new InertGateway(), runtime);
    const persisted = await service.persistMessage(messageCommand(), leoContext());
    const notificationId = uuidV7(1090);
    await store.append({
      eventId: uuidV7(1091),
      eventType: 'AdvisorMessageDeliveryQueued',
      requestId: uuidV7(1092),
      correlationId: uuidV7(901),
      causationId: persisted.persistedEventId,
      actor: { role: 'LOCAL_OPERATOR', subjectId: 'agent-office' },
      occurredAt: FIXED_TIME,
      receivedAt: FIXED_TIME,
      recordedAt: FIXED_TIME,
      expectedStreamVersion: store.sequence,
      expectedManifestVersion: 1,
      payload: { messageId: persisted.messageId, notificationId, state: 'DELIVERY_PENDING' },
    });
    await store.close();

    store = await openStore(root);
    runtime = idRuntime(1100);
    service = makeService(store, await ImmutableArtifactStore.open(root), new InertGateway(), runtime);
    const recovered = await service.recoverOutbox();
    expect(recovered.messages[persisted.messageId]?.state).toBe('DELIVERY_PENDING');
    expect(recovered.notifications[notificationId]?.state).toBe('QUEUED');
    await store.close();
  });

  it('looks up but never resends after delivery started without a durable receipt', async () => {
    const root = await makeStateRoot();
    roots.push(root);
    let store = await openStore(root);
    const artifacts = await ImmutableArtifactStore.open(root);
    let service = makeService(store, artifacts, new InertGateway(), idRuntime(1200));
    const persisted = await service.persistMessage(messageCommand(), leoContext());
    const queued = await service.queueMessage(persisted.messageId);
    await store.append({
      eventId: uuidV7(1290),
      eventType: 'NotificationDeliveryStarted',
      requestId: uuidV7(1291),
      correlationId: uuidV7(901),
      causationId: persisted.persistedEventId,
      actor: { role: 'LOCAL_OPERATOR', subjectId: 'agent-office' },
      occurredAt: FIXED_TIME,
      receivedAt: FIXED_TIME,
      recordedAt: FIXED_TIME,
      expectedStreamVersion: store.sequence,
      expectedManifestVersion: 1,
      payload: {
        notificationId: queued.notificationId,
        messageId: persisted.messageId,
        attempt: 1,
        state: 'DELIVERING',
      },
    });
    await store.close();

    const gateway = new InertGateway();
    store = await openStore(root);
    service = makeService(store, await ImmutableArtifactStore.open(root), gateway, idRuntime(1300));
    const recovered = await service.recoverOutbox();
    expect(gateway.queueAdvisorNotification).not.toHaveBeenCalled();
    expect(gateway.getDeliveryReceipt).toHaveBeenCalledTimes(1);
    expect(recovered.notifications[queued.notificationId]?.state).toBe('MANUAL_FALLBACK_REQUIRED');
    expect(recovered.messages[persisted.messageId]?.state).toBe('MANUAL_FALLBACK_REQUIRED');
    await store.close();
  });
});

class InertGateway implements AdvisorGateway {
  public readonly queueAdvisorNotification = vi.fn<AdvisorGateway['queueAdvisorNotification']>(() =>
    Promise.reject(new Error('fresh delivery is not expected in this recovery fixture')),
  );

  public readonly getDeliveryReceipt = vi.fn<AdvisorGateway['getDeliveryReceipt']>(() =>
    Promise.resolve(undefined),
  );

  public health(): AdvisorGatewayHealth {
    return { adapter: 'MANUAL', status: 'MANUAL_FALLBACK_REQUIRED', failureCode: 'TRANSPORT_INACTIVE' };
  }
}

async function openStore(root: string): Promise<EventStore> {
  return EventStore.open({
    root,
    missionId: MISSION_ID,
    manifestVersion: 1,
    writer: { buildId: 'batch-d-test', stateRootId: 'test-state-root', acquiredAt: FIXED_TIME },
  });
}

function makeService(
  store: EventStore,
  artifacts: ImmutableArtifactStore,
  gateway: AdvisorGateway,
  runtime: AdvisorInboxRuntime,
): AdvisorInboxService {
  return new AdvisorInboxService(store, artifacts, gateway, runtime, {
    missionId: MISSION_ID,
    manifestVersion: 1,
    allowlistedEntityIds: new Set(['AO-WU-10']),
  });
}

function messageCommand() {
  return {
    requestId: uuidV7(900),
    missionId: MISSION_ID,
    manifestVersion: 1,
    kind: 'PAUSE' as const,
    subject: 'Pause request',
    bodyText: 'Preserve current state and ask Advisor to pause.',
    referencedEntityIds: ['AO-WU-10'],
    clientCreatedAt: FIXED_TIME,
  };
}

function leoContext() {
  return {
    actor: { role: 'Leo/GPT' as const, subjectId: 'leo' },
    correlationId: uuidV7(901),
    causationId: uuidV7(902),
    receivedAt: FIXED_TIME,
  };
}

function idRuntime(start: number): AdvisorInboxRuntime {
  let next = start;
  return { nextId: () => uuidV7(next++), now: () => FIXED_TIME };
}
