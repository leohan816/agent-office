import type {
  AdvisorMessagePersistenceReceipt,
  AdvisorMessageProjection,
} from '../application/advisor-inbox/types.js';
import type { AdvisorInboxService } from '../application/advisor-inbox/service.js';
import type { DurableAlertCenter, DurableAlertProjection } from '../application/alerts/index.js';
import type { SourceArtifactRef } from '../contracts/types.js';
import type { SubmitAdvisorMessage } from '../domain/messages/index.js';
import type { DashboardViewModel } from '../application/queries/dashboard-view-model.js';
import type { CommunicationCenterModel } from '../ui/communication/types.js';
import type { RoleSceneProjection } from '../ui/scene/types.js';
import type { BrowserCapability } from './auth/index.js';

export interface LocalRuntimeStatus {
  readonly schemaVersion: 'agent-office.local-runtime-status.v1';
  readonly networkMode: 'LOOPBACK_PRIVATE';
  readonly startupState:
    | 'READ_ONLY_READY'
    | 'MUTATION_READY'
    | 'CONFIG_BLOCKED'
    | 'SECOND_WRITER_BLOCKED'
    | 'AUTH_BLOCKED'
    | 'STORE_QUARANTINED'
    | 'REPLAY_FAILED'
    | 'READ_ONLY_DEGRADED';
  readonly authMode: 'LOCAL_BOOTSTRAP' | 'TEST_ONLY' | 'UNAVAILABLE_READ_ONLY';
  readonly mutationMode: 'ENABLED_LOCAL_BOOTSTRAP' | 'ENABLED_TEST_ONLY' | 'DISABLED';
  readonly deliveryMode: 'ENABLED' | 'DISABLED' | 'MANUAL_FALLBACK_REQUIRED';
  readonly sseMode: 'READY' | 'DEGRADED';
  readonly projectionRevision: number;
  readonly lastVerifiedAt: string;
}

export interface RedactedProjectionSnapshot {
  readonly schemaVersion: 'agent-office.redacted-projection.v1';
  readonly revision: number;
  readonly missionId: string;
  readonly notificationIds: readonly string[];
  readonly openAlertIds: readonly string[];
  readonly dashboard?: DashboardViewModel;
  readonly communication?: CommunicationCenterModel;
  readonly sceneRoles?: readonly RoleSceneProjection[];
}

export interface AuthenticatedProjectionSnapshot extends RedactedProjectionSnapshot {
  readonly session: {
    readonly schemaVersion: 'agent-office.browser-session-context.v1';
    readonly subjectId: string;
    readonly capabilities: readonly BrowserCapability[];
    readonly csrfToken: string;
    readonly expiresAt: string;
  };
}

export interface HttpCommandContext {
  readonly subjectId: string;
  readonly correlationId: string;
  readonly causationId: string;
  readonly receivedAt: string;
}

export interface AdvisorAcknowledgementHttpCommand extends HttpCommandContext {
  readonly requestId: string;
  readonly messageId: string;
  readonly acknowledgementId: string;
  readonly acknowledgedAt: string;
  readonly evidenceRefs: readonly string[];
}

export interface AdvisorIntakeHttpCommand extends HttpCommandContext {
  readonly requestId: string;
  readonly messageId: string;
  readonly intakeId: string;
  readonly classification: 'ROUTINE_ROUTE' | 'NEEDS_LEO_DECISION' | 'NO_ACTION' | 'REJECTED_OUT_OF_SCOPE';
  readonly recordedAt: string;
  readonly evidenceRefs: readonly string[];
}

export interface AdvisorDecisionHttpCommand extends HttpCommandContext {
  readonly requestId: string;
  readonly messageId: string;
  readonly decisionId: string;
  readonly authorityRole: 'Leo/GPT' | 'Advisor';
  readonly decisionArtifact: SourceArtifactRef;
  readonly recordedAt: string;
}

export interface AlertAcknowledgementHttpCommand extends HttpCommandContext {
  readonly requestId: string;
  readonly alertId: string;
  readonly recordedAt: string;
  readonly reasonCode: string;
}

