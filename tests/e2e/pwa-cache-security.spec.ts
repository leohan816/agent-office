import { expect, test } from '@playwright/test';

test('service worker cache contains only shell GETs and no sensitive response data', async ({ page }) => {
  const canary = 'synthetic-canary-secret-batch-e-cache';
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await page.evaluate(async (value) => {
    const paths = [
      `/api/v1/status?value=${value}`,
      `/auth/session?value=${value}`,
      `/messages/${value}`,
      `/artifacts/${value}`,
      `/alerts/${value}`,
      `/decisions/${value}`,
      `/health/ready?value=${value}`,
    ];
    await Promise.all(paths.map((path) => fetch(path).catch(() => undefined)));
    await fetch('/api/v1/advisor/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    }).catch(() => undefined);
  }, canary);
  const cacheEvidence = await page.evaluate(async () => {
    const names = await caches.keys();
    const entries: { readonly url: string; readonly method: string; readonly text: string }[] = [];
    for (const name of names) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        entries.push({
          url: request.url,
          method: request.method,
          text: response === undefined ? '' : await response.text(),
        });
      }
    }
    return { names, entries };
  });
  expect(cacheEvidence.names).toEqual(['agent-office-shell-v1']);
  expect(cacheEvidence.entries.length).toBeGreaterThan(4);
  for (const entry of cacheEvidence.entries) {
    const pathname = new URL(entry.url).pathname;
    expect(entry.method).toBe('GET');
    expect(pathname).not.toMatch(/^\/(?:api|auth|messages|artifacts|alerts|decisions|health)\//u);
    expect(entry.text).not.toContain(canary);
  }
});
