// AS1 Multi-Team Slack Pilot — profile-local receipt, dedupe, receive-grant binding, and question state.
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_DESIGN.md §7 (durable state layout),
// §8 (envelope contract + ACK order), §8.3 (dedupe), §10 (root/thread correlation), §12.2 (atomic
// receive-grant state + root binding); docs/security/AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md
// §8.2 (receive binding + consumption), §10 (replay/correlation), §14 (state isolation).
//
// The serialized root/question transition is the SOLE receive-expiry decision point: at one linearization
// point the trusted local clock supplies boundAt/consumedAt and the business transition commits only when
// that value is strictly earlier than the grant's exclusive expiresAt. Receipt time, Slack event time,
// parse time, and dedupe-write time never freeze eligibility. Every mutable index is exact-key, versioned,
// hash-chained, bounded, and atomically replaced. State is physically per profile; a cross-profile
// reference is a global-latch contradiction, never a fallback.
import path from 'node:path';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';

import { DomainError } from '../../contracts/types.js';
import { writeAtomicCanonicalJson } from '../../persistence/file-store/atomic-file.js';
import { GENESIS_EVENT_HASH, hashCanonical, isSha256 } from '../../persistence/file-store/hashing.js';
import { ensurePrivateDirectory, isNodeError, resolveContainedPath } from '../../persistence/file-store/path-safety.js';
import { ImmutableArtifactStore, type ImmutableArtifactReceipt } from '../../persistence/file-store/artifact-store.js';
import type { AgentOfficeRuntimeIdentity } from '../../runtime/identity.js';
import { LIMITS } from './contracts.js';
import type { As1PilotReceiveGrantV1 } from './contracts.js';
import type { As1Profile } from './profiles.js';

const ARTIFACT_KIND = 'as1-slack-pilot';

// ── Receive-grant state chain (design §12.2) ─────────────────────────────────
export const AS1_RECEIVE_PHASES = [
  'UNBOUND',
  'ROOT_BOUND',
  'EXPIRED_UNBOUND',
  'EXPIRED_BOUND',
  'RETIRED_UNBOUND',
  'RETIRED_BOUND',
  'LATCHED',
] as const;
export type As1ReceivePhase = (typeof AS1_RECEIVE_PHASES)[number];

export interface As1PilotReceiveGrantStateV1 {
  readonly schemaVersion: 'agent-office.as1-pilot-receive-grant-state.v1';
  readonly receiveGrantId: string;
  readonly pilotId: string;
  readonly profileId: string;
  readonly phase: As1ReceivePhase;
  readonly rootLimit: 1;
  readonly rootSlotConsumed: boolean;
  readonly boundSourceEventId: string | null;
  readonly boundRootTs: string | null;
  readonly boundRootKeyHash: string | null;
  readonly boundReceiptArtifactRef: string | null;
  readonly boundReceiptArtifactHash: string | null;
  readonly boundMessageArtifactHash: string | null;
  readonly boundAt: string | null;
  readonly previousStateHash: string;
  readonly stateHash: string;
  readonly version: number;
}

export interface ObservedRootFacts {
  readonly sourceEventId: string;
  readonly rootTs: string;
  readonly rootKeyHash: string;
  readonly receiptArtifactRef: string;
  readonly receiptArtifactHash: string;
  readonly messageArtifactHash: string;
}

export type BindOutcome =
  | 'ROOT_BOUND'
  | 'REJECTED_ROOT_SLOT_CONSUMED'
  | 'REJECTED_RECEIVE_GRANT_EXPIRED'
  | 'REJECTED_GRANT_UNAVAILABLE';

export interface BindResult {
  readonly outcome: BindOutcome;
  readonly state: As1PilotReceiveGrantStateV1;
}

// ── Dedupe record (design §8.3) ──────────────────────────────────────────────
export interface As1DedupeRecordV1 {
  readonly schemaVersion: 'agent-office.as1-inbound-dedupe.v1';
  readonly profileId: string;
  readonly envelopeId: string;
  readonly teamId: string;
  readonly apiAppId: string;
  readonly eventId: string;
  readonly rawEnvelopeHash: string;
  readonly innerEventHash: string;
  readonly firstReceivedAt: string;
  readonly lastReceivedAt: string;
  readonly preAckClass: string;
  readonly receiveGrantStateHash: string | null;
  readonly intakeId: string | null;
  readonly terminalReason: string | null;
}

