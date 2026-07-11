import { timingSafeEqual } from 'node:crypto';

import { assertUtcTimestamp } from '../../domain/time/index.js';
import { HttpBoundaryError } from '../http/errors.js';
import { InMemoryRateLimiter, RATE_LIMIT_POLICIES } from '../security/rate-limiter.js';

export const BROWSER_CAPABILITIES = ['viewer', 'leo_input', 'advisor_operator'] as const;
export type BrowserCapability = (typeof BROWSER_CAPABILITIES)[number];

export interface AuthenticatedSubject {
  readonly subjectId: string;
  readonly capabilities: readonly BrowserCapability[];
}

export interface AuthenticationSession extends AuthenticatedSubject {
  readonly sessionHandle: string;
  readonly expiresAt: string;
}

export interface AuthenticationProvider {
  beginLocalBootstrap(): Promise<{
    readonly descriptorId: string;
    readonly expiresAt: string;
    readonly testOnly: boolean;
  }>;
  exchangeOneTimeProof(proof: string): Promise<AuthenticationSession>;
  validateSession(sessionHandle: string): Promise<AuthenticationSession | undefined>;
  revokeSession(sessionHandle: string): Promise<{ readonly revoked: boolean }>;
}

export interface TestIdentityFixture extends AuthenticatedSubject {
  readonly proof: string;
}

export interface TestAuthenticationProviderOptions {
  readonly buildMode: string;
  readonly testRuntime: boolean;
  readonly identities: readonly TestIdentityFixture[];
  readonly now: () => string;
  readonly nextOpaque: () => string;
  readonly sessionLifetimeMs?: number;
}

export class TestAuthenticationProvider implements AuthenticationProvider {
  private readonly proofs = new Map<string, AuthenticatedSubject>();
  private readonly sessions = new Map<string, AuthenticationSession>();

  public constructor(private readonly options: TestAuthenticationProviderOptions) {
    if (options.buildMode !== 'TEST' || !options.testRuntime) {
      throw new HttpBoundaryError(
        'AUTH_PROVIDER_UNAVAILABLE',
        503,
        'test authentication provider is forbidden outside a test runtime',
      );
    }
    for (const identity of options.identities) {
      assertSubject(identity);
      if (identity.proof.length < 16 || this.proofs.has(identity.proof)) {
        throw new HttpBoundaryError(
          'AUTH_PROVIDER_UNAVAILABLE',
          503,
          'synthetic proof fixtures must be unique and bounded',
        );
      }
      this.proofs.set(identity.proof, {
        subjectId: identity.subjectId,
        capabilities: [...identity.capabilities],
      });
    }
  }

  public beginLocalBootstrap(): Promise<{
    readonly descriptorId: string;
    readonly expiresAt: string;
    readonly testOnly: true;
  }> {
    const now = this.now();
    return Promise.resolve({
      descriptorId: this.nextOpaque('descriptor'),
      expiresAt: new Date(Date.parse(now) + 15 * 60_000).toISOString(),
      testOnly: true,
    });
  }

  public exchangeOneTimeProof(proof: string): Promise<AuthenticationSession> {
    const subject = [...this.proofs.entries()].find(([candidate]) => safeEqual(candidate, proof));
    if (subject === undefined) {
      throw new HttpBoundaryError('AUTHENTICATION_REQUIRED', 401, 'synthetic proof is invalid');
    }
    this.proofs.delete(subject[0]);
    const now = this.now();
    const session: AuthenticationSession = {
      ...subject[1],
      sessionHandle: this.nextOpaque('provider-session'),
      expiresAt: new Date(
        Date.parse(now) + (this.options.sessionLifetimeMs ?? 15 * 60_000),
      ).toISOString(),
    };
    this.sessions.set(session.sessionHandle, session);
    return Promise.resolve(session);
  }

  public validateSession(sessionHandle: string): Promise<AuthenticationSession | undefined> {
    const session = this.sessions.get(sessionHandle);
    if (session === undefined) return Promise.resolve(undefined);
    if (Date.parse(this.now()) >= Date.parse(session.expiresAt)) {
      this.sessions.delete(sessionHandle);
      return Promise.resolve(undefined);
    }
    return Promise.resolve(session);
  }

  public revokeSession(sessionHandle: string): Promise<{ readonly revoked: boolean }> {
    return Promise.resolve({ revoked: this.sessions.delete(sessionHandle) });
  }

  private now(): string {
    const now = this.options.now();
    assertUtcTimestamp(now, 'authentication time');
    return now;
  }

  private nextOpaque(label: string): string {
    const value = this.options.nextOpaque();
    if (!/^[A-Za-z0-9_-]{24,256}$/u.test(value)) {
      throw new HttpBoundaryError(
        'AUTH_PROVIDER_UNAVAILABLE',
        503,
        `${label} source returned an invalid opaque value`,
      );
    }
    return value;
  }
}

export interface BrowserSession {
  readonly cookieHandle: string;
  readonly providerSessionHandle: string;
  readonly csrfToken: string;
  readonly subjectId: string;
  readonly capabilities: readonly BrowserCapability[];
  readonly expiresAt: string;
}

export class BrowserSessionRegistry {
  private readonly sessions = new Map<string, BrowserSession>();
  private readonly revocationListeners = new Set<(cookieHandle: string) => void>();

  public constructor(
    private readonly provider: AuthenticationProvider,
    private readonly nextOpaque: () => string,
    private readonly now: () => string,
  ) {}

