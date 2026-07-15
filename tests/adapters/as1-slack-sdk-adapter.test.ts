import { WebAPIHTTPError, WebAPIRateLimitedError, WebAPIRequestError } from '@slack/web-api';
import { describe, expect, it } from 'vitest';

import {
  As1OutboundError,
  classifyOutboundError,
} from '../../src/adapters/gateways/slack-pilot/web-client.js';
import { As1Outbox } from '../../src/application/slack-pilot/outbox.js';
import { As1ProfileInboundStore, rootKeyHash } from '../../src/application/slack-pilot/inbound-store.js';
import { selectProfile } from '../../src/application/slack-pilot/profiles.js';
import { FakeClock, FakeWebPort, sealAcceptedOutboundVia } from '../helpers/as1-slack-fakes.js';
import { makeStateRoot } from '../helpers/fixtures.js';

// Real @slack/web-api error classes drive these tests — the classification must fail closed on the exact
// provider types the installed SDK throws (design §14; review B07 safety correction).
describe('AS1 SDK outbound error classification (B07)', () => {
  it('maps an explicit WebAPIRateLimitedError to RATE_LIMITED with a bounded retry-after', () => {
    const classified = classifyOutboundError(new WebAPIRateLimitedError(30));
    expect(classified.outboundClass).toBe('RATE_LIMITED');
    expect(classified.retryAfterMs).toBe(30_000);
  });

  it('maps a WebAPIRequestError to AMBIGUOUS — the SDK wraps timeout/reset (possibly-sent) failures in it', () => {
    const classified = classifyOutboundError(new WebAPIRequestError(new Error('socket hang up')));
    expect(classified.outboundClass).toBe('AMBIGUOUS');
    // The adapter must NOT manufacture a definitely-unsent signal from a WebAPIRequestError.
    expect(classified.outboundClass).not.toBe('CONNECTION_BEFORE_SEND');
  });

  it('maps an HTTP error, a platform-style throw, and an unknown throw to AMBIGUOUS', () => {
    expect(classifyOutboundError(new WebAPIHTTPError(503, 'Service Unavailable', {})).outboundClass).toBe('AMBIGUOUS');
    expect(classifyOutboundError(new Error('boom')).outboundClass).toBe('AMBIGUOUS');
    expect(classifyOutboundError('not even an error').outboundClass).toBe('AMBIGUOUS');
  });

  it('passes an already-classified As1OutboundError through unchanged', () => {
    const original = new As1OutboundError('RATE_LIMITED', 'x', 1_000);
    expect(classifyOutboundError(original)).toBe(original);
  });

  it('never retries after a WebAPIRequestError-derived AMBIGUOUS class: one attempt, manual reconciliation', async () => {
    const root = await makeStateRoot();
    const store = await As1ProfileInboundStore.open(root, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock('2026-07-14T22:06:00.000Z'));
    await store.recordRootCorrelation({
      rootTs: '1720000000.000100',
      rootKeyHash: rootKeyHash('AGENT_OFFICE_ADVISOR', 'TWORKSPACE001', 'AAGENTOFFICE01', 'CAGENTOFFICE01', '1720000000.000100'),
      sourceEventId: 'Ev0AGENTOFFICE01',
      receiveGrantId: 'as1-receive-grant-0001',
      bindingStateHash: `sha256:${'2'.repeat(64)}`,
      intakeId: 'as1-intake-0001',
    });
    const web = new FakeWebPort();
    // The branded accepted outbound comes only from a real successful ingestion.
    const accepted = await sealAcceptedOutboundVia(store, 'INTAKE');
    // The exact class the SDK would throw on a reset, run through the real classifier.
    web.setPostScript([classifyOutboundError(new WebAPIRequestError(new Error('ECONNRESET')))]);
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
      assertSendable: () => Promise.resolve(),
      delay: () => Promise.resolve(),
    });
    const result = await outbox.send(accepted);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(result.attempts).toBe(1);
    expect(web.posted).toHaveLength(1); // no second attempt after the ambiguous class
    expect(latched.length).toBeGreaterThan(0);
  });
});
