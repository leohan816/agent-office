# AS1 Phase B R2 Recovery Worker Validation-Patch Result

## Verdict

`PATCH_PARTIAL — F01 CLOSED, F02 HOLD, F03 CORRECTED`

Bounded same-Worker validation patch on the accepted R2 implementation (handoff 95,
governance `92d20ffe`). F01 (exact status ordering + durable failure barriers) is
closed, INCLUDING the Advisor's exact F01 boundary corrections (validation
corrections 2/3/4/5 — defects 1–5) delivered as a **separate corrective source
commit `cd4b594`** on top of the F01 base `1c28add`. **F02 (the fixed no-argument
production preservation helper) returns HOLD** per the handoff ESCALATION_TRIGGER —
it cannot be safely represented here — and the inaccurate "helper exists" claim is
removed. F03 corrects the prior evidence. No design restart; exact 8-path allowlist
(F01 base touched 6 paths; the corrective train touched 5 F01 paths — `cli.ts` is
now used); the prior Worker result/pointer is preserved immutable and corrected here,
not edited.

## Session and authority

- Mission / phase: `AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_PILOT_001` /
  `PHASE_B_R2_RECOVERY_ADVISOR_VALIDATION_PATCH`
- Actor / session: Agent Office Worker (`agent-office-opus`)
- Model / mode / effort / skill: Opus 4.8 (1M context) / Claude Code · Ultracode /
  Ultracode / `/fable-builder` (`SKILL.md` SHA-256
  `9a5afeefd34775a918b83900aa19859278f4e151a067cf6ab82cb6a25757091b`)
- Worktree / branch: product worktree / `feature/as1-phase-b-live-pilot-001`
- Exact patch parent: `04e8e0170ea4e846480099e105788ef1255651ac`
- Original accepted R2 design commit: `a837bbf9d4072638a6dac676fb5ccc8da9bfa1ff`
- Prior source candidate / result / pointer: `89c11d21…`, `39e24fbe…`, `04e8e017…`
- Governance handoff (95 / run prompt 95A): `92d20ffe8fd1b58d617fce9f796f4d8c026fdbf2`
- **F01 base patch commit: `1c28adde13def91d9be75e75abd4040049caf367`** (direct parent `04e8e017`)
- **F01 corrective source commit: `cd4b594`** (direct parent `203fdc6`; validation corrections 2/3/4/5 — defects 1–5)

## Exact changed paths and diff summary

`04e8e017 → 1c28add` (F01 base): **6 files, 453 insertions, 34 deletions**.
`203fdc6 → cd4b594` (F01 corrective train): **5 files, 384 insertions, 17 deletions**
(both within the 8-path allowlist; `writer-lock.ts` never needed).

| Path | Change (base + corrective train) |
|---|---|
| `src/application/slack-pilot/outbox.ts` | F01 base: `assertStatusOrderable` + `checkStatusOrdering`; guard before every durable/Web side effect. Corrective: guard at TRUE `sendStatus` entry BEFORE all resume/terminal returns (defect 1); ACCEPTED idempotent terminal replay after a successful DELIVERY_CONFIRMED (correction 4) |
| `src/runtime/as1-slack-pilot/composition.ts` | F01 base: durable classifier re-reads; `haltProgression`; ACCEPTED barrier at trigger. Corrective: reclassify-after-send for DELIVERY_FAILED/PROCESSING_FAILED (defect 2); recovery no-arm (defect 3); `beforeIngest` re-read before `ingress.ingest` (defect 5); durable selected-profile latch preflight + truthful `PROFILE_LATCHED` reason (correction 5) |
| `src/runtime/as1-slack-pilot/cli.ts` | Corrective: owner loop checks `hasFailureBarrier()` BEFORE `observeReceiveGrantOnce()` (defect 4) |
| `docs/operations/AGENT_OFFICE_AS1_SLACK_SETUP.md` | F02 HOLD (§10.6); removed §10.1 original-root literal (base; unchanged by the corrective train) |
| `tests/integration/as1-slack-outbound.test.ts` | F01 ordering proofs + corrective: idempotent-ACCEPTED-after-CONFIRMED, no-over-open, terminal-own-record + new-sibling |
| `tests/integration/as1-slack-live-composition.test.ts` | F01 composition proofs + corrective: recovery no-arm (PROFILE_LATCHED), pre-terminal-ACCEPTED profile-latch restart, no-false-halt restart, mid-observation barrier, pre-durable DELIVERY_FAILED/PROCESSING_FAILED refusal, owner-loop barrier-before-observe |
| `tests/operations/as1-slack-lifecycle.test.ts` | F02 HOLD + forensic-only original-root-literal proofs (base; unchanged by the corrective train) |

