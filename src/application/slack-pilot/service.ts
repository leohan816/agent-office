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
  type CommitPreAckInput,
} from './inbound-store.js';
import type { As1Profile } from './profiles.js';
import type { As1InboundEnvelope } from '../../adapters/gateways/slack-pilot/socket-client.js';

/** Committed profile identity resolved at startup (from the secret record + pair proof). */
export interface As1ProfileRuntimeContext {
  readonly profile: As1Profile;
  readonly workspaceId: string;
  readonly appId: string;
  readonly channelId: string;
  readonly leoUserId: string;
  readonly botUserId: string;
}

export interface ProcessResult {
  readonly acked: boolean;
  readonly classification: string;
  readonly intakeId: string | null;
  readonly latched: boolean;
}

/**
 * Narrow durable profile-latch port (review B05). It is the SOLE profile-latch source and is backed in
 * production by the lock-owning `As1SlackControl` canonical `failure-latch.json` record — never a second
 * truth. The service cannot be constructed into a live path without it.
 */
export interface As1ProfileLatchPort {
  /** Persist the irreversible profile latch (first reason preserved). Bound to this profile's closed slug. */
  latchProfile(reason: string): Promise<void>;
  isProfileLatched(): Promise<boolean>;
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

export class As1InboundService {
  private latched = false;

  public constructor(
    private readonly context: As1ProfileRuntimeContext,
    private readonly grant: As1PilotReceiveGrantV1,
    private readonly store: As1ProfileInboundStore,
    private readonly latchPort: As1ProfileLatchPort,
  ) {}

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
    // Enforce the durable profile latch before any side effect (dequeue/ACK/materialize). The canonical latch
    // survives restart — it is not a private in-memory boolean — and once set is never cleared here (review B05).
    if (this.latched || (await this.latchPort.isProfileLatched())) {
      this.latched = true;
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
      // A durable corruption/capacity failure persists the profile latch before surfacing (review B05).
      if (error instanceof DomainError && error.code === 'STORE_QUARANTINED') {
        await this.latchProfile(`store quarantined: ${error.message}`);
      }
      throw error;
    }
  }

  private async latchProfile(reason: string): Promise<void> {
    await this.latchPort.latchProfile(reason);
    this.latched = true;
  }

  private async handleRejection(envelope: As1InboundEnvelope, reason: string, latch: boolean): Promise<ProcessResult> {
    await this.store.recordDenialAudit(reason, null, envelope.envelopeId);
    if (latch) {
      // An authenticated-profile identity contradiction persists a durable latch and refuses; it is not ACKed.
      await this.latchProfile(reason);
      return { acked: false, classification: reason, intakeId: null, latched: true };
    }
    await envelope.acknowledge();
    return { acked: true, classification: reason, intakeId: null, latched: false };
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
    let record = await this.store.openTransport(
      extracted.eventId,
      envelope.envelopeId,
      hashCanonical(envelope.payload),
      hashCanonical(extracted.event),
      observed,
    );
    const startState = record.state;

    // 1. PREACK_PENDING -> committed pre-ACK decision (the sole receive-expiry linearization is inside decide()).
    if (record.state === 'PREACK_PENDING') {
      record = await this.store.commitPreAckDecision(extracted.eventId, await decide());
    }

    let acked = false;
    // 2. committed pre-ACK decision -> Socket ACK -> durable TRANSPORT_ACK_RECORDED.
    if (
      record.state === 'PREACK_ROOT_BOUND' ||
      record.state === 'PREACK_CONTINUATION_CONSUMED' ||
      record.state === 'PREACK_REJECTED'
    ) {
      await envelope.acknowledge();
      acked = true;
      record = await this.store.commitTransportAck(extracted.eventId);
    }

    // 3. TRANSPORT_ACK_RECORDED -> MATERIALIZED | TERMINAL_NO_INTAKE.
    if (record.state === 'TRANSPORT_ACK_RECORDED') {
      if (!acked) {
        // A prior attempt recorded the ACK but crashed before this step; reproduce only the durable ACK.
        await envelope.acknowledge();
        acked = true;
      }
      if (record.preAckDecision === 'REJECTED') {
        await this.store.commitTerminalNoIntake(extracted.eventId);
      } else {
        await this.materializeFromTransport(record);
      }
      record = (await this.store.readTransport(extracted.eventId)) ?? record;
    }

    // 4. Already terminal on entry (a fully processed prior delivery): reproduce only the durable ACK.
    if (!acked && (record.state === 'MATERIALIZED' || record.state === 'TERMINAL_NO_INTAKE')) {
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
      if (record.state === 'PREACK_PENDING') {
        await this.recoverPreAckDecision(record);
      } else if (record.state === 'TRANSPORT_ACK_RECORDED') {
        if (record.preAckDecision === 'REJECTED') {
          await this.store.commitTerminalNoIntake(record.eventId);
        } else {
          await this.materializeFromTransport(record);
        }
      }
      // A committed pre-ACK decision that is not yet ACK-recorded waits for the exact Slack retry to reproduce
      // the durable transport decision; recovery does not ACK it (design §15.1 step 3).
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
    const { profile } = this.context;
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
