import type { SpatialPresentationTier } from './actor-zone.js';
import type { SpatialCueEnvelope } from './cue-projector.js';

export const VERIFIED_IDLE_PRESENTATIONS = [
  'COFFEE',
  'LEISURE_READING',
  'RESTING',
  'SMALL_GAME',
  'WINDOW',
  'WHITEBOARD',
  'CHANNY_INTERACTION',
  'VISUAL_TALK_NO_CONTENT',
] as const;

export type VerifiedIdlePresentationKind = (typeof VERIFIED_IDLE_PRESENTATIONS)[number];

export interface VerifiedIdlePresentationInput {
  readonly roleInstanceId: string;
  readonly advisorTeamId: string;
  readonly responsibleAdvisorRoleInstanceId: string;
  readonly operationalState: 'IDLE' | 'WORKING' | 'TESTING' | 'BLOCKED' | 'WAITING_LEO';
  readonly evidenceFreshness: 'CURRENT' | 'STALE' | 'UNKNOWN' | 'CONFLICT' | 'ERROR';
  readonly connectionState: 'CONNECTED' | 'OFFLINE' | 'UNKNOWN' | 'CONFLICT';
  readonly assignmentVerified: boolean;
  readonly idleEvidenceVerified: boolean;
  readonly evaluatedAt: string;
  readonly presentation: VerifiedIdlePresentationKind;
}

export interface VerifiedIdleProjection {
  readonly eligible: boolean;
  readonly diagnosticCode: string;
  readonly input: VerifiedIdlePresentationInput;
}

export function projectVerifiedIdle(input: VerifiedIdlePresentationInput): VerifiedIdleProjection {
  if (input.operationalState !== 'IDLE') return { eligible: false, diagnosticCode: 'OPERATIONAL_OVERRIDE', input };
  if (input.evidenceFreshness !== 'CURRENT') return { eligible: false, diagnosticCode: 'IDLE_EVIDENCE_NOT_CURRENT', input };
  if (input.connectionState !== 'CONNECTED') return { eligible: false, diagnosticCode: 'IDLE_CONNECTION_NOT_CONNECTED', input };
  if (!input.assignmentVerified || !input.idleEvidenceVerified) {
    return { eligible: false, diagnosticCode: 'VERIFIED_IDLE_UNAVAILABLE', input };
  }
  return { eligible: true, diagnosticCode: 'VERIFIED_IDLE', input };
}

export function VerifiedIdleLounge({
  candidates,
  operationalCues,
  tier,
}: {
  readonly candidates: readonly VerifiedIdlePresentationInput[];
  readonly operationalCues: readonly SpatialCueEnvelope[];
  readonly tier: SpatialPresentationTier;
}) {
  const operationalActors = new Set(operationalCues
    .filter((cue) => cue.cueKind !== 'IDLE_RELOCATE')
    .map((cue) => cue.roleInstanceId));
  const eligible = candidates
    .map(projectVerifiedIdle)
    .filter((projection) => projection.eligible && !operationalActors.has(projection.input.roleInstanceId))
    .slice(0, 1);
  if (eligible.length === 0) return null;
  return (
    <section aria-labelledby="verified-idle-heading" className="spatial-verified-idle" data-presentation-tier={tier}>
      <div>
        <p className="eyebrow">VERIFIED IDLE / PRESENTATION ONLY</p>
        <h3 id="verified-idle-heading">Bounded lounge presentation</h3>
      </div>
      {eligible.map(({ input }) => (
        <div data-idle-presentation={input.presentation} key={input.roleInstanceId}>
          <span aria-hidden="true" className="spatial-verified-idle__pose" />
          <span>
            <strong>{input.presentation}</strong>
            <span className="mono">{input.roleInstanceId}</span>
            <span>VERIFIED_IDLE at {input.evaluatedAt}</span>
          </span>
        </div>
      ))}
      <p>No availability, assignment, shared context, collaboration, communication, approval, or progress is implied.</p>
    </section>
  );
}
