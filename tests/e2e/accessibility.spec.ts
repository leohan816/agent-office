import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Batch C office accessibility', () => {
  test('has no automatic WCAG A/AA violations in current and safety scenes', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    for (const fixture of ['current', 'safety']) {
      await page.getByLabel('구조화 이벤트 장면').selectOption(fixture);
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(result.violations, `${fixture} accessibility violations`).toEqual([]);
    }
  });

  test('exposes ordinary and critical live regions without repeated initial alerts', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[aria-live="polite"][aria-atomic="true"]')).toHaveText('');
    await expect(page.locator('[role="alert"]')).toHaveText('');
    await page.getByLabel('구조화 이벤트 장면').selectOption('safety');
    await expect(page.locator('[aria-live="polite"][aria-atomic="true"]')).toContainText('구조화 이벤트 장면으로 변경됨');
    await expect(page.locator('[role="alert"]')).toContainText('차단 또는 중요 경고');
  });
});
