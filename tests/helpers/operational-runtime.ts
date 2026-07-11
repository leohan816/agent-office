import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { AdvisorTransportCapability } from '../../src/adapters/gateways/tmux-advisor/index.js';
import type {
  GitReadRequest,
  ReadonlyToolRunner,
  TmuxReadRequest,
  ToolReadResult,
} from '../../src/adapters/observations/process-runner.js';
import type { OperationalRuntimeConfiguration } from '../../src/runtime/operational-config.js';
import {
  NodeReadonlyToolRunner,
  TMUX_METADATA_FORMAT,
} from '../../src/adapters/observations/process-runner.js';
import { sha256Bytes } from '../../src/persistence/file-store/hashing.js';
import { FIXED_TIME } from './fixtures.js';

export const projectRoot = path.resolve(import.meta.dirname, '../..');
export const foundationRoot = path.resolve(projectRoot, '../foundation-docs');
export const canonicalManifestRelativePath =
  'advisor/jobs/20260711_agent_office_m01_advisor_managed_office_web_control_plane/10_MISSION_MANIFEST.json';

const ACTOR_STATIONS = [
  ['leo', 'Leo/GPT', []],
  ['advisor', 'Advisor', ['AO-WU-01', 'AO-WU-02', 'AO-WU-14', 'AO-WU-15']],
  ['control', 'Control', []],
  ['fable5', 'Fable5 Reviewer', ['AO-WU-05', 'AO-WU-13']],
  ['foundation', 'Foundation Worker', []],
  ['siasiu', 'SIASIU Worker', []],
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
] as const;

