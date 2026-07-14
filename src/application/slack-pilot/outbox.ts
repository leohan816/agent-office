// AS1 Multi-Team Slack Pilot — rendered same-thread outbound state machine (no blind resend).
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_DESIGN.md §14 (durable outbound);
// docs/security/AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md §12 (outbound security). Only
// chat.postMessage is representable, with mrkdwn:false, disabled unfurls, no reply_broadcast, and no
// identity override / blocks / attachments / metadata / dynamic method. Channel and thread_ts come from
// the accepted root correlation, never from Advisor evidence. The durable outbox records request bytes and
// intended root BEFORE network I/O. Safe automatic retry is limited to a connection failure proven before
// request bytes are handed off, or an explicit rate-limit response with no accepted message; at most three
// attempts with bounded backoff. Any timeout/reset after request write, 5xx, malformed success, or lost
// response is ambiguous: latch, record manual reconciliation, and NEVER blind-resend.
import { DomainError } from '../../contracts/types.js';
import { LIMITS, containsSecretShapedValue, requireBoundedMessageText } from './contracts.js';
import type { As1PostMessageRequest, As1PostMessageResult, As1WebPort } from '../../adapters/gateways/slack-pilot/web-client.js';

export type As1OutboxPhase = 'PREPARED' | 'REQUEST_STARTED' | 'RESPONSE_RECORDED' | 'MANUAL_RECONCILIATION_REQUIRED';

export type As1OutboundErrorClass = 'CONNECTION_BEFORE_SEND' | 'RATE_LIMITED' | 'AMBIGUOUS';

/** A classified outbound failure. Only CONNECTION_BEFORE_SEND and RATE_LIMITED are safe to retry. */
export class As1OutboundError extends Error {
  public constructor(
    public readonly outboundClass: As1OutboundErrorClass,
    message: string,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'As1OutboundError';
  }
}

export type As1OutboundRecord =
  | { readonly kind: 'ACK'; readonly intakeId: string; readonly advisorAckId: string; readonly summary: string }
  | {
      readonly kind: 'QUESTION';
      readonly intakeId: string;
      readonly questionId: string;
      readonly expectedResponseKind: 'CLARIFICATION' | 'DECISION_RESPONSE';
      readonly text: string;
    }
  | {
      readonly kind: 'RESULT';
      readonly intakeId: string;
      readonly resultId: string;
      readonly terminalStatus: string;
      readonly summary: string;
    };

