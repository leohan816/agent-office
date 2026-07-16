// AS1 Multi-Team Slack Pilot — exact tmux pointer transport: pinned-byte seal, three complete destination
// observations, and the closed one-use delivery journal (Phase B, design §9).
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_PHASE_B_LIVE_COMPOSITION_DESIGN_DELTA.md §9 and
// docs/security/AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md §13 (tmux mutation). This is a SEPARATE
// transport from Exact Delivery v2. Phase B boundedly repairs F01–F03 in this already-listed path WITHOUT
// changing Exact Delivery v2 or any durable AS1 schema: the pointer is opened once no-follow under the exact
// private mode and 32-KiB scoped-writer ceiling; its on-disk canonical-plus-one-LF bytes, the delivery grant's
// `pointerHash`, and the content-addressed filename all share ONE raw SHA-256; those pinned bytes alone reach a
// closed tmux stdin (never a path reopen); the selected closed profile binds session/workspace/command; and all
// 15 live destination facts are compared in TWO complete precommit observations plus ONE complete post-load
// observation immediately before PASTE_STARTED. Every failure through the final precommit identity check has
// zero tmux mutation, no PREPARED record, and unconsumed authority; a post-load divergence is postcommit manual
// reconciliation with no paste, Enter, cleanup-as-rejection, or retry. PASTE_STARTED remains the no-retry
// boundary. The complete fixed `/usr/bin/tmux` argv set uses shell:false with no capture/show pane, show-buffer,
// run-shell, new-session, arbitrary argv, caller file/bytes/target, generic command, or message-body input.
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { spawn } from 'node:child_process';

import { DomainError } from '../../../contracts/types.js';
import { assertExactKeys, assertRecord } from '../../../contracts/validation.js';
import { canonicalBytes } from '../../../persistence/file-store/canonical-json.js';
import { hashCanonical, sha256Bytes } from '../../../persistence/file-store/hashing.js';
import { resolveContainedPath } from '../../../persistence/file-store/path-safety.js';
import {
  LIMITS,
  parseContainedPointerRef,
  redactError,
  requireArtifactRef,
  requireOpaqueId,
  requireSha256,
  requireUtc,
} from '../../../application/slack-pilot/contracts.js';
import type { As1AdvisorPointerV1, As1PointerDeliveryGrantV1 } from '../../../application/slack-pilot/contracts.js';
import type { As1TmuxDeliveryFacts, As1TmuxDeliveryPhase } from '../../../application/slack-pilot/inbound-store.js';
import type { As1Profile, As1ProfileId } from '../../../application/slack-pilot/profiles.js';
import {
  assertCapabilityUsable,
  assertDeliveryChainConsistent,
  assertPointerGrantSnapshot,
  createDeliveryCapability,
  parseTmuxDestination,
  type As1AdvisorReadinessLeaseV1,
  type As1DeliveryCapability,
  type As1TmuxDestination,
} from './exact-authority.js';

// The closed tmux delivery phase vocabulary is owned by the store (the journal record owner) and imported here
// as As1TmuxDeliveryPhase, so the sequence and the durable record can never diverge (review B08).

// Every nonterminal phase is interrupted-unsafe: on re-entry it becomes MANUAL_RECONCILIATION_REQUIRED and is
// never silently resumed or retried (design §9.4). Only a fresh (null) or terminal journal proceeds/returns.
const INTERRUPTED_NONTERMINAL_PHASES: readonly string[] = ['PREPARED', 'BUFFER_LOADED', 'PASTE_STARTED', 'PASTE_CONFIRMED', 'SUBMIT_STARTED'];

// ── LEGACY Phase A port shape (retained ONLY so the frozen fake in tests/helpers/as1-slack-fakes.ts still
// compiles). The Phase B transport uses `As1TmuxObservationPort` below; nothing in src constructs this shape. ──
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

export interface As1TmuxPort {
  preflight(paneId: string): Promise<As1TmuxPreflight>;
  bufferExists(bufferName: string): Promise<boolean>;
  loadBuffer(bufferName: string, pointerFilePath: string): Promise<void>;
  pasteBuffer(bufferName: string, paneId: string): Promise<void>;
  sendEnter(paneId: string): Promise<void>;
  deleteBuffer(bufferName: string): Promise<void>;
}

/**
 * The Phase B tmux observation/mutation port (design §9.3). Every operation targets ONLY the construction-derived
 * pane; `observe` returns all 15 live destination facts through the exact-key decoder; `loadVerifiedBuffer`
 * accepts ONLY the already-pinned bytes (never a path); paste/enter/delete carry no caller file/bytes/target.
 */
