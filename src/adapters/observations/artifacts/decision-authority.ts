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
import type { ExactGitAuthorityReader } from '../../gateways/tmux-advisor/exact-authority.js';
import { parseSourceArtifactRef } from '../../gateways/tmux-advisor/exact-config.js';

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

interface ExactDecisionAuthorityRecordV2
  extends Omit<DecisionAuthorityRecord, 'schemaVersion'> {
  readonly schemaVersion: 'agent-office.decision-authority-evidence.v2';
  readonly decisionKind: 'ROUTINE_ROUTE' | 'LEO_GPT_DECISION';
  readonly governingLeoAuthorityArtifact: SourceArtifactRef;
  readonly decisionCode: string;
}

export class ExactGitDecisionAuthorityEvidenceVerifier
implements DecisionAuthorityEvidenceVerifier {
  public constructor(
    private readonly source: ExactGitAuthorityReader,
    private readonly governingLeoAuthorityArtifact: SourceArtifactRef,
    private readonly parentMissionManifestArtifact: SourceArtifactRef,
    private readonly now: () => string,
  ) {
    assertExactArtifactReference(governingLeoAuthorityArtifact, 'governing Leo authority artifact');
    assertExactArtifactReference(parentMissionManifestArtifact, 'parent mission manifest artifact');
  }

  public async verify(
    input: VerifyDecisionAuthorityEvidenceInput,
  ): Promise<VerifiedDecisionAuthorityEvidence> {
    assertUuidV7(input.decisionId, 'decisionId');
    assertUtcTimestamp(input.recordedAt, 'decision recordedAt');
    assertExactArtifactReference(input.decisionArtifact, 'exact decision authority artifact');
    const snapshot = await this.source.snapshot();
    const current = await this.source.readUpstreamPath(input.decisionArtifact.path);
    const history = await this.source.pathHistory(input.decisionArtifact.path);
    if (
      snapshot.headCommit !== snapshot.upstreamCommit ||
      snapshot.dirtyPaths.has(input.decisionArtifact.path) ||
      snapshot.dirtyPaths.has(this.governingLeoAuthorityArtifact.path) ||
      snapshot.dirtyPaths.has(this.parentMissionManifestArtifact.path) ||
      !(await this.source.isAncestor(input.decisionArtifact.commit, snapshot.upstreamCommit)) ||
      !(await this.source.isAncestor(
        this.governingLeoAuthorityArtifact.commit,
        snapshot.upstreamCommit,
      )) ||
      !(await this.source.isAncestor(
        this.parentMissionManifestArtifact.commit,
        snapshot.upstreamCommit,
      )) ||
      current?.ref.sha256 !== input.decisionArtifact.sha256 ||
      history.length !== 1 || history[0] !== input.decisionArtifact.commit
    ) throw invalidAuthorityEvidence();
    const observation = await this.source.readExact(input.decisionArtifact);
    if (sha256Bytes(observation.bytes) !== input.decisionArtifact.sha256) {
      throw invalidAuthorityEvidence();
    }
    const record = parseExactDecisionAuthorityRecord(observation.bytes);
    const expectedScope = canonicalWorkUnitIds(input.expectedWorkUnitIds);
    const actualScope = canonicalWorkUnitIds(record.scope.workUnitIds);
    if (
      expectedScope.length === 0 ||
      record.decisionId !== input.decisionId ||
      record.missionId !== input.missionId ||
      record.authorityRole !== input.authorityRole ||
      !sameStrings(expectedScope, actualScope) ||
      Date.parse(record.decidedAt) > Date.parse(input.recordedAt)
    ) throw invalidAuthorityEvidence();
    if (input.authorityRole === 'Advisor') {
      if (
        record.schemaVersion !== 'agent-office.decision-authority-evidence.v2' ||
        record.decisionKind !== 'ROUTINE_ROUTE' ||
        record.authoritySubjectId !== 'foundation-advisor' ||
        record.decisionCode !== 'ROUTE_ALREADY_AUTHORIZED_WORK' ||
        input.intakeClassification !== 'ROUTINE_ROUTE' ||
        referenceKey(record.governingLeoAuthorityArtifact) !== referenceKey(this.governingLeoAuthorityArtifact)
      ) throw invalidAuthorityEvidence();
      const governing = await this.source.readExact(record.governingLeoAuthorityArtifact);
      if (sha256Bytes(governing.bytes) !== record.governingLeoAuthorityArtifact.sha256) {
        throw invalidAuthorityEvidence();
      }
      const parentManifest = await this.source.readExact(this.parentMissionManifestArtifact);
      if (
        sha256Bytes(parentManifest.bytes) !== this.parentMissionManifestArtifact.sha256 ||
        !isExactRoutineRouteScope(parentManifest.bytes, actualScope)
      ) throw invalidAuthorityEvidence();
    } else if (
      record.schemaVersion === 'agent-office.decision-authority-evidence.v2' &&
      record.decisionKind !== 'LEO_GPT_DECISION'
    ) {
      throw invalidAuthorityEvidence();
    }
    const verifiedAt = this.now();
    assertUtcTimestamp(verifiedAt, 'authority evidence verifiedAt');
    if (Date.parse(verifiedAt) < Date.parse(record.decidedAt)) throw invalidAuthorityEvidence();
    const core = {
      schemaVersion: 'agent-office.verified-decision-authority.v1' as const,
      decisionId: record.decisionId,
      missionId: record.missionId,
      authorityRole: record.authorityRole,
      authoritySubjectId: record.authoritySubjectId,
      scope: { kind: 'WORK_UNIT_SET' as const, workUnitIds: actualScope },
      decidedAt: record.decidedAt,
      decisionArtifact: input.decisionArtifact,
      verifiedAt,
      verifierId: 'exact-git-authority:foundation-docs',
    };
    return { ...core, evidenceHash: hashCanonical(core) };
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

function parseExactDecisionAuthorityRecord(
  bytes: Uint8Array,
): DecisionAuthorityRecord | ExactDecisionAuthorityRecordV2 {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw invalidAuthorityEvidence();
  }
  if (
    typeof value !== 'object' || value === null || Array.isArray(value) ||
    !('schemaVersion' in value) || value.schemaVersion !== 'agent-office.decision-authority-evidence.v2'
  ) return parseDecisionAuthorityRecord(bytes);
  try {
    assertRecord(value, 'exact decision authority evidence');
    const record = value as Record<string, unknown>;
    assertExactKeys(
      record,
      [
        'schemaVersion', 'decisionId', 'missionId', 'authorityRole', 'authoritySubjectId',
        'scope', 'decidedAt', 'decisionKind', 'governingLeoAuthorityArtifact', 'decisionCode',
      ],
      'exact decision authority evidence',
    );
    const rawScope = record.scope;
    assertRecord(rawScope, 'exact decision authority scope');
    assertExactKeys(rawScope, ['kind', 'workUnitIds'], 'exact decision authority scope');
    const decisionId = requireString(record.decisionId, 'decisionId');
    const decidedAt = requireString(record.decidedAt, 'decidedAt');
    assertUuidV7(decisionId, 'decisionId');
    assertUtcTimestamp(decidedAt, 'decidedAt');
    if (
      rawScope.kind !== 'WORK_UNIT_SET' ||
      (record.authorityRole !== 'Advisor' && record.authorityRole !== 'Leo/GPT') ||
      (record.decisionKind !== 'ROUTINE_ROUTE' && record.decisionKind !== 'LEO_GPT_DECISION')
    ) throw invalidAuthorityEvidence();
    const authoritySubjectId = requireString(record.authoritySubjectId, 'authoritySubjectId');
    const decisionCode = requireString(record.decisionCode, 'decisionCode');
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(authoritySubjectId) ||
      !/^[A-Z][A-Z0-9_]{0,127}$/u.test(decisionCode)
    ) throw invalidAuthorityEvidence();
    const governingLeoAuthorityArtifact = parseSourceArtifactRef(
      record.governingLeoAuthorityArtifact,
      'governingLeoAuthorityArtifact',
    );
    return {
      schemaVersion: 'agent-office.decision-authority-evidence.v2',
      decisionId,
      missionId: requireString(record.missionId, 'missionId'),
      authorityRole: record.authorityRole,
      authoritySubjectId,
      scope: {
        kind: 'WORK_UNIT_SET',
        workUnitIds: requireArray(rawScope.workUnitIds, 'scope workUnitIds').map((item) =>
          requireString(item, 'scope workUnitId')),
      },
      decidedAt,
      decisionKind: record.decisionKind,
      governingLeoAuthorityArtifact,
      decisionCode,
    };
  } catch (error) {
    if (error instanceof DomainError && error.code === 'AUTHORITY_ARTIFACT_INVALID') throw error;
    throw invalidAuthorityEvidence();
  }
}

