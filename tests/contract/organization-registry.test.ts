import { describe, expect, it } from 'vitest';

import {
  ORGANIZATION_EVIDENCE,
  ORGANIZATION_REGISTRY,
} from '../../fixtures/organization-registry.js';
import {
  ACCEPTED_EVIDENCE_SCHEMA_VERSION,
  arbitrateAiRuntimeState,
  dedupeByEvidenceId,
  mapOperationalState,
  projectOrganizationFrame,
  type AcceptedEvidenceKind,
  type AcceptedEvidenceRecord,
  type OrganizationFrameActor,
  type OrganizationRegistryRow,
  type RuntimeWorkInput,
} from '../../src/application/organization/index.js';
import { REQUIRED_OBSERVABLE_NAMES, type ObservableProjectionName } from '../../src/domain/activity/index.js';

const EVALUATED_AT = '2026-07-12T00:00:00.000Z';
const EFFECTIVE = '2026-07-05T00:00:00.000Z';

function uuid(seed: string): string {
  return `01983000-0000-7000-8000-${seed.padStart(12, '0')}`;
}
function ref(seed: string): string {
  return `sha256:${seed.padStart(64, '0')}`;
}

let seq = 0;
function ev(
  kind: AcceptedEvidenceKind,
  roleInstanceId: string,
  overrides: Partial<AcceptedEvidenceRecord> = {},
): AcceptedEvidenceRecord {
  seq += 1;
  const seed = (1000 + seq).toString(16);
  return {
    schemaVersion: ACCEPTED_EVIDENCE_SCHEMA_VERSION,
    evidenceId: uuid(seed),
    evidenceRef: ref(seed),
    kind,
    roleInstanceId,
    provenance: 'VERIFIED_MISSION_ARTIFACT',
    acceptanceStatus: 'ACCEPTED',
    sourceEventIds: [uuid(`5${seed}`)],
    observedAt: EFFECTIVE,
    effectiveFrom: EFFECTIVE,
    ...overrides,
  };
}

function row(overrides: Partial<OrganizationRegistryRow> = {}): OrganizationRegistryRow {
  const roleInstanceId = overrides.roleInstanceId ?? 'r1';
  return {
    roleInstanceId,
    actorId: roleInstanceId,
    role: 'WORKER',
    project: 'AGENT_OFFICE',
    stableDisplayName: 'Test Worker',
    advisorTeam: 'FOUNDATION_ADVISOR_TEAM',
    reportsToAdvisor: 'foundation-advisor',
    assignedBy: 'foundation-advisor',
    returnsResultTo: 'foundation-advisor',
    sessionName: 'test-session',
    allowedAiIdentities: ['CLAUDE_OPUS_4_8'],
    allowedModels: ['claude-opus-4-8'],
    allowedEfforts: ['ULTRACODE'],
    provenance: 'VERIFIED_REGISTRY',
    ...overrides,
  };
}

function actorById(actors: readonly OrganizationFrameActor[], id: string): OrganizationFrameActor {
  const found = actors.find((actor) => actor.roleInstanceId === id);
  if (found === undefined) throw new Error(`actor ${id} not found`);
  return found;
}

function project(input: {
  registry?: readonly OrganizationRegistryRow[];
  runtime?: readonly RuntimeWorkInput[];
  evidence?: readonly AcceptedEvidenceRecord[];
  evaluatedAt?: string;
}) {
  return projectOrganizationFrame({
    registry: input.registry ?? [],
    runtime: input.runtime ?? [],
    evidence: input.evidence ?? [],
    evaluatedAt: input.evaluatedAt ?? EVALUATED_AT,
  });
}

