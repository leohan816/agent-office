import { describe, expect, it } from 'vitest';

import {
  PIXEL_ACTOR_UNKNOWN,
  type PixelActorFactsInput,
  type PixelCueInput,
  type PixelPrototypeProjection,
  type PixelPrototypeViewOptions,
} from '../../src/ui/pixel/contracts.js';
import { LIVING_PIXEL_PROTOTYPE_PROJECTION } from '../../src/ui/pixel/fixtures/prototype-projection.js';
import {
  assertFrameSemanticParity,
  normalizePixelActorFacts,
  projectPixelWorldFrame,
  reduceAcceptedPixelCues,
} from '../../src/ui/pixel/frame-projector.js';
import { createPixelWorldLayout } from '../../src/ui/pixel/world-layout.js';

describe('living pixel-office pure frame projection and cue truth', () => {
  const layout = createPixelWorldLayout(LIVING_PIXEL_PROTOTYPE_PROJECTION.pods);

  it('projects byte-stable frame facts with unique actors, Advisors and Channy', () => {
    const options = view('full-office', 0, 'pod:foundation');
    const first = projectPixelWorldFrame(LIVING_PIXEL_PROTOTYPE_PROJECTION, layout, options);
    const second = projectPixelWorldFrame(LIVING_PIXEL_PROTOTYPE_PROJECTION, layout, options);
    expect(first).toEqual(second);
    expect(first.schemaVersion).toBe('agent-office.pixel-world-frame.v1');
    expect(assertFrameSemanticParity(first)).toBe(true);
    const actorIds = first.actorFrames.map((actor) => actor.roleInstanceId);
    expect(new Set(actorIds).size).toBe(actorIds.length);
    expect(actorIds.filter((actorId) => actorId.startsWith('advisor.'))).toHaveLength(2);
    expect(first.channy.entityId).toBe('channy.global');
    expect(first.channy.authorityRole).toBe('none');
    expect(Object.keys(first.actorFrames[0]?.facts ?? {}).sort()).toEqual([
      'advisorTeam', 'evidenceFreshness', 'mission', 'model', 'project', 'reportsToAdvisor',
      'role', 'sessionName', 'state', 'workUnit',
    ]);
  });

  it('fails closed to literal UNKNOWN for every absent or unverified actor fact', () => {
    const emptyFacts: PixelActorFactsInput = {
      role: null,
      project: null,
      advisorTeam: null,
      reportsToAdvisor: null,
      sessionName: null,
      model: null,
      state: null,
      mission: null,
      workUnit: null,
      evidenceFreshness: null,
    };
    expect(Object.values(normalizePixelActorFacts(emptyFacts))).toEqual(
      Array.from({ length: 10 }, () => PIXEL_ACTOR_UNKNOWN),
    );
    const frame = projectPixelWorldFrame(
      LIVING_PIXEL_PROTOTYPE_PROJECTION,
      layout,
      view('vibenews-active', 7500, 'pod:vibenews'),
    );
    const designer = frame.actorFrames.find((actor) => actor.roleInstanceId === 'designer.vibenews.primary');
    expect(designer?.facts.model).toBe(PIXEL_ACTOR_UNKNOWN);
    expect(designer?.facts.sessionName).toBe(PIXEL_ACTOR_UNKNOWN);
    expect(designer?.facts.workUnit).toBe(PIXEL_ACTOR_UNKNOWN);
  });

  it('maps named acceptance scenes without inventing operational state', () => {
    const foundation = projectPixelWorldFrame(
      LIVING_PIXEL_PROTOTYPE_PROJECTION,
      layout,
      view('foundation-active', 4500, 'pod:foundation'),
    );
    expect(foundation.hud.operationalState).toBe('WORKING');
    expect(foundation.actorFrames.find((actor) => actor.roleInstanceId === 'worker.foundation.primary')?.animation).toBe('TYPE');
    expect(foundation.acceptedCueIds).toEqual(['cue-working-foundation']);

    const review = projectPixelWorldFrame(
      LIVING_PIXEL_PROTOTYPE_PROJECTION,
      layout,
      view('reviewer-active', 13_500, 'pod:agent-office'),
    );
    expect(review.hud.operationalState).toBe('REVIEWING');
    expect(review.hud.statusLine).toContain('no verdict or approval claim');
    expect(review.actorFrames.find((actor) => actor.roleInstanceId === 'reviewer.fable5.primary')?.animation).toBe('REVIEW');

    const blocked = projectPixelWorldFrame(
      LIVING_PIXEL_PROTOTYPE_PROJECTION,
      layout,
      view('blocked', 25_000, 'pod:agent-office'),
    );
    expect(blocked.hud.operationalState).toBe('BLOCKED');
    expect(blocked.route).toBeNull();
    expect(blocked.channy.animation).toBe('REACT_BLOCKED');
  });

  it('uses one accepted cue and one bounded route for each routed scene', () => {
    for (const [sceneId, selectedPodId, cueId] of [
      ['worker-walk', 'pod:foundation', 'cue-relocate-foundation'],
      ['advisor-handoff', 'pod:agent-office', 'cue-delivery-agent-office'],
      ['waiting-leo', 'pod:agent-office', 'cue-waiting-leo-agent-office'],
    ] as const) {
      const frame = projectPixelWorldFrame(
        LIVING_PIXEL_PROTOTYPE_PROJECTION,
        layout,
        view(sceneId, sceneId === 'advisor-handoff' ? 11_500 : 7000, selectedPodId),
      );
      expect(frame.acceptedCueIds).toEqual([cueId]);
      expect(frame.route?.cueId).toBe(cueId);
      expect(frame.route?.points.length).toBeGreaterThan(1);
      expect(frame.route?.staticEquivalent).toContain('no authority or completion claim');
    }
  });

  it('rejects snapshot, stale, conflict, duplicate, out-of-revision and replay cues', () => {
    const foundationCue = requireCue('cue-working-foundation');
    const invalidCues: readonly PixelCueInput[] = [
      { ...foundationCue, cueId: 'snapshot', origin: 'INITIAL_SNAPSHOT' },
      { ...foundationCue, cueId: 'stale', freshness: 'STALE' },
      { ...foundationCue, cueId: 'conflict', conflict: true },
      { ...foundationCue, cueId: 'revision', projectionRevision: 26 },
      { ...foundationCue, cueId: 'unaccepted', accepted: false },
    ];
    const projection: PixelPrototypeProjection = {
      ...LIVING_PIXEL_PROTOTYPE_PROJECTION,
      cues: invalidCues,
    };
    expect(reduceAcceptedPixelCues(projection, 'pod:foundation')).toEqual([]);
    expect(reduceAcceptedPixelCues(
      LIVING_PIXEL_PROTOTYPE_PROJECTION,
      'pod:foundation',
      new Set(['cue-working-foundation', 'cue-relocate-foundation']),
    )).toEqual([]);

    const blockedDuplicate: PixelCueInput = {
      ...foundationCue,
      cueId: 'higher-precedence-same-source',
      kind: 'BLOCKED',
      roleInstanceId: 'control.foundation.primary',
      missionSequence: foundationCue.missionSequence + 1,
    };
    const duplicateProjection: PixelPrototypeProjection = {
      ...LIVING_PIXEL_PROTOTYPE_PROJECTION,
      cues: [foundationCue, blockedDuplicate],
    };
    expect(reduceAcceptedPixelCues(duplicateProjection, 'pod:foundation')).toEqual([blockedDuplicate]);
  });

  function requireCue(cueId: string): PixelCueInput {
    const cue = LIVING_PIXEL_PROTOTYPE_PROJECTION.cues.find((candidate) => candidate.cueId === cueId);
    if (cue === undefined) throw new TypeError(`test cue missing: ${cueId}`);
    return cue;
  }
});

function view(
  scenarioId: string,
  logicalTimeMs: number,
  selectedPodId: string,
): PixelPrototypeViewOptions {
  return {
    selectedPodId,
    logicalTimeMs,
    presentationTier: 'PIXEL_FULL',
    scenarioId,
    cameraOverride: null,
    viewportWidth: 1200,
    viewportHeight: 620,
  };
}
