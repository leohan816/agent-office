import type { AdvisorInboxService } from '../application/advisor-inbox/service.js';
import type { DurableAlertCenter } from '../application/alerts/index.js';
import {
  projectOrganizationFrame,
  type OrganizationFrame,
  type RuntimeWorkInput,
} from '../application/organization/index.js';
import { projectRequiredObservable } from '../domain/activity/index.js';
import { ORGANIZATION_EVIDENCE, ORGANIZATION_REGISTRY } from '../../fixtures/organization-registry.js';
import type { OfficeStationId } from '../ui/scene/types.js';
import {
  buildAuthenticatedSpatialPresentation,
  type AuthenticatedSpatialPresentationV1,
} from '../application/spatial-office/authenticated-projection.js';
import {
  buildDashboardViewModel,
  type DashboardViewModel,
  type RequiredGateInput,
} from '../application/queries/dashboard-view-model.js';
import {
  applyMissionEvent,
  createInitialProjection,
  type MissionProjection,
} from '../application/projections/mission-projector.js';
import type { MissionManifest } from '../domain/manifest/index.js';
import type { EventStore } from '../persistence/file-store/event-store.js';
import type { RedactedProjectionSnapshot } from '../server/application.js';
import type { CommunicationCenterModel } from '../ui/communication/types.js';
import type { AdvisorGatewayHealth } from '../adapters/gateways/advisor.js';
import type { DeliveryControlProjection } from '../operations/readiness/delivery-control.js';
import type { RoleSceneProjection } from '../ui/scene/types.js';
import type { AgentOfficeRuntimeIdentity } from './identity.js';
import type { RuntimeObservationCoordinator } from './observation-coordinator.js';

export interface RuntimeProjectionServices {
  readonly manifest: MissionManifest;
  readonly store: EventStore;
  readonly inbox: AdvisorInboxService;
  readonly alerts: DurableAlertCenter;
  readonly runtime: AgentOfficeRuntimeIdentity;
  readonly observations: RuntimeObservationCoordinator;
  readonly projectionRevision: number;
  readonly deliveryControl: DeliveryControlProjection;
  readonly gatewayHealth: AdvisorGatewayHealth;
}

/**
 * Batch A additive derived view (design delta §2.2): the Living Office presentation is a derived
 * view of the SAME runtime projection. It never re-sources mission/workUnit/activity/operationalState
 * — those are read from the existing (RT) `sceneRoles` via `projectRequiredObservable`, joined with
 * the committed local/static organization registry (A) + accepted evidence (B). `sceneRoles` and
 * `spatialOffice` are preserved unchanged.
 */
export interface LivingOfficePresentationV1 {
  readonly schemaVersion: 'agent-office.living-office-presentation.v1';
  readonly projectionRevision: number;
  readonly evaluatedAt: string;
  readonly frame: OrganizationFrame;
}

export interface RuntimeProjectionSnapshot extends RedactedProjectionSnapshot {
  readonly livingOffice?: LivingOfficePresentationV1;
}

/** Deterministic committed map from RT station → committed organization registry roleInstanceId. */
const STATION_TO_ORGANIZATION_ROLE_INSTANCE_ID: Partial<Record<OfficeStationId, string>> = {
  advisor: 'foundation-advisor',
  control: 'foundation-control',
  fable5: 'foundation-reviewer',
  'agent-office': 'agent-office-worker',
  cosmile: 'cosmile-worker',
  siasiu: 'siasiu-worker',
};

function livingOfficeRuntimeRows(
  sceneRoles: readonly RoleSceneProjection[],
): readonly RuntimeWorkInput[] {
  const rows: RuntimeWorkInput[] = [];
  for (const role of sceneRoles) {
    const roleInstanceId = STATION_TO_ORGANIZATION_ROLE_INSTANCE_ID[role.stationId];
    if (roleInstanceId === undefined || role.workUnitState === undefined) continue;
    const observable = projectRequiredObservable(role.workUnitState, role.activity, role.evaluatedAt);
    rows.push({
      roleInstanceId,
      mission: role.missionId ?? null,
      workUnit: role.workUnitId ?? null,
      observableName: observable.requiredObservableName,
      staleOrInvalid: role.connectionState !== 'CONNECTED',
    });
  }
  return rows;
}

function buildLivingOfficePresentation(
  sceneRoles: readonly RoleSceneProjection[],
  projectionRevision: number,
  evaluatedAt: string,
): LivingOfficePresentationV1 {
  return {
    schemaVersion: 'agent-office.living-office-presentation.v1',
    projectionRevision,
    evaluatedAt,
    frame: projectOrganizationFrame({
      registry: ORGANIZATION_REGISTRY,
      evidence: ORGANIZATION_EVIDENCE,
      runtime: livingOfficeRuntimeRows(sceneRoles),
      evaluatedAt,
    }),
  };
}

