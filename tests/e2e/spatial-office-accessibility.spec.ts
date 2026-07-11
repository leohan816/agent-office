import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

test.describe('AO12-C spatial accessibility and responsive equivalence', () => {
  test('matches mobile static timeline equivalence without miniature routes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openFixture(page);
    await expect(page.locator('#spatial-office')).toHaveAttribute('data-motion-tier', 'STATIC');
    await expect(page.locator('[data-motion-cue]')).toHaveCount(0);
    await expect(page.locator('[data-route-static-equivalent="TIER_STATIC"]')).toHaveCount(1);
    await expect(page.locator('.spatial-team-pod:visible')).toHaveCount(1);
    expect(await page.locator('.spatial-character:visible').count()).toBeLessThanOrEqual(2);
    await assertNoPageOverflow(page);
    await expect(page).toHaveScreenshot('spatial-motion-mobile-static-390x844.png', screenshotOptions());
  });

  test('matches forced colors with text, state shapes, focus, and route facts intact', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ forcedColors: 'active' });
    await openFixture(page);
    const control = page.getByRole('button', { name: /Motion on/u });
    await control.focus();
    await expect(control).toBeFocused();
    await expect(control).toHaveCSS('outline-style', 'solid');
    await expect(page.getByText('WAITING_LEO / Waiting for Leo/GPT')).toBeVisible();
    await expect(page.getByRole('log').locator('li')).toHaveCount(3);
    await expect(page).toHaveScreenshot('spatial-motion-forced-colors-1440x900.png', screenshotOptions());
  });

  test('matches 200 percent text at mobile width without horizontal loss', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openFixture(page);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await assertNoPageOverflow(page);
    await expect(page.getByRole('log').locator('li')).toHaveCount(3);
    await expect(page.getByText(/No availability, assignment, shared context/u)).toBeVisible();
    await expect(page).toHaveScreenshot('spatial-motion-text-200-percent-390x844.png', screenshotOptions());
  });

  test('passes WCAG 2.2 A/AA, keyboard, focus, live-region, and 44px gates', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await openFixture(page);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(result.violations).toEqual([]);

    const controls = page.locator('#spatial-office button:visible');
    for (let index = 0; index < await controls.count(); index += 1) {
      const box = await requiredBox(controls.nth(index));
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    const firstPod = page.locator('.spatial-pod-control').first();
    const secondPod = page.locator('.spatial-pod-control').nth(1);
    await firstPod.focus();
    await page.keyboard.press('ArrowRight');
    await expect(secondPod).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(secondPod).toBeFocused();
    await expect(secondPod).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('[data-motion-cue]')).toHaveCount(0);
    await expect(page.locator('[aria-live="polite"][aria-atomic="true"]')).toContainText('VIBENEWS_ADVISOR_TEAM selected');
  });

  test('motion-off exposes identical facts and activity log without movement', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openFixture(page);
    const before = await activityFacts(page);
    const control = page.getByRole('button', { name: /Motion on/u });
    await control.click();
    await expect(page.locator('#spatial-office')).toHaveAttribute('data-motion-tier', 'STATIC');
    await expect(page.locator('[data-motion-cue]')).toHaveCount(0);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    expect(await activityFacts(page)).toEqual(before);
    await expect(page.locator('[data-route-static-equivalent="TIER_STATIC"]')).toHaveCount(1);
    await expect(page.locator('.spatial-motion-control')).toHaveAttribute('aria-pressed', 'true');
  });

  test('proves 320px, short landscape, tablet, mobile, and non-selected Team containment', async ({ page }) => {
    for (const viewport of [
      { width: 320, height: 844 },
      { width: 844, height: 390 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await openFixture(page);
      await assertNoPageOverflow(page);
      await expect(page.locator('.spatial-team-pod:visible')).toHaveCount(viewport.width < 768 ? 1 : 2);
      expect(await page.locator('.spatial-character:visible').count()).toBeLessThanOrEqual(viewport.width < 768 ? 2 : 8);
      await expect(page.getByRole('log').locator('li')).toHaveCount(3);
    }
  });

  test('keeps all essential meaning outside decorative motion and makes no external request', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.setViewportSize({ width: 1440, height: 900 });
    await openFixture(page);
    await page.locator('[aria-hidden="true"], svg').evaluateAll((elements) => {
      for (const element of elements) element.remove();
    });
    await expect(page.getByRole('log').locator('li')).toHaveCount(3);
    await expect(page.getByText('WAITING_LEO / Waiting for Leo/GPT')).toBeVisible();
    await expect(page.getByText(/Primary status, alert, board, and activity log remain independent/u)).toBeVisible();
    expect(requests.every((url) => new URL(url).origin === 'http://127.0.0.1:4173')).toBe(true);
  });
});

async function openFixture(page: Page): Promise<void> {
  await page.goto('/?surface=spatial-motion&freeze=0.5');
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page.locator('#spatial-office')).toHaveAttribute('data-fixture-kind', 'SYNTHETIC_STRUCTURED_EVENT_MOTION');
}

async function activityFacts(page: Page): Promise<readonly string[]> {
  return page.getByRole('log').locator('li').allTextContents();
}

function screenshotOptions() {
  return {
    animations: 'disabled' as const,
    caret: 'hide' as const,
    fullPage: true,
    maxDiffPixelRatio: 0,
  };
}

async function assertNoPageOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function requiredBox(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) throw new TypeError('required element has no bounding box');
  return box;
}
