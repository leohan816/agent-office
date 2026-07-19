// AS1 Multi-Team Slack Pilot — persist/bind-before-ACK orchestration and post-ACK materializer.
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_DESIGN.md §8 (envelope + ACK order),
// §9 (inbound policy matrix), §10 (root/thread correlation), §11 (intake); docs/security/
// AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md §9 (inbound pipeline). Security invariant:
//   durable receipt + dedupe + atomic first-root binding OR terminal rejection
//     happens-before  Socket ACK
//     happens-before  TRANSPORT_ACK_RECORDED
//     happens-before  asynchronous intake/pointer materialization.
// A receipt/dedupe/binding/consumption failure sends NO ACK. Materialization runs only from the durable
// TRANSPORT_ACK_RECORDED decision and never rechecks current receive-grant expiry. Slack text is opaque:
// the only parsing is bounded validation, deferred-query first-token rejection, top-level vs thread shape,
// and a fixed response kind from an already-durable pending question. `status`/`agents`/`missions` create
// no Mission.
import { DomainError } from '../../contracts/types.js';
import { isRecord } from '../../contracts/validation.js';
import { hashCanonical } from '../../persistence/file-store/hashing.js';
import {
  buildAdvisorPointer,
  buildContinuationIntake,
  buildNewMissionIntake,
  isDeferredQueryText,
  LIMITS,
  requireBoundedMessageText,
  requireSlackTs,
  type As1ContinuationKind,
  type As1PilotReceiveGrantV1,
} from './contracts.js';
import {
  As1ProfileInboundStore,
  rootKeyHash,
  type As1TransportObserved,
  type As1TransportRecordV1,
  type As1TransportState,
  type CommitPreAckInput,
} from './inbound-store.js';
import type { As1Profile, As1StrategyProfile } from './profiles.js';
import type { As1InboundEnvelope } from '../../adapters/gateways/slack-pilot/socket-client.js';

/**
 * Committed profile identity resolved at startup (from the secret record + pair proof). The profile is an Advisor
 * profile on the default/legacy path, or a Strategy profile on the reused personal-direct path (Strategy migration):
 * the PERSONAL path reads only the context identity fields (workspace/App/channel/Leo), never `profile.profileId`, so
 * either profile shape is safe here; the default path is reached only by Advisor profiles.
 */
export interface As1ProfileRuntimeContext {
  readonly profile: As1Profile | As1StrategyProfile;
  readonly workspaceId: string;
  readonly appId: string;
  readonly channelId: string;
  readonly leoUserId: string;
  readonly botUserId: string;
  /** Trusted local clock (ISO-8601 UTC). Used ONLY to reject an unreasonable-future Slack event time (§9.3). */
  readonly now: () => string;
}

export interface ProcessResult {
  readonly acked: boolean;
  readonly classification: string;
  readonly intakeId: string | null;
  readonly latched: boolean;
  /** Handoff 119: the PERSONAL_LEO_ONLY current-message correlation for a fresh, deduped Leo message (bounded text
   *  carried), when the runtime is PERSONAL and the envelope is a new Leo message. Absent for the default runtime. */
  readonly personal?: As1PersonalCorrelation;
}

/** Handoff 119: the PERSONAL_LEO_ONLY in-memory current-message correlation — NO receive grant, ROOT_BOUND, root slot,
 *  or evidence record. It carries only the message's own identity + immutable same-thread routing + bounded text. */
export interface As1PersonalCorrelation {
  readonly requestId: string;
  readonly sourceEventId: string;
  readonly threadTs: string;
  readonly channel: string;
  readonly text: string;
}

/**
 * Narrow operational control gate (review B05). It is the SOLE control/latch source and is backed in
 * production by the lock-owning `As1SlackControl` — never a second truth. It fails closed unless: the control
 * is open/owned, the global kill is disengaged, the active profile (if any) is exactly this profile, and this
 * profile is not latched. It is consulted before EVERY dequeue/ACK/mutation/materialization side effect. The
 * service cannot be constructed into a live path without it.
 */
export interface As1ProfileControlPort {
  /** True iff a LIVE inbound envelope/ACK may proceed now (RECEIVING for this exact profile). Entry check. */
  isReceiveActionable(): Promise<boolean>;
  /** Assert the same; throws GATEWAY_DISABLED otherwise. Immediately before each live-receive side effect. */
  assertReceiveActionable(): Promise<void>;
  /**
   * True iff a `PREACK_PENDING` record may ADVANCE now (non-disabled active state for this profile). When
   * false the record is left untouched — never advanced while disconnected/disabled — and it must not prevent
   * later ACK-recorded records from draining. Not a throw: the recovery loop skips instead.
   */
  isReceiveRecoveryActionable(): Promise<boolean>;
  /**
   * Assert the OFFLINE post-ACK drain gate for a `TRANSPORT_ACK_RECORDED` record: owned, unlatched, globally
   * clean, permitted in DISABLED_CLEAN (expired + disconnected) or an active state — no Socket reopen, no
   * active-profile inference. Throws GATEWAY_DISABLED otherwise.
   */
  assertDrainActionable(): Promise<void>;
  /** Persist the irreversible profile latch with a stable bounded reason CODE (first reason preserved). */
  latchProfile(reasonCode: string): Promise<void>;
}

