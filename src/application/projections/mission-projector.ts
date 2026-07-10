import type { JsonValue } from '../../contracts/types.js';
import { DomainError } from '../../contracts/types.js';
import { isRecord } from '../../contracts/validation.js';
import {
  assertActivityCompatible,
  projectRequiredObservable,
  type CurrentActivity,
  type ObservableProjectionName,
  type RoleActivity,
} from '../../domain/activity/index.js';
import type { EventEnvelope } from '../../domain/events/index.js';
import type { MissionManifest, PhaseManifest } from '../../domain/manifest/index.js';
import {
  RESUMABLE_WORK_UNIT_STATES,
  WORK_UNIT_STATES,
  allowedWorkUnitTargets,
  type ResumableWorkUnitState,
  type WorkUnitState,
} from '../../domain/state-machines/work-unit.js';
import { GENESIS_EVENT_HASH } from '../../persistence/file-store/hashing.js';

export interface ProjectedActivity {
  readonly activity: RoleActivity;
  readonly reasonCode: string;
  readonly sourceEventIds: readonly string[];
  readonly effectiveFrom?: string;
  readonly optionalExpiresAt?: string;
}

export interface WorkUnitProjection {
  readonly id: string;
  readonly phaseId: string;
  readonly actor: string;
  readonly title: string;
  readonly state: WorkUnitState;
  readonly requiredObservableName: ObservableProjectionName;
  readonly dependsOn: readonly string[];
  readonly attempt: number;
  readonly sourceStatus: string;
  readonly activeInManifest: boolean;
  readonly activity?: ProjectedActivity;
  readonly priorResumableState?: ResumableWorkUnitState;
  readonly lastAcceptedEventId?: string;
}

export interface ScopeHistoryEntry {
  readonly manifestVersion: number;
  readonly numerator: number;
  readonly denominator: number;
  readonly manifestHash: string;
}

export interface MissionProjection {
  readonly projectionSchemaVersion: 'agent-office.mission-projection.v1';
  readonly missionId: string;
  readonly manifestVersion: number;
  readonly sequence: number;
  readonly eventHash: string;
  readonly initiative: MissionManifest['initiative'];
  readonly package: MissionManifest['package'];
  readonly phases: readonly PhaseManifest[];
  readonly workUnits: Readonly<Record<string, WorkUnitProjection>>;
  readonly retiredWorkUnits: Readonly<Record<string, WorkUnitProjection>>;
  readonly numerator: number;
  readonly denominator: number;
  readonly scopeHistory: readonly ScopeHistoryEntry[];
  readonly blockers: Readonly<Record<string, JsonValue>>;
  readonly alerts: Readonly<Record<string, JsonValue>>;
  readonly decisions: Readonly<Record<string, JsonValue>>;
  readonly messages: Readonly<Record<string, JsonValue>>;
  readonly notifications: Readonly<Record<string, JsonValue>>;
  readonly evidence: readonly JsonValue[];
}

export function createInitialProjection(manifest: MissionManifest): MissionProjection {
  const workUnits = Object.fromEntries(
    manifest.workUnits.map((workUnit) => [workUnit.id, projectManifestWorkUnit(workUnit)]),
  );
  const numerator = Object.values(workUnits).filter((workUnit) => workUnit.state === 'COMPLETED').length;
  return {
    projectionSchemaVersion: 'agent-office.mission-projection.v1',
    missionId: manifest.missionId,
    manifestVersion: manifest.manifestVersion,
    sequence: 0,
    eventHash: GENESIS_EVENT_HASH,
    initiative: manifest.initiative,
    package: manifest.package,
    phases: manifest.phases,
    workUnits,
    retiredWorkUnits: {},
    numerator,
    denominator: manifest.counting.denominator,
    scopeHistory: [
      {
        manifestVersion: manifest.manifestVersion,
        numerator,
        denominator: manifest.counting.denominator,
        manifestHash: manifest.source.sha256,
      },
    ],
    blockers: {},
    alerts: {},
    decisions: {},
    messages: {},
    notifications: {},
    evidence: [],
  };
}

