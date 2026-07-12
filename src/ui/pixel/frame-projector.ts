import {
  clampPixelCamera,
  focusPodCamera,
  fullOfficeCamera,
} from './camera.js';
import type {
  ChannyAnimation,
  ChannyFrame,
  PixelActorFactInput,
  PixelActorFactSource,
  PixelActorFacts,
  PixelActorFactsInput,
  PixelActorFactSources,
  PixelActorFrame,
  PixelActorInput,
  PixelCameraState,
  PixelCueInput,
  PixelCueKind,
  PixelOperationalState,
  PixelPoint,
  PixelPodInput,
  PixelPrototypeProjection,
  PixelPrototypeViewOptions,
  PixelRouteFrame,
  PixelWorldFrameV1,
  PixelWorldLayout,
} from './contracts.js';
import { PIXEL_ACTOR_UNKNOWN, PIXEL_WORLD_FRAME_SCHEMA_VERSION } from './contracts.js';
import {
  channyNaturalSequenceAt,
  segmentProgress,
  timelineSegmentAt,
  type PixelPrototypeTimelineSegment,
} from './fixtures/prototype-timeline.js';
import { findBoundedPixelRoute, samplePixelRoute } from './pathfinder.js';

const CUE_PRECEDENCE: Readonly<Record<PixelCueKind, number>> = {
  BLOCKED: 100,
  WAITING_LEO: 90,
  RECOVERY: 80,
  PATCH_RETURN: 75,
  REVIEW_VERDICT_RETURN: 70,
  REVIEW: 65,
  REVIEW_HANDOFF: 60,
  RESULT_RETURN: 55,
  WRITING_RESULT: 50,
  TESTING: 45,
  WORKING: 40,
  READING: 35,
  DELIVERY: 30,
  LEO_GPT_TO_ADVISOR_HANDOFF: 25,
  COMPLETION_ACKNOWLEDGEMENT: 20,
  IDLE_RELOCATE: 10,
};

export function projectPixelWorldFrame(
  projection: PixelPrototypeProjection,
  layout: PixelWorldLayout,
  options: PixelPrototypeViewOptions,
): PixelWorldFrameV1 {
  validateProjection(projection);
  const logicalTimeMs = Math.max(0, Math.min(26_000, options.logicalTimeMs));
  const timeline = timelineSegmentAt(logicalTimeMs);
  const sceneId = options.scenarioId ?? timeline.segmentId;
  const selectedPodId = scenarioSelectedPod(sceneId) ?? options.selectedPodId;
  const selectedPod = requirePod(projection, selectedPodId);
  const acceptedCues = eligiblePixelCues(projection, selectedPodId, new Set());
  const activeCue = cueForScene(acceptedCues, sceneId);
  const route = createRouteFrame(layout, activeCue, sceneId, timeline, logicalTimeMs);
  const camera = options.cameraOverride
    ?? sceneCamera(layout, selectedPod, sceneId, timeline, logicalTimeMs, options);
  const actorFrames = projection.actors.map((actor) => projectActorFrame(
    actor,
    projection,
    layout,
    sceneId,
    logicalTimeMs,
    route,
  ));
  const channy = projectChannyFrame(layout, sceneId, timeline, logicalTimeMs);
  const operationalState = sceneOperationalState(sceneId, selectedPod.operationalState);
  const blockerSummary = sceneId === 'blocked'
    ? 'AO12 synthetic media evidence gate is blocked'
    : sceneId === 'waiting-leo'
      ? 'WAITING_LEO: visual direction decision required'
      : selectedPod.blockerSummary;
  const facilityEntities = [
    ['facility.glass-room', 'Glass meeting room'],
    ['facility.advisor-hub', 'Advisor Hub'],
    ['facility.reviewer-booth', 'Independent Reviewer booth'],
    ['facility.coffee-lounge', 'Coffee lounge'],
    ['facility.channy-bed', 'Channy bed'],
    ['facility.channy-food', 'Channy food bowl'],
    ['facility.channy-water', 'Channy water bowl'],
    ['facility.decision', 'Leo/GPT decision destination'],
  ] as const;
  const semanticEntities = [
    ...projection.pods.map((pod) => ({
      entityId: pod.podId,
      kind: 'POD' as const,
      label: `${pod.advisorTeamId} / ${pod.projectIdentity.displayName}`,
      state: pod.podId === selectedPodId ? operationalState : pod.operationalState,
    })),
    ...actorFrames.map((actor) => ({
      entityId: actor.roleInstanceId,
      kind: 'ACTOR' as const,
      label: actor.displayName,
      state: `${actor.operationalState} / ${actor.animation}`,
    })),
    {
      entityId: channy.entityId,
      kind: 'CHANNY' as const,
      label: 'Channy, non-actor ambient companion',
      state: channy.animation,
    },
    ...facilityEntities.map(([entityId, label]) => ({
      entityId,
      kind: 'FACILITY' as const,
      label,
      state: 'VISIBLE',
    })),
  ];
  const visibleEntityIds = semanticEntities.map((entity) => entity.entityId).sort();
  const timeKey = Math.round(logicalTimeMs);
  return {
    schemaVersion: PIXEL_WORLD_FRAME_SCHEMA_VERSION,
    frameKey: `pixel-frame:${projection.projectionRevision}:${sceneId}:${selectedPodId}:${timeKey}:${options.presentationTier}`,
    projectionRevision: projection.projectionRevision,
    logicalTimeMs,
    sceneId,
    selectedPodId,
    presentationTier: options.presentationTier,
    camera,
    actorFrames,
    channy,
    route,
    acceptedCueIds: activeCue === null ? [] : [activeCue.cueId],
    visibleEntityIds,
    semanticEntities,
    hud: {
      selectedTeamName: selectedPod.advisorTeamId,
      projectName: selectedPod.projectIdentity.displayName,
      missionShortLabel: selectedPod.missionShortLabel,
      currentWorkUnitShortId: selectedPod.currentWorkUnitShortId,
      currentActorRoleInstanceId: selectedPod.currentActorRoleInstanceId,
      operationalState,
      workUnitProgress: `${selectedPod.completedWorkUnits}/${selectedPod.totalWorkUnits}`,
      requiredGateProgress: `${selectedPod.completedGates}/${selectedPod.totalGates}`,
      blockerSummary,
      statusLine: statusLine(sceneId, timeline),
    },
  };
}