interface ExtractedEvent {
  readonly eventId: string;
  readonly teamId: string;
  readonly apiAppId: string;
  readonly channel: string;
  readonly channelType: string;
  readonly user: string;
  readonly ts: string;
  readonly text: string;
  readonly threadTs: string | null;
  readonly event: Record<string, unknown>;
}

type Classification =
  | { readonly kind: 'ROOT_CANDIDATE'; readonly extracted: ExtractedEvent }
  | { readonly kind: 'CONTINUATION_CANDIDATE'; readonly extracted: ExtractedEvent }
  | { readonly kind: 'REJECTED'; readonly reason: string; readonly latch: boolean };


function readBoundedString(record: Record<string, unknown>, key: string, max = 256): string | null {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : null;
}

/** The EXACT key set the single selected-profile callback authorization must carry (design §7.7/§9.3). */
const AUTHORIZATION_KEYS = ['enterprise_id', 'team_id', 'user_id', 'is_bot', 'is_enterprise_install'] as const;

export class As1InboundService {
  private latched = false;
  /** The active receive grant. Fixed for the default runtime; in the PERSONAL_LEO_ONLY runtime the composition swaps
   *  in a freshly-minted single-use grant per message (handoff 116) via `useReceiveGrant`, so every `this.grant`
   *  reference below reads the current message's grant with no other change. */
  private activeGrant: As1PilotReceiveGrantV1;

  /** Handoff 119: PERSONAL_LEO_ONLY event dedupe + sequential in-memory current-message queue (no store/grant/root). */
  private readonly personalSeen = new Set<string>();
  private readonly personalQueue: As1PersonalCorrelation[] = [];

  public constructor(
    private readonly context: As1ProfileRuntimeContext,
    grant: As1PilotReceiveGrantV1,
    private readonly store: As1ProfileInboundStore,
    private readonly gate: As1ProfileControlPort,
    private readonly personalLeoOnly = false,
  ) {
    this.activeGrant = grant;
  }

  /** Handoff 119: pop the oldest queued PERSONAL current-message correlation (sequential; one in flight at a time). */
  public takeNextPersonal(): As1PersonalCorrelation | null {
    return this.personalQueue.shift() ?? null;
  }

  /** Fixed Strategy status stream: extract ONLY the next matching status control from the FIFO, preserving the relative
   *  order of all ordinary entries. Returns null when no queued control matches. */
  public takeNextPersonalStatusControl(isControl: (text: string) => boolean): As1PersonalCorrelation | null {
    const index = this.personalQueue.findIndex((entry) => isControl(entry.text));
    if (index === -1) return null;
    const [entry] = this.personalQueue.splice(index, 1);
    return entry ?? null;
  }

  /**
   * Handoff 119 PERSONAL_LEO_ONLY intake bypass: fixed Leo/workspace/App/channel allowlist + exact source-event-id
   * dedupe + a sequential in-memory correlation carrying bounded text. NO receive-grant binding, ROOT_BOUND/root slot,
   * envelope/event hash, or evidence record. A duplicate/foreign/malformed event enqueues nothing and is acked-or-dropped.
   */
  private async handlePersonalEnvelope(envelope: As1InboundEnvelope): Promise<ProcessResult> {
    const extracted = this.tryExtractIdentity(envelope);
    if (extracted === null) return { acked: false, classification: 'MALFORMED_NO_ENVELOPE_ID', intakeId: null, latched: false };
    if (
      extracted.teamId !== this.context.workspaceId ||
      extracted.apiAppId !== this.context.appId ||
      extracted.channel !== this.context.channelId ||
      extracted.user !== this.context.leoUserId
    ) {
      return { acked: false, classification: 'REJECTED_FIXED_ALLOWLIST', intakeId: null, latched: false };
    }
    // A safely-parsed valid/duplicate Leo event is transport-ACKed through the raw envelope callback. An ordinary ACK
    // failure is message-local (swallowed) — never a global/profile latch (the caller passes the non-guarded ack).
    await envelope.acknowledge().catch(() => undefined);
    if (this.personalSeen.has(extracted.eventId)) {
      return { acked: true, classification: 'DUPLICATE_EVENT', intakeId: null, latched: false };
    }
    this.personalSeen.add(extracted.eventId);
    const threadTs = extracted.threadTs !== null && extracted.threadTs !== extracted.ts ? extracted.threadTs : extracted.ts;
    const personal: As1PersonalCorrelation = {
      requestId: extracted.eventId,
      sourceEventId: extracted.eventId,
      threadTs,
      channel: extracted.channel,
      text: extracted.text,
    };
    this.personalQueue.push(personal);
    return { acked: true, classification: 'PERSONAL_ROOT', intakeId: personal.requestId, latched: false, personal };
  }

  private get grant(): As1PilotReceiveGrantV1 {
    return this.activeGrant;
  }

  /** Handoff 116 (PERSONAL_LEO_ONLY only): swap the active single-use receive grant BETWEEN messages. Never called by
   *  the default runtime, so the fixed-grant behavior is byte-unchanged. */
  public useReceiveGrant(grant: As1PilotReceiveGrantV1): void {
    this.activeGrant = grant;
  }

  public isLatched(): boolean {
    return this.latched;
  }

