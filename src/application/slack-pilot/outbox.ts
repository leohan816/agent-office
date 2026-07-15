// AS1 Multi-Team Slack Pilot — rendered same-thread outbound state machine (no blind resend).
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_DESIGN.md §14 (durable outbound);
// docs/security/AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md §12 (outbound security). Only
// chat.postMessage is representable. Channel and thread_ts are derived from the immutable ACCEPTED ROOT
// correlation and the selected closed profile — never from Advisor evidence or a free-form caller. Before
// any network I/O the outbox reads the durable phase and REFUSES to resend once REQUEST_STARTED,
// RESPONSE_RECORDED, or MANUAL_RECONCILIATION_REQUIRED is durable; it persists immutable request bytes
// first. Safe automatic retry is limited to a connection failure proven before request bytes are handed off
// or an explicit rate-limit response, at most three attempts with bounded backoff. A timeout/reset after
// request write, 5xx, malformed success, or lost response is ambiguous: durably latch, record manual
// reconciliation, and NEVER blind-resend. Success requires the exact channel and a valid Slack timestamp.
import { DomainError } from '../../contracts/types.js';
import { LIMITS, containsSecretShapedValue, requireBoundedMessageText, requireSlackTs } from './contracts.js';
import type { As1ProfileId } from './profiles.js';
import {
  As1OutboundError,
  type As1PostMessageRequest,
  type As1PostMessageResult,
  type As1WebPort,
} from '../../adapters/gateways/slack-pilot/web-client.js';

export { As1OutboundError };
export type { As1OutboundErrorClass } from '../../adapters/gateways/slack-pilot/web-client.js';

export type As1OutboxPhase = 'PREPARED' | 'REQUEST_STARTED' | 'RESPONSE_RECORDED' | 'MANUAL_RECONCILIATION_REQUIRED';

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
  return requireBoundedMessageText(text, 'outbound text');
}

export interface As1OutboxJournal {
  persistOutboundArtifact(outboundId: string, rendered: unknown): Promise<{ readonly relativePath: string; readonly sha256: string }>;
  recordOutboxPhase(outboundId: string, phase: As1OutboxPhase): Promise<void>;
  readOutboxPhase(outboundId: string): Promise<string | null>;
}

/** The immutable accepted root the reply must attach to. channel/thread are derived from it, not the caller. */
export interface As1AcceptedRoot {
  readonly profileId: As1ProfileId;
  readonly channelId: string;
  readonly rootTs: string;
  readonly rootCorrelationHash: string;
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
  readonly acceptedRoot: As1AcceptedRoot;
  /** Secret bot token for the selected profile, supplied by composition from the owner-only secret. */
  readonly botToken: string;
  readonly web: As1WebPort;
  readonly journal: As1OutboxJournal;
  /** Durably latch the profile on ambiguity/malformed success (wired to control by composition). */
  readonly latch?: (reason: string) => Promise<void>;
  readonly delay?: (ms: number) => Promise<void>;
}