export function reduceAcceptedPixelCues(
  projection: PixelPrototypeProjection,
  selectedPodId: string,
  seenCueIds: ReadonlySet<string> = new Set(),
): readonly PixelCueInput[] {
  const bySourceEvent = new Map<string, PixelCueInput>();
  for (const cue of eligiblePixelCues(projection, selectedPodId, seenCueIds)) {
    const current = bySourceEvent.get(cue.sourceEventId);
    if (current === undefined || compareCues(cue, current) < 0) {
      bySourceEvent.set(cue.sourceEventId, cue);
    }
  }
  const actorIds = new Set<string>();
  return [...bySourceEvent.values()]
    .sort(compareCues)
    .filter((cue) => {
      if (actorIds.has(cue.roleInstanceId)) return false;
      actorIds.add(cue.roleInstanceId);
      return true;
    })
    .slice(0, 3);
}

function eligiblePixelCues(
  projection: PixelPrototypeProjection,
  selectedPodId: string,
  seenCueIds: ReadonlySet<string>,
): readonly PixelCueInput[] {
  return projection.cues.filter((cue) => cue.accepted
    && cue.origin === 'LIVE_DELTA'
    && cue.projectionRevision === projection.projectionRevision
    && cue.freshness === 'CURRENT'
    && !cue.conflict
    && cue.selectedPodId === selectedPodId
    && !seenCueIds.has(cue.cueId)
    && cue.durationMs >= 150
    && cue.durationMs <= 1200);
}

export function assertFrameSemanticParity(frame: PixelWorldFrameV1): boolean {
  const semanticIds = frame.semanticEntities.map((entity) => entity.entityId).sort();
  return semanticIds.length === frame.visibleEntityIds.length
    && semanticIds.every((entityId, index) => entityId === frame.visibleEntityIds[index]);
}

