import { DomainError } from '../../contracts/types.js';
import {
  assertExactKeys,
  assertRecord,
  requireArray,
  requireInteger,
  requireString,
} from '../../contracts/validation.js';
import { assertUtcTimestamp, assertUuidV7 } from '../time/index.js';

export const ADVISOR_MESSAGE_KINDS = [
  'NEW_MISSION',
  'CLARIFICATION',
  'DECISION_RESPONSE',
  'PAUSE',
  'CANCEL',
] as const;

export type AdvisorMessageKind = (typeof ADVISOR_MESSAGE_KINDS)[number];

export interface SubmitAdvisorMessage {
  readonly requestId: string;
  readonly missionId: string;
  readonly manifestVersion: number;
  readonly kind: AdvisorMessageKind;
  readonly subject: string;
  readonly bodyText: string;
  readonly referencedEntityIds: readonly string[];
  readonly clientCreatedAt: string;
}

export function assertSubmitAdvisorMessage(value: unknown): asserts value is SubmitAdvisorMessage {
  assertRecord(value, 'SubmitAdvisorMessage');
  assertExactKeys(
    value,
    [
      'requestId',
      'missionId',
      'manifestVersion',
      'kind',
      'subject',
      'bodyText',
      'referencedEntityIds',
      'clientCreatedAt',
    ],
    'SubmitAdvisorMessage',
  );
  const requestId = requireString(value.requestId, 'requestId');
  const missionId = requireString(value.missionId, 'missionId');
  const manifestVersion = requireInteger(value.manifestVersion, 'manifestVersion', 1);
  const subject = requireString(value.subject, 'subject');
  const bodyText = requireString(value.bodyText, 'bodyText');
  const clientCreatedAt = requireString(value.clientCreatedAt, 'clientCreatedAt');
  void manifestVersion;
  assertUuidV7(requestId, 'requestId');
  assertUtcTimestamp(clientCreatedAt, 'clientCreatedAt');
  if (!/^[A-Z0-9][A-Z0-9._-]{0,127}$/u.test(missionId)) {
    throw new DomainError('INVALID_SCHEMA', 'missionId is invalid');
  }
  if (
    typeof value.kind !== 'string' ||
    !ADVISOR_MESSAGE_KINDS.includes(value.kind as AdvisorMessageKind)
  ) {
    throw new DomainError('INVALID_SCHEMA', 'message kind is invalid');
  }
  if (Array.from(subject).length > 200 || Buffer.byteLength(bodyText, 'utf8') > 16 * 1024) {
    throw new DomainError('INVALID_SCHEMA', 'message content exceeds its bound');
  }
  if (/[^\P{Cc}\n\t]/u.test(`${subject}${bodyText}`)) {
    throw new DomainError('INVALID_SCHEMA', 'message content contains a forbidden control character');
  }
  const references = requireArray(value.referencedEntityIds, 'referencedEntityIds');
  if (references.length > 50) {
    throw new DomainError('INVALID_SCHEMA', 'message contains too many entity references');
  }
  for (const [index, reference] of references.entries()) {
    const entityId = requireString(reference, `referencedEntityIds[${index}]`);
    if (!/^[A-Z0-9][A-Z0-9._-]{0,127}$/u.test(entityId)) {
      throw new DomainError('INVALID_SCHEMA', 'message entity reference is invalid');
    }
  }
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 32 * 1024) {
    throw new DomainError('INVALID_SCHEMA', 'message payload exceeds its whole-payload bound');
  }
}
