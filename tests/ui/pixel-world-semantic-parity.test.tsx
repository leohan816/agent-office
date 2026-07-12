// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { LIVING_PIXEL_PROTOTYPE_PROJECTION } from '../../src/ui/pixel/fixtures/prototype-projection.js';
import { projectPixelWorldFrame } from '../../src/ui/pixel/frame-projector.js';
import { LivingOfficeDetailDrawer } from '../../src/ui/pixel/living-office-detail-drawer.js';
import { LivingOfficeHud } from '../../src/ui/pixel/living-office-hud.js';
import { LivingOfficeSemanticMirror } from '../../src/ui/pixel/living-office-semantic-mirror.js';
import { createPixelWorldLayout } from '../../src/ui/pixel/world-layout.js';

afterEach(cleanup);

describe('living pixel-office DOM semantic correspondence', () => {
  const layout = createPixelWorldLayout(LIVING_PIXEL_PROTOTYPE_PROJECTION.pods);
  const frame = projectPixelWorldFrame(LIVING_PIXEL_PROTOTYPE_PROJECTION, layout, {
    selectedPodId: 'pod:agent-office',
    logicalTimeMs: 10_500,
    presentationTier: 'PIXEL_FULL',
    scenarioId: 'advisor-handoff',
    cameraOverride: null,
    viewportWidth: 1200,
    viewportHeight: 620,
  });

  it('renders the exact frame key, entity set, Team facts and route log', () => {
    const { container } = render(
      <>
        <LivingOfficeHud backend="WEBGL" complete={false} frame={frame} running />
        <LivingOfficeSemanticMirror frame={frame} projection={LIVING_PIXEL_PROTOTYPE_PROJECTION} />
      </>,
    );
    const mirror = container.querySelector('#living-office-semantic');
    expect(mirror?.getAttribute('data-frame-key')).toBe(frame.frameKey);
    const mirroredIds = [...container.querySelectorAll('[data-semantic-entity-set] [data-entity-id]')]
      .map((element) => element.getAttribute('data-entity-id'))
      .sort();
    expect(mirroredIds).toEqual(frame.visibleEntityIds);
    expect(screen.getByText('Every visible pixel has complete text meaning')).not.toBeNull();
    expect(screen.getByRole('log').textContent).toContain('DELIVERY');
    expect(screen.getByRole('log').textContent).toContain('no authority or completion claim');
    expect(container.textContent).toContain('authorityRole none');
  });

  it('keeps dense evidence in a focus-restoring DOM drawer', () => {
    const invokerRef = createRef<HTMLButtonElement>();
    const close = () => undefined;
    render(
      <>
        <button ref={invokerRef} type="button">Open detail test</button>
        <LivingOfficeDetailDrawer
          automatic={false}
          frame={frame}
          invokerRef={invokerRef}
          onClose={close}
          open
        />
      </>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Agent Office evidence detail' });
    expect(dialog.textContent).toContain('SYNTHETIC PROTOTYPE');
    expect(dialog.textContent).toContain(frame.frameKey);
    const closeButton = screen.getByRole('button', { name: 'Close detail' });
    expect(document.activeElement).toBe(closeButton);
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(closeButton);
  });

  it('contains no private locator, credential, host or terminal-derived content', () => {
    const { container } = render(
      <LivingOfficeSemanticMirror frame={frame} projection={LIVING_PIXEL_PROTOTYPE_PROJECTION} />,
    );
    expect(container.textContent).not.toMatch(/\/home\/|BEGIN PRIVATE KEY|Bearer\s|tmux|paneId|127\.0\.0\.1/iu);
  });
});
