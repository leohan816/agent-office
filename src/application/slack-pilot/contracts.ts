// AS1 Multi-Team Slack Pilot — exact schema types/parsers, fixed limits, and redaction primitives.
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_DESIGN.md (§8 limits, §12 two-stage
// authority) and docs/security/AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md (§6.3 token handling,
// §8 authority invariants, §17 logging/redaction). Fixed numeric bounds are the Worker-handoff constants
// (16_WORKER_IMPLEMENTATION_BRIEF.md §4) that close the reviewed capacity gate. They are AS1 pilot
// constants, not configurable Slack input.
//
// Every parser narrows from `unknown`, assigns each value to an already-selected literal field, and never
// constructs a route/identity from free text. No value is ever echoed: rejection messages name only a
// field/key category and a stable reason.
import { DomainError } from '../../contracts/types.js';
import { assertExactKeys, assertRecord, requireInteger } from '../../contracts/validation.js';
import { isSha256 } from '../../persistence/file-store/hashing.js';
import { assertUtcTimestamp } from '../../domain/time/index.js';
import { assertAs1ProfileId, selectProfile, type As1ProfileId } from './profiles.js';

// ── Fixed AS1 pilot limits (brief §4) ────────────────────────────────────────
const MINUTE_MS = 60_000;
const SECOND_MS = 1_000;

export const LIMITS = {
  SECRET_FILE_MAX_BYTES: 32_768,
  RAW_SOCKET_ENVELOPE_MAX_BYTES: 32_768,
  MESSAGE_TEXT_MAX_BYTES: 16_384,
  MESSAGE_TEXT_MAX_SCALARS: 4_000,
  PROVIDER_RESPONSE_MAX_BYTES: 65_536,
  SUBPROCESS_OUTPUT_MAX_BYTES: 65_536,
  JSON_NESTING_DEPTH_MAX: 8,
  PARSED_ARRAY_MAX: 16,
  OPAQUE_ID_MAX_BYTES: 128,
  SLACK_TIMESTAMP_MAX_BYTES: 32,
  ARTIFACT_REF_MAX_BYTES: 512,
  ROOT_SLOTS_PER_GRANT: 1,
  CONVERSATIONS_PER_GRANT: 1,
  OPEN_QUESTIONS_PER_ROOT: 1,
  RECEIPT_RECORDS_PER_PROFILE: 128,
  ENVELOPE_DEDUPE_PER_PROFILE: 256,
  EVENT_DEDUPE_PER_PROFILE: 256,
  QUESTION_HISTORY_PER_PROFILE: 32,
  INTAKE_CORRELATIONS_PER_PROFILE: 32,
  POINTER_LEASE_CAPABILITY_JOURNAL_PER_PROFILE: 64,
  EVIDENCE_INGRESS_PER_PROFILE: 128,
  OUTBOX_PER_PROFILE: 128,
  DENIAL_AUDIT_PER_PROFILE: 256,
  INMEMORY_QUEUE_PER_PROFILE: 32,
  INFLIGHT_SIDE_EFFECTS_PER_PROFILE: 1,
  RETENTION_FLOOR_MS: 90 * 24 * 60 * MINUTE_MS,
  RECEIVE_GRANT_MAX_LIFETIME_MS: 15 * MINUTE_MS,
  POINTER_DELIVERY_GRANT_MAX_LIFETIME_MS: 5 * MINUTE_MS,
  READINESS_LEASE_MAX_LIFETIME_MS: 30 * SECOND_MS,
  CAPABILITY_MAX_LIFETIME_MS: 30 * SECOND_MS,
  STARTUP_IDENTITY_TIMEOUT_MS: 10 * SECOND_MS,
  SOCKET_HELLO_TIMEOUT_MS: 10 * SECOND_MS,
  WEB_REQUEST_TIMEOUT_MS: 10 * SECOND_MS,
  SUBPROCESS_TIMEOUT_MS: 10 * SECOND_MS,
  SHUTDOWN_DEADLINE_MS: 15 * SECOND_MS,
  DRAIN_DEADLINE_MS: 15 * SECOND_MS,
  OUTBOUND_MAX_ATTEMPTS: 3,
  RETRY_BACKOFF_MS: [250, 1_000] as readonly number[],
  RETRY_AFTER_MAX_MS: 5 * SECOND_MS,
} as const;

// ── Bounded value grammars (design §5.1 IDs; §6.3 token class) ────────────────
const SLACK_WORKSPACE_ID = /^T[A-Z0-9]{6,30}$/u;
const SLACK_APP_ID = /^A[A-Z0-9]{6,30}$/u;
const SLACK_CHANNEL_ID = /^[CG][A-Z0-9]{6,30}$/u;
const SLACK_USER_ID = /^[UW][A-Z0-9]{6,30}$/u;
const GIT_COMMIT = /^[0-9a-f]{40}$/u;
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const BOT_TOKEN = /^xoxb-[A-Za-z0-9-]{10,255}$/u;
const APP_TOKEN = /^xapp-[A-Za-z0-9-]{10,255}$/u;
/** Token-shaped or bearer-like material that may never reach a log/status/artifact (design §17). */
const SECRET_SHAPED = /(xox[abdeprs]-|xapp-|-----BEGIN [A-Z ]+PRIVATE KEY-----|wss:\/\/)/u;

export const SLACK_ID_GRAMMARS = {
  workspaceId: SLACK_WORKSPACE_ID,
  appId: SLACK_APP_ID,
  channelId: SLACK_CHANNEL_ID,
  userId: SLACK_USER_ID,
} as const;

/** Token-class grammars (design §6.3). Values remain opaque; these only bound the class and length. */
export const TOKEN_GRAMMARS = {
  botToken: BOT_TOKEN,
  appToken: APP_TOKEN,
} as const;

function requirePattern(value: unknown, pattern: RegExp, label: string): string {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new DomainError('INVALID_SCHEMA', `${label} does not match its required bounded grammar`);
  }
  return value;
}

