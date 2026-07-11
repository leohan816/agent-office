import { DomainError } from '../../contracts/types.js';
import { isRecord } from '../../contracts/validation.js';
import type { EventEnvelope } from '../../domain/events/index.js';
import type { AdvisorMessageKind } from '../../domain/messages/index.js';
import {
  MESSAGE_TRANSITIONS,
  NOTIFICATION_TRANSITIONS,
  assertEntityTransition,
  type MessageState,
  type NotificationState,
} from '../../domain/state-machines/entities.js';
import {
  assertAdvisorGatewayReceipt,
  assertAdvisorNotificationRequest,
  type AdvisorGatewayReceipt,
} from '../../adapters/gateways/advisor.js';
import { ADVISOR_MESSAGE_KINDS } from '../../domain/messages/index.js';
import type {
  AdvisorInboxProjection,
  AdvisorMessageProjection,
  NotificationProjection,
} from './types.js';

export function projectAdvisorInbox(events: readonly EventEnvelope[]): AdvisorInboxProjection {
  let messages: Record<string, AdvisorMessageProjection> = {};
  let notifications: Record<string, NotificationProjection> = {};
  for (const event of events) {
    const payload = requirePayload(event);
    switch (event.eventType) {
      case 'AdvisorMessagePersisted': {
        const messageId = stringField(payload, 'messageId');
        if (messages[messageId] !== undefined) corrupt('message identity was persisted twice');
        messages = {
          ...messages,
          [messageId]: {
            messageId,
            requestId: stringField(payload, 'requestId'),
            missionId: event.missionId,
            manifestVersion: event.manifestVersion,
            kind: messageKind(payload),
            messageArtifactRef: stringField(payload, 'messageArtifactRef'),
            messageArtifactHash: stringField(payload, 'messageArtifactHash'),
            messagePayloadHash: stringField(payload, 'messagePayloadHash'),
            persistedEventId: event.eventId,
            persistedMissionSequence: event.sequence,
            correlationId: event.correlationId,
            state: 'PERSISTED',
            timeline: [timeline('PERSISTED', event, stringField(payload, 'messageArtifactRef'))],
          },
        };
        break;
      }
      case 'AdvisorMessageDeliveryQueued': {
        const message = requireMessage(messages, payload);
        messages = updateMessage(messages, transitionMessage(message, 'DELIVERY_PENDING', event, 'OUTBOX'));
        const updated = messages[message.messageId];
        if (updated === undefined) corrupt('queued message disappeared');
        messages = updateMessage(messages, {
          ...updated,
          notificationId: stringField(payload, 'notificationId'),
        });
        break;
      }
      case 'AdvisorMessageDelivered':
        messages = transitionFromPayload(messages, payload, 'DELIVERED', event, stringField(payload, 'receiptArtifactRef'));
        break;
      case 'AdvisorMessageDeliveryFailed':
        messages = transitionFromPayload(messages, payload, 'DELIVERY_FAILED', event, stringField(payload, 'receiptArtifactRef'));
        break;
      case 'AdvisorMessageManualFallbackRequired':
        messages = transitionFromPayload(
          messages,
          payload,
          'MANUAL_FALLBACK_REQUIRED',
          event,
          stringField(payload, 'receiptArtifactRef'),
        );
        break;
      case 'AdvisorMessageAcknowledged': {
        const message = requireMessage(messages, payload);
        const artifactRef = stringField(payload, 'acknowledgementArtifactRef');
        messages = updateMessage(messages, {
          ...transitionMessage(message, 'ACKNOWLEDGED', event, artifactRef),
          acknowledgementArtifactRef: artifactRef,
        });
        break;
      }
      case 'AdvisorIntakeRecorded': {
        const message = requireMessage(messages, payload);
        const artifactRef = stringField(payload, 'intakeArtifactRef');
        messages = updateMessage(messages, {
          ...transitionMessage(message, 'INTAKE_RECORDED', event, artifactRef),
          intakeArtifactRef: artifactRef,
        });
        break;
      }
      case 'AdvisorMessageDecisionLinked': {
        const message = requireMessage(messages, payload);
        const artifactRef = stringField(payload, 'decisionArtifactRef');
        messages = updateMessage(messages, {
          ...transitionMessage(message, 'DECISION_LINKED', event, artifactRef),
          decisionArtifactRef: artifactRef,
        });
        break;
      }
      case 'AdvisorMessageClosed':
        messages = transitionFromPayload(messages, payload, 'CLOSED', event, 'CLOSED');
        break;
      case 'NotificationQueued': {
        const notificationId = stringField(payload, 'notificationId');
        if (notifications[notificationId] !== undefined) corrupt('notification identity was queued twice');
        const request = payload.gatewayRequest;
        if (!isRecord(request)) corrupt('notification gateway request is missing');
        assertAdvisorNotificationRequest(request);
        notifications = {
          ...notifications,
          [notificationId]: {
            notificationId,
            messageId: stringField(payload, 'messageId'),
            state: 'QUEUED',
            request,
            attempt: 0,
          },
        };
        break;
      }
      case 'NotificationDeliveryStarted':
        notifications = transitionNotification(notifications, payload, 'DELIVERING', event);
        break;
      case 'NotificationDelivered':
        notifications = terminalNotification(notifications, payload, 'DELIVERED', event);
        break;
      case 'NotificationFailed':
        notifications = terminalNotification(notifications, payload, 'FAILED', event);
        break;
      case 'NotificationManualFallbackRequired':
        notifications = terminalNotification(notifications, payload, 'MANUAL_FALLBACK_REQUIRED', event);
        break;
      case 'NotificationAcknowledged':
        notifications = transitionNotification(notifications, payload, 'ACKNOWLEDGED', event);
        break;
      case 'NotificationCancelled':
        notifications = transitionNotification(notifications, payload, 'CANCELLED', event);
        break;
      case 'WorkUnitStateTransitioned': {
        const messageId = typeof payload.messageId === 'string' ? payload.messageId : undefined;
        const artifactRef =
          typeof payload.resumeProofArtifactRef === 'string' ? payload.resumeProofArtifactRef : undefined;
        const message = messageId === undefined ? undefined : messages[messageId];
        if (message !== undefined && artifactRef !== undefined) {
          messages = updateMessage(messages, { ...message, resumeProofArtifactRef: artifactRef });
        }
        break;
      }
      default:
        break;
    }
  }
  return { messages, notifications };
}

