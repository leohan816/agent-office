import type { KeyboardEvent, Ref } from 'react';

import type {
  SpatialActorProjection,
  SpatialTeamPodProjection,
} from '../../application/spatial-office/types.js';
import { ProjectIdentityChip, SpatialCharacter } from './character.js';
import { FacilityPlaceholder } from './assets/placeholder-characters.js';
import { MissionBoard } from './mission-board.js';
import type { ProjectIdentity } from './project-identity.js';

export interface TeamPodProps {
  readonly pod: SpatialTeamPodProjection;
  readonly identity: ProjectIdentity;
  readonly selected: boolean;
  readonly projectionRevision: number;
  readonly actors: readonly SpatialActorProjection[];
  readonly actorTabIndex: (roleInstanceId: string) => number;
  readonly actorControlRef: (roleInstanceId: string) => Ref<HTMLButtonElement>;
  readonly onActorKeyDown: (event: KeyboardEvent<HTMLButtonElement>, roleInstanceId: string) => void;
  readonly onInspectActor: (actor: SpatialActorProjection) => void;
}

export function TeamPod({
  pod,
  identity,
  selected,
  projectionRevision,
  actors,
  actorTabIndex,
  actorControlRef,
  onActorKeyDown,
  onInspectActor,
}: TeamPodProps) {
  const manifestVersion = selectedMissionManifestVersion(pod);
  return (
    <article
      aria-labelledby={`${pod.podId}-heading`}
      className="spatial-team-pod"
      data-project-id={pod.projectId}
      data-recognizable-office-area={pod.recognizableOfficeArea}
      data-selected={selected}
      id={pod.podId}
    >
      <header className="spatial-team-pod__header" data-zone="pod-header">
        <div className="spatial-team-pod__title">
          <p className="eyebrow">ADVISOR TEAM POD / {selected ? 'SELECTED DETAIL' : 'VISIBLE SUMMARY'}</p>
          <h2 id={`${pod.podId}-heading`}>{pod.advisorTeamId}</h2>
          <p>{pod.displayName} / one shared floor</p>
        </div>
        <ProjectIdentityChip
          authority={pod.authorityStatus}
          freshness={pod.evidenceFreshness}
          identity={identity}
          severity={pod.alertSummary.severity}
        />
        <dl className="spatial-team-pod__summary">
          <SummaryFact label="Responsible Advisor" value={displayFact(pod.responsibleAdvisorDisplayIdentity.state, pod.responsibleAdvisorDisplayIdentity.value)} />
          <SummaryFact label="Main mission" value={displayFact(pod.currentMainMission.state, pod.currentMainMission.value)} />
          <SummaryFact label="Current actor" value={displayFact(pod.currentActor.state, pod.currentActor.value)} />
          <SummaryFact label="Operational state" value={pod.operationalState} />
          <SummaryFact label="Gate / blocker" value={displayFact(pod.gateBlockerSummary.state, pod.gateBlockerSummary.value)} />
          <SummaryFact label="Freshness / connection" value={`${pod.evidenceFreshness} / ${pod.connectionState}`} />
        </dl>
      </header>

      <div className="spatial-team-pod__office" aria-label={`${pod.advisorTeamId} static office area`}>
        <section className="spatial-zone spatial-zone-work" data-zone="work" aria-labelledby={`${pod.podId}-work-heading`}>
          <div className="spatial-zone__label">
            <span>WORK ZONE</span>
            <strong id={`${pod.podId}-work-heading`}>Verified assignments</strong>
          </div>
          <FacilityPlaceholder kind="WOOD_DESK" />
          <div className="spatial-character-grid">
            {actors.length === 0 ? (
              <p className="spatial-zone__empty">ASSIGNMENT_UNKNOWN / no character inferred</p>
            ) : actors.map((actor) => (
              <SpatialCharacter
                actor={actor}
                controlRef={actorControlRef(actor.roleInstanceId)}
                key={actor.roleInstanceId}
                onInspect={onInspectActor}
                onKeyDown={(event) => {
                  onActorKeyDown(event, actor.roleInstanceId);
                }}
                projectIdentity={identity}
                tabIndex={actorTabIndex(actor.roleInstanceId)}
              />
            ))}
          </div>
        </section>

        {selected ? (
          <>
            <section className="spatial-zone spatial-zone-testing" data-zone="testing-bench">
              <span>TESTING BENCH / STATIC</span>
              <p>Accepted TESTING evidence would be required for a future cue. No pass is claimed.</p>
            </section>
            <section className="spatial-zone spatial-zone-result" data-zone="result-desk">
              <span>RESULT DESK / STATIC</span>
              <p>Writing and result-return remain distinct evidence-backed states.</p>
            </section>
            <section className="spatial-zone spatial-zone-review" data-zone="independent-review-desk">
              <FacilityPlaceholder kind="REVIEWER_BOOTH" />
              <span>INDEPENDENT REVIEWER BOOTH</span>
              <p>{displayFact(pod.missionBoardSummary?.assignedReviewer.state ?? 'UNKNOWN', pod.missionBoardSummary?.assignedReviewer.value ?? null)}</p>
            </section>
            <section className="spatial-zone spatial-zone-advisor" data-zone="advisor-anchor">
              <FacilityPlaceholder kind="ADVISOR_HUB" />
              <span>ADVISOR HUB REFERENCE</span>
              <p className="mono">{pod.responsibleAdvisorRoleInstanceId ?? 'ADVISOR_RESPONSIBILITY_UNKNOWN'}</p>
              <p>Visual endpoint only; proximity grants no authority.</p>
            </section>
            <section className="spatial-zone spatial-zone-leo" data-zone="leo-decision-destination">
              <span>LEO/GPT DECISION DESTINATION</span>
              <p>Decision-document endpoint only; never dispatch or general messaging.</p>
            </section>
            <section className="spatial-zone spatial-zone-evidence" data-zone="evidence-cabinet">
              <span>EVIDENCE CABINET</span>
              <p>{pod.evidenceSummary.verifiedCount} verified reference(s)</p>
              <p className="mono">{pod.evidenceSummary.latest.evidenceRef ?? pod.evidenceSummary.latest.state}</p>
            </section>
            <section className="spatial-zone spatial-zone-lounge" data-zone="lounge">
              <FacilityPlaceholder kind="COFFEE_LOUNGE" />
              <span>LOUNGE / STATIC</span>
              <p>No availability, collaboration, communication, approval, or ambient behavior is inferred.</p>
            </section>
            <section className="spatial-zone spatial-zone-path" data-zone="shared-path">
              <FacilityPlaceholder kind="SHARED_PATH" />
              <span>SHARED PATH / STATIC</span>
            </section>
          </>
        ) : null}
      </div>

      {selected ? (
        <MissionBoard
          board={pod.missionBoardSummary}
          manifestVersion={manifestVersion}
          projectionRevision={projectionRevision}
        />
      ) : (
        <section className="spatial-team-pod__compact-board" aria-label={`${pod.advisorTeamId} mission board summary`}>
          <FacilityPlaceholder kind="MISSION_BOARD" />
          <div>
            <strong>{displayFact(pod.currentMainMission.state, pod.currentMainMission.value)}</strong>
            <span>manifest {manifestVersion ?? 'UNKNOWN'}</span>
            <span>WorkUnit {progress(pod.missionSummaries[0]?.workUnitProgress)}</span>
            <span>Gate {progress(pod.missionSummaries[0]?.gateProgress)}</span>
          </div>
        </section>
      )}
    </article>
  );
}

function SummaryFact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function selectedMissionManifestVersion(pod: SpatialTeamPodProjection): string | null {
  const selected = pod.selectedMissionRef;
  if (selected === null) return pod.missionSummaries[0]?.manifestVersion ?? null;
  return pod.missionSummaries.find((mission) =>
    mission.missionRef.projectId === selected.projectId
    && mission.missionRef.missionId === selected.missionId)?.manifestVersion ?? null;
}

function displayFact(state: string, value: string | null): string {
  return value ?? state;
}

function progress(value: SpatialTeamPodProjection['missionSummaries'][number]['workUnitProgress'] | undefined): string {
  if (value === undefined) return 'UNKNOWN';
  if (value.completed === null || value.total === null) return value.state;
  return `${value.completed} / ${value.total}`;
}
