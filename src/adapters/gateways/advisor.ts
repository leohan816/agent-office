import { DomainError } from '../../contracts/types.js';
import { assertExactKeys, assertRecord, requireInteger, requireString } from '../../contracts/validation.js';
import { canonicalize } from '../../persistence/file-store/canonical-json.js';
import { hashCanonical, isSha256 } from '../../persistence/file-store/hashing.js';
import { assertUtcTimestamp, assertUuidV7 } from '../../domain/time/index.js';

export const ADVISOR_GATEWAY_REQUEST_FIELDS = [
  'notificationId',
  'requestId',
  'missionId',
  'messageId',
  'messageArtifactRef',
  'messageArtifactHash',
  'messagePayloadHash',
  'persistedEventId',
  'persistedMissionSequence',
  'correlationId',
] as const;

export interface AdvisorNotificationRequest {
  readonly notificationId: string;
  readonly requestId: string;
  readonly missionId: string;
  readonly messageId: string;
  readonly messageArtifactRef: string;
  readonly messageArtifactHash: string;
  readonly messagePayloadHash: string;
  readonly persistedEventId: string;
  readonly persistedMissionSequence: number;
  readonly correlationId: string;
}

export const GATEWAY_FAILURE_CODES = [
  'NONE',
  'TRANSPORT_INACTIVE',
  'KILL_SWITCH_ENGAGED',
  'ADVISOR_LOCATOR_STALE_OR_MISMATCHED',
  'STATIC_LAUNCHER_UNVERIFIED',
  'DELIVERY_RECEIPT_AMBIGUOUS',
  'TOOL_TIMEOUT_OR_OUTPUT_LIMIT',
  'HERMES_NOT_IMPLEMENTED',
] as const;

export type GatewayFailureCode = (typeof GATEWAY_FAILURE_CODES)[number];
export type AdvisorGatewayAdapter = 'TMUX_ADVISOR' | 'HERMES_ADVISOR' | 'MANUAL';
export type AdvisorGatewayStatus =
  | 'DELIVERED'
  | 'ALREADY_DELIVERED'
  | 'RETRYABLE_FAILURE'
  | 'MANUAL_FALLBACK_REQUIRED'
  | 'DISABLED';

export interface AdvisorGatewayReceipt {
  readonly notificationId: string;
  readonly adapter: AdvisorGatewayAdapter;
  readonly adapterVersion: string;
  readonly status: AdvisorGatewayStatus;
  readonly attempt: number;
  readonly queuedAt: string;
  readonly attemptedAt: string;
  readonly transportEvidenceRefs: readonly string[];
  readonly failureCode: GatewayFailureCode;
  readonly receiptHash: string;
}

export interface AdvisorGatewayHealth {
  readonly adapter: AdvisorGatewayAdapter;
  readonly status: 'READY' | 'MANUAL_FALLBACK_REQUIRED' | 'DISABLED_NOT_IMPLEMENTED';
  readonly failureCode: GatewayFailureCode;
}

export interface AdvisorGateway {
  health(): AdvisorGatewayHealth;
  queueAdvisorNotification(request: AdvisorNotificationRequest): Promise<AdvisorGatewayReceipt>;
  getDeliveryReceipt(notificationId: string): Promise<AdvisorGatewayReceipt | undefined>;
}

