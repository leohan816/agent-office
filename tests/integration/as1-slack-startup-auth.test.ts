import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { parseReceiveGrant } from '../../src/application/slack-pilot/contracts.js';
import { selectProfile } from '../../src/application/slack-pilot/profiles.js';
import {
  assertReceiveGrantConnectable,
  verifyStartupIdentity,
  type As1ProfileWireIdentity,
} from '../../src/adapters/gateways/slack-pilot/exact-authority.js';
import { fakeWireWorld, validReceiveGrant, type FakeWireWorld } from '../helpers/as1-slack-fakes.js';

const PROFILE = selectProfile('AGENT_OFFICE_ADVISOR');
const BEFORE_EXPIRY = '2026-07-14T22:05:00.000Z';

function wire(world: FakeWireWorld, overrides: Partial<As1ProfileWireIdentity> = {}): As1ProfileWireIdentity {
  return {
    workspaceId: world.workspaceId,
    appId: world.agentOffice.appId,
    channelId: world.agentOffice.channelId,
    leoUserId: world.agentOffice.leoUserId,
    botToken: world.agentOffice.botToken,
    appToken: world.agentOffice.appToken,
    ...overrides,
  };
}

async function grabDomainError(fn: () => Promise<unknown>): Promise<DomainError> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof DomainError) return error;
    throw error;
  }
  throw new Error('expected a DomainError but none was thrown');
}

describe('AS1 startup pair verification', () => {
  it('accepts the correct/correct pairing and converges every App ID', async () => {
    const { world, web, socket } = fakeWireWorld();
    const proof = await verifyStartupIdentity({
      profile: PROFILE,
      wire: wire(world),
      grant: parseReceiveGrant(validReceiveGrant()),
      now: BEFORE_EXPIRY,
      web,
      socket,
    });
    expect(proof.appId).toBe(world.agentOffice.appId);
    expect(proof.teamId).toBe(world.workspaceId);
    expect(proof.botId).toBe(world.agentOffice.botId);
    expect(socket.connectCalls).toBe(1);
  });

  it('rejects swapped bot tokens at bots.info, before opening the Socket', async () => {
    const { world, web, socket } = fakeWireWorld();
    const error = await grabDomainError(() =>
      verifyStartupIdentity({
        profile: PROFILE,
        wire: wire(world, { botToken: world.foundation.botToken }),
        grant: parseReceiveGrant(validReceiveGrant()),
        now: BEFORE_EXPIRY,
        web,
        socket,
      }),
    );
    expect(error.code).toBe('AUTHORITY_ARTIFACT_INVALID');
    expect(socket.connectCalls).toBe(0);
  });

  it('rejects swapped app tokens at the Socket hello', async () => {
    const { world, web, socket } = fakeWireWorld();
    const error = await grabDomainError(() =>
      verifyStartupIdentity({
        profile: PROFILE,
        wire: wire(world, { appToken: world.foundation.appToken }),
        grant: parseReceiveGrant(validReceiveGrant()),
        now: BEFORE_EXPIRY,
        web,
        socket,
      }),
    );
    expect(error.code).toBe('AUTHORITY_ARTIFACT_INVALID');
    expect(socket.connectCalls).toBe(1);
  });

  it('rejects both tokens swapped at bots.info, before opening the Socket', async () => {
    const { world, web, socket } = fakeWireWorld();
    const error = await grabDomainError(() =>
      verifyStartupIdentity({
        profile: PROFILE,
        wire: wire(world, { botToken: world.foundation.botToken, appToken: world.foundation.appToken }),
        grant: parseReceiveGrant(validReceiveGrant()),
        now: BEFORE_EXPIRY,
        web,
        socket,
      }),
    );
    expect(error.code).toBe('AUTHORITY_ARTIFACT_INVALID');
    expect(socket.connectCalls).toBe(0);
  });

  it('rejects a token from a different workspace at auth.test', async () => {
    const { world, web, socket } = fakeWireWorld();
    web.register('xoxb-otherws-placeholder-00001', {
      teamId: 'TOTHERWORKSP01',
      appId: world.agentOffice.appId,
      botId: world.agentOffice.botId,
      botUserId: world.agentOffice.botUserId,
    });
    const error = await grabDomainError(() =>
      verifyStartupIdentity({
        profile: PROFILE,
        wire: wire(world, { botToken: 'xoxb-otherws-placeholder-00001' }),
        grant: parseReceiveGrant(validReceiveGrant()),
        now: BEFORE_EXPIRY,
        web,
        socket,
      }),
    );
    expect(error.code).toBe('AUTHORITY_ARTIFACT_INVALID');
    expect(socket.connectCalls).toBe(0);
  });

  it('rejects a wrong hello app_id', async () => {
    const { world, web, socket } = fakeWireWorld();
    socket.register('xapp-wronghello-placeholder', 'AWRONGAPPID001');
    const error = await grabDomainError(() =>
      verifyStartupIdentity({
        profile: PROFILE,
        wire: wire(world, { appToken: 'xapp-wronghello-placeholder' }),
        grant: parseReceiveGrant(validReceiveGrant()),
        now: BEFORE_EXPIRY,
        web,
        socket,
      }),
    );
    expect(error.code).toBe('AUTHORITY_ARTIFACT_INVALID');
    expect(socket.connectCalls).toBe(1);
  });
});

describe('AS1 receive-grant pre-connection gate', () => {
  it('rejects a wrong-profile grant before any Slack call', async () => {
    const { world, web, socket } = fakeWireWorld();
    const foreign = parseReceiveGrant(validReceiveGrant({ profileId: 'FOUNDATION_ADVISOR' }));
    const error = await grabDomainError(() =>
      verifyStartupIdentity({ profile: PROFILE, wire: wire(world), grant: foreign, now: BEFORE_EXPIRY, web, socket }),
    );
    expect(error.code).toBe('FORBIDDEN_TARGET');
    expect(web.authTestCalls).toBe(0);
    expect(socket.connectCalls).toBe(0);
  });

  it('rejects an expired grant before any Slack call', async () => {
    const { world, web, socket } = fakeWireWorld();
    const error = await grabDomainError(() =>
      verifyStartupIdentity({
        profile: PROFILE,
        wire: wire(world),
        grant: parseReceiveGrant(validReceiveGrant()),
        now: '2026-07-14T22:20:00.000Z',
        web,
        socket,
      }),
    );
    expect(error.code).toBe('AUTHORITY_ARTIFACT_INVALID');
    expect(web.authTestCalls).toBe(0);
  });

  it('rejects a grant whose channel disagrees with the secret record', () => {
    const { world } = fakeWireWorld();
    expect(() => {
      assertReceiveGrantConnectable(
        PROFILE,
        wire(world, { channelId: 'COTHERCHANNEL1' }),
        parseReceiveGrant(validReceiveGrant()),
        BEFORE_EXPIRY,
      );
    }).toThrow(DomainError);
  });
});
