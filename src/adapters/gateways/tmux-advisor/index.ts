import { DomainError } from '../../../contracts/types.js';
import { isRecord } from '../../../contracts/validation.js';
import { hashCanonical, isSha256 } from '../../../persistence/file-store/hashing.js';
import { assertUtcTimestamp, assertUuidV7 } from '../../../domain/time/index.js';
import {
  assertAdvisorNotificationRequest,
  buildAdvisorGatewayReceipt,
  canonicalAdvisorPointerEnvelope,
  type AdvisorGateway,
  type AdvisorGatewayHealth,
  type AdvisorGatewayReceipt,
  type AdvisorNotificationRequest,
  type GatewayFailureCode,
} from '../advisor.js';

export interface AdvisorTransportCapability {
  readonly schemaVersion: 'agent-office.advisor-transport-capability.v1';
  readonly capabilityId: string;
  readonly logicalRoute: 'ADVISOR_ONLY';
  readonly transport: 'TMUX';
  readonly state: 'ACTIVE' | 'DISABLED' | 'CONFLICT';
  readonly killSwitch: 'DISENGAGED' | 'ENGAGED';
  readonly synchronization: 'SINGLE_PREVALIDATED_DESTINATION' | 'CONFLICT';
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly authoritySnapshotHash: string;
  readonly activationSnapshotHash: string;
  readonly registrySnapshotHash: string;
}

export type PointerDeliveryOutcome =
  | {
      readonly status: 'DELIVERED' | 'ALREADY_DELIVERED';
      readonly evidenceRefs: readonly string[];
    }
  | {
      readonly status: 'RETRYABLE_FAILURE' | 'AMBIGUOUS';
      readonly failureCode: 'TOOL_TIMEOUT_OR_OUTPUT_LIMIT' | 'DELIVERY_RECEIPT_AMBIGUOUS';
      readonly evidenceRefs: readonly string[];
    };

export interface TmuxPointerDeliveryPort {
  deliverPointer(input: {
    readonly capabilityId: string;
    readonly notificationId: string;
    readonly pointerEnvelope: string;
  }): Promise<PointerDeliveryOutcome>;
  lookupPointerReceipt(input: {
    readonly capabilityId: string;
    readonly notificationId: string;
  }): Promise<PointerDeliveryOutcome | 'NOT_FOUND'>;
}

export interface TmuxAdvisorGatewayOptions {
  readonly capability?: AdvisorTransportCapability;
  readonly deliveryPort?: TmuxPointerDeliveryPort;
  readonly now: () => string;
}

interface CachedDelivery {
  readonly requestHash: string;
  readonly receipt: AdvisorGatewayReceipt;
}

export class TmuxAdvisorGateway implements AdvisorGateway {
  private readonly deliveries = new Map<string, CachedDelivery>();

  public constructor(private readonly options: TmuxAdvisorGatewayOptions) {}

  public health(): AdvisorGatewayHealth {
    const failureCode = capabilityFailure(this.options.capability, this.options.now());
    return failureCode === 'NONE'
      ? { adapter: 'TMUX_ADVISOR', status: 'READY', failureCode }
      : { adapter: 'TMUX_ADVISOR', status: 'MANUAL_FALLBACK_REQUIRED', failureCode };
  }

  public async queueAdvisorNotification(
    request: AdvisorNotificationRequest,
  ): Promise<AdvisorGatewayReceipt> {
    assertAdvisorNotificationRequest(request);
    const requestHash = hashCanonical(request);
    const prior = this.deliveries.get(request.notificationId);
    if (prior !== undefined) {
      if (prior.requestHash !== requestHash) {
        throw new DomainError(
          'IDEMPOTENCY_KEY_REUSED',
          'notificationId was already used with different gateway input',
        );
      }
      return prior.receipt;
    }
    const now = this.options.now();
    const failureCode = capabilityFailure(this.options.capability, now);
    if (failureCode !== 'NONE' || this.options.deliveryPort === undefined) {
      const receipt = manualReceipt(
        request.notificationId,
        now,
        failureCode === 'NONE' ? 'TRANSPORT_INACTIVE' : failureCode,
      );
      this.deliveries.set(request.notificationId, { requestHash, receipt });
      return receipt;
    }
    const capability = this.options.capability;
    if (capability === undefined) throw new Error('validated transport capability is missing');
    const outcome = await this.options.deliveryPort.deliverPointer({
      capabilityId: capability.capabilityId,
      notificationId: request.notificationId,
      pointerEnvelope: canonicalAdvisorPointerEnvelope(request),
    });
    const receipt = outcomeReceipt(request.notificationId, now, outcome);
    this.deliveries.set(request.notificationId, { requestHash, receipt });
    return receipt;
  }

  public async getDeliveryReceipt(notificationId: string): Promise<AdvisorGatewayReceipt | undefined> {
    assertUuidV7(notificationId, 'notificationId');
    const cached = this.deliveries.get(notificationId);
    if (cached !== undefined) return cached.receipt;
    const now = this.options.now();
    const failureCode = capabilityFailure(this.options.capability, now);
    if (failureCode !== 'NONE' || this.options.deliveryPort === undefined) return undefined;
    const capability = this.options.capability;
    if (capability === undefined) return undefined;
    const outcome = await this.options.deliveryPort.lookupPointerReceipt({
      capabilityId: capability.capabilityId,
      notificationId,
    });
    return outcome === 'NOT_FOUND' ? undefined : outcomeReceipt(notificationId, now, outcome);
  }
}

