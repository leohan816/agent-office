# Cross-Project Lesson Governance V1 — Advisor Audit

Status: `AUDIT_COMPLETE`; mission closure and risk acceptance remain with Leo/GPT.

## Authority and route

- Mission: `AGENT_OFFICE_CROSS_PROJECT_LESSON_GOVERNANCE_V1`.
- Route used: Agent Office Strategy -> Agent Office Advisor -> existing Worker ->
  independent Reviewer -> Agent Office Advisor -> Agent Office Strategy.
- Baseline: `f66a55b390b69d34bab388ebbd9bcd42e6fa4b52`.
- Canonical candidate: `d20b7b6`, corrected by `e75b17e`.
- Worker evidence: `e1c4500` and `WORKER_RESULT_POINTER.txt`.
- Accepted review authority: `a2bacfb96f2be56d0dcaa8144d186e6c27509f53`.
- Accepted independent verdict: `PASS` in `REVIEW_RESULT.md`; it is evidence,
  not approval, risk acceptance, merge authority, or mission closure.

## Actor/runtime binding audit

- Worker: Agent Office Worker in the existing `agent-office-opus` session,
  pane `%16`, Opus 4.8, effort `xhigh`, exact mission worktree and branch.
  Its result identifies the same baseline, candidate commits, six-file
  allowlist, focused checks, evidence commit, and non-force push.
- Reviewer classification: `HARD_IMPORTANT_AUTHORITY` under the committed
  `REVIEW_HANDOFF.md`.
- Accepted Reviewer: independent Agent Office Reviewer in the existing
  `agent-office-reviewer:0.0` session, pane `%28`, fresh PID `705867`, Fable 5,
  effort `max`, exact mission worktree/branch, clean and upstream-equal at the
  binding gate. Advisor live evidence independently showed the Fable 5 Max
  banner and process command `claude --model fable --effort max`.
- Sentinel preceded `COLD` in the accepted runtime. Its ACK named local
  `contract-review.md`, `provenance-review.md`, `review-classification.md`, and
  `delta-review.md`; it did not open or follow the forbidden Foundation/Cosmile
  pointer. The subsequent `COLD` ACK was pinned to `a2bacfb` before `PROCEED`.

## Collision and contamination disposition

- Pre-banner AS1 scrollback was preserved as evidence and was not an active
  concurrent process collision.
- Prior Reviewer PID `2381134` is rejected. It followed the prohibited
  Foundation pointer before Leo's reset; no verdict or evidence from that
  runtime was accepted, and it made no candidate or repository change.
- PID `705867` was a fresh same-pane context. During review, Advisor interrupted
  one unnecessary filename-only enumeration, excluded its output from verdict
  evidence, and narrowed the run to the six documents and directly named link
  targets. No out-of-scope file content was read. The Reviewer recorded this
  limitation and did not rely on per-commit attribution.

## Canonical changed files and headings

The canonical candidate changes exactly six files:

- `AGENTS.md`: `Actors and Authority`, `Required Entry Reads`, and `Authority
  Loading: COLD / DELTA`.
- `CLAUDE.md`: entry preamble and `Role Summary`.
- `docs/agent/RUN_PROTOCOL.md`: `2. Execution Boundary`.
- `docs/agent/roles/README.md`: role index and governance-chain paragraph.
- `docs/agent/roles/advisor.md`: `Responsibilities`, `Accepted Inputs`, and
  `Reports To / Routing`.
- `docs/agent/roles/strategy.md`: new 70-line role; `Reusable Governance Chain`,
  `Classification`, `Operating Rules`, `Prohibitions`, and `Routing and Evidence`.

Mission-only intake, handoff, Worker result, review launcher/result, and this
audit remain evidence outside mandatory authority reads. They do not create a
lessons hierarchy, registry, framework, imported policy, or duplicate authority.

## Mandatory-read impact

Method: identical repository-local `git show REV:PATH | wc -l -w` measurements
on baseline and candidate. `wc -w` is only a deterministic whitespace-token
proxy, not a model tokenizer. Variable mission/handoff inputs and project-local
product/safety authority are not assigned a fixed size; both remain mandatory
in `DELTA`.

| Static COLD set | Baseline lines/words | Candidate lines/words | Impact |
|---|---:|---:|---:|
| Shared core: AGENTS + CLAUDE + TEAM model + result protocol | 500 / 3426 | 542 / 3783 | +42 / +357 |
| Reviewer: shared core + reviewer role | 568 / 3751 | 610 / 4108 | +42 / +357 |
| Advisor: shared core + advisor role | 572 / 3839 | 624 / 4283 | +52 / +444 |
| Worker: shared core + worker role + run protocol | 650 / 4374 | 697 / 4787 | +47 / +413 |
| Strategy: shared core + Strategy role | not canonical | 612 / 4249 | new role only |

Candidate file measurements independently reproduced: `AGENTS.md` 151/1177,
`CLAUDE.md` 83/707, `TEAM_OPERATING_MODEL.md` 198/1284,
`RESULT_REPORTING_PROTOCOL.md` 110/615, `RUN_PROTOCOL.md` 89/671,
`advisor.md` 82/500, `reviewer.md` 68/325, `worker.md` 66/333, and
`strategy.md` 70/466 (lines/words).

