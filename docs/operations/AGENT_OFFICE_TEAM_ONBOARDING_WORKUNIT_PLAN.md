# Agent Office Team Onboarding and Execution Profile Implementation WorkUnit Plan

Status: `DESIGN_CANDIDATE__PENDING_INDEPENDENT_REVIEW`

Mission: `AGENT_OFFICE_TEAM_ONBOARDING_AND_EXECUTION_PROFILE_POLICY_001`

Implementation mode: `FUTURE_BOUNDED_WORKER_HANDOFF__NOT_AUTHORIZED_BY_THIS_DOCUMENT`

## 1. Purpose and execution boundary

This plan converts the approved architecture and readiness contract into a
small, reviewable future implementation. It does not itself authorize source,
test, canonical role-document, or artifact edits. A later exact Advisor Worker
handoff must repeat the literal path allowlist, branch/base, Actor/session,
catalog inputs, checks, result paths, push authority, and STOP rules.

The implementation remains local/static and artifact-backed. It adds pure
registry validation, onboarding/readiness projection, and profile-selection
functions. It does not deliver a handoff, drive tmux, start a server, parse
terminal prose, access Slack, use a secret, query Git/filesystem/network state,
or deploy runtime behavior.

## 2. Dependency graph

```text
TOEP-WU-01 central protocol documents
       |
       v
TOEP-WU-02 one-registry lifecycle + Actor capability schema/data
       |
       v
TOEP-WU-03 onboarding plan + immutable readiness projection
       |
       v
TOEP-WU-04 responsible-Advisor execution profile selector
       |
       v
TOEP-WU-05 exact FVS-01..FVS-12 scenarios + bounded regression gates
       |
       v
TOEP-WU-06 as-built evidence, Worker result, pointer, independent review
```

Dependent units are serialized. No WorkUnit may create a second registry,
readiness store, profile map, or dispatch transport to bypass an earlier unit.

## 3. Closed implementation path allowlist

The complete proposed implementation surface is:

### Existing files that may be modified

1. `docs/agent/TEAM_OPERATING_MODEL.md`
2. `docs/agent/roles/README.md`
3. `src/application/organization/types.ts`
4. `src/application/organization/registry.ts`
5. `src/application/organization/index.ts`
6. `tests/contract/organization-registry.test.ts`
7. `tests/ui/actor-detail-drawer.test.tsx`
8. `tests/ui/actor-summary.test.tsx`
9. `docs/architecture/AGENT_OFFICE_TEAM_ONBOARDING_EXECUTION_PROFILE_DESIGN.md`
10. `docs/contracts/AGENT_OFFICE_PROTOCOL_READINESS_CONTRACT.md`
11. `docs/operations/AGENT_OFFICE_TEAM_ONBOARDING_WORKUNIT_PLAN.md`

### New files that may be created

12. `docs/agent/TEAM_ONBOARDING_PROTOCOL.md`
13. `docs/agent/EXECUTION_PROFILE_POLICY.md`
14. `src/application/organization/onboarding.ts`
15. `src/application/organization/readiness.ts`
16. `src/application/organization/execution-profile.ts`
17. `tests/contract/protocol-readiness.test.ts`
18. `tests/contract/execution-profile-selection.test.ts`
19. `tests/contract/team-onboarding-founder-scenarios.test.ts`
20. `artifacts/team-onboarding-execution-profile-policy/WORKER_RESULT.md`
21. `artifacts/team-onboarding-execution-profile-policy/WORKER_RESULT_POINTER.txt`

Any implementation need outside these twenty-one paths returns to the Advisor for
a new exact handoff. No glob or directory-wide authorization is implied.

## 4. Globally forbidden implementation paths and actions

Forbidden without a later Founder decision and new reviewed design:

- `src/application/organization/evidence.ts` and `projector.ts`; current process,
  model, effort, runtime work, and Organization Frame behavior remain unchanged;
- all existing individual `docs/agent/roles/{advisor,control,designer,reviewer,worker}.md`
  definitions; the system consumes them as authority instead of rewriting them;
- root `AGENTS.md` and `CLAUDE.md`; their current central-pointer pattern is
  already sufficient for Agent Office;