function projectActorFrame(
  actor: PixelActorInput,
  projection: PixelPrototypeProjection,
  layout: PixelWorldLayout,
  sceneId: string,
  logicalTimeMs: number,
  route: PixelRouteFrame | null,
): PixelActorFrame {
  const pod = requirePod(projection, actor.presentationPodId);
  const podLayout = requirePodLayout(layout, actor.presentationPodId);
  const actorIndex = pod.actorRoleInstanceIds.indexOf(actor.roleInstanceId);
  const defaultPoint = {
    x: podLayout.deskAnchor.x + (actorIndex % 3 - 1) * 22,
    y: podLayout.deskAnchor.y + Math.floor(Math.max(0, actorIndex) / 3) * 18,
  };
  let point = defaultPoint;
  let animation: PixelActorFrame['animation'] = 'IDLE';
  let operationalState: PixelOperationalState = actor.roleInstanceId === pod.currentActorRoleInstanceId
    ? pod.operationalState
    : structuredActorState(actor.facts.state);
  let carryingDocument = false;
  if (actor.roleCategory === 'ADVISOR_ROUTING') {
    const advisorHub = requireAnchor(layout, 'facility:advisor-hub');
    point = actor.roleInstanceId === 'advisor.vibenews.primary'
      ? { x: advisorHub.x + 42, y: advisorHub.y }
      : advisorHub;
  }
  if (actor.roleCategory === 'INDEPENDENT_REVIEW') {
    point = requireAnchor(layout, 'facility:reviewer-booth');
  }
  if (route?.roleInstanceId === actor.roleInstanceId) {
    point = samplePixelRoute(route.points, route.progress);
    animation = route.kind === 'DELIVERY' ? 'CARRY_DOCUMENT' : 'WALK';
    operationalState = route.kind === 'DELIVERY' ? 'ROUTING / DISPATCH' : operationalState;
    carryingDocument = route.kind === 'DELIVERY' || route.kind === 'WAITING_LEO';
  }
  if ((sceneId === 'foundation-active' || sceneId === 'worker-typing' || sceneId === 'mobile-foundation')
    && actor.roleInstanceId === 'worker.foundation.primary') {
    animation = 'TYPE';
    operationalState = 'WORKING';
    point = requirePodLayout(layout, 'pod:foundation').deskAnchor;
  }
  if ((sceneId === 'vibenews-active' || sceneId === 'identity-comparison')
    && actor.roleInstanceId === 'worker.vibenews.primary') {
    animation = 'TYPE';
    operationalState = 'WORKING';
    point = requirePodLayout(layout, 'pod:vibenews').deskAnchor;
  }
  if (sceneId === 'reviewer-active' && actor.roleInstanceId === 'reviewer.fable5.primary') {
    animation = 'REVIEW';
    operationalState = 'REVIEWING';
    point = requireAnchor(layout, 'facility:reviewer-booth');
  }
  if (sceneId === 'lounge-idle' && actor.roleInstanceId === 'worker.cosmile.primary') {
    animation = 'COFFEE';
    operationalState = 'IDLE';
    point = requireAnchor(layout, 'facility:lounge');
  }
  if (sceneId === 'waiting-leo' && actor.roleInstanceId === 'worker.agent-office.primary') {
    animation = 'WAITING_LEO';
    operationalState = 'WAITING_LEO';
  }
  if (sceneId === 'blocked' && actor.roleInstanceId === 'worker.agent-office.primary') {
    animation = 'BLOCKED';
    operationalState = 'BLOCKED';
  }
  const factSet = normalizePixelActorFactSet(actor.facts, operationalState);
  return {
    roleInstanceId: actor.roleInstanceId,
    displayName: actor.displayName,
    podId: actor.presentationPodId,
    projectId: actor.projectId,
    x: point.x,
    y: point.y,
    direction: route === null ? 'SOUTH' : directionForRoute(route),
    animation,
    animationFrame: actorAnimationFrame(animation, logicalTimeMs),
    operationalState,
    carryingDocument,
    visible: actor.assignmentVerified,
    facts: factSet.facts,
    factSources: factSet.sources,
  };
}

export interface PixelActorFactSet {
  readonly facts: PixelActorFacts;
  readonly sources: PixelActorFactSources;
}

export function normalizePixelActorFacts(
  input: PixelActorFactsInput,
  structuredState: PixelOperationalState | null = null,
): PixelActorFacts {
  return normalizePixelActorFactSet(input, structuredState).facts;
}

