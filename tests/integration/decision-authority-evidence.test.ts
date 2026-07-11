import { access, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildAdvisorGatewayReceipt,
  type AdvisorGateway,
  type AdvisorGatewayHealth,
  type AdvisorGatewayReceipt,
  type AdvisorNotificationRequest,
} from '../../src/adapters/gateways/advisor.js';
import {
  ArtifactDecisionAuthorityEvidenceVerifier,
} from '../../src/adapters/observations/artifacts/decision-authority.js';
import type { ArtifactObservation, ArtifactSource } from '../../src/adapters/observations/ports.js';
import { AdvisorInboxService } from '../../src/application/advisor-inbox/service.js';
import { DurableAlertCenter } from '../../src/application/alerts/index.js';
import type {
  AdvisorInboxRuntime,
  ApplicationCommandContext,
  DecisionAuthorityRole,
} from '../../src/application/advisor-inbox/types.js';
import type { SourceArtifactRef } from '../../src/contracts/types.js';
import { ImmutableArtifactStore } from '../../src/persistence/file-store/artifact-store.js';
import { EventStore } from '../../src/persistence/file-store/event-store.js';
import { sha256Bytes } from '../../src/persistence/file-store/hashing.js';
import { bindBatchDApplication } from '../../src/server/application.js';
import { parseDecision } from '../../src/server/http/schemas.js';
import { FIXED_TIME, MISSION_ID, makeStateRoot, uuidV7 } from '../helpers/fixtures.js';

const roots: string[] = [];
const stores: EventStore[] = [];
const DECISION_ID = uuidV7(6100);

afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close().catch(() => undefined)));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('verified durable decision authority linkage', () => {
  it('preserves the parsed HTTP authority role through the bound application path', async () => {
    const fixture = await setupAuthorityFixture(authorityRecord());
    const application = bindBatchDApplication({
      inbox: fixture.service,
      alerts: new DurableAlertCenter(
        fixture.store,
        fixture.artifacts,
        fixture.runtime,
        MISSION_ID,
        1,
      ),
      readStatus: () => Promise.reject(new Error('not used')),
      readProjection: () => Promise.reject(new Error('not used')),
      disableDelivery: () => Promise.reject(new Error('not used')),
    });
    const parsed = parseDecision(
      {
        requestId: uuidV7(6000),
        messageId: fixture.messageId,
        decisionId: DECISION_ID,
        authorityRole: 'Leo/GPT',
        decisionArtifact: fixture.reference,
        recordedAt: FIXED_TIME,
      },
      {
        subjectId: 'advisor-http-subject',
        correlationId: uuidV7(6001),
        causationId: uuidV7(6002),
        receivedAt: FIXED_TIME,
      },
    );
    expect(parsed.authorityRole).toBe('Leo/GPT');
    const linked = await application.recordAdvisorDecision(parsed);
    expect(linked).toMatchObject({ authorityRole: 'Leo/GPT', state: 'DECISION_LINKED' });
  });

  it('preserves verified Leo/GPT authority through artifact, event, replay, projection, and command hash', async () => {
    const fixture = await setupAuthorityFixture(authorityRecord());
    const command = decisionCommand(fixture.messageId, fixture.reference, 'Leo/GPT');
    const before = fixture.store.sequence;
    const linked = await fixture.service.linkDecision(command, advisorContext());
    expect(linked).toMatchObject({
      state: 'DECISION_LINKED',
      authorityRole: 'Leo/GPT',
      authoritySubjectId: 'leo-gpt',
      authorityEvidenceRef: fixture.reference,
      decisionScopeWorkUnitIds: ['AO-WU-10'],
    });
    expect(linked.authorityEvidenceHash).toMatch(/^sha256:[0-9a-f]{64}$/u);

    const event = fixture.store.readAll().at(-1);
    expect(event?.eventType).toBe('AdvisorMessageDecisionLinked');
    expect(event?.payload).toMatchObject({
      authorityRole: 'Leo/GPT',
      authoritySubjectId: 'leo-gpt',
      authorityEvidenceRef: fixture.reference,
      decisionScopeWorkUnitIds: ['AO-WU-10'],
    });
    const linkPath = path.join(fixture.root, linked.decisionArtifactRef ?? 'missing');
    const linkArtifact = JSON.parse(await readFile(linkPath, 'utf8')) as Record<string, unknown>;
    expect(linkArtifact).toMatchObject({
      schemaVersion: 'agent-office.advisor-decision-link.v2',
      authorityRole: 'Leo/GPT',
      decisionArtifact: fixture.reference,
      authorityEvidence: {
        authorityRole: 'Leo/GPT',
        missionId: MISSION_ID,
        scope: { kind: 'WORK_UNIT_SET', workUnitIds: ['AO-WU-10'] },
      },
    });

    const replay = await fixture.service.linkDecision(command, advisorContext());
    expect(replay.authorityRole).toBe('Leo/GPT');
    expect(fixture.store.sequence).toBe(before + 1);
    await expect(
      fixture.service.linkDecision({ ...command, authorityRole: 'Advisor' }, advisorContext()),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    expect(fixture.store.sequence).toBe(before + 1);

    await fixture.store.close();
    removeStore(fixture.store);
    const restartedStore = await openStore(fixture.root, 7000);
    const restartedService = new AdvisorInboxService(
      restartedStore,
      await ImmutableArtifactStore.open(fixture.root),
      new DeliveredGateway(),
      idRuntime(7100),
      policy(),
      fixture.verifier,
    );
    expect(restartedService.project().messages[fixture.messageId]).toMatchObject({
      authorityRole: 'Leo/GPT',
      authorityEvidenceRef: fixture.reference,
      decisionScopeWorkUnitIds: ['AO-WU-10'],
    });
  });

  it('fails closed for bounded Advisor evidence because no safe routine-decision scope is approved', async () => {
    const fixture = await setupAuthorityFixture(authorityRecord({ authorityRole: 'Advisor' }));
    const before = fixture.store.sequence;
    await expect(
      fixture.service.linkDecision(
        decisionCommand(fixture.messageId, fixture.reference, 'Advisor'),
        advisorContext(),
      ),
    ).rejects.toMatchObject({ code: 'AUTHORITY_ARTIFACT_INVALID' });
    expect(fixture.store.sequence).toBe(before);
    expect(fixture.service.project().messages[fixture.messageId]?.state).toBe('INTAKE_RECORDED');
    await expectNoDecisionArtifacts(fixture.root);
  });

  it('rejects claimed-role, mission, scope, and hash mismatches without durable change', async () => {
    const cases = [
      {
        name: 'claimed-role',
        record: authorityRecord(),
        commandRole: 'Advisor' as const,
      },
      {
        name: 'mission',
        record: authorityRecord({ missionId: 'OTHER_MISSION' }),
        commandRole: 'Leo/GPT' as const,
      },
      {
        name: 'scope',
        record: authorityRecord({ workUnitIds: ['AO-WU-11'] }),
        commandRole: 'Leo/GPT' as const,
      },
    ];
    for (const item of cases) {
      const fixture = await setupAuthorityFixture(item.record);
      const before = fixture.store.sequence;
      await expect(
        fixture.service.linkDecision(
          decisionCommand(fixture.messageId, fixture.reference, item.commandRole),
          advisorContext(),
        ),
        item.name,
      ).rejects.toMatchObject({ code: 'AUTHORITY_ARTIFACT_INVALID' });
      expect(fixture.store.sequence, item.name).toBe(before);
      await expectNoDecisionArtifacts(fixture.root);
      await fixture.store.close();
      removeStore(fixture.store);
    }

    const hashFixture = await setupAuthorityFixture(authorityRecord());
    hashFixture.source.observation = {
      ...hashFixture.source.observation,
      bytes: Buffer.from('{"tampered":true}', 'utf8'),
    };
    const beforeHash = hashFixture.store.sequence;
    await expect(
      hashFixture.service.linkDecision(
        decisionCommand(hashFixture.messageId, hashFixture.reference, 'Leo/GPT'),
        advisorContext(),
      ),
    ).rejects.toMatchObject({ code: 'AUTHORITY_ARTIFACT_INVALID' });
    expect(hashFixture.store.sequence).toBe(beforeHash);
    await expectNoDecisionArtifacts(hashFixture.root);
  });

  it('rejects missing, mutable, unreadable, and stale evidence with one stable code', async () => {
    for (const status of ['MISSING', 'DIRTY', 'UNVERIFIED', 'STALE'] as const) {
      const fixture = await setupAuthorityFixture(authorityRecord());
      fixture.source.observation = {
        ...fixture.source.observation,
        status,
        evidence: { ...fixture.source.observation.evidence, status },
      };
      const before = fixture.store.sequence;
      await expect(
        fixture.service.linkDecision(
          decisionCommand(fixture.messageId, fixture.reference, 'Leo/GPT'),
          advisorContext(),
        ),
        status,
      ).rejects.toMatchObject({ code: 'AUTHORITY_ARTIFACT_INVALID' });
      expect(fixture.store.sequence, status).toBe(before);
      await expectNoDecisionArtifacts(fixture.root);
      await fixture.store.close();
      removeStore(fixture.store);
    }

    const unreadable = await setupAuthorityFixture(authorityRecord());
    unreadable.source.failure = new Error('synthetic source read failure');
    const beforeUnreadable = unreadable.store.sequence;
    await expect(
      unreadable.service.linkDecision(
        decisionCommand(unreadable.messageId, unreadable.reference, 'Leo/GPT'),
        advisorContext(),
      ),
    ).rejects.toMatchObject({ code: 'AUTHORITY_ARTIFACT_INVALID' });
    expect(unreadable.store.sequence).toBe(beforeUnreadable);
    await expectNoDecisionArtifacts(unreadable.root);
  });
});

interface AuthorityRecordOptions {
  readonly authorityRole?: DecisionAuthorityRole;
  readonly missionId?: string;
  readonly workUnitIds?: readonly string[];
}

function authorityRecord(options: AuthorityRecordOptions = {}) {
  return {
    schemaVersion: 'agent-office.decision-authority-evidence.v1',
    decisionId: DECISION_ID,
    missionId: options.missionId ?? MISSION_ID,
    authorityRole: options.authorityRole ?? 'Leo/GPT',
    authoritySubjectId: options.authorityRole === 'Advisor' ? 'advisor-routine' : 'leo-gpt',
    scope: { kind: 'WORK_UNIT_SET', workUnitIds: options.workUnitIds ?? ['AO-WU-10'] },
    decidedAt: FIXED_TIME,
  } as const;
}

async function setupAuthorityFixture(record: ReturnType<typeof authorityRecord>) {
  const root = await makeStateRoot();
  roots.push(root);
  const store = await openStore(root, 6200);
  const artifacts = await ImmutableArtifactStore.open(root);
  const bytes = Buffer.from(JSON.stringify(record), 'utf8');
  const reference: SourceArtifactRef = {
    repository: 'foundation-docs',
    commit: 'a'.repeat(40),
    path: 'advisor/jobs/verified-decision.json',
    sha256: sha256Bytes(bytes),
  };
  const source = new MutableArtifactSource(reference, bytes);
  const verifier = new ArtifactDecisionAuthorityEvidenceVerifier(
    source,
    [{ artifactId: 'DECISION_AUTHORITY_1', reference }],
    () => FIXED_TIME,
  );
  const runtime = idRuntime(6300);
  const service = new AdvisorInboxService(
    store,
    artifacts,
    new DeliveredGateway(),
    runtime,
    policy(),
    verifier,
  );
  const persisted = await service.persistMessage(messageCommand(), leoContext());
  const queued = await service.queueMessage(persisted.messageId);
  await service.deliverNotification(queued.notificationId);
  await service.recordAcknowledgement(
    {
      requestId: uuidV7(6400),
      messageId: persisted.messageId,
      acknowledgementId: uuidV7(6401),
      acknowledgedAt: FIXED_TIME,
      evidenceRefs: ['advisor-receipt:1'],
    },
    advisorContext(),
  );
  await service.recordIntake(
    {
      requestId: uuidV7(6402),
      messageId: persisted.messageId,
      intakeId: uuidV7(6403),
      classification: 'NEEDS_LEO_DECISION',
      recordedAt: FIXED_TIME,
      evidenceRefs: ['advisor-intake:1'],
    },
    advisorContext(),
  );
  return {
    root,
    store,
    artifacts,
    runtime,
    service,
    source,
    verifier,
    reference,
    messageId: persisted.messageId,
  };
}

class MutableArtifactSource implements ArtifactSource {
  public observation: ArtifactObservation;
  public failure: Error | undefined;

  public constructor(reference: SourceArtifactRef, bytes: Uint8Array) {
    this.observation = {
      status: 'VERIFIED',
      bytes,
      evidence: {
        evidenceId: 'DECISION_AUTHORITY_1',
        projectId: reference.repository,
        sourceId: 'authority-source',
        relativePath: reference.path,
        sha256: reference.sha256,
        commit: reference.commit,
        status: 'VERIFIED',
      },
    };
  }

  public read(): Promise<ArtifactObservation> {
    if (this.failure !== undefined) return Promise.reject(this.failure);
    return Promise.resolve(this.observation);
  }
}

class DeliveredGateway implements AdvisorGateway {
  public health(): AdvisorGatewayHealth {
    return { adapter: 'TMUX_ADVISOR', status: 'READY', failureCode: 'NONE' };
  }

  public queueAdvisorNotification(
    request: AdvisorNotificationRequest,
  ): Promise<AdvisorGatewayReceipt> {
    return Promise.resolve(deliveredReceipt(request.notificationId));
  }

  public getDeliveryReceipt(notificationId: string): Promise<AdvisorGatewayReceipt> {
    return Promise.resolve(deliveredReceipt(notificationId));
  }
}

function deliveredReceipt(notificationId: string): AdvisorGatewayReceipt {
  return buildAdvisorGatewayReceipt({
    notificationId,
    adapter: 'TMUX_ADVISOR',
    adapterVersion: 'authority-test.v1',
    status: 'DELIVERED',
    attempt: 1,
    queuedAt: FIXED_TIME,
    attemptedAt: FIXED_TIME,
    transportEvidenceRefs: ['transport-receipt:1'],
    failureCode: 'NONE',
  });
}

async function openStore(root: string, idStart: number): Promise<EventStore> {
  const store = await EventStore.open({
    root,
    missionId: MISSION_ID,
    manifestVersion: 1,
    writer: {
      buildId: `authority-test-${idStart}`,
      stateRootId: 'test-state-root',
      acquiredAt: FIXED_TIME,
    },
  });
  stores.push(store);
  return store;
}

function policy() {
  return {
    missionId: MISSION_ID,
    manifestVersion: 1,
    allowlistedEntityIds: new Set(['AO-WU-10']),
  };
}

function messageCommand() {
  return {
    requestId: uuidV7(6500),
    missionId: MISSION_ID,
    manifestVersion: 1,
    kind: 'DECISION_RESPONSE' as const,
    subject: 'Verified decision linkage',
    bodyText: 'Link only after immutable authority evidence verification.',
    referencedEntityIds: ['AO-WU-10'],
    clientCreatedAt: FIXED_TIME,
  };
}

function decisionCommand(
  messageId: string,
  decisionArtifact: SourceArtifactRef,
  authorityRole: DecisionAuthorityRole,
) {
  return {
    requestId: uuidV7(6600),
    messageId,
    decisionId: DECISION_ID,
    authorityRole,
    decisionArtifact,
    recordedAt: FIXED_TIME,
  };
}

function leoContext(): ApplicationCommandContext {
  return {
    actor: { role: 'Leo/GPT', subjectId: 'leo' },
    correlationId: uuidV7(6700),
    causationId: uuidV7(6701),
    receivedAt: FIXED_TIME,
  };
}

function advisorContext(): ApplicationCommandContext {
  return {
    actor: { role: 'Advisor', subjectId: 'advisor' },
    correlationId: uuidV7(6702),
    causationId: uuidV7(6703),
    receivedAt: FIXED_TIME,
  };
}

function idRuntime(start: number): AdvisorInboxRuntime {
  let next = start;
  return { nextId: () => uuidV7(next++), now: () => FIXED_TIME };
}

function removeStore(store: EventStore): void {
  const index = stores.indexOf(store);
  if (index >= 0) stores.splice(index, 1);
}

async function expectNoDecisionArtifacts(root: string): Promise<void> {
  await expect(access(path.join(root, 'artifacts', 'advisor-decisions'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
}
