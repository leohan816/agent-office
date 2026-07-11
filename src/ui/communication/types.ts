import type { AdvisorMessagePersistenceReceipt, BrowserAdvisorApplicationPort } from '../../application/advisor-inbox/types.js';
import type { AdvisorAlertDetail } from '../../application/alerts/index.js';
import type { AlertActionCode, AlertKind, AlertSeverity } from '../../domain/alerts/index.js';
import type { AdvisorMessageKind } from '../../domain/messages/index.js';
import type { AlertState, MessageState } from '../../domain/state-machines/entities.js';

export interface CommunicationTimelineItem {
  readonly state: MessageState;
  readonly occurredAt: string;
  readonly evidenceRef: string;
}

export interface CommunicationMessageView {
  readonly messageId: string;
  readonly requestId: string;
  readonly missionId: string;
  readonly kind: AdvisorMessageKind;
  readonly subject: string;
  readonly state: MessageState;
  readonly payloadHash: string;
  readonly artifactRef: string;
  readonly artifactHash: string;
  readonly transportState:
    | 'QUEUED'
    | 'DELIVERING'
    | 'DELIVERED'
    | 'AMBIGUOUS'
    | 'MANUAL_FALLBACK_REQUIRED';
  readonly advisorEvidenceState:
    | 'NOT_ACKNOWLEDGED'
    | 'ACKNOWLEDGED'
    | 'INTAKE_RECORDED'
    | 'NEEDS_LEO_DECISION'
    | 'DECISION_LINKED'
    | 'RESUME_RECORDED';
  readonly authorityRole?: 'Leo/GPT' | 'Advisor';
  readonly evidenceHashes: readonly string[];
  readonly timeline: readonly CommunicationTimelineItem[];
}

export interface CommunicationAlertView {
  readonly alertId: string;
  readonly kind: AlertKind;
  readonly severity: AlertSeverity;
  readonly state: AlertState;
  readonly title: string;
  readonly summary: string;
  readonly occurrenceCount: number;
  readonly deduplicationKey: string;
  readonly actionCodes: readonly AlertActionCode[];
  readonly detail: AdvisorAlertDetail;
  readonly gptPackageMarkdown?: string;
}

export interface CommunicationCenterModel {
  readonly fixtureKind: 'SYNTHETIC_READ_ONLY' | 'APPLICATION_PROJECTION';
  readonly manifestVersion: number;
  readonly missionOptions: readonly { readonly id: string; readonly label: string }[];
  readonly allowlistedEntityIds: readonly string[];
  readonly draftRequestId: string;
  readonly draftCreatedAt: string;
  readonly deliveryActivation: 'DISABLED' | 'READY' | 'STALE' | 'KILLED' | 'CONFLICTED';
  readonly messages: readonly CommunicationMessageView[];
  readonly alerts: readonly CommunicationAlertView[];
}

export interface CommunicationCenterActionPort extends BrowserAdvisorApplicationPort {
  applyAlertLifecycle(input: {
    readonly alertId: string;
    readonly action: 'ACKNOWLEDGE' | 'SNOOZE' | 'RESOLVE' | 'SUPPRESS';
  }): Promise<void>;
  openEvidence(evidenceRef: string): Promise<void>;
}

export interface CommunicationSubmissionState {
  readonly receipt?: AdvisorMessagePersistenceReceipt;
  readonly errorCode?: string;
}
