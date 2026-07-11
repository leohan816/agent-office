import { projectRequiredObservable, type RoleActivity } from '../../domain/activity/index.js';
import { WORK_UNIT_STATE_LABELS_KO } from '../i18n/ko.js';
import {
  OFFICE_STATION_IDS,
  type OfficeStationId,
  type RoleSceneProjection,
  type SceneMotionCue,
  type SceneMotionCueKind,
  type SceneRoleVisual,
  type SceneRuntime,
  type SceneStateName,
  type SceneUpdateOrigin,
} from './types.js';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export const SCENE_PRECEDENCE: Readonly<Record<SceneStateName, number>> = {
  RECOVERY: 110,
  WAITING_LEO: 100,
  BLOCKED: 90,
  HOLD: 89,
  NEEDS_PATCH: 88,
  REVIEWING: 80,
  RETURNING_RESULT: 70,
  WRITING_RESULT: 60,
  TESTING: 50,
  DISPATCHING: 40,
  READING: 30,
  WORKING: 20,
  WAITING_ADVISOR: 15,
  WAITING_DEPENDENCY: 14,
  UNKNOWN_OR_STALE: 13,
  COMPLETED: 12,
  FAILED: 12,
  CANCELLED: 12,
  READY: 10,
  QUEUED: 9,
  IDLE: 0,
};

export const TRANSIENT_SEQUENCES = {
  DELIVERY: [
    { phase: 'ADVISOR_PICKUP', durationMs: 160 },
    { phase: 'TO_TARGET', durationMs: 480 },
    { phase: 'HANDOFF', durationMs: 140 },
    { phase: 'ADVISOR_RETURN', durationMs: 320 },
  ],
  RESULT_RETURN: [
    { phase: 'TARGET_PICKUP', durationMs: 140 },
    { phase: 'TO_ADVISOR', durationMs: 500 },
    { phase: 'ADVISOR_TRAY_HANDOFF', durationMs: 160 },
  ],
  PATCH_RETURN: [
    { phase: 'REVIEWER_PICKUP', durationMs: 140 },
    { phase: 'TO_WORKER', durationMs: 500 },
    { phase: 'CORRECTION_HANDOFF', durationMs: 160 },
  ],
} as const;

export function projectSceneRole(input: RoleSceneProjection): SceneRoleVisual {
  const acceptedIds = new Set(input.acceptedEventIds.filter(isAcceptedEventId));
  const stateSourceAccepted =
    input.workUnitState === undefined ||
    (input.stateSourceEventId !== undefined && acceptedIds.has(input.stateSourceEventId));
  const activitySourcesAccepted =
    input.activity === undefined ||
    (input.activity.sourceEventIds.length > 0 &&
      input.activity.sourceEventIds.every((eventId) => acceptedIds.has(eventId) && isAcceptedEventId(eventId)));
  const sourceEventIds = uniqueSorted([
    ...(input.stateSourceEventId === undefined ? [] : [input.stateSourceEventId]),
    ...(input.activity?.sourceEventIds ?? []),
    ...(input.blocker === undefined ? [] : [input.blocker.eventId]),
    ...(input.decision === undefined ? [] : [input.decision.eventId]),
    ...(input.resultEvidence === undefined ? [] : [input.resultEvidence.eventId]),
    ...(input.recovery === undefined ? [] : [input.recovery.eventId]),
  ]).filter((eventId) => acceptedIds.has(eventId));

  const candidate = deriveCandidateState(input, activitySourcesAccepted, acceptedIds);
  const freshnessSuppressed =
    input.evidenceFreshness !== 'CURRENT' || input.connectionState !== 'CONNECTED';
  const provenanceSuppressed = !stateSourceAccepted || !activitySourcesAccepted;
  const motionSuppressed =
    freshnessSuppressed || provenanceSuppressed || input.openAlertSeverity === 'CRITICAL';
  const stateName: SceneStateName =
    freshnessSuppressed || provenanceSuppressed ? 'UNKNOWN_OR_STALE' : candidate.stateName;

  return {
    stationId: input.stationId,
    roleInstanceId: input.roleInstanceId,
    actorRole: input.actorRole,
    stateName,
    stateLabelKo: stateLabel(stateName),
    detail: freshnessSuppressed || provenanceSuppressed ? staleDetail(input) : candidate.detail,
    sourceEventIds,
    missionSequence: input.missionSequence,
    projectionRevision: input.projectionRevision,
    freshness: input.evidenceFreshness,
    connectionState: input.connectionState,
    alertSeverity: input.openAlertSeverity,
    motionSuppressed,
    ...(stateName === 'UNKNOWN_OR_STALE' ? { lastAcceptedStateName: candidate.stateName } : {}),
    ...(input.workUnitId === undefined ? {} : { workUnitId: input.workUnitId }),
    ...(input.blocker === undefined ? {} : { blocker: input.blocker }),
    ...(input.decision === undefined ? {} : { decision: input.decision }),
    ...(input.resultEvidence === undefined ? {} : { resultEvidence: input.resultEvidence }),
    ...(input.recovery === undefined ? {} : { recovery: input.recovery }),
    ...(input.deliveryTargetStationId === undefined
      ? {}
      : { deliveryTargetStationId: input.deliveryTargetStationId }),
  };
}

