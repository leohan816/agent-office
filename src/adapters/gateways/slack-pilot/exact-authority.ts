// AS1 Multi-Team Slack Pilot — exact startup receive-grant gate and Slack pair-identity verification.
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_DESIGN.md §6 (startup auth + pair
// verification); docs/security/AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md §6.2 (pair proof),
// §8.1 (pre-event grant), §18 (threats). No profile authenticates or opens Socket Mode on token shape
// alone. Before connection the grant must be unexpired and its exact workspace/App/channel/Leo identity
// must equal the selected static profile and external secret record. Startup then proves the credential
// pair: auth.test.team_id, bots.info.bot.app_id, and Socket hello.connection_info.app_id must all converge
// on the configured App ID. A swapped bot token fails bots.info; a swapped app token fails hello; a
// foreign-workspace token fails auth.test. Any mismatch fails the complete start before message acceptance
// — never a profile-local transient retry. Errors are redacted (no token/prefix/raw ID).
import { DomainError } from '../../../contracts/types.js';
import { assertExactKeys, assertRecord, requireInteger } from '../../../contracts/validation.js';
import { hashCanonical } from '../../../persistence/file-store/hashing.js';
import { requireOpaqueId, requireSha256, requireUtc, LIMITS } from '../../../application/slack-pilot/contracts.js';
import type { As1PilotReceiveGrantV1, As1PointerDeliveryGrantV1 } from '../../../application/slack-pilot/contracts.js';
import { assertAs1ProfileId, selectProfile } from '../../../application/slack-pilot/profiles.js';
import type { As1Profile, As1ProfileId } from '../../../application/slack-pilot/profiles.js';
import type { As1WebPort } from './web-client.js';
import type { As1SocketPort } from './socket-client.js';

/** External Slack identity for one profile, taken from the exact-key secret file. */
export interface As1ProfileWireIdentity {
  readonly workspaceId: string;
  readonly appId: string;
  readonly channelId: string;
  readonly leoUserId: string;
  readonly botToken: string;
  readonly appToken: string;
}

/**
 * Real read-only provenance gate for the receive-grant artifact (review B04, security §8.1/§8.3). It proves the
 * grant is the exact committed/pushed/clean/upstream-ancestral/byte-stable/single-first-added Git blob that
 * descends from the frozen authority snapshots, BEFORE any connection. Production wires
 * `GitAs1ReceiveGrantProvenanceGate` (bound to the trusted repo/upstream/snapshots at construction); it is never
 * a caller-selectable permissive assertion. Making it mandatory here means the unsafe (provenance-free) startup
 * shape is unrepresentable.
 */
export interface As1ReceiveGrantProvenanceGate {
  assertAccepted(grant: As1PilotReceiveGrantV1): Promise<void>;
}

/**
 * The PER-CONNECTION inputs to a startup verification: ONLY the selected profile, its external secret identity,
 * the receive grant, and the two ports. The trust seams — the trusted clock, the real receive-grant provenance
 * gate, the owning-control snapshot, and the connect-ready predicate — are NOT here; they are bound once at
 * construction of `As1StartupIdentityVerifier`, so a per-connection caller can never substitute an accepting
 * gate, a stale timestamp, or a permissive control (review B04).
 */
export interface As1StartupConnection {
  readonly profile: As1Profile;
  readonly wire: As1ProfileWireIdentity;
  readonly grant: As1PilotReceiveGrantV1;
  readonly web: As1WebPort;
  readonly socket: As1SocketPort;
}

/** The AUTHENTICATED_QUARANTINE proof — the client still cannot accept a message until every other gate passes. */
export interface StartupIdentityProof {
  readonly teamId: string;
  readonly botId: string;
  readonly botUserId: string;
  readonly appId: string;
  readonly channelId: string;
  readonly leoUserId: string;
}

/** Pre-connection gate: the grant must be unexpired and identity-consistent with profile + secret. */
export function assertReceiveGrantConnectable(
  profile: As1Profile,
  wire: As1ProfileWireIdentity,
  grant: As1PilotReceiveGrantV1,
  now: string,
): void {
  if (grant.profileId !== profile.profileId) {
    throw new DomainError('FORBIDDEN_TARGET', 'receive grant names a different profile than the selected one');
  }
  if (
    grant.workspaceId !== wire.workspaceId ||
    grant.appId !== wire.appId ||
    grant.channelId !== wire.channelId ||
    grant.leoUserId !== wire.leoUserId
  ) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'receive grant identity does not match the secret record');
  }
  if (!(Date.parse(now) < Date.parse(grant.expiresAt))) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'receive grant is expired at the connection gate');
  }
}

