import { expect, test, type Page } from '@playwright/test';

test.describe('AO12-C evidence-backed spatial motion', () => {
  test('keeps default M1 and AO12-B explicit static selection unchanged', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#office-scene')).toHaveCount(1);
    await expect(page.locator('#spatial-office')).toHaveCount(0);
    await page.goto('/?surface=spatial-static');
    await expect(page.locator('#spatial-office')).toHaveAttribute('data-fixture-kind', 'SYNTHETIC_NON_OPERATIONAL_STATIC');
    await expect(page.locator('#spatial-office')).toHaveAttribute('data-motion-tier', 'STATIC');
    await expect(page.locator('[data-motion-cue]')).toHaveCount(0);
  });

  test('matches the deterministic frozen full-motion desktop frame', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openMotionFixture(page, 'freeze=0.5');
    await expect(page.locator('[data-motion-cue]')).toHaveCount(1);
    await expect(page.locator('[data-route-pair="actor-document"]')).toHaveCount(1);
    await expect(page.locator('[data-operational-pose]')).toHaveCount(3);
    await expect(page.getByRole('log').locator('li')).toHaveCount(3);
    await expect(page).toHaveScreenshot('spatial-motion-full-desktop-1440x900.png', screenshotOptions());
  });

  test('matches restrained one-cue presentation with the same structured log', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openMotionFixture(page, 'tier=restrained&freeze=0.5');
    await expect(page.locator('#spatial-office')).toHaveAttribute('data-motion-tier', 'RESTRAINED');
    await expect(page.locator('[data-operational-pose]')).toHaveCount(1);
    await expect(page.getByRole('log').locator('li')).toHaveCount(3);
    await expect(page).toHaveScreenshot('spatial-motion-restrained-desktop-1440x900.png', screenshotOptions());
  });

  test('matches reduced-motion static equivalence with no animation object', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openMotionFixture(page, 'freeze=0.5');
    await expect(page.locator('#spatial-office')).toHaveAttribute('data-motion-tier', 'STATIC');
    await expect(page.locator('[data-motion-cue]')).toHaveCount(0);
    await expect(page.locator('[data-route-static-equivalent="TIER_STATIC"]')).toHaveCount(1);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await expect(page.getByRole('log').locator('li')).toHaveCount(3);
    await expect(page).toHaveScreenshot('spatial-motion-reduced-static-1440x900.png', screenshotOptions());
  });

  test('matches tablet containment with both Team areas recognizable', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await openMotionFixture(page, 'freeze=0.5');
    await expect(page.locator('.spatial-team-pod')).toHaveCount(2);
    await expect(page.locator('.spatial-team-pod[data-selected="false"]')).toBeVisible();
    await assertNoPageOverflow(page);
    await expect(page).toHaveScreenshot('spatial-motion-tablet-1024x768.png', screenshotOptions());
  });

  test('selection and orientation cancel cues without delayed replay or focus movement', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await openMotionFixture(page, 'freeze=0.5');
    const secondPod = page.locator('.spatial-pod-control').nth(1);
    await secondPod.focus();
    await secondPod.click();
    await expect(secondPod).toBeFocused();
    await expect(page.locator('[data-motion-cue]')).toHaveCount(0);
    const firstPod = page.locator('.spatial-pod-control').first();
    await firstPod.click();
    await expect(page.locator('[data-motion-cue]')).toHaveCount(0);

    await page.goto('/?surface=spatial-motion');
    await expect(page.locator('[data-motion-cue]')).toHaveCount(1);
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('[data-motion-cue]')).toHaveCount(0);
  });

  test('finishes every bounded cue without event, route, or perpetual task state', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openMotionFixture(page);
    await expect(page.locator('[data-operational-pose]')).toHaveCount(3);
    await expect(page.locator('[data-operational-pose]')).toHaveCount(0, { timeout: 2500 });
    await expect(page.locator('[data-motion-cue]')).toHaveCount(0);
    await expect(page.getByRole('log').locator('li')).toHaveCount(3);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test('measures active-frame, long-task, heap-cycle, DOM, SVG, and teardown budgets', async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openMotionFixture(page);
    const browserMeasurement = await page.evaluate(async () => {
      const longTasks: number[] = [];
      let longTaskObserverSupported = true;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longTasks.push(entry.duration);
      });
      try {
        observer.observe({ type: 'longtask', buffered: false });
      } catch {
        longTaskObserverSupported = false;
      }
      const frameWork: number[] = [];
      const endAt = performance.now() + 10_000;
      await new Promise<void>((resolve) => {
        const sample = () => {
          const start = performance.now();
          document.querySelectorAll('[data-motion-cue], [data-operational-pose], [role="log"] li').forEach((element) => {
            void getComputedStyle(element).transform;
          });
          frameWork.push(performance.now() - start);
          if (performance.now() >= endAt) resolve();
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      observer.disconnect();
      const sorted = [...frameWork].sort((left, right) => left - right);
      const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
      return {
        frameSamples: frameWork.length,
        longTaskObserverSupported,
        activeFrameP95Ms: sorted[index] ?? Number.POSITIVE_INFINITY,
        maxLongTaskMs: Math.max(0, ...longTasks),
        longTaskCount: longTasks.length,
        domNodes: document.querySelectorAll('#spatial-office *').length,
        svgElements: document.querySelectorAll('#spatial-office svg, #spatial-office svg *').length,
      };
    });

    const cdp = await context.newCDPSession(page);
    const desktopSwitchSamples = await measurePodSwitches(page, 30);
    const desktopPodSwitchP95Ms = percentile95(desktopSwitchSamples);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const constrainedSwitchSamples = await measurePodSwitches(page, 20);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const constrainedPodSwitchP95Ms = percentile95(constrainedSwitchSamples);
    await cdp.send('HeapProfiler.collectGarbage');
    const before = await cdp.send('Runtime.getHeapUsage');
    const controls = page.locator('.spatial-pod-control');
    for (let cycle = 0; cycle < 20; cycle += 1) {
      await controls.nth(cycle % 2).click();
    }
    await cdp.send('HeapProfiler.collectGarbage');
    const after = await cdp.send('Runtime.getHeapUsage');
    const heapGrowthBytes = Math.max(0, after.usedSize - before.usedSize);
    const report = {
      schemaVersion: 'agent-office.ao12-c-browser-benchmark.v1',
      browser: 'configured-playwright-chromium',
      viewport: '1440x900',
      scriptedDurationMs: 10_000,
      percentileMethod: 'nearest-rank-sorted-ceil-0.95n-minus-1',
      ...browserMeasurement,
      desktopPodSwitchSamples: desktopSwitchSamples.length,
      desktopPodSwitchP95Ms,
      constrainedProfile: 'Chromium CDP 4x CPU throttling',
      constrainedPodSwitchSamples: constrainedSwitchSamples.length,
      constrainedPodSwitchP95Ms,
      heapCycles: 20,
      heapMethod: 'chromium-cdp-collectGarbage-Runtime.getHeapUsage',
      heapGrowthBytes,
    };
    console.info(`AO12_C_BROWSER_BENCHMARK ${JSON.stringify(report)}`);
    expect(browserMeasurement.activeFrameP95Ms).toBeLessThanOrEqual(8);
    expect(browserMeasurement.longTaskObserverSupported).toBe(true);
    expect(browserMeasurement.maxLongTaskMs).toBeLessThanOrEqual(50);
    expect(desktopPodSwitchP95Ms).toBeLessThanOrEqual(100);
    expect(constrainedPodSwitchP95Ms).toBeLessThanOrEqual(200);
    expect(browserMeasurement.domNodes).toBeLessThanOrEqual(1600);
    expect(browserMeasurement.svgElements).toBeLessThanOrEqual(800);
    expect(heapGrowthBytes).toBeLessThanOrEqual(25 * 1024 * 1024);

    await page.goto('/');
    await expect(page.locator('[data-motion-cue], [data-operational-pose]')).toHaveCount(0);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await cdp.detach();
  });
});

