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
- model/mode/effort/skills are exact nonblank tokens;
- skills are unique, bytewise sorted, and nonempty; `['NONE']` is the sole
  no-skill representation and cannot be combined;
- profile model and effort are present in that row's existing allowed token
  sets, but allowed-token membership never creates capability support;
- no capability default or model/effort ordering is global;
- `PENDING_ONBOARDING` and `SUSPENDED` are non-dispatchable; and
- a malformed profile makes the Actor capability catalog unusable for
  selection. The selector never drops one bad profile and continues.

Existing row identity, Team, route, provenance, and allowed-observation fields
remain unchanged. No readiness value is added to the registry.

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

Closed readiness diagnostic codes are:

```text
REGISTRY_IDENTITY_INVALID
RESPONSIBLE_ADVISOR_MISSING
RESPONSIBLE_ADVISOR_CONFLICT
RESPONSIBLE_ADVISOR_ROUTE_MISMATCH
ACTOR_PENDING_ONBOARDING
ACTOR_SUSPENDED
PROTOCOL_READY_MISSING
PROTOCOL_SCHEMA_INVALID
PROTOCOL_COMMIT_STALE
PROTOCOL_VERSION_STALE
ACTOR_CONTRACT_STALE
FILES_READ_MISMATCH
UNDERSTANDING_CHECK_MISMATCH
UNDERSTANDING_FAILED
REHEARSAL_MISMATCH
REHEARSAL_FAILED
READINESS_EVIDENCE_ID_COLLISION
READINESS_DECISION_CONFLICT
READINESS_INVALIDATED
```

Diagnostics contain only code, `roleInstanceId | null`, and stable detail code;
no raw answer, file content, terminal output, or dynamic secret value appears.

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
2. resolve exactly one active responsible Advisor for the Team;
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

`planTeamOnboarding()` returns one handoff for each required Actor that is not
ready, keyed by the most specific diagnostic. It never returns a handoff for a
current-ready Actor. Stale/misunderstood Actors receive targeted reloads; one
Actor's defect does not invalidate another Actor's valid evidence.

## 9. Exact dispatch requirement and selection record

