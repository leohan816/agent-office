import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { AdvisorNotificationRequest } from '../advisor.js';
import { DomainError, type SourceArtifactRef } from '../../../contracts/types.js';
import { assertUtcTimestamp, assertUuidV7 } from '../../../domain/time/index.js';
import { writeAtomicCanonicalJson } from '../../../persistence/file-store/atomic-file.js';
import { hashCanonical, isSha256, sha256Bytes } from '../../../persistence/file-store/hashing.js';
import { isNodeError, validateStateRoot } from '../../../persistence/file-store/path-safety.js';
import type { AgentOfficeRuntimeIdentity } from '../../../runtime/identity.js';
import {
  EXACT_DELIVERY_ACTIVATION_MISSION,
  EXACT_DELIVERY_GOVERNED_MISSION,
  assertAdvisorTransportCapabilityV2,
  parseAdvisorDeliveryReadinessLease,
  type AdvisorDeliveryReadinessLease,
  type AdvisorTransportCapabilityV2,
  type ExactAdvisorDeliveryActivation,
  type ExactAdvisorLiveDestination,
  type ExactDeliverySnapshotKey,
} from './exact-config.js';

const COMMIT = /^[0-9a-f]{40}$/u;
const BLOB = /^[0-9a-f]{40,64}$/u;
const GENESIS_HASH = `sha256:${'0'.repeat(64)}`;

export interface ExactGitSnapshot {
  readonly headCommit: string;
  readonly upstreamCommit: string;
  readonly upstreamName: string;
  readonly dirtyPaths: ReadonlySet<string>;
}

export interface ExactGitBlob {
  readonly ref: SourceArtifactRef;
  readonly blobId: string;
  readonly bytes: Uint8Array;
}

export interface ExactGitAuthorityReader {
  snapshot(): Promise<ExactGitSnapshot>;
  readExact(ref: SourceArtifactRef): Promise<ExactGitBlob>;
  readUpstreamPath(relativePath: string): Promise<ExactGitBlob | undefined>;
  isAncestor(baseCommit: string, headCommit: string): Promise<boolean>;
  pathHistory(relativePath: string): Promise<readonly string[]>;
}

export interface ExactTmuxPreflightRecord {
  readonly sessionName: string;
  readonly sessionId: string;
  readonly windowId: string;
  readonly windowIndex: number;
  readonly paneIndex: number;
  readonly paneId: string;
  readonly workspace: string;
  readonly currentCommand: string;
  readonly windowName: string;
  readonly panePid: number;
  readonly paneDead: boolean;
  readonly paneInMode: boolean;
  readonly inputOff: boolean;
  readonly synchronizePanes: boolean;
  readonly activityTime: number;
  readonly observedAt: string;
}

export interface ValidatedExactAuthoritySnapshot {
  readonly authoritySnapshotHash: string;
  readonly activationSnapshotHash: string;
  readonly registrySnapshotHash: string;
  readonly registryWindowId: string;
  readonly upstreamCommit: string;
  readonly activationGrantHash: string;
}

export interface PreparedExactDeliveryAttempt {
  readonly capability: AdvisorTransportCapabilityV2;
  readonly lease: AdvisorDeliveryReadinessLease;
  readonly leaseArtifact: SourceArtifactRef;
  readonly firstPreflight: ExactTmuxPreflightRecord;
}

interface LeaseConsumption {
  readonly sequence: number;
  readonly leaseId: string;
  readonly notificationId: string;
  readonly pointerEnvelopeHash: string;
  readonly consumedAt: string;
  readonly priorRecordHash: string;
  readonly recordHash: string;
}

interface LeaseConsumptionState {
  readonly schemaVersion: 'agent-office.readiness-lease-consumption.v1';
  readonly records: readonly LeaseConsumption[];
}

const EMPTY_CONSUMPTIONS: LeaseConsumptionState = {
  schemaVersion: 'agent-office.readiness-lease-consumption.v1',
  records: [],
};

export class ExactAdvisorAuthorityValidator {
  private queue: Promise<void> = Promise.resolve();

  private constructor(
    private readonly activation: ExactAdvisorDeliveryActivation,
    private readonly git: ExactGitAuthorityReader,
    private readonly runtime: AgentOfficeRuntimeIdentity,
    private readonly consumptionFile: string,
    private consumptions: LeaseConsumptionState,
  ) {}

