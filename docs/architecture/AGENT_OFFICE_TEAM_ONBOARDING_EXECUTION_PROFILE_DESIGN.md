# Agent Office Team Onboarding and Execution Profile Design

Status: `DESIGN_CANDIDATE__PENDING_INDEPENDENT_REVIEW`

Mission: `AGENT_OFFICE_TEAM_ONBOARDING_AND_EXECUTION_PROFILE_POLICY_001`

Design pass: `PRODUCT_SYSTEM_AND_CONTRACT_DESIGN`

Terminal design decision: `ONE_REGISTRY__IMMUTABLE_READINESS_EVIDENCE__DETERMINISTIC_TEAM_AND_PROFILE_PROJECTIONS`

## 1. Product decision and scope

One structured Leo instruction to a responsible Advisor can plan onboarding for
every currently registered Actor assigned to that Advisor's Team. The Advisor
entrypoint resolves the Team from the existing Organization Registry, emits one
role-specific artifact-backed handoff for each Actor that is missing, stale, or
invalid, and derives readiness only from accepted structured evidence. It does
not send terminal input or activate a transport.

Per-dispatch execution profile selection uses only explicit, reviewed,
Actor-specific capability profiles stored on that Actor's existing registry
row. The selection projection chooses the lowest-ranked profile whose declared
envelope satisfies the classified WorkUnit. A current tmux/model observation
proves only the profile observed for that run; it never expands the Actor's
supported catalog.

This design adds no second registry, mutable readiness flag, model-wide default,
terminal-prose parser, arbitrary command path, database, secret path, remote
lookup, or delivery transport. It grants no runtime implementation or live Team
rollout.

## 2. Confirmed baseline facts

Direct inspection at product base
`50124a1ea720e162e906c04c6f6fb2591c4974b8` confirms:

1. `src/application/organization/registry.ts` is the single committed
   Organization Registry and `types.ts` is its type authority.
2. `roleInstanceId` is the immutable registry/runtime/evidence join key;
   `actorId` is the current unique routable identity.
3. `partitionRegistry()` already drops invalid or duplicate identities and
   reports fail-closed diagnostics.
4. accepted evidence already follows immutable identity, content reference,
   acceptance, source-event, effective-time, deduplication, conflict, and
   deterministic-selection discipline.
5. current registry rows expose shared `allowedModels` and `allowedEfforts` token
   sets. Those sets validate observations; they are not proof that each Actor
   supports every listed value. No mode or skill capability catalog exists.
6. no `PROTOCOL_READY`, readiness invalidation, `TEAM_READY`, onboarding plan,
   or execution-profile selection contract exists.
7. the Team model already makes role categories optional in data. A Team may
   validly contain no Control.
8. root `AGENTS.md` and `CLAUDE.md` already implement the intended concise
   project-entry pattern: project constraints and Team routing point to the one
   central `docs/agent/` authority instead of copying role manuals.

These facts are reused. Existing identity keys, Actor routes, accepted evidence,
runtime work projection, role definitions, and Team relationships are not
redesigned.

## 3. Product model: Space, Behavior, Information, Technology

### 3.1 Space

The canonical system has four logical surfaces, all local and artifact-backed:

- **Organization Registry** — the existing static identity, Team assignment,
  registration lifecycle, and per-Actor capability catalog.
- **Onboarding evidence** — immutable handoff/result/readiness records joined by
  `roleInstanceId`.
- **Team readiness projection** — a deterministic current view of required,
  ready, blocked, stale, and pending Actors for one Advisor Team.
- **Dispatch profile projection** — an immutable decision record selecting one
  sufficient profile, or a closed reason why none can be selected.

No surface is a terminal, message transport, runtime launcher, or authority
grant. Markdown is explanatory evidence only; machine decisions consume exact
structured records.

### 3.2 Behavior

1. Leo addresses one responsible Advisor with a structured Team-onboarding
   instruction.
2. The Advisor entrypoint resolves exactly one current Advisor row and its Team.
3. The planner enumerates registry rows for that Team; it never enumerates role
   categories and never invents a missing role.
