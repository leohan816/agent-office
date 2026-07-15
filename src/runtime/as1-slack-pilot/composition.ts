// AS1 Multi-Team Slack Pilot — default-disabled runtime composition.
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_DESIGN.md §17 (composition);
// docs/operations/AGENT_OFFICE_AS1_SLACK_SETUP.md §7 (lifecycle). With the committed descriptor and no
// reviewed receive-grant ref, the gateway cannot connect, deliver, mint authority, or select a profile.
// `start` returns a stable disconnected/authority-missing result without opening Slack or tmux. A live
// connection is a separate Advisor-owned, separately authorized action after every preceding gate — never
// performed here in Phase A. This composition constructs no real Slack/tmux client and reaches no network.
import { DomainError } from '../../contracts/types.js';
import { assertExactKeys, assertRecord } from '../../contracts/validation.js';
import { redactError } from '../../application/slack-pilot/contracts.js';
import type { As1ProfileLatchPort } from '../../application/slack-pilot/service.js';
import type { AgentOfficeRuntimeIdentity } from '../identity.js';
import { As1SlackControl, type As1GlobalState, type As1ProfileSlug } from '../../operations/readiness/as1-slack-control.js';

/**
 * Bind the inbound service's profile-latch port to the ONE canonical, lock-owning control record for a closed
 * profile slug (review B05). Production wires the service through this — never a second latch truth.
 */
export function controlProfileLatchPort(control: As1SlackControl, profileSlug: As1ProfileSlug): As1ProfileLatchPort {
  return {
    latchProfile: (reason: string): Promise<void> => control.latchProfile(profileSlug, reason),
    isProfileLatched: (): Promise<boolean> => control.isProfileLatched(profileSlug),
  };
}

const DESCRIPTOR_SCHEMA_VERSION = 'agent-office.as1-slack-pilot-descriptor.v1' as const;
const DESCRIPTOR_KEYS = ['schemaVersion', 'enabled', 'receiveGrantRef', 'secretFilePath'] as const;

export interface As1RuntimeDescriptorV1 {
  readonly schemaVersion: typeof DESCRIPTOR_SCHEMA_VERSION;
  readonly enabled: boolean;
  /** The exact Advisor-created receive-grant authority ref; null in the committed default descriptor. */
  readonly receiveGrantRef: string | null;
  readonly secretFilePath: string;
}

/** Parse the committed runtime descriptor. It can never represent a delivery grant, lease, or capability. */
export function parseRuntimeDescriptor(value: unknown): As1RuntimeDescriptorV1 {
  assertRecord(value, 'as1 runtime descriptor');
  assertExactKeys(value, DESCRIPTOR_KEYS, 'as1 runtime descriptor');
  if (value.schemaVersion !== DESCRIPTOR_SCHEMA_VERSION) {
    throw new DomainError('INVALID_SCHEMA', 'as1 runtime descriptor schemaVersion is unsupported');
  }
  if (typeof value.enabled !== 'boolean') {
    throw new DomainError('INVALID_SCHEMA', 'as1 runtime descriptor enabled must be a boolean');
  }
  if (value.receiveGrantRef !== null && typeof value.receiveGrantRef !== 'string') {
    throw new DomainError('INVALID_SCHEMA', 'as1 runtime descriptor receiveGrantRef must be a string or null');
  }
  if (typeof value.secretFilePath !== 'string' || value.secretFilePath.length === 0) {
    throw new DomainError('INVALID_SCHEMA', 'as1 runtime descriptor secretFilePath must be a non-empty string');
  }
  return {
    schemaVersion: DESCRIPTOR_SCHEMA_VERSION,
    enabled: value.enabled,
    receiveGrantRef: value.receiveGrantRef,
    secretFilePath: value.secretFilePath,
  };
}

export type As1ConnectReason =
  | 'GLOBAL_LATCHED'
  | 'DISABLED_DEFAULT_NO_AUTHORITY'
  | 'LIVE_START_REQUIRES_SEPARATE_AUTHORIZATION';

export interface As1StartResult {
  readonly connected: false;
  readonly reason: As1ConnectReason;
  readonly state: As1GlobalState;
}

export interface As1RedactedStatus {
  readonly schemaVersion: 'agent-office.as1-slack-status.v1';
  readonly state: As1GlobalState;
  readonly killEngaged: boolean;
  readonly connected: false;
  readonly liveConnection: 'NOT_STARTED';
}

/** The composed gateway. In Phase A it only reports disconnected state and manages control/rollback. */
export class As1GatewayComposition {
  private control: As1SlackControl;
  private closed = false;

