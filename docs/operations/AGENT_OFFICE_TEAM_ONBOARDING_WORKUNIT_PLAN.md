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
7. `docs/architecture/AGENT_OFFICE_TEAM_ONBOARDING_EXECUTION_PROFILE_DESIGN.md`
8. `docs/contracts/AGENT_OFFICE_PROTOCOL_READINESS_CONTRACT.md`
9. `docs/operations/AGENT_OFFICE_TEAM_ONBOARDING_WORKUNIT_PLAN.md`

### New files that may be created

10. `docs/agent/TEAM_ONBOARDING_PROTOCOL.md`
11. `docs/agent/EXECUTION_PROFILE_POLICY.md`
12. `src/application/organization/onboarding.ts`
13. `src/application/organization/readiness.ts`
14. `src/application/organization/execution-profile.ts`
15. `tests/contract/protocol-readiness.test.ts`
16. `tests/contract/execution-profile-selection.test.ts`
17. `tests/contract/team-onboarding-founder-scenarios.test.ts`
18. `artifacts/team-onboarding-execution-profile-policy/WORKER_RESULT.md`
19. `artifacts/team-onboarding-execution-profile-policy/WORKER_RESULT_POINTER.txt`

Any implementation need outside these nineteen paths returns to the Advisor for
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
  runtime/server/adapters/UI/PWA files, fixtures outside the named tests, or
  visual baselines;
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
- exact `PROTOCOL_READY`, not-ready, `TEAM_READY`, requirement, and selection
  record shapes;
- lowest-sufficient, operational retry, capability escalation, Reviewer
  sufficiency, and self-override rules;
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

Implementation requirements:

1. add the exact closed vocabularies and `ActorExecutionCapabilityV1` from the
   contract;
2. add exactly `registrationState`, `dispatchRelevant`, and
   `executionCapabilities` to `OrganizationRegistryRow`;
3. validate lifecycle, unique profile IDs/ranks, token shapes, ordered skills,
   `NONE`, capability limits, and model/effort membership;
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

The later handoff must include an exact table of all current row lifecycle,
dispatch relevance, and any nonempty capability profiles. Missing real catalog
evidence is not permission to guess.

Targeted tests:

- all baseline identity/route values and evidence joins preserved;
- duplicate/invalid profile ID/rank, unsorted/duplicate/mixed-`NONE` skills,
  invalid limits, and model/effort outside row allowed tokens fail closed;
- shared allowed token lists alone yield no capability profile;
- empty explicit catalog is valid but selects nothing; and
- pending/suspended lifecycle remains non-dispatchable in the new policy.

Gate: existing `organization-registry.test.ts` behavior remains green plus new
registry assertions; no edit to existing evidence/projector modules.

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
projectActorProtocolReadiness
projectTeamReadiness
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
- one targeted handoff per non-ready required Actor, none for current-ready
  Actors; and
- output/diagnostic arrays use the contract's stable deterministic order.

Targeted unit cases include schema unknown/missing keys, malformed identifiers,
file normalization and exact-set mismatch, wrong Advisor acceptance, actor
contract drift, explicit commit/version drift, dedup/collision, simultaneous
ready/not-ready conflict, later re-onboarding, route conflict, pending/suspended,
zero-Control, multiple Workers, and one-blocked-member aggregation.

Gate: no mutable `TEAM_READY`/Actor-ready field in registry; no second store;
every decision reproduces under input permutation.

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
validateActorExecutionCapabilities
selectExecutionProfile
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
  required skill subset;
- sorting uses explicit `(capabilityRank, profileId)` only;
- selection record includes every Founder field and exact structured
  `whyNotLower`, `whyNotHigher`, and escalation data;
- operational failure permits one same-selection/profile retry only;
- accepted capability-insufficiency evidence may exclude the demonstrated
  profile and select the next already-declared sufficient candidate;
- target-authored profile request fails before any record is emitted; and
- Reviewer selection requires role, Actor/session separation, current Reviewer
  understanding check, route, and profile sufficiency independently.

Targeted unit cases cover every rejection reason, deterministic tie behavior,
invalid entire catalog, no sufficient profile, operational failure vs capability
failure, missing escalation evidence, undeclared higher capability, self
override, and Reviewer authority/profile separation.

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
  tests/contract/team-onboarding-founder-scenarios.test.ts
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

Gate: all twelve named cases plus targeted/unit/type/lint/build checks pass with
accurate counts; a static changed-path assertion proves the closed allowlist;
no package/lock/config/baseline changes.

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

1. the nineteen-path closed allowlist is exact and no forbidden path changed;
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
   exact;
8. new-Actor nomination/registration/pending/onboarding/activation remains
   reviewed and non-dispatchable until every gate passes;
9. selection records contain all Founder fields and choose lowest sufficient;
   operational retry, capability escalation, self-override, and Reviewer
   sufficiency match the frozen contract;
10. exactly FVS-01..FVS-12 pass with their expected outcomes;
11. targeted tests, lint, typecheck, unit suite, build, and diff checks pass;
12. AS1, Slack, tmux delivery, Foundation, SIASIU, Cosmile, VibeNews, package
    files, runtime/UI, and external systems remain unchanged;
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

AS1, Slack, live tmux delivery, Agent Office runtime/UI/PWA, Foundation, SIASIU,
Cosmile, VibeNews, all external project entry files, secrets, owner setup,
packages, and production/live systems remain unchanged by this design and by
the bounded implementation plan.

`RETURN_TO: agent-office-advisor`

This plan grants no implementation, review, dispatch, risk-acceptance,
activation, final-approval, or next-mission authority.

`STOP`
