export const HTTP_ERROR_CODES = [
  'NETWORK_BOUNDARY_REJECTED',
  'HOST_REJECTED',
  'PROXY_HEADERS_REJECTED',
  'ORIGIN_REJECTED',
  'FETCH_METADATA_REJECTED',
  'CONTENT_TYPE_REJECTED',
  'BODY_TOO_LARGE',
  'REQUEST_TIMEOUT',
  'INVALID_JSON',
  'ROUTE_NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'AUTHENTICATION_REQUIRED',
  'AUTH_PROVIDER_UNAVAILABLE',
  'SESSION_INVALID_OR_EXPIRED',
  'CAPABILITY_REQUIRED',
  'CSRF_REJECTED',
  'RATE_LIMITED',
  'INVALID_ROUTE_SCHEMA',
  'APPLICATION_REJECTED',
  'SSE_LIMIT_REACHED',
] as const;

export type HttpErrorCode = (typeof HTTP_ERROR_CODES)[number];

export class HttpBoundaryError extends Error {
  public constructor(
    public readonly code: HttpErrorCode,
    public readonly status: number,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'HttpBoundaryError';
  }
}
