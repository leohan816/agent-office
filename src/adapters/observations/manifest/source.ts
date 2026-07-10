import { assertStableId, type LocalProjectRegistry } from '../../../application/projects/registry.js';
import { DomainError } from '../../../contracts/types.js';
import {
  importMissionManifest,
  type ManifestSourceMetadata,
} from '../../../domain/manifest/index.js';
import { ObservationError, observationErrorCode } from '../errors.js';
import { readBoundedRegularFile, validateObservationRelativePath } from '../filesystem.js';
import type {
  EvidenceObservationStatus,
  GitObservationSource,
  MissionManifestObservation,
  MissionManifestSource,
  ReadOnlyEvidenceReference,
} from '../ports.js';
import { observeVerificationStatus } from '../verification.js';

export interface ManifestSourceRegistration {
  readonly sourceId: string;
  readonly projectId: string;
  readonly rootId: string;
  readonly relativePath: string;
  readonly maxBytes: number;
  readonly sourceMetadata: ManifestSourceMetadata;
  readonly gitSourceId?: string;
}

interface RegisteredManifestSource extends ManifestSourceRegistration {
  readonly canonicalRoot: string;
}

export class LocalMissionManifestSource implements MissionManifestSource {
  readonly #sources = new Map<string, RegisteredManifestSource>();

  public constructor(
    registry: LocalProjectRegistry,
    private readonly gitSource: GitObservationSource | undefined,
    registrations: readonly ManifestSourceRegistration[],
  ) {
    for (const registration of registrations) {
      assertStableId(registration.sourceId, 'manifest sourceId');
      validateObservationRelativePath(registration.relativePath);
      if (
        this.#sources.has(registration.sourceId) ||
        registration.relativePath !== registration.sourceMetadata.path ||
        !Number.isSafeInteger(registration.maxBytes) ||
        registration.maxBytes < 1
      ) {
        throw new ObservationError('CONFIG_INVALID', 'manifest source registration is invalid');
      }
      const root = registry.getTrustedRoot(registration.projectId, registration.rootId, 'MANIFEST');
      this.#sources.set(registration.sourceId, {
        ...registration,
        canonicalRoot: root.canonicalPath,
      });
    }
  }

  public async read(sourceId: string): Promise<MissionManifestObservation> {
    const source = this.#sources.get(sourceId);
    if (source === undefined) {
      throw new ObservationError('CONFIG_INVALID', `manifest source ID is not registered: ${sourceId}`);
    }
    try {
      const read = await readBoundedRegularFile(source.canonicalRoot, source.relativePath, source.maxBytes);
      let manifest: ReturnType<typeof importMissionManifest>;
      try {
        manifest = importMissionManifest(read.bytes, source.sourceMetadata);
      } catch (error) {
        return this.result(
          source,
          'INVALID',
          undefined,
          error instanceof DomainError && error.code === 'AUTHORITY_ARTIFACT_INVALID'
            ? 'HASH_MISMATCH'
            : 'STRUCTURED_OUTPUT_INVALID',
        );
      }
      let verification: Awaited<ReturnType<typeof observeVerificationStatus>>;
      try {
        verification = await observeVerificationStatus(
          this.gitSource,
          source.gitSourceId,
          source.sourceMetadata.commit,
          source.relativePath,
        );
      } catch (error) {
        return this.result(
          source,
          'UNVERIFIED',
          manifest,
          observationErrorCode(error) ?? 'TOOL_FAILED',
        );
      }
      return this.result(source, verification.status, manifest);
    } catch (error) {
      const code = observationErrorCode(error);
      if (code === 'FILE_MISSING') return this.result(source, 'MISSING', undefined, code);
      if (
        code === 'FILE_NOT_REGULAR' ||
        code === 'SYMLINK_REJECTED' ||
        code === 'SIZE_LIMIT_EXCEEDED' ||
        code === 'PATH_REJECTED'
      ) {
        return this.result(source, 'INVALID', undefined, code);
      }
      throw error;
    }
  }

  private result(
    source: RegisteredManifestSource,
    status: EvidenceObservationStatus,
    manifest?: ReturnType<typeof importMissionManifest>,
    errorCode?: ReadOnlyEvidenceReference['errorCode'],
  ): MissionManifestObservation {
    return {
      status,
      ...(manifest === undefined ? {} : { manifest }),
      evidence: {
        evidenceId: source.sourceId,
        projectId: source.projectId,
        sourceId: source.sourceId,
        relativePath: source.relativePath,
        sha256: source.sourceMetadata.sha256,
        commit: source.sourceMetadata.commit,
        status,
        ...(errorCode === undefined ? {} : { errorCode }),
      },
    };
  }
}
