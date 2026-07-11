import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { projectRequiredObservable } from '../../src/domain/activity/index.js';

import {
  SPATIAL_CUE_SCHEMA_VERSION,
  createSpatialCueId,
  projectSpatialCue,
  type SpatialCueEvidenceKind,
  type SpatialCueFactInput,
  type SpatialCueFactKind,
  type SpatialCueKind,
  type SpatialCueProjectorInput,
  type SpatialCueUpdateOrigin,
} from '../../src/ui/spatial/cue-projector.js';

const EVENT_IDS = Array.from({ length: 32 }, (_, index) =>
  `00000000-0000-7${index.toString(16).padStart(3, '0')}-8000-${(index + 1).toString().padStart(12, '0')}`);

interface MappingCase {
  readonly factKind: SpatialCueFactKind;
  readonly cueKind: SpatialCueKind;
  readonly state: SpatialCueFactInput['workUnitState'];
  readonly previousState?: SpatialCueFactInput['previousWorkUnitState'];
  readonly activity?: SpatialCueFactInput['activity'];
  readonly evidence: readonly SpatialCueEvidenceKind[];
  readonly durationMs: number;
  readonly sourceZone: string;
  readonly targetZone?: string;
  readonly recovery?: Pick<SpatialCueFactInput, 'recoveryStep' | 'recoveryTotalSteps' | 'recoveryReadOnly'>;
}

const MAPPINGS: readonly MappingCase[] = [
  mapping('LEO_GPT_HANDOFF_ACCEPTED', 'LEO_GPT_TO_ADVISOR_HANDOFF', 'READY', ['STRUCTURED_HANDOFF', 'EXACT_ADVISOR_ROUTE'], 900, 'leo-decision-destination', 'advisor-anchor'),
  mapping('WORKUNIT_DISPATCH_ACCEPTED', 'DELIVERY', 'DISPATCHED', ['STRUCTURED_HANDOFF', 'EXACT_ADVISOR_ROUTE'], 1100, 'advisor-anchor', 'work:worker.agent-office.primary', 'READY', activity('DELIVERY', 'WORKUNIT_DISPATCH')),
  mapping('READING_ACCEPTED', 'READING', 'RUNNING', ['IMMUTABLE_INPUT_OR_ACK'], 900, 'work:worker.agent-office.primary', 'work:worker.agent-office.primary', undefined, activity('READING', 'INPUT_ACKNOWLEDGED')),
  mapping('WORKING_ACCEPTED', 'WORKING', 'RUNNING', [], 900, 'work:worker.agent-office.primary', undefined, undefined, activity('WORKING', 'IMPLEMENTATION_ACTIVE')),
  mapping('TESTING_ACCEPTED', 'TESTING', 'TESTING', ['COMMAND_AND_EVIDENCE_REFS'], 1200, 'work:worker.agent-office.primary', 'testing-bench', undefined, activity('TESTING', 'TEST_COMMAND_ACCEPTED')),
  mapping('RESULT_DRAFT_ACCEPTED', 'WRITING_RESULT', 'RUNNING', ['RESULT_DRAFT_STARTED'], 900, 'work:worker.agent-office.primary', 'result-desk', undefined, activity('WRITING_RESULT', 'RESULT_DRAFT_STARTED')),
  mapping('REVIEW_HANDOFF_ACCEPTED', 'REVIEW_HANDOFF', 'REVIEW_PENDING', ['STRUCTURED_HANDOFF', 'EXACT_INDEPENDENT_REVIEWER'], 900, 'result-desk', 'independent-review-desk'),
  mapping('REVIEW_ACTIVITY_ACCEPTED', 'REVIEW', 'REVIEW_PENDING', ['EXACT_INDEPENDENT_REVIEWER'], 1000, 'independent-review-desk', 'independent-review-desk', undefined, activity('REVIEW', 'INDEPENDENT_REVIEW_ACTIVE')),
  mapping('REVIEW_VERDICT_ACCEPTED', 'REVIEW_VERDICT_RETURN', 'REVIEW_PENDING', ['VERIFIED_REVIEW_VERDICT', 'EXACT_ADVISOR_ROUTE'], 800, 'independent-review-desk', 'advisor-anchor'),
  mapping('BLOCKER_ACCEPTED', 'BLOCKED', 'BLOCKED', ['VERIFIED_BLOCKER'], 150, 'work:worker.agent-office.primary', 'work:worker.agent-office.primary', undefined, activity('BLOCKED', 'DEPENDENCY_BLOCKED')),
  mapping('DECISION_REQUEST_ACCEPTED', 'WAITING_LEO', 'WAITING_LEO', ['VERIFIED_DECISION_REQUEST', 'EXACT_ADVISOR_ROUTE'], 900, 'advisor-anchor', 'leo-decision-destination', undefined, activity('WAITING_LEO', 'DECISION_REQUESTED')),
  mapping('RESULT_ACCEPTED', 'RESULT_RETURN', 'RESULT_REPORTED', ['VERIFIED_RESULT_AND_POINTER', 'EXACT_ADVISOR_ROUTE'], 800, 'result-desk', 'advisor-anchor', undefined, activity('RESULT_RETURN', 'RESULT_REPORTED')),
  mapping('PATCH_RETURN_ACCEPTED', 'PATCH_RETURN', 'NEEDS_PATCH', ['VERIFIED_REVIEW_VERDICT', 'EXACT_ASSIGNED_WORKER'], 800, 'independent-review-desk', 'work:worker.agent-office.primary'),
  mapping('COMPLETION_ACKNOWLEDGEMENT_ACCEPTED', 'COMPLETION_ACKNOWLEDGEMENT', 'COMPLETED', ['CANONICAL_COMPLETION', 'STRUCTURED_ACKNOWLEDGEMENT', 'EXACT_ADVISOR_ROUTE'], 700, 'advisor-anchor', 'mission-board'),
  {
    ...mapping('RECOVERY_STEP_ACCEPTED', 'RECOVERY', 'RUNNING', ['VERIFIED_RECOVERY_STEP'], 1000, 'control-recovery', 'control-recovery', undefined, activity('RECOVERY', 'READ_ONLY_RECOVERY')),
    recovery: { recoveryStep: 2, recoveryTotalSteps: 4, recoveryReadOnly: true },
  },
  mapping('VERIFIED_IDLE_ACCEPTED', 'IDLE_RELOCATE', 'READY', ['VERIFIED_IDLE'], 700, 'work:worker.agent-office.primary', 'lounge', undefined, activity('IDLE', 'NO_ACTIVE_WORK')),
];

