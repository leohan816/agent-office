import type { AdvisorMessagePersistenceReceipt } from '../../src/application/advisor-inbox/types.js';
import type { SubmitAdvisorMessage } from '../../src/domain/messages/index.js';
import type {
  AgentOfficeHttpApplication,
  RunningAgentOfficeHttpServer,
} from '../../src/server/index.js';
import {
  AuthenticationExchange,
  BrowserSessionRegistry,
  InMemorySecurityAuditSink,
  ProjectionSseBroker,
  TestAuthenticationExchange,
  TestAuthenticationProvider,
  startAgentOfficeHttpServer,
  type BrowserCapability,
  type BrowserSession,
} from '../../src/server/index.js';
import { FIXED_TIME, MISSION_ID, uuidV7 } from './fixtures.js';

export const SYNTHETIC_TEST_PROOF = 'synthetic-proof-for-agent-office-tests';
export const LOCAL_BOOTSTRAP_TEST_PROOF = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export interface HttpServerFixture {
  readonly server: RunningAgentOfficeHttpServer;
  readonly session: BrowserSession;
  readonly sessions: BrowserSessionRegistry;
  readonly provider: TestAuthenticationProvider;
  readonly audit: InMemorySecurityAuditSink;
  readonly sse: ProjectionSseBroker;
  readonly application: RecordingHttpApplication;
  readonly cookie: string;
  readonly mutationHeaders: Readonly<Record<string, string>>;
}

export interface BootstrapHttpServerFixture {
  readonly server: RunningAgentOfficeHttpServer;
  readonly sessions: BrowserSessionRegistry;
  readonly provider: TestAuthenticationProvider;
  readonly audit: InMemorySecurityAuditSink;
  readonly sse: ProjectionSseBroker;
  readonly application: RecordingHttpApplication;
  readonly proofs: readonly string[];
}

export class RecordingHttpApplication implements AgentOfficeHttpApplication {
  public readonly messages: SubmitAdvisorMessage[] = [];

  public constructor(private readonly localBootstrap = false) {}

  public readStatus() {
    return Promise.resolve({
      schemaVersion: 'agent-office.local-runtime-status.v1' as const,
      networkMode: 'LOOPBACK_PRIVATE' as const,
      startupState: 'MUTATION_READY' as const,
      authMode: this.localBootstrap ? 'LOCAL_BOOTSTRAP' as const : 'TEST_ONLY' as const,
      mutationMode: this.localBootstrap
        ? 'ENABLED_LOCAL_BOOTSTRAP' as const
        : 'ENABLED_TEST_ONLY' as const,
      deliveryMode: 'DISABLED' as const,
      sseMode: 'READY' as const,
      projectionRevision: 7,
      lastVerifiedAt: FIXED_TIME,
    });
  }

  public readProjection() {
    return Promise.resolve({
      schemaVersion: 'agent-office.redacted-projection.v1' as const,
      revision: 7,
      missionId: MISSION_ID,
      notificationIds: [uuidV7(901)],
      openAlertIds: [],
    });
  }

  public submitAdvisorMessage(command: SubmitAdvisorMessage): Promise<AdvisorMessagePersistenceReceipt> {
    this.messages.push(command);
    return Promise.resolve({
      requestId: command.requestId,
      messageId: uuidV7(910),
      messageArtifactRef: `artifacts/inbox/${MISSION_ID}/${command.requestId}/${'a'.repeat(64)}.json`,
      messageArtifactHash: `sha256:${'a'.repeat(64)}`,
      messagePayloadHash: `sha256:${'b'.repeat(64)}`,
      persistedEventId: uuidV7(911),
      persistedMissionSequence: 1,
      acceptedAt: FIXED_TIME,
      status: 'PERSISTED',
      replayed: false,
    });
  }

  public recordAdvisorAcknowledgement(): Promise<never> {
    return Promise.reject(new Error('acknowledgement fixture is not configured'));
  }

  public recordAdvisorIntake(): Promise<never> {
    return Promise.reject(new Error('intake fixture is not configured'));
  }

  public recordAdvisorDecision(): Promise<never> {
    return Promise.reject(new Error('decision fixture is not configured'));
  }

  public acknowledgeAlert(): Promise<never> {
    return Promise.reject(new Error('alert fixture is not configured'));
  }

