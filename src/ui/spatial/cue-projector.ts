import type { SpatialAdvisorResponsibilityStatus } from '../../application/spatial-office/types.js';
import {
  isActivityCompatible,
  projectRequiredObservable,
  type ObservableProjectionName,
  type RoleActivity,
} from '../../domain/activity/index.js';
import type { WorkUnitState } from '../../domain/state-machines/work-unit.js';

export const SPATIAL_CUE_SCHEMA_VERSION = 'agent-office.spatial-cue.v1' as const;

export const SPATIAL_CUE_KINDS = [
  'LEO_GPT_TO_ADVISOR_HANDOFF',
  'DELIVERY',
  'READING',
  'WORKING',
  'TESTING',
  'WRITING_RESULT',
  'REVIEW_HANDOFF',
  'REVIEW',
  'REVIEW_VERDICT_RETURN',
  'BLOCKED',
  'WAITING_LEO',
  'RESULT_RETURN',
  'PATCH_RETURN',
  'COMPLETION_ACKNOWLEDGEMENT',
  'RECOVERY',
  'IDLE_RELOCATE',
] as const;

export type SpatialCueKind = (typeof SPATIAL_CUE_KINDS)[number];

export const SPATIAL_CUE_UPDATE_ORIGINS = [
  'INITIAL_SNAPSHOT',
  'LIVE_DELTA',
  'RELOAD_SNAPSHOT',
  'CURSOR_RESET_SNAPSHOT',
  'TAB_RESUME',
  'POD_SELECTION',
] as const;

export type SpatialCueUpdateOrigin = (typeof SPATIAL_CUE_UPDATE_ORIGINS)[number];

export const SPATIAL_CUE_FACT_KINDS = [
  'LEO_GPT_HANDOFF_ACCEPTED',
  'WORKUNIT_DISPATCH_ACCEPTED',
  'READING_ACCEPTED',
  'WORKING_ACCEPTED',
  'TESTING_ACCEPTED',
  'RESULT_DRAFT_ACCEPTED',
  'REVIEW_HANDOFF_ACCEPTED',
  'REVIEW_ACTIVITY_ACCEPTED',
  'REVIEW_VERDICT_ACCEPTED',
  'BLOCKER_ACCEPTED',
  'DECISION_REQUEST_ACCEPTED',
  'RESULT_ACCEPTED',
  'PATCH_RETURN_ACCEPTED',
  'COMPLETION_ACKNOWLEDGEMENT_ACCEPTED',
  'RECOVERY_STEP_ACCEPTED',
  'VERIFIED_IDLE_ACCEPTED',
] as const;

export type SpatialCueFactKind = (typeof SPATIAL_CUE_FACT_KINDS)[number];

export const SPATIAL_CUE_EVIDENCE_KINDS = [
  'STRUCTURED_HANDOFF',
  'EXACT_ADVISOR_ROUTE',
  'IMMUTABLE_INPUT_OR_ACK',
  'COMMAND_AND_EVIDENCE_REFS',
  'RESULT_DRAFT_STARTED',
  'EXACT_INDEPENDENT_REVIEWER',
  'VERIFIED_REVIEW_VERDICT',
  'VERIFIED_BLOCKER',
  'VERIFIED_DECISION_REQUEST',
  'VERIFIED_RESULT_AND_POINTER',
  'EXACT_ASSIGNED_WORKER',
  'CANONICAL_COMPLETION',
  'STRUCTURED_ACKNOWLEDGEMENT',
  'VERIFIED_RECOVERY_STEP',
  'VERIFIED_IDLE',
] as const;

export type SpatialCueEvidenceKind = (typeof SPATIAL_CUE_EVIDENCE_KINDS)[number];

export type SpatialCueFreshness = 'CURRENT' | 'STALE' | 'OFFLINE' | 'UNKNOWN' | 'CONFLICT' | 'ERROR';
export type SpatialCueConnectionState = 'CONNECTED' | 'OFFLINE' | 'UNKNOWN' | 'CONFLICT';
export type SpatialCueAlertSeverity = 'NONE' | 'INFO' | 'WARNING' | 'CRITICAL';

