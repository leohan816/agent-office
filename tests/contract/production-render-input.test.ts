import { describe, expect, it } from 'vitest';

import { ORGANIZATION_EVIDENCE, ORGANIZATION_REGISTRY } from '../../fixtures/organization-registry.js';
import {
  COMMITTED_OFFICE_LAYOUT_CONFIG_V1,
  DEFAULT_VIEWPORT,
  assembleOfficeLayout,
  composeLivingOfficeProductionRenderInput,
  parseLivingOfficeProductionRenderInput,
  parseRawLivingOfficePresentation,
  projectOrganizationFrame,
  type OrganizationFrame,
} from '../../src/application/organization/index.js';
import type { CommittedOfficeLayoutConfigV1 } from '../../src/ui/pixel/contracts.js';
import type { LivingOfficePresentationV1 } from '../../src/runtime/projection.js';

const EVALUATED_AT = '2026-07-12T00:00:00.000Z';

function frame(): OrganizationFrame {
  return projectOrganizationFrame({
    registry: ORGANIZATION_REGISTRY,
    evidence: ORGANIZATION_EVIDENCE,
    runtime: [
      { roleInstanceId: 'agent-office-worker', mission: 'MODERN_OFFICE', workUnit: 'BA-WU-01', observableName: 'WORKING' },
      { roleInstanceId: 'foundation-reviewer', mission: 'MODERN_OFFICE', workUnit: 'BA-WU-01', observableName: 'REVIEWING' },
    ],
    evaluatedAt: EVALUATED_AT,
  });
}

