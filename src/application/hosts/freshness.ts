import { ObservationError, type ObservationErrorCode } from '../../adapters/observations/errors.js';

export const FRESHNESS_STATUSES = ['CURRENT', 'STALE', 'OFFLINE', 'UNKNOWN'] as const;
export type FreshnessStatus = (typeof FRESHNESS_STATUSES)[number];

export const OBSERVATION_PRESENTATIONS = [
  ...FRESHNESS_STATUSES,
  'CONFLICT',
  'ERROR',
] as const;
export type ObservationPresentation = (typeof OBSERVATION_PRESENTATIONS)[number];

export interface FreshnessPolicy {
  readonly policyId: string;
  readonly staleAfterMs: number;
  readonly offlineAfterMs: number;
}

export interface ObservationClock {
  readonly sourceTime?: string;
  readonly receivedTime?: string;
  readonly clockQuality: 'VERIFIED_LOCAL' | 'DEGRADED' | 'UNKNOWN';
}

export interface FreshnessEvaluation {
  readonly policyId: string;
  readonly freshness: FreshnessStatus;
  readonly presentation: ObservationPresentation;
  readonly evaluatedAt: string;
  readonly ageMs?: number;
  readonly reasonCode: string;
}

export interface StoredObservation<T> {
  readonly observationId: string;
  readonly sourceId: string;
  readonly projectId: string;
  readonly hostId: string;
  readonly sourceTime: string;
  readonly receivedTime: string;
  readonly policyId: string;
  readonly evidenceRef: string;
  readonly value: T;
  readonly conflictCode?: string;
  readonly errorCode?: ObservationErrorCode;
}

export function evaluateFreshness(
  clock: ObservationClock,
  evaluatedAt: string,
  policy: FreshnessPolicy,
  condition: { readonly conflictCode?: string; readonly errorCode?: ObservationErrorCode } = {},
): FreshnessEvaluation {
  validatePolicy(policy);
  const evaluatedMs = Date.parse(evaluatedAt);
  const sourceMs = clock.sourceTime === undefined ? Number.NaN : Date.parse(clock.sourceTime);
  const receivedMs = clock.receivedTime === undefined ? Number.NaN : Date.parse(clock.receivedTime);
  if (!Number.isFinite(evaluatedMs)) {
    throw new ObservationError('CONFIG_INVALID', 'freshness evaluation time is invalid');
  }
  if (condition.conflictCode !== undefined) {
    return {
      policyId: policy.policyId,
      freshness: 'UNKNOWN',
      presentation: 'CONFLICT',
      evaluatedAt,
      reasonCode: condition.conflictCode,
    };
  }
  if (condition.errorCode !== undefined) {
    return {
      policyId: policy.policyId,
      freshness: 'UNKNOWN',
      presentation: 'ERROR',
      evaluatedAt,
      reasonCode: condition.errorCode,
    };
  }
  if (
    clock.clockQuality === 'UNKNOWN' ||
    !Number.isFinite(sourceMs) ||
    !Number.isFinite(receivedMs) ||
    sourceMs > receivedMs ||
    receivedMs > evaluatedMs
  ) {
    return {
      policyId: policy.policyId,
      freshness: 'UNKNOWN',
      presentation: 'UNKNOWN',
      evaluatedAt,
      reasonCode: 'CLOCK_OR_RECEIPT_UNKNOWN',
    };
  }
  const ageMs = Math.max(0, evaluatedMs - sourceMs);
  if (ageMs <= policy.staleAfterMs) {
    return {
      policyId: policy.policyId,
      freshness: 'CURRENT',
      presentation: 'CURRENT',
      evaluatedAt,
      ageMs,
      reasonCode: 'WITHIN_CURRENT_WINDOW',
    };
  }
  if (ageMs <= policy.offlineAfterMs) {
    return {
      policyId: policy.policyId,
      freshness: 'STALE',
      presentation: 'STALE',
      evaluatedAt,
      ageMs,
      reasonCode: 'STALE_WINDOW_EXCEEDED',
    };
  }
  return {
    policyId: policy.policyId,
    freshness: 'OFFLINE',
    presentation: 'OFFLINE',
    evaluatedAt,
    ageMs,
    reasonCode: 'OFFLINE_WINDOW_EXCEEDED',
  };
}

export function canSatisfyCompletion(
  freshness: FreshnessEvaluation,
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'STALE' | 'DIRTY' | 'INVALID' | 'MISSING',
): boolean {
  return freshness.presentation === 'CURRENT' && verificationStatus === 'VERIFIED';
}

export class LocalObservationSnapshot<T> {
  readonly #records = new Map<string, StoredObservation<T>>();

  public constructor(records: readonly StoredObservation<T>[] = []) {
    for (const record of records) this.accept(record);
  }

  public accept(record: StoredObservation<T>): void {
    const current = this.#records.get(record.observationId);
    if (current !== undefined && current.receivedTime > record.receivedTime) return;
    this.#records.set(record.observationId, record);
  }

  public get(observationId: string): StoredObservation<T> | undefined {
    return this.#records.get(observationId);
  }

  public exportForRestart(): readonly StoredObservation<T>[] {
    return [...this.#records.values()].sort((left, right) =>
      left.observationId.localeCompare(right.observationId),
    );
  }
}

function validatePolicy(policy: FreshnessPolicy): void {
  if (
    policy.policyId.length === 0 ||
    !Number.isSafeInteger(policy.staleAfterMs) ||
    !Number.isSafeInteger(policy.offlineAfterMs) ||
    policy.staleAfterMs < 0 ||
    policy.offlineAfterMs <= policy.staleAfterMs
  ) {
    throw new ObservationError('CONFIG_INVALID', 'freshness policy windows are invalid');
  }
}
