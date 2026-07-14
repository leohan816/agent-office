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
import { ImmutableArtifactStore } from '../../persistence/file-store/artifact-store.js';
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
  ): Promise<{ readonly receiptArtifactRef: string; readonly receiptArtifactHash: string; readonly messageArtifactHash: string }> {
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
