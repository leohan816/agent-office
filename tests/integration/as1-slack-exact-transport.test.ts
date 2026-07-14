import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { parsePointerDeliveryGrant } from '../../src/application/slack-pilot/contracts.js';
import { As1ProfileInboundStore } from '../../src/application/slack-pilot/inbound-store.js';
import { selectProfile } from '../../src/application/slack-pilot/profiles.js';
import {
  assertCapabilityUsable,
  assertDeliveryChainConsistent,
  createDeliveryCapability,
  parseReadinessLease,
} from '../../src/adapters/gateways/slack-pilot/exact-authority.js';
import { As1ExactTransport, type As1DeliveryRequest } from '../../src/adapters/gateways/slack-pilot/exact-transport.js';
import {
  FakeClock,
  FakeTmuxPort,
  matchingPreflight,
  validPointerDeliveryGrant,
  validReadinessLease,
} from '../helpers/as1-slack-fakes.js';
import { makeStateRoot } from '../helpers/fixtures.js';

const NOW = '2026-07-14T22:03:05.000Z';
const POINTER_HASH = `sha256:${'4'.repeat(64)}`;

function grabDomainError(fn: () => unknown): DomainError {
  try {
    fn();
  } catch (error) {
    if (error instanceof DomainError) return error;
    throw error;
  }
  throw new Error('expected a DomainError but none was thrown');
}

async function makeTransport(deliveryId = 'delivery-0001') {
  const root = await makeStateRoot();
  const clock = new FakeClock(NOW);
  const store = await As1ProfileInboundStore.open(root, selectProfile('AGENT_OFFICE_ADVISOR'), clock);
  const grant = parsePointerDeliveryGrant(validPointerDeliveryGrant());
  const lease = parseReadinessLease(validReadinessLease());
  assertDeliveryChainConsistent(grant, lease, POINTER_HASH, NOW);
  const capability = createDeliveryCapability(grant, lease, NOW);
  const transport = new As1ExactTransport();
  const port = new FakeTmuxPort(matchingPreflight());
  const request: As1DeliveryRequest = {
    capability,
    deliveryId,
    bufferName: `as1-agent-office-advisor-${deliveryId}`,
    pointerFilePath: 'artifacts/as1-slack-pilot/agent-office-advisor/pointers/p1/pointer.json',
    now: NOW,
    port,
    journal: store,
    assertCapabilityUsable,
  };
  return { store, grant, lease, capability, transport, port, request };
}

describe('AS1 readiness lease and delivery chain', () => {
  it('parses a valid lease and binds the exact delivery facts', () => {
    const grant = parsePointerDeliveryGrant(validPointerDeliveryGrant());
    const lease = parseReadinessLease(validReadinessLease());
    expect(lease.useLimit).toBe(1);
    expect(() => {
      assertDeliveryChainConsistent(grant, lease, POINTER_HASH, NOW);
    }).not.toThrow();
  });

  it('rejects a destination flag that is not exactly false', () => {
    expect(
      grabDomainError(() => parseReadinessLease(validReadinessLease({ destination: { ...destinationWith({ inputOff: true }) } }))).code,
    ).toBe('AUTHORITY_ARTIFACT_INVALID');
  });

  it('rejects a lease lifetime longer than 30 seconds', () => {
    expect(
      grabDomainError(() =>
        parseReadinessLease(validReadinessLease({ issuedAt: '2026-07-14T22:03:00.000Z', expiresAt: '2026-07-14T22:04:00.000Z' })),
      ).code,
    ).toBe('AUTHORITY_ARTIFACT_INVALID');
  });

  it('rejects a lease whose identity contradicts its profile lineage', () => {
    expect(grabDomainError(() => parseReadinessLease(validReadinessLease({ actorId: 'foundation-advisor' }))).code).toBe(
      'UNAUTHORIZED_ACTOR',
    );
  });

  it('rejects a lease that does not bind the delivery-grant facts', () => {
    const grant = parsePointerDeliveryGrant(validPointerDeliveryGrant());
    const lease = parseReadinessLease(validReadinessLease({ intakeId: 'as1-intake-9999' }));
    expect(grabDomainError(() => {
      assertDeliveryChainConsistent(grant, lease, POINTER_HASH, NOW);
    }).code).toBe('AUTHORITY_ARTIFACT_INVALID');
  });
});

