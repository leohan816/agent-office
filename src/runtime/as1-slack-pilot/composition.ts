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
  parseReadinessLease,
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
import { As1SlackControl, type As1GlobalState, type As1ProfileSlug } from '../../operations/readiness/as1-slack-control.js';

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
 * The composition's injected collaborators. Production wires the real Git source, Slack Web/Socket, and tmux
 * ports plus the real Git provenance gates; a synthetic test wires fakes. NONE is selected per-round-trip and
 * NONE is a Slack/CLI/env value; the immutable receive grant remains the only profile selector.
 */
export interface As1CompositionDependencies {
  readonly gitSource: As1GitArtifactObserver;
  readonly web: As1WebPort;
  readonly tmuxPort: As1TmuxObservationPort;
  readonly buildSocket: (bindings: As1SocketBindings) => As1CompositionSocketPort;
  readonly receiveGrantProvenance: As1ReceiveGrantProvenanceGate;
  readonly deliveryProvenance: As1DeliveryProvenanceGate;
  readonly evidenceVerifier: As1GitProvenanceVerifier;
  readonly missionAuthorityRoot?: string;
}

interface LiveState {
  readonly profile: As1Profile;
  readonly slug: As1ProfileSlug;
  readonly grant: As1PilotReceiveGrantV1;
  readonly acceptedReceiveGrant: As1AcceptedArtifact;
  readonly secret: As1SecretConfig;
  readonly wire: As1ProfileWireIdentity;
  readonly store: As1ProfileInboundStore;
  readonly service: As1InboundService;
  readonly socket: As1CompositionSocketPort;
  readonly transport: As1ExactTransport;
}

