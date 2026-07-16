# AS1 Phase B Designer Result

MISSION_ID: `AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_PILOT_001`

PASS: `PHASE_B_F05_EXACT_BRIDGE_DESIGN_PATCH_3`

ACTOR: `agent-office-designer`

ROLE: `Agent Office Designer`

AUTHORITY: committed
`advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/56_PHASE_B_DESIGN_PATCH_3_HANDOFF.md`
at `6186503f7e2c45dacbce83869aa2579d4bf073bd`

PATCH_2_DESIGN_CANDIDATE_AND_PARENT: `1fad9734e83c751b911accffbb12d65df9e775c8`

FIRST_PATCHED_DESIGN_COMMIT: `7ed79bbfd7deea0f8458a3965734ebd1de98eb35`

INDEPENDENT_REVIEW_INPUT:
`advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/55_PHASE_B_DESIGN_DELTA_REVIEW_2_RESULT.md`
at governance commit `fea560eaea284e0b84d864d470cddd331568cdc8`

ACTIVE_SCOPE_CORRECTION:
`advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/47B_PHASE_B_SCOPE_AUDIT_AND_DESIGN_CORRECTION.md`
at `e070ee25b2f22635459bd8abf8841ab4f1925d0f`

ACTIVE_PRIVATE_SINGLE_USER_LOCK:
`advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/47D_PHASE_B_PRIVATE_SINGLE_USER_LOCK.md`
at `b159f5c33d6b07468d98253db39807fd0f7d15f1`

PRODUCT_BASELINE: `0dfb4398be2ecd9295b35a94e3b461e25dad6f7c`

PRODUCT_BRANCH: `feature/as1-phase-b-live-pilot-001`

DESIGN_STATE: `READY_FOR_EXACT_SAME_REVIEWER_F05_DELTA_REVIEW`

HOLD: `NO`

RUNTIME_IMPLEMENTATION: `NONE`

LIVE_ACCESS: `NONE`

IMPLEMENTATION_READINESS: `IMPLEMENTABLE_IF_INDEPENDENT_DESIGN_REVIEW_ACCEPTS_AND_ADVISOR_ISSUES_EXACT_HANDOFF`

PROPOSED_IMPLEMENTATION_PATH_COUNT: `14`

REVISED_COMPLETION_ESTIMATE: `3-5 hours`, excluding time waiting for Leo's two
Slack messages

RETURN_TO: `agent-office-advisor`

## Result

The smallest safe Phase B delta is implementable without changing the reviewed
AS1 authority schemas or introducing a database, Registry change, Exact
Delivery v2 change, service manager, UI, or external product-code change.

This bounded third patch changes only F05-D1. It preserves the same Reviewer's
closed F01, F02-D1, F03-R1, and F04 contracts and completes the sole remaining
exact bridge contract:

- F01 keeps the receive grant's frozen control/latch evidence hashes unchanged
  through delivery facts and gates live work with a separate construction-bound
  current control/latch predicate;
- F02-D1 accepts only
  `Buffer.concat([canonicalBytes(strictlyParsedPointer), Buffer.from("\n")])`,
  requires byte-equal disk contents, one raw SHA-256 for the grant and
  content-addressed filename, the scoped writer's 32-KiB ceiling, and
  `(mode & 0o077) === 0`, while retaining pin/no-reopen and closed stdin;
- F03-R1 binds destination session/workspace/command to the selected closed
  profile and compares all 15 live fields in two complete precommit
  observations, then repeats the complete proof after buffer load immediately
  before `PASTE_STARTED`; final divergence is postcommit manual reconciliation
  with no paste, Enter, or retry;
- F04 adds one zero-operand `incident-kill` action using fixed SIGUSR2, durable
  global-kill-first ordering, stable redacted results, and bounded shutdown,
  distinct from clean SIGTERM stop; and
- F05-D1 accepts only the fixed `/usr/bin/python3.14` regular UID/GID-0,
  mode-0755, device-2049, inode-14996, 7,481,192-byte, Python-3.14.4 object with
  SHA-256 `b8d8288faefdd300201f43fcf00f6f539a27218eeed3a3dff5ab10b9c4c99700`.
  Every use hashes one no-follow-opened FD and executes that same FD as child
  `/proc/self/fd/3`; the full `17,983`-byte literal has SHA-256
  `557e32a2ab54beea3b3ec8ce1a68bb69a7f3b756db4e3b007d18a452f7a22d75`.
  Its exact schemas, outcomes, two-key environment, projection ceilings, and
  `1,000`/`1,500`/`2,000`/`3,000`/`10,000 ms` deadlines are normative. The
  no-signal preflight runs before state-root initialization or lock creation.
  Signal operations preserve the retained original `O_EXCL` lock FD, perform
  both complete observations through one Linux pidfd, and send only the fixed
  signal through that same pidfd. Fast acquisition needs no clock ordering and
  exit/reap/reused numeric PIDs cannot be retargeted.

