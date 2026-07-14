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
  type ProductionRenderInputResult,
} from '../../src/application/organization/index.js';
import { assertFrameSemanticParity } from '../../src/ui/pixel/frame-core.js';
import {
  CHANNY_AMBIENT_LOOP_MS,
  CHANNY_AMBIENT_STATES,
  productionChannyAmbientPose,
} from '../../src/ui/pixel/presentation-clock.js';
import { projectLivingOfficeFrame } from '../../src/ui/pixel/production-frame-projector.js';
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
    // After the pre-AS1 identity migration the Foundation pod's responsible Advisor is the newly
    // created Foundation Advisor (roleInstanceId foundation-advisor-20260714-01), still FOUNDATION_ADVISOR_TEAM.
    expect(foundation?.responsibleAdvisorRoleInstanceId).toBe('foundation-advisor-20260714-01');
    expect(foundation?.advisorTeamId).toBe('FOUNDATION_ADVISOR_TEAM');
  });

  it('selects the current actor by the 14-state priority order (REVIEWING wins in the Foundation pod)', () => {
    // agent-office-worker (WORKING) is now an Agent Office Team actor, not a Foundation pod member, so
    // the highest-priority Foundation member is the reviewer (REVIEWING).
    const foundation = assembly.pods.find((pod) => pod.podId === 'pod:foundation');
    expect(foundation?.currentActorRoleInstanceId).toBe('foundation-reviewer');
    expect(foundation?.operationalState).toBe('REVIEWING');
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
        { ...vibenewsPod, memberRoleInstanceIds: ['vibenews-advisor', 'vibenews-worker', 'cosmile-worker'] },
      ],
    };
    const result = assembleOfficeLayout(presentation(), cloned);
    const allMembers = result.pods.flatMap((pod) => pod.actorRoleInstanceIds);
    expect(allMembers).not.toContain('cosmile-worker');
    expect(result.diagnostics.some((d) => d.roleInstanceId === 'cosmile-worker')).toBe(true);
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

describe('SIR-4 total no-throw committed-layout validation before assembly', () => {
  const baseWrapper = () => composeLivingOfficeProductionRenderInput({
    operational: presentation(),
    committedLayout: COMMITTED_OFFICE_LAYOUT_CONFIG_V1,
    viewport: { width: 1400, height: 800 },
    selectedPodId: 'pod:foundation',
    logicalTimeMs: 0,
  });
  const withLayout = (layout: unknown): unknown => ({ ...baseWrapper(), committedLayout: layout });
  const validLayout = (): CommittedOfficeLayoutConfigV1 => clone(COMMITTED_OFFICE_LAYOUT_CONFIG_V1);

  const [firstPod, secondPod] = COMMITTED_OFFICE_LAYOUT_CONFIG_V1.pods;
  if (firstPod === undefined || secondPod === undefined) throw new Error('committed layout fixture must have two pods');
  const firstMember = firstPod.memberRoleInstanceIds[0];
  if (firstMember === undefined) throw new Error('committed pod fixture must have members');

  const hostileLayouts: readonly (readonly [string, unknown])[] = [
    ['a null layout', null],
    ['a string layout', 'agent-office.committed-office-layout-config.v1'],
    ['an array layout', []],
    ['a wrong layout schema', { ...validLayout(), schemaVersion: 'nope' }],
    ['a layout with an unknown extra key', { ...validLayout(), unexpected: true }],
    ['a layout with no pods field (SIR-4 repro: was a throw)', { schemaVersion: 'agent-office.committed-office-layout-config.v1' }],
    ['non-array pods', { ...validLayout(), pods: 'nope' }],
    ['empty pods', { ...validLayout(), pods: [] }],
    ['a pod with a non-array member list', { ...validLayout(), pods: [{ ...firstPod, memberRoleInstanceIds: 'x' }] }],
    ['a pod with an empty member list', { ...validLayout(), pods: [{ ...firstPod, memberRoleInstanceIds: [] }] }],
    ['a pod with the UNASSIGNED sentinel Team', { ...validLayout(), pods: [{ ...firstPod, advisorTeamId: 'UNASSIGNED' }, secondPod] }],
    ['a pod with a blank podId', { ...validLayout(), pods: [{ ...firstPod, podId: '  ' }, secondPod] }],
    ['duplicate pod ids', { ...validLayout(), pods: [firstPod, { ...secondPod, podId: firstPod.podId }] }],
    ['a duplicate actor id inside one pod', { ...validLayout(), pods: [{ ...firstPod, memberRoleInstanceIds: [firstMember, firstMember] }, secondPod] }],
    ['an incomplete role-category map (SIR-4 repro: was accepted)', { ...validLayout(), roleCategoryByRole: {} }],
    ['an invalid role category', { ...validLayout(), roleCategoryByRole: { ...validLayout().roleCategoryByRole, WORKER: 'BOGUS' } }],
    ['an extra role-map key', { ...validLayout(), roleCategoryByRole: { ...validLayout().roleCategoryByRole, GHOST: 'WORKER_BUILD' } }],
    ['an invalid default role category', { ...validLayout(), defaultRoleCategory: 'ADVISOR_ROUTING' }],
    ['an invalid project-identity pattern', { ...validLayout(), defaultProjectIdentity: { ...validLayout().defaultProjectIdentity, pattern: 'ZIGZAG' } }],
    ['a non-numeric identity color', { ...validLayout(), defaultProjectIdentity: { ...validLayout().defaultProjectIdentity, primaryColor: 'red' } }],
    ['a blank identity id', { ...validLayout(), defaultProjectIdentity: { ...validLayout().defaultProjectIdentity, identityId: '' } }],
  ];

  it.each(hostileLayouts)('rejects %s deterministically without throwing', (_label, hostile) => {
    let result: ProductionRenderInputResult | undefined;
    expect(() => { result = parseLivingOfficeProductionRenderInput(withLayout(hostile)); }).not.toThrow();
    expect(result?.ok).toBe(false);
    if (result !== undefined && !result.ok) {
      expect(typeof result.reason).toBe('string');
      expect(['DOM_STATIC', 'M1_FIXED_STATIONS']).toContain(result.fallbackTier);
    }
  });

  it('still accepts the well-formed committed layout', () => {
    expect(parseLivingOfficeProductionRenderInput(baseWrapper()).ok).toBe(true);
  });
});

