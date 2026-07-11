import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { DomainError } from '../../contracts/types.js';
import { assertExactKeys, assertRecord, requireString } from '../../contracts/validation.js';
import { assertUtcTimestamp, assertUuidV7 } from '../../domain/time/index.js';
import { StoreError } from '../../persistence/file-store/errors.js';
import { hashCanonical } from '../../persistence/file-store/hashing.js';
import type {
  AgentOfficeHttpApplication,
  HttpCommandContext,
} from '../application.js';
import {
  type BrowserCapability,
  type BrowserSession,
  type BrowserSessionRegistry,
  type AuthenticationExchange,
  readSessionCookie,
  requireCapability,
  requireCsrf,
  serializeClearedSessionCookie,
  serializeSessionCookie,
} from '../auth/index.js';
import { HttpBoundaryError, type HttpErrorCode } from './errors.js';
import { isStaticShellPath, StaticShell } from './static-shell.js';
import {
  parseAcknowledgement,
  parseAdvisorMessage,
  parseAlertAcknowledgement,
  parseDecision,
  parseDeliveryDisable,
  parseIntake,
} from './schemas.js';
import {
  assertRequestNetworkBoundary,
  assertSameOrigin,
  type LoopbackBindAddress,
  type LoopbackNetworkPolicy,
  singleHeader,
} from '../network/policy.js';
import type { SecurityAuditInput, SecurityAuditSink } from '../security/audit.js';
import { applySecurityHeaders } from '../security/headers.js';
import {
  InMemoryRateLimiter,
  RATE_LIMIT_POLICIES,
  type RateLimitPolicy,
} from '../security/rate-limiter.js';
import { ProjectionSseBroker } from '../sse/index.js';

const MAX_MUTATION_BODY_BYTES = 32 * 1024;
const MAX_BOOTSTRAP_BODY_BYTES = 1024;
const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;

export interface AgentOfficeHttpServerOptions {
  readonly bindAddress: LoopbackBindAddress;
  readonly application: AgentOfficeHttpApplication;
  readonly sessions?: BrowserSessionRegistry;
  readonly bootstrapExchange?: AuthenticationExchange;
  readonly audit: SecurityAuditSink;
  readonly limiter?: InMemoryRateLimiter;
  readonly sse?: ProjectionSseBroker;
  readonly now: () => string;
  readonly nextId: () => string;
  readonly requestTimeoutMs?: number;
  readonly heartbeatMs?: number;
  readonly staticRoot?: string;
}

export interface RunningAgentOfficeHttpServer {
  readonly origin: string;
  readonly port: number;
  readonly networkPolicy: LoopbackNetworkPolicy;
  close(): Promise<void>;
}

interface RequestContext {
  readonly correlationId: string;
  readonly receivedAt: string;
  readonly route: string;
  readonly action: string;
  requestId?: string;
  payloadHash?: string;
  subjectRef?: string;
}

