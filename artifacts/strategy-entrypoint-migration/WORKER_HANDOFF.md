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

## Leo Delta Amendment: Strategy Connect Readiness Seal (2026-07-18)

Status: `ACTIVE`

Advisor instruction gate: `PROCEED_WITH_LIMITS`. This amendment supersedes only
the blocked tests 4/5 disposition and the `startStrategyDirect()` Socket-connect
readiness seal. Every other boundary above remains in force. The exact starting
tip is pushed commit `f8815357040fcdd755e156ada0ca96d8c115876a`.

Dispatch only the existing Agent Office Worker, `agent-office-opus` pane `%16`.
Before acting, the Worker must re-verify its role/runtime binding and read the
required repository/Worker protocol files plus this complete committed handoff.
Fail closed to `agent-office-advisor` on any mismatch.

### Exact delta

1. In `src/runtime/as1-slack-pilot/composition.ts`, change only the
   `startStrategyDirect()` `socket.connect(...)` input's `readinessSeal` from
   `() => this.control.isReceiveReady(slug)` to
   `() => this.control.isConnectReady(slug)`. Slack `hello` is proved during
   connect before the later `RECEIVING_ONE_PROFILE` transition. Do not change
   the separate receive-actionable control callback, later receive-ready check,
   transition order, tests, comments, profiles, CLI, service, or any other
   source.
2. From the exact mission worktree, restore the existing declared runtime
   dependency with exactly `npm install ws@8.21.1 --no-save`. `ws` must resolve
   as exactly `8.21.1`; `package.json`, every lockfile, and the untracked
   `node_modules` symlink must remain unstaged and unmodified as repository
   artifacts. If npm changes a manifest or lockfile, stop and return that one
   concrete blocker; do not commit it.
3. Run only focused test 4 and focused test 5, each by its exact file and exact
   `-t` title with one worker:
   - `tests/integration/as1-slack-live-composition.test.ts` —
     `runs isolated Strategy FIFO routes with exact same-thread results and message-local failure`
   - `tests/operations/as1-slack-lifecycle.test.ts` —
     `binds fixed Strategy commands and roots without caller-selected routing`
4. Run ESLint only on
   `src/runtime/as1-slack-pilot/composition.ts`, then run
   `git diff --check f8815357040fcdd755e156ada0ca96d8c115876a..HEAD`
   after the candidate commit. Do not run any other test, complete test file,
   broad lint, typecheck, build, profile, design, live proof, or activation.
5. Stage only the exact source delta, verify the staged diff, commit it, and
   push non-force only to
   `origin/feature/strategy-entrypoint-migration-001`. Never stage
   `node_modules`, a package manifest, or a lockfile.

The only implementation path writable in the candidate is
`src/runtime/as1-slack-pilot/composition.ts`. After the candidate is committed
and pushed, append factual delta evidence to the existing
`artifacts/strategy-entrypoint-migration/WORKER_RESULT.md` and update the
existing `WORKER_RESULT_POINTER.txt` with the exact candidate and push state;
leave those two evidence edits for Advisor publication. Create no new file and
edit no handoff, documentation, test, other source, configuration, descriptor,
service, worktree, or binding. Return the candidate commit and evidence pointer
to `agent-office-advisor`, then STOP. This is Worker evidence, not review or
approval; independent delta review remains a separate Advisor dispatch.

## Leo Delta Amendment: Strategy Compile Closure (2026-07-18)

Status: `ACTIVE`

Advisor instruction gate: `PROCEED_WITH_LIMITS`. This amendment supersedes only
the prior prohibition on the core build and the source allowlist needed to
close the Strategy-addition TypeScript errors emitted by the Advisor's exact
`npm run build:core` attempt. Every other safety, actor, credential, routing,
activation, and rollback boundary above remains in force. The exact clean,
pushed starting tip is
`2e9e73eab13e8f9450ab1952b13542a9845dd26b`.

Dispatch only the existing Agent Office Worker, `agent-office-opus` pane `%16`.
Before acting, the Worker must re-verify its role/runtime binding and read the
required repository/Worker protocol files plus this complete committed
handoff. Fail closed to `agent-office-advisor` on any mismatch.

### Exact compiler closure