export interface As1TmuxObservationPort {
  observe(paneId: string): Promise<As1TmuxDestination>;
  bufferExists(bufferName: string): Promise<boolean>;
  loadVerifiedBuffer(bufferName: string, pinnedBytes: Buffer): Promise<void>;
  pasteBuffer(bufferName: string, paneId: string): Promise<void>;
  sendEnter(paneId: string): Promise<void>;
  deleteBuffer(bufferName: string): Promise<void>;
}

/** Durable per-profile tmux journal + one-use delivery-authority consumption (implemented by the store). */
export interface As1DeliveryJournal {
  recordTmuxPhase(deliveryId: string, phase: As1TmuxDeliveryPhase, facts?: As1TmuxDeliveryFacts): Promise<void>;
  readTmuxPhase(deliveryId: string): Promise<string | null>;
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

/** The accepted provenance/content seal (B06). The transport ALWAYS consults it before any side effect. */
export interface As1DeliveryProvenanceGate {
  assertAccepted(grant: As1PointerDeliveryGrantV1, lease: As1AdvisorReadinessLeaseV1): Promise<void>;
}

/**
 * The construction-bound live control/latch actionability predicate (design §5.3). The transport re-checks it
 * immediately before EVERY delivery side effect — every observation, PREPARED, authority consumption, buffer
 * lookup/deletion/load, paste, and Enter — so a kill/latch/incident engaged between two adjacent boundaries
 * prevents the next mutation. It is never a caller value and its live record is never serialized.
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

/** The internally derived delivery target — a pure function of the validated grant, never a caller value. */
interface As1DeliveryTarget {
  readonly profileStateSlug: string;
  readonly deliveryId: string;
  readonly bufferName: string;
  readonly pointerFilePath: string;
}

function deriveDeliveryTarget(grant: As1PointerDeliveryGrantV1): As1DeliveryTarget {
  const { profileStateSlug, deliveryId, pointerFilePath } = parseContainedPointerRef(grant);
  return { profileStateSlug, deliveryId, bufferName: `as1-${profileStateSlug}-${deliveryId}`, pointerFilePath };
}

// ── Pointer byte seal (design §9.2) ──────────────────────────────────────────────────────────────────────────
const ADVISOR_POINTER_KEYS = [
  'schemaVersion',
  'receiveGrantId',
  'receiveGrantBindingHash',
  'pilotId',
  'profileId',
  'intakeId',
  'intakeKind',
  'sourceEventId',
  'rootCorrelationHash',
  'intakeArtifactRef',
  'intakeArtifactHash',
  'recordedAt',
] as const;
const AS1_INTAKE_KINDS = ['NEW_MISSION', 'CLARIFICATION', 'DECISION_RESPONSE'] as const;
const AS1_PROFILE_ID_SET: ReadonlySet<string> = new Set<string>(['AGENT_OFFICE_ADVISOR', 'FOUNDATION_ADVISOR']);

/** Strict exact-key `agent-office.as1-advisor-pointer.v1` decoder (design §9.2 step 4). Never a build/free shape. */
function parseStrictAdvisorPointer(value: unknown): As1AdvisorPointerV1 {
  assertRecord(value, 'as1 advisor pointer');
  assertExactKeys(value, ADVISOR_POINTER_KEYS, 'as1 advisor pointer');
  if (value.schemaVersion !== 'agent-office.as1-advisor-pointer.v1') {
    throw new DomainError('INVALID_SCHEMA', 'as1 advisor pointer schemaVersion is unsupported');
  }
  if (typeof value.profileId !== 'string' || !AS1_PROFILE_ID_SET.has(value.profileId)) {
    throw new DomainError('FORBIDDEN_TARGET', 'as1 advisor pointer profileId is not a closed literal');
  }
  if (typeof value.intakeKind !== 'string' || !(AS1_INTAKE_KINDS as readonly string[]).includes(value.intakeKind)) {
    throw new DomainError('INVALID_SCHEMA', 'as1 advisor pointer intakeKind is not a reviewed literal');
  }
  return {
    schemaVersion: 'agent-office.as1-advisor-pointer.v1',
    receiveGrantId: requireOpaqueId(value.receiveGrantId, 'pointer receiveGrantId'),
    receiveGrantBindingHash: requireSha256(value.receiveGrantBindingHash, 'pointer receiveGrantBindingHash'),
    pilotId: requireOpaqueId(value.pilotId, 'pointer pilotId'),
    profileId: value.profileId as As1ProfileId,
    intakeId: requireOpaqueId(value.intakeId, 'pointer intakeId'),
    intakeKind: value.intakeKind as As1AdvisorPointerV1['intakeKind'],
    sourceEventId: requireOpaqueId(value.sourceEventId, 'pointer sourceEventId'),
    rootCorrelationHash: requireSha256(value.rootCorrelationHash, 'pointer rootCorrelationHash'),
    intakeArtifactRef: requireArtifactRef(value.intakeArtifactRef, 'pointer intakeArtifactRef'),
    intakeArtifactHash: requireSha256(value.intakeArtifactHash, 'pointer intakeArtifactHash'),
    recordedAt: requireUtc(value.recordedAt, 'pointer recordedAt'),
  };
}

/**
 * The pinned pointer: the exact on-disk bytes plus the RETAINED no-follow descriptor (F04). The descriptor is
 * held open through the final precommit identity proof — so the proof compares `lstat` of the path against the
 * still-open fd's own facts (an unlink/inode-reuse cannot spoof it) — and is closed EXACTLY after that proof on
 * every path (`close()` is idempotent, so the deliver `finally` is a safe net for reject-before-proof paths).
 */
class PinnedPointer {
  private handleClosed = false;
  public constructor(
    public readonly bytes: Buffer,
    public readonly rawSha256: string,
    public readonly absolutePath: string,
    private readonly handle: import('node:fs/promises').FileHandle,
  ) {}

