import { DomainError, type EntityRef, type EvidenceRef } from '../../contracts/types.js';
import { assertExactKeys } from '../../contracts/validation.js';
import { assertUtcTimestamp, assertUuidV7 } from '../time/index.js';
import {
  RESUMABLE_WORK_UNIT_STATES,
  WORK_UNIT_STATES,
  type ResumableWorkUnitState,
  type WorkUnitState,
} from '../state-machines/work-unit.js';

export const BLOCKER_KINDS = [
  'MISSING_LEO_DECISION',
  'MISSING_EVIDENCE',
  'SESSION_NOT_READY',
  'SESSION_OFFLINE',
  'WRONG_ACTOR_OR_WORKSPACE',
  'GIT_CONFLICT',
  'DIRTY_WORKTREE_CONFLICT',
  'TEST_FAILURE',
  'AUTHENTICATION_REQUIRED',
  'UNEXPECTED_APPROVAL_PROMPT',
  'SCOPE_CONFLICT',
  'DEPENDENCY_FAILED',
  'TIMEOUT',
  'ARTIFACT_MISSING',
  'COMMIT_NOT_PUSHED',
  'MANUAL_KILL_SWITCH',
] as const;

export type BlockerKind = (typeof BLOCKER_KINDS)[number];

export const SAFE_DEFAULTS = [
  'STOP_AND_HOLD',
  'WAIT_FOR_LEO',
  'NO_AUTOMATIC_ACTION',
  'MANUAL_FALLBACK',
  'READ_ONLY',
] as const;

export type SafeDefault = (typeof SAFE_DEFAULTS)[number];

export const RESOLUTION_OWNERS = [
  'ADVISOR',
  'LEO_GPT',
  'ASSIGNED_WORKER',
  'FABLE5_REVIEWER',
  'LOCAL_OPERATOR',
] as const;

export type ResolutionOwner = (typeof RESOLUTION_OWNERS)[number];

export interface BlockerPolicy {
  readonly safeDefault: SafeDefault;
  readonly resolutionOwner: ResolutionOwner;
}

export const BLOCKER_POLICIES: Readonly<Record<BlockerKind, BlockerPolicy>> = {
  MISSING_LEO_DECISION: { safeDefault: 'WAIT_FOR_LEO', resolutionOwner: 'LEO_GPT' },
  MISSING_EVIDENCE: { safeDefault: 'STOP_AND_HOLD', resolutionOwner: 'ADVISOR' },
  SESSION_NOT_READY: { safeDefault: 'STOP_AND_HOLD', resolutionOwner: 'ADVISOR' },
  SESSION_OFFLINE: { safeDefault: 'STOP_AND_HOLD', resolutionOwner: 'ADVISOR' },
  WRONG_ACTOR_OR_WORKSPACE: { safeDefault: 'STOP_AND_HOLD', resolutionOwner: 'ADVISOR' },
  GIT_CONFLICT: { safeDefault: 'STOP_AND_HOLD', resolutionOwner: 'ADVISOR' },
  DIRTY_WORKTREE_CONFLICT: { safeDefault: 'STOP_AND_HOLD', resolutionOwner: 'ADVISOR' },
  TEST_FAILURE: { safeDefault: 'STOP_AND_HOLD', resolutionOwner: 'ASSIGNED_WORKER' },
  AUTHENTICATION_REQUIRED: { safeDefault: 'NO_AUTOMATIC_ACTION', resolutionOwner: 'ADVISOR' },
  UNEXPECTED_APPROVAL_PROMPT: { safeDefault: 'NO_AUTOMATIC_ACTION', resolutionOwner: 'ADVISOR' },
  SCOPE_CONFLICT: { safeDefault: 'WAIT_FOR_LEO', resolutionOwner: 'LEO_GPT' },
  DEPENDENCY_FAILED: { safeDefault: 'STOP_AND_HOLD', resolutionOwner: 'ADVISOR' },
  TIMEOUT: { safeDefault: 'STOP_AND_HOLD', resolutionOwner: 'ADVISOR' },
  ARTIFACT_MISSING: { safeDefault: 'STOP_AND_HOLD', resolutionOwner: 'ASSIGNED_WORKER' },
  COMMIT_NOT_PUSHED: { safeDefault: 'STOP_AND_HOLD', resolutionOwner: 'ASSIGNED_WORKER' },
  MANUAL_KILL_SWITCH: { safeDefault: 'MANUAL_FALLBACK', resolutionOwner: 'ADVISOR' },
};