4. Current accepted readiness is projected against the explicitly supplied
   canonical protocol commit and version.
5. Already-current Actors receive no handoff. Each remediable missing, stale,
   conflicting, misunderstood, or pending Actor receives exactly one targeted
   handoff plan. Suspension and invalid identity/route/Advisor authority produce
   an explicit no-handoff block instead.
6. The Actor reads exact files, completes structured understanding checks, and
   classifies a bounded synthetic rehearsal without executing it.
7. The responsible Advisor accepts or rejects each subordinate's structured
   result; Leo/GPT accepts or rejects the responsible Advisor's own result. No
   Actor accepts its own readiness. Only an accepted pass may produce immutable
   `PROTOCOL_READY` evidence.
8. `TEAM_READY` is derived only when the responsible Advisor and every current
   Team-assigned, dispatch-relevant Actor are active and current-ready.
9. Before each real dispatch, the responsible Advisor classifies the WorkUnit
   and requests profile selection. The Actor cannot author or alter that choice.

### 3.3 Information

Stable identity and reviewed capability support live in the registry. Changing
readiness lives in immutable evidence. Current Team readiness and dispatchability
are projections. A profile selection record captures one Advisor decision for
one WorkUnit; it is not written back as Actor capability.

Every negative state is explicit: `PENDING_ONBOARDING`, `SUSPENDED`,
`PROTOCOL_NOT_READY`, `TEAM_NOT_READY`, `NO_SUFFICIENT_PROFILE`,
`OPERATIONAL_RETRY_REQUIRED`, and `ACTOR_SELF_PROFILE_OVERRIDE`. No missing
fact is rendered or acted on as ready.

### 3.4 Technology

The later implementation is a small extension of
`src/application/organization/` with pure validation/projection modules and
targeted Vitest contract tests. It adds no package and performs no Git, clock,
filesystem, process, network, tmux, Slack, or database discovery. All current
commit/version values and evidence arrays are explicit caller inputs.

## 4. Single-registry extension

`OrganizationRegistryRow` remains the only Actor record. Add these fields to
each row; do not create a parallel Actor/profile map:

```ts
type ActorRegistrationState =
  | 'PENDING_ONBOARDING'
  | 'ACTIVE'
  | 'SUSPENDED';

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

interface OrganizationRegistryRow {
  // existing fields unchanged
  readonly registrationState: ActorRegistrationState;
  readonly dispatchRelevant: boolean;
  readonly executionCapabilities: readonly ActorExecutionCapabilityV1[];
}
```

Exact validation rules:

- `profileId` is nonblank and unique within one `roleInstanceId`.
- `capabilityRank` is a unique nonnegative safe integer within that Actor. It is
  the only profile ordering authority; model/effort strings are never globally
  ordered.
- model, mode, effort, and every serialized skill are nonblank exact tokens.
  Serialized skill arrays are unique, lexicographically sorted, and nonempty.
  Exact `['NONE']` is the sole serialized representation of an empty skill set;
  it normalizes to `[]` before comparison and may not coexist with a real skill.
  A real-skill profile therefore covers a no-skill requirement, while a
  `['NONE']` profile cannot cover any real-skill requirement.
- the profile model and effort must be members of that row's existing
  observation-validation token sets. Membership alone does not create a
  profile.
- capability limit values use the closed ordered vocabularies in §8. A value is
  supported only when an exact profile declares it.
- no shared default capability list may be spread across rows. A helper may
  validate a row but may not silently supply profiles.
- `PENDING_ONBOARDING` and `SUSPENDED` Actors are never mission-dispatchable.
  `PENDING_ONBOARDING` may receive only a committed onboarding/reload handoff.
- `dispatchRelevant` is reviewed registry policy, not role inference. An active
  row marked relevant participates in `TEAM_READY`; a role category with no row
  creates no requirement.

The existing Organization Frame remains a presentation projection. Its
`canReceiveWork` value must not be treated as sufficient dispatch authority.
The new readiness projection owns `canDispatch`; every dispatch entrypoint must
require it.

## 5. Evidence and projection topology

