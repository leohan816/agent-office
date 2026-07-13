import { PIXEL_ACTOR_FACT_SOURCE_LABELS } from './contracts.js';
import type { LivingOfficeStructuralProjection, PixelWorldFrameV1 } from './contracts.js';
import { ORGANIZATION_COMPACT_FIELDS, organizationFact } from './living-office-actor-overlay.js';

export interface LivingOfficeSemanticMirrorProps {
  readonly frame: PixelWorldFrameV1;
  readonly projection: LivingOfficeStructuralProjection;
  // I2-4: the authenticated production surface is a continuous fixture-free committed office; the
  // prototype demo keeps its synthetic-fixture wording. Defaults to PROTOTYPE for the frozen entry.
  readonly surfaceKind?: 'PROTOTYPE' | 'PRODUCTION';
}

export function LivingOfficeSemanticMirror({
  frame,
  projection,
  surfaceKind = 'PROTOTYPE',
}: LivingOfficeSemanticMirrorProps) {
  const production = surfaceKind === 'PRODUCTION';
  return (
    <section
      aria-labelledby="living-office-semantic-heading"
      className="living-office-semantic"
      data-frame-key={frame.frameKey}
      data-semantic-entity-count={frame.semanticEntities.length}
      id="living-office-semantic"
    >
      <div className="living-office-semantic__heading">
        <div>
          <p>{production ? 'Accessible committed office mirror' : 'Accessible synthetic fixture mirror'}</p>
          <h2 id="living-office-semantic-heading">Every visible pixel has complete text meaning</h2>
        </div>
        <span className="living-office-semantic__parity">FRAME PARITY / {frame.visibleEntityIds.length} ENTITIES</span>
      </div>
      <div className="living-office-semantic__columns">
        <div>
          <h3>Advisor Teams and project Pods</h3>
          <ul className="living-office-semantic__pod-list">
            {projection.pods.map((pod) => (
              <li key={pod.podId} data-selected={pod.podId === frame.selectedPodId}>
                <strong>{pod.projectIdentity.displayName}</strong>
                <span>{pod.advisorTeamId}</span>
                <span>{pod.missionShortLabel}</span>
                <span>{pod.currentActorRoleInstanceId}</span>
                <span>{pod.podId === frame.selectedPodId ? frame.hud.operationalState : pod.operationalState}</span>
                <span>{pod.completedWorkUnits}/{pod.totalWorkUnits} / gates {pod.completedGates}/{pod.totalGates}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Selected activity and route log</h3>
          <div aria-live="polite" role="log">
            <ol className="living-office-semantic__route-log">
              {frame.route === null ? (
                <li>No active operational route. Static state remains authoritative.</li>
              ) : (
                <li>
                  <strong>{frame.route.kind}</strong>
                  <span>{frame.route.roleInstanceId}</span>
                  <span>{frame.route.staticEquivalent}</span>
                  <span>Source cue {frame.route.cueId}</span>
                </li>
              )}
            </ol>
          </div>
          <p className="living-office-semantic__channy">
            <strong>Channy</strong>: {frame.channy.animation}; non-actor; authorityRole none;
            no assignment, evidence, command, notification, or workflow meaning.
          </p>
        </div>
      </div>
      {production ? (
        <div className="living-office-semantic__roster">
          <h3>Actor first-layer facts (every visible actor)</h3>
          <ul className="living-office-semantic__roster-list">
            {frame.actorFrames.filter((actor) => actor.visible && actor.organizationFacts !== undefined).map((actor) => {
              const facts = actor.organizationFacts;
              if (facts === undefined) return null;
              return (
                <li key={actor.roleInstanceId} data-actor-roster={actor.roleInstanceId}>
                  <strong>{facts.stableDisplayName.value}</strong>
                  <span className="living-office-semantic__roster-role">{facts.role.value}</span>
                  {ORGANIZATION_COMPACT_FIELDS.map(([key, label]) => {
                    const fact = organizationFact(facts, key);
                    return (
                      <span data-actor-fact-source={fact.source} data-actor-roster-field={key} key={key}>
                        {label}: {fact.value} <small>{PIXEL_ACTOR_FACT_SOURCE_LABELS[fact.source]}</small>
                      </span>
                    );
                  })}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <ul className="sr-only" data-semantic-entity-set>
        {frame.semanticEntities.map((entity) => (
          <li key={entity.entityId} data-entity-id={entity.entityId}>
            {entity.kind}: {entity.label}; {entity.state}
          </li>
        ))}
      </ul>
      <ul className="sr-only" data-semantic-actor-facts>
        {frame.actorFrames.filter((actor) => actor.visible).map((actor) => (
          <li key={actor.roleInstanceId}>
            {actor.displayName}; role {actor.facts.role}; project {actor.facts.project}; Advisor Team {actor.facts.advisorTeam};
            reports-to Advisor {actor.facts.reportsToAdvisor}; session name {actor.facts.sessionName} source {PIXEL_ACTOR_FACT_SOURCE_LABELS[actor.factSources.sessionName]};
            model {actor.facts.model} source {PIXEL_ACTOR_FACT_SOURCE_LABELS[actor.factSources.model]};
            state {actor.facts.state} source {PIXEL_ACTOR_FACT_SOURCE_LABELS[actor.factSources.state]};
            mission {actor.facts.mission} source {PIXEL_ACTOR_FACT_SOURCE_LABELS[actor.factSources.mission]};
            WorkUnit {actor.facts.workUnit} source {PIXEL_ACTOR_FACT_SOURCE_LABELS[actor.factSources.workUnit]};
            evidence freshness {actor.facts.evidenceFreshness} source {PIXEL_ACTOR_FACT_SOURCE_LABELS[actor.factSources.evidenceFreshness]}.
          </li>
        ))}
      </ul>
      <p aria-atomic="true" aria-live="polite" className="sr-only">
        {frame.hud.projectName} selected. {frame.hud.operationalState}. {frame.hud.statusLine}
      </p>
    </section>
  );
}
