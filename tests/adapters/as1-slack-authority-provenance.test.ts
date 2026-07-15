import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { hashCanonical } from '../../src/persistence/file-store/hashing.js';
import { parseReceiveGrant, parsePointerDeliveryGrant } from '../../src/application/slack-pilot/contracts.js';
import { parseReadinessLease } from '../../src/adapters/gateways/slack-pilot/exact-authority.js';
import { nodeGitRunner } from '../../src/adapters/gateways/slack-pilot/git-provenance.js';
import {
  GitAs1DeliveryProvenanceGate,
  GitAs1ReceiveGrantProvenanceGate,
  NodeAs1AuthorityProvenanceVerifier,
  type As1AuthorityArtifactRef,
} from '../../src/adapters/gateways/slack-pilot/authority-provenance.js';
import { validPointerDeliveryGrant, validReadinessLease, validReceiveGrant } from '../helpers/as1-slack-fakes.js';

const run = promisify(execFile);
const GIT_ENV = { PATH: process.env.PATH ?? '/usr/bin:/bin', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', HOME: '/nonexistent' };

async function git(cwd: string, ...args: readonly string[]): Promise<string> {
  const { stdout } = await run('git', args, { cwd, env: GIT_ENV, maxBuffer: 1_000_000 });
  return stdout.trim();
}

const GRANT_PATH = 'advisor/jobs/20260714_as1/authority/agent-office-advisor/receive-grant-0001.json';

/** Build a throwaway repo: two frozen authority snapshots, then the committed grant artifact at GRANT_PATH. */
async function makeRepo(grantBytes: string): Promise<{ root: string; snapshots: [string, string]; grantCommit: string }> {
  const root = await mkdtemp(path.join(tmpdir(), 'as1-auth-prov-'));
  await git(root, 'init', '-q', '-b', 'main');
  await git(root, 'config', 'user.email', 'test@example.invalid');
  await git(root, 'config', 'user.name', 'as1-test');
  await git(root, 'config', 'commit.gpgsign', 'false');

  await writeFile(path.join(root, 'gov.txt'), 'frozen governance snapshot\n', 'utf8');
  await git(root, 'add', 'gov.txt');
  await git(root, 'commit', '-q', '-m', 'governance snapshot');
  const s1 = await git(root, 'rev-parse', 'HEAD');

  await writeFile(path.join(root, 'registry.txt'), 'frozen registry snapshot\n', 'utf8');
  await git(root, 'add', 'registry.txt');
  await git(root, 'commit', '-q', '-m', 'registry snapshot');
  const s2 = await git(root, 'rev-parse', 'HEAD');

  await mkdir(path.join(root, path.dirname(GRANT_PATH)), { recursive: true });
  await writeFile(path.join(root, GRANT_PATH), grantBytes);
  await git(root, 'add', '--', GRANT_PATH);
  await git(root, 'commit', '-q', '-m', 'add receive grant');
  const grantCommit = await git(root, 'rev-parse', 'HEAD');

  return { root, snapshots: [s1, s2], grantCommit };
}

describe('AS1 real read-only authority-artifact Git provenance (B04)', () => {
  const grant = parseReceiveGrant(validReceiveGrant());
  const grantBytes = JSON.stringify(grant);

  function refFor(commit: string, overrides: Partial<As1AuthorityArtifactRef> = {}): As1AuthorityArtifactRef {
    return { repositoryId: 'agent-office', path: GRANT_PATH, sourceCommit: commit, expectedCanonicalHash: hashCanonical(grant), ...overrides };
  }

  it('verifies a committed, pushed, clean, first-added, snapshot-descended authority blob byte-for-byte', async () => {
    const repo = await makeRepo(grantBytes);
    const verifier = new NodeAs1AuthorityProvenanceVerifier(repo.root, 'agent-office', 'HEAD', nodeGitRunner());
    expect(await verifier.verify(refFor(repo.grantCommit), repo.snapshots)).toStrictEqual({
      upstreamAncestral: true,
      firstAddition: true,
      dirty: false,
      contentVerified: true,
      descendsFromSnapshots: true,
    });
  });

  it('fails content verification when the committed bytes are not the exact grant', async () => {
    const repo = await makeRepo(JSON.stringify({ ...grant, pilotId: 'as1-pilot-tampered' }));
    const verifier = new NodeAs1AuthorityProvenanceVerifier(repo.root, 'agent-office', 'HEAD', nodeGitRunner());
    expect((await verifier.verify(refFor(repo.grantCommit), repo.snapshots)).contentVerified).toBe(false);
  });

  it('denies a foreign repository id, and denies when the source commit does not descend from both snapshots', async () => {
    const repo = await makeRepo(grantBytes);
    const verifier = new NodeAs1AuthorityProvenanceVerifier(repo.root, 'agent-office', 'HEAD', nodeGitRunner());
    // Foreign repository id -> full deny.
    expect(await verifier.verify(refFor(repo.grantCommit, { repositoryId: 'foundation-docs' }), repo.snapshots)).toStrictEqual({
      upstreamAncestral: false,
      firstAddition: false,
      dirty: true,
      contentVerified: false,
      descendsFromSnapshots: false,
    });
    // A well-formed but non-existent snapshot commit is not an ancestor of the grant commit -> not descended.
    expect(
      (await verifier.verify(refFor(repo.grantCommit), [repo.snapshots[0], 'a'.repeat(40)])).descendsFromSnapshots,
    ).toBe(false);
  });

  it('reports dirty when the committed authority path has an uncommitted change', async () => {
    const repo = await makeRepo(grantBytes);
    await writeFile(path.join(repo.root, GRANT_PATH), `${grantBytes}\n// tampered`);
    const verifier = new NodeAs1AuthorityProvenanceVerifier(repo.root, 'agent-office', 'HEAD', nodeGitRunner());
    expect((await verifier.verify(refFor(repo.grantCommit), repo.snapshots)).dirty).toBe(true);
  });

  it('GitAs1ReceiveGrantProvenanceGate accepts a fully valid grant and fails closed on any unmet gate', async () => {
    const repo = await makeRepo(grantBytes);
    const verifier = new NodeAs1AuthorityProvenanceVerifier(repo.root, 'agent-office', 'HEAD', nodeGitRunner());
    const accept = new GitAs1ReceiveGrantProvenanceGate(verifier, () => ({ path: GRANT_PATH, sourceCommit: repo.grantCommit }), repo.snapshots);
    await expect(accept.assertAccepted(grant)).resolves.toBeUndefined();

    // Point the location resolver at a non-existent commit -> provenance fails -> the gate refuses.
    const reject = new GitAs1ReceiveGrantProvenanceGate(verifier, () => ({ path: GRANT_PATH, sourceCommit: 'f'.repeat(40) }), repo.snapshots);
    await expect(reject.assertAccepted(grant)).rejects.toBeInstanceOf(DomainError);
  });

  it('GitAs1DeliveryProvenanceGate accepts a valid pointer-delivery grant and rejects a mismatched lease', async () => {
    const deliveryGrant = parsePointerDeliveryGrant(validPointerDeliveryGrant());
    const repo = await makeRepo(JSON.stringify(deliveryGrant));
    const verifier = new NodeAs1AuthorityProvenanceVerifier(repo.root, 'agent-office', 'HEAD', nodeGitRunner());
    const gate = new GitAs1DeliveryProvenanceGate(verifier, () => ({ path: GRANT_PATH, sourceCommit: repo.grantCommit }), repo.snapshots);
    const lease = parseReadinessLease(validReadinessLease({ pointerDeliveryGrantId: deliveryGrant.pointerDeliveryGrantId }));
    await expect(gate.assertAccepted(deliveryGrant, lease)).resolves.toBeUndefined();

    const foreignLease = parseReadinessLease(validReadinessLease({ pointerDeliveryGrantId: 'as1-pdg-other-0002' }));
    await expect(gate.assertAccepted(deliveryGrant, foreignLease)).rejects.toBeInstanceOf(DomainError);
  });
});