The implementation map remains 14 paths. F03 is carried by composition and the
already-listed exact-transport path; `exact-authority.ts` is not added. F05's
sealed fixed Python-standard-library bridge is a compile-time literal inside
the already-listed `writer-lock.ts`, not a package or fifteenth path.

The exact F05 bridge contract is fully fixed in design section 11.1:

- child environment is exactly `LANG=C.UTF-8,LC_ALL=C.UTF-8`; argv is exactly
  pinned `/proc/self/fd/3 -I -S -c <literal>`; stdio is request pipe, response
  pipe, stderr pipe, and verified interpreter FD 3, with every other child FD
  closed and the writer-lock FD excluded;
- capability input has exactly `operation,schemaVersion`; signal input adds
  only the internally derived lock device/inode/hash and owner PID/start ticks;
  request/result exact-key, type, enum, canonical-ASCII-plus-one-LF, duplicate,
  malformed, oversize, and trailing-data rules are exhaustive;
- request/stdin are capped at `8,191/8,192` bytes; response/stdout at
  `511/512`; accepted stderr at zero with a `512`-byte drain cap; lock/stat/
  fdinfo/proc-link at `4,096`; boot ID at `64`; status at `16,384`; cmdline at
  `8,192`; and FD enumeration at `4,096` entries, all inclusive; and
- pre-spawn verification, internal helper, parent helper, total-operation, and
  owner-shutdown deadlines are exactly `1,000`, `1,500`, `2,000`, `3,000`, and
  `10,000 ms`. Timeout is fail-closed/ambiguous, never success.

The startup capability operation verifies the executing FD/version and pidfd
APIs using only a self pidfd and zero-event poll. It runs before
`initializeStateRoot`, state-root access, writer-lock acquisition, secret read,
or other startup mutation; failure leaves an absent root absent and an existing
root unchanged with no lock residue.

The live pilot is locked to one configured Slack workspace, Leo as the sole
authorized user, two fixed Apps with immutable private-channel mappings, one
manually started foreground profile at a time, and exactly one real
root-to-final-result round trip per channel in strict sequence. Existing
extensible allowlist structures remain unchanged and are not extended or
exercised beyond Leo.

The retained safety scope is the already-reviewed identity, secret,
fail-closed, dedupe, exact-tmux, and same-thread-result protections needed for
those two private runs, without generalizing them.

The design composes one fixed grant-selected profile into the existing Phase A
store/service, Slack Web/Socket identity, exact delivery, evidence-ingress, and
same-thread outbox modules. It also closes the missing live concerns:

- fixed committed activation and no CLI/environment/Slack profile selection;
- exact startup order through Web and Socket identity proof;
- a durable receive-arm boundary after verified Socket `hello`;
- independent profile state namespaces below one lock-owning AS1 state root;
- real read-only Git authority/evidence observation;
- production use of the existing AS1 exact journal/one-use transport through a
  narrow tmux port with exact scoped-writer pointer bytes, selected-profile
  destination binding, two complete precommit observations plus one complete
  post-load/pre-paste observation, and no historical fallback;
- mutation-free exact-interpreter/API preflight, foreground lifecycle, retained
  lock-descriptor ownership and same-pidfd observe/signal proof, distinct clean
  stop and durable incident kill, bounded bridge/drain/shutdown, lock release,
  and existing fail-closed replay behavior;
- live-disabled restart and no automatic reconnect or rollover;
- one Agent Office round trip then manual stop/audit, then one Foundation round
  trip then manual stop/audit;
- exact owner state-root, validation, rollback, token-order, and zero-process/
  listener rules and executable rollback action.

The complete design is:

`docs/integration/AGENT_OFFICE_AS1_PHASE_B_LIVE_COMPOSITION_DESIGN_DELTA.md`

This is a Designer result, not an independent review verdict, implementation
authority, live-pilot authority, risk acceptance, or mission closure.

