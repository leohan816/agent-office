import { execFile } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { hashCanonical, sha256Bytes } from '../../src/persistence/file-store/hashing.js';
import { canonicalBytes } from '../../src/persistence/file-store/canonical-json.js';
import { readStateRootFormat } from '../../src/persistence/file-store/path-safety.js';
import { As1ProfileInboundStore } from '../../src/application/slack-pilot/inbound-store.js';
import { selectProfile, type As1Profile } from '../../src/application/slack-pilot/profiles.js';
import { parseContainedPointerRef, parsePointerDeliveryGrant, parseReceiveGrant, type As1PilotReceiveGrantV1 } from '../../src/application/slack-pilot/contracts.js';
import { buildEvidenceAuthority, type As1GitProvenanceVerifier } from '../../src/application/slack-pilot/evidence-ingress.js';
import { userStatusOutboundId } from '../../src/application/slack-pilot/outbox.js';
import type { As1ReceiveGrantProvenanceGate } from '../../src/adapters/gateways/slack-pilot/exact-authority.js';
import type { As1TmuxObservationPort, As1DeliveryProvenanceGate } from '../../src/adapters/gateways/slack-pilot/exact-transport.js';
import { parseTmuxDestination, type As1TmuxDestination } from '../../src/adapters/gateways/slack-pilot/exact-authority.js';
import type { As1AcceptedArtifact, As1GitArtifactObserver, As1GitObservation } from '../../src/adapters/gateways/slack-pilot/git-artifact-source.js';
import type { As1InboundEnvelope, As1SocketConnectInput, As1SocketConnectResult } from '../../src/adapters/gateways/slack-pilot/socket-client.js';
import type { As1WebPort } from '../../src/adapters/gateways/slack-pilot/web-client.js';
import {
  As1GatewayComposition,
  parseRuntimeDescriptor,
  type As1CompositionDependencies,
  type As1CompositionSocketPort,
} from '../../src/runtime/as1-slack-pilot/composition.js';
import {
  buildAs1ProductionDependencies,
  runForegroundOwner,
  type As1ForegroundOwnerBoundary,
  type As1OwnerSignal,
} from '../../src/runtime/as1-slack-pilot/cli.js';
import {
  FakeClock,
  FakeGitVerifier,
  fakeWireWorld,
  secretText,
  slackEnvelope,
  validAdvisorAck,
  validDestination,
  validReceiveGrant,
  validSecretValues,
  writeSecretFile,
} from '../helpers/as1-slack-fakes.js';
import { makeStateRoot } from '../helpers/fixtures.js';

const CLOCK_ISO = '2026-07-14T22:05:00.000Z';
const AUTH_ROOT = 'advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001';
const RECEIVE_GRANT_REF = `${AUTH_ROOT}/receive-grant.json`;
const ACCEPTING_RECEIVE_GATE: As1ReceiveGrantProvenanceGate = { assertAccepted: () => Promise.resolve() };
const ACCEPTING_DELIVERY_GATE: As1DeliveryProvenanceGate = { assertAccepted: () => Promise.resolve() };

/**
 * The exact domain-separated profile-state-root binding hash (design §5.2) a correctly-minted receive grant carries
 * in `profileStateRootHash`. Computed from the actual initialized state-root marker so the composition's F02 binding
 * gate accepts a correctly-bound grant (and, in the negative test, rejects a mis-bound one).
 */
async function bindingHashFor(stateRoot: string, slug: string): Promise<string> {
  const stateRootFormat = await readStateRootFormat(stateRoot);
  return hashCanonical({
    schemaVersion: 'agent-office.as1-profile-state-root-binding.v1',
    stateRootFormat,
    profileStateRootRef: `indexes/as1-slack-pilot/profiles/${slug}`,
  });
}

/**
 * The exact pre-transition global-control + selected-profile-latch snapshot hashes (design §5.2, F02) a correctly
 * minted grant carries. Read from the ACTUAL persisted records — so the composition must already be OPEN (its control
 * records exist) and start() not yet run. Together with `bindingHashFor` these are the three grant binding hashes.
 */
async function boundGrantHashes(stateRoot: string, slug: string): Promise<Record<string, string>> {
  const controlRaw = await readFile(path.join(stateRoot, 'indexes/as1-slack-pilot/global-control.json'), 'utf8');
  const latchRaw = await readFile(path.join(stateRoot, `indexes/as1-slack-pilot/profiles/${slug}/failure-latch.json`), 'utf8');
  return {
    profileStateRootHash: await bindingHashFor(stateRoot, slug),
    globalControlSnapshotHash: hashCanonical(JSON.parse(controlRaw) as unknown),
    profileLatchSnapshotHash: hashCanonical(JSON.parse(latchRaw) as unknown),
  };
}

/** A path-keyed read-only Git observer fake. It records the accepted pair passed on each observation (F03 spy) and
 *  can be told to return a durable DIVERGED for a path re-observed WITH an accepted pair (post-acceptance change). */
class FakeGitSource implements As1GitArtifactObserver {
  private readonly byPath = new Map<string, Buffer>();
  private readonly lazyByPath = new Map<string, () => Promise<unknown>>();
  public readonly acceptedCalls: { path: string; accepted: As1AcceptedArtifact | undefined }[] = [];
  public readonly divergePaths = new Set<string>();
  public readonly throwOnReObservePaths = new Set<string>();
  private readonly firstAdd: string;
  public constructor(firstAddCommit = 'a'.repeat(40)) {
    this.firstAdd = firstAddCommit;
  }
  public set(relativePath: string, value: unknown): void {
    this.byPath.set(relativePath, Buffer.from(JSON.stringify(value), 'utf8'));
  }
  /** A lazily-materialized artifact — computed at observe-time (AFTER the owner's own open established the control),
   *  so a receive grant can carry the exact pre-transition control/latch hashes even when the owner opens internally. */
  public setLazy(relativePath: string, factory: () => Promise<unknown>): void {
    this.lazyByPath.set(relativePath, factory);
  }
  public getRepositoryId(): string {
    return 'foundation-docs';
  }
  public async observe(relativePath: string, accepted?: As1AcceptedArtifact): Promise<As1GitObservation> {
    this.acceptedCalls.push({ path: relativePath, accepted });
    if (accepted !== undefined && this.throwOnReObservePaths.has(relativePath)) {
      throw new DomainError('STORE_QUARANTINED', 'git observation error on re-observation');
    }
    if (accepted !== undefined && this.divergePaths.has(relativePath)) {
      return { status: 'DIVERGED', reason: 'CONTENT_DIVERGED', firstAddCommit: null, blobSha256: null, bytes: null };
    }
    const lazy = this.lazyByPath.get(relativePath);
    const bytes = lazy !== undefined ? Buffer.from(JSON.stringify(await lazy()), 'utf8') : this.byPath.get(relativePath);
    if (bytes === undefined) {
      return { status: 'NOT_READY', reason: 'ABSENT', firstAddCommit: null, blobSha256: null, bytes: null };
    }
    return { status: 'READY', reason: 'READY', firstAddCommit: this.firstAdd, blobSha256: sha256Bytes(bytes), bytes };
  }
}

/** A composition socket fake with the Phase B one-use arm; the test drives one delivered envelope. */
class FakeCompositionSocket implements As1CompositionSocketPort {
  public armed = false;
  public disconnected = false;
  private handler: ((envelope: As1InboundEnvelope) => Promise<void>) | null = null;
  public connect(input: As1SocketConnectInput): Promise<As1SocketConnectResult> {
    return Promise.resolve({ ok: input.readinessSeal() });
  }
  public onEnvelope(handler: (envelope: As1InboundEnvelope) => Promise<void>): void {
    this.handler = handler;
  }
  public disconnect(): Promise<void> {
    this.disconnected = true;
    return Promise.resolve();
  }
  public armReceive(): void {
    this.armed = true;
  }
  public async deliver(envelope: As1InboundEnvelope): Promise<void> {
    if (!this.armed || this.handler === null) throw new Error('socket not armed');
    await this.handler(envelope);
  }
}

class FakeTmuxObservationPort implements As1TmuxObservationPort {
  public pasteCalls = 0;
  public enterCalls = 0;
  public constructor(private readonly destination: As1TmuxDestination) {}
  public observe(): Promise<As1TmuxDestination> {
    return Promise.resolve(this.destination);
  }
  public bufferExists(): Promise<boolean> {
    return Promise.resolve(false);
  }
  public loadVerifiedBuffer(): Promise<void> {
    return Promise.resolve();
  }
  public pasteBuffer(): Promise<void> {
    this.pasteCalls += 1;
    return Promise.resolve();
  }
  public sendEnter(): Promise<void> {
    this.enterCalls += 1;
    return Promise.resolve();
  }
  public deleteBuffer(): Promise<void> {
    return Promise.resolve();
  }
}

async function buildDeliveryAuthority(
  stateRoot: string,
  store: As1ProfileInboundStore,
  receiveGrant: As1PilotReceiveGrantV1,
  profile: As1Profile,
  intakeId: string,
): Promise<{ readonly grant: Record<string, unknown>; readonly lease: Record<string, unknown> }> {
  const state = await store.readReceiveGrantState(receiveGrant.receiveGrantId);
  const root = await store.findRootByIntakeId(intakeId);
  if (state === null || root === null) throw new Error('missing durable intake state');
  const rootCorrelationHash = hashCanonical({
    rootKeyHash: root.rootKeyHash,
    bindingStateHash: root.bindingStateHash,
    sourceEventId: root.sourceEventId,
    rootTs: root.rootTs,
    intakeId,
  });
  const deliveryId = `as1p-${hashCanonical({ intakeId }).slice('sha256:'.length, 'sha256:'.length + 40)}`;
  const pointerDir = path.join(stateRoot, 'artifacts/as1-slack-pilot', profile.profileStateSlug, 'pointers', deliveryId);
  const [pointerFile] = await readdir(pointerDir);
  if (pointerFile === undefined) throw new Error('materialized pointer not found');
  const pointerArtifactRef = `artifacts/as1-slack-pilot/${profile.profileStateSlug}/pointers/${deliveryId}/${pointerFile}`;
  const pointerHash = `sha256:${pointerFile.replace('.json', '')}`;
  const grant = {
    schemaVersion: 'agent-office.as1-pointer-delivery-grant.v1',
    pointerDeliveryGrantId: 'as1-pdg-live-0001',
    receiveGrantId: receiveGrant.receiveGrantId,
    receiveGrantBindingHash: state.stateHash,
    pilotId: receiveGrant.pilotId,
    profileId: receiveGrant.profileId,
    intakeId,
    sourceEventId: root.sourceEventId,
    rootCorrelationHash,
    pointerArtifactRef,
    pointerHash,
    advisorTeam: profile.advisorTeam,
    actorId: profile.actorId,
    roleInstanceId: profile.roleInstanceId,
    evidencePrefix: `${AUTH_ROOT}/runtime-evidence/${profile.profileStateSlug}`,
    governanceSnapshotHash: receiveGrant.governanceSnapshotHash,
    registrySnapshotHash: receiveGrant.registrySnapshotHash,
    globalControlSnapshotHash: receiveGrant.globalControlSnapshotHash,
    profileLatchSnapshotHash: receiveGrant.profileLatchSnapshotHash,
    authorityRepositoryId: receiveGrant.authorityRepositoryId,
    authorityRootId: receiveGrant.authorityRootId,
    authoritySourceCommit: 'b'.repeat(40),
    issuedAt: '2026-07-14T22:05:05.000Z',
    expiresAt: '2026-07-14T22:08:00.000Z',
    useLimit: 1,
  };
  const lease = {
    schemaVersion: 'agent-office.as1-advisor-readiness-lease.v1',
    leaseId: 'as1-lease-live-0001',
    pointerDeliveryGrantId: grant.pointerDeliveryGrantId,
    receiveGrantId: grant.receiveGrantId,
    pilotId: grant.pilotId,
    profileId: grant.profileId,
    intakeId,
    sourceEventId: root.sourceEventId,
    pointerHash,
    advisorTeam: profile.advisorTeam,
    actorId: profile.actorId,
    roleInstanceId: profile.roleInstanceId,
    destination: validDestination(),
    readiness: 'IDLE_FOR_ONE_AS1_POINTER',
    useLimit: 1,
    observedAt: '2026-07-14T22:05:05.000Z',
    issuedAt: '2026-07-14T22:05:05.000Z',
    expiresAt: '2026-07-14T22:05:25.000Z',
    authoritySnapshotHash: grant.governanceSnapshotHash,
    registrySnapshotHash: grant.registrySnapshotHash,
    receiveGrantBindingHash: grant.receiveGrantBindingHash,
    pointerDeliveryGrantSnapshotHash: hashCanonical(grant),
  };
  return { grant, lease };
}

