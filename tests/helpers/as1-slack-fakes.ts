// AS1 Slack Pilot — synthetic Phase A fixtures and fake ports. Contains ONLY placeholder IDs/tokens.
// No real Slack workspace/App/channel/user ID or token appears here. No real network or tmux mutation is
// reachable through any fake (design §19; security §19). Every fake fails closed on an attempted real
// side effect.
import { chmod, mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { AgentOfficeRuntimeIdentity } from '../../src/runtime/identity.js';
import type {
  As1AuthTestResult,
  As1BotsInfoResult,
  As1PostMessageRequest,
  As1PostMessageResult,
  As1WebPort,
} from '../../src/adapters/gateways/slack-pilot/web-client.js';
import type {
  As1ConnectionsOpener,
  As1InboundEnvelope,
  As1SocketConnectInput,
  As1SocketConnectResult,
  As1SocketPort,
  As1WebSocketFactory,
  As1WsClientOptions,
  As1WsLike,
} from '../../src/adapters/gateways/slack-pilot/socket-client.js';
import type { As1ProfileRuntimeContext } from '../../src/application/slack-pilot/service.js';
import type { As1TmuxPort, As1TmuxPreflight } from '../../src/adapters/gateways/slack-pilot/exact-transport.js';
import type {
  As1EvidenceProvenance,
  As1EvidenceRef,
  As1GitProvenanceVerifier,
} from '../../src/application/slack-pilot/evidence-ingress.js';
import { selectProfile } from '../../src/application/slack-pilot/profiles.js';
import { uuidV7 } from './fixtures.js';

/** Deterministic, advanceable trusted-local clock + UUIDv7 generator for AS1 synthetic tests. */
export class FakeClock implements AgentOfficeRuntimeIdentity {
  private ms: number;
  private seq = 0;

  public constructor(startIso: string) {
    this.ms = Date.parse(startIso);
  }

  public now(): string {
    return new Date(this.ms).toISOString();
  }

  public nextId(): string {
    this.seq += 1;
    return uuidV7(this.seq);
  }

  public advanceMs(delta: number): void {
    this.ms += delta;
  }

  public setIso(iso: string): void {
    this.ms = Date.parse(iso);
  }
}

const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;
const HASH_C = `sha256:${'c'.repeat(64)}`;
const HASH_D = `sha256:${'d'.repeat(64)}`;
const HASH_E = `sha256:${'e'.repeat(64)}`;
const HASH_F = `sha256:${'f'.repeat(64)}`;
const HASH_1 = `sha256:${'1'.repeat(64)}`;
const HASH_2 = `sha256:${'2'.repeat(64)}`;
const HASH_3 = `sha256:${'3'.repeat(64)}`;
const HASH_4 = `sha256:${'4'.repeat(64)}`;

export const APPROVED_LEO_USER_ID = 'U0BD3523C1F';

/** A valid pre-event receive grant record for the Agent Office profile (plain object; mutate freely). */
export function validReceiveGrant(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 'agent-office.as1-pilot-receive-grant.v1',
    receiveGrantId: 'as1-receive-grant-0001',
    pilotId: 'as1-pilot-0001',
    profileId: 'AGENT_OFFICE_ADVISOR',
    workspaceId: 'TWORKSPACE001',
    appId: 'AAGENTOFFICE01',
    channelId: 'CAGENTOFFICE01',
    leoUserId: APPROVED_LEO_USER_ID,
    profileStateRootRef: 'indexes/as1-slack-pilot/profiles/agent-office-advisor',
    profileStateRootHash: HASH_A,
    rootLimit: 1,
    conversationLimit: 1,
    governanceSnapshotHash: HASH_B,
    registrySnapshotHash: HASH_C,
    ownerSetupGateHash: HASH_D,
    implementationReviewGateHash: HASH_E,
    globalControlSnapshotHash: HASH_F,
    profileLatchSnapshotHash: HASH_1,
    authorityRepositoryId: 'agent-office',
    authorityRootId: 'advisor-jobs-root',
    authoritySourceCommit: 'a'.repeat(40),
    issuedAt: '2026-07-14T22:00:00.000Z',
    expiresAt: '2026-07-14T22:10:00.000Z',
    ...overrides,
  };
}

