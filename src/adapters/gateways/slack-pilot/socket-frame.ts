// AS1 Multi-Team Slack Pilot — pure hello-only quarantine lexer and post-proof envelope guard.
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_SOCKET_IDENTITY_DESIGN_DELTA.md §7.6 (hello-only
// quarantine parser) and §7.7 (post-proof envelope/identity gate). The first raw Socket text frame is NOT
// passed to `JSON.parse`. A purpose-built lexer accepts only the exact bounded `hello` grammar: it rejects
// an unknown top-level key immediately after its key token (before scanning the value) and a non-`hello`
// `type` immediately. Thus an `events_api` object as the first frame is rejected at its `type` value or at
// an unknown `payload` key — whichever comes first — without event-body parsing. Only the bounded App ID
// is returned; debug data and raw bytes are discarded. No parser error contains source text, key value,
// URL, token, App ID, host, or provider error. After App-ID proof, the general JSON path parses to
// `unknown`, walks bounded structure, and accepts only the exact events-api outer keys.
import { DomainError } from '../../../contracts/types.js';
import { assertRecord, isRecord } from '../../../contracts/validation.js';
import { LIMITS, SLACK_ID_GRAMMARS } from '../../../application/slack-pilot/contracts.js';

const APP_ID = SLACK_ID_GRAMMARS.appId;

/**
 * Socket-only maximum JSON nesting depth for the POST-HELLO event structural walk (R2 recovery design §3.2). The
 * shared LIMITS.JSON_NESTING_DEPTH_MAX stays exactly 8 for every other caller; this local boundary permits the
 * ordinary plain rich-text message whose deepest path is the inline text primitive at depth 10 (Events API outer
 * =1 … inline text element object =9, inline text primitive =10). It is two levels narrower than an unbounded
 * block parser: an optional deeper block structure (e.g. an inline child object with a primitive below it) is
 * depth 11 and fails closed. The pilot does not interpret blocks; the authoritative content is the separately
 * bounded event.text string. This constant is intentionally local to socket-frame.ts so the general JSON contract
 * is never silently redefined.
 */
const SOCKET_EVENT_JSON_DEPTH_MAX = 10;
const PLAIN_KEY = /^[a-z_]{1,32}$/u;
const OPAQUE_ID = /^[\x21-\x7e]{1,128}$/u;

/** Stable, secret-free frame rejection. Never includes source text, values, IDs, or provider data. */
function frameError(reason: string): DomainError {
  return new DomainError('INVALID_SCHEMA', reason);
}

interface Cursor {
  readonly s: string;
  pos: number;
}

function peek(c: Cursor): string {
  return c.pos < c.s.length ? c.s.charAt(c.pos) : '';
}

function expect(c: Cursor, ch: string): void {
  if (peek(c) !== ch) throw frameError('hello frame has an unexpected token');
  c.pos += 1;
}

function skipWs(c: Cursor): void {
  while (c.pos < c.s.length) {
    const ch = c.s.charAt(c.pos);
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') c.pos += 1;
    else break;
  }
}

/** Read a JSON string with NO escapes (escapes are rejected outright) and only printable ASCII bytes. */
function readPlainString(c: Cursor, maxLen: number): string {
  expect(c, '"');
  const start = c.pos;
  while (c.pos < c.s.length) {
    const ch = c.s.charAt(c.pos);
    if (ch === '"') {
      const value = c.s.slice(start, c.pos);
      c.pos += 1;
      if (value.length > maxLen) throw frameError('hello frame string exceeds its bound');
      return value;
    }
    if (ch === '\\') throw frameError('hello frame string contains an escape');
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code > 0x7e) throw frameError('hello frame string contains a non-printable byte');
    c.pos += 1;
    if (c.pos - start > maxLen) throw frameError('hello frame string exceeds its bound');
  }
  throw frameError('hello frame string is unterminated');
}

function readPlainKey(c: Cursor): string {
  const key = readPlainString(c, 32);
  if (!PLAIN_KEY.test(key)) throw frameError('hello frame key is not a plain identifier');
  return key;
}

/** Read a JSON nonnegative integer (no sign, fraction, exponent, or leading zero beyond a bare 0). */
function readNonNegInt(c: Cursor, maxDigits: number): number {
  const start = c.pos;
  while (c.pos < c.s.length && c.s.charAt(c.pos) >= '0' && c.s.charAt(c.pos) <= '9') c.pos += 1;
  const digits = c.s.slice(start, c.pos);
  if (digits.length === 0 || digits.length > maxDigits) throw frameError('hello frame integer is invalid');
  if (digits.length > 1 && digits.startsWith('0')) throw frameError('hello frame integer has a leading zero');
  const next = peek(c);
  if (next === '.' || next === 'e' || next === 'E') throw frameError('hello frame number is not an integer');
  return Number.parseInt(digits, 10);
}