export function applyMissionEvent(
  previous: MissionProjection,
  event: EventEnvelope,
  scopeManifest?: MissionManifest,
): MissionProjection {
  if (event.missionId !== previous.missionId || event.sequence !== previous.sequence + 1) {
    throw new DomainError('STORE_QUARANTINED', 'projection event identity or sequence mismatch');
  }
  let candidate: MissionProjection = {
    ...previous,
    sequence: event.sequence,
    eventHash: event.eventHash,
  };
  switch (event.eventType) {
    case 'WorkUnitStateTransitioned':
      candidate = applyWorkUnitTransition(candidate, event);
      break;
    case 'RoleActivityChanged':
      candidate = applyRoleActivity(candidate, event);
      break;
    case 'WorkUnitCompletionRevoked':
      candidate = applyWorkUnitTransition(candidate, event);
      break;
    case 'MissionScopeChanged':
      candidate = applyScopeChange(candidate, event, scopeManifest);
      break;
    case 'BlockerOpened':
    case 'BlockerAcknowledged':
    case 'BlockerRouteChanged':
    case 'BlockerResolved':
    case 'BlockerSuperseded':
      candidate = applyEntityRecord(candidate, event, 'blockers', 'blockerId');
      break;
    case 'AlertRaised':
    case 'AlertAcknowledged':
    case 'AlertSnoozed':
    case 'AlertResolved':
    case 'AlertSuppressed':
      candidate = applyEntityRecord(candidate, event, 'alerts', 'alertId');
      break;
    case 'DecisionRequested':
    case 'DecisionAcknowledged':
    case 'DecisionRecorded':
    case 'DecisionApplied':
    case 'DecisionSuperseded':
    case 'DecisionWithdrawn':
      candidate = applyEntityRecord(candidate, event, 'decisions', 'decisionId');
      break;
    case 'AdvisorMessagePersisted':
    case 'AdvisorMessageDeliveryQueued':
    case 'AdvisorMessageDelivered':
    case 'AdvisorMessageDeliveryFailed':
    case 'AdvisorMessageAcknowledged':
    case 'AdvisorIntakeRecorded':
    case 'AdvisorMessageClosed':
      candidate = applyEntityRecord(candidate, event, 'messages', 'messageId');
      break;
    case 'NotificationQueued':
    case 'NotificationDeliveryStarted':
    case 'NotificationDelivered':
    case 'NotificationAcknowledged':
    case 'NotificationFailed':
    case 'NotificationManualFallbackRequired':
    case 'NotificationCancelled':
      candidate = applyEntityRecord(candidate, event, 'notifications', 'notificationId');
      break;
    case 'EvidenceAttached':
    case 'EvidenceVerified':
    case 'EvidenceMarkedStale':
    case 'EvidenceInvalidated':
    case 'ReviewResultRecorded':
      candidate = { ...candidate, evidence: [...candidate.evidence, event.payload] };
      break;
    default:
      break;
  }
  return candidate;
}

export function replayMission(
  manifest: MissionManifest,
  events: readonly EventEnvelope[],
  manifestHistory: readonly MissionManifest[] = [manifest],
): MissionProjection {
  const manifests = new Map(manifestHistory.map((item) => [item.manifestVersion, item]));
  let projection = createInitialProjection(manifest);
  for (const event of events) {
    const scopeManifest =
      event.eventType === 'MissionScopeChanged' && isRecord(event.payload)
        ? manifests.get(event.payload.toManifestVersion as number)
        : undefined;
    projection = applyMissionEvent(projection, event, scopeManifest);
  }
  return projection;
}

export function replayFromCheckpoint(
  checkpoint: MissionProjection,
  events: readonly EventEnvelope[],
  manifestHistory: readonly MissionManifest[] = [],
): MissionProjection {
  const manifests = new Map(manifestHistory.map((item) => [item.manifestVersion, item]));
  let projection = checkpoint;
  for (const event of events) {
    const scopeManifest =
      event.eventType === 'MissionScopeChanged' && isRecord(event.payload)
        ? manifests.get(event.payload.toManifestVersion as number)
        : undefined;
    projection = applyMissionEvent(projection, event, scopeManifest);
  }
  return projection;
}

