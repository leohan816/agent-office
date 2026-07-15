// AS1 Multi-Team Slack Pilot — closed lifecycle command parser and redacted CLI.
//
// Canonical design: docs/operations/AGENT_OFFICE_AS1_SLACK_SETUP.md §7 (planned lifecycle commands);
// docs/security/AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md §17 (logging/status). The only commands
// are start / stop / restart / status / redacted-check with exactly one `--env-file <path>`. There is no
// profile flag, and the CLI cannot select a profile or mint/complete a grant. `status` reports process/
// profile states and stable reason codes only — never configuration values, Slack payloads, or raw grant
// identity. `redacted-check` validates a disposable owner-only file without contacting Slack. Output never
// echoes a token, prefix, length, raw ID, file contents, or Slack response body.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { DomainError } from '../../contracts/types.js';
import { parseSecretConfigFile } from '../../adapters/gateways/slack-pilot/secret-config.js';
import { initializeStateRoot } from '../../persistence/file-store/path-safety.js';
import { createSystemRuntimeIdentity } from '../identity.js';
import { As1GatewayComposition, parseRuntimeDescriptor } from './composition.js';

export const AS1_COMMANDS = ['start', 'stop', 'restart', 'status', 'redacted-check'] as const;
export type As1Command = (typeof AS1_COMMANDS)[number];

export interface As1CliInvocation {
  readonly command: As1Command;
  readonly envFilePath: string;
}

/** Parse a closed argv. Rejects unknown commands, a missing/duplicate --env-file, and any extra token. */
export function parseAs1Cli(argv: readonly string[]): As1CliInvocation {
  const first = argv[0];
  if (first === undefined || !(AS1_COMMANDS as readonly string[]).includes(first)) {
    throw new DomainError('ARBITRARY_COMMAND_FORBIDDEN', 'as1 cli command is not one of the closed lifecycle commands');
  }
  const command = first as As1Command;
  let envFilePath: string | null = null;
  let index = 1;
  while (index < argv.length) {
    const token = argv[index];
    if (token === '--env-file') {
      const value = argv[index + 1];
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

/** Run a parsed command against the composed gateway. Never opens Slack/tmux in Phase A. */
export async function runAs1Cli(
  invocation: As1CliInvocation,
  composition: As1GatewayComposition,
): Promise<As1CliResult> {
  switch (invocation.command) {
    case 'redacted-check': {
      const config = await parseSecretConfigFile(invocation.envFilePath);
      return { command: 'redacted-check', ok: true, lines: config.renderRedactedCheck().split('\n') };
    }
    case 'start': {
      const result = composition.start();
      return { command: 'start', ok: false, lines: statusLines('start', result.state, result.reason) };
    }
    case 'stop': {
      const status = await composition.stop();
      return { command: 'stop', ok: true, lines: statusLines('stop', status.state, 'STOPPED_CLEAN') };
    }
    case 'restart': {
      // Restart never reuses a released lock: the composition stops then reopens/reacquires internally.
      const result = await composition.restart();
      return { command: 'restart', ok: false, lines: statusLines('restart', result.state, result.reason) };
    }
    case 'status': {
      const status = composition.status();
      return { command: 'status', ok: true, lines: statusLines('status', status.state, 'LIVE_CONNECTION_NOT_STARTED') };
    }
    default: {
      const exhaustive: never = invocation.command;
      throw new DomainError('ARBITRARY_COMMAND_FORBIDDEN', `as1 cli command is not supported: ${String(exhaustive)}`);
    }
  }
}

function statusLines(command: string, state: string, reason: string): readonly string[] {
  return [`AS1_SLACK_PILOT ${command.toUpperCase()}`, `STATE: ${state}`, `REASON: ${reason}`, 'LIVE_CONNECTION: NOT_STARTED'];
}

/** Operator entry. Reads the committed default-disabled descriptor; never connects to Slack or tmux. */
async function main(): Promise<void> {
  const invocation = parseAs1Cli(process.argv.slice(2));
  const stateRoot = process.env.AS1_SLACK_STATE_ROOT;
  if (stateRoot === undefined || stateRoot.length === 0) {
    process.stdout.write('AS1_SLACK_PILOT ERROR\nREASON: AS1_SLACK_STATE_ROOT_REQUIRED\nLIVE_CONNECTION: NOT_STARTED\n');
    process.exitCode = 2;
    return;
  }
  const descriptorPath = process.env.AS1_SLACK_DESCRIPTOR ?? 'config/agent-office.as1-slack-pilot.disabled.json';
  const clock = createSystemRuntimeIdentity();
  await initializeStateRoot(stateRoot, { stateRootId: 'as1-slack-pilot', initializedAt: clock.now() });
  const descriptor = parseRuntimeDescriptor(JSON.parse(await readFile(descriptorPath, 'utf8')));
  const composition = await As1GatewayComposition.open(descriptor, { stateRoot, clock });
  try {
    const result = await runAs1Cli(invocation, composition);
    for (const line of result.lines) process.stdout.write(`${line}\n`);
    process.exitCode = result.ok ? 0 : 1;
  } finally {
    // Always release the owned single-process lock so a one-shot command never leaves a stale lock behind.
    await composition.close();
  }
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  void main();
}
