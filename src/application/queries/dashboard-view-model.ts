import type { ObservationPresentation } from '../hosts/freshness.js';
import type { WorkUnitProjection } from '../projections/mission-projector.js';
import type { ObservableProjectionName } from '../../domain/activity/index.js';
import type { BlockerKind, ResolutionOwner } from '../../domain/blockers/index.js';
import type { PhaseManifest } from '../../domain/manifest/index.js';
import type { WorkUnitState } from '../../domain/state-machines/work-unit.js';
import {
  blockerReasonLabel,
  FRESHNESS_LABELS_KO,
  HIERARCHY_LABELS_KO,
  PROGRESS_LABELS_KO,
  RESOLUTION_OWNER_LABELS_KO,
  WORK_UNIT_STATE_LABELS_KO,
  type DashboardStateName,
} from '../../ui/i18n/ko.js';

export interface DashboardMissionSnapshot {
  readonly missionId: string;
  readonly manifestVersion: number;
  readonly sequence: number;
  readonly initiative: { readonly id: string; readonly labelKo: string };
  readonly package: { readonly id: string; readonly labelKo: string };
  readonly phases: readonly PhaseManifest[];
  readonly workUnits: Readonly<Record<string, WorkUnitProjection>>;
  readonly numerator: number;
  readonly denominator: number;
}

export interface DashboardObservationInput {
  readonly workUnitId: string;
  readonly presentation: ObservationPresentation;
  readonly observedAt?: string;
  readonly evidenceRef: string;
  readonly reasonCode: string;
}

export interface DashboardBlockerInput {
  readonly workUnitId: string;
  readonly kind: BlockerKind;
  readonly reasonCode: string;
  readonly resolutionOwner: ResolutionOwner;
  readonly nextActionCode: string;
  readonly explanation: string;
}

export interface DashboardEvidenceInput {
  readonly evidenceId: string;
  readonly label: string;
  readonly relativePath: string;
  readonly sha256: string;
  readonly commit: string;
  readonly verificationState: 'VERIFIED' | 'UNVERIFIED' | 'STALE' | 'DIRTY' | 'INVALID' | 'MISSING';
}

export interface RequiredGateInput {
  readonly gateId: string;
  readonly label: string;
  readonly status: 'PASSED' | 'PENDING' | 'FAILED' | 'HOLD';
  readonly required: boolean;
}

export interface DashboardViewModelInput {
  readonly fixtureKind: 'CURRENT_APPROVED_SOURCE' | 'SYNTHETIC_REVIEW';
  readonly mission: DashboardMissionSnapshot;
  readonly observations: readonly DashboardObservationInput[];
  readonly blockers: readonly DashboardBlockerInput[];
  readonly evidence: readonly DashboardEvidenceInput[];
  readonly requiredGates: readonly RequiredGateInput[];
  readonly futureUnapprovedWork: readonly string[];
}

export interface DashboardWorkUnitViewModel {
  readonly id: string;
  readonly title: string;
  readonly actor: string;
  readonly phaseId: string;
  readonly state: WorkUnitState;
  readonly stateName: DashboardStateName;
  readonly stateLabelKo: string;
  readonly dependencies: readonly string[];
  readonly freshness: ObservationPresentation;
  readonly freshnessLabelKo: string;
  readonly freshnessReasonCode: string;
  readonly lastStructuredActivityAt?: string;
  readonly blocker?: {
    readonly reason: string;
    readonly explanation: string;
    readonly resolutionOwner: ResolutionOwner | 'UNKNOWN';
    readonly resolutionOwnerLabelKo: string;
    readonly nextActionCode: string;
  };
}

export interface DashboardViewModel {
  readonly fixtureKind: DashboardViewModelInput['fixtureKind'];
  readonly hierarchyLabelsKo: typeof HIERARCHY_LABELS_KO;
  readonly initiative: DashboardMissionSnapshot['initiative'];
  readonly package: DashboardMissionSnapshot['package'];
  readonly missionId: string;
  readonly manifestVersion: number;
  readonly projectionSequence: number;
  readonly phases: readonly {
    readonly id: string;
    readonly workUnitIds: readonly string[];
  }[];
  readonly workUnits: readonly DashboardWorkUnitViewModel[];
  readonly workUnitProgress: {
    readonly labelKo: string;
    readonly completed: number;
    readonly denominator: number;
    readonly manifestVersion: number;
  };
  readonly requiredGateProgress: {
    readonly labelKo: string;
    readonly passed: number;
    readonly denominator: number;
    readonly gates: readonly RequiredGateInput[];
  };
  readonly evidence: readonly DashboardEvidenceInput[];
  readonly futureUnapprovedWork: readonly string[];
  readonly banners: readonly {
    readonly presentation: Exclude<ObservationPresentation, 'CURRENT'>;
    readonly labelKo: string;
    readonly reasonCodes: readonly string[];
  }[];
}

