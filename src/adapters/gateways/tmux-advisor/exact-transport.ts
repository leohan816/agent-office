import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import {
  canonicalAdvisorPointerEnvelope,
  type AdvisorGatewayHealth,
  type AdvisorNotificationRequest,
} from '../advisor.js';
import { DomainError } from '../../../contracts/types.js';
import { assertUtcTimestamp, assertUuidV7 } from '../../../domain/time/index.js';
import { ImmutableArtifactStore } from '../../../persistence/file-store/artifact-store.js';
import { writeAtomicCanonicalJson } from '../../../persistence/file-store/atomic-file.js';
import { StoreError } from '../../../persistence/file-store/errors.js';
import { hashCanonical, isSha256, sha256Bytes } from '../../../persistence/file-store/hashing.js';
import {
  ensurePrivateDirectory,
  isNodeError,
  validateStateRoot,
} from '../../../persistence/file-store/path-safety.js';
import type { DurableDeliveryControl } from '../../../operations/readiness/delivery-control.js';
import type { AgentOfficeRuntimeIdentity } from '../../../runtime/identity.js';
import type { ExactAdvisorDeliveryPort, PointerDeliveryOutcome } from './index.js';
import {
  ExactAdvisorAuthorityValidator,
  assertPreflightMatches,
  exactPreflightFingerprint,
  type ExactTmuxPreflightRecord,
} from './exact-authority.js';
import {
  EXACT_DELIVERY_GOVERNED_MISSION,
  assertAdvisorTransportCapabilityV2,
  type AdvisorTransportCapabilityV2,
  type ExactAdvisorDeliveryActivation,
} from './exact-config.js';

export const EXACT_TMUX_PREFLIGHT_FORMAT = [
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
].join('\u001f');

export type ExactTmuxOperation =
  | { readonly kind: 'PREFLIGHT' }
  | { readonly kind: 'BUFFER_ABSENT'; readonly bufferName: string }
  | { readonly kind: 'LOAD_BUFFER'; readonly bufferName: string; readonly pointerFile: string }
  | { readonly kind: 'PASTE_BUFFER'; readonly bufferName: string }
  | { readonly kind: 'SEND_ENTER' }
  | { readonly kind: 'DELETE_BUFFER'; readonly bufferName: string };

export interface ExactTmuxMutationRunner {
  observePreflight(): Promise<ExactTmuxPreflightRecord>;
  bufferExists(bufferName: string): Promise<boolean>;
  loadBuffer(bufferName: string, pointerFile: string): Promise<void>;
  pasteBuffer(bufferName: string): Promise<void>;
  sendEnter(): Promise<void>;
  deleteBuffer(bufferName: string): Promise<void>;
}

export function exactTmuxArgv(operation: ExactTmuxOperation): readonly string[] {
  switch (operation.kind) {
    case 'PREFLIGHT':
      return ['display-message', '-p', '-t', '%26', '-F', EXACT_TMUX_PREFLIGHT_FORMAT];
    case 'BUFFER_ABSENT':
      assertBufferName(operation.bufferName);
      return ['list-buffers', '-F', '#{buffer_name}'];
    case 'LOAD_BUFFER':
      assertBufferName(operation.bufferName);
      if (!path.isAbsolute(operation.pointerFile) || operation.pointerFile.includes('\0')) {
        throw invalidTarget('pointer file must be an internally derived absolute path');
      }
      return ['load-buffer', '-b', operation.bufferName, operation.pointerFile];
    case 'PASTE_BUFFER':
      assertBufferName(operation.bufferName);
      return ['paste-buffer', '-p', '-b', operation.bufferName, '-t', '%26', '-d'];
    case 'SEND_ENTER':
      return ['send-keys', '-t', '%26', 'Enter'];
    case 'DELETE_BUFFER':
      assertBufferName(operation.bufferName);
      return ['delete-buffer', '-b', operation.bufferName];
  }
}

