import type { CommunicationCenterModel } from './types.js';

const MISSION_ID = 'AGENT_OFFICE_M01_ADVISOR_MANAGED_OFFICE_WEB_CONTROL_PLANE';
const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;
const SOURCE_ADVISOR_JOB = `{"commit":"${'c'.repeat(40)}","path":"advisor/jobs/batch-d.md","repository":"foundation-docs","sha256":"${HASH_A}"}`;
const READ_DECISION_REQUEST = `{"commit":"${'c'.repeat(40)}","path":"advisor/jobs/decision-request.md","repository":"foundation-docs","sha256":"${HASH_B}"}`;
const CONFIRMED_FACTS = `[{"evidenceRefs":[${SOURCE_ADVISOR_JOB}],"factId":"FACT-1","value":"Message artifact and persisted event are durable."}]`;
const UNKNOWNS = '[{"description":"Advisor decision has not been linked.","unknownId":"UNKNOWN-1"}]';
const OPTIONS = '[{"impact":"Resume only after verified evidence.","label":"Resume after verified decision","optionId":"OPTION-RESUME"},{"impact":"No work resumes.","label":"Remain on hold","optionId":"OPTION-HOLD"}]';
const RECOMMENDATION = '{"optionId":"OPTION-HOLD","rationale":"Remain on hold until the decision and intake hashes are linked."}';

export const COMMUNICATION_CENTER_FIXTURE: CommunicationCenterModel = {
  fixtureKind: 'SYNTHETIC_READ_ONLY',
  manifestVersion: 1,
  missionOptions: [{ id: MISSION_ID, label: 'Agent Office M01' }],
  allowlistedEntityIds: ['AO-WU-10'],
  draftRequestId: '018f0000-0000-7000-8000-00000000d001',
  draftCreatedAt: '2026-07-11T00:00:00.000Z',
  deliveryActivation: 'DISABLED',
  messages: [
    {
      messageId: '018f0000-0000-7000-8000-00000000d002',
      requestId: '018f0000-0000-7000-8000-00000000d003',
      missionId: MISSION_ID,
      kind: 'CLARIFICATION',
      subject: 'Advisor transport capability verification',
      state: 'MANUAL_FALLBACK_REQUIRED',
      payloadHash: HASH_A,
      artifactRef: `artifacts/inbox/${MISSION_ID}/018f0000-0000-7000-8000-00000000d003/${'a'.repeat(64)}.json`,
      artifactHash: HASH_A,
      transportState: 'MANUAL_FALLBACK_REQUIRED',
      advisorEvidenceState: 'NOT_ACKNOWLEDGED',
      evidenceHashes: [],
      timeline: [
        { state: 'PERSISTED', occurredAt: '2026-07-11T00:00:00.000Z', evidenceRef: HASH_A },
        { state: 'DELIVERY_PENDING', occurredAt: '2026-07-11T00:00:01.000Z', evidenceRef: 'OUTBOX' },
        {
          state: 'MANUAL_FALLBACK_REQUIRED',
          occurredAt: '2026-07-11T00:00:02.000Z',
          evidenceRef: HASH_B,
        },
      ],
    },
  ],
  alerts: [
    {
      alertId: '018f0000-0000-7000-8000-00000000d010',
      kind: 'NEEDS_LEO_DECISION',
      severity: 'WARNING',
      state: 'OPEN',
      title: 'Batch D decision evidence required',
      summary: 'Advisor acknowledgement is not a decision. Keep the WorkUnit on hold.',
      occurrenceCount: 1,
      deduplicationKey: HASH_A,
      actionCodes: ['COPY_GPT_PACKAGE', 'OPEN_EVIDENCE', 'REPLY_TO_ADVISOR', 'HOLD'],
      detail: {
        initiativeId: 'INITIATIVE-AGENT-OFFICE',
        packageId: 'PACKAGE-M01',
        missionId: MISSION_ID,
        requestId: '018f0000-0000-7000-8000-00000000d011',
        phaseId: 'IMPLEMENTATION_D',
        workUnitId: 'AO-WU-10',
        confirmedFacts: ['Message artifact and persisted event are durable.'],
        unknowns: ['Advisor decision has not been linked.'],
        question: 'Should AO-WU-10 resume after the decision artifact is verified?',
        options: ['Resume after verified decision', 'Remain on hold'],
        recommendation: 'Remain on hold until the decision and intake hashes are linked.',
        safeDefault: 'HOLD',
        blockedCapability: 'WORK_RESUME',
        blockerReason: 'MISSING_LEO_DECISION',
        resolutionOwner: 'LEO_GPT',
        nextAction: 'RETURN_DECISION_TO_ADVISOR',
        evidenceRefs: [HASH_A, HASH_B],
      },
      gptPackageMarkdown: `## TARGET_ACTOR\n\nLeo/GPT\n\n## MISSION\n\n${MISSION_ID}\n\n## REQUEST_ID\n\n018f0000-0000-7000-8000-00000000d011\n\n## SOURCE_ADVISOR_JOB\n\n${SOURCE_ADVISOR_JOB}\n\n## READ_DECISION_REQUEST\n\n${READ_DECISION_REQUEST}\n\n## CONFIRMED_FACTS\n\n${CONFIRMED_FACTS}\n\n## UNKNOWNS\n\n${UNKNOWNS}\n\n## QUESTION\n\nShould AO-WU-10 resume after the decision artifact is verified?\n\n## OPTIONS\n\n${OPTIONS}\n\n## ADVISOR_RECOMMENDATION\n\n${RECOMMENDATION}\n\n## SAFE_DEFAULT\n\nHOLD\n\n## RETURN_RESULT_TO\n\nAdvisor\n\n## DO_NOT_START_ANOTHER_MISSION_AUTOMATICALLY\n\ntrue\n`,
    },
    {
      alertId: '018f0000-0000-7000-8000-00000000d020',
      kind: 'MISSION_FAILED',
      severity: 'CRITICAL',
      state: 'OPEN',
      title: 'Synthetic critical alert boundary fixture',
      summary: 'This fixture does not change mission state or claim acknowledgement.',
      occurrenceCount: 1,
      deduplicationKey: HASH_B,
      actionCodes: ['OPEN_EVIDENCE', 'REPLY_TO_ADVISOR', 'PAUSE_MISSION', 'CANCEL_MISSION'],
      detail: {
        initiativeId: 'INITIATIVE-AGENT-OFFICE',
        packageId: 'PACKAGE-M01',
        missionId: MISSION_ID,
        requestId: '018f0000-0000-7000-8000-00000000d021',
        phaseId: 'IMPLEMENTATION_D',
        workUnitId: 'AO-WU-10',
        confirmedFacts: ['The synthetic failure is an inert UI fixture.'],
        unknowns: ['No live application port is attached.'],
        question: 'Which Advisor request should be prepared?',
        options: ['Pause request', 'Cancel request'],
        recommendation: 'Prepare a pause request; do not mutate the mission locally.',
        safeDefault: 'HOLD',
        blockedCapability: 'MISSION_MUTATION',
        blockerReason: 'TEST_FAILURE',
        resolutionOwner: 'ADVISOR',
        nextAction: 'PREPARE_PAUSE_REQUEST',
        evidenceRefs: [HASH_B],
      },
    },
  ],
};
