import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildAdvisorGatewayReceipt,
  canonicalAdvisorPointerEnvelope,
  type AdvisorGateway,
  type AdvisorGatewayHealth,
  type AdvisorGatewayReceipt,
  type AdvisorNotificationRequest,
} from '../../src/adapters/gateways/advisor.js';
import { ExactGitDecisionAuthorityEvidenceVerifier } from '../../src/adapters/observations/artifacts/decision-authority.js';
import {
  AdvisorEvidenceIngress,
  parseAdvisorAcknowledgementEvidence,
  parseAdvisorDecisionEvidence,
  parseAdvisorIntakeEvidence,
  parseAdvisorResumeEvidence,
} from '../../src/application/advisor-inbox/evidence-ingress.js';
import { AdvisorInboxService } from '../../src/application/advisor-inbox/service.js';
import { projectAdvisorInbox } from '../../src/application/advisor-inbox/projector.js';
import {
  ExactAdvisorAuthorityValidator,
  type ExactGitAuthorityReader,
  type ExactGitBlob,
  type ExactGitSnapshot,
  type ExactTmuxPreflightRecord,
} from '../../src/adapters/gateways/tmux-advisor/exact-authority.js';
import {
  assertAdvisorTransportCapabilityV2,
  parseAdvisorDeliveryReadinessLease,
  parseExactAdvisorDeliveryActivation,
  type ExactAdvisorDeliveryActivation,
} from '../../src/adapters/gateways/tmux-advisor/exact-config.js';
import {
  DurableExactAdvisorDeliveryPort,
  exactTmuxArgv,
  type ExactTmuxMutationRunner,
} from '../../src/adapters/gateways/tmux-advisor/exact-transport.js';
import type { SourceArtifactRef } from '../../src/contracts/types.js';
import { DurableDeliveryControl } from '../../src/operations/readiness/delivery-control.js';
import { ImmutableArtifactStore } from '../../src/persistence/file-store/artifact-store.js';
import { EventStore } from '../../src/persistence/file-store/event-store.js';
import { hashCanonical, sha256Bytes } from '../../src/persistence/file-store/hashing.js';
import { assertPrivateDeploymentConfiguration } from '../../src/server/config.js';
import { parseOperationalRuntimeConfiguration } from '../../src/runtime/operational-config.js';
import type { AgentOfficeRuntimeIdentity } from '../../src/runtime/identity.js';
import { MISSION_ID, makeStateRoot, uuidV7 } from '../helpers/fixtures.js';
import { operationalRuntimeConfiguration } from '../helpers/operational-runtime.js';

const roots: string[] = [];
const stores: EventStore[] = [];
const NOW = '2026-07-10T00:00:10.000Z';
const UPSTREAM = 'f'.repeat(40);

afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close().catch(() => undefined)));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('reviewed exact Advisor delivery bridge', () => {
  it('parses only closed v3/v2 two-key configuration and keeps legacy versions valid', async () => {
    const fixture = authorityFixture();
    expect(parseExactAdvisorDeliveryActivation(fixture.activation)).toEqual(fixture.activation);
    expect(() => parseExactAdvisorDeliveryActivation({
      ...fixture.activation,
      destination: { ...fixture.activation.destination, paneId: '%5' },
    })).toThrow(expect.objectContaining({ code: 'FORBIDDEN_TARGET' }));
    expect(() => parseExactAdvisorDeliveryActivation({
      ...fixture.activation,
      browserTarget: '%9',
    })).toThrow(expect.objectContaining({ code: 'UNKNOWN_FIELD' }));

    const legacy = await operationalRuntimeConfiguration();
    expect(parseOperationalRuntimeConfiguration(legacy).schemaVersion).toBe(
      'agent-office.operational-runtime.v1',
    );
    const legacyAlias = {
      ...legacy,
      tmuxSources: legacy.tmuxSources.map((source) => source.sourceId === 'siasiu-tmux'
        ? { ...source, sourceId: 'shashu-tmux', windowNameEscaped: 'shashu' }
        : source),
      actors: legacy.actors.map((actor) => actor.stationId === 'siasiu'
        ? {
            ...actor,
            roleInstanceId: 'shashu-role',
            stationId: 'shashu',
            actorRole: 'Shashu Worker',
            tmuxSourceId: 'shashu-tmux',
          }
        : actor),
    };
    const normalizedAlias = parseOperationalRuntimeConfiguration(legacyAlias);
    expect(normalizedAlias.actors.find((actor) => actor.stationId === 'siasiu')).toMatchObject({
      roleInstanceId: 'siasiu-role',
      actorRole: 'SIASIU Worker',
      tmuxSourceId: 'siasiu-tmux',
    });
    expect(JSON.stringify(normalizedAlias)).not.toMatch(/shashu/iu);
    expect(parseOperationalRuntimeConfiguration({
      ...legacy,
      schemaVersion: 'agent-office.operational-runtime.v2',
      gateway: { adapter: 'TMUX_ADVISOR', activation: fixture.activation },
    }).gateway.activation).toEqual(fixture.activation);
    expect(() => parseOperationalRuntimeConfiguration({
      ...legacy,
      schemaVersion: 'agent-office.operational-runtime.v2',
      gateway: { adapter: 'TMUX_ADVISOR', activation: fixture.activation, capability: {} },
    })).toThrow(expect.objectContaining({ code: 'UNKNOWN_FIELD' }));

    expect(() => assertPrivateDeploymentConfiguration({
      schemaVersion: 'agent-office.loopback-deployment.v3',
      networkMode: 'LOOPBACK_PRIVATE',
      bindAddresses: ['127.0.0.1'],
      port: 4317,
      allowedHosts: ['127.0.0.1:4317'],
      authProvider: 'LOCAL_BOOTSTRAP',
      mutationMode: 'ENABLED_LOCAL_BOOTSTRAP',
      bootstrapProofFile: '/tmp/agent-office-test-proof.json',
      deliveryMode: 'EXACT_ADVISOR_POINTER',
      deliveryActivationId: fixture.activation.activationId,
      cors: false,
      trustProxy: false,
      tls: false,
      hsts: false,
    })).not.toThrow();
  });

  it('rejects traversal and unknown fields in activation, lease, and in-memory capability schemas', () => {
    const fixture = authorityFixture();
    expect(() => parseExactAdvisorDeliveryActivation({
      ...fixture.activation,
      snapshotRefs: {
        ...fixture.activation.snapshotRefs,
        roleProtocol: {
          ...fixture.activation.snapshotRefs.roleProtocol,
          path: '../authority/ROLE_PROTOCOL.md',
        },
      },
    })).toThrow(expect.objectContaining({ code: 'INVALID_SCHEMA' }));

    const validated = {
      authoritySnapshotHash: `sha256:${'1'.repeat(64)}`,
      activationSnapshotHash: `sha256:${'2'.repeat(64)}`,
      registrySnapshotHash: `sha256:${'3'.repeat(64)}`,
    };
    const lease = readinessLease(validated);
    expect(() => parseAdvisorDeliveryReadinessLease({ ...lease, browserTarget: '%9' }))
      .toThrow(expect.objectContaining({ code: 'UNKNOWN_FIELD' }));
    for (const invalidLease of [
      { ...lease, issuerRole: 'Worker' },
      { ...lease, governedMissionId: 'OTHER_MISSION' },
      { ...lease, destination: { ...lease.destination, paneId: '%5' } },
      { ...lease, expiresAt: lease.issuedAt },
    ]) {
      expect(() => parseAdvisorDeliveryReadinessLease(invalidLease)).toThrow();
    }

    const capability = {
      schemaVersion: 'agent-office.advisor-transport-capability.v2',
      capabilityId: uuidV7(90),
      activationId: fixture.activation.activationId,
      logicalRoute: 'ADVISOR_ONLY',
      transport: 'TMUX',
      state: 'ACTIVE',
      killSwitch: 'DISENGAGED',
      synchronization: 'SINGLE_PREVALIDATED_DESTINATION',
      activationMissionId: 'AGENT_OFFICE_M01_EXACT_ADVISOR_DELIVERY_ACTIVATION',
      governedMissionId: MISSION_ID,
      notificationId: uuidV7(91),
      pointerEnvelopeHash: `sha256:${'4'.repeat(64)}`,
      destinationFingerprint: `sha256:${'5'.repeat(64)}`,
      readinessLeaseId: uuidV7(92),
      issuedAt: NOW,
      expiresAt: '2026-07-10T00:00:20.000Z',
      authoritySnapshotHash: validated.authoritySnapshotHash,
      activationSnapshotHash: validated.activationSnapshotHash,
      registrySnapshotHash: validated.registrySnapshotHash,
    } as const;
    expect(() => assertAdvisorTransportCapabilityV2(capability)).not.toThrow();
    expect(() => assertAdvisorTransportCapabilityV2({ ...capability, target: '%9' }))
      .toThrow(expect.objectContaining({ code: 'UNKNOWN_FIELD' }));
    expect(() => assertAdvisorTransportCapabilityV2({ ...capability, logicalRoute: 'WORKER' }))
      .toThrow(expect.objectContaining({ code: 'INVALID_SCHEMA' }));
  });

  it.each([
    'roleProtocol',
    'transportProtocol',
    'activationState',
    'finalActivationRecord',
    'sessionRegistry',
    'killSwitchAndFallback',
    'optionADecision',
    'parentMissionManifest',
  ] as const)('requires the exact %s authority snapshot', async (missingKey) => {
    const fixture = authorityFixture();
    const blobs = new Map(fixture.blobs);
    blobs.delete(fixture.activation.snapshotRefs[missingKey].path);
    const root = await makeStateRoot();
    roots.push(root);
    const authority = await ExactAdvisorAuthorityValidator.open({
      activation: fixture.activation,
      git: new FakeGitAuthorityReader(blobs),
      runtime: runtime(95),
      stateRoot: root,
    });
    await expect(authority.validateStaticAuthority()).rejects.toThrow();
  });

  it('fails static authority on trusted-path dirt, hash changes, non-ancestry, and inactive state', async () => {
    const root = await makeStateRoot();
    roots.push(root);
    const fixture = authorityFixture();
    const git = new FakeGitAuthorityReader(fixture.blobs);
    const authority = await ExactAdvisorAuthorityValidator.open({
      activation: fixture.activation,
      git,
      runtime: runtime(96),
      stateRoot: root,
    });
    git.dirtyPaths.add(fixture.activation.snapshotRefs.roleProtocol.path);
    await expect(authority.validateStaticAuthority()).rejects.toMatchObject({
      code: 'AUTHORITY_ARTIFACT_INVALID',
    });
    git.dirtyPaths.clear();
    const killRef = fixture.activation.snapshotRefs.killSwitchAndFallback;
    git.addUpstreamJson(killRef.path, { killSwitch: 'ENGAGED' });
    await expect(authority.validateStaticAuthority()).rejects.toMatchObject({
      code: 'AUTHORITY_ARTIFACT_INVALID',
    });
    const originalKill = fixture.blobs.get(killRef.path);
    if (originalKill === undefined) throw new Error('kill snapshot fixture missing');
    git.restoreUpstream(killRef.path, originalKill);
    git.ancestorResult = false;
    await expect(authority.validateStaticAuthority()).rejects.toMatchObject({
      code: 'AUTHORITY_ARTIFACT_INVALID',
    });

    const inactive = authorityFixture({
      activationState: 'MODE_STATUS: `INACTIVE`\nKILL_SWITCH: `ENGAGED`\n',
    });
    const inactiveAuthority = await ExactAdvisorAuthorityValidator.open({
      activation: inactive.activation,
      git: new FakeGitAuthorityReader(inactive.blobs),
      runtime: runtime(97),
      stateRoot: root,
    });
    await expect(inactiveAuthority.validateStaticAuthority()).rejects.toMatchObject({
      code: 'AUTHORITY_ARTIFACT_INVALID',
    });

    const changed = new Map(fixture.blobs);
    const roleRef = fixture.activation.snapshotRefs.roleProtocol;
    changed.set(roleRef.path, {
      ref: roleRef,
      blobId: 'b'.repeat(40),
      bytes: Buffer.from('changed bytes', 'utf8'),
    });
    const changedAuthority = await ExactAdvisorAuthorityValidator.open({
      activation: fixture.activation,
      git: new FakeGitAuthorityReader(changed),
      runtime: runtime(98),
      stateRoot: root,
    });
    await expect(changedAuthority.validateStaticAuthority()).rejects.toMatchObject({
      code: 'AUTHORITY_ARTIFACT_INVALID',
    });
  });

  it('writes byte-exact pointer evidence and invokes only load, paste-to-%9, and Enter once', async () => {
    const fixture = await deliveryFixture();
    const request = gatewayRequest(100);
    const pointerEnvelope = canonicalAdvisorPointerEnvelope(request);
    const outcome = await fixture.port.deliverPointer({
      request,
      requestHash: hashCanonical(request),
      pointerEnvelope,
    });
    expect(outcome.status).toBe('DELIVERED');
    expect(fixture.runner.operations.map((item) => item.kind)).toEqual([
      'PREFLIGHT', 'BUFFER_ABSENT', 'LOAD_BUFFER', 'PREFLIGHT', 'PASTE_BUFFER', 'SEND_ENTER',
    ]);
    const load = fixture.runner.operations.find((item) => item.kind === 'LOAD_BUFFER');
    if (load?.kind !== 'LOAD_BUFFER') throw new Error('load operation missing');
    expect(await readFile(load.pointerFile, 'utf8')).toBe(pointerEnvelope);
    expect(pointerEnvelope).not.toContain('message body');
    expect(pointerEnvelope).not.toMatch(/session|pane|command|target|executable|authorityRole/iu);
    expect(exactTmuxArgv({ kind: 'LOAD_BUFFER', bufferName: load.bufferName, pointerFile: load.pointerFile }))
      .toEqual(['load-buffer', '-b', load.bufferName, load.pointerFile]);
    expect(exactTmuxArgv({ kind: 'PASTE_BUFFER', bufferName: load.bufferName }))
      .toEqual(['paste-buffer', '-p', '-b', load.bufferName, '-t', '%9', '-d']);
    expect(exactTmuxArgv({ kind: 'SEND_ENTER' })).toEqual(['send-keys', '-t', '%9', 'Enter']);
    expect(exactTmuxArgv({ kind: 'PREFLIGHT' })).toEqual([
      'display-message', '-p', '-t', '%9', '-F', expect.any(String),
    ]);

    const replay = await fixture.port.deliverPointer({
      request,
      requestHash: hashCanonical(request),
      pointerEnvelope,
    });
    expect(replay.status).toBe('ALREADY_DELIVERED');
    expect(fixture.runner.operations.filter((item) => item.kind === 'PASTE_BUFFER')).toHaveLength(1);
    const journal = JSON.parse(await readFile(
      path.join(fixture.root, 'indexes', 'tmux-delivery', `${request.notificationId}.json`),
      'utf8',
    )) as { readonly records: readonly { readonly phase: string }[] };
    expect(journal.records.map((record) => record.phase)).toEqual([
      'PREPARED', 'BUFFER_LOADED', 'PASTE_STARTED', 'PASTE_CONFIRMED',
      'SUBMIT_STARTED', 'TRANSPORT_RECORDED',
    ]);
  });

  it('keeps the production mutation runner fixed, no-shell, and non-generic', async () => {
    const source = await readFile(
      path.resolve('src/adapters/gateways/tmux-advisor/exact-transport.ts'),
      'utf8',
    );
    expect(source).toContain("spawn('/usr/bin/tmux', [...argv]");
    expect(source).toContain('shell: false');
    expect(source).not.toMatch(/shell:\s*true|\bexec(?:File|Sync)?\s*\(|\beval\s*\(/u);
    expect(source).not.toMatch(/capture-pane|run-shell|new-session|new-window|split-window/u);
    expect(source).not.toMatch(/export\s+(?:async\s+)?function\s+runExactTmuxTool/u);
  });

  it('makes other missions and non-Advisor targets unrepresentable before any tmux operation', async () => {
    const fixture = await deliveryFixture();
    const request = gatewayRequest(175);
    const otherMission = 'OTHER_MISSION';
    const changed = {
      ...request,
      missionId: otherMission,
      messageArtifactRef:
        `artifacts/inbox/${otherMission}/${request.requestId}/${request.messageArtifactHash.slice(7)}.json`,
    };
    await expect(fixture.port.deliverPointer({
      request: changed,
      requestHash: hashCanonical(changed),
      pointerEnvelope: canonicalAdvisorPointerEnvelope(changed),
    })).rejects.toMatchObject({ code: 'FORBIDDEN_TARGET' });
    expect(fixture.runner.operations).toEqual([]);
    expect(() => exactTmuxArgv({ kind: 'PASTE_BUFFER', bufferName: 'worker' }))
      .toThrow(expect.objectContaining({ code: 'FORBIDDEN_TARGET' }));
  });

  it('replays durable success after restart and rejects changed bytes for either identity key', async () => {
    const fixture = await deliveryFixture();
    const request = gatewayRequest(200);
    await fixture.port.deliverPointer({
      request,
      requestHash: hashCanonical(request),
      pointerEnvelope: canonicalAdvisorPointerEnvelope(request),
    });
    const restartedAuthority = await ExactAdvisorAuthorityValidator.open({
      activation: fixture.activation,
      git: fixture.git,
      runtime: runtime(900),
      stateRoot: fixture.root,
    });
    const restartedRunner = new FakeTmuxRunner([preflight()]);
    const restarted = await DurableExactAdvisorDeliveryPort.open({
      stateRoot: fixture.root,
      activation: fixture.activation,
      authority: restartedAuthority,
      runner: restartedRunner,
      deliveryControl: await DurableDeliveryControl.open(fixture.root),
      runtime: runtime(950),
    });
    await expect(restarted.lookupPointerReceipt({ notificationId: request.notificationId }))
      .resolves.toMatchObject({ status: 'ALREADY_DELIVERED' });
    expect(restartedRunner.operations).toEqual([]);
    const changed = { ...request, messagePayloadHash: `sha256:${'9'.repeat(64)}` };
    await expect(restarted.deliverPointer({
      request: changed,
      requestHash: hashCanonical(changed),
      pointerEnvelope: canonicalAdvisorPointerEnvelope(changed),
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });

  it('coalesces concurrent identical delivery but rejects concurrent changed bytes', async () => {
    const fixture = await deliveryFixture();
    const request = gatewayRequest(225);
    const input = {
      request,
      requestHash: hashCanonical(request),
      pointerEnvelope: canonicalAdvisorPointerEnvelope(request),
    };
    const first = fixture.port.deliverPointer(input);
    const duplicate = fixture.port.deliverPointer(input);
    const changed = { ...request, messagePayloadHash: `sha256:${'7'.repeat(64)}` };
    const conflict = expect(fixture.port.deliverPointer({
      request: changed,
      requestHash: hashCanonical(changed),
      pointerEnvelope: canonicalAdvisorPointerEnvelope(changed),
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    await expect(Promise.all([first, duplicate])).resolves.toMatchObject([
      { status: 'DELIVERED' },
      { status: 'DELIVERED' },
    ]);
    await conflict;
    expect(fixture.runner.operations.filter((item) => item.kind === 'PASTE_BUFFER')).toHaveLength(1);
    expect(fixture.runner.operations.filter((item) => item.kind === 'SEND_ENTER')).toHaveLength(1);
  });

  it.each([
    ['PREPARED', 1],
    ['BUFFER_LOADED', 2],
    ['PASTE_STARTED', 3],
    ['PASTE_CONFIRMED', 4],
    ['SUBMIT_STARTED', 5],
    ['TRANSPORT_RECORDED', 6],
  ] as const)('recovers a durable %s crash boundary without replaying pane input', async (phase, count) => {
    const fixture = await deliveryFixture();
    const request = gatewayRequest(235 + count);
    await fixture.port.deliverPointer({
      request,
      requestHash: hashCanonical(request),
      pointerEnvelope: canonicalAdvisorPointerEnvelope(request),
    });
    const journalPath = path.join(
      fixture.root,
      'indexes',
      'tmux-delivery',
      `${request.notificationId}.json`,
    );
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as {
      readonly schemaVersion: string;
      readonly records: readonly { readonly bufferName: string }[];
    };
    await writeFile(journalPath, `${JSON.stringify({
      schemaVersion: journal.schemaVersion,
      records: journal.records.slice(0, count),
    })}\n`, { mode: 0o600 });

    const restartedAuthority = await ExactAdvisorAuthorityValidator.open({
      activation: fixture.activation,
      git: fixture.git,
      runtime: runtime(240 + count),
      stateRoot: fixture.root,
    });
    const recoveryRunner = new FakeTmuxRunner([preflight()]);
    if (phase === 'BUFFER_LOADED') {
      const bufferName = journal.records[1]?.bufferName;
      if (bufferName === undefined) throw new Error('buffer identity missing');
      recoveryRunner.buffers.add(bufferName);
    }
    const restarted = await DurableExactAdvisorDeliveryPort.open({
      stateRoot: fixture.root,
      activation: fixture.activation,
      authority: restartedAuthority,
      runner: recoveryRunner,
      deliveryControl: await DurableDeliveryControl.open(fixture.root),
      runtime: runtime(250 + count),
    });
    const expected = phase === 'TRANSPORT_RECORDED' ? 'ALREADY_DELIVERED' : 'AMBIGUOUS';
    await expect(restarted.lookupPointerReceipt({ notificationId: request.notificationId }))
      .resolves.toMatchObject({ status: expected });
    await expect(restarted.lookupPointerReceipt({ notificationId: request.notificationId }))
      .resolves.toMatchObject({ status: expected });
    expect(recoveryRunner.operations.filter((item) => item.kind === 'PASTE_BUFFER')).toHaveLength(0);
    expect(recoveryRunner.operations.filter((item) => item.kind === 'SEND_ENTER')).toHaveLength(0);
    if (phase === 'BUFFER_LOADED') {
      expect(recoveryRunner.operations.filter((item) => item.kind === 'DELETE_BUFFER')).toHaveLength(1);
    }
  });

  it('allows observation timestamps to advance while requiring the exact live identity to stay fixed', async () => {
    const fixture = await deliveryFixture({
      first: { ...preflight(), observedAt: '2026-07-10T00:00:09.000Z' },
      second: { ...preflight(), observedAt: NOW },
    });
    const request = gatewayRequest(250);
    await expect(fixture.port.deliverPointer({
      request,
      requestHash: hashCanonical(request),
      pointerEnvelope: canonicalAdvisorPointerEnvelope(request),
    })).resolves.toMatchObject({ status: 'DELIVERED' });
  });

  it('quarantines a malformed durable journal and latches delivery before returning', async () => {
    const fixture = await deliveryFixture();
    const request = gatewayRequest(275);
    await fixture.port.deliverPointer({
      request,
      requestHash: hashCanonical(request),
      pointerEnvelope: canonicalAdvisorPointerEnvelope(request),
    });
    await writeFile(
      path.join(fixture.root, 'indexes', 'tmux-delivery', `${request.notificationId}.json`),
      '{"tampered":true}\n',
      { mode: 0o600 },
    );
    await expect(fixture.port.lookupPointerReceipt({ notificationId: request.notificationId }))
      .rejects.toMatchObject({ code: 'STORE_QUARANTINED' });
    expect(fixture.control.project().mode).toBe('DISABLED_LATCHED');
  });

  it('never retries after paste starts and durably returns ambiguous/manual reconciliation', async () => {
    const fixture = await deliveryFixture({ failAt: 'PASTE_BUFFER' });
    const request = gatewayRequest(300);
    const first = await fixture.port.deliverPointer({
      request,
      requestHash: hashCanonical(request),
      pointerEnvelope: canonicalAdvisorPointerEnvelope(request),
    });
    expect(first).toMatchObject({
      status: 'AMBIGUOUS',
      failureCode: 'DELIVERY_RECEIPT_AMBIGUOUS',
    });
    expect(fixture.control.project().mode).toBe('DISABLED_LATCHED');
    const pastes = fixture.runner.operations.filter((item) => item.kind === 'PASTE_BUFFER').length;
    await expect(fixture.port.lookupPointerReceipt({ notificationId: request.notificationId }))
      .resolves.toMatchObject({ status: 'AMBIGUOUS' });
    expect(fixture.runner.operations.filter((item) => item.kind === 'PASTE_BUFFER')).toHaveLength(pastes);
    expect(fixture.runner.operations.filter((item) => item.kind === 'SEND_ENTER')).toHaveLength(0);
  });

  it.each([
    ['pane restart', { second: { ...preflight(), windowId: '@10' } }],
    ['wrong process', { first: { ...preflight(), currentCommand: 'bash' } }],
    ['wrong workspace', { first: { ...preflight(), workspace: '/tmp' } }],
    ['dead pane', { first: { ...preflight(), paneDead: true } }],
    ['copy mode', { first: { ...preflight(), paneInMode: true } }],
    ['input off', { first: { ...preflight(), inputOff: true } }],
    ['synchronized pane', { first: { ...preflight(), synchronizePanes: true } }],
    ['buffer collision', { bufferCollision: true }],
  ])('fails closed before paste for %s', async (_label, options) => {
    const fixture = await deliveryFixture(options);
    const request = gatewayRequest(400);
    const outcome = await fixture.port.deliverPointer({
      request,
      requestHash: hashCanonical(request),
      pointerEnvelope: canonicalAdvisorPointerEnvelope(request),
    });
    expect(outcome.status).toBe('MANUAL_FALLBACK');
    expect(fixture.runner.operations.filter((item) => item.kind === 'PASTE_BUFFER')).toHaveLength(0);
    expect(fixture.runner.operations.filter((item) => item.kind === 'SEND_ENTER')).toHaveLength(0);
    expect(fixture.control.project().mode).toBe('DISABLED_LATCHED');
  });

  it('revalidates committed authority after buffer load and before pane input', async () => {
    const fixture = await deliveryFixture({ mutateAuthorityBeforePaste: true });
    const request = gatewayRequest(475);
    await expect(fixture.port.deliverPointer({
      request,
      requestHash: hashCanonical(request),
      pointerEnvelope: canonicalAdvisorPointerEnvelope(request),
    })).resolves.toMatchObject({ status: 'MANUAL_FALLBACK' });
    expect(fixture.runner.operations.filter((item) => item.kind === 'LOAD_BUFFER')).toHaveLength(1);
    expect(fixture.runner.operations.filter((item) => item.kind === 'DELETE_BUFFER')).toHaveLength(1);
    expect(fixture.runner.operations.filter((item) => item.kind === 'PASTE_BUFFER')).toHaveLength(0);
    expect(fixture.runner.operations.filter((item) => item.kind === 'SEND_ENTER')).toHaveLength(0);
    expect(fixture.control.project().mode).toBe('DISABLED_LATCHED');
  });

  it('consumes a readiness lease once and cannot auto-enable after a local latch', async () => {
    const fixture = await deliveryFixture();
    const first = gatewayRequest(500);
    await fixture.port.deliverPointer({
      request: first,
      requestHash: hashCanonical(first),
      pointerEnvelope: canonicalAdvisorPointerEnvelope(first),
    });
    const second = gatewayRequest(600);
    const outcome = await fixture.port.deliverPointer({
      request: second,
      requestHash: hashCanonical(second),
      pointerEnvelope: canonicalAdvisorPointerEnvelope(second),
    });
    expect(outcome.status).toBe('MANUAL_FALLBACK');
    expect(fixture.runner.operations.filter((item) => item.kind === 'PASTE_BUFFER')).toHaveLength(1);
    expect(fixture.control.project().mode).toBe('DISABLED_LATCHED');
    await expect(fixture.control.armValidatedGrant({
      activationId: 'new-grant-without-reviewed-recovery',
      grantHash: `sha256:${'8'.repeat(64)}`,
      activatedAt: NOW,
    })).rejects.toMatchObject({ code: 'GATEWAY_DISABLED' });
  });

  it('serializes concurrent notifications so one readiness lease can reach pane input at most once', async () => {
    const fixture = await deliveryFixture();
    const first = gatewayRequest(650);
    const second = gatewayRequest(675);
    const outcomes = await Promise.all([
      fixture.port.deliverPointer({
        request: first,
        requestHash: hashCanonical(first),
        pointerEnvelope: canonicalAdvisorPointerEnvelope(first),
      }),
      fixture.port.deliverPointer({
        request: second,
        requestHash: hashCanonical(second),
        pointerEnvelope: canonicalAdvisorPointerEnvelope(second),
      }),
    ]);
    expect(outcomes.map((outcome) => outcome.status)).toEqual(['DELIVERED', 'MANUAL_FALLBACK']);
    expect(fixture.runner.operations.filter((item) => item.kind === 'PASTE_BUFFER')).toHaveLength(1);
    expect(fixture.runner.operations.filter((item) => item.kind === 'SEND_ENTER')).toHaveLength(1);
  });

  it('quarantines a delivery-control mode that conflicts with its hash-chained transition', async () => {
    const fixture = await deliveryFixture();
    const controlPath = path.join(fixture.root, 'indexes', 'delivery-control.json');
    const value = JSON.parse(await readFile(controlPath, 'utf8')) as Record<string, unknown>;
    await writeFile(controlPath, `${JSON.stringify({ ...value, mode: 'DISABLED_DEFAULT' })}\n`, {
      mode: 0o600,
    });
    await expect(DurableDeliveryControl.open(fixture.root)).rejects.toMatchObject({
      code: 'STORE_QUARANTINED',
    });
  });
});

describe('closed committed Advisor evidence ingress', () => {
  it('rejects unknown fields in every external evidence schema', () => {
    const records = contractEvidenceRecords();
    for (const [parser, value] of [
      [parseAdvisorAcknowledgementEvidence, records.ack],
      [parseAdvisorIntakeEvidence, records.intake],
      [parseAdvisorDecisionEvidence, records.decision],
      [parseAdvisorResumeEvidence, records.resume],
    ] as const) {
      expect(() => parser(Buffer.from(JSON.stringify({ ...value, browserCommand: 'Enter' }), 'utf8')))
        .toThrow(expect.objectContaining({ code: 'UNKNOWN_FIELD' }));
    }
  });

  it('limits Advisor authority to exact routine intake and requires Leo/GPT for material scope', async () => {
    const fixture = authorityFixture();
    const git = new FakeGitAuthorityReader(fixture.blobs);
    const decisionId = uuidV7(6_900);
    const reference = git.addUpstreamJson(
      'advisor/jobs/20260711_agent_office_m01_exact_advisor_delivery_activation/advisor-evidence/authorities/BOUNDED_ROUTINE.json',
      {
        schemaVersion: 'agent-office.decision-authority-evidence.v2',
        decisionId,
        missionId: MISSION_ID,
        authorityRole: 'Advisor',
        authoritySubjectId: 'foundation-advisor',
        scope: { kind: 'WORK_UNIT_SET', workUnitIds: ['AO-WU-19'] },
        decidedAt: NOW,
        decisionKind: 'ROUTINE_ROUTE',
        governingLeoAuthorityArtifact: fixture.activation.snapshotRefs.optionADecision,
        decisionCode: 'ROUTE_ALREADY_AUTHORIZED_WORK',
      },
    );
    const verifier = new ExactGitDecisionAuthorityEvidenceVerifier(
      git,
      fixture.activation.snapshotRefs.optionADecision,
      fixture.activation.snapshotRefs.parentMissionManifest,
      () => NOW,
    );
    await expect(verifier.verify({
      decisionId,
      missionId: MISSION_ID,
      authorityRole: 'Advisor',
      decisionArtifact: reference,
      expectedWorkUnitIds: ['AO-WU-19'],
      recordedAt: NOW,
      intakeClassification: 'ROUTINE_ROUTE',
    })).resolves.toMatchObject({
      authorityRole: 'Advisor',
      authoritySubjectId: 'foundation-advisor',
    });
    for (const changed of [
      { intakeClassification: 'NEEDS_LEO_DECISION' as const },
      { expectedWorkUnitIds: ['AO-WU-20'] },
      { authorityRole: 'Leo/GPT' as const },
    ]) {
      await expect(verifier.verify({
        decisionId,
        missionId: MISSION_ID,
        authorityRole: 'Advisor',
        decisionArtifact: reference,
        expectedWorkUnitIds: ['AO-WU-19'],
        recordedAt: NOW,
        intakeClassification: 'ROUTINE_ROUTE',
        ...changed,
      })).rejects.toMatchObject({ code: 'AUTHORITY_ARTIFACT_INVALID' });
    }

    const waitingDecisionId = uuidV7(6_901);
    const waitingReference = git.addUpstreamJson(
      'advisor/jobs/20260711_agent_office_m01_exact_advisor_delivery_activation/advisor-evidence/authorities/WAITING_ROUTE.json',
      {
        schemaVersion: 'agent-office.decision-authority-evidence.v2',
        decisionId: waitingDecisionId,
        missionId: MISSION_ID,
        authorityRole: 'Advisor',
        authoritySubjectId: 'foundation-advisor',
        scope: { kind: 'WORK_UNIT_SET', workUnitIds: ['AO-WU-20'] },
        decidedAt: NOW,
        decisionKind: 'ROUTINE_ROUTE',
        governingLeoAuthorityArtifact: fixture.activation.snapshotRefs.optionADecision,
        decisionCode: 'ROUTE_ALREADY_AUTHORIZED_WORK',
      },
    );
    await expect(verifier.verify({
      decisionId: waitingDecisionId,
      missionId: MISSION_ID,
      authorityRole: 'Advisor',
      decisionArtifact: waitingReference,
      expectedWorkUnitIds: ['AO-WU-20'],
      recordedAt: NOW,
      intakeClassification: 'ROUTINE_ROUTE',
    })).rejects.toMatchObject({ code: 'AUTHORITY_ARTIFACT_INVALID' });
  });

  it('applies ACK, intake, bounded Advisor decision, and resume in order and rejects rewrites', async () => {
    const root = await makeStateRoot();
    roots.push(root);
    const store = await EventStore.open({
      root,
      missionId: MISSION_ID,
      manifestVersion: 1,
      writer: {
        buildId: 'exact-evidence-ingress-test',
        stateRootId: 'test-state-root',
        acquiredAt: NOW,
      },
    });
    stores.push(store);
    const waiting = await store.append({
      eventId: uuidV7(7_000),
      eventType: 'WorkUnitStateTransitioned',
      requestId: uuidV7(7_001),
      correlationId: uuidV7(7_002),
      causationId: uuidV7(7_003),
      actor: { role: 'Advisor', subjectId: 'foundation-advisor' },
      occurredAt: NOW,
      receivedAt: NOW,
      recordedAt: NOW,
      expectedStreamVersion: 0,
      expectedManifestVersion: 1,
      payload: { workUnitId: 'AO-WU-19', from: 'REVIEW_PENDING', to: 'WAITING_ADVISOR' },
    });
    const fixture = authorityFixture();
    const git = new FakeGitAuthorityReader(fixture.blobs);
    const gateway = new EvidenceGateway();
    const identity = runtime(7_100);
    const inbox = new AdvisorInboxService(
      store,
      await ImmutableArtifactStore.open(root),
      gateway,
      identity,
      {
        missionId: MISSION_ID,
        manifestVersion: 1,
        allowlistedEntityIds: new Set(['AO-WU-19']),
      },
      new ExactGitDecisionAuthorityEvidenceVerifier(
        git,
        fixture.activation.snapshotRefs.optionADecision,
        fixture.activation.snapshotRefs.parentMissionManifest,
        () => NOW,
      ),
    );
    const persisted = await inbox.persistMessage(
      {
        requestId: uuidV7(7_200),
        missionId: MISSION_ID,
        manifestVersion: 1,
        kind: 'DECISION_RESPONSE',
        subject: 'Route already-authorized work only',
        bodyText: 'Structured evidence ingress test body.',
        referencedEntityIds: ['AO-WU-19'],
        clientCreatedAt: NOW,
      },
      {
        actor: { role: 'Leo/GPT', subjectId: 'leo-gpt' },
        correlationId: uuidV7(7_201),
        causationId: uuidV7(7_202),
        receivedAt: NOW,
      },
    );
    const queued = await inbox.queueMessage(persisted.messageId);
    await inbox.deliverNotification(queued.notificationId);
    const legacyEvents = store.readAll().map((event) => {
      if (event.eventType !== 'NotificationQueued') return event;
      const payload = event.payload as Record<string, unknown>;
      const gatewayRequest = payload.gatewayRequest as Record<string, unknown>;
      const { messagePayloadHash: _legacyMissingField, ...legacyRequest } = gatewayRequest;
      void _legacyMissingField;
      return { ...event, payload: { ...payload, gatewayRequest: legacyRequest } } as typeof event;
    });
    expect(
      projectAdvisorInbox(legacyEvents).notifications[queued.notificationId]?.request.messagePayloadHash,
    ).toBe(persisted.messagePayloadHash);
    const ingress = await AdvisorEvidenceIngress.open({
      activation: fixture.activation,
      source: git,
      inbox,
      store,
      runtime: identity,
      stateRoot: root,
    });
    const canonicalIntakePath = evidencePath(
      fixture.activation,
      persisted.messageId,
      '02_INTAKE.json',
    );
    git.addUpstreamJson(canonicalIntakePath, { premature: true });
    const beforePrematureIntake = store.sequence;
    await expect(ingress.refresh()).rejects.toMatchObject({ code: 'AUTHORITY_ARTIFACT_INVALID' });
    expect(store.sequence).toBe(beforePrematureIntake);
    git.removeUpstream(canonicalIntakePath);

    const pointerHash = sha256Bytes(canonicalAdvisorPointerEnvelope(queued.request));
    const transportReceipt = gateway.receipt;
    if (transportReceipt === undefined) throw new Error('synthetic transport receipt is missing');
    const acknowledgementPath = evidencePath(fixture.activation, persisted.messageId, '01_ACKNOWLEDGEMENT.json');
    const acknowledgementRef = git.addUpstreamJson(acknowledgementPath, {
      schemaVersion: 'agent-office.advisor-acknowledgement-evidence.v1',
      missionId: MISSION_ID,
      activationMissionId: 'AGENT_OFFICE_M01_EXACT_ADVISOR_DELIVERY_ACTIVATION',
      requestId: uuidV7(7_210),
      messageId: persisted.messageId,
      notificationId: queued.notificationId,
      acknowledgementId: uuidV7(7_211),
      acknowledgedAt: NOW,
      advisorRole: 'Advisor',
      advisorSubjectId: 'foundation-advisor',
      destination: exactDestination(),
      readinessLeaseId: gateway.leaseId,
      pointerEnvelopeHash: pointerHash,
      messageArtifactRef: persisted.messageArtifactRef,
      messageArtifactHash: persisted.messageArtifactHash,
      transportReceiptHash: transportReceipt.receiptHash,
      artifactReadStatus: 'VERIFIED',
      evidenceRefs: ['advisor-message-read'],
    });
    git.ancestorResult = false;
    const beforeNonAncestorAck = store.sequence;
    await expect(ingress.refresh()).rejects.toMatchObject({ code: 'AUTHORITY_ARTIFACT_INVALID' });
    expect(store.sequence).toBe(beforeNonAncestorAck);
    git.ancestorResult = true;
    expect(await ingress.refresh()).toBeGreaterThan(0);
    expect(inbox.project().messages[persisted.messageId]).toMatchObject({
      state: 'ACKNOWLEDGED',
      acknowledgementEvidenceRef: acknowledgementRef,
    });

    const canonicalDecisionPath = evidencePath(
      fixture.activation,
      persisted.messageId,
      '03_DECISION.json',
    );
    git.addUpstreamJson(canonicalDecisionPath, { premature: true });
    const beforePrematureDecision = store.sequence;
    await expect(ingress.refresh()).rejects.toMatchObject({ code: 'AUTHORITY_ARTIFACT_INVALID' });
    expect(store.sequence).toBe(beforePrematureDecision);
    git.removeUpstream(canonicalDecisionPath);

    const intakeRef = git.addUpstreamJson(canonicalIntakePath, {
      schemaVersion: 'agent-office.advisor-intake-evidence.v1',
      missionId: MISSION_ID,
      requestId: uuidV7(7_220),
      messageId: persisted.messageId,
      notificationId: queued.notificationId,
      intakeId: uuidV7(7_221),
      classification: 'ROUTINE_ROUTE',
      recordedAt: NOW,
      acknowledgementArtifact: acknowledgementRef,
      messageArtifactHash: persisted.messageArtifactHash,
      referencedWorkUnitIds: ['AO-WU-19'],
      evidenceRefs: ['advisor-routine-intake'],
    });
    await ingress.refresh();
    expect(inbox.project().messages[persisted.messageId]).toMatchObject({
      state: 'INTAKE_RECORDED',
      intakeClassification: 'ROUTINE_ROUTE',
      intakeEvidenceRef: intakeRef,
    });

    const decisionId = uuidV7(7_230);
    const decisionAuthorityRef = git.addUpstreamJson(
      'advisor/jobs/20260711_agent_office_m01_exact_advisor_delivery_activation/advisor-evidence/authorities/ROUTINE_ROUTE.json',
      {
        schemaVersion: 'agent-office.decision-authority-evidence.v2',
        decisionId,
        missionId: MISSION_ID,
        authorityRole: 'Advisor',
        authoritySubjectId: 'foundation-advisor',
        scope: { kind: 'WORK_UNIT_SET', workUnitIds: ['AO-WU-19'] },
        decidedAt: NOW,
        decisionKind: 'ROUTINE_ROUTE',
        governingLeoAuthorityArtifact: fixture.activation.snapshotRefs.optionADecision,
        decisionCode: 'ROUTE_ALREADY_AUTHORIZED_WORK',
      },
    );
    const decisionRef = git.addUpstreamJson(
      canonicalDecisionPath,
      {
        schemaVersion: 'agent-office.advisor-decision-evidence.v1',
        missionId: MISSION_ID,
        requestId: uuidV7(7_231),
        messageId: persisted.messageId,
        decisionId,
        decisionKind: 'ROUTINE_ROUTE',
        authorityRole: 'Advisor',
        authoritySubjectId: 'foundation-advisor',
        scope: { kind: 'WORK_UNIT_SET', workUnitIds: ['AO-WU-19'] },
        decidedAt: NOW,
        intakeArtifact: intakeRef,
        governingLeoAuthorityArtifact: fixture.activation.snapshotRefs.optionADecision,
        decisionAuthorityArtifact: decisionAuthorityRef,
        decisionCode: 'ROUTE_ALREADY_AUTHORIZED_WORK',
        evidenceRefs: ['already-authorized-route'],
      },
    );
    await ingress.refresh();
    expect(inbox.project().messages[persisted.messageId]).toMatchObject({
      state: 'DECISION_LINKED',
      authorityRole: 'Advisor',
      authoritySubjectId: 'foundation-advisor',
      decisionEvidenceRef: decisionRef,
      authorityEvidenceRef: decisionAuthorityRef,
    });

    const resumeRef = git.addUpstreamJson(
      evidencePath(fixture.activation, persisted.messageId, '04_RESUME_AO-WU-19.json'),
      {
        schemaVersion: 'agent-office.advisor-resume-evidence.v1',
        missionId: MISSION_ID,
        requestId: uuidV7(7_240),
        messageId: persisted.messageId,
        workUnitId: 'AO-WU-19',
        decisionArtifact: decisionAuthorityRef,
        intakeArtifact: intakeRef,
        recordedAt: NOW,
        resumeProof: {
          workUnitId: 'AO-WU-19',
          waitingEventId: waiting.event.eventId,
          previousState: 'REVIEW_PENDING',
          resumeTo: 'REVIEW_PENDING',
          decisionId,
          decisionArtifactHash: decisionAuthorityRef.sha256,
          intakeArtifactHash: intakeRef.sha256,
          resolvedBlockerIds: [],
          expectedStreamVersion: store.sequence,
        },
      },
    );
    await ingress.refresh();
    expect(inbox.project().messages[persisted.messageId]?.resumeEvidenceRefs).toEqual([resumeRef]);
    expect(store.readAll().at(-1)).toMatchObject({
      eventType: 'WorkUnitStateTransitioned',
      actor: { role: 'Advisor', subjectId: 'foundation-advisor' },
      payload: { from: 'WAITING_ADVISOR', to: 'REVIEW_PENDING' },
    });

    const beforeAcceptedEvidenceConflict = store.sequence;
    git.dirtyPaths.add(acknowledgementPath);
    await expect(ingress.refresh()).rejects.toMatchObject({ code: 'AUTHORITY_ARTIFACT_INVALID' });
    expect(store.sequence).toBe(beforeAcceptedEvidenceConflict);
    git.dirtyPaths.clear();

    const removedAck = git.removeUpstream(acknowledgementPath);
    if (removedAck === undefined) throw new Error('accepted ACK fixture is missing');
    await expect(ingress.refresh()).rejects.toMatchObject({ code: 'AUTHORITY_ARTIFACT_INVALID' });
    expect(store.sequence).toBe(beforeAcceptedEvidenceConflict);
    git.restoreUpstream(acknowledgementPath, removedAck);

    git.addUpstreamJson(acknowledgementPath, {
      schemaVersion: 'agent-office.advisor-acknowledgement-evidence.v1',
      tampered: true,
    });
    await expect(ingress.refresh()).rejects.toMatchObject({ code: 'AUTHORITY_ARTIFACT_INVALID' });
    expect(store.sequence).toBe(beforeAcceptedEvidenceConflict);
  });
});

async function deliveryFixture(options: {
  readonly failAt?: FakeTmuxOperation['kind'];
  readonly first?: ExactTmuxPreflightRecord;
  readonly second?: ExactTmuxPreflightRecord;
  readonly bufferCollision?: boolean;
  readonly mutateAuthorityBeforePaste?: boolean;
} = {}) {
  const root = await makeStateRoot();
  roots.push(root);
  const fixture = authorityFixture();
  const git = new FakeGitAuthorityReader(fixture.blobs);
  const identity = runtime(1);
  const authority = await ExactAdvisorAuthorityValidator.open({
    activation: fixture.activation,
    git,
    runtime: identity,
    stateRoot: root,
  });
  const validated = await authority.validateStaticAuthority();
  git.addUpstreamJson(fixture.activation.readinessLeasePath, readinessLease(validated));
  const control = await DurableDeliveryControl.open(root);
  await control.armValidatedGrant({
    activationId: fixture.activation.activationId,
    grantHash: validated.activationGrantHash,
    activatedAt: NOW,
  });
  const runner = new FakeTmuxRunner(
    [options.first ?? preflight(), options.second ?? preflight()],
    options.failAt,
    (observationIndex) => {
      if (options.mutateAuthorityBeforePaste === true && observationIndex === 1) {
        git.addUpstreamJson(fixture.activation.snapshotRefs.killSwitchAndFallback.path, {
          killSwitch: 'ENGAGED',
        });
      }
    },
  );
  if (options.bufferCollision === true) runner.buffers.add(bufferNameFor(gatewayRequest(400).notificationId));
  const port = await DurableExactAdvisorDeliveryPort.open({
    stateRoot: root,
    activation: fixture.activation,
    authority,
    runner,
    deliveryControl: control,
    runtime: identity,
  });
  return { root, activation: fixture.activation, git, control, runner, port };
}

function authorityFixture(overrides: Readonly<Record<string, string>> = {}): {
  readonly activation: ExactAdvisorDeliveryActivation;
  readonly blobs: ReadonlyMap<string, ExactGitBlob>;
} {
  const commit = 'a'.repeat(40);
  const content: Record<string, string> = {
    roleProtocol: 'Canonical V2 ACTIVE Leo/GPT Advisor Worker Reviewer role separation\n',
    transportProtocol: [
      'ACTIVE__FABLE5_DUAL_PASS__LEO_GPT_FINAL_APPROVED',
      'Existing Sessions Only',
      'synchronized panes are off',
    ].join('\n'),
    activationState: [
      'MODE_STATUS: `ACTIVE`',
      'KILL_SWITCH: `DISENGAGED`',
      'MANUAL_ROUTING_FALLBACK: `ACTIVE`',
    ].join('\n'),
    finalActivationRecord: [
      'LEO_GPT_FINAL_ACTIVATION: `APPROVED`',
      'KILL_SWITCH_FINAL_STATE: `DISENGAGED`',
      'PRODUCT_MISSION_AUTHORIZATION: `NONE`',
    ].join('\n'),
    sessionRegistry: [
      'synchronize-panes off',
      '| Advisor | `foundation-advisor` | `$9` | 0 | `@9` | 0 | `%9` | `/home/leo/Project/foundation-advisor` | `codex` | role | fixed |',
    ].join('\n'),
    killSwitchAndFallback: [
      'Current kill-switch state: `DISENGAGED`',
      'Current fallback: `MANUAL_ROUTING_ACTIVE`',
    ].join('\n'),
    optionADecision: `Option A\n${MISSION_ID}\nAGENT_OFFICE_M01_EXACT_ADVISOR_DELIVERY_ACTIVATION\n`,
    parentMissionManifest: JSON.stringify(parentManifest()),
    ...overrides,
  };
  const snapshotRefs = Object.fromEntries(Object.entries(content).map(([key, text], index) => {
    const bytes = Buffer.from(text, 'utf8');
    return [key, {
      repository: 'foundation-docs',
      commit,
      path: `authority/${String(index).padStart(2, '0')}_${key}.json`,
      sha256: sha256Bytes(bytes),
    }];
  })) as unknown as ExactAdvisorDeliveryActivation['snapshotRefs'];
  const activation = parseExactAdvisorDeliveryActivation({
    schemaVersion: 'agent-office.exact-advisor-delivery-activation.v1',
    activationId: 'AO-M01-EXACT-ADVISOR-POINTER-V1',
    mode: 'EXACT_ADVISOR_POINTER',
    authorityProjectId: 'foundation-docs',
    authorityRootId: 'foundation-root',
    authorityGitSourceId: 'foundation-git',
    governedMissionId: MISSION_ID,
    activationMissionId: 'AGENT_OFFICE_M01_EXACT_ADVISOR_DELIVERY_ACTIVATION',
    destination: {
      sessionName: 'foundation-advisor', sessionId: '$9', windowIndex: 0, paneIndex: 0,
      paneId: '%9', workspace: '/home/leo/Project/foundation-advisor', currentCommand: 'codex',
    },
    snapshotRefs,
    readinessLeasePath:
      'advisor/jobs/20260711_agent_office_m01_exact_advisor_delivery_activation/ADVISOR_READINESS.json',
    advisorEvidencePrefix:
      'advisor/jobs/20260711_agent_office_m01_exact_advisor_delivery_activation/advisor-evidence',
    capabilityTtlMs: 20_000,
    preflightMaxAgeMs: 20_000,
    toolLimits: { timeoutMs: 1_000, maxOutputBytes: 16 * 1024 },
    tmuxExecutable: '/usr/bin/tmux',
  });
  const blobs = new Map<string, ExactGitBlob>();
  for (const [key, ref] of Object.entries(activation.snapshotRefs)) {
    const bytes = Buffer.from(content[key] ?? '', 'utf8');
    blobs.set(ref.path, { ref, blobId: 'b'.repeat(40), bytes });
  }
  return { activation, blobs };
}

class FakeGitAuthorityReader implements ExactGitAuthorityReader {
  public readonly dirtyPaths = new Set<string>();
  public ancestorResult = true;
  private readonly upstreamPaths = new Map<string, ExactGitBlob>();
  private readonly histories = new Map<string, readonly string[]>();

  public constructor(private readonly exact: ReadonlyMap<string, ExactGitBlob>) {
    for (const [relativePath, blob] of exact) this.upstreamPaths.set(relativePath, blob);
  }

  public snapshot(): Promise<ExactGitSnapshot> {
    return Promise.resolve({
      headCommit: UPSTREAM,
      upstreamCommit: UPSTREAM,
      upstreamName: 'origin/shadow-test',
      dirtyPaths: this.dirtyPaths,
    });
  }

  public readExact(ref: SourceArtifactRef): Promise<ExactGitBlob> {
    const candidate = this.exact.get(ref.path) ?? this.upstreamPaths.get(ref.path);
    if (candidate?.ref.sha256 !== ref.sha256) {
      return Promise.reject(new Error(`missing fake blob ${ref.path}`));
    }
    return Promise.resolve({ ...candidate, ref });
  }

  public readUpstreamPath(relativePath: string): Promise<ExactGitBlob | undefined> {
    return Promise.resolve(this.upstreamPaths.get(relativePath));
  }

  public isAncestor(): Promise<boolean> {
    return Promise.resolve(this.ancestorResult);
  }

  public pathHistory(relativePath: string): Promise<readonly string[]> {
    return Promise.resolve(this.histories.get(relativePath) ?? []);
  }

  public addUpstreamJson(relativePath: string, value: unknown): SourceArtifactRef {
    const bytes = Buffer.from(JSON.stringify(value), 'utf8');
    const ref = {
      repository: 'foundation-docs',
      commit: 'e'.repeat(40),
      path: relativePath,
      sha256: sha256Bytes(bytes),
    };
    this.upstreamPaths.set(relativePath, { ref, blobId: 'c'.repeat(40), bytes });
    this.histories.set(relativePath, [ref.commit]);
    return ref;
  }

  public removeUpstream(relativePath: string): ExactGitBlob | undefined {
    const prior = this.upstreamPaths.get(relativePath);
    this.upstreamPaths.delete(relativePath);
    this.histories.delete(relativePath);
    return prior;
  }

  public restoreUpstream(relativePath: string, blob: ExactGitBlob): void {
    this.upstreamPaths.set(relativePath, blob);
    this.histories.set(relativePath, [blob.ref.commit]);
  }
}

type FakeTmuxOperation =
  | { readonly kind: 'PREFLIGHT' }
  | { readonly kind: 'BUFFER_ABSENT'; readonly bufferName: string }
  | { readonly kind: 'LOAD_BUFFER'; readonly bufferName: string; readonly pointerFile: string }
  | { readonly kind: 'PASTE_BUFFER'; readonly bufferName: string }
  | { readonly kind: 'SEND_ENTER' }
  | { readonly kind: 'DELETE_BUFFER'; readonly bufferName: string };

class FakeTmuxRunner implements ExactTmuxMutationRunner {
  public readonly operations: FakeTmuxOperation[] = [];
  public readonly buffers = new Set<string>();
  private observationIndex = 0;

  public constructor(
    private readonly observations: readonly ExactTmuxPreflightRecord[],
    private readonly failAt?: FakeTmuxOperation['kind'],
    private readonly afterObservation?: (observationIndex: number) => void,
  ) {}

  public observePreflight(): Promise<ExactTmuxPreflightRecord> {
    this.operations.push({ kind: 'PREFLIGHT' });
    this.maybeFail('PREFLIGHT');
    const currentIndex = this.observationIndex;
    const value = this.observations[currentIndex] ?? this.observations.at(-1);
    this.observationIndex += 1;
    this.afterObservation?.(currentIndex);
    if (value === undefined) return Promise.reject(new Error('fake preflight missing'));
    return Promise.resolve(value);
  }

  public bufferExists(bufferName: string): Promise<boolean> {
    this.operations.push({ kind: 'BUFFER_ABSENT', bufferName });
    this.maybeFail('BUFFER_ABSENT');
    return Promise.resolve(this.buffers.has(bufferName));
  }

  public loadBuffer(bufferName: string, pointerFile: string): Promise<void> {
    this.operations.push({ kind: 'LOAD_BUFFER', bufferName, pointerFile });
    this.maybeFail('LOAD_BUFFER');
    this.buffers.add(bufferName);
    return Promise.resolve();
  }

  public pasteBuffer(bufferName: string): Promise<void> {
    this.operations.push({ kind: 'PASTE_BUFFER', bufferName });
    this.maybeFail('PASTE_BUFFER');
    this.buffers.delete(bufferName);
    return Promise.resolve();
  }

  public sendEnter(): Promise<void> {
    this.operations.push({ kind: 'SEND_ENTER' });
    this.maybeFail('SEND_ENTER');
    return Promise.resolve();
  }

  public deleteBuffer(bufferName: string): Promise<void> {
    this.operations.push({ kind: 'DELETE_BUFFER', bufferName });
    this.maybeFail('DELETE_BUFFER');
    this.buffers.delete(bufferName);
    return Promise.resolve();
  }

  private maybeFail(kind: FakeTmuxOperation['kind']): void {
    if (this.failAt === kind) throw new Error(`synthetic ${kind} failure`);
  }
}

class EvidenceGateway implements AdvisorGateway {
  public readonly leaseId = uuidV7(7_090);
  public receipt: AdvisorGatewayReceipt | undefined;

  public health(): AdvisorGatewayHealth {
    return { adapter: 'TMUX_ADVISOR', status: 'READY', failureCode: 'NONE' };
  }

  public queueAdvisorNotification(request: AdvisorNotificationRequest): Promise<AdvisorGatewayReceipt> {
    const pointerHash = sha256Bytes(canonicalAdvisorPointerEnvelope(request));
    this.receipt = buildAdvisorGatewayReceipt({
      notificationId: request.notificationId,
      adapter: 'TMUX_ADVISOR',
      adapterVersion: 'exact-evidence-test.v1',
      status: 'DELIVERED',
      attempt: 1,
      queuedAt: NOW,
      attemptedAt: NOW,
      transportEvidenceRefs: [`lease:${this.leaseId}`, `pointer:${pointerHash}`],
      failureCode: 'NONE',
    });
    return Promise.resolve(this.receipt);
  }

  public getDeliveryReceipt(notificationId: string): Promise<AdvisorGatewayReceipt | undefined> {
    return Promise.resolve(this.receipt?.notificationId === notificationId ? this.receipt : undefined);
  }
}

function readinessLease(validated: Pick<
  Awaited<ReturnType<ExactAdvisorAuthorityValidator['validateStaticAuthority']>>,
  'registrySnapshotHash' | 'authoritySnapshotHash' | 'activationSnapshotHash'
>) {
  return {
    schemaVersion: 'agent-office.advisor-delivery-readiness.v1',
    leaseId: uuidV7(50),
    activationMissionId: 'AGENT_OFFICE_M01_EXACT_ADVISOR_DELIVERY_ACTIVATION',
    governedMissionId: MISSION_ID,
    issuerRole: 'Advisor',
    issuerSubjectId: 'foundation-advisor',
    destination: {
      sessionName: 'foundation-advisor', sessionId: '$9', windowId: '@9', windowIndex: 0,
      paneIndex: 0, paneId: '%9', workspace: '/home/leo/Project/foundation-advisor',
      currentCommand: 'codex',
    },
    readiness: 'IDLE_FOR_ONE_POINTER',
    useLimit: 1,
    observedAt: '2026-07-10T00:00:09.000Z',
    issuedAt: '2026-07-10T00:00:09.000Z',
    expiresAt: '2026-07-10T00:00:29.000Z',
    registrySnapshotHash: validated.registrySnapshotHash,
    authoritySnapshotHash: validated.authoritySnapshotHash,
    activationSnapshotHash: validated.activationSnapshotHash,
    evidenceRefs: ['advisor-idle-preflight'],
  };
}

function preflight(): ExactTmuxPreflightRecord {
  return {
    sessionName: 'foundation-advisor', sessionId: '$9', windowId: '@9', windowIndex: 0,
    paneIndex: 0, paneId: '%9', workspace: '/home/leo/Project/foundation-advisor',
    currentCommand: 'codex', windowName: 'advisor', panePid: 42, paneDead: false,
    paneInMode: false, inputOff: false, synchronizePanes: false, activityTime: 1,
    observedAt: NOW,
  };
}

function gatewayRequest(seed: number): AdvisorNotificationRequest {
  const requestId = uuidV7(seed + 1);
  const messageArtifactHash = `sha256:${'a'.repeat(64)}`;
  return {
    notificationId: uuidV7(seed + 2),
    requestId,
    missionId: MISSION_ID,
    messageId: uuidV7(seed + 3),
    messageArtifactRef:
      `artifacts/inbox/${MISSION_ID}/${requestId}/${messageArtifactHash.slice(7)}.json`,
    messageArtifactHash,
    messagePayloadHash: `sha256:${'b'.repeat(64)}`,
    persistedEventId: uuidV7(seed + 4),
    persistedMissionSequence: 1,
    correlationId: uuidV7(seed + 5),
  };
}

function runtime(seed: number): AgentOfficeRuntimeIdentity {
  let current = seed;
  return { now: () => NOW, nextId: () => uuidV7(current++) };
}

function bufferNameFor(notificationId: string): string {
  return `ao_${notificationId.replaceAll('-', '')}`;
}

function exactDestination() {
  return {
    sessionName: 'foundation-advisor', sessionId: '$9', windowId: '@9', windowIndex: 0,
    paneIndex: 0, paneId: '%9', workspace: '/home/leo/Project/foundation-advisor',
    currentCommand: 'codex',
  } as const;
}

function evidencePath(
  activation: ExactAdvisorDeliveryActivation,
  messageId: string,
  filename: string,
): string {
  return `${activation.advisorEvidencePrefix}/${messageId}/${filename}`;
}

function parentManifest() {
  const ids = Array.from({ length: 21 }, (_, index) => `AO-WU-${String(index + 1).padStart(2, '0')}`);
  return {
    schemaVersion: 'agent-office.mission-manifest.v1',
    manifestVersion: 5,
    missionId: MISSION_ID,
    approvedBy: 'Leo/GPT',
    counting: { denominator: 21 },
    workUnits: ids.map((id) => ({
      id,
      phase: id === 'AO-WU-15' ? 'FINAL_AUDIT' : 'DELIVERY_IMPLEMENTATION',
      actor: id === 'AO-WU-18' || id === 'AO-WU-20' ? 'Fable5 Reviewer'
        : id === 'AO-WU-16' || id === 'AO-WU-21' || id === 'AO-WU-15'
          ? 'Advisor'
          : 'Agent Office Worker',
      status: id === 'AO-WU-19' ? 'READY'
        : Number(id.slice(-2)) <= 18 ? 'COMPLETED' : 'WAITING_DEPENDENCY',
      dependsOn: id === 'AO-WU-18' ? ['AO-WU-17']
        : id === 'AO-WU-19' ? ['AO-WU-18']
          : id === 'AO-WU-20' ? ['AO-WU-19']
            : id === 'AO-WU-21' ? ['AO-WU-20']
              : id === 'AO-WU-15' ? ['AO-WU-21'] : [],
    })),
  };
}

function contractEvidenceRecords() {
  const artifact = {
    repository: 'foundation-docs', commit: 'a'.repeat(40), path: 'advisor/jobs/evidence.json',
    sha256: `sha256:${'a'.repeat(64)}`,
  };
  const requestId = uuidV7(8_000);
  const messageId = uuidV7(8_001);
  const decisionId = uuidV7(8_002);
  return {
    ack: {
      schemaVersion: 'agent-office.advisor-acknowledgement-evidence.v1',
      missionId: MISSION_ID,
      activationMissionId: 'AGENT_OFFICE_M01_EXACT_ADVISOR_DELIVERY_ACTIVATION',
      requestId,
      messageId,
      notificationId: uuidV7(8_003),
      acknowledgementId: uuidV7(8_004),
      acknowledgedAt: NOW,
      advisorRole: 'Advisor',
      advisorSubjectId: 'foundation-advisor',
      destination: exactDestination(),
      readinessLeaseId: uuidV7(8_005),
      pointerEnvelopeHash: `sha256:${'b'.repeat(64)}`,
      messageArtifactRef: `artifacts/inbox/${MISSION_ID}/${requestId}/${'c'.repeat(64)}.json`,
      messageArtifactHash: `sha256:${'c'.repeat(64)}`,
      transportReceiptHash: `sha256:${'d'.repeat(64)}`,
      artifactReadStatus: 'VERIFIED',
      evidenceRefs: [],
    },
    intake: {
      schemaVersion: 'agent-office.advisor-intake-evidence.v1',
      missionId: MISSION_ID,
      requestId,
      messageId,
      notificationId: uuidV7(8_003),
      intakeId: uuidV7(8_006),
      classification: 'ROUTINE_ROUTE',
      recordedAt: NOW,
      acknowledgementArtifact: artifact,
      messageArtifactHash: `sha256:${'c'.repeat(64)}`,
      referencedWorkUnitIds: ['AO-WU-19'],
      evidenceRefs: [],
    },
    decision: {
      schemaVersion: 'agent-office.advisor-decision-evidence.v1',
      missionId: MISSION_ID,
      requestId,
      messageId,
      decisionId,
      decisionKind: 'ROUTINE_ROUTE',
      authorityRole: 'Advisor',
      authoritySubjectId: 'foundation-advisor',
      scope: { kind: 'WORK_UNIT_SET', workUnitIds: ['AO-WU-19'] },
      decidedAt: NOW,
      intakeArtifact: artifact,
      governingLeoAuthorityArtifact: artifact,
      decisionAuthorityArtifact: artifact,
      decisionCode: 'ROUTE_ALREADY_AUTHORIZED_WORK',
      evidenceRefs: [],
    },
    resume: {
      schemaVersion: 'agent-office.advisor-resume-evidence.v1',
      missionId: MISSION_ID,
      requestId,
      messageId,
      workUnitId: 'AO-WU-19',
      decisionArtifact: artifact,
      intakeArtifact: artifact,
      recordedAt: NOW,
      resumeProof: {
        workUnitId: 'AO-WU-19', waitingEventId: uuidV7(8_007), previousState: 'REVIEW_PENDING',
        resumeTo: 'REVIEW_PENDING', decisionId, decisionArtifactHash: artifact.sha256,
        intakeArtifactHash: artifact.sha256, resolvedBlockerIds: [], expectedStreamVersion: 1,
      },
    },
  };
}
