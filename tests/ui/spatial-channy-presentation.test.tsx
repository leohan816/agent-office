// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ChannyPresentation,
  projectChannyPresentation,
  type ChannyPresentationInput,
} from '../../src/ui/spatial/channy-presentation.js';
import type { SpatialCueEnvelope, SpatialCueKind } from '../../src/ui/spatial/cue-projector.js';
import {
  projectVerifiedIdle,
  VerifiedIdleLounge,
  type VerifiedIdlePresentationInput,
} from '../../src/ui/spatial/lounge.js';

afterEach(cleanup);

describe('AO12-IWU-10 verified-idle and Channy boundaries', () => {
  it('projects Channy from accepted presentation facts with fixed safe precedence', () => {
    const route = cue('DELIVERY', 1);
    expect(projectChannyPresentation(input([route]))).toMatchObject({
      mode: 'FOLLOW_ACCEPTED_ROUTE',
      motionAllowed: true,
      sourceCueId: route.cueId,
    });
    expect(projectChannyPresentation(input([route], { tier: 'STATIC' })).motionAllowed).toBe(false);
    expect(projectChannyPresentation(input([route, cue('WAITING_LEO', 2)])).mode).toBe('REFLECT_WAITING_LEO');
    expect(projectChannyPresentation(input([cue('BLOCKED', 3), cue('WAITING_LEO', 2)])).mode).toBe('REFLECT_BLOCKED');
    expect(projectChannyPresentation(input([], { missionComplete: true })).mode).toBe('REFLECT_COMPLETION');
    expect(projectChannyPresentation(input([], { evidenceFreshness: 'STALE' }))).toMatchObject({
      mode: 'REFLECT_STALE_OFFLINE_STATIC',
      motionAllowed: false,
    });
    expect(projectChannyPresentation(input([])).mode).toBe('NEUTRAL_AMBIENT');
  });

  it('renders one global non-actor Channy and keeps primary status independent', () => {
    const { container } = render(<ChannyPresentation input={input([cue('WAITING_LEO', 2)])} />);
    expect(container.querySelectorAll('[data-channy-mode]')).toHaveLength(1);
    expect(container.querySelector('[data-channy-mode]')?.getAttribute('data-channy-motion')).toBe('STATIC');
    expect(screen.getByText(/NON_ACTOR \/ NO_AUTHORITY \/ NO_ASSIGNMENT \/ NO_COMMAND/u)).not.toBeNull();
    expect(screen.getByText(/Primary status, alert, board, and activity log remain independent/u)).not.toBeNull();
  });

  it('admits only current connected exact IDLE evidence and operational state wins', () => {
    const idle = idleInput();
    expect(projectVerifiedIdle(idle)).toMatchObject({ eligible: true, diagnosticCode: 'VERIFIED_IDLE' });
    for (const variant of [
      { ...idle, operationalState: 'WORKING' as const },
      { ...idle, evidenceFreshness: 'STALE' as const },
      { ...idle, connectionState: 'OFFLINE' as const },
      { ...idle, assignmentVerified: false },
      { ...idle, idleEvidenceVerified: false },
    ]) {
      expect(projectVerifiedIdle(variant).eligible).toBe(false);
    }
  });

  it('shows at most one ambient actor and removes it when that actor has an operational cue', () => {
    const first = idleInput();
    const second = { ...idleInput(), roleInstanceId: 'worker.second' };
    const { container, rerender } = render(
      <VerifiedIdleLounge candidates={[first, second]} operationalCues={[]} tier="FULL" />,
    );
    expect(container.querySelectorAll('[data-idle-presentation]')).toHaveLength(1);
    expect(screen.getByText(/No availability, assignment, shared context, collaboration/u)).not.toBeNull();
    rerender(<VerifiedIdleLounge candidates={[first]} operationalCues={[cue('WORKING', 4, first.roleInstanceId)]} tier="FULL" />);
    expect(container.querySelector('[data-idle-presentation]')).toBeNull();
  });

  it('does not expose operational Channy controls, event subscriptions, commands, or inferred dialogue', () => {
    const { container } = render(<ChannyPresentation input={input([])} />);
    expect(container.querySelector('button, a, input, textarea, select')).toBeNull();
    expect(container.textContent).not.toMatch(/dispatch target|approve|repair|terminal|session content|dialogue:/iu);
  });
});

function input(
  cues: readonly SpatialCueEnvelope[],
  overrides: Partial<ChannyPresentationInput> = {},
): ChannyPresentationInput {
  return {
    cues,
    evidenceFreshness: 'CURRENT',
    connectionState: 'CONNECTED',
    missionComplete: false,
    tier: 'FULL',
    ...overrides,
  };
}

function cue(kind: SpatialCueKind, id: number, roleInstanceId = 'worker.agent-office.primary'): SpatialCueEnvelope {
  return {
    schemaVersion: 'agent-office.spatial-cue.v1',
    cueId: `sha256:${id.toString(16).padStart(64, '0')}`,
    cueKind: kind,
    projectId: 'agent-office',
    podId: 'pod:agent-office',
    missionId: 'mission-ao12',
    workUnitId: `AO12-IWU-${String(id).padStart(2, '0')}`,
    roleInstanceId,
    sourceEventIds: [`00000000-0000-7${id.toString(16).padStart(3, '0')}-8000-${id.toString().padStart(12, '0')}`],
    missionSequence: id,
    projectionRevision: 13,
    sourceZoneId: kind === 'DELIVERY' ? 'advisor-anchor' : `work:${roleInstanceId}`,
    ...(kind === 'DELIVERY' ? { targetZoneId: `work:${roleInstanceId}` } : {}),
    evidenceFreshness: 'CURRENT',
    connectionState: 'CONNECTED',
    createdFromOrigin: 'LIVE_DELTA',
    durationMs: kind === 'BLOCKED' ? 150 : 900,
    staticEquivalentCode: `${kind}_STATIC_TEXT`,
  };
}

function idleInput(): VerifiedIdlePresentationInput {
  return {
    roleInstanceId: 'worker.cosmile.primary',
    advisorTeamId: 'FOUNDATION_ADVISOR_TEAM',
    responsibleAdvisorRoleInstanceId: 'advisor.foundation.primary',
    operationalState: 'IDLE',
    evidenceFreshness: 'CURRENT',
    connectionState: 'CONNECTED',
    assignmentVerified: true,
    idleEvidenceVerified: true,
    evaluatedAt: '2026-07-11T12:00:00.000Z',
    presentation: 'COFFEE',
  };
}
