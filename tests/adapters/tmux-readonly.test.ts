import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { LocalTmuxObservationSource } from '../../src/adapters/observations/tmux/source.js';
import { tmuxReadArgv } from '../../src/adapters/observations/process-runner.js';
import { createLocalProjectRegistry, type LocalProjectRegistry } from '../../src/application/projects/registry.js';
import { FakeReadonlyToolRunner, toolResult } from '../helpers/fake-tool-runner.js';

const LIMITS = { timeoutMs: 1000, maxOutputBytes: 16 * 1024 } as const;

describe('read-only tmux metadata source', () => {
  it('targets one configured pane and parses only structured fields with hostile names kept opaque', async () => {
    const fixture = await makeFixture();
    const hostileSessionName = "agent-office;$(touch /tmp/never)";
    const hostileWindowName = "main 'quoted' --target %99";
    const fields = metadataFields(fixture.root, {
      sessionName: hostileSessionName,
      windowName: hostileWindowName,
      currentCommand: 'codex --not-an-argv',
    });
    const runner = new FakeReadonlyToolRunner(
      () => toolResult(''),
      () => toolResult(`${fields.join('\u001f')}\n`),
    );
    const source = makeSource(fixture.registry, runner, {
      sessionNameEscaped: hostileSessionName,
      windowNameEscaped: hostileWindowName,
      currentCommandEscaped: 'codex --not-an-argv',
    });

    const observation = await source.observe('agent-office-pane');

    expect(observation).toMatchObject({
      sessionId: '$13',
      windowId: '@13',
      paneId: '%13',
      sessionNameEscaped: hostileSessionName,
      windowNameEscaped: hostileWindowName,
      workspaceRootId: 'workspace',
      currentCommandEscaped: 'codex --not-an-argv',
      paneDead: false,
      synchronizePanes: false,
      lastActivityAt: '2024-07-10T21:20:00.000Z',
    });
    expect(runner.tmuxRequests.map((request) => tmuxReadArgv(request))).toEqual([
      ['display-message', '-p', '-t', '%13', '-F', expect.stringContaining('#{session_id}')],
    ]);
    expect('execute' in source).toBe(false);
  });

  it.each([
    { label: 'field separator', sessionName: 'agent\u001foffice', suffix: '' },
    { label: 'newline', sessionName: 'agent\noffice', suffix: '' },
    { label: 'second record', sessionName: 'agent-office', suffix: '\nextra' },
  ])('rejects hostile structured output containing $label', async ({ sessionName, suffix }) => {
    const fixture = await makeFixture();
    const runner = new FakeReadonlyToolRunner(
      () => toolResult(''),
      () =>
        toolResult(`${metadataFields(fixture.root, { sessionName }).join('\u001f')}\n${suffix}`),
    );
    const source = makeSource(fixture.registry, runner);
    await expect(source.observe('agent-office-pane')).rejects.toMatchObject({
      code: 'STRUCTURED_OUTPUT_INVALID',
    });
  });

  it('reports dead/synchronized metadata without turning it into WorkUnit state', async () => {
    const fixture = await makeFixture();
    const fields = metadataFields(fixture.root);
    fields[9] = '1';
    fields[11] = '1';
    const runner = new FakeReadonlyToolRunner(
      () => toolResult(''),
      () => toolResult(`${fields.join('\u001f')}\n`),
    );
    const observation = await makeSource(fixture.registry, runner).observe('agent-office-pane');
    expect(observation.paneDead).toBe(true);
    expect(observation.synchronizePanes).toBe(true);
    expect(observation).not.toHaveProperty('workUnitState');
    expect(observation).not.toHaveProperty('activity');
    expect(observation).not.toHaveProperty('terminalProse');
  });

  it('contains no capture, input, buffer, shell, signal, or mutation command surface', async () => {
    const directory = path.resolve(import.meta.dirname, '../../src/adapters/observations');
    const sources = await Promise.all([
      readFile(path.join(directory, 'process-runner.ts'), 'utf8'),
      readFile(path.join(directory, 'tmux/source.ts'), 'utf8'),
      readFile(path.join(directory, 'ports.ts'), 'utf8'),
    ]);
    const implementation = sources.join('\n');
    expect(implementation).not.toMatch(
      /capture-pane|send-keys|load-buffer|paste-buffer|set-buffer|run-shell|source-file|kill-pane|kill-session|respawn-pane|split-window|new-session|new-window/u,
    );
    expect(implementation).not.toMatch(/genericTmux|tmuxCommand|terminalProse/u);
    expect(implementation).toContain("return ['display-message', '-p', '-t', request.paneId");
  });
});

async function makeFixture(): Promise<{ readonly root: string; readonly registry: LocalProjectRegistry }> {
  const root = await mkdtemp(path.join(tmpdir(), 'agent-office-tmux-'));
  const registry = await createLocalProjectRegistry([
    {
      projectId: 'agent-office',
      displayName: 'Agent Office',
      hostId: 'local-host',
      roots: [{ rootId: 'workspace', absolutePath: root, capabilities: ['WORKSPACE'] }],
    },
  ]);
  return { root, registry };
}

function makeSource(
  registry: LocalProjectRegistry,
  runner: FakeReadonlyToolRunner,
  override: Partial<{
    readonly sessionNameEscaped: string;
    readonly windowNameEscaped: string;
    readonly currentCommandEscaped: string;
  }> = {},
): LocalTmuxObservationSource {
  return new LocalTmuxObservationSource(registry, runner, [
    {
      sourceId: 'agent-office-pane',
      projectId: 'agent-office',
      hostId: 'local-host',
      sessionId: '$13',
      windowId: '@13',
      paneId: '%13',
      sessionNameEscaped: 'agent-office',
      windowNameEscaped: 'main',
      windowIndex: 0,
      paneIndex: 0,
      workspaceRootId: 'workspace',
      currentCommandEscaped: 'codex',
      limits: LIMITS,
      ...override,
    },
  ]);
}

function metadataFields(
  root: string,
  override: Partial<{
    readonly sessionName: string;
    readonly windowName: string;
    readonly currentCommand: string;
  }> = {},
): string[] {
  return [
    '$13',
    '@13',
    '%13',
    override.sessionName ?? 'agent-office',
    override.windowName ?? 'main',
    '0',
    '0',
    root,
    override.currentCommand ?? 'codex',
    '0',
    '1720646400',
    '0',
  ];
}