export interface SpatialCueEnvelope {
  readonly schemaVersion: typeof SPATIAL_CUE_SCHEMA_VERSION;
  readonly cueId: string;
  readonly cueKind: SpatialCueKind;
  readonly projectId: string;
  readonly podId: string;
  readonly missionId: string;
  readonly workUnitId?: string;
  readonly roleInstanceId: string;
  readonly sourceEventIds: readonly string[];
  readonly missionSequence: number;
  readonly projectionRevision: number;
  readonly sourceZoneId: string;
  readonly targetZoneId?: string;
  readonly evidenceFreshness: 'CURRENT';
  readonly connectionState: 'CONNECTED';
  readonly createdFromOrigin: 'LIVE_DELTA';
  readonly durationMs: number;
  readonly staticEquivalentCode: string;
}

export interface SpatialCueActivityInput {
  readonly activity: RoleActivity;
  readonly reasonCode: string;
  readonly sourceEventIds: readonly string[];
  readonly optionalExpiresAt?: string;
}

export interface SpatialCueFactInput {
  readonly factKind: SpatialCueFactKind;
  readonly sourceEventIds: readonly string[];
  readonly workUnitId?: string;
  readonly previousWorkUnitState?: WorkUnitState;
  readonly workUnitState?: WorkUnitState;
  readonly stateSourceEventId?: string;
  readonly requiredObservableName?: ObservableProjectionName;
  readonly activity?: SpatialCueActivityInput;
  readonly verifiedEvidence: readonly SpatialCueEvidenceKind[];
  readonly currentZoneId?: string;
  readonly recoveryStep?: number;
  readonly recoveryTotalSteps?: number;
  readonly recoveryReadOnly?: boolean;
  readonly acceptedAssignmentEnd?: boolean;
}

export interface SpatialCueProjectorInput {
  readonly projectionSchemaVersion: string;
  readonly projectionRevision: number;
  readonly previousAppliedRevision: number;
  readonly evaluatedAt: string;
  readonly updateOrigin: SpatialCueUpdateOrigin;
  readonly selectedPodId: string | null;
  readonly pod: {
    readonly podId: string;
    readonly advisorTeamId: string;
    readonly projectId: string;
    readonly selected: boolean;
    readonly sourceAuthorityVerified: boolean;
    readonly evidenceFreshness: SpatialCueFreshness;
    readonly connectionState: SpatialCueConnectionState;
    readonly responsibleAdvisorRoleInstanceIds: readonly string[];
    readonly openAlertSeverity: SpatialCueAlertSeverity;
  };
  readonly mission: {
    readonly missionId: string;
    readonly manifestVersion: string;
    readonly manifestVerified: boolean;
    readonly missionSequence: number;
    readonly acceptedEventIds: readonly string[];
  };
  readonly actor: {
    readonly roleInstanceId: string;
    readonly advisorTeamId: string | null;
    readonly responsibleAdvisorStatus: SpatialAdvisorResponsibilityStatus;
    readonly responsibleAdvisorTeamIds: readonly string[];
    readonly responsibleAdvisorRoleInstanceIds: readonly string[];
    readonly assignmentStatus: 'VERIFIED' | 'UNASSIGNED' | 'ASSIGNMENT_UNKNOWN' | 'ASSIGNMENT_CONFLICT' | 'SOURCE_CONFLICT';
    readonly assignmentProjectId: string | null;
    readonly assignmentMissionId: string | null;
    readonly assignmentWorkUnitId: string | null;
    readonly sourceBoundaryVerified: boolean;
    readonly taskMotionAllowed: boolean;
  };
  readonly fact: SpatialCueFactInput;
}

