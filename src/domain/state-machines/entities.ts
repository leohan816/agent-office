import { DomainError } from '../../contracts/types.js';

export const MESSAGE_TRANSITIONS = {
  PERSISTED: ['DELIVERY_PENDING', 'CLOSED'],
  DELIVERY_PENDING: ['DELIVERED', 'DELIVERY_FAILED', 'MANUAL_FALLBACK_REQUIRED'],
  DELIVERED: ['ACKNOWLEDGED', 'DELIVERY_FAILED', 'MANUAL_FALLBACK_REQUIRED'],
  DELIVERY_FAILED: ['DELIVERY_PENDING', 'MANUAL_FALLBACK_REQUIRED', 'CLOSED'],
  MANUAL_FALLBACK_REQUIRED: ['DELIVERY_PENDING', 'ACKNOWLEDGED', 'CLOSED'],
  ACKNOWLEDGED: ['INTAKE_RECORDED', 'CLOSED'],
  INTAKE_RECORDED: ['DECISION_LINKED', 'CLOSED'],
  DECISION_LINKED: ['CLOSED'],
  CLOSED: [],
} as const;

export type MessageState = keyof typeof MESSAGE_TRANSITIONS;

export const BLOCKER_TRANSITIONS = {
  OPEN: ['ACKNOWLEDGED', 'WAITING_ADVISOR', 'WAITING_LEO', 'RESOLVED', 'SUPERSEDED'],
  ACKNOWLEDGED: ['WAITING_ADVISOR', 'WAITING_LEO', 'RESOLVED', 'SUPERSEDED'],
  WAITING_ADVISOR: ['WAITING_LEO', 'RESOLVED', 'SUPERSEDED'],
  WAITING_LEO: ['WAITING_ADVISOR', 'RESOLVED', 'SUPERSEDED'],
  RESOLVED: [],
  SUPERSEDED: [],
} as const;

export type BlockerState = keyof typeof BLOCKER_TRANSITIONS;

export const ALERT_TRANSITIONS = {
  OPEN: ['ACKNOWLEDGED', 'RESOLVED', 'SUPPRESSED'],
  ACKNOWLEDGED: ['SNOOZED', 'RESOLVED', 'SUPPRESSED'],
  SNOOZED: ['OPEN', 'RESOLVED'],
  RESOLVED: [],
  SUPPRESSED: ['OPEN'],
} as const;

export type AlertState = keyof typeof ALERT_TRANSITIONS;

export const DECISION_TRANSITIONS = {
  REQUESTED: ['ACKNOWLEDGED', 'WITHDRAWN'],
  ACKNOWLEDGED: ['RECORDED', 'WITHDRAWN'],
  RECORDED: ['APPLIED', 'SUPERSEDED'],
  APPLIED: ['SUPERSEDED'],
  SUPERSEDED: [],
  WITHDRAWN: [],
} as const;

export type DecisionState = keyof typeof DECISION_TRANSITIONS;

export const NOTIFICATION_TRANSITIONS = {
  QUEUED: ['DELIVERING', 'CANCELLED'],
  DELIVERING: ['DELIVERED', 'FAILED', 'CANCELLED'],
  DELIVERED: ['ACKNOWLEDGED'],
  ACKNOWLEDGED: [],
  FAILED: ['QUEUED', 'MANUAL_FALLBACK_REQUIRED', 'CANCELLED'],
  MANUAL_FALLBACK_REQUIRED: ['QUEUED', 'CANCELLED'],
  CANCELLED: [],
} as const;

export type NotificationState = keyof typeof NOTIFICATION_TRANSITIONS;

type TransitionMap = Readonly<Record<string, readonly string[]>>;

export function assertEntityTransition(
  transitions: TransitionMap,
  from: string,
  to: string,
): void {
  const allowed = transitions[from];
  if (!allowed?.includes(to)) {
    throw new DomainError('INVALID_TRANSITION', `${from} cannot transition to ${to}`);
  }
}
