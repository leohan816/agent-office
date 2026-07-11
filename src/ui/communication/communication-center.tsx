import {
  AlertTriangle,
  Bell,
  Check,
  Clipboard,
  FileSearch,
  Inbox,
  MessageSquareReply,
  PauseCircle,
  Send,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { useMemo, useState, type ReactNode, type SyntheticEvent } from 'react';

import type { AlertActionCode } from '../../domain/alerts/index.js';
import { ADVISOR_MESSAGE_KINDS, type AdvisorMessageKind } from '../../domain/messages/index.js';
import {
  ADVISOR_MESSAGE_KIND_LABELS_KO,
  ALERT_ACTION_LABELS_KO,
  ALERT_KIND_LABELS_KO,
} from '../i18n/ko.js';
import type {
  CommunicationAlertView,
  CommunicationCenterActionPort,
  CommunicationCenterModel,
  CommunicationMessageView,
  CommunicationSubmissionState,
} from './types.js';

export interface CommunicationCenterProps {
  readonly model: CommunicationCenterModel;
  readonly actionPort?: CommunicationCenterActionPort;
}

export function CommunicationCenter({ model, actionPort }: CommunicationCenterProps) {
  const [panel, setPanel] = useState<'INBOX' | 'ALERTS'>('INBOX');
  const [kind, setKind] = useState<AdvisorMessageKind>('CLARIFICATION');
  const [missionId, setMissionId] = useState(model.missionOptions[0]?.id ?? '');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [references, setReferences] = useState<readonly string[]>([]);
  const [submission, setSubmission] = useState<CommunicationSubmissionState>({});
  const [announcement, setAnnouncement] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const criticalAlerts = model.alerts.filter(
    (alert) => alert.severity === 'CRITICAL' && alert.state !== 'RESOLVED',
  );

  const submit = async (event: SyntheticEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (actionPort === undefined || subject.trim().length === 0 || bodyText.trim().length === 0) return;
    setSubmitting(true);
    setSubmission({});
    try {
      const receipt = await actionPort.submitAdvisorMessage({
        requestId: model.draftRequestId,
        missionId,
        manifestVersion: model.manifestVersion,
        kind,
        subject,
        bodyText,
        referencedEntityIds: references,
        clientCreatedAt: model.draftCreatedAt,
      });
      setSubmission({ receipt });
      setAnnouncement('메시지가 영속 저장되었습니다. Advisor 확인 또는 접수를 의미하지 않습니다.');
    } catch (error) {
      const errorCode = readErrorCode(error);
      setSubmission({ errorCode });
      setAnnouncement(`메시지를 저장하지 못했습니다. ${errorCode}`);
    } finally {
      setSubmitting(false);
    }
  };

  const prepareDraft = (messageKind: AdvisorMessageKind, alert: CommunicationAlertView): void => {
    setKind(messageKind);
    setSubject(`[${alert.kind}] ${alert.title}`);
    setBodyText(`${alert.summary}\n\nSafe default: ${alert.detail.safeDefault}`);
    setReferences(
      model.allowlistedEntityIds.includes(alert.detail.workUnitId) ? [alert.detail.workUnitId] : [],
    );
    setPanel('INBOX');
    setAnnouncement('Advisor 전용 메시지 초안을 준비했습니다. 아직 저장하거나 전송하지 않았습니다.');
  };

  const actOnAlert = async (alert: CommunicationAlertView, action: AlertActionCode): Promise<void> => {
    if (action === 'COPY_GPT_PACKAGE') {
      if (alert.gptPackageMarkdown === undefined) return;
      await copyText(alert.gptPackageMarkdown);
      setAnnouncement('GPT 패키지를 복사했습니다. 승인, 확인, 해결 또는 실행으로 기록되지 않습니다.');
      return;
    }
    if (action === 'OPEN_EVIDENCE') {
      const evidenceRef = alert.detail.evidenceRefs[0];
      if (evidenceRef === undefined) return;
      if (actionPort === undefined) await copyText(evidenceRef);
      else await actionPort.openEvidence(evidenceRef);
      setAnnouncement('증거 참조를 열거나 복사했습니다. 경고 상태는 변경되지 않았습니다.');
      return;
    }
    if (action === 'HOLD') {
      setAnnouncement('안전 기본값 보류를 유지합니다. 미션 상태는 변경되지 않았습니다.');
      return;
    }
    const nextKind =
      action === 'PAUSE_MISSION' ? 'PAUSE' : action === 'CANCEL_MISSION' ? 'CANCEL' : 'CLARIFICATION';
    prepareDraft(nextKind, alert);
  };

  return (
    <section className="communication-center" aria-labelledby="communication-heading" id="communication-center">
      <div className="communication-heading-row">
        <div>
          <p className="eyebrow">ADVISOR COMMUNICATION</p>
          <h2 id="communication-heading">Advisor 전용 커뮤니케이션 센터</h2>
          <p className="communication-boundary">
            브라우저는 Advisor에게만 불변 메시지 참조를 제출합니다. 역할·세션·pane·명령 대상은 선택할 수 없습니다.
          </p>
        </div>
        <span className="fixture-badge">
          {model.fixtureKind === 'SYNTHETIC_READ_ONLY' ? '읽기 전용 합성 fixture' : '애플리케이션 투영'}
        </span>
      </div>

      {criticalAlerts.length > 0 ? (
        <div
          className="critical-alert-strip"
          aria-live={model.fixtureKind === 'SYNTHETIC_READ_ONLY' ? 'off' : 'assertive'}
          aria-atomic="true"
        >
          <ShieldAlert aria-hidden="true" size={20} />
          <strong>해결되지 않은 중요 경고 {criticalAlerts.length}건</strong>
          <span>{criticalAlerts.map((alert) => alert.title).join(' / ')}</span>
        </div>
      ) : null}

      <div className="communication-tabs" role="tablist" aria-label="Advisor 커뮤니케이션 보기">
        <button
          type="button"
          role="tab"
          aria-selected={panel === 'INBOX'}
          aria-controls="communication-inbox"
          id="communication-inbox-tab"
          onClick={() => setPanel('INBOX')}
        >
          <Inbox aria-hidden="true" size={18} /> Inbox
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={panel === 'ALERTS'}
          aria-controls="communication-alerts"
          id="communication-alerts-tab"
          onClick={() => setPanel('ALERTS')}
        >
          <Bell aria-hidden="true" size={18} /> Alerts
          <span className="tab-count">{model.alerts.filter((alert) => alert.state !== 'RESOLVED').length}</span>
        </button>
      </div>

      {panel === 'INBOX' ? (
        <div
          className="communication-panel inbox-layout"
          id="communication-inbox"
          role="tabpanel"
          aria-labelledby="communication-inbox-tab"
        >
          <form className="advisor-compose" onSubmit={(event) => void submit(event)}>
            <div className="section-heading">
              <p className="eyebrow">STRUCTURED MESSAGE</p>
              <h3>Advisor에게 메시지 작성</h3>
            </div>
            <output className="request-identity" aria-label="영속 요청 ID">
              <span>REQUEST_ID</span>
              <code className="mono">{model.draftRequestId}</code>
            </output>
            <label>
              <span>미션</span>
              <select value={missionId} onChange={(event) => setMissionId(event.target.value)}>
                {model.missionOptions.map((mission) => (
                  <option value={mission.id} key={mission.id}>{mission.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>메시지 종류</span>
              <select value={kind} onChange={(event) => setKind(event.target.value as AdvisorMessageKind)}>
                {ADVISOR_MESSAGE_KINDS.map((messageKind) => (
                  <option value={messageKind} key={messageKind}>
                    {ADVISOR_MESSAGE_KIND_LABELS_KO[messageKind]} ({messageKind})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>제목</span>
              <input
                value={subject}
                maxLength={200}
                required
                onChange={(event) => setSubject(event.target.value)}
                autoComplete="off"
              />
            </label>
            <label>
              <span>구조화 본문</span>
              <textarea
                value={bodyText}
                maxLength={16 * 1024}
                required
                rows={7}
                onChange={(event) => setBodyText(event.target.value)}
              />
            </label>
            <fieldset className="reference-picker">
              <legend>허용된 엔티티 참조</legend>
              {model.allowlistedEntityIds.map((entityId) => (
                <label key={entityId}>
                  <input
                    type="checkbox"
                    checked={references.includes(entityId)}
                    onChange={(event) => {
                      setReferences((current) =>
                        event.target.checked
                          ? [...current, entityId]
                          : current.filter((value) => value !== entityId),
                      );
                    }}
                  />
                  <span className="mono">{entityId}</span>
                </label>
              ))}
            </fieldset>
            <p className="compose-safety-note">
              제출 성공은 PERSISTED만 확인합니다. 전달·Advisor 확인·접수·결정·재개는 각각 별도 증거가 필요합니다.
            </p>
            <button
              className="primary-action"
              type="submit"
              disabled={
                actionPort === undefined || submitting || subject.trim().length === 0 || bodyText.trim().length === 0
              }
            >
              <Send aria-hidden="true" size={18} />
              {submitting ? '영속 저장 중' : 'Advisor 메시지 영속 저장'}
            </button>
            {actionPort === undefined ? (
              <p className="fixture-write-warning">읽기 전용 fixture는 메시지를 쓰거나 확인을 주장하지 않습니다.</p>
            ) : null}
            {submission.receipt === undefined ? null : (
              <div className="submission-receipt" role="status">
                <Check aria-hidden="true" size={18} />
                <span>PERSISTED</span>
                <code className="mono">{submission.receipt.messageArtifactHash}</code>
              </div>
            )}
            {submission.errorCode === undefined ? null : (
              <p className="submission-error" role="alert">저장 거부: {submission.errorCode}</p>
            )}
          </form>

          <div className="inbox-records" aria-label="영속 Inbox 기록">
            <div className="section-heading">
              <p className="eyebrow">DURABLE TIMELINE</p>
              <h3>메시지 상태와 증거</h3>
            </div>
            {model.messages.map((message) => <MessageRecord message={message} key={message.messageId} />)}
          </div>
        </div>
      ) : (
        <div
          className="communication-panel alerts-layout"
          id="communication-alerts"
          role="tabpanel"
          aria-labelledby="communication-alerts-tab"
        >
          {model.alerts.map((alert) => (
            <AlertRecord
              alert={alert}
              {...(actionPort === undefined ? {} : { actionPort })}
              onAction={(action) => void actOnAlert(alert, action)}
              key={alert.alertId}
            />
          ))}
        </div>
      )}
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </section>
  );
}

function MessageRecord({ message }: { readonly message: CommunicationMessageView }) {
  const [copied, setCopied] = useState(false);
  const copyPointer = async (): Promise<void> => {
    await copyText(`${message.artifactRef}\n${message.artifactHash}`);
    setCopied(true);
  };
  return (
    <article className="message-record">
      <div className="message-record-heading">
        <div>
          <span className={`message-state state-${message.state.toLowerCase()}`}>{message.state}</span>
          <h4>{message.subject}</h4>
        </div>
        <span className="message-kind">{ADVISOR_MESSAGE_KIND_LABELS_KO[message.kind]}</span>
      </div>
      <dl className="communication-metadata">
        <Metadata label="REQUEST_ID" value={message.requestId} />
        <Metadata label="PAYLOAD_HASH" value={message.payloadHash} />
        <Metadata label="MESSAGE_ID" value={message.messageId} />
      </dl>
      <ol className="message-timeline" aria-label={`${message.subject} 증거 타임라인`}>
        {message.timeline.map((item) => (
          <li key={`${item.state}-${item.occurredAt}`}>
            <span className="timeline-marker" aria-hidden="true" />
            <div>
              <strong>{item.state}</strong>
              <time dateTime={item.occurredAt}>{item.occurredAt}</time>
              <code className="mono">{item.evidenceRef}</code>
            </div>
          </li>
        ))}
      </ol>
      {message.state === 'MANUAL_FALLBACK_REQUIRED' ? (
        <div className="manual-fallback-card">
          <AlertTriangle aria-hidden="true" size={18} />
          <div>
            <strong>Advisor 수동 전달 필요</strong>
            <code className="mono">{message.artifactRef}</code>
            <code className="mono">{message.artifactHash}</code>
          </div>
          <button type="button" onClick={() => void copyPointer()}>
            {copied ? <Check aria-hidden="true" size={16} /> : <Clipboard aria-hidden="true" size={16} />}
            포인터 복사
          </button>
        </div>
      ) : null}
    </article>
  );
}

function AlertRecord({
  alert,
  actionPort,
  onAction,
}: {
  readonly alert: CommunicationAlertView;
  readonly actionPort?: CommunicationCenterActionPort;
  readonly onAction: (action: AlertActionCode) => void;
}) {
  const lifecycleDisabled = actionPort === undefined;
  const runLifecycle = async (
    action: 'ACKNOWLEDGE' | 'SNOOZE' | 'RESOLVE' | 'SUPPRESS',
  ): Promise<void> => {
    await actionPort?.applyAlertLifecycle({ alertId: alert.alertId, action });
  };
  return (
    <article className={`alert-record alert-${alert.severity.toLowerCase()}`}>
      <div className="alert-record-heading">
        <div>
          <span className="alert-kind">{ALERT_KIND_LABELS_KO[alert.kind]} ({alert.kind})</span>
          <h3>{alert.title}</h3>
        </div>
        <span className="alert-state">{alert.state} · {alert.occurrenceCount}</span>
      </div>
      <InertStructuredText text={alert.summary} />
      <dl className="alert-detail-grid">
        <Metadata label="MISSION" value={alert.detail.missionId} />
        <Metadata label="REQUEST_ID" value={alert.detail.requestId} />
        <Metadata label="PHASE / WORKUNIT" value={`${alert.detail.phaseId} / ${alert.detail.workUnitId}`} />
        <Metadata label="BLOCKED_CAPABILITY" value={alert.detail.blockedCapability} />
        <Metadata label="BLOCKER_REASON" value={alert.detail.blockerReason} />
        <Metadata label="RESOLUTION_OWNER" value={alert.detail.resolutionOwner} />
        <Metadata label="NEXT_ACTION" value={alert.detail.nextAction} />
        <Metadata label="SAFE_DEFAULT" value={alert.detail.safeDefault} />
        <Metadata label="DEDUPLICATION_KEY" value={alert.deduplicationKey} />
      </dl>
      <div className="alert-reasoning">
        <ReasoningList title="확인된 사실" values={alert.detail.confirmedFacts} />
        <ReasoningList title="미확인 사항" values={alert.detail.unknowns} />
        <ReasoningList title="선택지" values={alert.detail.options} />
        <div>
          <h4>정확한 질문</h4>
          <InertStructuredText text={alert.detail.question} />
        </div>
        <div>
          <h4>Advisor 권고</h4>
          <InertStructuredText text={alert.detail.recommendation} />
        </div>
      </div>
      <div className="alert-actions" aria-label={`${alert.title} 작업`}>
        {alert.actionCodes.map((action) => (
          <button
            type="button"
            key={action}
            disabled={action === 'COPY_GPT_PACKAGE' && alert.gptPackageMarkdown === undefined}
            onClick={() => onAction(action)}
          >
            {actionIcon(action)} {ALERT_ACTION_LABELS_KO[action]}
          </button>
        ))}
      </div>
      <div className="alert-lifecycle" aria-label={`${alert.title} 경고 수명주기`}>
        <span>확인과 해결은 별도 기록입니다.</span>
        {(['ACKNOWLEDGE', 'SNOOZE', 'RESOLVE', 'SUPPRESS'] as const).map((action) => (
          <button
            type="button"
            key={action}
            disabled={lifecycleDisabled}
            onClick={() => void runLifecycle(action)}
          >
            {lifecycleLabel(action)}
          </button>
        ))}
      </div>
    </article>
  );
}

function Metadata({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd><code className="mono">{value}</code></dd>
    </div>
  );
}

function ReasoningList({ title, values }: { readonly title: string; readonly values: readonly string[] }) {
  return (
    <div>
      <h4>{title}</h4>
      <ul>{values.map((value) => <li key={value}><InertStructuredText text={value} /></li>)}</ul>
    </div>
  );
}

export function InertStructuredText({ text }: { readonly text: string }) {
  const blocks = useMemo(() => text.split(/(```[\s\S]*?```)/gu), [text]);
  return (
    <div className="inert-structured-text">
      {blocks.map((block, index) =>
        block.startsWith('```') && block.endsWith('```') ? (
          <pre key={index}><code>{block.slice(3, -3)}</code></pre>
        ) : (
          block.split('\n').filter((line) => line.length > 0).map((line, lineIndex) => (
            <p key={`${index}-${lineIndex}`}>{line}</p>
          ))
        ),
      )}
    </div>
  );
}

function actionIcon(action: AlertActionCode): ReactNode {
  switch (action) {
    case 'COPY_GPT_PACKAGE':
      return <Clipboard aria-hidden="true" size={16} />;
    case 'OPEN_EVIDENCE':
      return <FileSearch aria-hidden="true" size={16} />;
    case 'REPLY_TO_ADVISOR':
      return <MessageSquareReply aria-hidden="true" size={16} />;
    case 'HOLD':
    case 'PAUSE_MISSION':
      return <PauseCircle aria-hidden="true" size={16} />;
    case 'CANCEL_MISSION':
      return <XCircle aria-hidden="true" size={16} />;
  }
}

function lifecycleLabel(action: 'ACKNOWLEDGE' | 'SNOOZE' | 'RESOLVE' | 'SUPPRESS'): string {
  switch (action) {
    case 'ACKNOWLEDGE':
      return '경고 확인';
    case 'SNOOZE':
      return '다시 알림';
    case 'RESOLVE':
      return '증거로 해결';
    case 'SUPPRESS':
      return '조건부 억제';
  }
}

async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

function readErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return 'PERSISTENCE_FAILED';
}
