import { describe, expect, it } from 'vitest';

import { assessStartupReadiness, type StartupReadinessInput } from '../../src/operations/index.js';
import { FIXED_TIME } from '../helpers/fixtures.js';

const READY: StartupReadinessInput = {
  configValidated: true,
  writerLock: 'ACQUIRED',
  store: 'VERIFIED',
  projection: 'VERIFIED',
  authentication: 'TEST_READY',
  mutationConfigured: true,
  delivery: 'DISABLED',
  sse: 'READY',
  projectionRevision: 12,
  lastVerifiedAt: FIXED_TIME,
};

describe('startup readiness fail-closed classification', () => {
  it('enables mutation only for the explicit guarded test-auth path', () => {
    expect(assessStartupReadiness(READY)).toMatchObject({
      startupState: 'MUTATION_READY',
      authMode: 'TEST_ONLY',
      mutationMode: 'ENABLED_TEST_ONLY',
      networkMode: 'LOOPBACK_PRIVATE',
    });
    expect(assessStartupReadiness({
      ...READY,
      authentication: 'UNAVAILABLE',
    })).toMatchObject({
      startupState: 'AUTH_BLOCKED',
      authMode: 'UNAVAILABLE_READ_ONLY',
      mutationMode: 'DISABLED',
    });
  });

  it('makes config, lock, quarantine, replay, stale projection, and SSE degradation visible', () => {
    expect(assessStartupReadiness({ ...READY, configValidated: false }).startupState).toBe('CONFIG_BLOCKED');
    expect(assessStartupReadiness({ ...READY, writerLock: 'CONFLICT' }).startupState).toBe('SECOND_WRITER_BLOCKED');
    expect(assessStartupReadiness({ ...READY, store: 'QUARANTINED' }).startupState).toBe('STORE_QUARANTINED');
    expect(assessStartupReadiness({ ...READY, projection: 'REPLAY_FAILED' }).startupState).toBe('REPLAY_FAILED');
    expect(assessStartupReadiness({ ...READY, projection: 'STALE' }).startupState).toBe('READ_ONLY_DEGRADED');
    expect(assessStartupReadiness({ ...READY, sse: 'DEGRADED' })).toMatchObject({
      sseMode: 'DEGRADED',
      deliveryMode: 'DISABLED',
    });
  });
});