- package manifests, lockfiles, tsconfig, lint config, build config, scripts,
  runtime/server/adapters/UI/PWA source, UI tests other than the two exact §3
  paths, fixtures outside the named tests, or visual baselines;
- every AS1, Slack, exact-delivery, setup/as-built, manifest, token, owner,
  connection, and transport path;
- Foundation, SIASIU, Cosmile, VibeNews, another repository/worktree, or the
  canonical dirty checkout;
- database/schema/migration, environment/secret/credential/PII, public/live/
  production access, tmux input/session mutation, remote API, arbitrary command
  surface, terminal-prose parsing, or automatic Actor dispatch; and
- self-review, risk acceptance, final approval, main/protected-branch change,
  force push, or next-mission selection.

## 5. WorkUnits

### TOEP-WU-01 — Central protocol and project-entry authority

Intent: publish concise canonical operational policy beneath `docs/agent/`
without copying or changing role authority.

Exact paths:

- modify `docs/agent/TEAM_OPERATING_MODEL.md` only to link the two new policies
  and state that readiness/profile selection are structured projections;
- modify `docs/agent/roles/README.md` only to link the common onboarding/profile
  policies; and
- create `docs/agent/TEAM_ONBOARDING_PROTOCOL.md` and
  `docs/agent/EXECUTION_PROFILE_POLICY.md` as implementation-exact versions of
  the frozen design/contract.

Required content:

- one structured responsible-Advisor entrypoint;
- role-specific file/check/rehearsal matrix;
- targeted reload and new-Actor lifecycle;
- exact `PROTOCOL_READY`, not-ready, closed diagnostic, total onboarding-plan,
  `TEAM_READY`, requirement, selection, attempt, and outcome record shapes;
- normalized `NONE`, lowest-sufficient selection, immutable one-retry lineage,
  original-snapshot capability escalation, authoritative independent-review
  assignment, Reviewer sufficiency, and self-override rules;
- concise project root pointer template naming project, Team/Advisor, routes,
  project constraints, central paths, and explicit handoff-supplied current
  commit/version; and
- explicit statement that no external project is edited or auto-fetched.

Tests/checks: Markdown fence/link/path checks, `rg` assertion that no copied role
manual or executable terminal instruction appears, and `git diff --check`.

Gate: central docs agree byte-for-semantics with the frozen contract; individual
role documents and root pointers are unchanged.

Rollback: remove the two new policy files and revert the two link-only edits.

### TOEP-WU-02 — Existing registry lifecycle and per-Actor capabilities

Intent: extend the one existing registry row type with registration state,
dispatch relevance, and explicit Actor-specific capabilities; preserve every
identity key and route.

Exact paths:

- `src/application/organization/types.ts`
- `src/application/organization/registry.ts`
- `src/application/organization/index.ts`
- `tests/contract/organization-registry.test.ts`
- `tests/ui/actor-detail-drawer.test.tsx`
- `tests/ui/actor-summary.test.tsx`

Implementation requirements:

1. add the exact closed vocabularies and `ActorExecutionCapabilityV1` from the
   contract;
2. add exactly `registrationState`, `dispatchRelevant`, and
   `executionCapabilities` to `OrganizationRegistryRow`;
3. validate lifecycle, unique profile IDs/ranks, token shapes, ordered skills,
   exact `['NONE']`-to-empty-set normalization, capability limits, and
   model/effort membership; reject mixed `NONE` plus real skills;
4. keep `roleInstanceId` as sole evidence join and `actorId` as routable identity;
5. preserve all baseline `roleInstanceId`, actorId, role, project, Team, route,
   session, provenance, and existing accepted-evidence fields exactly;
6. set current baseline rows explicitly to `ACTIVE`; do not infer lifecycle from
   role/session/process;
7. set `dispatchRelevant` only from the later handoff's reviewed per-row table;
   no role default; and
8. populate real `executionCapabilities` only from exact per-Actor capability
   evidence named by the later handoff. When no such evidence exists, use the
   explicit empty catalog and let profile selection fail closed. Never copy the
   synthetic xhigh/max/ultra scenario catalog into a real Actor row.

The two authorized UI test files are typed consumers of complete
`OrganizationRegistryRow` literals. Their only permitted implementation delta is
to add these explicit fixture values to each `organizationActor()` registry
literal:

