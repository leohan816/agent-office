# Actor / Project Binding — Migration and Authority Record

Status: `ACTIVE`

Mission: `AGENT_OFFICE_ACTOR_PROJECT_BINDING_NORMALIZATION_001`
(documentation-only role/relationship normalization).

This record documents the normalization. It assigns roles and relationships
only; it implements no runtime behavior, transport, delivery, schema, or Slack.

## 1. What Was Cleaned Up

- **Aborted role-named scaffolding.** Earlier exploration risked creating
  role-named top-level folders and a self-contained organization module. Those
  were not accepted evidence and are not part of this mission. The role system
  now lives only in `docs/agent/` (this document set); no `advisor/`,
  `designer/`, `worker/`, `reviewer/`, `control/`, `roles/`, or `.agent-office/`
  top-level folder is used.
- **Aborted untracked source files.** Worker-owned untracked files under
  `src/application/organization/` in the working checkout were removed before
  this mission; they were not copied or adapted. No source, test, fixture,
  schema, or registry code is changed by this mission.

## 2. Canonical Locations

The one common source of the operating model and roles is Agent Office
`docs/agent/`:

- `docs/agent/TEAM_OPERATING_MODEL.md` — the default routine, one-Advisor-per-actor
  rule, folder/actor/role/runtime/worktree distinction, subordinate rules,
  independent-Reviewer routing, onboarding checklist, and dispatch prerequisites.
- `docs/agent/roles/` — one document per role (Advisor, Designer, Worker,
  Reviewer, Control) plus an index.
- `docs/agent/RUN_PROTOCOL.md` and `docs/agent/RESULT_REPORTING_PROTOCOL.md` —
  Worker execution and result evidence.
- Runtime session registry (read-only reference, owned by the Advisor system):
  `foundation-docs/advisor/_system/tmux_transport/SESSION_REGISTRY.md`.

Project roots (`agent-office`, `FOUNDATION`, `SIASIU`, `Cosmile`) carry only a
concise pointer to this common set plus their local Team binding and their own
project rules. Full role definitions are not duplicated into project roots.

## 3. Team Bindings

Two Advisor-led Teams are confirmed (not redesigned):

- **Agent Office Team** — responsible Advisor `agent-office-advisor`; members:
  Agent Office Designer, Agent Office Worker (`agent-office-opus`), independent
  Agent Office Reviewer; project scope `agent-office`; results return to
  `agent-office-advisor`.
- **Foundation Team** — responsible Advisor `foundation-advisor`; members:
  `foundation-designer`, `foundation-control` (internal Control actor, not a
  leader), the Foundation Worker(s) for `foundation`/`siasiu`/`cosmile`, and the
  independent Foundation Reviewer; project scope `FOUNDATION`, `SIASIU`,
  `Cosmile`; results return to `foundation-advisor`.

Authority invariant (both Teams):

```text
Leo/GPT -> responsible Advisor -> subordinate actor -> responsible Advisor -> Leo/GPT
```

The official product name is `SIASIU`.

## 4. Intended tmux / Workspace Bindings

Session names are labels only; the live model, effort, workspace, and readiness
must be verified before any dispatch. Intended bindings (verified present as
directories under `/home/leo/Project/` at record time):

| Actor / role | tmux session | Intended workspace |
|--------------|--------------|--------------------|
| Agent Office Advisor | `agent-office-advisor` | `/home/leo/Project/agent-office-advisor` |
| Agent Office Worker | `agent-office-opus` | `/home/leo/Project/agent-office` (+ mission worktrees under `/home/leo/Project/.worktrees/agent-office/<MISSION>`) |
| Agent Office Designer | `agent-office-designer` | Agent Office design workspace for `agent-office` |
| Agent Office Reviewer | `agent-office-reviewer` | independent review session for `agent-office` |
| Foundation Advisor | `foundation-advisor` | `/home/leo/Project/foundation-advisor` (read scope: `FOUNDATION`, `SIASIU`, `Cosmile`, `foundation-control`, `foundation-docs`) |
| Foundation Designer | `foundation-designer` | Foundation design workspace |
| Foundation Control | `foundation-control` | `/home/leo/Project/foundation-control` |
| Foundation Worker(s) | `foundation` / `siasiu` / `cosmile` | `/home/leo/Project/FOUNDATION` / `/home/leo/Project/SIASIU` / `/home/leo/Project/Cosmile` |
| Foundation Reviewer | `foundation-reviewer-fable5` | independent review session for Foundation scope |

Durable Advisor artifacts and role results live under `foundation-docs/advisor/`
and `foundation-docs/runs/`, per the Advisor role document.

## 5. What Did Not Run

- No Slack implementation, connection, transport, or delivery was started.
- No product / Living Office / browser / visual / full test suite was run.
- No source, test, fixture, schema, registry, DB, secret, environment, remote,
  or production change was made.
- No tmux session was created, modified, or dispatched by this mission; the
  session list above is read-only evidence of intended bindings.

## 6. Rollback

This mission adds documentation and concise root pointers only. Reverting the
mission commits on each affected branch fully restores the prior state; no
runtime, data, or product surface is affected.
