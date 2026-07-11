import { randomBytes } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import path from 'node:path';

import { RejectingDecisionAuthorityEvidenceVerifier } from '../adapters/observations/artifacts/decision-authority.js';
import { ExactGitDecisionAuthorityEvidenceVerifier } from '../adapters/observations/artifacts/decision-authority.js';
import { AdvisorEvidenceIngress } from '../application/advisor-inbox/evidence-ingress.js';
import type { ReadonlyToolRunner } from '../adapters/observations/process-runner.js';
import {
  TmuxAdvisorGateway,
  type TmuxPointerDeliveryPort,
} from '../adapters/gateways/tmux-advisor/index.js';
import {
  ExactAdvisorAuthorityValidator,
  NodeExactGitAuthorityReader,
} from '../adapters/gateways/tmux-advisor/exact-authority.js';
import {
  DurableExactAdvisorDeliveryPort,
  NodeExactTmuxMutationRunner,
} from '../adapters/gateways/tmux-advisor/exact-transport.js';
import type { PrivateDeploymentConfiguration } from '../server/config.js';
import {
  AuthenticationExchange,
  BrowserSessionRegistry,
  LocalBootstrapAuthenticationProvider,
} from '../server/auth/index.js';
import { DomainError } from '../contracts/types.js';
import { DurableDeliveryControl } from '../operations/readiness/delivery-control.js';
import { InMemoryRateLimiter } from '../server/security/rate-limiter.js';
import {
  startAgentOfficeCompositionCore,
  type RunningAgentOfficeComposition,
} from './composition-core.js';
import {
  createSystemRuntimeIdentity,
  type AgentOfficeRuntimeIdentity,
} from './identity.js';
import {
  exactGatewayActivation,
  legacyGatewayCapability,
  type OperationalRuntimeConfiguration,
} from './operational-config.js';

export interface StartAgentOfficeCompositionOptions {
  readonly configuration: PrivateDeploymentConfiguration;
  readonly appRoot: string;
  readonly stateRoot: string;
  readonly staticRoot: string;
  readonly operationalConfiguration: OperationalRuntimeConfiguration;
  readonly buildId: string;
  readonly runtime?: AgentOfficeRuntimeIdentity;
  readonly readonlyToolRunner?: ReadonlyToolRunner;
  readonly tmuxDeliveryPort?: TmuxPointerDeliveryPort;
}

export const AGENT_OFFICE_M01_CANONICAL_MANIFEST_PATH =
  'advisor/jobs/20260711_agent_office_m01_advisor_managed_office_web_control_plane/10_MISSION_MANIFEST.json';

