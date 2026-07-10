export const OBSERVATION_ERROR_CODES = [
  'CONFIG_INVALID',
  'PROJECT_NOT_FOUND',
  'ROOT_NOT_ALLOWED',
  'PATH_REJECTED',
  'FILE_MISSING',
  'FILE_NOT_REGULAR',
  'SYMLINK_REJECTED',
  'SIZE_LIMIT_EXCEEDED',
  'HASH_MISMATCH',
  'SOURCE_DIRTY',
  'SOURCE_STALE',
  'TOOL_TIMEOUT',
  'OUTPUT_LIMIT_EXCEEDED',
  'TOOL_FAILED',
  'STRUCTURED_OUTPUT_INVALID',
  'IDENTITY_MISMATCH',
  'UNVERIFIED',
  'CONFLICT',
] as const;

export type ObservationErrorCode = (typeof OBSERVATION_ERROR_CODES)[number];

export class ObservationError extends Error {
  public constructor(
    public readonly code: ObservationErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ObservationError';
  }
}

export function observationErrorCode(error: unknown): ObservationErrorCode | undefined {
  return error instanceof ObservationError ? error.code : undefined;
}