```text
existing Organization Registry (A)
  roleInstanceId + actorId + role/Team/routes
  registration state + dispatch relevance
  Actor-specific execution-capability profiles
                 |
                 | join only on roleInstanceId
                 v
immutable onboarding/readiness evidence (R)
  PROTOCOL_READY / PROTOCOL_NOT_READY
                 |
                 | explicit current protocol commit + version
                 v
Team readiness projector
  TEAM_READY | TEAM_NOT_READY + closed diagnostics
                 |
                 | responsible-Advisor-only dispatch request
                 v
execution profile selector
  immutable selection | closed rejection
```

The existing runtime projection and process/model observations are read-only
supporting evidence. They may confirm that a selected profile is presently
running; they never add a capability, readiness decision, Team member, or route.

## 6. Responsible-Advisor entrypoint and Team resolution

The pure `planTeamOnboarding()` input contains the instruction ID, initiating
Actor identity, target `advisorTeam`, exact registry commit, current canonical
protocol commit/version, required-file manifest, registry rows, readiness
evidence, and invalidations. It accepts no terminal command or free-form routing
instruction.

Resolution is deterministic:

1. normalize the registry with the existing drop-all duplicate rules;
2. resolve the initiating `actorId` to exactly one accepted row;
3. require that row's role is `ADVISOR`, its Team equals the requested Team, and
   it is the unique responsible Advisor named by every accepted subordinate
   route for that Team. Resolve membership regardless of lifecycle so a pending
   or suspended Advisor remains required/non-ready; lifecycle independently
   controls whether any handoff authority is lawful;
4. form the candidate member set from accepted rows whose `advisorTeam` equals
   that Team;
5. form the required set from the responsible Advisor plus every member with
   `dispatchRelevant === true`; include every matching row, regardless of role;
6. sort all Actor outputs by `roleInstanceId` using bytewise lexical order.

Zero Control rows is valid. Two or more Workers are two separate required Actors
when both are dispatch-relevant. Duplicate identities, multiple responsible
Advisors, unresolved routes, or an unassigned initiating Actor fail closed.

Planning is total without pretending every block is curable by onboarding. For
each required non-ready Actor, the planner selects its highest-precedence closed
diagnostic and emits exactly one of `HANDOFF_PLANNED`,
`NO_HANDOFF_LIFECYCLE_BLOCKED`, `NO_HANDOFF_AUTHORITY_BLOCKED`, or
`NO_HANDOFF_INPUT_BLOCKED`. Only the first disposition contains a handoff and an
`OnboardingReason`. A suspended Actor remains required and non-ready but receives
no handoff until a separately reviewed reactivation. A missing/conflicting
responsible Advisor, invalid Actor identity, unresolved route, or unattributable
evidence conflict produces an explicit blocked result with no handoff. An
invalid/missing planner binding rejects the planner input with no plan or
handoff. The planner never fills an Advisor ID from a rejected row or attributes
a handoff to invalid authority.

## 7. Role-specific onboarding and targeted reload

The committed `RoleOnboardingHandoffV1` is generated from structured inputs and
contains no executable command. It fixes:

- target `roleInstanceId`, current `actorId`, role, Team, and responsible
  Advisor;
- reason: `INITIAL`, `PROTOCOL_STALE`, `MISUNDERSTANDING`,
  `READ_SET_CHANGED`, `REGISTRATION_PENDING`, or `EVIDENCE_CONFLICT`;
- exact registry commit and current protocol commit/version;
- exact normalized required repository-file references;
- exact universal and role-specific understanding-check IDs;
- one bounded read-only rehearsal version and expected structured answer shape;
- exact return artifact path and return target: responsible Advisor for a
  subordinate, or `leo-gpt` for the responsible Advisor's own onboarding;
- allowed action `READ_AND_CLASSIFY_ONLY`; and
- explicit prohibitions on implementation, terminal input, transport, secret,
  remote, DB, self-review, profile override, dispatch, and next-mission choice.

