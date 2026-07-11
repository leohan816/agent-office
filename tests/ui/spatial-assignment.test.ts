import { describe, expect, it } from 'vitest';

import {
  FOUNDATION_ADVISOR_TEAM_ID,
  VIBENEWS_ADVISOR_TEAM_ID,
  resolveSpatialAssignments,
  type AdvisorTeamAuthorityInput,
  type SpatialActorRegistrationInput,
  type SpatialWorkAssignmentInput,
} from '../../src/application/spatial-office/assignment-resolver.js';

describe('AO12-IWU-04 fail-closed assignment and Single Advisor Team invariants', () => {
  it('resolves one compatible actor, one Foundation Team, and one responsible Advisor', () => {
    const input = foundationInput();
    const authorityEvidenceRef = input.teams[0]?.authorityEvidenceRef;
    if (authorityEvidenceRef === null || authorityEvidenceRef === undefined) {
      throw new Error('Team authority fixture missing');
    }
    const result = resolveSpatialAssignments(input);
    expect(result.actorsByRoleInstanceId.worker).toMatchObject({
      advisorTeamId: FOUNDATION_ADVISOR_TEAM_ID,
      teamAuthorityEvidenceRef: authorityEvidenceRef,
      responsibleAdvisorRoleInstanceId: 'advisor',
      assignmentStatus: 'VERIFIED',
      responsibleAdvisorStatus: 'VERIFIED',
      activeAssignmentRef: input.workAssignments[0]?.assignmentRef,
      presentationPodId: 'pod:agent-office',
      workReceiptAllowed: true,
      taskMotionAllowed: true,
    });
    expect(result.assignmentViews).toEqual([
      expect.objectContaining({
        roleInstanceId: 'worker',
        status: 'VERIFIED',
        fullCharacter: true,
        taskMotionAllowed: true,
      }),
    ]);
    expect(Object.keys(result.actorsByRoleInstanceId).filter((id) => id === 'advisor')).toHaveLength(1);
    expect(result.actorsByRoleInstanceId.advisor).toMatchObject({
      presentationScope: 'GLOBAL_ADVISOR_HUB',
      presentationPodId: null,
      responsibleAdvisorRoleInstanceId: 'advisor',
    });
  });

  it('renders missing or multiple Team/Advisor authority UNASSIGNED and motionless', () => {
    const missing = foundationInput();
    const missingResult = resolveSpatialAssignments({
      ...missing,
      teams: missing.teams.map((team) => ({ ...team, memberRoleInstanceIds: ['advisor'] })),
    });
    expect(missingResult.actorsByRoleInstanceId.worker).toMatchObject({
      advisorTeamId: null,
      responsibleAdvisorRoleInstanceId: null,
      assignmentStatus: 'UNASSIGNED',
      responsibleAdvisorStatus: 'ADVISOR_RESPONSIBILITY_UNKNOWN',
      workReceiptAllowed: false,
      taskMotionAllowed: false,
    });

    const missingAdvisorResult = resolveSpatialAssignments({
      ...missing,
      actors: missing.actors.filter((actorValue) => actorValue.roleInstanceId !== 'advisor'),
    });
    expect(missingAdvisorResult.actorsByRoleInstanceId.worker).toMatchObject({
      assignmentStatus: 'UNASSIGNED',
      responsibleAdvisorStatus: 'ADVISOR_RESPONSIBILITY_UNKNOWN',
      workReceiptAllowed: false,
      taskMotionAllowed: false,
    });

    const missingAuthorityEvidence = resolveSpatialAssignments({
      ...missing,
      teams: missing.teams.map((teamValue) => ({
        ...teamValue,
        authorityEvidenceRef: null,
      })),
    });
    expect(missingAuthorityEvidence.actorsByRoleInstanceId.worker).toMatchObject({
      advisorTeamId: null,
      teamAuthorityEvidenceRef: null,
      assignmentStatus: 'UNASSIGNED',
      responsibleAdvisorStatus: 'ADVISOR_RESPONSIBILITY_UNKNOWN',
      workReceiptAllowed: false,
    });

    const multiple = foundationInput();
    const secondAdvisor = actor('advisor.second', 'Second Advisor', 'foundation');
    const multipleResult = resolveSpatialAssignments({
      teams: [
        ...multiple.teams,
        team('SECOND_ADVISOR_TEAM', 'advisor.second', ['advisor.second', 'worker']),
      ],
      actors: [...multiple.actors, secondAdvisor],
      workAssignments: multiple.workAssignments,
    });
    expect(multipleResult.actorsByRoleInstanceId.worker).toMatchObject({
      assignmentStatus: 'UNASSIGNED',
      responsibleAdvisorStatus: 'ADVISOR_RESPONSIBILITY_CONFLICT',
      presentationPodId: null,
      workReceiptAllowed: false,
      taskMotionAllowed: false,
    });
    expect(multipleResult.assignmentViews[0]).toMatchObject({
      status: 'UNASSIGNED',
      fullCharacter: false,
      taskMotionAllowed: false,
    });

    const sameTeamMultipleAdvisors = resolveSpatialAssignments({
      teams: missing.teams.map((teamValue) => ({
        ...teamValue,
        responsibleAdvisorRoleInstanceIds: ['advisor', 'advisor.second'],
        memberRoleInstanceIds: [...teamValue.memberRoleInstanceIds, 'advisor.second'].sort(),
      })),
      actors: [
        ...missing.actors,
        actor('advisor.second', 'Foundation Advisor', 'foundation'),
      ],
      workAssignments: missing.workAssignments,
    });
    expect(sameTeamMultipleAdvisors.actorsByRoleInstanceId.worker).toMatchObject({
      assignmentStatus: 'UNASSIGNED',
      responsibleAdvisorStatus: 'ADVISOR_RESPONSIBILITY_CONFLICT',
      taskMotionAllowed: false,
    });

    const duplicateMembership = resolveSpatialAssignments({
      ...missing,
      teams: missing.teams.map((teamValue) => ({
        ...teamValue,
        memberRoleInstanceIds: [...teamValue.memberRoleInstanceIds, 'worker'],
      })),
    });
    expect(duplicateMembership.actorsByRoleInstanceId.worker).toMatchObject({
      assignmentStatus: 'UNASSIGNED',
      taskMotionAllowed: false,
    });
  });

  it('fails closed for missing, duplicate, project, host, source, and role mismatches', () => {
    const base = foundationInput();
    const primary = firstAssignment(base);
    expect(resolveSpatialAssignments({
      ...base,
      workAssignments: [{ ...primary, candidateRoleInstanceIds: [] }],
    }).assignmentViews[0]).toMatchObject({ status: 'ASSIGNMENT_UNKNOWN', roleInstanceId: null });

    const duplicate = resolveSpatialAssignments({
      ...base,
      workAssignments: [{
        ...primary,
        candidateRoleInstanceIds: ['worker', 'advisor'],
      }],
    });
    expect(duplicate.assignmentViews[0]).toMatchObject({
      status: 'ASSIGNMENT_CONFLICT',
      fullCharacter: false,
      taskMotionAllowed: false,
    });

    for (const incompatible of [
      { assignmentRef: { projectId: 'other-project', missionId: 'mission', workUnitId: 'work-unit' } },
      { hostId: 'other-host' },
      { sourceId: 'other-source' },
      { sourceVerified: false },
      { expectedActorRole: 'Different Worker' },
      {
        currentActivitySourceEventId: '00000000-0000-7000-8000-000000000202',
        acceptedEventIds: [],
      },
    ]) {
      const assignment = { ...primary, ...incompatible };
      const result = resolveSpatialAssignments({ ...base, workAssignments: [assignment] });
      expect(result.actorsByRoleInstanceId.worker, JSON.stringify(incompatible)).toMatchObject({
        assignmentStatus: 'SOURCE_CONFLICT',
        presentationPodId: null,
        workReceiptAllowed: false,
        taskMotionAllowed: false,
      });
    }
  });

  it('shows static refs without guessing current activity and suppresses simultaneous activity conflict', () => {
    const base = foundationInput();
    const primary = firstAssignment(base);
    const second = {
      ...primary,
      assignmentRef: { projectId: 'agent-office', missionId: 'mission', workUnitId: 'work-unit-2' },
    };
    const staticResult = resolveSpatialAssignments({
      ...base,
      workAssignments: [
        { ...primary, currentActivitySourceEventId: null },
        { ...second, currentActivitySourceEventId: null },
      ],
    });
    expect(staticResult.actorsByRoleInstanceId.worker).toMatchObject({
      assignmentStatus: 'VERIFIED',
      activeAssignmentRef: null,
      presentationPodId: null,
      workReceiptAllowed: false,
      taskMotionAllowed: false,
    });
    expect(staticResult.assignmentViews.every((view) => !view.fullCharacter)).toBe(true);

    const conflict = resolveSpatialAssignments({
      ...base,
      workAssignments: [primary, second],
    });
    expect(conflict.actorsByRoleInstanceId.worker).toMatchObject({
      assignmentStatus: 'ASSIGNMENT_CONFLICT',
      activeAssignmentRef: null,
      presentationPodId: null,
      taskMotionAllowed: false,
    });
    expect(conflict.assignmentViews.every((view) =>
      !view.fullCharacter && !view.taskMotionAllowed)).toBe(true);
  });

  it('keeps Reviewer work independent and models future Advisors as distinct identities', () => {
    const base = foundationInput();
    const primary = firstAssignment(base);
    const reviewer = {
      ...actor('reviewer', 'Fable5 Reviewer', 'agent-office'),
      independentReviewer: true,
    };
    const reviewAssignment: SpatialWorkAssignmentInput = {
      ...primary,
      expectedActorRole: 'Fable5 Reviewer',
      candidateRoleInstanceIds: ['reviewer'],
      reviewerAssignment: true,
    };
    const independent = resolveSpatialAssignments({
      teams: base.teams.map((value) => ({
        ...value,
        memberRoleInstanceIds: [...value.memberRoleInstanceIds, 'reviewer'].sort(),
      })),
      actors: [...base.actors, reviewer],
      workAssignments: [reviewAssignment],
    });
    expect(independent.actorsByRoleInstanceId.reviewer).toMatchObject({
      independentReviewer: true,
      assignmentStatus: 'VERIFIED',
    });

    const workerChain = resolveSpatialAssignments({
      teams: base.teams.map((value) => ({
        ...value,
        memberRoleInstanceIds: [...value.memberRoleInstanceIds, 'reviewer'].sort(),
      })),
      actors: [...base.actors, reviewer],
      workAssignments: [{ ...reviewAssignment, reviewerAssignment: false }],
    });
    expect(workerChain.actorsByRoleInstanceId.reviewer).toMatchObject({
      assignmentStatus: 'SOURCE_CONFLICT',
      taskMotionAllowed: false,
    });

    const futureAdvisor = actor('advisor.vibe', 'VibeNews Advisor', 'vibenews');
    const futureWorker = actor('worker.vibe', 'VibeNews Worker', 'vibenews');
    const futureDesigner = actor('designer.vibe', 'VibeNews Designer', 'vibenews');
    const futureReviewer = {
      ...actor('reviewer.vibe', 'VibeNews Reviewer', 'vibenews'),
      independentReviewer: true,
    };
    const twoTeams = resolveSpatialAssignments({
      teams: [
        ...base.teams,
        team(VIBENEWS_ADVISOR_TEAM_ID, 'advisor.vibe', [
          'advisor.vibe',
          'worker.vibe',
          'designer.vibe',
          'reviewer.vibe',
        ]),
      ],
      actors: [...base.actors, futureAdvisor, futureWorker, futureDesigner, futureReviewer],
      workAssignments: base.workAssignments,
    });
    expect(twoTeams.actorsByRoleInstanceId.advisor?.roleInstanceId).toBe('advisor');
    expect(twoTeams.actorsByRoleInstanceId['advisor.vibe']?.roleInstanceId).toBe('advisor.vibe');
    expect(twoTeams.actorsByRoleInstanceId.advisor?.presentationScope).toBe('GLOBAL_ADVISOR_HUB');
    expect(twoTeams.actorsByRoleInstanceId['advisor.vibe']?.presentationScope).toBe(
      'GLOBAL_ADVISOR_HUB',
    );
    const actorValues = Object.values(twoTeams.actorsByRoleInstanceId);
    expect(new Set(actorValues.map((value) => value.roleInstanceId)).size).toBe(
      actorValues.length,
    );
  });
});