async function startAgentOfficeComposition(options: {
  readonly socket?: FakeCompositionSocket;
  readonly evidenceVerifier?: As1GitProvenanceVerifier;
  readonly decorateInboundStore?: (store: As1ProfileInboundStore) => As1ProfileInboundStore;
  readonly stateRoot?: string;
} = {}) {
  const stateRoot = options.stateRoot ?? (await makeStateRoot());
  const world = fakeWireWorld();
  const { filePath } = await writeSecretFile(secretText(validSecretValues()));
  const descriptor = parseRuntimeDescriptor({
    schemaVersion: 'agent-office.as1-slack-pilot-descriptor.v1',
    enabled: true,
    receiveGrantRef: RECEIVE_GRANT_REF,
    secretFilePath: filePath,
  });
  const gitSource = new FakeGitSource();
  const socket = options.socket ?? new FakeCompositionSocket();
  const tmuxPort = new FakeTmuxObservationPort(parseTmuxDestination(validDestination(), 'destination'));
  const clock = new FakeClock(CLOCK_ISO);
  const composition = await As1GatewayComposition.open(descriptor, {
    stateRoot,
    clock,
    deps: {
      gitSource,
      web: world.web,
      tmuxPort,
      buildSocket: () => socket,
      buildReceiveGrantProvenance: () => ACCEPTING_RECEIVE_GATE,
      buildDeliveryProvenance: () => ACCEPTING_DELIVERY_GATE,
      evidenceVerifier: options.evidenceVerifier ?? new FakeGitVerifier(),
      missionAuthorityRoot: AUTH_ROOT,
      ...(options.decorateInboundStore !== undefined ? { decorateInboundStore: options.decorateInboundStore } : {}),
    },
  });
  // The control records now exist: bind ALL THREE grant hashes (state-root + pre-transition control/latch) and set
  // the grant AFTER open but BEFORE start(), so the F02 pre-transition snapshot comparison accepts it.
  // Freeze ONE exact receive grant: its authority repository must equal the observer's repository id ('foundation-docs';
  // the fake grant defaults to 'agent-office'), otherwise accepted evidence fails closed on EVIDENCE_WRONG_REPOSITORY
  // before ingress. The SAME frozen object is set into Git AND returned, so no test reconstructs a drifting grant.
  const receiveGrantHashes = await boundGrantHashes(stateRoot, 'agent-office-advisor');
  const receiveGrant = validReceiveGrant({ ...receiveGrantHashes, authorityRepositoryId: gitSource.getRepositoryId() });
  gitSource.set(RECEIVE_GRANT_REF, receiveGrant);
  return { stateRoot, composition, gitSource, socket, tmuxPort, clock, receiveGrantHashes, receiveGrant, web: world.web };
}

describe('AS1 live composition — one fixed-workspace / Leo-only Agent Office round trip', () => {
  it('runs the exact startup order, arms receive, and binds one Leo root to an intake', async () => {
    const { composition, socket } = await startAgentOfficeComposition();
    try {
      const start = await composition.start();
      expect(start.connected).toBe(true);
      expect(start.reason).toBe('RECEIVING_ARMED');
      expect(socket.armed).toBe(true); // armed only after the durable RECEIVING transition (design §6 step 8)

      await socket.deliver(slackEnvelope());
      const intakeId = composition.lastIntake();
      expect(intakeId).not.toBeNull();
      expect(composition.status().connected).toBe(true);
    } finally {
      await composition.stop();
    }
  });

  it('delivers the pointer through the pinned-byte tmux transport for the one accepted intake', async () => {
    const { stateRoot, composition, socket, gitSource, tmuxPort, receiveGrant } = await startAgentOfficeComposition();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope());
      const intakeId = composition.lastIntake();
      expect(intakeId).not.toBeNull();
      if (intakeId === null) throw new Error('expected an intake');

      const store = await As1ProfileInboundStore.open(stateRoot, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock(CLOCK_ISO));
      const { grant, lease } = await buildDeliveryAuthority(stateRoot, store, parseReceiveGrant(receiveGrant), selectProfile('AGENT_OFFICE_ADVISOR'), intakeId);
      const base = `${AUTH_ROOT}/runtime-authority/agent-office-advisor/${intakeId}`;
      gitSource.set(`${base}/pointer-delivery-grant.json`, grant);
      gitSource.set(`${base}/readiness-lease.json`, lease);

      const result = await composition.deliverPending();
      expect(result.outcome).toBe('DELIVERED');
      expect(tmuxPort.pasteCalls).toBe(1);
      expect(tmuxPort.enterCalls).toBe(1);

      // Evidence authority builds from the terminal delivery; the evidence blobs are not populated (NOT_READY).
      const evidence = await composition.ingestEvidenceAndProject();
      expect(evidence).toContain('ACK:NOT_READY');
    } finally {
      await composition.stop();
    }
  });

  it('F03 (Patch 2A): a readiness lease that diverges after delivery blocks evidence/outbound and latches the profile', async () => {
    const { stateRoot, composition, socket, gitSource, receiveGrant } = await startAgentOfficeComposition();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope());
      const intakeId = composition.lastIntake();
      if (intakeId === null) throw new Error('expected an intake');
      const store = await As1ProfileInboundStore.open(stateRoot, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock(CLOCK_ISO));
      const { grant, lease } = await buildDeliveryAuthority(stateRoot, store, parseReceiveGrant(receiveGrant), selectProfile('AGENT_OFFICE_ADVISOR'), intakeId);
      const base = `${AUTH_ROOT}/runtime-authority/agent-office-advisor/${intakeId}`;
      gitSource.set(`${base}/pointer-delivery-grant.json`, grant);
      gitSource.set(`${base}/readiness-lease.json`, lease);
      expect((await composition.deliverPending()).outcome).toBe('DELIVERED');

      // The accepted lease diverges (rewrite/deletion) BEFORE evidence ingress — which the real owner calls directly.
      // Evidence/outbound must NOT proceed, and the selected profile durably latches.
      gitSource.divergePaths.add(`${base}/readiness-lease.json`);
      await expect(composition.ingestEvidenceAndProject()).rejects.toThrow(/readiness lease diverged/u);
      const latchRaw = await readFile(path.join(stateRoot, 'indexes/as1-slack-pilot/profiles/agent-office-advisor/failure-latch.json'), 'utf8');
      expect((JSON.parse(latchRaw) as { readonly latched: boolean }).latched).toBe(true);
    } finally {
      await composition.stop();
    }
  });

  it('rejects a second top-level root (one root-to-result round trip per channel)', async () => {
    const { composition, socket } = await startAgentOfficeComposition();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope({ envelopeId: 'Env0AGENTOFFICE1', eventId: 'Ev0AGENTOFFICE01', ts: '1720000000.000100' }));
      const first = composition.lastIntake();
      expect(first).not.toBeNull();
      // A DISTINCT second top-level root is durably rejected (rootLimit: 1) — processed, never a second bound root.
      const second = await socket
        .deliver(slackEnvelope({ envelopeId: 'Env0AGENTOFFICE2', eventId: 'Ev0AGENTOFFICE02', ts: '1720000000.000200' }))
        .then(() => 'ok');
      expect(second).toBe('ok');
      expect(composition.lastIntake()).toBe(first); // the second root produced no new intake
    } finally {
      await composition.stop();
    }
  });

  it('a foreign-workspace / non-Leo secret mismatch fails the composition closed before any receive', async () => {
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues({ SLACK_AGENT_OFFICE_CHANNEL_ID: 'CDIFFERENT0001' })));
    const descriptor = parseRuntimeDescriptor({
      schemaVersion: 'agent-office.as1-slack-pilot-descriptor.v1',
      enabled: true,
      receiveGrantRef: RECEIVE_GRANT_REF,
      secretFilePath: filePath,
    });
    const gitSource = new FakeGitSource();
    // Correctly-bound state-root + control/latch hashes so start() passes the F02 gates and reaches the step-4 secret
    // proof, which rejects because the grant names CAGENTOFFICE01 while the secret names CDIFFERENT0001.
    gitSource.setLazy(RECEIVE_GRANT_REF, async () => validReceiveGrant(await boundGrantHashes(stateRoot, 'agent-office-advisor')));
    const composition = await As1GatewayComposition.open(descriptor, {
      stateRoot,
      clock: new FakeClock(CLOCK_ISO),
      deps: {
        gitSource,
        web: world.web,
        tmuxPort: new FakeTmuxObservationPort(parseTmuxDestination(validDestination(), 'd')),
        buildSocket: () => new FakeCompositionSocket(),
        buildReceiveGrantProvenance: () => ACCEPTING_RECEIVE_GATE,
        buildDeliveryProvenance: () => ACCEPTING_DELIVERY_GATE,
        evidenceVerifier: new FakeGitVerifier(),
        missionAuthorityRoot: AUTH_ROOT,
      },
    });
    await expect(composition.start()).rejects.toThrow();
    await composition.close();
  });

  it('a disabled descriptor never connects (fail-closed) even with live dependencies', async () => {
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));
    const descriptor = parseRuntimeDescriptor({
      schemaVersion: 'agent-office.as1-slack-pilot-descriptor.v1',
      enabled: false,
      receiveGrantRef: null,
      secretFilePath: filePath,
    });
    const composition = await As1GatewayComposition.open(descriptor, {
      stateRoot,
      clock: new FakeClock(CLOCK_ISO),
      deps: {
        gitSource: new FakeGitSource(),
        web: world.web,
        tmuxPort: new FakeTmuxObservationPort(parseTmuxDestination(validDestination(), 'd')),
        buildSocket: () => new FakeCompositionSocket(),
        buildReceiveGrantProvenance: () => ACCEPTING_RECEIVE_GATE,
        buildDeliveryProvenance: () => ACCEPTING_DELIVERY_GATE,
        evidenceVerifier: new FakeGitVerifier(),
        missionAuthorityRoot: AUTH_ROOT,
      },
    });
    const result = await composition.start();
    expect(result.connected).toBe(false);
    expect(result.reason).toBe('DISABLED_DEFAULT_NO_AUTHORITY');
    await composition.close();
  });
});

/** Read the durable global-control state persisted under a state root — used to prove authority ORDER and revert. */
async function readControlState(stateRoot: string): Promise<string> {
  const raw = await readFile(path.join(stateRoot, 'indexes/as1-slack-pilot/global-control.json'), 'utf8');
  return (JSON.parse(raw) as { readonly state: string }).state;
}

