import { buildDashboardViewModel, type DashboardViewModelInput } from '../../application/queries/dashboard-view-model.js';
import type { ObservableProjectionName, RoleActivity } from '../../domain/activity/index.js';
import type { PhaseManifest } from '../../domain/manifest/index.js';
import type { WorkUnitState } from '../../domain/state-machines/work-unit.js';
import type { WorkUnitProjection } from '../../application/projections/mission-projector.js';

const FIXTURE_TIME = '2026-07-10T20:00:00.000Z';
const MISSION_ID = 'AGENT_OFFICE_M01_ADVISOR_MANAGED_OFFICE_WEB_CONTROL_PLANE';

interface WorkUnitFixture {
  readonly id: string;
  readonly phase: string;
  readonly actor: string;
  readonly title: string;
  readonly state: WorkUnitState;
  readonly observable: ObservableProjectionName;
  readonly dependsOn: readonly string[];
  readonly activity?: RoleActivity;
}

const workUnitFixtures: readonly WorkUnitFixture[] = [
  {
    id: 'AO-WU-01',
    phase: 'ENTRY',
    actor: 'Advisor',
    title: 'Repo, session, reviewer, transport, and conflict inventory',
    state: 'COMPLETED',
    observable: 'COMPLETED',
    dependsOn: [],
  },
  {
    id: 'AO-WU-02',
    phase: 'ONBOARDING',
    actor: 'Advisor',
    title: 'Register the existing Agent Office tmux session',
    state: 'COMPLETED',
    observable: 'COMPLETED',
    dependsOn: ['AO-WU-01'],
  },
  {
    id: 'AO-WU-03',
    phase: 'ONBOARDING',
    actor: 'Agent Office Worker',
    title: 'Bootstrap Git and repo-local role instructions',
    state: 'COMPLETED',
    observable: 'COMPLETED',
    dependsOn: ['AO-WU-02'],
  },
  {
    id: 'AO-WU-04',
    phase: 'DESIGN',
    actor: 'Agent Office Worker',
    title: 'Author canonical design candidate and contracts',
    state: 'COMPLETED',
    observable: 'COMPLETED',
    dependsOn: ['AO-WU-03'],
  },
  {
    id: 'AO-WU-05',
    phase: 'DESIGN_REVIEW',
    actor: 'Fable5 Reviewer',
    title: 'Independent Level 3 design review',
    state: 'COMPLETED',
    observable: 'COMPLETED',
    dependsOn: ['AO-WU-04'],
  },
  {
    id: 'AO-WU-06',
    phase: 'DESIGN_PATCH',
    actor: 'Agent Office Worker + Fable5 Reviewer',
    title: 'Resolve in-scope design findings and re-review',
    state: 'REVIEW_PENDING',
    observable: 'REVIEWING',
    dependsOn: ['AO-WU-05'],
    activity: 'REVIEW',
  },
  {
    id: 'AO-WU-07',
    phase: 'IMPLEMENTATION_A',
    actor: 'Agent Office Worker',
    title: 'Domain contracts, manifest, state machine, and local projection',
    state: 'WAITING_DEPENDENCY',
    observable: 'WAITING_DEPENDENCY',
    dependsOn: ['AO-WU-05'],
  },
  {
    id: 'AO-WU-08',
    phase: 'IMPLEMENTATION_B',
    actor: 'Agent Office Worker',
    title: 'Read-only tmux, Git, artifact adapters, and dashboard',
    state: 'WAITING_DEPENDENCY',
    observable: 'WAITING_DEPENDENCY',
    dependsOn: ['AO-WU-07'],
  },
  {
    id: 'AO-WU-09',
    phase: 'IMPLEMENTATION_C',
    actor: 'Agent Office Worker',
    title: 'Structured event-driven animated office scene',
    state: 'WAITING_DEPENDENCY',
    observable: 'WAITING_DEPENDENCY',
    dependsOn: ['AO-WU-08'],
  },
  {
    id: 'AO-WU-10',
    phase: 'IMPLEMENTATION_D',
    actor: 'Agent Office Worker',
    title: 'Advisor Inbox, alerts, GPT package, and acknowledgement',
    state: 'WAITING_DEPENDENCY',
    observable: 'WAITING_DEPENDENCY',
    dependsOn: ['AO-WU-09'],
  },
  {
    id: 'AO-WU-11',
    phase: 'IMPLEMENTATION_E',
    actor: 'Agent Office Worker',
    title: 'Responsive PWA, security, recovery, and end-to-end tests',
    state: 'WAITING_DEPENDENCY',
    observable: 'WAITING_DEPENDENCY',
    dependsOn: ['AO-WU-10'],
  },
  {
    id: 'AO-WU-12',
    phase: 'WORKER_RESULT',
    actor: 'Agent Office Worker',
    title: 'Publish evidence-bearing implementation result',
    state: 'WAITING_DEPENDENCY',
    observable: 'WAITING_DEPENDENCY',
    dependsOn: ['AO-WU-11'],
  },
  {
    id: 'AO-WU-13',
    phase: 'IMPLEMENTATION_REVIEW',
    actor: 'Fable5 Reviewer',
    title: 'Independent Level 3 implementation review',
    state: 'WAITING_DEPENDENCY',
    observable: 'WAITING_DEPENDENCY',
    dependsOn: ['AO-WU-12'],
  },
  {
    id: 'AO-WU-14',
    phase: 'PRIVATE_RUN_VERIFY',
    actor: 'Advisor',
    title: 'Verify private server, desktop/mobile UI, PWA, and evidence',
    state: 'WAITING_DEPENDENCY',
    observable: 'WAITING_DEPENDENCY',
    dependsOn: ['AO-WU-13'],
  },
  {
    id: 'AO-WU-15',
    phase: 'FINAL_AUDIT',
    actor: 'Advisor',
    title: 'Final mission audit and Leo/GPT pointer',
    state: 'WAITING_DEPENDENCY',
    observable: 'WAITING_DEPENDENCY',
    dependsOn: ['AO-WU-14'],
  },
];