The complete authorized compiler set is the seven diagnostics already emitted
at the starting tip, reduced to these three files and enclosing symbols:

1. `src/application/organization/office-layout-config.ts` —
   `COMMITTED_OFFICE_LAYOUT_CONFIG_V1.roleCategoryByRole` lacks the exhaustive
   `STRATEGY` member required by the widened role union. Add only the smallest
   semantically neutral category entry needed for exhaustiveness.
2. `src/application/slack-pilot/service.ts` —
   `As1SlackPilotService.materializeFromTransport()` passes the widened
   Advisor-or-Strategy `profileId` to the Advisor-only
   `buildNewMissionIntake`, `buildContinuationIntake`, and
   `buildAdvisorPointer` contracts. Apply only the smallest local,
   discriminant-based narrowing that preserves the existing legacy-only
   materialization invariant. Do not widen those three artifact contracts.
3. `src/runtime/as1-slack-pilot/composition.ts` — the widened
   `LiveState.profile` reaches three Advisor-only legacy consumers:
   `As1ExactTransport` construction in the pointer-delivery path,
   `As1EvidenceIngress` construction in `projectAcceptedEvidence()`, and the
   `As1Outbox` profile in `buildStatusOutbox()`. Apply only the smallest shared
   or local discriminant-based narrowing that preserves the existing path
   invariant. Do not widen those consumer contracts.

No other compiler diagnostic, file, symbol, cleanup, or inferred follow-on is
authorized. No redesign, refactor, framework, type-contract widening, cast that
hides an unproved invariant, profile/configuration change, descriptor change,
credential access, service operation, tmux actor input, Foundation input,
documentation change, test edit, or live activation is authorized. Preserve
the approved readiness-seal delta exactly.

### Exact execution and evidence

Run only `npm run build:core`. If a narrowing changes executable runtime
control flow rather than compile-time typing alone, additionally run only the
same two focused commands from the prior amendment, by exact file and exact
`-t` title, with one worker. Run ESLint only on source files actually changed
within the three-file allowlist. Then run
`git diff --check 2e9e73eab13e8f9450ab1952b13542a9845dd26b..HEAD`
after the candidate commit. Do not run a broad suite, complete test file,
broad lint, separate typecheck, dashboard/full build, profile/design command,
or live proof.

Stage only changed source paths from the three-file allowlist, verify the staged
diff, commit one coherent compile-closure candidate, and push non-force only to
`origin/feature/strategy-entrypoint-migration-001`. Then append factual
changed-path, diagnostic-closure, command/result, candidate, push-state,
behavior-impact, and rollback evidence to the existing
`artifacts/strategy-entrypoint-migration/WORKER_RESULT.md`; update
`WORKER_RESULT_POINTER.txt` to the exact candidate; and leave only those two
evidence edits for Advisor publication. Return the candidate and evidence to
`agent-office-advisor`, then STOP. The same independent Reviewer alone will
review this compile-closure delta and build evidence. Timebox: 6 minutes; return
one exact remaining compiler blocker sooner if this frozen scope cannot close
the build.

## Leo Delta Amendment: Fixed Strategy Answer Actions (2026-07-18)

Status: `ACTIVE`

Advisor instruction gate: `PROCEED_WITH_LIMITS`. This amendment supersedes only
the PERSONAL direct answer-command behavior for the two closed Strategy
profiles. Every legacy Advisor behavior and every other boundary above remains
in force. Exact clean, pushed starting tip:
`ec42c61e78c97916cbce97831f34d3eb906bb3b8`.

Dispatch only the existing Agent Office Worker, `agent-office-opus` pane `%16`.
Re-verify the Worker runtime binding, required Worker entry/protocol files,
branch/worktree/upstream equality, and this complete committed handoff before
acting. Fail closed to `agent-office-advisor` on any mismatch.

### Exact behavior delta

1. In `src/runtime/as1-slack-pilot/cli.ts`, keep the existing legacy `answer`
   verb/action, parsing, fixed `AS1_PERSONAL_LEO_ONLY_STATE_ROOT`, output, and
   behavior byte-for-byte. Add exactly two closed verbs/actions:
   `answer-agent-office-strategy` and `answer-foundation-strategy`.
