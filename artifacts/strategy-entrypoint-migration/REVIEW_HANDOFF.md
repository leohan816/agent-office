# Independent Reviewer Delta Handoff: Strategy Connect Readiness Seal

Status: `ACTIVE`

MISSION_ID: `AGENT_OFFICE_STRATEGY_ENTRYPOINT_MIGRATION_001`

REVIEW_TYPE: `NARROW_STRATEGY_CONNECT_READINESS_SEAL_DELTA_REVIEW`

RESPONSIBLE_ADVISOR: `agent-office-advisor`

REVIEWER: the same existing independent `agent-office-reviewer`, pane `%28`,
using the `fable-sentinel` protocol

WORKTREE:
`/home/leo/Project/.worktrees/agent-office/AGENT_OFFICE_STRATEGY_ENTRYPOINT_MIGRATION_001`

BRANCH: `feature/strategy-entrypoint-migration-001`

DELTA_BASELINE: `677fd72ff8ed3b0a81bf2609fdb6f86607be2f84`

EXACT_CANDIDATE: `f869df08e6318befa84a6a0608ea3a9f65770ea7`

## Entry and independence

Before reviewing, verify the live model, effort, role, pane, readiness, exact
worktree, branch, candidate, upstream, and this committed launcher. Read
`AGENTS.md`, `CLAUDE.md`, `docs/agent/TEAM_OPERATING_MODEL.md`,
`docs/agent/roles/reviewer.md`, this handoff, and activate/follow
`fable-sentinel`. Fail closed to `agent-office-advisor` on any mismatch.

Inspect direct evidence; do not trust Worker or Advisor summaries. Review is
read-only. Do not implement, patch, stage, commit, push, change branch, dispatch,
use another agent/session, accept risk, grant approval, or start any service.

## Exact delta review

Review only
`677fd72ff8ed3b0a81bf2609fdb6f86607be2f84..f869df08e6318befa84a6a0608ea3a9f65770ea7`.
The candidate must change only
`src/runtime/as1-slack-pilot/composition.ts`, with one replacement in
`startStrategyDirect()`:

- the `socket.connect(...)` `readinessSeal` is
  `() => this.control.isConnectReady(slug)`, because Socket `hello` completes
  during connect before the later `RECEIVING_ONE_PROFILE` transition;
- the separate `buildSocket` receive-actionable callback and the later pre-arm
  receive-ready check remain `isReceiveReady(slug)`;
- transition order, tests, comments, CLI, profiles, service, routing, bindings,
  manifests, lockfiles, and every other source/doc/config path are unchanged.

The authorized environment-only dependency restoration was
`npm install ws@8.21.1 --no-save`. Verify `ws` resolves to exactly `8.21.1` and
that no package manifest or lockfile differs; do not install or modify anything.

## Reproduction gates

Run only these exact focused gates in the mission worktree:

1. Vitest file-qualified test 4 with one worker and exact `-t` title:
   `runs isolated Strategy FIFO routes with exact same-thread results and message-local failure`.
2. Vitest file-qualified test 5 with one worker and exact `-t` title:
   `binds fixed Strategy commands and roots without caller-selected routing`.
3. ESLint only on `src/runtime/as1-slack-pilot/composition.ts`.
4. `git diff --check 677fd72ff8ed3b0a81bf2609fdb6f86607be2f84..f869df08e6318befa84a6a0608ea3a9f65770ea7`.

Do not run another test, a complete unfiltered file, broad lint, typecheck,
build, profile, design, live proof, activation, or unchanged-surface review. Do
not inspect or contact the rollback worktree/service or any Foundation session.

## Result contract

Return exactly one verdict: `PASS`, `PASS_WITH_RISK`, `NEEDS_PATCH`, or `FAIL`.
List findings first with exact file/line evidence; state explicitly if there are
no findings. Record the exact reproduced gates and any residual risk. The only
writable outputs are:

- `artifacts/strategy-entrypoint-migration/REVIEW_RESULT.md`
- `artifacts/strategy-entrypoint-migration/REVIEW_RESULT_POINTER.txt`

Leave those two outputs uncommitted for Advisor publication, return the pointer
to `agent-office-advisor`, and STOP. The verdict is independent review evidence,
not risk acceptance, final approval, or next-mission authority.

## Leo Delta Amendment: Strategy Compile Closure Review (2026-07-18)

Status: `ACTIVE`