  /** Classify a raw envelope against the reviewed policy matrix (design §9). Pure and side-effect free. */
  public classify(envelope: As1InboundEnvelope): Classification {
    const payload = envelope.payload;
    if (!isRecord(payload) || payload.type !== 'event_callback') {
      return { kind: 'REJECTED', reason: 'REJECTED_SURFACE', latch: false };
    }
    const teamId = readBoundedString(payload, 'team_id');
    const apiAppId = readBoundedString(payload, 'api_app_id');
    const eventId = readBoundedString(payload, 'event_id');
    if (teamId === null || apiAppId === null || eventId === null) {
      return { kind: 'REJECTED', reason: 'REJECTED_SURFACE', latch: false };
    }
    if (teamId !== this.context.workspaceId || apiAppId !== this.context.appId) {
      return { kind: 'REJECTED', reason: 'REJECTED_IDENTITY', latch: true };
    }
    // §7.7/§9.3: the callback MUST carry EXACTLY one selected-profile authorization — an object with the exact
    // key set {enterprise_id, team_id, user_id, is_bot, is_enterprise_install} — for THIS workspace + startup bot
    // user, with is_bot === true, is_enterprise_install === false, and enterprise_id === null. Missing, multiple,
    // extra/missing fields, cross-team, non-bot, or ANY enterprise install/id fails closed (latched identity).
    const authorizations = payload.authorizations;
    if (!Array.isArray(authorizations) || authorizations.length !== 1 || !isRecord(authorizations[0])) {
      return { kind: 'REJECTED', reason: 'REJECTED_IDENTITY', latch: true };
    }
    const authorization = authorizations[0];
    if (
      Object.keys(authorization).length !== AUTHORIZATION_KEYS.length ||
      !AUTHORIZATION_KEYS.every((key) => Object.prototype.hasOwnProperty.call(authorization, key)) ||
      authorization.enterprise_id !== null ||
      authorization.is_bot !== true ||
      authorization.is_enterprise_install !== false ||
      readBoundedString(authorization, 'team_id') !== this.context.workspaceId ||
      readBoundedString(authorization, 'user_id') !== this.context.botUserId
    ) {
      return { kind: 'REJECTED', reason: 'REJECTED_IDENTITY', latch: true };
    }
    const event = payload.event;
    if (!isRecord(event)) {
      return { kind: 'REJECTED', reason: 'REJECTED_SURFACE', latch: false };
    }
    if (event.type !== 'message') {
      return { kind: 'REJECTED', reason: 'REJECTED_SURFACE', latch: false };
    }
    if (typeof event.subtype === 'string' || event.hidden === true) {
      return { kind: 'REJECTED', reason: 'REJECTED_MUTATION_OR_SUBTYPE', latch: false };
    }
    if ('bot_id' in event || 'app_id' in event || 'bot_profile' in event || event.user === this.context.botUserId) {
      return { kind: 'REJECTED', reason: 'REJECTED_NON_LEO_OR_BOT', latch: false };
    }
    if (event.channel_type !== 'group') {
      return { kind: 'REJECTED', reason: 'REJECTED_SURFACE', latch: false };
    }
    if (event.is_ext_shared_channel === true) {
      return { kind: 'REJECTED', reason: 'REJECTED_IDENTITY', latch: true };
    }
    if (event.channel !== this.context.channelId) {
      return { kind: 'REJECTED', reason: 'REJECTED_IDENTITY', latch: true };
    }
    if (event.user !== this.context.leoUserId) {
      return { kind: 'REJECTED', reason: 'REJECTED_IDENTITY', latch: true };
    }
    const ts = readBoundedString(event, 'ts', 32);
    const user = readBoundedString(event, 'user');
    const channel = readBoundedString(event, 'channel');
    if (ts === null || user === null || channel === null) {
      return { kind: 'REJECTED', reason: 'REJECTED_SURFACE', latch: false };
    }
    let text: string;
    try {
      text = requireBoundedMessageText(event.text, 'event.text');
      requireSlackTs(ts, 'event.ts');
    } catch {
      return { kind: 'REJECTED', reason: 'REJECTED_SURFACE', latch: false };
    }
    // §9.3: event.event_ts must equal event.ts, and payload.event_time must be a bounded unix-seconds integer.
    // Slack time is CORRELATION ONLY — it never sets receive-grant expiry — but an event whose time is
    // unreasonably in the FUTURE vs the trusted local clock is a replay/forgery signal and fails closed.
    const eventTs = readBoundedString(event, 'event_ts', 32);
    if (eventTs === null || eventTs !== ts) {
      return { kind: 'REJECTED', reason: 'REJECTED_SURFACE', latch: false };
    }
    const eventTime = payload.event_time;
    if (typeof eventTime !== 'number' || !Number.isInteger(eventTime) || eventTime <= 0 || eventTime > 9_999_999_999) {
      return { kind: 'REJECTED', reason: 'REJECTED_SURFACE', latch: false };
    }
    // A non-parseable trusted clock cannot prove the event is not from the future — fail closed, never skip.
    const nowMs = Date.parse(this.context.now());
    if (!Number.isFinite(nowMs) || eventTime * 1_000 > nowMs + LIMITS.RECEIVE_GRANT_MAX_LIFETIME_MS) {
      return { kind: 'REJECTED', reason: 'REJECTED_IDENTITY', latch: true };
    }
    if (isDeferredQueryText(text)) {
      return { kind: 'REJECTED', reason: 'REJECTED_DEFERRED_QUERY', latch: false };
    }
    const threadTsRaw = event.thread_ts;
    const extracted: ExtractedEvent = {
      eventId,
      teamId,
      apiAppId,
      channel,
      channelType: 'group',
      user,
      ts,
      text,
      threadTs: typeof threadTsRaw === 'string' ? threadTsRaw : null,
      event,
    };
    if (extracted.threadTs !== null) {
      if (extracted.threadTs === extracted.ts) {
        // A top-level event carrying its own thread_ts is not a root and not a continuation.
        return { kind: 'REJECTED', reason: 'REJECTED_THREAD_CORRELATION', latch: false };
      }
      return { kind: 'CONTINUATION_CANDIDATE', extracted };
    }
    return { kind: 'ROOT_CANDIDATE', extracted };
  }