  private constructor(
    private readonly descriptor: As1RuntimeDescriptorV1,
    control: As1SlackControl,
    private readonly stateRoot: string,
    private readonly clock: AgentOfficeRuntimeIdentity,
  ) {
    this.control = control;
  }

  /**
   * Open the composition. The control privately owns the single-process WriterLock — acquired BEFORE any
   * control read/validate/init, so two first-start processes on the same state root cannot race on
   * control/marker/latch files (the second fails closed). The full durable-state integrity check runs under
   * exclusivity, and the lock is owned for the composition's lifetime (released only by stop()/close()).
   */
  public static async open(
    descriptor: As1RuntimeDescriptorV1,
    options: { readonly stateRoot: string; readonly clock: AgentOfficeRuntimeIdentity },
  ): Promise<As1GatewayComposition> {
    const control = await As1SlackControl.open(options.stateRoot, options.clock);
    return new As1GatewayComposition(descriptor, control, options.stateRoot, options.clock);
  }

  /** Fail-closed start. Never opens Slack or tmux; a live connection is a separate authorized step. */
  public start(): As1StartResult {
    this.assertOpen();
    if (this.control.isGloballyLatched()) {
      return { connected: false, reason: 'GLOBAL_LATCHED', state: this.control.getState() };
    }
    if (!this.descriptor.enabled || this.descriptor.receiveGrantRef === null) {
      return { connected: false, reason: 'DISABLED_DEFAULT_NO_AUTHORITY', state: this.control.getState() };
    }
    // Even with a grant ref, Phase A never performs the live connection or profile selection.
    return { connected: false, reason: 'LIVE_START_REQUIRES_SEPARATE_AUTHORIZATION', state: this.control.getState() };
  }

  /**
   * Bounded clean shutdown (design §15.3): drain the control lifecycle, then release the WriterLock — and
   * only in that order. An ambiguous drain engages the durable global kill BEFORE the lock is released, so
   * an unresolved shutdown is never silently forgotten.
   */
  public async stop(): Promise<As1RedactedStatus> {
    this.assertOpen();
    // Closed the instant stop begins: even if the drain throws, this composition is never reusable afterward.
    this.closed = true;
    return this.drainAndRelease();
  }

  /**
   * Restart cannot reuse a released lock. It stops (drains + releases), then reopens the whole composition —
   * reacquiring the WriterLock and re-running the full startup integrity check under the same trusted
   * descriptor/state-root/clock — before a fresh start. In Phase A it remains disconnected.
   */
  public async restart(): Promise<As1StartResult> {
    this.assertOpen();
    // Closed for the WHOLE drain + reacquire window: cleared to false ONLY after a fully successful reopen. If
    // the drain throws, or another process wins the lock, or integrity fails, this composition stays closed —
    // a caller that catches the error can never invoke start() on stale control without ownership.
    this.closed = true;
    await this.drainAndRelease();
    const reopened = await As1SlackControl.open(this.stateRoot, this.clock);
    this.control = reopened;
    this.closed = false;
    return this.start();
  }

  public async rollback(): Promise<As1RedactedStatus> {
    this.assertOpen();
    await this.control.rollbackToDisabled();
    return this.status();
  }

  /** Close the owned control (releasing its lock) and mark the composition closed. Idempotent. */
  public async close(): Promise<void> {
    await this.control.close();
    this.closed = true;
  }

  /**
   * Bounded drain (design §15.3): drain the control lifecycle, then close the control (releasing its lock) —
   * in that order. An ambiguous drain engages the durable global kill BEFORE the lock is released, so it is
   * never forgotten. The kill mutation runs while the control still owns its lock.
   */
  private async drainAndRelease(): Promise<As1RedactedStatus> {
    try {
      await this.control.shutdown();
    } catch (error) {
      await this.control.engageGlobalKill(`ambiguous shutdown drain: ${redactError(error).code}`);
      await this.control.close();
      throw error;
    }
    const status = this.status();
    await this.control.close();
    return status;
  }

  private assertOpen(): void {
    if (this.closed || !this.control.isOpen()) {
      throw new DomainError('GATEWAY_DISABLED', 'this composition was stopped/closed and released its lock; open a new one');
    }
  }

  public status(): As1RedactedStatus {
    return {
      schemaVersion: 'agent-office.as1-slack-status.v1',
      state: this.control.getState(),
      killEngaged: this.control.isGloballyLatched(),
      connected: false,
      liveConnection: 'NOT_STARTED',
    };
  }
}
