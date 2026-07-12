// Agent Office Batch A — local/static organization module type contract.
//
// Authoritative design: docs/contracts/AGENT_OFFICE_BATCH_A_IDENTITY_ORGANIZATION_CONTRACT.md
// (§2.1 identity, §2.2 bindings, §2.3 process/AI-runtime facts + §2.3.1 evidence schema +
// §2.3.2 aiRuntimeState arbitration, §2.4 operationalState, §2.5 fact envelope / three sources /
// full-outer join / STALE behavior, §3 registry). This module performs NO live discovery.
//
// The provenance discriminator and the operational-work vocabulary are the exact inherited
// vocabularies (contract §2.4/§2.5) — imported, never re-declared, to avoid split-brain.
import type { ObservableProjectionName } from '../../domain/activity/index.js';
import type { PixelActorFactSource, PixelOperationalState } from '../../ui/pixel/contracts.js';

export type { ObservableProjectionName, PixelActorFactSource, PixelOperationalState };

/** Literal free-text sentinel (contract §2.1/§2.2/§2.6). */
export const ORGANIZATION_UNKNOWN = 'UNKNOWN' as const;
export type OrganizationUnknown = typeof ORGANIZATION_UNKNOWN;

// ── Fact envelope (contract §2.5) ────────────────────────────────────────────
/** Per-field envelope status. `evidenceTimestamp` is recorded evidence only — no time-only freshness inference. */
export type OrganizationFactStatus = 'VERIFIED' | 'UNVERIFIED' | 'STALE' | 'INVALID' | 'MISSING';

export interface OrganizationFact<TValue extends string = string> {
  readonly value: TValue;
  readonly source: PixelActorFactSource;
  readonly status: OrganizationFactStatus;
  readonly evidenceTimestamp: string | null;
}

// ── Identity attributes (contract §2.1) ──────────────────────────────────────
export const ORGANIZATION_ROLES = ['ADVISOR', 'WORKER', 'REVIEWER', 'CONTROL', 'DESIGNER'] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

// ── Organizational bindings (contract §2.2) ──────────────────────────────────
export const ADVISOR_TEAMS = ['FOUNDATION_ADVISOR_TEAM', 'VIBENEWS_ADVISOR_TEAM'] as const;
export type AdvisorTeam = (typeof ADVISOR_TEAMS)[number];
/** Fail-closed sentinel for advisorTeam — an actor that is UNASSIGNED cannot receive work. */
export const ADVISOR_TEAM_UNASSIGNED = 'UNASSIGNED' as const;
export type AdvisorTeamValue = AdvisorTeam | typeof ADVISOR_TEAM_UNASSIGNED;

// ── Process & AI-runtime facts (contract §2.3) ───────────────────────────────
export const SESSION_PROCESS_VALUES = [
  'SESSION_PROCESS_UNKNOWN',
  'SESSION_OFFLINE',
  'NO_AI_PROCESS',
  'AI_PROCESS_DETECTED',
] as const;
export type SessionProcess = (typeof SESSION_PROCESS_VALUES)[number];
export const SESSION_PROCESS_UNKNOWN = 'SESSION_PROCESS_UNKNOWN' as const;

export const AI_IDENTITY_UNKNOWN = 'AI_IDENTITY_UNKNOWN' as const;
export const MODEL_UNKNOWN = 'MODEL_UNKNOWN' as const;
export const EFFORT_UNKNOWN = 'EFFORT_UNKNOWN' as const;

export const AI_RUNTIME_STATES = [
  'AI_RUNTIME_UNKNOWN',
  'AI_READY',
  'AI_WORKING',
  'AI_WAITING',
  'AI_ERROR',
] as const;
export type AiRuntimeState = (typeof AI_RUNTIME_STATES)[number];
export const AI_RUNTIME_UNKNOWN = 'AI_RUNTIME_UNKNOWN' as const;

/** Owned operational-work display vocabulary (contract §2.4; = PixelOperationalState). */
export const OPERATIONAL_STATE_UNKNOWN = 'UNKNOWN' as const satisfies PixelOperationalState;

// ── (A) committed identity/organization registry (contract §2.1/§2.2/§3) ─────
/**
 * One committed registry row. Immutable per reviewed commit; stores no changing fact.
 * A row without a valid `roleInstanceId` is invalid, dropped, and reported (never a sentinel).
 * Any free-text identity/binding field that is blank/malformed normalizes to literal `UNKNOWN`;
 * an unresolvable `advisorTeam` normalizes to `UNASSIGNED`.
 */
export interface OrganizationRegistryRow {
  readonly roleInstanceId: string;
  readonly role: OrganizationRole | OrganizationUnknown;
  readonly project: string;
  readonly stableDisplayName: string;
  readonly advisorTeam: AdvisorTeamValue;
  readonly reportsToAdvisor: string;
  readonly assignedBy: string;
  readonly returnsResultTo: string;
  readonly sessionName: string;
  /** Allowed-token metadata (immutable per reviewed commit); closed value sets for §2.3 validation. */
  readonly allowedAiIdentities: readonly string[];
  readonly allowedModels: readonly string[];
  readonly allowedEfforts: readonly string[];
  /** Provenance of this committed registry row (VERIFIED_REGISTRY or CANONICAL_FIXTURE). */
  readonly provenance: PixelActorFactSource;
}