export const SPATIAL_CUE_DIAGNOSTIC_CODES = [
  'ELIGIBLE',
  'NOT_LIVE_DELTA',
  'PROJECTION_NOT_STRICTLY_NEWER',
  'SOURCE_UNVERIFIED',
  'NON_SELECTED_POD',
  'EVIDENCE_NOT_CURRENT',
  'CONNECTION_NOT_CONNECTED',
  'CRITICAL_ALERT_SUPPRESSION',
  'STRUCTURED_SOURCE_UNAVAILABLE',
  'ASSIGNMENT_UNKNOWN',
  'ASSIGNMENT_CONFLICT',
  'ADVISOR_RESPONSIBILITY_UNKNOWN',
  'ADVISOR_RESPONSIBILITY_CONFLICT',
  'SOURCE_CORRESPONDENCE_INVALID',
  'REQUIRED_EVIDENCE_MISSING',
  'ACTIVITY_EXPIRED',
] as const;

export type SpatialCueDiagnosticCode = (typeof SPATIAL_CUE_DIAGNOSTIC_CODES)[number];
export type SpatialCueSuppressionScope = 'NONE' | 'ACTOR' | 'POD';

export interface SpatialCueProjectionResult {
  readonly cue: SpatialCueEnvelope | null;
  readonly candidateCueId: string | null;
  readonly sourceEventIds: readonly string[];
  readonly diagnosticCode: SpatialCueDiagnosticCode;
  readonly suppressionScope: SpatialCueSuppressionScope;
  readonly roleInstanceId: string;
  readonly podId: string;
  readonly projectionRevision: number;
  readonly updateOrigin: SpatialCueUpdateOrigin;
  readonly activityLogText: string;
}

interface CueDefinition {
  readonly cueKind: SpatialCueKind;
  readonly durationMs: number;
  readonly staticEquivalentCode: string;
  readonly requiredEvidence: readonly SpatialCueEvidenceKind[];
  readonly sourceZone: (input: SpatialCueProjectorInput) => string;
  readonly targetZone?: (input: SpatialCueProjectorInput) => string;
}

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SAFE_ZONE_ID = /^(?:pod-header|mission-board|testing-bench|result-desk|independent-review-desk|lounge|evidence-cabinet|advisor-anchor|leo-decision-destination|control-recovery|shared-path(?::[a-z0-9._-]+)?|work:[a-z0-9._-]+)$/u;

