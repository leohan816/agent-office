import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

export const PLAYWRIGHT_PROCESS_LOCALE = 'ko_KR.UTF-8';

export function withPlaywrightProcessLocale(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...environment,
    LANG: PLAYWRIGHT_PROCESS_LOCALE,
    LC_ALL: PLAYWRIGHT_PROCESS_LOCALE,
  };
}

Object.assign(process.env, withPlaywrightProcessLocale(process.env));

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

const browserProcessEnvironment = withPlaywrightProcessLocale(process.env);

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [['line']],
  snapshotPathTemplate: '{testDir}/baselines/{testFilePath}/{arg}{ext}',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4173',
    locale: 'ko-KR',
    timezoneId: 'UTC',
    colorScheme: 'dark',
    launchOptions: {
      env: browserProcessEnvironment,
    },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 4173',
    env: {
      LANG: PLAYWRIGHT_PROCESS_LOCALE,
      LC_ALL: PLAYWRIGHT_PROCESS_LOCALE,
    },
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
