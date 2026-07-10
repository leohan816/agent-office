import { createHash } from 'node:crypto';

import { canonicalBytes } from './canonical-json.js';

export const GENESIS_EVENT_HASH = `sha256:${'0'.repeat(64)}` as const;

export function sha256Bytes(bytes: Uint8Array | string): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

export function hashCanonical(value: unknown): string {
  return sha256Bytes(canonicalBytes(value));
}

export function isSha256(value: string): boolean {
  return /^sha256:[0-9a-f]{64}$/u.test(value);
}