/** The full synthetic dependency graph a connecting composition needs; overrides let a test swap one gate/port. */
function fullFakeDeps(
  gitSource: FakeGitSource,
  world: ReturnType<typeof fakeWireWorld>,
  overrides: Partial<As1CompositionDependencies> = {},
): As1CompositionDependencies {
  return {
    gitSource,
    web: world.web,
    tmuxPort: new FakeTmuxObservationPort(parseTmuxDestination(validDestination(), 'd')),
    buildSocket: () => new FakeCompositionSocket(),
    buildReceiveGrantProvenance: () => ACCEPTING_RECEIVE_GATE,
    buildDeliveryProvenance: () => ACCEPTING_DELIVERY_GATE,
    evidenceVerifier: new FakeGitVerifier(),
    missionAuthorityRoot: AUTH_ROOT,
    ...overrides,
  };
}

function enabledDescriptor(secretFilePath: string) {
  return parseRuntimeDescriptor({
    schemaVersion: 'agent-office.as1-slack-pilot-descriptor.v1',
    enabled: true,
    receiveGrantRef: RECEIVE_GRANT_REF,
    secretFilePath,
  });
}

describe('AS1 F02 — authority order, fixed profile-state-root binding, and revert', () => {
  it('proves FULL receive-grant provenance BEFORE the first durable authority transition (ordered spy)', async () => {
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));
    const gitSource = new FakeGitSource();
    gitSource.setLazy(RECEIVE_GRANT_REF, async () => validReceiveGrant(await boundGrantHashes(stateRoot, 'agent-office-advisor')));
    const states: string[] = [];
    const spyGate: As1ReceiveGrantProvenanceGate = {
      assertAccepted: async () => {
        states.push(await readControlState(stateRoot));
      },
    };
    const composition = await As1GatewayComposition.open(enabledDescriptor(filePath), {
      stateRoot,
      clock: new FakeClock(CLOCK_ISO),
      deps: fullFakeDeps(gitSource, world, { buildReceiveGrantProvenance: () => spyGate }),
    });
    try {
      await composition.start();
      // The FIRST provenance proof ran while the control was still DISABLED_DEFAULT — before RECEIVE_GRANTED persisted.
      expect(states[0]).toBe('DISABLED_DEFAULT');
    } finally {
      await composition.stop();
    }
  });

  it('rejects a receive grant whose profileStateRootHash does not bind this owner root, before any transition', async () => {
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));
    const gitSource = new FakeGitSource();
    gitSource.set(RECEIVE_GRANT_REF, validReceiveGrant({ profileStateRootHash: `sha256:${'0'.repeat(64)}` }));
    const composition = await As1GatewayComposition.open(enabledDescriptor(filePath), {
      stateRoot,
      clock: new FakeClock(CLOCK_ISO),
      deps: fullFakeDeps(gitSource, world),
    });
    await expect(composition.start()).rejects.toThrow(/profileStateRootHash/u);
    expect(await readControlState(stateRoot)).toBe('DISABLED_DEFAULT'); // never transitioned
    await composition.close();
  });

  it('reverts a post-transition startup failure to a clean disabled state and RELEASES the writer lock', async () => {
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    // A secret whose channel disagrees with the grant throws at step 4 — AFTER the durable RECEIVE_GRANTED transition.
    const { filePath } = await writeSecretFile(secretText(validSecretValues({ SLACK_AGENT_OFFICE_CHANNEL_ID: 'CDIFFERENT0001' })));
    const gitSource = new FakeGitSource();
    gitSource.setLazy(RECEIVE_GRANT_REF, async () => validReceiveGrant(await boundGrantHashes(stateRoot, 'agent-office-advisor')));
    const composition = await As1GatewayComposition.open(enabledDescriptor(filePath), {
      stateRoot,
      clock: new FakeClock(CLOCK_ISO),
      deps: fullFakeDeps(gitSource, world),
    });
    await expect(composition.start()).rejects.toThrow(DomainError);
    // The durable control reverted to a legal disabled state — never left half-started at RECEIVE_GRANTED.
    expect(await readControlState(stateRoot)).toBe('DISABLED_DEFAULT');
    // Ownership was released: a fresh foreground composition can re-acquire the writer lock on the same root.
    const reopened = await As1GatewayComposition.open(enabledDescriptor(filePath), {
      stateRoot,
      clock: new FakeClock(CLOCK_ISO),
      deps: fullFakeDeps(gitSource, world),
    });
    await reopened.close();
  });
});

describe('AS1 F03 — accepted-pair re-observation, divergence latch, and grant expiry', () => {
  it('re-observes the accepted receive grant WITH its internally bound (firstAddCommit, blobSha256) pair', async () => {
    const { composition, gitSource } = await startAgentOfficeComposition();
    try {
      await composition.start();
      gitSource.acceptedCalls.length = 0; // ignore the pre-acceptance start observation
      expect(await composition.observeReceiveGrantOnce()).toBe('RECEIVING');
      const reObs = gitSource.acceptedCalls.find((call) => call.path === RECEIVE_GRANT_REF);
      expect(reObs?.accepted?.firstAddCommit).toBe('a'.repeat(40));
      expect(typeof reObs?.accepted?.blobSha256).toBe('string');
    } finally {
      await composition.stop();
    }
  });

  it('durably latches the profile when the accepted receive grant DIVERGES after acceptance', async () => {
    const { composition, gitSource } = await startAgentOfficeComposition();
    try {
      await composition.start();
      gitSource.divergePaths.add(RECEIVE_GRANT_REF); // a post-acceptance rewrite / deletion / path reuse
      expect(await composition.observeReceiveGrantOnce()).toBe('DIVERGED');
      // The composition stopped receiving; a delivery attempt now fails closed.
      await expect(composition.deliverPending()).rejects.toThrow(DomainError);
    } finally {
      await composition.stop();
    }
  });

  it('closes receive at the exclusive grant expiry (bounded, no renew/switch/reconnect)', async () => {
    const clock = new FakeClock(CLOCK_ISO);
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));
    const gitSource = new FakeGitSource();
    gitSource.setLazy(RECEIVE_GRANT_REF, async () => validReceiveGrant(await boundGrantHashes(stateRoot, 'agent-office-advisor')));
    const composition = await As1GatewayComposition.open(enabledDescriptor(filePath), { stateRoot, clock, deps: fullFakeDeps(gitSource, world) });
    try {
      await composition.start();
      clock.advanceMs(10 * 60 * 1000); // past the grant's exclusive expiry (issued 22:05, expires 22:10)
      expect(await composition.observeReceiveGrantOnce()).toBe('EXPIRED');
    } finally {
      await composition.stop();
    }
  });
});

describe('AS1 F01 — foreground production owner', () => {
  async function makeOwnerBoundary(
    clock: FakeClock,
    overrides: Partial<As1ForegroundOwnerBoundary> = {},
  ): Promise<{ boundary: As1ForegroundOwnerBoundary; signals: Map<As1OwnerSignal, () => void>; stateRoot: string; gitSource: FakeGitSource }> {
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));
    const gitSource = new FakeGitSource();
    // The owner opens the composition internally; the grant is materialized lazily at observe-time so it carries the
    // exact pre-transition control/latch hashes computed after that open.
    gitSource.setLazy(RECEIVE_GRANT_REF, async () => validReceiveGrant(await boundGrantHashes(stateRoot, 'agent-office-advisor')));
    const signals = new Map<As1OwnerSignal, () => void>();
    const boundary: As1ForegroundOwnerBoundary = {
      descriptor: enabledDescriptor(filePath),
      stateRoot,
      clock,
      buildDeps: () => fullFakeDeps(gitSource, world),
      initialize: () => Promise.resolve(),
      installSignalHandlers: (handlers) => {
        (['SIGINT', 'SIGTERM', 'SIGUSR2'] as const).forEach((signal) => signals.set(signal, handlers[signal]));
        return ['SIGINT', 'SIGTERM', 'SIGUSR2'];
      },
      delay: () => Promise.resolve(),
      ...overrides,
    };
    return { boundary, signals, stateRoot, gitSource };
  }

  it('constructs a COMPLETE real production dependency graph (no invocation)', () => {
    const deps = buildAs1ProductionDependencies(['a'.repeat(40)]);
    expect(typeof deps.gitSource.observe).toBe('function');
    expect(typeof deps.web.authTest).toBe('function');
    expect(typeof deps.tmuxPort.observe).toBe('function');
    expect(typeof deps.buildSocket).toBe('function');
    expect(typeof deps.buildReceiveGrantProvenance).toBe('function');
    expect(typeof deps.buildDeliveryProvenance).toBe('function');
    expect(typeof deps.evidenceVerifier.verify).toBe('function');
  });

  it('fails closed on an incomplete production dependency graph (before ownership)', async () => {
    const { boundary } = await makeOwnerBoundary(new FakeClock(CLOCK_ISO));
    await expect(
      runForegroundOwner({ ...boundary, buildDeps: () => ({}) as unknown as As1CompositionDependencies }),
    ).rejects.toThrow(DomainError);
  });

  it('fails closed WITHIN the owner-result boundary if a required owner signal handler is absent (no raw throw)', async () => {
    const { boundary, stateRoot } = await makeOwnerBoundary(new FakeClock(CLOCK_ISO));
    // F01 (Patch 4): a missing handler no longer throws a raw error before the stable owner result — it returns a
    // truthful fail-closed result and releases the lock (a fresh composition can re-open the same root).
    const result = await runForegroundOwner({ ...boundary, installSignalHandlers: () => ['SIGINT', 'SIGTERM'] });
    expect(result.ok).toBe(false);
    expect(result.lines.join('|')).toContain('MISSING_HANDLER_DISABLED');
    const reopened = await As1GatewayComposition.open(boundary.descriptor, { stateRoot, clock: new FakeClock(CLOCK_ISO), deps: boundary.buildDeps() });
    await reopened.close();
  });

  it('installs all three handlers and releases cleanly for a default-disabled descriptor', async () => {
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));
    const descriptor = parseRuntimeDescriptor({
      schemaVersion: 'agent-office.as1-slack-pilot-descriptor.v1',
      enabled: false,
      receiveGrantRef: null,
      secretFilePath: filePath,
    });
    const signals = new Map<As1OwnerSignal, () => void>();
    const result = await runForegroundOwner({
      descriptor,
      stateRoot,
      clock: new FakeClock(CLOCK_ISO),
      buildDeps: () => fullFakeDeps(new FakeGitSource(), world),
      initialize: () => Promise.resolve(),
      installSignalHandlers: (handlers) => {
        (['SIGINT', 'SIGTERM', 'SIGUSR2'] as const).forEach((signal) => signals.set(signal, handlers[signal]));
        return ['SIGINT', 'SIGTERM', 'SIGUSR2'];
      },
      delay: () => Promise.resolve(),
    });
    expect(signals.size).toBe(3); // all three installed immediately after ownership
    expect(result.lines.join('|')).toContain('NOT_CONNECTED');
    // The writer lock was released: a fresh composition can re-open the same root.
    const reopened = await As1GatewayComposition.open(descriptor, { stateRoot, clock: new FakeClock(CLOCK_ISO), deps: fullFakeDeps(new FakeGitSource(), world) });
    await reopened.close();
  });

  it('holds the foreground through the bounded loop and drains only on a clean SIGTERM', async () => {
    const clock = new FakeClock(CLOCK_ISO);
    const { boundary, signals } = await makeOwnerBoundary(clock);
    let ticks = 0;
    const result = await runForegroundOwner({
      ...boundary,
      delay: () => {
        ticks += 1;
        if (ticks === 3) signals.get('SIGTERM')?.(); // fire only after several live iterations
        return Promise.resolve();
      },
    });
    expect(ticks).toBeGreaterThanOrEqual(3); // it stayed foreground and looped — never an immediate return
    expect(result.ok).toBe(true);
    expect(result.lines.join('|')).toContain('STOPPED_CLEAN');
  });

  it('durably engages an operator incident kill on SIGUSR2', async () => {
    const clock = new FakeClock(CLOCK_ISO);
    const { boundary, signals } = await makeOwnerBoundary(clock);
    let ticks = 0;
    const result = await runForegroundOwner({
      ...boundary,
      delay: () => {
        ticks += 1;
        if (ticks === 2) signals.get('SIGUSR2')?.();
        return Promise.resolve();
      },
    });
    expect(result.ok).toBe(false);
    expect(result.lines.join('|')).toContain('INCIDENT_KILL_ENGAGED');
  });

  it('reaches the bounded GRANT_EXPIRED terminal without any signal', async () => {
    const clock = new FakeClock(CLOCK_ISO);
    const { boundary } = await makeOwnerBoundary(clock);
    let ticks = 0;
    const result = await runForegroundOwner({
      ...boundary,
      delay: () => {
        ticks += 1;
        if (ticks === 2) clock.advanceMs(10 * 60 * 1000); // advance past the exclusive grant expiry
        return Promise.resolve();
      },
    });
    expect(result.lines.join('|')).toContain('GRANT_EXPIRED');
  });

  it('F01: a SIGUSR2 takes PRIORITY over an earlier clean SIGTERM — incident kill wins', async () => {
    const clock = new FakeClock(CLOCK_ISO);
    const { boundary, signals } = await makeOwnerBoundary(clock);
    let ticks = 0;
    const result = await runForegroundOwner({
      ...boundary,
      delay: () => {
        ticks += 1;
        if (ticks === 2) {
          signals.get('SIGTERM')?.(); // clean first ...
          signals.get('SIGUSR2')?.(); // ... then incident: it must override, not lose to the earlier clean signal
        }
        return Promise.resolve();
      },
    });
    expect(result.ok).toBe(false);
    expect(result.lines.join('|')).toContain('INCIDENT_KILL_ENGAGED');
  });

  it('F01: a thrown loop error terminates the owner under a stable redacted outcome (never swallowed or a crash)', async () => {
    const clock = new FakeClock(CLOCK_ISO);
    const { boundary, gitSource } = await makeOwnerBoundary(clock);
    // The accepted-pair re-observation throws (store quarantine). The owner must LATCH + terminate, not swallow it
    // and keep polling (187c7152's broad catch) nor crash the process (a bare rethrow).
    gitSource.throwOnReObservePaths.add(RECEIVE_GRANT_REF);
    const result = await runForegroundOwner({ ...boundary, delay: () => Promise.resolve() });
    expect(result.ok).toBe(false);
    expect(result.lines.join('|')).toContain('OWNER_HALTED');
  });
});

