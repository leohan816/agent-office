import { readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildAdvisorGatewayReceipt,
  type AdvisorGateway,
  type AdvisorGatewayHealth,
  type AdvisorGatewayReceipt,
  type AdvisorNotificationRequest,
} from '../../src/adapters/gateways/advisor.js';
import { AdvisorInboxService } from '../../src/application/advisor-inbox/service.js';
import type {
  AdvisorInboxRuntime,
  ApplicationCommandContext,
  DecisionAuthorityEvidenceVerifier,
} from '../../src/application/advisor-inbox/types.js';
import { ImmutableArtifactStore } from '../../src/persistence/file-store/artifact-store.js';
import { EventStore } from '../../src/persistence/file-store/event-store.js';
import { hashCanonical } from '../../src/persistence/file-store/hashing.js';
import {
  FIXED_TIME,
  MISSION_ID,
  makeStateRoot,
  uuidV7,
} from '../helpers/fixtures.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('durable Advisor inbox application', () => {
  it('persists body bytes only in an owner-only artifact and replays the same request receipt', async () => {
    const fixture = await setup();
    const command = messageCommand();
    const first = await fixture.service.persistMessage(command, leoContext());
    const artifactPath = path.join(fixture.root, first.messageArtifactRef);
    expect(first).toMatchObject({ status: 'PERSISTED', replayed: false });
    expect(first.messageArtifactRef).toMatch(
      new RegExp(`^artifacts/inbox/${MISSION_ID}/${command.requestId}/[0-9a-f]{64}\\.json$`, 'u'),
    );
    expect((await stat(artifactPath)).mode & 0o777).toBe(0o600);
    expect(await readFile(artifactPath, 'utf8')).toContain(command.bodyText);
    expect(JSON.stringify(fixture.store.readAll())).not.toContain(command.bodyText);
    expect(JSON.stringify(fixture.store.readAll())).not.toContain(command.subject);

    const replay = await fixture.service.persistMessage(command, leoContext());
    expect(replay).toEqual({ ...first, replayed: true });
    expect(fixture.store.sequence).toBe(1);
    await expect(
      fixture.service.persistMessage({ ...command, bodyText: 'different bytes' }, leoContext()),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    await fixture.store.close();
  });

  it('keeps delivery, acknowledgement, intake, decision, resume, and close as separate evidence', async () => {
    const fixture = await setup();
    const persisted = await fixture.service.persistMessage(messageCommand(), leoContext());
    const queued = await fixture.service.queueMessage(persisted.messageId);
    expect(queued.state).toBe('QUEUED');
    const delivered = await fixture.service.deliverNotification(queued.notificationId);
    expect(delivered.state).toBe('DELIVERED');
    let message = fixture.service.project().messages[persisted.messageId];
    expect(message?.state).toBe('DELIVERED');
    expect(message?.acknowledgementArtifactRef).toBeUndefined();

    message = await fixture.service.recordAcknowledgement(
      {
        requestId: uuidV7(410),
        messageId: persisted.messageId,
        acknowledgementId: uuidV7(411),
        acknowledgedAt: FIXED_TIME,
        evidenceRefs: ['advisor-receipt:1'],
      },
      advisorContext(),
    );
    expect(message.state).toBe('ACKNOWLEDGED');
    expect(message.intakeArtifactRef).toBeUndefined();
    expect(fixture.service.project().notifications[queued.notificationId]?.state).toBe('ACKNOWLEDGED');

    message = await fixture.service.recordIntake(
      {
        requestId: uuidV7(420),
        messageId: persisted.messageId,
        intakeId: uuidV7(421),
        classification: 'NEEDS_LEO_DECISION',
        recordedAt: FIXED_TIME,
        evidenceRefs: ['advisor-intake:1'],
      },
      advisorContext(),
    );
    expect(message.state).toBe('INTAKE_RECORDED');
    expect(message.decisionArtifactRef).toBeUndefined();

    message = await fixture.service.linkDecision(
      {
        requestId: uuidV7(430),
        messageId: persisted.messageId,
        decisionId: uuidV7(431),
        authorityRole: 'Leo/GPT',
        decisionArtifact: {
          repository: 'foundation-docs',
          commit: 'a'.repeat(40),
          path: 'advisor/jobs/decision.md',
          sha256: `sha256:${'b'.repeat(64)}`,
        },
        recordedAt: FIXED_TIME,
      },
      advisorContext(),
    );
    expect(message.state).toBe('DECISION_LINKED');

    message = await fixture.service.recordResumeProof(
      {
        requestId: uuidV7(440),
        messageId: persisted.messageId,
        from: 'WAITING_LEO',
        recordedAt: FIXED_TIME,
        proof: {
          workUnitId: 'AO-WU-10',
          waitingEventId: uuidV7(441),
          previousState: 'RUNNING',
          resumeTo: 'RUNNING',
          decisionId: uuidV7(431),
          decisionArtifactHash: `sha256:${'b'.repeat(64)}`,
          intakeArtifactHash: `sha256:${'c'.repeat(64)}`,
          resolvedBlockerIds: [uuidV7(442)],
          expectedStreamVersion: fixture.store.sequence,
        },
      },
      advisorContext(),
    );
    expect(message.resumeProofArtifactRef).toMatch(/^artifacts\/resume-proofs\//u);
    message = await fixture.service.closeMessage(
      {
        requestId: uuidV7(450),
        messageId: persisted.messageId,
        closedAt: FIXED_TIME,
        reasonCode: 'ADVISOR_DECISION_APPLIED',
      },
      advisorContext(),
    );
    expect(message.state).toBe('CLOSED');
    expect(message.timeline.map((item) => item.state)).toEqual([
      'PERSISTED',
      'DELIVERY_PENDING',
      'DELIVERED',
      'ACKNOWLEDGED',
      'INTAKE_RECORDED',
      'DECISION_LINKED',
      'CLOSED',
    ]);
    expect(fixture.gateway.requests).toHaveLength(1);
    expect(JSON.stringify(fixture.gateway.requests)).not.toContain(messageCommand().bodyText);
    await fixture.store.close();
  });

  it('rejects non-Advisor routes, unknown entity references, and premature acknowledgement', async () => {
    const fixture = await setup();
    await expect(
      fixture.service.persistMessage(messageCommand(), {
        ...leoContext(),
        actor: { role: 'Agent Office Worker', subjectId: 'worker' },
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED_ACTOR' });
    await expect(
      fixture.service.persistMessage(
        { ...messageCommand(), referencedEntityIds: ['UNKNOWN-ENTITY'] },
        leoContext(),
      ),
    ).rejects.toMatchObject({ code: 'AUTHORITY_ARTIFACT_INVALID' });
    const persisted = await fixture.service.persistMessage(messageCommand(), leoContext());
    await expect(
      fixture.service.recordAcknowledgement(
        {
          requestId: uuidV7(460),
          messageId: persisted.messageId,
          acknowledgementId: uuidV7(461),
          acknowledgedAt: FIXED_TIME,
          evidenceRefs: [],
        },
        advisorContext(),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    await fixture.store.close();
  });
});

class DeliveredGateway implements AdvisorGateway {
  public readonly requests: AdvisorNotificationRequest[] = [];

  public health(): AdvisorGatewayHealth {
    return { adapter: 'TMUX_ADVISOR', status: 'READY', failureCode: 'NONE' };
  }

  public async queueAdvisorNotification(
    request: AdvisorNotificationRequest,
  ): Promise<AdvisorGatewayReceipt> {
    this.requests.push(request);
    return Promise.resolve(deliveredReceipt(request.notificationId));
  }

  public async getDeliveryReceipt(notificationId: string): Promise<AdvisorGatewayReceipt | undefined> {
    return Promise.resolve(deliveredReceipt(notificationId));
  }
}

function deliveredReceipt(notificationId: string): AdvisorGatewayReceipt {
  return buildAdvisorGatewayReceipt({
    notificationId,
    adapter: 'TMUX_ADVISOR',
    adapterVersion: 'test.v1',
    status: 'DELIVERED',
    attempt: 1,
    queuedAt: FIXED_TIME,
    attemptedAt: FIXED_TIME,
    transportEvidenceRefs: ['transport-receipt:1'],
    failureCode: 'NONE',
  });
}

async function setup() {
  const root = await makeStateRoot();
  roots.push(root);
  const store = await EventStore.open({
    root,
    missionId: MISSION_ID,
    manifestVersion: 1,
    writer: { buildId: 'batch-d-test', stateRootId: 'test-state-root', acquiredAt: FIXED_TIME },
  });
  const artifacts = await ImmutableArtifactStore.open(root);
  const runtime = idRuntime(500);
  const gateway = new DeliveredGateway();
  const service = new AdvisorInboxService(store, artifacts, gateway, runtime, {
    missionId: MISSION_ID,
    manifestVersion: 1,
    allowlistedEntityIds: new Set(['AO-WU-10']),
  }, acceptingAuthorityVerifier());
  return { root, store, artifacts, runtime, gateway, service };
}

function messageCommand() {
  return {
    requestId: uuidV7(400),
    missionId: MISSION_ID,
    manifestVersion: 1,
    kind: 'CLARIFICATION' as const,
    subject: 'Need a bounded Advisor decision',
    bodyText: 'Sensitive structured body stays in the immutable artifact.',
    referencedEntityIds: ['AO-WU-10'],
    clientCreatedAt: FIXED_TIME,
  };
}

function leoContext(): ApplicationCommandContext {
  return {
    actor: { role: 'Leo/GPT', subjectId: 'leo' },
    correlationId: uuidV7(401),
    causationId: uuidV7(402),
    receivedAt: FIXED_TIME,
  };
}

function advisorContext(): ApplicationCommandContext {
  return {
    actor: { role: 'Advisor', subjectId: 'advisor' },
    correlationId: uuidV7(403),
    causationId: uuidV7(404),
    receivedAt: FIXED_TIME,
  };
}

function idRuntime(start: number): AdvisorInboxRuntime {
  let next = start;
  return {
    nextId: () => uuidV7(next++),
    now: () => FIXED_TIME,
  };
}

function acceptingAuthorityVerifier(): DecisionAuthorityEvidenceVerifier {
  return {
    verify: (input) => {
      const evidenceCore = {
        schemaVersion: 'agent-office.verified-decision-authority.v1' as const,
        decisionId: input.decisionId,
        missionId: input.missionId,
        authorityRole: input.authorityRole,
        authoritySubjectId: 'leo-gpt',
        scope: { kind: 'WORK_UNIT_SET' as const, workUnitIds: [...input.expectedWorkUnitIds].sort() },
        decidedAt: FIXED_TIME,
        decisionArtifact: input.decisionArtifact,
        verifiedAt: FIXED_TIME,
        verifierId: 'synthetic-test-verifier',
      };
      return Promise.resolve({ ...evidenceCore, evidenceHash: hashCanonical(evidenceCore) });
    },
  };
}
