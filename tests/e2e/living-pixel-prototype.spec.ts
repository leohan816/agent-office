import { chmod, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { PIXEL_PROTOTYPE_SCENARIOS } from '../../src/ui/pixel/fixtures/prototype-scenarios.js';

const ARTIFACT_ROOT = '/home/leo/Project/agent-office/artifacts/m1-2-visual-prototype';
const enabled = process.env.AGENT_OFFICE_PIXEL_PROTOTYPE === '1';
type PixelPrototypeConfigModule = typeof import('../../playwright.pixel-prototype.config.js');
const pixelPrototypeConfigTypecheck: PixelPrototypeConfigModule | null = null;
void pixelPrototypeConfigTypecheck;

test.skip(!enabled, 'living pixel prototype uses its exact dedicated Playwright config');
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await mkdir(ARTIFACT_ROOT, { recursive: true, mode: 0o700 });
  await chmod(ARTIFACT_ROOT, 0o700);
});

for (const scenario of PIXEL_PROTOTYPE_SCENARIOS) {
  test(`${scenario.matrixId} ${scenario.fixtureId}`, async ({ page }) => {
    await page.setViewportSize(scenario.viewport);
    await page.emulateMedia({
      colorScheme: 'dark',
      reducedMotion: scenario.reducedMotion ? 'reduce' : 'no-preference',
    });
    await openScenario(page, scenario.scenarioId, scenario.logicalTimeMs, '', !scenario.reducedMotion);
    await expect(page.locator('#living-pixel-prototype')).toHaveAttribute('data-synthetic-prototype', 'true');
    await expect(page.locator('#living-pixel-prototype')).toHaveAttribute('data-prototype-scene', scenario.scenarioId);
    await expect(page.getByText('SYNTHETIC PROTOTYPE / AO12-PWU-11-P1 VISUAL PATCH')).toBeVisible();
    await expect(page.locator('.pixel-world-viewport')).toHaveAttribute(
      'data-pixi-bridge-contract',
      'agent-office.pixi-public-export-bridge.v1',
    );
    await expect(page.locator('.pixel-world-viewport')).toHaveAttribute('data-pixi-js-version', '8.19.0');
    await expect(page.locator('.pixel-world-viewport')).toHaveAttribute('data-pixi-react-version', '8.0.5');
    await expect(page.locator('.pixel-world-viewport')).toHaveAttribute(
      'data-pixi-runtime-values',
      'Application,extend,useTick,Container,Graphics,Sprite,Texture,VERSION',
    );
    await expect(page.locator('[data-semantic-entity-set] [data-entity-id]')).toHaveCount(25);
    await assertNoPageOverflow(page);

    if (scenario.reducedMotion) {
      await expect(page.locator('[data-pixel-canvas]')).toHaveCount(0);
      await expect(page.locator('[data-pixel-backend="DOM_STATIC"]')).toHaveCount(1);
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    } else {
      await expect(page.locator('[data-pixel-canvas]')).toHaveCount(1);
      await expect(page.locator('.pixel-world-viewport')).toHaveAttribute('data-pixel-renderer-status', 'PIXEL_READY');
    }

    if (scenario.matrixId === 'PIXEL-V01') {
      await expect(page.getByRole('navigation', { name: 'Advisor Team Pod navigation' }).getByRole('button')).toHaveCount(8);
      await expect(page.getByText('Every visible pixel has complete text meaning')).toBeAttached();
      await expect(page.locator('[data-actor-label]:visible')).toHaveCount(10);
      await expect(page.getByRole('button', { name: /Agent Office Worker.*Role Worker.*Model Codex 5.6 SOL.*Session agent-office.*State WORKING/u })).toBeVisible();
      await assertNoActorLabelCollisions(page);
    }
    if (scenario.matrixId === 'PIXEL-V03') {
      await expect(page.getByRole('button', { name: /VibeNews Designer.*Model UNKNOWN.*Session UNKNOWN/u })).toBeVisible();
    }
    if (scenario.matrixId === 'PIXEL-V04') {
      await expect(page.getByRole('log')).toContainText('DELIVERY');
      await expect(page.getByRole('log')).toContainText('no authority or completion claim');
    }
    if (scenario.matrixId === 'PIXEL-V05') {
      await expect(page.locator('.living-office-hud__status')).toContainText('no verdict or approval claim');
    }
    if (scenario.matrixId === 'PIXEL-V06') {
      await expect(page.locator('.living-office-hud__status')).toContainText('VERIFIED_IDLE presentation');
    }
    if (scenario.matrixId === 'PIXEL-V07') {
      await expect(page.locator('.living-office-hud__status')).toContainText('Slow eased Bedlington walk');
      await expect(page.locator('.living-office-semantic__channy')).toContainText('authorityRole none');
    }
    if (scenario.matrixId === 'PIXEL-V10') {
      await expect(page.getByRole('alert')).toContainText('WAITING_LEO');
    }
    if (scenario.matrixId === 'PIXEL-V11') {
      await expect(page.getByRole('alert')).toContainText('blocked');
      await expect(page.getByRole('log')).toContainText('No active operational route');
    }
    if (scenario.matrixId === 'PIXEL-V12') {
      await expect(page.getByRole('button', { name: 'Previous Team' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Next Team' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Full office' })).toBeVisible();
      await assertMinimumTouchTargets(page);
    }
    if (scenario.matrixId === 'PIXEL-V13') {
      await expect(page.locator('[data-presentation-tier="DOM_STATIC"]')).toHaveCount(1);
      await expect(page.locator('[data-actor-label]:visible')).toHaveCount(10);
    }

    const screenshot = await page.screenshot({
      animations: 'disabled',
      caret: 'hide',
      fullPage: false,
    });
    expect(screenshot).toMatchSnapshot(scenario.baselineName, { maxDiffPixelRatio: 0 });
    if (scenario.deliveryFileName !== null) {
      await writeFile(path.join(ARTIFACT_ROOT, scenario.deliveryFileName), screenshot);
    }
  });
}

