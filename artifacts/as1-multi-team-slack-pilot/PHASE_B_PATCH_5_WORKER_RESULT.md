# AS1 Phase B Worker Patch 5 Result

## Verdict

`PATCH_COMPLETE_PENDING_INDEPENDENT_DELTA_REVIEW`

Patch 5 closes the two open findings of independent delta review 79
(`NEEDS_PATCH`) — F01-A (CRITICAL) and F01-B (CRITICAL) — and the dependent F06,
inside the exact six-path lock. No design change, no framework, no path expansion,
no risk acceptance. The accepted F02–F05 behavior, the private Leo-only
one-profile-at-a-time boundary, the writer-lock v1 record / fixed-state-root
contract, and the default-disabled descriptor are preserved. The same independent
Reviewer must delta-review the Patch 4 → Patch 5 source.

## Supersession (explicit)

This result SUPERSEDES two inaccurate claims of the Patch 4 result
(`PHASE_B_PATCH_4_WORKER_RESULT.md`), which review 79 proved wrong:

1. **"complete closure" of F01.** Patch 4 wove the incident guard into the
   startup/transport/evidence/outbox ports but NOT into the actual live inbound
   Slack callback: the callback constructed `As1InboundService` over the RAW store
   and gate and awaited a raw `envelope.acknowledge`, so a SIGUSR2 during one of
   the service's internal awaits (`persistReceipt`→`insertDedupe`→`openTransport`,
   `openTransport`→`commitPreAckDecision`, `acknowledge`→`commitTransportAck`,
   materialization, and `recoverPreAckDecision`) could still begin the next durable
   side effect. F01-A closes exactly that inbound path.
2. **"a writer-lock RELEASE failure retains ownership and engages a fallback
   kill."** That inference is unsafe: once the fixed namespace leaf is unlinked (or
   is proven absent / not this owner's), a second owner may already hold it, so an
   old-owner fallback kill is an authority-bearing mutation against a lock this
   owner no longer holds. F01-B makes release phase-aware: RELEASED/LOST cede
   authority with NO fallback; only a pre-unlink failure with the leaf still
   positively this owner's lock RETAINS and fallback-kills.

The Patch 1–4 result/pointer files are immutable historical evidence and are NOT
edited; this Patch 5 result records the corrected state and reports INDEPENDENTLY
observed totals.

## Authority and candidate

- Mission: `AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_PILOT_001`
- Phase: `B_PRIVATE_LEO_ONLY_LIVE_COMPOSITION_PATCH_5`
- Actor / session: Agent Office Worker (`agent-office-opus`)
- Worktree: `/home/leo/Project/.worktrees/agent-office/AGENT_OFFICE_AS1_PHASE_B_LIVE_PILOT_001`
- Branch: `feature/as1-phase-b-live-pilot-001`
- Starting / prior product HEAD (exact, upstream-equal): `3165e7470e7e69658aaa1b627d7cd47767478043`
- Patch 4 source candidate (review-79 subject): `0ab4782a79133111513fb11bc9ef62c197ed08da`
- Governance HEAD / upstream: `17c1a684b6269e201dd9ef44f7354c8473b1a9c6`
- Brief: `advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/80_PHASE_B_WORKER_PATCH_5_BRIEF.md`
  (SHA-256 `605a43df8c16acad70bf4d46a55853b6236a2210e89377cfaef9bd5ccbbce32d`)
- Run prompt: `.../80A_PHASE_B_WORKER_PATCH_5_RUN_PROMPT.md`
  (SHA-256 `8dfc38e65b4ebd5e7d9e2cd323da2595cdbf0e49c0dd9109f0acc6ca3ec58ecd`)
- Independent review: `advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/79_PHASE_B_PATCH_4_INDEPENDENT_DELTA_REVIEW_RESULT.md`
  - Review-result commit: `d669bdbbae00493ca62051c632210649d36f984b`; SHA-256:
    `f5a2e7a0bb17236ad39db378cfad4624f32d290066c6defa3e8efe2040ee237a`; verdict: `NEEDS_PATCH`
