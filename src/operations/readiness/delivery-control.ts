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

export type DeliveryControlMode =
  | 'DISABLED_DEFAULT'
  | 'ENABLED_BY_EXACT_GRANT'
  | 'DISABLED_LATCHED';

interface PersistedDisableReceipt extends DeliveryDisableReceipt {
  readonly commandHash: string;
  readonly artifactRef: string;
  readonly artifactHash: string;
}

interface DeliveryControlTransition {
  readonly sequence: number;
  readonly kind: 'EXACT_GRANT_ENABLED' | 'DELIVERY_DISABLED_LATCHED';
  readonly activationId?: string;
  readonly reasonCode?: string;
  readonly occurredAt: string;
  readonly evidenceHash: string;
  readonly priorTransitionHash: string;
  readonly transitionHash: string;
}

interface DeliveryControlStateV2 {
  readonly schemaVersion: 'agent-office.delivery-control.v2';
  readonly mode: DeliveryControlMode;
  readonly activationId?: string;
  readonly transitions: readonly DeliveryControlTransition[];
  readonly receipts: readonly PersistedDisableReceipt[];
}

interface LegacyDeliveryControlState {
  readonly schemaVersion: 'agent-office.delivery-control.v1';
  readonly mode: 'DISABLED';
  readonly receipts: readonly PersistedDisableReceipt[];
}

export interface DeliveryControlProjection {
  readonly mode: DeliveryControlMode;
  readonly activationId?: string;
  readonly lastDisabledAt?: string;
  readonly lastReasonCode?: string;
  readonly receiptCount: number;
  readonly transitionCount: number;
}

export interface ValidatedDeliveryGrant {
  readonly activationId: string;
  readonly grantHash: string;
  readonly activatedAt: string;
}

const INITIAL_STATE: DeliveryControlStateV2 = {
  schemaVersion: 'agent-office.delivery-control.v2',
  mode: 'DISABLED_DEFAULT',
  transitions: [],
  receipts: [],
};

const GENESIS_HASH = `sha256:${'0'.repeat(64)}`;

export class DurableDeliveryControl {
  private queue: Promise<void> = Promise.resolve();

