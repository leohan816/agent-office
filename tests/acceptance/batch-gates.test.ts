import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadApprovedManifest } from '../helpers/fixtures.js';

const root = path.resolve(import.meta.dirname, '../..');

const requiredTests = [
  'tests/domain/manifest.test.ts',
  'tests/property/scope-counting.test.ts',
  'tests/domain/event-envelope.test.ts',
  'tests/persistence/hash-chain.test.ts',
  'tests/domain/transitions.test.ts',
  'tests/property/transition-matrix.test.ts',
  'tests/contract/required-observable-conformance.test.ts',
  'tests/domain/writing-result-activity.test.ts',
  'tests/contract/blocker-alert-vocabulary.test.ts',
  'tests/snapshot/gpt-package.test.ts',
  'tests/persistence/replay.test.ts',
  'tests/recovery/crash-consistency.test.ts',
  'tests/recovery/restart-replay.test.ts',
  'tests/recovery/corruption-quarantine.test.ts',
  'tests/acceptance/batch-gates.test.ts',
  'tests/adapters/git-readonly.test.ts',
  'tests/adapters/artifact-manifest.test.ts',
  'tests/adapters/tmux-readonly.test.ts',
  'tests/integration/project-freshness.test.ts',
  'tests/ui/dashboard-view-model.test.ts',
  'tests/ui/korean-vocabulary.test.ts',
  'tests/ui/dashboard.component.test.tsx',
  'tests/ui/layout-contract.test.ts',
  'tests/ui/activity-mapping.test.ts',
  'tests/ui/activity-precedence.test.ts',
  'tests/ui/scene-boundary.test.ts',
  'tests/ui/office-scene.component.test.tsx',
  'tests/e2e/office-scene.spec.ts',
  'tests/e2e/accessibility.spec.ts',
  'tests/persistence/scoped-artifact.test.ts',
  'tests/recovery/advisor-message-crash-consistency.test.ts',
  'tests/integration/advisor-inbox.test.ts',
  'tests/integration/tmux-advisor-gateway.test.ts',
  'tests/integration/alert-application.test.ts',
  'tests/integration/lifecycle-audit.test.ts',
  'tests/adapters/hermes-disabled.test.ts',
  'tests/ui/communication-center.component.test.tsx',
  'tests/e2e/communication-center.spec.ts',
  'tests/security/bind-policy.test.ts',
  'tests/security/auth-session.test.ts',
  'tests/security/http-boundary.test.ts',
  'tests/security/rate-limit.test.ts',
  'tests/security/private-network-disabled.test.ts',
  'tests/security/audit-log.test.ts',
  'tests/security/static-shell.test.ts',
  'tests/integration/http-advisor-message.test.ts',
  'tests/integration/sse-reconnect.test.ts',
  'tests/recovery/backup-restore.test.ts',
  'tests/recovery/rollback-disable.test.ts',
  'tests/recovery/recovery-result.test.ts',
  'tests/operations/readiness.test.ts',
  'tests/pwa/cache-policy.test.ts',
  'tests/ui/runtime-boundary.component.test.tsx',
  'tests/e2e/pwa-lifecycle.spec.ts',
  'tests/e2e/pwa-cache-security.spec.ts',
  'tests/integration/runtime-composition.test.ts',
  'tests/integration/decision-authority-evidence.test.ts',
] as const;

