import type {
  DecisionAuthorityEvidenceVerifier,
  DecisionAuthorityRole,
  VerifiedDecisionAuthorityEvidence,
  VerifyDecisionAuthorityEvidenceInput,
} from '../../../application/advisor-inbox/types.js';
import { DomainError, type SourceArtifactRef } from '../../../contracts/types.js';
import {
  assertExactKeys,
  assertRecord,
  requireArray,
  requireString,
} from '../../../contracts/validation.js';
import { assertUtcTimestamp, assertUuidV7 } from '../../../domain/time/index.js';
import { hashCanonical, isSha256, sha256Bytes } from '../../../persistence/file-store/hashing.js';
import type { ArtifactSource } from '../ports.js';

export interface DecisionAuthorityArtifactRegistration {
  readonly artifactId: string;
  readonly reference: SourceArtifactRef;
}

interface DecisionAuthorityRecord {
  readonly schemaVersion: 'agent-office.decision-authority-evidence.v1';
  readonly decisionId: string;
  readonly missionId: string;
  readonly authorityRole: DecisionAuthorityRole;
  readonly authoritySubjectId: string;
  readonly scope: {
    readonly kind: 'WORK_UNIT_SET';
    readonly workUnitIds: readonly string[];
  };
  readonly decidedAt: string;
}

export class ArtifactDecisionAuthorityEvidenceVerifier
implements DecisionAuthorityEvidenceVerifier {
  private readonly registrations = new Map<string, DecisionAuthorityArtifactRegistration>();

  public constructor(
    private readonly source: ArtifactSource,
    registrations: readonly DecisionAuthorityArtifactRegistration[],
    private readonly now: () => string,
  ) {
    for (const registration of registrations) {
      assertArtifactReference(registration.reference);
      if (
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(registration.artifactId) ||
        this.registrations.has(referenceKey(registration.reference))
      ) {
        throw invalidAuthorityEvidence();
      }
      this.registrations.set(referenceKey(registration.reference), registration);
    }
  }

  public async verify(
    input: VerifyDecisionAuthorityEvidenceInput,
  ): Promise<VerifiedDecisionAuthorityEvidence> {
    assertUuidV7(input.decisionId, 'decisionId');
    assertUtcTimestamp(input.recordedAt, 'decision recordedAt');
    assertArtifactReference(input.decisionArtifact);
    const claimedAuthorityRole: unknown = input.authorityRole;
    if (claimedAuthorityRole === 'Advisor') {
      throw invalidAuthorityEvidence();
    }
    if (claimedAuthorityRole !== 'Leo/GPT') throw invalidAuthorityEvidence();
    const registration = this.registrations.get(referenceKey(input.decisionArtifact));
    if (registration === undefined) throw invalidAuthorityEvidence();

    let observation: Awaited<ReturnType<ArtifactSource['read']>>;
    try {
      observation = await this.source.read(registration.artifactId);
    } catch {
      throw invalidAuthorityEvidence();
    }
    if (
      observation.status !== 'VERIFIED' ||
      observation.evidence.status !== 'VERIFIED' ||
      observation.bytes === undefined ||
      observation.evidence.projectId !== input.decisionArtifact.repository ||
      observation.evidence.relativePath !== input.decisionArtifact.path ||
      observation.evidence.commit !== input.decisionArtifact.commit ||
      observation.evidence.sha256 !== input.decisionArtifact.sha256 ||
      sha256Bytes(observation.bytes) !== input.decisionArtifact.sha256
    ) {
      throw invalidAuthorityEvidence();
    }

    const record = parseDecisionAuthorityRecord(observation.bytes);
    const expectedScope = canonicalWorkUnitIds(input.expectedWorkUnitIds);
    const actualScope = canonicalWorkUnitIds(record.scope.workUnitIds);
    if (
      expectedScope.length === 0 ||
      record.decisionId !== input.decisionId ||
      record.missionId !== input.missionId ||
      record.authorityRole !== input.authorityRole ||
      !sameStrings(actualScope, expectedScope) ||
      Date.parse(record.decidedAt) > Date.parse(input.recordedAt)
    ) {
      throw invalidAuthorityEvidence();
    }
    const verifiedAt = this.now();
    assertUtcTimestamp(verifiedAt, 'authority evidence verifiedAt');
    if (Date.parse(verifiedAt) < Date.parse(record.decidedAt)) throw invalidAuthorityEvidence();
    const verifierId = `artifact-source:${observation.evidence.sourceId}`;
    const evidenceCore = {
      schemaVersion: 'agent-office.verified-decision-authority.v1' as const,
      decisionId: record.decisionId,
      missionId: record.missionId,
      authorityRole: record.authorityRole,
      authoritySubjectId: record.authoritySubjectId,
      scope: {
        kind: 'WORK_UNIT_SET' as const,
        workUnitIds: actualScope,
      },
      decidedAt: record.decidedAt,
      decisionArtifact: input.decisionArtifact,
      verifiedAt,
      verifierId,
    };
    return { ...evidenceCore, evidenceHash: hashCanonical(evidenceCore) };
  }
}

