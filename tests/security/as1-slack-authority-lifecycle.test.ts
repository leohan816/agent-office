import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { parseReceiveGrant } from '../../src/application/slack-pilot/contracts.js';
import {
  As1ProfileInboundStore,
  rootKeyHash,
  type As1PilotReceiveGrantStateV1,
} from '../../src/application/slack-pilot/inbound-store.js';
import { selectProfile } from '../../src/application/slack-pilot/profiles.js';
import { FakeClock, validReceiveGrant } from '../helpers/as1-slack-fakes.js';
import { makeStateRoot } from '../helpers/fixtures.js';

const AGENT_OFFICE = selectProfile('AGENT_OFFICE_ADVISOR');

async function grabDomainError(fn: () => Promise<unknown>): Promise<DomainError> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof DomainError) return error;
    throw error;
  }
  throw new Error('expected a DomainError but none was thrown');
}

async function observedFor(store: As1ProfileInboundStore, eventId: string, rootTs: string) {
  const receipt = await store.persistReceipt(eventId, { type: 'events_api', envelope_id: eventId }, `mission text ${eventId}`);
  return {
    sourceEventId: eventId,
    rootTs,
    rootKeyHash: rootKeyHash('AGENT_OFFICE_ADVISOR', 'TWORKSPACE001', 'AAGENTOFFICE01', 'CAGENTOFFICE01', rootTs),
    receiptArtifactRef: receipt.receiptArtifactRef,
    receiptArtifactHash: receipt.receiptArtifactHash,
    messageArtifactHash: receipt.messageArtifactHash,
  };
}

describe('AS1 receive-grant binding state machine', () => {
  it('initializes UNBOUND and binds the first root before ACK when boundAt < expiresAt', async () => {
    const root = await makeStateRoot();
    const clock = new FakeClock('2026-07-14T22:05:00.000Z');
    const store = await As1ProfileInboundStore.open(root, AGENT_OFFICE, clock);
    const grant = parseReceiveGrant(validReceiveGrant());

    const initial = await store.initReceiveGrantState(grant);
    expect(initial.phase).toBe('UNBOUND');
    expect(initial.rootSlotConsumed).toBe(false);
    expect(initial.version).toBe(1);

    const result = await store.bindFirstRoot(grant, await observedFor(store, 'Ev0AGENTOFFICE01', '1720000000.000100'));
    expect(result.outcome).toBe('ROOT_BOUND');
    expect(result.state.phase).toBe('ROOT_BOUND');
    expect(result.state.rootSlotConsumed).toBe(true);
    expect(result.state.boundAt).toBe('2026-07-14T22:05:00.000Z');
    expect(result.state.boundSourceEventId).toBe('Ev0AGENTOFFICE01');
    expect(result.state.version).toBe(2);
  });

  it('rejects a second top-level event after the root slot is consumed', async () => {
    const root = await makeStateRoot();
    const store = await As1ProfileInboundStore.open(root, AGENT_OFFICE, new FakeClock('2026-07-14T22:05:00.000Z'));
    const grant = parseReceiveGrant(validReceiveGrant());
    await store.initReceiveGrantState(grant);
    await store.bindFirstRoot(grant, await observedFor(store, 'Ev0AGENTOFFICE01', '1720000000.000100'));

    const second = await store.bindFirstRoot(grant, await observedFor(store, 'Ev0AGENTOFFICE02', '1720000000.000200'));
    expect(second.outcome).toBe('REJECTED_ROOT_SLOT_CONSUMED');
    expect(second.state.boundSourceEventId).toBe('Ev0AGENTOFFICE01');
  });

  it('is the SOLE expiry decision point: a receipt before expiry with a transition after expiry rejects', async () => {
    const root = await makeStateRoot();
    const clock = new FakeClock('2026-07-14T22:05:00.000Z');
    const store = await As1ProfileInboundStore.open(root, AGENT_OFFICE, clock);
    const grant = parseReceiveGrant(validReceiveGrant()); // expiresAt 22:10:00

    await store.initReceiveGrantState(grant);
    const observed = await observedFor(store, 'Ev0AGENTOFFICE01', '1720000000.000100'); // receipt at 22:05
    clock.setIso('2026-07-14T22:15:00.000Z'); // transition linearizes AFTER expiry

    const result = await store.bindFirstRoot(grant, observed);
    expect(result.outcome).toBe('REJECTED_RECEIVE_GRANT_EXPIRED');
    expect(result.state.phase).toBe('EXPIRED_UNBOUND');
    expect(result.state.rootSlotConsumed).toBe(false);
    expect(result.state.boundAt).toBeNull();
  });

  it('records EXPIRED_UNBOUND when the grant expires before any root', async () => {
    const root = await makeStateRoot();
    const clock = new FakeClock('2026-07-14T22:20:00.000Z');
    const store = await As1ProfileInboundStore.open(root, AGENT_OFFICE, clock);
    const grant = parseReceiveGrant(validReceiveGrant());
    await store.initReceiveGrantState(grant);
    const expired = await store.recordExpiryBeforeRoot(grant);
    expect(expired.phase).toBe('EXPIRED_UNBOUND');
  });

  it('resumes an already-bound root on replay without a second transition', async () => {
    const root = await makeStateRoot();
    const store = await As1ProfileInboundStore.open(root, AGENT_OFFICE, new FakeClock('2026-07-14T22:05:00.000Z'));
    const grant = parseReceiveGrant(validReceiveGrant());
    await store.initReceiveGrantState(grant);
    await store.bindFirstRoot(grant, await observedFor(store, 'Ev0AGENTOFFICE01', '1720000000.000100'));

    // Re-open the store (simulating a restart) and read the durable state.
    const reopened = await As1ProfileInboundStore.open(root, AGENT_OFFICE, new FakeClock('2026-07-14T22:30:00.000Z'));
    const state = await reopened.readReceiveGrantState(grant.receiveGrantId);
    expect(state?.phase).toBe('ROOT_BOUND');
    expect(state?.version).toBe(2);
  });
});

