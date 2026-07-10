import { describe, expect, it } from 'vitest';

import {
  applyMissionEvent,
  createInitialProjection,
  replayFromCheckpoint,
  replayMission,
} from '../../src/application/projections/mission-projector.js';
import { createEvent, type EventEnvelope } from '../../src/domain/events/index.js';
import { canonicalize } from '../../src/persistence/file-store/canonical-json.js';
import { FIXED_TIME, MISSION_ID, loadApprovedManifest, uuidV7 } from '../helpers/fixtures.js';

function event(
  sequence: number,
  previousEventHash: string,
  eventType: 'WorkUnitStateTransitioned' | 'RoleActivityChanged',
  payload: Record<string, string | string[]>,
): EventEnvelope {
  return createEvent({
    eventId: uuidV7(sequence * 10 + 1),
    eventType,
    missionId: MISSION_ID,
    sequence,
    manifestVersion: 1,
    requestId: uuidV7(sequence * 10 + 2),
    correlationId: uuidV7(100),
    causationId: uuidV7(sequence * 10 + 4),
    actor: { role: 'Advisor', subjectId: 'advisor-test' },
    occurredAt: FIXED_TIME,
    receivedAt: FIXED_TIME,
    recordedAt: FIXED_TIME,
    previousEventHash,
    payload,
  });
}

describe('deterministic projection replay', () => {
  it('produces byte-equivalent canonical content from genesis and checkpoint', async () => {
    const manifest = await loadApprovedManifest();
    const initial = createInitialProjection(manifest);
    const first = event(1, initial.eventHash, 'WorkUnitStateTransitioned', {
      workUnitId: 'AO-WU-07',
      from: 'WAITING_DEPENDENCY',
      to: 'READY',
    });
    const second = event(2, first.eventHash, 'WorkUnitStateTransitioned', {
      workUnitId: 'AO-WU-07',
      from: 'READY',
      to: 'DISPATCHED',
    });
    const third = event(3, second.eventHash, 'RoleActivityChanged', {
      workUnitId: 'AO-WU-07',
      activity: 'DELIVERY',
      reasonCode: 'WORKUNIT_DISPATCH',
      sourceEventIds: [second.eventId],
      effectiveFrom: FIXED_TIME,
    });
    const events = [first, second, third];
    const fromGenesis = replayMission(manifest, events);
    const checkpoint = applyMissionEvent(initial, first);
    const fromCheckpoint = replayFromCheckpoint(checkpoint, events.slice(1));
    expect(canonicalize(fromCheckpoint)).toBe(canonicalize(fromGenesis));
    expect(fromGenesis.workUnits['AO-WU-07']).toMatchObject({
      state: 'DISPATCHED',
      requiredObservableName: 'DISPATCHING',
    });
    expect(fromGenesis.numerator).toBe(5);
    expect(fromGenesis.denominator).toBe(15);
  });

  it('never reads a clock or random value during a pure fold', async () => {
    const manifest = await loadApprovedManifest();
    const first = replayMission(manifest, []);
    const second = replayMission(manifest, []);
    expect(canonicalize(first)).toBe(canonicalize(second));
    expect(canonicalize(first)).not.toContain('rebuiltAt');
  });
});
