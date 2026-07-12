import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from 'react';

import type { OrganizationFact, OrganizationFrameActor } from '../../application/organization/index.js';
import { cameraTransform } from './camera.js';
import { PIXEL_ACTOR_FACT_SOURCE_LABELS } from './contracts.js';
import type {
  PixelActorFactSource,
  PixelActorFrame,
  PixelPrototypeProjection,
  PixelWorldFrameV1,
} from './contracts.js';

const LABEL_WIDTH = 172;
const LABEL_HEIGHT = 78;
const VIEWPORT_PADDING = 8;

// Contract §2.7 compact summary subset (after role glyph+ring and stableDisplayName), in order.
const ORGANIZATION_COMPACT_FIELDS = [
  ['sessionProcess', 'Process'],
  ['aiIdentity', 'AI identity'],
  ['model', 'Model'],
  ['effort', 'Effort'],
  ['aiRuntimeState', 'Runtime'],
  ['operationalState', 'Work'],
] as const;

// Contract §2.7 complete ordered detail set (roleInstanceId is rendered first, then these 16).
const ORGANIZATION_DETAIL_FIELDS = [
  ['role', 'Role'],
  ['project', 'Project'],
  ['stableDisplayName', 'Display name'],
  ['advisorTeam', 'Advisor Team'],
  ['reportsToAdvisor', 'Reports-to Advisor'],
  ['assignedBy', 'Assigned by'],
  ['returnsResultTo', 'Returns result to'],
  ['sessionName', 'Session name'],
  ['sessionProcess', 'Session process'],
  ['aiIdentity', 'AI identity'],
  ['model', 'Model'],
  ['effort', 'Effort'],
  ['aiRuntimeState', 'AI runtime state'],
  ['operationalState', 'Operational state'],
  ['mission', 'Mission'],
  ['workUnit', 'WorkUnit'],
] as const;

type OrganizationFactKey =
  | (typeof ORGANIZATION_COMPACT_FIELDS)[number][0]
  | (typeof ORGANIZATION_DETAIL_FIELDS)[number][0];

function organizationFact(facts: OrganizationFrameActor, key: OrganizationFactKey): OrganizationFact {
  return facts[key];
}

export interface PixelActorLabelPlacement {
  readonly roleInstanceId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly inViewport: boolean;
}

export interface LivingOfficeActorOverlayHandle {
  updatePositions(frame: PixelWorldFrameV1): void;
}

export interface LivingOfficeActorOverlayProps {
  readonly frame: PixelWorldFrameV1;
  readonly projection: PixelPrototypeProjection;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
}

export const LivingOfficeActorOverlay = forwardRef<
  LivingOfficeActorOverlayHandle,
  LivingOfficeActorOverlayProps