const CUE_DEFINITIONS: Readonly<Record<SpatialCueFactKind, CueDefinition>> = {
  LEO_GPT_HANDOFF_ACCEPTED: definition(
    'LEO_GPT_TO_ADVISOR_HANDOFF', 900, 'HANDOFF_EVIDENCE_TEXT',
    ['STRUCTURED_HANDOFF', 'EXACT_ADVISOR_ROUTE'],
    () => 'leo-decision-destination', () => 'advisor-anchor',
  ),
  WORKUNIT_DISPATCH_ACCEPTED: definition(
    'DELIVERY', 1100, 'DISPATCH_ROUTE_TEXT',
    ['STRUCTURED_HANDOFF', 'EXACT_ADVISOR_ROUTE'],
    () => 'advisor-anchor', (input) => workZone(input.actor.roleInstanceId),
  ),
  READING_ACCEPTED: definition(
    'READING', 900, 'READING_STATE_TEXT', ['IMMUTABLE_INPUT_OR_ACK'],
    (input) => workZone(input.actor.roleInstanceId), (input) => workZone(input.actor.roleInstanceId),
  ),
  WORKING_ACCEPTED: definition(
    'WORKING', 900, 'WORKING_STATE_TEXT', [],
    (input) => workZone(input.actor.roleInstanceId),
  ),
  TESTING_ACCEPTED: definition(
    'TESTING', 1200, 'TESTING_STATE_TEXT_NO_PASS_CLAIM', ['COMMAND_AND_EVIDENCE_REFS'],
    (input) => workZone(input.actor.roleInstanceId), () => 'testing-bench',
  ),
  RESULT_DRAFT_ACCEPTED: definition(
    'WRITING_RESULT', 900, 'RESULT_DRAFT_STATE_TEXT', ['RESULT_DRAFT_STARTED'],
    (input) => input.fact.currentZoneId === 'testing-bench'
      ? 'testing-bench'
      : workZone(input.actor.roleInstanceId),
    () => 'result-desk',
  ),
  REVIEW_HANDOFF_ACCEPTED: definition(
    'REVIEW_HANDOFF', 900, 'REVIEW_HANDOFF_EVIDENCE_TEXT',
    ['STRUCTURED_HANDOFF', 'EXACT_INDEPENDENT_REVIEWER'],
    () => 'result-desk', () => 'independent-review-desk',
  ),
  REVIEW_ACTIVITY_ACCEPTED: definition(
    'REVIEW', 1000, 'REVIEW_STATE_TEXT', ['EXACT_INDEPENDENT_REVIEWER'],
    () => 'independent-review-desk', () => 'independent-review-desk',
  ),
  REVIEW_VERDICT_ACCEPTED: definition(
    'REVIEW_VERDICT_RETURN', 800, 'VERDICT_EVIDENCE_TEXT',
    ['VERIFIED_REVIEW_VERDICT', 'EXACT_ADVISOR_ROUTE'],
    () => 'independent-review-desk', () => 'advisor-anchor',
  ),
  BLOCKER_ACCEPTED: definition(
    'BLOCKED', 150, 'BLOCKER_REASON_OWNER_ROUTE', ['VERIFIED_BLOCKER'],
    (input) => currentZone(input), (input) => currentZone(input),
  ),
  DECISION_REQUEST_ACCEPTED: definition(
    'WAITING_LEO', 900, 'DECISION_REQUEST_TEXT',
    ['VERIFIED_DECISION_REQUEST', 'EXACT_ADVISOR_ROUTE'],
    () => 'advisor-anchor', () => 'leo-decision-destination',
  ),
  RESULT_ACCEPTED: definition(
    'RESULT_RETURN', 800, 'RESULT_POINTER_TEXT',
    ['VERIFIED_RESULT_AND_POINTER', 'EXACT_ADVISOR_ROUTE'],
    () => 'result-desk', () => 'advisor-anchor',
  ),
  PATCH_RETURN_ACCEPTED: definition(
    'PATCH_RETURN', 800, 'PATCH_ROUTE_TEXT_NO_DISPATCH',
    ['VERIFIED_REVIEW_VERDICT', 'EXACT_ASSIGNED_WORKER'],
    () => 'independent-review-desk', (input) => workZone(input.actor.roleInstanceId),
  ),
  COMPLETION_ACKNOWLEDGEMENT_ACCEPTED: definition(
    'COMPLETION_ACKNOWLEDGEMENT', 700, 'COMPLETION_ACKNOWLEDGEMENT_TEXT',
    ['CANONICAL_COMPLETION', 'STRUCTURED_ACKNOWLEDGEMENT', 'EXACT_ADVISOR_ROUTE'],
    () => 'advisor-anchor', () => 'mission-board',
  ),
  RECOVERY_STEP_ACCEPTED: definition(
    'RECOVERY', 1000, 'RECOVERY_STEP_READ_ONLY_TEXT', ['VERIFIED_RECOVERY_STEP'],
    () => 'control-recovery', () => 'control-recovery',
  ),
  VERIFIED_IDLE_ACCEPTED: definition(
    'IDLE_RELOCATE', 700, 'VERIFIED_IDLE_NO_AVAILABILITY_CLAIM', ['VERIFIED_IDLE'],
    (input) => currentZone(input), () => 'lounge',
  ),
};

