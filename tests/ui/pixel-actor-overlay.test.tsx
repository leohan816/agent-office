// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { focusPodCamera } from '../../src/ui/pixel/camera.js';
import type { PixelPrototypeViewOptions } from '../../src/ui/pixel/contracts.js';
import { LIVING_PIXEL_PROTOTYPE_PROJECTION } from '../../src/ui/pixel/fixtures/prototype-projection.js';
import { projectPixelWorldFrame } from '../../src/ui/pixel/frame-projector.js';
import {
  LivingOfficeActorOverlay,
  layoutPixelActorLabels,
  pixelActorLabelPlacementsOverlap,
  type LivingOfficeActorOverlayHandle,
} from '../../src/ui/pixel/living-office-actor-overlay.js';
import { createPixelWorldLayout } from '../../src/ui/pixel/world-layout.js';

afterEach(cleanup);

describe('camera-tracked living-office actor identity labels', () => {
  const layout = createPixelWorldLayout(LIVING_PIXEL_PROTOTYPE_PROJECTION.pods);

  it('lays out every full-office label deterministically without label collisions', () => {
    const frame = project('full-office', 0, 'pod:foundation');
    const first = layoutPixelActorLabels(frame, 1400, 558);
    const second = layoutPixelActorLabels(frame, 1400, 558);
    expect(first).toEqual(second);
    expect(first).toHaveLength(LIVING_PIXEL_PROTOTYPE_PROJECTION.actors.length);
    expect(first.every((placement) => placement.inViewport)).toBe(true);
    for (const [index, placement] of first.entries()) {
      expect(placement.x).toBeGreaterThanOrEqual(8);
      expect(placement.y).toBeGreaterThanOrEqual(8);
      for (const prior of first.slice(0, index)) {
        expect(pixelActorLabelPlacementsOverlap(placement, prior), `${placement.roleInstanceId}/${prior.roleInstanceId}`).toBe(false);
      }
    }
  });

  it('tracks camera focus and exposes role, model, session, state, glyph and ring redundantly', () => {
    const fullFrame = project('full-office', 0, 'pod:foundation');
    const foundationPod = layout.pods.find((pod) => pod.podId === 'pod:foundation');
    if (foundationPod === undefined) throw new TypeError('Foundation Pod layout missing');
    const focusedFrame = projectPixelWorldFrame(
      LIVING_PIXEL_PROTOTYPE_PROJECTION,
      layout,
      {
        ...options('foundation-active', 4500, 'pod:foundation'),
        cameraOverride: focusPodCamera(layout, foundationPod, foundationPod.podId, 1400, 620),
      },
    );
    const fullPlacement = layoutPixelActorLabels(fullFrame, 1400, 620)
      .find((placement) => placement.roleInstanceId === 'worker.foundation.primary');
    const focusedPlacement = layoutPixelActorLabels(focusedFrame, 1400, 620)
      .find((placement) => placement.roleInstanceId === 'worker.foundation.primary');
    expect(focusedPlacement).not.toEqual(fullPlacement);

    const { container } = render(
      <LivingOfficeActorOverlay
        frame={focusedFrame}
        projection={LIVING_PIXEL_PROTOTYPE_PROJECTION}
        viewportHeight={620}
        viewportWidth={1400}
      />,
    );
    const label = screen.getByRole('button', { name: /Foundation Worker.*Role Worker.*Model UNKNOWN.*source UNVERIFIED.*Session foundation.*source VERIFIED REGISTRY.*State WORKING.*source SYNTHETIC FIXTURE/u });
    expect(label.textContent).toContain('Worker');
    expect(label.textContent).toContain('UNKNOWN');
    expect(label.textContent).toContain('foundation');
    expect(label.textContent).toContain('WORKING');
    expect(label.textContent).toContain('SYNTHETIC FIXTURE');
    expect(label.querySelector('.living-office-actor-label__glyph')?.textContent).toBe('W');
    expect(label.querySelector('.living-office-actor-label__ring')?.getAttribute('data-state')).toBe('WORKING');
    expect(container.querySelector('[data-presentation-tier="PIXEL_FULL"]')).not.toBeNull();
  });

  it('opens all ten structured fields, fails closed to UNKNOWN and restores label focus', () => {
    const frame = project('vibenews-active', 7500, 'pod:vibenews');
    render(
      <LivingOfficeActorOverlay
        frame={frame}
        projection={LIVING_PIXEL_PROTOTYPE_PROJECTION}
        viewportHeight={620}
        viewportWidth={1400}
      />,
    );
    const designerLabel = screen.getByRole('button', { name: /VibeNews Designer.*Model UNKNOWN.*source UNVERIFIED.*Session VibeNews-designer.*source VERIFIED REGISTRY/u });
    designerLabel.focus();
    fireEvent.click(designerLabel);
    const dialog = screen.getByRole('dialog', { name: 'VibeNews Designer' });
    expect(dialog.querySelectorAll('[data-actor-fact]')).toHaveLength(10);
    expect(dialog.textContent).toContain('UNKNOWN');
    expect(dialog.textContent).toContain('VIBENEWS_ADVISOR_TEAM');
    expect(dialog.querySelector('[data-actor-fact="Session name"]')?.getAttribute('data-actor-fact-source')).toBe('VERIFIED_REGISTRY');
    expect(dialog.querySelector('[data-actor-fact="Model"]')?.getAttribute('data-actor-fact-source')).toBe('UNVERIFIED');
    expect(dialog.querySelector('[data-actor-fact="State"]')?.getAttribute('data-actor-fact-source')).toBe('SYNTHETIC_FIXTURE');
    expect(dialog.querySelector('[data-actor-fact="Mission"]')?.getAttribute('data-actor-fact-source')).toBe('SYNTHETIC_FIXTURE');
    expect(dialog.querySelector('[data-actor-fact="WorkUnit"]')?.getAttribute('data-actor-fact-source')).toBe('UNVERIFIED');
    expect(dialog.querySelector('[data-actor-fact="Evidence freshness"]')?.getAttribute('data-actor-fact-source')).toBe('SYNTHETIC_FIXTURE');
    expect(dialog.textContent).toContain('SYNTHETIC FIXTURE - NOT LIVE OPERATIONS');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close actor detail' }));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'VibeNews Designer' })).toBeNull();
    expect(document.activeElement).toBe(designerLabel);
  });

  it('keeps the same actor-label semantics in DOM static presentation and accepts imperative motion updates', () => {
    const staticFrame = projectPixelWorldFrame(
      LIVING_PIXEL_PROTOTYPE_PROJECTION,
      layout,
      { ...options('reduced-static', 10_500, 'pod:agent-office'), presentationTier: 'DOM_STATIC' },
    );
    const overlayRef = createRef<LivingOfficeActorOverlayHandle>();
    const { container } = render(
      <LivingOfficeActorOverlay
        frame={staticFrame}
        projection={LIVING_PIXEL_PROTOTYPE_PROJECTION}
        ref={overlayRef}
        viewportHeight={620}
        viewportWidth={1400}
      />,
    );
    expect(container.querySelector('[data-presentation-tier="DOM_STATIC"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-actor-label]')).toHaveLength(10);
    const before = container.querySelector('[data-actor-label="advisor.foundation.primary"]')?.getAttribute('style');
    overlayRef.current?.updatePositions(project('advisor-handoff', 11_500, 'pod:agent-office'));
    const after = container.querySelector('[data-actor-label="advisor.foundation.primary"]')?.getAttribute('style');
    expect(after).not.toBe(before);
  });

  function project(sceneId: string, logicalTimeMs: number, selectedPodId: string) {
    return projectPixelWorldFrame(
      LIVING_PIXEL_PROTOTYPE_PROJECTION,
      layout,
      options(sceneId, logicalTimeMs, selectedPodId),
    );
  }
});

function options(
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
    viewportWidth: 1400,
    viewportHeight: 620,
  };
}
