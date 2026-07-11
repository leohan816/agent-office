import { DomainError } from '../../contracts/types.js';
import { assertUtcTimestamp, assertUuidV7 } from '../../domain/time/index.js';
import { ImmutableArtifactStore, type ImmutableArtifactReceipt } from '../../persistence/file-store/artifact-store.js';
import { isSha256 } from '../../persistence/file-store/hashing.js';

export interface RecoveryHashEvidence {
  readonly kind: 'PRESERVED_ROOT' | 'QUARANTINED_SEGMENT' | 'BACKUP' | 'CHECKPOINT' | 'ARTIFACT';
  readonly referenceId: string;
  readonly sha256: string;
}

export interface RecoveryStepEvidence {
  readonly stepId: string;
  readonly harnessAction: string;
  readonly outcomeCode: string;
  readonly elapsedMs: number;
}

export interface RecoveryStateSummary {
  readonly manifestWorkUnitCount: number;
  readonly workUnitStates: Readonly<Record<string, number>>;
  readonly openBlockerCount: number;
  readonly openDecisionCount: number;
  readonly openAlertCount: number;
}

export interface RecoveryResultDocument {
  readonly schemaVersion: 'agent-office.recovery-result.v1';
  readonly incidentId: string;
  readonly recoveryId: string;
  readonly missionId: string;
  readonly actor: { readonly role: 'Leo/GPT' | 'Advisor'; readonly subjectId: string };
  readonly build: { readonly buildId: string; readonly commit: string };
  readonly stateRootId: string;
  readonly mode: 'READ_ONLY_RECOVERY' | 'RESTORE_VERIFICATION' | 'ROLLBACK_VERIFICATION';
  readonly failureClassification: string;
  readonly stopAuthorityRoute: string;
  readonly hashes: readonly RecoveryHashEvidence[];
  readonly sourceSequence: number;
  readonly sourceEventHash: string;
  readonly projectionHash: string;
  readonly replay: {
    readonly eventCount: number;
    readonly firstSequence: number;
    readonly lastSequence: number;
    readonly lastEventHash: string;
    readonly deterministicProjectionHash: string;
  };
  readonly idempotency: {
    readonly requestId: string;
    readonly sameInputReplayed: boolean;
    readonly conflictingInputRejected: boolean;
  };
  readonly before: RecoveryStateSummary;
  readonly after: RecoveryStateSummary;
  readonly steps: readonly RecoveryStepEvidence[];
  readonly controls: {
    readonly readOnlyStartupReceipt: string;
    readonly mutationReenableReceipt?: string;
    readonly gatewayReenableReceipt?: string;
  };
  readonly forbiddenScopeUnchanged: {
    readonly noSecrets: true;
    readonly noDatabase: true;
    readonly noPublicExposure: true;
    readonly noProductionAccess: true;
    readonly noOffHostBackup: true;
  };
  readonly totalElapsedMs: number;
  readonly advisorAuditRoute: string;
  readonly independentReviewRequired: true;
  readonly completedAt: string;
}

export async function writeRecoveryResult(
  stateRoot: string,
  result: RecoveryResultDocument,
): Promise<ImmutableArtifactReceipt> {
  assertRecoveryResult(result);
  const artifacts = await ImmutableArtifactStore.open(stateRoot);
  return artifacts.putScopedCanonicalJson(
    'recovery',
    [result.missionId, result.recoveryId],
    result,
    128 * 1024,
  );
}

