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
import { redactError } from '../../../application/slack-pilot/contracts.js';
import type { As1DeliveryCapability, As1TmuxDestination } from './exact-authority.js';

export const AS1_TMUX_JOURNAL_PHASES = [
  'PREPARED',
  'BUFFER_LOADED',
  'PASTE_STARTED',
  'PASTE_CONFIRMED',
  'SUBMIT_STARTED',
  'TRANSPORT_RECORDED',
  'MANUAL_RECONCILIATION_REQUIRED',
] as const;
export type As1TmuxJournalPhase = (typeof AS1_TMUX_JOURNAL_PHASES)[number];

const NO_RETRY_PHASES: readonly string[] = ['PASTE_STARTED', 'PASTE_CONFIRMED', 'SUBMIT_STARTED'];

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
  recordTmuxPhase(deliveryId: string, phase: As1TmuxJournalPhase): Promise<void>;
  readTmuxPhase(deliveryId: string): Promise<string | null>;
  /** Consume the grant + lease exactly once. Returns false if either was already consumed (reuse). */
  consumeDeliveryAuthority(pointerDeliveryGrantId: string, leaseId: string): Promise<boolean>;
}

export type As1DeliveryOutcome = 'DELIVERED' | 'STOPPED_BEFORE_PASTE' | 'MANUAL_RECONCILIATION_REQUIRED';

export interface As1DeliveryResult {
  readonly phase: As1TmuxJournalPhase;
  readonly outcome: As1DeliveryOutcome;
  readonly reason: string;
}

export interface As1DeliveryRequest {
  readonly capability: As1DeliveryCapability;
  readonly deliveryId: string;
  readonly bufferName: string;
  readonly pointerFilePath: string;
  readonly now: string;
  readonly port: As1TmuxPort;
  readonly journal: As1DeliveryJournal;
  readonly assertCapabilityUsable: (capability: As1DeliveryCapability, now: string) => void;
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

export class As1ExactTransport {
  /** Deliver exactly one pointer through the reviewed journal. Never retries a paste (design §12.7). */
  public async deliver(request: As1DeliveryRequest): Promise<As1DeliveryResult> {
    const { capability, deliveryId, bufferName, pointerFilePath, now, port, journal } = request;
    const destination = capability.destination;

    const prior = await journal.readTmuxPhase(deliveryId);
    if (prior !== null && NO_RETRY_PHASES.includes(prior)) {
      await journal.recordTmuxPhase(deliveryId, 'MANUAL_RECONCILIATION_REQUIRED');
      return { phase: 'MANUAL_RECONCILIATION_REQUIRED', outcome: 'MANUAL_RECONCILIATION_REQUIRED', reason: 'paste already started' };
    }
    if (prior === 'MANUAL_RECONCILIATION_REQUIRED' || prior === 'TRANSPORT_RECORDED') {
      return { phase: prior, outcome: prior === 'TRANSPORT_RECORDED' ? 'DELIVERED' : 'MANUAL_RECONCILIATION_REQUIRED', reason: 'terminal' };
    }

    await journal.recordTmuxPhase(deliveryId, 'PREPARED');

    const firstPreflight = await port.preflight(destination.paneId);
    if (!preflightMatchesDestination(firstPreflight, destination)) {
      return { phase: 'PREPARED', outcome: 'STOPPED_BEFORE_PASTE', reason: 'destination mismatch at first preflight' };
    }

    // One-use consumption of the delivery grant + lease, before the first tmux mutation (design §12.5).
    const consumed = await journal.consumeDeliveryAuthority(capability.pointerDeliveryGrantId, capability.leaseId);
    if (!consumed) {
      return { phase: 'PREPARED', outcome: 'STOPPED_BEFORE_PASTE', reason: 'delivery authority already consumed' };
    }

    if (await port.bufferExists(bufferName)) {
      // Cleanup is allowed here because the journal proves paste has not started and the first preflight matched.
      await port.deleteBuffer(bufferName);
    }
    await port.loadBuffer(bufferName, pointerFilePath);
    await journal.recordTmuxPhase(deliveryId, 'BUFFER_LOADED');

    const secondPreflight = await port.preflight(destination.paneId);
    if (!preflightMatchesDestination(secondPreflight, destination)) {
      await port.deleteBuffer(bufferName); // paste has not started; cleanup permitted
      return { phase: 'BUFFER_LOADED', outcome: 'STOPPED_BEFORE_PASTE', reason: 'destination changed at second preflight' };
    }

    request.assertCapabilityUsable(capability, now);

    // No-retry boundary: record PASTE_STARTED durably before the paste side effect.
    await journal.recordTmuxPhase(deliveryId, 'PASTE_STARTED');
    try {
      await port.pasteBuffer(bufferName, destination.paneId);
      await journal.recordTmuxPhase(deliveryId, 'PASTE_CONFIRMED');
      await journal.recordTmuxPhase(deliveryId, 'SUBMIT_STARTED');
      await port.sendEnter(destination.paneId);
      await journal.recordTmuxPhase(deliveryId, 'TRANSPORT_RECORDED');
      return { phase: 'TRANSPORT_RECORDED', outcome: 'DELIVERED', reason: 'ok' };
    } catch (error) {
      // Ambiguous side effect after PASTE_STARTED: never repeat paste or Enter (design §12.7, §11).
      await journal.recordTmuxPhase(deliveryId, 'MANUAL_RECONCILIATION_REQUIRED');
      return {
        phase: 'MANUAL_RECONCILIATION_REQUIRED',
        outcome: 'MANUAL_RECONCILIATION_REQUIRED',
        reason: redactError(error).code,
      };
    }
  }
}