2. Each new action accepts only bounded answer text under the same closed text
   validation as legacy `answer`. It internally selects exactly one already
   committed fixed root:
   - `answer-agent-office-strategy` ->
     `/home/leo/.local/state/agent-office/strategy-agent-office-v1`
   - `answer-foundation-strategy` ->
     `/home/leo/.local/state/agent-office/strategy-foundation-v1`
   No root, profile, path, channel, thread, command, or environment operand;
   no env-based selection; no inferred/scanned root; no generic lookup/router.
   Reuse the existing bounded answer action/spool only; add no spool or storage.
3. In `src/runtime/as1-slack-pilot/composition.ts`, make only the fixed pasted
   answer instruction in `deliverPersonalDirect()` exhaustive by the closed
   live profile:
   - legacy Advisor profiles retain the current pasted command byte-for-byte,
     including the existing
     `AGENT_OFFICE_AS1_PHASE_B_LIVE_PILOT_001` prefix and legacy `answer` verb;
   - `AGENT_OFFICE_STRATEGY` pastes
     `npm --prefix /home/leo/Project/.worktrees/agent-office/AGENT_OFFICE_STRATEGY_ENTRYPOINT_MIGRATION_001 run as1:slack-pilot -- answer-agent-office-strategy "<bounded answer text>"`;
   - `FOUNDATION_STRATEGY` pastes the identical fixed migration-worktree prefix
     with `answer-foundation-strategy`.
   Selection is only by the already-bound closed profile literal, never by a
   message/caller/env value. Preserve message bytes, destination validation,
   buffer lifecycle, correlation recording, FIFO/result consumption, and Slack
   projection behavior unchanged.
4. Strategy itself receives the normal Leo message and invokes its matching
   fixed command only after deciding its final response. Advisor remains an
   internal actor. Add no Advisor-to-Slack projection and no path that treats a
   raw Advisor answer as the Strategy response.

### Frozen files and gates

The only writable implementation/test paths are:

- `src/runtime/as1-slack-pilot/cli.ts`
- `src/runtime/as1-slack-pilot/composition.ts`
- `tests/operations/as1-slack-lifecycle.test.ts`
- `tests/integration/as1-slack-live-composition.test.ts`

Tests may change only as needed to prove the two new closed verbs/fixed roots,
the two exact Strategy paste commands, rejection of caller-selected routing,
and byte-for-byte preservation of the legacy pasted command. Run only these
focused tests by exact file and exact `-t` title, with one worker:

1. Existing lifecycle test: `binds fixed Strategy commands and roots without caller-selected routing`.
2. A single focused live-composition test titled exactly:
   `pastes fixed Strategy answer verbs while preserving the legacy Advisor answer command`.
3. Existing legacy proof: `handles two sequential PERSONAL_LEO_ONLY messages with same-thread replies and dedupe`.

Run changed-file ESLint only on paths actually changed within the four-file
allowlist, exactly one `npm run build:core`, and after the candidate commit
`git diff --check ec42c61e78c97916cbce97831f34d3eb906bb3b8..HEAD`.
Run no other test, unfiltered file, suite, broad lint/typecheck/build, profile,
design, live proof, or activation.

No other source/test/doc/config/descriptor/profile/package/lockfile/state root,
credential, service, tmux actor, Foundation input/launch, architecture,
database, Git-evidence path, refactor, framework, or cleanup is authorized.
Do not stop/restart or interact with the live owner or any Strategy/Foundation
actor pane.

Stage only the exact allowlisted changed paths, verify the staged diff, commit
one coherent candidate, and push non-force only to
`origin/feature/strategy-entrypoint-migration-001`. Then append factual delta,
focused-gate, behavior-preservation, candidate, and push evidence to the
existing `WORKER_RESULT.md`; update `WORKER_RESULT_POINTER.txt`; leave only
those two evidence edits for Advisor publication. Return to
`agent-office-advisor` and STOP. The same independent Reviewer alone reviews
this delta. Timebox: 15 minutes; return one concrete blocker sooner.

## Leo Delta Amendment: Persistent Foundation Strategy Owner (2026-07-18)

Status: `ACTIVE`