// ── (B) committed accepted-evidence records (contract §2.3.1) ────────────────
export const ACCEPTED_EVIDENCE_SCHEMA_VERSION = 'agent-office.batch-a.accepted-evidence.v1' as const;

export type AcceptedEvidenceKind =
  | 'process_offline'
  | 'process_absent'
  | 'process_detected'
  | 'ai_identity_attestation'
  | 'model_attestation'
  | 'effort_attestation'
  | 'ai_ready'
  | 'ai_error';

export interface AcceptedEvidenceRecord {
  readonly schemaVersion: typeof ACCEPTED_EVIDENCE_SCHEMA_VERSION;
  readonly evidenceId: string; // immutable stable identity; UUIDv7
  readonly evidenceRef: string; // immutable artifact reference; `sha256:<64 lowercase hex>`
  readonly kind: AcceptedEvidenceKind;
  readonly roleInstanceId: string; // join key
  readonly missionId?: string; // correlation only; never the source of mission/workUnit display
  readonly workUnitId?: string;
  readonly value?: string; // required for identity/model/effort attestations; validated vs (A) allowed-token set
  readonly provenance: PixelActorFactSource; // UPPER_SNAKE
  readonly acceptanceStatus: 'ACCEPTED' | 'REJECTED';
  readonly sourceEventIds: readonly string[]; // non-empty; each UUIDv7; correlation evidence, not identity
  readonly observedAt: string; // ISO-8601
  readonly effectiveFrom: string; // ISO-8601
  readonly optionalExpiresAt?: string; // ISO-8601
}

// ── (RT) existing authenticated runtime projection input (contract §2.3.2/§2.4/§2.5) ──
/**
 * The sole truth for `mission`/`workUnit`/activity/`operationalState`. Batch A does not
 * re-source these; `observableName` is `projectRequiredObservable(...).requiredObservableName`
 * from the existing runtime projection. `staleOrInvalid` collapses every (RT)-owned field to
 * its sentinel (contract §2.5 STALE behavior).
 */
export interface RuntimeWorkInput {
  readonly roleInstanceId: string;
  readonly mission: string | null;
  readonly workUnit: string | null;
  readonly observableName: ObservableProjectionName;
  readonly staleOrInvalid?: boolean;
  /** Provenance of the runtime-owned facts (defaults to VERIFIED_MISSION_ARTIFACT). */
  readonly provenance?: PixelActorFactSource;
}

// ── Projector input / output (contract §2.5) ─────────────────────────────────
export interface OrganizationProjectorInput {
  readonly registry: readonly OrganizationRegistryRow[]; // (A)
  readonly runtime: readonly RuntimeWorkInput[]; // (RT)
  readonly evidence: readonly AcceptedEvidenceRecord[]; // (B)
  /** ISO-8601 evaluation instant (supplied by the caller; the module never reads the clock). */
  readonly evaluatedAt: string;
}

export type OrganizationDiagnosticCode =
  | 'INVALID_REGISTRY_ROLE_INSTANCE_ID'
  | 'DUPLICATE_REGISTRY_ROLE_INSTANCE_ID'
  | 'EVIDENCE_ID_COLLISION'
  | 'SESSION_PROCESS_CONTRADICTION'
  | 'ATTESTATION_VALUE_CONFLICT'
  | 'RUNTIME_OWNED_FIELD_CONFLICT';

export interface OrganizationDiagnostic {
  readonly code: OrganizationDiagnosticCode;
  readonly roleInstanceId: string | null;
  readonly detail: string;
}

/** One fully-joined actor frame row: every changing fact as a fact envelope (contract §2.5/§2.7). */
export interface OrganizationFrameActor {
  readonly roleInstanceId: string; // stable key (never an envelope; invalid rows are dropped)
  readonly role: OrganizationFact<OrganizationRole | OrganizationUnknown>;
  readonly project: OrganizationFact;
  readonly stableDisplayName: OrganizationFact;
  readonly advisorTeam: OrganizationFact<AdvisorTeamValue>;
  readonly reportsToAdvisor: OrganizationFact;
  readonly assignedBy: OrganizationFact;
  readonly returnsResultTo: OrganizationFact;
  readonly sessionName: OrganizationFact;
  readonly sessionProcess: OrganizationFact<SessionProcess>;
  readonly aiIdentity: OrganizationFact;
  readonly model: OrganizationFact;
  readonly effort: OrganizationFact;
  readonly aiRuntimeState: OrganizationFact<AiRuntimeState>;
  readonly operationalState: OrganizationFact<PixelOperationalState>;
  readonly mission: OrganizationFact;
  readonly workUnit: OrganizationFact;
  /** Derived: false when advisorTeam resolves to UNASSIGNED (contract §2.2/§4 — cannot receive work). */
  readonly canReceiveWork: boolean;
}

export interface OrganizationFrame {
  readonly actors: readonly OrganizationFrameActor[];
  readonly diagnostics: readonly OrganizationDiagnostic[];
}