This amendment supersedes only the delta/range and reproduction gates above.
Review only the compile-closure candidate and its committed Worker build
evidence. All independence, read-only, output, routing, activation, credential,
service, actor-input, and STOP boundaries remain unchanged.

REVIEW_TYPE: `NARROW_STRATEGY_COMPILE_CLOSURE_DELTA_REVIEW`

DELTA_BASELINE: `8066e74ed7f1b91f842468f1f528fcbfa5633c1c`

EXACT_CANDIDATE: `269d777a09c3657fee273246403280de33b7b8ef`

The same existing independent Reviewer in pane `%28` must verify its exact
binding and this committed handoff, then inspect direct evidence for only:

1. `src/application/organization/office-layout-config.ts` — the exhaustive
   `STRATEGY` entry in
   `COMMITTED_OFFICE_LAYOUT_CONFIG_V1.roleCategoryByRole`.
2. `src/application/slack-pilot/service.ts` — the local Advisor-profile
   discriminant narrowing in `materializeFromTransport()` before the three
   existing Advisor-only artifact builders, with none of those contracts
   widened.
3. `src/runtime/as1-slack-pilot/composition.ts` — the discriminant-based
   Advisor-profile narrowing used only at the three existing Advisor-only
   `As1ExactTransport`, `As1EvidenceIngress`, and `As1Outbox` consumers, with
   none of those contracts widened.
4. The Worker build evidence in `WORKER_RESULT.md` and
   `WORKER_RESULT_POINTER.txt`, including candidate/push identity and the exact
   seven-diagnostic closure.

Reject any redesign, broad refactor, hidden assertion/cast, contract widening,
behavioral expansion, readiness-seal regression, or change outside the three
compiler-named source files. The only acceptable executable effect is a
fail-closed invariant guard if an impossible Strategy profile reaches a legacy
Advisor-only path.

Run only `npm run build:core`, ESLint only on the three changed source files,
and
`git diff --check 8066e74ed7f1b91f842468f1f528fcbfa5633c1c..269d777a09c3657fee273246403280de33b7b8ef`.
Do not run tests, another build, broad lint/typecheck, profile/design commands,
live proof, activation, or any credential/service/actor probe. Review no prior
unchanged surface.

Append the compile-closure verdict and exact reproduced evidence to the existing
`REVIEW_RESULT.md`, update `REVIEW_RESULT_POINTER.txt` to this candidate, leave
only those two files uncommitted for Advisor publication, return to
`agent-office-advisor`, and STOP. Timebox: 3 minutes; return one exact finding or
blocker sooner.

## Leo Delta Amendment: Fixed Strategy Answer Actions Review (2026-07-18)

Status: `ACTIVE`

This amendment supersedes only the delta/range and reproduction gates above.
Review only the fixed Strategy answer-actions candidate and its committed Worker
evidence. All independence, read-only, output, routing, activation, credential,
service, actor-input, and STOP boundaries remain unchanged.

REVIEW_TYPE: `NARROW_FIXED_STRATEGY_ANSWER_ACTIONS_DELTA_REVIEW`

DELTA_BASELINE: `0dd25b4602d223ee577f4917707b3ba1f8fb8464`

EXACT_CANDIDATE: `d806f98acf0c5eef9b3f7153b50a7b26da6b7f15`

The same existing independent Reviewer in pane `%28` must verify its exact
binding and this committed handoff, then inspect direct evidence for only:

1. `src/runtime/as1-slack-pilot/cli.ts` — exactly two closed Strategy answer
   verbs, each internally fixed to its already-committed Strategy state root,
   with bounded answer text and no caller-selected root/profile/path/env.
2. `src/runtime/as1-slack-pilot/composition.ts` — exhaustive closed-profile
   selection of the pasted answer command, preserving the legacy Advisor
   command byte-for-byte and selecting the matching fixed migration-worktree
   command for each Strategy profile.
3. `tests/operations/as1-slack-lifecycle.test.ts` and
   `tests/integration/as1-slack-live-composition.test.ts` — only the focused
   binding/paste proofs and the named legacy preservation proof.
4. The committed Worker evidence in `WORKER_RESULT.md` and
   `WORKER_RESULT_POINTER.txt`, including candidate/push identity and the
   disclosed duplicate-build process deviation.

Reject any generic router, caller-selected operand, inferred/scanned root,
new spool/storage, Advisor-to-Slack projection, legacy-answer behavior change,
profile/config/service/Foundation change, broad refactor, or file outside the
four-file candidate allowlist.

