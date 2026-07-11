import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

test.describe('Batch D Advisor communication center', () => {
  test('keeps the Advisor-only compose boundary and durable stages visible', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openCenter(page);
    await expect(page.getByLabel('영속 요청 ID')).toContainText('018f0000-0000-7000-8000-00000000d001');
    await expect(page.getByText('Advisor 수동 전달 필요')).toBeVisible();
    await expect(page.locator('.message-timeline')).toContainText('PERSISTED');
    await expect(page.locator('.message-timeline')).toContainText('DELIVERY_PENDING');
    await expect(page.locator('.message-timeline')).toContainText('MANUAL_FALLBACK_REQUIRED');
    await expect(page.getByRole('button', { name: 'Advisor 메시지 영속 저장' })).toBeDisabled();
    await expect(page.locator('#communication-center')).not.toContainText(/Worker target|Reviewer target|session name|pane target/iu);
    await expect(page.locator('#communication-center input')).toHaveCount(2);
    await expect(page.locator('#communication-center textarea')).toHaveCount(1);
  });

  test('persists critical alert visibility across Inbox and Alerts views', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await openCenter(page);
    const critical = page.locator('.critical-alert-strip');
    await expect(critical).toContainText('Synthetic critical alert boundary fixture');
    await page.getByRole('tab', { name: /Alerts/u }).click();
    await expect(critical).toBeVisible();
    await expect(page.getByRole('button', { name: '경고 확인' }).first()).toBeDisabled();
    await expect(page.getByRole('button', { name: '증거로 해결' }).first()).toBeDisabled();
    await page.getByRole('button', { name: '미션 일시정지' }).click();
    await expect(page.getByRole('tab', { name: /Inbox/u })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('메시지 종류')).toHaveValue('PAUSE');
    await expect(critical).toBeVisible();
  });

  test('reflows at 390 and 320 pixels with 44 pixel controls and no horizontal loss', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openCenter(page);
    await assertNoPageOverflow(page);
    await assertControlsAtLeast44(page.locator('#communication-center button, #communication-center input, #communication-center select, #communication-center textarea'));

    await page.setViewportSize({ width: 320, height: 844 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await page.locator('#communication-center').scrollIntoViewIfNeeded();
    await assertNoPageOverflow(page);
    await expect(page.getByRole('button', { name: 'Advisor 메시지 영속 저장' })).toBeVisible();
  });

  test('keeps the center usable in mobile landscape without hidden alert actions', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await openCenter(page);
    await page.getByRole('tab', { name: /Alerts/u }).click();
    await expect(page.getByRole('button', { name: 'GPT 패키지 복사' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Advisor에게 답장' }).first()).toBeVisible();
    await assertNoPageOverflow(page);
  });

  test('keeps Inbox and Alerts keyboard-visible and WCAG A/AA clean', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openCenter(page);
    const subject = page.getByLabel('제목');
    await subject.focus();
    await expect(subject).toHaveCSS('outline-style', 'solid');
    await page.getByRole('tab', { name: /Alerts/u }).click();
    const results = await new AxeBuilder({ page })
      .include('#communication-center')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

async function openCenter(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('#communication-center').scrollIntoViewIfNeeded();
  await expect(page.locator('#communication-center')).toBeVisible();
}

async function assertControlsAtLeast44(locator: Locator): Promise<void> {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const box = await locator.nth(index).boundingBox();
    if (box === null) throw new Error('communication control has no box');
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
}

async function assertNoPageOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}
