import type { EntityRef, EvidenceRef, JsonValue } from '../../contracts/types.js';
import { DomainError } from '../../contracts/types.js';
import { assertExactKeys } from '../../contracts/validation.js';
import { hashCanonical } from '../../persistence/file-store/hashing.js';
import { assertUtcTimestamp, assertUuidV7 } from '../time/index.js';

export const ALERT_KINDS = [
  'NEEDS_LEO_DECISION',
  'PASS_WITH_RISK',
  'BLOCKED',
  'AUTHENTICATION_REQUIRED',
  'MANUAL_ACTION_REQUIRED',
  'FINAL_APPROVAL_REQUIRED',
  'MISSION_COMPLETE',
  'MISSION_FAILED',
  'INFORMATION',
] as const;

export type AlertKind = (typeof ALERT_KINDS)[number];
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export const ALERT_ACTION_CODES = [
  'COPY_GPT_PACKAGE',
  'OPEN_EVIDENCE',
  'REPLY_TO_ADVISOR',
  'HOLD',
  'PAUSE_MISSION',
  'CANCEL_MISSION',
] as const;

export type AlertActionCode = (typeof ALERT_ACTION_CODES)[number];

export interface AlertPolicy {
  readonly severity: AlertSeverity;
  readonly actionCodes: readonly AlertActionCode[];
}

export const ALERT_POLICIES: Readonly<Record<AlertKind, AlertPolicy>> = {
  NEEDS_LEO_DECISION: {
    severity: 'WARNING',
    actionCodes: ['COPY_GPT_PACKAGE', 'OPEN_EVIDENCE', 'REPLY_TO_ADVISOR', 'HOLD'],
  },
  PASS_WITH_RISK: {
    severity: 'WARNING',
    actionCodes: ['COPY_GPT_PACKAGE', 'OPEN_EVIDENCE', 'HOLD'],
  },
  BLOCKED: { severity: 'WARNING', actionCodes: ['OPEN_EVIDENCE', 'REPLY_TO_ADVISOR', 'HOLD'] },
  AUTHENTICATION_REQUIRED: { severity: 'WARNING', actionCodes: ['OPEN_EVIDENCE', 'HOLD'] },
  MANUAL_ACTION_REQUIRED: {
    severity: 'WARNING',
    actionCodes: ['OPEN_EVIDENCE', 'REPLY_TO_ADVISOR', 'HOLD'],
  },
  FINAL_APPROVAL_REQUIRED: {
    severity: 'WARNING',
    actionCodes: ['COPY_GPT_PACKAGE', 'OPEN_EVIDENCE', 'HOLD'],
  },
  MISSION_COMPLETE: { severity: 'INFO', actionCodes: ['OPEN_EVIDENCE'] },
  MISSION_FAILED: {
    severity: 'CRITICAL',
    actionCodes: ['OPEN_EVIDENCE', 'REPLY_TO_ADVISOR', 'PAUSE_MISSION', 'CANCEL_MISSION'],
  },
  INFORMATION: { severity: 'INFO', actionCodes: ['OPEN_EVIDENCE'] },
};

export interface AlertDeduplicationInput {
  readonly missionId: string;
  readonly kind: AlertKind;
  readonly primaryEntityRef: EntityRef;
  readonly conditionKey: string;
  readonly manifestVersion: number;
}

export interface AlertRaisedPayload extends AlertDeduplicationInput {
  readonly alertId: string;
  readonly severity: AlertSeverity;
  readonly relatedEntityRefs: readonly EntityRef[];
  readonly titleKey: string;
  readonly messageParameters: Readonly<Record<string, JsonValue>>;
  readonly actionCodes: readonly AlertActionCode[];
  readonly sourceEventIds: readonly string[];
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly deduplicationKey: string;
  readonly firstObservedAt: string;
  readonly lastObservedAt: string;
  readonly occurrenceCount: number;
  readonly resolutionCondition: string;
  readonly requestId: string;
  readonly expectedStreamVersion: number;
  readonly causationId: string;
  readonly correlationId: string;
}

export function alertDeduplicationKey(input: AlertDeduplicationInput): string {
  return hashCanonical({
    missionId: input.missionId,
    kind: input.kind,
    primaryEntityRef: input.primaryEntityRef,
    conditionKey: input.conditionKey,
    manifestVersion: input.manifestVersion,
  });
}

export function assertAlertPayload(payload: AlertRaisedPayload): void {
  assertExactKeys(
    { ...payload },
    [
      'alertId',
      'missionId',
      'kind',
      'severity',
      'primaryEntityRef',
      'relatedEntityRefs',
      'conditionKey',
      'titleKey',
      'messageParameters',
      'actionCodes',
      'sourceEventIds',
      'evidenceRefs',
      'deduplicationKey',
      'firstObservedAt',
      'lastObservedAt',
      'occurrenceCount',
      'resolutionCondition',
      'requestId',
      'manifestVersion',
      'expectedStreamVersion',
      'causationId',
      'correlationId',
    ],
    'AlertRaised payload',
  );
  assertUuidV7(payload.alertId, 'alertId');
  assertUuidV7(payload.requestId, 'requestId');
  assertUuidV7(payload.causationId, 'causationId');
  assertUuidV7(payload.correlationId, 'correlationId');
  for (const eventId of payload.sourceEventIds) assertUuidV7(eventId, 'sourceEventId');
  assertUtcTimestamp(payload.firstObservedAt, 'firstObservedAt');
  assertUtcTimestamp(payload.lastObservedAt, 'lastObservedAt');
  const policy = ALERT_POLICIES[payload.kind];
  if (payload.severity !== policy.severity) {
    throw new DomainError('INVALID_SCHEMA', `${payload.kind} must use ${policy.severity}`);
  }
  const expectedActions =
    payload.kind === 'INFORMATION' && payload.evidenceRefs.length === 0 ? [] : policy.actionCodes;
  if (
    payload.actionCodes.length !== expectedActions.length ||
    payload.actionCodes.some((action, index) => action !== expectedActions[index])
  ) {
    throw new DomainError('INVALID_SCHEMA', `${payload.kind} action codes do not match the canonical policy`);
  }
  if (payload.deduplicationKey !== alertDeduplicationKey(payload)) {
    throw new DomainError('INVALID_SCHEMA', 'alert deduplication key does not match canonical input');
  }
  if (!Number.isSafeInteger(payload.occurrenceCount) || payload.occurrenceCount < 1) {
    throw new DomainError('INVALID_SCHEMA', 'alert occurrence count must be positive');
  }
}

export function foldAlertOccurrence(
  current: AlertRaisedPayload,
  lastObservedAt: string,
): AlertRaisedPayload {
  return {
    ...current,
    lastObservedAt,
    occurrenceCount: current.occurrenceCount + 1,
  };
}
