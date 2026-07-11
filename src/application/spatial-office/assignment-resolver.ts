import type {
  SpatialActorAssignmentView,
  SpatialActorProjection,
  SpatialAssignmentRef,
  SpatialAssignmentStatus,
  SpatialEvidenceFreshness,
  SpatialConnectionState,
} from './types.js';

export const FOUNDATION_ADVISOR_TEAM_ID = 'FOUNDATION_ADVISOR_TEAM' as const;
export const VIBENEWS_ADVISOR_TEAM_ID = 'VIBENEWS_ADVISOR_TEAM' as const;

export const FOUNDATION_ADVISOR_TEAM_ROLES = [
  'Advisor',
  'Foundation Advisor',
  'Control',
  'Foundation Worker',
  'Cosmile Worker',
  'SIASIU Worker',
  'Agent Office Worker',
  'Fable5 Reviewer',
] as const;

export const VIBENEWS_ADVISOR_TEAM_ROLES = [
  'VibeNews Advisor',
  'VibeNews Worker',
  'VibeNews Designer',
  'VibeNews Reviewer',
] as const;

export interface AdvisorTeamAuthorityInput {
  readonly advisorTeamId: string;
  readonly responsibleAdvisorRoleInstanceIds: readonly string[];
  readonly memberRoleInstanceIds: readonly string[];
  readonly authorityEvidenceStatus: 'VERIFIED' | 'UNVERIFIED' | 'CONFLICT';
  readonly authorityEvidenceRef: string | null;
}

export interface SpatialActorRegistrationInput {
  readonly roleInstanceId: string;
  readonly actorRole: string;
  readonly displayIdentity: string;
  readonly projectId: string;
  readonly hostId: string;
  readonly sourceId: string;
  readonly evidenceFreshness: SpatialEvidenceFreshness;
  readonly connectionState: SpatialConnectionState;
  readonly active: boolean;
  readonly independentReviewer: boolean;
}

export interface SpatialWorkAssignmentInput {
  readonly assignmentRef: SpatialAssignmentRef;
  readonly expectedActorRole: string;
  readonly candidateRoleInstanceIds: readonly string[];
  readonly hostId: string;
  readonly sourceId: string;
  readonly sourceVerified: boolean;
  readonly nonterminal: boolean;
  readonly currentActivitySourceEventId: string | null;
  readonly acceptedEventIds: readonly string[];
  readonly reviewerAssignment: boolean;
}

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const AUTHORITY_EVIDENCE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

export interface SpatialAssignmentResolution {
  readonly actorsByRoleInstanceId: Readonly<Record<string, SpatialActorProjection>>;
  readonly assignmentViews: readonly SpatialActorAssignmentView[];
}

interface ActorResolutionContext {
  readonly registration: SpatialActorRegistrationInput;
  readonly duplicateSource: boolean;
  readonly teamIds: readonly string[];
  readonly teamAuthorityStatuses: readonly AdvisorTeamAuthorityInput['authorityEvidenceStatus'][];
  readonly teamAuthorityEvidenceRefs: readonly (string | null)[];
  readonly advisorRoleInstanceIds: readonly string[];
  readonly workAssignments: readonly SpatialWorkAssignmentInput[];
}

