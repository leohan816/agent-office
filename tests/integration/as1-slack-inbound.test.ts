import { describe, expect, it } from 'vitest';

import { parseReceiveGrant } from '../../src/application/slack-pilot/contracts.js';
import { As1ProfileInboundStore, type As1PilotReceiveGrantStateV1 } from '../../src/application/slack-pilot/inbound-store.js';
import { As1InboundService } from '../../src/application/slack-pilot/service.js';
import { agentOfficeContext, FakeClock, slackEnvelope, validReceiveGrant } from '../helpers/as1-slack-fakes.js';
import { makeStateRoot } from '../helpers/fixtures.js';

async function makeService(startIso = '2026-07-14T22:05:00.000Z') {
  const root = await makeStateRoot();
  const clock = new FakeClock(startIso);
  const store = await As1ProfileInboundStore.open(root, agentOfficeContext().profile, clock);
  const grant = parseReceiveGrant(validReceiveGrant());
  const service = new As1InboundService(agentOfficeContext(), grant, store, clock);
  return { root, clock, store, grant, service };
}

describe('AS1 inbound service — first root and persist-before-ACK', () => {
  it('binds the first root and materializes exactly one intake, after a durable ACK', async () => {
    const { store, grant, service } = await makeService();
    let stateAtAck: As1PilotReceiveGrantStateV1 | null = null;
    const result = await service.processEnvelope(
      slackEnvelope({
        onAck: async () => {
          stateAtAck = await store.readReceiveGrantState(grant.receiveGrantId);
        },
      }),
    );
    expect(result.classification).toBe('NEW_MISSION_ROOT');
    expect(result.acked).toBe(true);
    expect(result.intakeId).not.toBeNull();
    // Persist-before-ACK: the root was already durably ROOT_BOUND at the moment of ACK.
    expect(stateAtAck).not.toBeNull();
    expect((stateAtAck as As1PilotReceiveGrantStateV1 | null)?.phase).toBe('ROOT_BOUND');
    const transport = await store.readTransport('Ev0AGENTOFFICE01');
    expect(transport?.transportAckRecorded).toBe(true);
    expect(transport?.intakeId).toBe(result.intakeId);
  });

  it('sends NO ACK when a persistence step fails', async () => {
    const { store, service } = await makeService();
    // Seed a conflicting dedupe record so the service's insert detects reused-identity-different-bytes.
    await store.insertDedupe({
      envelopeId: 'Env0AGENTOFFICE1',
      teamId: 'TWORKSPACE001',
      apiAppId: 'AAGENTOFFICE01',
      eventId: 'Ev0AGENTOFFICE01',
      rawEnvelopeHash: `sha256:${'9'.repeat(64)}`,
      innerEventHash: `sha256:${'8'.repeat(64)}`,
      preAckClass: 'PREACK_PENDING',
    });
    let acked = false;
    await expect(
      service.processEnvelope(slackEnvelope({ onAck: () => { acked = true; return Promise.resolve(); } })),
    ).rejects.toThrow();
    expect(acked).toBe(false);
  });

  it('rejects a second top-level event after the root slot is consumed', async () => {
    const { service } = await makeService();
    await service.processEnvelope(slackEnvelope());
    const second = await service.processEnvelope(
      slackEnvelope({ envelopeId: 'Env0AGENTOFFICE2', eventId: 'Ev0AGENTOFFICE02', ts: '1720000000.000200' }),
    );
    expect(second.classification).toBe('REJECTED_ROOT_SLOT_CONSUMED');
    expect(second.acked).toBe(true);
    expect(second.intakeId).toBeNull();
  });

  it('treats an identical retry as a duplicate with no second intake', async () => {
    const { service } = await makeService();
    const first = await service.processEnvelope(slackEnvelope());
    const retry = await service.processEnvelope(slackEnvelope());
    expect(first.classification).toBe('NEW_MISSION_ROOT');
    expect(retry.classification).toBe('DUPLICATE');
    expect(retry.intakeId).toBeNull();
  });

  it('rejects a transition that linearizes at or after receive-grant expiry', async () => {
    const { service } = await makeService('2026-07-14T22:20:00.000Z');
    const result = await service.processEnvelope(slackEnvelope());
    expect(result.classification).toBe('REJECTED_RECEIVE_GRANT_EXPIRED');
    expect(result.acked).toBe(true);
    expect(result.intakeId).toBeNull();
  });
});

describe('AS1 inbound service — policy matrix rejections', () => {
  const cases: { name: string; options: Parameters<typeof slackEnvelope>[0]; reason: string; acked: boolean; latched: boolean }[] = [
    { name: 'deferred query "status"', options: { text: 'status please' }, reason: 'REJECTED_DEFERRED_QUERY', acked: true, latched: false },
    { name: 'deferred query "/agents"', options: { text: '/agents' }, reason: 'REJECTED_DEFERRED_QUERY', acked: true, latched: false },
    { name: 'bot echo', options: { botId: 'BAGENTOFFICE01' }, reason: 'REJECTED_NON_LEO_OR_BOT', acked: true, latched: false },
    { name: 'edited message subtype', options: { subtype: 'message_changed' }, reason: 'REJECTED_MUTATION_OR_SUBTYPE', acked: true, latched: false },
    { name: 'hidden message', options: { hidden: true }, reason: 'REJECTED_MUTATION_OR_SUBTYPE', acked: true, latched: false },
    { name: 'DM surface', options: { channelType: 'im' }, reason: 'REJECTED_SURFACE', acked: true, latched: false },
    { name: 'public channel surface', options: { channelType: 'channel' }, reason: 'REJECTED_SURFACE', acked: true, latched: false },
    { name: 'wrong workspace', options: { teamId: 'TOTHERWORKSP01' }, reason: 'REJECTED_IDENTITY', acked: false, latched: true },
    { name: 'wrong app', options: { apiAppId: 'AOTHERAPPID001' }, reason: 'REJECTED_IDENTITY', acked: false, latched: true },
    { name: 'wrong channel', options: { channel: 'COTHERCHANNEL1' }, reason: 'REJECTED_IDENTITY', acked: false, latched: true },
    { name: 'non-Leo user', options: { user: 'UINTRUDER00001' }, reason: 'REJECTED_IDENTITY', acked: false, latched: true },
    { name: 'shared channel', options: { isExtSharedChannel: true }, reason: 'REJECTED_IDENTITY', acked: false, latched: true },
  ];

  for (const testCase of cases) {
    it(`classifies ${testCase.name} as ${testCase.reason}`, async () => {
      const { service } = await makeService();
      const result = await service.processEnvelope(slackEnvelope(testCase.options));
      expect(result.classification).toBe(testCase.reason);
      expect(result.acked).toBe(testCase.acked);
      expect(result.latched).toBe(testCase.latched);
      expect(result.intakeId).toBeNull();
      expect(service.isLatched()).toBe(testCase.latched);
    });
  }

  it('refuses all further envelopes once latched by an identity contradiction', async () => {
    const { service } = await makeService();
    await service.processEnvelope(slackEnvelope({ teamId: 'TOTHERWORKSP01' }));
    const afterLatch = await service.processEnvelope(slackEnvelope());
    expect(afterLatch.classification).toBe('PROFILE_LATCHED');
    expect(afterLatch.acked).toBe(false);
  });
});