export interface BlockerNextAction {
  readonly actionCode: string;
  readonly description: string;
  readonly targetActor: ResolutionOwner;
  readonly requiresNewHandoff: boolean;
}

export interface BlockerOpenedPayload {
  readonly blockerId: string;
  readonly missionId: string;
  readonly entityRefs: readonly EntityRef[];
  readonly kind: BlockerKind;
  readonly reasonCode: string;
  readonly explanation: string;
  readonly safeDefault: SafeDefault;
  readonly resolutionOwner: ResolutionOwner;
  readonly nextAction: BlockerNextAction;
  readonly blockedSince: string;
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly priorWorkUnitState: string;
  readonly resumeTo: string;
  readonly requestId: string;
  readonly manifestVersion: number;
  readonly expectedStreamVersion: number;
  readonly causationId: string;
  readonly correlationId: string;
}

const SAFETY_RANK: Readonly<Record<SafeDefault, number>> = {
  READ_ONLY: 5,
  STOP_AND_HOLD: 4,
  WAIT_FOR_LEO: 4,
  NO_AUTOMATIC_ACTION: 3,
  MANUAL_FALLBACK: 3,
};

export function assertBlockerPayload(payload: BlockerOpenedPayload): void {
  assertExactKeys(
    { ...payload },
    [
      'blockerId',
      'missionId',
      'entityRefs',
      'kind',
      'reasonCode',
      'explanation',
      'safeDefault',
      'resolutionOwner',
      'nextAction',
      'blockedSince',
      'evidenceRefs',
      'priorWorkUnitState',
      'resumeTo',
      'requestId',
      'manifestVersion',
      'expectedStreamVersion',
      'causationId',
      'correlationId',
    ],
    'BlockerOpened payload',
  );
  assertUuidV7(payload.blockerId, 'blockerId');
  assertUuidV7(payload.requestId, 'requestId');
  assertUuidV7(payload.causationId, 'causationId');
  assertUuidV7(payload.correlationId, 'correlationId');
  assertUtcTimestamp(payload.blockedSince, 'blockedSince');
  const policy = BLOCKER_POLICIES[payload.kind];
  if (SAFETY_RANK[payload.safeDefault] < SAFETY_RANK[policy.safeDefault]) {
    throw new DomainError('INVALID_SCHEMA', `${payload.kind} cannot use a weaker safe default`);
  }
  if (payload.resolutionOwner !== policy.resolutionOwner) {
    throw new DomainError('UNAUTHORIZED_ACTOR', `${payload.kind} has the wrong resolution owner`);
  }
  if (payload.entityRefs.length === 0) {
    throw new DomainError('INVALID_SCHEMA', 'blocker requires at least one entity reference');
  }
  if (payload.nextAction.targetActor !== payload.resolutionOwner) {
    throw new DomainError('UNAUTHORIZED_ACTOR', 'next action target must match the resolution owner');
  }
  if (payload.entityRefs.some((reference) => reference.entityType === 'WORK_UNIT')) {
    if (
      !WORK_UNIT_STATES.includes(payload.priorWorkUnitState as WorkUnitState) ||
      !RESUMABLE_WORK_UNIT_STATES.includes(payload.resumeTo as ResumableWorkUnitState) ||
      payload.priorWorkUnitState !== payload.resumeTo
    ) {
      throw new DomainError('INVALID_TRANSITION', 'WorkUnit blocker must preserve one exact resumable state');
    }
  }
  if (
    payload.evidenceRefs.length === 0 &&
    payload.kind !== 'MISSING_EVIDENCE' &&
    payload.kind !== 'ARTIFACT_MISSING'
  ) {
    throw new DomainError('EVIDENCE_MISSING_OR_STALE', 'blocker evidence is required for this kind');
  }
}
