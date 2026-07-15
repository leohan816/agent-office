import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { sha256Bytes } from '../../src/persistence/file-store/hashing.js';
import {
  NodeAs1GitProvenanceVerifier,
  nodeGitRunner,
  type As1GitRunner,
} from '../../src/adapters/gateways/slack-pilot/git-provenance.js';
import type { As1EvidenceRef } from '../../src/application/slack-pilot/evidence-ingress.js';

const run = promisify(execFile);
const GIT_ENV = { PATH: process.env.PATH ?? '/usr/bin:/bin', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', HOME: '/nonexistent' };

async function git(cwd: string, ...args: readonly string[]): Promise<string> {
  const { stdout } = await run('git', args, { cwd, env: GIT_ENV, maxBuffer: 1_000_000 });
  return stdout.trim();
}

const EVIDENCE_PATH = 'advisor/jobs/20260714_as1/runtime-evidence/agent-office-advisor/as1-intake-0001/ack.json';
const EVIDENCE_BYTES = Buffer.from('{"schemaVersion":"agent-office.as1-advisor-ack.v1"}\n', 'utf8');

/** Build a throwaway local git repo: two snapshot commits, then the evidence file, all committed to HEAD. */
async function makeRepo(): Promise<{ root: string; snapshots: [string, string]; evidenceCommit: string }> {
  const root = await mkdtemp(path.join(tmpdir(), 'as1-git-prov-'));
  await git(root, 'init', '-q', '-b', 'main');
  await git(root, 'config', 'user.email', 'test@example.invalid');
  await git(root, 'config', 'user.name', 'as1-test');
  await git(root, 'config', 'commit.gpgsign', 'false');

  await writeFile(path.join(root, 'snap1.txt'), 'frozen snapshot 1\n', 'utf8');
  await git(root, 'add', 'snap1.txt');
  await git(root, 'commit', '-q', '-m', 'snapshot 1');
  const s1 = await git(root, 'rev-parse', 'HEAD');

  await writeFile(path.join(root, 'snap2.txt'), 'frozen snapshot 2\n', 'utf8');
  await git(root, 'add', 'snap2.txt');
  await git(root, 'commit', '-q', '-m', 'snapshot 2');
  const s2 = await git(root, 'rev-parse', 'HEAD');

  await mkdir(path.join(root, path.dirname(EVIDENCE_PATH)), { recursive: true });
  await writeFile(path.join(root, EVIDENCE_PATH), EVIDENCE_BYTES);
  await git(root, 'add', '--', EVIDENCE_PATH);
  await git(root, 'commit', '-q', '-m', 'add ack evidence');
  const evidenceCommit = await git(root, 'rev-parse', 'HEAD');

  return { root, snapshots: [s1, s2], evidenceCommit };
}

function refFor(commit: string): As1EvidenceRef {
  return { repositoryId: 'agent-office', sourceCommit: commit, path: EVIDENCE_PATH, blobSha256: sha256Bytes(EVIDENCE_BYTES) };
}

describe('AS1 real read-only Git/content provenance verifier (B06)', () => {
  it('verifies a committed, upstream-ancestral, single-addition, snapshot-descended blob byte-for-byte', async () => {
    const repo = await makeRepo();
    const verifier = new NodeAs1GitProvenanceVerifier(repo.root, 'agent-office', 'HEAD', nodeGitRunner());
    const result = await verifier.verify(refFor(repo.evidenceCommit), repo.snapshots);
    expect(result).toStrictEqual({
      upstreamAncestral: true,
      firstAddition: true,
      dirty: false,
      contentVerified: true,
      descendsFromBothSnapshots: true,
    });
  });

  it('fails content verification when the claimed blob hash does not match the committed bytes', async () => {
    const repo = await makeRepo();
    const verifier = new NodeAs1GitProvenanceVerifier(repo.root, 'agent-office', 'HEAD', nodeGitRunner());
    const result = await verifier.verify({ ...refFor(repo.evidenceCommit), blobSha256: `sha256:${'9'.repeat(64)}` }, repo.snapshots);
    expect(result.contentVerified).toBe(false);
  });

  it('denies everything for a wrong repository id, a malformed commit, or an unsafe path', async () => {
    const repo = await makeRepo();
    const verifier = new NodeAs1GitProvenanceVerifier(repo.root, 'agent-office', 'HEAD', nodeGitRunner());
    const denied = { upstreamAncestral: false, firstAddition: false, dirty: true, contentVerified: false, descendsFromBothSnapshots: false };
    expect(await verifier.verify({ ...refFor(repo.evidenceCommit), repositoryId: 'other' }, repo.snapshots)).toStrictEqual(denied);
    expect(await verifier.verify({ ...refFor(repo.evidenceCommit), sourceCommit: 'not-a-sha' }, repo.snapshots)).toStrictEqual(denied);
    expect(await verifier.verify({ ...refFor(repo.evidenceCommit), path: '../escape.json' }, repo.snapshots)).toStrictEqual(denied);
    // Missing/short snapshot commit list denies as well (no descent proof possible).
    expect(await verifier.verify(refFor(repo.evidenceCommit), [repo.snapshots[0]])).toStrictEqual(denied);
  });

  it('denies a snapshot-descent when the source commit does not descend from both frozen snapshots (fake runner)', async () => {
    // A deterministic fake runner: the second `merge-base --is-ancestor` (snapshot 2) fails.
    let ancestorCalls = 0;
    const runner: As1GitRunner = (_root, args) => {
      if (args[0] === 'rev-parse') return Promise.resolve({ code: 0, stdout: Buffer.from('') });
      if (args[0] === 'cat-file') return Promise.resolve({ code: 0, stdout: EVIDENCE_BYTES });
      if (args[0] === 'log') return Promise.resolve({ code: 0, stdout: Buffer.from(`${'a'.repeat(40)}\n`) });
      if (args[0] === 'status') return Promise.resolve({ code: 0, stdout: Buffer.from('') });
      if (args[0] === 'merge-base') {
        // first call = upstream-ancestral; then two snapshot-descent calls (fail the 2nd).
        ancestorCalls += 1;
        return Promise.resolve({ code: ancestorCalls === 3 ? 1 : 0, stdout: Buffer.from('') });
      }
      return Promise.resolve({ code: 1, stdout: Buffer.from('') });
    };
    const verifier = new NodeAs1GitProvenanceVerifier('/repo', 'agent-office', 'origin/main', runner);
    const result = await verifier.verify(refFor('d'.repeat(40)), ['b'.repeat(40), 'c'.repeat(40)]);
    expect(result.upstreamAncestral).toBe(true);
    expect(result.contentVerified).toBe(true);
    expect(result.descendsFromBothSnapshots).toBe(false);
  });
});