export async function startAgentOfficeHttpServer(
  options: AgentOfficeHttpServerOptions,
  port = 0,
): Promise<RunningAgentOfficeHttpServer> {
  const requestedBind: unknown = options.bindAddress;
  if (requestedBind !== '127.0.0.1' && requestedBind !== '::1') {
    throw new HttpBoundaryError('NETWORK_BOUNDARY_REJECTED', 503, 'server bind is not loopback');
  }
  const bindAddress: LoopbackBindAddress = requestedBind;
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
    throw new HttpBoundaryError('NETWORK_BOUNDARY_REJECTED', 503, 'server port is invalid');
  }
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 100 || requestTimeoutMs > 30_000) {
    throw new HttpBoundaryError('REQUEST_TIMEOUT', 503, 'request timeout is invalid');
  }
  const limiter = options.limiter ?? new InMemoryRateLimiter();
  const broker = options.sse ?? new ProjectionSseBroker();
  const staticShell = options.staticRoot === undefined
    ? undefined
    : await StaticShell.open(options.staticRoot);
  await options.audit.append({
    auditId: nextRuntimeId(options),
    route: '/startup',
    action: 'SERVER_STARTUP',
    outcomeCode: options.sessions === undefined
      ? 'LOOPBACK_PRIVATE_READ_ONLY'
      : 'LOOPBACK_PRIVATE_SESSION_BOUNDARY',
    recordedAt: runtimeNow(options),
  });
  const policyReference: { value?: LoopbackNetworkPolicy } = {};
  const server = createServer((request, response) => {
    const activePolicy = policyReference.value;
    if (activePolicy === undefined) {
      response.statusCode = 503;
      response.end();
      return;
    }
    void handleRequest(
      request,
      response,
      activePolicy,
      options,
      limiter,
      broker,
      staticShell,
    ).catch(() => {
      if (!response.headersSent) {
        applySecurityHeaders(response, 'NO_STORE');
        response.statusCode = 500;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(JSON.stringify({
          schemaVersion: 'agent-office.http-error.v1',
          code: 'APPLICATION_REJECTED',
          correlationId: 'UNAVAILABLE',
        }));
      } else if (!response.writableEnded) {
        response.end();
      }
    });
  });
  server.maxHeadersCount = 64;
  server.headersTimeout = requestTimeoutMs;
  server.requestTimeout = requestTimeoutMs;
  server.keepAliveTimeout = 2_000;
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => reject(error);
    server.once('error', onError);
    server.listen(port, bindAddress, () => {
      server.off('error', onError);
      resolve();
    });
  });
  const address = server.address() as AddressInfo | null;
  if (address === null) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new HttpBoundaryError('NETWORK_BOUNDARY_REJECTED', 503, 'server address is unavailable');
  }
  const host = bindAddress === '::1' ? `[::1]:${address.port}` : `127.0.0.1:${address.port}`;
  const policy: LoopbackNetworkPolicy = {
    mode: 'LOOPBACK_PRIVATE',
    bindAddress,
    allowedHosts: [host],
    origin: `http://${host}`,
  };
  policyReference.value = policy;
  const removeRevocationListener = options.sessions?.onRevoked((sessionHandle) => {
    broker.closeSession(sessionHandle);
  });
  return {
    origin: policy.origin,
    port: address.port,
    networkPolicy: policy,
    close: async () => {
      removeRevocationListener?.();
      broker.closeAll();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) resolve();
          else reject(error);
        });
      });
    },
  };
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  policy: LoopbackNetworkPolicy,
  options: AgentOfficeHttpServerOptions,
  limiter: InMemoryRateLimiter,
  broker: ProjectionSseBroker,
  staticShell: StaticShell | undefined,
): Promise<void> {
  const correlationId = nextRuntimeId(options);
  const receivedAt = runtimeNow(options);
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(request.url ?? '/', policy.origin);
  } catch {
    parsedUrl = new URL('/', policy.origin);
  }
  const context: RequestContext = {
    correlationId,
    receivedAt,
    route: parsedUrl.pathname,
    action: `HTTP_${request.method ?? 'UNKNOWN'}`,
  };
  try {
    const peerAddress = request.socket.remoteAddress;
    const requestHost = singleHeader(request.headers.host);
    assertRequestNetworkBoundary(policy, {
      ...(peerAddress === undefined ? {} : { peerAddress }),
      ...(requestHost === undefined ? {} : { host: requestHost }),
      headers: request.headers,
    });
    if (parsedUrl.search.length > 0 || parsedUrl.hash.length > 0) {
      throw new HttpBoundaryError('INVALID_ROUTE_SCHEMA', 400, 'query and fragment input is forbidden');
    }
    assertSameOrigin(policy, request.headers, { mutation: request.method === 'POST' });
    if (
      request.method === 'GET' &&
      staticShell !== undefined &&
      await staticShell.tryServe(parsedUrl.pathname, response)
    ) {
      return;
    }
    const route = resolveRoute(request.method, parsedUrl.pathname);
    if (route.kind === 'LIVENESS') {
      sendJson(response, 200, {
        schemaVersion: 'agent-office.liveness.v1',
        status: 'ALIVE',
        networkMode: 'LOOPBACK_PRIVATE',
      });
      return;
    }
    if (route.kind === 'STATUS') {
      requireRateLimit(
        limiter,
        request.socket.remoteAddress ?? 'UNKNOWN_LOOPBACK',
        RATE_LIMIT_POLICIES.read,
        receivedAt,
      );
      sendJson(response, 200, await options.application.readStatus());
      return;
    }
    if (route.kind === 'BOOTSTRAP_EXCHANGE') {
      if (singleHeader(request.headers.origin) !== policy.origin) {
        throw new HttpBoundaryError(
          'ORIGIN_REJECTED',
          403,
          'LocalBootstrap requires the exact loopback Origin',
        );
      }
      if (options.bootstrapExchange === undefined || options.sessions === undefined) {
        throw new HttpBoundaryError(
          'AUTH_PROVIDER_UNAVAILABLE',
          503,
          'LocalBootstrap authentication is unavailable',
        );
      }
      const body = await readJsonBody(
        request,
        options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
        MAX_BOOTSTRAP_BODY_BYTES,
      );
      const proof = parseBootstrapExchange(body);
      const peerAddress = request.socket.remoteAddress;
      if (peerAddress === undefined) {
        throw new HttpBoundaryError('NETWORK_BOUNDARY_REJECTED', 403, 'request peer is unavailable');
      }
      const session = await options.bootstrapExchange.exchange(
        peerAddress,
        proof,
        readSessionCookie(singleHeader(request.headers.cookie)),
      );
      context.subjectRef = session.subjectId;
      await appendAudit(options, context, 'AUTHENTICATED');
      response.setHeader('Set-Cookie', serializeSessionCookie(session, Date.parse(receivedAt)));
      sendJson(response, 200, {
        schemaVersion: 'agent-office.local-bootstrap-exchange.v1',
        status: 'AUTHENTICATED',
        expiresAt: session.expiresAt,
      });
      return;
    }
    if (route.kind === 'PROJECTION') {
      const session = await authorize(request, options.sessions, 'viewer', false);
      context.subjectRef = session.subjectId;
      requireRateLimit(limiter, session.subjectId, RATE_LIMIT_POLICIES.read, receivedAt);
      sendJson(response, 200, {
        ...await options.application.readProjection(),
        session: {
          schemaVersion: 'agent-office.browser-session-context.v1',
          subjectId: session.subjectId,
          capabilities: session.capabilities,
          csrfToken: session.csrfToken,
          expiresAt: session.expiresAt,
        },
      });
      return;
    }
    if (route.kind === 'SSE') {
      const session = await authorize(request, options.sessions, 'viewer', false);
      context.subjectRef = session.subjectId;
      requireRateLimit(limiter, session.cookieHandle, RATE_LIMIT_POLICIES.sseAttempt, receivedAt);
      await appendAudit(options, context, 'SSE_CONNECTED');
      const lastEventId = singleHeader(request.headers['last-event-id']);
      broker.open({
        sessionHandle: session.cookieHandle,
        ...(lastEventId === undefined ? {} : { lastEventId }),
        response,
        validateSession: async () => {
          try {
            await options.sessions?.authenticate(session.cookieHandle);
            return options.sessions !== undefined;
          } catch {
            return false;
          }
        },
        ...(options.heartbeatMs === undefined ? {} : { heartbeatMs: options.heartbeatMs }),
      });
      return;
    }

    if (route.kind === 'LOGOUT') {
      const session = await authorize(request, options.sessions, 'viewer', true);
      context.subjectRef = session.subjectId;
      requireRateLimit(limiter, session.subjectId, RATE_LIMIT_POLICIES.mutation, receivedAt);
      const body = await readJsonBody(
        request,
        options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
        MAX_BOOTSTRAP_BODY_BYTES,
      );
      parseEmptyObject(body, 'LocalBootstrapLogout');
      context.payloadHash = hashCanonical(body);
      await options.sessions?.revoke(session.cookieHandle);
      await appendAudit(options, context, 'LOGGED_OUT');
      response.setHeader('Set-Cookie', serializeClearedSessionCookie());
      sendJson(response, 200, {
        schemaVersion: 'agent-office.logout.v1',
        status: 'LOGGED_OUT',
      });
      return;
    }

    const session = await authorize(request, options.sessions, route.capability, true);
    context.subjectRef = session.subjectId;
    requireRateLimit(
      limiter,
      session.subjectId,
      route.kind === 'MESSAGE' ? RATE_LIMIT_POLICIES.advisorMessage : RATE_LIMIT_POLICIES.mutation,
      receivedAt,
    );
    const body = await readJsonBody(request, options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
    context.payloadHash = hashCanonical(body);
    const commandContext: HttpCommandContext = {
      subjectId: session.subjectId,
      correlationId,
      causationId: correlationId,
      receivedAt,
    };
    let result: unknown;
    switch (route.kind) {
      case 'MESSAGE': {
        const command = parseAdvisorMessage(body);
        context.requestId = command.requestId;
        result = await options.application.submitAdvisorMessage(command, commandContext);
        break;
      }
      case 'MESSAGE_ACK': {
        const command = parseAcknowledgement(body, route.messageId, commandContext);
        context.requestId = command.requestId;
        result = await options.application.recordAdvisorAcknowledgement(command);
        break;
      }
      case 'INTAKE': {
        const command = parseIntake(body, commandContext);
        context.requestId = command.requestId;
        result = await options.application.recordAdvisorIntake(command);
        break;
      }
      case 'DECISION': {
        const command = parseDecision(body, commandContext);
        context.requestId = command.requestId;
        result = await options.application.recordAdvisorDecision(command);
        break;
      }
      case 'ALERT_ACK': {
        const command = parseAlertAcknowledgement(body, route.alertId, commandContext);
        context.requestId = command.requestId;
        result = await options.application.acknowledgeAlert(command);
        break;
      }
      case 'DELIVERY_DISABLE': {
        const command = parseDeliveryDisable(body, commandContext);
        context.requestId = command.requestId;
        result = await options.application.disableDelivery(command);
        break;
      }
    }
    await appendAudit(options, context, 'ACCEPTED');
    sendJson(response, route.kind === 'MESSAGE' ? 201 : 200, result);
  } catch (error) {
    const failure = mapError(error);
    if (failure.code === 'SESSION_INVALID_OR_EXPIRED') {
      response.setHeader('Set-Cookie', serializeClearedSessionCookie());
    }
    try {
      await appendAudit(options, context, failure.code);
    } catch {
      sendError(response, correlationId, {
        code: 'APPLICATION_REJECTED',
        status: 503,
      });
      return;
    }
    sendError(response, correlationId, failure);
  }
}