  public establish(providerSession: AuthenticationSession): BrowserSession {
    const session: BrowserSession = {
      cookieHandle: this.issueOpaque(),
      providerSessionHandle: providerSession.sessionHandle,
      csrfToken: this.issueOpaque(),
      subjectId: providerSession.subjectId,
      capabilities: [...providerSession.capabilities],
      expiresAt: providerSession.expiresAt,
    };
    this.sessions.set(session.cookieHandle, session);
    return session;
  }

  public async authenticate(cookieHandle: string): Promise<BrowserSession> {
    const session = this.sessions.get(cookieHandle);
    if (session === undefined) {
      throw new HttpBoundaryError('SESSION_INVALID_OR_EXPIRED', 401, 'session is invalid or expired');
    }
    if (Date.parse(this.validNow()) >= Date.parse(session.expiresAt)) {
      await this.revoke(cookieHandle);
      throw new HttpBoundaryError('SESSION_INVALID_OR_EXPIRED', 401, 'session is invalid or expired');
    }
    const providerSession = await this.provider.validateSession(session.providerSessionHandle);
    if (providerSession === undefined) {
      await this.revoke(cookieHandle);
      throw new HttpBoundaryError('SESSION_INVALID_OR_EXPIRED', 401, 'session authority changed');
    }
    if (
      providerSession.subjectId !== session.subjectId ||
      !sameCapabilities(providerSession.capabilities, session.capabilities)
    ) {
      await this.revoke(cookieHandle);
      throw new HttpBoundaryError('SESSION_INVALID_OR_EXPIRED', 401, 'session authority changed');
    }
    return session;
  }

  public rotate(cookieHandle: string): BrowserSession {
    const current = this.sessions.get(cookieHandle);
    if (current === undefined) {
      throw new HttpBoundaryError('SESSION_INVALID_OR_EXPIRED', 401, 'session cannot be rotated');
    }
    const rotated: BrowserSession = {
      ...current,
      cookieHandle: this.issueOpaque(),
      csrfToken: this.issueOpaque(),
    };
    this.sessions.delete(cookieHandle);
    this.sessions.set(rotated.cookieHandle, rotated);
    for (const listener of this.revocationListeners) listener(cookieHandle);
    return rotated;
  }

  public async revoke(cookieHandle: string): Promise<boolean> {
    const current = this.sessions.get(cookieHandle);
    if (current === undefined) return false;
    this.sessions.delete(cookieHandle);
    await this.provider.revokeSession(current.providerSessionHandle);
    for (const listener of this.revocationListeners) listener(cookieHandle);
    return true;
  }

  public onRevoked(listener: (cookieHandle: string) => void): () => void {
    this.revocationListeners.add(listener);
    return () => this.revocationListeners.delete(listener);
  }

  private issueOpaque(): string {
    const value = this.nextOpaque();
    if (!/^[A-Za-z0-9_-]{24,256}$/u.test(value)) {
      throw new HttpBoundaryError('AUTH_PROVIDER_UNAVAILABLE', 503, 'opaque session source failed');
    }
    return value;
  }

  private validNow(): string {
    const value = this.now();
    assertUtcTimestamp(value, 'session time');
    return value;
  }
}

export class TestAuthenticationExchange {
  public constructor(
    private readonly provider: TestAuthenticationProvider,
    private readonly sessions: BrowserSessionRegistry,
    private readonly limiter: InMemoryRateLimiter,
    private readonly nowMs: () => number,
  ) {}

  public async exchange(peerAddress: string, proof: string): Promise<BrowserSession> {
    this.limiter.require(peerAddress, RATE_LIMIT_POLICIES.bootstrapExchange, this.nowMs());
    const providerSession = await this.provider.exchangeOneTimeProof(proof);
    return this.sessions.establish(providerSession);
  }
}

export const SESSION_COOKIE_NAME = 'AO_SESSION';

export function serializeSessionCookie(session: BrowserSession, nowMs: number): string {
  const maxAge = Math.max(0, Math.floor((Date.parse(session.expiresAt) - nowMs) / 1000));
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(session.cookieHandle)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function serializeClearedSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

export function readSessionCookie(header: string | undefined): string | undefined {
  if (header === undefined || header.length > 4096) return undefined;
  const matches = header
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (matches.length !== 1) return undefined;
  const encoded = matches[0]?.slice(`${SESSION_COOKIE_NAME}=`.length);
  if (encoded === undefined || encoded.length === 0) return undefined;
  try {
    const value = decodeURIComponent(encoded);
    return /^[A-Za-z0-9_-]{24,256}$/u.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function requireCapability(session: BrowserSession, capability: BrowserCapability): void {
  if (!session.capabilities.includes(capability)) {
    throw new HttpBoundaryError('CAPABILITY_REQUIRED', 403, 'required capability is absent');
  }
}

export function requireCsrf(session: BrowserSession, supplied: string | undefined): void {
  if (supplied === undefined || !safeEqual(session.csrfToken, supplied)) {
    throw new HttpBoundaryError('CSRF_REJECTED', 403, 'CSRF validation failed');
  }
}

function assertSubject(subject: AuthenticatedSubject): void {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(subject.subjectId) ||
    subject.capabilities.length === 0 ||
    subject.capabilities.some((capability) => !BROWSER_CAPABILITIES.includes(capability))
  ) {
    throw new HttpBoundaryError('AUTH_PROVIDER_UNAVAILABLE', 503, 'test identity is invalid');
  }
}

function sameCapabilities(
  left: readonly BrowserCapability[],
  right: readonly BrowserCapability[],
): boolean {
  return [...left].sort().join('\0') === [...right].sort().join('\0');
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return leftBytes.byteLength === rightBytes.byteLength && timingSafeEqual(leftBytes, rightBytes);
}
