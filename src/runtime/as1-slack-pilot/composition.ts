// AS1 Multi-Team Slack Pilot — Phase B single-profile foreground live composition (design §5/§6/§9/§10/§11).
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_PHASE_B_LIVE_COMPOSITION_DESIGN_DELTA.md. This composes the
// already-reviewed Phase A modules into the smallest foreground, fail-closed, single-profile runtime for ONE real
// Leo root-to-final-result round trip: one configured workspace and the existing Leo singleton only; two fixed
// App/channel/Advisor profiles selected ONLY by committed authority; exactly one profile active at a time; an
// authenticated Slack quarantine held until a durable receive arm; the frozen receive-grant evidence hashes kept
// distinct from a construction-bound live control/latch predicate; fixed-path Git observation without fetch or
// mutable ref trust; exact selected-profile tmux destination validation and one-use pinned-byte delivery; and a
// clean stop / durable incident-kill lifecycle. It selects NO profile from Slack/CLI/env; the immutable receive
// grant is the only profile selector. It constructs no real Slack/tmux client itself — production wires those in,
// tests wire synthetic fakes — and it reaches no network of its own.
import { randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { DomainError } from '../../contracts/types.js';
import { assertExactKeys, assertRecord } from '../../contracts/validation.js';
import {
  parseContainedPointerRef,
  parseReceiveGrant,
  parsePointerDeliveryGrant,
  redactError,
  type As1PilotReceiveGrantV1,
  type As1PointerDeliveryGrantV1,
} from '../../application/slack-pilot/contracts.js';
import { As1InboundService, type As1ProfileControlPort, type As1ProfileRuntimeContext } from '../../application/slack-pilot/service.js';
import { As1ProfileInboundStore } from '../../application/slack-pilot/inbound-store.js';
import {
  allAs1Profiles,
  selectProfile,
  validateProfileLineage,
  type As1Profile,
} from '../../application/slack-pilot/profiles.js';
import { parseSecretConfigFile, type As1SecretConfig } from '../../adapters/gateways/slack-pilot/secret-config.js';
import {
  As1StartupIdentityVerifier,
  assertPointerGrantSnapshot,
  parseReadinessLease,
  type As1AdvisorReadinessLeaseV1,
  type As1ProfileWireIdentity,
  type As1ReceiveGrantProvenanceGate,
  type As1TmuxDestination,
} from '../../adapters/gateways/slack-pilot/exact-authority.js';
import {
  As1ExactTransport,
  type As1DeliveryProvenanceGate,
  type As1DeliveryResult,
  type As1TmuxObservationPort,
} from '../../adapters/gateways/slack-pilot/exact-transport.js';
import type { As1SocketPort } from '../../adapters/gateways/slack-pilot/socket-client.js';
import type { As1WebPort } from '../../adapters/gateways/slack-pilot/web-client.js';
import {
  AS1_MISSION_AUTHORITY_ROOT,
  type As1AcceptedArtifact,
  type As1GitArtifactObserver,
} from '../../adapters/gateways/slack-pilot/git-artifact-source.js';
import {
  As1EvidenceIngress,
  buildEvidenceAuthority,
  type As1GitProvenanceVerifier,
} from '../../application/slack-pilot/evidence-ingress.js';
import { As1Outbox, userStatusOutboundId, type As1OutboxResult, type As1UserStatusKind } from '../../application/slack-pilot/outbox.js';
import type { AgentOfficeRuntimeIdentity } from '../identity.js';
import { hashCanonical } from '../../persistence/file-store/hashing.js';
import { readStateRootFormat, resolveContainedPath } from '../../persistence/file-store/path-safety.js';
import { AS1_PROFILE_SLUGS, As1SlackControl, type As1ControlCloseOutcome, type As1GlobalState, type As1ProfileSlug } from '../../operations/readiness/as1-slack-control.js';

/**
 * Bind the inbound service's operational control gate to the ONE canonical, lock-owning control for a closed
 * profile slug (review B05). The live receive gate requires EXACTLY the RECEIVING state for this slug; the
 * recovery gate permits only a non-disabled state for this slug; the drain gate permits DISABLED_CLEAN or an
 * active state for this slug. All predicates are synchronous and ownership-safe.
 */
export function controlProfileControlPort(control: As1SlackControl, profileSlug: As1ProfileSlug): As1ProfileControlPort {
  return {
    isReceiveActionable: (): Promise<boolean> => Promise.resolve(control.isReceiveReady(profileSlug)),
    assertReceiveActionable: (): Promise<void> => {
      if (!control.isReceiveReady(profileSlug)) {
        return Promise.reject(new DomainError('GATEWAY_DISABLED', 'profile is not receive-actionable: not RECEIVING for this profile, or closed/killed/latched'));
      }
      return Promise.resolve();
    },
    isReceiveRecoveryActionable: (): Promise<boolean> => Promise.resolve(control.isReceiveRecoveryReady(profileSlug)),
    assertDrainActionable: (): Promise<void> => {
      if (!control.isDrainReady(profileSlug)) {
        return Promise.reject(new DomainError('GATEWAY_DISABLED', 'profile is not drain-actionable: closed/killed/latched or not a drain-permitted state'));
      }
      return Promise.resolve();
    },
    latchProfile: (reasonCode: string): Promise<void> => control.latchProfile(profileSlug, reasonCode),
  };
}

/** Handoff 116: the personal Leo-only runtime uses ONLY this fixed state root; the R2 root and the original root are
 *  never read, reset, modified, copied, or reused in this mode. */
export const AS1_PERSONAL_LEO_ONLY_STATE_ROOT = '/home/leo/.local/state/agent-office/as1-slack-pilot-leo-v1';
/** Handoff 116: the existing canonical mission-local fixed Agent Office Advisor tmux pane. It is a FIXED mission
 *  binding validated once at startup, never a caller/message/environment-selected target. */
const AS1_LEO_ADVISOR_PANE_ID = '%26';
/** The Advisor session/window/workspace the fixed pane must live in (design §9.3 leaseDestinationMatchesProfile). */
const AS1_LEO_ADVISOR_SESSION_NAME = 'agent-office-advisor';
/** Handoff 116 §5: the internal per-message grant/lease are created microseconds before their one-use consumption,
 *  so their bounded lifetimes eliminate every observation gap. Both stay inside the canonical schema ceilings
 *  (grant <= 5 min, lease <= 30 s) enforced by `parsePointerDeliveryGrant` / `parseReadinessLease`. */
const AS1_INTERNAL_GRANT_LIFETIME_MS = 4 * 60 * 1000;
const AS1_INTERNAL_LEASE_LIFETIME_MS = 25 * 1000;
/** Handoff 116 §5 (PERSONAL_LEO_ONLY): the lifetime of an internally-minted single-use receive grant. One grant binds
 *  exactly one root; a fresh grant is minted per message, so this bounds a single round trip (well under the 15-minute
 *  receive-grant ceiling `parseReceiveGrant` enforces) and needs no external response window. */
const AS1_INTERNAL_RECEIVE_GRANT_LIFETIME_MS = 10 * 60 * 1000;

const DESCRIPTOR_SCHEMA_VERSION = 'agent-office.as1-slack-pilot-descriptor.v1' as const;
const DESCRIPTOR_KEYS = ['schemaVersion', 'enabled', 'receiveGrantRef', 'secretFilePath'] as const;

export interface As1RuntimeDescriptorV1 {
  readonly schemaVersion: typeof DESCRIPTOR_SCHEMA_VERSION;
  readonly enabled: boolean;
  readonly receiveGrantRef: string | null;
  readonly secretFilePath: string;
}

/** Parse the committed runtime descriptor. It can never represent a delivery grant, lease, or capability. */
export function parseRuntimeDescriptor(value: unknown): As1RuntimeDescriptorV1 {
  assertRecord(value, 'as1 runtime descriptor');
  assertExactKeys(value, DESCRIPTOR_KEYS, 'as1 runtime descriptor');
  if (value.schemaVersion !== DESCRIPTOR_SCHEMA_VERSION) {
    throw new DomainError('INVALID_SCHEMA', 'as1 runtime descriptor schemaVersion is unsupported');
  }
  if (typeof value.enabled !== 'boolean') {
    throw new DomainError('INVALID_SCHEMA', 'as1 runtime descriptor enabled must be a boolean');
  }
  if (value.receiveGrantRef !== null && typeof value.receiveGrantRef !== 'string') {
    throw new DomainError('INVALID_SCHEMA', 'as1 runtime descriptor receiveGrantRef must be a string or null');
  }
  if (typeof value.secretFilePath !== 'string' || value.secretFilePath.length === 0) {
    throw new DomainError('INVALID_SCHEMA', 'as1 runtime descriptor secretFilePath must be a non-empty string');
  }
  return {
    schemaVersion: DESCRIPTOR_SCHEMA_VERSION,
    enabled: value.enabled,
    receiveGrantRef: value.receiveGrantRef,
    secretFilePath: value.secretFilePath,
  };
}

export type As1ConnectReason =
  | 'GLOBAL_LATCHED'
  | 'PROFILE_LATCHED'
  | 'DISABLED_DEFAULT_NO_AUTHORITY'
  | 'RECEIVE_GRANT_NOT_READY'
  | 'RECEIVING_ARMED';

export interface As1StartResult {
  readonly connected: boolean;
  readonly reason: As1ConnectReason;
  readonly state: As1GlobalState;
}

export interface As1RedactedStatus {
  readonly schemaVersion: 'agent-office.as1-slack-status.v1';
  readonly state: As1GlobalState;
  readonly killEngaged: boolean;
  readonly incidentGateOpen: boolean;
  readonly connected: boolean;
  readonly liveConnection: 'NOT_STARTED' | 'RECEIVING' | 'DRAINED';
}

/**
 * A truthful owner cleanup result (design §11.2/§11.3, F01). Beyond the redacted status it records whether every
 * cleanup step (profile latch, Socket disconnect, drain, fallback global kill, and writer-lock RELEASE) was
 * PROVEN — so the owner never synthesizes a clean `DISABLED_CLEAN` when latch/kill/disconnect/lock-release was
 * ambiguous. `detail` is a stable redacted terminal string; `ambiguities` lists the exact unproved cleanup steps.
 */
export interface As1OwnerCleanupResult extends As1RedactedStatus {
  readonly cleanupProven: boolean;
  readonly lockReleased: boolean;
  /** True when a supposedly-clean drain discovered a pending incident and engaged the durable kill instead of a clean
   *  disable (design §11.2, F01): the owner reports this as an incident kill, never a synthesized clean terminal. */
  readonly incidentDominated: boolean;
  readonly detail: string;
  readonly ambiguities: readonly string[];
}

/** The socket the composition drives: the reviewed transport plus the one-use Phase B receive arm. */
export interface As1CompositionSocketPort extends As1SocketPort {
  armReceive(): void;
}

/** Control-bound socket bindings supplied to `buildSocket` at start (never before the control exists). */
export interface As1SocketBindings {
  readonly latch: (reason: string) => Promise<void>;
  readonly control: () => Promise<boolean>;
}

/**
 * The construction-bound inputs a production receive-grant provenance gate binds (F01/F02): the exact committed
 * receive-grant ref, the trusted (firstAddCommit, blobSha256) pair observed by THIS composition's own Git source,
 * and the parsed grant. The gate's artifact location uses the observed first-add commit; its frozen authority
 * snapshot is the grant's own declared `authoritySourceCommit`. Both are proven read-only, never a Slack value.
 */
export interface As1ReceiveProvenanceInput {
  readonly receiveGrantRef: string;
  readonly accepted: As1AcceptedArtifact;
  readonly grant: As1PilotReceiveGrantV1;
}

/** The construction-bound inputs a production pointer-delivery provenance gate binds (F01), mirroring the receive gate. */
export interface As1DeliveryProvenanceInput {
  readonly deliveryGrantPath: string;
  readonly accepted: As1AcceptedArtifact;
  readonly grant: As1PointerDeliveryGrantV1;
}

/**
 * The composition's injected collaborators. Production wires the real Git source, Slack Web/Socket, and tmux
 * ports plus the real Git provenance gate FACTORIES; a synthetic test wires fakes. NONE is selected per-round-trip
 * and NONE is a Slack/CLI/env value; the immutable receive grant remains the only profile selector. The provenance
 * gates are FACTORIES because a gate's construction-bound artifact location/authority basis are only known after
 * the composition's own trusted Git observation of the grant — so the gate is bound to that observation, never to a
 * pre-observation caller value (review B04 trust-seam property preserved: the composition, not Slack, binds it).
 */
export interface As1CompositionDependencies {
  readonly gitSource: As1GitArtifactObserver;
  readonly web: As1WebPort;
  readonly tmuxPort: As1TmuxObservationPort;
  readonly buildSocket: (bindings: As1SocketBindings) => As1CompositionSocketPort;
  readonly buildReceiveGrantProvenance: (input: As1ReceiveProvenanceInput) => As1ReceiveGrantProvenanceGate;
  readonly buildDeliveryProvenance: (input: As1DeliveryProvenanceInput) => As1DeliveryProvenanceGate;
  readonly evidenceVerifier: As1GitProvenanceVerifier;
  readonly missionAuthorityRoot?: string;
  /** Test-only, inert in production: decorate the internally-opened inbound store BEFORE it is incident-guarded, so an
   *  ordered-deferred test can fire an incident DURING a specific inbound store await (receipt/dedupe/open/…) and prove
   *  the guarded store begins no next side effect. Production callers never supply it. */
  readonly decorateInboundStore?: (store: As1ProfileInboundStore) => As1ProfileInboundStore;
}

interface LiveState {
  readonly profile: As1Profile;
  readonly slug: As1ProfileSlug;
  readonly grant: As1PilotReceiveGrantV1;
  /** The exact committed receive-grant ref (design §4.3) — re-observed with `acceptedReceiveGrant` on every poll (F03). */
  readonly receiveGrantRef: string;
  readonly acceptedReceiveGrant: As1AcceptedArtifact;
  readonly secret: As1SecretConfig;
  readonly wire: As1ProfileWireIdentity;
  readonly store: As1ProfileInboundStore;
  readonly service: As1InboundService;
  readonly socket: As1CompositionSocketPort;
}

/** The composed foreground gateway. It owns the single-process WriterLock through the lock-owning control. */
export class As1GatewayComposition {
  private control: As1SlackControl;
  private closed = false;
  private live: LiveState | null = null;
  private lastIntakeId: string | null = null;
  private receiving = false;
  /** The delivery grant + readiness-lease internally bound (firstAddCommit, blobSha256) pairs, retained ONLY after a
   *  fully-accepted delivery (provenance + binding + expiry + live-actionability), then reused on every later
   *  delivery/evidence re-observation so a post-acceptance rewrite/deletion latches (F03). */
  private acceptedDeliveryGrant: As1AcceptedArtifact | null = null;
  private acceptedLease: As1AcceptedArtifact | null = null;
  /** R2 recovery §5.6.1: once a durable failure barrier is observed, the owner is in a CLOSED failure-only admission
   *  state — `lastIntakeId` is withheld from delivery, retained grant/lease pairs are discarded, and every delivery/
   *  evidence/status/business entry point is refused. The barrier's own durable outbox record recreates this state
   *  (and its deterministic latch) on the next start, so no reset can reinterpret it as delivery/processing authority. */
  private failureAdmission: 'DELIVERY_FAILED_BARRIER' | 'PROCESSING_FAILED_BARRIER' | 'FAILURE_STATUS_CONFLICT' | null = null;
  /** R2 recovery §5.6/§5.8: a NON-DELIVERED status progression (a refused/reconciled ACCEPTED or DELIVERY_CONFIRMED, or
   *  an ACCEPTED recovery that reached REQUEST_STARTED/manual) is terminal for the current run — the profile is durably
   *  latched, the intake/authority is withheld, and no later delivery/evidence/status/business work may begin. Held
   *  separately from a DELIVERY_FAILED/PROCESSING_FAILED barrier (which is its own crash-durable outbox record). */
  private progressionHalted: string | null = null;
  /** The truthful cleanup result of a self-cleaning startup revert (F01), so the owner can report it after start()
   *  rethrows without re-opening the closed composition. Consumed exactly once. */
  private lastCleanup: As1OwnerCleanupResult | null = null;
  /** Handoff 116: the auto-created internal per-message delivery authority (grant + lease) retained after a fully
   *  accepted internal delivery, so the same-message evidence round trip reuses it WITHOUT observing any Git grant. */
  private internalDeliveryGrant: As1PointerDeliveryGrantV1 | null = null;
  private internalLease: As1AdvisorReadinessLeaseV1 | null = null;
  /** Handoff 116 §7 (PERSONAL_LEO_ONLY): a per-message delivery/processing failure posted its FAILED status and is
   *  LOCAL to that message — no profile/global latch. The owner loop consumes this to reset and continue to the next
   *  Leo root. Distinct from `failureAdmission`/`progressionHalted`, which stay reserved for the corruption classes. */
  private personalMessageFailed = false;
  /** Handoff 116 §5 (PERSONAL_LEO_ONLY): monotonic sequence for the per-message minted single-use receive grants, so
   *  each minted grant carries a unique `receiveGrantId` (hence its own immutable binding — no reuse, no key change). */
  private leoRootSeq = 0;

  private constructor(
    private readonly descriptor: As1RuntimeDescriptorV1,
    control: As1SlackControl,
    private readonly stateRoot: string,
    private readonly clock: AgentOfficeRuntimeIdentity,
    private readonly deps: As1CompositionDependencies | null,
    /** Handoff 116: the Founder-approved personal Leo-only runtime mode. Delivery authority is an auto-created, one-use
     *  INTERNAL lease bound to the accepted intake and the fixed startup-validated `agent-office-advisor` destination
     *  (no Git pointer-delivery grant / readiness lease is observed); per-message parse/delivery/work failures are
     *  local to that message and only credential/identity/fixed-destination/durable-state corruption stops the owner. */
    private readonly personalLeoOnly: boolean,
    /** Handoff 116: the state root the PERSONAL_LEO_ONLY gate requires. Production leaves this the exact fixed leo-v1
     *  literal (`AS1_PERSONAL_LEO_ONLY_STATE_ROOT`); a focused test may inject a temporary root through the composition
     *  boundary so the positive paths run WITHOUT touching the live fixed root. Never a caller/env/message value. */
    private readonly expectedPersonalRoot: string,
  ) {
    this.control = control;
  }

  /** Handoff 116: is this composition the Founder-approved personal Leo-only runtime? */
  public isPersonalLeoOnly(): boolean {
    return this.personalLeoOnly;
  }

  /** Handoff 116 §7: has a per-message local failure been recorded (FAILED posted, no latch) awaiting owner reset? */
  public personalMessageFailurePending(): boolean {
    return this.personalMessageFailed;
  }

  /**
   * Open the composition (design §6 step 1). The control PRIVATELY owns the single-process WriterLock, acquired
   * BEFORE any control read/validate/init; the Phase B foreground owner retains its exact close-on-exec descriptor
   * for the process lifetime. With no live dependencies (the Phase A default) the composition only reports state.
   */
  public static async open(
    descriptor: As1RuntimeDescriptorV1,
    options: {
      readonly stateRoot: string;
      readonly clock: AgentOfficeRuntimeIdentity;
      readonly deps?: As1CompositionDependencies;
      /** The foreground owner's post-lock-acquire handler-install hook (design §11.1, F01) — fired after the writer
       *  lock is held but before any lock-owned control initialization. */
      readonly onLockAcquired?: () => void;
      /** Handoff 116: enable the personal Leo-only runtime (internal per-message lease; message-local failures). */
      readonly personalLeoOnly?: boolean;
      /** Handoff 116: the state root the personal Leo-only gate requires. Omitted in production (defaults to the exact
       *  fixed leo-v1 literal, so the production gate is unchanged); a focused test may inject a temporary root so the
       *  positive paths run through the composition boundary WITHOUT touching the live fixed root. */
      readonly expectedPersonalRoot?: string;
    },
  ): Promise<As1GatewayComposition> {
    const foreground = options.deps !== undefined;
    const control = await As1SlackControl.open(options.stateRoot, options.clock, {
      retainLockForForeground: foreground,
      ...(options.onLockAcquired !== undefined ? { onLockAcquired: options.onLockAcquired } : {}),
    });
    return new As1GatewayComposition(
      descriptor,
      control,
      options.stateRoot,
      options.clock,
      options.deps ?? null,
      options.personalLeoOnly === true,
      options.expectedPersonalRoot ?? AS1_PERSONAL_LEO_ONLY_STATE_ROOT,
    );
  }

  /** Is the owned control still open (holding its lock)? Used by the owner to distinguish a reverted start from a
   *  still-live loop error (F01). */
  public isOpen(): boolean {
    return !this.closed && this.control.isOpen();
  }

  /** Synchronously close every incident admission (design §11.2, F01). Called from the SIGUSR2 handler so no new
   *  receive/Git/delivery/evidence/outbound side effect can begin before the durable global kill persists. */
  public closeIncidentGateNow(): void {
    this.control.closeIncidentGate();
  }

  /**
   * Synchronous, construction-bound incident-admission guard (design §11.2, F01). Once the SIGUSR2 handler has closed
   * the incident gate, NO further load-bearing side effect — Git observation, durable transition, secret/store read,
   * Web/Socket identity call, delivery, evidence, outbound, or drain — may begin. Called immediately before every such
   * boundary inside `start()`/`deliverPending()`/`ingestEvidenceAndProject()` (and woven into the startup verifier's
   * supplied provenance/Web/Socket ports); throwing here guarantees zero later work, and the owner routes the pending
   * incident EXACTLY ONCE through the durable incident kill. The thrown code is redacted and never leaks raw detail.
   */
  private assertIncidentAdmissionOpen(): void {
    if (!this.control.isIncidentGateOpen()) {
      throw new DomainError('GATEWAY_DISABLED', 'incident admission is closed; no further side effect may begin');
    }
  }

  /**
   * Run ONE load-bearing async operation with the incident-admission guard checked immediately BEFORE it begins AND
   * immediately AFTER it resolves (design §11.2, F01). This is the single await-boundary primitive used across
   * `start()`/`deliverPending()`/`ingestEvidenceAndProject()` so that a SIGUSR2 which closed admission before or
   * DURING the operation reliably begins NO next side effect (latch, further observation, transition, transport,
   * ingress, or outbound) — no boundary is left to an easily-omitted ad-hoc check. The resolved value is returned only
   * while admission is still open.
   */
  private async guardedAwait<T>(op: () => Promise<T>): Promise<T> {
    this.assertIncidentAdmissionOpen();
    const value = await op();
    this.assertIncidentAdmissionOpen();
    return value;
  }

  /** Wrap the startup verifier's supplied provenance/Web/Socket ports so an incident that closes admission during
   *  `assertAccepted`/`authTest`/`botsInfo`/`connect` deterministically prevents the NEXT verifier operation, without
   *  editing the exact-authority verifier itself (design §11.2, F01). Each guarded call fails closed BEFORE delegating. */
  private incidentGuardedStartupPorts(
    receiveGrantProvenance: As1ReceiveGrantProvenanceGate,
    web: As1WebPort,
    socket: As1SocketPort,
  ): { provenance: As1ReceiveGrantProvenanceGate; web: As1WebPort; socket: As1SocketPort } {
    return {
      provenance: {
        assertAccepted: (grant) => {
          this.assertIncidentAdmissionOpen();
          return receiveGrantProvenance.assertAccepted(grant);
        },
      },
      web: {
        authTest: (token) => {
          this.assertIncidentAdmissionOpen();
          return web.authTest(token);
        },
        botsInfo: (token, botId) => {
          this.assertIncidentAdmissionOpen();
          return web.botsInfo(token, botId);
        },
        postMessage: (token, request) => {
          this.assertIncidentAdmissionOpen();
          return web.postMessage(token, request);
        },
      },
      socket: {
        connect: (input) => {
          this.assertIncidentAdmissionOpen();
          return socket.connect(input);
        },
        onEnvelope: (handler) => socket.onEnvelope(handler),
        disconnect: () => socket.disconnect(),
      },
    };
  }

  /**
   * Wrap a SUPPLIED collaborator port (design §11.2, F01) so EVERY method call fails closed on the incident gate both
   * immediately before it is invoked AND immediately after any returned promise resolves. The exact transport, evidence
   * ingress, and outbox each contain their own internal awaits and later side effects; guarding only the outer call is
   * insufficient. Wrapping the ports they are handed — tmux, delivery journal/store, provenance, verifier, Web,
   * delivery-control — guarantees that an incident during any internal await begins NO next tmux/store/latch/Web/
   * outbound operation, WITHOUT modifying the forbidden collaborator source files.
   */
  private incidentGuardedPort<T extends object>(port: T): T {
    const assertOpen = (): void => this.assertIncidentAdmissionOpen();
    return new Proxy<T>(port, {
      get: (target, property, receiver): unknown => {
        const value: unknown = Reflect.get(target, property, receiver);
        if (typeof value !== 'function') {
          return value;
        }
        const bound = (value as (...callArgs: readonly unknown[]) => unknown).bind(target);
        return (...callArgs: readonly unknown[]): unknown => {
          assertOpen();
          const outcome: unknown = bound(...callArgs);
          return outcome instanceof Promise
            ? outcome.then((resolved: unknown): unknown => {
                assertOpen();
                return resolved;
              })
            : outcome;
        };
      },
    });
  }

  /** Wrap a supplied load-bearing callback (latch/isDeliverable/assertSendable/delay) with the same pre/post
   *  incident-admission guard used for ports (design §11.2, F01). */
  private incidentGuardedCallback<A extends readonly unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
    return async (...args: A): Promise<R> => {
      this.assertIncidentAdmissionOpen();
      const result = await fn(...args);
      this.assertIncidentAdmissionOpen();
      return result;
    };
  }

  /** Consume the truthful cleanup result stored by a self-cleaning startup revert (F01). Returns null if none. */
  public consumeLastCleanup(): As1OwnerCleanupResult | null {
    const cleanup = this.lastCleanup;
    this.lastCleanup = null;
    return cleanup;
  }

  /**
   * Drain (when requested) then RELEASE the writer lock, recording every cleanup ambiguity truthfully (design
   * §11.2/§11.3, F01). It NEVER synthesizes a clean result: `cleanupProven` is true only when the pre-collected steps
   * (latch/disconnect), the drain, any fallback global kill, and the lock RELEASE all succeeded. The redacted
   * `status` is captured before release; a failed release is reflected as `lockReleased: false`.
   */
  private async finishCleanup(drain: boolean, fallbackReason: string, preAmbiguities: readonly string[]): Promise<As1OwnerCleanupResult> {
    const ambiguities: string[] = [...preAmbiguities];
    // F01 (brief 77): a clean drain to DISABLED_CLEAN is permitted ONLY when NOTHING is already ambiguous (empty
    // pre-collected latch/disconnect steps) AND no incident closed admission. Any pre-existing ambiguity, a pending
    // incident, or a drain that could not reach DISABLED_CLEAN forces the DURABLE global kill instead of a masked clean
    // disable. DISABLED_LATCHED is claimed only when the kill actually persists; otherwise the ACTUAL state plus a
    // FALLBACK_KILL/KILL_NOT_ENGAGED ambiguity is reported. (`incidentKill()` passes drain=false and owns its own kill.)
    let incidentDominated = false;
    if (drain) {
      const cleanDrainPermitted = ambiguities.length === 0 && this.control.isIncidentGateOpen();
      if (cleanDrainPermitted) {
        try {
          // The synchronous admission guard stops the internal drain BEFORE the DISABLED_CLEAN transition if an incident
          // closes admission mid-drain; the durable kill below then takes over.
          await this.control.shutdown(() => this.control.isIncidentGateOpen());
        } catch (error) {
          ambiguities.push(`DRAIN:${redactError(error).code}`);
        }
      }
      incidentDominated = !this.control.isIncidentGateOpen();
      // Engage the durable kill unless a fully-clean drain actually reached DISABLED_CLEAN with no ambiguity.
      const drainedClean = ambiguities.length === 0 && !incidentDominated && this.control.getState() === 'DISABLED_CLEAN';
      if (!drainedClean && !this.control.isGloballyLatched()) {
        try {
          if (incidentDominated) {
            await this.control.operatorIncidentKill();
          } else {
            await this.control.engageGlobalKill(fallbackReason);
          }
        } catch (error) {
          ambiguities.push(`${incidentDominated ? 'KILL' : 'FALLBACK_KILL'}:${redactError(error).code}`);
        }
        if (!this.control.isGloballyLatched()) ambiguities.push('KILL_NOT_ENGAGED');
      }
    }
    this.receiving = false;
    let lockReleased = true;
    // F01-B: consume the PHASE-AWARE close outcome. A fallback kill is engaged ONLY when authority is genuinely RETAINED
    // (a pre-unlink release failure while this owner still positively holds the fixed leaf). Once the namespace lock is
    // unlinked or ownership is not proven (`authorityCeased`), the old control MUST perform no durable mutation — a
    // second writer may already hold the freed lock — so the RELEASE/cleanup ambiguity is surfaced with NO fallback kill.
    let closeOutcome: As1ControlCloseOutcome | null = null;
    try {
      closeOutcome = await this.control.close();
    } catch (error) {
      // An UNEXPECTED close error leaves the authority state unknown → fail closed with NO fallback mutation.
      lockReleased = false;
      ambiguities.push(`RELEASE:${redactError(error).code}`);
    }
    if (closeOutcome !== null) {
      if (closeOutcome.authorityCeased) {
        if (closeOutcome.cleanupAmbiguity !== null) {
          lockReleased = false;
          ambiguities.push(`RELEASE:${closeOutcome.cleanupAmbiguity}`);
        }
      } else {
        // Authority RETAINED — the sole writer may durably fallback-kill so a clean DISABLED_CLEAN is never left behind
        // a stuck lock. The ambiguity is PRESERVED (never a clean success) and the lock remains held (flagged limitation).
        lockReleased = false;
        ambiguities.push(`RELEASE:${closeOutcome.cleanupAmbiguity ?? 'RETAINED'}`);
        if (this.control.isOpen() && !this.control.isGloballyLatched()) {
          try {
            await this.control.engageGlobalKill(fallbackReason);
          } catch (killError) {
            ambiguities.push(`FALLBACK_KILL:${redactError(killError).code}`);
          }
          if (!this.control.isGloballyLatched()) ambiguities.push('KILL_NOT_ENGAGED');
        }
      }
    }
    const status = this.status(); // re-observed AFTER close/release + any RETAINED-authority fallback kill (never stale)
    const cleanupProven = ambiguities.length === 0 && lockReleased;
    return {
      ...status,
      cleanupProven,
      lockReleased,
      incidentDominated,
      detail: cleanupProven ? (incidentDominated ? 'INCIDENT_KILL_DOMINATED_CLEANUP' : 'CLEANUP_PROVEN') : `CLEANUP_AMBIGUOUS:${ambiguities.join(',')}`,
      ambiguities,
    };
  }

  /**
   * Latch the active profile on an owner-loop security/store/provenance/tmux/evidence/outbound error, then drain to a
   * clean disabled state and RELEASE ownership truthfully (design §11.2/§11.3, F01). A profile-level ambiguity uses
   * the durable profile latch; an ambiguous drain escalates to the irreversible global kill before release. It never
   * swallows latch/disconnect/kill/lock-release failure into a false clean claim, and never leaves the owner live.
   */
  public async latchActiveProfileAndStop(reasonCode: string): Promise<As1OwnerCleanupResult> {
    this.assertOpen();
    this.closed = true;
    const pre: string[] = [];
    if (this.live !== null) {
      try {
        await this.control.latchProfile(this.live.slug, `owner-loop error: ${reasonCode}`);
      } catch (error) {
        pre.push(`LATCH:${redactError(error).code}`);
      }
      try {
        await this.live.socket.disconnect();
      } catch (error) {
        pre.push(`DISCONNECT:${redactError(error).code}`);
      }
      this.live = null;
    }
    return this.finishCleanup(true, `owner-loop drain ambiguous: ${reasonCode}`, pre);
  }

  private get missionAuthorityRoot(): string {
    return this.deps?.missionAuthorityRoot ?? AS1_MISSION_AUTHORITY_ROOT;
  }

  /**
   * Fail-closed start (design §6). A disabled/latched/unready descriptor reaches no network. With live
   * dependencies, an enabled descriptor runs the exact startup order through Web/Socket identity proof and the
   * durable receive arm, leaving the transport authenticated-quarantined until RECEIVING_ONE_PROFILE is durable.
   */
  public async start(): Promise<As1StartResult> {
    this.assertOpen();
    if (this.control.isGloballyLatched()) {
      return { connected: false, reason: 'GLOBAL_LATCHED', state: this.control.getState() };
    }
    if (!this.descriptor.enabled || this.descriptor.receiveGrantRef === null || this.deps === null) {
      return { connected: false, reason: 'DISABLED_DEFAULT_NO_AUTHORITY', state: this.control.getState() };
    }
    const deps = this.deps;
    const receiveGrantRef = this.descriptor.receiveGrantRef;

    // Handoff 116 §1/§2/§9: the personal Leo-only runtime binds ONLY the fixed leo-v1 state root — never the R2 root or
    // the original root. A wrong root fails closed before any authority is observed. `expectedPersonalRoot` defaults to
    // the exact fixed leo-v1 literal in production (gate unchanged); a focused test injects a temporary root.
    if (this.personalLeoOnly && this.stateRoot !== this.expectedPersonalRoot) {
      return { connected: false, reason: 'DISABLED_DEFAULT_NO_AUTHORITY', state: this.control.getState() };
    }

    // Step 2: observe the fixed committed receive-grant blob (no fetch, no mutable ref trust) and parse it. F01: every
    // load-bearing await in start() is wrapped by `guardedAwait` (incident-admission guard immediately BEFORE and AFTER
    // it), so a SIGUSR2 that closes admission before or during any step begins NO next side effect.
    const observed = await this.guardedAwait(() => deps.gitSource.observe(receiveGrantRef));
    if (observed.status !== 'READY' || observed.bytes === null || observed.firstAddCommit === null || observed.blobSha256 === null) {
      return { connected: false, reason: 'RECEIVE_GRANT_NOT_READY', state: this.control.getState() };
    }
    const grant = parseReceiveGrant(JSON.parse(observed.bytes.toString('utf8')));
    const profile = selectProfile(grant.profileId);
    validateProfileLineage(profile);
    const slug = profile.profileStateSlug;
    const acceptedReceiveGrant: As1AcceptedArtifact = { firstAddCommit: observed.firstAddCommit, blobSha256: observed.blobSha256 };

    // Step 2 (design §6 step 2, F02): BEFORE the first durable authority transition, prove exclusive expiry, the
    // exact contained profile-state-root ref+hash binding + realpath no-follow non-aliasing, the frozen local
    // control/latch snapshots against the EXACT parsed pre-transition records, and FULL receive-grant Git provenance.
    // The provenance gate is bound to the composition's own trusted observation (its location commit is the observed
    // first-add commit) and to INDEPENDENTLY-TRUSTED construction-bound frozen snapshot commits — never a field
    // learned from the candidate grant. Every check here precedes any durable mutation.
    if (!(Date.parse(this.clock.now()) < Date.parse(grant.expiresAt))) {
      return { connected: false, reason: 'RECEIVE_GRANT_NOT_READY', state: this.control.getState() };
    }
    await this.guardedAwait(() => this.assertProfileStateRootBinding(grant, slug));
    const snapshots = await this.guardedAwait(() => this.control.selectedSnapshotHashes(slug));
    if (grant.globalControlSnapshotHash !== snapshots.globalControlHash || grant.profileLatchSnapshotHash !== snapshots.profileLatchHash) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'receive grant frozen control/latch snapshots do not bind the exact pre-transition records');
    }
    const receiveGrantProvenance = deps.buildReceiveGrantProvenance({ receiveGrantRef, accepted: acceptedReceiveGrant, grant });
    await this.guardedAwait(() => receiveGrantProvenance.assertAccepted(grant));

    // handoff 95 F01 (correction 5 / restart): a DURABLE selected-profile latch persisted by a PRIOR run — e.g. its
    // haltProgression or failure barrier — survives restart. Detect it here, AFTER grant/profile resolution and BEFORE
    // any socket build or durable transition, and fail closed truthfully as PROFILE_LATCHED (no socket, no arm, no
    // recovery round trip). This preserves startup ordering, never claims the global kill, and never depends on an
    // in-memory progression-halt flag surviving a restart. The record is initialized for both profiles at establish, so
    // a missing record is a STORE_QUARANTINED fail-closed, never a silent "unlatched".
    if (await this.guardedAwait(() => this.control.isProfileLatched(slug))) {
      return { connected: false, reason: 'PROFILE_LATCHED', state: this.control.getState() };
    }

    // Step 3 (F02.3): the FIRST durable authority transition is now INSIDE the rollback/kill envelope, so a
    // transition/persistence failure at that boundary reverts/closes to a legal clean state and releases ownership —
    // never a half-started durable record reached by the outer owner close.
    let startedSocket: As1CompositionSocketPort | null = null;
    try {
      if (this.control.getState() === 'DISABLED_CLEAN') {
        await this.guardedAwait(() => this.control.transition('DISABLED_CLEAN', 'DISABLED_DEFAULT'));
      }
      await this.guardedAwait(() => this.control.transition('DISABLED_DEFAULT', 'RECEIVE_GRANTED_ONE_PROFILE', slug));

      // Step 4: parse the owner-only secret, prove one shared workspace + the sole Leo identity + cross-profile
      // separation, and retain ONLY the selected profile's wire identity.
      const secret = await this.guardedAwait(() => parseSecretConfigFile(this.descriptor.secretFilePath));
      this.assertGrantMatchesSecret(grant, secret);
      const profileSecret = secret.secretFor(grant.profileId);
      const wire: As1ProfileWireIdentity = {
        workspaceId: secret.getWorkspaceId(),
        appId: profileSecret.appId,
        channelId: profileSecret.channelId,
        leoUserId: secret.getLeoUserId(),
        botToken: profileSecret.botToken,
        appToken: profileSecret.appToken,
      };

      // Step 5: open the selected store, replay receive-grant state, construct the service, build and bind the Socket.
      const store = await this.guardedAwait(() => As1ProfileInboundStore.open(this.stateRoot, profile, this.clock));
      await this.guardedAwait(() => store.initReceiveGrantState(grant));
      const gate = controlProfileControlPort(this.control, slug);
      const context: As1ProfileRuntimeContext = {
        profile,
        workspaceId: wire.workspaceId,
        appId: wire.appId,
        channelId: wire.channelId,
        leoUserId: wire.leoUserId,
        botUserId: '',
        now: () => this.clock.now(),
      };
      // The bot user id is resolved by startup identity proof below; the context is finalized once known.
      const socket = deps.buildSocket({
        latch: (reason: string) => this.control.latchProfile(slug, reason),
        control: () => Promise.resolve(this.control.isReceiveReady(slug)),
      });
      startedSocket = socket;

      // Step 6/7: durably AUTHENTICATE, prove auth.test/bots.info/hello identity, and leave AUTHENTICATED_QUARANTINE.
      // The verifier re-runs the same construction-bound provenance gate (idempotent, defense in depth) plus the
      // fresh-clock connect gate and Web/Socket identity proof.
      await this.guardedAwait(() => this.control.transition('RECEIVE_GRANTED_ONE_PROFILE', 'AUTHENTICATING_ONE_PROFILE'));
      // F01: guard the verifier's supplied provenance/Web/Socket ports so an incident inside assertAccepted/authTest/
      // botsInfo/connect deterministically prevents the NEXT verifier operation (exact-authority.ts stays unmodified);
      // `guardedAwait` additionally re-checks immediately AFTER verify(), before the service/onEnvelope registration.
      const guardedPorts = this.incidentGuardedStartupPorts(receiveGrantProvenance, deps.web, socket);
      const verifier = new As1StartupIdentityVerifier(
        () => this.clock.now(),
        guardedPorts.provenance,
        () => this.control.liveControlSnapshotHash(),
        () => this.control.isConnectReady(slug),
      );
      const proof = await this.guardedAwait(() => verifier.verify({ profile, wire, grant, web: guardedPorts.web, socket: guardedPorts.socket }));
      const boundContext: As1ProfileRuntimeContext = { ...context, botUserId: proof.botUserId };
      // F01-A: construction-bind the incident guard to the ACTUAL inbound-service collaborators — the durable inbound
      // store, the control gate, and the live Slack ACK on each delivered envelope — so an incident during any of the
      // service's internal receipt/dedupe/open-transport/ACK/pre-ACK-recovery/materialization awaits rejects BEFORE the
      // service begins its next store/transport/ACK/bind/consume/Slack side effect. The As1InboundService contract and
      // source are unchanged; this reuses the same construction-bound `incidentGuardedPort`/`incidentGuardedCallback`
      // pattern applied to the startup verifier / transport / evidence / outbox ports.
      const inboundStore = deps.decorateInboundStore !== undefined ? deps.decorateInboundStore(store) : store;
      const service = new As1InboundService(boundContext, grant, this.incidentGuardedPort(inboundStore), this.incidentGuardedPort(gate));
      socket.onEnvelope(async (envelope) => {
        const result = await service.processEnvelope({
          ...envelope,
          acknowledge: this.incidentGuardedCallback(() => envelope.acknowledge()),
        });
        // R2 recovery §5.7 ACCEPTED: ONLY a NEW_MISSION_ROOT with a durably materialized intake triggers the first
        // status. While the failure siblings are still OPEN, send ACCEPTED through RESPONSE_RECORDED BEFORE exposing the
        // intake to delivery — a rejected/duplicate/continuation/bot/wrong-user/wrong-channel/malformed event sends none.
        if (result.classification === 'NEW_MISSION_ROOT' && result.intakeId !== null) {
          const liveState = this.live;
          if (liveState === null) return;
          const intakeId = result.intakeId;
          const classification = await this.classifyFailureSiblings(liveState, intakeId);
          if (classification !== 'OPEN') {
            await this.enterFailureBarrier(liveState, classification);
            return;
          }
          const accepted = await this.sendUserStatus(liveState, deps, intakeId, 'ACCEPTED');
          // Expose the intake to deliverPending ONLY after ACCEPTED is durably RESPONSE_RECORDED. A non-DELIVERED
          // ACCEPTED is terminal for this run: latch, withhold the intake, and never substitute another status (§5.6/§5.8).
          if (accepted.outcome === 'DELIVERED') {
            this.lastIntakeId = intakeId;
          } else {
            await this.haltProgression(liveState, `accepted-status-${accepted.outcome}`);
          }
          return;
        }
        if (result.intakeId !== null) this.lastIntakeId = result.intakeId;
      });

      // Step 8: durably transition to RECEIVING, recheck the selected facts, then one-use arm receive.
      await this.guardedAwait(() => this.control.transition('AUTHENTICATING_ONE_PROFILE', 'RECEIVING_ONE_PROFILE'));
      if (!this.control.isReceiveReady(slug)) {
        throw new DomainError('GATEWAY_DISABLED', 'control is not receive-ready immediately before arm');
      }
      // Step 9: BIND the live state, run bounded recovery, then R2 terminal-status inspection, and finally arm. Live is
      // bound BEFORE recovery/arm so the status/delivery context (and a held frame dispatched synchronously during arm)
      // always has it.
      this.live = {
        profile,
        slug,
        grant,
        receiveGrantRef,
        acceptedReceiveGrant,
        secret,
        wire,
        store,
        service,
        socket,
      };
      // Handoff 116 §2/§7: the personal Leo-only runtime validates the fixed agent-office-advisor tmux destination
      // ONCE here — before recovery, intake exposure, and arm. A binding mismatch fails closed with a durable global
      // kill (owner stop), so no message is ever received against a corrupt fixed destination.
      if (this.personalLeoOnly) {
        await this.validateFixedAdvisorDestination(this.live, deps);
        // Mint the FIRST single-use grant before any message, so every root binds a distinct minted grant (restart-safe;
        // the fixed startup grant is the authority template and is never itself bound to a root).
        this.swapInFreshReceiveGrant();
      }
      await this.guardedAwait(() => service.recoverPending());
      this.assertIncidentAdmissionOpen(); // F01: NEVER arm live receive after an incident has closed admission (sync op)
      // R2 recovery §5.7: terminal-status inspection is the FIRST post-store recovery decision — before Socket arm,
      // intake exposure, and any delivery/evidence/status/business work. A durably materialized intake with a failure
      // barrier is handled exactly as §5.6.1 (the owner loop then halts); only an OPEN classification replays ACCEPTED
      // and exposes the intake to delivery.
      await this.recoverTerminalStatusAndAccepted(this.live, deps);
      // handoff 95 F01: a durable failure barrier OR a halted progression raised DURING recovery (e.g., an ACCEPTED
      // recovery that reached REQUEST_STARTED/manual) MUST NOT arm Socket receive or enter the live loop. Refuse arm and
      // return NOT connected so the owner releases ownership truthfully instead of running a live round trip. Both
      // enterFailureBarrier and haltProgression durably latch THIS profile at recovery (the control is already
      // RECEIVING_ONE_PROFILE), so the truthful reason is PROFILE_LATCHED — NEVER the global kill/latch (correction 5).
      if (this.hasFailureBarrier()) {
        this.receiving = false;
        return { connected: false, reason: 'PROFILE_LATCHED', state: this.control.getState() };
      }
      this.receiving = true;
      socket.armReceive();
      return { connected: true, reason: 'RECEIVING_ARMED', state: this.control.getState() };
    } catch (error) {
      // F02: revert every later startup failure to the legal clean state and release ownership; leave NO actionable
      // half-started durable state. An unclean/ambiguous revert engages the durable global kill before releasing.
      await this.revertStartupFailure(startedSocket);
      throw error;
    }
  }

  /**
   * Revert a post-transition startup failure and RELEASE ownership truthfully (design §6, §11.2/§11.3; F01/F02). It
   * disconnects any quarantined Socket; if a SIGUSR2 incident closed the admission gate during startup it routes to
   * the durable incident kill (never a clean rollback); otherwise it rolls back to the legal disabled state,
   * escalating to the irreversible global kill on an ambiguous rollback. Every cleanup ambiguity is recorded into
   * `lastCleanup` (consumed by the owner), so a startup failure is never reported as a synthesized clean state. It
   * never throws over the original startup error.
   */
  private async revertStartupFailure(socket: As1CompositionSocketPort | null): Promise<void> {
    const ambiguities: string[] = [];
    if (socket !== null) {
      try {
        await socket.disconnect();
      } catch (error) {
        ambiguities.push(`DISCONNECT:${redactError(error).code}`);
      }
    }
    this.receiving = false;
    this.live = null;
    this.closed = true;
    let incidentDominated = !this.control.isIncidentGateOpen();
    if (incidentDominated) {
      // A SIGUSR2 incident closed the gate during startup → durable kill, never a clean rollback.
      try {
        await this.control.operatorIncidentKill();
      } catch (error) {
        ambiguities.push(`KILL:${redactError(error).code}`);
      }
      if (!this.control.isGloballyLatched()) ambiguities.push('KILL_NOT_ENGAGED');
    } else {
      try {
        // The rollback carries the synchronous admission guard through its internal drain transitions.
        await this.control.rollbackToDisabled(() => this.control.isIncidentGateOpen());
      } catch (error) {
        ambiguities.push(`ROLLBACK:${redactError(error).code}`);
        try {
          await this.control.engageGlobalKill(`ambiguous startup revert: ${redactError(error).code}`);
        } catch (killError) {
          ambiguities.push(`FALLBACK_KILL:${redactError(killError).code}`);
        }
      }
      // F01: an incident that closed admission DURING the rollback transitions dominates the clean revert.
      if (!this.control.isIncidentGateOpen()) {
        incidentDominated = true;
        try {
          await this.control.operatorIncidentKill();
        } catch (error) {
          ambiguities.push(`KILL:${redactError(error).code}`);
        }
        if (!this.control.isGloballyLatched()) ambiguities.push('KILL_NOT_ENGAGED');
      }
    }
    const status = this.status();
    let lockReleased = true;
    // F01-B: consume the phase-aware close outcome. The revert already engaged any needed durable kill/rollback above,
    // so NO additional fallback mutation runs here — a non-clean release only surfaces the RELEASE/cleanup ambiguity.
    try {
      const closeOutcome = await this.control.close();
      if (!closeOutcome.authorityCeased || closeOutcome.cleanupAmbiguity !== null) {
        lockReleased = false;
        ambiguities.push(`RELEASE:${closeOutcome.cleanupAmbiguity ?? 'RETAINED'}`);
      }
    } catch (error) {
      lockReleased = false;
      ambiguities.push(`RELEASE:${redactError(error).code}`);
    }
    const cleanupProven = ambiguities.length === 0 && lockReleased;
    this.lastCleanup = {
      ...status,
      cleanupProven,
      lockReleased,
      incidentDominated,
      detail: cleanupProven ? (incidentDominated ? 'INCIDENT_KILL_DOMINATED_CLEANUP' : 'CLEANUP_PROVEN') : `CLEANUP_AMBIGUOUS:${ambiguities.join(',')}`,
      ambiguities,
    };
  }

  /** The intake id the socket handler recorded for the one accepted root (design §7). */
  public lastIntake(): string | null {
    return this.lastIntakeId;
  }

  /**
   * Handoff 116 §5 (PERSONAL_LEO_ONLY): internally mint ONE fresh single-use receive grant, derived from the
   * startup-validated grant. It copies every startup-validated authority/binding field unchanged and overrides ONLY a
   * fresh unique `receiveGrantId` (so it earns its own immutable single-root binding — no reuse, no slot reopen, no
   * key change) and a fresh short lifetime. It requires no manual grant, caller input, env target, or response window,
   * and `parseReceiveGrant` re-validates the exact schema/expiry ceilings. One grant binds exactly one root.
   */
  private mintNextReceiveGrant(previous: As1PilotReceiveGrantV1): As1PilotReceiveGrantV1 {
    this.leoRootSeq += 1;
    const nowIso = this.clock.now();
    const nowMs = Date.parse(nowIso);
    // The id must be fresh across PROCESS RESTARTS (the in-memory sequence alone resets to 0 on restart and would
    // collide with a prior process's durable binding). `randomUUID` is the standard primitive for a globally-fresh id
    // — no schema/key/path change — so every minted grant owns a distinct immutable single-root binding.
    return parseReceiveGrant({
      ...previous,
      receiveGrantId: `as1-leo-rg-${this.leoRootSeq}-${randomUUID()}`,
      issuedAt: nowIso,
      expiresAt: new Date(nowMs + AS1_INTERNAL_RECEIVE_GRANT_LIFETIME_MS).toISOString(),
    });
  }

  /** Handoff 116 §5 (PERSONAL_LEO_ONLY): mint a fresh single-use receive grant and swap it into the live service + live
   *  state, so the NEXT root binds a distinct grant (one grant = one root). Called once before the first message (at
   *  startup) and after every completed round trip. */
  private swapInFreshReceiveGrant(): void {
    const live = this.live;
    if (live === null) return;
    const next = this.mintNextReceiveGrant(live.grant);
    live.service.useReceiveGrant(next);
    this.live = { ...live, grant: next };
  }

  /** Handoff 116 (PERSONAL_LEO_ONLY): the active minted receive-grant id, for restart-freshness assertions. */
  public currentReceiveGrantId(): string | null {
    return this.live?.grant.receiveGrantId ?? null;
  }

  /**
   * Handoff 116 §1/§7 (PERSONAL_LEO_ONLY): after a round trip completes (RESULT delivered) OR a per-message failure
   * posts its FAILED status, clear ONLY this message's transient authority/progression state and mint + swap in a
   * fresh single-use receive grant for the next root, so the owner remains running and accepts the next valid Leo root
   * sequentially. No profile/global latch, no durable barrier — those stay reserved for the corruption classes.
   */
  public resetForNextLeoRoot(): void {
    this.lastIntakeId = null;
    this.internalDeliveryGrant = null;
    this.internalLease = null;
    this.acceptedDeliveryGrant = null;
    this.acceptedLease = null;
    this.personalMessageFailed = false;
    this.swapInFreshReceiveGrant();
  }

  /**
   * Handoff 116 §2/§7: validate the fixed `agent-office-advisor` tmux destination ONCE at startup. The live `%26`
   * pane must be observable (a missing/dead/in-mode/input-off pane makes `observe` fail closed → clean startup
   * revert) AND bind the selected profile's session/workspace/command. A binding mismatch is fixed-destination
   * corruption: engage the durable global kill (owner stop) and fail closed before any receive — never a per-message
   * local failure. The pane id is the fixed mission binding, never a caller/message/environment value.
   */
  private async validateFixedAdvisorDestination(live: LiveState, deps: As1CompositionDependencies): Promise<As1TmuxDestination> {
    const observed = await this.guardedAwait(() => deps.tmuxPort.observe(AS1_LEO_ADVISOR_PANE_ID));
    if (
      observed.paneId !== AS1_LEO_ADVISOR_PANE_ID ||
      observed.sessionName !== AS1_LEO_ADVISOR_SESSION_NAME ||
      observed.sessionName !== live.profile.sessionName ||
      observed.workspace !== live.profile.workspace ||
      observed.currentCommand !== live.profile.currentCommand
    ) {
      await this.guardedAwait(() => this.control.engageGlobalKill('fixed agent-office-advisor destination does not bind the selected profile'));
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'fixed advisor tmux destination failed identity/profile validation');
    }
    // Return the globally-validated observation so every delivery-time use of the fixed destination (the internal
    // lease build below) reuses THIS validated pane — never a second raw, unvalidated observe.
    return observed;
  }

  /**
   * Handoff 116 §5: construct the internal per-message delivery authority — a pointer-delivery grant + one-use
   * readiness lease built entirely in memory from already-trusted inputs: the startup-validated receive grant
   * (`live.grant`), the durable accepted intake's materialized pointer, and the startup-validated fixed
   * `agent-office-advisor` destination observed LIVE at `%26`. It needs no Git grant, Leo approval, or short expiry
   * race (created microseconds before its one-use consumption) and grants no arbitrary shell authority: the
   * destination is the fixed observed pane, never a caller/message/environment value. The constructed pair is
   * validated by the canonical parsers and delivered through the SAME exact transport as the Git path, so every
   * downstream chain/binding/snapshot/destination/live-actionability invariant still holds unchanged.
   */
  private async buildInternalDeliveryAuthority(
    live: LiveState,
    deps: As1CompositionDependencies,
    intakeId: string,
  ): Promise<{ readonly grant: As1PointerDeliveryGrantV1; readonly lease: As1AdvisorReadinessLeaseV1 }> {
    const receiveGrant = live.grant;
    const state = await live.store.readReceiveGrantState(receiveGrant.receiveGrantId);
    const root = await live.store.findRootByIntakeId(intakeId);
    if (state === null || root === null) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'internal delivery authority requires the durable receive-grant state and intake root');
    }
    const rootCorrelationHash = hashCanonical({
      rootKeyHash: root.rootKeyHash,
      bindingStateHash: root.bindingStateHash,
      sourceEventId: root.sourceEventId,
      rootTs: root.rootTs,
      intakeId,
    });
    const deliveryId = `as1p-${hashCanonical({ intakeId }).slice('sha256:'.length, 'sha256:'.length + 40)}`;
    const pointerDir = path.join(this.stateRoot, 'artifacts/as1-slack-pilot', live.profile.profileStateSlug, 'pointers', deliveryId);
    const [pointerFile] = await readdir(pointerDir);
    if (pointerFile === undefined) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'internal delivery authority requires the materialized accepted pointer');
    }
    const pointerArtifactRef = `artifacts/as1-slack-pilot/${live.profile.profileStateSlug}/pointers/${deliveryId}/${pointerFile}`;
    const pointerHash = `sha256:${pointerFile.replace('.json', '')}`;
    // Observe the fixed destination LIVE at delivery time through the SAME global identity/profile validator, so a
    // corrupt second observation engages the global kill and fails closed GLOBALLY (never downgraded to a message-local
    // STOPPED_BEFORE_PASTE). All 15 facts of this validated pane are what the transport re-observes and compares.
    const destination = await this.validateFixedAdvisorDestination(live, deps);
    const nowIso = this.clock.now();
    const nowMs = Date.parse(nowIso);
    const grantExpiresAt = new Date(nowMs + AS1_INTERNAL_GRANT_LIFETIME_MS).toISOString();
    const leaseExpiresAt = new Date(nowMs + AS1_INTERNAL_LEASE_LIFETIME_MS).toISOString();
    const idSuffix = hashCanonical({ intakeId }).slice('sha256:'.length, 'sha256:'.length + 24);
    const grant = parsePointerDeliveryGrant({
      schemaVersion: 'agent-office.as1-pointer-delivery-grant.v1',
      pointerDeliveryGrantId: `as1-pdg-leo-${idSuffix}`,
      receiveGrantId: receiveGrant.receiveGrantId,
      receiveGrantBindingHash: state.stateHash,
      pilotId: receiveGrant.pilotId,
      profileId: receiveGrant.profileId,
      intakeId,
      sourceEventId: root.sourceEventId,
      rootCorrelationHash,
      pointerArtifactRef,
      pointerHash,
      advisorTeam: live.profile.advisorTeam,
      actorId: live.profile.actorId,
      roleInstanceId: live.profile.roleInstanceId,
      evidencePrefix: `${this.missionAuthorityRoot}/runtime-evidence/${live.profile.profileStateSlug}`,
      governanceSnapshotHash: receiveGrant.governanceSnapshotHash,
      registrySnapshotHash: receiveGrant.registrySnapshotHash,
      globalControlSnapshotHash: receiveGrant.globalControlSnapshotHash,
      profileLatchSnapshotHash: receiveGrant.profileLatchSnapshotHash,
      authorityRepositoryId: receiveGrant.authorityRepositoryId,
      authorityRootId: receiveGrant.authorityRootId,
      authoritySourceCommit: receiveGrant.authoritySourceCommit,
      issuedAt: nowIso,
      expiresAt: grantExpiresAt,
      useLimit: 1,
    });
    const lease = parseReadinessLease({
      schemaVersion: 'agent-office.as1-advisor-readiness-lease.v1',
      leaseId: `as1-lease-leo-${idSuffix}`,
      pointerDeliveryGrantId: grant.pointerDeliveryGrantId,
      receiveGrantId: grant.receiveGrantId,
      pilotId: grant.pilotId,
      profileId: grant.profileId,
      intakeId,
      sourceEventId: root.sourceEventId,
      pointerHash,
      advisorTeam: live.profile.advisorTeam,
      actorId: live.profile.actorId,
      roleInstanceId: live.profile.roleInstanceId,
      destination,
      readiness: 'IDLE_FOR_ONE_AS1_POINTER',
      useLimit: 1,
      observedAt: nowIso,
      issuedAt: nowIso,
      expiresAt: leaseExpiresAt,
      authoritySnapshotHash: grant.governanceSnapshotHash,
      registrySnapshotHash: grant.registrySnapshotHash,
      receiveGrantBindingHash: grant.receiveGrantBindingHash,
      pointerDeliveryGrantSnapshotHash: hashCanonical(grant),
    });
    return { grant, lease };
  }

  /**
   * Post-intake delivery (design §9). After the intake + pointer are durable, poll the construction-bound mission
   * authority root for the pointer-delivery grant and the sibling readiness lease, require the live predicate, and
   * perform exactly one pinned-byte tmux attempt through the reviewed journal. Absence is AWAITING, never approval.
   */
  public async deliverPending(): Promise<As1DeliveryResult | { readonly phase: 'AWAITING'; readonly outcome: 'AWAITING_POINTER_DELIVERY_GRANT' | 'AWAITING_READINESS_LEASE'; readonly reason: string }> {
    const live = this.requireLive();
    const deps = this.requireDeps();
    // R2 recovery §5.6.1/§5.7: a durable failure barrier or a halted status progression refuses every delivery entry
    // point — observe no grant/lease, reuse no authority, and begin no tmux side effect. The owner loop halts on it.
    if (this.hasFailureBarrier()) {
      return { phase: 'AWAITING', outcome: 'AWAITING_POINTER_DELIVERY_GRANT', reason: 'failure-only admission — no delivery' };
    }
    const intakeId = this.lastIntakeId;
    if (intakeId === null) {
      return { phase: 'AWAITING', outcome: 'AWAITING_POINTER_DELIVERY_GRANT', reason: 'no intake yet' };
    }
    // §5.7: RE-READ the durable failure classifier at entry, BEFORE observing any pointer-grant / readiness-lease
    // authority — a barrier record that appeared since the last tick enters the barrier and begins no observation.
    const entryClassification = await this.classifyFailureSiblings(live, intakeId);
    if (entryClassification !== 'OPEN') {
      await this.enterFailureBarrier(live, entryClassification);
      return { phase: 'AWAITING', outcome: 'AWAITING_POINTER_DELIVERY_GRANT', reason: 'failure barrier at delivery entry' };
    }
    // Handoff 116 §2/§7 (P1): re-validate the fixed agent-office-advisor destination at delivery. A fixed-destination /
    // identity / profile mismatch is a CORRUPTION class — it engages the durable global kill and fails closed GLOBALLY
    // (never message-local), BEFORE the internal authority is built or any ordinary per-message failure can be posted.
    if (this.personalLeoOnly) {
      await this.validateFixedAdvisorDestination(live, deps);
    }
    // The delivery authority is either observed from the construction-bound Git mission root (default) or, in the
    // personal Leo-only runtime, constructed and trusted in memory (handoff 116 §5). Both feed the SAME exact
    // transport below; only the leo-only retain path (§5 one-use) differs.
    let deliveryGrant: As1PointerDeliveryGrantV1;
    let lease: As1AdvisorReadinessLeaseV1;
    let deliveryProvenance: As1DeliveryProvenanceGate;
    let provisionalDeliveryGrant: As1AcceptedArtifact | null = null;
    let provisionalLease: As1AcceptedArtifact | null = null;
    if (this.personalLeoOnly) {
      // Handoff 116 §5: build the internal per-message grant/lease from already-trusted inputs; the fixed observed
      // destination and startup-validated receive grant supply the trust the Git provenance gate would otherwise
      // prove, so `assertAccepted` is satisfied by construction. Every OTHER transport invariant still runs.
      const authority = await this.guardedAwait(() => this.buildInternalDeliveryAuthority(live, deps, intakeId));
      deliveryGrant = authority.grant;
      lease = authority.lease;
      deliveryProvenance = { assertAccepted: () => Promise.resolve() };
    } else {
      const base = `${this.missionAuthorityRoot}/runtime-authority/${live.slug}/${intakeId}`;
      const deliveryGrantPath = `${base}/pointer-delivery-grant.json`;
      // F03: re-observe the pointer-delivery grant with its internally bound accepted pair (once captured) so a
      // post-acceptance rewrite/deletion/ancestry reuse latches instead of silently re-accepting. F01: `guardedAwait`
      // guards incident admission BEFORE and AFTER every observation/latch/transport await below.
      const grantObs = await this.guardedAwait(() => deps.gitSource.observe(deliveryGrantPath, this.acceptedDeliveryGrant ?? undefined));
      if (grantObs.status === 'DIVERGED') {
        await this.guardedAwait(() => this.control.latchProfile(live.slug, `pointer-delivery grant diverged post-acceptance: ${grantObs.reason}`));
        return { phase: 'MANUAL_RECONCILIATION_REQUIRED', outcome: 'MANUAL_RECONCILIATION_REQUIRED', reason: 'DELIVERY_GRANT_DIVERGED' };
      }
      if (grantObs.status !== 'READY' || grantObs.bytes === null || grantObs.firstAddCommit === null || grantObs.blobSha256 === null) {
        return { phase: 'AWAITING', outcome: 'AWAITING_POINTER_DELIVERY_GRANT', reason: grantObs.reason };
      }
      deliveryGrant = parsePointerDeliveryGrant(JSON.parse(grantObs.bytes.toString('utf8')));
      this.assertDeliveryGrantBinding(deliveryGrant, live);
      // F03: the observed delivery-grant + lease pairs stay PROVISIONAL — retained only AFTER the transport's full
      // provenance/binding/expiry/live-actionability acceptance below, never merely on observation.
      provisionalDeliveryGrant = { firstAddCommit: grantObs.firstAddCommit, blobSha256: grantObs.blobSha256 };
      // F03: the readiness lease is re-observed with its own accepted pair (once retained) so a post-acceptance
      // rewrite/deletion/dirty lease latches instead of silently re-accepting or classifying as benign NOT_READY.
      const leaseObs = await this.guardedAwait(() => deps.gitSource.observe(`${base}/readiness-lease.json`, this.acceptedLease ?? undefined));
      if (leaseObs.status === 'DIVERGED') {
        await this.guardedAwait(() => this.control.latchProfile(live.slug, `readiness lease diverged post-acceptance: ${leaseObs.reason}`));
        return { phase: 'MANUAL_RECONCILIATION_REQUIRED', outcome: 'MANUAL_RECONCILIATION_REQUIRED', reason: 'READINESS_LEASE_DIVERGED' };
      }
      if (leaseObs.status !== 'READY' || leaseObs.bytes === null || leaseObs.firstAddCommit === null || leaseObs.blobSha256 === null) {
        return { phase: 'AWAITING', outcome: 'AWAITING_READINESS_LEASE', reason: leaseObs.reason };
      }
      provisionalLease = { firstAddCommit: leaseObs.firstAddCommit, blobSha256: leaseObs.blobSha256 };
      lease = parseReadinessLease(JSON.parse(leaseObs.bytes.toString('utf8')));
      // Build the one-use exact transport bound to the freshly-constructed delivery provenance gate. The gate proves
      // full provenance/binding/expiry inside deliver(); the live-actionability predicate follows. Fresh per attempt —
      // the durable journal, not the instance, enforces no-retry.
      deliveryProvenance = deps.buildDeliveryProvenance({ deliveryGrantPath, accepted: provisionalDeliveryGrant, grant: deliveryGrant });
    }
    // F01: EVERY port/callback handed to the exact transport is incident-guarded, so an incident during any internal
    // await inside deliver() (provenance, journal read/write, actionability, or a latch) begins no next tmux paste or
    // durable write. The forbidden `exact-transport.ts` is unmodified.
    // Handoff 116 §2/§7 (P1): in PERSONAL_LEO_ONLY the exact transport's OWN re-observations of the fixed pane must run
    // through the SAME global identity/profile validator — a corrupt transport observation engages the durable global
    // kill and fails closed GLOBALLY, never downgraded to a message-local STOPPED_BEFORE_PASTE. The other five tmux
    // operations delegate unchanged to the live port. Default mode passes the original port untouched.
    const transportTmuxPort: As1TmuxObservationPort = this.personalLeoOnly
      ? {
          observe: () => this.validateFixedAdvisorDestination(live, deps),
          bufferExists: (bufferName) => deps.tmuxPort.bufferExists(bufferName),
          loadVerifiedBuffer: (bufferName, pinnedBytes) => deps.tmuxPort.loadVerifiedBuffer(bufferName, pinnedBytes),
          pasteBuffer: (bufferName, paneId) => deps.tmuxPort.pasteBuffer(bufferName, paneId),
          sendEnter: (paneId) => deps.tmuxPort.sendEnter(paneId),
          deleteBuffer: (bufferName) => deps.tmuxPort.deleteBuffer(bufferName),
        }
      : deps.tmuxPort;
    const transport = new As1ExactTransport(
      () => this.clock.now(),
      this.stateRoot,
      live.profile,
      this.incidentGuardedPort(transportTmuxPort),
      this.incidentGuardedPort(live.store),
      this.incidentGuardedPort(deliveryProvenance),
      { isDeliverable: this.incidentGuardedCallback(() => Promise.resolve(this.control.isLiveDeliveryActionable(live.slug))) },
      this.incidentGuardedCallback((reason: string) => this.control.latchProfile(live.slug, reason)),
    );
    // §5.7: RE-READ the durable failure classifier IMMEDIATELY BEFORE invoking exact transport — a barrier that appeared
    // during grant/lease observation must begin no tmux paste. F01: incident admission is re-checked by guardedAwait.
    const beforeTransport = await this.classifyFailureSiblings(live, intakeId);
    if (beforeTransport !== 'OPEN') {
      await this.enterFailureBarrier(live, beforeTransport);
      return { phase: 'AWAITING', outcome: 'AWAITING_POINTER_DELIVERY_GRANT', reason: 'failure barrier before transport' };
    }
    // F01: NEVER begin the exact tmux paste/delivery once incident admission has closed; guardedAwait re-checks after
    // it too, so a during-delivery incident is not followed by retaining accepted pairs or looping into evidence.
    const result = await this.guardedAwait(() => transport.deliver(deliveryGrant, lease));
    if (result.outcome === 'DELIVERED') {
      // §5.7: RE-READ the classifier BEFORE retaining the accepted grant/lease pair — a barrier forbids reuse.
      const beforeRetain = await this.classifyFailureSiblings(live, intakeId);
      if (beforeRetain !== 'OPEN') {
        await this.enterFailureBarrier(live, beforeRetain);
        return { phase: 'MANUAL_RECONCILIATION_REQUIRED', outcome: 'MANUAL_RECONCILIATION_REQUIRED', reason: 'failure barrier after delivery' };
      }
      // F03: ONLY a fully-accepted delivery atomically retains the authority for later evidence projection. The Git
      // path retains the accepted (firstAddCommit, blobSha256) pairs for re-observation; the leo-only path retains
      // the in-memory internal grant/lease (handoff 116 §5 — the durable journal already made the lease one-use).
      if (this.personalLeoOnly) {
        this.internalDeliveryGrant = deliveryGrant;
        this.internalLease = lease;
        // Handoff 117 behavior 1: post the same-thread DELIVERY_CONFIRMED status IMMEDIATELY after the durable
        // TRANSPORT_RECORDED — no waiting for the Advisor ACK. Idempotent: a re-entry or the later accepted ACK finds
        // the durable outbox record and does not post a duplicate.
        await this.sendDeliveryConfirmedOnce(live, deps, intakeId);
      } else {
        this.acceptedDeliveryGrant = provisionalDeliveryGrant;
        this.acceptedLease = provisionalLease;
      }
      return result;
    }
    // R2 recovery §5.5/§5.7 DELIVERY_FAILED: a proven pre-paste stop is the ONLY safe non-execution. Derive the delivery
    // id from the already-parsed grant and FRESHLY prove the derived-delivery journal is null (no PREPARED-or-later
    // record) BEFORE posting — only then is "요청은 실행되지 않았습니다" true. Send DELIVERY_FAILED and enter the terminal
    // delivery-failure barrier; its outbox record is the crash-durable barrier. A MANUAL_RECONCILIATION_REQUIRED result,
    // any PREPARED-or-later journal record, or a missing proof sends NO delivery failure (never claim non-execution).
    if (result.outcome === 'STOPPED_BEFORE_PASTE') {
      const { deliveryId } = parseContainedPointerRef(deliveryGrant);
      const journalPhase = await this.guardedAwait(() => live.store.readTmuxPhase(deliveryId));
      if (journalPhase === null) {
        const failed = await this.sendUserStatus(live, deps, intakeId, 'DELIVERY_FAILED');
        // handoff 95 F01: enter a DELIVERY_FAILED barrier ONLY if its outbox record actually reached its first durable
        // phase (RE-classify the durable siblings). A send rejected BEFORE any durable phase is NOT a crash-durable
        // barrier; halt on the exact non-delivered outcome (profile latch via haltProgression) instead of a false claim.
        const afterSend = await this.classifyFailureSiblings(live, intakeId);
        if (afterSend !== 'OPEN') {
          await this.enterFailureBarrier(live, afterSend);
        } else {
          await this.haltProgression(live, `delivery-failed-${failed.outcome}`);
        }
      }
    }
    return result;
  }

  /**
   * Evidence ingress + same-thread outbound (design §10). Build the immutable evidence authority from the typed
   * accepted artifacts, then ingest ACK -> INTAKE -> RESULT and project only the branded accepted outbound to the
   * one original Leo root thread. The private one-round-trip run neither enumerates nor projects questions.
   */
  public async ingestEvidenceAndProject(): Promise<readonly string[]> {
    const live = this.requireLive();
    const deps = this.requireDeps();
    // R2 recovery §5.6.1/§5.7: a durable failure barrier OR a halted status progression refuses evidence/ACK
    // progression, status, and every business projection — no confirmation, INTAKE/RESULT projection, retry, or
    // alternate status may begin.
    if (this.hasFailureBarrier()) {
      return [`FAILURE_ADMISSION_REFUSED:${this.failureAdmission ?? 'PROGRESSION_HALTED'}`];
    }
    const intakeId = this.lastIntakeId;
    if (intakeId === null) throw new DomainError('GATEWAY_DISABLED', 'no intake to ingest evidence for');
    // §5.6/§5.7 (handoff 95 F01): RE-READ the DURABLE failure classifier at ingestEvidenceAndProject ENTRY — a barrier
    // record that appeared since the last tick enters the barrier and refuses before any evidence observation.
    const entryClassification = await this.classifyFailureSiblings(live, intakeId);
    if (entryClassification !== 'OPEN') {
      await this.enterFailureBarrier(live, entryClassification);
      return [`FAILURE_ADMISSION_REFUSED:${entryClassification}`];
    }
    // Evidence sources its already-proven delivery authority from Git re-observation (default) or, in the personal
    // Leo-only runtime, from the in-memory internal grant/lease retained at the one-use delivery (handoff 116 §5).
    let deliveryGrant: As1PointerDeliveryGrantV1;
    let evidenceLease: As1AdvisorReadinessLeaseV1;
    if (this.personalLeoOnly) {
      // §5: the internal authority is never written to Git, so it is reused from the retained one-use pair. Its
      // absence means no delivery was proven (evidence must not be built). The lease is still proven bound to the
      // grant; the durable journal + consumption record (read below) remain the crash-durable one-use proof.
      if (this.internalDeliveryGrant === null || this.internalLease === null) {
        throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'evidence requires an already-consumed internal delivery authority');
      }
      deliveryGrant = this.internalDeliveryGrant;
      evidenceLease = this.internalLease;
      this.assertLeaseBoundToDelivery(evidenceLease, deliveryGrant);
    } else {
      const base = `${this.missionAuthorityRoot}/runtime-authority/${live.slug}/${intakeId}`;
      // F03: evidence construction REQUIRES an already-proven accepted delivery authority — never a first-observation
      // fallback. The accepted pair is retained only after a fully-accepted delivery, so its absence means no delivery
      // was proven and evidence must not be built.
      if (this.acceptedDeliveryGrant === null) {
        throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'evidence requires an already-accepted delivery authority');
      }
      const acceptedDeliveryGrant = this.acceptedDeliveryGrant;
      // Re-observe the pointer-delivery grant with its bound accepted pair — a post-acceptance divergence latches the
      // profile rather than building evidence authority from a rewritten grant. F01: `guardedAwait` guards incident
      // admission BEFORE and AFTER every observation/latch/store/ingress/outbound await in this method.
      const grantObs = await this.guardedAwait(() => deps.gitSource.observe(`${base}/pointer-delivery-grant.json`, acceptedDeliveryGrant));
      if (grantObs.status === 'DIVERGED') {
        await this.guardedAwait(() => this.control.latchProfile(live.slug, `pointer-delivery grant diverged at evidence: ${grantObs.reason}`));
        throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'pointer-delivery grant diverged post-acceptance');
      }
      if (grantObs.status !== 'READY' || grantObs.bytes === null) {
        throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'delivery grant is not ready for evidence authority');
      }
      deliveryGrant = parsePointerDeliveryGrant(JSON.parse(grantObs.bytes.toString('utf8')));

      // F03 (Patch 2A): evidence ALSO requires the already-accepted readiness lease, re-observed with its retained
      // (firstAddCommit, blobSha256) pair BEFORE any evidence/outbound. The real owner reaches this method directly
      // (without a second deliverPending), so the lease must be re-proven here too: a divergent/deleted/dirty/rewritten
      // lease latches the profile and fails closed, and the re-observed lease is parsed and proven to be the SAME lease
      // bound to the accepted delivery authority — acceptance is never inferred from the stored pair alone.
      if (this.acceptedLease === null) {
        throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'evidence requires an already-accepted readiness lease');
      }
      const acceptedLease = this.acceptedLease;
      const leaseObs = await this.guardedAwait(() => deps.gitSource.observe(`${base}/readiness-lease.json`, acceptedLease));
      if (leaseObs.status === 'DIVERGED') {
        await this.guardedAwait(() => this.control.latchProfile(live.slug, `readiness lease diverged at evidence: ${leaseObs.reason}`));
        throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'readiness lease diverged post-acceptance');
      }
      if (leaseObs.status !== 'READY' || leaseObs.bytes === null) {
        throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'readiness lease is not ready for evidence authority');
      }
      evidenceLease = parseReadinessLease(JSON.parse(leaseObs.bytes.toString('utf8')));
      this.assertLeaseBoundToDelivery(evidenceLease, deliveryGrant);
    }
    const { deliveryId } = parseContainedPointerRef(deliveryGrant);

    // F01: guard incident admission between EACH durable evidence-input read (not one guard for the group).
    const receiveGrantState = await this.guardedAwait(() => live.store.readReceiveGrantState(live.grant.receiveGrantId));
    const terminalDelivery = await this.guardedAwait(() => live.store.readTmuxDeliveryRecord(deliveryId));
    const rootCorrelation = await this.guardedAwait(() => live.store.findRootByIntakeId(intakeId));
    const consumption = await this.guardedAwait(() => live.store.readDeliveryAuthorityConsumption(deliveryGrant.pointerDeliveryGrantId));
    if (receiveGrantState === null || terminalDelivery === null || rootCorrelation === null || consumption === null) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'evidence authority inputs are not all durable yet');
    }
    const authority = buildEvidenceAuthority({
      receiveGrant: live.grant,
      receiveGrantState,
      pointerDeliveryGrant: deliveryGrant,
      terminalDelivery,
      rootCorrelation,
      consumption,
    });
    // F01: EVERY port/callback handed to evidence ingress + outbox is incident-guarded, so an incident during any
    // internal await (store read/write, verifier, Web send, latch, or sendability check) begins no next store/Web/
    // outbound side effect. The forbidden `evidence-ingress.ts`/`outbox.ts` sources are unmodified.
    // R2 recovery §5.5/§5.7 PROCESSING_FAILED: the post-TRANSPORT_RECORDED evidence/projection work runs under a NARROW
    // catch. A benign NOT_READY is an outcome (not a throw); an incident closes admission (the incident kill wins) and
    // an existing profile latch wins — both are refused by `attemptProcessingFailure`. Any other non-benign failure
    // starts PROCESSING_FAILED exactly once and enters the processing barrier, and the original error stays terminal.
    try {
      return await this.projectAcceptedEvidence(live, deps, intakeId, authority);
    } catch (error) {
      await this.attemptProcessingFailure(live, deps, intakeId).catch(() => undefined);
      // Handoff 116 §7: in PERSONAL_LEO_ONLY a processing failure that posted PROCESSING_FAILED is a per-message LOCAL
      // failure — surface a benign marker (not a throw) so the owner resets and continues to the next root. A failure
      // that reached no per-message local outcome (incident / durable-state corruption) still throws and halts.
      if (this.personalLeoOnly && this.personalMessageFailed) {
        return ['RESULT_OUTBOUND:PERSONAL_MESSAGE_FAILED'];
      }
      throw error;
    }
  }

  /**
   * The post-TRANSPORT_RECORDED evidence projection (design §10; R2 recovery §5). ACK acceptance triggers
   * DELIVERY_CONFIRMED (Korean), the INTAKE legacy English progress ACK is suppressed, and only the RESULT business
   * outbound is projected. Every port/callback is incident-guarded; a throw here routes to the narrow
   * PROCESSING_FAILED catch in `ingestEvidenceAndProject`.
   */
  private async projectAcceptedEvidence(
    live: LiveState,
    deps: As1CompositionDependencies,
    intakeId: string,
    authority: ReturnType<typeof buildEvidenceAuthority>,
  ): Promise<readonly string[]> {
    const ingress = new As1EvidenceIngress(
      live.profile,
      this.incidentGuardedPort(live.store),
      this.incidentGuardedPort(deps.evidenceVerifier),
      authority,
      this.incidentGuardedCallback((reason: string) => this.control.latchProfile(live.slug, reason)),
    );
    const outbox = this.buildStatusOutbox(live, deps);
    const outcomes: string[] = [];
    // The private Phase B round trip exercises only ACK -> INTAKE -> RESULT (no question cycle).
    for (const kind of ['ACK', 'INTAKE', 'RESULT'] as const) {
      // §5.6/§5.7 (handoff 95 F01): RE-READ the DURABLE failure classifier BEFORE EACH evidence observation/checkpoint —
      // a barrier record that appeared mid-loop enters the barrier and begins no further evidence/status/business work.
      const beforeCheckpoint = await this.classifyFailureSiblings(live, intakeId);
      if (beforeCheckpoint !== 'OPEN') {
        await this.enterFailureBarrier(live, beforeCheckpoint);
        outcomes.push(`FAILURE_ADMISSION_REFUSED:${beforeCheckpoint}`);
        return outcomes;
      }
      // F01: guard admission around EACH evidence observation, ingress, and outbound send.
      const evidenceObs = await this.guardedAwait(() => deps.gitSource.observe(`${authority.evidencePrefix}/${intakeId}/${kind.toLowerCase()}.json`));
      if (evidenceObs.status !== 'READY' || evidenceObs.bytes === null) {
        outcomes.push(`${kind}:NOT_READY`);
        continue;
      }
      const value: unknown = JSON.parse(evidenceObs.bytes.toString('utf8'));
      const ref = { repositoryId: deps.gitSource.getRepositoryId(), sourceCommit: evidenceObs.firstAddCommit ?? '', path: `${authority.evidencePrefix}/${intakeId}/${kind.toLowerCase()}.json`, blobSha256: evidenceObs.blobSha256 ?? '' };
      // §5.7 (handoff 95 F01): RE-READ the DURABLE classifier AFTER the evidence observation and IMMEDIATELY BEFORE the
      // durable evidence CHECKPOINT (ingress.ingest) — a barrier that appeared during the observation begins no ingress
      // checkpoint, status, or business progression.
      const beforeIngest = await this.classifyFailureSiblings(live, intakeId);
      if (beforeIngest !== 'OPEN') {
        await this.enterFailureBarrier(live, beforeIngest);
        outcomes.push(`FAILURE_ADMISSION_REFUSED:${beforeIngest}`);
        return outcomes;
      }
      const ingested = await this.guardedAwait(() => ingress.ingest(kind, value, ref));
      outcomes.push(`${kind}:${ingested.outcome}`);
      // R2 recovery §5.7 DELIVERY_CONFIRMED: the Advisor server ACK acceptance (buildEvidenceAuthority already required
      // and hash-bound TRANSPORT_RECORDED) is the confirmation trigger. Re-require BOTH failure siblings wholly absent,
      // then post DELIVERY_CONFIRMED before observing/projecting INTAKE and RESULT in this tick.
      if (kind === 'ACK' && ingested.outcome === 'ACCEPTED') {
        const classification = await this.classifyFailureSiblings(live, intakeId);
        if (classification !== 'OPEN') {
          await this.enterFailureBarrier(live, classification);
          outcomes.push(`DELIVERY_CONFIRMED:SUPPRESSED_BY_${classification}`);
          return outcomes;
        }
        // Handoff 117 behavior 1: in PERSONAL_LEO_ONLY the DELIVERY_CONFIRMED was already posted immediately after the
        // durable transport, so the accepted ACK must NOT post a duplicate — it observes the durable record and skips.
        // Default mode is unchanged (the ACK is still the confirmation trigger).
        const priorConfirmed = this.personalLeoOnly
          ? await this.guardedAwait(() =>
              live.store.readOutboxRecord(userStatusOutboundId(live.profile.profileId, intakeId, 'DELIVERY_CONFIRMED')),
            )
          : null;
        if (priorConfirmed !== null) {
          outcomes.push('DELIVERY_CONFIRMED:ALREADY_SENT');
        } else {
          const confirmed = await this.sendUserStatus(live, deps, intakeId, 'DELIVERY_CONFIRMED');
          outcomes.push(`DELIVERY_CONFIRMED:${confirmed.outcome}`);
          // §5.7: a failed / non-DELIVERED DELIVERY_CONFIRMED is terminal — it must NOT continue to INTAKE or RESULT
          // projection. Halt (latch, withhold authority); the owner stops on hasFailureBarrier().
          if (confirmed.outcome !== 'DELIVERED') {
            await this.haltProgression(live, `delivery-confirmed-${confirmed.outcome}`);
            return outcomes;
          }
        }
      }
      if (ingested.outcome === 'ACCEPTED' && ingested.accepted !== null) {
        // R2 recovery §5.1: the INTAKE evidence's legacy fixed English progress ACK projection is SUPPRESSED —
        // DELIVERY_CONFIRMED (Korean, above) replaces it. The accepted RESULT business projection is unchanged.
        if (kind === 'INTAKE') {
          outcomes.push('INTAKE_OUTBOUND:SUPPRESSED_R2');
        } else {
          // §5.7: RE-READ the durable failure classifier BEFORE the RESULT business projection — a barrier forbids it.
          const beforeProjection = await this.classifyFailureSiblings(live, intakeId);
          if (beforeProjection !== 'OPEN') {
            await this.enterFailureBarrier(live, beforeProjection);
            outcomes.push(`${kind}_OUTBOUND:SUPPRESSED_BY_${beforeProjection}`);
            return outcomes;
          }
          const accepted = ingested.accepted; // NEVER project outbound to Leo's thread after an incident (guarded)
          const sent = await this.guardedAwait(() => outbox.send(accepted));
          outcomes.push(`${kind}_OUTBOUND:${sent.outcome}`);
        }
      }
    }
    return outcomes;
  }

  /**
   * Build the profile-bound status/outbound sender (R2 recovery §5.4). Channel/thread/token come ONLY from the bound
   * profile secret and the immutable accepted root; every port is incident-guarded and the sole sendability gate is
   * the construction-bound live-delivery predicate (control owned + RECEIVING + not killed/latched + gate open),
   * re-evaluated before each durable/network side effect. This is the SAME As1Outbox the accepted RESULT path uses.
   */
  private buildStatusOutbox(live: LiveState, deps: As1CompositionDependencies): As1Outbox {
    const profileSecret = live.secret.secretFor(live.profile.profileId);
    return new As1Outbox({
      profile: live.profile,
      secret: { workspaceId: live.wire.workspaceId, appId: live.wire.appId, channelId: live.wire.channelId, botToken: profileSecret.botToken },
      store: this.incidentGuardedPort(live.store),
      web: this.incidentGuardedPort(deps.web),
      latch: this.incidentGuardedCallback((reason: string) => this.control.latchProfile(live.slug, reason)),
      assertSendable: this.incidentGuardedCallback(() => {
        if (!this.control.isLiveDeliveryActionable(live.slug)) {
          return Promise.reject(new DomainError('GATEWAY_DISABLED', 'profile is not sendable'));
        }
        return Promise.resolve();
      }),
      delay: this.incidentGuardedCallback(() => Promise.resolve()),
    });
  }

  /** Send exactly ONE closed same-thread user status through the shared outbox (R2 recovery §5); it takes no target or
   *  text and reuses the deterministic `as1status-` identity so a replay never resends. Guarded before/after. */
  private sendUserStatus(live: LiveState, deps: As1CompositionDependencies, intakeId: string, kind: As1UserStatusKind): Promise<As1OutboxResult> {
    const outbox = this.buildStatusOutbox(live, deps);
    return this.guardedAwait(() => outbox.sendStatus(intakeId, kind));
  }

  /**
   * Handoff 117 behavior 1 (PERSONAL_LEO_ONLY): post DELIVERY_CONFIRMED at most once for the intake. The deterministic
   * `as1status-` outbox identity already dedupes a replay; this ALSO short-circuits on the durable outbox record so the
   * immediate post-transport call and the later accepted-ACK path never post a duplicate. Returns null when skipped.
   */
  private async sendDeliveryConfirmedOnce(live: LiveState, deps: As1CompositionDependencies, intakeId: string): Promise<As1OutboxResult | null> {
    const existing = await this.guardedAwait(() =>
      live.store.readOutboxRecord(userStatusOutboundId(live.profile.profileId, intakeId, 'DELIVERY_CONFIRMED')),
    );
    if (existing !== null) return null;
    return this.sendUserStatus(live, deps, intakeId, 'DELIVERY_CONFIRMED');
  }

  /**
   * Classify the two deterministic failure siblings for an intake over ALL durable outbox phases (R2 recovery §5.6).
   * Record EXISTENCE (PREPARED/REQUEST_STARTED/RESPONSE_RECORDED/MANUAL_RECONCILIATION_REQUIRED), not successful Slack
   * delivery, is the durable fact. It adds no store or schema — only the existing deterministic ids and outbox records.
   */
  private async classifyFailureSiblings(live: LiveState, intakeId: string): Promise<'OPEN' | 'DELIVERY_FAILED_BARRIER' | 'PROCESSING_FAILED_BARRIER' | 'FAILURE_STATUS_CONFLICT'> {
    const hasDelivery = (await live.store.readOutboxRecord(userStatusOutboundId(live.profile.profileId, intakeId, 'DELIVERY_FAILED'))) !== null;
    const hasProcessing = (await live.store.readOutboxRecord(userStatusOutboundId(live.profile.profileId, intakeId, 'PROCESSING_FAILED'))) !== null;
    if (hasDelivery && hasProcessing) return 'FAILURE_STATUS_CONFLICT';
    if (hasDelivery) return 'DELIVERY_FAILED_BARRIER';
    if (hasProcessing) return 'PROCESSING_FAILED_BARRIER';
    return 'OPEN';
  }

  /**
   * Enter the closed failure-only admission state and perform the one deterministic latch transition (R2 recovery
   * §5.6.1). It withholds the intake from delivery, discards retained grant/lease pairs, and refuses every later
   * pointer-grant/lease/capability/tmux/evidence/nonmatching-status/business entry point. The latch code is fixed per
   * barrier; a crash before/during the latch is re-derived from the unchanged outbox record on the next start.
   */
  private async enterFailureBarrier(live: LiveState, barrier: 'DELIVERY_FAILED_BARRIER' | 'PROCESSING_FAILED_BARRIER' | 'FAILURE_STATUS_CONFLICT'): Promise<void> {
    // Handoff 116 §7: in PERSONAL_LEO_ONLY a DELIVERY_FAILED / PROCESSING_FAILED status is a per-message LOCAL failure —
    // the FAILED status is already durable in the outbox; clear ONLY this message's transient authority and continue.
    // NO profile/global latch. FAILURE_STATUS_CONFLICT (both siblings present) is a durable-state corruption and still
    // latches even here, matching the reserved corruption classes.
    if (this.personalLeoOnly && barrier !== 'FAILURE_STATUS_CONFLICT') {
      this.personalMessageFailed = true;
      this.lastIntakeId = null;
      this.internalDeliveryGrant = null;
      this.internalLease = null;
      this.acceptedDeliveryGrant = null;
      this.acceptedLease = null;
      return;
    }
    this.failureAdmission = barrier;
    this.lastIntakeId = null; // withhold the intake from delivery
    this.acceptedDeliveryGrant = null;
    this.acceptedLease = null;
    const latchCode =
      barrier === 'DELIVERY_FAILED_BARRIER'
        ? 'status-terminal-delivery-failed'
        : barrier === 'PROCESSING_FAILED_BARRIER'
          ? 'status-terminal-processing-failed'
          : 'status-terminal-conflict';
    await this.guardedAwait(() => this.control.latchProfile(live.slug, latchCode));
  }

  /**
   * Terminate the current status progression on a NON-DELIVERED status (R2 recovery §5.6/§5.8). It preserves the exact
   * outbox state (no substitute status is attempted), withholds the intake and any retained authority, durably latches
   * the profile with a stable local reason when no stronger latch already exists, and marks the owner halted so no
   * later delivery/evidence/status/business work begins. Idempotent: a stronger DELIVERY_FAILED/PROCESSING_FAILED
   * barrier already latched wins and this only records the halt.
   */
  private async haltProgression(live: LiveState, reason: string): Promise<void> {
    // Handoff 116 §7: in PERSONAL_LEO_ONLY a non-delivered STATUS is a per-message LOCAL failure — clear ONLY this
    // message's transient authority and continue to the next root. NO profile latch (reserved for the corruption
    // classes); the exact outbox state is preserved (no substitute status), exactly as the default path preserves it.
    if (this.personalLeoOnly) {
      this.personalMessageFailed = true;
      this.lastIntakeId = null;
      this.internalDeliveryGrant = null;
      this.internalLease = null;
      this.acceptedDeliveryGrant = null;
      this.acceptedLease = null;
      return Promise.resolve();
    }
    this.progressionHalted ??= reason;
    this.lastIntakeId = null;
    this.acceptedDeliveryGrant = null;
    this.acceptedLease = null;
    if (this.failureAdmission === null && this.control.isLiveDeliveryActionable(live.slug)) {
      await this.guardedAwait(() => this.control.latchProfile(live.slug, `status-progression-halted:${reason}`));
    }
  }

  /**
   * Attempt PROCESSING_FAILED for a NON-benign post-TRANSPORT_RECORDED evidence/projection failure (R2 recovery
   * §5.5/§5.7). Eligibility is narrow: ONLY while the incident gate is still open (else the incident kill wins), the
   * profile is not already latched/killed (else that latch wins), and no failure barrier exists yet. If a
   * DELIVERY_FAILED sibling already exists, PROCESSING_FAILED is forbidden and that barrier is entered instead. Its
   * first durable outbox phase is the crash-durable processing barrier; the caller re-throws the original error.
   */
  private async attemptProcessingFailure(live: LiveState, deps: As1CompositionDependencies, intakeId: string): Promise<void> {
    if (!this.control.isIncidentGateOpen() || !this.control.isLiveDeliveryActionable(live.slug) || this.hasFailureBarrier()) {
      return; // incident or an existing latch/halt wins; a barrier already dominates — never synthesize a user failure
    }
    const classification = await this.classifyFailureSiblings(live, intakeId);
    if (classification === 'DELIVERY_FAILED_BARRIER' || classification === 'FAILURE_STATUS_CONFLICT') {
      await this.enterFailureBarrier(live, classification); // §5.6 rule 5: PROCESSING_FAILED forbidden while DELIVERY_FAILED exists
      return;
    }
    // OPEN or an existing PROCESSING_FAILED record: (re-)attempt the same PROCESSING_FAILED once.
    const failed = await this.sendUserStatus(live, deps, intakeId, 'PROCESSING_FAILED');
    // handoff 95 F01: enter a PROCESSING_FAILED barrier ONLY if its outbox record actually reached its first durable
    // phase (RE-classify the durable siblings). A send rejected BEFORE any durable phase is NOT a crash-durable barrier;
    // halt on the exact non-delivered outcome (profile latch via haltProgression) instead of a false durable claim.
    const afterSend = await this.classifyFailureSiblings(live, intakeId);
    if (afterSend !== 'OPEN') {
      await this.enterFailureBarrier(live, afterSend);
    } else {
      await this.haltProgression(live, `processing-failed-${failed.outcome}`);
    }
  }

  /** True once a durable failure barrier has been observed/entered (R2 recovery §5.6). The owner loop halts on it so
   *  no delivery/evidence/business work runs behind a DELIVERY_FAILED/PROCESSING_FAILED/conflict terminal. */
  public hasFailureBarrier(): boolean {
    return this.failureAdmission !== null || this.progressionHalted !== null;
  }

  /**
   * R2 recovery §5.7 startup crash recovery: reconstruct a DURABLY MATERIALIZED intake from the receive-grant state,
   * root correlation, and transport, or null if none is proven. It requires phase ROOT_BOUND with a bound source event,
   * a MATERIALIZED transport carrying the intake, and a root correlation whose source event and intake agree — so a
   * partial/unmaterialized or disagreeing graph exposes no intake.
   */
  private async recoverStartupIntake(live: LiveState): Promise<string | null> {
    const state = await live.store.readReceiveGrantState(live.grant.receiveGrantId);
    if (state?.phase !== 'ROOT_BOUND' || state.boundSourceEventId === null) {
      return null;
    }
    const transport = await live.store.readTransport(state.boundSourceEventId);
    if (transport?.state !== 'MATERIALIZED' || transport.intakeId === null) {
      return null;
    }
    const root = await live.store.findRootByIntakeId(transport.intakeId);
    if (root?.sourceEventId !== state.boundSourceEventId || root.intakeId !== transport.intakeId) {
      return null;
    }
    return transport.intakeId;
  }

  /**
   * R2 recovery §5.7 terminal-status recovery: BEFORE arm/intake-exposure, reconstruct a durably materialized intake,
   * read its failure siblings, and either enter the barrier (§5.6.1 — the owner loop then halts) or, only while OPEN,
   * replay ACCEPTED idempotently. The intake is exposed to delivery ONLY after ACCEPTED is durably RESPONSE_RECORDED
   * and a FINAL OPEN proof; a prior REQUEST_STARTED moves to manual + latch (no resend, no delivery), and a prior
   * RESPONSE_RECORDED makes no second post.
   */
  private async recoverTerminalStatusAndAccepted(live: LiveState, deps: As1CompositionDependencies): Promise<void> {
    const recoveredIntake = await this.guardedAwait(() => this.recoverStartupIntake(live));
    if (recoveredIntake === null) return;
    const classification = await this.classifyFailureSiblings(live, recoveredIntake);
    if (classification !== 'OPEN') {
      await this.enterFailureBarrier(live, classification);
      return;
    }
    const accepted = await this.sendUserStatus(live, deps, recoveredIntake, 'ACCEPTED');
    if (accepted.outcome === 'DELIVERED' && (await this.classifyFailureSiblings(live, recoveredIntake)) === 'OPEN') {
      this.lastIntakeId = recoveredIntake; // expose to delivery ONLY after RESPONSE_RECORDED + final OPEN proof
      return;
    }
    // §5.7: a recovered ACCEPTED that reached REQUEST_STARTED/manual (or otherwise did not deliver) must NOT arm receive
    // or continue benign polling — halt so the owner loop stops on hasFailureBarrier() instead of a live round trip.
    await this.haltProgression(live, `accepted-recovery-${accepted.outcome}`);
  }

  /**
   * Clean drain + stop (design §11.3). SIGINT/SIGTERM/grant-expiry/planned stop drains through the reviewed
   * lifecycle, disconnects the selected Socket, and releases the WriterLock — in that order. An ambiguous drain
   * engages the durable global kill BEFORE the lock is released, so it is never silently forgotten.
   */
  public async stop(): Promise<As1OwnerCleanupResult> {
    this.assertOpen();
    this.closed = true;
    const pre: string[] = [];
    if (this.live !== null) {
      try {
        await this.live.socket.disconnect();
      } catch (error) {
        pre.push(`DISCONNECT:${redactError(error).code}`);
      }
    }
    return this.finishCleanup(true, 'ambiguous shutdown drain', pre);
  }

  /**
   * Durable operator incident kill (design §11.2). Synchronously close the incident gate (no new side effect may
   * begin), durably engage the irreversible global kill, disconnect the Socket, and RELEASE the lock truthfully. It
   * never drains the killed control to DISABLED_CLEAN, and `cleanupProven` is false if the kill is not durably
   * engaged or the lock release is ambiguous.
   */
  public async incidentKill(): Promise<As1OwnerCleanupResult> {
    this.assertOpen();
    this.control.closeIncidentGate();
    this.closed = true;
    const pre: string[] = [];
    try {
      await this.control.operatorIncidentKill();
    } catch (error) {
      pre.push(`KILL:${redactError(error).code}`);
    }
    if (!this.control.isGloballyLatched()) pre.push('KILL_NOT_ENGAGED');
    if (this.live !== null) {
      try {
        await this.live.socket.disconnect();
      } catch (error) {
        pre.push(`DISCONNECT:${redactError(error).code}`);
      }
      this.live = null;
    }
    return this.finishCleanup(false, 'incident kill', pre);
  }

  /** Restart is live-disabled in Phase B (design §11.1.3): it fails closed without opening Web/Socket/tmux. */
  public restartDisabled(): As1StartResult {
    this.assertOpen();
    return { connected: false, reason: 'DISABLED_DEFAULT_NO_AUTHORITY', state: this.control.getState() };
  }

  public async rollback(): Promise<As1RedactedStatus> {
    this.assertOpen();
    await this.control.rollbackToDisabled();
    return this.status();
  }

  public async close(): Promise<void> {
    const outcome = await this.control.close();
    this.closed = true;
    // Surface a non-clean release (retained authority OR a post-unlink/unproven cleanup ambiguity) to callers that
    // only observe `close()` as success/failure (F01-B). The truthful phase-aware outcome is consumed by finishCleanup.
    if (!outcome.authorityCeased || outcome.cleanupAmbiguity !== null) {
      throw new DomainError('GATEWAY_DISABLED', `writer-lock release not proven clean: ${outcome.authorityCeased ? outcome.cleanupAmbiguity : 'RETAINED'}`);
    }
  }

  private assertOpen(): void {
    if (this.closed || !this.control.isOpen()) {
      throw new DomainError('GATEWAY_DISABLED', 'this composition was stopped/closed and released its lock; open a new one');
    }
  }

  private requireLive(): LiveState {
    if (this.live === null || !this.receiving) {
      throw new DomainError('GATEWAY_DISABLED', 'the composition is not in a live receiving state');
    }
    return this.live;
  }

  /** The injected dependency graph. Non-null whenever a live state exists (start returns early when deps is null). */
  private requireDeps(): As1CompositionDependencies {
    if (this.deps === null) {
      throw new DomainError('GATEWAY_DISABLED', 'the composition has no live dependency graph');
    }
    return this.deps;
  }

  /**
   * One bounded receive-grant re-observation + exclusive-expiry gate (design §6 step 9, §11.3; F03). It RE-observes
   * the accepted receive-grant artifact with its internally bound (firstAddCommit, blobSha256) pair: a post-acceptance
   * deletion, dirty/unpushed change, committed rewrite, ancestry/path reuse, or content divergence is DIVERGED and
   * durably latches the selected profile; reaching the exclusive grant expiry closes new receive. It NEVER renews the
   * grant, switches profiles, or reconnects — the owner loop drains/releases on either terminal result.
   */
  public async observeReceiveGrantOnce(): Promise<'RECEIVING' | 'DIVERGED' | 'EXPIRED'> {
    const live = this.requireLive();
    const deps = this.requireDeps();
    // F01: guard incident admission BEFORE and AFTER the re-observe (so a SIGUSR2 during the observe await does not
    // resume into a durable divergence latch before the owner resamples), and again around the latch itself.
    const reObserved = await this.guardedAwait(() => deps.gitSource.observe(live.receiveGrantRef, live.acceptedReceiveGrant));
    if (reObserved.status === 'DIVERGED') {
      await this.guardedAwait(() => this.control.latchProfile(live.slug, `receive-grant diverged post-acceptance: ${reObserved.reason}`));
      this.receiving = false;
      return 'DIVERGED';
    }
    if (!(Date.parse(this.clock.now()) < Date.parse(live.grant.expiresAt))) {
      this.receiving = false;
      return 'EXPIRED';
    }
    return 'RECEIVING';
  }

  /**
   * The selected profile's contained state-root binding must be exactly the reviewed literal AND its domain-separated
   * hash, and it must neither alias nor escape to the other profile (design §5.2, F02). The hash binds the exact
   * parsed `agent-office.state-root.v1` marker of THIS owner root to the selected contained ref, so a grant minted
   * for a different root instance or the other profile fails closed; `resolveContainedPath` (realpath + no-symlink +
   * no-escape) plus the distinct contained-leaf comparison proves non-aliasing between the two profile roots.
   */
  private async assertProfileStateRootBinding(grant: As1PilotReceiveGrantV1, slug: As1ProfileSlug): Promise<void> {
    const expectedRef = `indexes/as1-slack-pilot/profiles/${slug}`;
    if (grant.profileStateRootRef !== expectedRef) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'receive grant profileStateRootRef is not the selected contained literal');
    }
    const stateRootFormat = await readStateRootFormat(this.stateRoot);
    const expectedHash = hashCanonical({
      schemaVersion: 'agent-office.as1-profile-state-root-binding.v1',
      stateRootFormat,
      profileStateRootRef: expectedRef,
    });
    if (grant.profileStateRootHash !== expectedHash) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'receive grant profileStateRootHash does not bind this owner root + selected profile');
    }
    const otherSlug = AS1_PROFILE_SLUGS.find((candidate) => candidate !== slug);
    if (otherSlug === undefined) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'the closed two-profile set is malformed');
    }
    const selectedPath = await resolveContainedPath(this.stateRoot, expectedRef, { allowMissingLeaf: true });
    const otherPath = await resolveContainedPath(this.stateRoot, `indexes/as1-slack-pilot/profiles/${otherSlug}`, { allowMissingLeaf: true });
    if (selectedPath === otherPath) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'the selected contained profile root aliases the other profile');
    }
  }

  private assertGrantMatchesSecret(grant: As1PilotReceiveGrantV1, secret: As1SecretConfig): void {
    if (grant.workspaceId !== secret.getWorkspaceId() || grant.leoUserId !== secret.getLeoUserId()) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'receive grant workspace/Leo identity does not match the secret');
    }
    const profileSecret = secret.secretFor(grant.profileId);
    if (grant.appId !== profileSecret.appId || grant.channelId !== profileSecret.channelId) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'receive grant App/channel does not match the selected secret profile');
    }
    // The one configured workspace and the sole Leo identity must be exactly the reviewed singleton — never a set.
    for (const other of allAs1Profiles()) {
      if (other.profileId !== grant.profileId) {
        const otherSecret = secret.secretFor(other.profileId);
        if (otherSecret.appId === profileSecret.appId || otherSecret.channelId === profileSecret.channelId) {
          throw new DomainError('FORBIDDEN_TARGET', 'the two profiles must not share App/channel');
        }
      }
    }
  }

  private assertDeliveryGrantBinding(grant: As1PointerDeliveryGrantV1, live: LiveState): void {
    if (
      grant.receiveGrantId !== live.grant.receiveGrantId ||
      grant.pilotId !== live.grant.pilotId ||
      grant.profileId !== live.grant.profileId ||
      grant.globalControlSnapshotHash !== live.grant.globalControlSnapshotHash ||
      grant.profileLatchSnapshotHash !== live.grant.profileLatchSnapshotHash
    ) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'pointer-delivery grant does not bind the accepted receive grant');
    }
  }

  /**
   * The re-observed readiness lease must be the SAME lease bound to the accepted delivery authority (design §9.1/§12.5,
   * Patch 2A). Byte-identity from the accepted pair is necessary but not sufficient, so the binding is proven
   * explicitly: the canonical `assertPointerGrantSnapshot` proves `lease.pointerDeliveryGrantSnapshotHash` equals the
   * exact delivery-grant bytes, and the COMPLETE shared-field comparison (the same immutable identity/lineage/snapshot
   * fields `assertDeliveryChainConsistent` binds — ids, pilot, profile, intake, source, pointer hash, receive-grant
   * binding, team/actor/role, and authority/registry snapshots) must agree. The exclusive-expiry clock is deliberately
   * NOT re-checked here: a lease already accepted at delivery time may legitimately have expired by evidence time.
   */
  private assertLeaseBoundToDelivery(lease: As1AdvisorReadinessLeaseV1, deliveryGrant: As1PointerDeliveryGrantV1): void {
    assertPointerGrantSnapshot(deliveryGrant, lease);
    if (
      lease.pointerDeliveryGrantId !== deliveryGrant.pointerDeliveryGrantId ||
      lease.receiveGrantId !== deliveryGrant.receiveGrantId ||
      lease.pilotId !== deliveryGrant.pilotId ||
      lease.profileId !== deliveryGrant.profileId ||
      lease.intakeId !== deliveryGrant.intakeId ||
      lease.sourceEventId !== deliveryGrant.sourceEventId ||
      lease.pointerHash !== deliveryGrant.pointerHash ||
      lease.receiveGrantBindingHash !== deliveryGrant.receiveGrantBindingHash ||
      lease.advisorTeam !== deliveryGrant.advisorTeam ||
      lease.actorId !== deliveryGrant.actorId ||
      lease.roleInstanceId !== deliveryGrant.roleInstanceId ||
      lease.registrySnapshotHash !== deliveryGrant.registrySnapshotHash ||
      lease.authoritySnapshotHash !== deliveryGrant.governanceSnapshotHash
    ) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 're-observed readiness lease is not bound to the accepted delivery authority');
    }
  }

  public status(): As1RedactedStatus {
    const state = this.control.getState();
    return {
      schemaVersion: 'agent-office.as1-slack-status.v1',
      state,
      killEngaged: this.control.isGloballyLatched(),
      incidentGateOpen: this.control.isIncidentGateOpen(),
      connected: this.receiving && state === 'RECEIVING_ONE_PROFILE',
      liveConnection: this.receiving ? 'RECEIVING' : state === 'DISABLED_CLEAN' ? 'DRAINED' : 'NOT_STARTED',
    };
  }
}