export class NodeExactTmuxMutationRunner implements ExactTmuxMutationRunner {
  public constructor(
    private readonly limits: { readonly timeoutMs: number; readonly maxOutputBytes: number },
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  public async observePreflight(): Promise<ExactTmuxPreflightRecord> {
    const result = await this.run({ kind: 'PREFLIGHT' });
    return decodePreflight(result.stdout, result.completedAt);
  }

  public async bufferExists(bufferName: string): Promise<boolean> {
    const result = await this.run({ kind: 'BUFFER_ABSENT', bufferName });
    const text = strictUtf8(result.stdout, 'tmux buffer names');
    if (text.includes('\0')) throw invalidTarget('tmux buffer listing is invalid');
    return text.split('\n').some((name) => name.trim() === bufferName);
  }

  public async loadBuffer(bufferName: string, pointerFile: string): Promise<void> {
    await this.run({ kind: 'LOAD_BUFFER', bufferName, pointerFile });
  }

  public async pasteBuffer(bufferName: string): Promise<void> {
    await this.run({ kind: 'PASTE_BUFFER', bufferName });
  }

  public async sendEnter(): Promise<void> {
    await this.run({ kind: 'SEND_ENTER' });
  }

  public async deleteBuffer(bufferName: string): Promise<void> {
    await this.run({ kind: 'DELETE_BUFFER', bufferName });
  }

  private async run(operation: ExactTmuxOperation) {
    const result = await runExactTmuxTool({
      operation,
      limits: this.limits,
      now: this.now,
    });
    if (result.exitCode !== 0) {
      throw new DomainError('GATEWAY_DISABLED', 'closed exact tmux operation failed');
    }
    return result;
  }
}

function runExactTmuxTool(input: {
  readonly operation: ExactTmuxOperation;
  readonly limits: { readonly timeoutMs: number; readonly maxOutputBytes: number };
  readonly now: () => string;
}): Promise<{
  readonly exitCode: number;
  readonly stdout: Uint8Array;
  readonly stderr: Uint8Array;
  readonly completedAt: string;
}> {
  const argv = exactTmuxArgv(input.operation);
  if (
    !Number.isSafeInteger(input.limits.timeoutMs) || input.limits.timeoutMs < 1 ||
    input.limits.timeoutMs > 30_000 ||
    !Number.isSafeInteger(input.limits.maxOutputBytes) || input.limits.maxOutputBytes < 1 ||
    input.limits.maxOutputBytes > 65_536
  ) {
    return Promise.reject(new DomainError('GATEWAY_DISABLED', 'exact tmux limits are invalid'));
  }
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/tmux', [...argv], {
      cwd: '/',
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        HOME: '/nonexistent',
        LANG: 'C.UTF-8',
        LC_ALL: 'C.UTF-8',
        PATH: '/usr/bin:/bin',
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
      reject(new DomainError('GATEWAY_DISABLED', message));
    };
    const collect = (target: Buffer[], chunk: Buffer): void => {
      byteCount += chunk.byteLength;
      if (byteCount > input.limits.maxOutputBytes) fail('exact tmux output exceeded its bound');
      else target.push(chunk);
    };
    const timer = setTimeout(() => fail('exact tmux operation timed out'), input.limits.timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on('data', (chunk: Buffer) => collect(stderr, chunk));
    child.once('error', () => fail('exact tmux operation failed to start'));
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

export type ExactTransportPhase =
  | 'PREPARED'
  | 'BUFFER_LOADED'
  | 'PASTE_STARTED'
  | 'PASTE_CONFIRMED'
  | 'SUBMIT_STARTED'
  | 'TRANSPORT_RECORDED'
  | 'MANUAL_RECONCILIATION_REQUIRED';

interface ExactTransportIdentity {
  readonly notificationId: string;
  readonly requestId: string;
  readonly messagePayloadHash: string;
  readonly messageId: string;
  readonly messageArtifactHash: string;
  readonly pointerEnvelopeHash: string;
  readonly readinessLeaseId: string;
  readonly destinationFingerprint: string;
}

interface ExactTransportJournalRecord {
  readonly sequence: number;
  readonly phase: ExactTransportPhase;
  readonly identity: ExactTransportIdentity;
  readonly requestHash: string;
  readonly capabilityId: string;
  readonly capabilityExpiresAt: string;
  readonly authoritySnapshotHash: string;
  readonly activationSnapshotHash: string;
  readonly registrySnapshotHash: string;
  readonly bufferName: string;
  readonly target: '%26';
  readonly pointerArtifactRef: string;
  readonly pointerArtifactHash: string;
  readonly firstPreflightHash: string;
  readonly secondPreflightHash?: string;
  readonly toolClassification: 'NONE' | 'ACCEPTED' | 'FAILED_OR_AMBIGUOUS';
  readonly occurredAt: string;
  readonly evidenceRefs: readonly string[];
  readonly priorRecordHash: string;
  readonly recordHash: string;
}

interface ExactTransportJournal {
  readonly schemaVersion: 'agent-office.exact-tmux-transport-journal.v1';
  readonly records: readonly ExactTransportJournalRecord[];
}

const JOURNAL_GENESIS = `sha256:${'0'.repeat(64)}`;

export class DurableExactAdvisorDeliveryPort implements ExactAdvisorDeliveryPort {
  private readonly operations = new Map<string, {
    readonly requestHash: string;
    readonly pointerEnvelopeHash: string;
    readonly promise: Promise<PointerDeliveryOutcome>;
  }>();
  private readonly consumedCapabilityIds = new Set<string>();
  private deliveryQueue: Promise<void> = Promise.resolve();

  private constructor(
    private readonly stateRoot: string,
    private readonly journalRoot: string,
    private readonly artifacts: ImmutableArtifactStore,
    private readonly activation: ExactAdvisorDeliveryActivation,
    private readonly authority: ExactAdvisorAuthorityValidator,
    private readonly runner: ExactTmuxMutationRunner,
    private readonly deliveryControl: DurableDeliveryControl,
    private readonly runtime: AgentOfficeRuntimeIdentity,
  ) {}

  public static async open(options: {
    readonly stateRoot: string;
    readonly activation: ExactAdvisorDeliveryActivation;
    readonly authority: ExactAdvisorAuthorityValidator;
    readonly runner: ExactTmuxMutationRunner;
    readonly deliveryControl: DurableDeliveryControl;
    readonly runtime: AgentOfficeRuntimeIdentity;
  }): Promise<DurableExactAdvisorDeliveryPort> {
    const stateRoot = await validateStateRoot(options.stateRoot);
    const journalRoot = await ensurePrivateDirectory(stateRoot, path.join('indexes', 'tmux-delivery'));
    return new DurableExactAdvisorDeliveryPort(
      stateRoot,
      journalRoot,
      await ImmutableArtifactStore.open(stateRoot),
      options.activation,
      options.authority,
      options.runner,
      options.deliveryControl,
      options.runtime,
    );
  }

  public health(): AdvisorGatewayHealth {
    return this.deliveryControl.isEnabled()
      ? { adapter: 'TMUX_ADVISOR', status: 'READY', failureCode: 'NONE' }
      : {
          adapter: 'TMUX_ADVISOR',
          status: 'MANUAL_FALLBACK_REQUIRED',
          failureCode: this.deliveryControl.project().mode === 'DISABLED_LATCHED'
            ? 'KILL_SWITCH_ENGAGED'
            : 'TRANSPORT_INACTIVE',
        };
  }

  public deliverPointer(input: {
    readonly request: AdvisorNotificationRequest;
    readonly requestHash: string;
    readonly pointerEnvelope: string;
  }): Promise<PointerDeliveryOutcome> {
    const pointerEnvelopeHash = sha256Bytes(input.pointerEnvelope);
    const existing = this.operations.get(input.request.notificationId);
    if (existing !== undefined) {
      return existing.requestHash === input.requestHash &&
        existing.pointerEnvelopeHash === pointerEnvelopeHash
        ? existing.promise
        : Promise.reject(new DomainError(
            'IDEMPOTENCY_KEY_REUSED',
            'concurrent exact delivery identity was reused with different bytes',
          ));
    }
    const operation = this.deliveryQueue.then(() => this.deliverSerial(input))
      .catch(async (error: unknown) => {
        await this.latchDelivery(error);
        throw error;
      })
      .finally(() => {
        this.operations.delete(input.request.notificationId);
      });
    this.deliveryQueue = operation.then(() => undefined, () => undefined);
    this.operations.set(input.request.notificationId, {
      requestHash: input.requestHash,
      pointerEnvelopeHash,
      promise: operation,
    });
    return operation;
  }

  public async lookupPointerReceipt(input: {
    readonly notificationId: string;
  }): Promise<PointerDeliveryOutcome | 'NOT_FOUND'> {
    assertUuidV7(input.notificationId, 'notificationId');
    try {
      const journal = await this.readJournal(input.notificationId);
      if (journal === undefined) return 'NOT_FOUND';
      const last = journal.records.at(-1);
      if (last === undefined) throw quarantined('exact transport journal is empty');
      if (last.phase === 'TRANSPORT_RECORDED') {
        return {
          status: 'ALREADY_DELIVERED',
          evidenceRefs: last.evidenceRefs,
          receiptTime: last.occurredAt,
        };
      }
      if (last.phase !== 'MANUAL_RECONCILIATION_REQUIRED') {
        await this.reconcileInterruptedJournal(journal);
      }
      const current = await this.readJournal(input.notificationId);
      return {
        status: 'AMBIGUOUS',
        failureCode: 'DELIVERY_RECEIPT_AMBIGUOUS',
        evidenceRefs: current?.records.at(-1)?.evidenceRefs ?? last.evidenceRefs,
        receiptTime: current?.records.at(-1)?.occurredAt ?? last.occurredAt,
      };
    } catch (error) {
      await this.latchDelivery(error);
      throw error;
    }
  }

  private async deliverSerial(input: {
    readonly request: AdvisorNotificationRequest;
    readonly requestHash: string;
    readonly pointerEnvelope: string;
  }): Promise<PointerDeliveryOutcome> {
    if (input.request.missionId !== EXACT_DELIVERY_GOVERNED_MISSION) {
      throw invalidTarget('exact delivery accepts only the governed Agent Office mission');
    }
    const expectedEnvelope = canonicalAdvisorPointerEnvelope(input.request);
    if (
      expectedEnvelope !== input.pointerEnvelope ||
      hashCanonical(input.request) !== input.requestHash
    ) {
      throw new DomainError('IDEMPOTENCY_KEY_REUSED', 'exact delivery request bytes mismatched');
    }
    const pointerEnvelopeHash = sha256Bytes(input.pointerEnvelope);
    const existing = await this.readJournal(input.request.notificationId);
    if (existing !== undefined) return this.replayOrConflict(existing, input, pointerEnvelopeHash);
    const requestConflict = await this.findRequestConflict(input.request.requestId);
    if (requestConflict) {
      throw new DomainError('IDEMPOTENCY_KEY_REUSED', 'requestId was reused across exact deliveries');
    }

    const pointer = await this.artifacts.putScopedBytes(
      'gateway-pointers',
      [input.request.missionId, input.request.notificationId],
      Buffer.from(input.pointerEnvelope, 'utf8'),
      'json',
      16 * 1024,
    ).catch((error: unknown) => {
      if (error instanceof StoreError && error.code === 'IMMUTABLE_ARTIFACT_CONFLICT') {
        throw new DomainError('IDEMPOTENCY_KEY_REUSED', 'pointer identity was reused with different bytes');
      }
      throw error;
    });
    if (pointer.sha256 !== pointerEnvelopeHash) {
      throw quarantined('immutable pointer artifact bytes mismatched');
    }
    let fallbackEvidenceRefs: readonly string[] = [
      pointer.relativePath,
      `pointer:${pointerEnvelopeHash}`,
    ];
    if (!this.deliveryControl.isEnabled()) {
      return {
        status: 'MANUAL_FALLBACK',
        failureCode: 'TRANSPORT_INACTIVE',
        evidenceRefs: fallbackEvidenceRefs,
        receiptTime: this.runtime.now(),
      };
    }

    let journal: ExactTransportJournal | undefined;
    let bufferName: string | undefined;
    try {
      const firstPreflight = await this.runner.observePreflight();
      const prepared = await this.authority.prepareAttempt({
        request: input.request,
        pointerEnvelopeHash,
        firstPreflight,
      });
      fallbackEvidenceRefs = [
        ...fallbackEvidenceRefs,
        `lease:${prepared.lease.leaseId}`,
      ];
      assertCapabilityForAttempt(
        prepared.capability,
        this.activation.activationId,
        input.request.notificationId,
        pointerEnvelopeHash,
        this.runtime.now(),
      );
      bufferName = bufferNameFor(input.request.notificationId);
      if (await this.runner.bufferExists(bufferName)) {
        throw invalidTarget('the exact private tmux buffer name already exists');
      }
      const pointerFile = this.absoluteArtifactPath(pointer.relativePath);
      const identity: ExactTransportIdentity = {
        notificationId: input.request.notificationId,
        requestId: input.request.requestId,
        messagePayloadHash: input.request.messagePayloadHash,
        messageId: input.request.messageId,
        messageArtifactHash: input.request.messageArtifactHash,
        pointerEnvelopeHash,
        readinessLeaseId: prepared.lease.leaseId,
        destinationFingerprint: prepared.capability.destinationFingerprint,
      };
      const evidenceRefs = [
        pointer.relativePath,
        `journal:${input.request.notificationId}`,
        `lease:${prepared.lease.leaseId}`,
        `pointer:${pointerEnvelopeHash}`,
      ];
      journal = { schemaVersion: 'agent-office.exact-tmux-transport-journal.v1', records: [] };
      journal = await this.append(journal, {
        phase: 'PREPARED', identity, requestHash: input.requestHash,
        capability: prepared.capability, bufferName, pointerArtifactRef: pointer.relativePath,
        pointerArtifactHash: pointer.sha256,
        firstPreflightHash: hashCanonical(firstPreflight),
        toolClassification: 'NONE', evidenceRefs,
      });
      await this.runner.loadBuffer(bufferName, pointerFile);
      journal = await this.append(journal, {
        phase: 'BUFFER_LOADED', identity, requestHash: input.requestHash,
        capability: prepared.capability, bufferName, pointerArtifactRef: pointer.relativePath,
        pointerArtifactHash: pointer.sha256,
        firstPreflightHash: hashCanonical(firstPreflight),
        toolClassification: 'ACCEPTED', evidenceRefs,
      });
      const secondPreflight = await this.runner.observePreflight();
      assertPreflightMatches(
        secondPreflight,
        prepared.lease.destination,
        this.activation.preflightMaxAgeMs,
        this.runtime.now(),
      );
      if (exactPreflightFingerprint(firstPreflight) !== exactPreflightFingerprint(secondPreflight)) {
        throw invalidTarget('Advisor target changed between the two exact preflights');
      }
      await this.authority.revalidatePreparedAttempt(prepared);
      if (!this.deliveryControl.isEnabled()) {
        throw new DomainError('GATEWAY_DISABLED', 'exact delivery was disabled before paste');
      }
      if (this.consumedCapabilityIds.has(prepared.capability.capabilityId)) {
        throw new DomainError('IDEMPOTENCY_KEY_REUSED', 'attempt capability was already consumed');
      }
      assertCapabilityForAttempt(
        prepared.capability,
        this.activation.activationId,
        input.request.notificationId,
        pointerEnvelopeHash,
        this.runtime.now(),
      );
      this.consumedCapabilityIds.add(prepared.capability.capabilityId);
      journal = await this.append(journal, {
        phase: 'PASTE_STARTED', identity, requestHash: input.requestHash,
        capability: prepared.capability, bufferName, pointerArtifactRef: pointer.relativePath,
        pointerArtifactHash: pointer.sha256,
        firstPreflightHash: hashCanonical(firstPreflight),
        secondPreflightHash: hashCanonical(secondPreflight),
        toolClassification: 'NONE', evidenceRefs,
      });
      if (!this.deliveryControl.isEnabled()) {
        throw new DomainError('GATEWAY_DISABLED', 'exact delivery was latched before pane input');
      }
      await this.runner.pasteBuffer(bufferName);
      journal = await this.append(journal, {
        phase: 'PASTE_CONFIRMED', identity, requestHash: input.requestHash,
        capability: prepared.capability, bufferName, pointerArtifactRef: pointer.relativePath,
        pointerArtifactHash: pointer.sha256,
        firstPreflightHash: hashCanonical(firstPreflight),
        secondPreflightHash: hashCanonical(secondPreflight),
        toolClassification: 'ACCEPTED', evidenceRefs,
      });
      journal = await this.append(journal, {
        phase: 'SUBMIT_STARTED', identity, requestHash: input.requestHash,
        capability: prepared.capability, bufferName, pointerArtifactRef: pointer.relativePath,
        pointerArtifactHash: pointer.sha256,
        firstPreflightHash: hashCanonical(firstPreflight),
        secondPreflightHash: hashCanonical(secondPreflight),
        toolClassification: 'NONE', evidenceRefs,
      });
      await this.runner.sendEnter();
      journal = await this.append(journal, {
        phase: 'TRANSPORT_RECORDED', identity, requestHash: input.requestHash,
        capability: prepared.capability, bufferName, pointerArtifactRef: pointer.relativePath,
        pointerArtifactHash: pointer.sha256,
        firstPreflightHash: hashCanonical(firstPreflight),
        secondPreflightHash: hashCanonical(secondPreflight),
        toolClassification: 'ACCEPTED', evidenceRefs,
      });
      return {
        status: 'DELIVERED',
        evidenceRefs: journal.records.at(-1)?.evidenceRefs ?? evidenceRefs,
        receiptTime: journal.records.at(-1)?.occurredAt ?? this.runtime.now(),
      };
    } catch (error) {
      if (journal !== undefined) {
        const last = journal.records.at(-1);
        if (last !== undefined && last.phase !== 'MANUAL_RECONCILIATION_REQUIRED') {
          if (last.phase === 'BUFFER_LOADED' && bufferName !== undefined) {
            await this.runner.deleteBuffer(bufferName).catch(() => undefined);
          }
          journal = await this.appendManual(journal);
        }
      }
      await this.latchDelivery(error);
      return {
        status: journal?.records.some((record) => record.phase === 'PASTE_STARTED') === true
          ? 'AMBIGUOUS'
          : 'MANUAL_FALLBACK',
        failureCode: journal?.records.some((record) => record.phase === 'PASTE_STARTED') === true
          ? 'DELIVERY_RECEIPT_AMBIGUOUS'
          : error instanceof DomainError && error.code === 'GATEWAY_DISABLED'
            ? 'TOOL_TIMEOUT_OR_OUTPUT_LIMIT'
            : 'ADVISOR_LOCATOR_STALE_OR_MISMATCHED',
        evidenceRefs: journal?.records.at(-1)?.evidenceRefs ?? fallbackEvidenceRefs,
        receiptTime: journal?.records.at(-1)?.occurredAt ?? this.runtime.now(),
      };
    }
  }

  private replayOrConflict(
    journal: ExactTransportJournal,
    input: { readonly request: AdvisorNotificationRequest; readonly requestHash: string },
    pointerEnvelopeHash: string,
  ): PointerDeliveryOutcome {
    const first = journal.records[0];
    const last = journal.records.at(-1);
    if (first === undefined || last === undefined) throw quarantined('exact transport journal has no records');
    if (
      first.requestHash !== input.requestHash ||
      first.identity.notificationId !== input.request.notificationId ||
      first.identity.requestId !== input.request.requestId ||
      first.identity.pointerEnvelopeHash !== pointerEnvelopeHash
    ) throw new DomainError('IDEMPOTENCY_KEY_REUSED', 'exact delivery identity was reused with different bytes');
    return last.phase === 'TRANSPORT_RECORDED'
      ? { status: 'ALREADY_DELIVERED', evidenceRefs: last.evidenceRefs, receiptTime: last.occurredAt }
      : {
          status: 'AMBIGUOUS',
          failureCode: 'DELIVERY_RECEIPT_AMBIGUOUS',
          evidenceRefs: last.evidenceRefs,
          receiptTime: last.occurredAt,
        };
  }

  private async reconcileInterruptedJournal(journal: ExactTransportJournal): Promise<void> {
    const last = journal.records.at(-1);
    if (last === undefined) throw quarantined('exact transport journal has no records');
    if (last.phase === 'BUFFER_LOADED') {
      const live = await this.runner.observePreflight().catch(() => undefined);
      if (
        live !== undefined &&
        exactPreflightFingerprint(live) === last.identity.destinationFingerprint &&
        await this.runner.bufferExists(last.bufferName).catch(() => false)
      ) await this.runner.deleteBuffer(last.bufferName).catch(() => undefined);
    }
    await this.appendManual(journal);
    await this.latchDelivery(new DomainError('GATEWAY_DISABLED', 'interrupted exact transport requires reconciliation'));
  }

  private async appendManual(journal: ExactTransportJournal): Promise<ExactTransportJournal> {
    const last = journal.records.at(-1);
    if (last === undefined) throw quarantined('cannot reconcile an empty exact transport journal');
    return this.append(journal, {
      phase: 'MANUAL_RECONCILIATION_REQUIRED',
      identity: last.identity,
      requestHash: last.requestHash,
      capability: journalCapability(last),
      bufferName: last.bufferName,
      pointerArtifactRef: last.pointerArtifactRef,
      pointerArtifactHash: last.pointerArtifactHash,
      firstPreflightHash: last.firstPreflightHash,
      ...(last.secondPreflightHash === undefined ? {} : { secondPreflightHash: last.secondPreflightHash }),
      toolClassification: 'FAILED_OR_AMBIGUOUS',
      evidenceRefs: last.evidenceRefs,
    });
  }

  private async append(
    journal: ExactTransportJournal,
    input: {
      readonly phase: ExactTransportPhase;
      readonly identity: ExactTransportIdentity;
      readonly requestHash: string;
      readonly capability: AdvisorTransportCapabilityV2;
      readonly bufferName: string;
      readonly pointerArtifactRef: string;
      readonly pointerArtifactHash: string;
      readonly firstPreflightHash: string;
      readonly secondPreflightHash?: string;
      readonly toolClassification: ExactTransportJournalRecord['toolClassification'];
      readonly evidenceRefs: readonly string[];
    },
  ): Promise<ExactTransportJournal> {
    const priorRecordHash = journal.records.at(-1)?.recordHash ?? JOURNAL_GENESIS;
    const core = {
      sequence: journal.records.length + 1,
      phase: input.phase,
      identity: input.identity,
      requestHash: input.requestHash,
      capabilityId: input.capability.capabilityId,
      capabilityExpiresAt: input.capability.expiresAt,
      authoritySnapshotHash: input.capability.authoritySnapshotHash,
      activationSnapshotHash: input.capability.activationSnapshotHash,
      registrySnapshotHash: input.capability.registrySnapshotHash,
      bufferName: input.bufferName,
      target: '%26' as const,
      pointerArtifactRef: input.pointerArtifactRef,
      pointerArtifactHash: input.pointerArtifactHash,
      firstPreflightHash: input.firstPreflightHash,
      ...(input.secondPreflightHash === undefined ? {} : { secondPreflightHash: input.secondPreflightHash }),
      toolClassification: input.toolClassification,
      occurredAt: this.runtime.now(),
      evidenceRefs: input.evidenceRefs,
      priorRecordHash,
    };
    const record: ExactTransportJournalRecord = { ...core, recordHash: hashCanonical(core) };
    const next: ExactTransportJournal = { ...journal, records: [...journal.records, record] };
    await writeAtomicCanonicalJson(this.journalPath(input.identity.notificationId), next);
    return next;
  }

  private async readJournal(notificationId: string): Promise<ExactTransportJournal | undefined> {
    let text: string;
    try {
      text = await readFile(this.journalPath(notificationId), 'utf8');
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) return undefined;
      throw error;
    }
    let value: unknown;
    try {
      value = JSON.parse(text) as unknown;
    } catch {
      throw quarantined('exact transport journal is invalid JSON');
    }
    assertJournal(value, notificationId);
    return value;
  }

  private async findRequestConflict(requestId: string): Promise<boolean> {
    const names = await readdir(this.journalRoot);
    for (const name of names) {
      if (!/^[0-9a-f-]{36}\.json$/u.test(name)) continue;
      const notificationId = name.slice(0, -'.json'.length);
      const journal = await this.readJournal(notificationId);
      const first = journal?.records[0];
      if (first?.identity.requestId === requestId) return true;
    }
    return false;
  }

  private journalPath(notificationId: string): string {
    assertUuidV7(notificationId, 'notificationId');
    return path.join(this.journalRoot, `${notificationId}.json`);
  }

  private absoluteArtifactPath(relativePath: string): string {
    const target = path.resolve(this.stateRoot, relativePath);
    if (!target.startsWith(`${this.stateRoot}${path.sep}`)) {
      throw invalidTarget('pointer artifact escaped the trusted state root');
    }
    return target;
  }

  private async latchDelivery(error: unknown): Promise<void> {
    if (this.deliveryControl.project().mode === 'DISABLED_LATCHED') return;
    const now = this.runtime.now();
    const requestId = this.runtime.nextId();
    await this.deliveryControl.disable({
      requestId,
      disabledAt: now,
      reasonCode: error instanceof DomainError && error.code === 'STORE_QUARANTINED'
        ? 'TRANSPORT_JOURNAL_CORRUPT'
        : 'EXACT_DELIVERY_PREFLIGHT_FAILED',
      subjectId: 'agent-office-exact-delivery',
      correlationId: this.runtime.nextId(),
      causationId: this.runtime.nextId(),
      receivedAt: now,
    });
  }
}

function assertCapabilityForAttempt(
  capability: AdvisorTransportCapabilityV2,
  activationId: string,
  notificationId: string,
  pointerEnvelopeHash: string,
  now: string,
): void {
  assertAdvisorTransportCapabilityV2(capability);
  if (
    capability.activationId !== activationId ||
    capability.notificationId !== notificationId ||
    capability.pointerEnvelopeHash !== pointerEnvelopeHash ||
    Date.parse(now) < Date.parse(capability.issuedAt) ||
    Date.parse(now) >= Date.parse(capability.expiresAt)
  ) throw new DomainError('GATEWAY_DISABLED', 'attempt capability is stale or mismatched');
}

function journalCapability(record: ExactTransportJournalRecord): AdvisorTransportCapabilityV2 {
  return {
    schemaVersion: 'agent-office.advisor-transport-capability.v2',
    capabilityId: record.capabilityId,
    activationId: 'journal-recovery',
    logicalRoute: 'ADVISOR_ONLY',
    transport: 'TMUX',
    state: 'ACTIVE',
    killSwitch: 'DISENGAGED',
    synchronization: 'SINGLE_PREVALIDATED_DESTINATION',
    activationMissionId: 'AGENT_OFFICE_M01_EXACT_ADVISOR_DELIVERY_ACTIVATION',
    governedMissionId: 'AGENT_OFFICE_M01_ADVISOR_MANAGED_OFFICE_WEB_CONTROL_PLANE',
    notificationId: record.identity.notificationId,
    pointerEnvelopeHash: record.identity.pointerEnvelopeHash,
    destinationFingerprint: record.identity.destinationFingerprint,
    readinessLeaseId: record.identity.readinessLeaseId,
    issuedAt: record.occurredAt,
    expiresAt: record.capabilityExpiresAt,
    authoritySnapshotHash: record.authoritySnapshotHash,
    activationSnapshotHash: record.activationSnapshotHash,
    registrySnapshotHash: record.registrySnapshotHash,
  };
}

function assertJournal(value: unknown, notificationId: string): asserts value is ExactTransportJournal {
  if (
    typeof value !== 'object' || value === null ||
    !('schemaVersion' in value) || value.schemaVersion !== 'agent-office.exact-tmux-transport-journal.v1' ||
    !('records' in value) || !Array.isArray(value.records) || value.records.length < 1 || value.records.length > 16
  ) throw quarantined('exact transport journal schema is invalid');
  let prior = JOURNAL_GENESIS;
  let identityHash: string | undefined;
  let attemptHash: string | undefined;
  let secondPreflightHash: string | undefined;
  let priorPhase: ExactTransportPhase | undefined;
  let priorTime = Number.NEGATIVE_INFINITY;
  const records = value.records as unknown[];
  for (const [index, raw] of records.entries()) {
    if (
      typeof raw !== 'object' || raw === null ||
      !('sequence' in raw) || raw.sequence !== index + 1 ||
      !('phase' in raw) || ![
        'PREPARED', 'BUFFER_LOADED', 'PASTE_STARTED', 'PASTE_CONFIRMED', 'SUBMIT_STARTED',
        'TRANSPORT_RECORDED', 'MANUAL_RECONCILIATION_REQUIRED',
      ].includes(String(raw.phase)) ||
      !('identity' in raw) || typeof raw.identity !== 'object' || raw.identity === null ||
      !('target' in raw) || raw.target !== '%26' ||
      !('evidenceRefs' in raw) || !Array.isArray(raw.evidenceRefs) || raw.evidenceRefs.length > 8 ||
      raw.evidenceRefs.some((reference) =>
        typeof reference !== 'string' ||
        !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u.test(reference)) ||
      !('toolClassification' in raw) ||
      !['NONE', 'ACCEPTED', 'FAILED_OR_AMBIGUOUS'].includes(String(raw.toolClassification)) ||
      !('priorRecordHash' in raw) || raw.priorRecordHash !== prior ||
      !('recordHash' in raw) || typeof raw.recordHash !== 'string' || !isSha256(raw.recordHash)
    ) throw quarantined('exact transport journal record is invalid');
    const record = raw as unknown as ExactTransportJournalRecord;
    assertJournalRecordShape(record);
    const { recordHash, ...core } = record;
    if (
      hashCanonical(core) !== recordHash ||
      record.identity.notificationId !== notificationId ||
      !isSha256(record.identity.pointerEnvelopeHash) ||
      !isSha256(record.pointerArtifactHash) ||
      !isSha256(record.requestHash) ||
      !isSha256(record.firstPreflightHash) ||
      (record.secondPreflightHash !== undefined && !isSha256(record.secondPreflightHash))
    ) throw quarantined('exact transport journal hash or identity mismatched');
    assertUuidV7(record.identity.notificationId, 'journal notificationId');
    assertUuidV7(record.identity.requestId, 'journal requestId');
    assertUuidV7(record.identity.messageId, 'journal messageId');
    assertUuidV7(record.identity.readinessLeaseId, 'journal readinessLeaseId');
    assertUuidV7(record.capabilityId, 'journal capabilityId');
    assertUtcTimestamp(record.occurredAt, 'journal occurredAt');
    assertUtcTimestamp(record.capabilityExpiresAt, 'journal capabilityExpiresAt');
    if (
      !isSha256(record.identity.messagePayloadHash) ||
      !isSha256(record.identity.messageArtifactHash) ||
      !isSha256(record.identity.destinationFingerprint) ||
      !isSha256(record.authoritySnapshotHash) ||
      !isSha256(record.activationSnapshotHash) ||
      !isSha256(record.registrySnapshotHash) ||
      !/^ao_[0-9a-f]{32}$/u.test(record.bufferName) ||
      record.pointerArtifactHash !== record.identity.pointerEnvelopeHash ||
      !record.pointerArtifactRef.startsWith(
        `artifacts/gateway-pointers/${EXACT_DELIVERY_GOVERNED_MISSION}/${notificationId}/`,
      ) ||
      !record.pointerArtifactRef.endsWith(`/${record.pointerArtifactHash.slice(7)}.json`) ||
      !validToolClassification(record.phase, record.toolClassification) ||
      (['PASTE_STARTED', 'PASTE_CONFIRMED', 'SUBMIT_STARTED', 'TRANSPORT_RECORDED'].includes(
        record.phase,
      ) && record.secondPreflightHash === undefined) ||
      (['PREPARED', 'BUFFER_LOADED'].includes(record.phase) &&
        record.secondPreflightHash !== undefined)
    ) throw quarantined('exact transport journal invariant field is invalid');
    const currentIdentityHash = hashCanonical(record.identity);
    if (identityHash !== undefined && identityHash !== currentIdentityHash) {
      throw quarantined('exact transport journal identity changed between phases');
    }
    identityHash = currentIdentityHash;
    const currentAttemptHash = hashCanonical({
      identity: record.identity,
      requestHash: record.requestHash,
      capabilityId: record.capabilityId,
      capabilityExpiresAt: record.capabilityExpiresAt,
      authoritySnapshotHash: record.authoritySnapshotHash,
      activationSnapshotHash: record.activationSnapshotHash,
      registrySnapshotHash: record.registrySnapshotHash,
      bufferName: record.bufferName,
      target: record.target,
      pointerArtifactRef: record.pointerArtifactRef,
      pointerArtifactHash: record.pointerArtifactHash,
      firstPreflightHash: record.firstPreflightHash,
      evidenceRefs: record.evidenceRefs,
    });
    if (attemptHash !== undefined && attemptHash !== currentAttemptHash) {
      throw quarantined('exact transport journal attempt fields changed between phases');
    }
    attemptHash = currentAttemptHash;
    if (
      secondPreflightHash !== undefined &&
      record.secondPreflightHash !== secondPreflightHash
    ) throw quarantined('exact transport second-preflight evidence changed or disappeared');
    secondPreflightHash ??= record.secondPreflightHash;
    if (!validJournalTransition(priorPhase, record.phase)) {
      throw quarantined('exact transport journal phase order is invalid');
    }
    const occurredAt = Date.parse(record.occurredAt);
    if (occurredAt < priorTime) throw quarantined('exact transport journal time moved backwards');
    priorTime = occurredAt;
    priorPhase = record.phase;
    prior = recordHash;
  }
}

function assertJournalRecordShape(record: ExactTransportJournalRecord): void {
  const expected = [
    'sequence', 'phase', 'identity', 'requestHash', 'capabilityId', 'capabilityExpiresAt',
    'authoritySnapshotHash', 'activationSnapshotHash', 'registrySnapshotHash', 'bufferName',
    'target', 'pointerArtifactRef', 'pointerArtifactHash', 'firstPreflightHash',
    ...(record.secondPreflightHash === undefined ? [] : ['secondPreflightHash']),
    'toolClassification', 'occurredAt', 'evidenceRefs', 'priorRecordHash', 'recordHash',
  ];
  if (
    Object.keys(record).length !== expected.length ||
    Object.keys(record).some((key) => !expected.includes(key)) ||
    record.evidenceRefs.length > 8
  ) throw quarantined('exact transport journal record shape is invalid');
  const identityKeys = [
    'notificationId', 'requestId', 'messagePayloadHash', 'messageId', 'messageArtifactHash',
    'pointerEnvelopeHash', 'readinessLeaseId', 'destinationFingerprint',
  ];
  if (
    Object.keys(record.identity).length !== identityKeys.length ||
    Object.keys(record.identity).some((key) => !identityKeys.includes(key))
  ) throw quarantined('exact transport journal identity shape is invalid');
}

function validJournalTransition(
  prior: ExactTransportPhase | undefined,
  current: ExactTransportPhase,
): boolean {
  if (prior === undefined) return current === 'PREPARED';
  if (current === 'MANUAL_RECONCILIATION_REQUIRED') {
    return prior !== 'TRANSPORT_RECORDED' && prior !== 'MANUAL_RECONCILIATION_REQUIRED';
  }
  const next: Partial<Record<ExactTransportPhase, ExactTransportPhase>> = {
    PREPARED: 'BUFFER_LOADED',
    BUFFER_LOADED: 'PASTE_STARTED',
    PASTE_STARTED: 'PASTE_CONFIRMED',
    PASTE_CONFIRMED: 'SUBMIT_STARTED',
    SUBMIT_STARTED: 'TRANSPORT_RECORDED',
  };
  return next[prior] === current;
}

function validToolClassification(
  phase: ExactTransportPhase,
  classification: ExactTransportJournalRecord['toolClassification'],
): boolean {
  if (phase === 'MANUAL_RECONCILIATION_REQUIRED') return classification === 'FAILED_OR_AMBIGUOUS';
  if (phase === 'BUFFER_LOADED' || phase === 'PASTE_CONFIRMED' || phase === 'TRANSPORT_RECORDED') {
    return classification === 'ACCEPTED';
  }
  return classification === 'NONE';
}

export function decodePreflight(bytes: Uint8Array, observedAt: string): ExactTmuxPreflightRecord {
  const text = strictUtf8(bytes, 'tmux preflight');
  if (text.includes('\0') || text.trimEnd().includes('\n') || text.trimEnd().includes('\r')) {
    throw invalidTarget('tmux preflight must be one structured record');
  }
  const fields = text.trimEnd().split('\u001f');
  if (fields.length !== 15) throw invalidTarget('tmux preflight field count mismatched');
  const [
    sessionId, windowId, paneId, sessionName, windowName, windowIndex, paneIndex,
    workspace, currentCommand, panePid, paneDead, paneInMode, inputOff, synchronizePanes,
    activityTime,
  ] = fields as [string, string, string, string, string, string, string, string, string, string, string, string, string, string, string];
  for (const [value, label] of [
    [sessionName, 'session name'], [windowName, 'window name'], [workspace, 'workspace'],
    [currentCommand, 'current command'],
  ] as const) {
    if (!/^[A-Za-z0-9_./:@+-]{1,4096}$/u.test(value)) {
      throw invalidTarget(`tmux ${label} is not a safe escaped field`);
    }
  }
  const record: ExactTmuxPreflightRecord = {
    sessionId: exactPattern(sessionId, /^\$[0-9]+$/u, 'session ID'),
    windowId: exactPattern(windowId, /^@[0-9]+$/u, 'window ID'),
    paneId: exactPattern(paneId, /^%[0-9]+$/u, 'pane ID'),
    sessionName,
    windowName,
    windowIndex: exactInteger(windowIndex, 'window index'),
    paneIndex: exactInteger(paneIndex, 'pane index'),
    workspace,
    currentCommand,
    panePid: exactInteger(panePid, 'pane PID'),
    paneDead: exactBoolean(paneDead, 'pane dead'),
    paneInMode: exactBoolean(paneInMode, 'pane in mode'),
    inputOff: exactBoolean(inputOff, 'pane input off'),
    synchronizePanes: exactBoolean(synchronizePanes, 'synchronize panes'),
    activityTime: exactInteger(activityTime, 'activity time'),
    observedAt,
  };
  assertUtcTimestamp(observedAt, 'tmux preflight observedAt');
  if (
    record.sessionId !== '$26' || record.paneId !== '%26' || record.sessionName !== 'agent-office-advisor' ||
    record.windowIndex !== 0 || record.paneIndex !== 0 ||
    record.workspace !== '/home/leo/Project/agent-office' || record.currentCommand !== 'codex' ||
    record.panePid < 1 || record.paneDead || record.paneInMode || record.inputOff || record.synchronizePanes
  ) throw invalidTarget('tmux preflight is not the fixed safe Advisor pane');
  return record;
}

function bufferNameFor(notificationId: string): string {
  assertUuidV7(notificationId, 'notificationId');
  const value = `ao_${notificationId.replaceAll('-', '').toLowerCase()}`;
  assertBufferName(value);
  return value;
}

function assertBufferName(value: string): void {
  if (!/^ao_[0-9a-f]{32}$/u.test(value)) throw invalidTarget('exact tmux buffer name is invalid');
}

function strictUtf8(bytes: Uint8Array, label: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw invalidTarget(`${label} is not valid UTF-8`);
  }
}

function exactPattern(value: string, pattern: RegExp, label: string): string {
  if (!pattern.test(value)) throw invalidTarget(`${label} is invalid`);
  return value;
}

function exactInteger(value: string, label: string): number {
  if (!/^(?:0|[1-9][0-9]{0,15})$/u.test(value)) throw invalidTarget(`${label} is invalid`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw invalidTarget(`${label} is outside the safe range`);
  return parsed;
}

function exactBoolean(value: string, label: string): false {
  if (value !== '0') throw invalidTarget(`${label} must be false`);
  return false;
}

function invalidTarget(message: string): DomainError {
  return new DomainError('FORBIDDEN_TARGET', message);
}

function quarantined(message: string): DomainError {
  return new DomainError('STORE_QUARANTINED', message);
}
