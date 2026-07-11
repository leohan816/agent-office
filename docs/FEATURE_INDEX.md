# Agent Office M01 Feature and Traceability Index

Status: `FINAL_REWORK_IMPLEMENTED__PENDING_FABLE5_DELTA_REVIEW_ADVISOR_VERIFICATION_AND_LEO_GPT_DECISION`

Mission: `AGENT_OFFICE_M01_ADVISOR_MANAGED_OFFICE_WEB_CONTROL_PLANE`

This is the canonical discoverability and material-requirement traceability index
for M01. It records the independent design PASS, Advisor-accepted Batches A-D,
Batch E as-built evidence, the final dual-review `NEEDS_PATCH`, and the exact
same-Worker final rework. It does not claim a passing delta review, Advisor
private-run verification, Leo/GPT final approval, or mission closure.

## 1. Current Implemented Scope

- Bootstrap governance: commit
  `937f0c5f92cd3b39d81796c13bc00b4afe3407fb`.
- Reviewed canonical design: commit
  `82821afe48b08f70b6888e3ebf12dee3095cd2bb`, with Fable5 delta
  `DESIGN_REVIEW: PASS` recorded in foundation-docs commit
  `6c9d94f31ae5dd5424b511afb68188681ff95349`.
- Batch A code/config/tests: commit
  `7edc8f79bedb059ab6697e64ddaf57fbebde2c87`.
- Batch B code/config/tests/assets: commit
  `85e66d856e33a0df73041cb4b33aba30a8f9f96d`.
- Batch C code/config/tests/assets: commit
  `e30a6cda52e14a4bf30b2d1b7445fa26645496e5`.
- Batch D code/config/tests: commit
  `7366036f8a1e6fc9d4e911e8d193e17eeb95f54c`.
- Batch D AO-D-R1 capability-validation rework: commit
  `04809004bfd863181f4af8260879f56bc8b6ede6`.
- Final AO-E-R1/AO-E-R2 code/config/test rework: commit
  `0f90e39d3995ffca97eb7a05ef051d8f9a3719c1`.

Batch A contains a zero-runtime-dependency strict TypeScript domain core, exact
15-WorkUnit manifest fixture/import, state machines and two-axis observable
mapping, event/hash/idempotency contracts, immutable local artifacts,
single-writer JSONL persistence, deterministic projection/checkpoint replay, and
startup/corruption recovery primitives. Advisor accepted Batch A as the Batch B
dependency.

Batch B adds trusted project/root registration; bounded manifest/artifact sources;
fixed no-shell read-only Git and exact-pane structured tmux adapters; deterministic
local freshness/restart projection; and a responsive static operations dashboard
with exact Korean vocabulary, typed blocker/freshness detail, separate progress,
and read-only evidence copy. All 23 test files pass (84 tests), with lint, strict
typecheck, core/dashboard production builds, diff check, bounded read-only local
adapter smoke, and zero-vulnerability dependency audit.

Advisor accepted Batch B as the Batch C dependency. Batch C adds the full-width
structured-event office scene; eight stable stations; exact primary/activity and
evidence fail-closed mapping; deterministic safety precedence, accepted-event-ID
deduplication, burst coalescing, bounded delivery/result/patch cues, static
load/reload/resume behavior; local code-native assets with pinned dimensions,
ownership/license, and SHA-256; explicit mobile pagination; reduced motion,
visibility pause, semantic/live-region accessibility; and committed deterministic
desktop/mobile/reduced-motion baselines. All 27 Vitest files pass (124 tests), all
10 Playwright Chromium tests pass from both `C.UTF-8` and `ko_KR.UTF-8` callers,
and lint, strict typecheck, production builds, dependency audit, diff, source
boundary, axe, and layout/no-overlap gates pass. Playwright process-locale
normalization is committed at `243d3a5731a6b22c29caeaba6567aed505f78d59`;
the final baseline bytes from `ad74b9e8f98298269534676237a66cfaac055e00`
remain unchanged. Advisor accepted Batch C as the Batch D dependency in
foundation-docs commit `3edcf7914715463e0ec793527c963c1847260b0f`.

Batch D adds the typed Advisor-only inbox application; owner-only scoped message,
gateway-receipt, acknowledgement, intake, decision-link, alert-detail, and resume
artifacts; durable message/notification projections and crash reconciliation;
capability-gated fixed `TmuxAdvisorGateway`; an interface-compatible disabled
Hermes stub; redacted lifecycle audit projection; canonical alert application;
deterministic GPT-package copy; and responsive Inbox/Alerts UI. AO-D-R1 rework
adds exact runtime capability vocabulary, future-issued/exclusive-expiry checks,
and consistent gateway clock validation. The complete regression is 35 Vitest
files/155 tests and 15 sequential Chromium tests, with lint, strict typecheck,
production builds, dependency audit, source boundary, responsive layout, visual
inspection, keyboard, and WCAG A/AA checks passing.

Advisor accepted Batch D as the Batch E dependency at target commit
`31c59ccdd0aed080f45d95195fb4c289eb48b24c`. Batch E implementation commit
`e0a11f69fffc9d35d67cc478cbefbb92d93cf528` adds the loopback-only typed HTTP and
static-shell boundary, guarded test authentication/session contracts, exact
mutation allowlist, security audit and request controls, bounded SSE, installable
offline-read-only PWA, startup/delivery readiness, complete checkpoint backup,
isolated restore, compatibility/rollback evidence, and immutable recovery
results. The complete regression is 50 Vitest files/196 tests and 18 sequential
Chromium tests; lint, strict typecheck, both builds, dependency audit, source
boundary scans, local loopback smoke, accessibility/responsive checks, and direct
desktop/mobile visual inspection pass.

Batch E does not add a real credential/provider, private-network/Tailscale or
public exposure, TLS/HSTS, deployment, DB, remote collector, Hermes
implementation, real tmux input, off-host backup, production/live operation, or
automatic approval. Implementation review, Advisor private verification, and
Leo/GPT final approval remain pending.

