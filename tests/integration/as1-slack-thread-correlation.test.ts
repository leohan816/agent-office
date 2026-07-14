import { describe, expect, it } from 'vitest';

import { parseReceiveGrant } from '../../src/application/slack-pilot/contracts.js';
import { As1ProfileInboundStore } from '../../src/application/slack-pilot/inbound-store.js';
import { As1InboundService } from '../../src/application/slack-pilot/service.js';
import { agentOfficeContext, FakeClock, slackEnvelope, validReceiveGrant } from '../helpers/as1-slack-fakes.js';
import { makeStateRoot } from '../helpers/fixtures.js';

const ROOT_TS = '1720000000.000100';

async function makeBoundService() {
  const root = await makeStateRoot();
  const clock = new FakeClock('2026-07-14T22:05:00.000Z');
  const store = await As1ProfileInboundStore.open(root, agentOfficeContext().profile, clock);
  const grant = parseReceiveGrant(validReceiveGrant());
  const service = new As1InboundService(agentOfficeContext(), grant, store, clock);
  await service.processEnvelope(slackEnvelope({ ts: ROOT_TS }));
  return { store, grant, service };
}

async function openClarification(store: As1ProfileInboundStore, grant: ReturnType<typeof parseReceiveGrant>): Promise<void> {
  await store.openQuestion({
    questionId: 'q-0001',
    rootTs: ROOT_TS,
    expectedResponseKind: 'CLARIFICATION',
    evidenceRef: 'advisor/jobs/20260714_as1/runtime-evidence/agent-office-advisor/q-0001',
    evidenceHash: `sha256:${'7'.repeat(64)}`,
    expiresAt: grant.expiresAt,
  });
}

describe('AS1 thread correlation', () => {
  it('accepts a same-thread reply that consumes the one open question', async () => {
    const { store, grant, service } = await makeBoundService();
    await openClarification(store, grant);

    const reply = await service.processEnvelope(
      slackEnvelope({ envelopeId: 'Env0REPLY0001', eventId: 'Ev0REPLY000001', threadTs: ROOT_TS, ts: '1720000000.000200', text: 'here is my clarification' }),
    );
    expect(reply.classification).toBe('CONTINUATION');
    expect(reply.acked).toBe(true);
    expect(reply.intakeId).not.toBeNull();

    const consumed = await store.findOpenQuestionForRoot(ROOT_TS);
    expect(consumed).toBeNull(); // question is now CONSUMED, not OPEN
  });

  it('takes the reply kind from the pending question, never from the text', async () => {
    const { store, grant, service } = await makeBoundService();
    // Text says "status" (a deferred-query word) but a thread reply is not a deferred query; kind is fixed.
    await store.openQuestion({
      questionId: 'q-0002',
      rootTs: ROOT_TS,
      expectedResponseKind: 'DECISION_RESPONSE',
      evidenceRef: 'advisor/jobs/20260714_as1/runtime-evidence/agent-office-advisor/q-0002',
      evidenceHash: `sha256:${'6'.repeat(64)}`,
      expiresAt: grant.expiresAt,
    });
    const reply = await service.processEnvelope(
      slackEnvelope({ envelopeId: 'Env0REPLY0002', eventId: 'Ev0REPLY000002', threadTs: ROOT_TS, ts: '1720000000.000300', text: 'approved, proceed' }),
    );
    expect(reply.classification).toBe('CONTINUATION');
  });

  it('rejects a reply to an unknown root', async () => {
    const { service } = await makeBoundService();
    const reply = await service.processEnvelope(
      slackEnvelope({ envelopeId: 'Env0REPLY0003', eventId: 'Ev0REPLY000003', threadTs: '1720000000.999999', ts: '1720000000.000400' }),
    );
    expect(reply.classification).toBe('REJECTED_THREAD_CORRELATION');
    expect(reply.intakeId).toBeNull();
  });

  it('rejects a reply when no question is open on the known root', async () => {
    const { service } = await makeBoundService();
    const reply = await service.processEnvelope(
      slackEnvelope({ envelopeId: 'Env0REPLY0004', eventId: 'Ev0REPLY000004', threadTs: ROOT_TS, ts: '1720000000.000500' }),
    );
    expect(reply.classification).toBe('REJECTED_THREAD_CORRELATION');
  });

  it('rejects a second reply after the question is already consumed', async () => {
    const { store, grant, service } = await makeBoundService();
    await openClarification(store, grant);
    await service.processEnvelope(
      slackEnvelope({ envelopeId: 'Env0REPLY0005', eventId: 'Ev0REPLY000005', threadTs: ROOT_TS, ts: '1720000000.000600' }),
    );
    const second = await service.processEnvelope(
      slackEnvelope({ envelopeId: 'Env0REPLY0006', eventId: 'Ev0REPLY000006', threadTs: ROOT_TS, ts: '1720000000.000700' }),
    );
    expect(second.classification).toBe('REJECTED_THREAD_CORRELATION');
  });

  it('rejects a top-level event that carries its own thread_ts as neither root nor continuation', async () => {
    const { service } = await makeBoundService();
    const selfThread = await service.processEnvelope(
      slackEnvelope({ envelopeId: 'Env0SELF00001', eventId: 'Ev0SELF0000001', threadTs: '1720000000.000800', ts: '1720000000.000800' }),
    );
    expect(selfThread.classification).toBe('REJECTED_THREAD_CORRELATION');
  });
});
