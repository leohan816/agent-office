import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import {
  WORK_UNIT_STATES,
  allowedWorkUnitTargets,
  assertWorkUnitTransition,
  type WorkUnitState,
} from '../../src/domain/state-machines/work-unit.js';
import { verifiedEvidence } from '../helpers/fixtures.js';

const permissiveContext = {
  dependenciesComplete: true,
  dispatchReceiptVerified: true,
  startEvidenceVerified: true,
  testEvidenceRefs: [verifiedEvidence()],
  completionPolicySatisfied: true,
  openBlockerRecorded: true,
  resolvedBlockerRecorded: true,
  advisorIntakeRecorded: true,
  leoDecisionRecorded: true,
  holdRepairRecorded: true,
  capturedPriorState: 'RUNNING' as const,
  resumeProofVerified: true,
  retryAuthorized: true,
  completionRevoked: true,
  cancellationAuthorityVerified: true,
};

describe('WorkUnit transition matrix property', () => {
  it('accepts exactly the declared 16 by 16 matrix plus captured prior resume', () => {
    for (const from of WORK_UNIT_STATES) {
      const allowed = allowedWorkUnitTargets(from, permissiveContext.capturedPriorState);
      for (const to of WORK_UNIT_STATES) {
        if (allowed.includes(to)) {
          expect(() => assertWorkUnitTransition(from, to, permissiveContext), `${from} -> ${to}`).not.toThrow();
        } else {
          expect(() => assertWorkUnitTransition(from, to, permissiveContext), `${from} -> ${to}`).toThrow(
            expect.objectContaining<Partial<DomainError>>({ code: 'INVALID_TRANSITION' }),
          );
        }
      }
    }
  });

  it('never admits an unknown state through the runtime boundary', () => {
    expect(() =>
      assertWorkUnitTransition('READY', 'NOT_A_STATE' as WorkUnitState, permissiveContext),
    ).toThrow(expect.objectContaining<Partial<DomainError>>({ code: 'INVALID_TRANSITION' }));
  });
});