export async function operationalRuntimeConfiguration(
  capability?: AdvisorTransportCapability,
): Promise<OperationalRuntimeConfiguration> {
  const fixtureSource = JSON.parse(
    await readFile(path.join(projectRoot, 'fixtures/manifests/agent-office-m01.v1.source.json'), 'utf8'),
  ) as OperationalRuntimeConfiguration['manifestSources'][number]['sourceMetadata'];
  const sourceMetadata = {
    ...fixtureSource,
    repository: 'agent-office-test-fixtures',
    commit: 'a'.repeat(40),
    path: 'fixtures/manifests/agent-office-m01.v1.json',
  };
  return {
    schemaVersion: 'agent-office.operational-runtime.v1',
    missionSourceId: 'agent-office-m01-manifest',
    projects: [
      {
        projectId: 'agent-office',
        displayName: 'Agent Office',
        hostId: 'local-host',
        roots: [{
          rootId: 'agent-office-root',
          absolutePath: projectRoot,
          capabilities: ['GIT', 'WORKSPACE', 'ARTIFACT', 'MANIFEST'],
        }],
      },
    ],
    gitSources: [
      gitSource('agent-office-git', 'agent-office', 'agent-office-root'),
    ],
    manifestSources: [{
      sourceId: 'agent-office-m01-manifest',
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

export async function actualCanonicalOperationalRuntime(): Promise<{
  readonly configuration: OperationalRuntimeConfiguration;
  readonly runner: ReadonlyToolRunner;
}> {
  const base = await operationalRuntimeConfiguration();
  const manifestBytes = await readFile(path.join(foundationRoot, canonicalManifestRelativePath));
  const gitReader = new NodeReadonlyToolRunner(undefined, () => FIXED_TIME);
  const limits = { timeoutMs: 1_000, maxOutputBytes: 64 * 1024 };
  const head = await gitReader.readGit({ kind: 'HEAD', cwd: foundationRoot, limits });
  if (head.exitCode !== 0) throw new Error('canonical foundation HEAD is unavailable');
  const commit = Buffer.from(head.stdout).toString('utf8').trim();
  if (!/^[0-9a-f]{40}$/u.test(commit)) throw new Error('canonical foundation HEAD is invalid');
  const configuration: OperationalRuntimeConfiguration = {
    ...base,
    missionSourceId: 'canonical-foundation-mission-manifest',
    projects: [
      ...base.projects,
      {
        projectId: 'foundation-docs',
        displayName: 'Foundation Docs',
        hostId: 'local-host',
        roots: [{
          rootId: 'foundation-root',
          absolutePath: foundationRoot,
          capabilities: ['GIT', 'MANIFEST'],
        }],
      },
    ],
    gitSources: [
      ...base.gitSources,
      gitSource('foundation-git', 'foundation-docs', 'foundation-root'),
    ],
    manifestSources: [{
      sourceId: 'canonical-foundation-mission-manifest',
      projectId: 'foundation-docs',
      rootId: 'foundation-root',
      relativePath: canonicalManifestRelativePath,
      maxBytes: 128 * 1024,
      sourceMetadata: {
        schemaVersion: 'agent-office.manifest-source.v1',
        repository: 'foundation-docs',
        commit,
        path: canonicalManifestRelativePath,
        sha256: sha256Bytes(manifestBytes),
      },
      gitSourceId: 'foundation-git',
    }],
    actors: base.actors.map((actor) => {
      if (actor.stationId === 'advisor') {
        return { ...actor, workUnitIds: [...actor.workUnitIds, 'AO-WU-16', 'AO-WU-21'] };
      }
      if (actor.stationId === 'fable5') {
        return { ...actor, workUnitIds: [...actor.workUnitIds, 'AO-WU-18', 'AO-WU-20'] };
      }
      if (actor.stationId === 'agent-office') {
        return { ...actor, workUnitIds: [...actor.workUnitIds, 'AO-WU-17', 'AO-WU-19'] };
      }
      return actor;
    }),
  };
  return {
    configuration,
    runner: currentObservationRunner({
      git: (request) => request.cwd === foundationRoot
        ? canonicalGitResult(request, commit)
        : undefined,
    }),
  };
}

export function currentObservationRunner(
  overrides: {
    readonly git?: (request: GitReadRequest) => ToolReadResult | undefined;
    readonly tmux?: (request: TmuxReadRequest) => ToolReadResult | undefined;
  } = {},
): ReadonlyToolRunner {
  return {
    readGit: (request) => Promise.resolve(
      overrides.git?.(request) ?? defaultGitResult(request),
    ),
    readTmux: (request) => Promise.resolve(
      overrides.tmux?.(request) ?? defaultTmuxResult(request),
    ),
  };
}

function gitSource(sourceId: string, projectId: string, rootId: string) {
  return {
    sourceId,
    projectId,
    rootId,
    limits: { timeoutMs: 1_000, maxOutputBytes: 64 * 1024 },
    refNamespaces: [],
    commitPairs: [],
  } as const;
}

function defaultGitResult(request: GitReadRequest): ToolReadResult {
  const commit = 'a'.repeat(40);
  switch (request.kind) {
    case 'TOP_LEVEL':
      return result(`${request.cwd}\n`);
    case 'HEAD':
    case 'UPSTREAM_COMMIT':
      return result(`${commit}\n`);
    case 'UPSTREAM_NAME':
      return result('origin/shadow-test\n');
    case 'STATUS':
      return result('');
    case 'ALLOWLISTED_REFS':
    case 'COMMIT_DIFF':
      return result('');
    case 'ANCESTRY':
      return result('');
  }
}

function defaultTmuxResult(request: TmuxReadRequest): ToolReadResult {
  const index = Number(request.paneId.slice(1));
  const station = ACTOR_STATIONS[index - 1]?.[0];
  if (station === undefined) return result('', 1);
  const values = [
    '$1',
    `@${index}`,
    request.paneId,
    'agent-office',
    station,
    String(index - 1),
    '0',
    projectRoot,
    'node',
    '0',
    String(Math.floor(Date.parse(FIXED_TIME) / 1000)),
    '0',
  ];
  if (TMUX_METADATA_FORMAT.split('\u001f').length !== values.length) {
    throw new Error('tmux fixture field count drifted');
  }
  return result(`${values.join('\u001f')}\n`);
}

function canonicalGitResult(request: GitReadRequest, commit: string): ToolReadResult {
  switch (request.kind) {
    case 'TOP_LEVEL':
      return result(`${foundationRoot}\n`);
    case 'HEAD':
    case 'UPSTREAM_COMMIT':
      return result(`${commit}\n`);
    case 'UPSTREAM_NAME':
      return result('origin/main\n');
    case 'STATUS':
    case 'ALLOWLISTED_REFS':
    case 'COMMIT_DIFF':
    case 'ANCESTRY':
      return result('');
  }
}

function result(stdout: string, exitCode = 0): ToolReadResult {
  return {
    exitCode,
    stdout: Buffer.from(stdout, 'utf8'),
    stderr: new Uint8Array(),
    completedAt: FIXED_TIME,
  };
}