/** A valid post-intake pointer-delivery grant for the Agent Office profile. */
export function validPointerDeliveryGrant(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 'agent-office.as1-pointer-delivery-grant.v1',
    pointerDeliveryGrantId: 'as1-pdg-0001',
    receiveGrantId: 'as1-receive-grant-0001',
    receiveGrantBindingHash: HASH_2,
    pilotId: 'as1-pilot-0001',
    profileId: 'AGENT_OFFICE_ADVISOR',
    intakeId: 'as1-intake-0001',
    sourceEventId: 'Ev0AGENTOFFICE01',
    rootCorrelationHash: HASH_3,
    pointerArtifactRef: 'artifacts/as1-slack-pilot/agent-office-advisor/pointers/p1/pointer.json',
    pointerHash: HASH_4,
    advisorTeam: 'AGENT_OFFICE_ADVISOR_TEAM',
    actorId: 'agent-office-advisor',
    roleInstanceId: 'foundation-advisor',
    evidencePrefix: 'advisor/jobs/20260714_as1/runtime-evidence/agent-office-advisor',
    governanceSnapshotHash: HASH_B,
    registrySnapshotHash: HASH_C,
    globalControlSnapshotHash: HASH_F,
    profileLatchSnapshotHash: HASH_1,
    authorityRepositoryId: 'agent-office',
    authorityRootId: 'advisor-jobs-root',
    authoritySourceCommit: 'b'.repeat(40),
    issuedAt: '2026-07-14T22:00:00.000Z',
    expiresAt: '2026-07-14T22:04:00.000Z',
    useLimit: 1,
    ...overrides,
  };
}

/** The ten synthetic secret key/value pairs. Placeholder tokens only — never a real bearer value. */
export function validSecretValues(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    SLACK_WORKSPACE_ID: 'TWORKSPACE001',
    SLACK_LEO_USER_ID: APPROVED_LEO_USER_ID,
    SLACK_AGENT_OFFICE_APP_ID: 'AAGENTOFFICE01',
    SLACK_AGENT_OFFICE_CHANNEL_ID: 'CAGENTOFFICE01',
    SLACK_AGENT_OFFICE_BOT_TOKEN: 'xoxb-agentoffice-placeholder-0001',
    SLACK_AGENT_OFFICE_APP_TOKEN: 'xapp-agentoffice-placeholder-0001',
    SLACK_FOUNDATION_APP_ID: 'AFOUNDATION001',
    SLACK_FOUNDATION_CHANNEL_ID: 'CFOUNDATION001',
    SLACK_FOUNDATION_BOT_TOKEN: 'xoxb-foundation-placeholder-00001',
    SLACK_FOUNDATION_APP_TOKEN: 'xapp-foundation-placeholder-00001',
    ...overrides,
  };
}

export function secretText(values: Record<string, string>): string {
  return `${Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\n`;
}

export interface SecretFileHandle {
  readonly dir: string;
  readonly filePath: string;
}

/** Write an owner-only synthetic secret file in a fresh temp dir. Modes are overridable for negatives. */
export async function writeSecretFile(
  content: string,
  options: { readonly dirMode?: number; readonly fileMode?: number; readonly fileName?: string } = {},
): Promise<SecretFileHandle> {
  const dir = await mkdtemp(path.join(tmpdir(), 'as1-slack-secret-'));
  const filePath = path.join(dir, options.fileName ?? 'as1-slack-pilot.env');
  await writeFile(filePath, content, { mode: options.fileMode ?? 0o600 });
  await chmod(filePath, options.fileMode ?? 0o600);
  await chmod(dir, options.dirMode ?? 0o700);
  return { dir, filePath };
}

/** Write raw bytes as an owner-only secret file (for UTF-8, BOM, NUL, and oversize negatives). */
export async function writeSecretBytes(bytes: Uint8Array): Promise<SecretFileHandle> {
  const dir = await mkdtemp(path.join(tmpdir(), 'as1-slack-secret-'));
  const filePath = path.join(dir, 'as1-slack-pilot.env');
  await writeFile(filePath, bytes, { mode: 0o600 });
  await chmod(filePath, 0o600);
  await chmod(dir, 0o700);
  return { dir, filePath };
}