describe('WU-02 committed organization fixture', () => {
  const frame = project({ registry: ORGANIZATION_REGISTRY, evidence: ORGANIZATION_EVIDENCE });

  it('projects every committed registry actor with no INVALID/DUPLICATE registry diagnostics', () => {
    expect(frame.actors).toHaveLength(ORGANIZATION_REGISTRY.length);
    expect(frame.diagnostics.filter((d) => d.code === 'INVALID_REGISTRY_ROLE_INSTANCE_ID')).toHaveLength(0);
    expect(frame.diagnostics.filter((d) => d.code === 'DUPLICATE_REGISTRY_ROLE_INSTANCE_ID')).toHaveLength(0);
    expect(frame.diagnostics.filter((d) => d.code === 'INVALID_REGISTRY_ACTOR_ID')).toHaveLength(0);
    expect(frame.diagnostics.filter((d) => d.code === 'DUPLICATE_REGISTRY_ACTOR_ID')).toHaveLength(0);
    expect(frame.diagnostics.filter((d) => d.code === 'EVIDENCE_ID_COLLISION')).toHaveLength(0);
  });

  it('renders a fully-attested worker with verified process/identity/model/effort/ready', () => {
    const worker = actorById(frame.actors, 'agent-office-worker');
    expect(worker.stableDisplayName.value).toBe('Agent Office Worker');
    expect(worker.stableDisplayName.source).toBe('VERIFIED_REGISTRY');
    expect(worker.sessionProcess.value).toBe('AI_PROCESS_DETECTED');
    expect(worker.aiIdentity.value).toBe('CLAUDE_OPUS_4_8');
    expect(worker.model.value).toBe('claude-opus-4-8');
    expect(worker.effort.value).toBe('ULTRACODE');
    expect(worker.aiRuntimeState.value).toBe('AI_READY');
    expect(worker.aiIdentity.source).toBe('VERIFIED_MISSION_ARTIFACT');
    expect(worker.canReceiveWork).toBe(true);
  });

  it('fails an actor with no evidence closed to every §2.3 sentinel', () => {
    const siasiu = actorById(frame.actors, 'siasiu-worker');
    expect(siasiu.sessionProcess.value).toBe('SESSION_PROCESS_UNKNOWN');
    expect(siasiu.aiIdentity.value).toBe('AI_IDENTITY_UNKNOWN');
    expect(siasiu.model.value).toBe('MODEL_UNKNOWN');
    expect(siasiu.effort.value).toBe('EFFORT_UNKNOWN');
    expect(siasiu.aiRuntimeState.value).toBe('AI_RUNTIME_UNKNOWN');
  });

  it('renders offline / error actors truthfully', () => {
    expect(actorById(frame.actors, 'foundation-control').sessionProcess.value).toBe('SESSION_OFFLINE');
    expect(actorById(frame.actors, 'foundation-control').aiRuntimeState.value).toBe('AI_RUNTIME_UNKNOWN');
    expect(actorById(frame.actors, 'cosmile-worker').sessionProcess.value).toBe('NO_AI_PROCESS');
    expect(actorById(frame.actors, 'vibenews-advisor').aiRuntimeState.value).toBe('AI_ERROR');
  });

  it('has no changing fact on any actor without RT input (operationalState UNKNOWN)', () => {
    for (const actor of frame.actors) {
      expect(actor.operationalState.value).toBe('UNKNOWN');
      expect(actor.mission.value).toBe('UNKNOWN');
      expect(actor.workUnit.value).toBe('UNKNOWN');
    }
  });
});

