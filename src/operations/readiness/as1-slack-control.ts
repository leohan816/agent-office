// AS1 Multi-Team Slack Pilot — global/profile control, single-process lock, shutdown, and rollback.
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_DESIGN.md §7 (durable state), §15
// (replay/kill/shutdown); docs/security/AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md §7 (control
// states), §14 (latching), §20 (rollback). There is one lifecycle owner and one global kill switch.
// DISABLED_LATCHED has no reset in AS1; recovery requires a separately reviewed procedure. Every open runs a
// full durable-state integrity check first (established marker + both profile latch records + strict control
// parse); a partial/deleted/malformed state quarantines and never auto-heals. Deleting state is never recovery.
import path from 'node:path';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';

import { DomainError } from '../../contracts/types.js';
import { assertExactKeys, assertRecord, requireEnum } from '../../contracts/validation.js';
import { LIMITS } from '../../application/slack-pilot/contracts.js';
import { assertUtcTimestamp } from '../../domain/time/index.js';
import { hashCanonical } from '../../persistence/file-store/hashing.js';
import { writeAtomicCanonicalJson } from '../../persistence/file-store/atomic-file.js';
import {
  ensurePrivateDirectory,
  isNodeError,
  readStateRootFormat,
  resolveContainedPath,
  validateStateRoot,
} from '../../persistence/file-store/path-safety.js';
import { WriterLock } from '../../persistence/file-store/writer-lock.js';
import type { AgentOfficeRuntimeIdentity } from '../../runtime/identity.js';

export const AS1_GLOBAL_STATES = [
  'DISABLED_DEFAULT',
  'RECEIVE_GRANTED_ONE_PROFILE',
  'AUTHENTICATING_ONE_PROFILE',
  'RECEIVING_ONE_PROFILE',
  'DRAINING',
  'DISABLED_CLEAN',
  'DISABLED_LATCHED',
] as const;
export type As1GlobalState = (typeof AS1_GLOBAL_STATES)[number];

/** The exact closed two-profile union. No other slug can be latched, activated, or queried (review B05). */
export const AS1_PROFILE_SLUGS = ['agent-office-advisor', 'foundation-advisor'] as const;
export type As1ProfileSlug = (typeof AS1_PROFILE_SLUGS)[number];

/**
 * The closed legal global-state transition table (design §7/§15). A target absent from a source's list is an
 * illegal transition, never a silent overwrite. DISABLED_LATCHED is terminal and reachable only via the
 * separate irreversible kill; it never appears as a legal `to` here.
 */
const AS1_LEGAL_GLOBAL_TRANSITIONS: Readonly<Record<As1GlobalState, readonly As1GlobalState[]>> = {
  DISABLED_DEFAULT: ['RECEIVE_GRANTED_ONE_PROFILE', 'DRAINING', 'DISABLED_CLEAN'],
  RECEIVE_GRANTED_ONE_PROFILE: ['AUTHENTICATING_ONE_PROFILE', 'DRAINING', 'DISABLED_DEFAULT'],
  AUTHENTICATING_ONE_PROFILE: ['RECEIVING_ONE_PROFILE', 'DRAINING'],
  RECEIVING_ONE_PROFILE: ['DRAINING'],
  DRAINING: ['DISABLED_CLEAN'],
  DISABLED_CLEAN: ['DISABLED_DEFAULT'],
  DISABLED_LATCHED: [],
};

/** States that own exactly one active profile slug; the disabled states must always persist a null slug. */
const AS1_ACTIVE_STATES: readonly As1GlobalState[] = [
  'RECEIVE_GRANTED_ONE_PROFILE',
  'AUTHENTICATING_ONE_PROFILE',
  'RECEIVING_ONE_PROFILE',
  'DRAINING',
];

function stateIsActive(state: As1GlobalState): boolean {
  return AS1_ACTIVE_STATES.includes(state);
}

function assertProfileSlug(profileSlug: string): As1ProfileSlug {
  const match = AS1_PROFILE_SLUGS.find((slug) => slug === profileSlug);
  if (match === undefined) {
    throw new DomainError('FORBIDDEN_TARGET', 'profile slug is not one of the two closed AS1 profiles');
  }
  return match;
}

