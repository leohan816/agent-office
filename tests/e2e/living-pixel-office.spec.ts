import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { assertOfficeCanvasNonblank } from '../helpers/production-office-canvas-proof.js';

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
    // A4-1 initial high-text mount: set 200% root text before login so the office mounts already high.
    // The overlay's useLayoutEffect must commit the roster-equivalent mode BEFORE the first paint — the
    // 31% card wall is never presented, even for one frame — so the very first observable state is
    // roster-equivalent with zero on-canvas labels.
    await authenticate(page, PROOF_DESKTOP, async () => {
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    });
    await expect(page.locator('.living-office-surface')).toBeVisible();
    await assertRosterEquivalentMode(page);
    // Return to normal text: the accepted 100% composition and its exact gates follow.
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });

    // SIR-1/SIR-3: strict-CSP init actually completed and the canvas is a non-blank office.
    await proveNonblankProductionCanvas(page, pageErrors);
    // SIR-3/SIR-5: the ambient office keeps animating (fixture-free eight-state Channy + idle frames).
    await expectContinuousProductionMotion(page);
    // SIR-2/SIR-3: full authenticated surface passes WCAG A/AA (not the drawer-only subset), including
    // forced-colors and 200% text.
    await expectFullSurfaceAxeClean(page, 'default');
    // I2-1: the ready host advertises a real backend; the HUD badge agrees and is never PENDING/WEBGL-pre-init.
    await expect(page.locator('.living-office-hud__badges span[data-backend]')).toHaveAttribute('data-backend', /WEBGL|CANVAS/u);
    // I2-4: honest production copy — no prototype/tour/fixture wording on the authenticated surface.
    await expect(page.locator('.living-office-hud__badges')).toHaveAttribute('aria-label', 'Office renderer status');
    await expect(page.locator('.living-office-hud__badges')).not.toContainText(/TOUR|PROTOTYPE/u);
    await expect(page.locator('.living-office-semantic__heading')).toContainText('Accessible committed office mirror');
    await expect(page.locator('.living-office-semantic__heading')).not.toContainText(/synthetic fixture/iu);
    // I2-2: production labels are readable (>=10px), contained (no overflow), connected to their actors,
    // and — critically — displaced so no two cards overlap each other.
    await assertReadableProductionLabels(page);
    await assertNoProductionLabelOverlap(page);
    // A3-2: the labels must not form a wall of cards over the Office — the world stays the primary signal.
    await assertOfficeIsPrimary(page);
    // A4-2: bind the gate to the exact visible production actor set with one shared combined predicate,
    // and prove the negative: hiding exactly one label fails that same predicate even though the roster
    // stays full and union coverage alone still passes.
    await assertCompleteLabelSet(page, 'labels');
    await assertActorConnectors(page);
    // I2-2: the always-visible roster carries every actor's first layer (mobile/200%/bounded equivalent).
    await expect(page.locator('[data-actor-roster]')).toHaveCount(8);
    // A3-1: the current Team fact is in the first layer — on every production label and in the roster.
    await expect(page.locator('.living-office-actor-label--production [data-actor-summary-field="advisorTeam"]').first()).toBeVisible();
    await expect(page.locator('[data-actor-roster-field="advisorTeam"]')).toHaveCount(8);
    // I2-4: the semantic Channy state tracks the animating canvas across ambient states (not stuck at STOP).
    await assertChannySemanticParity(page);

    await page.emulateMedia({ forcedColors: 'active' });
    await expectFullSurfaceAxeClean(page, 'forced-colors');
    await page.emulateMedia({ forcedColors: 'none' });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await expectNoHorizontalOverflow(page);
    // A4-1: at high text the production surface switches to the explicit, complete roster-equivalent mode
    // (production-observable, marked in the DOM) — no partial on-canvas labels — so the Office stays
    // primary; A4-2: exactly one complete roster row (incl. Team) for every visible actor.
    await assertRosterEquivalentMode(page);
    await expect(page.locator('[data-actor-roster]')).toHaveCount(8);
    await expect(page.locator('[data-actor-roster-field="advisorTeam"]')).toHaveCount(8);
    await expectFullSurfaceAxeClean(page, '200% text');
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    // A4-1: the exact all-label predicate holds again when the text scale returns to normal.
    await assertCompleteLabelSet(page, 'labels');
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
    // I2-2 mobile: the dense on-canvas facts labels are hidden (no Office occlusion); every actor's
    // first layer remains present + readable in the always-visible roster.
    await expect(page.locator('.living-office-actor-label--production:visible')).toHaveCount(0);
    await expect(page.locator('[data-actor-roster]')).toHaveCount(8);
    // A3-1/A3-2 #6: the mobile roster equivalent keeps every actor's Team fact present and readable.
    await expect(page.locator('[data-actor-roster-field="advisorTeam"]')).toHaveCount(8);
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
    // I2-1: the HUD badge reports the static fallback truthfully (DOM_STATIC, never WEBGL).
    await expect(page.locator('.living-office-hud__badges span[data-backend]')).toHaveAttribute('data-backend', 'DOM_STATIC');
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

