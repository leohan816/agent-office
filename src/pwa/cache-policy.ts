export const PWA_CACHE_VERSION = 'agent-office-shell-v1';

export const STATIC_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/agent-office.svg',
  '/icons/agent-office-maskable.svg',
] as const;

export const NEVER_CACHE_PREFIXES = [
  '/api/',
  '/health/',
  '/auth/',
  '/artifacts/',
  '/messages/',
  '/decisions/',
  '/alerts/',
] as const;

export interface CacheRequestFacts {
  readonly method: string;
  readonly requestOrigin: string;
  readonly applicationOrigin: string;
  readonly pathname: string;
  readonly destination: string;
  readonly responseCacheControl?: string;
}

export function isCacheableStaticShell(facts: CacheRequestFacts): boolean {
  if (
    facts.method !== 'GET' ||
    facts.requestOrigin !== facts.applicationOrigin ||
    NEVER_CACHE_PREFIXES.some((prefix) => facts.pathname.startsWith(prefix)) ||
    facts.responseCacheControl?.toLowerCase().includes('no-store') === true
  ) {
    return false;
  }
  if (facts.pathname === '/' || facts.pathname === '/index.html') return true;
  return ['script', 'style', 'image', 'font', 'manifest', 'worker'].includes(facts.destination);
}
