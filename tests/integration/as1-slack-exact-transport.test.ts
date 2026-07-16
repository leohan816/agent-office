import { chmod, link, symlink, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { hashCanonical } from '../../src/persistence/file-store/hashing.js';
import {
  buildAdvisorPointer,
  parsePointerDeliveryGrant,
  type As1PointerDeliveryGrantV1,
} from '../../src/application/slack-pilot/contracts.js';
import { As1ProfileInboundStore } from '../../src/application/slack-pilot/inbound-store.js';
import { selectProfile } from '../../src/application/slack-pilot/profiles.js';
import {
  assertCapabilityUsable,
  assertDeliveryChainConsistent,
  createDeliveryCapability,
  parseReadinessLease,
  parseTmuxDestination,
  type As1AdvisorReadinessLeaseV1,
  type As1TmuxDestination,
} from '../../src/adapters/gateways/slack-pilot/exact-authority.js';
import {
  As1ExactTransport,
  deliveryJournalFacts,
  NodeAs1TmuxPort,
  type As1DeliveryControlPort,
  type As1DeliveryJournal,
  type As1DeliveryProvenanceGate,
  type As1TmuxObservationPort,
} from '../../src/adapters/gateways/slack-pilot/exact-transport.js';
import { FakeClock, validDestination, validPointerDeliveryGrant, validReadinessLease } from '../helpers/as1-slack-fakes.js';
import { makeStateRoot } from '../helpers/fixtures.js';

const NOW = '2026-07-14T22:03:05.000Z';
const LATE = '2026-07-14T22:30:00.000Z';
const POINTER_HASH = `sha256:${'4'.repeat(64)}`;
const DELIVERY_ID = 'p1';
const AGENT_OFFICE = selectProfile('AGENT_OFFICE_ADVISOR');

const ACCEPTING_GATE: As1DeliveryProvenanceGate = { assertAccepted: () => Promise.resolve() };
const DELIVERABLE: As1DeliveryControlPort = { isDeliverable: () => Promise.resolve(true) };
const NOOP_LATCH = (): Promise<void> => Promise.resolve();

function grabDomainError(fn: () => unknown): DomainError {
  try {
    fn();
  } catch (error) {
    if (error instanceof DomainError) return error;
    throw error;
  }
  throw new Error('expected a DomainError but none was thrown');
}

/** A 15-field observation fake (the arm behavior stays local; fakes.ts is untouched by scope). */
class FakeObservationPort implements As1TmuxObservationPort {
  public observeCalls = 0;
  public loadCalls = 0;
  public pasteCalls = 0;
  public enterCalls = 0;
  public deleteCalls = 0;
  public lastLoadedBytes: Buffer | null = null;
  private readonly queue: As1TmuxDestination[] = [];
  private bufferPresent = false;
  private pasteThrows = false;
  private onLoadHook: (() => void) | null = null;
  private onPasteHook: (() => void) | null = null;
  private onFirstObserveHook: (() => void | Promise<void>) | null = null;

  public constructor(private readonly base: As1TmuxDestination) {}

  public setObserveSequence(results: readonly As1TmuxDestination[]): void {
    this.queue.push(...results);
  }
  public setBufferPresent(): void {
    this.bufferPresent = true;
  }
  public setPasteThrows(): void {
    this.pasteThrows = true;
  }
  public onLoad(fn: () => void): void {
    this.onLoadHook = fn;
  }
  public onPaste(fn: () => void): void {
    this.onPasteHook = fn;
  }
  /** Fire once, at the first observation (between the pin and the precommit identity proof) — F04 races. */
  public onFirstObserve(fn: () => void | Promise<void>): void {
    this.onFirstObserveHook = fn;
  }

  public async observe(): Promise<As1TmuxDestination> {
    this.observeCalls += 1;
    if (this.observeCalls === 1 && this.onFirstObserveHook !== null) await this.onFirstObserveHook();
    return this.queue.shift() ?? this.base;
  }
  public bufferExists(): Promise<boolean> {
    return Promise.resolve(this.bufferPresent);
  }
  public loadVerifiedBuffer(_bufferName: string, pinnedBytes: Buffer): Promise<void> {
    this.loadCalls += 1;
    this.lastLoadedBytes = pinnedBytes;
    if (this.onLoadHook !== null) this.onLoadHook();
    return Promise.resolve();
  }
  public pasteBuffer(): Promise<void> {
    this.pasteCalls += 1;
    if (this.onPasteHook !== null) this.onPasteHook();
    if (this.pasteThrows) return Promise.reject(new Error('tmux paste ambiguous'));
    return Promise.resolve();
  }
  public sendEnter(): Promise<void> {
    this.enterCalls += 1;
    return Promise.resolve();
  }
  public deleteBuffer(): Promise<void> {
    this.deleteCalls += 1;
    return Promise.resolve();
  }
}

function baseDestination(overrides: Record<string, unknown> = {}): As1TmuxDestination {
  return parseTmuxDestination(validDestination(overrides), 'base destination');
}

interface PinnedFixture {
  readonly root: string;
  readonly store: As1ProfileInboundStore;
  readonly grant: As1PointerDeliveryGrantV1;
  readonly lease: As1AdvisorReadinessLeaseV1;
  readonly pointerLeafPath: string;
}

/** Materialize a REAL canonical-plus-LF pointer at the content-addressed path and bind the grant/lease to it. */
async function pinnedDelivery(store: As1ProfileInboundStore, root: string, deliveryId = DELIVERY_ID): Promise<PinnedFixture> {
  const pointer = buildAdvisorPointer({
    profileId: 'AGENT_OFFICE_ADVISOR',
    pilotId: 'as1-pilot-0001',
    receiveGrantId: 'as1-receive-grant-0001',
    receiveGrantBindingHash: `sha256:${'2'.repeat(64)}`,
    intakeId: 'as1-intake-0001',
    intakeKind: 'NEW_MISSION',
    sourceEventId: 'Ev0AGENTOFFICE01',
    rootCorrelationHash: `sha256:${'3'.repeat(64)}`,
    intakeArtifactRef: 'artifacts/as1-slack-pilot/agent-office-advisor/intake/as1-intake-0001/x.json',
    intakeArtifactHash: `sha256:${'7'.repeat(64)}`,
    recordedAt: NOW,
  });
  const receipt = await store.persistPointerArtifact(deliveryId, pointer);
  const grant = parsePointerDeliveryGrant(
    validPointerDeliveryGrant({
      pointerArtifactRef: receipt.relativePath,
      pointerHash: receipt.sha256,
    }),
  );
  const lease = parseReadinessLease(
    validReadinessLease({ pointerHash: receipt.sha256, pointerDeliveryGrantSnapshotHash: hashCanonical(grant) }),
  );
  return { root, store, grant, lease, pointerLeafPath: path.join(root, receipt.relativePath) };
}

async function makeTransport(deliveryId = DELIVERY_ID) {
  const root = await makeStateRoot();
  const store = await As1ProfileInboundStore.open(root, AGENT_OFFICE, new FakeClock(NOW));
  const fixture = await pinnedDelivery(store, root, deliveryId);
  const port = new FakeObservationPort(baseDestination());
  const latched: string[] = [];
  const latch = (reason: string): Promise<void> => {
    latched.push(reason);
    return Promise.resolve();
  };
  const transport = new As1ExactTransport(() => NOW, root, AGENT_OFFICE, port, store, ACCEPTING_GATE, DELIVERABLE, latch);
  return { root, store, grant: fixture.grant, lease: fixture.lease, pointerLeafPath: fixture.pointerLeafPath, transport, port, latched };
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
      grabDomainError(() => parseReadinessLease(validReadinessLease({ destination: validDestination({ inputOff: true }) }))).code,
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

  it('honors an expired capability by stopping before pane input', () => {
    const grant = parsePointerDeliveryGrant(validPointerDeliveryGrant());
    const lease = parseReadinessLease(validReadinessLease());
    const capability = createDeliveryCapability(grant, lease, NOW);
    expect(grabDomainError(() => assertCapabilityUsable(capability, '2026-07-14T22:05:00.000Z')).code).toBe('AUTHORITY_ARTIFACT_INVALID');
  });
});

