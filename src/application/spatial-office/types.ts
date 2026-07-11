export const SPATIAL_OFFICE_SCHEMA_VERSION = 'agent-office.spatial-office-projection.v1' as const;

export const SPATIAL_OFFICE_FLOOR_MODE = 'ONE_SHARED_FLOOR' as const;

export const SPATIAL_OFFICE_COMPATIBILITY_MODES = [
  'M1_FIXED_STATIONS',
  'M1_2_TEAM_PODS',
] as const;

export type SpatialOfficeCompatibilityMode =
  (typeof SPATIAL_OFFICE_COMPATIBILITY_MODES)[number];

export const SPATIAL_TRUTH_STATES = ['KNOWN', 'UNKNOWN', 'STALE', 'CONFLICT'] as const;
export type SpatialTruthState = (typeof SPATIAL_TRUTH_STATES)[number];

export const SPATIAL_AUTHORITY_STATUSES = [
  'VERIFIED',
  'UNVERIFIED',
  'UNKNOWN',
  'CONFLICT',
] as const;
export type SpatialAuthorityStatus = (typeof SPATIAL_AUTHORITY_STATUSES)[number];

export const SPATIAL_EVIDENCE_FRESHNESS = [
  'CURRENT',
  'STALE',
  'UNKNOWN',
  'CONFLICT',
  'ERROR',
] as const;
export type SpatialEvidenceFreshness = (typeof SPATIAL_EVIDENCE_FRESHNESS)[number];

export const SPATIAL_CONNECTION_STATES = [
  'CONNECTED',
  'OFFLINE',
  'UNKNOWN',
  'CONFLICT',
] as const;
export type SpatialConnectionState = (typeof SPATIAL_CONNECTION_STATES)[number];

export const SPATIAL_ASSIGNMENT_STATUSES = [
  'VERIFIED',
  'UNASSIGNED',
  'ASSIGNMENT_UNKNOWN',
  'ASSIGNMENT_CONFLICT',
  'SOURCE_CONFLICT',
] as const;
export type SpatialAssignmentStatus = (typeof SPATIAL_ASSIGNMENT_STATUSES)[number];

export const SPATIAL_ADVISOR_RESPONSIBILITY_STATUSES = [
  'VERIFIED',
  'ADVISOR_RESPONSIBILITY_UNKNOWN',
  'ADVISOR_RESPONSIBILITY_CONFLICT',
] as const;
export type SpatialAdvisorResponsibilityStatus =
  (typeof SPATIAL_ADVISOR_RESPONSIBILITY_STATUSES)[number];

export const SPATIAL_OPERATIONAL_STATES = [
  'IDLE',
  'WORKING',
  'TESTING',
  'ROUTING_DISPATCH',
  'REVIEWING',
  'RETURNING_RESULT',
  'NEEDS_PATCH',
  'WAITING_DEPENDENCY',
  'WAITING_LEO',
  'BLOCKED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'UNKNOWN',
  'CONFLICT',
] as const;
export type SpatialOperationalState = (typeof SPATIAL_OPERATIONAL_STATES)[number];

export const SPATIAL_PRESENTATION_SCOPES = [
  'NONE',
  'GLOBAL_ADVISOR_HUB',
  'TEAM_POD',
] as const;
export type SpatialPresentationScope = (typeof SPATIAL_PRESENTATION_SCOPES)[number];

export interface SpatialDisplayFact {
  readonly state: SpatialTruthState;
  readonly value: string | null;
}

export interface SpatialProgressFact {
  readonly state: SpatialTruthState;
  readonly completed: number | null;
  readonly total: number | null;
}

export interface SpatialEvidenceFact {
  readonly state: SpatialTruthState;
  readonly verifiedAt: string | null;
  readonly evidenceRef: string | null;
}

export interface SpatialAssignmentRef {
  readonly projectId: string;
  readonly missionId: string;
  readonly workUnitId: string;
}

export interface SpatialMissionRef {
  readonly projectId: string;
  readonly missionId: string;
}

export interface SpatialMissionSummary {
  readonly missionRef: SpatialMissionRef;
  readonly displayName: string;
  readonly manifestVersion: string;
  readonly operationalState: SpatialOperationalState;
  readonly workUnitProgress: SpatialProgressFact;
  readonly gateProgress: SpatialProgressFact;
  readonly blockerSummary: SpatialDisplayFact;
}

export interface SpatialMissionBoard {
  readonly missionRef: SpatialMissionRef;
  readonly teamName: SpatialDisplayFact;
  readonly projectName: SpatialDisplayFact;
  readonly responsibleAdvisor: SpatialDisplayFact;
  readonly responsibleAdvisorDisplayIdentity: SpatialDisplayFact;
  readonly currentMission: SpatialDisplayFact;
  readonly currentPhaseOrWorkUnit: SpatialDisplayFact;
  readonly currentActorDisplayIdentity: SpatialDisplayFact;
  readonly assignedReviewer: SpatialDisplayFact;
  readonly nextActorOrHandoff: SpatialDisplayFact;
  readonly workUnitProgress: SpatialProgressFact;
  readonly requiredGateProgress: SpatialProgressFact;
  readonly blocker: SpatialDisplayFact;
  readonly leoGptDecisionState: SpatialDisplayFact;
  readonly latestVerifiedEvidence: SpatialEvidenceFact;
  readonly sourceTruthState: SpatialTruthState;
}