/** Create a symlink alongside a real secret file and return the symlink path (no-follow negative). */
export async function writeSecretSymlink(content: string): Promise<{ dir: string; symlinkPath: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), 'as1-slack-secret-'));
  const realPath = path.join(dir, 'real.env');
  const symlinkPath = path.join(dir, 'as1-slack-pilot.env');
  await writeFile(realPath, content, { mode: 0o600 });
  await chmod(realPath, 0o600);
  await symlink(realPath, symlinkPath);
  await chmod(dir, 0o700);
  return { dir, symlinkPath };
}

/** A dir whose child is a nested owner-only dir, for parent-mode negatives. */
export async function makeTempDir(mode = 0o700): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'as1-slack-'));
  await chmod(dir, mode);
  return dir;
}

export async function makeNestedSecret(content: string, dirMode: number): Promise<SecretFileHandle> {
  const base = await mkdtemp(path.join(tmpdir(), 'as1-slack-'));
  const dir = path.join(base, 'agent-office');
  await mkdir(dir, { mode: dirMode });
  const filePath = path.join(dir, 'as1-slack-pilot.env');
  await writeFile(filePath, content, { mode: 0o600 });
  await chmod(filePath, 0o600);
  await chmod(dir, dirMode);
  return { dir, filePath };
}

// ── Fake Slack ports (no real network) ───────────────────────────────────────
export interface FakeBotIdentity {
  readonly teamId: string;
  readonly appId: string;
  readonly botId: string;
  readonly botUserId: string;
  readonly deleted?: boolean;
}

export interface PostedMessage {
  readonly botToken: string;
  readonly request: As1PostMessageRequest;
}

/** In-memory Web port. Faithfully maps each bot token to its true identity; swaps are made by the caller. */
export class FakeWebPort implements As1WebPort {
  public authTestCalls = 0;
  public readonly posted: PostedMessage[] = [];
  private readonly byBotToken = new Map<string, FakeBotIdentity>();
  private postResult: As1PostMessageResult | null = null;
  private postError: Error | null = null;
  private readonly postScript: ('ok' | 'malformed' | Error)[] = [];

  public register(botToken: string, identity: FakeBotIdentity): void {
    this.byBotToken.set(botToken, identity);
  }

  public setPostResult(result: As1PostMessageResult): void {
    this.postResult = result;
  }

  public setPostError(error: Error): void {
    this.postError = error;
  }

  /** Script a sequence of postMessage behaviors: 'ok', 'malformed', or a thrown Error. */
  public setPostScript(behaviors: readonly ('ok' | 'malformed' | Error)[]): void {
    this.postScript.push(...behaviors);
  }

  public authTest(botToken: string): Promise<As1AuthTestResult> {
    this.authTestCalls += 1;
    const identity = this.byBotToken.get(botToken);
    if (identity === undefined) {
      return Promise.resolve({ ok: false, teamId: '', userId: '', botId: '' });
    }
    return Promise.resolve({ ok: true, teamId: identity.teamId, userId: identity.botUserId, botId: identity.botId });
  }

  public botsInfo(botToken: string, botId: string): Promise<As1BotsInfoResult> {
    const identity = this.byBotToken.get(botToken);
    if (identity === undefined) {
      return Promise.resolve({ ok: false, appId: '', botId, userId: '', deleted: true });
    }
    return Promise.resolve({
      ok: true,
      appId: identity.appId,
      botId: identity.botId,
      userId: identity.botUserId,
      deleted: identity.deleted ?? false,
    });
  }

  public postMessage(botToken: string, request: As1PostMessageRequest): Promise<As1PostMessageResult> {
    this.posted.push({ botToken, request });
    const scripted = this.postScript.shift();
    if (scripted instanceof Error) return Promise.reject(scripted);
    if (scripted === 'malformed') return Promise.resolve({ ok: true, channel: 'CWRONGCHANNEL', ts: '' });
    if (this.postError !== null) return Promise.reject(this.postError);
    return Promise.resolve(this.postResult ?? { ok: true, channel: request.channel, ts: '1720000000.000999' });
  }
}

/**
 * In-memory Socket port modeling the reviewed pre-event boundary: connect proves the app token's hello
 * App-ID equals the expected App ID and synchronously revalidates the internally-derived readiness seal,
 * all BEFORE any event. A swapped app token (helloAppId != expectedAppId) or a stale seal fails connect.
 */
