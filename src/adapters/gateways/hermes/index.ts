import { assertUuidV7 } from '../../../domain/time/index.js';
import {
  assertAdvisorNotificationRequest,
  buildAdvisorGatewayReceipt,
  type AdvisorGateway,
  type AdvisorGatewayHealth,
  type AdvisorGatewayReceipt,
  type AdvisorNotificationRequest,
} from '../advisor.js';

export class HermesAdvisorGateway implements AdvisorGateway {
  public constructor(private readonly now: () => string) {}

  public health(): AdvisorGatewayHealth {
    return {
      adapter: 'HERMES_ADVISOR',
      status: 'DISABLED_NOT_IMPLEMENTED',
      failureCode: 'HERMES_NOT_IMPLEMENTED',
    };
  }

  public async queueAdvisorNotification(
    request: AdvisorNotificationRequest,
  ): Promise<AdvisorGatewayReceipt> {
    assertAdvisorNotificationRequest(request);
    const now = this.now();
    return Promise.resolve(
      buildAdvisorGatewayReceipt({
        notificationId: request.notificationId,
        adapter: 'HERMES_ADVISOR',
        adapterVersion: 'hermes-disabled-stub.v1',
        status: 'DISABLED',
        attempt: 1,
        queuedAt: now,
        attemptedAt: now,
        transportEvidenceRefs: [],
        failureCode: 'HERMES_NOT_IMPLEMENTED',
      }),
    );
  }

  public async getDeliveryReceipt(notificationId: string): Promise<AdvisorGatewayReceipt | undefined> {
    assertUuidV7(notificationId, 'notificationId');
    return Promise.resolve(undefined);
  }
}
