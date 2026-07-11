import type { DecisionAuthorityEvidenceVerifier } from '../application/advisor-inbox/types.js';
import { RejectingDecisionAuthorityEvidenceVerifier } from '../adapters/observations/artifacts/decision-authority.js';
import type { ReadonlyToolRunner } from '../adapters/observations/process-runner.js';
import {
  TmuxAdvisorGateway,
  type TmuxPointerDeliveryPort,
} from '../adapters/gateways/tmux-advisor/index.js';
import {
  AuthenticationExchange,
  BrowserSessionRegistry,
  TestAuthenticationExchange,
  TestAuthenticationProvider,
  type BrowserCapability,
  type BrowserSession,
} from '../server/auth/index.js';
import type { PrivateDeploymentConfiguration } from '../server/config.js';
import { InMemoryRateLimiter } from '../server/security/rate-limiter.js';
import {
  startAgentOfficeCompositionCore,
  type RunningAgentOfficeComposition,
} from './composition-core.js';
import type { AgentOfficeRuntimeIdentity } from './identity.js';
import type { OperationalRuntimeConfiguration } from './operational-config.js';

export interface StartSyntheticTestCompositionOptions {
  readonly configuration: PrivateDeploymentConfiguration;
  readonly appRoot: string;
  readonly stateRoot: string;
  readonly staticRoot: string;
  readonly operationalConfiguration: OperationalRuntimeConfiguration;
  readonly buildId: string;
  readonly runtime: AgentOfficeRuntimeIdentity;
  readonly syntheticProof: string;
  readonly subjectId: string;
  readonly capabilities: readonly BrowserCapability[];
  readonly nextOpaque: () => string;
  readonly sessionLifetimeMs?: number;
  readonly heartbeatMs?: number;
  readonly authorityEvidenceVerifier?: DecisionAuthorityEvidenceVerifier;
  readonly readonlyToolRunner?: ReadonlyToolRunner;
  readonly tmuxDeliveryPort?: TmuxPointerDeliveryPort;
}

export interface RunningSyntheticTestComposition {
  readonly composition: RunningAgentOfficeComposition;
  readonly provider: TestAuthenticationProvider;
  readonly sessions: BrowserSessionRegistry;
  readonly session: BrowserSession;
}

export interface StartSyntheticBootstrapTestCompositionOptions
  extends Omit<StartSyntheticTestCompositionOptions, 'syntheticProof' | 'subjectId' | 'capabilities'> {
  readonly identities: readonly {
    readonly proof: string;
    readonly subjectId: string;
    readonly capabilities: readonly BrowserCapability[];
  }[];
}

export interface RunningSyntheticBootstrapTestComposition {
  readonly composition: RunningAgentOfficeComposition;
  readonly provider: TestAuthenticationProvider;
  readonly sessions: BrowserSessionRegistry;
}

export async function startSyntheticTestComposition(
  options: StartSyntheticTestCompositionOptions,
): Promise<RunningSyntheticTestComposition> {
  const provider = new TestAuthenticationProvider({
    buildMode: 'TEST',
    testRuntime: true,
    identities: [{
      proof: options.syntheticProof,
      subjectId: options.subjectId,
      capabilities: options.capabilities,
    }],
    now: () => options.runtime.now(),
    nextOpaque: options.nextOpaque,
    ...(options.sessionLifetimeMs === undefined
      ? {}
      : { sessionLifetimeMs: options.sessionLifetimeMs }),
  });
  const sessions = new BrowserSessionRegistry(
    provider,
    options.nextOpaque,
    () => options.runtime.now(),
  );
  const exchange = new TestAuthenticationExchange(
    provider,
    sessions,
    new InMemoryRateLimiter(),
    () => Date.parse(options.runtime.now()),
  );
  const session = await exchange.exchange('127.0.0.1', options.syntheticProof);
  const composition = await startAgentOfficeCompositionCore({
    configuration: options.configuration,
    appRoot: options.appRoot,
    stateRoot: options.stateRoot,
    staticRoot: options.staticRoot,
    operationalConfiguration: options.operationalConfiguration,
    ...(options.readonlyToolRunner === undefined
      ? {}
      : { readonlyToolRunner: options.readonlyToolRunner }),
    buildId: options.buildId,
    runtime: options.runtime,
    advisorGateway: new TmuxAdvisorGateway({
      now: () => options.runtime.now(),
      ...(options.operationalConfiguration.gateway.capability === undefined
        ? {}
        : { capability: options.operationalConfiguration.gateway.capability }),
      ...(options.tmuxDeliveryPort === undefined ? {} : { deliveryPort: options.tmuxDeliveryPort }),
    }),
    authorityEvidenceVerifier:
      options.authorityEvidenceVerifier ?? new RejectingDecisionAuthorityEvidenceVerifier(),
    sessions,
    authenticationProvider: provider,
    authenticationReadiness: 'TEST_READY',
    mutationConfigured: true,
    ...(options.heartbeatMs === undefined ? {} : { heartbeatMs: options.heartbeatMs }),
  });
  return { composition, provider, sessions, session };
}

export async function startSyntheticBootstrapTestComposition(
  options: StartSyntheticBootstrapTestCompositionOptions,
): Promise<RunningSyntheticBootstrapTestComposition> {
  const provider = new TestAuthenticationProvider({
    buildMode: 'TEST',
    testRuntime: true,
    identities: options.identities,
    now: () => options.runtime.now(),
    nextOpaque: options.nextOpaque,
    ...(options.sessionLifetimeMs === undefined
      ? {}
      : { sessionLifetimeMs: options.sessionLifetimeMs }),
  });
  const sessions = new BrowserSessionRegistry(
    provider,
    options.nextOpaque,
    () => options.runtime.now(),
  );
  const exchange = new AuthenticationExchange(
    provider,
    sessions,
    new InMemoryRateLimiter(),
    () => Date.parse(options.runtime.now()),
  );
  const composition = await startAgentOfficeCompositionCore({
    configuration: options.configuration,
    appRoot: options.appRoot,
    stateRoot: options.stateRoot,
    staticRoot: options.staticRoot,
    operationalConfiguration: options.operationalConfiguration,
    ...(options.readonlyToolRunner === undefined
      ? {}
      : { readonlyToolRunner: options.readonlyToolRunner }),
    buildId: options.buildId,
    runtime: options.runtime,
    advisorGateway: new TmuxAdvisorGateway({ now: () => options.runtime.now() }),
    authorityEvidenceVerifier:
      options.authorityEvidenceVerifier ?? new RejectingDecisionAuthorityEvidenceVerifier(),
    sessions,
    authenticationProvider: provider,
    authenticationReadiness: 'LOCAL_BOOTSTRAP_READY',
    bootstrapExchange: exchange,
    mutationConfigured: true,
    ...(options.heartbeatMs === undefined ? {} : { heartbeatMs: options.heartbeatMs }),
  });
  return { composition, provider, sessions };
}
