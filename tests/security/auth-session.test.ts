import { describe, expect, it } from 'vitest';

import {
  BrowserSessionRegistry,
  TestAuthenticationExchange,
  TestAuthenticationProvider,
  InMemoryRateLimiter,
  readSessionCookie,
  requireCapability,
  serializeClearedSessionCookie,
  serializeSessionCookie,
} from '../../src/server/index.js';
import { FIXED_TIME } from '../helpers/fixtures.js';
import { SYNTHETIC_TEST_PROOF } from '../helpers/server-fixture.js';

describe('test authentication and opaque browser sessions', () => {
  it('cannot construct the synthetic provider outside an explicit test build and runtime', () => {
    for (const options of [
      { buildMode: 'PRODUCTION', testRuntime: true },
      { buildMode: 'TEST', testRuntime: false },
    ]) {
      expect(() => new TestAuthenticationProvider({
        ...options,
        identities: [],
        now: () => FIXED_TIME,
        nextOpaque: () => 'synthetic_opaque_value_000000000000',
      })).toThrow(expect.objectContaining({ code: 'AUTH_PROVIDER_UNAVAILABLE' }));
    }
  });

  it('exchanges a one-time proof, emits host-only cookie attributes, and blocks fixation', async () => {
    const fixture = authenticationFixture();
    const session = await fixture.exchange.exchange('127.0.0.1', SYNTHETIC_TEST_PROOF);
    await expect(
      fixture.exchange.exchange('127.0.0.1', SYNTHETIC_TEST_PROOF),
    ).rejects.toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
    const cookie = serializeSessionCookie(session, Date.parse(FIXED_TIME));
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/');
    expect(cookie).not.toMatch(/Domain=|Secure/u);
    expect(readSessionCookie(`other=x; ${cookie.split(';')[0]}`)).toBe(session.cookieHandle);
    expect(readSessionCookie(`AO_SESSION=fixed; AO_SESSION=${session.cookieHandle}`)).toBeUndefined();
    expect(serializeClearedSessionCookie()).toContain('Max-Age=0');
  });

  it('rotates, expires, revokes, and capability-gates server-side sessions', async () => {
    let now = FIXED_TIME;
    let opaque = 0;
    const provider = new TestAuthenticationProvider({
      buildMode: 'TEST',
      testRuntime: true,
      identities: [{
        proof: SYNTHETIC_TEST_PROOF,
        subjectId: 'synthetic-test-subject',
        capabilities: ['viewer'],
      }],
      now: () => now,
      nextOpaque: () => `opaque_test_value_${String(opaque++).padStart(32, '0')}`,
      sessionLifetimeMs: 1000,
    });
    const sessions = new BrowserSessionRegistry(
      provider,
      () => `browser_test_value_${String(opaque++).padStart(32, '0')}`,
      () => now,
    );
    const providerSession = await provider.exchangeOneTimeProof(SYNTHETIC_TEST_PROOF);
    const session = sessions.establish(providerSession);
    expect(() => requireCapability(session, 'leo_input')).toThrow(
      expect.objectContaining({ code: 'CAPABILITY_REQUIRED' }),
    );
    const revoked: string[] = [];
    sessions.onRevoked((handle) => revoked.push(handle));
    const rotated = sessions.rotate(session.cookieHandle);
    expect(rotated.cookieHandle).not.toBe(session.cookieHandle);
    expect(rotated.csrfToken).not.toBe(session.csrfToken);
    await expect(sessions.authenticate(session.cookieHandle)).rejects.toMatchObject({
      code: 'SESSION_INVALID_OR_EXPIRED',
    });
    expect(revoked).toContain(session.cookieHandle);
    now = '2026-07-10T00:00:01.000Z';
    await expect(sessions.authenticate(rotated.cookieHandle)).rejects.toMatchObject({
      code: 'SESSION_INVALID_OR_EXPIRED',
    });
    expect(await sessions.revoke(rotated.cookieHandle)).toBe(false);
  });
});

function authenticationFixture() {
  let opaque = 0;
  const nextOpaque = (): string => `synthetic_opaque_${String(opaque++).padStart(32, '0')}`;
  const provider = new TestAuthenticationProvider({
    buildMode: 'TEST',
    testRuntime: true,
    identities: [{
      proof: SYNTHETIC_TEST_PROOF,
      subjectId: 'synthetic-test-subject',
      capabilities: ['viewer', 'leo_input'],
    }],
    now: () => FIXED_TIME,
    nextOpaque,
  });
  const sessions = new BrowserSessionRegistry(provider, nextOpaque, () => FIXED_TIME);
  return {
    provider,
    sessions,
    exchange: new TestAuthenticationExchange(
      provider,
      sessions,
      new InMemoryRateLimiter(),
      () => Date.parse(FIXED_TIME),
    ),
  };
}