describe('AS1 F06 — both fixed profiles share one owner root sequentially', () => {
  async function activeProfileSlug(stateRoot: string): Promise<string | null> {
    const raw = await readFile(path.join(stateRoot, 'indexes/as1-slack-pilot/global-control.json'), 'utf8');
    return (JSON.parse(raw) as { readonly activeProfileSlug: string | null }).activeProfileSlug;
  }

  it('runs Agent Office then Foundation on the SAME fixed root under one common writer lock', async () => {
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));

    // Profile 1 — Agent Office.
    const aoGit = new FakeGitSource();
    aoGit.setLazy(RECEIVE_GRANT_REF, async () => validReceiveGrant(await boundGrantHashes(stateRoot, 'agent-office-advisor')));
    const aoDescriptor = enabledDescriptor(filePath);
    const ao = await As1GatewayComposition.open(aoDescriptor, { stateRoot, clock: new FakeClock(CLOCK_ISO), deps: fullFakeDeps(aoGit, world) });
    const aoStart = await ao.start();
    expect(aoStart.connected).toBe(true);
    expect(await activeProfileSlug(stateRoot)).toBe('agent-office-advisor');
    // The one common writer lock forbids a SECOND simultaneous owner on the same root — never two live profiles.
    await expect(
      As1GatewayComposition.open(aoDescriptor, { stateRoot, clock: new FakeClock(CLOCK_ISO), deps: fullFakeDeps(aoGit, world) }),
    ).rejects.toThrow();
    await ao.stop();
    expect(await readControlState(stateRoot)).toBe('DISABLED_CLEAN');

    // Profile 2 — Foundation, SEQUENTIALLY on the SAME fixed root after the first profile's clean stop.
    const foundationRef = `${AUTH_ROOT}/receive-grant-foundation.json`;
    const foundGit = new FakeGitSource();
    foundGit.setLazy(foundationRef, async () =>
      validReceiveGrant({
        ...(await boundGrantHashes(stateRoot, 'foundation-advisor')),
        profileId: 'FOUNDATION_ADVISOR',
        appId: 'AFOUNDATION001',
        channelId: 'CFOUNDATION001',
        profileStateRootRef: 'indexes/as1-slack-pilot/profiles/foundation-advisor',
        receiveGrantId: 'as1-receive-grant-foundation-0001',
      }),
    );
    const foundDescriptor = parseRuntimeDescriptor({
      schemaVersion: 'agent-office.as1-slack-pilot-descriptor.v1',
      enabled: true,
      receiveGrantRef: foundationRef,
      secretFilePath: filePath,
    });
    const found = await As1GatewayComposition.open(foundDescriptor, { stateRoot, clock: new FakeClock(CLOCK_ISO), deps: fullFakeDeps(foundGit, world) });
    const foundStart = await found.start();
    expect(foundStart.connected).toBe(true);
    expect(await activeProfileSlug(stateRoot)).toBe('foundation-advisor');
    await found.stop();
    expect(await readControlState(stateRoot)).toBe('DISABLED_CLEAN');
  });
});

const gitRun = promisify(execFile);
const GIT_ENV = { PATH: process.env.PATH ?? '/usr/bin:/bin', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', HOME: '/nonexistent' };
async function git(cwd: string, ...args: readonly string[]): Promise<string> {
  const { stdout } = await gitRun('git', args, { cwd, env: GIT_ENV, maxBuffer: 1_000_000 });
  return stdout.trim();
}

describe('AS1 Patch 2 — residual-defect closure (adversarial, fails on 187c7152)', () => {
  it('F02: the production provenance gate uses INDEPENDENT construction-bound snapshots, not the grant\'s own field', async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), 'as1-p2-snap-'));
    await git(repoRoot, 'init', '-q', '-b', 'main');
    await git(repoRoot, 'config', 'user.email', 'test@example.invalid');
    await git(repoRoot, 'config', 'user.name', 'as1-test');
    await git(repoRoot, 'config', 'commit.gpgsign', 'false');
    await writeFile(path.join(repoRoot, 'gov.txt'), 'frozen governance snapshot\n', 'utf8');
    await git(repoRoot, 'add', 'gov.txt');
    await git(repoRoot, 'commit', '-q', '-m', 'governance snapshot');
    const snapshot = await git(repoRoot, 'rev-parse', 'HEAD');

    // The grant DECLARES its authority basis as the snapshot commit — exactly the field 187c7152 fed to the gate.
    const grantRef = 'authority/agent-office-advisor/receive-grant.json';
    const grant = parseReceiveGrant(validReceiveGrant({ authorityRepositoryId: 'foundation-docs', authoritySourceCommit: snapshot }));
    await mkdir(path.join(repoRoot, path.dirname(grantRef)), { recursive: true });
    await writeFile(path.join(repoRoot, grantRef), canonicalBytes(grant));
    await git(repoRoot, 'add', '--', grantRef);
    await git(repoRoot, 'commit', '-q', '-m', 'add receive grant');
    const grantCommit = await git(repoRoot, 'rev-parse', 'HEAD');
    const accepted = { firstAddCommit: grantCommit, blobSha256: sha256Bytes(canonicalBytes(grant)) };

    // Bound to the REAL independent snapshot → accepted.
    const good = buildAs1ProductionDependencies([snapshot], { repoRoot, upstreamRef: 'main' }).buildReceiveGrantProvenance({ receiveGrantRef: grantRef, accepted, grant });
    await expect(good.assertAccepted(grant)).resolves.toBeUndefined();
    // Bound to a BOGUS independent snapshot → DENIED, even though grant.authoritySourceCommit is a valid ancestor
    // (the exact value 187c7152 trusted and would have accepted). The gate uses the construction-bound snapshot.
    const bogus = buildAs1ProductionDependencies(['f'.repeat(40)], { repoRoot, upstreamRef: 'main' }).buildReceiveGrantProvenance({ receiveGrantRef: grantRef, accepted, grant });
    await expect(bogus.assertAccepted(grant)).rejects.toBeInstanceOf(DomainError);
  });

  it('F02: a grant whose frozen control/latch snapshot hashes do not bind the pre-transition records fails before any transition', async () => {
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));
    const gitSource = new FakeGitSource();
    gitSource.setLazy(RECEIVE_GRANT_REF, async () => validReceiveGrant({
      ...(await boundGrantHashes(stateRoot, 'agent-office-advisor')),
      globalControlSnapshotHash: `sha256:${'0'.repeat(64)}`, // arbitrary well-formed hash, not the real record
    }));
    const composition = await As1GatewayComposition.open(enabledDescriptor(filePath), { stateRoot, clock: new FakeClock(CLOCK_ISO), deps: fullFakeDeps(gitSource, world) });
    await expect(composition.start()).rejects.toThrow(/frozen control\/latch snapshots/u);
    expect(await readControlState(stateRoot)).toBe('DISABLED_DEFAULT'); // never transitioned
    await composition.close();
  });

  it('F02: a Web identity failure after the durable transition reverts to a clean disabled state and releases the lock', async () => {
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));
    const gitSource = new FakeGitSource();
    gitSource.setLazy(RECEIVE_GRANT_REF, async () => validReceiveGrant(await boundGrantHashes(stateRoot, 'agent-office-advisor')));
    const throwingWeb: As1WebPort = {
      authTest: () => Promise.reject(new DomainError('AUTHORITY_ARTIFACT_INVALID', 'auth.test failed')),
      botsInfo: (token, botId) => world.web.botsInfo(token, botId),
      postMessage: (token, request) => world.web.postMessage(token, request),
    };
    const composition = await As1GatewayComposition.open(enabledDescriptor(filePath), { stateRoot, clock: new FakeClock(CLOCK_ISO), deps: fullFakeDeps(gitSource, world, { web: throwingWeb }) });
    await expect(composition.start()).rejects.toThrow(DomainError);
    // Reverted from RECEIVE_GRANTED/AUTHENTICATING to a legal clean disabled state (never a half-started record).
    expect(await readControlState(stateRoot)).toMatch(/^DISABLED_/u);
    // Ownership released: a fresh composition re-acquires the lock.
    const reopened = await As1GatewayComposition.open(enabledDescriptor(filePath), { stateRoot, clock: new FakeClock(CLOCK_ISO), deps: fullFakeDeps(new FakeGitSource(), world) });
    await reopened.close();
  });

  it('F03: evidence projection REQUIRES an already-accepted delivery authority (no first-observation fallback)', async () => {
    const { composition, socket } = await startAgentOfficeComposition();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope());
      expect(composition.lastIntake()).not.toBeNull();
      // No deliverPending has fully accepted a delivery, so evidence must fail closed rather than observe fresh.
      await expect(composition.ingestEvidenceAndProject()).rejects.toThrow(/already-accepted delivery authority/u);
    } finally {
      await composition.stop();
    }
  });

  it('F01: closeIncidentGateNow() synchronously closes every incident admission before the durable kill', async () => {
    const { composition } = await startAgentOfficeComposition();
    try {
      await composition.start();
      expect(composition.status().incidentGateOpen).toBe(true);
      composition.closeIncidentGateNow(); // synchronous — no await
      // The incident admission gate is closed the instant the handler runs, before any durable kill persists.
      expect(composition.status().incidentGateOpen).toBe(false);
    } finally {
      await composition.incidentKill();
    }
  });
});

