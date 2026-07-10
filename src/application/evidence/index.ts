import type { EvidenceRef, VerificationStatus } from '../../contracts/types.js';
import { assertUtcTimestamp } from '../../domain/time/index.js';
import { isSha256, sha256Bytes } from '../../persistence/file-store/hashing.js';

export interface EvidenceObservation {
  readonly bytes?: Uint8Array;
  readonly repository: string;
  readonly commit: string;
  readonly path: string;
  readonly verifiedAt: string;
  readonly verifier: string;
}

export interface EvidenceVerificationResult {
  readonly evidence: EvidenceRef;
  readonly status: VerificationStatus;
  readonly reasons: readonly string[];
}

export function verifyEvidence(
  evidence: EvidenceRef,
  observation: EvidenceObservation,
): EvidenceVerificationResult {
  assertUtcTimestamp(observation.verifiedAt, 'verifiedAt');
  const reasons: string[] = [];
  if (!isSha256(evidence.sha256)) reasons.push('INVALID_EXPECTED_HASH');
  if (evidence.repository !== observation.repository) reasons.push('REPOSITORY_MISMATCH');
  if (evidence.commit !== observation.commit) reasons.push('COMMIT_MISMATCH');
  if (evidence.path !== observation.path) reasons.push('PATH_MISMATCH');
  if (observation.bytes === undefined) reasons.push('ARTIFACT_MISSING');
  else if (sha256Bytes(observation.bytes) !== evidence.sha256) reasons.push('HASH_MISMATCH');
  const status: VerificationStatus = reasons.length === 0 ? 'VERIFIED' : 'INVALID';
  return {
    evidence: {
      ...evidence,
      verifiedAt: observation.verifiedAt,
      verifier: observation.verifier,
      verificationStatus: status,
    },
    status,
    reasons,
  };
}