This amendment supersedes only the implementation delta, writable paths,
gates, and timebox above. Baseline is pushed clean tip
`7a37ff8ba9ff229358181f0f302a21960423b44e`.

### Exact live-proven cause and correction

The fixed Foundation entry receives and answers one PERSONAL event, then halts
as `OWNER_HALTED:AUTHORITY_ARTIFACT_INVALID:CLEANUP_PROVEN`; one operational
retry is rejected as `PROFILE_LATCHED`. In `runForegroundOwner()` in
`src/runtime/as1-slack-pilot/cli.ts`, the existing PERSONAL branch already
calls `consumePersonalResult()`, clears `delivered`, resets the current message,
and continues the sequential receive loop. The defect path is its outer catch,
which unconditionally calls `As1GatewayComposition.latchActiveProfileAndStop()`.
That method in `src/runtime/as1-slack-pilot/composition.ts` applies the legacy
owner-error latch/disconnect/`finishCleanup()` path and produces the observed
`AUTHORITY_ARTIFACT_INVALID:CLEANUP_PROVEN`; the next `startStrategyDirect()`
then observes the durable profile latch.

Inspect only those exact functions and the existing PERSONAL completion/reset
neighborhood. Implement only the smallest closed correction that prevents the
legacy `latchActiveProfileAndStop()` path from halting/latching a PROVEN ordinary
completed PERSONAL Foundation Strategy result and lets the already-existing
PERSONAL FIFO/sequential loop continue. Do not add a loop, reconnect, retry,
daemon, timer, scheduler, or lifecycle framework. Preserve fail-closed latching
for actual corruption, non-PERSONAL failures, ambiguous completion, explicit
stop, and incident kill.

The existing fixed Foundation profile/root/descriptor, Socket owner,
`takeNextPersonal()` FIFO, dedupe, direct tmux delivery, answered-result spool,
same-thread Web result, `resetForNextLeoRoot()`, and explicit clean-stop path
must be reused unchanged except for the minimum lifecycle discrimination above.
Preserve one-answer response discipline: one event produces one substantive
final Slack answer; no user-facing preamble, internal command/log, or
post-confirmation; terminal evidence may show the substantive result once only.

The only writable paths are:

- `src/runtime/as1-slack-pilot/cli.ts`
- `src/runtime/as1-slack-pilot/composition.ts`
- `tests/integration/as1-slack-live-composition.test.ts`

Omit any production path not required by the exact correction. Add or amend
exactly one focused regression titled:

`keeps the fixed Foundation Strategy entry receiving across two sequential messages without restart`

It must exercise the real fixed Foundation entry with two sequential PERSONAL
messages in one owner process, prove one same-thread substantive answer per
message, prove no preamble/log/post-confirmation Slack posts, and prove the owner
remains receiving after the second result until the existing explicit clean
stop. Run only that exact test by file/title with one worker, ESLint only on
actually changed allowlisted paths, and after the candidate commit
`git diff --check 7a37ff8ba9ff229358181f0f302a21960423b44e..HEAD`.
Run no build, other test, unfiltered file, suite, broad lint/typecheck, live
proof, profile/state operation, or activation.

No framework, daemon/systemd, new storage/spool, routing/profile/descriptor/
config/credential/state-root change, docs, package/lockfile, refactor, broad
read, or unrelated cleanup is authorized. Do not touch Foundation owner `%62`,
Agent Office state/latch, rollback `%52`, any Strategy/Foundation actor pane,
or live input.

Stage only exact allowlisted changed paths, verify the staged diff, commit one
candidate, and push non-force only to
`origin/feature/strategy-entrypoint-migration-001`. Then append factual delta,
focused-gate, candidate, and push evidence to existing `WORKER_RESULT.md` and
update `WORKER_RESULT_POINTER.txt`; leave only those two evidence edits for
Advisor publication. Return to `agent-office-advisor` and STOP. Worker timebox:
9 minutes; return one concrete blocker sooner. The same existing independent
Reviewer alone reviews this delta in the remaining 3 minutes.

## Leo Delta Amendment: Sanitized Pre-Latch Classification Diagnostic (2026-07-18)

Status: `ACTIVE`

