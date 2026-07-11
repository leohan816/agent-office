import { rm } from 'node:fs/promises';

import { afterEach, describe, expect, it } from 'vitest';

import {
  DurableAlertCenter,
  alertActionIntent,
  type AdvisorAlertDetail,
} from '../../src/application/alerts/index.js';
import {
  ALERT_KINDS,
  ALERT_POLICIES,
  alertDeduplicationKey,
  type AlertKind,
  type AlertRaisedPayload,
} from '../../src/domain/alerts/index.js';
import { ImmutableArtifactStore } from '../../src/persistence/file-store/artifact-store.js';
import { EventStore } from '../../src/persistence/file-store/event-store.js';
import { FIXED_TIME, MISSION_ID, makeStateRoot, uuidV7, verifiedEvidence } from '../helpers/fixtures.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('durable canonical alert application', () => {
  it('preserves all nine canonical kinds, severity, actions, and evidence detail', async () => {
    const fixture = await setup();
    for (const [index, kind] of ALERT_KINDS.entries()) {
      const requestId = uuidV7(2000 + index * 10);
      const payload = alertPayload(kind, requestId, fixture.store.sequence, 2001 + index * 10);
      const alert = await fixture.center.raise(payload, alertDetail(requestId), leoContext(2900 + index));
      expect(alert.payload.kind).toBe(kind);
      expect(alert.payload.severity).toBe(ALERT_POLICIES[kind].severity);
      expect(alert.payload.actionCodes).toEqual(ALERT_POLICIES[kind].actionCodes);
      expect(alert.detailArtifactRef).toMatch(/^artifacts\/alerts\//u);
    }
    expect(Object.values(fixture.center.project())).toHaveLength(9);
    await fixture.store.close();
  });

  it('deduplicates one triggering event, folds a new occurrence, and keeps acknowledgement distinct', async () => {
    const fixture = await setup();
    const requestId = uuidV7(3000);
    const firstPayload = alertPayload('NEEDS_LEO_DECISION', requestId, 0, 3001);
    const first = await fixture.center.raise(firstPayload, alertDetail(requestId), leoContext(3002));
    const sameRequest = uuidV7(3010);
    const repeated = await fixture.center.raise(
      { ...firstPayload, requestId: sameRequest, expectedStreamVersion: fixture.store.sequence },
      alertDetail(sameRequest),
      leoContext(3011),
    );
    expect(repeated.lastLifecycleEventId).toBe(first.lastLifecycleEventId);
    expect(fixture.store.sequence).toBe(1);

    const newRequest = uuidV7(3020);
    const folded = await fixture.center.raise(
      {
        ...firstPayload,
        alertId: uuidV7(3021),
        requestId: newRequest,
        sourceEventIds: [uuidV7(3022)],
        causationId: uuidV7(3023),
        correlationId: uuidV7(3024),
        expectedStreamVersion: fixture.store.sequence,
      },
      alertDetail(newRequest),
      leoContext(3025),
    );
    expect(folded.alertId).toBe(first.alertId);
    expect(folded.payload.occurrenceCount).toBe(2);

    const acknowledged = await fixture.center.acknowledge(
      {
        requestId: uuidV7(3030),
        alertId: first.alertId,
        recordedAt: FIXED_TIME,
        reasonCode: 'LEO_SAW_ALERT',
      },
      leoContext(3031),
    );
    expect(acknowledged.state).toBe('ACKNOWLEDGED');
    const snoozed = await fixture.center.snooze(
      {
        requestId: uuidV7(3040),
        alertId: first.alertId,
        recordedAt: FIXED_TIME,
        reasonCode: 'WAIT_FOR_ADVISOR',
        snoozedUntil: '2026-07-11T01:00:00.000Z',
      },
      leoContext(3041),
    );
    expect(snoozed.state).toBe('SNOOZED');
    const resolved = await fixture.center.resolve(
      {
        requestId: uuidV7(3050),
        alertId: first.alertId,
        recordedAt: FIXED_TIME,
        reasonCode: 'DECISION_RECORDED',
        evidenceRefs: ['decision:sha256:verified'],
      },
      leoContext(3051),
    );
    expect(resolved.state).toBe('RESOLVED');
    await fixture.store.close();
  });

  it('maps mission-impacting alert controls to Advisor message drafts only', () => {
    expect(alertActionIntent('REPLY_TO_ADVISOR')).toEqual({
      kind: 'ADVISOR_MESSAGE_DRAFT',
      messageKind: 'CLARIFICATION',
      mutatesMission: false,
    });
    expect(alertActionIntent('PAUSE_MISSION')).toEqual({
      kind: 'ADVISOR_MESSAGE_DRAFT',
      messageKind: 'PAUSE',
      mutatesMission: false,
    });
    expect(alertActionIntent('CANCEL_MISSION')).toEqual({
      kind: 'ADVISOR_MESSAGE_DRAFT',
      messageKind: 'CANCEL',
      mutatesMission: false,
    });
    expect(alertActionIntent('HOLD')).toEqual({ kind: 'HOLD', mutatesMission: false });
  });
});