export function normalizePixelActorFactSet(
  input: PixelActorFactsInput,
  structuredState: PixelOperationalState | null = null,
): PixelActorFactSet {
  const role = normalizeActorFact(input.role);
  const project = normalizeActorFact(input.project);
  const advisorTeam = normalizeActorFact(input.advisorTeam);
  const reportsToAdvisor = normalizeActorFact(input.reportsToAdvisor);
  const sessionName = normalizeActorFact(input.sessionName);
  const model = normalizeActorFact(input.model);
  const state = structuredState === null
    ? normalizeActorFact(input.state)
    : structuredState === PIXEL_ACTOR_UNKNOWN
      ? unknownActorFact()
      : { value: structuredState, source: 'SYNTHETIC_FIXTURE' as const };
  const mission = normalizeActorFact(input.mission);
  const workUnit = normalizeActorFact(input.workUnit);
  const evidenceFreshness = normalizeActorFact(input.evidenceFreshness);
  return {
    facts: {
      role: role.value,
      project: project.value,
      advisorTeam: advisorTeam.value,
      reportsToAdvisor: reportsToAdvisor.value,
      sessionName: sessionName.value,
      model: model.value,
      state: state.value,
      mission: mission.value,
      workUnit: workUnit.value,
      evidenceFreshness: evidenceFreshness.value,
    },
    sources: {
      role: role.source,
      project: project.source,
      advisorTeam: advisorTeam.source,
      reportsToAdvisor: reportsToAdvisor.source,
      sessionName: sessionName.source,
      model: model.source,
      state: state.source,
      mission: mission.source,
      workUnit: workUnit.source,
      evidenceFreshness: evidenceFreshness.source,
    },
  };
}

function projectChannyFrame(
  layout: PixelWorldLayout,
  sceneId: string,
  timeline: PixelPrototypeTimelineSegment,
  logicalTimeMs: number,
): ChannyFrame {
  const natural = channyNaturalSequenceAt(logicalTimeMs);
  let animation: ChannyAnimation = natural.segment.animation;
  let point: PixelPoint = interpolate(
    requireAnchor(layout, natural.segment.startAnchorId),
    requireAnchor(layout, natural.segment.endAnchorId),
    natural.easedProgress,
  );
  if (sceneId === 'channy-roam') {
    animation = 'WALK';
    const progress = namedOrTimelineProgress(sceneId, timeline, logicalTimeMs);
    point = interpolate(
      requireAnchor(layout, 'walkway:west'),
      requireAnchor(layout, 'walkway:east'),
      smoothStep(progress),
    );
  } else if (sceneId === 'channy-eat') {
    animation = 'EAT';
    point = requireAnchor(layout, 'facility:channy-food');
  } else if (sceneId === 'channy-drink') {
    animation = 'DRINK';
    point = requireAnchor(layout, 'facility:channy-water');
  } else if (sceneId === 'channy-sleep') {
    animation = 'SLEEP';
    point = requireAnchor(layout, 'facility:channy-bed');
  } else if (sceneId === 'waiting-leo') {
    animation = 'REACT_WAITING_LEO';
    point = requireAnchor(layout, 'facility:decision');
  } else if (sceneId === 'blocked') {
    animation = 'REACT_BLOCKED';
    point = requireAnchor(layout, 'facility:channy-bed');
  } else if (sceneId === 'detail-return') {
    animation = 'PLAY';
    point = requireAnchor(layout, 'facility:lounge');
  }
  return {
    entityId: 'channy.global',
    animation,
    animationFrame: channyAnimationFrame(animation, logicalTimeMs),
    direction: animation === 'SLEEP' ? 'WEST' : 'EAST',
    authorityRole: 'none',
    x: point.x,
    y: point.y,
  };
}

function createRouteFrame(
  layout: PixelWorldLayout,
  cue: PixelCueInput | null,
  sceneId: string,
  timeline: PixelPrototypeTimelineSegment,
  logicalTimeMs: number,
): PixelRouteFrame | null {
  const routedScenes = new Set(['worker-walk', 'advisor-handoff', 'lounge-idle', 'waiting-leo']);
  if (cue === null || !routedScenes.has(sceneId)) return null;
  const source = layout.anchors[cue.sourceAnchorId];
  const target = layout.anchors[cue.targetAnchorId];
  if (source === undefined || target === undefined) return null;
  const points = findBoundedPixelRoute(layout, source, target);
  if (points.length === 0) return null;
  return {
    routeId: `pixel-route:${cue.cueId}`,
    cueId: cue.cueId,
    kind: cue.kind,
    roleInstanceId: cue.roleInstanceId,
    sourceAnchorId: cue.sourceAnchorId,
    targetAnchorId: cue.targetAnchorId,
    points,
    progress: namedOrTimelineProgress(sceneId, timeline, logicalTimeMs),
    staticEquivalent: `${cue.sourceAnchorId} -> ${cue.targetAnchorId}; ${cue.kind}; no authority or completion claim`,
  };
}

