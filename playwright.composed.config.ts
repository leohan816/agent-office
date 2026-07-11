import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const locale = 'ko_KR.UTF-8';
process.env.LANG = locale;
process.env.LC_ALL = locale;

const localRuntimeRoot = path.join(homedir(), '.cache/ms-playwright/local-runtime/root');
if (existsSync(localRuntimeRoot)) {
  process.env.LD_LIBRARY_PATH = [
    path.join(localRuntimeRoot, 'usr/lib/x86_64-linux-gnu'),
    path.join(localRuntimeRoot, 'lib/x86_64-linux-gnu'),
    process.env.LD_LIBRARY_PATH,
  ].filter((value): value is string => value !== undefined && value.length > 0).join(':');
  process.env.FONTCONFIG_PATH = path.join(localRuntimeRoot, 'etc/fonts');
  process.env.FONTCONFIG_SYSROOT = localRuntimeRoot;
}

export default defineConfig({
  testDir: './tests/e2e-composed',
  outputDir: 'test-results-composed',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [['line']],
  snapshotPathTemplate: '{testDir}/baselines/{testFilePath}/{arg}{ext}',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4183',
    locale: 'ko-KR',
    timezoneId: 'UTC',
    colorScheme: 'dark',
    launchOptions: { env: { ...process.env, LANG: locale, LC_ALL: locale } },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && node scripts/e2e-composed-runtime-server.mjs',
    env: { LANG: locale, LC_ALL: locale },
    url: 'http://127.0.0.1:4183/health/live',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
