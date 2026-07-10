import { describe, expect, it } from 'vitest';

import {
  ALERT_KINDS,
  ALERT_POLICIES,
  alertDeduplicationKey,
  assertAlertPayload,
} from '../../src/domain/alerts/index.js';
import {
  BLOCKER_KINDS,
  BLOCKER_POLICIES,
  assertBlockerPayload,
} from '../../src/domain/blockers/index.js';
import { FIXED_TIME, MISSION_ID, uuidV7, verifiedEvidence } from '../helpers/fixtures.js';

describe('closed blocker and alert contracts', () => {
  it('pins all 16 blocker kinds to reviewed safe defaults and owners', () => {
    expect(BLOCKER_KINDS).toHaveLength(16);
    expect(Object.keys(BLOCKER_POLICIES).sort()).toEqual([...BLOCKER_KINDS].sort());
    const kind = 'TEST_FAILURE' as const;
    expect(() =>
      assertBlockerPayload({
        blockerId: uuidV7(1),
        missionId: MISSION_ID,
        entityRefs: [{ entityType: 'WORK_UNIT', entityId: 'AO-WU-07' }],
        kind,
        reasonCode: 'BATCH_A_TEST_FAILED',
        explanation: 'Synthetic failure fixture',
        ...BLOCKER_POLICIES[kind],
        nextAction: {
          actionCode: 'PATCH_TEST',
          description: 'Patch the failing test',
          targetActor: 'ASSIGNED_WORKER',
          requiresNewHandoff: false,
        },
        blockedSince: FIXED_TIME,
        evidenceRefs: [verifiedEvidence()],
        priorWorkUnitState: 'TESTING',
        resumeTo: 'TESTING',
        requestId: uuidV7(2),
        manifestVersion: 1,
        expectedStreamVersion: 0,
        causationId: uuidV7(3),
        correlationId: uuidV7(4),
      }),
    ).not.toThrow();
  });

  it('pins all nine alert kinds, actions, severity, and canonical deduplication', () => {
    expect(ALERT_KINDS).toHaveLength(9);
    expect(Object.keys(ALERT_POLICIES).sort()).toEqual([...ALERT_KINDS].sort());
    const input = {
      missionId: MISSION_ID,
      kind: 'MISSION_FAILED' as const,
      primaryEntityRef: { entityType: 'MISSION' as const, entityId: MISSION_ID },
      conditionKey: 'MISSION_TERMINAL_FAILURE',
      manifestVersion: 1,
    };
    const key = alertDeduplicationKey(input);
    expect(key).toBe(alertDeduplicationKey(structuredClone(input)));
    expect(() =>
      assertAlertPayload({
        alertId: uuidV7(10),
        ...input,
        ...ALERT_POLICIES.MISSION_FAILED,
        relatedEntityRefs: [],
        titleKey: 'alert.missionFailed',
        messageParameters: {},
        sourceEventIds: [uuidV7(11)],
        evidenceRefs: [verifiedEvidence()],
        deduplicationKey: key,
        firstObservedAt: FIXED_TIME,
        lastObservedAt: FIXED_TIME,
        occurrenceCount: 1,
        resolutionCondition: 'Advisor records a reviewed resolution',
        requestId: uuidV7(12),
        expectedStreamVersion: 0,
        causationId: uuidV7(13),
        correlationId: uuidV7(14),
      }),
    ).not.toThrow();
  });
});