type ResolvedRoute =
  | { readonly kind: 'LIVENESS' }
  | { readonly kind: 'STATUS' }
  | { readonly kind: 'BOOTSTRAP_EXCHANGE' }
  | { readonly kind: 'PROJECTION' }
  | { readonly kind: 'SSE' }
  | { readonly kind: 'LOGOUT' }
  | { readonly kind: 'MESSAGE'; readonly capability: 'leo_input' }
  | { readonly kind: 'MESSAGE_ACK'; readonly capability: 'advisor_operator'; readonly messageId: string }
  | { readonly kind: 'INTAKE' | 'DECISION' | 'DELIVERY_DISABLE'; readonly capability: 'advisor_operator' }
  | { readonly kind: 'ALERT_ACK'; readonly capability: 'advisor_operator'; readonly alertId: string };

function resolveRoute(method: string | undefined, pathname: string): ResolvedRoute {
  const expectedMethod = expectedMethodForPath(pathname);
  if (expectedMethod !== undefined && method !== expectedMethod) {
    throw new HttpBoundaryError('METHOD_NOT_ALLOWED', 405, 'method is not allowed');
  }
  if (method === 'GET') {
    if (pathname === '/health/live') return { kind: 'LIVENESS' };
    if (pathname === '/health/ready' || pathname === '/api/v1/status') return { kind: 'STATUS' };
    if (pathname === '/api/v1/projection') return { kind: 'PROJECTION' };
    if (pathname === '/api/v1/events') return { kind: 'SSE' };
  }
  if (method === 'POST') {
    if (pathname === '/api/v1/auth/local-bootstrap/exchange') {
      return { kind: 'BOOTSTRAP_EXCHANGE' };
    }
    if (pathname === '/api/v1/auth/logout') return { kind: 'LOGOUT' };
    if (pathname === '/api/v1/advisor/messages') return { kind: 'MESSAGE', capability: 'leo_input' };
    const acknowledgement = /^\/api\/v1\/advisor\/messages\/([0-9a-f-]{36})\/ack$/u.exec(pathname);
    if (acknowledgement?.[1] !== undefined) {
      return { kind: 'MESSAGE_ACK', capability: 'advisor_operator', messageId: acknowledgement[1] };
    }
    if (pathname === '/api/v1/advisor/intakes') return { kind: 'INTAKE', capability: 'advisor_operator' };
    if (pathname === '/api/v1/decisions') return { kind: 'DECISION', capability: 'advisor_operator' };
    const alert = /^\/api\/v1\/alerts\/([0-9a-f-]{36})\/ack$/u.exec(pathname);
    if (alert?.[1] !== undefined) {
      return { kind: 'ALERT_ACK', capability: 'advisor_operator', alertId: alert[1] };
    }
    if (pathname === '/api/v1/delivery/disable') {
      return { kind: 'DELIVERY_DISABLE', capability: 'advisor_operator' };
    }
  }
  throw new HttpBoundaryError('ROUTE_NOT_FOUND', 404, 'route does not exist');
}

