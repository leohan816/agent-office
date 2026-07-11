import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const SESSION_COOKIE = `synthetic_e2e_${String(1).padStart(32, '0')}`;

test.beforeEach(async ({ context }) => {
  await authenticate(context);
});

test.describe('authenticated composed application office scene', () => {
  test('renders the structured desktop projection without fixture controls or invented motion', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openApplicationProjection(page);
    await expect(page.locator('.scene-station:visible')).toHaveCount(8);
    await expect(page.locator('.scene-fixture-control')).toHaveCount(0);
    await expect(page.locator('#office-scene')).toContainText('APPLICATION PROJECTION');
    await expect(page.locator('[data-station-id="agent-office"]')).toHaveAttribute(
      'data-state',
      'UNKNOWN_OR_STALE',
    );
    await expect(page.locator('[data-motion-cue], [data-route-cue]')).toHaveCount(0);
    await expect(page).toHaveScreenshot('application-office-desktop-1440x900.png', {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.005,
    });
  });

  test('contains the authenticated application projection on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openApplicationProjection(page);
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
    await openApplicationProjection(page);
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

async function authenticate(context: BrowserContext): Promise<void> {
  await context.addCookies([{
    name: 'AO_SESSION',
    value: SESSION_COOKIE,
    url: 'http://127.0.0.1:4183',
    httpOnly: true,
    sameSite: 'Strict',
  }]);
}

async function openApplicationProjection(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#office-scene')).toBeVisible();
  await expect(page.locator('.topbar-status')).toContainText('APPLICATION PROJECTION');
  await expect(page.locator('.runtime-boundary')).toContainText('TEST_AUTHENTICATED');
}