## Authorized design artifacts produced

1. `docs/integration/AGENT_OFFICE_AS1_PHASE_B_LIVE_COMPOSITION_DESIGN_DELTA.md`
2. `artifacts/as1-multi-team-slack-pilot/PHASE_B_DESIGNER_RESULT.md`
3. `artifacts/as1-multi-team-slack-pilot/PHASE_B_DESIGNER_RESULT_POINTER.txt`

No runtime source, test, package, configuration, secret, existing Phase A
evidence, governance file, or external project was modified by this design pass.

## Actual files inspected

The Designer directly read the mandatory authority and role inputs, the Phase A
canonical documents, and the load-bearing implementation/test surfaces below.
Large source/test files were inspected through complete reads where bounded and
targeted sections/assertions where large.

### Governance authority and evidence

- `advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/56_PHASE_B_DESIGN_PATCH_3_HANDOFF.md`
- `advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/55_PHASE_B_DESIGN_DELTA_REVIEW_2_RESULT.md`
- `advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/53_PHASE_B_DESIGN_PATCH_2_HANDOFF.md`
- `advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/52_PHASE_B_DESIGN_DELTA_REVIEW_RESULT.md`
- `advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/50A_PHASE_B_DESIGN_PATCH_RUN_PROMPT.md`
- `advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/50_PHASE_B_DESIGN_PATCH_HANDOFF.md`
- `advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/49_PHASE_B_DESIGN_REVIEW_RESULT.md`
- `advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/47_PHASE_B_DESIGNER_HANDOFF.md`
- `advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/47B_PHASE_B_SCOPE_AUDIT_AND_DESIGN_CORRECTION.md`
- `advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/47C_PHASE_B_SCOPE_CORRECTION_RUN_PROMPT.md`
- `advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/47D_PHASE_B_PRIVATE_SINGLE_USER_LOCK.md`
- `advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/45_ADVISOR_PHASE_A_FINAL_AUDIT.md`
- `advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/46_PHASE_B_INTAKE.md`

These were read from the named isolated `foundation-docs` governance worktree.
The active patch-3 handoff was read from exact governance commit
`6186503f7e2c45dacbce83869aa2579d4bf073bd`; the complete exact same-Reviewer
result was read from `fea560eaea284e0b84d864d470cddd331568cdc8`.
The patch-2/first-patch handoffs and results and the original handoff remain
historical evidence; the original design authority was verified at
`fe8b5c2bc1294783c07962cdab18e45a2ca2077f` on the authorized governance branch.

The private single-user lock was verified as committed at
`b159f5c33d6b07468d98253db39807fd0f7d15f1` before the design commit.

### Product entry and canonical design documents

- `AGENTS.md`
- `CLAUDE.md`
- `docs/agent/TEAM_OPERATING_MODEL.md`
- `docs/agent/roles/designer.md`
- `docs/integration/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_DESIGN.md`
- `docs/security/AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md`
- `docs/integration/AGENT_OFFICE_AS1_SOCKET_IDENTITY_DESIGN_DELTA.md`
- `docs/operations/AGENT_OFFICE_AS1_SLACK_PHASE_A_AS_BUILT.md`
- `docs/operations/AGENT_OFFICE_AS1_SLACK_SETUP.md`
- `package.json`
- `config/agent-office.as1-slack-pilot.disabled.json`
- `config/slack/as1-slack-pilot.env.example`

### Load-bearing AS1 application/runtime source

- `src/application/slack-pilot/contracts.ts`
- `src/application/slack-pilot/profiles.ts`
- `src/application/slack-pilot/inbound-store.ts`
- `src/application/slack-pilot/service.ts`
- `src/application/slack-pilot/evidence-ingress.ts`
- `src/application/slack-pilot/outbox.ts`
- `src/adapters/gateways/slack-pilot/secret-config.ts`
- `src/adapters/gateways/slack-pilot/socket-frame.ts`
- `src/adapters/gateways/slack-pilot/socket-client.ts`
- `src/adapters/gateways/slack-pilot/web-client.ts`
- `src/adapters/gateways/slack-pilot/git-provenance.ts`
- `src/adapters/gateways/slack-pilot/authority-provenance.ts`
- `src/adapters/gateways/slack-pilot/exact-authority.ts`
- `src/adapters/gateways/slack-pilot/exact-transport.ts`
- `src/operations/readiness/as1-slack-control.ts`
- `src/runtime/as1-slack-pilot/composition.ts`
- `src/runtime/as1-slack-pilot/cli.ts`
- `src/persistence/file-store/artifact-store.ts`
- `src/persistence/file-store/canonical-json.ts`
- `src/persistence/file-store/hashing.ts`
- `src/persistence/file-store/writer-lock.ts`
- `src/persistence/file-store/path-safety.ts`
- `src/adapters/gateways/tmux-advisor/exact-transport.ts`

