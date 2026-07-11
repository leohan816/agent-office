import type { CSSProperties, KeyboardEvent, Ref } from 'react';

import type { SpatialActorProjection } from '../../application/spatial-office/types.js';
import {
  ActorPlaceholder,
  AssignmentBadgePlaceholder,
  ChannyPlaceholder,
  ProjectGlyphPlaceholder,
  RoleGlyphPlaceholder,
  type SpatialRoleCategory,
} from './assets/placeholder-characters.js';
import type { ProjectIdentity } from './project-identity.js';

export interface SpatialCharacterProps {
  readonly actor: SpatialActorProjection;
  readonly projectIdentity: ProjectIdentity | null;
  readonly tabIndex: number;
  readonly controlRef?: Ref<HTMLButtonElement>;
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  readonly onInspect: (actor: SpatialActorProjection) => void;
}

export function SpatialCharacter({
  actor,
  projectIdentity,
  tabIndex,
  controlRef,
  onKeyDown,
  onInspect,
}: SpatialCharacterProps) {
  const category = roleCategoryForActor(actor.actorRole);
  const displayIdentity = displayFact(actor.displayIdentity.state, actor.displayIdentity.value);
  const activeWorkUnit = actor.activeAssignmentRef?.workUnitId ?? 'NO_ACTIVE_WORKUNIT';
  const projectName = projectIdentity?.displayName ?? actor.projectId ?? 'UNASSIGNED';
  const accessibleName = [
    actor.actorRole,
    displayIdentity,
    `role instance ${actor.roleInstanceId}`,
    `project ${projectName}`,
    `WorkUnit ${activeWorkUnit}`,
    `state ${actor.operationalState}`,
    `freshness ${actor.evidenceFreshness}`,
  ].join(', ');

  return (
    <button
      aria-label={accessibleName}
      className="spatial-character"
      data-actor-state={actor.operationalState}
      data-role-category={category}
      data-spatial-actor={actor.roleInstanceId}
      onClick={() => {
        onInspect(actor);
      }}
      onKeyDown={onKeyDown}
      ref={controlRef}
      tabIndex={tabIndex}
      type="button"
    >
      <ActorPlaceholder accent={projectIdentity?.palette.accent ?? '#83b6ff'} roleCategory={category} />
      <span className="spatial-character__identity">
        <span className="spatial-character__role">
          <RoleGlyphPlaceholder roleCategory={category} />
          <strong>{actor.actorRole}</strong>
        </span>
        <span>{displayIdentity}</span>
        <span className="mono">{actor.roleInstanceId}</span>
      </span>
      <span className="spatial-character__assignment">
        <AssignmentBadgePlaceholder label={projectIdentity?.condensedLabel ?? 'NA'} />
        <span>{projectName}</span>
        <span className="mono">{activeWorkUnit}</span>
      </span>
      <span className="spatial-character__state" data-state-shape={stateShape(actor.operationalState)}>
        {actor.operationalState} / {actor.evidenceFreshness}
      </span>
    </button>
  );
}

export function ProjectIdentityChip({
  identity,
  freshness,
  severity,
  authority,
}: {
  readonly identity: ProjectIdentity;
  readonly freshness: string;
  readonly severity: string;
  readonly authority: string;
}) {
  const style = {
    '--project-accent': identity.palette.accent,
    '--project-surface': identity.palette.darkSurface,
    '--project-text': identity.palette.darkText,
    '--project-light-surface': identity.palette.lightSurface,
    '--project-light-text': identity.palette.lightText,
  } as CSSProperties;
  return (
    <span
      className="project-identity"
      data-authority={authority}
      data-edge={identity.edge}
      data-freshness={freshness}
      data-glyph={identity.glyph}
      data-pattern={identity.pattern}
      data-severity={severity}
      style={style}
    >
      <span
        aria-label={`${identity.displayName}, project ID ${identity.projectId}, ${identity.pattern} pattern, ${identity.glyph} glyph, ${identity.edge} edge`}
        className="project-identity__chip"
      >
        <span className="project-identity__glyph">
          <span>{identity.shortLabel}</span>
        </span>
        <span>
          <strong>{identity.displayName}</strong>
          <span className="project-identity__text-id mono">{identity.projectId}</span>
          <span className="project-identity__supplement">
            <ProjectGlyphPlaceholder label={identity.condensedLabel} />
            {identity.condensedLabel}
          </span>
          {identity.collisionNote === null ? null : (
            <span className="project-identity__collision">
              {identity.collisionNote} / {identity.collisionMarker}
            </span>
          )}
        </span>
      </span>
    </span>
  );
}

export function StaticChanny() {
  return (
    <figure className="spatial-channy" data-channy-mode="STATIC_NON_OPERATIONAL">
      <ChannyPlaceholder />
      <figcaption>
        <strong>Channy</strong>
        <span>Bedlington Terrier / static neutral placeholder</span>
        <span className="mono">NON_ACTOR / NO_AUTHORITY / NO_ASSIGNMENT / NO_BEHAVIOR</span>
      </figcaption>
    </figure>
  );
}

export function roleCategoryForActor(actorRole: string): SpatialRoleCategory {
  if (actorRole === 'Leo/GPT') return 'LEO_DECISION';
  if (actorRole === 'Advisor' || actorRole.endsWith(' Advisor')) return 'ADVISOR_ROUTING';
  if (actorRole === 'Control') return 'CONTROL_RECOVERY';
  if (actorRole.includes('Reviewer')) return 'INDEPENDENT_REVIEW';
  if (actorRole.includes('Worker') || actorRole.includes('Designer')) return 'WORKER_BUILD';
  return 'GENERIC_REGISTERED';
}

function displayFact(state: string, value: string | null): string {
  return value === null ? state : `${value} (${state})`;
}

function stateShape(state: string): 'circle' | 'diamond' | 'square' | 'octagon' {
  if (state === 'BLOCKED' || state === 'FAILED' || state === 'CONFLICT') return 'octagon';
  if (state === 'WAITING_LEO' || state === 'NEEDS_PATCH') return 'diamond';
  if (state === 'UNKNOWN') return 'square';
  return 'circle';
}