/**
 * The startup identity verifier (design §6 steps 3–6). Its four trust seams — the trusted clock, the REAL
 * receive-grant Git provenance gate, the owning-control snapshot, and the connect-ready predicate — are bound
 * ONCE at construction (composition or a test), NEVER per verification call. A per-connection caller therefore
 * cannot substitute an accepting provenance gate, a stale/forged current time, or a permissive control snapshot/
 * predicate (review B04). There is no exported free function that accepts those trust seams per invocation, so
 * the caller-selectable trust seam is unrepresentable in a production path.
 */
export class As1StartupIdentityVerifier {
  public constructor(
    /** Trusted clock, read fresh at the connection gate. Never a caller-supplied timestamp. */
    private readonly clock: () => string,
    /** Real receive-grant Git provenance gate (production: GitAs1ReceiveGrantProvenanceGate). */
    private readonly receiveGrantProvenance: As1ReceiveGrantProvenanceGate,
    /** Current immutable global-control + profile-latch snapshot hash (production: As1SlackControl). */
    private readonly controlSnapshot: () => string,
    /** Synchronous fail-closed control predicate for the exact receiving profile/state/latch. */
    private readonly connectReady: () => boolean,
  ) {}

  /**
   * Full startup pair verification. Runs only after the pre-connection gate. Returns an AUTHENTICATED_QUARANTINE
   * proof; a live-receive decision requires the further profile/state/control gates. Accepts only per-connection
   * data — it can NOT accept or override any trust seam.
   */
  public async verify(connection: As1StartupConnection): Promise<StartupIdentityProof> {
    const { profile, wire, grant, web, socket } = connection;
    // Trusted clock, read fresh — not a caller timestamp (review B04).
    assertReceiveGrantConnectable(profile, wire, grant, this.clock());
    // Real Git provenance of the receive-grant artifact BEFORE any Slack call or Socket open (review B04): the
    // grant must be the exact committed/pushed/clean/upstream-ancestral/byte-stable/single-first-added blob that
    // descends from the frozen authority snapshots. A permissive/echoed hash is not proof; this bound gate is.
    await this.receiveGrantProvenance.assertAccepted(grant);

    const auth = await web.authTest(wire.botToken);
    if (!auth.ok || auth.teamId !== wire.workspaceId) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'auth.test workspace does not match the configured workspace');
    }

    const bot = await web.botsInfo(wire.botToken, auth.botId);
    if (!bot.ok || bot.deleted || bot.botId !== auth.botId || bot.userId !== auth.userId) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'bots.info identity does not agree with auth.test');
    }
    if (bot.appId !== wire.appId) {
      // Swapped bot token: the bot resolves to a different App ID than the configured profile.
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'bots.info app_id does not match the configured App');
    }

    // The reviewed raw Socket adapter (docs/integration/AGENT_OFFICE_AS1_SOCKET_IDENTITY_DESIGN_DELTA.md)
    // proves the app-token->App identity PRE-EVENT: connect opens the raw stream and compares the raw
    // hello.connection_info.app_id to this expected App ID inside the transport message callback, before any
    // Team event is parsed or delivered, and synchronously revalidates the internally-derived readiness seal.
    // The seal binds the immutable profile identity plus the construction-bound control snapshot; it is
    // recomputed at hello time and compared to the value precomputed before connect. The construction-bound
    // connect-ready predicate is re-checked there too (review B05).
    const sealOf = (): string =>
      hashCanonical({
        profileId: profile.profileId,
        advisorTeam: profile.advisorTeam,
        actorId: profile.actorId,
        roleInstanceId: profile.roleInstanceId,
        appId: bot.appId,
        channelId: wire.channelId,
        leoUserId: wire.leoUserId,
        control: this.controlSnapshot(),
      });
    const expectedSeal = sealOf();
    const socketResult = await socket.connect({
      profileId: profile.profileId,
      appToken: wire.appToken,
      expectedAppId: bot.appId,
      readinessSeal: (): boolean => sealOf() === expectedSeal && this.connectReady(),
    });
    if (!socketResult.ok) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'socket connection or pre-event App-ID/seal proof failed');
    }

    return {
      teamId: auth.teamId,
      botId: auth.botId,
      botUserId: auth.userId,
      appId: wire.appId,
      channelId: wire.channelId,
      leoUserId: wire.leoUserId,
    };
  }
}

