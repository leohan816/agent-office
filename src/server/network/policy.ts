import type { IncomingHttpHeaders } from 'node:http';

import { isRecord } from '../../contracts/validation.js';
import { HttpBoundaryError } from '../http/errors.js';

export const LOOPBACK_BIND_ADDRESSES = ['127.0.0.1', '::1'] as const;
export type LoopbackBindAddress = (typeof LOOPBACK_BIND_ADDRESSES)[number];

export interface LoopbackNetworkPolicy {
  readonly mode: 'LOOPBACK_PRIVATE';
  readonly bindAddress: LoopbackBindAddress;
  readonly allowedHosts: readonly string[];
  readonly origin: string;
}

export interface RequestNetworkFacts {
  readonly peerAddress?: string;
  readonly host?: string;
  readonly headers: IncomingHttpHeaders;
}

export function assertLoopbackNetworkPolicy(value: LoopbackNetworkPolicy): void {
  const candidate: unknown = value;
  if (
    !isRecord(candidate) ||
    candidate.mode !== 'LOOPBACK_PRIVATE' ||
    typeof candidate.bindAddress !== 'string' ||
    !LOOPBACK_BIND_ADDRESSES.includes(candidate.bindAddress as LoopbackBindAddress)
  ) {
    throw new HttpBoundaryError(
      'NETWORK_BOUNDARY_REJECTED',
      503,
      'only explicit loopback bind addresses are supported',
    );
  }
  if (
    !Array.isArray(candidate.allowedHosts) ||
    candidate.allowedHosts.length === 0 ||
    candidate.allowedHosts.some(
      (host) => typeof host !== 'string' || !isAllowedLoopbackHost(host),
    )
  ) {
    throw new HttpBoundaryError('HOST_REJECTED', 503, 'configured Host allowlist is invalid');
  }
  if (typeof candidate.origin !== 'string') {
    throw new HttpBoundaryError('ORIGIN_REJECTED', 503, 'configured origin is invalid');
  }
  const parsed = parseLoopbackOrigin(candidate.origin);
  if (!candidate.allowedHosts.includes(parsed.host)) {
    throw new HttpBoundaryError('HOST_REJECTED', 503, 'configured origin is not in the Host allowlist');
  }
}

export function assertRequestNetworkBoundary(
  policy: LoopbackNetworkPolicy,
  facts: RequestNetworkFacts,
): void {
  assertLoopbackNetworkPolicy(policy);
  if (facts.peerAddress === undefined || !isLoopbackPeer(facts.peerAddress)) {
    throw new HttpBoundaryError('NETWORK_BOUNDARY_REJECTED', 403, 'request peer is not loopback');
  }
  if (facts.host === undefined || !policy.allowedHosts.includes(facts.host)) {
    throw new HttpBoundaryError('HOST_REJECTED', 421, 'request Host is not approved');
  }
  if (hasForwardingHeaders(facts.headers)) {
    throw new HttpBoundaryError('PROXY_HEADERS_REJECTED', 400, 'forwarding headers are forbidden');
  }
}

export function assertSameOrigin(
  policy: LoopbackNetworkPolicy,
  headers: IncomingHttpHeaders,
  options: { readonly mutation: boolean },
): void {
  const origin = singleHeader(headers.origin);
  const referer = singleHeader(headers.referer);
  if (origin !== undefined) {
    if (origin !== policy.origin) {
      throw new HttpBoundaryError('ORIGIN_REJECTED', 403, 'request Origin is not approved');
    }
  } else if (options.mutation) {
    if (!referer?.startsWith(`${policy.origin}/`)) {
      throw new HttpBoundaryError('ORIGIN_REJECTED', 403, 'same-origin evidence is required');
    }
  } else if (referer !== undefined && !referer.startsWith(`${policy.origin}/`)) {
    throw new HttpBoundaryError('ORIGIN_REJECTED', 403, 'request Referer is not approved');
  }
  if (!options.mutation) return;
  const fetchSite = singleHeader(headers['sec-fetch-site']);
  const fetchMode = singleHeader(headers['sec-fetch-mode']);
  if (
    fetchSite !== 'same-origin' ||
    (fetchMode !== 'cors' && fetchMode !== 'same-origin')
  ) {
    throw new HttpBoundaryError(
      'FETCH_METADATA_REJECTED',
      403,
      'same-origin Fetch Metadata is required',
    );
  }
}

export function isLoopbackPeer(address: string): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function isAllowedLoopbackHost(host: string): boolean {
  const match = /^(127\.0\.0\.1|\[::1\]):([1-9]\d{0,4})$/u.exec(host);
  if (match === null) return false;
  const port = Number(match[2]);
  return Number.isSafeInteger(port) && port <= 65_535;
}

function parseLoopbackOrigin(origin: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new HttpBoundaryError('ORIGIN_REJECTED', 503, 'configured origin is invalid');
  }
  if (
    parsed.protocol !== 'http:' ||
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.pathname !== '/' ||
    parsed.search.length > 0 ||
    parsed.hash.length > 0 ||
    !isAllowedLoopbackHost(parsed.host)
  ) {
    throw new HttpBoundaryError('ORIGIN_REJECTED', 503, 'configured origin is not loopback HTTP');
  }
  return parsed;
}

function hasForwardingHeaders(headers: IncomingHttpHeaders): boolean {
  return [
    'forwarded',
    'x-forwarded-for',
    'x-forwarded-host',
    'x-forwarded-proto',
    'x-real-ip',
    'cf-connecting-ip',
  ].some((name) => headers[name] !== undefined);
}

export function singleHeader(value: string | readonly string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  if (value.length !== 1) return undefined;
  return value[0];
}
