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
      const { web, outbox } = await makeOutbox();
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
