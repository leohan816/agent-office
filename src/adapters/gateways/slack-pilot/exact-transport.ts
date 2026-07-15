// AS1 Multi-Team Slack Pilot — separate exact tmux pointer transport journal and runner.
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_DESIGN.md §12.7 (journal), §13
// (evidence); docs/security/AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md §13 (tmux mutation).
// This is a SEPARATE transport from Exact Delivery v2. The runner exposes only: structured preflight,
// buffer-exists check for an internally derived private name, load an internally derived pointer file,
// paste the validated buffer to the leased pane, send Enter to the leased pane, and delete an unpasted
// buffer under exact recovery proof. It has no capture-pane, run-shell, new-session, arbitrary argv,
// generic target, or caller-supplied file path. Journal durability precedes each side effect;
// PASTE_STARTED is the no-retry boundary. The delivery grant and lease are consumed before the first
// mutation and can never be reused, even if the attempt fails before paste. Target change between
// preflights, dead/copy-mode pane, input-off, synchronized panes, or an expired capability stops before
// paste. Any interrupted nonterminal journal becomes MANUAL_RECONCILIATION_REQUIRED and is never resumed.
import { DomainError } from '../../../contracts/types.js';
import { hashCanonical } from '../../../persistence/file-store/hashing.js';
import { parseContainedPointerRef, redactError } from '../../../application/slack-pilot/contracts.js';
import type { As1PointerDeliveryGrantV1 } from '../../../application/slack-pilot/contracts.js';
import type { As1TmuxDeliveryFacts, As1TmuxDeliveryPhase } from '../../../application/slack-pilot/inbound-store.js';
import {
  assertCapabilityUsable,
  assertDeliveryChainConsistent,
  assertPointerGrantSnapshot,
  createDeliveryCapability,
  type As1AdvisorReadinessLeaseV1,
  type As1DeliveryCapability,
  type As1TmuxDestination,
} from './exact-authority.js';

// The closed tmux delivery phase vocabulary is owned by the store (the journal record owner) and imported here
// as As1TmuxDeliveryPhase, so the sequence and the durable record can never diverge (review B08).

// Every nonterminal phase is interrupted-unsafe: on re-entry it becomes MANUAL_RECONCILIATION_REQUIRED and is
// never silently resumed or retried (design §12.7). Only a fresh (null) or terminal journal proceeds/returns.
const INTERRUPTED_NONTERMINAL_PHASES: readonly string[] = ['PREPARED', 'BUFFER_LOADED', 'PASTE_STARTED', 'PASTE_CONFIRMED', 'SUBMIT_STARTED'];

/** Live tmux facts read by a structured preflight (no pane content is ever captured). */
export interface As1TmuxPreflight {
  readonly sessionId: string;
  readonly windowId: string;
  readonly paneId: string;
  readonly panePid: number;
  readonly workspace: string;
  readonly currentCommand: string;
  readonly paneDead: boolean;
  readonly paneInMode: boolean;
  readonly inputOff: boolean;
  readonly synchronizePanes: boolean;
}

/** The only tmux operations AS1 can perform. Every argument is an internally derived, validated value. */
export interface As1TmuxPort {
  preflight(paneId: string): Promise<As1TmuxPreflight>;
  bufferExists(bufferName: string): Promise<boolean>;
  loadBuffer(bufferName: string, pointerFilePath: string): Promise<void>;
  pasteBuffer(bufferName: string, paneId: string): Promise<void>;
  sendEnter(paneId: string): Promise<void>;
  deleteBuffer(bufferName: string): Promise<void>;
}

/** Durable per-profile tmux journal + one-use delivery-authority consumption (implemented by the store). */
export interface As1DeliveryJournal {
  /** Record a phase; the invariant facts are bound on the first (PREPARED) write and preserved thereafter. */
  recordTmuxPhase(deliveryId: string, phase: As1TmuxDeliveryPhase, facts?: As1TmuxDeliveryFacts): Promise<void>;
  readTmuxPhase(deliveryId: string): Promise<string | null>;
  /** Consume the grant + lease exactly once. Returns false if either was already consumed (reuse). */
  consumeDeliveryAuthority(pointerDeliveryGrantId: string, leaseId: string): Promise<boolean>;
}

