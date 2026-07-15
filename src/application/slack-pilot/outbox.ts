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
import type { As1ResultOutboundRecord } from './evidence-ingress.js';
import type { As1OutboxHashes, As1RootCorrelationV1 } from './inbound-store.js';
import type { As1Profile } from './profiles.js';
import {
  As1OutboundError,
  type As1PostMessageRequest,
  type As1PostMessageResult,
  type As1WebPort,
} from '../../adapters/gateways/slack-pilot/web-client.js';

export { As1OutboundError };
export type { As1OutboundErrorClass } from '../../adapters/gateways/slack-pilot/web-client.js';

export type As1OutboxPhase = 'PREPARED' | 'REQUEST_STARTED' | 'RESPONSE_RECORDED' | 'MANUAL_RECONCILIATION_REQUIRED';

/**
 * The outbound payloads the outbox can render — each comes ONLY from parsed accepted evidence (never a free
 * caller value). A RESULT is the exact embedded accepted `As1ResultOutboundRecord` from the RESULT evidence, so
 * B07 sends precisely what B06 accepted, with no reconstruction.
 */
export type As1OutboundRecord =
  | { readonly kind: 'ACK'; readonly intakeId: string; readonly advisorAckId: string; readonly summary: string }
  | {
      readonly kind: 'QUESTION';
      readonly intakeId: string;
      readonly questionId: string;
      readonly expectedResponseKind: 'CLARIFICATION' | 'DECISION_RESPONSE';
      readonly text: string;
    }
  | As1ResultOutboundRecord;

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
  recordOutboxPhase(outboundId: string, phase: As1OutboxPhase, hashes?: As1OutboxHashes): Promise<void>;
  readOutboxPhase(outboundId: string): Promise<string | null>;
}

/** Resolve the immutable accepted root correlation for an intake from the profile-local store (never a caller). */
export interface As1RootResolver {
  findRootByIntakeId(intakeId: string): Promise<As1RootCorrelationV1 | null>;
}

/** The validated per-profile owner secret the outbox is constructed with — the ONLY channel/token source. */
export interface As1OutboxProfileSecret {
  readonly channelId: string;
  readonly botToken: string;
}

export type As1DeliverySendOutcome =
  | 'DELIVERED'
  | 'MANUAL_RECONCILIATION_REQUIRED'
  | 'REJECTED_RENDER'
  | 'REJECTED_CONTROL'
  | 'REJECTED_ROOT';

export interface As1OutboxResult {
  readonly outcome: As1DeliverySendOutcome;
  readonly phase: As1OutboxPhase;
  readonly attempts: number;
  readonly reason: string;
}

/**
 * The mandatory internal dependencies a profile-bound outbox is constructed with (review B07). Every
 * target-selecting and security-bearing collaborator is fixed here — the selected closed profile, its validated
 * secret (channel + bot token), the profile-local store (journal + root resolver), the web port, the mandatory
 * durable latch and control gate, and the delay. NONE is a per-send caller input and NONE is an optional no-op.
 */
export interface As1OutboxDependencies {
  readonly profile: As1Profile;
  readonly secret: As1OutboxProfileSecret;
  readonly store: As1OutboxJournal & As1RootResolver;
  readonly web: As1WebPort;
  /** Durably latch the profile on ambiguity/malformed success. Mandatory — never a no-op. */
  readonly latch: (reason: string) => Promise<void>;
  /**
   * Assert the profile may still emit a side effect — control open + owned, global kill not engaged, this profile
   * active and not latched. Mandatory; checked immediately before any durable write and every network send.
   */
  readonly assertSendable: () => Promise<void>;
  readonly delay: (ms: number) => Promise<void>;
}

/** The ONLY per-send inputs: the outbound identity and the typed record that came from accepted evidence. */
export interface As1SendInput {
  readonly outboundId: string;
  readonly record: As1OutboundRecord;
}

/**
 * A profile-bound rendered-outbound sender. Channel, thread, token, store, latch, and control are all fixed at
 * construction from composition; `send` cannot select a target. It resolves the immutable root by the record's
 * intakeId from the profile-local store, requires the record's intake to match that root, derives thread_ts from
 * the root, and uses ONLY the bound profile secret's channel + token.
 */
export class As1Outbox {
  public constructor(private readonly deps: As1OutboxDependencies) {}