  private constructor(
    private readonly stateRoot: string,
    private readonly artifacts: ImmutableArtifactStore,
    private state: DeliveryControlStateV2,
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
      mode: this.state.mode,
      ...(this.state.activationId === undefined ? {} : { activationId: this.state.activationId }),
      ...(latest === undefined ? {} : {
        lastDisabledAt: latest.disabledAt,
        lastReasonCode: latest.reasonCode,
      }),
      receiptCount: this.state.receipts.length,
      transitionCount: this.state.transitions.length,
    };
  }

  public isEnabled(): boolean {
    return this.state.mode === 'ENABLED_BY_EXACT_GRANT';
  }

  public armValidatedGrant(grant: ValidatedDeliveryGrant): Promise<DeliveryControlProjection> {
    const operation = this.queue.then(() => this.armSerial(grant));
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  public disable(command: DeliveryDisableHttpCommand): Promise<DeliveryDisableReceipt> {
    const operation = this.queue.then(() => this.disableSerial(command));
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async armSerial(grant: ValidatedDeliveryGrant): Promise<DeliveryControlProjection> {
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(grant.activationId) ||
      !isSha256(grant.grantHash)
    ) {
      throw new DomainError('INVALID_SCHEMA', 'validated exact delivery grant is invalid');
    }
    assertUtcTimestamp(grant.activatedAt, 'delivery activation time');
    if (
      this.state.mode === 'ENABLED_BY_EXACT_GRANT' &&
      this.state.activationId === grant.activationId
    ) {
      const transition = this.state.transitions.at(-1);
      if (transition?.evidenceHash !== grant.grantHash) {
        throw new DomainError('IDEMPOTENCY_KEY_REUSED', 'activation ID was reused with different authority');
      }
      return this.project();
    }
    if (this.state.mode !== 'DISABLED_DEFAULT') {
      throw new DomainError(
        'GATEWAY_DISABLED',
        'latched exact delivery cannot be re-enabled without a separately reviewed recovery version',
      );
    }
    await this.artifacts.putScopedCanonicalJson(
      'delivery-activation',
      [grant.activationId],
      {
        schemaVersion: 'agent-office.delivery-activation-receipt.v1',
        activationId: grant.activationId,
        grantHash: grant.grantHash,
        activatedAt: grant.activatedAt,
        status: 'ENABLED_BY_EXACT_GRANT',
      },
      8 * 1024,
    );
    const transition = nextTransition(this.state, {
      kind: 'EXACT_GRANT_ENABLED',
      activationId: grant.activationId,
      occurredAt: grant.activatedAt,
      evidenceHash: grant.grantHash,
    });
    const next: DeliveryControlStateV2 = {
      ...this.state,
      mode: 'ENABLED_BY_EXACT_GRANT',
      activationId: grant.activationId,
      transitions: [...this.state.transitions, transition],
    };
    await this.persist(next);
    return this.project();
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
      schemaVersion: 'agent-office.delivery-disable-receipt.v2',
      requestId: command.requestId,
      disabledAt: command.disabledAt,
      reasonCode: command.reasonCode,
      subjectId: command.subjectId,
      correlationId: command.correlationId,
      causationId: command.causationId,
      receivedAt: command.receivedAt,
      priorMode: this.state.mode,
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
    const transition = nextTransition(this.state, {
      kind: 'DELIVERY_DISABLED_LATCHED',
      reasonCode: command.reasonCode,
      occurredAt: command.disabledAt,
      evidenceHash: artifact.sha256,
    });
    const next: DeliveryControlStateV2 = {
      ...this.state,
      mode: 'DISABLED_LATCHED',
      transitions: [...this.state.transitions, transition],
      receipts: [...this.state.receipts, receipt],
    };
    await this.persist(next);
    return {
      requestId: receipt.requestId,
      status: receipt.status,
      disabledAt: receipt.disabledAt,
      reasonCode: receipt.reasonCode,
      replayed: false,
    };
  }

  private async persist(next: DeliveryControlStateV2): Promise<void> {
    await writeAtomicCanonicalJson(
      path.join(this.stateRoot, 'indexes', 'delivery-control.json'),
      next,
    );
    this.state = next;
  }
}

function nextTransition(
  state: DeliveryControlStateV2,
  input: Omit<DeliveryControlTransition, 'sequence' | 'priorTransitionHash' | 'transitionHash'>,
): DeliveryControlTransition {
  const priorTransitionHash = state.transitions.at(-1)?.transitionHash ?? GENESIS_HASH;
  const core = {
    sequence: state.transitions.length + 1,
    ...input,
    priorTransitionHash,
  };
  return { ...core, transitionHash: hashCanonical(core) };
}

async function readState(filePath: string): Promise<DeliveryControlStateV2> {
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
  if (isLegacyState(value)) {
    assertReceipts(value.receipts);
    return {
      schemaVersion: 'agent-office.delivery-control.v2',
      mode: value.receipts.length === 0 ? 'DISABLED_DEFAULT' : 'DISABLED_LATCHED',
      transitions: [],
      receipts: value.receipts,
    };
  }
  assertDeliveryState(value);
  return value;
}