  public static async open(options: {
    readonly activation: ExactAdvisorDeliveryActivation;
    readonly git: ExactGitAuthorityReader;
    readonly runtime: AgentOfficeRuntimeIdentity;
    readonly stateRoot: string;
  }): Promise<ExactAdvisorAuthorityValidator> {
    const stateRoot = await validateStateRoot(options.stateRoot);
    const consumptionFile = path.join(stateRoot, 'indexes', 'advisor-readiness-leases.json');
    const consumptions = await readConsumptions(consumptionFile);
    return new ExactAdvisorAuthorityValidator(
      options.activation,
      options.git,
      options.runtime,
      consumptionFile,
      consumptions,
    );
  }

  public async validateStaticAuthority(): Promise<ValidatedExactAuthoritySnapshot> {
    const snapshot = await this.git.snapshot();
    if (
      snapshot.headCommit !== snapshot.upstreamCommit ||
      !COMMIT.test(snapshot.headCommit) ||
      !COMMIT.test(snapshot.upstreamCommit) ||
      snapshot.upstreamName.length === 0
    ) {
      throw authorityFailure('trusted authority HEAD must equal its configured local upstream');
    }
    const blobs = {} as Record<ExactDeliverySnapshotKey, ExactGitBlob>;
    for (const [key, ref] of Object.entries(this.activation.snapshotRefs) as [
      ExactDeliverySnapshotKey,
      SourceArtifactRef,
    ][]) {
      if (snapshot.dirtyPaths.has(ref.path)) {
        throw authorityFailure(`trusted authority path is dirty: ${key}`);
      }
      if (!(await this.git.isAncestor(ref.commit, snapshot.upstreamCommit))) {
        throw authorityFailure(`authority snapshot is not upstream-ancestral: ${key}`);
      }
      const blob = await this.git.readExact(ref);
      const current = await this.git.readUpstreamPath(ref.path);
      if (
        blob.ref.sha256 !== ref.sha256 || sha256Bytes(blob.bytes) !== ref.sha256 ||
        current?.ref.sha256 !== ref.sha256
      ) {
        throw authorityFailure(`authority snapshot hash mismatched: ${key}`);
      }
      blobs[key] = blob;
    }
    assertRoleProtocol(blobs.roleProtocol.bytes);
    assertTextIncludes(blobs.transportProtocol.bytes, 'transport protocol', [
      'ACTIVE__FABLE5_DUAL_PASS__LEO_GPT_FINAL_APPROVED',
      'Existing Sessions Only',
      'synchronized panes are off',
    ]);
    assertTextIncludes(blobs.activationState.bytes, 'activation state', [
      'MODE_STATUS: `ACTIVE`',
      'KILL_SWITCH: `DISENGAGED`',
      'MANUAL_ROUTING_FALLBACK: `ACTIVE`',
    ]);
    assertTextIncludes(blobs.finalActivationRecord.bytes, 'final activation record', [
      'LEO_GPT_FINAL_ACTIVATION: `APPROVED`',
      'KILL_SWITCH_FINAL_STATE: `DISENGAGED`',
      'PRODUCT_MISSION_AUTHORIZATION: `NONE`',
    ]);
    assertTextIncludes(blobs.killSwitchAndFallback.bytes, 'kill and fallback record', [
      'Current kill-switch state: `DISENGAGED`',
      'Current fallback: `MANUAL_ROUTING_ACTIVE`',
    ]);
    const registryWindowId = assertRegistry(blobs.sessionRegistry.bytes);
    assertOptionA(blobs.optionADecision.bytes);
    assertParentManifest(blobs.parentMissionManifest.bytes);
    assertPhysicalMigrationDecision(blobs.physicalMigrationDecision.bytes);
    const finalSnapshot = await this.git.snapshot();
    if (
      finalSnapshot.headCommit !== snapshot.headCommit ||
      finalSnapshot.upstreamCommit !== snapshot.upstreamCommit ||
      finalSnapshot.headCommit !== finalSnapshot.upstreamCommit ||
      Object.values(this.activation.snapshotRefs).some((ref) => finalSnapshot.dirtyPaths.has(ref.path))
    ) throw authorityFailure('trusted authority changed during exact snapshot validation');
    const authoritySnapshotHash = hashCanonical([
      { key: 'roleProtocol', ref: this.activation.snapshotRefs.roleProtocol },
      { key: 'optionADecision', ref: this.activation.snapshotRefs.optionADecision },
      { key: 'parentMissionManifest', ref: this.activation.snapshotRefs.parentMissionManifest },
      { key: 'physicalMigrationDecision', ref: this.activation.snapshotRefs.physicalMigrationDecision },
    ]);
    const activationSnapshotHash = hashCanonical([
      { key: 'transportProtocol', ref: this.activation.snapshotRefs.transportProtocol },
      { key: 'activationState', ref: this.activation.snapshotRefs.activationState },
      { key: 'finalActivationRecord', ref: this.activation.snapshotRefs.finalActivationRecord },
      { key: 'killSwitchAndFallback', ref: this.activation.snapshotRefs.killSwitchAndFallback },
    ]);
    const registrySnapshotHash = hashCanonical([
      { key: 'sessionRegistry', ref: this.activation.snapshotRefs.sessionRegistry },
      { key: 'destination', destination: this.activation.destination, windowId: registryWindowId },
    ]);
    return {
      authoritySnapshotHash,
      activationSnapshotHash,
      registrySnapshotHash,
      registryWindowId,
      upstreamCommit: snapshot.upstreamCommit,
      activationGrantHash: hashCanonical({
        activation: this.activation,
        authoritySnapshotHash,
        activationSnapshotHash,
        registrySnapshotHash,
      }),
    };
  }