const CONTROL_KEYS = ['schemaVersion', 'state', 'killEngaged', 'latchReason', 'activeProfileSlug', 'updatedAt'] as const;
const PROFILE_LATCH_KEYS = ['schemaVersion', 'profileSlug', 'latched', 'reason', 'latchedAt'] as const;
const PROFILE_LATCH_SCHEMA = 'agent-office.as1-profile-latch.v1';
const CONTROL_SCHEMA = 'agent-office.as1-global-control.v1';
const ESTABLISHED_MARKER = 'control-established.json';
const LATCH_REASON_MAX = 512;

export interface As1GlobalControlV1 {
  readonly schemaVersion: typeof CONTROL_SCHEMA;
  readonly state: As1GlobalState;
  readonly killEngaged: boolean;
  readonly latchReason: string | null;
  readonly activeProfileSlug: As1ProfileSlug | null;
  readonly updatedAt: string;
}

interface ParsedProfileLatch {
  readonly latched: boolean;
  readonly reason: string | null;
  readonly latchedAt: string | null;
}

const INDEX_DIR = path.posix.join('indexes', 'as1-slack-pilot');

/** Serialize all durable control mutations so a concurrent latch/kill cannot overwrite the first reason. */
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

/** The AS1 lifecycle owner. Persists global control and per-profile latches; never auto-resets a latch. */
export class As1SlackControl {
  private readonly mutex = new AsyncMutex();
  private readonly profileLatchCache = new Map<As1ProfileSlug, boolean>();
  private lock: WriterLock | null;
  private released = false;
  /**
   * The SYNCHRONOUS operator-incident gate (Phase B, design §11.2). It starts open and is closed synchronously by
   * the SIGUSR2 handler BEFORE the durable global kill persists, so no new receive/poll/delivery/evidence/outbound
   * side effect can begin in the window between the synchronous close and the durable `DISABLED_LATCHED` write. A
   * closed gate fails every admission predicate closed; only a clean SIGTERM/SIGINT stop leaves it open to drain.
   */
  private incidentGateOpen = true;

  private constructor(
    private readonly stateRoot: string,
    private readonly stateRootId: string,
    private readonly clock: AgentOfficeRuntimeIdentity,
    private control: As1GlobalControlV1,
    lock: WriterLock,
  ) {
    this.lock = lock;
  }

  /**
   * The ONLY control open path. The control PRIVATELY owns the single-process WriterLock: it is acquired BEFORE
   * any read/validate/init (so two first-start processes cannot race), held for the control's whole lifetime,
   * and released only by `close()`. There is no way to obtain a live mutable control without its owned lock,
   * and a closed control rejects every mutation. Release on every failure path.
   */
  public static async open(
    stateRoot: string,
    clock: AgentOfficeRuntimeIdentity,
    options: { readonly retainLockForForeground?: boolean } = {},
  ): Promise<As1SlackControl> {
    const canonicalRoot = await validateStateRoot(stateRoot);
    const format = await readStateRootFormat(canonicalRoot);
    await ensurePrivateDirectory(canonicalRoot, INDEX_DIR);
    const lock = await WriterLock.acquire(canonicalRoot, {
      buildId: 'as1-slack-pilot',
      stateRootId: format.stateRootId,
      acquiredAt: clock.now(),
      // The Phase B foreground owner retains its exact close-on-exec O_EXCL descriptor for the process lifetime
      // (design §11.1); a one-shot command leaves it closed exactly as in Phase A.
      retainForForeground: options.retainLockForForeground === true,
    });
    try {
      const integrity = await validateStartupState(canonicalRoot, format.stateRootId);
      if (integrity !== 'FRESH') {
        const instance = new As1SlackControl(canonicalRoot, format.stateRootId, clock, integrity.control, lock);
        await instance.loadLatchCache();
        return instance;
      }
      const control: As1GlobalControlV1 = {
        schemaVersion: CONTROL_SCHEMA,
        state: 'DISABLED_DEFAULT',
        killEngaged: false,
        latchReason: null,
        activeProfileSlug: null,
        updatedAt: clock.now(),
      };
      const instance = new As1SlackControl(canonicalRoot, format.stateRootId, clock, control, lock);
      // Marker-LAST initialization under the held lock: control + both profile latches first, then the marker.
      await instance.persist();
      await instance.initializeProfileLatches();
      await instance.persistEstablishedMarker();
      await instance.loadLatchCache();
      return instance;
    } catch (error) {
      await lock.release();
      throw error;
    }
  }