export interface DedupeInput {
  readonly envelopeId: string;
  readonly teamId: string;
  readonly apiAppId: string;
  readonly eventId: string;
  readonly rawEnvelopeHash: string;
  readonly innerEventHash: string;
  readonly preAckClass: string;
}

export type DedupeOutcome = 'inserted' | 'duplicate';

// ── Question, root-correlation, transport journal, and audit records (design §8.2, §10) ──────────────
export interface As1PendingQuestionV1 {
  readonly schemaVersion: 'agent-office.as1-pending-question.v1';
  readonly questionId: string;
  readonly rootTs: string;
  readonly expectedResponseKind: 'CLARIFICATION' | 'DECISION_RESPONSE';
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly state: 'OPEN' | 'CONSUMED';
  readonly openedAt: string;
  readonly expiresAt: string;
  readonly consumedAt: string | null;
  readonly consumedBySourceEventId: string | null;
}

export interface As1RootCorrelationV1 {
  readonly schemaVersion: 'agent-office.as1-root-correlation.v1';
  readonly rootTs: string;
  readonly rootKeyHash: string;
  readonly sourceEventId: string;
  readonly receiveGrantId: string;
  readonly bindingStateHash: string;
  readonly intakeId: string;
  readonly createdAt: string;
}

export interface As1TransportRecordV1 {
  readonly schemaVersion: 'agent-office.as1-transport-record.v1';
  readonly eventId: string;
  readonly envelopeId: string;
  readonly preAckClass: string;
  readonly receiveGrantStateHash: string | null;
  readonly transportAckRecorded: boolean;
  readonly intakeId: string | null;
  readonly pointerArtifactRef: string | null;
  readonly terminalReason: string | null;
  readonly recordedAt: string;
  readonly ackedAt: string | null;
  readonly materializedAt: string | null;
}

export type ConsumeQuestionOutcome = 'CONSUMED' | 'REJECTED_RECEIVE_GRANT_EXPIRED' | 'REJECTED_NO_OPEN_QUESTION';

export interface ConsumeQuestionResult {
  readonly outcome: ConsumeQuestionOutcome;
  readonly question: As1PendingQuestionV1 | null;
}

/** Serialize all per-profile mutations to one linearizable sequence (security §15). */
class AsyncMutex {
  private tail: Promise<void> = Promise.resolve();

  public async run<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release = (): void => undefined;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

/**
 * One profile's physically isolated inbound store. Never reads or writes another profile's root; a
 * cross-profile reference is a global contradiction (raised as FORBIDDEN_TARGET), not a fallback.
 */
export class As1ProfileInboundStore {
  private readonly mutex = new AsyncMutex();

  private constructor(
    private readonly stateRoot: string,
    private readonly artifacts: ImmutableArtifactStore,
    private readonly profile: As1Profile,
    private readonly clock: AgentOfficeRuntimeIdentity,
  ) {}

  public static async open(
    stateRoot: string,
    profile: As1Profile,
    clock: AgentOfficeRuntimeIdentity,
  ): Promise<As1ProfileInboundStore> {
    const artifacts = await ImmutableArtifactStore.open(stateRoot);
    await ensurePrivateDirectory(stateRoot, path.posix.join('indexes', ARTIFACT_KIND, 'profiles', profile.profileStateSlug));
    return new As1ProfileInboundStore(stateRoot, artifacts, profile, clock);
  }

  private indexPath(name: string): string {
    return path.posix.join('indexes', ARTIFACT_KIND, 'profiles', this.profile.profileStateSlug, name);
  }

