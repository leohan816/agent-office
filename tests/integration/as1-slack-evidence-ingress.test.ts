import { describe, expect, it } from 'vitest';

import { As1ProfileInboundStore } from '../../src/application/slack-pilot/inbound-store.js';
import { As1EvidenceIngress } from '../../src/application/slack-pilot/evidence-ingress.js';
import { selectProfile } from '../../src/application/slack-pilot/profiles.js';
import {
  AO_EVIDENCE_PREFIX,
  evidenceRef,
  FakeClock,
  FakeEvidenceLatch,
  FakeGitVerifier,
  validAdvisorAck,
  validAdvisorIntake,
  validAdvisorQuestion,
  validAdvisorResult,
} from '../helpers/as1-slack-fakes.js';
import { makeStateRoot } from '../helpers/fixtures.js';

const AUTHORITY = { authorityRepositoryId: 'agent-office', authoritySourceCommit: 'c'.repeat(40) };

async function makeIngress() {
  const root = await makeStateRoot();
  const clock = new FakeClock('2026-07-14T22:06:00.000Z');
  const profile = selectProfile('AGENT_OFFICE_ADVISOR');
  const store = await As1ProfileInboundStore.open(root, profile, clock);
  const verifier = new FakeGitVerifier();
  const latch = new FakeEvidenceLatch();
  const ingress = new As1EvidenceIngress(profile, store, verifier, AO_EVIDENCE_PREFIX, AUTHORITY, latch.latch);
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
      'advisor/jobs/20260714_as1/runtime-evidence/foundation-advisor',
      { authorityRepositoryId: 'agent-office', authoritySourceCommit: 'c'.repeat(40) },
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
    expect(result.reason).toContain('repository');
    expect(latch.latched).toBe(true);
  });

  it('quarantines evidence whose path is outside the grant-fixed profile prefix, and latches', async () => {
    const { ingress, latch } = await makeIngress();
    const result = await ingress.ingest('ACK', validAdvisorAck(), evidenceRef('ack.json', { path: 'advisor/jobs/other/ack.json' }));
    expect(result.outcome).toBe('QUARANTINED');
    expect(result.reason).toContain('prefix');
    expect(latch.latched).toBe(true);
  });
});
