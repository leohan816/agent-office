import type { ActorReference, JsonValue } from '../../contracts/types.js';
import { ACTOR_ROLES, DomainError } from '../../contracts/types.js';
import { asJsonValue } from '../../contracts/validation.js';
import { hashCanonical, isSha256 } from '../../persistence/file-store/hashing.js';
import { assertUtcTimestamp, assertUuidV7 } from '../time/index.js';

export const EVENT_TYPES = [
  'MissionManifestRegistered',
  'MissionScopeChanged',
  'WorkUnitStateTransitioned',
  'WorkUnitCompletionRevoked',
  'WorkUnitRetryAuthorized',
  'RoleActivityChanged',
  'EvidenceAttached',
  'EvidenceVerified',
  'EvidenceMarkedStale',
  'EvidenceInvalidated',
  'ReviewResultRecorded',
  'AdvisorMessagePersisted',
  'AdvisorMessageDeliveryQueued',
  'AdvisorMessageDelivered',
  'AdvisorMessageDeliveryFailed',
  'AdvisorMessageAcknowledged',
  'AdvisorIntakeRecorded',
  'AdvisorMessageClosed',
  'DecisionRequested',
  'DecisionAcknowledged',
  'DecisionRecorded',
  'DecisionApplied',
  'DecisionSuperseded',
  'DecisionWithdrawn',
  'BlockerOpened',
  'BlockerAcknowledged',
  'BlockerRouteChanged',
  'BlockerResolved',
  'BlockerSuperseded',
  'AlertRaised',
  'AlertAcknowledged',
  'AlertSnoozed',
  'AlertResolved',
  'AlertSuppressed',
  'NotificationQueued',
  'NotificationDeliveryStarted',
  'NotificationDelivered',
  'NotificationAcknowledged',
  'NotificationFailed',
  'NotificationManualFallbackRequired',
  'NotificationCancelled',
  'ProjectionCheckpointed',
  'RecoveryStarted',
  'RecoveryCompleted',
  'RecoveryFailed',
  'StoreQuarantined',
  'HostObservationAccepted',
  'HostObservationGapDetected',
  'HostMarkedStale',
  'HostReconnected',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface CommandEnvelope<TPayload extends JsonValue = JsonValue> {
  readonly schemaVersion: 'agent-office.command-envelope.v1';
  readonly commandType: string;
  readonly commandVersion: 1;
  readonly missionId: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly causationId: string;
  readonly expectedStreamVersion: number;
  readonly manifestVersion: number;
  readonly actor: ActorReference;
  readonly occurredAt: string;
  readonly receivedAt: string;
  readonly payload: TPayload;
}

export interface EventEnvelope<TPayload extends JsonValue = JsonValue> {
  readonly schemaVersion: 'agent-office.event-envelope.v1';
  readonly eventId: string;
  readonly eventType: EventType;
  readonly eventVersion: 1;
  readonly missionId: string;
  readonly streamId: string;
  readonly sequence: number;
  readonly manifestVersion: number;
  readonly requestId: string;
  readonly correlationId: string;
  readonly causationId: string;
  readonly predecessorEventIds: readonly string[];
  readonly actor: ActorReference;
  readonly occurredAt: string;
  readonly receivedAt: string;
  readonly recordedAt: string;
  readonly payloadHash: string;
  readonly previousEventHash: string;
  readonly payload: TPayload;
  readonly eventHash: string;
}

export interface CreateEventInput<TPayload extends JsonValue = JsonValue> {
  readonly eventId: string;
  readonly eventType: EventType;
  readonly missionId: string;
  readonly sequence: number;
  readonly manifestVersion: number;
  readonly requestId: string;
  readonly correlationId: string;
  readonly causationId: string;
  readonly predecessorEventIds?: readonly string[];
  readonly actor: ActorReference;
  readonly occurredAt: string;
  readonly receivedAt: string;
  readonly recordedAt: string;
  readonly previousEventHash: string;
  readonly payload: TPayload;
}

export function commandPayloadHash(command: CommandEnvelope): string {
  assertCommandEnvelope(command);
  return hashCanonical(command);
}

export function createEvent<TPayload extends JsonValue>(
  input: CreateEventInput<TPayload>,
): EventEnvelope<TPayload> {
  const payload = asJsonValue(input.payload, 'event payload') as TPayload;
  const withoutEventHash = {
    schemaVersion: 'agent-office.event-envelope.v1' as const,
    eventId: input.eventId,
    eventType: input.eventType,
    eventVersion: 1 as const,
    missionId: input.missionId,
    streamId: `mission:${input.missionId}`,
    sequence: input.sequence,
    manifestVersion: input.manifestVersion,
    requestId: input.requestId,
    correlationId: input.correlationId,
    causationId: input.causationId,
    predecessorEventIds: input.predecessorEventIds ?? [],
    actor: input.actor,
    occurredAt: input.occurredAt,
    receivedAt: input.receivedAt,
    recordedAt: input.recordedAt,
    payloadHash: hashCanonical(payload),
    previousEventHash: input.previousEventHash,
    payload,
  };
  const event: EventEnvelope<TPayload> = {
    ...withoutEventHash,
    eventHash: hashCanonical(withoutEventHash),
  };
  assertEventEnvelope(event);
  return event;
}

export function assertCommandEnvelope(command: CommandEnvelope): void {
  const expectedKeys = [
    'schemaVersion',
    'commandType',
    'commandVersion',
    'missionId',
    'requestId',
    'correlationId',
    'causationId',
    'expectedStreamVersion',
    'manifestVersion',
    'actor',
    'occurredAt',
    'receivedAt',
    'payload',
  ];
  const actualKeys = Object.keys(command);
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key) => !expectedKeys.includes(key))) {
    throw new DomainError('UNKNOWN_FIELD', 'command envelope fields do not match v1');
  }
  if (command.schemaVersion !== 'agent-office.command-envelope.v1' || command.commandVersion !== 1) {
    throw new DomainError('INVALID_SCHEMA', 'unsupported command envelope version');
  }
  assertUuidV7(command.requestId, 'requestId');
  assertUuidV7(command.correlationId, 'correlationId');
  assertUuidV7(command.causationId, 'causationId');
  assertUtcTimestamp(command.occurredAt, 'occurredAt');
  assertUtcTimestamp(command.receivedAt, 'receivedAt');
  if (!Number.isSafeInteger(command.expectedStreamVersion) || command.expectedStreamVersion < 0) {
    throw new DomainError('INVALID_SCHEMA', 'expectedStreamVersion must be nonnegative');
  }
  if (!Number.isSafeInteger(command.manifestVersion) || command.manifestVersion < 1) {
    throw new DomainError('INVALID_SCHEMA', 'manifestVersion must be positive');
  }
  assertActor(command.actor);
  asJsonValue(command.payload, 'command payload');
  assertNoForbiddenPayloadFields(command.payload);
}