- Patch 5 source candidate (this result's frozen subject): `cca0cb5e2485c029b6d1715e37abf9bc55c548bd`
- Model / mode / effort / skill: Opus 4.8 (1M context) / Ultracode / max / `/fable-builder`

## Exact scope

Six-path lock (all six changed), plus this result + pointer as new evidence:

| Path | ± | Role |
|---|---|---|
| `src/runtime/as1-slack-pilot/composition.ts` | 74 | F01-A inbound-callback guard + test-only `decorateInboundStore`; F01-B close-outcome consumption |
| `src/operations/readiness/as1-slack-control.ts` | 46 | F01-B `As1ControlCloseOutcome`; phase-aware `close()` |
| `src/persistence/file-store/writer-lock.ts` | 198 | F01-B `releaseAuthority()` phase-aware outcome + deterministic handle close |
| `tests/integration/as1-slack-live-composition.test.ts` | 221 | F01-A 6 inbound-callback adversarial cases; F01-B freed/retained composition cases; retained-handle close |
| `tests/operations/as1-slack-lifecycle.test.ts` | 40 | F01-B post-unlink concurrent-owner test; F05 release-delegation regex |
| `docs/operations/AGENT_OFFICE_AS1_SLACK_SETUP.md` | 19 | F06 setup §10.4 truth |

`DIFFSTAT 3165e747 → cca0cb5`: 6 files, 520 insertions, 78 deletions. No other
path changed; `service.ts`, `cli.ts`, package/lock, descriptor, Registry, schema,
UI, Phase A, AS1 governance, and immutable earlier evidence are untouched.

## F01-A — incident domination inside the actual live inbound callback

`composition.ts` `start()` now decorates the inbound service's collaborators with
the SAME construction-bound proxies already used for the startup/transport/evidence
/outbox ports:

- `const service = new As1InboundService(boundContext, grant,
  this.incidentGuardedPort(inboundStore), this.incidentGuardedPort(gate));`
- the Socket callback wraps the ACK continuation:
  `acknowledge: this.incidentGuardedCallback(() => envelope.acknowledge())`.

`incidentGuardedPort` re-asserts `assertIncidentAdmissionOpen()` immediately BEFORE
and AFTER every collaborator method promise; `incidentGuardedCallback` does the same
around the ACK. An incident that closes admission during one internal await
therefore rejects the callback before the service begins its next store / transport
/ ACK / bind-consume / materialization side effect. The `As1InboundService`
contract and source are unchanged. Because the ONE guarded service instance is also
used by `service.recoverPending()` (already under `guardedAwait` from Patch 4), the
same per-op guard now covers the pre-ACK recovery path. A test-only
`decorateInboundStore` dependency (undefined and inert in production) lets a test
inject a mid-op incident on the internally-opened store.

Ordered-deferred proof through the registered Socket callback (all six new; each
also proves the incident routes EXACTLY ONCE through the durable kill — the callback
performs no kill itself, the owner's single `incidentKill` engages one
`DISABLED_LATCHED`, and a second route is refused):

| Incident arrives during | Guard prevents | Durable observable (fix) |
|---|---|---|
| receipt persistence (`persistReceipt`) | `openTransport` | transport record is `null` |
| dedupe/open (`insertDedupe`) | `openTransport` | transport record is `null` |
| root bind (`bindFirstRoot`) | `commitPreAckDecision` | stays `PREACK_PENDING` |
| Slack ACK (`envelope.acknowledge`) | `commitTransportAck` | not `TRANSPORT_ACK_RECORDED`/`MATERIALIZED` |
| result materialization (`persistIntakeArtifact`) | `persistPointerArtifact`/`commitMaterialized` | stays `TRANSPORT_ACK_RECORDED`, no intake |
| pre-ACK recovery (`recoverPreAckDecision`→`bindFirstRoot`) | `commitPreAckDecision` | stays `PREACK_PENDING`; revert routes one durable kill |

## F01-B — phase-aware WriterLock release and one-writer authority

`writer-lock.ts` adds `releaseAuthority(hooks?)` returning a phase-aware
`WriterLockReleaseOutcome`:

- **RELEASED** — the fixed namespace leaf is unlinked. `this.released` is set BEFORE
  the post-unlink directory fsync / retained-handle close, so authority is ceded
  IRREVOCABLY; a post-unlink fsync/close failure (or the injected
  `afterNamespaceUnlink` seam) is surfaced as a `cleanupAmbiguity` ONLY — never
  retained authority, never a fallback write.
- **RETAINED** — a PRE-unlink `unlink` failure while `assertForegroundIdentity()`
  still positively proves the fixed leaf is this owner's lock (dev/ino/type/one-link
  /mode/uid + exact canonical-plus-one-LF bytes). The lock and retained handle are
  kept (the sole writer may fallback-kill).