describe('AO12-IWU-09 spatial cue mapping', () => {
  it.each(MAPPINGS)('maps $factKind to the exact $cueKind envelope', (entry) => {
    const input = inputFor(entry);
    const result = projectSpatialCue(input);
    expect(result.diagnosticCode).toBe('ELIGIBLE');
    expect(result.suppressionScope).toBe('NONE');
    expect(result.cue).toMatchObject({
      schemaVersion: SPATIAL_CUE_SCHEMA_VERSION,
      cueKind: entry.cueKind,
      projectId: 'agent-office',
      podId: 'pod:agent-office',
      missionId: 'mission-ao12',
      workUnitId: 'AO12-IWU-09',
      roleInstanceId: 'worker.agent-office.primary',
      missionSequence: 42,
      projectionRevision: 13,
      sourceZoneId: entry.sourceZone,
      evidenceFreshness: 'CURRENT',
      connectionState: 'CONNECTED',
      createdFromOrigin: 'LIVE_DELTA',
      durationMs: entry.durationMs,
    });
    expect(result.cue?.targetZoneId).toBe(entry.targetZone);
    expect(result.cue?.durationMs).toBeGreaterThanOrEqual(150);
    expect(result.cue?.durationMs).toBeLessThanOrEqual(1200);
  });

  it.each(MAPPINGS)('rejects unaccepted source and invalid evidence for $factKind', (entry) => {
    const input = inputFor(entry);
    const unacceptedSource = projectSpatialCue({
      ...input,
      fact: { ...input.fact, sourceEventIds: [requireEvent(31)] },
    });
    expect(unacceptedSource.cue).toBeNull();
    expect(unacceptedSource.diagnosticCode).toBe('STRUCTURED_SOURCE_UNAVAILABLE');

    if (entry.evidence.length > 0) {
      const missingEvidence = projectSpatialCue({
        ...input,
        fact: { ...input.fact, verifiedEvidence: entry.evidence.slice(1) },
      });
      expect(missingEvidence.cue).toBeNull();
      expect(missingEvidence.diagnosticCode).toBe('REQUIRED_EVIDENCE_MISSING');
    } else {
      const mismatchedActivity = projectSpatialCue(withActivitySources(input, [requireEvent(31)]));
      expect(mismatchedActivity.cue).toBeNull();
      expect(mismatchedActivity.diagnosticCode).toBe('SOURCE_CORRESPONDENCE_INVALID');
    }
  });

  it('derives cueId from the exact canonical JSON array and sorted source IDs', () => {
    const sourceEventIds = [requireEvent(2), requireEvent(0), requireEvent(1)];
    const cueId = createSpatialCueId({
      projectId: 'agent-office',
      missionId: 'mission-ao12',
      roleInstanceId: 'worker.agent-office.primary',
      workUnitId: 'AO12-IWU-09',
      cueKind: 'WORKING',
      sourceEventIds,
    });
    const canonical = JSON.stringify([
      SPATIAL_CUE_SCHEMA_VERSION,
      'agent-office',
      'mission-ao12',
      'worker.agent-office.primary',
      'AO12-IWU-09',
      'WORKING',
      [...sourceEventIds].sort(),
    ]);
    expect(cueId).toBe(`sha256:${createHash('sha256').update(canonical).digest('hex')}`);
    expect(createSpatialCueId({
      projectId: 'agent-office',
      missionId: 'mission-ao12',
      roleInstanceId: 'worker.agent-office.primary',
      workUnitId: 'AO12-IWU-09',
      cueKind: 'WORKING',
      sourceEventIds: [...sourceEventIds].reverse(),
    })).toBe(cueId);
  });

  it.each([
    'INITIAL_SNAPSHOT',
    'RELOAD_SNAPSHOT',
    'CURSOR_RESET_SNAPSHOT',
    'TAB_RESUME',
    'POD_SELECTION',
  ] satisfies readonly SpatialCueUpdateOrigin[])('%s never creates a cue', (origin) => {
    const result = projectSpatialCue(inputFor(requireMapping('WORKING_ACCEPTED'), { updateOrigin: origin }));
    expect(result.cue).toBeNull();
    expect(result.diagnosticCode).toBe('NOT_LIVE_DELTA');
  });

  it.each([
    ['STALE', 'EVIDENCE_NOT_CURRENT'],
    ['OFFLINE', 'EVIDENCE_NOT_CURRENT'],
    ['UNKNOWN', 'EVIDENCE_NOT_CURRENT'],
    ['CONFLICT', 'EVIDENCE_NOT_CURRENT'],
    ['ERROR', 'EVIDENCE_NOT_CURRENT'],
  ] as const)('suppresses %s evidence without a delayed cue', (freshness, diagnostic) => {
    const base = inputFor(requireMapping('WORKING_ACCEPTED'));
    const result = projectSpatialCue({ ...base, pod: { ...base.pod, evidenceFreshness: freshness } });
    expect(result.cue).toBeNull();
    expect(result.diagnosticCode).toBe(diagnostic);
    expect(result.suppressionScope).toBe('ACTOR');
  });

  it.each(['OFFLINE', 'UNKNOWN', 'CONFLICT'] as const)('suppresses %s connection evidence', (connectionState) => {
    const base = inputFor(requireMapping('WORKING_ACCEPTED'));
    const result = projectSpatialCue({ ...base, pod: { ...base.pod, connectionState } });
    expect(result.cue).toBeNull();
    expect(result.diagnosticCode).toBe('CONNECTION_NOT_CONNECTED');
  });

  it('fails closed for selection, revision, source, alert, assignment, Advisor, and evidence defects', () => {
    const base = inputFor(requireMapping('TESTING_ACCEPTED'));
    const variants: readonly [SpatialCueProjectorInput, string][] = [
      [{ ...base, selectedPodId: 'pod:other' }, 'NON_SELECTED_POD'],
      [{ ...base, projectionRevision: 12 }, 'PROJECTION_NOT_STRICTLY_NEWER'],
      [{ ...base, mission: { ...base.mission, manifestVerified: false } }, 'SOURCE_UNVERIFIED'],
      [{ ...base, fact: { ...base.fact, sourceEventIds: ['not-an-event'] } }, 'STRUCTURED_SOURCE_UNAVAILABLE'],
      [{ ...base, pod: { ...base.pod, openAlertSeverity: 'CRITICAL' } }, 'CRITICAL_ALERT_SUPPRESSION'],
      [{ ...base, actor: { ...base.actor, assignmentStatus: 'UNASSIGNED' } }, 'ASSIGNMENT_UNKNOWN'],
      [{ ...base, actor: { ...base.actor, assignmentStatus: 'ASSIGNMENT_CONFLICT' } }, 'ASSIGNMENT_CONFLICT'],
      [{ ...base, actor: { ...base.actor, responsibleAdvisorTeamIds: [] } }, 'ADVISOR_RESPONSIBILITY_UNKNOWN'],
      [{ ...base, actor: { ...base.actor, responsibleAdvisorStatus: 'ADVISOR_RESPONSIBILITY_UNKNOWN' } }, 'ADVISOR_RESPONSIBILITY_UNKNOWN'],
      [{ ...base, actor: { ...base.actor, responsibleAdvisorStatus: 'ADVISOR_RESPONSIBILITY_CONFLICT' } }, 'ADVISOR_RESPONSIBILITY_CONFLICT'],
      [{ ...base, actor: { ...base.actor, responsibleAdvisorRoleInstanceIds: ['advisor.foundation.primary', 'advisor.foundation.primary'] } }, 'ADVISOR_RESPONSIBILITY_CONFLICT'],
      [{ ...base, actor: { ...base.actor, responsibleAdvisorRoleInstanceIds: ['advisor.other'] } }, 'ADVISOR_RESPONSIBILITY_CONFLICT'],
      [{ ...base, fact: { ...base.fact, verifiedEvidence: [] } }, 'REQUIRED_EVIDENCE_MISSING'],
      [{ ...base, fact: { ...base.fact, activity: activity('WORKING', 'WRONG') } }, 'SOURCE_CORRESPONDENCE_INVALID'],
      [{ ...base, fact: { ...base.fact, stateSourceEventId: requireEvent(31) } }, 'SOURCE_CORRESPONDENCE_INVALID'],
      [{ ...base, fact: { ...base.fact, requiredObservableName: 'WORKING' } }, 'SOURCE_CORRESPONDENCE_INVALID'],
      [withActivitySources(inputFor(requireMapping('READING_ACCEPTED')), [requireEvent(31)]), 'SOURCE_CORRESPONDENCE_INVALID'],
      [withRecoveryReadOnly(inputFor(requireMapping('RECOVERY_STEP_ACCEPTED')), false), 'SOURCE_CORRESPONDENCE_INVALID'],
    ];
    for (const [variant, diagnostic] of variants) {
      const result = projectSpatialCue(variant);
      expect(result.cue, diagnostic).toBeNull();
      expect(result.diagnosticCode).toBe(diagnostic);
    }
  });

  it('ignores terminal, model, process, prose, proximity, and timestamp-shaped extra properties', () => {
    const base = inputFor(requireMapping('WORKING_ACCEPTED'));
    const polluted = {
      ...base,
      terminalOutput: 'done working review approved',
      processName: 'worker-process',
      modelProse: 'move to the review desk',
      nearestPod: 'pod:other',
      timestampHint: '2099-01-01T00:00:00.000Z',
    } as SpatialCueProjectorInput;
    expect(projectSpatialCue(polluted)).toEqual(projectSpatialCue(base));
  });

  it('rejects an expired activity using only explicit evaluatedAt', () => {
    const entry = requireMapping('WORKING_ACCEPTED');
    const base = inputFor(entry);
    const result = projectSpatialCue({
      ...base,
      fact: {
        ...base.fact,
        activity: { ...requireActivity(base.fact.activity), optionalExpiresAt: base.evaluatedAt },
      },
    });
    expect(result.cue).toBeNull();
    expect(result.diagnosticCode).toBe('ACTIVITY_EXPIRED');
  });

  it('accepts a verified terminal assignment end as the alternate idle-relocation source', () => {
    const base = inputFor(requireMapping('VERIFIED_IDLE_ACCEPTED'));
    const { activity: ignoredActivity, ...factWithoutActivity } = base.fact;
    void ignoredActivity;
    const result = projectSpatialCue({
      ...base,
      fact: {
        ...factWithoutActivity,
        workUnitState: 'COMPLETED',
        requiredObservableName: 'COMPLETED',
        acceptedAssignmentEnd: true,
      },
    });
    expect(result.diagnosticCode).toBe('ELIGIBLE');
    expect(result.cue?.cueKind).toBe('IDLE_RELOCATE');
  });
});