  public disableDelivery(command: Parameters<AgentOfficeHttpApplication['disableDelivery']>[0]) {
    return Promise.resolve({
      requestId: command.requestId,
      status: 'DISABLED' as const,
      disabledAt: command.disabledAt,
      reasonCode: command.reasonCode,
      replayed: false,
    });
  }
}

export async function startTestHttpServer(
  capabilities: readonly BrowserCapability[] = ['viewer', 'leo_input', 'advisor_operator'],
  heartbeatMs = 50,
): Promise<HttpServerFixture> {
  let opaqueSequence = 0;
  let idSequence = 1000;
  const nextOpaque = (): string => `synthetic_opaque_${String(opaqueSequence++).padStart(32, '0')}`;
  const provider = new TestAuthenticationProvider({
    buildMode: 'TEST',
    testRuntime: true,
    identities: [{
      proof: SYNTHETIC_TEST_PROOF,
      subjectId: 'synthetic-test-subject',
      capabilities,
    }],
    now: () => FIXED_TIME,
    nextOpaque,
  });
  const sessions = new BrowserSessionRegistry(provider, nextOpaque, () => FIXED_TIME);
  const exchange = new TestAuthenticationExchange(provider, sessions, new (await import(
    '../../src/server/security/rate-limiter.js'
  )).InMemoryRateLimiter(), () => Date.parse(FIXED_TIME));
  const session = await exchange.exchange('127.0.0.1', SYNTHETIC_TEST_PROOF);
  const application = new RecordingHttpApplication();
  const audit = new InMemorySecurityAuditSink();
  const sse = new ProjectionSseBroker();
  const server = await startAgentOfficeHttpServer({
    bindAddress: '127.0.0.1',
    application,
    sessions,
    audit,
    sse,
    heartbeatMs,
    now: () => FIXED_TIME,
    nextId: () => uuidV7(idSequence++),
  });
  const cookie = `AO_SESSION=${session.cookieHandle}`;
  return {
    server,
    session,
    sessions,
    provider,
    audit,
    sse,
    application,
    cookie,
    mutationHeaders: {
      Cookie: cookie,
      Origin: server.origin,
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'cors',
      'Content-Type': 'application/json; charset=utf-8',
      'X-AO-CSRF': session.csrfToken,
    },
  };
}

export async function startBootstrapHttpServer(
  proofs: readonly string[] = [LOCAL_BOOTSTRAP_TEST_PROOF],
  heartbeatMs = 20,
): Promise<BootstrapHttpServerFixture> {
  let opaqueSequence = 0;
  let idSequence = 3000;
  const nextOpaque = (): string => `bootstrap_opaque_${String(opaqueSequence++).padStart(32, '0')}`;
  const provider = new TestAuthenticationProvider({
    buildMode: 'TEST',
    testRuntime: true,
    identities: proofs.map((proof, index) => ({
      proof,
      subjectId: `local-bootstrap-test-${index}`,
      capabilities: ['viewer', 'leo_input'],
    })),
    now: () => FIXED_TIME,
    nextOpaque,
  });
  const sessions = new BrowserSessionRegistry(provider, nextOpaque, () => FIXED_TIME);
  const limiter = new (await import(
    '../../src/server/security/rate-limiter.js'
  )).InMemoryRateLimiter();
  const bootstrapExchange = new AuthenticationExchange(
    provider,
    sessions,
    limiter,
    () => Date.parse(FIXED_TIME),
  );
  const application = new RecordingHttpApplication(true);
  const audit = new InMemorySecurityAuditSink();
  const sse = new ProjectionSseBroker();
  const server = await startAgentOfficeHttpServer({
    bindAddress: '127.0.0.1',
    application,
    sessions,
    bootstrapExchange,
    audit,
    limiter,
    sse,
    heartbeatMs,
    now: () => FIXED_TIME,
    nextId: () => uuidV7(idSequence++),
  });
  return { server, sessions, provider, audit, sse, application, proofs };
}

export function advisorMessageBody(sequence = 920): SubmitAdvisorMessage {
  return {
    requestId: uuidV7(sequence),
    missionId: MISSION_ID,
    manifestVersion: 1,
    kind: 'CLARIFICATION',
    subject: 'Synthetic bounded request',
    bodyText: 'Synthetic body with **Markdown** and <script>inert()</script>.',
    referencedEntityIds: ['AO-WU-11'],
    clientCreatedAt: FIXED_TIME,
  };
}
