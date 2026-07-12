// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ACCEPTED_EVIDENCE_SCHEMA_VERSION,
  projectOrganizationFrame,
  type AcceptedEvidenceKind,
  type AcceptedEvidenceRecord,
  type OrganizationFrameActor,
  type OrganizationRegistryRow,
  type RuntimeWorkInput,
} from '../../src/application/organization/index.js';
import type { PixelPrototypeViewOptions, PixelWorldFrameV1 } from '../../src/ui/pixel/contracts.js';
import { LIVING_PIXEL_PROTOTYPE_PROJECTION } from '../../src/ui/pixel/fixtures/prototype-projection.js';
import { projectPixelWorldFrame } from '../../src/ui/pixel/frame-projector.js';
import { LivingOfficeActorOverlay } from '../../src/ui/pixel/living-office-actor-overlay.js';
import { createPixelWorldLayout } from '../../src/ui/pixel/world-layout.js';

afterEach(cleanup);

const EVALUATED_AT = '2026-07-12T00:00:00.000Z';
const EFFECTIVE = '2026-07-05T00:00:00.000Z';
const TARGET = 'worker.foundation.primary';
const layout = createPixelWorldLayout(LIVING_PIXEL_PROTOTYPE_PROJECTION.pods);

// The exact contract §2.7 complete ordered detail set (roleInstanceId first, then 16 fields).
const DETAIL_LABELS = [
  'Role instance', 'Role', 'Project', 'Display name', 'Advisor Team', 'Reports-to Advisor',
  'Assigned by', 'Returns result to', 'Session name', 'Session process', 'AI identity', 'Model',
  'Effort', 'AI runtime state', 'Operational state', 'Mission', 'WorkUnit',
];

let seq = 0;
function ev(kind: AcceptedEvidenceKind, value?: string): AcceptedEvidenceRecord {
  seq += 1;
  const seed = (3000 + seq).toString(16);
  return {
    schemaVersion: ACCEPTED_EVIDENCE_SCHEMA_VERSION,
    evidenceId: `01983000-0000-7000-8000-${seed.padStart(12, '0')}`,
    evidenceRef: `sha256:${seed.padStart(64, '0')}`,
    kind,
    roleInstanceId: TARGET,
    ...(value === undefined ? {} : { value }),
    provenance: 'VERIFIED_MISSION_ARTIFACT',
    acceptanceStatus: 'ACCEPTED',
    sourceEventIds: [`01983000-0000-7000-8000-${`5${seed}`.padStart(12, '0')}`],
    observedAt: EFFECTIVE,
    effectiveFrom: EFFECTIVE,
  };
}

function organizationActor(overrides: {
  runtime?: RuntimeWorkInput;
  evidence?: readonly AcceptedEvidenceRecord[];
  registry?: Partial<OrganizationRegistryRow>;
} = {}): OrganizationFrameActor {
  const registry: OrganizationRegistryRow = {
    roleInstanceId: TARGET,
    role: 'WORKER',
    project: 'FOUNDATION',
    stableDisplayName: 'Foundation Worker',
    advisorTeam: 'FOUNDATION_ADVISOR_TEAM',
    reportsToAdvisor: 'foundation-advisor',
    assignedBy: 'foundation-advisor',
    returnsResultTo: 'foundation-advisor',
    sessionName: 'foundation-worker',
    allowedAiIdentities: ['CLAUDE_OPUS_4_8'],
    allowedModels: ['claude-opus-4-8'],
    allowedEfforts: ['ULTRACODE'],
    provenance: 'VERIFIED_REGISTRY',
    ...overrides.registry,
  };
  const frame = projectOrganizationFrame({
    registry: [registry],
    runtime: overrides.runtime === undefined ? [] : [overrides.runtime],
    evidence: overrides.evidence ?? [],
    evaluatedAt: EVALUATED_AT,
  });
  const actor = frame.actors.find((candidate) => candidate.roleInstanceId === TARGET);
  if (actor === undefined) throw new Error('organization actor missing');
  return actor;
}

