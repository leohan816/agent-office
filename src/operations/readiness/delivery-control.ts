import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { DomainError } from '../../contracts/types.js';
import { assertUtcTimestamp, assertUuidV7 } from '../../domain/time/index.js';
import { ImmutableArtifactStore } from '../../persistence/file-store/artifact-store.js';
import { writeAtomicCanonicalJson } from '../../persistence/file-store/atomic-file.js';
import { hashCanonical, isSha256 } from '../../persistence/file-store/hashing.js';
import { isNodeError, validateStateRoot } from '../../persistence/file-store/path-safety.js';
import type {
  DeliveryDisableHttpCommand,
  DeliveryDisableReceipt,
} from '../../server/application.js';

interface PersistedDisableReceipt extends DeliveryDisableReceipt {
  readonly commandHash: string;
  readonly artifactRef: string;
  readonly artifactHash: string;
}

interface DeliveryControlState {
  readonly schemaVersion: 'agent-office.delivery-control.v1';
  readonly mode: 'DISABLED';
  readonly receipts: readonly PersistedDisableReceipt[];
}

export interface DeliveryControlProjection {
  readonly mode: 'DISABLED';
  readonly lastDisabledAt?: string;
  readonly lastReasonCode?: string;
  readonly receiptCount: number;
}

const INITIAL_STATE: DeliveryControlState = {
  schemaVersion: 'agent-office.delivery-control.v1',
  mode: 'DISABLED',
  receipts: [],
};

export class DurableDeliveryControl {
  private queue: Promise<void> = Promise.resolve();

  private constructor(
    private readonly stateRoot: string,
    private readonly artifacts: ImmutableArtifactStore,
    private state: DeliveryControlState,
  ) {}

  public static async open(stateRoot: string): Promise<DurableDeliveryControl> {
    const canonicalRoot = await validateStateRoot(stateRoot);
    const artifacts = await ImmutableArtifactStore.open(canonicalRoot);
    const state = await readState(path.join(canonicalRoot, 'indexes', 'delivery-control.json'));
    return new DurableDeliveryControl(canonicalRoot, artifacts, state);
  }

  public project(): DeliveryControlProjection {
    const latest = this.state.receipts.at(-1);
    return {
      mode: 'DISABLED',
      ...(latest === undefined ? {} : {
        lastDisabledAt: latest.disabledAt,
        lastReasonCode: latest.reasonCode,
      }),
      receiptCount: this.state.receipts.length,
    };
  }

  public disable(command: DeliveryDisableHttpCommand): Promise<DeliveryDisableReceipt> {
    const operation = this.queue.then(() => this.disableSerial(command));
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async disableSerial(command: DeliveryDisableHttpCommand): Promise<DeliveryDisableReceipt> {
    assertDisableCommand(command);
    const commandHash = hashCanonical({
      requestId: command.requestId,
      disabledAt: command.disabledAt,
      reasonCode: command.reasonCode,
      subjectId: command.subjectId,
    });
    const prior = this.state.receipts.find((receipt) => receipt.requestId === command.requestId);
    if (prior !== undefined) {
      if (prior.commandHash !== commandHash) {
        throw new DomainError('IDEMPOTENCY_KEY_REUSED', 'delivery disable requestId conflicts');
      }
      return {
        requestId: prior.requestId,
        status: 'DISABLED',
        disabledAt: prior.disabledAt,
        reasonCode: prior.reasonCode,
        replayed: true,
      };
    }
    if (this.state.receipts.length >= 4096) {
      throw new DomainError('STORE_QUARANTINED', 'delivery disable receipt bound is exhausted');
    }
    const evidence = {
      schemaVersion: 'agent-office.delivery-disable-receipt.v1',
      requestId: command.requestId,
      disabledAt: command.disabledAt,
      reasonCode: command.reasonCode,
      subjectId: command.subjectId,
      correlationId: command.correlationId,
      causationId: command.causationId,
      receivedAt: command.receivedAt,
      status: 'DISABLED',
    } as const;
    const artifact = await this.artifacts.putScopedCanonicalJson(
      'operations',
      ['delivery-disable', command.requestId],
      evidence,
      8 * 1024,
    );
    const receipt: PersistedDisableReceipt = {
      requestId: command.requestId,
      status: 'DISABLED',
      disabledAt: command.disabledAt,
      reasonCode: command.reasonCode,
      replayed: false,
      commandHash,
      artifactRef: artifact.relativePath,
      artifactHash: artifact.sha256,
    };
    const next: DeliveryControlState = {
      ...this.state,
      receipts: [...this.state.receipts, receipt],
    };
    await writeAtomicCanonicalJson(
      path.join(this.stateRoot, 'indexes', 'delivery-control.json'),
      next,
    );
    this.state = next;
    return {
      requestId: receipt.requestId,
      status: receipt.status,
      disabledAt: receipt.disabledAt,
      reasonCode: receipt.reasonCode,
      replayed: false,
    };
  }
}

async function readState(filePath: string): Promise<DeliveryControlState> {
  let text: string;
  try {
    text = await readFile(filePath, 'utf8');
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) return INITIAL_STATE;
    throw error;
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new DomainError('STORE_QUARANTINED', 'delivery control state is invalid JSON');
  }
  assertDeliveryState(value);
  return value;
}

