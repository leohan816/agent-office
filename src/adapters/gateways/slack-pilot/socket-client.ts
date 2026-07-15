// AS1 Multi-Team Slack Pilot — raw public-root Socket Mode adapter (no @slack/socket-mode).
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_SOCKET_IDENTITY_DESIGN_DELTA.md. The inbound
// transport is composed only from the public root of `@slack/web-api@8.0.0` (`apps.connections.open`) and
// the public root of `ws@8.21.1`. `@slack/socket-mode` is not imported. The adapter owns the raw stream
// from the temporary URL through the first `hello`, keeps the connection in a zero-buffer quarantine,
// parses only the exact bounded hello grammar, compares `hello.connection_info.app_id` INSIDE the
// transport message callback, and synchronously seals the already-verified fixed profile before it enables
// Events API parsing or application delivery. There is no provider retry, reconnect, fallback, or token
// swap. The `ws` receiver enforces `maxPayload:32768`, `maxBufferedChunks:64`, `maxFragments:64`, and
// `perMessageDeflate:false` before the consumer `message` event; the consumer rechecks bytes/binary again.
// ACK is a one-use, same-generation, exact-ID, payload-free closure. Logging is redacted at every seam.
import WebSocket from 'ws';
import { LogLevel, WebClient, type FetchFunction, type Logger } from '@slack/web-api';

import { DomainError } from '../../../contracts/types.js';
import { LIMITS } from '../../../application/slack-pilot/contracts.js';
import { isDisconnectFrame, parseEventsApiValue, parseHelloFrame, parseTrustedJson } from './socket-frame.js';

// The three public `ws@8.21.1` runtime options omitted by `@types/ws@8.18.1` (design §7.4). No cast,
// `any`, module augmentation, deep import, suppression, or skipLibCheck change is used.
export type As1WsClientOptions = WebSocket.ClientOptions & {
  readonly closeTimeout: 5_000;
  readonly maxBufferedChunks: 64;
  readonly maxFragments: 64;
};

// The exact immutable ws options (design §7.4). handshakeTimeout is the remaining startup-deadline portion.
// The literal uses `as const satisfies As1WsClientOptions` (design §7.4 hard gate) so every fixed option keeps
// its exact literal type through to the direct `new WebSocket(url, options)` seam in `NodeAs1WebSocketFactory`;
// the inferred narrow return type is what the compile/static probe in the focused test asserts. No explicit
// widening annotation, cast, `any`, module augmentation, deep import, or suppression is used.
export function as1WsClientOptions(handshakeTimeout: number) {
  return {
    allowSynchronousEvents: false,
    autoPong: true,
    closeTimeout: 5_000,
    followRedirects: false,
    handshakeTimeout,
    maxBufferedChunks: 64,
    maxFragments: 64,
    maxPayload: 32_768,
    maxRedirects: 0,
    perMessageDeflate: false,
    protocolVersion: 13,
    skipUTF8Validation: false,
  } as const satisfies As1WsClientOptions;
}

/** Narrow, public-`ws`-shaped surface used by the state machine. Real `ws` satisfies it; fakes implement it. */
export interface As1WsLike {
  binaryType: 'nodebuffer' | 'arraybuffer' | 'fragments';
  readonly readyState: number;
  readonly bufferedAmount: number;
  on(event: string, listener: (...args: unknown[]) => void): void;
  send(data: string): void;
  close(code: number, reason: string): void;
  terminate(): void;
  removeAllListeners(): void;
}

export interface As1WebSocketFactory {
  create(url: string, options: As1WsClientOptions): As1WsLike;
}

/** Bounded one-shot `apps.connections.open` port that returns a validated `wss` URL (design §7.3). */
export interface As1ConnectionsOpener {
  open(appToken: string, deadlineMs: number): Promise<string>;
}

/** Redacted log sink: only fixed profile/phase/reason codes are ever emitted (design §7.9). */
export interface As1SocketLogSink {
  record(profileId: string, phase: string, reason: string): void;
}

const NULL_LOG_SINK: As1SocketLogSink = {
  record(): void {
    /* redacted */
  },
};

export interface As1InboundEnvelope {
  readonly envelopeId: string;
  readonly payload: unknown;
  readonly retryAttempt: number | null;
  readonly retryReason: string | null;
  readonly acknowledge: () => Promise<void>;
}

