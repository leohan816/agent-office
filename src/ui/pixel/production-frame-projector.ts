// Agent Office Batch A — fixture-free production frame projector (design delta §2.3 PR-1/PR-2).
//
// Builds a PixelWorldFrameV1 from the twice-validated LivingOfficeProductionRenderInputV1. Imports
// only fixture-free primitives (frame-core, world-layout, camera) + the committed layout assembly;
// it imports NO `fixtures/prototype-*` and NO `frame-projector.ts` — the production render graph is
// isolated from the synthetic prototype (CD-3). Cues are empty and there is no scripted timeline:
// the office renders the current committed/RT state statically (ambient motion is frame-index only).
import { assembleOfficeLayout } from '../../application/organization/production-render-input.js';
import { fullOfficeCamera } from './camera.js';
import { PIXEL_WORLD_FRAME_SCHEMA_VERSION } from './contracts.js';
import type {
  ChannyFrame,
  LivingOfficeProductionRenderInputV1,
  PixelActorFrame,
  PixelPodInput,
  PixelPresentationTier,
  PixelSemanticEntity,
  PixelWorldFrameV1,
  PixelWorldLayout,
} from './contracts.js';
import {
  actorAnimationFrame,
  channyAnimationFrame,
  normalizePixelActorFactSet,
  requireAnchor,
  requirePodLayout,
} from './frame-core.js';
import { createPixelWorldLayout } from './world-layout.js';

export interface LivingOfficeFrameOptions {
  readonly presentationTier: PixelPresentationTier;
}

const FACILITY_ENTITIES = [
  ['facility.glass-room', 'Glass meeting room'],
  ['facility.advisor-hub', 'Advisor Hub'],
  ['facility.reviewer-booth', 'Independent Reviewer booth'],
  ['facility.coffee-lounge', 'Coffee lounge'],
  ['facility.channy-bed', 'Channy bed'],
  ['facility.channy-food', 'Channy food bowl'],
  ['facility.channy-water', 'Channy water bowl'],
  ['facility.decision', 'Leo/GPT decision destination'],
] as const;

/** Build the production Living Office frame from the composed, validated render input (§2.3). */
export function projectLivingOfficeFrame(
  input: LivingOfficeProductionRenderInputV1,
  options: LivingOfficeFrameOptions,
): PixelWorldFrameV1 {
  const assembly = assembleOfficeLayout(input.operational, input.committedLayout);
  const pods = assembly.pods;
  const layout = createPixelWorldLayout(pods);
  const selectedPodId = input.selection.selectedPodId;
  const selectedPod = pods.find((pod) => pod.podId === selectedPodId) ?? pods[0];
  if (selectedPod === undefined) throw new TypeError('living office frame requires at least one pod');
  const logicalTimeMs = input.logicalTimeMs;

  const actorFrames = assembly.actors.map((actor) => {
    const pod = pods.find((candidate) => candidate.podId === actor.presentationPodId) ?? selectedPod;
    return projectLivingOfficeActorFrame(actor, pod, layout, logicalTimeMs);
  });
  const channy = projectStaticChannyFrame(layout, logicalTimeMs);

  const semanticEntities: readonly PixelSemanticEntity[] = [
    ...pods.map((pod) => ({
      entityId: pod.podId,
      kind: 'POD' as const,
      label: `${pod.advisorTeamId} / ${pod.projectIdentity.displayName}`,
      state: pod.operationalState,
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
    ...FACILITY_ENTITIES.map(([entityId, label]) => ({
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
    frameKey: `living-office:${input.operational.projectionRevision}:${selectedPodId}:${timeKey}:${options.presentationTier}`,
    projectionRevision: input.operational.projectionRevision,
    logicalTimeMs,
    sceneId: 'living-office',
    selectedPodId,
    presentationTier: options.presentationTier,
    camera: fullOfficeCamera(layout, input.viewport.width, input.viewport.height, selectedPodId),
    actorFrames,
    channy,
    route: null,
    acceptedCueIds: [],
    visibleEntityIds,
    semanticEntities,
    hud: {
      selectedTeamName: selectedPod.advisorTeamId,
      projectName: selectedPod.projectIdentity.displayName,
      missionShortLabel: selectedPod.missionShortLabel,
      currentWorkUnitShortId: selectedPod.currentWorkUnitShortId,
      currentActorRoleInstanceId: selectedPod.currentActorRoleInstanceId,
      operationalState: selectedPod.operationalState,
      workUnitProgress: `${selectedPod.completedWorkUnits}/${selectedPod.totalWorkUnits}`,
      requiredGateProgress: `${selectedPod.completedGates}/${selectedPod.totalGates}`,
      blockerSummary: selectedPod.blockerSummary,
      statusLine: 'Committed local/static organization office; identity is registry-owned, work state is runtime-owned, no live activity is fabricated',
    },
  };
}

function projectLivingOfficeActorFrame(
  actor: ProductionActorInput,
  pod: PixelPodInput,
  layout: PixelWorldLayout,
  logicalTimeMs: number,
): PixelActorFrame {
  const podLayout = requirePodLayout(layout, actor.presentationPodId);
  const actorIndex = pod.actorRoleInstanceIds.indexOf(actor.roleInstanceId);
  const point = {
    x: podLayout.deskAnchor.x + (actorIndex % 3 - 1) * 22,
    y: podLayout.deskAnchor.y + Math.floor(Math.max(0, actorIndex) / 3) * 18,
  };
  const operationalState = actor.organizationFacts?.operationalState.value ?? 'UNKNOWN';
  const factSet = normalizePixelActorFactSet(actor.facts, operationalState);
  return {
    roleInstanceId: actor.roleInstanceId,
    displayName: actor.displayName,
    podId: actor.presentationPodId,
    projectId: actor.projectId,
    x: point.x,
    y: point.y,
    direction: 'SOUTH',
    animation: 'IDLE',
    animationFrame: actorAnimationFrame('IDLE', logicalTimeMs),
    operationalState,
    carryingDocument: false,
    visible: actor.assignmentVerified,
    facts: factSet.facts,
    factSources: factSet.sources,
    ...(actor.organizationFacts === undefined ? {} : { organizationFacts: actor.organizationFacts }),
  };
}

function projectStaticChannyFrame(layout: PixelWorldLayout, logicalTimeMs: number): ChannyFrame {
  const bed = requireAnchor(layout, 'facility:channy-bed');
  return {
    entityId: 'channy.global',
    animation: 'STOP',
    animationFrame: channyAnimationFrame('STOP', logicalTimeMs),
    direction: 'EAST',
    authorityRole: 'none',
    x: bed.x,
    y: bed.y,
  };
}

type ProductionActorInput = ReturnType<typeof assembleOfficeLayout>['actors'][number];