async function authenticate(page: Page, proof: string, beforeLogin?: () => Promise<void>): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.runtime-boundary')).toContainText('LOGIN_REQUIRED');
  await expect(page.getByLabel('일회용 인증 증명')).toBeVisible();
  await page.getByLabel('일회용 인증 증명').fill(proof);
  // Optional pre-login side effect (e.g. set high text) so the office mounts in that state.
  if (beforeLogin !== undefined) await beforeLogin();
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
  await expect(page.locator('.pixel-world-viewport'))
    .toHaveAttribute('data-pixel-renderer-status', 'PIXEL_READY');
  await expect(page.locator('.pixel-world-viewport')).toHaveAttribute('data-pixel-backend', /WEBGL|CANVAS/u);
  // Live-canvas presence, initialized dimensions, direct color-diversity non-blank proof, and blank-fill
  // compression separation — decoupled from the DOM label overlay (hidden on mobile per I2-2) and proven
  // in a way a blank canvas cannot pass, not a byte threshold alone. See assertOfficeCanvasNonblank.
  await assertOfficeCanvasNonblank(page);
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

/** I2-2: every visible production label fact/source is >=10px and no descendant overflows its card. */
async function assertReadableProductionLabels(page: Page): Promise<void> {
  const measures = await page.locator('.living-office-actor-label--production:visible').evaluateAll((labels) =>
    labels.map((label) => {
      const box = label.getBoundingClientRect();
      const texts = [...label.querySelectorAll('.living-office-actor-label__field, .living-office-actor-label__facts small')];
      const fontSizes = texts.map((node) => Number.parseFloat(getComputedStyle(node).fontSize));
      const overflows = [...label.querySelectorAll('*')].some((child) => {
        const rect = child.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false; // display:none / empty node
        // Content clipped by an overflow:hidden/clip ancestor (a single-line ellipsised fact) is
        // visually contained, not a visible overflow — only unclipped descendants can spill the card.
        for (let ancestor = child.parentElement; ancestor !== null && ancestor !== label; ancestor = ancestor.parentElement) {
          const { overflowX, overflowY } = getComputedStyle(ancestor);
          if (overflowX === 'hidden' || overflowY === 'hidden' || overflowX === 'clip' || overflowY === 'clip') {
            return false;
          }
        }
        return rect.right > box.right + 1 || rect.bottom > box.bottom + 1
          || rect.left < box.left - 1 || rect.top < box.top - 1;
      });
      return { minFont: fontSizes.length === 0 ? 99 : Math.min(...fontSizes), fieldCount: texts.length, overflows };
    }));
  expect(measures.length, 'at least one production label visible').toBeGreaterThan(0);
  for (const measure of measures) {
    expect(measure.fieldCount, 'label carries its compact fact/source text').toBeGreaterThan(0);
    expect(measure.minFont, 'label fact/source font size (px)').toBeGreaterThanOrEqual(10);
    expect(measure.overflows, 'no label descendant overflows its card').toBe(false);
  }
}

