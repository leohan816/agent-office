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
import { lstat, readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { DomainError } from '../../contracts/types.js';
import { parseSecretConfigFile } from '../../adapters/gateways/slack-pilot/secret-config.js';
import { initializeStateRoot, isNodeError } from '../../persistence/file-store/path-safety.js';
import {
  AS1_FIXED_OWNER_LOCK_PATH,
  AS1_OWNER_SHUTDOWN_DEADLINE_MS,
  probeCapability,
  signalFixedOwner,
  type As1BridgeResult,
} from '../../persistence/file-store/writer-lock.js';
import {
  AS1_GOVERNANCE_REPO_ROOT,
  AS1_GOVERNANCE_UPSTREAM_REF,
  NodeAs1GitArtifactSource,
} from '../../adapters/gateways/slack-pilot/git-artifact-source.js';
import { NodeAs1WebClient } from '../../adapters/gateways/slack-pilot/web-client.js';
import { NodeAs1TmuxPort } from '../../adapters/gateways/slack-pilot/exact-transport.js';
import {
  As1RawSocketTransport,
  NodeAs1ConnectionsOpener,
  NodeAs1WebSocketFactory,
} from '../../adapters/gateways/slack-pilot/socket-client.js';
import {
  GitAs1DeliveryProvenanceGate,
  GitAs1ReceiveGrantProvenanceGate,
  NodeAs1AuthorityProvenanceVerifier,
} from '../../adapters/gateways/slack-pilot/authority-provenance.js';
import { NodeAs1GitProvenanceVerifier } from '../../adapters/gateways/slack-pilot/git-provenance.js';
import { createSystemRuntimeIdentity, type AgentOfficeRuntimeIdentity } from '../identity.js';
import {
  As1GatewayComposition,
  parseRuntimeDescriptor,
  type As1CompositionDependencies,
  type As1CompositionSocketPort,
  type As1RuntimeDescriptorV1,
  type As1SocketBindings,
} from './composition.js';

/** The exact fixed owner state root (design §5.1). The observer verbs resolve ONLY this construction-bound literal. */
export const AS1_OWNER_STATE_ROOT = '/home/leo/.local/state/agent-office/as1-slack-pilot';

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
 * The observer signal path's injectable seams (F05). Production defaults signal the FIXED owner lock and read the
 * fixed owner lock/control read-only; deterministic tests inject the SIGNAL_SENT + post-signal proof branches
 * without a live owner or any real signal.
 */
export interface As1ObserverSignalDeps {
  readonly signal: (operation: 'CLEAN_STOP' | 'INCIDENT_KILL') => Promise<As1BridgeResult>;
  readonly lockRemoved: () => Promise<boolean>;
  readonly durableKilled: () => Promise<boolean>;
  readonly nowMs: () => number;
  readonly delay: (ms: number) => Promise<void>;
}

const OBSERVER_POLL_INTERVAL_MS = 50;

/** Read-only: is the FIXED owner writer lock absent? An ambiguous stat is NOT proof of removal. */
async function defaultLockRemoved(): Promise<boolean> {
  try {
    await lstat(AS1_FIXED_OWNER_LOCK_PATH);
    return false;
  } catch (error) {
    return isNodeError(error, 'ENOENT');
  }
}

/** Read-only: is the fixed owner control durably globally killed (DISABLED_LATCHED / killEngaged)? */
async function defaultDurableKilled(): Promise<boolean> {
  try {
    const raw = await readFile(`${AS1_OWNER_STATE_ROOT}/indexes/as1-slack-pilot/global-control.json`, 'utf8');
    const control = JSON.parse(raw) as { readonly state?: unknown; readonly killEngaged?: unknown };
    return control.state === 'DISABLED_LATCHED' && control.killEngaged === true;
  } catch {
    return false;
  }
}

const OBSERVER_DEFAULTS: As1ObserverSignalDeps = {
  signal: (operation) => signalFixedOwner(operation),
  lockRemoved: defaultLockRemoved,
  durableKilled: defaultDurableKilled,
  nowMs: () => performance.now(),
  delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * The separate-process observer signal path (design §11.1.3, F05). It signals ONLY the fixed owner through the
 * sealed pidfd bridge (never a numeric-PID kill, no caller-selected lock path), then PROVES exact lock removal
 * within the fixed shutdown deadline; incident kill additionally proves the durable killed state before reporting
 * success. A missing/absent owner or any ambiguous result stays failed closed.
 */
export async function runObserverSignal(
  operation: 'CLEAN_STOP' | 'INCIDENT_KILL',
  overrides: Partial<As1ObserverSignalDeps> = {},
): Promise<As1CliResult> {
  const deps: As1ObserverSignalDeps = { ...OBSERVER_DEFAULTS, ...overrides };
  const command: As1Command = operation === 'CLEAN_STOP' ? 'stop' : 'incident-kill';
  const line = (ok: boolean, outcome: string): As1CliResult => ({
    command,
    ok,
    lines: [`AS1_SLACK_PILOT ${command.toUpperCase()}`, `RESULT: ${outcome}`, `SHUTDOWN_DEADLINE_MS: ${String(AS1_OWNER_SHUTDOWN_DEADLINE_MS)}`],
  });

  const result = await deps.signal(operation);
  if (result.outcome !== 'SIGNAL_SENT') {
    // No live owner / ambiguous derivation → a stable redacted mapping; never a post-signal success.
    if (result.outcome === 'OWNER_EXITED') return line(false, 'NO_LIVE_OWNER');
    return line(false, 'STALE_OR_AMBIGUOUS_OWNER');
  }

  // Post-signal proof: poll for EXACT lock removal within the fixed shutdown deadline (F05).
  const start = deps.nowMs();
  let removed = false;
  do {
    if (await deps.lockRemoved()) {
      removed = true;
      break;
    }
    await deps.delay(OBSERVER_POLL_INTERVAL_MS);
  } while (deps.nowMs() - start <= AS1_OWNER_SHUTDOWN_DEADLINE_MS);

  if (operation === 'CLEAN_STOP') {
    return removed ? line(true, 'STOPPED_CLEAN') : line(false, 'STOP_TIMEOUT');
  }
  if (!removed) return line(false, 'INCIDENT_KILL_TIMEOUT');
  // Incident kill additionally proves the durable killed state before reporting success.
  return (await deps.durableKilled()) ? line(true, 'INCIDENT_KILL_ENGAGED') : line(false, 'STALE_OR_AMBIGUOUS_OWNER');
}

/** The fixed installed-module descriptor path (design §5.1/§11.1.3, F02): resolved relative to THIS module so it is
 *  independent of the current working directory. In the built artifact (dist/core) the repository config/ directory
 *  is four levels above this module; the operator never passes a descriptor path. */
export const AS1_INSTALLED_DESCRIPTOR_PATH = fileURLToPath(
  new URL('../../../../config/agent-office.as1-slack-pilot.disabled.json', import.meta.url),
);

/**
 * The COMPLETE production dependency graph (F01). It constructs the real read-only Git artifact source, Slack Web
 * client, tmux observation port, raw Socket transport factory, and the real Git provenance gate FACTORIES + evidence
 * verifier — all bound to the fixed governance repository/upstream, never a Slack/CLI/env value. The provenance gates
 * are FACTORIES because a gate's construction-bound artifact location and frozen authority snapshot are known only
 * after the composition's own trusted Git observation of the grant: the artifact location commit is the observed
 * first-add commit, and the frozen authority snapshot is the grant's OWN declared `authoritySourceCommit` (the exact
 * authority basis the evidence verifier also descends from). Nothing here connects, signals, or mutates; while the
 * committed descriptor stays default-disabled, `start()` returns before any gate/Web/Socket/tmux call runs.
 */
export function buildAs1ProductionDependencies(): As1CompositionDependencies {
  const gitSource = new NodeAs1GitArtifactSource();
  const repositoryId = gitSource.getRepositoryId();
  const authorityVerifier = new NodeAs1AuthorityProvenanceVerifier(AS1_GOVERNANCE_REPO_ROOT, repositoryId, AS1_GOVERNANCE_UPSTREAM_REF);
  return {
    gitSource,
    web: new NodeAs1WebClient(),
    tmuxPort: new NodeAs1TmuxPort(),
    buildSocket: (bindings: As1SocketBindings): As1CompositionSocketPort =>
      new As1RawSocketTransport(
        new NodeAs1ConnectionsOpener(),
        new NodeAs1WebSocketFactory(),
        undefined,
        undefined,
        bindings.latch,
        bindings.control,
      ),
    buildReceiveGrantProvenance: ({ receiveGrantRef, accepted, grant }) =>
      new GitAs1ReceiveGrantProvenanceGate(
        authorityVerifier,
        () => ({ path: receiveGrantRef, sourceCommit: accepted.firstAddCommit }),
        [grant.authoritySourceCommit],
      ),
    buildDeliveryProvenance: ({ deliveryGrantPath, accepted, grant }) =>
      new GitAs1DeliveryProvenanceGate(
        authorityVerifier,
        () => ({ path: deliveryGrantPath, sourceCommit: accepted.firstAddCommit }),
        [grant.authoritySourceCommit],
      ),
    evidenceVerifier: new NodeAs1GitProvenanceVerifier(AS1_GOVERNANCE_REPO_ROOT, repositoryId, AS1_GOVERNANCE_UPSTREAM_REF),
  };
}

/** The bounded terminal cause the foreground owner resolves on (F01). A clean signal drains; SIGUSR2 durably latches;
 *  expiry/divergence are the reviewed bounded terminals; NOT_CONNECTED is the default-disabled/not-ready release. */
export type As1OwnerStopCause = 'CLEAN_STOP' | 'INCIDENT_KILL' | 'GRANT_EXPIRED' | 'PROFILE_DIVERGED' | 'NOT_CONNECTED';

/**
 * The foreground-owner boundary (F01). Production fills every seam with the real graph, process signal registration,
 * the fixed root/descriptor, and the system clock; a deterministic test injects local fakes and asserts the owner
 * fails closed on a null/partial graph, a missing handler, an immediate owner return, or a loop that cannot reach a
 * reviewed terminal state — WITHOUT any real secret, network, tmux input, or process signal.
 */
export type As1OwnerSignal = 'SIGINT' | 'SIGTERM' | 'SIGUSR2';

export interface As1ForegroundOwnerBoundary {
  readonly descriptor: As1RuntimeDescriptorV1;
  readonly stateRoot: string;
  readonly clock: AgentOfficeRuntimeIdentity;
  readonly buildDeps: () => As1CompositionDependencies;
  readonly initialize: (stateRoot: string) => Promise<void>;
  /** Install the three owner handlers and RETURN the signals actually installed; the owner fails closed if any of
   *  the required three is absent (production returns all three; a test can drop one to prove the closure). */
  readonly installSignalHandlers: (handlers: Readonly<Record<As1OwnerSignal, () => void>>) => readonly As1OwnerSignal[];
  readonly delay: (ms: number) => Promise<void>;
}

const OWNER_LOOP_INTERVAL_MS = 250;
const REQUIRED_OWNER_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGUSR2'] as const;

/** Fail closed unless the production graph is COMPLETE (F01): a null/partial dependency graph never owns the lock.
 *  A test can pass a partial graph, so every field is probed defensively rather than trusting the declared type. */
function assertCompleteDependencies(deps: As1CompositionDependencies): void {
  const record = deps as unknown as Record<string, unknown>;
  const hasMethod = (value: unknown, method: string): boolean =>
    typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>)[method] === 'function';
  const complete =
    hasMethod(record.gitSource, 'observe') &&
    hasMethod(record.web, 'authTest') &&
    hasMethod(record.tmuxPort, 'observe') &&
    typeof record.buildSocket === 'function' &&
    typeof record.buildReceiveGrantProvenance === 'function' &&
    typeof record.buildDeliveryProvenance === 'function' &&
    hasMethod(record.evidenceVerifier, 'verify');
  if (!complete) {
    throw new DomainError('GATEWAY_DISABLED', 'the production dependency graph is incomplete; the owner fails closed');
  }
}

function ownerLine(ok: boolean, outcome: string, state: string): As1CliResult {
  return { command: 'start', ok, lines: ['AS1_SLACK_PILOT START', `STATE: ${state}`, `REASON: ${outcome}`] };
}

/**
 * The foreground owner (design §6/§11.1/§11.3, F01). It builds the COMPLETE production graph, opens the composition
 * in foreground-owner mode (retaining the writer lock for the whole process lifetime), installs the clean
 * SIGINT/SIGTERM and fixed SIGUSR2 handlers IMMEDIATELY after ownership and before any secret/network/poll, then
 * either releases cleanly (default-disabled/not-ready/latched) or drives ONLY the reviewed bounded receive-grant
 * re-observation + exclusive-expiry + delivery + evidence loop until a signal, divergence, or expiry terminal. It
 * adds no reconnect, profile rollover, generic scheduler, or framework, and opens no listener/socket/route.
 */
export async function runForegroundOwner(boundary: As1ForegroundOwnerBoundary): Promise<As1CliResult> {
  const deps = boundary.buildDeps();
  assertCompleteDependencies(deps);
  await boundary.initialize(boundary.stateRoot);
  const composition = await As1GatewayComposition.open(boundary.descriptor, {
    stateRoot: boundary.stateRoot,
    clock: boundary.clock,
    deps,
  });

  // Install ALL THREE owner signal handlers immediately after ownership, before any later side effect (design §11.1).
  // The requested cause is mutated only inside the handler closures; a typed getter reads it back so control-flow
  // analysis keeps the full union (a bare closure-mutated local would be seen as never-assigned).
  let requested: As1OwnerStopCause | null = null;
  const request = (cause: As1OwnerStopCause): void => {
    requested ??= cause;
  };
  const pollRequested = (): As1OwnerStopCause | null => requested;
  const installed = boundary.installSignalHandlers({
    SIGINT: () => request('CLEAN_STOP'),
    SIGTERM: () => request('CLEAN_STOP'),
    SIGUSR2: () => request('INCIDENT_KILL'),
  });
  for (const signal of REQUIRED_OWNER_SIGNALS) {
    if (!installed.includes(signal)) {
      await composition.close().catch(() => undefined);
      throw new DomainError('GATEWAY_DISABLED', 'the foreground owner did not install every required signal handler');
    }
  }

  try {
    const started = await composition.start();
    if (!started.connected) {
      // Default-disabled / not-ready / latched: the owner releases ownership cleanly and exits — never a live loop.
      const status = await composition.stop();
      return ownerLine(false, `NOT_CONNECTED:${started.reason}`, status.state);
    }
    // Bounded live loop: re-observe the accepted receive grant + exclusive expiry, drive delivery + evidence, and
    // stop ONLY on a signal, divergence, or expiry. It never renews, reconnects, or switches profile (design §6/§11).
    // A `for (;;)` with explicit break-on-terminal keeps the exit cause well-typed without an always-null condition.
    let terminal: As1OwnerStopCause;
    for (;;) {
      const pending = pollRequested();
      if (pending !== null) {
        terminal = pending;
        break;
      }
      const tick = await composition.observeReceiveGrantOnce();
      if (tick === 'DIVERGED') {
        terminal = 'PROFILE_DIVERGED';
        break;
      }
      if (tick === 'EXPIRED') {
        terminal = 'GRANT_EXPIRED';
        break;
      }
      await composition.deliverPending().catch(() => undefined);
      await composition.ingestEvidenceAndProject().catch(() => undefined);
      await boundary.delay(OWNER_LOOP_INTERVAL_MS);
    }
    if (terminal === 'INCIDENT_KILL') {
      const status = await composition.incidentKill();
      return ownerLine(false, 'INCIDENT_KILL_ENGAGED', status.state);
    }
    // CLEAN_STOP, GRANT_EXPIRED, or PROFILE_DIVERGED all drain to DISABLED_CLEAN and release the writer lock.
    const status = await composition.stop();
    return ownerLine(terminal === 'CLEAN_STOP', terminal === 'CLEAN_STOP' ? 'STOPPED_CLEAN' : terminal, status.state);
  } catch (error) {
    await composition.close().catch(() => undefined);
    throw error;
  }
}

/**
 * Operator entry. `start`/`redacted-check` run the mutation-free capability probe FIRST (before any state-root
 * mutation) and require the FIXED owner state root + the descriptor's exact secret path; `stop`/`incident-kill`
 * signal the owner through the sealed bridge; `status`/`restart` never open Web/Socket/tmux. This never activates a
 * pilot on its own — the descriptor stays default-disabled until a separately authorized value-only activation.
 */
async function main(): Promise<void> {
  const invocation = parseAs1Cli(process.argv.slice(2));

  if (invocation.command === 'stop' || invocation.command === 'incident-kill') {
    const result = await runObserverSignal(invocation.command === 'stop' ? 'CLEAN_STOP' : 'INCIDENT_KILL');
    for (const line of result.lines) process.stdout.write(`${line}\n`);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (invocation.command === 'status' || invocation.command === 'restart') {
    // Read-only observer verbs against the construction-bound owner root; never open Web/Socket/tmux.
    process.stdout.write(`AS1_SLACK_PILOT ${invocation.command.toUpperCase()}\nREASON: ${invocation.command === 'restart' ? 'RESTART_LIVE_DISABLED' : 'LIVE_CONNECTION_OBSERVER'}\n`);
    process.exitCode = invocation.command === 'restart' ? 1 : 0;
    return;
  }

  // `start` / `redacted-check`: the only two verbs that cross the owner filesystem/secret boundary.
  // Mutation-free capability gate BEFORE any state-root mutation (design §11.1.3).
  const capability = await probeCapability();
  if (!capability.ok) {
    process.stdout.write('AS1_SLACK_PILOT ERROR\nREASON: LIFECYCLE_CAPABILITY_UNAVAILABLE\n');
    process.exitCode = 2;
    return;
  }

  // F02: require the EXACT fixed owner state root — never an arbitrary second private root that could obtain its own
  // writer lock while the zero-operand observer verbs still target only the fixed root.
  const stateRoot = process.env.AS1_SLACK_STATE_ROOT;
  if (stateRoot !== AS1_OWNER_STATE_ROOT) {
    process.stdout.write('AS1_SLACK_PILOT ERROR\nREASON: AS1_SLACK_STATE_ROOT_REQUIRED\n');
    process.exitCode = 2;
    return;
  }

  // F02: resolve the descriptor from the FIXED installed-module path (independent of cwd), and require the exact
  // `--env-file` to EQUAL the descriptor's committed secret path — `start` and `redacted-check` must never validate
  // one file and use another.
  const descriptor = parseRuntimeDescriptor(JSON.parse(await readFile(AS1_INSTALLED_DESCRIPTOR_PATH, 'utf8')));
  if (invocation.envFilePath !== descriptor.secretFilePath) {
    process.stdout.write('AS1_SLACK_PILOT ERROR\nREASON: ENV_FILE_MUST_EQUAL_DESCRIPTOR_SECRET_PATH\n');
    process.exitCode = 2;
    return;
  }

  if (invocation.command === 'redacted-check') {
    const config = await parseSecretConfigFile(descriptor.secretFilePath);
    for (const line of config.renderRedactedCheck().split('\n')) process.stdout.write(`${line}\n`);
    process.exitCode = 0;
    return;
  }

  // `start`: the foreground owner. It retains the writer lock for the process lifetime, installs the three owner
  // signal handlers, and drives only the reviewed bounded loop. The committed descriptor stays default-disabled
  // unless a separately authorized value-only activation set it enabled; only then does the live composition connect.
  const clock = createSystemRuntimeIdentity();
  const result = await runForegroundOwner({
    descriptor,
    stateRoot,
    clock,
    buildDeps: () => buildAs1ProductionDependencies(),
    initialize: async (root: string): Promise<void> => {
      await initializeStateRoot(root, { stateRootId: 'as1-slack-pilot', initializedAt: clock.now() });
    },
    installSignalHandlers: (handlers): readonly As1OwnerSignal[] => {
      const installed: As1OwnerSignal[] = [];
      for (const signal of REQUIRED_OWNER_SIGNALS) {
        process.on(signal, handlers[signal]);
        installed.push(signal);
      }
      return installed;
    },
    delay: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
  });
  for (const line of result.lines) process.stdout.write(`${line}\n`);
  process.exitCode = result.ok ? 0 : 1;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  void main();
}