function applyWorkUnitTransition(
  projection: MissionProjection,
  event: EventEnvelope,
): MissionProjection {
  const payload = requirePayloadRecord(event);
  const workUnitId = requirePayloadString(payload, 'workUnitId');
  const from = requireWorkUnitState(payload.from, 'from');
  const to = requireWorkUnitState(payload.to, 'to');
  const current = projection.workUnits[workUnitId];
  if (current?.state !== from) {
    throw new DomainError('STORE_QUARANTINED', 'transition source does not match projected WorkUnit state');
  }
  if (!allowedWorkUnitTargets(from, current.priorResumableState).includes(to)) {
    throw new DomainError('STORE_QUARANTINED', `replay found invalid transition ${from} -> ${to}`);
  }
  const enteringWait =
    to === 'BLOCKED' || to === 'WAITING_ADVISOR' || to === 'WAITING_LEO' || to === 'HOLD';
  const priorResumableState =
    enteringWait && RESUMABLE_WORK_UNIT_STATES.includes(from as ResumableWorkUnitState)
      ? (from as ResumableWorkUnitState)
      : current.priorResumableState;
  const resumeCompleted = current.priorResumableState === to;
  const activity = current.activity === undefined ? undefined : toCurrentActivity(current.activity);
  const compatible = activity !== undefined && safeActivityCompatibility(to, activity) ? current.activity : undefined;
  const observable = projectRequiredObservable(to, compatible === undefined ? undefined : toCurrentActivity(compatible));
  const attempt = from === 'FAILED' && to === 'READY' ? current.attempt + 1 : current.attempt;
  const nextWorkUnit: WorkUnitProjection = {
    ...current,
    state: to,
    attempt,
    requiredObservableName: observable.requiredObservableName,
    lastAcceptedEventId: event.eventId,
    ...(compatible === undefined ? {} : { activity: compatible }),
    ...(!resumeCompleted && priorResumableState !== undefined ? { priorResumableState } : {}),
  };
  if (compatible === undefined) deleteOptionalActivity(nextWorkUnit);
  if (resumeCompleted) deleteOptionalPriorState(nextWorkUnit);
  const workUnits = { ...projection.workUnits, [workUnitId]: nextWorkUnit };
  return { ...projection, workUnits, numerator: countCompleted(workUnits) };
}

function applyRoleActivity(
  projection: MissionProjection,
  event: EventEnvelope,
): MissionProjection {
  const payload = requirePayloadRecord(event);
  const workUnitId = requirePayloadString(payload, 'workUnitId');
  const current = projection.workUnits[workUnitId];
  if (current === undefined) throw new DomainError('STORE_QUARANTINED', 'activity references unknown WorkUnit');
  const activity: CurrentActivity = {
    activity: requireRoleActivity(payload.activity),
    reasonCode: requirePayloadString(payload, 'reasonCode'),
    sourceEventIds: requireStringList(payload.sourceEventIds, 'sourceEventIds'),
    effectiveFrom: requirePayloadString(payload, 'effectiveFrom'),
    ...(typeof payload.optionalExpiresAt === 'string' ? { optionalExpiresAt: payload.optionalExpiresAt } : {}),
  };
  assertActivityCompatible(current.state, activity);
  const observable = projectRequiredObservable(current.state, activity);
  const workUnit: WorkUnitProjection = {
    ...current,
    activity,
    requiredObservableName: observable.requiredObservableName,
    lastAcceptedEventId: event.eventId,
  };
  return { ...projection, workUnits: { ...projection.workUnits, [workUnitId]: workUnit } };
}

function applyScopeChange(
  projection: MissionProjection,
  event: EventEnvelope,
  nextManifest?: MissionManifest,
): MissionProjection {
  const payload = requirePayloadRecord(event);
  const newTotal = requirePayloadInteger(payload, 'newTotal');
  const toManifestVersion = requirePayloadInteger(payload, 'toManifestVersion');
  const newManifestHash = requirePayloadString(payload, 'newManifestHash');
  if (
    toManifestVersion !== projection.manifestVersion + 1 ||
    nextManifest?.manifestVersion !== toManifestVersion ||
    nextManifest.missionId !== projection.missionId ||
    nextManifest.workUnits.length !== newTotal ||
    nextManifest.source.sha256 !== newManifestHash
  ) {
    throw new DomainError('STORE_QUARANTINED', 'scope change event does not reconcile projection');
  }
  const nextIds = new Set(nextManifest.workUnits.map((workUnit) => workUnit.id));
  const newlyRetired = Object.fromEntries(
    Object.values(projection.workUnits)
      .filter((workUnit) => !nextIds.has(workUnit.id))
      .map((workUnit) => [workUnit.id, { ...workUnit, activeInManifest: false }]),
  );
  const previouslyRetired = Object.fromEntries(
    Object.entries(projection.retiredWorkUnits).filter(([id]) => !nextIds.has(id)),
  );
  const workUnits = Object.fromEntries(
    nextManifest.workUnits.map((manifestWorkUnit) => {
      const current = projection.workUnits[manifestWorkUnit.id] ?? projection.retiredWorkUnits[manifestWorkUnit.id];
      if (current === undefined) return [manifestWorkUnit.id, projectManifestWorkUnit(manifestWorkUnit)];
      return [
        manifestWorkUnit.id,
        {
          ...current,
          phaseId: manifestWorkUnit.phase,
          actor: manifestWorkUnit.actor,
          title: manifestWorkUnit.title,
          dependsOn: manifestWorkUnit.dependsOn,
          sourceStatus: manifestWorkUnit.status,
          activeInManifest: true,
        },
      ];
    }),
  );
  const numerator = countCompleted(workUnits);
  return {
    ...projection,
    manifestVersion: toManifestVersion,
    phases: nextManifest.phases,
    workUnits,
    retiredWorkUnits: { ...previouslyRetired, ...newlyRetired },
    numerator,
    denominator: newTotal,
    scopeHistory: [
      ...projection.scopeHistory,
      {
        manifestVersion: toManifestVersion,
        numerator,
        denominator: newTotal,
        manifestHash: newManifestHash,
      },
    ],
  };
}