function cueForScene(cues: readonly PixelCueInput[], sceneId: string): PixelCueInput | null {
  const desired: Readonly<Record<string, PixelCueKind | null>> = {
    'foundation-active': 'WORKING',
    'mobile-foundation': 'WORKING',
    'vibenews-active': 'WORKING',
    'worker-walk': 'IDLE_RELOCATE',
    'advisor-handoff': 'DELIVERY',
    'worker-typing': 'WORKING',
    'reviewer-active': 'REVIEW',
    'lounge-idle': 'IDLE_RELOCATE',
    'waiting-leo': 'WAITING_LEO',
    blocked: 'BLOCKED',
  };
  const desiredKind = desired[sceneId] ?? null;
  if (desiredKind === null) return null;
  return cues.find((cue) => cue.kind === desiredKind) ?? null;
}

function sceneCamera(
  layout: PixelWorldLayout,
  selectedPod: PixelPodInput,
  sceneId: string,
  timeline: PixelPrototypeTimelineSegment,
  logicalTimeMs: number,
  options: PixelPrototypeViewOptions,
): PixelCameraState {
  const full = fullOfficeCamera(
    layout,
    options.viewportWidth,
    options.viewportHeight,
    selectedPod.podId,
  );
  const podLayout = requirePodLayout(layout, selectedPod.podId);
  const focused = focusPodCamera(
    layout,
    podLayout,
    selectedPod.podId,
    options.viewportWidth,
    options.viewportHeight,
  );
  if (sceneId === 'full-office' || sceneId === 'reduced-static') return full;
  if (sceneId === 'camera-foundation') {
    const progress = smoothStep(segmentProgress(timeline, logicalTimeMs));
    return interpolateCamera(full, focused, progress, 'SCRIPTED');
  }
  if (sceneId === 'detail-open' || sceneId === 'detail-return') {
    const progress = smoothStep(segmentProgress(timeline, logicalTimeMs));
    return interpolateCamera(focused, full, progress, 'SCRIPTED');
  }
  if (sceneId.startsWith('channy-') || sceneId === 'lounge-idle') {
    const target = sceneId === 'channy-roam'
      ? interpolate(
        requireAnchor(layout, 'walkway:west'),
        requireAnchor(layout, 'walkway:east'),
        smoothStep(0.55),
      )
      : sceneId === 'channy-eat'
      ? requireAnchor(layout, 'facility:channy-food')
      : sceneId === 'channy-drink'
        ? requireAnchor(layout, 'facility:channy-water')
      : sceneId === 'channy-sleep'
        ? requireAnchor(layout, 'facility:channy-bed')
        : requireAnchor(layout, 'facility:lounge');
    return clampPixelCamera(layout, {
      centerX: target.x,
      centerY: target.y,
      zoom: sceneId.startsWith('channy-') ? 3 : options.viewportWidth < 768 ? 1 : 1.5,
      mode: 'SCRIPTED',
      selectedPodId: selectedPod.podId,
    }, options.viewportWidth, options.viewportHeight);
  }
  return { ...focused, mode: 'SCRIPTED' };
}

function scenarioSelectedPod(sceneId: string): string | null {
  if (sceneId === 'vibenews-active') return 'pod:vibenews';
  if (sceneId === 'lounge-idle') return 'pod:cosmile';
  if (sceneId === 'foundation-active'
    || sceneId === 'mobile-foundation'
    || sceneId === 'worker-walk'
    || sceneId === 'worker-typing') return 'pod:foundation';
  if (sceneId === 'advisor-handoff'
    || sceneId === 'reviewer-active'
    || sceneId === 'waiting-leo'
    || sceneId === 'blocked'
    || sceneId === 'detail-return') return 'pod:agent-office';
  return null;
}

