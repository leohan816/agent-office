import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { isRecord } from '../../src/contracts/validation.js';
import { hashCanonical } from '../../src/persistence/file-store/hashing.js';
import { parseReceiveGrant } from '../../src/application/slack-pilot/contracts.js';
import { As1ProfileInboundStore, rootKeyHash, type As1TransportObserved } from '../../src/application/slack-pilot/inbound-store.js';
import { As1InboundService } from '../../src/application/slack-pilot/service.js';
import { agentOfficeContext, FakeClock, FakeProfileLatchPort, slackEnvelope, validReceiveGrant, type EnvelopeOptions } from '../helpers/as1-slack-fakes.js';
import type { As1InboundEnvelope } from '../../src/adapters/gateways/slack-pilot/socket-client.js';
import { makeStateRoot } from '../helpers/fixtures.js';

// B02 — the durable, hash-bound transport state machine and its every crash-boundary recovery (design
// §8.2/§8.3/§12.3/§15.1). These regressions fail on the pre-patch candidate, whose duplicate path blindly
// ACKs an incomplete decision and whose materializer trusts a single mutable boolean.
const CTX = agentOfficeContext();
const PROFILE = CTX.profile;
const EVENT_ID = 'Ev0AGENTOFFICE01';
const ROOT_TS = '1720000000.000100';
const DEFAULT_TEXT = 'please start a new mission';

async function newSession(iso = '2026-07-14T22:05:00.000Z') {
  const root = await makeStateRoot();
  const store = await As1ProfileInboundStore.open(root, PROFILE, new FakeClock(iso));
  const grant = parseReceiveGrant(validReceiveGrant());
  const service = new As1InboundService(CTX, grant, store, new FakeProfileLatchPort());
  return { root, store, grant, service };
}

async function reopen(root: string, iso: string) {
  const store = await As1ProfileInboundStore.open(root, PROFILE, new FakeClock(iso));
  const grant = parseReceiveGrant(validReceiveGrant());
  return { store, grant, service: new As1InboundService(CTX, grant, store, new FakeProfileLatchPort()) };
}

function innerEventOf(envelope: As1InboundEnvelope): unknown {
  const payload = envelope.payload;
  if (!isRecord(payload)) throw new Error('test envelope payload is not a record');
  return payload.event;
}

function rootObserved(receipt: { receiptArtifactRef: string; receiptArtifactHash: string; messageArtifactRef: string; messageArtifactHash: string }): As1TransportObserved {
  return {
    candidateKind: 'ROOT',
    sourceEventId: EVENT_ID,
    rootTs: ROOT_TS,
    rootKeyHash: rootKeyHash(PROFILE.profileId, CTX.workspaceId, CTX.appId, CTX.channelId, ROOT_TS),
    receiptArtifactRef: receipt.receiptArtifactRef,
    receiptArtifactHash: receipt.receiptArtifactHash,
    messageArtifactRef: receipt.messageArtifactRef,
    messageArtifactHash: receipt.messageArtifactHash,
  };
}

/** Reproduce the exact durable state a crash leaves right after receipt/dedupe/open, before any transition. */
async function seedPendingRoot(store: As1ProfileInboundStore, envelope: As1InboundEnvelope): Promise<As1TransportObserved> {
  const receipt = await store.persistReceipt(EVENT_ID, envelope.payload, DEFAULT_TEXT);
  await store.insertDedupe({
    envelopeId: envelope.envelopeId,
    teamId: CTX.workspaceId,
    apiAppId: CTX.appId,
    eventId: EVENT_ID,
    rawEnvelopeHash: hashCanonical(envelope.payload),
    innerEventHash: hashCanonical(innerEventOf(envelope)),
    preAckClass: 'PREACK_PENDING',
  });
  const observed = rootObserved(receipt);
  await store.openTransport(EVENT_ID, envelope.envelopeId, hashCanonical(envelope.payload), hashCanonical(innerEventOf(envelope)), observed);
  return observed;
}

/** Drive a root to durable `TRANSPORT_ACK_RECORDED` — the ACK is recorded, the intake is not yet materialized. */
async function seedAckRecordedRoot(store: As1ProfileInboundStore, grant: ReturnType<typeof parseReceiveGrant>, envelope: As1InboundEnvelope): Promise<void> {
  const observed = await seedPendingRoot(store, envelope);
  await store.initReceiveGrantState(grant);
  const bind = await store.bindFirstRoot(grant, {
    sourceEventId: EVENT_ID,
    rootTs: ROOT_TS,
    rootKeyHash: observed.rootKeyHash,
    receiptArtifactRef: observed.receiptArtifactRef,
    receiptArtifactHash: observed.receiptArtifactHash,
    messageArtifactHash: observed.messageArtifactHash,
  });
  await store.commitPreAckDecision(EVENT_ID, { decision: 'ROOT_BOUND', terminalReason: null, bindingStateHash: bind.state.stateHash, continuation: null });
  await store.commitTransportAck(EVENT_ID);
}

async function countIntakeDirs(root: string): Promise<number> {
  try {
    return (await readdir(path.join(root, 'artifacts/as1-slack-pilot/agent-office-advisor/intake'))).length;
  } catch {
    return 0;
  }
}

function crashingAck(options: EnvelopeOptions = {}): As1InboundEnvelope {
  return slackEnvelope({ ...options, onAck: () => Promise.reject(new Error('simulated ACK crash')) });
}

