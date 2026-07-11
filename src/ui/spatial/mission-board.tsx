import type {
  SpatialDisplayFact,
  SpatialEvidenceFact,
  SpatialMissionBoard as SpatialMissionBoardModel,
  SpatialProgressFact,
} from '../../application/spatial-office/types.js';

export interface MissionBoardProps {
  readonly board: SpatialMissionBoardModel | null;
  readonly manifestVersion: string | null;
  readonly projectionRevision: number;
}

export function MissionBoard({ board, manifestVersion, projectionRevision }: MissionBoardProps) {
  if (board === null) {
    return (
      <section className="spatial-mission-board spatial-mission-board-empty" id="spatial-mission-board" aria-labelledby="spatial-mission-heading">
        <header>
          <p className="eyebrow">MISSION BOARD / STATIC</p>
          <h3 id="spatial-mission-heading">NO_VERIFIED_MISSION</h3>
        </header>
        <p>Canonical verified mission evidence is unavailable. No active mission is inferred.</p>
      </section>
    );
  }

  const rows: readonly { readonly label: string; readonly value: SpatialDisplayFact }[] = [
    { label: 'Advisor Team', value: board.teamName },
    { label: 'Project', value: board.projectName },
    { label: 'Responsible Advisor', value: board.responsibleAdvisor },
    { label: 'Registered Advisor display identity', value: board.responsibleAdvisorDisplayIdentity },
    { label: 'Current mission', value: board.currentMission },
    { label: 'Current Phase / WorkUnit', value: board.currentPhaseOrWorkUnit },
    { label: 'Registered current actor display identity', value: board.currentActorDisplayIdentity },
    { label: 'Assigned independent Reviewer', value: board.assignedReviewer },
    { label: 'Next actor / handoff', value: board.nextActorOrHandoff },
    { label: 'Exact blocker', value: board.blocker },
    { label: 'Leo/GPT decision state', value: board.leoGptDecisionState },
  ];

  return (
    <section
      aria-labelledby="spatial-mission-heading"
      className="spatial-mission-board"
      data-source-truth={board.sourceTruthState}
      id="spatial-mission-board"
    >
      <header className="spatial-mission-board__header">
        <div>
          <p className="eyebrow">SELECTED MISSION BOARD / STATIC</p>
          <h3 id="spatial-mission-heading">{displayFact(board.currentMission)}</h3>
        </div>
        <div className="spatial-mission-board__meta">
          <span className="mono">{board.missionRef.projectId} / {board.missionRef.missionId}</span>
          <span>manifest {manifestVersion ?? 'UNKNOWN'}</span>
          <span>projection #{projectionRevision}</span>
          <span>source {board.sourceTruthState}</span>
        </div>
      </header>
      <dl className="spatial-mission-board__facts">
        {rows.map((row) => (
          <FactRow key={row.label} label={row.label} value={row.value} />
        ))}
        <ProgressRow label="WorkUnit progress" value={board.workUnitProgress} />
        <ProgressRow label="Required gate progress" value={board.requiredGateProgress} />
        <EvidenceRow label="Latest verified evidence" value={board.latestVerifiedEvidence} />
      </dl>
      <nav aria-label="Selected mission evidence destinations" className="spatial-mission-board__links">
        <a href="#spatial-evidence">Evidence</a>
        <a href="#spatial-alerts">Alerts</a>
        <a href="#spatial-floor-list">Actor and zone state list</a>
      </nav>
      <p className="spatial-mission-board__boundary">
        Redacted registered display facts only. No raw pane, session locator, path, credential,
        private target, terminal prose, or inferred value is present.
      </p>
    </section>
  );
}

function FactRow({ label, value }: { readonly label: string; readonly value: SpatialDisplayFact }) {
  return (
    <div data-truth-state={value.state}>
      <dt>{label}</dt>
      <dd>{displayFact(value)}</dd>
    </div>
  );
}

function ProgressRow({ label, value }: { readonly label: string; readonly value: SpatialProgressFact }) {
  const content = value.state === 'KNOWN' && value.completed !== null && value.total !== null
    ? `${value.completed} / ${value.total}`
    : value.state;
  return (
    <div data-truth-state={value.state}>
      <dt>{label}</dt>
      <dd>{content}</dd>
    </div>
  );
}

function EvidenceRow({ label, value }: { readonly label: string; readonly value: SpatialEvidenceFact }) {
  const content = value.state === 'KNOWN' && value.verifiedAt !== null && value.evidenceRef !== null
    ? `${value.verifiedAt} / ${value.evidenceRef}`
    : value.state;
  return (
    <div data-truth-state={value.state}>
      <dt>{label}</dt>
      <dd className="mono">{content}</dd>
    </div>
  );
}

function displayFact(value: SpatialDisplayFact): string {
  return value.value ?? value.state;
}
