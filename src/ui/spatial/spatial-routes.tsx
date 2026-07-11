import { useEffect, useRef } from 'react';

import type { SpatialPresentationTier } from './actor-zone.js';
import { isSpatialRouteCue, type SpatialCueEnvelope } from './cue-projector.js';
import type { SpatialCueActivityLogEntry } from './cue-reducer.js';

export interface SpatialZoneEndpoint {
  readonly zoneId: string;
  readonly visible: boolean;
  readonly ambiguous: boolean;
}

export interface ResolvedSpatialRoute {
  readonly cue: SpatialCueEnvelope;
  readonly outcome: 'MOTION' | 'STATIC_EQUIVALENT';
  readonly diagnosticCode: 'ROUTE_RESOLVED' | 'TIER_STATIC' | 'ENDPOINT_HIDDEN' | 'ENDPOINT_MISSING' | 'ENDPOINT_AMBIGUOUS';
}

export function resolveSpatialRoute(
  cue: SpatialCueEnvelope,
  endpoints: readonly SpatialZoneEndpoint[],
  tier: SpatialPresentationTier,
): ResolvedSpatialRoute {
  if (tier === 'STATIC') return { cue, outcome: 'STATIC_EQUIVALENT', diagnosticCode: 'TIER_STATIC' };
  const source = endpoints.filter((endpoint) => endpoint.zoneId === cue.sourceZoneId);
  const targetId = cue.targetZoneId ?? cue.sourceZoneId;
  const target = endpoints.filter((endpoint) => endpoint.zoneId === targetId);
  if (source.length === 0 || target.length === 0) {
    return { cue, outcome: 'STATIC_EQUIVALENT', diagnosticCode: 'ENDPOINT_MISSING' };
  }
  if (source.length !== 1 || target.length !== 1 || source[0]?.ambiguous === true || target[0]?.ambiguous === true) {
    return { cue, outcome: 'STATIC_EQUIVALENT', diagnosticCode: 'ENDPOINT_AMBIGUOUS' };
  }
  if (source[0]?.visible !== true || target[0]?.visible !== true) {
    return { cue, outcome: 'STATIC_EQUIVALENT', diagnosticCode: 'ENDPOINT_HIDDEN' };
  }
  return { cue, outcome: 'MOTION', diagnosticCode: 'ROUTE_RESOLVED' };
}

export function SpatialRoutes({
  cues,
  activityLog,
  endpoints,
  tier,
  frozenProgress,
  onCueComplete,
}: {
  readonly cues: readonly SpatialCueEnvelope[];
  readonly activityLog: readonly SpatialCueActivityLogEntry[];
  readonly endpoints: readonly SpatialZoneEndpoint[];
  readonly tier: SpatialPresentationTier;
  readonly frozenProgress: number | null;
  readonly onCueComplete?: (cueId: string) => void;
}) {
  const routeCue = cues.find((cue) => isSpatialRouteCue(cue.cueKind));
  const route = routeCue === undefined ? null : resolveSpatialRoute(routeCue, endpoints, tier);
  return (
    <section aria-labelledby="spatial-route-timeline-heading" className="spatial-route-timeline">
      <div>
        <p className="eyebrow">SEMANTIC ROUTE TIMELINE</p>
        <h3 id="spatial-route-timeline-heading">Accepted cue activity</h3>
      </div>
      {route?.outcome === 'MOTION' ? (
        <RouteMotionPair
          cue={route.cue}
          frozenProgress={frozenProgress}
          {...(onCueComplete === undefined ? {} : { onComplete: onCueComplete })}
        />
      ) : route === null ? null : (
        <p data-route-static-equivalent={route.diagnosticCode}>
          {route.cue.sourceZoneId} -&gt; {route.cue.targetZoneId ?? route.cue.sourceZoneId} / {route.cue.staticEquivalentCode}
        </p>
      )}
      <div aria-atomic="false" aria-live="polite" aria-relevant="additions" role="log">
        <ol className="spatial-activity-log">
          {activityLog.map((entry) => (
            <li data-log-outcome={entry.outcome} key={entry.entryId}>
              <strong>{entry.cueKind ?? entry.outcome}</strong>
              <span>{entry.text}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function RouteMotionPair({
  cue,
  frozenProgress,
  onComplete,
}: {
  readonly cue: SpatialCueEnvelope;
  readonly frozenProgress: number | null;
  readonly onComplete?: (cueId: string) => void;
}) {
  const pairRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const pair = pairRef.current;
    if (pair === null || frozenProgress !== null || typeof pair.animate !== 'function') return;
    const animation = pair.animate(
      [
        { opacity: 0.25, transform: 'translate3d(0, 0, 0)' },
        { opacity: 1, transform: 'translate3d(65%, 0, 0)' },
      ],
      { duration: cue.durationMs, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', iterations: 1 },
    );
    animation.onfinish = () => {
      pair.style.opacity = '1';
      pair.style.transform = 'translate3d(65%, 0, 0)';
      animation.cancel();
      onComplete?.(cue.cueId);
    };
    return () => {
      animation.onfinish = null;
      animation.cancel();
    };
  }, [cue.cueId, cue.durationMs, frozenProgress, onComplete]);
  const progress = frozenProgress === null ? null : Math.max(0, Math.min(1, frozenProgress));
  return (
    <div
      aria-hidden="true"
      className="spatial-route-layer"
      data-motion-cue={cue.cueKind}
      data-route={`${cue.sourceZoneId}->${cue.targetZoneId ?? cue.sourceZoneId}`}
    >
      <div className="spatial-route-track" />
      <div
        className="spatial-route-pair"
        data-route-pair="actor-document"
        ref={pairRef}
        style={progress === null ? undefined : {
          opacity: 1,
          transform: `translate3d(${String(progress * 65)}%, 0, 0)`,
        }}
      >
        <span className="spatial-route-actor">{cue.roleInstanceId.slice(0, 2).toUpperCase()}</span>
        <span className="spatial-route-document">{cue.cueKind}</span>
      </div>
    </div>
  );
}