export function projectSpatialCue(input: SpatialCueProjectorInput): SpatialCueProjectionResult {
  const sourceEventIds = uniqueSorted(input.fact.sourceEventIds);
  const base = {
    sourceEventIds,
    roleInstanceId: input.actor.roleInstanceId,
    podId: input.pod.podId,
    projectionRevision: input.projectionRevision,
    updateOrigin: input.updateOrigin,
  } as const;
  const suppress = (
    diagnosticCode: Exclude<SpatialCueDiagnosticCode, 'ELIGIBLE'>,
    suppressionScope: SpatialCueSuppressionScope,
  ): SpatialCueProjectionResult => ({
    ...base,
    cue: null,
    candidateCueId: null,
    diagnosticCode,
    suppressionScope,
    activityLogText: diagnosticLog(input, diagnosticCode),
  });

  if (input.updateOrigin === 'LIVE_DELTA' && input.projectionRevision <= input.previousAppliedRevision) {
    return suppress('PROJECTION_NOT_STRICTLY_NEWER', 'NONE');
  }
  if (
    input.projectionSchemaVersion !== 'agent-office.spatial-office-projection.v1'
    || !input.pod.sourceAuthorityVerified
    || !input.mission.manifestVerified
    || input.mission.manifestVersion.length === 0
  ) {
    return suppress('SOURCE_UNVERIFIED', 'POD');
  }
  if (!input.pod.selected || input.selectedPodId !== input.pod.podId) {
    return suppress('NON_SELECTED_POD', 'NONE');
  }
  if (input.pod.evidenceFreshness !== 'CURRENT') {
    return suppress('EVIDENCE_NOT_CURRENT', 'ACTOR');
  }
  if (input.pod.connectionState !== 'CONNECTED') {
    return suppress('CONNECTION_NOT_CONNECTED', 'ACTOR');
  }
  if (input.pod.openAlertSeverity === 'CRITICAL') {
    return suppress('CRITICAL_ALERT_SUPPRESSION', 'POD');
  }
  if (sourceEventIds.length === 0 || !sourceEventIds.every((id) =>
    UUID_V7.test(id) && input.mission.acceptedEventIds.includes(id))) {
    return suppress('STRUCTURED_SOURCE_UNAVAILABLE', 'ACTOR');
  }
  if (input.actor.assignmentStatus === 'ASSIGNMENT_CONFLICT' || input.actor.assignmentStatus === 'SOURCE_CONFLICT') {
    return suppress('ASSIGNMENT_CONFLICT', 'ACTOR');
  }
  if (
    input.actor.assignmentStatus !== 'VERIFIED'
    || !input.actor.sourceBoundaryVerified
    || !input.actor.taskMotionAllowed
    || input.actor.assignmentProjectId !== input.pod.projectId
    || input.actor.assignmentMissionId !== input.mission.missionId
    || (input.fact.workUnitId !== undefined && input.actor.assignmentWorkUnitId !== input.fact.workUnitId)
  ) {
    return suppress('ASSIGNMENT_UNKNOWN', 'ACTOR');
  }
  if (
    input.actor.responsibleAdvisorStatus === 'ADVISOR_RESPONSIBILITY_UNKNOWN'
    || input.actor.responsibleAdvisorTeamIds.length === 0
    || input.pod.responsibleAdvisorRoleInstanceIds.length === 0
    || input.actor.responsibleAdvisorRoleInstanceIds.length === 0
    || input.actor.advisorTeamId === null
  ) {
    return suppress('ADVISOR_RESPONSIBILITY_UNKNOWN', 'ACTOR');
  }
  if (
    input.actor.responsibleAdvisorStatus === 'ADVISOR_RESPONSIBILITY_CONFLICT'
    || input.actor.responsibleAdvisorTeamIds.length !== 1
    || input.actor.responsibleAdvisorTeamIds[0] !== input.pod.advisorTeamId
    || input.actor.advisorTeamId !== input.pod.advisorTeamId
    || input.pod.responsibleAdvisorRoleInstanceIds.length !== 1
    || input.actor.responsibleAdvisorRoleInstanceIds.length !== 1
    || input.actor.responsibleAdvisorRoleInstanceIds[0] !== input.pod.responsibleAdvisorRoleInstanceIds[0]
  ) {
    return suppress('ADVISOR_RESPONSIBILITY_CONFLICT', 'ACTOR');
  }
  if (input.fact.activity?.optionalExpiresAt !== undefined
    && input.fact.activity.optionalExpiresAt <= input.evaluatedAt) {
    return suppress('ACTIVITY_EXPIRED', 'ACTOR');
  }
  if (!factCorresponds(input)) return suppress('SOURCE_CORRESPONDENCE_INVALID', 'ACTOR');

  const definitionForFact = CUE_DEFINITIONS[input.fact.factKind];
  if (!definitionForFact.requiredEvidence.every((kind) => input.fact.verifiedEvidence.includes(kind))) {
    return suppress('REQUIRED_EVIDENCE_MISSING', 'ACTOR');
  }
  const sourceZoneId = definitionForFact.sourceZone(input);
  const targetZoneId = definitionForFact.targetZone?.(input);
  if (!SAFE_ZONE_ID.test(sourceZoneId) || (targetZoneId !== undefined && !SAFE_ZONE_ID.test(targetZoneId))) {
    return suppress('SOURCE_CORRESPONDENCE_INVALID', 'ACTOR');
  }

  const cue: SpatialCueEnvelope = {
    schemaVersion: SPATIAL_CUE_SCHEMA_VERSION,
    cueId: createSpatialCueId({
      projectId: input.pod.projectId,
      missionId: input.mission.missionId,
      roleInstanceId: input.actor.roleInstanceId,
      ...(input.fact.workUnitId === undefined ? {} : { workUnitId: input.fact.workUnitId }),
      cueKind: definitionForFact.cueKind,
      sourceEventIds,
    }),
    cueKind: definitionForFact.cueKind,
    projectId: input.pod.projectId,
    podId: input.pod.podId,
    missionId: input.mission.missionId,
    ...(input.fact.workUnitId === undefined ? {} : { workUnitId: input.fact.workUnitId }),
    roleInstanceId: input.actor.roleInstanceId,
    sourceEventIds,
    missionSequence: input.mission.missionSequence,
    projectionRevision: input.projectionRevision,
    sourceZoneId,
    ...(targetZoneId === undefined ? {} : { targetZoneId }),
    evidenceFreshness: 'CURRENT',
    connectionState: 'CONNECTED',
    createdFromOrigin: 'LIVE_DELTA',
    durationMs: definitionForFact.durationMs,
    staticEquivalentCode: definitionForFact.staticEquivalentCode,
  };
  if (input.updateOrigin !== 'LIVE_DELTA') {
    return {
      ...base,
      cue: null,
      candidateCueId: cue.cueId,
      diagnosticCode: 'NOT_LIVE_DELTA',
      suppressionScope: 'NONE',
      activityLogText: diagnosticLog(input, 'NOT_LIVE_DELTA'),
    };
  }
  return {
    ...base,
    cue,
    candidateCueId: cue.cueId,
    diagnosticCode: 'ELIGIBLE',
    suppressionScope: 'NONE',
    activityLogText: cueLog(cue),
  };
}