function sceneOperationalState(
  sceneId: string,
  defaultState: PixelOperationalState,
): PixelOperationalState {
  if (sceneId === 'advisor-handoff' || sceneId === 'worker-walk') return 'ROUTING / DISPATCH';
  if (sceneId === 'foundation-active' || sceneId === 'vibenews-active' || sceneId === 'worker-typing' || sceneId === 'mobile-foundation') return 'WORKING';
  if (sceneId === 'reviewer-active') return 'REVIEWING';
  if (sceneId === 'lounge-idle') return 'IDLE';
  if (sceneId === 'waiting-leo') return 'WAITING_LEO';
  if (sceneId === 'blocked') return 'BLOCKED';
  return defaultState;
}

function statusLine(sceneId: string, timeline: PixelPrototypeTimelineSegment): string {
  const labels: Readonly<Record<string, string>> = {
    'foundation-active': 'Accepted synthetic WORKING cue; bounded typing does not change progress',
    'vibenews-active': 'VibeNews identity remains distinct while every Pod stays on the floor',
    'advisor-handoff': 'One Advisor and one document follow one accepted synthetic route',
    'reviewer-active': 'Independent review presentation; no verdict or approval claim',
    'lounge-idle': 'VERIFIED_IDLE presentation; no availability or collaboration implication',
    'channy-roam': 'Slow eased Bedlington walk with long neutral pauses; authorityRole none',
    'channy-eat': 'Neutral Bedlington eat cycle; no mission implication',
    'channy-drink': 'Neutral Bedlington drink cycle; no mission implication',
    'channy-sleep': 'Neutral Bedlington sleep cycle; no system-idle implication',
    'waiting-leo': 'Persistent decision request; no decision claim',
    blocked: 'Immediate blocker presentation; task and ambient routes suppressed',
    'mobile-foundation': 'Focused mobile Pod with complete semantic navigation',
    'reduced-static': 'DOM static equivalent; zero ticker and no replay',
  };
  return labels[sceneId] ?? timeline.label;
}

function actorAnimationFrame(animation: PixelActorFrame['animation'], logicalTimeMs: number): number {
  const counts: Readonly<Record<PixelActorFrame['animation'], readonly [number, number]>> = {
    IDLE: [4, 250], WALK: [6, 100], SIT: [2, 400], TYPE: [4, 120], REVIEW: [4, 160],
    CARRY_DOCUMENT: [6, 100], RETURN_RESULT: [6, 100], COFFEE: [4, 300], REST: [2, 500],
    LOUNGE: [4, 300], WAITING_LEO: [1, 1000], BLOCKED: [1, 1000],
  };
  const [count, duration] = counts[animation];
  return Math.floor(logicalTimeMs / duration) % count;
}

function channyAnimationFrame(animation: ChannyAnimation, logicalTimeMs: number): number {
  const counts: Readonly<Record<ChannyAnimation, readonly [number, number]>> = {
    WALK: [6, 240], STOP: [1, 1300], SNIFF: [3, 450], ROAM: [6, 240],
    SIT: [3, 500], EAT: [4, 320], DRINK: [4, 320], SLEEP: [4, 650],
    PLAY: [6, 280], REACT_WAITING_LEO: [3, 350], REACT_BLOCKED: [3, 350],
    REACT_COMPLETE: [4, 200], REACT_STALE_OFFLINE: [1, 1000],
  };
  const [count, duration] = counts[animation];
  return Math.floor(logicalTimeMs / duration) % count;
}

function directionForRoute(route: PixelRouteFrame): PixelActorFrame['direction'] {
  const from = route.points[Math.max(0, Math.min(route.points.length - 1, Math.floor(route.progress * route.points.length)))]
    ?? route.points[0];
  const to = route.points[Math.max(0, Math.min(route.points.length - 1, Math.ceil(route.progress * route.points.length)))]
    ?? from;
  if (from === undefined || to === undefined) return 'SOUTH';
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  if (Math.abs(deltaX) > Math.abs(deltaY)) return deltaX >= 0 ? 'EAST' : 'WEST';
  return deltaY >= 0 ? 'SOUTH' : 'NORTH';
}