async function openMotionFixture(page: Page, parameters = ''): Promise<void> {
  const suffix = parameters.length === 0 ? '' : `&${parameters}`;
  await page.goto(`/?surface=spatial-motion${suffix}`);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page.locator('#spatial-office')).toHaveAttribute('data-fixture-kind', 'SYNTHETIC_STRUCTURED_EVENT_MOTION');
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

async function measurePodSwitches(page: Page, count: number): Promise<readonly number[]> {
  return page.evaluate(async (sampleCount) => {
    const controls = [...document.querySelectorAll<HTMLButtonElement>('.spatial-pod-control')];
    if (controls.length < 2) throw new TypeError('pod switch benchmark controls missing');
    const samples: number[] = [];
    for (let index = 0; index < sampleCount; index += 1) {
      const control = controls[index % controls.length];
      if (control === undefined) throw new TypeError('pod switch benchmark control missing');
      const start = performance.now();
      control.click();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (control.getAttribute('aria-current') !== 'true') {
        throw new TypeError('pod switch did not commit before the measured frame');
      }
      samples.push(performance.now() - start);
    }
    return samples;
  }, count);
}

function percentile95(samples: readonly number[]): number {
  const sorted = [...samples].sort((left, right) => left - right);
  const value = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
  if (value === undefined) throw new TypeError('pod switch percentile sample missing');
  return value;
}