```ts
registrationState: 'ACTIVE',
dispatchRelevant: true,
executionCapabilities: [],
```

They must also assert that the detail drawer still exposes its existing exact 17
ordered facts and that the compact summary still exposes its existing exact nine
facts/accessibility sources and glyph/ring state; no lifecycle/capability field
is added to either current view. They may not make a field optional, add a
default/inference helper, alter a UI component or pixel fixture, change existing
visible behavior, or introduce a nonempty real-Actor catalog.

The later handoff must include an exact table of all current row lifecycle,
dispatch relevance, and any nonempty capability profiles. Missing real catalog
evidence is not permission to guess.

Targeted tests:

- all baseline identity/route values and evidence joins preserved;
- duplicate/invalid profile ID/rank, unsorted/duplicate/mixed-`NONE` skills,
  invalid limits, and model/effort outside row allowed tokens fail closed;
- exact `['NONE']` validates as serialized empty capability while a real-skill
  list remains a real set;
- shared allowed token lists alone yield no capability profile;
- empty explicit catalog is valid but selects nothing;
- pending/suspended lifecycle remains non-dispatchable in the new policy; and
- both typed UI fixture consumers compile and preserve their baseline detail/
  summary outputs after adding all three required fields explicitly.

Gate: existing `organization-registry.test.ts`, `actor-detail-drawer.test.tsx`,
and `actor-summary.test.tsx` behavior remains green plus the new required-field/
preservation assertions; full typecheck passes without optionality, defaults,
or inference; no edit to existing evidence/projector or UI source modules.

Rollback: revert the additive fields/validation/data and related exports/tests;
identity/evidence data return byte-for-semantics to the frozen base.

### TOEP-WU-03 — Onboarding planner and protocol readiness projection

Intent: implement exact structured handoffs, understanding/rehearsal validation,
immutable readiness/invalidation validation, Actor currentness, targeted reload,
and Team aggregation as pure functions.

Exact paths:

- `src/application/organization/onboarding.ts`
- `src/application/organization/readiness.ts`
- `src/application/organization/types.ts`
- `src/application/organization/index.ts`
- `tests/contract/protocol-readiness.test.ts`

Required exported pure functions:

```text
validateCanonicalProtocolInput
validateRoleOnboardingHandoff
validateProtocolUnderstandingResult
validateProtocolReadyEvidence
validateProtocolNotReadyEvidence
validateProtocolReadinessDiagnostic
validateTeamOnboardingPlannerInput
projectActorProtocolReadiness
projectTeamReadiness
resolveOnboardingDiagnostic
planTeamOnboarding
```

Implementation rules:

- exact-key runtime validation with no cast/suppression/unknown-key tolerance;
- existing UUIDv7/canonical UTC patterns reused; exact SHA/Git/path validators
  kept local if no canonical public helper exists;
- file lists normalized and compared as exact sorted sets with hashes;
- evidence replay/collision/conflict follows the existing accepted-evidence
  discipline without modifying its stream;
- explicit current protocol commit/version/manifest and registry commit are
  caller inputs; no Git, filesystem, clock, process, or network read;
- responsibility/Team/member resolution uses the normalized registry only;
- subordinate readiness is accepted only by the responsible Advisor; the
  responsible Advisor's own readiness is accepted only by exact `leo-gpt`, so
  no Actor self-accepts readiness;
- no role-category synthesis; no-Control is valid and multiple rows of one role
  remain distinct;
- pending/suspended/stale/invalidated/conflicting/missing readiness fails closed;
- every non-ready accepted Actor has one explicit primary diagnostic; only the
  contract's closed code/detail pairs validate;
- the contract §8 table maps every primary/global blocking diagnostic to exactly
  one remediable handoff reason or one no-handoff lifecycle/authority/input
  disposition;
- remediable Actors receive one targeted handoff and current-ready Actors receive
  none. Suspended Actors remain required/non-ready but receive no handoff before
  separately reviewed reactivation;
