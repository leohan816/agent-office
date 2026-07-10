// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Dashboard } from '../../src/ui/dashboard.js';
import {
  CURRENT_DASHBOARD_VIEW_MODEL,
  SYNTHETIC_DASHBOARD_VIEW_MODEL,
} from '../../src/ui/fixtures/dashboard.js';

afterEach(() => {
  cleanup();
});

describe('read-only operations dashboard component', () => {
  it('renders the actual mission hierarchy, separate progress, operations table, and evidence', () => {
    render(<Dashboard model={CURRENT_DASHBOARD_VIEW_MODEL} />);
    for (const label of ['활성 작업 묶음', '패키지', '현재 미션', '단계', '세부 작업']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByLabelText('세부 작업 진행률 5/15')).not.toBeNull();
    expect(screen.getByLabelText('필수 게이트 진행률 2/5')).not.toBeNull();
    expect(screen.getByRole('table')).not.toBeNull();
    expect(screen.getByText('M01 approved mission manifest')).not.toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByText(/dispatch command/iu)).toBeNull();
  });

  it('shows typed banners and full blocker reason, owner, and next action', () => {
    render(<Dashboard model={SYNTHETIC_DASHBOARD_VIEW_MODEL} />);
    for (const label of ['충돌', '오류', '오프라인', '오래됨']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    const selectedWorkUnit = screen.getAllByText('AO-WU-08')[0];
    if (selectedWorkUnit === undefined) throw new Error('synthetic blocked WorkUnit is missing');
    fireEvent.click(selectedWorkUnit);
    expect(screen.getAllByText('증거 누락 (BATCH_B_EVIDENCE_NOT_VERIFIED)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Advisor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('VERIFY_BATCH_B_RESULT').length).toBeGreaterThan(0);
  });

  it('provides only read-only filtering, selection, expansion, and evidence copy controls', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<Dashboard model={CURRENT_DASHBOARD_VIEW_MODEL} />);
    fireEvent.change(screen.getByLabelText('필터'), { target: { value: 'COMPLETED' } });
    expect(screen.getAllByText('완료').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText('커밋 복사'));
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('6c9d94f31ae5dd5424b511afb68188681ff95349');
    });
    expect(screen.queryByText(/send-keys|capture-pane|run-shell/iu)).toBeNull();
  });

  it('keeps long IDs, hashes, and Korean expansion in semantic scrollable layout', () => {
    const long = 'LONG_IDENTIFIER_'.repeat(20);
    const model = {
      ...CURRENT_DASHBOARD_VIEW_MODEL,
      missionId: long,
      evidence: CURRENT_DASHBOARD_VIEW_MODEL.evidence.map((evidence) => ({
        ...evidence,
        relativePath: `${long}/${long}.json`,
        sha256: `sha256:${'f'.repeat(64)}`,
        label: '매우 긴 한국어 증거 이름 '.repeat(12),
      })),
    };
    render(<Dashboard model={model} />);
    expect(screen.getAllByText(long).length).toBeGreaterThan(0);
    expect(screen.getByRole('region', { name: '세부 작업 표 가로 스크롤' })).not.toBeNull();
    expect(screen.getAllByText(`sha256:${'f'.repeat(64)}`).length).toBeGreaterThan(0);
  });
});
