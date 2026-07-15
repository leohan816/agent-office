// AS1 Multi-Team Slack Pilot — real read-only, bounded Git/content provenance verifier.
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_DESIGN.md §13 (evidence source);
// docs/security/AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md §11 (evidence authority). This is the
// concrete implementation of the `As1GitProvenanceVerifier` port. It runs ONLY read-only git plumbing
// (rev-parse, cat-file, log, merge-base, status) through a closed argv array with shell:false, a fixed
// minimal environment (no terminal prompt, no system/global config, no network), and a hard output/time
// bound. It never mutates the repository, never fetches, and never accepts a repository or path from Slack.
// It reads the exact committed blob and compares its sha256 to the claimed blobSha256, proves the source
// commit descends from BOTH frozen authority snapshots, is upstream-ancestral, is a single first addition,
// and that the working tree is clean for that path. Any git failure or unmet gate yields a fail-closed
// (all-false) provenance; the ingress then quarantines and latches the profile.
import { execFile } from 'node:child_process';

import { sha256Bytes } from '../../../persistence/file-store/hashing.js';
import type { As1EvidenceProvenance, As1EvidenceRef, As1GitProvenanceVerifier } from '../../../application/slack-pilot/evidence-ingress.js';

const GIT_SHA1 = /^[0-9a-f]{40}$/u;
// A contained, printable, relative evidence path segment set. No leading slash, no `..`, no NUL, bounded.
const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,1024}$/u;

export interface As1GitRunResult {
  readonly code: number;
  readonly stdout: Buffer;
}

/** Run one bounded, read-only git command in the trusted repo. Injectable so tests can drive it deterministically. */
export type As1GitRunner = (repoRoot: string, args: readonly string[]) => Promise<As1GitRunResult>;

/** The real git runner: closed argv, shell:false (execFile), fixed minimal env, bounded output + timeout. */
export function nodeGitRunner(maxBytes = 65_536, timeoutMs = 5_000): As1GitRunner {
  return (repoRoot: string, args: readonly string[]): Promise<As1GitRunResult> =>
    new Promise<As1GitRunResult>((resolve, reject) => {
      execFile(
        'git',
        ['-C', repoRoot, ...args],
        {
          env: {
            PATH: process.env.PATH ?? '/usr/bin:/bin',
            GIT_TERMINAL_PROMPT: '0',
            GIT_CONFIG_NOSYSTEM: '1',
            GIT_CONFIG_GLOBAL: '/dev/null',
            HOME: '/nonexistent',
            LC_ALL: 'C',
          },
          maxBuffer: maxBytes,
          timeout: timeoutMs,
          encoding: 'buffer',
          windowsHide: true,
        },
        (error, stdout) => {
          const out = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
          if (error === null) {
            resolve({ code: 0, stdout: out });
            return;
          }
          // A non-zero EXIT CODE (number) is a normal git answer (e.g. `merge-base --is-ancestor` returns 1).
          if (typeof error.code === 'number') {
            resolve({ code: error.code, stdout: out });
            return;
          }
          // A signal, timeout, or maxBuffer overflow (string code) is a hard, fail-closed error.
          reject(error instanceof Error ? error : new Error('git provenance command failed'));
        },
      );
    });
}

const DENY_ALL: As1EvidenceProvenance = {
  upstreamAncestral: false,
  firstAddition: false,
  dirty: true,
  contentVerified: false,
  descendsFromBothSnapshots: false,
};

/**
 * The real read-only Git/content verifier. Bound at construction to the trusted repository root, its expected
 * repository id, the upstream ref, and the two frozen authority snapshot commits — never caller-supplied.
 */
export class NodeAs1GitProvenanceVerifier implements As1GitProvenanceVerifier {
  public constructor(
    private readonly repoRoot: string,
    private readonly expectedRepositoryId: string,
    private readonly upstreamRef: string,
    private readonly frozenSnapshotCommits: readonly string[],
    private readonly run: As1GitRunner = nodeGitRunner(),
  ) {}

  public async verify(ref: As1EvidenceRef): Promise<As1EvidenceProvenance> {
    // Nothing below can be selected by Slack; the repo/upstream/snapshots are fixed at construction.
    if (ref.repositoryId !== this.expectedRepositoryId) return DENY_ALL;
    if (!GIT_SHA1.test(ref.sourceCommit) || !SAFE_PATH.test(ref.path) || ref.path.includes('..')) return DENY_ALL;
    if (this.frozenSnapshotCommits.length !== 2 || !this.frozenSnapshotCommits.every((c) => GIT_SHA1.test(c))) {
      return DENY_ALL;
    }

    try {
      const commit = await this.run(this.repoRoot, ['rev-parse', '--verify', '--quiet', `${ref.sourceCommit}^{commit}`]);
      if (commit.code !== 0) return DENY_ALL;

      // Read the exact committed blob and compare its bytes to the claimed sha256 (the core missing check).
      const blob = await this.run(this.repoRoot, ['cat-file', 'blob', `${ref.sourceCommit}:${ref.path}`]);
      const contentVerified = blob.code === 0 && sha256Bytes(blob.stdout) === ref.blobSha256;

      // Exactly one commit ever ADDED this path (a single first-addition history).
      const addLog = await this.run(this.repoRoot, ['log', '--diff-filter=A', '--format=%H', '--', ref.path]);
      const firstAddition = addLog.code === 0 && nonEmptyLines(addLog.stdout).length === 1;

      // The source commit is an ancestor of the upstream tip (committed AND pushed).
      const ancestral = (await this.run(this.repoRoot, ['merge-base', '--is-ancestor', ref.sourceCommit, this.upstreamRef])).code === 0;

      // The working tree is clean for this exact path (no dirty/uncommitted change).
      const status = await this.run(this.repoRoot, ['status', '--porcelain', '--', ref.path]);
      const dirty = status.code !== 0 || nonEmptyLines(status.stdout).length > 0;

      // The source commit descends from BOTH frozen authority snapshot commits.
      let descendsFromBothSnapshots = true;
      for (const snap of this.frozenSnapshotCommits) {
        const r = await this.run(this.repoRoot, ['merge-base', '--is-ancestor', snap, ref.sourceCommit]);
        if (r.code !== 0) descendsFromBothSnapshots = false;
      }

      return { upstreamAncestral: ancestral, firstAddition, dirty, contentVerified, descendsFromBothSnapshots };
    } catch {
      // A timeout, oversize output, or missing git binary fails closed.
      return DENY_ALL;
    }
  }
}

function nonEmptyLines(stdout: Buffer): readonly string[] {
  return stdout
    .toString('utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
