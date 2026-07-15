import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { parseReceiveGrant } from '../../src/application/slack-pilot/contracts.js';
import { selectProfile } from '../../src/application/slack-pilot/profiles.js';
import {
  assertReceiveGrantConnectable,
  verifyStartupIdentity,
  type As1ProfileWireIdentity,
  type StartupIdentityInput,
} from '../../src/adapters/gateways/slack-pilot/exact-authority.js';
import { fakeWireWorld, validReceiveGrant, type FakeWebPort, type FakeSocketPort, type FakeWireWorld } from '../helpers/as1-slack-fakes.js';

const PROFILE = selectProfile('AGENT_OFFICE_ADVISOR');
const BEFORE_EXPIRY = '2026-07-14T22:05:00.000Z';
const STABLE_CONTROL = (): string => 'stable-control-snapshot';

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

function startupInput(
  web: FakeWebPort,
  socket: FakeSocketPort,
  wireIdentity: As1ProfileWireIdentity,
  overrides: Partial<StartupIdentityInput> = {},
): StartupIdentityInput {
  return {
    profile: PROFILE,
    wire: wireIdentity,
    grant: parseReceiveGrant(validReceiveGrant()),
    now: BEFORE_EXPIRY,
    web,
    socket,
    // Pair-verification tests use an accepting provenance gate; the REAL Git provenance gate is proven against
    // synthetic repos in tests/adapters/as1-slack-authority-provenance.test.ts. A rejecting gate below proves the
    // start consults it before any connection.
    receiveGrantProvenance: { assertAccepted: (): Promise<void> => Promise.resolve() },
    controlSnapshot: STABLE_CONTROL,
    connectReady: (): boolean => true,
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

describe('AS1 startup pair verification (pre-event boundary)', () => {
  it('accepts the correct/correct pairing and converges every App ID', async () => {
    const { world, web, socket } = fakeWireWorld();
    const proof = await verifyStartupIdentity(startupInput(web, socket, wire(world)));
    expect(proof.appId).toBe(world.agentOffice.appId);
    expect(proof.teamId).toBe(world.workspaceId);
    expect(proof.botId).toBe(world.agentOffice.botId);
    expect(socket.connectCalls).toBe(1);
    expect(socket.lastSealOk).toBe(true);
  });

  it('rejects swapped bot tokens at bots.info, before opening the Socket', async () => {
    const { world, web, socket } = fakeWireWorld();
    const error = await grabDomainError(() =>
      verifyStartupIdentity(startupInput(web, socket, wire(world, { botToken: world.foundation.botToken }))),
    );
    expect(error.code).toBe('AUTHORITY_ARTIFACT_INVALID');
    expect(socket.connectCalls).toBe(0);
  });

  it('rejects a swapped app token PRE-EVENT inside connect (hello app_id != expected)', async () => {
    const { world, web, socket } = fakeWireWorld();
    const error = await grabDomainError(() =>
      verifyStartupIdentity(startupInput(web, socket, wire(world, { appToken: world.foundation.appToken }))),
    );
    expect(error.code).toBe('AUTHORITY_ARTIFACT_INVALID');
    expect(socket.connectCalls).toBe(1); // connect was entered, but proof failed before any event
  });

  it('rejects both tokens swapped at bots.info, before opening the Socket', async () => {
    const { world, web, socket } = fakeWireWorld();
    const error = await grabDomainError(() =>
      verifyStartupIdentity(
        startupInput(web, socket, wire(world, { botToken: world.foundation.botToken, appToken: world.foundation.appToken })),
      ),
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
      verifyStartupIdentity(startupInput(web, socket, wire(world, { botToken: 'xoxb-otherws-placeholder-00001' }))),
    );
    expect(error.code).toBe('AUTHORITY_ARTIFACT_INVALID');
    expect(socket.connectCalls).toBe(0);
  });

  it('rejects a wrong hello app_id PRE-EVENT', async () => {
    const { world, web, socket } = fakeWireWorld();
    socket.register('xapp-wronghello-placeholder', 'AWRONGAPPID001');
    const error = await grabDomainError(() =>
      verifyStartupIdentity(startupInput(web, socket, wire(world, { appToken: 'xapp-wronghello-placeholder' }))),
    );
    expect(error.code).toBe('AUTHORITY_ARTIFACT_INVALID');
    expect(socket.connectCalls).toBe(1);
  });

  it('rejects a stale/changed control seal recomputed inside the hello callback', async () => {
    const { world, web, socket } = fakeWireWorld();
    let snapshot = 0;
    const changingControl = (): string => `control-snapshot-${(snapshot += 1)}`; // differs between precompute and hello
    const error = await grabDomainError(() =>
      verifyStartupIdentity(startupInput(web, socket, wire(world), { controlSnapshot: changingControl })),
    );
    expect(error.code).toBe('AUTHORITY_ARTIFACT_INVALID');
    expect(socket.lastSealOk).toBe(false);
  });

  it('rejects the pre-event seal when the control is not connect-ready (default-disabled / wrong active profile)', async () => {
    const { world, web, socket } = fakeWireWorld();
    // A fail-closed control predicate (e.g. DISABLED_DEFAULT, or a different active profile) blocks the seal.
    const error = await grabDomainError(() =>
      verifyStartupIdentity(startupInput(web, socket, wire(world), { connectReady: (): boolean => false })),
    );
    expect(error.code).toBe('AUTHORITY_ARTIFACT_INVALID');
    expect(socket.lastSealOk).toBe(false);
  });
});

describe('AS1 receive-grant pre-connection gate', () => {
  it('rejects a wrong-profile grant before any Slack call', async () => {
    const { world, web, socket } = fakeWireWorld();
    const foreign = parseReceiveGrant(validReceiveGrant({ profileId: 'FOUNDATION_ADVISOR' }));
    const error = await grabDomainError(() =>
      verifyStartupIdentity(startupInput(web, socket, wire(world), { grant: foreign })),
    );
    expect(error.code).toBe('FORBIDDEN_TARGET');
    expect(web.authTestCalls).toBe(0);
    expect(socket.connectCalls).toBe(0);
  });

  it('rejects an expired grant before any Slack call', async () => {
    const { world, web, socket } = fakeWireWorld();
    const error = await grabDomainError(() =>
      verifyStartupIdentity(startupInput(web, socket, wire(world), { now: '2026-07-14T22:20:00.000Z' })),
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

  it('a rejected receive-grant provenance blocks the start before any Slack call or Socket open (B04)', async () => {
    const { world, web, socket } = fakeWireWorld();
    const error = await grabDomainError(() =>
      verifyStartupIdentity(
        startupInput(web, socket, wire(world), {
          receiveGrantProvenance: {
            assertAccepted: (): Promise<void> =>
              Promise.reject(new DomainError('AUTHORITY_ARTIFACT_INVALID', 'receive grant Git provenance is not accepted')),
          },
        }),
      ),
    );
    expect(error.code).toBe('AUTHORITY_ARTIFACT_INVALID');
    // The provenance gate runs BEFORE auth.test and BEFORE the Socket opens — a provenance-free start is impossible.
    expect(web.authTestCalls).toBe(0);
    expect(socket.connectCalls).toBe(0);
  });
});