// Shared Patch 3/Patch 4 owner-harness helpers (module scope so both adversarial describes can use them).
const ADVISOR_SLUG = 'agent-office-advisor';
const ROOT_TS = '1720000000.000100';

  // A live Socket whose disconnect() REJECTS: proves cleanup never synthesizes a clean state when the Socket
  // disconnect is ambiguous (design §11.2/§11.3, F01) — the ambiguity must surface, not be swallowed.
  class DisconnectFailingSocket extends FakeCompositionSocket {
    public override disconnect(): Promise<void> {
      this.disconnected = true;
      return Promise.reject(new DomainError('GATEWAY_DISABLED', 'socket disconnect failed during cleanup'));
    }
  }

  interface LiveOwnerHarness {
    readonly boundary: As1ForegroundOwnerBoundary;
    readonly signals: Map<As1OwnerSignal, () => void>;
    readonly stateRoot: string;
    readonly gitSource: FakeGitSource;
    readonly socketHolder: { current: FakeCompositionSocket | null };
    readonly tmux: FakeTmuxObservationPort;
    readonly grantHolder: { hashes: Record<string, string> | null };
    fire(signal: As1OwnerSignal): void;
  }

  // A foreground-owner boundary over a COMPLETE fake production graph that reaches a live RECEIVING loop, exposing the
  // ordered seams a test needs to deliver a SIGUSR2 incident WHILE a specific awaited boundary is in flight
  // (init / startup / poll / delivery / evidence) and to inject cleanup (disconnect / lock-release) failures.
  async function makeLiveOwnerHarness(options: {
    readonly socketFactory?: () => FakeCompositionSocket;
    readonly depOverrides?: Partial<As1CompositionDependencies>;
    // Build dep overrides with access to a live `fireIncident` (SIGUSR2) and the wire world, so a test can fire an
    // incident DURING a supplied collaborator port's internal await (verifier authTest/botsInfo/connect, delivery
    // provenance, outbox Web, …) and prove ZERO subsequent side effect.
    readonly buildDepOverrides?: (ctx: { fireIncident: () => void; world: ReturnType<typeof fakeWireWorld> }) => Partial<As1CompositionDependencies>;
    readonly installFiresIncident?: boolean; // fire SIGUSR2 from installSignalHandlers — an incident DURING control init
    readonly onReceiveObserve?: (count: number) => void; // fires on each receive-grant observe (start=1, loop=2,3,…)
  } = {}): Promise<LiveOwnerHarness> {
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));
    const gitSource = new FakeGitSource();
    const grantHolder: { hashes: Record<string, string> | null; grant: unknown } = { hashes: null, grant: null };
    let receiveObserveCount = 0;
    // Materialize the receive grant lazily at first observe (after the owner's own open established the control), then
    // RETAIN it so every re-observe returns identical bytes and the delivery authority reuses the exact accepted
    // binding hashes. The per-observe hook lets a test fire an incident DURING a chosen receive-grant observation.
    gitSource.setLazy(RECEIVE_GRANT_REF, async () => {
      if (grantHolder.grant === null) {
        grantHolder.hashes = await boundGrantHashes(stateRoot, ADVISOR_SLUG);
        grantHolder.grant = validReceiveGrant(grantHolder.hashes);
      }
      receiveObserveCount += 1;
      options.onReceiveObserve?.(receiveObserveCount);
      return grantHolder.grant;
    });
    const socketHolder: { current: FakeCompositionSocket | null } = { current: null };
    const tmux = new FakeTmuxObservationPort(parseTmuxDestination(validDestination(), 'd'));
    const signals = new Map<As1OwnerSignal, () => void>();
    const boundary: As1ForegroundOwnerBoundary = {
      descriptor: enabledDescriptor(filePath),
      stateRoot,
      clock: new FakeClock(CLOCK_ISO),
      buildDeps: () =>
        fullFakeDeps(gitSource, world, {
          tmuxPort: tmux,
          buildSocket: () => {
            const socket = (options.socketFactory ?? (() => new FakeCompositionSocket()))();
            socketHolder.current = socket;
            return socket;
          },
          ...options.depOverrides,
          ...(options.buildDepOverrides?.({ fireIncident: () => signals.get('SIGUSR2')?.(), world }) ?? {}),
        }),
      initialize: () => Promise.resolve(),
      installSignalHandlers: (handlers) => {
        (['SIGINT', 'SIGTERM', 'SIGUSR2'] as const).forEach((sig) => signals.set(sig, handlers[sig]));
        // An incident that arrives during the lock-owned control-init window (before the composition's synchronous
        // incident closer is wired) must still be honored after open() and dominate before startup.
        if (options.installFiresIncident === true) handlers.SIGUSR2();
        return ['SIGINT', 'SIGTERM', 'SIGUSR2'];
      },
      delay: () => Promise.resolve(),
    };
    return {
      boundary,
      signals,
      stateRoot,
      gitSource,
      socketHolder,
      tmux,
      grantHolder,
      fire: (signal) => signals.get(signal)?.(),
    };
  }

  // Deliver ONE Leo root envelope to the live owner's captured socket and materialize a fully-bound delivery authority
  // (grant + lease) on the shared Git source. Optional per-observe fire hooks make the grant or lease lazy so a test
  // can deliver an incident DURING the pending delivery or during evidence re-observation.
  async function deliverAndAuthorize(
    h: LiveOwnerHarness,
    opts: { readonly fireDuringGrantObserve?: () => void; readonly fireDuringLeaseObserve?: { on: number; fire: () => void } } = {},
  ): Promise<string> {
    const socket = h.socketHolder.current;
    if (socket === null) throw new Error('start() has not built the socket yet');
    await socket.deliver(slackEnvelope());
    const store = await As1ProfileInboundStore.open(h.stateRoot, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock(CLOCK_ISO));
    const root = await store.findRootByThreadTs(ROOT_TS);
    if (root === null || h.grantHolder.hashes === null) throw new Error('no bound root / receive-grant hashes after delivery');
    const { grant, lease } = await buildDeliveryAuthority(
      h.stateRoot,
      store,
      parseReceiveGrant(validReceiveGrant(h.grantHolder.hashes)),
      selectProfile('AGENT_OFFICE_ADVISOR'),
      root.intakeId,
    );
    const base = `${AUTH_ROOT}/runtime-authority/${ADVISOR_SLUG}/${root.intakeId}`;
    const grantPath = `${base}/pointer-delivery-grant.json`;
    const leasePath = `${base}/readiness-lease.json`;
    if (opts.fireDuringGrantObserve !== undefined) {
      const fire = opts.fireDuringGrantObserve;
      h.gitSource.setLazy(grantPath, () => {
        fire();
        return Promise.resolve(grant);
      });
    } else {
      h.gitSource.set(grantPath, grant);
    }
    if (opts.fireDuringLeaseObserve !== undefined) {
      const { on, fire } = opts.fireDuringLeaseObserve;
      let leaseObserveCount = 0;
      h.gitSource.setLazy(leasePath, () => {
        leaseObserveCount += 1;
        if (leaseObserveCount === on) fire();
        return Promise.resolve(lease);
      });
    } else {
      h.gitSource.set(leasePath, lease);
    }
    return base;
  }

describe('AS1 Patch 3 — F01 incident domination + truthful cleanup (adversarial, fails on 5a23c25c)', () => {
  it('an incident during lock-owned control init dominates BEFORE startup — never a masked clean revert', async () => {
    // A failing Web identity would make start() revert. On the pre-fix owner an incident that arrived during control
    // init is not honored before start(); start() runs, reverts, and the outer catch hard-codes a clean DISABLED_CLEAN,
    // MASKING the incident. The fix routes the pending incident through a durable kill BEFORE start() is ever called —
    // the throwing Web is never reached.
    const throwingWeb: As1WebPort = {
      authTest: () => Promise.reject(new DomainError('AUTHORITY_ARTIFACT_INVALID', 'auth.test failed')),
      botsInfo: () => Promise.reject(new DomainError('AUTHORITY_ARTIFACT_INVALID', 'unused on the dominated path')),
      postMessage: () => Promise.reject(new DomainError('AUTHORITY_ARTIFACT_INVALID', 'unused on the dominated path')),
    };
    const h = await makeLiveOwnerHarness({ installFiresIncident: true, depOverrides: { web: throwingWeb } });
    const result = await runForegroundOwner(h.boundary);
    const line = result.lines.join('|');
    expect(result.ok).toBe(false);
    expect(line).toContain('INCIDENT_KILL_ENGAGED');
    expect(line).not.toContain('DISABLED_CLEAN'); // the incident is never masked as a clean release
  });

  it('an incident while the receive-grant is re-observed (a delivery pending) is not masked as DELIVERY_HALTED / clean', async () => {
    // Concern #2: SIGUSR2 delivered WHILE observeReceiveGrantOnce() is awaited. The pre-fix loop closes the gate but
    // does not resample before deliverPending(); the closed actionability predicate yields STOPPED_BEFORE_PASTE ->
    // DELIVERY_HALTED -> a clean stop() writing DISABLED_CLEAN, masking the incident. The fix resamples after the
    // observe await and dominates before any delivery.
    let delivered = false;
    const h = await makeLiveOwnerHarness({
      onReceiveObserve: (count) => {
        if (count === 3) h.fire('SIGUSR2'); // start=1, loop-iter-1=2, loop-iter-2 (authority now pending)=3
      },
    });
    const result = await runForegroundOwner({
      ...h.boundary,
      delay: async () => {
        if (!delivered) {
          await deliverAndAuthorize(h);
          delivered = true;
        }
      },
    });
    const line = result.lines.join('|');
    expect(result.ok).toBe(false);
    expect(line).toContain('INCIDENT_KILL_ENGAGED');
    expect(line).not.toContain('DISABLED_CLEAN');
    expect(line).not.toContain('DELIVERY_HALTED');
  });

  it('an incident DURING the pending delivery is not masked as DELIVERY_HALTED / clean', async () => {
    // Concern #2, delivery continuation: SIGUSR2 arrives while deliverPending() is awaited (here, during the delivery
    // grant re-observation). The pre-fix loop does not resample after deliverPending(); the fix does (line 511).
    let delivered = false;
    const h = await makeLiveOwnerHarness();
    const result = await runForegroundOwner({
      ...h.boundary,
      delay: async () => {
        if (!delivered) {
          await deliverAndAuthorize(h, { fireDuringGrantObserve: () => h.fire('SIGUSR2') });
          delivered = true;
        }
      },
    });
    const line = result.lines.join('|');
    expect(result.ok).toBe(false);
    expect(line).toContain('INCIDENT_KILL_ENGAGED');
    expect(line).not.toContain('DISABLED_CLEAN');
    expect(line).not.toContain('DELIVERY_HALTED');
  });

  it('an incident DURING evidence projection is dominated before any next operation', async () => {
    // A SIGUSR2 delivered while ingestEvidenceAndProject() re-observes the readiness lease (lease observe #2) must be
    // resampled immediately after evidence (line 518) — never allowed to start later work before the next top sample.
    let delivered = false;
    const h = await makeLiveOwnerHarness();
    const result = await runForegroundOwner({
      ...h.boundary,
      delay: async () => {
        if (!delivered) {
          await deliverAndAuthorize(h, { fireDuringLeaseObserve: { on: 2, fire: () => h.fire('SIGUSR2') } });
          delivered = true;
        }
      },
    });
    const line = result.lines.join('|');
    expect(result.ok).toBe(false);
    expect(line).toContain('INCIDENT_KILL_ENGAGED');
    expect(line).not.toContain('DISABLED_CLEAN');
  });

  it('a Socket disconnect failure during a clean stop is reported truthfully — never a synthesized clean state', async () => {
    // The pre-fix cleanup swallows a disconnect failure and hard-codes STATE: DISABLED_CLEAN / STOPPED_CLEAN. The fix
    // records the DISCONNECT ambiguity and refuses to claim a proven clean release.
    const h = await makeLiveOwnerHarness({ socketFactory: () => new DisconnectFailingSocket() });
    let ticks = 0;
    const result = await runForegroundOwner({
      ...h.boundary,
      delay: () => {
        ticks += 1;
        if (ticks === 2) h.fire('SIGTERM');
        return Promise.resolve();
      },
    });
    const line = result.lines.join('|');
    expect(result.ok).toBe(false);
    expect(line).not.toContain('STOPPED_CLEAN');
    expect(line).toContain('CLEANUP_AMBIGUOUS');
    expect(line).toContain('DISCONNECT');
  });

  it('a writer-lock RELEASE failure during a clean stop is reported truthfully — never a synthesized clean state', async () => {
    // The single private writer lock disappears before cleanup; release() fails closed. The pre-fix cleanup would still
    // report a clean release. The fix records the RELEASE ambiguity (lockReleased: false) and never claims clean.
    const h = await makeLiveOwnerHarness();
    let ticks = 0;
    const result = await runForegroundOwner({
      ...h.boundary,
      delay: async () => {
        ticks += 1;
        if (ticks === 1) {
          await unlink(path.join(h.stateRoot, 'locks', 'writer.lock'));
          h.fire('SIGTERM');
        }
      },
    });
    const line = result.lines.join('|');
    expect(result.ok).toBe(false);
    expect(line).not.toContain('STOPPED_CLEAN');
    expect(line).toContain('CLEANUP_AMBIGUOUS');
    expect(line).toContain('RELEASE');
  });

  it('a Socket disconnect failure during an incident kill is reported truthfully — never a clean incident claim', async () => {
    // The durable kill engages, but the Socket disconnect is ambiguous. The fix surfaces the DISCONNECT ambiguity
    // rather than reporting a bare clean INCIDENT_KILL_ENGAGED.
    const h = await makeLiveOwnerHarness({ socketFactory: () => new DisconnectFailingSocket() });
    let ticks = 0;
    const result = await runForegroundOwner({
      ...h.boundary,
      delay: () => {
        ticks += 1;
        if (ticks === 2) h.fire('SIGUSR2');
        return Promise.resolve();
      },
    });
    const line = result.lines.join('|');
    expect(result.ok).toBe(false);
    expect(line).toContain('CLEANUP_AMBIGUOUS');
    expect(line).toContain('DISCONNECT');
  });
});

