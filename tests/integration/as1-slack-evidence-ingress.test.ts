import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { parsePointerDeliveryGrant, parseReceiveGrant } from '../../src/application/slack-pilot/contracts.js';
import {
  As1ProfileInboundStore,
  type As1PilotReceiveGrantStateV1,
  type As1TmuxDeliveryFacts,
} from '../../src/application/slack-pilot/inbound-store.js';
import {
  As1EvidenceIngress,
  buildEvidenceAuthority,
  type As1AcceptedAuthorityRecords,
} from '../../src/application/slack-pilot/evidence-ingress.js';
import { selectProfile } from '../../src/application/slack-pilot/profiles.js';
import { hashCanonical } from '../../src/persistence/file-store/hashing.js';
import {
  AO_ACK_BINDINGS,
  AO_EVIDENCE_PREFIX,
  evidenceRef,
  FakeClock,
  FakeEvidenceLatch,
  FakeGitVerifier,
  validAdvisorAck,
  validAdvisorIntake,
  validAdvisorQuestion,
  validAdvisorResult,
  validPointerDeliveryGrant,
  validReceiveGrant,
} from '../helpers/as1-slack-fakes.js';
import { makeStateRoot } from '../helpers/fixtures.js';

const AUTHORITY = {
  authorityRepositoryId: 'agent-office',
  evidencePrefix: AO_EVIDENCE_PREFIX,
  intakeId: 'as1-intake-0001',
  sourceEventId: 'Ev0AGENTOFFICE01',
  pointerHash: `sha256:${'4'.repeat(64)}`,
  acceptedAck: { ...AO_ACK_BINDINGS },
  receiveGrantSourceCommit: 'a'.repeat(40),
  pointerDeliveryGrantSourceCommit: 'b'.repeat(40),
};

async function makeIngress() {
  const root = await makeStateRoot();
  const clock = new FakeClock('2026-07-14T22:06:00.000Z');
  const profile = selectProfile('AGENT_OFFICE_ADVISOR');
  const store = await As1ProfileInboundStore.open(root, profile, clock);
  const verifier = new FakeGitVerifier();
  const latch = new FakeEvidenceLatch();
  const ingress = new As1EvidenceIngress(profile, store, verifier, AUTHORITY, latch.latch);
  return { store, verifier, ingress, latch };
}

describe('AS1 evidence ingress — ordered stages', () => {
  it('accepts ACK -> INTAKE -> QUESTION -> RESULT in order', async () => {
    const { ingress } = await makeIngress();
    expect((await ingress.ingest('ACK', validAdvisorAck(), evidenceRef('ack.json'))).outcome).toBe('ACCEPTED');
    expect((await ingress.ingest('INTAKE', validAdvisorIntake(), evidenceRef('intake.json'))).outcome).toBe('ACCEPTED');
    expect((await ingress.ingest('QUESTION', validAdvisorQuestion(), evidenceRef('question.json'))).outcome).toBe(
      'ACCEPTED',
    );
    expect((await ingress.ingest('RESULT', validAdvisorResult(), evidenceRef('result.json'))).outcome).toBe('ACCEPTED');
  });

  it('quarantines an INTAKE that arrives before its ACK', async () => {
    const { ingress } = await makeIngress();
    const result = await ingress.ingest('INTAKE', validAdvisorIntake(), evidenceRef('intake.json'));
    expect(result.outcome).toBe('QUARANTINED');
    expect(result.reason).toContain('ACK');
  });

  it('quarantines a duplicate ACK', async () => {
    const { ingress } = await makeIngress();
    await ingress.ingest('ACK', validAdvisorAck(), evidenceRef('ack.json'));
    const again = await ingress.ingest('ACK', validAdvisorAck({ evidenceId: 'ev-ack-0002' }), evidenceRef('ack2.json'));
    expect(again.outcome).toBe('QUARANTINED');
  });

  it('quarantines any evidence that arrives after the final RESULT', async () => {
    const { ingress } = await makeIngress();
    await ingress.ingest('ACK', validAdvisorAck(), evidenceRef('ack.json'));
    await ingress.ingest('INTAKE', validAdvisorIntake(), evidenceRef('intake.json'));
    await ingress.ingest('RESULT', validAdvisorResult(), evidenceRef('result.json'));
    const late = await ingress.ingest('QUESTION', validAdvisorQuestion({ evidenceId: 'ev-q-late' }), evidenceRef('late.json'));
    expect(late.outcome).toBe('QUARANTINED');
    expect(late.reason).toContain('RESULT');
  });
});

