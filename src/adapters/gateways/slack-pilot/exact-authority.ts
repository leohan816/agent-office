// AS1 Multi-Team Slack Pilot — exact startup receive-grant gate and Slack pair-identity verification.
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_DESIGN.md §6 (startup auth + pair
// verification); docs/security/AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md §6.2 (pair proof),
// §8.1 (pre-event grant), §18 (threats). No profile authenticates or opens Socket Mode on token shape
// alone. Before connection the grant must be unexpired and its exact workspace/App/channel/Leo identity
// must equal the selected static profile and external secret record. Startup then proves the credential
// pair: auth.test.team_id, bots.info.bot.app_id, and Socket hello.connection_info.app_id must all converge
// on the configured App ID. A swapped bot token fails bots.info; a swapped app token fails hello; a
// foreign-workspace token fails auth.test. Any mismatch fails the complete start before message acceptance
// — never a profile-local transient retry. Errors are redacted (no token/prefix/raw ID).
import { DomainError } from '../../../contracts/types.js';
import type { As1PilotReceiveGrantV1 } from '../../../application/slack-pilot/contracts.js';
import type { As1Profile } from '../../../application/slack-pilot/profiles.js';
import type { As1WebPort } from './web-client.js';
import type { As1SocketPort } from './socket-client.js';

/** External Slack identity for one profile, taken from the exact-key secret file. */
export interface As1ProfileWireIdentity {
  readonly workspaceId: string;
  readonly appId: string;
  readonly channelId: string;
  readonly leoUserId: string;
  readonly botToken: string;
  readonly appToken: string;
}

export interface StartupIdentityInput {
  readonly profile: As1Profile;
  readonly wire: As1ProfileWireIdentity;
  readonly grant: As1PilotReceiveGrantV1;
  readonly now: string;
  readonly web: As1WebPort;
  readonly socket: As1SocketPort;
}

/** The AUTHENTICATED_QUARANTINE proof — the client still cannot accept a message until every other gate passes. */
export interface StartupIdentityProof {
  readonly teamId: string;
  readonly botId: string;
  readonly botUserId: string;
  readonly appId: string;
  readonly channelId: string;
  readonly leoUserId: string;
}

/** Pre-connection gate: the grant must be unexpired and identity-consistent with profile + secret. */
export function assertReceiveGrantConnectable(
  profile: As1Profile,
  wire: As1ProfileWireIdentity,
  grant: As1PilotReceiveGrantV1,
  now: string,
): void {
  if (grant.profileId !== profile.profileId) {
    throw new DomainError('FORBIDDEN_TARGET', 'receive grant names a different profile than the selected one');
  }
  if (
    grant.workspaceId !== wire.workspaceId ||
    grant.appId !== wire.appId ||
    grant.channelId !== wire.channelId ||
    grant.leoUserId !== wire.leoUserId
  ) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'receive grant identity does not match the secret record');
  }
  if (!(Date.parse(now) < Date.parse(grant.expiresAt))) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'receive grant is expired at the connection gate');
  }
}

/**
 * Full startup pair verification (design §6 steps 3–6). Runs only after the pre-connection gate. Returns
 * an AUTHENTICATED_QUARANTINE proof; a live-receive decision requires further profile/state/control gates.
 */
export async function verifyStartupIdentity(input: StartupIdentityInput): Promise<StartupIdentityProof> {
  const { profile, wire, grant, now, web, socket } = input;
  assertReceiveGrantConnectable(profile, wire, grant, now);

  const auth = await web.authTest(wire.botToken);
  if (!auth.ok || auth.teamId !== wire.workspaceId) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'auth.test workspace does not match the configured workspace');
  }

  const bot = await web.botsInfo(wire.botToken, auth.botId);
  if (!bot.ok || bot.deleted || bot.botId !== auth.botId || bot.userId !== auth.userId) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'bots.info identity does not agree with auth.test');
  }
  if (bot.appId !== wire.appId) {
    // Swapped bot token: the bot resolves to a different App ID than the configured profile.
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'bots.info app_id does not match the configured App');
  }

  const hello = await socket.connect(wire.appToken);
  if (!hello.ok || hello.helloAppId !== wire.appId) {
    // Swapped app token: the Socket hello resolves to a different App ID than the configured profile.
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'socket hello app_id does not match the configured App');
  }

  return {
    teamId: auth.teamId,
    botId: auth.botId,
    botUserId: auth.userId,
    appId: wire.appId,
    channelId: wire.channelId,
    leoUserId: wire.leoUserId,
  };
}