  public async processEnvelope(envelope: As1InboundEnvelope): Promise<ProcessResult> {
    // Handoff 119: PERSONAL_LEO_ONLY takes the fully bypassed in-memory intake path (fixed allowlist + dedupe +
    // correlation) BEFORE the legacy global/profile latch gate — startup validated once, no per-message latch traversal.
    // The default runtime path below (latch gate + receive-grant/ROOT_BOUND/root-slot/evidence intake) is byte-unchanged.
    if (this.personalLeoOnly) return this.handlePersonalEnvelope(envelope);
    // Graceful entry gate: control open/owned, no global kill, active profile matches, this profile not latched.
    // The gate is re-asserted immediately before every subsequent side effect below (review B05).
    if (this.latched || !(await this.gate.isReceiveActionable())) {
      return { acked: false, classification: 'PROFILE_LATCHED', intakeId: null, latched: true };
    }
    if (envelope.envelopeId.length === 0) {
      // Malformed input with no safely parsed envelope ID: no state mutation and no ACK (design §12.3).
      return { acked: false, classification: 'MALFORMED_NO_ENVELOPE_ID', intakeId: null, latched: false };
    }
    const classification = this.classify(envelope);
    try {
      if (classification.kind === 'REJECTED') {
        return await this.handleRejection(envelope, classification.reason, classification.latch);
      }
      if (classification.kind === 'ROOT_CANDIDATE') {
        return await this.handleRoot(envelope, classification.extracted);
      }
      return await this.handleContinuation(envelope, classification.extracted);
    } catch (error) {
      // A durable corruption/capacity failure persists the profile latch with a STABLE bounded reason code —
      // never a raw error message — before surfacing (review B05).
      if (error instanceof DomainError && error.code === 'STORE_QUARANTINED') {
        await this.latchProfile('STORE_QUARANTINED');
      }
      throw error;
    }
  }

  private async latchProfile(reasonCode: string): Promise<void> {
    await this.gate.latchProfile(reasonCode);
    this.latched = true;
  }

  private async handleRejection(envelope: As1InboundEnvelope, reason: string, latch: boolean): Promise<ProcessResult> {
    await this.gate.assertReceiveActionable();
    await this.store.recordDenialAudit(reason, null, envelope.envelopeId);
    if (latch) {
      // An authenticated-profile identity contradiction persists a durable latch and refuses; it is not ACKed.
      await this.latchProfile(reason);
      return { acked: false, classification: reason, intakeId: null, latched: true };
    }
    // An ACKable rejection WITH a usable envelope and event identity is driven through the SAME durable transport
    // state machine to an exactly-once TERMINAL_NO_INTAKE, so a crash/retry/restart reproduces the immutable
    // terminal decision rather than re-ACKing a fresh denial (review B02). A rejection without a usable durable
    // identity (malformed envelope/event, no valid ts/text) has no record a retry could diverge on, so it keeps
    // the audited ACK path.
    const extracted = this.tryExtractIdentity(envelope);
    if (extracted !== null) {
      return this.driveRejection(envelope, extracted, reason);
    }
    await this.gate.assertReceiveActionable();
    await envelope.acknowledge();
    return { acked: true, classification: reason, intakeId: null, latched: false };
  }

  /**
   * Structural (policy-free) extraction of a usable event identity from a raw envelope: an event_callback whose
   * message event carries a valid bounded ts and text. Returns null when no durable identity is bindable. The
   * reviewed policy (mutation/bot/surface/identity/deferred/thread) is decided separately by classify(); this only
   * asks whether a durable transport record CAN be opened for the event (review B02).
   */
  private tryExtractIdentity(envelope: As1InboundEnvelope): ExtractedEvent | null {
    const payload = envelope.payload;
    if (!isRecord(payload) || payload.type !== 'event_callback') return null;
    const teamId = readBoundedString(payload, 'team_id');
    const apiAppId = readBoundedString(payload, 'api_app_id');
    const eventId = readBoundedString(payload, 'event_id');
    if (teamId === null || apiAppId === null || eventId === null) return null;
    const event = payload.event;
    if (!isRecord(event) || event.type !== 'message') return null;
    const ts = readBoundedString(event, 'ts', 32);
    const user = readBoundedString(event, 'user');
    const channel = readBoundedString(event, 'channel');
    if (ts === null || user === null || channel === null) return null;
    let text: string;
    try {
      text = requireBoundedMessageText(event.text, 'event.text');
      requireSlackTs(ts, 'event.ts');
    } catch {
      return null;
    }
    const threadTsRaw = event.thread_ts;
    return {
      eventId,
      teamId,
      apiAppId,
      channel,
      channelType: typeof event.channel_type === 'string' ? event.channel_type : '',
      user,
      ts,
      text,
      threadTs: typeof threadTsRaw === 'string' ? threadTsRaw : null,
      event,
    };
  }