/** Opaque bounded ID: printable, <= 128 UTF-8 bytes, no wildcard. */
export function requireOpaqueId(value: unknown, label: string): string {
  const asString = requirePattern(value, OPAQUE_ID, label);
  if (Buffer.byteLength(asString, 'utf8') > LIMITS.OPAQUE_ID_MAX_BYTES) {
    throw new DomainError('INVALID_SCHEMA', `${label} exceeds the opaque-id byte bound`);
  }
  return asString;
}

/** Bounded artifact/evidence ref (design §8: <= 512 UTF-8 bytes). Rejects NUL, wildcard, and traversal. */
export function requireArtifactRef(value: unknown, label: string): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    Buffer.byteLength(value, 'utf8') > LIMITS.ARTIFACT_REF_MAX_BYTES ||
    value.includes('\0') ||
    value.includes('*') ||
    value.split(/[\\/]/u).includes('..')
  ) {
    throw new DomainError('INVALID_SCHEMA', `${label} is not a bounded contained artifact ref`);
  }
  return value;
}

export function requireSha256(value: unknown, label: string): string {
  if (typeof value !== 'string' || !isSha256(value)) {
    throw new DomainError('INVALID_SCHEMA', `${label} must be a sha256:<64 hex> digest`);
  }
  return value;
}

export function requireGitCommit(value: unknown, label: string): string {
  return requirePattern(value, GIT_COMMIT, label);
}

export function requireUtc(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new DomainError('INVALID_SCHEMA', `${label} must be a UTC timestamp string`);
  }
  assertUtcTimestamp(value, label);
  return value;
}

const SLACK_TS = /^\d{1,12}\.\d{1,6}$/u;