  /** Seed the synchronous profile-latch cache from the durable canonical records (single-writer consistent). */
  private async loadLatchCache(): Promise<void> {
    for (const slug of AS1_PROFILE_SLUGS) {
      this.profileLatchCache.set(slug, await this.isProfileLatched(slug));
    }
  }

  // ── Synchronous, ownership-safe readiness predicates (review B05). No async read across a possible close;
  // the profile-latch state is served from the single-writer cache updated on latchProfile. ───────────────
  /** Owned + not globally killed + not profile-latched for this slug. Does NOT check the active slug/state. */
  private ownedClean(profileSlug: string): As1ProfileSlug | null {
    const slug = AS1_PROFILE_SLUGS.find((s) => s === profileSlug);
    if (slug === undefined) return null;
    if (this.released || this.lock === null || this.isGloballyLatched()) return null;
    // The synchronous operator-incident gate closes every admission predicate the instant SIGUSR2 fires, before
    // the durable kill persists (design §11.2). A clean stop never closes it, so drain still proceeds.
    if (!this.incidentGateOpen) return null;
    if (this.profileLatchCache.get(slug) === true) return null;
    return slug;
  }

  /** The pre-event hello/authentication-quarantine seal: owned/clean, active slug, and EXACTLY
   *  AUTHENTICATING_ONE_PROFILE — not RECEIVE_GRANTED (pre-connect) nor RECEIVING (already live) — so a caller
   *  cannot skip or replay lifecycle transitions. Fail-closed and synchronous. */
  public isConnectReady(profileSlug: string): boolean {
    const slug = this.ownedClean(profileSlug);
    return slug !== null && this.control.activeProfileSlug === slug && this.control.state === 'AUTHENTICATING_ONE_PROFILE';
  }

  /** Live receive readiness: EXACTLY RECEIVING_ONE_PROFILE for the active bound slug. A disabled/default or
   *  wrong-active-profile control is never actionable for an inbound envelope or ACK (fail-open fix). */
  public isReceiveReady(profileSlug: string): boolean {
    const slug = this.ownedClean(profileSlug);
    return slug !== null && this.control.activeProfileSlug === slug && this.control.state === 'RECEIVING_ONE_PROFILE';
  }

  /** PREACK_PENDING recovery readiness: owned/clean, active slug, and a NON-disabled (active) state. When
   *  disconnected/disabled a PREACK_PENDING record is left untouched (never advanced). Synchronous. */
  public isReceiveRecoveryReady(profileSlug: string): boolean {
    const slug = this.ownedClean(profileSlug);
    return slug !== null && this.control.activeProfileSlug === slug && stateIsActive(this.control.state);
  }

  /** Offline post-ACK drain readiness (design §12.3/§15.1): owned/clean for the service's fixed profile, never
   *  reopening a Socket. In DISABLED_CLEAN (expired + disconnected) no active profile is asserted; in an active
   *  RECEIVING/DRAINING state the active profile MUST be this exact slug (no cross-profile drain). Synchronous. */
  public isDrainReady(profileSlug: string): boolean {
    const slug = this.ownedClean(profileSlug);
    if (slug === null) return false;
    if (this.control.state === 'DISABLED_CLEAN') return true;
    if (this.control.state === 'RECEIVING_ONE_PROFILE' || this.control.state === 'DRAINING') {
      return this.control.activeProfileSlug === slug;
    }
    return false;
  }

