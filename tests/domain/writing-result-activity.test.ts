import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import {
  assertActivityCompatible,
  projectRequiredObservable,
  type CurrentActivity,
} from '../../src/domain/activity/index.js';
import { FIXED_TIME, uuidV7 } from '../helpers/fixtures.js';

const writing: CurrentActivity = {
  activity: 'WRITING_RESULT',
  reasonCode: 'RESULT_DRAFT_STARTED',
  sourceEventIds: [uuidV7(1)],
  effectiveFrom: FIXED_TIME,
  optionalExpiresAt: '2026-07-10T00:01:00.000Z',
};

describe('WRITING_RESULT activity', () => {
  it('is observable only over RUNNING or TESTING without claiming RESULT_REPORTED', () => {
    expect(() => assertActivityCompatible('RUNNING', writing)).not.toThrow();
    expect(() => assertActivityCompatible('TESTING', writing)).not.toThrow();
    expect(projectRequiredObservable('RUNNING', writing).requiredObservableName).toBe('WRITING_RESULT');
    expect(projectRequiredObservable('TESTING', writing).requiredObservableName).toBe('WRITING_RESULT');
    expect(() => assertActivityCompatible('RESULT_REPORTED', writing)).toThrow(
      expect.objectContaining<Partial<DomainError>>({ code: 'INVALID_TRANSITION' }),
    );
  });

  it('fails closed after explicit activity expiry', () => {
    expect(
      projectRequiredObservable('RUNNING', writing, '2026-07-10T00:01:00.000Z'),
    ).toMatchObject({ requiredObservableName: 'UNKNOWN_OR_STALE', freshness: 'UNKNOWN_OR_STALE' });
  });
});