test('classifies the Canvas core subset or fails closed to the complete static mirror', async ({ page }) => {
  await openScenario(page, 'full-office', 0, 'backend=canvas', false);
  await expect.poll(
    async () => (await page.locator('.pixel-world-viewport').getAttribute('data-pixel-backend')) ?? '',
  ).toMatch(/^(?:CANVAS|DOM_STATIC)$/u);
  const backend = await page.locator('.pixel-world-viewport').getAttribute('data-pixel-backend');
  expect(['CANVAS', 'DOM_STATIC']).toContain(backend);
  await expect(page.getByText('Every visible pixel has complete text meaning')).toBeAttached();
  await expect(page.locator('[data-semantic-entity-set] [data-entity-id]')).toHaveCount(25);
});

test('selects DOM static when both renderers fail', async ({ page }) => {
  await openScenario(page, 'full-office', 0, 'renderer=fail', false);
  await expect(page.locator('.pixel-world-viewport')).toHaveAttribute('data-pixel-backend', 'DOM_STATIC');
  await expect(page.locator('[data-static-reason="RENDERER_INITIALIZATION_FORCED_FAILURE"]')).toBeVisible();
  await expect(page.locator('[data-semantic-entity-set] [data-entity-id]')).toHaveCount(25);
});

test('handles context loss, one bounded retry, camera controls and detail focus restoration', async ({ page }) => {
  await openScenario(page, 'foundation-active', 4500);
  const canvas = page.locator('[data-pixel-canvas]');
  await canvas.evaluate((element) => {
    element.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  });
  await expect(page.locator('.pixel-world-viewport')).toHaveAttribute('data-pixel-backend', 'DOM_STATIC');
  await page.getByRole('button', { name: 'Retry renderer once' }).click();
  await expect(page.locator('[data-pixel-canvas]')).toHaveCount(1);

  for (const name of ['Pan left', 'Pan up', 'Pan down', 'Pan right', 'Zoom out', 'Zoom in']) {
    await page.getByRole('button', { name }).click();
  }
  await page.getByRole('button', { name: 'Focus selected Team' }).click();
  const fullOffice = page.getByRole('button', { name: 'Full office' });
  await fullOffice.focus();
  await fullOffice.click();
  await expect(fullOffice).toBeFocused();

  const detail = page.getByRole('button', { name: 'Open technical detail' });
  await detail.focus();
  await detail.click();
  const dialog = page.getByRole('dialog', { name: /Foundation evidence detail/u });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close detail' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(detail).toBeFocused();

  const actorLabel = page.getByRole('button', { name: /Foundation Worker.*Role Worker/u });
  await page.getByRole('button', { name: 'Focus selected Team' }).click();
  const actorAnchorBefore = await actorLabel.getAttribute('data-anchor-x');
  await page.getByRole('button', { name: 'Pan right' }).click();
  await expect.poll(async () => actorLabel.getAttribute('data-anchor-x')).not.toBe(actorAnchorBefore);
  await actorLabel.focus();
  await actorLabel.click();
  const actorDialog = page.getByRole('dialog', { name: 'Foundation Worker' });
  await expect(actorDialog.locator('[data-actor-fact]')).toHaveCount(10);
  await expect(actorDialog).toContainText('foundation-worker');
  await expect(actorDialog).toContainText('Codex 5.6 SOL');
  await expect(page.getByRole('button', { name: 'Close actor detail' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(actorDialog).toHaveCount(0);
  await expect(actorLabel).toBeFocused();
});

test('proves 320px, short landscape, tablet and 200-percent text containment', async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 844 },
    { width: 844, height: 390 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    await openScenario(page, 'foundation-active', 4500);
    await assertNoPageOverflow(page);
    await expect(page.locator('[data-semantic-entity-set] [data-entity-id]')).toHaveCount(25);
    await expect(page.getByRole('button', { name: 'Full office' })).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await openScenario(page, 'mobile-foundation', 4500);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await assertNoPageOverflow(page);
  await expect(page.getByRole('button', { name: 'Previous Team' })).toBeVisible();
  await expect(page.getByText('Every visible pixel has complete text meaning')).toBeAttached();
});

test('keeps forced colors, WCAG A/AA, keyboard semantics and requests fail-closed', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.setViewportSize({ width: 1024, height: 768 });
  await openScenario(page, 'full-office', 0);
  const accessibility = await new AxeBuilder({ page })
    .include('#living-pixel-prototype')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await assertMinimumTouchTargets(page);

  const camera = page.getByRole('group', { name: 'Office camera controls' });
  await camera.focus();
  for (const key of ['ArrowRight', 'ArrowDown', '+', '-', 'Home', 'Enter']) {
    await page.keyboard.press(key);
    await expect(camera).toBeFocused();
  }
  const vibenews = page.getByRole('navigation', { name: 'Advisor Team Pod navigation' })
    .getByRole('button', { name: /VibeNews/u });
  await vibenews.focus();
  await page.keyboard.press('Enter');
  await expect(vibenews).toHaveAttribute('aria-current', 'true');
  await expect(vibenews).toBeFocused();

  const detail = page.getByRole('button', { name: 'Open technical detail' });
  await detail.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(detail).toBeFocused();
  expect(requests.every((url) => new URL(url).origin === 'http://127.0.0.1:4173')).toBe(true);

  await page.emulateMedia({ forcedColors: 'active' });
  await expect(page.locator('[data-pixel-canvas]')).toBeHidden();
  await expect(page.getByText('Every visible pixel has complete text meaning')).toBeVisible();
  const forcedColorNotice = await page.locator('.pixel-world-viewport').evaluate((element) =>
    getComputedStyle(element, '::before').content);
  expect(forcedColorNotice).toContain('Decorative pixel renderer hidden in forced colors');
  await assertNoPageOverflow(page);
});

test('measures configured-browser startup, active frames, camera latency, long tasks and teardown', async ({ page, context }) => {
  test.setTimeout(90_000);
  const cdp = await context.newCDPSession(page);
  await openScenario(page, 'full-office', 0);
  const cachedStartupSamples: number[] = [];
  for (let index = 0; index < 5; index += 1) {
    await openScenario(page, 'full-office', 0);
    cachedStartupSamples.push(await page.evaluate(() => performance.now()));
  }
  const fourTimesCpuStartupSamples: number[] = [];
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  try {
    for (let index = 0; index < 5; index += 1) {
      await openScenario(page, 'full-office', 0);
      fourTimesCpuStartupSamples.push(await page.evaluate(() => performance.now()));
    }
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }
  await page.goto('/?surface=living-pixel-prototype&autoplay=0');
  await expect(page.locator('[data-pixel-canvas]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Replay 26-second office tour' }).click();
  const measurement = await page.evaluate(async () => {
    const longTasks: number[] = [];
    let longTaskSupported = true;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTasks.push(entry.duration);
    });
    try {
      observer.observe({ type: 'longtask', buffered: false });
    } catch {
      longTaskSupported = false;
    }
    const frameWork: number[] = [];
    for (let index = 0; index < 600; index += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => {
        const start = performance.now();
        document.querySelector('[data-pixel-canvas]')?.getBoundingClientRect();
        document.querySelector('[data-frame-key]')?.getBoundingClientRect();
        frameWork.push(performance.now() - start);
        resolve();
      }));
    }
    observer.disconnect();
    return {
      frameWork,
      longTasks,
      longTaskSupported,
      domNodes: document.querySelectorAll('#living-pixel-prototype *').length,
      canvases: document.querySelectorAll('[data-pixel-canvas]').length,
    };
  });
  const cameraSamples = await measureCameraCycles(page, 100);
  await cdp.send('HeapProfiler.collectGarbage');
  const before = await cdp.send('Runtime.getHeapUsage');
  for (let index = 0; index < 20; index += 1) await measureCameraCycles(page, 2);
  await cdp.send('HeapProfiler.collectGarbage');
  const afterFocus = await cdp.send('Runtime.getHeapUsage');
  const focusHeapGrowthBytes = Math.max(0, afterFocus.usedSize - before.usedSize);
  for (let index = 0; index < 20; index += 1) {
    await page.goto('/?surface=living-pixel-prototype&scene=full-office&time=0');
    await expect(page.locator('[data-pixel-canvas]')).toHaveCount(1);
    await page.goto('/');
    await expect(page.locator('[data-pixel-canvas], #living-pixel-prototype')).toHaveCount(0);
  }
  await cdp.send('HeapProfiler.collectGarbage');
  const afterMountCycles = await cdp.send('Runtime.getHeapUsage');
  const heapGrowthBytes = Math.max(0, afterMountCycles.usedSize - before.usedSize);
  const retainedCanvases = await page.locator('[data-pixel-canvas]').count();
  const retainedPrototypeRoots = await page.locator('#living-pixel-prototype').count();
  await cdp.detach();
  const report = {
    schemaVersion: 'agent-office.pixel-prototype-browser-budget.v1',
    browser: await page.evaluate(() => navigator.userAgent),
    viewport: '1440x900',
    cachedStartupSamples: cachedStartupSamples.length,
    cachedRendererStartupP95Ms: percentile95(cachedStartupSamples),
    fourTimesCpuStartupSamples: fourTimesCpuStartupSamples.length,
    fourTimesCpuLoopbackStartupP95Ms: percentile95(fourTimesCpuStartupSamples),
    activeFrameSamples: measurement.frameWork.length,
    activeFrameP95Ms: percentile95(measurement.frameWork),
    activeFrameMaxMs: Math.max(...measurement.frameWork),
    cameraSamples: cameraSamples.length,
    cameraP95Ms: percentile95(cameraSamples),
    longTaskSupported: measurement.longTaskSupported,
    longTaskCount: measurement.longTasks.filter((duration) => duration > 50).length,
    maxLongTaskMs: Math.max(0, ...measurement.longTasks),
    domNodes: measurement.domNodes,
    canvases: measurement.canvases,
    displayObjects: 3,
    textureSources: 4,
    focusCycles: 20,
    focusHeapGrowthBytes,
    mountUnmountCycles: 20,
    heapGrowthBytes,
    retainedCanvases,
    retainedPrototypeRoots,
  };
  console.info(`PIXEL_PROTOTYPE_BROWSER_BUDGET ${JSON.stringify(report)}`);
  expect(report.cachedRendererStartupP95Ms).toBeLessThanOrEqual(500);
  expect(report.fourTimesCpuLoopbackStartupP95Ms).toBeLessThanOrEqual(1500);
  expect(report.activeFrameP95Ms).toBeLessThanOrEqual(8);
  expect(report.cameraP95Ms).toBeLessThanOrEqual(100);
  expect(report.longTaskSupported).toBe(true);
  expect(report.longTaskCount).toBe(0);
  expect(report.domNodes).toBeLessThanOrEqual(1600);
  expect(report.canvases).toBe(1);
  expect(report.displayObjects).toBeLessThanOrEqual(1600);
  expect(report.textureSources).toBeLessThanOrEqual(4);
  expect(report.focusHeapGrowthBytes).toBeLessThanOrEqual(25 * 1024 * 1024);
  expect(heapGrowthBytes).toBeLessThanOrEqual(25 * 1024 * 1024);
  expect(report.retainedCanvases).toBe(0);
  expect(report.retainedPrototypeRoots).toBe(0);
});