export function assertEventEnvelope(event: EventEnvelope): void {
  const expectedKeys = [
    'schemaVersion',
    'eventId',
    'eventType',
    'eventVersion',
    'missionId',
    'streamId',
    'sequence',
    'manifestVersion',
    'requestId',
    'correlationId',
    'causationId',
    'predecessorEventIds',
    'actor',
    'occurredAt',
    'receivedAt',
    'recordedAt',
    'payloadHash',
    'previousEventHash',
    'payload',
    'eventHash',
  ];
  const actualKeys = Object.keys(event);
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => !expectedKeys.includes(key))
  ) {
    throw new DomainError('STORE_QUARANTINED', 'event envelope fields do not match v1');
  }
  if (event.schemaVersion !== 'agent-office.event-envelope.v1' || event.eventVersion !== 1) {
    throw new DomainError('STORE_QUARANTINED', 'unsupported event envelope version');
  }
  if (!EVENT_TYPES.includes(event.eventType)) {
    throw new DomainError('STORE_QUARANTINED', 'unknown event type');
  }
  assertUuidV7(event.eventId, 'eventId');
  assertUuidV7(event.requestId, 'requestId');
  assertUuidV7(event.correlationId, 'correlationId');
  assertUuidV7(event.causationId, 'causationId');
  for (const predecessor of event.predecessorEventIds) assertUuidV7(predecessor, 'predecessorEventId');
  assertUtcTimestamp(event.occurredAt, 'occurredAt');
  assertUtcTimestamp(event.receivedAt, 'receivedAt');
  assertUtcTimestamp(event.recordedAt, 'recordedAt');
  if (!Array.isArray(event.predecessorEventIds)) {
    throw new DomainError('STORE_QUARANTINED', 'predecessorEventIds must be an array');
  }
  if (!Number.isSafeInteger(event.manifestVersion) || event.manifestVersion < 1) {
    throw new DomainError('STORE_QUARANTINED', 'event manifest version must be positive');
  }
  assertActor(event.actor);
  if (!Number.isSafeInteger(event.sequence) || event.sequence < 1) {
    throw new DomainError('STORE_QUARANTINED', 'event sequence must be positive');
  }
  if (event.streamId !== `mission:${event.missionId}`) {
    throw new DomainError('STORE_QUARANTINED', 'event stream ID does not match mission');
  }
  if (!isSha256(event.payloadHash) || !isSha256(event.previousEventHash) || !isSha256(event.eventHash)) {
    throw new DomainError('STORE_QUARANTINED', 'event hash shape is invalid');
  }
  if (hashCanonical(event.payload) !== event.payloadHash) {
    throw new DomainError('STORE_QUARANTINED', 'event payload hash mismatch');
  }
  assertNoForbiddenPayloadFields(event.payload);
  const { eventHash: ignored, ...withoutEventHash } = event;
  void ignored;
  if (hashCanonical(withoutEventHash) !== event.eventHash) {
    throw new DomainError('STORE_QUARANTINED', 'event hash mismatch');
  }
}