  /** Persist the immutable owner-only envelope receipt and raw-message artifacts (design §8.2 step 4). */
  public async persistReceipt(
    eventId: string,
    envelopeCanonical: unknown,
    rawText: string,
  ): Promise<{
    readonly receiptArtifactRef: string;
    readonly receiptArtifactHash: string;
    readonly messageArtifactRef: string;
    readonly messageArtifactHash: string;
  }> {
    const receipt = await this.artifacts.putScopedCanonicalJson(
      ARTIFACT_KIND,
      [this.profile.profileStateSlug, 'inbound', eventId],
      envelopeCanonical,
    );
    const message = await this.artifacts.putScopedBytes(
      ARTIFACT_KIND,
      [this.profile.profileStateSlug, 'inbound-message', eventId],
      Buffer.from(rawText, 'utf8'),
      'txt',
      LIMITS.MESSAGE_TEXT_MAX_BYTES + 1,
    );
    return {
      receiptArtifactRef: receipt.relativePath,
      receiptArtifactHash: receipt.sha256,
      messageArtifactRef: message.relativePath,
      messageArtifactHash: message.sha256,
    };
  }

  /** Insert both dedupe identities atomically (design §8.3). Duplicate on same bytes; corruption on new bytes. */
  public async insertDedupe(input: DedupeInput): Promise<DedupeOutcome> {
    return this.mutex.run(async () => {
      const records = await this.readJsonArray<As1DedupeRecordV1>(this.indexPath('inbound-dedupe.json'));
      const now = this.clock.now();
      const byEnvelope = records.find((r) => r.envelopeId === input.envelopeId);
      const byEvent = records.find(
        (r) => r.teamId === input.teamId && r.apiAppId === input.apiAppId && r.eventId === input.eventId,
      );
      if (byEnvelope !== undefined || byEvent !== undefined) {
        const existing = byEnvelope ?? byEvent;
        if (existing === undefined) {
          throw new DomainError('STORE_QUARANTINED', 'dedupe lookup returned an impossible state');
        }
        if (existing.rawEnvelopeHash !== input.rawEnvelopeHash || existing.innerEventHash !== input.innerEventHash) {
          // Same identity, different bytes → corruption/attack (security §10). Quarantine.
          throw new DomainError('STORE_QUARANTINED', 'dedupe identity reused with different bytes');
        }
        return 'duplicate';
      }
      if (records.length >= LIMITS.ENVELOPE_DEDUPE_PER_PROFILE) {
        throw new DomainError('STORE_QUARANTINED', 'dedupe capacity exhausted; no silent eviction');
      }
      const record: As1DedupeRecordV1 = {
        schemaVersion: 'agent-office.as1-inbound-dedupe.v1',
        profileId: this.profile.profileId,
        envelopeId: input.envelopeId,
        teamId: input.teamId,
        apiAppId: input.apiAppId,
        eventId: input.eventId,
        rawEnvelopeHash: input.rawEnvelopeHash,
        innerEventHash: input.innerEventHash,
        firstReceivedAt: now,
        lastReceivedAt: now,
        preAckClass: input.preAckClass,
        receiveGrantStateHash: null,
        intakeId: null,
        terminalReason: null,
      };
      await this.writeJsonArray(this.indexPath('inbound-dedupe.json'), [...records, record]);
      return 'inserted';
    });
  }

  /** Initialize the UNBOUND receive-grant state if absent; otherwise return the verified current tail. */
  public async initReceiveGrantState(grant: As1PilotReceiveGrantV1): Promise<As1PilotReceiveGrantStateV1> {
    return this.mutex.run(async () => {
      this.assertGrantBelongsToProfile(grant);
      const chain = await this.loadReceiveChain(grant.receiveGrantId);
      const tail = chain.at(-1);
      if (tail !== undefined) return tail;
      const record = this.sealReceiveState(
        {
          schemaVersion: 'agent-office.as1-pilot-receive-grant-state.v1',
          receiveGrantId: grant.receiveGrantId,
          pilotId: grant.pilotId,
          profileId: this.profile.profileId,
          phase: 'UNBOUND',
          rootLimit: 1,
          rootSlotConsumed: false,
          boundSourceEventId: null,
          boundRootTs: null,
          boundRootKeyHash: null,
          boundReceiptArtifactRef: null,
          boundReceiptArtifactHash: null,
          boundMessageArtifactHash: null,
          boundAt: null,
        },
        GENESIS_EVENT_HASH,
        1,
      );
      await this.writeJsonArray(this.receiveStatePath(grant.receiveGrantId), [record]);
      return record;
    });
  }

