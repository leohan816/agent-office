# Agent Office Designer Result — Team Onboarding and Execution Profile Policy

Status: `DESIGN_READY_FOR_INDEPENDENT_REVIEW`

This status is the handoff result-contract value. It is not an independent
review verdict, risk acceptance, implementation authorization, activation, or
final approval.

## Identity and routing

- Mission ID: `AGENT_OFFICE_TEAM_ONBOARDING_AND_EXECUTION_PROFILE_POLICY_001`
- Design pass: `PRODUCT_SYSTEM_AND_CONTRACT_DESIGN`
- Actor: `Agent Office Designer`
- Existing session: `agent-office-designer` / `$24` / `@24` / `%24`
- Verified pane PID: `1705591`
- Verified launch: `gpt-5.6-sol` / effort `max`
- Selected mode: `BOUNDED_PRODUCT_SYSTEM_DESIGN__NO_RUNTIME_IMPLEMENTATION`
- Required skill: `NONE_REGISTERED_FOR_THIS_DESIGN_ROLE`
- Synchronized panes: `off`
- Repository: `/home/leo/Project/agent-office`
- Worktree:
  `/home/leo/Project/.worktrees/agent-office/AGENT_OFFICE_TEAM_ONBOARDING_AND_EXECUTION_PROFILE_POLICY_001`
- Branch: `feature/team-onboarding-execution-profile-policy-001`
- Remote: `origin` (`https://github.com/leohan816/agent-office`)
- Return to: `agent-office-advisor`
- Proposed next actor: `Agent Office Advisor`

## Authority and input provenance

- Exact base: `50124a1ea720e162e906c04c6f6fb2591c4974b8`
- Designer handoff commit:
  `27077c9026f2c988e573e64abe9722eb329b42ce`
- Handoff path:
  `advisor/jobs/20260715_agent_office_team_onboarding_execution_profile_policy_001/02_DESIGNER_HANDOFF.md`
- Handoff SHA-256:
  `32963c4a8e6ec26e864516c54bb245ea5cba1dcb68191d98acb5bf4bdd1053c5`
- Intake SHA-256:
  `9e478533e2e37da29eaf3960b20eb234ced2c25fd701ba0933ae871495be00b9`
- Advisor brief SHA-256:
  `52b593a1fefcf0390f7c355f82b25b375f9d5766c9964b56bf3f0dbf3e4be7df`
- Run prompt SHA-256:
  `2924b5321a5860c5bd5ee9e5c74bf0f386fb2e94210aadf0d8889c14af36bd21`
- Validation-scenarios addendum commit:
  `358e1fed948575943358393989d9f3b2cae123da`
- Addendum path:
  `advisor/jobs/20260715_agent_office_team_onboarding_execution_profile_policy_001/02A_DESIGN_VALIDATION_SCENARIOS_ADDENDUM.md`
- Addendum SHA-256:
  `aa7f9a7a28287868f2e0f32e0e641c091b73224ce9298f63d2b6e460898b4746`
- Governance worktree was clean/upstream-equal when inputs were recorded; its
  later dispatch-ledger commits changed no product authority or allowed path.

## Commit ledger

| Evidence | Exact commit | State when recorded |
|---|---|---|
| Frozen product base | `50124a1ea720e162e906c04c6f6fb2591c4974b8` | clean isolated branch, no upstream configured |
| Canonical three-document design package | `d9a95cf101fca93f3c721e7d751bcd5d7a2c661a` | direct child of base; committed, non-force pushed, clean, and upstream-equal |
| This durable result | recorded by `DESIGNER_RESULT_POINTER.txt` after this file is committed | pointer binds the immutable result commit without a self-reference |

## Exact authorized and changed paths

The handoff authorized only these five paths:

1. `docs/architecture/AGENT_OFFICE_TEAM_ONBOARDING_EXECUTION_PROFILE_DESIGN.md`
2. `docs/contracts/AGENT_OFFICE_PROTOCOL_READINESS_CONTRACT.md`
3. `docs/operations/AGENT_OFFICE_TEAM_ONBOARDING_WORKUNIT_PLAN.md`
4. `artifacts/team-onboarding-execution-profile-policy/DESIGNER_RESULT.md`
5. `artifacts/team-onboarding-execution-profile-policy/DESIGNER_RESULT_POINTER.txt`

The exact package range `50124a1..d9a95cf` adds paths 1-3 only, with 1,620
insertions and no deletion. Paths 4-5 are the new evidence layer committed
afterward in protocol order.

Package hashes:

