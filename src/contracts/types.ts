export type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const REJECTION_CODES = [
  'INVALID_SCHEMA',
  'UNKNOWN_FIELD',
  'UNAUTHORIZED_ACTOR',
  'FORBIDDEN_TARGET',
  'ARBITRARY_COMMAND_FORBIDDEN',
  'MISSION_NOT_FOUND',
  'MANIFEST_VERSION_CONFLICT',
  'STREAM_VERSION_CONFLICT',
  'INVALID_TRANSITION',
  'DEPENDENCY_INCOMPLETE',
  'EVIDENCE_MISSING_OR_STALE',
  'AUTHORITY_ARTIFACT_INVALID',
  'IDEMPOTENCY_KEY_REUSED',
  'STORE_QUARANTINED',
  'GATEWAY_DISABLED',
] as const;

export type RejectionCode = (typeof REJECTION_CODES)[number];

export class DomainError extends Error {
  public constructor(
    public readonly code: RejectionCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const ACTOR_ROLES = [
  'Leo/GPT',
  'Advisor',
  'Agent Office Worker',
  'Fable5 Reviewer',
  'LOCAL_OPERATOR',
] as const;

export type ActorRole = (typeof ACTOR_ROLES)[number];

export interface ActorReference {
  readonly role: ActorRole;
  readonly subjectId: string;
}

export const VERIFICATION_STATUSES = [
  'UNVERIFIED',
  'VERIFIED',
  'STALE',
  'INVALID',
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export interface EvidenceRef {
  readonly artifactId: string;
  readonly kind: string;
  readonly repository: string;
  readonly commit: string;
  readonly path: string;
  readonly sha256: string;
  readonly producerRole: ActorRole;
  readonly producedAt: string;
  readonly verifiedAt?: string;
  readonly verifier?: string;
  readonly freshnessPolicyId: string;
  readonly verificationStatus: VerificationStatus;
}

export interface EntityRef {
  readonly entityType: 'INITIATIVE' | 'PACKAGE' | 'MISSION' | 'PHASE' | 'WORK_UNIT';
  readonly entityId: string;
}

export interface SourceArtifactRef {
  readonly repository: string;
  readonly commit: string;
  readonly path: string;
  readonly sha256: string;
}
