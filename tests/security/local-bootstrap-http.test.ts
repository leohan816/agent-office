import { afterEach, describe, expect, it } from 'vitest';

import { assertRequestNetworkBoundary, assertSameOrigin } from '../../src/server/index.js';

import {
  LOCAL_BOOTSTRAP_TEST_PROOF,
  startBootstrapHttpServer,
  type BootstrapHttpServerFixture,
} from '../helpers/server-fixture.js';

const SECOND_PROOF = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const fixtures: BootstrapHttpServerFixture[] = [];
const controllers: AbortController[] = [];

afterEach(async () => {
  for (const controller of controllers.splice(0)) controller.abort();
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.server.close()));
});

describe('loopback LocalBootstrap HTTP and session lifecycle', () => {
  it('exchanges a bounded JSON proof into a host-only cookie without response, URL, or audit disclosure', async () => {
    const fixture = await startFixture();
    const response = await exchange(fixture, LOCAL_BOOTSTRAP_TEST_PROOF);
    expect(response.status).toBe(200);
    const bodyText = await response.text();
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(bodyText).toContain('AUTHENTICATED');
    expect(bodyText).not.toContain(LOCAL_BOOTSTRAP_TEST_PROOF);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).not.toMatch(/Domain=|Secure/u);
    expect(setCookie).not.toContain(LOCAL_BOOTSTRAP_TEST_PROOF);
    expect(JSON.stringify(fixture.audit.readAll())).not.toContain(LOCAL_BOOTSTRAP_TEST_PROOF);
    expect(fixture.audit.readAll().at(-1)).toMatchObject({
      route: '/api/v1/auth/local-bootstrap/exchange',
      outcomeCode: 'AUTHENTICATED',
    });

    const cookie = cookieHeader(setCookie);
    const projection = await fetch(`${fixture.server.origin}/api/v1/projection`, {
      headers: { Cookie: cookie },
    });
    expect(projection.status).toBe(200);
    expect(await projection.json()).toMatchObject({
      session: { capabilities: ['viewer', 'leo_input'] },
    });
  });

  it('enforces exact Host, Origin, Fetch Metadata, content type, body, route, and rate controls', async () => {
    const fixture = await startFixture();
    const base = bootstrapHeaders(fixture.server.origin);
    const cases = [
      { headers: omit(base, 'Origin'), code: 'ORIGIN_REJECTED', status: 403 },
      {
        headers: { ...omit(base, 'Origin'), Referer: `${fixture.server.origin}/` },
        code: 'ORIGIN_REJECTED',
        status: 403,
      },
      { headers: { ...base, Origin: 'http://attacker.invalid' }, code: 'ORIGIN_REJECTED', status: 403 },
      { headers: { ...base, 'Sec-Fetch-Site': 'cross-site' }, code: 'FETCH_METADATA_REJECTED', status: 403 },
      { headers: { ...base, 'Content-Type': 'text/plain' }, code: 'CONTENT_TYPE_REJECTED', status: 415 },
    ] as const;
    for (const item of cases) {
      const response = await fetch(`${fixture.server.origin}/api/v1/auth/local-bootstrap/exchange`, {
        method: 'POST',
        headers: item.headers,
        body: JSON.stringify({ proof: LOCAL_BOOTSTRAP_TEST_PROOF }),
      });
      expect(response.status).toBe(item.status);
      expect(await errorCode(response)).toBe(item.code);
    }
    expect(() => assertRequestNetworkBoundary(fixture.server.networkPolicy, {
      peerAddress: '127.0.0.1',
      host: '127.0.0.1:9',
      headers: { host: '127.0.0.1:9' },
    })).toThrow(expect.objectContaining({ code: 'HOST_REJECTED' }));
    expect(() => assertSameOrigin(fixture.server.networkPolicy, {
      origin: fixture.server.origin,
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'navigate',
    }, { mutation: true })).toThrow(expect.objectContaining({ code: 'FETCH_METADATA_REJECTED' }));

    const query = await fetch(
      `${fixture.server.origin}/api/v1/auth/local-bootstrap/exchange?proof=${LOCAL_BOOTSTRAP_TEST_PROOF}`,
      { method: 'POST', headers: base, body: '{}' },
    );
    expect(query.status).toBe(400);
    expect(await errorCode(query)).toBe('INVALID_ROUTE_SCHEMA');
    expect((await fetch(`${fixture.server.origin}/api/v1/auth/local-bootstrap/exchange`)).status).toBe(405);

    const oversized = await fetch(`${fixture.server.origin}/api/v1/auth/local-bootstrap/exchange`, {
      method: 'POST',
      headers: base,
      body: JSON.stringify({ proof: 'A'.repeat(1100) }),
    });
    expect(oversized.status).toBe(413);
    expect(await errorCode(oversized)).toBe('BODY_TOO_LARGE');

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const invalid = String(attempt).padStart(43, 'C');
      const response = await exchange(fixture, invalid);
      expect(response.status).toBe(401);
    }
    const limited = await exchange(fixture, 'D'.repeat(43));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).not.toBeNull();
  });

  it('rotates an existing browser session on a second valid proof', async () => {
    const fixture = await startFixture([LOCAL_BOOTSTRAP_TEST_PROOF, SECOND_PROOF]);
    const first = await exchange(fixture, LOCAL_BOOTSTRAP_TEST_PROOF);
    const firstCookie = cookieHeader(first.headers.get('set-cookie') ?? '');
    const second = await exchange(fixture, SECOND_PROOF, firstCookie);
    const secondCookie = cookieHeader(second.headers.get('set-cookie') ?? '');
    expect(secondCookie).not.toBe(firstCookie);
    const oldProjection = await fetch(`${fixture.server.origin}/api/v1/projection`, {
      headers: { Cookie: firstCookie },
    });
    expect(oldProjection.status).toBe(401);
    const newProjection = await fetch(`${fixture.server.origin}/api/v1/projection`, {
      headers: { Cookie: secondCookie },
    });
    expect(newProjection.status).toBe(200);
  });

  it('logs out with CSRF, clears the cookie, closes SSE, and removes mutation access', async () => {
    const fixture = await startFixture();
    const login = await exchange(fixture, LOCAL_BOOTSTRAP_TEST_PROOF);
    const cookie = cookieHeader(login.headers.get('set-cookie') ?? '');
    const projection = await fetch(`${fixture.server.origin}/api/v1/projection`, {
      headers: { Cookie: cookie },
    });
    const projectionBody = await projection.json() as {
      readonly session: { readonly csrfToken: string };
    };
    const controller = new AbortController();
    controllers.push(controller);
    const stream = await fetch(`${fixture.server.origin}/api/v1/events`, {
      headers: { Cookie: cookie },
      signal: controller.signal,
    });
    expect(stream.status).toBe(200);

    const logout = await fetch(`${fixture.server.origin}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        ...bootstrapHeaders(fixture.server.origin),
        Cookie: cookie,
        'X-AO-CSRF': projectionBody.session.csrfToken,
      },
      body: '{}',
    });
    expect(logout.status).toBe(200);
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(await logout.json()).toMatchObject({ status: 'LOGGED_OUT' });
    expect(await readUntil(stream, 'session_revoked')).toContain('SESSION_REVOKED');
    expect(fixture.sse.connectionCount()).toBe(0);

    const afterLogout = await fetch(`${fixture.server.origin}/api/v1/projection`, {
      headers: { Cookie: cookie },
    });
    expect(afterLogout.status).toBe(401);
    expect(afterLogout.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('fails closed without a configured exchange and never accepts proof-like query input', async () => {
    const fixture = await startFixture();
    await fixture.server.close();
    fixtures.splice(fixtures.indexOf(fixture), 1);
    const { startAgentOfficeHttpServer, InMemorySecurityAuditSink } = await import('../../src/server/index.js');
    const server = await startAgentOfficeHttpServer({
      bindAddress: '127.0.0.1',
      application: fixture.application,
      sessions: fixture.sessions,
      audit: new InMemorySecurityAuditSink(),
      now: () => '2026-07-10T00:00:00.000Z',
      nextId: (() => {
        let sequence = 4000;
        return () => `018f0000-0000-7000-8000-${(sequence++).toString(16).padStart(12, '0')}`;
      })(),
    });
    fixtures.push({ ...fixture, server });
    const response = await exchange({ ...fixture, server }, LOCAL_BOOTSTRAP_TEST_PROOF);
    expect(response.status).toBe(503);
    expect(await errorCode(response)).toBe('AUTH_PROVIDER_UNAVAILABLE');
  });
});

async function startFixture(
  proofs: readonly string[] = [LOCAL_BOOTSTRAP_TEST_PROOF],
): Promise<BootstrapHttpServerFixture> {
  const fixture = await startBootstrapHttpServer(proofs);
  fixtures.push(fixture);
  return fixture;
}

function exchange(
  fixture: BootstrapHttpServerFixture,
  proof: string,
  cookie?: string,
): Promise<Response> {
  return fetch(`${fixture.server.origin}/api/v1/auth/local-bootstrap/exchange`, {
    method: 'POST',
    headers: {
      ...bootstrapHeaders(fixture.server.origin),
      ...(cookie === undefined ? {} : { Cookie: cookie }),
    },
    body: JSON.stringify({ proof }),
  });
}

function bootstrapHeaders(origin: string): Readonly<Record<string, string>> {
  return {
    Origin: origin,
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

function cookieHeader(setCookie: string): string {
  const value = setCookie.split(';')[0];
  if (!value?.startsWith('AO_SESSION=')) {
    throw new Error('session cookie is unavailable');
  }
  return value;
}

async function errorCode(response: Response): Promise<string> {
  const body = await response.json() as { readonly code?: unknown };
  return typeof body.code === 'string' ? body.code : 'MISSING';
}

function omit(
  source: Readonly<Record<string, string>>,
  key: string,
): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.entries(source).filter(([candidate]) => candidate !== key));
}

async function readUntil(response: Response, expected: string): Promise<string> {
  const reader = response.body?.getReader();
  if (reader === undefined) throw new Error('SSE body is unavailable');
  const decoder = new TextDecoder();
  let text = '';
  while (!text.includes(expected)) {
    const next = await Promise.race([
      reader.read(),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error(`SSE timeout: ${expected}`)), 1000);
      }),
    ]);
    if (next.done) break;
    text += decoder.decode(next.value, { stream: true });
  }
  return text;
}
