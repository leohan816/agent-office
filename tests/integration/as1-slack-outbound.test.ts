import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { As1ProfileInboundStore } from '../../src/application/slack-pilot/inbound-store.js';
import { selectProfile } from '../../src/application/slack-pilot/profiles.js';
import {
  As1Outbox,
  As1OutboundError,
  renderOutbound,
  type As1OutboundRecord,
  type As1OutboundTarget,
  type As1SendRequest,
} from '../../src/application/slack-pilot/outbox.js';
import { FakeClock, FakeWebPort } from '../helpers/as1-slack-fakes.js';
import { makeStateRoot } from '../helpers/fixtures.js';

const TARGET: As1OutboundTarget = {
  channel: 'CAGENTOFFICE01',
  threadTs: '1720000000.000100',
  botToken: 'xoxb-agentoffice-placeholder-0001',
};

const ACK_RECORD: As1OutboundRecord = { kind: 'ACK', intakeId: 'as1-intake-0001', advisorAckId: 'ack-0001', summary: 'received your mission' };

async function makeOutbox() {
  const root = await makeStateRoot();
  const store = await As1ProfileInboundStore.open(root, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock('2026-07-14T22:06:00.000Z'));
  const web = new FakeWebPort();
  const outbox = new As1Outbox();
  const base = (record: As1OutboundRecord): As1SendRequest => ({
    outboundId: 'outbound-0001',
    record,
    target: TARGET,
    web,
    journal: store,
    delay: () => Promise.resolve(),
  });
  return { store, web, outbox, base };
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
    expect(renderOutbound({ kind: 'RESULT', intakeId: 'i', resultId: 'r', terminalStatus: 'COMPLETED', summary: 'done' })).toBe(
      'RESULT [COMPLETED]: done',
    );
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
  it('sends the exact same-thread request and records RESPONSE_RECORDED', async () => {
    const { store, web, outbox, base } = await makeOutbox();
    const result = await outbox.send(base(ACK_RECORD));
    expect(result.outcome).toBe('DELIVERED');
    expect(result.attempts).toBe(1);
    expect(web.posted).toHaveLength(1);
    expect(web.posted[0]?.request).toStrictEqual({ channel: 'CAGENTOFFICE01', threadTs: '1720000000.000100', text: 'ACK: received your mission' });
    expect(await store.readOutboxPhase('outbound-0001')).toBe('RESPONSE_RECORDED');
  });

  it('retries once after a proven connection-before-send failure', async () => {
    const { web, outbox, base } = await makeOutbox();
    web.setPostScript([new As1OutboundError('CONNECTION_BEFORE_SEND', 'dns failed'), 'ok']);
    const result = await outbox.send(base(ACK_RECORD));
    expect(result.outcome).toBe('DELIVERED');
    expect(result.attempts).toBe(2);
  });

  it('retries once after an explicit rate-limit response', async () => {
    const { web, outbox, base } = await makeOutbox();
    web.setPostScript([new As1OutboundError('RATE_LIMITED', 'slow down', 1_000), 'ok']);
    const result = await outbox.send(base(ACK_RECORD));
    expect(result.outcome).toBe('DELIVERED');
    expect(result.attempts).toBe(2);
  });

  it('never blind-resends after an ambiguous failure', async () => {
    const { store, web, outbox, base } = await makeOutbox();
    web.setPostScript([new As1OutboundError('AMBIGUOUS', 'timeout after request write')]);
    const result = await outbox.send(base(ACK_RECORD));
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(web.posted).toHaveLength(1);
    expect(await store.readOutboxPhase('outbound-0001')).toBe('MANUAL_RECONCILIATION_REQUIRED');
  });

  it('treats a malformed success as ambiguous', async () => {
    const { web, outbox, base } = await makeOutbox();
    web.setPostScript(['malformed']);
    const result = await outbox.send(base(ACK_RECORD));
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(web.posted).toHaveLength(1);
  });

  it('reconciles after three exhausted rate limits without a fourth attempt', async () => {
    const { web, outbox, base } = await makeOutbox();
    web.setPostScript([
      new As1OutboundError('RATE_LIMITED', 'x', 100),
      new As1OutboundError('RATE_LIMITED', 'x', 100),
      new As1OutboundError('RATE_LIMITED', 'x', 100),
    ]);
    const result = await outbox.send(base(ACK_RECORD));
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(result.attempts).toBe(3);
    expect(web.posted).toHaveLength(3);
  });
});
