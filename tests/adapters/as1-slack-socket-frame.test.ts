import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { LIMITS, assertBoundedJsonStructure } from '../../src/application/slack-pilot/contracts.js';
import {
  isDisconnectFrame,
  parseEventsApiFrame,
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

// Files-bearing Slack text frame (amendment): the metadata/content subtree of payload.event.files is IGNORED by the
// bounded structural walk so the bounded event.text reaches the text-only intake exactly once; the raw byte bound and
// all outer/event identity validation stay fail-closed, and no file content is interpreted/copied/routed.
describe('AS1 socket frame parser — files-bearing text frame (ignored attachment subtree)', () => {
  const filesBearingText = (eventOver: Record<string, unknown> = {}, files?: unknown): string =>
    JSON.stringify({
      type: 'events_api',
      envelope_id: 'Env0AGENTOFFICE1',
      payload: {
        type: 'event_callback',
        event: {
          type: 'message',
          text: 'please start a new mission',
          files: files ?? Array.from({ length: 20 }, (_v, i) => ({ id: `F${String(i)}`, mode: 'hosted', name: 'attachment', filetype: 'png' })),
          ...eventOver,
        },
      },
    });

  it('ignores the files subtree that would otherwise exceed the array bound and preserves event.text exactly once', () => {
    // 20 files > PARSED_ARRAY_MAX (16): the walk would reject this frame WITHOUT the ignore. Dropping payload.event.files
    // from the validation copy lets the bounded event.text reach the text-only intake unchanged (files are ignored, not
    // interpreted or removed from the returned callback).
    const frame = filesBearingText();
    expect(() => parseTrustedJson(frame)).not.toThrow();
    const parsed = parseEventsApiFrame(frame);
    expect(parsed.envelopeId).toBe('Env0AGENTOFFICE1');
    const event = parsed.callback.event as { readonly text?: unknown };
    expect(event.text).toBe('please start a new mission');
  });

  it('still delivers an ordinary text message with no files subtree unchanged', () => {
    const ordinary = JSON.stringify({
      type: 'events_api',
      envelope_id: 'Env0AGENTOFFICE1',
      payload: { type: 'event_callback', event: { type: 'message', text: 'hello there' } },
    });
    const parsed = parseEventsApiFrame(ordinary);
    const event = parsed.callback.event as { readonly text?: unknown };
    expect(event.text).toBe('hello there');
  });

  it('keeps a files-bearing frame fail-closed on raw oversize, malformed JSON, or an invalid outer envelope', () => {
    // The RAW envelope byte bound still caps the WHOLE frame (files included) — attachments cannot smuggle past 32_768 B.
    const oversize = filesBearingText({}, [{ id: 'F0', blob: 'x'.repeat(40_000) }]);
    expect(() => parseTrustedJson(oversize)).toThrow(DomainError);
    // Malformed JSON stays rejected.
    expect(() => parseTrustedJson(`${filesBearingText()}{`)).toThrow(DomainError);
    // An invalid outer envelope (empty envelope_id) stays rejected even with an otherwise-ignored valid files subtree.
    const badOuter = JSON.stringify({
      type: 'events_api',
      envelope_id: '',
      payload: { type: 'event_callback', event: { type: 'message', text: 'hi', files: [{ id: 'F0' }] } },
    });
    expect(() => parseEventsApiFrame(badOuter)).toThrow(DomainError);
  });
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
    // Socket-local nesting depth bound (SOCKET_EVENT_JSON_DEPTH_MAX = 10): a 12-wrap value is depth 13 and rejects.
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

// R2 recovery design §3: the post-hello Socket structural walk is depth 10 (not the shared 8) so an ordinary plain
// rich-text message reaches its inline text primitive at depth 10; the one-level-over depth-11 mutation fails closed.
// The exact accepted §3.3 fixture and the §3.4 reject fixture differ only in the single inline text element.
const richTextFrame = (inlineTextElement: Record<string, unknown>): string =>
  JSON.stringify({
    type: 'events_api',
    envelope_id: 'Env0AGENTOFFICE01',
    accepts_response_payload: false,
    payload: {
      type: 'event_callback',
      team_id: 'TWORKSPACE001',
      api_app_id: 'AAGENTOFFICE01',
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
        // Events API outer=1 · payload=2 · event=3 · blocks[]=4 · rich_text=5 · elements[]=6 · rich_text_section=7 ·
        // elements[]=8 · inline text element=9 · (its "text" primitive)=10.
        blocks: [
          {
            type: 'rich_text',
            block_id: 'b1',
            elements: [{ type: 'rich_text_section', elements: [inlineTextElement] }],
          },
        ],
      },
    },
  });

// The inline text element's "text" primitive is at depth 10 — the maximum accepted path.
const ACCEPTED_INLINE_TEXT = { type: 'text', text: 'please start a new mission' } as const;
// One level over: the "unexpected" object is depth 10 and its "leaf" primitive is depth 11 — reject before field access.
const DEPTH_11_INLINE_TEXT = { type: 'text', text: 'please start a new mission', unexpected: { leaf: true } } as const;

describe('AS1 socket frame parser — R2 Socket-local depth 10 (design §3)', () => {
  it('accepts the exact ordinary rich-text frame whose inline text primitive is at depth 10', () => {
    expect(() => parseTrustedJson(richTextFrame(ACCEPTED_INLINE_TEXT))).not.toThrow();
    const parsed = parseEventsApiFrame(richTextFrame(ACCEPTED_INLINE_TEXT));
    expect(parsed.envelopeId).toBe('Env0AGENTOFFICE01');
    expect(parsed.acceptsResponsePayload).toBe(false);
  });

  it('rejects the one-level-over depth-11 mutation before field access, with a non-payload INVALID_SCHEMA detail', () => {
    let thrown: unknown;
    try {
      parseTrustedJson(richTextFrame(DEPTH_11_INLINE_TEXT));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(DomainError);
    expect((thrown as DomainError).code).toBe('INVALID_SCHEMA');
    // The stable detail never echoes raw bytes/values/IDs from the rejected frame.
    expect((thrown as DomainError).message).not.toContain('please start a new mission');
    expect(() => parseEventsApiFrame(richTextFrame(DEPTH_11_INLINE_TEXT))).toThrow(DomainError);
  });

  it('keeps the shared general JSON nesting depth at exactly 8', () => {
    expect(LIMITS.JSON_NESTING_DEPTH_MAX).toBe(8);
    // A depth-9 leaf still rejects through the unchanged shared walk (outer=1 … the 0 leaf=9).
    const depth9 = { d2: { d3: { d4: { d5: { d6: { d7: { d8: { d9: 0 } } } } } } } };
    expect(() => assertBoundedJsonStructure(depth9, 'general value')).toThrow(DomainError);
    // Depth 8 (the 0 leaf at depth 8) is still accepted by the shared walk.
    const depth8 = { d2: { d3: { d4: { d5: { d6: { d7: { d8: 0 } } } } } } };
    expect(() => assertBoundedJsonStructure(depth8, 'general value')).not.toThrow();
  });
});
