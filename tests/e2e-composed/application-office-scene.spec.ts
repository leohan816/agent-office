import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.describe('authenticated composed application office scene', () => {
  test('renders the structured desktop projection without fixture controls or invented motion', async ({ page }, testInfo) => {
    const projectionOverride: ProjectionOverride = { mode: 'M1_ABSENT' };
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, 'A'.repeat(43), projectionOverride);
    await expect(page.locator('.scene-station:visible')).toHaveCount(8);
    await expect(page.locator('.scene-fixture-control')).toHaveCount(0);
    await expect(page.locator('#office-scene')).toContainText('APPLICATION PROJECTION');
    await expect(page.locator('[data-station-id="agent-office"]')).toHaveAttribute(
      'data-state',
      'UNKNOWN_OR_STALE',
    );
    await expect(page.locator('[data-motion-cue], [data-route-cue]')).toHaveCount(0);
    await expect(page).toHaveScreenshot('application-office-desktop-1440x900.png', {
      animations: 'allow',
      caret: 'hide',
      maxDiffPixelRatio: 0.005,
    });

    projectionOverride.mode = 'LIVE';
    await page.reload();
    await expect(page.locator('#spatial-office')).toHaveAttribute(
      'data-fixture-kind',
      'AUTHENTICATED_APPLICATION_PROJECTION',
    );
    await expect(page.locator('#spatial-office')).toHaveAttribute('data-motion-tier', 'FULL');
    await expect(page.locator('#office-scene')).toHaveCount(0);
    await expect(page.locator('[data-motion-cue], [data-route-cue]')).toHaveCount(0);
    await expect(page).toHaveScreenshot(
      ['ao12-d-authenticated', 'application-spatial-desktop-1440x900.png'],
      screenshotOptions(),
    );

    const presentationControl = page.getByRole('button', { name: 'Presentation detail: full' });
    await presentationControl.click();
    await expect(page.locator('#spatial-office')).toHaveAttribute('data-motion-tier', 'RESTRAINED');
    await page.getByRole('button', { name: 'Presentation detail: restrained' }).click();
    await expect(page.locator('#spatial-office')).toHaveAttribute('data-motion-tier', 'STATIC');
    await page.getByRole('button', { name: 'Presentation detail: static' }).click();
    await expect(page.locator('#spatial-office')).toHaveAttribute('data-motion-tier', 'FULL');

    const controls = page.locator('#spatial-office button:visible');
    for (const box of await controls.evaluateAll((items) => items.map((item) => {
      const rect = item.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }))) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    const firstPod = page.locator('.spatial-pod-control').first();
    await firstPod.focus();
    await expect(firstPod).toBeFocused();
    await firstPod.press('Home');
    await expect(firstPod).toBeFocused();
    const accessibility = await new AxeBuilder({ page })
      .include('#spatial-office')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);

    const browserMetrics = await authenticatedBrowserMetrics(page);
    await testInfo.attach('ao12-d-browser-metrics.json', {
      body: JSON.stringify(browserMetrics),
      contentType: 'application/json',
    });
    process.stdout.write(`AO12_D_BROWSER_BENCHMARK ${JSON.stringify(browserMetrics)}\n`);
    expect(browserMetrics.podSelectionP95Ms).toBeLessThanOrEqual(100);
    expect(browserMetrics.longTasksOver50Ms).toBe(0);
    expect(browserMetrics.domNodes).toBeLessThanOrEqual(1600);
    expect(browserMetrics.svgElements).toBeLessThanOrEqual(800);
    expect(browserMetrics.retainedHeapGrowthBytes).toBeLessThanOrEqual(25 * 1024 * 1024);
    expect(browserMetrics.pendingCues).toBe(0);

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page).toHaveScreenshot(
      ['ao12-d-authenticated', 'application-spatial-tablet-1024x768.png'],
      screenshotOptions(),
    );
    await page.setViewportSize({ width: 320, height: 720 });
    await expectNoHorizontalOverflow(page);
    await expect(page).toHaveScreenshot(
      ['ao12-d-authenticated', 'application-spatial-320x720.png'],
      screenshotOptions(),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await expectNoHorizontalOverflow(page);
    await expect(page).toHaveScreenshot(
      ['ao12-d-authenticated', 'application-spatial-text-200-percent-390x844.png'],
      screenshotOptions(),
    );
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '';
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ forcedColors: 'active' });
    await expect(page).toHaveScreenshot(
      ['ao12-d-authenticated', 'application-spatial-forced-colors-1440x900.png'],
      screenshotOptions(),
    );
    await page.emulateMedia({ forcedColors: 'none' });

    for (const mode of ['STALE', 'OFFLINE', 'CONFLICT', 'CRITICAL'] as const) {
      projectionOverride.mode = mode;
      await page.reload();
      await expect(page.locator('#spatial-office')).toHaveAttribute('data-motion-tier', 'STATIC');
      await expect(page.locator('#spatial-floor-list')).toBeVisible();
      await expect(page.locator('[data-motion-cue], [data-route-cue]')).toHaveCount(0);
    }
    for (const mode of ['UNKNOWN_SCHEMA', 'INVALID_SCHEMA', 'M1_ABSENT'] as const) {
      projectionOverride.mode = mode;
      await page.reload();
      await expect(page.locator('#office-scene')).toBeVisible();
      await expect(page.locator('#spatial-office')).toHaveCount(0);
    }
    projectionOverride.mode = 'LIVE';
    await page.reload();
    await expect(page.locator('#spatial-office')).toBeVisible();
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('heading', { name: 'LOGGED_OUT' })).toBeVisible();
    await expect(page.locator('#office-scene')).toHaveCount(0);
    await expect(page.locator('#spatial-office')).toHaveCount(0);
  });

  test('contains the authenticated application projection on mobile', async ({ page }) => {
    const projectionOverride: ProjectionOverride = { mode: 'M1_ABSENT' };
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'B'.repeat(43), projectionOverride);
    await expect(page.locator('.scene-station:visible')).toHaveCount(2);
    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
    await expect(page).toHaveScreenshot('application-office-mobile-390x844.png', {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.005,
    });

    projectionOverride.mode = 'LIVE';
    await page.reload();
    await expect(page.locator('#spatial-office')).toHaveAttribute('data-motion-tier', 'STATIC');
    await expect(page.locator('.spatial-team-pod:visible')).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page).toHaveScreenshot(
      ['ao12-d-authenticated', 'application-spatial-mobile-390x844.png'],
      screenshotOptions(),
    );
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('#spatial-status')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('preserves reduced motion and accessibility in the composed path', async ({ page }) => {
    const projectionOverride: ProjectionOverride = { mode: 'M1_ABSENT' };
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await login(page, 'C'.repeat(43), projectionOverride);
    await expect(page.locator('.scene-route-layer')).toHaveCSS('display', 'none');
    await expect(page.locator('[data-motion-cue], [data-route-cue]')).toHaveCount(0);
    const accessibility = await new AxeBuilder({ page })
      .include('#office-scene')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await expect(page).toHaveScreenshot('application-office-reduced-motion-1440x900.png', {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.005,
    });

    projectionOverride.mode = 'LIVE';
    await page.reload();
    await expect(page.locator('#spatial-office')).toHaveAttribute('data-motion-tier', 'STATIC');
    await expect(page.locator('[data-motion-cue], [data-route-cue]')).toHaveCount(0);
    await expect(page.locator('#spatial-floor-list')).toBeVisible();
    const spatialAccessibility = await new AxeBuilder({ page })
      .include('#spatial-office')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(spatialAccessibility.violations).toEqual([]);
    await expect(page).toHaveScreenshot(
      ['ao12-d-authenticated', 'application-spatial-reduced-motion-1440x900.png'],
      screenshotOptions(),
    );
  });
});

