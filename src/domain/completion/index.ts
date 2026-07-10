import type { EvidenceRef } from '../../contracts/types.js';

export const COMPLETION_POLICIES = [
  'DESIGN_CANDIDATE_PUBLISHED',
  'DESIGN_REVIEW_ACCEPTED',
  'IMPLEMENTATION_BATCH_ACCEPTED',
  'IMPLEMENTATION_REVIEW_ACCEPTED',
  'PRIVATE_RUN_VERIFIED',
  'FINAL_AUDIT_ACCEPTED',
] as const;

export type CompletionPolicyId = (typeof COMPLETION_POLICIES)[number];

export type ReviewVerdict = 'PASS' | 'PASS_WITH_RISK' | 'NEEDS_PATCH' | 'FAIL';

export interface CompletionEvaluationInput {
  readonly policyId: CompletionPolicyId;
  readonly evidence: readonly EvidenceRef[];
  readonly requiredEvidenceKinds: readonly string[];
  readonly reviewVerdict?: ReviewVerdict;
  readonly leoRiskAcceptanceVerified?: boolean;
  readonly leoFinalApprovalVerified?: boolean;
}

export interface CompletionEvaluation {
  readonly satisfied: boolean;
  readonly missingEvidenceKinds: readonly string[];
  readonly staleOrInvalidArtifactIds: readonly string[];
  readonly authorityGate: 'SATISFIED' | 'REVIEW_REQUIRED' | 'LEO_RISK_ACCEPTANCE_REQUIRED' | 'LEO_FINAL_APPROVAL_REQUIRED';
}

export function evaluateCompletion(input: CompletionEvaluationInput): CompletionEvaluation {
  const verifiedKinds = new Set(
    input.evidence
      .filter((evidence) => evidence.verificationStatus === 'VERIFIED')
      .map((evidence) => evidence.kind),
  );
  const missingEvidenceKinds = input.requiredEvidenceKinds.filter((kind) => !verifiedKinds.has(kind));
  const staleOrInvalidArtifactIds = input.evidence
    .filter((evidence) => evidence.verificationStatus === 'STALE' || evidence.verificationStatus === 'INVALID')
    .map((evidence) => evidence.artifactId)
    .sort();

  let authorityGate: CompletionEvaluation['authorityGate'] = 'SATISFIED';
  if (
    input.policyId === 'DESIGN_REVIEW_ACCEPTED' ||
    input.policyId === 'IMPLEMENTATION_REVIEW_ACCEPTED'
  ) {
    if (input.reviewVerdict === 'PASS_WITH_RISK' && !input.leoRiskAcceptanceVerified) {
      authorityGate = 'LEO_RISK_ACCEPTANCE_REQUIRED';
    } else if (input.reviewVerdict !== 'PASS') {
      authorityGate = 'REVIEW_REQUIRED';
    }
  }
  if (input.policyId === 'FINAL_AUDIT_ACCEPTED' && !input.leoFinalApprovalVerified) {
    authorityGate = 'LEO_FINAL_APPROVAL_REQUIRED';
  }
  return {
    satisfied:
      missingEvidenceKinds.length === 0 &&
      staleOrInvalidArtifactIds.length === 0 &&
      authorityGate === 'SATISFIED',
    missingEvidenceKinds,
    staleOrInvalidArtifactIds,
    authorityGate,
  };
}
