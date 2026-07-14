// AS1 Multi-Team Slack Pilot — narrow Slack Web API port and its official-SDK adapter.
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_DESIGN.md §6 (startup identity),
// §14 (outbound); docs/security/AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md §4.2 (control-plane
// boundary), §6.3 (token handling), §12 (outbound). Only auth.test, bots.info, and chat.postMessage are
// representable. Every response is untrusted external data: it is parsed into a bounded, exact-key result
// and must agree with committed profile identity elsewhere. Tokens travel only in the Authorization header
// through the official client; SDK automatic retries are disabled so application code owns retry
// classification. No token, response body, or WebSocket URL is ever logged.
import { WebClient } from '@slack/web-api';

import { DomainError } from '../../../contracts/types.js';

export interface As1AuthTestResult {
  readonly ok: boolean;
  readonly teamId: string;
  readonly userId: string;
  readonly botId: string;
}

export interface As1BotsInfoResult {
  readonly ok: boolean;
  readonly appId: string;
  readonly botId: string;
  readonly userId: string;
  readonly deleted: boolean;
}

export interface As1PostMessageRequest {
  readonly channel: string;
  readonly threadTs: string;
  readonly text: string;
}

export interface As1PostMessageResult {
  readonly ok: boolean;
  readonly channel: string;
  readonly ts: string;
}

/** The only three Web API calls AS1 can make. No generic method or dynamic route exists. */
export interface As1WebPort {
  authTest(botToken: string): Promise<As1AuthTestResult>;
  botsInfo(botToken: string, botId: string): Promise<As1BotsInfoResult>;
  postMessage(botToken: string, request: As1PostMessageRequest): Promise<As1PostMessageResult>;
}

function boundedField(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
    throw new DomainError('INVALID_SCHEMA', `slack response ${label} is missing or not bounded`);
  }
  return value;
}

/** Official-SDK adapter. Never executed in Phase A (fakes only); present for production composition. */
export class NodeAs1WebClient implements As1WebPort {
  private client(botToken: string): WebClient {
    return new WebClient(botToken, {
      retryConfig: { retries: 0 },
      rejectRateLimitedCalls: true,
      timeout: 10_000,
    });
  }

  public async authTest(botToken: string): Promise<As1AuthTestResult> {
    const response = await this.client(botToken).auth.test();
    if (!response.ok) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'auth.test did not return ok');
    }
    return {
      ok: true,
      teamId: boundedField(response.team_id, 'team_id'),
      userId: boundedField(response.user_id, 'user_id'),
      botId: boundedField(response.bot_id, 'bot_id'),
    };
  }

  public async botsInfo(botToken: string, botId: string): Promise<As1BotsInfoResult> {
    const response = await this.client(botToken).bots.info({ bot: botId });
    const bot = response.bot;
    if (!response.ok || bot === undefined) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'bots.info did not return a bot');
    }
    return {
      ok: true,
      appId: boundedField(bot.app_id, 'app_id'),
      botId: boundedField(bot.id, 'bot.id'),
      userId: boundedField(bot.user_id, 'bot.user_id'),
      deleted: bot.deleted === true,
    };
  }

  public async postMessage(botToken: string, request: As1PostMessageRequest): Promise<As1PostMessageResult> {
    const response = await this.client(botToken).chat.postMessage({
      channel: request.channel,
      thread_ts: request.threadTs,
      text: request.text,
      mrkdwn: false,
      reply_broadcast: false,
      unfurl_links: false,
      unfurl_media: false,
    });
    if (!response.ok) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'chat.postMessage did not return ok');
    }
    return {
      ok: true,
      channel: boundedField(response.channel, 'channel'),
      ts: boundedField(response.ts, 'ts'),
    };
  }
}
