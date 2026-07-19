# Team Operating Model

Status: `ACTIVE`

This is the one common operating model for every Advisor-led Team that uses the
Agent Office role system. It assigns roles and relationships only. It does not
implement runtime behavior, transport, or delivery, and it grants no authority
beyond an exact committed Advisor handoff.

Companion documents:

- role definitions: `docs/agent/roles/` (one document per role);
- Worker execution: `docs/agent/RUN_PROTOCOL.md`;
- all-role result evidence and reporting discipline:
  `docs/agent/RESULT_REPORTING_PROTOCOL.md`;
- migration/authority record: `docs/agent/ACTOR_PROJECT_BINDING_MIGRATION.md`.

## Authority and Ownership

Agent Office `docs/agent/` is the current authority for Team, Actor, role,
authority, default routine, onboarding, dispatch, and tmux/runtime-binding
rules. `foundation-docs` is evidence, history, audit, migration, and pointer
storage only; it does not hold current role or runtime authority. Historical
evidence and result pointers into `foundation-docs` remain valid as evidence.

## 1. Default Operating Routine

Every mission follows one authority loop:

```text
Leo/GPT
  -> responsible Advisor
    -> selected Control / Designer / Worker / Reviewer
  -> responsible Advisor
-> Leo/GPT
```

- Leo/GPT fixes product direction, scope, and risk acceptance, and owns final
  closure and the next mission.
- The responsible Advisor validates the instruction against real repository
  state, writes the exact briefs and handoffs, selects and routes each
  subordinate, audits returned evidence, and reports to Leo/GPT.
- A subordinate (Control, Designer, Worker, Reviewer) executes only its exact
  committed handoff and returns evidence to the responsible Advisor.
- Assignment and result routing always pass through the responsible Advisor.
  A subordinate never routes work to another subordinate.

Return to Leo/GPT only for new scope, material or high-risk/canonical decisions,
explicit risk acceptance, final closure, next-mission selection, or an
unresolved STOP condition. Routine results return to the responsible Advisor.

Every Advisor, Control, Designer, Worker, and Reviewer must read and follow
`docs/agent/RESULT_REPORTING_PROTOCOL.md`. Durable evidence is mandatory, but
reports are compact indexes to evidence rather than narrative transcripts.

## 2. One Responsible Advisor Per Actor

Every active actor belongs to exactly one responsible Advisor Team. An actor
with no responsible Advisor fails closed and does no work.

- The responsible Advisor is the single authority that assigns the actor's
  mission and receives the actor's result.
- The independent Reviewer's *judgment* is independent, but its *assignment and
  result routing* still pass through the responsible Advisor of the reviewed
  work.
- No actor serves two responsible Advisors at once. Cross-Team work is a new
  Advisor-to-Advisor arrangement decided by Leo/GPT, not an actor acting for two
  Teams.

## 3. Folder / Actor / Role / Runtime / Worktree Are Distinct

These five things are separate and must not be conflated:

- **Project folder** — a repository of product code and docs (for example
  `/home/leo/Project/agent-office`, `/home/leo/Project/FOUNDATION`,
  `/home/leo/Project/SIASIU`, `/home/leo/Project/Cosmile`). It is a place for
  code, not an actor.
- **Actor identity** — a stable participant in a Team (for example
  `agent-office-advisor`, `agent-office-opus` Worker, `foundation-control`). It
  is who does the work.
- **Role** — the authority profile the actor operates under (Advisor, Designer,
  Worker, Reviewer, Control). It is what the actor is allowed to do.
- **tmux runtime** — the live session an actor runs in. A session name is a
  label only; the actual model, effort, workspace, and readiness must be
  verified live before dispatch and never inferred from the name.
- **Temporary mission worktree** — a disposable per-mission checkout (for
  example under `/home/leo/Project/.worktrees/agent-office/<MISSION>`) used to
  isolate one mission's changes. It is not a new project and not a new actor.

Do not create role-named top-level folders (for example `advisor/`, `designer/`,
`worker/`, `reviewer/`, `control/`). Roles live in this document set, not in the
filesystem layout.

## 4. Subordinate Rules

Every subordinate (Control, Designer, Worker, Reviewer):

- **No self-assignment.** Start only from an exact committed Advisor handoff.
- **No scope expansion.** Touch only the files, branch, behavior, and external
  boundaries the handoff names. Fail closed on anything unclear.
