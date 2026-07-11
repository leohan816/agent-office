import { request } from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import {
  InMemorySecurityAuditSink,
  assertSameOrigin,
  startAgentOfficeHttpServer,
} from '../../src/server/index.js';
import {
  RecordingHttpApplication,
  advisorMessageBody,
  startTestHttpServer,
  type HttpServerFixture,
} from '../helpers/server-fixture.js';
import { FIXED_TIME, uuidV7 } from '../helpers/fixtures.js';

let fixture: HttpServerFixture | undefined;
const extraServers: { close(): Promise<void> }[] = [];

afterEach(async () => {
  await fixture?.server.close();
  fixture = undefined;
  await Promise.all(extraServers.splice(0).map((server) => server.close()));
});

describe('closed authenticated HTTP boundary', () => {
  it('serves only redacted local health without auth and protects projections', async () => {
    fixture = await startTestHttpServer();
    const liveness = await fetch(`${fixture.server.origin}/health/live`);
    expect(liveness.status).toBe(200);
    expect(await liveness.json()).toEqual({
      schemaVersion: 'agent-office.liveness.v1',
      status: 'ALIVE',
      networkMode: 'LOOPBACK_PRIVATE',
    });
    expectSecurityHeaders(liveness);
    const readiness = await fetch(`${fixture.server.origin}/health/ready`);
    expect(readiness.status).toBe(200);
    expect(await readiness.json()).toMatchObject({
      networkMode: 'LOOPBACK_PRIVATE',
      authMode: 'TEST_ONLY',
    });
    const projection = await fetch(`${fixture.server.origin}/api/v1/projection`);
    expect(projection.status).toBe(401);
    expect(await errorCode(projection)).toBe('AUTHENTICATION_REQUIRED');
  });

  it('fails mutations closed when no approved provider exists', async () => {
    let id = 1500;
    const server = await startAgentOfficeHttpServer({
      bindAddress: '127.0.0.1',
      application: new RecordingHttpApplication(),
      audit: new InMemorySecurityAuditSink(),
      now: () => FIXED_TIME,
      nextId: () => uuidV7(id++),
    });
    extraServers.push(server);
    const response = await fetch(`${server.origin}/api/v1/advisor/messages`, {
      method: 'POST',
      headers: {
        Origin: server.origin,
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Content-Type': 'application/json',
        'X-AO-CSRF': 'synthetic-csrf-value-not-used',
      },
      body: JSON.stringify(advisorMessageBody()),
    });
    expect(response.status).toBe(503);
    expect(await errorCode(response)).toBe('AUTH_PROVIDER_UNAVAILABLE');
  });

  it('returns exactly a persistence receipt for an authorized message POST', async () => {
    fixture = await startTestHttpServer();
    const command = advisorMessageBody();
    const response = await postMessage(fixture, command);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      requestId: command.requestId,
      status: 'PERSISTED',
      replayed: false,
    });
    expect(fixture.application.messages).toEqual([command]);
    const auditText = JSON.stringify(fixture.audit.readAll());
    expect(auditText).not.toContain(command.bodyText);
    expect(auditText).not.toContain(fixture.session.csrfToken);
    expect(auditText).not.toContain(fixture.session.cookieHandle);
    expect(auditText).toContain('ACCEPTED');
  });

  it('requires same-origin evidence, Fetch Metadata, CSRF, and JSON content type', async () => {
    fixture = await startTestHttpServer();
    const body = JSON.stringify(advisorMessageBody());
    const cases = [
      { headers: omit(fixture.mutationHeaders, 'Origin'), code: 'ORIGIN_REJECTED', status: 403 },
      {
        headers: { ...fixture.mutationHeaders, Origin: 'http://attacker.invalid' },
        code: 'ORIGIN_REJECTED',
        status: 403,
      },
      {
        headers: { ...fixture.mutationHeaders, 'Sec-Fetch-Site': 'cross-site' },
        code: 'FETCH_METADATA_REJECTED',
        status: 403,
      },
      {
        headers: omit(fixture.mutationHeaders, 'X-AO-CSRF'),
        code: 'CSRF_REJECTED',
        status: 403,
      },
      {
        headers: { ...fixture.mutationHeaders, 'Content-Type': 'text/plain' },
        code: 'CONTENT_TYPE_REJECTED',
        status: 415,
      },
    ] as const;
    const networkPolicy = fixture.server.networkPolicy;
    const origin = fixture.server.origin;
    expect(() => assertSameOrigin(networkPolicy, {
      origin,
      'sec-fetch-site': 'same-origin',
    }, { mutation: true })).toThrow(expect.objectContaining({ code: 'FETCH_METADATA_REJECTED' }));
    for (const item of cases) {
      const response = await fetch(`${fixture.server.origin}/api/v1/advisor/messages`, {
        method: 'POST',
        headers: item.headers,
        body,
      });
      expect(response.status).toBe(item.status);
      expect(await errorCode(response)).toBe(item.code);
    }
    expect(fixture.application.messages).toHaveLength(0);
  });

  it('has an exact route/schema allowlist with no target, role, command, or generic path', async () => {
    fixture = await startTestHttpServer();
    for (const path of [
      '/api/v1/command',
      '/api/v1/terminal',
      '/api/v1/workers/dispatch',
      '/api/v1/reviewers/dispatch',
      '/api/v1/advisor/messages/arbitrary/path',
    ]) {
      const response = await fetch(`${fixture.server.origin}${path}`, {
        method: 'POST',
        headers: fixture.mutationHeaders,
        body: '{}',
      });
      expect(response.status).toBe(404);
      expect(await errorCode(response)).toBe('ROUTE_NOT_FOUND');
    }
    for (const forbidden of ['target', 'role', 'command'] as const) {
      const response = await postMessage(fixture, {
        ...advisorMessageBody(1600 + forbidden.length),
        [forbidden]: forbidden === 'role' ? 'Reviewer' : 'send-keys -t *',
      });
      expect(response.status).toBe(400);
      expect(await errorCode(response)).toBe('UNKNOWN_FIELD');
    }
    expect(fixture.application.messages).toHaveLength(0);
  });

  it('bounds payload bytes, rejects controls, keeps hostile markup inert, and emits no CORS or HSTS', async () => {
    fixture = await startTestHttpServer();
    const oversized = await postMessage(fixture, {
      ...advisorMessageBody(1700),
      bodyText: 'x'.repeat(33 * 1024),
    });
    expect(oversized.status).toBe(413);
    expect(await errorCode(oversized)).toBe('BODY_TOO_LARGE');
    const controlled = await postMessage(fixture, {
      ...advisorMessageBody(1701),
      bodyText: 'synthetic\u0000control',
    });
    expect(controlled.status).toBe(400);
    expect(await errorCode(controlled)).toBe('INVALID_SCHEMA');
    const hostile = await postMessage(fixture, advisorMessageBody(1702));
    expect(hostile.status).toBe(201);
    expect(fixture.application.messages.at(-1)?.bodyText).toContain('<script>');
    expectSecurityHeaders(hostile);
    expect(hostile.headers.get('access-control-allow-origin')).toBeNull();
    expect(hostile.headers.get('strict-transport-security')).toBeNull();
    expect(hostile.headers.get('content-security-policy')).not.toContain("'unsafe-inline'");
    expect(hostile.headers.get('content-security-policy')).not.toContain("'unsafe-eval'");
  });

  it('rejects CORS preflight and aborts a stalled mutation within the configured timeout', async () => {
    fixture = await startTestHttpServer();
    const preflight = await fetch(`${fixture.server.origin}/api/v1/advisor/messages`, {
      method: 'OPTIONS',
      headers: { Origin: fixture.server.origin },
    });
    expect(preflight.status).toBe(405);
    expect(preflight.headers.get('access-control-allow-origin')).toBeNull();

    let id = 1800;
    const timeoutServer = await startAgentOfficeHttpServer({
      bindAddress: '127.0.0.1',
      application: fixture.application,
      sessions: fixture.sessions,
      audit: new InMemorySecurityAuditSink(),
      now: () => FIXED_TIME,
      nextId: () => uuidV7(id++),
      requestTimeoutMs: 100,
    });
    extraServers.push(timeoutServer);
    const startedAt = Date.now();
    expect(await stalledRequest(timeoutServer.port, fixture)).toMatch(/^(408|ABORTED)$/u);
    expect(Date.now() - startedAt).toBeLessThan(1500);
  });
});

