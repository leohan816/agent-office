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
import type { AgentOfficeRuntimeIdentity } from '../../runtime/identity.js';
import {
  buildAdvisorPointer,
  buildNewMissionIntake,
  isDeferredQueryText,
  requireBoundedMessageText,
  requireSlackTs,
  type As1PilotReceiveGrantV1,
} from './contracts.js';
import { As1ProfileInboundStore, rootKeyHash } from './inbound-store.js';
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
    private readonly clock: AgentOfficeRuntimeIdentity,
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
    if (this.latched) {
      return { acked: false, classification: 'PROFILE_LATCHED', intakeId: null, latched: true };
    }
    if (envelope.envelopeId.length === 0) {
      // Malformed input with no safely parsed envelope ID: no state mutation and no ACK (design §12.3).
      return { acked: false, classification: 'MALFORMED_NO_ENVELOPE_ID', intakeId: null, latched: false };
    }
    const classification = this.classify(envelope);
    if (classification.kind === 'REJECTED') {
      return this.handleRejection(envelope, classification.reason, classification.latch);
    }
    if (classification.kind === 'ROOT_CANDIDATE') {
      return this.handleRoot(envelope, classification.extracted);
    }
    return this.handleContinuation(envelope, classification.extracted);
  }

  private async handleRejection(envelope: As1InboundEnvelope, reason: string, latch: boolean): Promise<ProcessResult> {
    await this.store.recordDenialAudit(reason, null, envelope.envelopeId);
    if (latch) {
      this.latched = true;
      // An authenticated-profile identity contradiction latches and refuses; it is not ACKed.
      return { acked: false, classification: reason, intakeId: null, latched: true };
    }
    await envelope.acknowledge();
    return { acked: true, classification: reason, intakeId: null, latched: false };
  }

  private async handleRoot(envelope: As1InboundEnvelope, extracted: ExtractedEvent): Promise<ProcessResult> {
    const receipt = await this.store.persistReceipt(extracted.eventId, envelope.payload, extracted.text);
    const dedupe = await this.store.insertDedupe({
      envelopeId: envelope.envelopeId,
      teamId: extracted.teamId,
      apiAppId: extracted.apiAppId,
      eventId: extracted.eventId,
      rawEnvelopeHash: hashCanonical(envelope.payload),
      innerEventHash: hashCanonical(extracted.event),
      preAckClass: 'PREACK_PENDING',
    });
    if (dedupe === 'duplicate') {
      await envelope.acknowledge();
      return { acked: true, classification: 'DUPLICATE', intakeId: null, latched: false };
    }
    await this.store.initReceiveGrantState(this.grant);
    const rootKey = rootKeyHash(
      this.context.profile.profileId,
      this.context.workspaceId,
      this.context.appId,
      this.context.channelId,
      extracted.ts,
    );
    const bind = await this.store.bindFirstRoot(this.grant, {
      sourceEventId: extracted.eventId,
      rootTs: extracted.ts,
      rootKeyHash: rootKey,
      receiptArtifactRef: receipt.receiptArtifactRef,
      receiptArtifactHash: receipt.receiptArtifactHash,
      messageArtifactHash: receipt.messageArtifactHash,
    });
    if (bind.outcome !== 'ROOT_BOUND') {
      await this.store.recordPreAck(extracted.eventId, envelope.envelopeId, bind.outcome, bind.state.stateHash, bind.outcome);
      await envelope.acknowledge();
      await this.store.recordTransportAck(extracted.eventId);
      return { acked: true, classification: bind.outcome, intakeId: null, latched: false };
    }
    await this.store.recordPreAck(extracted.eventId, envelope.envelopeId, 'PREACK_ROOT_BOUND', bind.state.stateHash, null);
    await envelope.acknowledge();
    await this.store.recordTransportAck(extracted.eventId);
    const intakeId = await this.materialize(extracted, receipt, bind.state.stateHash, rootKey, 'NEW_MISSION');
    return { acked: true, classification: 'NEW_MISSION_ROOT', intakeId, latched: false };
  }

  private async handleContinuation(envelope: As1InboundEnvelope, extracted: ExtractedEvent): Promise<ProcessResult> {
    const threadTs = extracted.threadTs;
    if (threadTs === null) {
      return this.handleRejection(envelope, 'REJECTED_THREAD_CORRELATION', false);
    }
    const root = await this.store.findRootByThreadTs(threadTs);
    const openQuestion = root === null ? null : await this.store.findOpenQuestionForRoot(threadTs);
    if (root === null || openQuestion === null) {
      return this.handleRejection(envelope, 'REJECTED_THREAD_CORRELATION', false);
    }
    const receipt = await this.store.persistReceipt(extracted.eventId, envelope.payload, extracted.text);
    const dedupe = await this.store.insertDedupe({
      envelopeId: envelope.envelopeId,
      teamId: extracted.teamId,
      apiAppId: extracted.apiAppId,
      eventId: extracted.eventId,
      rawEnvelopeHash: hashCanonical(envelope.payload),
      innerEventHash: hashCanonical(extracted.event),
      preAckClass: 'PREACK_PENDING',
    });
    if (dedupe === 'duplicate') {
      await envelope.acknowledge();
      return { acked: true, classification: 'DUPLICATE', intakeId: null, latched: false };
    }
    const consume = await this.store.consumeQuestion(this.grant, threadTs, extracted.eventId);
    if (consume.outcome !== 'CONSUMED') {
      await this.store.recordPreAck(extracted.eventId, envelope.envelopeId, consume.outcome, null, consume.outcome);
      await envelope.acknowledge();
      await this.store.recordTransportAck(extracted.eventId);
      return { acked: true, classification: consume.outcome, intakeId: null, latched: false };
    }
    await this.store.recordPreAck(extracted.eventId, envelope.envelopeId, 'PREACK_CONTINUATION_CONSUMED', null, null);
    await envelope.acknowledge();
    await this.store.recordTransportAck(extracted.eventId);
    const rootKey = rootKeyHash(
      this.context.profile.profileId,
      this.context.workspaceId,
      this.context.appId,
      this.context.channelId,
      threadTs,
    );
    const intakeId = await this.materialize(
      { ...extracted, ts: threadTs },
      receipt,
      root.bindingStateHash,
      rootKey,
      openQuestion.expectedResponseKind,
    );
    return { acked: true, classification: 'CONTINUATION', intakeId, latched: false };
  }

  /** Separate post-ACK predicate (design §9.2/§11): runs from the durable ACK decision, no expiry recheck. */
  private async materialize(
    extracted: ExtractedEvent,
    receipt: {
      readonly receiptArtifactRef: string;
      readonly messageArtifactRef: string;
      readonly messageArtifactHash: string;
    },
    bindingStateHash: string,
    rootKey: string,
    kind: 'NEW_MISSION' | 'CLARIFICATION' | 'DECISION_RESPONSE',
  ): Promise<string> {
    const transport = await this.store.readTransport(extracted.eventId);
    if (!transport?.transportAckRecorded) {
      throw new DomainError('INVALID_TRANSITION', 'materialization requires a durable TRANSPORT_ACK_RECORDED decision');
    }
    const { profile } = this.context;
    const intakeId = this.clock.nextId();
    const recordedAt = this.clock.now();
    const intake = buildNewMissionIntake({
      intakeId,
      profileId: profile.profileId,
      advisorTeam: profile.advisorTeam,
      advisorActorId: profile.actorId,
      advisorRoleInstanceId: profile.roleInstanceId,
      receiveGrantId: this.grant.receiveGrantId,
      receiveGrantBindingHash: bindingStateHash,
      sourceEventId: extracted.eventId,
      rootTs: extracted.ts,
      messageArtifactRef: receipt.messageArtifactRef,
      messageArtifactHash: receipt.messageArtifactHash,
      receiptArtifactRef: receipt.receiptArtifactRef,
      receivedAt: recordedAt,
      recordedAt,
    });
    const intakeReceipt = await this.store.persistIntakeArtifact(intakeId, intake);
    const rootCorrelationHash = hashCanonical({
      rootKeyHash: rootKey,
      bindingStateHash,
      sourceEventId: extracted.eventId,
      rootTs: extracted.ts,
      intakeId,
    });
    const deliveryId = this.clock.nextId();
    const pointer = buildAdvisorPointer({
      profileId: profile.profileId,
      pilotId: this.grant.pilotId,
      receiveGrantId: this.grant.receiveGrantId,
      receiveGrantBindingHash: bindingStateHash,
      intakeId,
      intakeKind: kind,
      sourceEventId: extracted.eventId,
      rootCorrelationHash,
      intakeArtifactRef: intakeReceipt.relativePath,
      intakeArtifactHash: intakeReceipt.sha256,
      recordedAt,
    });
    const pointerReceipt = await this.store.persistPointerArtifact(deliveryId, pointer);
    if (kind === 'NEW_MISSION') {
      await this.store.recordRootCorrelation({
        rootTs: extracted.ts,
        rootKeyHash: rootKey,
        sourceEventId: extracted.eventId,
        receiveGrantId: this.grant.receiveGrantId,
        bindingStateHash,
        intakeId,
      });
    }
    await this.store.recordMaterialized(extracted.eventId, intakeId, pointerReceipt.relativePath);
    return intakeId;
  }
}