/** Bounded Slack timestamp string (design §8: <= 32 ASCII bytes). Correlation data only. */
export function requireSlackTs(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length > LIMITS.SLACK_TIMESTAMP_MAX_BYTES || !SLACK_TS.test(value)) {
    throw new DomainError('INVALID_SCHEMA', `${label} is not a bounded Slack timestamp`);
  }
  return value;
}

/** Count Unicode scalar values (code points), not UTF-16 units. */
export function unicodeScalarCount(text: string): number {
  return Array.from(text).length;
}

/**
 * Bounded Leo message text (design §8.1): <= 16 KiB UTF-8 and <= 4,000 scalars. Content stays opaque; the
 * only structural check is bounds + rejection of C0/C1 control characters other than tab/newline (§9.5).
 */
export function requireBoundedMessageText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new DomainError('INVALID_SCHEMA', `${label} must be a non-empty string`);
  }
  if (Buffer.byteLength(value, 'utf8') > LIMITS.MESSAGE_TEXT_MAX_BYTES) {
    throw new DomainError('INVALID_SCHEMA', `${label} exceeds the message byte bound`);
  }
  if (unicodeScalarCount(value) > LIMITS.MESSAGE_TEXT_MAX_SCALARS) {
    throw new DomainError('INVALID_SCHEMA', `${label} exceeds the message scalar bound`);
  }
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if ((code < 0x20 && code !== 0x09 && code !== 0x0a) || (code >= 0x7f && code <= 0x9f)) {
      throw new DomainError('INVALID_SCHEMA', `${label} contains a forbidden control character`);
    }
  }
  return value;
}

const DEFERRED_QUERY_TOKENS = new Set(['status', 'agents', 'missions']);

/**
 * Deferred-query matcher (design §9): trims Unicode whitespace, case-folds, and rejects when the first
 * token is exactly `status`, `agents`, or `missions`, with or without a leading slash. It never executes
 * or parses the remaining text. `status`/`agents`/`missions` are NOT Slack commands and create no Mission.
 */
export function isDeferredQueryText(text: string): boolean {
  const trimmed = text.trimStart();
  const firstToken = trimmed.split(/\s/u)[0] ?? '';
  const normalized = firstToken.toLowerCase();
  const withoutSlash = normalized.startsWith('/') ? normalized.slice(1) : normalized;
  return DEFERRED_QUERY_TOKENS.has(withoutSlash);
}

function requireExactInteger(value: unknown, expected: number, label: string): number {
  const parsed = requireInteger(value, label);
  if (parsed !== expected) {
    throw new DomainError('INVALID_SCHEMA', `${label} must equal ${expected}`);
  }
  return parsed;
}

/** Exclusive expiry window strictly after issue and no longer than the reviewed maximum (design §16). */
function requireExpiryWindow(issuedAt: string, expiresAt: string, maxMs: number, label: string): void {
  const issued = Date.parse(issuedAt);
  const expires = Date.parse(expiresAt);
  if (!(expires > issued)) {
    throw new DomainError('INVALID_SCHEMA', `${label} expiry must be strictly after its issue time`);
  }
  if (expires - issued > maxMs) {
    throw new DomainError('INVALID_SCHEMA', `${label} lifetime exceeds its reviewed maximum`);
  }
}

// ── Redaction primitives (design §6.3, §17) ──────────────────────────────────
/** True when text carries token-shaped or bearer-like material that must never be emitted. */
export function containsSecretShapedValue(text: string): boolean {
  return SECRET_SHAPED.test(text);
}

/** Redact any thrown value to a stable, non-secret descriptor. Never returns provider bytes. */
export function redactError(error: unknown): { readonly kind: string; readonly code: string } {
  if (error instanceof DomainError) {
    return { kind: 'DomainError', code: error.code };
  }
  if (error instanceof Error) {
    return { kind: error.name, code: 'REDACTED' };
  }
  return { kind: 'Unknown', code: 'REDACTED' };
}

