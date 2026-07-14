import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import {
  parsePointerDeliveryGrant,
  parseReceiveGrant,
  RECEIVE_GRANT_FORBIDDEN_FIELDS,
} from '../../src/application/slack-pilot/contracts.js';
import {
  AS1_PROFILE_IDS,
  allAs1Profiles,
  assertAs1ProfileId,
  isAs1ProfileId,
  selectProfile,
  validateProfileLineage,
  type As1Profile,
} from '../../src/application/slack-pilot/profiles.js';
import { validPointerDeliveryGrant, validReceiveGrant } from '../helpers/as1-slack-fakes.js';

function grabDomainError(fn: () => unknown): DomainError {
  try {
    fn();
  } catch (error) {
    if (error instanceof DomainError) return error;
    throw error;
  }
  throw new Error('expected a DomainError but none was thrown');
}

describe('AS1 closed profile union', () => {
  it('exposes exactly two profile literals', () => {
    expect(AS1_PROFILE_IDS).toStrictEqual(['AGENT_OFFICE_ADVISOR', 'FOUNDATION_ADVISOR']);
    expect(allAs1Profiles()).toHaveLength(2);
  });

  it('selects the exact reviewed identity for each literal', () => {
    const agentOffice = selectProfile('AGENT_OFFICE_ADVISOR');
    expect(agentOffice.roleInstanceId).toBe('foundation-advisor');
    expect(agentOffice.actorId).toBe('agent-office-advisor');
    expect(agentOffice.advisorTeam).toBe('AGENT_OFFICE_ADVISOR_TEAM');
    expect(agentOffice.workspace).toBe('/home/leo/Project/agent-office');

    const foundation = selectProfile('FOUNDATION_ADVISOR');
    expect(foundation.roleInstanceId).toBe('foundation-advisor-20260714-01');
    expect(foundation.actorId).toBe('foundation-advisor');
    expect(foundation.advisorTeam).toBe('FOUNDATION_ADVISOR_TEAM');
    expect(foundation.workspace).toBe('/home/leo/Project/FOUNDATION');
  });

  it('accepts the two literals and rejects any third string', () => {
    expect(isAs1ProfileId('AGENT_OFFICE_ADVISOR')).toBe(true);
    expect(isAs1ProfileId('FOUNDATION_ADVISOR')).toBe(true);
    expect(isAs1ProfileId('FOUNDATION')).toBe(false);
    expect(isAs1ProfileId('VIBENEWS_ADVISOR')).toBe(false);
    expect(isAs1ProfileId('agent-office-advisor')).toBe(false);
    expect(grabDomainError(() => assertAs1ProfileId('FOUNDATION')).code).toBe('FORBIDDEN_TARGET');
    expect(grabDomainError(() => assertAs1ProfileId(null)).code).toBe('FORBIDDEN_TARGET');
  });

  it('validates both profiles against the committed organization registry', () => {
    expect(() => {
      validateProfileLineage(selectProfile('AGENT_OFFICE_ADVISOR'));
    }).not.toThrow();
    expect(() => {
      validateProfileLineage(selectProfile('FOUNDATION_ADVISOR'));
    }).not.toThrow();
  });

  it('rejects the historical foundation-advisor join key inside the Foundation profile', () => {
    const forged: As1Profile = { ...selectProfile('FOUNDATION_ADVISOR'), roleInstanceId: 'foundation-advisor' };
    expect(grabDomainError(() => {
      validateProfileLineage(forged);
    }).code).toBe('UNAUTHORIZED_ACTOR');
  });

  it('rejects a profile whose actorId does not match the registry row', () => {
    const forged: As1Profile = { ...selectProfile('AGENT_OFFICE_ADVISOR'), actorId: 'foundation-advisor' };
    expect(grabDomainError(() => {
      validateProfileLineage(forged);
    }).code).toBe('UNAUTHORIZED_ACTOR');
  });
});

