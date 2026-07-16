# AS1 Phase B Designer Result

MISSION_ID: `AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_PILOT_001`

PASS: `PHASE_B_SECURITY_TRANSPORT_DESIGN_DELTA`

ACTOR: `agent-office-designer`

ROLE: `Agent Office Designer`

AUTHORITY: committed
`advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/47_PHASE_B_DESIGNER_HANDOFF.md`

ACTIVE_SCOPE_CORRECTION:
`advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/47B_PHASE_B_SCOPE_AUDIT_AND_DESIGN_CORRECTION.md`
at `e070ee25b2f22635459bd8abf8841ab4f1925d0f`

ACTIVE_PRIVATE_SINGLE_USER_LOCK:
`advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/47D_PHASE_B_PRIVATE_SINGLE_USER_LOCK.md`
at `b159f5c33d6b07468d98253db39807fd0f7d15f1`

PRODUCT_BASELINE: `0dfb4398be2ecd9295b35a94e3b461e25dad6f7c`

PRODUCT_BRANCH: `feature/as1-phase-b-live-pilot-001`

DESIGN_STATE: `READY_FOR_INDEPENDENT_DESIGN_REVIEW`

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
- production use of the existing AS1 exact transport through a narrow tmux port
  and fresh lease-bound preflights, with no historical fallback;
- foreground lifecycle, signal-bound stop, bounded drain, lock release, and
  existing fail-closed replay behavior;
- live-disabled restart and no automatic reconnect or rollover;
- one Agent Office round trip then manual stop/audit, then one Foundation round
  trip then manual stop/audit;
- exact owner state-root, validation, rollback, token-order, and zero-process/
  listener rules.

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

- `advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/47_PHASE_B_DESIGNER_HANDOFF.md`
- `advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/47B_PHASE_B_SCOPE_AUDIT_AND_DESIGN_CORRECTION.md`
- `advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/47C_PHASE_B_SCOPE_CORRECTION_RUN_PROMPT.md`
- `advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/47D_PHASE_B_PRIVATE_SINGLE_USER_LOCK.md`
- `advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/45_ADVISOR_PHASE_A_FINAL_AUDIT.md`
- `advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/46_PHASE_B_INTAKE.md`

These were read from the named isolated `foundation-docs` governance worktree.
The handoff was verified as committed at
`fe8b5c2bc1294783c07962cdab18e45a2ca2077f` on the authorized governance
branch.

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
4. `As1ExactTransport` is complete but has only fake `As1TmuxPort` coverage. A
   narrow Node port can be added without changing Exact Delivery v2 or the AS1
   journal/authority contracts.
5. Evidence-authority construction needs typed reads of two records the store
   already persists: terminal tmux delivery and atomic grant/lease consumption.
   Additive read accessors are sufficient.
6. The raw Socket currently advances from verified `hello` directly to
   receive-ready while durable control is still `AUTHENTICATING_ONE_PROFILE`.
   Phase B must retain authenticated quarantine until the composition persists
   `RECEIVING_ONE_PROFILE` and performs a one-use receive arm. This is an
   adapter-lifecycle correction, not an identity or authority-schema change.
7. A long-running `start` cannot share the writer lock with a one-shot `stop`.
   The existing writer-lock v1 PID/boot/build metadata supports a closed,
   owner-only SIGTERM stop path without a daemon, listener, or new process
   schema.
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
  delivery, evidence, outbound, and bounded drain.
- `src/runtime/as1-slack-pilot/cli.ts` — explicit foreground start plus the
  closed state-root/manual-stop/read-only-status path; restart remains
  live-disabled.
- `src/adapters/gateways/slack-pilot/git-artifact-source.ts` (new) — observe
  already-authorized receive/delivery/lease/evidence blobs at fixed Git paths.
- `src/adapters/gateways/slack-pilot/socket-client.ts` — retain authenticated
  quarantine until durable receive arm so no event crosses the startup gate.
