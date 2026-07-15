# Agent Office Protocol Readiness and Execution Profile Contract

Status: `DESIGN_CANDIDATE__PENDING_INDEPENDENT_REVIEW`

Mission: `AGENT_OFFICE_TEAM_ONBOARDING_AND_EXECUTION_PROFILE_POLICY_001`

Contract version: `agent-office.team-onboarding-execution-profile.v1`

## 1. Contract purpose and authorities

This contract defines the exact structured inputs, immutable evidence, pure
projections, fail-closed diagnostics, and twelve Founder scenario outcomes for:

- role-specific protocol onboarding and targeted reload;
- `PROTOCOL_READY` evidence joined to the one Organization Registry by
  `roleInstanceId`;
- deterministic `TEAM_READY` aggregation; and
- responsible-Advisor-only execution profile selection.

It extends, and does not replace, the current identity/organization contract.
Registry identity and routing remain authoritative in
`src/application/organization/{types,registry}.ts`. Existing runtime observation
remains evidence of a current run, not an Actor capability catalog.

All object schemas below are exact: unknown keys, missing keys, invalid values,
or duplicate set members reject the entire record unless an explicit rule says
otherwise. No record is derived from terminal prose, a session name, wall-clock
age, model-name parsing, proximity, or a current process observation.

## 2. Common validation primitives

```ts
type Sha256Ref = `sha256:${string}`; // exactly 64 lowercase hex after prefix
type GitCommit = string;            // exactly 40 lowercase hex
type UuidV7 = string;               // existing repository UUIDv7 validator

interface RepositoryFileReadV1 {
  readonly repositoryId: string;
  readonly commit: GitCommit;
  readonly path: string;
  readonly sha256: Sha256Ref;
}
```

`repositoryId` is a nonblank closed identifier supplied by the Advisor handoff,
not a URL. `path` is an exact repository-relative POSIX path: nonblank, NFC,
no leading slash, no backslash, no empty/`.`/`..` segment, no NUL, and no
percent-decoding. Arrays of file reads are unique by
`repositoryId + commit + path`, sorted bytewise by that tuple, and compared by
exact set equality including hash. Thus `FILES_READ` is an auditable list of
exact normalized paths, never a boolean.

Timestamps are canonical UTC and provide ordering/provenance only. They never
make evidence current by age. Currentness is decided from the explicit
canonical commit/version and Actor-contract inputs in §7.

## 3. Static registry capability and lifecycle contract

Add the following closed vocabularies and per-row data to the existing
Organization Registry type authority:

```ts
type ActorRegistrationState =
  | 'PENDING_ONBOARDING'
  | 'ACTIVE'
  | 'SUSPENDED';

type TaskComplexity = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
type RiskLevel = 'LEVEL_0' | 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4';
type FailureCost = 'LOW' | 'MEDIUM' | 'HIGH' | 'CATASTROPHIC';
type Reversibility = 'EASY' | 'BOUNDED' | 'DIFFICULT' | 'IRREVERSIBLE';
type ContextRequirement = 'SMALL' | 'MEDIUM' | 'LARGE' | 'XLARGE';

interface ActorExecutionCapabilityV1 {
  readonly schemaVersion: 'agent-office.actor-execution-capability.v1';
  readonly profileId: string;
  readonly capabilityRank: number;
  readonly model: string;
  readonly mode: string;
  readonly effort: string;
  readonly skills: readonly string[];
  readonly maximumTaskComplexity: TaskComplexity;
  readonly maximumRiskLevel: RiskLevel;
  readonly maximumFailureCost: FailureCost;
  readonly maximumIrreversibility: Reversibility;
  readonly contextCapacity: ContextRequirement;
}
```

Each `OrganizationRegistryRow` adds exactly `registrationState`,
`dispatchRelevant`, and `executionCapabilities`. Validation is all-or-nothing
per accepted row:

- `profileId` and `capabilityRank` are unique within the row;
- rank is a nonnegative safe integer;
- model/mode/effort/serialized skills are exact nonblank tokens;
- serialized skill arrays are unique, bytewise sorted, and nonempty. Exact
  `['NONE']` is the sole serialized empty-set representation; any array that
  combines `NONE` with a real skill is invalid;
- profile model and effort are present in that row's existing allowed token
  sets, but allowed-token membership never creates capability support;
- no capability default or model/effort ordering is global;
- `PENDING_ONBOARDING` and `SUSPENDED` are non-dispatchable; and
- a malformed profile makes the Actor capability catalog unusable for
  selection. The selector never drops one bad profile and continues.

Existing row identity, Team, route, provenance, and allowed-observation fields
remain unchanged. No readiness value is added to the registry.

Skill comparison has one exact normalization function for both profiles and
requirements:

```ts
function normalizeSkills(serialized: readonly string[]): readonly string[] {
  // after exact nonempty/unique/sorted/token validation
  return serialized.length === 1 && serialized[0] === 'NONE' ? [] : serialized;
}
```

If `NONE` occurs anywhere except exact `['NONE']`, validation rejects before
normalization. Sufficiency is
`normalizeSkills(requirement).every(skill => normalizeSkills(profile).includes(skill))`.
Consequently a real-skill profile satisfies `['NONE']`, while a `['NONE']`
profile satisfies no real-skill requirement. Serialization remains explicit and
nonempty; the normalized empty set is never accepted as an input encoding.

## 4. Canonical protocol input

The readiness projector receives this explicit input; it performs no Git or
filesystem discovery:

```ts
interface CanonicalProtocolInputV1 {
  readonly schemaVersion: 'agent-office.canonical-protocol-input.v1';
  readonly protocolRepositoryId: 'agent-office';
  readonly protocolCommit: GitCommit;
  readonly protocolVersion: 'agent-office.team-onboarding-execution-profile.v1';
  readonly registryCommit: GitCommit;
  readonly evaluatedAt: string;
  readonly requiredFilesByRole: Readonly<Record<
    OrganizationRole,
    readonly RepositoryFileReadV1[]
  >>;
  readonly universalUnderstandingCheckIds: readonly UniversalUnderstandingCheckId[];
  readonly roleUnderstandingCheckId: Readonly<Record<
    OrganizationRole,
    RoleUnderstandingCheckId
  >>;
  readonly rehearsalVersion: 'agent-office.read-only-onboarding-rehearsal.v1';
}
```

The current commit/version is mandatory caller input. A record referring to a
different commit or version is stale even when recently observed. Equal
commit/version never cures a file/hash, Actor-contract, understanding, or
rehearsal mismatch.

The exact universal check IDs are:

```text
IDENTITY_ROLEINSTANCE_VS_ACTOR_SESSION
AUTHORITY_FROM_EXACT_HANDOFF
RESPONSIBLE_ADVISOR_ROUTING
EXACT_SCOPE_AND_ALLOWED_PATHS
PROHIBITIONS_AND_STOP_CONDITIONS
READINESS_IS_NOT_RUNTIME_OBSERVATION
PROFILE_SELECTION_IS_ADVISOR_OWNED
NO_SELF_REVIEW_RISK_OR_NEXT_MISSION
```

The exact role check IDs are:

```text
ADVISOR_ROUTES_AUDITS_NO_IMPLEMENT_OR_SELF_REVIEW
CONTROL_DESIGNS_CONTRACTS_NO_IMPLEMENT
DESIGNER_DESIGNS_NO_RUNTIME_IMPLEMENT
WORKER_EXACT_HANDOFF_NO_SELF_REVIEW
REVIEWER_INDEPENDENT_READ_ONLY_NO_PATCH_APPROVAL
```

Each role's required check set is the complete universal list plus exactly its
one matching role check. Missing, duplicate, extra, or failed checks reject
readiness.

## 5. Exact role onboarding handoff

