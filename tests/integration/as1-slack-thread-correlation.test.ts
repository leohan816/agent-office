import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseReceiveGrant } from '../../src/application/slack-pilot/contracts.js';
import { As1ProfileInboundStore } from '../../src/application/slack-pilot/inbound-store.js';
import { As1InboundService } from '../../src/application/slack-pilot/service.js';
import { agentOfficeContext, FakeClock, FakeProfileControlPort, slackEnvelope, validReceiveGrant } from '../helpers/as1-slack-fakes.js';
import { makeStateRoot } from '../helpers/fixtures.js';

const ROOT_TS = '1720000000.000100';

async function makeBoundService() {
  const root = await makeStateRoot();
  const clock = new FakeClock('2026-07-14T22:05:00.000Z');
  const store = await As1ProfileInboundStore.open(root, agentOfficeContext().profile, clock);
  const grant = parseReceiveGrant(validReceiveGrant());
  const service = new As1InboundService(agentOfficeContext(), grant, store, new FakeProfileControlPort());
  const rootResult = await service.processEnvelope(slackEnvelope({ ts: ROOT_TS }));
  return { root, clock, store, grant, service, rootIntakeId: rootResult.intakeId };
}

async function openClarification(store: As1ProfileInboundStore, grant: ReturnType<typeof parseReceiveGrant>): Promise<void> {
  await store.openQuestion({
    questionId: 'q-0001',
    rootTs: ROOT_TS,
    expectedResponseKind: 'CLARIFICATION',
    evidenceRef: 'advisor/jobs/20260714_as1/runtime-evidence/agent-office-advisor/q-0001',
    evidenceHash: `sha256:${'7'.repeat(64)}`,
    openedAt: '2026-07-14T22:03:00.000Z',
    expiresAt: grant.expiresAt,
  });
}

/** Narrow a nullable intake id to a present one (avoids a cast) after an explicit non-null expectation. */
function requireIntakeId(intakeId: string | null): string {
  if (intakeId === null) throw new Error('expected a present intakeId');
  return intakeId;
}

