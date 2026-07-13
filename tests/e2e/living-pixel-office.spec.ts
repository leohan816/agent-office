import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Primary-Office visual + interaction evidence (Advisor doc 50 rule 5 / doc 51). The authenticated
// production Living Office renders only against the real composed loopback runtime, so this spec runs
// ONLY under `playwright.batch-a-living-office.config.ts` (which reuses that runtime + auth). Under the
// default demo config (static demo entry, no authenticated Office) it self-skips. Fresh screenshots
// live only in the new baseline directory tests/e2e/baselines/living-pixel-office.spec.ts/.
const enabled = process.env.AGENT_OFFICE_LIVING_OFFICE_E2E === '1';
const LIVING_OFFICE_EYEBROW = 'AGENT OFFICE · AUTHENTICATED LIVING OFFICE';
// The composed test runtime registers exactly these three one-time bootstrap proofs.
const PROOF_DESKTOP = 'A'.repeat(43);
const PROOF_MOBILE = 'B'.repeat(43);
const PROOF_REDUCED = 'C'.repeat(43);

test.skip(!enabled, 'living-pixel-office renders the authenticated Office via its dedicated composed-runtime config');
test.describe.configure({ mode: 'serial' });

test.describe('authenticated Living Office primary surface (Batch A CD-2)', () => {
  test('renders the Living Office and its accessible 17-field actor detail drawer on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await authenticate(page, PROOF_DESKTOP);

    await expect(page.locator('.living-office-surface')).toBeVisible();
    await expect(page.locator('.pixel-world-viewport')).toHaveAttribute('data-pixi-js-version', '8.19.0');
    await expect(page.locator('[data-actor-label]:visible').first()).toBeVisible();
    await expect(page).toHaveScreenshot('living-office-desktop-1440x900.png', officeShot(page));

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
    const accessibility = await new AxeBuilder({ page })
      .include('.living-office-actor-detail')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await expect(page).toHaveScreenshot('living-office-actor-drawer-1440x900.png', officeShot(page));

    await dialog.getByRole('button', { name: 'Close actor detail' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(label).toBeFocused(); // focus returns to the invoking actor label
  });

  test('renders the Living Office on mobile without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page, PROOF_MOBILE);

    await expect(page.locator('.living-office-surface')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page).toHaveScreenshot('living-office-mobile-390x844.png', officeShot(page));
  });

  test('renders the static Living Office fallback with no canvas under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await authenticate(page, PROOF_REDUCED);

    // Reduced motion resolves to the DOM_STATIC office tier: no live Pixi canvas, no motion cues.
    await expect(page.locator('[data-pixel-canvas]')).toHaveCount(0);
    await expect(page.locator('[data-pixel-backend="DOM_STATIC"]')).toHaveCount(1);
    await expect(page.locator('[data-motion-cue], [data-route-cue]')).toHaveCount(0);
    await expect(page.locator('.living-office-surface')).toBeVisible();
    await expect(page).toHaveScreenshot('living-office-reduced-motion-static-1440x900.png', staticShot());
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

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
}

// Office captures mask the live Pixi canvas so the deterministic DOM shell (HUD, actor labels,
// detail drawer, semantic mirror) is the compared surface.
function officeShot(page: Page) {
  return {
    animations: 'disabled' as const,
    caret: 'hide' as const,
    maxDiffPixelRatio: 0.005,
    mask: [page.locator('canvas')],
  };
}

function staticShot() {
  return {
    animations: 'disabled' as const,
    caret: 'hide' as const,
    maxDiffPixelRatio: 0.005,
  };
}