## F01 — exact status ordering and durable failure barriers (CLOSED)

`outbox.ts`: `sendStatus` passes a status-ordering guard into the shared `runOutbox`;
`checkStatusOrdering` runs it at ENTRY and immediately before EACH durable/Web side
effect — the request-artifact/PREPARED write, the REQUEST_STARTED write, the Web
call, the response-artifact write, and the RESPONSE_RECORDED write. `assertStatusOrderable`
reads the ACCEPTED record + all four siblings over ALL durable phases and enforces:
every status after ACCEPTED requires ACCEPTED at RESPONSE_RECORDED; DELIVERY_CONFIRMED
begins only while both failure siblings are wholly absent; DELIVERY_FAILED only while
DELIVERY_CONFIRMED and PROCESSING_FAILED are absent; PROCESSING_FAILED only while
DELIVERY_FAILED is absent (may follow CONFIRMED); both failure records present is a
conflict; and it NEVER blocks a status's OWN record (the same-failure PREPARED
recovery). A violation preserves the exact outbox phase and returns REJECTED_CONTROL
(no resend, no reconcile). The branded accepted ACK/QUESTION/RESULT path passes `null`
and is byte-identical.

`composition.ts`: the DURABLE classifier (`classifyFailureSiblings`) is re-read at
`deliverPending` entry, immediately before exact transport, and before retaining the
accepted grant/lease pair; and at `ingestEvidenceAndProject` entry and before EVERY
evidence observation/checkpoint (handoff-95 F01 correction — previously only the
process-local `hasFailureBarrier` was checked at entry). A non-DELIVERED ACCEPTED or
DELIVERY_CONFIRMED, and an ACCEPTED recovery that reached REQUEST_STARTED/manual, now
durably latch, withhold the intake and any retained authority, and halt via a new
`progressionHalted` terminal (`hasFailureBarrier()` includes it) — no Socket arm, no
INTAKE/RESULT projection, no alternate status. A DELIVERY_FAILED barrier at the
ACCEPTED trigger enters the barrier instead of sending. Single foreground writer +
sequential owner loop preserved; no parallel sender.

### F01 boundary corrections (validation corrections 2/3/4/5 — corrective commit `cd4b594`)

Each correction has a focused test PROVEN adversarial (it fails without the fix; the
fix was temporarily reverted in-source and the named test observed to fail, then
restored):

1. **Defect 1 — guard at true entry.** `runOutbox` now runs the status-ordering guard
   at TRUE `sendStatus` entry, BEFORE the RESPONSE_RECORDED / MANUAL / REQUEST_STARTED
   resume returns (retaining every per-side-effect recheck). A terminal own-record no
   longer returns DELIVERED once a failure sibling appears later. *Test:* outbound "a
   terminal OWN record does NOT return DELIVERED once a failure sibling appears later".