const phases: readonly PhaseManifest[] = [...new Set(workUnitFixtures.map((item) => item.phase))].map(
  (id, index) => ({
    id,
    order: index + 1,
    workUnitIds: workUnitFixtures.filter((item) => item.phase === id).map((item) => item.id),
  }),
);

const currentWorkUnits = Object.fromEntries(
  workUnitFixtures.map((fixture) => [fixture.id, projectFixture(fixture)]),
);

const currentInput: DashboardViewModelInput = {
  fixtureKind: 'CURRENT_APPROVED_SOURCE',
  mission: {
    missionId: MISSION_ID,
    manifestVersion: 1,
    sequence: 0,
    initiative: { id: 'AGENT_OFFICE', labelKo: 'AI 운영 오피스' },
    package: { id: 'AGENT_OFFICE_M01', labelKo: 'Advisor 관리형 웹 컨트롤 플레인' },
    phases,
    workUnits: currentWorkUnits,
    numerator: 5,
    denominator: 15,
  },
  observations: workUnitFixtures.map((workUnit) => ({
    workUnitId: workUnit.id,
    presentation: 'CURRENT',
    observedAt: FIXTURE_TIME,
    evidenceRef: 'manifest-source-v1',
    reasonCode: 'APPROVED_MANIFEST_SOURCE',
  })),
  blockers: [],
  evidence: [
    {
      evidenceId: 'manifest-source-v1',
      label: 'M01 approved mission manifest',
      relativePath:
        'advisor/jobs/20260711_agent_office_m01_advisor_managed_office_web_control_plane/10_MISSION_MANIFEST.json',
      sha256: 'sha256:195b65b5afa1cd71833f67aa63aa85dd3c869e63f2a017f122584b374a835ac8',
      commit: '6c9d94f31ae5dd5424b511afb68188681ff95349',
      verificationState: 'VERIFIED',
    },
  ],
  requiredGates: [
    { gateId: 'DESIGN_REVIEW', label: 'Design review', status: 'PASSED', required: true },
    { gateId: 'BATCH_A_ACCEPTANCE', label: 'Batch A dependency', status: 'PASSED', required: true },
    { gateId: 'BATCH_B_IMPLEMENTATION', label: 'Batch B implementation', status: 'PENDING', required: true },
    { gateId: 'IMPLEMENTATION_REVIEW', label: 'Implementation review', status: 'PENDING', required: true },
    { gateId: 'FINAL_APPROVAL', label: 'Leo/GPT final approval', status: 'PENDING', required: true },
  ],
  futureUnapprovedWork: [
    'public exposure',
    'real production credentials',
    'Hermes implementation',
    'database-backed multi-user deployment',
  ],
};

