import {
  AlertTriangle,
  Building2,
  Check,
  Clipboard,
  FileCheck2,
  Filter,
  GitCommitHorizontal,
  ShieldCheck,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import type {
  DashboardEvidenceInput,
  DashboardViewModel,
  DashboardWorkUnitViewModel,
} from '../application/queries/dashboard-view-model.js';
import { OfficeScene } from './scene/office-scene.js';

type FilterValue = 'ALL' | 'ATTENTION' | 'WAITING' | 'COMPLETED';

export interface DashboardProps {
  readonly model: DashboardViewModel;
}

export function Dashboard({ model }: DashboardProps) {
  const [filter, setFilter] = useState<FilterValue>('ALL');
  const firstAttention = model.workUnits.find((workUnit) => workUnit.blocker !== undefined);
  const [selectedId, setSelectedId] = useState(firstAttention?.id ?? model.workUnits[0]?.id ?? '');
  const visibleWorkUnits = useMemo(
    () => model.workUnits.filter((workUnit) => matchesFilter(workUnit, filter)),
    [filter, model.workUnits],
  );
  const selected = model.workUnits.find((workUnit) => workUnit.id === selectedId);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#office-scene">
        오피스로 건너뛰기
      </a>
      <a className="skip-link skip-link-operations" href="#operations-table">
        운영 목록으로 건너뛰기
      </a>
      <header className="topbar">
        <div className="brand-lockup">
          <Building2 aria-hidden="true" size={24} strokeWidth={1.8} />
          <div>
            <p className="eyebrow">AGENT OFFICE / M01</p>
            <h1>운영 대시보드</h1>
          </div>
        </div>
        <div className="topbar-status" aria-label="대시보드 권한 상태">
          <span className="status-token status-current">
            <ShieldCheck aria-hidden="true" size={16} /> 읽기 전용
          </span>
          <span className="status-token">LOCAL FIXTURE</span>
          <span className="status-token">projection #{model.projectionSequence}</span>
        </div>
      </header>

      {model.banners.length > 0 ? (
        <section className="banner-stack" aria-label="관측 상태 경고">
          {model.banners.map((banner) => (
            <div className={`status-banner status-${banner.presentation.toLowerCase()}`} key={banner.presentation}>
              <AlertTriangle aria-hidden="true" size={18} />
              <strong>{banner.labelKo}</strong>
              <span className="mono">{banner.reasonCodes.join(', ')}</span>
            </div>
          ))}
        </section>
      ) : null}

      <OfficeScene />

      <div className="dashboard-grid">
        <aside className="hierarchy-panel" aria-labelledby="hierarchy-heading">
          <div className="section-heading">
            <p className="eyebrow">MISSION SCOPE</p>
            <h2 id="hierarchy-heading">작업 계층</h2>
          </div>
          <ol className="hierarchy-list">
            <HierarchyItem
              label={model.hierarchyLabelsKo.initiative}
              primary={model.initiative.labelKo}
              secondary={model.initiative.id}
            />
            <HierarchyItem
              label={model.hierarchyLabelsKo.package}
              primary={model.package.labelKo}
              secondary={model.package.id}
            />
            <HierarchyItem
              label={model.hierarchyLabelsKo.mission}
              primary={model.missionId}
              secondary={`manifest v${model.manifestVersion}`}
            />
            <li className="hierarchy-item">
              <span className="hierarchy-label">{model.hierarchyLabelsKo.phase}</span>
              <span className="hierarchy-primary">{model.phases.length}개 선언</span>
              <div className="phase-tree">
                {model.phases.map((phase) => (
                  <details key={phase.id} open={phase.workUnitIds.includes(selectedId)}>
                    <summary className="mono">{phase.id}</summary>
                    <ul>
                      {phase.workUnitIds.map((workUnitId) => (
                        <li key={workUnitId}>
                          <button
                            className={workUnitId === selectedId ? 'tree-button tree-button-selected' : 'tree-button'}
                            type="button"
                            onClick={() => {
                              setSelectedId(workUnitId);
                            }}
                          >
                            {workUnitId}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </li>
            <HierarchyItem
              label={model.hierarchyLabelsKo.workUnit}
              primary={`${model.workUnits.length}개 선언`}
              secondary="승인된 분모만 포함"
            />
          </ol>
        </aside>

        <main className="operations-column">
          <section className="progress-section" aria-labelledby="progress-heading">
            <div className="section-heading section-heading-inline">
              <div>
                <p className="eyebrow">DECLARED PROGRESS</p>
                <h2 id="progress-heading">근거 기반 진행</h2>
              </div>
              <span className="fixture-badge">
                {model.fixtureKind === 'CURRENT_APPROVED_SOURCE' ? '승인 소스 스냅샷' : '합성 검토 픽스처'}
              </span>
            </div>
            <div className="progress-grid">
              <ProgressMetric
                label={model.workUnitProgress.labelKo}
                value={model.workUnitProgress.completed}
                denominator={model.workUnitProgress.denominator}
                detail={`manifest v${model.workUnitProgress.manifestVersion}`}
              />
              <ProgressMetric
                label={model.requiredGateProgress.labelKo}
                value={model.requiredGateProgress.passed}
                denominator={model.requiredGateProgress.denominator}
                detail="required gates only"
              />
            </div>
            <details className="future-scope">
              <summary>미승인 미래 작업 · 진행 분모에서 제외</summary>
              <ul>
                {model.futureUnapprovedWork.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
          </section>

          <section className="operations-section" aria-labelledby="operations-heading">
            <div className="section-heading section-heading-inline">
              <div>
                <p className="eyebrow">WORK UNITS</p>
                <h2 id="operations-heading">현재 운영 목록</h2>
              </div>
              <label className="filter-control">
                <Filter aria-hidden="true" size={16} />
                <span>필터</span>
                <select
                  value={filter}
                  onChange={(event) => {
                    setFilter(event.target.value as FilterValue);
                  }}
                >
                  <option value="ALL">전체</option>
                  <option value="ATTENTION">확인 필요</option>
                  <option value="WAITING">대기/보류</option>
                  <option value="COMPLETED">완료</option>
                </select>
              </label>
            </div>
            <div className="table-scroller" role="region" aria-label="세부 작업 표 가로 스크롤" tabIndex={0}>
              <table id="operations-table">
                <thead>
                  <tr>
                    <th scope="col">세부 작업</th>
                    <th scope="col">상태</th>
                    <th scope="col">단계 / 담당</th>
                    <th scope="col">선행 작업</th>
                    <th scope="col">신선도 / 활동</th>
                    <th scope="col">차단 사유 / 다음 조치</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleWorkUnits.map((workUnit) => (
                    <WorkUnitRow
                      key={workUnit.id}
                      workUnit={workUnit}
                      selected={workUnit.id === selectedId}
                      onSelect={setSelectedId}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {visibleWorkUnits.length === 0 ? <p className="empty-state">이 필터에 해당하는 세부 작업이 없습니다.</p> : null}
          </section>

          <section className="detail-section" aria-labelledby="detail-heading">
            <div className="section-heading">
              <p className="eyebrow">SELECTED DETAIL</p>
              <h2 id="detail-heading">차단 및 상태 상세</h2>
            </div>
            {selected === undefined ? (
              <p className="empty-state">선택된 세부 작업이 없습니다.</p>
            ) : (
              <SelectedDetail workUnit={selected} />
            )}
          </section>
        </main>

        <aside className="evidence-panel" aria-labelledby="evidence-heading">
          <div className="section-heading">
            <p className="eyebrow">VERIFIED REFERENCES</p>
            <h2 id="evidence-heading">증거</h2>
          </div>
          <div className="evidence-list">
            {model.evidence.map((evidence) => (
              <EvidenceRecord key={evidence.evidenceId} evidence={evidence} />
            ))}
          </div>
          <div className="gate-list" aria-label="필수 게이트 상태">
            <h3>필수 게이트</h3>
            <ul>
              {model.requiredGateProgress.gates.map((gate) => (
                <li key={gate.gateId}>
                  <span>{gate.label}</span>
                  <span className={`gate-state gate-${gate.status.toLowerCase()}`}>{gate.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function HierarchyItem({ label, primary, secondary }: { readonly label: string; readonly primary: string; readonly secondary: string }) {
  return (
    <li className="hierarchy-item">
      <span className="hierarchy-label">{label}</span>
      <span className="hierarchy-primary">{primary}</span>
      <span className="hierarchy-secondary mono">{secondary}</span>
    </li>
  );
}

function ProgressMetric({
  label,
  value,
  denominator,
  detail,
}: {
  readonly label: string;
  readonly value: number;
  readonly denominator: number;
  readonly detail: string;
}) {
  return (
    <div className="progress-metric">
      <div className="progress-label-row">
        <span>{label}</span>
        <strong>{value} / {denominator}</strong>
      </div>
      <progress value={value} max={denominator} aria-label={`${label} ${value}/${denominator}`} />
      <span className="metric-detail mono">{detail}</span>
    </div>
  );
}

function WorkUnitRow({
  workUnit,
  selected,
  onSelect,
}: {
  readonly workUnit: DashboardWorkUnitViewModel;
  readonly selected: boolean;
  readonly onSelect: (id: string) => void;
}) {
  return (
    <tr className={selected ? 'selected-row' : undefined} data-state={workUnit.stateName}>
      <th scope="row">
        <button
          className="row-select"
          type="button"
          aria-pressed={selected}
          onClick={() => {
            onSelect(workUnit.id);
          }}
        >
          <span className="mono">{workUnit.id}</span>
          <span>{workUnit.title}</span>
        </button>
      </th>
      <td>
        <span className={`state-badge state-${workUnit.stateName.toLowerCase()}`}>{workUnit.stateLabelKo}</span>
        <span className="cell-code mono">{workUnit.stateName}</span>
      </td>
      <td>
        <span className="mono">{workUnit.phaseId}</span>
        <span className="cell-secondary">{workUnit.actor}</span>
      </td>
      <td className="mono">{workUnit.dependencies.length === 0 ? '없음' : workUnit.dependencies.join(', ')}</td>
      <td>
        <span className={`freshness freshness-${workUnit.freshness.toLowerCase()}`}>{workUnit.freshnessLabelKo}</span>
        <span className="cell-secondary mono">
          {workUnit.lastStructuredActivityAt ?? '구조화 활동 없음'}
        </span>
      </td>
      <td>
        {workUnit.blocker === undefined ? (
          <span className="cell-secondary">차단 없음</span>
        ) : (
          <>
            <span>{workUnit.blocker.reason}</span>
            <span className="cell-secondary mono">{workUnit.blocker.nextActionCode}</span>
          </>
        )}
      </td>
    </tr>
  );
}

function SelectedDetail({ workUnit }: { readonly workUnit: DashboardWorkUnitViewModel }) {
  return (
    <dl className="detail-grid">
      <DetailTerm label="세부 작업" value={`${workUnit.id} · ${workUnit.title}`} mono />
      <DetailTerm label="상태" value={`${workUnit.stateLabelKo} · ${workUnit.stateName}`} />
      <DetailTerm
        label="관측 신선도"
        value={`${workUnit.freshnessLabelKo} · ${workUnit.freshnessReasonCode}`}
        mono
      />
      {workUnit.blocker === undefined ? (
        <DetailTerm label="차단 상세" value="차단 없음" />
      ) : (
        <>
          <DetailTerm label="차단 사유" value={workUnit.blocker.reason} />
          <DetailTerm label="설명" value={workUnit.blocker.explanation} />
          <DetailTerm label="해결 담당" value={workUnit.blocker.resolutionOwnerLabelKo} />
          <DetailTerm label="다음 조치" value={workUnit.blocker.nextActionCode} mono />
        </>
      )}
    </dl>
  );
}

function DetailTerm({ label, value, mono = false }: { readonly label: string; readonly value: string; readonly mono?: boolean }) {
  return (
    <div className="detail-item">
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{value}</dd>
    </div>
  );
}

function EvidenceRecord({ evidence }: { readonly evidence: DashboardEvidenceInput }) {
  return (
    <article className="evidence-record">
      <div className="evidence-title">
        <FileCheck2 aria-hidden="true" size={18} />
        <div>
          <h3>{evidence.label}</h3>
          <span className={`verification verification-${evidence.verificationState.toLowerCase()}`}>
            {evidence.verificationState}
          </span>
        </div>
      </div>
      <EvidenceValue label="경로" value={evidence.relativePath} icon="path" />
      <EvidenceValue label="SHA-256" value={evidence.sha256} icon="hash" />
      <EvidenceValue label="커밋" value={evidence.commit} icon="commit" />
    </article>
  );
}

function EvidenceValue({
  label,
  value,
  icon,
}: {
  readonly label: string;
  readonly value: string;
  readonly icon: 'path' | 'hash' | 'commit';
}) {
  const [copied, setCopied] = useState(false);
  const copyValue = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="evidence-value">
      <span>{label}</span>
      <code className="mono">{value}</code>
      <button
        type="button"
        title={`${label} 복사`}
        aria-label={`${label} 복사`}
        onClick={() => {
          void copyValue();
        }}
      >
        {copied ? <Check aria-hidden="true" size={16} /> : icon === 'commit' ? (
          <GitCommitHorizontal aria-hidden="true" size={16} />
        ) : (
          <Clipboard aria-hidden="true" size={16} />
        )}
      </button>
    </div>
  );
}

function matchesFilter(workUnit: DashboardWorkUnitViewModel, filter: FilterValue): boolean {
  switch (filter) {
    case 'ALL':
      return true;
    case 'ATTENTION':
      return (
        workUnit.blocker !== undefined ||
        workUnit.freshness !== 'CURRENT' ||
        workUnit.stateName === 'UNKNOWN_OR_STALE'
      );
    case 'WAITING':
      return (
        workUnit.state.startsWith('WAITING_') ||
        workUnit.state === 'HOLD' ||
        workUnit.state === 'BLOCKED'
      );
    case 'COMPLETED':
      return workUnit.state === 'COMPLETED';
  }
}
