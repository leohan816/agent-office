import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { PIXEL_ATLAS_BUNDLES, totalGeneratedRgbaBytes } from '../../src/ui/pixel/assets/atlas-manifest.js';
import {
  PIXEL_PROTOTYPE_FIXTURE_ID,
  type PixelActorInput,
  type PixelPodInput,
  type PixelPrototypeProjection,
} from '../../src/ui/pixel/contracts.js';
import { LIVING_PIXEL_PROTOTYPE_PROJECTION } from '../../src/ui/pixel/fixtures/prototype-projection.js';
import { projectPixelWorldFrame } from '../../src/ui/pixel/frame-projector.js';
import { createPixelWorldLayout } from '../../src/ui/pixel/world-layout.js';

const PIXEL_RUNTIME_SOURCES = [
  'src/ui/pixel/contracts.ts',
  'src/ui/pixel/frame-projector.ts',
  'src/ui/pixel/world-layout.ts',
  'src/ui/pixel/pathfinder.ts',
  'src/ui/pixel/camera.ts',
  'src/ui/pixel/presentation-clock.ts',
  'src/ui/pixel/prototype-entry.tsx',
  'src/ui/pixel/renderer-boundary.tsx',
  'src/ui/pixel/pixel-world-scene.tsx',
  'src/ui/pixel/facility-sprites.tsx',
  'src/ui/pixel/actor-sprite.tsx',
  'src/ui/pixel/channy-sprite.tsx',
  'src/ui/pixel/living-office.css',
] as const;

describe('living pixel-office measured prototype budgets', () => {
  it('projects 600 active frames below the pure 8ms p95 gate', () => {
    const layout = createPixelWorldLayout(LIVING_PIXEL_PROTOTYPE_PROJECTION.pods);
    for (let index = 0; index < 60; index += 1) project(index * 33.333, layout);
    const samples = Array.from({ length: 600 }, (_, index) => {
      const start = performance.now();
      project(index * 33.333, layout);
      return performance.now() - start;
    });
    const p95 = percentile95(samples);
    const report = {
      schemaVersion: 'agent-office.pixel-prototype-performance.v1',
      referenceRuntime: `node-${process.versions.node}-${process.platform}-${process.arch}`,
      frameSamples: samples.length,
      warmupFrames: 60,
      projectionP50Ms: round(percentile(samples, 0.5)),
      projectionP95Ms: round(p95),
      projectionMaxMs: round(Math.max(...samples)),
      displayObjects: 3,
      textureSources: PIXEL_ATLAS_BUNDLES.length,
      generatedRgbaBytes: totalGeneratedRgbaBytes(),
    };
    console.info(`PIXEL_PROTOTYPE_PERFORMANCE ${JSON.stringify(report)}`);
    expect(p95).toBeLessThanOrEqual(8);
    expect(report.displayObjects).toBeLessThanOrEqual(1600);
    expect(report.textureSources).toBeLessThanOrEqual(4);
    expect(report.generatedRgbaBytes).toBeLessThanOrEqual(32 * 1024 * 1024);
  });

  it('keeps the authored prototype source payload below the 300KiB lazy budget', () => {
    const bytes = PIXEL_RUNTIME_SOURCES
      .map((source) => readFileSync(path.resolve(import.meta.dirname, `../../${source}`)))
      .reduce<Buffer>((joined, source) => Buffer.concat([joined, source]), Buffer.alloc(0));
    const gzipBytes = gzipSync(bytes, { level: 9 }).byteLength;
    expect(gzipBytes).toBeLessThanOrEqual(300 * 1024);
  });

  it('projects the exact 12-Pod, 64-actor and 200-WorkUnit design load within bounds', () => {
    const projection = createDesignLoadProjection();
    const layout = createPixelWorldLayout(projection.pods);
    for (let index = 0; index < 60; index += 1) projectLoad(index * 33.333, layout, projection);
    const samples = Array.from({ length: 600 }, (_, index) => {
      const start = performance.now();
      projectLoad(index * 33.333, layout, projection);
      return performance.now() - start;
    });
    const frame = projectLoad(4500, layout, projection);
    const report = {
      schemaVersion: 'agent-office.pixel-prototype-design-load.v1',
      pods: projection.pods.length,
      actors: projection.actors.length,
      workUnits: projection.pods.reduce((total, pod) => total + pod.totalWorkUnits, 0),
      semanticEntities: frame.semanticEntities.length,
      projectedFrameP95Ms: round(percentile95(samples)),
      displayObjects: 3,
      textureSources: PIXEL_ATLAS_BUNDLES.length,
    };
    console.info(`PIXEL_PROTOTYPE_DESIGN_LOAD ${JSON.stringify(report)}`);
    expect(report.pods).toBe(12);
    expect(report.actors).toBe(64);
    expect(report.workUnits).toBe(200);
    expect(frame.actorFrames.filter((actor) => actor.visible)).toHaveLength(64);
    expect(report.projectedFrameP95Ms).toBeLessThanOrEqual(8);
    expect(report.displayObjects).toBeLessThanOrEqual(1600);
    expect(report.textureSources).toBeLessThanOrEqual(4);
  });
});

