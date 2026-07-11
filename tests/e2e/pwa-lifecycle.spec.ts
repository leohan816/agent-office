import { expect, test } from '@playwright/test';

test.describe('loopback PWA lifecycle', () => {
  test('installs the local manifest/worker and provides an offline read-only shell', async ({ page, context }) => {
    await page.goto('/');
    const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifest).toBe('/manifest.webmanifest');
    const manifestValue = await page.evaluate(async () => {
      const response = await fetch('/manifest.webmanifest');
      return response.json() as Promise<{
        readonly start_url: string;
        readonly scope: string;
        readonly display: string;
        readonly icons: readonly { readonly src: string; readonly purpose: string }[];
      }>;
    });
    expect(manifestValue).toMatchObject({ start_url: '/', scope: '/', display: 'standalone' });
    expect(manifestValue.icons.map((icon) => icon.purpose)).toEqual(['any', 'maskable']);
    await page.evaluate(() => navigator.serviceWorker.ready);
    const installCachePaths = await page.evaluate(async () => {
      const cache = await caches.open('agent-office-shell-v1');
      return (await cache.keys()).map((request) => new URL(request.url).pathname);
    });
    expect(installCachePaths.some((pathname) => pathname.startsWith('/assets/'))).toBe(true);
    await page.reload();
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    await expect(page.getByText('LOOPBACK_PRIVATE')).toBeVisible();
    await expect(page.getByText('READ_ONLY', { exact: true })).toBeVisible();
    await expect(page.getByText('AUTH_BLOCKED', { exact: true })).toBeVisible();
    await expect(
      page.getByLabel('Private runtime boundary').getByText('MANUAL_FALLBACK_REQUIRED', { exact: true }),
    ).toBeVisible();
    await page.reload();
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('OFFLINE_READ_ONLY', { exact: true })).toBeVisible();
    await expect(
      page.getByLabel('Private runtime boundary').getByRole('status'),
    ).toContainText('Mutations and background queueing are disabled');
    await expect(page.getByText('PWA recovery')).toBeVisible();
    await context.setOffline(false);
  });

  test('exposes an explicit unregister/reload recovery path without an automatic update action', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect(page.getByText('PWA recovery')).toBeVisible();
    await page.getByText('PWA recovery').click();
    await expect(page.getByRole('button', { name: 'Unregister and reload' })).toBeVisible();
    await expect(page.getByText('Server data is not deleted.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Update available' })).toHaveCount(0);
  });
});
