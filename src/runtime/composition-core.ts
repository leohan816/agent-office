import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';

import { HermesAdvisorGateway } from '../adapters/gateways/hermes/index.js';
import type { DecisionAuthorityEvidenceVerifier } from '../application/advisor-inbox/types.js';
import { AdvisorInboxService } from '../application/advisor-inbox/service.js';
import { DurableAlertCenter } from '../application/alerts/index.js';
import { DomainError } from '../contracts/types.js';
import { importMissionManifest, parseManifestSourceMetadata } from '../domain/manifest/index.js';
import { DurableDeliveryControl } from '../operations/readiness/delivery-control.js';
import { assessStartupReadiness } from '../operations/readiness/index.js';
import { ImmutableArtifactStore } from '../persistence/file-store/artifact-store.js';
import { EventStore } from '../persistence/file-store/event-store.js';
import { readStateRootFormat, validateStateRoot } from '../persistence/file-store/path-safety.js';
import {
  bindBatchDApplication,
  type AgentOfficeHttpApplication,
  type LocalRuntimeStatus,
} from '../server/application.js';
import type { BrowserSessionRegistry } from '../server/auth/index.js';
import {
  assertPrivateDeploymentConfiguration,
  type PrivateDeploymentConfiguration,
} from '../server/config.js';
import {
  startAgentOfficeHttpServer,
  type RunningAgentOfficeHttpServer,
} from '../server/http/server.js';
import { FileSecurityAuditLog } from '../server/security/audit.js';
import { ProjectionSseBroker } from '../server/sse/index.js';
import type { AgentOfficeRuntimeIdentity } from './identity.js';
import { buildRuntimeProjection } from './projection.js';

export interface CompositionCoreOptions {
  readonly configuration: PrivateDeploymentConfiguration;
  readonly appRoot: string;
  readonly stateRoot: string;
  readonly staticRoot: string;
  readonly manifestPath: string;
  readonly manifestSourcePath: string;
  readonly buildId: string;
  readonly runtime: AgentOfficeRuntimeIdentity;
  readonly authorityEvidenceVerifier: DecisionAuthorityEvidenceVerifier;
  readonly sessions?: BrowserSessionRegistry;
  readonly testMutationEnabled?: boolean;
  readonly heartbeatMs?: number;
}

export interface RunningAgentOfficeComposition {
  readonly origins: readonly string[];
  readonly primaryOrigin: string;
  readonly stateRoot: string;
  readonly store: EventStore;
  readonly inbox: AdvisorInboxService;
  readonly alerts: DurableAlertCenter;
  readonly sse: ProjectionSseBroker;
  readonly sessions?: BrowserSessionRegistry;
  readStatus(): LocalRuntimeStatus;
  close(): Promise<void>;
}

export async function startAgentOfficeCompositionCore(
  options: CompositionCoreOptions,
): Promise<RunningAgentOfficeComposition> {
  assertPrivateDeploymentConfiguration(options.configuration);
  const appRoot = await canonicalDirectory(options.appRoot, 'application root');
  const stateRoot = await validateStateRoot(options.stateRoot);
  const staticRoot = await canonicalDirectory(options.staticRoot, 'built dashboard root');
  if (pathsOverlap(stateRoot, appRoot) || pathsOverlap(stateRoot, staticRoot)) {
    throw new DomainError('INVALID_SCHEMA', 'state root must be outside application and static roots');
  }
  const manifestBytes = await readOwnedFileWithin(appRoot, options.manifestPath, 128 * 1024);
  const sourceBytes = await readOwnedFileWithin(appRoot, options.manifestSourcePath, 16 * 1024);
  let sourceValue: unknown;
  try {
    sourceValue = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(sourceBytes)) as unknown;
  } catch {
    throw new DomainError('INVALID_SCHEMA', 'manifest source metadata is invalid');
  }
  const manifest = importMissionManifest(manifestBytes, parseManifestSourceMetadata(sourceValue));
  const format = await readStateRootFormat(stateRoot);
  const store = await EventStore.open({
    root: stateRoot,
    missionId: manifest.missionId,
    manifestVersion: manifest.manifestVersion,
    writer: {
      buildId: options.buildId,
      stateRootId: format.stateRootId,
      acquiredAt: options.runtime.now(),
    },
  });
  const servers: RunningAgentOfficeHttpServer[] = [];
  try {
    const artifacts = await ImmutableArtifactStore.open(stateRoot);
    const audit = await FileSecurityAuditLog.open(stateRoot);
    const delivery = await DurableDeliveryControl.open(stateRoot);
    const gateway = new HermesAdvisorGateway(() => options.runtime.now());
    const policy = {
      missionId: manifest.missionId,
      manifestVersion: manifest.manifestVersion,
      allowlistedEntityIds: new Set(manifest.workUnits.map((workUnit) => workUnit.id)),
    };
    const inbox = new AdvisorInboxService(
      store,
      artifacts,
      gateway,
      options.runtime,
      policy,
      options.authorityEvidenceVerifier,
    );
    const alerts = new DurableAlertCenter(
      store,
      artifacts,
      options.runtime,
      manifest.missionId,
      manifest.manifestVersion,
    );
    const sse = new ProjectionSseBroker();
    const readStatus = (): LocalRuntimeStatus => assessStartupReadiness({
      configValidated: true,
      writerLock: 'ACQUIRED',
      store: 'VERIFIED',
      projection: 'VERIFIED',
      authentication: options.sessions === undefined ? 'UNAVAILABLE' : 'TEST_READY',
      mutationConfigured: options.sessions !== undefined && options.testMutationEnabled === true,
      delivery: delivery.project().mode,
      sse: 'READY',
      projectionRevision: store.sequence,
      lastVerifiedAt: options.runtime.now(),
    });
    const application = publishProjectionAfterMutation(
      bindBatchDApplication({
        inbox,
        alerts,
        readStatus: () => Promise.resolve(readStatus()),
        readProjection: () => Promise.resolve(buildRuntimeProjection({
          manifest,
          store,
          inbox,
          alerts,
          runtime: options.runtime,
        })),
        disableDelivery: (command) => delivery.disable(command),
      }),
      store,
      inbox,
      sse,
    );
    for (const bindAddress of options.configuration.bindAddresses) {
      const server = await startAgentOfficeHttpServer(
        {
          bindAddress,
          application,
          ...(options.sessions === undefined ? {} : { sessions: options.sessions }),
          audit,
          sse,
          now: () => options.runtime.now(),
          nextId: () => options.runtime.nextId(),
          staticRoot,
          ...(options.heartbeatMs === undefined ? {} : { heartbeatMs: options.heartbeatMs }),
        },
        options.configuration.port,
      );
      const allowedHost = server.networkPolicy.allowedHosts[0];
      if (
        allowedHost === undefined ||
        !options.configuration.allowedHosts.includes(allowedHost)
      ) {
        await server.close();
        throw new DomainError('INVALID_SCHEMA', 'runtime listener does not match the Host allowlist');
      }
      servers.push(server);
    }
    let closed = false;
    const result: RunningAgentOfficeComposition = {
      origins: servers.map((server) => server.origin),
      primaryOrigin: servers[0]?.origin ?? failNoListener(),
      stateRoot,
      store,
      inbox,
      alerts,
      sse,
      ...(options.sessions === undefined ? {} : { sessions: options.sessions }),
      readStatus,
      close: async () => {
        if (closed) return;
        closed = true;
        let failure: unknown;
        for (const server of [...servers].reverse()) {
          try {
            await server.close();
          } catch (error) {
            failure ??= error;
          }
        }
        try {
          await store.close();
        } catch (error) {
          failure ??= error;
        }
        if (failure !== undefined) {
          throw failure instanceof Error ? failure : new Error('composition cleanup failed');
        }
      },
    };
    return result;
  } catch (error) {
    for (const server of [...servers].reverse()) await server.close().catch(() => undefined);
    await store.close().catch(() => undefined);
    throw error;
  }
}

