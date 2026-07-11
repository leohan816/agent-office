import { HttpBoundaryError } from '../http/errors.js';

export interface RateLimitPolicy {
  readonly id: string;
  readonly capacity: number;
  readonly refillPerMinute: number;
  readonly windows: readonly {
    readonly limit: number;
    readonly durationMs: number;
  }[];
  readonly lockoutMs?: number;
}

export const RATE_LIMIT_POLICIES = {
  bootstrapExchange: {
    id: 'BOOTSTRAP_EXCHANGE',
    capacity: 5,
    refillPerMinute: 1 / 3,
    windows: [{ limit: 5, durationMs: 15 * 60_000 }],
    lockoutMs: 60_000,
  },
  advisorMessage: {
    id: 'ADVISOR_MESSAGE',
    capacity: 5,
    refillPerMinute: 10,
    windows: [
      { limit: 10, durationMs: 60_000 },
      { limit: 60, durationMs: 60 * 60_000 },
    ],
  },
  mutation: {
    id: 'MUTATION',
    capacity: 30,
    refillPerMinute: 30,
    windows: [{ limit: 30, durationMs: 60_000 }],
  },
  read: {
    id: 'READ',
    capacity: 120,
    refillPerMinute: 120,
    windows: [{ limit: 120, durationMs: 60_000 }],
  },
  sseAttempt: {
    id: 'SSE_ATTEMPT',
    capacity: 6,
    refillPerMinute: 6,
    windows: [{ limit: 6, durationMs: 60_000 }],
  },
} as const satisfies Record<string, RateLimitPolicy>;

interface RateState {
  tokens: number;
  updatedAt: number;
  attempts: number[];
  lockedUntil?: number;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

export class InMemoryRateLimiter {
  private readonly states = new Map<string, RateState>();

  public consume(key: string, policy: RateLimitPolicy, nowMs: number): RateLimitDecision {
    if (!Number.isFinite(nowMs) || key.length === 0) {
      throw new HttpBoundaryError('RATE_LIMITED', 429, 'rate-limit input is invalid', 1);
    }
    const stateKey = `${policy.id}:${key}`;
    const state = this.states.get(stateKey) ?? {
      tokens: policy.capacity,
      updatedAt: nowMs,
      attempts: [],
    };
    const elapsed = Math.max(0, nowMs - state.updatedAt);
    state.tokens = Math.min(
      policy.capacity,
      state.tokens + elapsed * (policy.refillPerMinute / 60_000),
    );
    state.updatedAt = nowMs;
    const longestWindow = Math.max(...policy.windows.map((window) => window.durationMs));
    state.attempts = state.attempts.filter((attempt) => attempt > nowMs - longestWindow);

    let retryAt = state.lockedUntil ?? 0;
    for (const window of policy.windows) {
      const attempts = state.attempts.filter((attempt) => attempt > nowMs - window.durationMs);
      if (attempts.length >= window.limit) {
        retryAt = Math.max(retryAt, (attempts.at(0) ?? nowMs) + window.durationMs);
      }
    }
    if (state.tokens < 1) {
      const refillMs = (1 - state.tokens) / (policy.refillPerMinute / 60_000);
      retryAt = Math.max(retryAt, nowMs + refillMs);
    }
    if (retryAt > nowMs) {
      if (policy.lockoutMs !== undefined) {
        state.lockedUntil = Math.max(retryAt, nowMs + policy.lockoutMs);
        retryAt = state.lockedUntil;
      }
      this.states.set(stateKey, state);
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((retryAt - nowMs) / 1000)) };
    }
    state.tokens -= 1;
    state.attempts.push(nowMs);
    Reflect.deleteProperty(state, 'lockedUntil');
    this.states.set(stateKey, state);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  public require(key: string, policy: RateLimitPolicy, nowMs: number): void {
    const decision = this.consume(key, policy, nowMs);
    if (!decision.allowed) {
      throw new HttpBoundaryError(
        'RATE_LIMITED',
        429,
        'request rate limit was exceeded',
        decision.retryAfterSeconds,
      );
    }
  }
}
