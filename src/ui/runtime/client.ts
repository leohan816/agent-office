import type { AdvisorMessagePersistenceReceipt } from '../../application/advisor-inbox/types.js';
import type { SubmitAdvisorMessage } from '../../domain/messages/index.js';
import type {
  AuthenticatedProjectionSnapshot,
  LocalRuntimeStatus,
} from '../../server/application.js';
import type { BrowserCapability } from '../../server/auth/index.js';
import type { CommunicationCenterActionPort } from '../communication/types.js';

export type RuntimeClientPhase =
  | 'STARTING'
  | 'AUTH_BLOCKED'
  | 'PROJECTION_READY'
  | 'PROJECTION_UNAVAILABLE'
  | 'SESSION_EXPIRED';

export type RuntimeSseState = 'DISCONNECTED' | 'CONNECTING' | 'READY' | 'DEGRADED';

export interface RuntimeClientState {
  readonly phase: RuntimeClientPhase;
  readonly sseState: RuntimeSseState;
  readonly status?: LocalRuntimeStatus;
  readonly projection?: AuthenticatedProjectionSnapshot;
  readonly subject?: {
    readonly subjectId: string;
    readonly capabilities: readonly BrowserCapability[];
    readonly expiresAt: string;
  };
  readonly lastErrorCode?: string;
}

export interface RuntimeHttpTransport {
  fetch(input: string, init?: RequestInit): Promise<Response>;
}

export interface AgentOfficeRuntimeClientOptions {
  readonly origin?: string;
  readonly transport?: RuntimeHttpTransport;
  readonly reconnectDelayMs?: number;
  readonly now?: () => string;
  readonly nextRequestId?: () => string;
}

interface PrivateSessionContext {
  readonly subjectId: string;
  readonly capabilities: readonly BrowserCapability[];
  readonly csrfToken: string;
  readonly expiresAt: string;
}

const RUNTIME_BROWSER_CAPABILITIES: readonly BrowserCapability[] = [
  'viewer',
  'leo_input',
  'advisor_operator',
];

export class RuntimeClientError extends Error {
  public constructor(public readonly code: string) {
    super(code);
    this.name = 'RuntimeClientError';
  }
}

export class AgentOfficeRuntimeClient {
  private readonly listeners = new Set<(state: RuntimeClientState) => void>();
  private readonly transport: RuntimeHttpTransport;
  private readonly origin: string;
  private readonly reconnectDelayMs: number;
  private readonly now: () => string;
  private readonly nextRequestId: () => string;
  private state: RuntimeClientState = { phase: 'STARTING', sseState: 'DISCONNECTED' };
  private session: PrivateSessionContext | undefined;
  private stopped = true;
  private runId = 0;
  private sseAbort: AbortController | undefined;
  private cursor: number | undefined;