function inputFor(
  entry: MappingCase,
  override: Partial<SpatialCueProjectorInput> = {},
): SpatialCueProjectorInput {
  const sourceEventIds = [requireEvent(MAPPINGS.indexOf(entry))];
  const evaluatedAt = '2026-07-11T12:00:00.000Z';
  const activityInput = entry.activity === undefined ? undefined : { ...entry.activity, sourceEventIds };
  const fact: SpatialCueFactInput = {
    factKind: entry.factKind,
    sourceEventIds,
    workUnitId: 'AO12-IWU-09',
    ...(entry.previousState === undefined ? {} : { previousWorkUnitState: entry.previousState }),
    ...(entry.state === undefined ? {} : {
      workUnitState: entry.state,
      stateSourceEventId: sourceEventIds[0],
      requiredObservableName: projectRequiredObservable(
        entry.state,
        activityInput === undefined ? undefined : { ...activityInput, effectiveFrom: evaluatedAt },
        evaluatedAt,
      ).requiredObservableName,
    }),
    ...(activityInput === undefined ? {} : { activity: activityInput }),
    verifiedEvidence: entry.evidence,
    currentZoneId: 'work:worker.agent-office.primary',
    ...(entry.recovery ?? {}),
  };
  return {
    projectionSchemaVersion: 'agent-office.spatial-office-projection.v1',
    projectionRevision: 13,
    previousAppliedRevision: 12,
    evaluatedAt,
    updateOrigin: 'LIVE_DELTA',
    selectedPodId: 'pod:agent-office',
    pod: {
      podId: 'pod:agent-office',
      advisorTeamId: 'FOUNDATION_ADVISOR_TEAM',
      projectId: 'agent-office',
      selected: true,
      sourceAuthorityVerified: true,
      evidenceFreshness: 'CURRENT',
      connectionState: 'CONNECTED',
      responsibleAdvisorRoleInstanceIds: ['advisor.foundation.primary'],
      openAlertSeverity: 'NONE',
    },
    mission: {
      missionId: 'mission-ao12',
      manifestVersion: '1.0.0',
      manifestVerified: true,
      missionSequence: 42,
      acceptedEventIds: sourceEventIds,
    },
    actor: {
      roleInstanceId: 'worker.agent-office.primary',
      advisorTeamId: 'FOUNDATION_ADVISOR_TEAM',
      responsibleAdvisorStatus: 'VERIFIED',
      responsibleAdvisorTeamIds: ['FOUNDATION_ADVISOR_TEAM'],
      responsibleAdvisorRoleInstanceIds: ['advisor.foundation.primary'],
      assignmentStatus: 'VERIFIED',
      assignmentProjectId: 'agent-office',
      assignmentMissionId: 'mission-ao12',
      assignmentWorkUnitId: 'AO12-IWU-09',
      sourceBoundaryVerified: true,
      taskMotionAllowed: true,
    },
    fact,
    ...override,
  };
}