export function resolveSpatialAssignments(input: {
  readonly teams: readonly AdvisorTeamAuthorityInput[];
  readonly actors: readonly SpatialActorRegistrationInput[];
  readonly workAssignments: readonly SpatialWorkAssignmentInput[];
}): SpatialAssignmentResolution {
  const actors = groupActors(input.actors);
  const teams = normalizeTeams(input.teams, actors);
  const candidateViews = input.workAssignments
    .flatMap((assignment) => resolveAssignmentViews(assignment, actors))
    .sort((left, right) => compareStableText(assignmentViewKey(left), assignmentViewKey(right)));

  const actorsByRoleInstanceId: Record<string, SpatialActorProjection> = {};
  for (const roleInstanceId of [...actors.keys()].sort()) {
    const registrations = actors.get(roleInstanceId) ?? [];
    const registration = registrations[0];
    if (registration === undefined) continue;
    const memberTeams = teams.filter((team) => team.memberRoleInstanceIds.includes(roleInstanceId));
    const actorAssignments = input.workAssignments.filter((assignment) =>
      assignment.candidateRoleInstanceIds.includes(roleInstanceId));
    actorsByRoleInstanceId[roleInstanceId] = resolveActor({
      registration,
      duplicateSource: registrations.length !== 1,
      teamIds: memberTeams.map((team) => team.advisorTeamId).sort(),
      teamAuthorityStatuses: memberTeams.map((team) => team.authorityEvidenceStatus),
      teamAuthorityEvidenceRefs: memberTeams.map((team) => team.authorityEvidenceRef),
      advisorRoleInstanceIds: memberTeams
        .flatMap((team) => team.responsibleAdvisorRoleInstanceIds)
        .sort(),
      workAssignments: actorAssignments,
    });
  }

  const assignmentViews = candidateViews.map((view) => {
    if (view.roleInstanceId === null) return view;
    const actor = actorsByRoleInstanceId[view.roleInstanceId];
    if (actor?.assignmentStatus !== 'VERIFIED') {
      return {
        ...view,
        status: actor?.assignmentStatus ?? view.status,
        fullCharacter: false,
        taskMotionAllowed: false,
      };
    }
    const fullCharacter = actor.activeAssignmentRef !== null
      && assignmentRefKey(actor.activeAssignmentRef) === assignmentRefKey(view.assignmentRef)
      && actor.presentationPodId !== null;
    return {
      ...view,
      fullCharacter,
      taskMotionAllowed: fullCharacter && actor.taskMotionAllowed,
    };
  });
  return { actorsByRoleInstanceId, assignmentViews };
}

function resolveActor(context: ActorResolutionContext): SpatialActorProjection {
  const { registration } = context;
  const teamShapeStatus = initialTeamShapeStatus(registration, context.teamIds);
  const responsibleAdvisorStatus = context.teamIds.length === 0
    ? 'ADVISOR_RESPONSIBILITY_UNKNOWN'
    : context.teamAuthorityStatuses.includes('CONFLICT')
      || context.teamIds.length !== 1
      || context.advisorRoleInstanceIds.length > 1
      ? 'ADVISOR_RESPONSIBILITY_CONFLICT'
      : context.teamAuthorityStatuses[0] !== 'VERIFIED'
        || context.advisorRoleInstanceIds.length === 0
        ? 'ADVISOR_RESPONSIBILITY_UNKNOWN'
        : 'VERIFIED';
  const exactTeam = responsibleAdvisorStatus === 'VERIFIED' && teamShapeStatus === 'VERIFIED';

  const assignmentRefs = uniqueAssignments(context.workAssignments.map((item) => item.assignmentRef));
  const applicable = context.workAssignments.filter((assignment) =>
    assignment.candidateRoleInstanceIds.length === 1
    && assignment.candidateRoleInstanceIds[0] === registration.roleInstanceId);
  const sourceConflict = context.duplicateSource || applicable.some((assignment) =>
    !assignment.sourceVerified
    || assignment.assignmentRef.projectId !== registration.projectId
    || assignment.hostId !== registration.hostId
    || assignment.sourceId !== registration.sourceId
    || assignment.expectedActorRole !== registration.actorRole
    || assignment.reviewerAssignment !== registration.independentReviewer
    || hasInvalidCurrentActivitySource(assignment)
    || hasInvalidAcceptedEventSet(assignment));
  const candidateConflict = context.workAssignments.some((assignment) =>
    assignment.candidateRoleInstanceIds.includes(registration.roleInstanceId)
    && assignment.candidateRoleInstanceIds.length !== 1);
  const current = applicable.filter((assignment) =>
    assignment.nonterminal && hasAcceptedCurrentActivitySource(assignment) && assignment.sourceVerified);

  let assignmentStatus: SpatialAssignmentStatus;
  if (!exactTeam) {
    assignmentStatus = 'UNASSIGNED';
  } else if (sourceConflict) {
    assignmentStatus = 'SOURCE_CONFLICT';
  } else if (candidateConflict || current.length > 1) {
    assignmentStatus = 'ASSIGNMENT_CONFLICT';
  } else if (assignmentRefs.length === 0) {
    assignmentStatus = 'ASSIGNMENT_UNKNOWN';
  } else {
    assignmentStatus = 'VERIFIED';
  }

  const activeAssignmentRef = assignmentStatus === 'VERIFIED' && current.length === 1
    ? current[0]?.assignmentRef ?? null
    : null;
  const currentActivitySourceEventId = activeAssignmentRef === null
    ? null
    : current[0]?.currentActivitySourceEventId ?? null;
  const workReceiptAllowed = registration.active
    && exactTeam
    && assignmentStatus === 'VERIFIED'
    && activeAssignmentRef !== null;
  const taskMotionAllowed = workReceiptAllowed
    && registration.evidenceFreshness === 'CURRENT'
    && registration.connectionState === 'CONNECTED';
  const advisorTeamId = exactTeam ? context.teamIds[0] ?? null : null;
  const responsibleAdvisorRoleInstanceId = exactTeam
    ? unique(context.advisorRoleInstanceIds)[0] ?? null
    : null;
  const teamAuthorityEvidenceRef = exactTeam
    ? context.teamAuthorityEvidenceRefs[0] ?? null
    : null;
  const presentationPodId = taskMotionAllowed
    ? podIdForProject(activeAssignmentRef.projectId)
    : null;
  const presentationScope = presentationPodId !== null
    ? 'TEAM_POD'
    : exactTeam
      && registration.active
      && responsibleAdvisorRoleInstanceId === registration.roleInstanceId
      ? 'GLOBAL_ADVISOR_HUB'
      : 'NONE';

  return {
    roleInstanceId: registration.roleInstanceId,
    actorRole: registration.actorRole,
    displayIdentity: { state: 'KNOWN', value: registration.displayIdentity },
    advisorTeamId,
    teamAuthorityEvidenceRef,
    projectId: assignmentStatus === 'SOURCE_CONFLICT' ? null : registration.projectId,
    responsibleAdvisorRoleInstanceId,
    assignmentStatus,
    responsibleAdvisorStatus: exactTeam ? 'VERIFIED' : responsibleAdvisorStatus,
    assignmentRefs,
    activeAssignmentRef,
    currentActivitySourceEventId,
    presentationScope,
    presentationPodId,
    evidenceFreshness: registration.evidenceFreshness,
    connectionState: registration.connectionState,
    operationalState: activeAssignmentRef === null ? 'IDLE' : 'WORKING',
    workReceiptAllowed,
    taskMotionAllowed,
    independentReviewer: registration.independentReviewer,
  };
}

