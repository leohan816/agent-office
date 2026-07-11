import { chmod, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type {
  GitReadRequest,
  ReadonlyToolRunner,
  ToolReadResult,
} from '../../src/adapters/observations/process-runner.js';
import { applyMissionEvent, createInitialProjection } from '../../src/application/projections/mission-projector.js';
import { createEvent, type EventEnvelope } from '../../src/domain/events/index.js';
import type { MissionManifest } from '../../src/domain/manifest/index.js';
import { GENESIS_EVENT_HASH, sha256Bytes } from '../../src/persistence/file-store/hashing.js';
import { parseArguments } from '../../src/runtime/cli.js';
import { RuntimeObservationCoordinator } from '../../src/runtime/observation-coordinator.js';
import {
  loadOperationalRuntimeConfiguration,
  type OperationalRuntimeConfiguration,
} from '../../src/runtime/operational-config.js';
import { FIXED_TIME, uuidV7 } from '../helpers/fixtures.js';
import {
  currentObservationRunner,
  operationalRuntimeConfiguration,
  projectRoot,
} from '../helpers/operational-runtime.js';

const foundationRoot = path.resolve(projectRoot, '../foundation-docs');
const manifestRelativePath = 'advisor/jobs/20260711_agent_office_m01_advisor_managed_office_web_control_plane/10_MISSION_MANIFEST.json';
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('operational observation/import coordinator', () => {
  it('starts only from an explicit Git-verified external canonical manifest root', async () => {
    const configuration = await externalConfiguration();
    const coordinator = await createCoordinator(configuration, observationRunner());
    const manifest = await coordinator.start();

    expect(manifest.source.path).toBe(manifestRelativePath);
    expect(manifest.manifestVersion).toBe(5);
    expect(manifest.workUnits).toHaveLength(21);
    expect(coordinator.snapshot()).toMatchObject({
      missionId: manifest.missionId,
      manifestVersion: manifest.manifestVersion,
      manifest: { status: 'VERIFIED' },
      refreshSequence: 1,
    });
    expect(JSON.stringify(coordinator.snapshot())).not.toContain(foundationRoot);
  });

  it('loads one owner-controlled versioned config and rejects a symlink config path', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'agent-office-operational-config-'));
    temporaryRoots.push(root);
    const configuration = await externalConfiguration();
    const configPath = path.join(root, 'operational.json');
    await writeFile(configPath, `${JSON.stringify(configuration)}\n`, { mode: 0o600 });
    await expect(loadOperationalRuntimeConfiguration(configPath)).resolves.toMatchObject({
      schemaVersion: 'agent-office.operational-runtime.v1',
      missionSourceId: 'external-mission-manifest',
      gateway: { adapter: 'TMUX_ADVISOR' },
    });
    const linkedPath = path.join(root, 'linked.json');
    await symlink(configPath, linkedPath);
    await expect(loadOperationalRuntimeConfiguration(linkedPath)).rejects.toMatchObject({
      code: 'INVALID_SCHEMA',
    });
  });

  it.each([
    ['0400', 0o400],
    ['0600', 0o600],
  ] as const)('accepts owner-controlled config mode %s', async (_label, mode) => {
    const root = await mkdtemp(path.join(tmpdir(), 'agent-office-operational-config-mode-'));
    temporaryRoots.push(root);
    const configPath = path.join(root, 'operational.json');
    await writeFile(configPath, `${JSON.stringify(await externalConfiguration())}\n`, { mode: 0o600 });
    await chmod(configPath, mode);

    await expect(loadOperationalRuntimeConfiguration(configPath)).resolves.toMatchObject({
      schemaVersion: 'agent-office.operational-runtime.v1',
    });
  });

  it.each([
    ['0620', 0o620],
    ['0602', 0o602],
    ['0666', 0o666],
  ] as const)('rejects group or other writable config mode %s', async (_label, mode) => {
    const root = await mkdtemp(path.join(tmpdir(), 'agent-office-operational-config-mode-'));
    temporaryRoots.push(root);
    const configPath = path.join(root, 'operational.json');
    await writeFile(configPath, `${JSON.stringify(await externalConfiguration())}\n`, { mode: 0o600 });
    await chmod(configPath, mode);

    await expect(loadOperationalRuntimeConfiguration(configPath)).rejects.toMatchObject({
      code: 'INVALID_SCHEMA',
    });
  });

  it.each(['MISSING', 'UNVERIFIED', 'STALE', 'HASH_MISMATCH', 'OUT_OF_SCOPE'] as const)(
    'fails closed when manifest authority is %s',
    async (mode) => {
      const configuration = await externalConfiguration();
      let runner = observationRunner();
      if (mode === 'MISSING') {
        const source = configuration.manifestSources[0];
        if (source === undefined) throw new Error('manifest metadata missing');
        configuration.manifestSources[0] = {
          ...source,
          relativePath: 'advisor/jobs/missing.json',
          sourceMetadata: { ...source.sourceMetadata, path: 'advisor/jobs/missing.json' },
        };
      } else if (mode === 'UNVERIFIED') {
        runner = observationRunner({ manifestGitMode: 'FAILED' });
      } else if (mode === 'STALE') {
        runner = observationRunner({ manifestGitMode: 'STALE' });
      } else if (mode === 'HASH_MISMATCH') {
        const source = configuration.manifestSources[0];
        if (source === undefined) throw new Error('manifest source missing');
        configuration.manifestSources[0] = {
          ...source,
          sourceMetadata: { ...source.sourceMetadata, sha256: `sha256:${'0'.repeat(64)}` },
        };
      } else {
        const source = configuration.manifestSources[0];
        if (source === undefined) throw new Error('manifest source missing');
        configuration.manifestSources[0] = {
          ...source,
          relativePath: '../outside.json',
          sourceMetadata: { ...source.sourceMetadata, path: '../outside.json' },
        };
      }
      const startup = createCoordinator(configuration, runner).then((coordinator) => coordinator.start());
      if (mode === 'OUT_OF_SCOPE') {
        await expect(startup).rejects.toMatchObject({ code: 'PATH_REJECTED' });
      } else {
        await expect(startup).rejects.toMatchObject({ code: 'AUTHORITY_ARTIFACT_INVALID' });
      }
    },
  );

  it.each([
    ['CURRENT', {}, 'CURRENT'],
    ['STALE', { tmuxMode: 'STALE' }, 'STALE'],
    ['OFFLINE', { tmuxMode: 'OFFLINE' }, 'OFFLINE'],
    ['MISSING', { omitAdvisorTmux: true }, 'UNKNOWN'],
    ['IDENTITY_MISMATCH', { tmuxMode: 'IDENTITY_MISMATCH' }, 'CONFLICT'],
    ['DIRTY_GIT', { actorGitMode: 'DIRTY' }, 'CONFLICT'],
    ['UNVERIFIED_GIT', { actorGitMode: 'UNVERIFIED' }, 'UNKNOWN'],
  ] as const)(
    'projects evidence-correct %s activity freshness',
    async (_label, mode, expected) => {
      const configuration = await externalConfiguration();
      if ('omitAdvisorTmux' in mode) {
        const index = configuration.actors.findIndex((actor) => actor.stationId === 'advisor');
        const actor = configuration.actors[index];
        if (actor === undefined) throw new Error('Advisor actor missing');
        configuration.actors[index] = withoutTmux(actor);
      }
      const coordinator = await createCoordinator(configuration, observationRunner({
        ...('tmuxMode' in mode ? { tmuxMode: mode.tmuxMode, tmuxPaneId: '%2' as const } : {}),
        ...('actorGitMode' in mode ? { actorGitMode: mode.actorGitMode } : {}),
      }));
      const manifest = await coordinator.start();
      const { projection, events } = activeAdvisorProjection(manifest);
      const observation = coordinator.workUnitObservations(projection, events)
        .find((candidate) => candidate.workUnitId === 'AO-WU-15');
      expect(observation).toMatchObject({ presentation: expected });
      if (expected !== 'CURRENT') {
        expect(observation?.reasonCode).not.toBe('VERIFIED_STRUCTURED_ACTIVITY_AND_ACTOR_SOURCE');
      }
    },
  );

  it('refreshes from source on each restart and isolates a partial actor failure', async () => {
    const configuration = await externalConfiguration();
    const first = await createCoordinator(configuration, observationRunner());
    await first.start();
    const second = await createCoordinator(configuration, observationRunner({ tmuxMode: 'FAILED' }));
    await second.start();

    expect(first.snapshot().refreshSequence).toBe(1);
    expect(first.snapshot().actors['fable5-role']?.presentation).toBe('CURRENT');
    expect(second.snapshot().refreshSequence).toBe(1);
    expect(second.snapshot().actors['fable5-role']?.presentation).toBe('ERROR');
    expect(second.snapshot().actors['advisor-role']?.presentation).toBe('CURRENT');
  });

  it('requires the production runtime config argument and never supplies a fixture fallback', () => {
    expect(() => parseArguments(['--state-root', '/tmp/agent-office-state']))
      .toThrow(expect.objectContaining({ code: 'INVALID_SCHEMA' }));
    expect(parseArguments([
      '--state-root',
      '/tmp/agent-office-state',
      '--runtime-config',
      '/tmp/agent-office-operational.json',
    ])).toMatchObject({ operationalConfigPath: '/tmp/agent-office-operational.json' });
  });
});

