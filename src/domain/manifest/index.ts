import { DomainError, type SourceArtifactRef } from '../../contracts/types.js';
import {
  assertExactKeys,
  assertRecord,
  requireArray,
  requireInteger,
  requireString,
} from '../../contracts/validation.js';
import {
  REQUIRED_OBSERVABLE_NAMES,
  type ObservableProjectionName,
  type RequiredObservableName,
  type RoleActivity,
} from '../activity/index.js';
import { WORK_UNIT_STATES, type WorkUnitState } from '../state-machines/work-unit.js';
import { canonicalize } from '../../persistence/file-store/canonical-json.js';
import { hashCanonical, isSha256, sha256Bytes } from '../../persistence/file-store/hashing.js';

const BUSINESS_ID = /^[A-Z0-9][A-Z0-9._-]{0,127}$/u;

export interface ManifestSourceMetadata extends SourceArtifactRef {
  readonly schemaVersion: 'agent-office.manifest-source.v1';
}

export interface ImportedWorkUnit {
  readonly id: string;
  readonly phase: string;
  readonly actor: string;
  readonly title: string;
  readonly status: string;
  readonly dependsOn: readonly string[];
}

export interface ImportedMissionManifest {
  readonly schemaVersion: 'agent-office.mission-manifest.v1';
  readonly manifestVersion: number;
  readonly missionId: string;
  readonly initiative: { readonly id: string; readonly labelKo: string };
  readonly package: { readonly id: string; readonly labelKo: string };
  readonly approvedBy: string;
  readonly counting: {
    readonly denominator: number;
    readonly basis: string;
    readonly scopeChangeRequires: readonly string[];
  };
  readonly workUnits: readonly ImportedWorkUnit[];
  readonly futureUnapprovedWork: readonly string[];
}

export interface PhaseManifest {
  readonly id: string;
  readonly order: number;
  readonly workUnitIds: readonly string[];
}

export interface WorkUnitManifest extends ImportedWorkUnit {
  readonly initialState: WorkUnitState;
  readonly initialActivity?: RoleActivity;
  readonly initialActivityReasonCode?: string;
  readonly requiredObservableName: ObservableProjectionName;
}

export interface MissionManifest {
  readonly schemaVersion: 'agent-office.mission-manifest.v1';
  readonly manifestVersion: number;
  readonly missionId: string;
  readonly initiative: ImportedMissionManifest['initiative'];
  readonly package: ImportedMissionManifest['package'];
  readonly approvedBy: string;
  readonly source: ManifestSourceMetadata;
  readonly counting: ImportedMissionManifest['counting'];
  readonly phases: readonly PhaseManifest[];
  readonly workUnits: readonly WorkUnitManifest[];
  readonly futureUnapprovedWork: readonly string[];
}

export function parseManifestSourceMetadata(value: unknown): ManifestSourceMetadata {
  assertRecord(value, 'manifest source metadata');
  assertExactKeys(value, ['schemaVersion', 'repository', 'commit', 'path', 'sha256'], 'manifest source metadata');
  const source: ManifestSourceMetadata = {
    schemaVersion: requireLiteral(value.schemaVersion, 'agent-office.manifest-source.v1', 'source schemaVersion'),
    repository: requireString(value.repository, 'source repository'),
    commit: requireString(value.commit, 'source commit'),
    path: requireString(value.path, 'source path'),
    sha256: requireString(value.sha256, 'source sha256'),
  };
  if (!/^[0-9a-f]{40}$/u.test(source.commit) || !isSha256(source.sha256)) {
    throw new DomainError('INVALID_SCHEMA', 'manifest source commit/hash is invalid');
  }
  if (
    source.path.startsWith('/') ||
    source.path.includes('\\') ||
    source.path.split('/').includes('..') ||
    source.path.includes('\0')
  ) {
    throw new DomainError('INVALID_SCHEMA', 'manifest source path is not allowlisted-relative');
  }
  return source;
}

export function importMissionManifest(
  sourceBytes: Uint8Array,
  source: ManifestSourceMetadata,
): MissionManifest {
  if (sha256Bytes(sourceBytes) !== source.sha256) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'manifest source byte hash does not match');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(sourceBytes).toString('utf8')) as unknown;
  } catch {
    throw new DomainError('INVALID_SCHEMA', 'manifest source is not valid UTF-8 JSON');
  }
  const imported = parseImportedManifest(parsed);
  validateImportedManifest(imported);
  const phases = derivePhases(imported.workUnits);
  const workUnits = imported.workUnits.map(normalizeWorkUnit);
  validateNormalizedReadiness(workUnits);
  return {
    ...imported,
    source,
    phases,
    workUnits,
  };
}

