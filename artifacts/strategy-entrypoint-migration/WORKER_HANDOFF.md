# Agent Office Strategy Entrypoint Migration Worker Handoff

Status: `ACTIVE`

Mission: `AGENT_OFFICE_STRATEGY_ENTRYPOINT_MIGRATION_001`

## Authority And Train

- Founder authority: `STRATEGY_ENTRYPOINT_MIGRATION_MISSION — PROCEED_WITH_LIMITS`
- Responsible Advisor: `agent-office-advisor`
- Worker: existing `agent-office-opus`
- Required skill: `/fable-builder`
- Reviewer: existing independent `agent-office-reviewer`, `/fable-sentinel`
- Base: `ceb778a1ec7807ef0cb87a310486965811140234`
- Worktree: `/home/leo/Project/.worktrees/agent-office/AGENT_OFFICE_STRATEGY_ENTRYPOINT_MIGRATION_001`
- Branch: `feature/strategy-entrypoint-migration-001`
- Push: non-force to the matching remote branch only

This handoff authorizes one bounded implementation. It does not authorize live
activation, Foundation-session input, cutover, or changes to the active rollback
worktree/service.

## Objective

Add exactly two closed Strategy Slack entrypoints alongside the unchanged legacy
Advisor profiles:

1. `team-agent-office -> agent-office-strategy-sol -> agent-office-advisor`
2. `team-foundation -> foundation-strategy-sol -> foundation-advisor`

Strategy is an optional Leo-facing one-to-one entrypoint. It may dispatch only
to its responsible Advisor and receive the Advisor result for return to Leo. It
must never dispatch directly to Worker or Reviewer, implement, review, accept
risk, accept closure, or become a Team leader.

## Closed Runtime Bindings

### Agent Office Strategy

- profile ID: `AGENT_OFFICE_STRATEGY`
- actor ID / role instance ID: `agent-office-strategy-sol`
- Team: `AGENT_OFFICE_ADVISOR_TEAM`
- responsible Advisor: `agent-office-advisor`
- session/window/pane: `$48 / @48 / %48`
- workspace: `/home/leo/Project/agent-office`
- current command: `codex`
- fixed state root: `/home/leo/.local/state/agent-office/strategy-agent-office-v1`

### Foundation Strategy

- profile ID: `FOUNDATION_STRATEGY`
- actor ID / role instance ID: `foundation-strategy-sol`
- Team: `FOUNDATION_ADVISOR_TEAM`
- responsible Advisor: `foundation-advisor`
- session/window/pane: `$31 / @31 / %31`
- workspace: `/home/leo/Project/FOUNDATION`
- current command: `codex`
- fixed state root: `/home/leo/.local/state/agent-office/strategy-foundation-v1`

The Strategy secret path is fixed to:

`/home/leo/.config/agent-office/strategy-slack-apps.env`

Parse it as exact-key data only. Never source/eval it and never print, copy,
persist, hash for display, or place token values in Git, logs, tests, or result
artifacts. The accepted keys are exactly:

- `SLACK_WORKSPACE_ID`
- `SLACK_LEO_USER_ID`
- `SLACK_AGENT_OFFICE_STRATEGY_APP_ID`
- `SLACK_AGENT_OFFICE_STRATEGY_CHANNEL_ID`
- `SLACK_AGENT_OFFICE_STRATEGY_BOT_TOKEN`
- `SLACK_AGENT_OFFICE_STRATEGY_APP_TOKEN`
- `SLACK_FOUNDATION_STRATEGY_APP_ID`
- `SLACK_FOUNDATION_STRATEGY_CHANNEL_ID`
- `SLACK_FOUNDATION_STRATEGY_BOT_TOKEN`
- `SLACK_FOUNDATION_STRATEGY_APP_TOKEN`

Use two fixed profile-specific CLI entrypoints. No profile/root/path/pane/session
may be caller-selected. Reuse the existing PERSONAL direct behavior and result
spool with separate fixed roots; do not route ordinary messages through Git,
grant, artifact, or evidence publication.

## Required Behavior

- Existing Advisor profiles, apps, secret parser behavior, descriptor, roots,
  commands, and active code path remain unchanged and usable as rollback.
- Each Strategy profile validates its fixed Slack workspace, Leo user, App,
  channel, tmux pane, session, workspace, and command at startup.
- Each profile owns an independent Socket client, dedupe namespace, FIFO,
  current-message correlation, result spool, and message-local failure state.
- Valid messages are sequential and return status/result to the immutable same
  Slack thread.
- Duplicate events do not create a second item or result.
- An ordinary failure affects only that message; the next valid message remains
  processable.
- No cross-profile fallback, state sharing, credential swapping, destination
  selection, arbitrary shell execution, or direct Worker/Reviewer dispatch.
- Add `STRATEGY` only to the existing Organization role vocabulary and add the
  two static Actor/runtime rows. Do not redesign the Registry or schema and do
  not change existing Advisor rows or historical identity joins.