describe('§2.1/§2.2 stable identity vs mutable bindings', () => {
  it('keeps roleInstanceId + identity stable when the session binding is replaced', () => {
    const a = actorById(project({ registry: [row({ sessionName: 'session-A' })] }).actors, 'r1');
    const b = actorById(project({ registry: [row({ sessionName: 'session-B' })] }).actors, 'r1');
    expect(a.roleInstanceId).toBe(b.roleInstanceId);
    expect(a.stableDisplayName.value).toBe(b.stableDisplayName.value);
    expect(a.role.value).toBe(b.role.value);
    expect(a.sessionName.value).toBe('session-A');
    expect(b.sessionName.value).toBe('session-B');
  });

  it('drops a registry row without a valid roleInstanceId and reports it', () => {
    const frame = project({ registry: [row({ roleInstanceId: '   ' }), row({ roleInstanceId: 'ok' })] });
    expect(frame.actors.map((a) => a.roleInstanceId)).toEqual(['ok']);
    expect(frame.diagnostics.some((d) => d.code === 'INVALID_REGISTRY_ROLE_INSTANCE_ID')).toBe(true);
  });

  it('drops every row of a duplicated roleInstanceId (no cloned identity)', () => {
    const frame = project({ registry: [row({ roleInstanceId: 'dup' }), row({ roleInstanceId: 'dup', sessionName: 'other' })] });
    expect(frame.actors).toHaveLength(0);
    expect(frame.diagnostics.some((d) => d.code === 'DUPLICATE_REGISTRY_ROLE_INSTANCE_ID')).toBe(true);
  });

  it('normalizes blank free-text to literal UNKNOWN and invalid team to UNASSIGNED', () => {
    const actor = actorById(project({ registry: [row({ stableDisplayName: '  ', advisorTeam: 'NOPE' as never })] }).actors, 'r1');
    expect(actor.stableDisplayName.value).toBe('UNKNOWN');
    expect(actor.stableDisplayName.status).toBe('MISSING');
    expect(actor.advisorTeam.value).toBe('UNASSIGNED');
    expect(actor.canReceiveWork).toBe(false);
  });
});

describe('pre-AS1 actorId identity migration + routing (roleInstanceId join key vs actorId)', () => {
  const frame = project({ registry: ORGANIZATION_REGISTRY, evidence: ORGANIZATION_EVIDENCE });

  function regByActorId(actorId: string): OrganizationRegistryRow {
    const found = ORGANIZATION_REGISTRY.find((r) => r.actorId === actorId);
    if (found === undefined) throw new Error(`registry row with actorId ${actorId} not found`);
    return found;
  }
  function regByRoleInstanceId(roleInstanceId: string): OrganizationRegistryRow {
    const found = ORGANIZATION_REGISTRY.find((r) => r.roleInstanceId === roleInstanceId);
    if (found === undefined) throw new Error(`registry row with roleInstanceId ${roleInstanceId} not found`);
    return found;
  }

  it('accepts every committed row with no actorId diagnostics and globally unique nonblank actorIds', () => {
    expect(frame.diagnostics.filter((d) => d.code === 'INVALID_REGISTRY_ACTOR_ID')).toHaveLength(0);
    expect(frame.diagnostics.filter((d) => d.code === 'DUPLICATE_REGISTRY_ACTOR_ID')).toHaveLength(0);
    const actorIds = ORGANIZATION_REGISTRY.map((r) => r.actorId);
    expect(new Set(actorIds).size).toBe(actorIds.length);
    expect(actorIds.every((id) => id.trim() !== '')).toBe(true);
  });

  it('the continuing actor keeps immutable roleInstanceId foundation-advisor but routes as agent-office-advisor', () => {
    const continuing = regByRoleInstanceId('foundation-advisor');
    expect(continuing.actorId).toBe('agent-office-advisor');
    expect(continuing.project).toBe('AGENT_OFFICE');
    expect(continuing.advisorTeam).toBe('AGENT_OFFICE_ADVISOR_TEAM');
    expect(continuing.stableDisplayName).toBe('Agent Office Advisor');
  });

  it('the continuing actor retains its historical evidence (still joined only by roleInstanceId)', () => {
    // The foundation-advisor evidence (process_detected + ai_ready) still resolves to the continuing actor.
    const continuing = actorById(frame.actors, 'foundation-advisor');
    expect(continuing.sessionProcess.value).toBe('AI_PROCESS_DETECTED');
    expect(continuing.aiRuntimeState.value).toBe('AI_READY');
  });

  it('the newly created Foundation Advisor has a fresh internal key and inherits no historical evidence', () => {
    const created = regByActorId('foundation-advisor');
    expect(created.roleInstanceId).toBe('foundation-advisor-20260714-01');
    expect(created.project).toBe('FOUNDATION');
    expect(created.advisorTeam).toBe('FOUNDATION_ADVISOR_TEAM');
    const projected = actorById(frame.actors, 'foundation-advisor-20260714-01');
    expect(projected.sessionProcess.value).toBe('SESSION_PROCESS_UNKNOWN');
    expect(projected.aiRuntimeState.value).toBe('AI_RUNTIME_UNKNOWN');
    expect(projected.model.value).toBe('MODEL_UNKNOWN');
  });

  it('re-parents the Agent Office Worker to the Agent Office Team routing through agent-office-advisor', () => {
    const worker = regByRoleInstanceId('agent-office-worker');
    expect(worker.actorId).toBe('agent-office-worker');
    expect(worker.advisorTeam).toBe('AGENT_OFFICE_ADVISOR_TEAM');
    expect(worker.reportsToAdvisor).toBe('agent-office-advisor');
    expect(worker.assignedBy).toBe('agent-office-advisor');
    expect(worker.returnsResultTo).toBe('agent-office-advisor');
  });

  it('route fields carry routable actorIds (or external leo-gpt) that resolve to a unique row', () => {
    const routable = new Map(ORGANIZATION_REGISTRY.map((r) => [r.actorId, r]));
    for (const r of ORGANIZATION_REGISTRY) {
      for (const route of [r.reportsToAdvisor, r.assignedBy, r.returnsResultTo]) {
        if (route === 'leo-gpt') continue;
        expect(routable.has(route)).toBe(true);
      }
    }
    // foundation-control routes to the NEW Foundation Advisor (actorId 'foundation-advisor'), NOT the
    // continuing actor whose internal join key is also 'foundation-advisor'.
    const control = regByRoleInstanceId('foundation-control');
    expect(routable.get(control.reportsToAdvisor)?.roleInstanceId).toBe('foundation-advisor-20260714-01');
  });

  it('fails closed on a duplicate actorId across distinct roleInstanceIds (never first-win)', () => {
    const f = project({ registry: [row({ roleInstanceId: 'a', actorId: 'dupe' }), row({ roleInstanceId: 'b', actorId: 'dupe' })] });
    expect(f.actors).toHaveLength(0);
    expect(f.diagnostics.some((d) => d.code === 'DUPLICATE_REGISTRY_ACTOR_ID')).toBe(true);
  });

  it('drops a row with a blank actorId and reports it', () => {
    const f = project({ registry: [row({ roleInstanceId: 'a', actorId: '   ' }), row({ roleInstanceId: 'b', actorId: 'b' })] });
    expect(f.actors.map((a) => a.roleInstanceId)).toEqual(['b']);
    expect(f.diagnostics.some((d) => d.code === 'INVALID_REGISTRY_ACTOR_ID')).toBe(true);
  });
});

