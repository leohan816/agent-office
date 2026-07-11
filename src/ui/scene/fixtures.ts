import type { CurrentActivity, RoleActivity } from '../../domain/activity/index.js';
import type { WorkUnitState } from '../../domain/state-machines/work-unit.js';
import { OFFICE_STATIONS, type OfficeStationId, type RoleSceneProjection, type SceneFixture } from './types.js';

const MISSION_ID = 'AGENT_OFFICE_M01_ADVISOR_MANAGED_OFFICE_WEB_CONTROL_PLANE';
const EVALUATED_AT = '2026-07-11T12:00:00.000Z';

interface RoleFixtureOptions {
  readonly state?: WorkUnitState;
  readonly activity?: RoleActivity;
  readonly reasonCode?: string;
  readonly workUnitId?: string;
  readonly sequence: number;
  readonly deliveryTargetStationId?: OfficeStationId;
  readonly stale?: boolean;
  readonly critical?: boolean;
  readonly blocker?: boolean;
  readonly decision?: boolean;
  readonly resultEvidence?: boolean;
  readonly recovery?: boolean;
}

const currentRoles = OFFICE_STATIONS.map((station, index) =>
  role(station.id, {
    sequence: index + 1,
    ...(station.id === 'agent-office'
      ? { state: 'READY' as const, workUnitId: 'AO-WU-09' }
      : { activity: 'IDLE' as const }),
  }),
);

const activityRoles: readonly RoleSceneProjection[] = [
  role('leo', { sequence: 20, activity: 'IDLE' }),
  role('advisor', { sequence: 21, state: 'RUNNING', activity: 'READING', workUnitId: 'AO-WU-09' }),
  role('control', { sequence: 22, state: 'RUNNING', activity: 'WORKING', workUnitId: 'AO-WU-09' }),
  role('fable5', { sequence: 23, state: 'REVIEW_PENDING', activity: 'REVIEW', workUnitId: 'AO-WU-09' }),
  role('foundation', { sequence: 24, state: 'TESTING', activity: 'TESTING', workUnitId: 'AO-WU-09' }),
  role('siasiu', {
    sequence: 25,
    state: 'RUNNING',
    activity: 'WRITING_RESULT',
    reasonCode: 'RESULT_DRAFT_STARTED',
    workUnitId: 'AO-WU-09',
  }),
  role('cosmile', { sequence: 26, state: 'WAITING_DEPENDENCY', workUnitId: 'AO-WU-10' }),
  role('agent-office', { sequence: 27, state: 'READY', workUnitId: 'AO-WU-09' }),
];

const deliveryRoles = replaceRole(currentRoles, 'agent-office',
  role('agent-office', {
    sequence: 40,
    state: 'DISPATCHED',
    activity: 'DELIVERY',
    reasonCode: 'WORKUNIT_DISPATCH',
    workUnitId: 'AO-WU-09',
    deliveryTargetStationId: 'agent-office',
  }),
);

const returnRoles = replaceRole(currentRoles, 'agent-office',
  role('agent-office', {
    sequence: 50,
    state: 'RESULT_REPORTED',
    activity: 'RESULT_RETURN',
    workUnitId: 'AO-WU-09',
    resultEvidence: true,
  }),
);

const safetyRoles: readonly RoleSceneProjection[] = [
  role('leo', { sequence: 60, activity: 'IDLE' }),
  role('advisor', { sequence: 61, state: 'WAITING_ADVISOR', workUnitId: 'AO-WU-09' }),
  role('control', { sequence: 62, state: 'RUNNING', activity: 'RECOVERY', recovery: true, workUnitId: 'AO-WU-09' }),
  role('fable5', { sequence: 63, state: 'NEEDS_PATCH', workUnitId: 'AO-WU-09' }),
  role('foundation', {
    sequence: 64,
    state: 'BLOCKED',
    activity: 'BLOCKED',
    blocker: true,
    critical: true,
    workUnitId: 'AO-WU-09',
  }),
  role('siasiu', { sequence: 65, state: 'HOLD', workUnitId: 'AO-WU-09' }),
  role('cosmile', { sequence: 66, state: 'RUNNING', activity: 'WORKING', stale: true, workUnitId: 'AO-WU-09' }),
  role('agent-office', {
    sequence: 67,
    state: 'WAITING_LEO',
    activity: 'WAITING_LEO',
    decision: true,
    workUnitId: 'AO-WU-09',
  }),
];

export const SCENE_FIXTURES: readonly SceneFixture[] = [
  {
    id: 'current',
    labelKo: '현재 구조화 상태',
    descriptionKo: '승인된 Batch C 의존 상태를 정적인 자세로 표시',
    roles: currentRoles,
  },
  {
    id: 'activity',
    labelKo: '활동 매핑',
    descriptionKo: '읽기, 작업, 테스트, 결과 작성, 독립 검토 매핑',
    roles: activityRoles,
  },
  {
    id: 'delivery',
    labelKo: '작업 전달',
    descriptionKo: 'Advisor 픽업, 대상 이동, 인계, 복귀 순서',
    roles: deliveryRoles,
  },
  {
    id: 'return',
    labelKo: '결과 반환',
    descriptionKo: '검증된 결과와 포인터를 Advisor 트레이로 반환',
    roles: returnRoles,
  },
  {
    id: 'safety',
    labelKo: '안전 우선 상태',
    descriptionKo: '복구, 결정 대기, 차단, 수정, 보류, 오래된 관측',
    roles: safetyRoles,
  },
] as const;