export function initializeScene(roles: readonly RoleSceneProjection[]): SceneRuntime {
  return applySceneBurst(
    { roles: emptyRoleRecord(), seenEventIds: [], pendingCues: [] },
    roles,
    'INITIAL_LOAD',
  );
}

export function applySceneBurst(
  runtime: SceneRuntime,
  updates: readonly RoleSceneProjection[],
  origin: SceneUpdateOrigin,
): SceneRuntime {
  const seen = new Set(runtime.seenEventIds);
  const projected = updates.map((input) => ({ input, visual: projectSceneRole(input) }));
  const winners = new Map<OfficeStationId, (typeof projected)[number]>();

  for (const candidate of projected) {
    const current = winners.get(candidate.visual.stationId);
    if (current === undefined || compareVisual(candidate.visual, current.visual) > 0) {
      winners.set(candidate.visual.stationId, candidate);
    }
  }

  const nextRoles: Record<OfficeStationId, SceneRoleVisual> = { ...runtime.roles };
  for (const [stationId, winner] of winners) nextRoles[stationId] = winner.visual;

  const allIncomingIds = uniqueSorted(updates.flatMap((update) => update.acceptedEventIds));
  const newIds = new Set(allIncomingIds.filter((eventId) => isAcceptedEventId(eventId) && !seen.has(eventId)));
  for (const eventId of allIncomingIds) if (isAcceptedEventId(eventId)) seen.add(eventId);

  const newCues =
    origin === 'LIVE'
      ? projected
          .filter(({ visual }) => winners.get(visual.stationId)?.visual === visual)
          .map(({ input, visual }) => createCue(input, visual, newIds))
          .filter((cue): cue is SceneMotionCue => cue !== undefined)
          .sort(compareCue)
          .slice(0, 3)
      : [];

  const pending = uniqueCues([...runtime.pendingCues, ...newCues]).slice(0, 3);
  return {
    roles: nextRoles,
    seenEventIds: [...seen].sort(),
    pendingCues: pending,
  };
}

export function acknowledgeSceneCue(runtime: SceneRuntime, eventId: string): SceneRuntime {
  return {
    ...runtime,
    pendingCues: runtime.pendingCues.filter((cue) => cue.eventId !== eventId),
  };
}

export function clearSceneCues(runtime: SceneRuntime): SceneRuntime {
  return runtime.pendingCues.length === 0 ? runtime : { ...runtime, pendingCues: [] };
}

export function isAcceptedEventId(value: string): boolean {
  return UUID_V7.test(value);
}

function deriveCandidateState(
  input: RoleSceneProjection,
  activitySourcesAccepted: boolean,
  acceptedIds: ReadonlySet<string>,
): { readonly stateName: SceneStateName; readonly detail: string } {
  if (validRecovery(input, acceptedIds)) {
    const recovery = input.recovery;
    if (recovery === undefined) return { stateName: 'UNKNOWN_OR_STALE', detail: 'RECOVERY_EVIDENCE_MISSING' };
    return {
      stateName: 'RECOVERY',
      detail: `${recovery.status} ${recovery.step}/${recovery.totalSteps}${recovery.readOnly ? ' READ_ONLY' : ''}`,
    };
  }

  if (input.workUnitState === undefined) {
    if (input.activity?.activity === 'IDLE' && activitySourcesAccepted) {
      return { stateName: 'IDLE', detail: '구조화 활동 대기' };
    }
    return { stateName: 'IDLE', detail: '할당된 세부 작업 없음' };
  }

  if (input.workUnitState === 'WAITING_ADVISOR') {
    return { stateName: 'WAITING_ADVISOR', detail: 'Advisor 구조화 인계 대기' };
  }
  if (input.workUnitState === 'HOLD') {
    return { stateName: 'HOLD', detail: '근거 또는 조건 복구 대기' };
  }

  const observable = projectRequiredObservable(input.workUnitState, input.activity, input.evaluatedAt);
  let stateName: SceneStateName = observable.requiredObservableName;
  if (stateName === 'RETURNING_RESULT' && !validResultEvidence(input, acceptedIds)) {
    stateName = 'UNKNOWN_OR_STALE';
  }

  return { stateName, detail: stateDetail(stateName, input) };
}