```ts
type OnboardingReason =
  | 'INITIAL'
  | 'PROTOCOL_STALE'
  | 'MISUNDERSTANDING'
  | 'READ_SET_CHANGED'
  | 'REGISTRATION_PENDING'
  | 'EVIDENCE_CONFLICT';

type OnboardingProhibition =
  | 'NO_IMPLEMENTATION'
  | 'NO_FILE_WRITE'
  | 'NO_TERMINAL_OR_TMUX_INPUT'
  | 'NO_ARBITRARY_COMMAND'
  | 'NO_TRANSPORT_OR_REMOTE_ACCESS'
  | 'NO_SECRET_DATABASE_PUBLIC_OR_LIVE_SYSTEM'
  | 'NO_SELF_REVIEW_OR_RISK_ACCEPTANCE'
  | 'NO_SELF_PROFILE_OVERRIDE'
  | 'NO_ACTOR_DISPATCH'
  | 'NO_NEXT_MISSION_SELECTION';

interface TeamOnboardingInstructionV1 {
  readonly schemaVersion: 'agent-office.team-onboarding-instruction.v1';
  readonly instructionId: UuidV7;
  readonly issuedByActorId: 'leo-gpt';
  readonly targetAdvisorTeam: AdvisorTeam;
  readonly responsibleAdvisorActorId: string;
  readonly registryCommit: GitCommit;
  readonly protocolCommit: GitCommit;
  readonly protocolVersion: 'agent-office.team-onboarding-execution-profile.v1';
}

interface RoleOnboardingHandoffV1 {
  readonly schemaVersion: 'agent-office.role-onboarding-handoff.v1';
  readonly handoffId: UuidV7;
  readonly instructionId: UuidV7;
  readonly targetRoleInstanceId: string;
  readonly targetActorId: string;
  readonly targetRole: OrganizationRole;
  readonly advisorTeam: AdvisorTeam;
  readonly responsibleAdvisorRoleInstanceId: string;
  readonly responsibleAdvisorActorId: string;
  readonly reason: OnboardingReason;
  readonly registryCommit: GitCommit;
  readonly actorContractHash: Sha256Ref;
  readonly protocolCommit: GitCommit;
  readonly protocolVersion: 'agent-office.team-onboarding-execution-profile.v1';
  readonly requiredFiles: readonly RepositoryFileReadV1[];
  readonly requiredUnderstandingCheckIds: readonly string[];
  readonly rehearsalVersion: 'agent-office.read-only-onboarding-rehearsal.v1';
  readonly allowedAction: 'READ_AND_CLASSIFY_ONLY';
  readonly resultArtifactPath: string;
  readonly returnToActorId: string;
  readonly prohibitions: readonly OnboardingProhibition[];
}
```

`actorContractHash` is SHA-256 over canonical JSON containing exactly the
current row's `roleInstanceId`, `actorId`, `role`, `advisorTeam`,
`reportsToAdvisor`, `assignedBy`, and `returnsResultTo`. Session, capability,
dispatch-relevance, and registration-lifecycle changes do not silently alter
role understanding; identity/role/Team/route changes do. This permits a pending
Actor's accepted readiness evidence to survive the reviewed
`PENDING_ONBOARDING -> ACTIVE` registration transition when its authority
contract is otherwise byte-identical.

`OnboardingProhibition` is a closed list containing implementation, file write,
terminal/tmux input, arbitrary command, transport, remote, secret, DB, public or
live system, self-review, risk acceptance, profile override, Actor dispatch,
and next-mission selection. The exact implementation constants enumerate every
value; free text is not parsed.

The handoff's return artifact is structured `ProtocolUnderstandingResultV1`:

```ts
interface ProtocolUnderstandingResultV1 {
  readonly schemaVersion: 'agent-office.protocol-understanding-result.v1';
  readonly handoffId: UuidV7;
  readonly roleInstanceId: string;
  readonly checkResults: readonly {
    readonly checkId: string;
    readonly outcome: 'PASS' | 'FAIL';
    readonly selectedAnswerId: string;
  }[];
  readonly rehearsal: {
    readonly version: 'agent-office.read-only-onboarding-rehearsal.v1';
    readonly authoritySource: 'EXACT_COMMITTED_HANDOFF';
    readonly action: 'CLASSIFY_ONLY';
    readonly scopeDecision: 'EXACT_PATHS_ONLY';
    readonly returnDecision: 'RESPONSIBLE_ADVISOR' | 'LEO_GPT';
    readonly conflictDecision: 'STOP_AND_RETURN';
    readonly sideEffects: 'NONE';
    readonly outcome: 'PASS' | 'FAIL';
  };
  readonly sourceEventIds: readonly UuidV7[];
}
```

The correct `selectedAnswerId` values come from committed role-specific fixtures
and are compared exactly. No prose, semantic similarity, or terminal output is
parsed. The rehearsal is a data classification only. `returnDecision` must be
`LEO_GPT` for the responsible Advisor's own onboarding and
`RESPONSIBLE_ADVISOR` for every subordinate.

Readiness acceptance authority has one exact shape:

```ts
interface ReadinessAcceptanceAuthorityV1 {
  readonly kind: 'RESPONSIBLE_ADVISOR' | 'LEO_GPT';
  readonly authorityId: string;
}
```

For a subordinate, `kind` is `RESPONSIBLE_ADVISOR` and `authorityId` is the
current responsible Advisor's `roleInstanceId`. For the responsible Advisor's
own readiness, `kind` is `LEO_GPT` and `authorityId` is exact `leo-gpt`. Any
self-acceptance is invalid. The Advisor's own onboarding result returns to
Leo/GPT; subordinate results return to the Advisor.

## 6. Exact immutable readiness schemas

### 6.1 `PROTOCOL_READY`

`ProtocolReadyEvidenceV1` contains exactly these fields and no others:

```ts
interface ProtocolReadyEvidenceV1 {
  readonly schemaVersion: 'agent-office.protocol-ready.v1';
  readonly kind: 'PROTOCOL_READY';
  readonly evidenceId: UuidV7;
  readonly evidenceRef: Sha256Ref;
  readonly roleInstanceId: string;
  readonly actorContractHash: Sha256Ref;
  readonly registryCommit: GitCommit;
  readonly protocolCommit: GitCommit;
  readonly protocolVersion: 'agent-office.team-onboarding-execution-profile.v1';
  readonly filesRead: readonly RepositoryFileReadV1[];
  readonly understandingValidation: {
    readonly artifactRef: Sha256Ref;
    readonly checkIds: readonly string[];
    readonly outcome: 'PASS';
  };
  readonly readOnlyRehearsal: {
    readonly artifactRef: Sha256Ref;
    readonly version: 'agent-office.read-only-onboarding-rehearsal.v1';
    readonly outcome: 'PASS';
  };
  readonly acceptedBy: ReadinessAcceptanceAuthorityV1;
  readonly acceptanceStatus: 'ACCEPTED';
  readonly sourceEventIds: readonly UuidV7[];
  readonly observedAt: string;
  readonly effectiveFrom: string;
}
```

It duplicates no mutable actorId, role, Team, session, model, or profile fact;
those resolve through the current registry row by `roleInstanceId`.
`evidenceRef` hashes the complete immutable understanding result plus handoff.
The two nested artifact refs bind the exact structured checks and rehearsal.

A valid record requires exact schema/keys, nonblank current registry join,
well-formed identities/hashes/commits/timestamps, a nonempty unique source-event
list, exact acceptance authority under the rule above, exact file-set equality,
exact check-set equality, and both pass outcomes. No partial readiness or
self-acceptance exists.

### 6.2 Immutable not-ready/invalidation record

