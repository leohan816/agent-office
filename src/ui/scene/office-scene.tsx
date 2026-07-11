import {
  Ban,
  BookOpenText,
  CheckCircle2,
  CircleAlert,
  CircleHelp,
  ClipboardCheck,
  FilePenLine,
  FileWarning,
  FlaskConical,
  Hammer,
  Inbox,
  Pause,
  Play,
  RefreshCcw,
  RotateCcw,
  Route,
  Send,
  ShieldAlert,
  TimerReset,
} from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react';

import { SCENE_FIXTURES, getSceneFixture } from './fixtures.js';
import {
  acknowledgeSceneCue,
  applySceneBurst,
  clearSceneCues,
  initializeScene,
} from './state-machine.js';
import {
  OFFICE_STATIONS,
  type OfficeStationDefinition,
  type OfficeStationId,
  type SceneMotionCue,
  type SceneRoleVisual,
  type SceneStateName,
} from './types.js';
import {
  ActorAsset,
  BarrierAsset,
  DeskAsset,
  DocumentAsset,
  ToolAsset,
  WarningAsset,
} from './assets/scene-assets.js';

const STATIONS_PER_MOBILE_PAGE = 2;
const MOBILE_PAGE_COUNT = Math.ceil(OFFICE_STATIONS.length / STATIONS_PER_MOBILE_PAGE);

export interface OfficeSceneProps {
  readonly initialFixtureId?: string;
}

