// AS1 Multi-Team Slack Pilot — global/profile control, single-process lock, shutdown, and rollback.
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_DESIGN.md §7 (durable state), §15
// (replay/kill/shutdown); docs/security/AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md §7 (control
// states), §14 (latching), §20 (rollback). There is one lifecycle owner and one global kill switch.
// DISABLED_LATCHED has no reset in AS1; recovery requires a separately reviewed procedure. Latch
// persistence happens before client close where possible; if latch persistence itself fails, the next run
// fails startup due to unverifiable control state. Deleting state is never recovery.
import path from 'node:path';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';

import { DomainError } from '../../contracts/types.js';
import { assertExactKeys, assertRecord, requireEnum } from '../../contracts/validation.js';
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

const CONTROL_KEYS = ['schemaVersion', 'state', 'killEngaged', 'latchReason', 'activeProfileSlug', 'updatedAt'] as const;

export interface As1GlobalControlV1 {
  readonly schemaVersion: 'agent-office.as1-global-control.v1';
  readonly state: As1GlobalState;
  readonly killEngaged: boolean;
  readonly latchReason: string | null;
  readonly activeProfileSlug: string | null;
  readonly updatedAt: string;
}

const INDEX_DIR = path.posix.join('indexes', 'as1-slack-pilot');

/** The AS1 lifecycle owner. Persists global control and per-profile latches; never auto-resets a latch. */
export class As1SlackControl {
  private constructor(
    private readonly stateRoot: string,
    private readonly stateRootId: string,
    private readonly clock: AgentOfficeRuntimeIdentity,
    private control: As1GlobalControlV1,
  ) {}

  public static async open(stateRoot: string, clock: AgentOfficeRuntimeIdentity): Promise<As1SlackControl> {
    const canonicalRoot = await validateStateRoot(stateRoot);
    const format = await readStateRootFormat(canonicalRoot);
    await ensurePrivateDirectory(canonicalRoot, INDEX_DIR);
    const existing = await readControl(canonicalRoot);
    const control =
      existing ??
      ({
        schemaVersion: 'agent-office.as1-global-control.v1',
        state: 'DISABLED_DEFAULT',
        killEngaged: false,
        latchReason: null,
        activeProfileSlug: null,
        updatedAt: clock.now(),
      } satisfies As1GlobalControlV1);
    const instance = new As1SlackControl(canonicalRoot, format.stateRootId, clock, control);
    if (existing === null) await instance.persist();
    return instance;
  }

  public getState(): As1GlobalState {
    return this.control.state;
  }

  public isGloballyLatched(): boolean {
    return this.control.state === 'DISABLED_LATCHED' || this.control.killEngaged;
  }

  public isDefaultDisabled(): boolean {
    return this.control.state === 'DISABLED_DEFAULT' && !this.control.killEngaged;
  }

  /** Engage the irreversible global kill switch. No AS1 code path clears it (security §14.3). */
  public async engageGlobalKill(reason: string): Promise<void> {
    this.control = { ...this.control, state: 'DISABLED_LATCHED', killEngaged: true, latchReason: reason, updatedAt: this.clock.now() };
    await this.persist();
  }

  /** Transition global state with an expected prior state; refuses any transition once latched. */
  public async transition(expectedFrom: As1GlobalState, to: As1GlobalState, activeProfileSlug?: string): Promise<void> {
    if (this.isGloballyLatched()) {
      throw new DomainError('GATEWAY_DISABLED', 'global control is latched; no transition is permitted');
    }
    if (this.control.state !== expectedFrom) {
      throw new DomainError('INVALID_TRANSITION', `global control is not in the expected prior state ${expectedFrom}`);
    }
    this.control = {
      ...this.control,
      state: to,
      activeProfileSlug: activeProfileSlug ?? this.control.activeProfileSlug,
      updatedAt: this.clock.now(),
    };
    await this.persist();
  }

