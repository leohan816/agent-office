import { describe, expect, it } from 'vitest';

import { createSpatialOfficeFixtureInput } from '../../src/application/spatial-office/fixtures.js';
import { projectSpatialOffice } from '../../src/application/spatial-office/projector.js';
import { serializeSpatialOfficeProjection } from '../../src/application/spatial-office/validation.js';

describe('AO12-IWU-03 deterministic Team Pod projector', () => {
  it('keeps every registered Team as a recognizable area on one shared floor', () => {
    const projection = projectSpatialOffice(createSpatialOfficeFixtureInput());
    expect(projection.floorMode).toBe('ONE_SHARED_FLOOR');
    expect(projection.pods.map((pod) => pod.projectId)).toEqual(['agent-office', 'vibenews']);
    expect(projection.pods.map((pod) => pod.recognizableOfficeArea)).toEqual([true, true]);
    expect(projection.selectedPodId).toBe('pod:agent-office');
    expect(projection.pods.filter((pod) => pod.selected)).toHaveLength(1);
    expect(projection.pods[0]).toMatchObject({
      selected: true,
      fullChoreographyEnabled: true,
      currentMainMission: { state: 'KNOWN', value: 'Agent Office M1.2' },
      currentActor: { state: 'KNOWN', value: 'Worker model' },
      operationalState: 'WORKING',
    });
    expect(projection.pods[1]).toMatchObject({
      selected: false,
      fullChoreographyEnabled: false,
      currentMainMission: { state: 'KNOWN', value: 'VibeNews private mission' },
      currentActor: { state: 'KNOWN', value: 'Vibe Worker model' },
      operationalState: 'WORKING',
    });
    expect(projection.pods[1]?.actorAssignments.every((view) => !view.taskMotionAllowed)).toBe(true);
    expect(projection.actorsByRoleInstanceId['worker.vibenews.primary']?.taskMotionAllowed).toBe(false);
    expect(projection.pods[1]?.missionBoardSummary).not.toBeNull();
  });

  it('uses explicit valid selection, then an exact deep link, then lexical project ID', () => {
    const explicit = createSpatialOfficeFixtureInput();
    const explicitProjection = projectSpatialOffice({
      ...explicit,
      selection: {
        explicitPodId: 'pod:vibenews',
        explicitMissionRef: null,
        deepLinkedMissionRef: { projectId: 'agent-office', missionId: 'mission-ao12' },
      },
    });
    expect(explicitProjection.selectedPodId).toBe('pod:vibenews');

    const deepLinked = projectSpatialOffice({
      ...explicit,
      selection: {
        explicitPodId: 'pod:missing',
        explicitMissionRef: null,
        deepLinkedMissionRef: { projectId: 'vibenews', missionId: 'mission-vibe' },
      },
    });
    expect(deepLinked.selectedPodId).toBe('pod:vibenews');

    const lexical = projectSpatialOffice({
      ...explicit,
      projects: [...explicit.projects].reverse(),
      selection: {
        explicitPodId: 'pod:missing',
        explicitMissionRef: null,
        deepLinkedMissionRef: { projectId: 'vibenews', missionId: 'mission-missing' },
      },
    });
    expect(lexical.selectedPodId).toBe('pod:agent-office');
  });

  it('is byte-equivalent for equal inputs regardless of source collection order', () => {
    const first = createSpatialOfficeFixtureInput();
    const second = createSpatialOfficeFixtureInput();
    const left = projectSpatialOffice(first);
    const right = projectSpatialOffice({
      ...second,
      projects: [...second.projects].reverse(),
      missions: [...second.missions].reverse(),
      sourceEventIds: [...second.sourceEventIds].reverse(),
    });
    expect(serializeSpatialOfficeProjection(right)).toBe(serializeSpatialOfficeProjection(left));
  });

  it('uses only an explicit or canonically marked mission and never infers one from array order', () => {
    const input = createSpatialOfficeFixtureInput();
    const primary = input.missions[0];
    if (primary === undefined) throw new Error('fixture mission missing');
    const extraMission = {
      ...primary,
      mainMission: false,
      sourceManifestRef: {
        ...primary.sourceManifestRef,
        missionId: 'mission-ao12-extra',
        sourceSha256: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      },
      missionSummary: {
        ...primary.missionSummary,
        missionRef: { projectId: 'agent-office', missionId: 'mission-ao12-extra' },
        displayName: 'Agent Office explicit mission',
      },
      missionBoard: {
        ...primary.missionBoard,
        missionRef: { projectId: 'agent-office', missionId: 'mission-ao12-extra' },
        currentMission: { state: 'KNOWN' as const, value: 'Agent Office explicit mission' },
      },
    };
    const explicit = projectSpatialOffice({
      ...input,
      missions: [...input.missions, extraMission],
      selection: {
        explicitPodId: 'pod:agent-office',
        explicitMissionRef: { projectId: 'agent-office', missionId: 'mission-ao12-extra' },
        deepLinkedMissionRef: null,
      },
    });
    expect(explicit.selectedMissionBoard?.missionRef).toEqual({
      projectId: 'agent-office',
      missionId: 'mission-ao12-extra',
    });
    expect(explicit.pods[0]?.currentMainMission).toEqual({
      state: 'KNOWN',
      value: 'Agent Office M1.2',
    });
    expect(() => projectSpatialOffice({
      ...input,
      missions: [...input.missions, { ...extraMission, mainMission: true }],
    })).toThrow(/multiple main missions/u);

    const withoutMain = projectSpatialOffice({
      ...input,
      missions: input.missions.map((mission) => ({ ...mission, mainMission: false })),
    });
    expect(withoutMain.sourceManifestRefs).toHaveLength(2);
    expect(withoutMain.pods.every((pod) => pod.missionSummaries.length === 1)).toBe(true);
    expect(withoutMain.pods.every((pod) => pod.selectedMissionRef === null)).toBe(true);
    expect(withoutMain.pods.every((pod) => pod.missionBoardSummary === null)).toBe(true);
    expect(withoutMain.pods.every((pod) => pod.currentMainMission.state === 'UNKNOWN')).toBe(true);
    expect(withoutMain.pods.every((pod) => !pod.fullChoreographyEnabled)).toBe(true);
  });

  it('requires verified manifest authority for mission boards and active choreography', () => {
    const input = createSpatialOfficeFixtureInput();
    const projection = projectSpatialOffice({
      ...input,
      missions: input.missions.map((mission) => ({
        ...mission,
        sourceAuthorityVerified: false,
      })),
    });
    expect(projection.sourceManifestRefs).toEqual([]);
    expect(projection.pods.every((pod) => pod.missionSummaries.length === 0)).toBe(true);
    expect(projection.pods.every((pod) => pod.missionBoardSummary === null)).toBe(true);
    expect(projection.pods.every((pod) => !pod.fullChoreographyEnabled)).toBe(true);
    expect(projection.pods[0]).toMatchObject({
      currentMainMission: { state: 'UNKNOWN', value: null },
      operationalState: 'UNKNOWN',
    });
    expect(Object.values(projection.actorsByRoleInstanceId).every(
      (actor) => actor.presentationPodId === null && !actor.taskMotionAllowed,
    )).toBe(true);
  });

  it('suppresses live presentation for stale or conflicting project evidence', () => {
    const input = createSpatialOfficeFixtureInput();
    const projects = input.projects.map((project) => project.projectId === 'agent-office'
      ? { ...project, evidenceFreshness: 'STALE' as const }
      : project);
    const projection = projectSpatialOffice({ ...input, projects });
    expect(projection.pods[0]?.fullChoreographyEnabled).toBe(false);
    expect(projection.pods[0]?.currentActor).toEqual({ state: 'KNOWN', value: 'Worker model' });
    expect(projection.pods[0]?.actorAssignments.some((view) => view.fullCharacter)).toBe(false);
    expect(projection.actorsByRoleInstanceId['worker.agent-office.primary']).toMatchObject({
      presentationPodId: null,
      taskMotionAllowed: false,
    });
  });
});