function projectManifestWorkUnit(
  workUnit: MissionManifest['workUnits'][number],
): WorkUnitProjection {
  const activity =
    workUnit.initialActivity === undefined
      ? undefined
      : {
          activity: workUnit.initialActivity,
          reasonCode: workUnit.initialActivityReasonCode ?? 'MANIFEST_IMPORT',
          sourceEventIds: [],
        };
  return {
    id: workUnit.id,
    phaseId: workUnit.phase,
    actor: workUnit.actor,
    title: workUnit.title,
    state: workUnit.initialState,
    requiredObservableName: workUnit.requiredObservableName,
    dependsOn: workUnit.dependsOn,
    attempt: 1,
    sourceStatus: workUnit.status,
    activeInManifest: true,
    ...(activity === undefined ? {} : { activity }),
  };
}

function applyEntityRecord(
  projection: MissionProjection,
  event: EventEnvelope,
  collection: 'blockers' | 'alerts' | 'decisions' | 'messages' | 'notifications',
  idField: string,
): MissionProjection {
  const payload = requirePayloadRecord(event);
  const id = requirePayloadString(payload, idField);
  return { ...projection, [collection]: { ...projection[collection], [id]: event.payload } };
}

function requirePayloadRecord(event: EventEnvelope): Record<string, unknown> {
  if (!isRecord(event.payload)) throw new DomainError('STORE_QUARANTINED', 'event payload must be an object');
  return event.payload;
}

function requirePayloadString(payload: Record<string, unknown>, field: string): string {
  const value = payload[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new DomainError('STORE_QUARANTINED', `event payload ${field} must be a string`);
  }
  return value;
}

function requirePayloadInteger(payload: Record<string, unknown>, field: string): number {
  const value = payload[field];
  if (!Number.isSafeInteger(value)) {
    throw new DomainError('STORE_QUARANTINED', `event payload ${field} must be an integer`);
  }
  return value as number;
}

function requireWorkUnitState(value: unknown, field: string): WorkUnitState {
  if (typeof value !== 'string' || !WORK_UNIT_STATES.includes(value as WorkUnitState)) {
    throw new DomainError('STORE_QUARANTINED', `event payload ${field} is not a WorkUnit state`);
  }
  return value as WorkUnitState;
}

function requireRoleActivity(value: unknown): RoleActivity {
  const allowed: readonly RoleActivity[] = [
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
  ];
  if (typeof value !== 'string' || !allowed.includes(value as RoleActivity)) {
    throw new DomainError('STORE_QUARANTINED', 'event payload activity is invalid');
  }
  return value as RoleActivity;
}

function requireStringList(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new DomainError('STORE_QUARANTINED', `event payload ${field} must be a string array`);
  }
  return value as string[];
}

function toCurrentActivity(activity: ProjectedActivity): CurrentActivity {
  return {
    activity: activity.activity,
    reasonCode: activity.reasonCode,
    sourceEventIds: activity.sourceEventIds,
    effectiveFrom: activity.effectiveFrom ?? '1970-01-01T00:00:00.000Z',
    ...(activity.optionalExpiresAt === undefined ? {} : { optionalExpiresAt: activity.optionalExpiresAt }),
  };
}

function safeActivityCompatibility(state: WorkUnitState, activity: CurrentActivity): boolean {
  try {
    assertActivityCompatible(state, activity);
    return true;
  } catch {
    return false;
  }
}

function countCompleted(workUnits: Readonly<Record<string, WorkUnitProjection>>): number {
  return Object.values(workUnits).filter((workUnit) => workUnit.state === 'COMPLETED').length;
}

function deleteOptionalActivity(workUnit: WorkUnitProjection): void {
  delete (workUnit as { activity?: ProjectedActivity }).activity;
}

function deleteOptionalPriorState(workUnit: WorkUnitProjection): void {
  delete (workUnit as { priorResumableState?: ResumableWorkUnitState }).priorResumableState;
}