const syntheticWorkUnits = {
  ...currentWorkUnits,
  'AO-WU-08': withState(currentWorkUnits['AO-WU-08'], 'BLOCKED', 'BLOCKED'),
  'AO-WU-09': withState(currentWorkUnits['AO-WU-09'], 'WAITING_ADVISOR', 'UNKNOWN_OR_STALE'),
  'AO-WU-10': withState(currentWorkUnits['AO-WU-10'], 'WAITING_LEO', 'WAITING_LEO'),
  'AO-WU-11': withState(currentWorkUnits['AO-WU-11'], 'HOLD', 'UNKNOWN_OR_STALE'),
  'AO-WU-12': withState(currentWorkUnits['AO-WU-12'], 'RUNNING', 'UNKNOWN_OR_STALE'),
} satisfies Readonly<Record<string, WorkUnitProjection>>;

const syntheticPresentations: Readonly<Record<string, 'CURRENT' | 'STALE' | 'OFFLINE' | 'CONFLICT' | 'ERROR'>> = {
  'AO-WU-08': 'CURRENT',
  'AO-WU-09': 'STALE',
  'AO-WU-10': 'OFFLINE',
  'AO-WU-11': 'CONFLICT',
  'AO-WU-12': 'ERROR',
};

const syntheticInput: DashboardViewModelInput = {
  ...currentInput,
  fixtureKind: 'SYNTHETIC_REVIEW',
  mission: { ...currentInput.mission, workUnits: syntheticWorkUnits },
  observations: currentInput.observations.map((observation) => ({
    ...observation,
    presentation: syntheticPresentations[observation.workUnitId] ?? observation.presentation,
    reasonCode:
      syntheticPresentations[observation.workUnitId] === undefined
        ? observation.reasonCode
        : `SYNTHETIC_${syntheticPresentations[observation.workUnitId]}`,
  })),
  blockers: [
    {
      workUnitId: 'AO-WU-08',
      kind: 'MISSING_EVIDENCE',
      reasonCode: 'BATCH_B_EVIDENCE_NOT_VERIFIED',
      resolutionOwner: 'ADVISOR',
      nextActionCode: 'VERIFY_BATCH_B_RESULT',
      explanation: 'Synthetic fixture: evidence must be verified before resume.',
    },
  ],
};

export const CURRENT_DASHBOARD_VIEW_MODEL = buildDashboardViewModel(currentInput);
export const SYNTHETIC_DASHBOARD_VIEW_MODEL = buildDashboardViewModel(syntheticInput);
export { currentInput as CURRENT_DASHBOARD_INPUT, syntheticInput as SYNTHETIC_DASHBOARD_INPUT };

function projectFixture(fixture: WorkUnitFixture): WorkUnitProjection {
  return {
    id: fixture.id,
    phaseId: fixture.phase,
    actor: fixture.actor,
    title: fixture.title,
    state: fixture.state,
    requiredObservableName: fixture.observable,
    dependsOn: fixture.dependsOn,
    attempt: 1,
    sourceStatus: fixture.observable,
    activeInManifest: true,
    ...(fixture.activity === undefined
      ? {}
      : {
          activity: {
            activity: fixture.activity,
            reasonCode: 'MANIFEST_IMPORT',
            sourceEventIds: [],
          },
        }),
  };
}

function withState(
  workUnit: WorkUnitProjection | undefined,
  state: WorkUnitState,
  requiredObservableName: ObservableProjectionName,
): WorkUnitProjection {
  if (workUnit === undefined) throw new Error('dashboard fixture WorkUnit is missing');
  return { ...workUnit, state, requiredObservableName };
}