function mapping(
  factKind: SpatialCueFactKind,
  cueKind: SpatialCueKind,
  state: SpatialCueFactInput['workUnitState'],
  evidence: readonly SpatialCueEvidenceKind[],
  durationMs: number,
  sourceZone: string,
  targetZone?: string,
  previousState?: SpatialCueFactInput['previousWorkUnitState'],
  activityValue?: SpatialCueFactInput['activity'],
): MappingCase {
  return {
    factKind,
    cueKind,
    state,
    evidence,
    durationMs,
    sourceZone,
    ...(targetZone === undefined ? {} : { targetZone }),
    ...(previousState === undefined ? {} : { previousState }),
    ...(activityValue === undefined ? {} : { activity: activityValue }),
  };
}

function activity(
  name: NonNullable<SpatialCueFactInput['activity']>['activity'],
  reasonCode: string,
): NonNullable<SpatialCueFactInput['activity']> {
  return { activity: name, reasonCode, sourceEventIds: [] };
}

function requireMapping(factKind: SpatialCueFactKind): MappingCase {
  const entry = MAPPINGS.find((candidate) => candidate.factKind === factKind);
  if (entry === undefined) throw new TypeError(`mapping missing for ${factKind}`);
  return entry;
}

function requireEvent(index: number): string {
  const eventId = EVENT_IDS[index];
  if (eventId === undefined) throw new TypeError(`event fixture missing at ${index}`);
  return eventId;
}

function requireActivity(value: SpatialCueFactInput['activity']): NonNullable<SpatialCueFactInput['activity']> {
  if (value === undefined) throw new TypeError('activity fixture missing');
  return value;
}

function withActivitySources(
  input: SpatialCueProjectorInput,
  sourceEventIds: readonly string[],
): SpatialCueProjectorInput {
  return {
    ...input,
    fact: {
      ...input.fact,
      activity: { ...requireActivity(input.fact.activity), sourceEventIds },
    },
  };
}

function withRecoveryReadOnly(
  input: SpatialCueProjectorInput,
  recoveryReadOnly: boolean,
): SpatialCueProjectorInput {
  return { ...input, fact: { ...input.fact, recoveryReadOnly } };
}
