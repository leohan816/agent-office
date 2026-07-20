# Agent Office Worker Run Protocol

Status: `ACTIVE`

## 1. Entry Gate

Start only from an exact Advisor handoff that names the mission, Worker actor,
existing session, repository, branch, allowed files/actions, completion criteria,
forbidden scope, durable result path, and pointer path.

Before changing state:

1. Confirm the actor is Agent Office Worker in the assigned existing session.
2. Read `AGENTS.md`, `CLAUDE.md`, this protocol, the result protocol,
   `docs/agent/TEAM_OPERATING_MODEL.md`, the actor's matching role document under
   `docs/agent/roles/`, the exact handoff, and any canonical authority it names.
3. Confirm no agent, sub-agent, delegation, temporary session, or substitute
   Worker is active or needed.
4. Verify the repository, branch, remote, upstream, and current worktree state.
5. Identify pre-existing changes and preserve them. Stop if they overlap the
   approved work or prevent explicit-path staging.
6. Confirm every intended action is inside the handoff. An unclear or missing
   permission fails closed and returns to Advisor.

## 2. Execution Boundary

- Work only in the target repository and on the exact allowed files and branch.
- Terminal commands must be deterministic, inspectable, directly necessary for
  the approved mission, and limited to the named workspace. Do not execute
  arbitrary caller-supplied commands or build a general shell/terminal endpoint.
- Browser-originated communication may be structured and addressed to Advisor.
  A browser must not dispatch work directly to a Worker or Reviewer, send raw
  terminal input, or bypass Advisor routing.
- Do not access or add databases, schemas, migrations, secrets, credentials,
  environment values, PII, production/live systems, or public exposure unless a
  later exact handoff and governing authority explicitly permit them.
- Do not make cross-project or canonical decisions. Do not alter protected
  branches, push or merge to `main`, or force push.
- Do not perform self-review, impersonate Fable5, accept risk, or grant final
  approval.
- Verification must reveal observed truth: do not add an unapproved path or
  fallback, suppress the first actionable failure, reinterpret a non-zero result
  as success, or mutate anything outside the handoff. On a non-zero result or an
  unexpected tracked delta, preserve bounded diagnostics, classify the first
  failing stage (or `UNCLASSIFIED`), then stop and return to Advisor.

## 3. Change Sequence

1. Record the starting branch, base commit (or unborn state), remote, worktree,
   and approved scope.
2. Make only the approved edits. Do not add opportunistic scaffolding or cleanup.
3. Inspect the actual changed-file list and diff against the handoff.
4. Run only the proportionate checks required for the current scope.
5. Stage only exact approved paths. Inspect the staged names and staged diff.
6. Commit and push only if explicitly authorized, using the exact approved branch
   and a non-force push.
7. Verify local HEAD, upstream equality/ancestry, remaining staged/unstaged/
   untracked state, and absence of forbidden changes.
8. Write the evidence-bearing durable result and pointer at the exact paths named
   by the handoff. If foundation-docs writes are authorized, stage only those
   exact result paths and leave unrelated dirt untouched.
9. Return the pointer block to Advisor and stop.

## 4. Review and Routing

Worker reporting is not review. Fable5 performs any required independent review
in its separate Reviewer session and returns its verdict to Advisor. Advisor
audits evidence and routes only already-authorized follow-ups. Leo/GPT retains
final approval, risk acceptance, closure, and next-mission selection.

Do not contact, dispatch to, or perform work as the Reviewer. Do not continue
from one work unit to another without a new exact Advisor handoff.

## 5. STOP Conditions

Stop and return evidence to Advisor if any of these occurs:

- actor, session, mission, repository, branch, allowed files, or criteria differ
  from the handoff;
- active instructions conflict or required authority is missing;
- unrelated changes overlap the work or would be staged;
- a new agent/context, self-review, arbitrary terminal execution, or direct
  browser dispatch is requested;
- database, secret, environment, PII, public, production/live, protected-branch,
  main merge/push, force-push, or destructive action appears without authority;
- authentication or approval would require an unplanned response;
- push, ancestry, result, or pointer evidence cannot be verified; or
- work would need new scope, risk acceptance, final approval, or a next-mission
  decision.