function expectedMethodForPath(pathname: string): 'GET' | 'POST' | undefined {
  if (isStaticShellPath(pathname)) return 'GET';
  if (
    ['/health/live', '/health/ready', '/api/v1/status', '/api/v1/projection', '/api/v1/events'].includes(
      pathname,
    )
  ) {
    return 'GET';
  }
  if (
    [
      '/api/v1/advisor/messages',
      '/api/v1/auth/local-bootstrap/exchange',
      '/api/v1/auth/logout',
      '/api/v1/advisor/intakes',
      '/api/v1/decisions',
      '/api/v1/delivery/disable',
    ].includes(pathname) ||
    /^\/api\/v1\/advisor\/messages\/[0-9a-f-]{36}\/ack$/u.test(pathname) ||
    /^\/api\/v1\/alerts\/[0-9a-f-]{36}\/ack$/u.test(pathname)
  ) {
    return 'POST';
  }
  return undefined;
}

async function authorize(
  request: IncomingMessage,
  sessions: BrowserSessionRegistry | undefined,
  capability: BrowserCapability,
  mutation: boolean,
): Promise<BrowserSession> {
  if (sessions === undefined) {
    throw new HttpBoundaryError(
      'AUTH_PROVIDER_UNAVAILABLE',
      503,
      'no approved authentication provider is active',
    );
  }
  const cookie = readSessionCookie(singleHeader(request.headers.cookie));
  if (cookie === undefined) {
    throw new HttpBoundaryError('AUTHENTICATION_REQUIRED', 401, 'authentication is required');
  }
  const session = await sessions.authenticate(cookie);
  requireCapability(session, capability);
  if (mutation) requireCsrf(session, singleHeader(request.headers['x-ao-csrf']));
  return session;
}

