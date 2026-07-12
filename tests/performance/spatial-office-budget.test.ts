// @vitest-environment jsdom

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { cleanup, fireEvent, render } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  SpatialActorProjection,
  SpatialOfficeProjectionV1,
  SpatialTeamPodProjection,
} from '../../src/application/spatial-office/types.js';
import { projectRequiredObservable } from '../../src/domain/activity/index.js';
import {
  projectSpatialCue,
  type SpatialCueFactInput,
  type SpatialCueProjectorInput,
} from '../../src/ui/spatial/cue-projector.js';
import { createSpatialCueReducerState, reduceSpatialCues } from '../../src/ui/spatial/cue-reducer.js';
import { STATIC_SPATIAL_OFFICE_FIXTURE } from '../../src/ui/spatial/fixtures.js';
import { SpatialOffice } from '../../src/ui/spatial/spatial-office.js';
import { resolveSpatialRoute, type SpatialZoneEndpoint } from '../../src/ui/spatial/spatial-routes.js';

const BENCHMARK_DESCRIPTOR = {
  schemaVersion: 'agent-office.ao12-c-benchmark.v1',
  pods: 12,
  assignments: 64,
  workUnits: 200,
  labelProfile: 'LONG_KOREAN_ENGLISH',
  openAlerts: 6,
  burstCues: 3,
} as const;