type MutableOperationalConfiguration = {
  -readonly [K in keyof OperationalRuntimeConfiguration]:
    OperationalRuntimeConfiguration[K] extends readonly (infer T)[] ? T[] : OperationalRuntimeConfiguration[K];
};

async function externalConfiguration(): Promise<MutableOperationalConfiguration> {
  const base = await operationalRuntimeConfiguration();
  const manifestBytes = await readFile(path.join(foundationRoot, manifestRelativePath));
  const artifactPath = 'fixtures/manifests/agent-office-m01.v1.source.json';
  const artifactBytes = await readFile(path.join(projectRoot, artifactPath));
  const configuration = {
    ...base,
    projects: [
      ...base.projects,
      {
        projectId: 'foundation-docs',
        displayName: 'Foundation Docs',
        hostId: 'local-host',
        roots: [{
          rootId: 'foundation-root',
          absolutePath: foundationRoot,
          capabilities: ['GIT', 'MANIFEST', 'ARTIFACT'] as const,
        }],
      },
    ],
    gitSources: [
      ...base.gitSources,
      {
        sourceId: 'foundation-git',
        projectId: 'foundation-docs',
        rootId: 'foundation-root',
        limits: { timeoutMs: 1_000, maxOutputBytes: 64 * 1024 },
        refNamespaces: [],
        commitPairs: [],
      },
    ],
    manifestSources: [{
      sourceId: 'external-mission-manifest',
      projectId: 'foundation-docs',
      rootId: 'foundation-root',
      relativePath: manifestRelativePath,
      maxBytes: 128 * 1024,
      sourceMetadata: {
        schemaVersion: 'agent-office.manifest-source.v1' as const,
        repository: 'foundation-docs',
        commit: 'b'.repeat(40),
        path: manifestRelativePath,
        sha256: sha256Bytes(manifestBytes),
      },
      gitSourceId: 'foundation-git',
    }],
    artifactSources: [{
      artifactId: 'runtime-source-evidence',
      projectId: 'agent-office',
      sourceId: 'runtime-source-artifact',
      rootId: 'agent-office-root',
      relativePath: artifactPath,
      maxBytes: 16 * 1024,
      expectedSha256: sha256Bytes(artifactBytes),
      expectedCommit: 'a'.repeat(40),
      gitSourceId: 'agent-office-git',
    }],
    actors: base.actors.map((actor) => {
      if (actor.stationId === 'advisor') {
        return { ...actor, workUnitIds: [...actor.workUnitIds, 'AO-WU-16', 'AO-WU-21'] };
      }
      if (actor.stationId === 'fable5') {
        return { ...actor, workUnitIds: [...actor.workUnitIds, 'AO-WU-18', 'AO-WU-20'] };
      }
      if (actor.stationId === 'agent-office') {
        return {
          ...actor,
          artifactIds: ['runtime-source-evidence'],
          workUnitIds: [...actor.workUnitIds, 'AO-WU-17', 'AO-WU-19'],
        };
      }
      return { ...actor };
    }),
    missionSourceId: 'external-mission-manifest',
  } satisfies OperationalRuntimeConfiguration;
  return configuration as MutableOperationalConfiguration;
}