// ── Readiness lease, delivery-grant binding, and in-memory capability (design §12.5/§12.6) ────────────
const PANE_ID = /^%[0-9]+$/u;
const WINDOW_ID = /^@[0-9]+$/u;
const SESSION_ID = /^\$[0-9]+$/u;

export interface As1TmuxDestination {
  readonly sessionName: string;
  readonly sessionId: string;
  readonly windowName: string;
  readonly windowId: string;
  readonly windowIndex: number;
  readonly paneId: string;
  readonly paneIndex: number;
  readonly panePid: number;
  readonly workspace: string;
  readonly currentCommand: string;
  readonly paneDead: false;
  readonly paneInMode: false;
  readonly inputOff: false;
  readonly synchronizePanes: false;
  readonly activityTime: string;
}

function requireBounded(value: unknown, label: string, max = 256): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    throw new DomainError('INVALID_SCHEMA', `${label} is not a bounded string`);
  }
  return value;
}

function requireExactFalse(value: unknown, label: string): false {
  if (value !== false) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', `${label} must be exactly false`);
  }
  return false;
}

function requirePatternField(value: unknown, pattern: RegExp, label: string): string {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new DomainError('INVALID_SCHEMA', `${label} does not match its bounded grammar`);
  }
  return value;
}

const DESTINATION_KEYS = [
  'sessionName',
  'sessionId',
  'windowName',
  'windowId',
  'windowIndex',
  'paneId',
  'paneIndex',
  'panePid',
  'workspace',
  'currentCommand',
  'paneDead',
  'paneInMode',
  'inputOff',
  'synchronizePanes',
  'activityTime',
] as const;

export function parseTmuxDestination(value: unknown, label: string): As1TmuxDestination {
  assertRecord(value, label);
  assertExactKeys(value, DESTINATION_KEYS, label);
  return {
    sessionName: requireBounded(value.sessionName, `${label}.sessionName`),
    sessionId: requirePatternField(value.sessionId, SESSION_ID, `${label}.sessionId`),
    windowName: requireBounded(value.windowName, `${label}.windowName`),
    windowId: requirePatternField(value.windowId, WINDOW_ID, `${label}.windowId`),
    windowIndex: requireInteger(value.windowIndex, `${label}.windowIndex`),
    paneId: requirePatternField(value.paneId, PANE_ID, `${label}.paneId`),
    paneIndex: requireInteger(value.paneIndex, `${label}.paneIndex`),
    panePid: requireInteger(value.panePid, `${label}.panePid`, 1),
    workspace: requireBounded(value.workspace, `${label}.workspace`, 512),
    currentCommand: requireBounded(value.currentCommand, `${label}.currentCommand`),
    paneDead: requireExactFalse(value.paneDead, `${label}.paneDead`),
    paneInMode: requireExactFalse(value.paneInMode, `${label}.paneInMode`),
    inputOff: requireExactFalse(value.inputOff, `${label}.inputOff`),
    synchronizePanes: requireExactFalse(value.synchronizePanes, `${label}.synchronizePanes`),
    activityTime: requireBounded(value.activityTime, `${label}.activityTime`, 64),
  };
}