describe('routine completeness reconciliation — current Team/session bindings (patch 01)', () => {
  const frame = project({ registry: ORGANIZATION_REGISTRY, evidence: ORGANIZATION_EVIDENCE });
  function reg(roleInstanceId: string): OrganizationRegistryRow {
    const found = ORGANIZATION_REGISTRY.find((r) => r.roleInstanceId === roleInstanceId);
    if (found === undefined) throw new Error(`registry row ${roleInstanceId} not found`);
    return found;
  }
  function responsibleFor(team: string): string {
    if (team === 'AGENT_OFFICE_ADVISOR_TEAM') return 'agent-office-advisor';
    if (team === 'FOUNDATION_ADVISOR_TEAM') return 'foundation-advisor';
    if (team === 'VIBENEWS_ADVISOR_TEAM') return 'vibenews-advisor';
    throw new Error(`no responsible advisor mapped for team ${team}`);
  }

  it('preserves all eight original immutable roleInstanceId keys', () => {
    for (const key of ['foundation-advisor', 'foundation-control', 'agent-office-worker', 'foundation-reviewer', 'cosmile-worker', 'siasiu-worker', 'vibenews-advisor', 'vibenews-worker']) {
      expect(ORGANIZATION_REGISTRY.some((r) => r.roleInstanceId === key)).toBe(true);
    }
  });

  it('migrates the continuing Reviewer to the Agent Office Reviewer while retaining its evidence', () => {
    const rev = reg('foundation-reviewer');
    expect(rev.actorId).toBe('agent-office-reviewer');
    expect(rev.role).toBe('REVIEWER');
    expect(rev.project).toBe('AGENT_OFFICE');
    expect(rev.advisorTeam).toBe('AGENT_OFFICE_ADVISOR_TEAM');
    expect(rev.reportsToAdvisor).toBe('agent-office-advisor');
    expect(rev.sessionName).toBe('agent-office-reviewer');
    // Its committed evidence still joins only to the immutable key `foundation-reviewer`.
    const projected = actorById(frame.actors, 'foundation-reviewer');
    expect(projected.sessionProcess.value).toBe('AI_PROCESS_DETECTED');
    expect(projected.aiIdentity.value).toBe('GPT_5_6_SOL');
    expect(projected.model.value).toBe('gpt-5.6-sol');
    expect(projected.effort.value).toBe('XHIGH');
  });

  it('adds registry-only Designer/Worker/Reviewer rows that inherit no historical evidence', () => {
    for (const roleInstanceId of ['agent-office-designer', 'foundation-designer', 'foundation-worker', 'foundation-reviewer-fable5']) {
      const projected = actorById(frame.actors, roleInstanceId);
      expect(projected.sessionProcess.value).toBe('SESSION_PROCESS_UNKNOWN');
      expect(projected.aiRuntimeState.value).toBe('AI_RUNTIME_UNKNOWN');
      expect(projected.model.value).toBe('MODEL_UNKNOWN');
    }
  });

  it('binds exactly one responsible ADVISOR per current Advisor-led Team by actorId', () => {
    const advisorsByTeam = new Map<string, string[]>();
    for (const r of ORGANIZATION_REGISTRY) {
      if (r.role !== 'ADVISOR') continue;
      const group = advisorsByTeam.get(r.advisorTeam) ?? [];
      group.push(r.actorId);
      advisorsByTeam.set(r.advisorTeam, group);
    }
    expect(advisorsByTeam.get('AGENT_OFFICE_ADVISOR_TEAM')).toEqual(['agent-office-advisor']);
    expect(advisorsByTeam.get('FOUNDATION_ADVISOR_TEAM')).toEqual(['foundation-advisor']);
    expect(advisorsByTeam.get('VIBENEWS_ADVISOR_TEAM')).toEqual(['vibenews-advisor']);
  });

  it('routes every current subordinate to its Team responsible Advisor by actorId', () => {
    for (const r of ORGANIZATION_REGISTRY) {
      if (r.role === 'ADVISOR') continue; // Advisors route to external authority leo-gpt.
      expect(r.reportsToAdvisor).toBe(responsibleFor(r.advisorTeam));
      expect(r.assignedBy).toBe(responsibleFor(r.advisorTeam));
      expect(r.returnsResultTo).toBe(responsibleFor(r.advisorTeam));
    }
  });

  it('keeps both Reviewer rows role REVIEWER (verdict independence; only routing through the Advisor)', () => {
    const reviewers = ORGANIZATION_REGISTRY.filter((r) => r.role === 'REVIEWER');
    expect(reviewers.map((r) => r.roleInstanceId).sort()).toEqual(['foundation-reviewer', 'foundation-reviewer-fable5']);
    for (const r of reviewers) {
      expect(r.role).toBe('REVIEWER');
      expect(Object.keys(r)).not.toContain('verdictAuthority');
    }
  });

  it('sets the exact current session bindings', () => {
    expect(reg('cosmile-worker').sessionName).toBe('cosmile');
    expect(reg('siasiu-worker').sessionName).toBe('siasiu');
    expect(reg('foundation-worker').sessionName).toBe('foundation');
    expect(reg('foundation-reviewer-fable5').sessionName).toBe('foundation-reviewer-fable5');
    expect(reg('foundation-reviewer').sessionName).toBe('agent-office-reviewer');
    expect(reg('agent-office-designer').sessionName).toBe('agent-office-designer');
    expect(reg('foundation-designer').sessionName).toBe('foundation-designer');
  });

  it('excludes agent-office-sol as a current dispatchable Team actor', () => {
    expect(ORGANIZATION_REGISTRY.some((r) => r.roleInstanceId === 'agent-office-sol' || r.actorId === 'agent-office-sol' || r.sessionName === 'agent-office-sol')).toBe(false);
  });

  it('leaves both VibeNews rows unchanged', () => {
    const va = reg('vibenews-advisor');
    const vw = reg('vibenews-worker');
    expect([va.actorId, va.project, va.advisorTeam, va.sessionName, va.reportsToAdvisor]).toEqual(['vibenews-advisor', 'VIBENEWS', 'VIBENEWS_ADVISOR_TEAM', 'vibenews-advisor', 'leo-gpt']);
    expect([vw.actorId, vw.project, vw.advisorTeam, vw.sessionName, vw.reportsToAdvisor]).toEqual(['vibenews-worker', 'VIBENEWS', 'VIBENEWS_ADVISOR_TEAM', 'vibenews-worker', 'vibenews-advisor']);
  });
});

