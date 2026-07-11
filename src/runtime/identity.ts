import { randomBytes } from 'node:crypto';

export interface AgentOfficeRuntimeIdentity {
  now(): string;
  nextId(): string;
}

export function createSystemRuntimeIdentity(): AgentOfficeRuntimeIdentity {
  return {
    now: () => new Date().toISOString(),
    nextId: () => uuidV7(Date.now(), randomBytes(10)),
  };
}

export function uuidV7(timestampMs: number, random: Uint8Array): string {
  if (!Number.isSafeInteger(timestampMs) || timestampMs < 0 || timestampMs > 0xffffffffffff) {
    throw new Error('UUIDv7 timestamp is invalid');
  }
  if (random.byteLength !== 10) throw new Error('UUIDv7 random source must provide 10 bytes');
  const bytes = new Uint8Array(16);
  let timestamp = BigInt(timestampMs);
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(timestamp & 0xffn);
    timestamp >>= 8n;
  }
  bytes[6] = 0x70 | ((random[0] ?? 0) & 0x0f);
  bytes[7] = random[1] ?? 0;
  bytes[8] = 0x80 | ((random[2] ?? 0) & 0x3f);
  for (let index = 9; index < 16; index += 1) bytes[index] = random[index - 6] ?? 0;
  const hex = Buffer.from(bytes).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