- missing/conflicting/non-active responsible Advisor blocks all handoffs while
  retaining its pending/suspended row in the required/non-ready set; invalid
  identity, route, or unattributable evidence emits its exact no-handoff block
  and never copies authority from a rejected row. Invalid diagnostic pairing or
  missing/conflicting handoff binding rejects the planner input with no output;
  and
- output/diagnostic arrays use the contract's stable deterministic order.

Targeted unit cases include schema unknown/missing keys, malformed identifiers,
file normalization and exact-set mismatch, wrong Advisor acceptance, actor
contract drift, explicit commit/version drift, dedup/collision, simultaneous
ready/not-ready conflict, later re-onboarding, route conflict, pending/suspended,
zero-Control, multiple Workers, and one-blocked-member aggregation. Add a table-
driven case for every valid diagnostic/detail mapping plus invalid cross-pairs;
assert pending/missing/stale/misunderstood states receive their exact handoff,
while suspended, missing/conflicting/non-active Advisor, invalid route/identity,
and unattributable collision return exact no-handoff dispositions. Invalid/
missing binding and invalid code/detail pairing return exact planner-input
rejections. FVS-12 subcases must prove blocked Team status is independent from
whether a lawful onboarding handoff exists.

Gate: no mutable `TEAM_READY`/Actor-ready field in registry; no second store;
every planner decision reproduces under input permutation; no output attributes
a handoff to an invalid or unresolved Advisor.

Rollback: remove the two modules and their exports/tests; registry extension is
inert until WU-04.

### TOEP-WU-04 — Responsible-Advisor profile selection

Intent: implement the exact task requirement, lowest-sufficient profile,
selection evidence, same-profile operational retry, capability-only escalation,
Reviewer sufficiency, and self-override rejection.

Exact paths:

- `src/application/organization/execution-profile.ts`
- `src/application/organization/types.ts`
- `src/application/organization/index.ts`
- `tests/contract/execution-profile-selection.test.ts`

Required exported pure functions:

```text
validateDispatchCapabilityRequirement
validateIndependentReviewAssignment
validateActorExecutionCapabilities
validateActorCapabilityCatalogSnapshot
selectExecutionProfile
validateDispatchAttempt
validateDispatchOutcomeEvidence
validateDispatchLineage
planInitialDispatchAttempt
planOperationalRetry
selectCapabilityEscalation
validateReviewerSufficiency
```

Implementation rules:

- closed ordinal tables exactly match the contract; model/mode/effort strings are
  never parsed or globally ranked;
- requester must be the current responsible Advisor and target must be same-Team,
  active, dispatch-relevant, and current-ready;
- candidate filtering covers all five classified dimensions, exact mode, and
  normalized required-skill subset. Exact `['NONE']` normalizes to empty on both
  sides, mixed `NONE` plus real skill rejects, real-skill profiles satisfy an
  empty requirement, and empty-skill profiles do not satisfy real skills;
- sorting uses explicit `(capabilityRank, profileId)` only;
- selection record includes every Founder field and exact structured
  `whyNotLower`, `whyNotHigher`, escalation data, selected-profile ref, and
  immutable original Actor-catalog commit/hash;
- every initial/retry attempt has one immutable ID/ref and attempt number and
  exactly binds selection, profile, catalog, Actor, mission, and WorkUnit;
- attempt and outcome exact same-ID replay collapses; ID collision, two attempt
  records at one number, broken prior/trigger link, duplicate/conflicting
  outcomes for one attempt, or a second retry fails closed;
- operational failure permits only attempt 2 with the same selection/profile and
  an exact link to attempt 1's sole accepted operational-failure outcome;
- accepted capability-insufficiency evidence must bind one accepted attempt. A
  new selection binds the exact outcome, superseded selection, and original
  catalog snapshot and may select only a higher sufficient profile from that
  snapshot;
- current target catalog hash must equal the original snapshot before
  escalation; any profile addition/removal/change after selection blocks rather
  than becoming eligible. Repeated supersession planning also blocks;
- target-authored profile request fails before any record is emitted; and
- `dispatchKind` is closed; every Reviewer target requires authoritative
  `INDEPENDENT_REVIEW` and a valid assignment from the exact committed Advisor
  review handoff. The later Worker handoff pins the authoritative source commit/
  ref as a separate selector input; the caller requirement cannot supply or
  override it. Its nonempty subject producers must equal the complete sorted
  unique reviewed-Actor list; and