describe('AS1 durable transport state machine — crash boundaries (B02)', () => {
  it('crash after the root binding but before the ACK record resumes on retry with no second binding or intake', async () => {
    const { store, grant, service } = await newSession();
    await expect(service.processEnvelope(crashingAck())).rejects.toThrow('simulated ACK crash');
    const mid = await store.readTransport(EVENT_ID);
    expect(mid?.state).toBe('PREACK_ROOT_BOUND');
    expect(mid?.transportAckRecorded).toBe(false);
    // The business transition is already durable; only the transport ACK is missing.
    expect((await store.readReceiveGrantState(grant.receiveGrantId))?.phase).toBe('ROOT_BOUND');

    const retry = await service.processEnvelope(slackEnvelope());
    expect(retry.classification).toBe('NEW_MISSION_ROOT');
    expect(retry.acked).toBe(true);
    const done = await store.readTransport(EVENT_ID);
    expect(done?.state).toBe('MATERIALIZED');
    expect(done?.intakeId).toBe(retry.intakeId);
  });

  it('a retry of an event left at PREACK_PENDING completes the binding instead of blindly ACKing (the B02 defect)', async () => {
    const { root, store, grant, service } = await newSession();
    await seedPendingRoot(store, slackEnvelope()); // crash left only receipt/dedupe/PENDING
    expect((await store.readTransport(EVENT_ID))?.state).toBe('PREACK_PENDING');

    const retry = await service.processEnvelope(slackEnvelope());
    expect(retry.classification).toBe('NEW_MISSION_ROOT'); // NOT a blind DUPLICATE-ACK of incomplete state
    expect(retry.intakeId).not.toBeNull();
    expect((await store.readReceiveGrantState(grant.receiveGrantId))?.phase).toBe('ROOT_BOUND');
    expect(await countIntakeDirs(root)).toBe(1);
  });

  it('materializes ACK-recorded work exactly once on restart with no Socket reopen, and is idempotent', async () => {
    const { root, store, grant } = await newSession();
    await seedAckRecordedRoot(store, grant, slackEnvelope());
    const mid = await store.readTransport(EVENT_ID);
    expect(mid?.state).toBe('TRANSPORT_ACK_RECORDED');
    expect(mid?.intakeId).toBeNull();

    // Restart past expiry: recovery drains the accepted decision offline; it never rechecks current expiry.
    const restarted = await reopen(root, '2026-07-14T22:20:00.000Z');
    await restarted.service.recoverPending();
    const done = await restarted.store.readTransport(EVENT_ID);
    expect(done?.state).toBe('MATERIALIZED');
    expect(done?.intakeId).not.toBeNull();
    expect(await countIntakeDirs(root)).toBe(1);

    await restarted.service.recoverPending(); // second drain is a no-op
    expect((await restarted.store.readTransport(EVENT_ID))?.intakeId).toBe(done?.intakeId);
    expect(await countIntakeDirs(root)).toBe(1);
  });

  it('a PREACK_PENDING record recovered at/after expiry records a terminal expiry rejection, never a late binding', async () => {
    const { root, store } = await newSession();
    await seedPendingRoot(store, slackEnvelope()); // pre-expiry receipt, no transition yet

    const restarted = await reopen(root, '2026-07-14T22:20:00.000Z'); // grant expired at 22:10
    await restarted.service.recoverPending();
    const rec = await restarted.store.readTransport(EVENT_ID);
    expect(rec?.state).toBe('PREACK_REJECTED');
    expect(rec?.terminalReason).toBe('REJECTED_RECEIVE_GRANT_EXPIRED');
    expect(rec?.transportAckRecorded).toBe(false); // recovery does not fabricate an ACK (design §15.1 step 3)
    const state = await restarted.store.readReceiveGrantState(restarted.grant.receiveGrantId);
    expect(state?.phase).toBe('EXPIRED_UNBOUND');
    expect(await countIntakeDirs(root)).toBe(0);
  });

  it('an identical retry after a full cycle reproduces only the durable ACK; exactly one intake exists', async () => {
    const { root, service } = await newSession();
    const first = await service.processEnvelope(slackEnvelope());
    expect(first.classification).toBe('NEW_MISSION_ROOT');
    const retry = await service.processEnvelope(slackEnvelope());
    expect(retry.classification).toBe('DUPLICATE');
    expect(retry.acked).toBe(true);
    expect(retry.intakeId).toBeNull();
    expect(await countIntakeDirs(root)).toBe(1);
  });

  it('rejects illegal transport transitions and quarantines a re-delivery with different bytes', async () => {
    const { store } = await newSession();
    await seedPendingRoot(store, slackEnvelope());
    // PREACK_PENDING -> TRANSPORT_ACK_RECORDED is not a legal edge.
    await expect(store.commitTransportAck(EVENT_ID)).rejects.toBeInstanceOf(DomainError);
    // Same event id, different bytes → corruption/attack, never a silent overwrite.
    await expect(
      store.openTransport(EVENT_ID, 'Env0AGENTOFFICE1', `sha256:${'b'.repeat(64)}`, `sha256:${'c'.repeat(64)}`, rootObserved({
        receiptArtifactRef: 'x',
        receiptArtifactHash: `sha256:${'d'.repeat(64)}`,
        messageArtifactRef: 'y',
        messageArtifactHash: `sha256:${'e'.repeat(64)}`,
      })),
    ).rejects.toBeInstanceOf(DomainError);
  });
});