type ProjectionMode =
  | 'LIVE'
  | 'STALE'
  | 'OFFLINE'
  | 'CONFLICT'
  | 'CRITICAL'
  | 'UNKNOWN_SCHEMA'
  | 'INVALID_SCHEMA'
  | 'M1_ABSENT';

interface ProjectionOverride {
  mode: ProjectionMode;
}

async function login(page: Page, proof: string, projectionOverride: ProjectionOverride): Promise<void> {
  const requestedUrls: string[] = [];
  page.on('request', (request) => requestedUrls.push(request.url()));
  await page.route('**/api/v1/projection', async (route) => {
    const response = await route.fetch();
    let value: unknown;
    try {
      value = await response.json() as unknown;
    } catch {
      await route.fulfill({ response });
      return;
    }
    await route.fulfill({ response, json: projectionForMode(value, projectionOverride.mode) });
  });
  await page.goto('/');
  await expect(page.locator('.runtime-boundary')).toContainText('LOGIN_REQUIRED');
  await expect(page.locator('.runtime-boundary')).toContainText('MANUAL_FALLBACK_REQUIRED');
  await expect(page.getByLabel('일회용 인증 증명')).toBeVisible();
  await page.getByLabel('일회용 인증 증명').fill(proof);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.locator('#office-scene')).toBeVisible();
  await expect(page.locator('.topbar-status')).toContainText('APPLICATION PROJECTION');
  await expect(page.locator('.runtime-boundary')).toContainText('LOCAL_BOOTSTRAP_AUTHENTICATED');
  await expect(page.locator('.runtime-boundary')).toContainText('MANUAL_FALLBACK_REQUIRED');
  expect(page.url()).not.toContain(proof);
  expect(requestedUrls.every((url) => !url.includes(proof))).toBe(true);
  const browserStorage = await page.evaluate(async () => {
    const cacheBodies: string[] = [];
    for (const cacheName of await caches.keys()) {
      const cache = await caches.open(cacheName);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        if (response !== undefined) cacheBodies.push(await response.text());
      }
    }
    return {
      localStorage: Array.from({ length: localStorage.length }, (_, index) => {
        const key = localStorage.key(index);
        return key === null ? null : [key, localStorage.getItem(key)];
      }),
      sessionStorage: Array.from({ length: sessionStorage.length }, (_, index) => {
        const key = sessionStorage.key(index);
        return key === null ? null : [key, sessionStorage.getItem(key)];
      }),
      cacheBodies,
      indexedDatabaseNames: typeof indexedDB.databases === 'function'
        ? (await indexedDB.databases()).map((database) => database.name ?? '')
        : [],
    };
  });
  expect(JSON.stringify(browserStorage)).not.toContain(proof);
  const cookies = await page.context().cookies();
  expect(cookies).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: 'AO_SESSION', httpOnly: true, sameSite: 'Strict' }),
  ]));
}

