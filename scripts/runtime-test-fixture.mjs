import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const ACTOR_STATIONS = [
  ['leo', 'Leo/GPT', []],
  ['advisor', 'Advisor', ['AO-WU-01', 'AO-WU-02', 'AO-WU-14', 'AO-WU-15']],
  ['control', 'Control', []],
  ['fable5', 'Fable5 Reviewer', ['AO-WU-05', 'AO-WU-13']],
  ['foundation', 'Foundation Worker', []],
  ['shashu', 'Shashu Worker', []],
  ['cosmile', 'Cosmile Worker', []],
  [
    'agent-office',
    'Agent Office Worker',
    [
      'AO-WU-03',
      'AO-WU-04',
      'AO-WU-06',
      'AO-WU-07',
      'AO-WU-08',
      'AO-WU-09',
      'AO-WU-10',
      'AO-WU-11',
      'AO-WU-12',
    ],
  ],
];

export async function createExplicitTestOperationalConfiguration(appRoot, capability) {
  const fixtureSource = JSON.parse(
    await readFile(path.join(appRoot, 'fixtures/manifests/agent-office-m01.v1.source.json'), 'utf8'),
  );
  const sourceMetadata = {
    ...fixtureSource,
    repository: 'agent-office-explicit-test-fixtures',
    commit: 'a'.repeat(40),
    path: 'fixtures/manifests/agent-office-m01.v1.json',
  };
  return {
    schemaVersion: 'agent-office.operational-runtime.v1',
    missionSourceId: 'explicit-test-mission-manifest',
    projects: [{
      projectId: 'agent-office',
      displayName: 'Agent Office Explicit Test Fixture',
      hostId: 'local-host',
      roots: [{
        rootId: 'agent-office-root',
        absolutePath: appRoot,
        capabilities: ['GIT', 'WORKSPACE', 'ARTIFACT', 'MANIFEST'],
      }],
    }],
    gitSources: [{
      sourceId: 'agent-office-git',
      projectId: 'agent-office',
      rootId: 'agent-office-root',
      limits: { timeoutMs: 1_000, maxOutputBytes: 64 * 1024 },
      refNamespaces: [],
      commitPairs: [],
    }],
    manifestSources: [{
      sourceId: 'explicit-test-mission-manifest',
      projectId: 'agent-office',
      rootId: 'agent-office-root',
      relativePath: sourceMetadata.path,
      maxBytes: 128 * 1024,
      sourceMetadata,
      gitSourceId: 'agent-office-git',
    }],
    artifactSources: [],
    tmuxSources: ACTOR_STATIONS.map(([stationId], index) => ({
      sourceId: `${stationId}-tmux`,
      projectId: 'agent-office',
      hostId: 'local-host',
      sessionId: '$1',
      windowId: `@${index + 1}`,
      paneId: `%${index + 1}`,
      sessionNameEscaped: 'agent-office',
      windowNameEscaped: stationId,
      windowIndex: index,
      paneIndex: 0,
      workspaceRootId: 'agent-office-root',
      limits: { timeoutMs: 1_000, maxOutputBytes: 16 * 1024 },
    })),
    actors: ACTOR_STATIONS.map(([stationId, actorRole, workUnitIds]) => ({
      roleInstanceId: `${stationId}-role`,
      stationId,
      actorRole,
      acceptedManifestActorRoles:
        stationId === 'agent-office'
          ? ['Agent Office Worker', 'Agent Office Worker + Fable5 Reviewer']
          : workUnitIds.length === 0
            ? []
            : [actorRole],
      projectId: 'agent-office',
      hostId: 'local-host',
      workUnitIds,
      gitSourceId: 'agent-office-git',
      tmuxSourceId: `${stationId}-tmux`,
      artifactIds: [],
    })),
    freshnessPolicies: {
      git: { policyId: 'LOCAL_GIT_5M_30M', staleAfterMs: 5 * 60_000, offlineAfterMs: 30 * 60_000 },
      tmux: { policyId: 'LOCAL_TMUX_30S_90S', staleAfterMs: 30_000, offlineAfterMs: 90_000 },
    },
    refreshIntervalMs: 1_000,
    gateway: {
      adapter: 'TMUX_ADVISOR',
      ...(capability === undefined ? {} : { capability }),
    },
  };
}

export function createCurrentTestObservationRunner(appRoot, now) {
  const toolResult = (stdout, exitCode = 0) => ({
    exitCode,
    stdout: Buffer.from(stdout, 'utf8'),
    stderr: new Uint8Array(),
    completedAt: now,
  });
  return {
    readGit: (request) => {
      switch (request.kind) {
        case 'TOP_LEVEL':
          return Promise.resolve(toolResult(`${request.cwd}\n`));
        case 'HEAD':
        case 'UPSTREAM_COMMIT':
          return Promise.resolve(toolResult(`${'a'.repeat(40)}\n`));
        case 'UPSTREAM_NAME':
          return Promise.resolve(toolResult('origin/explicit-test\n'));
        case 'STATUS':
        case 'ALLOWLISTED_REFS':
        case 'COMMIT_DIFF':
        case 'ANCESTRY':
          return Promise.resolve(toolResult(''));
      }
    },
    readTmux: (request) => {
      const index = Number(request.paneId.slice(1));
      const station = ACTOR_STATIONS[index - 1]?.[0];
      if (station === undefined) return Promise.resolve(toolResult('', 1));
      const fields = [
        '$1',
        `@${index}`,
        request.paneId,
        'agent-office',
        station,
        String(index - 1),
        '0',
        appRoot,
        'node',
        '0',
        String(Math.floor(Date.parse(now) / 1000)),
        '0',
      ];
      return Promise.resolve(toolResult(`${fields.join('\u001f')}\n`));
    },
  };
}