function readConnectionInfo(c: Cursor): string {
  expect(c, '{');
  let appId: string | null = null;
  const seen = new Set<string>();
  let first = true;
  for (;;) {
    skipWs(c);
    if (peek(c) === '}') {
      c.pos += 1;
      break;
    }
    if (!first) {
      expect(c, ',');
      skipWs(c);
    }
    first = false;
    const key = readPlainKey(c);
    if (seen.has(key)) throw frameError('connection_info has a duplicate key');
    seen.add(key);
    skipWs(c);
    expect(c, ':');
    skipWs(c);
    if (key === 'app_id') {
      const value = readPlainString(c, 31);
      if (!APP_ID.test(value)) throw frameError('connection_info app_id is not a valid App-ID grammar');
      appId = value;
    } else {
      throw frameError('connection_info contains an unknown key');
    }
  }
  if (appId === null) throw frameError('connection_info is missing app_id');
  return appId;
}

function readDebugInfo(c: Cursor): void {
  expect(c, '{');
  const seen = new Set<string>();
  let first = true;
  for (;;) {
    skipWs(c);
    if (peek(c) === '}') {
      c.pos += 1;
      break;
    }
    if (!first) {
      expect(c, ',');
      skipWs(c);
    }
    first = false;
    const key = readPlainKey(c);
    if (seen.has(key)) throw frameError('debug_info has a duplicate key');
    seen.add(key);
    skipWs(c);
    expect(c, ':');
    skipWs(c);
    switch (key) {
      case 'host':
      case 'started':
        readPlainString(c, 256);
        break;
      case 'build_number':
      case 'approximate_connection_time':
        readNonNegInt(c, 20);
        break;
      default:
        throw frameError('debug_info contains an unknown key');
    }
  }
}

export interface As1HelloProof {
  readonly appId: string;
}

/** Parse the first raw frame under the exact hello grammar; return only the bounded App ID (design §7.6). */
export function parseHelloFrame(text: string): As1HelloProof {
  if (Buffer.byteLength(text, 'utf8') > LIMITS.RAW_SOCKET_ENVELOPE_MAX_BYTES) {
    throw frameError('hello frame exceeds the raw byte bound');
  }
  const c: Cursor = { s: text, pos: 0 };
  skipWs(c);
  expect(c, '{');
  const seen = new Set<string>();
  let appId: string | null = null;
  let first = true;
  for (;;) {
    skipWs(c);
    if (peek(c) === '}') {
      c.pos += 1;
      break;
    }
    if (!first) {
      expect(c, ',');
      skipWs(c);
    }
    first = false;
    const key = readPlainKey(c);
    if (seen.has(key)) throw frameError('hello frame has a duplicate key');
    seen.add(key);
    skipWs(c);
    expect(c, ':');
    skipWs(c);
    switch (key) {
      case 'type': {
        const value = readPlainString(c, 16);
        if (value !== 'hello') throw frameError('first frame is not a hello');
        break;
      }
      case 'connection_info':
        appId = readConnectionInfo(c);
        break;
      case 'num_connections':
        readNonNegInt(c, 12);
        break;
      case 'debug_info':
        readDebugInfo(c);
        break;
      default:
        throw frameError('hello frame contains an unknown key');
    }
  }
  skipWs(c);
  if (c.pos !== c.s.length) throw frameError('hello frame has trailing tokens');
  if (!seen.has('type')) throw frameError('hello frame is missing type');
  if (appId === null) throw frameError('hello frame is missing connection_info.app_id');
  return { appId };
}

// ── Post-proof events-api envelope guard (design §7.7) ────────────────────────
const ENVELOPE_OUTER_KEYS = ['type', 'envelope_id', 'accepts_response_payload', 'retry_attempt', 'retry_reason', 'payload'];

export interface As1ParsedEnvelope {
  readonly envelopeId: string;
  readonly retryAttempt: number | null;
  readonly retryReason: string | null;
  readonly acceptsResponsePayload: false;
  readonly callback: Record<string, unknown>;
}

/** Detect a bounded provider `disconnect` control object (transport control, never delivered to the app). */
export function isDisconnectFrame(value: unknown): boolean {
  return isRecord(value) && value.type === 'disconnect';
}

/**
 * Parse an already-App-proven text frame under the exact events-api outer contract. Uses general JSON.parse
 * (permitted only after identity proof) plus a bounded structural walk before any field access (design §7.7).
 */
export function parseEventsApiFrame(text: string): As1ParsedEnvelope {
  return parseEventsApiValue(parseTrustedJson(text));
}

/** JSON.parse a post-proof frame and enforce the bounded structural walk before any field access. */
export function parseTrustedJson(text: string): unknown {
  if (Buffer.byteLength(text, 'utf8') > LIMITS.RAW_SOCKET_ENVELOPE_MAX_BYTES) {
    throw frameError('event frame exceeds the raw byte bound');
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw frameError('event frame is not valid JSON');
  }
  assertSocketBoundedJsonStructure(value);
  return value;
}

