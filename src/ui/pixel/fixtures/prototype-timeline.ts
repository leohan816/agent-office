export interface PixelPrototypeTimelineSegment {
  readonly segmentId: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly label: string;
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
  segment('channy-eat', 19_000, 20_500, 'Channy neutral eat cycle'),
  segment('channy-sleep', 20_500, 22_000, 'Channy neutral sleep cycle'),
  segment('waiting-leo', 22_000, 23_000, 'Accepted synthetic WAITING_LEO'),
  segment('blocked', 23_000, 24_000, 'Accepted synthetic BLOCKED'),
  segment('detail-open', 24_000, 25_000, 'Secondary DOM technical panel opens'),
  segment('detail-return', 25_000, 26_001, 'Technical panel closes and camera returns to full office'),
] as const satisfies readonly PixelPrototypeTimelineSegment[];

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

function segment(
  segmentId: string,
  startMs: number,
  endMs: number,
  label: string,
): PixelPrototypeTimelineSegment {
  return { segmentId, startMs, endMs, label };
}
