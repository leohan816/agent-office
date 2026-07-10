import { mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { LocalArtifactSource } from '../../src/adapters/observations/artifacts/source.js';
import { LocalMissionManifestSource } from '../../src/adapters/observations/manifest/source.js';
import type {
  GitCommitDiffEntry,
  GitObservationSource,
  GitRefObservation,
  GitRepositoryObservation,
} from '../../src/adapters/observations/ports.js';
import { createLocalProjectRegistry, type LocalProjectRegistry } from '../../src/application/projects/registry.js';
import type { ManifestSourceMetadata } from '../../src/domain/manifest/index.js';
import { sha256Bytes } from '../../src/persistence/file-store/hashing.js';

const COMMIT = 'a'.repeat(40);

describe('bounded manifest and artifact observation', () => {
  it('reads a regular allowlisted artifact and verifies hash, commit, and clean path', async () => {
    const fixture = await makeFixture();
    const bytes = Buffer.from('immutable evidence\n');
    await writeFile(path.join(fixture.root, 'evidence.txt'), bytes);
    const source = artifactSource(fixture.registry, bytes, new StubGitSource(gitObservation()));

    const result = await source.read('evidence');

    expect(result.status).toBe('VERIFIED');
    expect(result.bytes).toEqual(bytes);
    expect(result.evidence).toMatchObject({
      relativePath: 'evidence.txt',
      sha256: sha256Bytes(bytes),
      commit: COMMIT,
      status: 'VERIFIED',
    });
  });

  it.each([
    { changedPaths: ['evidence.txt'], headCommit: COMMIT, expected: 'DIRTY' },
    { changedPaths: [], headCommit: 'b'.repeat(40), expected: 'STALE' },
  ] as const)('reports $expected evidence explicitly', async ({ changedPaths, headCommit, expected }) => {
    const fixture = await makeFixture();
    const bytes = Buffer.from('immutable evidence\n');
    await writeFile(path.join(fixture.root, 'evidence.txt'), bytes);
    const git = new StubGitSource(gitObservation({ changedPaths, headCommit }));
    await expect(artifactSource(fixture.registry, bytes, git).read('evidence')).resolves.toMatchObject({
      status: expected,
      evidence: { status: expected },
    });
  });

  it('reports missing, hash mismatch, oversize, symlink, and non-regular files without reading through them', async () => {
    const fixture = await makeFixture();
    const expectedBytes = Buffer.from('expected');
    const git = new StubGitSource(gitObservation());
    await expect(artifactSource(fixture.registry, expectedBytes, git).read('evidence')).resolves.toMatchObject({
      status: 'MISSING',
      evidence: { errorCode: 'FILE_MISSING' },
    });

    await writeFile(path.join(fixture.root, 'evidence.txt'), 'different');
    await expect(artifactSource(fixture.registry, expectedBytes, git).read('evidence')).resolves.toMatchObject({
      status: 'INVALID',
      evidence: { errorCode: 'HASH_MISMATCH' },
    });

    const oversize = new LocalArtifactSource(fixture.registry, undefined, [
      registration(sha256Bytes('different'), 3),
    ]);
    await expect(oversize.read('evidence')).resolves.toMatchObject({
      status: 'INVALID',
      evidence: { errorCode: 'SIZE_LIMIT_EXCEEDED' },
    });

    await symlink('evidence.txt', path.join(fixture.root, 'linked.txt'));
    const linked = new LocalArtifactSource(fixture.registry, undefined, [
      { ...registration(sha256Bytes('different')), artifactId: 'linked', relativePath: 'linked.txt' },
    ]);
    await expect(linked.read('linked')).resolves.toMatchObject({
      status: 'INVALID',
      evidence: { errorCode: 'SYMLINK_REJECTED' },
    });

    const deviceRegistry = await createLocalProjectRegistry([
      {
        projectId: 'device-fixture',
        displayName: 'Device Fixture',
        hostId: 'local-host',
        roots: [{ rootId: 'device-root', absolutePath: '/dev', capabilities: ['ARTIFACT'] }],
      },
    ]);
    const device = new LocalArtifactSource(deviceRegistry, undefined, [
      {
        artifactId: 'null-device',
        projectId: 'device-fixture',
        sourceId: 'device-source',
        rootId: 'device-root',
        relativePath: 'null',
        maxBytes: 32,
        expectedSha256: sha256Bytes(''),
      },
    ]);
    await expect(device.read('null-device')).resolves.toMatchObject({
      status: 'INVALID',
      evidence: { errorCode: 'FILE_NOT_REGULAR' },
    });
  });

  it.each(['../outside', '/absolute', 'nested\\windows', 'nested/./file', 'nested//file']) (
    'rejects traversal or non-canonical configured paths: %s',
    async (relativePath) => {
      const fixture = await makeFixture();
      expect(
        () =>
          new LocalArtifactSource(fixture.registry, undefined, [
            { ...registration(sha256Bytes('x')), relativePath },
          ]),
      ).toThrow(expect.objectContaining({ code: 'PATH_REJECTED' }));
    },
  );

  it('imports a bounded manifest and marks clean, dirty, missing, and stale source states', async () => {
    const fixture = await makeFixture();
    const manifest = validManifest();
    const bytes = Buffer.from(`${JSON.stringify(manifest)}\n`, 'utf8');
    await writeFile(path.join(fixture.root, 'manifest.json'), bytes);
    const metadata: ManifestSourceMetadata = {
      schemaVersion: 'agent-office.manifest-source.v1',
      repository: 'fixture-repository',
      commit: COMMIT,
      path: 'manifest.json',
      sha256: sha256Bytes(bytes),
    };
    const verified = manifestSource(fixture.registry, metadata, new StubGitSource(gitObservation()));
    await expect(verified.read('manifest')).resolves.toMatchObject({
      status: 'VERIFIED',
      manifest: { missionId: 'FIXTURE_MISSION', manifestVersion: 1 },
    });

    const dirty = manifestSource(
      fixture.registry,
      metadata,
      new StubGitSource(gitObservation({ changedPaths: ['manifest.json'] })),
    );
    await expect(dirty.read('manifest')).resolves.toMatchObject({ status: 'DIRTY' });

    const stale = manifestSource(
      fixture.registry,
      metadata,
      new StubGitSource(gitObservation({ headCommit: 'c'.repeat(40) })),
    );
    await expect(stale.read('manifest')).resolves.toMatchObject({ status: 'STALE' });

    const missingMetadata = { ...metadata, path: 'missing.json' };
    const missing = new LocalMissionManifestSource(fixture.registry, undefined, [
      {
        sourceId: 'missing-manifest',
        projectId: 'fixture-project',
        rootId: 'fixture-root',
        relativePath: 'missing.json',
        maxBytes: 64 * 1024,
        sourceMetadata: missingMetadata,
      },
    ]);
    await expect(missing.read('missing-manifest')).resolves.toMatchObject({
      status: 'MISSING',
      evidence: { errorCode: 'FILE_MISSING' },
    });
  });
});

class StubGitSource implements GitObservationSource {
  public constructor(private readonly observation: GitRepositoryObservation) {}

  public observe(): Promise<GitRepositoryObservation> {
    return Promise.resolve(this.observation);
  }

  public listAllowlistedRefs(): Promise<readonly GitRefObservation[]> {
    return Promise.resolve([]);
  }

  public isConfiguredAncestor(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public diffConfiguredCommits(): Promise<readonly GitCommitDiffEntry[]> {
    return Promise.resolve([]);
  }
}

async function makeFixture(): Promise<{ readonly root: string; readonly registry: LocalProjectRegistry }> {
  const root = await mkdtemp(path.join(tmpdir(), 'agent-office-observed-file-'));
  const registry = await createLocalProjectRegistry([
    {
      projectId: 'fixture-project',
      displayName: 'Fixture Project',
      hostId: 'local-host',
      roots: [
        {
          rootId: 'fixture-root',
          absolutePath: root,
          capabilities: ['ARTIFACT', 'MANIFEST'],
        },
      ],
    },
  ]);
  return { root, registry };
}

function registration(expectedSha256: string, maxBytes = 64 * 1024) {
  return {
    artifactId: 'evidence',
    projectId: 'fixture-project',
    sourceId: 'artifact-source',
    rootId: 'fixture-root',
    relativePath: 'evidence.txt',
    maxBytes,
    expectedSha256,
    expectedCommit: COMMIT,
    gitSourceId: 'fixture-git',
  } as const;
}

function artifactSource(
  registry: LocalProjectRegistry,
  expectedBytes: Uint8Array,
  git: GitObservationSource,
): LocalArtifactSource {
  return new LocalArtifactSource(registry, git, [registration(sha256Bytes(expectedBytes))]);
}

function manifestSource(
  registry: LocalProjectRegistry,
  sourceMetadata: ManifestSourceMetadata,
  git: GitObservationSource,
): LocalMissionManifestSource {
  return new LocalMissionManifestSource(registry, git, [
    {
      sourceId: 'manifest',
      projectId: 'fixture-project',
      rootId: 'fixture-root',
      relativePath: 'manifest.json',
      maxBytes: 64 * 1024,
      sourceMetadata,
      gitSourceId: 'fixture-git',
    },
  ]);
}

function gitObservation(override: Partial<GitRepositoryObservation> = {}): GitRepositoryObservation {
  return {
    projectId: 'fixture-project',
    sourceId: 'fixture-git',
    rootId: 'fixture-root',
    topLevelRootId: 'fixture-root',
    headCommit: COMMIT,
    dirty: false,
    changedPaths: [],
    observedAt: '2026-07-10T20:00:00.000Z',
    ...override,
  };
}

function validManifest() {
  return {
    schemaVersion: 'agent-office.mission-manifest.v1',
    manifestVersion: 1,
    missionId: 'FIXTURE_MISSION',
    initiative: { id: 'FIXTURE_INITIATIVE', labelKo: '픽스처 묶음' },
    package: { id: 'FIXTURE_PACKAGE', labelKo: '픽스처 패키지' },
    approvedBy: 'Leo/GPT',
    counting: {
      denominator: 1,
      basis: 'Fixture only.',
      scopeChangeRequires: ['oldTotal', 'newTotal', 'changedWorkUnits', 'reason', 'approvingAuthority'],
    },
    workUnits: [
      {
        id: 'FIXTURE_WU_1',
        phase: 'ENTRY',
        actor: 'Advisor',
        title: 'Fixture',
        status: 'READY',
        dependsOn: [],
      },
    ],
    futureUnapprovedWork: [],
  };
}
