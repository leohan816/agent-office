import WebSocket from 'ws';
import { describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import {
  As1RawSocketTransport,
  as1WsClientOptions,
  assertValidSlackWssUrl,
  boundedSlackFetch,
  type As1InboundEnvelope,
} from '../../src/adapters/gateways/slack-pilot/socket-client.js';
import { FakeAs1Ws, FakeAs1WebSocketFactory, FakeConnectionsOpener } from '../helpers/as1-slack-fakes.js';

// Design §7.4/§9.2 — the mandatory `as const satisfies` type-contract probe now targets the ACTUAL production
// seam. The literal that `as1WsClientOptions()` builds — and that `NodeAs1WebSocketFactory` passes directly to
// `new WebSocket` — must be the exact `as const satisfies As1WsClientOptions` literal, not a contextually
// widened `satisfies`-only object. This module-scope assignment fails to typecheck if the production factory
// widens any fixed option, so it is a genuine regression against the prior `satisfies`-only helper (0e4274f).
// Runtime values of the same production literal are asserted below via the constructor spy.
const _as1WsProductionLiteralContract: {
  readonly allowSynchronousEvents: false;
  readonly autoPong: true;
  readonly closeTimeout: 5_000;
  readonly followRedirects: false;
  readonly maxBufferedChunks: 64;
  readonly maxFragments: 64;
  readonly maxPayload: 32_768;
  readonly maxRedirects: 0;
  readonly perMessageDeflate: false;
  readonly protocolVersion: 13;
  readonly skipUTF8Validation: false;
} = as1WsClientOptions(10_000);
void _as1WsProductionLiteralContract;

const APP_ID = 'AAGENTOFFICE01';
const helloFrame = (appId: string): Buffer => Buffer.from(`{"type":"hello","connection_info":{"app_id":"${appId}"}}`, 'utf8');
const eventFrame = (envelopeId: string, apiAppId: string): Buffer =>
  Buffer.from(
    `{"type":"events_api","envelope_id":"${envelopeId}","payload":{"type":"event_callback","team_id":"TWORKSPACE001","api_app_id":"${apiAppId}","event_id":"Ev0X","event":{"type":"message","text":"hi"}}}`,
    'utf8',
  );

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function makeTransport(control: () => Promise<boolean> = () => Promise.resolve(true)) {
  const opener = new FakeConnectionsOpener();
  const factory = new FakeAs1WebSocketFactory();
  const fakeWs = new FakeAs1Ws();
  factory.setNext(fakeWs);
  const logs: string[] = [];
  // The mandatory durable owning-profile latch (B05): every in-memory LATCHED transition persists here.
  const durableLatches: string[] = [];
  const transport = new As1RawSocketTransport(
    opener,
    factory,
    { record: (profileId, phase, reason) => logs.push(`${profileId}|${phase}|${reason}`) },
    () => 100_000,
    (reason) => {
      durableLatches.push(reason);
      return Promise.resolve();
    },
    control,
  );
  const received: As1InboundEnvelope[] = [];
  transport.onEnvelope((envelope) => {
    received.push(envelope);
    return Promise.resolve();
  });
  return { opener, factory, fakeWs, logs, transport, received, durableLatches };
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

  it('constructs the ws with exactly the reviewed immutable production options (as const satisfies seam)', async () => {
    const { factory } = await connectReady();
    // The exact literal the production factory (`as1WsClientOptions`) built and passed to the constructor.
    const options = factory.lastOptions;
    expect(options?.maxPayload).toBe(32_768);
    expect(options?.maxBufferedChunks).toBe(64);
    expect(options?.maxFragments).toBe(64);
    expect(options?.perMessageDeflate).toBe(false);
    expect(options?.skipUTF8Validation).toBe(false);
    expect(options?.maxRedirects).toBe(0);
    expect(options?.closeTimeout).toBe(5_000);
    expect(options?.followRedirects).toBe(false);
    expect(options?.allowSynchronousEvents).toBe(false);
    expect(options?.autoPong).toBe(true);
    expect(options?.protocolVersion).toBe(13);
    expect((options?.handshakeTimeout ?? 0) > 0).toBe(true);
    // The captured production options are the exact same reference shape produced by the factory function.
    expect(factory.lastOptions).toStrictEqual(as1WsClientOptions(options?.handshakeTimeout ?? 0));
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
    await flush(); // delivery dequeues after the owning-control DEQUEUE check (B05)
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
    await flush();
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
    await flush();
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

// C (review B08) — profile-local bounded FIFO admission: one handler in flight, 32-deep queue, fail-closed on
// overflow / handler failure, and a bounded drain + confirmed close (or forced termination) on disconnect.
describe('AS1 raw socket transport — bounded profile-local admission (B08)', () => {
  async function readyWith(onEnvelope: (env: As1InboundEnvelope) => Promise<void>) {
    const opener = new FakeConnectionsOpener();
    const factory = new FakeAs1WebSocketFactory();
    const fakeWs = new FakeAs1Ws();
    factory.setNext(fakeWs);
    const logs: string[] = [];
    const durableLatches: string[] = [];
    const transport = new As1RawSocketTransport(
      opener,
      factory,
      { record: (p, ph, r) => logs.push(`${p}|${ph}|${r}`) },
      () => 100_000,
      (reason) => {
        durableLatches.push(reason);
        return Promise.resolve();
      },
      () => Promise.resolve(true),
    );
    transport.onEnvelope(onEnvelope);
    const promise = transport.connect({ profileId: 'AGENT_OFFICE_ADVISOR', appToken: 'xapp-x', expectedAppId: APP_ID, readinessSeal: () => true });
    await flush();
    fakeWs.emit('open');
    fakeWs.emit('message', helloFrame(APP_ID), false);
    await promise;
    return { transport, fakeWs, logs, durableLatches };
  }

  it('processes envelopes FIFO with observed max concurrency of exactly one', async () => {
    const order: string[] = [];
    const gates: (() => void)[] = [];
    let live = 0;
    let maxLive = 0;
    const { fakeWs } = await readyWith((env) => {
      live += 1;
      maxLive = Math.max(maxLive, live);
      order.push(`start:${env.envelopeId}`);
      return new Promise<void>((resolve) => gates.push(() => { live -= 1; order.push(`end:${env.envelopeId}`); resolve(); }));
    });
    fakeWs.emit('message', eventFrame('Env1', APP_ID), false);
    fakeWs.emit('message', eventFrame('Env2', APP_ID), false);
    fakeWs.emit('message', eventFrame('Env3', APP_ID), false);
    await flush(); // the first task dequeues after the async owning-control check (B05)
    expect(order).toEqual(['start:Env1']); // only one started
    gates[0]?.(); await flush();
    gates[1]?.(); await flush();
    gates[2]?.(); await flush();
    expect(order).toEqual(['start:Env1', 'end:Env1', 'start:Env2', 'end:Env2', 'start:Env3', 'end:Env3']);
    expect(maxLive).toBe(1); // never more than one handler in flight
  });

  it('latches (1008) on inbound queue overflow at the 33rd queued callback', async () => {
    const { transport, fakeWs } = await readyWith(() => new Promise<void>(() => undefined)); // blocks in flight forever
    fakeWs.emit('message', eventFrame('Env1', APP_ID), false);
    await flush(); // Env1 dequeues into the single in-flight slot (after the async control check)
    for (let i = 2; i <= 33; i += 1) fakeWs.emit('message', eventFrame(`Env${String(i)}`, APP_ID), false); // 32 queued
    expect(transport.getPhase()).not.toBe('LATCHED');
    fakeWs.emit('message', eventFrame('Env34', APP_ID), false); // the 33rd queued callback → overflow
    expect(transport.getPhase()).toBe('LATCHED');
    expect(fakeWs.closeCalls.some((c) => c.code === 1008)).toBe(true);
  });

  it('fails closed (latch + drop queued) when a handler rejects', async () => {
    const started: string[] = [];
    const { transport, fakeWs } = await readyWith((env) => {
      started.push(env.envelopeId);
      return Promise.reject(new Error('handler blew up'));
    });
    fakeWs.emit('message', eventFrame('Env1', APP_ID), false);
    fakeWs.emit('message', eventFrame('Env2', APP_ID), false); // queued behind the failing one
    await flush();
    expect(transport.getPhase()).toBe('LATCHED');
    expect(started).toEqual(['Env1']); // the queued Env2 was dropped, never started
    // A frame after the latch is not admitted.
    fakeWs.emit('message', eventFrame('Env3', APP_ID), false);
    await flush();
    expect(started).toEqual(['Env1']);
  });

  it('disconnect stops admission, drops queued callbacks, and confirms the close (no replay after reconnect)', async () => {
    const started: string[] = [];
    const gates: (() => void)[] = [];
    const { transport, fakeWs } = await readyWith((env) => {
      started.push(env.envelopeId);
      return new Promise<void>((resolve) => gates.push(resolve));
    });
    fakeWs.emit('message', eventFrame('Env1', APP_ID), false); // in flight
    await flush(); // Env1 dequeues into the in-flight slot (after the async control check)
    fakeWs.emit('message', eventFrame('Env2', APP_ID), false); // queued
    gates[0]?.(); // let the in-flight finish so the drain completes fast
    await transport.disconnect();
    expect(transport.getPhase()).toBe('CLOSED');
    expect(started).toEqual(['Env1']); // Env2 dropped, never started
    // A frame after stop is never replayed/admitted.
    fakeWs.emit('message', eventFrame('Env3', APP_ID), false);
    await flush();
    expect(started).toEqual(['Env1']);
  });

  it('force-terminates and stays LATCHED when the in-flight handler misses the drain deadline', async () => {
    const { transport, fakeWs } = await readyWith(() => new Promise<void>(() => undefined)); // never finishes
    fakeWs.emit('message', eventFrame('Env1', APP_ID), false);
    await flush(); // Env1 dequeues into the in-flight slot (real timers) before switching to fake timers
    vi.useFakeTimers();
    try {
      const disc = transport.disconnect();
      await vi.advanceTimersByTimeAsync(15_000); // DRAIN_DEADLINE_MS
      await disc;
    } finally {
      vi.useRealTimers();
    }
    expect(fakeWs.terminateCalls).toBeGreaterThan(0);
    expect(transport.getPhase()).toBe('LATCHED');
  });

  it('force-terminates and stays LATCHED when the close is not confirmed within the shutdown deadline', async () => {
    const { transport, fakeWs } = await readyWith(() => Promise.resolve());
    fakeWs.suppressCloseEvent = true; // the socket never confirms the close
    vi.useFakeTimers();
    try {
      const disc = transport.disconnect();
      await vi.advanceTimersByTimeAsync(15_000); // SHUTDOWN_DEADLINE_MS
      await disc;
    } finally {
      vi.useRealTimers();
    }
    expect(fakeWs.terminateCalls).toBeGreaterThan(0);
    expect(transport.getPhase()).toBe('LATCHED');
  });
});

// B05 re-review (AS1-PATCH-V3-05): the raw Socket is bound to a MANDATORY owning-control predicate (re-checked at
// DEQUEUE, before queue.shift) and a MANDATORY durable profile latch. Both are structurally required constructor
// arguments (no permissive defaults), so an omitting construction cannot typecheck (proven by `npm run typecheck`
// over every site) — a provenance-free/latch-free Socket is unrepresentable. These prove the runtime behavior.
describe('AS1 raw socket transport — owning-control DEQUEUE gate + durable latch (B05)', () => {
  async function ready(
    onEnvelope: (env: As1InboundEnvelope) => Promise<void>,
    control: () => Promise<boolean> = () => Promise.resolve(true),
  ): Promise<ReturnType<typeof makeTransport>> {
    const ctx = makeTransport(control);
    ctx.transport.onEnvelope(onEnvelope);
    const promise = ctx.transport.connect({ profileId: 'AGENT_OFFICE_ADVISOR', appToken: 'xapp-x', expectedAppId: APP_ID, readinessSeal: () => true });
    await flush();
    ctx.fakeWs.emit('open');
    ctx.fakeWs.emit('message', helloFrame(APP_ID), false);
    await promise;
    return ctx;
  }

  it('a non-actionable owning control at DEQUEUE leaves the task unrun and un-dequeued, and durably latches', async () => {
    let actionable = true;
    const ran: string[] = [];
    const ctx = await ready((env) => {
      ran.push(env.envelopeId);
      return Promise.resolve();
    }, () => Promise.resolve(actionable));
    actionable = false; // owning control transitions to not-actionable AFTER admission, BEFORE the dequeue check
    ctx.fakeWs.emit('message', eventFrame('EnvX', APP_ID), false);
    await flush();
    expect(ran).toEqual([]); // the queued task was never dequeued or run under stale authority
    expect(ctx.transport.getPhase()).toBe('LATCHED');
    expect(ctx.durableLatches.some((r) => r.includes('control not actionable at dequeue'))).toBe(true);
  });

  it('queue overflow persists a DURABLE profile latch (not only the in-memory LATCHED phase)', async () => {
    const ctx = await ready(() => new Promise<void>(() => undefined));
    ctx.fakeWs.emit('message', eventFrame('Env1', APP_ID), false);
    await flush();
    for (let i = 2; i <= 33; i += 1) ctx.fakeWs.emit('message', eventFrame(`Env${String(i)}`, APP_ID), false);
    ctx.fakeWs.emit('message', eventFrame('Env34', APP_ID), false); // overflow
    expect(ctx.transport.getPhase()).toBe('LATCHED');
    expect(ctx.durableLatches.some((r) => r.includes('inbound queue overflow'))).toBe(true);
  });

  it('a handler failure persists a DURABLE profile latch', async () => {
    const ctx = await ready(() => Promise.reject(new Error('boom')));
    ctx.fakeWs.emit('message', eventFrame('Env1', APP_ID), false);
    await flush();
    expect(ctx.transport.getPhase()).toBe('LATCHED');
    expect(ctx.durableLatches.some((r) => r.includes('handler failure'))).toBe(true);
  });

  it('a provider disconnect persists a DURABLE profile latch', async () => {
    const ctx = await ready(() => Promise.resolve());
    ctx.fakeWs.emit('message', Buffer.from('{"type":"disconnect","reason":"refresh_requested"}', 'utf8'), false);
    await flush();
    expect(ctx.transport.getPhase()).toBe('LATCHED');
    expect(ctx.durableLatches.some((r) => r.includes('provider disconnect'))).toBe(true);
  });
});