function resolveAssignmentViews(
  assignment: SpatialWorkAssignmentInput,
  actors: ReadonlyMap<string, readonly SpatialActorRegistrationInput[]>,
): readonly SpatialActorAssignmentView[] {
  const candidateIds = unique(assignment.candidateRoleInstanceIds);
  if (candidateIds.length === 0) {
    return [assignmentView(assignment.assignmentRef, null, 'ASSIGNMENT_UNKNOWN', false)];
  }
  if (assignment.candidateRoleInstanceIds.length !== 1 || candidateIds.length !== 1) {
    const affectedIds = candidateIds.filter((roleInstanceId) => actors.has(roleInstanceId));
    return affectedIds.length === 0
      ? [assignmentView(assignment.assignmentRef, null, 'ASSIGNMENT_CONFLICT', false)]
      : affectedIds.map((roleInstanceId) =>
          assignmentView(
            assignment.assignmentRef,
            roleInstanceId,
            'ASSIGNMENT_CONFLICT',
            false,
          ));
  }
  const roleInstanceId = candidateIds[0];
  const registrations = roleInstanceId === undefined ? [] : actors.get(roleInstanceId) ?? [];
  if (roleInstanceId === undefined || registrations.length === 0) {
    return [assignmentView(assignment.assignmentRef, null, 'ASSIGNMENT_UNKNOWN', false)];
  }
  const actor = registrations[0];
  if (
    actor === undefined
    || registrations.length !== 1
    || !assignment.sourceVerified
    || actor.projectId !== assignment.assignmentRef.projectId
    || actor.hostId !== assignment.hostId
    || actor.sourceId !== assignment.sourceId
    || actor.actorRole !== assignment.expectedActorRole
    || actor.independentReviewer !== assignment.reviewerAssignment
    || hasInvalidCurrentActivitySource(assignment)
    || hasInvalidAcceptedEventSet(assignment)
  ) {
    return [assignmentView(assignment.assignmentRef, roleInstanceId, 'SOURCE_CONFLICT', false)];
  }
  const fullCharacter = assignment.nonterminal && hasAcceptedCurrentActivitySource(assignment);
  const motionAllowed = fullCharacter
    && actor.active
    && actor.evidenceFreshness === 'CURRENT'
    && actor.connectionState === 'CONNECTED';
  return [
    assignmentView(
      assignment.assignmentRef,
      roleInstanceId,
      'VERIFIED',
      motionAllowed,
      fullCharacter,
    ),
  ];
}