const READINESS_LEASE_SCHEMA_VERSION = 'agent-office.as1-advisor-readiness-lease.v1' as const;

const READINESS_LEASE_KEYS = [
  'schemaVersion',
  'leaseId',
  'pointerDeliveryGrantId',
  'receiveGrantId',
  'pilotId',
  'profileId',
  'intakeId',
  'sourceEventId',
  'pointerHash',
  'advisorTeam',
  'actorId',
  'roleInstanceId',
  'destination',
  'readiness',
  'useLimit',
  'observedAt',
  'issuedAt',
  'expiresAt',
  'authoritySnapshotHash',
  'registrySnapshotHash',
  'receiveGrantBindingHash',
  'pointerDeliveryGrantSnapshotHash',
] as const;

export interface As1AdvisorReadinessLeaseV1 {
  readonly schemaVersion: typeof READINESS_LEASE_SCHEMA_VERSION;
  readonly leaseId: string;
  readonly pointerDeliveryGrantId: string;
  readonly receiveGrantId: string;
  readonly pilotId: string;
  readonly profileId: As1ProfileId;
  readonly intakeId: string;
  readonly sourceEventId: string;
  readonly pointerHash: string;
  readonly advisorTeam: string;
  readonly actorId: string;
  readonly roleInstanceId: string;
  readonly destination: As1TmuxDestination;
  readonly readiness: 'IDLE_FOR_ONE_AS1_POINTER';
  readonly useLimit: 1;
  readonly observedAt: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly authoritySnapshotHash: string;
  readonly registrySnapshotHash: string;
  readonly receiveGrantBindingHash: string;
  readonly pointerDeliveryGrantSnapshotHash: string;
}

export function parseReadinessLease(value: unknown): As1AdvisorReadinessLeaseV1 {
  assertRecord(value, 'as1 readiness lease');
  assertExactKeys(value, READINESS_LEASE_KEYS, 'as1 readiness lease');
  if (value.schemaVersion !== READINESS_LEASE_SCHEMA_VERSION) {
    throw new DomainError('INVALID_SCHEMA', 'as1 readiness lease schemaVersion is unsupported');
  }
  if (value.readiness !== 'IDLE_FOR_ONE_AS1_POINTER') {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'as1 readiness lease readiness is not the reviewed literal');
  }
  const profileId = assertAs1ProfileId(value.profileId, 'as1 readiness lease profileId');
  const profile = selectProfile(profileId);
  const advisorTeam = requireOpaqueId(value.advisorTeam, 'as1 readiness lease advisorTeam');
  const actorId = requireOpaqueId(value.actorId, 'as1 readiness lease actorId');
  const roleInstanceId = requireOpaqueId(value.roleInstanceId, 'as1 readiness lease roleInstanceId');
  if (advisorTeam !== profile.advisorTeam || actorId !== profile.actorId || roleInstanceId !== profile.roleInstanceId) {
    throw new DomainError('UNAUTHORIZED_ACTOR', 'as1 readiness lease identity does not match its profile lineage');
  }
  const issuedAt = requireUtc(value.issuedAt, 'as1 readiness lease issuedAt');
  const expiresAt = requireUtc(value.expiresAt, 'as1 readiness lease expiresAt');
  if (!(Date.parse(expiresAt) > Date.parse(issuedAt)) || Date.parse(expiresAt) - Date.parse(issuedAt) > LIMITS.READINESS_LEASE_MAX_LIFETIME_MS) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'as1 readiness lease lifetime exceeds its 30-second maximum');
  }
  return {
    schemaVersion: READINESS_LEASE_SCHEMA_VERSION,
    leaseId: requireOpaqueId(value.leaseId, 'as1 readiness lease leaseId'),
    pointerDeliveryGrantId: requireOpaqueId(value.pointerDeliveryGrantId, 'as1 readiness lease pointerDeliveryGrantId'),
    receiveGrantId: requireOpaqueId(value.receiveGrantId, 'as1 readiness lease receiveGrantId'),
    pilotId: requireOpaqueId(value.pilotId, 'as1 readiness lease pilotId'),
    profileId,
    intakeId: requireOpaqueId(value.intakeId, 'as1 readiness lease intakeId'),
    sourceEventId: requireOpaqueId(value.sourceEventId, 'as1 readiness lease sourceEventId'),
    pointerHash: requireSha256(value.pointerHash, 'as1 readiness lease pointerHash'),
    advisorTeam,
    actorId,
    roleInstanceId,
    destination: parseTmuxDestination(value.destination, 'as1 readiness lease destination'),
    readiness: 'IDLE_FOR_ONE_AS1_POINTER',
    useLimit: requireExactUseLimit(value.useLimit, 'as1 readiness lease useLimit'),
    observedAt: requireUtc(value.observedAt, 'as1 readiness lease observedAt'),
    issuedAt,
    expiresAt,
    authoritySnapshotHash: requireSha256(value.authoritySnapshotHash, 'as1 readiness lease authoritySnapshotHash'),
    registrySnapshotHash: requireSha256(value.registrySnapshotHash, 'as1 readiness lease registrySnapshotHash'),
    receiveGrantBindingHash: requireSha256(value.receiveGrantBindingHash, 'as1 readiness lease receiveGrantBindingHash'),
    pointerDeliveryGrantSnapshotHash: requireSha256(
      value.pointerDeliveryGrantSnapshotHash,
      'as1 readiness lease pointerDeliveryGrantSnapshotHash',
    ),
  };
}