Common required reads are root `AGENTS.md`, root `CLAUDE.md`,
`docs/agent/TEAM_OPERATING_MODEL.md`, `docs/agent/roles/README.md`, the matching
role document, and the central onboarding/profile policy documents created by
the later implementation. Worker additionally reads `RUN_PROTOCOL.md` and
`RESULT_REPORTING_PROTOCOL.md`. Project-specific root pointers are included as
exact file references; copied role manuals are forbidden.

Universal structured checks prove identity-vs-session separation, authority
source, responsible-Advisor routing, exact scope, prohibitions, STOP behavior,
readiness-vs-runtime separation, and no self-profile override. The role check
adds exactly one authority-specific proof:

- Advisor: routes/audits and never implements or independently reviews;
- Control: coordinates bounded contracts and never implements;
- Designer: designs and never implements runtime;
- Worker: executes only an exact handoff and never self-reviews;
- Reviewer: remains independent/read-only and never patches or approves.

The rehearsal presents a fixed synthetic handoff. The Actor returns structured
classifications for authority source, allowed paths/actions, forbidden actions,
return target, and STOP conditions. No shell, file write, network, or delivery
action is performed. Any missing/wrong answer produces no ready evidence and
only that Actor receives a targeted re-onboarding plan.

Targeted onboarding is limited to remediable states defined by the closed
diagnostic-to-action table in contract §8. Suspension is a lifecycle block, not
an onboarding reason. Missing/conflicting Advisor authority, invalid routing or
identity, and unattributable input are authority/input blocks. They preserve the
`TEAM_NOT_READY` result but produce no handoff until a separate reviewed change
restores lawful identity, route, lifecycle, or authority.

## 8. Per-dispatch requirement and profile selection

The Advisor classifies every WorkUnit with these closed ordered values:

```text
TaskComplexity: LOW < MEDIUM < HIGH < EXTREME
RiskLevel: LEVEL_0 < LEVEL_1 < LEVEL_2 < LEVEL_3 < LEVEL_4
FailureCost: LOW < MEDIUM < HIGH < CATASTROPHIC
Reversibility: EASY < BOUNDED < DIFFICULT < IRREVERSIBLE
ContextRequirement: SMALL < MEDIUM < LARGE < XLARGE
```

The requirement also names the exact required mode and serialized skill tokens.
Exact `['NONE']` is the only no-skill serialization and normalizes to the empty
set before subset comparison. A real-skill profile satisfies that empty
requirement. A `['NONE']` profile normalizes to empty and cannot satisfy a real
skill requirement. Mixed `NONE` plus real-skill arrays are invalid on both
requirements and profiles.

Selection is a pure function:

1. require an active, current-ready responsible Advisor as requester;
2. resolve exactly one target registry row in the same Team;
3. reject when requester equals target (`SELF_PROFILE_OVERRIDE_REJECTED`);
4. require target `registrationState === ACTIVE`, `dispatchRelevant === true`,
   and current `canDispatch === true`;
5. validate every target capability profile; any malformed/duplicate catalog
   fails the selection rather than dropping a convenient profile;
6. retain profiles whose declared limits meet or exceed all five requirement
   dimensions, whose mode equals the required mode, and whose normalized skill
   set covers the normalized required-skill set;
7. sort retained profiles by `capabilityRank`, then `profileId`; select the
   first; and
8. emit one immutable decision record with the complete Founder classification,
   selected values, exact lower-profile rejection reasons, higher-profile
   non-selection reason, and escalation policy.

No algorithm parses `xhigh`, `max`, `ultra`, a model name, or an effort string
to infer order. Scenario profiles bearing those strings must carry explicit
ranks and envelopes on that Actor's row.

### 8.1 Retry and escalation

- Every initial dispatch and retry is an immutable attempt. Attempt 1 binds the
  exact selection, selected profile, and canonical Actor-catalog snapshot;
  attempt 2 additionally binds attempt 1 and the one accepted triggering
  `OPERATIONAL_FAILURE`. No attempt number above 2 is valid.
- Every outcome binds one exact attempt ID and number. Identical same-ID replay
  collapses; a same-ID collision, multiple outcomes for one attempt, conflicting
  outcomes, an ambiguous attempt chain, or a second retry fails closed.
