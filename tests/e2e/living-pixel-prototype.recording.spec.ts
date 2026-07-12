import { chmod, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const ARTIFACT_ROOT = '/home/leo/Project/agent-office/artifacts/m1-2-visual-prototype';
const WEBM_PATH = path.join(ARTIFACT_ROOT, 'agent-office-living-office-prototype.webm');
const enabled = process.env.AGENT_OFFICE_PIXEL_PROTOTYPE === '1';

test.skip(!enabled, 'living pixel prototype uses its exact dedicated Playwright config');

test('records the actual continuous 26-second loopback prototype with precise screencast start and stop', async ({ page }) => {
  test.setTimeout(45_000);
  await mkdir(ARTIFACT_ROOT, { recursive: true, mode: 0o700 });
  await chmod(ARTIFACT_ROOT, 0o700);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?surface=living-pixel-prototype&autoplay=0');
  await page.evaluate(async () => document.fonts.ready);
  await expect(page.locator('[data-pixel-canvas]')).toHaveCount(1);
  await expect(page.locator('#living-pixel-prototype')).toHaveAttribute('data-prototype-complete', 'false');

  await page.screencast.start({
    path: WEBM_PATH,
    size: { width: 1440, height: 900 },
    quality: 90,
  });
  await page.getByRole('button', { name: 'Replay 26-second office tour' }).click();
  await expect(page.locator('#living-pixel-prototype')).toHaveAttribute(
    'data-prototype-complete',
    'true',
    { timeout: 29_000 },
  );
  await page.waitForTimeout(250);
  await page.screencast.stop();

  const evidence = await stat(WEBM_PATH);
  expect(evidence.isFile()).toBe(true);
  expect(evidence.size).toBeGreaterThan(100_000);
  await expect(page.locator('[data-pixel-canvas]')).toHaveCount(1);
  await expect(page.getByText(/Synthetic fixture only/u)).toBeAttached();
});