/**
 * A3-2: the production labels must be secondary to the Office world — not a wall of cards. Measure the
 * fraction of the live office viewport covered by the union of the on-canvas label rectangles. The
 * pre-A3-2 tall-opaque-card composition (`1187b9a`) covered ~28% of the viewport; the compact
 * two-column recomposition covers ~17%. A rectangle-overlap test alone is not product closure — this
 * gate fails the old composition and passes the corrected, Office-first one.
 */
async function assertOfficeIsPrimary(page: Page): Promise<void> {
  const coverage = await page.evaluate(() => {
    const viewport = document.querySelector('.pixel-world-viewport')?.getBoundingClientRect();
    if (viewport === undefined) return -1;
    const labels = [...document.querySelectorAll('.living-office-actor-label--production')]
      .filter((element) => getComputedStyle(element as HTMLElement).display !== 'none')
      .map((element) => element.getBoundingClientRect());
    const step = 4;
    let covered = 0;
    let total = 0;
    for (let y = viewport.top; y < viewport.bottom; y += step) {
      for (let x = viewport.left; x < viewport.right; x += step) {
        total += 1;
        if (labels.some((r) => x >= r.left && x < r.right && y >= r.top && y < r.bottom)) covered += 1;
      }
    }
    return total === 0 ? -1 : (covered / total) * 100;
  });
  expect(coverage, 'labels are present over the office viewport').toBeGreaterThan(0);
  expect(
    coverage,
    `Office label coverage ${coverage.toFixed(1)}% must stay well below the pre-A3-2 wall-of-cards (~28%) so the world is primary`,
  ).toBeLessThanOrEqual(22);
}

/**
 * A4-2: bind the desktop gate to the exact visible production actor set with one *shared, reusable*
 * combined predicate (exact per-actor cardinality + nine fields + per-fact source + Team, AND union label
 * coverage within the Office-primary bound). The positive gate asserts the predicate holds; the negative
 * challenge hides exactly ONE label and asserts the SAME combined predicate becomes false even though
 * union coverage alone stays <=22% (coverage is never sufficient by itself); then restores it and proves
 * the predicate holds again. Hide → evaluate → restore happens in one browser evaluate to avoid races.
 */
