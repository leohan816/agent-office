// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OfficeScene } from '../../src/ui/scene/office-scene.js';

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    value: (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('accessible structured-event office scene', () => {
  it('renders exactly eight stable role stations and a semantic status summary', () => {
    const { container } = render(<OfficeScene />);
    expect(container.querySelectorAll('.scene-station')).toHaveLength(8);
    expect(screen.getByRole('list', { name: '고정 역할 스테이션' })).not.toBeNull();
    expect(screen.getByRole('list', { name: '모든 역할의 현재 구조화 상태' }).children).toHaveLength(8);
    for (const role of [
      'Leo/GPT',
      'Advisor',
      'Control',
      'Foundation Worker',
      'Shashu Worker',
      'Cosmile Worker',
      'Agent Office Worker',
      'Fable5 Reviewer',
    ]) {
      expect(screen.getAllByText(role).length).toBeGreaterThan(0);
    }
  });

  it('changes only deterministic fixtures, announces safety, and exposes exact blocker detail', () => {
    const { container } = render(<OfficeScene />);
    fireEvent.change(screen.getByLabelText('구조화 이벤트 장면'), { target: { value: 'safety' } });
    const blocked = container.querySelector('[data-station-id="foundation"]');
    const leo = container.querySelector('[data-station-id="leo"]');
    expect(blocked?.getAttribute('data-state')).toBe('BLOCKED');
    expect(blocked?.textContent).toContain('MISSING_EVIDENCE / VERIFIED_POINTER_REQUIRED / ADVISOR');
    expect(leo?.textContent).toContain('LEO_DECISION_DOCUMENT_RECEIVED');
    expect(container.querySelector('.route-waiting_leo .scene-route-actor')).not.toBeNull();
    expect(container.querySelector('.route-waiting_leo [data-kind="decision"]')).not.toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('차단 또는 중요 경고');
  });

  it('uses a visible actor and one work document for the ordered delivery route', () => {
    const { container } = render(<OfficeScene />);
    fireEvent.change(screen.getByLabelText('구조화 이벤트 장면'), { target: { value: 'delivery' } });
    expect(container.querySelectorAll('.route-delivery .scene-route-actor')).toHaveLength(1);
    expect(container.querySelectorAll('.route-delivery [data-kind="work"]')).toHaveLength(1);
    expect(container.querySelector('[data-station-id="agent-office"]')?.getAttribute('data-cue')).toBe('DELIVERY');
  });

  it('persists a non-sensitive motion preference and clears current cues without replay', () => {
    render(<OfficeScene />);
    fireEvent.change(screen.getByLabelText('구조화 이벤트 장면'), { target: { value: 'delivery' } });
    const control = screen.getByRole('button', { name: '동작 끄기' });
    fireEvent.click(control);
    expect(screen.getByRole('button', { name: '동작 켜기' }).getAttribute('aria-pressed')).toBe('true');
    expect(window.localStorage.getItem('agent-office-motion-enabled')).toBe('false');
  });

  it('supports arrow, Home, and End movement with one roving station tab stop', () => {
    render(<OfficeScene />);
    const leo = screen.getByRole('button', { name: /Leo\/GPT/u });
    leo.focus();
    fireEvent.keyDown(leo, { key: 'ArrowRight' });
    expect(document.activeElement?.getAttribute('data-scene-station')).toBe('advisor');
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' });
    expect(document.activeElement?.getAttribute('data-scene-station')).toBe('agent-office');
  });

  it('pauses on hidden visibility and resumes without queuing a replay', () => {
    const { container } = render(<OfficeScene />);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    fireEvent(document, new Event('visibilitychange'));
    expect(container.querySelector('#office-scene')?.classList.contains('scene-paused')).toBe(true);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    fireEvent(document, new Event('visibilitychange'));
    expect(container.querySelector('#office-scene')?.classList.contains('scene-paused')).toBe(false);
    expect(container.querySelectorAll('[data-motion-cue]')).toHaveLength(0);
  });
});