2. **Defect 2 — no false durable barrier on a pre-durable failure send.** `deliverPending`
   (DELIVERY_FAILED) and `attemptProcessingFailure` (PROCESSING_FAILED) RECLASSIFY the
   durable siblings after the send; a send rejected before its first durable phase leaves
   the classifier OPEN → `haltProgression` on the exact non-delivered outcome, never a
   fabricated DELIVERY_FAILED/PROCESSING_FAILED barrier or record. *Tests:* live-composition
   "a DELIVERY_FAILED status REJECTED before its first durable phase …" (valid lease bound
   to a non-observed pane → STOPPED_BEFORE_PASTE, DELIVERY_CONFIRMED-only seed) and "a
   PROCESSING_FAILED attempted with ACCEPTED absent …" (ACK observation throws; ACCEPTED
   removed from the durable outbox index) — each asserts `PROGRESSION_HALTED`, not the
   `*_BARRIER`.
3. **Defect 3 — recovery no-arm.** `start()` refuses Socket arm / `connected` when
   `hasFailureBarrier()` after `recoverTerminalStatusAndAccepted`. *Test:* live-composition
   "a durable DELIVERY_FAILED record is a cross-restart barrier …" (now asserts
   `connected:false`, `socket.armed:false`, `reason:PROFILE_LATCHED`).
4. **Defect 4 — owner-loop barrier-before-observe.** `cli.ts` checks `hasFailureBarrier()`
   BEFORE `observeReceiveGrantOnce()` (after-observe check retained), so a Socket-callback
   barrier is never followed by a forbidden grant observation. *Test:* live-composition
   "checks the failure barrier BEFORE the grant re-observation …" (failed ACCEPTED post +
   diverged grant → DELIVERY_HALTED, not PROFILE_DIVERGED).
5. **Defect 5 — re-read before the durable evidence checkpoint.** `projectAcceptedEvidence`
   re-reads the durable classifier AFTER each evidence observation and IMMEDIATELY BEFORE
   `ingress.ingest`. *Test:* live-composition "re-reads the classifier AFTER the evidence
   observation and BEFORE the ingress checkpoint …" (lazy ACK observation writes the barrier
   mid-observe → zero `ACK:` ingress checkpoint).
6. **Correction 4 — idempotent ACCEPTED replay after DELIVERY_CONFIRMED.** §5.6 rule 6 /
   §5.7: only a FAILURE record is a barrier. `assertStatusOrderable` permits ACCEPTED's own
   RESPONSE_RECORDED replay when a successful DELIVERY_CONFIRMED exists and both failure
   siblings are absent (no duplicate post, no false mission halt); it still refuses ACCEPTED
   behind a failure barrier or a DELIVERY_CONFIRMED without a terminal ACCEPTED. *Tests:*
   outbound idempotent-replay + no-over-open; live-composition "restart with a durable
   DELIVERY_CONFIRMED does NOT falsely halt …".
7. **Correction 5 — truthful closed reason.** A recovery/restart barrier is a PROFILE latch,
   not the global kill, so the closed start reason is `PROFILE_LATCHED` (never
   `GLOBAL_LATCHED`). `start()` adds a durable selected-profile latch preflight
   (`control.isProfileLatched`) after grant/profile resolution and BEFORE any socket build —
   a durable prior-run latch surviving restart fails closed as `PROFILE_LATCHED` with no
   socket (rather than crashing the startup identity verifier). *Test:* live-composition "a
   prior pre-terminal ACCEPTED that halted progression durably profile-latches …".

## F02 — production preservation helper: HOLD

The complete fixed no-argument reviewed production helper required by design §4.4 is
**not delivered and not claimed to exist**. The Advisor validation correctly rejected
a partial draft; I did not substitute an unvalidated one. It cannot be represented as
a self-contained fixed literal in this Work Unit without weakening the design or
making a false claim, because:

1. the mandatory R2-only build-manifest proof (§4.4.1 — the installed executable and
   every loaded product module hash-match the reviewed build manifest) depends on
   INSTALL-TIME build data that cannot be embedded in a fixed literal and must not be
   reduced to a caller/env assertion; and