function observationRunner(
  mode: {
    readonly manifestGitMode?: 'FAILED' | 'STALE';
    readonly actorGitMode?: 'DIRTY' | 'UNVERIFIED';
    readonly tmuxMode?: 'STALE' | 'OFFLINE' | 'IDENTITY_MISMATCH' | 'FAILED';
    readonly tmuxPaneId?: '%2' | '%4';
  } = {},
): ReadonlyToolRunner {
  const base = currentObservationRunner();
  return {
    readGit: async (request) => {
      if (request.cwd === foundationRoot) return manifestGitResult(request, mode.manifestGitMode);
      const result = await base.readGit(request);
      if (mode.actorGitMode === 'DIRTY' && request.kind === 'STATUS') {
        return toolResult('? actor-state.tmp\u0000');
      }
      if (
        mode.actorGitMode === 'UNVERIFIED' &&
        (request.kind === 'UPSTREAM_NAME' || request.kind === 'UPSTREAM_COMMIT')
      ) {
        return toolResult('', 1);
      }
      return result;
    },
    readTmux: async (request) => {
      const result = await base.readTmux(request);
      if (request.paneId !== (mode.tmuxPaneId ?? '%4') || mode.tmuxMode === undefined) return result;
      if (mode.tmuxMode === 'FAILED') return toolResult('', 1);
      const fields = Buffer.from(result.stdout).toString('utf8').replace(/\n$/u, '').split('\u001f');
      if (mode.tmuxMode === 'IDENTITY_MISMATCH') fields[0] = '$999';
      if (mode.tmuxMode === 'STALE') fields[10] = String((Date.parse(FIXED_TIME) - 60_000) / 1000);
      if (mode.tmuxMode === 'OFFLINE') fields[10] = String((Date.parse(FIXED_TIME) - 120_000) / 1000);
      return toolResult(`${fields.join('\u001f')}\n`);
    },
  };
}

