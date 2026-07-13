import {
  parseAuthenticatedSpatialPresentation,
  type AuthenticatedSpatialPresentationV1,
} from '../../application/spatial-office/authenticated-projection.js';
import type { PixelPresentationTier } from '../pixel/contracts.js';
import {
  adaptM1FixedStations,
  selectSpatialOfficeCompatibilityView,
  type M1FixedStationSpatialView,
} from '../../application/spatial-office/m1-fixed-station-adapter.js';
import type { SpatialTeamPodProjection } from '../../application/spatial-office/types.js';
import type { RoleSceneProjection } from '../scene/types.js';
import type { SpatialPresentationTier } from './actor-zone.js';
import {
  projectSpatialCue,
  type SpatialCueProjectionResult,
  type SpatialCueUpdateOrigin,
} from './cue-projector.js';

export type AuthenticatedSpatialPresentationMode =
  | SpatialPresentationTier
  | 'M1_FIXED_STATIONS';

export type AuthenticatedSpatialSelectionReason =
  | 'SPATIAL_FULL_SELECTED'
  | 'SPATIAL_RESTRAINED_SELECTED'
  | 'SPATIAL_STATIC_REQUESTED'
  | 'SPATIAL_STATIC_REDUCED_MOTION'
  | 'SPATIAL_STATIC_SOURCE_DEGRADED'
  | 'SPATIAL_STATIC_CRITICAL_ALERT'
  | 'SPATIAL_SCHEMA_ABSENT_M1_FALLBACK'
  | 'SPATIAL_SCHEMA_UNKNOWN_M1_FALLBACK'
  | 'SPATIAL_SCHEMA_INVALID_M1_FALLBACK';

export interface AuthenticatedSpatialSelection {
  readonly mode: AuthenticatedSpatialPresentationMode;
  readonly reasonCode: AuthenticatedSpatialSelectionReason;
  readonly requestedTier: SpatialPresentationTier;
  readonly presentation?: AuthenticatedSpatialPresentationV1;
  readonly m1View?: M1FixedStationSpatialView;
}

export interface AuthenticatedSpatialSelectorInput {
  readonly candidate: unknown;
  readonly sceneRoles: readonly RoleSceneProjection[];
  readonly requestedTier?: SpatialPresentationTier;
  readonly reducedMotion?: boolean;
}

export type LivingOfficePresentationTier = PixelPresentationTier | 'M1_FIXED_STATIONS';

/**
 * Batch A living-office presentation-tier selection (design §9): PIXEL_FULL/PIXEL_RESTRAINED for a
 * valid authenticated Office, DOM_STATIC on reduced-motion, and DOM_STATIC→M1_FIXED_STATIONS on a
 * failed/invalid render input. UI-local only; it never changes authority, session, or capability.
 */
export function selectLivingOfficePresentationTier(input: {
  readonly renderInputOk: boolean;
  readonly fallbackTier: 'DOM_STATIC' | 'M1_FIXED_STATIONS';
  readonly reducedMotion: boolean;
}): LivingOfficePresentationTier {
  if (!input.renderInputOk) return input.fallbackTier;
  return input.reducedMotion ? 'DOM_STATIC' : 'PIXEL_FULL';
}

export function selectAuthenticatedSpatialPresentation(
  input: AuthenticatedSpatialSelectorInput,
): AuthenticatedSpatialSelection {
  const requestedTier = input.requestedTier ?? 'FULL';
  if (input.candidate === null || input.candidate === undefined) {
    return m1Selection(
      input.sceneRoles,
      requestedTier,
      'SPATIAL_SCHEMA_ABSENT_M1_FALLBACK',
      undefined,
    );
  }
  const schemaVersion = safeSchemaVersion(input.candidate);
  if (schemaVersion !== 'agent-office.authenticated-spatial-presentation.v1') {
    return m1Selection(
      input.sceneRoles,
      requestedTier,
      'SPATIAL_SCHEMA_UNKNOWN_M1_FALLBACK',
      input.candidate,
    );
  }
  let presentation: AuthenticatedSpatialPresentationV1;
  try {
    presentation = parseAuthenticatedSpatialPresentation(input.candidate);
  } catch {
    return m1Selection(
      input.sceneRoles,
      requestedTier,
      'SPATIAL_SCHEMA_INVALID_M1_FALLBACK',
      input.candidate,
    );
  }
  if (presentation.projection.compatibilityMode !== 'M1_2_TEAM_PODS') {
    return m1Selection(
      input.sceneRoles,
      requestedTier,
      'SPATIAL_SCHEMA_INVALID_M1_FALLBACK',
      input.candidate,
    );
  }
  const selectedPod = selectedPodFor(presentation);
  if (input.reducedMotion === true) {
    return spatialSelection('STATIC', 'SPATIAL_STATIC_REDUCED_MOTION', requestedTier, presentation);
  }
  if (requestedTier === 'STATIC') {
    return spatialSelection('STATIC', 'SPATIAL_STATIC_REQUESTED', requestedTier, presentation);
  }
  if (selectedPod?.alertSummary.severity === 'CRITICAL') {
    return spatialSelection('STATIC', 'SPATIAL_STATIC_CRITICAL_ALERT', requestedTier, presentation);
  }
  if (
    selectedPod?.authorityStatus !== 'VERIFIED'
    || selectedPod.evidenceFreshness !== 'CURRENT'
    || selectedPod.connectionState !== 'CONNECTED'
    || selectedPod.responsibleAdvisorRoleInstanceId === null
  ) {
    return spatialSelection('STATIC', 'SPATIAL_STATIC_SOURCE_DEGRADED', requestedTier, presentation);
  }
  return requestedTier === 'RESTRAINED'
    ? spatialSelection('RESTRAINED', 'SPATIAL_RESTRAINED_SELECTED', requestedTier, presentation)
    : spatialSelection('FULL', 'SPATIAL_FULL_SELECTED', requestedTier, presentation);
}

