// @vitest-environment jsdom

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MOTION_SPATIAL_OFFICE_FIXTURE } from '../../src/ui/spatial/fixtures.js';
import { SpatialOffice } from '../../src/ui/spatial/spatial-office.js';
import {
  resolveSpatialRoute,
  SpatialRoutes,
  type SpatialZoneEndpoint,
} from '../../src/ui/spatial/spatial-routes.js';
import type { SpatialCueEnvelope } from '../../src/ui/spatial/cue-projector.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('AO12-IWU-10 semantic routes and presentation cleanup', () => {
  it('resolves only one exact visible semantic source and target', () => {
    const cue = routeCue();
    const visible = endpoints(cue, true);
    expect(resolveSpatialRoute(cue, visible, 'FULL').outcome).toBe('MOTION');
    expect(resolveSpatialRoute(cue, visible, 'STATIC')).toMatchObject({
      outcome: 'STATIC_EQUIVALENT',
      diagnosticCode: 'TIER_STATIC',
    });
    expect(resolveSpatialRoute(cue, endpoints(cue, false), 'FULL').diagnosticCode).toBe('ENDPOINT_HIDDEN');
    expect(resolveSpatialRoute(cue, visible.slice(0, 1), 'FULL').diagnosticCode).toBe('ENDPOINT_MISSING');
    expect(resolveSpatialRoute(cue, [...visible, requireEndpoint(visible[0])], 'FULL').diagnosticCode).toBe('ENDPOINT_AMBIGUOUS');
  });

  it('renders at most one actor/document route pair and keeps every cue in the accessible log', () => {
    const cues = MOTION_SPATIAL_OFFICE_FIXTURE.cueState.pendingCues;
    const { container } = render(
      <SpatialRoutes
        activityLog={MOTION_SPATIAL_OFFICE_FIXTURE.cueState.activityLog}
        cues={cues}
        endpoints={uniqueEndpoints(cues)}
        frozenProgress={0.5}
        tier="FULL"
      />,
    );
    expect(container.querySelectorAll('[data-route-pair="actor-document"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-motion-cue]')).toHaveLength(1);
    expect(screen.getByRole('log').querySelectorAll('li')).toHaveLength(3);
    expect(container.querySelector('[data-route-pair]')?.getAttribute('style')).toMatch(/transform: translate3d\(32\.5%/u);
  });

  it('uses Web Animations with transform/opacity only and cancels it on unmount', () => {
    const cancel = vi.fn();
    const animation = { cancel, onfinish: null } as unknown as Animation;
    const animate = vi.fn<(
      keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
      options?: number | KeyframeAnimationOptions,
    ) => Animation>(() => animation);
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
    const cue = routeCue();
    const { unmount } = render(
      <SpatialRoutes
        activityLog={[]}
        cues={[cue]}
        endpoints={endpoints(cue, true)}
        frozenProgress={null}
        tier="FULL"
      />,
    );
    expect(animate).toHaveBeenCalledTimes(1);
    const frames = animate.mock.calls[0]?.[0];
    expect(frames).toEqual([
      { opacity: 0.25, transform: 'translate3d(0, 0, 0)' },
      { opacity: 1, transform: 'translate3d(65%, 0, 0)' },
    ]);
    expect(animate.mock.calls[0]?.[1]).toMatchObject({ duration: 900, iterations: 1 });
    unmount();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('shows exact static route equivalence without auto-scroll or focus movement', () => {
    const cue = routeCue();
    const focus = document.createElement('button');
    document.body.append(focus);
    focus.focus();
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const { container } = render(
      <SpatialRoutes
        activityLog={[]}
        cues={[cue]}
        endpoints={endpoints(cue, true)}
        frozenProgress={null}
        tier="STATIC"
      />,
    );
    expect(container.querySelector('[data-route-pair]')).toBeNull();
    expect(container.querySelector('[data-route-static-equivalent="TIER_STATIC"]')?.textContent)
      .toContain('advisor-anchor -> leo-decision-destination');
    expect(document.activeElement).toBe(focus);
    expect(scroll).not.toHaveBeenCalled();
    focus.remove();
  });

  it('mounts the accepted synthetic cue surface without actor clones and preserves static facts', () => {
    mockMatchMedia(false, false);
    const mounted = render(
      <SpatialOffice
        cueState={MOTION_SPATIAL_OFFICE_FIXTURE.cueState}
        fixtureKind={MOTION_SPATIAL_OFFICE_FIXTURE.fixtureKind}
        frozenMotionProgress={0.5}
        projection={MOTION_SPATIAL_OFFICE_FIXTURE.projection}
        requestedTier="FULL"
        surfaceKind="SYNTHETIC"
        verifiedIdle={MOTION_SPATIAL_OFFICE_FIXTURE.verifiedIdle}
      />,
    );
    const { container } = mounted;
    expect(container.querySelector('#spatial-office')?.getAttribute('data-fixture-kind'))
      .toBe('SYNTHETIC_STRUCTURED_EVENT_MOTION');
    expect(container.querySelector('#spatial-office')?.getAttribute('data-motion-tier')).toBe('FULL');
    expect(container.querySelectorAll('[data-motion-cue]')).toHaveLength(1);
    const actorIds = [...container.querySelectorAll('[data-spatial-actor]')]
      .map((element) => element.getAttribute('data-spatial-actor'));
    expect(actorIds).toHaveLength(new Set(actorIds).size);
    expect(screen.getByText('Operational presentation overrides ambient state')).not.toBeNull();
    expect(screen.getByText(/No availability, assignment, shared context, collaboration/u)).not.toBeNull();
    expect(screen.getByRole('log')).not.toBeNull();

    mounted.unmount();
    const route = MOTION_SPATIAL_OFFICE_FIXTURE.cueState.pendingCues.find((cue) => cue.cueKind === 'WAITING_LEO');
    if (route === undefined) throw new TypeError('motion fixture route cue missing');
    const missingEndpoint = render(
      <SpatialOffice
        cueState={{
          ...MOTION_SPATIAL_OFFICE_FIXTURE.cueState,
          pendingCues: [{ ...route, sourceZoneId: 'work:actor.not-present' }],
        }}
        fixtureKind={MOTION_SPATIAL_OFFICE_FIXTURE.fixtureKind}
        frozenMotionProgress={0.5}
        projection={MOTION_SPATIAL_OFFICE_FIXTURE.projection}
        requestedTier="FULL"
        surfaceKind="SYNTHETIC"
      />,
    );
    expect(missingEndpoint.container.querySelector('[data-motion-cue]')).toBeNull();
    expect(missingEndpoint.container.querySelector('[data-route-static-equivalent="ENDPOINT_MISSING"]'))
      .not.toBeNull();
  });

  it('contains no observation, process, network, write, dispatch-adapter, or authority import', async () => {
    const files = [
      'cue-projector.ts',
      'cue-reducer.ts',
      'spatial-routes.tsx',
      'actor-zone.tsx',
      'lounge.tsx',
      'channy-presentation.tsx',
    ];
    for (const file of files) {
      const source = await readFile(path.resolve(import.meta.dirname, `../../src/ui/spatial/${file}`), 'utf8');
      expect(source, file).not.toMatch(/from ['"][^'"]*(?:adapter|gateway|runtime|server|observation|transport|persistence|file-store|node:|child_process|net|http|fs)/u);
      expect(source, file).not.toMatch(/\b(?:fetch|WebSocket|EventSource|localStorage|sessionStorage|sendBeacon)\s*\(/u);
    }
  });

  it('removes timers, media listeners, visibility listeners, and route animations on unmount', () => {
    vi.useFakeTimers();
    const media = new Map<string, ReturnType<typeof mediaQueryList>>();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => {
        const existing = media.get(query);
        if (existing !== undefined) return existing;
        const created = mediaQueryList(query);
        media.set(query, created);
        return created;
      },
    });
    const documentAdd = vi.spyOn(document, 'addEventListener');
    const documentRemove = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(
      <SpatialOffice
        cueState={MOTION_SPATIAL_OFFICE_FIXTURE.cueState}
        fixtureKind={MOTION_SPATIAL_OFFICE_FIXTURE.fixtureKind}
        projection={MOTION_SPATIAL_OFFICE_FIXTURE.projection}
        requestedTier="FULL"
        surfaceKind="SYNTHETIC"
        verifiedIdle={MOTION_SPATIAL_OFFICE_FIXTURE.verifiedIdle}
      />,
    );
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    for (const query of [
      '(prefers-reduced-motion: reduce)',
      '(max-width: 767px)',
      '(orientation: portrait)',
    ]) {
      const list = media.get(query);
      if (list === undefined) throw new TypeError(`media fixture missing: ${query}`);
      expect(list.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      expect(list.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    }
    expect(documentAdd).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(documentRemove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});

function routeCue(): SpatialCueEnvelope {
  return {
    schemaVersion: 'agent-office.spatial-cue.v1',
    cueId: `sha256:${'a'.repeat(64)}`,
    cueKind: 'WAITING_LEO',
    projectId: 'agent-office',
    podId: 'pod:agent-office',
    missionId: 'mission-ao12',
    workUnitId: 'AO12-IWU-09',
    roleInstanceId: 'worker.agent-office.primary',
    sourceEventIds: ['00000000-0000-7001-8000-000000000001'],
    missionSequence: 1,
    projectionRevision: 13,
    sourceZoneId: 'advisor-anchor',
    targetZoneId: 'leo-decision-destination',
    evidenceFreshness: 'CURRENT',
    connectionState: 'CONNECTED',
    createdFromOrigin: 'LIVE_DELTA',
    durationMs: 900,
    staticEquivalentCode: 'DECISION_REQUEST_TEXT',
  };
}

function endpoints(cue: SpatialCueEnvelope, visible: boolean): readonly SpatialZoneEndpoint[] {
  return [
    { zoneId: cue.sourceZoneId, visible, ambiguous: false },
    { zoneId: cue.targetZoneId ?? cue.sourceZoneId, visible, ambiguous: false },
  ];
}

function uniqueEndpoints(cues: readonly SpatialCueEnvelope[]): readonly SpatialZoneEndpoint[] {
  return [...new Set(cues.flatMap((cue) => [cue.sourceZoneId, cue.targetZoneId ?? cue.sourceZoneId]))]
    .map((zoneId) => ({ zoneId, visible: true, ambiguous: false }));
}

function requireEndpoint(endpoint: SpatialZoneEndpoint | undefined): SpatialZoneEndpoint {
  if (endpoint === undefined) throw new TypeError('endpoint fixture missing');
  return endpoint;
}

function mockMatchMedia(reduced: boolean, mobile: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? reduced : query.includes('max-width') ? mobile : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

function mediaQueryList(query: string) {
  return {
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}