- `OPERATIONAL_FAILURE` (offline/session unavailable/tool launch failure) permits
  at most one new Advisor-authored attempt 2 referencing the original selection
  and exact same profile. It does not justify a higher profile.
- `CAPABILITY_INSUFFICIENT` must be accepted structured evidence tied to the
  exact selection, attempt, and WorkUnit. A new selection binds that exact
  outcome ID, its superseded selection, and the original selection's immutable
  Actor-catalog snapshot. Escalation is blocked if the current target catalog no
  longer hashes to that snapshot; a profile added after the original selection
  is never eligible. The selector chooses only a higher, already-declared,
  independently sufficient profile from the original snapshot and never edits
  the Actor catalog.
- if no declared higher profile is sufficient, selection returns
  `NO_SUFFICIENT_PROFILE` to the Advisor. It never invents `ultra` support.
- replayed/repeated escalation planning, duplicate/conflicting trigger outcomes,
  or more than one selection superseding the same selection fails closed.
- the Actor may report evidence but cannot request, author, or apply its own
  profile change.

### 8.2 Reviewer sufficiency

`dispatchKind` is closed as `WORK | INDEPENDENT_REVIEW`. Review is not a caller
boolean and cannot be disabled: every target registry row whose role is
`REVIEWER` requires `INDEPENDENT_REVIEW`, and every `INDEPENDENT_REVIEW` target
must be a Reviewer. The requirement references one immutable independent-review
assignment sourced from the exact committed responsible-Advisor review handoff.
That assignment contains a nonempty reviewed-subject manifest and a sorted,
unique reviewed-Actor ID list that must equal exactly the set of subject
producer IDs. Missing, empty, partial, extra, duplicate, false/legacy-waiver, or
self-overlapping scopes reject the dispatch.

A valid review dispatch additionally requires current readiness proving the
Reviewer authority check, a non-conflicting `roleInstanceId`, `actorId`, and
session from the Advisor and every reviewed Actor, exact assignment/target/Team/
route agreement, and a profile whose envelope is sufficient for the review's
complexity/risk/failure/context classification. Assignment/results still route
through the responsible Advisor; judgment remains independent. Missing
authority separation or profile sufficiency blocks review dispatch.

## 9. New-Actor lifecycle

1. **Nomination:** Leo names a proposed role and Team. A nomination is not a
   registry row and grants no route, session, capability, or dispatch.
2. **Reviewed registration:** an exact Advisor-routed Worker change adds one new
   row with a fresh never-reused `roleInstanceId`, unique `actorId`, explicit
   Team/routes, `PENDING_ONBOARDING`, explicit `dispatchRelevant`, and an
   independently reviewable per-Actor capability catalog. No catalog value is
   inferred from the nomination or current process.
3. **Pending onboarding:** the Actor is non-dispatchable and may receive only
   its structured onboarding handoff. A pending dispatch-relevant Actor blocks
   `TEAM_READY`; a pending non-relevant Actor does not silently become required.
4. **Readiness:** accepted understanding/rehearsal evidence yields current
   `PROTOCOL_READY` for that `roleInstanceId`; it does not itself mutate the
   registry.
5. **Reviewed activation:** a second reviewed registry commit changes only the
   Actor's registration state to `ACTIVE`. The projector rechecks current
   readiness and Team routes. Only then can `canDispatch` become true.

Suspension is a reviewed registry change and immediately blocks dispatch.
Reactivation repeats current readiness validation; it is never automatic.

## 10. Central project entry-pointer contract

Each participating project root keeps concise `AGENTS.md` and `CLAUDE.md`
pointers. They name the project, responsible Advisor Actor/Team, participating
Actors or resolution rule, return path, project-specific constraints, central
Agent Office authority paths, and the rule that the current canonical protocol
commit/version comes from the exact Advisor handoff. They do not copy common
role or onboarding manuals and do not pin capability catalogs.

The central authority remains under Agent Office `docs/agent/`. A project
pointer cannot activate an Actor, select a profile, establish readiness, or
fetch authority remotely. Missing/unavailable/mismatched central authority
fails closed. This mission defines the contract centrally and makes no edit to
Foundation, SIASIU, Cosmile, VibeNews, or any other project.