export class RejectingDecisionAuthorityEvidenceVerifier
implements DecisionAuthorityEvidenceVerifier {
  public verify(): Promise<never> {
    return Promise.reject(invalidAuthorityEvidence());
  }
}

function parseDecisionAuthorityRecord(bytes: Uint8Array): DecisionAuthorityRecord {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw invalidAuthorityEvidence();
  }
  try {
    assertRecord(value, 'decision authority evidence');
    assertExactKeys(
      value,
      [
        'schemaVersion',
        'decisionId',
        'missionId',
        'authorityRole',
        'authoritySubjectId',
        'scope',
        'decidedAt',
      ],
      'decision authority evidence',
    );
    assertRecord(value.scope, 'decision authority scope');
    assertExactKeys(value.scope, ['kind', 'workUnitIds'], 'decision authority scope');
    const decisionId = requireString(value.decisionId, 'decision authority decisionId');
    assertUuidV7(decisionId, 'decision authority decisionId');
    const decidedAt = requireString(value.decidedAt, 'decision authority decidedAt');
    assertUtcTimestamp(decidedAt, 'decision authority decidedAt');
    const authorityRole = value.authorityRole;
    if (authorityRole !== 'Leo/GPT' && authorityRole !== 'Advisor') {
      throw invalidAuthorityEvidence();
    }
    const authoritySubjectId = requireString(
      value.authoritySubjectId,
      'decision authority subject',
    );
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(authoritySubjectId)) {
      throw invalidAuthorityEvidence();
    }
    if (value.schemaVersion !== 'agent-office.decision-authority-evidence.v1') {
      throw invalidAuthorityEvidence();
    }
    if (value.scope.kind !== 'WORK_UNIT_SET') throw invalidAuthorityEvidence();
    return {
      schemaVersion: value.schemaVersion,
      decisionId,
      missionId: requireString(value.missionId, 'decision authority missionId'),
      authorityRole,
      authoritySubjectId,
      scope: {
        kind: value.scope.kind,
        workUnitIds: requireArray(value.scope.workUnitIds, 'decision authority scope IDs').map(
          (item) => requireString(item, 'decision authority scope ID'),
        ),
      },
      decidedAt,
    };
  } catch (error) {
    if (error instanceof DomainError && error.code === 'AUTHORITY_ARTIFACT_INVALID') throw error;
    throw invalidAuthorityEvidence();
  }
}

function assertArtifactReference(value: SourceArtifactRef): void {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value.repository) ||
    !/^[0-9a-f]{40}$/u.test(value.commit) ||
    value.path.length === 0 ||
    value.path.startsWith('/') ||
    value.path.includes('\\') ||
    value.path.split('/').includes('..') ||
    !isSha256(value.sha256)
  ) {
    throw invalidAuthorityEvidence();
  }
}

function canonicalWorkUnitIds(values: readonly string[]): readonly string[] {
  if (
    values.length > 50 ||
    values.some((value) => !/^[A-Z0-9][A-Z0-9._-]{0,127}$/u.test(value))
  ) {
    throw invalidAuthorityEvidence();
  }
  const result = [...new Set(values)].sort();
  if (result.length !== values.length) throw invalidAuthorityEvidence();
  return result;
}

function referenceKey(reference: SourceArtifactRef): string {
  return hashCanonical(reference);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function invalidAuthorityEvidence(): DomainError {
  return new DomainError(
    'AUTHORITY_ARTIFACT_INVALID',
    'decision authority evidence is absent, stale, mismatched, or outside the approved scope',
  );
}
