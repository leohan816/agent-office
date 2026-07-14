import { DomainError, type SourceArtifactRef } from '../../../contracts/types.js';
import {
  assertExactKeys,
  assertRecord,
  requireInteger,
  requireString,
} from '../../../contracts/validation.js';
import { assertUtcTimestamp, assertUuidV7 } from '../../../domain/time/index.js';
import { isSha256 } from '../../../persistence/file-store/hashing.js';

export const EXACT_DELIVERY_GOVERNED_MISSION =
  'AGENT_OFFICE_M01_ADVISOR_MANAGED_OFFICE_WEB_CONTROL_PLANE';
export const EXACT_DELIVERY_ACTIVATION_MISSION =
  'AGENT_OFFICE_M01_EXACT_ADVISOR_DELIVERY_ACTIVATION';

const SNAPSHOT_KEYS = [
  'roleProtocol',
  'transportProtocol',
  'activationState',
  'finalActivationRecord',
  'sessionRegistry',
  'killSwitchAndFallback',
  'optionADecision',
  'parentMissionManifest',
  // Current physical-identity migration decision (pre-AS1). A current v2 activation must snapshot the
  // exact migration decision; a legacy v1 activation / historical chain alone fails closed.
  'physicalMigrationDecision',
] as const;

export type ExactDeliverySnapshotKey = (typeof SNAPSHOT_KEYS)[number];

export interface ExactAdvisorDestination {
  readonly sessionName: 'agent-office-advisor';
  readonly sessionId: '$26';
  readonly windowIndex: 0;
  readonly paneIndex: 0;
  readonly paneId: '%26';
  readonly workspace: '/home/leo/Project/agent-office';
  readonly currentCommand: 'codex';
}

export interface ExactAdvisorLiveDestination extends ExactAdvisorDestination {
  readonly windowId: string;
}

export interface ExactAdvisorDeliveryActivation {
  readonly schemaVersion: 'agent-office.exact-advisor-delivery-activation.v2';
  readonly activationId: string;
  readonly mode: 'EXACT_ADVISOR_POINTER';
  readonly authorityProjectId: 'foundation-docs';
  readonly authorityRootId: string;
  readonly authorityGitSourceId: string;
  readonly governedMissionId: typeof EXACT_DELIVERY_GOVERNED_MISSION;
  readonly activationMissionId: typeof EXACT_DELIVERY_ACTIVATION_MISSION;
  readonly destination: ExactAdvisorDestination;
  readonly snapshotRefs: Readonly<Record<ExactDeliverySnapshotKey, SourceArtifactRef>>;
  readonly readinessLeasePath: string;
  readonly advisorEvidencePrefix: string;
  readonly capabilityTtlMs: number;
  readonly preflightMaxAgeMs: number;
  readonly toolLimits: {
    readonly timeoutMs: number;
    readonly maxOutputBytes: number;
  };
  readonly tmuxExecutable: '/usr/bin/tmux';
}

export interface AdvisorDeliveryReadinessLease {
  readonly schemaVersion: 'agent-office.advisor-delivery-readiness.v1';
  readonly leaseId: string;
  readonly activationMissionId: typeof EXACT_DELIVERY_ACTIVATION_MISSION;
  readonly governedMissionId: typeof EXACT_DELIVERY_GOVERNED_MISSION;
  readonly issuerRole: 'Advisor';
  readonly issuerSubjectId: 'agent-office-advisor';
  readonly destination: ExactAdvisorLiveDestination;
  readonly readiness: 'IDLE_FOR_ONE_POINTER';
  readonly useLimit: 1;
  readonly observedAt: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly registrySnapshotHash: string;
  readonly authoritySnapshotHash: string;
  readonly activationSnapshotHash: string;
  readonly evidenceRefs: readonly string[];
}

export interface AdvisorTransportCapabilityV2 {
  readonly schemaVersion: 'agent-office.advisor-transport-capability.v2';
  readonly capabilityId: string;
  readonly activationId: string;
  readonly logicalRoute: 'ADVISOR_ONLY';
  readonly transport: 'TMUX';
  readonly state: 'ACTIVE';
  readonly killSwitch: 'DISENGAGED';
  readonly synchronization: 'SINGLE_PREVALIDATED_DESTINATION';
  readonly activationMissionId: typeof EXACT_DELIVERY_ACTIVATION_MISSION;
  readonly governedMissionId: typeof EXACT_DELIVERY_GOVERNED_MISSION;
  readonly notificationId: string;
  readonly pointerEnvelopeHash: string;
  readonly destinationFingerprint: string;
  readonly readinessLeaseId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly authoritySnapshotHash: string;
  readonly activationSnapshotHash: string;
  readonly registrySnapshotHash: string;
}