Final rework commit `0f90e39d3995ffca97eb7a05ef051d8f9a3719c1`
closes the reproduced AO-E-R1 and AO-E-R2 code defects. `src/runtime/cli.ts` and
`npm run start:loopback` now compose the validated state root, approved manifest,
single writer, application, built production dashboard, loopback HTTP/static
server, protected projection/SSE, readiness, and ordered shutdown. With no
approved provider, the executable serves only shell/status publicly and remains
visibly `AUTH_BLOCKED`, `UNAVAILABLE_READ_ONLY`, and mutation-disabled. The
production browser default is the typed projection/SSE/CSRF client under
`src/ui/runtime/`; synthetic fixtures require explicit `test-demo` mode. Decision
linkage now verifies the immutable repository/commit/path/SHA-256, mission, exact
WorkUnit scope, and named authority before writing the version-2 link artifact or
event, and preserves that authority through replay/projection. The safe bounded
Advisor routine scope is still undefined and therefore rejects closed. The full
rework regression is 52 Vitest files/205 tests plus 18 sequential Chromium tests;
the focused composition and authority suites pass 4/4 and 5/5. A disposable
runtime smoke proves shell/asset/status success, protected projection denial,
listener rebind, and writer-lock release. No visual baseline changed in this
rework; desktop, mobile, and reduced-motion production output was inspected
directly.

## 2. Canonical Design Documents

| Document | Canonical subject |
|---|---|
| [`architecture/AGENT_OFFICE_MASTER_DESIGN.md`](architecture/AGENT_OFFICE_MASTER_DESIGN.md) | Purpose, authority/source precedence, topology, stack boundary, SSE/PWA decision, batches/gates, unknowns |
| [`contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md`](contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md) | Manifest, event envelope, entity states, transitions, idempotency, ordering, decisions, projections, evidence completion |
| [`security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md`](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md) | Actors, threat/trust boundaries, loopback/private network, auth, CSRF, rate limits, audit, browser/adapter restrictions |
| [`integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md`](integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md) | Advisor gateways, read-only adapters, notifications, multi-project/host trust, clock, offline/reconnect/stale evidence |
| [`ui/AGENT_OFFICE_UI_ANIMATION_MAPPING.md`](ui/AGENT_OFFICE_UI_ANIMATION_MAPPING.md) | Responsive UI, hierarchy, event-only animation, visual assets, accessibility, reduced motion, stable layout, PWA UX |
| [`operations/AGENT_OFFICE_OPERATIONS_RECOVERY.md`](operations/AGENT_OFFICE_OPERATIONS_RECOVERY.md) | Durable file store, restart/crash, corruption, stale state, backup/restore, rollback/disable, proof of recovery |
| `docs/FEATURE_INDEX.md` | Discoverability, critical traceability, batch/review coverage, current truth, gates |

Agent Office is the sole canonical design owner. Foundation-docs may hold mission
governance, review evidence, results, and pointers but no competing canonical copy.

## 3. Status and Gate Vocabulary

