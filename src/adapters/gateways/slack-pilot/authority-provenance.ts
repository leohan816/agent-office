// AS1 Multi-Team Slack Pilot — real read-only Git provenance for AS1 AUTHORITY artifacts (review B04).
//
// Canonical design: docs/security/AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md §8.1 (pre-event receive
// grant) and §8.3 (post-intake pointer-delivery grant): each grant is invalid unless it is a committed, pushed,
// clean, upstream-ancestral, byte-stable, single-first-added Git artifact that descends from the frozen
// authority snapshots. This is a SEPARATE file from git-provenance.ts (which verifies Advisor EVIDENCE) so the
// evidence and authority contracts are not conflated; it REUSES the same bounded, closed-argv, shell:false,
// fixed-env, output/time-bounded read-only Git runner (nodeGitRunner). It never mutates, fetches, or accepts a
// repository, path, commit, or clock from Slack or any per-connection/per-delivery caller: the trusted repo,
// upstream ref, frozen snapshot commits, artifact layout, and clock are all bound at construction. Any git
// failure or unmet gate fails closed (all-false provenance) and the caller refuses connection/delivery.
import { DomainError } from '../../../contracts/types.js';
import { hashCanonical } from '../../../persistence/file-store/hashing.js';
import { nodeGitRunner, type As1GitRunner } from './git-provenance.js';
import type { As1DeliveryProvenanceGate } from './exact-transport.js';
import type { As1PilotReceiveGrantV1, As1PointerDeliveryGrantV1 } from '../../../application/slack-pilot/contracts.js';
import type { As1AdvisorReadinessLeaseV1, As1ReceiveGrantProvenanceGate } from './exact-authority.js';

const GIT_SHA1 = /^[0-9a-f]{40}$/u;
// A contained, printable, relative authority-artifact path segment set. No leading slash, no `..`, no NUL, bounded.
const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,1024}$/u;

/** The exact committed authority artifact to prove. Every field is derived internally, never from Slack. */
export interface As1AuthorityArtifactRef {
  readonly repositoryId: string;
  readonly path: string;
  readonly sourceCommit: string;
  /** The canonical bytes the committed artifact must equal (hashCanonical of the parsed accepted grant). */
  readonly expectedCanonicalHash: string;
}

export interface As1AuthorityProvenance {
  readonly upstreamAncestral: boolean;
  readonly firstAddition: boolean;
  readonly dirty: boolean;
  readonly contentVerified: boolean;
  readonly descendsFromSnapshots: boolean;
}

export interface As1AuthorityProvenanceVerifier {
  verify(ref: As1AuthorityArtifactRef, snapshotCommits: readonly string[]): Promise<As1AuthorityProvenance>;
}

const DENY_ALL: As1AuthorityProvenance = {
  upstreamAncestral: false,
  firstAddition: false,
  dirty: true,
  contentVerified: false,
  descendsFromSnapshots: false,
};

/** Every provenance obligation (security §8.3) must hold; any false gate refuses the artifact. */
function isFullyAccepted(provenance: As1AuthorityProvenance): boolean {
  return (
    provenance.contentVerified &&
    provenance.upstreamAncestral &&
    provenance.firstAddition &&
    !provenance.dirty &&
    provenance.descendsFromSnapshots
  );
}

/**
 * The real read-only authority-artifact verifier. Bound at construction to the trusted repository root, its
 * expected repository id, and the upstream ref — never caller/Slack input. The frozen authority snapshot commits
 * are supplied per call by the construction-bound gate (never by Slack).
 */
export class NodeAs1AuthorityProvenanceVerifier implements As1AuthorityProvenanceVerifier {
  public constructor(
    private readonly repoRoot: string,
    private readonly expectedRepositoryId: string,
    private readonly upstreamRef: string,
    private readonly run: As1GitRunner = nodeGitRunner(),
  ) {}

