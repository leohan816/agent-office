import type { SpatialCueEnvelope, SpatialCueKind } from './cue-projector.js';

export type SpatialPresentationTier = 'FULL' | 'RESTRAINED' | 'STATIC';

export interface SpatialActorPose {
  readonly cueKind: SpatialCueKind;
  readonly operationalState: string;
  readonly pose: string;
  readonly label: string;
}

export function ActorZonePresentation({
  cues,
  tier,
}: {
  readonly cues: readonly SpatialCueEnvelope[];
  readonly tier: SpatialPresentationTier;
}) {
  if (cues.length === 0) return null;
  return (
    <section aria-labelledby="spatial-operational-heading" className="spatial-operational-zone">
      <div>
        <p className="eyebrow">ACCEPTED STRUCTURED LIVE DELTA</p>
        <h3 id="spatial-operational-heading">Operational presentation overrides ambient state</h3>
      </div>
      <ul>
        {cues.map((cue) => {
          const pose = poseForSpatialCue(cue.cueKind);
          return (
            <li
              data-cue-kind={cue.cueKind}
              data-operational-pose={pose.pose}
              data-presentation-tier={tier}
              key={cue.cueId}
            >
              <span aria-hidden="true" className="spatial-operational-zone__pose" />
              <span>
                <strong>{pose.operationalState} / {pose.label}</strong>
                <span className="mono">{cue.roleInstanceId}</span>
                <span>{cue.workUnitId ?? 'NO_WORKUNIT'} / {cue.staticEquivalentCode}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function poseForSpatialCue(kind: SpatialCueKind): SpatialActorPose {
  const poseByCue: Readonly<Record<SpatialCueKind, Omit<SpatialActorPose, 'cueKind'>>> = {
    LEO_GPT_TO_ADVISOR_HANDOFF: { operationalState: 'ROUTING / DISPATCH', pose: 'HANDOFF_DOCUMENT', label: 'Leo/GPT handoff' },
    DELIVERY: { operationalState: 'ROUTING / DISPATCH', pose: 'DELIVERY_COURIER', label: 'Advisor dispatch route' },
    READING: { operationalState: 'WORKING', pose: 'READING_DOCUMENT', label: 'Reading verified input' },
    WORKING: { operationalState: 'WORKING', pose: 'BOUNDED_KEYBOARD', label: 'Working' },
    TESTING: { operationalState: 'TESTING', pose: 'CHECKLIST_TOOL', label: 'Testing; no pass claim' },
    WRITING_RESULT: { operationalState: 'WORKING', pose: 'RESULT_DRAFT', label: 'Writing result' },
    REVIEW_HANDOFF: { operationalState: 'ROUTING / DISPATCH', pose: 'REVIEW_DOCUMENT', label: 'Independent review handoff' },
    REVIEW: { operationalState: 'REVIEWING', pose: 'LENS_CHECKLIST', label: 'Independent review' },
    REVIEW_VERDICT_RETURN: { operationalState: 'RETURNING_RESULT', pose: 'VERDICT_DOCUMENT', label: 'Verdict return; not approval' },
    BLOCKED: { operationalState: 'BLOCKED', pose: 'BARRIER', label: 'Blocked' },
    WAITING_LEO: { operationalState: 'WAITING_LEO', pose: 'DECISION_DOCUMENT', label: 'Waiting for Leo/GPT' },
    RESULT_RETURN: { operationalState: 'RETURNING_RESULT', pose: 'RESULT_DOCUMENT', label: 'Result return; not completion' },
    PATCH_RETURN: { operationalState: 'NEEDS_PATCH', pose: 'PATCH_DOCUMENT', label: 'Patch return; not dispatch' },
    COMPLETION_ACKNOWLEDGEMENT: { operationalState: 'COMPLETED', pose: 'BOARD_ACKNOWLEDGEMENT', label: 'Completion acknowledgement' },
    RECOVERY: { operationalState: 'RECOVERY', pose: 'RECOVERY_TOOL', label: 'Verified recovery step' },
    IDLE_RELOCATE: { operationalState: 'IDLE', pose: 'VERIFIED_IDLE_RELOCATION', label: 'Verified idle relocation' },
  };
  return { cueKind: kind, ...poseByCue[kind] };
}