  /**
   * The atomic first-root binding (design §12.2/§12.3). Serialized: read tail, obtain the trusted-local
   * linearization time exactly once, and commit UNBOUND -> ROOT_BOUND only when boundAt < expiresAt.
   * At or after expiry, commit the terminal EXPIRED_UNBOUND record instead. A slot already consumed loses.
   */
  public async bindFirstRoot(grant: As1PilotReceiveGrantV1, observed: ObservedRootFacts): Promise<BindResult> {
    return this.mutex.run(async () => {
      this.assertGrantBelongsToProfile(grant);
      const chain = await this.loadReceiveChain(grant.receiveGrantId);
      const tail = chain.at(-1);
      if (tail === undefined) {
        throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'receive-grant state has not been initialized');
      }
      if (tail.phase === 'ROOT_BOUND') {
        return { outcome: 'REJECTED_ROOT_SLOT_CONSUMED', state: tail };
      }
      if (tail.phase !== 'UNBOUND') {
        return { outcome: 'REJECTED_GRANT_UNAVAILABLE', state: tail };
      }
      // Sole expiry decision point — one trusted-local clock read at the serialized linearization point.
      const boundAt = this.clock.now();
      if (!(Date.parse(boundAt) < Date.parse(grant.expiresAt))) {
        const expired = this.appendReceiveState(chain, tail, {
          phase: 'EXPIRED_UNBOUND',
          rootSlotConsumed: false,
          boundSourceEventId: null,
          boundRootTs: null,
          boundRootKeyHash: null,
          boundReceiptArtifactRef: null,
          boundReceiptArtifactHash: null,
          boundMessageArtifactHash: null,
          boundAt: null,
        });
        await this.writeJsonArray(this.receiveStatePath(grant.receiveGrantId), [...chain, expired]);
        return { outcome: 'REJECTED_RECEIVE_GRANT_EXPIRED', state: expired };
      }
      const bound = this.appendReceiveState(chain, tail, {
        phase: 'ROOT_BOUND',
        rootSlotConsumed: true,
        boundSourceEventId: observed.sourceEventId,
        boundRootTs: observed.rootTs,
        boundRootKeyHash: observed.rootKeyHash,
        boundReceiptArtifactRef: observed.receiptArtifactRef,
        boundReceiptArtifactHash: observed.receiptArtifactHash,
        boundMessageArtifactHash: observed.messageArtifactHash,
        boundAt,
      });
      await this.writeJsonArray(this.receiveStatePath(grant.receiveGrantId), [...chain, bound]);
      // The immutable binding artifact (design §10) — binds the root key without any future intakeId.
      await this.artifacts.putScopedCanonicalJson(
        ARTIFACT_KIND,
        [this.profile.profileStateSlug, 'receive-grant-bindings', grant.receiveGrantId],
        {
          schemaVersion: 'agent-office.as1-receive-grant-binding.v1',
          receiveGrantId: grant.receiveGrantId,
          profileId: this.profile.profileId,
          bindingStateHash: bound.stateHash,
          sourceEventId: observed.sourceEventId,
          rootTs: observed.rootTs,
          rootKeyHash: observed.rootKeyHash,
          receiptArtifactRef: observed.receiptArtifactRef,
          receiptArtifactHash: observed.receiptArtifactHash,
          messageArtifactHash: observed.messageArtifactHash,
          boundAt,
        },
      );
      return { outcome: 'ROOT_BOUND', state: bound };
    });
  }

