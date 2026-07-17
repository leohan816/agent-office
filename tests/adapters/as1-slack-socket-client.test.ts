import WebSocket from 'ws';
import { describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { LIMITS } from '../../src/application/slack-pilot/contracts.js';
import {
  As1RawSocketTransport,
  as1WsClientOptions,
  assertValidSlackWssUrl,
  boundedSlackFetch,
  type As1ConnectionsOpener,
  type As1InboundEnvelope,
  type As1WebSocketFactory,
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

/**
 * Connect through a verified hello (leaving the transport in AUTHENTICATED_QUARANTINE), then perform the Phase B
 * one-use receive arm so the transport reaches EVENT_RECEIVE_READY exactly as the composition arms it after the
 * durable RECEIVING transition. Tests that need the pre-arm quarantine drive connect+hello directly and skip arm.
 */
async function connectReady(seal: () => boolean = () => true): Promise<ReturnType<typeof makeTransport>> {
  const ctx = makeTransport();
  const promise = ctx.transport.connect({ profileId: 'AGENT_OFFICE_ADVISOR', appToken: 'xapp-x', expectedAppId: APP_ID, readinessSeal: seal });
  await flush();
  ctx.fakeWs.emit('open');
  ctx.fakeWs.emit('message', helloFrame(APP_ID), false);
  await promise;
  ctx.transport.armReceive();
  return ctx;
}

describe('AS1 raw socket transport — Phase B authenticated quarantine + receive arm (design §6)', () => {
  async function connectHelloOnly(seal: () => boolean = () => true): Promise<ReturnType<typeof makeTransport>> {
    const ctx = makeTransport();
    const promise = ctx.transport.connect({ profileId: 'AGENT_OFFICE_ADVISOR', appToken: 'xapp-x', expectedAppId: APP_ID, readinessSeal: seal });
    await flush();
    ctx.fakeWs.emit('open');
    ctx.fakeWs.emit('message', helloFrame(APP_ID), false);
    await promise;
    return ctx;
  }

  it('a verified hello leaves the transport in AUTHENTICATED_QUARANTINE, not receive-ready', async () => {
    const ctx = await connectHelloOnly();
    expect(ctx.transport.getPhase()).toBe('AUTHENTICATED_QUARANTINE');
  });

  it('parses/ACKs NOTHING before the arm and delivers the one held frame only after armReceive', async () => {
    const ctx = await connectHelloOnly();
    ctx.fakeWs.emit('message', eventFrame('Env0AGENTOFFICE1', APP_ID), false); // held raw, not parsed/delivered/ACKed
    await flush();
    expect(ctx.received).toHaveLength(0);
    expect(ctx.fakeWs.sent).toHaveLength(0);
    ctx.transport.armReceive();
    await flush();
    expect(ctx.transport.getPhase()).toBe('EVENT_RECEIVE_READY');
    expect(ctx.received).toHaveLength(1); // the one held frame is now parsed through the normal path
  });

  it('the zero-held-frame normal case: arm with nothing held, then a normal event delivers', async () => {
    const ctx = await connectHelloOnly();
    ctx.transport.armReceive();
    ctx.fakeWs.emit('message', eventFrame('Env0AGENTOFFICE1', APP_ID), false);
    await flush();
    expect(ctx.received).toHaveLength(1);
  });

  it('a SECOND frame before the arm latches and closes (fail closed)', async () => {
    const ctx = await connectHelloOnly();
    ctx.fakeWs.emit('message', eventFrame('Env1', APP_ID), false); // held
    ctx.fakeWs.emit('message', eventFrame('Env2', APP_ID), false); // second before arm → latch
    expect(ctx.transport.getPhase()).toBe('LATCHED');
    expect(ctx.received).toHaveLength(0);
  });

  it('armReceive is one-use and requires an authenticated-quarantine transport', async () => {
    const ctx = await connectHelloOnly();
    ctx.transport.armReceive();
    expect(() => ctx.transport.armReceive()).toThrow(DomainError); // one-use
    const fresh = makeTransport();
    expect(() => fresh.transport.armReceive()).toThrow(DomainError); // wrong phase (never connected)
  });
});

describe('AS1 raw socket transport — identity boundary', () => {
  it('reaches receive-ready only after exact hello App-ID equality, the readiness seal, and the arm', async () => {
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
    transport.armReceive();
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
    ctx.transport.armReceive();
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

  it('a latched socket followed immediately by disconnect() stays LATCHED, never downgraded to CLOSED', async () => {
    const ctx = await ready(() => Promise.resolve());
    ctx.fakeWs.emit('message', Buffer.from('{"type":"disconnect","reason":"refresh_requested"}', 'utf8'), false);
    await flush();
    expect(ctx.transport.getPhase()).toBe('LATCHED');
    await ctx.transport.disconnect(); // a shutdown after a latch must NOT overwrite LATCHED with CLOSED (B05)
    expect(ctx.transport.getPhase()).toBe('LATCHED');
  });

  it('a durable-latch persistence failure stays visibly fail-closed (LATCHED + observable), never a silent success', async () => {
    const opener = new FakeConnectionsOpener();
    const factory = new FakeAs1WebSocketFactory();
    const fakeWs = new FakeAs1Ws();
    factory.setNext(fakeWs);
    const transport = new As1RawSocketTransport(
      opener,
      factory,
      { record: () => undefined },
      () => 100_000,
      () => Promise.reject(new Error('durable store unavailable')), // persistence FAILS
      () => Promise.resolve(true),
    );
    transport.onEnvelope(() => Promise.resolve());
    const promise = transport.connect({ profileId: 'AGENT_OFFICE_ADVISOR', appToken: 'xapp-x', expectedAppId: APP_ID, readinessSeal: () => true });
    await flush();
    fakeWs.emit('open');
    fakeWs.emit('message', helloFrame(APP_ID), false);
    await promise;
    transport.armReceive();
    fakeWs.emit('message', Buffer.from('{"type":"disconnect","reason":"refresh_requested"}', 'utf8'), false);
    await flush();
    await transport.disconnect(); // awaits the (failed) durable-latch persistence
    expect(transport.getPhase()).toBe('LATCHED'); // still fail-closed
    expect(transport.latchPersistenceFailed()).toBe(true); // the failure is OBSERVABLE, not a silent success
  });

  it('a handler that fails DURING the drain fails closed promptly to LATCHED (no shutdown-timeout wait)', async () => {
    let failInFlight = (): void => undefined;
    const ctx = await ready(() => new Promise<void>((_resolve, reject) => {
      failInFlight = (): void => { reject(new Error('mid-drain handler failure')); };
    }));
    ctx.fakeWs.emit('message', eventFrame('Env1', APP_ID), false);
    await flush(); // Env1 is in flight (blocked)
    const disc = ctx.transport.disconnect(); // enters DRAINING and awaits the in-flight handler
    failInFlight(); // the in-flight handler FAILS during the drain -> runHandler latches
    // If disconnect fell through to closeAndConfirm on the terminated socket it would wait the full 15s shutdown
    // deadline (real timers) and this test would time out; resolving promptly proves the mid-drain LATCHED check.
    await disc;
    expect(ctx.transport.getPhase()).toBe('LATCHED');
    expect(ctx.durableLatches.some((r) => r.includes('handler failure'))).toBe(true);
  });
});

// B05 re-review V5 (AS1-PATCH-V5-05): every malformed/unexpected post-hello transport state and every post-ready
// raw error/close must DURABLY latch (persist the owning profile latch, retain LATCHED through shutdown), not be
// logged-and-ignored. A control predicate that rejects at dequeue must also fail closed. On 4cf967d these cases
// stayed EVENT_RECEIVE_READY with an empty durableLatches list (Reviewer-reproduced).
describe('AS1 raw socket transport — receive-ready fail-closed durable latching (B05 V5)', () => {
  async function ready(
    onEnvelope: (env: As1InboundEnvelope) => Promise<void> = () => Promise.resolve(),
    control: () => Promise<boolean> = () => Promise.resolve(true),
  ): Promise<ReturnType<typeof makeTransport>> {
    const ctx = makeTransport(control);
    ctx.transport.onEnvelope(onEnvelope);
    const promise = ctx.transport.connect({ profileId: 'AGENT_OFFICE_ADVISOR', appToken: 'xapp-x', expectedAppId: APP_ID, readinessSeal: () => true });
    await flush();
    ctx.fakeWs.emit('open');
    ctx.fakeWs.emit('message', helloFrame(APP_ID), false);
    await promise;
    ctx.transport.armReceive();
    return ctx;
  }

  it('a malformed JSON frame after ready durably latches (not logged-and-ignored)', async () => {
    const ctx = await ready();
    ctx.fakeWs.emit('message', Buffer.from('{', 'utf8'), false);
    await flush();
    expect(ctx.transport.getPhase()).toBe('LATCHED');
    expect(ctx.durableLatches.some((r) => r.includes('malformed frame after ready'))).toBe(true);
    expect(ctx.fakeWs.closeCalls.length).toBeGreaterThan(0);
    // A subsequent shutdown must NOT downgrade LATCHED to CLOSED.
    await ctx.transport.disconnect();
    expect(ctx.transport.getPhase()).toBe('LATCHED');
  });

  it('a well-formed but invalid Events API envelope after ready durably latches', async () => {
    const ctx = await ready();
    ctx.fakeWs.emit('message', Buffer.from('{"unexpected":"frame"}', 'utf8'), false);
    await flush();
    expect(ctx.transport.getPhase()).toBe('LATCHED');
    expect(ctx.durableLatches.some((r) => r.includes('invalid events-api envelope after ready'))).toBe(true);
  });

  it('a raw socket error after ready durably latches', async () => {
    const ctx = await ready();
    ctx.fakeWs.emit('error', new Error('provider stream error'));
    await flush();
    expect(ctx.transport.getPhase()).toBe('LATCHED');
    expect(ctx.durableLatches.some((r) => r.includes('raw socket error after ready'))).toBe(true);
  });

  it('a raw socket close after ready durably latches', async () => {
    const ctx = await ready();
    ctx.fakeWs.suppressCloseEvent = true; // avoid the fake's own close() re-emit; emit the provider close directly
    ctx.fakeWs.emit('close');
    await flush();
    expect(ctx.transport.getPhase()).toBe('LATCHED');
    expect(ctx.durableLatches.some((r) => r.includes('raw socket close after ready'))).toBe(true);
  });

  it('an owning control that REJECTS at dequeue fails closed durably and runs no queued handler', async () => {
    const ran: string[] = [];
    const ctx = await ready(
      (env) => { ran.push(env.envelopeId); return Promise.resolve(); },
      () => Promise.reject(new Error('control store unavailable')),
    );
    ctx.fakeWs.emit('message', eventFrame('EnvX', APP_ID), false);
    await flush();
    expect(ran).toEqual([]);
    expect(ctx.transport.getPhase()).toBe('LATCHED');
    expect(ctx.durableLatches.some((r) => r.includes('control not actionable at dequeue'))).toBe(true);
  });
});

// B05 re-review V6 (AS1-PATCH-V6-05): the Reviewer V5 result (f994749 / 8057004f) reproduced two load-bearing
// edges on 938775a — a post-ready binary frame and a 32,769-byte frame both stayed EVENT_RECEIVE_READY with an
// empty durableLatches list (routed to the now-inert startup rejectOnce), and a stale generation's raw error
// latched the current transport while closing only the old socket. V6-05A makes binary/non-Buffer/oversize
// phase-aware; V6-05B gates every raw callback on current Socket+generation ownership and rejects an overlapping
// connect before a second opener/factory side effect.
describe('AS1 raw socket transport — receive-ready binary/oversize + generation ownership (B05 V6)', () => {
  // --- V6-05A: a post-ready binary / non-Buffer / oversize frame follows the durable fail-closed path ---
  it('a binary frame after ready durably latches the owning profile and closes the current socket', async () => {
    const ctx = await connectReady();
    ctx.fakeWs.emit('message', Buffer.from('binary-after-ready', 'utf8'), true); // isBinary === true
    await flush();
    expect(ctx.transport.getPhase()).toBe('LATCHED');
    expect(ctx.durableLatches.some((r) => r.includes('binary or non-buffer frame after ready'))).toBe(true);
    expect(ctx.fakeWs.closeCalls.length).toBeGreaterThan(0);
    await ctx.transport.disconnect(); // a later shutdown must NOT downgrade LATCHED to CLOSED
    expect(ctx.transport.getPhase()).toBe('LATCHED');
  });

  it('a non-Buffer frame after ready durably latches the owning profile', async () => {
    const ctx = await connectReady();
    ctx.fakeWs.emit('message', 'a plain string, not a Buffer', false); // !Buffer.isBuffer(data)
    await flush();
    expect(ctx.transport.getPhase()).toBe('LATCHED');
    expect(ctx.durableLatches.some((r) => r.includes('binary or non-buffer frame after ready'))).toBe(true);
    expect(ctx.fakeWs.closeCalls.length).toBeGreaterThan(0);
  });

  it('an exact WS_MAX_PAYLOAD_BYTES+1 oversize frame after ready durably latches', async () => {
    const ctx = await connectReady();
    const oversize = Buffer.alloc(LIMITS.WS_MAX_PAYLOAD_BYTES + 1, 0x61); // exactly 32_769 bytes
    ctx.fakeWs.emit('message', oversize, false);
    await flush();
    expect(ctx.transport.getPhase()).toBe('LATCHED');
    expect(ctx.durableLatches.some((r) => r.includes('oversize frame after ready'))).toBe(true);
    expect(ctx.fakeWs.closeCalls.length).toBeGreaterThan(0);
  });

  // --- V6-05B: current Socket/generation ownership ---
  /** Wrap a fake's `on` to retain the exact listener functions the transport registers (they survive a later
   * removeAllListeners on the fake, so a stale generation's callbacks can be invoked directly). */
  function captureListeners(ws: FakeAs1Ws): Record<string, ((...a: unknown[]) => void) | undefined> {
    const captured: Record<string, ((...a: unknown[]) => void) | undefined> = {};
    const original = ws.on.bind(ws);
    ws.on = (event: string, listener: (...a: unknown[]) => void): void => {
      captured[event] = listener;
      original(event, listener);
    };
    return captured;
  }

  it('a stale generation error/close/message is a no-op against the clean current generation', async () => {
    const ctx = makeTransport();
    const gen1 = ctx.fakeWs;
    const stale = captureListeners(gen1);
    // gen1: connect + ready.
    const p1 = ctx.transport.connect({ profileId: 'AGENT_OFFICE_ADVISOR', appToken: 'xapp-x', expectedAppId: APP_ID, readinessSeal: () => true });
    await flush();
    gen1.emit('open');
    gen1.emit('message', helloFrame(APP_ID), false);
    await p1;
    // Clean disconnect gen1 (retains the monotonic generation counter, phase CLOSED), then a clean authorized reuse.
    await ctx.transport.disconnect();
    expect(ctx.transport.getPhase()).toBe('CLOSED');
    const gen2 = new FakeAs1Ws();
    ctx.factory.setNext(gen2);
    const p2 = ctx.transport.connect({ profileId: 'AGENT_OFFICE_ADVISOR', appToken: 'xapp-x', expectedAppId: APP_ID, readinessSeal: () => true });
    await flush();
    gen2.emit('open');
    gen2.emit('message', helloFrame(APP_ID), false);
    await p2;
    ctx.transport.armReceive();
    expect(ctx.transport.getPhase()).toBe('EVENT_RECEIVE_READY');

    const latchesBefore = ctx.durableLatches.length;
    const gen2ClosesBefore = gen2.closeCalls.length;
    // Invoke the RETAINED stale gen1 callbacks directly — none may mutate/latch/close the current (gen2) transport.
    stale.error?.(new Error('stale gen1 provider error'));
    stale.close?.();
    stale.message?.(Buffer.from('{', 'utf8'), false); // a malformed frame from the old generation
    stale.message?.(Buffer.from('binary', 'utf8'), true); // a binary frame from the old generation
    await flush();

    expect(ctx.transport.getPhase()).toBe('EVENT_RECEIVE_READY'); // current generation unchanged
    expect(ctx.durableLatches.length).toBe(latchesBefore); // no durable latch from a stale callback
    expect(gen2.closeCalls.length).toBe(gen2ClosesBefore); // the current socket was not closed
    // The current generation is still actionable: it delivers a fresh event.
    gen2.emit('message', eventFrame('EnvGen2AGENTOFFICE', APP_ID), false);
    await flush();
    expect(ctx.received.some((e) => e.envelopeId === 'EnvGen2AGENTOFFICE')).toBe(true);
  });

  it('a current-generation raw error after ready still durably fails closed (V5 behavior preserved)', async () => {
    const ctx = await connectReady();
    ctx.fakeWs.emit('error', new Error('current provider error'));
    await flush();
    expect(ctx.transport.getPhase()).toBe('LATCHED');
    expect(ctx.durableLatches.some((r) => r.includes('raw socket error after ready'))).toBe(true);
  });

  it('rejects an overlapping connect before a second opener/factory side effect', async () => {
    const ctx = await connectReady(); // gen1 live and ready
    const openerCallsBefore = ctx.opener.calls;
    const createdBefore = ctx.factory.created.length;
    await expect(
      ctx.transport.connect({ profileId: 'AGENT_OFFICE_ADVISOR', appToken: 'xapp-x', expectedAppId: APP_ID, readinessSeal: () => true }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(ctx.opener.calls).toBe(openerCallsBefore); // no second opener.open side effect
    expect(ctx.factory.created.length).toBe(createdBefore); // no second factory.create side effect
    expect(ctx.transport.getPhase()).toBe('EVENT_RECEIVE_READY'); // the first live connection is intact
    ctx.fakeWs.emit('message', eventFrame('EnvStillLiveAGENT', APP_ID), false);
    await flush();
    expect(ctx.received.some((e) => e.envelopeId === 'EnvStillLiveAGENT')).toBe(true);
  });
});

// B05 re-review V7 (AS1-PATCH-V7-05): the Reviewer V6 result (ccea51e / 2c911703) reproduced a pre-Socket
// concurrency race — two connect() calls overlapping while the first opener.open() was pending both passed the
// clean-state guard and each invoked the opener (openerCalls 2, factoryCalls 0, phase CLOSED). The V6 overlap test
// starts its second call only after connectReady(), so it never held the first opener pending. V7 reserves exclusive
// ownership synchronously (WS_CONNECTING) BEFORE the opener await, releases only its own reservation on opener/factory
// failure, and keeps a disconnect-while-pending generation from ever binding a Socket.
describe('AS1 raw socket transport — pre-Socket connect reservation (B05 V7)', () => {
  const URL = 'wss://wss.slack.com/link/?ticket=redacted';
  const CONNECT = { profileId: 'AGENT_OFFICE_ADVISOR', appToken: 'xapp-x', expectedAppId: APP_ID, readinessSeal: () => true };

  interface Deferred { resolve: (url: string) => void; reject: (error: Error) => void; }

  /** A transport whose opener stays pending until the test resolves/rejects the captured deferred (so the pre-Socket
   * overlap window is directly observable). Uses a real FakeAs1WebSocketFactory for created-count assertions. */
  function reservationCtx() {
    let openerCalls = 0;
    const deferreds: Deferred[] = [];
    const opener: As1ConnectionsOpener = {
      open: () => {
        openerCalls += 1;
        return new Promise<string>((resolve, reject) => { deferreds.push({ resolve, reject }); });
      },
    };
    const factory = new FakeAs1WebSocketFactory();
    const durableLatches: string[] = [];
    const received: As1InboundEnvelope[] = [];
    const transport = new As1RawSocketTransport(
      opener,
      factory,
      { record: () => { /* redacted */ } },
      () => 100_000,
      (reason) => { durableLatches.push(reason); return Promise.resolve(); },
      () => Promise.resolve(true),
    );
    transport.onEnvelope((envelope) => { received.push(envelope); return Promise.resolve(); });
    return { transport, factory, deferreds, durableLatches, received, openerCalls: () => openerCalls };
  }

  it('two overlapping connects with the first opener pending: one opener call, zero factory calls, second rejects', async () => {
    const ctx = reservationCtx();
    const p1 = ctx.transport.connect(CONNECT); // reserves synchronously, then suspends on the pending opener
    const p2 = ctx.transport.connect(CONNECT); // must reject at the guard BEFORE a second opener/factory side effect
    await expect(p2).rejects.toBeInstanceOf(DomainError);
    expect(ctx.openerCalls()).toBe(1); // exactly one opener call at the overlap point
    expect(ctx.factory.created.length).toBe(0); // zero factory calls at the overlap point
    expect(ctx.transport.getPhase()).toBe('WS_CONNECTING'); // the first reservation is held

    // Resolving the first opener lets the first generation complete hello and receive a current event.
    const gen1 = new FakeAs1Ws();
    ctx.factory.setNext(gen1);
    ctx.deferreds[0]?.resolve(URL);
    await flush();
    gen1.emit('open');
    gen1.emit('message', helloFrame(APP_ID), false);
    await p1;
    ctx.transport.armReceive();
    expect(ctx.transport.getPhase()).toBe('EVENT_RECEIVE_READY');
    gen1.emit('message', eventFrame('EnvReserveA', APP_ID), false);
    await flush();
    expect(ctx.received.some((e) => e.envelopeId === 'EnvReserveA')).toBe(true);
  });

  it('an opener rejection releases only its own reservation and permits one later clean connect', async () => {
    const ctx = reservationCtx();
    const p1 = ctx.transport.connect(CONNECT);
    expect(ctx.transport.getPhase()).toBe('WS_CONNECTING');
    ctx.deferreds[0]?.reject(new Error('apps.connections.open failed'));
    await expect(p1).rejects.toThrow('apps.connections.open failed');
    expect(ctx.transport.getPhase()).toBe('CLOSED'); // reservation released to the clean state
    expect(ctx.factory.created.length).toBe(0); // no Socket was bound

    const gen = new FakeAs1Ws();
    ctx.factory.setNext(gen);
    const p2 = ctx.transport.connect(CONNECT); // a later explicit clean connect proceeds
    ctx.deferreds[1]?.resolve(URL);
    await flush();
    gen.emit('open');
    gen.emit('message', helloFrame(APP_ID), false);
    await p2;
    ctx.transport.armReceive();
    expect(ctx.transport.getPhase()).toBe('EVENT_RECEIVE_READY');
  });

  it('a factory throw releases only its own reservation and permits one later clean connect', async () => {
    const deferreds: Deferred[] = [];
    const opener: As1ConnectionsOpener = {
      open: () => new Promise<string>((resolve, reject) => { deferreds.push({ resolve, reject }); }),
    };
    const gen2 = new FakeAs1Ws();
    let createCalls = 0;
    const factory: As1WebSocketFactory = {
      create: () => {
        createCalls += 1;
        if (createCalls === 1) throw new Error('ws factory failed');
        return gen2;
      },
    };
    const received: As1InboundEnvelope[] = [];
    const transport = new As1RawSocketTransport(
      opener,
      factory,
      { record: () => { /* redacted */ } },
      () => 100_000,
      () => Promise.resolve(),
      () => Promise.resolve(true),
    );
    transport.onEnvelope((envelope) => { received.push(envelope); return Promise.resolve(); });

    const p1 = transport.connect(CONNECT);
    deferreds[0]?.resolve(URL); // opener resolves → factory.create throws before a Socket is bound
    await expect(p1).rejects.toThrow('ws factory failed');
    expect(transport.getPhase()).toBe('CLOSED'); // reservation released; no reconnect/retry
    expect(createCalls).toBe(1);

    const p2 = transport.connect(CONNECT); // a later explicit clean connect proceeds (second create returns gen2)
    deferreds[1]?.resolve(URL);
    await flush();
    gen2.emit('open');
    gen2.emit('message', helloFrame(APP_ID), false);
    await p2;
    transport.armReceive();
    expect(transport.getPhase()).toBe('EVENT_RECEIVE_READY');
  });

  it('a disconnect while the opener is pending prevents that generation from binding a Socket after it resolves', async () => {
    const ctx = reservationCtx();
    const p1 = ctx.transport.connect(CONNECT);
    expect(ctx.transport.getPhase()).toBe('WS_CONNECTING'); // reserved, opener pending
    await ctx.transport.disconnect(); // stop while the opener is still pending
    expect(ctx.transport.getPhase()).toBe('CLOSED'); // stopped, fail closed
    ctx.factory.setNext(new FakeAs1Ws()); // a Socket is queued but must NOT be created by the stopped generation
    ctx.deferreds[0]?.resolve(URL); // the opener resolves late
    await expect(p1).rejects.toBeInstanceOf(DomainError); // the pending generation must not bind
    await flush();
    expect(ctx.factory.created.length).toBe(0); // no Socket was created/bound by the stopped generation
    expect(ctx.transport.getPhase()).toBe('CLOSED'); // the clean stopped state is intact
  });
});

// R2 recovery design §3.3/§3.4: the armed post-hello Socket must DELIVER the exact ordinary depth-10 rich-text
// message once through the normal path (no malformed-frame latch), and must REJECT the one-level-over depth-11
// mutation with the existing stable malformed-frame observation — one durable owning-profile latch, no handler,
// no Socket ACK, and no raw frame text in any log or latch reason.
const richTextEventFrame = (inlineTextElement: Record<string, unknown>): Buffer =>
  Buffer.from(
    JSON.stringify({
      type: 'events_api',
      envelope_id: 'Env0AGENTOFFICE01',
      accepts_response_payload: false,
      payload: {
        type: 'event_callback',
        team_id: 'TWORKSPACE001',
        api_app_id: APP_ID,
        event_id: 'Ev0AGENTOFFICE01',
        event_time: 1720000000,
        authorizations: [
          { enterprise_id: null, team_id: 'TWORKSPACE001', user_id: 'UAGENTBOT001', is_bot: true, is_enterprise_install: false },
        ],
        event: {
          type: 'message',
          user: 'ULEO0000001',
          channel: 'CAGENTOFFICE01',
          channel_type: 'group',
          ts: '1720000000.000100',
          event_ts: '1720000000.000100',
          text: 'please start a new mission',
          blocks: [{ type: 'rich_text', block_id: 'b1', elements: [{ type: 'rich_text_section', elements: [inlineTextElement] }] }],
        },
      },
    }),
    'utf8',
  );

describe('AS1 raw socket transport — R2 Socket-local depth 10 through an armed Socket (design §3)', () => {
  it('delivers the exact depth-10 rich-text frame to the handler exactly once with no malformed-frame latch', async () => {
    const ctx = await connectReady();
    ctx.fakeWs.emit('message', richTextEventFrame({ type: 'text', text: 'please start a new mission' }), false);
    await flush();
    expect(ctx.received).toHaveLength(1); // reaches the handler once through the normal path
    expect(ctx.transport.getPhase()).toBe('EVENT_RECEIVE_READY'); // no latch
    expect(ctx.durableLatches).toHaveLength(0);
  });

  it('rejects the depth-11 mutation with one durable latch, no handler, no ACK, and no raw frame text', async () => {
    const ctx = await connectReady();
    ctx.fakeWs.emit('message', richTextEventFrame({ type: 'text', text: 'please start a new mission', unexpected: { leaf: true } }), false);
    await flush();
    expect(ctx.received).toHaveLength(0); // no handler call
    expect(ctx.fakeWs.sent).toHaveLength(0); // no Socket ACK
    expect(ctx.transport.getPhase()).toBe('LATCHED');
    expect(ctx.durableLatches).toHaveLength(1); // one durable owning-profile latch
    for (const line of [...ctx.logs, ...ctx.durableLatches]) {
      expect(line).not.toContain('please start a new mission');
      expect(line).not.toContain('leaf');
      expect(line).not.toContain('unexpected');
    }
  });
});