async function setup() {
  const root = await makeStateRoot();
  roots.push(root);
  const store = await EventStore.open({
    root,
    missionId: MISSION_ID,
    manifestVersion: 1,
    writer: { buildId: 'batch-d-test', stateRootId: 'test-state-root', acquiredAt: FIXED_TIME },
  });
  const artifacts = await ImmutableArtifactStore.open(root);
  let next = 4000;
  const center = new DurableAlertCenter(
    store,
    artifacts,
    { nextId: () => uuidV7(next++), now: () => FIXED_TIME },
    MISSION_ID,
    1,
  );
  return { root, store, artifacts, center };
}

function alertPayload(
  kind: AlertKind,
  requestId: string,
  expectedStreamVersion: number,
  idBase: number,
): AlertRaisedPayload {
  const input = {
    missionId: MISSION_ID,
    kind,
    primaryEntityRef: { entityType: 'WORK_UNIT' as const, entityId: 'AO-WU-10' },
    conditionKey: `CONDITION-${kind}`,
    manifestVersion: 1,
  };
  return {
    alertId: uuidV7(idBase),
    ...input,
    severity: ALERT_POLICIES[kind].severity,
    relatedEntityRefs: [],
    titleKey: `alert.${kind}`,
    messageParameters: {},
    actionCodes: ALERT_POLICIES[kind].actionCodes,
    sourceEventIds: [uuidV7(idBase + 1)],
    evidenceRefs: [verifiedEvidence('ALERT_EVIDENCE')],
    deduplicationKey: alertDeduplicationKey(input),
    firstObservedAt: FIXED_TIME,
    lastObservedAt: FIXED_TIME,
    occurrenceCount: 1,
    resolutionCondition: 'Advisor evidence resolves this condition.',
    requestId,
    expectedStreamVersion,
    causationId: uuidV7(idBase + 2),
    correlationId: uuidV7(idBase + 3),
  };
}

function alertDetail(requestId: string): AdvisorAlertDetail {
  return {
    initiativeId: 'INITIATIVE-AGENT-OFFICE',
    packageId: 'PACKAGE-M01',
    missionId: MISSION_ID,
    requestId,
    phaseId: 'IMPLEMENTATION_D',
    workUnitId: 'AO-WU-10',
    confirmedFacts: ['The persisted event is durable.'],
    unknowns: ['Advisor decision is not yet recorded.'],
    question: 'Should the bounded work resume?',
    options: ['Resume after decision evidence', 'Remain on hold'],
    recommendation: 'Remain on hold until Advisor evidence is linked.',
    safeDefault: 'HOLD',
    blockedCapability: 'WORK_RESUME',
    blockerReason: 'MISSING_LEO_DECISION',
    resolutionOwner: 'LEO_GPT',
    nextAction: 'RETURN_DECISION_TO_ADVISOR',
    evidenceRefs: ['evidence:alert'],
  };
}

function leoContext(base: number) {
  return {
    actor: { role: 'Leo/GPT' as const, subjectId: 'leo' },
    correlationId: uuidV7(base),
    causationId: uuidV7(base + 1),
    receivedAt: FIXED_TIME,
  };
}