const AO12_C_SOURCE_PATHS = [
  'src/ui/spatial/cue-projector.ts',
  'src/ui/spatial/cue-reducer.ts',
  'src/ui/spatial/spatial-routes.tsx',
  'src/ui/spatial/actor-zone.tsx',
  'src/ui/spatial/lounge.tsx',
  'src/ui/spatial/channy-presentation.tsx',
] as const;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AO12-IWU-11 measured spatial performance budget', () => {
  it('meets the FULL-tier hard targets on the exact synthetic design-load fixture', () => {
    mockMatchMedia();
    const fixture = createBenchmarkFixture();
    const fixtureHash = sha256(JSON.stringify(BENCHMARK_DESCRIPTOR));

    for (let index = 0; index < 20; index += 1) measureProjectAndReduce(index);
    const reducerSamples = Array.from({ length: 200 }, (_, index) => measureProjectAndReduce(index + 20));
    const reducerP95Ms = percentile95(reducerSamples);

    const beforeHeap = process.memoryUsage().heapUsed;
    const mounted = render(createElement(SpatialOffice, {
      projection: fixture,
      surfaceKind: 'SYNTHETIC',
      fixtureKind: 'AO12_C_SYNTHETIC_PERFORMANCE_FIXTURE',
    }));
    const podControls = [...mounted.container.querySelectorAll<HTMLButtonElement>('.spatial-pod-control')];
    expect(podControls).toHaveLength(BENCHMARK_DESCRIPTOR.pods);
    const switchSamples: number[] = [];
    for (let index = 0; index < 20; index += 1) {
      const target = requireItem(podControls, index % podControls.length);
      const start = performance.now();
      fireEvent.click(target);
      expect(target.getAttribute('aria-current')).toBe('true');
      switchSamples.push(performance.now() - start);
    }
    const podSwitchP95Ms = percentile95(switchSamples);
    const domNodes = mounted.container.querySelectorAll('*').length;
    const svgElements = mounted.container.querySelectorAll('svg, svg *').length;
    const afterHeap = process.memoryUsage().heapUsed;
    const heapGrowthBytes = Math.max(0, afterHeap - beforeHeap);

    const cues = burstResults(900).map((result) => requireCue(result.cue));
    const endpoints: readonly SpatialZoneEndpoint[] = [...new Set(cues.flatMap((cue) => [
      cue.sourceZoneId,
      cue.targetZoneId ?? cue.sourceZoneId,
    ]))].map((zoneId) => ({ zoneId, visible: true, ambiguous: false }));
    const frameSamples = Array.from({ length: 240 }, () => {
      const start = performance.now();
      for (const cue of cues) resolveSpatialRoute(cue, endpoints, 'FULL');
      return performance.now() - start;
    });
    const activeFrameP95Ms = percentile95(frameSamples);

    const sourceBytes = AO12_C_SOURCE_PATHS
      .map((sourcePath) => readFileSync(path.resolve(import.meta.dirname, `../../${sourcePath}`)))
      .reduce<Buffer>((joined, bytes) => Buffer.concat([joined, bytes]), Buffer.alloc(0));
    const incrementalSourceGzipBytes = gzipSync(sourceBytes, { level: 9 }).byteLength;

    mounted.unmount();
    expect(document.querySelector('#spatial-office')).toBeNull();
    expect(animationCount()).toBe(0);

    const report = {
      schemaVersion: 'agent-office.ao12-c-benchmark-report.v1',
      classification: 'FULL',
      referenceHost: `${process.platform}-${process.arch}`,
      referenceRuntime: `node-${process.versions.node}-jsdom`,
      buildBoundary: 'test-demo-only-production-entry-unchanged',
      fixtureHash,
      fixture: BENCHMARK_DESCRIPTOR,
      percentileMethod: 'nearest-rank-sorted-ceil-0.95n-minus-1',
      reducerSamples: reducerSamples.length,
      reducerP95Ms: round(reducerP95Ms),
      jsdomPodSwitchDiagnosticSamples: switchSamples.length,
      jsdomPodSwitchDiagnosticP95Ms: round(podSwitchP95Ms),
      podSwitchGate: 'spatial-office-motion.spec.ts configured Chromium desktop and 4x CPU measurements',
      activeFrameSamples: frameSamples.length,
      activeFrameP95Ms: round(activeFrameP95Ms),
      incrementalProductionGzipBytes: 0,
      incrementalSourceGzipBytes,
      domNodes,
      svgElements,
      heapCycles: 20,
      heapMethod: 'jsdom-process-allocation-diagnostic-no-forced-gc-not-retained-heap',
      heapAllocationDeltaBytes: heapGrowthBytes,
      retainedHeapGate: 'spatial-office-motion.spec.ts Chromium CDP collectGarbage measurement',
      retainedAnimationsAfterUnmount: animationCount(),
    };
    console.info(`AO12_C_BENCHMARK_REPORT ${JSON.stringify(report)}`);

    expect(reducerP95Ms).toBeLessThanOrEqual(8);
    expect(activeFrameP95Ms).toBeLessThanOrEqual(8);
    expect(incrementalSourceGzipBytes).toBeLessThanOrEqual(80 * 1024);
    expect(domNodes).toBeLessThanOrEqual(1600);
    expect(svgElements).toBeLessThanOrEqual(800);
  });
});

function measureProjectAndReduce(seed: number): number {
  const start = performance.now();
  const results = burstResults(seed);
  const baseline = reduceSpatialCues(createSpatialCueReducerState(), {
    origin: 'INITIAL_SNAPSHOT',
    projectionRevision: seed,
    projectionFingerprint: `benchmark-baseline-${seed}`,
    selectedPodId: 'pod:benchmark-00',
    fullSnapshotVerified: true,
    results: [],
  });
  const reduced = reduceSpatialCues(baseline, {
    origin: 'LIVE_DELTA',
    projectionRevision: seed + 1,
    projectionFingerprint: `benchmark-delta-${seed + 1}`,
    selectedPodId: 'pod:benchmark-00',
    fullSnapshotVerified: false,
    results,
  });
  if (reduced.pendingCues.length !== 3) throw new TypeError('benchmark burst did not retain three cues');
  return performance.now() - start;
}

function burstResults(seed: number) {
  return [
    cueResult('WAITING_LEO', seed * 4 + 1, 'actor.benchmark.00', 'BENCH-IWU-001', 203),
    cueResult('TESTING', seed * 4 + 2, 'actor.benchmark.01', 'BENCH-IWU-002', 202),
    cueResult('WORKING', seed * 4 + 3, 'actor.benchmark.02', 'BENCH-IWU-003', 201),
  ] as const;
}