function assertDeliveryState(value: unknown): asserts value is DeliveryControlState {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('schemaVersion' in value) ||
    value.schemaVersion !== 'agent-office.delivery-control.v1' ||
    !('mode' in value) ||
    value.mode !== 'DISABLED' ||
    !('receipts' in value) ||
    !Array.isArray(value.receipts) ||
    value.receipts.length > 4096
  ) {
    throw new DomainError('STORE_QUARANTINED', 'delivery control state schema is invalid');
  }
  for (const raw of value.receipts as readonly unknown[]) {
    if (
      typeof raw !== 'object' ||
      raw === null ||
      !('requestId' in raw) ||
      typeof raw.requestId !== 'string' ||
      !('status' in raw) ||
      raw.status !== 'DISABLED' ||
      !('disabledAt' in raw) ||
      typeof raw.disabledAt !== 'string' ||
      !('reasonCode' in raw) ||
      typeof raw.reasonCode !== 'string' ||
      !('replayed' in raw) ||
      raw.replayed !== false ||
      !('commandHash' in raw) ||
      typeof raw.commandHash !== 'string' ||
      !isSha256(raw.commandHash) ||
      !('artifactRef' in raw) ||
      typeof raw.artifactRef !== 'string' ||
      !('artifactHash' in raw) ||
      typeof raw.artifactHash !== 'string' ||
      !isSha256(raw.artifactHash)
    ) {
      throw new DomainError('STORE_QUARANTINED', 'delivery control receipt is invalid');
    }
    assertUuidV7(raw.requestId, 'delivery disable requestId');
    assertUtcTimestamp(raw.disabledAt, 'delivery disable time');
    if (!/^[A-Z][A-Z0-9_]{0,63}$/u.test(raw.reasonCode)) {
      throw new DomainError('STORE_QUARANTINED', 'delivery disable reason is invalid');
    }
  }
}

function assertDisableCommand(command: DeliveryDisableHttpCommand): void {
  assertUuidV7(command.requestId, 'delivery disable requestId');
  assertUuidV7(command.correlationId, 'delivery disable correlationId');
  assertUuidV7(command.causationId, 'delivery disable causationId');
  assertUtcTimestamp(command.receivedAt, 'delivery disable receipt time');
  assertUtcTimestamp(command.disabledAt, 'delivery disable time');
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(command.subjectId) ||
    !/^[A-Z][A-Z0-9_]{0,63}$/u.test(command.reasonCode)
  ) {
    throw new DomainError('INVALID_SCHEMA', 'delivery disable command is invalid');
  }
}