  /**
   * The Phase B construction-bound LIVE delivery actionability predicate (design §5.3). It is the SINGLE current
   * control/latch gate the composition binds into delivery/socket/outbound; it is true ONLY when the control still
   * owns the writer lock, `state` is exactly `RECEIVING_ONE_PROFILE`, `killEngaged` is false, `latchReason` is null,
   * `activeProfileSlug` equals the selected closed slug, the selected profile latch is exactly unlatched, and the
   * synchronous incident gate is open. The live record and its hash are NEVER placed in a grant, capability,
   * delivery fact, evidence artifact, or a new durable field — this predicate is evaluated fresh, never serialized.
   */
  public isLiveDeliveryActionable(profileSlug: string): boolean {
    const slug = this.ownedClean(profileSlug);
    return (
      slug !== null &&
      this.control.activeProfileSlug === slug &&
      this.control.state === 'RECEIVING_ONE_PROFILE' &&
      !this.control.killEngaged &&
      this.control.latchReason === null
    );
  }

  /** True while the synchronous operator-incident gate is open (design §11.2). Closes the instant SIGUSR2 fires. */
  public isIncidentGateOpen(): boolean {
    return this.incidentGateOpen;
  }

  /**
   * Synchronously close the operator-incident admission gate (design §11.2). Called first, inside the SIGUSR2
   * handler, so no new side effect can begin before the durable global kill persists. Idempotent and never reopened.
   */
  public closeIncidentGate(): void {
    this.incidentGateOpen = false;
  }

  /**
   * Operator incident kill (design §11.2): synchronously close the incident gate, then durably engage the
   * irreversible global kill with the fixed internal reason `OPERATOR_INCIDENT_KILL`, preserving any first durable
   * kill reason. It never transitions the killed control to `DISABLED_CLEAN`. Serialized through the same mutex.
   */
  public async operatorIncidentKill(): Promise<void> {
    this.closeIncidentGate();
    await this.engageGlobalKill('OPERATOR_INCIDENT_KILL');
  }

  /**
   * A redacted control/latch observation for `status` (design §5.3/§11.1.3). Emits only stable state vocabulary and
   * booleans — never an ID, path, grant value, token fact, Slack response, or tmux coordinate.
   */
  public redactedObservation(profileSlug: string): {
    readonly state: As1GlobalState;
    readonly killEngaged: boolean;
    readonly incidentGateOpen: boolean;
    readonly activeProfileMatchesSelected: boolean;
    readonly deliveryActionable: boolean;
  } {
    const slug = AS1_PROFILE_SLUGS.find((s) => s === profileSlug) ?? null;
    return {
      state: this.control.state,
      killEngaged: this.isGloballyLatched(),
      incidentGateOpen: this.incidentGateOpen,
      activeProfileMatchesSelected: slug !== null && this.control.activeProfileSlug === slug,
      deliveryActionable: slug !== null && this.isLiveDeliveryActionable(slug),
    };
  }

  /**
   * Release the owned process lock and mark the control closed. Idempotent. Serialized through the SAME mutex
   * as every mutation, so it can never release the lock while a queued or in-flight durable mutation runs; any
   * mutation queued after close observes the released state and fails closed.
   */
  public async close(): Promise<void> {
    await this.mutex.run(async () => {
      const lock = this.lock;
      this.lock = null;
      this.released = true;
      if (lock !== null) await lock.release();
    });
  }

  public isOpen(): boolean {
    return !this.released && this.lock !== null;
  }

  /** Every durable mutation asserts the control still owns its lock; a released control fails closed. */
  private assertOwned(): void {
    if (this.released || this.lock === null) {
      throw new DomainError('GATEWAY_DISABLED', 'this control released its process lock and can no longer mutate');
    }
  }

  public getState(): As1GlobalState {
    return this.control.state;
  }

  /**
   * A LIVE control-record snapshot hash for the startup hello seal (design §5.3). It is recomputed from the current
   * in-memory control record — never a frozen grant field — is stable across the connect window (the control stays
   * AUTHENTICATING_ONE_PROFILE), and is deliberately distinct from the receive grant's frozen globalControlSnapshotHash.
   */
  public liveControlSnapshotHash(): string {
    return hashCanonical(this.control);
  }

