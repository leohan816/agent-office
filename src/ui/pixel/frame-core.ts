// Agent Office Batch A — fixture-free shared frame primitives (design delta §2.3).
//
// These timeline-independent primitives are extracted from `frame-projector.ts` so both the prototype
// projector (which re-imports them) and the fixture-free `production-frame-projector.ts` share ONE
// implementation (anti-split-brain by extraction, not duplication). This module imports NO fixture.
import type {
  ChannyAnimation,
  PixelActorFactInput,
  PixelActorFacts,
  PixelActorFactSource,
  PixelActorFactSources,
  PixelActorFactsInput,
  PixelActorFrame,
  PixelCameraState,
  PixelCueInput,
  PixelCueKind,
  PixelOperationalState,
  PixelPodInput,
  PixelPoint,
  PixelPrototypeProjection,
  PixelRouteFrame,
  PixelWorldFrameV1,
  PixelWorldLayout,
} from './contracts.js';
import { PIXEL_ACTOR_UNKNOWN } from './contracts.js';

export const CUE_PRECEDENCE: Readonly<Record<PixelCueKind, number>> = {
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

export interface PixelActorFactSet {
  readonly facts: PixelActorFacts;
  readonly sources: PixelActorFactSources;
}

export function normalizeActorFact(
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

export function unknownActorFact(): { readonly value: typeof PIXEL_ACTOR_UNKNOWN; readonly source: 'UNVERIFIED' } {
  return { value: PIXEL_ACTOR_UNKNOWN, source: 'UNVERIFIED' };
}

export function structuredActorState(input: PixelActorFactInput | null | undefined): PixelOperationalState {
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

export function eligiblePixelCues(
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

export function compareCues(left: PixelCueInput, right: PixelCueInput): number {
  return CUE_PRECEDENCE[right.kind] - CUE_PRECEDENCE[left.kind]
    || right.missionSequence - left.missionSequence
    || left.cueId.localeCompare(right.cueId, 'en');
}

export function assertFrameSemanticParity(frame: PixelWorldFrameV1): boolean {
  const semanticIds = frame.semanticEntities.map((entity) => entity.entityId).sort();
  return semanticIds.length === frame.visibleEntityIds.length
    && semanticIds.every((entityId, index) => entityId === frame.visibleEntityIds[index]);
}

export function interpolate(from: PixelPoint, to: PixelPoint, progress: number): PixelPoint {
  return {
    x: Math.round(from.x + (to.x - from.x) * progress),
    y: Math.round(from.y + (to.y - from.y) * progress),
  };
}

export function smoothStep(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}

export function interpolateCamera(
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

export function actorAnimationFrame(animation: PixelActorFrame['animation'], logicalTimeMs: number): number {
  const counts: Readonly<Record<PixelActorFrame['animation'], readonly [number, number]>> = {
    IDLE: [4, 250], WALK: [6, 100], SIT: [2, 400], TYPE: [4, 120], REVIEW: [4, 160],
    CARRY_DOCUMENT: [6, 100], RETURN_RESULT: [6, 100], COFFEE: [4, 300], REST: [2, 500],
    LOUNGE: [4, 300], WAITING_LEO: [1, 1000], BLOCKED: [1, 1000],
  };
  const [count, duration] = counts[animation];
  return Math.floor(logicalTimeMs / duration) % count;
}

export function channyAnimationFrame(animation: ChannyAnimation, logicalTimeMs: number): number {
  const counts: Readonly<Record<ChannyAnimation, readonly [number, number]>> = {
    WALK: [6, 240], STOP: [1, 1300], SNIFF: [3, 450], ROAM: [6, 240],
    SIT: [3, 500], EAT: [4, 320], DRINK: [4, 320], SLEEP: [4, 650],
    PLAY: [6, 280], REACT_WAITING_LEO: [3, 350], REACT_BLOCKED: [3, 350],
    REACT_COMPLETE: [4, 200], REACT_STALE_OFFLINE: [1, 1000],
  };
  const [count, duration] = counts[animation];
  return Math.floor(logicalTimeMs / duration) % count;
}

export function directionForRoute(route: PixelRouteFrame): PixelActorFrame['direction'] {
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

export function requirePod(projection: PixelPrototypeProjection, podId: string): PixelPodInput {
  const pod = projection.pods.find((candidate) => candidate.podId === podId);
  if (pod === undefined) throw new TypeError(`pixel Pod missing: ${podId}`);
  return pod;
}

export function requirePodLayout(layout: PixelWorldLayout, podId: string) {
  const pod = layout.pods.find((candidate) => candidate.podId === podId);
  if (pod === undefined) throw new TypeError(`pixel Pod layout missing: ${podId}`);
  return pod;
}

export function requireAnchor(layout: PixelWorldLayout, anchorId: string) {
  const anchor = layout.anchors[anchorId];
  if (anchor === undefined) throw new TypeError(`pixel world anchor missing: ${anchorId}`);
  return anchor;
}
