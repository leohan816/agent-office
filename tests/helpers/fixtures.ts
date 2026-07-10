import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { JsonValue } from '../../src/contracts/types.js';
import type { AppendEventRequest } from '../../src/persistence/file-store/event-store.js';
import { initializeStateRoot } from '../../src/persistence/file-store/path-safety.js';
import {
  importMissionManifest,
  parseManifestSourceMetadata,
  type MissionManifest,
} from '../../src/domain/manifest/index.js';

export const FIXED_TIME = '2026-07-10T00:00:00.000Z';
export const MISSION_ID = 'AGENT_OFFICE_M01_ADVISOR_MANAGED_OFFICE_WEB_CONTROL_PLANE';

const projectRoot = path.resolve(import.meta.dirname, '../..');

export function uuidV7(sequence: number): string {
  return `018f0000-0000-7000-8000-${sequence.toString(16).padStart(12, '0')}`;
}

export async function loadApprovedManifest(): Promise<MissionManifest> {
  const manifestBytes = await readFile(
    path.join(projectRoot, 'fixtures/manifests/agent-office-m01.v1.json'),
  );
  const source = parseManifestSourceMetadata(
    JSON.parse(
      await readFile(
        path.join(projectRoot, 'fixtures/manifests/agent-office-m01.v1.source.json'),
        'utf8',
      ),
    ) as unknown,
  );
  return importMissionManifest(manifestBytes, source);
}

export async function makeStateRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'agent-office-test-'));
  await initializeStateRoot(root, { stateRootId: 'test-state-root', initializedAt: FIXED_TIME });
  return root;
}

export function appendRequest<TPayload extends JsonValue>(
  sequence: number,
  eventType: AppendEventRequest<TPayload>['eventType'],
  payload: TPayload,
  expectedStreamVersion = sequence - 1,
): AppendEventRequest<TPayload> {
  return {
    eventId: uuidV7(sequence * 10 + 1),
    eventType,
    requestId: uuidV7(sequence * 10 + 2),
    correlationId: uuidV7(sequence * 10 + 3),
    causationId: uuidV7(sequence * 10 + 4),
    actor: { role: 'Advisor', subjectId: 'advisor-test' },
    occurredAt: FIXED_TIME,
    receivedAt: FIXED_TIME,
    recordedAt: FIXED_TIME,
    expectedStreamVersion,
    expectedManifestVersion: 1,
    payload,
  };
}

export function verifiedEvidence(kind = 'TEST_RESULT') {
  return {
    artifactId: 'ARTIFACT-1',
    kind,
    repository: 'agent-office',
    commit: 'a'.repeat(40),
    path: 'results/test.json',
    sha256: `sha256:${'1'.repeat(64)}`,
    producerRole: 'Agent Office Worker' as const,
    producedAt: FIXED_TIME,
    verifiedAt: FIXED_TIME,
    verifier: 'Advisor',
    freshnessPolicyId: 'IMMUTABLE',
    verificationStatus: 'VERIFIED' as const,
  };
}