function assignmentView(
  assignmentRef: SpatialAssignmentRef,
  roleInstanceId: string | null,
  status: SpatialAssignmentStatus,
  taskMotionAllowed: boolean,
  fullCharacter = false,
): SpatialActorAssignmentView {
  return { assignmentRef, roleInstanceId, status, fullCharacter, taskMotionAllowed };
}

function hasAcceptedCurrentActivitySource(assignment: SpatialWorkAssignmentInput): boolean {
  const eventId = assignment.currentActivitySourceEventId;
  return eventId !== null
    && UUID_V7.test(eventId)
    && assignment.acceptedEventIds.includes(eventId);
}

function hasInvalidCurrentActivitySource(assignment: SpatialWorkAssignmentInput): boolean {
  return assignment.currentActivitySourceEventId !== null
    && !hasAcceptedCurrentActivitySource(assignment);
}

function hasInvalidAcceptedEventSet(assignment: SpatialWorkAssignmentInput): boolean {
  return new Set(assignment.acceptedEventIds).size !== assignment.acceptedEventIds.length
    || assignment.acceptedEventIds.some((eventId) => !UUID_V7.test(eventId));
}

function initialTeamShapeStatus(
  actor: SpatialActorRegistrationInput,
  teamIds: readonly string[],
): 'VERIFIED' | 'CONFLICT' {
  if (actor.actorRole === 'Fable5 Reviewer' && !actor.independentReviewer) {
    return 'CONFLICT';
  }
  if (FOUNDATION_ADVISOR_TEAM_ROLES.includes(actor.actorRole as (typeof FOUNDATION_ADVISOR_TEAM_ROLES)[number])) {
    return teamIds.length === 1 && teamIds[0] === FOUNDATION_ADVISOR_TEAM_ID ? 'VERIFIED' : 'CONFLICT';
  }
  if (VIBENEWS_ADVISOR_TEAM_ROLES.includes(actor.actorRole as (typeof VIBENEWS_ADVISOR_TEAM_ROLES)[number])) {
    return teamIds.length === 1 && teamIds[0] === VIBENEWS_ADVISOR_TEAM_ID ? 'VERIFIED' : 'CONFLICT';
  }
  return teamIds.length === 1 ? 'VERIFIED' : 'CONFLICT';
}

function normalizeTeams(
  teams: readonly AdvisorTeamAuthorityInput[],
  actors: ReadonlyMap<string, readonly SpatialActorRegistrationInput[]>,
): readonly AdvisorTeamAuthorityInput[] {
  const teamIdCounts = new Map<string, number>();
  for (const team of teams) {
    teamIdCounts.set(team.advisorTeamId, (teamIdCounts.get(team.advisorTeamId) ?? 0) + 1);
  }
  return teams.map((team) => {
    const advisorId = team.responsibleAdvisorRoleInstanceIds[0];
    const advisorRegistrations = advisorId === undefined ? [] : actors.get(advisorId) ?? [];
    const advisor = advisorRegistrations[0];
    const structuralConflict = team.authorityEvidenceStatus === 'CONFLICT'
      || teamIdCounts.get(team.advisorTeamId) !== 1
      || team.responsibleAdvisorRoleInstanceIds.length > 1
      || new Set(team.memberRoleInstanceIds).size !== team.memberRoleInstanceIds.length
      || advisorRegistrations.length > 1;
    const exactAuthority = !structuralConflict
      && team.authorityEvidenceStatus === 'VERIFIED'
      && team.authorityEvidenceRef !== null
      && AUTHORITY_EVIDENCE_REF.test(team.authorityEvidenceRef)
      && team.responsibleAdvisorRoleInstanceIds.length === 1
      && advisorId !== undefined
      && team.memberRoleInstanceIds.includes(advisorId)
      && advisorRegistrations.length === 1
      && advisor !== undefined
      && !advisor.independentReviewer
      && advisorRoleMatchesTeam(team.advisorTeamId, advisor.actorRole)
      && initialRosterMatches(team, actors);
    return {
      ...team,
      responsibleAdvisorRoleInstanceIds: [...team.responsibleAdvisorRoleInstanceIds].sort(),
      memberRoleInstanceIds: [...team.memberRoleInstanceIds].sort(),
      authorityEvidenceStatus: structuralConflict
        ? 'CONFLICT'
        : exactAuthority
          ? 'VERIFIED'
          : 'UNVERIFIED',
    };
  });
}

