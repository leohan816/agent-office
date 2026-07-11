import type { ObservationPresentation } from '../../application/hosts/freshness.js';
import type { CurrentActivity } from '../../domain/activity/index.js';
import type { BlockerKind, ResolutionOwner } from '../../domain/blockers/index.js';
import type { WorkUnitState } from '../../domain/state-machines/work-unit.js';
import type { DashboardStateName } from '../i18n/ko.js';

export const OFFICE_STATION_IDS = [
  'leo',
  'advisor',
  'control',
  'fable5',
  'foundation',
  'siasiu',
  'cosmile',
  'agent-office',
] as const;

export type OfficeStationId = (typeof OFFICE_STATION_IDS)[number];

export interface OfficeStationDefinition {
  readonly id: OfficeStationId;
  readonly label: string;
  readonly actorRole: string;
  readonly column: 0 | 1 | 2 | 3;
  readonly row: 0 | 1;
}

export const OFFICE_STATIONS: readonly OfficeStationDefinition[] = [
  { id: 'leo', label: 'Leo office', actorRole: 'Leo/GPT', column: 0, row: 0 },
  { id: 'advisor', label: 'Advisor routing desk', actorRole: 'Advisor', column: 1, row: 0 },
  { id: 'control', label: 'Control station', actorRole: 'Control', column: 2, row: 0 },
  { id: 'fable5', label: 'Independent review desk', actorRole: 'Fable5 Reviewer', column: 3, row: 0 },
  { id: 'foundation', label: 'Foundation desk', actorRole: 'Foundation Worker', column: 0, row: 1 },
  { id: 'siasiu', label: 'SIASIU desk', actorRole: 'SIASIU Worker', column: 1, row: 1 },
  { id: 'cosmile', label: 'Cosmile desk', actorRole: 'Cosmile Worker', column: 2, row: 1 },
  { id: 'agent-office', label: 'Agent Office desk', actorRole: 'Agent Office Worker', column: 3, row: 1 },
] as const;

export function normalizeOfficeStationId(value: unknown): OfficeStationId | undefined {
  const normalized = value === 'shashu' ? 'siasiu' : value;
  return typeof normalized === 'string' && OFFICE_STATION_IDS.includes(normalized as OfficeStationId)
    ? normalized as OfficeStationId
    : undefined;
}

export type SceneConnectionState = 'CONNECTED' | 'OFFLINE' | 'UNKNOWN' | 'CONFLICT';
export type SceneAlertSeverity = 'NONE' | 'INFO' | 'WARNING' | 'CRITICAL';
export type SceneStateName = DashboardStateName | 'IDLE' | 'RECOVERY';

export interface SceneBlockerProjection {
  readonly eventId: string;
  readonly kind: BlockerKind;
  readonly reasonCode: string;
  readonly resolutionOwner: ResolutionOwner;
  readonly route: 'ADVISOR' | 'LEO_GPT' | 'ASSIGNED_WORKER' | 'FABLE5_REVIEWER';
}

export interface SceneDecisionProjection {
  readonly eventId: string;
  readonly decisionId: string;
  readonly artifactRef: string;
  readonly destinationStationId: 'leo';
}

export interface SceneResultEvidenceProjection {
  readonly eventId: string;
  readonly resultRef: string;
  readonly pointerRef: string;
  readonly verificationStatus: 'VERIFIED';
}

export interface SceneRecoveryProjection {
  readonly eventId: string;
  readonly step: number;
  readonly totalSteps: number;
  readonly status: 'STARTED' | 'REBUILDING' | 'VERIFYING' | 'COMPLETED' | 'FAILED';
  readonly readOnly: boolean;
}

export interface RoleSceneProjection {
  readonly projectionRevision: number;
  readonly missionSequence: number;
  readonly roleInstanceId: string;
  readonly stationId: OfficeStationId;
  readonly actorRole: string;
  readonly missionId?: string;
  readonly workUnitId?: string;
  readonly workUnitState?: WorkUnitState;
  readonly stateSourceEventId?: string;
  readonly activity?: CurrentActivity;
  readonly evaluatedAt: string;
  readonly acceptedEventIds: readonly string[];
  readonly evidenceFreshness: ObservationPresentation;
  readonly connectionState: SceneConnectionState;
  readonly openAlertSeverity: SceneAlertSeverity;
  readonly deliveryTargetStationId?: OfficeStationId;
  readonly blocker?: SceneBlockerProjection;
  readonly decision?: SceneDecisionProjection;
  readonly resultEvidence?: SceneResultEvidenceProjection;
  readonly recovery?: SceneRecoveryProjection;
}

export type SceneMotionCueKind =
  | 'DELIVERY'
  | 'READING'
  | 'WORKING'
  | 'TESTING'
  | 'WRITING_RESULT'
  | 'REVIEW'
  | 'BLOCKED'
  | 'WAITING_LEO'
  | 'RESULT_RETURN'
  | 'PATCH_RETURN'
  | 'RECOVERY';

export interface SceneMotionCue {
  readonly eventId: string;
  readonly stationId: OfficeStationId;
  readonly kind: SceneMotionCueKind;
  readonly missionSequence: number;
  readonly sourceStationId: OfficeStationId;
  readonly targetStationId?: OfficeStationId;
}

export interface SceneRoleVisual {
  readonly stationId: OfficeStationId;
  readonly roleInstanceId: string;
  readonly actorRole: string;
  readonly stateName: SceneStateName;
  readonly stateLabelKo: string;
  readonly detail: string;
  readonly sourceEventIds: readonly string[];
  readonly missionSequence: number;
  readonly projectionRevision: number;
  readonly freshness: ObservationPresentation;
  readonly connectionState: SceneConnectionState;
  readonly alertSeverity: SceneAlertSeverity;
  readonly motionSuppressed: boolean;
  readonly lastAcceptedStateName?: SceneStateName;
  readonly workUnitId?: string;
  readonly blocker?: SceneBlockerProjection;
  readonly decision?: SceneDecisionProjection;
  readonly resultEvidence?: SceneResultEvidenceProjection;
  readonly recovery?: SceneRecoveryProjection;
  readonly deliveryTargetStationId?: OfficeStationId;
}

export type SceneUpdateOrigin = 'INITIAL_LOAD' | 'LIVE' | 'RELOAD' | 'TAB_RESUME';

export interface SceneRuntime {
  readonly roles: Readonly<Record<OfficeStationId, SceneRoleVisual>>;
  readonly seenEventIds: readonly string[];
  readonly pendingCues: readonly SceneMotionCue[];
}

export interface SceneFixture {
  readonly id: string;
  readonly labelKo: string;
  readonly descriptionKo: string;
  readonly roles: readonly RoleSceneProjection[];
}