function validRecovery(input: RoleSceneProjection, acceptedIds: ReadonlySet<string>): boolean {
  const recovery = input.recovery;
  return (
    recovery !== undefined &&
    acceptedIds.has(recovery.eventId) &&
    recovery.totalSteps > 0 &&
    recovery.step >= 0 &&
    recovery.step <= recovery.totalSteps
  );
}

function validResultEvidence(input: RoleSceneProjection, acceptedIds: ReadonlySet<string>): boolean {
  const evidence = input.resultEvidence;
  return (
    evidence !== undefined &&
    acceptedIds.has(evidence.eventId) &&
    evidence.resultRef.length > 0 &&
    evidence.pointerRef.length > 0
  );
}

function stateDetail(stateName: SceneStateName, input: RoleSceneProjection): string {
  if (stateName === 'BLOCKED') {
    return input.blocker === undefined
      ? 'BLOCKER_REASON_MISSING'
      : `${input.blocker.kind} / ${input.blocker.reasonCode} / ${input.blocker.route}`;
  }
  if (stateName === 'WAITING_LEO') {
    return input.decision === undefined
      ? 'DECISION_EVIDENCE_MISSING'
      : `${input.decision.decisionId} -> LEO_OFFICE`;
  }
  if (stateName === 'RETURNING_RESULT') {
    const evidence = input.resultEvidence;
    return evidence === undefined ? 'RESULT_POINTER_EVIDENCE_MISSING' : `${evidence.resultRef} + ${evidence.pointerRef}`;
  }
  if (stateName === 'NEEDS_PATCH') return 'FABLE5_CORRECTION -> AGENT_OFFICE_WORKER';
  if (stateName === 'UNKNOWN_OR_STALE') return 'STRUCTURED_SOURCE_UNAVAILABLE';
  return input.workUnitId ?? '구조화 활동 대기';
}

function staleDetail(input: RoleSceneProjection): string {
  if (input.connectionState !== 'CONNECTED') return `CONNECTION_${input.connectionState}`;
  if (input.evidenceFreshness !== 'CURRENT') return `EVIDENCE_${input.evidenceFreshness}`;
  return 'SOURCE_EVENT_UNACCEPTED_OR_INCOMPATIBLE';
}

function stateLabel(stateName: SceneStateName): string {
  if (stateName === 'IDLE') return '대기';
  if (stateName === 'RECOVERY') return '복구 중';
  return WORK_UNIT_STATE_LABELS_KO[stateName];
}

function createCue(
  input: RoleSceneProjection,
  visual: SceneRoleVisual,
  newIds: ReadonlySet<string>,
): SceneMotionCue | undefined {
  if (visual.motionSuppressed || visual.stateName === 'UNKNOWN_OR_STALE') return undefined;
  const kind = cueKind(visual.stateName);
  if (kind === undefined) return undefined;
  const candidateIds = cueEventIds(input, kind).filter((eventId) => newIds.has(eventId));
  const eventId = candidateIds.sort().at(-1);
  if (eventId === undefined) return undefined;
  const targetStationId = cueTarget(input, kind);
  return {
    eventId,
    stationId: input.stationId,
    kind,
    missionSequence: input.missionSequence,
    sourceStationId: cueSource(input, kind),
    ...(targetStationId === undefined ? {} : { targetStationId }),
  };
}

function cueKind(stateName: SceneStateName): SceneMotionCueKind | undefined {
  switch (stateName) {
    case 'DISPATCHING':
      return 'DELIVERY';
    case 'READING':
      return 'READING';
    case 'WORKING':
      return 'WORKING';
    case 'TESTING':
      return 'TESTING';
    case 'WRITING_RESULT':
      return 'WRITING_RESULT';
    case 'REVIEWING':
      return 'REVIEW';
    case 'BLOCKED':
      return 'BLOCKED';
    case 'WAITING_LEO':
      return 'WAITING_LEO';
    case 'RETURNING_RESULT':
      return 'RESULT_RETURN';
    case 'NEEDS_PATCH':
      return 'PATCH_RETURN';
    case 'RECOVERY':
      return 'RECOVERY';
    case 'IDLE':
    case 'QUEUED':
    case 'READY':
    case 'WAITING_DEPENDENCY':
    case 'WAITING_ADVISOR':
    case 'HOLD':
    case 'COMPLETED':
    case 'FAILED':
    case 'CANCELLED':
    case 'UNKNOWN_OR_STALE':
      return undefined;
  }
}

