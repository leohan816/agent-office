import { describe, expect, it } from 'vitest';

import { HermesAdvisorGateway } from '../../src/adapters/gateways/hermes/index.js';
import type { AdvisorNotificationRequest } from '../../src/adapters/gateways/advisor.js';
import { FIXED_TIME, MISSION_ID, uuidV7 } from '../helpers/fixtures.js';

describe('disabled Hermes Advisor gateway', () => {
  it('has no endpoint or transport capability and returns only a typed disabled receipt', async () => {
    const requestId = uuidV7(800);
    const hash = `sha256:${'d'.repeat(64)}`;
    const request: AdvisorNotificationRequest = {
      notificationId: uuidV7(801),
      requestId,
      missionId: MISSION_ID,
      messageId: uuidV7(802),
      messageArtifactRef: `artifacts/inbox/${MISSION_ID}/${requestId}/${hash.slice(7)}.json`,
      messageArtifactHash: hash,
      messagePayloadHash: hash,
      persistedEventId: uuidV7(803),
      persistedMissionSequence: 1,
      correlationId: uuidV7(804),
    };
    const gateway = new HermesAdvisorGateway(() => FIXED_TIME);
    expect(gateway.health()).toEqual({
      adapter: 'HERMES_ADVISOR',
      status: 'DISABLED_NOT_IMPLEMENTED',
      failureCode: 'HERMES_NOT_IMPLEMENTED',
    });
    expect(await gateway.queueAdvisorNotification(request)).toMatchObject({
      adapter: 'HERMES_ADVISOR',
      status: 'DISABLED',
      failureCode: 'HERMES_NOT_IMPLEMENTED',
    });
    expect(await gateway.getDeliveryReceipt(request.notificationId)).toBeUndefined();
    expect(Object.getOwnPropertyNames(gateway)).toEqual(['now']);
  });
});