export interface DeliveryDisableHttpCommand extends HttpCommandContext {
  readonly requestId: string;
  readonly disabledAt: string;
  readonly reasonCode: string;
}

export interface DeliveryDisableReceipt {
  readonly requestId: string;
  readonly status: 'DISABLED';
  readonly disabledAt: string;
  readonly reasonCode: string;
  readonly replayed: boolean;
}

export interface AgentOfficeHttpApplication {
  readStatus(): Promise<LocalRuntimeStatus>;
  readProjection(): Promise<RedactedProjectionSnapshot>;
  submitAdvisorMessage(
    command: SubmitAdvisorMessage,
    context: HttpCommandContext,
  ): Promise<AdvisorMessagePersistenceReceipt>;
  recordAdvisorAcknowledgement(
    command: AdvisorAcknowledgementHttpCommand,
  ): Promise<AdvisorMessageProjection>;
  recordAdvisorIntake(command: AdvisorIntakeHttpCommand): Promise<AdvisorMessageProjection>;
  recordAdvisorDecision(command: AdvisorDecisionHttpCommand): Promise<AdvisorMessageProjection>;
  acknowledgeAlert(command: AlertAcknowledgementHttpCommand): Promise<DurableAlertProjection>;
  disableDelivery(command: DeliveryDisableHttpCommand): Promise<DeliveryDisableReceipt>;
}

export interface BindBatchDApplicationOptions {
  readonly inbox: AdvisorInboxService;
  readonly alerts: DurableAlertCenter;
  readonly readStatus: () => Promise<LocalRuntimeStatus>;
  readonly readProjection: () => Promise<RedactedProjectionSnapshot>;
  readonly disableDelivery: (
    command: DeliveryDisableHttpCommand,
  ) => Promise<DeliveryDisableReceipt>;
}

export function bindBatchDApplication(
  options: BindBatchDApplicationOptions,
): AgentOfficeHttpApplication {
  return {
    readStatus: options.readStatus,
    readProjection: options.readProjection,
    submitAdvisorMessage: (command, context) =>
      options.inbox.persistMessage(command, {
        actor: { role: 'Leo/GPT', subjectId: context.subjectId },
        correlationId: context.correlationId,
        causationId: context.causationId,
        receivedAt: context.receivedAt,
      }),
    recordAdvisorAcknowledgement: (command) =>
      options.inbox.recordAcknowledgement(
        {
          requestId: command.requestId,
          messageId: command.messageId,
          acknowledgementId: command.acknowledgementId,
          acknowledgedAt: command.acknowledgedAt,
          evidenceRefs: command.evidenceRefs,
        },
        advisorContext(command),
      ),
    recordAdvisorIntake: (command) =>
      options.inbox.recordIntake(
        {
          requestId: command.requestId,
          messageId: command.messageId,
          intakeId: command.intakeId,
          classification: command.classification,
          recordedAt: command.recordedAt,
          evidenceRefs: command.evidenceRefs,
        },
        advisorContext(command),
      ),
    recordAdvisorDecision: (command) =>
      options.inbox.linkDecision(
        {
          requestId: command.requestId,
          messageId: command.messageId,
          decisionId: command.decisionId,
          authorityRole: command.authorityRole,
          decisionArtifact: command.decisionArtifact,
          recordedAt: command.recordedAt,
        },
        advisorContext(command),
      ),
    acknowledgeAlert: (command) =>
      options.alerts.acknowledge(
        {
          requestId: command.requestId,
          alertId: command.alertId,
          recordedAt: command.recordedAt,
          reasonCode: command.reasonCode,
        },
        advisorContext(command),
      ),
    disableDelivery: options.disableDelivery,
  };
}

function advisorContext(command: HttpCommandContext) {
  return {
    actor: { role: 'Advisor' as const, subjectId: command.subjectId },
    correlationId: command.correlationId,
    causationId: command.causationId,
    receivedAt: command.receivedAt,
  };
}