export function createSpatialCueId(input: {
  readonly projectId: string;
  readonly missionId: string;
  readonly roleInstanceId: string;
  readonly workUnitId?: string;
  readonly cueKind: SpatialCueKind;
  readonly sourceEventIds: readonly string[];
}): string {
  const canonical = JSON.stringify([
    SPATIAL_CUE_SCHEMA_VERSION,
    input.projectId,
    input.missionId,
    input.roleInstanceId,
    input.workUnitId ?? null,
    input.cueKind,
    uniqueSorted(input.sourceEventIds),
  ]);
  return `sha256:${sha256Utf8(canonical)}`;
}

export function isSpatialRouteCue(kind: SpatialCueKind): boolean {
  return kind === 'LEO_GPT_TO_ADVISOR_HANDOFF'
    || kind === 'DELIVERY'
    || kind === 'REVIEW_HANDOFF'
    || kind === 'REVIEW_VERDICT_RETURN'
    || kind === 'RESULT_RETURN'
    || kind === 'PATCH_RETURN'
    || kind === 'WAITING_LEO'
    || kind === 'COMPLETION_ACKNOWLEDGEMENT';
}

function definition(
  cueKind: SpatialCueKind,
  durationMs: number,
  staticEquivalentCode: string,
  requiredEvidence: readonly SpatialCueEvidenceKind[],
  sourceZone: CueDefinition['sourceZone'],
  targetZone?: CueDefinition['targetZone'],
): CueDefinition {
  return { cueKind, durationMs, staticEquivalentCode, requiredEvidence, sourceZone, ...(targetZone === undefined ? {} : { targetZone }) };
}