/**
 * Socket-local bounded structural walk (R2 recovery design §3.2). Preserves every existing bound — JSON.stringify
 * of the parsed value at most 32,768 UTF-8 bytes, every array at most LIMITS.PARSED_ARRAY_MAX entries — and uses
 * the exact same counting convention as the shared walk (the outer value is depth 1; every object property or
 * array element, including a primitive leaf, advances depth by one). The ONLY difference from the shared walk is
 * the local depth ceiling of SOCKET_EVENT_JSON_DEPTH_MAX (10) instead of LIMITS.JSON_NESTING_DEPTH_MAX (8). Over
 * -depth, oversized arrays, and non-serializable values reject before any field access; no rejection includes raw
 * bytes, values, IDs, URLs, tokens, or provider text.
 */
/**
 * The metadata/content subtree of a valid Slack message's `payload.event.files` is IGNORED by the bounded structural
 * walk (amendment: files-bearing text frame). The pilot is text-only, so attachment metadata must not trip the local
 * depth / array bounds; the RAW envelope byte bound already caps the whole frame (files included) and every outer/event
 * identity validation is unchanged, so the bounded `event.text` still reaches the text-only intake exactly once and no
 * file content is ever downloaded, interpreted, copied, logged, or routed. Only an exact `payload.event.files` key is
 * dropped from the validation-only copy; any other shape (malformed/oversize/over-depth outside files) stays fail-closed.
 */
function withIgnoredFilesSubtree(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const payload = value.payload;
  if (!isRecord(payload)) return value;
  const event = payload.event;
  if (!isRecord(event) || !('files' in event)) return value;
  const eventWithoutFiles: Record<string, unknown> = {};
  for (const key of Object.keys(event)) {
    if (key !== 'files') eventWithoutFiles[key] = event[key];
  }
  return { ...value, payload: { ...payload, event: eventWithoutFiles } };
}

function assertSocketBoundedJsonStructure(value: unknown): void {
  // Validate a copy whose ignored `payload.event.files` subtree is dropped; the RAW byte bound (parseTrustedJson) still
  // caps the whole incoming frame, so attachment metadata cannot bypass the total size limit.
  const validated = withIgnoredFilesSubtree(value);
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(validated);
  } catch {
    throw frameError('event frame is not serializable JSON');
  }
  if (typeof serialized !== 'string' || Buffer.byteLength(serialized, 'utf8') > LIMITS.RAW_SOCKET_ENVELOPE_MAX_BYTES) {
    throw frameError('event frame exceeds its bounded byte size');
  }
  walkSocketBoundedJson(validated, 1);
}

function walkSocketBoundedJson(value: unknown, depth: number): void {
  if (depth > SOCKET_EVENT_JSON_DEPTH_MAX) {
    throw frameError('event frame exceeds the maximum Socket event JSON nesting depth');
  }
  if (Array.isArray(value)) {
    if (value.length > LIMITS.PARSED_ARRAY_MAX) {
      throw frameError('event frame array exceeds the maximum entry count');
    }
    for (const item of value) walkSocketBoundedJson(item, depth + 1);
  } else if (isRecord(value)) {
    for (const key of Object.keys(value)) walkSocketBoundedJson(value[key], depth + 1);
  }
}

/** Validate an already-parsed, already-bounded value under the exact events-api outer contract. */
export function parseEventsApiValue(value: unknown): As1ParsedEnvelope {
  assertRecord(value, 'event frame');
  for (const key of Object.keys(value)) {
    if (!ENVELOPE_OUTER_KEYS.includes(key)) throw frameError('event frame contains an unknown outer key');
  }
  if (value.type !== 'events_api') throw frameError('event frame type is not events_api');
  const envelopeId = value.envelope_id;
  if (typeof envelopeId !== 'string' || !OPAQUE_ID.test(envelopeId)) {
    throw frameError('event frame envelope_id is not a bounded opaque id');
  }
  if (!('accepts_response_payload' in value)) {
    // absent is permitted
  } else if (value.accepts_response_payload !== false) {
    throw frameError('event frame accepts_response_payload must be absent or false');
  }
  let retryAttempt: number | null = null;
  if ('retry_attempt' in value) {
    const raw = value.retry_attempt;
    if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < 0 || raw > 64) {
      throw frameError('event frame retry_attempt is out of bounds');
    }
    retryAttempt = raw;
  }
  let retryReason: string | null = null;
  if ('retry_reason' in value) {
    const raw = value.retry_reason;
    if (typeof raw !== 'string' || raw.length > 256) throw frameError('event frame retry_reason is out of bounds');
    retryReason = raw;
  }
  const callback = value.payload;
  // Strict narrowing (no post-check cast): assertRecord both validates and narrows to Record<string, unknown>.
  if (!isRecord(callback)) {
    throw frameError('event frame payload is not a callback object');
  }
  return {
    envelopeId,
    retryAttempt,
    retryReason,
    acceptsResponsePayload: false,
    callback,
  };
}