function namedOrTimelineProgress(
  sceneId: string,
  timeline: PixelPrototypeTimelineSegment,
  logicalTimeMs: number,
): number {
  return sceneId === timeline.segmentId ? segmentProgress(timeline, logicalTimeMs) : 0.55;
}

function interpolate(from: PixelPoint, to: PixelPoint, progress: number): PixelPoint {
  return {
    x: Math.round(from.x + (to.x - from.x) * progress),
    y: Math.round(from.y + (to.y - from.y) * progress),
  };
}

function normalizeActorFact(
  input: PixelActorFactInput | null | undefined,
): { readonly value: string; readonly source: PixelActorFactSource } {
  if (typeof input !== 'object' || input === null || input.source === 'UNVERIFIED') {
    return unknownActorFact();
  }
  const normalized = input.value?.trim() ?? '';
  return normalized.length === 0
    ? unknownActorFact()
    : { value: normalized, source: input.source };
}

function unknownActorFact(): { readonly value: typeof PIXEL_ACTOR_UNKNOWN; readonly source: 'UNVERIFIED' } {
  return { value: PIXEL_ACTOR_UNKNOWN, source: 'UNVERIFIED' };
}

function structuredActorState(input: PixelActorFactInput | null | undefined): PixelOperationalState {
  const states: readonly PixelOperationalState[] = [
    'UNKNOWN', 'IDLE', 'WORKING', 'TESTING', 'ROUTING / DISPATCH', 'REVIEWING',
    'RETURNING_RESULT', 'NEEDS_PATCH', 'WAITING_DEPENDENCY', 'WAITING_LEO',
    'BLOCKED', 'COMPLETED', 'FAILED', 'CANCELLED',
  ];
  const fact = normalizeActorFact(input);
  return fact.source === 'SYNTHETIC_FIXTURE' && states.includes(fact.value as PixelOperationalState)
    ? fact.value as PixelOperationalState
    : 'UNKNOWN';
}

function smoothStep(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}

function interpolateCamera(
  from: PixelCameraState,
  to: PixelCameraState,
  progress: number,
  mode: PixelCameraState['mode'],
): PixelCameraState {
  return {
    centerX: Math.round(from.centerX + (to.centerX - from.centerX) * progress),
    centerY: Math.round(from.centerY + (to.centerY - from.centerY) * progress),
    zoom: Math.round((from.zoom + (to.zoom - from.zoom) * progress) * 1000) / 1000,
    mode,
    selectedPodId: to.selectedPodId,
  };
}

function compareCues(left: PixelCueInput, right: PixelCueInput): number {
  return CUE_PRECEDENCE[right.kind] - CUE_PRECEDENCE[left.kind]
    || right.missionSequence - left.missionSequence
    || left.cueId.localeCompare(right.cueId, 'en');
}

function validateProjection(projection: PixelPrototypeProjection): void {
  const schemaVersion: unknown = projection.schemaVersion;
  if (schemaVersion !== 'agent-office.pixel-prototype-projection.v1') {
    throw new TypeError('unsupported pixel prototype projection');
  }
  const actorIds = projection.actors.map((actor) => actor.roleInstanceId);
  if (actorIds.length !== new Set(actorIds).size) throw new TypeError('pixel actor clone detected');
  const advisorIds = projection.actors
    .filter((actor) => actor.roleCategory === 'ADVISOR_ROUTING')
    .map((actor) => actor.roleInstanceId);
  if (advisorIds.length !== new Set(advisorIds).size) throw new TypeError('pixel Advisor clone detected');
}

function requirePod(projection: PixelPrototypeProjection, podId: string): PixelPodInput {
  const pod = projection.pods.find((candidate) => candidate.podId === podId);
  if (pod === undefined) throw new TypeError(`pixel Pod missing: ${podId}`);
  return pod;
}

function requirePodLayout(layout: PixelWorldLayout, podId: string) {
  const pod = layout.pods.find((candidate) => candidate.podId === podId);
  if (pod === undefined) throw new TypeError(`pixel Pod layout missing: ${podId}`);
  return pod;
}

function requireAnchor(layout: PixelWorldLayout, anchorId: string) {
  const anchor = layout.anchors[anchorId];
  if (anchor === undefined) throw new TypeError(`pixel world anchor missing: ${anchorId}`);
  return anchor;
}