| Status | Meaning |
|---|---|
| `IMPLEMENTED_BOOTSTRAP_ONLY` | Present in bootstrap commit; documentation/configuration only |
| `DESIGNED_CANDIDATE` | Reviewed design target that is not yet implemented; its named implementation gate still applies |
| `DESIGNED_FOR_EXTENSION` | Interface/invariant reserved; only local subset may be in M01 |
| `DEFERRED_WITH_GATE` | Explicitly disabled until named authority/review gate |
| `OUT_OF_SCOPE` | Not part of M01; requires a new mission, not a toggle |
| `IMPLEMENTED_BATCH_A__ADVISOR_ACCEPTED` | Present and verified in Batch A code/tests; accepted as the Batch B dependency |
| `IMPLEMENTED_BATCH_A_CONTRACT_ONLY` | Domain contract exists; later application/UI/gateway behavior remains gated |
| `IMPLEMENTED_BATCH_B__ADVISOR_ACCEPTED` | Present and verified in Batch B code/tests; accepted as the Batch C dependency |
| `IMPLEMENTED_BATCH_B_LOCAL_SUBSET__ADVISOR_ACCEPTED` | Only the named local/read-only Batch B subset exists and is accepted; remote/server/later behavior remains gated |
| `IMPLEMENTED_BATCH_C__ADVISOR_ACCEPTED` | Present and verified in Batch C code/tests/assets; accepted as the Batch D dependency |
| `IMPLEMENTED_BATCH_C_LOCAL_SUBSET__ADVISOR_ACCEPTED` | Only the named Batch C presentation subset exists; accepted without authorizing later server/PWA behavior |
| `IMPLEMENTED_BATCH_D__PENDING_ADVISOR_ACCEPTANCE` | Present and verified in Batch D code/tests; not yet accepted as the dependency for Batch E |
| `IMPLEMENTED_BATCH_D_LOCAL_SUBSET__PENDING_ADVISOR_ACCEPTANCE` | Only the local typed application/gateway/UI subset exists; HTTP, auth, PWA, deployment, and real transport activation remain gated |
| `IMPLEMENTED_BATCH_D__ADVISOR_ACCEPTED` | Present and verified through Batch D; Advisor accepted it as the Batch E dependency |
| `IMPLEMENTED_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Present and verified in Batch E code/tests at the named commit; independent implementation review and Advisor acceptance remain pending |
| `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Earlier accepted behavior plus the named Batch E boundary is implemented; later external/private/production gates remain closed |
| `IMPLEMENTED_FINAL_REWORK__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | The final-review code/documentation defect is patched at the named commit and verified; the same Fable5 Reviewer delta review and Advisor decision remain pending |

Every `CURRENT_EVIDENCE` value beginning with `NOT_IMPLEMENTED` is honest design
evidence only. A document section is not proof that behavior exists.

## 4. Material Requirement Traceability

| DESIGN_REQUIREMENT | IMPLEMENTATION_PATH | TEST_PATH | CURRENT_EVIDENCE | STATUS | DEFERRED_GATE |
|---|---|---|---|---|---|
| AO-REQ-001 Purpose, audience, operations focus, non-goals | `src/ui/`, `src/application/advisor-inbox/`, `src/server/`, `src/pwa/`, `src/operations/` | `tests/acceptance/batch-gates.test.ts`, `tests/security/static-shell.test.ts`, `tests/e2e/pwa-lifecycle.spec.ts` | Commit `e0a11f69fffc9d35d67cc478cbefbb92d93cf528` implements the loopback-private local control-plane boundary without widening product authority | `IMPLEMENTED_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Implementation review and Advisor acceptance; real auth/network/deployment separately gated |
| AO-REQ-002 Actor authority and source-of-truth precedence | `src/contracts/types.ts`, `src/application/evidence/index.ts`, future authority application policy | `tests/domain/transitions.test.ts`, later authority tests | Actor/evidence references and fail-closed verification primitives are in code commit `7edc8f79bedb059ab6697e64ddaf57fbebde2c87`; full cross-source conflict application remains absent | `IMPLEMENTED_BATCH_A_CONTRACT_ONLY` | Canonical V2 remains external authority; application integration in later batches |
| AO-REQ-003 Responsive private PWA and quiet UI | `src/ui/`, `src/ui/runtime/`, `src/pwa/`, `public/`, `src/runtime/` | `tests/integration/runtime-composition.test.ts`, `tests/ui/runtime-boundary.component.test.tsx`, `tests/e2e/office-scene.spec.ts`, `tests/e2e/communication-center.spec.ts`, `tests/e2e/pwa-lifecycle.spec.ts` | Production now mounts the typed application projection/SSE client, not fixtures; without a provider the directly inspected desktop/mobile/reduced-motion UI is visibly `AUTH_BLOCKED`/read-only, while fixtures require explicit `test-demo`; 18/18 browser tests pass with no final-rework PNG delta | `IMPLEMENTED_FINAL_REWORK__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Real authenticated operation and provider remain gated |
| AO-REQ-004 Initiative -> Package -> Mission -> Phase -> WorkUnit with fixed Korean hierarchy labels | `src/domain/manifest/index.ts`, `fixtures/manifests/`, `src/ui/i18n/ko.ts`, `src/ui/dashboard.tsx` | `tests/domain/manifest.test.ts`, `tests/ui/korean-vocabulary.test.ts`, `tests/ui/dashboard.component.test.tsx` | Exact source hierarchy/`labelKo` and fixed Korean hierarchy labels were Advisor-accepted after Batch B and remain unchanged in Batch C | `IMPLEMENTED_THROUGH_BATCH_B__ADVISOR_ACCEPTED` | None for the local hierarchy subset |
| AO-REQ-005 Versioned denominator and exact scope accounting | `src/domain/manifest/index.ts`, `src/application/projections/mission-projector.ts`, `src/application/queries/dashboard-view-model.ts` | `tests/property/scope-counting.test.ts`, `tests/ui/dashboard-view-model.test.ts` | Advisor-accepted scope core plus distinct declared WorkUnit denominator/future-unapproved rendering pass unchanged | `IMPLEMENTED_THROUGH_BATCH_B__ADVISOR_ACCEPTED` | Authority artifact still required for any scope change |
| AO-REQ-006 Durable WorkUnit states/transitions/dependencies plus exact 16-name primary/activity conformance | `src/domain/state-machines/work-unit.ts`, `src/domain/activity/index.ts`, `src/ui/scene/state-machine.ts` | `tests/property/transition-matrix.test.ts`, `tests/contract/required-observable-conformance.test.ts`, `tests/ui/activity-mapping.test.ts` | Batch C exact scene mapping and evidence/source fail-closed coverage are Advisor-accepted and remain regression-locked | `IMPLEMENTED_THROUGH_BATCH_C__ADVISOR_ACCEPTED` | None for the Batch C scene subset |
| AO-REQ-007 Message states and immutable Advisor flow | `src/domain/messages/index.ts`, `src/application/advisor-inbox/`, `src/server/application.ts`, `src/server/http/`, `src/ui/runtime/client.ts` | `tests/integration/advisor-inbox.test.ts`, `tests/recovery/advisor-message-crash-consistency.test.ts`, `tests/integration/http-advisor-message.test.ts`, `tests/integration/runtime-composition.test.ts` | Accepted five-kind lifecycle and persistence-only receipt remain; the synthetic guarded composition exercises the production browser client through the real HTTP/application/store path, persists one message, and replays the same request without a duplicate event | `IMPLEMENTED_FINAL_REWORK__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Real provider/authenticated private run remains gated |
| AO-REQ-008 Typed BlockerKind, exact BlockerOpened fields/lifecycle/resume proof, and Korean labels | `src/domain/blockers/index.ts`, `src/domain/decisions/resume-proof.ts`, `src/application/advisor-inbox/service.ts`, `src/server/application.ts`, `src/ui/` | `tests/contract/blocker-alert-vocabulary.test.ts`, `tests/integration/advisor-inbox.test.ts`, `tests/security/http-boundary.test.ts` | Batch D accepted blocker/resume authority remains; Batch E decision/intake ports add no automatic resume or new blocker kind | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Canonical Leo/GPT decision authority remains external |
| AO-REQ-009 Typed AlertKind, deterministic payload/dedup, lifecycle, actions, and Korean labels | `src/domain/alerts/index.ts`, `src/application/alerts/index.ts`, `src/server/application.ts`, `src/ui/communication/` | `tests/integration/alert-application.test.ts`, `tests/security/http-boundary.test.ts`, `tests/ui/communication-center.component.test.tsx` | Accepted nine-kind/dedup/lifecycle UI remains; exact HTTP alert route acknowledges only and cannot resolve or invent an action | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Real live notification delivery remains gated |
| AO-REQ-010 Decision states, exact deterministic GPT package fields, and verified authority linkage | `src/domain/decisions/`, `src/application/advisor-inbox/`, `src/adapters/observations/artifacts/decision-authority.ts`, `src/server/application.ts`, `src/ui/communication/` | `tests/snapshot/gpt-package.test.ts`, `tests/integration/decision-authority-evidence.test.ts`, `tests/integration/advisor-inbox.test.ts`, `tests/security/http-boundary.test.ts` | Byte-exact package remains; `authorityRole` now survives parsed HTTP, command hash, immutable v2 link artifact, event, replay, and projection only after exact immutable repository/commit/path/SHA-256, mission, WorkUnit scope, and named-authority verification; every invalid/unreadable/stale case leaves no link event or artifact | `IMPLEMENTED_FINAL_REWORK__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Leo/GPT remains final authority; bounded Advisor routine scope is undefined and fails closed |
| AO-REQ-011 Notification states/idempotency using canonical AlertKind/dedup | `src/domain/state-machines/entities.ts`, `src/application/advisor-inbox/`, `src/application/alerts/`, `src/server/sse/` | `tests/recovery/advisor-message-crash-consistency.test.ts`, `tests/integration/alert-application.test.ts`, `tests/integration/sse-reconnect.test.ts` | Accepted durable/manual state remains; bounded SSE emits notification IDs/revisions only and never changes delivery or acknowledgement | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Real gateway delivery remains external/gated |
| AO-REQ-012 Event transition validation and stable rejection | `src/contracts/`, `src/domain/events/index.ts`, `src/domain/state-machines/` | `tests/domain/event-envelope.test.ts`, `tests/property/transition-matrix.test.ts` | Versioned boundaries, stable rejection codes, closed transitions, and unknown-field rejection pass; Advisor accepted Batch A | `IMPLEMENTED_BATCH_A__ADVISOR_ACCEPTED` | Later application commands remain gated |
| AO-REQ-013 UTC timestamps, stream/host sequence, clock quality | `src/domain/time/index.ts`, `src/domain/events/index.ts`, `src/application/hosts/freshness.ts` | `tests/domain/event-envelope.test.ts`, `tests/persistence/hash-chain.test.ts`, `tests/integration/project-freshness.test.ts` | Canonical event time/sequence plus explicit local source/receipt/clock-quality freshness inputs were accepted; remote host sequence/clock handshake absent | `IMPLEMENTED_BATCH_B_LOCAL_SUBSET__ADVISOR_ACCEPTED` | Remote host behavior gated |
| AO-REQ-014 Request idempotency, ordering, causal links | `src/domain/events/index.ts`, `src/persistence/file-store/event-store.ts`, `src/application/advisor-inbox/`, `src/server/http/` | `tests/recovery/crash-consistency.test.ts`, `tests/integration/http-advisor-message.test.ts`, `tests/recovery/rollback-disable.test.ts` | Accepted ledger/application replay remains; HTTP and durable disable preserve same-request replay and changed-input conflict across restart | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | None for local single-instance idempotency |
| AO-REQ-015 Append-only hash-chained audit history | `src/persistence/file-store/event-store.ts`, `src/domain/events/index.ts`, `src/server/security/audit.ts` | `tests/persistence/hash-chain.test.ts`, `tests/recovery/corruption-quarantine.test.ts`, `tests/security/audit-log.test.ts` | Domain ledger remains accepted; owner-only serialized security audit appends, hash-chain restart verification, tamper rejection, startup/bind class, request outcome, IDs, and payload hash without body/credential values pass | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Retention/off-host archival remains separately gated |
| AO-REQ-016 Deterministic projections and rebuild equivalence | `src/application/projections/mission-projector.ts`, `src/persistence/file-store/checkpoint-store.ts`, `src/persistence/file-store/projection-store.ts` | `tests/persistence/replay.test.ts`, `tests/recovery/restart-replay.test.ts` | Genesis/checkpoint canonical equivalence, atomic publication, invalid-checkpoint fallback, and scope replay pass; Advisor accepted Batch A | `IMPLEMENTED_BATCH_A__ADVISOR_ACCEPTED` | None for local Batch A core |
| AO-REQ-017 Evidence-backed completion and review routing | `src/application/evidence/index.ts`, `src/domain/completion/index.ts`, `src/application/advisor-inbox/`, `src/operations/evidence/`, `src/ui/scene/` | `tests/integration/advisor-inbox.test.ts`, `tests/recovery/recovery-result.test.ts`, `tests/ui/activity-mapping.test.ts` | Completion authority remains unchanged; delivery/UI/SSE/recovery result never auto-completes or substitutes for independent review | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Batch E implementation review and Advisor audit remain pending |
| AO-REQ-018 Immutable message requestId/hash/receipt | `src/application/advisor-inbox/`, `src/persistence/file-store/artifact-store.ts`, `src/server/http/` | `tests/integration/advisor-inbox.test.ts`, `tests/integration/http-advisor-message.test.ts` | Artifact precedes event; HTTP returns only the original durable receipt on same input and 409 on changed bytes after restart | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Real authenticated UI binding remains gated |
| AO-REQ-019 Advisor acknowledgement/intake/decision/resume chain | `src/application/advisor-inbox/`, `src/domain/decisions/`, `src/adapters/observations/artifacts/decision-authority.ts`, `src/server/application.ts` | `tests/integration/advisor-inbox.test.ts`, `tests/integration/decision-authority-evidence.test.ts`, `tests/security/http-boundary.test.ts` | Separate durable stages and `advisor_operator` routing remain; decision linkage is now actor-separated from the verified named authority and cannot append its link artifact/event until authority evidence corresponds exactly; no browser resume/close route exists | `IMPLEMENTED_FINAL_REWORK__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Canonical Leo/GPT authority remains external; Advisor routine decision scope remains unresolved/fail-closed |
| AO-REQ-020 No browser-to-Worker/Reviewer route | `src/ui/communication/`, `src/application/advisor-inbox/`, `src/adapters/gateways/`, `src/server/http/` | `tests/ui/communication-center.component.test.tsx`, `tests/integration/tmux-advisor-gateway.test.ts`, `tests/security/http-boundary.test.ts`, `tests/acceptance/batch-gates.test.ts` | Exact closed HTTP routes reject command/target/role/generic path fields; no Worker/Reviewer/terminal dispatch route or server process primitive exists | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Fixed prohibition; real Advisor transport remains external |
| AO-REQ-021 No arbitrary terminal/command surface | `src/adapters/observations/process-runner.ts`, `src/adapters/gateways/`, `src/server/http/server.ts`, `src/ui/communication/` | `tests/adapters/tmux-readonly.test.ts`, `tests/integration/tmux-advisor-gateway.test.ts`, `tests/security/http-boundary.test.ts`, `tests/acceptance/batch-gates.test.ts` | Accepted read-only fixed-argv observation remains; HTTP mutation calls typed application ports only and has no shell/tmux/process/role-dispatch route | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Fixed prohibition |
| AO-REQ-022 TmuxAdvisorGateway fixed Advisor-only delivery | `src/adapters/gateways/tmux-advisor/` | `tests/integration/tmux-advisor-gateway.test.ts`, `tests/recovery/advisor-message-crash-consistency.test.ts` | Fixed logical route/capability/time/kill/manual/ambiguous no-resend behavior was accepted as the Batch E dependency and remains unchanged | `IMPLEMENTED_BATCH_D__ADVISOR_ACCEPTED` | Real transport capability/activation remains external and unused |
| AO-REQ-023 HermesAdvisorGateway interface/stub only | `src/adapters/gateways/hermes/` | `tests/adapters/hermes-disabled.test.ts`, `tests/acceptance/batch-gates.test.ts` | Accepted interface-compatible disabled stub remains; Batch E adds no endpoint, credential, discovery, network, process, write, cache, or activation | `IMPLEMENTED_BATCH_D_DISABLED_STUB__ADVISOR_ACCEPTED` | Separate Leo/GPT Hermes mission |
| AO-REQ-024 Read-only tmux observation, no prose inference | `src/adapters/observations/tmux/source.ts`, `src/application/queries/dashboard-view-model.ts`, `src/ui/scene/state-machine.ts` | `tests/adapters/tmux-readonly.test.ts`, `tests/ui/dashboard-view-model.test.ts`, `tests/ui/scene-boundary.test.ts` | Batch B/C observation and presentation boundaries are Advisor-accepted; Batch D adds no terminal-text read or inference | `IMPLEMENTED_THROUGH_BATCH_C__ADVISOR_ACCEPTED` | None for local observation |
| AO-REQ-025 Read-only Git and immutable artifact contracts | `src/adapters/observations/git/source.ts`, `src/adapters/observations/artifacts/source.ts`, `src/adapters/observations/manifest/source.ts` | `tests/adapters/git-readonly.test.ts`, `tests/adapters/artifact-manifest.test.ts` | Fixed Git argv/root/ref/pair and bounded file evidence were Advisor-accepted after Batch B | `IMPLEMENTED_BATCH_B__ADVISOR_ACCEPTED` | None for the Batch B local subset |
| AO-REQ-026 Transport authority reference/kill switch/manual fallback | `src/adapters/gateways/tmux-advisor/`, `src/operations/readiness/delivery-control.ts`, `src/ui/communication/` | `tests/integration/tmux-advisor-gateway.test.ts`, `tests/recovery/rollback-disable.test.ts`, `tests/e2e/communication-center.spec.ts` | Accepted external kill/manual behavior remains; app-local delivery defaults disabled and durably replays/conflicts disable without enable or transport access | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Real capability/re-enable remains separately controlled |
| AO-REQ-027 Loopback private default/fail-closed non-loopback | `src/runtime/`, `src/server/network/`, `src/server/http/static-shell.ts`, `config/agent-office.loopback.json` | `tests/integration/runtime-composition.test.ts`, `tests/security/bind-policy.test.ts`, `tests/security/static-shell.test.ts`, `scripts/runtime-smoke.mjs` | `npm run start:loopback` validates explicit config/state/static/manifest roots and composes only loopback listeners; no-provider smoke returns `AUTH_BLOCKED`, denies protected projection, then proves listener rebind and writer-lock release | `IMPLEMENTED_FINAL_REWORK__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Private/public network modes remain gated/unsupported |
| AO-REQ-028 Auth/session design without embedded real secret | `src/server/auth/`, `src/server/config.ts`, `src/runtime/composition.ts`, `src/runtime/test-composition.ts`, `src/ui/runtime/client.ts` | `tests/security/auth-session.test.ts`, `tests/security/http-boundary.test.ts`, `tests/integration/runtime-composition.test.ts` | Production composition supplies no session registry and cannot select test auth; the separately imported synthetic harness retains both test guards. Protected projection returns session capability/CSRF/expiry only after authentication, and revocation/expiry closes SSE and removes the client action port | `IMPLEMENTED_FINAL_REWORK__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Real provider/credential and AO-WU-14 posture require Leo/GPT authority |
| AO-REQ-029 CSRF/origin/Host/CORS/cookie controls | `src/server/network/`, `src/server/security/`, `src/server/http/` | `tests/security/http-boundary.test.ts`, `tests/security/static-shell.test.ts` | Exact Host/Origin/Referer fallback/Fetch Metadata/JSON/CSRF/capability/schema controls, no CORS, CSP/no-store/redacted errors, and no HSTS pass | `IMPLEMENTED_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | TLS/HSTS/private origin remain separately gated |
| AO-REQ-030 Rate limits, body bounds, output/content safety | `src/domain/messages/`, `src/server/security/rate-limiter.ts`, `src/server/http/`, `src/ui/communication/` | `tests/security/rate-limit.test.ts`, `tests/security/http-boundary.test.ts`, `tests/ui/communication-center.component.test.tsx` | Reviewed bootstrap/message/other/read/SSE constants, 16/32 KiB bounds, timeout abort, control rejection, inert hostile markup, bounded 429, and redacted audit pass | `IMPLEMENTED_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Shared/multi-host limiting remains gated |
| AO-REQ-031 PWA cache confidentiality/offline read-only | `src/pwa/`, `public/sw.js`, `src/ui/pwa/` | `tests/pwa/cache-policy.test.ts`, `tests/e2e/pwa-cache-security.spec.ts`, `tests/e2e/pwa-lifecycle.spec.ts` | Install-time hashed shell precache, same-origin static-only runtime cache, API/auth/message/artifact/alert/decision/health exclusion, no sync queue, offline read-only, update consent, and unregister recovery pass | `IMPLEMENTED_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Raw authenticated live UI remains gated with real provider |
| AO-REQ-032 Tailscale/private-network plan disabled by default | `src/server/config.ts`, `config/agent-office.loopback.json` | `tests/security/private-network-disabled.test.ts` | Configuration accepts only loopback, `NONE_READ_ONLY`, mutation disabled, no CORS/proxy/TLS/HSTS; all private-network-like changes fail schema validation | `DEFERRED_WITH_GATE` | Leo/GPT approval, threat review, credentials/TLS, Fable5 review |
| AO-REQ-033 Multi-project registry and root isolation | `src/application/projects/registry.ts` | `tests/integration/project-freshness.test.ts` | Trusted stable IDs, path-free summaries, cross-project denial, and overlap rejection were Advisor-accepted after Batch B | `IMPLEMENTED_BATCH_B__ADVISOR_ACCEPTED` | Browser registry editing remains absent |
| AO-REQ-034 Linux server/future Mac host topology and trust | `src/adapters/hosts/` | `tests/contract/host-observation.test.ts` | `NOT_IMPLEMENTED`; [Integration Sections 7-8](integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md#8-host-identity-and-trust) | `DEFERRED_WITH_GATE` | Remote-host/private-network/key mission; Mac host approval |
| AO-REQ-035 Host clock/offline/reconnect/gap/stale evidence | `src/application/hosts/freshness.ts`, `src/ui/scene/state-machine.ts` | `tests/integration/project-freshness.test.ts`, `tests/ui/activity-mapping.test.ts` | Batch C local freshness/presentation is Advisor-accepted; remote host envelopes/gaps/reconnect remain absent | `IMPLEMENTED_BATCH_C_LOCAL_PRESENTATION_SUBSET__ADVISOR_ACCEPTED` | Remote collectors remain gated |
| AO-REQ-036 Structured activity and exact observable mapping: dispatching/reading/working/testing/writing-result/returning-result/reviewing/block/wait/recovery | `src/domain/activity/index.ts`, `src/ui/scene/` | `tests/domain/writing-result-activity.test.ts`, `tests/contract/required-observable-conformance.test.ts`, `tests/ui/activity-mapping.test.ts` | All exact Batch C mappings and prose exclusion are Advisor-accepted and pass in Batch D regression | `IMPLEMENTED_BATCH_C__ADVISOR_ACCEPTED` | None for scene mapping |
| AO-REQ-037 Animation precedence, dedup, bounded motion | `src/ui/scene/state-machine.ts`, `src/ui/styles.css` | `tests/ui/activity-precedence.test.ts`, `tests/e2e/office-scene.spec.ts` | Accepted scene semantics remain unchanged; exactly three baselines were regenerated because the required Batch E runtime strip changes page pixels, then directly inspected and pass the 18-test suite | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Cross-host/browser/font portability remains an operations prerequisite |
| AO-REQ-038 Accessibility and reduced motion | `src/ui/scene/office-scene.tsx`, `src/ui/communication/`, `src/ui/pwa/`, `src/ui/styles.css` | `tests/ui/runtime-boundary.component.test.tsx`, `tests/e2e/accessibility.spec.ts`, `tests/e2e/communication-center.spec.ts`, `tests/e2e/pwa-lifecycle.spec.ts` | Accepted scene/communication accessibility plus semantic PWA/offline/update controls, 44px/focus/WCAG and 320/200%-text overflow pass | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Live-auth focus transition needs real-provider review |
| AO-REQ-039 Local visual asset/icon/license strategy | `src/ui/assets/LICENSES.md`, `src/ui/scene/assets/`, `public/icons/`, `playwright.config.ts` | `tests/ui/layout-contract.test.ts`, `tests/pwa/cache-policy.test.ts`, `tests/e2e/office-scene.spec.ts` | Accepted local scene assets remain; two project-authored PWA SVGs are inventoried and exactly three status-strip baselines were regenerated/inspected | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Cross-host/browser/font portability remains an operations prerequisite |
| AO-REQ-040 Desktop/mobile stable dimensions, overflow, Korean expansion, and no silent translation | `src/ui/styles.css`, `src/ui/i18n/ko.ts`, `src/ui/communication/`, `src/ui/pwa/` | `tests/ui/korean-vocabulary.test.ts`, `tests/ui/runtime-boundary.component.test.tsx`, `tests/e2e/communication-center.spec.ts`, `tests/e2e/office-scene.spec.ts` | Existing labels plus runtime strip pass 1440/1024/390/320/landscape/200%-text no-overflow and direct desktop/mobile/reduced-motion inspection | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | New security-code localization requires reviewed vocabulary |
| AO-REQ-041 PWA installability/update/offline UX | `src/pwa/`, `src/ui/pwa/`, `src/ui/runtime/`, `public/` | `tests/integration/runtime-composition.test.ts`, `tests/ui/runtime-boundary.component.test.tsx`, `tests/e2e/pwa-lifecycle.spec.ts` | Valid install/update/offline/recovery behavior remains; the production entry now renders live runtime boundary state from status/projection and shows exact fail-closed auth/projection/SSE codes instead of silently mounting fixtures | `IMPLEMENTED_FINAL_REWORK__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Real authenticated operation remains gated by provider/AO-WU-14 decision |
| AO-REQ-042 SSE over WebSocket with cursor/reset | `src/server/sse/`, `src/server/http/server.ts`, `src/ui/runtime/client.ts` | `tests/integration/sse-reconnect.test.ts`, `tests/integration/runtime-composition.test.ts` | Server limits remain; the production client now sends the cursor, validates projection/reset/revocation events, reconnects with a refreshed protected projection, and clears session/mutation state on expiry or revocation | `IMPLEMENTED_FINAL_REWORK__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | WebSocket requires a new reviewed decision; real authenticated run remains gated |
| AO-REQ-043 Single-writer JSONL/artifact/projection crash consistency | `src/persistence/file-store/`, `src/application/startup/recovery.ts`, `src/operations/backup/` | `tests/recovery/crash-consistency.test.ts`, `tests/recovery/restart-replay.test.ts`, `tests/recovery/backup-restore.test.ts` | Accepted writer/replay core remains; backup requires stopped writer and a flushed exact checkpoint before publishing completion | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Real-root/off-host operation remains gated |
| AO-REQ-044 Corruption quarantine and stale/conflict behavior | `src/persistence/file-store/`, `src/application/advisor-inbox/`, `src/operations/readiness/`, `src/operations/restore/` | `tests/recovery/corruption-quarantine.test.ts`, `tests/recovery/advisor-message-crash-consistency.test.ts`, `tests/recovery/backup-restore.test.ts`, `tests/operations/readiness.test.ts` | Accepted quarantine/manual recovery remains; tampered backup/build/path/mode/hash rejects and startup projects store/replay/stale failure with mutation disabled | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Remote/service supervision remains gated |
| AO-REQ-045 Backup and isolated restore | `src/operations/backup/`, `src/operations/restore/` | `tests/recovery/backup-restore.test.ts` | Owner-only stopped-writer checkpoint, manifest/modes/hashes/source sequence, complete marker, incomplete/tampered rejection, disjoint candidate restore, replay/projection/idempotency proof, and explicit stopped-service selection plan pass | `IMPLEMENTED_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Off-host backup, encryption keys, schedule, retention, and real-root operation remain gated |
| AO-REQ-046 Application rollback and disable strategy | `src/operations/compatibility/`, `src/operations/readiness/`, `src/application/startup/` | `tests/recovery/rollback-disable.test.ts`, `tests/operations/readiness.test.ts` | Read/write/read-only/incompatible build classification, no destructive downgrade, default-off durable delivery disable/idempotency, and startup auth/quarantine/replay/stale/SSE modes pass | `IMPLEMENTED_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Deployment/Git rollback and real gateway re-enable remain external/gated |
| AO-REQ-047 Evidence-bearing proof of recovery | `src/operations/evidence/` | `tests/recovery/recovery-result.test.ts` | Immutable owner-only result requires actor/build/commit/mode, hashes, replay equivalence, idempotency conflict/replay, before/after denominator/state, controls, elapsed steps, forbidden scope, and Advisor review route | `IMPLEMENTED_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Advisor audit and independent implementation review remain pending |
| AO-REQ-048 Batch A-E dependencies, acceptance tests, reviews | `package.json`, `playwright.config.ts`, `tests/acceptance/batch-gates.test.ts`, result artifacts | `tests/acceptance/batch-gates.test.ts`, `tests/integration/runtime-composition.test.ts`, `tests/integration/decision-authority-evidence.test.ts` | Batches A-D are accepted; original final dual review returned `NEEDS_PATCH`; rework commit `0f90e39d3995ffca97eb7a05ef051d8f9a3719c1` passes 52 Vitest files/205 tests, 18 Chromium tests, 4/4 composition, 5/5 authority, both builds, zero-vulnerability audit, exact smoke, diff/boundary, and direct visual gates | `IMPLEMENTED_FINAL_REWORK__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Same Fable5 delta review, Advisor verification, AO-WU-14 Leo/GPT decision, final approval |
| AO-REQ-049 Current bootstrap truth, unknowns, limitations | seven canonical docs and result artifact | `tests/acceptance/batch-gates.test.ts` | AO-E-R1/AO-E-R2 and D-1/D-2/D-3 are corrected from actual rework evidence; no real authenticated operation is claimed and every real-auth/network/deployment/backup/Hermes/DB gate remains explicit | `IMPLEMENTED_FINAL_REWORK__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Same Reviewer/Advisor gates; AO-WU-14 auth-posture rider remains `NEEDS_LEO_GPT_DECISION` |
| AO-REQ-050 No DB/public/prod/Hermes implementation/automatic next mission | module/import/route/build policy | `tests/acceptance/batch-gates.test.ts`, `tests/security/private-network-disabled.test.ts` | Source/config/route scans prove no DB, public/prod mode, private network, real provider/secret, Hermes implementation, generic terminal/role dispatch, or automatic next mission | `OUT_OF_SCOPE` | New explicit Leo/GPT mission where applicable; Hermes separately gated |

