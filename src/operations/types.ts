export interface BuildCompatibilityDescriptor {
  readonly buildId: string;
  readonly readableStateRootFormats: readonly number[];
  readonly writableStateRootFormats: readonly number[];
  readonly readableEventEnvelopeVersions: readonly number[];
  readonly writableEventEnvelopeVersions: readonly number[];
  readonly readableProjectionSchemaVersions: readonly string[];
}

export interface BackupDirectoryEntry {
  readonly path: string;
  readonly mode: '0700';
}

export interface BackupFileEntry {
  readonly path: string;
  readonly size: number;
  readonly mode: '0600';
  readonly sha256: string;
}

export interface CheckpointBackupManifest {
  readonly schemaVersion: 'agent-office.checkpoint-backup.v1';
  readonly backupId: string;
  readonly createdAt: string;
  readonly sourceStateRootId: string;
  readonly missionId: string;
  readonly sourceSequence: number;
  readonly sourceEventHash: string;
  readonly projectionHash: string;
  readonly stateRootFormatVersion: 1;
  readonly eventEnvelopeVersion: 1;
  readonly projectionSchemaVersion: 'agent-office.mission-projection.v1';
  readonly build: BuildCompatibilityDescriptor;
  readonly directories: readonly BackupDirectoryEntry[];
  readonly files: readonly BackupFileEntry[];
}

export interface BackupCompleteMarker {
  readonly schemaVersion: 'agent-office.checkpoint-backup-complete.v1';
  readonly backupId: string;
  readonly completedAt: string;
  readonly manifestHash: string;
}

export interface BackupReceipt {
  readonly schemaVersion: 'agent-office.backup-receipt.v1';
  readonly backupId: string;
  readonly backupRoot: string;
  readonly manifestHash: string;
  readonly sourceSequence: number;
  readonly sourceEventHash: string;
  readonly projectionHash: string;
  readonly fileCount: number;
  readonly byteCount: number;
  readonly completedAt: string;
}

export interface RestoreVerificationEvidence {
  readonly eventCount: number;
  readonly firstSequence: number;
  readonly lastSequence: number;
  readonly lastEventHash: string;
  readonly projectionHash: string;
  readonly idempotencyVerified: boolean;
}

export interface RestoreReceipt {
  readonly schemaVersion: 'agent-office.restore-receipt.v1';
  readonly backupId: string;
  readonly candidateRoot: string;
  readonly manifestHash: string;
  readonly verification: RestoreVerificationEvidence;
  readonly selected: false;
  readonly verifiedAt: string;
}
