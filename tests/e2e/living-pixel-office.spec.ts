import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

// Primary-Office visual + interaction evidence (Advisor doc 50/51; SIR-1/2/3/5 re-review). The
// authenticated production Living Office renders only against the real composed loopback runtime, so
// this spec runs ONLY under `playwright.batch-a-living-office.config.ts`. Under the default demo config
// it self-skips. It proves the office actually initializes under the strict CSP and renders a non-blank,
// animating, accessible surface — no masked false positive. Deterministic baselines live only in the
// new directory tests/e2e/baselines/living-pixel-office.spec.ts/; unmasked live captures are attached
// as directly-inspectable artifacts.
const enabled = process.env.AGENT_OFFICE_LIVING_OFFICE_E2E === '1';
const LIVING_OFFICE_EYEBROW = 'AGENT OFFICE · AUTHENTICATED LIVING OFFICE';
// The composed test runtime registers exactly these three one-time bootstrap proofs.
const PROOF_DESKTOP = 'A'.repeat(43);
const PROOF_MOBILE = 'B'.repeat(43);
const PROOF_REDUCED = 'C'.repeat(43);

test.skip(!enabled, 'living-pixel-office renders the authenticated Office via its dedicated composed-runtime config');
test.describe.configure({ mode: 'serial' });

