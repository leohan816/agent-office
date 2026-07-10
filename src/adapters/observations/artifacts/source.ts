import { assertStableId, type LocalProjectRegistry } from '../../../application/projects/registry.js';
import { isSha256, sha256Bytes } from '../../../persistence/file-store/hashing.js';
import { ObservationError, observationErrorCode } from '../errors.js';
import { readBoundedRegularFile, validateObservationRelativePath } from '../filesystem.js';
import type {
  ArtifactObservation,
  ArtifactSource,
  EvidenceObservationStatus,
  GitObservationSource,
  ReadOnlyEvidenceReference,
} from '../ports.js';
import { observeVerificationStatus } from '../verification.js';

const COMMIT = /^[0-9a-f]{40}$/u;

export interface ArtifactRegistration {
  readonly artifactId: string;
  readonly projectId: string;
  readonly sourceId: string;
  readonly rootId: string;
  readonly relativePath: string;
  readonly maxBytes: number;
  readonly expectedSha256: string;
  readonly expectedCommit?: string;
  readonly gitSourceId?: string;
}

interface RegisteredArtifact extends ArtifactRegistration {
  readonly canonicalRoot: string;
}

export class LocalArtifactSource implements ArtifactSource {
  readonly #artifacts = new Map<string, RegisteredArtifact>();

  public constructor(
    registry: LocalProjectRegistry,
    private readonly gitSource: GitObservationSource | undefined,
    registrations: readonly ArtifactRegistration[],
  ) {
    for (const registration of registrations) {
      assertStableId(registration.artifactId, 'artifactId');
      assertStableId(registration.sourceId, 'artifact sourceId');
      validateObservationRelativePath(registration.relativePath);
      if (
        this.#artifacts.has(registration.artifactId) ||
        !isSha256(registration.expectedSha256) ||
        !Number.isSafeInteger(registration.maxBytes) ||
        registration.maxBytes < 1 ||
        (registration.expectedCommit !== undefined && !COMMIT.test(registration.expectedCommit))
      ) {
        throw new ObservationError('CONFIG_INVALID', 'artifact registration is invalid');
      }
      const root = registry.getTrustedRoot(registration.projectId, registration.rootId, 'ARTIFACT');
      this.#artifacts.set(registration.artifactId, {
        ...registration,
        canonicalRoot: root.canonicalPath,
      });
    }
  }

  public async read(artifactId: string): Promise<ArtifactObservation> {
    const artifact = this.#artifacts.get(artifactId);
    if (artifact === undefined) {
      throw new ObservationError('CONFIG_INVALID', `artifact ID is not registered: ${artifactId}`);
    }
    try {
      const read = await readBoundedRegularFile(
        artifact.canonicalRoot,
        artifact.relativePath,
        artifact.maxBytes,
      );
      const actualHash = sha256Bytes(read.bytes);
      if (actualHash !== artifact.expectedSha256) {
        return this.result(artifact, 'INVALID', actualHash, undefined, 'HASH_MISMATCH');
      }
      let verification: Awaited<ReturnType<typeof observeVerificationStatus>>;
      try {
        verification = await observeVerificationStatus(
          this.gitSource,
          artifact.gitSourceId,
          artifact.expectedCommit,
          artifact.relativePath,
        );
      } catch (error) {
        return this.result(
          artifact,
          'UNVERIFIED',
          actualHash,
          read.bytes,
          observationErrorCode(error) ?? 'TOOL_FAILED',
        );
      }
      return this.result(artifact, verification.status, actualHash, read.bytes);
    } catch (error) {
      const code = observationErrorCode(error);
      if (code === 'FILE_MISSING') return this.result(artifact, 'MISSING', undefined, undefined, code);
      if (
        code === 'FILE_NOT_REGULAR' ||
        code === 'SYMLINK_REJECTED' ||
        code === 'SIZE_LIMIT_EXCEEDED' ||
        code === 'PATH_REJECTED'
      ) {
        return this.result(artifact, 'INVALID', undefined, undefined, code);
      }
      throw error;
    }
  }

  private result(
    artifact: RegisteredArtifact,
    status: EvidenceObservationStatus,
    sha256?: string,
    bytes?: Uint8Array,
    errorCode?: ReadOnlyEvidenceReference['errorCode'],
  ): ArtifactObservation {
    return {
      status,
      ...(bytes === undefined ? {} : { bytes }),
      evidence: {
        evidenceId: artifact.artifactId,
        projectId: artifact.projectId,
        sourceId: artifact.sourceId,
        relativePath: artifact.relativePath,
        ...(sha256 === undefined ? {} : { sha256 }),
        ...(artifact.expectedCommit === undefined ? {} : { commit: artifact.expectedCommit }),
        status,
        ...(errorCode === undefined ? {} : { errorCode }),
      },
    };
  }
}