  public async prepareAttempt(input: {
    readonly request: AdvisorNotificationRequest;
    readonly pointerEnvelopeHash: string;
    readonly firstPreflight: ExactTmuxPreflightRecord;
  }): Promise<PreparedExactDeliveryAttempt> {
    const operation = this.queue.then(() => this.prepareAttemptSerial(input));
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  public async revalidatePreparedAttempt(prepared: PreparedExactDeliveryAttempt): Promise<void> {
    const validated = await this.validateStaticAuthority();
    const currentLease = await this.git.readUpstreamPath(this.activation.readinessLeasePath);
    const now = this.runtime.now();
    if (
      validated.authoritySnapshotHash !== prepared.capability.authoritySnapshotHash ||
      validated.activationSnapshotHash !== prepared.capability.activationSnapshotHash ||
      validated.registrySnapshotHash !== prepared.capability.registrySnapshotHash ||
      currentLease?.ref.sha256 !== prepared.leaseArtifact.sha256 ||
      Date.parse(now) < Date.parse(prepared.capability.issuedAt) ||
      Date.parse(now) >= Date.parse(prepared.capability.expiresAt) ||
      Date.parse(now) >= Date.parse(prepared.lease.expiresAt)
    ) throw authorityFailure('exact delivery authority changed before paste');
  }

  private async prepareAttemptSerial(input: {
    readonly request: AdvisorNotificationRequest;
    readonly pointerEnvelopeHash: string;
    readonly firstPreflight: ExactTmuxPreflightRecord;
  }): Promise<PreparedExactDeliveryAttempt> {
    const validated = await this.validateStaticAuthority();
    const leaseBlob = await this.git.readUpstreamPath(this.activation.readinessLeasePath);
    if (leaseBlob === undefined) throw authorityFailure('Advisor readiness lease is unavailable');
    const snapshot = await this.git.snapshot();
    if (
      snapshot.headCommit !== snapshot.upstreamCommit ||
      snapshot.upstreamCommit !== validated.upstreamCommit ||
      snapshot.dirtyPaths.has(this.activation.readinessLeasePath)
    ) {
      throw authorityFailure('Advisor readiness lease path is not a clean pushed blob');
    }
    for (const ref of Object.values(this.activation.snapshotRefs)) {
      if (!(await this.git.isAncestor(ref.commit, leaseBlob.ref.commit))) {
        throw authorityFailure('Advisor readiness lease does not descend from every authority snapshot');
      }
    }
    if (!(await this.git.isAncestor(leaseBlob.ref.commit, snapshot.upstreamCommit))) {
      throw authorityFailure('Advisor readiness lease is not in current upstream history');
    }
    const lease = parseJsonLease(leaseBlob.bytes);
    assertLeaseCorrelations(lease, this.activation, validated, this.runtime.now());
    assertPreflightMatches(input.firstPreflight, lease.destination, this.activation.preflightMaxAgeMs, this.runtime.now());
    const prior = this.consumptions.records.find((record) => record.leaseId === lease.leaseId);
    if (prior !== undefined) {
      throw new DomainError('IDEMPOTENCY_KEY_REUSED', 'Advisor readiness lease was already consumed');
    }
    await this.consumeLease(
      lease.leaseId,
      input.request.notificationId,
      input.pointerEnvelopeHash,
      this.runtime.now(),
    );
    const issuedAt = this.runtime.now();
    const expiresAt = new Date(Math.min(
      Date.parse(lease.expiresAt),
      Date.parse(issuedAt) + this.activation.capabilityTtlMs,
    )).toISOString();
    const capability: AdvisorTransportCapabilityV2 = {
      schemaVersion: 'agent-office.advisor-transport-capability.v2',
      capabilityId: this.runtime.nextId(),
      activationId: this.activation.activationId,
      logicalRoute: 'ADVISOR_ONLY',
      transport: 'TMUX',
      state: 'ACTIVE',
      killSwitch: 'DISENGAGED',
      synchronization: 'SINGLE_PREVALIDATED_DESTINATION',
      activationMissionId: EXACT_DELIVERY_ACTIVATION_MISSION,
      governedMissionId: EXACT_DELIVERY_GOVERNED_MISSION,
      notificationId: input.request.notificationId,
      pointerEnvelopeHash: input.pointerEnvelopeHash,
      destinationFingerprint: exactPreflightFingerprint(input.firstPreflight),
      readinessLeaseId: lease.leaseId,
      issuedAt,
      expiresAt,
      authoritySnapshotHash: validated.authoritySnapshotHash,
      activationSnapshotHash: validated.activationSnapshotHash,
      registrySnapshotHash: validated.registrySnapshotHash,
    };
    assertAdvisorTransportCapabilityV2(capability);
    return { capability, lease, leaseArtifact: leaseBlob.ref, firstPreflight: input.firstPreflight };
  }

  private async consumeLease(
    leaseId: string,
    notificationId: string,
    pointerEnvelopeHash: string,
    consumedAt: string,
  ): Promise<void> {
    assertUuidV7(leaseId, 'leaseId');
    assertUuidV7(notificationId, 'notificationId');
    const priorRecordHash = this.consumptions.records.at(-1)?.recordHash ?? GENESIS_HASH;
    const core = {
      sequence: this.consumptions.records.length + 1,
      leaseId,
      notificationId,
      pointerEnvelopeHash,
      consumedAt,
      priorRecordHash,
    };
    const record: LeaseConsumption = { ...core, recordHash: hashCanonical(core) };
    const next: LeaseConsumptionState = {
      ...this.consumptions,
      records: [...this.consumptions.records, record],
    };
    await writeAtomicCanonicalJson(this.consumptionFile, next);
    this.consumptions = next;
  }
}

export class NodeExactGitAuthorityReader implements ExactGitAuthorityReader {
  public constructor(
    private readonly root: string,
    private readonly limits: { readonly timeoutMs: number; readonly maxOutputBytes: number },
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly executable = '/usr/bin/git',
  ) {
    if (!path.isAbsolute(root) || executable !== '/usr/bin/git') {
      throw authorityFailure('exact Git authority reader requires fixed local paths');
    }
  }