/** The invariant identity/authority facts bound into a delivery journal, derived only from the live capability. */
export function deliveryJournalFacts(capability: As1DeliveryCapability): As1TmuxDeliveryFacts {
  return {
    receiveGrantId: capability.receiveGrantId,
    receiveGrantBindingHash: capability.receiveGrantBindingHash,
    pointerDeliveryGrantId: capability.pointerDeliveryGrantId,
    leaseId: capability.leaseId,
    pilotId: capability.pilotId,
    profileId: capability.profileId,
    advisorTeam: capability.advisorTeam,
    actorId: capability.actorId,
    roleInstanceId: capability.roleInstanceId,
    intakeId: capability.intakeId,
    sourceEventId: capability.sourceEventId,
    pointerHash: capability.pointerHash,
    destinationHash: hashCanonical(capability.destination),
    governanceSnapshotHash: capability.governanceSnapshotHash,
    registrySnapshotHash: capability.registrySnapshotHash,
    globalControlSnapshotHash: capability.globalControlSnapshotHash,
    profileLatchSnapshotHash: capability.profileLatchSnapshotHash,
    pointerDeliveryGrantSnapshotHash: capability.pointerDeliveryGrantSnapshotHash,
  };
}

/**
 * The accepted provenance/content seal (implemented in B06). The transport ALWAYS consults it before any side
 * effect, so a direct call can never bypass the reviewed Git/content provenance gate. `grant.pointerHash`
 * echoed back to its own grant is not proof of durable pointer bytes; this gate is.
 */
export interface As1DeliveryProvenanceGate {
  assertAccepted(grant: As1PointerDeliveryGrantV1, lease: As1AdvisorReadinessLeaseV1): Promise<void>;
}

/**
 * The exact owning-profile operational control, bound to the transport at construction (review B05). It is the
 * lock-holding canonical control for THIS profile; `isDeliverable()` is false when the profile is not lock-owned,
 * disabled/disconnected, globally killed, or durably latched. The transport re-checks it immediately before EVERY
 * delivery side effect — journal mutation, authority consumption, buffer lookup/deletion/load, paste, and Enter —
 * so a kill/latch engaged between two adjacent boundaries prevents the next mutation. It is never a caller value.
 */
export interface As1DeliveryControlPort {
  isDeliverable(): Promise<boolean>;
}

export type As1DeliveryOutcome = 'DELIVERED' | 'STOPPED_BEFORE_PASTE' | 'MANUAL_RECONCILIATION_REQUIRED';

export interface As1DeliveryResult {
  readonly phase: As1TmuxDeliveryPhase;
  readonly outcome: As1DeliveryOutcome;
  readonly reason: string;
}

/**
 * The internally derived delivery target. Profile, delivery identity, private buffer name, and contained
 * pointer file path are all a pure function of the validated pointer-delivery grant — never a caller value.
 */
interface As1DeliveryTarget {
  readonly profileStateSlug: string;
  readonly deliveryId: string;
  readonly bufferName: string;
  readonly pointerFilePath: string;
}

/**
 * Derive the whole delivery target from the grant alone (review B04): the profile/delivery identity come from
 * the SINGLE shared `parseContainedPointerRef` parser (design §12.6), and the private buffer name is derived
 * from that slug + delivery id. No divergent local pointer parsing.
 */
function deriveDeliveryTarget(grant: As1PointerDeliveryGrantV1): As1DeliveryTarget {
  const { profileStateSlug, deliveryId, pointerFilePath } = parseContainedPointerRef(grant);
  return { profileStateSlug, deliveryId, bufferName: `as1-${profileStateSlug}-${deliveryId}`, pointerFilePath };
}

