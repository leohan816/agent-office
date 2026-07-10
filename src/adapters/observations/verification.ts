import type { GitObservationSource, GitRepositoryObservation } from './ports.js';
import type { EvidenceObservationStatus } from './ports.js';

export async function observeVerificationStatus(
  gitSource: GitObservationSource | undefined,
  gitSourceId: string | undefined,
  expectedCommit: string | undefined,
  relativePath: string,
): Promise<{
  readonly status: EvidenceObservationStatus;
  readonly observation?: GitRepositoryObservation;
}> {
  if (gitSource === undefined || gitSourceId === undefined || expectedCommit === undefined) {
    return { status: 'UNVERIFIED' };
  }
  const observation = await gitSource.observe(gitSourceId);
  if (observation.changedPaths.includes(relativePath)) {
    return { status: 'DIRTY', observation };
  }
  if (observation.headCommit !== expectedCommit) {
    return { status: 'STALE', observation };
  }
  return { status: 'VERIFIED', observation };
}