  public async latchProfile(profileSlug: string, reason: string): Promise<void> {
    await ensurePrivateDirectory(this.stateRoot, path.posix.join(INDEX_DIR, 'profiles', profileSlug));
    const target = await resolveContainedPath(
      this.stateRoot,
      path.posix.join(INDEX_DIR, 'profiles', profileSlug, 'failure-latch.json'),
      { allowMissingLeaf: true },
    );
    await writeAtomicCanonicalJson(target, {
      schemaVersion: 'agent-office.as1-profile-latch.v1',
      profileSlug,
      latched: true,
      reason,
      latchedAt: this.clock.now(),
    });
  }

  public async isProfileLatched(profileSlug: string): Promise<boolean> {
    const target = await resolveContainedPath(
      this.stateRoot,
      path.posix.join(INDEX_DIR, 'profiles', profileSlug, 'failure-latch.json'),
      { allowMissingLeaf: true },
    );
    const record = await readJsonRecord(target);
    return record !== null && record.latched === true;
  }

  /** Acquire the single-process lock (reuses the canonical WriterLock). Second acquisition fails closed. */
  public async acquireProcessLock(): Promise<WriterLock> {
    return WriterLock.acquire(this.stateRoot, {
      buildId: 'as1-slack-pilot',
      stateRootId: this.stateRootId,
      acquiredAt: this.clock.now(),
    });
  }

  /** Clean shutdown: DRAINING then DISABLED_CLEAN. An ambiguous drain must latch instead (caller decides). */
  public async shutdown(): Promise<void> {
    if (this.isGloballyLatched()) return;
    if (this.control.state === 'RECEIVING_ONE_PROFILE' || this.control.state === 'AUTHENTICATING_ONE_PROFILE' || this.control.state === 'RECEIVE_GRANTED_ONE_PROFILE') {
      await this.transition(this.control.state, 'DRAINING');
    }
    if (this.control.state === 'DRAINING' || this.control.state === 'DISABLED_DEFAULT') {
      this.control = { ...this.control, state: 'DISABLED_CLEAN', updatedAt: this.clock.now() };
      await this.persist();
    }
  }

  /** Rollback before any live connection leaves the committed runtime selection disabled (security §20). */
  public async rollbackToDisabled(): Promise<void> {
    if (this.isGloballyLatched()) return; // a latch is never cleared by rollback
    this.control = { ...this.control, state: 'DISABLED_DEFAULT', activeProfileSlug: null, updatedAt: this.clock.now() };
    await this.persist();
  }

  private async persist(): Promise<void> {
    const target = await resolveContainedPath(this.stateRoot, path.posix.join(INDEX_DIR, 'global-control.json'), {
      allowMissingLeaf: true,
    });
    await writeAtomicCanonicalJson(target, this.control);
  }
}

async function readControl(canonicalRoot: string): Promise<As1GlobalControlV1 | null> {
  const target = await resolveContainedPath(canonicalRoot, path.posix.join(INDEX_DIR, 'global-control.json'), {
    allowMissingLeaf: true,
  });
  const record = await readJsonRecord(target);
  if (record === null) return null;
  assertRecord(record, 'as1 global control');
  assertExactKeys(record, CONTROL_KEYS, 'as1 global control');
  if (record.schemaVersion !== 'agent-office.as1-global-control.v1') {
    throw new DomainError('STORE_QUARANTINED', 'as1 global control schemaVersion is unsupported');
  }
  return {
    schemaVersion: 'agent-office.as1-global-control.v1',
    state: requireEnum(record.state, AS1_GLOBAL_STATES, 'as1 global control state'),
    killEngaged: record.killEngaged === true,
    latchReason: typeof record.latchReason === 'string' ? record.latchReason : null,
    activeProfileSlug: typeof record.activeProfileSlug === 'string' ? record.activeProfileSlug : null,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
  };
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
    const bytes = await handle.readFile();
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new DomainError('STORE_QUARANTINED', 'as1 control record is not an object');
    }
    return parsed as Record<string, unknown>;
  } finally {
    await handle.close();
  }
}