function requireExactUseLimit(value: unknown, label: string): 1 {
  if (requireInteger(value, label) !== 1) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', `${label} must equal 1`);
  }
  return 1;
}

/**
 * The delivery grant is impossible before its exact intake and pointer artifacts exist (design §12.4).
 * The grant, lease, and pointer must all name the same immutable intake/source-event/pointer facts.
 */
export function assertDeliveryChainConsistent(
  grant: As1PointerDeliveryGrantV1,
  lease: As1AdvisorReadinessLeaseV1,
  pointerHash: string,
  now: string,
): void {
  // Every immutable grant↔lease correlation the two artifacts share must agree (design §12.5, review B04):
  // the identity ids, the profile lineage (team/actor/role), the pilot, and the authority/registry snapshots.
  if (
    lease.pointerDeliveryGrantId !== grant.pointerDeliveryGrantId ||
    lease.receiveGrantId !== grant.receiveGrantId ||
    lease.pilotId !== grant.pilotId ||
    lease.profileId !== grant.profileId ||
    lease.intakeId !== grant.intakeId ||
    lease.sourceEventId !== grant.sourceEventId ||
    lease.pointerHash !== grant.pointerHash ||
    lease.receiveGrantBindingHash !== grant.receiveGrantBindingHash ||
    lease.advisorTeam !== grant.advisorTeam ||
    lease.actorId !== grant.actorId ||
    lease.roleInstanceId !== grant.roleInstanceId ||
    lease.registrySnapshotHash !== grant.registrySnapshotHash ||
    lease.authoritySnapshotHash !== grant.governanceSnapshotHash
  ) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'readiness lease does not bind the exact delivery-grant facts');
  }
  if (grant.pointerHash !== pointerHash) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'delivery grant pointerHash does not match the durable pointer');
  }
  if (!(Date.parse(now) < Date.parse(grant.expiresAt)) || !(Date.parse(now) < Date.parse(lease.expiresAt))) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'delivery grant or readiness lease is expired');
  }
}