export class FakeSocketPort implements As1SocketPort {
  public connectCalls = 0;
  public disconnectCalls = 0;
  public lastSealOk: boolean | null = null;
  private readonly byAppToken = new Map<string, string>();
  private handler: ((envelope: As1InboundEnvelope) => Promise<void>) | null = null;

  public register(appToken: string, helloAppId: string): void {
    this.byAppToken.set(appToken, helloAppId);
  }

  public connect(input: As1SocketConnectInput): Promise<As1SocketConnectResult> {
    this.connectCalls += 1;
    const helloAppId = this.byAppToken.get(input.appToken);
    if (helloAppId === undefined || helloAppId !== input.expectedAppId) {
      return Promise.resolve({ ok: false });
    }
    const sealOk = input.readinessSeal();
    this.lastSealOk = sealOk;
    return Promise.resolve({ ok: sealOk });
  }

  public onEnvelope(handler: (envelope: As1InboundEnvelope) => Promise<void>): void {
    this.handler = handler;
  }

  public disconnect(): Promise<void> {
    this.disconnectCalls += 1;
    return Promise.resolve();
  }

  public async deliver(envelope: As1InboundEnvelope): Promise<void> {
    if (this.handler === null) throw new Error('no envelope handler registered');
    await this.handler(envelope);
  }
}

/** Public-`ws`-shaped fake socket. The test drives open/message/error/close via emit and inspects sends. */
export class FakeAs1Ws implements As1WsLike {
  public binaryType: 'nodebuffer' | 'arraybuffer' | 'fragments' = 'arraybuffer';
  public readyState = 1; // WebSocket.OPEN
  public bufferedAmount = 0;
  public readonly sent: string[] = [];
  public readonly closeCalls: { code: number; reason: string }[] = [];
  public terminateCalls = 0;
  public removeAllCalls = 0;
  private readonly listeners = new Map<string, ((...args: unknown[]) => void)[]>();

  public on(event: string, listener: (...args: unknown[]) => void): void {
    const existing = this.listeners.get(event) ?? [];
    existing.push(listener);
    this.listeners.set(event, existing);
  }

  public send(data: string): void {
    this.sent.push(data);
  }

  public close(code: number, reason: string): void {
    this.closeCalls.push({ code, reason });
  }

  public terminate(): void {
    this.terminateCalls += 1;
  }

  public removeAllListeners(): void {
    this.removeAllCalls += 1;
    this.listeners.clear();
  }

  public emit(event: string, ...args: unknown[]): void {
    for (const listener of [...(this.listeners.get(event) ?? [])]) listener(...args);
  }
}

/** Fake ws factory that captures the exact url/options passed (design §9.8 option spy). */
export class FakeAs1WebSocketFactory implements As1WebSocketFactory {
  public lastUrl: string | null = null;
  public lastOptions: As1WsClientOptions | null = null;
  public readonly created: FakeAs1Ws[] = [];
  private queued: FakeAs1Ws | null = null;

  public setNext(ws: FakeAs1Ws): void {
    this.queued = ws;
  }

  public create(url: string, options: As1WsClientOptions): As1WsLike {
    this.lastUrl = url;
    this.lastOptions = options;
    const ws = this.queued ?? new FakeAs1Ws();
    this.queued = null;
    this.created.push(ws);
    return ws;
  }
}

/** Fake bounded apps.connections.open opener: returns a configured wss URL or a configured error. */
export class FakeConnectionsOpener implements As1ConnectionsOpener {
  public calls = 0;
  public lastDeadlineMs = 0;
  private url = 'wss://wss.slack.com/link/?ticket=redacted';
  private error: Error | null = null;

  public setUrl(url: string): void {
    this.url = url;
  }

  public setError(error: Error): void {
    this.error = error;
  }

  public open(_appToken: string, deadlineMs: number): Promise<string> {
    this.calls += 1;
    this.lastDeadlineMs = deadlineMs;
    if (this.error !== null) return Promise.reject(this.error);
    return Promise.resolve(this.url);
  }
}