export async function buildRuntimeProjection(
  services: RuntimeProjectionServices,
): Promise<RuntimeProjectionSnapshot> {
  const mission = foldMissionProjection(services.manifest, services.store);
  const inbox = services.inbox.project();
  const alerts = services.alerts.project();
  const now = services.runtime.now();
  const events = services.store.readAll();
  const dashboard = buildDashboardViewModel({
    fixtureKind: 'APPLICATION_PROJECTION',
    mission,
    observations: services.observations.workUnitObservations(mission, events),
    blockers: [],
    evidence: services.observations.dashboardEvidence(),
    requiredGates: runtimeGates(mission),
    futureUnapprovedWork: services.manifest.futureUnapprovedWork,
  });
  const alertViews = await Promise.all(
    Object.values(alerts)
      .sort((left, right) => left.alertId.localeCompare(right.alertId))
      .map(async (alert) => {
        const detail = await services.alerts.readDetail(alert);
        return {
          alertId: alert.alertId,
          kind: alert.payload.kind,
          severity: alert.payload.severity,
          state: alert.state,
          title: alert.payload.titleKey,
          summary: alert.payload.resolutionCondition,
          occurrenceCount: alert.payload.occurrenceCount,
          deduplicationKey: alert.deduplicationKey,
          actionCodes: alert.payload.actionCodes,
          detail,
        };
      }),
  );
  const communication: CommunicationCenterModel = {
    fixtureKind: 'APPLICATION_PROJECTION',
    manifestVersion: mission.manifestVersion,
    missionOptions: [{ id: mission.missionId, label: services.manifest.package.labelKo }],
    allowlistedEntityIds: Object.keys(mission.workUnits).sort(),
    draftRequestId: services.runtime.nextId(),
    draftCreatedAt: now,
    deliveryActivation: activationProjection(services.deliveryControl, services.gatewayHealth),
    messages: Object.values(inbox.messages)
      .sort((left, right) => left.persistedMissionSequence - right.persistedMissionSequence)
      .map((message) => {
        const notification = message.notificationId === undefined
          ? undefined
          : inbox.notifications[message.notificationId];
        return {
        messageId: message.messageId,
        requestId: message.requestId,
        missionId: message.missionId,
        kind: message.kind,
        subject: `${message.kind} / ${message.messageId}`,
        state: message.state,
        payloadHash: message.messagePayloadHash,
        artifactRef: message.messageArtifactRef,
        artifactHash: message.messageArtifactHash,
        transportState: transportProjection(notification),
        advisorEvidenceState: advisorEvidenceProjection(message),
        ...(message.authorityRole === undefined ? {} : { authorityRole: message.authorityRole }),
        evidenceHashes: [
          message.acknowledgementEvidenceRef?.sha256,
          message.intakeEvidenceRef?.sha256,
          message.decisionEvidenceRef?.sha256,
          ...(message.resumeEvidenceRefs ?? []).map((reference) => reference.sha256),
        ].filter((value): value is string => value !== undefined),
        timeline: message.timeline.map((item) => ({
          state: item.state,
          occurredAt: item.recordedAt,
          evidenceRef: item.evidenceRef,
        })),
        };
      }),
    alerts: alertViews,
  };
  const sceneRoles: readonly RoleSceneProjection[] = services.observations.sceneRoles(
    mission,
    events,
    alerts,
  );
  const spatialOffice = authenticatedSpatialPresentation({
    services,
    mission,
    dashboard,
    sceneRoles,
    events,
    alerts,
  });
  return {
    schemaVersion: 'agent-office.redacted-projection.v1',
    revision: services.projectionRevision,
    missionId: mission.missionId,
    notificationIds: Object.keys(inbox.notifications).sort(),
    openAlertIds: Object.values(alerts)
      .filter((alert) => alert.state !== 'RESOLVED' && alert.state !== 'SUPPRESSED')
      .map((alert) => alert.alertId)
      .sort(),
    dashboard,
    communication,
    sceneRoles,
    ...(spatialOffice === undefined ? {} : { spatialOffice }),
    livingOffice: buildLivingOfficePresentation(sceneRoles, services.projectionRevision, now),
  };
}