- **LOST** — ownership is not positively proven (leaf gone or identity mismatch,
  pre-unlink). No unlink, no fallback; the retained handle is closed.

The retained no-follow descriptor is closed DETERMINISTICALLY on every
released/lost path via `closeRetainedHandle()` (never left for GC). `release()`
keeps throwing on a non-clean outcome by delegating to `releaseAuthority()`, so the
out-of-lock `event-store.ts` contract is preserved (its F05 test now asserts the
delegate message `did not prove a clean namespace release (LOST:`).

`as1-slack-control.ts` `close()` now returns `As1ControlCloseOutcome`
(`authorityCeased` + `cleanupAmbiguity`): it drops the lock and ceases authority on
RELEASED/LOST and keeps it ONLY on RETAINED. `composition.ts` `finishCleanup`
performs the sole-writer fallback kill ONLY when `!closeOutcome.authorityCeased`
(RETAINED); an authority-ceased close with a RELEASE/LOST ambiguity surfaces the
ambiguity with NO kill. `revertStartupFailure` consumes the same outcome with no
additional fallback; `As1GatewayComposition.close()` re-throws `GATEWAY_DISABLED`
only on a non-clean outcome (cli.ts compatibility).

Deterministic injection proofs:

- **pre-unlink EACCES** (integration, `chmod locks 0o500`) → RETAINED + durable
  fallback-kill → `DISABLED_LATCHED`, `killEngaged`; the retained handle is then
  closed deterministically (see FileHandle note).
- **freed namespace** (integration, `unlink writer.lock` before stop) → LOST → NO
  fallback kill, state stays `DISABLED_CLEAN`, `killEngaged=false`.
- **post-unlink failure with concurrent owner** (lifecycle) — inside
  `afterNamespaceUnlink` a SECOND writer acquires the freed leaf at the exact
  interleaving, then a durability failure is thrown → outcome `RELEASED`,
  `isReleased()` true, the second writer holds the lock, and the old lock's
  idempotent re-release performs ZERO authority-bearing mutation.

## F06 — evidence and operator truth

`AGENT_OFFICE_AS1_SLACK_SETUP.md` §10.4 now (a) includes the live inbound callback's
own inbound store, control gate, and Slack-ACK continuation in the incident-guard
coverage, naming inbound receipt persistence, the dedupe/open transition, the Slack
ACK, pre-ACK recovery, and result materialization; and (b) replaces the inaccurate
"a writer-lock RELEASE failure retains ownership and engages a fallback kill" with
the phase-aware behavior (a freed/unlinked or unproven leaf IRREVOCABLY cedes
authority with a surfaced RELEASE/cleanup ambiguity and NO old-owner fallback kill;
only a pre-unlink failure with the leaf still positively this owner's retains +
sole-writer fallback-kills; the retained no-follow descriptor is closed
deterministically on every released/lost path). Only wording proved after F01
closes was changed. Generic zero-operand observers, local-vs-owner argv separation,
one selected profile/client, the fixed root, live-disabled restart, and the
default-disabled descriptor wording are preserved. §10.2's "no writer-lock residue"
capability-gate line is unrelated and unchanged.

