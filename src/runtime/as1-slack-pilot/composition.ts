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
import { As1Outbox } from '../../application/slack-pilot/outbox.js';
import type { AgentOfficeRuntimeIdentity } from '../identity.js';
import { hashCanonical } from '../../persistence/file-store/hashing.js';
import { readStateRootFormat, resolveContainedPath } from '../../persistence/file-store/path-safety.js';
import { AS1_PROFILE_SLUGS, As1SlackControl, type As1GlobalState, type As1ProfileSlug } from '../../operations/readiness/as1-slack-control.js';

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
  /** The truthful cleanup result of a self-cleaning startup revert (F01), so the owner can report it after start()
   *  rethrows without re-opening the closed composition. Consumed exactly once. */
  private lastCleanup: As1OwnerCleanupResult | null = null;

  private constructor(
    private readonly descriptor: As1RuntimeDescriptorV1,
    control: As1SlackControl,
    private readonly stateRoot: string,
    private readonly clock: AgentOfficeRuntimeIdentity,
    private readonly deps: As1CompositionDependencies | null,
  ) {
    this.control = control;
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
    },
  ): Promise<As1GatewayComposition> {
    const foreground = options.deps !== undefined;
    const control = await As1SlackControl.open(options.stateRoot, options.clock, {
      retainLockForForeground: foreground,
      ...(options.onLockAcquired !== undefined ? { onLockAcquired: options.onLockAcquired } : {}),
    });
    return new As1GatewayComposition(descriptor, control, options.stateRoot, options.clock, options.deps ?? null);
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
    if (drain) {
      try {
        await this.control.shutdown();
      } catch (error) {
        ambiguities.push(`DRAIN:${redactError(error).code}`);
        try {
          await this.control.engageGlobalKill(`${fallbackReason}: ${redactError(error).code}`);
        } catch (killError) {
          ambiguities.push(`FALLBACK_KILL:${redactError(killError).code}`);
        }
      }
    }
    this.receiving = false;
    const status = this.status();
    let lockReleased = true;
    try {
      await this.control.close();
    } catch (error) {
      lockReleased = false;
      ambiguities.push(`RELEASE:${redactError(error).code}`);
    }
    const cleanupProven = ambiguities.length === 0 && lockReleased;
    return {
      ...status,
      cleanupProven,
      lockReleased,
      detail: cleanupProven ? 'CLEANUP_PROVEN' : `CLEANUP_AMBIGUOUS:${ambiguities.join(',')}`,
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

    // Step 2: observe the fixed committed receive-grant blob (no fetch, no mutable ref trust) and parse it.
    const observed = await deps.gitSource.observe(receiveGrantRef);
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
    await this.assertProfileStateRootBinding(grant, slug);
    const snapshots = await this.control.selectedSnapshotHashes(slug);
    if (grant.globalControlSnapshotHash !== snapshots.globalControlHash || grant.profileLatchSnapshotHash !== snapshots.profileLatchHash) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'receive grant frozen control/latch snapshots do not bind the exact pre-transition records');
    }
    const receiveGrantProvenance = deps.buildReceiveGrantProvenance({ receiveGrantRef, accepted: acceptedReceiveGrant, grant });
    await receiveGrantProvenance.assertAccepted(grant);

    // Step 3 (F02.3): the FIRST durable authority transition is now INSIDE the rollback/kill envelope, so a
    // transition/persistence failure at that boundary reverts/closes to a legal clean state and releases ownership —
    // never a half-started durable record reached by the outer owner close.
    let startedSocket: As1CompositionSocketPort | null = null;
    try {
      if (this.control.getState() === 'DISABLED_CLEAN') {
        await this.control.transition('DISABLED_CLEAN', 'DISABLED_DEFAULT');
      }
      await this.control.transition('DISABLED_DEFAULT', 'RECEIVE_GRANTED_ONE_PROFILE', slug);

      // Step 4: parse the owner-only secret, prove one shared workspace + the sole Leo identity + cross-profile
      // separation, and retain ONLY the selected profile's wire identity.
      const secret = await parseSecretConfigFile(this.descriptor.secretFilePath);
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
      const store = await As1ProfileInboundStore.open(this.stateRoot, profile, this.clock);
      await store.initReceiveGrantState(grant);
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
      await this.control.transition('RECEIVE_GRANTED_ONE_PROFILE', 'AUTHENTICATING_ONE_PROFILE');
      const verifier = new As1StartupIdentityVerifier(
        () => this.clock.now(),
        receiveGrantProvenance,
        () => this.control.liveControlSnapshotHash(),
        () => this.control.isConnectReady(slug),
      );
      const proof = await verifier.verify({ profile, wire, grant, web: deps.web, socket });
      const boundContext: As1ProfileRuntimeContext = { ...context, botUserId: proof.botUserId };
      const service = new As1InboundService(boundContext, grant, store, gate);
      socket.onEnvelope(async (envelope) => {
        const result = await service.processEnvelope(envelope);
        if (result.intakeId !== null) this.lastIntakeId = result.intakeId;
      });

      // Step 8: durably transition to RECEIVING, recheck the selected facts, then one-use arm receive.
      await this.control.transition('AUTHENTICATING_ONE_PROFILE', 'RECEIVING_ONE_PROFILE');
      if (!this.control.isReceiveReady(slug)) {
        throw new DomainError('GATEWAY_DISABLED', 'control is not receive-ready immediately before arm');
      }
      // Step 9: bounded recovery, then arm — only now may the raw transport parse and deliver an Events API envelope.
      await service.recoverPending();
      socket.armReceive();

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
      this.receiving = true;
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
    if (!this.control.isIncidentGateOpen()) {
      // A SIGUSR2 incident closed the gate during startup → durable kill, never a clean rollback.
      try {
        await this.control.operatorIncidentKill();
      } catch (error) {
        ambiguities.push(`KILL:${redactError(error).code}`);
      }
      if (!this.control.isGloballyLatched()) ambiguities.push('KILL_NOT_ENGAGED');
    } else {
      try {
        await this.control.rollbackToDisabled();
      } catch (error) {
        ambiguities.push(`ROLLBACK:${redactError(error).code}`);
        try {
          await this.control.engageGlobalKill(`ambiguous startup revert: ${redactError(error).code}`);
        } catch (killError) {
          ambiguities.push(`FALLBACK_KILL:${redactError(killError).code}`);
        }
      }
    }
    const status = this.status();
    let lockReleased = true;
    try {
      await this.control.close();
    } catch (error) {
      lockReleased = false;
      ambiguities.push(`RELEASE:${redactError(error).code}`);
    }
    const cleanupProven = ambiguities.length === 0 && lockReleased;
    this.lastCleanup = {
      ...status,
      cleanupProven,
      lockReleased,
      detail: cleanupProven ? 'CLEANUP_PROVEN' : `CLEANUP_AMBIGUOUS:${ambiguities.join(',')}`,
      ambiguities,
    };
  }

  /** The intake id the socket handler recorded for the one accepted root (design §7). */
  public lastIntake(): string | null {
    return this.lastIntakeId;
  }

  /**
   * Post-intake delivery (design §9). After the intake + pointer are durable, poll the construction-bound mission
   * authority root for the pointer-delivery grant and the sibling readiness lease, require the live predicate, and
   * perform exactly one pinned-byte tmux attempt through the reviewed journal. Absence is AWAITING, never approval.
   */
  public async deliverPending(): Promise<As1DeliveryResult | { readonly phase: 'AWAITING'; readonly outcome: 'AWAITING_POINTER_DELIVERY_GRANT' | 'AWAITING_READINESS_LEASE'; readonly reason: string }> {
    const live = this.requireLive();
    const deps = this.requireDeps();
    const intakeId = this.lastIntakeId;
    if (intakeId === null) {
      return { phase: 'AWAITING', outcome: 'AWAITING_POINTER_DELIVERY_GRANT', reason: 'no intake yet' };
    }
    const base = `${this.missionAuthorityRoot}/runtime-authority/${live.slug}/${intakeId}`;
    const deliveryGrantPath = `${base}/pointer-delivery-grant.json`;
    // F03: re-observe the pointer-delivery grant with its internally bound accepted pair (once captured) so a
    // post-acceptance rewrite/deletion/ancestry reuse latches instead of silently re-accepting.
    const grantObs = await deps.gitSource.observe(deliveryGrantPath, this.acceptedDeliveryGrant ?? undefined);
    if (grantObs.status === 'DIVERGED') {
      await this.control.latchProfile(live.slug, `pointer-delivery grant diverged post-acceptance: ${grantObs.reason}`);
      return { phase: 'MANUAL_RECONCILIATION_REQUIRED', outcome: 'MANUAL_RECONCILIATION_REQUIRED', reason: 'DELIVERY_GRANT_DIVERGED' };
    }
    if (grantObs.status !== 'READY' || grantObs.bytes === null || grantObs.firstAddCommit === null || grantObs.blobSha256 === null) {
      return { phase: 'AWAITING', outcome: 'AWAITING_POINTER_DELIVERY_GRANT', reason: grantObs.reason };
    }
    const deliveryGrant = parsePointerDeliveryGrant(JSON.parse(grantObs.bytes.toString('utf8')));
    this.assertDeliveryGrantBinding(deliveryGrant, live);
    // F03: the observed delivery-grant + lease pairs stay PROVISIONAL — retained only AFTER the transport's full
    // provenance/binding/expiry/live-actionability acceptance below, never merely on observation.
    const provisionalDeliveryGrant: As1AcceptedArtifact = { firstAddCommit: grantObs.firstAddCommit, blobSha256: grantObs.blobSha256 };
    // F03: the readiness lease is re-observed with its own accepted pair (once retained) so a post-acceptance
    // rewrite/deletion/dirty lease latches instead of silently re-accepting or classifying as benign NOT_READY.
    const leaseObs = await deps.gitSource.observe(`${base}/readiness-lease.json`, this.acceptedLease ?? undefined);
    if (leaseObs.status === 'DIVERGED') {
      await this.control.latchProfile(live.slug, `readiness lease diverged post-acceptance: ${leaseObs.reason}`);
      return { phase: 'MANUAL_RECONCILIATION_REQUIRED', outcome: 'MANUAL_RECONCILIATION_REQUIRED', reason: 'READINESS_LEASE_DIVERGED' };
    }
    if (leaseObs.status !== 'READY' || leaseObs.bytes === null || leaseObs.firstAddCommit === null || leaseObs.blobSha256 === null) {
      return { phase: 'AWAITING', outcome: 'AWAITING_READINESS_LEASE', reason: leaseObs.reason };
    }
    const provisionalLease: As1AcceptedArtifact = { firstAddCommit: leaseObs.firstAddCommit, blobSha256: leaseObs.blobSha256 };
    const lease = parseReadinessLease(JSON.parse(leaseObs.bytes.toString('utf8')));
    // Build the one-use exact transport bound to the freshly-constructed delivery provenance gate. The gate proves
    // full provenance/binding/expiry inside deliver(); the live-actionability predicate follows. Fresh per attempt —
    // the durable journal, not the instance, enforces no-retry.
    const deliveryProvenance = deps.buildDeliveryProvenance({ deliveryGrantPath, accepted: provisionalDeliveryGrant, grant: deliveryGrant });
    const transport = new As1ExactTransport(
      () => this.clock.now(),
      this.stateRoot,
      live.profile,
      deps.tmuxPort,
      live.store,
      deliveryProvenance,
      { isDeliverable: () => Promise.resolve(this.control.isLiveDeliveryActionable(live.slug)) },
      (reason: string) => this.control.latchProfile(live.slug, reason),
    );
    const result = await transport.deliver(deliveryGrant, lease);
    if (result.outcome === 'DELIVERED') {
      // F03: ONLY a fully-accepted delivery atomically retains the accepted pairs for later evidence re-observation.
      this.acceptedDeliveryGrant = provisionalDeliveryGrant;
      this.acceptedLease = provisionalLease;
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
    const intakeId = this.lastIntakeId;
    if (intakeId === null) throw new DomainError('GATEWAY_DISABLED', 'no intake to ingest evidence for');
    const base = `${this.missionAuthorityRoot}/runtime-authority/${live.slug}/${intakeId}`;
    // F03: evidence construction REQUIRES an already-proven accepted delivery authority — never a first-observation
    // fallback. The accepted pair is retained only after a fully-accepted delivery, so its absence means no delivery
    // was proven and evidence must not be built.
    if (this.acceptedDeliveryGrant === null) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'evidence requires an already-accepted delivery authority');
    }
    // Re-observe the pointer-delivery grant with its bound accepted pair — a post-acceptance divergence latches the
    // profile rather than building evidence authority from a rewritten grant.
    const grantObs = await deps.gitSource.observe(`${base}/pointer-delivery-grant.json`, this.acceptedDeliveryGrant);
    if (grantObs.status === 'DIVERGED') {
      await this.control.latchProfile(live.slug, `pointer-delivery grant diverged at evidence: ${grantObs.reason}`);
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'pointer-delivery grant diverged post-acceptance');
    }
    if (grantObs.status !== 'READY' || grantObs.bytes === null) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'delivery grant is not ready for evidence authority');
    }
    const deliveryGrant = parsePointerDeliveryGrant(JSON.parse(grantObs.bytes.toString('utf8')));
    const { deliveryId } = parseContainedPointerRef(deliveryGrant);

    // F03 (Patch 2A): evidence ALSO requires the already-accepted readiness lease, re-observed with its retained
    // (firstAddCommit, blobSha256) pair BEFORE any evidence/outbound. The real owner reaches this method directly
    // (without a second deliverPending), so the lease must be re-proven here too: a divergent/deleted/dirty/rewritten
    // lease latches the profile and fails closed, and the re-observed lease is parsed and proven to be the SAME lease
    // bound to the accepted delivery authority — acceptance is never inferred from the stored pair alone.
    if (this.acceptedLease === null) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'evidence requires an already-accepted readiness lease');
    }
    const leaseObs = await deps.gitSource.observe(`${base}/readiness-lease.json`, this.acceptedLease);
    if (leaseObs.status === 'DIVERGED') {
      await this.control.latchProfile(live.slug, `readiness lease diverged at evidence: ${leaseObs.reason}`);
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'readiness lease diverged post-acceptance');
    }
    if (leaseObs.status !== 'READY' || leaseObs.bytes === null) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'readiness lease is not ready for evidence authority');
    }
    const evidenceLease = parseReadinessLease(JSON.parse(leaseObs.bytes.toString('utf8')));
    this.assertLeaseBoundToDelivery(evidenceLease, deliveryGrant);

    const receiveGrantState = await live.store.readReceiveGrantState(live.grant.receiveGrantId);
    const terminalDelivery = await live.store.readTmuxDeliveryRecord(deliveryId);
    const rootCorrelation = await live.store.findRootByIntakeId(intakeId);
    const consumption = await live.store.readDeliveryAuthorityConsumption(deliveryGrant.pointerDeliveryGrantId);
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
    const ingress = new As1EvidenceIngress(
      live.profile,
      live.store,
      deps.evidenceVerifier,
      authority,
      (reason: string) => this.control.latchProfile(live.slug, reason),
    );
    const profileSecret = live.secret.secretFor(live.profile.profileId);
    const outbox = new As1Outbox({
      profile: live.profile,
      secret: { workspaceId: live.wire.workspaceId, appId: live.wire.appId, channelId: live.wire.channelId, botToken: profileSecret.botToken },
      store: live.store,
      web: deps.web,
      latch: (reason: string) => this.control.latchProfile(live.slug, reason),
      assertSendable: () => {
        if (!this.control.isLiveDeliveryActionable(live.slug)) {
          return Promise.reject(new DomainError('GATEWAY_DISABLED', 'profile is not sendable'));
        }
        return Promise.resolve();
      },
      delay: () => Promise.resolve(),
    });
    const outcomes: string[] = [];
    // The private Phase B round trip exercises only ACK -> INTAKE -> RESULT (no question cycle).
    for (const kind of ['ACK', 'INTAKE', 'RESULT'] as const) {
      const evidenceObs = await deps.gitSource.observe(`${authority.evidencePrefix}/${intakeId}/${kind.toLowerCase()}.json`);
      if (evidenceObs.status !== 'READY' || evidenceObs.bytes === null) {
        outcomes.push(`${kind}:NOT_READY`);
        continue;
      }
      const value: unknown = JSON.parse(evidenceObs.bytes.toString('utf8'));
      const ref = { repositoryId: deps.gitSource.getRepositoryId(), sourceCommit: evidenceObs.firstAddCommit ?? '', path: `${authority.evidencePrefix}/${intakeId}/${kind.toLowerCase()}.json`, blobSha256: evidenceObs.blobSha256 ?? '' };
      const ingested = await ingress.ingest(kind, value, ref);
      outcomes.push(`${kind}:${ingested.outcome}`);
      if (ingested.outcome === 'ACCEPTED' && ingested.accepted !== null) {
        const sent = await outbox.send(ingested.accepted);
        outcomes.push(`${kind}_OUTBOUND:${sent.outcome}`);
      }
    }
    return outcomes;
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
    await this.control.close();
    this.closed = true;
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
    const reObserved = await deps.gitSource.observe(live.receiveGrantRef, live.acceptedReceiveGrant);
    if (reObserved.status === 'DIVERGED') {
      await this.control.latchProfile(live.slug, `receive-grant diverged post-acceptance: ${reObserved.reason}`);
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
