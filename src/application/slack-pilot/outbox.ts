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
import { hashCanonical } from '../../persistence/file-store/hashing.js';
import { LIMITS, containsSecretShapedValue, requireBoundedMessageText, requireSlackTs } from './contracts.js';
import { acceptedOutboundId, acceptedOutboundRecord, type As1AcceptedOutbound, type As1ResultOutboundRecord } from './evidence-ingress.js';
import { rootKeyHash, type As1OutboxHashes, type As1RootCorrelationV1 } from './inbound-store.js';
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

/**
 * The internal, closed same-thread user-status vocabulary (R2 recovery design §5.1). It is NOT a durable schema and
 * is never accepted from Slack, CLI, evidence, or an external caller — a caller supplies only an intake and one of
 * these four kinds. The renderer below is a TOTAL constant map; there is no free-form status text.
 */
export type As1UserStatusKind = 'ACCEPTED' | 'DELIVERY_CONFIRMED' | 'DELIVERY_FAILED' | 'PROCESSING_FAILED';

/** Total constant renderer (R2 recovery design §5.1). The full plain Korean sentence is available to visual and
 *  screen-reader clients without blocks, emoji-only meaning, mentions, or layout assumptions. */
const AS1_USER_STATUS_TEXT: Readonly<Record<As1UserStatusKind, string>> = {
  ACCEPTED: '요청 접수 완료 · Advisor에게 전달 중',
  DELIVERY_CONFIRMED: '메시지 전달 완료 · 답변 대기 중',
  DELIVERY_FAILED: '전달 실패 · 요청은 실행되지 않았습니다',
  PROCESSING_FAILED: '처리 실패 · 안전하게 중지되었습니다',
};

/**
 * Deterministic per-profile/intake/kind status identity (R2 recovery design §5.3): the lowercase SHA-256 hex of the
 * canonical `{schemaVersion, profileId, intakeId, statusKind}`, prefixed `as1status-` — 74 ASCII bytes, a valid
 * opaque id/path segment. The same status for the same profile/intake has EXACTLY one journal identity; a different
 * kind has a different identity. No timestamp, retry counter, reason, channel, or caller nonce participates.
 */
export function userStatusOutboundId(profileId: string, intakeId: string, statusKind: As1UserStatusKind): string {
  const digest = hashCanonical({
    schemaVersion: 'agent-office.as1-user-status-identity.v1',
    profileId,
    intakeId,
    statusKind,
  }).slice('sha256:'.length);
  return `as1status-${digest}`;
}

/** Render one closed status kind to its exact constant text and re-run the same leak/injection/bound guards as the
 *  accepted renderer (defense in depth — the text is a compile-time constant and never carries caller data). */
function renderStatusText(statusKind: As1UserStatusKind): string {
  const text = AS1_USER_STATUS_TEXT[statusKind];
  if (containsSecretShapedValue(text)) {
    throw new DomainError('INVALID_SCHEMA', 'status text carries a token-shaped or bearer-like value');
  }
  if (MENTION_CONTROL.test(text)) {
    throw new DomainError('INVALID_SCHEMA', 'status text carries a Slack mention control form');
  }
  return requireBoundedMessageText(text, 'status text');
}

export interface As1OutboxJournal {
  persistOutboundArtifact(outboundId: string, rendered: unknown): Promise<{ readonly relativePath: string; readonly sha256: string }>;
  recordOutboxPhase(outboundId: string, phase: As1OutboxPhase, hashes?: As1OutboxHashes): Promise<void>;
  readOutboxPhase(outboundId: string): Promise<string | null>;
  readOutboxRecord(outboundId: string): Promise<{ readonly phase: string; readonly requestHash: string | null; readonly responseHash: string | null } | null>;
}

/** Resolve the immutable accepted root correlation for an intake from the profile-local store (never a caller). */
export interface As1RootResolver {
  findRootByIntakeId(intakeId: string): Promise<As1RootCorrelationV1 | null>;
}

/**
 * The validated per-profile owner secret the outbox is constructed with — the ONLY channel/token source, and the
 * workspace/app identity that (with the profile) recomputes the accepted root's rootKeyHash (review B07).
 */
export interface As1OutboxProfileSecret {
  readonly workspaceId: string;
  readonly appId: string;
  readonly channelId: string;
  readonly botToken: string;
}

export type As1DeliverySendOutcome =
  | 'DELIVERED'
  | 'MANUAL_RECONCILIATION_REQUIRED'
  | 'REJECTED_RENDER'
  | 'REJECTED_CONTROL'
  | 'REJECTED_ROOT'
  | 'REJECTED_STORE';

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