2. a root-privileged descriptor-relative forensic tool (mount-id enforcement, `/`-fd
   ancestor pinning, `FS_IMMUTABLE_FL` support, full identity/mtime/entry-set drift +
   final zero-write/immutable verification) cannot be validated without opening,
   inspecting, or mutating the real original root — which this handoff forbids.

Per the handoff ESCALATION_TRIGGER / §4 F02, this returns HOLD. Setup §10.6 now
states the HOLD explicitly, removes the "helper exists" claim and the rejected draft,
keeps the §4.4 ordered algorithm as the reviewed SPECIFICATION the later production
helper must implement, and keeps the TS `preserveOriginalRootTree` only as its
injected-seam ALGORITHM PROOF. §10.1 no longer names the original-root STATE-ROOT
literal; it appears ONLY in the §10.6 forensic section. Neither real root nor its
privilege was opened, inspected, probed, or mutated.

## F03 — evidence accuracy (corrections to the prior Worker result)

The prior R2 Worker result (`PHASE_B_R2_RECOVERY_WORKER_RESULT.md`, immutable, NOT
edited) is corrected here:

1. it did NOT contain a real fixed no-argument production preservation helper — it
   contained only the seam-driven synthetic TS algorithm (`preserveOriginalRootTree`);
   the setup document's prior implication of a production helper was inaccurate;
2. status ordering was NOT re-checked at every design-required side-effect boundary
   (the guard ran at selected outer boundaries only); this patch adds the
   status-specific guard at every outbox side effect and the durable classifier at
   every named composition boundary;
3. the prior setup document's "named ONLY in the forensic section" statement about
   the original root was false (§10.1 also named it); this patch removes that
   occurrence.

## Validation — delta gates (all `--maxWorkers=1`; independently observed)

| Gate | Result |
|---|---|
| ESLint over the changed TypeScript paths | PASS (exit 0) |
| `tsc --noEmit -p tsconfig.json` | PASS (exit 0) |
| `vitest run` the 3 focused files (outbound, live-composition, lifecycle) | `166/166` PASS (9 new corrective proofs) |
| `vitest run` the whole AS1 slack-pilot subsystem (8 files) | `347/347` PASS |
| `npm run build:core` | PASS (exit 0) |
| `git diff --check` | CLEAN |
| Exact path scope | corrective train touched 5 of 8 authorized paths (+ this result/pointer); no other path |
| Old R1-root literal / old stateRootId newly added in `src` | NONE (the 2 `as1-slack-pilot` diff hits are file-path headers) |
| Original-root STATE-ROOT literal outside §10.6 | NONE (only §10.6; unchanged by the corrective train) |
| Descriptor byte identity | `sha256 8e3b9985…802f5d7` UNCHANGED |
| Secret / redaction / no-real-root-operation scan | PASS (only the existing `xoxb-…placeholder` test fixture; no real secret; no added real exec/kill/tmux/network/Git-mutation; the corrective tests write only synthetic tmpdir state-root index files) |

F01 focused proofs demonstrate the defect: the ordering tests would post an
out-of-order / behind-a-barrier status without the guard; the composition tests would
deliver / project behind a durable failure record without the re-reads; and every
corrective proof was independently observed to FAIL with its fix reverted in-source
(then restored). Pre-existing, unrelated failures in `observation-coordinator` /
`runtime-composition` / `batch-gates` (git-verified canonical-manifest suites) fail
identically on the clean `203fdc6` baseline — they are environmental, outside this
allowlist, and were not touched.

## Failures / retries / corrections (recorded honestly)

1. The first §10.6 draft added a concrete Python helper literal; the Advisor
   validation flagged it as not the required production helper (caller-overridable
   invocation, manifest-as-assertion, omitted ancestor pinning, path-based parent
   open, missing mount-id/one-inode-set enforcement, incomplete drift/final
   verification, not self-contained). I removed it and returned F02 to HOLD rather
   than commit an unvalidated helper — no success is claimed from prose/comments.