### 4.1 Fable5 F-1/F-2/F-3 rework anchors

| Finding | Exact canonical closure | Reproduction test path | Current status |
|---|---|---|---|
| `F-1` | Domain 6.3 maps all 16 exact required observable names across durable primary state plus structured activity; Domain 13 adds `WRITING_RESULT`; UI 5-6 maps triggers/end/precedence | `tests/contract/required-observable-conformance.test.ts`, `tests/domain/writing-result-activity.test.ts`, `tests/ui/activity-mapping.test.ts`, `tests/ui/activity-precedence.test.ts` | `DESIGN_PASS`; accepted domain/fallback behavior plus Batch C exact event-only mapping, order, precedence, deduplication, stale/evidence failure, and bounded cues pass |
| `F-2` | Domain 7.2 defines closed `BlockerKind` plus exact `BlockerOpened` contract/lifecycle; Domain 7.3 defines closed `AlertKind`, payload, dedup, actions; Domain 8.4 pins all 13 GPT package fields; Integration 10 consumes canonical kinds only | `tests/contract/blocker-alert-vocabulary.test.ts`, `tests/snapshot/gpt-package.test.ts`, later notification tests | `DESIGN_PASS`; Batch A contracts/snapshots implemented at code commit; notification integration deferred |
| `F-3` | UI 3.4 fixes Korean hierarchy, all 16 status labels, nine alert labels, six alert actions, 16 blocker labels/fallback, two distinct progress labels, and `labelKo` preservation | `tests/domain/manifest.test.ts`, `tests/ui/korean-vocabulary.test.ts`, `tests/ui/communication-center.component.test.tsx` | `DESIGN_PASS`; accepted prior vocabulary remains stable and Batch D renders all five message kinds, nine alert kinds, and six exact alert actions |