async function assertCompleteLabelSet(page: Page, mode: 'labels'): Promise<void> {
  await expect(page.locator(`.living-office-actor-overlay[data-office-label-mode="${mode}"]`)).toHaveCount(1);
  const result = await page.evaluate(() => {
    const predicate = () => {
      const overlay = document.querySelector('.living-office-actor-overlay');
      const expected = Number(overlay?.getAttribute('data-actor-label-count') ?? -1);
      const labels = [...document.querySelectorAll('.living-office-actor-label--production')].filter((element) => {
        const node = element as HTMLElement;
        return getComputedStyle(node).display !== 'none' && node.offsetParent !== null && !node.hasAttribute('hidden');
      });
      const ids = new Set(labels.map((element) => element.getAttribute('data-actor-label')));
      const cardinalityOk = expected > 0 && labels.length === expected && ids.size === expected;
      const fieldsOk = labels.length > 0 && labels.every((element) =>
        element.querySelectorAll('[data-actor-summary-field]').length === 9
        && element.querySelectorAll('[data-actor-fact-source]').length >= 7
        && element.querySelector('[data-actor-summary-field="advisorTeam"]') !== null);
      const viewport = document.querySelector('.pixel-world-viewport');
      let coverage = -1;
      if (viewport !== null) {
        const box = viewport.getBoundingClientRect();
        const rects = labels.map((element) => element.getBoundingClientRect());
        let covered = 0;
        let total = 0;
        for (let y = box.top; y < box.bottom; y += 6) {
          for (let x = box.left; x < box.right; x += 6) {
            total += 1;
            if (rects.some((r) => x >= r.left && x < r.right && y >= r.top && y < r.bottom)) covered += 1;
          }
        }
        coverage = total === 0 ? -1 : (covered / total) * 100;
      }
      const coverageOk = coverage >= 0 && coverage <= 22;
      return { valid: cardinalityOk && fieldsOk && coverageOk, cardinalityOk, fieldsOk, coverage, expected, visible: labels.length };
    };
    const positive = predicate();
    const all = [...document.querySelectorAll('.living-office-actor-label--production')].map((element) => element as HTMLElement);
    const one = all[0];
    // The base label carries `display: grid !important`, so an inline !important is needed to hide one.
    if (one !== undefined) one.style.setProperty('display', 'none', 'important');
    const hidden = predicate();
    if (one !== undefined) one.style.removeProperty('display');
    const restored = predicate();
    return { positive, hidden, restored };
  });
  // Positive: exactly one nine-field, sourced, Team-bearing label per expected actor within the bound.
  expect(result.positive.expected, 'data-actor-label-count contract present').toBeGreaterThan(0);
  expect(result.positive.cardinalityOk, 'exactly one visible in-viewport label per expected actor').toBe(true);
  expect(result.positive.fieldsOk, 'nine fields + per-fact source + Team on every label').toBe(true);
  expect(result.positive.valid, 'the combined complete-set predicate holds').toBe(true);
  // Negative: hiding exactly one label fails the SAME combined predicate, though coverage alone still <=22%.
  expect(result.hidden.visible, 'exactly one label was hidden').toBe(result.positive.expected - 1);
  expect(result.hidden.coverage, 'union coverage alone remains within the Office-primary bound').toBeLessThanOrEqual(22);
  expect(result.hidden.valid, 'the combined predicate is false with a label hidden (coverage alone insufficient)').toBe(false);
  // Restore: the same combined predicate holds again.
  expect(result.restored.valid, 'the combined predicate holds again after restoring the label').toBe(true);
}

/**
 * A4-1: at high text the production surface is in the explicit, production-observable roster-equivalent
 * mode — the DOM marker is set, there are zero partial on-canvas labels, and the always-visible roster
 * is the complete first layer: exact set equality with the expected actor set, one row per actor, each
 * with role, display name, all seven mapped compact facts (incl. Team), and a non-empty source per fact.
 */
async function assertRosterEquivalentMode(page: Page): Promise<void> {
  await expect(page.locator('.living-office-actor-overlay[data-office-label-mode="roster-equivalent"]')).toHaveCount(1);
  const result = await page.evaluate(() => {
    const overlay = document.querySelector('.living-office-actor-overlay');
    const mode = overlay?.getAttribute('data-office-label-mode') ?? '';
    const expectedIds = [...document.querySelectorAll('.living-office-actor-label--production')]
      .map((element) => element.getAttribute('data-actor-label'))
      .filter((id): id is string => id !== null);
    const visibleLabels = [...document.querySelectorAll('.living-office-actor-label--production')].filter((element) => {
      const node = element as HTMLElement;
      return getComputedStyle(node).display !== 'none' && node.offsetParent !== null;
    }).length;
    const rows = [...document.querySelectorAll('[data-actor-roster]')];
    const rosterIds = rows.map((row) => row.getAttribute('data-actor-roster')).filter((id): id is string => id !== null);
    const perRow = rows.map((row) => {
      const fields = [...row.querySelectorAll('[data-actor-roster-field]')];
      return {
        id: row.getAttribute('data-actor-roster'),
        hasRole: row.querySelector('.living-office-semantic__roster-role') !== null,
        hasName: row.querySelector('strong') !== null,
        fieldCount: fields.length,
        hasTeam: row.querySelector('[data-actor-roster-field="advisorTeam"]') !== null,
        sourcedFields: fields.filter((field) => (field.getAttribute('data-actor-fact-source') ?? '') !== '').length,
      };
    });
    return { mode, expectedIds, visibleLabels, rosterIds, perRow };
  });
  expect(result.mode, 'explicit roster-equivalent DOM marker').toBe('roster-equivalent');
  expect(result.visibleLabels, 'zero partial on-canvas labels').toBe(0);
  expect(result.expectedIds.length, 'expected actor set is non-empty').toBeGreaterThan(0);
  expect([...result.rosterIds].sort(), 'roster ids exactly equal the expected visible actor ids')
    .toEqual([...result.expectedIds].sort());
  expect(new Set(result.rosterIds).size, 'exactly one roster row per actor').toBe(result.expectedIds.length);
  for (const row of result.perRow) {
    expect(row.hasRole, `roster row ${row.id} states its role`).toBe(true);
    expect(row.hasName, `roster row ${row.id} states its stable display name`).toBe(true);
    expect(row.fieldCount, `roster row ${row.id} has all seven mapped compact facts`).toBe(7);
    expect(row.hasTeam, `roster row ${row.id} includes the Team fact`).toBe(true);
    expect(row.sourcedFields, `roster row ${row.id} has a source for every mapped fact`).toBe(7);
  }
}

