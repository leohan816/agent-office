import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

test.describe('AO12-B static shared floor and identity', () => {
  test('keeps the default test-demo on the unchanged M1 surface', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#spatial-office')).toHaveCount(0);
    await expect(page.locator('#office-scene')).toHaveCount(1);
    await expect(page.getByLabel('구조화 이벤트 장면')).toBeVisible();
  });

  test('matches the configured-runtime desktop static baseline', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSpatialFixture(page);
    await expect(page.locator('.spatial-team-pod')).toHaveCount(2);
    await expect(page.locator('.spatial-team-pod[data-selected="false"]')).toBeVisible();
    await expect(page).toHaveScreenshot('spatial-static-desktop-1440x900.png', screenshotOptions());
  });

  test('matches the configured-runtime tablet static baseline', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await openSpatialFixture(page);
    await expect(page.locator('.spatial-team-pod')).toHaveCount(2);
    await expect(page.locator('.spatial-team-pod[data-selected="false"]')).toBeVisible();
    await assertNoPageOverflow(page);
    await expect(page).toHaveScreenshot('spatial-static-tablet-1024x768.png', screenshotOptions());
  });

  test('matches the focused mobile static baseline with at most two full actors', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSpatialFixture(page);
    await expect(page.locator('.spatial-pod-control')).toHaveCount(2);
    await expect(page.locator('.spatial-team-pod:visible')).toHaveCount(1);
    expect(await page.locator('.spatial-character:visible').count()).toBeLessThanOrEqual(2);
    await assertNoPageOverflow(page);
    await expect(page).toHaveScreenshot('spatial-static-mobile-390x844.png', screenshotOptions());
  });

  test('matches reduced-motion static equivalence with zero animation objects', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openSpatialFixture(page);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await expect(page.locator('#spatial-office')).toHaveAttribute('data-motion-tier', 'STATIC');
    await expect(page).toHaveScreenshot('spatial-static-reduced-motion-1440x900.png', screenshotOptions());
  });

  test('matches forced-color identity with text, edge, and focus semantics intact', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ forcedColors: 'active' });
    await openSpatialFixture(page);
    const firstPod = page.locator('.spatial-pod-control').first();
    await firstPod.focus();
    await expect(firstPod).toBeFocused();
    await expect(firstPod).toHaveCSS('outline-style', 'solid');
    await expect(page.getByText('Agent Office', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('agent-office', { exact: true }).first()).toBeVisible();
    await expect(page).toHaveScreenshot('spatial-static-forced-colors-1440x900.png', screenshotOptions());
  });

  test('matches 200 percent text with wrapped identity and no horizontal loss', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSpatialFixture(page);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await assertNoPageOverflow(page);
    await expect(page.getByText('agent-office', { exact: true }).first()).toBeVisible();
    await expect(page.locator('.spatial-team-pod:visible')).toHaveCount(1);
    await expect(page).toHaveScreenshot('spatial-static-text-200-percent-390x844.png', screenshotOptions());
  });

  test('contains desktop Pods and passes 320px, tablet, mobile, and short-landscape layout gates', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSpatialFixture(page);
    const floor = await requiredBox(page.locator('.spatial-office-floor'));
    const podBoxes = await Promise.all([
      requiredBox(page.locator('.spatial-team-pod').nth(0)),
      requiredBox(page.locator('.spatial-team-pod').nth(1)),
    ]);
    for (const box of podBoxes) assertContained(box, floor);
    expect(overlapArea(requireBox(podBoxes, 0), requireBox(podBoxes, 1))).toBe(0);

    for (const viewport of [
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
      { width: 320, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await assertNoPageOverflow(page);
      await expect(page.locator('.spatial-team-pod:visible')).toHaveCount(viewport.width < 768 ? 1 : 2);
      expect(await page.locator('.spatial-character:visible').count()).toBeLessThanOrEqual(viewport.width < 768 ? 2 : 8);
    }

    await page.setViewportSize({ width: 320, height: 844 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await assertNoPageOverflow(page);
  });

  test('passes WCAG A/AA automation and keyboard, focus, dialog, and 44px gates', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSpatialFixture(page);
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
    await expect(secondPod).toHaveAttribute('aria-current', 'true');
    await expect(secondPod).toBeFocused();

    const actor = page.locator('.spatial-character:visible').last();
    await actor.focus();
    await actor.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole('button', { name: 'Close actor inspector' });
    await expect(close).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(actor).toBeFocused();
  });

  test('preserves full identity after decorative SVG/color removal and makes no external request', async ({ page }) => {
    const requestUrls: string[] = [];
    page.on('request', (request) => requestUrls.push(request.url()));
    await page.setViewportSize({ width: 1024, height: 768 });
    await openSpatialFixture(page);
    await page.locator('.project-identity svg, .spatial-placeholder').evaluateAll((elements) => {
      for (const element of elements) element.remove();
      document.documentElement.classList.add('test-color-removed');
    });
    await page.addStyleTag({ content: '* { color: CanvasText !important; background-image: none !important; }' });
    await expect(page.getByText('Agent Office', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('agent-office', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('VibeNews', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('vibenews', { exact: true }).first()).toBeVisible();
    expect(requestUrls.every((url) => new URL(url).origin === 'http://127.0.0.1:4173')).toBe(true);
  });
});

async function openSpatialFixture(page: Page): Promise<void> {
  await page.goto('/?surface=spatial-static');
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page.locator('#spatial-office')).toHaveAttribute('data-fixture-kind', 'SYNTHETIC_NON_OPERATIONAL_STATIC');
  await expect(page.locator('#spatial-office')).toHaveAttribute('data-motion-tier', 'STATIC');
}

function screenshotOptions() {
  return {
    animations: 'disabled' as const,
    caret: 'hide' as const,
    fullPage: true,
    maxDiffPixelRatio: 0,
  };
}

async function requiredBox(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) throw new TypeError('required element has no bounding box');
  return box;
}

async function assertNoPageOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

function assertContained(
  inner: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  outer: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): void {
  expect(inner.x).toBeGreaterThanOrEqual(outer.x);
  expect(inner.y).toBeGreaterThanOrEqual(outer.y);
  expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width + 0.5);
  expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height + 0.5);
}

function overlapArea(
  left: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  right: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): number {
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  return width * height;
}

function requireBox<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new TypeError('required box missing');
  return item;
}
