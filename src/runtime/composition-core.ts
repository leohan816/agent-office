import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';

import type { AdvisorGateway } from '../adapters/gateways/advisor.js';
import type { ReadonlyToolRunner } from '../adapters/observations/process-runner.js';
import type { DecisionAuthorityEvidenceVerifier } from '../application/advisor-inbox/types.js';
import { AdvisorInboxService } from '../application/advisor-inbox/service.js';
import { DurableAlertCenter } from '../application/alerts/index.js';
import { DomainError } from '../contracts/types.js';
import { DurableDeliveryControl } from '../operations/readiness/delivery-control.js';
import {
  assessStartupReadiness,
  type AuthenticationReadiness,
} from '../operations/readiness/index.js';
import { ImmutableArtifactStore } from '../persistence/file-store/artifact-store.js';
import { EventStore } from '../persistence/file-store/event-store.js';
import { hashCanonical } from '../persistence/file-store/hashing.js';
import { readStateRootFormat, validateStateRoot } from '../persistence/file-store/path-safety.js';
import {
  bindBatchDApplication,
  type AgentOfficeHttpApplication,
  type LocalRuntimeStatus,
} from '../server/application.js';
import type {
  AuthenticationExchange,
  AuthenticationProvider,
  BrowserSessionRegistry,
} from '../server/auth/index.js';
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
import {
  RuntimeObservationCoordinator,
  type RuntimeObservationSnapshot,
} from './observation-coordinator.js';
import type { OperationalRuntimeConfiguration } from './operational-config.js';
import { buildRuntimeProjection } from './projection.js';

export interface CompositionCoreOptions {
  readonly configuration: PrivateDeploymentConfiguration;
  readonly appRoot: string;
  readonly stateRoot: string;
  readonly staticRoot: string;
  readonly operationalConfiguration: OperationalRuntimeConfiguration;
  readonly buildId: string;
  readonly runtime: AgentOfficeRuntimeIdentity;
  readonly advisorGateway: AdvisorGateway;
  readonly readonlyToolRunner?: ReadonlyToolRunner;
  readonly authorityEvidenceVerifier: DecisionAuthorityEvidenceVerifier;
  readonly sessions?: BrowserSessionRegistry;
  readonly authenticationProvider?: AuthenticationProvider;
  readonly authenticationReadiness?: AuthenticationReadiness;
  readonly bootstrapExchange?: AuthenticationExchange;
  readonly mutationConfigured?: boolean;
  readonly authenticationStartup?: () => Promise<void>;
  readonly authenticationCleanup?: () => Promise<void>;
  readonly heartbeatMs?: number;
}