function groupActors(
  actors: readonly SpatialActorRegistrationInput[],
): ReadonlyMap<string, readonly SpatialActorRegistrationInput[]> {
  const result = new Map<string, SpatialActorRegistrationInput[]>();
  for (const actor of actors) {
    const existing = result.get(actor.roleInstanceId) ?? [];
    existing.push(actor);
    result.set(actor.roleInstanceId, existing);
  }
  return result;
}

function advisorRoleMatchesTeam(advisorTeamId: string, actorRole: string): boolean {
  if (advisorTeamId === FOUNDATION_ADVISOR_TEAM_ID) {
    return actorRole === 'Advisor' || actorRole === 'Foundation Advisor';
  }
  if (advisorTeamId === VIBENEWS_ADVISOR_TEAM_ID) {
    return actorRole === 'VibeNews Advisor';
  }
  return true;
}

function initialRosterMatches(
  team: AdvisorTeamAuthorityInput,
  actors: ReadonlyMap<string, readonly SpatialActorRegistrationInput[]>,
): boolean {
  const members = team.memberRoleInstanceIds.map((roleInstanceId) => actors.get(roleInstanceId) ?? []);
  if (members.some((registrations) => registrations.length !== 1)) return false;
  const registrations = members.flatMap((value) => value);
  if (team.advisorTeamId === FOUNDATION_ADVISOR_TEAM_ID) {
    const advisorCount = registrations.filter((actor) =>
      actor.actorRole === 'Advisor' || actor.actorRole === 'Foundation Advisor').length;
    const requiredRoles = [
      'Control',
      'Foundation Worker',
      'Cosmile Worker',
      'SIASIU Worker',
      'Agent Office Worker',
    ];
    const allowedRoles = new Set<string>([
      'Advisor',
      'Foundation Advisor',
      ...requiredRoles,
      'Fable5 Reviewer',
    ]);
    return advisorCount === 1
      && requiredRoles.every((role) => registrations.filter((actor) => actor.actorRole === role).length === 1)
      && registrations.every((actor) => allowedRoles.has(actor.actorRole))
      && registrations
        .filter((actor) => actor.actorRole === 'Fable5 Reviewer')
        .every((actor) => actor.independentReviewer);
  }
  if (team.advisorTeamId === VIBENEWS_ADVISOR_TEAM_ID) {
    const requiredRoles = [
      'VibeNews Advisor',
      'VibeNews Worker',
      'VibeNews Designer',
      'VibeNews Reviewer',
    ];
    return registrations.length === requiredRoles.length
      && requiredRoles.every((role) => registrations.filter((actor) => actor.actorRole === role).length === 1)
      && registrations
        .filter((actor) => actor.actorRole === 'VibeNews Reviewer')
        .every((actor) => actor.independentReviewer);
  }
  return true;
}

function uniqueAssignments(values: readonly SpatialAssignmentRef[]): readonly SpatialAssignmentRef[] {
  const byKey = new Map(values.map((value) => [assignmentRefKey(value), value]));
  return [...byKey.values()].sort((left, right) =>
    compareStableText(assignmentRefKey(left), assignmentRefKey(right)));
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function assignmentRefKey(ref: SpatialAssignmentRef): string {
  return `${ref.projectId}\u0000${ref.missionId}\u0000${ref.workUnitId}`;
}

function assignmentViewKey(view: SpatialActorAssignmentView): string {
  return `${assignmentRefKey(view.assignmentRef)}\u0000${view.roleInstanceId ?? ''}`;
}

function podIdForProject(projectId: string): string {
  return `pod:${projectId}`;
}

function compareStableText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
