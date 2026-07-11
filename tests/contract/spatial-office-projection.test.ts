import { describe, expect, it } from 'vitest';

import { createSpatialOfficeFixtureInput } from '../../src/application/spatial-office/fixtures.js';
import { projectSpatialOffice } from '../../src/application/spatial-office/projector.js';
import {
  parseSpatialOfficeProjection,
  serializeSpatialOfficeProjection,
  SpatialProjectionValidationError,
} from '../../src/application/spatial-office/validation.js';

describe('AO12-IWU-01 spatial office projection contract', () => {
  it('accepts the exact v1 closed read model and serializes it canonically', () => {
    const projection = projectSpatialOffice(createSpatialOfficeFixtureInput());
    expect(parseSpatialOfficeProjection(projection)).toBe(projection);
    expect(projection.schemaVersion).toBe('agent-office.spatial-office-projection.v1');
    expect(projection.floorMode).toBe('ONE_SHARED_FLOOR');
    expect(projection.channyPresentation).toBeNull();

    const reordered = Object.fromEntries(Object.entries(projection).reverse());
    expect(serializeSpatialOfficeProjection(reordered)).toBe(
      serializeSpatialOfficeProjection(projection),
    );
    expect(serializeSpatialOfficeProjection(projection)).toBe(
      serializeSpatialOfficeProjection(structuredClone(projection)),
    );
  });

  it('rejects unknown versions, unknown fields, duplicate IDs, and unsorted arrays', () => {
    const projection = projectSpatialOffice(createSpatialOfficeFixtureInput());
    expect(() => parseSpatialOfficeProjection({
      ...projection,
      schemaVersion: 'agent-office.spatial-office-projection.v2',
    })).toThrow(SpatialProjectionValidationError);
    expect(() => parseSpatialOfficeProjection({ ...projection, extra: true })).toThrow(
      SpatialProjectionValidationError,
    );
    expect(() => parseSpatialOfficeProjection({
      ...projection,
      pods: [...projection.pods, projection.pods[0]],
    })).toThrow(/uniquely sorted/u);
    expect(() => parseSpatialOfficeProjection({
      ...projection,
      sourceEventIds: [...projection.sourceEventIds].reverse(),
    })).toThrow(/uniquely sorted/u);
  });

  it('rejects inconsistent project, mission, actor, selection, and manifest references', () => {
    const projection = projectSpatialOffice(createSpatialOfficeFixtureInput());
    const wrongMission = structuredClone(projection);
    const firstSummary = wrongMission.pods[0]?.missionSummaries[0];
    if (firstSummary === undefined) throw new Error('fixture mission missing');
    Object.assign(firstSummary.missionRef, { projectId: 'vibenews' });
    expect(() => parseSpatialOfficeProjection(wrongMission)).toThrow(/crosses project boundary/u);

    expect(() => parseSpatialOfficeProjection({
      ...projection,
      selectedPodId: projection.pods[1]?.podId,
    })).toThrow(/exactly one selected pod/u);

    const unknownActor = structuredClone(projection);
    const assignment = unknownActor.pods[0]?.actorAssignments[0];
    if (assignment === undefined) throw new Error('fixture assignment missing');
    Object.assign(assignment, { roleInstanceId: 'actor.unknown' });
    expect(() => parseSpatialOfficeProjection(unknownActor)).toThrow(/unknown actor/u);

    expect(() => parseSpatialOfficeProjection({
      ...projection,
      sourceManifestRefs: projection.sourceManifestRefs.slice(1),
    })).toThrow(/no verified source manifest/u);

    expect(() => parseSpatialOfficeProjection({
      ...projection,
      sourceEventIds: projection.sourceEventIds.slice(1),
    })).toThrow(/activity source is not accepted/u);

    const sourceForExtraMission = projection.sourceManifestRefs[1];
    if (sourceForExtraMission === undefined) throw new Error('fixture source manifest missing');
    expect(() => parseSpatialOfficeProjection({
      ...projection,
      sourceManifestRefs: [
        ...projection.sourceManifestRefs,
        {
          ...sourceForExtraMission,
          missionId: 'mission-z-extra',
        },
      ],
    })).toThrow(/has no mission summary/u);
  });

  it('rejects raw targets, terminal controls, credentials, paths, and inferred facts', () => {
    const projection = projectSpatialOffice(createSpatialOfficeFixtureInput());
    for (const unsafe of [
      String.fromCodePoint(37, 57),
      String.fromCodePoint(27, 91, 51, 49, 109),
      '/home/example/private',
      'home/example/private.txt',
      'Bearer private-value',
      'ssh://private-host',
      'office:2.1',
      'session:window.1',
    ]) {
      const candidate = structuredClone(projection);
      const board = candidate.pods[0]?.missionBoardSummary;
      if (board === null || board === undefined) throw new Error('fixture board missing');
      Object.assign(board.currentActorDisplayIdentity, { state: 'KNOWN', value: unsafe });
      expect(() => parseSpatialOfficeProjection(candidate), unsafe).toThrow(
        /redacted registered display value/u,
      );
    }

    const inferred = structuredClone(projection);
    const board = inferred.pods[0]?.missionBoardSummary;
    if (board === null || board === undefined) throw new Error('fixture board missing');
    Object.assign(board.assignedReviewer, { state: 'UNKNOWN', value: 'guessed reviewer' });
    expect(() => parseSpatialOfficeProjection(inferred)).toThrow(/must be null/u);
  });

  it('retains explicit UNKNOWN, STALE, and CONFLICT values without filling them', () => {
    const projection = projectSpatialOffice(createSpatialOfficeFixtureInput());
    const candidate = structuredClone(projection);
    const board = candidate.pods[0]?.missionBoardSummary;
    if (board === null || board === undefined) throw new Error('fixture board missing');
    Object.assign(board.assignedReviewer, { state: 'UNKNOWN', value: null });
    Object.assign(board.nextActorOrHandoff, { state: 'STALE', value: null });
    Object.assign(board.blocker, { state: 'CONFLICT', value: null });
    expect(parseSpatialOfficeProjection(candidate).pods[0]?.missionBoardSummary).toMatchObject({
      assignedReviewer: { state: 'UNKNOWN', value: null },
      nextActorOrHandoff: { state: 'STALE', value: null },
      blocker: { state: 'CONFLICT', value: null },
    });
  });
});