  public constructor(options: AgentOfficeRuntimeClientOptions = {}) {
    this.origin = options.origin ?? browserOrigin();
    if (!/^http:\/\/(?:127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/u.test(this.origin)) {
      throw new RuntimeClientError('NETWORK_BOUNDARY_REJECTED');
    }
    this.transport = options.transport ?? {
      fetch: (input, init) => globalThis.fetch(input, { ...init, credentials: 'same-origin' }),
    };
    this.reconnectDelayMs = options.reconnectDelayMs ?? 750;
    this.now = options.now ?? (() => new Date().toISOString());
    this.nextRequestId = options.nextRequestId ?? browserUuidV7;
  }

  public snapshot(): RuntimeClientState {
    return this.state;
  }

  public subscribe(listener: (state: RuntimeClientState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  public async start(): Promise<void> {
    this.stop();
    this.stopped = false;
    const runId = this.runId;
    this.update({ phase: 'STARTING', sseState: 'DISCONNECTED' });
    await this.refreshStatus(runId);
    if (!this.isCurrentRun(runId)) return;
    const authenticated = await this.refreshProjection(runId);
    if (authenticated && this.isCurrentRun(runId)) void this.sseLoop(runId);
  }

  public stop(): void {
    this.runId += 1;
    this.stopped = true;
    this.sseAbort?.abort();
    this.sseAbort = undefined;
    this.session = undefined;
    this.cursor = undefined;
  }

  public communicationActionPort(): CommunicationCenterActionPort | undefined {
    if (this.session?.capabilities.includes('leo_input') !== true) return undefined;
    return {
      submitAdvisorMessage: (command) => this.submitAdvisorMessage(command),
      applyAlertLifecycle: async (input) => {
        if (input.action !== 'ACKNOWLEDGE') throw new RuntimeClientError('CAPABILITY_REQUIRED');
        await this.acknowledgeAlert(input.alertId);
      },
      openEvidence: async (evidenceRef) => {
        const clipboard = browserClipboard();
        if (clipboard === undefined) {
          throw new RuntimeClientError('EVIDENCE_READ_UNAVAILABLE');
        }
        await clipboard.writeText(evidenceRef);
      },
    };
  }

  public async submitAdvisorMessage(
    command: SubmitAdvisorMessage,
  ): Promise<AdvisorMessagePersistenceReceipt> {
    const session = this.requireMutationSession('leo_input');
    const response = await this.transport.fetch(`${this.origin}/api/v1/advisor/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-AO-CSRF': session.csrfToken,
      },
      body: JSON.stringify(command),
    });
    const value = await readResponse(response);
    if (!response.ok) {
      this.handleMutationFailure(response.status, errorCode(value));
      throw new RuntimeClientError(errorCode(value));
    }
    const receipt = parsePersistenceReceipt(value);
    await this.refreshProjection();
    return receipt;
  }

  private async acknowledgeAlert(alertId: string): Promise<void> {
    const session = this.requireMutationSession('advisor_operator');
    const response = await this.transport.fetch(`${this.origin}/api/v1/alerts/${alertId}/ack`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-AO-CSRF': session.csrfToken,
      },
      body: JSON.stringify({
        requestId: this.nextRequestId(),
        recordedAt: this.now(),
        reasonCode: 'ADVISOR_ACKNOWLEDGED',
      }),
    });
    const value = await readResponse(response);
    if (!response.ok) {
      this.handleMutationFailure(response.status, errorCode(value));
      throw new RuntimeClientError(errorCode(value));
    }
    await this.refreshProjection();
  }

  private requireMutationSession(capability: BrowserCapability): PrivateSessionContext {
    const session = this.session;
    if (!session?.capabilities.includes(capability)) {
      throw new RuntimeClientError('CAPABILITY_REQUIRED');
    }
    return session;
  }

  private async refreshStatus(expectedRunId = this.runId): Promise<void> {
    try {
      const response = await this.transport.fetch(`${this.origin}/api/v1/status`);
      const value = await readResponse(response);
      if (!response.ok) throw new RuntimeClientError(errorCode(value));
      const status = parseRuntimeStatus(value);
      if (!this.isCurrentRun(expectedRunId)) return;
      this.update({ ...this.state, status });
    } catch (error) {
      if (!this.isCurrentRun(expectedRunId)) return;
      const code = error instanceof RuntimeClientError ? error.code : 'STATUS_UNAVAILABLE';
      this.update({
        ...this.state,
        phase: 'PROJECTION_UNAVAILABLE',
        sseState: 'DEGRADED',
        lastErrorCode: code,
      });
    }
  }

  private async refreshProjection(expectedRunId = this.runId): Promise<boolean> {
    try {
      const response = await this.transport.fetch(`${this.origin}/api/v1/projection`);
      const value = await readResponse(response);
      if (!this.isCurrentRun(expectedRunId)) return false;
      if (!response.ok) {
        const code = errorCode(value);
        this.clearSession(isSessionFailure(response.status, code) ? 'AUTH_BLOCKED' : 'PROJECTION_UNAVAILABLE', code);
        return false;
      }
      const projection = parseProjection(value);
      this.session = projection.session;
      this.cursor = projection.revision;
      this.update({
        phase: 'PROJECTION_READY',
        sseState: this.state.sseState === 'READY' ? 'READY' : 'CONNECTING',
        ...(this.state.status === undefined ? {} : { status: this.state.status }),
        projection,
        subject: {
          subjectId: projection.session.subjectId,
          capabilities: projection.session.capabilities,
          expiresAt: projection.session.expiresAt,
        },
      });
      return true;
    } catch (error) {
      if (!this.isCurrentRun(expectedRunId)) return false;
      const code = error instanceof RuntimeClientError ? error.code : 'PROJECTION_UNAVAILABLE';
      this.clearSession('PROJECTION_UNAVAILABLE', code);
      return false;
    }
  }

  private async sseLoop(runId: number): Promise<void> {
    while (this.isCurrentRun(runId) && this.session !== undefined) {
      try {
        await this.consumeSse(runId);
      } catch (error) {
        if (this.isSseStopped(runId)) return;
        this.update({
          ...this.state,
          sseState: 'DEGRADED',
          lastErrorCode: error instanceof RuntimeClientError ? error.code : 'SSE_UNAVAILABLE',
        });
      }
      if (this.isSseStopped(runId)) return;
      await wait(this.reconnectDelayMs);
      if (!await this.refreshProjection(runId)) return;
    }
  }

  private async consumeSse(runId: number): Promise<void> {
    const controller = new AbortController();
    this.sseAbort = controller;
    const headers: Record<string, string> = { Accept: 'text/event-stream' };
    if (this.cursor !== undefined && this.cursor > 0) headers['Last-Event-ID'] = String(this.cursor);
    const response = await this.transport.fetch(`${this.origin}/api/v1/events`, {
      headers,
      signal: controller.signal,
    });
    if (!this.isCurrentRun(runId)) return;
    if (!response.ok || response.body === null) {
      const value = await readResponse(response);
      const code = errorCode(value);
      if (isSessionFailure(response.status, code)) this.clearSession('SESSION_EXPIRED', code);
      throw new RuntimeClientError(code);
    }
    this.update({ ...this.state, sseState: 'READY' });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventName = '';
    let eventId = '';
    let data = '';
    const dispatch = async (): Promise<void> => {
      if (eventName === 'projection') {
        if (!/^[1-9]\d{0,15}$/u.test(eventId)) throw new RuntimeClientError('INVALID_SSE_EVENT');
        const eventData = parseSseData(data);
        if (eventData.revision !== Number(eventId)) throw new RuntimeClientError('INVALID_SSE_EVENT');
        this.cursor = Number(eventId);
        await this.refreshProjection(runId);
      } else if (eventName === 'reset_required') {
        parseSseData(data);
        this.cursor = undefined;
        await this.refreshProjection(runId);
      } else if (eventName === 'session_revoked') {
        parseSseData(data);
        this.clearSession('SESSION_EXPIRED', 'SESSION_REVOKED');
      }
      eventName = '';
      eventId = '';
      data = '';
    };
    while (this.isCurrentRun(runId) && this.session !== undefined) {
      const next = await reader.read();
      if (next.done) break;
      buffer += decoder.decode(next.value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/u, '');
        buffer = buffer.slice(newline + 1);
        if (line.length === 0) await dispatch();
        else if (line.startsWith('event: ')) eventName = line.slice(7);
        else if (line.startsWith('id: ')) eventId = line.slice(4);
        else if (line.startsWith('data: ')) data += line.slice(6);
        newline = buffer.indexOf('\n');
      }
      if (data.length > 8 * 1024) throw new RuntimeClientError('INVALID_SSE_EVENT');
    }
  }

  private handleMutationFailure(status: number, code: string): void {
    if (isSessionFailure(status, code)) this.clearSession('SESSION_EXPIRED', code);
  }

  private isSseStopped(runId: number): boolean {
    return !this.isCurrentRun(runId) || this.session === undefined;
  }

  private isCurrentRun(runId: number): boolean {
    return !this.stopped && this.runId === runId;
  }

  private clearSession(
    phase: Extract<RuntimeClientPhase, 'AUTH_BLOCKED' | 'PROJECTION_UNAVAILABLE' | 'SESSION_EXPIRED'>,
    code: string,
  ): void {
    this.session = undefined;
    this.sseAbort?.abort();
    this.sseAbort = undefined;
    this.update({
      phase,
      sseState: phase === 'AUTH_BLOCKED' ? 'DISCONNECTED' : 'DEGRADED',
      ...(this.state.status === undefined ? {} : { status: this.state.status }),
      lastErrorCode: code,
    });
  }

  private update(state: RuntimeClientState): void {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
}

function parseRuntimeStatus(value: unknown): LocalRuntimeStatus {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 'agent-office.local-runtime-status.v1' ||
    value.networkMode !== 'LOOPBACK_PRIVATE' ||
    typeof value.startupState !== 'string' ||
    typeof value.authMode !== 'string' ||
    typeof value.mutationMode !== 'string' ||
    typeof value.deliveryMode !== 'string' ||
    typeof value.sseMode !== 'string' ||
    !Number.isSafeInteger(value.projectionRevision) ||
    typeof value.lastVerifiedAt !== 'string'
  ) {
    throw new RuntimeClientError('INVALID_STATUS_RESPONSE');
  }
  return value as unknown as LocalRuntimeStatus;
}

function parseProjection(value: unknown): AuthenticatedProjectionSnapshot {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 'agent-office.redacted-projection.v1' ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 0 ||
    typeof value.missionId !== 'string' ||
    !Array.isArray(value.notificationIds) ||
    !Array.isArray(value.openAlertIds) ||
    !isRecord(value.session) ||
    value.session.schemaVersion !== 'agent-office.browser-session-context.v1' ||
    typeof value.session.subjectId !== 'string' ||
    !Array.isArray(value.session.capabilities) ||
    value.session.capabilities.some(
      (capability) =>
        typeof capability !== 'string' ||
        !RUNTIME_BROWSER_CAPABILITIES.includes(capability as BrowserCapability),
    ) ||
    typeof value.session.csrfToken !== 'string' ||
    !/^[A-Za-z0-9_-]{24,256}$/u.test(value.session.csrfToken) ||
    typeof value.session.expiresAt !== 'string' ||
    !isRecord(value.dashboard) ||
    value.dashboard.fixtureKind !== 'APPLICATION_PROJECTION' ||
    !isRecord(value.communication) ||
    value.communication.fixtureKind !== 'APPLICATION_PROJECTION'
  ) {
    throw new RuntimeClientError('INVALID_PROJECTION_RESPONSE');
  }
  return value as unknown as AuthenticatedProjectionSnapshot;
}

function parsePersistenceReceipt(value: unknown): AdvisorMessagePersistenceReceipt {
  if (
    !isRecord(value) ||
    value.status !== 'PERSISTED' ||
    typeof value.requestId !== 'string' ||
    typeof value.messageId !== 'string' ||
    typeof value.messageArtifactRef !== 'string' ||
    typeof value.messageArtifactHash !== 'string' ||
    typeof value.messagePayloadHash !== 'string' ||
    typeof value.persistedEventId !== 'string' ||
    !Number.isSafeInteger(value.persistedMissionSequence) ||
    typeof value.acceptedAt !== 'string' ||
    typeof value.replayed !== 'boolean'
  ) {
    throw new RuntimeClientError('INVALID_PERSISTENCE_RECEIPT');
  }
  return value as unknown as AdvisorMessagePersistenceReceipt;
}

async function readResponse(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown;
  } catch {
    return { code: 'INVALID_HTTP_RESPONSE' };
  }
}

function errorCode(value: unknown): string {
  return isRecord(value) && typeof value.code === 'string' ? value.code : 'APPLICATION_REJECTED';
}

function parseSseData(value: string): Record<string, unknown> {
  if (value.length === 0 || value.length > 8 * 1024) {
    throw new RuntimeClientError('INVALID_SSE_EVENT');
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed)) throw new RuntimeClientError('INVALID_SSE_EVENT');
    return parsed;
  } catch (error) {
    if (error instanceof RuntimeClientError) throw error;
    throw new RuntimeClientError('INVALID_SSE_EVENT');
  }
}

function isSessionFailure(status: number, code: string): boolean {
  return status === 401 ||
    status === 403 ||
    code === 'AUTH_PROVIDER_UNAVAILABLE' ||
    code === 'SESSION_INVALID_OR_EXPIRED' ||
    code === 'CAPABILITY_REQUIRED' ||
    code === 'CSRF_REJECTED';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function browserUuidV7(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  let timestamp = BigInt(Date.now());
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(timestamp & 0xffn);
    timestamp >>= 8n;
  }
  bytes[6] = 0x70 | ((bytes[6] ?? 0) & 0x0f);
  bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f);
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function browserOrigin(): string {
  const browserGlobal = globalThis as unknown as { readonly location?: { readonly origin?: string } };
  return browserGlobal.location?.origin ?? '';
}

function browserClipboard(): Clipboard | undefined {
  const browserGlobal = globalThis as unknown as {
    readonly navigator?: { readonly clipboard?: Clipboard };
  };
  return browserGlobal.navigator?.clipboard;
}
