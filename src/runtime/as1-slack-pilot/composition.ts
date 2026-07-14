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
import type { AgentOfficeRuntimeIdentity } from '../identity.js';
import { As1SlackControl, type As1GlobalState } from '../../operations/readiness/as1-slack-control.js';

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
  private constructor(
    private readonly descriptor: As1RuntimeDescriptorV1,
    private readonly control: As1SlackControl,
  ) {}

  public static async open(
    descriptor: As1RuntimeDescriptorV1,
    options: { readonly stateRoot: string; readonly clock: AgentOfficeRuntimeIdentity },
  ): Promise<As1GatewayComposition> {
    const control = await As1SlackControl.open(options.stateRoot, options.clock);
    return new As1GatewayComposition(descriptor, control);
  }

  /** Fail-closed start. Never opens Slack or tmux; a live connection is a separate authorized step. */
  public start(): As1StartResult {
    if (this.control.isGloballyLatched()) {
      return { connected: false, reason: 'GLOBAL_LATCHED', state: this.control.getState() };
    }
    if (!this.descriptor.enabled || this.descriptor.receiveGrantRef === null) {
      return { connected: false, reason: 'DISABLED_DEFAULT_NO_AUTHORITY', state: this.control.getState() };
    }
    // Even with a grant ref, Phase A never performs the live connection or profile selection.
    return { connected: false, reason: 'LIVE_START_REQUIRES_SEPARATE_AUTHORIZATION', state: this.control.getState() };
  }

  public async stop(): Promise<As1RedactedStatus> {
    await this.control.shutdown();
    return this.status();
  }

  public async rollback(): Promise<As1RedactedStatus> {
    await this.control.rollbackToDisabled();
    return this.status();
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
