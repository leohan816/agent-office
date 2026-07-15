import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { isRecord } from '../../src/contracts/validation.js';
import { hashCanonical } from '../../src/persistence/file-store/hashing.js';
import { parseReceiveGrant } from '../../src/application/slack-pilot/contracts.js';
import { As1ProfileInboundStore, rootKeyHash, type As1TransportObserved } from '../../src/application/slack-pilot/inbound-store.js';
import { As1InboundService } from '../../src/application/slack-pilot/service.js';
import { agentOfficeContext, FakeClock, FakeProfileControlPort, slackEnvelope, validReceiveGrant, type EnvelopeOptions } from '../helpers/as1-slack-fakes.js';
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
  const gate = new FakeProfileControlPort();
  const service = new As1InboundService(CTX, grant, store, gate);
  return { root, store, grant, service, gate };
}

async function reopen(root: string, iso: string) {
  const store = await As1ProfileInboundStore.open(root, PROFILE, new FakeClock(iso));
  const grant = parseReceiveGrant(validReceiveGrant());
  const gate = new FakeProfileControlPort();
  return { store, grant, service: new As1InboundService(CTX, grant, store, gate), gate };
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

const SECOND_EVENT_ID = 'Ev0AGENTOFFICE02';

/** Seed a SECOND, independent TRANSPORT_ACK_RECORDED record (a rejected decision) awaiting the offline drain. */
async function seedSecondAckRecordedRoot(store: As1ProfileInboundStore): Promise<void> {
  const observed: As1TransportObserved = {
    candidateKind: 'ROOT',
    sourceEventId: SECOND_EVENT_ID,
    rootTs: '1720000000.000200',
    rootKeyHash: rootKeyHash(PROFILE.profileId, CTX.workspaceId, CTX.appId, CTX.channelId, '1720000000.000200'),
    receiptArtifactRef: 'r2',
    receiptArtifactHash: `sha256:${'2'.repeat(64)}`,
    messageArtifactRef: 'm2',
    messageArtifactHash: `sha256:${'3'.repeat(64)}`,
  };
  await store.openTransport(SECOND_EVENT_ID, 'Env0AGENTOFFICE2', `sha256:${'4'.repeat(64)}`, `sha256:${'5'.repeat(64)}`, observed);
  await store.commitPreAckDecision(SECOND_EVENT_ID, { decision: 'REJECTED', terminalReason: 'REJECTED_ROOT_SLOT_CONSUMED', bindingStateHash: null, continuation: null });
  await store.commitTransportAck(SECOND_EVENT_ID);
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

// B05 operational gate: the control gate is re-asserted before EVERY side effect, not only at entry.
describe('AS1 operational control gate (B05)', () => {
  it('a control block engaged after the entry check stops the first side effect and never ACKs', async () => {
    const { store, service, gate } = await newSession();
    gate.blockActionsAfter(0); // entry isActionable passes; the first assertActionable (before receipt) blocks
    let acked = false;
    await expect(
      service.processEnvelope(slackEnvelope({ onAck: () => { acked = true; return Promise.resolve(); } })),
    ).rejects.toBeInstanceOf(DomainError);
    expect(acked).toBe(false);
    expect(await store.readTransport(EVENT_ID)).toBeNull(); // no durable transport work either
  });

  it('a block engaged after the pre-ACK decision stops the ACK, leaving a committed-but-unacked decision', async () => {
    const { store, service, gate } = await newSession();
    // Allow the receipt + pre-ACK decision asserts, then block exactly at the ACK.
    gate.blockActionsAfter(2);
    let acked = false;
    await expect(
      service.processEnvelope(slackEnvelope({ onAck: () => { acked = true; return Promise.resolve(); } })),
    ).rejects.toBeInstanceOf(DomainError);
    expect(acked).toBe(false);
    const transport = await store.readTransport(EVENT_ID);
    expect(transport?.state).toBe('PREACK_ROOT_BOUND'); // decision durable, ACK blocked
    expect(transport?.transportAckRecorded).toBe(false);
  });

  it('recoverPending stops between records: it materializes the first, then the gate blocks the second (B05)', async () => {
    const { store, grant, service, gate } = await newSession();
    // Seed two independent TRANSPORT_ACK_RECORDED roots (two event ids) awaiting the offline materialize drain.
    await seedAckRecordedRoot(store, grant, slackEnvelope());
    await seedSecondAckRecordedRoot(store);
    gate.blockActionsAfter(1); // the loop asserts once per record: record #1 passes, record #2 blocks
    await expect(service.recoverPending()).rejects.toBeInstanceOf(DomainError);
    const first = await store.readTransport(EVENT_ID);
    const second = await store.readTransport(SECOND_EVENT_ID);
    expect(first?.state).toBe('MATERIALIZED');
    expect(second?.state).toBe('TRANSPORT_ACK_RECORDED'); // untouched — recovery stopped between records
  });
});

// B08 — persisted per-profile state is strictly parsed on read (exact keys/types/hashes/phases); a corrupted,
// tampered, or extra-keyed record fails closed as STORE_QUARANTINED and is never trusted downstream.
describe('AS1 strict on-read parsing (B08)', () => {
  const OUTBOX = 'indexes/as1-slack-pilot/profiles/agent-office-advisor/slack-outbox.json';
  const QUESTIONS = 'indexes/as1-slack-pilot/profiles/agent-office-advisor/pending-questions.json';

  async function freshStore() {
    const root = await makeStateRoot();
    const store = await As1ProfileInboundStore.open(root, PROFILE, new FakeClock('2026-07-14T22:06:00.000Z'));
    return { root, store };
  }

  it('rejects an illegal phase, an extra key, and a malformed hash in a persisted outbox record', async () => {
    const base = { outboundId: 'out-1', phase: 'PREPARED', requestHash: null, responseHash: null, recordedAt: '2026-07-14T22:06:00.000Z' };
    for (const corrupt of [
      { ...base, phase: 'BOGUS_PHASE' }, // not a legal outbox phase
      { ...base, injected: 'x' }, // an unknown extra key (exact-key parsing)
      { ...base, requestHash: 'not-a-sha256' }, // a malformed hash
    ]) {
      const { root, store } = await freshStore();
      await store.recordOutboxPhase('out-1', 'PREPARED', { requestHash: `sha256:${'1'.repeat(64)}` }); // create the index, then corrupt bytes
      await writeFile(path.join(root, OUTBOX), JSON.stringify([corrupt]));
      await expect(store.readOutboxRecord('out-1'), JSON.stringify(corrupt)).rejects.toBeInstanceOf(DomainError);
    }
  });

  it('rejects a corrupted pending-question record on read', async () => {
    const { root, store } = await freshStore();
    await store.openQuestion({
      questionId: 'q1',
      rootTs: ROOT_TS,
      expectedResponseKind: 'CLARIFICATION',
      evidenceRef: 'advisor/jobs/x/q.json',
      evidenceHash: `sha256:${'7'.repeat(64)}`,
      openedAt: '2026-07-14T22:06:00.000Z',
      expiresAt: '2026-07-14T22:10:00.000Z',
    });
    // An illegal expectedResponseKind enum value must fail closed on the next read.
    await writeFile(
      path.join(root, QUESTIONS),
      JSON.stringify([
        {
          schemaVersion: 'agent-office.as1-pending-question.v1',
          questionId: 'q1',
          rootTs: ROOT_TS,
          expectedResponseKind: 'INVALID_KIND',
          evidenceRef: 'advisor/jobs/x/q.json',
          evidenceHash: `sha256:${'7'.repeat(64)}`,
          state: 'OPEN',
          openedAt: '2026-07-14T22:06:00.000Z',
          expiresAt: '2026-07-14T22:10:00.000Z',
          consumedAt: null,
          consumedBySourceEventId: null,
        },
      ]),
    );
    await expect(store.findOpenQuestionForRoot(ROOT_TS)).rejects.toBeInstanceOf(DomainError);
  });

  it('rejects an oversized persisted index on read (per-index count bound enforced every read)', async () => {
    const { root, store } = await freshStore();
    await store.openQuestion({
      questionId: 'seed',
      rootTs: ROOT_TS,
      expectedResponseKind: 'CLARIFICATION',
      evidenceRef: 'advisor/jobs/x/q.json',
      evidenceHash: `sha256:${'7'.repeat(64)}`,
      openedAt: '2026-07-14T22:06:00.000Z',
      expiresAt: '2026-07-14T22:10:00.000Z',
    });
    // 33 records exceeds the 32-record QUESTION_HISTORY bound; the read fails closed before trusting any record.
    const oversized = Array.from({ length: 33 }, (_unused, i) => ({
      schemaVersion: 'agent-office.as1-pending-question.v1',
      questionId: `q${String(i)}`,
      rootTs: ROOT_TS,
      expectedResponseKind: 'CLARIFICATION',
      evidenceRef: 'advisor/jobs/x/q.json',
      evidenceHash: `sha256:${'7'.repeat(64)}`,
      state: 'OPEN',
      openedAt: '2026-07-14T22:06:00.000Z',
      expiresAt: '2026-07-14T22:10:00.000Z',
      consumedAt: null,
      consumedBySourceEventId: null,
    }));
    await writeFile(path.join(root, QUESTIONS), JSON.stringify(oversized));
    await expect(store.findOpenQuestionForRoot(ROOT_TS)).rejects.toBeInstanceOf(DomainError);
  });

  it('rejects a malformed denial-audit record on read', async () => {
    const { root, store } = await freshStore();
    await store.recordDenialAudit('a reason', 'Ev0AGENTOFFICE01', 'Env1'); // create the index
    await writeFile(
      path.join(root, 'indexes/as1-slack-pilot/profiles/agent-office-advisor/denial-audit.json'),
      JSON.stringify([{ schemaVersion: 'agent-office.as1-denial-audit.v1', reason: 'x', eventId: null, envelopeId: null, recordedAt: '2026-07-14T22:06:00.000Z', extra: 'nope' }]),
    );
    await expect(store.recordDenialAudit('b', null, null)).rejects.toBeInstanceOf(DomainError);
  });

  it('rejects an unknown tmux phase and an illegal tmux transition', async () => {
    const { store } = await freshStore();
    const h = `sha256:${'a'.repeat(64)}`;
    const facts = {
      receiveGrantId: 'rg', receiveGrantBindingHash: h, pointerDeliveryGrantId: 'pdg', leaseId: 'lease', pilotId: 'pilot',
      profileId: 'AGENT_OFFICE_ADVISOR', advisorTeam: 'team', actorId: 'actor', roleInstanceId: 'role', intakeId: 'intake',
      sourceEventId: 'ev', pointerHash: h, destinationHash: h, governanceSnapshotHash: h, registrySnapshotHash: h,
      globalControlSnapshotHash: h, profileLatchSnapshotHash: h, pointerDeliveryGrantSnapshotHash: h,
    };
    await expect(store.recordTmuxPhase('d1', 'NONSENSE_PHASE', facts)).rejects.toBeInstanceOf(DomainError);
    await store.recordTmuxPhase('d1', 'PREPARED', facts);
    // Skipping to TRANSPORT_RECORDED from PREPARED is not a legal successor.
    await expect(store.recordTmuxPhase('d1', 'TRANSPORT_RECORDED', facts)).rejects.toBeInstanceOf(DomainError);
  });

  it('rejects an accepted-evidence record with an extra correlation key on read', async () => {
    const { root, store } = await freshStore();
    await writeFile(
      path.join(root, 'indexes/as1-slack-pilot/profiles/agent-office-advisor/evidence-ingress-checkpoint.json'),
      JSON.stringify([
        {
          evidenceKind: 'ACK',
          evidenceId: 'ev-ack-1',
          intakeId: 'as1-intake-0001',
          blobSha256: `sha256:${'5'.repeat(64)}`,
          sourceCommit: 'c'.repeat(40),
          repositoryId: 'agent-office',
          path: 'advisor/jobs/x/ack.json',
          envelopeHash: `sha256:${'e'.repeat(64)}`,
          // ACK correlation must be EXACTLY {advisorAckId, sourceEventId, pointerHash} — the extra key is rejected.
          correlation: { advisorAckId: 'ack-1', sourceEventId: 'Ev0AGENTOFFICE01', pointerHash: `sha256:${'4'.repeat(64)}`, injected: 'x' },
          sequence: 1,
          acceptedAt: '2026-07-14T22:06:00.000Z',
        },
      ]),
    );
    await expect(store.readAcceptedEvidence()).rejects.toBeInstanceOf(DomainError);
  });

  it('rejects an outbox phase/hash violation on write (immutable request hash)', async () => {
    const { store } = await freshStore();
    await store.recordOutboxPhase('o1', 'PREPARED', { requestHash: `sha256:${'1'.repeat(64)}` });
    // Re-recording PREPARED with a DIFFERENT request hash is corruption, not a silent replace.
    await expect(store.recordOutboxPhase('o1', 'PREPARED', { requestHash: `sha256:${'2'.repeat(64)}` })).rejects.toBeInstanceOf(DomainError);
  });

  it('rejects a FOREIGN-profile dedupe record in the profile-local tree (cross-profile contradiction)', async () => {
    const { root, store } = await freshStore();
    await store.insertDedupe({ envelopeId: 'Env0SEED', teamId: 'TWORKSPACE001', apiAppId: 'AAGENTOFFICE01', eventId: 'Ev0SEED', rawEnvelopeHash: `sha256:${'a'.repeat(64)}`, innerEventHash: `sha256:${'b'.repeat(64)}`, preAckClass: 'PREACK_PENDING' });
    // A record tagged with the OTHER profile in this profile's own tree is never trusted data.
    await writeFile(
      path.join(root, 'indexes/as1-slack-pilot/profiles/agent-office-advisor/inbound-dedupe.json'),
      JSON.stringify([{ schemaVersion: 'agent-office.as1-inbound-dedupe.v1', profileId: 'FOUNDATION_ADVISOR', envelopeId: 'Env0X', teamId: 'TWORKSPACE001', apiAppId: 'AAGENTOFFICE01', eventId: 'Ev0X', rawEnvelopeHash: `sha256:${'a'.repeat(64)}`, innerEventHash: `sha256:${'b'.repeat(64)}`, firstReceivedAt: '2026-07-14T22:06:00.000Z', lastReceivedAt: '2026-07-14T22:06:00.000Z', preAckClass: 'PREACK_PENDING', receiveGrantStateHash: null, intakeId: null, terminalReason: null }]),
    );
    await expect(store.insertDedupe({ envelopeId: 'Env0Y', teamId: 'TWORKSPACE001', apiAppId: 'AAGENTOFFICE01', eventId: 'Ev0Y', rawEnvelopeHash: `sha256:${'c'.repeat(64)}`, innerEventHash: `sha256:${'d'.repeat(64)}`, preAckClass: 'PREACK_PENDING' })).rejects.toBeInstanceOf(DomainError);
  });

  it('rejects tmux delivery facts tagged with a FOREIGN profile identity', async () => {
    const { root, store } = await freshStore();
    const h = `sha256:${'a'.repeat(64)}`;
    // Every field is well-formed, but profileId/advisorTeam/actorId/roleInstanceId name the OTHER profile.
    const foreignFacts = {
      receiveGrantId: 'rg', receiveGrantBindingHash: h, pointerDeliveryGrantId: 'pdg', leaseId: 'lease', pilotId: 'pilot',
      profileId: 'FOUNDATION_ADVISOR', advisorTeam: 'FOUNDATION_ADVISOR_TEAM', actorId: 'foundation-advisor',
      roleInstanceId: 'foundation-advisor-20260714-01', intakeId: 'intake', sourceEventId: 'ev', pointerHash: h,
      destinationHash: h, governanceSnapshotHash: h, registrySnapshotHash: h, globalControlSnapshotHash: h,
      profileLatchSnapshotHash: h, pointerDeliveryGrantSnapshotHash: h,
    };
    await writeFile(
      path.join(root, 'indexes/as1-slack-pilot/profiles/agent-office-advisor/tmux-delivery.json'),
      JSON.stringify([{ schemaVersion: 'agent-office.as1-tmux-delivery.v1', deliveryId: 'd1', phase: 'PREPARED', boundFacts: foreignFacts, recordedAt: '2026-07-14T22:06:00.000Z' }]),
    );
    await expect(store.readTmuxPhase('d1')).rejects.toBeInstanceOf(DomainError);
  });

  it('never auto-deletes or compacts durable state — the retention floor cannot be bypassed (B08)', async () => {
    const root = await makeStateRoot();
    const store = await As1ProfileInboundStore.open(root, PROFILE, new FakeClock('2026-07-14T22:06:00.000Z'));
    await store.recordDenialAudit('reason-old', 'Ev0OLD', 'Env0OLD');
    // Reopen far in the future (well beyond RETENTION_FLOOR_MS) and write again: the old record must persist —
    // there is no time-based deletion or compaction surface to bypass (writes only ever append or fail closed).
    const future = await As1ProfileInboundStore.open(root, PROFILE, new FakeClock('2030-01-01T00:00:00.000Z'));
    await future.recordDenialAudit('reason-new', 'Ev0NEW', 'Env0NEW');
    const bytes = await readFile(path.join(root, 'indexes/as1-slack-pilot/profiles/agent-office-advisor/denial-audit.json'), 'utf8');
    expect(bytes).toContain('reason-old'); // aged record retained, never auto-evicted
    expect(bytes).toContain('reason-new');
  });
});

// B08 re-review (AS1-PATCH-V3-08): each of these fails on 0e4274f — which parses every field in isolation, reads
// unbounded bytes, and treats a matching rootTs as idempotent — and must fail closed here. A syntactically valid
// but semantically impossible durable record, an oversized file, and a divergent duplicate all quarantine.
describe('AS1 relational + byte durable invariants (B08 re-review)', () => {
  const DIR = 'indexes/as1-slack-pilot/profiles/agent-office-advisor';
  const H = `sha256:${'a'.repeat(64)}`;
  const OBSERVED = {
    candidateKind: 'ROOT',
    sourceEventId: EVENT_ID,
    rootTs: ROOT_TS,
    rootKeyHash: H,
    receiptArtifactRef: 'advisor/jobs/x/receipt.json',
    receiptArtifactHash: H,
    messageArtifactRef: 'advisor/jobs/x/message.json',
    messageArtifactHash: H,
  };
  const BASE_TRANSPORT = {
    schemaVersion: 'agent-office.as1-transport-record.v1',
    eventId: EVENT_ID,
    envelopeId: 'Env1',
    state: 'PREACK_PENDING',
    rawEnvelopeHash: H,
    innerEventHash: H,
    observed: OBSERVED,
    preAckDecision: null as string | null,
    terminalReason: null as string | null,
    bindingStateHash: null as string | null,
    continuation: null as unknown,
    transportAckRecorded: false,
    intakeId: null as string | null,
    pointerArtifactRef: null as string | null,
    recordedAt: '2026-07-14T22:06:00.000Z',
    ackedAt: null as string | null,
    materializedAt: null as string | null,
  };

  async function freshStore() {
    const root = await makeStateRoot();
    const store = await As1ProfileInboundStore.open(root, PROFILE, new FakeClock('2026-07-14T22:06:00.000Z'));
    await mkdir(path.join(root, DIR, 'receive-grant-state'), { recursive: true });
    return { root, store };
  }

  async function writeIndex(root: string, name: string, value: unknown): Promise<void> {
    await writeFile(path.join(root, DIR, name), JSON.stringify(value));
  }

  it('rejects a ROOT_BOUND receive-grant state that carries no bound root (impossible relation)', async () => {
    const { root, store } = await freshStore();
    const impossible = {
      schemaVersion: 'agent-office.as1-pilot-receive-grant-state.v1',
      receiveGrantId: 'as1-receive-grant-0001', pilotId: 'as1-pilot-0001', profileId: 'AGENT_OFFICE_ADVISOR',
      phase: 'ROOT_BOUND', rootLimit: 1, rootSlotConsumed: true, // claims a consumed, bound root...
      boundSourceEventId: null, boundRootTs: null, boundRootKeyHash: null, boundReceiptArtifactRef: null,
      boundReceiptArtifactHash: null, boundMessageArtifactHash: null, boundAt: null, // ...but no bound fields
      previousStateHash: H, stateHash: H, version: 1,
    };
    await writeFile(path.join(root, DIR, 'receive-grant-state', 'as1-receive-grant-0001.json'), JSON.stringify([impossible]));
    await expect(store.readReceiveGrantState('as1-receive-grant-0001')).rejects.toBeInstanceOf(DomainError);
  });

  it('rejects a MATERIALIZED transport record with no intake, and a TERMINAL_NO_INTAKE with a non-rejected decision', async () => {
    for (const corrupt of [
      { ...BASE_TRANSPORT, state: 'MATERIALIZED', preAckDecision: 'ROOT_BOUND', transportAckRecorded: true, ackedAt: '2026-07-14T22:06:01.000Z', intakeId: null }, // MATERIALIZED but no intake
      { ...BASE_TRANSPORT, state: 'TERMINAL_NO_INTAKE', preAckDecision: 'ROOT_BOUND', transportAckRecorded: true, ackedAt: '2026-07-14T22:06:01.000Z' }, // terminal without a rejection
    ]) {
      const { root, store } = await freshStore();
      await writeIndex(root, 'transport-journal.json', [corrupt]);
      await expect(store.readTransport(EVENT_ID), JSON.stringify(corrupt.state)).rejects.toBeInstanceOf(DomainError);
    }
  });

  it('rejects a CONSUMED pending question that is missing its consumption fields', async () => {
    const { root, store } = await freshStore();
    await writeIndex(root, 'pending-questions.json', [
      {
        schemaVersion: 'agent-office.as1-pending-question.v1', questionId: 'q1', rootTs: ROOT_TS,
        expectedResponseKind: 'CLARIFICATION', evidenceRef: 'advisor/jobs/x/q.json', evidenceHash: H,
        state: 'CONSUMED', openedAt: '2026-07-14T22:06:00.000Z', expiresAt: '2026-07-14T22:10:00.000Z',
        consumedAt: null, consumedBySourceEventId: null, // CONSUMED must carry both
      },
    ]);
    await expect(store.findOpenQuestionForRoot(ROOT_TS)).rejects.toBeInstanceOf(DomainError);
  });

  it('rejects a dedupe record whose preAckClass is not a closed durable transport phase', async () => {
    const { root, store } = await freshStore();
    await writeIndex(root, 'inbound-dedupe.json', [
      {
        schemaVersion: 'agent-office.as1-inbound-dedupe.v1', profileId: 'AGENT_OFFICE_ADVISOR', envelopeId: 'Env1',
        teamId: 'TWORKSPACE001', apiAppId: 'AAGENTOFFICE01', eventId: EVENT_ID, rawEnvelopeHash: H, innerEventHash: H,
        firstReceivedAt: '2026-07-14T22:06:00.000Z', lastReceivedAt: '2026-07-14T22:06:00.000Z',
        preAckClass: 'NOT_A_TRANSPORT_PHASE', receiveGrantStateHash: null, intakeId: null, terminalReason: null,
      },
    ]);
    await expect(
      store.insertDedupe({ envelopeId: 'Env2', teamId: 'TWORKSPACE001', apiAppId: 'AAGENTOFFICE01', eventId: 'Ev0X', rawEnvelopeHash: H, innerEventHash: H, preAckClass: 'PREACK_PENDING' }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('rejects an oversized durable index before it is read/parsed (fixed byte bound)', async () => {
    const { root, store } = await freshStore();
    // A > 1 MiB file fails the byte bound before allocation/JSON.parse, regardless of its (in)validity.
    await writeFile(path.join(root, DIR, 'pending-questions.json'), ' '.repeat(1_100_000));
    await expect(store.findOpenQuestionForRoot(ROOT_TS)).rejects.toBeInstanceOf(DomainError);
  });

  it('treats a matching-rootTs root correlation as idempotent ONLY on exact equality; a divergent duplicate fails closed', async () => {
    const { store } = await freshStore();
    const base = { rootTs: ROOT_TS, rootKeyHash: H, sourceEventId: EVENT_ID, receiveGrantId: 'as1-receive-grant-0001', bindingStateHash: H, intakeId: 'as1-intake-0001' };
    await store.recordRootCorrelation(base);
    await store.recordRootCorrelation({ ...base }); // exact duplicate — idempotent, no throw
    await expect(
      store.recordRootCorrelation({ ...base, sourceEventId: 'Ev0DIFFERENT' }), // same rootTs, divergent identity
    ).rejects.toBeInstanceOf(DomainError);
  });
});

// B02 re-review (AS1-PATCH-V3-02): an ACKable rejection with a usable event identity is now driven through the
// SAME durable transport state machine to an exactly-once TERMINAL_NO_INTAKE, so a crash/retry/restart reproduces
// the immutable terminal decision. On 0e4274f these rejections left NO transport record (a bare denial-audit +
// ACK), so every assertion on readTransport below is null there. Identity contradictions still latch, unACKed,
// with no record.
describe('AS1 ACKable rejection durability (B02 re-review)', () => {
  it('drives a deferred-query rejection through the machine to a durable TERMINAL_NO_INTAKE', async () => {
    const { store, service } = await newSession();
    const result = await service.processEnvelope(slackEnvelope({ text: 'status please' }));
    expect(result.classification).toBe('REJECTED_DEFERRED_QUERY');
    expect(result.acked).toBe(true);
    expect(result.latched).toBe(false);
    const record = await store.readTransport(EVENT_ID);
    expect(record?.state).toBe('TERMINAL_NO_INTAKE');
    expect(record?.preAckDecision).toBe('REJECTED');
    expect(record?.terminalReason).toBe('REJECTED_DEFERRED_QUERY');
    expect(record?.transportAckRecorded).toBe(true);
    expect(record?.intakeId).toBeNull();
  });

  it('drives a bot-echo rejection (a non-deferred policy reject) to a durable TERMINAL_NO_INTAKE', async () => {
    const { store, service } = await newSession();
    const result = await service.processEnvelope(slackEnvelope({ botId: 'BAGENTOFFICE01' }));
    expect(result.classification).toBe('REJECTED_NON_LEO_OR_BOT');
    expect(result.acked).toBe(true);
    expect((await store.readTransport(EVENT_ID))?.state).toBe('TERMINAL_NO_INTAKE');
  });

  it('a rejection whose ACK crashes resumes at PREACK_REJECTED and retries to TERMINAL_NO_INTAKE exactly once', async () => {
    const { store, service } = await newSession();
    await expect(service.processEnvelope(crashingAck({ text: 'status please' }))).rejects.toThrow('simulated ACK crash');
    const mid = await store.readTransport(EVENT_ID);
    // Committed rejection decision, NOT PREACK_PENDING — so recovery/retry can never re-derive a root bind.
    expect(mid?.state).toBe('PREACK_REJECTED');
    expect(mid?.transportAckRecorded).toBe(false);
    const retry = await service.processEnvelope(slackEnvelope({ text: 'status please' }));
    expect(retry.classification).toBe('REJECTED_DEFERRED_QUERY');
    expect(retry.acked).toBe(true);
    expect((await store.readTransport(EVENT_ID))?.state).toBe('TERMINAL_NO_INTAKE');
  });

  it('after restart, an identical retry reproduces the durable rejection (DUPLICATE), never a fresh denial', async () => {
    const { root, store, service } = await newSession();
    await service.processEnvelope(slackEnvelope({ text: 'status please' }));
    expect((await store.readTransport(EVENT_ID))?.state).toBe('TERMINAL_NO_INTAKE');
    const { store: store2, service: service2 } = await reopen(root, '2026-07-14T22:07:00.000Z');
    const retry = await service2.processEnvelope(slackEnvelope({ text: 'status please' }));
    expect(retry.acked).toBe(true);
    expect(retry.classification).toBe('DUPLICATE');
    expect((await store2.readTransport(EVENT_ID))?.state).toBe('TERMINAL_NO_INTAKE');
  });

  it('a divergent re-delivery of a rejected event (same id, different bytes) fails closed', async () => {
    const { service } = await newSession();
    await service.processEnvelope(slackEnvelope({ text: 'status please' }));
    // Same default event_id, different inner bytes (different deferred text). The rejection now persists a durable
    // receipt/transport record, so the re-delivery fails closed at the immutable-identity guard (never a silent
    // overwrite and never a fresh divergent ACK). On 0e4274f the first rejection persisted nothing, so the second
    // delivery simply ACKed again — this assertion fails there.
    await expect(service.processEnvelope(slackEnvelope({ text: 'status now' }))).rejects.toThrow();
  });

  it('an identity-contradiction rejection latches unACKed and creates NO transport record (separate policy kept)', async () => {
    const { store, service } = await newSession();
    const result = await service.processEnvelope(slackEnvelope({ teamId: 'TOTHERWORKSP01' }));
    expect(result.latched).toBe(true);
    expect(result.acked).toBe(false);
    expect(await store.readTransport(EVENT_ID)).toBeNull();
  });
});

// B08 re-review V5 (AS1-PATCH-V5-08A): exact dedupe phase-to-field matrix + transport identity/candidate-kind/
// binding correlations. Each malicious well-typed fixture is accepted on 4cf967d and must fail closed here,
// including the Reviewer-reproduced MATERIALIZED dedupe row with all terminal fields null.
describe('AS1 exact dedupe/transport phase-to-field matrix (B08 V5)', () => {
  const DIR5 = 'indexes/as1-slack-pilot/profiles/agent-office-advisor';
  const H5 = `sha256:${'c'.repeat(64)}`;
  const OBS5 = {
    candidateKind: 'ROOT', sourceEventId: EVENT_ID, rootTs: ROOT_TS, rootKeyHash: H5,
    receiptArtifactRef: 'advisor/jobs/x/receipt.json', receiptArtifactHash: H5,
    messageArtifactRef: 'advisor/jobs/x/message.json', messageArtifactHash: H5,
  };
  const BASE5 = {
    schemaVersion: 'agent-office.as1-transport-record.v1', eventId: EVENT_ID, envelopeId: 'Env1',
    state: 'PREACK_PENDING', rawEnvelopeHash: H5, innerEventHash: H5, observed: OBS5,
    preAckDecision: null as string | null, terminalReason: null as string | null, bindingStateHash: null as string | null,
    continuation: null as unknown, transportAckRecorded: false, intakeId: null as string | null,
    pointerArtifactRef: null as string | null, recordedAt: '2026-07-14T22:06:00.000Z', ackedAt: null as string | null,
    materializedAt: null as string | null,
  };
  const DEDUPE5 = {
    schemaVersion: 'agent-office.as1-inbound-dedupe.v1', profileId: 'AGENT_OFFICE_ADVISOR', envelopeId: 'Env1',
    teamId: 'TWORKSPACE001', apiAppId: 'AAGENTOFFICE01', eventId: EVENT_ID, rawEnvelopeHash: H5, innerEventHash: H5,
    firstReceivedAt: '2026-07-14T22:06:00.000Z', lastReceivedAt: '2026-07-14T22:06:00.000Z',
    preAckClass: 'PREACK_PENDING', receiveGrantStateHash: null as string | null, intakeId: null as string | null, terminalReason: null as string | null,
  };
  const NEW_INSERT = { envelopeId: 'Env2', teamId: 'TWORKSPACE001', apiAppId: 'AAGENTOFFICE01', eventId: 'Ev0Z', rawEnvelopeHash: H5, innerEventHash: H5, preAckClass: 'PREACK_PENDING' as const };

  async function fresh() {
    const root = await makeStateRoot();
    const store = await As1ProfileInboundStore.open(root, PROFILE, new FakeClock('2026-07-14T22:06:00.000Z'));
    await mkdir(path.join(root, DIR5), { recursive: true });
    return { root, store };
  }
  async function writeIdx(root: string, name: string, value: unknown): Promise<void> {
    await writeFile(path.join(root, DIR5, name), JSON.stringify(value));
  }

  it('quarantines any dedupe row whose preAckClass is not the canonical PREACK_PENDING (incl. the reproduced MATERIALIZED-all-null)', async () => {
    for (const preAckClass of ['MATERIALIZED', 'TERMINAL_NO_INTAKE', 'PREACK_ROOT_BOUND', 'PREACK_CONTINUATION_CONSUMED', 'PREACK_REJECTED', 'TRANSPORT_ACK_RECORDED']) {
      const { root, store } = await fresh();
      await writeIdx(root, 'inbound-dedupe.json', [{ ...DEDUPE5, preAckClass }]);
      await expect(store.insertDedupe(NEW_INSERT), preAckClass).rejects.toBeInstanceOf(DomainError);
    }
  });

  it('quarantines a dedupe row with a populated decision field (no writer populates them)', async () => {
    for (const bad of [{ ...DEDUPE5, intakeId: 'as1-intake-0001' }, { ...DEDUPE5, terminalReason: 'REJECTED_DEFERRED_QUERY' }, { ...DEDUPE5, receiveGrantStateHash: H5 }]) {
      const { root, store } = await fresh();
      await writeIdx(root, 'inbound-dedupe.json', [bad]);
      await expect(store.insertDedupe(NEW_INSERT)).rejects.toBeInstanceOf(DomainError);
    }
  });

  it('quarantines a transport record whose eventId does not equal observed.sourceEventId', async () => {
    const { root, store } = await fresh();
    await writeIdx(root, 'transport-journal.json', [{ ...BASE5, eventId: 'Ev0DIFFERENT' }]);
    await expect(store.readTransport('Ev0DIFFERENT')).rejects.toBeInstanceOf(DomainError);
  });

  it('quarantines a candidate kind that disagrees with the committed pre-ACK decision', async () => {
    for (const bad of [
      { ...BASE5, state: 'PREACK_ROOT_BOUND', preAckDecision: 'ROOT_BOUND', bindingStateHash: H5, observed: { ...OBS5, candidateKind: 'CONTINUATION' } },
      { ...BASE5, state: 'PREACK_CONTINUATION_CONSUMED', preAckDecision: 'CONTINUATION_CONSUMED', bindingStateHash: H5, continuation: { kind: 'CLARIFICATION', originalIntakeId: 'as1-intake-0001', questionId: 'q1' }, observed: { ...OBS5, candidateKind: 'ROOT' } },
    ]) {
      const { root, store } = await fresh();
      await writeIdx(root, 'transport-journal.json', [bad]);
      await expect(store.readTransport(EVENT_ID), bad.state).rejects.toBeInstanceOf(DomainError);
    }
  });

  it('quarantines a bound decision missing its bindingStateHash, and a PENDING record carrying one', async () => {
    for (const bad of [
      { ...BASE5, state: 'PREACK_ROOT_BOUND', preAckDecision: 'ROOT_BOUND', bindingStateHash: null },
      { ...BASE5, bindingStateHash: H5 },
    ]) {
      const { root, store } = await fresh();
      await writeIdx(root, 'transport-journal.json', [bad]);
      await expect(store.readTransport(EVENT_ID), bad.state).rejects.toBeInstanceOf(DomainError);
    }
  });
});