  public getActiveProfileSlug(): As1ProfileSlug | null {
    return this.control.activeProfileSlug;
  }

  public isGloballyLatched(): boolean {
    return this.control.state === 'DISABLED_LATCHED' || this.control.killEngaged;
  }

  public isDefaultDisabled(): boolean {
    return this.control.state === 'DISABLED_DEFAULT' && !this.control.killEngaged;
  }

  /** Engage the irreversible global kill switch. No AS1 code path clears it (security §14.3). Serialized. */
  public async engageGlobalKill(reason: string): Promise<void> {
    await this.mutex.run(async () => {
      this.assertOwned();
      if (this.isGloballyLatched()) return; // preserve the first durable kill; never overwrite its reason
      this.control = {
        ...this.control,
        state: 'DISABLED_LATCHED',
        killEngaged: true,
        latchReason: requireLatchReason(reason),
        activeProfileSlug: null,
        updatedAt: this.clock.now(),
      };
      await this.persist();
    });
  }

  /** Transition global state through the closed legal table with an exact state↔slug correlation. Serialized. */
  public async transition(expectedFrom: As1GlobalState, to: As1GlobalState, activeProfileSlug?: string): Promise<void> {
    await this.mutex.run(async () => {
      this.assertOwned();
      if (this.isGloballyLatched()) {
        throw new DomainError('GATEWAY_DISABLED', 'global control is latched; no transition is permitted');
      }
      if (this.control.state !== expectedFrom) {
        throw new DomainError('INVALID_TRANSITION', `global control is not in the expected prior state ${expectedFrom}`);
      }
      if (!AS1_LEGAL_GLOBAL_TRANSITIONS[expectedFrom].includes(to)) {
        throw new DomainError('INVALID_TRANSITION', `global control transition ${expectedFrom} -> ${to} is not legal`);
      }
      let nextSlug: As1ProfileSlug | null;
      if (stateIsActive(to)) {
        // A transition into an active state requires exactly one closed slug (provided, or carried forward).
        const provided = activeProfileSlug === undefined ? this.control.activeProfileSlug : assertProfileSlug(activeProfileSlug);
        if (provided === null) {
          throw new DomainError('INVALID_TRANSITION', `transition into ${to} requires an active profile slug`);
        }
        nextSlug = provided;
      } else {
        // A transition into a disabled state clears the active slug.
        nextSlug = null;
      }
      this.control = { ...this.control, state: to, activeProfileSlug: nextSlug, updatedAt: this.clock.now() };
      await this.persist();
    });
  }

  /** Persist an irreversible profile latch. The FIRST latch is preserved; a true latch is never rewritten. */
  public async latchProfile(profileSlug: string, reason: string): Promise<void> {
    const slug = assertProfileSlug(profileSlug);
    const boundedReason = requireLatchReason(reason);
    await this.mutex.run(async () => {
      this.assertOwned();
      const target = await this.profileLatchPath(slug);
      const existing = await readJsonRecord(target);
      if (existing !== null) {
        // Parse before preserving: a malformed true must not silently return, a malformed false must not overwrite.
        const parsed = parseProfileLatch(existing, slug);
        if (parsed.latched) {
          this.profileLatchCache.set(slug, true);
          return; // preserve the first latch; never overwrite it
        }
      }
      await writeAtomicCanonicalJson(target, {
        schemaVersion: PROFILE_LATCH_SCHEMA,
        profileSlug: slug,
        latched: true,
        reason: boundedReason,
        latchedAt: this.clock.now(),
      });
      this.profileLatchCache.set(slug, true);
    });
  }

  public async isProfileLatched(profileSlug: string): Promise<boolean> {
    const slug = assertProfileSlug(profileSlug);
    const record = await readJsonRecord(await this.profileLatchPath(slug));
    if (record === null) {
      // The record is initialized for both profiles at establish; a missing file is a deletion, not "unlatched".
      throw new DomainError('STORE_QUARANTINED', 'as1 profile latch record is missing; refusing a silent reset');
    }
    return parseProfileLatch(record, slug).latched;
  }

