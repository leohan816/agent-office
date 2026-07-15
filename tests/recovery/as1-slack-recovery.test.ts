import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { parseReceiveGrant } from '../../src/application/slack-pilot/contracts.js';
import { As1ProfileInboundStore } from '../../src/application/slack-pilot/inbound-store.js';
import { As1InboundService } from '../../src/application/slack-pilot/service.js';
import { As1SlackControl } from '../../src/operations/readiness/as1-slack-control.js';
import { controlProfileControlPort } from '../../src/runtime/as1-slack-pilot/composition.js';
import { agentOfficeContext, FakeClock, FakeProfileControlPort, slackEnvelope, validReceiveGrant } from '../helpers/as1-slack-fakes.js';
import { makeStateRoot } from '../helpers/fixtures.js';

const PROFILE = agentOfficeContext().profile;

describe('AS1 restart replay and expiry recovery', () => {
  it('resumes a pre-expiry ROOT_BOUND transition after restart without a second transition or intake', async () => {
    const root = await makeStateRoot();
    const grant = parseReceiveGrant(validReceiveGrant());
    const first = new As1InboundService(
      agentOfficeContext(),
      grant,
      await As1ProfileInboundStore.open(root, PROFILE, new FakeClock('2026-07-14T22:05:00.000Z')),
      new FakeProfileControlPort(),
    );
    const bound = await first.processEnvelope(slackEnvelope());
    expect(bound.classification).toBe('NEW_MISSION_ROOT');

    // Restart: a fresh store + service over the same durable state.
    const store2 = await As1ProfileInboundStore.open(root, PROFILE, new FakeClock('2026-07-14T22:06:00.000Z'));
    expect((await store2.readReceiveGrantState(grant.receiveGrantId))?.phase).toBe('ROOT_BOUND');
    const second = new As1InboundService(agentOfficeContext(), grant, store2, new FakeProfileControlPort());
    const secondRoot = await second.processEnvelope(
      slackEnvelope({ envelopeId: 'Env0AGENTOFFICE2', eventId: 'Ev0AGENTOFFICE02', ts: '1720000000.000200' }),
    );
    expect(secondRoot.classification).toBe('REJECTED_ROOT_SLOT_CONSUMED');
    expect(secondRoot.intakeId).toBeNull();
  });

  it('materializes ACK-recorded work exactly once and reproduces only the ACK on a post-expiry retry', async () => {
    const root = await makeStateRoot();
    const clock = new FakeClock('2026-07-14T22:05:00.000Z');
    const store = await As1ProfileInboundStore.open(root, PROFILE, clock);
    const grant = parseReceiveGrant(validReceiveGrant()); // expiresAt 22:10
    const service = new As1InboundService(agentOfficeContext(), grant, store, new FakeProfileControlPort());

    const first = await service.processEnvelope(slackEnvelope());
    expect(first.intakeId).not.toBeNull();

    clock.setIso('2026-07-14T22:15:00.000Z'); // past expiry
    const retry = await service.processEnvelope(slackEnvelope());
    expect(retry.classification).toBe('DUPLICATE');
    expect(retry.intakeId).toBeNull();

    const transport = await store.readTransport('Ev0AGENTOFFICE01');
    expect(transport?.transportAckRecorded).toBe(true);
    expect(transport?.intakeId).toBe(first.intakeId);
  });

  it('rejects a first-root transition that only linearizes after expiry, even post-restart', async () => {
    const root = await makeStateRoot();
    const grant = parseReceiveGrant(validReceiveGrant());
    const store = await As1ProfileInboundStore.open(root, PROFILE, new FakeClock('2026-07-14T22:05:00.000Z'));
    await store.initReceiveGrantState(grant);

    // Restart clock is past expiry; the transition-time comparison rejects.
    const store2 = await As1ProfileInboundStore.open(root, PROFILE, new FakeClock('2026-07-14T22:15:00.000Z'));
    const observed = await store2.persistReceipt('Ev0AGENTOFFICE01', { type: 'events_api' }, 'text');
    const bind = await store2.bindFirstRoot(grant, {
      sourceEventId: 'Ev0AGENTOFFICE01',
      rootTs: '1720000000.000100',
      rootKeyHash: `sha256:${'a'.repeat(64)}`,
      receiptArtifactRef: observed.receiptArtifactRef,
      receiptArtifactHash: observed.receiptArtifactHash,
      messageArtifactHash: observed.messageArtifactHash,
    });
    expect(bind.outcome).toBe('REJECTED_RECEIVE_GRANT_EXPIRED');
    expect(bind.state.phase).toBe('EXPIRED_UNBOUND');
  });

  it('preserves a global latch across restart and blocks receive-state transitions', async () => {
    const root = await makeStateRoot();
    const control = await As1SlackControl.open(root, new FakeClock('2026-07-14T22:05:00.000Z'));
    await control.engageGlobalKill('secret parser failure');
    await control.close();

    const restarted = await As1SlackControl.open(root, new FakeClock('2026-07-14T22:30:00.000Z'));
    expect(restarted.isGloballyLatched()).toBe(true);
    expect(restarted.getState()).toBe('DISABLED_LATCHED');
    await restarted.close();
  });
});

