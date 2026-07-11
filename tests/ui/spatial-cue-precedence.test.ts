import { describe, expect, it } from 'vitest';

import { projectRequiredObservable } from '../../src/domain/activity/index.js';

import {
  isSpatialRouteCue,
  projectSpatialCue,
  type SpatialCueEnvelope,
  type SpatialCueFactInput,
  type SpatialCueProjectorInput,
  type SpatialCueProjectionResult,
  type SpatialCueUpdateOrigin,
} from '../../src/ui/spatial/cue-projector.js';
import {
  SPATIAL_CUE_PENDING_LIMIT,
  SPATIAL_CUE_SEEN_LIMIT,
  cancelSpatialCue,
  completeSpatialCue,
  createSpatialCueReducerState,
  reduceSpatialCues,
  type SpatialCueReducerState,
  type SpatialCueReducerUpdate,
} from '../../src/ui/spatial/cue-reducer.js';

describe('AO12-IWU-09 cue precedence, deduplication, and fail-closed reset', () => {
  it('marks initial sources seen and never replays them in a later live delta', () => {
    const initialResult = result('WORKING', 1, 'worker.one', 'WU-1', 'INITIAL_SNAPSHOT');
    const initial = apply(createSpatialCueReducerState(), 1, 'snapshot-1', 'INITIAL_SNAPSHOT', [initialResult]);
    expect(initial.pendingCues).toEqual([]);
    expect(initial.seenSourceEventIds).toContain(eventId(1));
    expect(initial.seenCueIds).toHaveLength(1);

    const replay = result('WORKING', 1, 'worker.one', 'WU-1');
    const next = apply(initial, 2, 'delta-2', 'LIVE_DELTA', [replay]);
    expect(next.pendingCues).toEqual([]);
  });

  it('applies precedence, mission-sequence, and lexical source tie breaks deterministically', () => {
    const updates = [
      result('WORKING', 4, 'worker.one', 'WU-1', 'LIVE_DELTA', 50),
      result('BLOCKED', 5, 'worker.one', 'WU-1', 'LIVE_DELTA', 1),
      result('TESTING', 6, 'worker.two', 'WU-2', 'LIVE_DELTA', 3),
      result('TESTING', 7, 'worker.three', 'WU-3', 'LIVE_DELTA', 7),
      result('TESTING', 8, 'worker.four', 'WU-4', 'LIVE_DELTA', 7),
    ];
    const state = apply(createSpatialCueReducerState(), 10, 'delta-10', 'LIVE_DELTA', updates);
    expect(state.pendingCues).toHaveLength(SPATIAL_CUE_PENDING_LIMIT);
    expect(state.pendingCues.map((cue) => cue.cueKind)).toEqual(['BLOCKED', 'TESTING', 'TESTING']);
    expect(state.pendingCues[1]?.sourceEventIds).toEqual([eventId(8)]);
    expect(state.pendingCues[2]?.sourceEventIds).toEqual([eventId(7)]);
    expect(state.activityLog.some((entry) => entry.outcome === 'OVERFLOW_TO_LOG')).toBe(true);
  });

  it('allows at most one route, one cue per actor, and one cue per WorkUnit', () => {
    const updates = [
      result('WAITING_LEO', 10, 'advisor.one', 'WU-1'),
      result('RESULT_RETURN', 11, 'worker.two', 'WU-2'),
      result('TESTING', 12, 'worker.three', 'WU-3'),
      result('WORKING', 13, 'worker.three', 'WU-4'),
      result('WORKING', 14, 'worker.four', 'WU-3'),
    ];
    const state = apply(createSpatialCueReducerState(), 20, 'delta-20', 'LIVE_DELTA', updates);
    expect(state.pendingCues.filter((cue) => isSpatialRouteCue(cue.cueKind))).toHaveLength(1);
    expect(new Set(state.pendingCues.map((cue) => cue.roleInstanceId)).size).toBe(state.pendingCues.length);
    const workUnits = state.pendingCues.flatMap((cue) => cue.workUnitId === undefined ? [] : [cue.workUnitId]);
    expect(new Set(workUnits).size).toBe(workUnits.length);
  });

  it.each([
    'RELOAD_SNAPSHOT',
    'CURSOR_RESET_SNAPSHOT',
    'TAB_RESUME',
    'POD_SELECTION',
  ] satisfies readonly SpatialCueUpdateOrigin[])('%s clears presentation and queues nothing', (origin) => {
    const live = apply(createSpatialCueReducerState(), 1, 'live-1', 'LIVE_DELTA', [result('WORKING', 1, 'worker.one', 'WU-1')]);
    expect(live.pendingCues).toHaveLength(1);
    const next = apply(live, 2, `non-live-${origin}`, origin, [result('TESTING', 2, 'worker.two', 'WU-2', origin)]);
    expect(next.pendingCues).toEqual([]);
    expect(next.seenSourceEventIds).toContain(eventId(2));
  });

  it('orientation change clears cues, marks sources seen, and cannot restart them', () => {
    const live = apply(createSpatialCueReducerState(), 1, 'live-1', 'LIVE_DELTA', [result('WORKING', 1, 'worker.one', 'WU-1')]);
    const orientation = reduceSpatialCues(live, update(2, 'orientation-2', 'LIVE_DELTA', [result('TESTING', 2, 'worker.two', 'WU-2')], { orientationChanged: true }));
    expect(orientation.pendingCues).toEqual([]);
    const replay = apply(orientation, 3, 'live-3', 'LIVE_DELTA', [result('TESTING', 2, 'worker.two', 'WU-2')]);
    expect(replay.pendingCues).toEqual([]);
  });

  it('clears affected presentation on stale/critical suppression and never delays the cue', () => {
    const live = apply(createSpatialCueReducerState(), 1, 'live-1', 'LIVE_DELTA', [result('WORKING', 1, 'worker.one', 'WU-1')]);
    const stale = suppressed(2, 'worker.one', 'EVIDENCE_NOT_CURRENT', 'ACTOR');
    const afterStale = apply(live, 2, 'stale-2', 'LIVE_DELTA', [stale]);
    expect(afterStale.pendingCues).toEqual([]);
    expect(afterStale.activityLog.at(-1)?.outcome).toBe('SUPPRESSED');

    const restored = apply(afterStale, 3, 'current-3', 'LIVE_DELTA', [result('WORKING', 1, 'worker.one', 'WU-1')]);
    expect(restored.pendingCues).toEqual([]);
  });

  it('detects a same-revision content conflict, clears cues, and requires a verified full snapshot', () => {
    const live = apply(createSpatialCueReducerState(), 1, 'live-1', 'LIVE_DELTA', [result('WORKING', 1, 'worker.one', 'WU-1')]);
    const conflict = apply(live, 1, 'different-1', 'LIVE_DELTA', [result('TESTING', 2, 'worker.two', 'WU-2')]);
    expect(conflict.pendingCues).toEqual([]);
    expect(conflict.projectionConflict).toBe(true);
    expect(conflict.requiresFullSnapshot).toBe(true);

    const rejectedLive = apply(conflict, 2, 'live-2', 'LIVE_DELTA', [result('TESTING', 3, 'worker.two', 'WU-2')]);
    expect(rejectedLive.pendingCues).toEqual([]);
    expect(rejectedLive.requiresFullSnapshot).toBe(true);

    const reset = apply(rejectedLive, 3, 'snapshot-3', 'CURSOR_RESET_SNAPSHOT', [result('TESTING', 4, 'worker.two', 'WU-2', 'CURSOR_RESET_SNAPSHOT')], true);
    expect(reset.projectionConflict).toBe(false);
    expect(reset.requiresFullSnapshot).toBe(false);
    expect(reset.pendingCues).toEqual([]);
  });

  it('is idempotent for byte-equivalent duplicate revisions', () => {
    const first = apply(createSpatialCueReducerState(), 1, 'same', 'LIVE_DELTA', [result('WORKING', 1, 'worker.one', 'WU-1')]);
    expect(apply(first, 1, 'same', 'LIVE_DELTA', [result('WORKING', 1, 'worker.one', 'WU-1')])).toBe(first);
  });

  it('completion and cancellation remove presentation state only', () => {
    const state = apply(createSpatialCueReducerState(), 1, 'live-1', 'LIVE_DELTA', [
      result('WORKING', 1, 'worker.one', 'WU-1'),
      result('TESTING', 2, 'worker.two', 'WU-2'),
    ]);
    const firstCue = requireCue(state.pendingCues[0]);
    const log = state.activityLog;
    const completed = completeSpatialCue(state, firstCue.cueId);
    expect(completed.pendingCues).toHaveLength(1);
    expect(completed.activityLog).toBe(log);
    const remainingCue = requireCue(completed.pendingCues[0]);
    const cancelled = cancelSpatialCue(completed, remainingCue.cueId);
    expect(cancelled.pendingCues).toEqual([]);
    expect(cancelled.seenCueIds).toEqual(state.seenCueIds);
    expect(cancelled.seenSourceEventIds).toEqual(state.seenSourceEventIds);
  });

  it('fails closed when the bounded seen set would evict history', () => {
    const results = Array.from({ length: SPATIAL_CUE_SEEN_LIMIT + 1 }, (_, index) =>
      suppressed(index + 1, `worker.${index}`, 'NOT_LIVE_DELTA', 'NONE'));
    const state = apply(createSpatialCueReducerState(), 1, 'oversized-snapshot', 'INITIAL_SNAPSHOT', results, true);
    expect(state.seenSourceEventIds).toHaveLength(SPATIAL_CUE_SEEN_LIMIT + 1);
    expect(state.pendingCues).toEqual([]);
    expect(state.requiresFullSnapshot).toBe(false);

    const cueResults = Array.from({ length: SPATIAL_CUE_SEEN_LIMIT + 1 }, (_, index) =>
      result('WORKING', index + 600, `worker.${index}`, `WU-${index}`));
    const overflow = apply(createSpatialCueReducerState(), 2, 'oversized-live', 'LIVE_DELTA', cueResults);
    expect(overflow.seenCueIds).toHaveLength(SPATIAL_CUE_SEEN_LIMIT);
    expect(overflow.pendingCues).toEqual([]);
    expect(overflow.requiresFullSnapshot).toBe(true);
  });
});

