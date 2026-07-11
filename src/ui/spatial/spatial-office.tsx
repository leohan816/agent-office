import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from 'react';

import type {
  SpatialActorProjection,
  SpatialOfficeProjectionV1,
  SpatialTeamPodProjection,
} from '../../application/spatial-office/types.js';
import { FacilityPlaceholder } from './assets/placeholder-characters.js';
import { SpatialCharacter, StaticChanny } from './character.js';
import { STATIC_SPATIAL_OFFICE_FIXTURE } from './fixtures.js';
import {
  resolveProjectIdentity,
  resolveVisibleProjectIdentities,
  type ProjectIdentity,
} from './project-identity.js';
import { TeamPod } from './team-pod.js';
import './project-identity.css';
import './spatial-office.css';

export interface SpatialOfficeProps {
  readonly projection?: SpatialOfficeProjectionV1;
}

export function SpatialOffice({ projection = STATIC_SPATIAL_OFFICE_FIXTURE.projection }: SpatialOfficeProps) {
  const initialPodId = projection.selectedPodId ?? projection.pods[0]?.podId ?? null;
  const [selectedPodId, setSelectedPodId] = useState(initialPodId);
  const [podFocusIndex, setPodFocusIndex] = useState(() =>
    Math.max(0, projection.pods.findIndex((pod) => pod.podId === initialPodId)));
  const [focusedActorId, setFocusedActorId] = useState<string | null>(null);
  const [podAnnouncement, setPodAnnouncement] = useState('');
  const [inspectedActor, setInspectedActor] = useState<SpatialActorProjection | null>(null);
  const podControlRefs = useRef(new Map<string, HTMLButtonElement>());
  const actorControlRefs = useRef(new Map<string, HTMLButtonElement>());
  const inspectorCloseRef = useRef<HTMLButtonElement>(null);
  const inspectorInvokerRef = useRef<HTMLElement | null>(null);

  const identities = useMemo(
    () => resolveVisibleProjectIdentities(projection.pods.map((pod) => ({
      projectId: pod.projectId,
      displayName: pod.displayName,
    }))),
    [projection.pods],
  );
  const identityByProject = useMemo(
    () => new Map(identities.map((identity) => [identity.projectId, identity])),
    [identities],
  );
  const selectedPod = projection.pods.find((pod) => pod.podId === selectedPodId)
    ?? projection.pods[0]
    ?? null;
  const selectedActors = selectedPod === null
    ? []
    : actorsForPod(selectedPod, projection);
  const globalAdvisors = globalAdvisorActors(projection, selectedPod);
  const interactiveActorIds = unique([
    ...(selectedPod?.responsibleAdvisorRoleInstanceId === null || selectedPod?.responsibleAdvisorRoleInstanceId === undefined
      ? []
      : [selectedPod.responsibleAdvisorRoleInstanceId]),
    ...selectedActors.map((actor) => actor.roleInstanceId),
  ]).filter((roleInstanceId) => projection.actorsByRoleInstanceId[roleInstanceId] !== undefined);

  useEffect(() => {
    if (interactiveActorIds.length === 0) {
      setFocusedActorId(null);
      return;
    }
    if (focusedActorId === null || !interactiveActorIds.includes(focusedActorId)) {
      setFocusedActorId(interactiveActorIds[0] ?? null);
    }
  }, [focusedActorId, interactiveActorIds]);

  useEffect(() => {
    if (inspectedActor !== null) inspectorCloseRef.current?.focus();
  }, [inspectedActor]);

  const selectPod = (pod: SpatialTeamPodProjection) => {
    setSelectedPodId(pod.podId);
    const nextActors = actorsForPod(pod, projection);
    setFocusedActorId(pod.responsibleAdvisorRoleInstanceId ?? nextActors[0]?.roleInstanceId ?? null);
    setPodAnnouncement(
      `${pod.advisorTeamId} selected, ${pod.evidenceFreshness}, ${pod.connectionState}`,
    );
  };

  const onPodKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = projection.pods.length - 1;
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = index === last ? 0 : index + 1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = index === 0 ? last : index - 1;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = last;
    if (event.key === 'Enter' || event.key === ' ') {
      const pod = projection.pods[index];
      if (pod !== undefined) selectPod(pod);
      event.preventDefault();
      return;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    const pod = projection.pods[nextIndex];
    if (pod === undefined) return;
    setPodFocusIndex(nextIndex);
    podControlRefs.current.get(pod.podId)?.focus();
  };

  const onActorKeyDown = (event: KeyboardEvent<HTMLButtonElement>, roleInstanceId: string) => {
    const index = interactiveActorIds.indexOf(roleInstanceId);
    if (index < 0) return;
    const last = interactiveActorIds.length - 1;
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = index === last ? 0 : index + 1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = index === 0 ? last : index - 1;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = last;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextId = interactiveActorIds[nextIndex];
    if (nextId === undefined) return;
    setFocusedActorId(nextId);
    actorControlRefs.current.get(nextId)?.focus();
  };

  const openInspector = (actor: SpatialActorProjection) => {
    inspectorInvokerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setInspectedActor(actor);
  };

  const closeInspector = () => {
    setInspectedActor(null);
    inspectorInvokerRef.current?.focus();
  };

  const actorControlRef = (roleInstanceId: string): Ref<HTMLButtonElement> => (element) => {
    if (element === null) actorControlRefs.current.delete(roleInstanceId);
    else actorControlRefs.current.set(roleInstanceId, element);
  };

  return (
    <div
      className="spatial-office-shell"
      data-fixture-kind="SYNTHETIC_NON_OPERATIONAL_STATIC"
      data-motion-tier="STATIC"
      id="spatial-office"
    >
      <a className="skip-link spatial-skip-status" href="#spatial-status">Global status</a>
      <a className="skip-link spatial-skip-pods" href="#spatial-pod-nav">Advisor Team selector</a>
      <a className="skip-link spatial-skip-board" href="#spatial-mission-board">Selected mission board</a>
      <a className="skip-link spatial-skip-floor" href="#spatial-floor-list">Actor and zone state list</a>
      <a className="skip-link spatial-skip-inspector" href="#spatial-inspector">Evidence and alert inspector</a>

      <header className="spatial-global-status" id="spatial-status" tabIndex={-1}>
        <div>
          <p className="eyebrow">AGENT OFFICE / M1.2 / AO12-B</p>
          <h1>Static Advisor-team shared office</h1>
          <p>One synthetic test/demo floor. Non-operational, read-only, and motion-free.</p>
        </div>
        <dl>
          <div><dt>Projection</dt><dd>#{projection.projectionRevision}</dd></div>
          <div><dt>Schema</dt><dd className="mono">{projection.schemaVersion}</dd></div>
          <div><dt>Floor</dt><dd>{projection.floorMode}</dd></div>
          <div><dt>Catalog</dt><dd className="mono">{projection.identityCatalogVersion}</dd></div>
          <div><dt>Evaluated</dt><dd>{projection.evaluatedAt}</dd></div>
          <div><dt>Mode</dt><dd>STATIC / FIXTURE ONLY</dd></div>
        </dl>
      </header>

      <nav aria-label="Registered Advisor Team navigation" className="spatial-pod-navigation" id="spatial-pod-nav">
        <div>
          <p className="eyebrow">TEAM NAVIGATION / MINIMAP</p>
          <h2>Registered Advisor Teams</h2>
        </div>
        <div className="spatial-pod-navigation__controls" role="toolbar" aria-label="Advisor Team roving selector">
          {projection.pods.map((pod, index) => {
            const identity = requireIdentity(identityByProject, pod.projectId);
            return (
              <button
                aria-current={pod.podId === selectedPod?.podId ? 'true' : undefined}
                aria-label={podAccessibleName(pod, identity)}
                className="spatial-pod-control"
                data-pod-control={pod.podId}
                key={pod.podId}
                onClick={() => {
                  setPodFocusIndex(index);
                  selectPod(pod);
                }}
                onKeyDown={(event) => {
                  onPodKeyDown(event, index);
                }}
                ref={(element) => {
                  if (element === null) podControlRefs.current.delete(pod.podId);
                  else podControlRefs.current.set(pod.podId, element);
                }}
                tabIndex={podFocusIndex === index ? 0 : -1}
                type="button"
              >
                <span className="spatial-pod-control__marker" data-edge={identity.edge}>{identity.condensedLabel}</span>
                <span><strong>{pod.advisorTeamId}</strong><small>{identity.displayName} / {identity.projectId}</small></span>
                <span className="spatial-pod-control__state">{pod.operationalState} / {pod.evidenceFreshness}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <p aria-atomic="true" aria-live="polite" className="visually-hidden" data-spatial-live="pod-selection">
        {podAnnouncement}
      </p>
      <p aria-atomic="true" className="visually-hidden" data-spatial-live="critical" role="alert" />

      <section aria-labelledby="spatial-floor-heading" className="spatial-office-floor">
        <header className="spatial-floor-heading">
          <div>
            <p className="eyebrow">ONE SHARED AMERICAN-STYLE OPEN OFFICE FLOOR</p>
            <h2 id="spatial-floor-heading">Every registered Team remains visible</h2>
          </div>
          <span className="spatial-static-badge">STATIC / NO CUES / NO ROUTES</span>
        </header>

        <div className="spatial-shared-facilities" aria-label="Shared code-native static facilities">
          <section><FacilityPlaceholder kind="GLASS_MEETING_ROOM" /><span>Glass meeting room</span></section>
          <section><FacilityPlaceholder kind="COFFEE_LOUNGE" /><span>Coffee lounge</span></section>
          <section><FacilityPlaceholder kind="SHARED_PATH" /><span>Shared paths</span></section>
          <section><FacilityPlaceholder kind="CHANNY_FACILITIES" /><span>Channy bed / food / water</span></section>
        </div>

        <section aria-labelledby="spatial-advisor-hub-heading" className="spatial-global-advisor-hub" data-zone="global-advisor-hub">
          <div>
            <FacilityPlaceholder kind="ADVISOR_HUB" />
            <h3 id="spatial-advisor-hub-heading">Global Advisor Hub</h3>
            <p>One character per exact Advisor roleInstanceId. Team Pods hold references, not clones.</p>
          </div>
          <div className="spatial-character-grid spatial-global-advisor-hub__actors">
            {globalAdvisors.map((actor) => (
              <SpatialCharacter
                actor={actor}
                controlRef={actorControlRef(actor.roleInstanceId)}
                key={actor.roleInstanceId}
                onInspect={openInspector}
                onKeyDown={(event) => {
                  onActorKeyDown(event, actor.roleInstanceId);
                }}
                projectIdentity={identityForActor(actor, identityByProject)}
                tabIndex={focusedActorId === actor.roleInstanceId ? 0 : -1}
              />
            ))}
          </div>
        </section>

        <div className="spatial-team-pods">
          {projection.pods.map((pod) => (
            <TeamPod
              actorControlRef={actorControlRef}
              actors={actorsForPod(pod, projection)}
              actorTabIndex={(roleInstanceId) => focusedActorId === roleInstanceId ? 0 : -1}
              identity={requireIdentity(identityByProject, pod.projectId)}
              key={pod.podId}
              onActorKeyDown={onActorKeyDown}
              onInspectActor={openInspector}
              pod={pod}
              projectionRevision={projection.projectionRevision}
              selected={pod.podId === selectedPod?.podId}
            />
          ))}
        </div>

        <section aria-labelledby="spatial-channy-heading" className="spatial-channy-zone" data-zone="channy-static-facility">
          <h3 className="visually-hidden" id="spatial-channy-heading">Channy static non-operational area</h3>
          <StaticChanny />
          <FacilityPlaceholder kind="CHANNY_FACILITIES" />
        </section>
      </section>

      <section aria-labelledby="spatial-state-list-heading" className="spatial-state-list" id="spatial-floor-list" tabIndex={-1}>
        <p className="eyebrow">SEMANTIC STATIC EQUIVALENT</p>
        <h2 id="spatial-state-list-heading">Actor and zone state list</h2>
        <ul>
          {Object.values(projection.actorsByRoleInstanceId).map((actor) => (
            <li key={actor.roleInstanceId}>
              <strong>{actor.actorRole}</strong>
              <span className="mono">{actor.roleInstanceId}</span>
              <span>{actor.operationalState} / {actor.assignmentStatus} / {actor.evidenceFreshness} / {actor.connectionState}</span>
            </li>
          ))}
        </ul>
        <ul aria-label="Static semantic zones">
          {['mission-board', 'work', 'testing-bench', 'result-desk', 'independent-review-desk', 'advisor-anchor', 'leo-decision-destination', 'evidence-cabinet', 'lounge', 'shared-path'].map((zone) => (
            <li key={zone}><span className="mono">{zone}</span><span>STATIC / no task-signifying motion</span></li>
          ))}
        </ul>
      </section>

      <aside aria-labelledby="spatial-inspector-heading" className="spatial-evidence-inspector" id="spatial-inspector" tabIndex={-1}>
        <div>
          <p className="eyebrow">READ-ONLY INSPECTOR</p>
          <h2 id="spatial-inspector-heading">Evidence and alerts</h2>
        </div>
        <section id="spatial-evidence">
          <h3>Evidence</h3>
          <p>{selectedPod?.evidenceSummary.verifiedCount ?? 0} verified reference(s)</p>
          <p className="mono">{selectedPod?.evidenceSummary.latest.evidenceRef ?? 'UNKNOWN'}</p>
          <p>{selectedPod?.evidenceSummary.latest.verifiedAt ?? 'UNKNOWN'}</p>
        </section>
        <section id="spatial-alerts">
          <h3>Alerts</h3>
          <p>{selectedPod?.alertSummary.severity ?? 'NONE'} / {selectedPod?.alertSummary.openCount ?? 0} open</p>
          <p>No action, acknowledgement, dispatch, or authority control exists on this fixture surface.</p>
        </section>
      </aside>

      {inspectedActor === null ? null : (
        <div
          aria-labelledby="spatial-actor-inspector-heading"
          aria-modal="true"
          className="spatial-actor-dialog"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              closeInspector();
            } else if (event.key === 'Tab') {
              event.preventDefault();
              inspectorCloseRef.current?.focus();
            }
          }}
          role="dialog"
        >
          <div className="spatial-actor-dialog__panel">
            <p className="eyebrow">STATIC ACTOR INSPECTOR</p>
            <h2 id="spatial-actor-inspector-heading">{inspectedActor.actorRole}</h2>
            <dl>
              <div><dt>Role instance</dt><dd className="mono">{inspectedActor.roleInstanceId}</dd></div>
              <div><dt>Advisor Team</dt><dd>{inspectedActor.advisorTeamId ?? 'UNASSIGNED'}</dd></div>
              <div><dt>Responsible Advisor</dt><dd className="mono">{inspectedActor.responsibleAdvisorRoleInstanceId ?? 'UNKNOWN'}</dd></div>
              <div><dt>Project</dt><dd>{inspectedActor.projectId ?? 'UNASSIGNED'}</dd></div>
              <div><dt>Assignment</dt><dd>{inspectedActor.assignmentStatus}</dd></div>
              <div><dt>State</dt><dd>{inspectedActor.operationalState} / {inspectedActor.evidenceFreshness}</dd></div>
            </dl>
            <button onClick={closeInspector} ref={inspectorCloseRef} type="button">Close actor inspector</button>
          </div>
        </div>
      )}
    </div>
  );
}

function actorsForPod(
  pod: SpatialTeamPodProjection,
  projection: SpatialOfficeProjectionV1,
): readonly SpatialActorProjection[] {
  const actorIds = unique(pod.actorAssignments
    .map((assignment) => assignment.roleInstanceId)
    .filter((roleInstanceId): roleInstanceId is string => roleInstanceId !== null));
  return actorIds
    .map((roleInstanceId) => projection.actorsByRoleInstanceId[roleInstanceId])
    .filter((actor): actor is SpatialActorProjection => actor !== undefined);
}

function globalAdvisorActors(
  projection: SpatialOfficeProjectionV1,
  selectedPod: SpatialTeamPodProjection | null,
): readonly SpatialActorProjection[] {
  const selectedAdvisor = selectedPod?.responsibleAdvisorRoleInstanceId ?? null;
  return Object.values(projection.actorsByRoleInstanceId)
    .filter((actor) => actor.presentationScope === 'GLOBAL_ADVISOR_HUB')
    .sort((left, right) => {
      if (left.roleInstanceId === selectedAdvisor) return -1;
      if (right.roleInstanceId === selectedAdvisor) return 1;
      return left.roleInstanceId.localeCompare(right.roleInstanceId, 'en-US');
    });
}

function identityForActor(
  actor: SpatialActorProjection,
  identityByProject: ReadonlyMap<string, ProjectIdentity>,
): ProjectIdentity | null {
  if (actor.projectId === null) return null;
  return identityByProject.get(actor.projectId)
    ?? resolveProjectIdentity(actor.projectId, actor.projectId);
}

function requireIdentity(
  identityByProject: ReadonlyMap<string, ProjectIdentity>,
  projectId: string,
): ProjectIdentity {
  const identity = identityByProject.get(projectId);
  if (identity === undefined) throw new TypeError(`project identity missing for ${projectId}`);
  return identity;
}

function podAccessibleName(pod: SpatialTeamPodProjection, identity: ProjectIdentity): string {
  const progress = pod.missionSummaries[0]?.workUnitProgress;
  const progressText = progress?.completed === null || progress?.total === null || progress === undefined
    ? progress?.state ?? 'UNKNOWN'
    : `${progress.completed} of ${progress.total}`;
  return [
    pod.advisorTeamId,
    `${identity.displayName}, project ID ${identity.projectId}`,
    `freshness ${pod.evidenceFreshness}`,
    `responsible Advisor ${pod.responsibleAdvisorRoleInstanceId ?? 'UNKNOWN'}`,
    `WorkUnit progress ${progressText}`,
    `${pod.alertSummary.openCount} open alerts`,
  ].join(', ');
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