/** A provider (Slack) response/error body is never surfaced; only bounded fixed facts may be recorded. */
export function redactProviderOutcome(ok: boolean, reason: string): { readonly ok: boolean; readonly reason: string } {
  if (containsSecretShapedValue(reason)) {
    return { ok, reason: 'REDACTED' };
  }
  return { ok, reason };
}

// ── Pre-event pilot receive grant (design §12.1, security §8.1) ───────────────
const RECEIVE_GRANT_SCHEMA_VERSION = 'agent-office.as1-pilot-receive-grant.v1' as const;

const RECEIVE_GRANT_KEYS = [
  'schemaVersion',
  'receiveGrantId',
  'pilotId',
  'profileId',
  'workspaceId',
  'appId',
  'channelId',
  'leoUserId',
  'profileStateRootRef',
  'profileStateRootHash',
  'rootLimit',
  'conversationLimit',
  'governanceSnapshotHash',
  'registrySnapshotHash',
  'ownerSetupGateHash',
  'implementationReviewGateHash',
  'globalControlSnapshotHash',
  'profileLatchSnapshotHash',
  'authorityRepositoryId',
  'authorityRootId',
  'authoritySourceCommit',
  'issuedAt',
  'expiresAt',
] as const;

/**
 * Every field the pre-event receive grant may NOT carry (security §8.1). A pre-event grant that names any
 * future event/root/intake/pointer/destination/lease/capability/delivery fact is rejected before the
 * generic exact-key check so the reason is unambiguous. Includes forward-looking delivery-only fields.
 */
export const RECEIVE_GRANT_FORBIDDEN_FIELDS: readonly string[] = [
  'sourceEventId',
  'envelopeId',
  'envelope_id',
  'eventId',
  'event_id',
  'rootTs',
  'boundRootTs',
  'rootKeyHash',
  'intakeId',
  'messageArtifactRef',
  'messageArtifactHash',
  'receiptArtifactRef',
  'pointerArtifactRef',
  'pointerHash',
  'pointerDeliveryGrantId',
  'rootCorrelationHash',
  'receiveGrantBindingHash',
  'evidencePrefix',
  'readinessLeaseId',
  'leaseId',
  'capability',
  'capabilityId',
  'destination',
  'sessionName',
  'sessionId',
  'paneId',
  'paneIndex',
  'windowId',
  'tmuxSession',
  'deliveryGrant',
  'useLimit',
];