describe('§2.3 process & AI-runtime facts require exact evidence', () => {
  it('a missing process observation is SESSION_PROCESS_UNKNOWN, never SESSION_OFFLINE', () => {
    const actor = actorById(project({ registry: [row()] }).actors, 'r1');
    expect(actor.sessionProcess.value).toBe('SESSION_PROCESS_UNKNOWN');
  });

  it.each([
    ['process_offline', 'SESSION_OFFLINE'],
    ['process_absent', 'NO_AI_PROCESS'],
    ['process_detected', 'AI_PROCESS_DETECTED'],
  ] as const)('maps %s to %s', (kind, expected) => {
    const actor = actorById(project({ registry: [row()], evidence: [ev(kind, 'r1')] }).actors, 'r1');
    expect(actor.sessionProcess.value).toBe(expected);
  });

  it('U1: two contradictory process kinds fail closed to SESSION_PROCESS_UNKNOWN + diagnostic', () => {
    const frame = project({ registry: [row()], evidence: [ev('process_detected', 'r1'), ev('process_offline', 'r1')] });
    expect(actorById(frame.actors, 'r1').sessionProcess.value).toBe('SESSION_PROCESS_UNKNOWN');
    expect(frame.diagnostics.some((d) => d.code === 'SESSION_PROCESS_CONTRADICTION')).toBe(true);
  });

  it('rejects an attestation value outside the (A) allowed-token set', () => {
    const actor = actorById(project({ registry: [row()], evidence: [ev('process_detected', 'r1'), ev('model_attestation', 'r1', { value: 'not-allowed' })] }).actors, 'r1');
    expect(actor.model.value).toBe('MODEL_UNKNOWN');
  });

  it('AI_READY requires an ai_ready record; a detected process alone is AI_RUNTIME_UNKNOWN', () => {
    const detectedOnly = actorById(project({ registry: [row()], evidence: [ev('process_detected', 'r1')] }).actors, 'r1');
    expect(detectedOnly.aiRuntimeState.value).toBe('AI_RUNTIME_UNKNOWN');
    const ready = actorById(project({ registry: [row()], evidence: [ev('process_detected', 'r1'), ev('ai_ready', 'r1')] }).actors, 'r1');
    expect(ready.aiRuntimeState.value).toBe('AI_READY');
  });
});