## Validation (all `--maxWorkers=1`; independently observed)

| Gate | Result |
|---|---|
| Two changed focused files (`as1-slack-live-composition` 51 + `as1-slack-lifecycle` 55) | `106/106` PASS |
| Exact focused Phase B suite (5 files: live-composition, exact-transport, evidence-ingress, outbound, lifecycle) | `188/188` PASS |
| Full established AS1 suite (19 files) | `412/412` PASS |
| Read-only typecheck (`tsc --noEmit -p tsconfig.json`) | PASS (exit 0) |
| Core build (`tsc -p tsconfig.build.json`) | PASS (exit 0) |
| ESLint over the 5 changed TypeScript paths | PASS (exit 0, 0 errors) |
| `git diff --check` | PASS (clean) |
| Exact 6-path scope; prior evidence + descriptor byte-unchanged | PASS |
| Default-disabled descriptor byte identity | PASS (`sha256 8e3b9985…802f5d7`, `enabled:false`) |
| Secret / dynamic-target / unsafe-Git scans over the added diff | PASS (no token/key literal; no added `child_process`/`exec`/`spawn`/`process.kill`/`eval`/tmux command; no Git push/force/dynamic-ref) |
| FileHandle-on-GC warning (brief §6) | ABSENT across 3 consecutive integration runs after the retained-handle close fix |

Totals vs Patch 4: full AS1 `404 → 412` (+8); focused Phase-B five files
`180 → 188` (+8); `as1-slack-live-composition` 44 → 51 (+7 F01-A/F01-B cases);
`as1-slack-lifecycle` 54 → 55 (+1 F01-B post-unlink test). No test was skipped;
no gate hung.

## Adversarial pre-fix proof (fail on baseline behavior, then pass)

- **F01-A (6 inbound-callback cases):** reverting the inbound wrapping to the raw
  `new As1InboundService(…, inboundStore, gate)` + raw `acknowledge` (the
  `3165e747` / Patch 4 behavior) while keeping the new tests makes ALL SIX fail —
  ACK reaches `TRANSPORT_ACK_RECORDED`; receipt and dedupe/open leave a
  `PREACK_PENDING` transport (not null); bind and recovery advance to
  `PREACK_ROOT_BOUND`; materialization completes so the guarded delivery resolves
  instead of rejecting. All six pass on the fix. The pre-existing B05 gate re-checks
  alone do NOT close them — each case isolates the exact next durable mutation the
  per-op guard prevents. Neutralization reverted; the guard restored and re-verified.
- **F01-B (concurrent-owner + freed-namespace):** neutralizing `releaseAuthority`
  to the baseline-equivalent "a post-unlink failure ⇒ RETAINED" makes the lifecycle
  post-unlink test fail (`expected 'RETAINED' to be 'RELEASED'` — the old owner
  would retain while a second writer holds the freed leaf). Neutralizing the LOST
  path to "identity failure ⇒ RETAINED" makes the integration freed-namespace test
  fail (`RETAINED` instead of `LOST` → a stale fallback latch). Both pass on the
  fix. Neutralizations reverted; the fix restored and re-verified green.

No product mutation was left by any adversarial pass (`grep` confirmed zero
`ADV-NEUTRALIZED` residue before committing).

## FileHandle-on-GC warning (brief §6)

Absent from the new bounded runs. Root cause: the F01-B RETAINED path INTENTIONALLY
keeps its O_EXCL descriptor open (a live owner holds it for the process lifetime —
correct, and closed on every LOST/RELEASED path in production, verified in
`writer-lock.ts`). The prior warning came from the RETAINED-path integration TEST
abandoning that composition; the test now restores permissions and calls
`composition.close()` to close the retained descriptor DETERMINISTICALLY. Verified
absent across three consecutive `as1-slack-live-composition` runs and in the 5-file
and 19-file suites.