export interface FakeWireWorld {
  readonly workspaceId: string;
  readonly agentOffice: {
    readonly appId: string;
    readonly channelId: string;
    readonly leoUserId: string;
    readonly botToken: string;
    readonly appToken: string;
    readonly botId: string;
    readonly botUserId: string;
  };
  readonly foundation: {
    readonly appId: string;
    readonly channelId: string;
    readonly leoUserId: string;
    readonly botToken: string;
    readonly appToken: string;
    readonly botId: string;
    readonly botUserId: string;
  };
}

/** A synthetic two-profile Slack world with fully registered Web/Socket ports. */
export function fakeWireWorld(): {
  world: FakeWireWorld;
  web: FakeWebPort;
  socket: FakeSocketPort;
} {
  const world: FakeWireWorld = {
    workspaceId: 'TWORKSPACE001',
    agentOffice: {
      appId: 'AAGENTOFFICE01',
      channelId: 'CAGENTOFFICE01',
      leoUserId: APPROVED_LEO_USER_ID,
      botToken: 'xoxb-agentoffice-placeholder-0001',
      appToken: 'xapp-agentoffice-placeholder-0001',
      botId: 'BAGENTOFFICE01',
      botUserId: 'UAGENTOFFICEBOT1',
    },
    foundation: {
      appId: 'AFOUNDATION001',
      channelId: 'CFOUNDATION001',
      leoUserId: APPROVED_LEO_USER_ID,
      botToken: 'xoxb-foundation-placeholder-00001',
      appToken: 'xapp-foundation-placeholder-00001',
      botId: 'BFOUNDATION0001',
      botUserId: 'UFOUNDATIONBOT1',
    },
  };
  const web = new FakeWebPort();
  const socket = new FakeSocketPort();
  web.register(world.agentOffice.botToken, {
    teamId: world.workspaceId,
    appId: world.agentOffice.appId,
    botId: world.agentOffice.botId,
    botUserId: world.agentOffice.botUserId,
  });
  web.register(world.foundation.botToken, {
    teamId: world.workspaceId,
    appId: world.foundation.appId,
    botId: world.foundation.botId,
    botUserId: world.foundation.botUserId,
  });
  socket.register(world.agentOffice.appToken, world.agentOffice.appId);
  socket.register(world.foundation.appToken, world.foundation.appId);
  return { world, web, socket };
}

// ── Inbound envelope builder + runtime context ────────────────────────────────
export interface EnvelopeOptions {
  readonly envelopeId?: string;
  readonly eventId?: string;
  readonly teamId?: string;
  readonly apiAppId?: string;
  readonly channel?: string;
  readonly channelType?: string;
  readonly user?: string;
  readonly ts?: string;
  readonly text?: string;
  readonly threadTs?: string;
  readonly subtype?: string;
  readonly hidden?: boolean;
  readonly botId?: string;
  readonly isExtSharedChannel?: boolean;
  readonly onAck?: () => Promise<void>;
}

/** Build a synthetic Socket envelope. Defaults to a valid top-level Leo message for the Agent Office room. */
export function slackEnvelope(options: EnvelopeOptions = {}): As1InboundEnvelope {
  const event: Record<string, unknown> = {
    type: 'message',
    channel: options.channel ?? 'CAGENTOFFICE01',
    channel_type: options.channelType ?? 'group',
    user: options.user ?? APPROVED_LEO_USER_ID,
    ts: options.ts ?? '1720000000.000100',
    event_ts: options.ts ?? '1720000000.000100',
    text: options.text ?? 'please start a new mission',
  };
  if (options.threadTs !== undefined) event.thread_ts = options.threadTs;
  if (options.subtype !== undefined) event.subtype = options.subtype;
  if (options.hidden !== undefined) event.hidden = options.hidden;
  if (options.botId !== undefined) event.bot_id = options.botId;
  if (options.isExtSharedChannel !== undefined) event.is_ext_shared_channel = options.isExtSharedChannel;
  const payload: Record<string, unknown> = {
    type: 'event_callback',
    team_id: options.teamId ?? 'TWORKSPACE001',
    api_app_id: options.apiAppId ?? 'AAGENTOFFICE01',
    event_id: options.eventId ?? 'Ev0AGENTOFFICE01',
    event_time: 1_720_000_000,
    event,
  };
  return {
    envelopeId: options.envelopeId ?? 'Env0AGENTOFFICE1',
    payload,
    retryAttempt: null,
    retryReason: null,
    acknowledge: async (): Promise<void> => {
      if (options.onAck !== undefined) await options.onAck();
    },
  };
}

