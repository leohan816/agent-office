import type { OrganizationFrameActor } from '../../application/organization/index.js';

export const PIXEL_WORLD_FRAME_SCHEMA_VERSION = 'agent-office.pixel-world-frame.v1' as const;
export const PIXEL_ATLAS_SCHEMA_VERSION = 'agent-office.pixel-atlas.v1' as const;
export const PIXEL_PROTOTYPE_FIXTURE_ID = 'agent-office.living-pixel-prototype.synthetic.v1' as const;
export const PIXEL_ACTOR_UNKNOWN = 'UNKNOWN' as const;

export type PixelActorFactSource =
  | 'VERIFIED_REGISTRY'
  | 'VERIFIED_MISSION_ARTIFACT'
  | 'CANONICAL_FIXTURE'
  | 'SYNTHETIC_FIXTURE'
  | 'UNVERIFIED';

export const PIXEL_ACTOR_FACT_SOURCE_LABELS: Readonly<Record<PixelActorFactSource, string>> = {
  VERIFIED_REGISTRY: 'VERIFIED REGISTRY',
  VERIFIED_MISSION_ARTIFACT: 'VERIFIED MISSION ARTIFACT',
  CANONICAL_FIXTURE: 'CANONICAL FIXTURE',
  SYNTHETIC_FIXTURE: 'SYNTHETIC FIXTURE - NOT LIVE OPERATIONS',
  UNVERIFIED: 'UNVERIFIED',
};

export type PixelPresentationTier = 'PIXEL_FULL' | 'PIXEL_RESTRAINED' | 'DOM_STATIC';
export type PixelRendererBackend = 'WEBGL' | 'CANVAS' | 'DOM_STATIC';
export type PixelDirection = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';
export type PixelOperationalState =
  | 'UNKNOWN'
  | 'IDLE'
  | 'WORKING'
  | 'TESTING'
  | 'ROUTING / DISPATCH'
  | 'REVIEWING'
  | 'RETURNING_RESULT'
  | 'NEEDS_PATCH'
  | 'WAITING_DEPENDENCY'
  | 'WAITING_LEO'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type PixelCueKind =
  | 'LEO_GPT_TO_ADVISOR_HANDOFF'
  | 'DELIVERY'
  | 'READING'
  | 'WORKING'
  | 'TESTING'
  | 'WRITING_RESULT'
  | 'REVIEW_HANDOFF'
  | 'REVIEW'
  | 'REVIEW_VERDICT_RETURN'
  | 'BLOCKED'
  | 'WAITING_LEO'
  | 'RESULT_RETURN'
  | 'PATCH_RETURN'
  | 'COMPLETION_ACKNOWLEDGEMENT'
  | 'RECOVERY'
  | 'IDLE_RELOCATE';

export type PixelActorAnimation =
  | 'IDLE'
  | 'WALK'
  | 'SIT'
  | 'TYPE'
  | 'REVIEW'
  | 'CARRY_DOCUMENT'
  | 'RETURN_RESULT'
  | 'COFFEE'
  | 'REST'
  | 'LOUNGE'
  | 'WAITING_LEO'
  | 'BLOCKED';

export type ChannyAnimation =
  | 'WALK'
  | 'STOP'
  | 'SNIFF'
  | 'ROAM'
  | 'SIT'
  | 'EAT'
  | 'DRINK'
  | 'SLEEP'
  | 'PLAY'
  | 'REACT_WAITING_LEO'
  | 'REACT_BLOCKED'
  | 'REACT_COMPLETE'
  | 'REACT_STALE_OFFLINE';

export interface PixelPoint {
  readonly x: number;
  readonly y: number;
}

export interface PixelRect extends PixelPoint {
  readonly width: number;
  readonly height: number;
}

export interface PixelProjectIdentity {
  readonly identityId: string;
  readonly projectId: string;
  readonly displayName: string;
  readonly shortLabel: string;
  readonly primaryColor: number;
  readonly secondaryColor: number;
  readonly glyph: string;
  readonly pattern: 'DOTS' | 'BANDS' | 'CHECKS' | 'CHEVRON' | 'CROSS' | 'GRID';
}

export interface PixelPodInput {
  readonly podId: string;
  readonly advisorTeamId: string;
  readonly responsibleAdvisorRoleInstanceId: string;
  readonly projectIdentity: PixelProjectIdentity;
  readonly missionShortLabel: string;
  readonly currentWorkUnitShortId: string;
  readonly currentActorRoleInstanceId: string;
  readonly operationalState: PixelOperationalState;
  readonly completedWorkUnits: number;
  readonly totalWorkUnits: number;
  readonly completedGates: number;
  readonly totalGates: number;
  readonly blockerSummary: string | null;
  readonly actorRoleInstanceIds: readonly string[];
}