export interface As1SocketConnectInput {
  readonly profileId: string;
  readonly appToken: string;
  readonly expectedAppId: string;
  /** Synchronous re-check of the already-verified profile/control/latch facts inside the message callback. */
  readonly readinessSeal: () => boolean;
}

export interface As1SocketConnectResult {
  readonly ok: boolean;
}

export interface As1SocketPort {
  connect(input: As1SocketConnectInput): Promise<As1SocketConnectResult>;
  onEnvelope(handler: (envelope: As1InboundEnvelope) => Promise<void>): void;
  disconnect(): Promise<void>;
}

/** Validate the opaque temporary URL before constructing a WebSocket (design §7.3). Never logs the URL. */
export function assertValidSlackWssUrl(url: string): string {
  if (Buffer.byteLength(url, 'utf8') > LIMITS.WS_URL_MAX_BYTES) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'connections.open url exceeds the byte bound');
  }
  // Reject any explicit authority port from the RAW url before platform normalization can hide the default
  // wss port (:443). The scan stops at the first '/', '?', or '#' so secret query/ticket material is never
  // inspected or logged. A ':' in the host segment (after any credentials '@') is an explicit port.
  if (url.startsWith('wss://')) {
    const afterScheme = url.slice('wss://'.length);
    let authorityEnd = afterScheme.length;
    for (const delimiter of ['/', '?', '#']) {
      const index = afterScheme.indexOf(delimiter);
      if (index !== -1 && index < authorityEnd) authorityEnd = index;
    }
    const authority = afterScheme.slice(0, authorityEnd);
    const host = authority.includes('@') ? authority.slice(authority.lastIndexOf('@') + 1) : authority;
    if (host.includes(':')) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'connections.open url carries an explicit authority port');
    }
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'connections.open url is not parseable');
  }
  if (
    parsed.protocol !== 'wss:' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.port !== '' ||
    parsed.hash !== '' ||
    !(parsed.hostname === 'wss.slack.com' || /^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.slack\.com$/u.test(parsed.hostname)) ||
    parsed.pathname !== '/link/'
  ) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'connections.open url is not the exact Slack wss form');
  }
  return url;
}

type Phase =
  | 'WS_CONNECTING'
  | 'HELLO_QUARANTINE'
  | 'AUTHENTICATED_QUARANTINE'
  | 'EVENT_RECEIVE_READY'
  | 'DRAINING'
  | 'CLOSED'
  | 'LATCHED';

/** The raw transport state machine, injectable with a connections opener, ws factory, and log sink. */
export class As1RawSocketTransport implements As1SocketPort {
  private socket: As1WsLike | null = null;
  private phase: Phase = 'CLOSED';
  private generation = 0;
  private handler: ((envelope: As1InboundEnvelope) => Promise<void>) | null = null;
  private profileId = '';
  // Profile-local bounded FIFO admission (review B08): at most INMEMORY_QUEUE_PER_PROFILE queued, at most
  // INFLIGHT_SIDE_EFFECTS_PER_PROFILE handler in flight. Admission stops on disconnect/latch; nothing crosses
  // profiles (this transport is per profile) and nothing queued is replayed after a stop.
  private readonly queue: (() => Promise<void>)[] = [];
  private inFlightCount = 0;
  private readonly inFlightRunning = new Set<Promise<void>>();
  private admitting = false;
  // A single pump loop runs at a time; the async owning-control DEQUEUE check must not be raced (review B05).
  private pumping = false;

  private latchPersisted = false;

  public constructor(
    private readonly opener: As1ConnectionsOpener,
    private readonly factory: As1WebSocketFactory,
    private readonly log: As1SocketLogSink = NULL_LOG_SINK,
    private readonly now: () => number = () => Date.now(),
    /**
     * MANDATORY durable owning-profile latch (review B05). Every in-memory LATCHED transition — queue overflow,
     * provider disconnect, unexpected data, handler failure, forced termination, drain-deadline/close-unconfirmed —
     * ALSO persists a durable profile latch, so a capacity/transport failure is not forgotten on restart.
     */
    private readonly durableLatch: (reason: string) => Promise<void>,
    /**
     * MANDATORY owning-profile control predicate, re-checked before every queue DEQUEUE (review B05). When the
     * owning profile is killed/latched/disabled/wrong-active between admission and running, the queued handler
     * never runs; admission stops and the socket fails closed.
     */
    private readonly control: () => Promise<boolean>,
  ) {}