## 5. Batch and Review Coverage

| Stage | Canonical scope | Required independent gate | Evidence status now |
|---|---|---|---|
| Candidate design | Exact seven files in this index | Fable5 Level 3 `DESIGN_REVIEW` over exact commit | Delta `DESIGN_REVIEW: PASS` over `82821afe48b08f70b6888e3ebf12dee3095cd2bb`, recorded in foundation-docs `6c9d94f31ae5dd5424b511afb68188681ff95349` |
| Batch A | Domain contract, manifest, state machines, single-writer store, projections | Prior design PASS; Advisor batch acceptance | Code/config/tests `7edc8f79bedb059ab6697e64ddaf57fbebde2c87`; 15 files/36 tests plus lint/typecheck/build/audit pass; Advisor verdict `PASS__BATCH_A_ACCEPTED_AS_BATCH_B_DEPENDENCY` |
| Batch B | Read-only adapters and base dashboard | Batch A dependency/evidence accepted | Code/config/tests/assets `85e66d856e33a0df73041cb4b33aba30a8f9f96d`; 23 files/84 tests, lint/typecheck/build/audit/diff and read-only smoke pass; Advisor verdict `PASS__BATCH_B_ACCEPTED_AS_BATCH_C_DEPENDENCY` |
| Batch C | Structured-event office scene/responsive accessibility | Batch B dependency/evidence accepted | Scene/config/assets commits `e30a6cda52e14a4bf30b2d1b7445fa26645496e5`, `ad74b9e8f98298269534676237a66cfaac055e00`, and `243d3a5731a6b22c29caeaba6567aed505f78d59`; Advisor verdict `PASS__BATCH_C_ACCEPTED_AS_BATCH_D_DEPENDENCY` at foundation-docs `3edcf7914715463e0ec793527c963c1847260b0f` |
| Batch D | Advisor Inbox, alerts, GPT package, TmuxAdvisorGateway, acknowledgement/resume | Batch C dependency/evidence accepted; transport capability remains injected/disabled unless valid | Code/config/tests `7366036f8a1e6fc9d4e911e8d193e17eeb95f54c`; AO-D-R1 `04809004bfd863181f4af8260879f56bc8b6ede6`; accepted as Batch E dependency at `31c59ccdd0aed080f45d95195fb4c289eb48b24c` |
| Batch E | PWA, security, recovery, full end-to-end tests | Batch D dependency/evidence accepted; any real auth/private gate remains closed | Code/config/tests/assets `e0a11f69fffc9d35d67cc478cbefbb92d93cf528`; 50 Vitest files/196 tests, 18 Playwright tests, lint/typecheck/build/audit/diff/boundary/smoke/direct visual inspection pass; pending independent review and Advisor acceptance |
| Final rework | AO-E-R1 executable composition/runtime client; AO-E-R2 immutable authority correspondence; D-1/D-2/D-3 docs | Final dual review `NEEDS_PATCH`; same Worker and same Reviewer | Code/config/tests `0f90e39d3995ffca97eb7a05ef051d8f9a3719c1`; 52/205 Vitest, 18/18 Playwright, 4/4 composition, 5/5 authority, full gates/smoke/direct inspection pass; delta review pending |
| Worker result | Exact final-rework as-built evidence package | Advisor verification | Published after this canonical docs commit through the exact foundation-docs result/pointer paths; approval pending |
| Implementation review | Actual code/tests/design conformance | Fable5 `IMPLEMENTATION_REVIEW` | Original final dual review: `NEEDS_PATCH` for AO-E-R1/AO-E-R2 and D-1/D-2/D-3; rework is pending same-Reviewer delta review |
| Private run/final audit | Private desktop/mobile/PWA/recovery evidence | Advisor audit, then Leo/GPT final approval | `NOT_IMPLEMENTED` |