function cueResult(
  kind: 'WAITING_LEO' | 'TESTING' | 'WORKING',
  id: number,
  roleInstanceId: string,
  workUnitId: string,
  missionSequence: number,
) {
  const event = eventId(id);
  const facts: Readonly<Record<typeof kind, SpatialCueFactInput>> = {
    WAITING_LEO: fact('DECISION_REQUEST_ACCEPTED', event, workUnitId, 'WAITING_LEO', 'WAITING_LEO', ['VERIFIED_DECISION_REQUEST', 'EXACT_ADVISOR_ROUTE']),
    TESTING: fact('TESTING_ACCEPTED', event, workUnitId, 'TESTING', 'TESTING', ['COMMAND_AND_EVIDENCE_REFS']),
    WORKING: fact('WORKING_ACCEPTED', event, workUnitId, 'RUNNING', 'WORKING', []),
  };
  const input: SpatialCueProjectorInput = {
    projectionSchemaVersion: 'agent-office.spatial-office-projection.v1',
    projectionRevision: id + 1,
    previousAppliedRevision: id,
    evaluatedAt: '2026-07-11T12:00:00.000Z',
    updateOrigin: 'LIVE_DELTA',
    selectedPodId: 'pod:benchmark-00',
    pod: {
      podId: 'pod:benchmark-00',
      advisorTeamId: 'BENCHMARK_ADVISOR_TEAM',
      projectId: 'benchmark-00',
      selected: true,
      sourceAuthorityVerified: true,
      evidenceFreshness: 'CURRENT',
      connectionState: 'CONNECTED',
      responsibleAdvisorRoleInstanceIds: ['advisor.benchmark.00'],
      openAlertSeverity: 'WARNING',
    },
    mission: {
      missionId: 'benchmark-mission-00',
      manifestVersion: '1.0.0',
      manifestVerified: true,
      missionSequence,
      acceptedEventIds: [event],
    },
    actor: {
      roleInstanceId,
      advisorTeamId: 'BENCHMARK_ADVISOR_TEAM',
      responsibleAdvisorStatus: 'VERIFIED',
      responsibleAdvisorTeamIds: ['BENCHMARK_ADVISOR_TEAM'],
      responsibleAdvisorRoleInstanceIds: ['advisor.benchmark.00'],
      assignmentStatus: 'VERIFIED',
      assignmentProjectId: 'benchmark-00',
      assignmentMissionId: 'benchmark-mission-00',
      assignmentWorkUnitId: workUnitId,
      sourceBoundaryVerified: true,
      taskMotionAllowed: true,
    },
    fact: facts[kind],
  };
  return projectSpatialCue(input);
}

function fact(
  factKind: SpatialCueFactInput['factKind'],
  sourceEventId: string,
  workUnitId: string,
  workUnitState: NonNullable<SpatialCueFactInput['workUnitState']>,
  activity: NonNullable<SpatialCueFactInput['activity']>['activity'],
  verifiedEvidence: SpatialCueFactInput['verifiedEvidence'],
): SpatialCueFactInput {
  const evaluatedAt = '2026-07-11T12:00:00.000Z';
  const activityInput = { activity, reasonCode: activity, sourceEventIds: [sourceEventId] } as const;
  return {
    factKind,
    sourceEventIds: [sourceEventId],
    workUnitId,
    workUnitState,
    stateSourceEventId: sourceEventId,
    requiredObservableName: projectRequiredObservable(
      workUnitState,
      { ...activityInput, effectiveFrom: evaluatedAt },
      evaluatedAt,
    ).requiredObservableName,
    activity: activityInput,
    verifiedEvidence,
    currentZoneId: 'work:actor.benchmark.00',
  };
}