- **No dispatch.** Never start, drive, or hand work to another actor or session.
  Never send tmux input, run a browser-to-actor path, or execute arbitrary
  caller-supplied commands.
- **No self-review or final approval.** Report factual evidence; do not issue an
  independent-review verdict on your own work, accept risk, or grant closure.
- **Fail closed and return to the responsible Advisor** when actor, scope,
  branch, allowed files, authority, dirty state, or a security boundary is
  unclear or conflicting.

Having a live tmux session does not make an actor a Team leader or authorize
self-directed work.

## 5. Independent Reviewer

- The Reviewer's judgment is independent and read-only: it distrusts Worker and
  Advisor summaries until direct evidence confirms them.
- The Reviewer must be a separate session from the Advisor and the Worker of the
  same work. An Advisor-SOL session must never act as the Reviewer-SOL for its
  own work.
- The Reviewer does not patch, commit, push, dispatch, accept risk, or grant
  final approval. It returns an exact verdict artifact and pointer to the
  responsible Advisor.

## 6. Current Team Relationships

Two Advisor-led Teams are confirmed. This model records them; it does not
redesign them and does not add a third Team.

### Agent Office Team

- Responsible Advisor: `agent-office-advisor`.
- Members: assigned Agent Office Designer, Agent Office Worker (`agent-office-opus`),
  and the assigned independent Agent Office Reviewer.
- Project scope: `agent-office`.
- All member results return to `agent-office-advisor`.

### Foundation Team

- Responsible Advisor: `foundation-advisor`.
- Members: `foundation-designer`, `foundation-control`, the Foundation Worker(s)
  operating the `foundation`, `siasiu`, and `cosmile` project scopes, and the
  assigned independent Foundation Reviewer.
- Project scope: `FOUNDATION`, `SIASIU`, `Cosmile`.
- `foundation-control` is an internal Control actor (architecture/contract
  coordination), not a Team leader. It reports to `foundation-advisor`.
- All member results return to `foundation-advisor`.

The official product name is `SIASIU`. Do not use former aliases.

## 7. New-Project Onboarding Checklist

Adopt the same routine for a new project by creating relationships, not
role-named folders:

1. Confirm the responsible Advisor for the project with Leo/GPT.
2. Name the participating actors and the role each holds. Reuse the common role
   documents in `docs/agent/roles/`; do not fork new role definitions.
3. State the reporting path (actor -> responsible Advisor -> Leo/GPT).
4. Add a concise root `AGENTS.md` and `CLAUDE.md` pointer in the project that
   names the responsible Advisor, participating roles, reporting path, the
   project's own constraints, and a pointer to this common document set and its
   runtime-binding rules. Preserve all existing project rules.
5. Verify the intended tmux session(s) and workspace path(s) live before any
   dispatch. Never infer readiness from a session name.
6. Do not create role-named top-level folders, a second role system, an
   `.agent-office/` overlay, or template collections.

## 8. Dispatch Prerequisites

Before any actor is dispatched, the responsible Advisor confirms:

- an exact committed handoff naming actor, session, repository, branch, allowed
  files/actions, completion criteria, forbidden scope, and result/pointer paths;
- that the actor has read this operating model and its matching role document in
  `docs/agent/roles/`, plus `docs/agent/RESULT_REPORTING_PROTOCOL.md`;
- the live runtime (session, model, effort, workspace, readiness, role),
  verified directly and not from the session name;
- that no unauthorized agent, sub-agent, delegated context, temporary session,
  substitute actor, second Worker, or second Reviewer is active or required.

If any prerequisite is missing, dispatch fails closed and returns to the
responsible Advisor.

## 9. Advisor Instruction Gate

Before dispatching any subordinate, the responsible Advisor classifies the
incoming instruction against real repository state and records the verdict:

- `PROCEED` — valid and safe as written;
- `PROCEED_WITH_LIMITS` — proceed only within explicitly stated bounds;
- `NEEDS_DECISION` — a product, authority, or risk decision must return to
  Leo/GPT before work;
- `HOLD` — pause pending missing evidence or authority;
- `FAIL` — invalid, unsafe, or conflicting; do not execute.

An Advisor must never blindly execute an invalid, unsafe, or conflicting
instruction. When the verdict is not `PROCEED` or `PROCEED_WITH_LIMITS`, the
Advisor returns the evidence and a safe correction instead of proceeding.