describe('AS1 evidence ingress — lineage and provenance', () => {
  it('quarantines evidence naming a different profile', async () => {
    const { ingress } = await makeIngress();
    const result = await ingress.ingest('ACK', validAdvisorAck({ profileId: 'FOUNDATION_ADVISOR' }), evidenceRef('ack.json'));
    expect(result.outcome).toBe('QUARANTINED');
  });

  it('quarantines Foundation evidence that uses the historical foundation-advisor join key', async () => {
    const root = await makeStateRoot();
    const profile = selectProfile('FOUNDATION_ADVISOR');
    const store = await As1ProfileInboundStore.open(root, profile, new FakeClock('2026-07-14T22:06:00.000Z'));
    const ingress = new As1EvidenceIngress(
      profile,
      store,
      new FakeGitVerifier(),
      { ...AUTHORITY, evidencePrefix: 'advisor/jobs/20260714_as1/runtime-evidence/foundation-advisor' },
      new FakeEvidenceLatch().latch,
    );
    const foundationAck = validAdvisorAck({
      profileId: 'FOUNDATION_ADVISOR',
      advisorTeam: 'FOUNDATION_ADVISOR_TEAM',
      actorId: 'foundation-advisor',
      roleInstanceId: 'foundation-advisor', // the FORBIDDEN historical join key
    });
    const result = await ingress.ingest('ACK', foundationAck, {
      repositoryId: 'agent-office',
      sourceCommit: 'c'.repeat(40),
      path: 'advisor/jobs/20260714_as1/runtime-evidence/foundation-advisor/as1-intake-0001/ack.json',
      blobSha256: `sha256:${'5'.repeat(64)}`,
    });
    expect(result.outcome).toBe('QUARANTINED');
  });

  it('quarantines and latches on any provenance defect: non-ancestral, content mismatch, dirty, non-first, wrong-snapshot (B06)', async () => {
    for (const defect of [
      { upstreamAncestral: false },
      { contentVerified: false },
      { dirty: true },
      { firstAddition: false },
      { descendsFromBothSnapshots: false },
    ]) {
      const { ingress, verifier, latch } = await makeIngress();
      verifier.set(defect);
      const result = await ingress.ingest('ACK', validAdvisorAck(), evidenceRef('ack.json'));
      expect(result.outcome, JSON.stringify(defect)).toBe('QUARANTINED');
      expect(latch.latched, JSON.stringify(defect)).toBe(true); // every provenance defect durably latches
    }
  });

  it('quarantines and latches evidence whose repository is not the delivery-grant authority (B06)', async () => {
    const { ingress, latch } = await makeIngress();
    const result = await ingress.ingest('ACK', validAdvisorAck(), evidenceRef('ack.json', { repositoryId: 'some-other-repo' }));
    expect(result.outcome).toBe('QUARANTINED');
    expect(result.reason).toBe('EVIDENCE_WRONG_REPOSITORY');
    expect(latch.latched).toBe(true);
  });

  it('quarantines evidence whose path is outside the grant-fixed profile prefix, and latches', async () => {
    const { ingress, latch } = await makeIngress();
    const result = await ingress.ingest('ACK', validAdvisorAck(), evidenceRef('ack.json', { path: 'advisor/jobs/other/ack.json' }));
    expect(result.outcome).toBe('QUARANTINED');
    expect(result.reason).toBe('EVIDENCE_WRONG_PREFIX');
    expect(latch.latched).toBe(true);
  });

  it('a permissive (all-true) verifier can NOT approve an unrelated ref: envelope facts must bind the authority (B06)', async () => {
    // The verifier accepts everything; the ingress must still reject on the envelope↔authority correlations.
    for (const [override, code] of [
      [{ intakeId: 'as1-intake-9999' }, 'EVIDENCE_WRONG_INTAKE'],
      [{ sourceEventId: 'Ev0OTHER00001' }, 'EVIDENCE_WRONG_SOURCE_EVENT'],
      [{ pointerHash: `sha256:${'9'.repeat(64)}` }, 'EVIDENCE_WRONG_POINTER'],
    ] as const) {
      const { ingress, latch } = await makeIngress();
      const result = await ingress.ingest('ACK', validAdvisorAck(override), evidenceRef('ack.json'));
      expect(result.outcome, code).toBe('QUARANTINED');
      expect(result.reason, code).toBe(code);
      expect(latch.latched, code).toBe(true);
    }
  });

  it('the checkpoint enforces FULL duplicate equality: envelope hash + repository/path/commit/blob (B06)', async () => {
    const { store } = await makeIngress();
    const base = {
      evidenceKind: 'ACK',
      evidenceId: 'ev-ack-0001',
      intakeId: 'as1-intake-0001',
      blobSha256: `sha256:${'5'.repeat(64)}`,
      sourceCommit: 'c'.repeat(40),
      repositoryId: 'agent-office',
      path: 'advisor/jobs/20260714_as1/runtime-evidence/agent-office-advisor/as1-intake-0001/ack.json',
      envelopeHash: `sha256:${'e'.repeat(64)}`,
      correlation: { advisorAckId: 'ack-0001', sourceEventId: 'Ev0AGENTOFFICE01', pointerHash: `sha256:${'4'.repeat(64)}` },
    };
    await store.appendAcceptedEvidence(base);
    // A re-accepted id must match on EVERY field, not a partial tuple; any divergence quarantines.
    await expect(store.appendAcceptedEvidence({ ...base, sourceCommit: 'd'.repeat(40) })).rejects.toBeInstanceOf(DomainError);
    await expect(store.appendAcceptedEvidence({ ...base, envelopeHash: `sha256:${'f'.repeat(64)}` })).rejects.toBeInstanceOf(DomainError);
    await expect(store.appendAcceptedEvidence({ ...base, path: `${base.path.slice(0, -8)}other.json` })).rejects.toBeInstanceOf(DomainError);
    // The exact same envelope is idempotent (no throw, no new sequence).
    await expect(store.appendAcceptedEvidence(base)).resolves.toBeTypeOf('number');
  });

  it('re-observing the EXACT same committed ACK is idempotent ACCEPTED before stage-order (B06)', async () => {
    const { ingress } = await makeIngress();
    const first = await ingress.ingest('ACK', validAdvisorAck(), evidenceRef('ack.json'));
    expect(first.outcome).toBe('ACCEPTED');
    // A normal polling/restart re-observation of the identical evidence is idempotent, NOT a stage-order reject.
    const again = await ingress.ingest('ACK', validAdvisorAck(), evidenceRef('ack.json'));
    expect(again.outcome).toBe('ACCEPTED');
    expect(again.sequence).toBe(first.sequence);
  });

  it('a same-evidenceId ACK whose ref diverges durably latches, not idempotent (B06)', async () => {
    const { ingress, latch } = await makeIngress();
    expect((await ingress.ingest('ACK', validAdvisorAck(), evidenceRef('ack.json'))).outcome).toBe('ACCEPTED');
    const diverged = await ingress.ingest('ACK', validAdvisorAck(), evidenceRef('ack.json', { sourceCommit: 'd'.repeat(40) }));
    expect(diverged.outcome).toBe('QUARANTINED');
    expect(diverged.reason).toBe('EVIDENCE_DUPLICATE_DIVERGENCE');
    expect(latch.latched).toBe(true);
  });

  it('quarantines and latches an ACK whose §13.1 authority binding disagrees with accepted state (B06)', async () => {
    for (const override of [
      { receiveGrantBindingHash: `sha256:${'9'.repeat(64)}` },
      { pointerDeliveryGrantId: 'as1-pdg-9999' },
      { rootCorrelationHash: `sha256:${'8'.repeat(64)}` },
      { pointerArtifactRef: 'artifacts/as1-slack-pilot/agent-office-advisor/pointers/p9/pointer.json' },
      { transportJournalHash: `sha256:${'7'.repeat(64)}` },
      { consumedLeaseId: 'as1-lease-9999' },
    ]) {
      const { ingress, latch } = await makeIngress();
      const result = await ingress.ingest('ACK', validAdvisorAck(override), evidenceRef('ack.json'));
      expect(result.outcome, JSON.stringify(override)).toBe('QUARANTINED');
      expect(result.reason, JSON.stringify(override)).toContain('EVIDENCE_ACK_BINDING_');
      expect(latch.latched, JSON.stringify(override)).toBe(true);
    }
  });
});