describe('I2-3 exact pre-assembly selection / committed-default / membership validation', () => {
  const baseWrapper = () => composeLivingOfficeProductionRenderInput({
    operational: presentation(),
    committedLayout: COMMITTED_OFFICE_LAYOUT_CONFIG_V1,
    viewport: { width: 1400, height: 800 },
    selectedPodId: 'pod:foundation',
    logicalTimeMs: 0,
  });
  const withSelection = (selection: unknown): unknown => ({ ...baseWrapper(), selection });
  const withLayout = (layout: unknown): unknown => ({ ...baseWrapper(), committedLayout: layout });
  const validLayout = (): CommittedOfficeLayoutConfigV1 => clone(COMMITTED_OFFICE_LAYOUT_CONFIG_V1);
  const [firstPod, secondPod] = COMMITTED_OFFICE_LAYOUT_CONFIG_V1.pods;
  if (firstPod === undefined || secondPod === undefined) throw new Error('committed layout fixture must have two pods');
  const firstMember = firstPod.memberRoleInstanceIds[0];
  if (firstMember === undefined) throw new Error('committed pod fixture must have members');

  const noThrow = (input: unknown): ProductionRenderInputResult => {
    let result: ProductionRenderInputResult | undefined;
    expect(() => { result = parseLivingOfficeProductionRenderInput(input); }).not.toThrow();
    if (result === undefined) throw new Error('parser returned no result');
    return result;
  };

  it('rejects a committed default that is not the canonical-first pod, to M1', () => {
    expect(noThrow(withLayout({ ...validLayout(), selectedDefaultPodId: 'pod:vibenews' })))
      .toMatchObject({ ok: false, fallbackTier: 'M1_FIXED_STATIONS' });
  });
  it('rejects a non-existent committed default, to M1', () => {
    expect(noThrow(withLayout({ ...validLayout(), selectedDefaultPodId: 'pod:missing' })))
      .toMatchObject({ ok: false, fallbackTier: 'M1_FIXED_STATIONS' });
  });
  it('rejects cross-pod actor membership before assembly', () => {
    const cloned = { ...validLayout(), pods: [firstPod, { ...secondPod, memberRoleInstanceIds: [...secondPod.memberRoleInstanceIds, firstMember] }] };
    expect(noThrow(withLayout(cloned))).toMatchObject({ ok: false });
  });
  it('rejects a responsible Advisor that is not a member of its pod', () => {
    const bad = { ...validLayout(), pods: [{ ...firstPod, responsibleAdvisorRoleInstanceId: 'ghost-advisor' }, secondPod] };
    expect(noThrow(withLayout(bad))).toMatchObject({ ok: false });
  });

  it.each([
    ['a null selection', null],
    ['an array selection', []],
    ['a selection with an extra key', { selectedPodId: 'pod:foundation', extra: 1 }],
    ['a numeric selectedPodId', { selectedPodId: 42 }],
    ['a missing selectedPodId', {}],
  ] as const)('rejects %s to DOM_STATIC without throwing', (_label, selection) => {
    expect(noThrow(withSelection(selection))).toMatchObject({ ok: false, fallbackTier: 'DOM_STATIC' });
  });

  it('preserves the documented fallback: a well-formed but unknown selectedPodId string uses the committed default', () => {
    const result = noThrow(withSelection({ selectedPodId: 'pod:unknown-but-well-formed' }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.selection.selectedPodId).toBe('pod:foundation');
  });

  it('still accepts the exact well-formed selection', () => {
    const result = noThrow(baseWrapper());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.selection.selectedPodId).toBe('pod:foundation');
  });
});