The v2 tmux source was read only to preserve its compatibility boundary. No
tmux input or product mutation was performed.

### Load-bearing tests and fixtures

- `tests/helpers/as1-slack-fakes.ts`
- `tests/contract/as1-slack-profiles.test.ts`
- `tests/security/as1-slack-secret-config.test.ts`
- `tests/security/as1-slack-authority-lifecycle.test.ts`
- `tests/security/as1-slack-durable-boundaries.test.ts`
- `tests/integration/as1-slack-startup-auth.test.ts`
- `tests/integration/as1-slack-inbound.test.ts`
- `tests/integration/as1-slack-thread-correlation.test.ts`
- `tests/integration/as1-slack-exact-transport.test.ts`
- `tests/integration/as1-slack-evidence-ingress.test.ts`
- `tests/integration/as1-slack-outbound.test.ts`
- `tests/adapters/as1-slack-socket-frame.test.ts`
- `tests/adapters/as1-slack-socket-client.test.ts`
- `tests/adapters/as1-slack-authority-provenance.test.ts`
- `tests/adapters/as1-slack-git-provenance.test.ts`
- `tests/operations/as1-slack-lifecycle.test.ts`
- `tests/recovery/as1-slack-recovery.test.ts`
- `tests/adapters/tmux-readonly.test.ts`

## Read-only target capability evidence

The patch-3 handoff authorized read-only checks of the incarnation primitive.
On the assigned Linux target the Designer verified:

- Linux `7.0.0-27-generic` x86_64 and `/proc` present as an owner-0,
  non-symlink mode-0555 filesystem root;
- fixed `/home/leo/.nvm/versions/node/v24.18.0/bin/node` is Node `v24.18.0`
  with libuv `1.52.1`, UID-1000 mode-0755 on device 2049/inode 397924; Node
  exposes only numeric `process.kill`, not a public `pidfd_send_signal` binding;
- fixed `/usr/bin/python3.14` is Python `3.14.4`, a UID/GID-0 regular mode-0755,
  one-link, device-2049, inode-14996, 7,481,192-byte executable with SHA-256
  `b8d8288faefdd300201f43fcf00f6f539a27218eeed3a3dff5ab10b9c4c99700`;
- the same no-follow-opened interpreter FD executes successfully through child
  `/proc/self/fd/3 -I -S` under only `LANG=C.UTF-8,LC_ALL=C.UTF-8`, reports that
  proc-fd path as `sys.executable`, and exposes standard-library
  `os.pidfd_open` and `signal.pidfd_send_signal`; and
- a real read-only self-pidfd open succeeded, `/proc/self/fdinfo` bound it to
  the expected PID, and a zero-time poll reported the live incarnation as not
  exited. The complete embedded literal compiled and its actual exact
  `CAPABILITY_PROBE` returned the exact success schema under the `2,000 ms`
  bound. The signal API was checked for availability but was not invoked.

The installed `pidfd_open(2)` and `pidfd_send_signal(2)` manuals confirm that a
pidfd remains bound to its process incarnation, becomes pollable on exit, and
cannot retarget a later reuse of the numeric PID. No process was signaled; no
file, service, state root, tmux object, or external system was mutated.

## Key design findings

1. Phase A intentionally leaves `As1GatewayComposition` disconnected even when
   a receive-grant ref exists. The missing work is construction/orchestration,
   not business-contract implementation.
2. The Web client, connections opener, raw Socket, identity verifier, inbound
   service, exact transport, evidence ingress, and outbox already expose the
   narrow ports needed for one real composition.
3. A production Git artifact reader/poller is absent. The reviewed provenance
   verifiers exist and can remain unchanged; a fixed-root reader must supply
   exact parsed blobs and committed locations.