  /** Persist the DURABLE profile latch exactly once (review B05) and RETURN its promise so an async caller can
   * AWAIT it before closure. The in-memory LATCHED already fail-closed the socket, so a durable-latch failure is
   * recorded as a stable code and never thrown into a ws callback. */
  private persistDurableLatch(reason: string): Promise<void> {
    if (this.latchPersisted) return Promise.resolve();
    this.latchPersisted = true;
    return this.durableLatch(reason).catch(() => {
      this.log.record(this.profileId, 'LATCHED', 'DURABLE_LATCH_FAILED');
    });
  }

  public onEnvelope(handler: (envelope: As1InboundEnvelope) => Promise<void>): void {
    this.handler = handler;
  }

  public async connect(input: As1SocketConnectInput): Promise<As1SocketConnectResult> {
    this.profileId = input.profileId;
    const deadlineAt = this.now() + LIMITS.STARTUP_IDENTITY_TIMEOUT_MS;
    const url = await this.opener.open(input.appToken, Math.max(0, deadlineAt - this.now()));
    const remaining = Math.max(1, deadlineAt - this.now());
    const socket = this.factory.create(url, as1WsClientOptions(remaining));
    socket.binaryType = 'nodebuffer';
    this.socket = socket;
    this.generation += 1;
    const generation = this.generation;
    this.phase = 'WS_CONNECTING';

    return new Promise<As1SocketConnectResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.failStart(socket, 1008, 'startup deadline', reject);
      }, remaining);
      const done = { settled: false };
      const rejectOnce = (code: number, reason: string): void => {
        if (done.settled) return;
        done.settled = true;
        clearTimeout(timer);
        this.failStart(socket, code, reason, reject);
      };

      socket.on('open', () => {
        if (this.phase === 'WS_CONNECTING' && this.generation === generation) this.phase = 'HELLO_QUARANTINE';
      });
      socket.on('error', () => {
        rejectOnce(1008, 'ws error before ready');
      });
      socket.on('close', () => {
        if (!done.settled && this.phase !== 'EVENT_RECEIVE_READY') rejectOnce(1008, 'closed before ready');
      });
      socket.on('message', (...args: unknown[]) => {
        const data = args[0];
        const isBinary = args[1] === true;
        if (isBinary || !Buffer.isBuffer(data)) {
          rejectOnce(1003, 'binary frame in quarantine');
          return;
        }
        if (data.byteLength > LIMITS.WS_MAX_PAYLOAD_BYTES) {
          rejectOnce(1009, 'oversize frame in quarantine');
          return;
        }
        const text = data.toString('utf8');
        if (this.phase === 'HELLO_QUARANTINE') {
          let appId: string;
          try {
            appId = parseHelloFrame(text).appId;
          } catch {
            rejectOnce(1008, 'malformed or non-hello first frame');
            return;
          }
          this.phase = 'AUTHENTICATED_QUARANTINE';
          if (appId !== input.expectedAppId) {
            rejectOnce(1008, 'hello app-id mismatch');
            return;
          }
          if (this.generation !== generation || !input.readinessSeal()) {
            rejectOnce(1008, 'readiness seal failed');
            return;
          }
          this.phase = 'EVENT_RECEIVE_READY';
          this.admitting = true;
          done.settled = true;
          clearTimeout(timer);
          resolve({ ok: true });
          return;
        }
        if (this.phase === 'EVENT_RECEIVE_READY') {
          this.dispatchAfterReady(socket, generation, text);
          return;
        }
        // A data message before hello acceptance or in any other state is a reentrancy/latch condition.
        this.latch(socket, 1008, 'unexpected data frame');
      });
    });
  }

  public async disconnect(): Promise<void> {
    // Stop admission immediately and DROP any queued-but-unstarted callbacks — a stopped profile never replays
    // them later, even after a reconnect (design §7.5).
    this.admitting = false;
    this.queue.length = 0;
    const socket = this.socket;
    if (socket === null) {
      this.phase = 'CLOSED';
      return;
    }
    // DRAINING keeps the SAME socket + generation bound so the accepted in-flight handler's ACK still works.
    this.phase = 'DRAINING';
    const drained = await this.awaitWithin([...this.inFlightRunning], LIMITS.DRAIN_DEADLINE_MS);
    if (!drained) {
      // Drain deadline exceeded: fail closed — force-terminate and stay LATCHED, never a clean CLOSED. Await the
      // durable profile latch before disconnect() returns (review B05).
      this.log.record(this.profileId, 'DRAINING', 'REJECTED_DRAIN_DEADLINE');
      await this.forceTerminateAndLatch(socket, 'drain deadline exceeded');
      return;
    }
    // Close and CONFIRM within SHUTDOWN_DEADLINE_MS; an unconfirmed close force-terminates and stays LATCHED.
    const confirmed = await this.closeAndConfirm(socket, LIMITS.SHUTDOWN_DEADLINE_MS);
    if (!confirmed) {
      this.log.record(this.profileId, 'DRAINING', 'REJECTED_CLOSE_UNCONFIRMED');
      await this.forceTerminateAndLatch(socket, 'close unconfirmed after drain');
      return;
    }
    this.socket = null;
    socket.removeAllListeners();
    this.phase = 'CLOSED';
  }

  /** Immediate force-termination: abnormal terminate + LATCHED (never a confirmed CLOSED). Returns the durable-
   * latch promise so `disconnect()` can AWAIT durable persistence before it returns (review B05). */
  private forceTerminateAndLatch(socket: As1WsLike, reason = 'socket force-terminate latch'): Promise<void> {
    this.admitting = false;
    this.queue.length = 0;
    this.phase = 'LATCHED';
    try {
      socket.terminate();
    } catch {
      // The socket is already gone; the durable state remains LATCHED.
    }
    socket.removeAllListeners();
    if (this.socket === socket) this.socket = null;
    return this.persistDurableLatch(reason);
  }

  /** Await all promises within `deadlineMs`; true if they all settled, false on timeout. */
  private async awaitWithin(promises: readonly Promise<void>[], deadlineMs: number): Promise<boolean> {
    if (promises.length === 0) return true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), deadlineMs);
    });
    const outcome = await Promise.race([Promise.allSettled(promises).then((): 'done' => 'done'), timeout]);
    if (timer !== undefined) clearTimeout(timer);
    return outcome === 'done';
  }

  /** Close the socket and resolve true only on a confirmed `close` within `deadlineMs`, else false. */
  private closeAndConfirm(socket: As1WsLike, deadlineMs: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), deadlineMs);
      socket.on('close', () => finish(true));
      try {
        socket.close(1000, 'AS1_STOP');
      } catch {
        finish(false);
      }
    });
  }

  private dispatchAfterReady(socket: As1WsLike, generation: number, text: string): void {
    let value: unknown;
    try {
      value = parseTrustedJson(text);
    } catch {
      this.log.record(this.profileId, 'EVENT_RECEIVE_READY', 'REJECTED_MALFORMED_FRAME');
      return;
    }
    if (isDisconnectFrame(value)) {
      // Provider disconnect is transport control: close with no reconnect (design §7.5/§7.7).
      this.log.record(this.profileId, 'EVENT_RECEIVE_READY', 'PROVIDER_DISCONNECT');
      void this.disconnectAndLatch(socket, 1008, 'provider disconnect');
      return;
    }
    let envelope: { envelopeId: string; payload: unknown; retryAttempt: number | null; retryReason: string | null };
    try {
      const parsed = parseEventsApiValue(value);
      envelope = { envelopeId: parsed.envelopeId, payload: parsed.callback, retryAttempt: parsed.retryAttempt, retryReason: parsed.retryReason };
    } catch {
      this.log.record(this.profileId, 'EVENT_RECEIVE_READY', 'REJECTED_ENVELOPE');
      return;
    }
    const handler = this.handler;
    if (handler === null || !this.admitting) return;
    // Bounded profile-local admission: an overflow of the FIFO queue is a fail-closed latch, never a silent drop
    // or an unbounded concurrent handler.
    if (this.queue.length >= LIMITS.INMEMORY_QUEUE_PER_PROFILE) {
      this.log.record(this.profileId, 'EVENT_RECEIVE_READY', 'REJECTED_QUEUE_OVERFLOW');
      this.latch(socket, 1008, 'inbound queue overflow');
      return;
    }
    const item: As1InboundEnvelope = {
      envelopeId: envelope.envelopeId,
      payload: envelope.payload,
      retryAttempt: envelope.retryAttempt,
      retryReason: envelope.retryReason,
      acknowledge: this.buildAck(socket, generation, envelope.envelopeId),
    };
    this.queue.push(() => handler(item));
    void this.pump();
  }

  /**
   * Start queued handlers up to the EXACT declared in-flight bound (INFLIGHT_SIDE_EFFECTS_PER_PROFILE=1), FIFO.
   * The owning control is re-checked at DEQUEUE — immediately BEFORE queue.shift() removes the task — so a control
   * transition leaves the queued task both UNEXECUTED and UN-DEQUEUED (review B05). A single pump loop runs at a
   * time (the `pumping` guard) so the async control check cannot be raced into a double dequeue.
   */
  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.inFlightCount < LIMITS.INFLIGHT_SIDE_EFFECTS_PER_PROFILE && this.queue.length > 0) {
        // DEQUEUE gate: check the owning control BEFORE removing anything from the FIFO. A profile killed/latched/
        // disabled/wrong-active stops admission, drops queued work (never replayed), and durably latches — the
        // task is never dequeued or run under stale authority.
        if (!(await this.control())) {
          const socket = this.socket;
          this.log.record(this.profileId, this.phase, 'REJECTED_CONTROL_NOT_ACTIONABLE');
          this.admitting = false;
          this.queue.length = 0;
          if (socket !== null) void this.disconnectAndLatch(socket, 1011, 'owning control not actionable at dequeue');
          return;
        }
        const task = this.queue.shift();
        if (task === undefined) break;
        this.inFlightCount += 1;
        const running = this.runHandler(task);
        this.inFlightRunning.add(running);
        void running.finally(() => {
          this.inFlightCount -= 1;
          this.inFlightRunning.delete(running);
          void this.pump();
        });
      }
    } finally {
      this.pumping = false;
    }
  }

  /**
   * Run one accepted handler. An unclassified handler failure is FAIL-CLOSED (design §7.5): record only a stable
   * redacted code, stop admission, drop queued work, and latch/close the profile socket — never continue.
   */
  private async runHandler(task: () => Promise<void>): Promise<void> {
    try {
      // The owning-control DEQUEUE gate ran in pump() BEFORE this task was removed from the FIFO (review B05).
      await task();
    } catch {
      const socket = this.socket;
      this.log.record(this.profileId, this.phase, 'REJECTED_HANDLER_FAILURE');
      this.admitting = false;
      this.queue.length = 0;
      if (socket !== null) void this.disconnectAndLatch(socket, 1011, 'handler failure');
    }
  }

  /** One-use ACK closure bound to socket generation and the exact envelope_id (design §7.8). */
  private buildAck(socket: As1WsLike, generation: number, envelopeId: string): () => Promise<void> {
    let consumed = false;
    return async (): Promise<void> => {
      if (consumed) throw new DomainError('IDEMPOTENCY_KEY_REUSED', 'ack closure already consumed');
      if (this.generation !== generation || this.socket !== socket) {
        throw new DomainError('INVALID_TRANSITION', 'ack generation is stale');
      }
      if (this.phase !== 'EVENT_RECEIVE_READY' && this.phase !== 'DRAINING') {
        throw new DomainError('INVALID_TRANSITION', 'ack requires a receive-ready or accepted-drain state');
      }
      if (socket.readyState !== WebSocket.OPEN || socket.bufferedAmount !== 0) {
        throw new DomainError('INVALID_TRANSITION', 'ack requires an open socket with an empty send buffer');
      }
      const frame = JSON.stringify({ envelope_id: envelopeId });
      if (Buffer.byteLength(frame, 'utf8') > LIMITS.ACK_FRAME_MAX_BYTES) {
        throw new DomainError('INVALID_SCHEMA', 'ack frame exceeds its byte bound');
      }
      consumed = true;
      socket.send(frame);
      await Promise.resolve();
    };
  }

  private failStart(socket: As1WsLike, code: number, reason: string, reject: (error: Error) => void): void {
    this.log.record(this.profileId, this.phase, `START_FAILURE_${code}`);
    void this.disconnectAndLatch(socket, code, `start failure: ${reason}`);
    reject(new DomainError('AUTHORITY_ARTIFACT_INVALID', `socket start failed: ${reason}`));
  }

  private latch(socket: As1WsLike, code: number, reason: string): void {
    this.log.record(this.profileId, this.phase, `LATCH_${code}`);
    // ws-callback (sync) context: the durable latch is fired-and-forgotten (still persisted once); only the async
    // disconnect() drain/close path awaits it before returning.
    void this.disconnectAndLatch(socket, code, reason);
  }

  private disconnectAndLatch(socket: As1WsLike, closeCode = 1008, reason = 'socket fail-closed latch'): Promise<void> {
    this.admitting = false;
    this.queue.length = 0;
    this.phase = 'LATCHED';
    try {
      socket.close(closeCode, 'AS1_LATCH');
    } catch {
      socket.terminate();
    }
    socket.removeAllListeners();
    if (this.socket === socket) this.socket = null;
    // Return the durable-latch promise so an async caller can AWAIT persistence before closure (review B05).
    return this.persistDurableLatch(reason);
  }

  public getPhase(): Phase {
    return this.phase;
  }
}