- `src/adapters/gateways/slack-pilot/exact-transport.ts` — add the one closed
  production tmux port behind existing one-use authority and fresh preflights.
- `src/application/slack-pilot/inbound-store.ts` — expose typed existing
  terminal delivery/consumption records required for evidence authority.
- `src/operations/readiness/as1-slack-control.ts` — provide exact control/latch
  snapshots, drain gating, and redacted observation for the foreground run.
- `src/persistence/file-store/writer-lock.ts` — strictly observe the existing
  lock owner so `stop` targets only the running AS1 foreground process.
- `docs/operations/AGENT_OFFICE_AS1_SLACK_SETUP.md` — supply the missing exact
  `AS1_SLACK_STATE_ROOT` owner instruction and manual foreground start/stop
  procedure.

### Focused synthetic tests — 5 paths

- `tests/adapters/as1-slack-socket-client.test.ts` — focused hello/quarantine/
  arm and no-pre-arm-ACK proof.
- `tests/integration/as1-slack-exact-transport.test.ts` — focused closed argv,
  fresh two-preflight, and one-use delivery proof.
- `tests/integration/as1-slack-live-composition.test.ts` (new) — one synthetic
  fixed-workspace/Leo-only Agent Office root-to-result round trip followed by
  one isolated Foundation round trip, including same-thread result and replay.
- `tests/integration/as1-slack-git-artifact-source.test.ts` (new) — focused
  ready/not-ready and immutable fixed-artifact observation proof.
- `tests/operations/as1-slack-lifecycle.test.ts` — focused manual/signal stop,
  bounded drain, lock release, live-disabled restart, and redacted status proof.

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
- closed production tmux argv and two-preflight tests;
- one focused synthetic composition for Agent Office, then Foundation, never
  simultaneous, proving one fixed workspace, the Leo singleton, immutable App/
  channel mappings, and one root-to-result round trip each;
- focused one-root, same-thread result, and replay checks;
- focused manual/signal stop, bounded drain, lock release, live-disabled
  restart, redaction, and zero-listener checks;
- changed-file secret/static scans and directly affected Phase A/Exact Delivery
  regressions;
- separately authorized owner live rehearsal with redacted evidence only.

No automated validation may use live Slack, real tokens, tmux mutation, a live
pane, or the owner state root.

## Design-pass validation

- exact changed-path scope: `PASS` — the three authorized design artifacts only;
- committed private single-user lock coverage: `PASS` — no path was added;
- required design-section/term coverage: `PASS`;
- staged whitespace/error check (`git diff --cached --check`): `PASS`;
- staged name/status and complete staged-content inspection: `PASS`;
- product tests/typecheck/build: no test case, typecheck, or build completed. A
  quoting error during a read-only search inadvertently invoked `npm test`; it
  exited immediately with `vitest: not found`, no test case ran, no file changed,
  and it was not retried under the corrected scope;
- live Slack, secret, network, and tmux checks: `NOT RUN` and unauthorized for
  this Designer pass.

## Rollback summary

Before connection, keep/restore committed default-disabled activation, prove no
writer/process/listener, then—if abandonment is directed—remove the secret and
revoke all app-level tokens before all bot tokens.

During/after connection, engage global kill, stop admission and new side
effects, durably mark ambiguities, close the Socket, prove zero process/lock/
socket/listener, revoke app-level tokens first and bot tokens second, and
preserve all state/evidence. No latch, dedupe, grant, journal, consumption, or
evidence deletion/rewrite is recovery.

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
- Product worktree began clean at the exact baseline and authorized branch.
- Assigned Designer runtime binding was verified through read-only structured
  metadata.
- No sub-agent, delegated context, alternate session, secret access, Slack
  connection, external product edit, runtime implementation, completed test
  case, tmux input, or self-review occurred.
- The three design artifacts are the only intended changes for this pass.

The exact design commit and upstream-equality evidence are returned out of band
with the pointer after the one authorized commit/push, because a file cannot
truthfully contain the hash of the commit that contains itself.