4. `As1ExactTransport` has the reviewed journal/one-use/no-retry core but does
   not yet prove the actual local pointer bytes or every live destination field.
   Its already-listed path can mirror the scoped writer's exact raw
   representation, pin/load those bytes, complete two observations before
   commitment, and repeat the complete observation after load before paste,
   without changing Exact Delivery v2 or any durable AS1 schema.
5. Evidence-authority construction needs typed reads of two records the store
   already persists: terminal tmux delivery and atomic grant/lease consumption.
   Additive read accessors are sufficient.
6. The raw Socket currently advances from verified `hello` directly to
   receive-ready while durable control is still `AUTHENTICATING_ONE_PROFILE`.
   Phase B must retain authenticated quarantine until the composition persists
   `RECEIVING_ONE_PROFILE` and performs a one-use receive arm. This is an
   adapter-lifecycle correction, not an identity or authority-schema change.
7. A long-running `start` cannot share the writer lock with a one-shot `stop`.
   PID/boot/build metadata and numeric-PID signaling do not survive reuse safely.
   Exact executable pinning is feasible inside `writer-lock.ts`: verify/hash one
   interpreter FD, inherit it as FD 3, and exec `/proc/self/fd/3`, with a sealed
   literal and exact schemas/bounds. Its self-pidfd preflight can precede all
   state-root mutation. Retaining the original close-on-exec lock descriptor
   then proves acquisition without coarse clock ordering; two complete
   observations and the fixed signal through one open Linux pidfd bind
   executable, UID, boot, entry, root, build, lock inode, and process
   incarnation without a daemon, listener, package, helper file, or writer-lock
   schema change.
8. The one common state root plus its writer lock/global control preserves
   mutual exclusion, while the existing contained profile roots preserve all
   per-Team state, dedupe, authority, journal, evidence, outbox, and latch
   isolation.
9. The private scope needs no multi-user/workspace or rollout abstraction: both
   fixed profiles share one configured workspace and the Leo singleton, each
   keeps one immutable App/channel mapping, and the two one-round-trip runs are
   manually started/stopped in sequence.

## Corrected proposed implementation map — 14 paths

The exact retained paths and their concrete necessity are recorded in design
section 3.1 and reproduced here for routing.

### Source and owner documentation — 9 paths

- `src/runtime/as1-slack-pilot/composition.ts` — assemble one fixed-workspace,
  Leo-only, grant-selected profile through one root-to-result round trip,
  preserve frozen evidence hashes while enforcing a separate live predicate,
  bind the profile into delivery, and provide evidence/outbound/incident/drain
  orchestration.
- `src/runtime/as1-slack-pilot/cli.ts` — explicit foreground start plus the
  closed zero-operand clean-stop/incident-kill/read-only-status paths; restart
  remains live-disabled and no generic signal/reset grammar is added.
- `src/adapters/gateways/slack-pilot/git-artifact-source.ts` (new) — observe
  already-authorized receive/delivery/lease/evidence blobs at fixed Git paths.
- `src/adapters/gateways/slack-pilot/socket-client.ts` — retain authenticated
  quarantine until durable receive arm so no event crosses the startup gate.
- `src/adapters/gateways/slack-pilot/exact-transport.ts` — add the one closed
  production tmux port; require the exact canonical-plus-one-LF/private/32-KiB/
  raw-hash/content-addressed pointer contract; pin without reopen and load only
  through closed stdin; bind the selected profile; compare every live
  destination fact twice before commitment and once after load before paste.
- `src/application/slack-pilot/inbound-store.ts` — expose typed existing
  terminal delivery/consumption records required for evidence authority.
- `src/operations/readiness/as1-slack-control.ts` — provide the separate current
  control/latch actionability predicate, fixed durable operator kill, drain
  gating, and redacted observation while retaining frozen authority fields.
- `src/persistence/file-store/writer-lock.ts` — strictly observe the existing
  unchanged v1 lock while retaining its original close-on-exec descriptor;
  verify/hash/pin the exact interpreter object, execute its inherited FD with
  the full fixed literal and exact environment/schema/bounds, run capability
  before startup mutation, then observe the exact owner twice through one pidfd
  and send only the closed fixed signal through that same incarnation.
- `docs/operations/AGENT_OFFICE_AS1_SLACK_SETUP.md` — supply the missing exact
  `AS1_SLACK_STATE_ROOT` owner instruction and closed foreground start, clean
  stop, and incident-kill procedure.

### Focused synthetic tests — 5 paths

