export const STORE_ERROR_CODES = [
  'SECOND_WRITER_DETECTED',
  'STATE_ROOT_INVALID',
  'PATH_CONTAINMENT_FAILED',
  'IMMUTABLE_ARTIFACT_CONFLICT',
  'MIDSTREAM_CORRUPTION',
  'INCOMPLETE_TAIL',
  'STORE_QUARANTINED',
  'IO_DURABILITY_FAILED',
] as const;

export type StoreErrorCode = (typeof STORE_ERROR_CODES)[number];

export class StoreError extends Error {
  public constructor(
    public readonly code: StoreErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'StoreError';
  }
}