describe('AS1 durable profile-index corruption normalization (B08)', () => {
  // The immutable Reviewer V4 result (caf808f6, SHA256 93c4eda5) reproduced a corrupt inbound-dedupe.json surfacing
  // a raw, code-less SyntaxError, so the service's STORE_QUARANTINED-gated durable profile latch never ran. Fatal
  // UTF-8 decode / JSON parse / oversize corruption of a profile index now normalizes to STORE_QUARANTINED, which
  // drives the owning-profile latch through the real control boundary — and the latch survives restart.
  const SLUG = 'agent-office-advisor';
  const DEDUPE_REL = path.posix.join('indexes', 'as1-slack-pilot', 'profiles', SLUG, 'inbound-dedupe.json');
  const CORRUPTIONS: readonly (readonly [string, Buffer])[] = [
    ['malformed JSON', Buffer.from('{', 'utf8')],
    ['invalid UTF-8 bytes', Buffer.from([0x80, 0xff, 0xfe])],
    ['oversize beyond the 1 MiB durable bound', Buffer.from('['.padEnd(1_048_577, ' '), 'utf8')],
  ];

  for (const [label, bytes] of CORRUPTIONS) {
    it(`durably latches the owning profile when its dedupe index is ${label}, and stays latched across restart`, async () => {
      const root = await makeStateRoot();
      const control = await As1SlackControl.open(root, new FakeClock('2026-07-14T22:00:00.000Z'));
      await control.transition('DISABLED_DEFAULT', 'RECEIVE_GRANTED_ONE_PROFILE', SLUG);
      await control.transition('RECEIVE_GRANTED_ONE_PROFILE', 'AUTHENTICATING_ONE_PROFILE');
      await control.transition('AUTHENTICATING_ONE_PROFILE', 'RECEIVING_ONE_PROFILE');

      // open() creates the profile index directory; corrupt the durable dedupe index in place before any read.
      const store = await As1ProfileInboundStore.open(root, PROFILE, new FakeClock('2026-07-14T22:05:00.000Z'));
      await writeFile(path.join(root, DEDUPE_REL), bytes);
      const grant = parseReceiveGrant(validReceiveGrant());
      const service = new As1InboundService(agentOfficeContext(), grant, store, controlProfileControlPort(control, SLUG));

      // The corrupt read normalizes to STORE_QUARANTINED (not a raw SyntaxError/TypeError) and fails closed.
      let code: string | null = null;
      try {
        await service.processEnvelope(slackEnvelope());
      } catch (error) {
        code = error instanceof DomainError ? error.code : null;
      }
      expect(code).toBe('STORE_QUARANTINED');
      // The durable owning-profile latch was persisted through the real control boundary (not a fake).
      expect(await control.isProfileLatched(SLUG)).toBe(true);
      await control.close();

      // Restart: the durable profile latch persists; the profile never silently un-latches.
      const restarted = await As1SlackControl.open(root, new FakeClock('2026-07-14T22:30:00.000Z'));
      expect(await restarted.isProfileLatched(SLUG)).toBe(true);
      await restarted.close();
    });
  }
});