Do not run `npm run build:core`; the duplicate invocation is a disclosed process
deviation and Leo prohibited a replacement build. Reproduce only these three
named focused tests:

1. `binds fixed Strategy commands and roots without caller-selected routing`
2. `pastes fixed Strategy answer verbs while preserving the legacy Advisor answer command`
3. `handles two sequential PERSONAL_LEO_ONLY messages with same-thread replies and dedupe`

Also run ESLint only on the four changed files and
`git diff --check 0dd25b4602d223ee577f4917707b3ba1f8fb8464..d806f98acf0c5eef9b3f7153b50a7b26da6b7f15`.
Do not run a build, broad test/lint/typecheck, profile/design command, live proof,
activation, or credential/service/actor probe. Review no prior unchanged surface.

Append the fixed-answer-actions verdict and exact reproduced evidence to the
existing `REVIEW_RESULT.md`, update `REVIEW_RESULT_POINTER.txt` to this candidate,
leave only those two files uncommitted for Advisor publication, return to
`agent-office-advisor`, and STOP. Timebox: 5 minutes; return one exact finding or
blocker sooner.

## Active diagnostic amendment — sanitized pre-latch classification

Status: `ACTIVE`

Review baseline `ff3877c` against exact candidate
`086fde66b838056aeeef3703b202295c7ccb6a56` read-only. Scope is exactly:

- `src/runtime/as1-slack-pilot/cli.ts`
- `tests/integration/as1-slack-live-composition.test.ts`

Reproduce only the named test `reports the sanitized pre-latch classification
before unchanged cleanup`, ESLint on exactly those two files, and
`git diff --check ff3877c..086fde66b838056aeeef3703b202295c7ccb6a56`.
Run no build, broad check, or live/state action. Review only this diagnostic
delta, write only the existing review result and pointer outputs, return PASS or
one exact blocker to `agent-office-advisor`, and STOP within two minutes.

## Active one-shot Foundation diagnostic-latch retirement review

Status: `ACTIVE`

Review baseline `7ca7508` against exact candidate
`ecde0f211dffee5bb52f2b3c41e94c8b02bd439c` read-only. Scope is exactly:

- `src/operations/readiness/as1-slack-control.ts`
- `src/runtime/as1-slack-pilot/composition.ts`
- `tests/integration/as1-slack-live-composition.test.ts`

Confirm the retirement is closed to state root `strategy-foundation-v1`, slug
`foundation-advisor`, reason `owner-loop error: AUTHORITY_ARTIFACT_INVALID`, and
`latchedAt` `2026-07-18T16:15:44.312Z`; retains the existing ownership,
`DISABLED_CLEAN`, null-active, kill-clear, incident-open, strict-parse, mutex,
and persist-before-cache checks; and runs only in the fixed
`FOUNDATION_STRATEGY` `startStrategyDirect()` path immediately before the
existing latch check. A wrong or later latch must remain latched.

Reproduce only the named tests `retires only the exact Foundation diagnostic
latch before fixed Strategy direct start` and `refuses wrong or future
Foundation diagnostic latches`, ESLint on exactly the three files, and
`git diff --check 7ca7508..ecde0f211dffee5bb52f2b3c41e94c8b02bd439c`.
Run no build, broad check, or live/state action. Write only the existing review
result and pointer outputs, return PASS or one exact blocker to
`agent-office-advisor`, and STOP within three minutes.
## ACTIVE AMENDMENT — Agent Office malformed-frame latch retirement

Authority: Advisor publication baseline `2a2ed98`; review candidate
`4c8d6dbd672e485977eb85e011ba883d5e644903`. This amendment supersedes every
earlier review scope.

Review only this exact three-file delta:

- `src/operations/readiness/as1-slack-control.ts`
- `src/runtime/as1-slack-pilot/composition.ts`
- `tests/integration/as1-slack-live-composition.test.ts`

Verify the one-shot retirement is internally fixed to `strategy-agent-office-v1`,
`agent-office-advisor`, reason `malformed frame after ready`, and latchedAt
`2026-07-18T15:20:22.170Z`; preserves the reviewed ownership,
`DISABLED_CLEAN`, null-active, kill-clear, incident-open, and
persist-before-cache checks; runs only for `AGENT_OFFICE_STRATEGY` immediately
before its existing latch check; and refuses every mismatched or later latch.

