import { describe, expect, it } from 'vitest';

import type { RoleActivity } from '../../src/domain/activity/index.js';
import type { WorkUnitState } from '../../src/domain/state-machines/work-unit.js';
import {
  acknowledgeSceneCue,
  applySceneBurst,
  initializeScene,
  TRANSIENT_SEQUENCES,
} from '../../src/ui/scene/state-machine.js';
import type { OfficeStationId, RoleSceneProjection } from '../../src/ui/scene/types.js';

describe('Batch C activity precedence, sequencing, and deduplication', () => {
  it('never queues an initial, reload, or tab-resume replay', () => {
    const update = projection('agent-office', 10, 'RUNNING', 'WORKING');
    const initial = initializeScene([update]);
    expect(initial.pendingCues).toEqual([]);
    expect(applySceneBurst(initial, [update], 'RELOAD').pendingCues).toEqual([]);
    expect(applySceneBurst(initial, [update], 'TAB_RESUME').pendingCues).toEqual([]);
  });

  it('runs one cue per new accepted event ID and does not replay it after acknowledgement', () => {
    const initial = initializeScene([projection('agent-office', 10, 'READY')]);
    const live = projection('agent-office', 11, 'DISPATCHED', 'DELIVERY', 'WORKUNIT_DISPATCH');
    const once = applySceneBurst(initial, [live], 'LIVE');
    expect(once.pendingCues).toHaveLength(1);
    expect(once.pendingCues[0]?.kind).toBe('DELIVERY');
    const acknowledged = acknowledgeSceneCue(once, once.pendingCues[0]?.eventId ?? 'missing');
    expect(applySceneBurst(acknowledged, [live], 'LIVE').pendingCues).toEqual([]);
  });

  it('applies recovery, decision, blocker, and review precedence to a same-entity burst', () => {
    const initial = initializeScene([projection('control', 1, 'READY')]);
    const review = projection('control', 20, 'REVIEW_PENDING', 'REVIEW');
    const blocked = withBlocker(projection('control', 21, 'BLOCKED', 'BLOCKED'));
    const waiting = withDecision(projection('control', 22, 'WAITING_LEO', 'WAITING_LEO'));
    const recovery = withRecovery(projection('control', 23, 'RUNNING', 'RECOVERY'));
    const next = applySceneBurst(initial, [review, blocked, waiting, recovery], 'LIVE');
    expect(next.roles.control.stateName).toBe('RECOVERY');
    expect(next.pendingCues.map((cue) => cue.kind)).toEqual(['RECOVERY']);
  });

  it('coalesces a live burst to at most three bounded transient cues', () => {
    const initial = initializeScene([]);
    const updates = [
      projection('advisor', 31, 'RUNNING', 'READING'),
      projection('control', 32, 'RUNNING', 'WORKING'),
      projection('foundation', 33, 'TESTING', 'TESTING'),
      projection('siasiu', 34, 'RUNNING', 'WRITING_RESULT', 'RESULT_DRAFT_STARTED'),
      projection('fable5', 35, 'REVIEW_PENDING', 'REVIEW'),
    ];
    const next = applySceneBurst(initial, updates, 'LIVE');
    expect(next.pendingCues).toHaveLength(3);
    expect(next.pendingCues.map((cue) => cue.kind)).toEqual(['REVIEW', 'WRITING_RESULT', 'TESTING']);
  });

  it('pins delivery and result-return phase order within bounded presentation time', () => {
    expect(TRANSIENT_SEQUENCES.DELIVERY.map((phase) => phase.phase)).toEqual([
      'ADVISOR_PICKUP',
      'TO_TARGET',
      'HANDOFF',
      'ADVISOR_RETURN',
    ]);
    expect(TRANSIENT_SEQUENCES.RESULT_RETURN.map((phase) => phase.phase)).toEqual([
      'TARGET_PICKUP',
      'TO_ADVISOR',
      'ADVISOR_TRAY_HANDOFF',
    ]);
    expect(TRANSIENT_SEQUENCES.DELIVERY.reduce((total, phase) => total + phase.durationMs, 0)).toBeLessThanOrEqual(1200);
    expect(TRANSIENT_SEQUENCES.RESULT_RETURN.reduce((total, phase) => total + phase.durationMs, 0)).toBe(800);
  });
});

function projection(
  stationId: OfficeStationId,
  sequence: number,
  state: WorkUnitState,
  activity?: RoleActivity,
  reasonCode?: string,
): RoleSceneProjection {
  const stateEvent = eventId(sequence * 10 + 1);
  const activityEvent = eventId(sequence * 10 + 2);
  return {
    projectionRevision: sequence,
    missionSequence: sequence,
    roleInstanceId: `local:${stationId}`,
    stationId,
    actorRole: stationId,
    workUnitId: 'AO-WU-09',
    workUnitState: state,
    stateSourceEventId: stateEvent,
    evaluatedAt: '2026-07-11T12:00:00.000Z',
    acceptedEventIds: [stateEvent, ...(activity === undefined ? [] : [activityEvent])],
    evidenceFreshness: 'CURRENT',
    connectionState: 'CONNECTED',
    openAlertSeverity: 'NONE',
    ...(activity === undefined
      ? {}
      : {
          activity: {
            activity,
            reasonCode: reasonCode ?? `STRUCTURED_${activity}`,
            sourceEventIds: [activityEvent],
            effectiveFrom: '2026-07-11T11:59:00.000Z',
            optionalExpiresAt: '2026-07-11T12:05:00.000Z',
          },
        }),
  };
}

function withBlocker(input: RoleSceneProjection): RoleSceneProjection {
  const blockerEvent = eventId(input.missionSequence * 10 + 3);
  return {
    ...input,
    acceptedEventIds: [...input.acceptedEventIds, blockerEvent],
    blocker: {
      eventId: blockerEvent,
      kind: 'TEST_FAILURE',
      reasonCode: 'STRUCTURED_TEST_FAILURE',
      resolutionOwner: 'ASSIGNED_WORKER',
      route: 'ASSIGNED_WORKER',
    },
  };
}

function withDecision(input: RoleSceneProjection): RoleSceneProjection {
  const decisionEvent = eventId(input.missionSequence * 10 + 4);
  return {
    ...input,
    acceptedEventIds: [...input.acceptedEventIds, decisionEvent],
    decision: {
      eventId: decisionEvent,
      decisionId: 'DECISION-1',
      artifactRef: 'decisions/DECISION-1.json',
      destinationStationId: 'leo',
    },
  };
}

function withRecovery(input: RoleSceneProjection): RoleSceneProjection {
  const recoveryEvent = eventId(input.missionSequence * 10 + 6);
  return {
    ...input,
    acceptedEventIds: [...input.acceptedEventIds, recoveryEvent],
    recovery: {
      eventId: recoveryEvent,
      step: 2,
      totalSteps: 4,
      status: 'REBUILDING',
      readOnly: true,
    },
  };
}

function eventId(value: number): string {
  return `018f0000-0000-7000-8000-${String(value).padStart(12, '0')}`;
}