- `tests/adapters/as1-slack-socket-client.test.ts` — focused hello/quarantine/
  arm and no-pre-arm-ACK proof.
- `tests/integration/as1-slack-exact-transport.test.ts` — focused pointer byte/
  path-race seal, exact LF/hash/filename/mode/size representation, closed stdin/
  argv, profile-bound two-precommit-plus-one-pre-paste observation sequence,
  precommit rejection versus postcommit reconciliation, and one-use delivery.
- `tests/integration/as1-slack-live-composition.test.ts` (new) — one synthetic
  frozen/live-control evidence-equality proof, then one fixed-workspace/Leo-only
  Agent Office root-to-result round trip followed by one isolated Foundation
  round trip, including same-thread result and replay.
- `tests/integration/as1-slack-git-artifact-source.test.ts` (new) — focused
  ready/not-ready and immutable fixed-artifact observation proof.
- `tests/operations/as1-slack-lifecycle.test.ts` — focused clean stop versus
  durable incident kill; interpreter object/hash/replacement and inherited-FD
  execution; API/schema/byte/count/time boundaries and zero-mutation preflight;
  retained lock-FD and same-pidfd ownership; fast valid acquisition; exit/reap/
  PID-reuse non-retargeting; bounded shutdown/lock release; live-disabled
  restart; and redacted status.

An Advisor implementation handoff may narrow this list. It must not broaden it
without a new design decision and authority.

## Exact paths and gates removed by the scope correction and private lock

Removed from the active implementation map:

- `config/agent-office.as1-slack-pilot.disabled.json` — the Worker leaves it
  unchanged; value-only activation is a later exact reviewed pilot operation;
- `docs/operations/AGENT_OFFICE_AS1_SLACK_PHASE_B_AS_BUILT.md` — Worker result,
  Reviewer result, and Advisor audit hold the evidence;
- `tests/integration/as1-slack-startup-auth.test.ts` — retained as a direct
  regression gate, not modified;
- `tests/security/as1-slack-live-composition.test.ts` — the generic matrix is
  replaced by the one focused sequential composition test;
- `tests/helpers/as1-slack-fakes.ts` — the arm behavior stays local to the
  concrete Socket and focused adapter/composition tests.

Removed gates:

- full `npm test`;
- crash injection at every durable phase;
- exhaustive profile/security/property cross-products;
- broad stale-lock/lifecycle permutations unrelated to these two safe runs;
- generic Git/runtime/workflow/service/orchestration framework coverage;
- hypothetical-profile or future-rollout coverage.

The private lock additionally excludes multi-user or multi-workspace behavior,
allowlist expansion beyond Leo, mutable App/channel routing, automatic restart
or reconnect, a live question cycle, more than one real round trip per channel,
admin/HA/generic rollout machinery, and enterprise-scale test scope. It removes
no additional path from the corrected 14-path map.

## Required implementation and rehearsal gates

The corrected design requires only:

- changed-file checks, typecheck, and build for the affected TypeScript paths;
- fixed Git reader/provenance and accepted-artifact divergence tests;
- Socket hello/quarantine/arm tests;
- frozen-authority versus current-live-control evidence-equality tests;
- exact canonical-plus-one-LF/raw-hash/content-addressed-filename pointer tests
  under no-follow/regular/owner/one-link/`(mode & 0o077) === 0`/32-KiB/
  grammar/correlation gates, including precommit replacement, pinned-byte stdin
  loading, zero tmux mutation, and unconsumed authority on rejection;
- selected-profile destination equality plus the exact sequence of two complete
  precommit observations and one complete post-load/pre-paste observation;
  wrong profile, key omission/addition, between-observation change, and change
  during/after buffer load prove precommit rejection or postcommit manual
  reconciliation at the correct boundary, with no paste/Enter/retry;
- one focused synthetic composition for Agent Office, then Foundation, never
  simultaneous, proving one fixed workspace, the Leo singleton, immutable App/
  channel mappings, and one root-to-result round trip each;
- focused one-root, same-thread result, and replay checks;
- focused mutation-free preflight and lifecycle tests: exact interpreter path/
  type/owner/mode/device/inode/size/hash/version, pre-/post-open replacement and
  pinned-FD execution, literal identity, API absence, exact request/result
  schema/outcome, every byte/count/time boundary, timeout, and zero state-root/
  lock residue; retained-lock-FD/same-pidfd executable/UID/boot/entry/root/build
  observations; fast valid acquisition and exit/reap/PID reuse after
  verification before send; distinct fixed clean stop and durable incident
  kill; kill-before-shutdown ordering; bounded drain/shutdown and lock release;
  no numeric owner-PID fallback, package/helper path, or generic reset/signal;
  live-disabled restart; redaction; and zero-listener checks;