function factCorresponds(input: SpatialCueProjectorInput): boolean {
  const { fact } = input;
  const activity = fact.activity;
  if (activity !== undefined && (
    activity.sourceEventIds.length === 0
    || !activity.sourceEventIds.every((id) => fact.sourceEventIds.includes(id))
  )) return false;
  if (fact.workUnitState !== undefined && (
    fact.stateSourceEventId === undefined
    || !fact.sourceEventIds.includes(fact.stateSourceEventId)
    || fact.requiredObservableName === undefined
    || projectRequiredObservable(
      fact.workUnitState,
      activity === undefined ? undefined : {
        ...activity,
        effectiveFrom: input.evaluatedAt,
      },
      input.evaluatedAt,
    ).requiredObservableName !== fact.requiredObservableName
  )) return false;
  const activityIs = (name: RoleActivity, state: WorkUnitState, reason?: string): boolean =>
    activity?.activity === name
    && fact.workUnitState === state
    && isActivityCompatible(state, {
      activity: activity.activity,
      reasonCode: activity.reasonCode,
      sourceEventIds: activity.sourceEventIds,
      effectiveFrom: input.evaluatedAt,
      ...(activity.optionalExpiresAt === undefined ? {} : { optionalExpiresAt: activity.optionalExpiresAt }),
    })
    && (reason === undefined || activity.reasonCode === reason)
    && activity.sourceEventIds.every((id) => fact.sourceEventIds.includes(id));

  switch (fact.factKind) {
    case 'LEO_GPT_HANDOFF_ACCEPTED':
    case 'REVIEW_VERDICT_ACCEPTED':
      return fact.workUnitState !== undefined;
    case 'WORKUNIT_DISPATCH_ACCEPTED':
      return fact.previousWorkUnitState === 'READY'
        && activityIs('DELIVERY', 'DISPATCHED', 'WORKUNIT_DISPATCH');
    case 'READING_ACCEPTED':
      return activity?.activity === 'READING'
        && (fact.workUnitState === 'DISPATCHED' || fact.workUnitState === 'RUNNING')
        && isActivityCompatible(fact.workUnitState, {
          activity: activity.activity,
          reasonCode: activity.reasonCode,
          sourceEventIds: activity.sourceEventIds,
          effectiveFrom: input.evaluatedAt,
          ...(activity.optionalExpiresAt === undefined ? {} : { optionalExpiresAt: activity.optionalExpiresAt }),
        });
    case 'WORKING_ACCEPTED':
      return activityIs('WORKING', 'RUNNING');
    case 'TESTING_ACCEPTED':
      return activityIs('TESTING', 'TESTING');
    case 'RESULT_DRAFT_ACCEPTED':
      return activity?.activity === 'WRITING_RESULT'
        && (fact.workUnitState === 'RUNNING' || fact.workUnitState === 'TESTING')
        && activity.reasonCode === 'RESULT_DRAFT_STARTED'
        && isActivityCompatible(fact.workUnitState, {
          activity: activity.activity,
          reasonCode: activity.reasonCode,
          sourceEventIds: activity.sourceEventIds,
          effectiveFrom: input.evaluatedAt,
          ...(activity.optionalExpiresAt === undefined ? {} : { optionalExpiresAt: activity.optionalExpiresAt }),
        });
    case 'REVIEW_HANDOFF_ACCEPTED':
      return fact.workUnitState === 'REVIEW_PENDING';
    case 'REVIEW_ACTIVITY_ACCEPTED':
      return activityIs('REVIEW', 'REVIEW_PENDING');
    case 'BLOCKER_ACCEPTED':
      return activityIs('BLOCKED', 'BLOCKED');
    case 'DECISION_REQUEST_ACCEPTED':
      return activityIs('WAITING_LEO', 'WAITING_LEO');
    case 'RESULT_ACCEPTED':
      return activityIs('RESULT_RETURN', 'RESULT_REPORTED');
    case 'PATCH_RETURN_ACCEPTED':
      return fact.workUnitState === 'NEEDS_PATCH';
    case 'COMPLETION_ACKNOWLEDGEMENT_ACCEPTED':
      return fact.workUnitState === 'COMPLETED';
    case 'RECOVERY_STEP_ACCEPTED':
      return activity?.activity === 'RECOVERY'
        && fact.recoveryStep !== undefined
        && fact.recoveryTotalSteps !== undefined
        && fact.recoveryTotalSteps > 0
        && fact.recoveryStep >= 0
        && fact.recoveryStep <= fact.recoveryTotalSteps
        && fact.recoveryReadOnly === true;
    case 'VERIFIED_IDLE_ACCEPTED':
      return activity?.activity === 'IDLE'
        || fact.acceptedAssignmentEnd === true
          && (fact.workUnitState === 'COMPLETED'
            || fact.workUnitState === 'FAILED'
            || fact.workUnitState === 'CANCELLED');
  }
}