function assertActor(actor: ActorReference): void {
  const keys = Object.keys(actor);
  if (
    keys.length !== 2 ||
    !keys.includes('role') ||
    !keys.includes('subjectId') ||
    !ACTOR_ROLES.includes(actor.role) ||
    typeof actor.subjectId !== 'string' ||
    actor.subjectId.length === 0
  ) {
    throw new DomainError('UNAUTHORIZED_ACTOR', 'actor reference is invalid');
  }
}

function assertNoForbiddenPayloadFields(value: JsonValue): void {
  if (Array.isArray(value)) {
    for (const item of value) assertNoForbiddenPayloadFields(item);
    return;
  }
  if (value === null || typeof value !== 'object') return;
  const forbidden = new Set([
    'password',
    'token',
    'secret',
    'credential',
    'credentials',
    'sessioncookie',
    'csrf',
    'authheader',
    'privatekey',
    'rawterminalinput',
    'rawterminaloutput',
  ]);
  for (const [key, item] of Object.entries(value)) {
    if (forbidden.has(key.replaceAll(/[_-]/gu, '').toLowerCase())) {
      throw new DomainError('INVALID_SCHEMA', 'event and command payloads cannot contain sensitive fields');
    }
    assertNoForbiddenPayloadFields(item);
  }
}

export function assertEventFollows(
  event: EventEnvelope,
  previous: Pick<EventEnvelope, 'sequence' | 'eventHash'> | undefined,
): void {
  const expectedSequence = previous === undefined ? 1 : previous.sequence + 1;
  if (event.sequence !== expectedSequence) {
    throw new DomainError('STORE_QUARANTINED', 'event sequence is not contiguous');
  }
  const expectedPreviousHash = previous?.eventHash ?? `sha256:${'0'.repeat(64)}`;
  if (event.previousEventHash !== expectedPreviousHash) {
    throw new DomainError('STORE_QUARANTINED', 'event hash chain is broken');
  }
}