  /**
   * Drive an ACKable policy rejection through the durable transport state machine: persist the receipt, dedupe,
   * open the record DIRECTLY in the committed PREACK_REJECTED state (no PENDING window, so recovery never
   * re-derives a bind), then ACK and terminalize exactly once (review B02).
   */
  private async driveRejection(envelope: As1InboundEnvelope, extracted: ExtractedEvent, reason: string): Promise<ProcessResult> {
    await this.gate.assertReceiveActionable();
    const receipt = await this.store.persistReceipt(extracted.eventId, envelope.payload, extracted.text);
    const rootTs = extracted.threadTs !== null && extracted.threadTs !== extracted.ts ? extracted.threadTs : extracted.ts;
    const candidateKind: 'ROOT' | 'CONTINUATION' = rootTs === extracted.ts ? 'ROOT' : 'CONTINUATION';
    const observed: As1TransportObserved = {
      candidateKind,
      sourceEventId: extracted.eventId,
      rootTs,
      rootKeyHash: this.rootKeyFor(rootTs),
      receiptArtifactRef: receipt.receiptArtifactRef,
      receiptArtifactHash: receipt.receiptArtifactHash,
      messageArtifactRef: receipt.messageArtifactRef,
      messageArtifactHash: receipt.messageArtifactHash,
    };
    await this.recordDedupe(envelope, extracted);
    const record = await this.store.openRejectedTransport(
      extracted.eventId,
      envelope.envelopeId,
      hashCanonical(envelope.payload),
      hashCanonical(extracted.event),
      observed,
      reason,
    );
    return this.advanceCommittedTransport(envelope, extracted.eventId, record, record.state);
  }

  private rootKeyFor(rootTs: string): string {
    return rootKeyHash(
      this.context.profile.profileId,
      this.context.workspaceId,
      this.context.appId,
      this.context.channelId,
      rootTs,
    );
  }

  private async handleRoot(envelope: As1InboundEnvelope, extracted: ExtractedEvent): Promise<ProcessResult> {
    await this.gate.assertReceiveActionable();
    const receipt = await this.store.persistReceipt(extracted.eventId, envelope.payload, extracted.text);
    const rootKey = this.rootKeyFor(extracted.ts);
    const observed: As1TransportObserved = {
      candidateKind: 'ROOT',
      sourceEventId: extracted.eventId,
      rootTs: extracted.ts,
      rootKeyHash: rootKey,
      receiptArtifactRef: receipt.receiptArtifactRef,
      receiptArtifactHash: receipt.receiptArtifactHash,
      messageArtifactRef: receipt.messageArtifactRef,
      messageArtifactHash: receipt.messageArtifactHash,
    };
    await this.recordDedupe(envelope, extracted);
    return this.driveInbound(envelope, extracted, observed, async () => {
      await this.store.initReceiveGrantState(this.grant);
      const bind = await this.store.bindFirstRoot(this.grant, {
        sourceEventId: extracted.eventId,
        rootTs: extracted.ts,
        rootKeyHash: rootKey,
        receiptArtifactRef: receipt.receiptArtifactRef,
        receiptArtifactHash: receipt.receiptArtifactHash,
        messageArtifactHash: receipt.messageArtifactHash,
      });
      if (bind.outcome === 'ROOT_BOUND') {
        return { decision: 'ROOT_BOUND', terminalReason: null, bindingStateHash: bind.state.stateHash, continuation: null };
      }
      return { decision: 'REJECTED', terminalReason: bind.outcome, bindingStateHash: bind.state.stateHash, continuation: null };
    });
  }