  public async snapshot(): Promise<ExactGitSnapshot> {
    const [head, upstream, upstreamName, status] = await Promise.all([
      this.run(['rev-parse', '--verify', 'HEAD^{commit}']),
      this.run(['rev-parse', '--verify', '@{upstream}^{commit}']),
      this.run(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']),
      this.run(['status', '--porcelain=v1', '-z', '--untracked-files=all']),
    ]);
    const headCommit = oneLine(head, 'authority HEAD');
    const upstreamCommit = oneLine(upstream, 'authority upstream');
    const name = oneLine(upstreamName, 'authority upstream name');
    if (!COMMIT.test(headCommit) || !COMMIT.test(upstreamCommit)) {
      throw authorityFailure('exact Git authority commits are invalid');
    }
    return {
      headCommit,
      upstreamCommit,
      upstreamName: name,
      dirtyPaths: parsePorcelainPaths(status.stdout),
    };
  }

  public async readExact(ref: SourceArtifactRef): Promise<ExactGitBlob> {
    const [object, content] = await Promise.all([
      this.run(['rev-parse', '--verify', `${ref.commit}:${ref.path}`]),
      this.run(['show', `${ref.commit}:${ref.path}`]),
    ]);
    const blobId = oneLine(object, 'authority blob ID');
    if (!BLOB.test(blobId)) throw authorityFailure('authority blob ID is invalid');
    if (sha256Bytes(content.stdout) !== ref.sha256) {
      throw authorityFailure('authority blob SHA-256 mismatched');
    }
    return { ref, blobId, bytes: content.stdout };
  }

  public async readUpstreamPath(relativePath: string): Promise<ExactGitBlob | undefined> {
    assertRelativePath(relativePath);
    const snapshot = await this.snapshot();
    const object = await this.runAllowFailure([
      'rev-parse', '--verify', `${snapshot.upstreamCommit}:${relativePath}`,
    ]);
    if (object.exitCode !== 0) return undefined;
    const blobId = oneLine(object, 'upstream blob ID');
    if (!BLOB.test(blobId)) throw authorityFailure('upstream blob ID is invalid');
    const content = await this.run(['show', `${snapshot.upstreamCommit}:${relativePath}`]);
    const ref: SourceArtifactRef = {
      repository: 'foundation-docs',
      commit: snapshot.upstreamCommit,
      path: relativePath,
      sha256: sha256Bytes(content.stdout),
    };
    return { ref, blobId, bytes: content.stdout };
  }

  public async isAncestor(baseCommit: string, headCommit: string): Promise<boolean> {
    if (!COMMIT.test(baseCommit) || !COMMIT.test(headCommit)) {
      throw authorityFailure('ancestry query requires exact commits');
    }
    const result = await this.runAllowFailure(['merge-base', '--is-ancestor', baseCommit, headCommit]);
    if (result.exitCode !== 0 && result.exitCode !== 1) {
      throw authorityFailure('Git ancestry query failed');
    }
    return result.exitCode === 0;
  }

  public async pathHistory(relativePath: string): Promise<readonly string[]> {
    assertRelativePath(relativePath);
    const result = await this.run(['log', '--format=%H', '--', relativePath]);
    const text = utf8(result.stdout, 'Git path history').trim();
    if (text.length === 0) return [];
    const commits = text.split('\n');
    if (commits.length > 64 || commits.some((commit) => !COMMIT.test(commit))) {
      throw authorityFailure('Git path history is invalid or exceeds its bound');
    }
    return commits;
  }

  private async run(argv: readonly string[]): Promise<ClosedToolResult> {
    const result = await this.runAllowFailure(argv);
    if (result.exitCode !== 0) throw authorityFailure('closed Git authority operation failed');
    return result;
  }

  private runAllowFailure(argv: readonly string[]): Promise<ClosedToolResult> {
    return runExactGitTool({
      executable: this.executable,
      argv,
      cwd: this.root,
      limits: this.limits,
      now: this.now,
      environment: {
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_OPTIONAL_LOCKS: '0',
        GIT_TERMINAL_PROMPT: '0',
      },
    });
  }
}

interface ClosedToolResult {
  readonly exitCode: number;
  readonly stdout: Uint8Array;
  readonly stderr: Uint8Array;
  readonly completedAt: string;
}

function runExactGitTool(input: {
  readonly executable: string;
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly limits: { readonly timeoutMs: number; readonly maxOutputBytes: number };
  readonly now: () => string;
  readonly environment?: Readonly<Record<string, string>>;
}): Promise<ClosedToolResult> {
  if (
    !path.isAbsolute(input.executable) || !path.isAbsolute(input.cwd) ||
    input.argv.some((value) => value.includes('\0')) ||
    !Number.isSafeInteger(input.limits.timeoutMs) || input.limits.timeoutMs < 1 ||
    input.limits.timeoutMs > 30_000 ||
    !Number.isSafeInteger(input.limits.maxOutputBytes) || input.limits.maxOutputBytes < 1 ||
    input.limits.maxOutputBytes > 65_536
  ) {
    return Promise.reject(authorityFailure('closed tool invocation is invalid'));
  }
  return new Promise((resolve, reject) => {
    const child = spawn(input.executable, [...input.argv], {
      cwd: input.cwd,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        HOME: '/nonexistent',
        LANG: 'C.UTF-8',
        LC_ALL: 'C.UTF-8',
        PATH: '/usr/bin:/bin',
        ...input.environment,
      },
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let byteCount = 0;
    let settled = false;
    const fail = (message: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill('SIGKILL');
      reject(authorityFailure(message));
    };
    const collect = (target: Buffer[], chunk: Buffer): void => {
      byteCount += chunk.byteLength;
      if (byteCount > input.limits.maxOutputBytes) fail('closed tool output exceeded its bound');
      else target.push(chunk);
    };
    const timer = setTimeout(() => fail('closed tool timed out'), input.limits.timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on('data', (chunk: Buffer) => collect(stderr, chunk));
    child.once('error', () => fail('closed tool failed to start'));
    child.once('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        exitCode: code ?? -1,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
        completedAt: input.now(),
      });
    });
  });
}

export function assertPreflightMatches(
  preflight: ExactTmuxPreflightRecord,
  destination: ExactAdvisorLiveDestination,
  maxAgeMs: number,
  now: string,
): void {
  if (
    preflight.sessionName !== destination.sessionName ||
    preflight.sessionId !== destination.sessionId ||
    preflight.windowId !== destination.windowId ||
    preflight.windowIndex !== destination.windowIndex ||
    preflight.paneIndex !== destination.paneIndex ||
    preflight.paneId !== destination.paneId ||
    preflight.workspace !== destination.workspace ||
    preflight.currentCommand !== destination.currentCommand ||
    preflight.paneDead ||
    preflight.paneInMode ||
    preflight.inputOff ||
    preflight.synchronizePanes ||
    Date.parse(now) - Date.parse(preflight.observedAt) < 0 ||
    Date.parse(now) - Date.parse(preflight.observedAt) > maxAgeMs
  ) {
    throw authorityFailure('live Advisor destination does not match the exact readiness lease');
  }
}

export function exactPreflightFingerprint(preflight: ExactTmuxPreflightRecord): string {
  return hashCanonical({
    sessionName: preflight.sessionName,
    sessionId: preflight.sessionId,
    windowId: preflight.windowId,
    windowIndex: preflight.windowIndex,
    paneIndex: preflight.paneIndex,
    paneId: preflight.paneId,
    workspace: preflight.workspace,
    currentCommand: preflight.currentCommand,
    windowName: preflight.windowName,
    panePid: preflight.panePid,
    paneDead: preflight.paneDead,
    paneInMode: preflight.paneInMode,
    inputOff: preflight.inputOff,
    synchronizePanes: preflight.synchronizePanes,
    activityTime: preflight.activityTime,
  });
}

function assertLeaseCorrelations(
  lease: AdvisorDeliveryReadinessLease,
  activation: ExactAdvisorDeliveryActivation,
  validated: ValidatedExactAuthoritySnapshot,
  now: string,
): void {
  const staticDestination = activation.destination;
  if (
    Object.entries(staticDestination).some(
      ([key, value]) => lease.destination[key as keyof ExactAdvisorLiveDestination] !== value,
    ) ||
    lease.destination.windowId !== validated.registryWindowId ||
    lease.authoritySnapshotHash !== validated.authoritySnapshotHash ||
    lease.activationSnapshotHash !== validated.activationSnapshotHash ||
    lease.registrySnapshotHash !== validated.registrySnapshotHash ||
    Date.parse(now) < Date.parse(lease.issuedAt) ||
    Date.parse(now) >= Date.parse(lease.expiresAt) ||
    Date.parse(now) - Date.parse(lease.observedAt) > activation.preflightMaxAgeMs
  ) {
    throw authorityFailure('Advisor readiness lease is stale or mismatched');
  }
}

function parseJsonLease(bytes: Uint8Array): AdvisorDeliveryReadinessLease {
  try {
    return parseAdvisorDeliveryReadinessLease(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown,
    );
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw authorityFailure('Advisor readiness lease is not valid UTF-8 JSON');
  }
}

function assertRoleProtocol(bytes: Uint8Array): void {
  const text = utf8(bytes, 'role protocol');
  if (
    !text.includes('V2') || !text.includes('Advisor') || !text.includes('Worker') ||
    !text.includes('Reviewer') || !text.includes('Leo/GPT')
  ) throw authorityFailure('canonical role protocol V2 separation is absent');
}

function assertRegistry(bytes: Uint8Array): string {
  const text = utf8(bytes, 'session registry');
  if (!text.includes('synchronize-panes off')) {
    throw authorityFailure('session registry does not record synchronize-panes off');
  }
  // Structural column check of the real committed registry row, which begins `| Agent Office Advisor |`.
  // Require exactly one routable Agent Office Advisor row with the exact current destination; a loose
  // substring match that could accept a duplicate or malformed row is not sufficient.
  const rows = text.split('\n').map((line) => line.trim()).filter((line) => {
    const cells = line.split('|').map((cell) => cell.trim());
    return cells.length >= 11 && cells[0] === '' && cells[1] === 'Agent Office Advisor';
  });
  const [advisorRow] = rows;
  if (rows.length !== 1 || advisorRow === undefined) {
    throw authorityFailure('session registry must contain exactly one routable Agent Office Advisor row');
  }
  const cells = advisorRow.split('|').map((cell) => cell.trim());
  const code = (cell: string | undefined): string | null => {
    if (cell === undefined) return null;
    return /^`([^`]+)`/u.exec(cell)?.[1] ?? null;
  };
  if (
    code(cells[2]) !== 'agent-office-advisor' ||
    code(cells[3]) !== '$26' ||
    cells[4] !== '0' ||
    code(cells[5]) !== '@26' ||
    cells[6] !== '0' ||
    code(cells[7]) !== '%26' ||
    code(cells[8]) !== '/home/leo/Project/agent-office' ||
    code(cells[9]) !== 'codex'
  ) {
    throw authorityFailure('session registry Agent Office Advisor row is not the exact current destination');
  }
  return '@26';
}

function assertOptionA(bytes: Uint8Array): void {
  const text = utf8(bytes, 'Option A decision');
  if (
    !/Option A/iu.test(text) ||
    !text.includes(EXACT_DELIVERY_ACTIVATION_MISSION) ||
    !text.includes(EXACT_DELIVERY_GOVERNED_MISSION)
  ) throw authorityFailure('Leo/GPT Option A activation authority is absent');
}

// Current physical-identity migration decision fence (pre-AS1). A current v2 activation must snapshot
// the exact migration decision, which pins the current destination, prohibits the historical
// destination, treats historical evidence as non-authoritative, and forbids VibeNews / Slack / AS1
// changes. Without this snapshot a legacy v1 activation / historical chain fails closed.
function assertPhysicalMigrationDecision(bytes: Uint8Array): void {
  const text = utf8(bytes, 'physical migration decision');
  // The current destination is pinned by exact tokens — never whitespace-normalized.
  const exactTokens = [
    'agent-office-advisor',
    '$26',
    '@26',
    '%26',
    '/home/leo/Project/agent-office',
  ];
  if (exactTokens.some((token) => !text.includes(token))) {
    throw authorityFailure('physical migration decision does not pin the exact current destination');
  }
  // Unambiguous prohibition semantics — exact stable clauses, not merely legacy-token presence.
  // The canonical 01A decision wraps these clauses across Markdown line breaks, so collapse Unicode
  // whitespace runs to a single ASCII space before matching. Only whitespace is normalized; the
  // destination tokens above, clause punctuation, path identity, Git hash, and SourceArtifactRef
  // checks all stay byte-exact.
  const normalized = text.replace(/\s+/gu, ' ');
  const clauses = [
    'no active code or configuration may resolve, deliver, or fall back to',
    'byte-for-byte, non-routable, and non-authoritative',
    'never be interpreted as a current physical destination or authority subject',
    'Do not change VibeNews, activate Slack/AS1, send tmux input',
  ];
  if (clauses.some((clause) => !normalized.includes(clause))) {
    throw authorityFailure('physical migration decision is missing a required prohibition clause');
  }
}

function assertParentManifest(bytes: Uint8Array): void {
  let value: unknown;
  try {
    value = JSON.parse(utf8(bytes, 'parent manifest')) as unknown;
  } catch {
    throw authorityFailure('parent mission manifest is invalid JSON');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw authorityFailure('parent mission manifest is invalid');
  }
  const manifest = value as Record<string, unknown>;
  const workUnits = Array.isArray(manifest.workUnits) ? manifest.workUnits : [];
  const unit = (id: string): Record<string, unknown> | undefined => workUnits.find(
    (candidate): candidate is Record<string, unknown> =>
      typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate) &&
      (candidate as Record<string, unknown>).id === id,
  );
  const dependencies = (id: string): readonly unknown[] => {
    const dependsOn = unit(id)?.dependsOn;
    return Array.isArray(dependsOn) ? dependsOn : [];
  };
  const unitIds = workUnits.map((candidate) =>
    typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)
      ? (candidate as Record<string, unknown>).id
      : undefined);
  const expectedUnitIds = Array.from(
    { length: 21 },
    (_, index) => `AO-WU-${String(index + 1).padStart(2, '0')}`,
  );
  const actor = (id: string): unknown => unit(id)?.actor;
  if (
    manifest.schemaVersion !== 'agent-office.mission-manifest.v1' ||
    manifest.manifestVersion !== 5 || manifest.missionId !== EXACT_DELIVERY_GOVERNED_MISSION ||
    manifest.approvedBy !== 'Leo/GPT' ||
    workUnits.length !== 21 ||
    new Set(unitIds).size !== 21 || expectedUnitIds.some((id) => !unitIds.includes(id)) ||
    workUnits.some((candidate) => {
      if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) return true;
      const workUnit = candidate as Record<string, unknown>;
      return typeof workUnit.phase !== 'string' || typeof workUnit.actor !== 'string' ||
        typeof workUnit.status !== 'string' || !Array.isArray(workUnit.dependsOn);
    }) ||
    typeof manifest.counting !== 'object' || manifest.counting === null ||
    (manifest.counting as Record<string, unknown>).denominator !== 21 ||
    actor('AO-WU-16') !== 'Advisor' || actor('AO-WU-17') !== 'Agent Office Worker' ||
    actor('AO-WU-18') !== 'Fable5 Reviewer' || actor('AO-WU-19') !== 'Agent Office Worker' ||
    actor('AO-WU-20') !== 'Fable5 Reviewer' || actor('AO-WU-21') !== 'Advisor' ||
    actor('AO-WU-15') !== 'Advisor' ||
    !dependencies('AO-WU-18').includes('AO-WU-17') ||
    !dependencies('AO-WU-19').includes('AO-WU-18') ||
    !dependencies('AO-WU-20').includes('AO-WU-19') ||
    !dependencies('AO-WU-21').includes('AO-WU-20') ||
    !dependencies('AO-WU-15').includes('AO-WU-21')
  ) throw authorityFailure('parent manifest v5 delivery dependency chain is invalid');
}

function assertTextIncludes(bytes: Uint8Array, label: string, needles: readonly string[]): void {
  const text = utf8(bytes, label);
  if (needles.some((needle) => !text.includes(needle))) {
    throw authorityFailure(`${label} does not contain the reviewed active authority fields`);
  }
}

function utf8(bytes: Uint8Array, label: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw authorityFailure(`${label} is not valid UTF-8`);
  }
}

function parsePorcelainPaths(bytes: Uint8Array): ReadonlySet<string> {
  const text = utf8(bytes, 'Git status');
  const fields = text.split('\0').filter((item) => item.length > 0);
  const paths = new Set<string>();
  for (const field of fields) {
    const candidate = field.length >= 4 && field[2] === ' ' ? field.slice(3) : field;
    if (candidate.length > 0 && !candidate.includes('\0')) paths.add(candidate);
  }
  return paths;
}

function oneLine(result: ClosedToolResult, label: string): string {
  const text = utf8(result.stdout, label);
  if (text.includes('\0') || text.trim().includes('\n') || text.trim().includes('\r')) {
    throw authorityFailure(`${label} is not one bounded line`);
  }
  return text.trim();
}

async function readConsumptions(filePath: string): Promise<LeaseConsumptionState> {
  let text: string;
  try {
    text = await readFile(filePath, 'utf8');
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) return EMPTY_CONSUMPTIONS;
    throw error;
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new DomainError('STORE_QUARANTINED', 'readiness lease consumption state is invalid JSON');
  }
  if (
    typeof value !== 'object' || value === null ||
    !('schemaVersion' in value) || value.schemaVersion !== 'agent-office.readiness-lease-consumption.v1' ||
    !('records' in value) || !Array.isArray(value.records) || value.records.length > 8192
  ) throw new DomainError('STORE_QUARANTINED', 'readiness lease consumption state is invalid');
  const stateObject = value as Record<string, unknown>;
  if (
    Object.keys(stateObject).length !== 2 ||
    Object.keys(stateObject).some((key) => !['schemaVersion', 'records'].includes(key))
  ) throw new DomainError('STORE_QUARANTINED', 'readiness lease consumption shape is invalid');
  let prior = GENESIS_HASH;
  const records = value.records as unknown[];
  for (const [index, raw] of records.entries()) {
    if (
      typeof raw !== 'object' || raw === null ||
      !('sequence' in raw) || raw.sequence !== index + 1 ||
      !('leaseId' in raw) || typeof raw.leaseId !== 'string' ||
      !('notificationId' in raw) || typeof raw.notificationId !== 'string' ||
      !('pointerEnvelopeHash' in raw) || typeof raw.pointerEnvelopeHash !== 'string' ||
      !('consumedAt' in raw) || typeof raw.consumedAt !== 'string' ||
      !('priorRecordHash' in raw) || raw.priorRecordHash !== prior ||
      !('recordHash' in raw) || typeof raw.recordHash !== 'string'
    ) throw new DomainError('STORE_QUARANTINED', 'readiness lease consumption record is invalid');
    const recordObject = raw as Record<string, unknown>;
    const recordKeys = [
      'sequence', 'leaseId', 'notificationId', 'pointerEnvelopeHash', 'consumedAt',
      'priorRecordHash', 'recordHash',
    ];
    if (
      Object.keys(recordObject).length !== recordKeys.length ||
      Object.keys(recordObject).some((key) => !recordKeys.includes(key))
    ) throw new DomainError('STORE_QUARANTINED', 'readiness lease consumption record shape is invalid');
    const { recordHash, ...core } = raw as unknown as LeaseConsumption;
    if (hashCanonical(core) !== recordHash) {
      throw new DomainError('STORE_QUARANTINED', 'readiness lease consumption hash mismatched');
    }
    assertUuidV7(raw.leaseId, 'consumed leaseId');
    assertUuidV7(raw.notificationId, 'consumed notificationId');
    assertUtcTimestamp(raw.consumedAt, 'lease consumedAt');
    if (!isSha256(raw.pointerEnvelopeHash)) {
      throw new DomainError('STORE_QUARANTINED', 'consumed lease pointer hash is invalid');
    }
    prior = recordHash;
  }
  return value as unknown as LeaseConsumptionState;
}

function assertRelativePath(value: string): void {
  if (
    value.length === 0 || value.length > 4096 || value.startsWith('/') || value.includes('\\') ||
    value.split('/').some((part) => part.length === 0 || part === '.' || part === '..')
  ) throw authorityFailure('exact Git path is invalid');
}

function authorityFailure(message: string): DomainError {
  return new DomainError('AUTHORITY_ARTIFACT_INVALID', message);
}
