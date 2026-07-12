import type {
  PixelActorInput,
  PixelCueInput,
  PixelPodInput,
  PixelProjectIdentity,
  PixelPrototypeProjection,
} from '../contracts.js';
import { PIXEL_PROTOTYPE_FIXTURE_ID } from '../contracts.js';
import { PROJECT_PIXEL_COLORS } from '../assets/palette.js';

const identities = {
  'agent-office': identity('agent-office', 'Agent Office', 'AO', 'A', 'CHEVRON'),
  control: identity('control', 'Control', 'CTRL', 'C', 'GRID'),
  cosmile: identity('cosmile', 'Cosmile', 'COS', 'O', 'DOTS'),
  foundation: identity('foundation', 'Foundation', 'FND', 'F', 'BANDS'),
  siasiu: identity('siasiu', 'SIASIU', 'SIA', 'S', 'CROSS'),
  vibenews: identity('vibenews', 'VibeNews', 'VIBE', 'V', 'CHECKS'),
} as const;

const pods: readonly PixelPodInput[] = [
  pod('agent-office', 'FOUNDATION_ADVISOR_TEAM', 'advisor.foundation.primary', 'Living pixel-office', 'AO12-PWU-08', 'worker.agent-office.primary', 'WORKING', 8, 13, 2, 3, [
    'worker.agent-office.primary', 'advisor.foundation.primary', 'reviewer.fable5.primary',
  ]),
  pod('control', 'FOUNDATION_ADVISOR_TEAM', 'advisor.foundation.primary', 'Recovery guardrails', 'AO12-CTRL-04', 'control.foundation.primary', 'TESTING', 4, 7, 3, 5, [
    'control.foundation.primary',
  ]),
  pod('cosmile', 'FOUNDATION_ADVISOR_TEAM', 'advisor.foundation.primary', 'Cosmile private mission', 'COS-IWU-05', 'worker.cosmile.primary', 'IDLE', 5, 8, 2, 4, [
    'worker.cosmile.primary',
  ]),
  pod('foundation', 'FOUNDATION_ADVISOR_TEAM', 'advisor.foundation.primary', 'Foundation operations', 'FND-IWU-12', 'worker.foundation.primary', 'WORKING', 12, 18, 4, 6, [
    'worker.foundation.primary',
  ]),
  pod('siasiu', 'FOUNDATION_ADVISOR_TEAM', 'advisor.foundation.primary', 'SIASIU private mission', 'SIA-IWU-03', 'worker.siasiu.primary', 'WAITING_DEPENDENCY', 3, 9, 1, 4, [
    'worker.siasiu.primary',
  ]),
  pod('vibenews', 'VIBENEWS_ADVISOR_TEAM', 'advisor.vibenews.primary', 'VibeNews private mission', 'VIBE-IWU-07', 'worker.vibenews.primary', 'WORKING', 7, 11, 3, 5, [
    'advisor.vibenews.primary', 'worker.vibenews.primary', 'designer.vibenews.primary',
  ]),
];

const actors: readonly PixelActorInput[] = [
  actor('advisor.foundation.primary', 'Foundation Advisor', 'ADVISOR_ROUTING', 'FOUNDATION_ADVISOR_TEAM', 'advisor.foundation.primary', 'foundation', 'pod:agent-office'),
  actor('advisor.vibenews.primary', 'VibeNews Advisor', 'ADVISOR_ROUTING', 'VIBENEWS_ADVISOR_TEAM', 'advisor.vibenews.primary', 'vibenews', 'pod:vibenews'),
  actor('control.foundation.primary', 'Control', 'CONTROL_RECOVERY', 'FOUNDATION_ADVISOR_TEAM', 'advisor.foundation.primary', 'control', 'pod:control'),
  actor('reviewer.fable5.primary', 'Fable5 Reviewer', 'INDEPENDENT_REVIEW', 'FOUNDATION_ADVISOR_TEAM', 'advisor.foundation.primary', 'agent-office', 'pod:agent-office'),
  actor('worker.agent-office.primary', 'Agent Office Worker', 'WORKER_BUILD', 'FOUNDATION_ADVISOR_TEAM', 'advisor.foundation.primary', 'agent-office', 'pod:agent-office'),
  actor('worker.cosmile.primary', 'Cosmile Worker', 'WORKER_BUILD', 'FOUNDATION_ADVISOR_TEAM', 'advisor.foundation.primary', 'cosmile', 'pod:cosmile'),
  actor('worker.foundation.primary', 'Foundation Worker', 'WORKER_BUILD', 'FOUNDATION_ADVISOR_TEAM', 'advisor.foundation.primary', 'foundation', 'pod:foundation'),
  actor('worker.siasiu.primary', 'SIASIU Worker', 'WORKER_BUILD', 'FOUNDATION_ADVISOR_TEAM', 'advisor.foundation.primary', 'siasiu', 'pod:siasiu'),
  actor('worker.vibenews.primary', 'VibeNews Worker', 'WORKER_BUILD', 'VIBENEWS_ADVISOR_TEAM', 'advisor.vibenews.primary', 'vibenews', 'pod:vibenews'),
  actor('designer.vibenews.primary', 'VibeNews Designer', 'GENERIC_REGISTERED', 'VIBENEWS_ADVISOR_TEAM', 'advisor.vibenews.primary', 'vibenews', 'pod:vibenews'),
];

