import { defineConfig } from '@playwright/test';

import composedConfig from './playwright.composed.config.js';

// Batch A Living Office E2E harness (Advisor doc 51). The authenticated production Office renders only
// against the real composed loopback runtime, but `playwright.composed.config.ts` fixes `testDir` to
// `tests/e2e-composed`. This test-only config REUSES that composed configuration — its loopback
// `webServer`, authenticated runtime, baseURL, workers/retries/forbidOnly, locale/timezone, and
// snapshot placement — while pointing `testDir` at `tests/e2e` and discovering ONLY the Living Office
// spec. It adds no server command, credential, remote/public access, or runtime authority.
//
// Enabling this config marks the Living Office spec runnable; under the default demo config (which
// serves the static demo entry and cannot render the authenticated Office) the spec self-skips.
process.env.AGENT_OFFICE_LIVING_OFFICE_E2E = '1';

export default defineConfig({
  ...composedConfig,
  testDir: './tests/e2e',
  testMatch: /living-pixel-office\.spec\.ts$/u,
  outputDir: 'test-results-batch-a-living-office',
});