export async function startAgentOfficeComposition(
  options: StartAgentOfficeCompositionOptions,
): Promise<RunningAgentOfficeComposition> {
  const runtime = options.runtime ?? createSystemRuntimeIdentity();
  if (options.tmuxDeliveryPort !== undefined || legacyGatewayCapability(options.operationalConfiguration) !== undefined) {
    throw new DomainError(
      'INVALID_SCHEMA',
      'production composition rejects caller-supplied delivery capabilities and ports',
    );
  }
  const exactActivation = exactGatewayActivation(options.operationalConfiguration);
  const exactSelected = options.configuration.schemaVersion === 'agent-office.loopback-deployment.v3';
  if (exactSelected !== (exactActivation !== undefined)) {
    throw new DomainError('INVALID_SCHEMA', 'exact delivery requires matching deployment and operational keys');
  }
  if (options.configuration.authProvider === 'LOCAL_BOOTSTRAP') {
    await assertLocalBootstrapManifestAuthority(
      options.operationalConfiguration,
      options.appRoot,
    );
    const exactRuntime = exactActivation === undefined
      ? undefined
      : await createProductionExactDelivery(options, exactActivation, runtime);
    const provider = new LocalBootstrapAuthenticationProvider({
      proofDeliveryPath: options.configuration.bootstrapProofFile,
      origin: 'http://127.0.0.1:4317',
      now: () => runtime.now(),
    });
    const sessions = new BrowserSessionRegistry(provider, cryptographicOpaque, () => runtime.now());
    const exchange = new AuthenticationExchange(
      provider,
      sessions,
      new InMemoryRateLimiter(),
      () => Date.parse(runtime.now()),
    );
    try {
      return await startAgentOfficeCompositionCore({
        ...options,
        runtime,
        advisorGateway: new TmuxAdvisorGateway({
          now: () => runtime.now(),
          ...(exactRuntime === undefined ? {} : { exactDelivery: exactRuntime.port }),
        }),
        ...(exactRuntime === undefined ? {} : { deliveryControl: exactRuntime.deliveryControl }),
        ...(exactRuntime === undefined
          ? {}
          : { deliveryActivationStartup: exactRuntime.activate }),
        authorityEvidenceVerifier: exactRuntime?.authorityEvidenceVerifier ??
          new RejectingDecisionAuthorityEvidenceVerifier(),
        ...(exactRuntime === undefined
          ? {}
          : {
              advisorEvidenceIngressFactory: ({ inbox, store }) => AdvisorEvidenceIngress.open({
                activation: exactRuntime.activation,
                source: exactRuntime.git,
                inbox,
                store,
                runtime,
                stateRoot: options.stateRoot,
              }),
            }),
        sessions,
        authenticationProvider: provider,
        authenticationReadiness: 'LOCAL_BOOTSTRAP_READY',
        bootstrapExchange: exchange,
        mutationConfigured: true,
        authenticationStartup: async () => {
          await provider.beginLocalBootstrap();
        },
        authenticationCleanup: () => provider.close(),
      });
    } catch (error) {
      await provider.close().catch(() => undefined);
      throw error;
    }
  }
  return startAgentOfficeCompositionCore({
    ...options,
    runtime,
    advisorGateway: new TmuxAdvisorGateway({ now: () => runtime.now() }),
    authorityEvidenceVerifier: new RejectingDecisionAuthorityEvidenceVerifier(),
  });
}

async function createProductionExactDelivery(
  options: StartAgentOfficeCompositionOptions,
  activation: NonNullable<ReturnType<typeof exactGatewayActivation>>,
  runtime: AgentOfficeRuntimeIdentity,
): Promise<{
  readonly port: DurableExactAdvisorDeliveryPort;
  readonly deliveryControl: DurableDeliveryControl;
  readonly activation: NonNullable<ReturnType<typeof exactGatewayActivation>>;
  readonly git: NodeExactGitAuthorityReader;
  readonly authorityEvidenceVerifier: ExactGitDecisionAuthorityEvidenceVerifier;
  readonly activate: () => Promise<void>;
}> {
  if (
    options.configuration.schemaVersion !== 'agent-office.loopback-deployment.v3' ||
    options.configuration.deliveryActivationId !== activation.activationId
  ) {
    throw new DomainError('INVALID_SCHEMA', 'exact delivery activation IDs do not match');
  }
  const authorityProject = options.operationalConfiguration.projects.find(
    (project) => project.projectId === activation.authorityProjectId,
  );
  const authorityRoot = authorityProject?.roots.find((root) => root.rootId === activation.authorityRootId);
  const authorityGit = options.operationalConfiguration.gitSources.find(
    (source) => source.sourceId === activation.authorityGitSourceId,
  );
  const appRoot = await realpath(options.appRoot).catch(() => undefined);
  const expectedFoundationRoot = appRoot === undefined
    ? undefined
    : await realpath(path.resolve(appRoot, '../foundation-docs')).catch(() => undefined);
  const actualFoundationRoot = authorityRoot === undefined
    ? undefined
    : await realpath(authorityRoot.absolutePath).catch(() => undefined);
  if (
    authorityProject === undefined || authorityRoot === undefined ||
    !authorityRoot.capabilities.includes('GIT') || !authorityRoot.capabilities.includes('ARTIFACT') ||
    authorityGit?.projectId !== 'foundation-docs' || authorityGit.rootId !== authorityRoot.rootId ||
    expectedFoundationRoot === undefined || actualFoundationRoot !== expectedFoundationRoot
  ) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'exact delivery authority root registration is invalid');
  }
  const git = new NodeExactGitAuthorityReader(
    actualFoundationRoot,
    activation.toolLimits,
    () => runtime.now(),
  );
  const authority = await ExactAdvisorAuthorityValidator.open({
    activation,
    git,
    runtime,
    stateRoot: options.stateRoot,
  });
  await authority.validateStaticAuthority();
  const deliveryControl = await DurableDeliveryControl.open(options.stateRoot);
  const runner = new NodeExactTmuxMutationRunner(
    activation.toolLimits,
    () => runtime.now(),
  );
  const port = await DurableExactAdvisorDeliveryPort.open({
    stateRoot: options.stateRoot,
    activation,
    authority,
    runner,
    deliveryControl,
    runtime,
  });
  return {
    port,
    deliveryControl,
    activation,
    git,
    authorityEvidenceVerifier: new ExactGitDecisionAuthorityEvidenceVerifier(
      git,
      activation.snapshotRefs.optionADecision,
      activation.snapshotRefs.parentMissionManifest,
      () => runtime.now(),
    ),
    activate: async () => {
      const staticAuthority = await authority.validateStaticAuthority();
      await deliveryControl.armValidatedGrant({
        activationId: activation.activationId,
        grantHash: staticAuthority.activationGrantHash,
        activatedAt: runtime.now(),
      });
    },
  };
}

