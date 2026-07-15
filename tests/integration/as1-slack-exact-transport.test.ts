import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { hashCanonical } from '../../src/persistence/file-store/hashing.js';
import { parsePointerDeliveryGrant } from '../../src/application/slack-pilot/contracts.js';
import { As1ProfileInboundStore } from '../../src/application/slack-pilot/inbound-store.js';
import { selectProfile } from '../../src/application/slack-pilot/profiles.js';
import {
  assertCapabilityUsable,
  assertDeliveryChainConsistent,
  createDeliveryCapability,
  parseReadinessLease,
} from '../../src/adapters/gateways/slack-pilot/exact-authority.js';
import {
  As1ExactTransport,
  deliveryJournalFacts,
  type As1DeliveryJournal,
  type As1DeliveryProvenanceGate,
} from '../../src/adapters/gateways/slack-pilot/exact-transport.js';
import {
  FakeClock,
  FakeTmuxPort,
  matchingPreflight,
  validPointerDeliveryGrant,
  validReadinessLease,
} from '../helpers/as1-slack-fakes.js';
import { makeStateRoot } from '../helpers/fixtures.js';

const NOW = '2026-07-14T22:03:05.000Z';
const LATE = '2026-07-14T22:30:00.000Z';
const POINTER_HASH = `sha256:${'4'.repeat(64)}`;
// The delivery id is DERIVED from the grant's own pointerArtifactRef (.../pointers/p1/pointer.json).
const DELIVERY_ID = 'p1';

/** A provenance gate that accepts — the reviewed content/provenance seal (B06) is proven separately. */
const ACCEPTING_GATE: As1DeliveryProvenanceGate = { assertAccepted: () => Promise.resolve() };

function grabDomainError(fn: () => unknown): DomainError {
  try {
    fn();
  } catch (error) {
    if (error instanceof DomainError) return error;
    throw error;
  }
  throw new Error('expected a DomainError but none was thrown');
}

async function makeTransport() {
  const root = await makeStateRoot();
  const clock = new FakeClock(NOW);
  const store = await As1ProfileInboundStore.open(root, selectProfile('AGENT_OFFICE_ADVISOR'), clock);
  const grant = parsePointerDeliveryGrant(validPointerDeliveryGrant());
  // The lease's pointer-grant snapshot must equal the canonical grant bytes (review B04).
  const lease = parseReadinessLease(validReadinessLease({ pointerDeliveryGrantSnapshotHash: hashCanonical(grant) }));
  assertDeliveryChainConsistent(grant, lease, POINTER_HASH, NOW);
  const capability = createDeliveryCapability(grant, lease, NOW);
  const port = new FakeTmuxPort(matchingPreflight());
  const latched: string[] = [];
  const latch = (reason: string): Promise<void> => {
    latched.push(reason);
    return Promise.resolve();
  };
  const transport = new As1ExactTransport(() => NOW, port, store, ACCEPTING_GATE, latch);
  return { root, store, grant, lease, capability, transport, port, latched };
}