function renderOverlay(actor: OrganizationFrameActor) {
  const options: PixelPrototypeViewOptions = {
    selectedPodId: 'pod:foundation',
    logicalTimeMs: 0,
    presentationTier: 'PIXEL_FULL',
    scenarioId: 'full-office',
    cameraOverride: null,
    viewportWidth: 1400,
    viewportHeight: 620,
  };
  const base = projectPixelWorldFrame(LIVING_PIXEL_PROTOTYPE_PROJECTION, layout, options);
  const frame: PixelWorldFrameV1 = {
    ...base,
    actorFrames: base.actorFrames.map((frameActor) =>
      frameActor.roleInstanceId === TARGET ? { ...frameActor, organizationFacts: actor } : frameActor),
  };
  return render(
    <LivingOfficeActorOverlay
      frame={frame}
      projection={LIVING_PIXEL_PROTOTYPE_PROJECTION}
      viewportHeight={620}
      viewportWidth={1400}
    />,
  );
}

function openDrawer(container: HTMLElement): HTMLElement {
  const label = container.querySelector<HTMLButtonElement>(`[data-actor-label="${TARGET}"]`);
  if (label === null) throw new Error('actor label missing');
  label.focus();
  fireEvent.click(label);
  return screen.getByRole('dialog');
}

describe('BA-WU-04 accessible actor detail dialog (contract §2.7 complete field contract)', () => {
  const attested = () => organizationActor({
    runtime: { roleInstanceId: TARGET, mission: 'MODERN_OFFICE', workUnit: 'BA-WU-04', observableName: 'TESTING' },
    evidence: [ev('process_detected'), ev('ai_identity_attestation', 'CLAUDE_OPUS_4_8'), ev('model_attestation', 'claude-opus-4-8'), ev('effort_attestation', 'ULTRACODE'), ev('ai_ready')],
  });

  it('renders exactly the 17 ordered fields, each with value + source + status', () => {
    const { container } = renderOverlay(attested());
    const dialog = openDrawer(container);
    const rows = dialog.querySelectorAll('[data-actor-fact]');
    expect(rows).toHaveLength(17);
    expect([...rows].map((row) => row.getAttribute('data-actor-fact'))).toEqual(DETAIL_LABELS);
    for (const row of rows) {
      expect(row.getAttribute('data-actor-fact-source')).not.toBeNull();
      expect(row.getAttribute('data-actor-fact-status')).not.toBeNull();
    }
    expect(dialog.querySelector('[data-actor-fact="Model"]')?.getAttribute('data-actor-fact-source')).toBe('VERIFIED_MISSION_ARTIFACT');
    expect(dialog.querySelector('[data-actor-fact="Model"]')?.getAttribute('data-actor-fact-status')).toBe('VERIFIED');
    // operational-work (TESTING) and AI-runtime (AI_WORKING, since active work precedes the ai_ready
    // record per §2.3.2) are separate vocabularies and never conflated.
    expect(dialog.querySelector('[data-actor-fact="Operational state"]')?.textContent).toContain('TESTING');
    expect(dialog.querySelector('[data-actor-fact="AI runtime state"]')?.textContent).toContain('AI_WORKING');
  });

  it('names the dialog by stable display name and marks it modal', () => {
    const { container } = renderOverlay(attested());
    const dialog = openDrawer(container);
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('living-office-actor-detail-heading');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Foundation Worker');
  });

  it('focuses close on open, contains Tab, and restores invoker focus on Escape', () => {
    const { container } = renderOverlay(attested());
    const label = container.querySelector<HTMLButtonElement>(`[data-actor-label="${TARGET}"]`);
    const dialog = openDrawer(container);
    const close = screen.getByRole('button', { name: 'Close actor detail' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(label);
  });

  it('renders fail-closed sentinels with MISSING status and UNVERIFIED source when evidence is absent', () => {
    const { container } = renderOverlay(organizationActor());
    const dialog = openDrawer(container);
    const identity = dialog.querySelector('[data-actor-fact="AI identity"]');
    expect(identity?.textContent).toContain('AI_IDENTITY_UNKNOWN');
    expect(identity?.getAttribute('data-actor-fact-source')).toBe('UNVERIFIED');
    expect(identity?.getAttribute('data-actor-fact-status')).toBe('MISSING');
    expect(dialog.querySelector('[data-actor-fact="Operational state"]')?.getAttribute('data-actor-fact-status')).toBe('MISSING');
  });

  it('marks an UNASSIGNED actor as unable to receive work', () => {
    const actor = organizationActor({ registry: { advisorTeam: 'NOPE' as never } });
    const { container } = renderOverlay(actor);
    const dialog = openDrawer(container);
    expect(dialog.getAttribute('data-actor-can-receive-work')).toBe('false');
    expect(dialog.querySelector('[data-actor-fact="Advisor Team"]')?.textContent).toContain('UNASSIGNED');
    expect(dialog.textContent).toContain('cannot receive work');
  });
});
