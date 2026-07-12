import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const PROCESS_LOCALE = 'ko_KR.UTF-8';
process.env.LANG = PROCESS_LOCALE;
process.env.LC_ALL = PROCESS_LOCALE;
process.env.AGENT_OFFICE_PIXEL_PROTOTYPE = '1';

const localRuntimeRoot = path.join(homedir(), '.cache/ms-playwright/local-runtime/root');
if (existsSync(localRuntimeRoot)) {
  const localLibraries = [
    path.join(localRuntimeRoot, 'usr/lib/x86_64-linux-gnu'),
    path.join(localRuntimeRoot, 'lib/x86_64-linux-gnu'),
    process.env.LD_LIBRARY_PATH,
  ].filter((value): value is string => value !== undefined && value.length > 0);
  process.env.LD_LIBRARY_PATH = localLibraries.join(':');
  process.env.FONTCONFIG_PATH = path.join(localRuntimeRoot, 'etc/fonts');
  process.env.FONTCONFIG_SYSROOT = localRuntimeRoot;
}

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /living-pixel-prototype(?:\.recording)?\.spec\.ts/u,
  outputDir: 'test-results/pixel-prototype',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [['line']],
  projects: [{ name: 'chromium' }],
  snapshotPathTemplate: '{testDir}/baselines/{testFilePath}/{arg}{ext}',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: 'ko-KR',
    timezoneId: 'UTC',
    colorScheme: 'dark',
    launchOptions: {
      env: { ...process.env, LANG: PROCESS_LOCALE, LC_ALL: PROCESS_LOCALE },
    },
    // A trace is itself Playwright's first screencast client and constrains all
    // later clients to its 800px preview size. The reviewed evidence recorder
    // must instead be the first client so its direct WebM is truly 1440x900.
    trace: 'off',
  },
  webServer: {
    command: 'npm run build:dashboard:test && npm run preview -- --port 4173',
    env: {
      ...process.env,
      LANG: PROCESS_LOCALE,
      LC_ALL: PROCESS_LOCALE,
      NO_COLOR: '1',
    },
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