export function parseImportedManifest(value: unknown): ImportedMissionManifest {
  assertRecord(value, 'mission manifest');
  assertExactKeys(
    value,
    [
      'schemaVersion',
      'manifestVersion',
      'missionId',
      'initiative',
      'package',
      'approvedBy',
      'counting',
      'workUnits',
      'futureUnapprovedWork',
    ],
    'mission manifest',
  );
  assertRecord(value.initiative, 'initiative');
  assertExactKeys(value.initiative, ['id', 'labelKo'], 'initiative');
  assertRecord(value.package, 'package');
  assertExactKeys(value.package, ['id', 'labelKo'], 'package');
  assertRecord(value.counting, 'counting');
  assertExactKeys(value.counting, ['denominator', 'basis', 'scopeChangeRequires'], 'counting');

  const workUnits = requireArray(value.workUnits, 'workUnits').map((item, index) => parseWorkUnit(item, index));
  return {
    schemaVersion: requireLiteral(value.schemaVersion, 'agent-office.mission-manifest.v1', 'schemaVersion'),
    manifestVersion: requireInteger(value.manifestVersion, 'manifestVersion', 1),
    missionId: requireString(value.missionId, 'missionId'),
    initiative: {
      id: requireString(value.initiative.id, 'initiative.id'),
      labelKo: requireString(value.initiative.labelKo, 'initiative.labelKo'),
    },
    package: {
      id: requireString(value.package.id, 'package.id'),
      labelKo: requireString(value.package.labelKo, 'package.labelKo'),
    },
    approvedBy: requireString(value.approvedBy, 'approvedBy'),
    counting: {
      denominator: requireInteger(value.counting.denominator, 'counting.denominator', 1),
      basis: requireString(value.counting.basis, 'counting.basis'),
      scopeChangeRequires: requireStringArray(value.counting.scopeChangeRequires, 'counting.scopeChangeRequires'),
    },
    workUnits,
    futureUnapprovedWork: requireStringArray(value.futureUnapprovedWork, 'futureUnapprovedWork'),
  };
}

function parseWorkUnit(value: unknown, index: number): ImportedWorkUnit {
  assertRecord(value, `workUnits[${index}]`);
  assertExactKeys(value, ['id', 'phase', 'actor', 'title', 'status', 'dependsOn'], `workUnits[${index}]`);
  return {
    id: requireString(value.id, `workUnits[${index}].id`),
    phase: requireString(value.phase, `workUnits[${index}].phase`),
    actor: requireString(value.actor, `workUnits[${index}].actor`),
    title: requireString(value.title, `workUnits[${index}].title`),
    status: requireString(value.status, `workUnits[${index}].status`),
    dependsOn: requireStringArray(value.dependsOn, `workUnits[${index}].dependsOn`),
  };
}

function validateImportedManifest(manifest: ImportedMissionManifest): void {
  for (const id of [manifest.missionId, manifest.initiative.id, manifest.package.id]) {
    if (!BUSINESS_ID.test(id)) {
      throw new DomainError('INVALID_SCHEMA', `invalid business ID: ${id}`);
    }
  }
  if (manifest.counting.denominator !== manifest.workUnits.length) {
    throw new DomainError('INVALID_SCHEMA', 'manifest denominator does not equal WorkUnit count');
  }
  const requiredScopeFields = ['oldTotal', 'newTotal', 'changedWorkUnits', 'reason', 'approvingAuthority'];
  if (
    manifest.counting.scopeChangeRequires.length !== requiredScopeFields.length ||
    requiredScopeFields.some((field) => !manifest.counting.scopeChangeRequires.includes(field))
  ) {
    throw new DomainError('INVALID_SCHEMA', 'scopeChangeRequires does not contain the approved fields');
  }
  const ids = new Set<string>();
  for (const workUnit of manifest.workUnits) {
    if (!BUSINESS_ID.test(workUnit.id) || !BUSINESS_ID.test(workUnit.phase)) {
      throw new DomainError('INVALID_SCHEMA', `invalid WorkUnit or phase ID: ${workUnit.id}`);
    }
    if (ids.has(workUnit.id)) {
      throw new DomainError('INVALID_SCHEMA', `duplicate WorkUnit ID: ${workUnit.id}`);
    }
    ids.add(workUnit.id);
  }
  for (const workUnit of manifest.workUnits) {
    for (const dependency of workUnit.dependsOn) {
      if (!ids.has(dependency)) {
        throw new DomainError('INVALID_SCHEMA', `unknown dependency ${dependency}`);
      }
      if (dependency === workUnit.id) {
        throw new DomainError('INVALID_SCHEMA', `WorkUnit ${workUnit.id} depends on itself`);
      }
    }
  }
  assertAcyclic(manifest.workUnits);
}