function createBenchmarkFixture(): SpatialOfficeProjectionV1 {
  const base = STATIC_SPATIAL_OFFICE_FIXTURE.projection;
  const templatePod = requireItem(base.pods, 0);
  const templateActor = requireValue(Object.values(base.actorsByRoleInstanceId)[0]);
  const actorsByRoleInstanceId: Record<string, SpatialActorProjection> = {};
  const assignmentIdsByPod = Array.from({ length: BENCHMARK_DESCRIPTOR.pods }, () => [] as string[]);
  for (let index = 0; index < BENCHMARK_DESCRIPTOR.assignments; index += 1) {
    const projectIndex = index % BENCHMARK_DESCRIPTOR.pods;
    const projectId = projectIdAt(projectIndex);
    const roleInstanceId = `actor.benchmark.${String(index).padStart(2, '0')}`;
    const workUnitId = `BENCH-IWU-${String(index + 1).padStart(3, '0')}`;
    const assignmentRef = { projectId, missionId: `benchmark-mission-${String(projectIndex).padStart(2, '0')}`, workUnitId };
    assignmentIdsByPod[projectIndex]?.push(roleInstanceId);
    actorsByRoleInstanceId[roleInstanceId] = {
      ...templateActor,
      roleInstanceId,
      actorRole: index % 7 === 0 ? 'Independent Reviewer' : 'Benchmark Worker',
      displayIdentity: { state: 'KNOWN', value: `Benchmark actor ${index + 1} / \uAE34 \uD55C\uAD6D\uC5B4 English label` },
      advisorTeamId: `BENCHMARK_ADVISOR_TEAM_${String(projectIndex).padStart(2, '0')}`,
      projectId,
      responsibleAdvisorRoleInstanceId: `advisor.benchmark.${String(projectIndex).padStart(2, '0')}`,
      assignmentStatus: 'VERIFIED',
      responsibleAdvisorStatus: 'VERIFIED',
      assignmentRefs: [assignmentRef],
      activeAssignmentRef: assignmentRef,
      currentActivitySourceEventId: eventId(index + 3000),
      presentationScope: index < 2 ? 'TEAM_POD' : 'NONE',
      presentationPodId: index < 2 ? `pod:${projectId}` : null,
      operationalState: index % 3 === 0 ? 'TESTING' : 'WORKING',
      workReceiptAllowed: true,
      taskMotionAllowed: index < 2,
      independentReviewer: index % 7 === 0,
    };
  }

  const pods: SpatialTeamPodProjection[] = Array.from({ length: BENCHMARK_DESCRIPTOR.pods }, (_, index) => {
    const projectId = projectIdAt(index);
    const missionId = `benchmark-mission-${String(index).padStart(2, '0')}`;
    const selected = index === 0;
    const missionRef = { projectId, missionId };
    const missionBoard = templatePod.missionBoardSummary === null ? null : {
      ...templatePod.missionBoardSummary,
      missionRef,
      teamName: { state: 'KNOWN' as const, value: `BENCHMARK_ADVISOR_TEAM_${String(index).padStart(2, '0')}` },
      projectName: { state: 'KNOWN' as const, value: `Long Korean English benchmark project ${index + 1}` },
      currentMission: { state: 'KNOWN' as const, value: `Long mission label ${index + 1}` },
      currentPhaseOrWorkUnit: { state: 'KNOWN' as const, value: `BENCH-IWU-${String(index + 1).padStart(3, '0')}` },
    };
    return {
      ...templatePod,
      podId: `pod:${projectId}`,
      advisorTeamId: `BENCHMARK_ADVISOR_TEAM_${String(index).padStart(2, '0')}`,
      projectId,
      displayName: `Long Korean English benchmark project ${index + 1} / \uAE34 \uD55C\uAD6D\uC5B4`,
      projectIdentity: { catalogEntryId: `identity.${projectId}`, textId: projectId, displayName: `Benchmark ${index + 1} / \uD55C\uAD6D\uC5B4` },
      responsibleAdvisorRoleInstanceId: `advisor.benchmark.${String(index).padStart(2, '0')}`,
      responsibleAdvisorDisplayIdentity: { state: 'KNOWN', value: `Benchmark Advisor ${index + 1}` },
      selectedMissionRef: missionRef,
      missionSummaries: templatePod.missionSummaries.map((summary) => ({
        ...summary,
        missionRef,
        displayName: `Long mission label ${index + 1}`,
        workUnitProgress: { state: 'KNOWN', completed: index, total: BENCHMARK_DESCRIPTOR.workUnits },
      })),
      missionBoardSummary: missionBoard,
      actorAssignments: (assignmentIdsByPod[index] ?? []).map((roleInstanceId, assignmentIndex) => ({
        assignmentRef: actorsByRoleInstanceId[roleInstanceId]?.activeAssignmentRef
          ?? { projectId, missionId, workUnitId: `BENCH-IWU-${String(assignmentIndex + 1).padStart(3, '0')}` },
        roleInstanceId,
        status: 'VERIFIED',
        fullCharacter: Number(roleInstanceId.slice(-2)) < 2,
        taskMotionAllowed: Number(roleInstanceId.slice(-2)) < 2 && selected,
      })),
      currentMainMission: { state: 'KNOWN', value: `Long mission label ${index + 1} / \uAE34 \uD55C\uAD6D\uC5B4` },
      currentActor: { state: 'KNOWN', value: `Benchmark actor ${index + 1}` },
      alertSummary: { severity: index < BENCHMARK_DESCRIPTOR.openAlerts ? 'WARNING' : 'NONE', openCount: index < BENCHMARK_DESCRIPTOR.openAlerts ? 1 : 0 },
      selected,
      fullChoreographyEnabled: selected,
    };
  });
  return {
    ...base,
    projectionRevision: 500,
    evaluatedAt: '2026-07-11T12:00:00.000Z',
    selectedPodId: pods[0]?.podId ?? null,
    pods,
    actorsByRoleInstanceId,
    selectedMissionBoard: pods[0]?.missionBoardSummary ?? null,
    sourceManifestRefs: pods.map((pod, index) => ({
      projectId: pod.projectId,
      missionId: pod.selectedMissionRef?.missionId ?? `benchmark-mission-${String(index).padStart(2, '0')}`,
      manifestVersion: '1.0.0',
      sourceCommit: '1'.repeat(40),
      sourceSha256: index.toString(16).padStart(64, '0'),
    })),
    sourceEventIds: Array.from({ length: BENCHMARK_DESCRIPTOR.workUnits }, (_, index) => eventId(index + 4000)),
  };
}