describe('§2.3.1 evidence validation and U2 dedup', () => {
  it.each([
    ['REJECTED acceptance', ev('process_detected', 'r1', { acceptanceStatus: 'REJECTED' })],
    ['UNVERIFIED provenance', ev('process_detected', 'r1', { provenance: 'UNVERIFIED' })],
    ['empty sourceEventIds', ev('process_detected', 'r1', { sourceEventIds: [] })],
    ['malformed evidenceRef', ev('process_detected', 'r1', { evidenceRef: 'sha256:xyz' })],
    ['expired', ev('process_detected', 'r1', { effectiveFrom: EFFECTIVE, optionalExpiresAt: '2026-07-10T00:00:00.000Z' })],
    ['not yet effective', ev('process_detected', 'r1', { effectiveFrom: '2026-07-20T00:00:00.000Z', observedAt: '2026-07-20T00:00:00.000Z' })],
  ] as const)('drops an invalid record: %s', (_label, record) => {
    const actor = actorById(project({ registry: [row()], evidence: [record] }).actors, 'r1');
    expect(actor.sessionProcess.value).toBe('SESSION_PROCESS_UNKNOWN');
  });

  it('collapses an idempotent replay (same evidenceId, all fields equal)', () => {
    const record = ev('process_detected', 'r1');
    const frame = project({ registry: [row()], evidence: [record, { ...record }] });
    expect(actorById(frame.actors, 'r1').sessionProcess.value).toBe('AI_PROCESS_DETECTED');
    expect(frame.diagnostics.some((d) => d.code === 'EVIDENCE_ID_COLLISION')).toBe(false);
  });

  it('drops all records of an evidenceId collision (same id, differing field) + diagnostic', () => {
    const base = ev('process_detected', 'r1');
    const collided: AcceptedEvidenceRecord = { ...base, kind: 'process_offline' };
    const frame = project({ registry: [row()], evidence: [base, collided] });
    expect(actorById(frame.actors, 'r1').sessionProcess.value).toBe('SESSION_PROCESS_UNKNOWN');
    expect(frame.diagnostics.some((d) => d.code === 'EVIDENCE_ID_COLLISION')).toBe(true);
  });

  it('is input-order independent for dedup', () => {
    const record = ev('ai_ready', 'r1');
    const forward = dedupeByEvidenceId([record, { ...record }]);
    const reverse = dedupeByEvidenceId([{ ...record }, record]);
    expect(forward.records).toHaveLength(1);
    expect(reverse.records).toHaveLength(1);
  });
});