export interface PixelActorInput {
  readonly roleInstanceId: string;
  readonly displayName: string;
  readonly roleCategory:
    | 'LEO_DECISION'
    | 'ADVISOR_ROUTING'
    | 'CONTROL_RECOVERY'
    | 'INDEPENDENT_REVIEW'
    | 'WORKER_BUILD'
    | 'GENERIC_REGISTERED';
  readonly advisorTeamId: string;
  readonly responsibleAdvisorRoleInstanceId: string;
  readonly projectId: string;
  readonly assignmentVerified: boolean;
  readonly presentationPodId: string;
  readonly facts: PixelActorFactsInput;
  /**
   * Batch A additive: the joined organization fact envelopes (contract §2.5/§2.7) for the
   * authenticated Office surface. Absent on the synthetic prototype path (legacy labels only).
   */
  readonly organizationFacts?: OrganizationFrameActor;
}

export interface PixelActorFactInput {
  readonly value?: string | null;
  readonly source: PixelActorFactSource;
}

export interface PixelActorFactsInput {
  readonly role?: PixelActorFactInput | null;
  readonly project?: PixelActorFactInput | null;
  readonly advisorTeam?: PixelActorFactInput | null;
  readonly reportsToAdvisor?: PixelActorFactInput | null;
  readonly sessionName?: PixelActorFactInput | null;
  readonly model?: PixelActorFactInput | null;
  readonly state?: PixelActorFactInput | null;
  readonly mission?: PixelActorFactInput | null;
  readonly workUnit?: PixelActorFactInput | null;
  readonly evidenceFreshness?: PixelActorFactInput | null;
}

export interface PixelActorFacts {
  readonly role: string;
  readonly project: string;
  readonly advisorTeam: string;
  readonly reportsToAdvisor: string;
  readonly sessionName: string;
  readonly model: string;
  readonly state: string;
  readonly mission: string;
  readonly workUnit: string;
  readonly evidenceFreshness: string;
}

export type PixelActorFactSources = Readonly<Record<keyof PixelActorFacts, PixelActorFactSource>>;

export interface PixelCueInput {
  readonly cueId: string;
  readonly kind: PixelCueKind;
  readonly sourceEventId: string;
  readonly origin: 'INITIAL_SNAPSHOT' | 'LIVE_DELTA' | 'RESET' | 'RESUME';
  readonly projectionRevision: number;
  readonly accepted: boolean;
  readonly freshness: 'CURRENT' | 'STALE' | 'OFFLINE';
  readonly conflict: boolean;
  readonly selectedPodId: string;
  readonly roleInstanceId: string;
  readonly workUnitId: string;
  readonly sourceAnchorId: string;
  readonly targetAnchorId: string;
  readonly durationMs: number;
  readonly missionSequence: number;
}

export interface PixelPrototypeProjection {
  readonly schemaVersion: 'agent-office.pixel-prototype-projection.v1';
  readonly fixtureId: typeof PIXEL_PROTOTYPE_FIXTURE_ID;
  readonly fixtureLabel: 'SYNTHETIC PROTOTYPE';
  readonly projectionRevision: number;
  readonly evaluatedAt: string;
  readonly selectedPodId: string;
  readonly pods: readonly PixelPodInput[];
  readonly actors: readonly PixelActorInput[];
  readonly cues: readonly PixelCueInput[];
  readonly sourceEventIds: readonly string[];
}

export interface PixelWorldAnchor extends PixelPoint {
  readonly anchorId: string;
  readonly kind:
    | 'POD_DESK'
    | 'POD_BOARD'
    | 'ADVISOR_HUB'
    | 'REVIEWER_BOOTH'
    | 'LOUNGE'
    | 'CHANNY_BED'
    | 'CHANNY_FOOD'
    | 'CHANNY_WATER'
    | 'DECISION_DESTINATION'
    | 'WALKWAY';
}

export interface PixelPodLayout extends PixelRect {
  readonly podId: string;
  readonly projectId: string;
  readonly deskAnchor: PixelWorldAnchor;
  readonly boardAnchor: PixelWorldAnchor;
}

export interface PixelWorldLayout {
  readonly layoutVersion: 'agent-office.pixel-world-layout.v1';
  readonly tileSize: 16;
  readonly width: number;
  readonly height: number;
  readonly floorBounds: PixelRect;
  readonly facilityBand: PixelRect;
  readonly mainWalkway: PixelRect;
  readonly pods: readonly PixelPodLayout[];
  readonly anchors: Readonly<Record<string, PixelWorldAnchor>>;
  readonly blockedTiles: ReadonlySet<string>;
}

export interface PixelCameraState {
  readonly centerX: number;
  readonly centerY: number;
  readonly zoom: number;
  readonly mode: 'FULL_OFFICE' | 'FOCUSED_POD' | 'MANUAL' | 'SCRIPTED';
  readonly selectedPodId: string;
}

