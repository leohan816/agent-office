import { describe, expect, it } from 'vitest';

import type { AuthenticatedSpatialPresentationV1 } from '../../src/application/spatial-office/authenticated-projection.js';
import {
  projectAuthenticatedSpatialCues,
  selectAuthenticatedSpatialPresentation,
  selectLivingOfficePresentationTier,
} from '../../src/ui/spatial/compatibility.js';
import {
  authenticatedSpatialPresentationFixture,
  m1SceneRolesFixture,
} from '../helpers/authenticated-spatial.js';

describe('BA-WU-07 living-office presentation-tier selection', () => {
  it.each([
    [{ renderInputOk: true, fallbackTier: 'DOM_STATIC', reducedMotion: false }, 'PIXEL_FULL'],
    [{ renderInputOk: true, fallbackTier: 'DOM_STATIC', reducedMotion: true }, 'DOM_STATIC'],
    [{ renderInputOk: false, fallbackTier: 'DOM_STATIC', reducedMotion: false }, 'DOM_STATIC'],
    [{ renderInputOk: false, fallbackTier: 'M1_FIXED_STATIONS', reducedMotion: false }, 'M1_FIXED_STATIONS'],
    [{ renderInputOk: false, fallbackTier: 'M1_FIXED_STATIONS', reducedMotion: true }, 'M1_FIXED_STATIONS'],
  ] as const)('selects %o as %s', (input, expected) => {
    expect(selectLivingOfficePresentationTier(input)).toBe(expected);
  });
});

describe('AO12-IWU-13 authenticated spatial selection and rollback', () => {
  it.each([
    ['FULL', false, 'FULL', 'SPATIAL_FULL_SELECTED'],
    ['RESTRAINED', false, 'RESTRAINED', 'SPATIAL_RESTRAINED_SELECTED'],
    ['STATIC', false, 'STATIC', 'SPATIAL_STATIC_REQUESTED'],
    ['FULL', true, 'STATIC', 'SPATIAL_STATIC_REDUCED_MOTION'],
  ] as const)('selects %s with reducedMotion=%s as %s', (
    requestedTier,
    reducedMotion,
    mode,
    reasonCode,
  ) => {
    expect(selectAuthenticatedSpatialPresentation({
      candidate: authenticatedSpatialPresentationFixture(),
      sceneRoles: m1SceneRolesFixture(),
      requestedTier,
      reducedMotion,
    })).toMatchObject({ mode, reasonCode, requestedTier });
  });

  it.each([
    ['STALE', 'CONNECTED', 'VERIFIED', 'NONE'],
    ['CURRENT', 'OFFLINE', 'VERIFIED', 'NONE'],
    ['CURRENT', 'CONNECTED', 'CONFLICT', 'NONE'],
    ['CURRENT', 'CONNECTED', 'VERIFIED', 'CRITICAL'],
  ] as const)('keeps facts but selects STATIC for %s/%s/%s/%s', (
    evidenceFreshness,
    connectionState,
    authorityStatus,
    severity,
  ) => {
    const presentation = degradedPresentation({
      evidenceFreshness,
      connectionState,
      authorityStatus,
      severity,
    });
    const selection = selectAuthenticatedSpatialPresentation({
      candidate: presentation,
      sceneRoles: m1SceneRolesFixture(),
    });
    expect(selection.mode).toBe('STATIC');
    expect(selection.presentation?.projection.pods[0]).toMatchObject({
      evidenceFreshness,
      connectionState,
      authorityStatus,
      alertSummary: { severity },
    });
    expect(selection.presentation?.projection.selectedMissionBoard).not.toBeNull();
  });

  it.each([
    [undefined, 'SPATIAL_SCHEMA_ABSENT_M1_FALLBACK'],
    [{ schemaVersion: 'future.spatial.v9' }, 'SPATIAL_SCHEMA_UNKNOWN_M1_FALLBACK'],
    [{ schemaVersion: 'agent-office.authenticated-spatial-presentation.v1' }, 'SPATIAL_SCHEMA_INVALID_M1_FALLBACK'],
  ] as const)('falls back to unchanged M1 without side effects for %o', (candidate, reasonCode) => {
    const roles = m1SceneRolesFixture();
    const before = JSON.stringify(roles);
    const selection = selectAuthenticatedSpatialPresentation({ candidate, sceneRoles: roles });
    expect(selection.mode).toBe('M1_FIXED_STATIONS');
    expect(selection.reasonCode).toBe(reasonCode);
    expect(selection.m1View?.compatibilityMode).toBe('M1_FIXED_STATIONS');
    expect(selection.m1View?.staticFallback).toBe(true);
    expect(selection.m1View?.stations).toHaveLength(8);
    expect(selection.m1View?.scene.pendingCues).toEqual([]);
    expect(JSON.stringify(roles)).toBe(before);
  });

  it('projects only LIVE_DELTA and never replays snapshot/login/reload/reset/resume cues', () => {
    const presentation = authenticatedSpatialPresentationFixture();
    const live = projectAuthenticatedSpatialCues({
      presentation,
      previousAppliedRevision: 12,
      updateOrigin: 'LIVE_DELTA',
    });
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({ diagnosticCode: 'ELIGIBLE', cue: { cueKind: 'WORKING' } });
    for (const updateOrigin of [
      'INITIAL_SNAPSHOT',
      'RELOAD_SNAPSHOT',
      'CURSOR_RESET_SNAPSHOT',
      'TAB_RESUME',
    ] as const) {
      expect(projectAuthenticatedSpatialCues({
        presentation,
        previousAppliedRevision: -1,
        updateOrigin,
      })[0]).toMatchObject({ cue: null, diagnosticCode: 'NOT_LIVE_DELTA' });
    }
  });
});

function degradedPresentation(input: {
  readonly evidenceFreshness: 'CURRENT' | 'STALE';
  readonly connectionState: 'CONNECTED' | 'OFFLINE';
  readonly authorityStatus: 'VERIFIED' | 'CONFLICT';
  readonly severity: 'NONE' | 'CRITICAL';
}): AuthenticatedSpatialPresentationV1 {
  const presentation = authenticatedSpatialPresentationFixture();
  const selectedPodId = presentation.projection.selectedPodId;
  const degraded = input.evidenceFreshness !== 'CURRENT'
    || input.connectionState !== 'CONNECTED'
    || input.authorityStatus !== 'VERIFIED';
  return {
    ...presentation,
    projection: {
      ...presentation.projection,
      pods: presentation.projection.pods.map((pod) => pod.podId !== selectedPodId
        ? pod
        : {
            ...pod,
            evidenceFreshness: input.evidenceFreshness,
            connectionState: input.connectionState,
            authorityStatus: input.authorityStatus,
            alertSummary: { severity: input.severity, openCount: input.severity === 'NONE' ? 0 : 1 },
            fullChoreographyEnabled: degraded ? false : pod.fullChoreographyEnabled,
            actorAssignments: pod.actorAssignments.map((assignment) => ({
              ...assignment,
              taskMotionAllowed: degraded ? false : assignment.taskMotionAllowed,
            })),
          }),
      actorsByRoleInstanceId: Object.fromEntries(Object.entries(
        presentation.projection.actorsByRoleInstanceId,
      ).map(([roleInstanceId, actor]) => [
        roleInstanceId,
        degraded ? { ...actor, taskMotionAllowed: false } : actor,
      ])),
    },
  };
}
