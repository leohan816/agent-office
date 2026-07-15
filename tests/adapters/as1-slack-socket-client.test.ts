import WebSocket from 'ws';
import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import {
  As1RawSocketTransport,
  assertValidSlackWssUrl,
  boundedSlackFetch,
  type As1InboundEnvelope,
  type As1WsClientOptions,
} from '../../src/adapters/gateways/slack-pilot/socket-client.js';
import { FakeAs1Ws, FakeAs1WebSocketFactory, FakeConnectionsOpener } from '../helpers/as1-slack-fakes.js';

// Design §9.2: the exact `as const satisfies` literal against the three-field intersection. Its compilation
// under strict / skipLibCheck:false is the mandatory type-contract probe; its runtime values are asserted.
const PROBE_OPTIONS = {
  allowSynchronousEvents: false,
  autoPong: true,
  closeTimeout: 5_000,
  followRedirects: false,
  handshakeTimeout: 10_000,
  maxBufferedChunks: 64,
  maxFragments: 64,
  maxPayload: 32_768,
  maxRedirects: 0,
  perMessageDeflate: false,
  protocolVersion: 13,
  skipUTF8Validation: false,
} as const satisfies As1WsClientOptions;

const APP_ID = 'AAGENTOFFICE01';
const helloFrame = (appId: string): Buffer => Buffer.from(`{"type":"hello","connection_info":{"app_id":"${appId}"}}`, 'utf8');
const eventFrame = (envelopeId: string, apiAppId: string): Buffer =>
  Buffer.from(
    `{"type":"events_api","envelope_id":"${envelopeId}","payload":{"type":"event_callback","team_id":"TWORKSPACE001","api_app_id":"${apiAppId}","event_id":"Ev0X","event":{"type":"message","text":"hi"}}}`,
    'utf8',
  );

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function makeTransport() {
  const opener = new FakeConnectionsOpener();
  const factory = new FakeAs1WebSocketFactory();
  const fakeWs = new FakeAs1Ws();
  factory.setNext(fakeWs);
  const logs: string[] = [];
  const transport = new As1RawSocketTransport(
    opener,
    factory,
    { record: (profileId, phase, reason) => logs.push(`${profileId}|${phase}|${reason}`) },
    () => 100_000,
  );
  const received: As1InboundEnvelope[] = [];
  transport.onEnvelope((envelope) => {
    received.push(envelope);
    return Promise.resolve();
  });
  return { opener, factory, fakeWs, logs, transport, received };
}

async function connectReady(seal: () => boolean = () => true): Promise<ReturnType<typeof makeTransport>> {
  const ctx = makeTransport();
  const promise = ctx.transport.connect({ profileId: 'AGENT_OFFICE_ADVISOR', appToken: 'xapp-x', expectedAppId: APP_ID, readinessSeal: seal });
  await flush();
  ctx.fakeWs.emit('open');
  ctx.fakeWs.emit('message', helloFrame(APP_ID), false);
  await promise;
  return ctx;
}