## 11. Handoff requirement traceability

| Handoff design requirement | Settled contract surface |
|---|---|
| 1. Reused components and smallest delta | §§2, 4-5; WorkUnit plan closed twenty-one-path future implementation allowlist |
| 2. Actor-specific model/mode/effort/skill representation | §4 per-row `executionCapabilities`; contract §3 |
| 3. Immutable `PROTOCOL_READY` joined by `roleInstanceId` | §5; contract §§6-7 |
| 4. Deterministic `TEAM_READY`, optional roles, conflicts/staleness | §6; contract §§7-8 |
| 5. Responsible-Advisor entrypoint and Team resolution | §6 |
| 6. Role-specific onboarding/reload handoff | §7; contract §5 |
| 7. Understanding validation and bounded read-only rehearsal | §7; contract §§4-5 |
| 8. Targeted re-onboarding | §7; contract §§7-8 |
| 9. New-Actor nomination through activation | §9; contract §12 |
| 10. Lowest sufficient profile, retry, escalation, Reviewer, self-override | §8; contract §§9-11 |
| 11. Central project entry pointer without cross-project edits | §10 |
| 12. Exact WorkUnits, paths, tests, rollback, gates | companion WorkUnit plan §§2-8 |
| 13. Exact twelve Founder validation scenarios | contract §13; WorkUnit `TOEP-WU-05` |
| 14. Frozen external/AS1 surfaces | §12 below; contract §14; WorkUnit plan §§4, 9 |

## 12. Boundary preservation

- AS1 and every Slack design, source, package, setup, manifest, evidence, owner
  action, secret, connection, and activation state remain unchanged.
- No live tmux input, transport creation, automatic handoff delivery, session
  mutation, or runtime rollout is authorized.
- Foundation, SIASIU, Cosmile, and VibeNews code/docs/registries are not edited.
- Existing `roleInstanceId`, `actorId`, Team routes, role authority, Reviewer
  independence, runtime projection, and accepted work evidence remain intact.
- No database/schema/migration, environment value, credential, PII, production
  system, public exposure, remote API, arbitrary command, or terminal-prose
  parser is introduced.

## 13. Confirmed facts, design assumptions, and remaining unknowns

### Confirmed facts

- The existing registry/evidence/projector seams support an additive,
  `roleInstanceId`-joined design.
- Current global model/effort token sets cannot prove Actor-specific capability.
- Current role and Team documents already define the authority checks the
  onboarding system must validate.
- The exact twelve Founder validation scenarios are fixed in the mission
  addendum and are mapped in the companion contract and WorkUnit plan.

### Design assumptions

- Closed task-classification vocabularies and per-Actor numeric ranks are policy
  metadata, not model-name inference.
- `['NONE']` is an explicit serialized sentinel for the empty skill set, so lack
  of a required skill is represented rather than guessed from a missing field;
  comparison always uses the normalized set.
- A reviewed activation commit is required after a new Actor's readiness pass;
  readiness evidence alone never mutates static registration.

### Remaining implementation inputs, not design gaps

- Real supported capability profiles for each current Actor are not proven by
  current runtime observations. A later Worker handoff must name the exact
  Advisor-reviewed per-Actor catalog values or leave that Actor blocked; it may
  not fabricate them from the scenario fixtures.
- The implementation commit that establishes the canonical protocol version and
  file hashes does not yet exist. Tests use fixed synthetic commits; production
  readiness remains false until the exact reviewed commit/version manifest is
  supplied.
- Delivery and live rollout remain separate future authority. This package
  intentionally designs artifact generation and projections only.

## 14. Design completion statement

The architecture is directly implementable within the exact WorkUnits in
`docs/operations/AGENT_OFFICE_TEAM_ONBOARDING_WORKUNIT_PLAN.md` and the exact
schemas/algorithms in
`docs/contracts/AGENT_OFFICE_PROTOCOL_READINESS_CONTRACT.md`.

`RETURN_TO: agent-office-advisor`

This is Designer evidence, not an independent-review verdict, implementation
authorization, risk acceptance, activation approval, or mission closure.

`STOP`