function transitionFromPayload(
  messages: Record<string, AdvisorMessageProjection>,
  payload: Record<string, unknown>,
  state: MessageState,
  event: EventEnvelope,
  evidenceRef: string,
): Record<string, AdvisorMessageProjection> {
  return updateMessage(messages, transitionMessage(requireMessage(messages, payload), state, event, evidenceRef));
}

function transitionMessage(
  message: AdvisorMessageProjection,
  state: MessageState,
  event: EventEnvelope,
  evidenceRef: string,
): AdvisorMessageProjection {
  assertEntityTransition(MESSAGE_TRANSITIONS, message.state, state);
  return {
    ...message,
    state,
    timeline: [...message.timeline, timeline(state, event, evidenceRef)],
  };
}

function transitionNotification(
  notifications: Record<string, NotificationProjection>,
  payload: Record<string, unknown>,
  state: NotificationState,
  event: EventEnvelope,
): Record<string, NotificationProjection> {
  const notificationId = stringField(payload, 'notificationId');
  const current = notifications[notificationId];
  if (current === undefined) corrupt('notification transition has no queued identity');
  assertEntityTransition(NOTIFICATION_TRANSITIONS, current.state, state);
  return {
    ...notifications,
    [notificationId]: {
      ...current,
      state,
      attempt: event.eventType === 'NotificationDeliveryStarted' ? current.attempt + 1 : current.attempt,
    },
  };
}

function terminalNotification(
  notifications: Record<string, NotificationProjection>,
  payload: Record<string, unknown>,
  state: 'DELIVERED' | 'FAILED' | 'MANUAL_FALLBACK_REQUIRED',
  event: EventEnvelope,
): Record<string, NotificationProjection> {
  const transitioned = transitionNotification(notifications, payload, state, event);
  const notificationId = stringField(payload, 'notificationId');
  const current = transitioned[notificationId];
  if (current === undefined || !isRecord(payload.receipt)) corrupt('terminal notification receipt is missing');
  assertAdvisorGatewayReceipt(payload.receipt as unknown as AdvisorGatewayReceipt);
  return {
    ...transitioned,
    [notificationId]: {
      ...current,
      receipt: payload.receipt as unknown as AdvisorGatewayReceipt,
      receiptArtifactRef: stringField(payload, 'receiptArtifactRef'),
    },
  };
}

function requirePayload(event: EventEnvelope): Record<string, unknown> {
  if (!isRecord(event.payload)) corrupt(`${event.eventType} payload must be an object`);
  return event.payload;
}

function requireMessage(
  messages: Record<string, AdvisorMessageProjection>,
  payload: Record<string, unknown>,
): AdvisorMessageProjection {
  const message = messages[stringField(payload, 'messageId')];
  if (message === undefined) corrupt('message transition has no persisted identity');
  return message;
}

function updateMessage(
  messages: Record<string, AdvisorMessageProjection>,
  message: AdvisorMessageProjection,
): Record<string, AdvisorMessageProjection> {
  return { ...messages, [message.messageId]: message };
}

function timeline(
  state: MessageState,
  event: EventEnvelope,
  evidenceRef: string,
): AdvisorMessageProjection['timeline'][number] {
  return { state, eventId: event.eventId, recordedAt: event.recordedAt, evidenceRef };
}

function stringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) corrupt(`${key} must be a string`);
  return value;
}

function messageKind(payload: Record<string, unknown>): AdvisorMessageKind {
  const value = stringField(payload, 'kind');
  if (!ADVISOR_MESSAGE_KINDS.includes(value as AdvisorMessageKind)) {
    corrupt('persisted Advisor message kind is invalid');
  }
  return value as AdvisorMessageKind;
}

function corrupt(message: string): never {
  throw new DomainError('STORE_QUARANTINED', message);
}