  /** Record a terminal EXPIRED_UNBOUND when the grant expires before any root/question (design §12.3). */
  public async recordExpiryBeforeRoot(grant: As1PilotReceiveGrantV1): Promise<As1PilotReceiveGrantStateV1> {
    return this.mutex.run(async () => {
      this.assertGrantBelongsToProfile(grant);
      const chain = await this.loadReceiveChain(grant.receiveGrantId);
      const tail = chain.at(-1);
      if (tail === undefined) {
        throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'receive-grant state has not been initialized');
      }
      if (tail.phase !== 'UNBOUND') return tail;
      const expired = this.appendReceiveState(chain, tail, {
        phase: 'EXPIRED_UNBOUND',
        rootSlotConsumed: false,
        boundSourceEventId: null,
        boundRootTs: null,
        boundRootKeyHash: null,
        boundReceiptArtifactRef: null,
        boundReceiptArtifactHash: null,
        boundMessageArtifactHash: null,
        boundAt: null,
      });
      await this.writeJsonArray(this.receiveStatePath(grant.receiveGrantId), [...chain, expired]);
      return expired;
    });
  }

  public async readReceiveGrantState(receiveGrantId: string): Promise<As1PilotReceiveGrantStateV1 | null> {
    const chain = await this.loadReceiveChain(receiveGrantId);
    return chain.at(-1) ?? null;
  }

  // ── Question state (design §10) ───────────────────────────────────────────
  /** Open exactly one pending question per root (design §9: one open pending question per root). */
  public async openQuestion(question: {
    readonly questionId: string;
    readonly rootTs: string;
    readonly expectedResponseKind: 'CLARIFICATION' | 'DECISION_RESPONSE';
    readonly evidenceRef: string;
    readonly evidenceHash: string;
    readonly expiresAt: string;
  }): Promise<As1PendingQuestionV1> {
    return this.mutex.run(async () => {
      const questions = await this.readJsonArray<As1PendingQuestionV1>(this.indexPath('pending-questions.json'));
      const openForRoot = questions.filter((q) => q.rootTs === question.rootTs && q.state === 'OPEN');
      if (openForRoot.length >= LIMITS.OPEN_QUESTIONS_PER_ROOT) {
        throw new DomainError('INVALID_TRANSITION', 'a root already has an open pending question');
      }
      if (questions.length >= LIMITS.QUESTION_HISTORY_PER_PROFILE) {
        throw new DomainError('STORE_QUARANTINED', 'question history capacity exhausted; no silent eviction');
      }
      const record: As1PendingQuestionV1 = {
        schemaVersion: 'agent-office.as1-pending-question.v1',
        questionId: question.questionId,
        rootTs: question.rootTs,
        expectedResponseKind: question.expectedResponseKind,
        evidenceRef: question.evidenceRef,
        evidenceHash: question.evidenceHash,
        state: 'OPEN',
        openedAt: this.clock.now(),
        expiresAt: question.expiresAt,
        consumedAt: null,
        consumedBySourceEventId: null,
      };
      await this.writeJsonArray(this.indexPath('pending-questions.json'), [...questions, record]);
      return record;
    });
  }

  public async findOpenQuestionForRoot(rootTs: string): Promise<As1PendingQuestionV1 | null> {
    const questions = await this.readJsonArray<As1PendingQuestionV1>(this.indexPath('pending-questions.json'));
    return questions.find((q) => q.rootTs === rootTs && q.state === 'OPEN') ?? null;
  }

  /**
   * Atomically consume the single open question for a root before ACK (design §10/§12.2). The trusted-local
   * consumedAt is read at the serialized linearization point and the transition commits only when
   * consumedAt < grant.expiresAt; otherwise a terminal expiry rejection is returned and nothing consumed.
   */
  public async consumeQuestion(
    grant: As1PilotReceiveGrantV1,
    rootTs: string,
    sourceEventId: string,
  ): Promise<ConsumeQuestionResult> {
    return this.mutex.run(async () => {
      this.assertGrantBelongsToProfile(grant);
      const questions = await this.readJsonArray<As1PendingQuestionV1>(this.indexPath('pending-questions.json'));
      const index = questions.findIndex((q) => q.rootTs === rootTs && q.state === 'OPEN');
      const open = index >= 0 ? questions[index] : undefined;
      if (open === undefined) {
        return { outcome: 'REJECTED_NO_OPEN_QUESTION', question: null };
      }
      const consumedAt = this.clock.now();
      if (!(Date.parse(consumedAt) < Date.parse(grant.expiresAt))) {
        return { outcome: 'REJECTED_RECEIVE_GRANT_EXPIRED', question: open };
      }
      const consumed: As1PendingQuestionV1 = {
        ...open,
        state: 'CONSUMED',
        consumedAt,
        consumedBySourceEventId: sourceEventId,
      };
      const next = [...questions];
      next[index] = consumed;
      await this.writeJsonArray(this.indexPath('pending-questions.json'), next);
      return { outcome: 'CONSUMED', question: consumed };
    });
  }

  // ── Root correlation (design §10) ─────────────────────────────────────────
  public async recordRootCorrelation(record: Omit<As1RootCorrelationV1, 'schemaVersion' | 'createdAt'>): Promise<void> {
    await this.mutex.run(async () => {
      const records = await this.readJsonArray<As1RootCorrelationV1>(this.indexPath('root-correlations.json'));
      if (records.some((r) => r.rootTs === record.rootTs)) return;
      if (records.length >= LIMITS.INTAKE_CORRELATIONS_PER_PROFILE) {
        throw new DomainError('STORE_QUARANTINED', 'root-correlation capacity exhausted; no silent eviction');
      }
      const next: As1RootCorrelationV1 = {
        schemaVersion: 'agent-office.as1-root-correlation.v1',
        createdAt: this.clock.now(),
        ...record,
      };
      await this.writeJsonArray(this.indexPath('root-correlations.json'), [...records, next]);
    });
  }

  public async findRootByThreadTs(threadTs: string): Promise<As1RootCorrelationV1 | null> {
    const records = await this.readJsonArray<As1RootCorrelationV1>(this.indexPath('root-correlations.json'));
    return records.find((r) => r.rootTs === threadTs) ?? null;
  }

  // ── Transport journal (design §8.2) ───────────────────────────────────────
  public async recordPreAck(
    eventId: string,
    envelopeId: string,
    preAckClass: string,
    receiveGrantStateHash: string | null,
    terminalReason: string | null,
  ): Promise<void> {
    await this.upsertTransport(eventId, (existing) => ({
      schemaVersion: 'agent-office.as1-transport-record.v1',
      eventId,
      envelopeId,
      preAckClass,
      receiveGrantStateHash,
      transportAckRecorded: existing?.transportAckRecorded ?? false,
      intakeId: existing?.intakeId ?? null,
      pointerArtifactRef: existing?.pointerArtifactRef ?? null,
      terminalReason,
      recordedAt: existing?.recordedAt ?? this.clock.now(),
      ackedAt: existing?.ackedAt ?? null,
      materializedAt: existing?.materializedAt ?? null,
    }));
  }

  public async recordTransportAck(eventId: string): Promise<void> {
    await this.upsertTransport(eventId, (existing) => {
      if (existing === null) {
        throw new DomainError('INVALID_TRANSITION', 'cannot record TRANSPORT_ACK before a pre-ACK decision');
      }
      return { ...existing, transportAckRecorded: true, ackedAt: existing.ackedAt ?? this.clock.now() };
    });
  }

  public async recordMaterialized(eventId: string, intakeId: string, pointerArtifactRef: string): Promise<void> {
    await this.upsertTransport(eventId, (existing) => {
      if (!existing?.transportAckRecorded) {
        throw new DomainError('INVALID_TRANSITION', 'materialization requires a durable TRANSPORT_ACK_RECORDED');
      }
      return { ...existing, intakeId, pointerArtifactRef, materializedAt: existing.materializedAt ?? this.clock.now() };
    });
  }

  public async readTransport(eventId: string): Promise<As1TransportRecordV1 | null> {
    const records = await this.readJsonArray<As1TransportRecordV1>(this.indexPath('transport-journal.json'));
    return records.find((r) => r.eventId === eventId) ?? null;
  }

  private async upsertTransport(
    eventId: string,
    update: (existing: As1TransportRecordV1 | null) => As1TransportRecordV1,
  ): Promise<void> {
    await this.mutex.run(async () => {
      const records = await this.readJsonArray<As1TransportRecordV1>(this.indexPath('transport-journal.json'));
      const index = records.findIndex((r) => r.eventId === eventId);
      const existing = index >= 0 ? (records[index] ?? null) : null;
      const next = update(existing);
      if (index >= 0) {
        const copy = [...records];
        copy[index] = next;
        await this.writeJsonArray(this.indexPath('transport-journal.json'), copy);
      } else {
        if (records.length >= LIMITS.RECEIPT_RECORDS_PER_PROFILE) {
          throw new DomainError('STORE_QUARANTINED', 'transport journal capacity exhausted; no silent eviction');
        }
        await this.writeJsonArray(this.indexPath('transport-journal.json'), [...records, next]);
      }
    });
  }

  // ── Minimal denial audit (design §9) ──────────────────────────────────────
  public async recordDenialAudit(reason: string, eventId: string | null, envelopeId: string | null): Promise<void> {
    await this.mutex.run(async () => {
      const records = await this.readJsonArray<unknown>(this.indexPath('denial-audit.json'));
      if (records.length >= LIMITS.DENIAL_AUDIT_PER_PROFILE) {
        throw new DomainError('STORE_QUARANTINED', 'denial-audit capacity exhausted; no silent eviction');
      }
      await this.writeJsonArray(this.indexPath('denial-audit.json'), [
        ...records,
        {
          schemaVersion: 'agent-office.as1-denial-audit.v1',
          reason,
          eventId,
          envelopeId,
          recordedAt: this.clock.now(),
        },
      ]);
    });
  }

  // ── Immutable intake / pointer artifacts (design §11, §12.6) ──────────────
  public async persistIntakeArtifact(intakeId: string, intake: unknown): Promise<ImmutableArtifactReceipt> {
    return this.artifacts.putScopedCanonicalJson(ARTIFACT_KIND, [this.profile.profileStateSlug, 'intake', intakeId], intake);
  }

  public async persistPointerArtifact(deliveryId: string, pointer: unknown): Promise<ImmutableArtifactReceipt> {
    return this.artifacts.putScopedCanonicalJson(
      ARTIFACT_KIND,
      [this.profile.profileStateSlug, 'pointers', deliveryId],
      pointer,
    );
  }

  // ── Tmux delivery journal + one-use delivery-authority consumption (design §12.5/§12.7) ────────────
  public async recordTmuxPhase(deliveryId: string, phase: string): Promise<void> {
    await this.mutex.run(async () => {
      const records = await this.readJsonArray<{ deliveryId: string; phase: string; recordedAt: string }>(
        this.indexPath('tmux-delivery.json'),
      );
      const index = records.findIndex((r) => r.deliveryId === deliveryId);
      const record = { deliveryId, phase, recordedAt: this.clock.now() };
      if (index >= 0) {
        const copy = [...records];
        copy[index] = record;
        await this.writeJsonArray(this.indexPath('tmux-delivery.json'), copy);
      } else {
        if (records.length >= LIMITS.POINTER_LEASE_CAPABILITY_JOURNAL_PER_PROFILE) {
          throw new DomainError('STORE_QUARANTINED', 'tmux delivery journal capacity exhausted; no silent eviction');
        }
        await this.writeJsonArray(this.indexPath('tmux-delivery.json'), [...records, record]);
      }
    });
  }

  public async readTmuxPhase(deliveryId: string): Promise<string | null> {
    const records = await this.readJsonArray<{ deliveryId: string; phase: string }>(this.indexPath('tmux-delivery.json'));
    return records.find((r) => r.deliveryId === deliveryId)?.phase ?? null;
  }

  /** Consume the delivery grant + lease exactly once. Permanent; reuse of either returns false. */
  public async consumeDeliveryAuthority(pointerDeliveryGrantId: string, leaseId: string): Promise<boolean> {
    return this.mutex.run(async () => {
      const grants = await this.readJsonArray<{ id: string; consumedAt: string }>(
        this.indexPath('pointer-delivery-grant-consumption.json'),
      );
      const leases = await this.readJsonArray<{ id: string; consumedAt: string }>(
        this.indexPath('readiness-lease-consumption.json'),
      );
      if (grants.some((r) => r.id === pointerDeliveryGrantId) || leases.some((r) => r.id === leaseId)) {
        return false;
      }
      const now = this.clock.now();
      await this.writeJsonArray(this.indexPath('pointer-delivery-grant-consumption.json'), [
        ...grants,
        { id: pointerDeliveryGrantId, consumedAt: now },
      ]);
      await this.writeJsonArray(this.indexPath('readiness-lease-consumption.json'), [
        ...leases,
        { id: leaseId, consumedAt: now },
      ]);
      return true;
    });
  }

  private assertGrantBelongsToProfile(grant: As1PilotReceiveGrantV1): void {
    if (grant.profileId !== this.profile.profileId) {
      // A cross-profile grant must never be read through the selected profile (security §14.2).
      throw new DomainError('FORBIDDEN_TARGET', 'receive grant profile does not match this profile store');
    }
  }

  private receiveStatePath(receiveGrantId: string): string {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(receiveGrantId)) {
      throw new DomainError('INVALID_SCHEMA', 'receiveGrantId is not a bounded contained identity');
    }
    return this.indexPath(path.posix.join('receive-grant-state', `${receiveGrantId}.json`));
  }

  private async loadReceiveChain(receiveGrantId: string): Promise<As1PilotReceiveGrantStateV1[]> {
    const records = await this.readJsonArray<As1PilotReceiveGrantStateV1>(this.receiveStatePath(receiveGrantId));
    let previous: string = GENESIS_EVENT_HASH;
    for (const [index, record] of records.entries()) {
      if (
        record.previousStateHash !== previous ||
        record.version !== index + 1 ||
        !isSha256(record.stateHash) ||
        record.stateHash !== this.computeStateHash(record)
      ) {
        throw new DomainError('STORE_QUARANTINED', 'receive-grant state chain is corrupt');
      }
      if (record.profileId !== this.profile.profileId) {
        throw new DomainError('FORBIDDEN_TARGET', 'receive-grant state references a foreign profile');
      }
      previous = record.stateHash;
    }
    return records;
  }

  private appendReceiveState(
    chain: readonly As1PilotReceiveGrantStateV1[],
    tail: As1PilotReceiveGrantStateV1,
    change: Pick<
      As1PilotReceiveGrantStateV1,
      | 'phase'
      | 'rootSlotConsumed'
      | 'boundSourceEventId'
      | 'boundRootTs'
      | 'boundRootKeyHash'
      | 'boundReceiptArtifactRef'
      | 'boundReceiptArtifactHash'
      | 'boundMessageArtifactHash'
      | 'boundAt'
    >,
  ): As1PilotReceiveGrantStateV1 {
    return this.sealReceiveState(
      {
        schemaVersion: 'agent-office.as1-pilot-receive-grant-state.v1',
        receiveGrantId: tail.receiveGrantId,
        pilotId: tail.pilotId,
        profileId: tail.profileId,
        rootLimit: 1,
        ...change,
      },
      tail.stateHash,
      chain.length + 1,
    );
  }

  private sealReceiveState(
    body: Omit<As1PilotReceiveGrantStateV1, 'previousStateHash' | 'stateHash' | 'version'>,
    previousStateHash: string,
    version: number,
  ): As1PilotReceiveGrantStateV1 {
    const withoutHash = { ...body, previousStateHash, version };
    return { ...withoutHash, stateHash: hashCanonical(withoutHash) };
  }

  private computeStateHash(record: As1PilotReceiveGrantStateV1): string {
    const rest: Record<string, unknown> = { ...record };
    Reflect.deleteProperty(rest, 'stateHash');
    return hashCanonical(rest);
  }

  private async readJsonArray<T>(relative: string): Promise<T[]> {
    const target = await resolveContainedPath(this.stateRoot, relative, { allowMissingLeaf: true });
    let handle: import('node:fs/promises').FileHandle;
    try {
      handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) return [];
      throw error;
    }
    try {
      const bytes = await handle.readFile();
      const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (!Array.isArray(parsed)) {
        throw new DomainError('STORE_QUARANTINED', 'profile index is not an array');
      }
      return parsed as T[];
    } finally {
      await handle.close();
    }
  }

  private async writeJsonArray(relative: string, value: readonly unknown[]): Promise<void> {
    await this.ensureParent(relative);
    const target = await resolveContainedPath(this.stateRoot, relative, { allowMissingLeaf: true });
    await writeAtomicCanonicalJson(target, value);
  }

  private async ensureParent(relative: string): Promise<void> {
    const parent = path.posix.dirname(relative);
    await ensurePrivateDirectory(this.stateRoot, parent);
  }
}

/** The canonical root key (design §10). Never contains raw content; derived from validated identities. */
export function rootKeyHash(
  profileId: string,
  workspaceId: string,
  appId: string,
  channelId: string,
  rootTs: string,
): string {
  return hashCanonical({ profileId, workspaceId, appId, channelId, rootTs });
}