function cueEventIds(input: RoleSceneProjection, kind: SceneMotionCueKind): string[] {
  if (kind === 'RECOVERY') return input.recovery === undefined ? [] : [input.recovery.eventId];
  if (kind === 'BLOCKED') return input.blocker === undefined ? [] : [input.blocker.eventId];
  if (kind === 'WAITING_LEO') return input.decision === undefined ? [] : [input.decision.eventId];
  if (kind === 'RESULT_RETURN') return input.resultEvidence === undefined ? [] : [input.resultEvidence.eventId];
  if (kind === 'PATCH_RETURN') return input.stateSourceEventId === undefined ? [] : [input.stateSourceEventId];
  return [...(input.activity?.sourceEventIds ?? [])];
}

function cueSource(input: RoleSceneProjection, kind: SceneMotionCueKind): OfficeStationId {
  if (kind === 'DELIVERY') return 'advisor';
  if (kind === 'PATCH_RETURN') return 'fable5';
  if (kind === 'WAITING_LEO') return 'advisor';
  return input.stationId;
}

function cueTarget(input: RoleSceneProjection, kind: SceneMotionCueKind): OfficeStationId | undefined {
  if (kind === 'DELIVERY') return input.deliveryTargetStationId ?? input.stationId;
  if (kind === 'RESULT_RETURN') return 'advisor';
  if (kind === 'PATCH_RETURN') return 'agent-office';
  if (kind === 'WAITING_LEO') return 'leo';
  return undefined;
}

function compareVisual(left: SceneRoleVisual, right: SceneRoleVisual): number {
  const precedence = SCENE_PRECEDENCE[left.stateName] - SCENE_PRECEDENCE[right.stateName];
  if (precedence !== 0) return precedence;
  const sequence = left.missionSequence - right.missionSequence;
  if (sequence !== 0) return sequence;
  return (left.sourceEventIds.at(-1) ?? '').localeCompare(right.sourceEventIds.at(-1) ?? '');
}

function compareCue(left: SceneMotionCue, right: SceneMotionCue): number {
  const leftState = cueState(left.kind);
  const rightState = cueState(right.kind);
  const precedence = SCENE_PRECEDENCE[rightState] - SCENE_PRECEDENCE[leftState];
  if (precedence !== 0) return precedence;
  const sequence = right.missionSequence - left.missionSequence;
  if (sequence !== 0) return sequence;
  return right.eventId.localeCompare(left.eventId);
}

function cueState(kind: SceneMotionCueKind): SceneStateName {
  const stateByCue: Readonly<Record<SceneMotionCueKind, SceneStateName>> = {
    DELIVERY: 'DISPATCHING',
    READING: 'READING',
    WORKING: 'WORKING',
    TESTING: 'TESTING',
    WRITING_RESULT: 'WRITING_RESULT',
    REVIEW: 'REVIEWING',
    BLOCKED: 'BLOCKED',
    WAITING_LEO: 'WAITING_LEO',
    RESULT_RETURN: 'RETURNING_RESULT',
    PATCH_RETURN: 'NEEDS_PATCH',
    RECOVERY: 'RECOVERY',
  };
  return stateByCue[kind];
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function uniqueCues(cues: readonly SceneMotionCue[]): SceneMotionCue[] {
  const byEvent = new Map<string, SceneMotionCue>();
  for (const cue of cues) if (!byEvent.has(cue.eventId)) byEvent.set(cue.eventId, cue);
  return [...byEvent.values()];
}

function emptyRoleRecord(): Record<OfficeStationId, SceneRoleVisual> {
  return Object.fromEntries(
    OFFICE_STATION_IDS.map((stationId) => [stationId, unavailableRole(stationId)]),
  ) as Record<OfficeStationId, SceneRoleVisual>;
}

function unavailableRole(stationId: OfficeStationId): SceneRoleVisual {
  return {
    stationId,
    roleInstanceId: `unavailable:${stationId}`,
    actorRole: stationId,
    stateName: 'UNKNOWN_OR_STALE',
    stateLabelKo: WORK_UNIT_STATE_LABELS_KO.UNKNOWN_OR_STALE,
    detail: 'ROLE_PROJECTION_MISSING',
    sourceEventIds: [],
    missionSequence: 0,
    projectionRevision: 0,
    freshness: 'UNKNOWN',
    connectionState: 'UNKNOWN',
    alertSeverity: 'NONE',
    motionSuppressed: true,
  };
}

export function activityForState(state: SceneStateName): RoleActivity | undefined {
  const activity: Partial<Record<SceneStateName, RoleActivity>> = {
    DISPATCHING: 'DELIVERY',
    READING: 'READING',
    WORKING: 'WORKING',
    TESTING: 'TESTING',
    WRITING_RESULT: 'WRITING_RESULT',
    RETURNING_RESULT: 'RESULT_RETURN',
    REVIEWING: 'REVIEW',
    BLOCKED: 'BLOCKED',
    WAITING_LEO: 'WAITING_LEO',
    RECOVERY: 'RECOVERY',
    IDLE: 'IDLE',
  };
  return activity[state];
}