function assertDeliveryState(value: unknown): asserts value is DeliveryControlStateV2 {
  if (
    typeof value !== 'object' || value === null ||
    !('schemaVersion' in value) || value.schemaVersion !== 'agent-office.delivery-control.v2' ||
    !('mode' in value) ||
    !['DISABLED_DEFAULT', 'ENABLED_BY_EXACT_GRANT', 'DISABLED_LATCHED'].includes(String(value.mode)) ||
    !('transitions' in value) || !Array.isArray(value.transitions) || value.transitions.length > 8192 ||
    !('receipts' in value) || !Array.isArray(value.receipts) || value.receipts.length > 4096
  ) {
    throw new DomainError('STORE_QUARANTINED', 'delivery control state schema is invalid');
  }
  const stateObject = value as Record<string, unknown>;
  const stateKeys = [
    'schemaVersion', 'mode', ...(Object.hasOwn(stateObject, 'activationId') ? ['activationId'] : []),
    'transitions', 'receipts',
  ];
  if (
    Object.keys(stateObject).length !== stateKeys.length ||
    Object.keys(stateObject).some((key) => !stateKeys.includes(key))
  ) throw new DomainError('STORE_QUARANTINED', 'delivery control state shape is invalid');
  const activationId = 'activationId' in value ? value.activationId : undefined;
  if (
    (value.mode === 'ENABLED_BY_EXACT_GRANT' &&
      (typeof activationId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(activationId))) ||
    (activationId !== undefined && typeof activationId !== 'string')
  ) {
    throw new DomainError('STORE_QUARANTINED', 'delivery activation identity is invalid');
  }
  assertReceipts(value.receipts);
  let prior = GENESIS_HASH;
  let priorTime = Number.NEGATIVE_INFINITY;
  const transitions = value.transitions as unknown[];
  for (const [index, raw] of transitions.entries()) {
    if (
      typeof raw !== 'object' || raw === null ||
      !('sequence' in raw) || raw.sequence !== index + 1 ||
      !('kind' in raw) ||
      (raw.kind !== 'EXACT_GRANT_ENABLED' && raw.kind !== 'DELIVERY_DISABLED_LATCHED') ||
      !('occurredAt' in raw) || typeof raw.occurredAt !== 'string' ||
      !('evidenceHash' in raw) || typeof raw.evidenceHash !== 'string' || !isSha256(raw.evidenceHash) ||
      !('priorTransitionHash' in raw) || raw.priorTransitionHash !== prior ||
      !('transitionHash' in raw) || typeof raw.transitionHash !== 'string' || !isSha256(raw.transitionHash)
    ) {
      throw new DomainError('STORE_QUARANTINED', 'delivery control transition is invalid');
    }
    const transitionObject = raw as Record<string, unknown>;
    const transitionKeys = [
      'sequence', 'kind',
      ...(Object.hasOwn(transitionObject, 'activationId') ? ['activationId'] : []),
      ...(Object.hasOwn(transitionObject, 'reasonCode') ? ['reasonCode'] : []),
      'occurredAt', 'evidenceHash', 'priorTransitionHash', 'transitionHash',
    ];
    if (
      Object.keys(transitionObject).length !== transitionKeys.length ||
      Object.keys(transitionObject).some((key) => !transitionKeys.includes(key)) ||
      (raw.kind === 'EXACT_GRANT_ENABLED' &&
        (typeof transitionObject.activationId !== 'string' || transitionObject.reasonCode !== undefined)) ||
      (raw.kind === 'DELIVERY_DISABLED_LATCHED' &&
        (typeof transitionObject.reasonCode !== 'string' || transitionObject.activationId !== undefined))
    ) throw new DomainError('STORE_QUARANTINED', 'delivery control transition shape is invalid');
    const { transitionHash, ...core } = raw as unknown as DeliveryControlTransition;
    if (hashCanonical(core) !== transitionHash) {
      throw new DomainError('STORE_QUARANTINED', 'delivery control transition hash mismatched');
    }
    assertUtcTimestamp(raw.occurredAt, 'delivery control transition time');
    const occurredAt = Date.parse(raw.occurredAt);
    if (occurredAt < priorTime) {
      throw new DomainError('STORE_QUARANTINED', 'delivery control transition time moved backwards');
    }
    priorTime = occurredAt;
    prior = transitionHash;
  }
  const typedTransitions = transitions as DeliveryControlTransition[];
  const enableTransitions = typedTransitions.filter((transition) =>
    transition.kind === 'EXACT_GRANT_ENABLED');
  const disableTransitions = typedTransitions.filter((transition) =>
    transition.kind === 'DELIVERY_DISABLED_LATCHED');
  const typedReceipts = value.receipts as unknown as readonly PersistedDisableReceipt[];
  const receiptSuffix = typedReceipts.slice(typedReceipts.length - disableTransitions.length);
  if (
    enableTransitions.length > 1 ||
    (enableTransitions.length === 1 && typedTransitions[0] !== enableTransitions[0]) ||
    disableTransitions.length > value.receipts.length ||
    disableTransitions.some((transition, index) => {
      const receipt = receiptSuffix[index];
      return receipt?.artifactHash !== transition.evidenceHash ||
        transition.occurredAt !== receipt.disabledAt || transition.reasonCode !== receipt.reasonCode;
    }) ||
    (activationId !== undefined &&
      (enableTransitions.length !== 1 || enableTransitions[0]?.activationId !== activationId))
  ) throw new DomainError('STORE_QUARANTINED', 'delivery control transition evidence is inconsistent');
  const lastTransition = transitions.at(-1) as DeliveryControlTransition | undefined;
  if (
    (value.mode === 'DISABLED_DEFAULT' &&
      (lastTransition !== undefined || value.receipts.length !== 0 || activationId !== undefined)) ||
    (value.mode === 'ENABLED_BY_EXACT_GRANT' &&
      (lastTransition?.kind !== 'EXACT_GRANT_ENABLED' || value.receipts.length !== 0 ||
        activationId !== lastTransition.activationId)) ||
    (value.mode === 'DISABLED_LATCHED' &&
      (value.receipts.length === 0 ||
        (lastTransition !== undefined && lastTransition.kind !== 'DELIVERY_DISABLED_LATCHED')))
  ) throw new DomainError('STORE_QUARANTINED', 'delivery control mode conflicts with its transition chain');
}

