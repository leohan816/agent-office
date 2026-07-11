import { describe, expect, it } from 'vitest';

import {
  InMemoryRateLimiter,
  RATE_LIMIT_POLICIES,
} from '../../src/server/index.js';

describe('single-instance bounded rate policies', () => {
  it('enforces the five-attempt bootstrap lockout and message burst', () => {
    const now = Date.parse('2026-07-10T00:00:00.000Z');
    const limiter = new InMemoryRateLimiter();
    for (let index = 0; index < 5; index += 1) {
      expect(limiter.consume('127.0.0.1', RATE_LIMIT_POLICIES.bootstrapExchange, now).allowed).toBe(true);
    }
    const bootstrapDenied = limiter.consume('127.0.0.1', RATE_LIMIT_POLICIES.bootstrapExchange, now);
    expect(bootstrapDenied.allowed).toBe(false);
    expect(bootstrapDenied.retryAfterSeconds).toBeGreaterThanOrEqual(60);

    for (let index = 0; index < 5; index += 1) {
      expect(limiter.consume('subject', RATE_LIMIT_POLICIES.advisorMessage, now).allowed).toBe(true);
    }
    expect(limiter.consume('subject', RATE_LIMIT_POLICIES.advisorMessage, now)).toMatchObject({
      allowed: false,
      retryAfterSeconds: 6,
    });
  });

  it('keeps independent subject/policy buckets and exact minute windows', () => {
    const now = Date.parse('2026-07-10T00:00:00.000Z');
    const limiter = new InMemoryRateLimiter();
    for (let index = 0; index < 30; index += 1) {
      expect(limiter.consume('advisor', RATE_LIMIT_POLICIES.mutation, now).allowed).toBe(true);
    }
    expect(limiter.consume('advisor', RATE_LIMIT_POLICIES.mutation, now).allowed).toBe(false);
    expect(limiter.consume('other-advisor', RATE_LIMIT_POLICIES.mutation, now).allowed).toBe(true);
    for (let index = 0; index < 120; index += 1) {
      expect(limiter.consume('advisor', RATE_LIMIT_POLICIES.read, now).allowed).toBe(true);
    }
    expect(limiter.consume('advisor', RATE_LIMIT_POLICIES.read, now).allowed).toBe(false);
    expect(limiter.consume('advisor', RATE_LIMIT_POLICIES.read, now + 60_000).allowed).toBe(true);
  });
});