export function assertRecoveryResult(result: RecoveryResultDocument): void {
  assertUuidV7(result.incidentId, 'recovery incidentId');
  assertUuidV7(result.recoveryId, 'recovery ID');
  assertUuidV7(result.idempotency.requestId, 'recovery idempotency requestId');
  assertUtcTimestamp(result.completedAt, 'recovery completion time');
  assertStableId(result.missionId, 'recovery mission');
  assertStableId(result.actor.subjectId, 'recovery actor');
  assertStableId(result.build.buildId, 'recovery build');
  assertStableId(result.stateRootId, 'recovery state root');
  if (!/^[0-9a-f]{40}$/u.test(result.build.commit)) {
    throw new DomainError('INVALID_SCHEMA', 'recovery build commit is invalid');
  }
  if (
    !isBoundedCode(result.failureClassification, 96) ||
    !isBoundedReference(result.stopAuthorityRoute) ||
    !isBoundedReference(result.advisorAuditRoute) ||
    !isSha256(result.sourceEventHash) ||
    !isSha256(result.projectionHash) ||
    !Number.isSafeInteger(result.sourceSequence) ||
    result.sourceSequence < 0 ||
    !Number.isSafeInteger(result.totalElapsedMs) ||
    result.totalElapsedMs < 0 ||
    result.hashes.length === 0 ||
    result.hashes.length > 128 ||
    result.steps.length === 0 ||
    result.steps.length > 128
  ) {
    throw new DomainError('INVALID_SCHEMA', 'recovery result envelope is invalid');
  }
  for (const hash of result.hashes) {
    assertStableId(hash.referenceId, 'recovery hash reference');
    if (!isSha256(hash.sha256)) {
      throw new DomainError('INVALID_SCHEMA', 'recovery hash is invalid');
    }
  }
  for (const step of result.steps) {
    assertStableId(step.stepId, 'recovery step');
    if (
      !isBoundedCode(step.harnessAction, 128) ||
      !isBoundedCode(step.outcomeCode, 96) ||
      !Number.isSafeInteger(step.elapsedMs) ||
      step.elapsedMs < 0
    ) {
      throw new DomainError('INVALID_SCHEMA', 'recovery step evidence is invalid');
    }
  }
  assertReplay(result);
  assertStateSummary(result.before);
  assertStateSummary(result.after);
  if (
    !isBoundedReference(result.controls.readOnlyStartupReceipt) ||
    (result.controls.mutationReenableReceipt !== undefined &&
      !isBoundedReference(result.controls.mutationReenableReceipt)) ||
    (result.controls.gatewayReenableReceipt !== undefined &&
      !isBoundedReference(result.controls.gatewayReenableReceipt)) ||
    !result.idempotency.sameInputReplayed ||
    !result.idempotency.conflictingInputRejected ||
    !allValuesAreTrue(result.forbiddenScopeUnchanged) ||
    !isTrue(result.independentReviewRequired)
  ) {
    throw new DomainError('INVALID_SCHEMA', 'recovery proof is incomplete');
  }
}

function assertReplay(result: RecoveryResultDocument): void {
  const replay = result.replay;
  if (
    !Number.isSafeInteger(replay.eventCount) ||
    replay.eventCount < 0 ||
    !Number.isSafeInteger(replay.firstSequence) ||
    replay.firstSequence < 0 ||
    !Number.isSafeInteger(replay.lastSequence) ||
    replay.lastSequence < replay.firstSequence ||
    replay.lastSequence !== result.sourceSequence ||
    replay.lastEventHash !== result.sourceEventHash ||
    replay.deterministicProjectionHash !== result.projectionHash ||
    !isSha256(replay.lastEventHash) ||
    !isSha256(replay.deterministicProjectionHash)
  ) {
    throw new DomainError('INVALID_SCHEMA', 'recovery replay proof is invalid');
  }
}

function assertStateSummary(summary: RecoveryStateSummary): void {
  if (
    !Number.isSafeInteger(summary.manifestWorkUnitCount) ||
    summary.manifestWorkUnitCount < 0 ||
    !Number.isSafeInteger(summary.openBlockerCount) ||
    summary.openBlockerCount < 0 ||
    !Number.isSafeInteger(summary.openDecisionCount) ||
    summary.openDecisionCount < 0 ||
    !Number.isSafeInteger(summary.openAlertCount) ||
    summary.openAlertCount < 0
  ) {
    throw new DomainError('INVALID_SCHEMA', 'recovery state summary is invalid');
  }
  const stateTotal = Object.entries(summary.workUnitStates).reduce((total, [state, count]) => {
    if (!isBoundedCode(state, 64) || !Number.isSafeInteger(count) || count < 0) {
      throw new DomainError('INVALID_SCHEMA', 'recovery WorkUnit state summary is invalid');
    }
    return total + count;
  }, 0);
  if (stateTotal !== summary.manifestWorkUnitCount) {
    throw new DomainError('INVALID_SCHEMA', 'recovery WorkUnit denominator is inconsistent');
  }
}

function assertStableId(value: string, label: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value)) {
    throw new DomainError('INVALID_SCHEMA', `${label} is invalid`);
  }
}

function isBoundedCode(value: string, max: number): boolean {
  return value.length > 0 && value.length <= max && /^[A-Za-z0-9][A-Za-z0-9._:/ -]*$/u.test(value);
}

function isBoundedReference(value: string): boolean {
  return value.length > 0 && value.length <= 256 && !value.includes('..') && !value.includes('\\');
}

function allValuesAreTrue(value: unknown): boolean {
  return typeof value === 'object' && value !== null && Object.values(value).every(isTrue);
}

function isTrue(value: unknown): value is true {
  return value === true;
}
