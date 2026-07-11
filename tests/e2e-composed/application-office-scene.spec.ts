import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.describe('authenticated composed application office scene', () => {
  test('renders the structured desktop projection without fixture controls or invented motion', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, 'A'.repeat(43));
    await expect(page.locator('.scene-station:visible')).toHaveCount(8);
    await expect(page.locator('.scene-fixture-control')).toHaveCount(0);
    await expect(page.locator('#office-scene')).toContainText('APPLICATION PROJECTION');
    await expect(page.locator('[data-station-id="agent-office"]')).toHaveAttribute(
      'data-state',
      'UNKNOWN_OR_STALE',
    );
    await expect(page.locator('[data-motion-cue], [data-route-cue]')).toHaveCount(0);
    await expect(page).toHaveScreenshot('application-office-desktop-1440x900.png', {
      animations: 'allow',
      caret: 'hide',
      maxDiffPixelRatio: 0.005,
    });
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('heading', { name: 'LOGGED_OUT' })).toBeVisible();
    await expect(page.locator('#office-scene')).toHaveCount(0);
  });

  test('contains the authenticated application projection on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'B'.repeat(43));
    await expect(page.locator('.scene-station:visible')).toHaveCount(2);
    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
    await expect(page).toHaveScreenshot('application-office-mobile-390x844.png', {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.005,
    });
  });

  test('preserves reduced motion and accessibility in the composed path', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await login(page, 'C'.repeat(43));
    await expect(page.locator('.scene-route-layer')).toHaveCSS('display', 'none');
    await expect(page.locator('[data-motion-cue], [data-route-cue]')).toHaveCount(0);
    const accessibility = await new AxeBuilder({ page })
      .include('#office-scene')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await expect(page).toHaveScreenshot('application-office-reduced-motion-1440x900.png', {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.005,
    });
  });
});

async function login(page: Page, proof: string): Promise<void> {
  const requestedUrls: string[] = [];
  page.on('request', (request) => requestedUrls.push(request.url()));
  await page.goto('/');
  await expect(page.locator('.runtime-boundary')).toContainText('LOGIN_REQUIRED');
  await expect(page.locator('.runtime-boundary')).toContainText('MANUAL_FALLBACK_REQUIRED');
  await expect(page.getByLabel('일회용 인증 증명')).toBeVisible();
  await page.getByLabel('일회용 인증 증명').fill(proof);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.locator('#office-scene')).toBeVisible();
  await expect(page.locator('.topbar-status')).toContainText('APPLICATION PROJECTION');
  await expect(page.locator('.runtime-boundary')).toContainText('LOCAL_BOOTSTRAP_AUTHENTICATED');
  await expect(page.locator('.runtime-boundary')).toContainText('MANUAL_FALLBACK_REQUIRED');
  expect(page.url()).not.toContain(proof);
  expect(requestedUrls.every((url) => !url.includes(proof))).toBe(true);
  const browserStorage = await page.evaluate(async () => {
    const cacheBodies: string[] = [];
    for (const cacheName of await caches.keys()) {
      const cache = await caches.open(cacheName);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        if (response !== undefined) cacheBodies.push(await response.text());
      }
    }
    return {
      localStorage: Array.from({ length: localStorage.length }, (_, index) => {
        const key = localStorage.key(index);
        return key === null ? null : [key, localStorage.getItem(key)];
      }),
      sessionStorage: Array.from({ length: sessionStorage.length }, (_, index) => {
        const key = sessionStorage.key(index);
        return key === null ? null : [key, sessionStorage.getItem(key)];
      }),
      cacheBodies,
      indexedDatabaseNames: typeof indexedDB.databases === 'function'
        ? (await indexedDB.databases()).map((database) => database.name ?? '')
        : [],
    };
  });
  expect(JSON.stringify(browserStorage)).not.toContain(proof);
  const cookies = await page.context().cookies();
  expect(cookies).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: 'AO_SESSION', httpOnly: true, sameSite: 'Strict' }),
  ]));
}