describe('AS1 Patch 4 — F01 per-await/internal-port guards + truthful state (adversarial, fails on cb6085b)', () => {
  it('an incident DURING startup Web identity proof (authTest) begins ZERO subsequent Web call (guarded verifier ports)', async () => {
    // Concern (review 76 F01 #1): a SIGUSR2 during the verifier's assertAccepted/authTest is otherwise followed by
    // botsInfo/connect. The Patch 4 owner wraps the SUPPLIED verifier ports; an incident during authTest must prevent
    // the NEXT identity call. On cb6085b the ports are unguarded and botsInfo runs.
    let botsInfoCalls = 0;
    const h = await makeLiveOwnerHarness({
      buildDepOverrides: ({ fireIncident, world }) => ({
        web: {
          authTest: async (token) => {
            const authResult = await world.web.authTest(token);
            fireIncident(); // the incident closes admission between authTest and the next Web identity call
            return authResult;
          },
          botsInfo: (token, botId) => {
            botsInfoCalls += 1;
            return world.web.botsInfo(token, botId);
          },
          postMessage: (token, request) => world.web.postMessage(token, request),
        },
      }),
    });
    const result = await runForegroundOwner(h.boundary);
    const line = result.lines.join('|');
    expect(result.ok).toBe(false);
    expect(line).toContain('INCIDENT_KILL_ENGAGED');
    expect(botsInfoCalls).toBe(0);
  });

  it('an incident DURING the delivery transport (delivery provenance) begins ZERO tmux paste (guarded transport ports)', async () => {
    // Concern (review 76 F01 #2): a SIGUSR2 inside deliver() must not be followed by the pinned-byte tmux paste. The
    // Patch 4 owner wraps every transport port; on cb6085b the ports are unguarded and the paste happens.
    let delivered = false;
    const h = await makeLiveOwnerHarness({
      buildDepOverrides: ({ fireIncident }) => ({
        buildDeliveryProvenance: () => ({
          assertAccepted: () => {
            fireIncident(); // the incident closes admission inside transport.deliver, before the tmux paste
            return Promise.resolve();
          },
        }),
      }),
    });
    const result = await runForegroundOwner({
      ...h.boundary,
      delay: async () => {
        if (!delivered) {
          await deliverAndAuthorize(h);
          delivered = true;
        }
      },
    });
    const line = result.lines.join('|');
    expect(result.ok).toBe(false);
    expect(line).toContain('INCIDENT_KILL_ENGAGED');
    expect(h.tmux.pasteCalls).toBe(0);
  });

  it('observeReceiveGrantOnce() with admission CLOSED begins NO durable divergence latch (guarded observe + latch)', async () => {
    // Concern (Advisor F01): observeReceiveGrantOnce() must not run its Git observe and then a durable divergence
    // latchProfile after a SIGUSR2 closed admission. With the guard, the observe never begins and NO latch is written.
    const { composition, gitSource, stateRoot } = await startAgentOfficeComposition();
    try {
      await composition.start();
      composition.closeIncidentGateNow(); // an incident closed admission
      gitSource.divergePaths.add(RECEIVE_GRANT_REF); // the next re-observe WOULD diverge and durably latch the profile
      await expect(composition.observeReceiveGrantOnce()).rejects.toThrow();
      // No profile-latch was written: the guarded observe threw before the divergence latch.
      const latchRaw = await readFile(path.join(stateRoot, 'indexes/as1-slack-pilot/profiles/agent-office-advisor/failure-latch.json'), 'utf8');
      expect((JSON.parse(latchRaw) as { readonly latched: boolean }).latched).toBe(false);
    } finally {
      await composition.incidentKill().catch(() => undefined);
    }
  });

  it('a clean stop() with a pending incident engages the durable kill — never a synthesized DISABLED_CLEAN (incident-aware drain)', async () => {
    // Concern (review 76 F01 #3 + Advisor): finishCleanup's drain must consult the incident gate. On cb6085b the drain
    // is not incident-aware and writes DISABLED_CLEAN.
    const { composition } = await startAgentOfficeComposition();
    try {
      await composition.start();
      composition.closeIncidentGateNow(); // an incident closed admission before the clean drain
      const result = await composition.stop();
      expect(result.incidentDominated).toBe(true);
      expect(result.state).not.toBe('DISABLED_CLEAN');
      expect(result.state).toBe('DISABLED_LATCHED');
      expect(result.killEngaged).toBe(true);
    } finally {
      await composition.incidentKill().catch(() => undefined);
    }
  });

  it('a missing handler releases the lock and reports the ACTUAL disabled state — never a synthesized DISABLED_LATCHED', async () => {
    // Concern (review 76 F01 #4 + Advisor truthful-state): the missing-handler path returns a truthful result INSIDE
    // the owner-result boundary and reports the real state (a clean release is DISABLED_CLEAN), not a synthesized
    // DISABLED_LATCHED, and never discards a release failure. On cb6085b this path throws a raw error.
    const h = await makeLiveOwnerHarness();
    const result = await runForegroundOwner({ ...h.boundary, installSignalHandlers: () => ['SIGINT', 'SIGTERM'] });
    const line = result.lines.join('|');
    expect(result.ok).toBe(false);
    expect(line).toContain('MISSING_HANDLER_DISABLED');
    expect(line).toContain('DISABLED_CLEAN');
    expect(line).not.toContain('DISABLED_LATCHED');
  });

  it('an incident during ERROR cleanup (latchActiveProfileAndStop) dominates — durable kill, never DISABLED_CLEAN', async () => {
    // Concern (review 76 F01 + Advisor): the owner-loop error cleanup must dominate a pending incident. On cb6085b the
    // drain is not incident-aware and can write DISABLED_CLEAN.
    const { composition } = await startAgentOfficeComposition();
    await composition.start();
    composition.closeIncidentGateNow(); // a SIGUSR2 closed admission during the error cleanup
    const result = await composition.latchActiveProfileAndStop('OWNER_LOOP_ERROR');
    expect(result.incidentDominated).toBe(true);
    expect(result.state).toBe('DISABLED_LATCHED');
    expect(result.state).not.toBe('DISABLED_CLEAN');
    expect(result.killEngaged).toBe(true);
  });

  it('a NONEMPTY pre-cleanup ambiguity (disconnect failure) never drains to DISABLED_CLEAN — the durable kill is engaged', async () => {
    // Concern (review 76 F01 + brief 77 + Advisor): a nonempty pre-ambiguity in the error cleanup (here a failed Socket
    // disconnect, collected into the same `pre` array as a profile-latch/fallback-kill failure) must NOT drain to a
    // clean DISABLED_CLEAN. The durable global kill is engaged instead; the ambiguity stays visible and DISABLED_LATCHED
    // is claimed only because the kill persisted. On cb6085b the drain still reaches DISABLED_CLEAN.
    const h = await makeLiveOwnerHarness({ socketFactory: () => new DisconnectFailingSocket() });
    h.gitSource.throwOnReObservePaths.add(RECEIVE_GRANT_REF); // the loop re-observe throws → owner-loop ERROR cleanup
    const result = await runForegroundOwner(h.boundary);
    const line = result.lines.join('|');
    expect(result.ok).toBe(false);
    expect(line).toContain('OWNER_HALTED');
    expect(line).toContain('DISCONNECT'); // the cleanup ambiguity stays visible in the stable outcome
    expect(line).not.toContain('DISABLED_CLEAN'); // a nonempty pre-ambiguity engaged the durable kill, not a clean drain
    expect(line).toContain('DISABLED_LATCHED'); // proven only because the durable global kill persisted
  });

  it('a FALLBACK global-kill PERSISTENCE failure reports FALLBACK_KILL + KILL_NOT_ENGAGED and the ACTUAL non-latched state', async () => {
    // Concern (review 76 F01 + brief 77 + Advisor): with a nonempty pre-ambiguity (disconnect) AND the durable
    // global-control write forced to fail, the TRANSACTIONAL engageGlobalKill leaves the in-memory record UNLATCHED.
    // The result must show FALLBACK_KILL + KILL_NOT_ENGAGED and the ACTUAL live state — never a synthesized
    // DISABLED_CLEAN nor an UNPROVED DISABLED_LATCHED.
    const { composition, stateRoot } = await startAgentOfficeComposition({ socket: new DisconnectFailingSocket() });
    await composition.start();
    // Make the global-control directory unwritable so the durable global-kill atomic write cannot create its temp file.
    const controlDir = path.join(stateRoot, 'indexes/as1-slack-pilot');
    await chmod(controlDir, 0o500);
    try {
      const result = await composition.latchActiveProfileAndStop('OWNER_LOOP_ERROR');
      expect(result.detail).toContain('DISCONNECT');
      expect(result.detail).toContain('FALLBACK_KILL');
      expect(result.detail).toContain('KILL_NOT_ENGAGED');
      expect(result.state).not.toBe('DISABLED_CLEAN');
      expect(result.state).not.toBe('DISABLED_LATCHED'); // NOT claimed — the durable kill did not persist
      expect(result.killEngaged).toBe(false);
      expect(result.cleanupProven).toBe(false);
    } finally {
      await chmod(controlDir, 0o700); // restore so the temp state root can be cleaned up
    }
  });

  it('F01-B: a FREED namespace lock (already unlinked) cedes authority with NO old-owner fallback kill — RELEASE ambiguity, never a stale latch', async () => {
    // Concern (review 79 F01-B): if the namespace lock is gone, the old control must NOT perform an authority-bearing
    // fallback kill (a second writer could hold the freed lock). The release is LOST (ownership not proven), so cleanup
    // surfaces the RELEASE ambiguity truthfully but engages NO durable kill — the state stays the clean-drain state.
    const { composition, stateRoot } = await startAgentOfficeComposition();
    await composition.start();
    await unlink(path.join(stateRoot, 'locks', 'writer.lock')); // the fixed leaf is gone → ownership not positively proven
    const result = await composition.stop();
    expect(result.lockReleased).toBe(false);
    expect(result.detail).toContain('RELEASE');
    expect(result.detail).toContain('LOST'); // authority not proven → LOST, never RETAINED
    expect(result.state).toBe('DISABLED_CLEAN'); // the clean drain stands; NO stale fallback latch
    expect(result.state).not.toBe('DISABLED_LATCHED');
    expect(result.killEngaged).toBe(false); // the old owner performed ZERO authority-bearing fallback mutation
    expect(result.cleanupProven).toBe(false);
  });

  it('F01-B: a PRE-unlink release failure (leaf still positively this owner) RETAINS authority and durably fallback-kills', async () => {
    // Concern (review 79 F01-B): a release failure BEFORE the namespace unlink, while the fixed leaf is still positively
    // this owner's lock, may retain authority and durably fallback-kill (the sole writer). The locks directory is made
    // unwritable so `unlink` fails EACCES while identity still proves this owner's lock.
    const { composition, stateRoot } = await startAgentOfficeComposition();
    await composition.start();
    const locksDir = path.join(stateRoot, 'locks');
    await chmod(locksDir, 0o500); // read+execute (identity reopen still works) but no write → unlink fails pre-unlink
    try {
      const result = await composition.stop();
      expect(result.lockReleased).toBe(false);
      expect(result.detail).toContain('RELEASE');
      expect(result.detail).toContain('RETAINED'); // still positively this owner's lock → authority RETAINED
      expect(result.state).toBe('DISABLED_LATCHED'); // the sole writer durably fallback-killed
      expect(result.state).not.toBe('DISABLED_CLEAN');
      expect(result.killEngaged).toBe(true);
      expect(result.cleanupProven).toBe(false);
    } finally {
      await chmod(locksDir, 0o700); // restore so the temp state root can be cleaned up
      // The RETAINED path intentionally keeps the lock's descriptor open (a live owner holds it for the process
      // lifetime). Now that unlink can succeed, close it DETERMINISTICALLY so no FileHandle is left for GC (brief §6).
      await composition.close().catch(() => undefined);
    }
  });

  it('an incident INSIDE evidence ingress (supplied verifier) begins ZERO evidence-store persistence and ZERO outbound', async () => {
    // Concern (review 76 F01 + brief 77 + Advisor): an incident inside As1EvidenceIngress internals must prevent the
    // NEXT store/Web side effect. A VALID ACK — built from the ACTUAL production `buildEvidenceAuthority` over the
    // durable delivery records (no reinvented logic) — reaches the supplied verifier, which closes admission DURING
    // provenance verification; the guarded ingress/outbox ports (the SAME incidentGuardedPort wrappers proven for the
    // transport) then begin no store persistence and no outbound. On cb6085b those ports are unguarded.
    const gateCloser: { close: () => void } = { close: () => undefined };
    let verifyCalls = 0;
    const baseVerifier = new FakeGitVerifier();
    const firingVerifier: As1GitProvenanceVerifier = {
      verify: (ref, snapshotCommits) => {
        verifyCalls += 1;
        gateCloser.close(); // an incident closes admission DURING the ACK provenance verification
        return baseVerifier.verify(ref, snapshotCommits); // ...then return valid provenance
      },
    };
    const { stateRoot, composition, gitSource, socket, receiveGrant, web } = await startAgentOfficeComposition({ evidenceVerifier: firingVerifier });
    gateCloser.close = () => composition.closeIncidentGateNow();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope());
      const intakeId = composition.lastIntake();
      if (intakeId === null) throw new Error('expected an intake');
      const advisorProfile = selectProfile('AGENT_OFFICE_ADVISOR');
      const store = await As1ProfileInboundStore.open(stateRoot, advisorProfile, new FakeClock(CLOCK_ISO));
      const { grant, lease } = await buildDeliveryAuthority(stateRoot, store, parseReceiveGrant(receiveGrant), advisorProfile, intakeId);
      const base = `${AUTH_ROOT}/runtime-authority/agent-office-advisor/${intakeId}`;
      gitSource.set(`${base}/pointer-delivery-grant.json`, grant);
      gitSource.set(`${base}/readiness-lease.json`, lease);
      expect((await composition.deliverPending()).outcome).toBe('DELIVERED');
      // Reuse the PRODUCTION evidence-authority derivation over the durable records to construct a VALID ACK.
      const deliveryGrant = parsePointerDeliveryGrant(grant);
      const { deliveryId } = parseContainedPointerRef(deliveryGrant);
      const parsedReceiveGrant = parseReceiveGrant(receiveGrant);
      const receiveGrantState = await store.readReceiveGrantState(parsedReceiveGrant.receiveGrantId);
      const terminalDelivery = await store.readTmuxDeliveryRecord(deliveryId);
      const rootCorrelation = await store.findRootByIntakeId(intakeId);
      const consumption = await store.readDeliveryAuthorityConsumption(deliveryGrant.pointerDeliveryGrantId);
      if (receiveGrantState === null || terminalDelivery === null || rootCorrelation === null || consumption === null) {
        throw new Error('expected all durable evidence-input records after DELIVERED');
      }
      const authority = buildEvidenceAuthority({ receiveGrant: parsedReceiveGrant, receiveGrantState, pointerDeliveryGrant: deliveryGrant, terminalDelivery, rootCorrelation, consumption });
      const ack = validAdvisorAck({ intakeId: authority.intakeId, sourceEventId: authority.sourceEventId, pointerHash: authority.pointerHash, ...authority.acceptedAck });
      gitSource.set(`${authority.evidencePrefix}/${intakeId}/ack.json`, ack);
      // The accepted-root delivery already sent the R2 ACCEPTED status; the incident-affected evidence ingest must add
      // ZERO further Web posts (no DELIVERY_CONFIRMED, no INTAKE/RESULT projection).
      const postsBeforeEvidence = web.posted.length;
      await expect(composition.ingestEvidenceAndProject()).rejects.toThrow();
      expect(verifyCalls).toBeGreaterThanOrEqual(1); // the ingress DID reach the supplied verifier (accepted-evidence path)
      expect(await store.readAcceptedEvidence()).toHaveLength(0); // ZERO evidence-store persistence after the incident
      expect(web.posted).toHaveLength(postsBeforeEvidence); // ZERO NEW Web postMessage / outbound projection from the incident
    } finally {
      await composition.incidentKill().catch(() => undefined);
    }
  });
});