This amendment supersedes the persistent-owner implementation amendment above.
Baseline is pushed clean tip
`37b9661fc20ac691c66235c92e72a6582c0c3be6`. This is diagnostic-only: do not
change lifecycle behavior or attempt the Foundation repair.

In `runForegroundOwner()`'s existing outer catch in
`src/runtime/as1-slack-pilot/cli.ts`, preserve and emit only the already-sanitized
pre-latch error classification before the unchanged call to
`latchActiveProfileAndStop()`. Use only the existing `redactError(error)` result;
never read or emit the raw error/message, stack, path, credential, input, payload,
or arbitrary text. Preserve the existing error code, latch, disconnect, cleanup,
`CLEANUP_PROVEN`, return state, and all non-diagnostic behavior byte-for-byte.

The only writable paths are:

- `src/runtime/as1-slack-pilot/cli.ts`
- `tests/integration/as1-slack-live-composition.test.ts`

Add or amend one focused test titled exactly:

`reports the sanitized pre-latch classification before unchanged cleanup`

It must prove the closed sanitized classification is present before the existing
cleanup detail, the raw-message sentinel is absent, and latch/cleanup/result
behavior is unchanged. Run only that exact test by file/title with one worker,
ESLint only on the two changed files, and after the candidate commit
`git diff --check 37b9661fc20ac691c66235c92e72a6582c0c3be6..HEAD`.
Run no build, other test, unfiltered file, suite, broad lint/typecheck, live
proof, profile/state action, or activation.

No state/queue/Socket/Slack/routing/profile/descriptor/config/credential change,
new diagnostic framework, docs, package/lockfile, refactor, broad read, or
cleanup is authorized. Do not touch Foundation `%62`, Agent Office state/latch,
rollback `%52`, any actor pane, or live input.

Stage only the two allowlisted paths, verify the staged diff, commit one
candidate, and push non-force to
`origin/feature/strategy-entrypoint-migration-001`. Append factual delta, focused
gate, candidate, and push evidence to existing `WORKER_RESULT.md`; update
`WORKER_RESULT_POINTER.txt`; leave only those two evidence edits for Advisor
publication. Return to `agent-office-advisor` and STOP. Worker timebox: 4
minutes. The same existing independent Reviewer gets a 2-minute narrow review.

## Leo Delta Amendment: One-Shot Foundation Diagnostic-Latch Retirement (2026-07-18)

Status: `ACTIVE`

This amendment supersedes every earlier Worker amendment. Baseline is clean,
pushed tip `b1d91e9b0a1864849806adcfa60d823d1b14bf98`. Implement only a one-shot,
closed Foundation diagnostic-latch retirement. It must be fixed internally to:

- state root `strategy-foundation-v1` (the already-committed fixed Foundation
  Strategy state root; no caller/root/path operand);
- profile slug `foundation-advisor`;
- reason `owner-loop error: AUTHORITY_ARTIFACT_INVALID`;
- `latchedAt` `2026-07-18T16:15:44.312Z`.

Reuse the existing retirement safety shape: current process owns the control
lock; global state is exactly `DISABLED_CLEAN`; active profile is null; global
kill is clear; incident admission is open; the strictly parsed latch matches all
four fixed identity fields above; persist canonical `latched: false` before
updating the cache. Any root/profile/reason/time/state/ownership/kill/incident,
read, parse, or persistence mismatch must mutate nothing and return
`NOT_RETIRED`. A later latch, including the same reason at any other timestamp,
must never be retired.

Invoke this operation only from the fixed `FOUNDATION_STRATEGY`
`startStrategyDirect()` path, immediately before its existing
`isProfileLatched(slug)` check. The Agent Office Strategy and legacy Advisor
paths remain byte-for-byte behaviorally unchanged. Do not add a generic
retirement API, caller-selectable input, command, fallback, scan, or reset.

The only writable implementation/test paths are:

- `src/operations/readiness/as1-slack-control.ts`
- `src/runtime/as1-slack-pilot/composition.ts`
- `tests/integration/as1-slack-live-composition.test.ts`

Add only the minimum focused coverage in that existing test file, with titles:

- `retires only the exact Foundation diagnostic latch before fixed Strategy direct start`
- `refuses wrong or future Foundation diagnostic latches`

