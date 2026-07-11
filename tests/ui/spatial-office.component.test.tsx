// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { isStaticSpatialDemoRequest } from '../../src/ui/demo-entry.js';
import { SpatialOffice } from '../../src/ui/spatial/spatial-office.js';

afterEach(cleanup);

describe('AO12-B static shared office component', () => {
  it('renders one shared floor with every registered Team Pod spatially visible', () => {
    const { container } = render(<SpatialOffice />);
    expect(screen.getByRole('heading', { name: 'Every registered Team remains visible' })).not.toBeNull();
    const pods = container.querySelectorAll('.spatial-team-pod');
    expect(pods).toHaveLength(2);
    for (const pod of pods) {
      expect(pod.getAttribute('data-recognizable-office-area')).toBe('true');
      expect(pod.querySelector('.spatial-zone-work')).not.toBeNull();
      expect(pod.querySelector('.spatial-team-pod__summary')).not.toBeNull();
    }
    expect(container.querySelectorAll('.spatial-team-pod[data-selected="true"]')).toHaveLength(1);
    expect(container.querySelectorAll('.spatial-team-pod[data-selected="false"]')).toHaveLength(1);
  });

  it('keeps a non-selected office recognizable with every required summary fact', () => {
    const { container } = render(<SpatialOffice />);
    const nonSelected = container.querySelector('.spatial-team-pod[data-selected="false"]');
    expect(nonSelected).not.toBeNull();
    const text = nonSelected?.textContent ?? '';
    for (const label of [
      'Responsible Advisor',
      'Main mission',
      'Current actor',
      'Operational state',
      'Gate / blocker',
      'Freshness / connection',
    ]) {
      expect(text).toContain(label);
    }
    expect(nonSelected?.querySelector('.spatial-team-pod__compact-board')).not.toBeNull();
    expect(nonSelected?.querySelector('.spatial-placeholder-actor')).not.toBeNull();
  });

  it('shows every frozen selected mission-board field and explicit unknown facts', () => {
    render(<SpatialOffice />);
    const board = screen.getByRole('heading', { name: 'Agent Office M1.2' }).closest('.spatial-mission-board');
    if (!(board instanceof HTMLElement)) throw new TypeError('selected mission board missing');
    const boardScope = within(board);
    for (const label of [
      'Advisor Team',
      'Project',
      'Responsible Advisor',
      'Registered Advisor display identity',
      'Current mission',
      'Current Phase / WorkUnit',
      'Registered current actor display identity',
      'Assigned independent Reviewer',
      'Next actor / handoff',
      'Exact blocker',
      'Leo/GPT decision state',
      'WorkUnit progress',
      'Required gate progress',
      'Latest verified evidence',
    ]) {
      expect(boardScope.getByText(label)).not.toBeNull();
    }
    expect(board.querySelectorAll('[data-truth-state="UNKNOWN"]').length).toBeGreaterThan(0);
    expect(board.textContent).toContain('manifest 1.0.0');
    expect(board.textContent).toContain('source KNOWN');
  });

  it('renders labelled static semantic zones, a separate Reviewer booth, and no route or cue layer', () => {
    const { container } = render(<SpatialOffice />);
    for (const zone of [
      'work',
      'testing-bench',
      'result-desk',
      'independent-review-desk',
      'advisor-anchor',
      'leo-decision-destination',
      'evidence-cabinet',
      'lounge',
      'shared-path',
    ]) {
      expect(container.querySelector(`[data-zone="${zone}"]`), zone).not.toBeNull();
    }
    expect(screen.getByText('INDEPENDENT REVIEWER BOOTH').closest('[data-zone="independent-review-desk"]')).not.toBeNull();
    expect(container.querySelector('[data-motion-cue], .scene-route-layer, [data-route]')).toBeNull();
    expect(container.querySelector('#spatial-office')?.getAttribute('data-motion-tier')).toBe('STATIC');
  });

  it('renders each canonical character once and keeps Advisor references non-authoritative', () => {
    const { container } = render(<SpatialOffice />);
    const actorIds = [...container.querySelectorAll('[data-spatial-actor]')]
      .map((element) => element.getAttribute('data-spatial-actor'));
    expect(actorIds).toHaveLength(new Set(actorIds).size);
    expect(actorIds).toContain('advisor.foundation.primary');
    expect(actorIds).toContain('advisor.vibenews.primary');
    expect(screen.getByText('Visual endpoint only; proximity grants no authority.')).not.toBeNull();
  });

  it('selects another Pod locally while retaining the other office and source facts', () => {
    const { container } = render(<SpatialOffice />);
    fireEvent.click(screen.getByRole('button', { name: /VIBENEWS_ADVISOR_TEAM, VibeNews/u }));
    const selected = container.querySelector('.spatial-team-pod[data-selected="true"]');
    expect(selected?.getAttribute('data-project-id')).toBe('vibenews');
    expect(container.querySelectorAll('.spatial-team-pod')).toHaveLength(2);
    expect(screen.getByText(/VIBENEWS_ADVISOR_TEAM selected, CURRENT, CONNECTED/u)).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'VibeNews private mission' })).not.toBeNull();
  });

  it('mounts only from the exact explicit test-demo URL parameter', () => {
    expect(isStaticSpatialDemoRequest('?surface=spatial-static')).toBe(true);
    expect(isStaticSpatialDemoRequest('?surface=spatial-static&fixture=synthetic')).toBe(true);
    expect(isStaticSpatialDemoRequest('')).toBe(false);
    expect(isStaticSpatialDemoRequest('?surface=office')).toBe(false);
    expect(isStaticSpatialDemoRequest('?spatial-static=true')).toBe(false);
  });

  it('contains no private locator, credential, host, or terminal-derived value', () => {
    const { container } = render(<SpatialOffice />);
    const text = container.textContent;
    expect(text).not.toMatch(/\/home\/|\$9|%9|127\.0\.0\.1|BEGIN PRIVATE KEY|Bearer\s|tmux capture-pane|paneId/iu);
  });
});
