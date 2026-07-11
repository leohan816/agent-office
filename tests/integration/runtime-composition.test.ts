import { createServer } from 'node:net';
import { access, chmod, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import type { SubmitAdvisorMessage } from '../../src/domain/messages/index.js';
import type { AdvisorAlertDetail } from '../../src/application/alerts/index.js';
import type { DecisionAuthorityEvidenceVerifier } from '../../src/application/advisor-inbox/types.js';
import type {
  AdvisorTransportCapability,
  PointerDeliveryOutcome,
  TmuxPointerDeliveryPort,
} from '../../src/adapters/gateways/tmux-advisor/index.js';
import {
  ALERT_POLICIES,
  alertDeduplicationKey,
  type AlertKind,
  type AlertRaisedPayload,
} from '../../src/domain/alerts/index.js';
import { initializeStateRoot } from '../../src/persistence/file-store/path-safety.js';
import { hashCanonical } from '../../src/persistence/file-store/hashing.js';
import type {
  LocalBootstrapPrivateDeploymentConfiguration,
  PrivateDeploymentConfiguration,
} from '../../src/server/config.js';
import { startAgentOfficeComposition } from '../../src/runtime/composition.js';
import type { AgentOfficeRuntimeIdentity } from '../../src/runtime/identity.js';
import { startSyntheticTestComposition } from '../../src/runtime/test-composition.js';
import {
  AgentOfficeRuntimeClient,
  type RuntimeClientState,
  type RuntimeHttpTransport,
} from '../../src/ui/runtime/client.js';
import { FIXED_TIME, MISSION_ID, uuidV7, verifiedEvidence } from '../helpers/fixtures.js';
import {
  currentObservationRunner,
  actualCanonicalOperationalRuntime,
  canonicalManifestRelativePath,
  operationalRuntimeConfiguration,
} from '../helpers/operational-runtime.js';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const temporaryRoots: string[] = [];
const closeables: { close(): Promise<void> }[] = [];
const clients: AgentOfficeRuntimeClient[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) client.stop();
  await Promise.all(closeables.splice(0).map((item) => item.close().catch(() => undefined)));
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('executable loopback composition and production runtime client', () => {
  it('serves the built shell and remains AUTH_BLOCKED/read-only with no provider', async () => {
    const fixture = await compositionPaths();
    const port = await reservePort();
    const configuration = loopbackConfiguration(port);
    const composition = await startAgentOfficeComposition({
      configuration,
      ...fixture,
      buildId: 'runtime-production-test',
      runtime: deterministicRuntime(8000),
    });
    closeables.push(composition);
    const shell = await fetch(composition.primaryOrigin);
    expect(shell.status).toBe(200);
    expect(await shell.text()).toContain('agent-office-built-shell');
    const status = await fetch(`${composition.primaryOrigin}/api/v1/status`);
    expect(await status.json()).toMatchObject({
      networkMode: 'LOOPBACK_PRIVATE',
      startupState: 'AUTH_BLOCKED',
      authMode: 'UNAVAILABLE_READ_ONLY',
      mutationMode: 'DISABLED',
    });
    const projection = await fetch(`${composition.primaryOrigin}/api/v1/projection`);
    expect(projection.status).toBe(503);
    expect(await projection.json()).toMatchObject({ code: 'AUTH_PROVIDER_UNAVAILABLE' });
    const mutation = await fetch(`${composition.primaryOrigin}/api/v1/advisor/messages`, {
      method: 'POST',
      headers: productionMutationHeaders(composition.primaryOrigin),
      body: JSON.stringify(messageCommand(8100)),
    });
    expect(mutation.status).toBe(503);
    expect(await mutation.json()).toMatchObject({ code: 'AUTH_PROVIDER_UNAVAILABLE' });
    expect((await fetch(`${composition.primaryOrigin}/api/v1/workers/dispatch`, {
      method: 'POST',
      headers: productionMutationHeaders(composition.primaryOrigin),
      body: '{}',
    })).status).toBe(404);

    const origin = composition.primaryOrigin;
    await composition.close();
    removeCloseable(composition);
    await expect(fetch(`${origin}/health/live`)).rejects.toThrow();
    await expect(access(path.join(fixture.stateRoot, 'locks', 'writer.lock'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    const restarted = await startAgentOfficeComposition({
      configuration,
      ...fixture,
      buildId: 'runtime-production-restart-test',
      runtime: deterministicRuntime(8200),
    });
    closeables.push(restarted);
    expect((await fetch(`${restarted.primaryOrigin}/health/live`)).status).toBe(200);
  });

  it('runs trusted LocalBootstrap against the actual canonical manifest with no delivery activation or proof disclosure', async () => {
    await assertFixedPortAvailable(4317);
    const fixture = await compositionPaths();
    const canonical = await actualCanonicalOperationalRuntime();
    const proofRoot = await createTemporaryRoot('agent-office-local-bootstrap-proof-');
    await chmod(proofRoot, 0o700);
    const proofDirectory = path.join(proofRoot, 'delivery');
    await mkdir(proofDirectory, { mode: 0o700 });
    const proofPath = path.join(proofDirectory, 'bootstrap.json');
    const runtime = mutableRuntime(15_000);
    const configuration = localBootstrapConfiguration(proofPath);
    const composition = await startAgentOfficeComposition({
      configuration,
      ...fixture,
      operationalConfiguration: canonical.configuration,
      readonlyToolRunner: canonical.runner,
      buildId: 'runtime-local-bootstrap-test',
      runtime,
    });
    closeables.push(composition);
    const delivery = JSON.parse(await readFile(proofPath, 'utf8')) as {
      readonly proof: string;
      readonly origin: string;
    };
    expect(delivery.proof).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(delivery.origin).toBe('http://127.0.0.1:4317');
    expect(composition.readStatus()).toMatchObject({
      startupState: 'MUTATION_READY',
      authMode: 'LOCAL_BOOTSTRAP',
      mutationMode: 'ENABLED_LOCAL_BOOTSTRAP',
      deliveryMode: 'MANUAL_FALLBACK_REQUIRED',
    });
    expect(composition.observations.snapshot().manifest).toMatchObject({
      status: 'VERIFIED',
      evidence: {
        sourceId: 'canonical-foundation-mission-manifest',
        relativePath: canonicalManifestRelativePath,
      },
    });

    const unauthenticated = await fetch(`${composition.primaryOrigin}/api/v1/projection`);
    expect(unauthenticated.status).toBe(401);
    const login = await postJson(
      `${composition.primaryOrigin}/api/v1/auth/local-bootstrap/exchange`,
      { proof: delivery.proof },
      productionMutationHeaders(composition.primaryOrigin),
    );
    expect(login.response.status).toBe(200);
    expect(login.response.url).not.toContain(delivery.proof);
    expect(JSON.stringify(login.value)).not.toContain(delivery.proof);
    const setCookie = login.response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).not.toContain(delivery.proof);
    const cookie = setCookie.split(';')[0] ?? '';
    await expect(access(proofPath)).rejects.toMatchObject({ code: 'ENOENT' });
    const projectionResponse = await fetch(`${composition.primaryOrigin}/api/v1/projection`, {
      headers: { Cookie: cookie },
    });
    const projection = await projectionResponse.json() as {
      readonly missionId: string;
      readonly dashboard: { readonly fixtureKind: string };
      readonly session: { readonly csrfToken: string; readonly capabilities: readonly string[] };
    };
    expect(projectionResponse.status).toBe(200);
    expect(projection).toMatchObject({
      missionId: MISSION_ID,
      dashboard: { fixtureKind: 'APPLICATION_PROJECTION' },
      session: { capabilities: ['viewer', 'leo_input'] },
    });
    const message = await postJson(
      `${composition.primaryOrigin}/api/v1/advisor/messages`,
      { ...messageCommand(15_100), manifestVersion: 2 },
      {
        ...productionMutationHeaders(composition.primaryOrigin),
        Cookie: cookie,
        'X-AO-CSRF': projection.session.csrfToken,
      },
    );
    expect(message.response.status, JSON.stringify(message.value)).toBe(201);
    const messageId = (message.value as { readonly messageId: string }).messageId;
    expect(composition.inbox.project().messages[messageId]?.state).toBe('MANUAL_FALLBACK_REQUIRED');
    expect(await scanPathsForValue(
      [
        fixture.stateRoot,
        fixture.staticRoot,
        path.join(projectRoot, 'src'),
        path.join(projectRoot, 'tests'),
        path.join(projectRoot, 'docs'),
        path.join(projectRoot, 'config'),
        path.join(projectRoot, 'scripts'),
        path.join(projectRoot, 'public'),
      ],
      delivery.proof,
    )).toEqual([]);
    expect(await readFile(path.join(projectRoot, 'README.md'), 'utf8')).not.toContain(delivery.proof);
    expect(await readFile(path.join(projectRoot, 'package.json'), 'utf8')).not.toContain(delivery.proof);

    await composition.close();
    removeCloseable(composition);
    const restarted = await startAgentOfficeComposition({
      configuration,
      ...fixture,
      operationalConfiguration: canonical.configuration,
      readonlyToolRunner: canonical.runner,
      buildId: 'runtime-local-bootstrap-restart-test',
      runtime: mutableRuntime(15_500),
    });
    closeables.push(restarted);
    const replacement = JSON.parse(await readFile(proofPath, 'utf8')) as { readonly proof: string };
    expect(replacement.proof).not.toBe(delivery.proof);
    const replayedProof = await postJson(
      `${restarted.primaryOrigin}/api/v1/auth/local-bootstrap/exchange`,
      { proof: delivery.proof },
      productionMutationHeaders(restarted.primaryOrigin),
    );
    expect(replayedProof.response.status).toBe(401);
    expect(restarted.readStatus().deliveryMode).toBe('MANUAL_FALLBACK_REQUIRED');
    await restarted.close();
    removeCloseable(restarted);
    await expect(access(proofPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects LocalBootstrap startup with a gateway capability or injected delivery port before binding', async () => {
    const fixture = await compositionPaths();
    const canonical = await actualCanonicalOperationalRuntime();
    const proofRoot = await createTemporaryRoot('agent-office-local-bootstrap-reject-');
    await chmod(proofRoot, 0o700);
    const proofDirectory = path.join(proofRoot, 'delivery');
    await mkdir(proofDirectory, { mode: 0o700 });
    const configuration = localBootstrapConfiguration(path.join(proofDirectory, 'proof.json'));
    await expect(startAgentOfficeComposition({
      configuration,
      ...fixture,
      operationalConfiguration: {
        ...canonical.configuration,
        gateway: {
          ...canonical.configuration.gateway,
          capability: approvedCapability(),
        },
      },
      readonlyToolRunner: canonical.runner,
      buildId: 'runtime-local-bootstrap-capability-reject-test',
      runtime: deterministicRuntime(15_800),
    })).rejects.toMatchObject({ code: 'INVALID_SCHEMA' });
    await expect(startAgentOfficeComposition({
      configuration,
      ...fixture,
      operationalConfiguration: canonical.configuration,
      readonlyToolRunner: canonical.runner,
      tmuxDeliveryPort: new RecordingPointerDelivery('DELIVERED'),
      buildId: 'runtime-local-bootstrap-port-reject-test',
      runtime: deterministicRuntime(15_900),
    })).rejects.toMatchObject({ code: 'INVALID_SCHEMA' });
    await expect(access(configuration.bootstrapProofFile)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects a fixture mission manifest in LocalBootstrap mode before creating a proof', async () => {
    const fixture = await compositionPaths();
    const proofRoot = await createTemporaryRoot('agent-office-local-bootstrap-fixture-reject-');
    await chmod(proofRoot, 0o700);
    const proofDirectory = path.join(proofRoot, 'delivery');
    await mkdir(proofDirectory, { mode: 0o700 });
    const configuration = localBootstrapConfiguration(path.join(proofDirectory, 'proof.json'));
    await expect(startAgentOfficeComposition({
      configuration,
      ...fixture,
      buildId: 'runtime-local-bootstrap-fixture-reject-test',
      runtime: deterministicRuntime(15_950),
    })).rejects.toMatchObject({ code: 'AUTHORITY_ARTIFACT_INVALID' });
    await expect(access(configuration.bootstrapProofFile)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('loads an application projection, consumes SSE, and persists one message idempotently through the runtime client', async () => {
    const fixture = await compositionPaths();
    const port = await reservePort();
    const runtime = mutableRuntime(8300);
    let opaque = 0;
    const synthetic = await startSyntheticTestComposition({
      configuration: loopbackConfiguration(port),
      ...fixture,
      buildId: 'runtime-synthetic-test',
      runtime,
      syntheticProof: 'synthetic-runtime-proof-value',
      subjectId: 'synthetic-runtime-subject',
      capabilities: ['viewer', 'leo_input', 'advisor_operator'],
      nextOpaque: () => `synthetic_runtime_${String(opaque++).padStart(32, '0')}`,
      heartbeatMs: 20,
    });
    closeables.push(synthetic.composition);
    const client = new AgentOfficeRuntimeClient({
      origin: synthetic.composition.primaryOrigin,
      transport: syntheticTransport(
        synthetic.composition.primaryOrigin,
        synthetic.session.cookieHandle,
      ),
      reconnectDelayMs: 10,
      now: () => runtime.now(),
      nextRequestId: () => uuidV7(8400),
    });
    clients.push(client);
    await client.start();
    await waitForState(client, (state) => state.sseState === 'READY');
    expect(client.snapshot()).toMatchObject({
      phase: 'PROJECTION_READY',
      projection: {
        revision: 0,
        missionId: MISSION_ID,
        dashboard: { fixtureKind: 'APPLICATION_PROJECTION' },
        communication: { fixtureKind: 'APPLICATION_PROJECTION' },
      },
      subject: { capabilities: ['viewer', 'leo_input', 'advisor_operator'] },
    });
    expect(client.snapshot().projection?.sceneRoles).toHaveLength(8);
    const actionPort = client.communicationActionPort();
    expect(actionPort).toBeDefined();
    const command = messageCommand(8500);
    const first = await actionPort?.submitAdvisorMessage(command);
    expect(first).toMatchObject({ status: 'PERSISTED', replayed: false });
    await waitForState(client, (state) => (state.projection?.revision ?? 0) >= 1);
    const sequenceAfterFirst = synthetic.composition.store.sequence;
    const replay = await actionPort?.submitAdvisorMessage(command);
    expect(replay).toEqual({ ...first, replayed: true });
    expect(synthetic.composition.store.sequence).toBe(sequenceAfterFirst);
    expect(Object.keys(synthetic.composition.inbox.project().messages)).toHaveLength(1);
  });

  it('publishes a deterministic observation refresh when structured actor evidence ages offline', async () => {
    const fixture = await compositionPaths();
    const runtime = mutableRuntime(8_550);
    const port = await reservePort();
    let opaque = 0;
    const synthetic = await startSyntheticTestComposition({
      configuration: loopbackConfiguration(port),
      ...fixture,
      operationalConfiguration: {
        ...fixture.operationalConfiguration,
        refreshIntervalMs: 250,
      },
      buildId: 'runtime-observation-refresh-test',
      runtime,
      syntheticProof: 'synthetic-runtime-refresh-proof',
      subjectId: 'synthetic-runtime-refresh-subject',
      capabilities: ['viewer'],
      nextOpaque: () => `synthetic_refresh_${String(opaque++).padStart(32, '0')}`,
      heartbeatMs: 20,
    });
    closeables.push(synthetic.composition);
    const client = new AgentOfficeRuntimeClient({
      origin: synthetic.composition.primaryOrigin,
      transport: syntheticTransport(
        synthetic.composition.primaryOrigin,
        synthetic.session.cookieHandle,
      ),
      reconnectDelayMs: 10,
    });
    clients.push(client);
    await client.start();
    await waitForState(client, (state) => state.sseState === 'READY');
    expect(client.snapshot().projection?.sceneRoles?.[0]?.connectionState).toBe('CONNECTED');
    runtime.advance(120_000);
    const refreshed = await waitForState(
      client,
      (state) => state.projection?.sceneRoles?.[0]?.connectionState === 'OFFLINE',
      3_000,
    );
    expect(refreshed.projection?.revision).toBeGreaterThan(0);
    expect(refreshed.projection?.dashboard?.banners.some(
      (banner) => banner.presentation === 'UNKNOWN',
    )).toBe(true);
  });

  it('closes SSE and removes mutation capability on session revocation and expiry', async () => {
    for (const mode of ['REVOKE', 'EXPIRE'] as const) {
      const fixture = await compositionPaths();
      const runtime = mutableRuntime(mode === 'REVOKE' ? 8600 : 8700);
      const port = await reservePort();
      let opaque = 0;
      const synthetic = await startSyntheticTestComposition({
        configuration: loopbackConfiguration(port),
        ...fixture,
        buildId: `runtime-session-${mode.toLowerCase()}-test`,
        runtime,
        syntheticProof: `synthetic-runtime-${mode.toLowerCase()}-proof`,
        subjectId: `synthetic-${mode.toLowerCase()}-subject`,
        capabilities: ['viewer', 'leo_input'],
        nextOpaque: () => `synthetic_session_${String(opaque++).padStart(32, '0')}`,
        sessionLifetimeMs: mode === 'EXPIRE' ? 25 : 60_000,
        heartbeatMs: 10,
      });
      closeables.push(synthetic.composition);
      const client = new AgentOfficeRuntimeClient({
        origin: synthetic.composition.primaryOrigin,
        transport: syntheticTransport(
          synthetic.composition.primaryOrigin,
          synthetic.session.cookieHandle,
        ),
        reconnectDelayMs: 10,
      });
      clients.push(client);
      await client.start();
      await waitForState(client, (state) => state.sseState === 'READY');
      expect(client.communicationActionPort()).toBeDefined();
      if (mode === 'REVOKE') await synthetic.sessions.revoke(synthetic.session.cookieHandle);
      else runtime.advance(100);
      await waitForState(client, (state) => state.phase === 'SESSION_EXPIRED');
      expect(client.communicationActionPort()).toBeUndefined();
      expect(synthetic.composition.sse.connectionCount()).toBe(0);
      client.stop();
      removeClient(client);
      await synthetic.composition.close();
      removeCloseable(synthetic.composition);
    }
  });

  it('runs the composed Advisor pointer, receipt, acknowledgement, intake, decision, and resume loop once', async () => {
    const fixture = await compositionPaths(approvedCapability());
    const port = await reservePort();
    const runtime = deterministicRuntime(13_000);
    const delivery = new RecordingPointerDelivery('DELIVERED');
    let opaque = 0;
    const synthetic = await startSyntheticTestComposition({
      configuration: loopbackConfiguration(port),
      ...fixture,
      buildId: 'runtime-approved-advisor-loop-test',
      runtime,
      syntheticProof: 'synthetic-approved-advisor-loop-proof',
      subjectId: 'synthetic-approved-advisor-subject',
      capabilities: ['viewer', 'leo_input', 'advisor_operator'],
      nextOpaque: () => `synthetic_loop_${String(opaque++).padStart(32, '0')}`,
      tmuxDeliveryPort: delivery,
      authorityEvidenceVerifier: acceptingRuntimeAuthorityVerifier(),
    });
    closeables.push(synthetic.composition);
    const waiting = await synthetic.composition.store.append({
      eventId: uuidV7(13_100),
      eventType: 'WorkUnitStateTransitioned',
      requestId: uuidV7(13_101),
      correlationId: uuidV7(13_102),
      causationId: uuidV7(13_103),
      actor: { role: 'Advisor', subjectId: 'advisor-loop-test' },
      occurredAt: FIXED_TIME,
      receivedAt: FIXED_TIME,
      recordedAt: FIXED_TIME,
      expectedStreamVersion: 0,
      expectedManifestVersion: 1,
      payload: { workUnitId: 'AO-WU-06', from: 'REVIEW_PENDING', to: 'WAITING_LEO' },
    });
    const headers = syntheticMutationHeaders(synthetic);
    const command: SubmitAdvisorMessage = {
      ...messageCommand(13_110),
      referencedEntityIds: ['AO-WU-06'],
    };
    const submitted = await postJson(
      `${synthetic.composition.primaryOrigin}/api/v1/advisor/messages`,
      command,
      headers,
    );
    expect(submitted.response.status).toBe(201);
    const receipt = submitted.value as {
      readonly messageId: string;
      readonly messageArtifactRef: string;
      readonly messageArtifactHash: string;
      readonly replayed: boolean;
    };
    expect(receipt.replayed).toBe(false);
    expect(delivery.deliveries).toHaveLength(1);
    expect(delivery.deliveries[0]?.pointerEnvelope).toContain(
      `"messageArtifactRef":"${receipt.messageArtifactRef}"`,
    );
    expect(delivery.deliveries[0]?.pointerEnvelope).toContain(
      `"messageArtifactHash":"${receipt.messageArtifactHash}"`,
    );
    expect(delivery.deliveries[0]?.pointerEnvelope).not.toContain(command.bodyText);
    expect(JSON.parse(delivery.deliveries[0]?.pointerEnvelope ?? '{}')).toMatchObject({
      schemaVersion: 'agent-office.advisor-pointer-envelope.v1',
      missionId: MISSION_ID,
      messageId: receipt.messageId,
    });
    const sequenceAfterDelivery = synthetic.composition.store.sequence;
    const replay = await postJson(
      `${synthetic.composition.primaryOrigin}/api/v1/advisor/messages`,
      command,
      headers,
    );
    expect(replay.response.status).toBe(201);
    expect(replay.value).toMatchObject({ messageId: receipt.messageId, replayed: true });
    expect(delivery.deliveries).toHaveLength(1);
    expect(synthetic.composition.store.sequence).toBe(sequenceAfterDelivery);

    const acknowledgement = await postJson(
      `${synthetic.composition.primaryOrigin}/api/v1/advisor/messages/${receipt.messageId}/ack`,
      {
        requestId: uuidV7(13_120),
        acknowledgementId: uuidV7(13_121),
        acknowledgedAt: FIXED_TIME,
        evidenceRefs: ['approved-test-delivery-receipt'],
      },
      headers,
    );
    expect(acknowledgement.response.status).toBe(200);
    const intake = await postJson(
      `${synthetic.composition.primaryOrigin}/api/v1/advisor/intakes`,
      {
        requestId: uuidV7(13_130),
        messageId: receipt.messageId,
        intakeId: uuidV7(13_131),
        classification: 'NEEDS_LEO_DECISION',
        recordedAt: FIXED_TIME,
        evidenceRefs: ['canonical-advisor-intake'],
      },
      headers,
    );
    expect(intake.response.status).toBe(200);
    const decisionId = uuidV7(13_141);
    const decisionArtifact = {
      repository: 'foundation-docs',
      commit: 'd'.repeat(40),
      path: 'advisor/jobs/synthetic-approved-decision.md',
      sha256: `sha256:${'e'.repeat(64)}`,
    };
    const decision = await postJson(
      `${synthetic.composition.primaryOrigin}/api/v1/decisions`,
      {
        requestId: uuidV7(13_140),
        messageId: receipt.messageId,
        decisionId,
        authorityRole: 'Leo/GPT',
        decisionArtifact,
        recordedAt: FIXED_TIME,
      },
      headers,
    );
    expect(decision.response.status).toBe(200);
    const linked = synthetic.composition.inbox.project().messages[receipt.messageId];
    const intakeHash = hashFromArtifactRef(linked?.intakeArtifactRef);
    await synthetic.composition.inbox.recordResumeProof(
      {
        requestId: uuidV7(13_150),
        messageId: receipt.messageId,
        from: 'WAITING_LEO',
        recordedAt: FIXED_TIME,
        proof: {
          workUnitId: 'AO-WU-06',
          waitingEventId: waiting.event.eventId,
          previousState: 'REVIEW_PENDING',
          resumeTo: 'REVIEW_PENDING',
          decisionId,
          decisionArtifactHash: decisionArtifact.sha256,
          intakeArtifactHash: intakeHash,
          resolvedBlockerIds: [],
          expectedStreamVersion: synthetic.composition.store.sequence,
        },
      },
      runtimeAdvisorContext(13_160),
    );
    const resumed = synthetic.composition.inbox.project().messages[receipt.messageId];
    expect(resumed?.resumeProofArtifactRef).toMatch(/^artifacts\/resume-proofs\//u);
    expect(synthetic.composition.store.readAll().at(-1)).toMatchObject({
      eventType: 'WorkUnitStateTransitioned',
      payload: { workUnitId: 'AO-WU-06', from: 'WAITING_LEO', to: 'REVIEW_PENDING' },
    });
    expect(synthetic.composition.readStatus().deliveryMode).toBe('ENABLED');
  });

  it.each([
    ['NO_CAPABILITY', undefined, 'MANUAL_FALLBACK_REQUIRED'],
    ['KILL_SWITCH', approvedCapability({ killSwitch: 'ENGAGED' }), 'MANUAL_FALLBACK_REQUIRED'],
    ['AMBIGUOUS', approvedCapability(), 'MANUAL_FALLBACK_REQUIRED'],
  ] as const)('fails the composed gateway closed for %s', async (mode, capability, expectedState) => {
    const fixture = await compositionPaths(capability);
    const port = await reservePort();
    let opaque = 0;
    const delivery = new RecordingPointerDelivery(mode === 'AMBIGUOUS' ? 'AMBIGUOUS' : 'DELIVERED');
    const synthetic = await startSyntheticTestComposition({
      configuration: loopbackConfiguration(port),
      ...fixture,
      buildId: `runtime-gateway-${mode.toLowerCase()}-test`,
      runtime: deterministicRuntime(mode === 'NO_CAPABILITY' ? 14_000 : mode === 'KILL_SWITCH' ? 14_100 : 14_200),
      syntheticProof: `synthetic-gateway-${mode.toLowerCase()}-proof`,
      subjectId: `synthetic-gateway-${mode.toLowerCase()}-subject`,
      capabilities: ['viewer', 'leo_input', 'advisor_operator'],
      nextOpaque: () => `synthetic_gateway_${String(opaque++).padStart(32, '0')}`,
      tmuxDeliveryPort: delivery,
    });
    closeables.push(synthetic.composition);
    const submitted = await postJson(
      `${synthetic.composition.primaryOrigin}/api/v1/advisor/messages`,
      messageCommand(mode === 'NO_CAPABILITY' ? 14_010 : mode === 'KILL_SWITCH' ? 14_110 : 14_210),
      syntheticMutationHeaders(synthetic),
    );
    expect(submitted.response.status).toBe(201);
    const messageId = (submitted.value as { readonly messageId: string }).messageId;
    expect(synthetic.composition.inbox.project().messages[messageId]?.state).toBe(expectedState);
    expect(delivery.deliveries).toHaveLength(mode === 'AMBIGUOUS' ? 1 : 0);
  });

  it('projects durable open, resolved, and suppressed alerts with structured detail idempotently', async () => {
    const fixture = await compositionPaths();
    const runtime = deterministicRuntime(12_000);
    const port = await reservePort();
    let opaque = 0;
    const synthetic = await startSyntheticTestComposition({
      configuration: loopbackConfiguration(port),
      ...fixture,
      buildId: 'runtime-alert-projection-test',
      runtime,
      syntheticProof: 'synthetic-runtime-alert-proof',
      subjectId: 'synthetic-alert-subject',
      capabilities: ['viewer', 'leo_input', 'advisor_operator'],
      nextOpaque: () => `synthetic_alert_${String(opaque++).padStart(32, '0')}`,
    });
    closeables.push(synthetic.composition);
    const openRequestId = uuidV7(12_100);
    const openPayload = runtimeAlertPayload(
      'MISSION_FAILED',
      openRequestId,
      synthetic.composition.store.sequence,
      12_110,
    );
    const open = await synthetic.composition.alerts.raise(
      openPayload,
      runtimeAlertDetail(openRequestId),
      runtimeAlertContext(12_120),
    );
    const sequenceAfterOpen = synthetic.composition.store.sequence;
    await expect(synthetic.composition.alerts.raise(
      openPayload,
      runtimeAlertDetail(openRequestId),
      runtimeAlertContext(12_120),
    )).resolves.toEqual(open);
    expect(synthetic.composition.store.sequence).toBe(sequenceAfterOpen);

    const resolvedRequestId = uuidV7(12_200);
    const resolved = await synthetic.composition.alerts.raise(
      runtimeAlertPayload(
        'NEEDS_LEO_DECISION',
        resolvedRequestId,
        synthetic.composition.store.sequence,
        12_210,
      ),
      runtimeAlertDetail(resolvedRequestId),
      runtimeAlertContext(12_220),
    );
    await synthetic.composition.alerts.resolve(
      {
        requestId: uuidV7(12_230),
        alertId: resolved.alertId,
        recordedAt: FIXED_TIME,
        reasonCode: 'VERIFIED_DECISION_LINKED',
        evidenceRefs: ['decision:verified'],
      },
      runtimeAlertContext(12_240),
    );

    const suppressedRequestId = uuidV7(12_300);
    const suppressed = await synthetic.composition.alerts.raise(
      runtimeAlertPayload(
        'INFORMATION',
        suppressedRequestId,
        synthetic.composition.store.sequence,
        12_310,
      ),
      runtimeAlertDetail(suppressedRequestId),
      runtimeAlertContext(12_320),
    );
    await synthetic.composition.alerts.suppress(
      {
        requestId: uuidV7(12_330),
        alertId: suppressed.alertId,
        recordedAt: FIXED_TIME,
        reasonCode: 'DUPLICATE_INFORMATION',
      },
      runtimeAlertContext(12_340),
    );

    const response = await fetch(`${synthetic.composition.primaryOrigin}/api/v1/projection`, {
      headers: { Cookie: `AO_SESSION=${synthetic.session.cookieHandle}` },
    });
    const projection = await response.json() as {
      readonly openAlertIds: readonly string[];
      readonly communication: {
        readonly alerts: readonly {
          readonly alertId: string;
          readonly state: string;
          readonly detail: AdvisorAlertDetail;
        }[];
      };
    };
    expect(response.status).toBe(200);
    expect(projection.openAlertIds).toEqual([open.alertId]);
    expect(projection.communication.alerts.map((alert) => [alert.alertId, alert.state])).toEqual([
      [open.alertId, 'OPEN'],
      [resolved.alertId, 'RESOLVED'],
      [suppressed.alertId, 'SUPPRESSED'],
    ].sort((left, right) => String(left[0]).localeCompare(String(right[0]))));
    expect(projection.communication.alerts[0]?.detail).toMatchObject({
      question: 'Should this bounded condition remain on hold?',
      safeDefault: 'HOLD',
      blockedCapability: 'WORK_RESUME',
    });
    expect(JSON.stringify(projection)).not.toContain(projectRoot);
  });

  it('keeps the synthetic UI behind the explicit test-demo build mode', async () => {
    const [main, demo, vite, playwright, cli] = await Promise.all([
      readFile(path.join(projectRoot, 'src/ui/main.tsx'), 'utf8'),
      readFile(path.join(projectRoot, 'src/ui/demo-entry.tsx'), 'utf8'),
      readFile(path.join(projectRoot, 'vite.config.ts'), 'utf8'),
      readFile(path.join(projectRoot, 'playwright.config.ts'), 'utf8'),
      readFile(path.join(projectRoot, 'src/runtime/cli.ts'), 'utf8'),
    ]);
    expect(main).toContain("from 'virtual:agent-office-entry'");
    expect(main).not.toContain("./fixtures/dashboard.js");
    expect(main).not.toContain("./communication/fixtures.js");
    expect(demo).toContain('CURRENT_DASHBOARD_VIEW_MODEL');
    expect(vite).toContain("mode === 'test-demo'");
    expect(vite).toContain('src/ui/runtime/entry.tsx');
    expect(vite).toContain('src/ui/demo-entry.tsx');
    expect(playwright).toContain('build:dashboard:test');
    expect(cli).toContain('--runtime-config');
    expect(cli).not.toContain('fixtures/manifests');
    expect(await readFile(path.join(projectRoot, 'src/ui/runtime/runtime-app.tsx'), 'utf8'))
      .not.toContain('showOfficeScene={false}');
  });
});

async function compositionPaths(capability?: AdvisorTransportCapability) {
  const root = await createTemporaryRoot('agent-office-composition-');
  const stateRoot = path.join(root, 'state');
  const staticRoot = path.join(root, 'built-dashboard');
  await initializeStateRoot(stateRoot, {
    stateRootId: `composition-${path.basename(root)}`,
    initializedAt: FIXED_TIME,
  });
  await createBuiltShell(staticRoot);
  return {
    appRoot: projectRoot,
    stateRoot,
    staticRoot,
    operationalConfiguration: await operationalRuntimeConfiguration(capability),
    readonlyToolRunner: currentObservationRunner(),
  };
}

class RecordingPointerDelivery implements TmuxPointerDeliveryPort {
  public readonly deliveries: {
    readonly capabilityId: string;
    readonly notificationId: string;
    readonly pointerEnvelope: string;
  }[] = [];

  public constructor(private readonly mode: 'DELIVERED' | 'AMBIGUOUS') {}

  public deliverPointer(input: {
    readonly capabilityId: string;
    readonly notificationId: string;
    readonly pointerEnvelope: string;
  }): Promise<PointerDeliveryOutcome> {
    this.deliveries.push(input);
    return Promise.resolve(this.outcome());
  }

  public lookupPointerReceipt(): Promise<PointerDeliveryOutcome | 'NOT_FOUND'> {
    return Promise.resolve(this.outcome());
  }

  private outcome(): PointerDeliveryOutcome {
    return this.mode === 'DELIVERED'
      ? { status: 'DELIVERED', evidenceRefs: ['approved-test-pointer-receipt'] }
      : {
          status: 'AMBIGUOUS',
          failureCode: 'DELIVERY_RECEIPT_AMBIGUOUS',
          evidenceRefs: ['ambiguous-test-pointer-receipt'],
        };
  }
}

function approvedCapability(
  override: Partial<AdvisorTransportCapability> = {},
): AdvisorTransportCapability {
  return {
    schemaVersion: 'agent-office.advisor-transport-capability.v1',
    capabilityId: uuidV7(13_001),
    logicalRoute: 'ADVISOR_ONLY',
    transport: 'TMUX',
    state: 'ACTIVE',
    killSwitch: 'DISENGAGED',
    synchronization: 'SINGLE_PREVALIDATED_DESTINATION',
    issuedAt: FIXED_TIME,
    expiresAt: '2026-07-10T01:00:00.000Z',
    authoritySnapshotHash: `sha256:${'1'.repeat(64)}`,
    activationSnapshotHash: `sha256:${'2'.repeat(64)}`,
    registrySnapshotHash: `sha256:${'3'.repeat(64)}`,
    ...override,
  };
}

function acceptingRuntimeAuthorityVerifier(): DecisionAuthorityEvidenceVerifier {
  return {
    verify: (input) => {
      const core = {
        schemaVersion: 'agent-office.verified-decision-authority.v1' as const,
        decisionId: input.decisionId,
        missionId: input.missionId,
        authorityRole: input.authorityRole,
        authoritySubjectId: 'leo-gpt-runtime-test',
        scope: {
          kind: 'WORK_UNIT_SET' as const,
          workUnitIds: [...input.expectedWorkUnitIds].sort(),
        },
        decidedAt: FIXED_TIME,
        decisionArtifact: input.decisionArtifact,
        verifiedAt: FIXED_TIME,
        verifierId: 'runtime-authority-test-verifier',
      };
      return Promise.resolve({ ...core, evidenceHash: hashCanonical(core) });
    },
  };
}

function syntheticMutationHeaders(synthetic: {
  readonly composition: { readonly primaryOrigin: string };
  readonly session: { readonly cookieHandle: string; readonly csrfToken: string };
}): Readonly<Record<string, string>> {
  return {
    Cookie: `AO_SESSION=${synthetic.session.cookieHandle}`,
    Origin: synthetic.composition.primaryOrigin,
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Content-Type': 'application/json; charset=utf-8',
    'X-AO-CSRF': synthetic.session.csrfToken,
  };
}

async function postJson(
  url: string,
  body: unknown,
  headers: Readonly<Record<string, string>>,
): Promise<{ readonly response: Response; readonly value: unknown }> {
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  return { response, value: await response.json() as unknown };
}

function hashFromArtifactRef(reference: string | undefined): string {
  if (reference === undefined) throw new Error('artifact reference is missing');
  const filename = reference.split('/').at(-1);
  if (filename === undefined || !/^[0-9a-f]{64}\.json$/u.test(filename)) {
    throw new Error('artifact reference hash is invalid');
  }
  return `sha256:${filename.slice(0, -'.json'.length)}`;
}

function runtimeAdvisorContext(base: number) {
  return {
    actor: { role: 'Advisor' as const, subjectId: 'advisor-runtime-test' },
    correlationId: uuidV7(base),
    causationId: uuidV7(base + 1),
    receivedAt: FIXED_TIME,
  };
}

async function createTemporaryRoot(prefix: string): Promise<string> {
  const { mkdtemp } = await import('node:fs/promises');
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

async function createBuiltShell(root: string): Promise<void> {
  await mkdir(path.join(root, 'assets'), { recursive: true });
  await mkdir(path.join(root, 'icons'), { recursive: true });
  await writeFile(
    path.join(root, 'index.html'),
    '<!doctype html><title>agent-office-built-shell</title><script type="module" src="/assets/app-12345678.js"></script>',
  );
  await writeFile(path.join(root, 'assets/app-12345678.js'), 'globalThis.__AO_BUILT_SHELL__ = true;');
  await writeFile(path.join(root, 'manifest.webmanifest'), '{"name":"Agent Office"}');
  await writeFile(path.join(root, 'sw.js'), 'self.addEventListener("fetch", () => {});');
  await writeFile(path.join(root, 'icons/agent-office.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await writeFile(path.join(root, 'icons/agent-office-maskable.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
}

function loopbackConfiguration(port: number): PrivateDeploymentConfiguration {
  return {
    schemaVersion: 'agent-office.loopback-deployment.v1',
    networkMode: 'LOOPBACK_PRIVATE',
    bindAddresses: ['127.0.0.1'],
    port,
    allowedHosts: [`127.0.0.1:${port}`],
    authProvider: 'NONE_READ_ONLY',
    mutationMode: 'DISABLED',
    cors: false,
    trustProxy: false,
    tls: false,
    hsts: false,
  };
}

function localBootstrapConfiguration(
  bootstrapProofFile: string,
): LocalBootstrapPrivateDeploymentConfiguration {
  return {
    schemaVersion: 'agent-office.loopback-deployment.v2',
    networkMode: 'LOOPBACK_PRIVATE',
    bindAddresses: ['127.0.0.1'],
    port: 4317,
    allowedHosts: ['127.0.0.1:4317'],
    authProvider: 'LOCAL_BOOTSTRAP',
    mutationMode: 'ENABLED_LOCAL_BOOTSTRAP',
    bootstrapProofFile,
    cors: false,
    trustProxy: false,
    tls: false,
    hsts: false,
  };
}

function productionMutationHeaders(origin: string): Readonly<Record<string, string>> {
  return {
    Origin: origin,
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Content-Type': 'application/json; charset=utf-8',
    'X-AO-CSRF': 'synthetic-value-cannot-authorize',
  };
}

function syntheticTransport(
  origin: string,
  cookieHandle: string,
): RuntimeHttpTransport {
  return {
    fetch: (input, init = {}) => {
      const headers = new Headers(init.headers);
      headers.set('Cookie', `AO_SESSION=${cookieHandle}`);
      if (init.method === 'POST') {
        headers.set('Origin', origin);
        headers.set('Sec-Fetch-Site', 'same-origin');
        headers.set('Sec-Fetch-Mode', 'cors');
      }
      return fetch(input, { ...init, headers });
    },
  };
}

function messageCommand(sequence: number): SubmitAdvisorMessage {
  return {
    requestId: uuidV7(sequence),
    missionId: MISSION_ID,
    manifestVersion: 1,
    kind: 'CLARIFICATION',
    subject: 'Synthetic composed-runtime message',
    bodyText: 'Synthetic browser client input persists through the real application path.',
    referencedEntityIds: ['AO-WU-11'],
    clientCreatedAt: FIXED_TIME,
  };
}

function runtimeAlertPayload(
  kind: AlertKind,
  requestId: string,
  expectedStreamVersion: number,
  idBase: number,
): AlertRaisedPayload {
  const input = {
    missionId: MISSION_ID,
    kind,
    primaryEntityRef: { entityType: 'WORK_UNIT' as const, entityId: 'AO-WU-11' },
    conditionKey: `RUNTIME-${kind}`,
    manifestVersion: 1,
  };
  return {
    alertId: uuidV7(idBase),
    ...input,
    severity: ALERT_POLICIES[kind].severity,
    relatedEntityRefs: [],
    titleKey: `alert.${kind}`,
    messageParameters: {},
    actionCodes: kind === 'INFORMATION' ? [] : ALERT_POLICIES[kind].actionCodes,
    sourceEventIds: [uuidV7(idBase + 1)],
    evidenceRefs: kind === 'INFORMATION' ? [] : [verifiedEvidence('RUNTIME_ALERT')],
    deduplicationKey: alertDeduplicationKey(input),
    firstObservedAt: FIXED_TIME,
    lastObservedAt: FIXED_TIME,
    occurrenceCount: 1,
    resolutionCondition: 'Verified structured evidence resolves this condition.',
    requestId,
    expectedStreamVersion,
    causationId: uuidV7(idBase + 2),
    correlationId: uuidV7(idBase + 3),
  };
}

function runtimeAlertDetail(requestId: string): AdvisorAlertDetail {
  return {
    initiativeId: 'INITIATIVE-AGENT-OFFICE',
    packageId: 'PACKAGE-M01',
    missionId: MISSION_ID,
    requestId,
    phaseId: 'IMPLEMENTATION_E',
    workUnitId: 'AO-WU-11',
    confirmedFacts: ['The runtime condition is structured and durable.'],
    unknowns: ['No authority decision is linked yet.'],
    question: 'Should this bounded condition remain on hold?',
    options: ['Remain on hold', 'Resume after verified evidence'],
    recommendation: 'Remain on hold until verified evidence is linked.',
    safeDefault: 'HOLD',
    blockedCapability: 'WORK_RESUME',
    blockerReason: 'AUTHORITY_EVIDENCE_MISSING',
    resolutionOwner: 'LEO_GPT',
    nextAction: 'LINK_VERIFIED_DECISION',
    evidenceRefs: ['runtime-alert:evidence'],
  };
}

function runtimeAlertContext(base: number) {
  return {
    actor: { role: 'Leo/GPT' as const, subjectId: 'leo-runtime-test' },
    correlationId: uuidV7(base),
    causationId: uuidV7(base + 1),
    receivedAt: FIXED_TIME,
  };
}

function deterministicRuntime(start: number): AgentOfficeRuntimeIdentity {
  let next = start;
  return { now: () => FIXED_TIME, nextId: () => uuidV7(next++) };
}

function mutableRuntime(start: number): AgentOfficeRuntimeIdentity & { advance(milliseconds: number): void } {
  let next = start;
  let nowMs = Date.parse(FIXED_TIME);
  return {
    now: () => new Date(nowMs).toISOString(),
    nextId: () => uuidV7(next++),
    advance: (milliseconds) => {
      nowMs += milliseconds;
    },
  };
}

async function reservePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('test listener address missing');
  await new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error)));
  return address.port;
}

async function assertFixedPortAvailable(port: number): Promise<void> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error === undefined ? resolve() : reject(error)));
}

async function scanPathsForValue(roots: readonly string[], value: string): Promise<readonly string[]> {
  const matches: string[] = [];
  for (const root of roots) {
    const entries = await readdir(root, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const parentPath = entry.parentPath;
      const filePath = path.join(parentPath, entry.name);
      const bytes = await readFile(filePath);
      if (bytes.includes(Buffer.from(value, 'utf8'))) matches.push(filePath);
    }
  }
  return matches;
}

async function waitForState(
  client: AgentOfficeRuntimeClient,
  predicate: (state: RuntimeClientState) => boolean,
  timeoutMs = 2_000,
): Promise<RuntimeClientState> {
  if (predicate(client.snapshot())) return client.snapshot();
  return new Promise((resolve, reject) => {
    let unsubscribe = (): void => undefined;
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`runtime state timeout: ${JSON.stringify(client.snapshot())}`));
    }, timeoutMs);
    unsubscribe = client.subscribe((state) => {
      if (!predicate(state)) return;
      clearTimeout(timeout);
      unsubscribe();
      resolve(state);
    });
  });
}

function removeCloseable(closeable: { close(): Promise<void> }): void {
  const index = closeables.indexOf(closeable);
  if (index >= 0) closeables.splice(index, 1);
}

function removeClient(client: AgentOfficeRuntimeClient): void {
  const index = clients.indexOf(client);
  if (index >= 0) clients.splice(index, 1);
}
