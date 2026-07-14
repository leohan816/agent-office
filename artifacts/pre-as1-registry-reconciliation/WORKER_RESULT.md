# Pre-AS1 Machine Registry Binding Reconciliation — Worker Result

## Identity

- Mission: `AGENT_OFFICE_PRE_AS1_MACHINE_REGISTRY_BINDING_RECONCILIATION_001`
- Actor: **Agent Office Worker**, existing session `agent-office-opus`
  (verified live; `$16/@16/%16` at preflight), model Opus 4.8 (1M context),
  effort Ultracode, skill `/fable-builder`.
- Repository/worktree (isolated):
  `/home/leo/Project/.worktrees/agent-office/AGENT_OFFICE_PRE_AS1_MACHINE_REGISTRY_BINDING_RECONCILIATION_001`
- Branch: `config/pre-as1-machine-registry-binding-reconciliation-001`
- Implementation baseline: `5df16b311b8e7835b5b621ce2181509a445602c6`
- Pre-work branch HEAD: `abdd6fe` (handoff `6abbb27` + launcher commit;
  base ancestry and handoff SHA-256 `ea26a431…` verified before editing).
- Advisor scope clarification applied: `WORKER_SCOPE_CLARIFICATION_01.md`,
  committed `250252db`, SHA-256 `ace52e72…` (verified).

## Authorized scope

Config-only registry identity migration: separate the immutable internal
identity / evidence join key (`roleInstanceId`) from the unique current routable
Actor identity (`actorId`); migrate the continuing Advisor identity; add
`AGENT_OFFICE_ADVISOR_TEAM`; reconcile Team routing. No product/runtime/transport
behavior, no Slack/AS1.

## Exact changed files (from base `5df16b3`)

Source (organization module):

- `src/application/organization/types.ts` — add `readonly actorId: string` to
  `OrganizationRegistryRow` (documented: `roleInstanceId` = immutable join key,
  `actorId` = routable identity); add `AGENT_OFFICE_ADVISOR_TEAM` to
  `ADVISOR_TEAMS`; add `INVALID_REGISTRY_ACTOR_ID` + `DUPLICATE_REGISTRY_ACTOR_ID`
  to `OrganizationDiagnosticCode`.
- `src/application/organization/registry.ts` — `partitionRegistry` now, after
  the existing `roleInstanceId` acceptance, fails closed on a blank `actorId`
  (`INVALID_REGISTRY_ACTOR_ID`) and on a duplicate `actorId` (drops **every**
  sharing row, `DUPLICATE_REGISTRY_ACTOR_ID`, never first-win/shadow); the
  `ORGANIZATION_REGISTRY` identity migration (9 rows) below.
- `src/application/organization/office-layout-config.ts` — minimal `pod:foundation`
  reconciliation (responsible Advisor → `foundation-advisor-20260714-01`;
  Foundation-only members) so the composed render stays valid.
- `src/application/organization/production-render-input.ts` — add the two new
  diagnostic codes to the frame `DIAGNOSTIC_CODES` allow-set.

Tests (allowed):

- `tests/contract/organization-registry.test.ts` — `row()` helper carries
  `actorId` (defaults to `roleInstanceId`); fixture asserts no actorId
  diagnostics; new suite covers identity lineage, evidence preservation, routing
  by `actorId`, re-parenting, and blank/duplicate `actorId` fail-closed.
- `tests/contract/production-render-input.test.ts` — Foundation pod responsible
  and current-actor assertions updated to the migrated topology.
- `tests/integration/runtime-composition.test.ts` — served livingOffice actor
  count `8`→`9` and `agent-office-worker` team → `AGENT_OFFICE_ADVISOR_TEAM`.

Tests (added to scope by the Advisor clarification — mechanical fixture fix only):

- `tests/ui/actor-detail-drawer.test.tsx`, `tests/ui/actor-summary.test.tsx` —
  each local row builder now sets `actorId` from its immutable `roleInstanceId`
  (`actorId: TARGET`), preserving the trailing override spread. No UI source,
  assertion, snapshot, rendering, label, layout, a11y, or expectation changed.