function manifestGitResult(
  request: GitReadRequest,
  mode?: 'FAILED' | 'STALE',
): ToolReadResult {
  if (mode === 'FAILED') return toolResult('', 1);
  const commit = mode === 'STALE' ? 'c'.repeat(40) : 'b'.repeat(40);
  switch (request.kind) {
    case 'TOP_LEVEL':
      return toolResult(`${foundationRoot}\n`);
    case 'HEAD':
    case 'UPSTREAM_COMMIT':
      return toolResult(`${commit}\n`);
    case 'UPSTREAM_NAME':
      return toolResult('origin/main\n');
    case 'STATUS':
    case 'ALLOWLISTED_REFS':
    case 'COMMIT_DIFF':
    case 'ANCESTRY':
      return toolResult('');
  }
}

function toolResult(stdout: string, exitCode = 0): ToolReadResult {
  return {
    exitCode,
    stdout: Buffer.from(stdout, 'utf8'),
    stderr: new Uint8Array(),
    completedAt: FIXED_TIME,
  };
}

async function createCoordinator(
  configuration: OperationalRuntimeConfiguration,
  runner: ReadonlyToolRunner,
): Promise<RuntimeObservationCoordinator> {
  return RuntimeObservationCoordinator.create({
    configuration,
    runner,
    now: () => FIXED_TIME,
  });
}

function withoutTmux(actor: OperationalRuntimeConfiguration['actors'][number]) {
  const { tmuxSourceId: ignored, ...withoutSource } = actor;
  void ignored;
  return withoutSource;
}

function activeAdvisorProjection(manifest: MissionManifest): {
  readonly projection: ReturnType<typeof createInitialProjection>;
  readonly events: readonly EventEnvelope[];
} {
  const activityFixtureManifest: MissionManifest = {
    ...manifest,
    workUnits: manifest.workUnits.map((workUnit) => {
      if (workUnit.id !== 'AO-WU-15') return workUnit;
      return {
        id: workUnit.id,
        phase: workUnit.phase,
        actor: workUnit.actor,
        title: workUnit.title,
        status: 'WAITING_DEPENDENCY',
        dependsOn: workUnit.dependsOn,
        initialState: 'WAITING_DEPENDENCY',
        requiredObservableName: 'WAITING_DEPENDENCY',
      };
    }),
  };
  let projection = createInitialProjection(activityFixtureManifest);
  const inputs = [
    {
      eventType: 'WorkUnitStateTransitioned' as const,
      payload: { workUnitId: 'AO-WU-15', from: 'WAITING_DEPENDENCY', to: 'READY' },
    },
    {
      eventType: 'WorkUnitStateTransitioned' as const,
      payload: { workUnitId: 'AO-WU-15', from: 'READY', to: 'DISPATCHED' },
    },
    {
      eventType: 'WorkUnitStateTransitioned' as const,
      payload: { workUnitId: 'AO-WU-15', from: 'DISPATCHED', to: 'RUNNING' },
    },
    {
      eventType: 'RoleActivityChanged' as const,
      payload: {
        workUnitId: 'AO-WU-15',
        activity: 'WORKING',
        reasonCode: 'STRUCTURED_TEST_ACTIVITY',
        sourceEventIds: [uuidV7(9304)],
        effectiveFrom: FIXED_TIME,
      },
    },
  ];
  const events: EventEnvelope[] = [];
  let previousEventHash: string = GENESIS_EVENT_HASH;
  for (const [index, input] of inputs.entries()) {
    const sequence = index + 1;
    const event = createEvent({
      eventId: uuidV7(9301 + index),
      eventType: input.eventType,
      missionId: manifest.missionId,
      sequence,
      manifestVersion: manifest.manifestVersion,
      requestId: uuidV7(9401 + index),
      correlationId: uuidV7(9501),
      causationId: uuidV7(9601 + index),
      actor: { role: 'Advisor', subjectId: 'structured-test' },
      occurredAt: FIXED_TIME,
      receivedAt: FIXED_TIME,
      recordedAt: FIXED_TIME,
      previousEventHash,
      payload: input.payload,
    });
    events.push(event);
    projection = applyMissionEvent(projection, event);
    previousEventHash = event.eventHash;
  }
  return { projection, events };
}