function publishProjectionAfterMutation(
  application: AgentOfficeHttpApplication,
  store: EventStore,
  inbox: AdvisorInboxService,
  sse: ProjectionSseBroker,
): AgentOfficeHttpApplication {
  let lastPublishedRevision = store.sequence;
  const publish = (): void => {
    if (store.sequence <= lastPublishedRevision) return;
    lastPublishedRevision = store.sequence;
    sse.publish({
      revision: store.sequence,
      notificationIds: Object.keys(inbox.project().notifications).sort(),
    });
  };
  const after = async <T>(operation: Promise<T>): Promise<T> => {
    const result = await operation;
    publish();
    return result;
  };
  return {
    readStatus: () => application.readStatus(),
    readProjection: () => application.readProjection(),
    submitAdvisorMessage: (command, context) => after(application.submitAdvisorMessage(command, context)),
    recordAdvisorAcknowledgement: (command) => after(application.recordAdvisorAcknowledgement(command)),
    recordAdvisorIntake: (command) => after(application.recordAdvisorIntake(command)),
    recordAdvisorDecision: (command) => after(application.recordAdvisorDecision(command)),
    acknowledgeAlert: (command) => after(application.acknowledgeAlert(command)),
    disableDelivery: (command) => after(application.disableDelivery(command)),
  };
}

async function canonicalDirectory(directory: string, label: string): Promise<string> {
  if (!path.isAbsolute(directory)) throw new DomainError('INVALID_SCHEMA', `${label} must be absolute`);
  const info = await lstat(directory).catch(() => undefined);
  const currentUid = process.getuid?.();
  if (
    info === undefined ||
    info.isSymbolicLink() ||
    !info.isDirectory() ||
    (currentUid !== undefined && info.uid !== currentUid)
  ) {
    throw new DomainError('INVALID_SCHEMA', `${label} is invalid`);
  }
  return realpath(directory);
}

async function readOwnedFileWithin(
  root: string,
  filePath: string,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!path.isAbsolute(filePath)) throw new DomainError('INVALID_SCHEMA', 'runtime file path must be absolute');
  const canonicalPath = await realpath(filePath).catch(() => undefined);
  if (
    canonicalPath === undefined ||
    (canonicalPath !== root && !canonicalPath.startsWith(`${root}${path.sep}`))
  ) {
    throw new DomainError('INVALID_SCHEMA', 'runtime file escapes the application root');
  }
  let handle: import('node:fs/promises').FileHandle;
  try {
    handle = await open(canonicalPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch {
    throw new DomainError('INVALID_SCHEMA', 'runtime file is unavailable');
  }
  try {
    const info = await handle.stat();
    const currentUid = process.getuid?.();
    if (
      !info.isFile() ||
      (currentUid !== undefined && info.uid !== currentUid) ||
      info.size < 1 ||
      info.size > maxBytes
    ) {
      throw new DomainError('INVALID_SCHEMA', 'runtime file is invalid');
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

function pathsOverlap(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}${path.sep}`) || right.startsWith(`${left}${path.sep}`);
}

function failNoListener(): never {
  throw new DomainError('INVALID_SCHEMA', 'composition started without a listener');
}