const MENTION_CONTROL = /<[!@#]/u;

/** Render an outbound record to bounded plain text and reject any leaking/injection form (§12.2). */
export function renderOutbound(record: As1OutboundRecord): string {
  const text =
    record.kind === 'ACK'
      ? `ACK: ${record.summary}`
      : record.kind === 'QUESTION'
        ? `QUESTION (${record.expectedResponseKind}): ${record.text}`
        : `RESULT [${record.terminalStatus}]: ${record.summary}`;
  if (containsSecretShapedValue(text)) {
    throw new DomainError('INVALID_SCHEMA', 'outbound text carries a token-shaped or bearer-like value');
  }
  if (MENTION_CONTROL.test(text)) {
    throw new DomainError('INVALID_SCHEMA', 'outbound text carries a Slack mention control form');
  }
  // Bounds + control-character rejection (allows only newline/tab beyond printable).
  return requireBoundedMessageText(text, 'outbound text');
}

export interface As1OutboxJournal {
  persistOutboundArtifact(outboundId: string, rendered: unknown): Promise<{ readonly relativePath: string; readonly sha256: string }>;
  recordOutboxPhase(outboundId: string, phase: As1OutboxPhase): Promise<void>;
  readOutboxPhase(outboundId: string): Promise<string | null>;
}

export interface As1OutboundTarget {
  readonly channel: string;
  readonly threadTs: string;
  readonly botToken: string;
}

export type As1DeliverySendOutcome = 'DELIVERED' | 'MANUAL_RECONCILIATION_REQUIRED' | 'REJECTED_RENDER';

export interface As1OutboxResult {
  readonly outcome: As1DeliverySendOutcome;
  readonly phase: As1OutboxPhase;
  readonly attempts: number;
  readonly reason: string;
}

export interface As1SendRequest {
  readonly outboundId: string;
  readonly record: As1OutboundRecord;
  readonly target: As1OutboundTarget;
  readonly web: As1WebPort;
  readonly journal: As1OutboxJournal;
  readonly delay?: (ms: number) => Promise<void>;
}

const DEFAULT_DELAY = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class As1Outbox {
  public async send(request: As1SendRequest): Promise<As1OutboxResult> {
    const { outboundId, record, target, web, journal } = request;
    const delay = request.delay ?? DEFAULT_DELAY;

    let text: string;
    try {
      text = renderOutbound(record);
    } catch (error) {
      return { outcome: 'REJECTED_RENDER', phase: 'PREPARED', attempts: 0, reason: error instanceof DomainError ? error.code : 'render' };
    }

    const postRequest: As1PostMessageRequest = { channel: target.channel, threadTs: target.threadTs, text };
    await journal.persistOutboundArtifact(outboundId, { channel: target.channel, threadTs: target.threadTs, text, kind: record.kind });
    await journal.recordOutboxPhase(outboundId, 'PREPARED');
    await journal.recordOutboxPhase(outboundId, 'REQUEST_STARTED');

    let attempts = 0;
    for (let attempt = 1; attempt <= LIMITS.OUTBOUND_MAX_ATTEMPTS; attempt += 1) {
      attempts = attempt;
      try {
        const response = await web.postMessage(target.botToken, postRequest);
        if (this.isTrustedSuccess(response, target)) {
          await journal.recordOutboxPhase(outboundId, 'RESPONSE_RECORDED');
          return { outcome: 'DELIVERED', phase: 'RESPONSE_RECORDED', attempts, reason: 'ok' };
        }
        // Malformed success (no exact channel/timestamp correspondence) is ambiguous — never resend.
        return await this.reconcile(journal, outboundId, attempts, 'malformed success response');
      } catch (error) {
        if (error instanceof As1OutboundError && error.outboundClass === 'CONNECTION_BEFORE_SEND') {
          if (attempt < LIMITS.OUTBOUND_MAX_ATTEMPTS) {
            await delay(LIMITS.RETRY_BACKOFF_MS[attempt - 1] ?? 1_000);
            continue;
          }
          return this.reconcile(journal, outboundId, attempts, 'connection failures exhausted');
        }
        if (error instanceof As1OutboundError && error.outboundClass === 'RATE_LIMITED') {
          if (attempt < LIMITS.OUTBOUND_MAX_ATTEMPTS) {
            await delay(Math.min(error.retryAfterMs ?? LIMITS.RETRY_AFTER_MAX_MS, LIMITS.RETRY_AFTER_MAX_MS));
            continue;
          }
          return this.reconcile(journal, outboundId, attempts, 'rate limits exhausted');
        }
        // Any other/ambiguous failure: latch and require manual reconciliation.
        return await this.reconcile(journal, outboundId, attempts, 'ambiguous outbound failure');
      }
    }
    return this.reconcile(journal, outboundId, attempts, 'attempts exhausted');
  }

  private isTrustedSuccess(response: As1PostMessageResult, target: As1OutboundTarget): boolean {
    return response.ok && response.channel === target.channel && response.ts.length > 0 && response.ts.length <= 32;
  }

  private async reconcile(
    journal: As1OutboxJournal,
    outboundId: string,
    attempts: number,
    reason: string,
  ): Promise<As1OutboxResult> {
    await journal.recordOutboxPhase(outboundId, 'MANUAL_RECONCILIATION_REQUIRED');
    return { outcome: 'MANUAL_RECONCILIATION_REQUIRED', phase: 'MANUAL_RECONCILIATION_REQUIRED', attempts, reason };
  }
}