>(function LivingOfficeActorOverlay({
  frame,
  projection,
  viewportWidth,
  viewportHeight,
}, forwardedRef) {
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const closeRef = useRef<HTMLButtonElement>(null);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const placements = useMemo(
    () => layoutPixelActorLabels(frame, viewportWidth, viewportHeight),
    [frame, viewportHeight, viewportWidth],
  );
  const placementByActorId = useMemo(
    () => new Map(placements.map((placement) => [placement.roleInstanceId, placement])),
    [placements],
  );
  const selectedActor = selectedActorId === null
    ? null
    : frame.actorFrames.find((actor) => actor.roleInstanceId === selectedActorId) ?? null;

  const applyPositions = useCallback((nextFrame: PixelWorldFrameV1) => {
    for (const placement of layoutPixelActorLabels(nextFrame, viewportWidth, viewportHeight)) {
      const button = buttonRefs.current.get(placement.roleInstanceId);
      if (button === undefined) continue;
      button.style.transform = `translate3d(${placement.x}px, ${placement.y}px, 0)`;
      button.hidden = !placement.inViewport;
      button.dataset.anchorX = String(placement.anchorX);
      button.dataset.anchorY = String(placement.anchorY);
    }
  }, [viewportHeight, viewportWidth]);

  useImperativeHandle(forwardedRef, () => ({ updatePositions: applyPositions }), [applyPositions]);
  useEffect(() => applyPositions(frame), [applyPositions, frame]);
  useEffect(() => {
    if (selectedActor !== null) closeRef.current?.focus();
  }, [selectedActor]);

  const close = () => {
    const invoker = selectedActorId === null ? null : buttonRefs.current.get(selectedActorId) ?? null;
    setSelectedActorId(null);
    invoker?.focus();
  };
  const onDrawerKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      closeRef.current?.focus();
    }
  };

  return (
    <>
      <div
        aria-label="Camera-tracked actor identity labels"
        className="living-office-actor-overlay"
        data-actor-label-count={frame.actorFrames.filter((actor) => actor.visible).length}
        data-presentation-tier={frame.presentationTier}
      >
        {frame.actorFrames.filter((actor) => actor.visible).map((actor) => {
          const placement = placementByActorId.get(actor.roleInstanceId);
          const pod = projection.pods.find((candidate) => candidate.podId === actor.podId);
          const accent = pod?.projectIdentity.primaryColor ?? 0x777a7d;
          const style = {
            '--actor-accent': `#${accent.toString(16).padStart(6, '0')}`,
            transform: `translate3d(${placement?.x ?? 0}px, ${placement?.y ?? 0}px, 0)`,
          } as CSSProperties;
          return (
            <button
              aria-label={actorLabelAccessibleName(actor)}
              className="living-office-actor-label"
              data-actor-label={actor.roleInstanceId}
              data-actor-state={labelRingState(actor)}
              data-anchor-x={placement?.anchorX}
              data-anchor-y={placement?.anchorY}
              hidden={placement?.inViewport === false}
              key={actor.roleInstanceId}
              onClick={() => setSelectedActorId(actor.roleInstanceId)}
              ref={(element) => {
                if (element === null) buttonRefs.current.delete(actor.roleInstanceId);
                else buttonRefs.current.set(actor.roleInstanceId, element);
              }}
              style={style}
              type="button"
            >
              <span aria-hidden="true" className="living-office-actor-label__glyph">
                {roleGlyph(actor)}
              </span>
              <span aria-hidden="true" className="living-office-actor-label__ring" data-state={labelRingState(actor)} />
              {actor.organizationFacts === undefined ? (
                <span className="living-office-actor-label__facts">
                  <strong>{actor.facts.role}</strong>
                  <span>{actor.facts.model}</span>
                  <span>{actor.facts.sessionName}</span>
                  <span>{actor.facts.state}</span>
                  <small>{actorLabelFactSource(actor.factSources.state)}</small>
                </span>
              ) : (
                <OrganizationCompactSummary facts={actor.organizationFacts} />
              )}
            </button>
          );
        })}
      </div>
      {selectedActor === null ? null : selectedActor.organizationFacts === undefined ? (
        <aside
          aria-labelledby="living-office-actor-detail-heading"
          aria-modal="true"
          className="living-office-actor-detail"
          data-actor-detail={selectedActor.roleInstanceId}
          onKeyDown={onDrawerKeyDown}
          role="dialog"
        >
          <div className="living-office-actor-detail__bar">
            <div>
              <p>Structured synthetic actor evidence</p>
              <h2 id="living-office-actor-detail-heading">{selectedActor.displayName}</h2>
            </div>
            <button onClick={close} ref={closeRef} type="button">Close actor detail</button>
          </div>
          <dl>
            <ActorFact label="Role" source={selectedActor.factSources.role} value={selectedActor.facts.role} />
            <ActorFact label="Project" source={selectedActor.factSources.project} value={selectedActor.facts.project} />
            <ActorFact label="Advisor Team" source={selectedActor.factSources.advisorTeam} value={selectedActor.facts.advisorTeam} />
            <ActorFact label="Reports-to Advisor" source={selectedActor.factSources.reportsToAdvisor} value={selectedActor.facts.reportsToAdvisor} />
            <ActorFact label="Session name" source={selectedActor.factSources.sessionName} value={selectedActor.facts.sessionName} />
            <ActorFact label="Model" source={selectedActor.factSources.model} value={selectedActor.facts.model} />
            <ActorFact label="State" source={selectedActor.factSources.state} value={selectedActor.facts.state} />
            <ActorFact label="Mission" source={selectedActor.factSources.mission} value={selectedActor.facts.mission} />
            <ActorFact label="WorkUnit" source={selectedActor.factSources.workUnit} value={selectedActor.facts.workUnit} />
            <ActorFact label="Evidence freshness" source={selectedActor.factSources.evidenceFreshness} value={selectedActor.facts.evidenceFreshness} />
          </dl>
          <p className="living-office-actor-detail__boundary">
            Explicit synthetic fixture facts only. Pixel position and proximity create no authority,
            assignment, delivery, evidence, review, decision, approval, or completion meaning.
          </p>
        </aside>
      ) : (
        <OrganizationActorDetail
          closeRef={closeRef}
          facts={selectedActor.organizationFacts}
          onClose={close}
          onKeyDown={onDrawerKeyDown}
        />
      )}
    </>
  );
});

