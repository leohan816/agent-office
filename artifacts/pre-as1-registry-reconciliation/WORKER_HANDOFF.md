# Exact Advisor Handoff

MISSION_ID: `AGENT_OFFICE_PRE_AS1_MACHINE_REGISTRY_BINDING_RECONCILIATION_001`

STATUS: `AUTHORIZED_FOR_IMPLEMENTATION`

## Exact execution identity

- Actor: Agent Office Worker
- Existing session: `agent-office-opus` (`$16/@16/%16` at preflight)
- Verified runtime: Claude Opus 4.8
- Verified effort: Ultracode
- Required skill: `/fable-builder`
- Repository/worktree:
  `/home/leo/Project/.worktrees/agent-office/AGENT_OFFICE_PRE_AS1_MACHINE_REGISTRY_BINDING_RECONCILIATION_001`
- Branch: `config/pre-as1-machine-registry-binding-reconciliation-001`
- Exact implementation baseline:
  `5df16b311b8e7835b5b621ce2181509a445602c6`
- Remote: the existing `origin`; non-force push of this branch is authorized.
- Return result to: `agent-office-advisor`

Work only in the exact isolated worktree above. The main Agent Office worktree,
the documentation branch, every other repository, and every other tmux session
are outside this handoff.

## Required entry reads

