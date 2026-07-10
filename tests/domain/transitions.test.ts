import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { assertResumeProof } from '../../src/domain/decisions/resume-proof.js';
import { assertSubmitAdvisorMessage } from '../../src/domain/messages/index.js';
import {
  ALERT_TRANSITIONS,
  BLOCKER_TRANSITIONS,
  DECISION_TRANSITIONS,
  MESSAGE_TRANSITIONS,
  NOTIFICATION_TRANSITIONS,
  assertEntityTransition,
} from '../../src/domain/state-machines/entities.js';
import { assertWorkUnitTransition } from '../../src/domain/state-machines/work-unit.js';
import { FIXED_TIME, MISSION_ID, uuidV7, verifiedEvidence } from '../helpers/fixtures.js';

describe('entity state transitions', () => {
  it('enforces evidence, dependency, completion, resume, and retry gates', () => {
    expect(() => assertWorkUnitTransition('QUEUED', 'READY', { dependenciesComplete: true })).not.toThrow();
    expect(() => assertWorkUnitTransition('QUEUED', 'READY')).toThrow(
      expect.objectContaining<Partial<DomainError>>({ code: 'DEPENDENCY_INCOMPLETE' }),
    );
    expect(() =>
      assertWorkUnitTransition('READY', 'DISPATCHED', { dispatchReceiptVerified: true }),
    ).not.toThrow();
    expect(() =>
      assertWorkUnitTransition('TESTING', 'RESULT_REPORTED', { testEvidenceRefs: [verifiedEvidence()] }),
    ).not.toThrow();
    expect(() =>
      assertWorkUnitTransition('RESULT_REPORTED', 'COMPLETED', { completionPolicySatisfied: true }),
    ).not.toThrow();
    expect(() =>
      assertWorkUnitTransition('BLOCKED', 'RUNNING', {
        capturedPriorState: 'RUNNING',
        resolvedBlockerRecorded: true,
        resumeProofVerified: true,
      }),
    ).not.toThrow();
    expect(() => assertWorkUnitTransition('FAILED', 'READY', { retryAuthorized: true })).not.toThrow();
    expect(() => assertWorkUnitTransition('RUNNING', 'COMPLETED')).toThrow(
      expect.objectContaining<Partial<DomainError>>({ code: 'INVALID_TRANSITION' }),
    );
  });

  it('keeps message, blocker, alert, decision, and notification lifecycles closed', () => {
    expect(() => assertEntityTransition(MESSAGE_TRANSITIONS, 'PERSISTED', 'DELIVERY_PENDING')).not.toThrow();
    expect(() => assertEntityTransition(BLOCKER_TRANSITIONS, 'OPEN', 'WAITING_LEO')).not.toThrow();
    expect(() => assertEntityTransition(ALERT_TRANSITIONS, 'ACKNOWLEDGED', 'SNOOZED')).not.toThrow();
    expect(() => assertEntityTransition(DECISION_TRANSITIONS, 'RECORDED', 'APPLIED')).not.toThrow();
    expect(() => assertEntityTransition(NOTIFICATION_TRANSITIONS, 'FAILED', 'QUEUED')).not.toThrow();
    expect(() => assertEntityTransition(ALERT_TRANSITIONS, 'RESOLVED', 'OPEN')).toThrow(
      expect.objectContaining<Partial<DomainError>>({ code: 'INVALID_TRANSITION' }),
    );
  });

  it('rejects message role targets and validates exact decision resume proof', () => {
    const message = {
      requestId: uuidV7(1),
      missionId: MISSION_ID,
      manifestVersion: 1,
      kind: 'QUESTION',
      subject: 'Bounded question',
      bodyText: 'Synthetic body',
      referencedEntityIds: ['AO-WU-07'],
      clientCreatedAt: FIXED_TIME,
    };
    expect(() => assertSubmitAdvisorMessage(message)).not.toThrow();
    expect(() => assertSubmitAdvisorMessage({ ...message, targetRole: 'Agent Office Worker' })).toThrow(
      expect.objectContaining<Partial<DomainError>>({ code: 'UNKNOWN_FIELD' }),
    );
    expect(() =>
      assertResumeProof({
        workUnitId: 'AO-WU-07',
        waitingEventId: uuidV7(2),
        previousState: 'RUNNING',
        resumeTo: 'RUNNING',
        decisionId: uuidV7(3),
        decisionArtifactHash: `sha256:${'1'.repeat(64)}`,
        intakeArtifactHash: `sha256:${'2'.repeat(64)}`,
        resolvedBlockerIds: [uuidV7(4)],
        expectedStreamVersion: 5,
      }),
    ).not.toThrow();
  });
});