function apply(
  state: SpatialCueReducerState,
  revision: number,
  fingerprint: string,
  origin: SpatialCueUpdateOrigin,
  results: readonly SpatialCueProjectionResult[],
  fullSnapshotVerified = origin !== 'LIVE_DELTA',
): SpatialCueReducerState {
  return reduceSpatialCues(state, update(revision, fingerprint, origin, results, { fullSnapshotVerified }));
}

function update(
  projectionRevision: number,
  projectionFingerprint: string,
  origin: SpatialCueUpdateOrigin,
  results: readonly SpatialCueProjectionResult[],
  overrides: Partial<SpatialCueReducerUpdate> = {},
): SpatialCueReducerUpdate {
  return {
    origin,
    projectionRevision,
    projectionFingerprint,
    selectedPodId: 'pod:agent-office',
    fullSnapshotVerified: origin !== 'LIVE_DELTA',
    results,
    ...overrides,
  };
}

function result(
  kind: 'WORKING' | 'TESTING' | 'BLOCKED' | 'WAITING_LEO' | 'RESULT_RETURN',
  id: number,
  roleInstanceId: string,
  workUnitId: string,
  origin: SpatialCueUpdateOrigin = 'LIVE_DELTA',
  missionSequence = id,
): SpatialCueProjectionResult {
  const factByKind: Record<typeof kind, SpatialCueFactInput> = {
    WORKING: fact('WORKING_ACCEPTED', id, workUnitId, 'RUNNING', 'WORKING', []),
    TESTING: fact('TESTING_ACCEPTED', id, workUnitId, 'TESTING', 'TESTING', ['COMMAND_AND_EVIDENCE_REFS']),
    BLOCKED: fact('BLOCKER_ACCEPTED', id, workUnitId, 'BLOCKED', 'BLOCKED', ['VERIFIED_BLOCKER']),
    WAITING_LEO: fact('DECISION_REQUEST_ACCEPTED', id, workUnitId, 'WAITING_LEO', 'WAITING_LEO', ['VERIFIED_DECISION_REQUEST', 'EXACT_ADVISOR_ROUTE']),
    RESULT_RETURN: fact('RESULT_ACCEPTED', id, workUnitId, 'RESULT_REPORTED', 'RESULT_RETURN', ['VERIFIED_RESULT_AND_POINTER', 'EXACT_ADVISOR_ROUTE']),
  };
  const factInput = factByKind[kind];
  const input: SpatialCueProjectorInput = {
    projectionSchemaVersion: 'agent-office.spatial-office-projection.v1',
    projectionRevision: 1000 + id,
    previousAppliedRevision: 999 + id,
    evaluatedAt: '2026-07-11T12:00:00.000Z',
    updateOrigin: origin,
    selectedPodId: 'pod:agent-office',
    pod: {
      podId: 'pod:agent-office',
      advisorTeamId: 'FOUNDATION_ADVISOR_TEAM',
      projectId: 'agent-office',
      selected: true,
      sourceAuthorityVerified: true,
      evidenceFreshness: 'CURRENT',
      connectionState: 'CONNECTED',
      responsibleAdvisorRoleInstanceIds: ['advisor.foundation.primary'],
      openAlertSeverity: 'NONE',
    },
    mission: {
      missionId: 'mission-ao12',
      manifestVersion: '1.0.0',
      manifestVerified: true,
      missionSequence,
      acceptedEventIds: [eventId(id)],
    },
    actor: {
      roleInstanceId,
      advisorTeamId: 'FOUNDATION_ADVISOR_TEAM',
      responsibleAdvisorStatus: 'VERIFIED',
      responsibleAdvisorTeamIds: ['FOUNDATION_ADVISOR_TEAM'],
      responsibleAdvisorRoleInstanceIds: ['advisor.foundation.primary'],
      assignmentStatus: 'VERIFIED',
      assignmentProjectId: 'agent-office',
      assignmentMissionId: 'mission-ao12',
      assignmentWorkUnitId: workUnitId,
      sourceBoundaryVerified: true,
      taskMotionAllowed: true,
    },
    fact: factInput,
  };
  return projectSpatialCue(input);
}

