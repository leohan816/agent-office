import { DomainError } from '../../contracts/types.js';

const UTC_MILLISECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export function assertUtcTimestamp(value: string, label = 'timestamp'): void {
  if (!UTC_MILLISECONDS.test(value) || Number.isNaN(Date.parse(value))) {
    throw new DomainError('INVALID_SCHEMA', `${label} must be UTC RFC 3339 with milliseconds`);
  }
  if (new Date(value).toISOString() !== value) {
    throw new DomainError('INVALID_SCHEMA', `${label} is not a canonical UTC timestamp`);
  }
}

export function isUuidV7(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value);
}

export function assertUuidV7(value: string, label = 'id'): void {
  if (!isUuidV7(value)) {
    throw new DomainError('INVALID_SCHEMA', `${label} must be a lowercase UUIDv7`);
  }
}