export interface As1PilotReceiveGrantV1 {
  readonly schemaVersion: typeof RECEIVE_GRANT_SCHEMA_VERSION;
  readonly receiveGrantId: string;
  readonly pilotId: string;
  readonly profileId: As1ProfileId;
  readonly workspaceId: string;
  readonly appId: string;
  readonly channelId: string;
  readonly leoUserId: string;
  readonly profileStateRootRef: string;
  readonly profileStateRootHash: string;
  readonly rootLimit: 1;
  readonly conversationLimit: 1;
  readonly governanceSnapshotHash: string;
  readonly registrySnapshotHash: string;
  readonly ownerSetupGateHash: string;
  readonly implementationReviewGateHash: string;
  readonly globalControlSnapshotHash: string;
  readonly profileLatchSnapshotHash: string;
  readonly authorityRepositoryId: string;
  readonly authorityRootId: string;
  readonly authoritySourceCommit: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

function assertNoForbiddenFields(record: Record<string, unknown>, forbidden: readonly string[], label: string): void {
  for (const key of Object.keys(record)) {
    if (forbidden.includes(key)) {
      throw new DomainError('UNKNOWN_FIELD', `${label} contains a forbidden authority field: ${key}`);
    }
  }
}

export function parseReceiveGrant(value: unknown): As1PilotReceiveGrantV1 {
  assertRecord(value, 'as1 receive grant');
  assertNoForbiddenFields(value, RECEIVE_GRANT_FORBIDDEN_FIELDS, 'as1 receive grant');
  assertExactKeys(value, RECEIVE_GRANT_KEYS, 'as1 receive grant');
  if (value.schemaVersion !== RECEIVE_GRANT_SCHEMA_VERSION) {
    throw new DomainError('INVALID_SCHEMA', 'as1 receive grant schemaVersion is unsupported');
  }
  const profileId = assertAs1ProfileId(value.profileId, 'as1 receive grant profileId');
  const issuedAt = requireUtc(value.issuedAt, 'as1 receive grant issuedAt');
  const expiresAt = requireUtc(value.expiresAt, 'as1 receive grant expiresAt');
  requireExpiryWindow(issuedAt, expiresAt, LIMITS.RECEIVE_GRANT_MAX_LIFETIME_MS, 'as1 receive grant');
  return {
    schemaVersion: RECEIVE_GRANT_SCHEMA_VERSION,
    receiveGrantId: requireOpaqueId(value.receiveGrantId, 'as1 receive grant receiveGrantId'),
    pilotId: requireOpaqueId(value.pilotId, 'as1 receive grant pilotId'),
    profileId,
    workspaceId: requirePattern(value.workspaceId, SLACK_WORKSPACE_ID, 'as1 receive grant workspaceId'),
    appId: requirePattern(value.appId, SLACK_APP_ID, 'as1 receive grant appId'),
    channelId: requirePattern(value.channelId, SLACK_CHANNEL_ID, 'as1 receive grant channelId'),
    leoUserId: requirePattern(value.leoUserId, SLACK_USER_ID, 'as1 receive grant leoUserId'),
    profileStateRootRef: requireArtifactRef(value.profileStateRootRef, 'as1 receive grant profileStateRootRef'),
    profileStateRootHash: requireSha256(value.profileStateRootHash, 'as1 receive grant profileStateRootHash'),
    rootLimit: requireExactInteger(value.rootLimit, LIMITS.ROOT_SLOTS_PER_GRANT, 'as1 receive grant rootLimit') as 1,
    conversationLimit: requireExactInteger(
      value.conversationLimit,
      LIMITS.CONVERSATIONS_PER_GRANT,
      'as1 receive grant conversationLimit',
    ) as 1,
    governanceSnapshotHash: requireSha256(value.governanceSnapshotHash, 'as1 receive grant governanceSnapshotHash'),
    registrySnapshotHash: requireSha256(value.registrySnapshotHash, 'as1 receive grant registrySnapshotHash'),
    ownerSetupGateHash: requireSha256(value.ownerSetupGateHash, 'as1 receive grant ownerSetupGateHash'),
    implementationReviewGateHash: requireSha256(
      value.implementationReviewGateHash,
      'as1 receive grant implementationReviewGateHash',
    ),
    globalControlSnapshotHash: requireSha256(
      value.globalControlSnapshotHash,
      'as1 receive grant globalControlSnapshotHash',
    ),
    profileLatchSnapshotHash: requireSha256(value.profileLatchSnapshotHash, 'as1 receive grant profileLatchSnapshotHash'),
    authorityRepositoryId: requireOpaqueId(value.authorityRepositoryId, 'as1 receive grant authorityRepositoryId'),
    authorityRootId: requireOpaqueId(value.authorityRootId, 'as1 receive grant authorityRootId'),
    authoritySourceCommit: requireGitCommit(value.authoritySourceCommit, 'as1 receive grant authoritySourceCommit'),
    issuedAt,
    expiresAt,
  };
}

// ── Post-intake pointer-delivery grant (design §12.4, security §8.3) ──────────
const POINTER_DELIVERY_GRANT_SCHEMA_VERSION = 'agent-office.as1-pointer-delivery-grant.v1' as const;

const POINTER_DELIVERY_GRANT_KEYS = [
  'schemaVersion',
  'pointerDeliveryGrantId',
  'receiveGrantId',
  'receiveGrantBindingHash',
  'pilotId',
  'profileId',
  'intakeId',
  'sourceEventId',
  'rootCorrelationHash',
  'pointerArtifactRef',
  'pointerHash',
  'advisorTeam',
  'actorId',
  'roleInstanceId',
  'evidencePrefix',
  'governanceSnapshotHash',
  'registrySnapshotHash',
  'globalControlSnapshotHash',
  'profileLatchSnapshotHash',
  'authorityRepositoryId',
  'authorityRootId',
  'authoritySourceCommit',
  'issuedAt',
  'expiresAt',
  'useLimit',
] as const;

export interface As1PointerDeliveryGrantV1 {
  readonly schemaVersion: typeof POINTER_DELIVERY_GRANT_SCHEMA_VERSION;
  readonly pointerDeliveryGrantId: string;
  readonly receiveGrantId: string;
  readonly receiveGrantBindingHash: string;
  readonly pilotId: string;
  readonly profileId: As1ProfileId;
  readonly intakeId: string;
  readonly sourceEventId: string;
  readonly rootCorrelationHash: string;
  readonly pointerArtifactRef: string;
  readonly pointerHash: string;
  readonly advisorTeam: string;
  readonly actorId: string;
  readonly roleInstanceId: string;
  readonly evidencePrefix: string;
  readonly governanceSnapshotHash: string;
  readonly registrySnapshotHash: string;
  readonly globalControlSnapshotHash: string;
  readonly profileLatchSnapshotHash: string;
  readonly authorityRepositoryId: string;
  readonly authorityRootId: string;
  readonly authoritySourceCommit: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly useLimit: 1;
}

export function parsePointerDeliveryGrant(value: unknown): As1PointerDeliveryGrantV1 {
  assertRecord(value, 'as1 pointer-delivery grant');
  assertExactKeys(value, POINTER_DELIVERY_GRANT_KEYS, 'as1 pointer-delivery grant');
  if (value.schemaVersion !== POINTER_DELIVERY_GRANT_SCHEMA_VERSION) {
    throw new DomainError('INVALID_SCHEMA', 'as1 pointer-delivery grant schemaVersion is unsupported');
  }
  const profileId = assertAs1ProfileId(value.profileId, 'as1 pointer-delivery grant profileId');
  const profile = selectProfile(profileId);
  const advisorTeam = requireOpaqueId(value.advisorTeam, 'as1 pointer-delivery grant advisorTeam');
  const actorId = requireOpaqueId(value.actorId, 'as1 pointer-delivery grant actorId');
  const roleInstanceId = requireOpaqueId(value.roleInstanceId, 'as1 pointer-delivery grant roleInstanceId');
  if (advisorTeam !== profile.advisorTeam || actorId !== profile.actorId || roleInstanceId !== profile.roleInstanceId) {
    throw new DomainError('UNAUTHORIZED_ACTOR', 'as1 pointer-delivery grant identity does not match its profile lineage');
  }
  const issuedAt = requireUtc(value.issuedAt, 'as1 pointer-delivery grant issuedAt');
  const expiresAt = requireUtc(value.expiresAt, 'as1 pointer-delivery grant expiresAt');
  requireExpiryWindow(issuedAt, expiresAt, LIMITS.POINTER_DELIVERY_GRANT_MAX_LIFETIME_MS, 'as1 pointer-delivery grant');
  return {
    schemaVersion: POINTER_DELIVERY_GRANT_SCHEMA_VERSION,
    pointerDeliveryGrantId: requireOpaqueId(value.pointerDeliveryGrantId, 'as1 pointer-delivery grant pointerDeliveryGrantId'),
    receiveGrantId: requireOpaqueId(value.receiveGrantId, 'as1 pointer-delivery grant receiveGrantId'),
    receiveGrantBindingHash: requireSha256(value.receiveGrantBindingHash, 'as1 pointer-delivery grant receiveGrantBindingHash'),
    pilotId: requireOpaqueId(value.pilotId, 'as1 pointer-delivery grant pilotId'),
    profileId,
    intakeId: requireOpaqueId(value.intakeId, 'as1 pointer-delivery grant intakeId'),
    sourceEventId: requireOpaqueId(value.sourceEventId, 'as1 pointer-delivery grant sourceEventId'),
    rootCorrelationHash: requireSha256(value.rootCorrelationHash, 'as1 pointer-delivery grant rootCorrelationHash'),
    pointerArtifactRef: requireArtifactRef(value.pointerArtifactRef, 'as1 pointer-delivery grant pointerArtifactRef'),
    pointerHash: requireSha256(value.pointerHash, 'as1 pointer-delivery grant pointerHash'),
    advisorTeam,
    actorId,
    roleInstanceId,
    evidencePrefix: requireArtifactRef(value.evidencePrefix, 'as1 pointer-delivery grant evidencePrefix'),
    governanceSnapshotHash: requireSha256(value.governanceSnapshotHash, 'as1 pointer-delivery grant governanceSnapshotHash'),
    registrySnapshotHash: requireSha256(value.registrySnapshotHash, 'as1 pointer-delivery grant registrySnapshotHash'),
    globalControlSnapshotHash: requireSha256(value.globalControlSnapshotHash, 'as1 pointer-delivery grant globalControlSnapshotHash'),
    profileLatchSnapshotHash: requireSha256(value.profileLatchSnapshotHash, 'as1 pointer-delivery grant profileLatchSnapshotHash'),
    authorityRepositoryId: requireOpaqueId(value.authorityRepositoryId, 'as1 pointer-delivery grant authorityRepositoryId'),
    authorityRootId: requireOpaqueId(value.authorityRootId, 'as1 pointer-delivery grant authorityRootId'),
    authoritySourceCommit: requireGitCommit(value.authoritySourceCommit, 'as1 pointer-delivery grant authoritySourceCommit'),
    issuedAt,
    expiresAt,
    useLimit: requireExactInteger(value.useLimit, 1, 'as1 pointer-delivery grant useLimit') as 1,
  };
}

// ── Pre-Mission intake and Advisor pointer (design §11, §12.6) ────────────────
export interface As1NewMissionIntakeV1 {
  readonly schemaVersion: 'agent-office.as1-new-mission-intake.v1';
  readonly intakeId: string;
  readonly kind: 'NEW_MISSION';
  readonly receiveGrantId: string;
  readonly receiveGrantBindingHash: string;
  readonly profileId: As1ProfileId;
  readonly advisorTeam: string;
  readonly advisorActorId: string;
  readonly advisorRoleInstanceId: string;
  readonly sourceEventId: string;
  readonly rootTs: string;
  readonly messageArtifactRef: string;
  readonly messageArtifactHash: string;
  readonly receiptArtifactRef: string;
  readonly receivedAt: string;
  readonly recordedAt: string;
  readonly authorityState: 'INTAKE_ONLY';
  readonly canonicalMissionCreated: false;
  readonly canonicalMissionRef: null;
}

export interface BuildIntakeInput {
  readonly intakeId: string;
  readonly profileId: As1ProfileId;
  readonly advisorTeam: string;
  readonly advisorActorId: string;
  readonly advisorRoleInstanceId: string;
  readonly receiveGrantId: string;
  readonly receiveGrantBindingHash: string;
  readonly sourceEventId: string;
  readonly rootTs: string;
  readonly messageArtifactRef: string;
  readonly messageArtifactHash: string;
  readonly receiptArtifactRef: string;
  readonly receivedAt: string;
  readonly recordedAt: string;
}

/** Build the immutable pre-Mission intake. It never asserts a canonical Mission (authority INTAKE_ONLY). */
export function buildNewMissionIntake(input: BuildIntakeInput): As1NewMissionIntakeV1 {
  return {
    schemaVersion: 'agent-office.as1-new-mission-intake.v1',
    intakeId: requireOpaqueId(input.intakeId, 'intake intakeId'),
    kind: 'NEW_MISSION',
    receiveGrantId: requireOpaqueId(input.receiveGrantId, 'intake receiveGrantId'),
    receiveGrantBindingHash: requireSha256(input.receiveGrantBindingHash, 'intake receiveGrantBindingHash'),
    profileId: input.profileId,
    advisorTeam: input.advisorTeam,
    advisorActorId: input.advisorActorId,
    advisorRoleInstanceId: input.advisorRoleInstanceId,
    sourceEventId: requireOpaqueId(input.sourceEventId, 'intake sourceEventId'),
    rootTs: requireSlackTs(input.rootTs, 'intake rootTs'),
    messageArtifactRef: requireArtifactRef(input.messageArtifactRef, 'intake messageArtifactRef'),
    messageArtifactHash: requireSha256(input.messageArtifactHash, 'intake messageArtifactHash'),
    receiptArtifactRef: requireArtifactRef(input.receiptArtifactRef, 'intake receiptArtifactRef'),
    receivedAt: requireUtc(input.receivedAt, 'intake receivedAt'),
    recordedAt: requireUtc(input.recordedAt, 'intake recordedAt'),
    authorityState: 'INTAKE_ONLY',
    canonicalMissionCreated: false,
    canonicalMissionRef: null,
  };
}

export interface As1AdvisorPointerV1 {
  readonly schemaVersion: 'agent-office.as1-advisor-pointer.v1';
  readonly receiveGrantId: string;
  readonly receiveGrantBindingHash: string;
  readonly pilotId: string;
  readonly profileId: As1ProfileId;
  readonly intakeId: string;
  readonly intakeKind: 'NEW_MISSION' | 'CLARIFICATION' | 'DECISION_RESPONSE';
  readonly sourceEventId: string;
  readonly rootCorrelationHash: string;
  readonly intakeArtifactRef: string;
  readonly intakeArtifactHash: string;
  readonly recordedAt: string;
}

export interface BuildPointerInput {
  readonly profileId: As1ProfileId;
  readonly pilotId: string;
  readonly receiveGrantId: string;
  readonly receiveGrantBindingHash: string;
  readonly intakeId: string;
  readonly intakeKind: 'NEW_MISSION' | 'CLARIFICATION' | 'DECISION_RESPONSE';
  readonly sourceEventId: string;
  readonly rootCorrelationHash: string;
  readonly intakeArtifactRef: string;
  readonly intakeArtifactHash: string;
  readonly recordedAt: string;
}

/** Build the immutable Advisor pointer. It carries no body and no target selector (design §12.6). */
export function buildAdvisorPointer(input: BuildPointerInput): As1AdvisorPointerV1 {
  return {
    schemaVersion: 'agent-office.as1-advisor-pointer.v1',
    receiveGrantId: requireOpaqueId(input.receiveGrantId, 'pointer receiveGrantId'),
    receiveGrantBindingHash: requireSha256(input.receiveGrantBindingHash, 'pointer receiveGrantBindingHash'),
    pilotId: requireOpaqueId(input.pilotId, 'pointer pilotId'),
    profileId: input.profileId,
    intakeId: requireOpaqueId(input.intakeId, 'pointer intakeId'),
    intakeKind: input.intakeKind,
    sourceEventId: requireOpaqueId(input.sourceEventId, 'pointer sourceEventId'),
    rootCorrelationHash: requireSha256(input.rootCorrelationHash, 'pointer rootCorrelationHash'),
    intakeArtifactRef: requireArtifactRef(input.intakeArtifactRef, 'pointer intakeArtifactRef'),
    intakeArtifactHash: requireSha256(input.intakeArtifactHash, 'pointer intakeArtifactHash'),
    recordedAt: requireUtc(input.recordedAt, 'pointer recordedAt'),
  };
}