function percentile95(samples: readonly number[]): number {
  if (samples.length === 0) throw new TypeError('percentile requires samples');
  const sorted = [...samples].sort((left, right) => left - right);
  return requireItem(sorted, Math.max(0, Math.ceil(sorted.length * 0.95) - 1));
}

function eventId(index: number): string {
  const high = Math.floor(index / 0x1000).toString(16).padStart(8, '0').slice(-8);
  const middle = (index % 0x1000).toString(16).padStart(3, '0');
  return `${high}-0000-7${middle}-8000-${index.toString(16).padStart(12, '0').slice(-12)}`;
}

function projectIdAt(index: number): string {
  return `benchmark-${String(index).padStart(2, '0')}`;
}

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function requireItem<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) throw new TypeError(`benchmark item missing at ${index}`);
  return value;
}

function requireValue<T>(value: T | undefined): T {
  if (value === undefined) throw new TypeError('benchmark value missing');
  return value;
}

function requireCue<T>(value: T | null): T {
  if (value === null) throw new TypeError('benchmark cue missing');
  return value;
}

function mockMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: false,
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

function animationCount(): number {
  const documentWithAnimations = document as unknown as { readonly getAnimations?: () => readonly Animation[] };
  return documentWithAnimations.getAnimations?.().length ?? 0;
}