export function parseExactAdvisorDeliveryActivation(
  value: unknown,
): ExactAdvisorDeliveryActivation {
  assertRecord(value, 'exact delivery activation');
  assertExactKeys(
    value,
    [
      'schemaVersion',
      'activationId',
      'mode',
      'authorityProjectId',
      'authorityRootId',
      'authorityGitSourceId',
      'governedMissionId',
      'activationMissionId',
      'destination',
      'snapshotRefs',
      'readinessLeasePath',
      'advisorEvidencePrefix',
      'capabilityTtlMs',
      'preflightMaxAgeMs',
      'toolLimits',
      'tmuxExecutable',
    ],
    'exact delivery activation',
  );
  if (
    value.schemaVersion !== 'agent-office.exact-advisor-delivery-activation.v2' ||
    value.mode !== 'EXACT_ADVISOR_POINTER' ||
    value.authorityProjectId !== 'foundation-docs' ||
    value.governedMissionId !== EXACT_DELIVERY_GOVERNED_MISSION ||
    value.activationMissionId !== EXACT_DELIVERY_ACTIVATION_MISSION ||
    value.tmuxExecutable !== '/usr/bin/tmux'
  ) {
    throw invalid('exact delivery activation has an unsupported authority or mode');
  }
  const activationId = boundedId(value.activationId, 'activationId');
  const capabilityTtlMs = boundedInteger(value.capabilityTtlMs, 'capabilityTtlMs', 30_000);
  const preflightMaxAgeMs = boundedInteger(value.preflightMaxAgeMs, 'preflightMaxAgeMs', 30_000);
  const readinessLeasePath = trustedJobPath(value.readinessLeasePath, 'readinessLeasePath', false);
  const advisorEvidencePrefix = trustedJobPath(value.advisorEvidencePrefix, 'advisorEvidencePrefix', true);
  const rawSnapshotRefs = value.snapshotRefs;
  assertRecord(rawSnapshotRefs, 'snapshotRefs');
  assertExactKeys(rawSnapshotRefs, SNAPSHOT_KEYS, 'snapshotRefs');
  const snapshotRefs = Object.fromEntries(
    SNAPSHOT_KEYS.map((key) => [key, parseSourceArtifactRef(rawSnapshotRefs[key], `snapshotRefs.${key}`)]),
  ) as unknown as Readonly<Record<ExactDeliverySnapshotKey, SourceArtifactRef>>;
  if (new Set(Object.values(snapshotRefs).map((ref) => `${ref.commit}:${ref.path}`)).size !== SNAPSHOT_KEYS.length) {
    throw invalid('exact delivery authority snapshots must be nine distinct Git blobs');
  }
  // The current physical-migration decision must be the exact committed migration-decision artifact;
  // identical decision bytes at any other trusted-repository path fail closed.
  if (
    snapshotRefs.physicalMigrationDecision.path !==
    'advisor/jobs/20260714_agent_office_pre_as1_physical_transport_identity_migration/01A_ACTIVE_REFERENCE_SCOPE_CLARIFICATION.md'
  ) {
    throw invalid('physical migration decision must be the exact current migration-decision artifact');
  }
  assertRecord(value.toolLimits, 'toolLimits');
  assertExactKeys(value.toolLimits, ['timeoutMs', 'maxOutputBytes'], 'toolLimits');
  const timeoutMs = boundedInteger(value.toolLimits.timeoutMs, 'toolLimits.timeoutMs', 30_000);
  const maxOutputBytes = boundedInteger(
    value.toolLimits.maxOutputBytes,
    'toolLimits.maxOutputBytes',
    65_536,
  );
  return {
    schemaVersion: 'agent-office.exact-advisor-delivery-activation.v2',
    activationId,
    mode: 'EXACT_ADVISOR_POINTER',
    authorityProjectId: 'foundation-docs',
    authorityRootId: boundedId(value.authorityRootId, 'authorityRootId'),
    authorityGitSourceId: boundedId(value.authorityGitSourceId, 'authorityGitSourceId'),
    governedMissionId: EXACT_DELIVERY_GOVERNED_MISSION,
    activationMissionId: EXACT_DELIVERY_ACTIVATION_MISSION,
    destination: parseDestination(value.destination, false),
    snapshotRefs,
    readinessLeasePath,
    advisorEvidencePrefix,
    capabilityTtlMs,
    preflightMaxAgeMs,
    toolLimits: { timeoutMs, maxOutputBytes },
    tmuxExecutable: '/usr/bin/tmux',
  };
}