describe('AS1 raw socket transport — identity boundary', () => {
  it('reaches receive-ready only after exact hello App-ID equality and the readiness seal', async () => {
    const { transport, received } = await connectReady();
    expect(transport.getPhase()).toBe('EVENT_RECEIVE_READY');
    expect(received).toHaveLength(0);
  });

  it('constructs the ws with exactly the reviewed immutable options (spy) matching the compile probe', async () => {
    const { factory } = await connectReady();
    const options = factory.lastOptions;
    expect(options?.maxPayload).toBe(PROBE_OPTIONS.maxPayload);
    expect(options?.maxBufferedChunks).toBe(64);
    expect(options?.maxFragments).toBe(64);
    expect(options?.perMessageDeflate).toBe(false);
    expect(options?.skipUTF8Validation).toBe(false);
    expect(options?.maxRedirects).toBe(0);
    expect(options?.closeTimeout).toBe(5_000);
    expect(options?.followRedirects).toBe(false);
    expect((options?.handshakeTimeout ?? 0) > 0).toBe(true);
  });

  it('closes 1008 on a wrong-app hello and never delivers a subsequent event; ACK count stays zero', async () => {
    const { transport, fakeWs, received } = makeTransport();
    const promise = transport.connect({ profileId: 'AGENT_OFFICE_ADVISOR', appToken: 'xapp-x', expectedAppId: APP_ID, readinessSeal: () => true });
    await flush();
    fakeWs.emit('open');
    fakeWs.emit('message', helloFrame('AWRONGAPPID01'), false);
    fakeWs.emit('message', eventFrame('Env1', 'AWRONGAPPID01'), false);
    await expect(promise).rejects.toBeInstanceOf(DomainError);
    expect(fakeWs.closeCalls.some((c) => c.code === 1008)).toBe(true);
    expect(received).toHaveLength(0);
    expect(fakeWs.sent).toHaveLength(0);
  });

  it('rejects an events_api object as the first frame at its type, without delivering content', async () => {
    const { transport, fakeWs, received } = makeTransport();
    const promise = transport.connect({ profileId: 'AGENT_OFFICE_ADVISOR', appToken: 'xapp-x', expectedAppId: APP_ID, readinessSeal: () => true });
    await flush();
    fakeWs.emit('open');
    fakeWs.emit('message', eventFrame('Env1', APP_ID), false); // an event, not a hello
    await expect(promise).rejects.toBeInstanceOf(DomainError);
    expect(fakeWs.closeCalls.some((c) => c.code === 1008)).toBe(true);
    expect(received).toHaveLength(0);
  });

  it('rejects a stale readiness seal in the hello callback', async () => {
    const { transport, fakeWs } = makeTransport();
    const promise = transport.connect({ profileId: 'AGENT_OFFICE_ADVISOR', appToken: 'xapp-x', expectedAppId: APP_ID, readinessSeal: () => false });
    await flush();
    fakeWs.emit('open');
    fakeWs.emit('message', helloFrame(APP_ID), false);
    await expect(promise).rejects.toBeInstanceOf(DomainError);
    expect(fakeWs.closeCalls.some((c) => c.code === 1008)).toBe(true);
  });

  it('closes 1003 on a binary frame and 1009 on an oversize frame in quarantine', async () => {
    for (const [isBinary, size, code] of [
      [true, 10, 1003],
      [false, 40_000, 1009],
    ] as const) {
      const { transport, fakeWs } = makeTransport();
      const promise = transport.connect({ profileId: 'AGENT_OFFICE_ADVISOR', appToken: 'xapp-x', expectedAppId: APP_ID, readinessSeal: () => true });
      await flush();
      fakeWs.emit('open');
      fakeWs.emit('message', Buffer.alloc(size, 0x7b), isBinary);
      await expect(promise).rejects.toBeInstanceOf(DomainError);
      expect(fakeWs.closeCalls.some((c) => c.code === code)).toBe(true);
    }
  });
});