const DEFAULT_DELAY = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class As1Outbox {
  public async send(request: As1SendRequest): Promise<As1OutboxResult> {
    const { outboundId, record, acceptedRoot, botToken, web, journal } = request;
    const delay = request.delay ?? DEFAULT_DELAY;
    const latch = request.latch ?? ((): Promise<void> => Promise.resolve());

    // Resume: never touch the network once a terminal or in-flight phase is durable (no blind resend).
    const prior = await journal.readOutboxPhase(outboundId);
    if (prior === 'RESPONSE_RECORDED') {
      return { outcome: 'DELIVERED', phase: 'RESPONSE_RECORDED', attempts: 0, reason: 'already delivered' };
    }
    if (prior === 'MANUAL_RECONCILIATION_REQUIRED') {
      return { outcome: 'MANUAL_RECONCILIATION_REQUIRED', phase: 'MANUAL_RECONCILIATION_REQUIRED', attempts: 0, reason: 'terminal' };
    }
    if (prior === 'REQUEST_STARTED') {
      // Bytes may already be on the wire; resuming must not resend.
      await latch('outbound request interrupted after REQUEST_STARTED');
      await journal.recordOutboxPhase(outboundId, 'MANUAL_RECONCILIATION_REQUIRED');
      return { outcome: 'MANUAL_RECONCILIATION_REQUIRED', phase: 'MANUAL_RECONCILIATION_REQUIRED', attempts: 0, reason: 'interrupted after request start' };
    }

    let text: string;
    try {
      text = renderOutbound(record);
    } catch (error) {
      return { outcome: 'REJECTED_RENDER', phase: 'PREPARED', attempts: 0, reason: error instanceof DomainError ? error.code : 'render' };
    }

    const channel = acceptedRoot.channelId;
    const threadTs = acceptedRoot.rootTs;
    const postRequest: As1PostMessageRequest = { channel, threadTs, text };
    await journal.persistOutboundArtifact(outboundId, {
      kind: record.kind,
      profileId: acceptedRoot.profileId,
      rootCorrelationHash: acceptedRoot.rootCorrelationHash,
      channel,
      threadTs,
      text,
    });
    await journal.recordOutboxPhase(outboundId, 'PREPARED');
    await journal.recordOutboxPhase(outboundId, 'REQUEST_STARTED');

    let attempts = 0;
    for (let attempt = 1; attempt <= LIMITS.OUTBOUND_MAX_ATTEMPTS; attempt += 1) {
      attempts = attempt;
      try {
        const response = await web.postMessage(botToken, postRequest);
        if (this.isTrustedSuccess(response, channel)) {
          await journal.persistOutboundArtifact(`${outboundId}.response`, { ok: true, channel: response.channel, ts: response.ts });
          await journal.recordOutboxPhase(outboundId, 'RESPONSE_RECORDED');
          return { outcome: 'DELIVERED', phase: 'RESPONSE_RECORDED', attempts, reason: 'ok' };
        }
        return await this.reconcile(journal, latch, outboundId, attempts, 'malformed success response');
      } catch (error) {
        const classified = error instanceof As1OutboundError ? error : new As1OutboundError('AMBIGUOUS', 'unclassified outbound failure');
        if (classified.outboundClass === 'CONNECTION_BEFORE_SEND' && attempt < LIMITS.OUTBOUND_MAX_ATTEMPTS) {
          await delay(LIMITS.RETRY_BACKOFF_MS[attempt - 1] ?? 1_000);
          continue;
        }
        if (classified.outboundClass === 'RATE_LIMITED' && attempt < LIMITS.OUTBOUND_MAX_ATTEMPTS) {
          await delay(Math.min(classified.retryAfterMs ?? LIMITS.RETRY_AFTER_MAX_MS, LIMITS.RETRY_AFTER_MAX_MS));
          continue;
        }
        if (classified.outboundClass === 'AMBIGUOUS') {
          return await this.reconcile(journal, latch, outboundId, attempts, 'ambiguous outbound failure');
        }
        return await this.reconcile(journal, latch, outboundId, attempts, `${classified.outboundClass.toLowerCase()} attempts exhausted`);
      }
    }
    return this.reconcile(journal, latch, outboundId, attempts, 'attempts exhausted');
  }

  private isTrustedSuccess(response: As1PostMessageResult, channel: string): boolean {
    if (!response.ok || response.channel !== channel) return false;
    try {
      requireSlackTs(response.ts, 'outbound response ts');
      return true;
    } catch {
      return false;
    }
  }

  private async reconcile(
    journal: As1OutboxJournal,
    latch: (reason: string) => Promise<void>,
    outboundId: string,
    attempts: number,
    reason: string,
  ): Promise<As1OutboxResult> {
    await latch(reason);
    await journal.recordOutboxPhase(outboundId, 'MANUAL_RECONCILIATION_REQUIRED');
    return { outcome: 'MANUAL_RECONCILIATION_REQUIRED', phase: 'MANUAL_RECONCILIATION_REQUIRED', attempts, reason };
  }
}
