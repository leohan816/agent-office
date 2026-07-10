import { DomainError } from '../../contracts/types.js';
import type { WorkUnitState } from '../state-machines/work-unit.js';
import { assertUtcTimestamp, assertUuidV7 } from '../time/index.js';

export const ROLE_ACTIVITIES = [
  'IDLE',
  'DELIVERY',
  'READING',
  'WORKING',
  'TESTING',
  'REVIEW',
  'WRITING_RESULT',
  'BLOCKED',
  'WAITING_LEO',
  'RESULT_RETURN',
  'RECOVERY',
] as const;

export type RoleActivity = (typeof ROLE_ACTIVITIES)[number];

export const REQUIRED_OBSERVABLE_NAMES = [
  'QUEUED',
  'READY',
  'DISPATCHING',
  'READING',
  'WORKING',
  'TESTING',
  'WRITING_RESULT',
  'RETURNING_RESULT',
  'REVIEWING',
  'NEEDS_PATCH',
  'WAITING_DEPENDENCY',
  'WAITING_LEO',
  'BLOCKED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;

export type RequiredObservableName = (typeof REQUIRED_OBSERVABLE_NAMES)[number];
export type ObservableProjectionName = RequiredObservableName | 'UNKNOWN_OR_STALE';

export interface CurrentActivity {
  readonly activity: RoleActivity;
  readonly reasonCode: string;
  readonly sourceEventIds: readonly string[];
  readonly effectiveFrom: string;
  readonly optionalExpiresAt?: string;
}

export interface ObservableProjection {
  readonly requiredObservableName: ObservableProjectionName;
  readonly primaryState: WorkUnitState;
  readonly activity?: RoleActivity;
  readonly freshness: 'CURRENT' | 'UNKNOWN_OR_STALE';
}

export function isActivityCompatible(
  primaryState: WorkUnitState,
  current: CurrentActivity,
): boolean {
  const { activity, reasonCode } = current;
  switch (activity) {
    case 'IDLE':
      return true;
    case 'DELIVERY':
      return primaryState === 'DISPATCHED' && reasonCode === 'WORKUNIT_DISPATCH';
    case 'READING':
      return primaryState === 'DISPATCHED' || primaryState === 'RUNNING';
    case 'WORKING':
      return primaryState === 'RUNNING';
    case 'TESTING':
      return primaryState === 'TESTING';
    case 'REVIEW':
      return primaryState === 'REVIEW_PENDING';
    case 'WRITING_RESULT':
      return (
        (primaryState === 'RUNNING' || primaryState === 'TESTING') &&
        reasonCode === 'RESULT_DRAFT_STARTED'
      );
    case 'BLOCKED':
      return primaryState === 'BLOCKED';
    case 'WAITING_LEO':
      return primaryState === 'WAITING_LEO';
    case 'RESULT_RETURN':
      return primaryState === 'RESULT_REPORTED';
    case 'RECOVERY':
      return true;
  }
}

export function assertActivityCompatible(
  primaryState: WorkUnitState,
  current: CurrentActivity,
): void {
  assertUtcTimestamp(current.effectiveFrom, 'activity effectiveFrom');
  if (current.optionalExpiresAt !== undefined) {
    assertUtcTimestamp(current.optionalExpiresAt, 'activity optionalExpiresAt');
    if (current.optionalExpiresAt <= current.effectiveFrom) {
      throw new DomainError('INVALID_SCHEMA', 'activity expiry must be after its effective time');
    }
  }
  if (current.sourceEventIds.length === 0) {
    throw new DomainError('EVIDENCE_MISSING_OR_STALE', 'activity requires a structured source event');
  }
  for (const sourceEventId of current.sourceEventIds) assertUuidV7(sourceEventId, 'activity sourceEventId');
  if (!isActivityCompatible(primaryState, current)) {
    throw new DomainError(
      'INVALID_TRANSITION',
      `${current.activity} is incompatible with primary state ${primaryState}`,
    );
  }
}

export function projectRequiredObservable(
  primaryState: WorkUnitState,
  current?: CurrentActivity,
  evaluatedAt?: string,
): ObservableProjection {
  const expired =
    current?.optionalExpiresAt !== undefined &&
    evaluatedAt !== undefined &&
    current.optionalExpiresAt <= evaluatedAt;
  const compatible = current === undefined || isActivityCompatible(primaryState, current);
  const usable = current !== undefined && !expired && compatible ? current : undefined;

  if (current !== undefined && !compatible) {
    return {
      requiredObservableName: 'UNKNOWN_OR_STALE',
      primaryState,
      activity: current.activity,
      freshness: 'UNKNOWN_OR_STALE',
    };
  }

  const derived = deriveObservable(primaryState, usable);
  if (derived === 'UNKNOWN_OR_STALE') {
    return {
      requiredObservableName: derived,
      primaryState,
      ...(usable === undefined ? {} : { activity: usable.activity }),
      freshness: 'UNKNOWN_OR_STALE',
    };
  }
  return {
    requiredObservableName: derived,
    primaryState,
    ...(usable === undefined ? {} : { activity: usable.activity }),
    freshness: 'CURRENT',
  };
}

function deriveObservable(
  primaryState: WorkUnitState,
  current?: CurrentActivity,
): ObservableProjectionName {
  if (current !== undefined) {
    switch (current.activity) {
      case 'DELIVERY':
        return 'DISPATCHING';
      case 'READING':
        return 'READING';
      case 'WORKING':
        return 'WORKING';
      case 'TESTING':
        return 'TESTING';
      case 'WRITING_RESULT':
        return 'WRITING_RESULT';
      case 'RESULT_RETURN':
        return 'RETURNING_RESULT';
      case 'REVIEW':
        return 'REVIEWING';
      case 'WAITING_LEO':
        return 'WAITING_LEO';
      case 'BLOCKED':
        return 'BLOCKED';
      case 'IDLE':
        break;
      case 'RECOVERY':
        return 'UNKNOWN_OR_STALE';
    }
  }

  switch (primaryState) {
    case 'QUEUED':
    case 'READY':
    case 'NEEDS_PATCH':
    case 'WAITING_DEPENDENCY':
    case 'COMPLETED':
    case 'FAILED':
    case 'CANCELLED':
      return primaryState;
    case 'TESTING':
      return 'TESTING';
    case 'BLOCKED':
      return 'BLOCKED';
    case 'WAITING_LEO':
      return 'WAITING_LEO';
    case 'DISPATCHED':
    case 'RUNNING':
    case 'RESULT_REPORTED':
    case 'REVIEW_PENDING':
    case 'WAITING_ADVISOR':
    case 'HOLD':
      return 'UNKNOWN_OR_STALE';
  }
}
