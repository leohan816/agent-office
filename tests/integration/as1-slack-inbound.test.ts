import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { parseReceiveGrant } from '../../src/application/slack-pilot/contracts.js';
import { As1ProfileInboundStore, type As1PilotReceiveGrantStateV1 } from '../../src/application/slack-pilot/inbound-store.js';
import { As1InboundService } from '../../src/application/slack-pilot/service.js';
import { agentOfficeContext, FakeClock, FakeProfileControlPort, slackEnvelope, validReceiveGrant } from '../helpers/as1-slack-fakes.js';
import { makeStateRoot } from '../helpers/fixtures.js';

const VALID_AUTH = { enterprise_id: null, team_id: 'TWORKSPACE001', user_id: 'UAGENTOFFICEBOT1', is_bot: true, is_enterprise_install: false };

async function makeService(startIso = '2026-07-14T22:05:00.000Z') {
  const root = await makeStateRoot();
  const clock = new FakeClock(startIso);
  const store = await As1ProfileInboundStore.open(root, agentOfficeContext().profile, clock);
  const grant = parseReceiveGrant(validReceiveGrant());
  const latchPort = new FakeProfileControlPort();
  const service = new As1InboundService(agentOfficeContext(), grant, store, latchPort);
  return { root, clock, store, grant, service, latchPort };
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
    // A/B (review B08): exact callback authorization identity + Slack time correlation.
    { name: 'missing authorizations', options: { authorizations: undefined }, reason: 'REJECTED_IDENTITY', acked: false, latched: true },
    { name: 'empty authorizations', options: { authorizations: [] }, reason: 'REJECTED_IDENTITY', acked: false, latched: true },
    { name: 'multiple authorizations', options: { authorizations: [VALID_AUTH, VALID_AUTH] }, reason: 'REJECTED_IDENTITY', acked: false, latched: true },
    { name: 'authorization wrong team', options: { authorizations: [{ ...VALID_AUTH, team_id: 'TOTHERWORKSP01' }] }, reason: 'REJECTED_IDENTITY', acked: false, latched: true },
    { name: 'authorization wrong bot user', options: { authorizations: [{ ...VALID_AUTH, user_id: 'UNOTTHEBOT0001' }] }, reason: 'REJECTED_IDENTITY', acked: false, latched: true },
    { name: 'authorization not a bot', options: { authorizations: [{ ...VALID_AUTH, is_bot: false }] }, reason: 'REJECTED_IDENTITY', acked: false, latched: true },
    { name: 'authorization enterprise install', options: { authorizations: [{ ...VALID_AUTH, is_enterprise_install: true }] }, reason: 'REJECTED_IDENTITY', acked: false, latched: true },
    { name: 'authorization enterprise id present', options: { authorizations: [{ ...VALID_AUTH, enterprise_id: 'E0123456789' }] }, reason: 'REJECTED_IDENTITY', acked: false, latched: true },
    { name: 'authorization extra field', options: { authorizations: [{ ...VALID_AUTH, injected: 'x' }] }, reason: 'REJECTED_IDENTITY', acked: false, latched: true },
    { name: 'authorization missing field', options: { authorizations: [{ team_id: 'TWORKSPACE001', user_id: 'UAGENTOFFICEBOT1', is_bot: true, is_enterprise_install: false }] }, reason: 'REJECTED_IDENTITY', acked: false, latched: true },
    { name: 'event_ts != ts', options: { eventTs: '1720000000.999999' }, reason: 'REJECTED_SURFACE', acked: true, latched: false },
    { name: 'malformed event_time', options: { eventTime: 0 }, reason: 'REJECTED_SURFACE', acked: true, latched: false },
    { name: 'unreasonable future event_time', options: { eventTime: 2_000_000_000 }, reason: 'REJECTED_IDENTITY', acked: false, latched: true },
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

  it('durably latches on a STORE_QUARANTINED from a corrupted (foreign-profile) durable index (B08)', async () => {
    const { root, service } = await makeService();
    // A foreign-profile dedupe record in this profile's tree fails closed when the service reads the dedupe index.
    await writeFile(
      path.join(root, 'indexes/as1-slack-pilot/profiles/agent-office-advisor/inbound-dedupe.json'),
      JSON.stringify([{ schemaVersion: 'agent-office.as1-inbound-dedupe.v1', profileId: 'FOUNDATION_ADVISOR', envelopeId: 'Env0X', teamId: 'TWORKSPACE001', apiAppId: 'AAGENTOFFICE01', eventId: 'Ev0X', rawEnvelopeHash: `sha256:${'a'.repeat(64)}`, innerEventHash: `sha256:${'b'.repeat(64)}`, firstReceivedAt: '2026-07-14T22:06:00.000Z', lastReceivedAt: '2026-07-14T22:06:00.000Z', preAckClass: 'PREACK_PENDING', receiveGrantStateHash: null, intakeId: null, terminalReason: null }]),
    );
    await expect(service.processEnvelope(slackEnvelope())).rejects.toBeInstanceOf(DomainError);
    expect(service.isLatched()).toBe(true);
  });

  it('fails closed (latched identity) when the trusted clock cannot be parsed for the future-time check', async () => {
    const root = await makeStateRoot();
    const store = await As1ProfileInboundStore.open(root, agentOfficeContext().profile, new FakeClock('2026-07-14T22:05:00.000Z'));
    const grant = parseReceiveGrant(validReceiveGrant());
    // A non-parseable trusted clock cannot prove the event is not from the future.
    const service = new As1InboundService(agentOfficeContext(() => 'not-a-timestamp'), grant, store, new FakeProfileControlPort());
    const result = await service.processEnvelope(slackEnvelope());
    expect(result.classification).toBe('REJECTED_IDENTITY');
    expect(result.latched).toBe(true);
  });

  it('refuses all further envelopes once latched by an identity contradiction', async () => {
    const { service } = await makeService();
    await service.processEnvelope(slackEnvelope({ teamId: 'TOTHERWORKSP01' }));
    const afterLatch = await service.processEnvelope(slackEnvelope());
    expect(afterLatch.classification).toBe('PROFILE_LATCHED');
    expect(afterLatch.acked).toBe(false);
  });

  it('persists the profile latch durably so a restart still refuses input (B05)', async () => {
    const { root, grant, service, latchPort } = await makeService();
    await service.processEnvelope(slackEnvelope({ teamId: 'TOTHERWORKSP01' })); // identity contradiction → durable latch
    // Restart: a fresh store + service over the same durable state root and the same canonical latch source.
    const store2 = await As1ProfileInboundStore.open(root, agentOfficeContext().profile, new FakeClock('2026-07-14T22:06:00.000Z'));
    const service2 = new As1InboundService(agentOfficeContext(), grant, store2, latchPort);
    const afterRestart = await service2.processEnvelope(slackEnvelope());
    expect(afterRestart.classification).toBe('PROFILE_LATCHED');
    expect(afterRestart.acked).toBe(false);
  });
});