- changed-file secret/static scans and directly affected Phase A/Exact Delivery
  regressions;
- separately authorized owner live rehearsal with redacted evidence only.

No automated validation may use live Slack, real tokens, tmux mutation, a live
pane, or the owner state root.

## Design-pass validation

- exact patch changed-path scope: `PASS` — the same three authorized design
  artifacts only, all modifications;
- committed patch-3 authority/runtime/branch/base/upstream preflight: `PASS`;
- committed private single-user lock coverage: `PASS` — no path was added and
  the implementation map remains exactly 14 paths;
- F01/F02-D1/F03-R1/F04 preservation plus F05-D1 exact section/term, constant,
  schema, bounds, preflight-order, and stale-contradiction checks: `PASS`;
- embedded bridge literal UTF-8 length/SHA/syntax check: `PASS` — `17,983` bytes,
  `557e32a2ab54beea3b3ec8ce1a68bb69a7f3b756db4e3b007d18a452f7a22d75`;
- authorized Linux target read-only verified-FD `CAPABILITY_PROBE`: `PASS` —
  exact result, exit `0`, empty stderr, no timeout, and no process signal;
- read-only bridge decoder checks: `PASS` — exact capability success plus
  missing, extra, duplicate, trailing, and oversized request rejection at exact
  exit/outcome pairs, all with empty stderr and no process signal;
- pointer key uniqueness and authority/result/design/private-scope fields:
  `PASS`;
- staged whitespace/error check (`git diff --cached --check`): `PASS`;
- staged exact three-path name/status and complete staged-content inspection:
  `PASS`;
- product tests/typecheck/build: `NOT RUN` by exact patch-3 handoff. The original
  design-pass disclosure remains unchanged: an earlier quoting error invoked
  `npm test`, which exited immediately with `vitest: not found`; no test case ran
  and no file changed;
- live Slack, secret, network, product runtime, and tmux mutation checks:
  `NOT RUN` and unauthorized for this Designer patch.

## Rollback summary

Before connection, keep/restore committed default-disabled activation, prove no
writer/process/listener, then—if abandonment is directed—remove the secret and
revoke all app-level tokens before all bot tokens.

During/after connection, run the exact zero-operand `incident-kill`; require a
stable durable-kill result before any new side effect; durably mark ambiguities;
close the Socket; prove zero process/lock/socket/listener; revoke app-level
tokens first and bot tokens second; and preserve all state/evidence. A
stale/ambiguous/persistence/timeout result stays failed closed and returns to
the Advisor. No latch, dedupe, grant, journal, consumption, or evidence
deletion/rewrite is recovery.

## Unresolved live facts and safe defaults

The Designer did not access and does not know:

- real Slack IDs or token values;
- future live receive/delivery grant, lease, evidence, or result IDs/commits;
- either pilot's fresh live tmux coordinates;
- the future Phase B implementation/review commit;
- owner execution evidence for the canonical state root;
- live provider behavior during the later authorized rehearsal.

All remain unset. Absence is disconnected/not-ready, never fallback or implied
authority. These are deliberately late-bound through owner evidence, committed
Advisor authority, fresh read-only destination observation, and independent
review.

## Boundary evidence

- Work occurred only in the named Phase B product worktree.
- Product worktree began this patch clean and upstream-equal at exact patch-2
  candidate `1fad9734e83c751b911accffbb12d65df9e775c8` on the authorized branch; that
  commit is a direct descendant of the exact Phase A baseline.
- Assigned Designer runtime binding was verified read-only as
  `agent-office-designer` at `$24/@24/%24`, direct child
  `codex -m gpt-5.6-sol -c model_reasoning_effort=max`, workspace
  `/home/leo/Project/agent-office`.
- No sub-agent, delegated context, alternate session, secret access, Slack
  connection, external product edit, runtime implementation, product test case,
  tmux input, process signal, or self-review occurred.
- The three design artifacts are the only intended changes for this pass.

The exact design commit and upstream-equality evidence are returned out of band
with the pointer after the one authorized commit/push, because a file cannot
truthfully contain the hash of the commit that contains itself.