  public async send(input: As1SendInput): Promise<As1OutboxResult> {
    const { outboundId, record } = input;
    const { profile, secret, store, web, latch, assertSendable, delay } = this.deps;

    // Resume: never touch the network once a terminal or in-flight phase is durable (no blind resend).
    const prior = await store.readOutboxPhase(outboundId);
    if (prior === 'RESPONSE_RECORDED') {
      return { outcome: 'DELIVERED', phase: 'RESPONSE_RECORDED', attempts: 0, reason: 'already delivered' };
    }
    if (prior === 'MANUAL_RECONCILIATION_REQUIRED') {
      return { outcome: 'MANUAL_RECONCILIATION_REQUIRED', phase: 'MANUAL_RECONCILIATION_REQUIRED', attempts: 0, reason: 'terminal' };
    }
    if (prior === 'REQUEST_STARTED') {
      // Bytes may already be on the wire; resuming must not resend.
      await latch('outbound request interrupted after REQUEST_STARTED');
      await store.recordOutboxPhase(outboundId, 'MANUAL_RECONCILIATION_REQUIRED');
      return { outcome: 'MANUAL_RECONCILIATION_REQUIRED', phase: 'MANUAL_RECONCILIATION_REQUIRED', attempts: 0, reason: 'interrupted after request start' };
    }

    // Resolve the immutable accepted root by the record's intakeId from the profile-local store; the record's
    // intake must match that root. channel/thread/token are then derived ONLY from the bound root + profile secret.
    const root = await store.findRootByIntakeId(record.intakeId);
    if (root?.intakeId !== record.intakeId) {
      return { outcome: 'REJECTED_ROOT', phase: 'PREPARED', attempts: 0, reason: 'no accepted root for the intake' };
    }

    let text: string;
    try {
      text = renderOutbound(record);
    } catch (error) {
      return { outcome: 'REJECTED_RENDER', phase: 'PREPARED', attempts: 0, reason: error instanceof DomainError ? error.code : 'render' };
    }

    // Control/latch gate immediately before ANY durable write or network side effect. A closed/killed/latched or
    // non-active profile refuses the send cleanly BEFORE REQUEST_STARTED is durable — nothing is written or sent.
    try {
      await assertSendable();
    } catch (error) {
      return { outcome: 'REJECTED_CONTROL', phase: 'PREPARED', attempts: 0, reason: error instanceof DomainError ? error.code : 'control not sendable' };
    }

    const channel = secret.channelId;
    const threadTs = root.rootTs;
    const postRequest: As1PostMessageRequest = { channel, threadTs, text };
    const requestReceipt = await store.persistOutboundArtifact(outboundId, {
      kind: record.kind,
      profileId: profile.profileId,
      intakeId: record.intakeId,
      rootTs: root.rootTs,
      rootKeyHash: root.rootKeyHash,
      sourceEventId: root.sourceEventId,
      channel,
      threadTs,
      text,
    });
    // Bind the immutable request-bytes hash at PREPARED, then commit REQUEST_STARTED.
    await store.recordOutboxPhase(outboundId, 'PREPARED', { requestHash: requestReceipt.sha256 });
    await store.recordOutboxPhase(outboundId, 'REQUEST_STARTED');

    let attempts = 0;
    for (let attempt = 1; attempt <= LIMITS.OUTBOUND_MAX_ATTEMPTS; attempt += 1) {
      attempts = attempt;
      // Re-check control immediately before every network send — it may have closed during a retry backoff.
      try {
        await assertSendable();
      } catch {
        return await this.reconcile(outboundId, attempts, 'control not sendable before send');
      }
      try {
        const response = await web.postMessage(secret.botToken, postRequest);
        if (this.isTrustedSuccess(response, channel)) {
          const responseReceipt = await store.persistOutboundArtifact(`${outboundId}.response`, { ok: true, channel: response.channel, ts: response.ts });
          await store.recordOutboxPhase(outboundId, 'RESPONSE_RECORDED', { responseHash: responseReceipt.sha256 });
          return { outcome: 'DELIVERED', phase: 'RESPONSE_RECORDED', attempts, reason: 'ok' };
        }
        return await this.reconcile(outboundId, attempts, 'malformed success response');
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
          return await this.reconcile(outboundId, attempts, 'ambiguous outbound failure');
        }
        return await this.reconcile(outboundId, attempts, `${classified.outboundClass.toLowerCase()} attempts exhausted`);
      }
    }
    return this.reconcile(outboundId, attempts, 'attempts exhausted');
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

  private async reconcile(outboundId: string, attempts: number, reason: string): Promise<As1OutboxResult> {
    await this.deps.latch(reason);
    await this.deps.store.recordOutboxPhase(outboundId, 'MANUAL_RECONCILIATION_REQUIRED');
    return { outcome: 'MANUAL_RECONCILIATION_REQUIRED', phase: 'MANUAL_RECONCILIATION_REQUIRED', attempts, reason };
  }
}
