# AS1 Phase B R2 Recovery Worker Validation-Patch Result

## Verdict

`PATCH_PARTIAL — F01 CLOSED, F02 HOLD, F03 CORRECTED`

Bounded same-Worker validation patch on the accepted R2 implementation (handoff 95,
governance `92d20ffe`). F01 (exact status ordering + durable failure barriers) is
closed. **F02 (the fixed no-argument production preservation helper) returns HOLD**
per the handoff ESCALATION_TRIGGER — it cannot be safely represented here — and the
inaccurate "helper exists" claim is removed. F03 corrects the prior evidence. No
design restart; exact 8-path allowlist (6 changed); the prior Worker
result/pointer is preserved immutable and corrected here, not edited.

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
- **This patch commit: `1c28adde13def91d9be75e75abd4040049caf367`** (direct parent `04e8e017`)

## Exact changed paths and diff summary

`04e8e017 → 1c28add`: **6 files, 453 insertions, 34 deletions** (within the 8-path
allowlist; `cli.ts` and `writer-lock.ts` were not needed and are unchanged).

| Path | Change |
|---|---|
| `src/application/slack-pilot/outbox.ts` | F01: `assertStatusOrderable` + `checkStatusOrdering`; guard at `sendStatus` entry + before every durable/Web side effect |
| `src/runtime/as1-slack-pilot/composition.ts` | F01: durable classifier re-reads (deliverPending entry/pre-transport/pre-retain; ingest entry + each checkpoint); `haltProgression` on non-DELIVERED status; ACCEPTED barrier at trigger; DELIVERY_CONFIRMED no-projection; recovery no-arm |
| `docs/operations/AGENT_OFFICE_AS1_SLACK_SETUP.md` | F02 HOLD (§10.6); removed §10.1 original-root literal |
| `tests/integration/as1-slack-outbound.test.ts` | F01 ordering proofs (all phases, conflict, own-record, cross-owner recovery, mid-send recheck) |
| `tests/integration/as1-slack-live-composition.test.ts` | F01 composition proofs (entry re-classify refuses delivery; DELIVERY_FAILED-before-ACK barrier) |
| `tests/operations/as1-slack-lifecycle.test.ts` | F02 HOLD + forensic-only original-root-literal proofs |

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
| `vitest run` the 3 focused files (outbound, live-composition, lifecycle) | `157/157` PASS; no FileHandle-on-GC warning |
| `npm run build:core` | PASS (exit 0) |
| `git diff --check` | CLEAN |
| Exact path scope | 6 of 8 authorized paths + this result/pointer; no other path |
| Old-root path / old stateRootId comparison in `src` | EMPTY / EMPTY |
| Original-root STATE-ROOT literal outside §10.6 | NONE (only §10.6) |
| Descriptor byte identity | `sha256 8e3b9985…802f5d7` UNCHANGED |
| Secret / redaction / no-real-root-operation scan | PASS (only the existing `xoxb-…placeholder` test fixture; no real secret; no added exec/kill/tmux/Git-mutation; no real-root operation) |

F01 focused proofs demonstrate the defect: the ordering tests would post an
out-of-order / behind-a-barrier status without the guard; the composition tests would
deliver / project behind a durable failure record without the re-reads.

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

`git revert 1c28adde13def91d9be75e75abd4040049caf367` (plus this result/pointer)
restores `04e8e017`. A source revert restores no active original-root reference and
never re-enables it; no original-root immutable flag/digest/bytes are affected (none
were ever touched).

## Git status / push / upstream

Branch was clean and upstream-equal (`0/0`) at `04e8e017` before work. `node_modules`/
`dist` are gitignored and never staged. The patch commit is `1c28add`; the result and
pointer follow in separate evidence-only commits; the branch is non-force pushed to
`origin/feature/as1-phase-b-live-pilot-001` and is upstream-equal after push.

## Return

Returned to `agent-office-advisor`. F02 is HELD and requires an Advisor/Leo decision
(a later dedicated preservation-helper Work Unit with real-filesystem authority, or an
accepted design amendment). Proposed next actor: `agent-office-advisor`. STOP.
