import type { AdvisorInboxService } from '../application/advisor-inbox/service.js';
import type { DurableAlertCenter } from '../application/alerts/index.js';
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
}

export async function buildRuntimeProjection(
  services: RuntimeProjectionServices,
): Promise<RedactedProjectionSnapshot> {
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
    messages: Object.values(inbox.messages)
      .sort((left, right) => left.persistedMissionSequence - right.persistedMissionSequence)
      .map((message) => ({
        messageId: message.messageId,
        requestId: message.requestId,
        missionId: message.missionId,
        kind: message.kind,
        subject: `${message.kind} / ${message.messageId}`,
        state: message.state,
        payloadHash: message.messagePayloadHash,
        artifactRef: message.messageArtifactRef,
        artifactHash: message.messageArtifactHash,
        timeline: message.timeline.map((item) => ({
          state: item.state,
          occurredAt: item.recordedAt,
          evidenceRef: item.evidenceRef,
        })),
      })),
    alerts: alertViews,
  };
  const sceneRoles: readonly RoleSceneProjection[] = services.observations.sceneRoles(
    mission,
    events,
    alerts,
  );
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
  };
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