describe('AS1 Patch 5 — F01-A live inbound-callback guards (adversarial, fails on 3165e747)', () => {
  it('an incident during the live inbound Slack ACK begins ZERO subsequent durable side effect (no transport ACK / materialization)', async () => {
    const { composition, socket, stateRoot } = await startAgentOfficeComposition();
    try {
      await composition.start();
      let ackCalls = 0;
      const envelope: As1InboundEnvelope = {
        ...slackEnvelope(),
        acknowledge: () => {
          ackCalls += 1;
          composition.closeIncidentGateNow(); // a SIGUSR2 closes admission WHILE the live Slack ACK is in flight
          return Promise.resolve();
        },
      };
      await expect(socket.deliver(envelope)).rejects.toThrow(); // the guarded ACK's post-check rejects the callback
      expect(ackCalls).toBe(1); // the ACK ran, then the incident dominated the guarded continuation
      expect(composition.lastIntake()).toBeNull(); // the callback never completed → nothing recorded as processed
      // The durable transport record was NOT ACK-recorded/materialized after the incident (post-ACK ops prevented).
      const store = await As1ProfileInboundStore.open(stateRoot, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock(CLOCK_ISO));
      const transport = await store.readTransport('Ev0AGENTOFFICE01');
      expect(transport).not.toBeNull();
      if (transport === null) throw new Error('expected a durable transport record');
      expect(transport.state).not.toBe('TRANSPORT_ACK_RECORDED');
      expect(transport.state).not.toBe('MATERIALIZED');
      // The callback performed NO durable kill itself — the incident only closed admission. The owner routes the
      // pending incident EXACTLY ONCE through the existing durable kill (single DISABLED_LATCHED).
      expect(composition.status().incidentGateOpen).toBe(false);
      expect(composition.status().killEngaged).toBe(false);
      const cleanup = await composition.incidentKill();
      expect(cleanup.state).toBe('DISABLED_LATCHED');
      expect(cleanup.killEngaged).toBe(true);
      await expect(composition.incidentKill()).rejects.toThrow(); // the durable incident path is entered exactly once
    } finally {
      await composition.incidentKill().catch(() => undefined);
    }
  });

  // Decorate the internally-opened inbound store so a chosen store op fires the incident AFTER it completes (mid
  // processEnvelope); the incident-guarded store's post-check must then reject the NEXT durable side effect.
  function firingInboundStoreDecorator(methodName: keyof As1ProfileInboundStore, fire: () => void): (store: As1ProfileInboundStore) => As1ProfileInboundStore {
    return (store) =>
      new Proxy(store, {
        get: (target, property, receiver): unknown => {
          const value: unknown = Reflect.get(target, property, receiver);
          if (typeof value !== 'function') return value;
          const bound = (value as (...callArgs: readonly unknown[]) => unknown).bind(target);
          if (property === methodName) {
            return async (...callArgs: readonly unknown[]): Promise<unknown> => {
              const result = await bound(...callArgs); // the real inbound store op completes (its own effect)...
              fire(); // ...then a SIGUSR2 closes admission mid-callback; the guarded store rejects the next op
              return result;
            };
          }
          return bound;
        },
      });
  }

  // Decorate the store so a chosen op THROWS a plain (non-quarantine) error on its first call, leaving the durable
  // record exactly at its prior state WITHOUT closing admission — used to seed a recoverable PREACK_PENDING record.
  function throwingInboundStoreDecorator(methodName: keyof As1ProfileInboundStore): (store: As1ProfileInboundStore) => As1ProfileInboundStore {
    return (store) =>
      new Proxy(store, {
        get: (target, property, receiver): unknown => {
          const value: unknown = Reflect.get(target, property, receiver);
          if (typeof value !== 'function') return value;
          if (property === methodName) {
            return (): Promise<never> => Promise.reject(new Error(`seed: ${methodName} interrupted before its durable decision`));
          }
          return (value as (...callArgs: readonly unknown[]) => unknown).bind(target);
        },
      });
  }

  async function runInboundStageIncident(
    methodName: keyof As1ProfileInboundStore,
    assertNoNextDurableEffect: (transport: Awaited<ReturnType<As1ProfileInboundStore['readTransport']>>) => void,
  ): Promise<void> {
    const gateCloser: { close: () => void } = { close: () => undefined };
    const { composition, socket, stateRoot } = await startAgentOfficeComposition({
      decorateInboundStore: firingInboundStoreDecorator(methodName, () => gateCloser.close()),
    });
    gateCloser.close = () => composition.closeIncidentGateNow();
    try {
      await composition.start();
      await expect(socket.deliver(slackEnvelope())).rejects.toThrow(); // the guarded store's POST-op guard rejects the next op
      // The stage's own op completed, but the F01-A guard began NO next durable side effect and recorded no intake.
      expect(composition.lastIntake()).toBeNull();
      const store = await As1ProfileInboundStore.open(stateRoot, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock(CLOCK_ISO));
      assertNoNextDurableEffect(await store.readTransport('Ev0AGENTOFFICE01'));
      // The inbound callback performed NO durable kill itself — the incident only closed admission (in-memory). The
      // owner then routes the pending incident EXACTLY ONCE through the existing durable kill (single DISABLED_LATCHED).
      expect(composition.status().incidentGateOpen).toBe(false);
      expect(composition.status().killEngaged).toBe(false);
      const cleanup = await composition.incidentKill();
      expect(cleanup.state).toBe('DISABLED_LATCHED');
      expect(cleanup.killEngaged).toBe(true);
      await expect(composition.incidentKill()).rejects.toThrow(); // the durable incident path is entered exactly once
    } finally {
      await composition.incidentKill().catch(() => undefined);
    }
  }

  it('an incident during inbound RECEIPT persistence begins NO next durable side effect (openTransport never begins)', async () => {
    // The guard rejects immediately AFTER persistReceipt, before recordDedupe/openTransport: no transport record is
    // ever created. Adversarial vs 3165e747 / an unguarded store, where openTransport runs and leaves a PREACK_PENDING
    // record before the service's own next gate check stops the ACK.
    await runInboundStageIncident('persistReceipt', (transport) => {
      expect(transport).toBeNull();
    });
  });

  it('an incident during the DEDUPE/OPEN transition begins NO next durable side effect (openTransport never begins)', async () => {
    // insertDedupe runs after the receipt and before openTransport; the guard rejects immediately AFTER it, so
    // openTransport never begins. Adversarial vs an unguarded store, where openTransport runs (leaving PREACK_PENDING).
    await runInboundStageIncident('insertDedupe', (transport) => {
      expect(transport).toBeNull();
    });
  });

  it('an incident during the inbound root BIND begins NO next durable side effect (pre-ACK decision never commits)', async () => {
    // openTransport precedes the bind, so a PREACK_PENDING record already exists; the guard rejects immediately AFTER
    // bindFirstRoot, before commitPreAckDecision, so the record NEVER advances to PREACK_ROOT_BOUND. Adversarial vs
    // 3165e747 / an unguarded store, where commitPreAckDecision runs and leaves PREACK_ROOT_BOUND before the ACK gate.
    await runInboundStageIncident('bindFirstRoot', (transport) => {
      expect(transport?.state ?? 'ABSENT').toBe('PREACK_PENDING');
    });
  });

  it('an incident during result MATERIALIZATION begins NO next durable side effect (intake never materializes)', async () => {
    // The transport is already TRANSPORT_ACK_RECORDED and the ACK sent; the guard rejects immediately AFTER the
    // materialize intake-artifact write, before persistPointerArtifact/commitMaterialized, so the record NEVER reaches
    // MATERIALIZED and no intake id is recorded. Adversarial vs an unguarded store, where materialization completes.
    await runInboundStageIncident('persistIntakeArtifact', (transport) => {
      expect(transport?.state ?? 'ABSENT').toBe('TRANSPORT_ACK_RECORDED');
    });
  });

  it('an incident during PRE-ACK RECOVERY begins NO next durable side effect and routes exactly once to the durable kill', async () => {
    // Seed a durable PREACK_PENDING record WITHOUT an incident: a first owner opens the transport, then bindFirstRoot is
    // interrupted before the pre-ACK decision commits. A clean stop releases the lock and leaves the record recoverable.
    const seed = await startAgentOfficeComposition({ decorateInboundStore: throwingInboundStoreDecorator('bindFirstRoot') });
    await seed.composition.start();
    await expect(seed.socket.deliver(slackEnvelope())).rejects.toThrow();
    const seedStore = await As1ProfileInboundStore.open(seed.stateRoot, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock(CLOCK_ISO));
    expect((await seedStore.readTransport('Ev0AGENTOFFICE01'))?.state ?? 'ABSENT').toBe('PREACK_PENDING');
    const seedStop = await seed.composition.stop();
    expect(seedStop.state).toBe('DISABLED_CLEAN'); // a clean release; the recoverable record survives untouched

    // A second owner recovers that record at startup; the incident fires mid-bind INSIDE recoverPreAckDecision.
    const gateCloser: { close: () => void } = { close: () => undefined };
    const recover = await startAgentOfficeComposition({
      stateRoot: seed.stateRoot,
      decorateInboundStore: firingInboundStoreDecorator('bindFirstRoot', () => gateCloser.close()),
    });
    gateCloser.close = () => recover.composition.closeIncidentGateNow();
    try {
      await expect(recover.composition.start()).rejects.toThrow(); // recovery bind fires the incident; the guard rejects
      expect(recover.composition.lastIntake()).toBeNull();
      // Recovery began NO next durable side effect: the record NEVER advanced past PREACK_PENDING (no commitPreAckDecision).
      const store = await As1ProfileInboundStore.open(seed.stateRoot, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock(CLOCK_ISO));
      expect((await store.readTransport('Ev0AGENTOFFICE01'))?.state ?? 'ABSENT').toBe('PREACK_PENDING');
      // The startup revert routed the incident EXACTLY ONCE through the durable kill (idempotent global latch).
      expect(await readControlState(seed.stateRoot)).toBe('DISABLED_LATCHED');
    } finally {
      await recover.composition.incidentKill().catch(() => undefined);
    }
  });
});