describe('AS1 evidence ingress — cross-stage binding (not mere stage presence) (B06)', () => {
  it('quarantines and latches an INTAKE whose advisorAckId is not the exact accepted ACK', async () => {
    const { ingress, latch } = await makeIngress();
    expect((await ingress.ingest('ACK', validAdvisorAck(), evidenceRef('ack.json'))).outcome).toBe('ACCEPTED');
    // A prior ACK exists, but the INTAKE binds a DIFFERENT advisorAckId — presence is not enough.
    const bad = await ingress.ingest('INTAKE', validAdvisorIntake({ advisorAckId: 'ack-9999' }), evidenceRef('intake.json'));
    expect(bad.outcome).toBe('QUARANTINED');
    expect(bad.reason).toBe('EVIDENCE_INTAKE_ACK_MISMATCH');
    expect(latch.latched).toBe(true);
  });

  it('quarantines and latches a QUESTION that re-uses an accepted questionId with a divergent expected response', async () => {
    const { ingress, latch } = await makeIngress();
    await ingress.ingest('ACK', validAdvisorAck(), evidenceRef('ack.json'));
    await ingress.ingest('INTAKE', validAdvisorIntake(), evidenceRef('intake.json'));
    expect((await ingress.ingest('QUESTION', validAdvisorQuestion(), evidenceRef('question.json'))).outcome).toBe('ACCEPTED');
    // Same questionId, new evidenceId, different expected response — a divergent re-issue of an accepted question.
    const diverged = await ingress.ingest(
      'QUESTION',
      validAdvisorQuestion({ evidenceId: 'ev-question-0002', expectedResponseKind: 'DECISION_RESPONSE' }),
      evidenceRef('question2.json'),
    );
    expect(diverged.outcome).toBe('QUARANTINED');
    expect(diverged.reason).toBe('EVIDENCE_QUESTION_DIVERGENT');
    expect(latch.latched).toBe(true);
  });

  it('quarantines and latches a RESULT that closes an intake the Advisor rejected', async () => {
    const { ingress, latch } = await makeIngress();
    await ingress.ingest('ACK', validAdvisorAck(), evidenceRef('ack.json'));
    // A prior INTAKE exists, but it was REJECTED_BY_ADVISOR — a RESULT may not close it.
    expect(
      (await ingress.ingest('INTAKE', validAdvisorIntake({ classification: 'REJECTED_BY_ADVISOR' }), evidenceRef('intake.json'))).outcome,
    ).toBe('ACCEPTED');
    const bad = await ingress.ingest('RESULT', validAdvisorResult(), evidenceRef('result.json'));
    expect(bad.outcome).toBe('QUARANTINED');
    expect(bad.reason).toBe('EVIDENCE_RESULT_INTAKE_NOT_ACCEPTED');
    expect(latch.latched).toBe(true);
  });
});