  private async handleContinuation(envelope: As1InboundEnvelope, extracted: ExtractedEvent): Promise<ProcessResult> {
    const threadTs = extracted.threadTs;
    if (threadTs === null) {
      return this.handleRejection(envelope, 'REJECTED_THREAD_CORRELATION', false);
    }
    // A genuinely new correlation must name a bound root with one open question. A re-delivery of an event
    // that already has a durable transport decision skips this gate and reproduces only that durable decision.
    const alreadyRecorded = (await this.store.readTransport(extracted.eventId)) !== null;
    if (!alreadyRecorded) {
      const root = await this.store.findRootByThreadTs(threadTs);
      const openQuestion = root === null ? null : await this.store.findOpenQuestionForRoot(threadTs);
      if (root === null || openQuestion === null) {
        return this.handleRejection(envelope, 'REJECTED_THREAD_CORRELATION', false);
      }
    }
    await this.gate.assertReceiveActionable();
    const receipt = await this.store.persistReceipt(extracted.eventId, envelope.payload, extracted.text);
    const rootKey = this.rootKeyFor(threadTs);
    const observed: As1TransportObserved = {
      candidateKind: 'CONTINUATION',
      sourceEventId: extracted.eventId,
      rootTs: threadTs,
      rootKeyHash: rootKey,
      receiptArtifactRef: receipt.receiptArtifactRef,
      receiptArtifactHash: receipt.receiptArtifactHash,
      messageArtifactRef: receipt.messageArtifactRef,
      messageArtifactHash: receipt.messageArtifactHash,
    };
    await this.recordDedupe(envelope, extracted);
    return this.driveInbound(envelope, extracted, observed, async () => {
      const root = await this.store.findRootByThreadTs(threadTs);
      const consume = await this.store.consumeQuestion(this.grant, threadTs, extracted.eventId);
      if (consume.outcome === 'CONSUMED' && root !== null && consume.question !== null) {
        return {
          decision: 'CONTINUATION_CONSUMED',
          terminalReason: null,
          bindingStateHash: root.bindingStateHash,
          continuation: {
            kind: consume.question.expectedResponseKind,
            originalIntakeId: root.intakeId,
            questionId: consume.question.questionId,
          },
        };
      }
      const reason = consume.outcome === 'CONSUMED' ? 'REJECTED_THREAD_CORRELATION' : consume.outcome;
      return { decision: 'REJECTED', terminalReason: reason, bindingStateHash: null, continuation: null };
    });
  }

  private async recordDedupe(envelope: As1InboundEnvelope, extracted: ExtractedEvent): Promise<void> {
    // Both §8.3 dedupe keys plus the immutable byte guard. Its return is not trusted for control flow; the
    // durable transport state machine is the sole driver of the ACK/materialize decision.
    await this.store.insertDedupe({
      envelopeId: envelope.envelopeId,
      teamId: extracted.teamId,
      apiAppId: extracted.apiAppId,
      eventId: extracted.eventId,
      rawEnvelopeHash: hashCanonical(envelope.payload),
      innerEventHash: hashCanonical(extracted.event),
      preAckClass: 'PREACK_PENDING',
    });
  }

  /**
   * The single durable-state-driven inbound engine (design §8.2/§8.3/§12.3/§15.1). Fresh delivery, exact
   * Slack retry, and every crash-boundary resume all converge here: it advances the one hash-bound transport
   * record and never fabricates an ACK for an unfinished decision. A re-delivery reproduces only the exact
   * durable transport decision.
   */
  private async driveInbound(
    envelope: As1InboundEnvelope,
    extracted: ExtractedEvent,
    observed: As1TransportObserved,
    decide: () => Promise<CommitPreAckInput>,
  ): Promise<ProcessResult> {
    const opened = await this.store.openTransport(
      extracted.eventId,
      envelope.envelopeId,
      hashCanonical(envelope.payload),
      hashCanonical(extracted.event),
      observed,
    );
    let record = opened;
    // Re-assert the control gate immediately before EACH side effect (pre-ACK mutation, ACK, materialization) —
    // a global kill or profile latch engaged after the entry check blocks the next step (review B05).
    // 1. PREACK_PENDING -> committed pre-ACK decision (the sole receive-expiry linearization is inside decide()).
    if (record.state === 'PREACK_PENDING') {
      await this.gate.assertReceiveActionable();
      record = await this.store.commitPreAckDecision(extracted.eventId, await decide());
    }
    return this.advanceCommittedTransport(envelope, extracted.eventId, record, opened.state);
  }

  /**
   * Advance a transport record that already carries a committed pre-ACK decision through the Socket ACK and the
   * terminal step (materialize or TERMINAL_NO_INTAKE), reproducing only the durable decision on any resume. Shared
   * by the root/continuation engine and the ACKable-rejection engine (review B02).
   */
  private async advanceCommittedTransport(
    envelope: As1InboundEnvelope,
    eventId: string,
    initial: As1TransportRecordV1,
    startState: As1TransportState,
  ): Promise<ProcessResult> {
    let record = initial;
    let acked = false;
    // 2. committed pre-ACK decision -> Socket ACK -> durable TRANSPORT_ACK_RECORDED.
    if (
      record.state === 'PREACK_ROOT_BOUND' ||
      record.state === 'PREACK_CONTINUATION_CONSUMED' ||
      record.state === 'PREACK_REJECTED'
    ) {
      await this.gate.assertReceiveActionable();
      await envelope.acknowledge();
      acked = true;
      record = await this.store.commitTransportAck(eventId);
    }

    // 3. TRANSPORT_ACK_RECORDED -> MATERIALIZED | TERMINAL_NO_INTAKE.
    if (record.state === 'TRANSPORT_ACK_RECORDED') {
      if (!acked) {
        // A prior attempt recorded the ACK but crashed before this step; reproduce only the durable ACK.
        await this.gate.assertReceiveActionable();
        await envelope.acknowledge();
        acked = true;
      }
      await this.gate.assertReceiveActionable();
      if (record.preAckDecision === 'REJECTED') {
        await this.store.commitTerminalNoIntake(eventId);
      } else {
        await this.materializeFromTransport(record);
      }
      record = (await this.store.readTransport(eventId)) ?? record;
    }

    // 4. Already terminal on entry (a fully processed prior delivery): reproduce only the durable ACK.
    if (!acked && (record.state === 'MATERIALIZED' || record.state === 'TERMINAL_NO_INTAKE')) {
      await this.gate.assertReceiveActionable();
      await envelope.acknowledge();
      acked = true;
    }

    // A prior invocation already committed the full durable ACK decision; this delivery only reproduced it.
    if (startState === 'MATERIALIZED' || startState === 'TERMINAL_NO_INTAKE') {
      return { acked, classification: 'DUPLICATE', intakeId: null, latched: false };
    }
    if (record.preAckDecision === 'ROOT_BOUND') {
      return { acked, classification: 'NEW_MISSION_ROOT', intakeId: record.intakeId, latched: false };
    }
    if (record.preAckDecision === 'CONTINUATION_CONSUMED') {
      return { acked, classification: 'CONTINUATION', intakeId: record.intakeId, latched: false };
    }
    return { acked, classification: record.terminalReason ?? 'REJECTED', intakeId: null, latched: false };
  }