describe('production-frame-projector builds a fixture-free PixelWorldFrameV1', () => {
  it('produces a semantic-parity-valid frame with organization facts and no cues/route', () => {
    const wrapper = composeLivingOfficeProductionRenderInput({
      operational: presentation(),
      committedLayout: COMMITTED_OFFICE_LAYOUT_CONFIG_V1,
      viewport: { width: 1400, height: 800 },
      selectedPodId: 'pod:foundation',
      logicalTimeMs: 0,
    });
    const result = parseLivingOfficeProductionRenderInput(wrapper);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const frame = projectLivingOfficeFrame(result.value, { presentationTier: 'PIXEL_FULL' });
    expect(frame.schemaVersion).toBe('agent-office.pixel-world-frame.v1');
    expect(frame.sceneId).toBe('living-office');
    expect(frame.selectedPodId).toBe('pod:foundation');
    expect(assertFrameSemanticParity(frame)).toBe(true);
    expect(frame.actorFrames.length).toBeGreaterThan(0);
    expect(frame.actorFrames.every((actor) => actor.organizationFacts !== undefined)).toBe(true);
    expect(frame.route).toBeNull();
    expect(frame.acceptedCueIds).toEqual([]);
    expect(frame.camera.mode).toBe('FULL_OFFICE');
    expect(frame.channy.authorityRole).toBe('none');
  });

  it('cycles the fixture-free ambient Channy through all eight states with no authority (SIR-5)', () => {
    const wrapper = composeLivingOfficeProductionRenderInput({
      operational: presentation(),
      committedLayout: COMMITTED_OFFICE_LAYOUT_CONFIG_V1,
      viewport: { width: 1400, height: 800 },
      selectedPodId: 'pod:foundation',
      logicalTimeMs: 0,
    });
    const result = parseLivingOfficeProductionRenderInput(wrapper);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const seenStates = new Set<string>();
    const positions = new Set<string>();
    for (let logicalTimeMs = 0; logicalTimeMs <= CHANNY_AMBIENT_LOOP_MS; logicalTimeMs += 100) {
      const frame = projectLivingOfficeFrame({ ...result.value, logicalTimeMs }, { presentationTier: 'PIXEL_FULL' });
      // Non-operational boundary: Channy never carries authority; it is a global ambient entity.
      expect(frame.channy.authorityRole).toBe('none');
      expect(frame.channy.entityId).toBe('channy.global');
      // Channy state is derived purely from logical time — identical to the pure ambient clock.
      expect(frame.channy.animation).toBe(productionChannyAmbientPose(logicalTimeMs).animation);
      seenStates.add(frame.channy.animation);
      positions.add(`${Math.round(frame.channy.x)},${Math.round(frame.channy.y)}`);
    }
    // All eight ambient states appear, and Channy actually moves (not a constant STOP at one anchor).
    expect([...seenStates].sort()).toEqual([...CHANNY_AMBIENT_STATES].sort());
    expect(positions.size).toBeGreaterThan(5);
  });
});
