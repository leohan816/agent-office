import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  NEVER_CACHE_PREFIXES,
  PWA_CACHE_VERSION,
  STATIC_SHELL_URLS,
  isCacheableStaticShell,
} from '../../src/pwa/cache-policy.js';

const ORIGIN = 'http://127.0.0.1:4173';

describe('static-shell-only PWA cache policy', () => {
  it('allows only same-origin GET shell resources and rejects no-store responses', () => {
    expect(isCacheableStaticShell({
      method: 'GET',
      requestOrigin: ORIGIN,
      applicationOrigin: ORIGIN,
      pathname: '/assets/index-a1b2c3.js',
      destination: 'script',
    })).toBe(true);
    for (const mutation of [
      { method: 'POST' },
      { requestOrigin: 'http://attacker.invalid' },
      { responseCacheControl: 'private, no-store' },
      { destination: 'document', pathname: '/mission/AO-WU-11' },
    ]) {
      expect(isCacheableStaticShell({
        method: 'GET',
        requestOrigin: ORIGIN,
        applicationOrigin: ORIGIN,
        pathname: '/assets/index-a1b2c3.js',
        destination: 'script',
        ...mutation,
      })).toBe(false);
    }
  });

  it('never caches API, auth, SSE, message, artifact, alert, decision, or health paths', () => {
    expect(NEVER_CACHE_PREFIXES).toEqual([
      '/api/',
      '/health/',
      '/auth/',
      '/artifacts/',
      '/messages/',
      '/decisions/',
      '/alerts/',
    ]);
    for (const prefix of NEVER_CACHE_PREFIXES) {
      expect(isCacheableStaticShell({
        method: 'GET',
        requestOrigin: ORIGIN,
        applicationOrigin: ORIGIN,
        pathname: `${prefix}synthetic-canary`,
        destination: 'script',
      })).toBe(false);
    }
  });

  it('keeps the worker/version/manifest aligned and contains no sync mutation queue', async () => {
    const worker = await readFile(new URL('../../public/sw.js', import.meta.url), 'utf8');
    const manifest = JSON.parse(
      await readFile(new URL('../../public/manifest.webmanifest', import.meta.url), 'utf8'),
    ) as { readonly start_url?: unknown; readonly scope?: unknown; readonly display?: unknown; readonly icons?: unknown };
    expect(worker).toContain(`const CACHE_NAME = '${PWA_CACHE_VERSION}'`);
    for (const url of STATIC_SHELL_URLS) expect(worker).toContain(`'${url}'`);
    expect(worker).not.toMatch(/addEventListener\(['"](?:sync|periodicsync)['"]/iu);
    expect(worker).toContain("request.method !== 'GET'");
    expect(manifest).toMatchObject({ start_url: '/', scope: '/', display: 'standalone' });
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(JSON.stringify(manifest)).not.toMatch(/https?:\/\/(?!127\.0\.0\.1)/iu);
  });
});