- architecture:
  `2bc8c1baebe51e4c1ce8ae5dc49d02ae1bf69b39f4c3742c3ac8fdf608a82ba9`;
- readiness contract:
  `09b863c134c7125110bed9b726fdeb2f4b678f27adf0e06534ab773d69c06398`;
- WorkUnit plan:
  `a2cc9587d4842468e21aab8234e35c63f0c39f8e340aa87b9f172f2497c160ef`.

## Design delivered

The package settles one coherent, directly implementable product system:

1. the current Organization Registry remains the sole Actor registry;
2. each registry row gains reviewed registration lifecycle, dispatch relevance,
   and an explicit Actor-specific capability catalog containing model, mode,
   effort, skill, rank, and capability envelope values;
3. global allowed model/effort tokens and current runtime observations are
   explicitly non-authoritative for capability support;
4. `PROTOCOL_READY` and `PROTOCOL_NOT_READY` are immutable exact-key evidence
   joined only by `roleInstanceId`;
5. `FILES_READ` is an exact, hashed, normalized repository-path set;
6. current protocol commit/version/file manifest is explicit input and never
   inferred from wall-clock age;
7. subordinate readiness is accepted by the responsible Advisor, while the
   Advisor's own readiness is accepted only by Leo/GPT; self-acceptance fails;
8. deterministic `TEAM_READY` requires the responsible Advisor plus every
   actual Team-assigned dispatch-relevant row and creates no absent role;
9. one-instruction planning emits no handoff for a current Actor and exactly one
   targeted structured handoff for each missing/stale/invalid/pending Actor;
10. role understanding uses closed check IDs and a bounded synthetic
    read-only rehearsal with no command/file/network side effect;
11. new Actors follow nomination -> reviewed pending registration -> onboarding
    -> readiness -> reviewed activation, with no dispatch while pending;
12. profile selection records every Founder classification field and chooses
    the lowest sufficient declared profile by Actor-local rank;
13. operational failure permits one same-profile retry; accepted capability
    insufficiency alone permits selection of the next already-declared
    sufficient profile;
14. target-Actor self override is rejected and Reviewer authority separation is
    checked independently from Reviewer profile sufficiency;
15. the central project-entry pointer contract reuses root `AGENTS.md` /
    `CLAUDE.md` without copying role manuals or editing another project; and
16. six exact future WorkUnits provide a closed nineteen-path source/doc/test/
    evidence plan, dependency order, gates, rollback, and STOP conditions.

The pending-to-active registration transition intentionally does not invalidate
readiness when immutable identity/role/Team/routes are unchanged. Registration
state still independently gates dispatch. This avoids both self-activation and
an impossible activation/readiness cycle.

## Exact Founder scenario coverage

Contract §13 and WorkUnit `TOEP-WU-05` bind exactly:

1. Team with no Control -> no synthetic Control requirement;
2. multiple Workers -> each dispatch-relevant Worker required independently;
3. Leo-nominated Worker -> no authority before reviewed pending registration,
   readiness, and activation;
4. stale protocol commit -> stale Actor only receives targeted reload;
5. misunderstanding -> no ready evidence and targeted re-onboarding only;
6. declared xhigh sufficient -> xhigh selected;
7. xhigh insufficient, max sufficient -> max selected immediately;
8. max sufficient -> ultra not selected;
9. accepted max capability insufficiency -> new linked ultra selection only if
   ultra was already declared and sufficient;
10. self-profile override -> closed rejection and no mutation;
11. Reviewer -> separate authority plus independently sufficient profile; and
12. one required non-ready Actor -> `TEAM_NOT_READY` with that exact blocker.

Scenario xhigh/max/ultra catalogs are synthetic fixtures only and cannot be
copied into any real Actor row as capability evidence.

## Checks and outcomes

1. Live runtime binding: PASS — exact existing session, pane IDs, PID, canonical
   workspace, `gpt-5.6-sol`, effort `max`, active pane, and synchronization off
   were inspected directly; no tmux input/mutation occurred.
2. Entry Git gate: PASS — exact isolated worktree/branch at clean base
   `50124a1ea720e162e906c04c6f6fb2591c4974b8`; no initial upstream existed and
   no remote branch existed.
3. Ordered required reads: PASS — root instructions, Team model, role README and
   all five roles, run/result protocols, organization types/registry/evidence/
   projector, registry tests, handoff, intake, brief, and committed addendum were
   read directly. Relevant existing organization contract/index/package build
   surfaces were inspected for exact reuse/planning.
4. Exact package scope: PASS — only the three authorized design documents occur
   in the package range.
