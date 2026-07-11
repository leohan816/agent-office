// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AdvisorMessagePersistenceReceipt } from '../../src/application/advisor-inbox/types.js';
import { buildGptDecisionPackage } from '../../src/domain/decisions/gpt-package.js';
import { CommunicationCenter } from '../../src/ui/communication/communication-center.js';
import { COMMUNICATION_CENTER_FIXTURE } from '../../src/ui/communication/fixtures.js';
import type { CommunicationCenterActionPort } from '../../src/ui/communication/types.js';

afterEach(() => {
  cleanup();
});

describe('responsive Advisor communication center component', () => {
  it('shows persistent critical alerts and separate durable message evidence stages', () => {
    render(<CommunicationCenter model={COMMUNICATION_CENTER_FIXTURE} />);
    expect(document.querySelector('.critical-alert-strip')?.textContent).toContain('해결되지 않은 중요 경고 1건');
    expect(screen.getAllByText('MANUAL_FALLBACK_REQUIRED').length).toBeGreaterThan(1);
    expect(screen.getByText('Advisor 수동 전달 필요')).not.toBeNull();
    for (const state of ['PERSISTED', 'DELIVERY_PENDING']) {
      expect(screen.getByText(state)).not.toBeNull();
    }
    fireEvent.click(screen.getByRole('tab', { name: /Alerts/u }));
    expect(document.querySelector('.critical-alert-strip')?.textContent).toContain('해결되지 않은 중요 경고 1건');
    expect(screen.getAllByText('확인과 해결은 별도 기록입니다.')).toHaveLength(2);
    expect((screen.getAllByRole('button', { name: '경고 확인' })[0] as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getAllByRole('button', { name: '증거로 해결' })[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it('submits only the typed Advisor message fields and reports persistence without claiming acknowledgement', async () => {
    const receipt: AdvisorMessagePersistenceReceipt = {
      requestId: COMMUNICATION_CENTER_FIXTURE.draftRequestId,
      messageId: '018f0000-0000-7000-8000-00000000e001',
      messageArtifactRef: 'artifacts/inbox/message.json',
      messageArtifactHash: `sha256:${'e'.repeat(64)}`,
      messagePayloadHash: `sha256:${'f'.repeat(64)}`,
      persistedEventId: '018f0000-0000-7000-8000-00000000e002',
      persistedMissionSequence: 12,
      acceptedAt: '2026-07-11T00:00:00.000Z',
      status: 'PERSISTED',
      replayed: false,
    };
    const submitAdvisorMessage = vi.fn<CommunicationCenterActionPort['submitAdvisorMessage']>(() =>
      Promise.resolve(receipt),
    );
    const actionPort: CommunicationCenterActionPort = {
      submitAdvisorMessage,
      applyAlertLifecycle: vi.fn<CommunicationCenterActionPort['applyAlertLifecycle']>(() =>
        Promise.resolve(),
      ),
      openEvidence: vi.fn<CommunicationCenterActionPort['openEvidence']>(() => Promise.resolve()),
    };
    render(<CommunicationCenter model={COMMUNICATION_CENTER_FIXTURE} actionPort={actionPort} />);
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: 'Bounded clarification' } });
    fireEvent.change(screen.getByLabelText('구조화 본문'), { target: { value: 'Ask Advisor only.' } });
    fireEvent.click(screen.getByLabelText('AO-WU-10'));
    fireEvent.click(screen.getByRole('button', { name: 'Advisor 메시지 영속 저장' }));
    await vi.waitFor(() => expect(submitAdvisorMessage).toHaveBeenCalledTimes(1));
    const command = submitAdvisorMessage.mock.calls[0]?.[0];
    expect(command).toEqual({
      requestId: COMMUNICATION_CENTER_FIXTURE.draftRequestId,
      missionId: COMMUNICATION_CENTER_FIXTURE.missionOptions[0]?.id,
      manifestVersion: 1,
      kind: 'CLARIFICATION',
      subject: 'Bounded clarification',
      bodyText: 'Ask Advisor only.',
      referencedEntityIds: ['AO-WU-10'],
      clientCreatedAt: COMMUNICATION_CENTER_FIXTURE.draftCreatedAt,
    });
    expect(Object.keys(command ?? {})).not.toContain('targetRole');
    expect(JSON.stringify(command)).not.toMatch(/session|pane|commandLine|argv|executable/iu);
    await vi.waitFor(() => expect(screen.getAllByText('PERSISTED').length).toBeGreaterThan(1));
    expect(screen.queryByText('ACKNOWLEDGED')).toBeNull();
  });

  it('copies the exact GPT package and turns pause/cancel controls into unsent Advisor drafts', async () => {
    const writeText = vi.fn<(value: string) => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const sourceAdvisorJob = {
      repository: 'foundation-docs',
      commit: 'c'.repeat(40),
      path: 'advisor/jobs/batch-d.md',
      sha256: `sha256:${'a'.repeat(64)}`,
    };
    const mission = COMMUNICATION_CENTER_FIXTURE.missionOptions[0];
    if (mission === undefined) throw new Error('communication fixture mission is missing');
    const expectedPackage = buildGptDecisionPackage({
      TARGET_ACTOR: 'Leo/GPT',
      MISSION: mission.id,
      REQUEST_ID: '018f0000-0000-7000-8000-00000000d011',
      SOURCE_ADVISOR_JOB: sourceAdvisorJob,
      READ_DECISION_REQUEST: {
        ...sourceAdvisorJob,
        path: 'advisor/jobs/decision-request.md',
        sha256: `sha256:${'b'.repeat(64)}`,
      },
      CONFIRMED_FACTS: [
        {
          factId: 'FACT-1',
          value: 'Message artifact and persisted event are durable.',
          evidenceRefs: [sourceAdvisorJob],
        },
      ],
      UNKNOWNS: [
        { unknownId: 'UNKNOWN-1', description: 'Advisor decision has not been linked.' },
      ],
      QUESTION: 'Should AO-WU-10 resume after the decision artifact is verified?',
      OPTIONS: [
        {
          optionId: 'OPTION-RESUME',
          label: 'Resume after verified decision',
          impact: 'Resume only after verified evidence.',
        },
        { optionId: 'OPTION-HOLD', label: 'Remain on hold', impact: 'No work resumes.' },
      ],
      ADVISOR_RECOMMENDATION: {
        optionId: 'OPTION-HOLD',
        rationale: 'Remain on hold until the decision and intake hashes are linked.',
      },
      SAFE_DEFAULT: 'HOLD',
    });
    expect(COMMUNICATION_CENTER_FIXTURE.alerts[0]?.gptPackageMarkdown).toBe(expectedPackage.markdown);
    render(<CommunicationCenter model={COMMUNICATION_CENTER_FIXTURE} />);
    fireEvent.click(screen.getByRole('tab', { name: /Alerts/u }));
    fireEvent.click(screen.getByRole('button', { name: 'GPT 패키지 복사' }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = writeText.mock.calls[0]?.[0] ?? '';
    expect(copied.indexOf('## TARGET_ACTOR')).toBeLessThan(copied.indexOf('## MISSION'));
    expect(copied.indexOf('## RETURN_RESULT_TO')).toBeLessThan(
      copied.indexOf('## DO_NOT_START_ANOTHER_MISSION_AUTOMATICALLY'),
    );
    expect(copied).toContain('Advisor');

    fireEvent.click(screen.getByRole('button', { name: '미션 일시정지' }));
    expect(screen.getByRole('tab', { name: /Inbox/u }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByLabelText<HTMLSelectElement>('메시지 종류').value).toBe('PAUSE');
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Advisor 메시지 영속 저장' }).disabled,
    ).toBe(true);
  });

  it('renders hostile rich text as inert text and code, never DOM controls', () => {
    const fixtureAlert = COMMUNICATION_CENTER_FIXTURE.alerts[0];
    if (fixtureAlert === undefined) throw new Error('communication fixture alert is missing');
    const model = {
      ...COMMUNICATION_CENTER_FIXTURE,
      alerts: [
        {
          ...fixtureAlert,
          summary: '<img src=x onerror=alert(1)><script>bad()</script>',
          detail: {
            ...fixtureAlert.detail,
            question: '```<button autofocus>run</button>```',
          },
        },
      ],
    };
    const { container } = render(<CommunicationCenter model={model} />);
    fireEvent.click(screen.getByRole('tab', { name: /Alerts/u }));
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('button[autofocus]')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)><script>bad()</script>')).not.toBeNull();
    expect(screen.getByText('<button autofocus>run</button>')).not.toBeNull();
  });
});