## Failures / retries / corrections (recorded honestly)

1. **bindFirstRoot stage observable.** The first draft asserted `readTransport ===
   null` for the bind stage, but `openTransport` precedes the bind, so the record
   already exists. A uniform "not materialized" observable was then tried and found
   NON-adversarial (the pre-existing B05 gate re-checks also stop materialization).
   Corrected to STAGE-SPECIFIC observables that isolate the exact next mutation the
   guard prevents (`null` for receipt/dedupe; `PREACK_PENDING` for bind/recovery;
   `TRANSPORT_ACK_RECORDED` for materialization) — each proven adversarial.
2. **Pre-ACK recovery seeding.** The recovery test needs a durable `PREACK_PENDING`
   record at startup without latching the shared control. A first owner seeds it via
   a THROWING (non-incident) `bindFirstRoot` decorator, then a CLEAN stop
   (`DISABLED_CLEAN`, record survives) releases the lock; a second owner reuses the
   state root and takes the incident during recovery. `startAgentOfficeComposition`
   gained an optional `stateRoot` to reuse the root.
3. **ESLint (3 errors on new test code).** `require-await` on a non-awaiting async
   ACK stub → non-async returning `Promise.resolve()`; `no-unnecessary-type-
   conversion` on `String(methodName)` → `${methodName}`; `no-unnecessary-condition`
   on a closure-mutated `second` local → a holder object `{ second }`. Re-verified
   green.

## Attestations

- **No secret access.** No secret file read, parse, or value use; the test
  descriptor points at a synthetic fixture only.
- **No live I/O.** No Slack / network connection, no live tmux observation or input,
  no real process signal — all incidents are synthetic in-process
  `closeIncidentGateNow()`; all locks are temp-dir fixtures.
- **No owner-state / activation.** No owner-state initialization, no descriptor
  activation (byte-unchanged, `enabled:false`), no live pilot, no restart of a live
  owner.
- **Runtime identity.** Executed as the registered Agent Office Worker
  (`agent-office-opus`) in the product worktree on `feature/as1-phase-b-live-pilot-001`;
  no sub-agent, no delegated/substitute context, no self-review, no next mission.
- **Git safety.** No write to `main`/protected branch, no force push, no unrelated
  staging; only the 6 authorized paths + this result/pointer.

## Rollback

`git revert cca0cb5e2485c029b6d1715e37abf9bc55c548bd` (source), plus the result and
pointer commits, restores the exact `3165e747` baseline; the change is confined to
the isolated default-disabled feature branch and touches no live system.

## Git cleanliness / upstream

Branch `feature/as1-phase-b-live-pilot-001` was clean and upstream-equal
(`0/0`) at `3165e747` before work. The untracked offline-gate `node_modules`
symlink (→ sibling `AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_PILOT_001/node_modules`) was
never committed and was REMOVED before the commit sequence. The source candidate is
`cca0cb5`; the result and pointer follow in separate evidence-only commits; the
branch is non-force pushed to `origin/feature/as1-phase-b-live-pilot-001`.

## Limitations

- All proofs are synthetic (no live Slack, tmux, secret, signal, or activation),
  as required by the brief; this validates the guard/release LOGIC, not a live
  pilot.
- The F01-B RETAINED path does NOT retry an ambiguous release (by design): the sole
  writer holds the lock until process exit and reports the ambiguity truthfully.
- The pre-ACK recovery proof depends on the recovery gate being actionable at
  `recoverPending` (the owner is RECEIVING for the slug when recovery runs); a
  disabled/latched owner skips recovery entirely, which is a separate (already
  fail-closed) path.

## Return

Returned to `agent-office-advisor`. Proposed next actor: `agent-office-advisor`
(may dispatch the independent Reviewer for the Patch 4 → Patch 5 source-first delta
review). STOP.
