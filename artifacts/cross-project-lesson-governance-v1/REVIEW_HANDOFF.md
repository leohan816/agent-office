# Cross-Project Lesson Governance V1 — Independent Review Handoff

Status: `ACTIVE`

## Authority and classification

- Mission: `AGENT_OFFICE_CROSS_PROJECT_LESSON_GOVERNANCE_V1`.
- Authority: Leo's `STRATEGY_REVIEW_DISPATCH`, routed only through
  `agent-office-advisor`; this committed handoff is the Reviewer's exact scope.
- Classification: `HARD_IMPORTANT_AUTHORITY`.
- Reviewer policy: independent Agent Office Reviewer, Fable5, effort `max`.

## Binding gate

- Use only existing separate session `agent-office-reviewer` (`TMUX_PANE %28`).
- Before dispatch, Advisor must live-verify actor, separate session, model
  `claude-fable-5` (the `fable` alias), effort `max`, exact worktree, Reviewer
  role, and readiness. Session name alone proves nothing.
- Start `COLD`: read `AGENTS.md`, `CLAUDE.md`,
  `docs/agent/TEAM_OPERATING_MODEL.md`, `docs/agent/roles/reviewer.md`,
  `docs/agent/RESULT_REPORTING_PROTOCOL.md`, and this handoff. Treat Worker
  evidence as evidence, never authority.
- If any binding or authority fact conflicts or cannot be verified, do not
  review; return one concrete blocker to Advisor and stop.

### Fresh-runtime Sentinel gate

- Reject prior Reviewer PID `2381134` and every verdict from it; preserved
  pre-banner scrollback is collision evidence only, not review evidence.
- Same-pane fresh PID `705867` must load `/fable-sentinel` before `COLD` and ACK
  local `contract-review.md`, `provenance-review.md`,
  `review-classification.md`, and `delta-review.md`. Do not open or follow its
  Foundation/Cosmile pointer.
- After that ACK, perform the `COLD` reads above and accept only post-gate review
  evidence. If Sentinel requires forbidden access, return that conflict and stop.

## Exact review subject

- Repository/worktree:
  `/home/leo/Project/.worktrees/agent-office/AGENT_OFFICE_CROSS_PROJECT_LESSON_GOVERNANCE_V1`.
- Branch: `governance/cross-project-lesson-governance-v1`.
- Baseline: `f66a55b390b69d34bab388ebbd9bcd42e6fa4b52`.
- Canonical candidate commits: `d20b7b6` and correction `e75b17e`.
- Worker evidence/branch head before this launcher: `e1c4500`;
  `artifacts/cross-project-lesson-governance-v1/WORKER_RESULT.md` and its pointer.
- Review only the direct baseline-to-`e75b17e` governance delta in these six
  canonical files: `AGENTS.md`, `CLAUDE.md`, `docs/agent/RUN_PROTOCOL.md`,
  `docs/agent/roles/README.md`, `docs/agent/roles/advisor.md`, and new
  `docs/agent/roles/strategy.md`.

Read committed content and use only focused read-only commands needed for exact
diff/name/status/ancestry, `git diff --check`, relative-link resolution,
heading navigation, and `wc -l`/`wc -w`. Do not run tests, build, lint,
typecheck, server, browser, product checks, or inspect unrelated history.

## Clean-context navigation cases

Traverse all five directly as a clean-context actor. For each, return the exact
file and heading path plus actor, trigger/precondition, required read/action,
stop/escalation point, and evidence return:

1. `DELTA` always re-reads the current mission/handoff and every project-local
   mandatory product/safety authority.
2. Reset, compaction, unknown/mismatched authority revision, or unverifiable
   acknowledgement forces `COLD`.
3. Common authority cannot override project authority; Agent Office Strategy
   classifies, coordinates canonical revision, and notifies affected Strategies,
   but never dispatches project actors.
4. A new project onboards `COLD` through minimal pointers without copying role
   contracts.
5. An affected project Strategy may reject/report an incompatible rule through
   the same Leo-controlled promotion gate instead of silently applying it.

## Verdict gates

- Reject broken links, circular/conflicting authority, ambiguous ownership,
  non-executable wording, duplicated policy variants, hidden mandatory reads,
  or unjustified mandatory-read growth.
- Verify Advisor-only implementation/review routing, the four incident classes,
  Leo-only promotion, affected-rule-only distribution, and exactly one concise
  verification-truth invariant.
- Confirm `strategy.md` is compact relative to existing role documents and every
  additional mandatory-read line has a non-duplicated operational purpose.
- Reproduce baseline/candidate mandatory-read impact with repository-local
  `wc -l` and `wc -w`, label `wc -w` as a whitespace-token proxy, and identify
  the exact headings selected for this mission's `DELTA`.
- Confirm the canonical changed-file set is exactly the six files above and the
  direct delta contains zero Foundation/Cosmile, runtime, product, source, test,
  or configuration change.

## Allowed return and stop

The candidate is read-only: do not patch it, commit, push, contact or inspect
Foundation/Cosmile, inspect product/runtime work, accept risk, approve, merge,
or start another mission. Write only:

- `artifacts/cross-project-lesson-governance-v1/REVIEW_RESULT.md`
- `artifacts/cross-project-lesson-governance-v1/REVIEW_RESULT_POINTER.txt`

Return `PASS`, `PASS_WITH_RISK`, `NEEDS_PATCH`, or `FAIL`, with compact findings,
case traces, focused evidence, residual risk, and the exact pointer to Advisor;
then stop. Advisor routes any conflict to Agent Office Strategy.

## AO-GOV-01 direct delta review — current authority

This section supersedes the earlier review subject only for AO-GOV-01. Use the
same existing `agent-office-reviewer` pane `%28`; do not create or replace a
session. Before `COLD`, live-verify Fable 5, effort `max`, exact mission
worktree/branch, and reload `/fable-sentinel`. ACK only the applicable local
references and do not open or follow its Foundation/Cosmile pointer.

Review subject: canonical baseline `9c1e9e9` (its parent `49cdfea` has identical
`AGENTS.md`/`CLAUDE.md`), candidate `41526c6`, and Worker evidence HEAD
`1225941`. Review only the direct wording delta in:

- `AGENTS.md` — `Required Entry Reads` authority-input clause.
- `CLAUDE.md` — numbered entry-read item 1.

Confirm only: exact two-file name-status/diff, `git diff --check`, and that both
COLD clauses explicitly enumerate (1) a Leo/GPT mission or decision for the
Advisor, (2) a Leo/GPT governance mission for Agent Office Strategy, and (3)
the exact committed Advisor handoff for a subordinate. Reject any other
canonical change, semantic drift, ambiguity, or missing actor.

No broad history/read/check, link walk, measurement rerun, build, lint,
typecheck, test, runtime/product work, Foundation/Cosmile access, prior-verdict
reliance, PR, merge, or next mission. The candidate is read-only. Update in
place only `REVIEW_RESULT.md` and `REVIEW_RESULT_POINTER.txt` with a compact
AO-GOV-01 delta verdict and return to Advisor; do not commit or push, then stop.