function foundationInput(): {
  readonly teams: readonly AdvisorTeamAuthorityInput[];
  readonly actors: readonly SpatialActorRegistrationInput[];
  readonly workAssignments: readonly SpatialWorkAssignmentInput[];
} {
  return {
    teams: [team(FOUNDATION_ADVISOR_TEAM_ID, 'advisor', [
      'advisor',
      'control',
      'foundation-worker',
      'cosmile-worker',
      'siasiu-worker',
      'worker',
    ])],
    actors: [
      actor('advisor', 'Foundation Advisor', 'agent-office'),
      actor('control', 'Control', 'agent-office'),
      actor('foundation-worker', 'Foundation Worker', 'agent-office'),
      actor('cosmile-worker', 'Cosmile Worker', 'agent-office'),
      actor('siasiu-worker', 'SIASIU Worker', 'agent-office'),
      actor('worker', 'Agent Office Worker', 'agent-office'),
    ],
    workAssignments: [{
      assignmentRef: { projectId: 'agent-office', missionId: 'mission', workUnitId: 'work-unit' },
      expectedActorRole: 'Agent Office Worker',
      candidateRoleInstanceIds: ['worker'],
      hostId: 'host.local',
      sourceId: 'source.agent-office',
      sourceVerified: true,
      nonterminal: true,
      currentActivitySourceEventId: '00000000-0000-7000-8000-000000000201',
      acceptedEventIds: ['00000000-0000-7000-8000-000000000201'],
      reviewerAssignment: false,
    }],
  };
}

function firstAssignment(input: ReturnType<typeof foundationInput>): SpatialWorkAssignmentInput {
  const assignment = input.workAssignments[0];
  if (assignment === undefined) throw new Error('work assignment fixture missing');
  return assignment;
}

function team(
  advisorTeamId: string,
  responsibleAdvisorRoleInstanceId: string,
  memberRoleInstanceIds: readonly string[],
): AdvisorTeamAuthorityInput {
  return {
    advisorTeamId,
    responsibleAdvisorRoleInstanceIds: [responsibleAdvisorRoleInstanceId],
    memberRoleInstanceIds,
    authorityEvidenceStatus: 'VERIFIED',
    authorityEvidenceRef: `authority.${advisorTeamId.toLowerCase()}.v1`,
  };
}

function actor(
  roleInstanceId: string,
  actorRole: string,
  projectId: string,
): SpatialActorRegistrationInput {
  return {
    roleInstanceId,
    actorRole,
    displayIdentity: `${roleInstanceId} display`,
    projectId,
    hostId: 'host.local',
    sourceId: `source.${projectId}`,
    evidenceFreshness: 'CURRENT',
    connectionState: 'CONNECTED',
    active: true,
    independentReviewer: false,
  };
}