function projectionForMode(value: unknown, mode: ProjectionMode): unknown {
  if (!isRecord(value) || !isRecord(value.spatialOffice)) return value;
  if (mode === 'M1_ABSENT') {
    const { spatialOffice: ignored, ...withoutSpatial } = value;
    void ignored;
    return withoutSpatial;
  }
  if (mode === 'UNKNOWN_SCHEMA') {
    return { ...value, spatialOffice: { schemaVersion: 'agent-office.authenticated-spatial-presentation.v9' } };
  }
  if (mode === 'INVALID_SCHEMA') {
    return { ...value, spatialOffice: { schemaVersion: 'agent-office.authenticated-spatial-presentation.v1' } };
  }
  if (mode === 'LIVE') return value;
  const presentation = value.spatialOffice;
  if (!isRecord(presentation.projection)) return value;
  const projection = presentation.projection;
  const selectedPodId = typeof projection.selectedPodId === 'string' ? projection.selectedPodId : null;
  const sourceDegraded = mode === 'STALE' || mode === 'OFFLINE' || mode === 'CONFLICT';
  const pods = Array.isArray(projection.pods)
    ? (projection.pods as readonly unknown[]).map((candidate: unknown) => {
        if (!isRecord(candidate) || candidate.podId !== selectedPodId) return candidate;
        const assignments = Array.isArray(candidate.actorAssignments)
          ? (candidate.actorAssignments as readonly unknown[]).map((assignment: unknown) => isRecord(assignment)
              ? { ...assignment, taskMotionAllowed: sourceDegraded ? false : assignment.taskMotionAllowed }
              : assignment)
          : candidate.actorAssignments;
        return {
          ...candidate,
          ...(mode === 'STALE' ? { evidenceFreshness: 'STALE' } : {}),
          ...(mode === 'OFFLINE' ? { connectionState: 'OFFLINE' } : {}),
          ...(mode === 'CONFLICT' ? { authorityStatus: 'CONFLICT' } : {}),
          ...(mode === 'CRITICAL'
            ? { alertSummary: { severity: 'CRITICAL', openCount: 1 } }
            : {}),
          fullChoreographyEnabled: sourceDegraded ? false : candidate.fullChoreographyEnabled,
          actorAssignments: assignments,
        };
      })
    : projection.pods;
  const actors = isRecord(projection.actorsByRoleInstanceId)
    ? Object.fromEntries(Object.entries(projection.actorsByRoleInstanceId).map(([roleInstanceId, actor]) => [
        roleInstanceId,
        isRecord(actor) && sourceDegraded ? { ...actor, taskMotionAllowed: false } : actor,
      ]))
    : projection.actorsByRoleInstanceId;
  return {
    ...value,
    spatialOffice: {
      ...presentation,
      projection: { ...projection, pods, actorsByRoleInstanceId: actors },
    },
  };
}

