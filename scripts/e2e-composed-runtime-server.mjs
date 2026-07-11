import { chmod, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { initializeStateRoot } from '../dist/core/persistence/file-store/path-safety.js';
import { startSyntheticBootstrapTestComposition } from '../dist/core/runtime/test-composition.js';
import {
  createCurrentTestObservationRunner,
  createExplicitTestOperationalConfiguration,
} from './runtime-test-fixture.mjs';

const appRoot = path.resolve(import.meta.dirname, '..');
const stateRoot = await mkdtemp(path.join(tmpdir(), 'agent-office-e2e-composed-'));
const proofRoot = await mkdtemp(path.join(tmpdir(), 'agent-office-e2e-bootstrap-proof-'));
const fixedTime = '2026-07-10T00:00:00.000Z';
let idSequence = 20_000;
let opaqueSequence = 0;
let running;

try {
  await initializeStateRoot(stateRoot, {
    stateRootId: 'e2e-composed-disposable',
    initializedAt: fixedTime,
  });
  await chmod(proofRoot, 0o700);
  running = await startSyntheticBootstrapTestComposition({
    configuration: {
      schemaVersion: 'agent-office.loopback-deployment.v2',
      networkMode: 'LOOPBACK_PRIVATE',
      bindAddresses: ['127.0.0.1'],
      port: 4317,
      allowedHosts: ['127.0.0.1:4317'],
      authProvider: 'LOCAL_BOOTSTRAP',
      mutationMode: 'ENABLED_LOCAL_BOOTSTRAP',
      bootstrapProofFile: path.join(proofRoot, 'unused-synthetic-proof.json'),
      cors: false,
      trustProxy: false,
      tls: false,
      hsts: false,
    },
    operationalConfiguration: await createExplicitTestOperationalConfiguration(appRoot),
    readonlyToolRunner: createCurrentTestObservationRunner(appRoot, fixedTime),
    appRoot,
    stateRoot,
    staticRoot: path.join(appRoot, 'dist/dashboard'),
    buildId: 'agent-office-composed-e2e-test',
    runtime: {
      now: () => fixedTime,
      nextId: () => uuidV7(idSequence++),
    },
    identities: ['A', 'B', 'C'].map((prefix, index) => ({
      proof: prefix.repeat(43),
      subjectId: `synthetic-composed-playwright-${index}`,
      capabilities: ['viewer', 'leo_input'],
    })),
    nextOpaque: () => `synthetic_e2e_${String(opaqueSequence++).padStart(32, '0')}`,
  });
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 'agent-office.composed-e2e-server.v1',
    origin: running.composition.primaryOrigin,
    projection: 'LOCAL_BOOTSTRAP_LOGIN_TEST_ONLY',
  })}\n`);
  await waitForSignal();
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    schemaVersion: 'agent-office.composed-e2e-server-error.v1',
    code: error instanceof Error ? error.name.replace(/[^A-Za-z0-9._-]/gu, '_') : 'UNKNOWN',
  })}\n`);
  process.exitCode = 1;
} finally {
  await running?.composition.close().catch(() => undefined);
  await rm(stateRoot, { recursive: true, force: true });
  await rm(proofRoot, { recursive: true, force: true });
}

function uuidV7(sequence) {
  return `018f0000-0000-7000-8000-${sequence.toString(16).padStart(12, '0')}`;
}

function waitForSignal() {
  return new Promise((resolve) => {
    const finish = () => resolve();
    process.once('SIGINT', finish);
    process.once('SIGTERM', finish);
  });
}
