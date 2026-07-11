import type {
  AdvisorAcknowledgementHttpCommand,
  AdvisorDecisionHttpCommand,
  AdvisorIntakeHttpCommand,
  AlertAcknowledgementHttpCommand,
  DeliveryDisableHttpCommand,
  HttpCommandContext,
} from '../application.js';
import { DomainError, type SourceArtifactRef } from '../../contracts/types.js';
import {
  assertExactKeys,
  assertRecord,
  requireArray,
  requireEnum,
  requireString,
} from '../../contracts/validation.js';
import { ADVISOR_INTAKE_CLASSIFICATIONS } from '../../application/advisor-inbox/types.js';
import { assertSubmitAdvisorMessage, type SubmitAdvisorMessage } from '../../domain/messages/index.js';
import { assertUtcTimestamp, assertUuidV7 } from '../../domain/time/index.js';
import { isSha256 } from '../../persistence/file-store/hashing.js';

export function parseAdvisorMessage(value: unknown): SubmitAdvisorMessage {
  assertSubmitAdvisorMessage(value);
  return value;
}

export function parseAcknowledgement(
  value: unknown,
  messageId: string,
  context: HttpCommandContext,
): AdvisorAcknowledgementHttpCommand {
  assertRecord(value, 'AdvisorAcknowledgementHttpCommand');
  assertExactKeys(
    value,
    ['requestId', 'acknowledgementId', 'acknowledgedAt', 'evidenceRefs'],
    'AdvisorAcknowledgementHttpCommand',
  );
  const requestId = uuid(value.requestId, 'requestId');
  const acknowledgementId = uuid(value.acknowledgementId, 'acknowledgementId');
  const acknowledgedAt = timestamp(value.acknowledgedAt, 'acknowledgedAt');
  const evidenceRefs = identifiers(value.evidenceRefs, 'evidenceRefs');
  assertUuidV7(messageId, 'messageId');
  return {
    ...context,
    requestId,
    messageId,
    acknowledgementId,
    acknowledgedAt,
    evidenceRefs,
  };
}

export function parseIntake(
  value: unknown,
  context: HttpCommandContext,
): AdvisorIntakeHttpCommand {
  assertRecord(value, 'AdvisorIntakeHttpCommand');
  assertExactKeys(
    value,
    ['requestId', 'messageId', 'intakeId', 'classification', 'recordedAt', 'evidenceRefs'],
    'AdvisorIntakeHttpCommand',
  );
  return {
    ...context,
    requestId: uuid(value.requestId, 'requestId'),
    messageId: uuid(value.messageId, 'messageId'),
    intakeId: uuid(value.intakeId, 'intakeId'),
    classification: requireEnum(
      value.classification,
      ADVISOR_INTAKE_CLASSIFICATIONS,
      'classification',
    ),
    recordedAt: timestamp(value.recordedAt, 'recordedAt'),
    evidenceRefs: identifiers(value.evidenceRefs, 'evidenceRefs'),
  };
}

export function parseDecision(
  value: unknown,
  context: HttpCommandContext,
): AdvisorDecisionHttpCommand {
  assertRecord(value, 'AdvisorDecisionHttpCommand');
  assertExactKeys(
    value,
    [
      'requestId',
      'messageId',
      'decisionId',
      'authorityRole',
      'decisionArtifact',
      'recordedAt',
    ],
    'AdvisorDecisionHttpCommand',
  );
  return {
    ...context,
    requestId: uuid(value.requestId, 'requestId'),
    messageId: uuid(value.messageId, 'messageId'),
    decisionId: uuid(value.decisionId, 'decisionId'),
    authorityRole: requireEnum(value.authorityRole, ['Leo/GPT', 'Advisor'] as const, 'authorityRole'),
    decisionArtifact: sourceArtifact(value.decisionArtifact),
    recordedAt: timestamp(value.recordedAt, 'recordedAt'),
  };
}

export function parseAlertAcknowledgement(
  value: unknown,
  alertId: string,
  context: HttpCommandContext,
): AlertAcknowledgementHttpCommand {
  assertRecord(value, 'AlertAcknowledgementHttpCommand');
  assertExactKeys(
    value,
    ['requestId', 'recordedAt', 'reasonCode'],
    'AlertAcknowledgementHttpCommand',
  );
  assertUuidV7(alertId, 'alertId');
  return {
    ...context,
    requestId: uuid(value.requestId, 'requestId'),
    alertId,
    recordedAt: timestamp(value.recordedAt, 'recordedAt'),
    reasonCode: stableCode(value.reasonCode, 'reasonCode'),
  };
}

export function parseDeliveryDisable(
  value: unknown,
  context: HttpCommandContext,
): DeliveryDisableHttpCommand {
  assertRecord(value, 'DeliveryDisableHttpCommand');
  assertExactKeys(
    value,
    ['requestId', 'disabledAt', 'reasonCode'],
    'DeliveryDisableHttpCommand',
  );
  return {
    ...context,
    requestId: uuid(value.requestId, 'requestId'),
    disabledAt: timestamp(value.disabledAt, 'disabledAt'),
    reasonCode: stableCode(value.reasonCode, 'reasonCode'),
  };
}

function uuid(value: unknown, label: string): string {
  const result = requireString(value, label);
  assertUuidV7(result, label);
  return result;
}

function timestamp(value: unknown, label: string): string {
  const result = requireString(value, label);
  assertUtcTimestamp(result, label);
  return result;
}

function identifiers(value: unknown, label: string): readonly string[] {
  const values = requireArray(value, label);
  if (values.length > 50) throw new DomainError('INVALID_SCHEMA', `${label} is too large`);
  return values.map((item, index) => {
    const identifier = requireString(item, `${label}[${index}]`);
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/u.test(identifier)) {
      throw new DomainError('INVALID_SCHEMA', `${label} contains an invalid identifier`);
    }
    return identifier;
  });
}

function sourceArtifact(value: unknown): SourceArtifactRef {
  assertRecord(value, 'decisionArtifact');
  assertExactKeys(
    value,
    ['repository', 'commit', 'path', 'sha256'],
    'decisionArtifact',
  );
  const repository = requireString(value.repository, 'decisionArtifact.repository');
  const commit = requireString(value.commit, 'decisionArtifact.commit');
  const artifactPath = requireString(value.path, 'decisionArtifact.path');
  const sha256 = requireString(value.sha256, 'decisionArtifact.sha256');
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(repository) ||
    !/^[0-9a-f]{40}$/u.test(commit) ||
    artifactPath.startsWith('/') ||
    artifactPath.includes('\\') ||
    artifactPath.split('/').includes('..') ||
    !isSha256(sha256)
  ) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'decision artifact is invalid');
  }
  return { repository, commit, path: artifactPath, sha256 };
}

function stableCode(value: unknown, label: string): string {
  const result = requireString(value, label);
  if (!/^[A-Z0-9][A-Z0-9._-]{0,127}$/u.test(result)) {
    throw new DomainError('INVALID_SCHEMA', `${label} is invalid`);
  }
  return result;
}
