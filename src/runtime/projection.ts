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
import type { AgentOfficeRuntimeIdentity } from './identity.js';

export interface RuntimeProjectionServices {
  readonly manifest: MissionManifest;
  readonly store: EventStore;
  readonly inbox: AdvisorInboxService;
  readonly alerts: DurableAlertCenter;
  readonly runtime: AgentOfficeRuntimeIdentity;
}

export function buildRuntimeProjection(
  services: RuntimeProjectionServices,
): RedactedProjectionSnapshot {
  const mission = foldMissionProjection(services.manifest, services.store);
  const inbox = services.inbox.project();
  const alerts = services.alerts.project();
  const now = services.runtime.now();
  const dashboard = buildDashboardViewModel({
    fixtureKind: 'APPLICATION_PROJECTION',
    mission,
    observations: Object.values(mission.workUnits).map((workUnit) => ({
      workUnitId: workUnit.id,
      presentation: 'CURRENT',
      observedAt: now,
      evidenceRef: 'MISSION_EVENT_PROJECTION',
      reasonCode: 'VERIFIED_LOCAL_EVENT_PROJECTION',
    })),
    blockers: [],
    evidence: [{
      evidenceId: 'MISSION_MANIFEST_SOURCE',
      label: 'M01 approved mission manifest',
      relativePath: services.manifest.source.path,
      sha256: services.manifest.source.sha256,
      commit: services.manifest.source.commit,
      verificationState: 'VERIFIED',
    }],
    requiredGates: runtimeGates(mission),
    futureUnapprovedWork: services.manifest.futureUnapprovedWork,
  });
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
    alerts: [],
  };
  return {
    schemaVersion: 'agent-office.redacted-projection.v1',
    revision: services.store.sequence,
    missionId: mission.missionId,
    notificationIds: Object.keys(inbox.notifications).sort(),
    openAlertIds: Object.values(alerts)
      .filter((alert) => alert.state !== 'RESOLVED' && alert.state !== 'SUPPRESSED')
      .map((alert) => alert.alertId)
      .sort(),
    dashboard,
    communication,
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