async function assertLocalBootstrapManifestAuthority(
  configuration: OperationalRuntimeConfiguration,
  appRoot: string,
): Promise<void> {
  const sources = configuration.manifestSources.filter(
    (source) => source.sourceId === configuration.missionSourceId,
  );
  const source = sources[0];
  const project = configuration.projects.filter(
    (candidate) => candidate.projectId === 'foundation-docs',
  );
  const registeredRoot = project[0]?.roots.find((root) => root.rootId === source?.rootId);
  const gitSource = configuration.gitSources.find(
    (candidate) => candidate.sourceId === source?.gitSourceId,
  );
  const canonicalAppRoot = await realpath(appRoot).catch(() => undefined);
  const expectedFoundationRoot = canonicalAppRoot === undefined
    ? undefined
    : await realpath(path.resolve(canonicalAppRoot, '../foundation-docs')).catch(() => undefined);
  const canonicalRegisteredRoot = registeredRoot === undefined
    ? undefined
    : await realpath(registeredRoot.absolutePath).catch(() => undefined);
  if (
    sources.length !== 1 ||
    source?.projectId !== 'foundation-docs' ||
    source.gitSourceId === undefined ||
    source.relativePath !== AGENT_OFFICE_M01_CANONICAL_MANIFEST_PATH ||
    source.sourceMetadata.repository !== 'foundation-docs' ||
    source.sourceMetadata.path !== AGENT_OFFICE_M01_CANONICAL_MANIFEST_PATH ||
    project.length !== 1 ||
    registeredRoot === undefined ||
    !registeredRoot.capabilities.includes('GIT') ||
    !registeredRoot.capabilities.includes('MANIFEST') ||
    expectedFoundationRoot === undefined ||
    canonicalRegisteredRoot !== expectedFoundationRoot ||
    gitSource?.projectId !== 'foundation-docs' ||
    gitSource.rootId !== source.rootId
  ) {
    throw new DomainError(
      'AUTHORITY_ARTIFACT_INVALID',
      'LocalBootstrap requires the exact canonical Agent Office M01 manifest authority',
    );
  }
}

function cryptographicOpaque(): string {
  return randomBytes(32).toString('base64url');
}

export type { RunningAgentOfficeComposition } from './composition-core.js';
