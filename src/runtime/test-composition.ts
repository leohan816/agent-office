import type { DecisionAuthorityEvidenceVerifier } from '../application/advisor-inbox/types.js';
import { RejectingDecisionAuthorityEvidenceVerifier } from '../adapters/observations/artifacts/decision-authority.js';
import {
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

export interface StartSyntheticTestCompositionOptions {
  readonly configuration: PrivateDeploymentConfiguration;
  readonly appRoot: string;
  readonly stateRoot: string;
  readonly staticRoot: string;
  readonly manifestPath: string;
  readonly manifestSourcePath: string;
  readonly buildId: string;
  readonly runtime: AgentOfficeRuntimeIdentity;
  readonly syntheticProof: string;
  readonly subjectId: string;
  readonly capabilities: readonly BrowserCapability[];
  readonly nextOpaque: () => string;
  readonly sessionLifetimeMs?: number;
  readonly heartbeatMs?: number;
  readonly authorityEvidenceVerifier?: DecisionAuthorityEvidenceVerifier;
}

export interface RunningSyntheticTestComposition {
  readonly composition: RunningAgentOfficeComposition;
  readonly provider: TestAuthenticationProvider;
  readonly sessions: BrowserSessionRegistry;
  readonly session: BrowserSession;
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
    manifestPath: options.manifestPath,
    manifestSourcePath: options.manifestSourcePath,
    buildId: options.buildId,
    runtime: options.runtime,
    authorityEvidenceVerifier:
      options.authorityEvidenceVerifier ?? new RejectingDecisionAuthorityEvidenceVerifier(),
    sessions,
    testMutationEnabled: true,
    ...(options.heartbeatMs === undefined ? {} : { heartbeatMs: options.heartbeatMs }),
  });
  return { composition, provider, sessions, session };
}