function OrganizationCompactSummary({ facts }: { readonly facts: OrganizationFrameActor }) {
  return (
    <span className="living-office-actor-label__facts" data-actor-summary={facts.roleInstanceId}>
      <strong data-actor-summary-field="role">{facts.role.value}</strong>
      <span data-actor-summary-field="stableDisplayName">{facts.stableDisplayName.value}</span>
      {ORGANIZATION_COMPACT_FIELDS.map(([key, label]) => {
        const fact = organizationFact(facts, key);
        return (
          <span data-actor-summary-field={key} data-actor-fact-source={fact.source} key={key}>
            <span className="living-office-actor-label__field">{label}: {fact.value}</span>
            <small>{PIXEL_ACTOR_FACT_SOURCE_LABELS[fact.source]}</small>
          </span>
        );
      })}
    </span>
  );
}

function OrganizationActorDetail({
  facts,
  closeRef,
  onClose,
  onKeyDown,
}: {
  readonly facts: OrganizationFrameActor;
  readonly closeRef: RefObject<HTMLButtonElement | null>;
  readonly onClose: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}) {
  return (
    <aside
      aria-labelledby="living-office-actor-detail-heading"
      aria-modal="true"
      className="living-office-actor-detail"
      data-actor-detail={facts.roleInstanceId}
      data-actor-can-receive-work={facts.canReceiveWork}
      onKeyDown={onKeyDown}
      role="dialog"
    >
      <div className="living-office-actor-detail__bar">
        <div>
          <p>Committed organization evidence — every field carries source and status</p>
          <h2 id="living-office-actor-detail-heading">{facts.stableDisplayName.value}</h2>
        </div>
        <button onClick={onClose} ref={closeRef} type="button">Close actor detail</button>
      </div>
      <dl>
        <div data-actor-fact="Role instance" data-actor-fact-source={facts.role.source} data-actor-fact-status="VERIFIED">
          <dt>Role instance</dt>
          <dd>
            {facts.roleInstanceId}
            <small>{PIXEL_ACTOR_FACT_SOURCE_LABELS[facts.role.source]}</small>
            <small data-actor-fact-status-note="VERIFIED">VERIFIED</small>
          </dd>
        </div>
        {ORGANIZATION_DETAIL_FIELDS.map(([key, label]) => {
          const fact = organizationFact(facts, key);
          return <OrganizationFactRow fact={fact} key={key} label={label} />;
        })}
      </dl>
      <p className="living-office-actor-detail__boundary">
        Committed local/static organization evidence only. Pixel position and proximity create no
        authority, assignment, delivery, evidence, review, decision, approval, or completion meaning.
        {facts.canReceiveWork ? '' : ' This actor is UNASSIGNED and cannot receive work.'}
      </p>
    </aside>
  );
}

function OrganizationFactRow({ label, fact }: { readonly label: string; readonly fact: OrganizationFact }) {
  return (
    <div data-actor-fact={label} data-actor-fact-source={fact.source} data-actor-fact-status={fact.status}>
      <dt>{label}</dt>
      <dd>
        {fact.value}
        <small>{PIXEL_ACTOR_FACT_SOURCE_LABELS[fact.source]}</small>
        <small data-actor-fact-status-note={fact.status}>{fact.status}</small>
      </dd>
    </div>
  );
}

