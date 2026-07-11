import { afterEach, describe, expect, it } from 'vitest';

import { advisorMessageBody, startTestHttpServer, type HttpServerFixture } from '../helpers/server-fixture.js';
import { uuidV7 } from '../helpers/fixtures.js';

let fixture: HttpServerFixture | undefined;
const controllers: AbortController[] = [];

afterEach(async () => {
  for (const controller of controllers.splice(0)) controller.abort();
  await fixture?.server.close();
  fixture = undefined;
});

describe('authenticated read-only projection SSE', () => {
  it('requires auth and replays only revisions after the cursor without sensitive data', async () => {
    fixture = await startTestHttpServer();
    const unauthenticated = await fetch(`${fixture.server.origin}/api/v1/events`);
    expect(unauthenticated.status).toBe(401);
    fixture.sse.publish({ revision: 1, notificationIds: [uuidV7(2001)] });
    fixture.sse.publish({ revision: 2, notificationIds: [uuidV7(2002)] });
    const stream = await openStream(fixture, { 'Last-Event-ID': '1' });
    expect(stream.response.status).toBe(200);
    expect(stream.response.headers.get('cache-control')).toBe('no-store');
    const text = await readUntil(stream.reader, 'id: 2');
    expect(text).toContain('event: projection');
    expect(text).toContain(uuidV7(2002));
    expect(text).not.toContain(uuidV7(2001));
    expect(text).not.toContain(advisorMessageBody().bodyText);
    expect(text).not.toContain(fixture.session.csrfToken);
    stream.controller.abort();
  });

  it('signals cursor reset and rejects an invalid cursor before sending SSE headers', async () => {
    fixture = await startTestHttpServer();
    fixture.sse.publish({ revision: 7, notificationIds: [uuidV7(2010)] });
    const reset = await openStream(fixture, { 'Last-Event-ID': '999' });
    expect(await readUntil(reset.reader, 'reset_required')).toContain('"latestRevision":7');
    reset.controller.abort();

    const invalid = await fetch(`${fixture.server.origin}/api/v1/events`, {
      headers: { Cookie: fixture.cookie, 'Last-Event-ID': '../secret' },
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ code: 'INVALID_ROUTE_SCHEMA' });
  });

  it('caps two concurrent streams per session and closes all of them on revocation', async () => {
    fixture = await startTestHttpServer();
    const first = await openStream(fixture);
    const second = await openStream(fixture);
    expect(fixture.sse.connectionCount(fixture.session.cookieHandle)).toBe(2);
    const third = await fetch(`${fixture.server.origin}/api/v1/events`, {
      headers: { Cookie: fixture.cookie },
    });
    expect(third.status).toBe(429);
    expect(await third.json()).toMatchObject({ code: 'SSE_LIMIT_REACHED' });
    await fixture.sessions.revoke(fixture.session.cookieHandle);
    const [firstText, secondText] = await Promise.all([
      readUntil(first.reader, 'session_revoked'),
      readUntil(second.reader, 'session_revoked'),
    ]);
    expect(firstText).toContain('SESSION_REVOKED');
    expect(secondText).toContain('SESSION_REVOKED');
    expect(fixture.sse.connectionCount()).toBe(0);
  });

  it('emits bounded heartbeats while the server-side session remains valid', async () => {
    fixture = await startTestHttpServer(undefined, 20);
    const stream = await openStream(fixture);
    expect(await readUntil(stream.reader, ': heartbeat')).toContain(': heartbeat');
    stream.controller.abort();
  });
});

async function openStream(
  fixtureValue: HttpServerFixture,
  headers: Readonly<Record<string, string>> = {},
) {
  const controller = new AbortController();
  controllers.push(controller);
  const response = await fetch(`${fixtureValue.server.origin}/api/v1/events`, {
    headers: { Cookie: fixtureValue.cookie, ...headers },
    signal: controller.signal,
  });
  const reader = response.body?.getReader();
  if (reader === undefined) throw new Error('SSE response body is unavailable');
  return { controller, response, reader };
}

async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  expected: string,
): Promise<string> {
  const decoder = new TextDecoder();
  let text = '';
  const timeout = AbortSignal.timeout(1000);
  while (!text.includes(expected)) {
    const next = await Promise.race([
      reader.read(),
      new Promise<never>((_resolve, reject) => {
        timeout.addEventListener('abort', () => reject(new Error(`SSE timeout: ${expected}`)), {
          once: true,
        });
      }),
    ]);
    if (next.done) break;
    text += decoder.decode(next.value, { stream: true });
  }
  return text;
}
