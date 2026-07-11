import type { ServerResponse } from 'node:http';

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "connect-src 'self'",
  "font-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "manifest-src 'self'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "worker-src 'self'",
].join('; ');

export const PERMISSIONS_POLICY = [
  'camera=()',
  'geolocation=()',
  'microphone=()',
  'payment=()',
  'usb=()',
].join(', ');

export function applySecurityHeaders(
  response: ServerResponse,
  cachePolicy: 'NO_STORE' | 'REVALIDATE' | 'STATIC_IMMUTABLE',
): void {
  response.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader(
    'Cache-Control',
    cachePolicy === 'NO_STORE'
      ? 'no-store'
      : cachePolicy === 'REVALIDATE'
        ? 'no-cache'
        : 'public, max-age=31536000, immutable',
  );
}