export function layoutPixelActorLabels(
  frame: PixelWorldFrameV1,
  viewportWidth: number,
  viewportHeight: number,
): readonly PixelActorLabelPlacement[] {
  const transform = cameraTransform(frame.camera, viewportWidth, viewportHeight);
  const actors = frame.actorFrames
    .filter((actor) => actor.visible)
    .map((actor) => ({
      actor,
      anchorX: Math.round(transform.x + actor.x * transform.scale),
      anchorY: Math.round(transform.y + actor.y * transform.scale),
    }))
    .sort((left, right) => left.anchorY - right.anchorY
      || left.anchorX - right.anchorX
      || left.actor.roleInstanceId.localeCompare(right.actor.roleInstanceId, 'en'));
  const actorBounds = actors.map(({ anchorX, anchorY }) => ({
    x: anchorX - 18,
    y: anchorY - 54,
    width: 36,
    height: 58,
  }));
  const occupied: Rect[] = [];
  return actors.map(({ actor, anchorX, anchorY }) => {
    const inViewport = anchorX >= -24 && anchorX <= viewportWidth + 24
      && anchorY >= -48 && anchorY <= viewportHeight + 24;
    const candidates = labelCandidates(anchorX, anchorY, LABEL_WIDTH, LABEL_HEIGHT)
      .map((candidate) => clampLabelRect(candidate, viewportWidth, viewportHeight));
    const isOpen = (candidate: Rect) => occupied.every((current) => !rectanglesOverlap(candidate, current))
      && actorBounds.every((current) => !rectanglesOverlap(candidate, current));
    const preferred = candidates.find(isOpen);
    const openGridSlot = gridLabelCandidates(anchorX, anchorY, viewportWidth, viewportHeight).find(isOpen);
    const selected = preferred ?? openGridSlot ?? candidates
      .map((candidate) => ({
        candidate,
        penalty: [...occupied, ...actorBounds]
          .filter((current) => rectanglesOverlap(candidate, current)).length,
      }))
      .sort((left, right) => left.penalty - right.penalty
        || left.candidate.y - right.candidate.y
        || left.candidate.x - right.candidate.x)[0]?.candidate
      ?? { x: VIEWPORT_PADDING, y: VIEWPORT_PADDING, width: LABEL_WIDTH, height: LABEL_HEIGHT };
    occupied.push(selected);
    return {
      roleInstanceId: actor.roleInstanceId,
      ...selected,
      anchorX,
      anchorY,
      inViewport,
    };
  });
}

function gridLabelCandidates(
  anchorX: number,
  anchorY: number,
  viewportWidth: number,
  viewportHeight: number,
): readonly Rect[] {
  const candidates: Rect[] = [];
  for (let y = VIEWPORT_PADDING; y <= viewportHeight - LABEL_HEIGHT - VIEWPORT_PADDING; y += LABEL_HEIGHT + 6) {
    for (let x = VIEWPORT_PADDING; x <= viewportWidth - LABEL_WIDTH - VIEWPORT_PADDING; x += LABEL_WIDTH + 6) {
      candidates.push({ x, y, width: LABEL_WIDTH, height: LABEL_HEIGHT });
    }
  }
  return candidates.sort((left, right) =>
    distanceSquared(left, anchorX, anchorY) - distanceSquared(right, anchorX, anchorY)
    || left.y - right.y
    || left.x - right.x);
}

function distanceSquared(rectangle: Rect, anchorX: number, anchorY: number): number {
  const deltaX = rectangle.x + rectangle.width / 2 - anchorX;
  const deltaY = rectangle.y + rectangle.height / 2 - anchorY;
  return deltaX * deltaX + deltaY * deltaY;
}