export function parseAdvisorDeliveryReadinessLease(
  value: unknown,
): AdvisorDeliveryReadinessLease {
  assertRecord(value, 'Advisor readiness lease');
  assertExactKeys(
    value,
    [
      'schemaVersion',
      'leaseId',
      'activationMissionId',
      'governedMissionId',
      'issuerRole',
      'issuerSubjectId',
      'destination',
      'readiness',
      'useLimit',
      'observedAt',
      'issuedAt',
      'expiresAt',
      'registrySnapshotHash',
      'authoritySnapshotHash',
      'activationSnapshotHash',
      'evidenceRefs',
    ],
    'Advisor readiness lease',
  );
  if (
    value.schemaVersion !== 'agent-office.advisor-delivery-readiness.v1' ||
    value.activationMissionId !== EXACT_DELIVERY_ACTIVATION_MISSION ||
    value.governedMissionId !== EXACT_DELIVERY_GOVERNED_MISSION ||
    value.issuerRole !== 'Advisor' ||
    value.issuerSubjectId !== 'agent-office-advisor' ||
    value.readiness !== 'IDLE_FOR_ONE_POINTER' ||
    value.useLimit !== 1
  ) {
    throw invalid('Advisor readiness lease authority is invalid');
  }
  const leaseId = requireString(value.leaseId, 'leaseId');
  assertUuidV7(leaseId, 'leaseId');
  const observedAt = timestamp(value.observedAt, 'observedAt');
  const issuedAt = timestamp(value.issuedAt, 'issuedAt');
  const expiresAt = timestamp(value.expiresAt, 'expiresAt');
  if (
    Date.parse(observedAt) > Date.parse(issuedAt) ||
    Date.parse(expiresAt) <= Date.parse(issuedAt) ||
    Date.parse(expiresAt) - Date.parse(issuedAt) > 30_000
  ) {
    throw invalid('Advisor readiness lease time window is invalid');
  }
  const evidenceRefs = parseEvidenceRefs(value.evidenceRefs, 'evidenceRefs');
  return {
    schemaVersion: 'agent-office.advisor-delivery-readiness.v1',
    leaseId,
    activationMissionId: EXACT_DELIVERY_ACTIVATION_MISSION,
    governedMissionId: EXACT_DELIVERY_GOVERNED_MISSION,
    issuerRole: 'Advisor',
    issuerSubjectId: 'agent-office-advisor',
    destination: parseDestination(value.destination, true),
    readiness: 'IDLE_FOR_ONE_POINTER',
    useLimit: 1,
    observedAt,
    issuedAt,
    expiresAt,
    registrySnapshotHash: hash(value.registrySnapshotHash, 'registrySnapshotHash'),
    authoritySnapshotHash: hash(value.authoritySnapshotHash, 'authoritySnapshotHash'),
    activationSnapshotHash: hash(value.activationSnapshotHash, 'activationSnapshotHash'),
    evidenceRefs,
  };
}

export function parseSourceArtifactRef(value: unknown, label: string): SourceArtifactRef {
  assertRecord(value, label);
  assertExactKeys(value, ['repository', 'commit', 'path', 'sha256'], label);
  const repository = requireString(value.repository, `${label}.repository`, { maxLength: 128 });
  const commit = requireString(value.commit, `${label}.commit`, { maxLength: 40 });
  const relativePath = normalizedRelativePath(value.path, `${label}.path`);
  const sha256 = hash(value.sha256, `${label}.sha256`);
  if (repository !== 'foundation-docs' || !/^[0-9a-f]{40}$/u.test(commit)) {
    throw invalid(`${label} does not name the trusted repository and exact commit`);
  }
  return { repository, commit, path: relativePath, sha256 };
}

export function assertAdvisorTransportCapabilityV2(
  value: unknown,
): asserts value is AdvisorTransportCapabilityV2 {
  assertRecord(value, 'Advisor transport capability v2');
  assertExactKeys(
    value,
    [
      'schemaVersion', 'capabilityId', 'activationId', 'logicalRoute', 'transport', 'state',
      'killSwitch', 'synchronization', 'activationMissionId', 'governedMissionId',
      'notificationId', 'pointerEnvelopeHash', 'destinationFingerprint', 'readinessLeaseId',
      'issuedAt', 'expiresAt', 'authoritySnapshotHash', 'activationSnapshotHash',
      'registrySnapshotHash',
    ],
    'Advisor transport capability v2',
  );
  if (
    value.schemaVersion !== 'agent-office.advisor-transport-capability.v2' ||
    value.logicalRoute !== 'ADVISOR_ONLY' ||
    value.transport !== 'TMUX' ||
    value.state !== 'ACTIVE' ||
    value.killSwitch !== 'DISENGAGED' ||
    value.synchronization !== 'SINGLE_PREVALIDATED_DESTINATION' ||
    value.activationMissionId !== EXACT_DELIVERY_ACTIVATION_MISSION ||
    value.governedMissionId !== EXACT_DELIVERY_GOVERNED_MISSION
  ) {
    throw invalid('Advisor transport capability v2 vocabulary is invalid');
  }
  for (const [field, label] of [
    [value.capabilityId, 'capabilityId'],
    [value.notificationId, 'notificationId'],
    [value.readinessLeaseId, 'readinessLeaseId'],
  ] as const) {
    const id = requireString(field, label);
    assertUuidV7(id, label);
  }
  boundedId(value.activationId, 'activationId');
  for (const [field, label] of [
    [value.pointerEnvelopeHash, 'pointerEnvelopeHash'],
    [value.destinationFingerprint, 'destinationFingerprint'],
    [value.authoritySnapshotHash, 'authoritySnapshotHash'],
    [value.activationSnapshotHash, 'activationSnapshotHash'],
    [value.registrySnapshotHash, 'registrySnapshotHash'],
  ] as const) hash(field, label);
  const issuedAt = timestamp(value.issuedAt, 'issuedAt');
  const expiresAt = timestamp(value.expiresAt, 'expiresAt');
  if (Date.parse(expiresAt) <= Date.parse(issuedAt)) {
    throw invalid('Advisor transport capability v2 expiry is invalid');
  }
}