  /** The RETAINED descriptor's own identity facts (its inode cannot change under an open fd). */
  public async retainedIdentity(): Promise<{
    readonly dev: bigint;
    readonly ino: bigint;
    readonly nlink: bigint;
    readonly mode: bigint;
    readonly uid: bigint;
    readonly isFile: boolean;
  }> {
    const st = await this.handle.stat({ bigint: true });
    return { dev: st.dev, ino: st.ino, nlink: st.nlink, mode: st.mode, uid: st.uid, isFile: st.isFile() };
  }

  public async close(): Promise<void> {
    if (this.handleClosed) return;
    this.handleClosed = true;
    await this.handle.close().catch(() => undefined);
  }
}

/** The 32-KiB scoped-writer pointer ceiling (design §9.2 step 3) — NOT the 1-MiB durable-index ceiling. */
const POINTER_LEAF_MAX_BYTES = 32 * 1024;

/**
 * Open, validate, hash, correlate, and PIN the exact pointer bytes (design §9.2). Any failure is a precommit
 * POINTER_ARTIFACT_INVALID that leaves the journal absent, authority unconsumed, and tmux untouched.
 */
async function pinPointer(stateRoot: string, grant: As1PointerDeliveryGrantV1, target: As1DeliveryTarget): Promise<PinnedPointer> {
  const invalid = (message: string): never => {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', message);
  };
  // 1. Validate every parent as contained, non-symlink; then open the leaf ONCE with O_RDONLY | O_NOFOLLOW.
  const absolutePath = await resolveContainedPath(stateRoot, target.pointerFilePath).catch(() =>
    invalid('pointer artifact path is not contained'),
  );
  const handle = await open(absolutePath, constants.O_RDONLY | constants.O_NOFOLLOW).catch(() =>
    invalid('pointer artifact could not be opened no-follow'),
  );
  try {
    // 3. fstat: owner-UID regular file, one link, no group/other bits at all, inclusive length 1..32 KiB.
    const st = await handle.stat({ bigint: true });
    const currentUid = process.getuid?.();
    if (
      !st.isFile() ||
      st.nlink !== 1n ||
      (Number(st.mode) & 0o077) !== 0 ||
      (currentUid !== undefined && Number(st.uid) !== currentUid) ||
      st.size < 1n ||
      st.size > BigInt(POINTER_LEAF_MAX_BYTES)
    ) {
      return invalid('pointer artifact is not an owner-only one-link regular file within the 32-KiB bound');
    }
    const size = Number(st.size);
    // 4. Read exactly `size` bytes from the retained descriptor; require the exact count and EOF.
    const buffer = Buffer.allocUnsafe(size + 1);
    const first = await handle.read(buffer, 0, size + 1, 0);
    if (first.bytesRead !== size) return invalid('pointer artifact byte count changed under the retained descriptor');
    const onDiskBytes = buffer.subarray(0, size);
    let parsed: unknown;
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(onDiskBytes);
      parsed = JSON.parse(text);
    } catch {
      return invalid('pointer artifact is not valid UTF-8 JSON');
    }
    const strictlyParsedPointer = parseStrictAdvisorPointer(parsed);
    // 5. Require the on-disk bytes to equal EXACTLY canonical(pointer) + one LF — one terminal LF, nothing else.
    const canonical = Buffer.concat([canonicalBytes(strictlyParsedPointer), Buffer.from('\n', 'utf8')]);
    if (!onDiskBytes.equals(canonical)) {
      return invalid('pointer artifact is not canonical-plus-one-LF bytes');
    }
    // 6. One raw SHA-256 binds the grant hash AND the content-addressed leaf filename.
    const rawSha256 = sha256Bytes(onDiskBytes);
    if (grant.pointerHash !== rawSha256) return invalid('pointer artifact raw hash does not equal the grant pointerHash');
    const leafName = absolutePath.slice(absolutePath.lastIndexOf('/') + 1);
    if (leafName !== `${rawSha256.slice('sha256:'.length)}.json`) {
      return invalid('pointer artifact leaf is not the content-addressed filename');
    }
    // 7. Exact pointer correlations to the grant (receive grant/binding, pilot, profile, intake, source, root).
    if (
      strictlyParsedPointer.receiveGrantId !== grant.receiveGrantId ||
      strictlyParsedPointer.receiveGrantBindingHash !== grant.receiveGrantBindingHash ||
      strictlyParsedPointer.pilotId !== grant.pilotId ||
      strictlyParsedPointer.profileId !== grant.profileId ||
      strictlyParsedPointer.intakeId !== grant.intakeId ||
      strictlyParsedPointer.sourceEventId !== grant.sourceEventId ||
      strictlyParsedPointer.rootCorrelationHash !== grant.rootCorrelationHash
    ) {
      return invalid('pointer artifact correlations do not match the delivery grant');
    }
    // F04: the descriptor stays OPEN through the final precommit identity proof; it is closed exactly after it.
    return new PinnedPointer(onDiskBytes, rawSha256, absolutePath, handle);
  } catch (error) {
    await handle.close().catch(() => undefined);
    throw error;
  }
}

