import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  canSatisfyCompletion,
  evaluateFreshness,
  LocalObservationSnapshot,
  type FreshnessPolicy,
  type StoredObservation,
} from '../../src/application/hosts/freshness.js';
import { createLocalProjectRegistry } from '../../src/application/projects/registry.js';

const POLICY: FreshnessPolicy = {
  policyId: 'LOCAL_TMUX_30_90',
  staleAfterMs: 30_000,
  offlineAfterMs: 90_000,
};

describe('trusted project registry and local freshness', () => {
  it('keeps root IDs isolated across projects and exposes no absolute path in browser summaries', async () => {
    const first = await mkdtemp(path.join(tmpdir(), 'agent-office-project-a-'));
    const second = await mkdtemp(path.join(tmpdir(), 'agent-office-project-b-'));
    const registry = await createLocalProjectRegistry([
      {
        projectId: 'project-a',
        displayName: 'Project A',
        hostId: 'local-host',
        roots: [{ rootId: 'root-a', absolutePath: first, capabilities: ['GIT', 'ARTIFACT'] }],
      },
      {
        projectId: 'project-b',
        displayName: 'Project B',
        hostId: 'local-host',
        roots: [{ rootId: 'root-b', absolutePath: second, capabilities: ['GIT'] }],
      },
    ]);

    expect(registry.getTrustedRoot('project-a', 'root-a', 'GIT').canonicalPath).toBe(first);
    expect(() => registry.getTrustedRoot('project-a', 'root-b', 'GIT')).toThrow(
      expect.objectContaining({ code: 'ROOT_NOT_ALLOWED' }),
    );
    expect(JSON.stringify(registry.listProjects())).not.toContain(first);
    expect(JSON.stringify(registry.listProjects())).not.toContain(second);
  });

  it('rejects equal or nested roots registered to different projects', async () => {
    const parent = await mkdtemp(path.join(tmpdir(), 'agent-office-overlap-'));
    const child = path.join(parent, 'child');
    await mkdir(child);
    await expect(
      createLocalProjectRegistry([
        {
          projectId: 'project-a',
          displayName: 'Project A',
          hostId: 'local-host',
          roots: [{ rootId: 'root-a', absolutePath: parent, capabilities: ['GIT'] }],
        },
        {
          projectId: 'project-b',
          displayName: 'Project B',
          hostId: 'local-host',
          roots: [{ rootId: 'root-b', absolutePath: child, capabilities: ['GIT'] }],
        },
      ]),
    ).rejects.toMatchObject({ code: 'CONFIG_INVALID' });
  });

  it.each([
    { evaluatedAt: '2026-07-10T20:00:20.000Z', expected: 'CURRENT' },
    { evaluatedAt: '2026-07-10T20:01:00.000Z', expected: 'STALE' },
    { evaluatedAt: '2026-07-10T20:02:00.000Z', expected: 'OFFLINE' },
  ] as const)('evaluates deterministic $expected freshness', ({ evaluatedAt, expected }) => {
    const result = evaluateFreshness(
      {
        sourceTime: '2026-07-10T20:00:00.000Z',
        receivedTime: '2026-07-10T20:00:01.000Z',
        clockQuality: 'VERIFIED_LOCAL',
      },
      evaluatedAt,
      POLICY,
    );
    expect(result.presentation).toBe(expected);
    expect(canSatisfyCompletion(result, 'VERIFIED')).toBe(expected === 'CURRENT');
  });

  it('projects UNKNOWN, CONFLICT, and ERROR explicitly and never lets them satisfy completion', () => {
    const unknown = evaluateFreshness(
      { clockQuality: 'UNKNOWN' },
      '2026-07-10T20:00:00.000Z',
      POLICY,
    );
    const conflict = evaluateFreshness(
      {
        sourceTime: '2026-07-10T20:00:00.000Z',
        receivedTime: '2026-07-10T20:00:00.000Z',
        clockQuality: 'VERIFIED_LOCAL',
      },
      '2026-07-10T20:00:01.000Z',
      POLICY,
      { conflictCode: 'ROOT_IDENTITY_CONFLICT' },
    );
    const error = evaluateFreshness(
      {
        sourceTime: '2026-07-10T20:00:00.000Z',
        receivedTime: '2026-07-10T20:00:00.000Z',
        clockQuality: 'VERIFIED_LOCAL',
      },
      '2026-07-10T20:00:01.000Z',
      POLICY,
      { errorCode: 'TOOL_TIMEOUT' },
    );
    expect([unknown.presentation, conflict.presentation, error.presentation]).toEqual([
      'UNKNOWN',
      'CONFLICT',
      'ERROR',
    ]);
    for (const result of [unknown, conflict, error]) {
      expect(canSatisfyCompletion(result, 'VERIFIED')).toBe(false);
    }
  });

  it('restores local observations deterministically and ages them after restart without changing their value', () => {
    const record: StoredObservation<{ readonly state: 'COMPLETED' }> = {
      observationId: 'mission-state',
      sourceId: 'event-projection',
      projectId: 'agent-office',
      hostId: 'local-host',
      sourceTime: '2026-07-10T20:00:00.000Z',
      receivedTime: '2026-07-10T20:00:01.000Z',
      policyId: POLICY.policyId,
      evidenceRef: 'event-10',
      value: { state: 'COMPLETED' },
    };
    const beforeRestart = new LocalObservationSnapshot([record]);
    const afterRestart = new LocalObservationSnapshot(beforeRestart.exportForRestart());
    const restored = afterRestart.get('mission-state');
    expect(restored).toEqual(record);
    if (restored === undefined) throw new Error('restart fixture observation is missing');
    const aged = evaluateFreshness(
      {
        sourceTime: restored.sourceTime,
        receivedTime: restored.receivedTime,
        clockQuality: 'VERIFIED_LOCAL',
      },
      '2026-07-10T20:02:00.000Z',
      POLICY,
    );
    expect(aged.presentation).toBe('OFFLINE');
    expect(restored.value.state).toBe('COMPLETED');
    expect(canSatisfyCompletion(aged, 'VERIFIED')).toBe(false);
  });
});