export function OfficeScene({ initialFixtureId = 'current' }: OfficeSceneProps) {
  const initialFixture = getSceneFixture(initialFixtureId);
  const [fixtureId, setFixtureId] = useState(initialFixture.id);
  const [runtime, setRuntime] = useState(() => initializeScene(initialFixture.roles));
  const [motionEnabled, setMotionEnabled] = useState(readMotionPreference);
  const [paused, setPaused] = useState(false);
  const [mobilePage, setMobilePage] = useState(MOBILE_PAGE_COUNT - 1);
  const [focusedStation, setFocusedStation] = useState<OfficeStationId>('leo');
  const [selectedStation, setSelectedStation] = useState<OfficeStationId>('agent-office');
  const [ordinaryAnnouncement, setOrdinaryAnnouncement] = useState('');
  const [criticalAnnouncement, setCriticalAnnouncement] = useState('');
  const [activityLog, setActivityLog] = useState<readonly string[]>([
    `${initialFixture.labelKo}: 초기 탐색에서는 동작을 재생하지 않음`,
  ]);
  const currentFixture = useMemo(() => getSceneFixture(fixtureId), [fixtureId]);
  const selected = runtime.roles[selectedStation];
  const leoDecisionWaiting = Object.values(runtime.roles).some(
    (role) => role.stateName === 'WAITING_LEO' && role.decision?.destinationStationId === 'leo',
  );

  useEffect(() => {
    try {
      window.localStorage.setItem('agent-office-motion-enabled', String(motionEnabled));
    } catch {
      // A denied preference store never changes scene or domain state.
    }
  }, [motionEnabled]);

  useEffect(() => {
    const onVisibilityChange = (): void => {
      const hidden = document.visibilityState === 'hidden';
      setPaused(hidden);
      if (!hidden) {
        setRuntime((current) => applySceneBurst(current, currentFixture.roles, 'TAB_RESUME'));
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [currentFixture.roles]);

  const selectFixture = (nextId: string): void => {
    const fixture = getSceneFixture(nextId);
    setFixtureId(fixture.id);
    setRuntime((current) => applySceneBurst(current, fixture.roles, 'LIVE'));
    const selectedIndex = OFFICE_STATIONS.findIndex((station) => station.id === selectedStation);
    setMobilePage(Math.floor(selectedIndex / STATIONS_PER_MOBILE_PAGE));
    setOrdinaryAnnouncement(`${fixture.labelKo} 구조화 이벤트 장면으로 변경됨`);
    const critical = fixture.roles.find(
      (role) => role.openAlertSeverity === 'CRITICAL' || role.workUnitState === 'BLOCKED',
    );
    setCriticalAnnouncement(
      critical === undefined ? '' : `${critical.actorRole}: 차단 또는 중요 경고가 즉시 표시됨`,
    );
    setActivityLog((entries) => [
      `${fixture.labelKo}: accepted event ID 기반 장면 갱신`,
      ...entries,
    ].slice(0, 8));
  };

  const changeMotion = (): void => {
    setMotionEnabled((enabled) => !enabled);
    setRuntime((current) => clearSceneCues(current));
    setOrdinaryAnnouncement(motionEnabled ? '장면 동작이 꺼짐' : '장면 동작이 켜짐');
  };

  const acknowledgeCue = (eventId: string): void => {
    setRuntime((current) => acknowledgeSceneCue(current, eventId));
  };

  const focusStation = (stationId: OfficeStationId): void => {
    const index = OFFICE_STATIONS.findIndex((station) => station.id === stationId);
    setFocusedStation(stationId);
    setSelectedStation(stationId);
    setMobilePage(Math.floor(index / STATIONS_PER_MOBILE_PAGE));
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-scene-station="${stationId}"]`)?.focus();
    });
  };

  const handleStationKey = (event: KeyboardEvent<HTMLButtonElement>, stationId: OfficeStationId): void => {
    const currentIndex = OFFICE_STATIONS.findIndex((station) => station.id === stationId);
    let nextIndex: number | undefined;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + OFFICE_STATIONS.length) % OFFICE_STATIONS.length;
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % OFFICE_STATIONS.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = OFFICE_STATIONS.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const next = OFFICE_STATIONS[nextIndex];
    if (next !== undefined) focusStation(next.id);
  };

  return (
    <section
      className={`office-scene${paused ? ' scene-paused' : ''}`}
      data-motion={motionEnabled ? 'on' : 'off'}
      id="office-scene"
      aria-labelledby="office-scene-heading"
    >
      <div className="scene-heading-row">
        <div className="scene-heading-copy">
          <p className="eyebrow">STRUCTURED EVENT OFFICE / READ ONLY</p>
          <h2 id="office-scene-heading">Agent Office</h2>
          <p>{currentFixture.descriptionKo}</p>
        </div>
        <div className="scene-controls" aria-label="장면 표시 제어">
          <label className="scene-fixture-control">
            <Route aria-hidden="true" size={17} />
            <span>장면</span>
            <select
              aria-label="구조화 이벤트 장면"
              value={fixtureId}
              onChange={(event) => {
                selectFixture(event.target.value);
              }}
            >
              {SCENE_FIXTURES.map((fixture) => (
                <option key={fixture.id} value={fixture.id}>{fixture.labelKo}</option>
              ))}
            </select>
          </label>
          <button
            className="scene-control-button"
            type="button"
            aria-pressed={!motionEnabled}
            onClick={changeMotion}
          >
            {motionEnabled ? <Pause aria-hidden="true" size={17} /> : <Play aria-hidden="true" size={17} />}
            {motionEnabled ? '동작 끄기' : '동작 켜기'}
          </button>
        </div>
      </div>

      <div className="scene-mobile-pagination" aria-label="모바일 역할 페이지">
        <button
          type="button"
          disabled={mobilePage === 0}
          onClick={() => {
            setMobilePage((page) => Math.max(0, page - 1));
          }}
        >
          이전
        </button>
        <span aria-live="polite">{mobilePage + 1} / {MOBILE_PAGE_COUNT}</span>
        <button
          type="button"
          disabled={mobilePage === MOBILE_PAGE_COUNT - 1}
          onClick={() => {
            setMobilePage((page) => Math.min(MOBILE_PAGE_COUNT - 1, page + 1));
          }}
        >
          다음
        </button>
      </div>

      <div className="office-floor" role="list" aria-label="고정 역할 스테이션">
        <div className="office-grid-lines" aria-hidden="true" />
        {OFFICE_STATIONS.map((station, index) => {
          const visual = runtime.roles[station.id];
          const cue = runtime.pendingCues.find((candidate) => candidate.stationId === station.id);
          const page = Math.floor(index / STATIONS_PER_MOBILE_PAGE);
          return (
            <Station
              key={station.id}
              station={station}
              visual={visual}
              {...(cue === undefined ? {} : { cue })}
              focused={focusedStation === station.id}
              selected={selectedStation === station.id}
              mobilePageVisible={page === mobilePage}
              decisionDestination={station.id === 'leo' && leoDecisionWaiting}
              onSelect={focusStation}
              onKeyDown={handleStationKey}
              onCueEnd={acknowledgeCue}
            />
          );
        })}
        <SceneRoutes cues={runtime.pendingCues} onCueEnd={acknowledgeCue} />
      </div>

      <div className="scene-selected-detail" aria-label="선택한 역할의 구조화 상태">
        <span className={`scene-state-shape shape-${stateShape(selected.stateName)}`} aria-hidden="true" />
        <strong>{selected.actorRole}</strong>
        <span>{selected.stateLabelKo}</span>
        <span className="mono">{selected.detail}</span>
        <span className="mono">event: {selected.sourceEventIds.at(-1) ?? 'none'}</span>
      </div>

      <details className="scene-activity-log">
        <summary>접근 가능한 장면 변경 기록</summary>
        <ol>
          {activityLog.map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}
        </ol>
      </details>

      <ul className="sr-only" aria-label="모든 역할의 현재 구조화 상태">
        {OFFICE_STATIONS.map((station) => {
          const visual = runtime.roles[station.id];
          return <li key={station.id}>{visual.actorRole}: {visual.stateLabelKo}. {visual.detail}</li>;
        })}
      </ul>
      <div className="sr-only" aria-live="polite" aria-atomic="true">{ordinaryAnnouncement}</div>
      <div className="sr-only" role="alert" aria-atomic="true">{criticalAnnouncement}</div>
    </section>
  );
}

function Station({
  station,
  visual,
  cue,
  focused,
  selected,
  mobilePageVisible,
  decisionDestination,
  onSelect,
  onKeyDown,
  onCueEnd,
}: {
  readonly station: OfficeStationDefinition;
  readonly visual: SceneRoleVisual;
  readonly cue?: SceneMotionCue;
  readonly focused: boolean;
  readonly selected: boolean;
  readonly mobilePageVisible: boolean;
  readonly decisionDestination: boolean;
  readonly onSelect: (stationId: OfficeStationId) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, stationId: OfficeStationId) => void;
  readonly onCueEnd: (eventId: string) => void;
}) {
  const localCue = cue !== undefined && !isRouteCue(cue.kind) ? cue : undefined;
  return (
    <article
      className={`scene-station${mobilePageVisible ? ' is-mobile-page' : ''}${selected ? ' is-selected' : ''}`}
      data-state={visual.stateName}
      data-freshness={visual.freshness}
      data-alert={visual.alertSeverity}
      data-cue={cue?.kind ?? 'NONE'}
      data-station-id={station.id}
      role="listitem"
    >
      <button
        className="scene-station-button"
        type="button"
        data-scene-station={station.id}
        aria-pressed={selected}
        tabIndex={focused ? 0 : -1}
        onClick={() => {
          onSelect(station.id);
        }}
        onKeyDown={(event) => {
          onKeyDown(event, station.id);
        }}
      >
        <span className="station-heading">
          <span>
            <strong>{visual.actorRole}</strong>
            <small>{station.label}</small>
          </span>
          <StateIcon state={visual.stateName} />
        </span>
        <span className="station-visual" aria-hidden="true">
          <ActorAsset className="scene-actor" stateName={visual.stateName} />
          <DeskAsset className="scene-desk" />
          <ToolAsset className="scene-tool" />
          {usesDocument(visual.stateName) || decisionDestination ? (
            <DocumentAsset
              className="scene-document"
              kind={decisionDestination ? 'decision' : documentKind(visual.stateName)}
            />
          ) : null}
          {visual.stateName === 'BLOCKED' ? <BarrierAsset className="scene-barrier" /> : null}
          {visual.alertSeverity === 'CRITICAL' ? <WarningAsset className="scene-warning" /> : null}
          {localCue === undefined ? null : (
            <span
              className={`scene-cue-anchor cue-${localCue.kind.toLowerCase()}`}
              data-motion-cue={localCue.kind}
              onAnimationEnd={() => {
                onCueEnd(localCue.eventId);
              }}
            />
          )}
        </span>
        <span className="station-status">
          <span className={`scene-state-shape shape-${stateShape(visual.stateName)}`} aria-hidden="true" />
          <strong>{visual.stateLabelKo}</strong>
          <span className="mono">{visual.workUnitId ?? 'NO_WORKUNIT'}</span>
        </span>
        <span className="station-detail mono">
          {decisionDestination ? 'LEO_DECISION_DOCUMENT_RECEIVED' : visual.detail}
        </span>
        {visual.lastAcceptedStateName === undefined ? null : (
          <span className="station-stale-detail">마지막 승인 상태: {visual.lastAcceptedStateName}</span>
        )}
      </button>
    </article>
  );
}

function SceneRoutes({ cues, onCueEnd }: { readonly cues: readonly SceneMotionCue[]; readonly onCueEnd: (eventId: string) => void }) {
  return (
    <div className="scene-route-layer" aria-hidden="true">
      {cues.filter((cue) => isRouteCue(cue.kind)).map((cue) => {
        const target = cue.targetStationId;
        if (target === undefined) return null;
        return (
          <span
            className={`scene-route-document route-${cue.kind.toLowerCase()}`}
            data-route-cue={cue.kind}
            key={cue.eventId}
            style={routeStyle(cue.sourceStationId, target)}
            onAnimationEnd={() => {
              onCueEnd(cue.eventId);
            }}
          >
            <ActorAsset className="scene-route-actor" stateName={routeActorState(cue.kind)} />
            <DocumentAsset
              className="scene-route-paper"
              kind={
                cue.kind === 'RESULT_RETURN'
                  ? 'result'
                  : cue.kind === 'PATCH_RETURN'
                    ? 'patch'
                    : cue.kind === 'WAITING_LEO'
                      ? 'decision'
                      : 'work'
              }
            />
          </span>
        );
      })}
    </div>
  );
}

function StateIcon({ state }: { readonly state: SceneStateName }) {
  const props = { 'aria-hidden': true, size: 17, strokeWidth: 1.9 } as const;
  switch (state) {
    case 'DISPATCHING':
      return <Send {...props} />;
    case 'READING':
      return <BookOpenText {...props} />;
    case 'WORKING':
      return <Hammer {...props} />;
    case 'TESTING':
      return <FlaskConical {...props} />;
    case 'WRITING_RESULT':
      return <FilePenLine {...props} />;
    case 'RETURNING_RESULT':
      return <Inbox {...props} />;
    case 'REVIEWING':
      return <ClipboardCheck {...props} />;
    case 'NEEDS_PATCH':
      return <RotateCcw {...props} />;
    case 'BLOCKED':
    case 'FAILED':
      return <ShieldAlert {...props} />;
    case 'WAITING_LEO':
      return <FileWarning {...props} />;
    case 'RECOVERY':
      return <RefreshCcw {...props} />;
    case 'COMPLETED':
      return <CheckCircle2 {...props} />;
    case 'CANCELLED':
      return <Ban {...props} />;
    case 'WAITING_DEPENDENCY':
    case 'WAITING_ADVISOR':
    case 'HOLD':
      return <TimerReset {...props} />;
    case 'UNKNOWN_OR_STALE':
      return <CircleHelp {...props} />;
    case 'IDLE':
    case 'QUEUED':
    case 'READY':
      return <CircleAlert {...props} />;
  }
}

function usesDocument(state: SceneStateName): boolean {
  return ['DISPATCHING', 'READING', 'TESTING', 'WRITING_RESULT', 'RETURNING_RESULT', 'REVIEWING', 'WAITING_LEO', 'NEEDS_PATCH'].includes(state);
}

function documentKind(state: SceneStateName): 'work' | 'result' | 'decision' | 'patch' {
  if (state === 'RETURNING_RESULT' || state === 'WRITING_RESULT') return 'result';
  if (state === 'WAITING_LEO') return 'decision';
  if (state === 'NEEDS_PATCH') return 'patch';
  return 'work';
}

function stateShape(state: SceneStateName): 'circle' | 'diamond' | 'square' | 'octagon' {
  if (state === 'BLOCKED' || state === 'FAILED') return 'octagon';
  if (state === 'WAITING_LEO' || state === 'NEEDS_PATCH' || state === 'HOLD') return 'diamond';
  if (state === 'UNKNOWN_OR_STALE' || state === 'RECOVERY') return 'square';
  return 'circle';
}

function isRouteCue(kind: SceneMotionCue['kind']): boolean {
  return kind === 'DELIVERY' || kind === 'RESULT_RETURN' || kind === 'PATCH_RETURN' || kind === 'WAITING_LEO';
}

function routeActorState(kind: SceneMotionCue['kind']): SceneStateName {
  if (kind === 'DELIVERY') return 'DISPATCHING';
  if (kind === 'RESULT_RETURN') return 'RETURNING_RESULT';
  if (kind === 'PATCH_RETURN') return 'NEEDS_PATCH';
  return 'WAITING_LEO';
}

function routeStyle(sourceId: OfficeStationId, targetId: OfficeStationId): CSSProperties {
  const source = OFFICE_STATIONS.find((station) => station.id === sourceId);
  const target = OFFICE_STATIONS.find((station) => station.id === targetId);
  if (source === undefined || target === undefined) return {};
  return {
    '--route-from-x': `calc(${(source.column + 0.5) * 25}% - 36px)`,
    '--route-from-y': `calc(${(source.row + 0.5) * 50}% - 35px)`,
    '--route-to-x': `calc(${(target.column + 0.5) * 25}% - 36px)`,
    '--route-to-y': `calc(${(target.row + 0.5) * 50}% - 35px)`,
  } as CSSProperties;
}

function readMotionPreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem('agent-office-motion-enabled');
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch {
    // Fall through to the operating-system preference.
  }
  return typeof window.matchMedia !== 'function' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