// R2 recovery §5 same-thread user status: ACCEPTED on a NEW_MISSION_ROOT, DELIVERY_CONFIRMED on an accepted Advisor
// ACK with the legacy English progress ACK suppressed, and the durable failure barrier that halts the owner on restart.
const STATUS_ACCEPTED = '요청 접수 완료 · Advisor에게 전달 중';
const STATUS_DELIVERY_CONFIRMED = '메시지 전달 완료 · 답변 대기 중';

describe('AS1 R2 recovery — same-thread user status (design §5)', () => {
  it('posts ACCEPTED (Korean) on a NEW_MISSION_ROOT and exposes the intake only after it is recorded', async () => {
    const { composition, socket, web } = await startAgentOfficeComposition();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope());
      expect(composition.lastIntake()).not.toBeNull();
      expect(web.posted.map((p) => p.request.text)).toContain(STATUS_ACCEPTED);
      expect(web.posted.some((p) => p.request.text.startsWith('ACK:'))).toBe(false); // no English progress ACK
    } finally {
      await composition.stop();
    }
  });

  it('an exact duplicate delivery re-derives the same ACCEPTED id and posts no second status', async () => {
    const { composition, socket, web } = await startAgentOfficeComposition();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope());
      await socket.deliver(slackEnvelope()); // exact retry of the same envelope/event → DUPLICATE, not NEW_MISSION_ROOT
      expect(web.posted.filter((p) => p.request.text === STATUS_ACCEPTED)).toHaveLength(1);
    } finally {
      await composition.stop();
    }
  });

  it('posts DELIVERY_CONFIRMED on an accepted Advisor ACK and SUPPRESSES the legacy English INTAKE ACK', async () => {
    const { stateRoot, composition, socket, gitSource, receiveGrant, web } = await startAgentOfficeComposition();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope());
      const intakeId = composition.lastIntake();
      if (intakeId === null) throw new Error('expected an intake');
      const advisorProfile = selectProfile('AGENT_OFFICE_ADVISOR');
      const store = await As1ProfileInboundStore.open(stateRoot, advisorProfile, new FakeClock(CLOCK_ISO));
      const { grant, lease } = await buildDeliveryAuthority(stateRoot, store, parseReceiveGrant(receiveGrant), advisorProfile, intakeId);
      const base = `${AUTH_ROOT}/runtime-authority/agent-office-advisor/${intakeId}`;
      gitSource.set(`${base}/pointer-delivery-grant.json`, grant);
      gitSource.set(`${base}/readiness-lease.json`, lease);
      expect((await composition.deliverPending()).outcome).toBe('DELIVERED');
      // Build and publish a VALID Advisor ACK so ACK ingestion ACCEPTS and triggers DELIVERY_CONFIRMED.
      const deliveryGrant = parsePointerDeliveryGrant(grant);
      const { deliveryId } = parseContainedPointerRef(deliveryGrant);
      const parsedReceiveGrant = parseReceiveGrant(receiveGrant);
      const receiveGrantState = await store.readReceiveGrantState(parsedReceiveGrant.receiveGrantId);
      const terminalDelivery = await store.readTmuxDeliveryRecord(deliveryId);
      const rootCorrelation = await store.findRootByIntakeId(intakeId);
      const consumption = await store.readDeliveryAuthorityConsumption(deliveryGrant.pointerDeliveryGrantId);
      if (receiveGrantState === null || terminalDelivery === null || rootCorrelation === null || consumption === null) throw new Error('expected durable records');
      const authority = buildEvidenceAuthority({ receiveGrant: parsedReceiveGrant, receiveGrantState, pointerDeliveryGrant: deliveryGrant, terminalDelivery, rootCorrelation, consumption });
      const ack = validAdvisorAck({ intakeId: authority.intakeId, sourceEventId: authority.sourceEventId, pointerHash: authority.pointerHash, ...authority.acceptedAck });
      gitSource.set(`${authority.evidencePrefix}/${intakeId}/ack.json`, ack);
      const outcomes = await composition.ingestEvidenceAndProject();
      expect(outcomes).toContain('DELIVERY_CONFIRMED:DELIVERED');
      expect(web.posted.map((p) => p.request.text)).toContain(STATUS_DELIVERY_CONFIRMED);
      expect(web.posted.some((p) => p.request.text.startsWith('ACK:'))).toBe(false); // INTAKE English ACK suppressed
    } finally {
      await composition.stop();
    }
  });

  it('a durable DELIVERY_FAILED record is a cross-restart barrier: the owner withholds the intake and refuses delivery', async () => {
    const first = await startAgentOfficeComposition();
    let intakeId: string;
    try {
      await first.composition.start();
      await first.socket.deliver(slackEnvelope());
      const id = first.composition.lastIntake();
      if (id === null) throw new Error('expected an intake');
      intakeId = id;
      const store = await As1ProfileInboundStore.open(first.stateRoot, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock(CLOCK_ISO));
      await store.recordOutboxPhase(userStatusOutboundId('AGENT_OFFICE_ADVISOR', intakeId, 'DELIVERY_FAILED'), 'PREPARED', { requestHash: `sha256:${'3'.repeat(64)}` });
    } finally {
      await first.composition.stop();
    }
    const second = await startAgentOfficeComposition({ stateRoot: first.stateRoot });
    try {
      await second.composition.start();
      expect(second.composition.hasFailureBarrier()).toBe(true);
      expect(second.composition.lastIntake()).toBeNull(); // withheld from delivery
      expect((await second.composition.deliverPending()).phase).toBe('AWAITING'); // refused — no authority/tmux
      expect(second.tmuxPort.pasteCalls).toBe(0);
    } finally {
      await second.composition.incidentKill().catch(() => undefined);
    }
  });

  it('restart after ACCEPTED is RESPONSE_RECORDED recovers the SAME intake and makes NO second Web post', async () => {
    const first = await startAgentOfficeComposition();
    try {
      await first.composition.start();
      await first.socket.deliver(slackEnvelope());
      expect(first.composition.lastIntake()).not.toBeNull();
      expect(first.web.posted).toHaveLength(1); // the one ACCEPTED post
    } finally {
      await first.composition.stop();
    }
    const second = await startAgentOfficeComposition({ stateRoot: first.stateRoot });
    try {
      await second.composition.start();
      expect(second.composition.lastIntake()).not.toBeNull(); // §5.7: the durable ACCEPTED is re-derived, intake recovered
      expect(second.web.posted).toHaveLength(0); // NO duplicate Slack post on the fresh Web port
      expect(second.composition.hasFailureBarrier()).toBe(false);
    } finally {
      await second.composition.stop();
    }
  });
});