Verdict routing is fixed: `NEEDS_PATCH` returns through the same Worker and
Reviewer; `PASS_WITH_RISK` returns to Leo/GPT; `FAIL` stops; only `PASS` permits the
normal next gate. No UI or Worker automatically advances a stage.

## 6. Divergence and As-Built Update Rules

During implementation/review, every divergence is classified exactly as:

- `CODE_DEFECT`
- `DESIGN_DEFECT`
- `DOCUMENTATION_STALE`
- `DEFERRED_WITH_GATE`
- `NEEDS_LEO_GPT_DECISION`

The design may not be rewritten to excuse a code defect. Final closure requires
these canonical files to be updated from actual reviewed implementation paths,
tests, evidence, commits, and limitations. `CURRENT_EVIDENCE` changes from
`NOT_IMPLEMENTED` only when exact artifacts support it.

### 6.1 Final-rework divergence classification

- `DOCUMENTATION_STALE`: final design review findings D-1 (composition/runtime
  status absent), D-2 (AO-REQ-010/019 contradicted the dropped authority field),
  and D-3 (stale Master Batch D heading) are corrected in these seven canonical
  files from rework commit `0f90e39d3995ffca97eb7a05ef051d8f9a3719c1`.
- `DEFERRED_WITH_GATE`: private-network, real-auth/provider/credential,
  remote-host/Mac, Hermes implementation, DB, public/production/live deployment,
  off-host/encrypted/scheduled backup, real transport activation, shared
  multi-host rate limiting, and cross-host/browser/font portability remain at
  named gates.