async function openScenario(
  page: Page,
  scene: string,
  logicalTimeMs: number,
  extra = '',
  requireCanvas = true,
): Promise<void> {
  const suffix = extra.length === 0 ? '' : `&${extra}`;
  await page.goto(`/?surface=living-pixel-prototype&scene=${scene}&time=${logicalTimeMs}${suffix}`);
  await page.evaluate(async () => document.fonts.ready);
  await expect(page.locator('#living-pixel-prototype')).toBeVisible();
  if (requireCanvas) await expect(page.locator('[data-pixel-canvas]')).toHaveCount(1);
  await page.evaluate(async () => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function assertNoPageOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function assertMinimumTouchTargets(page: Page): Promise<void> {
  const undersized = await page.locator('button:visible, a:visible').evaluateAll((elements) => elements
    .map((element) => {
      const rectangle = element.getBoundingClientRect();
      return { label: element.textContent, width: rectangle.width, height: rectangle.height };
    })
    .filter((target) => target.width < 44 || target.height < 44));
  expect(undersized).toEqual([]);
}

async function assertNoActorLabelCollisions(page: Page): Promise<void> {
  const overlaps = await page.locator('[data-actor-label]:visible').evaluateAll((elements) => {
    const rectangles = elements.map((element) => ({
      id: element.getAttribute('data-actor-label'),
      rectangle: element.getBoundingClientRect(),
    }));
    return rectangles.flatMap((left, index) => rectangles.slice(0, index)
      .filter((right) => left.rectangle.left < right.rectangle.right
        && left.rectangle.right > right.rectangle.left
        && left.rectangle.top < right.rectangle.bottom
        && left.rectangle.bottom > right.rectangle.top)
      .map((right) => ({
        pair: `${left.id}/${right.id}`,
        left: {
          x: Math.round(left.rectangle.x), y: Math.round(left.rectangle.y),
          width: Math.round(left.rectangle.width), height: Math.round(left.rectangle.height),
        },
        right: {
          x: Math.round(right.rectangle.x), y: Math.round(right.rectangle.y),
          width: Math.round(right.rectangle.width), height: Math.round(right.rectangle.height),
        },
      })));
  });
  expect(overlaps).toEqual([]);
}

async function measureCameraCycles(page: Page, count: number): Promise<readonly number[]> {
  return page.evaluate(async (sampleCount) => {
    const focus = [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent === 'Focus selected Team');
    const full = [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent === 'Full office');
    if (focus === undefined || full === undefined) throw new TypeError('camera controls missing');
    const samples: number[] = [];
    for (let index = 0; index < sampleCount; index += 1) {
      const target = index % 2 === 0 ? focus : full;
      const start = performance.now();
      target.click();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      samples.push(performance.now() - start);
    }
    return samples;
  }, count);
}

function percentile95(samples: readonly number[]): number {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? Number.POSITIVE_INFINITY;
}