async function authenticatedBrowserMetrics(page: Page): Promise<{
  readonly podSelectionP95Ms: number;
  readonly longTasksOver50Ms: number;
  readonly domNodes: number;
  readonly svgElements: number;
  readonly retainedHeapGrowthBytes: number;
  readonly pendingCues: number;
}> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('HeapProfiler.collectGarbage');
  const before = await cdp.send('Performance.getMetrics');
  const beforeHeap = before.metrics.find((metric) => metric.name === 'JSHeapUsedSize')?.value ?? 0;
  const browser = await page.evaluate(async () => {
    const longTasks: number[] = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTasks.push(entry.duration);
    });
    try {
      observer.observe({ entryTypes: ['longtask'] });
    } catch {
      // A browser without long-task observation reports no measured entry.
    }
    const control = document.querySelector<HTMLButtonElement>('.spatial-pod-control');
    if (control === null) throw new Error('authenticated spatial pod control missing');
    const samples: number[] = [];
    for (let index = 0; index < 20; index += 1) {
      const startedAt = performance.now();
      control.click();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      samples.push(performance.now() - startedAt);
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    observer.disconnect();
    samples.sort((left, right) => left - right);
    return {
      podSelectionP95Ms: samples[Math.floor(samples.length * 0.95)] ?? Number.POSITIVE_INFINITY,
      longTasksOver50Ms: longTasks.filter((duration) => duration > 50).length,
      domNodes: document.querySelectorAll('#spatial-office *').length,
      svgElements: document.querySelectorAll('#spatial-office svg, #spatial-office svg *').length,
      pendingCues: document.querySelectorAll('[data-motion-cue], [data-route-cue]').length,
    };
  });
  await cdp.send('HeapProfiler.collectGarbage');
  const after = await cdp.send('Performance.getMetrics');
  const afterHeap = after.metrics.find((metric) => metric.name === 'JSHeapUsedSize')?.value ?? 0;
  await cdp.detach();
  return { ...browser, retainedHeapGrowthBytes: Math.max(0, afterHeap - beforeHeap) };
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
}

function screenshotOptions() {
  return {
    animations: 'disabled' as const,
    caret: 'hide' as const,
    maxDiffPixelRatio: 0.005,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