2. Two focused tests needed updating after the F01 durable re-reads: the "renders
   each kind" outbound test now seeds ACCEPTED through legal phases first (ordering
   now requires it), and the DELIVERY_FAILED-before-ACK composition test now accepts
   the earlier loop-top barrier refusal (the durable re-read catches it before the
   ACK trigger). No source behavior was bent to a test.
3. Corrective train (defect 3): moving the recovery no-arm branch surfaced a real
   normal-restart regression — a durable prior-run profile latch made the fresh
   composition CRASH in the startup identity verifier (`AUTHORITY_ARTIFACT_INVALID`).
   Fixed by the selected-profile latch preflight (correction 5), returning the truthful
   `PROFILE_LATCHED` with no socket; the reason was corrected from a false `GLOBAL_LATCHED`.
4. Correction 4 was a genuine regression introduced by defect 1: moving the guard before
   the resume made a legitimate restart with ACCEPTED@RESPONSE_RECORDED +
   DELIVERY_CONFIRMED@RESPONSE_RECORDED reject the idempotent ACCEPTED replay and falsely
   halt the mission. The ACCEPTED ordering case was narrowed so only a FAILURE
   barrier/conflict (or a later status without a terminal ACCEPTED) refuses it.
5. A first attempt to seed the defect-3 pre-terminal ACCEPTED via a store decorator did
   not work because `live.store` (used by the outbox/classifier) is the RAW store, not
   the `decorateInboundStore`-wrapped store (which reaches only the inbound service). It
   was replaced with the accepted test-only seams: a failing ACCEPTED Web post; a lease
   bound to a non-observed pane (STOPPED_BEFORE_PASTE); and a direct `slack-outbox.json`
   index edit removing ACCEPTED — all synthetic tmpdir state, no product seam added.

## Attestations

No secret access; no Slack/network; no owner-state init; no R2 creation; no
original-root preservation/inspection/mutation; no real-root privilege probe; no live
tmux; no real signal; no descriptor activation (byte-unchanged); no pilot; no
sub-agent/delegation/parallel context; no self-review; no next mission. The ultracode
multi-agent tool was deliberately not used (fail-closed rules forbid delegated
contexts).

## Known limitations

- **F02 is a standing HOLD**: the real fixed no-argument production preservation
  helper and its real-filesystem/privilege support are a later explicit HOLD gate,
  never a weaker path-based/mode-bit-only fallback. The §4.4 algorithm spec + the
  seam-tested TS proof are the only preservation artifacts delivered.
- All F01 proofs are synthetic; no live Slack post or real status delivery occurred.

## Rollback

`git revert cd4b594` removes the F01 corrective train and restores the F01 base
`1c28add` behavior; `git revert 1c28add` (plus the result/pointer commits) further
restores `04e8e017`. A source revert restores no active original-root reference and
never re-enables it; no original-root immutable flag/digest/bytes are affected (none
were ever touched); the descriptor stays byte-unchanged throughout.

## Git status / push / upstream

Branch was clean and upstream-equal (`0/0`) at `04e8e017` before work. `node_modules`/
`dist` are gitignored and never staged; the untracked `.grok`/`grok*` files belong to
the main worktree and were never staged here. The F01 base is `1c28add`; the F01
corrective source is `cd4b594` (a separate corrective source commit, per validation
correction 2); this updated result and the pointer follow in separate evidence-only
commits; the branch is non-force pushed to `origin/feature/as1-phase-b-live-pilot-001`
and is upstream-equal after push.

## Return

Returned to `agent-office-advisor`. F02 is HELD and requires an Advisor/Leo decision
(a later dedicated preservation-helper Work Unit with real-filesystem authority, or an
accepted design amendment). Proposed next actor: `agent-office-advisor`. STOP.
