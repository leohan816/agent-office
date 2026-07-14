# Actor / Project Binding — Migration and Authority Record

Status: `ACTIVE`

Mission: `AGENT_OFFICE_ACTOR_PROJECT_BINDING_NORMALIZATION_001`
(documentation-only role/relationship normalization).

This record documents the normalization. It assigns roles and relationships and
records the actor-runtime normalization the Advisor performed during the mission;
it implements no product runtime behavior, transport authority, delivery, schema,
or Slack.

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
- **Accidental top-level role folders removed.** The accidental top-level role
  folders `agent-office-advisor`, `agent-office-reviewer`, `foundation-advisor`,
  and `foundation-designer` (sibling directories under `/home/leo/Project/`) are
  now directly observed absent, while `agent-office`, `foundation-control`,
  `FOUNDATION`, `SIASIU`, and `Cosmile` remain. Their useful role content was
  durably preserved beforehand in foundation-docs commit
  `076f0f4f7594ada02759f76c8239877dc99a100c` (role instructions, README, and
  templates under `advisor/_system/roles/`), and the mission intake
  (`advisor/jobs/20260714_agent_office_actor_project_binding_normalization_001/00_INTAKE.md`)
  records the folders as empty after that content preservation. Durable content
  preservation (the committed `076f0f4` evidence) and the current folder absence
  (direct path check) are distinct facts.

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

Agent Office `docs/agent/` is the current authority for Team, Actor, role,
authority, routine, onboarding, dispatch, and tmux/runtime-binding rules.
`foundation-docs` is evidence, history, audit, migration, and pointer storage
only; the historical session registry
`foundation-docs/advisor/_system/tmux_transport/SESSION_REGISTRY.md` is retained
as evidence, not as current role or runtime authority.

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
must be verified before any dispatch. Canonical workspaces are project
repositories or authorized mission worktrees, never role-named folders:

| Actor / role | tmux session | Canonical workspace |
|--------------|--------------|---------------------|
| Agent Office Advisor | `agent-office-advisor` | `/home/leo/Project/agent-office` or an authorized Agent Office mission worktree |
| Agent Office Worker | `agent-office-opus` | `/home/leo/Project/agent-office` or a mission worktree under `/home/leo/Project/.worktrees/agent-office/<MISSION>` |
| Agent Office Designer | `agent-office-designer` | `/home/leo/Project/agent-office` or an authorized Agent Office mission worktree |
| Agent Office Reviewer | `agent-office-reviewer` | `/home/leo/Project/agent-office` or an authorized Agent Office mission worktree |
| Agent Office SOL (preserved) | `agent-office-sol` | `/home/leo/Project/agent-office` |
| Foundation Advisor | `foundation-advisor` | the exact mission target among `/home/leo/Project/FOUNDATION`, `/home/leo/Project/SIASIU`, `/home/leo/Project/Cosmile` (idle/default `/home/leo/Project/FOUNDATION`) |
| Foundation Designer | `foundation-designer` | the exact active Foundation-Team project or its mission worktree (idle/default `/home/leo/Project/FOUNDATION`) |
| Foundation Control | `foundation-control` | `/home/leo/Project/foundation-control` |
| Foundation Worker(s) | `foundation` / `siasiu` / `cosmile` | `/home/leo/Project/FOUNDATION` / `/home/leo/Project/SIASIU` / `/home/leo/Project/Cosmile` |
| Foundation Reviewer | `foundation-reviewer-fable5` | the exact reviewed Foundation-Team project or its mission worktree |

Durable Advisor artifacts and role results live under `foundation-docs/advisor/`
and `foundation-docs/runs/`, per the Advisor role document.

### Final observed runtime bindings (mission close)

During mission completion the Advisor normalized live actor paths and
recreated/rebound the affected existing actor sessions. The exact per-pane
`pane_current_path` evidence is the committed Advisor observation
`foundation-docs/advisor/jobs/20260714_agent_office_actor_project_binding_normalization_001/58_FINAL_RUNTIME_BINDING_OBSERVATION.md`,
captured with `tmux list-panes -a -F '...#{pane_current_path}...'`. Session and
process names remain non-authoritative for actor, model, effort, readiness, or
work state; the workspace facts below come from that `pane_current_path` capture,
not from session names:

- `agent-office-advisor`, `agent-office-designer`, `agent-office-opus`,
  `agent-office-reviewer`, and the preserved `agent-office-sol` at
  `/home/leo/Project/agent-office`;
- `foundation-advisor` — its tmux container recreated at the already-registered
  session name, resuming its existing Codex thread — and `foundation-designer` at
  `/home/leo/Project/FOUNDATION`;
- `foundation-control` unchanged at `/home/leo/Project/foundation-control`;
- `foundation`, `siasiu`, and `cosmile` at `/home/leo/Project/FOUNDATION`,
  `/home/leo/Project/SIASIU`, and `/home/leo/Project/Cosmile`.

## 5. What Did Not Run

- No Slack implementation, connection, transport, or delivery was started.
- No product / Living Office / browser / visual / full test suite was run.
- No source, test, fixture, schema, registry, DB, secret, environment, remote,
  or production change was made.
- The **initial documentation Worker delta** created, modified, or dispatched no
  tmux session; its session list was read-only evidence of intended bindings.
- **Actor-runtime normalization is not a product/runtime capability change.**
  Later in the completed mission the Advisor normalized live actor paths,
  recreated/rebound the affected existing actor sessions, and routed the
  authorized Worker/Reviewer patch loops (see §4). That actor-runtime
  normalization and authorized tmux routing changed no Agent Office product
  behavior and activated no transport authority, Slack/AS1, DB/schema, secret,
  remote, production, or public capability; those remain unimplemented and
  unactivated.

## 6. Machine Registry Deferral (Pre-AS1)

Existing machine registry actor/Team bindings remain **unchanged** by this
mission. A separate, minimal, config-only machine-registry delta is **mandatory
before** the AS1 Slack Pilot. This mission does not perform that delta and does
not start AS1; Slack remains forbidden here.

## 7. Rollback

Reverting the mission's committed documentation and pointer commits on each
affected branch restores only that committed documentation and those pointers; it
changes no runtime, data, or product surface. It does **not** automatically
recreate the removed top-level role folders or reverse the live tmux/session path
normalization the Advisor performed. A complete operational rollback of that
non-Git state (recreating folders, reversing session/path normalization) would be
separate, manually authorized work; it is neither performed nor authorized by
this record.
