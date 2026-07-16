// AS1 Multi-Team Slack Pilot — Phase B fixed-root, read-only Git artifact source (design §4.3).
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_PHASE_B_LIVE_COMPOSITION_DESIGN_DELTA.md §4.2/§4.3, §10.
// This is the missing production reader that OBSERVES the already-authorized receive grant, pointer-delivery
// grant, readiness lease, and evidence blobs at FIXED committed paths. It is distinct from git-provenance.ts
// (which verifies a claimed ref) and authority-provenance.ts (which proves grant provenance): this source only
// answers "is the fixed path committed AND pushed with a clean tree, and what are its immutable bytes?". The
// trusted governance repository root, repository id, upstream branch, and mission authority root are
// construction-bound constants — never a repository, path, ref, or clock from Slack or any caller. It uses the
// same bounded, closed-argv, shell:false, fixed-env `/usr/bin/git` runner as the provenance verifiers, never
// fetches, and never mutates. Before first acceptance, absence / an uncommitted file / an unpushed commit is
// NOT_READY (no side effect, no latch). After a particular (first-add commit, content hash) has been accepted,
// deletion, a dirty change, a committed rewrite, path reuse, an ancestry change, or content divergence is a
// durable divergence (DIVERGED) the composition turns into a profile latch.
import { sha256Bytes } from '../../../persistence/file-store/hashing.js';
import { nodeGitRunner, type As1GitRunner } from './git-provenance.js';

const GIT_SHA1 = /^[0-9a-f]{40}$/u;
// A contained, printable, relative artifact path segment set. No leading slash, no `..`, no NUL, bounded.
const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,1024}$/u;

/** The exact Phase B governance constants (design §4.3). Construction-bound — never a caller/Slack value. */
export const AS1_GOVERNANCE_REPO_ROOT =
  '/home/leo/Project/.worktrees/foundation-docs/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_PILOT_001';
export const AS1_GOVERNANCE_REPO_ID = 'foundation-docs';
export const AS1_GOVERNANCE_UPSTREAM_REF = 'refs/remotes/origin/advisor/as1-multi-team-slack-pilot-001';
export const AS1_MISSION_AUTHORITY_ROOT = 'advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001';

export type As1GitArtifactStatus = 'READY' | 'NOT_READY' | 'DIVERGED';

/** One read-only observation of a fixed committed path. Bytes are supplied only when READY, for the caller to parse. */
export interface As1GitObservation {
  readonly status: As1GitArtifactStatus;
  /** A stable redacted reason code — never a path body, blob content, or git error text. */
  readonly reason: string;
  /** The unique commit that FIRST added the path in the pushed upstream ancestry (READY only). */
  readonly firstAddCommit: string | null;
  /** sha256 of the exact committed blob at the upstream ref (READY only). */
  readonly blobSha256: string | null;
  /** The exact committed immutable blob bytes at the upstream ref (READY only) — never mutated. */
  readonly bytes: Buffer | null;
}

/**
 * A prior acceptance the source compares a re-observation against (design §4.3). It is an internally recorded
 * (first-add commit, content hash) pair, never a caller/Slack value. When supplied, any divergence from it — a
 * changed first-add commit (delete+re-add / path reuse / ancestry change), or a changed content hash (committed
 * rewrite), or an absent/dirty/unpushed path — is a durable DIVERGED, not a benign NOT_READY.
 */
export interface As1AcceptedArtifact {
  readonly firstAddCommit: string;
  readonly blobSha256: string;
}

/** The read-only observation surface the composition depends on (production: NodeAs1GitArtifactSource). */
export interface As1GitArtifactObserver {
  observe(relativePath: string, accepted?: As1AcceptedArtifact): Promise<As1GitObservation>;
  getRepositoryId(): string;
}