function preflightMatchesDestination(preflight: As1TmuxPreflight, destination: As1TmuxDestination): boolean {
  return (
    preflight.paneId === destination.paneId &&
    preflight.panePid === destination.panePid &&
    preflight.sessionId === destination.sessionId &&
    preflight.windowId === destination.windowId &&
    preflight.workspace === destination.workspace &&
    preflight.currentCommand === destination.currentCommand &&
    !preflight.paneDead &&
    !preflight.paneInMode &&
    !preflight.inputOff &&
    !preflight.synchronizePanes
  );
}

/**
 * The exact tmux transport. Its trusted collaborators — the fresh clock, the tmux port, and the durable
 * journal — are bound once at construction (composition or a test), so a per-delivery call can never select
 * the clock, target, capability, buffer, or path. `deliver` accepts only two validated authority artifacts.
 */
export class As1ExactTransport {
  public constructor(
    private readonly clock: () => string,
    private readonly port: As1TmuxPort,
    private readonly journal: As1DeliveryJournal,
    private readonly provenance: As1DeliveryProvenanceGate,
    /** Mandatory owning-profile operational control, re-checked before every side effect (review B05). */
    private readonly control: As1DeliveryControlPort,
    /** Mandatory durable profile latch — a journal/consumption STORE_QUARANTINED never surfaces unlatched (B08). */
    private readonly latch: (reason: string) => Promise<void>,
  ) {}

  /** Deliver exactly one pointer through the reviewed journal. Never retries a paste (design §12.7). */
  public async deliver(grant: As1PointerDeliveryGrantV1, lease: As1AdvisorReadinessLeaseV1): Promise<As1DeliveryResult> {
    // A durable STORE_QUARANTINED from the journal or the delivery-authority consumption must latch the profile
    // and fail closed as manual reconciliation, never surface unlatched or silently continue (review B08).
    try {
      return await this.deliverInner(grant, lease);
    } catch (error) {
      if (error instanceof DomainError && error.code === 'STORE_QUARANTINED') {
        await this.latch('tmux delivery durable store quarantined');
        return { phase: 'MANUAL_RECONCILIATION_REQUIRED', outcome: 'MANUAL_RECONCILIATION_REQUIRED', reason: 'STORE_QUARANTINED' };
      }
      throw error;
    }
  }

