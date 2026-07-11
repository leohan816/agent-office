import { describe, expect, it } from 'vitest';

import { redactedLifecycleAudit } from '../../src/application/audit/index.js';
import { createEvent } from '../../src/domain/events/index.js';
import { GENESIS_EVENT_HASH } from '../../src/persistence/file-store/hashing.js';
import { FIXED_TIME, MISSION_ID, uuidV7 } from '../helpers/fixtures.js';

describe('redacted lifecycle audit projection', () => {
  it('retains the durable hash chain and identifiers while excluding message content', () => {
    const first = createEvent({
      eventId: uuidV7(5000),
      eventType: 'AdvisorMessagePersisted',
      missionId: MISSION_ID,
      sequence: 1,
      manifestVersion: 1,
      requestId: uuidV7(5001),
      correlationId: uuidV7(5002),
      causationId: uuidV7(5003),
      actor: { role: 'Leo/GPT', subjectId: 'leo' },
      occurredAt: FIXED_TIME,
      receivedAt: FIXED_TIME,
      recordedAt: FIXED_TIME,
      previousEventHash: GENESIS_EVENT_HASH,
      payload: {
        messageId: uuidV7(5004),
        messageArtifactHash: `sha256:${'a'.repeat(64)}`,
        bodyText: 'must never enter the redacted audit projection',
      },
    });
    const second = createEvent({
      eventId: uuidV7(5010),
      eventType: 'AdvisorMessageAcknowledged',
      missionId: MISSION_ID,
      sequence: 2,
      manifestVersion: 1,
      requestId: uuidV7(5011),
      correlationId: uuidV7(5002),
      causationId: first.eventId,
      actor: { role: 'Advisor', subjectId: 'advisor' },
      occurredAt: FIXED_TIME,
      receivedAt: FIXED_TIME,
      recordedAt: FIXED_TIME,
      previousEventHash: first.eventHash,
      payload: {
        messageId: uuidV7(5004),
        acknowledgementArtifactHash: `sha256:${'b'.repeat(64)}`,
        note: 'also excluded',
      },
    });
    const audit = redactedLifecycleAudit([first, second]);
    expect(audit).toHaveLength(2);
    expect(audit[1]?.previousEventHash).toBe(audit[0]?.eventHash);
    expect(audit[0]?.references).toEqual({
      messageId: uuidV7(5004),
      messageArtifactHash: `sha256:${'a'.repeat(64)}`,
    });
    expect(JSON.stringify(audit)).not.toContain('must never enter');
    expect(JSON.stringify(audit)).not.toContain('also excluded');
  });
});
