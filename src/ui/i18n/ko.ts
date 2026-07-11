import type { ObservationPresentation } from '../../application/hosts/freshness.js';
import type { ObservableProjectionName, RequiredObservableName } from '../../domain/activity/index.js';
import type { BlockerKind, ResolutionOwner } from '../../domain/blockers/index.js';
import type { AlertActionCode, AlertKind } from '../../domain/alerts/index.js';
import type { AdvisorMessageKind } from '../../domain/messages/index.js';

export const HIERARCHY_LABELS_KO = {
  initiative: '활성 작업 묶음',
  package: '패키지',
  mission: '현재 미션',
  phase: '단계',
  workUnit: '세부 작업',
} as const;

export const PROGRESS_LABELS_KO = {
  workUnitCount: '세부 작업 진행률',
  requiredGate: '필수 게이트 진행률',
} as const;

export type DashboardStateName =
  | RequiredObservableName
  | Extract<ObservableProjectionName, 'UNKNOWN_OR_STALE'>
  | 'WAITING_ADVISOR'
  | 'HOLD';

export const WORK_UNIT_STATE_LABELS_KO: Readonly<Record<DashboardStateName, string>> = {
  QUEUED: '대기열',
  READY: '준비됨',
  DISPATCHING: '작업 전달 중',
  READING: '읽는 중',
  WORKING: '작업 중',
  TESTING: '테스트 중',
  WRITING_RESULT: '결과 작성 중',
  RETURNING_RESULT: '결과 반환 중',
  REVIEWING: '검토 중',
  NEEDS_PATCH: '수정 필요',
  WAITING_DEPENDENCY: '선행 작업 대기',
  WAITING_ADVISOR: 'Advisor 확인 대기',
  WAITING_LEO: 'Leo/GPT 결정 대기',
  HOLD: '보류',
  BLOCKED: '차단됨',
  COMPLETED: '완료',
  FAILED: '실패',
  CANCELLED: '취소됨',
  UNKNOWN_OR_STALE: '알 수 없거나 오래된 상태',
};

export const FRESHNESS_LABELS_KO: Readonly<Record<ObservationPresentation, string>> = {
  CURRENT: '현재',
  STALE: '오래됨',
  OFFLINE: '오프라인',
  UNKNOWN: '알 수 없음',
  CONFLICT: '충돌',
  ERROR: '오류',
};

export const BLOCKER_LABELS_KO: Readonly<Record<BlockerKind, string>> = {
  MISSING_LEO_DECISION: 'Leo/GPT 결정 필요',
  MISSING_EVIDENCE: '증거 누락',
  SESSION_NOT_READY: '세션 준비 안 됨',
  SESSION_OFFLINE: '세션 오프라인',
  WRONG_ACTOR_OR_WORKSPACE: '역할 또는 작업공간 불일치',
  GIT_CONFLICT: 'Git 충돌',
  DIRTY_WORKTREE_CONFLICT: '정리되지 않은 작업 트리 충돌',
  TEST_FAILURE: '테스트 실패',
  AUTHENTICATION_REQUIRED: '인증 필요',
  UNEXPECTED_APPROVAL_PROMPT: '예상하지 못한 승인 요청',
  SCOPE_CONFLICT: '범위 충돌',
  DEPENDENCY_FAILED: '선행 작업 실패',
  TIMEOUT: '시간 초과',
  ARTIFACT_MISSING: '산출물 누락',
  COMMIT_NOT_PUSHED: '커밋이 푸시되지 않음',
  MANUAL_KILL_SWITCH: '수동 킬 스위치 작동',
};

export const RESOLUTION_OWNER_LABELS_KO: Readonly<Record<ResolutionOwner | 'UNKNOWN', string>> = {
  ADVISOR: 'Advisor',
  LEO_GPT: 'Leo/GPT',
  ASSIGNED_WORKER: '담당 Worker',
  FABLE5_REVIEWER: 'Fable5 Reviewer',
  LOCAL_OPERATOR: '로컬 운영자',
  UNKNOWN: '알 수 없음',
};

export function blockerReasonLabel(kind: BlockerKind, reasonCode: string): string {
  return `${BLOCKER_LABELS_KO[kind]} (${reasonCode})`;
}

export const ADVISOR_MESSAGE_KIND_LABELS_KO: Readonly<Record<AdvisorMessageKind, string>> = {
  NEW_MISSION: '새 미션',
  CLARIFICATION: '명확화 요청',
  DECISION_RESPONSE: '결정 응답',
  PAUSE: '일시정지 요청',
  CANCEL: '취소 요청',
};

export const ALERT_KIND_LABELS_KO: Readonly<Record<AlertKind, string>> = {
  NEEDS_LEO_DECISION: 'Leo/GPT 결정 필요',
  PASS_WITH_RISK: '위험을 포함한 통과',
  BLOCKED: '차단됨',
  AUTHENTICATION_REQUIRED: '인증 필요',
  MANUAL_ACTION_REQUIRED: '수동 조치 필요',
  FINAL_APPROVAL_REQUIRED: '최종 승인 필요',
  MISSION_COMPLETE: '미션 완료',
  MISSION_FAILED: '미션 실패',
  INFORMATION: '정보',
};

export const ALERT_ACTION_LABELS_KO: Readonly<Record<AlertActionCode, string>> = {
  COPY_GPT_PACKAGE: 'GPT 패키지 복사',
  OPEN_EVIDENCE: '증거 열기',
  REPLY_TO_ADVISOR: 'Advisor에게 답장',
  HOLD: '보류',
  PAUSE_MISSION: '미션 일시정지',
  CANCEL_MISSION: '미션 취소',
};
