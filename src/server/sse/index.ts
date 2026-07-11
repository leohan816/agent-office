import type { ServerResponse } from 'node:http';

import { assertUuidV7 } from '../../domain/time/index.js';
import { HttpBoundaryError } from '../http/errors.js';
import { applySecurityHeaders } from '../security/headers.js';

export interface ProjectionNotification {
  readonly revision: number;
  readonly notificationIds: readonly string[];
}

interface SseClient {
  readonly sessionHandle: string;
  readonly response: ServerResponse;
  readonly validateSession: () => Promise<boolean>;
  readonly heartbeat: ReturnType<typeof setInterval>;
}

export interface OpenSseInput {
  readonly sessionHandle: string;
  readonly lastEventId?: string;
  readonly response: ServerResponse;
  readonly validateSession: () => Promise<boolean>;
  readonly heartbeatMs?: number;
}

export class ProjectionSseBroker {
  private readonly buffer: ProjectionNotification[] = [];
  private readonly clients = new Set<SseClient>();

  public constructor(
    private readonly bufferLimit = 100,
    private readonly perSessionLimit = 2,
  ) {
    if (!Number.isSafeInteger(bufferLimit) || bufferLimit < 1 || perSessionLimit !== 2) {
      throw new HttpBoundaryError('SSE_LIMIT_REACHED', 503, 'SSE limits are invalid');
    }
  }

  public publish(notification: ProjectionNotification): void {
    assertNotification(notification, this.buffer.at(-1));
    this.buffer.push({ ...notification, notificationIds: [...notification.notificationIds] });
    while (this.buffer.length > this.bufferLimit) this.buffer.shift();
    for (const client of this.clients) writeProjection(client.response, notification);
  }

  public open(input: OpenSseInput): void {
    const currentForSession = [...this.clients].filter(
      (client) => client.sessionHandle === input.sessionHandle,
    ).length;
    if (currentForSession >= this.perSessionLimit) {
      throw new HttpBoundaryError('SSE_LIMIT_REACHED', 429, 'SSE session connection limit reached', 60);
    }
    const cursor = parseCursor(input.lastEventId);
    input.response.statusCode = 200;
    applySecurityHeaders(input.response, 'NO_STORE');
    input.response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    input.response.setHeader('Connection', 'keep-alive');
    input.response.setHeader('X-Accel-Buffering', 'no');
    input.response.flushHeaders();

    const first = this.buffer.at(0)?.revision;
    const latest = this.buffer.at(-1)?.revision ?? 0;
    if (cursor !== undefined && (cursor > latest || (first !== undefined && cursor < first - 1))) {
      writeEvent(input.response, 'reset_required', undefined, { latestRevision: latest });
    } else {
      for (const notification of this.buffer) {
        if (cursor === undefined || notification.revision > cursor) {
          writeProjection(input.response, notification);
        }
      }
    }

    const clientReference: { value?: SseClient } = {};
    const heartbeat = setInterval(() => {
      void input.validateSession().then((valid) => {
        const activeClient = clientReference.value;
        if (activeClient === undefined || !this.clients.has(activeClient)) return;
        if (!valid) {
          writeEvent(input.response, 'session_revoked', undefined, { reason: 'SESSION_REVOKED' });
          input.response.end();
          this.removeResponse(input.response);
          return;
        }
        input.response.write(': heartbeat\n\n');
      }).catch(() => {
        input.response.end();
        this.removeResponse(input.response);
      });
    }, input.heartbeatMs ?? 15_000);
    const client: SseClient = {
      sessionHandle: input.sessionHandle,
      response: input.response,
      validateSession: input.validateSession,
      heartbeat,
    };
    clientReference.value = client;
    this.clients.add(client);
    input.response.on('close', () => this.removeResponse(input.response));
  }

  public closeSession(sessionHandle: string): void {
    for (const client of [...this.clients]) {
      if (client.sessionHandle !== sessionHandle) continue;
      writeEvent(client.response, 'session_revoked', undefined, { reason: 'SESSION_REVOKED' });
      client.response.end();
      this.remove(client);
    }
  }

  public closeAll(): void {
    for (const client of [...this.clients]) {
      client.response.end();
      this.remove(client);
    }
  }

  public connectionCount(sessionHandle?: string): number {
    return sessionHandle === undefined
      ? this.clients.size
      : [...this.clients].filter((client) => client.sessionHandle === sessionHandle).length;
  }

  private remove(client: SseClient): void {
    if (!this.clients.delete(client)) return;
    clearInterval(client.heartbeat);
  }

  private removeResponse(response: ServerResponse): void {
    const client = [...this.clients].find((candidate) => candidate.response === response);
    if (client !== undefined) this.remove(client);
  }
}

function assertNotification(
  value: ProjectionNotification,
  previous: ProjectionNotification | undefined,
): void {
  if (
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1 ||
    (previous !== undefined && value.revision <= previous.revision) ||
    value.notificationIds.length > 100
  ) {
    throw new HttpBoundaryError('INVALID_ROUTE_SCHEMA', 400, 'SSE projection notification is invalid');
  }
  for (const notificationId of value.notificationIds) {
    assertUuidV7(notificationId, 'SSE notificationId');
  }
}

function parseCursor(value: string | undefined): number | undefined {
  if (value === undefined || value.length === 0) return undefined;
  if (!/^[1-9]\d{0,15}$/u.test(value)) {
    throw new HttpBoundaryError('INVALID_ROUTE_SCHEMA', 400, 'SSE cursor is invalid');
  }
  const cursor = Number(value);
  if (!Number.isSafeInteger(cursor)) {
    throw new HttpBoundaryError('INVALID_ROUTE_SCHEMA', 400, 'SSE cursor is invalid');
  }
  return cursor;
}

function writeProjection(response: ServerResponse, notification: ProjectionNotification): void {
  writeEvent(response, 'projection', notification.revision, {
    revision: notification.revision,
    notificationIds: notification.notificationIds,
  });
}

function writeEvent(
  response: ServerResponse,
  event: 'projection' | 'reset_required' | 'session_revoked',
  id: number | undefined,
  data: Readonly<Record<string, unknown>>,
): void {
  if (response.writableEnded || response.destroyed) return;
  if (id !== undefined) response.write(`id: ${id}\n`);
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}