- Reviewer selection rejects legacy true/false waiver shapes, absent/empty/
  partial/extra/duplicate/self-overlapping scope or unresolved Actors, then
  independently requires role, Actor/session separation, current Reviewer
  understanding check, route, and profile sufficiency.

Targeted unit cases cover every rejection reason, deterministic tie behavior,
invalid entire catalog, no sufficient profile, and all `NONE` positive/negative
combinations. Attempt/outcome cases cover identical replay, same-ID collision,
two IDs at one attempt number, wrong binding/acceptor, duplicate and conflicting
outcomes, repeated retry planning, and a second retry. Escalation cases cover
missing/wrong/duplicate trigger evidence, repeated supersession, undeclared
higher capability, and a sufficient profile added after selection (plus removal
and mutation), all of which block. Reviewer cases cover authoritative positive
assignment plus `WORK`/legacy false/legacy true, missing/empty/partial/extra/
duplicate/self-overlapping scopes, unresolved reviewed IDs, wrong assignment
target/route, same Actor/session, wrong role, missing authority check, and
insufficient profile. Self override asserts byte-identical inputs and no output.

Gate: selector is pure and mutation-free; no dispatch/runtime/tmux integration;
input arrays remain deeply equal after every success/failure test.

Rollback: remove the module and exports/tests; no registry/evidence migration or
external rollback exists.

### TOEP-WU-05 — Exact Founder scenarios and bounded regression

Intent: bind the complete policy to exactly the twelve Founder scenarios in one
auditable contract suite.

Exact paths:

- `tests/contract/team-onboarding-founder-scenarios.test.ts`
- only the source/test paths already authorized in WU-02 through WU-04 when a
  failing scenario exposes a conforming implementation defect.

The test file contains exactly twelve top-level scenario cases named:

```text
FVS-01 Team with no Control
FVS-02 Team with multiple Workers
FVS-03 Leo-nominated new Worker
FVS-04 stale protocol commit requiring reload
FVS-05 Actor misunderstanding requiring targeted re-onboarding
FVS-06 xhigh selected when sufficient
FVS-07 max selected immediately when xhigh is insufficient
FVS-08 ultra rejected when max is sufficient
FVS-09 escalation from max to ultra on demonstrated capability insufficiency
FVS-10 Actor self-profile override rejected
FVS-11 Reviewer profile independently sufficient
FVS-12 TEAM_READY blocked when one required Actor is not ready
```

Expected assertions are exactly contract §13. Synthetic scenario capability
catalogs never enter `ORGANIZATION_REGISTRY` production rows.

Required check sequence:

```text
npx vitest run --maxWorkers=1 \
  tests/contract/organization-registry.test.ts \
  tests/contract/protocol-readiness.test.ts \
  tests/contract/execution-profile-selection.test.ts \
  tests/contract/team-onboarding-founder-scenarios.test.ts \
  tests/ui/actor-detail-drawer.test.tsx \
  tests/ui/actor-summary.test.tsx
npm run lint
npm run typecheck
npm run test:unit
npm run build
git diff --check
```

Do not run Living Office visual/E2E, AS1, Slack, transport, owner, broad browser,
or unrelated integration suites unless the actual diff unexpectedly reaches a
forbidden surface; such reach is a STOP requiring a new handoff, not permission
to broaden tests.

Gate: all twelve named cases plus targeted/UI fixture/type/lint/build checks pass
with accurate counts; a static changed-path assertion proves the closed twenty-
one-path allowlist; no package/lock/config/baseline changes.

Rollback: revert scenario/source commits in reverse order. No live state exists.

### TOEP-WU-06 — As-built evidence, result, pointer, and review handoff

Intent: record exact implementation facts without self-review or activation.

Exact paths:

- update the three frozen design/contract/plan documents only with an explicitly
  labeled as-built appendix and actual commit/test facts;
- create
  `artifacts/team-onboarding-execution-profile-policy/WORKER_RESULT.md`; and
- create
  `artifacts/team-onboarding-execution-profile-policy/WORKER_RESULT_POINTER.txt`.

Required evidence:

- exact base, branch, package/result/pointer commits and ancestry;
- exact changed paths, stats, hashes, staged/unstaged/untracked state;
- per-Actor catalog provenance table, including every deliberately empty real
  catalog;
- exact FVS-01..12 and gate outputs with failures/skips;
- exact P1 UI-fixture preservation, P2 diagnostic/planner totality, P3 immutable
  attempt/escalation lineage, P4 non-bypassable review scope, and P5 normalized
  `NONE` evidence;
- no second registry/store, no inferred capability, and explicit current
  protocol input evidence;
- confirmation of no AS1/Slack/tmux/live/external-project/package/config change;
  and
- limitations: no delivery/activation and any Actor still blocked for missing
  capability/readiness evidence.

Commit package, result, then pointer separately; push only the exact approved
feature branch non-force; verify clean upstream equality; return pointer to
Advisor; stop. Independent review is a later Advisor-routed read-only pass.

## 6. Exact dependency and package impact

- New runtime dependencies: none.
- New dev dependencies: none.
- `package.json` / `package-lock.json`: unchanged.
- tsconfig/lint/build config: unchanged.
- persistence/database/schema/migration: none.
- remote/secret/transport/Slack/tmux: none.

All implementation uses existing TypeScript `6.0.3`, Vitest, UUID/time helpers,
and Organization Registry patterns.

## 7. Completion gates

Implementation is ready for independent review only when all are true:

1. the twenty-one-path closed allowlist is exact and no forbidden path changed;
2. every existing `roleInstanceId`, actorId, Team/route/session binding, and
   evidence join is preserved;
3. per-Actor capability catalogs are explicit; no global allowed token list or
   current runtime observation becomes support evidence;
4. real catalog gaps remain explicit empty catalogs and block selection;
5. `PROTOCOL_READY` and invalidation are immutable, exact-key, structured, and
   joined only by `roleInstanceId`;
6. current protocol commit/version/file manifest are explicit inputs and stale
   evidence produces targeted reload;
7. `TEAM_READY` is deterministic and requires the responsible Advisor plus all
   actual dispatch-relevant rows, with zero-Control and multi-Worker behavior
   exact; the total planner emits handoffs only for remediable states and exact
   no-handoff lifecycle/authority/input results for every other block;
8. new-Actor nomination/registration/pending/onboarding/activation remains
   reviewed and non-dispatchable until every gate passes;
9. selection records contain all Founder fields and choose lowest sufficient;
   normalized `NONE`, immutable attempt/outcome chains, one operational retry,
   original-snapshot capability escalation, self-override, and non-bypassable
   Reviewer sufficiency match the frozen contract;
10. exactly FVS-01..FVS-12 pass with their expected outcomes;
11. targeted tests, lint, typecheck, unit suite, build, and diff checks pass;
12. AS1, Slack, tmux delivery, Foundation, SIASIU, Cosmile, VibeNews, package
    files, runtime/UI source, and external systems remain unchanged; the only UI
    test edits are the two exact WU-02 fixture/preservation paths;
13. package/result/pointer commits are separately pushed non-force and verified
    clean/upstream-equal; and
14. an independent Reviewer later inspects the frozen candidate. Worker and
    Designer issue no verdict or approval.

## 8. Rollback and failure isolation

Before any future rollout, rollback is Git-only: revert pointer, result,
as-built/package commits in reverse order or discard the isolated feature
branch under exact Advisor authority. Pure functions hold no mutable state and
have no migration.

At runtime in any later separately authorized integration, absence, conflict,
staleness, invalid schema, catalog insufficiency, or operational ambiguity fails
to no handoff delivery/no dispatch. There is no fallback to name/session
inference, global capability assumptions, a lower Reviewer profile, self
override, or an unreviewed higher profile.

## 9. Explicit unchanged surfaces

AS1, Slack, live tmux delivery, Agent Office runtime/UI/PWA source, Foundation,
SIASIU, Cosmile, VibeNews, all external project entry files, secrets, owner
setup, packages, and production/live systems remain unchanged by this design
and by the bounded implementation plan.

`RETURN_TO: agent-office-advisor`

This plan grants no implementation, review, dispatch, risk-acceptance,
activation, final-approval, or next-mission authority.

`STOP`
