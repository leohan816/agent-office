import { DomainError } from '../../contracts/types.js';
import { assertUtcTimestamp } from '../../domain/time/index.js';
import type { LocalRuntimeStatus } from '../../server/application.js';

export type StoreReadiness = 'VERIFIED' | 'UNAVAILABLE' | 'QUARANTINED';
export type ProjectionReadiness = 'VERIFIED' | 'STALE' | 'REPLAY_FAILED';
export type AuthenticationReadiness = 'LOCAL_BOOTSTRAP_READY' | 'TEST_READY' | 'UNAVAILABLE';

export interface StartupReadinessInput {
  readonly configValidated: boolean;
  readonly writerLock: 'ACQUIRED' | 'CONFLICT';
  readonly store: StoreReadiness;
  readonly projection: ProjectionReadiness;
  readonly authentication: AuthenticationReadiness;
  readonly mutationConfigured: boolean;
  readonly delivery: 'ENABLED' | 'DISABLED' | 'MANUAL_FALLBACK_REQUIRED';
  readonly sse: 'READY' | 'DEGRADED';
  readonly projectionRevision: number;
  readonly lastVerifiedAt: string;
}

export function assessStartupReadiness(input: StartupReadinessInput): LocalRuntimeStatus {
  assertUtcTimestamp(input.lastVerifiedAt, 'readiness verification time');
  if (!Number.isSafeInteger(input.projectionRevision) || input.projectionRevision < 0) {
    throw new DomainError('INVALID_SCHEMA', 'projection revision is invalid');
  }
  const startupState = classifyStartup(input);
  const mutationReady = startupState === 'MUTATION_READY';
  return {
    schemaVersion: 'agent-office.local-runtime-status.v1',
    networkMode: 'LOOPBACK_PRIVATE',
    startupState,
    authMode: input.authentication === 'LOCAL_BOOTSTRAP_READY'
      ? 'LOCAL_BOOTSTRAP'
      : input.authentication === 'TEST_READY'
        ? 'TEST_ONLY'
        : 'UNAVAILABLE_READ_ONLY',
    mutationMode: mutationReady
      ? input.authentication === 'LOCAL_BOOTSTRAP_READY'
        ? 'ENABLED_LOCAL_BOOTSTRAP'
        : 'ENABLED_TEST_ONLY'
      : 'DISABLED',
    deliveryMode: input.delivery,
    sseMode: input.sse,
    projectionRevision: input.projectionRevision,
    lastVerifiedAt: input.lastVerifiedAt,
  };
}

function classifyStartup(input: StartupReadinessInput): LocalRuntimeStatus['startupState'] {
  if (!input.configValidated) return 'CONFIG_BLOCKED';
  if (input.writerLock === 'CONFLICT') return 'SECOND_WRITER_BLOCKED';
  if (input.store === 'QUARANTINED' || input.store === 'UNAVAILABLE') {
    return 'STORE_QUARANTINED';
  }
  if (input.projection === 'REPLAY_FAILED') return 'REPLAY_FAILED';
  if (input.projection === 'STALE') return 'READ_ONLY_DEGRADED';
  if (input.authentication === 'UNAVAILABLE') return 'AUTH_BLOCKED';
  return input.mutationConfigured ? 'MUTATION_READY' : 'READ_ONLY_READY';
}