/** Runtime context for the Agent Office profile using the synthetic wire world identities. */
export function agentOfficeContext(): As1ProfileRuntimeContext {
  const world = fakeWireWorld().world;
  return {
    profile: selectProfile('AGENT_OFFICE_ADVISOR'),
    workspaceId: world.workspaceId,
    appId: world.agentOffice.appId,
    channelId: world.agentOffice.channelId,
    leoUserId: world.agentOffice.leoUserId,
    botUserId: world.agentOffice.botUserId,
  };
}

// ── Delivery authority fixtures + fake tmux port ──────────────────────────────
export function validDestination(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sessionName: 'agent-office-advisor',
    sessionId: '$26',
    windowName: 'main',
    windowId: '@26',
    windowIndex: 0,
    paneId: '%26',
    paneIndex: 0,
    panePid: 12_345,
    workspace: '/home/leo/Project/agent-office',
    currentCommand: 'codex',
    paneDead: false,
    paneInMode: false,
    inputOff: false,
    synchronizePanes: false,
    activityTime: '1720000000',
    ...overrides,
  };
}

export function validReadinessLease(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 'agent-office.as1-advisor-readiness-lease.v1',
    leaseId: 'as1-lease-0001',
    pointerDeliveryGrantId: 'as1-pdg-0001',
    receiveGrantId: 'as1-receive-grant-0001',
    pilotId: 'as1-pilot-0001',
    profileId: 'AGENT_OFFICE_ADVISOR',
    intakeId: 'as1-intake-0001',
    sourceEventId: 'Ev0AGENTOFFICE01',
    pointerHash: HASH_4,
    advisorTeam: 'AGENT_OFFICE_ADVISOR_TEAM',
    actorId: 'agent-office-advisor',
    roleInstanceId: 'foundation-advisor',
    destination: validDestination(),
    readiness: 'IDLE_FOR_ONE_AS1_POINTER',
    useLimit: 1,
    observedAt: '2026-07-14T22:03:00.000Z',
    issuedAt: '2026-07-14T22:03:00.000Z',
    expiresAt: '2026-07-14T22:03:25.000Z',
    authoritySnapshotHash: HASH_B,
    registrySnapshotHash: HASH_C,
    receiveGrantBindingHash: HASH_2,
    pointerDeliveryGrantSnapshotHash: HASH_A,
    ...overrides,
  };
}

/** In-memory tmux port. Never touches a real tmux server. Preflight results are scriptable. */
export class FakeTmuxPort implements As1TmuxPort {
  public preflightCalls = 0;
  public loadCalls = 0;
  public pasteCalls = 0;
  public enterCalls = 0;
  public deleteCalls = 0;
  private readonly preflightQueue: As1TmuxPreflight[] = [];
  private pasteThrows = false;
  private bufferPresent = false;
  private onLoadHook: (() => void) | null = null;
  private onPasteHook: (() => void) | null = null;

  public constructor(private readonly base: As1TmuxPreflight) {}

  public setPreflightSequence(results: readonly As1TmuxPreflight[]): void {
    this.preflightQueue.push(...results);
  }

  public setPasteThrows(): void {
    this.pasteThrows = true;
  }

  public setBufferPresent(): void {
    this.bufferPresent = true;
  }

  /** Fire a side effect the instant loadBuffer runs — used to advance a test clock at an exact boundary. */
  public onLoad(fn: () => void): void {
    this.onLoadHook = fn;
  }

  /** Fire a side effect the instant pasteBuffer runs — used to advance a test clock past the no-retry boundary. */
  public onPaste(fn: () => void): void {
    this.onPasteHook = fn;
  }

  public preflight(): Promise<As1TmuxPreflight> {
    this.preflightCalls += 1;
    return Promise.resolve(this.preflightQueue.shift() ?? this.base);
  }

  public bufferExists(): Promise<boolean> {
    return Promise.resolve(this.bufferPresent);
  }

  public loadBuffer(): Promise<void> {
    this.loadCalls += 1;
    if (this.onLoadHook !== null) this.onLoadHook();
    return Promise.resolve();
  }

