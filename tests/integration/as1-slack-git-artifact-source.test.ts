import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { NodeAs1GitArtifactSource, type As1GitObservation } from '../../src/adapters/gateways/slack-pilot/git-artifact-source.js';

/** Narrow a READY observation's accepted (commit, hash) pair without a banned non-null assertion. */
function acceptedOf(o: As1GitObservation): { readonly firstAddCommit: string; readonly blobSha256: string } {
  if (o.firstAddCommit === null || o.blobSha256 === null) throw new Error('expected a READY observation');
  return { firstAddCommit: o.firstAddCommit, blobSha256: o.blobSha256 };
}

const GIT_ENV = {
  PATH: process.env.PATH ?? '/usr/bin:/bin',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  HOME: '/nonexistent',
  LC_ALL: 'C',
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@example.invalid',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@example.invalid',
};

function git(cwd: string, ...args: readonly string[]): string {
  return execFileSync('/usr/bin/git', ['-C', cwd, ...args], { env: GIT_ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

const ARTIFACT_PATH = 'advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/receive-grant.json';
const UPSTREAM = 'refs/heads/test-upstream';

async function commitArtifact(repo: string, content: string): Promise<void> {
  const full = path.join(repo, ARTIFACT_PATH);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, content, 'utf8');
  git(repo, 'add', ARTIFACT_PATH);
  git(repo, 'commit', '-q', '-m', 'add artifact');
}

async function makeRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'as1-git-source-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'commit.gpgsign', 'false');
  return dir;
}

function source(repo: string): NodeAs1GitArtifactSource {
  return new NodeAs1GitArtifactSource(repo, 'foundation-docs', UPSTREAM);
}

describe('AS1 fixed-root read-only Git artifact source', () => {
  it('observes a committed AND pushed fixed-path artifact as READY with its immutable bytes', async () => {
    const repo = await makeRepo();
    await commitArtifact(repo, '{"schemaVersion":"x"}\n');
    git(repo, 'branch', 'test-upstream'); // the "pushed" upstream tip contains the artifact
    const observation = await source(repo).observe(ARTIFACT_PATH);
    expect(observation.status).toBe('READY');
    expect(observation.bytes?.toString('utf8')).toBe('{"schemaVersion":"x"}\n');
    expect(observation.firstAddCommit).toMatch(/^[0-9a-f]{40}$/u);
    expect(observation.blobSha256).toMatch(/^sha256:[0-9a-f]{64}$/u);
    await rm(repo, { recursive: true, force: true });
  });

  it('reports NOT_READY (no side effect) for an absent path', async () => {
    const repo = await makeRepo();
    await commitArtifact(repo, '{"a":1}\n');
    git(repo, 'branch', 'test-upstream');
    const observation = await source(repo).observe('advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/missing.json');
    expect(observation.status).toBe('NOT_READY');
    expect(observation.bytes).toBeNull();
    await rm(repo, { recursive: true, force: true });
  });

  it('reports NOT_READY for a committed-but-unpushed artifact (not in the upstream ancestry)', async () => {
    const repo = await makeRepo();
    // Seed the upstream branch first with an UNRELATED commit, then commit the artifact only on main (unpushed).
    await writeFile(path.join(repo, 'seed.txt'), 'seed\n', 'utf8');
    git(repo, 'add', 'seed.txt');
    git(repo, 'commit', '-q', '-m', 'seed');
    git(repo, 'branch', 'test-upstream');
    await commitArtifact(repo, '{"unpushed":true}\n');
    const observation = await source(repo).observe(ARTIFACT_PATH);
    expect(observation.status).toBe('NOT_READY');
    expect(observation.reason).toBe('NOT_IN_PUSHED_HISTORY');
    await rm(repo, { recursive: true, force: true });
  });

  it('reports NOT_READY for an uncommitted (dirty) working-tree change at the fixed path', async () => {
    const repo = await makeRepo();
    await commitArtifact(repo, '{"a":1}\n');
    git(repo, 'branch', 'test-upstream');
    await writeFile(path.join(repo, ARTIFACT_PATH), '{"a":2}\n', 'utf8'); // dirty, uncommitted
    const observation = await source(repo).observe(ARTIFACT_PATH);
    expect(observation.status).toBe('NOT_READY');
    await rm(repo, { recursive: true, force: true });
  });

  it('reports DIVERGED once accepted when the committed content is rewritten', async () => {
    const repo = await makeRepo();
    await commitArtifact(repo, '{"v":1}\n');
    git(repo, 'branch', '-f', 'test-upstream', 'HEAD');
    const first = await source(repo).observe(ARTIFACT_PATH);
    expect(first.status).toBe('READY');
    const accepted = acceptedOf(first);
    // Rewrite the committed content and advance the pushed upstream — a committed rewrite is a durable divergence.
    await writeFile(path.join(repo, ARTIFACT_PATH), '{"v":2}\n', 'utf8');
    git(repo, 'add', ARTIFACT_PATH);
    git(repo, 'commit', '-q', '-m', 'rewrite');
    git(repo, 'branch', '-f', 'test-upstream', 'HEAD');
    const second = await source(repo).observe(ARTIFACT_PATH, accepted);
    expect(second.status).toBe('DIVERGED');
    expect(second.reason).toBe('CONTENT_DIVERGED');
    await rm(repo, { recursive: true, force: true });
  });

  it('reports DIVERGED once accepted when the path is deleted', async () => {
    const repo = await makeRepo();
    await commitArtifact(repo, '{"v":1}\n');
    git(repo, 'branch', '-f', 'test-upstream', 'HEAD');
    const first = await source(repo).observe(ARTIFACT_PATH);
    const accepted = acceptedOf(first);
    git(repo, 'rm', '-q', ARTIFACT_PATH);
    git(repo, 'commit', '-q', '-m', 'delete');
    git(repo, 'branch', '-f', 'test-upstream', 'HEAD');
    const second = await source(repo).observe(ARTIFACT_PATH, accepted);
    expect(second.status).toBe('DIVERGED');
    await rm(repo, { recursive: true, force: true });
  });

  it('never fetches and rejects an unsafe path without touching git', async () => {
    const repo = await makeRepo();
    const observation = await source(repo).observe('../../etc/passwd');
    expect(observation.status).toBe('NOT_READY');
    expect(observation.reason).toBe('PATH_UNSAFE');
    await rm(repo, { recursive: true, force: true });
  });
});