describe('§2.3.2 aiRuntimeState total arbitration', () => {
  it('forces UNKNOWN when process is not AI_PROCESS_DETECTED', () => {
    expect(arbitrateAiRuntimeState({ sessionProcess: 'SESSION_OFFLINE', work: true, waiting: false, error: false, ready: true })).toBe('AI_RUNTIME_UNKNOWN');
  });
  it('surfaces error over any co-present ready/work', () => {
    expect(arbitrateAiRuntimeState({ sessionProcess: 'AI_PROCESS_DETECTED', work: true, waiting: false, error: true, ready: true })).toBe('AI_ERROR');
  });
  it('returns UNKNOWN for the mutually-exclusive work+wait conflict', () => {
    expect(arbitrateAiRuntimeState({ sessionProcess: 'AI_PROCESS_DETECTED', work: true, waiting: true, error: false, ready: false })).toBe('AI_RUNTIME_UNKNOWN');
  });
  it('maps single signals: work→WORKING, wait→WAITING, ready→READY', () => {
    expect(arbitrateAiRuntimeState({ sessionProcess: 'AI_PROCESS_DETECTED', work: true, waiting: false, error: false, ready: false })).toBe('AI_WORKING');
    expect(arbitrateAiRuntimeState({ sessionProcess: 'AI_PROCESS_DETECTED', work: false, waiting: true, error: false, ready: false })).toBe('AI_WAITING');
    expect(arbitrateAiRuntimeState({ sessionProcess: 'AI_PROCESS_DETECTED', work: false, waiting: false, error: false, ready: true })).toBe('AI_READY');
  });
  it('integration: ai_ready + ai_error together yields AI_ERROR', () => {
    const actor = actorById(project({ registry: [row()], evidence: [ev('process_detected', 'r1'), ev('ai_ready', 'r1'), ev('ai_error', 'r1')] }).actors, 'r1');
    expect(actor.aiRuntimeState.value).toBe('AI_ERROR');
  });
});