## Identity migration (ORGANIZATION_REGISTRY, 9 rows)

| roleInstanceId (immutable join key) | actorId (routable) | role | project | advisorTeam | reportsTo/assignedBy/returnsTo | session |
|---|---|---|---|---|---|---|
| `foundation-advisor` (continuing) | `agent-office-advisor` | ADVISOR | AGENT_OFFICE | AGENT_OFFICE_ADVISOR_TEAM | leo-gpt | agent-office-advisor |
| `foundation-advisor-20260714-01` (new) | `foundation-advisor` | ADVISOR | FOUNDATION | FOUNDATION_ADVISOR_TEAM | leo-gpt | foundation-advisor |
| `foundation-control` | `foundation-control` | CONTROL | FOUNDATION | FOUNDATION_ADVISOR_TEAM | foundation-advisor | foundation-control |
| `agent-office-worker` (re-parented) | `agent-office-worker` | WORKER | AGENT_OFFICE | AGENT_OFFICE_ADVISOR_TEAM | agent-office-advisor | agent-office-opus |
| `foundation-reviewer` | `foundation-reviewer` | REVIEWER | FOUNDATION | FOUNDATION_ADVISOR_TEAM | foundation-advisor | foundation-reviewer-sol |
| `cosmile-worker` | `cosmile-worker` | WORKER | COSMILE | FOUNDATION_ADVISOR_TEAM | foundation-advisor | cosmile-worker |
| `siasiu-worker` | `siasiu-worker` | WORKER | SIASIU | FOUNDATION_ADVISOR_TEAM | foundation-advisor | siasiu-worker |
| `vibenews-advisor` (read-only) | `vibenews-advisor` | ADVISOR | VIBENEWS | VIBENEWS_ADVISOR_TEAM | leo-gpt | vibenews-advisor |
| `vibenews-worker` (read-only) | `vibenews-worker` | WORKER | VIBENEWS | VIBENEWS_ADVISOR_TEAM | vibenews-advisor | vibenews-worker |

Route fields carry routable `actorId` values (or external `leo-gpt`), never the
internal join key. `foundation-control`/`foundation-reviewer`/`cosmile`/`siasiu`
route to `actorId` `foundation-advisor` = the **new** Foundation Advisor
(`roleInstanceId` `foundation-advisor-20260714-01`), which is deliberately
distinct from the continuing actor whose internal join key is also
`foundation-advisor` but whose `actorId` is `agent-office-advisor`.

## Required attestations

- All pre-existing `roleInstanceId` values preserved (8/8); none re-keyed,
  transferred, or reused. Only the new key `foundation-advisor-20260714-01` added.
- `ORGANIZATION_EVIDENCE` (`evidence.ts`) **byte-for-byte untouched** (verified
  `git diff` empty vs base); evidence still joins **only** by `roleInstanceId`.
- Old evidence still resolves only to immutable `roleInstanceId`
  `foundation-advisor` (the continuing actor): contract test proves it projects
  `AI_PROCESS_DETECTED` + `AI_READY`.
- New `foundation-advisor-20260714-01` inherits **no** historical evidence:
  contract test proves it projects `SESSION_PROCESS_UNKNOWN`, `AI_RUNTIME_UNKNOWN`,
  `MODEL_UNKNOWN`.
- Exact-delivery and transport files untouched (no `tmux-advisor`, advisor-inbox,
  `config/agent-office.exact-delivery.disabled.example.json`, or transport change).
- VibeNews semantics untouched (only the mechanical `actorId` = existing id added).
- No Slack / AS1 / transport activation, connection, tmux input, server start,
  DB/schema, secret, remote, production, or public action occurred.

## Fail-closed properties (contract §; all satisfied)

1. `roleInstanceId` remains the sole registry/runtime/evidence join key.
2. `actorId` nonblank + unique across accepted rows (contract test).
3. Blank/duplicate `actorId` fails closed with explicit diagnostic; a duplicate
   drops every sharing row (never first-win/shadow) — contract test.
