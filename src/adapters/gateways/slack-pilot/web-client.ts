// AS1 Multi-Team Slack Pilot — narrow Slack Web API port and its official-SDK adapter.
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_DESIGN.md §6 (startup identity),
// §14 (outbound); docs/security/AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md §4.2, §6.3, §12. Only
// auth.test, bots.info, and chat.postMessage are representable. SDK automatic retries are disabled
// (`retryConfig.retries: 0`) and rate-limited calls reject (`rejectRateLimitedCalls: true`) so application
// code owns retry classification. Provider errors are translated into exactly the reviewed safe-retry
// classes: a proven pre-request failure (`WebAPIRequestError`) is CONNECTION_BEFORE_SEND; an explicit
// rate-limit (`WebAPIRateLimitedError`) is RATE_LIMITED with a bounded `retryAfter`; every HTTP/platform/
// unknown/ok:false outcome is AMBIGUOUS (never blind-resent). No token, response body, or WebSocket URL is
// ever logged.
import {
  WebAPIRateLimitedError,
  WebAPIRequestError,
  WebClient,
} from '@slack/web-api';

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

export type As1OutboundErrorClass = 'CONNECTION_BEFORE_SEND' | 'RATE_LIMITED' | 'AMBIGUOUS';

/** A classified outbound failure. Only CONNECTION_BEFORE_SEND and RATE_LIMITED are safe to retry. */
export class As1OutboundError extends Error {
  public constructor(
    public readonly outboundClass: As1OutboundErrorClass,
    message: string,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'As1OutboundError';
  }
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

/** Translate a thrown provider error into exactly one reviewed outbound retry class. Never leaks the body. */
export function classifyOutboundError(error: unknown): As1OutboundError {
  if (error instanceof As1OutboundError) return error;
  if (error instanceof WebAPIRateLimitedError) {
    return new As1OutboundError('RATE_LIMITED', 'provider rate limited the request', error.retryAfter * 1_000);
  }
  if (error instanceof WebAPIRequestError) {
    // The request could not be handed to the network (DNS/TLS/build) — proven definitely-unsent.
    return new As1OutboundError('CONNECTION_BEFORE_SEND', 'request failed before any bytes were sent');
  }
  // WebAPIHTTPError, WebAPIPlatformError, timeouts after write, and anything else are ambiguous.
  return new As1OutboundError('AMBIGUOUS', 'outbound outcome is ambiguous');
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
    let response;
    try {
      response = await this.client(botToken).chat.postMessage({
        channel: request.channel,
        thread_ts: request.threadTs,
        text: request.text,
        mrkdwn: false,
        reply_broadcast: false,
        unfurl_links: false,
        unfurl_media: false,
      });
    } catch (error) {
      throw classifyOutboundError(error);
    }
    if (!response.ok) {
      throw new As1OutboundError('AMBIGUOUS', 'chat.postMessage did not return ok');
    }
    return {
      ok: true,
      channel: boundedField(response.channel, 'channel'),
      ts: boundedField(response.ts, 'ts'),
    };
  }
}
