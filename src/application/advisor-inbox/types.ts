import type { ActorReference, SourceArtifactRef } from '../../contracts/types.js';
import type { ResumeProof } from '../../domain/decisions/resume-proof.js';
import type { AdvisorMessageKind, SubmitAdvisorMessage } from '../../domain/messages/index.js';
import type { MessageState, NotificationState } from '../../domain/state-machines/entities.js';
import type { AdvisorGatewayReceipt, AdvisorNotificationRequest } from '../../adapters/gateways/advisor.js';

export interface ApplicationCommandContext {
  readonly actor: ActorReference;
  readonly correlationId: string;
  readonly causationId: string;
  readonly receivedAt: string;
}

export interface AdvisorInboxRuntime {
  nextId(): string;
  now(): string;
}

export interface AdvisorInboxPolicy {
  readonly missionId: string;
  readonly manifestVersion: number;
  readonly allowlistedEntityIds: ReadonlySet<string>;
}

export interface AdvisorMessagePersistenceReceipt {
  readonly requestId: string;
  readonly messageId: string;
  readonly messageArtifactRef: string;
  readonly messageArtifactHash: string;
  readonly messagePayloadHash: string;
  readonly persistedEventId: string;
  readonly persistedMissionSequence: number;
  readonly acceptedAt: string;
  readonly status: 'PERSISTED';
  readonly replayed: boolean;
}

export const ADVISOR_INTAKE_CLASSIFICATIONS = [
  'ROUTINE_ROUTE',
  'NEEDS_LEO_DECISION',
  'NO_ACTION',
  'REJECTED_OUT_OF_SCOPE',
] as const;

export type AdvisorIntakeClassification = (typeof ADVISOR_INTAKE_CLASSIFICATIONS)[number];

export interface RecordAdvisorAcknowledgement {
  readonly requestId: string;
  readonly messageId: string;
  readonly acknowledgementId: string;
  readonly acknowledgedAt: string;
  readonly evidenceRefs: readonly string[];
}

export interface RecordAdvisorIntake {
  readonly requestId: string;
  readonly messageId: string;
  readonly intakeId: string;
  readonly classification: AdvisorIntakeClassification;
  readonly recordedAt: string;
  readonly evidenceRefs: readonly string[];
}

export interface LinkAdvisorDecision {
  readonly requestId: string;
  readonly messageId: string;
  readonly decisionId: string;
  readonly decisionArtifact: SourceArtifactRef;
  readonly recordedAt: string;
}

export interface ResumeAdvisorWork {
  readonly requestId: string;
  readonly messageId: string;
  readonly from: 'BLOCKED' | 'WAITING_ADVISOR' | 'WAITING_LEO' | 'HOLD';
  readonly proof: ResumeProof;
  readonly recordedAt: string;
}

export interface CloseAdvisorMessage {
  readonly requestId: string;
  readonly messageId: string;
  readonly closedAt: string;
  readonly reasonCode: string;
}

export interface MessageTimelineEntry {
  readonly state: MessageState;
  readonly eventId: string;
  readonly recordedAt: string;
  readonly evidenceRef: string;
}

export interface AdvisorMessageProjection {
  readonly messageId: string;
  readonly requestId: string;
  readonly missionId: string;
  readonly manifestVersion: number;
  readonly kind: AdvisorMessageKind;
  readonly messageArtifactRef: string;
  readonly messageArtifactHash: string;
  readonly messagePayloadHash: string;
  readonly persistedEventId: string;
  readonly persistedMissionSequence: number;
  readonly correlationId: string;
  readonly state: MessageState;
  readonly notificationId?: string;
  readonly acknowledgementArtifactRef?: string;
  readonly intakeArtifactRef?: string;
  readonly decisionArtifactRef?: string;
  readonly resumeProofArtifactRef?: string;
  readonly timeline: readonly MessageTimelineEntry[];
}

export interface NotificationProjection {
  readonly notificationId: string;
  readonly messageId: string;
  readonly state: NotificationState;
  readonly request: AdvisorNotificationRequest;
  readonly attempt: number;
  readonly receipt?: AdvisorGatewayReceipt;
  readonly receiptArtifactRef?: string;
}

export interface AdvisorInboxProjection {
  readonly messages: Readonly<Record<string, AdvisorMessageProjection>>;
  readonly notifications: Readonly<Record<string, NotificationProjection>>;
}

export interface BrowserAdvisorApplicationPort {
  submitAdvisorMessage(command: SubmitAdvisorMessage): Promise<AdvisorMessagePersistenceReceipt>;
}