Reproduce only the two named focused tests `retires only the exact Agent Office
malformed-frame latch before fixed Strategy direct start` and `refuses wrong or
later Agent Office malformed-frame latches`; ESLint only the exact three files;
and `git diff --check 2a2ed98..4c8d6dbd672e485977eb85e011ba883d5e644903`.
No build, broad test, live action, Foundation action, implementation, or patch.
Write only the existing `REVIEW_RESULT.md` and `REVIEW_RESULT_POINTER.txt`, then
return PASS or one concrete blocker within three minutes and stop.
## ACTIVE AMENDMENT — fixed Strategy status stream

Authority: Advisor publication baseline `d38dc2e`; review candidate
`2267318dfd8d7d096d55e5536685ef59d2fec0b5`. This amendment supersedes every
earlier review scope. Return PASS or one concrete blocker within four minutes.

Review only this exact five-file delta:

- `src/adapters/gateways/slack-pilot/personal-result-spool.ts`
- `src/runtime/as1-slack-pilot/composition.ts`
- `src/runtime/as1-slack-pilot/cli.ts`
- `tests/integration/as1-slack-live-composition.test.ts`
- `tests/operations/as1-slack-lifecycle.test.ts`

Verify only the closed behavior in handoff `d38dc2e`: exact trimmed four-control
interception after existing validation and before ordinary Strategy handling;
top-level/threaded binding and one acknowledgement; one subscription per fixed
root in the existing spool; two fixed-root CLI status actions with no caller
routing; consume/post/terminal exactly once without a second LLM or new storage;
the fixed `LEO_SLACK_MESSAGE:\n` ordinary-message label; unchanged FIFO and one
normal final answer; mandatory no-LLM heartbeat after 60 seconds since the last
status/liveness post and never more frequently; and stop cancellation, clear,
acknowledgement, and silence of later status actions.

Reproduce only the five exact named tests from the Worker handoff, ESLint only
the exact five files, and `git diff --check
d38dc2e..2267318dfd8d7d096d55e5536685ef59d2fec0b5`. No build, broad check,
implementation, patch, live action, or input to `%63`/PID `2819189` or
`%62`/PID `2782662`. Write only the existing `REVIEW_RESULT.md` and
`REVIEW_RESULT_POINTER.txt`, return the independent verdict, and STOP.
## ACTIVE AMENDMENT — Strategy-only status-stream guard correction

Authority: Advisor publication baseline `9dfdbb2`; review candidate
`68e94364aeee9105869ef0712f6b3838d9d00ebe`. This amendment supersedes every
earlier review scope. Return PASS or one concrete blocker within three minutes.

Review only:

- `src/runtime/as1-slack-pilot/composition.ts`
- `tests/integration/as1-slack-live-composition.test.ts`

Verify every status-stream behavior introduced by `2267318` is reachable only
for the two fixed Strategy profiles: control interception, subscription
instruction, status consumption/heartbeat, and `LEO_SLACK_MESSAGE:\n` labeling.
Verify the legacy PERSONAL Advisor production composition preserves its original
ordinary delivery and paste behavior, including a status-like message: no
interception, acknowledgement, subscription, status prompt, heartbeat, or new
label. Confirm the approved two-Strategy-profile behavior is unchanged.

Reproduce only the five existing exact named tests from handoff `d38dc2e` plus
`does not intercept or label status-like messages for a legacy Advisor profile`;
ESLint only the exact two changed files; and `git diff --check
9dfdbb2..68e94364aeee9105869ef0712f6b3838d9d00ebe`. No build, broad check,
implementation, patch, live action, or input to either live owner. Write only
the existing `REVIEW_RESULT.md` and `REVIEW_RESULT_POINTER.txt`, return the
independent verdict, and STOP.
## ACTIVE AMENDMENT — second exact Foundation latch tuple

Authority: Advisor publication baseline `f3e1e46`; review candidate
`a0cb0a93970d56d689e3d0e9e6daf3556f892c3a`. This amendment supersedes every
earlier review scope. Return PASS or one concrete blocker within three minutes.

Review only:

- `src/operations/readiness/as1-slack-control.ts`
- `tests/integration/as1-slack-live-composition.test.ts`

Verify only `retireOneShotFoundationDiagnosticLatch()` now accepts exactly the
prior fixed Foundation tuple or the second fixed tuple `malformed frame after
ready` at `2026-07-18T18:55:19.830Z`, with reason/timestamp paired, while the
fixed root/profile, every existing safety/no-mutation check, persist-before-cache
ordering, and unchanged `FOUNDATION_STRATEGY` pre-start hook remain intact.
Every other reason/time or cross-pairing must remain latched.

