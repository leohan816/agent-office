// AS1 Multi-Team Slack Pilot — Phase B closed lifecycle command parser and redacted CLI (design §11).
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_PHASE_B_LIVE_COMPOSITION_DESIGN_DELTA.md §5.1/§11.1.
// The closed verbs are start / stop / incident-kill / status / restart / redacted-check. `start` and
// `redacted-check` require exactly one `--env-file <path>` and the `AS1_SLACK_STATE_ROOT` owner instruction;
// the observer verbs `stop`, `incident-kill`, `status`, and live-disabled `restart` are ZERO-operand and resolve
// only the construction-bound state-root literal — they accept no state-root, secret, profile, PID, signal,
// destination, or reason operand. There is no profile flag and the CLI cannot select a profile or mint/complete a
// grant. Before ANY startup mutation, `start`/`redacted-check` run the mutation-free pinned-interpreter capability
// probe; a non-success maps to the single redacted code LIFECYCLE_CAPABILITY_UNAVAILABLE and exit 2. `stop` and
// `incident-kill` signal the running owner ONLY through the sealed pidfd bridge (never a numeric-PID kill). Output
// never echoes a token, prefix, length, raw ID, file contents, Slack response body, or tmux coordinate.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { DomainError } from '../../contracts/types.js';
import { parseSecretConfigFile } from '../../adapters/gateways/slack-pilot/secret-config.js';
import { initializeStateRoot } from '../../persistence/file-store/path-safety.js';
import { AS1_OWNER_SHUTDOWN_DEADLINE_MS, probeCapability, signalOwner } from '../../persistence/file-store/writer-lock.js';
import { createSystemRuntimeIdentity } from '../identity.js';
import { As1GatewayComposition, parseRuntimeDescriptor } from './composition.js';

/** The exact fixed owner state root (design §5.1). The observer verbs resolve ONLY this construction-bound literal. */
export const AS1_OWNER_STATE_ROOT = '/home/leo/.local/state/agent-office/as1-slack-pilot';
const AS1_OWNER_LOCK_PATH = path.posix.join(AS1_OWNER_STATE_ROOT, 'locks', 'writer.lock');

export const AS1_COMMANDS = ['start', 'stop', 'incident-kill', 'status', 'restart', 'redacted-check'] as const;
export type As1Command = (typeof AS1_COMMANDS)[number];

/** The two verbs that cross the owner filesystem/secret boundary and require the exact `--env-file` path. */
const ENV_FILE_COMMANDS: readonly As1Command[] = ['start', 'redacted-check'];

export interface As1CliInvocation {
  readonly command: As1Command;
  /** The exact `--env-file` path for start/redacted-check; null for the zero-operand observer verbs. */
  readonly envFilePath: string | null;
}

/**
 * Parse a closed argv (design §5.1). start/redacted-check require exactly one `--env-file <path>`; stop,
 * incident-kill, status, and restart accept NO operand at all. Any unknown command, extra token, descriptor,
 * profile, grant, PID, signal, path, or reason override is rejected.
 */
export function parseAs1Cli(argv: readonly string[]): As1CliInvocation {
  const first = argv[0];
  if (first === undefined || !(AS1_COMMANDS as readonly string[]).includes(first)) {
    throw new DomainError('ARBITRARY_COMMAND_FORBIDDEN', 'as1 cli command is not one of the closed lifecycle commands');
  }
  const command = first as As1Command;
  const rest = argv.slice(1);
  if (!ENV_FILE_COMMANDS.includes(command)) {
    // Zero-operand observer verb: no --env-file, PID, signal, profile, path, destination, or reason.
    if (rest.length !== 0) {
      throw new DomainError('ARBITRARY_COMMAND_FORBIDDEN', 'the observer verb accepts no operand');
    }
    return { command, envFilePath: null };
  }
  let envFilePath: string | null = null;
  let index = 0;
  while (index < rest.length) {
    const token = rest[index];
    if (token === '--env-file') {
      const value = rest[index + 1];
      if (value === undefined || value.startsWith('--') || envFilePath !== null) {
        throw new DomainError('INVALID_SCHEMA', 'as1 cli requires exactly one --env-file <path>');
      }
      envFilePath = value;
      index += 2;
      continue;
    }
    throw new DomainError('ARBITRARY_COMMAND_FORBIDDEN', 'as1 cli rejects an unrecognized argument');
  }
  if (envFilePath === null) {
    throw new DomainError('INVALID_SCHEMA', 'as1 cli requires --env-file <path>');
  }
  return { command, envFilePath };
}

export interface As1CliResult {
  readonly command: As1Command;
  readonly ok: boolean;
  readonly lines: readonly string[];
}

/**
 * Run a composition-operating command against the owned composition (the owner process / a synthetic test). The
 * separate-process observer signal path for stop/incident-kill is `runObserverSignal`; `status` here reports the
 * owned control's redacted projection.
 */