Prove exact-match retirement and successful continuation to the existing fixed
Foundation Strategy start boundary; prove wrong reason and same-reason later
`latchedAt` both remain latched and return `PROFILE_LATCHED`, with no Socket arm
or unrelated mutation. Do not touch live state.

Run only those two named tests, ESLint on exactly the three changed files, and
`git diff --check b1d91e9b0a1864849806adcfa60d823d1b14bf98..HEAD` after the candidate
commit. Run no build, broad test, suite, broad lint/typecheck, live action,
credential/config probe, service, Foundation input, refactor, docs/design, or
unrelated cleanup.

Stage only the three allowlisted paths, verify the staged diff, commit one
candidate, and push non-force to
`origin/feature/strategy-entrypoint-migration-001`. Append factual delta, gate,
candidate, and push evidence to existing `WORKER_RESULT.md`; update
`WORKER_RESULT_POINTER.txt`; leave only those two evidence edits uncommitted for
Advisor publication. Return to `agent-office-advisor` and STOP within 12
minutes. The same existing independent Reviewer gets a three-minute exact-delta
review after Advisor publication.

## Leo Delta Amendment: One-Shot Agent Office Malformed-Frame Latch Retirement (2026-07-18)

Status: `ACTIVE`

This amendment supersedes every earlier Worker amendment. Baseline is clean,
pushed tip `a571ce8c346be5e6b86bd8026e0a7b9b7028c2cb`. Implement only a one-shot,
closed Agent Office malformed-frame latch retirement fixed internally to:

- state root `strategy-agent-office-v1` (the already-committed fixed Agent
  Office Strategy state root; no caller/root/path operand);
- profile slug `agent-office-advisor`;
- reason `malformed frame after ready`;
- `latchedAt` `2026-07-18T15:20:22.170Z`.

Reuse the reviewed one-shot safety shape: current process owns the control lock;
global state is exactly `DISABLED_CLEAN`; active profile is null; global kill is
clear; incident admission is open; the strictly parsed latch matches every
fixed identity field above; persist canonical `latched: false` atomically before
updating the cache. Any root/profile/reason/time/state/ownership/kill/incident,
read, parse, or persistence mismatch must mutate nothing and return
`NOT_RETIRED`. A later latch, including the same reason at another timestamp,
must never be retired.

Invoke this operation only from the fixed `AGENT_OFFICE_STRATEGY`
`startStrategyDirect()` path, immediately before its existing
`isProfileLatched(slug)` check. The Foundation Strategy and legacy Advisor paths
remain behaviorally unchanged. Do not add a socket/parser change, generic
retirement API, caller-selectable input, command, fallback, scan, or reset.

The only writable implementation/test paths are:

- `src/operations/readiness/as1-slack-control.ts`
- `src/runtime/as1-slack-pilot/composition.ts`
- `tests/integration/as1-slack-live-composition.test.ts`

Add only these two focused tests in the existing test file:

- `retires only the exact Agent Office malformed-frame latch before fixed Strategy direct start`
- `refuses wrong or later Agent Office malformed-frame latches`

Prove exact-match retirement and continuation past the existing fixed Agent
Office Strategy latch check; prove wrong reason and same-reason later
`latchedAt` both remain latched and return `PROFILE_LATCHED`, with no Socket arm
or unrelated mutation. Do not touch live state.

Run only those two named tests, ESLint on exactly the three changed files, and
`git diff --check a571ce8c346be5e6b86bd8026e0a7b9b7028c2cb..HEAD` after the candidate
commit. Run no build before review, broad test, suite, broad lint/typecheck,
socket/parser investigation, live action, credential/config probe, service,
Foundation action/input, refactor, docs/design, or unrelated cleanup.

Stage only the three allowlisted paths, verify the staged diff, commit one
candidate, and push non-force to
`origin/feature/strategy-entrypoint-migration-001`. Append factual delta, gate,
candidate, and push evidence to existing `WORKER_RESULT.md`; update
`WORKER_RESULT_POINTER.txt`; leave only those two evidence edits uncommitted for
Advisor publication. Return to `agent-office-advisor` and STOP within 10
minutes. The same existing independent Reviewer gets a three-minute exact-delta
review after Advisor publication.
