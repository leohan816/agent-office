import {
  clampPixelCamera,
  focusPodCamera,
  fullOfficeCamera,
} from './camera.js';
import type {
  ChannyAnimation,
  ChannyFrame,
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
import { PIXEL_WORLD_FRAME_SCHEMA_VERSION } from './contracts.js';
import {
  actorAnimationFrame,
  channyAnimationFrame,
  directionForRoute,
  eligiblePixelCues,
  interpolate,
  interpolateCamera,
  normalizePixelActorFactSet,
  requireAnchor,
  requirePod,
  requirePodLayout,
  smoothStep,
  structuredActorState,
} from './frame-core.js';
import {
  channyNaturalSequenceAt,
  segmentProgress,
  timelineSegmentAt,
  type PixelPrototypeTimelineSegment,
} from './fixtures/prototype-timeline.js';
import { findBoundedPixelRoute, samplePixelRoute } from './pathfinder.js';

// The fixture-free primitives now live in `frame-core.ts` (design §2.3); re-export to keep the
// prototype projector's public API byte-behaviour-equivalent.
export {
  assertFrameSemanticParity,
  normalizePixelActorFacts,
  reduceAcceptedPixelCues,
} from './frame-core.js';
export type { PixelActorFactSet } from './frame-core.js';
export { normalizePixelActorFactSet };

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
      // Prototype eyebrow derived from the prototype projection's own fixture label + the historical
      // AO12-PWU-11-P1 visual-patch suffix (prototype-only module; never a production edge).
      eyebrow: `${projection.fixtureLabel} / AO12-PWU-11-P1 VISUAL PATCH`,
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
    ...(actor.organizationFacts === undefined ? {} : { organizationFacts: actor.organizationFacts }),
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

function namedOrTimelineProgress(
  sceneId: string,
  timeline: PixelPrototypeTimelineSegment,
  logicalTimeMs: number,
): number {
  return sceneId === timeline.segmentId ? segmentProgress(timeline, logicalTimeMs) : 0.55;
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