export function projectAuthenticatedSpatialCues(input: {
  readonly presentation: AuthenticatedSpatialPresentationV1;
  readonly previousAppliedRevision: number;
  readonly updateOrigin: SpatialCueUpdateOrigin;
}): readonly SpatialCueProjectionResult[] {
  const presentation = parseAuthenticatedSpatialPresentation(input.presentation);
  const projection = presentation.projection;
  return presentation.cueSlices.map((slice) => {
    const pod = projection.pods.find((candidate) => candidate.podId === slice.podId);
    const actor = projection.actorsByRoleInstanceId[slice.roleInstanceId];
    const manifest = projection.sourceManifestRefs.find((candidate) =>
      candidate.projectId === pod?.projectId && candidate.missionId === slice.missionId);
    if (pod === undefined || actor === undefined || manifest === undefined) {
      throw new TypeError('authenticated spatial cue slice cannot resolve projection correspondence');
    }
    const assignment = actor.activeAssignmentRef;
    const responsibleAdvisorIds = pod.responsibleAdvisorRoleInstanceId === null
      ? []
      : [pod.responsibleAdvisorRoleInstanceId];
    return projectSpatialCue({
      projectionSchemaVersion: projection.schemaVersion,
      projectionRevision: slice.projectionRevision,
      previousAppliedRevision: input.previousAppliedRevision,
      evaluatedAt: slice.evaluatedAt,
      updateOrigin: input.updateOrigin,
      selectedPodId: projection.selectedPodId,
      pod: {
        podId: pod.podId,
        advisorTeamId: pod.advisorTeamId,
        projectId: pod.projectId,
        selected: pod.selected,
        sourceAuthorityVerified: pod.authorityStatus === 'VERIFIED',
        evidenceFreshness: pod.evidenceFreshness,
        connectionState: pod.connectionState,
        responsibleAdvisorRoleInstanceIds: responsibleAdvisorIds,
        openAlertSeverity: pod.alertSummary.severity,
      },
      mission: {
        missionId: slice.missionId,
        manifestVersion: slice.manifestVersion,
        manifestVerified: manifest.manifestVersion === slice.manifestVersion,
        missionSequence: slice.missionSequence,
        acceptedEventIds: slice.acceptedEventIds,
      },
      actor: {
        roleInstanceId: actor.roleInstanceId,
        advisorTeamId: actor.advisorTeamId,
        responsibleAdvisorStatus: actor.responsibleAdvisorStatus,
        responsibleAdvisorTeamIds: actor.advisorTeamId === null ? [] : [actor.advisorTeamId],
        responsibleAdvisorRoleInstanceIds: actor.responsibleAdvisorRoleInstanceId === null
          ? []
          : [actor.responsibleAdvisorRoleInstanceId],
        assignmentStatus: actor.assignmentStatus,
        assignmentProjectId: assignment?.projectId ?? null,
        assignmentMissionId: assignment?.missionId ?? null,
        assignmentWorkUnitId: assignment?.workUnitId ?? null,
        sourceBoundaryVerified:
          actor.teamAuthorityEvidenceRef !== null
          && actor.evidenceFreshness === 'CURRENT'
          && actor.connectionState === 'CONNECTED',
        taskMotionAllowed: actor.taskMotionAllowed,
      },
      fact: slice.fact,
    });
  });
}

export function authenticatedSpatialFingerprint(
  presentation: AuthenticatedSpatialPresentationV1,
): string {
  return JSON.stringify(parseAuthenticatedSpatialPresentation(presentation));
}

function selectedPodFor(
  presentation: AuthenticatedSpatialPresentationV1,
): SpatialTeamPodProjection | undefined {
  return presentation.projection.pods.find((pod) =>
    pod.podId === presentation.projection.selectedPodId);
}

function spatialSelection(
  mode: SpatialPresentationTier,
  reasonCode: AuthenticatedSpatialSelectionReason,
  requestedTier: SpatialPresentationTier,
  presentation: AuthenticatedSpatialPresentationV1,
): AuthenticatedSpatialSelection {
  return { mode, reasonCode, requestedTier, presentation };
}

function m1Selection(
  sceneRoles: readonly RoleSceneProjection[],
  requestedTier: SpatialPresentationTier,
  reasonCode: AuthenticatedSpatialSelectionReason,
  candidate: unknown,
): AuthenticatedSpatialSelection {
  const compatibility = selectSpatialOfficeCompatibilityView(candidate, sceneRoles);
  const m1View = 'staticFallback' in compatibility
    ? compatibility
    : adaptM1FixedStations(sceneRoles, 'INVALID_SPATIAL_PROJECTION');
  return { mode: 'M1_FIXED_STATIONS', reasonCode, requestedTier, m1View };
}

function safeSchemaVersion(candidate: unknown): unknown {
  try {
    return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)
      ? (candidate as { readonly schemaVersion?: unknown }).schemaVersion
      : undefined;
  } catch {
    return undefined;
  }
}
