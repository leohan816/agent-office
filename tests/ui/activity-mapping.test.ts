import { describe, expect, it } from 'vitest';

import type { CurrentActivity, RoleActivity } from '../../src/domain/activity/index.js';
import type { WorkUnitState } from '../../src/domain/state-machines/work-unit.js';
import { projectSceneRole } from '../../src/ui/scene/state-machine.js';
import type { RoleSceneProjection, SceneStateName } from '../../src/ui/scene/types.js';

interface MappingCase {
  readonly expected: SceneStateName;
  readonly primary: WorkUnitState;
  readonly activity?: RoleActivity;
  readonly reasonCode?: string;
  readonly resultEvidence?: boolean;
  readonly blocker?: boolean;
  readonly decision?: boolean;
}

const mappingCases: readonly MappingCase[] = [
  { expected: 'QUEUED', primary: 'QUEUED' },
  { expected: 'READY', primary: 'READY' },
  { expected: 'DISPATCHING', primary: 'DISPATCHED', activity: 'DELIVERY', reasonCode: 'WORKUNIT_DISPATCH' },
  { expected: 'READING', primary: 'DISPATCHED', activity: 'READING' },
  { expected: 'WORKING', primary: 'RUNNING', activity: 'WORKING' },
  { expected: 'TESTING', primary: 'TESTING', activity: 'TESTING' },
  { expected: 'WRITING_RESULT', primary: 'RUNNING', activity: 'WRITING_RESULT', reasonCode: 'RESULT_DRAFT_STARTED' },
  { expected: 'RETURNING_RESULT', primary: 'RESULT_REPORTED', activity: 'RESULT_RETURN', resultEvidence: true },
  { expected: 'REVIEWING', primary: 'REVIEW_PENDING', activity: 'REVIEW' },
  { expected: 'NEEDS_PATCH', primary: 'NEEDS_PATCH' },
  { expected: 'WAITING_DEPENDENCY', primary: 'WAITING_DEPENDENCY' },
  { expected: 'WAITING_LEO', primary: 'WAITING_LEO', activity: 'WAITING_LEO', decision: true },
  { expected: 'BLOCKED', primary: 'BLOCKED', activity: 'BLOCKED', blocker: true },
  { expected: 'COMPLETED', primary: 'COMPLETED' },
  { expected: 'FAILED', primary: 'FAILED' },
  { expected: 'CANCELLED', primary: 'CANCELLED' },
];

describe('Batch C structured activity mapping', () => {
  it.each(mappingCases)('projects exact $expected from the durable primary/activity pair', (mapping) => {
    expect(projectSceneRole(makeProjection(mapping)).stateName).toBe(mapping.expected);
  });

  it('keeps durable Advisor wait and hold labels without inventing activity aliases', () => {
    expect(projectSceneRole(makeProjection({ expected: 'WAITING_ADVISOR', primary: 'WAITING_ADVISOR' })).stateName)
      .toBe('WAITING_ADVISOR');
    expect(projectSceneRole(makeProjection({ expected: 'HOLD', primary: 'HOLD' })).stateName).toBe('HOLD');
  });

  it('fails closed when result return lacks both verified result and pointer evidence', () => {
    const visual = projectSceneRole(makeProjection({
      expected: 'RETURNING_RESULT',
      primary: 'RESULT_REPORTED',
      activity: 'RESULT_RETURN',
    }));
    expect(visual.stateName).toBe('UNKNOWN_OR_STALE');
    expect(visual.detail).toBe('STRUCTURED_SOURCE_UNAVAILABLE');
  });

  it.each(['STALE', 'OFFLINE', 'UNKNOWN', 'CONFLICT', 'ERROR'] as const)(
    'suppresses motion and marks %s evidence unknown or stale',
    (evidenceFreshness) => {
      const input = makeProjection({ expected: 'WORKING', primary: 'RUNNING', activity: 'WORKING' });
      const visual = projectSceneRole({ ...input, evidenceFreshness });
      expect(visual.stateName).toBe('UNKNOWN_OR_STALE');
      expect(visual.lastAcceptedStateName).toBe('WORKING');
      expect(visual.motionSuppressed).toBe(true);
    },
  );

  it('rejects an activity whose source ID is not in the accepted event set', () => {
    const input = makeProjection({ expected: 'TESTING', primary: 'TESTING', activity: 'TESTING' });
    const visual = projectSceneRole({
      ...input,
      acceptedEventIds: input.acceptedEventIds.filter((eventId) => eventId !== input.activity?.sourceEventIds[0]),
    });
    expect(visual.stateName).toBe('UNKNOWN_OR_STALE');
    expect(visual.motionSuppressed).toBe(true);
  });
});

function makeProjection(mapping: MappingCase): RoleSceneProjection {
  const stateEventId = eventId(1);
  const activityEventId = eventId(2);
  const blockerEventId = eventId(3);
  const decisionEventId = eventId(4);
  const resultEventId = eventId(5);
  const activity = makeActivity(mapping.activity, mapping.reasonCode, activityEventId);
  const acceptedEventIds = [
    stateEventId,
    ...(activity === undefined ? [] : [activityEventId]),
    ...(mapping.blocker === true ? [blockerEventId] : []),
    ...(mapping.decision === true ? [decisionEventId] : []),
    ...(mapping.resultEvidence === true ? [resultEventId] : []),
  ];
  return {
    projectionRevision: 10,
    missionSequence: 10,
    roleInstanceId: 'local:agent-office',
    stationId: 'agent-office',
    actorRole: 'Agent Office Worker',
    missionId: 'AGENT_OFFICE_M01_ADVISOR_MANAGED_OFFICE_WEB_CONTROL_PLANE',
    workUnitId: 'AO-WU-09',
    workUnitState: mapping.primary,
    stateSourceEventId: stateEventId,
    evaluatedAt: '2026-07-11T12:00:00.000Z',
    acceptedEventIds,
    evidenceFreshness: 'CURRENT',
    connectionState: 'CONNECTED',
    openAlertSeverity: 'NONE',
    ...(activity === undefined ? {} : { activity }),
    ...(mapping.blocker === true
      ? {
          blocker: {
            eventId: blockerEventId,
            kind: 'TEST_FAILURE',
            reasonCode: 'BATCH_C_TEST_FAILED',
            resolutionOwner: 'ASSIGNED_WORKER',
            route: 'ASSIGNED_WORKER',
          } as const,
        }
      : {}),
    ...(mapping.decision === true
      ? {
          decision: {
            eventId: decisionEventId,
            decisionId: 'DECISION-1',
            artifactRef: 'decisions/DECISION-1.json',
            destinationStationId: 'leo',
          } as const,
        }
      : {}),
    ...(mapping.resultEvidence === true
      ? {
          resultEvidence: {
            eventId: resultEventId,
            resultRef: 'runs/WORKER_BATCH_C_RESULT.md',
            pointerRef: 'advisor/jobs/27_WORKER_BATCH_C_RESULT_POINTER.md',
            verificationStatus: 'VERIFIED',
          } as const,
        }
      : {}),
  };
}

function makeActivity(
  activity: RoleActivity | undefined,
  reasonCode: string | undefined,
  event: string,
): CurrentActivity | undefined {
  if (activity === undefined) return undefined;
  return {
    activity,
    reasonCode: reasonCode ?? `STRUCTURED_${activity}`,
    sourceEventIds: [event],
    effectiveFrom: '2026-07-11T11:59:00.000Z',
    optionalExpiresAt: '2026-07-11T12:05:00.000Z',
  };
}

function eventId(value: number): string {
  return `018f0000-0000-7000-8000-${String(value).padStart(12, '0')}`;
}