function isExactRoutineRouteScope(bytes: Uint8Array, workUnitIds: readonly string[]): boolean {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    return false;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const manifest = value as Record<string, unknown>;
  if (
    manifest.schemaVersion !== 'agent-office.mission-manifest.v1' ||
    manifest.manifestVersion !== 5 ||
    manifest.missionId !== 'AGENT_OFFICE_M01_ADVISOR_MANAGED_OFFICE_WEB_CONTROL_PLANE' ||
    manifest.approvedBy !== 'Leo/GPT' ||
    !Array.isArray(manifest.workUnits)
  ) return false;
  const units = new Map<string, Record<string, unknown>>();
  for (const raw of manifest.workUnits) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return false;
    const unit = raw as Record<string, unknown>;
    if (typeof unit.id !== 'string' || units.has(unit.id)) return false;
    units.set(unit.id, unit);
  }
  return workUnitIds.every((workUnitId) => {
    const unit = units.get(workUnitId);
    if (
      unit?.status !== 'READY' || unit.phase === 'FINAL_AUDIT' ||
      typeof unit.actor !== 'string' || !Array.isArray(unit.dependsOn)
    ) return false;
    return unit.dependsOn.every((dependency) =>
      typeof dependency === 'string' && units.get(dependency)?.status === 'COMPLETED');
  });
}

function assertExactArtifactReference(value: SourceArtifactRef, label: string): void {
  try {
    parseSourceArtifactRef(value, label);
  } catch {
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