Reproduce only `retires the second exact Foundation malformed-frame latch before
fixed Strategy direct start` and `refuses any other Foundation latch reason or
timestamp`; ESLint only the exact two files; and `git diff --check
f3e1e46..a0cb0a93970d56d689e3d0e9e6daf3556f892c3a`. No build, broad check,
implementation, patch, live action, Foundation retry/state mutation, or Agent
Office action. Write only the existing `REVIEW_RESULT.md` and
`REVIEW_RESULT_POINTER.txt`, return the independent verdict, and STOP.
## ACTIVE AMENDMENT — subscribed status-forwarding instruction

Authority: Advisor publication baseline `df4a81f`; review candidate
`8d4d2394a294034ad1b1bd5b7938d541edfc9bfc`. Supersedes earlier review scope;
return PASS or one blocker within three minutes.

Review only `src/runtime/as1-slack-pilot/composition.ts` and
`tests/integration/as1-slack-live-composition.test.ts`. Verify only the
subscribed `STRATEGY_STATUS_INSTRUCTION` now mandates exactly-once bounded
forwarding of every new user-facing progress/finding/result block from the
Slack-origin turn or selected Advisor/Worker output, while excluding npm/tool
invocations, `Ran` headers, `REASON`/control lines, and duplicates. Verify
terminal-originated conversations and unsubscribed behavior remain unchanged.

Reproduce only `requires subscribed Strategy progress forwarding and omits it
when unsubscribed` and `delivers one status and one normal same-thread answer
exactly once`; two-file ESLint; and `git diff --check
df4a81f..8d4d2394a294034ad1b1bd5b7938d541edfc9bfc`. No build, broad test,
implementation, live action, or other file. Write only existing
`REVIEW_RESULT.md` and `REVIEW_RESULT_POINTER.txt`, return verdict, and STOP.
## ACTIVE AMENDMENT — silent status and bounded Strategy disconnect recovery

Authority: Advisor publication baseline `c318858`; review candidate
`3eedbe930a9989736351a6d599b1ad798dd6eaba`. Supersedes earlier review scope;
return PASS or one concrete blocker within three minutes.

Review only the exact six changed files: `src/application/slack-pilot/service.ts`,
`src/adapters/gateways/slack-pilot/socket-client.ts`,
`src/operations/readiness/as1-slack-control.ts`,
`src/runtime/as1-slack-pilot/composition.ts`,
`src/runtime/as1-slack-pilot/cli.ts`, and
`tests/integration/as1-slack-live-composition.test.ts`.

Verify: idle subscription posts nothing; all four fixed controls preempt a pending
ordinary result without disturbing ordinary FIFO; the first fixed-Strategy
provider disconnect removes only its generation without a durable latch, defers
one callback, clears subscription/pending status, posts exactly one fixed notice,
and reconnects/re-arms the same composition-owned socket once; failure cleanly
stops; later disconnects produce neither repeat notice nor repeat recovery and
do not leave a heartbeat loop; legacy transport behavior is unchanged; and only
the exact current Foundation provider-disconnect latch tuple is newly retired.
Confirm the focused tests exercise the actual transport disconnect seam rather
than only invoking a fake callback.

Reproduce only the four exact named tests, type-aware ESLint only the six changed
files, and `git diff --check
c318858..3eedbe930a9989736351a6d599b1ad798dd6eaba`. No build, broad test,
implementation, live/state action, `%63` action, or other file. Write only the
existing `REVIEW_RESULT.md` and `REVIEW_RESULT_POINTER.txt`, return verdict, and
STOP.

## ACTIVE AMENDMENT — disconnect-recovery two-layer test proof

Authority: Advisor publication baseline `a98b8e3`; review candidate
`41f46997a70f9925ae19ce96f71062fc87d397ae`. Supersedes earlier review scope;
return PASS or one concrete blocker within three minutes.

Review only the exact two-file test delta in
`tests/adapters/as1-slack-socket-client.test.ts` and
`tests/integration/as1-slack-live-composition.test.ts`, together with direct
read-only tracing of the already-reviewed production wiring named by the prior
amendment. Assess the combined proof that real `As1RawSocketTransport`
dispatches the provider-disconnect frame, cleanly removes the current
generation, defers its callback, takes no first durable latch, permits only one
recovery/no repeated notice, and sends a second/later disconnect through the
legacy durable-latch fallback, while the composition proof retains notice,
reconnect, next-message-once behavior and drives `runForegroundOwner` through
`isStrategyRecoveryStop` to its clean-stop terminal.

