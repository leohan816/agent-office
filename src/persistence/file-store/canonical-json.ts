import { DomainError, type JsonValue } from '../../contracts/types.js';
import { asJsonValue } from '../../contracts/validation.js';

function assertUnicodeScalarString(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) {
        throw new DomainError('INVALID_SCHEMA', 'canonical JSON rejects lone UTF-16 surrogates');
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new DomainError('INVALID_SCHEMA', 'canonical JSON rejects lone UTF-16 surrogates');
    }
  }
}

function serialize(value: JsonValue): string {
  if (value === null || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new DomainError('INVALID_SCHEMA', 'canonical JSON rejects non-finite numbers');
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    assertUnicodeScalarString(value);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(serialize).join(',')}]`;
  }
  const entries = Object.keys(value)
    .sort()
    .map((key) => {
      assertUnicodeScalarString(key);
      return `${JSON.stringify(key)}:${serialize(value[key] as JsonValue)}`;
    });
  return `{${entries.join(',')}}`;
}

export function canonicalize(value: unknown): string {
  return serialize(asJsonValue(value));
}

export function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(canonicalize(value), 'utf8');
}