test.describe('authenticated Living Office primary surface (Batch A CD-2)', () => {
  test('renders a CSP-safe non-blank animating office + accessible 17-field drawer on desktop', async ({ page }, testInfo) => {
    const pageErrors = capturePageErrors(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await authenticate(page, PROOF_DESKTOP);
    await expect(page.locator('.living-office-surface')).toBeVisible();

    // SIR-1/SIR-3: strict-CSP init actually completed and the canvas is a non-blank office.
    await proveNonblankProductionCanvas(page, pageErrors);
    // SIR-3/SIR-5: the ambient office keeps animating (fixture-free eight-state Channy + idle frames).
    await expectContinuousProductionMotion(page);
    // SIR-2/SIR-3: full authenticated surface passes WCAG A/AA (not the drawer-only subset), including
    // forced-colors and 200% text.
    await expectFullSurfaceAxeClean(page, 'default');
    await page.emulateMedia({ forcedColors: 'active' });
    await expectFullSurfaceAxeClean(page, 'forced-colors');
    await page.emulateMedia({ forcedColors: 'none' });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await expectNoHorizontalOverflow(page);
    await expectFullSurfaceAxeClean(page, '200% text');
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    // SIR-3: unmasked live production capture, directly inspectable.
    await attachUnmaskedOffice(page, testInfo, 'living-office-desktop-unmasked-1440x900');

    // BA-WU-04: open the committed-evidence actor detail drawer and assert the exact 17-field contract.
    const label = page.locator('[data-actor-label]:visible').first();
    await label.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveClass(/living-office-actor-detail/u);
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    const factRows = dialog.locator('[data-actor-fact]');
    await expect(factRows).toHaveCount(17);
    for (const row of await factRows.all()) {
      await expect(row).toHaveAttribute('data-actor-fact-source', /.+/u);
      await expect(row).toHaveAttribute('data-actor-fact-status', /.+/u);
    }
    const drawerAxe = await new AxeBuilder({ page })
      .include('.living-office-actor-detail')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(drawerAxe.violations).toEqual([]);
    await expect(dialog).toHaveScreenshot('living-office-actor-drawer-1440x900.png', {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.005,
    });

    await dialog.getByRole('button', { name: 'Close actor detail' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(label).toBeFocused(); // focus returns to the invoking actor label
  });

  test('renders a CSP-safe non-blank office without horizontal overflow on mobile', async ({ page }, testInfo) => {
    const pageErrors = capturePageErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page, PROOF_MOBILE);

    await expect(page.locator('.living-office-surface')).toBeVisible();
    await proveNonblankProductionCanvas(page, pageErrors);
    await expectNoHorizontalOverflow(page);
    await expectFullSurfaceAxeClean(page, 'mobile');
    await page.evaluate(() => window.scrollTo(0, 0));
    await attachUnmaskedOffice(page, testInfo, 'living-office-mobile-unmasked-390x844');
  });

  test('renders an accessible static Living Office fallback with no canvas under reduced motion', async ({ page }) => {
    const pageErrors = capturePageErrors(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await authenticate(page, PROOF_REDUCED);

    // Reduced motion resolves to the DOM_STATIC office tier: no live Pixi canvas, no motion cues.
    await expect(page.locator('[data-pixel-canvas]')).toHaveCount(0);
    await expect(page.locator('[data-pixel-backend="DOM_STATIC"]')).toHaveCount(1);
    await expect(page.locator('[data-motion-cue], [data-route-cue]')).toHaveCount(0);
    await expect(page.locator('.living-office-surface')).toBeVisible();
    await expectFullSurfaceAxeClean(page, 'reduced-motion static');
    const uncaught = pageErrors.filter((entry) => entry.startsWith('pageerror:'));
    expect(uncaught, `no uncaught page error: ${uncaught.join(' | ')}`).toEqual([]);
    // The static tier has no live canvas, so this full-page capture is deterministic + readable (SIR-2).
    await expect(page).toHaveScreenshot('living-office-static-desktop-1440x900.png', {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.005,
    });
  });
});

async function authenticate(page: Page, proof: string): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.runtime-boundary')).toContainText('LOGIN_REQUIRED');
  await expect(page.getByLabel('일회용 인증 증명')).toBeVisible();
  await page.getByLabel('일회용 인증 증명').fill(proof);
  await page.getByRole('button', { name: '로그인' }).click();
  // CD-2: the authenticated default primary surface is the Living Office (truthful eyebrow, not the prototype).
  await expect(page.locator('[data-primary-view="office"]')).toBeVisible();
  await expect(page.locator('#living-office-status')).toContainText(LIVING_OFFICE_EYEBROW);
}

/** Collect uncaught page errors + console errors from load onward (a strict-CSP eval error surfaces here). */
function capturePageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

/** Prove the authenticated production Pixi canvas truly initialized and rendered a non-blank office. */
async function proveNonblankProductionCanvas(page: Page, pageErrors: readonly string[]): Promise<void> {
  const canvas = page.locator('canvas[data-pixel-canvas="true"]');
  await expect(canvas, 'onInit completed and marked the live canvas').toHaveCount(1);
  await expect(page.locator('.pixel-world-viewport'))
    .toHaveAttribute('data-pixel-renderer-status', 'PIXEL_READY');
  await expect(page.locator('.pixel-world-viewport')).toHaveAttribute('data-pixel-backend', /WEBGL|CANVAS/u);
  const size = await canvas.evaluate((element) => ({
    width: (element as HTMLCanvasElement).width,
    height: (element as HTMLCanvasElement).height,
  }));
  // A failed init leaves the 300x150 default; a real init sizes the canvas to the office viewport
  // (≈1440 wide desktop, ≈386 wide mobile) — both clear the default in each dimension.
  expect(size.width, 'canvas intrinsic width').toBeGreaterThan(320);
  expect(size.height, 'canvas intrinsic height').toBeGreaterThan(200);
  // Compositor screenshot of the canvas: a blank fill compresses to a tiny PNG, a rendered office does not.
  const rendered = await canvas.screenshot({ animations: 'disabled' });
  expect(rendered.byteLength, 'rendered canvas must be non-blank').toBeGreaterThan(15000);
  // No uncaught exception (the strict-CSP eval failure surfaced here as a pageerror), and no CSP/renderer
  // error on the console. Two pre-existing benign console messages are out of this rework's scope and
  // tolerated: the pre-auth protected-resource 401, and the `runtime-app.tsx` login-form `pattern`
  // attribute warning under the browser's regexp `v` flag.
  const uncaught = pageErrors.filter((entry) => entry.startsWith('pageerror:'));
  expect(uncaught, `no uncaught page error: ${uncaught.join(' | ')}`).toEqual([]);
  const rendererErrors = pageErrors.filter((entry) =>
    /unsafe-eval|content-security|refused to (?:evaluate|execute|compile)|\bpixi\b|\bwebgl\b/iu.test(entry));
  expect(rendererErrors, `no CSP/renderer error: ${rendererErrors.join(' | ')}`).toEqual([]);
}

/** SIR-3/SIR-5: successive live canvas frames differ — the office ambient sequence keeps animating. */
async function expectContinuousProductionMotion(page: Page): Promise<void> {
  const canvas = page.locator('canvas[data-pixel-canvas="true"]');
  const first = await canvas.screenshot();
  await page.waitForTimeout(1300);
  const second = await canvas.screenshot();
  expect(Buffer.compare(first, second), 'production canvas must animate over time').not.toBe(0);
}

/** SIR-2/SIR-3: the whole authenticated surface (not the drawer-only subset) passes WCAG A/AA. */
async function expectFullSurfaceAxeClean(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .include('.living-office-surface')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    targets: violation.nodes.map((node) => node.target.join(' ')),
  }));
  expect(results.violations, `${label} surface accessibility: ${JSON.stringify(summary)}`).toEqual([]);
}

async function attachUnmaskedOffice(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const shot = await page.screenshot({ animations: 'disabled', caret: 'hide' });
  await testInfo.attach(`${name}.png`, { body: shot, contentType: 'image/png' });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
}