- Add one minimal canonical Strategy role file and the smallest Role Index / Team
  operating-model references. Do not copy role documents into projects.
- Do not contact or mutate `%31`, `%27`, or any other Foundation session during
  implementation or tests. Use injected/fake observations for Foundation proof.

## Exact Worker Allowlist

Change fewer where possible, but never change outside these paths:

1. `src/application/organization/types.ts`
2. `src/application/organization/registry.ts`
3. `src/application/slack-pilot/profiles.ts`
4. `src/application/slack-pilot/service.ts`
5. `src/adapters/gateways/slack-pilot/secret-config.ts`
6. `src/runtime/as1-slack-pilot/composition.ts`
7. `src/runtime/as1-slack-pilot/cli.ts`
8. `docs/agent/TEAM_OPERATING_MODEL.md`
9. `docs/agent/roles/README.md`
10. `docs/agent/roles/strategy.md`
11. `tests/contract/organization-registry.test.ts`
12. `tests/contract/as1-slack-profiles.test.ts`
13. `tests/security/as1-slack-secret-config.test.ts`
14. `tests/integration/as1-slack-live-composition.test.ts`
15. `tests/operations/as1-slack-lifecycle.test.ts`
16. `artifacts/strategy-entrypoint-migration/WORKER_RESULT.md`
17. `artifacts/strategy-entrypoint-migration/WORKER_RESULT_POINTER.txt`

If a required production file is outside this allowlist, stop without editing
it and return one concrete blocker. Do not request or infer expansion.

## Focused Validation Only

Add or update only these exact named cases in the existing test files, then run
each through a file-qualified Vitest `-t` filter:

1. `registers the two optional Strategy actors without changing existing Advisor bindings`
2. `exposes only the two fixed Strategy Slack profiles`
3. `parses only the fixed Strategy secret key set without exposing values`
4. `runs isolated Strategy FIFO routes with exact same-thread results and message-local failure`
5. `binds fixed Strategy commands and roots without caller-selected routing`

Also run:

- ESLint only on changed TypeScript files.
- `git diff --check ceb778a1ec7807ef0cb87a310486965811140234..HEAD`.
- A name-status check proving every changed path is allowlisted.
- A zero-diff check for the active descriptor, existing Advisor manifests/env
  example, legacy outbox/evidence paths, and the active rollback worktree.

Do not run complete files without `-t`, a broad suite, repository-wide lint,
typecheck, build, browser/visual tests, or unchanged-surface review.

## Forbidden

- Editing, building, stopping, restarting, or inspecting deeper into the active
  rollback worktree or owner PID.
- Input to Foundation sessions.
- Generic routing/profile frameworks, dynamic selectors, DB, schema redesign,
  systemd, UI, new apps/channels, design documents, or broad security redesign.
- Foundation, SIASIU, Cosmile, or VibeNews product changes.
- Live Strategy activation or cutover.
- Force push, merge, main-branch work, self-review, or next-mission work.

## Strategy Scope Decision: Option A

Leo/Strategy authorizes one bounded additive Strategy startup branch inside the
already allowlisted `composition.ts` and `cli.ts`. This branch may accept only
the two closed Strategy profile literals, parse only the fixed
`/home/leo/.config/agent-office/strategy-slack-apps.env` data file, use only the
two fixed Strategy roots and fixed pane/session/workspace/command bindings, and
reuse the existing PERSONAL direct FIFO/result spool.

This authorizes connectable code needed for later Advisor-run live proofs. It
does not authorize the Worker to activate either Strategy service. The legacy
Advisor startup path and active rollback service must remain behaviorally
unchanged. No new file, descriptor, grant system, schema, generic lifecycle or
router, legacy refactor, broad test, Foundation input, or design cycle is
authorized. Timebox: 20 minutes for implementation and remaining named tests.

### A1 Compatibility Authority

Within the already allowlisted `composition.ts`, widen `LiveState` only to the
closed Advisor-or-Strategy profile/secret union and add one behavior-preserving
`liveProfileSecret` narrowing helper for the three existing PERSONAL result-post
sites. Legacy Advisor values and outputs must remain unchanged.

One fixed, in-memory, construction-only Strategy startup grant-shaped
compatibility seed is authorized solely to satisfy the reused PERSONAL
service/`LiveState` contract. It is not persisted, Git-observed, caller/manual
authority, a per-message grant, a root-slot limit, or a new grant lifecycle.
Ordinary Strategy messages remain direct FIFO/spool with no grant/Git procedure.
No Worker live activation is authorized. Timebox: 15 minutes for
`startStrategyDirect`, the three remaining named tests, changed-file gates,
commit, and non-force push.

## Result

Commit and non-force push one coherent candidate. Write the exact changed paths,
commands/results, failures, commit, upstream state, known limits, and rollback
attestation to the two allowed Worker result paths. Return to
`agent-office-advisor` and stop. Timebox: 40–55 minutes; return one concrete
blocker sooner if the frozen allowlist cannot safely support the two routes.