describe('AS1 exact tmux transport — pinned bytes + three complete observations', () => {
  it('delivers one pointer: pins the exact canonical+LF bytes, observes thrice, and consumes authority once', async () => {
    const { store, transport, port, grant, lease } = await makeTransport();
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('DELIVERED');
    expect(result.phase).toBe('TRANSPORT_RECORDED');
    // Two complete precommit observations + one complete post-load observation.
    expect(port.observeCalls).toBe(3);
    expect(port.loadCalls).toBe(1);
    expect(port.pasteCalls).toBe(1);
    expect(port.enterCalls).toBe(1);
    // Only the pinned bytes are loaded — never a path.
    expect(port.lastLoadedBytes).not.toBeNull();
    expect(await store.readTmuxPhase(DELIVERY_ID)).toBe('TRANSPORT_RECORDED');
    // The authority was consumed exactly once.
    expect(await store.consumeDeliveryAuthority(grant.pointerDeliveryGrantId, lease.leaseId)).toBe(false);
  });

  it('stops before paste (no journal, unconsumed authority) when the pointer hash does not equal the grant hash', async () => {
    const { store, transport, port, grant, lease } = await makeTransport();
    const wrongGrant = parsePointerDeliveryGrant(
      validPointerDeliveryGrant({ pointerArtifactRef: grant.pointerArtifactRef, pointerHash: `sha256:${'9'.repeat(64)}` }),
    );
    const wrongLease = parseReadinessLease(
      validReadinessLease({ pointerHash: `sha256:${'9'.repeat(64)}`, pointerDeliveryGrantSnapshotHash: hashCanonical(wrongGrant) }),
    );
    const result = await transport.deliver(wrongGrant, wrongLease);
    expect(result.outcome).toBe('STOPPED_BEFORE_PASTE');
    expect(port.loadCalls).toBe(0);
    expect(port.pasteCalls).toBe(0);
    expect(await store.readTmuxPhase(DELIVERY_ID)).toBeNull();
    expect(await store.consumeDeliveryAuthority(grant.pointerDeliveryGrantId, lease.leaseId)).toBe(true);
  });

  it('stops before paste when the pointer leaf is not exactly private (mode 0644)', async () => {
    const { transport, port, grant, lease, pointerLeafPath } = await makeTransport();
    await chmod(pointerLeafPath, 0o644);
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('STOPPED_BEFORE_PASTE');
    expect(port.pasteCalls).toBe(0);
  });

  it('stops before paste when the pointer bytes are not canonical-plus-one-LF', async () => {
    const { transport, port, grant, lease, pointerLeafPath } = await makeTransport();
    // Overwrite the content-addressed leaf with non-canonical (double-LF) bytes; the raw hash no longer matches
    // AND the canonical equality fails — the pin rejects precommit.
    await writeFile(pointerLeafPath, `${JSON.stringify({ a: 1 })}\n\n`, { mode: 0o600 });
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('STOPPED_BEFORE_PASTE');
    expect(port.pasteCalls).toBe(0);
  });

  it('stops before paste when observation ONE does not equal the lease destination', async () => {
    const { store, transport, port, grant, lease } = await makeTransport();
    port.setObserveSequence([baseDestination({ panePid: 99_999 })]);
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('STOPPED_BEFORE_PASTE');
    expect(port.loadCalls).toBe(0);
    expect(port.pasteCalls).toBe(0);
    expect(await store.readTmuxPhase(DELIVERY_ID)).toBeNull();
  });

  it('stops before paste when observation TWO diverges from observation one', async () => {
    const { transport, port, grant, lease } = await makeTransport();
    port.setObserveSequence([baseDestination(), baseDestination({ activityTime: '1720000999' })]);
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('STOPPED_BEFORE_PASTE');
    expect(port.loadCalls).toBe(0);
    expect(port.pasteCalls).toBe(0);
  });

  it('requires postcommit manual reconciliation (no cleanup) when observation THREE changes after buffer load', async () => {
    const { store, transport, port, grant, lease } = await makeTransport();
    // obs1, obs2 match; obs3 (post-load) diverges.
    port.setObserveSequence([baseDestination(), baseDestination(), baseDestination({ currentCommand: 'bash' })]);
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(port.loadCalls).toBe(1);
    expect(port.deleteCalls).toBe(0);
    expect(port.pasteCalls).toBe(0);
    expect(await store.readTmuxPhase(DELIVERY_ID)).toBe('MANUAL_RECONCILIATION_REQUIRED');
  });

  it('stops before paste and does not consume when the lease destination is not bound to the selected profile', async () => {
    const { store, transport, port, grant } = await makeTransport();
    const foreignLease = parseReadinessLease(
      validReadinessLease({
        pointerHash: grant.pointerHash,
        pointerDeliveryGrantSnapshotHash: hashCanonical(grant),
        destination: validDestination({ sessionName: 'foundation-advisor', workspace: '/home/leo/Project/FOUNDATION' }),
      }),
    );
    const result = await transport.deliver(grant, foreignLease);
    expect(result.outcome).toBe('STOPPED_BEFORE_PASTE');
    expect(port.pasteCalls).toBe(0);
    expect(await store.readTmuxPhase(DELIVERY_ID)).toBeNull();
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

  it('never delivers when the provenance gate rejects; no journal or side effect', async () => {
    const { store, port, grant, lease, root } = await makeTransport();
    const rejecting: As1DeliveryProvenanceGate = {
      assertAccepted: () => Promise.reject(new DomainError('AUTHORITY_ARTIFACT_INVALID', 'provenance not accepted')),
    };
    const transport = new As1ExactTransport(() => NOW, root, AGENT_OFFICE, port, store, rejecting, DELIVERABLE, NOOP_LATCH);
    await expect(transport.deliver(grant, lease)).rejects.toBeInstanceOf(DomainError);
    expect(port.pasteCalls).toBe(0);
    expect(await store.readTmuxPhase(DELIVERY_ID)).toBeNull();
  });

  it('latches and reconciles when the delivery journal raises a durable STORE_QUARANTINED', async () => {
    const { port, grant, lease, root } = await makeTransport();
    const latched: string[] = [];
    const quarantiningJournal: As1DeliveryJournal = {
      recordTmuxPhase: () => Promise.reject(new DomainError('STORE_QUARANTINED', 'corrupt delivery journal')),
      readTmuxPhase: () => Promise.resolve(null),
      consumeDeliveryAuthority: () => Promise.resolve(true),
    };
    const transport = new As1ExactTransport(() => NOW, root, AGENT_OFFICE, port, quarantiningJournal, ACCEPTING_GATE, DELIVERABLE, (reason) => {
      latched.push(reason);
      return Promise.resolve();
    });
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(result.reason).toBe('STORE_QUARANTINED');
    expect(latched.length).toBeGreaterThan(0);
    expect(port.pasteCalls).toBe(0);
  });

  it('never resumes a delivery already at the no-retry boundary', async () => {
    const { store, transport, port, grant, lease } = await makeTransport();
    const capability = createDeliveryCapability(grant, lease, NOW);
    const facts = deliveryJournalFacts(capability);
    await store.recordTmuxPhase(DELIVERY_ID, 'PREPARED', facts);
    await store.recordTmuxPhase(DELIVERY_ID, 'BUFFER_LOADED', facts);
    await store.recordTmuxPhase(DELIVERY_ID, 'PASTE_STARTED', facts);
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(port.pasteCalls).toBe(0);
  });
});

describe('AS1 owning-control boundary gating on delivery (B05)', () => {
  it('a kill before delivery entry stops before any observation', async () => {
    const { store, port, grant, lease, root } = await makeTransport();
    const control: As1DeliveryControlPort = { isDeliverable: () => Promise.resolve(false) };
    const transport = new As1ExactTransport(() => NOW, root, AGENT_OFFICE, port, store, ACCEPTING_GATE, control, NOOP_LATCH);
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('STOPPED_BEFORE_PASTE');
    expect(port.observeCalls).toBe(0);
    expect(await store.readTmuxPhase(DELIVERY_ID)).toBeNull();
  });

  it('a kill engaged the instant the buffer loads prevents the paste mutation (manual reconciliation)', async () => {
    const { store, port, grant, lease, root } = await makeTransport();
    let deliverable = true;
    const control: As1DeliveryControlPort = { isDeliverable: () => Promise.resolve(deliverable) };
    const transport = new As1ExactTransport(() => NOW, root, AGENT_OFFICE, port, store, ACCEPTING_GATE, control, NOOP_LATCH);
    port.onLoad(() => {
      deliverable = false;
    });
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(port.pasteCalls).toBe(0);
    expect(await store.readTmuxPhase(DELIVERY_ID)).toBe('MANUAL_RECONCILIATION_REQUIRED');
  });

  it('a fresh clock expiry after buffer load requires manual reconciliation, never a paste', async () => {
    const { store, port, grant, lease, root } = await makeTransport();
    let now = NOW;
    const transport = new As1ExactTransport(() => now, root, AGENT_OFFICE, port, store, ACCEPTING_GATE, DELIVERABLE, NOOP_LATCH);
    port.onLoad(() => {
      now = LATE;
    });
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(port.pasteCalls).toBe(0);
  });
});

describe('AS1 production NodeAs1TmuxPort argv allowlist (static)', () => {
  it('rejects a non-derived pane id and buffer name without touching tmux', async () => {
    const calls: string[][] = [];
    const port = new NodeAs1TmuxPort((argv) => {
      calls.push([...argv]);
      return Promise.resolve({ code: 0, stdout: Buffer.from('') });
    });
    await expect(port.observe('; rm -rf /')).rejects.toBeInstanceOf(DomainError);
    await expect(port.deleteBuffer('as1-evil; rm')).rejects.toBeInstanceOf(DomainError);
    await expect(port.pasteBuffer('as1-agent-office-advisor-p1', '@notapane')).rejects.toBeInstanceOf(DomainError);
    expect(calls.length).toBe(0); // nothing reached the tmux runner
  });

  it('loads ONLY the pinned bytes through a closed stdin with the exact load-buffer argv', async () => {
    const bytes = Buffer.from('{"pinned":true}\n', 'utf8');
    let seenArgv: readonly string[] = [];
    let loadedMatches = false;
    let sawStdin = false;
    const port = new NodeAs1TmuxPort((argv, stdin) => {
      seenArgv = argv;
      sawStdin = stdin !== null;
      loadedMatches = stdin?.equals(bytes) ?? false;
      return Promise.resolve({ code: 0, stdout: Buffer.from('') });
    });
    await port.loadVerifiedBuffer('as1-agent-office-advisor-p1', bytes);
    expect(seenArgv).toStrictEqual(['load-buffer', '-b', 'as1-agent-office-advisor-p1', '-']);
    expect(sawStdin).toBe(true); // the pinned bytes reach a closed stdin, never a path argument
    expect(loadedMatches).toBe(true);
  });
});

// Keep the delivery-authority consumption invariants proven directly on the store.
describe('AS1 delivery-authority consumption invariants', () => {
  it('consumes the grant and lease atomically; reusing either id afterwards is refused', async () => {
    const root = await makeStateRoot();
    const store = await As1ProfileInboundStore.open(root, AGENT_OFFICE, new FakeClock(NOW));
    expect(await store.consumeDeliveryAuthority('as1-pdg-x', 'as1-lease-x')).toBe(true);
    expect(await store.consumeDeliveryAuthority('as1-pdg-x', 'as1-lease-y')).toBe(false);
    expect(await store.consumeDeliveryAuthority('as1-pdg-z', 'as1-lease-x')).toBe(false);
    // The read-only typed accessor returns the atomic consumption record.
    const record = await store.readDeliveryAuthorityConsumption('as1-pdg-x');
    expect(record?.leaseId).toBe('as1-lease-x');
  });

  it('fails closed if legacy two-file consumption state is present', async () => {
    const root = await makeStateRoot();
    const store = await As1ProfileInboundStore.open(root, AGENT_OFFICE, new FakeClock(NOW));
    const legacy = path.join(root, 'indexes/as1-slack-pilot/profiles/agent-office-advisor/pointer-delivery-grant-consumption.json');
    await writeFile(legacy, JSON.stringify([{ id: 'as1-pdg-legacy', consumedAt: NOW }]), 'utf8');
    await expect(store.consumeDeliveryAuthority('as1-pdg-new', 'as1-lease-new')).rejects.toBeInstanceOf(DomainError);
  });
});

// F04 delta-review: retained-descriptor pointer proof, BOTH-authority freshness at every observation, and
// recovery-authorized buffer deletion. The grant-expiry and recovery-gate cases FAIL on candidate 317d82e.
describe('AS1 exact transport — F04 adversarial pointer/recovery matrix', () => {
  it('fails closed when the GRANT expires between observations (both authorities are checked, not only the lease)', async () => {
    const root = await makeStateRoot();
    const store = await As1ProfileInboundStore.open(root, AGENT_OFFICE, new FakeClock(NOW));
    const fixture = await pinnedDelivery(store, root);
    // A short 2-second grant whose expiry falls between observations, with a longer 20-second lease.
    const grant = parsePointerDeliveryGrant(
      validPointerDeliveryGrant({ pointerArtifactRef: fixture.grant.pointerArtifactRef, pointerHash: fixture.grant.pointerHash, issuedAt: NOW, expiresAt: '2026-07-14T22:03:07.000Z' }),
    );
    const lease = parseReadinessLease(
      validReadinessLease({ pointerHash: fixture.grant.pointerHash, pointerDeliveryGrantSnapshotHash: hashCanonical(grant), observedAt: NOW, issuedAt: NOW, expiresAt: '2026-07-14T22:03:25.000Z' }),
    );
    let now = NOW;
    const port = new FakeObservationPort(baseDestination());
    port.onFirstObserve(() => {
      now = '2026-07-14T22:03:10.000Z'; // past the 2s grant, before the 20s lease
    });
    const transport = new As1ExactTransport(() => now, root, AGENT_OFFICE, port, store, ACCEPTING_GATE, DELIVERABLE, NOOP_LATCH);
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('STOPPED_BEFORE_PASTE');
    expect(result.reason).toContain('grant or lease expired');
    expect(port.observeCalls).toBe(1); // stopped at the grant check on observation one — never reached observation two
    expect(await store.readTmuxPhase(DELIVERY_ID)).toBeNull();
  });

  it('F04: any pre-existing buffer fails closed to manual reconciliation WITHOUT deletion', async () => {
    const { transport, port, grant, lease } = await makeTransport();
    port.setBufferPresent();
    const result = await transport.deliver(grant, lease);
    // A fresh attempt (this delivery's own PREPARED write is never proof of authorized residue) leaves the buffer
    // untouched and fails closed to manual reconciliation.
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(port.deleteCalls).toBe(0);
    expect(port.pasteCalls).toBe(0);
  });

  it('F04: this attempt\'s own PREPARED record is NOT recovery proof — a pre-existing buffer is never deleted', async () => {
    const { store, port, grant, lease, root } = await makeTransport();
    port.setBufferPresent();
    // A real store journal, so THIS attempt does write its own PREPARED record; it must still NEVER authorize deleting
    // the pre-existing same-name buffer (the exact false premise the delta review flagged).
    const transport = new As1ExactTransport(() => NOW, root, AGENT_OFFICE, port, store, ACCEPTING_GATE, DELIVERABLE, NOOP_LATCH);
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('MANUAL_RECONCILIATION_REQUIRED');
    expect(port.deleteCalls).toBe(0);
  });

  it('a symlink at the pointer leaf fails closed (no-follow open)', async () => {
    const { transport, port, grant, lease, pointerLeafPath } = await makeTransport();
    await unlink(pointerLeafPath);
    await symlink('/etc/hostname', pointerLeafPath);
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('STOPPED_BEFORE_PASTE');
    expect(port.pasteCalls).toBe(0);
  });

  it('a hardlinked pointer leaf (link count 2) fails closed', async () => {
    const { transport, port, grant, lease, pointerLeafPath } = await makeTransport();
    await link(pointerLeafPath, `${path.dirname(pointerLeafPath)}/hardlink-copy.json`);
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('STOPPED_BEFORE_PASTE');
    expect(port.pasteCalls).toBe(0);
  });

  it('a pointer leaf larger than 32 KiB fails the size gate; a 32,768-byte leaf passes it (then fails later gates)', async () => {
    const over = await makeTransport();
    await writeFile(over.pointerLeafPath, Buffer.alloc(32 * 1024 + 1, 0x20), { mode: 0o600 });
    expect((await over.transport.deliver(over.grant, over.lease)).outcome).toBe('STOPPED_BEFORE_PASTE');
    const at = await makeTransport();
    // Exactly 32,768 bytes passes the size gate and is rejected only by the canonical/hash gates (still STOPPED).
    await writeFile(at.pointerLeafPath, Buffer.alloc(32 * 1024, 0x20), { mode: 0o600 });
    expect((await at.transport.deliver(at.grant, at.lease)).outcome).toBe('STOPPED_BEFORE_PASTE');
  });

  it('replacing the pinned leaf between the pin and the identity proof fails closed (retained descriptor)', async () => {
    const { store, transport, port, grant, lease, pointerLeafPath } = await makeTransport();
    port.onFirstObserve(async () => {
      await unlink(pointerLeafPath);
      await writeFile(pointerLeafPath, Buffer.from('{"replaced":true}\n', 'utf8'), { mode: 0o600 });
    });
    const result = await transport.deliver(grant, lease);
    expect(result.outcome).toBe('STOPPED_BEFORE_PASTE');
    expect(port.pasteCalls).toBe(0);
    expect(await store.readTmuxPhase(DELIVERY_ID)).toBeNull(); // never reached PREPARED
  });
});