/**
 * Immediately before the pre-commit boundary, lstat the contained leaf and require its device/inode/type/owner/
 * link facts to still match the retained descriptor. Replacement before this check is POINTER_ARTIFACT_INVALID;
 * replacement after it cannot change the operation because the path is never reopened and only pinned bytes load.
 */
async function assertPinnedIdentityUnchanged(pinned: PinnedPointer): Promise<void> {
  try {
    // Compare the CURRENT path against the RETAINED descriptor's own facts (F04): device, inode, regular type,
    // owner, one link, and private mode. Because the fd is still open, its inode cannot be reused; an unlink +
    // re-create at the path would change `lstat` device/inode away from the retained fd and reject here.
    const retained = await pinned.retainedIdentity();
    const current = await lstat(pinned.absolutePath, { bigint: true });
    const currentUid = process.getuid?.();
    if (
      !current.isFile() ||
      !retained.isFile ||
      current.dev !== retained.dev ||
      current.ino !== retained.ino ||
      current.nlink !== 1n ||
      retained.nlink !== 1n ||
      (Number(current.mode) & 0o077) !== 0 ||
      (Number(retained.mode) & 0o077) !== 0 ||
      (currentUid !== undefined && (Number(current.uid) !== currentUid || Number(retained.uid) !== currentUid))
    ) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'pointer artifact identity changed before the pre-commit boundary');
    }
  } catch (error) {
    await pinned.close();
    if (error instanceof DomainError) throw error;
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'pointer artifact identity proof failed');
  }
  // Close the retained descriptor EXACTLY after a successful proof (F04).
  await pinned.close();
}

/** All 15 live destination facts must equal the lease destination exactly (design §9.3). Canonical-hash equality. */
function observationEquals(observation: As1TmuxDestination, destination: As1TmuxDestination): boolean {
  return hashCanonical(observation) === hashCanonical(destination);
}

/** The lease destination must bind the selected closed profile's session/workspace/command (design §9.3). */
function leaseDestinationMatchesProfile(destination: As1TmuxDestination, profile: As1Profile): boolean {
  return (
    destination.sessionName === profile.sessionName &&
    destination.workspace === profile.workspace &&
    destination.currentCommand === profile.currentCommand
  );
}