/**
 * A profile-bound rendered-outbound sender. Channel, thread, token, store, latch, and control are all fixed at
 * construction from composition; `send` cannot select a target OR an identity. It accepts ONLY a branded accepted
 * value (which a raw caller cannot fabricate), derives the durable outbound id deterministically from that
 * accepted evidence id, resolves the immutable root by the record's intakeId, requires the intake to match the
 * root and the root's key hash to match the bound config, and uses ONLY the bound profile secret's channel/token.
 */
export class As1Outbox {
  public constructor(private readonly deps: As1OutboxDependencies) {}

  public async send(accepted: As1AcceptedOutbound): Promise<As1OutboxResult> {
    // The existing branded accepted path (ACK/QUESTION/RESULT) — unchanged semantics. Derive the deterministic
    // accepted outbound id, resolve the record's intake, and route through the shared state machine; the render
    // runs at the exact original position (after resume + root validation) so REJECTED_RENDER is unchanged.
    return this.guardQuarantine(() => {
      const record = acceptedOutboundRecord(accepted);
      return this.runOutbox(
        acceptedOutboundId(accepted),
        record.intakeId,
        () => renderOutbound(record),
        (text, root, channel, threadTs) => ({
          kind: record.kind,
          profileId: this.deps.profile.profileId,
          intakeId: record.intakeId,
          rootTs: root.rootTs,
          rootKeyHash: root.rootKeyHash,
          sourceEventId: root.sourceEventId,
          channel,
          threadTs,
          text,
        }),
        null, // the accepted evidence path has no status-ordering guard
      );
    });
  }

  /**
   * Send ONE closed same-thread user status (R2 recovery design §5). It accepts neither a target nor text: the
   * channel/thread come only from the bound profile secret and the immutable accepted root for `intakeId`, and the
   * text is the total constant for `statusKind`. It shares the EXACT root-resolution, request-artifact, phase,
   * retry, response-validation, and reconciliation path as accepted evidence, and reuses the deterministic
   * `as1status-` identity so a same-kind replay re-derives byte-identical request content or reconciles — it never
   * replaces an artifact and never resends REQUEST_STARTED.
   */
  public async sendStatus(intakeId: string, statusKind: As1UserStatusKind): Promise<As1OutboxResult> {
    return this.guardQuarantine(() =>
      this.runOutbox(
        userStatusOutboundId(this.deps.profile.profileId, intakeId, statusKind),
        intakeId,
        () => renderStatusText(statusKind),
        (text, root, channel, threadTs) => ({
          kind: 'USER_STATUS',
          statusKind,
          profileId: this.deps.profile.profileId,
          intakeId,
          rootTs: root.rootTs,
          rootKeyHash: root.rootKeyHash,
          sourceEventId: root.sourceEventId,
          channel,
          threadTs,
          text,
        }),
        // R2 recovery §5.6: the status-specific ordering guard is re-checked at entry AND before EVERY durable/Web
        // side effect, so a sibling failure record appearing mid-send aborts the status with its exact outbox state
        // preserved. It permits only byte-identical recovery of the SAME failure status from its own PREPARED record.
        () => this.assertStatusOrderable(intakeId, statusKind),
      ),
    );
  }

  /**
   * The status-specific ordering guard (R2 recovery design §5.6). Over ALL durable outbox phases it enforces: every
   * status after ACCEPTED requires the deterministic ACCEPTED record at RESPONSE_RECORDED; DELIVERY_CONFIRMED begins
   * only while both failure siblings are wholly absent; DELIVERY_FAILED only while DELIVERY_CONFIRMED and
   * PROCESSING_FAILED are absent; PROCESSING_FAILED only while DELIVERY_FAILED is absent (it may follow
   * DELIVERY_CONFIRMED); and both failure records present is a conflict. It NEVER blocks a status's OWN record (that is
   * the same-failure recovery path resolved by the resume logic). It throws a redacted GATEWAY_DISABLED code; the
   * caller preserves the outbox state, latches, and halts — no sibling or business operation runs behind a barrier.
   */
  private async assertStatusOrderable(intakeId: string, statusKind: As1UserStatusKind): Promise<void> {
    const profileId = this.deps.profile.profileId;
    const phaseOf = async (kind: As1UserStatusKind): Promise<string | null> =>
      (await this.deps.store.readOutboxRecord(userStatusOutboundId(profileId, intakeId, kind)))?.phase ?? null;
    const acceptedPhase = await phaseOf('ACCEPTED');
    const deliveryConfirmed = (await phaseOf('DELIVERY_CONFIRMED')) !== null;
    const deliveryFailed = (await phaseOf('DELIVERY_FAILED')) !== null;
    const processingFailed = (await phaseOf('PROCESSING_FAILED')) !== null;
    if (deliveryFailed && processingFailed) {
      throw new DomainError('GATEWAY_DISABLED', 'status-ordering: FAILURE_STATUS_CONFLICT'); // rule 8
    }
    if (statusKind !== 'ACCEPTED' && acceptedPhase !== 'RESPONSE_RECORDED') {
      throw new DomainError('GATEWAY_DISABLED', 'status-ordering: ACCEPTED_NOT_TERMINAL'); // rules 1-2
    }
    switch (statusKind) {
      case 'ACCEPTED':
        if (deliveryConfirmed || deliveryFailed || processingFailed) {
          throw new DomainError('GATEWAY_DISABLED', 'status-ordering: LATER_STATUS_PRESENT');
        }
        break;
      case 'DELIVERY_CONFIRMED':
        if (deliveryFailed || processingFailed) {
          throw new DomainError('GATEWAY_DISABLED', 'status-ordering: FAILURE_BARRIER'); // rule 4
        }
        break;
      case 'DELIVERY_FAILED':
        if (deliveryConfirmed || processingFailed) {
          throw new DomainError('GATEWAY_DISABLED', 'status-ordering: FAILURE_BARRIER'); // rule 3
        }
        break;
      case 'PROCESSING_FAILED':
        if (deliveryFailed) {
          throw new DomainError('GATEWAY_DISABLED', 'status-ordering: FAILURE_BARRIER'); // rule 5 (CONFIRMED may precede)
        }
        break;
    }
  }