export interface RunningAgentOfficeComposition {
  readonly origins: readonly string[];
  readonly primaryOrigin: string;
  readonly stateRoot: string;
  readonly store: EventStore;
  readonly inbox: AdvisorInboxService;
  readonly alerts: DurableAlertCenter;
  readonly observations: RuntimeObservationCoordinator;
  readonly sse: ProjectionSseBroker;
  readonly sessions?: BrowserSessionRegistry;
  readonly authenticationProvider?: AuthenticationProvider;
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
  if (options.configuration.authProvider === 'LOCAL_BOOTSTRAP') {
    await assertProofDeliveryPathIsolated(
      options.configuration.bootstrapProofFile,
      [appRoot, stateRoot, staticRoot],
      options.operationalConfiguration,
    );
  }
  await assertObservedRootsOutsideStateRoot(stateRoot, options.operationalConfiguration);
  const observations = await RuntimeObservationCoordinator.create({
    configuration: options.operationalConfiguration,
    now: () => options.runtime.now(),
    ...(options.readonlyToolRunner === undefined ? {} : { runner: options.readonlyToolRunner }),
  });
  const manifest = await observations.start();
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
  let refreshTimer: ReturnType<typeof setInterval> | undefined;
  try {
    const artifacts = await ImmutableArtifactStore.open(stateRoot);
    const audit = await FileSecurityAuditLog.open(stateRoot);
    const delivery = await DurableDeliveryControl.open(stateRoot);
    const policy = {
      missionId: manifest.missionId,
      manifestVersion: manifest.manifestVersion,
      allowlistedEntityIds: new Set(manifest.workUnits.map((workUnit) => workUnit.id)),
    };
    const inbox = new AdvisorInboxService(
      store,
      artifacts,
      options.advisorGateway,
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
    await inbox.recoverOutbox();
    const sse = new ProjectionSseBroker();
    let projectionRevision = store.sequence;
    let lastObservationSignature = observationSignature(observations.snapshot());
    const nextProjectionRevision = (): number => {
      projectionRevision += 1;
      return projectionRevision;
    };
    const refreshObservations = async (): Promise<void> => {
      const snapshot = await observations.refresh();
      const signature = observationSignature(snapshot);
      if (signature === lastObservationSignature) return;
      lastObservationSignature = signature;
      sse.publish({
        revision: nextProjectionRevision(),
        notificationIds: Object.keys(inbox.project().notifications).sort(),
      });
    };
    const authenticationReadiness = options.authenticationReadiness ??
      (options.sessions === undefined ? 'UNAVAILABLE' : 'TEST_READY');
    const readStatus = (): LocalRuntimeStatus => {
      const deliveryControl = delivery.project();
      const gatewayHealth = options.advisorGateway.health();
      const deliveryMode = deliveryControl.receiptCount > 0
        ? 'DISABLED' as const
        : gatewayHealth.status === 'READY'
          ? 'ENABLED' as const
          : 'MANUAL_FALLBACK_REQUIRED' as const;
      return assessStartupReadiness({
        configValidated: true,
        writerLock: 'ACQUIRED',
        store: 'VERIFIED',
        projection: 'VERIFIED',
        authentication: authenticationReadiness,
        mutationConfigured: options.sessions !== undefined && options.mutationConfigured === true,
        delivery: deliveryMode,
        sse: 'READY',
        projectionRevision,
        lastVerifiedAt: options.runtime.now(),
      });
    };
    const boundApplication = bindBatchDApplication({
      inbox,
      alerts,
      readStatus: () => Promise.resolve(readStatus()),
      readProjection: async () => {
        await refreshObservations();
        return buildRuntimeProjection({
          manifest,
          store,
          inbox,
          alerts,
          runtime: options.runtime,
          observations,
          projectionRevision,
        });
      },
      disableDelivery: (command) => delivery.disable(command),
    });
    const application = publishProjectionAfterMutation(
      dispatchPersistedAdvisorMessages(boundApplication, inbox),
      store,
      inbox,
      sse,
      nextProjectionRevision,
    );
    await options.authenticationStartup?.();
    for (const bindAddress of options.configuration.bindAddresses) {
      const server = await startAgentOfficeHttpServer(
        {
          bindAddress,
          application,
          ...(options.sessions === undefined ? {} : { sessions: options.sessions }),
          ...(options.bootstrapExchange === undefined
            ? {}
            : { bootstrapExchange: options.bootstrapExchange }),
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
    refreshTimer = setInterval(() => {
      void refreshObservations().catch(() => undefined);
    }, options.operationalConfiguration.refreshIntervalMs);
    let closed = false;
    const result: RunningAgentOfficeComposition = {
      origins: servers.map((server) => server.origin),
      primaryOrigin: servers[0]?.origin ?? failNoListener(),
      stateRoot,
      store,
      inbox,
      alerts,
      observations,
      sse,
      ...(options.sessions === undefined ? {} : { sessions: options.sessions }),
      ...(options.authenticationProvider === undefined
        ? {}
        : { authenticationProvider: options.authenticationProvider }),
      readStatus,
      close: async () => {
        if (closed) return;
        closed = true;
        if (refreshTimer !== undefined) clearInterval(refreshTimer);
        let failure: unknown;
        for (const server of [...servers].reverse()) {
          try {
            await server.close();
          } catch (error) {
            failure ??= error;
          }
        }
        try {
          await options.authenticationCleanup?.();
        } catch (error) {
          failure ??= error;
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
    if (refreshTimer !== undefined) clearInterval(refreshTimer);
    for (const server of [...servers].reverse()) await server.close().catch(() => undefined);
    await options.authenticationCleanup?.().catch(() => undefined);
    await store.close().catch(() => undefined);
    throw error;
  }
}

async function assertProofDeliveryPathIsolated(
  proofPath: string,
  runtimeRoots: readonly string[],
  configuration: OperationalRuntimeConfiguration,
): Promise<void> {
  const parent = await canonicalDirectory(path.dirname(proofPath), 'LocalBootstrap proof directory');
  const observedRoots = await Promise.all(
    configuration.projects.flatMap((project) => project.roots.map(async (root) => {
      const canonicalRoot = await realpath(root.absolutePath).catch(() => undefined);
      if (canonicalRoot === undefined) {
        throw new DomainError('INVALID_SCHEMA', 'observed root is unavailable');
      }
      return canonicalRoot;
    })),
  );
  if ([...runtimeRoots, ...observedRoots].some((root) => pathsOverlap(parent, root))) {
    throw new DomainError(
      'INVALID_SCHEMA',
      'LocalBootstrap proof directory must be isolated from application, state, static, and observed roots',
    );
  }
}

function publishProjectionAfterMutation(
  application: AgentOfficeHttpApplication,
  store: EventStore,
  inbox: AdvisorInboxService,
  sse: ProjectionSseBroker,
  nextProjectionRevision: () => number,
): AgentOfficeHttpApplication {
  let lastPublishedRevision = store.sequence;
  const publish = (): void => {
    if (store.sequence <= lastPublishedRevision) return;
    lastPublishedRevision = store.sequence;
    sse.publish({
      revision: nextProjectionRevision(),
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

function dispatchPersistedAdvisorMessages(
  application: AgentOfficeHttpApplication,
  inbox: AdvisorInboxService,
): AgentOfficeHttpApplication {
  return {
    ...application,
    submitAdvisorMessage: async (command, context) => {
      const receipt = await application.submitAdvisorMessage(command, context);
      const notification = await inbox.queueMessage(receipt.messageId);
      await inbox.deliverNotification(notification.notificationId);
      return receipt;
    },
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

async function assertObservedRootsOutsideStateRoot(
  stateRoot: string,
  configuration: OperationalRuntimeConfiguration,
): Promise<void> {
  for (const project of configuration.projects) {
    for (const root of project.roots) {
      const canonicalRoot = await realpath(root.absolutePath).catch(() => undefined);
      if (canonicalRoot === undefined || pathsOverlap(stateRoot, canonicalRoot)) {
        throw new DomainError('INVALID_SCHEMA', 'observed root must be isolated from runtime state');
      }
    }
  }
}

function pathsOverlap(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}${path.sep}`) || right.startsWith(`${left}${path.sep}`);
}

function failNoListener(): never {
  throw new DomainError('INVALID_SCHEMA', 'composition started without a listener');
}

function observationSignature(snapshot: RuntimeObservationSnapshot): string {
  return hashCanonical({
    missionId: snapshot.missionId,
    manifestVersion: snapshot.manifestVersion,
    manifestStatus: snapshot.manifest.status,
    manifestErrorCode: snapshot.manifest.evidence.errorCode ?? null,
    actors: Object.values(snapshot.actors)
      .sort((left, right) => left.roleInstanceId.localeCompare(right.roleInstanceId))
      .map((actor) => ({
        roleInstanceId: actor.roleInstanceId,
        presentation: actor.presentation,
        connectionState: actor.connectionState,
        reasonCode: actor.reasonCode,
        evidenceRefs: actor.evidenceRefs,
      })),
    artifacts: Object.values(snapshot.artifacts)
      .sort((left, right) => left.evidence.evidenceId.localeCompare(right.evidence.evidenceId))
      .map((artifact) => ({
        evidenceId: artifact.evidence.evidenceId,
        status: artifact.status,
        errorCode: artifact.evidence.errorCode ?? null,
      })),
  });
}