export function pixelActorLabelPlacementsOverlap(
  left: PixelActorLabelPlacement,
  right: PixelActorLabelPlacement,
): boolean {
  return rectanglesOverlap(left, right);
}

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function labelCandidates(anchorX: number, anchorY: number, width: number, height: number): readonly Rect[] {
  return [
    { x: anchorX + 14, y: anchorY - height - 18, width, height },
    { x: anchorX - width - 14, y: anchorY - height - 18, width, height },
    { x: anchorX + 18, y: anchorY + 10, width, height },
    { x: anchorX - width - 18, y: anchorY + 10, width, height },
    { x: anchorX - width / 2, y: anchorY - height - 58, width, height },
    { x: anchorX - width / 2, y: anchorY + 44, width, height },
    { x: anchorX + 48, y: anchorY - height / 2, width, height },
    { x: anchorX - width - 48, y: anchorY - height / 2, width, height },
    { x: anchorX - width / 2, y: anchorY - height - 100, width, height },
    { x: anchorX - width / 2, y: anchorY + 86, width, height },
  ];
}

function clampLabelRect(rectangle: Rect, viewportWidth: number, viewportHeight: number): Rect {
  return {
    ...rectangle,
    x: Math.round(Math.max(VIEWPORT_PADDING, Math.min(viewportWidth - rectangle.width - VIEWPORT_PADDING, rectangle.x))),
    y: Math.round(Math.max(VIEWPORT_PADDING, Math.min(viewportHeight - rectangle.height - VIEWPORT_PADDING, rectangle.y))),
  };
}

function rectanglesOverlap(left: Rect, right: Rect): boolean {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

function labelRingState(actor: PixelActorFrame): string {
  return actor.organizationFacts?.operationalState.value ?? actor.operationalState;
}

function actorLabelAccessibleName(actor: PixelActorFrame): string {
  const organizationFacts = actor.organizationFacts;
  if (organizationFacts !== undefined) {
    return `${organizationFacts.stableDisplayName.value}. `
      + `Role ${organizationFacts.role.value}. `
      + `Session process ${organizationFacts.sessionProcess.value}, source ${PIXEL_ACTOR_FACT_SOURCE_LABELS[organizationFacts.sessionProcess.source]}. `
      + `AI identity ${organizationFacts.aiIdentity.value}, source ${PIXEL_ACTOR_FACT_SOURCE_LABELS[organizationFacts.aiIdentity.source]}. `
      + `Model ${organizationFacts.model.value}. Effort ${organizationFacts.effort.value}. `
      + `AI runtime ${organizationFacts.aiRuntimeState.value}. Operational ${organizationFacts.operationalState.value}. `
      + 'Open actor detail.';
  }
  return `${actor.displayName}. Role ${actor.facts.role}. Model ${actor.facts.model}, source ${PIXEL_ACTOR_FACT_SOURCE_LABELS[actor.factSources.model]}. Session ${actor.facts.sessionName}, source ${PIXEL_ACTOR_FACT_SOURCE_LABELS[actor.factSources.sessionName]}. State ${actor.facts.state}, source ${PIXEL_ACTOR_FACT_SOURCE_LABELS[actor.factSources.state]}. Open actor detail.`;
}

function roleGlyph(actor: PixelActorFrame): string {
  const role = actor.organizationFacts?.role.value ?? actor.facts.role;
  if (role.includes('Advisor') || role === 'ADVISOR') return 'A';
  if (role.includes('Reviewer') || role === 'REVIEWER') return 'R';
  if (role === 'Control' || role === 'CONTROL') return 'C';
  if (role === 'Designer' || role === 'DESIGNER') return 'D';
  if (role === 'Worker' || role === 'WORKER') return 'W';
  return '?';
}

function actorLabelFactSource(source: PixelActorFactSource): string {
  return source === 'SYNTHETIC_FIXTURE'
    ? 'SYNTHETIC FIXTURE'
    : PIXEL_ACTOR_FACT_SOURCE_LABELS[source];
}

function ActorFact({
  label,
  source,
  value,
}: {
  readonly label: string;
  readonly source: PixelActorFactSource;
  readonly value: string;
}) {
  return (
    <div data-actor-fact={label} data-actor-fact-source={source}>
      <dt>{label}</dt>
      <dd>
        {value}
        <small>{PIXEL_ACTOR_FACT_SOURCE_LABELS[source]}</small>
      </dd>
    </div>
  );
}