async function readJsonBody(
  request: IncomingMessage,
  timeoutMs: number,
  maxBytes = MAX_MUTATION_BODY_BYTES,
): Promise<unknown> {
  const contentType = singleHeader(request.headers['content-type']);
  if (
    contentType === undefined ||
    !/^application\/json(?:;\s*charset=utf-8)?$/iu.test(contentType)
  ) {
    throw new HttpBoundaryError('CONTENT_TYPE_REJECTED', 415, 'JSON content type is required');
  }
  const declaredLength = singleHeader(request.headers['content-length']);
  if (declaredLength !== undefined) {
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length) || length < 0 || length > maxBytes) {
      throw new HttpBoundaryError('BODY_TOO_LARGE', 413, 'request body exceeds its bounded limit');
    }
  }
  const chunks: Buffer[] = [];
  let size = 0;
  const timer = setTimeout(() => {
    request.destroy(new HttpBoundaryError('REQUEST_TIMEOUT', 408, 'request processing timed out'));
  }, timeoutMs);
  try {
    for await (const chunk of request) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      size += bytes.byteLength;
      if (size > maxBytes) {
        throw new HttpBoundaryError('BODY_TOO_LARGE', 413, 'request body exceeds its bounded limit');
      }
      chunks.push(bytes);
    }
  } catch (error) {
    if (error instanceof HttpBoundaryError) throw error;
    throw new HttpBoundaryError('REQUEST_TIMEOUT', 408, 'request processing did not complete');
  } finally {
    clearTimeout(timer);
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  } catch {
    throw new HttpBoundaryError('INVALID_JSON', 400, 'request body is not valid UTF-8');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpBoundaryError('INVALID_JSON', 400, 'request body is not valid JSON');
  }
}

function parseBootstrapExchange(value: unknown): string {
  assertRecord(value, 'LocalBootstrapExchange');
  assertExactKeys(value, ['proof'], 'LocalBootstrapExchange');
  const proof = requireString(value.proof, 'proof', { maxLength: 64 });
  if (!/^[A-Za-z0-9_-]{43}$/u.test(proof)) {
    throw new DomainError('INVALID_SCHEMA', 'LocalBootstrap proof has an invalid shape');
  }
  return proof;
}

function parseEmptyObject(value: unknown, label: string): void {
  assertRecord(value, label);
  assertExactKeys(value, [], label);
}

function requireRateLimit(
  limiter: InMemoryRateLimiter,
  key: string,
  policy: RateLimitPolicy,
  now: string,
): void {
  limiter.require(key, policy, Date.parse(now));
}