describe('Batch A-D regression and Batch E scope gates', () => {
  it('contains every required Batch A-E test and deterministic verification command', async () => {
    await Promise.all(requiredTests.map((file) => access(path.join(root, file))));
    const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    expect(packageJson.dependencies).toEqual({
      'lucide-react': '1.24.0',
      react: '19.2.7',
      'react-dom': '19.2.7',
    });
    expect(packageJson.devDependencies['@playwright/test']).toBe('1.61.1');
    expect(packageJson.devDependencies['@axe-core/playwright']).toBe('4.12.1');
    for (const script of [
      'lint',
      'typecheck',
      'test',
      'test:property',
      'test:integration',
      'test:composition',
      'test:authority',
      'test:security',
      'test:recovery',
      'test:pwa',
      'test:ui',
      'test:e2e',
      'build',
      'start:loopback',
      'smoke:runtime',
      'audit:dependencies',
    ]) {
      expect(typeof packageJson.scripts[script]).toBe('string');
    }
  });

  it('preserves the approved denominator while exposing only approved Batch E top-level surfaces', async () => {
    const manifest = await loadApprovedManifest();
    expect(manifest.workUnits).toHaveLength(15);
    expect(manifest.counting.denominator).toBe(15);
    const sourceTopLevel = await readdir(path.join(root, 'src'));
    expect(sourceTopLevel.sort()).toEqual([
      'adapters',
      'application',
      'contracts',
      'domain',
      'operations',
      'persistence',
      'pwa',
      'runtime',
      'server',
      'ui',
    ]);
    for (const forbidden of ['database', 'deployment', 'gateway']) {
      expect(sourceTopLevel).not.toContain(forbidden);
    }
  });

  it('normalizes Playwright browser and web-server process locales in configuration', async () => {
    const environmentKeys = [
      'LANG',
      'LC_ALL',
      'LD_LIBRARY_PATH',
      'FONTCONFIG_PATH',
      'FONTCONFIG_SYSROOT',
    ] as const;
    const originalEnvironment = new Map(
      environmentKeys.map((key) => [key, process.env[key]] as const),
    );
    process.env.LANG = 'C.UTF-8';
    process.env.LC_ALL = 'C.UTF-8';

    try {
      const {
        default: playwrightConfig,
        PLAYWRIGHT_PROCESS_LOCALE,
        withPlaywrightProcessLocale,
      } = await import('../../playwright.config.js');

      expect(PLAYWRIGHT_PROCESS_LOCALE).toBe('ko_KR.UTF-8');
      expect(withPlaywrightProcessLocale({
        LANG: 'C.UTF-8',
        LC_ALL: 'C.UTF-8',
        PATH: '/test/bin',
      })).toEqual({
        LANG: 'ko_KR.UTF-8',
        LC_ALL: 'ko_KR.UTF-8',
        PATH: '/test/bin',
      });
      expect(process.env.LANG).toBe(PLAYWRIGHT_PROCESS_LOCALE);
      expect(process.env.LC_ALL).toBe(PLAYWRIGHT_PROCESS_LOCALE);
      expect(playwrightConfig.use?.launchOptions?.env).toMatchObject({
        LANG: PLAYWRIGHT_PROCESS_LOCALE,
        LC_ALL: PLAYWRIGHT_PROCESS_LOCALE,
      });
      const webServer = playwrightConfig.webServer;
      if (webServer === undefined || Array.isArray(webServer)) {
        throw new Error('expected one deterministic Playwright web server');
      }
      expect(webServer.env).toEqual({
        LANG: PLAYWRIGHT_PROCESS_LOCALE,
        LC_ALL: PLAYWRIGHT_PROCESS_LOCALE,
      });
    } finally {
      for (const [key, value] of originalEnvironment) {
        if (value === undefined) Reflect.deleteProperty(process.env, key);
        else process.env[key] = value;
      }
    }
  });

  it('contains the approved LocalBootstrap extension while keeping forbidden capabilities absent', async () => {
    const source = await readSourceTree(path.join(root, 'src'));
    const gatewaySource = await readSourceTree(path.join(root, 'src/adapters/gateways'));
    expect(gatewaySource).not.toMatch(/node:child_process|node:(?:http|https|net|tls)/u);
    const serverSource = await readSourceTree(path.join(root, 'src/server'));
    expect(serverSource).toMatch(/node:http/u);
    expect(serverSource).not.toMatch(/node:child_process|node:https|node:tls/u);
    expect(source).not.toMatch(/(?:express|sqlite|postgres|mysql|prisma|typeorm)/iu);
    expect(source).toMatch(/TmuxAdvisorGateway/u);
    expect(source).toMatch(/HermesAdvisorGateway/u);
    expect(source).toMatch(/AdvisorInboxService/u);
    expect(source).toMatch(/serviceWorker/u);
    expect(source).not.toMatch(/WebSocket/u);
    expect(source).not.toMatch(/send-keys|capture-pane|run-shell|paste-buffer|load-buffer/u);
    await expect(access(path.join(root, 'src/ui/scene'))).resolves.toBeUndefined();
    await expect(access(path.join(root, 'src/ui/communication'))).resolves.toBeUndefined();
    await expect(access(path.join(root, 'src/adapters/gateways/tmux-advisor/index.ts'))).resolves.toBeUndefined();
    await expect(access(path.join(root, 'src/adapters/gateways/hermes/index.ts'))).resolves.toBeUndefined();
    await expect(access(path.join(root, 'src/server'))).resolves.toBeUndefined();
    await expect(access(path.join(root, 'src/pwa'))).resolves.toBeUndefined();
    await expect(access(path.join(root, 'src/operations'))).resolves.toBeUndefined();
    expect(serverSource).not.toMatch(/\/api\/v1\/(?:terminal|worker|reviewer|dispatch|command)/u);
    expect(serverSource).toMatch(/LocalBootstrapAuthenticationProvider/u);
    expect(serverSource).not.toMatch(/Tailscale|PrivateNetworkAuthenticationProvider/u);
  });
});

async function readSourceTree(directory: string): Promise<string> {
  const entries = await readdir(directory, { withFileTypes: true });
  const chunks: string[] = [];
  for (const entry of entries) {
    const current = path.join(directory, entry.name);
    if (entry.isDirectory()) chunks.push(await readSourceTree(current));
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) chunks.push(await readFile(current, 'utf8'));
  }
  return chunks.join('\n');
}