export class NodeAs1GitArtifactSource implements As1GitArtifactObserver {
  public constructor(
    private readonly repoRoot: string = AS1_GOVERNANCE_REPO_ROOT,
    private readonly repositoryId: string = AS1_GOVERNANCE_REPO_ID,
    private readonly upstreamRef: string = AS1_GOVERNANCE_UPSTREAM_REF,
    private readonly run: As1GitRunner = nodeGitRunner(),
  ) {}

  /** The construction-bound repository id, exposed for the composition to bind the same value into the grant gates. */
  public getRepositoryId(): string {
    return this.repositoryId;
  }

  /**
   * Observe one FIXED relative artifact path. The path is a construction/composition-derived contained ref, never a
   * Slack or caller value. `accepted` (when supplied) makes every divergence a durable DIVERGED; otherwise
   * absence / uncommitted / unpushed is NOT_READY with no side effect.
   */
  public async observe(relativePath: string, accepted?: As1AcceptedArtifact): Promise<As1GitObservation> {
    const notReadyOrDiverged = (reason: string): As1GitObservation => ({
      status: accepted !== undefined ? 'DIVERGED' : 'NOT_READY',
      reason,
      firstAddCommit: null,
      blobSha256: null,
      bytes: null,
    });
    if (!SAFE_PATH.test(relativePath) || relativePath.includes('..')) {
      return { status: 'NOT_READY', reason: 'PATH_UNSAFE', firstAddCommit: null, blobSha256: null, bytes: null };
    }
    try {
      // The pushed upstream tip must resolve to a commit; without it nothing is committed AND pushed.
      const tip = await this.run(this.repoRoot, ['rev-parse', '--verify', '--quiet', `${this.upstreamRef}^{commit}`]);
      if (tip.code !== 0) return notReadyOrDiverged('UPSTREAM_ABSENT');

      // The working tree must be clean for this exact path (no dirty/uncommitted change).
      const status = await this.run(this.repoRoot, ['status', '--porcelain', '--', relativePath]);
      if (status.code !== 0 || nonEmptyLines(status.stdout).length > 0) {
        return notReadyOrDiverged(accepted !== undefined ? 'WORKING_TREE_DIRTY' : 'UNCOMMITTED');
      }

      // Exactly one commit ADDED this path in the pushed upstream ancestry (single first addition, pushed).
      const addLog = await this.run(this.repoRoot, ['log', '--diff-filter=A', '--format=%H', this.upstreamRef, '--', relativePath]);
      if (addLog.code !== 0) return notReadyOrDiverged('LOG_FAILED');
      const additions = nonEmptyLines(addLog.stdout);
      if (additions.length === 0) return notReadyOrDiverged('NOT_IN_PUSHED_HISTORY');
      if (additions.length !== 1) return notReadyOrDiverged('NOT_SINGLE_FIRST_ADDITION');
      const firstAddCommit = additions[0];
      if (firstAddCommit === undefined || !GIT_SHA1.test(firstAddCommit)) return notReadyOrDiverged('LOG_MALFORMED');

      // The exact committed blob at the pushed upstream ref.
      const blob = await this.run(this.repoRoot, ['cat-file', 'blob', `${this.upstreamRef}:${relativePath}`]);
      if (blob.code !== 0) return notReadyOrDiverged('BLOB_ABSENT');
      const blobSha256 = sha256Bytes(blob.stdout);

      if (accepted !== undefined) {
        if (firstAddCommit !== accepted.firstAddCommit) {
          return { status: 'DIVERGED', reason: 'FIRST_ADD_COMMIT_CHANGED', firstAddCommit: null, blobSha256: null, bytes: null };
        }
        if (blobSha256 !== accepted.blobSha256) {
          return { status: 'DIVERGED', reason: 'CONTENT_DIVERGED', firstAddCommit: null, blobSha256: null, bytes: null };
        }
      }
      return { status: 'READY', reason: 'READY', firstAddCommit, blobSha256, bytes: blob.stdout };
    } catch {
      // A timeout, oversize output, or missing git binary fails closed (never a fetch, never a mutation).
      return notReadyOrDiverged('GIT_ERROR');
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