function workZone(roleInstanceId: string): string {
  return `work:${roleInstanceId}`;
}

function currentZone(input: SpatialCueProjectorInput): string {
  return input.fact.currentZoneId !== undefined && SAFE_ZONE_ID.test(input.fact.currentZoneId)
    ? input.fact.currentZoneId
    : workZone(input.actor.roleInstanceId);
}

function cueLog(cue: SpatialCueEnvelope): string {
  const target = cue.targetZoneId ?? cue.sourceZoneId;
  return `${cue.cueKind}: ${cue.sourceZoneId} -> ${target}; ${cue.staticEquivalentCode}; ${cue.sourceEventIds.join(',')}`;
}

function diagnosticLog(input: SpatialCueProjectorInput, code: SpatialCueDiagnosticCode): string {
  return `${code}: ${input.actor.roleInstanceId}; static truth only`;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function sha256Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const words: number[] = [];
  const bitLength = bytes.length * 8;
  const paddedLength = (((bytes.length + 9 + 63) >> 6) << 6);
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const k = SHA256_CONSTANTS;
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const previous15 = words[index - 15] ?? 0;
      const previous2 = words[index - 2] ?? 0;
      const s0 = rotateRight(previous15, 7) ^ rotateRight(previous15, 18) ^ (previous15 >>> 3);
      const s1 = rotateRight(previous2, 17) ^ rotateRight(previous2, 19) ^ (previous2 >>> 10);
      words[index] = (((words[index - 16] ?? 0) + s0 + (words[index - 7] ?? 0) + s1) >>> 0);
    }
    let [a, b, c, d, e, f, g, hh] = h as [number, number, number, number, number, number, number, number];
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (hh + sum1 + choice + (k[index] ?? 0) + (words[index] ?? 0)) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h[0] = ((h[0] ?? 0) + a) >>> 0;
    h[1] = ((h[1] ?? 0) + b) >>> 0;
    h[2] = ((h[2] ?? 0) + c) >>> 0;
    h[3] = ((h[3] ?? 0) + d) >>> 0;
    h[4] = ((h[4] ?? 0) + e) >>> 0;
    h[5] = ((h[5] ?? 0) + f) >>> 0;
    h[6] = ((h[6] ?? 0) + g) >>> 0;
    h[7] = ((h[7] ?? 0) + hh) >>> 0;
  }
  return h.map((word) => word.toString(16).padStart(8, '0')).join('');
}

function rotateRight(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

const SHA256_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;