/** Node factory constructing the exact bounded `ws` client. Never executed in Phase A (fakes only). */
export class NodeAs1WebSocketFactory implements As1WebSocketFactory {
  public create(url: string, options: As1WsClientOptions): As1WsLike {
    return new WebSocket(url, options);
  }
}

/** The single fixed Slack Web API endpoint the bounded fetch wrapper may contact (design §7.3). */
export const SLACK_CONNECTIONS_OPEN_ENDPOINT = 'https://slack.com/api/apps.connections.open';

/** Suppressing Web API logger: discards untrusted arguments; never emits tokens/URLs/bytes (design §7.9). */
class SuppressingWebLogger implements Logger {
  public debug(): void {
    /* redacted */
  }
  public info(): void {
    /* redacted */
  }
  public warn(): void {
    /* redacted */
  }
  public error(): void {
    /* redacted */
  }
  public setLevel(): void {
    /* fixed */
  }
  public getLevel(): LogLevel {
    return LogLevel.ERROR;
  }
  public setName(): void {
    /* fixed */
  }
}

/** Native platform fetch shape (global `Response` so its body stream can be bounded). */
export type As1NativeFetch = (url: string | URL, init?: RequestInit) => Promise<Response>;

/**
 * Fixed-endpoint, 65,536-byte bounded fetch wrapper over a native fetch (design §7.3). It accepts only the
 * fixed apps.connections.open endpoint, streams at most 65,536 response bytes, aborts on overflow, and
 * returns a bounded platform Response. It never logs headers, token, URL, response bytes, or provider error.
 */