/** Read the single immutable intake artifact persisted for one intakeId (design §11 durable record). */
async function readIntakeArtifact(root: string, intakeId: string): Promise<Record<string, unknown>> {
  const directory = path.join(root, 'artifacts/as1-slack-pilot/agent-office-advisor/intake', intakeId);
  const files = (await readdir(directory)).filter((name) => name.endsWith('.json'));
  expect(files).toHaveLength(1);
  const [file] = files;
  if (file === undefined) throw new Error('no persisted intake artifact');
  return JSON.parse(await readFile(path.join(directory, file), 'utf8')) as Record<string, unknown>;
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
      openedAt: '2026-07-14T22:03:00.000Z',
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

// B03: the persisted intake artifact — not just the pointer — carries the fixed continuation kind, is bound
// to the original intake/question, is never a NEW_MISSION record, and Slack text can never pick the kind.
describe('AS1 continuation intake — durable kind binding (design §11)', () => {
  it('persists the root as a distinct NEW_MISSION intake record (INTAKE_ONLY)', async () => {
    const { root, rootIntakeId } = await makeBoundService();
    expect(rootIntakeId).not.toBeNull();
    const artifact = await readIntakeArtifact(root, requireIntakeId(rootIntakeId));
    expect(artifact.schemaVersion).toBe('agent-office.as1-new-mission-intake.v1');
    expect(artifact.kind).toBe('NEW_MISSION');
    expect(artifact.authorityState).toBe('INTAKE_ONLY');
    expect(artifact.canonicalMissionCreated).toBe(false);
    expect('originalIntakeId' in artifact).toBe(false);
  });

  it('persists a CLARIFICATION reply as a CONTINUATION_ONLY record bound to the original intake and question', async () => {
    const { root, store, grant, service, rootIntakeId } = await makeBoundService();
    await openClarification(store, grant);
    const reply = await service.processEnvelope(
      slackEnvelope({ envelopeId: 'Env0REPLY0007', eventId: 'Ev0REPLY000007', threadTs: ROOT_TS, ts: '1720000000.000900', text: 'here is my clarification' }),
    );
    expect(reply.intakeId).not.toBeNull();
    const artifact = await readIntakeArtifact(root, requireIntakeId(reply.intakeId));
    expect(artifact.schemaVersion).toBe('agent-office.as1-continuation-intake.v1');
    expect(artifact.kind).toBe('CLARIFICATION');
    expect(artifact.authorityState).toBe('CONTINUATION_ONLY');
    expect(artifact.originalIntakeId).toBe(rootIntakeId);
    expect(artifact.questionId).toBe('q-0001');
    expect(artifact.rootTs).toBe(ROOT_TS);
    // A continuation is NEVER stored as a mission-creating record.
    expect('canonicalMissionCreated' in artifact).toBe(false);
    expect('canonicalMissionRef' in artifact).toBe(false);
  });

  it('persists a DECISION_RESPONSE kind from the question even when the text reads like an approval', async () => {
    const { root, store, grant, service } = await makeBoundService();
    await store.openQuestion({
      questionId: 'q-0003',
      rootTs: ROOT_TS,
      expectedResponseKind: 'DECISION_RESPONSE',
      evidenceRef: 'advisor/jobs/20260714_as1/runtime-evidence/agent-office-advisor/q-0003',
      evidenceHash: `sha256:${'5'.repeat(64)}`,
      openedAt: '2026-07-14T22:03:00.000Z',
      expiresAt: grant.expiresAt,
    });
    // Text mimics a "new mission" instruction; the durable kind must still be DECISION_RESPONSE.
    const reply = await service.processEnvelope(
      slackEnvelope({ envelopeId: 'Env0REPLY0008', eventId: 'Ev0REPLY000008', threadTs: ROOT_TS, ts: '1720000000.001000', text: 'start a brand new mission now' }),
    );
    const artifact = await readIntakeArtifact(root, requireIntakeId(reply.intakeId));
    expect(artifact.kind).toBe('DECISION_RESPONSE');
    expect(artifact.schemaVersion).toBe('agent-office.as1-continuation-intake.v1');
    expect(artifact.questionId).toBe('q-0003');
  });

  it('materializes the continuation exactly once — the one question consumes and no second intake follows', async () => {
    const { root, store, grant, service } = await makeBoundService();
    await openClarification(store, grant);
    const first = await service.processEnvelope(
      slackEnvelope({ envelopeId: 'Env0REPLY0009', eventId: 'Ev0REPLY000009', threadTs: ROOT_TS, ts: '1720000000.001100' }),
    );
    // A second distinct reply on the same thread finds the sole question already consumed → no second intake.
    const second = await service.processEnvelope(
      slackEnvelope({ envelopeId: 'Env0REPLY0009B', eventId: 'Ev0REPLY0000091', threadTs: ROOT_TS, ts: '1720000000.001150', text: 'again' }),
    );
    expect(first.classification).toBe('CONTINUATION');
    expect(second.classification).toBe('REJECTED_THREAD_CORRELATION');
    expect(second.intakeId).toBeNull();
    // Exactly one immutable continuation record exists for the single consumption.
    const artifact = await readIntakeArtifact(root, requireIntakeId(first.intakeId));
    expect(artifact.kind).toBe('CLARIFICATION');
    expect(await store.findOpenQuestionForRoot(ROOT_TS)).toBeNull();
  });

  it('keeps the durable continuation kind stable when the store is re-opened (restart)', async () => {
    const { root, clock, store, grant, service } = await makeBoundService();
    await openClarification(store, grant);
    const reply = await service.processEnvelope(
      slackEnvelope({ envelopeId: 'Env0REPLY0010', eventId: 'Ev0REPLY000010', threadTs: ROOT_TS, ts: '1720000000.001200' }),
    );
    expect(reply.intakeId).not.toBeNull();
    // Re-open the store on the same durable root — the persisted continuation record is unchanged.
    await As1ProfileInboundStore.open(root, agentOfficeContext().profile, clock);
    const artifact = await readIntakeArtifact(root, requireIntakeId(reply.intakeId));
    expect(artifact.schemaVersion).toBe('agent-office.as1-continuation-intake.v1');
    expect(artifact.kind).toBe('CLARIFICATION');
    expect(artifact.authorityState).toBe('CONTINUATION_ONLY');
  });
});