/**
 * The exact tmux transport (Phase B). Its trusted collaborators — fresh clock, selected profile, state root,
 * observation port, durable journal, provenance gate, live control predicate, and durable latch — are bound once
 * at construction, so a per-delivery call can never select the clock, target, capability, buffer, path, or bytes.
 */
export class As1ExactTransport {
  public constructor(
    private readonly clock: () => string,
    /** The state root the contained pointer ref resolves below (design §9.2). Construction-bound. */
    private readonly stateRoot: string,
    /** The selected closed profile whose session/workspace/command the lease destination must bind (design §9.3). */
    private readonly selectedProfile: As1Profile,
    private readonly port: As1TmuxObservationPort,
    private readonly journal: As1DeliveryJournal,
    private readonly provenance: As1DeliveryProvenanceGate,
    private readonly control: As1DeliveryControlPort,
    private readonly latch: (reason: string) => Promise<void>,
  ) {}

  public async deliver(grant: As1PointerDeliveryGrantV1, lease: As1AdvisorReadinessLeaseV1): Promise<As1DeliveryResult> {
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
    const { clock, journal } = this;
    const target = deriveDeliveryTarget(grant);
    const { deliveryId, bufferName } = target;
    const destination = lease.destination;

    const stopped = (reason: string): As1DeliveryResult => ({ phase: 'PREPARED', outcome: 'STOPPED_BEFORE_PASTE', reason });

    // Step 1: validate grant/lease/provenance and the unchanged frozen evidence hashes.
    assertDeliveryChainConsistent(grant, lease, grant.pointerHash, clock());
    assertPointerGrantSnapshot(grant, lease);
    await this.provenance.assertAccepted(grant, lease);

    // Entry re-check + terminal/interrupted journal handling (unchanged one-use/no-retry semantics).
    if (!(await this.control.isDeliverable())) return stopped('owning control not actionable at delivery entry');
    const prior = await journal.readTmuxPhase(deliveryId);
    if (prior === 'TRANSPORT_RECORDED') return { phase: 'TRANSPORT_RECORDED', outcome: 'DELIVERED', reason: 'terminal' };
    if (prior === 'MANUAL_RECONCILIATION_REQUIRED') {
      return { phase: 'MANUAL_RECONCILIATION_REQUIRED', outcome: 'MANUAL_RECONCILIATION_REQUIRED', reason: 'terminal' };
    }
    if (prior !== null && INTERRUPTED_NONTERMINAL_PHASES.includes(prior)) {
      await journal.recordTmuxPhase(deliveryId, 'MANUAL_RECONCILIATION_REQUIRED');
      return { phase: 'MANUAL_RECONCILIATION_REQUIRED', outcome: 'MANUAL_RECONCILIATION_REQUIRED', reason: 'interrupted nonterminal journal' };
    }

    // Step 2: live predicate + the exact selected-profile destination invariant (both precommit).
    if (!(await this.control.isDeliverable())) return stopped('owning control not actionable before pointer pin');
    if (!leaseDestinationMatchesProfile(destination, this.selectedProfile)) {
      return stopped('lease destination is not bound to the selected profile session/workspace/command');
    }

    // Step 3: open, validate, hash, correlate, and PIN the pointer bytes.
    let pinned: PinnedPointer;
    try {
      pinned = await pinPointer(this.stateRoot, grant, target);
    } catch (error) {
      return stopped(`pointer artifact invalid: ${redactError(error).code}`);
    }

    // The retained pointer descriptor must be closed on any pre-identity-proof reject (F04); after a successful
    // proof, assertPinnedIdentityUnchanged has already closed it.
    const stopClosingPin = async (reason: string): Promise<As1DeliveryResult> => {
      await pinned.close();
      return stopped(reason);
    };

    // Step 4: require the live predicate, then complete destination observation ONE (all 15 fields). Every
    // fresh-clock gate checks BOTH the grant AND lease exclusive expiries (F04).
    if (!(await this.control.isDeliverable())) return stopClosingPin('owning control not actionable before observation one');
    const observationOne = await this.port.observe(destination.paneId);
    if (!this.clockLive(grant, lease)) return stopClosingPin('grant or lease expired before observation one');
    if (!observationEquals(observationOne, destination)) return stopClosingPin('destination mismatch at observation one');

    // Step 5: without intervening work/mutation, require the live predicate and complete observation TWO.
    if (!(await this.control.isDeliverable())) return stopClosingPin('owning control not actionable before observation two');
    const observationTwo = await this.port.observe(destination.paneId);
    if (!this.clockLive(grant, lease)) return stopClosingPin('grant or lease expired before observation two');
    if (!observationEquals(observationTwo, destination)) return stopClosingPin('destination mismatch at observation two');

    // Step 6: confirm the pinned descriptor/path identity and the live predicate one final time (still precommit).
    try {
      await assertPinnedIdentityUnchanged(pinned);
    } catch (error) {
      return stopped(`pointer artifact invalid: ${redactError(error).code}`);
    }
    if (!(await this.control.isDeliverable())) return stopped('owning control not actionable before PREPARED');

    const capability = createDeliveryCapability(grant, lease, clock());
    const facts = deliveryJournalFacts(capability);
    const expiry = Date.parse(capability.expiresAt);
    const live = (): boolean => {
      const nowMs = Date.parse(clock());
      if (Number.isNaN(nowMs)) throw new DomainError('INVALID_SCHEMA', 'the trusted delivery clock returned an unparseable timestamp');
      return nowMs < expiry;
    };
    if (!live()) return stopped('capability expired before PREPARED');

    // Step 7: create the capability, record PREPARED, then atomically consume the grant + lease (committed).
    await journal.recordTmuxPhase(deliveryId, 'PREPARED', facts);
    const manual = async (reason: string): Promise<As1DeliveryResult> => {
      await journal.recordTmuxPhase(deliveryId, 'MANUAL_RECONCILIATION_REQUIRED');
      return { phase: 'MANUAL_RECONCILIATION_REQUIRED', outcome: 'MANUAL_RECONCILIATION_REQUIRED', reason };
    };
    if (!live()) return manual('capability expired before authority consumption');
    if (!(await this.control.isDeliverable())) return manual('owning control not actionable before authority consumption');
    const consumed = await journal.consumeDeliveryAuthority(capability.pointerDeliveryGrantId, capability.leaseId);
    if (!consumed) return manual('delivery authority already consumed');

    // Step 8: inspect/delete only the derived unpasted buffer under recovery proof, load ONLY the pinned bytes.
    if (!(await this.control.isDeliverable())) return manual('owning control not actionable before buffer lookup');
    if (await this.port.bufferExists(bufferName)) {
      if (!live()) return manual('capability expired before buffer cleanup');
      if (!(await this.control.isDeliverable())) return manual('owning control not actionable before buffer cleanup');
      // F04 recovery proof: delete a pre-existing buffer ONLY when the durable journal proves this delivery is at
      // the pre-paste PREPARED window (authorized unpasted residue). Any other phase fails closed to manual.
      if ((await journal.readTmuxPhase(deliveryId)) !== 'PREPARED') {
        return manual('pre-existing tmux buffer without recovery-authorized PREPARED journal');
      }
      await this.port.deleteBuffer(bufferName);
    }
    if (!live()) return manual('capability expired before buffer load');
    if (!(await this.control.isDeliverable())) return manual('owning control not actionable before buffer load');
    await this.port.loadVerifiedBuffer(bufferName, pinned.bytes);
    if (!(await this.control.isDeliverable())) return manual('owning control not actionable before BUFFER_LOADED record');
    await journal.recordTmuxPhase(deliveryId, 'BUFFER_LOADED', facts);

    // Step 9: complete destination observation THREE after buffer load; compare to lease + both precommit ones.
    if (!(await this.control.isDeliverable())) return manual('owning control not actionable before observation three');
    const observationThree = await this.port.observe(destination.paneId);
    if (!live()) return manual('capability expired before observation three');
    if (
      !observationEquals(observationThree, destination) ||
      !observationEquals(observationThree, observationOne) ||
      !observationEquals(observationThree, observationTwo)
    ) {
      return manual('destination changed at the post-load observation three');
    }

    // Step 10: only an exact match may record PASTE_STARTED, paste, and send Enter (the no-retry boundary).
    if (!live()) return manual('capability expired before paste');
    if (!(await this.control.isDeliverable())) return manual('owning control not actionable before paste');
    await journal.recordTmuxPhase(deliveryId, 'PASTE_STARTED', facts);
    try {
      await this.assertDeliverableOrThrow();
      assertCapabilityUsable(capability, clock());
      await this.port.pasteBuffer(bufferName, destination.paneId);
      await this.assertDeliverableOrThrow();
      await journal.recordTmuxPhase(deliveryId, 'PASTE_CONFIRMED', facts);
      await this.assertDeliverableOrThrow();
      await journal.recordTmuxPhase(deliveryId, 'SUBMIT_STARTED', facts);
      await this.assertDeliverableOrThrow();
      assertCapabilityUsable(capability, clock());
      await this.port.sendEnter(destination.paneId);
      await this.assertDeliverableOrThrow();
      await journal.recordTmuxPhase(deliveryId, 'TRANSPORT_RECORDED', facts);
      return { phase: 'TRANSPORT_RECORDED', outcome: 'DELIVERED', reason: 'ok' };
    } catch (error) {
      await journal.recordTmuxPhase(deliveryId, 'MANUAL_RECONCILIATION_REQUIRED');
      return { phase: 'MANUAL_RECONCILIATION_REQUIRED', outcome: 'MANUAL_RECONCILIATION_REQUIRED', reason: redactError(error).code };
    }
  }