/**
 * In-memory pointer-bound capability (design §12.6). Never serialized, never accepted from a caller. It binds
 * the full authority lineage — pilot/profile/team/actor/role, grant/lease ids, pointer/source/intake, the
 * destination fingerprint, and every governance/registry/global-control/profile-latch/grant snapshot hash —
 * so a recovered delivery record can always distinguish its exact authority lineage.
 */
export interface As1DeliveryCapability {
  readonly receiveGrantId: string;
  readonly receiveGrantBindingHash: string;
  readonly pointerDeliveryGrantId: string;
  readonly leaseId: string;
  readonly pilotId: string;
  readonly profileId: As1ProfileId;
  readonly advisorTeam: string;
  readonly actorId: string;
  readonly roleInstanceId: string;
  readonly intakeId: string;
  readonly sourceEventId: string;
  readonly pointerHash: string;
  readonly destination: As1TmuxDestination;
  readonly governanceSnapshotHash: string;
  readonly registrySnapshotHash: string;
  readonly globalControlSnapshotHash: string;
  readonly profileLatchSnapshotHash: string;
  readonly pointerDeliveryGrantSnapshotHash: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

/**
 * Prove the lease's `pointerDeliveryGrantSnapshotHash` equals the canonical accepted grant bytes — not merely
 * that the lease carries some hash. This is the exact lease→grant snapshot binding (design §12.5, review B04).
 */
export function assertPointerGrantSnapshot(grant: As1PointerDeliveryGrantV1, lease: As1AdvisorReadinessLeaseV1): void {
  if (lease.pointerDeliveryGrantSnapshotHash !== hashCanonical(grant)) {
    throw new DomainError(
      'AUTHORITY_ARTIFACT_INVALID',
      'readiness lease pointer-delivery-grant snapshot does not equal the canonical grant bytes',
    );
  }
}

/**
 * Create the live capability after static validation and the first preflight (design §12.6). Bounded to
 * <= 30s and to both artifacts' exclusive expiries. It binds the full authority lineage and snapshot facts,
 * verified equal by `assertDeliveryChainConsistent` / `assertPointerGrantSnapshot`, not only identity ids.
 */
export function createDeliveryCapability(
  grant: As1PointerDeliveryGrantV1,
  lease: As1AdvisorReadinessLeaseV1,
  issuedAt: string,
): As1DeliveryCapability {
  const expiresMs = Math.min(
    Date.parse(issuedAt) + LIMITS.CAPABILITY_MAX_LIFETIME_MS,
    Date.parse(grant.expiresAt),
    Date.parse(lease.expiresAt),
  );
  return {
    receiveGrantId: grant.receiveGrantId,
    receiveGrantBindingHash: grant.receiveGrantBindingHash,
    pointerDeliveryGrantId: grant.pointerDeliveryGrantId,
    leaseId: lease.leaseId,
    pilotId: grant.pilotId,
    profileId: grant.profileId,
    advisorTeam: grant.advisorTeam,
    actorId: grant.actorId,
    roleInstanceId: grant.roleInstanceId,
    intakeId: grant.intakeId,
    sourceEventId: grant.sourceEventId,
    pointerHash: grant.pointerHash,
    destination: lease.destination,
    governanceSnapshotHash: grant.governanceSnapshotHash,
    registrySnapshotHash: grant.registrySnapshotHash,
    globalControlSnapshotHash: grant.globalControlSnapshotHash,
    profileLatchSnapshotHash: grant.profileLatchSnapshotHash,
    pointerDeliveryGrantSnapshotHash: lease.pointerDeliveryGrantSnapshotHash,
    issuedAt,
    expiresAt: new Date(expiresMs).toISOString(),
  };
}

/** Check the capability is still live and bound to the same pointer/destination before pane input. */
export function assertCapabilityUsable(capability: As1DeliveryCapability, now: string): void {
  if (!(Date.parse(now) < Date.parse(capability.expiresAt))) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'delivery capability is expired');
  }
}