function authenticatedSpatialPresentation(input: {
  readonly services: RuntimeProjectionServices;
  readonly mission: MissionProjection;
  readonly dashboard: DashboardViewModel;
  readonly sceneRoles: readonly RoleSceneProjection[];
  readonly events: ReturnType<EventStore['readAll']>;
  readonly alerts: ReturnType<DurableAlertCenter['project']>;
}): AuthenticatedSpatialPresentationV1 | undefined {
  const snapshot = input.services.observations.snapshot();
  const openAlerts = Object.values(input.alerts)
    .filter((alert) => alert.state !== 'RESOLVED' && alert.state !== 'SUPPRESSED');
  const ranking = { NONE: 0, INFO: 1, WARNING: 2, CRITICAL: 3 } as const;
  const severity = openAlerts.reduce<'NONE' | 'INFO' | 'WARNING' | 'CRITICAL'>((current, alert) =>
    ranking[alert.payload.severity] > ranking[current] ? alert.payload.severity : current, 'NONE');
  try {
    return buildAuthenticatedSpatialPresentation({
      manifest: input.services.manifest,
      mission: input.mission,
      dashboard: input.dashboard,
      sceneRoles: input.sceneRoles,
      events: input.events,
      observations: {
        manifestStatus: snapshot.manifest.status,
        manifestEvidenceId: snapshot.manifest.evidence.evidenceId,
        refreshedAt: snapshot.refreshedAt,
        actors: Object.fromEntries(Object.values(snapshot.actors).map((actor) => [
          actor.roleInstanceId,
          {
            roleInstanceId: actor.roleInstanceId,
            actorRole: actor.actorRole,
            projectId: actor.projectId,
            hostId: actor.hostId,
            presentation: actor.presentation,
            connectionState: actor.connectionState,
            evidenceRefs: actor.evidenceRefs,
          },
        ])),
      },
      projectionRevision: input.services.projectionRevision,
      alertSummary: { severity, openCount: openAlerts.length },
    });
  } catch {
    return undefined;
  }
}

function activationProjection(
  control: DeliveryControlProjection,
  health: AdvisorGatewayHealth,
): CommunicationCenterModel['deliveryActivation'] {
  if (control.mode === 'DISABLED_DEFAULT') return 'DISABLED';
  if (control.mode === 'DISABLED_LATCHED') return 'KILLED';
  if (health.status === 'READY') return 'READY';
  return health.failureCode === 'ADVISOR_LOCATOR_STALE_OR_MISMATCHED' ? 'STALE' : 'CONFLICTED';
}

function transportProjection(
  notification: ReturnType<AdvisorInboxService['project']>['notifications'][string] | undefined,
): CommunicationCenterModel['messages'][number]['transportState'] {
  if (notification === undefined || notification.state === 'QUEUED') return 'QUEUED';
  if (notification.state === 'DELIVERING') return 'DELIVERING';
  if (notification.state === 'DELIVERED' || notification.state === 'ACKNOWLEDGED') return 'DELIVERED';
  if (notification.receipt?.failureCode === 'DELIVERY_RECEIPT_AMBIGUOUS') return 'AMBIGUOUS';
  return 'MANUAL_FALLBACK_REQUIRED';
}

function advisorEvidenceProjection(
  message: ReturnType<AdvisorInboxService['project']>['messages'][string],
): CommunicationCenterModel['messages'][number]['advisorEvidenceState'] {
  if ((message.resumeEvidenceRefs?.length ?? 0) > 0) return 'RESUME_RECORDED';
  if (message.state === 'DECISION_LINKED' || message.state === 'CLOSED') return 'DECISION_LINKED';
  if (message.state === 'INTAKE_RECORDED') {
    return message.intakeClassification === 'NEEDS_LEO_DECISION'
      ? 'NEEDS_LEO_DECISION'
      : 'INTAKE_RECORDED';
  }
  if (message.state === 'ACKNOWLEDGED') return 'ACKNOWLEDGED';
  return 'NOT_ACKNOWLEDGED';
}

function foldMissionProjection(
  manifest: MissionManifest,
  store: EventStore,
): MissionProjection {
  let projection = createInitialProjection(manifest);
  for (const event of store.readAll()) {
    projection = applyMissionEvent(projection, event);
  }
  return projection;
}

function runtimeGates(mission: MissionProjection): readonly RequiredGateInput[] {
  return [
    gate('DESIGN_REVIEW', 'Design review', mission.workUnits['AO-WU-05']?.state),
    gate('IMPLEMENTATION_REVIEW', 'Implementation review', mission.workUnits['AO-WU-13']?.state),
    gate('PRIVATE_RUN_VERIFY', 'Private run verification', mission.workUnits['AO-WU-14']?.state),
    gate('FINAL_APPROVAL', 'Leo/GPT final approval', mission.workUnits['AO-WU-15']?.state),
  ];
}

function gate(
  gateId: string,
  label: string,
  state: string | undefined,
): RequiredGateInput {
  return {
    gateId,
    label,
    status: state === 'COMPLETED' ? 'PASSED' : state === 'FAILED' ? 'FAILED' : 'PENDING',
    required: true,
  };
}

export type { DashboardViewModel };