describe('AS1 pre-event receive grant parser', () => {
  it('accepts a minimal valid grant with exactly its bounded pre-event fields', () => {
    const grant = parseReceiveGrant(validReceiveGrant());
    expect(grant.profileId).toBe('AGENT_OFFICE_ADVISOR');
    expect(grant.rootLimit).toBe(1);
    expect(grant.conversationLimit).toBe(1);
  });

  it('rejects EVERY forbidden future event/intake/pointer/destination/authority field', () => {
    const forbiddenSamples: Record<string, unknown> = {
      sourceEventId: 'Ev0AGENTOFFICE01',
      eventId: 'Ev0AGENTOFFICE01',
      rootTs: '1720000000.000100',
      intakeId: 'as1-intake-0001',
      pointerArtifactRef: 'artifacts/x',
      pointerHash: `sha256:${'9'.repeat(64)}`,
      pointerDeliveryGrantId: 'as1-pdg-0001',
      rootCorrelationHash: `sha256:${'8'.repeat(64)}`,
      receiveGrantBindingHash: `sha256:${'7'.repeat(64)}`,
      destination: 'agent-office-advisor',
      capability: 'x',
      leaseId: 'lease-1',
      useLimit: 1,
    };
    for (const [field, value] of Object.entries(forbiddenSamples)) {
      const error = grabDomainError(() => parseReceiveGrant(validReceiveGrant({ [field]: value })));
      expect(error.code, `field ${field}`).toBe('UNKNOWN_FIELD');
      expect(error.message).toContain(field);
    }
    // Every advertised forbidden field is actually in the enforced list.
    for (const field of ['sourceEventId', 'intakeId', 'pointerHash', 'destination', 'capability', 'useLimit']) {
      expect(RECEIVE_GRANT_FORBIDDEN_FIELDS).toContain(field);
    }
  });

  it('rejects an unknown non-forbidden field', () => {
    expect(grabDomainError(() => parseReceiveGrant(validReceiveGrant({ extra: 'x' }))).code).toBe('UNKNOWN_FIELD');
  });

  it('rejects rootLimit or conversationLimit other than 1', () => {
    expect(grabDomainError(() => parseReceiveGrant(validReceiveGrant({ rootLimit: 2 }))).code).toBe('INVALID_SCHEMA');
    expect(grabDomainError(() => parseReceiveGrant(validReceiveGrant({ conversationLimit: 0 }))).code).toBe(
      'INVALID_SCHEMA',
    );
  });

  it('rejects a non-literal profileId', () => {
    expect(grabDomainError(() => parseReceiveGrant(validReceiveGrant({ profileId: 'FOUNDATION' }))).code).toBe(
      'FORBIDDEN_TARGET',
    );
  });

  it('rejects an expiry window longer than the 15-minute maximum', () => {
    const error = grabDomainError(() =>
      parseReceiveGrant(
        validReceiveGrant({ issuedAt: '2026-07-14T22:00:00.000Z', expiresAt: '2026-07-14T22:20:00.000Z' }),
      ),
    );
    expect(error.code).toBe('INVALID_SCHEMA');
  });

  it('rejects a non-canonical timestamp', () => {
    expect(grabDomainError(() => parseReceiveGrant(validReceiveGrant({ expiresAt: '2026-07-14 22:10:00Z' }))).code).toBe(
      'INVALID_SCHEMA',
    );
  });
});

describe('AS1 post-intake pointer-delivery grant parser', () => {
  it('accepts a valid delivery grant binding the exact intake/pointer facts', () => {
    const grant = parsePointerDeliveryGrant(validPointerDeliveryGrant());
    expect(grant.intakeId).toBe('as1-intake-0001');
    expect(grant.useLimit).toBe(1);
    expect(grant.actorId).toBe('agent-office-advisor');
  });

  it('rejects a delivery grant missing a required field', () => {
    for (const required of ['intakeId', 'pointerHash', 'sourceEventId', 'rootCorrelationHash', 'receiveGrantBindingHash']) {
      const record = validPointerDeliveryGrant();
      Reflect.deleteProperty(record, required);
      expect(grabDomainError(() => parsePointerDeliveryGrant(record)).code, `missing ${required}`).toBe(
        'INVALID_SCHEMA',
      );
    }
  });

  it('rejects a useLimit other than 1', () => {
    expect(grabDomainError(() => parsePointerDeliveryGrant(validPointerDeliveryGrant({ useLimit: 2 }))).code).toBe(
      'INVALID_SCHEMA',
    );
  });

  it('rejects a delivery grant whose identity contradicts its profile lineage', () => {
    expect(
      grabDomainError(() => parsePointerDeliveryGrant(validPointerDeliveryGrant({ actorId: 'foundation-advisor' }))).code,
    ).toBe('UNAUTHORIZED_ACTOR');
    expect(
      grabDomainError(() =>
        parsePointerDeliveryGrant(validPointerDeliveryGrant({ roleInstanceId: 'foundation-advisor-20260714-01' })),
      ).code,
    ).toBe('UNAUTHORIZED_ACTOR');
  });
});