5. Handoff traceability: PASS — architecture §11 maps all fourteen design
   objectives to exact contract/plan sections.
6. Scenario cardinality: PASS — contract contains exactly twelve `FVS-01`..
   `FVS-12` rows matching the committed addendum; the WorkUnit plan names exactly
   the same twelve top-level future tests.
7. Markdown/static hygiene: PASS — all three files have even fence counts; no
   adjacent duplicate nonempty line was found.
8. Secret-shaped content scan: PASS — no Slack-token or private-key-shaped value
   occurs in the package.
9. `git diff --check`: PASS before staging, on the staged package, and across the
   exact base-to-package range.
10. Explicit staging: PASS — staged names/stat/complete per-file diffs contained
    only the three authorized package paths.
11. Package commit/push: PASS —
    `d9a95cf101fca93f3c721e7d751bcd5d7a2c661a` is a direct child of the exact
    base, non-force pushed, and verified against local upstream and remote head.
12. Product tests, lint, typecheck, build, dependency installation, server,
    runtime, browser/visual suite, AS1/Slack, owner setup, and live transport:
    NOT RUN BY DESIGN — no source/package/runtime changed and the handoff permits
    only document/path/diff checks.

One orchestration-only JavaScript syntax error occurred while composing a
parallel static-check invocation. No shell command ran and no repository state
changed. The corrected static checks were rerun successfully; there was no
hidden test or validation failure.

## Confirmed facts, assumptions, and remaining unknowns

### Confirmed

- the existing registry and evidence patterns support this additive design
  without changing immutable identity or creating another store;
- current allowed-token arrays are shared and insufficient as per-Actor support
  evidence;
- roles are data-driven/optional and current Team authority already separates
  Advisor, Designer, Worker, Reviewer, and Control; and
- the current project-entry pattern already points to central role authority.

### Assumptions fixed as design policy

- explicit Actor-local rank orders that Actor's profiles; no model/effort name
  has global order;
- `NONE` is the explicit no-skill token;
- lifecycle and dispatch relevance are reviewed registry facts, while readiness
  remains changing evidence/projection; and
- the responsible Advisor is always a required Team Actor even when a registry
  dispatch-relevance flag is false.

### Remaining implementation inputs/limitations

- real supported capability profiles for current Actors are not established by
  this design. A later exact handoff must supply reviewed per-Actor values or
  preserve explicit empty catalogs and blocked selection;
- the final canonical protocol commit/file hashes arise only from a later
  reviewed implementation commit;
- no onboarding evidence for a real Actor was minted and no Team is represented
  as ready by this design package;
- no handoff was delivered automatically and no transport/live rollout was
  activated; and
- independent design review, Advisor acceptance, Worker implementation,
  independent implementation review, risk acceptance, final approval, and
  mission closure remain future gates.

## Forbidden and excluded work

Confirmed untouched/not performed:

- runtime source, tests, existing role/Team/registry/evidence/projector files,
  package/lock/config/build/lint files, UI/PWA, visual baselines, and prior
  evidence;
- AS1, Slack, exact delivery, setup/as-built, manifests, owner actions, tokens,
  secrets, connections, and activation;
- Foundation, SIASIU, Cosmile, VibeNews, another repository/worktree, or
  cross-project root pointers;
- database/schema/migration, environment/credential/PII, public/live/production
  system, remote API, server start, arbitrary command path, terminal-prose
  parser, or tmux input/session mutation;
- agents, sub-agents, delegated contexts, substitute Actors, or new sessions;
  and
- self-review, Reviewer verdict, risk acceptance, final approval, main/
  protected-branch change, force push, Actor dispatch, or next mission.

This policy/contract design is non-visual. Full-size mockup paths, dimensions,
and visual inspection are `NOT_APPLICABLE`; no visual artifact was created or
claimed.

## Rollback

Under a new exact Advisor authorization, revert pointer and result commits in
reverse order, then revert package commit
`d9a95cf101fca93f3c721e7d751bcd5d7a2c661a` and non-force push the feature
branch. No external rollback is required because no runtime, data store, Slack,
tmux, secret, owner, or external project state changed.

## Result paths and STOP

- Durable result:
  `artifacts/team-onboarding-execution-profile-policy/DESIGNER_RESULT.md`
- Pointer:
  `artifacts/team-onboarding-execution-profile-policy/DESIGNER_RESULT_POINTER.txt`

`RETURN_TO: agent-office-advisor`

`PROPOSED_NEXT_ACTOR: Agent Office Advisor`

No next actor was dispatched.

`STOP`