  /** A fresh trusted-clock check against BOTH the grant AND lease exclusive expiries (design §9.3 freshness, F04). */
  private clockLive(grant: As1PointerDeliveryGrantV1, lease: As1AdvisorReadinessLeaseV1): boolean {
    const nowMs = Date.parse(this.clock());
    if (Number.isNaN(nowMs)) throw new DomainError('INVALID_SCHEMA', 'the trusted delivery clock returned an unparseable timestamp');
    return nowMs < Date.parse(grant.expiresAt) && nowMs < Date.parse(lease.expiresAt);
  }

  private async assertDeliverableOrThrow(): Promise<void> {
    if (!(await this.control.isDeliverable())) {
      throw new DomainError('GATEWAY_DISABLED', 'owning control not actionable at a tmux mutation boundary');
    }
  }
}

// ── Production NodeAs1TmuxPort (design §9.2/§9.4) — never exercised by an automated test (live rehearsal only). ──
const TMUX_BINARY = '/usr/bin/tmux';
const TMUX_FIELD_SEP = '\u001f';
const AS1_TMUX_OBSERVE_FORMAT = [
  '#{session_id}',
  '#{window_id}',
  '#{pane_id}',
  '#{q:session_name}',
  '#{q:window_name}',
  '#{window_index}',
  '#{pane_index}',
  '#{q:pane_current_path}',
  '#{q:pane_current_command}',
  '#{pane_pid}',
  '#{pane_dead}',
  '#{pane_in_mode}',
  '#{pane_input_off}',
  '#{synchronize-panes}',
  '#{window_activity}',
].join(TMUX_FIELD_SEP);
const PANE_ID = /^%[0-9]+$/u;
const AS1_BUFFER_NAME = /^as1-(?:agent-office-advisor|foundation-advisor)-[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

interface As1TmuxRunResult {
  readonly code: number;
  readonly stdout: Buffer;
}

/** Run one bounded, closed-argv `/usr/bin/tmux` command with an optional closed stdin. Injectable for proof. */
export type As1TmuxRunner = (argv: readonly string[], stdin: Buffer | null) => Promise<As1TmuxRunResult>;

export function nodeTmuxRunner(): As1TmuxRunner {
  return (argv: readonly string[], stdin: Buffer | null): Promise<As1TmuxRunResult> =>
    new Promise<As1TmuxRunResult>((resolve, reject) => {
      const child = spawn(TMUX_BINARY, [...argv], {
        shell: false,
        env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' },
        stdio: [stdin === null ? 'ignore' : 'pipe', 'pipe', 'ignore'],
      });
      const chunks: Buffer[] = [];
      let total = 0;
      let failed = false;
      const fail = (): void => {
        if (failed) return;
        failed = true;
        try {
          child.kill('SIGKILL');
        } catch {
          /* already gone */
        }
        reject(new DomainError('GATEWAY_DISABLED', 'exact tmux operation failed'));
      };
      const timer = setTimeout(fail, LIMITS.SUBPROCESS_TIMEOUT_MS);
      child.stdout?.on('data', (chunk: Buffer) => {
        total += chunk.byteLength;
        if (total > LIMITS.SUBPROCESS_OUTPUT_MAX_BYTES) {
          fail();
          return;
        }
        chunks.push(chunk);
      });
      child.once('error', fail);
      child.once('close', (code) => {
        if (failed) return;
        clearTimeout(timer);
        resolve({ code: code ?? 1, stdout: Buffer.concat(chunks) });
      });
      const stdin_ = child.stdin;
      if (stdin !== null && stdin_ !== null) {
        stdin_.on('error', () => undefined);
        stdin_.end(stdin);
      }
    });
}

export class NodeAs1TmuxPort implements As1TmuxObservationPort {
  public constructor(private readonly run: As1TmuxRunner = nodeTmuxRunner()) {}

  public async observe(paneId: string): Promise<As1TmuxDestination> {
    this.assertPane(paneId);
    const result = await this.run(['display-message', '-p', '-t', paneId, '-F', AS1_TMUX_OBSERVE_FORMAT], null);
    if (result.code !== 0) throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'tmux observation failed');
    const text = decodeTmuxUtf8(result.stdout);
    const fields = text.replace(/\n$/u, '').split(TMUX_FIELD_SEP);
    if (fields.length !== 15) throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'tmux observation field count mismatched');
    const [sessionId, windowId, pane, sessionName, windowName, windowIndex, paneIndex, workspace, currentCommand, panePid, paneDead, paneInMode, inputOff, synchronizePanes, activityTime] =
      fields as [string, string, string, string, string, string, string, string, string, string, string, string, string, string, string];
    return parseTmuxDestination(
      {
        sessionName,
        sessionId,
        windowName,
        windowId,
        windowIndex: tmuxInt(windowIndex),
        paneId: pane,
        paneIndex: tmuxInt(paneIndex),
        panePid: tmuxInt(panePid),
        workspace,
        currentCommand,
        paneDead: tmuxBool(paneDead),
        paneInMode: tmuxBool(paneInMode),
        inputOff: tmuxBool(inputOff),
        synchronizePanes: tmuxBool(synchronizePanes),
        activityTime,
      },
      'as1 tmux observation',
    );
  }

  public async bufferExists(bufferName: string): Promise<boolean> {
    this.assertBuffer(bufferName);
    const result = await this.run(['list-buffers', '-F', '#{buffer_name}'], null);
    if (result.code !== 0) throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'tmux buffer listing failed');
    const names = decodeTmuxUtf8(result.stdout).split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
    return names.includes(bufferName);
  }

  public async loadVerifiedBuffer(bufferName: string, pinnedBytes: Buffer): Promise<void> {
    this.assertBuffer(bufferName);
    // Load ONLY the already-pinned bytes through a closed stdin (`-`); never a path, temporary, or caller buffer.
    const result = await this.run(['load-buffer', '-b', bufferName, '-'], pinnedBytes);
    if (result.code !== 0) throw new DomainError('GATEWAY_DISABLED', 'tmux load-buffer failed');
  }

  public async pasteBuffer(bufferName: string, paneId: string): Promise<void> {
    this.assertBuffer(bufferName);
    this.assertPane(paneId);
    const result = await this.run(['paste-buffer', '-p', '-b', bufferName, '-t', paneId, '-d'], null);
    if (result.code !== 0) throw new DomainError('GATEWAY_DISABLED', 'tmux paste-buffer failed');
  }

  public async sendEnter(paneId: string): Promise<void> {
    this.assertPane(paneId);
    const result = await this.run(['send-keys', '-t', paneId, 'Enter'], null);
    if (result.code !== 0) throw new DomainError('GATEWAY_DISABLED', 'tmux send-keys failed');
  }

  public async deleteBuffer(bufferName: string): Promise<void> {
    this.assertBuffer(bufferName);
    const result = await this.run(['delete-buffer', '-b', bufferName], null);
    if (result.code !== 0) throw new DomainError('GATEWAY_DISABLED', 'tmux delete-buffer failed');
  }

  private assertPane(paneId: string): void {
    if (!PANE_ID.test(paneId)) throw new DomainError('FORBIDDEN_TARGET', 'tmux pane id is not the internally derived pane');
  }

  private assertBuffer(bufferName: string): void {
    if (!AS1_BUFFER_NAME.test(bufferName)) throw new DomainError('FORBIDDEN_TARGET', 'tmux buffer name is not the internally derived name');
  }
}

function decodeTmuxUtf8(bytes: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'tmux output is not valid UTF-8');
  }
}

function tmuxInt(value: string): number {
  if (!/^(?:0|[1-9][0-9]{0,18})$/u.test(value)) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'tmux integer field is malformed');
  }
  return Number.parseInt(value, 10);
}

function tmuxBool(value: string): boolean {
  if (value === '1') return true;
  if (value === '0') return false;
  throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'tmux boolean field is not 0 or 1');
}
