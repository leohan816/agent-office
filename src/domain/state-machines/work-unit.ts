import { DomainError, type EvidenceRef } from '../../contracts/types.js';

export const WORK_UNIT_STATES = [
  'QUEUED',
  'WAITING_DEPENDENCY',
  'READY',
  'DISPATCHED',
  'RUNNING',
  'TESTING',
  'RESULT_REPORTED',
  'REVIEW_PENDING',
  'NEEDS_PATCH',
  'BLOCKED',
  'WAITING_ADVISOR',
  'WAITING_LEO',
  'HOLD',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;

export type WorkUnitState = (typeof WORK_UNIT_STATES)[number];

export const RESUMABLE_WORK_UNIT_STATES = [
  'READY',
  'DISPATCHED',
  'RUNNING',
  'TESTING',
  'RESULT_REPORTED',
  'REVIEW_PENDING',
] as const satisfies readonly WorkUnitState[];

export type ResumableWorkUnitState = (typeof RESUMABLE_WORK_UNIT_STATES)[number];

const STATIC_TRANSITIONS: Readonly<Record<WorkUnitState, readonly WorkUnitState[]>> = {
  QUEUED: ['WAITING_DEPENDENCY', 'READY', 'CANCELLED'],
  WAITING_DEPENDENCY: ['READY', 'BLOCKED', 'HOLD', 'CANCELLED'],
  READY: ['DISPATCHED', 'BLOCKED', 'WAITING_ADVISOR', 'HOLD', 'CANCELLED'],
  DISPATCHED: ['RUNNING', 'BLOCKED', 'WAITING_ADVISOR', 'HOLD', 'FAILED'],
  RUNNING: [
    'TESTING',
    'RESULT_REPORTED',
    'BLOCKED',
    'WAITING_ADVISOR',
    'WAITING_LEO',
    'HOLD',
    'FAILED',
  ],
  TESTING: [
    'RUNNING',
    'RESULT_REPORTED',
    'BLOCKED',
    'WAITING_ADVISOR',
    'WAITING_LEO',
    'HOLD',
    'FAILED',
  ],
  RESULT_REPORTED: [
    'REVIEW_PENDING',
    'NEEDS_PATCH',
    'COMPLETED',
    'BLOCKED',
    'WAITING_ADVISOR',
    'WAITING_LEO',
    'HOLD',
  ],
  REVIEW_PENDING: [
    'NEEDS_PATCH',
    'COMPLETED',
    'WAITING_ADVISOR',
    'WAITING_LEO',
    'BLOCKED',
    'HOLD',
    'FAILED',
  ],
  NEEDS_PATCH: ['READY', 'DISPATCHED', 'BLOCKED', 'WAITING_ADVISOR', 'WAITING_LEO', 'HOLD', 'CANCELLED'],
  BLOCKED: ['WAITING_ADVISOR', 'WAITING_LEO', 'HOLD', 'FAILED', 'CANCELLED'],
  WAITING_ADVISOR: ['BLOCKED', 'WAITING_LEO', 'HOLD', 'CANCELLED'],
  WAITING_LEO: ['BLOCKED', 'WAITING_ADVISOR', 'HOLD', 'CANCELLED'],
  HOLD: ['BLOCKED', 'WAITING_ADVISOR', 'WAITING_LEO', 'FAILED', 'CANCELLED'],
  FAILED: ['READY', 'HOLD', 'CANCELLED'],
  COMPLETED: ['HOLD'],
  CANCELLED: [],
};

export interface WorkUnitTransitionContext {
  readonly dependenciesComplete?: boolean;
  readonly dispatchReceiptVerified?: boolean;
  readonly startEvidenceVerified?: boolean;
  readonly testEvidenceRefs?: readonly EvidenceRef[];
  readonly completionPolicySatisfied?: boolean;
  readonly openBlockerRecorded?: boolean;
  readonly resolvedBlockerRecorded?: boolean;
  readonly advisorIntakeRecorded?: boolean;
  readonly leoDecisionRecorded?: boolean;
  readonly holdRepairRecorded?: boolean;
  readonly capturedPriorState?: ResumableWorkUnitState;
  readonly resumeProofVerified?: boolean;
  readonly retryAuthorized?: boolean;
  readonly completionRevoked?: boolean;
  readonly cancellationAuthorityVerified?: boolean;
}

export function allowedWorkUnitTargets(
  from: WorkUnitState,
  capturedPriorState?: ResumableWorkUnitState,
): readonly WorkUnitState[] {
  const targets = [...STATIC_TRANSITIONS[from]];
  if (
    capturedPriorState !== undefined &&
    (from === 'BLOCKED' || from === 'WAITING_ADVISOR' || from === 'WAITING_LEO' || from === 'HOLD')
  ) {
    targets.push(capturedPriorState);
  }
  return [...new Set(targets)];
}

export function assertWorkUnitTransition(
  from: WorkUnitState,
  to: WorkUnitState,
  context: WorkUnitTransitionContext = {},
): void {
  if (!allowedWorkUnitTargets(from, context.capturedPriorState).includes(to)) {
    throw new DomainError('INVALID_TRANSITION', `${from} cannot transition to ${to}`);
  }

  if (to === 'READY' && (from === 'QUEUED' || from === 'WAITING_DEPENDENCY')) {
    requireRule(context.dependenciesComplete, 'DEPENDENCY_INCOMPLETE', 'all dependencies must be completed');
  }
  if (to === 'DISPATCHED') {
    requireRule(context.dispatchReceiptVerified, 'EVIDENCE_MISSING_OR_STALE', 'dispatch receipt is required');
  }
  if (from === 'DISPATCHED' && to === 'RUNNING') {
    requireRule(context.startEvidenceVerified, 'EVIDENCE_MISSING_OR_STALE', 'start evidence is required');
  }
  if (from === 'TESTING' && to === 'RESULT_REPORTED') {
    requireRule(
      context.testEvidenceRefs?.some((evidence) => evidence.verificationStatus === 'VERIFIED'),
      'EVIDENCE_MISSING_OR_STALE',
      'verified test evidence is required',
    );
  }
  if (to === 'COMPLETED') {
    requireRule(
      context.completionPolicySatisfied,
      'EVIDENCE_MISSING_OR_STALE',
      'completion policy is not satisfied',
    );
  }
  if (to === 'BLOCKED') {
    requireRule(context.openBlockerRecorded, 'EVIDENCE_MISSING_OR_STALE', 'an open blocker is required');
  }
  if (to === 'CANCELLED') {
    requireRule(
      context.cancellationAuthorityVerified,
      'AUTHORITY_ARTIFACT_INVALID',
      'cancellation authority is required',
    );
  }
  if (from === 'FAILED' && to === 'READY') {
    requireRule(context.retryAuthorized, 'AUTHORITY_ARTIFACT_INVALID', 'retry authorization is required');
  }
  if (from === 'COMPLETED' && to === 'HOLD') {
    requireRule(context.completionRevoked, 'AUTHORITY_ARTIFACT_INVALID', 'completion revocation is required');
  }

  if (
    context.capturedPriorState === to &&
    (from === 'BLOCKED' || from === 'WAITING_ADVISOR' || from === 'WAITING_LEO' || from === 'HOLD')
  ) {
    requireRule(context.resumeProofVerified, 'AUTHORITY_ARTIFACT_INVALID', 'verified ResumeProof is required');
    if (from === 'BLOCKED') {
      requireRule(context.resolvedBlockerRecorded, 'EVIDENCE_MISSING_OR_STALE', 'blocker resolution is required');
    } else if (from === 'WAITING_ADVISOR') {
      requireRule(context.advisorIntakeRecorded, 'AUTHORITY_ARTIFACT_INVALID', 'Advisor intake is required');
    } else if (from === 'WAITING_LEO') {
      requireRule(context.leoDecisionRecorded, 'AUTHORITY_ARTIFACT_INVALID', 'Leo/GPT decision is required');
    } else {
      requireRule(context.holdRepairRecorded, 'EVIDENCE_MISSING_OR_STALE', 'hold repair evidence is required');
    }
  }
}

function requireRule(
  condition: unknown,
  code: 'DEPENDENCY_INCOMPLETE' | 'EVIDENCE_MISSING_OR_STALE' | 'AUTHORITY_ARTIFACT_INVALID',
  message: string,
): asserts condition {
  if (!condition) {
    throw new DomainError(code, message);
  }
}