  /** Clean shutdown: any active state drains through DRAINING to DISABLED_CLEAN via the legal table only. */
  public async shutdown(): Promise<void> {
    this.assertOwned();
    if (this.isGloballyLatched()) return;
    if (stateIsActive(this.control.state) && this.control.state !== 'DRAINING') {
      await this.transition(this.control.state, 'DRAINING');
    }
    if (this.control.state === 'DRAINING') {
      await this.transition('DRAINING', 'DISABLED_CLEAN');
    } else if (this.control.state === 'DISABLED_DEFAULT') {
      await this.transition('DISABLED_DEFAULT', 'DISABLED_CLEAN');
    }
  }

  /**
   * Rollback (security §20). Never bypasses DRAINING: an active/receiving state drains through the legal table
   * first; a pre-connection RECEIVE_GRANTED state returns to DISABLED_DEFAULT. A latch is never cleared.
   */
  public async rollbackToDisabled(): Promise<void> {
    this.assertOwned();
    if (this.isGloballyLatched()) return;
    if (this.control.state === 'RECEIVING_ONE_PROFILE' || this.control.state === 'AUTHENTICATING_ONE_PROFILE' || this.control.state === 'DRAINING') {
      await this.shutdown(); // active connection: drain, do not bypass DRAINING
      return;
    }
    if (this.control.state === 'RECEIVE_GRANTED_ONE_PROFILE') {
      await this.transition('RECEIVE_GRANTED_ONE_PROFILE', 'DISABLED_DEFAULT');
    }
  }

  private profileLatchPath(slug: As1ProfileSlug): Promise<string> {
    return resolveContainedPath(this.stateRoot, path.posix.join(INDEX_DIR, 'profiles', slug, 'failure-latch.json'), {
      allowMissingLeaf: true,
    });
  }

  private async persist(): Promise<void> {
    const target = await resolveContainedPath(this.stateRoot, path.posix.join(INDEX_DIR, 'global-control.json'), {
      allowMissingLeaf: true,
    });
    await writeAtomicCanonicalJson(target, this.control);
  }

  private async persistEstablishedMarker(): Promise<void> {
    const target = await resolveContainedPath(this.stateRoot, path.posix.join(INDEX_DIR, ESTABLISHED_MARKER), {
      allowMissingLeaf: true,
    });
    await writeAtomicCanonicalJson(target, {
      schemaVersion: 'agent-office.as1-control-established.v1',
      stateRootId: this.stateRootId,
      establishedAt: this.clock.now(),
    });
  }

  private async initializeProfileLatches(): Promise<void> {
    for (const slug of AS1_PROFILE_SLUGS) {
      await ensurePrivateDirectory(this.stateRoot, path.posix.join(INDEX_DIR, 'profiles', slug));
      await writeAtomicCanonicalJson(await this.profileLatchPath(slug), {
        schemaVersion: PROFILE_LATCH_SCHEMA,
        profileSlug: slug,
        latched: false,
        reason: null,
        latchedAt: null,
      });
    }
  }
}

function requireLatchReason(reason: string): string {
  if (typeof reason !== 'string' || reason.length === 0 || reason.length > LATCH_REASON_MAX) {
    throw new DomainError('INVALID_SCHEMA', 'a latch reason must be a bounded non-empty string');
  }
  return reason;
}