export interface PixelActorFrame extends PixelPoint {
  readonly roleInstanceId: string;
  readonly displayName: string;
  readonly podId: string;
  readonly projectId: string;
  readonly direction: PixelDirection;
  readonly animation: PixelActorAnimation;
  readonly animationFrame: number;
  readonly operationalState: PixelOperationalState;
  readonly carryingDocument: boolean;
  readonly visible: boolean;
  readonly facts: PixelActorFacts;
  readonly factSources: PixelActorFactSources;
  /** Batch A additive: joined organization fact envelopes for the authenticated Office surface. */
  readonly organizationFacts?: OrganizationFrameActor;
}

export interface ChannyFrame extends PixelPoint {
  readonly entityId: 'channy.global';
  readonly animation: ChannyAnimation;
  readonly animationFrame: number;
  readonly direction: PixelDirection;
  readonly authorityRole: 'none';
}

export interface PixelRouteFrame {
  readonly routeId: string;
  readonly cueId: string;
  readonly kind: PixelCueKind;
  readonly roleInstanceId: string;
  readonly sourceAnchorId: string;
  readonly targetAnchorId: string;
  readonly points: readonly PixelPoint[];
  readonly progress: number;
  readonly staticEquivalent: string;
}

export interface PixelSemanticEntity {
  readonly entityId: string;
  readonly kind: 'POD' | 'ACTOR' | 'CHANNY' | 'FACILITY';
  readonly label: string;
  readonly state: string;
}

export interface PixelWorldFrameV1 {
  readonly schemaVersion: typeof PIXEL_WORLD_FRAME_SCHEMA_VERSION;
  readonly frameKey: string;
  readonly projectionRevision: number;
  readonly logicalTimeMs: number;
  readonly sceneId: string;
  readonly selectedPodId: string;
  readonly presentationTier: PixelPresentationTier;
  readonly camera: PixelCameraState;
  readonly actorFrames: readonly PixelActorFrame[];
  readonly channy: ChannyFrame;
  readonly route: PixelRouteFrame | null;
  readonly acceptedCueIds: readonly string[];
  readonly visibleEntityIds: readonly string[];
  readonly semanticEntities: readonly PixelSemanticEntity[];
  readonly hud: {
    readonly selectedTeamName: string;
    readonly projectName: string;
    readonly missionShortLabel: string;
    readonly currentWorkUnitShortId: string;
    readonly currentActorRoleInstanceId: string;
    readonly operationalState: PixelOperationalState;
    readonly workUnitProgress: string;
    readonly requiredGateProgress: string;
    readonly blockerSummary: string | null;
    readonly statusLine: string;
  };
}

export interface PixelPrototypeViewOptions {
  readonly selectedPodId: string;
  readonly logicalTimeMs: number;
  readonly presentationTier: PixelPresentationTier;
  readonly scenarioId: string | null;
  readonly cameraOverride: PixelCameraState | null;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
}

// Narrow renderer ports keep the pure prototype contract independent from
// Pixi's current WebGPU declaration collision with the repository's TS 6 DOM
// library. Runtime imports remain the exact pinned official package bytes.
export interface PixelGraphicsPort {
  clear(): PixelGraphicsPort;
  rect(x: number, y: number, width: number, height: number): PixelGraphicsPort;
  roundRect(x: number, y: number, width: number, height: number, radius: number): PixelGraphicsPort;
  ellipse(x: number, y: number, radiusX: number, radiusY: number): PixelGraphicsPort;
  circle(x: number, y: number, radius: number): PixelGraphicsPort;
  moveTo(x: number, y: number): PixelGraphicsPort;
  lineTo(x: number, y: number): PixelGraphicsPort;
  fill(style: number | { readonly color: number; readonly alpha?: number }): PixelGraphicsPort;
  stroke(style: { readonly color: number; readonly width: number; readonly alpha?: number }): PixelGraphicsPort;
  cacheAsTexture?(options: boolean | { readonly resolution: number; readonly antialias: boolean }): void;
  updateCacheTexture?(): void;
}

export interface PixelContainerPort {
  readonly position: { set(x: number, y: number): void };
  readonly scale: { set(scale: number): void };
}

export interface PixelApplicationPort {
  readonly canvas: HTMLCanvasElement;
  readonly ticker: {
    maxFPS: number;
    minFPS: number;
    start(): void;
    stop(): void;
  };
  readonly renderer: { readonly constructor: { readonly name: string } };
}

export interface PixelRendererResourceSnapshot {
  readonly canvases: number;
  readonly tickers: number;
  readonly resizeObservers: number;
  readonly contextListeners: number;
  readonly visibilityListeners: number;
}

export class RendererResourceRegistry {
  private resources = {
    canvases: 0,
    tickers: 0,
    resizeObservers: 0,
    contextListeners: 0,
    visibilityListeners: 0,
  };

  acquire(resource: keyof PixelRendererResourceSnapshot): void {
    this.resources[resource] += 1;
  }

  release(resource: keyof PixelRendererResourceSnapshot): void {
    this.resources[resource] = Math.max(0, this.resources[resource] - 1);
  }

  snapshot(): PixelRendererResourceSnapshot {
    return { ...this.resources };
  }
}