function project(logicalTimeMs: number, layout: ReturnType<typeof createPixelWorldLayout>) {
  return projectPixelWorldFrame(LIVING_PIXEL_PROTOTYPE_PROJECTION, layout, {
    selectedPodId: 'pod:agent-office',
    logicalTimeMs: logicalTimeMs % 26_000,
    presentationTier: 'PIXEL_FULL',
    scenarioId: null,
    cameraOverride: null,
    viewportWidth: 1200,
    viewportHeight: 620,
  });
}

function projectLoad(
  logicalTimeMs: number,
  layout: ReturnType<typeof createPixelWorldLayout>,
  projection: PixelPrototypeProjection,
) {
  return projectPixelWorldFrame(projection, layout, {
    selectedPodId: 'pod:load-00',
    logicalTimeMs: logicalTimeMs % 26_000,
    presentationTier: 'PIXEL_FULL',
    scenarioId: 'full-office',
    cameraOverride: null,
    viewportWidth: 1200,
    viewportHeight: 620,
  });
}

function createDesignLoadProjection(): PixelPrototypeProjection {
  const actors: readonly PixelActorInput[] = Array.from({ length: 64 }, (_, index) => {
    const podIndex = index % 12;
    const teamIndex = podIndex < 6 ? 0 : 1;
    return {
      roleInstanceId: `load.actor.${index.toString().padStart(2, '0')}`,
      displayName: `Load Actor ${index + 1}`,
      roleCategory: index === 0 || index === 6 ? 'ADVISOR_ROUTING' : 'GENERIC_REGISTERED',
      advisorTeamId: `LOAD_ADVISOR_TEAM_${teamIndex}`,
      responsibleAdvisorRoleInstanceId: teamIndex === 0 ? 'load.actor.00' : 'load.actor.06',
      projectId: `load-${podIndex.toString().padStart(2, '0')}`,
      assignmentVerified: true,
      presentationPodId: `pod:load-${podIndex.toString().padStart(2, '0')}`,
    };
  });
  const pods: readonly PixelPodInput[] = Array.from({ length: 12 }, (_, index) => {
    const projectId = `load-${index.toString().padStart(2, '0')}`;
    const actorRoleInstanceIds = actors
      .filter((actor) => actor.presentationPodId === `pod:${projectId}`)
      .map((actor) => actor.roleInstanceId);
    const totalWorkUnits = index < 8 ? 17 : 16;
    return {
      podId: `pod:${projectId}`,
      advisorTeamId: `LOAD_ADVISOR_TEAM_${index < 6 ? 0 : 1}`,
      responsibleAdvisorRoleInstanceId: index < 6 ? 'load.actor.00' : 'load.actor.06',
      projectIdentity: {
        identityId: `agent-office.pixel-project-identity.${projectId}.v1`,
        projectId,
        displayName: `Load Project ${index + 1}`,
        shortLabel: `L${index + 1}`,
        primaryColor: 0x5088e0 + index * 0x010101,
        secondaryColor: 0xffcf7e,
        glyph: String.fromCharCode(65 + index),
        pattern: ['DOTS', 'BANDS', 'CHECKS', 'CHEVRON', 'CROSS', 'GRID'][index % 6] as PixelPodInput['projectIdentity']['pattern'],
      },
      missionShortLabel: `Synthetic load mission ${index + 1}`,
      currentWorkUnitShortId: `LOAD-IWU-${index + 1}`,
      currentActorRoleInstanceId: actorRoleInstanceIds[0] ?? `load.unassigned.${index}`,
      operationalState: 'WORKING',
      completedWorkUnits: Math.floor(totalWorkUnits / 2),
      totalWorkUnits,
      completedGates: 2,
      totalGates: 5,
      blockerSummary: null,
      actorRoleInstanceIds,
    };
  });
  return {
    schemaVersion: 'agent-office.pixel-prototype-projection.v1',
    fixtureId: PIXEL_PROTOTYPE_FIXTURE_ID,
    fixtureLabel: 'SYNTHETIC PROTOTYPE',
    projectionRevision: 1,
    evaluatedAt: '2026-07-12T12:00:00.000Z',
    selectedPodId: 'pod:load-00',
    pods,
    actors,
    cues: [],
    sourceEventIds: [],
  };
}

function percentile95(samples: readonly number[]): number {
  return percentile(samples, 0.95);
}

function percentile(samples: readonly number[], ratio: number): number {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)] ?? Number.POSITIVE_INFINITY;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
