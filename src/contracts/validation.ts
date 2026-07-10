import { DomainError, type JsonValue, type RejectionCode } from './types.js';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function assertRecord(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new DomainError('INVALID_SCHEMA', `${label} must be an object`);
  }
}

export function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value);
  const unknown = actual.filter((key) => !expected.includes(key));
  if (unknown.length > 0) {
    throw new DomainError('UNKNOWN_FIELD', `${label} contains unknown field: ${unknown[0]}`);
  }
  const missing = expected.filter((key) => !Object.hasOwn(value, key));
  if (missing.length > 0) {
    throw new DomainError('INVALID_SCHEMA', `${label} is missing field: ${missing[0]}`);
  }
}

export function requireString(
  value: unknown,
  label: string,
  options: { readonly allowEmpty?: boolean; readonly maxLength?: number } = {},
): string {
  if (typeof value !== 'string' || (!options.allowEmpty && value.length === 0)) {
    throw new DomainError('INVALID_SCHEMA', `${label} must be a non-empty string`);
  }
  if (options.maxLength !== undefined && value.length > options.maxLength) {
    throw new DomainError('INVALID_SCHEMA', `${label} exceeds its maximum length`);
  }
  return value;
}

export function requireInteger(value: unknown, label: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new DomainError('INVALID_SCHEMA', `${label} must be an integer >= ${minimum}`);
  }
  return value as number;
}

export function requireArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new DomainError('INVALID_SCHEMA', `${label} must be an array`);
  }
  return value;
}

export function requireEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  label: string,
): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new DomainError('INVALID_SCHEMA', `${label} is not a supported value`);
  }
  return value;
}

export function assertCondition(
  condition: unknown,
  code: RejectionCode,
  message: string,
): asserts condition {
  if (!condition) {
    throw new DomainError(code, message);
  }
}

export function asJsonValue(value: unknown, label = 'value'): JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => asJsonValue(item, `${label}[${index}]`));
  }
  if (isRecord(value)) {
    const prototype = Object.getPrototypeOf(value) as unknown;
    if (prototype !== Object.prototype && prototype !== null) {
      throw new DomainError('INVALID_SCHEMA', `${label} must be a plain JSON object`);
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, asJsonValue(item, `${label}.${key}`)]),
    );
  }
  throw new DomainError('INVALID_SCHEMA', `${label} is not JSON-compatible`);
}
