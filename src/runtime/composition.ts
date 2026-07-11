import { RejectingDecisionAuthorityEvidenceVerifier } from '../adapters/observations/artifacts/decision-authority.js';
import type { PrivateDeploymentConfiguration } from '../server/config.js';
import {
  startAgentOfficeCompositionCore,
  type RunningAgentOfficeComposition,
} from './composition-core.js';
import {
  createSystemRuntimeIdentity,
  type AgentOfficeRuntimeIdentity,
} from './identity.js';

export interface StartAgentOfficeCompositionOptions {
  readonly configuration: PrivateDeploymentConfiguration;
  readonly appRoot: string;
  readonly stateRoot: string;
  readonly staticRoot: string;
  readonly manifestPath: string;
  readonly manifestSourcePath: string;
  readonly buildId: string;
  readonly runtime?: AgentOfficeRuntimeIdentity;
}

export function startAgentOfficeComposition(
  options: StartAgentOfficeCompositionOptions,
): Promise<RunningAgentOfficeComposition> {
  return startAgentOfficeCompositionCore({
    ...options,
    runtime: options.runtime ?? createSystemRuntimeIdentity(),
    authorityEvidenceVerifier: new RejectingDecisionAuthorityEvidenceVerifier(),
  });
}

export type { RunningAgentOfficeComposition } from './composition-core.js';
