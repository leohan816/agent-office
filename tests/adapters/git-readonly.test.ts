import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ObservationError } from '../../src/adapters/observations/errors.js';
import { LocalGitObservationSource } from '../../src/adapters/observations/git/source.js';
import {
  gitReadArgv,
  tmuxReadArgv,
  type GitReadRequest,
} from '../../src/adapters/observations/process-runner.js';
import { createLocalProjectRegistry } from '../../src/application/projects/registry.js';
import { FakeReadonlyToolRunner, toolResult } from '../helpers/fake-tool-runner.js';

const HEAD = 'a'.repeat(40);
const UPSTREAM = 'b'.repeat(40);
const LIMITS = { timeoutMs: 1500, maxOutputBytes: 128 * 1024 } as const;

describe('read-only Git observation boundary', () => {
  it('uses only fixed reviewed argv and parses top-level, HEAD, upstream, and porcelain-v2', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'agent-office-git-'));
    const registry = await registryFor(root);
    const runner = new FakeReadonlyToolRunner((request) => {
      switch (request.kind) {
        case 'TOP_LEVEL':
          return toolResult(`${root}\n`);
        case 'HEAD':
          return toolResult(`${HEAD}\n`);
        case 'UPSTREAM_NAME':
          return toolResult('origin/shadow/agent-office-m01\n');
        case 'UPSTREAM_COMMIT':
          return toolResult(`${UPSTREAM}\n`);
        case 'STATUS':
          return toolResult('? untracked file.txt\u0000');
        default:
          return toolResult('');
      }
    });
    const source = makeSource(registry, runner);

    const observation = await source.observe('agent-office-git');

    expect(observation).toMatchObject({
      projectId: 'agent-office',
      rootId: 'repo',
      topLevelRootId: 'repo',
      headCommit: HEAD,
      upstreamRef: 'origin/shadow/agent-office-m01',
      upstreamCommit: UPSTREAM,
      dirty: true,
      changedPaths: ['untracked file.txt'],
    });
    expect(runner.gitRequests.map((request) => gitReadArgv(request))).toEqual([
      ['rev-parse', '--show-toplevel'],
      ['rev-parse', '--verify', 'HEAD^{commit}'],
      ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
      ['rev-parse', '--verify', '@{upstream}^{commit}'],
      ['status', '--porcelain=v2', '-z', '--untracked-files=all'],
    ]);
    expect('execute' in source).toBe(false);
    expect('execute' in runner).toBe(false);
  });

  it('maps namespace and commit-pair IDs to exact refs and commits without caller syntax', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'agent-office-git-'));
    const registry = await registryFor(root);
    const runner = new FakeReadonlyToolRunner((request) => {
      if (request.kind === 'ALLOWLISTED_REFS') {
        return toolResult(`refs/heads/shadow/m01\t${HEAD}\n`);
      }
      if (request.kind === 'ANCESTRY') return toolResult('', 0);
      if (request.kind === 'COMMIT_DIFF') return toolResult(`M\u0000README.md\u0000`);
      return toolResult('');
    });
    const source = makeSource(registry, runner);

    await expect(source.listAllowlistedRefs('agent-office-git', 'mission-heads')).resolves.toEqual([
      { refName: 'refs/heads/shadow/m01', commit: HEAD },
    ]);
    await expect(source.isConfiguredAncestor('agent-office-git', 'batch-a-to-b')).resolves.toBe(true);
    await expect(source.diffConfiguredCommits('agent-office-git', 'batch-a-to-b')).resolves.toEqual([
      { status: 'M', path: 'README.md' },
    ]);
    expect(runner.gitRequests.map((request) => gitReadArgv(request))).toEqual([
      ['for-each-ref', '--format=%(refname)%09%(objectname)', 'refs/heads/shadow/'],
      ['merge-base', '--is-ancestor', HEAD, UPSTREAM],
      ['diff-tree', '--no-commit-id', '--name-status', '-r', '-z', HEAD, UPSTREAM, '--'],
    ]);
  });

  it.each(['--all', '../refs', 'refs/heads/*', 'refs/heads/x\n--shell']) (
    'rejects hostile namespace input before invoking Git: %s',
    async (namespaceId) => {
      const root = await mkdtemp(path.join(tmpdir(), 'agent-office-git-'));
      const registry = await registryFor(root);
      const runner = new FakeReadonlyToolRunner(() => toolResult(''));
      const source = makeSource(registry, runner);
      await expect(source.listAllowlistedRefs('agent-office-git', namespaceId)).rejects.toMatchObject({
        code: 'CONFIG_INVALID',
      });
      expect(runner.gitRequests).toHaveLength(0);
    },
  );

  it('rejects option-shaped commits, pathspec expansion, and a mismatched repository root', async () => {
    const invalid: GitReadRequest = {
      kind: 'COMMIT_DIFF',
      cwd: '/tmp',
      baseCommit: '--output=/tmp/write'.padEnd(40, 'x'),
      headCommit: HEAD,
      limits: LIMITS,
    };
    expect(() => gitReadArgv(invalid)).toThrow(expect.objectContaining({ code: 'CONFIG_INVALID' }));
    expect(() =>
      tmuxReadArgv({ kind: 'EXACT_PANE_METADATA', paneId: '%1;send-keys', limits: LIMITS }),
    ).toThrow(expect.objectContaining({ code: 'CONFIG_INVALID' }));

    const root = await mkdtemp(path.join(tmpdir(), 'agent-office-git-'));
    const other = await mkdtemp(path.join(tmpdir(), 'agent-office-other-'));
    const registry = await registryFor(root);
    const runner = new FakeReadonlyToolRunner((request) => {
      if (request.kind === 'TOP_LEVEL') return toolResult(`${other}\n`);
      if (request.kind === 'HEAD') return toolResult(`${HEAD}\n`);
      if (request.kind === 'UPSTREAM_NAME' || request.kind === 'UPSTREAM_COMMIT') return toolResult('', 1);
      return toolResult('');
    });
    await expect(makeSource(registry, runner).observe('agent-office-git')).rejects.toMatchObject({
      code: 'IDENTITY_MISMATCH',
    });
  });

  it('has fixed timeout/output caps and no shell or writable Git operation in the production runner', async () => {
    const source = await readFile(
      path.resolve(import.meta.dirname, '../../src/adapters/observations/process-runner.ts'),
      'utf8',
    );
    expect(source).toContain("shell: false");
    expect(source).toContain("GIT_OPTIONAL_LOCKS: '0'");
    expect(source).toContain("new ObservationError('TOOL_TIMEOUT'");
    expect(source).toContain("new ObservationError('OUTPUT_LIMIT_EXCEEDED'");
    for (const writable of [
      'push',
      'pull',
      'fetch',
      'checkout',
      'switch',
      'reset',
      'clean',
      'commit',
      'merge',
      'rebase',
      'update-ref',
    ]) {
      expect(source).not.toContain(`return ['${writable}'`);
    }
    expect(source).not.toMatch(/exec(?:File|Sync)?\s*\(/u);
  });

  it.each(['TOOL_TIMEOUT', 'OUTPUT_LIMIT_EXCEEDED'] as const)(
    'fails closed with stable %s from the bounded process layer',
    async (code) => {
      const root = await mkdtemp(path.join(tmpdir(), 'agent-office-git-'));
      const registry = await registryFor(root);
      const runner = new FakeReadonlyToolRunner(() => {
        throw new ObservationError(code, 'deterministic process-boundary fixture');
      });
      await expect(makeSource(registry, runner).observe('agent-office-git')).rejects.toMatchObject({ code });
    },
  );
});

async function registryFor(root: string) {
  return createLocalProjectRegistry([
    {
      projectId: 'agent-office',
      displayName: 'Agent Office',
      hostId: 'local-host',
      roots: [{ rootId: 'repo', absolutePath: root, capabilities: ['GIT'] }],
    },
  ]);
}

function makeSource(
  registry: Awaited<ReturnType<typeof registryFor>>,
  runner: FakeReadonlyToolRunner,
): LocalGitObservationSource {
  return new LocalGitObservationSource(registry, runner, [
    {
      sourceId: 'agent-office-git',
      projectId: 'agent-office',
      rootId: 'repo',
      limits: LIMITS,
      refNamespaces: [{ namespaceId: 'mission-heads', exactPrefix: 'refs/heads/shadow/' }],
      commitPairs: [{ commitPairId: 'batch-a-to-b', baseCommit: HEAD, headCommit: UPSTREAM }],
    },
  ]);
}
