import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import {
  importMissionManifest,
  parseManifestSourceMetadata,
} from '../../src/domain/manifest/index.js';
import { sha256Bytes } from '../../src/persistence/file-store/hashing.js';
import { loadApprovedManifest } from '../helpers/fixtures.js';

const fixtureRoot = path.resolve(import.meta.dirname, '../../fixtures/manifests');

describe('approved M01 manifest import', () => {
  it('preserves the committed 15-WorkUnit hierarchy and current facts', async () => {
    const manifest = await loadApprovedManifest();
    expect(manifest.missionId).toBe('AGENT_OFFICE_M01_ADVISOR_MANAGED_OFFICE_WEB_CONTROL_PLANE');
    expect(manifest.counting.denominator).toBe(15);
    expect(manifest.workUnits).toHaveLength(15);
    expect(manifest.phases.map((phase) => phase.id)).toEqual([
      'ENTRY',
      'ONBOARDING',
      'DESIGN',
      'DESIGN_REVIEW',
      'DESIGN_PATCH',
      'IMPLEMENTATION_A',
      'IMPLEMENTATION_B',
      'IMPLEMENTATION_C',
      'IMPLEMENTATION_D',
      'IMPLEMENTATION_E',
      'WORKER_RESULT',
      'IMPLEMENTATION_REVIEW',
      'PRIVATE_RUN_VERIFY',
      'FINAL_AUDIT',
    ]);
    expect(manifest.workUnits.find((unit) => unit.id === 'AO-WU-06')).toMatchObject({
      status: 'REVIEWING',
      initialState: 'REVIEW_PENDING',
      initialActivity: 'REVIEW',
      requiredObservableName: 'REVIEWING',
    });
    expect(manifest.workUnits.filter((unit) => unit.initialState === 'COMPLETED')).toHaveLength(5);
    expect(manifest.initiative.labelKo).toBe('AI 운영 오피스');
    expect(manifest.package.labelKo).toBe('Advisor 관리형 웹 컨트롤 플레인');
  });

  it('verifies exact source bytes, commit, path, and hash', async () => {
    const bytes = await readFile(path.join(fixtureRoot, 'agent-office-m01.v1.json'));
    const source = parseManifestSourceMetadata(
      JSON.parse(await readFile(path.join(fixtureRoot, 'agent-office-m01.v1.source.json'), 'utf8')) as unknown,
    );
    expect(sha256Bytes(bytes)).toBe(source.sha256);
    expect(source.commit).toBe('6c9d94f31ae5dd5424b511afb68188681ff95349');
    expect(source.path).toBe(
      'advisor/jobs/20260711_agent_office_m01_advisor_managed_office_web_control_plane/10_MISSION_MANIFEST.json',
    );
    expect(() => importMissionManifest(Buffer.concat([bytes, Buffer.from(' ')]), source)).toThrow(
      expect.objectContaining<Partial<DomainError>>({ code: 'AUTHORITY_ARTIFACT_INVALID' }),
    );
  });

  it('rejects denominator drift and dependency cycles atomically', async () => {
    const bytes = await readFile(path.join(fixtureRoot, 'agent-office-m01.v1.json'));
    const sourceValue = JSON.parse(
      await readFile(path.join(fixtureRoot, 'agent-office-m01.v1.source.json'), 'utf8'),
    ) as Record<string, unknown>;
    const source = parseManifestSourceMetadata(sourceValue);
    const raw = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
    const counting = raw.counting as Record<string, unknown>;
    counting.denominator = 14;
    const changed = Buffer.from(`${JSON.stringify(raw)}\n`);
    expect(() =>
      importMissionManifest(changed, { ...source, sha256: sha256Bytes(changed) }),
    ).toThrow(expect.objectContaining<Partial<DomainError>>({ code: 'INVALID_SCHEMA' }));

    const cycleRaw = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
    const units = cycleRaw.workUnits as Record<string, unknown>[];
    units[0] = { ...units[0], dependsOn: ['AO-WU-15'] };
    const cycleBytes = Buffer.from(`${JSON.stringify(cycleRaw)}\n`);
    expect(() =>
      importMissionManifest(cycleBytes, { ...source, sha256: sha256Bytes(cycleBytes) }),
    ).toThrow(expect.objectContaining<Partial<DomainError>>({ code: 'INVALID_SCHEMA' }));
  });
});
