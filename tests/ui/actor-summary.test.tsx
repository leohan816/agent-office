// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
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
import { PIXEL_ACTOR_FACT_SOURCE_LABELS } from '../../src/ui/pixel/contracts.js';
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

let seq = 0;
function ev(kind: AcceptedEvidenceKind, value?: string): AcceptedEvidenceRecord {
  seq += 1;
  const seed = (2000 + seq).toString(16);
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

function frameWithOrganization(actor: OrganizationFrameActor): PixelWorldFrameV1 {
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
  return {
    ...base,
    actorFrames: base.actorFrames.map((frameActor) =>
      frameActor.roleInstanceId === TARGET ? { ...frameActor, organizationFacts: actor } : frameActor),
  };
}

function renderOverlay(actor: OrganizationFrameActor) {
  return render(
    <LivingOfficeActorOverlay
      frame={frameWithOrganization(actor)}
      projection={LIVING_PIXEL_PROTOTYPE_PROJECTION}
      viewportHeight={620}
      viewportWidth={1400}
    />,
  );
}

describe('BA-WU-03 compact actor summary (contract §2.7 first layer)', () => {
  it('renders the nine compact fields (incl. Team) with a per-field source tag and glyph+ring', () => {
    const actor = organizationActor({
      runtime: { roleInstanceId: TARGET, mission: 'MODERN_OFFICE', workUnit: 'BA-WU-03', observableName: 'WORKING' },
      evidence: [ev('process_detected'), ev('ai_identity_attestation', 'CLAUDE_OPUS_4_8'), ev('model_attestation', 'claude-opus-4-8'), ev('effort_attestation', 'ULTRACODE'), ev('ai_ready')],
    });
    const { container } = renderOverlay(actor);
    const summary = container.querySelector(`[data-actor-summary="${TARGET}"]`);
    expect(summary).not.toBeNull();
    // A3-1: the required first layer includes the current Team (advisorTeam) as a distinct fact.
    for (const field of ['role', 'stableDisplayName', 'advisorTeam', 'sessionProcess', 'aiIdentity', 'model', 'effort', 'aiRuntimeState', 'operationalState']) {
      expect(summary?.querySelector(`[data-actor-summary-field="${field}"]`), field).not.toBeNull();
    }
    // team/process/identity/model/effort/runtime/operational carry a source tag (never color alone).
    expect(summary?.querySelector('[data-actor-summary-field="advisorTeam"]')?.getAttribute('data-actor-fact-source')).not.toBeNull();
    expect(summary?.querySelector('[data-actor-summary-field="model"]')?.getAttribute('data-actor-fact-source')).toBe('VERIFIED_MISSION_ARTIFACT');
    expect(summary?.querySelector('[data-actor-summary-field="operationalState"]')?.getAttribute('data-actor-fact-source')).toBe('VERIFIED_MISSION_ARTIFACT');
    const label = container.querySelector(`[data-actor-label="${TARGET}"]`);
    expect(label?.querySelector('.living-office-actor-label__glyph')?.textContent).toBe('W');
    expect(label?.querySelector('.living-office-actor-label__ring')?.getAttribute('data-state')).toBe('WORKING');
    expect(label?.textContent).toContain('AI_PROCESS_DETECTED');
    expect(label?.textContent).toContain('CLAUDE_OPUS_4_8');
    // active-work RT observable → §2.3.2 rule 4 (work) precedes the ai_ready record → AI_WORKING.
    expect(label?.textContent).toContain('AI_WORKING');
    expect(label?.textContent).toContain('WORKING');
  });

  it('announces the summary with sources in the accessible name', () => {
    const actor = organizationActor({ evidence: [ev('process_detected'), ev('ai_ready')] });
    renderOverlay(actor);
    const label = screen.getByRole('button', { name: /Foundation Worker\. Role WORKER\. Team [A-Z_]+, source .+?\..*Session process AI_PROCESS_DETECTED, source VERIFIED MISSION ARTIFACT\..*AI runtime AI_READY, source .+?\./u });
    expect(label).not.toBeNull();
  });

  it('A5-3: the accessible name states each compact fact\'s exact source phrase; abbreviating any fails', () => {
    const actor = organizationActor({
      runtime: { roleInstanceId: TARGET, mission: 'MODERN_OFFICE', workUnit: 'BA-WU-03', observableName: 'WORKING' },
      evidence: [ev('process_detected'), ev('ai_identity_attestation', 'CLAUDE_OPUS_4_8'), ev('model_attestation', 'claude-opus-4-8'), ev('effort_attestation', 'ULTRACODE'), ev('ai_ready')],
    });
    const { container } = renderOverlay(actor);
    const name = container.querySelector(`[data-actor-label="${TARGET}"]`)?.getAttribute('aria-label') ?? '';
    // Every compact fact must state its EXACT PIXEL_ACTOR_FACT_SOURCE_LABELS[source] phrase — a generic
    // "source <UPPERCASE>." is insufficient. Each negative abbreviates that one source and must fail.
    const facts: readonly (readonly [string, { value: string; source: keyof typeof PIXEL_ACTOR_FACT_SOURCE_LABELS }])[] = [
      ['Team', actor.advisorTeam],
      ['Session process', actor.sessionProcess],
      ['AI identity', actor.aiIdentity],
      ['Model', actor.model],
      ['Effort', actor.effort],
      ['AI runtime', actor.aiRuntimeState],
      ['Operational', actor.operationalState],
    ];
    for (const [label, fact] of facts) {
      const exact = `${label} ${fact.value}, source ${PIXEL_ACTOR_FACT_SOURCE_LABELS[fact.source]}.`;
      expect(name, `${label} exact source phrase`).toContain(exact);
      const abbreviated = name.replace(exact, `${label} ${fact.value}, source SRC.`);
      expect(abbreviated, `abbreviating ${label} source must break the exact phrase`).not.toContain(exact);
    }
  });

  it('separates AI-runtime state from operational-work state (never conflated)', () => {
    // detected + no ready + RT waiting → aiRuntime AI_WAITING, operational WAITING_LEO.
    const actor = organizationActor({
      runtime: { roleInstanceId: TARGET, mission: 'M', workUnit: 'W', observableName: 'WAITING_LEO' },
      evidence: [ev('process_detected')],
    });
    expect(actor.aiRuntimeState.value).toBe('AI_WAITING');
    expect(actor.operationalState.value).toBe('WAITING_LEO');
    const { container } = renderOverlay(actor);
    const summary = container.querySelector(`[data-actor-summary="${TARGET}"]`);
    expect(summary?.textContent).toContain('AI_WAITING');
    expect(summary?.textContent).toContain('WAITING_LEO');
  });

  it('fails closed to sentinels with correct source when evidence is absent', () => {
    const actor = organizationActor();
    const { container } = renderOverlay(actor);
    const summary = container.querySelector(`[data-actor-summary="${TARGET}"]`);
    expect(summary?.textContent).toContain('SESSION_PROCESS_UNKNOWN');
    expect(summary?.textContent).toContain('AI_IDENTITY_UNKNOWN');
    expect(summary?.textContent).toContain('MODEL_UNKNOWN');
    expect(summary?.textContent).toContain('EFFORT_UNKNOWN');
    expect(summary?.textContent).toContain('AI_RUNTIME_UNKNOWN');
    expect(summary?.querySelector('[data-actor-summary-field="model"]')?.getAttribute('data-actor-fact-source')).toBe('UNVERIFIED');
  });
});