function assertAcyclic(workUnits: readonly ImportedWorkUnit[]): void {
  const byId = new Map(workUnits.map((workUnit) => [workUnit.id, workUnit]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) {
      throw new DomainError('INVALID_SCHEMA', `dependency cycle includes ${id}`);
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const workUnit of workUnits) visit(workUnit.id);
}

function derivePhases(workUnits: readonly ImportedWorkUnit[]): readonly PhaseManifest[] {
  const phaseIds: string[] = [];
  const members = new Map<string, string[]>();
  for (const workUnit of workUnits) {
    if (!members.has(workUnit.phase)) {
      phaseIds.push(workUnit.phase);
      members.set(workUnit.phase, []);
    }
    members.get(workUnit.phase)?.push(workUnit.id);
  }
  return phaseIds.map((id, order) => ({ id, order: order + 1, workUnitIds: members.get(id) ?? [] }));
}

function normalizeWorkUnit(workUnit: ImportedWorkUnit): WorkUnitManifest {
  const normalized = normalizeImportedStatus(workUnit.status);
  return { ...workUnit, ...normalized };
}

export function normalizeImportedStatus(status: string): Pick<
  WorkUnitManifest,
  'initialState' | 'initialActivity' | 'initialActivityReasonCode' | 'requiredObservableName'
> {
  if (!REQUIRED_OBSERVABLE_NAMES.includes(status as RequiredObservableName)) {
    if (WORK_UNIT_STATES.includes(status as WorkUnitState)) {
      if (
        status === 'DISPATCHED' ||
        status === 'RUNNING' ||
        status === 'RESULT_REPORTED' ||
        status === 'REVIEW_PENDING' ||
        status === 'WAITING_ADVISOR' ||
        status === 'HOLD'
      ) {
        return {
          initialState: status,
          requiredObservableName: 'UNKNOWN_OR_STALE',
        };
      }
      throw new DomainError('INVALID_SCHEMA', `imported status ${status} has no deterministic observable mapping`);
    }
    throw new DomainError('INVALID_SCHEMA', `unsupported imported status: ${status}`);
  }
  const observable = status as RequiredObservableName;
  switch (observable) {
    case 'DISPATCHING':
      return {
        initialState: 'DISPATCHED',
        initialActivity: 'DELIVERY',
        initialActivityReasonCode: 'WORKUNIT_DISPATCH',
        requiredObservableName: observable,
      };
    case 'READING':
      return { initialState: 'RUNNING', initialActivity: 'READING', requiredObservableName: observable };
    case 'WORKING':
      return { initialState: 'RUNNING', initialActivity: 'WORKING', requiredObservableName: observable };
    case 'TESTING':
      return { initialState: 'TESTING', initialActivity: 'TESTING', requiredObservableName: observable };
    case 'WRITING_RESULT':
      return {
        initialState: 'RUNNING',
        initialActivity: 'WRITING_RESULT',
        initialActivityReasonCode: 'RESULT_DRAFT_STARTED',
        requiredObservableName: observable,
      };
    case 'RETURNING_RESULT':
      return { initialState: 'RESULT_REPORTED', initialActivity: 'RESULT_RETURN', requiredObservableName: observable };
    case 'REVIEWING':
      return { initialState: 'REVIEW_PENDING', initialActivity: 'REVIEW', requiredObservableName: observable };
    case 'WAITING_LEO':
      return { initialState: 'WAITING_LEO', initialActivity: 'WAITING_LEO', requiredObservableName: observable };
    case 'BLOCKED':
      return { initialState: 'BLOCKED', initialActivity: 'BLOCKED', requiredObservableName: observable };
    case 'QUEUED':
    case 'READY':
    case 'NEEDS_PATCH':
    case 'WAITING_DEPENDENCY':
    case 'COMPLETED':
    case 'FAILED':
    case 'CANCELLED':
      return { initialState: observable, requiredObservableName: observable };
  }
}

function validateNormalizedReadiness(workUnits: readonly WorkUnitManifest[]): void {
  const byId = new Map(workUnits.map((workUnit) => [workUnit.id, workUnit]));
  for (const workUnit of workUnits) {
    if (
      workUnit.initialState === 'READY' &&
      workUnit.dependsOn.some((id) => byId.get(id)?.initialState !== 'COMPLETED')
    ) {
      throw new DomainError('DEPENDENCY_INCOMPLETE', `${workUnit.id} is READY with an incomplete dependency`);
    }
  }
}

function requireStringArray(value: unknown, label: string): readonly string[] {
  return requireArray(value, label).map((item, index) => requireString(item, `${label}[${index}]`));
}

function requireLiteral<const T extends string>(value: unknown, literal: T, label: string): T {
  if (value !== literal) {
    throw new DomainError('INVALID_SCHEMA', `${label} must equal ${literal}`);
  }
  return literal;
}

export interface ScopeChangeRequest {
  readonly fromManifestVersion: number;
  readonly toManifestVersion: number;
  readonly oldTotal: number;
  readonly newTotal: number;
  readonly addedWorkUnitIds: readonly string[];
  readonly removedWorkUnitIds: readonly string[];
  readonly changedWorkUnitIds: readonly string[];
  readonly reason: string;
  readonly approvingAuthority: string;
  readonly authorityArtifactRef: SourceArtifactRef;
  readonly oldManifestHash: string;
  readonly newManifestHash: string;
}

export function assertScopeChange(
  previous: MissionManifest,
  next: MissionManifest,
  request: ScopeChangeRequest,
): void {
  if (
    next.missionId !== previous.missionId ||
    next.initiative.id !== previous.initiative.id ||
    next.package.id !== previous.package.id
  ) {
    throw new DomainError('MANIFEST_VERSION_CONFLICT', 'manifest identity cannot change');
  }
  if (
    request.fromManifestVersion !== previous.manifestVersion ||
    request.toManifestVersion !== next.manifestVersion ||
    request.toManifestVersion !== request.fromManifestVersion + 1
  ) {
    throw new DomainError('MANIFEST_VERSION_CONFLICT', 'manifest versions must be consecutive');
  }
  if (request.oldTotal !== previous.workUnits.length || request.newTotal !== next.workUnits.length) {
    throw new DomainError('MANIFEST_VERSION_CONFLICT', 'scope totals do not reconcile');
  }
  if (request.oldManifestHash !== previous.source.sha256 || request.newManifestHash !== next.source.sha256) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'scope manifest hashes do not match sources');
  }
  if (
    request.reason.trim().length === 0 ||
    request.approvingAuthority.trim().length === 0 ||
    !isSha256(request.authorityArtifactRef.sha256)
  ) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'scope authority evidence is incomplete');
  }

  const previousById = new Map(previous.workUnits.map((workUnit) => [workUnit.id, workUnit]));
  const nextById = new Map(next.workUnits.map((workUnit) => [workUnit.id, workUnit]));
  const added = [...nextById.keys()].filter((id) => !previousById.has(id)).sort();
  const removed = [...previousById.keys()].filter((id) => !nextById.has(id)).sort();
  const changed = [...previousById.keys()]
    .filter((id) => nextById.has(id) && hashCanonical(previousById.get(id)) !== hashCanonical(nextById.get(id)))
    .sort();
  assertExactIdList(request.addedWorkUnitIds, added, 'addedWorkUnitIds');
  assertExactIdList(request.removedWorkUnitIds, removed, 'removedWorkUnitIds');
  assertExactIdList(request.changedWorkUnitIds, changed, 'changedWorkUnitIds');
}

function assertExactIdList(actual: readonly string[], expected: readonly string[], label: string): void {
  const normalized = [...actual].sort();
  if (canonicalize(normalized) !== canonicalize(expected)) {
    throw new DomainError('MANIFEST_VERSION_CONFLICT', `${label} does not explain the exact scope diff`);
  }
}