function presentation(overrides: Partial<LivingOfficePresentationV1> = {}): LivingOfficePresentationV1 {
  return {
    schemaVersion: 'agent-office.living-office-presentation.v1',
    projectionRevision: 0,
    evaluatedAt: EVALUATED_AT,
    frame: frame(),
    ...overrides,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('§3.1.2 raw livingOffice untrusted-boundary parser', () => {
  it('accepts a well-formed presentation whose revision equals the enclosing snapshot', () => {
    expect(parseRawLivingOfficePresentation(presentation(), 0)).not.toBeNull();
  });

  it.each([
    ['wrong schemaVersion', () => presentation({ schemaVersion: 'nope' as never }), 0],
    ['revision != enclosing', () => presentation(), 5],
    ['negative revision', () => presentation({ projectionRevision: -1 }), -1],
    ['non-canonical evaluatedAt', () => presentation({ evaluatedAt: '2026-07-12T00:00:00Z' }), 0],
  ] as const)('rejects %s → null', (_label, build, enclosing) => {
    expect(parseRawLivingOfficePresentation(build(), enclosing)).toBeNull();
  });

  it('rejects an unknown extra top-level key', () => {
    const raw = { ...clone(presentation()), extra: true };
    expect(parseRawLivingOfficePresentation(raw, 0)).toBeNull();
  });

  it('rejects a duplicate actor roleInstanceId (fails closed, never first-wins)', () => {
    const raw = clone(presentation());
    const first = raw.frame.actors[0];
    (raw.frame.actors as unknown[]).push(clone(first));
    expect(parseRawLivingOfficePresentation(raw, 0)).toBeNull();
  });

  it('rejects canReceiveWork=true while advisorTeam is UNASSIGNED', () => {
    const raw = clone(presentation());
    const actor = raw.frame.actors[0] as unknown as { advisorTeam: { value: string }; canReceiveWork: boolean };
    actor.advisorTeam.value = 'UNASSIGNED';
    actor.canReceiveWork = true;
    expect(parseRawLivingOfficePresentation(raw, 0)).toBeNull();
  });

  it('rejects an invalid fact-envelope enum value', () => {
    const raw = clone(presentation());
    (raw.frame.actors[0] as unknown as { operationalState: { value: string } }).operationalState.value = 'BOGUS';
    expect(parseRawLivingOfficePresentation(raw, 0)).toBeNull();
  });
});

describe('§3.1 deterministic pod assembly', () => {
  const assembly = assembleOfficeLayout(presentation(), COMMITTED_OFFICE_LAYOUT_CONFIG_V1);
  const [foundationPod, vibenewsPod] = COMMITTED_OFFICE_LAYOUT_CONFIG_V1.pods;
  if (foundationPod === undefined || vibenewsPod === undefined) throw new Error('committed layout pods missing');

  it('builds two pods, each with a valid matching-Team ADVISOR responsible', () => {
    expect(assembly.fallbackTier).toBe('NONE');
    expect(assembly.pods.map((pod) => pod.podId)).toEqual(['pod:foundation', 'pod:vibenews']);
    const foundation = assembly.pods.find((pod) => pod.podId === 'pod:foundation');
    expect(foundation?.responsibleAdvisorRoleInstanceId).toBe('foundation-advisor');
    expect(foundation?.advisorTeamId).toBe('FOUNDATION_ADVISOR_TEAM');
  });

  it('selects the current actor by the 14-state priority order (WORKING wins)', () => {
    const foundation = assembly.pods.find((pod) => pod.podId === 'pod:foundation');
    expect(foundation?.currentActorRoleInstanceId).toBe('agent-office-worker');
    expect(foundation?.operationalState).toBe('WORKING');
  });

  it('uses the sole projectKey for identity and fails progress closed to 0', () => {
    const foundation = assembly.pods.find((pod) => pod.podId === 'pod:foundation');
    expect(foundation?.projectIdentity.projectId).toBe('FOUNDATION');
    expect([foundation?.completedWorkUnits, foundation?.totalWorkUnits, foundation?.completedGates, foundation?.totalGates])
      .toEqual([0, 0, 0, 0]);
    expect(foundation?.blockerSummary).toBeNull();
  });

  it('omits a pod whose responsible Advisor is not exactly one matching-Team ADVISOR member', () => {
    const broken: CommittedOfficeLayoutConfigV1 = {
      ...COMMITTED_OFFICE_LAYOUT_CONFIG_V1,
      pods: [{
        ...foundationPod,
        responsibleAdvisorRoleInstanceId: 'agent-office-worker', // a WORKER, not an ADVISOR
      }, vibenewsPod],
    };
    const result = assembleOfficeLayout(presentation(), broken);
    expect(result.pods.map((pod) => pod.podId)).toEqual(['pod:vibenews']);
    expect(result.diagnostics.some((d) => d.detail.includes('pod:foundation'))).toBe(true);
  });

  it('falls back to M1_FIXED_STATIONS when no valid pod remains', () => {
    const noAdvisor: CommittedOfficeLayoutConfigV1 = {
      ...COMMITTED_OFFICE_LAYOUT_CONFIG_V1,
      pods: COMMITTED_OFFICE_LAYOUT_CONFIG_V1.pods.map((pod) => ({ ...pod, responsibleAdvisorRoleInstanceId: null })),
    };
    expect(assembleOfficeLayout(presentation(), noAdvisor).fallbackTier).toBe('M1_FIXED_STATIONS');
  });

  it('drops an actor listed in more than one pod from all pods', () => {
    const cloned: CommittedOfficeLayoutConfigV1 = {
      ...COMMITTED_OFFICE_LAYOUT_CONFIG_V1,
      pods: [
        foundationPod,
        { ...vibenewsPod, memberRoleInstanceIds: ['vibenews-advisor', 'vibenews-worker', 'agent-office-worker'] },
      ],
    };
    const result = assembleOfficeLayout(presentation(), cloned);
    const allMembers = result.pods.flatMap((pod) => pod.actorRoleInstanceIds);
    expect(allMembers).not.toContain('agent-office-worker');
    expect(result.diagnostics.some((d) => d.roleInstanceId === 'agent-office-worker')).toBe(true);
  });
});

describe('§3.1.1 composed render-input wrapper validation (a cast is not validation)', () => {
  const wrapper = () => composeLivingOfficeProductionRenderInput({
    operational: presentation(),
    committedLayout: COMMITTED_OFFICE_LAYOUT_CONFIG_V1,
    viewport: { width: 1400, height: 800 },
    selectedPodId: 'pod:foundation',
    logicalTimeMs: 0,
  });

  it('accepts a well-formed wrapper', () => {
    const result = parseLivingOfficeProductionRenderInput(wrapper());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.selection.selectedPodId).toBe('pod:foundation');
  });

  it('rejects a non-empty cues field (PRC-3) to DOM_STATIC', () => {
    const result = parseLivingOfficeProductionRenderInput({ ...wrapper(), cues: [{ any: 1 }] });
    expect(result).toMatchObject({ ok: false, fallbackTier: 'DOM_STATIC' });
  });

  it('rejects a wrong wrapper schema to DOM_STATIC', () => {
    const result = parseLivingOfficeProductionRenderInput({ ...wrapper(), schemaVersion: 'nope' });
    expect(result).toMatchObject({ ok: false, fallbackTier: 'DOM_STATIC' });
  });

  it('substitutes literal committed defaults for an invalid viewport / logicalTimeMs', () => {
    const result = parseLivingOfficeProductionRenderInput({ ...wrapper(), viewport: { width: 0, height: -5 }, logicalTimeMs: Number.NaN });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.viewport).toEqual(DEFAULT_VIEWPORT);
      expect(result.value.logicalTimeMs).toBe(0);
    }
  });

  it('falls an invalid selection to the committed default pod', () => {
    const result = parseLivingOfficeProductionRenderInput({ ...wrapper(), selection: { selectedPodId: 'pod:nonexistent' } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.selection.selectedPodId).toBe('pod:foundation');
  });

  it('accepts monotonic logicalTimeMs zero as valid', () => {
    const result = parseLivingOfficeProductionRenderInput({ ...wrapper(), logicalTimeMs: 0 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.logicalTimeMs).toBe(0);
  });
});