/** Centralized strict profile-latch parser with exact correlations (review B05). */
function parseProfileLatch(record: Record<string, unknown>, slug: As1ProfileSlug): ParsedProfileLatch {
  assertRecord(record, 'as1 profile latch');
  assertExactKeys(record, PROFILE_LATCH_KEYS, 'as1 profile latch');
  if (record.schemaVersion !== PROFILE_LATCH_SCHEMA || record.profileSlug !== slug || typeof record.latched !== 'boolean') {
    throw new DomainError('STORE_QUARANTINED', 'as1 profile latch record is corrupt; failing closed');
  }
  if (record.latched) {
    if (typeof record.reason !== 'string' || record.reason.length === 0 || record.reason.length > LATCH_REASON_MAX) {
      throw new DomainError('STORE_QUARANTINED', 'as1 profile latch is true but its reason is not a bounded string');
    }
    if (typeof record.latchedAt !== 'string') {
      throw new DomainError('STORE_QUARANTINED', 'as1 profile latch is true but has no UTC latchedAt');
    }
    assertUtcTimestamp(record.latchedAt, 'as1 profile latchedAt');
    return { latched: true, reason: record.reason, latchedAt: record.latchedAt };
  }
  if (record.reason !== null || record.latchedAt !== null) {
    throw new DomainError('STORE_QUARANTINED', 'as1 profile latch is false but carries a reason/time');
  }
  return { latched: false, reason: null, latchedAt: null };
}

function parseControl(record: Record<string, unknown>): As1GlobalControlV1 {
  assertRecord(record, 'as1 global control');
  assertExactKeys(record, CONTROL_KEYS, 'as1 global control');
  if (record.schemaVersion !== CONTROL_SCHEMA) {
    throw new DomainError('STORE_QUARANTINED', 'as1 global control schemaVersion is unsupported');
  }
  const state = requireEnum(record.state, AS1_GLOBAL_STATES, 'as1 global control state');
  if (typeof record.killEngaged !== 'boolean') {
    throw new DomainError('STORE_QUARANTINED', 'as1 global control killEngaged must be a real boolean');
  }
  if (!(record.latchReason === null || typeof record.latchReason === 'string')) {
    throw new DomainError('STORE_QUARANTINED', 'as1 global control latchReason must be a string or null');
  }
  let activeProfileSlug: As1ProfileSlug | null;
  if (record.activeProfileSlug === null) {
    activeProfileSlug = null;
  } else if (typeof record.activeProfileSlug === 'string' && AS1_PROFILE_SLUGS.some((s) => s === record.activeProfileSlug)) {
    activeProfileSlug = record.activeProfileSlug as As1ProfileSlug;
  } else {
    throw new DomainError('STORE_QUARANTINED', 'as1 global control activeProfileSlug must be null or a closed profile slug');
  }
  if (typeof record.updatedAt !== 'string') {
    throw new DomainError('STORE_QUARANTINED', 'as1 global control updatedAt must be a UTC string');
  }
  assertUtcTimestamp(record.updatedAt, 'as1 global control updatedAt');
  // Exact correlations: kill ⟺ DISABLED_LATCHED (+ reason); active states own one slug, disabled states none.
  if (record.killEngaged !== (state === 'DISABLED_LATCHED')) {
    throw new DomainError('STORE_QUARANTINED', 'as1 global control killEngaged does not correlate with DISABLED_LATCHED');
  }
  if (record.killEngaged) {
    if (typeof record.latchReason !== 'string' || record.latchReason.length === 0 || record.latchReason.length > LATCH_REASON_MAX) {
      throw new DomainError('STORE_QUARANTINED', 'as1 global control is latched but its reason is not a bounded string');
    }
  } else if (record.latchReason !== null) {
    throw new DomainError('STORE_QUARANTINED', 'as1 global control is not latched but carries a stale latch reason');
  }
  if (stateIsActive(state) !== (activeProfileSlug !== null)) {
    throw new DomainError('STORE_QUARANTINED', 'as1 global control state does not correlate with its active profile slug');
  }
  return { schemaVersion: CONTROL_SCHEMA, state, killEngaged: record.killEngaged, latchReason: record.latchReason, activeProfileSlug, updatedAt: record.updatedAt };
}

/**
 * The whole durable control surface must be internally consistent on every open. With the established marker
 * present, the strict control record and BOTH profile latch records must exist and parse. With no marker, any
 * partial residue (control or either profile record) is a crash/deletion and quarantines — it never auto-heals.
 */