- `CODE_DEFECT`: reproduced AO-E-R1 and AO-E-R2 are patched at
  `0f90e39d3995ffca97eb7a05ef051d8f9a3719c1`; closure remains subject to the same
  Fable5 Reviewer delta review and Advisor acceptance.
- `DESIGN_DEFECT`: none encountered.
- `NEEDS_LEO_GPT_DECISION`: AO-WU-14 still requires Leo/GPT to decide whether
  private-run verification proceeds composed-but-`AUTH_BLOCKED`/test-marked or
  waits for a separately approved real LocalBootstrap secret-handling gate.

## 7. Explicit Deferred and Forbidden Gates

| Capability | Current status | Required gate |
|---|---|---|
| Real auth credential/proof use | Designed only; no real value accessed | Exact secret-handling implementation/private-run authority |
| Tailscale/private network | Disabled | Leo/GPT host/user/network approval, threat review, identity/TLS/ACL evidence, Fable5 review |
| Remote Linux collector | Interface only | Remote-host and key-provisioning mission |
| Future Mac host | Interface only | Mac adapter/test-host mission plus trust/key gate |
| Hermes gateway | Stub only | Separate Leo/GPT Hermes mission and both reviews |
| Database/multi-user persistence | No DB | New data/security/migration/operations mission |
| Public exposure | Unsupported, not a config option | New explicit mission and threat/deployment design |
| Production/live deployment | Forbidden | Separate approval/release train |
| Worker/Reviewer browser dispatch | Forbidden | Fixed mission boundary; not an extension gate in M01 |
| Arbitrary terminal command surface | Forbidden | Fixed security boundary; must not be added |
| Automatic next mission/final approval | Forbidden | Leo/GPT retains authority permanently under current protocol |

## 8. Final Rework Closure Checklist

- the seven canonical design documents remain owned only by Agent Office;
- independent design PASS and final dual-review `NEEDS_PATCH` evidence are
  referenced without claiming a passing delta review or final approval;
- Batch A-D acceptance, Batch E evidence, and final-rework implementation
  paths/tests/code commit are exact;
- the approved 15-WorkUnit source bytes, path, source commit, hash, labels,
  dependencies, and current facts are preserved;
- all A-D regression plus Batch E/final-rework composition, authority,
  HTTP/SSE/PWA/security/recovery/browser paths and lint/typecheck/build/audit/
  diff/boundary/WCAG/smoke gates pass;
- no DB, real secret/provider/credential, remote collector, private/public
  exposure, TLS/HSTS claim, deployment, production/live operation, Hermes
  implementation, real tmux input, browser role dispatch, or off-host backup
  exists; and
- the rework remains pending same-Reviewer delta review, Advisor verification,
  the AO-WU-14 Leo/GPT decision, and final approval; another mission does not
  start automatically.
