// AS1 Multi-Team Slack Pilot — narrow raw Socket Mode port and its official-SDK adapter.
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_DESIGN.md §6 (startup + hello), §8
// (envelope + manual ACK order); docs/security/AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md §4.2,
// §9.1/§9.2. The adapter exposes only: connect + read hello app_id, deliver a raw envelope with a manual
// acknowledge callback, and disconnect. There is no content listener, regex router, or Bolt automatic
// handler. SDK automatic reconnect and automatic ACK are disabled so application code owns persist-before-
// ACK. Every SDK event payload is untrusted external data narrowed here from `unknown`. The ephemeral
// WebSocket URL is never logged or persisted.
import { SocketModeClient } from '@slack/socket-mode';

import { DomainError } from '../../../contracts/types.js';
import { isRecord } from '../../../contracts/validation.js';

export interface As1SocketConnectResult {
  readonly ok: boolean;
  readonly helloAppId: string;
}

export interface As1InboundEnvelope {
  readonly envelopeId: string;
  readonly payload: unknown;
  readonly retryAttempt: number | null;
  readonly retryReason: string | null;
  /** Application calls this ONLY after durable persistence (design §8.2). Never auto-acked by the SDK. */
  readonly acknowledge: () => Promise<void>;
}

export interface As1SocketPort {
  connect(appToken: string): Promise<As1SocketConnectResult>;
  onEnvelope(handler: (envelope: As1InboundEnvelope) => Promise<void>): void;
  disconnect(): Promise<void>;
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 && value.length <= 256 ? value : null;
}

/** Official-SDK adapter. Never executed in Phase A (fakes only); present for production composition. */
export class NodeAs1SocketClient implements As1SocketPort {
  private client: SocketModeClient | null = null;

  public async connect(appToken: string): Promise<As1SocketConnectResult> {
    const client = new SocketModeClient({ appToken, autoReconnectEnabled: false });
    this.client = client;
    const hello = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new DomainError('AUTHORITY_ARTIFACT_INVALID', 'socket hello was not received within the bounded window'));
      }, 10_000);
      client.on('hello', (...args: unknown[]) => {
        clearTimeout(timer);
        const appId = extractHelloAppId(args[0]);
        if (appId === null) {
          reject(new DomainError('AUTHORITY_ARTIFACT_INVALID', 'socket hello did not carry a bounded app_id'));
          return;
        }
        resolve(appId);
      });
    });
    await client.start();
    const helloAppId = await hello;
    return { ok: true, helloAppId };
  }

  public onEnvelope(handler: (envelope: As1InboundEnvelope) => Promise<void>): void {
    const client = this.client;
    if (client === null) {
      throw new DomainError('GATEWAY_DISABLED', 'socket client is not connected');
    }
    client.on('slack_event', (...args: unknown[]) => {
      const envelope = extractEnvelope(args[0]);
      if (envelope === null) return;
      void handler(envelope);
    });
  }

  public async disconnect(): Promise<void> {
    const client = this.client;
    this.client = null;
    if (client !== null) {
      await client.disconnect();
    }
  }
}

function extractHelloAppId(raw: unknown): string | null {
  if (!isRecord(raw)) return null;
  const connectionInfo = raw.connection_info;
  if (!isRecord(connectionInfo)) return null;
  return readString(connectionInfo, 'app_id');
}

function extractEnvelope(raw: unknown): As1InboundEnvelope | null {
  if (!isRecord(raw)) return null;
  const envelopeId = readString(raw, 'envelope_id');
  if (envelopeId === null) return null;
  const ack = raw.ack;
  const retryAttempt = typeof raw.retry_attempt === 'number' ? raw.retry_attempt : null;
  return {
    envelopeId,
    payload: raw.payload,
    retryAttempt,
    retryReason: readString(raw, 'retry_reason'),
    acknowledge: async (): Promise<void> => {
      if (typeof ack === 'function') {
        await (ack as () => Promise<void>)();
      }
    },
  };
}
