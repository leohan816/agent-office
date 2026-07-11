import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import path from 'node:path';

import type { ArtifactRegistration } from '../adapters/observations/artifacts/source.js';
import type { GitSourceRegistration } from '../adapters/observations/git/source.js';
import type { ManifestSourceRegistration } from '../adapters/observations/manifest/source.js';
import type { ToolReadLimits } from '../adapters/observations/process-runner.js';
import type { TmuxSourceRegistration } from '../adapters/observations/tmux/source.js';
import {
  assertAdvisorTransportCapability,
  type AdvisorTransportCapability,
} from '../adapters/gateways/tmux-advisor/index.js';
import {
  parseExactAdvisorDeliveryActivation,
  type ExactAdvisorDeliveryActivation,
} from '../adapters/gateways/tmux-advisor/exact-config.js';
import type { FreshnessPolicy } from '../application/hosts/freshness.js';
import {
  ROOT_CAPABILITIES,
  type LocalProjectRegistration,
} from '../application/projects/registry.js';
import { DomainError } from '../contracts/types.js';
import {
  assertExactKeys,
  assertRecord,
  requireArray,
  requireEnum,
  requireInteger,
  requireString,
} from '../contracts/validation.js';
import { parseManifestSourceMetadata } from '../domain/manifest/index.js';
import {
  OFFICE_STATION_IDS,
  normalizeOfficeStationId,
  type OfficeStationId,
} from '../ui/scene/types.js';

export interface RuntimeActorRegistration {
  readonly roleInstanceId: string;
  readonly stationId: OfficeStationId;
  readonly actorRole: string;
  readonly acceptedManifestActorRoles: readonly string[];
  readonly projectId: string;
  readonly hostId: string;
  readonly workUnitIds: readonly string[];
  readonly gitSourceId?: string;
  readonly tmuxSourceId?: string;
  readonly artifactIds: readonly string[];
}

export interface OperationalRuntimeConfiguration {
  readonly schemaVersion:
    | 'agent-office.operational-runtime.v1'
    | 'agent-office.operational-runtime.v2';
  readonly missionSourceId: string;
  readonly projects: readonly LocalProjectRegistration[];
  readonly gitSources: readonly GitSourceRegistration[];
  readonly manifestSources: readonly ManifestSourceRegistration[];
  readonly artifactSources: readonly ArtifactRegistration[];
  readonly tmuxSources: readonly TmuxSourceRegistration[];
  readonly actors: readonly RuntimeActorRegistration[];
  readonly freshnessPolicies: {
    readonly git: FreshnessPolicy;
    readonly tmux: FreshnessPolicy;
  };
  readonly refreshIntervalMs: number;
  readonly gateway: {
    readonly adapter: 'TMUX_ADVISOR';
    readonly capability?: AdvisorTransportCapability;
    readonly activation?: ExactAdvisorDeliveryActivation;
  };
}