export function boundedSlackFetch(native: As1NativeFetch): FetchFunction {
  return async (url, init) => {
    const target = typeof url === 'string' ? url : url.href;
    if (target !== SLACK_CONNECTIONS_OPEN_ENDPOINT) {
      throw new DomainError('FORBIDDEN_TARGET', 'web api endpoint is not the fixed apps.connections.open endpoint');
    }
    const response = await native(url, init);
    const body = response.body;
    if (body === null) {
      return new Response(new Uint8Array(0), { status: response.status, headers: response.headers });
    }
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const step = await reader.read();
        if (step.done) break;
        const chunk = step.value;
        total += chunk.byteLength;
        if (total > LIMITS.PROVIDER_RESPONSE_MAX_BYTES) {
          await reader.cancel();
          throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'apps.connections.open response exceeded its byte bound');
        }
        chunks.push(chunk);
      }
    } finally {
      reader.releaseLock();
    }
    const combined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new Response(combined, { status: response.status, headers: response.headers });
  };
}

/**
 * Real bounded `apps.connections.open` opener (public `@slack/web-api` root). One call with retries:0,
 * rate-limit rejection, a single-endpoint bounded fetch wrapper, a suppressing logger, and the remaining
 * portion of the one non-resetting startup deadline as the timeout. Validated `wss` URL. Never executed in
 * Phase A (fakes only); present for production composition and injectable for synthetic proof.
 */
export class NodeAs1ConnectionsOpener implements As1ConnectionsOpener {
  public constructor(private readonly nativeFetch: As1NativeFetch = globalThis.fetch) {}

  public async open(appToken: string, deadlineMs: number): Promise<string> {
    const client = new WebClient(appToken, {
      retryConfig: { retries: 0 },
      rejectRateLimitedCalls: true,
      maxRequestConcurrency: 1,
      timeout: Math.max(1, deadlineMs),
      allowAbsoluteUrls: false,
      logger: new SuppressingWebLogger(),
      fetch: boundedSlackFetch(this.nativeFetch),
    });
    const response = await client.apps.connections.open();
    if (!response.ok || typeof response.url !== 'string') {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'apps.connections.open did not return a url');
    }
    return assertValidSlackWssUrl(response.url);
  }
}
