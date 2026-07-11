import { ChannyPlaceholder } from './assets/placeholder-characters.js';
import type { SpatialPresentationTier } from './actor-zone.js';
import { isSpatialRouteCue, type SpatialCueEnvelope } from './cue-projector.js';

export type ChannyPresentationMode =
  | 'NEUTRAL_AMBIENT'
  | 'FOLLOW_ACCEPTED_ROUTE'
  | 'REFLECT_WAITING_LEO'
  | 'REFLECT_BLOCKED'
  | 'REFLECT_STALE_OFFLINE_STATIC'
  | 'REFLECT_COMPLETION';

export interface ChannyPresentationInput {
  readonly cues: readonly SpatialCueEnvelope[];
  readonly evidenceFreshness: 'CURRENT' | 'STALE' | 'OFFLINE' | 'UNKNOWN' | 'CONFLICT' | 'ERROR';
  readonly connectionState: 'CONNECTED' | 'OFFLINE' | 'UNKNOWN' | 'CONFLICT';
  readonly missionComplete: boolean;
  readonly tier: SpatialPresentationTier;
}

export interface ChannyPresentationProjection {
  readonly mode: ChannyPresentationMode;
  readonly motionAllowed: boolean;
  readonly sourceCueId: string | null;
  readonly label: string;
}

export function projectChannyPresentation(input: ChannyPresentationInput): ChannyPresentationProjection {
  if (input.evidenceFreshness !== 'CURRENT' || input.connectionState !== 'CONNECTED') {
    return projection('REFLECT_STALE_OFFLINE_STATIC', false, null, 'Structured stale/offline reflector; motion suppressed');
  }
  const blocked = input.cues.find((cue) => cue.cueKind === 'BLOCKED');
  if (blocked !== undefined) return projection('REFLECT_BLOCKED', false, blocked.cueId, 'Structured BLOCKED reflector');
  const waiting = input.cues.find((cue) => cue.cueKind === 'WAITING_LEO');
  if (waiting !== undefined) return projection('REFLECT_WAITING_LEO', false, waiting.cueId, 'Structured WAITING_LEO reflector');
  if (input.missionComplete) return projection('REFLECT_COMPLETION', false, null, 'Structured mission-complete reflector');
  const route = input.cues.find((cue) => isSpatialRouteCue(cue.cueKind));
  if (route !== undefined) {
    return projection(
      'FOLLOW_ACCEPTED_ROUTE',
      input.tier === 'FULL',
      route.cueId,
      'Briefly follows an already accepted route; carries no command',
    );
  }
  return projection('NEUTRAL_AMBIENT', input.tier === 'FULL', null, 'Neutral ambient companion; no operational meaning');
}

export function ChannyPresentation({ input }: { readonly input: ChannyPresentationInput }) {
  const projected = projectChannyPresentation(input);
  return (
    <figure
      className="spatial-channy spatial-channy-presentation"
      data-channy-mode={projected.mode}
      data-channy-motion={projected.motionAllowed ? 'BOUNDED' : 'STATIC'}
    >
      <ChannyPlaceholder />
      <figcaption>
        <strong>Channy</strong>
        <span>Bedlington Terrier / {projected.label}</span>
        <span className="mono">NON_ACTOR / NO_AUTHORITY / NO_ASSIGNMENT / NO_COMMAND</span>
        <span>Primary status, alert, board, and activity log remain independent.</span>
      </figcaption>
    </figure>
  );
}

function projection(
  mode: ChannyPresentationMode,
  motionAllowed: boolean,
  sourceCueId: string | null,
  label: string,
): ChannyPresentationProjection {
  return { mode, motionAllowed, sourceCueId, label };
}
