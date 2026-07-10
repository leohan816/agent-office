import { DomainError } from '../../contracts/types.js';
import {
  assertExactKeys,
  assertRecord,
  requireArray,
  requireInteger,
  requireString,
} from '../../contracts/validation.js';
import { isSha256 } from '../../persistence/file-store/hashing.js';
import { RESUMABLE_WORK_UNIT_STATES, type ResumableWorkUnitState } from '../state-machines/work-unit.js';
import { assertUuidV7 } from '../time/index.js';

export interface ResumeProof {
  readonly workUnitId: string;
  readonly waitingEventId: string;
  readonly previousState: ResumableWorkUnitState;
  readonly resumeTo: ResumableWorkUnitState;
  readonly decisionId: string;
  readonly decisionArtifactHash: string;
  readonly intakeArtifactHash: string;
  readonly resolvedBlockerIds: readonly string[];
  readonly expectedStreamVersion: number;
}

export function assertResumeProof(value: unknown): asserts value is ResumeProof {
  assertRecord(value, 'ResumeProof');
  assertExactKeys(
    value,
    [
      'workUnitId',
      'waitingEventId',
      'previousState',
      'resumeTo',
      'decisionId',
      'decisionArtifactHash',
      'intakeArtifactHash',
      'resolvedBlockerIds',
      'expectedStreamVersion',
    ],
    'ResumeProof',
  );
  requireString(value.workUnitId, 'workUnitId');
  const waitingEventId = requireString(value.waitingEventId, 'waitingEventId');
  const decisionId = requireString(value.decisionId, 'decisionId');
  const decisionArtifactHash = requireString(value.decisionArtifactHash, 'decisionArtifactHash');
  const intakeArtifactHash = requireString(value.intakeArtifactHash, 'intakeArtifactHash');
  requireInteger(value.expectedStreamVersion, 'expectedStreamVersion', 0);
  assertUuidV7(waitingEventId, 'waitingEventId');
  assertUuidV7(decisionId, 'decisionId');
  if (!isSha256(decisionArtifactHash) || !isSha256(intakeArtifactHash)) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'ResumeProof hashes are invalid');
  }
  if (
    typeof value.previousState !== 'string' ||
    !RESUMABLE_WORK_UNIT_STATES.includes(value.previousState as ResumableWorkUnitState) ||
    value.resumeTo !== value.previousState
  ) {
    throw new DomainError('INVALID_TRANSITION', 'ResumeProof must return to the captured prior state');
  }
  for (const [index, blockerId] of requireArray(value.resolvedBlockerIds, 'resolvedBlockerIds').entries()) {
    assertUuidV7(requireString(blockerId, `resolvedBlockerIds[${index}]`), 'resolvedBlockerId');
  }
}
