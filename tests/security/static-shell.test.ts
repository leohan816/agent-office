import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  CLOSED_HTTP_ROUTES,
  InMemorySecurityAuditSink,
  startAgentOfficeHttpServer,
} from '../../src/server/index.js';
import { RecordingHttpApplication } from '../helpers/server-fixture.js';
import { FIXED_TIME, uuidV7 } from '../helpers/fixtures.js';

const roots: string[] = [];
const servers: { close(): Promise<void> }[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('same-origin static PWA shell server', () => {
  it('serves only exact shell paths with CSP and immutable hashed assets', async () => {
    const fixture = await staticFixture();
    const root = await fetch(`${fixture.origin}/`);
    expect(root.status).toBe(200);
    expect(await root.text()).toBe('<!doctype html><script type="module" src="/assets/index-abcdefgh.js"></script>');
    expect(root.headers.get('content-security-policy')).toContain("script-src 'self'");
    expect(root.headers.get('cache-control')).toBe('no-cache');
    expect(root.headers.get('access-control-allow-origin')).toBeNull();
    expect(root.headers.get('strict-transport-security')).toBeNull();

    const asset = await fetch(`${fixture.origin}/assets/index-abcdefgh.js`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get('content-type')).toContain('text/javascript');
    expect(asset.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    const worker = await fetch(`${fixture.origin}/sw.js`);
    expect(worker.headers.get('service-worker-allowed')).toBe('/');
    expect(worker.headers.get('cache-control')).toBe('no-cache');
    expect(CLOSED_HTTP_ROUTES).toContain('GET /assets/:content-hashed-static-file');
  });

  it('rejects queries, unknown/generic files, wrong methods, and symlink assets without path disclosure', async () => {
    const fixture = await staticFixture(true);
    const query = await fetch(`${fixture.origin}/index.html?path=../secret`);
    expect(query.status).toBe(400);
    expect(await query.json()).toMatchObject({ code: 'INVALID_ROUTE_SCHEMA' });
    const unknown = await fetch(`${fixture.origin}/assets/unhashed.js`);
    expect(unknown.status).toBe(404);
    const generic = await fetch(`${fixture.origin}/package.json`);
    expect(generic.status).toBe(404);
    const wrongMethod = await fetch(`${fixture.origin}/`, {
      method: 'POST',
      headers: {
        Origin: fixture.origin,
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
      },
    });
    expect(wrongMethod.status).toBe(405);
    const linked = await fetch(`${fixture.origin}/icons/agent-office.svg`);
    expect(linked.status).toBe(503);
    const linkedBody = JSON.stringify(await linked.json());
    expect(linkedBody).toContain('PATH_CONTAINMENT_FAILED');
    expect(linkedBody).not.toContain(fixture.staticRoot);
  });
});

async function staticFixture(withSymlink = false) {
  const staticRoot = await mkdtemp(path.join(tmpdir(), 'agent-office-static-'));
  roots.push(staticRoot);
  await mkdir(path.join(staticRoot, 'assets'), { mode: 0o700 });
  await mkdir(path.join(staticRoot, 'icons'), { mode: 0o700 });
  await writeFile(
    path.join(staticRoot, 'index.html'),
    '<!doctype html><script type="module" src="/assets/index-abcdefgh.js"></script>',
    { mode: 0o600 },
  );
  await writeFile(path.join(staticRoot, 'manifest.webmanifest'), '{}\n', { mode: 0o600 });
  await writeFile(path.join(staticRoot, 'sw.js'), 'self.addEventListener("fetch", () => {});\n', { mode: 0o600 });
  await writeFile(path.join(staticRoot, 'assets', 'index-abcdefgh.js'), 'export {};\n', { mode: 0o600 });
  await writeFile(path.join(staticRoot, 'icons', 'agent-office-maskable.svg'), '<svg/>\n', { mode: 0o600 });
  if (withSymlink) {
    await symlink(path.join(staticRoot, 'index.html'), path.join(staticRoot, 'icons', 'agent-office.svg'));
  } else {
    await writeFile(path.join(staticRoot, 'icons', 'agent-office.svg'), '<svg/>\n', { mode: 0o600 });
  }
  let id = 2800;
  const server = await startAgentOfficeHttpServer({
    bindAddress: '127.0.0.1',
    application: new RecordingHttpApplication(),
    audit: new InMemorySecurityAuditSink(),
    staticRoot,
    now: () => FIXED_TIME,
    nextId: () => uuidV7(id++),
  });
  servers.push(server);
  return { ...server, staticRoot };
}