async function postMessage(fixtureValue: HttpServerFixture, body: unknown): Promise<Response> {
  return fetch(`${fixtureValue.server.origin}/api/v1/advisor/messages`, {
    method: 'POST',
    headers: fixtureValue.mutationHeaders,
    body: JSON.stringify(body),
  });
}

async function errorCode(response: Response): Promise<string> {
  const body = await response.json() as { readonly code?: unknown };
  return typeof body.code === 'string' ? body.code : 'MISSING';
}

function expectSecurityHeaders(response: Response): void {
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response.headers.get('x-frame-options')).toBe('DENY');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  expect(response.headers.get('permissions-policy')).toContain('camera=()');
  expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
}

function omit(
  source: Readonly<Record<string, string>>,
  key: string,
): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.entries(source).filter(([candidate]) => candidate !== key));
}

function stalledRequest(port: number, fixtureValue: HttpServerFixture): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = request({
      host: '127.0.0.1',
      port,
      path: '/api/v1/advisor/messages',
      method: 'POST',
      headers: {
        ...fixtureValue.mutationHeaders,
        Host: `127.0.0.1:${port}`,
        Origin: `http://127.0.0.1:${port}`,
        'Content-Length': '100',
      },
    });
    client.on('response', (response) => {
      response.resume();
      response.on('end', () => {
        client.destroy();
        resolve(String(response.statusCode ?? 0));
      });
    });
    client.on('error', () => resolve('ABORTED'));
    client.on('timeout', () => reject(new Error('client timeout was not expected')));
    client.write('{');
  });
}
