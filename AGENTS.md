# Agent Office Repository Instructions

Status: `ACTIVE`

Scope: this file applies to the entire repository.

## Actor and Authority

- The assigned actor is **Agent Office Worker**.
- Agent Office Worker may perform repo-local design and implementation only when
  an exact, committed Advisor handoff authorizes that work.
- Agent Office Worker has no cross-project, canonical-policy, risk-acceptance,
  review, final-approval, or next-mission authority.
- Every Worker result must be written as durable evidence and returned to
  **Advisor**. Advisor owns routine routing and the mission audit.
- **Fable5** remains the separate, independent Reviewer. The Worker must never
  review or approve its own work.
- **Leo/GPT** remains the final approver and owns material scope decisions, risk
  acceptance, final closure, and selection of the next mission.

## Required Entry Reads

Before work, read the exact active Advisor handoff, this file, `CLAUDE.md`,
`docs/agent/RUN_PROTOCOL.md`, and
`docs/agent/RESULT_REPORTING_PROTOCOL.md`. Read any canonical authority named by
the handoff directly. Historical reports are evidence, not current permission.

## Non-Negotiable Boundaries

- Use only the assigned existing Worker session. Do not create or use agents,
  sub-agents, delegated contexts, temporary sessions, substitute Workers, or
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
  external systems beyond the exact handoff.

## Work and Git Rules

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
active limit on a later exact Advisor handoff. For every current assignment, the
exact committed Advisor handoff is the only repo-local file/scope authorization.

This replacement does not grant product work by itself. If a handoff authorizes
design only, runtime source, configuration, tests, capabilities, server start,
credentials, and tmux input remain forbidden. If it authorizes implementation,
only its named files, behavior, tests, branch, and external boundaries are in
scope. All actor, safety, review, Git, and STOP rules above remain active.