async function appendAudit(
  options: AgentOfficeHttpServerOptions,
  context: RequestContext,
  outcomeCode: string,
): Promise<void> {
  const input: SecurityAuditInput = {
    auditId: nextRuntimeId(options),
    route: safeAuditRoute(context.route),
    action: context.action,
    outcomeCode: safeAuditCode(outcomeCode),
    recordedAt: runtimeNow(options),
    ...(context.subjectRef === undefined ? {} : { subjectRef: context.subjectRef }),
    ...(context.requestId === undefined ? {} : { requestId: context.requestId }),
    correlationId: context.correlationId,
    ...(context.payloadHash === undefined ? {} : { payloadHash: context.payloadHash }),
  };
  await options.audit.append(input);
}

function safeAuditRoute(route: string): string {
  return /^[A-Za-z0-9/_:.-]{1,192}$/u.test(route) ? route : '/INVALID_ROUTE';
}

function safeAuditCode(code: string): string {
  return /^[A-Z0-9][A-Z0-9._-]{0,127}$/u.test(code) ? code : 'APPLICATION_REJECTED';
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  applySecurityHeaders(response, 'NO_STORE');
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(value));
}

function sendError(
  response: ServerResponse,
  correlationId: string,
  failure: { readonly code: string; readonly status: number; readonly retryAfterSeconds?: number },
): void {
  if (response.headersSent) {
    if (!response.writableEnded) response.end();
    return;
  }
  applySecurityHeaders(response, 'NO_STORE');
  response.statusCode = failure.status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (failure.retryAfterSeconds !== undefined) {
    response.setHeader('Retry-After', String(failure.retryAfterSeconds));
  }
  response.end(JSON.stringify({
    schemaVersion: 'agent-office.http-error.v1',
    code: failure.code,
    correlationId,
  }));
}

function mapError(error: unknown): {
  readonly code: string;
  readonly status: number;
  readonly retryAfterSeconds?: number;
} {
  if (error instanceof HttpBoundaryError) {
    return {
      code: error.code,
      status: error.status,
      ...(error.retryAfterSeconds === undefined
        ? {}
        : { retryAfterSeconds: error.retryAfterSeconds }),
    };
  }
  if (error instanceof DomainError) {
    const status =
      error.code === 'IDEMPOTENCY_KEY_REUSED' ||
      error.code === 'STREAM_VERSION_CONFLICT' ||
      error.code === 'MANIFEST_VERSION_CONFLICT'
        ? 409
        : error.code === 'UNAUTHORIZED_ACTOR' || error.code === 'FORBIDDEN_TARGET'
          ? 403
          : error.code === 'MISSION_NOT_FOUND'
            ? 404
            : error.code === 'STORE_QUARANTINED'
              ? 503
              : 400;
    return { code: error.code, status };
  }
  if (error instanceof StoreError) {
    return { code: error.code, status: 503 };
  }
  return { code: 'APPLICATION_REJECTED', status: 500 };
}

function nextRuntimeId(options: AgentOfficeHttpServerOptions): string {
  const value = options.nextId();
  assertUuidV7(value, 'HTTP runtime ID');
  return value;
}

function runtimeNow(options: AgentOfficeHttpServerOptions): string {
  const value = options.now();
  assertUtcTimestamp(value, 'HTTP runtime time');
  return value;
}

export const CLOSED_HTTP_ROUTES = [
  'GET /',
  'GET /index.html',
  'GET /manifest.webmanifest',
  'GET /sw.js',
  'GET /icons/agent-office.svg',
  'GET /icons/agent-office-maskable.svg',
  'GET /assets/:content-hashed-static-file',
  'GET /health/live',
  'GET /health/ready',
  'GET /api/v1/status',
  'GET /api/v1/projection',
  'GET /api/v1/events',
  'POST /api/v1/auth/local-bootstrap/exchange',
  'POST /api/v1/auth/logout',
  'POST /api/v1/advisor/messages',
  'POST /api/v1/advisor/messages/:id/ack',
  'POST /api/v1/advisor/intakes',
  'POST /api/v1/decisions',
  'POST /api/v1/alerts/:id/ack',
  'POST /api/v1/delivery/disable',
] as const;

export type ClosedHttpRoute = (typeof CLOSED_HTTP_ROUTES)[number];
export type { HttpErrorCode };
