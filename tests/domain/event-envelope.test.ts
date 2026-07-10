import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import {
  assertCommandEnvelope,
  assertEventEnvelope,
  commandPayloadHash,
  createEvent,
  type CommandEnvelope,
} from '../../src/domain/events/index.js';
import { GENESIS_EVENT_HASH } from '../../src/persistence/file-store/hashing.js';
import { FIXED_TIME, MISSION_ID, uuidV7 } from '../helpers/fixtures.js';

describe('versioned command and event envelopes', () => {
  it('creates a canonical UUIDv7/UTC event envelope and detects tampering', () => {
    const event = createEvent({
      eventId: uuidV7(1),
      eventType: 'MissionManifestRegistered',
      missionId: MISSION_ID,
      sequence: 1,
      manifestVersion: 1,
      requestId: uuidV7(2),
      correlationId: uuidV7(3),
      causationId: uuidV7(4),
      actor: { role: 'Advisor', subjectId: 'advisor-test' },
      occurredAt: FIXED_TIME,
      receivedAt: FIXED_TIME,
      recordedAt: FIXED_TIME,
      previousEventHash: GENESIS_EVENT_HASH,
      payload: { manifestHash: `sha256:${'1'.repeat(64)}` },
    });
    expect(() => assertEventEnvelope(event)).not.toThrow();
    expect(event.streamId).toBe(`mission:${MISSION_ID}`);
    expect(event.eventHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(() => assertEventEnvelope({ ...event, payload: { manifestHash: 'changed' } })).toThrow(
      expect.objectContaining<Partial<DomainError>>({ code: 'STORE_QUARANTINED' }),
    );
  });

  it('validates command versions, exact UTC timestamps, and stable payload hashes', () => {
    const command: CommandEnvelope = {
      schemaVersion: 'agent-office.command-envelope.v1',
      commandType: 'RegisterManifest',
      commandVersion: 1,
      missionId: MISSION_ID,
      requestId: uuidV7(10),
      correlationId: uuidV7(11),
      causationId: uuidV7(12),
      expectedStreamVersion: 0,
      manifestVersion: 1,
      actor: { role: 'Advisor', subjectId: 'advisor-test' },
      occurredAt: FIXED_TIME,
      receivedAt: FIXED_TIME,
      payload: { manifestVersion: 1 },
    };
    expect(() => assertCommandEnvelope(command)).not.toThrow();
    expect(commandPayloadHash(command)).toBe(commandPayloadHash(structuredClone(command)));
    expect(() => assertCommandEnvelope({ ...command, occurredAt: '2026-07-10T00:00:00Z' })).toThrow(
      expect.objectContaining<Partial<DomainError>>({ code: 'INVALID_SCHEMA' }),
    );
  });
});