  /** A durable STORE_QUARANTINED from a journal/root store operation must NOT escape unlatched: durably latch the
   *  profile with a stable code and fail closed with no network (review B08). Shared by every send entry point. */
  private async guardQuarantine(op: () => Promise<As1OutboxResult>): Promise<As1OutboxResult> {
    try {
      return await op();
    } catch (error) {
      if (error instanceof DomainError && error.code === 'STORE_QUARANTINED') {
        await this.deps.latch('outbox durable store quarantined');
        return { outcome: 'REJECTED_STORE', phase: 'PREPARED', attempts: 0, reason: 'STORE_QUARANTINED' };
      }
      throw error;
    }
  }

  /**
   * The single durable outbound state machine shared by accepted evidence and user status. `renderText` runs at the
   * exact original position — AFTER the resume/no-blind-resend check and root-target validation, BEFORE any durable
   * write — so a render rejection is REJECTED_RENDER and an already-terminal record never renders; `buildRequestPayload`
   * yields the immutable request artifact. Resume, root+rootKeyHash validation, control gates, PREPARED/REQUEST_STARTED
   * phases, bounded safe retry, trusted-success response, and reconciliation are identical for both callers, so no
   * target or identity can be caller-selected.
   */
  private async runOutbox(
    outboundId: string,
    intakeId: string,
    renderText: () => string,
    buildRequestPayload: (text: string, root: As1RootCorrelationV1, channel: string, threadTs: string) => Record<string, unknown>,
    statusGuard: (() => Promise<void>) | null,
  ): Promise<As1OutboxResult> {
    const { profile, secret, store, web, latch, delay } = this.deps;

    // Resume: never touch the network once a terminal or in-flight phase is durable (no blind resend).
    const priorRecord = await store.readOutboxRecord(outboundId);
    const prior = priorRecord?.phase ?? null;
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

    // R2 recovery §5.6: status-ordering guard at ENTRY (before any new side effect). It is re-checked before every
    // durable/Web write below; a violation preserves the exact outbox state and returns REJECTED_CONTROL to the caller.
    const atEntry = await this.checkStatusOrdering(statusGuard, 'PREPARED');
    if (atEntry !== null) return atEntry;

    // Resolve the immutable accepted root by intakeId from the profile-local store; the root's intake must match, and
    // the root's rootKeyHash MUST equal the hash recomputed from the profile + bound secret's workspace/app/channel —
    // a config change (or a wrong root) refuses the send (review B07; R2 recovery design §5.4).
    const root = await store.findRootByIntakeId(intakeId);
    if (root?.intakeId !== intakeId) {
      return { outcome: 'REJECTED_ROOT', phase: 'PREPARED', attempts: 0, reason: 'no accepted root for the intake' };
    }
    const expectedRootKeyHash = rootKeyHash(profile.profileId, secret.workspaceId, secret.appId, secret.channelId, root.rootTs);
    if (root.rootKeyHash !== expectedRootKeyHash) {
      return { outcome: 'REJECTED_ROOT', phase: 'PREPARED', attempts: 0, reason: 'root key hash disagrees with the bound profile config' };
    }

    let text: string;
    try {
      text = renderText();
    } catch (error) {
      return { outcome: 'REJECTED_RENDER', phase: 'PREPARED', attempts: 0, reason: error instanceof DomainError ? error.code : 'render' };
    }

    const channel = secret.channelId;
    const threadTs = root.rootTs;
    const postRequest: As1PostMessageRequest = { channel, threadTs, text };
    const requestPayload = buildRequestPayload(text, root, channel, threadTs);

    // Control/latch gate + status-ordering guard immediately before the FIRST durable write (request artifact). Refuse
    // cleanly BEFORE REQUEST_STARTED.
    const refusal = (await this.gateBeforeStart()) ?? (await this.checkStatusOrdering(statusGuard, 'PREPARED'));
    if (refusal !== null) return refusal;
    const requestReceipt = await store.persistOutboundArtifact(outboundId, requestPayload);

    // PREPARED restart must be exact and immutable: a re-observed PREPARED must re-derive the IDENTICAL request
    // bytes; the same outboundId reused with different record/root/request bytes latches, never silently replaces.
    if (prior === 'PREPARED' && priorRecord?.requestHash != null && priorRecord.requestHash !== requestReceipt.sha256) {
      return await this.reconcile(outboundId, 0, 'outbound id reused with different request bytes');
    }

    // Control + status-ordering gate before the PREPARED write and again before REQUEST_STARTED (each durable write).
    const beforePrepared = (await this.gateBeforeStart()) ?? (await this.checkStatusOrdering(statusGuard, 'PREPARED'));
    if (beforePrepared !== null) return beforePrepared;
    await store.recordOutboxPhase(outboundId, 'PREPARED', { requestHash: requestReceipt.sha256 });
    const beforeStarted = (await this.gateBeforeStart()) ?? (await this.checkStatusOrdering(statusGuard, 'PREPARED'));
    if (beforeStarted !== null) return beforeStarted;
    await store.recordOutboxPhase(outboundId, 'REQUEST_STARTED');

    let attempts = 0;
    for (let attempt = 1; attempt <= LIMITS.OUTBOUND_MAX_ATTEMPTS; attempt += 1) {
      attempts = attempt;
      // Re-check control + status ordering immediately before every network send — either may have changed during a
      // retry backoff. A status-ordering violation preserves the REQUEST_STARTED state (REJECTED_CONTROL, no resend).
      try {
        await this.deps.assertSendable();
      } catch {
        return await this.reconcile(outboundId, attempts, 'control not sendable before send');
      }
      const beforeWeb = await this.checkStatusOrdering(statusGuard, 'REQUEST_STARTED');
      if (beforeWeb !== null) return beforeWeb;
      try {
        const response = await web.postMessage(secret.botToken, postRequest);
        if (this.isTrustedSuccess(response, channel)) {
          // Gate control + status ordering before the response artifact write and before the RESPONSE_RECORDED write.
          try {
            await this.deps.assertSendable();
          } catch {
            return await this.reconcile(outboundId, attempts, 'control not sendable before response write');
          }
          const beforeResponse = await this.checkStatusOrdering(statusGuard, 'REQUEST_STARTED');
          if (beforeResponse !== null) return beforeResponse;
          const responseReceipt = await store.persistOutboundArtifact(`${outboundId}.response`, { ok: true, channel: response.channel, ts: response.ts });
          try {
            await this.deps.assertSendable();
          } catch {
            return await this.reconcile(outboundId, attempts, 'control not sendable before response record');
          }
          const beforeRecord = await this.checkStatusOrdering(statusGuard, 'REQUEST_STARTED');
          if (beforeRecord !== null) return beforeRecord;
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

  /**
   * Assert the control gate before a PRE-REQUEST_STARTED durable write. On refusal returns a clean REJECTED_CONTROL
   * result (nothing terminal is committed); null means the write may proceed.
   */
  private async gateBeforeStart(): Promise<As1OutboxResult | null> {
    try {
      await this.deps.assertSendable();
      return null;
    } catch (error) {
      return { outcome: 'REJECTED_CONTROL', phase: 'PREPARED', attempts: 0, reason: error instanceof DomainError ? error.code : 'control not sendable' };
    }
  }

  /**
   * Run the status-ordering guard (if any) before a durable/Web side effect (R2 recovery §5.6). A violation returns a
   * clean REJECTED_CONTROL result carrying the redacted status-ordering reason — the exact outbox `phase` is preserved
   * (no resend, no reconcile), and the caller (composition) durably latches / enters the failure barrier. `null` when
   * there is no guard (the accepted evidence path) or ordering is still permitted.
   */
  private async checkStatusOrdering(statusGuard: (() => Promise<void>) | null, phase: As1OutboxPhase): Promise<As1OutboxResult | null> {
    if (statusGuard === null) return null;
    try {
      await statusGuard();
      return null;
    } catch (error) {
      // The status-ordering guard's message is a FIXED redacted `status-ordering: <REASON>` string (no payload), so
      // the caller can distinguish ACCEPTED_NOT_TERMINAL / FAILURE_BARRIER / FAILURE_STATUS_CONFLICT and act accordingly.
      return { outcome: 'REJECTED_CONTROL', phase, attempts: 0, reason: error instanceof DomainError ? error.message : 'status not orderable' };
    }
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
