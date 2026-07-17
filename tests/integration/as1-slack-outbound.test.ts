import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { As1ProfileInboundStore, rootKeyHash } from '../../src/application/slack-pilot/inbound-store.js';
import { selectProfile } from '../../src/application/slack-pilot/profiles.js';
import {
  As1Outbox,
  As1OutboundError,
  renderOutbound,
  userStatusOutboundId,
  type As1OutboundRecord,
  type As1UserStatusKind,
} from '../../src/application/slack-pilot/outbox.js';
import type { As1AcceptedOutbound } from '../../src/application/slack-pilot/evidence-ingress.js';
import { FakeClock, FakeWebPort, sealAcceptedOutboundVia } from '../helpers/as1-slack-fakes.js';
import { makeStateRoot } from '../helpers/fixtures.js';

const ACK_RECORD: As1OutboundRecord = { kind: 'ACK', intakeId: 'as1-intake-0001', advisorAckId: 'ack-0001', summary: 'received your mission' };
const ROOT_TS = '1720000000.000100';

/** Construct a profile-bound outbox with mandatory internal deps; the accepted root is seeded in the store. */
async function makeOutbox(opts: { assertSendable?: () => Promise<void>; seedRoot?: 'correct' | 'wrong' | 'none' } = {}) {
  const root = await makeStateRoot();
  const store = await As1ProfileInboundStore.open(root, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock('2026-07-14T22:06:00.000Z'));
  const seedRoot = opts.seedRoot ?? 'correct';
  if (seedRoot !== 'none') {
    const correctHash = rootKeyHash('AGENT_OFFICE_ADVISOR', 'TWORKSPACE001', 'AAGENTOFFICE01', 'CAGENTOFFICE01', ROOT_TS);
    await store.recordRootCorrelation({
      rootTs: ROOT_TS,
      rootKeyHash: seedRoot === 'correct' ? correctHash : `sha256:${'9'.repeat(64)}`,
      sourceEventId: 'Ev0AGENTOFFICE01',
      receiveGrantId: 'as1-receive-grant-0001',
      bindingStateHash: `sha256:${'2'.repeat(64)}`,
      intakeId: 'as1-intake-0001',
    });
  }
  const web = new FakeWebPort();
  const latched: string[] = [];
  const outbox = new As1Outbox({
    profile: selectProfile('AGENT_OFFICE_ADVISOR'),
    secret: { workspaceId: 'TWORKSPACE001', appId: 'AAGENTOFFICE01', channelId: 'CAGENTOFFICE01', botToken: 'xoxb-agentoffice-placeholder-0001' },
    store,
    web,
    latch: (reason: string) => {
      latched.push(reason);
      return Promise.resolve();
    },
    assertSendable: opts.assertSendable ?? ((): Promise<void> => Promise.resolve()),
    delay: () => Promise.resolve(),
  });
  // The branded ACK outbound is produced only by a real, successful ingestion (never fabricated by the test).
  const accepted = await sealAcceptedOutboundVia(store, 'INTAKE');
  return { root, store, web, outbox, accepted, latched };
}

function grabDomainError(fn: () => unknown): DomainError {
  try {
    fn();
  } catch (error) {
    if (error instanceof DomainError) return error;
    throw error;
  }
  throw new Error('expected a DomainError but none was thrown');
}

