# AS1 Phase B R2 Recovery F01 Patch 2 Result

## Verdict

`F01-R1 CLOSED — F02 HOLD (unchanged, not part of this patch)`

Bounded same-Worker two-path correction closing the independent review's finding
**F01-R1** (result 97, verdict `NEEDS_PATCH`, review commit `d8f3f1ac`). The
`REQUEST_STARTED` resume and the shared reconciliation performed durable latch +
`MANUAL_RECONCILIATION_REQUIRED` writes with **no fresh status-ordering recheck**, and
`reconcile` was never passed the guard, so a disqualifying failure sibling introduced
after the entry check could be followed by another durable latch/phase write behind the
failure barrier. This patch routes the status-ordering guard and the exact current outbox
phase through every resume/reconciliation durable side effect, reconciles the
`STORE_QUARANTINED` catch with the same per-side-effect contract without weakening the
mandatory B08 latch, and adds six adversarial proofs. No general refactor. F02 remains an
activation-blocking HOLD and was not touched.

## Session and authority

- Mission / phase: `AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_PILOT_001` /
  `PHASE_B_R2_RECOVERY_F01_PATCH_2`
- Actor / session: Agent Office Worker (`agent-office-opus`)
- Model / mode / effort / skill: Opus 4.8 (1M context) / Claude Code · Worker / max /
  `/fable-builder` (`SKILL.md` SHA-256
  `9a5afeefd34775a918b83900aa19859278f4e151a067cf6ab82cb6a25757091b`)
- Worktree / branch: product worktree / `feature/as1-phase-b-live-pilot-001`
- Exact patch parent (verified clean, upstream-equal `0/0`):
  `5911a5bad0b3eb617556929fa9a06040bd533905`
- Accepted R2 design: `a837bbf9d4072638a6dac676fb5ccc8da9bfa1ff`
- Governance handoff 98 read from foundation-docs worktree; independent review result 97
  (`…INDEPENDENT_IMPLEMENTATION_REVIEW_RESULT.md`) and its finding F01-R1 read directly.
- **This patch commit: `1666cb0`** (direct parent `5911a5b`)

## Exact changed paths and diff summary

`5911a5b → 1666cb0`: **2 files, 222 insertions, 22 deletions** — exactly the two authorized
code/test paths; no other path. `cli.ts`, `composition.ts`, `writer-lock.ts`, the setup
doc, the lifecycle test, descriptor, store/schema, package, and every F02 file are unchanged.

| Path | Change |
|---|---|
| `src/application/slack-pilot/outbox.ts` | F01-R1: per-side-effect status-ordering rechecks in the `REQUEST_STARTED` resume and in `reconcile` (now takes `statusGuard` + truthful `phase`); `checkStatusOrdering` re-throws non-ordering DomainErrors so `STORE_QUARANTINED` reaches the B08 latch |
| `tests/integration/as1-slack-outbound.test.ts` | Six adversarial proofs + test-only seams (`onLatch`, `decorateStore`) that introduce a disqualifying sibling at each previously uncovered awaited boundary |

## F01-R1 — the correction (contract → code)

`runOutbox` `REQUEST_STARTED` resume (was: unconditional `latch` then
`MANUAL_RECONCILIATION_REQUIRED` write):
- recheck status ordering immediately **before the interrupted-request latch** and again
  immediately **before the MANUAL phase write**;
- on refusal, preserve the exact `REQUEST_STARTED` phase and return the fixed
  `REJECTED_CONTROL` (no resend, no substitute status). A refusal **before** the latch
  performs no latch and no phase write; a sibling appearing during/after that mandatory
  latch is caught **before** the MANUAL write — the latch has already fired, but no MANUAL
  phase is written and no status progresses.

`reconcile(outboundId, attempts, reason, statusGuard, phase)` (was:
`reconcile(outboundId, attempts, reason)` — unconditional latch + MANUAL write, no guard):
- recheck status ordering immediately **before the reconciliation latch** and again
  immediately **before the MANUAL phase write**, preserving the exact `phase` on refusal;
- every call site now passes the **truthful current phase** — `PREPARED` for the pre-start
  request-hash mismatch (line reached before the PREPARED/REQUEST_STARTED writes), and
  `REQUEST_STARTED` for every post-`REQUEST_STARTED` path (control-not-sendable before
  send/response-write/response-record, malformed success, ambiguous failure, and both
  attempts-exhausted returns).

`checkStatusOrdering` (item 5): returns `REJECTED_CONTROL` **only** for a status-ordering
violation (a `GATEWAY_DISABLED` error whose fixed redacted message begins `status-ordering:`)
and **re-throws** every other `DomainError`. A `STORE_QUARANTINED` raised while the guard
reads the sibling/own records therefore reaches the mandatory B08 `guardQuarantine` latch
(`REJECTED_STORE` + profile latch, no phase write, no Web call, no progression) instead of
being masked as an ordering refusal. The accepted status-ordering invariant and the
mandatory quarantine-latch invariant are both preserved; no HOLD was required.

