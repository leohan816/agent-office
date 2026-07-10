import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { replayMission } from '../../src/application/projections/mission-projector.js';
import { createEvent } from '../../src/domain/events/index.js';
import {
  assertScopeChange,
  type MissionManifest,
  type WorkUnitManifest,
} from '../../src/domain/manifest/index.js';
import { FIXED_TIME, MISSION_ID, loadApprovedManifest, uuidV7 } from '../helpers/fixtures.js';

function hash(digit: string): string {
  return `sha256:${digit.repeat(64)}`;
}

function nextManifest(previous: MissionManifest, addedCount: number): MissionManifest {
  const added = Array.from({ length: addedCount }, (_, index): WorkUnitManifest => ({
    id: `AO-EXTRA-${String(index + 1).padStart(3, '0')}`,
    phase: 'FUTURE_APPROVED',
    actor: 'Agent Office Worker',
    title: `Approved extra ${index + 1}`,
    status: 'QUEUED',
    dependsOn: [],
    initialState: 'QUEUED',
    requiredObservableName: 'QUEUED',
  }));
  return {
    ...previous,
    manifestVersion: previous.manifestVersion + 1,
    source: { ...previous.source, sha256: hash('2') },
    counting: { ...previous.counting, denominator: previous.workUnits.length + added.length },
    phases: [
      ...previous.phases,
      { id: 'FUTURE_APPROVED', order: previous.phases.length + 1, workUnitIds: added.map((unit) => unit.id) },
    ],
    workUnits: [...previous.workUnits, ...added],
  };
}

describe('scope counting properties', () => {
  it('accepts exact consecutive scope additions across a deterministic input range', async () => {
    const previous = await loadApprovedManifest();
    for (let addedCount = 1; addedCount <= 64; addedCount += 1) {
      const next = nextManifest(previous, addedCount);
      const addedWorkUnitIds = next.workUnits.slice(previous.workUnits.length).map((unit) => unit.id);
      expect(() =>
        assertScopeChange(previous, next, {
          fromManifestVersion: 1,
          toManifestVersion: 2,
          oldTotal: 15,
          newTotal: 15 + addedCount,
          addedWorkUnitIds,
          removedWorkUnitIds: [],
          changedWorkUnitIds: [],
          reason: 'Explicit approved scope expansion fixture',
          approvingAuthority: 'Leo/GPT',
          authorityArtifactRef: {
            repository: 'foundation-docs',
            commit: 'b'.repeat(40),
            path: 'decisions/scope.json',
            sha256: hash('3'),
          },
          oldManifestHash: previous.source.sha256,
          newManifestHash: next.source.sha256,
        }),
      ).not.toThrow();
    }
  });

  it('rejects any unexplained member or denominator drift', async () => {
    const previous = await loadApprovedManifest();
    const next = nextManifest(previous, 2);
    const base = {
      fromManifestVersion: 1,
      toManifestVersion: 2,
      oldTotal: 15,
      newTotal: 17,
      addedWorkUnitIds: ['AO-EXTRA-001', 'AO-EXTRA-002'],
      removedWorkUnitIds: [],
      changedWorkUnitIds: [],
      reason: 'Explicit approved scope expansion fixture',
      approvingAuthority: 'Leo/GPT',
      authorityArtifactRef: {
        repository: 'foundation-docs',
        commit: 'b'.repeat(40),
        path: 'decisions/scope.json',
        sha256: hash('3'),
      },
      oldManifestHash: previous.source.sha256,
      newManifestHash: next.source.sha256,
    } as const;
    expect(() => assertScopeChange(previous, next, { ...base, newTotal: 16 })).toThrow(
      expect.objectContaining<Partial<DomainError>>({ code: 'MANIFEST_VERSION_CONFLICT' }),
    );
    expect(() =>
      assertScopeChange(previous, next, { ...base, addedWorkUnitIds: ['AO-EXTRA-001'] }),
    ).toThrow(expect.objectContaining<Partial<DomainError>>({ code: 'MANIFEST_VERSION_CONFLICT' }));
  });

  it('projects exact active membership from a verified consecutive manifest catalog', async () => {
    const previous = await loadApprovedManifest();
    const next = nextManifest(previous, 2);
    const event = createEvent({
      eventId: uuidV7(1),
      eventType: 'MissionScopeChanged',
      missionId: MISSION_ID,
      sequence: 1,
      manifestVersion: 1,
      requestId: uuidV7(2),
      correlationId: uuidV7(3),
      causationId: uuidV7(4),
      actor: { role: 'Leo/GPT', subjectId: 'leo-gpt-test' },
      occurredAt: FIXED_TIME,
      receivedAt: FIXED_TIME,
      recordedAt: FIXED_TIME,
      previousEventHash: `sha256:${'0'.repeat(64)}`,
      payload: {
        fromManifestVersion: 1,
        toManifestVersion: 2,
        oldTotal: 15,
        newTotal: 17,
        addedWorkUnitIds: ['AO-EXTRA-001', 'AO-EXTRA-002'],
        removedWorkUnitIds: [],
        changedWorkUnitIds: [],
        reason: 'Approved synthetic scope fixture',
        approvingAuthority: 'Leo/GPT',
        oldManifestHash: previous.source.sha256,
        newManifestHash: next.source.sha256,
      },
    });
    const projection = replayMission(previous, [event], [previous, next]);
    expect(Object.keys(projection.workUnits)).toHaveLength(17);
    expect(projection.retiredWorkUnits).toEqual({});
    expect(projection).toMatchObject({ manifestVersion: 2, numerator: 5, denominator: 17 });
  });
});
