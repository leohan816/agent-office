import { describe, expect, it } from 'vitest';

import {
  REQUIRED_OBSERVABLE_NAMES,
  projectRequiredObservable,
  type CurrentActivity,
} from '../../src/domain/activity/index.js';
import type { WorkUnitState } from '../../src/domain/state-machines/work-unit.js';
import { FIXED_TIME, uuidV7 } from '../helpers/fixtures.js';

const cases: readonly [WorkUnitState, CurrentActivity | undefined, string][] = [
  ['QUEUED', undefined, 'QUEUED'],
  ['READY', undefined, 'READY'],
  ['DISPATCHED', activity('DELIVERY', 'WORKUNIT_DISPATCH'), 'DISPATCHING'],
  ['RUNNING', activity('READING'), 'READING'],
  ['RUNNING', activity('WORKING'), 'WORKING'],
  ['TESTING', activity('TESTING'), 'TESTING'],
  ['RUNNING', activity('WRITING_RESULT', 'RESULT_DRAFT_STARTED'), 'WRITING_RESULT'],
  ['RESULT_REPORTED', activity('RESULT_RETURN'), 'RETURNING_RESULT'],
  ['REVIEW_PENDING', activity('REVIEW'), 'REVIEWING'],
  ['NEEDS_PATCH', undefined, 'NEEDS_PATCH'],
  ['WAITING_DEPENDENCY', undefined, 'WAITING_DEPENDENCY'],
  ['WAITING_LEO', activity('WAITING_LEO'), 'WAITING_LEO'],
  ['BLOCKED', activity('BLOCKED'), 'BLOCKED'],
  ['COMPLETED', undefined, 'COMPLETED'],
  ['FAILED', undefined, 'FAILED'],
  ['CANCELLED', undefined, 'CANCELLED'],
];

function activity(
  name: CurrentActivity['activity'],
  reasonCode = 'STRUCTURED_ACTIVITY',
): CurrentActivity {
  return {
    activity: name,
    reasonCode,
    sourceEventIds: [uuidV7(1)],
    effectiveFrom: FIXED_TIME,
  };
}

describe('required observable conformance', () => {
  it('projects all exact 16 required names from reviewed primary/activity pairs', () => {
    const observed = cases.map(([primary, current, expected]) => {
      expect(projectRequiredObservable(primary, current).requiredObservableName).toBe(expected);
      return expected;
    });
    expect(new Set(observed)).toEqual(new Set(REQUIRED_OBSERVABLE_NAMES));
  });

  it('pins Fable5 R-1 primary-only and expired ambiguity to UNKNOWN_OR_STALE', () => {
    for (const primary of ['DISPATCHED', 'RUNNING', 'RESULT_REPORTED', 'REVIEW_PENDING', 'WAITING_ADVISOR', 'HOLD'] as const) {
      expect(projectRequiredObservable(primary)).toMatchObject({
        requiredObservableName: 'UNKNOWN_OR_STALE',
        freshness: 'UNKNOWN_OR_STALE',
      });
    }
    const expiring = {
      ...activity('WORKING'),
      optionalExpiresAt: '2026-07-10T00:00:01.000Z',
    };
    expect(projectRequiredObservable('RUNNING', expiring, '2026-07-10T00:00:01.000Z')).toMatchObject({
      requiredObservableName: 'UNKNOWN_OR_STALE',
      freshness: 'UNKNOWN_OR_STALE',
    });
  });

  it('does not silently relabel an incompatible pair', () => {
    expect(projectRequiredObservable('RUNNING', activity('REVIEW'))).toMatchObject({
      requiredObservableName: 'UNKNOWN_OR_STALE',
      freshness: 'UNKNOWN_OR_STALE',
    });
  });
});