function destinationWith(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    sessionName: 'agent-office-advisor',
    sessionId: '$26',
    windowName: 'main',
    windowId: '@26',
    windowIndex: 0,
    paneId: '%26',
    paneIndex: 0,
    panePid: 12_345,
    workspace: '/home/leo/Project/agent-office',
    currentCommand: 'codex',
    paneDead: false,
    paneInMode: false,
    inputOff: false,
    synchronizePanes: false,
    activityTime: '1720000000',
    ...overrides,
  };
}

describe('AS1 exact tmux transport journal', () => {
  it('delivers one pointer through the full journal and consumes the authority once', async () => {
    const { store, transport, port, request } = await makeTransport();
    const result = await transport.deliver(request);
    expect(result.outcome).toBe('DELIVERED');
    expect(result.phase).toBe('TRANSPORT_RECORDED');
    expect(port.loadCalls).toBe(1);
    expect(port.pasteCalls).toBe(1);
    expect(port.enterCalls).toBe(1);
    expect(await store.readTmuxPhase('delivery-0001')).toBe('TRANSPORT_RECORDED');
  });

  it('refuses to reuse a consumed delivery grant/lease', async () => {
    const { store, transport, request } = await makeTransport();
    await transport.deliver(request);
    // A second attempt with the same grant/lease under a new deliveryId is refused before any paste.
    const second = new As1ExactTransport();
    const secondPort = new FakeTmuxPort(matchingPreflight());
    const result = await second.deliver({
      ...request,
      deliveryId: 'delivery-0002',
      bufferName: 'as1-agent-office-advisor-delivery-0002',
      port: secondPort,
      journal: store,
    });
    expect(result.outcome).toBe('STOPPED_BEFORE_PASTE');
    expect(result.reason).toContain('already consumed');
    expect(secondPort.pasteCalls).toBe(0);
  });

  it('stops before paste and does not consume when the first preflight mismatches', async () => {
    const { transport, port, request, store } = await makeTransport();
    port.setPreflightSequence([matchingPreflight({ panePid: 99_999 })]);
    const result = await transport.deliver(request);
    expect(result.outcome).toBe('STOPPED_BEFORE_PASTE');
    expect(port.loadCalls).toBe(0);
    expect(port.pasteCalls).toBe(0);
    // Authority was not consumed: it can still be consumed exactly once afterwards.
    expect(await store.consumeDeliveryAuthority('as1-pdg-0001', 'as1-lease-0001')).toBe(true);
  });

  it('stops before paste and cleans the buffer when the second preflight changes', async () => {
    const { transport, port, request } = await makeTransport();
    port.setPreflightSequence([matchingPreflight(), matchingPreflight({ currentCommand: 'bash' })]);
    const result = await transport.deliver(request);
    expect(result.outcome).toBe('STOPPED_BEFORE_PASTE');
    expect(port.loadCalls).toBe(1);
    expect(port.deleteCalls).toBe(1);
    expect(port.pasteCalls).toBe(0);
  });

  it('records MANUAL_RECONCILIATION_REQUIRED and never re-sends after an ambiguous paste', async () => {
    const { store, transport, port, request } = await makeTransport();
    port.setPasteThrows();
    const result = await transport.deliver(request);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(port.pasteCalls).toBe(1);
    expect(port.enterCalls).toBe(0);
    expect(await store.readTmuxPhase('delivery-0001')).toBe('MANUAL_RECONCILIATION_REQUIRED');
  });

  it('never resumes a delivery whose journal is already at the no-retry boundary', async () => {
    const { store, transport, port, request } = await makeTransport();
    await store.recordTmuxPhase('delivery-0001', 'PASTE_STARTED');
    const result = await transport.deliver(request);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(port.pasteCalls).toBe(0);
  });

  it('honors an expired capability by stopping before pane input', async () => {
    const { capability } = await makeTransport();
    expect(grabDomainError(() => {
      assertCapabilityUsable(capability, '2026-07-14T22:05:00.000Z');
    }).code).toBe('AUTHORITY_ARTIFACT_INVALID');
  });
});
