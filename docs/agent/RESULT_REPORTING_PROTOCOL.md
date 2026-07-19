# Agent Office Result Reporting Protocol

Status: `ACTIVE`

This protocol applies to every Advisor, Control, Designer, Worker, and Reviewer.
Role-specific evidence requirements remain in each role document. The detailed
Worker result fields below remain mandatory for Worker runs.

## Minimal Reporting Default

Durable evidence is mandatory. Long narrative is not. A report is a compact
index to exact Git, file, test, runtime, and review evidence; it is not a replay
of the prompt, exploration transcript, or source code.

Every role must report only:

- the exact changed delta or reviewed subject;
- required check outcomes, including material failures and skips;
- material findings, risks, limitations, and STOP conditions;
- exact Git/runtime state needed to support the claim;
- the next decision or return target.

Do not:

- restate the handoff or repeat unchanged facts;
- paste source code, command transcripts, or long tool output when an exact
  commit, path, command name, and concise result identify the evidence;
- narrate routine exploration or reasoning chronologically;
- create optional summary, handoff, or evidence files not required by the
  mission;
- duplicate the same evidence across the full result, pointer, chat, and final
  audit.

Default soft ceilings are 25 lines for a module/milestone checkpoint, 80 lines
for a role result, and 120 lines for a final review or Advisor audit. When a
named safety issue, blocking conflict, or required evidence cannot fit, begin
the overflow with:

```text
REPORT_LENGTH_EXCEPTION: YES
REASON: <exact material reason>
```

Otherwise `REPORT_LENGTH_EXCEPTION: NO` is implicit. Put necessary detailed
evidence at one exact durable path and reference it; do not repeat it in the
pointer or chat return.

The responsible Advisor enforces this discipline in every handoff. If a
subordinate returns an unnecessarily long report, the Advisor requests a
compact replacement without rerunning implementation, tests, or analysis. A
Reviewer inspects the actual candidate and direct evidence, so report length is
never a substitute for independent verification.

Every Worker run must produce durable, evidence-bearing output at the exact result
and pointer paths supplied by Advisor. Chat or pane output alone is not evidence.

## Required Result Evidence

The full result must state:

- mission/job ID, actor, project, repository, branch, starting base or unborn
  state, resulting HEAD, existing session, and model/effort;
- exact authorized scope and exact changed-file list;
- forbidden/excluded files and confirmation that they were untouched;
- commands/checks run with concise outcomes, including failures and skips;
- completion-criterion and instruction-boundary coverage;
- staged, unstaged, untracked, commit, push, upstream, and ancestry status;
- database, schema/migration, secret/environment, PII, runtime, public,
  production/live, protected-branch, main merge/push, and force-push status;
- agent/sub-agent/delegation, browser dispatch, arbitrary terminal execution,
  self-review, and automatic-next-mission status;
- known limitations, residual risks, and every STOP condition encountered;
- durable result path, pointer path, and foundation-docs commit when applicable;
- `RETURN_TO: Advisor` and `PROPOSED_NEXT_ACTOR: Advisor`.

The Worker may report factual criterion satisfaction, but must not issue an
independent-review verdict, accept risk, or claim final mission approval.

## Pointer Block

Use this compact shape, filled with exact values:

```text
WORKER_RESULT_POINTER
MISSION_ID: <id>
ACTOR: Agent Office Worker
RESULT_FILE: <path>
FOUNDATION_DOCS_COMMIT: <sha-or-not-applicable>
TARGET_REPO: <path>
TARGET_BRANCH: <branch>
TARGET_COMMIT: <sha>
PUSH_STATUS: <status>
RETURN_TO: Advisor
PROPOSED_NEXT_ACTOR: Advisor
STOP
```

The pointer must identify the committed durable result; it must not replace it.
Return the same pointer block to Advisor after verifying both repositories.

## Reporting Discipline

- Record exact facts from Git and files, not assumptions or success language that
  lacks evidence.
- Preserve and disclose unrelated pre-existing dirt; never include it in result
  staging.
- If a required check cannot be performed, report it as skipped or blocked with
  the reason.
- After returning the pointer, stop. Do not dispatch a Reviewer, begin follow-up
  work, or infer or start the next mission.