Reproduce only the existing four named cases plus exactly the two adapter seam
cases, type-aware ESLint only the two changed test files, and `git diff --check
a98b8e3..41f46997a70f9925ae19ce96f71062fc87d397ae`. No production change,
build, broad test, implementation, live/state action, `%63` action, or other
file. Write only the existing `REVIEW_RESULT.md` and
`REVIEW_RESULT_POINTER.txt`, return verdict, and STOP.

## ACTIVE AMENDMENT — Agent Office latch test evidence closure

Authority baseline: `336ae4e40ee14f20b3712fb9d7f4cafaed0e986d`; review candidate: `a6f884a1b74cdadbb823e173b3beeb7e947052f7`. Review only `tests/integration/as1-slack-live-composition.test.ts`; production source is unchanged.

Reproduce exactly the three launcher-named cases: `retires the exact Agent Office provider-disconnect latch and refuses a later one`, `preserves the existing Agent Office malformed-frame tuple and refuses mismatched retirement`, and `refuses a later or mismatched Agent Office provider-disconnect tuple`. Run only one-file type-aware ESLint and `git diff --check 336ae4e40ee14f20b3712fb9d7f4cafaed0e986d..a6f884a1b74cdadbb823e173b3beeb7e947052f7`; no source change, build, broad test, live/state action, `%62` action, or other file. Write only the two existing result files, return PASS or one concrete blocker within two minutes, and STOP.

## ACTIVE AMENDMENT — Agent Office provider-disconnect latch tuple review

Authority baseline: `98963bf`; review candidate: `336ae4e40ee14f20b3712fb9d7f4cafaed0e986d`. Supersedes earlier review scope.

Review only `src/operations/readiness/as1-slack-control.ts` and `tests/integration/as1-slack-live-composition.test.ts`. Verify that only the exact tuple root `strategy-agent-office-v1`, profile `agent-office-advisor`, reason `provider disconnect`, `latchedAt` `2026-07-19T01:09:11.410Z` is newly retired, all prior ownership/state/kill/incident/persist-before-cache gates remain, later and mismatched tuples refuse retirement, and the existing Agent Office pre-start hook is unchanged.

Reproduce only the three named focused latch cases, two-file type-aware ESLint, and `git diff --check 98963bf..336ae4e40ee14f20b3712fb9d7f4cafaed0e986d`. No build, broad test, implementation, live/state action, `%62` action, other file, or Agent Office activation. Write only the existing `REVIEW_RESULT.md` and `REVIEW_RESULT_POINTER.txt`, return PASS or one concrete blocker within three minutes, and STOP.

## ACTIVE AMENDMENT — files-bearing Slack text frame

Authority: Advisor handoff baseline `3434309`; review candidate
`a682fd90553b4379daf5029a26fc75ff74ee8a01`. Supersedes every earlier review
scope; return PASS or one concrete blocker within three minutes.

Review only the exact four-file delta in
`src/adapters/gateways/slack-pilot/socket-frame.ts`,
`tests/adapters/as1-slack-socket-frame.test.ts`,
`src/operations/readiness/as1-slack-control.ts`, and
`tests/integration/as1-slack-live-composition.test.ts`. Verify that only exact
`payload.event.files` metadata/content is excluded from the validation-only
deep walk, while raw envelope size, outer envelope validation, bounded
`event.text`, and malformed/oversize rejection remain fail-closed; no file
content is interpreted, copied, logged, downloaded, or routed, and ordinary
text behavior is unchanged. Verify the one-shot Foundation matcher accepts
only root `strategy-foundation-v1`, profile `foundation-advisor`, reason
`malformed frame after ready`, and `latchedAt`
`2026-07-19T07:03:17.125Z`, while refusing later/mismatched records and
retaining all existing safety checks.

Reproduce only the four exact named tests in the current launcher, type-aware
ESLint only these four files, and `git diff --check
3434309..a682fd90553b4379daf5029a26fc75ff74ee8a01`. No build, broad test,
implementation, live/state action, image handling, Agent Office action, or
other file. Write only the existing `REVIEW_RESULT.md` and
`REVIEW_RESULT_POINTER.txt`, return verdict, and STOP.
