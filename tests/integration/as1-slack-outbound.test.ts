import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { As1ProfileInboundStore } from '../../src/application/slack-pilot/inbound-store.js';
import { selectProfile } from '../../src/application/slack-pilot/profiles.js';
import {
  As1Outbox,
  As1OutboundError,
  renderOutbound,
  type As1OutboundRecord,
} from '../../src/application/slack-pilot/outbox.js';
import { FakeClock, FakeWebPort } from '../helpers/as1-slack-fakes.js';
import { makeStateRoot } from '../helpers/fixtures.js';

const ACK_RECORD: As1OutboundRecord = { kind: 'ACK', intakeId: 'as1-intake-0001', advisorAckId: 'ack-0001', summary: 'received your mission' };

/** Construct a profile-bound outbox with mandatory internal deps; the accepted root is seeded in the store. */
async function makeOutbox(opts: { assertSendable?: () => Promise<void> } = {}) {
  const root = await makeStateRoot();
  const store = await As1ProfileInboundStore.open(root, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock('2026-07-14T22:06:00.000Z'));
  await store.recordRootCorrelation({
    rootTs: '1720000000.000100',
    rootKeyHash: `sha256:${'a'.repeat(64)}`,
    sourceEventId: 'Ev0AGENTOFFICE01',
    receiveGrantId: 'as1-receive-grant-0001',
    bindingStateHash: `sha256:${'2'.repeat(64)}`,
    intakeId: 'as1-intake-0001',
  });
  const web = new FakeWebPort();
  const latched: string[] = [];
  const outbox = new As1Outbox({
    profile: selectProfile('AGENT_OFFICE_ADVISOR'),
    secret: { channelId: 'CAGENTOFFICE01', botToken: 'xoxb-agentoffice-placeholder-0001' },
    store,
    web,
    latch: (reason: string) => {
      latched.push(reason);
      return Promise.resolve();
    },
    assertSendable: opts.assertSendable ?? ((): Promise<void> => Promise.resolve()),
    delay: () => Promise.resolve(),
  });
  const send = (record: As1OutboundRecord, outboundId = 'outbound-0001'): ReturnType<typeof outbox.send> =>
    outbox.send({ outboundId, record });
  return { store, web, outbox, send, latched };
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
    expect(grabDomainError(() => renderOutbound({ ...ACK_RECORD, summary: 'here is xoxb-leaked-token' })).code).toBe(
      'INVALID_SCHEMA',
    );
  });

  it('rejects a Slack mention control form', () => {
    expect(grabDomainError(() => renderOutbound({ ...ACK_RECORD, summary: '<@U0BD3523C1F> ping' })).code).toBe(
      'INVALID_SCHEMA',
    );
  });
});

describe('AS1 outbound transport', () => {
  it('sends the exact same-thread request from the bound secret + resolved root, and records RESPONSE_RECORDED', async () => {
    const { store, web, send } = await makeOutbox();
    const result = await send(ACK_RECORD);
    expect(result.outcome).toBe('DELIVERED');
    expect(result.attempts).toBe(1);
    expect(web.posted).toHaveLength(1);
    expect(web.posted[0]?.request).toStrictEqual({ channel: 'CAGENTOFFICE01', threadTs: '1720000000.000100', text: 'ACK: received your mission' });
    expect(await store.readOutboxPhase('outbound-0001')).toBe('RESPONSE_RECORDED');
  });

  it('persists the immutable request and response artifact hashes', async () => {
    const { store, send } = await makeOutbox();
    await send(ACK_RECORD);
    const record = await store.readOutboxRecord('outbound-0001');
    expect(record?.phase).toBe('RESPONSE_RECORDED');
    expect(record?.requestHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(record?.responseHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  it('refuses the send cleanly when the control gate is not sendable (no write, no network)', async () => {
    const { store, web, send } = await makeOutbox({
      assertSendable: () => Promise.reject(new DomainError('FORBIDDEN_TARGET', 'profile latched')),
    });
    const result = await send(ACK_RECORD);
    expect(result.outcome).toBe('REJECTED_CONTROL');
    expect(web.posted).toHaveLength(0);
    expect(await store.readOutboxPhase('outbound-0001')).toBeNull();
  });

  it('rejects a record whose intake has no accepted root, without touching the network', async () => {
    const { web, send } = await makeOutbox();
    const result = await send({ ...ACK_RECORD, intakeId: 'as1-intake-9999' });
    expect(result.outcome).toBe('REJECTED_ROOT');
    expect(web.posted).toHaveLength(0);
  });

  it('retries once after a proven connection-before-send failure', async () => {
    const { web, send } = await makeOutbox();
    web.setPostScript([new As1OutboundError('CONNECTION_BEFORE_SEND', 'dns failed'), 'ok']);
    const result = await send(ACK_RECORD);
    expect(result.outcome).toBe('DELIVERED');
    expect(result.attempts).toBe(2);
  });

  it('retries once after an explicit rate-limit response', async () => {
    const { web, send } = await makeOutbox();
    web.setPostScript([new As1OutboundError('RATE_LIMITED', 'slow down', 1_000), 'ok']);
    const result = await send(ACK_RECORD);
    expect(result.outcome).toBe('DELIVERED');
    expect(result.attempts).toBe(2);
  });

  it('never blind-resends after an ambiguous failure and durably latches', async () => {
    const { store, web, send, latched } = await makeOutbox();
    web.setPostScript([new As1OutboundError('AMBIGUOUS', 'timeout after request write')]);
    const result = await send(ACK_RECORD);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(web.posted).toHaveLength(1);
    expect(latched.length).toBeGreaterThan(0);
    expect(await store.readOutboxPhase('outbound-0001')).toBe('MANUAL_RECONCILIATION_REQUIRED');
  });

  it('resumes an interrupted REQUEST_STARTED as manual reconciliation without a network resend', async () => {
    const { store, web, send, latched } = await makeOutbox();
    await store.recordOutboxPhase('outbound-0001', 'REQUEST_STARTED'); // durable in-flight from a prior crash
    const result = await send(ACK_RECORD);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(web.posted).toHaveLength(0); // never re-sent
    expect(latched.length).toBeGreaterThan(0);
  });

  it('resumes a delivered phase without a network resend', async () => {
    const { store, web, send } = await makeOutbox();
    await store.recordOutboxPhase('outbound-0001', 'RESPONSE_RECORDED');
    const result = await send(ACK_RECORD);
    expect(result.outcome).toBe('DELIVERED');
    expect(web.posted).toHaveLength(0);
  });

  it('treats a success with a non-Slack timestamp grammar as ambiguous', async () => {
    const { web, send, latched } = await makeOutbox();
    web.setPostResult({ ok: true, channel: 'CAGENTOFFICE01', ts: 'not-a-timestamp' });
    const result = await send(ACK_RECORD);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(latched.length).toBeGreaterThan(0);
  });

  it('treats a malformed success as ambiguous', async () => {
    const { web, send } = await makeOutbox();
    web.setPostScript(['malformed']);
    const result = await send(ACK_RECORD);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(web.posted).toHaveLength(1);
  });

  it('reconciles after three exhausted rate limits without a fourth attempt', async () => {
    const { web, send } = await makeOutbox();
    web.setPostScript([
      new As1OutboundError('RATE_LIMITED', 'x', 100),
      new As1OutboundError('RATE_LIMITED', 'x', 100),
      new As1OutboundError('RATE_LIMITED', 'x', 100),
    ]);
    const result = await send(ACK_RECORD);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(result.attempts).toBe(3);
    expect(web.posted).toHaveLength(3);
  });
});
