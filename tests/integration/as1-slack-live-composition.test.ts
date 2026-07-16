import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
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
import { parseReceiveGrant, type As1PilotReceiveGrantV1 } from '../../src/application/slack-pilot/contracts.js';
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

async function startAgentOfficeComposition() {
  const stateRoot = await makeStateRoot();
  const world = fakeWireWorld();
  const { filePath } = await writeSecretFile(secretText(validSecretValues()));
  const descriptor = parseRuntimeDescriptor({
    schemaVersion: 'agent-office.as1-slack-pilot-descriptor.v1',
    enabled: true,
    receiveGrantRef: RECEIVE_GRANT_REF,
    secretFilePath: filePath,
  });
  const gitSource = new FakeGitSource();
  const socket = new FakeCompositionSocket();
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
      evidenceVerifier: new FakeGitVerifier(),
      missionAuthorityRoot: AUTH_ROOT,
    },
  });
  // The control records now exist: bind ALL THREE grant hashes (state-root + pre-transition control/latch) and set
  // the grant AFTER open but BEFORE start(), so the F02 pre-transition snapshot comparison accepts it.
  const receiveGrantHashes = await boundGrantHashes(stateRoot, 'agent-office-advisor');
  gitSource.set(RECEIVE_GRANT_REF, validReceiveGrant(receiveGrantHashes));
  return { stateRoot, composition, gitSource, socket, tmuxPort, clock, receiveGrantHashes };
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
    const { stateRoot, composition, socket, gitSource, tmuxPort, receiveGrantHashes } = await startAgentOfficeComposition();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope());
      const intakeId = composition.lastIntake();
      expect(intakeId).not.toBeNull();
      if (intakeId === null) throw new Error('expected an intake');

      const store = await As1ProfileInboundStore.open(stateRoot, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock(CLOCK_ISO));
      const { grant, lease } = await buildDeliveryAuthority(stateRoot, store, parseReceiveGrant(validReceiveGrant(receiveGrantHashes)), selectProfile('AGENT_OFFICE_ADVISOR'), intakeId);
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
    const { stateRoot, composition, socket, gitSource, receiveGrantHashes } = await startAgentOfficeComposition();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope());
      const intakeId = composition.lastIntake();
      if (intakeId === null) throw new Error('expected an intake');
      const store = await As1ProfileInboundStore.open(stateRoot, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock(CLOCK_ISO));
      const { grant, lease } = await buildDeliveryAuthority(stateRoot, store, parseReceiveGrant(validReceiveGrant(receiveGrantHashes)), selectProfile('AGENT_OFFICE_ADVISOR'), intakeId);
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

  it('fails closed if a required owner signal handler is absent', async () => {
    const { boundary } = await makeOwnerBoundary(new FakeClock(CLOCK_ISO));
    await expect(
      runForegroundOwner({ ...boundary, installSignalHandlers: () => ['SIGINT', 'SIGTERM'] }),
    ).rejects.toThrow(DomainError);
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