```ts
type ProtocolNotReadyReason =
  | 'UNDERSTANDING_FAILED'
  | 'MISUNDERSTANDING_DISCOVERED'
  | 'EVIDENCE_CONFLICT'
  | 'AUTHORITY_CHANGED'
  | 'MANUAL_SUSPENSION';

interface ProtocolNotReadyEvidenceV1 {
  readonly schemaVersion: 'agent-office.protocol-not-ready.v1';
  readonly kind: 'PROTOCOL_NOT_READY';
  readonly evidenceId: UuidV7;
  readonly evidenceRef: Sha256Ref;
  readonly roleInstanceId: string;
  readonly actorContractHash: Sha256Ref;
  readonly protocolCommit: GitCommit;
  readonly protocolVersion: 'agent-office.team-onboarding-execution-profile.v1';
  readonly invalidatesReadyEvidenceId: UuidV7 | null;
  readonly reason: ProtocolNotReadyReason;
  readonly acceptedBy: ReadinessAcceptanceAuthorityV1;
  readonly acceptanceStatus: 'ACCEPTED';
  readonly sourceEventIds: readonly UuidV7[];
  readonly observedAt: string;
  readonly effectiveFrom: string;
}
```

This record preserves history; it never deletes or edits a ready record. A
later successful targeted onboarding emits a new ready record.

### 6.3 Deduplication, conflict, and selection

Use the existing accepted-evidence discipline:

1. group by `evidenceId`;
2. field-identical replay collapses to one;
3. unequal records bearing one ID are all dropped with
   `READINESS_EVIDENCE_ID_COLLISION`;
4. structurally invalid, rejected, wrong-Advisor, or future-effective records do
   not contribute;
5. for a role and exact current Actor/protocol contract, find the greatest
   `effectiveFrom` across ready/not-ready records;
6. if both decisions exist at that greatest instant, return not ready with
   `READINESS_DECISION_CONFLICT`; otherwise use the sole decision; and
7. `evidenceId` is only a deterministic tie-break among field-equivalent kinds,
   never authority to choose ready over not-ready.

Records for another protocol commit/version or Actor-contract hash are retained
as history but are stale and cannot contribute.

## 7. Actor readiness and staleness projection

For each accepted Team row, compute `ActorProtocolReadinessV1`:

```ts
type ActorProtocolStatus =
  | 'PROTOCOL_READY'
  | 'PROTOCOL_NOT_READY'
  | 'PROTOCOL_STALE'
  | 'PENDING_ONBOARDING'
  | 'SUSPENDED';

interface ActorProtocolReadinessV1 {
  readonly roleInstanceId: string;
  readonly status: ActorProtocolStatus;
  readonly readyEvidenceId: UuidV7 | null;
  readonly canDispatch: boolean;
  readonly primaryDiagnostic: ProtocolReadinessDiagnostic | null;
  readonly diagnostics: readonly ProtocolReadinessDiagnostic[];
}
```

Precedence is fail closed:

1. `SUSPENDED` registry state;
2. invalid/conflicting current registry/authority;
3. `PENDING_ONBOARDING` registry state;
4. current not-ready or decision conflict;
5. stale protocol commit, protocol version, Actor-contract hash, required file
   set/hash, check set, or rehearsal version;
6. missing current ready evidence; then
7. `PROTOCOL_READY`.

For a subordinate, `canDispatch` is true only for
`ACTIVE + PROTOCOL_READY + dispatchRelevant`. The resolved responsible Advisor
may initiate Team dispatch when it is `ACTIVE + PROTOCOL_READY`; its own
`dispatchRelevant` flag cannot exclude the mandatory Advisor. The explicit
canonical input supplies current commit/version. `observedAt` age never causes
or cures staleness.

Closed readiness diagnostics have this exact schema:

```ts
type ProtocolReadinessDiagnosticCode =
  | 'REGISTRY_IDENTITY_INVALID'
  | 'RESPONSIBLE_ADVISOR_MISSING'
  | 'RESPONSIBLE_ADVISOR_CONFLICT'
  | 'RESPONSIBLE_ADVISOR_LIFECYCLE_BLOCKED'
  | 'RESPONSIBLE_ADVISOR_ROUTE_MISMATCH'
  | 'ACTOR_PENDING_ONBOARDING'
  | 'ACTOR_SUSPENDED'
  | 'PROTOCOL_READY_MISSING'
  | 'PROTOCOL_SCHEMA_INVALID'
  | 'PROTOCOL_COMMIT_STALE'
  | 'PROTOCOL_VERSION_STALE'
  | 'ACTOR_CONTRACT_STALE'
  | 'FILES_READ_MISMATCH'
  | 'UNDERSTANDING_CHECK_MISMATCH'
  | 'UNDERSTANDING_FAILED'
  | 'REHEARSAL_MISMATCH'
  | 'REHEARSAL_FAILED'
  | 'READINESS_EVIDENCE_ID_COLLISION'
  | 'READINESS_DECISION_CONFLICT'
  | 'READINESS_INVALIDATED';

type ProtocolReadinessDetailCode =
  | 'REGISTRY_ROW_IDENTITY_OR_DUPLICATE_REJECTED'
  | 'NO_ACCEPTED_RESPONSIBLE_ADVISOR'
  | 'MULTIPLE_ACCEPTED_RESPONSIBLE_ADVISORS'
  | 'RESPONSIBLE_ADVISOR_NOT_ACTIVE'
  | 'SUBORDINATE_ROUTE_NOT_EXACT_ADVISOR'
  | 'PENDING_REGISTRATION_REQUIRES_ONBOARDING'
  | 'SUSPENDED_REQUIRES_REVIEWED_REACTIVATION'
  | 'NO_CURRENT_READY_EVIDENCE'
  | 'READINESS_RECORD_UNATTRIBUTABLE'
  | 'EVIDENCE_PROTOCOL_COMMIT_NOT_CURRENT'
  | 'EVIDENCE_PROTOCOL_VERSION_NOT_CURRENT'
  | 'EVIDENCE_ACTOR_CONTRACT_NOT_CURRENT'
  | 'EVIDENCE_FILE_SET_NOT_CURRENT'
  | 'EVIDENCE_CHECK_SET_NOT_CURRENT'
  | 'UNDERSTANDING_RESULT_FAILED'
  | 'EVIDENCE_REHEARSAL_VERSION_NOT_CURRENT'
  | 'REHEARSAL_RESULT_FAILED'
  | 'EVIDENCE_ID_COLLISION_ACTOR_SCOPED'
  | 'EVIDENCE_ID_COLLISION_UNATTRIBUTABLE'
  | 'LATEST_READY_NOT_READY_DECISIONS_CONFLICT'
  | 'INVALIDATED_UNDERSTANDING_FAILED'
  | 'INVALIDATED_MISUNDERSTANDING_DISCOVERED'
  | 'INVALIDATED_EVIDENCE_CONFLICT'
  | 'INVALIDATED_AUTHORITY_CHANGED'
  | 'INVALIDATED_MANUAL_SUSPENSION';

interface ProtocolReadinessDiagnostic {
  readonly code: ProtocolReadinessDiagnosticCode;
  readonly roleInstanceId: string | null;
  readonly detailCode: ProtocolReadinessDetailCode;
}
```

Only the code/detail pairs in the §8 resolution table are valid. Diagnostics
contain no raw answer, file content, terminal output, dynamic identifier beyond
the accepted `roleInstanceId`, or secret value. Each non-ready accepted Actor
has exactly one `primaryDiagnostic`, chosen by the precedence at lines 1-6 above
and then the §6.3 collision/decision rules. A ready Actor has
`primaryDiagnostic: null`. Additional diagnostics are stable secondary facts;
they never replace the primary diagnostic by array order.

## 8. Deterministic `TEAM_READY`

```ts
interface TeamReadinessProjectionV1 {
  readonly schemaVersion: 'agent-office.team-readiness-projection.v1';
  readonly advisorTeam: AdvisorTeam;
  readonly responsibleAdvisorRoleInstanceId: string | null;
  readonly protocolCommit: GitCommit;
  readonly protocolVersion: 'agent-office.team-onboarding-execution-profile.v1';
  readonly requiredRoleInstanceIds: readonly string[];
  readonly readyRoleInstanceIds: readonly string[];
  readonly blockedRoleInstanceIds: readonly string[];
  readonly status: 'TEAM_READY' | 'TEAM_NOT_READY';
  readonly diagnostics: readonly ProtocolReadinessDiagnostic[];
}
```

Algorithm:

1. run existing registry partitioning; any identity/route conflict affecting the
   requested Team blocks projection;
2. resolve exactly one accepted responsible Advisor row for the Team regardless
   of lifecycle, so a pending/suspended Advisor remains in the required set; if
   it is not `ACTIVE`, also emit
   `RESPONSIBLE_ADVISOR_LIFECYCLE_BLOCKED / RESPONSIBLE_ADVISOR_NOT_ACTIVE`;
3. required set = that Advisor plus every accepted Team row with
   `dispatchRelevant === true`; include pending/suspended rows so they block;
4. do not create an element for an absent role category;
5. project each required Actor using §7;
6. `TEAM_READY` iff every required Actor is `ACTIVE`, `PROTOCOL_READY`, and
   `canDispatch` (the Advisor's `dispatchRelevant` flag cannot exclude it);
7. sort all ID lists bytewise and all diagnostics by code then ID.

`TEAM_READY` is a projection, not a mutable registry/evidence flag. A snapshot
may be persisted as evidence with its exact inputs and hash, but consumers must
reproject whenever registry commit, protocol commit/version, or readiness input
changes.

The exact planner schemas are:

```ts
interface OnboardingHandoffBindingV1 {
  readonly roleInstanceId: string;
  readonly handoffId: UuidV7;
  readonly resultArtifactPath: string;
}

interface TeamOnboardingPlannerInputV1 {
  readonly schemaVersion: 'agent-office.team-onboarding-planner-input.v1';
  readonly instruction: TeamOnboardingInstructionV1;
  readonly requestedByActorId: string;
  readonly canonicalProtocol: CanonicalProtocolInputV1;
  readonly registryRows: readonly OrganizationRegistryRow[];
  readonly readyEvidence: readonly ProtocolReadyEvidenceV1[];
  readonly notReadyEvidence: readonly ProtocolNotReadyEvidenceV1[];
  readonly handoffBindings: readonly OnboardingHandoffBindingV1[];
}

type OnboardingPlanDisposition =
  | 'HANDOFF_PLANNED'
  | 'NO_HANDOFF_LIFECYCLE_BLOCKED'
  | 'NO_HANDOFF_AUTHORITY_BLOCKED'
  | 'NO_HANDOFF_INPUT_BLOCKED';

type OnboardingPlannerBlockCode =
  | 'REVIEWED_REACTIVATION_REQUIRED'
  | 'RESPONSIBLE_ADVISOR_AUTHORITY_UNRESOLVED'
  | 'REGISTRY_OR_ROUTE_AUTHORITY_INVALID'
  | 'UNATTRIBUTABLE_READINESS_INPUT';

interface ActorOnboardingPlanActionV1 {
  readonly roleInstanceId: string | null;
  readonly diagnostic: ProtocolReadinessDiagnostic;
  readonly disposition: OnboardingPlanDisposition;
  readonly onboardingReason: OnboardingReason | null;
  readonly blockCode: OnboardingPlannerBlockCode | null;
  readonly handoff: RoleOnboardingHandoffV1 | null;
}

interface TeamOnboardingPlanV1 {
  readonly schemaVersion: 'agent-office.team-onboarding-plan.v1';
  readonly instructionId: UuidV7;
  readonly advisorTeam: AdvisorTeam;
  readonly registryCommit: GitCommit;
  readonly protocolCommit: GitCommit;
  readonly protocolVersion: 'agent-office.team-onboarding-execution-profile.v1';
  readonly status: 'ONBOARDING_PLAN_READY' | 'ONBOARDING_PLAN_BLOCKED';
  readonly teamReadiness: TeamReadinessProjectionV1;
  readonly actions: readonly ActorOnboardingPlanActionV1[];
  readonly handoffs: readonly RoleOnboardingHandoffV1[];
}

type PlanTeamOnboardingResultV1 =
  | {
      readonly outcome: 'PLAN_CREATED';
      readonly plan: TeamOnboardingPlanV1;
      readonly rejectionCode: null;
    }
  | {
      readonly outcome: 'PLANNER_INPUT_REJECTED';
      readonly plan: null;
      readonly rejectionCode:
        | 'PLANNER_SCHEMA_INVALID'
        | 'INSTRUCTION_CANONICAL_INPUT_MISMATCH'
        | 'HANDOFF_BINDING_INVALID'
        | 'DIAGNOSTIC_CONTRACT_INVALID';
    };
```

`instruction.registryCommit/protocolCommit/protocolVersion` must equal the
canonical input, and `requestedByActorId` must equal the instruction's named
responsible Advisor Actor when that Advisor resolves. Binding IDs and paths are
unique by `roleInstanceId`; they are explicit inputs because this pure planner
does not mint UUIDs or infer artifact paths.

The diagnostic mapping is total and closed:

| Diagnostic code | Valid detail code | Planner result |
|---|---|---|
| `REGISTRY_IDENTITY_INVALID` | `REGISTRY_ROW_IDENTITY_OR_DUPLICATE_REJECTED` | `NO_HANDOFF_AUTHORITY_BLOCKED / REGISTRY_OR_ROUTE_AUTHORITY_INVALID` |
| `RESPONSIBLE_ADVISOR_MISSING` | `NO_ACCEPTED_RESPONSIBLE_ADVISOR` | `NO_HANDOFF_AUTHORITY_BLOCKED / RESPONSIBLE_ADVISOR_AUTHORITY_UNRESOLVED` |
| `RESPONSIBLE_ADVISOR_CONFLICT` | `MULTIPLE_ACCEPTED_RESPONSIBLE_ADVISORS` | `NO_HANDOFF_AUTHORITY_BLOCKED / RESPONSIBLE_ADVISOR_AUTHORITY_UNRESOLVED` |
| `RESPONSIBLE_ADVISOR_LIFECYCLE_BLOCKED` | `RESPONSIBLE_ADVISOR_NOT_ACTIVE` | `NO_HANDOFF_AUTHORITY_BLOCKED / RESPONSIBLE_ADVISOR_AUTHORITY_UNRESOLVED` |
| `RESPONSIBLE_ADVISOR_ROUTE_MISMATCH` | `SUBORDINATE_ROUTE_NOT_EXACT_ADVISOR` | `NO_HANDOFF_AUTHORITY_BLOCKED / REGISTRY_OR_ROUTE_AUTHORITY_INVALID` |
| `ACTOR_PENDING_ONBOARDING` | `PENDING_REGISTRATION_REQUIRES_ONBOARDING` | `HANDOFF_PLANNED / REGISTRATION_PENDING` |
| `ACTOR_SUSPENDED` | `SUSPENDED_REQUIRES_REVIEWED_REACTIVATION` | `NO_HANDOFF_LIFECYCLE_BLOCKED / REVIEWED_REACTIVATION_REQUIRED` |
| `PROTOCOL_READY_MISSING` | `NO_CURRENT_READY_EVIDENCE` | `HANDOFF_PLANNED / INITIAL` |
| `PROTOCOL_SCHEMA_INVALID` | `READINESS_RECORD_UNATTRIBUTABLE` | `NO_HANDOFF_INPUT_BLOCKED / UNATTRIBUTABLE_READINESS_INPUT` |
| `PROTOCOL_COMMIT_STALE` | `EVIDENCE_PROTOCOL_COMMIT_NOT_CURRENT` | `HANDOFF_PLANNED / PROTOCOL_STALE` |
| `PROTOCOL_VERSION_STALE` | `EVIDENCE_PROTOCOL_VERSION_NOT_CURRENT` | `HANDOFF_PLANNED / PROTOCOL_STALE` |
| `ACTOR_CONTRACT_STALE` | `EVIDENCE_ACTOR_CONTRACT_NOT_CURRENT` | `HANDOFF_PLANNED / PROTOCOL_STALE` |
| `FILES_READ_MISMATCH` | `EVIDENCE_FILE_SET_NOT_CURRENT` | `HANDOFF_PLANNED / READ_SET_CHANGED` |
| `UNDERSTANDING_CHECK_MISMATCH` | `EVIDENCE_CHECK_SET_NOT_CURRENT` | `HANDOFF_PLANNED / READ_SET_CHANGED` |
| `UNDERSTANDING_FAILED` | `UNDERSTANDING_RESULT_FAILED` | `HANDOFF_PLANNED / MISUNDERSTANDING` |
| `REHEARSAL_MISMATCH` | `EVIDENCE_REHEARSAL_VERSION_NOT_CURRENT` | `HANDOFF_PLANNED / READ_SET_CHANGED` |
| `REHEARSAL_FAILED` | `REHEARSAL_RESULT_FAILED` | `HANDOFF_PLANNED / MISUNDERSTANDING` |
| `READINESS_EVIDENCE_ID_COLLISION` | `EVIDENCE_ID_COLLISION_ACTOR_SCOPED` | `HANDOFF_PLANNED / EVIDENCE_CONFLICT` |
| `READINESS_EVIDENCE_ID_COLLISION` | `EVIDENCE_ID_COLLISION_UNATTRIBUTABLE` | `NO_HANDOFF_INPUT_BLOCKED / UNATTRIBUTABLE_READINESS_INPUT` |
| `READINESS_DECISION_CONFLICT` | `LATEST_READY_NOT_READY_DECISIONS_CONFLICT` | `HANDOFF_PLANNED / EVIDENCE_CONFLICT` |
| `READINESS_INVALIDATED` | `INVALIDATED_UNDERSTANDING_FAILED` or `INVALIDATED_MISUNDERSTANDING_DISCOVERED` | `HANDOFF_PLANNED / MISUNDERSTANDING` |
| `READINESS_INVALIDATED` | `INVALIDATED_EVIDENCE_CONFLICT` | `HANDOFF_PLANNED / EVIDENCE_CONFLICT` |
| `READINESS_INVALIDATED` | `INVALIDATED_AUTHORITY_CHANGED` | `HANDOFF_PLANNED / PROTOCOL_STALE` |
| `READINESS_INVALIDATED` | `INVALIDATED_MANUAL_SUSPENSION` | `NO_HANDOFF_LIFECYCLE_BLOCKED / REVIEWED_REACTIVATION_REQUIRED` |

A `HANDOFF_PLANNED` row is valid only for a nonnull ID resolving to one accepted
required Actor and one accepted responsible Advisor. Invalid identity/route/
Advisor authority resolves through the table's explicit no-handoff disposition;
the planner never fabricates or copies an invalid Advisor identity. A missing,
duplicate, or mismatched binding and an invalid code/detail pair reject the
planner input with no plan or handoff, rather than changing the table mapping.
Missing/conflicting or non-active responsible-Advisor authority is a plan-global
gate and blocks every handoff. The Advisor row remains required/non-ready when
pending or suspended; its Actor lifecycle diagnostic remains visible in the
Team projection alongside the global authority diagnostic. A suspended Actor
receives no handoff until a separately reviewed registry reactivation. Other
valid Actors' readiness remains intact.

When a plan-global Advisor authority diagnostic exists, `actions` contains only
the sorted global authority block(s), `handoffs` is empty, and per-Actor
onboarding is not planned under invalid authority. Otherwise `actions` contains
one entry for every required non-ready Actor plus every unattributable blocking
diagnostic, sorted with `null` before bytewise role IDs and then by code/detail.
`handoffs` is exactly the nonnull handoffs from those actions, sorted by target
ID. The plan is `ONBOARDING_PLAN_BLOCKED` iff any action is a no-handoff
disposition; otherwise it is `ONBOARDING_PLAN_READY`. No action or handoff exists
for a current-ready Actor.

## 9. Exact dispatch requirement and selection record

```ts
type DispatchKind = 'WORK' | 'INDEPENDENT_REVIEW';

interface IndependentReviewSubjectV1 {
  readonly artifactRef: Sha256Ref;
  readonly producedByRoleInstanceId: string;
}

interface IndependentReviewAssignmentV1 {
  readonly schemaVersion: 'agent-office.independent-review-assignment.v1';
  readonly assignmentId: UuidV7;
  readonly assignmentRef: Sha256Ref;
  readonly sourceHandoffCommit: GitCommit;
  readonly sourceHandoffRef: Sha256Ref;
  readonly missionId: string;
  readonly workUnitId: string;
  readonly advisorTeam: AdvisorTeam;
  readonly assignedByRoleInstanceId: string;
  readonly targetReviewerRoleInstanceId: string;
  readonly reviewedSubjects: readonly IndependentReviewSubjectV1[];
  readonly reviewedRoleInstanceIds: readonly string[];
  readonly resultReturnsToRoleInstanceId: string;
}

interface CanonicalReviewDispatchAuthorityV1 {
  readonly schemaVersion: 'agent-office.canonical-review-dispatch-authority.v1';
  readonly kind: 'EXACT_COMMITTED_RESPONSIBLE_ADVISOR_HANDOFF';
  readonly sourceHandoffCommit: GitCommit;
  readonly sourceHandoffRef: Sha256Ref;
  readonly assignment: IndependentReviewAssignmentV1;
}

interface DispatchCapabilityRequirementV1 {
  readonly schemaVersion: 'agent-office.dispatch-capability-requirement.v1';
  readonly missionId: string;
  readonly workUnitId: string;
  readonly targetRoleInstanceId: string;
  readonly dispatchKind: DispatchKind;
  readonly taskComplexity: TaskComplexity;
  readonly riskLevel: RiskLevel;
  readonly failureCost: FailureCost;
  readonly reversibility: Reversibility;
  readonly contextRequirement: ContextRequirement;
  readonly requiredMode: string;
  readonly requiredSkills: readonly string[];
  readonly independentReviewAssignmentRef: Sha256Ref | null;
}

type ProfileRejectionReason =
  | 'TASK_COMPLEXITY_EXCEEDS_PROFILE'
  | 'RISK_EXCEEDS_PROFILE'
  | 'FAILURE_COST_EXCEEDS_PROFILE'
  | 'IRREVERSIBILITY_EXCEEDS_PROFILE'
  | 'CONTEXT_EXCEEDS_PROFILE'
  | 'MODE_MISMATCH'
  | 'REQUIRED_SKILL_MISSING'
  | 'DEMONSTRATED_CAPABILITY_INSUFFICIENT';

interface ActorCapabilityCatalogSnapshotV1 {
  readonly schemaVersion: 'agent-office.actor-capability-catalog-snapshot.v1';
  readonly roleInstanceId: string;
  readonly registryCommit: GitCommit;
  readonly catalogHash: Sha256Ref;
  readonly profiles: readonly ActorExecutionCapabilityV1[];
}

interface ExecutionProfileSelectionV1 {
  readonly schemaVersion: 'agent-office.execution-profile-selection.v1';
  readonly selectionId: UuidV7;
  readonly requirement: DispatchCapabilityRequirementV1;
  readonly advisorTeam: AdvisorTeam;
  readonly requestedByRoleInstanceId: string;
  readonly targetRoleInstanceId: string;
  readonly registryCommit: GitCommit;
  readonly protocolReadyEvidenceId: UuidV7;
  readonly capabilityCatalogRegistryCommit: GitCommit;
  readonly capabilityCatalogHash: Sha256Ref;
  readonly selectedProfileId: string;
  readonly selectedProfileRef: Sha256Ref;
  readonly selectedModel: string;
  readonly selectedMode: string;
  readonly selectedEffort: string;
  readonly selectedSkills: readonly string[];
  readonly selectedCapabilityRank: number;
  readonly whyNotLower: readonly {
    readonly profileId: string;
    readonly reasons: readonly ProfileRejectionReason[];
  }[];
  readonly whyNotHigher: {
    readonly profileIds: readonly string[];
    readonly reason: 'LOWEST_SUFFICIENT_PROFILE_SELECTED';
  };
  readonly escalation: {
    readonly policy: 'OPERATIONAL_RETRY_SAME_PROFILE__CAPABILITY_ONLY_NEXT_DECLARED_PROFILE';
    readonly operationalRetryLimit: 1;
    readonly capabilityTrigger: 'ACCEPTED_CAPABILITY_INSUFFICIENT_EVIDENCE';
  };
  readonly supersedesSelectionId: UuidV7 | null;
  readonly escalationTriggerOutcomeEvidenceId: UuidV7 | null;
  readonly sourceEventIds: readonly UuidV7[];
  readonly selectedAt: string;
}

interface DispatchAttemptV1 {
  readonly schemaVersion: 'agent-office.dispatch-attempt.v1';
  readonly dispatchAttemptId: UuidV7;
  readonly dispatchAttemptRef: Sha256Ref;
  readonly selectionId: UuidV7;
  readonly selectionRef: Sha256Ref;
  readonly missionId: string;
  readonly workUnitId: string;
  readonly targetRoleInstanceId: string;
  readonly attemptNumber: 1 | 2;
  readonly selectedProfileId: string;
  readonly selectedProfileRef: Sha256Ref;
  readonly capabilityCatalogHash: Sha256Ref;
  readonly authoredByRoleInstanceId: string;
  readonly priorDispatchAttemptId: UuidV7 | null;
  readonly triggeringOutcomeEvidenceId: UuidV7 | null;
  readonly sourceEventIds: readonly UuidV7[];
  readonly plannedAt: string;
}

interface DispatchOutcomeEvidenceV1 {
  readonly schemaVersion: 'agent-office.dispatch-outcome-evidence.v1';
  readonly outcomeEvidenceId: UuidV7;
  readonly evidenceRef: Sha256Ref;
  readonly selectionId: UuidV7;
  readonly dispatchAttemptId: UuidV7;
  readonly dispatchAttemptRef: Sha256Ref;
  readonly attemptNumber: 1 | 2;
  readonly missionId: string;
  readonly workUnitId: string;
  readonly targetRoleInstanceId: string;
  readonly selectedProfileId: string;
  readonly selectedProfileRef: Sha256Ref;
  readonly outcome: 'COMPLETED' | 'OPERATIONAL_FAILURE' | 'CAPABILITY_INSUFFICIENT';
  readonly acceptedByRoleInstanceId: string;
  readonly sourceEventIds: readonly UuidV7[];
  readonly observedAt: string;
  readonly effectiveFrom: string;
}
```

All Founder profile fields are mandatory: complexity, risk, failure cost,
reversibility, context, model, mode, effort, skills, why-not-lower,
why-not-higher, and escalation. No decision logic reads explanatory prose.

An `ActorCapabilityCatalogSnapshotV1` is canonical: profiles are the validated
complete Actor catalog sorted by `(capabilityRank, profileId)`, and
`catalogHash` is SHA-256 over canonical JSON containing exactly
`roleInstanceId + profiles`. The registry commit is stored separately so a
selection proves where that immutable snapshot came from. `selectedProfileRef`
is SHA-256 over canonical JSON of the complete selected
`ActorExecutionCapabilityV1`, including every envelope field. An initial
selection has equal `registryCommit` and `capabilityCatalogRegistryCommit`, with
both supersession fields null. An escalation selection may observe a newer
registry commit but must copy the original catalog commit/hash and bind the
accepted trigger outcome.

Selection compares the closed requirement dimensions by their §3 ordinal,
requires exact mode equality, normalizes both skill arrays by §3, and then tests
normalized required-skill subset. It sorts sufficient profiles by
`(capabilityRank, profileId)`. Every lower-ranked profile appears in
`whyNotLower` with every failed dimension in stable enum order. Every
higher-ranked valid profile appears in `whyNotHigher`; selecting one while a
lower sufficient profile exists is invalid.

An independent review assignment is authoritative only when supplied through a
`CanonicalReviewDispatchAuthorityV1` fixed by the exact committed
responsible-Advisor handoff rather than inside the caller requirement. The
authority input and assignment `sourceHandoffCommit/ref` must match each other
and the handoff tuple pinned by the later implementation handoff;
`assignedByRoleInstanceId` resolves to the responsible Advisor, and target/Team/
mission/WorkUnit/result route all match. `reviewedSubjects` is
nonempty, unique and sorted by `(artifactRef, producedByRoleInstanceId)`.
`reviewedRoleInstanceIds` is nonempty, unique, bytewise sorted, and equals the
exact distinct set of every `producedByRoleInstanceId` in `reviewedSubjects`—no
missing, extra, or caller-substituted ID. `assignmentRef` hashes the complete
canonical assignment excluding only `assignmentRef` itself.

For `WORK`, `independentReviewAssignmentRef` and the separate canonical review
authority input must both be null. For `INDEPENDENT_REVIEW`, both must be
nonnull, the requirement ref must match exactly that authority input's valid
assignment, and the two source commit/ref values must equal the handoff-pinned
tuple.
The removed `reviewerIndependence.required` boolean is an unknown key under the
exact-schema rule; both `true` and `false` legacy shapes reject rather than
waiving review checks.

Closed dispatch/selection/lineage failure codes are:

```text
DISPATCH_REQUIREMENT_SCHEMA_INVALID
REQUESTER_NOT_RESPONSIBLE_ADVISOR
TARGET_NOT_FOUND
TARGET_WRONG_TEAM
TARGET_NOT_DISPATCHABLE
TARGET_PROTOCOL_NOT_READY
ACTOR_SELF_PROFILE_OVERRIDE
CAPABILITY_CATALOG_INVALID
NO_SUFFICIENT_PROFILE
REVIEW_DISPATCH_KIND_REQUIRED
REVIEWER_ROLE_REQUIRED
REVIEW_ASSIGNMENT_MISSING
REVIEW_ASSIGNMENT_INVALID
REVIEW_SCOPE_EMPTY
REVIEW_SCOPE_DUPLICATE
REVIEW_SCOPE_INCOMPLETE
REVIEW_SCOPE_SELF_OVERLAP
REVIEW_ASSIGNMENT_TARGET_MISMATCH
REVIEWED_ACTOR_UNRESOLVED
REVIEWER_NOT_INDEPENDENT
REVIEWER_PROFILE_INSUFFICIENT
SELECTION_ID_COLLISION
DISPATCH_ATTEMPT_INVALID
DISPATCH_ATTEMPT_ID_COLLISION
DISPATCH_ATTEMPT_CHAIN_CONFLICT
DISPATCH_OUTCOME_INVALID
DISPATCH_OUTCOME_ID_COLLISION
DISPATCH_OUTCOME_MULTIPLE_FOR_ATTEMPT
OPERATIONAL_RETRY_EVIDENCE_MISSING
OPERATIONAL_RETRY_LIMIT_REACHED
CAPABILITY_ESCALATION_EVIDENCE_MISSING
CAPABILITY_CATALOG_SNAPSHOT_MISMATCH
CAPABILITY_CATALOG_CHANGED_AFTER_SELECTION
CAPABILITY_ESCALATION_ALREADY_PLANNED
```

A rejection returns one code plus stable selection/attempt/outcome/Actor IDs
when those IDs validated. It emits no selection or attempt and mutates no input.

## 10. Operational retry, capability escalation, and self-override

The pure functions have these total input/result contracts:

```ts
type DispatchLineageFailureCode =
  | 'SELECTION_ID_COLLISION'
  | 'DISPATCH_ATTEMPT_INVALID'
  | 'DISPATCH_ATTEMPT_ID_COLLISION'
  | 'DISPATCH_ATTEMPT_CHAIN_CONFLICT'
  | 'DISPATCH_OUTCOME_INVALID'
  | 'DISPATCH_OUTCOME_ID_COLLISION'
  | 'DISPATCH_OUTCOME_MULTIPLE_FOR_ATTEMPT'
  | 'OPERATIONAL_RETRY_EVIDENCE_MISSING'
  | 'OPERATIONAL_RETRY_LIMIT_REACHED'
  | 'CAPABILITY_ESCALATION_EVIDENCE_MISSING'
  | 'CAPABILITY_CATALOG_SNAPSHOT_MISMATCH'
  | 'CAPABILITY_CATALOG_CHANGED_AFTER_SELECTION'
  | 'CAPABILITY_ESCALATION_ALREADY_PLANNED'
  | 'ACTOR_SELF_PROFILE_OVERRIDE'
  | 'NO_SUFFICIENT_PROFILE';

type DispatchContractResultV1<T> =
  | { readonly outcome: 'ACCEPTED'; readonly value: T; readonly failureCode: null }
  | { readonly outcome: 'REJECTED'; readonly value: null; readonly failureCode: DispatchLineageFailureCode };

interface DispatchLineageInputV1 {
  readonly schemaVersion: 'agent-office.dispatch-lineage-input.v1';
  readonly responsibleAdvisorRoleInstanceId: string;
  readonly selections: readonly ExecutionProfileSelectionV1[];
  readonly attempts: readonly DispatchAttemptV1[];
  readonly outcomes: readonly DispatchOutcomeEvidenceV1[];
}

interface AcceptedDispatchLineageV1 {
  readonly selections: readonly ExecutionProfileSelectionV1[];
  readonly attempts: readonly DispatchAttemptV1[];
  readonly outcomes: readonly DispatchOutcomeEvidenceV1[];
}

interface PlanInitialDispatchAttemptInputV1 {
  readonly schemaVersion: 'agent-office.plan-initial-dispatch-attempt-input.v1';
  readonly selection: ExecutionProfileSelectionV1;
  readonly selectionRef: Sha256Ref;
  readonly proposedDispatchAttemptId: UuidV7;
  readonly authoredByRoleInstanceId: string;
  readonly sourceEventIds: readonly UuidV7[];
  readonly plannedAt: string;
}

interface PlanOperationalRetryInputV1 {
  readonly schemaVersion: 'agent-office.plan-operational-retry-input.v1';
  readonly selection: ExecutionProfileSelectionV1;
  readonly selectionRef: Sha256Ref;
  readonly lineage: DispatchLineageInputV1;
  readonly proposedDispatchAttemptId: UuidV7;
  readonly requestedByRoleInstanceId: string;
  readonly sourceEventIds: readonly UuidV7[];
  readonly plannedAt: string;
}

interface SelectCapabilityEscalationInputV1 {
  readonly schemaVersion: 'agent-office.select-capability-escalation-input.v1';
  readonly supersededSelection: ExecutionProfileSelectionV1;
  readonly supersededSelectionRef: Sha256Ref;
  readonly lineage: DispatchLineageInputV1;
  readonly originalCatalogSnapshot: ActorCapabilityCatalogSnapshotV1;
  readonly currentCatalogSnapshot: ActorCapabilityCatalogSnapshotV1;
  readonly currentRegistryCommit: GitCommit;
  readonly proposedSelectionId: UuidV7;
  readonly requestedByRoleInstanceId: string;
  readonly sourceEventIds: readonly UuidV7[];
  readonly selectedAt: string;
}

function validateDispatchLineage(
  input: DispatchLineageInputV1,
): DispatchContractResultV1<AcceptedDispatchLineageV1>;

function planInitialDispatchAttempt(
  input: PlanInitialDispatchAttemptInputV1,
): DispatchContractResultV1<DispatchAttemptV1>;

function planOperationalRetry(
  input: PlanOperationalRetryInputV1,
): DispatchContractResultV1<DispatchAttemptV1>;

function selectCapabilityEscalation(
  input: SelectCapabilityEscalationInputV1,
): DispatchContractResultV1<ExecutionProfileSelectionV1>;
```

`selectionRef` hashes the complete canonical `ExecutionProfileSelectionV1`;
`selectedProfileRef` hashes the complete canonical
`ActorExecutionCapabilityV1`; `dispatchAttemptRef` hashes the complete canonical
attempt excluding only `dispatchAttemptRef`; and outcome `evidenceRef` hashes
the complete canonical outcome excluding only `evidenceRef`. Assignment and
catalog refs follow their explicit §9 rules. Validation and deduplication are
deterministic:

1. reject unknown/missing keys and any record whose selection/attempt/profile/
   mission/WorkUnit/target binding does not exactly match its referenced record;
2. group selections by `selectionId`: field-identical same-ID replay collapses
   and unequal same-ID records are all rejected with `SELECTION_ID_COLLISION`.
   More than one accepted selection naming the same nonnull
   `supersedesSelectionId` is a conflicting repeated escalation and all such
   successors are rejected with `CAPABILITY_ESCALATION_ALREADY_PLANNED`;
3. group attempts by `dispatchAttemptId`: field-identical same-ID replay
   collapses, unequal same-ID records are all rejected with
   `DISPATCH_ATTEMPT_ID_COLLISION`;
4. require exactly one attempt for each `(selectionId, attemptNumber)`; multiple
   IDs at one number or a broken prior/trigger link reject the whole selection
   chain with `DISPATCH_ATTEMPT_CHAIN_CONFLICT`;
5. group outcomes by `outcomeEvidenceId`: field-identical same-ID replay
   collapses, unequal same-ID records are all rejected with
   `DISPATCH_OUTCOME_ID_COLLISION`;
6. require each outcome to bind one accepted attempt's exact ID/ref/number,
   selection, selected profile ID/ref, mission, WorkUnit, and target, and require
   acceptance by the responsible Advisor rather than the target Actor; then
7. require at most one accepted outcome for an attempt. Multiple different
   outcome IDs for one attempt—whether equal or conflicting in outcome—reject
   that attempt's lineage with `DISPATCH_OUTCOME_MULTIPLE_FOR_ATTEMPT`.

Attempt 1 has `priorDispatchAttemptId: null` and
`triggeringOutcomeEvidenceId: null`. Attempt 2 is valid only when it binds the
sole accepted attempt 1 and that attempt's sole accepted
`OPERATIONAL_FAILURE`; it copies selection/profile/catalog refs exactly. No
attempt number above 2 exists. `planOperationalRetry()` rejects if attempt 2
already exists, so replayed planning cannot mint another retry; two concurrently
recorded attempt-2 IDs make the entire chain conflicting rather than granting
two dispatches.

Capability escalation requires the sole accepted
`CAPABILITY_INSUFFICIENT` outcome for an accepted attempt in the superseded
selection's chain. The new selection sets both `supersedesSelectionId` and
`escalationTriggerOutcomeEvidenceId` to those exact IDs. The original snapshot's
role/commit/hash must match the superseded selection. The current snapshot's
role must match the target, its registry commit must equal
`currentRegistryCommit`, the new selection's `registryCommit` must equal that
same value, and its complete catalog must hash identically to the original
snapshot. Any post-selection addition, removal, or modification therefore returns
`CAPABILITY_CATALOG_CHANGED_AFTER_SELECTION`; it is never an escalation
candidate. Selection considers only higher-ranked profiles in the original
snapshot that independently satisfy the unchanged requirement. An existing
selection with the same `supersedesSelectionId`, duplicate/conflicting trigger
evidence, missing evidence, or catalog mismatch returns its closed failure code
and emits nothing.

The target Actor may submit structured outcome material but cannot accept it,
author an attempt, or request selection/retry/escalation. Requester equal to
target returns `ACTOR_SELF_PROFILE_OVERRIDE` before any output record or
mutation.

## 11. Reviewer authority and profile sufficiency

Review dispatch is non-bypassable:

1. every target whose accepted registry role is `REVIEWER` requires
   `dispatchKind: 'INDEPENDENT_REVIEW'`; `WORK`, a missing kind, or the legacy
   caller boolean returns `REVIEW_DISPATCH_KIND_REQUIRED` or
   `DISPATCH_REQUIREMENT_SCHEMA_INVALID`;
2. every `INDEPENDENT_REVIEW` target must have role `REVIEWER` and reference one
   exact valid `IndependentReviewAssignmentV1`;
3. the assignment's target is the selected Reviewer, its author/result route is
   the responsible Advisor, and mission/WorkUnit/Team match the requirement;
4. subjects are nonempty, and `reviewedRoleInstanceIds` must be the complete
   sorted unique producer-ID set. Empty, duplicate, partial/extra, missing, or
   invalid lists return their exact closed scope code;
5. every reviewed ID resolves to exactly one accepted registry row; no dropped,
   unknown, or conflicting reviewed Actor is ignored;
6. Reviewer `roleInstanceId`, `actorId`, and nonblank session each differ from
   the requester and every reviewed Actor. The Reviewer may not occur in its own
   subject/ID set, directly or through Actor/session overlap;
7. target readiness evidence includes the exact Reviewer role check; and
8. the selected Reviewer profile satisfies every dispatch requirement using the
   same normalized-skill and envelope rules as any other profile.

Authority independence does not waive capability sufficiency, and capability
sufficiency does not create Reviewer authority. No false, absent, empty, or
partial review scope can turn these checks off.

## 12. New-Actor nomination, registration, onboarding, activation

- a nomination artifact alone is non-routable and absent from the registry;
- reviewed registration creates a fresh immutable `roleInstanceId` row in
  `PENDING_ONBOARDING` with explicit Team/routes, dispatch relevance, and
  Actor-specific capability catalog;
- pending Actor accepts onboarding handoffs only and cannot receive mission work;
- a pending dispatch-relevant row participates as blocked in `TEAM_READY`;
- current `PROTOCOL_READY` permits an activation proposal but not dispatch;
- reviewed registry activation changes `registrationState` to `ACTIVE`;
- projection must still be current-ready after activation before `canDispatch`;
  and
- no step creates a session, sends tmux input, accesses a secret, or activates a
  transport.

## 13. Exact Founder validation scenarios

This table contains exactly the twelve scenarios supplied by the Founder
addendum. The later implementation must use IDs `FVS-01` through `FVS-12` and
must not relabel a different behavior as one of these scenarios.

| ID | Exact scenario | Deterministic expected outcome | Targeted test obligation |
|---|---|---|---|
| `FVS-01` | Team with no Control | Required set is formed from actual rows; no missing-Control diagnostic is created. Team is ready when its Advisor and every actual dispatch-relevant Actor are current-ready. | Fixture has zero Control rows and current-ready Advisor/Worker/Reviewer; expect `TEAM_READY` and no synthetic Control ID. |
| `FVS-02` | Team with multiple Workers | Every active Team-assigned dispatch-relevant Worker row is independently required; one handoff/readiness record never covers another Worker. | Fixture has two unique Workers; expect both IDs in sorted required set and separate targeted handoffs when both are missing. |
| `FVS-03` | Leo-nominated new Worker | Nomination alone grants nothing. Reviewed row is fresh, pending, onboarding-only, and non-dispatchable; if dispatch-relevant it blocks Team until valid readiness plus reviewed activation. | Assert no row/no dispatch after nomination; pending row blocks; ready evidence alone still pending; activation plus current readiness enables dispatch. |
| `FVS-04` | stale protocol commit requiring reload | Ready evidence whose protocol commit differs from explicit current input becomes `PROTOCOL_STALE`; exactly that Actor receives a `PROTOCOL_STALE` reload handoff and cannot dispatch. | Current input commit B with Actor evidence commit A; expect stale diagnostic, one targeted handoff, other current Actors unchanged. |
| `FVS-05` | Actor misunderstanding requiring targeted re-onboarding | Failed check or accepted invalidation yields `PROTOCOL_NOT_READY`; no ready evidence is minted and only that Actor receives a `MISUNDERSTANDING` handoff. | One Actor fails role check while peers pass; expect Team blocked, one targeted handoff, peer evidence retained. |
| `FVS-06` | xhigh selected when sufficient | Given an Actor catalog explicitly containing ranked xhigh/max/ultra profiles and a requirement within xhigh's envelope, selector chooses xhigh as lowest sufficient. | Assert selected effort/profile is xhigh, lower rejections exact, max/ultra listed only in `whyNotHigher`. |
| `FVS-07` | max selected immediately when xhigh is insufficient | xhigh is rejected by structured envelope comparison; max is selected on the first decision without an operational xhigh attempt. | Requirement exceeds one xhigh dimension but fits max; expect max and exact xhigh rejection code, no retry/supersedes ID. |
| `FVS-08` | ultra rejected when max is sufficient | With xhigh insufficient and max sufficient, higher-ranked ultra is not selected; `whyNotHigher` records `LOWEST_SUFFICIENT_PROFILE_SELECTED`. | Assert max selected and ultra appears only in higher-profile rationale. |
| `FVS-09` | escalation from max to ultra on demonstrated capability insufficiency | One accepted capability-insufficiency outcome bound to max's exact accepted attempt permits a new Advisor selection; ultra is selected only from the original immutable catalog snapshot when already declared and sufficient. | First select/attempt max; accept its exact insufficiency outcome; expect ultra with exact `supersedesSelectionId`, trigger outcome ID, and original catalog hash. Missing/duplicate/conflicting evidence, repeat planning, undeclared ultra, or any post-selection catalog addition/removal/change blocks. |
| `FVS-10` | Actor self-profile override rejected | A target Actor requesting its own profile change receives `ACTOR_SELF_PROFILE_OVERRIDE`; no selection, registry/evidence mutation, retry, or dispatch occurs. | Set requester equal target; assert closed failure and byte-identical input catalogs/evidence. |
| `FVS-11` | Reviewer profile independently sufficient | Review dispatch succeeds only for authoritative `INDEPENDENT_REVIEW` with a complete nonempty assignment scope, a current-ready separately identified/sessioned Reviewer, and a sufficient declared profile. | Positive case selects a sufficient Reviewer. Reject `WORK`/legacy false waiver, missing/empty/partial/extra/duplicate/self-overlapping scope, unresolved reviewed Actor, same Actor/session, wrong role, missing Reviewer check, and insufficient profile with exact codes. |
| `FVS-12` | `TEAM_READY` blocked when one required Actor is not ready | One missing/stale/pending/suspended/invalid required Actor makes status `TEAM_NOT_READY`; ready peers do not mask it. Remediable states receive one targeted handoff; suspension and invalid identity/route/Advisor authority receive an explicit no-handoff block. | Remediable Worker: blocked Worker ID plus one handoff. Suspended or route-mismatched accepted Worker: same blocked ID, zero handoffs, exact lifecycle/authority disposition. Missing/conflicting Advisor or unattributable identity: `TEAM_NOT_READY`, null/global diagnostic as specified, and zero handoffs. |

Scenario fixtures may use synthetic `xhigh`, `max`, and `ultra` profiles only to
exercise declared ranks/envelopes. They are not evidence that any real Actor
supports those profiles.

Targeted profile tests also bind §3 `NONE` semantics independently of the twelve
scenario labels: a real-skill profile satisfies a `['NONE']` requirement;
`['NONE']` satisfies `['NONE']`; a `['NONE']` profile fails a real-skill
requirement; and mixed `NONE` plus real skill rejects for both requirements and
profiles.

## 14. Security and external boundaries

- no runtime source in this design pass, no live delivery, and no automatic
  onboarding rollout;
- no AS1 or Slack path, package, manifest, setup, token, connection, or owner
  action;
- no tmux input, terminal output parsing, arbitrary command, filesystem
  discovery, Git discovery, remote access, secret, DB, environment, PII,
  production, or public service;
- no edit to Foundation, SIASIU, Cosmile, or VibeNews;
- no Actor self-registration, self-activation, self-profile change, self-review,
  risk acceptance, final approval, or next-mission selection.

## 15. Contract completion gate

The later implementation is conformant only when all exact schemas reject
unknown/malformed input, every algorithm is input-order deterministic, all
twelve `FVS` tests pass, existing organization identity/evidence tests remain
green, no second registry/store exists, current protocol commit/version are
explicit inputs, and independent review verifies the result.

`RETURN_TO: agent-office-advisor`

`STOP`