const cues: readonly PixelCueInput[] = [
  cue('cue-working-foundation', 'WORKING', 701, 'pod:foundation', 'worker.foundation.primary', 'FND-IWU-12', 'walkway:center', 'pod:pod:foundation:desk', 900, 101),
  cue('cue-relocate-foundation', 'IDLE_RELOCATE', 708, 'pod:foundation', 'worker.foundation.primary', 'FND-IWU-12', 'walkway:center', 'pod:pod:foundation:desk', 1200, 100),
  cue('cue-working-vibenews', 'WORKING', 702, 'pod:vibenews', 'worker.vibenews.primary', 'VIBE-IWU-07', 'walkway:east', 'pod:pod:vibenews:desk', 900, 102),
  cue('cue-delivery-agent-office', 'DELIVERY', 703, 'pod:agent-office', 'advisor.foundation.primary', 'AO12-PWU-08', 'facility:decision', 'pod:pod:agent-office:desk', 1200, 103),
  cue('cue-review-agent-office', 'REVIEW', 704, 'pod:agent-office', 'reviewer.fable5.primary', 'AO12-PWU-09', 'pod:pod:agent-office:desk', 'facility:reviewer-booth', 1000, 104),
  cue('cue-idle-cosmile', 'IDLE_RELOCATE', 705, 'pod:cosmile', 'worker.cosmile.primary', 'COS-IWU-05', 'pod:pod:cosmile:desk', 'facility:lounge', 1200, 105),
  cue('cue-waiting-leo-agent-office', 'WAITING_LEO', 706, 'pod:agent-office', 'worker.agent-office.primary', 'AO12-PWU-09', 'pod:pod:agent-office:desk', 'facility:decision', 1200, 106),
  cue('cue-blocked-agent-office', 'BLOCKED', 707, 'pod:agent-office', 'worker.agent-office.primary', 'AO12-PWU-09', 'pod:pod:agent-office:desk', 'pod:pod:agent-office:board', 150, 107),
];

export const LIVING_PIXEL_PROTOTYPE_PROJECTION: PixelPrototypeProjection = {
  schemaVersion: 'agent-office.pixel-prototype-projection.v1',
  fixtureId: PIXEL_PROTOTYPE_FIXTURE_ID,
  fixtureLabel: 'SYNTHETIC PROTOTYPE',
  projectionRevision: 27,
  evaluatedAt: '2026-07-12T12:00:00.000Z',
  selectedPodId: 'pod:foundation',
  pods,
  actors,
  cues,
  sourceEventIds: cues.map((candidate) => candidate.sourceEventId).sort(),
};

function identity(
  projectId: keyof typeof PROJECT_PIXEL_COLORS,
  displayName: string,
  shortLabel: string,
  glyph: string,
  pattern: PixelProjectIdentity['pattern'],
): PixelProjectIdentity {
  return {
    identityId: `agent-office.pixel-project-identity.${projectId}.v1`,
    projectId,
    displayName,
    shortLabel,
    glyph,
    pattern,
    primaryColor: PROJECT_PIXEL_COLORS[projectId].primary,
    secondaryColor: PROJECT_PIXEL_COLORS[projectId].secondary,
  };
}

function pod(
  projectId: keyof typeof identities,
  advisorTeamId: string,
  responsibleAdvisorRoleInstanceId: string,
  missionShortLabel: string,
  currentWorkUnitShortId: string,
  currentActorRoleInstanceId: string,
  operationalState: PixelPodInput['operationalState'],
  completedWorkUnits: number,
  totalWorkUnits: number,
  completedGates: number,
  totalGates: number,
  actorRoleInstanceIds: readonly string[],
): PixelPodInput {
  return {
    podId: `pod:${projectId}`,
    advisorTeamId,
    responsibleAdvisorRoleInstanceId,
    projectIdentity: identities[projectId],
    missionShortLabel,
    currentWorkUnitShortId,
    currentActorRoleInstanceId,
    operationalState,
    completedWorkUnits,
    totalWorkUnits,
    completedGates,
    totalGates,
    blockerSummary: null,
    actorRoleInstanceIds,
  };
}

function actor(
  roleInstanceId: string,
  displayName: string,
  roleCategory: PixelActorInput['roleCategory'],
  advisorTeamId: string,
  responsibleAdvisorRoleInstanceId: string,
  projectId: string,
  presentationPodId: string,
): PixelActorInput {
  return {
    roleInstanceId,
    displayName,
    roleCategory,
    advisorTeamId,
    responsibleAdvisorRoleInstanceId,
    projectId,
    assignmentVerified: true,
    presentationPodId,
  };
}

function cue(
  cueId: string,
  kind: PixelCueInput['kind'],
  eventIndex: number,
  selectedPodId: string,
  roleInstanceId: string,
  workUnitId: string,
  sourceAnchorId: string,
  targetAnchorId: string,
  durationMs: number,
  missionSequence: number,
): PixelCueInput {
  return {
    cueId,
    kind,
    sourceEventId: eventId(eventIndex),
    origin: 'LIVE_DELTA',
    projectionRevision: 27,
    accepted: true,
    freshness: 'CURRENT',
    conflict: false,
    selectedPodId,
    roleInstanceId,
    workUnitId,
    sourceAnchorId,
    targetAnchorId,
    durationMs,
    missionSequence,
  };
}

function eventId(index: number): string {
  return `018f0000-0000-7000-8000-${index.toString().padStart(12, '0')}`;
}
