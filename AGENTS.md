# Agent Office Repository Instructions

Status: `ACTIVE`

Scope: this file applies to the entire repository.

## Actors and Authority

- This repository is a shared canonical workspace for the Agent Office Team. The
  Agent Office Advisor, Designer, Worker, and independent Reviewer may all
  operate here; this file applies to whichever authorized actor is active, not
  only the Worker.
- Actor and role are established by role, never by the session name alone. A
  session name proves none of actor, role, model, effort, readiness, or
  authority.
  - **Advisor entry:** active Advisor authority comes from a Leo/GPT mission or
    decision plus verified actor/runtime binding and `docs/agent/roles/advisor.md`.
  - **Subordinate entry (Designer, Worker, Reviewer, Control):** authority comes
    from an exact committed Advisor handoff plus verified actor/runtime binding
    and the matching role document under `docs/agent/roles/`.
  - Any disagreement between the mission/handoff, the verified runtime binding,
    and the role document fails closed to the responsible Advisor — or to Leo/GPT
    when the active actor is the Advisor.
- Role separation is fixed and does not expand:
  - the **Advisor** routes, selects, and audits, but does not implement or
    review its own Team's work;
  - the **Designer** designs only within an exact handoff and does not implement
    runtime;
  - the **Worker** implements or designs only an exact handoff and returns
    evidence; it never self-reviews or approves;
  - the independent **Reviewer** (**Fable5** or a dedicated SOL Reviewer) is
    read-only and never patches, commits, or approves;
  - **Leo/GPT** owns material scope decisions, risk acceptance, final closure,
    and selection of the next mission.
- No actor here holds cross-project, canonical-policy, risk-acceptance,
  final-approval, or next-mission authority beyond what its role and the exact
  mission or handoff grant.
- Every role result must be written as durable evidence and returned to
  **Advisor**. Advisor owns routine routing and the mission audit and returns to
  Leo/GPT for the decisions above.

## Required Entry Reads

Common mandatory reads for every role: this file, `CLAUDE.md`,
`docs/agent/TEAM_OPERATING_MODEL.md`, the actor's matching role document under
`docs/agent/roles/`, and the current role-appropriate authority input — a Leo/GPT
mission or decision for the Advisor, or the exact committed Advisor handoff for a
subordinate. `docs/agent/RUN_PROTOCOL.md` and
`docs/agent/RESULT_REPORTING_PROTOCOL.md` are mandatory for **Worker
assignments**; another role reads them only when its exact authority names them
for read-only audit context. Read any canonical authority named by the
mission/handoff directly. Historical reports are evidence, not current permission.

## Team Binding and Common Role Docs

- Responsible Advisor: `agent-office-advisor` (Agent Office Team).
- Participating roles: Agent Office Designer, Worker (`agent-office-opus`), and
  the independent Agent Office Reviewer.
- Reporting path: actor -> `agent-office-advisor` -> Leo/GPT.
- Common operating model, role definitions, and tmux/runtime-binding rules are
  canonical here in `docs/agent/` (see `docs/agent/TEAM_OPERATING_MODEL.md` and
  `docs/agent/roles/`). `foundation-docs` is historical evidence, result
  storage, and pointer storage only, not current role or runtime authority.

## Non-Negotiable Boundaries

- Use only the assigned existing role session. Do not create or use agents,
  sub-agents, delegated contexts, temporary sessions, substitute actors, or
  hidden parallel work.
- Do not access or introduce a database, schema, migration, secret, credential,
  environment value, production/live system, public exposure, or protected
  branch unless a later exact mission explicitly authorizes it. These actions
  are forbidden in the bootstrap mission.
- A browser-facing Agent Office surface may carry structured Leo-to-Advisor
  communication only. It must never dispatch directly to a Worker or Reviewer,
  and it must never expose arbitrary terminal or shell execution.
- Run terminal commands only when they are directly necessary for the approved
  repo-local mission. Never execute caller-supplied arbitrary commands or create
  a general command-execution path.
- Do not self-review, issue an independent-review verdict, accept risk, grant
  final approval, merge to `main`, push to `main`, force push, or select or start
  the next mission automatically.
- Do not broaden allowed files, product behavior, repositories, branches, or
  external systems beyond the exact mission or handoff.

## Work and Git Rules

These execution, Git, result, and STOP rules apply to a **Worker assignment**.
The Designer and Reviewer follow their matching role documents and handoffs; the
Advisor follows `docs/agent/roles/advisor.md`, writes the mission audit, and
returns to Leo/GPT, and never implements or self-reviews.

- Inspect repository and dirty-worktree state before editing. Preserve unrelated
  user changes and stop on an unsafe overlap.
- Change only explicitly allowed files. Stage with explicit paths and verify the
  staged diff before each commit.
- Use only the mission-approved branch and remote. Push non-force only when the
  handoff authorizes a push.
- Run proportionate checks named by the handoff and report failures or skips
  honestly. A Worker completion report is evidence for review, not a review.
- After writing the durable result and pointer, return them to Advisor and stop.
  Wait for an explicit new handoff; never continue into another work unit.

## Exact-Handoff Scope Lock

The six-file bootstrap allowlist was completed by commit
`937f0c5f92cd3b39d81796c13bc00b4afe3407fb` and is historical evidence, not an
active limit on later work. Current scope authorization is role-specific: for a
subordinate (Designer, Worker, Reviewer, Control) the exact committed Advisor
handoff is the only repo-local file/scope authorization; for the Advisor it is
the Leo/GPT mission or decision. Neither path grants work beyond its exact
mission or handoff.

This replacement does not grant product work by itself. If a handoff authorizes
design only, runtime source, configuration, tests, capabilities, server start,
credentials, and tmux input remain forbidden. If it authorizes implementation,
only its named files, behavior, tests, branch, and external boundaries are in
scope. All actor, safety, review, Git, and STOP rules above remain active.