export const DEFAULT_SCENE_FIXTURE = SCENE_FIXTURES[0];

export function getSceneFixture(id: string): SceneFixture {
  return SCENE_FIXTURES.find((fixture) => fixture.id === id) ?? requireDefaultFixture();
}

function role(stationId: OfficeStationId, options: RoleFixtureOptions): RoleSceneProjection {
  const station = OFFICE_STATIONS.find((candidate) => candidate.id === stationId);
  if (station === undefined) throw new Error(`unknown office station ${stationId}`);
  const stateEventId = options.state === undefined ? undefined : eventId(options.sequence * 10 + 1);
  const activityEventId = options.activity === undefined ? undefined : eventId(options.sequence * 10 + 2);
  const blockerEventId = options.blocker === true ? eventId(options.sequence * 10 + 3) : undefined;
  const decisionEventId = options.decision === true ? eventId(options.sequence * 10 + 4) : undefined;
  const resultEventId = options.resultEvidence === true ? eventId(options.sequence * 10 + 5) : undefined;
  const recoveryEventId = options.recovery === true ? eventId(options.sequence * 10 + 6) : undefined;
  const activity = makeActivity(options.activity, options.reasonCode, activityEventId);
  const acceptedEventIds = [
    stateEventId,
    activityEventId,
    blockerEventId,
    decisionEventId,
    resultEventId,
    recoveryEventId,
  ].filter((value): value is string => value !== undefined);

  return {
    projectionRevision: 9,
    missionSequence: options.sequence,
    roleInstanceId: `local:${stationId}`,
    stationId,
    actorRole: station.actorRole,
    missionId: MISSION_ID,
    evaluatedAt: EVALUATED_AT,
    acceptedEventIds,
    evidenceFreshness: options.stale === true ? 'STALE' : 'CURRENT',
    connectionState: 'CONNECTED',
    openAlertSeverity: options.critical === true ? 'CRITICAL' : 'NONE',
    ...(options.workUnitId === undefined ? {} : { workUnitId: options.workUnitId }),
    ...(options.state === undefined ? {} : { workUnitState: options.state }),
    ...(stateEventId === undefined ? {} : { stateSourceEventId: stateEventId }),
    ...(activity === undefined ? {} : { activity }),
    ...(options.deliveryTargetStationId === undefined
      ? {}
      : { deliveryTargetStationId: options.deliveryTargetStationId }),
    ...(blockerEventId === undefined
      ? {}
      : {
          blocker: {
            eventId: blockerEventId,
            kind: 'MISSING_EVIDENCE',
            reasonCode: 'VERIFIED_POINTER_REQUIRED',
            resolutionOwner: 'ADVISOR',
            route: 'ADVISOR',
          } as const,
        }),
    ...(decisionEventId === undefined
      ? {}
      : {
          decision: {
            eventId: decisionEventId,
            decisionId: 'DECISION-AO-WU-09',
            artifactRef: 'decisions/AO-WU-09/decision-request.json',
            destinationStationId: 'leo',
          } as const,
        }),
    ...(resultEventId === undefined
      ? {}
      : {
          resultEvidence: {
            eventId: resultEventId,
            resultRef: 'runs/agent-office/WORKER_BATCH_C_RESULT.md',
            pointerRef: 'advisor/jobs/27_WORKER_BATCH_C_RESULT_POINTER.md',
            verificationStatus: 'VERIFIED',
          } as const,
        }),
    ...(recoveryEventId === undefined
      ? {}
      : {
          recovery: {
            eventId: recoveryEventId,
            step: 2,
            totalSteps: 4,
            status: 'REBUILDING',
            readOnly: true,
          } as const,
        }),
  };
}

function makeActivity(
  activity: RoleActivity | undefined,
  reasonCode: string | undefined,
  sourceEventId: string | undefined,
): CurrentActivity | undefined {
  if (activity === undefined || sourceEventId === undefined) return undefined;
  return {
    activity,
    reasonCode: reasonCode ?? defaultReason(activity),
    sourceEventIds: [sourceEventId],
    effectiveFrom: '2026-07-11T11:59:00.000Z',
    optionalExpiresAt: '2026-07-11T12:10:00.000Z',
  };
}

function defaultReason(activity: RoleActivity): string {
  if (activity === 'DELIVERY') return 'WORKUNIT_DISPATCH';
  if (activity === 'WRITING_RESULT') return 'RESULT_DRAFT_STARTED';
  return `STRUCTURED_${activity}`;
}

function eventId(value: number): string {
  return `018f0000-0000-7000-8000-${String(value).padStart(12, '0')}`;
}

function replaceRole(
  roles: readonly RoleSceneProjection[],
  stationId: OfficeStationId,
  replacement: RoleSceneProjection,
): readonly RoleSceneProjection[] {
  return roles.map((candidate) => (candidate.stationId === stationId ? replacement : candidate));
}

function requireDefaultFixture(): SceneFixture {
  const fixture = DEFAULT_SCENE_FIXTURE;
  if (fixture === undefined) throw new Error('default scene fixture is missing');
  return fixture;
}
