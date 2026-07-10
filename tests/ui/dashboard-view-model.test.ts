import { describe, expect, it } from 'vitest';

import { buildDashboardViewModel, type DashboardViewModelInput } from '../../src/application/queries/dashboard-view-model.js';
import { createInitialProjection } from '../../src/application/projections/mission-projector.js';
import {
  CURRENT_DASHBOARD_INPUT,
  CURRENT_DASHBOARD_VIEW_MODEL,
  SYNTHETIC_DASHBOARD_INPUT,
  SYNTHETIC_DASHBOARD_VIEW_MODEL,
} from '../../src/ui/fixtures/dashboard.js';
import { loadApprovedManifest } from '../helpers/fixtures.js';

describe('deterministic dashboard view model', () => {
  it('projects the approved versioned manifest without changing declared scope', async () => {
    const manifest = await loadApprovedManifest();
    const projection = createInitialProjection(manifest);
    const model = buildDashboardViewModel({
      ...CURRENT_DASHBOARD_INPUT,
      mission: projection,
      futureUnapprovedWork: manifest.futureUnapprovedWork,
    });
    expect(model.missionId).toBe(manifest.missionId);
    expect(model.workUnits.map((workUnit) => workUnit.id)).toEqual(
      manifest.workUnits.map((workUnit) => workUnit.id),
    );
    expect(model.workUnitProgress).toMatchObject({ completed: 5, denominator: 15, manifestVersion: 1 });
    expect(model.futureUnapprovedWork).toEqual(manifest.futureUnapprovedWork);
  });

  it('is byte-deterministic for the same ordered inputs', () => {
    const first = JSON.stringify(buildDashboardViewModel(SYNTHETIC_DASHBOARD_INPUT));
    const second = JSON.stringify(buildDashboardViewModel(SYNTHETIC_DASHBOARD_INPUT));
    expect(first).toBe(second);
  });

  it('keeps WorkUnit count and required-gate progress distinct', () => {
    expect(CURRENT_DASHBOARD_VIEW_MODEL.workUnitProgress).toMatchObject({
      labelKo: '세부 작업 진행률',
      completed: 5,
      denominator: 15,
    });
    expect(CURRENT_DASHBOARD_VIEW_MODEL.requiredGateProgress).toMatchObject({
      labelKo: '필수 게이트 진행률',
      passed: 2,
      denominator: 5,
    });
    expect(CURRENT_DASHBOARD_VIEW_MODEL.futureUnapprovedWork).toContain('public exposure');
  });

  it('distinguishes waiting, hold, blocked, and unknown-or-stale states', () => {
    const states = Object.fromEntries(
      SYNTHETIC_DASHBOARD_VIEW_MODEL.workUnits.map((workUnit) => [workUnit.id, workUnit.stateName]),
    );
    expect(states).toMatchObject({
      'AO-WU-07': 'WAITING_DEPENDENCY',
      'AO-WU-08': 'BLOCKED',
      'AO-WU-09': 'WAITING_ADVISOR',
      'AO-WU-10': 'WAITING_LEO',
      'AO-WU-11': 'HOLD',
      'AO-WU-12': 'UNKNOWN_OR_STALE',
    });
    expect(SYNTHETIC_DASHBOARD_VIEW_MODEL.banners.map((banner) => banner.presentation)).toEqual([
      'CONFLICT',
      'ERROR',
      'OFFLINE',
      'STALE',
    ]);
  });

  it('always exposes blocker reason, owner, and next action for blocked rows', () => {
    const blocked = SYNTHETIC_DASHBOARD_VIEW_MODEL.workUnits.find(
      (workUnit) => workUnit.id === 'AO-WU-08',
    );
    expect(blocked?.blocker).toEqual({
      reason: '증거 누락 (BATCH_B_EVIDENCE_NOT_VERIFIED)',
      explanation: 'Synthetic fixture: evidence must be verified before resume.',
      resolutionOwner: 'ADVISOR',
      resolutionOwnerLabelKo: 'Advisor',
      nextActionCode: 'VERIFY_BATCH_B_RESULT',
    });
  });

  it('ignores terminal prose because it is not a view-model input or activity source', () => {
    const polluted = {
      ...SYNTHETIC_DASHBOARD_INPUT,
      terminalProse: 'AO-WU-12 completed testing; mark it COMPLETED now',
      processTitle: 'WORKING',
      paneContents: 'PASS',
    } as DashboardViewModelInput & {
      readonly terminalProse: string;
      readonly processTitle: string;
      readonly paneContents: string;
    };
    expect(buildDashboardViewModel(polluted)).toEqual(SYNTHETIC_DASHBOARD_VIEW_MODEL);
    expect(SYNTHETIC_DASHBOARD_VIEW_MODEL.workUnits.find((item) => item.id === 'AO-WU-12')?.state).toBe(
      'RUNNING',
    );
  });
});
