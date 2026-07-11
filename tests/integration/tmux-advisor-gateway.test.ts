import { describe, expect, it, vi } from 'vitest';

import type { AdvisorNotificationRequest } from '../../src/adapters/gateways/advisor.js';
import {
  TmuxAdvisorGateway,
  type AdvisorTransportCapability,
  type TmuxPointerDeliveryPort,
} from '../../src/adapters/gateways/tmux-advisor/index.js';
import { FIXED_TIME, MISSION_ID, uuidV7 } from '../helpers/fixtures.js';

describe('fixed Advisor-only tmux gateway', () => {
  it('sends only the canonical immutable pointer envelope and replays one receipt', async () => {
    const deliverPointer = vi.fn<TmuxPointerDeliveryPort['deliverPointer']>(() => Promise.resolve({
      status: 'DELIVERED',
      evidenceRefs: ['receipt:1'],
    }));
    const port: TmuxPointerDeliveryPort = {
      deliverPointer,
      lookupPointerReceipt: vi.fn<TmuxPointerDeliveryPort['lookupPointerReceipt']>(() =>
        Promise.resolve('NOT_FOUND'),
      ),
    };
    const gateway = new TmuxAdvisorGateway({ capability: capability(), deliveryPort: port, now: () => FIXED_TIME });
    const request = gatewayRequest();
    const first = await gateway.queueAdvisorNotification(request);
    const replay = await gateway.queueAdvisorNotification(request);
    expect(first.status).toBe('DELIVERED');
    expect(replay).toEqual(first);
    expect(deliverPointer).toHaveBeenCalledTimes(1);
    const delivered = deliverPointer.mock.calls[0]?.[0];
    expect(delivered?.pointerEnvelope).toContain(request.messageArtifactHash);
    expect(delivered?.pointerEnvelope).not.toContain('message body');
    expect(Object.keys(request).sort()).toEqual([
      'correlationId',
      'messageArtifactHash',
      'messageArtifactRef',
      'messageId',
      'messagePayloadHash',
      'missionId',
      'notificationId',
      'persistedEventId',
      'persistedMissionSequence',
      'requestId',
    ]);
    expect(JSON.stringify(delivered)).not.toMatch(/worker|reviewer|session|pane|command|argv|executable/iu);
    await expect(
      gateway.queueAdvisorNotification({ ...request, correlationId: uuidV7(710) }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });

  it.each([
    ['missing', undefined],
    ['disabled', capability({ state: 'DISABLED' })],
    ['kill switch', capability({ killSwitch: 'ENGAGED' })],
    ['conflict', capability({ state: 'CONFLICT' })],
    ['stale', capability({ issuedAt: '2026-07-08T00:00:00.000Z', expiresAt: '2026-07-09T00:00:00.000Z' })],
  ])('returns manual fallback for %s capability without delivery', async (_label, value) => {
    const deliverPointer = vi.fn<TmuxPointerDeliveryPort['deliverPointer']>(() => Promise.resolve({
      status: 'DELIVERED',
      evidenceRefs: [],
    }));
    const port: TmuxPointerDeliveryPort = {
      deliverPointer,
      lookupPointerReceipt: vi.fn<TmuxPointerDeliveryPort['lookupPointerReceipt']>(() =>
        Promise.resolve('NOT_FOUND'),
      ),
    };
    const gateway = new TmuxAdvisorGateway({
      ...(value === undefined ? {} : { capability: value }),
      deliveryPort: port,
      now: () => FIXED_TIME,
    });
    const receipt = await gateway.queueAdvisorNotification(gatewayRequest());
    expect(receipt.status).toBe('MANUAL_FALLBACK_REQUIRED');
    expect(deliverPointer).not.toHaveBeenCalled();
  });

  it.each([
    ['state', { state: 'READY' }],
    ['killSwitch', { killSwitch: 'OFF' }],
    ['synchronization', { synchronization: 'SYNCHRONIZED' }],
  ])('fails closed for invalid runtime %s vocabulary', async (_label, overrides) => {
    const { gateway, deliverPointer, lookupPointerReceipt } = gatewayHarness(
      runtimeCapability(overrides),
    );

    expect(gateway.health()).toEqual({
      adapter: 'TMUX_ADVISOR',
      status: 'MANUAL_FALLBACK_REQUIRED',
      failureCode: 'ADVISOR_LOCATOR_STALE_OR_MISMATCHED',
    });
    await expect(gateway.getDeliveryReceipt(uuidV7(711))).resolves.toBeUndefined();
    await expect(gateway.queueAdvisorNotification(gatewayRequest())).resolves.toMatchObject({
      status: 'MANUAL_FALLBACK_REQUIRED',
      failureCode: 'ADVISOR_LOCATOR_STALE_OR_MISMATCHED',
    });
    expect(deliverPointer).not.toHaveBeenCalled();
    expect(lookupPointerReceipt).not.toHaveBeenCalled();
  });

  it.each([
    [
      'future-issued',
      capability({ issuedAt: '2026-07-10T00:00:00.001Z' }),
    ],
    [
      'exact-expiry',
      capability({ expiresAt: FIXED_TIME }),
    ],
  ])('fails closed at the %s capability boundary', async (_label, value) => {
    const { gateway, deliverPointer, lookupPointerReceipt } = gatewayHarness(value);

    expect(gateway.health()).toMatchObject({
      status: 'MANUAL_FALLBACK_REQUIRED',
      failureCode: 'ADVISOR_LOCATOR_STALE_OR_MISMATCHED',
    });
    await expect(gateway.getDeliveryReceipt(uuidV7(712))).resolves.toBeUndefined();
    await expect(gateway.queueAdvisorNotification(gatewayRequest())).resolves.toMatchObject({
      status: 'MANUAL_FALLBACK_REQUIRED',
      failureCode: 'ADVISOR_LOCATOR_STALE_OR_MISMATCHED',
    });
    expect(deliverPointer).not.toHaveBeenCalled();
    expect(lookupPointerReceipt).not.toHaveBeenCalled();
  });

  it('validates the runtime clock in health, queue, and receipt lookup', async () => {
    const health = gatewayHarness(capability(), () => 'not-a-timestamp');
    expect(() => health.gateway.health()).toThrow(
      expect.objectContaining({ code: 'INVALID_SCHEMA' }),
    );

    const queue = gatewayHarness(capability(), () => 'not-a-timestamp');
    await expect(queue.gateway.queueAdvisorNotification(gatewayRequest())).rejects.toMatchObject({
      code: 'INVALID_SCHEMA',
    });

    const lookup = gatewayHarness(capability(), () => 'not-a-timestamp');
    await expect(lookup.gateway.getDeliveryReceipt(uuidV7(713))).rejects.toMatchObject({
      code: 'INVALID_SCHEMA',
    });
    expect(health.deliverPointer).not.toHaveBeenCalled();
    expect(queue.deliverPointer).not.toHaveBeenCalled();
    expect(lookup.lookupPointerReceipt).not.toHaveBeenCalled();
  });

  it('classifies an ambiguous outcome as manual and never blindly repeats it', async () => {
    const deliverPointer = vi.fn<TmuxPointerDeliveryPort['deliverPointer']>(() => Promise.resolve({
      status: 'AMBIGUOUS',
      failureCode: 'DELIVERY_RECEIPT_AMBIGUOUS',
      evidenceRefs: [],
    }));
    const port: TmuxPointerDeliveryPort = {
      deliverPointer,
      lookupPointerReceipt: vi.fn<TmuxPointerDeliveryPort['lookupPointerReceipt']>(() =>
        Promise.resolve('NOT_FOUND'),
      ),
    };
    const gateway = new TmuxAdvisorGateway({ capability: capability(), deliveryPort: port, now: () => FIXED_TIME });
    const request = gatewayRequest();
    expect((await gateway.queueAdvisorNotification(request)).status).toBe('MANUAL_FALLBACK_REQUIRED');
    expect((await gateway.queueAdvisorNotification(request)).failureCode).toBe('DELIVERY_RECEIPT_AMBIGUOUS');
    expect(deliverPointer).toHaveBeenCalledTimes(1);
  });
});

function gatewayRequest(): AdvisorNotificationRequest {
  const requestId = uuidV7(700);
  const hash = `sha256:${'a'.repeat(64)}`;
  return {
    notificationId: uuidV7(701),
    requestId,
    missionId: MISSION_ID,
    messageId: uuidV7(702),
    messageArtifactRef: `artifacts/inbox/${MISSION_ID}/${requestId}/${hash.slice('sha256:'.length)}.json`,
    messageArtifactHash: hash,
    messagePayloadHash: hash,
    persistedEventId: uuidV7(703),
    persistedMissionSequence: 1,
    correlationId: uuidV7(704),
  };
}

function capability(
  overrides: Partial<AdvisorTransportCapability> = {},
): AdvisorTransportCapability {
  return {
    schemaVersion: 'agent-office.advisor-transport-capability.v1',
    capabilityId: uuidV7(705),
    logicalRoute: 'ADVISOR_ONLY',
    transport: 'TMUX',
    state: 'ACTIVE',
    killSwitch: 'DISENGAGED',
    synchronization: 'SINGLE_PREVALIDATED_DESTINATION',
    issuedAt: '2026-07-10T00:00:00.000Z',
    expiresAt: '2026-07-12T00:00:00.000Z',
    authoritySnapshotHash: `sha256:${'1'.repeat(64)}`,
    activationSnapshotHash: `sha256:${'2'.repeat(64)}`,
    registrySnapshotHash: `sha256:${'3'.repeat(64)}`,
    ...overrides,
  };
}

function runtimeCapability(overrides: Record<string, unknown>): unknown {
  return { ...capability(), ...overrides };
}

function gatewayHarness(
  value: unknown,
  now: () => string = () => FIXED_TIME,
) {
  const deliverPointer = vi.fn<TmuxPointerDeliveryPort['deliverPointer']>(() => Promise.resolve({
    status: 'DELIVERED',
    evidenceRefs: [],
  }));
  const lookupPointerReceipt = vi.fn<TmuxPointerDeliveryPort['lookupPointerReceipt']>(() =>
    Promise.resolve('NOT_FOUND'),
  );
  const deliveryPort: TmuxPointerDeliveryPort = { deliverPointer, lookupPointerReceipt };
  return {
    gateway: new TmuxAdvisorGateway({
      capability: value as AdvisorTransportCapability,
      deliveryPort,
      now,
    }),
    deliverPointer,
    lookupPointerReceipt,
  };
}
