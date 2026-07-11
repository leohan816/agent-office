import { RejectingDecisionAuthorityEvidenceVerifier } from '../adapters/observations/artifacts/decision-authority.js';
import type { ReadonlyToolRunner } from '../adapters/observations/process-runner.js';
import {
  TmuxAdvisorGateway,
  type TmuxPointerDeliveryPort,
} from '../adapters/gateways/tmux-advisor/index.js';
import type { PrivateDeploymentConfiguration } from '../server/config.js';
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

export function startAgentOfficeComposition(
  options: StartAgentOfficeCompositionOptions,
): Promise<RunningAgentOfficeComposition> {
  const runtime = options.runtime ?? createSystemRuntimeIdentity();
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

export type { RunningAgentOfficeComposition } from './composition-core.js';