  private async deliverInner(grant: As1PointerDeliveryGrantV1, lease: As1AdvisorReadinessLeaseV1): Promise<As1DeliveryResult> {
    const { clock, port, journal } = this;

    // Internal derivation only — nothing below is caller-selectable (review B04). Every gate reads a fresh
    // trusted clock at the moment of the side effect, not a single caller-supplied timestamp.
    const { deliveryId, bufferName, pointerFilePath } = deriveDeliveryTarget(grant);
    assertDeliveryChainConsistent(grant, lease, grant.pointerHash, clock());
    // The lease's pointer-delivery-grant snapshot must equal the canonical grant bytes — proven inline so no
    // caller and no permissive gate can bypass it — and the accepted content/Git seal (B06) is then mandatory.
    assertPointerGrantSnapshot(grant, lease);
    await this.provenance.assertAccepted(grant, lease);
    // §12.6: the first exact preflight is driven by the reviewed lease destination, BEFORE any capability.
    const destination = lease.destination;

    // Entry re-check: the owning control must be actionable before even the durable journal READ (review B05).
    if (!(await this.control.isDeliverable())) {
      return { phase: 'PREPARED', outcome: 'STOPPED_BEFORE_PASTE', reason: 'owning control not actionable at delivery entry' };
    }
    const prior = await journal.readTmuxPhase(deliveryId);
    if (prior === 'TRANSPORT_RECORDED') {
      return { phase: 'TRANSPORT_RECORDED', outcome: 'DELIVERED', reason: 'terminal' };
    }
    if (prior === 'MANUAL_RECONCILIATION_REQUIRED') {
      return { phase: 'MANUAL_RECONCILIATION_REQUIRED', outcome: 'MANUAL_RECONCILIATION_REQUIRED', reason: 'terminal' };
    }
    if (prior !== null && INTERRUPTED_NONTERMINAL_PHASES.includes(prior)) {
      // Any interrupted nonterminal journal is never resumed or retried — it requires manual reconciliation.
      await journal.recordTmuxPhase(deliveryId, 'MANUAL_RECONCILIATION_REQUIRED');
      return { phase: 'MANUAL_RECONCILIATION_REQUIRED', outcome: 'MANUAL_RECONCILIATION_REQUIRED', reason: 'interrupted nonterminal journal' };
    }

    // Owning-profile control is re-checked immediately before EVERY side effect (review B05); a kill/latch
    // engaged after entry stops the next mutation. Before the first preflight nothing is journaled → clean stop.
    if (!(await this.control.isDeliverable())) {
      return { phase: 'PREPARED', outcome: 'STOPPED_BEFORE_PASTE', reason: 'owning control not actionable before preflight' };
    }
    // The bounded first preflight and the one-use authority consumption happen BEFORE any durable tmux journal.
    // A stop here leaves no nonterminal journal (nothing to reconcile) and the authority stays unconsumed.
    const firstPreflight = await port.preflight(destination.paneId);
    if (!preflightMatchesDestination(firstPreflight, destination)) {
      return { phase: 'PREPARED', outcome: 'STOPPED_BEFORE_PASTE', reason: 'destination mismatch at first preflight' };
    }

    // §12.6: create the live capability ONLY after static validation and the first exact preflight.
    const capability = createDeliveryCapability(grant, lease, clock());
    const facts = deliveryJournalFacts(capability);
    // Only an actual, in-bounds capability expiry becomes a controlled expiry outcome. An unparseable clock
    // or any other unexpected error is NOT swallowed — it fails closed and stays visible (review B04).
    const expiry = Date.parse(capability.expiresAt);
    const live = (): boolean => {
      const nowMs = Date.parse(clock());
      if (Number.isNaN(nowMs)) {
        throw new DomainError('INVALID_SCHEMA', 'the trusted delivery clock returned an unparseable timestamp');
      }
      return nowMs < expiry;
    };

    // Committed. Past PREPARED, a non-DELIVERED outcome is never a silent nonterminal journal: it persists
    // MANUAL_RECONCILIATION_REQUIRED immediately, because the no-retry rule forbids resuming it later.
    const manual = async (reason: string): Promise<As1DeliveryResult> => {
      await journal.recordTmuxPhase(deliveryId, 'MANUAL_RECONCILIATION_REQUIRED');
      return { phase: 'MANUAL_RECONCILIATION_REQUIRED', outcome: 'MANUAL_RECONCILIATION_REQUIRED', reason };
    };

    if (!live()) return { phase: 'PREPARED', outcome: 'STOPPED_BEFORE_PASTE', reason: 'capability expired before PREPARED' };
    if (!(await this.control.isDeliverable())) {
      return { phase: 'PREPARED', outcome: 'STOPPED_BEFORE_PASTE', reason: 'owning control not actionable before PREPARED' };
    }

    // Durably record PREPARED (binding the invariant facts) BEFORE consuming authority, so a crash in the
    // consume gap leaves a visible PREPARED (→ manual reconciliation on restart), never an unjournaled
    // consumption (design §12.5/§12.7, review B04).
    await journal.recordTmuxPhase(deliveryId, 'PREPARED', facts);

    // §12.5: consume the grant + lease before the first tmux mutation. An already-consumed authority cannot
    // resume this journal under the no-retry rule, so it is recorded as manual reconciliation, not a silent stop.
    if (!live()) return manual('capability expired before authority consumption');
    if (!(await this.control.isDeliverable())) return manual('owning control not actionable before authority consumption');
    const consumed = await journal.consumeDeliveryAuthority(capability.pointerDeliveryGrantId, capability.leaseId);
    if (!consumed) {
      return manual('delivery authority already consumed');
    }

    if (!(await this.control.isDeliverable())) return manual('owning control not actionable before buffer lookup');
    if (await port.bufferExists(bufferName)) {
      // Cleanup is allowed here because the journal proves paste has not started and the first preflight matched.
      if (!live()) return manual('capability expired before buffer cleanup');
      if (!(await this.control.isDeliverable())) return manual('owning control not actionable before buffer cleanup');
      await port.deleteBuffer(bufferName);
    }
    if (!live()) return manual('capability expired before buffer load');
    if (!(await this.control.isDeliverable())) return manual('owning control not actionable before buffer load');
    await port.loadBuffer(bufferName, pointerFilePath);
    if (!(await this.control.isDeliverable())) return manual('owning control not actionable before BUFFER_LOADED record');
    await journal.recordTmuxPhase(deliveryId, 'BUFFER_LOADED', facts);

    if (!(await this.control.isDeliverable())) return manual('owning control not actionable before second preflight');
    const secondPreflight = await port.preflight(destination.paneId);
    if (!preflightMatchesDestination(secondPreflight, destination)) {
      // A fresh preflight that does not prove the same destination forbids buffer cleanup (design §12.7).
      return manual('destination changed at second preflight');
    }

    if (!live()) return manual('capability expired before paste');
    if (!(await this.control.isDeliverable())) return manual('owning control not actionable before paste');

    // No-retry boundary: record PASTE_STARTED durably before the paste side effect. Past this line, any
    // failure — including an expired capability or an owning-control kill/latch at a fresh check before paste or
    // Enter — is manual reconciliation (the catch below records it; the mutation never repeats).
    await journal.recordTmuxPhase(deliveryId, 'PASTE_STARTED', facts);
    try {
      await this.assertDeliverableOrThrow(); // owning control re-checked immediately before the paste mutation
      assertCapabilityUsable(capability, clock()); // fresh capability check immediately before the paste mutation
      await port.pasteBuffer(bufferName, destination.paneId);
      await this.assertDeliverableOrThrow(); // re-checked before the PASTE_CONFIRMED record
      await journal.recordTmuxPhase(deliveryId, 'PASTE_CONFIRMED', facts);
      await this.assertDeliverableOrThrow(); // re-checked before the SUBMIT_STARTED record
      await journal.recordTmuxPhase(deliveryId, 'SUBMIT_STARTED', facts);
      await this.assertDeliverableOrThrow(); // owning control re-checked immediately before the Enter mutation
      assertCapabilityUsable(capability, clock()); // fresh capability check immediately before the Enter mutation
      await port.sendEnter(destination.paneId);
      await this.assertDeliverableOrThrow(); // re-checked before the terminal TRANSPORT_RECORDED record
      await journal.recordTmuxPhase(deliveryId, 'TRANSPORT_RECORDED', facts);
      return { phase: 'TRANSPORT_RECORDED', outcome: 'DELIVERED', reason: 'ok' };
    } catch (error) {
      // Ambiguous or expired side effect after PASTE_STARTED: never repeat paste or Enter (design §12.7, §11).
      await journal.recordTmuxPhase(deliveryId, 'MANUAL_RECONCILIATION_REQUIRED');
      return {
        phase: 'MANUAL_RECONCILIATION_REQUIRED',
        outcome: 'MANUAL_RECONCILIATION_REQUIRED',
        reason: redactError(error).code,
      };
    }
  }

  /** Re-check the owning-profile control at a post-PASTE_STARTED mutation boundary; a kill/latch throws so the
   * no-retry catch records MANUAL_RECONCILIATION_REQUIRED rather than repeating a paste or Enter (review B05). */
  private async assertDeliverableOrThrow(): Promise<void> {
    if (!(await this.control.isDeliverable())) {
      throw new DomainError('GATEWAY_DISABLED', 'owning control not actionable at a tmux mutation boundary');
    }
  }
}
