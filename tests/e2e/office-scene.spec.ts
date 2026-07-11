import { expect, test, type Locator, type Page } from '@playwright/test';

test.describe('Batch C deterministic office scene', () => {
  test('matches the 1440x900 desktop visual baseline', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openFixture(page, 'activity');
    await expect(page).toHaveScreenshot('office-desktop-1440x900.png', {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.005,
    });
  });

  test('matches the 390x844 mobile visual baseline with intentional pagination', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openFixture(page, 'safety');
    await expect(page.locator('.scene-station:visible')).toHaveCount(2);
    await expect(page).toHaveScreenshot('office-mobile-390x844.png', {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.005,
    });
  });

  test('matches the reduced-motion baseline and removes spatial cues', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFixture(page, 'delivery');
    await expect(page.locator('.scene-route-layer')).toHaveCSS('display', 'none');
    await expect(page).toHaveScreenshot('office-reduced-motion-1440x900.png', {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.005,
    });
  });

  test('keeps every desktop station inside the scene with no pair overlap', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openFixture(page, 'activity');
    const floor = await requiredBox(page.locator('.office-floor'));
    const stations = page.locator('.scene-station:visible');
    await expect(stations).toHaveCount(8);
    const boxes = await Promise.all(
      Array.from({ length: 8 }, (_, index) => requiredBox(stations.nth(index))),
    );
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(floor.x);
      expect(box.y).toBeGreaterThanOrEqual(floor.y);
      expect(box.x + box.width).toBeLessThanOrEqual(floor.x + floor.width + 0.5);
      expect(box.y + box.height).toBeLessThanOrEqual(floor.y + floor.height + 0.5);
    }
    for (let left = 0; left < boxes.length; left += 1) {
      for (let right = left + 1; right < boxes.length; right += 1) {
        const leftBox = boxes[left];
        const rightBox = boxes[right];
        if (leftBox === undefined || rightBox === undefined) throw new Error('station box missing');
        expect(overlapArea(leftBox, rightBox)).toBe(0);
      }
    }
  });

  test('keeps the medium tablet scene stable and unpaginated', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await openFixture(page, 'activity');
    await assertNoPageOverflow(page);
    const floor = await requiredBox(page.locator('.office-floor'));
    const stations = page.locator('.scene-station:visible');
    await expect(stations).toHaveCount(8);
    for (let index = 0; index < 8; index += 1) {
      const box = await requiredBox(stations.nth(index));
      expect(box.x).toBeGreaterThanOrEqual(floor.x);
      expect(box.y).toBeGreaterThanOrEqual(floor.y);
      expect(box.x + box.width).toBeLessThanOrEqual(floor.x + floor.width + 0.5);
      expect(box.y + box.height).toBeLessThanOrEqual(floor.y + floor.height + 0.5);
    }
  });

  test('reflows at 320px, 200 percent text, and mobile landscape without horizontal loss', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await openFixture(page, 'safety');
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await page.locator('.scene-selected-detail .mono').first().evaluate((element) => {
      element.textContent = '매우 긴 한국어 구조화 상태와 증거 포인터 '.repeat(24);
    });
    await assertNoPageOverflow(page);
    await expect(page.locator('.scene-mobile-pagination button')).toHaveCount(2);
    await expect(page.locator('.scene-station:visible')).toHaveCount(2);

    await page.setViewportSize({ width: 844, height: 390 });
    await assertNoPageOverflow(page);
    await expect(page.locator('.scene-station:visible')).toHaveCount(2);
  });

  test('renders safety states immediately with text, icon, shape, and exact destinations', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openFixture(page, 'safety');
    const waitingLeo = page.locator('[data-station-id="agent-office"]');
    const blocked = page.locator('[data-station-id="foundation"]');
    const needsPatch = page.locator('[data-station-id="fable5"]');
    await expect(waitingLeo).toHaveAttribute('data-state', 'WAITING_LEO');
    await expect(waitingLeo).toContainText('DECISION-AO-WU-09 -> LEO_OFFICE');
    await expect(waitingLeo.locator('.scene-state-shape')).toHaveCount(1);
    await expect(page.locator('[data-station-id="leo"]')).toContainText('LEO_DECISION_DOCUMENT_RECEIVED');
    await expect(blocked).toHaveAttribute('data-state', 'BLOCKED');
    await expect(blocked).toContainText('VERIFIED_POINTER_REQUIRED');
    await expect(needsPatch).toHaveAttribute('data-state', 'NEEDS_PATCH');
    await expect(needsPatch).toContainText('FABLE5_CORRECTION -> AGENT_OFFICE_WORKER');
  });

  test('provides 44px controls and visible keyboard focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openFixture(page, 'current');
    const controls = page.locator('#office-scene button:visible, #office-scene select:visible');
    const count = await controls.count();
    for (let index = 0; index < count; index += 1) {
      const box = await requiredBox(controls.nth(index));
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.locator('[data-scene-station="cosmile"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-scene-station="agent-office"]')).toBeFocused();
    await expect(page.locator('[data-scene-station="agent-office"]')).toHaveCSS('outline-style', 'solid');
  });
});

async function openFixture(page: Page, fixtureId: string): Promise<void> {
  await page.goto('/');
  await page.getByLabel('구조화 이벤트 장면').selectOption(fixtureId);
  await expect(page.locator('#office-scene')).toHaveAttribute('data-motion', /on|off/u);
}

async function requiredBox(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('required element has no bounding box');
  return box;
}

function overlapArea(
  left: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  right: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): number {
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  return width * height;
}

async function assertNoPageOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}