Preserved unchanged: the accepted-evidence outbound path (`statusGuard === null` skips every
recheck and reconciles exactly as before), exact target derivation, deterministic
`as1status-`/accepted IDs, bounded retries, no-blind-resend of `REQUEST_STARTED`, one-use
authority, all redaction, and all existing failure behavior. No new abstraction beyond the
explicit phase/guard at the identified boundaries.

## Required adversarial tests (all in the outbound suite; each proven to FAIL with its fix reverted, then restored)

1. `REQUEST_STARTED` recovery refuses **before its latch** when a sibling appears at that
   boundary — REQUEST_STARTED preserved, resume latch not called, no MANUAL write, no Web.
2. A sibling appearing **after the recovery latch but before the manual write** prevents that
   write — REQUEST_STARTED preserved (the latch fired, no MANUAL write).
3. Shared reconciliation refuses **before its latch** on the malformed-response path —
   REQUEST_STARTED preserved, reconcile latch not called, no MANUAL write.
4. A sibling appearing **after the reconciliation latch but before the manual write** prevents
   that write — REQUEST_STARTED preserved (the reconcile latch fired, no MANUAL write).
5. The pre-start **request-hash mismatch** reconciliation reports the truthful `PREPARED`
   phase on a status-ordering refusal (not `REQUEST_STARTED`); no MANUAL write; no Web.
6. A `STORE_QUARANTINED` raised while the guard reads a sibling stays **fail closed (B08)**:
   `REJECTED_STORE`, the B08 latch fires, no outbox phase written, no Slack, no progression.

Existing normal-success, terminal replay, retry, own-record, and accepted-evidence tests
remain passing (36 pre-existing + 6 new = 42).

## Validation — focused gates (only the handoff-named commands)

| Gate | Result |
|---|---|
| `npx vitest run --maxWorkers=1 tests/integration/as1-slack-outbound.test.ts` | `42/42` PASS |
| `npx tsc --noEmit -p tsconfig.json` | PASS (exit 0) |
| `npx eslint src/application/slack-pilot/outbox.ts tests/integration/as1-slack-outbound.test.ts` | PASS (exit 0) |
| `npm run build:core` | PASS (exit 0) |
| `git diff --check 5911a5b..HEAD` | CLEAN |
| Exact final scope | 4 paths only: the two code/test paths (changed) + this result/pointer (new); no other path |
| Disabled descriptor byte-identity | `sha256 8e3b9985…802f5d7` UNCHANGED |
| Old R1-root literal / secret newly added in the diff | NONE |
| F02 files (setup doc, lifecycle test) | UNCHANGED |

Beyond the named gates, a targeted no-regression check ran the two DIRECT outbox callers
(`as1-slack-evidence-ingress`, `as1-slack-live-composition`, `95/95` PASS) to confirm the
accepted-evidence path (`statusGuard === null`) is byte-behaviour-preserved; the named
outbound suite is the primary proof of that. No Living Office, browser/visual, broad-product,
or full-AS1 sweep was run.

## Failures / retries / corrections (recorded honestly)

1. First test-3 draft used named-but-unused `postMessage` params (`_token`, `_request`);
   ESLint `no-unused-vars` (`args: after-used`) flagged both. Replaced with a no-arg override
   that seeds the sibling and returns the malformed response. No behaviour change.
2. Designing test 6 surfaced the real substance of handoff item 5: `checkStatusOrdering`
   previously caught EVERY `DomainError` as `REJECTED_CONTROL`, which would have masked a
   `STORE_QUARANTINED` and dropped the mandatory B08 latch. The narrow re-throw fix closes
   that within the same two paths; both invariants are preserved (no HOLD).
3. Advisor validation correction (comment accuracy, before final evidence): the first
   resume/reconcile comments overstated that every refusal performs "no latch". A refusal
   AFTER the mandatory latch (before the manual write) preserves the phase and prevents the
   MANUAL write, but the latch has already fired. Both comments were corrected to
   distinguish refusal-before-latch from refusal-after-latch. Behaviour and tests are
   unchanged (comment-only). As `191abf2` was not yet pushed, the correction was AMENDED
   into the single source/test patch commit, which is now **`1666cb0`**.

## Attestations

No secret access; no Slack/network; no owner-state init; neither real state root touched;
no descriptor activation (byte-unchanged); no owner started; no live destination
observed/mutated; no process signalled; no tmux delivery input; no sub-agent/delegation/
parallel context; no self-review; no next mission. All test seams are deterministic and
in-memory (synthetic tmpdir state root only).

## F02 — unchanged HOLD

F02 (the fixed no-argument production original-root preservation helper) remains an
activation-blocking **HOLD** and is explicitly **not part of this patch**. No F02 file was
edited; the prior F02 disposition and its escalation stand.

## Rollback

`git revert 1666cb0` restores `5911a5b` behaviour (F01-R1 reopens); no descriptor, state
root, or F02 artifact is affected (none were touched).

## Git status / push / return

Branch was clean and upstream-equal (`0/0`) at `5911a5b` before work. The source/test patch
is `1666cb0` (one commit; a comment-only Advisor accuracy correction was amended into it
while still unpushed); the result and pointer follow in separate evidence-only commits.
Explicit staging and non-force push only. Returned to `agent-office-advisor`. Activation
remains prohibited. STOP.