export interface SpatialProjectIdentityRef {
  readonly catalogEntryId: string;
  readonly textId: string;
  readonly displayName: string;
}

export interface SpatialAlertSummary {
  readonly severity: 'NONE' | 'INFO' | 'WARNING' | 'CRITICAL';
  readonly openCount: number;
}

export interface SpatialEvidenceSummary {
  readonly verifiedCount: number;
  readonly latest: SpatialEvidenceFact;
}

export interface SpatialActorProjection {
  readonly roleInstanceId: string;
  readonly actorRole: string;
  readonly displayIdentity: SpatialDisplayFact;
  readonly advisorTeamId: string | null;
  readonly teamAuthorityEvidenceRef: string | null;
  readonly projectId: string | null;
  readonly responsibleAdvisorRoleInstanceId: string | null;
  readonly assignmentStatus: SpatialAssignmentStatus;
  readonly responsibleAdvisorStatus: SpatialAdvisorResponsibilityStatus;
  readonly assignmentRefs: readonly SpatialAssignmentRef[];
  readonly activeAssignmentRef: SpatialAssignmentRef | null;
  readonly currentActivitySourceEventId: string | null;
  readonly presentationScope: SpatialPresentationScope;
  readonly presentationPodId: string | null;
  readonly evidenceFreshness: SpatialEvidenceFreshness;
  readonly connectionState: SpatialConnectionState;
  readonly operationalState: SpatialOperationalState;
  readonly workReceiptAllowed: boolean;
  readonly taskMotionAllowed: boolean;
  readonly independentReviewer: boolean;
}

export interface SpatialActorAssignmentView {
  readonly assignmentRef: SpatialAssignmentRef;
  readonly roleInstanceId: string | null;
  readonly status: SpatialAssignmentStatus;
  readonly fullCharacter: boolean;
  readonly taskMotionAllowed: boolean;
}

export interface SpatialTeamPodProjection {
  readonly podId: string;
  readonly advisorTeamId: string;
  readonly projectId: string;
  readonly displayName: string;
  readonly projectIdentity: SpatialProjectIdentityRef;
  readonly authorityStatus: SpatialAuthorityStatus;
  readonly evidenceFreshness: SpatialEvidenceFreshness;
  readonly connectionState: SpatialConnectionState;
  readonly responsibleAdvisorRoleInstanceId: string | null;
  readonly responsibleAdvisorDisplayIdentity: SpatialDisplayFact;
  readonly selectedMissionRef: SpatialMissionRef | null;
  readonly missionSummaries: readonly SpatialMissionSummary[];
  readonly missionBoardSummary: SpatialMissionBoard | null;
  readonly actorAssignments: readonly SpatialActorAssignmentView[];
  readonly currentMainMission: SpatialDisplayFact;
  readonly currentActor: SpatialDisplayFact;
  readonly operationalState: SpatialOperationalState;
  readonly gateBlockerSummary: SpatialDisplayFact;
  readonly alertSummary: SpatialAlertSummary;
  readonly evidenceSummary: SpatialEvidenceSummary;
  readonly selected: boolean;
  readonly recognizableOfficeArea: true;
  readonly fullChoreographyEnabled: boolean;
}

export interface SpatialSourceManifestRef {
  readonly projectId: string;
  readonly missionId: string;
  readonly manifestVersion: string;
  readonly sourceCommit: string;
  readonly sourceSha256: string;
}

export interface SpatialOfficeProjectionV1 {
  readonly schemaVersion: typeof SPATIAL_OFFICE_SCHEMA_VERSION;
  readonly projectionRevision: number;
  readonly evaluatedAt: string;
  readonly initiativeRef: string;
  readonly floorMode: typeof SPATIAL_OFFICE_FLOOR_MODE;
  readonly selectedPodId: string | null;
  readonly identityCatalogVersion: string;
  readonly pods: readonly SpatialTeamPodProjection[];
  readonly actorsByRoleInstanceId: Readonly<Record<string, SpatialActorProjection>>;
  readonly selectedMissionBoard: SpatialMissionBoard | null;
  readonly channyPresentation: null;
  readonly sourceManifestRefs: readonly SpatialSourceManifestRef[];
  readonly sourceEventIds: readonly string[];
  readonly compatibilityMode: SpatialOfficeCompatibilityMode;
}

export interface SpatialProjectionSelection {
  readonly explicitPodId: string | null;
  readonly explicitMissionRef: SpatialMissionRef | null;
  readonly deepLinkedMissionRef: SpatialMissionRef | null;
}
