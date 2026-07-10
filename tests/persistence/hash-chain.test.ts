import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import {
  assertEventEnvelope,
  assertEventFollows,
  createEvent,
  type EventEnvelope,
} from '../../src/domain/events/index.js';
import { GENESIS_EVENT_HASH } from '../../src/persistence/file-store/hashing.js';
import { FIXED_TIME, MISSION_ID, uuidV7 } from '../helpers/fixtures.js';

function chain(length: number): readonly EventEnvelope[] {
  const events: EventEnvelope[] = [];
  for (let sequence = 1; sequence <= length; sequence += 1) {
    events.push(
      createEvent({
        eventId: uuidV7(sequence * 10 + 1),
        eventType: 'EvidenceAttached',
        missionId: MISSION_ID,
        sequence,
        manifestVersion: 1,
        requestId: uuidV7(sequence * 10 + 2),
        correlationId: uuidV7(sequence * 10 + 3),
        causationId: uuidV7(sequence * 10 + 4),
        actor: { role: 'Advisor', subjectId: 'advisor-test' },
        occurredAt: FIXED_TIME,
        receivedAt: FIXED_TIME,
        recordedAt: FIXED_TIME,
        previousEventHash: events.at(-1)?.eventHash ?? GENESIS_EVENT_HASH,
        payload: { artifactId: `ARTIFACT-${sequence}` },
      }),
    );
  }
  return events;
}

describe('event hash chain', () => {
  it('verifies contiguous sequence and prior hashes over a deterministic chain', () => {
    const events = chain(128);
    for (const [index, event] of events.entries()) {
      expect(() => assertEventEnvelope(event)).not.toThrow();
      expect(() => assertEventFollows(event, events[index - 1])).not.toThrow();
    }
  });

  it('fails closed when a valid event is reordered or its previous hash changes', () => {
    const events = chain(3);
    const [first, second, third] = events;
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('chain fixture did not create three events');
    }
    expect(() => assertEventFollows(third, first)).toThrow(
      expect.objectContaining<Partial<DomainError>>({ code: 'STORE_QUARANTINED' }),
    );
    expect(() =>
      assertEventEnvelope({ ...second, previousEventHash: GENESIS_EVENT_HASH }),
    ).toThrow(expect.objectContaining<Partial<DomainError>>({ code: 'STORE_QUARANTINED' }));
  });
});