For this revision, `DELTA` selects only the headings listed above; the Worker
measured that selected payload at approximately 135 lines / 1047 words versus
the 542 / 3783 shared COLD core. The current mission/handoff and every
project-local mandatory product/safety authority are always re-read in addition
to that selection. A reset, compaction, unknown or mismatched revision, or
unverifiable ACK forces the full `COLD` route.

## Focused evidence and review gates

- `git diff --check f66a55b..e75b17e`: clean.
- Candidate-to-authority-HEAD diff for all six canonical paths: empty.
- Direct relative targets resolve, including `roles/README.md -> strategy.md`
  and `strategy.md -> README.md`, `../RESULT_REPORTING_PROTOCOL.md`, and
  `../../../AGENTS.md`.
- The Reviewer navigated all five clean-context cases with exact file/heading
  paths and actor, trigger, action, stop/escalation, and return evidence.
- The four incident classes, Leo-only promotion, common-never-overrides-project
  rule, Advisor-only project-actor routing, affected-rule-only distribution,
  onboarding by pointers, and reject/report feedback path are coherent.
- Exactly one verification-truth invariant exists, in `RUN_PROTOCOL.md` section
  2. It preserves bounded diagnostics, classifies the first failing stage or
  `UNCLASSIFIED`, and stops on non-zero or unexpected tracked delta.
- Focused documentation checks only were run. No build, lint, typecheck, server,
  browser, product test, runtime test, or broad history review was accepted.

## Verdict audit and residual risk

Advisor finds the direct `PASS` supported. Reviewer observations O1-O4 are LOW
wording risks: compressed summaries defer to the canonical role/router, the
general Leo return still has Leo as final sink, and feedback ownership/gate are
operable. None is a blocking ambiguity or a request for risk acceptance. Advisor
does not accept those risks; they are forwarded to Strategy/Leo with the verdict.

No Draft PR was created. Merge remains forbidden. The final evidence commit,
non-force push, clean state, and upstream equality are verified after this audit
is committed and are returned to Agent Office Strategy with this pointer.

## Boundary confirmation

- Canonical and mission evidence contain no Foundation/Cosmile change.
- The accepted Worker, fresh Reviewer PID `705867`, and Advisor audit did not
  inspect or contact Foundation/Cosmile. The rejected PID `2381134` pointer
  access is the explicit contamination exception recorded above.
- No runtime/product/source/test/configuration behavior changed.
- No other project was inspected or edited; no unrelated expansion occurred.
- No risk was accepted, no final approval or closure was granted, no merge was
  performed, and no next mission was started.

RETURN_TO: `agent-office-strategy-sol` with `ADVISOR_AUDIT_POINTER.txt`.

---

## AO-GOV-01 bounded correction audit

Classification: `CLARIFICATION`. AO-GOV-01 makes the root COLD enumeration
explicit for the already-canonical Agent Office Strategy role; it creates no
new authority class, mandatory file, behavior, or distribution mechanism.

- Advisor authority amendment: `9c1e9e9`; it changed only the existing
  `WORKER_HANDOFF.md` and is a direct child of clean pushed `49cdfea`.
- Worker: same existing `agent-office-opus` pane `%16`, PID `575878`, Opus 4.8,
  effort `xhigh`, exact worktree/branch. COLD ACK at `9c1e9e9` preceded work.
- Candidate: `41526c6b3be26d8d0bceeb75a11a25106c8d3306`.
  Its direct name-status is exactly `M AGENTS.md`, `M CLAUDE.md`.
- Worker evidence: `122594139705a3ad4dd57fe4040cb48bb55c6ae3`,
  updating only the existing Worker result and pointer.
- Review authority: `5b25db0545ff751c09f38b0e533bb8e4a95c4e82`,
  updating only the existing `REVIEW_HANDOFF.md`.
- Reviewer: same independent `agent-office-reviewer` pane `%28`, PID `705867`,
  Fable 5, effort `max`, exact worktree/branch. `/fable-sentinel` and its four
  local references were reloaded before a fresh COLD ACK at `5b25db0`; the
  Foundation/Cosmile pointer was not opened or followed.

Direct focused evidence passes: `git diff --check` is clean; each target clause
preserves the Advisor and subordinate inputs and adds the letter-identical
option “a Leo/GPT governance mission for Agent Office Strategy”; no other
canonical sentence or file changed. The same independent Reviewer returned
`PASS` in the updated `REVIEW_RESULT.md`, with no residual risk in scope and no
reliance on the prior verdict or Worker result.

The earlier mandatory-read measurements remain the original candidate record.
AO-GOV-01 changes no mandatory-set membership; measurement reruns were excluded
by the focused correction authority. No build, lint, typecheck, test, runtime,
product, link-walk, broad history, Foundation/Cosmile, PR, or merge action was
performed. No risk, approval, or closure is accepted by Advisor.

The final evidence commit, non-force push, clean worktree, and upstream equality
are verified after committing the updated review/audit evidence and returned to
`agent-office-strategy-sol` with the pointer.
