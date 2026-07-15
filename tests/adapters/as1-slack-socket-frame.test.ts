import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import {
  isDisconnectFrame,
  parseEventsApiValue,
  parseTrustedJson,
} from '../../src/adapters/gateways/slack-pilot/socket-frame.js';

// E (review B08) — the raw Socket frame parser's EXACT outer/depth/array/raw-byte/retry limits, each fail-closed.
const validValue = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  type: 'events_api',
  envelope_id: 'Env0AGENTOFFICE1',
  payload: { type: 'event_callback' },
  ...over,
});

describe('AS1 socket frame parser — exact limits (B08)', () => {
  it('parses a bounded valid events_api frame', () => {
    const parsed = parseEventsApiValue(validValue());
    expect(parsed.envelopeId).toBe('Env0AGENTOFFICE1');
    expect(parsed.retryAttempt).toBeNull();
    expect(parsed.retryReason).toBeNull();
    expect(parsed.acceptsResponsePayload).toBe(false);
  });

  it('rejects an unknown outer key, a non-events_api type, and a malformed envelope id', () => {
    expect(() => parseEventsApiValue(validValue({ injected: 'x' }))).toThrow(DomainError);
    expect(() => parseEventsApiValue(validValue({ type: 'hello' }))).toThrow(DomainError);
    expect(() => parseEventsApiValue(validValue({ envelope_id: '' }))).toThrow(DomainError);
  });

  it('rejects accepts_response_payload true (absent or false only)', () => {
    expect(() => parseEventsApiValue(validValue({ accepts_response_payload: true }))).toThrow(DomainError);
    expect(parseEventsApiValue(validValue({ accepts_response_payload: false })).acceptsResponsePayload).toBe(false);
  });

  it('rejects retry_attempt out of bounds and accepts an in-range value', () => {
    for (const bad of [65, -1, 1.5, 'x'] as const) {
      expect(() => parseEventsApiValue(validValue({ retry_attempt: bad })), String(bad)).toThrow(DomainError);
    }
    expect(parseEventsApiValue(validValue({ retry_attempt: 3 })).retryAttempt).toBe(3);
  });

  it('rejects an oversize retry_reason', () => {
    expect(() => parseEventsApiValue(validValue({ retry_reason: 'x'.repeat(257) }))).toThrow(DomainError);
    expect(parseEventsApiValue(validValue({ retry_reason: 'refresh' })).retryReason).toBe('refresh');
  });

  it('rejects a non-object payload', () => {
    expect(() => parseEventsApiValue(validValue({ payload: [] }))).toThrow(DomainError);
    expect(() => parseEventsApiValue(validValue({ payload: 'x' }))).toThrow(DomainError);
    expect(() => parseEventsApiValue(validValue({ payload: null }))).toThrow(DomainError);
  });

  it('rejects an oversize raw frame, excessive nesting depth, and an oversize array', () => {
    // Raw byte bound (RAW_SOCKET_ENVELOPE_MAX_BYTES = 32_768).
    const oversize = JSON.stringify({ type: 'events_api', envelope_id: 'E', payload: { blob: 'x'.repeat(40_000) } });
    expect(() => parseTrustedJson(oversize)).toThrow(DomainError);
    // Nesting depth bound (JSON_NESTING_DEPTH_MAX = 8).
    let nested: unknown = 0;
    for (let i = 0; i < 12; i += 1) nested = { n: nested };
    expect(() => parseTrustedJson(JSON.stringify(nested))).toThrow(DomainError);
    // Per-array entry bound (PARSED_ARRAY_MAX = 16).
    expect(() => parseTrustedJson(JSON.stringify({ a: Array.from({ length: 20 }, (_v, i) => i) }))).toThrow(DomainError);
  });

  it('classifies a disconnect frame by its type only', () => {
    expect(isDisconnectFrame({ type: 'disconnect', reason: 'refresh_requested' })).toBe(true);
    expect(isDisconnectFrame({ type: 'events_api' })).toBe(false);
    expect(isDisconnectFrame(null)).toBe(false);
    expect(isDisconnectFrame([{ type: 'disconnect' }])).toBe(false);
  });
});