function fact(
  factKind: SpatialCueFactInput['factKind'],
  id: number,
  workUnitId: string,
  workUnitState: NonNullable<SpatialCueFactInput['workUnitState']>,
  activityName: NonNullable<SpatialCueFactInput['activity']>['activity'],
  verifiedEvidence: SpatialCueFactInput['verifiedEvidence'],
): SpatialCueFactInput {
  const sourceEventId = eventId(id);
  const evaluatedAt = '2026-07-11T12:00:00.000Z';
  const activity = {
    activity: activityName,
    reasonCode: activityName === 'WRITING_RESULT' ? 'RESULT_DRAFT_STARTED' : activityName,
    sourceEventIds: [sourceEventId],
  } as const;
  return {
    factKind,
    sourceEventIds: [sourceEventId],
    workUnitId,
    workUnitState,
    stateSourceEventId: sourceEventId,
    requiredObservableName: projectRequiredObservable(
      workUnitState,
      { ...activity, effectiveFrom: evaluatedAt },
      evaluatedAt,
    ).requiredObservableName,
    activity,
    verifiedEvidence,
    currentZoneId: `work:worker.${id}`,
  };
}

function suppressed(
  id: number,
  roleInstanceId: string,
  diagnosticCode: SpatialCueProjectionResult['diagnosticCode'],
  suppressionScope: SpatialCueProjectionResult['suppressionScope'],
): SpatialCueProjectionResult {
  return {
    cue: null,
    candidateCueId: null,
    sourceEventIds: [eventId(id)],
    diagnosticCode,
    suppressionScope,
    roleInstanceId,
    podId: 'pod:agent-office',
    projectionRevision: 1000 + id,
    updateOrigin: 'LIVE_DELTA',
    activityLogText: `${diagnosticCode}: static truth only`,
  };
}

function eventId(index: number): string {
  const high = Math.floor(index / 0x1000).toString(16).padStart(8, '0').slice(-8);
  const mid = (index % 0x1000).toString(16).padStart(3, '0');
  const tail = index.toString(16).padStart(12, '0').slice(-12);
  return `${high}-0000-7${mid}-8000-${tail}`;
}

function requireCue(cue: SpatialCueEnvelope | undefined): SpatialCueEnvelope {
  if (cue === undefined) throw new TypeError('cue fixture missing');
  return cue;
}
