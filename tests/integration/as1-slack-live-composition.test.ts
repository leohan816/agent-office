import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { hashCanonical, sha256Bytes } from '../../src/persistence/file-store/hashing.js';
import { As1ProfileInboundStore } from '../../src/application/slack-pilot/inbound-store.js';
import { selectProfile, type As1Profile } from '../../src/application/slack-pilot/profiles.js';
import { parseReceiveGrant, type As1PilotReceiveGrantV1 } from '../../src/application/slack-pilot/contracts.js';
import type { As1ReceiveGrantProvenanceGate } from '../../src/adapters/gateways/slack-pilot/exact-authority.js';
import type { As1TmuxObservationPort, As1DeliveryProvenanceGate } from '../../src/adapters/gateways/slack-pilot/exact-transport.js';
import { parseTmuxDestination, type As1TmuxDestination } from '../../src/adapters/gateways/slack-pilot/exact-authority.js';
import type { As1GitArtifactObserver, As1GitObservation } from '../../src/adapters/gateways/slack-pilot/git-artifact-source.js';
import type { As1InboundEnvelope, As1SocketConnectInput, As1SocketConnectResult } from '../../src/adapters/gateways/slack-pilot/socket-client.js';
import {
  As1GatewayComposition,
  parseRuntimeDescriptor,
  type As1CompositionSocketPort,
} from '../../src/runtime/as1-slack-pilot/composition.js';
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

/** A path-keyed read-only Git observer fake. */
class FakeGitSource implements As1GitArtifactObserver {
  private readonly byPath = new Map<string, Buffer>();
  public set(relativePath: string, value: unknown): void {
    this.byPath.set(relativePath, Buffer.from(JSON.stringify(value), 'utf8'));
  }
  public getRepositoryId(): string {
    return 'foundation-docs';
  }
  public observe(relativePath: string): Promise<As1GitObservation> {
    const bytes = this.byPath.get(relativePath);
    if (bytes === undefined) {
      return Promise.resolve({ status: 'NOT_READY', reason: 'ABSENT', firstAddCommit: null, blobSha256: null, bytes: null });
    }
    return Promise.resolve({ status: 'READY', reason: 'READY', firstAddCommit: 'a'.repeat(40), blobSha256: sha256Bytes(bytes), bytes });
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
  gitSource.set(RECEIVE_GRANT_REF, validReceiveGrant());
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
      receiveGrantProvenance: ACCEPTING_RECEIVE_GATE,
      deliveryProvenance: ACCEPTING_DELIVERY_GATE,
      evidenceVerifier: new FakeGitVerifier(),
      missionAuthorityRoot: AUTH_ROOT,
    },
  });
  return { stateRoot, composition, gitSource, socket, tmuxPort, clock };
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
    const { stateRoot, composition, socket, gitSource, tmuxPort } = await startAgentOfficeComposition();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope());
      const intakeId = composition.lastIntake();
      expect(intakeId).not.toBeNull();
      if (intakeId === null) throw new Error('expected an intake');

      const store = await As1ProfileInboundStore.open(stateRoot, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock(CLOCK_ISO));
      const { grant, lease } = await buildDeliveryAuthority(stateRoot, store, parseReceiveGrant(validReceiveGrant()), selectProfile('AGENT_OFFICE_ADVISOR'), intakeId);
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
    gitSource.set(RECEIVE_GRANT_REF, validReceiveGrant()); // grant names CAGENTOFFICE01, secret names CDIFFERENT0001
    const composition = await As1GatewayComposition.open(descriptor, {
      stateRoot,
      clock: new FakeClock(CLOCK_ISO),
      deps: {
        gitSource,
        web: world.web,
        tmuxPort: new FakeTmuxObservationPort(parseTmuxDestination(validDestination(), 'd')),
        buildSocket: () => new FakeCompositionSocket(),
        receiveGrantProvenance: ACCEPTING_RECEIVE_GATE,
        deliveryProvenance: ACCEPTING_DELIVERY_GATE,
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
        receiveGrantProvenance: ACCEPTING_RECEIVE_GATE,
        deliveryProvenance: ACCEPTING_DELIVERY_GATE,
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
