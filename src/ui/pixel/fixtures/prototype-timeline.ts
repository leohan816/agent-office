import type { ChannyAnimation } from '../contracts.js';

export interface PixelPrototypeTimelineSegment {
  readonly segmentId: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly label: string;
}

export interface ChannyNaturalSequenceSegment {
  readonly segmentId: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly animation: ChannyAnimation;
  readonly startAnchorId: string;
  readonly endAnchorId: string;
  readonly moving: boolean;
}

export interface ChannyNaturalSequenceFrame {
  readonly segment: ChannyNaturalSequenceSegment;
  readonly linearProgress: number;
  readonly easedProgress: number;
}

export const PIXEL_PROTOTYPE_TIMELINE = [
  segment('full-office', 0, 2000, 'Full shared office and facilities'),
  segment('camera-foundation', 2000, 4000, 'Camera focus, zoom and full-office return'),
  segment('identity-comparison', 4000, 6000, 'Foundation and VibeNews identity comparison'),
  segment('worker-walk', 6000, 8000, 'Verified Worker bounded walk'),
  segment('channy-roam', 8000, 10_000, 'Channy neutral walkway roam'),
  segment('advisor-handoff', 10_000, 13_000, 'Advisor carries one synthetic document'),
  segment('worker-typing', 13_000, 15_000, 'Accepted synthetic WORKING typing microcycle'),
  segment('reviewer-active', 15_000, 17_000, 'Fable5 independent review booth'),
  segment('lounge-idle', 17_000, 19_000, 'Verified-idle coffee lounge'),
  segment('channy-eat', 19_000, 20_000, 'Channy neutral eat cycle'),
  segment('channy-drink', 20_000, 21_000, 'Channy neutral drink cycle'),
  segment('channy-sleep', 21_000, 22_000, 'Channy neutral sleep cycle'),
  segment('waiting-leo', 22_000, 23_000, 'Accepted synthetic WAITING_LEO'),
  segment('blocked', 23_000, 24_000, 'Accepted synthetic BLOCKED'),
  segment('detail-open', 24_000, 25_000, 'Secondary DOM technical panel opens'),
  segment('detail-return', 25_000, 26_001, 'Technical panel closes and camera returns to full office'),
] as const satisfies readonly PixelPrototypeTimelineSegment[];

export const CHANNY_NATURAL_SEQUENCE = [
  channySegment('sit-home', 0, 2500, 'SIT', 'facility:channy-bed', 'facility:channy-bed', false),
  channySegment('walk-to-center', 2500, 5200, 'WALK', 'walkway:west', 'walkway:center', true),
  channySegment('stop-center', 5200, 6500, 'STOP', 'walkway:center', 'walkway:center', false),
  channySegment('sniff-center', 6500, 7800, 'SNIFF', 'walkway:center', 'walkway:center', false),
  channySegment('walk-to-east', 7800, 9800, 'WALK', 'walkway:center', 'walkway:east', true),
  channySegment('stop-east', 9800, 11_200, 'STOP', 'walkway:east', 'walkway:east', false),
  channySegment('sit-lounge', 11_200, 12_600, 'SIT', 'facility:lounge', 'facility:lounge', false),
  channySegment('play-lounge', 12_600, 14_300, 'PLAY', 'facility:lounge', 'facility:lounge', false),
  channySegment('walk-to-food', 14_300, 16_100, 'WALK', 'walkway:east', 'facility:channy-food', true),
  channySegment('stop-food', 16_100, 17_600, 'STOP', 'facility:channy-food', 'facility:channy-food', false),
  channySegment('eat', 17_600, 19_100, 'EAT', 'facility:channy-food', 'facility:channy-food', false),
  channySegment('stop-water', 19_100, 20_400, 'STOP', 'facility:channy-water', 'facility:channy-water', false),
  channySegment('drink', 20_400, 21_800, 'DRINK', 'facility:channy-water', 'facility:channy-water', false),
  channySegment('sleep', 21_800, 24_100, 'SLEEP', 'facility:channy-bed', 'facility:channy-bed', false),
  channySegment('sit-awake', 24_100, 25_000, 'SIT', 'facility:channy-bed', 'facility:channy-bed', false),
  channySegment('play-close', 25_000, 26_001, 'PLAY', 'facility:lounge', 'facility:lounge', false),
] as const satisfies readonly ChannyNaturalSequenceSegment[];

export function timelineSegmentAt(logicalTimeMs: number): PixelPrototypeTimelineSegment {
  const bounded = Math.max(0, Math.min(26_000, logicalTimeMs));
  return PIXEL_PROTOTYPE_TIMELINE.find((segment) =>
    bounded >= segment.startMs && bounded < segment.endMs)
    ?? PIXEL_PROTOTYPE_TIMELINE[PIXEL_PROTOTYPE_TIMELINE.length - 1]
    ?? segment('full-office', 0, 26_001, 'Full shared office');
}

export function segmentProgress(
  segment: PixelPrototypeTimelineSegment,
  logicalTimeMs: number,
): number {
  return Math.max(0, Math.min(1, (logicalTimeMs - segment.startMs) / (segment.endMs - segment.startMs)));
}

export function channyNaturalSequenceAt(logicalTimeMs: number): ChannyNaturalSequenceFrame {
  const bounded = Math.max(0, Math.min(26_000, logicalTimeMs));
  const segment = CHANNY_NATURAL_SEQUENCE.find((candidate) =>
    bounded >= candidate.startMs && bounded < candidate.endMs)
    ?? CHANNY_NATURAL_SEQUENCE[CHANNY_NATURAL_SEQUENCE.length - 1];
  if (segment === undefined) throw new TypeError('Channy natural sequence is empty');
  const linearProgress = Math.max(0, Math.min(1, (bounded - segment.startMs) / (segment.endMs - segment.startMs)));
  return {
    segment,
    linearProgress,
    easedProgress: easeInOutCubic(linearProgress),
  };
}

function segment(
  segmentId: string,
  startMs: number,
  endMs: number,
  label: string,
): PixelPrototypeTimelineSegment {
  return { segmentId, startMs, endMs, label };
}

function channySegment(
  segmentId: string,
  startMs: number,
  endMs: number,
  animation: ChannyAnimation,
  startAnchorId: string,
  endAnchorId: string,
  moving: boolean,
): ChannyNaturalSequenceSegment {
  return { segmentId, startMs, endMs, animation, startAnchorId, endAnchorId, moving };
}

function easeInOutCubic(progress: number): number {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}
