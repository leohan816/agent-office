import type { MissionManifest } from '../../domain/manifest/index.js';
import type { FreshnessEvaluation } from '../../application/hosts/freshness.js';
import type { ObservationErrorCode } from './errors.js';

export const EVIDENCE_OBSERVATION_STATUSES = [
  'VERIFIED',
  'UNVERIFIED',
  'STALE',
  'DIRTY',
  'INVALID',
  'MISSING',
] as const;
export type EvidenceObservationStatus = (typeof EVIDENCE_OBSERVATION_STATUSES)[number];

export interface ReadOnlyEvidenceReference {
  readonly evidenceId: string;
  readonly projectId: string;
  readonly sourceId: string;
  readonly relativePath?: string;
  readonly sha256?: string;
  readonly commit?: string;
  readonly status: EvidenceObservationStatus;
  readonly errorCode?: ObservationErrorCode;
}

export interface GitRepositoryObservation {
  readonly projectId: string;
  readonly sourceId: string;
  readonly rootId: string;
  readonly topLevelRootId: string;
  readonly headCommit: string;
  readonly upstreamRef?: string;
  readonly upstreamCommit?: string;
  readonly dirty: boolean;
  readonly changedPaths: readonly string[];
  readonly observedAt: string;
}

export interface GitRefObservation {
  readonly refName: string;
  readonly commit: string;
}

export interface GitCommitDiffEntry {
  readonly status: string;
  readonly path: string;
  readonly priorPath?: string;
}

export interface GitObservationSource {
  observe(sourceId: string): Promise<GitRepositoryObservation>;
  listAllowlistedRefs(sourceId: string, namespaceId: string): Promise<readonly GitRefObservation[]>;
  isConfiguredAncestor(sourceId: string, commitPairId: string): Promise<boolean>;
  diffConfiguredCommits(sourceId: string, commitPairId: string): Promise<readonly GitCommitDiffEntry[]>;
}

export interface MissionManifestObservation {
  readonly status: EvidenceObservationStatus;
  readonly manifest?: MissionManifest;
  readonly evidence: ReadOnlyEvidenceReference;
}

export interface MissionManifestSource {
  read(sourceId: string): Promise<MissionManifestObservation>;
}

export interface ArtifactObservation {
  readonly status: EvidenceObservationStatus;
  readonly bytes?: Uint8Array;
  readonly evidence: ReadOnlyEvidenceReference;
}

export interface ArtifactSource {
  read(artifactId: string): Promise<ArtifactObservation>;
}

export interface TmuxPaneObservation {
  readonly projectId: string;
  readonly sourceId: string;
  readonly hostId: string;
  readonly sessionId: string;
  readonly windowId: string;
  readonly paneId: string;
  readonly sessionNameEscaped: string;
  readonly windowNameEscaped: string;
  readonly windowIndex: number;
  readonly paneIndex: number;
  readonly workspaceRootId: string;
  readonly currentCommandEscaped: string;
  readonly paneDead: boolean;
  readonly lastActivityAt: string;
  readonly synchronizePanes: boolean;
  readonly observedAt: string;
}

export interface TmuxObservationSource {
  observe(sourceId: string): Promise<TmuxPaneObservation>;
}

export interface PresentedObservation<T> {
  readonly value?: T;
  readonly freshness: FreshnessEvaluation;
  readonly evidenceRef: string;
}