4. Route fields carry routable `actorId` (or `leo-gpt`) — contract test resolves
   each route to a unique row by `actorId`.
5. New Foundation Advisor cannot see/inherit the continuing actor's evidence.
6. Existing `UNASSIGNED` / `canReceiveWork=false` behavior intact (unchanged
   normalization + existing tests still pass).
7. No Reviewer verdict authority granted to any Advisor (registry carries routing
   only; Reviewer role/verdict unchanged).

## Commands / checks

- `tsc --noEmit -p tsconfig.json` — **initial run FAILED** (2 errors): the newly
  required `actorId` reached two out-of-scope UI fixture builders
  (`tests/ui/actor-detail-drawer.test.tsx:59`, `tests/ui/actor-summary.test.tsx:53`).
  Reported to Advisor; Advisor clarification `WORKER_SCOPE_CLARIFICATION_01.md`
  authorized the bounded mechanical fixture fix (keep `actorId` required). After
  the fix, `tsc --noEmit` — **clean (exit 0)**.
- Focused `vitest run` of `tests/contract/organization-registry.test.ts`,
  `tests/contract/production-render-input.test.ts`, and both UI fixture files —
  **111/111 passed** (the two UI files prove the fixture update is
  behavior-neutral).
- Focused `vitest run tests/integration/runtime-composition.test.ts` — **12/13
  passed**. The 1 failure is an **environment limitation of the isolated
  worktree**, not a regression: the trusted-LocalBootstrap subtest requires a
  real sibling `foundation-docs` directory (a separate repository) at the
  worktree-relative path. It is absent (ENOENT), and a symlink is rejected by the
  composition's own security guard (`trusted root must be a non-symlink
  directory`, `src/application/projects/registry.ts:128`). The two registry-data
  assertions I updated (served actor count 9, `agent-office-worker` team) are
  directly exercised and verified by the passing organization-registry +
  production-render-input contract tests over the same `ORGANIZATION_REGISTRY`.
- `eslint` over the exact 9 changed source/test files — **clean (exit 0)**.
- `git diff --check` — **clean**.
- Not run (per handoff): full unit suite, full integration suite,
  product/browser/visual suite, build, dependency audit, unrelated security suite.

## Layout reconciliation note (declared)

Minimal `pod:foundation` repair only; **no new Agent Office office pod** was
introduced (that would be forbidden Living Office visual work and a new
presentation decision beyond the machine-registry scope). Consequence: the Agent
Office Team is fully represented in the registry, but the continuing Agent Office
Advisor and `agent-office-worker` are registry-only and not rendered in a pod.
The Foundation, VibeNews pods and `selectedDefaultPodId` (`pod:foundation`)
remain valid; the composed render stays `NONE` fallback for the two rendered pods.

## Git state

- Base `5df16b3` is an ancestor; branch `config/pre-as1-machine-registry-binding-reconciliation-001`.
- Changed files: the 9 authorized paths above only; forbidden files untouched.
- Node dependencies were provided for validation via a temporary (untracked,
  gitignored, since-removed) symlink to the main checkout's identical-lockfile
  `node_modules`; no tracked file was affected.

## Security / boundary status

- No database, schema/migration, secret/environment, PII, runtime transport,
  tmux input, server start, public, production/live, protected-branch, `main`
  merge/push, or force-push action.
- No agent, sub-agent, delegated context, temporary session, substitute Worker,
  or Reviewer dispatch. No self-review. No next-mission inference.

## Known limitations / residual risk

- The runtime-composition trusted-bootstrap subtest cannot execute in the
  isolated worktree (real sibling `foundation-docs` required; symlink
  security-rejected). Its registry-data assertions are covered by the passing
  contract tests; a full run belongs to an environment with the real
  `foundation-docs` sibling.
- Physical transport identity migration (tmux destinations, activation) remains a
  separate future gate and was not touched.

RETURN_TO: Advisor
PROPOSED_NEXT_ACTOR: Advisor
