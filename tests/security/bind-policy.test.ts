import { request } from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import {
  assertRequestNetworkBoundary,
  startAgentOfficeHttpServer,
  type LoopbackNetworkPolicy,
} from '../../src/server/index.js';
import { InMemorySecurityAuditSink } from '../../src/server/security/audit.js';
import { RecordingHttpApplication, startTestHttpServer, type HttpServerFixture } from '../helpers/server-fixture.js';
import { FIXED_TIME, uuidV7 } from '../helpers/fixtures.js';

let fixture: HttpServerFixture | undefined;

afterEach(async () => {
  await fixture?.server.close();
  fixture = undefined;
});

describe('loopback network boundary', () => {
  it('rejects wildcard and non-loopback bind requests before listen', async () => {
    for (const address of ['0.0.0.0', '192.0.2.10']) {
      await expect(startAgentOfficeHttpServer({
        bindAddress: address as '127.0.0.1',
        application: new RecordingHttpApplication(),
        audit: new InMemorySecurityAuditSink(),
        now: () => FIXED_TIME,
        nextId: () => uuidV7(1200),
      })).rejects.toMatchObject({ code: 'NETWORK_BOUNDARY_REJECTED' });
    }
  });

  it('rejects non-loopback peers, Host confusion, and proxy identity headers', () => {
    const policy: LoopbackNetworkPolicy = {
      mode: 'LOOPBACK_PRIVATE',
      bindAddress: '127.0.0.1',
      allowedHosts: ['127.0.0.1:4317'],
      origin: 'http://127.0.0.1:4317',
    };
    expect(() => assertRequestNetworkBoundary(policy, {
      peerAddress: '192.0.2.8',
      host: '127.0.0.1:4317',
      headers: {},
    })).toThrow(expect.objectContaining({ code: 'NETWORK_BOUNDARY_REJECTED' }));
    expect(() => assertRequestNetworkBoundary(policy, {
      peerAddress: '127.0.0.1',
      host: 'evil.example:4317',
      headers: {},
    })).toThrow(expect.objectContaining({ code: 'HOST_REJECTED' }));
    expect(() => assertRequestNetworkBoundary(policy, {
      peerAddress: '::ffff:127.0.0.1',
      host: '127.0.0.1:4317',
      headers: { forwarded: 'for=192.0.2.8' },
    })).toThrow(expect.objectContaining({ code: 'PROXY_HEADERS_REJECTED' }));
  });

  it('enforces the Host allowlist on the live loopback listener', async () => {
    fixture = await startTestHttpServer();
    const response = await rawRequest(fixture.server.port, {
      Host: 'attacker.invalid:4317',
      'X-Forwarded-For': '127.0.0.1',
    });
    expect(response.status).toBe(421);
    expect(response.body).toContain('HOST_REJECTED');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

function rawRequest(
  port: number,
  headers: Readonly<Record<string, string>>,
): Promise<{ readonly status: number; readonly body: string; readonly headers: import('node:http').IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const client = request({ host: '127.0.0.1', port, path: '/health/live', headers }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode ?? 0,
        body: Buffer.concat(chunks).toString('utf8'),
        headers: response.headers,
      }));
    });
    client.on('error', reject);
    client.end();
  });
}