  public async verify(ref: As1AuthorityArtifactRef, snapshotCommits: readonly string[]): Promise<As1AuthorityProvenance> {
    if (ref.repositoryId !== this.expectedRepositoryId) return DENY_ALL;
    if (!GIT_SHA1.test(ref.sourceCommit) || !SAFE_PATH.test(ref.path) || ref.path.includes('..')) return DENY_ALL;
    if (snapshotCommits.length < 1 || !snapshotCommits.every((commit) => GIT_SHA1.test(commit))) return DENY_ALL;

    try {
      const commit = await this.run(this.repoRoot, ['rev-parse', '--verify', '--quiet', `${ref.sourceCommit}^{commit}`]);
      if (commit.code !== 0) return DENY_ALL;

      // Byte-stable: the committed blob, parsed and re-canonicalized, must equal the accepted grant's canonical
      // bytes — proving the committed artifact IS this exact grant, not merely that it exists.
      const blob = await this.run(this.repoRoot, ['cat-file', 'blob', `${ref.sourceCommit}:${ref.path}`]);
      const contentVerified = blob.code === 0 && this.committedCanonicalHash(blob.stdout) === ref.expectedCanonicalHash;

      // Exactly one commit ADDED this path in the ancestry of the EXACT source commit (single first addition).
      const addLog = await this.run(this.repoRoot, ['log', '--diff-filter=A', '--format=%H', ref.sourceCommit, '--', ref.path]);
      const firstAddition = addLog.code === 0 && nonEmptyLines(addLog.stdout).length === 1;

      // Committed AND pushed: the source commit is an ancestor of the upstream tip.
      const ancestral = (await this.run(this.repoRoot, ['merge-base', '--is-ancestor', ref.sourceCommit, this.upstreamRef])).code === 0;

      // The working tree is clean for this exact path (no dirty/uncommitted change).
      const status = await this.run(this.repoRoot, ['status', '--porcelain', '--', ref.path]);
      const dirty = status.code !== 0 || nonEmptyLines(status.stdout).length > 0;

      // The source commit descends from EVERY frozen authority snapshot commit supplied by the gate.
      let descendsFromSnapshots = true;
      for (const snapshot of snapshotCommits) {
        const result = await this.run(this.repoRoot, ['merge-base', '--is-ancestor', snapshot, ref.sourceCommit]);
        if (result.code !== 0) descendsFromSnapshots = false;
      }

      return { upstreamAncestral: ancestral, firstAddition, dirty, contentVerified, descendsFromSnapshots };
    } catch {
      // A timeout, oversize output, or missing git binary fails closed.
      return DENY_ALL;
    }
  }

  private committedCanonicalHash(blob: Buffer): string | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(blob.toString('utf8'));
    } catch {
      return null;
    }
    return hashCanonical(parsed);
  }
}

/**
 * Production receive-grant provenance gate (security §8.1). Binds the verifier, the frozen authority snapshot
 * commits, and the committed artifact layout at construction. `assertAccepted` derives the artifact ref purely
 * from the accepted grant's own authority fields and proves the full Git provenance before any connection; a
 * missing gate is impossible because the startup input requires this port.
 */
/** The committed location of a grant artifact — the path and the commit that ADDED it. Supplied by the
 * construction-bound composition/Advisor mapping, never by Slack. It is separate from the grant's own
 * `authoritySourceCommit` (which references the authority basis and cannot contain the grant file's own commit). */
export interface As1CommittedArtifactLocation {
  readonly path: string;
  readonly sourceCommit: string;
}

export class GitAs1ReceiveGrantProvenanceGate implements As1ReceiveGrantProvenanceGate {
  public constructor(
    private readonly verifier: As1AuthorityProvenanceVerifier,
    /** Resolve the committed location (path + commit) for a receive grant — construction-bound, never a caller. */
    private readonly locationOf: (grant: As1PilotReceiveGrantV1) => As1CommittedArtifactLocation,
    /** The frozen authority snapshot commits, bound at construction (never from Slack). */
    private readonly snapshotCommits: readonly string[],
  ) {}

  public async assertAccepted(grant: As1PilotReceiveGrantV1): Promise<void> {
    const location = this.locationOf(grant);
    const ref: As1AuthorityArtifactRef = {
      repositoryId: grant.authorityRepositoryId,
      path: location.path,
      sourceCommit: location.sourceCommit,
      expectedCanonicalHash: hashCanonical(grant),
    };
    if (!isFullyAccepted(await this.verifier.verify(ref, this.snapshotCommits))) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'receive grant Git provenance is not accepted');
    }
  }
}

/**
 * Production pointer-delivery-grant provenance gate (security §8.3) — the real As1DeliveryProvenanceGate that
 * replaces the unconditional acceptance seam. Binds the verifier, the frozen snapshots, and the artifact layout
 * at construction; derives the artifact ref purely from the grant and proves full Git provenance before delivery.
 */
export class GitAs1DeliveryProvenanceGate implements As1DeliveryProvenanceGate {
  public constructor(
    private readonly verifier: As1AuthorityProvenanceVerifier,
    private readonly locationOf: (grant: As1PointerDeliveryGrantV1) => As1CommittedArtifactLocation,
    private readonly snapshotCommits: readonly string[],
  ) {}

  public async assertAccepted(grant: As1PointerDeliveryGrantV1, lease: As1AdvisorReadinessLeaseV1): Promise<void> {
    // The lease is validated for chain/snapshot consistency by the transport before this gate; here we prove the
    // grant artifact's Git provenance. Bind the lease id into the location resolver so a mismatched lease cannot
    // silently pass (defense in depth alongside the transport's assertDeliveryChainConsistent).
    if (lease.pointerDeliveryGrantId !== grant.pointerDeliveryGrantId) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'readiness lease does not name this pointer-delivery grant');
    }
    const location = this.locationOf(grant);
    const ref: As1AuthorityArtifactRef = {
      repositoryId: grant.authorityRepositoryId,
      path: location.path,
      sourceCommit: location.sourceCommit,
      expectedCanonicalHash: hashCanonical(grant),
    };
    if (!isFullyAccepted(await this.verifier.verify(ref, this.snapshotCommits))) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'pointer-delivery grant Git provenance is not accepted');
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