/** The composed foreground gateway. It owns the single-process WriterLock through the lock-owning control. */
export class As1GatewayComposition {
  private control: As1SlackControl;
  private closed = false;
  private live: LiveState | null = null;
  private lastIntakeId: string | null = null;
  private receiving = false;

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
    },
  ): Promise<As1GatewayComposition> {
    const foreground = options.deps !== undefined;
    const control = await As1SlackControl.open(options.stateRoot, options.clock, { retainLockForForeground: foreground });
    return new As1GatewayComposition(descriptor, control, options.stateRoot, options.clock, options.deps ?? null);
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
    // Enforce the fixed contained profile-state-root binding (design §5.2): the grant's ref/hash must equal the
    // selected literal, so the environment's common root can never choose the other profile's contained root.
    this.assertProfileStateRootBinding(grant, slug);

    // Step 3: durably move to RECEIVE_GRANTED_ONE_PROFILE for the grant-selected slug.
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

    // Step 6/7: durably AUTHENTICATE, prove auth.test/bots.info/hello identity, and leave AUTHENTICATED_QUARANTINE.
    await this.control.transition('RECEIVE_GRANTED_ONE_PROFILE', 'AUTHENTICATING_ONE_PROFILE');
    const verifier = new As1StartupIdentityVerifier(
      () => this.clock.now(),
      deps.receiveGrantProvenance,
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

    // The exact transport binds the selected profile, state root, live predicate, and durable latch at construction.
    const transport = new As1ExactTransport(
      () => this.clock.now(),
      this.stateRoot,
      profile,
      deps.tmuxPort,
      store,
      deps.deliveryProvenance,
      { isDeliverable: () => Promise.resolve(this.control.isLiveDeliveryActionable(slug)) },
      (reason: string) => this.control.latchProfile(slug, reason),
    );

    this.live = {
      profile,
      slug,
      grant,
      acceptedReceiveGrant: { firstAddCommit: observed.firstAddCommit, blobSha256: observed.blobSha256 },
      secret,
      wire,
      store,
      service,
      socket,
      transport,
    };
    this.receiving = true;
    return { connected: true, reason: 'RECEIVING_ARMED', state: this.control.getState() };
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
    const intakeId = this.lastIntakeId;
    if (intakeId === null) {
      return { phase: 'AWAITING', outcome: 'AWAITING_POINTER_DELIVERY_GRANT', reason: 'no intake yet' };
    }
    const base = `${this.missionAuthorityRoot}/runtime-authority/${live.slug}/${intakeId}`;
    const grantObs = await this.deps?.gitSource.observe(`${base}/pointer-delivery-grant.json`);
    if (grantObs?.status !== 'READY' || grantObs.bytes === null) {
      return { phase: 'AWAITING', outcome: 'AWAITING_POINTER_DELIVERY_GRANT', reason: grantObs?.reason ?? 'no delivery grant' };
    }
    const deliveryGrant = parsePointerDeliveryGrant(JSON.parse(grantObs.bytes.toString('utf8')));
    this.assertDeliveryGrantBinding(deliveryGrant, live);
    const leaseObs = await this.deps?.gitSource.observe(`${base}/readiness-lease.json`);
    if (leaseObs?.status !== 'READY' || leaseObs.bytes === null) {
      return { phase: 'AWAITING', outcome: 'AWAITING_READINESS_LEASE', reason: leaseObs?.reason ?? 'no readiness lease' };
    }
    const lease = parseReadinessLease(JSON.parse(leaseObs.bytes.toString('utf8')));
    return live.transport.deliver(deliveryGrant, lease);
  }

  /**
   * Evidence ingress + same-thread outbound (design §10). Build the immutable evidence authority from the typed
   * accepted artifacts, then ingest ACK -> INTAKE -> RESULT and project only the branded accepted outbound to the
   * one original Leo root thread. The private one-round-trip run neither enumerates nor projects questions.
   */
  public async ingestEvidenceAndProject(): Promise<readonly string[]> {
    const live = this.requireLive();
    const intakeId = this.lastIntakeId;
    if (intakeId === null || this.deps === null) throw new DomainError('GATEWAY_DISABLED', 'no intake to ingest evidence for');
    const base = `${this.missionAuthorityRoot}/runtime-authority/${live.slug}/${intakeId}`;
    const grantObs = await this.deps.gitSource.observe(`${base}/pointer-delivery-grant.json`);
    if (grantObs.status !== 'READY' || grantObs.bytes === null) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'delivery grant is not ready for evidence authority');
    }
    const deliveryGrant = parsePointerDeliveryGrant(JSON.parse(grantObs.bytes.toString('utf8')));
    const { deliveryId } = parseContainedPointerRef(deliveryGrant);

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
      this.deps.evidenceVerifier,
      authority,
      (reason: string) => this.control.latchProfile(live.slug, reason),
    );
    const profileSecret = live.secret.secretFor(live.profile.profileId);
    const outbox = new As1Outbox({
      profile: live.profile,
      secret: { workspaceId: live.wire.workspaceId, appId: live.wire.appId, channelId: live.wire.channelId, botToken: profileSecret.botToken },
      store: live.store,
      web: this.deps.web,
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
      const evidenceObs = await this.deps.gitSource.observe(`${authority.evidencePrefix}/${intakeId}/${kind.toLowerCase()}.json`);
      if (evidenceObs.status !== 'READY' || evidenceObs.bytes === null) {
        outcomes.push(`${kind}:NOT_READY`);
        continue;
      }
      const value: unknown = JSON.parse(evidenceObs.bytes.toString('utf8'));
      const ref = { repositoryId: this.deps.gitSource.getRepositoryId(), sourceCommit: evidenceObs.firstAddCommit ?? '', path: `${authority.evidencePrefix}/${intakeId}/${kind.toLowerCase()}.json`, blobSha256: evidenceObs.blobSha256 ?? '' };
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
  public async stop(): Promise<As1RedactedStatus> {
    this.assertOpen();
    this.closed = true;
    if (this.live !== null) {
      await this.live.socket.disconnect().catch(() => undefined);
    }
    return this.drainAndRelease();
  }

  /**
   * Durable operator incident kill (design §11.2). Synchronously close the incident gate (no new side effect may
   * begin), then durably engage the irreversible global kill, disconnect the Socket, and release the lock. It never
   * transitions the killed control to DISABLED_CLEAN.
   */
  public async incidentKill(): Promise<As1RedactedStatus> {
    this.assertOpen();
    this.control.closeIncidentGate();
    this.closed = true;
    await this.control.operatorIncidentKill();
    if (this.live !== null) {
      await this.live.socket.disconnect().catch(() => undefined);
    }
    const status = this.status();
    await this.control.close();
    return status;
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

  private async drainAndRelease(): Promise<As1RedactedStatus> {
    try {
      await this.control.shutdown();
    } catch (error) {
      await this.control.engageGlobalKill(`ambiguous shutdown drain: ${redactError(error).code}`);
      await this.control.close();
      throw error;
    }
    this.receiving = false;
    const status = this.status();
    await this.control.close();
    return status;
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

  /** The selected profile's contained state-root binding must be exactly the reviewed literal (design §5.2). */
  private assertProfileStateRootBinding(grant: As1PilotReceiveGrantV1, slug: As1ProfileSlug): void {
    const expectedRef = `indexes/as1-slack-pilot/profiles/${slug}`;
    if (grant.profileStateRootRef !== expectedRef) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'receive grant profileStateRootRef is not the selected contained literal');
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