describe('AS1 evidence authority — production derivation from typed artifacts (B06)', () => {
  const H = (c: string): string => `sha256:${c.repeat(64)}`;

  function makeRecords(): As1AcceptedAuthorityRecords {
    const receiveGrant = parseReceiveGrant(validReceiveGrant());
    // The service materialization formula: hashCanonical(rootKeyHash, bindingStateHash, sourceEventId, rootTs, intakeId).
    const rootKeyHash = H('7');
    const rootTs = '1720000000.000100';
    const rootCorrelationHash = hashCanonical({
      rootKeyHash,
      bindingStateHash: H('2'),
      sourceEventId: 'Ev0AGENTOFFICE01',
      rootTs,
      intakeId: 'as1-intake-0001',
    });
    const pointerDeliveryGrant = parsePointerDeliveryGrant(validPointerDeliveryGrant({ rootCorrelationHash }));
    const boundFacts: As1TmuxDeliveryFacts = {
      receiveGrantId: 'as1-receive-grant-0001',
      receiveGrantBindingHash: H('2'),
      pointerDeliveryGrantId: 'as1-pdg-0001',
      leaseId: 'as1-lease-0001',
      pilotId: 'as1-pilot-0001',
      profileId: 'AGENT_OFFICE_ADVISOR',
      advisorTeam: 'AGENT_OFFICE_ADVISOR_TEAM',
      actorId: 'agent-office-advisor',
      roleInstanceId: 'foundation-advisor',
      intakeId: 'as1-intake-0001',
      sourceEventId: 'Ev0AGENTOFFICE01',
      pointerHash: H('4'),
      destinationHash: H('a'),
      governanceSnapshotHash: H('b'),
      registrySnapshotHash: H('c'),
      globalControlSnapshotHash: H('f'),
      profileLatchSnapshotHash: H('1'),
      pointerDeliveryGrantSnapshotHash: hashCanonical(pointerDeliveryGrant),
    };
    const receiveGrantState: As1PilotReceiveGrantStateV1 = {
      schemaVersion: 'agent-office.as1-pilot-receive-grant-state.v1',
      receiveGrantId: 'as1-receive-grant-0001',
      pilotId: 'as1-pilot-0001',
      profileId: 'AGENT_OFFICE_ADVISOR',
      phase: 'ROOT_BOUND',
      rootLimit: 1,
      rootSlotConsumed: true,
      boundSourceEventId: 'Ev0AGENTOFFICE01',
      boundRootTs: rootTs,
      boundRootKeyHash: rootKeyHash,
      boundReceiptArtifactRef: 'indexes/as1-slack-pilot/profiles/agent-office-advisor/receipts/r1.json',
      boundReceiptArtifactHash: H('8'),
      boundMessageArtifactHash: H('9'),
      boundAt: '2026-07-14T22:05:00.000Z',
      previousStateHash: H('0'),
      stateHash: H('2'),
      version: 2,
    };
    return {
      receiveGrant,
      receiveGrantState,
      pointerDeliveryGrant,
      terminalDelivery: {
        schemaVersion: 'agent-office.as1-tmux-delivery.v1',
        deliveryId: 'as1p-0001',
        phase: 'TRANSPORT_RECORDED',
        boundFacts,
        recordedAt: '2026-07-14T22:05:30.000Z',
      },
      rootCorrelation: {
        schemaVersion: 'agent-office.as1-root-correlation.v1',
        rootTs,
        rootKeyHash,
        sourceEventId: 'Ev0AGENTOFFICE01',
        receiveGrantId: 'as1-receive-grant-0001',
        bindingStateHash: H('2'),
        intakeId: 'as1-intake-0001',
        createdAt: '2026-07-14T22:05:10.000Z',
      },
      transportJournalRef: AO_ACK_BINDINGS.transportJournalRef,
      consumption: {
        schemaVersion: 'agent-office.as1-delivery-authority-consumption.v1',
        pointerDeliveryGrantId: 'as1-pdg-0001',
        leaseId: 'as1-lease-0001',
        consumedAt: '2026-07-14T22:05:40.000Z',
      },
    };
  }

  it('derives the authority + §13.1 acceptedAck entirely from the typed accepted artifacts', () => {
    const records = makeRecords();
    const authority = buildEvidenceAuthority(records);
    expect(authority.authorityRepositoryId).toBe('agent-office');
    expect(authority.evidencePrefix).toBe(AO_EVIDENCE_PREFIX);
    expect(authority.intakeId).toBe('as1-intake-0001');
    expect(authority.sourceEventId).toBe('Ev0AGENTOFFICE01');
    expect(authority.pointerHash).toBe(H('4'));
    expect(authority.receiveGrantSourceCommit).toBe('a'.repeat(40));
    expect(authority.pointerDeliveryGrantSourceCommit).toBe('b'.repeat(40));
    // The derived acceptedAck matches the shared §13.1 fixture on every field EXCEPT the two values the factory
    // recomputes from canonical bytes: the service-formula rootCorrelationHash and the journal-record hash.
    expect(authority.acceptedAck).toEqual({
      ...AO_ACK_BINDINGS,
      rootCorrelationHash: records.pointerDeliveryGrant.rootCorrelationHash,
      transportJournalHash: hashCanonical(records.terminalDelivery),
    });
    // The recomputed rootCorrelationHash is the service formula, NOT the raw rootKeyHash.
    expect(authority.acceptedAck.rootCorrelationHash).not.toBe(records.rootCorrelation.rootKeyHash);
  });

  it('fails closed on any inconsistency between the typed artifacts', () => {
    const base = makeRecords();
    const facts = base.terminalDelivery.boundFacts;
    const cases: As1AcceptedAuthorityRecords[] = [
      // A non-terminal (not TRANSPORT_RECORDED) delivery journal.
      { ...base, terminalDelivery: { ...base.terminalDelivery, phase: 'PREPARED' } },
      // Delivery facts naming a different receive grant than the accepted grant.
      { ...base, terminalDelivery: { ...base.terminalDelivery, boundFacts: { ...facts, receiveGrantId: 'as1-receive-grant-9999' } } },
      // Delivery facts whose pointer-delivery grant snapshot hash is not the canonical grant bytes.
      { ...base, terminalDelivery: { ...base.terminalDelivery, boundFacts: { ...facts, pointerDeliveryGrantSnapshotHash: H('9') } } },
      // A pointer-delivery grant whose rootCorrelationHash is not the service-formula value (raw literal).
      { ...base, pointerDeliveryGrant: parsePointerDeliveryGrant(validPointerDeliveryGrant()) },
      // Consumption naming a different lease than the delivery facts.
      { ...base, consumption: { ...base.consumption, leaseId: 'as1-lease-9999' } },
    ];
    for (const [index, records] of cases.entries()) {
      expect(() => buildEvidenceAuthority(records), `case ${String(index)}`).toThrow(DomainError);
    }
  });
});