  /**
   * Bounded startup recovery (design §15.1). With no live envelope it never fabricates an ACK: it commits the
   * pre-ACK decision for a `PREACK_PENDING` record by re-linearizing against expiry, and it drains one-time
   * materialization for every durable `TRANSPORT_ACK_RECORDED` decision without reopening the Socket.
   */
  public async recoverPending(): Promise<void> {
    if (this.latched) return;
    for (const record of await this.store.listNonTerminalTransport()) {
      // Record-kind-aware recovery gate, re-checked between loop items (review B05):
      if (record.state === 'PREACK_PENDING') {
        // Advance a PREACK_PENDING record ONLY under an active/unexpired receive recovery gate. While
        // disconnected/disabled it is left untouched (skipped) and must not block later ACK-recorded drains.
        if (await this.gate.isReceiveRecoveryActionable()) {
          await this.recoverPreAckDecision(record);
        }
      } else if (record.state === 'TRANSPORT_ACK_RECORDED') {
        // A durable ACK decision may drain offline (incl. DISABLED_CLEAN after expiry), never reopening a Socket.
        await this.gate.assertDrainActionable();
        if (record.preAckDecision === 'REJECTED') {
          await this.store.commitTerminalNoIntake(record.eventId);
        } else {
          await this.materializeFromTransport(record);
        }
      }
      // A committed pre-ACK-but-unACKed decision (PREACK_ROOT_BOUND/CONTINUATION_CONSUMED/REJECTED) is left
      // untouched for the exact Slack retry to reproduce the durable transport decision (design §15.1 step 3).
    }
  }

  /** Re-enter the serialized transition for a recovered `PREACK_PENDING` record; no ACK and no materialization. */
  private async recoverPreAckDecision(record: As1TransportRecordV1): Promise<void> {
    if (record.observed.candidateKind === 'ROOT') {
      await this.store.initReceiveGrantState(this.grant);
      const bind = await this.store.bindFirstRoot(this.grant, {
        sourceEventId: record.eventId,
        rootTs: record.observed.rootTs,
        rootKeyHash: record.observed.rootKeyHash,
        receiptArtifactRef: record.observed.receiptArtifactRef,
        receiptArtifactHash: record.observed.receiptArtifactHash,
        messageArtifactHash: record.observed.messageArtifactHash,
      });
      const input: CommitPreAckInput =
        bind.outcome === 'ROOT_BOUND'
          ? { decision: 'ROOT_BOUND', terminalReason: null, bindingStateHash: bind.state.stateHash, continuation: null }
          : { decision: 'REJECTED', terminalReason: bind.outcome, bindingStateHash: bind.state.stateHash, continuation: null };
      await this.store.commitPreAckDecision(record.eventId, input);
      return;
    }
    const root = await this.store.findRootByThreadTs(record.observed.rootTs);
    const consume = await this.store.consumeQuestion(this.grant, record.observed.rootTs, record.eventId);
    if (consume.outcome === 'CONSUMED' && root !== null && consume.question !== null) {
      await this.store.commitPreAckDecision(record.eventId, {
        decision: 'CONTINUATION_CONSUMED',
        terminalReason: null,
        bindingStateHash: root.bindingStateHash,
        continuation: {
          kind: consume.question.expectedResponseKind,
          originalIntakeId: root.intakeId,
          questionId: consume.question.questionId,
        },
      });
      return;
    }
    const reason = consume.outcome === 'CONSUMED' ? 'REJECTED_THREAD_CORRELATION' : consume.outcome;
    await this.store.commitPreAckDecision(record.eventId, {
      decision: 'REJECTED',
      terminalReason: reason,
      bindingStateHash: null,
      continuation: null,
    });
  }

  /** A short, collision-resistant, DETERMINISTIC id so a crash-retry regenerates byte-identical artifacts. */
  private deriveId(prefix: string, parts: Record<string, unknown>): string {
    return `${prefix}-${hashCanonical(parts).slice('sha256:'.length, 'sha256:'.length + 40)}`;
  }

