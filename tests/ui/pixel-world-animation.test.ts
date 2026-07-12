import { describe, expect, it } from 'vitest';

import { LIVING_PIXEL_PROTOTYPE_PROJECTION } from '../../src/ui/pixel/fixtures/prototype-projection.js';
import { projectPixelWorldFrame } from '../../src/ui/pixel/frame-projector.js';
import {
  advancePixelClock,
  createPixelClockState,
  PIXEL_FIXED_STEP_MS,
  PIXEL_PROTOTYPE_DURATION_MS,
} from '../../src/ui/pixel/presentation-clock.js';
import { createPixelWorldLayout } from '../../src/ui/pixel/world-layout.js';

describe('living pixel-office deterministic presentation clock and motion', () => {
  const layout = createPixelWorldLayout(LIVING_PIXEL_PROTOTYPE_PROJECTION.pods);

  it('advances at one 30fps fixed step and drops excess after two catch-up steps', () => {
    const initial = createPixelClockState();
    const one = advancePixelClock(initial, PIXEL_FIXED_STEP_MS);
    expect(one.steps).toHaveLength(1);
    expect(one.state.logicalTimeMs).toBeCloseTo(PIXEL_FIXED_STEP_MS, 6);
    const overloaded = advancePixelClock(initial, 1000);
    expect(overloaded.steps).toHaveLength(2);
    expect(overloaded.droppedWallTimeMs).toBeGreaterThan(900);
    expect(overloaded.state.logicalTimeMs).toBeCloseTo(PIXEL_FIXED_STEP_MS * 2, 6);
  });

  it('stops exactly at the bounded 26-second prototype end', () => {
    let state = createPixelClockState(25_950);
    for (let index = 0; index < 10; index += 1) state = advancePixelClock(state, 34).state;
    expect(state.logicalTimeMs).toBe(PIXEL_PROTOTYPE_DURATION_MS);
    expect(state.complete).toBe(true);
    expect(advancePixelClock(state, 500).steps).toEqual([]);
  });

  it('selects deterministic frame cycles for actor and Channy scenes', () => {
    const workerA = frame('foundation-active', 4500);
    const workerB = frame('foundation-active', 4620);
    const actorA = workerA.actorFrames.find((actor) => actor.roleInstanceId === 'worker.foundation.primary');
    const actorB = workerB.actorFrames.find((actor) => actor.roleInstanceId === 'worker.foundation.primary');
    expect(actorA?.animation).toBe('TYPE');
    expect(actorB?.animationFrame).not.toBe(actorA?.animationFrame);
    expect(frame('channy-roam', 18_000).channy.animation).toBe('ROAM');
    expect(frame('channy-eat', 20_000).channy.animation).toBe('EAT');
    expect(frame('channy-sleep', 22_000).channy.animation).toBe('SLEEP');
  });

  it('keeps every moving frame inside the bounded world', () => {
    for (let logicalTimeMs = 0; logicalTimeMs <= 26_000; logicalTimeMs += 100) {
      const projected = projectPixelWorldFrame(LIVING_PIXEL_PROTOTYPE_PROJECTION, layout, {
        selectedPodId: 'pod:agent-office',
        logicalTimeMs,
        presentationTier: 'PIXEL_FULL',
        scenarioId: null,
        cameraOverride: null,
        viewportWidth: 1200,
        viewportHeight: 620,
      });
      for (const actor of projected.actorFrames) {
        expect(actor.x).toBeGreaterThanOrEqual(0);
        expect(actor.x).toBeLessThanOrEqual(layout.width);
        expect(actor.y).toBeGreaterThanOrEqual(0);
        expect(actor.y).toBeLessThanOrEqual(layout.height);
      }
      expect(projected.channy.x).toBeGreaterThanOrEqual(0);
      expect(projected.channy.x).toBeLessThanOrEqual(layout.width);
      expect(projected.channy.y).toBeGreaterThanOrEqual(0);
      expect(projected.channy.y).toBeLessThanOrEqual(layout.height);
    }
  });

  function frame(sceneId: string, logicalTimeMs: number) {
    return projectPixelWorldFrame(LIVING_PIXEL_PROTOTYPE_PROJECTION, layout, {
      selectedPodId: 'pod:foundation',
      logicalTimeMs,
      presentationTier: 'PIXEL_FULL',
      scenarioId: sceneId,
      cameraOverride: null,
      viewportWidth: 1200,
      viewportHeight: 620,
    });
  }
});