  public pasteBuffer(): Promise<void> {
    this.pasteCalls += 1;
    if (this.onPasteHook !== null) this.onPasteHook();
    if (this.pasteThrows) return Promise.reject(new Error('tmux paste ambiguous'));
    return Promise.resolve();
  }

  public sendEnter(): Promise<void> {
    this.enterCalls += 1;
    return Promise.resolve();
  }

  public deleteBuffer(): Promise<void> {
    this.deleteCalls += 1;
    return Promise.resolve();
  }
}

/** A preflight matching validDestination(). */
export function matchingPreflight(overrides: Partial<As1TmuxPreflight> = {}): As1TmuxPreflight {
  return {
    sessionId: '$26',
    windowId: '@26',
    paneId: '%26',
    panePid: 12_345,
    workspace: '/home/leo/Project/agent-office',
    currentCommand: 'codex',
    paneDead: false,
    paneInMode: false,
    inputOff: false,
    synchronizePanes: false,
    ...overrides,
  };
}

// ── Advisor evidence fixtures + fake Git provenance verifier ──────────────────
const AO_LINEAGE = {
  profileId: 'AGENT_OFFICE_ADVISOR',
  advisorTeam: 'AGENT_OFFICE_ADVISOR_TEAM',
  actorId: 'agent-office-advisor',
  roleInstanceId: 'foundation-advisor',
};

export const AO_EVIDENCE_PREFIX = 'advisor/jobs/20260714_as1/runtime-evidence/agent-office-advisor';

export function validAdvisorAck(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 'agent-office.as1-advisor-ack.v1',
    evidenceId: 'ev-ack-0001',
    ...AO_LINEAGE,
    intakeId: 'as1-intake-0001',
    sourceEventId: 'Ev0AGENTOFFICE01',
    pointerHash: HASH_4,
    advisorAckId: 'ack-0001',
    acknowledgedAt: '2026-07-14T22:06:00.000Z',
    ...overrides,
  };
}

export function validAdvisorIntake(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 'agent-office.as1-advisor-intake.v1',
    evidenceId: 'ev-intake-0001',
    ...AO_LINEAGE,
    intakeId: 'as1-intake-0001',
    advisorAckId: 'ack-0001',
    classification: 'ACCEPTED_NEW_MISSION',
    recordedAt: '2026-07-14T22:06:10.000Z',
    ...overrides,
  };
}

export function validAdvisorQuestion(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 'agent-office.as1-advisor-outbound.v1',
    evidenceId: 'ev-question-0001',
    ...AO_LINEAGE,
    intakeId: 'as1-intake-0001',
    questionId: 'q-0001',
    expectedResponseKind: 'CLARIFICATION',
    recordedAt: '2026-07-14T22:06:20.000Z',
    ...overrides,
  };
}

export function validAdvisorResult(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 'agent-office.as1-advisor-result.v1',
    evidenceId: 'ev-result-0001',
    ...AO_LINEAGE,
    intakeId: 'as1-intake-0001',
    resultId: 'result-0001',
    terminalStatus: 'COMPLETED',
    resultArtifactRef: `${AO_EVIDENCE_PREFIX}/as1-intake-0001/result.json`,
    recordedAt: '2026-07-14T22:06:30.000Z',
    ...overrides,
  };
}

export function evidenceRef(fileName: string, overrides: Partial<As1EvidenceRef> = {}): As1EvidenceRef {
  return {
    repositoryId: 'agent-office',
    sourceCommit: 'c'.repeat(40),
    path: `${AO_EVIDENCE_PREFIX}/as1-intake-0001/${fileName}`,
    blobSha256: `sha256:${'5'.repeat(64)}`,
    ...overrides,
  };
}

/** In-memory Git provenance verifier. Never runs git; provenance is scriptable per test. */
export class FakeGitVerifier implements As1GitProvenanceVerifier {
  private provenance: As1EvidenceProvenance = {
    upstreamAncestral: true,
    firstAddition: true,
    dirty: false,
    byteStable: true,
  };

  public set(partial: Partial<As1EvidenceProvenance>): void {
    this.provenance = { ...this.provenance, ...partial };
  }

  public verify(): Promise<As1EvidenceProvenance> {
    return Promise.resolve(this.provenance);
  }
}