export async function runAs1Cli(invocation: As1CliInvocation, composition: As1GatewayComposition): Promise<As1CliResult> {
  switch (invocation.command) {
    case 'redacted-check': {
      if (invocation.envFilePath === null) throw new DomainError('INVALID_SCHEMA', 'redacted-check requires --env-file');
      const config = await parseSecretConfigFile(invocation.envFilePath);
      return { command: 'redacted-check', ok: true, lines: config.renderRedactedCheck().split('\n') };
    }
    case 'start': {
      const result = await composition.start();
      return { command: 'start', ok: result.connected, lines: statusLines('start', result.state, result.reason) };
    }
    case 'stop': {
      const status = await composition.stop();
      return { command: 'stop', ok: true, lines: statusLines('stop', status.state, 'STOPPED_CLEAN') };
    }
    case 'incident-kill': {
      const status = await composition.incidentKill();
      return { command: 'incident-kill', ok: true, lines: statusLines('incident-kill', status.state, 'INCIDENT_KILL_ENGAGED') };
    }
    case 'restart': {
      const result = composition.restartDisabled();
      return { command: 'restart', ok: false, lines: statusLines('restart', result.state, 'RESTART_LIVE_DISABLED') };
    }
    case 'status': {
      const status = composition.status();
      return { command: 'status', ok: true, lines: statusLines('status', status.state, `LIVE_CONNECTION_${status.liveConnection}`) };
    }
    default: {
      const exhaustive: never = invocation.command;
      throw new DomainError('ARBITRARY_COMMAND_FORBIDDEN', `as1 cli command is not supported: ${String(exhaustive)}`);
    }
  }
}

function statusLines(command: string, state: string, reason: string): readonly string[] {
  return [`AS1_SLACK_PILOT ${command.toUpperCase()}`, `STATE: ${state}`, `REASON: ${reason}`];
}

/**
 * The separate-process observer signal path (design §11.1.3). It resolves ONLY the construction-bound owner lock,
 * signals the running owner through the sealed pidfd bridge (never a numeric-PID kill), and returns a stable
 * redacted outcome. A missing/absent owner or an ambiguous result stays failed closed.
 */
export async function runObserverSignal(operation: 'CLEAN_STOP' | 'INCIDENT_KILL'): Promise<As1CliResult> {
  const command: As1Command = operation === 'CLEAN_STOP' ? 'stop' : 'incident-kill';
  const result = await signalOwner(AS1_OWNER_LOCK_PATH, operation);
  const ok = result.ok;
  return {
    command,
    ok,
    lines: [`AS1_SLACK_PILOT ${command.toUpperCase()}`, `RESULT: ${result.outcome}`, `SHUTDOWN_DEADLINE_MS: ${String(AS1_OWNER_SHUTDOWN_DEADLINE_MS)}`],
  };
}

/**
 * Operator entry. `start`/`redacted-check` run the mutation-free capability probe FIRST (before any state-root
 * mutation) and require AS1_SLACK_STATE_ROOT; `stop`/`incident-kill` signal the owner through the sealed bridge;
 * `status`/`restart` never open Web/Socket/tmux. This never activates a pilot on its own — the descriptor stays
 * default-disabled until a separately authorized value-only activation.
 */
async function main(): Promise<void> {
  const invocation = parseAs1Cli(process.argv.slice(2));

  if (invocation.command === 'stop' || invocation.command === 'incident-kill') {
    const result = await runObserverSignal(invocation.command === 'stop' ? 'CLEAN_STOP' : 'INCIDENT_KILL');
    for (const line of result.lines) process.stdout.write(`${line}\n`);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (invocation.command === 'start' || invocation.command === 'redacted-check') {
    // Mutation-free capability gate BEFORE any state-root mutation (design §11.1.3).
    const capability = await probeCapability();
    if (!capability.ok) {
      process.stdout.write('AS1_SLACK_PILOT ERROR\nREASON: LIFECYCLE_CAPABILITY_UNAVAILABLE\n');
      process.exitCode = 2;
      return;
    }
  }

  const stateRoot = process.env.AS1_SLACK_STATE_ROOT;
  if ((invocation.command === 'start' || invocation.command === 'redacted-check') && (stateRoot === undefined || stateRoot.length === 0)) {
    process.stdout.write('AS1_SLACK_PILOT ERROR\nREASON: AS1_SLACK_STATE_ROOT_REQUIRED\n');
    process.exitCode = 2;
    return;
  }

  if (invocation.command === 'redacted-check') {
    const config = await parseSecretConfigFile(invocation.envFilePath ?? '');
    for (const line of config.renderRedactedCheck().split('\n')) process.stdout.write(`${line}\n`);
    process.exitCode = 0;
    return;
  }

  if (invocation.command === 'status' || invocation.command === 'restart') {
    // Read-only observer verbs against the construction-bound owner root; never open Web/Socket/tmux.
    process.stdout.write(`AS1_SLACK_PILOT ${invocation.command.toUpperCase()}\nREASON: ${invocation.command === 'restart' ? 'RESTART_LIVE_DISABLED' : 'LIVE_CONNECTION_OBSERVER'}\n`);
    process.exitCode = invocation.command === 'restart' ? 1 : 0;
    return;
  }

  // `start`: the foreground owner. It leaves the committed descriptor default-disabled unless a separate
  // value-only activation set it enabled; only then does the live composition connect. The state root was
  // already required above for start; re-narrow it here explicitly rather than asserting non-null.
  if (stateRoot === undefined || stateRoot.length === 0) {
    process.stdout.write('AS1_SLACK_PILOT ERROR\nREASON: AS1_SLACK_STATE_ROOT_REQUIRED\n');
    process.exitCode = 2;
    return;
  }
  const resolvedRoot = stateRoot;
  const clock = createSystemRuntimeIdentity();
  await initializeStateRoot(resolvedRoot, { stateRootId: 'as1-slack-pilot', initializedAt: clock.now() });
  const descriptorPath = 'config/agent-office.as1-slack-pilot.disabled.json';
  const descriptor = parseRuntimeDescriptor(JSON.parse(await readFile(descriptorPath, 'utf8')));
  const composition = await As1GatewayComposition.open(descriptor, { stateRoot: resolvedRoot, clock });
  try {
    const result = await composition.start();
    for (const line of statusLines('start', result.state, result.reason)) process.stdout.write(`${line}\n`);
    process.exitCode = result.connected ? 0 : 1;
  } finally {
    await composition.close();
  }
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  void main();
}
