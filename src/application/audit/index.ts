import { isRecord } from '../../contracts/validation.js';
import type { EventEnvelope, EventType } from '../../domain/events/index.js';

const LIFECYCLE_AUDIT_TYPES: ReadonlySet<EventType> = new Set([
  'AdvisorMessagePersisted',
  'AdvisorMessageDeliveryQueued',
  'AdvisorMessageDelivered',
  'AdvisorMessageDeliveryFailed',
  'AdvisorMessageManualFallbackRequired',
  'AdvisorMessageAcknowledged',
  'AdvisorIntakeRecorded',
  'AdvisorMessageDecisionLinked',
  'AdvisorMessageClosed',
  'NotificationQueued',
  'NotificationDeliveryStarted',
  'NotificationDelivered',
  'NotificationFailed',
  'NotificationManualFallbackRequired',
  'AlertRaised',
  'AlertAcknowledged',
  'AlertSnoozed',
  'AlertResolved',
  'AlertSuppressed',
  'WorkUnitStateTransitioned',
]);

const SAFE_REFERENCE_FIELDS = [
  'messageId',
  'notificationId',
  'alertId',
  'decisionId',
  'workUnitId',
  'state',
  'messageArtifactHash',
  'receiptHash',
  'acknowledgementArtifactHash',
  'intakeArtifactHash',
  'decisionArtifactHash',
  'resumeProofArtifactHash',
  'failureCode',
] as const;

export interface RedactedLifecycleAuditRecord {
  readonly eventId: string;
  readonly eventType: EventType;
  readonly missionId: string;
  readonly sequence: number;
  readonly requestId: string;
  readonly correlationId: string;
  readonly actorRole: string;
  readonly recordedAt: string;
  readonly previousEventHash: string;
  readonly eventHash: string;
  readonly references: Readonly<Record<string, string>>;
}

export function redactedLifecycleAudit(
  events: readonly EventEnvelope[],
): readonly RedactedLifecycleAuditRecord[] {
  return events.filter((event) => LIFECYCLE_AUDIT_TYPES.has(event.eventType)).map((event) => {
    const references: Record<string, string> = {};
    if (isRecord(event.payload)) {
      for (const field of SAFE_REFERENCE_FIELDS) {
        const value = event.payload[field];
        if (typeof value === 'string') references[field] = value;
      }
    }
    return {
      eventId: event.eventId,
      eventType: event.eventType,
      missionId: event.missionId,
      sequence: event.sequence,
      requestId: event.requestId,
      correlationId: event.correlationId,
      actorRole: event.actor.role,
      recordedAt: event.recordedAt,
      previousEventHash: event.previousEventHash,
      eventHash: event.eventHash,
      references,
    };
  });
}