const NOOP_LATCH = (): Promise<void> => Promise.resolve();

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

  it('rejects a lease whose pilot or authority/registry snapshot disagrees with the grant (B04)', () => {
    const grant = parsePointerDeliveryGrant(validPointerDeliveryGrant());
    // (advisorTeam/actorId/roleInstanceId lineage is already pinned to the profile at parse time.)
    for (const override of [
      { pilotId: 'as1-pilot-9999' },
      { registrySnapshotHash: `sha256:${'9'.repeat(64)}` },
      { authoritySnapshotHash: `sha256:${'9'.repeat(64)}` },
    ]) {
      const lease = parseReadinessLease(validReadinessLease(override));
      expect(grabDomainError(() => assertDeliveryChainConsistent(grant, lease, POINTER_HASH, NOW)).code).toBe(
        'AUTHORITY_ARTIFACT_INVALID',
      );
    }
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
    const { store, transport, port, grant, lease } = await makeTransport();
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('DELIVERED');
    expect(result.phase).toBe('TRANSPORT_RECORDED');
    expect(port.loadCalls).toBe(1);
    expect(port.pasteCalls).toBe(1);
    expect(port.enterCalls).toBe(1);
    expect(await store.readTmuxPhase(DELIVERY_ID)).toBe('TRANSPORT_RECORDED');
  });

  it('latches and reconciles when the delivery journal raises a durable STORE_QUARANTINED (B08)', async () => {
    const { port, grant, lease } = await makeTransport();
    const latched: string[] = [];
    const quarantiningJournal: As1DeliveryJournal = {
      recordTmuxPhase: () => Promise.reject(new DomainError('STORE_QUARANTINED', 'corrupt delivery journal')),
      readTmuxPhase: () => Promise.resolve(null),
      consumeDeliveryAuthority: () => Promise.resolve(true),
    };
    const transport = new As1ExactTransport(() => NOW, port, quarantiningJournal, ACCEPTING_GATE, (reason) => {
      latched.push(reason);
      return Promise.resolve();
    });
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(result.reason).toBe('STORE_QUARANTINED');
    expect(latched.length).toBeGreaterThan(0);
    expect(port.pasteCalls).toBe(0); // never pasted
  });

  it('never delivers when the provenance gate rejects; no journal or side effect (B04/B06 seal)', async () => {
    const { store, port, grant, lease } = await makeTransport();
    const rejecting: As1DeliveryProvenanceGate = {
      assertAccepted: () => Promise.reject(new DomainError('AUTHORITY_ARTIFACT_INVALID', 'provenance not accepted')),
    };
    const transport = new As1ExactTransport(() => NOW, port, store, rejecting, NOOP_LATCH);
    await expect(transport.deliver(grant, lease)).rejects.toBeInstanceOf(DomainError);
    expect(port.pasteCalls).toBe(0);
    expect(await store.readTmuxPhase(DELIVERY_ID)).toBeNull();
  });

  it('durably records PREPARED before consuming authority so no consumption is unjournaled (B04)', async () => {
    const { store, port, grant, lease } = await makeTransport();
    let phaseAtConsume: string | null = 'UNSET';
    const orderingJournal: As1DeliveryJournal = {
      recordTmuxPhase: (id, phase, facts) => store.recordTmuxPhase(id, phase, facts),
      readTmuxPhase: (id) => store.readTmuxPhase(id),
      consumeDeliveryAuthority: async (g, l) => {
        phaseAtConsume = await store.readTmuxPhase(DELIVERY_ID);
        return store.consumeDeliveryAuthority(g, l);
      },
    };
    const transport = new As1ExactTransport(() => NOW, port, orderingJournal, ACCEPTING_GATE, NOOP_LATCH);
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('DELIVERED');
    expect(phaseAtConsume).toBe('PREPARED');
  });

  it('quarantines a tmux journal whose bound facts change across the chain, even at the same phase (B04)', async () => {
    const { store, capability } = await makeTransport();
    const facts = deliveryJournalFacts(capability);
    await store.recordTmuxPhase(DELIVERY_ID, 'PREPARED', facts);
    const tampered = { ...facts, pointerHash: `sha256:${'9'.repeat(64)}` };
    // A different-phase mutation is corruption.
    await expect(store.recordTmuxPhase(DELIVERY_ID, 'BUFFER_LOADED', tampered)).rejects.toBeInstanceOf(DomainError);
    // And so is a SAME-phase mutation with different facts — checked before any idempotent no-op.
    await expect(store.recordTmuxPhase(DELIVERY_ID, 'PREPARED', tampered)).rejects.toBeInstanceOf(DomainError);
  });

  it('rejects a lease whose pointer-grant snapshot does not equal the canonical grant bytes (B04)', async () => {
    const { store, port } = await makeTransport();
    const transport = new As1ExactTransport(() => NOW, port, store, ACCEPTING_GATE, NOOP_LATCH);
    const grant = parsePointerDeliveryGrant(validPointerDeliveryGrant());
    // A structurally valid snapshot hash that is not the canonical grant hash must be refused.
    const lease = parseReadinessLease(validReadinessLease({ pointerDeliveryGrantSnapshotHash: `sha256:${'a'.repeat(64)}` }));
    await expect(transport.deliver(grant, lease)).rejects.toBeInstanceOf(DomainError);
    expect(port.pasteCalls).toBe(0);
    expect(await store.readTmuxPhase(DELIVERY_ID)).toBeNull();
  });

  it('requires manual reconciliation when the consumed delivery authority is reused', async () => {
    const { store, transport, grant, lease } = await makeTransport();
    await transport.deliver(grant, lease);
    // A second attempt reusing the same one-use authority (same grant/lease ids) under a different pointer
    // cannot resume: its snapshot binds the new grant bytes, but the authority is already consumed.
    const grant2 = parsePointerDeliveryGrant(
      validPointerDeliveryGrant({ pointerArtifactRef: 'artifacts/as1-slack-pilot/agent-office-advisor/pointers/p2/pointer.json' }),
    );
    const lease2 = parseReadinessLease(validReadinessLease({ pointerDeliveryGrantSnapshotHash: hashCanonical(grant2) }));
    const secondPort = new FakeTmuxPort(matchingPreflight());
    const second = new As1ExactTransport(() => NOW, secondPort, store, ACCEPTING_GATE, NOOP_LATCH);
    const result = await second.deliver(grant2, lease2);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(result.reason).toContain('already consumed');
    expect(secondPort.pasteCalls).toBe(0);
  });

  it('stops before paste and does not consume when the first preflight mismatches', async () => {
    const { transport, port, store, grant, lease } = await makeTransport();
    port.setPreflightSequence([matchingPreflight({ panePid: 99_999 })]);
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('STOPPED_BEFORE_PASTE');
    expect(port.loadCalls).toBe(0);
    expect(port.pasteCalls).toBe(0);
    // No durable journal and the authority is still consumable exactly once afterwards.
    expect(await store.readTmuxPhase(DELIVERY_ID)).toBeNull();
    expect(await store.consumeDeliveryAuthority('as1-pdg-0001', 'as1-lease-0001')).toBe(true);
  });

  it('requires manual reconciliation (no cleanup) when the second preflight changes after BUFFER_LOADED (B04)', async () => {
    const { store, transport, port, grant, lease } = await makeTransport();
    port.setPreflightSequence([matchingPreflight(), matchingPreflight({ currentCommand: 'bash' })]);
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(port.loadCalls).toBe(1);
    expect(port.deleteCalls).toBe(0);
    expect(port.pasteCalls).toBe(0);
    expect(await store.readTmuxPhase(DELIVERY_ID)).toBe('MANUAL_RECONCILIATION_REQUIRED');
  });

  it('records MANUAL_RECONCILIATION_REQUIRED and never re-sends after an ambiguous paste', async () => {
    const { store, transport, port, grant, lease } = await makeTransport();
    port.setPasteThrows();
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(port.pasteCalls).toBe(1);
    expect(port.enterCalls).toBe(0);
    expect(await store.readTmuxPhase(DELIVERY_ID)).toBe('MANUAL_RECONCILIATION_REQUIRED');
  });

  it('never resumes a delivery whose journal is already at the no-retry boundary', async () => {
    const { store, transport, port, capability, grant, lease } = await makeTransport();
    const facts = deliveryJournalFacts(capability);
    // Seed an interrupted journal at PASTE_STARTED via its legal PREPARED -> BUFFER_LOADED -> PASTE_STARTED path.
    await store.recordTmuxPhase(DELIVERY_ID, 'PREPARED', facts);
    await store.recordTmuxPhase(DELIVERY_ID, 'BUFFER_LOADED', facts);
    await store.recordTmuxPhase(DELIVERY_ID, 'PASTE_STARTED', facts);
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(port.pasteCalls).toBe(0);
  });

  it('treats an interrupted PREPARED or BUFFER_LOADED journal as manual reconciliation, never a silent retry (B04)', async () => {
    for (const phase of ['PREPARED', 'BUFFER_LOADED'] as const) {
      const { store, transport, port, capability, grant, lease } = await makeTransport();
      const facts = deliveryJournalFacts(capability);
      await store.recordTmuxPhase(DELIVERY_ID, 'PREPARED', facts);
      if (phase === 'BUFFER_LOADED') await store.recordTmuxPhase(DELIVERY_ID, 'BUFFER_LOADED', facts);
      const result = await transport.deliver(grant, lease);
      expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
      expect(port.loadCalls).toBe(0);
      expect(port.pasteCalls).toBe(0);
      expect(await store.readTmuxPhase(DELIVERY_ID)).toBe('MANUAL_RECONCILIATION_REQUIRED');
    }
  });

  it('rejects a grant whose pointer ref is not this profile\'s internal delivery layout (B04)', async () => {
    const { store, port } = await makeTransport();
    const transport = new As1ExactTransport(() => NOW, port, store, ACCEPTING_GATE, NOOP_LATCH);
    const lease = parseReadinessLease(validReadinessLease());
    const wrongKind = parsePointerDeliveryGrant(
      validPointerDeliveryGrant({ pointerArtifactRef: 'artifacts/as1-slack-pilot/agent-office-advisor/intake/p1/x.json' }),
    );
    await expect(transport.deliver(wrongKind, lease)).rejects.toBeInstanceOf(DomainError);
    const crossProfile = parsePointerDeliveryGrant(
      validPointerDeliveryGrant({ pointerArtifactRef: 'artifacts/as1-slack-pilot/foundation-advisor/pointers/p1/pointer.json' }),
    );
    await expect(transport.deliver(crossProfile, lease)).rejects.toBeInstanceOf(DomainError);
  });

  it('reads a fresh trusted clock before paste: an expiry after BUFFER_LOADED requires manual reconciliation (B04)', async () => {
    const { store, port, grant, lease } = await makeTransport();
    let now = NOW;
    const transport = new As1ExactTransport(() => now, port, store, ACCEPTING_GATE, NOOP_LATCH);
    port.onLoad(() => { now = LATE; }); // the capability expires the instant the buffer is loaded (past PREPARED)
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(port.pasteCalls).toBe(0);
    expect(await store.readTmuxPhase(DELIVERY_ID)).toBe('MANUAL_RECONCILIATION_REQUIRED');
  });

  it('reads a fresh trusted clock before Enter: an expiry after PASTE_STARTED requires manual reconciliation (B04)', async () => {
    const { store, port, grant, lease } = await makeTransport();
    let now = NOW;
    const transport = new As1ExactTransport(() => now, port, store, ACCEPTING_GATE, NOOP_LATCH);
    port.onPaste(() => { now = LATE; }); // the capability expires the instant the paste lands, before Enter
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(port.pasteCalls).toBe(1);
    expect(port.enterCalls).toBe(0);
    expect(await store.readTmuxPhase(DELIVERY_ID)).toBe('MANUAL_RECONCILIATION_REQUIRED');
  });

  it('consumes the grant and lease atomically; reusing either id afterwards is refused (B04)', async () => {
    const { store } = await makeTransport();
    expect(await store.consumeDeliveryAuthority('as1-pdg-x', 'as1-lease-x')).toBe(true);
    expect(await store.consumeDeliveryAuthority('as1-pdg-x', 'as1-lease-y')).toBe(false); // grant id reuse
    expect(await store.consumeDeliveryAuthority('as1-pdg-z', 'as1-lease-x')).toBe(false); // lease id reuse
  });

  it('fails closed if legacy two-file consumption state is present (B04)', async () => {
    const { root, store } = await makeTransport();
    const legacy = path.join(root, 'indexes/as1-slack-pilot/profiles/agent-office-advisor/pointer-delivery-grant-consumption.json');
    await writeFile(legacy, JSON.stringify([{ id: 'as1-pdg-legacy', consumedAt: NOW }]), 'utf8');
    await expect(store.consumeDeliveryAuthority('as1-pdg-new', 'as1-lease-new')).rejects.toBeInstanceOf(DomainError);
  });

  it('honors an expired capability by stopping before pane input', async () => {
    const { capability } = await makeTransport();
    expect(grabDomainError(() => {
      assertCapabilityUsable(capability, '2026-07-14T22:05:00.000Z');
    }).code).toBe('AUTHORITY_ARTIFACT_INVALID');
  });
});