describe('AS1 inbound dedupe', () => {
  it('inserts once and reports a duplicate for identical bytes', async () => {
    const root = await makeStateRoot();
    const store = await As1ProfileInboundStore.open(root, AGENT_OFFICE, new FakeClock('2026-07-14T22:05:00.000Z'));
    const input = {
      envelopeId: 'Ev0AGENTOFFICE01',
      teamId: 'TWORKSPACE001',
      apiAppId: 'AAGENTOFFICE01',
      eventId: 'Ev0AGENTOFFICE01',
      rawEnvelopeHash: `sha256:${'a'.repeat(64)}`,
      innerEventHash: `sha256:${'b'.repeat(64)}`,
      preAckClass: 'PREACK_ROOT_BOUND',
    };
    expect(await store.insertDedupe(input)).toBe('inserted');
    expect(await store.insertDedupe(input)).toBe('duplicate');
  });

  it('quarantines the same identity with different bytes', async () => {
    const root = await makeStateRoot();
    const store = await As1ProfileInboundStore.open(root, AGENT_OFFICE, new FakeClock('2026-07-14T22:05:00.000Z'));
    const base = {
      envelopeId: 'Ev0AGENTOFFICE01',
      teamId: 'TWORKSPACE001',
      apiAppId: 'AAGENTOFFICE01',
      eventId: 'Ev0AGENTOFFICE01',
      rawEnvelopeHash: `sha256:${'a'.repeat(64)}`,
      innerEventHash: `sha256:${'b'.repeat(64)}`,
      preAckClass: 'PREACK_ROOT_BOUND',
    };
    await store.insertDedupe(base);
    const error = await grabDomainError(() =>
      store.insertDedupe({ ...base, rawEnvelopeHash: `sha256:${'c'.repeat(64)}` }),
    );
    expect(error.code).toBe('STORE_QUARANTINED');
  });
});

describe('AS1 profile isolation and corruption', () => {
  it('never binds a foreign profile grant through the selected profile store', async () => {
    const root = await makeStateRoot();
    const store = await As1ProfileInboundStore.open(root, AGENT_OFFICE, new FakeClock('2026-07-14T22:05:00.000Z'));
    const foreignGrant = parseReceiveGrant(validReceiveGrant({ profileId: 'FOUNDATION_ADVISOR' }));
    expect((await grabDomainError(() => store.initReceiveGrantState(foreignGrant))).code).toBe('FORBIDDEN_TARGET');
  });

  it('quarantines a tampered receive-grant state chain', async () => {
    const root = await makeStateRoot();
    const store = await As1ProfileInboundStore.open(root, AGENT_OFFICE, new FakeClock('2026-07-14T22:05:00.000Z'));
    const grant = parseReceiveGrant(validReceiveGrant());
    await store.initReceiveGrantState(grant);

    const statePath = path.join(
      root,
      'indexes/as1-slack-pilot/profiles/agent-office-advisor/receive-grant-state',
      `${grant.receiveGrantId}.json`,
    );
    const chain = JSON.parse(await readFile(statePath, 'utf8')) as As1PilotReceiveGrantStateV1[];
    const tampered = chain.map((record) => ({ ...record, boundSourceEventId: 'FORGED' }));
    await writeFile(statePath, `${JSON.stringify(tampered)}\n`, { mode: 0o600 });

    expect((await grabDomainError(() => store.readReceiveGrantState(grant.receiveGrantId))).code).toBe(
      'STORE_QUARANTINED',
    );
  });
});