```ts
interface DispatchCapabilityRequirementV1 {
  readonly schemaVersion: 'agent-office.dispatch-capability-requirement.v1';
  readonly missionId: string;
  readonly workUnitId: string;
  readonly targetRoleInstanceId: string;
  readonly taskComplexity: TaskComplexity;
  readonly riskLevel: RiskLevel;
  readonly failureCost: FailureCost;
  readonly reversibility: Reversibility;
  readonly contextRequirement: ContextRequirement;
  readonly requiredMode: string;
  readonly requiredSkills: readonly string[];
  readonly reviewerIndependence: {
    readonly required: boolean;
    readonly reviewedRoleInstanceIds: readonly string[];
  };
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

interface ExecutionProfileSelectionV1 {
  readonly schemaVersion: 'agent-office.execution-profile-selection.v1';
  readonly selectionId: UuidV7;
  readonly requirement: DispatchCapabilityRequirementV1;
  readonly advisorTeam: AdvisorTeam;
  readonly requestedByRoleInstanceId: string;
  readonly targetRoleInstanceId: string;
  readonly registryCommit: GitCommit;
  readonly protocolReadyEvidenceId: UuidV7;
  readonly selectedProfileId: string;
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
  readonly sourceEventIds: readonly UuidV7[];
  readonly selectedAt: string;
}

interface DispatchOutcomeEvidenceV1 {
  readonly schemaVersion: 'agent-office.dispatch-outcome-evidence.v1';
  readonly outcomeEvidenceId: UuidV7;
  readonly evidenceRef: Sha256Ref;
  readonly selectionId: UuidV7;
  readonly missionId: string;
  readonly workUnitId: string;
  readonly targetRoleInstanceId: string;
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

Selection compares the closed requirement dimensions by their §3 ordinal,
requires exact mode equality and required-skill subset, then sorts sufficient
profiles by `(capabilityRank, profileId)`. Every lower-ranked profile appears in
`whyNotLower` with every failed dimension in stable enum order. Every
higher-ranked valid profile appears in `whyNotHigher`; selecting one while a
lower sufficient profile exists is invalid.

Closed selection failure codes are:

```text
REQUESTER_NOT_RESPONSIBLE_ADVISOR
TARGET_NOT_FOUND
TARGET_WRONG_TEAM
TARGET_NOT_DISPATCHABLE
TARGET_PROTOCOL_NOT_READY
ACTOR_SELF_PROFILE_OVERRIDE
CAPABILITY_CATALOG_INVALID
NO_SUFFICIENT_PROFILE
REVIEWER_ROLE_REQUIRED
REVIEWER_NOT_INDEPENDENT
REVIEWER_PROFILE_INSUFFICIENT
OPERATIONAL_RETRY_LIMIT_REACHED
CAPABILITY_ESCALATION_EVIDENCE_MISSING
```

A rejected selection returns code + stable IDs only and emits no selection
record.

## 10. Operational retry, capability escalation, and self-override

An exact immutable `DispatchOutcomeEvidenceV1` names the selection, WorkUnit,
target `roleInstanceId`, responsible-Advisor acceptance, source events, and one
closed outcome. The target Actor may submit a structured result but cannot
accept its own outcome evidence.

- First `OPERATIONAL_FAILURE`: the responsible Advisor may create one retry
  dispatch record that references the same selection and exact profile. The
  selector does not move upward.
- Second operational failure: return `OPERATIONAL_RETRY_LIMIT_REACHED`.
- Accepted `CAPABILITY_INSUFFICIENT`: the responsible Advisor may rerun selection
  with that profile excluded and `supersedesSelectionId` set. The next profile
  must already exist in the same Actor catalog and independently satisfy the
  requirement.
- Missing capability evidence: no escalation.
- Request authored by target Actor: `ACTOR_SELF_PROFILE_OVERRIDE`; no selection,
  retry, registry mutation, or dispatch record.

## 11. Reviewer authority and profile sufficiency

When `reviewerIndependence.required` is true:

1. target registry role must be `REVIEWER`;
2. target `roleInstanceId` differs from requester and every reviewed Actor;
3. target nonblank session differs from the requester and every reviewed Actor
   session (unknown/duplicate fails closed);
4. target readiness evidence includes the exact Reviewer role check;
5. assignment and result route to the responsible Advisor; and
6. the selected profile satisfies every dispatch requirement normally.

Authority independence does not waive capability sufficiency, and capability
sufficiency does not create Reviewer authority.

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
| `FVS-09` | escalation from max to ultra on demonstrated capability insufficiency | An accepted capability-insufficiency outcome tied to max permits a new Advisor selection excluding max; ultra is selected only when already declared and sufficient. | First select max; add exact accepted insufficiency evidence; expect new record selecting ultra with `supersedesSelectionId`; missing evidence or undeclared ultra blocks. |
| `FVS-10` | Actor self-profile override rejected | A target Actor requesting its own profile change receives `ACTOR_SELF_PROFILE_OVERRIDE`; no selection, registry/evidence mutation, retry, or dispatch occurs. | Set requester equal target; assert closed failure and byte-identical input catalogs/evidence. |
| `FVS-11` | Reviewer profile independently sufficient | Review dispatch succeeds only when target is a current-ready, separately identified/sessioned Reviewer and its declared profile satisfies the full review requirement. | Positive case selects sufficient Reviewer profile; negative subcases for same Actor/session, wrong role, missing Reviewer check, or insufficient profile return their exact closed code. |
| `FVS-12` | `TEAM_READY` blocked when one required Actor is not ready | One missing/stale/pending/suspended/invalid required Actor makes status `TEAM_NOT_READY`; ready peers do not mask it. | Required set has one non-ready Worker; expect its ID in blocked list, status not ready, and exactly one targeted handoff. |

Scenario fixtures may use synthetic `xhigh`, `max`, and `ultra` profiles only to
exercise declared ranks/envelopes. They are not evidence that any real Actor
supports those profiles.

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