describe('AS1 outbound rendering and redaction', () => {
  it('renders ACK / QUESTION / RESULT to bounded plain text', () => {
    expect(renderOutbound(ACK_RECORD)).toBe('ACK: received your mission');
    expect(
      renderOutbound({ kind: 'QUESTION', intakeId: 'i', questionId: 'q', expectedResponseKind: 'CLARIFICATION', text: 'which repo?' }),
    ).toBe('QUESTION (CLARIFICATION): which repo?');
    expect(
      renderOutbound({
        kind: 'RESULT',
        intakeId: 'i',
        resultId: 'r',
        terminalStatus: 'COMPLETED',
        resultArtifact: { repository: 'agent-office', commit: 'c'.repeat(40), path: 'advisor/jobs/x/result.json', sha256: `sha256:${'6'.repeat(64)}` },
        summary: 'done',
      }),
    ).toBe('RESULT [COMPLETED]: done');
  });

  it('rejects a token-shaped value in the outbound text', () => {
    expect(grabDomainError(() => renderOutbound({ ...ACK_RECORD, summary: 'here is xoxb-leaked-token' })).code).toBe('INVALID_SCHEMA');
  });

  it('rejects a Slack mention control form', () => {
    expect(grabDomainError(() => renderOutbound({ ...ACK_RECORD, summary: '<@U0BD3523C1F> ping' })).code).toBe('INVALID_SCHEMA');
  });
});