async function validateStartupState(
  canonicalRoot: string,
  stateRootId: string,
): Promise<{ readonly control: As1GlobalControlV1 } | 'FRESH'> {
  const marker = await readJsonRecord(await controlPath(canonicalRoot, ESTABLISHED_MARKER));
  const control = await readJsonRecord(await controlPath(canonicalRoot, 'global-control.json'));
  const profiles = await Promise.all(
    AS1_PROFILE_SLUGS.map(async (slug) => readJsonRecord(await controlPath(canonicalRoot, path.posix.join('profiles', slug, 'failure-latch.json')))),
  );
  if (marker !== null) {
    // The marker itself is strictly validated: a merely-parseable object must not establish trust (review B05).
    assertEstablishedMarker(marker, stateRootId);
    if (control === null) {
      throw new DomainError('STORE_QUARANTINED', 'as1 global control is missing but was previously established; refusing a silent reset');
    }
    AS1_PROFILE_SLUGS.forEach((slug, index) => {
      const record = profiles[index];
      if (record === undefined || record === null) {
        throw new DomainError('STORE_QUARANTINED', `as1 profile latch for ${slug} is missing but was previously established`);
      }
      parseProfileLatch(record, slug);
    });
    return { control: parseControl(control) };
  }
  if (control !== null || profiles.some((record) => record !== null)) {
    throw new DomainError('STORE_QUARANTINED', 'as1 control state is partially initialized without its established marker; refusing to auto-heal');
  }
  return 'FRESH';
}

const MARKER_KEYS = ['schemaVersion', 'stateRootId', 'establishedAt'] as const;

/** Strictly validate the established marker: exact keys/schema, exact matching stateRootId, and a real UTC. */
function assertEstablishedMarker(record: Record<string, unknown>, stateRootId: string): void {
  assertRecord(record, 'as1 control established marker');
  assertExactKeys(record, MARKER_KEYS, 'as1 control established marker');
  if (record.schemaVersion !== 'agent-office.as1-control-established.v1') {
    throw new DomainError('STORE_QUARANTINED', 'as1 control established marker schemaVersion is unsupported');
  }
  if (record.stateRootId !== stateRootId) {
    throw new DomainError('STORE_QUARANTINED', 'as1 control established marker names a different state root');
  }
  if (typeof record.establishedAt !== 'string') {
    throw new DomainError('STORE_QUARANTINED', 'as1 control established marker establishedAt must be a UTC string');
  }
  assertUtcTimestamp(record.establishedAt, 'as1 control established marker establishedAt');
}

function controlPath(canonicalRoot: string, name: string): Promise<string> {
  return resolveContainedPath(canonicalRoot, path.posix.join(INDEX_DIR, name), { allowMissingLeaf: true });
}

async function readJsonRecord(target: string): Promise<Record<string, unknown> | null> {
  let handle: import('node:fs/promises').FileHandle;
  try {
    handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) return null;
    throw error;
  }
  try {
    // Enforce the fixed durable-file byte ceiling on the pinned fd before allocating/reading/parsing the global
    // control file, so a tampered oversized file fails closed before it is loaded (review B08). Same fd, no TOCTOU.
    const stat = await handle.stat();
    if (stat.size > LIMITS.DURABLE_FILE_MAX_BYTES) {
      throw new DomainError('STORE_QUARANTINED', `as1 control file exceeds the ${String(LIMITS.DURABLE_FILE_MAX_BYTES)}-byte durable-file bound`);
    }
    const bytes = await handle.readFile();
    // A fatal UTF-8 decode failure or a JSON syntax error on a durable control file is durable corruption, not a
    // programming fault: normalize it to the reviewed quarantine class (review B08) so the establish-verify path fails
    // closed with a latchable global error on every restart instead of surfacing a raw, code-less SyntaxError/TypeError.
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
      throw new DomainError('STORE_QUARANTINED', 'as1 control file is not valid UTF-8 JSON');
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new DomainError('STORE_QUARANTINED', 'as1 control record is not an object');
    }
    return parsed as Record<string, unknown>;
  } finally {
    await handle.close();
  }
}
