// @vitest-environment jsdom

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { STATIC_SPATIAL_OFFICE_FIXTURE } from '../../src/ui/spatial/fixtures.js';
import { SpatialOffice } from '../../src/ui/spatial/spatial-office.js';

afterEach(cleanup);

describe('AO12-B static accessibility architecture', () => {
  it('provides skip destinations, semantic lists, scoped live regions, and complete text identity', () => {
    const { container } = render(<StaticSpatialOffice />);
    for (const name of [
      'Global status',
      'Advisor Team selector',
      'Selected mission board',
      'Actor and zone state list',
      'Evidence and alert inspector',
    ]) {
      expect(screen.getAllByRole('link', { name }).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole('heading', { name: 'Actor and zone state list' })).not.toBeNull();
    expect(container.querySelector('[aria-live="polite"][aria-atomic="true"]')).not.toBeNull();
    expect(container.querySelector('[role="alert"][aria-atomic="true"]')).not.toBeNull();
    for (const svg of container.querySelectorAll('.project-identity svg')) svg.remove();
    expect(screen.getAllByText('Agent Office').length).toBeGreaterThan(0);
    expect(screen.getAllByText('agent-office').length).toBeGreaterThan(0);
    expect(screen.getAllByText('VibeNews').length).toBeGreaterThan(0);
    expect(screen.getAllByText('vibenews').length).toBeGreaterThan(0);
  });

  it('uses one roving Pod tab stop with arrows, Home/End, and explicit selection', () => {
    render(<StaticSpatialOffice />);
    const agentOffice = screen.getByRole('button', { name: /FOUNDATION_ADVISOR_TEAM, Agent Office/u });
    const vibeNews = screen.getByRole('button', { name: /VIBENEWS_ADVISOR_TEAM, VibeNews/u });
    expect(agentOffice.tabIndex).toBe(0);
    expect(vibeNews.tabIndex).toBe(-1);
    agentOffice.focus();
    fireEvent.keyDown(agentOffice, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(vibeNews);
    expect(vibeNews.tabIndex).toBe(0);
    fireEvent.keyDown(vibeNews, { key: 'Home' });
    expect(document.activeElement).toBe(agentOffice);
    fireEvent.keyDown(agentOffice, { key: 'End' });
    expect(document.activeElement).toBe(vibeNews);
    fireEvent.keyDown(vibeNews, { key: 'Enter' });
    expect(vibeNews.getAttribute('aria-current')).toBe('true');
    expect(document.activeElement).toBe(vibeNews);
  });

  it('uses one selected actor roving tab stop and deterministic linear keys', async () => {
    render(<StaticSpatialOffice />);
    const advisor = screen.getByRole('button', { name: /Foundation Advisor.+role instance advisor\.foundation\.primary/u });
    const worker = screen.getByRole('button', { name: /Agent Office Worker.+role instance worker\.agent-office\.primary/u });
    await waitFor(() => expect(advisor.tabIndex).toBe(0));
    expect(worker.tabIndex).toBe(-1);
    advisor.focus();
    fireEvent.keyDown(advisor, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(worker);
    expect(worker.tabIndex).toBe(0);
    fireEvent.keyDown(worker, { key: 'Home' });
    expect(document.activeElement).toBe(advisor);
  });

  it('traps the optional modal inspector, closes with Escape, and restores invoker focus', async () => {
    render(<StaticSpatialOffice />);
    const worker = screen.getByRole('button', { name: /Agent Office Worker.+role instance worker\.agent-office\.primary/u });
    worker.focus();
    fireEvent.click(worker);
    const dialog = await screen.findByRole('dialog', { name: 'Agent Office Worker' });
    const close = within(dialog).getByRole('button', { name: 'Close actor inspector' });
    await waitFor(() => expect(document.activeElement).toBe(close));
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(worker);
  });

  it('pins 44px controls, mobile two-character cap, wrapping, focus, forced colors, and zero static motion', async () => {
    const css = await readFile(path.resolve(import.meta.dirname, '../../src/ui/spatial/spatial-office.css'), 'utf8');
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('@media (max-width: 767px)');
    expect(css).toContain('.spatial-team-pod[data-selected="false"]');
    expect(css).toContain('.spatial-character:nth-child(n+2)');
    expect(css).toContain('@media (max-width: 420px)');
    expect(css).toContain('@media (max-height: 420px) and (orientation: landscape)');
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('overflow-wrap: anywhere');
    expect(css).not.toMatch(/@keyframes|\banimation\s*:|\btransition\s*:/iu);
  });
});

function StaticSpatialOffice() {
  return (
    <SpatialOffice
      fixtureKind={STATIC_SPATIAL_OFFICE_FIXTURE.fixtureKind}
      projection={STATIC_SPATIAL_OFFICE_FIXTURE.projection}
      surfaceKind="SYNTHETIC"
    />
  );
}
