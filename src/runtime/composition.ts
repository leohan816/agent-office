import { randomBytes } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import path from 'node:path';

import { RejectingDecisionAuthorityEvidenceVerifier } from '../adapters/observations/artifacts/decision-authority.js';
import type { ReadonlyToolRunner } from '../adapters/observations/process-runner.js';
import {
  TmuxAdvisorGateway,
  type TmuxPointerDeliveryPort,
} from '../adapters/gateways/tmux-advisor/index.js';
import type { PrivateDeploymentConfiguration } from '../server/config.js';
import {
  AuthenticationExchange,
  BrowserSessionRegistry,
  LocalBootstrapAuthenticationProvider,
} from '../server/auth/index.js';
import { DomainError } from '../contracts/types.js';
import { InMemoryRateLimiter } from '../server/security/rate-limiter.js';
import {
  startAgentOfficeCompositionCore,
  type RunningAgentOfficeComposition,
} from './composition-core.js';
import {
  createSystemRuntimeIdentity,
  type AgentOfficeRuntimeIdentity,
} from './identity.js';
import type { OperationalRuntimeConfiguration } from './operational-config.js';

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
  if (options.configuration.authProvider === 'LOCAL_BOOTSTRAP') {
    await assertLocalBootstrapManifestAuthority(
      options.operationalConfiguration,
      options.appRoot,
    );
    if (
      options.operationalConfiguration.gateway.capability !== undefined ||
      options.tmuxDeliveryPort !== undefined
    ) {
      throw new DomainError(
        'INVALID_SCHEMA',
        'LocalBootstrap private-run mode requires manual Advisor delivery fallback',
      );
    }
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
        advisorGateway: new TmuxAdvisorGateway({ now: () => runtime.now() }),
        authorityEvidenceVerifier: new RejectingDecisionAuthorityEvidenceVerifier(),
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
    advisorGateway: new TmuxAdvisorGateway({
      now: () => runtime.now(),
      ...(options.operationalConfiguration.gateway.capability === undefined
        ? {}
        : { capability: options.operationalConfiguration.gateway.capability }),
      ...(options.tmuxDeliveryPort === undefined ? {} : { deliveryPort: options.tmuxDeliveryPort }),
    }),
    authorityEvidenceVerifier: new RejectingDecisionAuthorityEvidenceVerifier(),
  });
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