export function assertAdvisorNotificationRequest(
  value: unknown,
): asserts value is AdvisorNotificationRequest {
  assertRecord(value, 'AdvisorNotificationRequest');
  assertExactKeys(value, ADVISOR_GATEWAY_REQUEST_FIELDS, 'AdvisorNotificationRequest');
  const notificationId = requireString(value.notificationId, 'notificationId');
  const requestId = requireString(value.requestId, 'requestId');
  const missionId = requireString(value.missionId, 'missionId');
  const messageId = requireString(value.messageId, 'messageId');
  const messageArtifactRef = requireString(value.messageArtifactRef, 'messageArtifactRef');
  const messageArtifactHash = requireString(value.messageArtifactHash, 'messageArtifactHash');
  const messagePayloadHash = requireString(value.messagePayloadHash, 'messagePayloadHash');
  const persistedEventId = requireString(value.persistedEventId, 'persistedEventId');
  const correlationId = requireString(value.correlationId, 'correlationId');
  requireInteger(value.persistedMissionSequence, 'persistedMissionSequence', 1);
  for (const [id, label] of [
    [notificationId, 'notificationId'],
    [requestId, 'requestId'],
    [messageId, 'messageId'],
    [persistedEventId, 'persistedEventId'],
    [correlationId, 'correlationId'],
  ] as const) {
    assertUuidV7(id, label);
  }
  if (
    !/^[A-Z0-9][A-Z0-9._-]{0,127}$/u.test(missionId) ||
    !isSha256(messageArtifactHash) ||
    !isSha256(messagePayloadHash)
  ) {
    throw new DomainError('INVALID_SCHEMA', 'gateway mission or artifact hash is invalid');
  }
  const expectedPrefix = `artifacts/inbox/${missionId}/${requestId}/`;
  const expectedFilename = `${messageArtifactHash.slice('sha256:'.length)}.json`;
  if (
    !messageArtifactRef.startsWith(expectedPrefix) ||
    !/^artifacts\/inbox\/[A-Z0-9][A-Z0-9._-]{0,127}\/[0-9a-f-]{36}\/[0-9a-f]{64}\.json$/u.test(
      messageArtifactRef,
    ) ||
    messageArtifactRef.includes('..') ||
    messageArtifactRef.includes('\\') ||
    !messageArtifactRef.endsWith(`/${expectedFilename}`)
  ) {
    throw new DomainError('FORBIDDEN_TARGET', 'gateway accepts only a canonical inbox artifact reference');
  }
}

export function canonicalAdvisorPointerEnvelope(request: AdvisorNotificationRequest): string {
  assertAdvisorNotificationRequest(request);
  return canonicalize({
    schemaVersion: 'agent-office.advisor-pointer-envelope.v1',
    notificationId: request.notificationId,
    requestId: request.requestId,
    missionId: request.missionId,
    messageId: request.messageId,
    messageArtifactRef: request.messageArtifactRef,
    messageArtifactHash: request.messageArtifactHash,
    persistedEventId: request.persistedEventId,
    persistedMissionSequence: request.persistedMissionSequence,
    correlationId: request.correlationId,
  });
}

export function buildAdvisorGatewayReceipt(
  input: Omit<AdvisorGatewayReceipt, 'receiptHash'>,
): AdvisorGatewayReceipt {
  const receipt: AdvisorGatewayReceipt = { ...input, receiptHash: hashCanonical(input) };
  assertAdvisorGatewayReceipt(receipt);
  return receipt;
}

export function assertAdvisorGatewayReceipt(value: AdvisorGatewayReceipt): void {
  assertUuidV7(value.notificationId, 'notificationId');
  assertUtcTimestamp(value.queuedAt, 'queuedAt');
  assertUtcTimestamp(value.attemptedAt, 'attemptedAt');
  if (!Number.isSafeInteger(value.attempt) || value.attempt < 1) {
    throw new DomainError('INVALID_SCHEMA', 'gateway attempt must be positive');
  }
  if (
    !(['TMUX_ADVISOR', 'HERMES_ADVISOR', 'MANUAL'] as const).includes(value.adapter) ||
    !(
      [
        'DELIVERED',
        'ALREADY_DELIVERED',
        'RETRYABLE_FAILURE',
        'MANUAL_FALLBACK_REQUIRED',
        'DISABLED',
      ] as const
    ).includes(value.status) ||
    !GATEWAY_FAILURE_CODES.includes(value.failureCode) ||
    !/^[a-z0-9][a-z0-9._-]{0,63}$/u.test(value.adapterVersion) ||
    value.transportEvidenceRefs.some(
      (reference) => !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u.test(reference),
    )
  ) {
    throw new DomainError('INVALID_SCHEMA', 'gateway receipt vocabulary is invalid');
  }
  if (
    (value.status === 'DELIVERED' || value.status === 'ALREADY_DELIVERED') &&
    value.failureCode !== 'NONE'
  ) {
    throw new DomainError('INVALID_SCHEMA', 'successful gateway receipt cannot contain a failure');
  }
  if (!isSha256(value.receiptHash)) {
    throw new DomainError('INVALID_SCHEMA', 'gateway receipt hash is invalid');
  }
  const { receiptHash: ignored, ...withoutHash } = value;
  void ignored;
  if (hashCanonical(withoutHash) !== value.receiptHash) {
    throw new DomainError('INVALID_SCHEMA', 'gateway receipt hash does not match');
  }
}