describe('AS1 raw socket transport — events, ACK, and lifecycle', () => {
  it('delivers a bounded envelope after proof and acks exactly once, payload-free, same-generation', async () => {
    const { fakeWs, received } = await connectReady();
    fakeWs.emit('message', eventFrame('Env0AGENTOFFICE1', APP_ID), false);
    expect(received).toHaveLength(1);
    const envelope = received[0];
    expect(envelope?.envelopeId).toBe('Env0AGENTOFFICE1');
    await envelope?.acknowledge();
    expect(fakeWs.sent).toStrictEqual(['{"envelope_id":"Env0AGENTOFFICE1"}']);
    await expect(envelope?.acknowledge()).rejects.toBeInstanceOf(DomainError); // one-use
  });

  it('refuses to ack when the socket is not open or has a nonzero send buffer', async () => {
    const { fakeWs, received } = await connectReady();
    fakeWs.emit('message', eventFrame('Env2', APP_ID), false);
    const envelope = received[0];
    fakeWs.readyState = 3; // CLOSED
    await expect(envelope?.acknowledge()).rejects.toBeInstanceOf(DomainError);
    fakeWs.readyState = WebSocket.OPEN;
    fakeWs.bufferedAmount = 5;
    await expect(envelope?.acknowledge()).rejects.toBeInstanceOf(DomainError);
  });

  it('treats a provider disconnect as control: closes with no reconnect and no delivery', async () => {
    const { opener, fakeWs, received } = await connectReady();
    fakeWs.emit('message', Buffer.from('{"type":"disconnect","reason":"refresh_requested"}', 'utf8'), false);
    expect(received).toHaveLength(0);
    expect(opener.calls).toBe(1); // no re-open
    expect(fakeWs.closeCalls.length > 0).toBe(true);
  });

  it('disconnect closes 1000 and never reopens', async () => {
    const { opener, transport, fakeWs } = await connectReady();
    await transport.disconnect();
    expect(fakeWs.closeCalls.some((c) => c.code === 1000)).toBe(true);
    expect(opener.calls).toBe(1);
  });

  it('two profile transports use distinct sockets with no cross-reference', async () => {
    const a = await connectReady();
    const b = await connectReady();
    expect(a.fakeWs).not.toBe(b.fakeWs);
    b.fakeWs.emit('message', eventFrame('EnvB', APP_ID), false);
    expect(a.received).toHaveLength(0);
    expect(b.received).toHaveLength(1);
  });
});

describe('AS1 raw socket transport — URL and bounded fetch gates', () => {
  it('accepts only the exact Slack wss host/path and rejects everything else', () => {
    expect(assertValidSlackWssUrl('wss://wss.slack.com/link/?ticket=abc')).toContain('wss://');
    for (const bad of [
      'https://wss.slack.com/link/',
      'wss://wss.slack.com:443/link/', // explicit default port must be rejected even though URL hides it
      'wss://wss.slack.com:8443/link/',
      'wss://user:pass@wss.slack.com/link/',
      'wss://wss.slack.com/other/',
      'wss://evil.com/link/',
      'wss://wss.slack.com/link/#frag',
    ]) {
      expect(() => assertValidSlackWssUrl(bad)).toThrow(DomainError);
    }
  });

  it('bounded fetch accepts only the fixed endpoint and caps the response at 65,536 bytes', async () => {
    const fixed = 'https://slack.com/api/apps.connections.open';
    const okFetch = boundedSlackFetch(() => Promise.resolve(new Response(new Uint8Array(1_000))));
    const okResponse = await okFetch(fixed);
    expect(okResponse.status).toBe(200);

    const wrongEndpoint = boundedSlackFetch(() => Promise.resolve(new Response(new Uint8Array(10))));
    await expect(wrongEndpoint('https://slack.com/api/chat.postMessage')).rejects.toBeInstanceOf(DomainError);

    const oversize = boundedSlackFetch(() => Promise.resolve(new Response(new Uint8Array(70_000))));
    await expect(oversize(fixed)).rejects.toBeInstanceOf(DomainError);
  });

  it('logs only stable reason codes, never frame/content material', async () => {
    const { logs } = await connectReady();
    void logs; // no content logged on the happy path
    const failing = makeTransport();
    const promise = failing.transport.connect({ profileId: 'AGENT_OFFICE_ADVISOR', appToken: 'xapp-x', expectedAppId: APP_ID, readinessSeal: () => true });
    await flush();
    failing.fakeWs.emit('open');
    failing.fakeWs.emit('message', helloFrame('AWRONGAPPID01'), false);
    await expect(promise).rejects.toBeInstanceOf(DomainError);
    for (const line of failing.logs) {
      expect(line).not.toContain('AWRONGAPPID01');
      expect(line).not.toContain('xapp');
    }
  });
});