function parseDestination(value: unknown, live: false): ExactAdvisorDestination;
function parseDestination(value: unknown, live: true): ExactAdvisorLiveDestination;
function parseDestination(
  value: unknown,
  live: boolean,
): ExactAdvisorDestination | ExactAdvisorLiveDestination {
  assertRecord(value, 'Advisor destination');
  assertExactKeys(
    value,
    [
      'sessionName', 'sessionId', ...(live ? ['windowId'] : []), 'windowIndex', 'paneIndex',
      'paneId', 'workspace', 'currentCommand',
    ],
    'Advisor destination',
  );
  if (
    value.sessionName !== 'agent-office-advisor' ||
    value.sessionId !== '$26' ||
    value.windowIndex !== 0 ||
    value.paneIndex !== 0 ||
    value.paneId !== '%26' ||
    value.workspace !== '/home/leo/Project/agent-office' ||
    value.currentCommand !== 'codex'
  ) {
    throw new DomainError('FORBIDDEN_TARGET', 'only the fixed existing Advisor pane is representable');
  }
  const base: ExactAdvisorDestination = {
    sessionName: 'agent-office-advisor',
    sessionId: '$26',
    windowIndex: 0,
    paneIndex: 0,
    paneId: '%26',
    workspace: '/home/leo/Project/agent-office',
    currentCommand: 'codex',
  };
  if (!live) return base;
  const windowId = requireString(value.windowId, 'destination.windowId', { maxLength: 32 });
  if (!/^@[0-9]+$/u.test(windowId)) throw invalid('destination windowId is invalid');
  return { ...base, windowId };
}

function boundedId(value: unknown, label: string): string {
  const result = requireString(value, label, { maxLength: 128 });
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(result)) throw invalid(`${label} is invalid`);
  return result;
}

function boundedInteger(value: unknown, label: string, maximum: number): number {
  const result = requireInteger(value, label, 1);
  if (result > maximum) throw invalid(`${label} exceeds its closed range`);
  return result;
}

function trustedJobPath(value: unknown, label: string, directory: boolean): string {
  const result = normalizedRelativePath(value, label);
  const prefix = 'advisor/jobs/20260714_agent_office_pre_as1_physical_transport_identity_migration/';
  if (
    !result.startsWith(prefix) ||
    (directory ? !result.endsWith('/advisor-evidence') : !result.endsWith('.json'))
  ) {
    throw invalid(`${label} is outside the exact activation job`);
  }
  return result;
}

function normalizedRelativePath(value: unknown, label: string): string {
  const result = requireString(value, label, { maxLength: 4096 });
  if (
    result.startsWith('/') ||
    result.includes('\\') ||
    result.includes('\0') ||
    result.endsWith('/') ||
    result.split('/').some((part) => part.length === 0 || part === '.' || part === '..')
  ) {
    throw invalid(`${label} is not a normalized relative path`);
  }
  return result;
}

function parseEvidenceRefs(value: unknown, label: string): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 32 ||
    value.some((item) => typeof item !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u.test(item))
  ) {
    throw invalid(`${label} is invalid`);
  }
  return value as readonly string[];
}

function hash(value: unknown, label: string): string {
  const result = requireString(value, label, { maxLength: 71 });
  if (!isSha256(result)) throw invalid(`${label} is not a SHA-256 reference`);
  return result;
}

function timestamp(value: unknown, label: string): string {
  const result = requireString(value, label, { maxLength: 32 });
  assertUtcTimestamp(result, label);
  return result;
}

function invalid(message: string): DomainError {
  return new DomainError('INVALID_SCHEMA', message);
}