export function buildDashboardViewModel(input: DashboardViewModelInput): DashboardViewModel {
  const observations = new Map(input.observations.map((item) => [item.workUnitId, item]));
  const blockers = new Map(input.blockers.map((item) => [item.workUnitId, item]));
  const phaseOrder = new Map(input.mission.phases.map((phase) => [phase.id, phase.order]));
  const workUnits = Object.values(input.mission.workUnits)
    .filter((workUnit) => workUnit.activeInManifest)
    .sort((left, right) => {
      const byPhase = (phaseOrder.get(left.phaseId) ?? Number.MAX_SAFE_INTEGER) -
        (phaseOrder.get(right.phaseId) ?? Number.MAX_SAFE_INTEGER);
      return byPhase === 0 ? left.id.localeCompare(right.id) : byPhase;
    })
    .map((workUnit) => projectWorkUnit(workUnit, observations.get(workUnit.id), blockers.get(workUnit.id)));
  const requiredGates = input.requiredGates.filter((gate) => gate.required);
  const presentations = new Map<Exclude<ObservationPresentation, 'CURRENT'>, Set<string>>();
  for (const observation of input.observations) {
    if (observation.presentation === 'CURRENT') continue;
    const reasons = presentations.get(observation.presentation) ?? new Set<string>();
    reasons.add(observation.reasonCode);
    presentations.set(observation.presentation, reasons);
  }
  const bannerOrder: readonly Exclude<ObservationPresentation, 'CURRENT'>[] = [
    'CONFLICT',
    'ERROR',
    'OFFLINE',
    'STALE',
    'UNKNOWN',
  ];
  return {
    fixtureKind: input.fixtureKind,
    hierarchyLabelsKo: HIERARCHY_LABELS_KO,
    initiative: input.mission.initiative,
    package: input.mission.package,
    missionId: input.mission.missionId,
    manifestVersion: input.mission.manifestVersion,
    projectionSequence: input.mission.sequence,
    phases: input.mission.phases.map((phase) => ({ id: phase.id, workUnitIds: phase.workUnitIds })),
    workUnits,
    workUnitProgress: {
      labelKo: PROGRESS_LABELS_KO.workUnitCount,
      completed: input.mission.numerator,
      denominator: input.mission.denominator,
      manifestVersion: input.mission.manifestVersion,
    },
    requiredGateProgress: {
      labelKo: PROGRESS_LABELS_KO.requiredGate,
      passed: requiredGates.filter((gate) => gate.status === 'PASSED').length,
      denominator: requiredGates.length,
      gates: requiredGates,
    },
    evidence: [...input.evidence].sort((left, right) => left.evidenceId.localeCompare(right.evidenceId)),
    futureUnapprovedWork: [...input.futureUnapprovedWork],
    banners: bannerOrder.flatMap((presentation) => {
      const reasonCodes = presentations.get(presentation);
      return reasonCodes === undefined
        ? []
        : [{ presentation, labelKo: FRESHNESS_LABELS_KO[presentation], reasonCodes: [...reasonCodes].sort() }];
    }),
  };
}

function projectWorkUnit(
  workUnit: WorkUnitProjection,
  observation?: DashboardObservationInput,
  blocker?: DashboardBlockerInput,
): DashboardWorkUnitViewModel {
  const freshness = observation?.presentation ?? 'UNKNOWN';
  const stateName = selectStateName(workUnit.state, workUnit.requiredObservableName, freshness);
  const blockerView =
    blocker === undefined
      ? workUnit.state === 'BLOCKED'
        ? {
            reason: `${WORK_UNIT_STATE_LABELS_KO.BLOCKED} (BLOCKER_DETAIL_MISSING)`,
            explanation: 'BLOCKER_DETAIL_MISSING',
            resolutionOwner: 'UNKNOWN' as const,
            resolutionOwnerLabelKo: RESOLUTION_OWNER_LABELS_KO.UNKNOWN,
            nextActionCode: 'NO_AUTOMATIC_ACTION',
          }
        : undefined
      : {
          reason: blockerReasonLabel(blocker.kind, blocker.reasonCode),
          explanation: blocker.explanation,
          resolutionOwner: blocker.resolutionOwner,
          resolutionOwnerLabelKo: RESOLUTION_OWNER_LABELS_KO[blocker.resolutionOwner],
          nextActionCode: blocker.nextActionCode,
        };
  return {
    id: workUnit.id,
    title: workUnit.title,
    actor: workUnit.actor,
    phaseId: workUnit.phaseId,
    state: workUnit.state,
    stateName,
    stateLabelKo: WORK_UNIT_STATE_LABELS_KO[stateName],
    dependencies: workUnit.dependsOn,
    freshness,
    freshnessLabelKo: FRESHNESS_LABELS_KO[freshness],
    freshnessReasonCode: observation?.reasonCode ?? 'OBSERVATION_NOT_AVAILABLE',
    ...(workUnit.activity?.effectiveFrom === undefined
      ? {}
      : { lastStructuredActivityAt: workUnit.activity.effectiveFrom }),
    ...(blockerView === undefined ? {} : { blocker: blockerView }),
  };
}

function selectStateName(
  state: WorkUnitState,
  observable: ObservableProjectionName,
  freshness: ObservationPresentation,
): DashboardStateName {
  if (state === 'WAITING_ADVISOR' || state === 'HOLD') return state;
  if (state === 'WAITING_LEO' || state === 'BLOCKED' || state === 'WAITING_DEPENDENCY') return state;
  const activityDependentStates: readonly WorkUnitState[] = [
    'DISPATCHED',
    'RUNNING',
    'TESTING',
    'RESULT_REPORTED',
    'REVIEW_PENDING',
  ];
  if (activityDependentStates.includes(state) && freshness !== 'CURRENT') return 'UNKNOWN_OR_STALE';
  return observable;
}