/** I2-2 #2: the displaced production labels must not overlap each other (a >1px rectangle intersection). */
async function assertNoProductionLabelOverlap(page: Page): Promise<void> {
  const overlaps = await page.locator('.living-office-actor-label--production:visible').evaluateAll((labels) => {
    const rects = labels.map((label) => label.getBoundingClientRect());
    const collisions: string[] = [];
    rects.forEach((a, i) => {
      rects.slice(i + 1).forEach((b, offset) => {
        const overlapWidth = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapHeight = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlapWidth > 1 && overlapHeight > 1) collisions.push(`${i}x${i + 1 + offset}`);
      });
    });
    return { count: rects.length, collisions };
  });
  expect(overlaps.count, 'production labels are present to check for overlap').toBeGreaterThan(0);
  expect(overlaps.collisions, 'production actor labels must not overlap each other (I2-2 #2)').toEqual([]);
}

/** I2-2: every displaced production label is joined to its actor anchor by a connector line. */
async function assertActorConnectors(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const overlay = document.querySelector('.living-office-actor-overlay');
    if (overlay === null) return { labels: 0, displacedWithoutConnector: 1 };
    const overlayRect = overlay.getBoundingClientRect();
    const connectors = new Set(
      [...document.querySelectorAll('.living-office-actor-overlay__connectors line')]
        .map((line) => line.getAttribute('data-connector-for')),
    );
    let displacedWithoutConnector = 0;
    const labels = [...document.querySelectorAll('.living-office-actor-label--production')]
      .filter((label) => !(label as HTMLElement).hidden) as HTMLElement[];
    for (const label of labels) {
      const rect = label.getBoundingClientRect();
      const anchorX = overlayRect.left + Number(label.dataset.anchorX);
      const anchorY = overlayRect.top + Number(label.dataset.anchorY);
      const nearX = rect.left + Math.min(rect.width, 96) / 2;
      const nearY = rect.top + 12;
      const distance = Math.hypot(nearX - anchorX, nearY - anchorY);
      if (distance > 96 && !connectors.has(label.dataset.actorLabel ?? '')) displacedWithoutConnector += 1;
    }
    return { labels: labels.length, displacedWithoutConnector };
  });
  expect(result.labels, 'production labels present').toBeGreaterThan(0);
  expect(result.displacedWithoutConnector, 'every displaced label has a connector to its actor').toBe(0);
}

/** I2-4: the semantic mirror's Channy state changes over time in parity with the animating canvas. */
async function assertChannySemanticParity(page: Page): Promise<void> {
  const channy = page.locator('.living-office-semantic__channy');
  const states = new Set<string>();
  for (let sample = 0; sample < 5; sample += 1) {
    const text = (await channy.textContent()) ?? '';
    const match = /Channy\s*:\s*([A-Z_]+)/u.exec(text);
    if (match?.[1] !== undefined) states.add(match[1]);
    if (sample < 4) await page.waitForTimeout(2600);
  }
  expect(states.size, `semantic Channy ambient states observed: ${[...states].join(',')}`).toBeGreaterThanOrEqual(2);
}
