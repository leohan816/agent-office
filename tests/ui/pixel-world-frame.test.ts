import { describe, expect, it } from 'vitest';

import {
  PIXEL_ACTOR_UNKNOWN,
  type PixelActorFactInput,
  type PixelActorFactsInput,
  type PixelCueInput,
  type PixelPrototypeProjection,
  type PixelPrototypeViewOptions,
} from '../../src/ui/pixel/contracts.js';
import { LIVING_PIXEL_PROTOTYPE_PROJECTION } from '../../src/ui/pixel/fixtures/prototype-projection.js';
import {
  assertFrameSemanticParity,
  normalizePixelActorFactSet,
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

  it('fails closed to literal UNKNOWN for null, absent, malformed and unverified actor facts', () => {
    const factKeys = [
      'role', 'project', 'advisorTeam', 'reportsToAdvisor', 'sessionName',
      'model', 'state', 'mission', 'workUnit', 'evidenceFreshness',
    ] as const;
    const nullFacts = Object.fromEntries(factKeys.map((key) => [key, null])) as PixelActorFactsInput;
    const unverifiedFacts = Object.fromEntries(factKeys.map((key) => [
      key,
      fact(`invented-${key}`, 'UNVERIFIED'),
    ])) as unknown as PixelActorFactsInput;
    const malformedFacts = Object.fromEntries(factKeys.map((key) => [
      key,
      `renderer-fallback-${key}`,
    ])) as unknown as PixelActorFactsInput;
    for (const input of [{}, nullFacts, unverifiedFacts, malformedFacts]) {
      const normalized = normalizePixelActorFactSet(input);
      expect(Object.values(normalized.facts)).toEqual(
        Array.from({ length: 10 }, () => PIXEL_ACTOR_UNKNOWN),
      );
      expect(Object.values(normalized.sources)).toEqual(
        Array.from({ length: 10 }, () => 'UNVERIFIED'),
      );
      expect(normalizePixelActorFacts(input)).toEqual(normalized.facts);
    }

    const frame = projectPixelWorldFrame(
      LIVING_PIXEL_PROTOTYPE_PROJECTION,
      layout,
      view('vibenews-active', 7500, 'pod:vibenews'),
    );
    const designer = frame.actorFrames.find((actor) => actor.roleInstanceId === 'designer.vibenews.primary');
    expect(designer?.facts.model).toBe(PIXEL_ACTOR_UNKNOWN);
    expect(designer?.facts.sessionName).toBe('VibeNews-designer');
    expect(designer?.facts.workUnit).toBe(PIXEL_ACTOR_UNKNOWN);
    expect(designer?.factSources.model).toBe('UNVERIFIED');
    expect(designer?.factSources.sessionName).toBe('VERIFIED_REGISTRY');
  });

  it('uses only the exact verified registry sessions and two mission-proven models', () => {
    const expectedSessions = new Map([
      ['advisor.foundation.primary', 'foundation-advisor'],
      ['control.foundation.primary', 'foundation-control'],
      ['worker.foundation.primary', 'foundation'],
      ['worker.cosmile.primary', 'cosmile'],
      ['worker.siasiu.primary', 'siasiu'],
      ['worker.agent-office.primary', 'agent-office'],
      ['reviewer.fable5.primary', 'reviewer-fable5'],
      ['advisor.vibenews.primary', 'VibeNews-advisor'],
      ['worker.vibenews.primary', 'VibeNews'],
      ['designer.vibenews.primary', 'VibeNews-designer'],
    ]);
    const expectedModels = new Map([
      ['worker.agent-office.primary', 'Codex 5.6 SOL'],
      ['reviewer.fable5.primary', 'Fable5'],
    ]);
    const frame = projectPixelWorldFrame(
      LIVING_PIXEL_PROTOTYPE_PROJECTION,
      layout,
      view('full-office', 0, 'pod:foundation'),
    );
    for (const actor of frame.actorFrames) {
      expect(actor.facts.sessionName, actor.roleInstanceId).toBe(expectedSessions.get(actor.roleInstanceId));
      expect(actor.factSources.sessionName, actor.roleInstanceId).toBe('VERIFIED_REGISTRY');
      expect(actor.facts.model, actor.roleInstanceId).toBe(
        expectedModels.get(actor.roleInstanceId) ?? PIXEL_ACTOR_UNKNOWN,
      );
      expect(actor.factSources.model, actor.roleInstanceId).toBe(
        expectedModels.has(actor.roleInstanceId) ? 'VERIFIED_MISSION_ARTIFACT' : 'UNVERIFIED',
      );
      for (const key of ['state', 'mission', 'evidenceFreshness'] as const) {
        expect(actor.factSources[key], `${actor.roleInstanceId}/${key}`).toBe('SYNTHETIC_FIXTURE');
      }
      expect(actor.factSources.workUnit, `${actor.roleInstanceId}/workUnit`).toBe(
        actor.roleInstanceId === 'designer.vibenews.primary' ? 'UNVERIFIED' : 'SYNTHETIC_FIXTURE',
      );
    }
  });

  it('does not manufacture a model or session in the frame projector', () => {
    const foundationWorker = LIVING_PIXEL_PROTOTYPE_PROJECTION.actors
      .find((actor) => actor.roleInstanceId === 'worker.foundation.primary');
    if (foundationWorker === undefined) throw new TypeError('Foundation Worker fixture missing');
    const { sessionName, ...factsWithoutSession } = foundationWorker.facts;
    expect(sessionName).toBeDefined();
    const projection: PixelPrototypeProjection = {
      ...LIVING_PIXEL_PROTOTYPE_PROJECTION,
      actors: LIVING_PIXEL_PROTOTYPE_PROJECTION.actors.map((actor) =>
        actor.roleInstanceId === foundationWorker.roleInstanceId
          ? {
              ...actor,
              facts: {
                ...factsWithoutSession,
                model: fact('Codex 5.6 SOL', 'UNVERIFIED'),
              },
            }
          : actor),
    };
    const frame = projectPixelWorldFrame(
      projection,
      createPixelWorldLayout(projection.pods),
      view('foundation-active', 4500, 'pod:foundation'),
    );
    const actor = frame.actorFrames.find((candidate) => candidate.roleInstanceId === foundationWorker.roleInstanceId);
    expect(actor?.facts.sessionName).toBe(PIXEL_ACTOR_UNKNOWN);
    expect(actor?.facts.model).toBe(PIXEL_ACTOR_UNKNOWN);
    expect(actor?.factSources.sessionName).toBe('UNVERIFIED');
    expect(actor?.factSources.model).toBe('UNVERIFIED');
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

function fact(
  value: string | null,
  source: PixelActorFactInput['source'],
): PixelActorFactInput {
  return { value, source };
}