describe('AS1 outbound transport', () => {
  it('sends the fixed-product ACK on the resolved root/channel and records RESPONSE_RECORDED', async () => {
    const { store, web, outbox, accepted } = await makeOutbox();
    const result = await outbox.send(accepted);
    expect(result.outcome).toBe('DELIVERED');
    expect(result.attempts).toBe(1);
    expect(web.posted).toHaveLength(1);
    expect(web.posted[0]?.request).toStrictEqual({
      channel: 'CAGENTOFFICE01',
      threadTs: ROOT_TS,
      text: 'ACK: Advisor accepted the mission and will proceed.',
    });
    expect(await store.readOutboxPhase(accepted.outboundId)).toBe('RESPONSE_RECORDED');
  });

  it('persists the immutable request and response artifact hashes', async () => {
    const { store, outbox, accepted } = await makeOutbox();
    await outbox.send(accepted);
    const record = await store.readOutboxRecord(accepted.outboundId);
    expect(record?.phase).toBe('RESPONSE_RECORDED');
    expect(record?.requestHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(record?.responseHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  it('binds the durable outbound id to the accepted evidence: the SAME accepted value cannot be delivered twice', async () => {
    const { web, outbox, accepted } = await makeOutbox();
    expect((await outbox.send(accepted)).outcome).toBe('DELIVERED');
    // There is no caller-chosen id to vary; re-sending the same accepted value resolves the same durable record.
    const again = await outbox.send(accepted);
    expect(again.outcome).toBe('DELIVERED');
    expect(again.phase).toBe('RESPONSE_RECORDED');
    expect(web.posted).toHaveLength(1); // exactly one network send for one accepted evidence
  });

  it('fails closed on a forged (non-sealed) outbound value', async () => {
    const { outbox } = await makeOutbox();
    const forged = { outboundId: 'as1out-forged', evidenceId: 'forged', record: ACK_RECORD } as unknown as As1AcceptedOutbound;
    await expect(outbox.send(forged)).rejects.toBeInstanceOf(DomainError);
  });

  it('refuses the send cleanly when the control gate is not sendable (no network)', async () => {
    const { store, web, outbox, accepted } = await makeOutbox({
      assertSendable: () => Promise.reject(new DomainError('FORBIDDEN_TARGET', 'profile latched')),
    });
    const result = await outbox.send(accepted);
    expect(result.outcome).toBe('REJECTED_CONTROL');
    expect(web.posted).toHaveLength(0);
    expect(await store.readOutboxPhase(accepted.outboundId)).toBeNull();
  });

  it('latches and fails without network on a durable STORE_QUARANTINED from the outbox journal (B08)', async () => {
    const { root, web, outbox, accepted, latched } = await makeOutbox();
    // Corrupt the outbox index so the first journal read fails closed.
    await writeFile(
      path.join(root, 'indexes/as1-slack-pilot/profiles/agent-office-advisor/slack-outbox.json'),
      JSON.stringify([{ outboundId: 'x', phase: 'BOGUS_PHASE', requestHash: null, responseHash: null, recordedAt: '2026-07-14T22:06:00.000Z' }]),
    );
    const result = await outbox.send(accepted);
    expect(result.outcome).toBe('REJECTED_STORE');
    expect(latched.length).toBeGreaterThan(0);
    expect(web.posted).toHaveLength(0);
  });

  it('rejects when the intake has no accepted root', async () => {
    const { web, outbox, accepted } = await makeOutbox({ seedRoot: 'none' });
    const result = await outbox.send(accepted);
    expect(result.outcome).toBe('REJECTED_ROOT');
    expect(web.posted).toHaveLength(0);
  });

  it('rejects when the root key hash disagrees with the bound profile config', async () => {
    const { web, outbox, accepted } = await makeOutbox({ seedRoot: 'wrong' });
    const result = await outbox.send(accepted);
    expect(result.outcome).toBe('REJECTED_ROOT');
    expect(result.reason).toContain('root key hash');
    expect(web.posted).toHaveLength(0);
  });

  it('retries once after a proven connection-before-send failure', async () => {
    const { web, outbox, accepted } = await makeOutbox();
    web.setPostScript([new As1OutboundError('CONNECTION_BEFORE_SEND', 'dns failed'), 'ok']);
    const result = await outbox.send(accepted);
    expect(result.outcome).toBe('DELIVERED');
    expect(result.attempts).toBe(2);
  });

  it('retries once after an explicit rate-limit response', async () => {
    const { web, outbox, accepted } = await makeOutbox();
    web.setPostScript([new As1OutboundError('RATE_LIMITED', 'slow down', 1_000), 'ok']);
    const result = await outbox.send(accepted);
    expect(result.outcome).toBe('DELIVERED');
    expect(result.attempts).toBe(2);
  });

  it('never blind-resends after an ambiguous failure and durably latches', async () => {
    const { store, web, outbox, accepted, latched } = await makeOutbox();
    web.setPostScript([new As1OutboundError('AMBIGUOUS', 'timeout after request write')]);
    const result = await outbox.send(accepted);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(web.posted).toHaveLength(1);
    expect(latched.length).toBeGreaterThan(0);
    expect(await store.readOutboxPhase(accepted.outboundId)).toBe('MANUAL_RECONCILIATION_REQUIRED');
  });

  it('resumes an interrupted REQUEST_STARTED as manual reconciliation without a network resend', async () => {
    const { store, web, outbox, accepted, latched } = await makeOutbox();
    // A durable in-flight state from a prior crash: PREPARED (with the bound request hash) then REQUEST_STARTED.
    await store.recordOutboxPhase(accepted.outboundId, 'PREPARED', { requestHash: `sha256:${'1'.repeat(64)}` });
    await store.recordOutboxPhase(accepted.outboundId, 'REQUEST_STARTED');
    const result = await outbox.send(accepted);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(web.posted).toHaveLength(0); // never re-sent
    expect(latched.length).toBeGreaterThan(0);
  });

  it('latches a PREPARED restart whose stored request hash differs (defense in depth)', async () => {
    const { store, outbox, accepted, latched } = await makeOutbox();
    await store.recordOutboxPhase(accepted.outboundId, 'PREPARED', { requestHash: `sha256:${'9'.repeat(64)}` });
    const result = await outbox.send(accepted);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(latched.length).toBeGreaterThan(0);
  });

  it('resumes a delivered phase without a network resend (natural RESPONSE_RECORDED)', async () => {
    const { store, web, outbox, accepted } = await makeOutbox();
    expect((await outbox.send(accepted)).outcome).toBe('DELIVERED'); // reaches RESPONSE_RECORDED naturally
    expect(await store.readOutboxPhase(accepted.outboundId)).toBe('RESPONSE_RECORDED');
    const again = await outbox.send(accepted);
    expect(again.outcome).toBe('DELIVERED');
    expect(web.posted).toHaveLength(1); // the delivered phase resumes with no second send
  });

  it('treats a success with a non-Slack timestamp grammar as ambiguous', async () => {
    const { web, outbox, accepted, latched } = await makeOutbox();
    web.setPostResult({ ok: true, channel: 'CAGENTOFFICE01', ts: 'not-a-timestamp' });
    const result = await outbox.send(accepted);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(latched.length).toBeGreaterThan(0);
  });

  it('treats a malformed success as ambiguous', async () => {
    const { web, outbox, accepted } = await makeOutbox();
    web.setPostScript(['malformed']);
    const result = await outbox.send(accepted);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(web.posted).toHaveLength(1);
  });

  it('reconciles after three exhausted rate limits without a fourth attempt', async () => {
    const { web, outbox, accepted } = await makeOutbox();
    web.setPostScript([
      new As1OutboundError('RATE_LIMITED', 'x', 100),
      new As1OutboundError('RATE_LIMITED', 'x', 100),
      new As1OutboundError('RATE_LIMITED', 'x', 100),
    ]);
    const result = await outbox.send(accepted);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(result.attempts).toBe(3);
    expect(web.posted).toHaveLength(3);
  });
});

// R2 recovery design §5: the narrow closed same-thread user-status sender. It shares the exact accepted send state
// machine; it accepts neither a target nor free-form text.
const STATUS_TEXT: Readonly<Record<As1UserStatusKind, string>> = {
  ACCEPTED: '요청 접수 완료 · Advisor에게 전달 중',
  DELIVERY_CONFIRMED: '메시지 전달 완료 · 답변 대기 중',
  DELIVERY_FAILED: '전달 실패 · 요청은 실행되지 않았습니다',
  PROCESSING_FAILED: '처리 실패 · 안전하게 중지되었습니다',
};
const ALL_KINDS: readonly As1UserStatusKind[] = ['ACCEPTED', 'DELIVERY_CONFIRMED', 'DELIVERY_FAILED', 'PROCESSING_FAILED'];
const INTAKE = 'as1-intake-0001';

describe('AS1 same-thread user status (R2 recovery design §5)', () => {
  it('renders each kind to EXACTLY its constant Korean text on the profile channel and accepted rootTs', async () => {
    for (const kind of ALL_KINDS) {
      const { store, web, outbox } = await makeOutbox();
      // Every status after ACCEPTED requires the deterministic ACCEPTED record at RESPONSE_RECORDED (§5.6 ordering);
      // seed it through the legal phase transitions so each kind's rendering can be exercised in isolation.
      if (kind !== 'ACCEPTED') {
        const acceptedId = userStatusOutboundId('AGENT_OFFICE_ADVISOR', INTAKE, 'ACCEPTED');
        await store.recordOutboxPhase(acceptedId, 'PREPARED', { requestHash: `sha256:${'a'.repeat(64)}` });
        await store.recordOutboxPhase(acceptedId, 'REQUEST_STARTED');
        await store.recordOutboxPhase(acceptedId, 'RESPONSE_RECORDED', { responseHash: `sha256:${'b'.repeat(64)}` });
      }
      const result = await outbox.sendStatus(INTAKE, kind);
      expect(result.outcome).toBe('DELIVERED');
      expect(web.posted).toHaveLength(1);
      expect(web.posted[0]?.request).toStrictEqual({ channel: 'CAGENTOFFICE01', threadTs: ROOT_TS, text: STATUS_TEXT[kind] });
      // No token, dynamic error, stack, path, session id, raw frame, or payload leaks into the message.
      expect(web.posted[0]?.request.text).not.toMatch(/xox|token|sha256:|Error|\/home\/|Ev0|as1-intake/u);
    }
  });

  it('derives four stable, distinct 74-byte deterministic ids with no caller nonce', () => {
    const ids = ALL_KINDS.map((k) => userStatusOutboundId('AGENT_OFFICE_ADVISOR', INTAKE, k));
    for (const id of ids) {
      expect(id).toMatch(/^as1status-[0-9a-f]{64}$/u);
      expect(Buffer.byteLength(id, 'utf8')).toBe(74);
    }
    expect(new Set(ids).size).toBe(4); // distinct per kind
    // Stable: same profile/intake/kind → identical id (no timestamp/retry/nonce).
    expect(userStatusOutboundId('AGENT_OFFICE_ADVISOR', INTAKE, 'ACCEPTED')).toBe(ids[0]);
    // A different intake yields a different id.
    expect(userStatusOutboundId('AGENT_OFFICE_ADVISOR', 'as1-intake-9999', 'ACCEPTED')).not.toBe(ids[0]);
  });

  it('posts a same-kind status exactly once across replays (no blind resend)', async () => {
    const { web, outbox } = await makeOutbox();
    expect((await outbox.sendStatus(INTAKE, 'ACCEPTED')).outcome).toBe('DELIVERED');
    const again = await outbox.sendStatus(INTAKE, 'ACCEPTED');
    expect(again.outcome).toBe('DELIVERED');
    expect(again.phase).toBe('RESPONSE_RECORDED');
    expect(web.posted).toHaveLength(1); // one network send for one deterministic status id
  });

  it('sends NO network when the accepted root is missing or its key hash disagrees', async () => {
    const none = await makeOutbox({ seedRoot: 'none' });
    expect((await none.outbox.sendStatus(INTAKE, 'ACCEPTED')).outcome).toBe('REJECTED_ROOT');
    expect(none.web.posted).toHaveLength(0);
    const wrong = await makeOutbox({ seedRoot: 'wrong' });
    expect((await wrong.outbox.sendStatus(INTAKE, 'ACCEPTED')).outcome).toBe('REJECTED_ROOT');
    expect(wrong.web.posted).toHaveLength(0);
  });

  it('never resends after a durable REQUEST_STARTED: it latches and moves to manual reconciliation', async () => {
    const { store, web, outbox, latched } = await makeOutbox();
    const id = userStatusOutboundId('AGENT_OFFICE_ADVISOR', INTAKE, 'ACCEPTED');
    await store.recordOutboxPhase(id, 'PREPARED', { requestHash: `sha256:${'1'.repeat(64)}` });
    await store.recordOutboxPhase(id, 'REQUEST_STARTED');
    const result = await outbox.sendStatus(INTAKE, 'ACCEPTED');
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(web.posted).toHaveLength(0);
    expect(latched.length).toBeGreaterThan(0);
  });

  it('latches on an ambiguous status post and attempts no alternate status as a fallback', async () => {
    const { web, outbox, latched } = await makeOutbox();
    web.setPostScript([new As1OutboundError('AMBIGUOUS', 'timeout after request write')]);
    const result = await outbox.sendStatus(INTAKE, 'ACCEPTED');
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(latched.length).toBeGreaterThan(0);
    expect(web.posted).toHaveLength(1); // the one ambiguous attempt only — no alternate status is tried
  });
});

// R2 recovery design §5.6: the status-specific ordering guard runs at sendStatus entry AND before every durable/Web
// side effect. These prove the defect (an out-of-order or behind-a-barrier status) would post without the guard.
/** An assertSendable that permits the request-artifact and PREPARED writes, then refuses immediately before the
 *  REQUEST_STARTED write (the 3rd gate) — leaving a REAL PREPARED artifact for a same-failure recovery test. */
const makeThirdCallFails = (): (() => Promise<void>) => {
  let calls = 0;
  return () => {
    calls += 1;
    return calls >= 3 ? Promise.reject(new DomainError('FORBIDDEN_TARGET', 'interrupted before REQUEST_STARTED')) : Promise.resolve();
  };
};

const seedStatus = async (store: As1ProfileInboundStore, kind: As1UserStatusKind, phase: 'PREPARED' | 'RESPONSE_RECORDED'): Promise<void> => {
  const id = userStatusOutboundId('AGENT_OFFICE_ADVISOR', INTAKE, kind);
  await store.recordOutboxPhase(id, 'PREPARED', { requestHash: `sha256:${'a'.repeat(64)}` });
  if (phase === 'RESPONSE_RECORDED') {
    await store.recordOutboxPhase(id, 'REQUEST_STARTED');
    await store.recordOutboxPhase(id, 'RESPONSE_RECORDED', { responseHash: `sha256:${'b'.repeat(64)}` });
  }
};

describe('AS1 same-thread status ordering guard (R2 recovery design §5.6)', () => {
  it('refuses any later status unless ACCEPTED is durably RESPONSE_RECORDED — no post', async () => {
    const { web, outbox } = await makeOutbox(); // no ACCEPTED record
    const result = await outbox.sendStatus(INTAKE, 'DELIVERY_CONFIRMED');
    expect(result.outcome).toBe('REJECTED_CONTROL');
    expect(result.reason).toContain('ACCEPTED_NOT_TERMINAL');
    expect(web.posted).toHaveLength(0);
  });

  it('DELIVERY_CONFIRMED refuses to begin while ANY failure sibling exists (both must be wholly absent)', async () => {
    for (const failure of ['DELIVERY_FAILED', 'PROCESSING_FAILED'] as const) {
      const { store, web, outbox } = await makeOutbox();
      await seedStatus(store, 'ACCEPTED', 'RESPONSE_RECORDED');
      await seedStatus(store, failure, 'PREPARED');
      const result = await outbox.sendStatus(INTAKE, 'DELIVERY_CONFIRMED');
      expect(result.outcome).toBe('REJECTED_CONTROL');
      expect(result.reason).toContain('FAILURE_BARRIER');
      expect(web.posted).toHaveLength(0);
    }
  });

  it('DELIVERY_FAILED refuses behind CONFIRMED/PROCESSING_FAILED; PROCESSING_FAILED refuses behind DELIVERY_FAILED but MAY follow CONFIRMED', async () => {
    const dfBehindPf = await makeOutbox();
    await seedStatus(dfBehindPf.store, 'ACCEPTED', 'RESPONSE_RECORDED');
    await seedStatus(dfBehindPf.store, 'PROCESSING_FAILED', 'PREPARED');
    expect((await dfBehindPf.outbox.sendStatus(INTAKE, 'DELIVERY_FAILED')).outcome).toBe('REJECTED_CONTROL');
    expect(dfBehindPf.web.posted).toHaveLength(0);

    const pfBehindDf = await makeOutbox();
    await seedStatus(pfBehindDf.store, 'ACCEPTED', 'RESPONSE_RECORDED');
    await seedStatus(pfBehindDf.store, 'DELIVERY_FAILED', 'PREPARED');
    expect((await pfBehindDf.outbox.sendStatus(INTAKE, 'PROCESSING_FAILED')).outcome).toBe('REJECTED_CONTROL');
    expect(pfBehindDf.web.posted).toHaveLength(0);

    const pfAfterConfirmed = await makeOutbox();
    await seedStatus(pfAfterConfirmed.store, 'ACCEPTED', 'RESPONSE_RECORDED');
    await seedStatus(pfAfterConfirmed.store, 'DELIVERY_CONFIRMED', 'RESPONSE_RECORDED');
    expect((await pfAfterConfirmed.outbox.sendStatus(INTAKE, 'PROCESSING_FAILED')).outcome).toBe('DELIVERED'); // rule 5
  });

  it('a failure-status conflict (both failure records) refuses EVERY status', async () => {
    const { store, web, outbox } = await makeOutbox();
    await seedStatus(store, 'ACCEPTED', 'RESPONSE_RECORDED');
    await seedStatus(store, 'DELIVERY_FAILED', 'PREPARED');
    await seedStatus(store, 'PROCESSING_FAILED', 'PREPARED');
    expect((await outbox.sendStatus(INTAKE, 'DELIVERY_CONFIRMED')).reason).toContain('CONFLICT');
    expect(web.posted).toHaveLength(0);
  });

  it('does NOT block a failure status behind its OWN record (only a sibling status is a barrier)', async () => {
    const { store, outbox } = await makeOutbox();
    await seedStatus(store, 'ACCEPTED', 'RESPONSE_RECORDED');
    await seedStatus(store, 'DELIVERY_FAILED', 'PREPARED'); // its OWN PREPARED — the ordering guard must NOT refuse it
    const result = await outbox.sendStatus(INTAKE, 'DELIVERY_FAILED');
    // The ordering guard permits the same-failure recovery path; only the separate PREPARED byte-immutability check
    // (a re-observed PREPARED must re-derive identical bytes) governs whether it DELIVERS or reconciles — never an
    // ordering refusal. A DIFFERENT sibling status here WOULD be an ordering barrier (proven above).
    expect(result.reason).not.toContain('status-ordering');
  });

  it('recovers its OWN byte-identical PREPARED failure status to DELIVERED across owners with exactly one post', async () => {
    const owner = await makeOutbox({ assertSendable: makeThirdCallFails() });
    await seedStatus(owner.store, 'ACCEPTED', 'RESPONSE_RECORDED');
    // First owner writes the REAL DELIVERY_FAILED PREPARED artifact, then the pre-REQUEST_STARTED gate refuses.
    const first = await owner.outbox.sendStatus(INTAKE, 'DELIVERY_FAILED');
    expect(first.outcome).toBe('REJECTED_CONTROL');
    expect(await owner.store.readOutboxPhase(userStatusOutboundId('AGENT_OFFICE_ADVISOR', INTAKE, 'DELIVERY_FAILED'))).toBe('PREPARED');
    // A second owner on the SAME store re-derives the identical request bytes and delivers once (no ordering block).
    const recover = new As1Outbox({
      profile: selectProfile('AGENT_OFFICE_ADVISOR'),
      secret: { workspaceId: 'TWORKSPACE001', appId: 'AAGENTOFFICE01', channelId: 'CAGENTOFFICE01', botToken: 'xoxb-agentoffice-placeholder-0001' },
      store: owner.store,
      web: owner.web,
      latch: () => Promise.resolve(),
      assertSendable: () => Promise.resolve(),
      delay: () => Promise.resolve(),
    });
    const result = await recover.sendStatus(INTAKE, 'DELIVERY_FAILED');
    expect(result.outcome).toBe('DELIVERED');
    expect(owner.web.posted).toHaveLength(1);
  });

  it('rechecks ordering BEFORE the response write: a sibling DELIVERY_FAILED appearing mid-send aborts DELIVERY_CONFIRMED with its state preserved', async () => {
    const { store, web, outbox } = await makeOutbox();
    await seedStatus(store, 'ACCEPTED', 'RESPONSE_RECORDED');
    // The Web post writes a DELIVERY_FAILED sibling BEFORE returning success, so the pre-response-write recheck aborts.
    const originalPost = web.postMessage.bind(web);
    web.postMessage = async (token, request) => {
      await seedStatus(store, 'DELIVERY_FAILED', 'PREPARED');
      return originalPost(token, request);
    };
    const result = await outbox.sendStatus(INTAKE, 'DELIVERY_CONFIRMED');
    expect(result.outcome).toBe('REJECTED_CONTROL'); // aborted mid-send by the status-ordering recheck
    expect(result.phase).toBe('REQUEST_STARTED'); // exact outbox state preserved (no RESPONSE_RECORDED)
    expect(await store.readOutboxPhase(userStatusOutboundId('AGENT_OFFICE_ADVISOR', INTAKE, 'DELIVERY_CONFIRMED'))).toBe('REQUEST_STARTED');
  });

  it('permits idempotent ACCEPTED terminal replay after a successful DELIVERY_CONFIRMED (no duplicate post, no false halt)', async () => {
    // handoff 95 F01 (correction 4): a normal restart replays ACCEPTED while ACCEPTED@RESPONSE_RECORDED +
    // DELIVERY_CONFIRMED@RESPONSE_RECORDED with BOTH failure siblings absent. §5.6 rule 6 / §5.7 make only a FAILURE
    // record a barrier — a successful DELIVERY_CONFIRMED must NOT block ACCEPTED's own idempotent terminal replay, which
    // the resume rediscovers with NO second post. Adversarial vs the prior guard, which rejected ACCEPTED as
    // LATER_STATUS_PRESENT here and (in composition recovery) falsely halted the mission.
    const { store, web, outbox } = await makeOutbox();
    await seedStatus(store, 'ACCEPTED', 'RESPONSE_RECORDED');
    await seedStatus(store, 'DELIVERY_CONFIRMED', 'RESPONSE_RECORDED');
    const result = await outbox.sendStatus(INTAKE, 'ACCEPTED');
    expect(result.outcome).toBe('DELIVERED'); // idempotent terminal replay — no false ordering refusal
    expect(result.phase).toBe('RESPONSE_RECORDED');
    expect(web.posted).toHaveLength(0); // NO duplicate ACCEPTED post
  });

  it('still refuses ACCEPTED behind a FAILURE barrier and a DELIVERY_CONFIRMED without a terminal ACCEPTED (no over-open)', async () => {
    // correction 4 must not over-open ACCEPTED: a real failure sibling is still a barrier, and a DELIVERY_CONFIRMED with a
    // nonterminal/absent ACCEPTED is a corrupt ordering (§5.6 rule 2). Neither posts.
    const behindFailure = await makeOutbox();
    await seedStatus(behindFailure.store, 'ACCEPTED', 'RESPONSE_RECORDED');
    await seedStatus(behindFailure.store, 'DELIVERY_FAILED', 'PREPARED'); // a FAILURE barrier
    const failed = await behindFailure.outbox.sendStatus(INTAKE, 'ACCEPTED');
    expect(failed.outcome).toBe('REJECTED_CONTROL');
    expect(failed.reason).toContain('FAILURE_BARRIER');
    expect(behindFailure.web.posted).toHaveLength(0);

    const corrupt = await makeOutbox();
    await seedStatus(corrupt.store, 'ACCEPTED', 'PREPARED'); // nonterminal ACCEPTED...
    await seedStatus(corrupt.store, 'DELIVERY_CONFIRMED', 'RESPONSE_RECORDED'); // ...beneath a later status
    const rejected = await corrupt.outbox.sendStatus(INTAKE, 'ACCEPTED');
    expect(rejected.outcome).toBe('REJECTED_CONTROL');
    expect(rejected.reason).toContain('LATER_STATUS_PRESENT');
    expect(corrupt.web.posted).toHaveLength(0);
  });

  it('a terminal OWN record does NOT return DELIVERED once a failure sibling appears later (guard runs before the resume return)', async () => {
    // handoff 95 F01 (correction 2, defect 1): the status-ordering guard runs at TRUE sendStatus entry — BEFORE the
    // RESPONSE_RECORDED resume return. So DELIVERY_CONFIRMED@RESPONSE_RECORDED does NOT blindly return DELIVERED once a
    // DELIVERY_FAILED sibling appears later; it is REJECTED_CONTROL, its durable state preserved, with no continuation.
    // Adversarial vs running the resume return before the guard, which returned DELIVERED behind the barrier.
    const { store, web, outbox } = await makeOutbox();
    await seedStatus(store, 'ACCEPTED', 'RESPONSE_RECORDED');
    await seedStatus(store, 'DELIVERY_CONFIRMED', 'RESPONSE_RECORDED'); // its OWN terminal record
    await seedStatus(store, 'DELIVERY_FAILED', 'PREPARED'); // a failure sibling appears LATER
    const result = await outbox.sendStatus(INTAKE, 'DELIVERY_CONFIRMED');
    expect(result.outcome).toBe('REJECTED_CONTROL'); // NOT DELIVERED via a blind resume
    expect(result.reason).toContain('FAILURE_BARRIER');
    expect(web.posted).toHaveLength(0); // no continuation / no post
    // The exact durable state is preserved (still its terminal RESPONSE_RECORDED — no phantom transition).
    expect(await store.readOutboxPhase(userStatusOutboundId('AGENT_OFFICE_ADVISOR', INTAKE, 'DELIVERY_CONFIRMED'))).toBe('RESPONSE_RECORDED');
  });

});
