import { DomainError } from '../../contracts/types.js';
import { assertUtcTimestamp } from '../../domain/time/index.js';
import type {
  BuildCompatibilityDescriptor,
  CheckpointBackupManifest,
} from '../types.js';

export type BuildCompatibility = 'INCOMPATIBLE' | 'READ_ONLY_COMPATIBLE' | 'READ_WRITE_COMPATIBLE';

export function assessBuildCompatibility(
  manifest: CheckpointBackupManifest,
  build: BuildCompatibilityDescriptor,
): BuildCompatibility {
  const readable =
    build.readableStateRootFormats.includes(manifest.stateRootFormatVersion) &&
    build.readableEventEnvelopeVersions.includes(manifest.eventEnvelopeVersion) &&
    build.readableProjectionSchemaVersions.includes(manifest.projectionSchemaVersion);
  if (!readable) return 'INCOMPATIBLE';
  const writable =
    build.writableStateRootFormats.includes(manifest.stateRootFormatVersion) &&
    build.writableEventEnvelopeVersions.includes(manifest.eventEnvelopeVersion);
  return writable ? 'READ_WRITE_COMPATIBLE' : 'READ_ONLY_COMPATIBLE';
}

export function requireReadableBuild(
  manifest: CheckpointBackupManifest,
  build: BuildCompatibilityDescriptor,
): BuildCompatibility {
  const compatibility = assessBuildCompatibility(manifest, build);
  if (compatibility === 'INCOMPATIBLE') {
    throw new DomainError(
      'STORE_QUARANTINED',
      'selected build cannot read the backup schema and must fail closed',
    );
  }
  return compatibility;
}

export interface RollbackPlan {
  readonly schemaVersion: 'agent-office.rollback-plan.v1';
  readonly currentBuildId: string;
  readonly targetBuildId: string;
  readonly compatibility: BuildCompatibility;
  readonly serviceStopped: boolean;
  readonly mutationEnableAllowed: boolean;
  readonly destructiveDowngrade: false;
  readonly createdAt: string;
}

export function createRollbackPlan(input: {
  readonly currentBuildId: string;
  readonly targetBuild: BuildCompatibilityDescriptor;
  readonly manifest: CheckpointBackupManifest;
  readonly serviceStopped: boolean;
  readonly createdAt: string;
}): RollbackPlan {
  assertUtcTimestamp(input.createdAt, 'rollback plan time');
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(input.currentBuildId) ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(input.targetBuild.buildId)
  ) {
    throw new DomainError('INVALID_SCHEMA', 'rollback build identity is invalid');
  }
  const compatibility = assessBuildCompatibility(input.manifest, input.targetBuild);
  return {
    schemaVersion: 'agent-office.rollback-plan.v1',
    currentBuildId: input.currentBuildId,
    targetBuildId: input.targetBuild.buildId,
    compatibility,
    serviceStopped: input.serviceStopped,
    mutationEnableAllowed:
      input.serviceStopped && compatibility === 'READ_WRITE_COMPATIBLE',
    destructiveDowngrade: false,
    createdAt: input.createdAt,
  };
}