  /**
   * Post-ACK materialization (design §11/§15.1). Runs only from a durable `TRANSPORT_ACK_RECORDED` decision,
   * binds and re-verifies the immutable accepted transition (not a mutable boolean), never rechecks current
   * receive-grant expiry, and creates exactly one intake+pointer. Deterministic ids + the durable ack time
   * make it byte-idempotent, so a crash between artifact and journal never yields a second intake.
   */
  private async materializeFromTransport(record: As1TransportRecordV1): Promise<string> {
    if (record.state === 'MATERIALIZED' && record.intakeId !== null) {
      return record.intakeId;
    }
    if (record.state !== 'TRANSPORT_ACK_RECORDED') {
      throw new DomainError('INVALID_TRANSITION', 'materialization requires a durable TRANSPORT_ACK_RECORDED decision');
    }
    if (record.preAckDecision !== 'ROOT_BOUND' && record.preAckDecision !== 'CONTINUATION_CONSUMED') {
      throw new DomainError('INVALID_TRANSITION', 'only a bound or consumed decision materializes an intake');
    }
    if (record.bindingStateHash === null || record.ackedAt === null) {
      throw new DomainError('INVALID_SCHEMA', 'the durable decision is missing its bound hashes');
    }
    if (this.latched) {
      throw new DomainError('FORBIDDEN_TARGET', 'a latched profile cannot materialize');
    }
    // Materialization is the legacy Advisor-only path: the personal-direct (PERSONAL_LEO_ONLY / Strategy) runtime never
    // materializes an intake/pointer. Narrow the widened profile to the Advisor union here, preserving that invariant
    // (a Strategy profile reaching materialization is a corruption, never a silent widening of the artifact contracts).
    const { profile } = this.context;
    if (profile.role === 'STRATEGY') {
      throw new DomainError('FORBIDDEN_TARGET', 'a strategy profile does not materialize (legacy Advisor-only path)');
    }
    const { observed } = record;
    const recordedAt = record.ackedAt;
    const intakeId = this.deriveId('as1i', {
      eventId: record.eventId,
      bindingStateHash: record.bindingStateHash,
      profileId: profile.profileId,
      decision: record.preAckDecision,
    });
    const common = {
      intakeId,
      profileId: profile.profileId,
      advisorTeam: profile.advisorTeam,
      advisorActorId: profile.actorId,
      advisorRoleInstanceId: profile.roleInstanceId,
      receiveGrantId: this.grant.receiveGrantId,
      receiveGrantBindingHash: record.bindingStateHash,
      sourceEventId: record.eventId,
      rootTs: observed.rootTs,
      messageArtifactRef: observed.messageArtifactRef,
      messageArtifactHash: observed.messageArtifactHash,
      receiptArtifactRef: observed.receiptArtifactRef,
      receivedAt: recordedAt,
      recordedAt,
    } as const;

    let intake: unknown;
    let intakeKind: 'NEW_MISSION' | As1ContinuationKind;
    if (record.preAckDecision === 'ROOT_BOUND') {
      // Re-verify the durable root binding matches the transport decision — not just a boolean flag.
      const state = await this.store.readReceiveGrantState(this.grant.receiveGrantId);
      if (state === null) {
        throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'the durable root binding is missing');
      }
      if (
        state.phase !== 'ROOT_BOUND' ||
        state.stateHash !== record.bindingStateHash ||
        state.boundSourceEventId !== record.eventId
      ) {
        throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'root binding does not match the durable transport decision');
      }
      intake = buildNewMissionIntake(common);
      intakeKind = 'NEW_MISSION';
    } else {
      const continuation = record.continuation;
      const root = await this.store.findRootByThreadTs(observed.rootTs);
      if (continuation === null || root === null) {
        throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'the durable continuation binding is missing');
      }
      if (root.bindingStateHash !== record.bindingStateHash) {
        throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'continuation binding does not match the durable transport decision');
      }
      intake = buildContinuationIntake({
        ...common,
        kind: continuation.kind,
        originalIntakeId: continuation.originalIntakeId,
        questionId: continuation.questionId,
      });
      intakeKind = continuation.kind;
    }

    const intakeReceipt = await this.store.persistIntakeArtifact(intakeId, intake);
    const rootCorrelationHash = hashCanonical({
      rootKeyHash: observed.rootKeyHash,
      bindingStateHash: record.bindingStateHash,
      sourceEventId: record.eventId,
      rootTs: observed.rootTs,
      intakeId,
    });
    const deliveryId = this.deriveId('as1p', { intakeId });
    const pointer = buildAdvisorPointer({
      profileId: profile.profileId,
      pilotId: this.grant.pilotId,
      receiveGrantId: this.grant.receiveGrantId,
      receiveGrantBindingHash: record.bindingStateHash,
      intakeId,
      intakeKind,
      sourceEventId: record.eventId,
      rootCorrelationHash,
      intakeArtifactRef: intakeReceipt.relativePath,
      intakeArtifactHash: intakeReceipt.sha256,
      recordedAt,
    });
    const pointerReceipt = await this.store.persistPointerArtifact(deliveryId, pointer);
    if (record.preAckDecision === 'ROOT_BOUND') {
      await this.store.recordRootCorrelation({
        rootTs: observed.rootTs,
        rootKeyHash: observed.rootKeyHash,
        sourceEventId: record.eventId,
        receiveGrantId: this.grant.receiveGrantId,
        bindingStateHash: record.bindingStateHash,
        intakeId,
      });
    }
    await this.store.commitMaterialized(record.eventId, intakeId, pointerReceipt.relativePath);
    return intakeId;
  }
}