export async function loadOperationalRuntimeConfiguration(
  configPath: string,
): Promise<OperationalRuntimeConfiguration> {
  if (!path.isAbsolute(configPath)) {
    throw new DomainError('INVALID_SCHEMA', 'operational configuration path must be absolute');
  }
  let handle: import('node:fs/promises').FileHandle;
  try {
    handle = await open(configPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch {
    throw new DomainError('INVALID_SCHEMA', 'operational configuration is unavailable');
  }
  let bytes: Buffer;
  try {
    const info = await handle.stat();
    const currentUid = process.getuid?.();
    if (
      !info.isFile() ||
      (currentUid !== undefined && info.uid !== currentUid) ||
      (info.mode & 0o022) !== 0 ||
      info.size < 1 ||
      info.size > 256 * 1024
    ) {
      throw new DomainError('INVALID_SCHEMA', 'operational configuration file is invalid');
    }
    bytes = await handle.readFile();
  } finally {
    await handle.close();
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new DomainError('INVALID_SCHEMA', 'operational configuration is not valid UTF-8 JSON');
  }
  return parseOperationalRuntimeConfiguration(value);
}

export function parseOperationalRuntimeConfiguration(
  value: unknown,
): OperationalRuntimeConfiguration {
  assertRecord(value, 'OperationalRuntimeConfiguration');
  assertExactKeys(
    value,
    [
      'schemaVersion',
      'missionSourceId',
      'projects',
      'gitSources',
      'manifestSources',
      'artifactSources',
      'tmuxSources',
      'actors',
      'freshnessPolicies',
      'refreshIntervalMs',
      'gateway',
    ],
    'OperationalRuntimeConfiguration',
  );
  const exactDelivery = value.schemaVersion === 'agent-office.operational-runtime.v2';
  if (value.schemaVersion !== 'agent-office.operational-runtime.v1' && !exactDelivery) {
    throw new DomainError('INVALID_SCHEMA', 'unsupported operational configuration version');
  }
  const refreshIntervalMs = requireInteger(value.refreshIntervalMs, 'refreshIntervalMs', 250);
  if (refreshIntervalMs > 60_000) {
    throw new DomainError('INVALID_SCHEMA', 'refreshIntervalMs exceeds the bounded runtime range');
  }
  assertRecord(value.freshnessPolicies, 'freshnessPolicies');
  assertExactKeys(value.freshnessPolicies, ['git', 'tmux'], 'freshnessPolicies');
  assertRecord(value.gateway, 'gateway');
  const gatewayKeys = exactDelivery
    ? ['adapter', 'activation']
    : Object.hasOwn(value.gateway, 'capability')
      ? ['adapter', 'capability']
      : ['adapter'];
  assertExactKeys(value.gateway, gatewayKeys, 'gateway');
  if (value.gateway.adapter !== 'TMUX_ADVISOR') {
    throw new DomainError('INVALID_SCHEMA', 'M01 runtime gateway must be TMUX_ADVISOR');
  }
  const capability = exactDelivery ? undefined : value.gateway.capability;
  if (capability !== undefined) assertAdvisorTransportCapability(capability);
  const activation = exactDelivery
    ? parseExactAdvisorDeliveryActivation(value.gateway.activation)
    : undefined;
  const common = {
    missionSourceId: requireString(value.missionSourceId, 'missionSourceId', { maxLength: 128 }),
    projects: parseProjects(value.projects),
    gitSources: parseGitSources(value.gitSources),
    manifestSources: parseManifestSources(value.manifestSources),
    artifactSources: parseArtifactSources(value.artifactSources),
    tmuxSources: parseTmuxSources(value.tmuxSources),
    actors: parseActors(value.actors),
    freshnessPolicies: {
      git: parseFreshnessPolicy(value.freshnessPolicies.git, 'git freshness policy'),
      tmux: parseFreshnessPolicy(value.freshnessPolicies.tmux, 'tmux freshness policy'),
    },
    refreshIntervalMs,
  };
  return exactDelivery
    ? {
        ...common,
        schemaVersion: 'agent-office.operational-runtime.v2',
        gateway: {
          adapter: 'TMUX_ADVISOR',
          activation: requireActivation(activation),
        },
      }
    : {
        ...common,
        schemaVersion: 'agent-office.operational-runtime.v1',
        gateway: {
          adapter: 'TMUX_ADVISOR',
          ...(capability === undefined ? {} : { capability }),
        },
      };
}

export function legacyGatewayCapability(
  configuration: OperationalRuntimeConfiguration,
): AdvisorTransportCapability | undefined {
  return configuration.schemaVersion === 'agent-office.operational-runtime.v1'
    ? configuration.gateway.capability
    : undefined;
}

export function exactGatewayActivation(
  configuration: OperationalRuntimeConfiguration,
): ExactAdvisorDeliveryActivation | undefined {
  return configuration.schemaVersion === 'agent-office.operational-runtime.v2'
    ? requireActivation(configuration.gateway.activation)
    : undefined;
}

function requireActivation(
  activation: ExactAdvisorDeliveryActivation | undefined,
): ExactAdvisorDeliveryActivation {
  if (activation === undefined) throw new DomainError('INVALID_SCHEMA', 'exact activation is missing');
  return activation;
}

function parseProjects(value: unknown): readonly LocalProjectRegistration[] {
  return requireArray(value, 'projects').map((item, index) => {
    assertRecord(item, `projects[${index}]`);
    assertExactKeys(item, ['projectId', 'displayName', 'hostId', 'roots'], `projects[${index}]`);
    return {
      projectId: requireString(item.projectId, `projects[${index}].projectId`, { maxLength: 128 }),
      displayName: requireString(item.displayName, `projects[${index}].displayName`, { maxLength: 256 }),
      hostId: requireString(item.hostId, `projects[${index}].hostId`, { maxLength: 128 }),
      roots: requireArray(item.roots, `projects[${index}].roots`).map((root, rootIndex) => {
        assertRecord(root, `projects[${index}].roots[${rootIndex}]`);
        assertExactKeys(
          root,
          ['rootId', 'absolutePath', 'capabilities'],
          `projects[${index}].roots[${rootIndex}]`,
        );
        return {
          rootId: requireString(root.rootId, `projects[${index}].roots[${rootIndex}].rootId`, { maxLength: 128 }),
          absolutePath: requireString(root.absolutePath, `projects[${index}].roots[${rootIndex}].absolutePath`, { maxLength: 4096 }),
          capabilities: requireArray(
            root.capabilities,
            `projects[${index}].roots[${rootIndex}].capabilities`,
          ).map((capability, capabilityIndex) =>
            requireEnum(
              capability,
              ROOT_CAPABILITIES,
              `projects[${index}].roots[${rootIndex}].capabilities[${capabilityIndex}]`,
            )),
        };
      }),
    };
  });
}

function parseGitSources(value: unknown): readonly GitSourceRegistration[] {
  return requireArray(value, 'gitSources').map((item, index) => {
    assertRecord(item, `gitSources[${index}]`);
    assertExactKeys(
      item,
      ['sourceId', 'projectId', 'rootId', 'limits', 'refNamespaces', 'commitPairs'],
      `gitSources[${index}]`,
    );
    return {
      sourceId: requiredId(item.sourceId, `gitSources[${index}].sourceId`),
      projectId: requiredId(item.projectId, `gitSources[${index}].projectId`),
      rootId: requiredId(item.rootId, `gitSources[${index}].rootId`),
      limits: parseLimits(item.limits, `gitSources[${index}].limits`),
      refNamespaces: requireArray(item.refNamespaces, `gitSources[${index}].refNamespaces`).map(
        (namespace, namespaceIndex) => {
          assertRecord(namespace, `gitSources[${index}].refNamespaces[${namespaceIndex}]`);
          assertExactKeys(
            namespace,
            ['namespaceId', 'exactPrefix'],
            `gitSources[${index}].refNamespaces[${namespaceIndex}]`,
          );
          return {
            namespaceId: requiredId(namespace.namespaceId, 'namespaceId'),
            exactPrefix: requireString(namespace.exactPrefix, 'exactPrefix', { maxLength: 512 }),
          };
        },
      ),
      commitPairs: requireArray(item.commitPairs, `gitSources[${index}].commitPairs`).map(
        (pair, pairIndex) => {
          assertRecord(pair, `gitSources[${index}].commitPairs[${pairIndex}]`);
          assertExactKeys(
            pair,
            ['commitPairId', 'baseCommit', 'headCommit'],
            `gitSources[${index}].commitPairs[${pairIndex}]`,
          );
          return {
            commitPairId: requiredId(pair.commitPairId, 'commitPairId'),
            baseCommit: requireString(pair.baseCommit, 'baseCommit', { maxLength: 40 }),
            headCommit: requireString(pair.headCommit, 'headCommit', { maxLength: 40 }),
          };
        },
      ),
    };
  });
}

function parseManifestSources(value: unknown): readonly ManifestSourceRegistration[] {
  return requireArray(value, 'manifestSources').map((item, index) => {
    assertRecord(item, `manifestSources[${index}]`);
    const keys = Object.hasOwn(item, 'gitSourceId')
      ? ['sourceId', 'projectId', 'rootId', 'relativePath', 'maxBytes', 'sourceMetadata', 'gitSourceId']
      : ['sourceId', 'projectId', 'rootId', 'relativePath', 'maxBytes', 'sourceMetadata'];
    assertExactKeys(item, keys, `manifestSources[${index}]`);
    const gitSourceId = optionalId(item.gitSourceId, `manifestSources[${index}].gitSourceId`);
    return {
      sourceId: requiredId(item.sourceId, `manifestSources[${index}].sourceId`),
      projectId: requiredId(item.projectId, `manifestSources[${index}].projectId`),
      rootId: requiredId(item.rootId, `manifestSources[${index}].rootId`),
      relativePath: requireString(item.relativePath, `manifestSources[${index}].relativePath`, { maxLength: 4096 }),
      maxBytes: requireInteger(item.maxBytes, `manifestSources[${index}].maxBytes`, 1),
      sourceMetadata: parseManifestSourceMetadata(item.sourceMetadata),
      ...(gitSourceId === undefined ? {} : { gitSourceId }),
    };
  });
}

function parseArtifactSources(value: unknown): readonly ArtifactRegistration[] {
  return requireArray(value, 'artifactSources').map((item, index) => {
    assertRecord(item, `artifactSources[${index}]`);
    const optionalKeys = ['expectedCommit', 'gitSourceId'].filter((key) => Object.hasOwn(item, key));
    assertExactKeys(
      item,
      [
        'artifactId',
        'projectId',
        'sourceId',
        'rootId',
        'relativePath',
        'maxBytes',
        'expectedSha256',
        ...optionalKeys,
      ],
      `artifactSources[${index}]`,
    );
    const expectedCommit = optionalString(item.expectedCommit, 'expectedCommit', 40);
    const gitSourceId = optionalId(item.gitSourceId, 'gitSourceId');
    return {
      artifactId: requiredId(item.artifactId, `artifactSources[${index}].artifactId`),
      projectId: requiredId(item.projectId, `artifactSources[${index}].projectId`),
      sourceId: requiredId(item.sourceId, `artifactSources[${index}].sourceId`),
      rootId: requiredId(item.rootId, `artifactSources[${index}].rootId`),
      relativePath: requireString(item.relativePath, `artifactSources[${index}].relativePath`, { maxLength: 4096 }),
      maxBytes: requireInteger(item.maxBytes, `artifactSources[${index}].maxBytes`, 1),
      expectedSha256: requireString(item.expectedSha256, `artifactSources[${index}].expectedSha256`, { maxLength: 71 }),
      ...(expectedCommit === undefined ? {} : { expectedCommit }),
      ...(gitSourceId === undefined ? {} : { gitSourceId }),
    };
  });
}

function parseTmuxSources(value: unknown): readonly TmuxSourceRegistration[] {
  return requireArray(value, 'tmuxSources').map((item, index) => {
    assertRecord(item, `tmuxSources[${index}]`);
    const optionalKeys = Object.hasOwn(item, 'currentCommandEscaped') ? ['currentCommandEscaped'] : [];
    assertExactKeys(
      item,
      [
        'sourceId',
        'projectId',
        'hostId',
        'sessionId',
        'windowId',
        'paneId',
        'sessionNameEscaped',
        'windowNameEscaped',
        'windowIndex',
        'paneIndex',
        'workspaceRootId',
        'limits',
        ...optionalKeys,
      ],
      `tmuxSources[${index}]`,
    );
    const currentCommandEscaped = optionalString(item.currentCommandEscaped, 'currentCommandEscaped', 4096);
    return {
      sourceId: requiredId(item.sourceId, `tmuxSources[${index}].sourceId`),
      projectId: requiredId(item.projectId, `tmuxSources[${index}].projectId`),
      hostId: requiredId(item.hostId, `tmuxSources[${index}].hostId`),
      sessionId: requireString(item.sessionId, 'sessionId', { maxLength: 32 }),
      windowId: requireString(item.windowId, 'windowId', { maxLength: 32 }),
      paneId: requireString(item.paneId, 'paneId', { maxLength: 32 }),
      sessionNameEscaped: normalizedLegacyText(
        requireString(item.sessionNameEscaped, 'sessionNameEscaped', { maxLength: 4096 }),
      ),
      windowNameEscaped: normalizedLegacyText(
        requireString(item.windowNameEscaped, 'windowNameEscaped', { maxLength: 4096 }),
      ),
      windowIndex: requireInteger(item.windowIndex, 'windowIndex', 0),
      paneIndex: requireInteger(item.paneIndex, 'paneIndex', 0),
      workspaceRootId: requiredId(item.workspaceRootId, 'workspaceRootId'),
      ...(currentCommandEscaped === undefined ? {} : { currentCommandEscaped }),
      limits: parseLimits(item.limits, `tmuxSources[${index}].limits`),
    };
  });
}

function parseActors(value: unknown): readonly RuntimeActorRegistration[] {
  return requireArray(value, 'actors').map((item, index) => {
    assertRecord(item, `actors[${index}]`);
    const optionalKeys = ['gitSourceId', 'tmuxSourceId'].filter((key) => Object.hasOwn(item, key));
    assertExactKeys(
      item,
      [
        'roleInstanceId',
        'stationId',
        'actorRole',
        'acceptedManifestActorRoles',
        'projectId',
        'hostId',
        'workUnitIds',
        'artifactIds',
        ...optionalKeys,
      ],
      `actors[${index}]`,
    );
    const gitSourceId = optionalId(item.gitSourceId, `actors[${index}].gitSourceId`);
    const tmuxSourceId = optionalId(item.tmuxSourceId, `actors[${index}].tmuxSourceId`);
    return {
      roleInstanceId: requiredId(item.roleInstanceId, `actors[${index}].roleInstanceId`),
      stationId: normalizedStationId(item.stationId, `actors[${index}].stationId`),
      actorRole: normalizedActorRole(item.actorRole, `actors[${index}].actorRole`),
      acceptedManifestActorRoles: stringList(item.acceptedManifestActorRoles, `actors[${index}].acceptedManifestActorRoles`),
      projectId: requiredId(item.projectId, `actors[${index}].projectId`),
      hostId: requiredId(item.hostId, `actors[${index}].hostId`),
      workUnitIds: stringList(item.workUnitIds, `actors[${index}].workUnitIds`),
      ...(gitSourceId === undefined ? {} : { gitSourceId }),
      ...(tmuxSourceId === undefined ? {} : { tmuxSourceId }),
      artifactIds: stringList(item.artifactIds, `actors[${index}].artifactIds`),
    };
  });
}

function parseFreshnessPolicy(value: unknown, label: string): FreshnessPolicy {
  assertRecord(value, label);
  assertExactKeys(value, ['policyId', 'staleAfterMs', 'offlineAfterMs'], label);
  return {
    policyId: requiredId(value.policyId, `${label}.policyId`),
    staleAfterMs: requireInteger(value.staleAfterMs, `${label}.staleAfterMs`, 0),
    offlineAfterMs: requireInteger(value.offlineAfterMs, `${label}.offlineAfterMs`, 1),
  };
}

function normalizedStationId(value: unknown, label: string): OfficeStationId {
  const normalized = normalizeOfficeStationId(value);
  if (normalized === undefined) {
    requireEnum(value, OFFICE_STATION_IDS, label);
    throw new DomainError('INVALID_SCHEMA', `${label} is invalid`);
  }
  return normalized;
}

function normalizedActorRole(value: unknown, label: string): string {
  const role = requireString(value, label, { maxLength: 256 });
  return role === 'Shashu Worker' ? 'SIASIU Worker' : role;
}

function parseLimits(value: unknown, label: string): ToolReadLimits {
  assertRecord(value, label);
  assertExactKeys(value, ['timeoutMs', 'maxOutputBytes'], label);
  return {
    timeoutMs: requireInteger(value.timeoutMs, `${label}.timeoutMs`, 1),
    maxOutputBytes: requireInteger(value.maxOutputBytes, `${label}.maxOutputBytes`, 1),
  };
}

function stringList(value: unknown, label: string): readonly string[] {
  return requireArray(value, label).map((item, index) =>
    normalizedLegacyText(requireString(item, `${label}[${index}]`, { maxLength: 256 })));
}

function requiredId(value: unknown, label: string): string {
  return normalizedLegacyText(requireString(value, label, { maxLength: 128 }));
}

function normalizedLegacyText(value: string): string {
  return value.replaceAll('Shashu Worker', 'SIASIU Worker').replaceAll('shashu', 'siasiu');
}

function optionalId(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : requiredId(value, label);
}

function optionalString(value: unknown, label: string, maxLength: number): string | undefined {
  return value === undefined ? undefined : requireString(value, label, { maxLength });
}