function isLegacyState(value: unknown): value is LegacyDeliveryControlState {
  return typeof value === 'object' && value !== null &&
    'schemaVersion' in value && value.schemaVersion === 'agent-office.delivery-control.v1' &&
    'mode' in value && value.mode === 'DISABLED' &&
    'receipts' in value && Array.isArray(value.receipts);
}

function assertReceipts(receipts: readonly unknown[]): asserts receipts is readonly PersistedDisableReceipt[] {
  const requestIds = new Set<string>();
  for (const raw of receipts) {
    if (
      typeof raw !== 'object' || raw === null ||
      !('requestId' in raw) || typeof raw.requestId !== 'string' ||
      !('status' in raw) || raw.status !== 'DISABLED' ||
      !('disabledAt' in raw) || typeof raw.disabledAt !== 'string' ||
      !('reasonCode' in raw) || typeof raw.reasonCode !== 'string' ||
      !('replayed' in raw) || raw.replayed !== false ||
      !('commandHash' in raw) || typeof raw.commandHash !== 'string' || !isSha256(raw.commandHash) ||
      !('artifactRef' in raw) || typeof raw.artifactRef !== 'string' ||
      !('artifactHash' in raw) || typeof raw.artifactHash !== 'string' || !isSha256(raw.artifactHash)
    ) {
      throw new DomainError('STORE_QUARANTINED', 'delivery control receipt is invalid');
    }
    const receiptObject = raw as Record<string, unknown>;
    const receiptKeys = [
      'requestId', 'status', 'disabledAt', 'reasonCode', 'replayed', 'commandHash',
      'artifactRef', 'artifactHash',
    ];
    if (
      Object.keys(receiptObject).length !== receiptKeys.length ||
      Object.keys(receiptObject).some((key) => !receiptKeys.includes(key)) ||
      requestIds.has(raw.requestId) ||
      raw.artifactRef !==
        `artifacts/operations/delivery-disable/${raw.requestId}/${raw.artifactHash.slice(7)}.json`
    ) throw new DomainError('STORE_QUARANTINED', 'delivery control receipt shape is invalid');
    requestIds.add(raw.requestId);
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
