# Agent Office Worker Result Reporting Protocol

Status: `ACTIVE`

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