Read directly from this worktree before editing:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/agent/TEAM_OPERATING_MODEL.md`
4. `docs/agent/roles/worker.md`
5. `docs/agent/RUN_PROTOCOL.md`
6. `docs/agent/RESULT_REPORTING_PROTOCOL.md`
7. this committed handoff
8. the current organization implementation and its focused tests
9. `/home/leo/Project/skill/fable-builder/SKILL.md`

Do not use an agent, sub-agent, delegated context, substitute Worker, or another
session. Do not contact or dispatch the Reviewer.

## Founder-approved identity migration

Preserve every existing `roleInstanceId` and every historical evidence join.
No existing `roleInstanceId` may be re-keyed, transferred, or reused for a new
Actor.

Extend `OrganizationRegistryRow` only as narrowly as necessary to separate:

- immutable internal identity and evidence join key: `roleInstanceId`; and
- unique current canonical routable Actor identity: `actorId`.

The exact Advisor identities are:

| Meaning | Immutable `roleInstanceId` | Current routable `actorId` |
|---|---|---|
| Continuing former Foundation Advisor, now Agent Office Advisor | `foundation-advisor` | `agent-office-advisor` |
| Newly created Foundation Advisor | `foundation-advisor-20260714-01` | `foundation-advisor` |

The continuing Actor retains every existing evidence record whose join key is
`foundation-advisor`. The new Foundation Advisor has a new internal key and must
receive none of that historical evidence.

Add `AGENT_OFFICE_ADVISOR_TEAM` to the existing Advisor Team vocabulary.

## Routing clarification

In this mission, current routing means Organization Registry logical routing:

- unique `actorId` resolution;
- `reportsToAdvisor`;
- `assignedBy`;
- `returnsResultTo`; and
- responsible-Advisor resolution within the committed organization data.

Historical and changing evidence continues to join only by `roleInstanceId`.
Do not change evidence joins to `actorId`.

Existing exact-delivery artifacts, fixed tmux destinations, activation schemas,
transport code, and transport configuration remain historical and disabled.
They must not be edited, activated, connected, or reinterpreted as belonging to
the newly created Foundation Advisor. Physical transport identity migration is
a separate future gate.

## Required organization reconciliation

Make the existing machine registry semantically match the already committed
Team model, without inventing another registry or schema family:

- Agent Office Team: responsible Advisor `agent-office-advisor`; project
  `AGENT_OFFICE`; current assigned Agent Office actors route through that
  Advisor.
- Foundation Team: responsible Advisor `foundation-advisor`; projects
  `FOUNDATION`, `SIASIU`, and `COSMILE`; `foundation-control` is an internal
  Control actor and is not a Team leader; current assigned Foundation actors
  route through that Advisor.
- Reviewer assignment and result delivery route through the responsible
  Advisor, while the Reviewer role and verdict remain independent.
- VibeNews is read-only: preserve every existing VibeNews identity, Team,
  project, relationship, session, and evidence value. Adding the required
  `actorId` field with the same existing canonical identifier is the only
  permitted mechanical VibeNews-row change.
- An unassigned or invalidly assigned actor remains fail-closed and cannot
  receive work.

Use the existing committed actor/session facts in
`docs/agent/ACTOR_PROJECT_BINDING_MIGRATION.md` only to reconcile current
bindings. Session names remain runtime bindings, never identity/evidence join
keys and never proof of runtime/model/effort/readiness.

## Required fail-closed properties

1. `roleInstanceId` remains the sole registry/runtime/evidence join key.
2. `actorId` is nonblank and unique across accepted registry rows.
3. Duplicate or invalid `actorId` data fails closed with an explicit diagnostic;
   it must never first-win or silently shadow another Actor.
4. Route fields contain canonical routable Actor identities, not historical
   internal join keys, except external authority such as `leo-gpt`.
5. The newly created Foundation Advisor cannot see or inherit evidence joined
   to the continuing Actor's internal key.
6. Existing `UNASSIGNED` behavior and `canReceiveWork=false` remain intact.
7. No Reviewer verdict authority is granted to any Advisor.

## Allowed source and test files

Edit only files from this list, and only when directly necessary:

- `src/application/organization/types.ts`
- `src/application/organization/registry.ts`
- `src/application/organization/index.ts`
- `src/application/organization/projector.ts`
- `src/application/organization/office-layout-config.ts`
- `src/application/organization/production-render-input.ts`
- `tests/contract/organization-registry.test.ts`
- `tests/contract/production-render-input.test.ts`
- `tests/integration/runtime-composition.test.ts`
- one new focused test under `tests/contract/` only if it keeps the identity and
  routing assertions materially clearer than extending the existing test
- `artifacts/pre-as1-registry-reconciliation/WORKER_RESULT.md`
- `artifacts/pre-as1-registry-reconciliation/WORKER_RESULT_POINTER.txt`

Prefer fewer files. Do not edit a conditionally allowed file merely because it
is listed.

## Files and behavior explicitly forbidden

- `src/application/organization/evidence.ts` and all historical evidence values
- all `src/adapters/gateways/tmux-advisor/` files
- all Advisor Inbox exact-delivery evidence/authority parsers
- `config/agent-office.exact-delivery.disabled.example.json`
- runtime transport, tmux input, capability, lease, activation, or destination
  behavior
- canonical documentation, role documents, project instructions, or the
  current documentation branch
- package/dependency/config changes unrelated to the narrow typecheck
- Slack, AS1, browser dispatch, server start, transport connection, DB, secret,
  credential, public/remote/prod behavior, Hermes, Living Office visual work,
  broad cleanup, or unrelated refactoring
- branch merge, main checkout/push, force push, destructive Git

## Required targeted validation

Run only proportionate checks for the changed identity/registry boundary:

1. focused registry/identity-lineage/routing/uniqueness/UNASSIGNED/evidence-
   preservation tests;
2. the focused committed-layout/parser test only if layout or parser code must
   change to keep the reconciled registry valid;
3. the focused runtime-composition test only if the production organization
   composition boundary changes;
4. TypeScript typecheck because this is a schema change;
5. ESLint only over changed source/test files;
6. `git diff --check`.

Do not run the full unit suite, full integration suite, product/browser/visual
suite, build, dependency audit, or unrelated security suite.

Every failed command and retry must be reported honestly. Do not weaken types,
lint, validation, or tests; do not add suppression directives.

## Completion and Git contract

- Inspect the exact diff from the approved base.
- Stage only exact authorized paths and inspect the staged diff.
- Commit the implementation and result artifacts on the exact branch.
- Push the exact branch non-force.
- Verify local HEAD equals its upstream, the base is an ancestor, and the
  isolated worktree has no remaining staged/unstaged/untracked mission changes.
- Do not merge.

Write the durable Worker result and compact pointer at the exact allowed paths.
The result must include all fields required by
`docs/agent/RESULT_REPORTING_PROTOCOL.md`, plus explicit attestations that:

- all pre-existing `roleInstanceId` values were preserved;
- `ORGANIZATION_EVIDENCE` was byte-for-byte untouched;
- old evidence still resolves only to immutable `roleInstanceId`
  `foundation-advisor`;
- new `foundation-advisor-20260714-01` receives no historical evidence;
- exact-delivery and transport files were untouched;
- VibeNews semantics were untouched;
- no Slack/AS1/transport activation occurred.

Return the pointer to Advisor and STOP. Do not self-review and do not start
another WorkUnit.