function capabilityFailure(
  capability: unknown,
  now: string,
): GatewayFailureCode {
  assertUtcTimestamp(now, 'gateway now');
  if (capability === undefined) return 'TRANSPORT_INACTIVE';
  if (!isValidCapability(capability)) return 'ADVISOR_LOCATOR_STALE_OR_MISMATCHED';
  if (capability.state === 'DISABLED') return 'TRANSPORT_INACTIVE';
  if (capability.killSwitch === 'ENGAGED') return 'KILL_SWITCH_ENGAGED';
  if (capability.state === 'CONFLICT' || capability.synchronization === 'CONFLICT') {
    return 'ADVISOR_LOCATOR_STALE_OR_MISMATCHED';
  }
  if (
    Date.parse(now) < Date.parse(capability.issuedAt) ||
    Date.parse(now) >= Date.parse(capability.expiresAt)
  ) {
    return 'ADVISOR_LOCATOR_STALE_OR_MISMATCHED';
  }
  return 'NONE';
}

function isValidCapability(value: unknown): value is AdvisorTransportCapability {
  try {
    assertCapability(value);
    return true;
  } catch (error) {
    if (error instanceof DomainError) return false;
    throw error;
  }
}

function assertCapability(value: unknown): asserts value is AdvisorTransportCapability {
  if (!isRecord(value)) {
    throw new DomainError('GATEWAY_DISABLED', 'Advisor transport capability is invalid');
  }
  const capability = value;
  if (
    typeof capability.capabilityId !== 'string' ||
    typeof capability.issuedAt !== 'string' ||
    typeof capability.expiresAt !== 'string'
  ) {
    throw new DomainError('GATEWAY_DISABLED', 'Advisor transport capability identity is invalid');
  }
  assertUuidV7(capability.capabilityId, 'capabilityId');
  assertUtcTimestamp(capability.issuedAt, 'capability issuedAt');
  assertUtcTimestamp(capability.expiresAt, 'capability expiresAt');
  if (
    capability.schemaVersion !== 'agent-office.advisor-transport-capability.v1' ||
    capability.logicalRoute !== 'ADVISOR_ONLY' ||
    capability.transport !== 'TMUX' ||
    (capability.state !== 'ACTIVE' &&
      capability.state !== 'DISABLED' &&
      capability.state !== 'CONFLICT') ||
    (capability.killSwitch !== 'DISENGAGED' && capability.killSwitch !== 'ENGAGED') ||
    (capability.synchronization !== 'SINGLE_PREVALIDATED_DESTINATION' &&
      capability.synchronization !== 'CONFLICT') ||
    typeof capability.authoritySnapshotHash !== 'string' ||
    typeof capability.activationSnapshotHash !== 'string' ||
    typeof capability.registrySnapshotHash !== 'string' ||
    !isSha256(capability.authoritySnapshotHash) ||
    !isSha256(capability.activationSnapshotHash) ||
    !isSha256(capability.registrySnapshotHash) ||
    Date.parse(capability.expiresAt) < Date.parse(capability.issuedAt)
  ) {
    throw new DomainError('GATEWAY_DISABLED', 'Advisor transport capability is invalid');
  }
}

function outcomeReceipt(
  notificationId: string,
  now: string,
  outcome: PointerDeliveryOutcome,
): AdvisorGatewayReceipt {
  if (outcome.status === 'AMBIGUOUS') {
    return buildAdvisorGatewayReceipt({
      notificationId,
      adapter: 'TMUX_ADVISOR',
      adapterVersion: 'tmux-advisor-pointer.v1',
      status: 'MANUAL_FALLBACK_REQUIRED',
      attempt: 1,
      queuedAt: now,
      attemptedAt: now,
      transportEvidenceRefs: outcome.evidenceRefs,
      failureCode: 'DELIVERY_RECEIPT_AMBIGUOUS',
    });
  }
  return buildAdvisorGatewayReceipt({
    notificationId,
    adapter: 'TMUX_ADVISOR',
    adapterVersion: 'tmux-advisor-pointer.v1',
    status: outcome.status,
    attempt: 1,
    queuedAt: now,
    attemptedAt: now,
    transportEvidenceRefs: outcome.evidenceRefs,
    failureCode: outcome.status === 'RETRYABLE_FAILURE' ? outcome.failureCode : 'NONE',
  });
}

function manualReceipt(
  notificationId: string,
  now: string,
  failureCode: GatewayFailureCode,
): AdvisorGatewayReceipt {
  return buildAdvisorGatewayReceipt({
    notificationId,
    adapter: 'TMUX_ADVISOR',
    adapterVersion: 'tmux-advisor-pointer.v1',
    status: 'MANUAL_FALLBACK_REQUIRED',
    attempt: 1,
    queuedAt: now,
    attemptedAt: now,
    transportEvidenceRefs: [],
    failureCode,
  });
}