describe('§2.4 operationalState is a total function of the projector output', () => {
  const EXPECTED: Readonly<Record<ObservableProjectionName, string>> = {
    QUEUED: 'IDLE', READY: 'IDLE', DISPATCHING: 'ROUTING / DISPATCH', READING: 'WORKING', WORKING: 'WORKING',
    TESTING: 'TESTING', WRITING_RESULT: 'WORKING', RETURNING_RESULT: 'RETURNING_RESULT', REVIEWING: 'REVIEWING',
    NEEDS_PATCH: 'NEEDS_PATCH', WAITING_DEPENDENCY: 'WAITING_DEPENDENCY', WAITING_LEO: 'WAITING_LEO',
    BLOCKED: 'BLOCKED', COMPLETED: 'COMPLETED', FAILED: 'FAILED', CANCELLED: 'CANCELLED', UNKNOWN_OR_STALE: 'UNKNOWN',
  };

  it('maps every ObservableProjectionName exactly (16 + UNKNOWN_OR_STALE)', () => {
    for (const name of [...REQUIRED_OBSERVABLE_NAMES, 'UNKNOWN_OR_STALE'] as const) {
      expect(mapOperationalState(name)).toBe(EXPECTED[name]);
    }
  });

  it('a bare UNKNOWN_OR_STALE projector output displays UNKNOWN (never elevated)', () => {
    const actor = actorById(project({ registry: [row()], runtime: [{ roleInstanceId: 'r1', mission: 'M1', workUnit: 'W1', observableName: 'UNKNOWN_OR_STALE' }] }).actors, 'r1');
    expect(actor.operationalState.value).toBe('UNKNOWN');
  });

  it('a stale RT row collapses operationalState + mission + workUnit to sentinels', () => {
    const actor = actorById(project({ registry: [row()], runtime: [{ roleInstanceId: 'r1', mission: 'M1', workUnit: 'W1', observableName: 'WORKING', staleOrInvalid: true }] }).actors, 'r1');
    expect(actor.operationalState.value).toBe('UNKNOWN');
    expect(actor.operationalState.status).toBe('STALE');
    expect(actor.mission.value).toBe('UNKNOWN');
    expect(actor.workUnit.value).toBe('UNKNOWN');
  });

  it('(RT) is the sole truth for mission/workUnit/operationalState', () => {
    const actor = actorById(project({ registry: [row()], runtime: [{ roleInstanceId: 'r1', mission: 'MODERN_OFFICE', workUnit: 'BA-WU-02', observableName: 'TESTING' }] }).actors, 'r1');
    expect(actor.operationalState.value).toBe('TESTING');
    expect(actor.mission.value).toBe('MODERN_OFFICE');
    expect(actor.workUnit.value).toBe('BA-WU-02');
  });
});

describe('§2.5 three-source full outer join', () => {
  it('registry-only actor has identity but every changing fact is a sentinel', () => {
    const actor = actorById(project({ registry: [row()] }).actors, 'r1');
    expect(actor.stableDisplayName.value).toBe('Test Worker');
    expect(actor.sessionProcess.value).toBe('SESSION_PROCESS_UNKNOWN');
    expect(actor.operationalState.value).toBe('UNKNOWN');
    expect(actor.mission.value).toBe('UNKNOWN');
  });

  it('runtime/evidence-only actor has UNKNOWN identity + UNASSIGNED and cannot receive work', () => {
    const frame = project({ runtime: [{ roleInstanceId: 'ghost', mission: 'M', workUnit: 'W', observableName: 'WORKING' }] });
    const actor = actorById(frame.actors, 'ghost');
    expect(actor.role.value).toBe('UNKNOWN');
    expect(actor.stableDisplayName.value).toBe('UNKNOWN');
    expect(actor.advisorTeam.value).toBe('UNASSIGNED');
    expect(actor.canReceiveWork).toBe(false);
    expect(actor.operationalState.value).toBe('WORKING');
  });

  it('renders a full {value, source, status, evidenceTimestamp} envelope on every field', () => {
    const actor = actorById(project({ registry: [row()], evidence: [ev('process_detected', 'r1')] }).actors, 'r1');
    for (const fact of [actor.role, actor.sessionProcess, actor.model, actor.operationalState]) {
      expect(fact).toHaveProperty('value');
      expect(fact).toHaveProperty('source');
      expect(fact).toHaveProperty('status');
      expect(fact).toHaveProperty('evidenceTimestamp');
    }
    expect(actor.sessionProcess.evidenceTimestamp).toBe(EFFECTIVE);
  });
});
