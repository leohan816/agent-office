# Agent Office M01 Feature and Traceability Index

Status: `LOCAL_BOOTSTRAP_PRIVATE_RUN_PASS__EXACT_DELIVERY_IMPLEMENTED_DISABLED__PENDING_FABLE5_IMPLEMENTATION_SECURITY_REVIEW`

Mission: `AGENT_OFFICE_M01_ADVISOR_MANAGED_OFFICE_WEB_CONTROL_PLANE`

This is the canonical discoverability and material-requirement traceability index
for M01. It records the reviewed implementation, the completed LocalBootstrap
private-run gate, Fable5-reviewed exact Advisor delivery design, and AO-WU-19
disabled implementation. It does not claim an enabled descriptor, live
capability/port instance, actual tmux input from Agent Office, implementation
review `PASS`, rehearsal, Leo/GPT final approval, or mission closure.

The additive M1.2 spatial Advisor-team office package is at status
`IMPLEMENTED_M1_2_AO12_B_STATIC_FIXTURE__PENDING_FOCUSED_FABLE5_UI_ACCESSIBILITY_ASSET_REVIEW_AND_ADVISOR_ACCEPTANCE__AO12_C_NOT_AUTHORIZED`.
The original design review and clean same-context Level-3 design delta review
passed, Advisor froze the 14-WorkUnit manifest, AO12-A was independently reviewed
and Advisor-accepted, and the exact AO12-B handoff authorized
`AO12-IWU-05..08` at base `ecd2652`. AO12-B now adds deterministic project
identity, original code-native actor/Channy/facility placeholders, one static
shared floor and complete mission boards, and responsive/accessibility proof
only behind the explicit test-demo URL parameter. It does not mount in the
production/private surface, add a cue runtime, or change M01 authority,
transport, authentication, delivery, persistence, dependency, or network
behavior. AO12-C remains unauthorized pending independent focused review and
Advisor acceptance of AO12-B.

## 1. Current Implemented Scope

The LocalBootstrap private-run gate passed against Agent Office base
`9c403da5662aeedc28a8c677c37a134aaa44dce3`; its server is stopped, proof is
absent, and real delivery remains manual. Leo/GPT then opened the separate
Level-3 exact delivery activation mission. Parent manifest version 5 declares 21
WorkUnits, adds AO-WU-16 through AO-WU-21, and makes AO-WU-15 depend on AO-WU-21.
The reviewed design is
[`architecture/AGENT_OFFICE_EXACT_ADVISOR_DELIVERY_BRIDGE_DESIGN.md`](architecture/AGENT_OFFICE_EXACT_ADVISOR_DELIVERY_BRIDGE_DESIGN.md).
It resolves DQ-01 through DQ-08 and received Fable5 Level-3 `PASS`. AO-WU-19 now
implements the trusted v3/v2 selection, exact authority/lease/preflight bridge,
fixed port and journal, local latch, committed evidence ingress, separate UI
states, disabled example, and SIASIU correction. No enabled descriptor, usable
authority material, server, credential, capability instance, or tmux input was
created. Independent Fable5 implementation/security review is the next gate.

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
- Final AO-E-R3 round-2 code/config/test rework: commit
  `10fdee75dca73c4fb5cde09019c403d4dc1682bb`.
- LocalBootstrap private-run gate code/config/tests/baselines: commit
  `2623922877bd52dc7f5b6c6cd45fae755e5ff228`.
- Exact delivery reviewed design: commit
  `d1708809467c6e97302c336c50aca7ffd4b355e5`; Fable5 design `PASS` is recorded
  in foundation-docs commit `62973c4`.

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

Final rework round 2 commit `10fdee75dca73c4fb5cde09019c403d4dc1682bb`
closes AO-E-R3 R3.1-R3.8. Production startup now requires explicit versioned
operational configuration and verified external manifest authority; test/demo
manifest copies have no production fallback. The operational coordinator composes
isolated manifest, Git, exact-pane tmux, and artifact reads, periodically refreshes
them, and projects evidence-correct freshness without terminal prose inference.
Durable alerts and typed scene roles now reach the authenticated production
projection. Production injects `TmuxAdvisorGateway` and never composes Hermes;
capability/delivery absence, kill, and ambiguity remain manual fallback. The
guarded composed lifecycle proves one fixed Advisor pointer, receipt,
acknowledgement, intake, verified decision link, resume evidence, and duplicate
non-execution. The complete gate is 53 Vitest files/228 tests and 21 Playwright
tests; three new composed desktop/mobile/reduced-motion baselines were directly
inspected. Real auth/provider, real tmux delivery activation, private/public
networking, deployment/live operation, and final authority remain gated.

The LocalBootstrap gate commit
`2623922877bd52dc7f5b6c6cd45fae755e5ff228` resolves the missing-provider code
defect without widening the network or delivery boundary. Explicit trusted v2
configuration selects a cryptographic single-use provider on exact
`127.0.0.1:4317`; the proof is delivered once through an exclusive owner-only
file outside Git, while provider state retains only a salted verifier. The
bounded exact-Origin exchange creates a server-side `viewer` plus `leo_input`
session; logout, expiry, revocation, rotation, SSE close, and cookie clearing fail
closed. Production requires the actual current Git-verified foundation-docs M01
manifest and rejects fixtures, a real gateway capability, or a tmux delivery
port before proof creation/bind. The default committed mode remains
`NONE_READ_ONLY` and manual Advisor fallback remains visible. The gate passes 55
Vitest files/255 tests and 21/21 Playwright tests plus lint, typecheck, builds,
smoke, audit, diff/secret scan, and direct inspection of all three composed
baselines. No real credential or private run was created.

## 2. Canonical Design Documents

| Document | Canonical subject |
|---|---|
| [`architecture/AGENT_OFFICE_M1_2_SPATIAL_OFFICE_MASTER_DESIGN.md`](architecture/AGENT_OFFICE_M1_2_SPATIAL_OFFICE_MASTER_DESIGN.md) | Shared wide open-office floor, exact Advisor Team ownership/assignments, selected-detail/non-selected spatial visibility, complete mission boards, resolved Channy and placeholder direction, responsive/accessibility architecture, and M1 adapter |
| [`contracts/AGENT_OFFICE_M1_2_SPATIAL_EVENT_ANIMATION_CONTRACT.md`](contracts/AGENT_OFFICE_M1_2_SPATIAL_EVENT_ANIMATION_CONTRACT.md) | Accepted structured handoff/dispatch/work/test/review/result/patch/decision/completion cues, Channy status reflection, provenance, precedence, deduplication, stale/reload suppression, budgets, and static equivalence |
| [`ui/AGENT_OFFICE_M1_2_CHARACTER_PROJECT_IDENTITY_SYSTEM.md`](ui/AGENT_OFFICE_M1_2_CHARACTER_PROJECT_IDENTITY_SYSTEM.md) | Advisor Team-first identity, fixed approved project palette, SIASIU naming rule, current/future Advisor-character uniqueness, Channy Bedlington Terrier boundary, and project-authored placeholder inventory/hash contract |
| [`operations/AGENT_OFFICE_M1_2_IMPLEMENTATION_WORKUNIT_PLAN.md`](operations/AGENT_OFFICE_M1_2_IMPLEMENTATION_WORKUNIT_PLAN.md) | Frozen `AO12-IWU-01` through `AO12-IWU-14`, serial reversible batches, exact tests/rollback/acceptance, AO12-U01-U14 traceability, and AO12-A/AO12-B as-built status; AO12-C remains unauthorized |
| [`architecture/AGENT_OFFICE_EXACT_ADVISOR_DELIVERY_BRIDGE_DESIGN.md`](architecture/AGENT_OFFICE_EXACT_ADVISOR_DELIVERY_BRIDGE_DESIGN.md) | DQ-01 through DQ-08, exact fixed-pane pointer bridge, durable no-resend transport, Git-verified Advisor evidence ingress, rehearsal, and nine-criterion traceability |
| [`architecture/AGENT_OFFICE_MASTER_DESIGN.md`](architecture/AGENT_OFFICE_MASTER_DESIGN.md) | Purpose, authority/source precedence, topology, stack boundary, SSE/PWA decision, batches/gates, unknowns |
| [`contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md`](contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md) | Manifest, event envelope, entity states, transitions, idempotency, ordering, decisions, projections, evidence completion |
| [`security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md`](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md) | Actors, threat/trust boundaries, loopback/private network, auth, CSRF, rate limits, audit, browser/adapter restrictions |
| [`integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md`](integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md) | Advisor gateways, read-only adapters, notifications, multi-project/host trust, clock, offline/reconnect/stale evidence |
| [`ui/AGENT_OFFICE_UI_ANIMATION_MAPPING.md`](ui/AGENT_OFFICE_UI_ANIMATION_MAPPING.md) | Responsive UI, hierarchy, event-only animation, visual assets, accessibility, reduced motion, stable layout, PWA UX |
| [`operations/AGENT_OFFICE_OPERATIONS_RECOVERY.md`](operations/AGENT_OFFICE_OPERATIONS_RECOVERY.md) | Durable file store, restart/crash, corruption, stale state, backup/restore, rollback/disable, proof of recovery |
| `docs/FEATURE_INDEX.md` | Discoverability, critical traceability, batch/review coverage, current truth, gates |

Agent Office is the sole canonical design owner. Foundation-docs may hold mission
governance, review evidence, results, and pointers but no competing canonical copy.

### 2.1 M1.2 patched product-intent pointer

- One shared American-style open-office floor keeps every registered Advisor
  Team spatially visible on wide desktop. Selection expands detail and full
  choreography; other Teams remain recognizable office areas with Team,
  responsible Advisor, mission, actor/state, and gate/blocker facts.
- Every active actor belongs to exactly one responsible Advisor Team or is
  `UNASSIGNED` and cannot receive work. `FOUNDATION_ADVISOR_TEAM` carries the
  Foundation Advisor, Control, Foundation Worker, Cosmile Worker, SIASIU Worker,
  Agent Office Worker, and assigned independent Reviewer;
  `VIBENEWS_ADVISOR_TEAM` exists only with a valid responsible Advisor and its
  assigned Worker, Designer, and Reviewer. Proximity never creates authority.
- Current configuration renders one character for the single active
  `Advisor roleInstanceId`; future reviewed multi-Advisor configuration renders
  one distinct character per exact instance and never clones an active instance.
- Project identity uses the approved Cosmile, SIASIU, Foundation, VibeNews,
  Agent Office, and Control palette families plus text/glyph/pattern cues. The
  official current project name is `SIASIU`; the identity document holds the
  explicit historical/forbidden-name test registry.
- Mission boards use only canonical, redacted registered display evidence for
  every required Team/Advisor/session/mission/Phase/WorkUnit/actor/Reviewer/
  handoff/progress/blocker/decision/evidence/freshness field. No terminal prose,
  timestamp, proximity, raw locator/path/credential, or stale fixture fills a
  missing value.
- Channy is resolved as
  `CHANNY_ENABLED__NON_OPERATIONAL_AMBIENT_COMPANION_AND_STRUCTURED_STATUS_REFLECTOR`;
  art direction is resolved as
  `APPROVE_PROJECT_AUTHORED_CODE_NATIVE_PLACEHOLDERS_FOR_M1_2_IMPLEMENTATION`.
  Neither decision by itself authorizes a batch, external assets, operational
  behavior, authority, transport, or state inference. The separate exact
  AO12-B handoff authorized original code-native placeholders only; no external
  or production asset and no Channy behavior was created.

AO12-A is additive and not production-selected. Its as-built paths are
`src/application/spatial-office/`, the focused contract/UI tests, and the exact
SIASIU current-name compatibility correction. The existing `sceneRoles` M1
surface remains authoritative, unknown spatial versions retain the static M1
view, and all six M1 baselines remain byte-identical to design base `b7d8cdb`.
AO12-B is likewise non-production-selected: `src/ui/spatial/` is reachable only
from `test-demo` plus exact `surface=spatial-static`; default M1 and production
entry behavior remains unchanged. Four focused files pass 24 tests, the static
browser spec passes 10 tests, the full regression passes 65/342 Vitest plus
28/28 default-demo and 3/3 composed Chromium tests, and six new
configured-runtime PNGs were directly inspected.

## 3. Status and Gate Vocabulary

| Status | Meaning |
|---|---|
| `DESIGNED_M1_2_NARROW_PRODUCT_INTENT_PATCH__IMPLEMENTATION_NOT_STARTED_NOT_AUTHORIZED_PENDING_CLEAN_DELTA_PASS` | Historical pre-implementation state for the five-document narrow patch; superseded for `AO12-IWU-01..08` only by the clean delta `PASS`, manifest freeze, serial reviews/acceptance, and exact AO12-A/AO12-B handoffs |
| `IMPLEMENTED_M1_2_AO12_A__PENDING_FOCUSED_FABLE5_REVIEW_AND_ADVISOR_ACCEPTANCE__AO12_B_NOT_AUTHORIZED` | Historical pre-acceptance state: `AO12-IWU-01..04` were locally implemented but not yet accepted; superseded by corrected focused `PASS`, Advisor acceptance, and the exact AO12-B handoff |
| `IMPLEMENTED_M1_2_AO12_B_STATIC_FIXTURE__PENDING_FOCUSED_FABLE5_UI_ACCESSIBILITY_ASSET_REVIEW_AND_ADVISOR_ACCEPTANCE__AO12_C_NOT_AUTHORIZED` | AO12-A is accepted and `AO12-IWU-05..08` are locally implemented/verified as explicit test-demo-only static UI; no motion, production mount, external asset, dependency, authority, transport, authentication, DB, or network change exists; focused review and Advisor acceptance are required before AO12-C |
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
| `IMPLEMENTED_LOCAL_BOOTSTRAP_GATE__PENDING_FABLE5_AND_ADVISOR` | LocalBootstrap code/config/tests/docs exist at the named commit; no real credential/private run is claimed until Fable5 code/security PASS and Advisor authority |
| `IMPLEMENTED_FINAL_REWORK__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | The final-review code/documentation defect is patched at the named commit and verified; the same Fable5 Reviewer delta review and Advisor decision remain pending |
| `DESIGNED_EXACT_ADVISOR_DELIVERY_CANDIDATE__PENDING_FABLE5` | Design/instruction artifacts only; no delivery authority, capability, port, runtime behavior, or actual tmux input exists until the named serial review/implementation/review/rehearsal train passes |
| `IMPLEMENTED_EXACT_DELIVERY_DISABLED__PENDING_FABLE5_SECURITY_REVIEW` | Reviewed exact bridge code/tests/docs exist, but no enabled descriptor, usable authority material, live capability/port instance, server, or actual tmux input exists |

Every `CURRENT_EVIDENCE` value beginning with `NOT_IMPLEMENTED` is honest design
evidence only. A document section is not proof that behavior exists.

## 4. Material Requirement Traceability

| DESIGN_REQUIREMENT | IMPLEMENTATION_PATH | TEST_PATH | CURRENT_EVIDENCE | STATUS | DEFERRED_GATE |
|---|---|---|---|---|---|
| AO-REQ-001 Purpose, audience, operations focus, non-goals | `src/ui/`, `src/application/advisor-inbox/`, `src/server/`, `src/pwa/`, `src/operations/` | `tests/acceptance/batch-gates.test.ts`, `tests/security/static-shell.test.ts`, `tests/e2e/pwa-lifecycle.spec.ts` | Commit `e0a11f69fffc9d35d67cc478cbefbb92d93cf528` implements the loopback-private local control-plane boundary without widening product authority | `IMPLEMENTED_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Implementation review and Advisor acceptance; real auth/network/deployment separately gated |
| AO-REQ-002 Actor authority and source-of-truth precedence | `src/contracts/types.ts`, `src/application/evidence/index.ts`, future authority application policy | `tests/domain/transitions.test.ts`, later authority tests | Actor/evidence references and fail-closed verification primitives are in code commit `7edc8f79bedb059ab6697e64ddaf57fbebde2c87`; full cross-source conflict application remains absent | `IMPLEMENTED_BATCH_A_CONTRACT_ONLY` | Canonical V2 remains external authority; application integration in later batches |
| AO-REQ-003 Responsive private PWA and quiet UI | `src/ui/`, `src/ui/runtime/`, `src/pwa/`, `public/`, `src/runtime/` | `tests/integration/runtime-composition.test.ts`, `tests/ui/runtime-boundary.component.test.tsx`, `tests/e2e/`, `tests/e2e-composed/application-office-scene.spec.ts` | Production mounts the typed application projection; explicit LocalBootstrap shows restrained Korean login, authenticated/mutation badges and logout while keeping delivery manual. Default no-provider remains `AUTH_BLOCKED`; 18 demo plus 3 composed browser tests pass and all three final baselines were directly inspected | `IMPLEMENTED_LOCAL_BOOTSTRAP_GATE__PENDING_FABLE5_AND_ADVISOR` | Real credential creation and private-run visual verification require Fable5 PASS and Advisor authority |
| AO-REQ-004 Initiative -> Package -> Mission -> Phase -> WorkUnit with fixed Korean hierarchy labels | `src/domain/manifest/index.ts`, `fixtures/manifests/`, `src/ui/i18n/ko.ts`, `src/ui/dashboard.tsx` | `tests/domain/manifest.test.ts`, `tests/ui/korean-vocabulary.test.ts`, `tests/ui/dashboard.component.test.tsx` | Exact source hierarchy/`labelKo` and fixed Korean hierarchy labels were Advisor-accepted after Batch B and remain unchanged in Batch C | `IMPLEMENTED_THROUGH_BATCH_B__ADVISOR_ACCEPTED` | None for the local hierarchy subset |
| AO-REQ-005 Versioned denominator and exact scope accounting | `src/domain/manifest/index.ts`, `src/application/projections/mission-projector.ts`, `src/application/queries/dashboard-view-model.ts` | `tests/property/scope-counting.test.ts`, `tests/ui/dashboard-view-model.test.ts` | Advisor-accepted scope core plus distinct declared WorkUnit denominator/future-unapproved rendering pass unchanged | `IMPLEMENTED_THROUGH_BATCH_B__ADVISOR_ACCEPTED` | Authority artifact still required for any scope change |
| AO-REQ-006 Durable WorkUnit states/transitions/dependencies plus exact 16-name primary/activity conformance | `src/domain/state-machines/work-unit.ts`, `src/domain/activity/index.ts`, `src/ui/scene/state-machine.ts` | `tests/property/transition-matrix.test.ts`, `tests/contract/required-observable-conformance.test.ts`, `tests/ui/activity-mapping.test.ts` | Batch C exact scene mapping and evidence/source fail-closed coverage are Advisor-accepted and remain regression-locked | `IMPLEMENTED_THROUGH_BATCH_C__ADVISOR_ACCEPTED` | None for the Batch C scene subset |
| AO-REQ-007 Message states and immutable Advisor flow | `src/domain/messages/index.ts`, `src/application/advisor-inbox/`, `src/runtime/composition-core.ts`, `src/server/application.ts`, `src/server/http/`, `src/ui/runtime/client.ts` | `tests/integration/advisor-inbox.test.ts`, `tests/recovery/advisor-message-crash-consistency.test.ts`, `tests/integration/http-advisor-message.test.ts`, `tests/integration/runtime-composition.test.ts` | LocalBootstrap grants only `viewer`/`leo_input`; production proves durable message persistence while the capability-less gateway stays `MANUAL_FALLBACK_REQUIRED`. Advisor acknowledgement/intake/decision authority is not granted | `IMPLEMENTED_LOCAL_BOOTSTRAP_GATE__PENDING_FABLE5_AND_ADVISOR` | Real private-run message evidence and every real transport activation remain gated |
| AO-REQ-008 Typed BlockerKind, exact BlockerOpened fields/lifecycle/resume proof, and Korean labels | `src/domain/blockers/index.ts`, `src/domain/decisions/resume-proof.ts`, `src/application/advisor-inbox/service.ts`, `src/server/application.ts`, `src/ui/` | `tests/contract/blocker-alert-vocabulary.test.ts`, `tests/integration/advisor-inbox.test.ts`, `tests/security/http-boundary.test.ts` | Batch D accepted blocker/resume authority remains; Batch E decision/intake ports add no automatic resume or new blocker kind | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Canonical Leo/GPT decision authority remains external |
| AO-REQ-009 Typed AlertKind, deterministic payload/dedup, lifecycle, actions, and Korean labels | `src/domain/alerts/index.ts`, `src/application/alerts/index.ts`, `src/runtime/projection.ts`, `src/server/application.ts`, `src/ui/communication/` | `tests/integration/alert-application.test.ts`, `tests/integration/runtime-composition.test.ts`, `tests/security/http-boundary.test.ts`, `tests/ui/communication-center.component.test.tsx` | Durable hash-verified alert details now project into the application communication model with open/resolved/suppressed and idempotent evidence; the HTTP route still acknowledges only and cannot invent action | `IMPLEMENTED_FINAL_REWORK_ROUND2__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Real live notification delivery remains gated |
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
| AO-REQ-020 No browser-to-Worker/Reviewer route | `src/ui/communication/`, `src/application/advisor-inbox/`, `src/adapters/gateways/`, `src/server/http/` | `tests/ui/communication-center.component.test.tsx`, `tests/integration/tmux-advisor-gateway.test.ts`, `tests/integration/exact-advisor-delivery.test.ts`, `tests/security/http-boundary.test.ts`, `tests/acceptance/batch-gates.test.ts` | Exact HTTP routes reject command/target/role/generic path fields; no Worker/Reviewer/terminal dispatch or server process primitive exists. The internal bridge can represent only the fixed Advisor tuple | `IMPLEMENTED_DISABLED__PENDING_FABLE5_IMPLEMENTATION_SECURITY_REVIEW` | Fixed prohibition; actual one-send proof is AO-WU-21 only |
| AO-REQ-021 No arbitrary terminal/command surface | `src/adapters/observations/process-runner.ts`, `src/adapters/gateways/`, `src/server/http/server.ts`, `src/ui/communication/` | `tests/adapters/tmux-readonly.test.ts`, `tests/integration/tmux-advisor-gateway.test.ts`, `tests/security/http-boundary.test.ts`, `tests/acceptance/batch-gates.test.ts` | Accepted read-only fixed-argv observation remains; HTTP mutation calls typed application ports only and has no shell/tmux/process/role-dispatch route | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Fixed prohibition |
| AO-REQ-022 TmuxAdvisorGateway fixed Advisor-only delivery | `src/runtime/composition.ts`, `src/adapters/gateways/tmux-advisor/` | `tests/integration/runtime-composition.test.ts`, `tests/integration/tmux-advisor-gateway.test.ts`, `tests/recovery/advisor-message-crash-consistency.test.ts` | Executable production composition now selects the typed tmux boundary; only simultaneous valid capability plus injected delivery port is READY, and the composed fixed-pointer/kill/manual/ambiguous cases pass | `IMPLEMENTED_FINAL_REWORK_ROUND2__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Real transport capability/port activation remains external and unused |
| AO-REQ-023 HermesAdvisorGateway interface/stub only | `src/adapters/gateways/hermes/`, `src/runtime/composition.ts` | `tests/adapters/hermes-disabled.test.ts`, `tests/acceptance/batch-gates.test.ts`, `tests/integration/runtime-composition.test.ts` | Interface-compatible disabled stub remains available for contract tests but no M01 executable composition imports or instantiates it | `IMPLEMENTED_DISABLED_STUB_NOT_COMPOSED__PENDING_DELTA_REVIEW` | Separate Leo/GPT Hermes mission |
| AO-REQ-024 Read-only tmux observation, no prose inference | `src/runtime/observation-coordinator.ts`, `src/adapters/observations/tmux/source.ts`, `src/application/queries/dashboard-view-model.ts`, `src/ui/scene/state-machine.ts` | `tests/integration/observation-coordinator.test.ts`, `tests/adapters/tmux-readonly.test.ts`, `tests/ui/scene-boundary.test.ts` | Exact registered pane metadata is operationally composed; current/stale/offline/identity/failure projections pass, and neither prose nor pane scrollback can create activity | `IMPLEMENTED_FINAL_REWORK_ROUND2__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Remote tmux collectors remain gated |
| AO-REQ-025 Read-only Git and immutable artifact contracts | `src/runtime/observation-coordinator.ts`, `src/adapters/observations/git/source.ts`, `src/adapters/observations/artifacts/source.ts`, `src/adapters/observations/manifest/source.ts` | `tests/integration/observation-coordinator.test.ts`, `tests/adapters/git-readonly.test.ts`, `tests/adapters/artifact-manifest.test.ts` | Fixed Git argv and bounded no-follow sources are now composed; external manifest, dirty/unverified Git, immutable artifact, hash, commit, path, restart, and isolation cases pass | `IMPLEMENTED_FINAL_REWORK_ROUND2__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Remote sources remain gated |
| AO-REQ-026 Transport authority reference/kill switch/manual fallback | `src/adapters/gateways/tmux-advisor/`, `src/operations/readiness/delivery-control.ts`, `src/ui/communication/` | `tests/integration/tmux-advisor-gateway.test.ts`, `tests/recovery/rollback-disable.test.ts`, `tests/e2e/communication-center.spec.ts` | Accepted external kill/manual behavior remains; app-local delivery defaults disabled and durably replays/conflicts disable without enable or transport access | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Real capability/re-enable remains separately controlled |
| AO-REQ-027 Loopback private default/fail-closed non-loopback | `src/runtime/`, `src/server/network/`, `src/server/http/static-shell.ts`, `config/agent-office.loopback.json` | `tests/integration/runtime-composition.test.ts`, `tests/integration/observation-coordinator.test.ts`, `tests/security/bind-policy.test.ts`, `scripts/runtime-smoke.mjs` | `start:loopback` additionally requires an explicit absolute operational config; smoke proves verified explicit manifest input, no fixture fallback, manual gateway with no provider, auth denial, listener rebind, and writer-lock release | `IMPLEMENTED_FINAL_REWORK_ROUND2__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Private/public network modes remain gated/unsupported |
| AO-REQ-028 Auth/session design without embedded real secret | `src/server/auth/`, `src/server/config.ts`, `src/runtime/composition.ts`, `src/runtime/test-composition.ts`, `src/ui/runtime/client.ts` | `tests/security/auth-session.test.ts`, `tests/security/http-boundary.test.ts`, `tests/integration/runtime-composition.test.ts` | Production composition supplies no session registry and cannot select test auth; the separately imported synthetic harness retains both test guards. Protected projection returns session capability/CSRF/expiry only after authentication, and revocation/expiry closes SSE and removes the client action port | `IMPLEMENTED_FINAL_REWORK__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Real provider/credential and AO-WU-14 posture require Leo/GPT authority |
| AO-REQ-029 CSRF/origin/Host/CORS/cookie controls | `src/server/network/`, `src/server/security/`, `src/server/http/` | `tests/security/http-boundary.test.ts`, `tests/security/static-shell.test.ts` | Exact Host/Origin/Referer fallback/Fetch Metadata/JSON/CSRF/capability/schema controls, no CORS, CSP/no-store/redacted errors, and no HSTS pass | `IMPLEMENTED_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | TLS/HSTS/private origin remain separately gated |
| AO-REQ-030 Rate limits, body bounds, output/content safety | `src/domain/messages/`, `src/server/security/rate-limiter.ts`, `src/server/http/`, `src/ui/communication/` | `tests/security/rate-limit.test.ts`, `tests/security/http-boundary.test.ts`, `tests/ui/communication-center.component.test.tsx` | Reviewed bootstrap/message/other/read/SSE constants, 16/32 KiB bounds, timeout abort, control rejection, inert hostile markup, bounded 429, and redacted audit pass | `IMPLEMENTED_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Shared/multi-host limiting remains gated |
| AO-REQ-031 PWA cache confidentiality/offline read-only | `src/pwa/`, `public/sw.js`, `src/ui/pwa/` | `tests/pwa/cache-policy.test.ts`, `tests/e2e/pwa-cache-security.spec.ts`, `tests/e2e/pwa-lifecycle.spec.ts`, `tests/e2e-composed/application-office-scene.spec.ts` | Static-only caching excludes every API/auth path; composed browser scans prove the proof absent from local/session storage, IndexedDB, cache bodies, URLs and request URLs while the session cookie is HttpOnly/Strict | `IMPLEMENTED_LOCAL_BOOTSTRAP_GATE__PENDING_FABLE5_AND_ADVISOR` | Real credential/private-run inspection remains gated; offline mutation stays forbidden |
| AO-REQ-032 Tailscale/private-network plan disabled by default | `src/server/config.ts`, `config/agent-office.loopback.json` | `tests/security/private-network-disabled.test.ts` | Default remains exact dual-stack loopback `NONE_READ_ONLY`; explicit LocalBootstrap is narrower exact IPv4 loopback `127.0.0.1:4317`. Wildcard/private-network, CORS, proxy, TLS/HSTS and mismatched auth/mutation changes reject | `IMPLEMENTED_LOCAL_BOOTSTRAP_GATE__PENDING_FABLE5_AND_ADVISOR` | Tailscale/private/public exposure needs a new threat/network mission; LocalBootstrap does not enable it |
| AO-REQ-033 Multi-project registry and root isolation | `src/application/projects/registry.ts`, `src/runtime/observation-coordinator.ts`, `src/runtime/operational-config.ts` | `tests/integration/project-freshness.test.ts`, `tests/integration/observation-coordinator.test.ts` | Runtime enforces exact project/root/source/host/station/WorkUnit/artifact correspondence, disjoint state roots, complete WorkUnit assignment, and path-free browser evidence | `IMPLEMENTED_FINAL_REWORK_ROUND2__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Browser registry editing remains absent; remote registration is gated |
| AO-REQ-034 Linux server/future Mac host topology and trust | `src/adapters/hosts/` | `tests/contract/host-observation.test.ts` | `NOT_IMPLEMENTED`; [Integration Sections 7-8](integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md#8-host-identity-and-trust) | `DEFERRED_WITH_GATE` | Remote-host/private-network/key mission; Mac host approval |
| AO-REQ-035 Host clock/offline/reconnect/gap/stale evidence | `src/runtime/observation-coordinator.ts`, `src/application/hosts/freshness.ts`, `src/ui/scene/state-machine.ts` | `tests/integration/observation-coordinator.test.ts`, `tests/integration/runtime-composition.test.ts`, `tests/integration/project-freshness.test.ts` | Local structured sources refresh on a bounded interval; semantic freshness changes increment projection revision/SSE, and current/stale/offline/error/conflict/restart behavior passes | `IMPLEMENTED_FINAL_REWORK_ROUND2_LOCAL_SUBSET__PENDING_DELTA_REVIEW` | Remote envelopes/gaps/reconnect remain gated |
| AO-REQ-036 Structured activity and exact observable mapping: dispatching/reading/working/testing/writing-result/returning-result/reviewing/block/wait/recovery | `src/domain/activity/index.ts`, `src/ui/scene/` | `tests/domain/writing-result-activity.test.ts`, `tests/contract/required-observable-conformance.test.ts`, `tests/ui/activity-mapping.test.ts` | All exact Batch C mappings and prose exclusion are Advisor-accepted and pass in Batch D regression | `IMPLEMENTED_BATCH_C__ADVISOR_ACCEPTED` | None for scene mapping |
| AO-REQ-037 Animation precedence, dedup, bounded motion | `src/runtime/projection.ts`, `src/ui/scene/state-machine.ts`, `src/ui/styles.css` | `tests/ui/activity-precedence.test.ts`, `tests/ui/office-scene.component.test.tsx`, `tests/e2e/office-scene.spec.ts`, `tests/e2e-composed/application-office-scene.spec.ts` | Controlled production roles animate only accepted event IDs with CURRENT/CONNECTED evidence; stale/unknown/offline suppress motion. Three composed baselines were added and directly inspected; all 21 browser tests pass | `IMPLEMENTED_FINAL_REWORK_ROUND2__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Cross-host/browser/font portability remains an operations prerequisite |
| AO-REQ-038 Accessibility and reduced motion | `src/ui/scene/office-scene.tsx`, `src/ui/communication/`, `src/ui/pwa/`, `src/ui/styles.css` | `tests/ui/office-scene.component.test.tsx`, `tests/e2e/accessibility.spec.ts`, `tests/e2e-composed/application-office-scene.spec.ts` | Existing gates plus authenticated composed desktop/mobile/reduced-motion containment and scene WCAG A/AA checks pass with no unverified motion | `IMPLEMENTED_FINAL_REWORK_ROUND2__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Real-provider focus transition needs private-run review |
| AO-REQ-039 Local visual asset/icon/license strategy | `src/ui/assets/LICENSES.md`, `src/ui/scene/assets/`, `public/icons/`, `playwright.config.ts`, `playwright.composed.config.ts` | `tests/ui/layout-contract.test.ts`, `tests/pwa/cache-policy.test.ts`, `tests/e2e/office-scene.spec.ts`, `tests/e2e-composed/application-office-scene.spec.ts` | Existing assets remain; three application-projection baselines were added under the same configured local browser/font runtime and directly inspected | `IMPLEMENTED_FINAL_REWORK_ROUND2__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Cross-host/browser/font portability remains an operations prerequisite |
| AO-REQ-040 Desktop/mobile stable dimensions, overflow, Korean expansion, and no silent translation | `src/ui/styles.css`, `src/ui/i18n/ko.ts`, `src/ui/communication/`, `src/ui/pwa/`, `src/ui/scene/office-scene.tsx` | `tests/ui/korean-vocabulary.test.ts`, `tests/e2e/communication-center.spec.ts`, `tests/e2e/office-scene.spec.ts`, `tests/e2e-composed/application-office-scene.spec.ts` | Existing demo gates plus authenticated composed 1440x900/390x844/reduced-motion output pass responsive containment and direct inspection | `IMPLEMENTED_FINAL_REWORK_ROUND2__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | New security-code localization requires reviewed vocabulary |
| AO-REQ-041 PWA installability/update/offline UX | `src/pwa/`, `src/ui/pwa/`, `src/ui/runtime/`, `public/` | `tests/integration/runtime-composition.test.ts`, `tests/ui/runtime-boundary.component.test.tsx`, `tests/e2e/pwa-lifecycle.spec.ts`, `tests/e2e-composed/application-office-scene.spec.ts` | Install/update/offline/recovery remains; production distinguishes `LOGIN_REQUIRED`, `LOCAL_BOOTSTRAP_AUTHENTICATED`, `LOCAL_BOOTSTRAP_ENABLED`, `LOGGED_OUT`, and manual delivery without caching authority values | `IMPLEMENTED_LOCAL_BOOTSTRAP_GATE__PENDING_FABLE5_AND_ADVISOR` | Real credential/private-run UX audit remains gated |
| AO-REQ-042 SSE over WebSocket with cursor/reset | `src/server/sse/`, `src/server/http/server.ts`, `src/runtime/composition-core.ts`, `src/ui/runtime/client.ts` | `tests/integration/sse-reconnect.test.ts`, `tests/integration/runtime-composition.test.ts`, `tests/security/local-bootstrap-http.test.ts` | Cursor/reset remains; LocalBootstrap session rotation, logout, expiry and provider revocation invalidate the server session, close SSE, clear an invalid-session cookie, and remove mutation access | `IMPLEMENTED_LOCAL_BOOTSTRAP_GATE__PENDING_FABLE5_AND_ADVISOR` | WebSocket stays excluded; real private-run SSE evidence awaits the reviewed run |
| AO-REQ-043 Single-writer JSONL/artifact/projection crash consistency | `src/persistence/file-store/`, `src/application/startup/recovery.ts`, `src/operations/backup/` | `tests/recovery/crash-consistency.test.ts`, `tests/recovery/restart-replay.test.ts`, `tests/recovery/backup-restore.test.ts` | Accepted writer/replay core remains; backup requires stopped writer and a flushed exact checkpoint before publishing completion | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Real-root/off-host operation remains gated |
| AO-REQ-044 Corruption quarantine and stale/conflict behavior | `src/persistence/file-store/`, `src/application/advisor-inbox/`, `src/operations/readiness/`, `src/operations/restore/` | `tests/recovery/corruption-quarantine.test.ts`, `tests/recovery/advisor-message-crash-consistency.test.ts`, `tests/recovery/backup-restore.test.ts`, `tests/operations/readiness.test.ts` | Accepted quarantine/manual recovery remains; tampered backup/build/path/mode/hash rejects and startup projects store/replay/stale failure with mutation disabled | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Remote/service supervision remains gated |
| AO-REQ-045 Backup and isolated restore | `src/operations/backup/`, `src/operations/restore/` | `tests/recovery/backup-restore.test.ts` | Owner-only stopped-writer checkpoint, manifest/modes/hashes/source sequence, complete marker, incomplete/tampered rejection, disjoint candidate restore, replay/projection/idempotency proof, and explicit stopped-service selection plan pass | `IMPLEMENTED_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Off-host backup, encryption keys, schedule, retention, and real-root operation remain gated |
| AO-REQ-046 Application rollback and disable strategy | `src/operations/compatibility/`, `src/operations/readiness/`, `src/application/startup/` | `tests/recovery/rollback-disable.test.ts`, `tests/operations/readiness.test.ts`, `tests/integration/exact-advisor-delivery.test.ts` | Existing compatibility remains; delivery control now records default/enabled/latched hash-linked state, survives restart, and permanently rejects v1 re-enable after a latch because that schema lacks prior-disable resolution correlation | `IMPLEMENTED_DISABLED__PENDING_FABLE5_IMPLEMENTATION_SECURITY_REVIEW` | A separately reviewed later activation schema is required before re-enable can exist |
| AO-REQ-047 Evidence-bearing proof of recovery | `src/operations/evidence/` | `tests/recovery/recovery-result.test.ts` | Immutable owner-only result requires actor/build/commit/mode, hashes, replay equivalence, idempotency conflict/replay, before/after denominator/state, controls, elapsed steps, forbidden scope, and Advisor review route | `IMPLEMENTED_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Advisor audit and independent implementation review remain pending |
| AO-REQ-048 Batch A-E dependencies, acceptance tests, reviews | `package.json`, `playwright.config.ts`, `playwright.composed.config.ts`, `tests/acceptance/batch-gates.test.ts`, result artifacts | `tests/acceptance/batch-gates.test.ts`, `tests/integration/runtime-composition.test.ts`, `tests/integration/observation-coordinator.test.ts`, `tests/security/local-bootstrap-provider.test.ts`, `tests/security/local-bootstrap-http.test.ts` | LocalBootstrap commit `2623922877bd52dc7f5b6c6cd45fae755e5ff228` passes 55/255 Vitest and 21/21 Chromium tests, builds, zero-high audit, disposable smoke, diff/secret scan and direct visual gates | `IMPLEMENTED_LOCAL_BOOTSTRAP_GATE__PENDING_FABLE5_AND_ADVISOR` | Fable5 code/security review, Advisor private-run authority/evidence, and final approval |
| AO-REQ-049 Current bootstrap truth, unknowns, limitations | eight canonical docs, README, both preparation runbooks, disabled example, and result artifacts | `tests/acceptance/batch-gates.test.ts`, `tests/integration/observation-coordinator.test.ts`, `tests/integration/runtime-composition.test.ts`, `tests/integration/exact-advisor-delivery.test.ts` | Canonical manifest v5 is required from the actual foundation-docs root; LocalBootstrap private-run evidence passed and was cleaned up. AO-WU-19 exact delivery is implemented disabled with no committed activation/lease/capability/input | `IMPLEMENTED_EXACT_DELIVERY_DISABLED__PENDING_FABLE5_SECURITY_REVIEW` | AO-WU-20 Fable5 PASS -> AO-WU-21 Advisor synthetic actual rehearsal |
| AO-REQ-050 No DB/public/prod/Hermes implementation/automatic next mission | module/import/route/build policy and exact delivery implementation scope | `tests/acceptance/batch-gates.test.ts`, `tests/security/private-network-disabled.test.ts`, exact delivery boundary scans | Source/config/route scans prove no DB, public/prod or private-network mode, real secret, Hermes implementation, generic terminal/role dispatch, enabled descriptor, browser target, or automatic next mission | `OUT_OF_SCOPE` | Hermes/network/DB/prod remain separate missions; exact fixed Advisor pointer delivery alone follows its reviewed train |
| AO12-REQ-004 Deterministic project identity and current naming | `src/ui/spatial/project-identity.ts`, `project-identity.css` | `tests/ui/project-identity.test.ts`, current-product name gate | Six fixed families, exact catalog-v1 SHA-256 fallback, collision labels, contrast, severity/freshness/authority/focus precedence, and SIASIU output pass without mutable storage | `IMPLEMENTED_AO12_B__PENDING_FOCUSED_REVIEW` | AO12-B Fable5 UI/accessibility/asset review and Advisor acceptance |
| AO12-REQ-005 Original character/Channy/facility placeholder boundary | `src/ui/spatial/character.tsx`, `assets/placeholder-characters.tsx`, `asset-registry.ts`, `assets/ASSET_INVENTORY.md` | `tests/ui/spatial-asset-contract.test.ts` | Stable seven semantic slots plus office facilities, internal license, actual source SHA-256 `adacf982a568bffefe1a6eddefb58584ff706f9408fdf5ab81a42ce49b19bd63`, no external/script behavior, neutral fallback, and static non-actor Channy pass | `IMPLEMENTED_AO12_B_PLACEHOLDER_ONLY__PENDING_FOCUSED_REVIEW` | Production art/external source and all Channy behavior remain separate gates |
| AO12-REQ-006 Static shared floor and exact mission board | `src/ui/spatial/spatial-office.tsx`, `team-pod.tsx`, `mission-board.tsx`, `fixtures.ts` | `tests/ui/spatial-office.component.test.tsx`, `tests/e2e/spatial-office-static.spec.ts` | Every desktop Team Pod remains an office area, selection expands in place, all board/zones/redaction facts render, each roleInstanceId appears once, and no route/cue/adapter exists | `IMPLEMENTED_AO12_B_TEST_DEMO_ONLY__PENDING_FOCUSED_REVIEW` | Production projection wiring remains AO12-D; motion remains AO12-C |
| AO12-REQ-010 Responsive/a11y/static equivalence | `src/ui/spatial/spatial-office.css`, exact parameter gate in `src/ui/demo-entry.tsx` | `tests/ui/spatial-accessibility.test.tsx`, `tests/e2e/spatial-office-static.spec.ts`, six new static baselines | 24 focused tests and 10 Chromium tests pass desktop/tablet/mobile/320/200%/landscape, axe A/AA, roving focus, dialog restore, 44px, forced colors, SVG/color removal, and zero animation; every new PNG was directly inspected | `IMPLEMENTED_AO12_B_TEST_DEMO_ONLY__PENDING_FOCUSED_REVIEW` | Configured local browser/font runtime only; no portability claim |
| AO12-REQ-012/014 M1 compatibility and no authority/transport expansion | explicit test-demo-only import plus unchanged production entry/package/lock/M1 baselines | full Vitest, default demo/composed Playwright, package/lock and baseline SHA-256 audits | Default M1 and production selection remain unchanged; six M1 baseline bytes and package/lock hashes equal exact base; spatial source has no adapter/process/network/write/dispatch capability | `IMPLEMENTED_AO12_B_ADDITIVE_ONLY__PENDING_FOCUSED_REVIEW` | AO12-C unauthorized; production/authority/transport remain fixed prohibitions |

### 4.1 Fable5 F-1/F-2/F-3 rework anchors

| Finding | Exact canonical closure | Reproduction test path | Current status |
|---|---|---|---|
| `F-1` | Domain 6.3 maps all 16 exact required observable names across durable primary state plus structured activity; Domain 13 adds `WRITING_RESULT`; UI 5-6 maps triggers/end/precedence | `tests/contract/required-observable-conformance.test.ts`, `tests/domain/writing-result-activity.test.ts`, `tests/ui/activity-mapping.test.ts`, `tests/ui/activity-precedence.test.ts` | `DESIGN_PASS`; accepted domain/fallback behavior plus Batch C exact event-only mapping, order, precedence, deduplication, stale/evidence failure, and bounded cues pass |
| `F-2` | Domain 7.2 defines closed `BlockerKind` plus exact `BlockerOpened` contract/lifecycle; Domain 7.3 defines closed `AlertKind`, payload, dedup, actions; Domain 8.4 pins all 13 GPT package fields; Integration 10 consumes canonical kinds only | `tests/contract/blocker-alert-vocabulary.test.ts`, `tests/snapshot/gpt-package.test.ts`, later notification tests | `DESIGN_PASS`; Batch A contracts/snapshots implemented at code commit; notification integration deferred |
| `F-3` | UI 3.4 fixes Korean hierarchy, all 16 status labels, nine alert labels, six alert actions, 16 blocker labels/fallback, two distinct progress labels, and `labelKo` preservation | `tests/domain/manifest.test.ts`, `tests/ui/korean-vocabulary.test.ts`, `tests/ui/communication-center.component.test.tsx` | `DESIGN_PASS`; accepted prior vocabulary remains stable and Batch D renders all five message kinds, nine alert kinds, and six exact alert actions |

### 4.2 Exact Advisor delivery as-built anchors

| DESIGN_REQUIREMENT | IMPLEMENTATION_PATH | TEST_PATH | CURRENT_EVIDENCE | STATUS | DEFERRED_GATE |
|---|---|---|---|---|---|
| AO-REQ-051 Immutable message artifact and pointer-only transport | inbox artifact/event, canonical v1 pointer, `exact-transport.ts` | exact bridge plus inbox/recovery suites | Byte-exact scoped pointer contains no body/target/control data; production has no enabled descriptor | `IMPLEMENTED_DISABLED__PENDING_FABLE5_SECURITY_REVIEW` | AO-WU-20 |
| AO-REQ-052 Fixed `foundation-advisor/$9/0/%9` destination and double preflight | closed activation/lease parsers, authority validator, exact runner | wrong pane/window/sync/buffer/TOCTOU cases | `$9/@9/%9`, workspace, process, live flags and two identical observations are closed and tested | `IMPLEMENTED_DISABLED__PENDING_FABLE5_SECURITY_REVIEW` | Actual live preflight only in AO-WU-21 |
| AO-REQ-053 Durable idempotency and no blind resend | fsynced pointer journal and durable lookup | duplicate/conflict/restart/paste ambiguity tests | Request/payload/message/pointer/lease/destination tuple is durable; no paste/Enter retry after start | `IMPLEMENTED_DISABLED__PENDING_FABLE5_SECURITY_REVIEW` | Crash/security review |
| AO-REQ-054 Git-verified Advisor ACK/intake/decision/resume ingress | `evidence-ingress.ts`, exact Git authority verifier | exact schema/lifecycle/rewrite/authority/resume tests | Internal committed-blob observer freezes refs, rejects rewrite/reorder, and preserves Advisor vs Leo/GPT authority | `IMPLEMENTED_DISABLED__PENDING_FABLE5_SECURITY_REVIEW` | Actual evidence publication in AO-WU-21 |
| AO-REQ-055 Kill/manual fallback and no auto-enable | authority checks plus delivery-control v2 hash-chained latch | expiry/conflict/ambiguity/restart/no-re-enable/mode-tamper tests | Default-off -> exact-grant -> latched state persists; no HTTP/browser enable path. Activation v1 lacks a closed prior-disable-resolution field, so the implementation fail-closes permanently after latch | `IMPLEMENTED_DISABLED__DESIGN_DIVERGENCE_CLASSIFIED__PENDING_FABLE5_SECURITY_REVIEW` | New reviewed recovery schema/version required after latch |
| AO-REQ-056 No browser role/target/terminal route | existing Leo message boundary plus fixed internal adapter | unknown-field/module/route/process scans | Production rejects injected ports/capabilities; browser cannot represent destination or command | `IMPLEMENTED_DISABLED__PENDING_FABLE5_SECURITY_REVIEW` | Fixed prohibition |
| AO-REQ-057 Exact no-shell buffer sequence | closed `/usr/bin/tmux` operation vocabulary | exact argv/order/failure tests | Only file load, `paste-buffer -p ... -t %9 -d`, and exact Enter exist; shell is false | `IMPLEMENTED_DISABLED__PENDING_FABLE5_SECURITY_REVIEW` | Actual one-send observation in AO-WU-21 |
| AO-REQ-058 LocalBootstrap remains exact loopback-only | deployment v3 + operational v2 two-key selection preserving v2 | full auth/network/PWA/private-network regression | Exact mode retains only `127.0.0.1:4317`; auth grants no transport capability | `IMPLEMENTED_DISABLED__PENDING_FABLE5_SECURITY_REVIEW` | No remote/public decision exists |
| AO-REQ-059 Serial dual review and synthetic actual rehearsal | AO-WU-18 -> 19 -> 20 -> 21 -> 15 | implementation review then exact rehearsal matrix | AO-WU-18 PASS and AO-WU-19 implemented; no actual send occurred | `AO_WU_19_COMPLETE__PENDING_AO_WU_20` | No actual send before Fable5 implementation/security PASS |

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
| Final rework round 2 | AO-E-R3 R3.1-R3.8 operational composition and R3.9 seven-doc as-built correction | Fable5 delta rereview `NEEDS_PATCH`; same Worker must return exact patch | Code/config/tests `10fdee75dca73c4fb5cde09019c403d4dc1682bb`; 53/228 Vitest, 21/21 Playwright, 10/10 composition, 16/16 coordinator, 5/5 authority, full gates/smoke/direct inspection pass; delta review pending |
| LocalBootstrap private run | Exact loopback login/logout/expiry/restart/recovery/private UI evidence | Fable5 code/security PASS, then Advisor run | `PASS`; target remains `9c403da5662aeedc28a8c677c37a134aaa44dce3`, server/proof/listener/lock cleaned up, delivery still manual |
| Exact delivery design | DQ-01 through DQ-08, schemas/order, fixed port, durable no-resend, Advisor evidence ingress, threats/rehearsal | Fable5 Level-3 design review of `d170880` | `PASS`, recorded at foundation-docs `62973c4` |
| Exact delivery implementation | Trusted config/composition, exact port/journal/latch, Git evidence ingress, UI state separation, SIASIU | Fable5 implementation/security review | AO-WU-19 code/tests/docs implemented disabled; no activation/lease/capability/server/tmux input |
| M1.2 AO12-A | Projection/validation, M1 adapter, Team Pod/assignment invariants, current-name gate | Focused Fable5 contract/authority review plus Advisor acceptance | Corrected focused review `PASS`; Advisor accepted exact base `ecd2652501df55aba0aa0f55c236b1933c6dc1e3` as AO12-B dependency |
| M1.2 AO12-B | Deterministic identity, original placeholders, fixture-only shared static floor/boards, responsive/a11y proof | Focused Fable5 UI/accessibility/asset-boundary review plus Advisor acceptance | 24/24 focused and 65/342 full Vitest, 10/10 static and 28/28 default-demo plus 3/3 composed Chromium pass; six new configured-runtime PNGs directly inspected; exact commit is recorded in the Worker result; review/acceptance pending and AO12-C unauthorized |
| Worker result | Exact final-rework-round-2 as-built evidence package | Advisor verification | Published after this canonical docs commit through the exact foundation-docs result/pointer paths; approval pending |
| Implementation review | Actual code/tests/design conformance | Fable5 `IMPLEMENTATION_REVIEW` | Original final dual review and first rework delta review returned `NEEDS_PATCH`; this round-2 patch is pending the same Reviewer's next delta review |
| Exact delivery implementation/rehearsal/final audit | Reviewed bridge implementation, Fable5 security review, one Advisor synthetic actual rehearsal, final audit | Strict AO-WU-19 -> AO-WU-20 -> AO-WU-21 -> AO-WU-15 dependency | AO-WU-19 implemented disabled; AO-WU-20/21/15 remain pending; safe state is stopped/manual/no capability instance |

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

### 6.2 AO-E-R3 round-2 as-built closure

| DESIGN_REQUIREMENT | IMPLEMENTATION_PATH | TEST_PATH | CURRENT_EVIDENCE | STATUS | DEFERRED_GATE |
|---|---|---|---|---|---|
| R3.1 Explicit trusted production manifest source | `src/runtime/cli.ts`, `src/runtime/operational-config.ts`, `src/adapters/observations/manifest/source.ts` | `tests/integration/observation-coordinator.test.ts`, `tests/integration/runtime-composition.test.ts`, `scripts/runtime-smoke.mjs` | Commit `10fdee75dca73c4fb5cde09019c403d4dc1682bb`; owner/no-follow config and verified external root pass; missing, unverified, stale, hash-mismatched, and out-of-scope starts reject; CLI has no fixture fallback | `IMPLEMENTED_FINAL_REWORK_ROUND2__PENDING_DELTA_REVIEW` | Operator-supplied canonical config remains required; real source approval is external |
| R3.2/R3.7 Operational read-only coordinator and isolation | `src/runtime/observation-coordinator.ts`, `src/application/projects/registry.ts`, `src/adapters/observations/` | `tests/integration/observation-coordinator.test.ts`, `tests/adapters/git-readonly.test.ts`, `tests/adapters/tmux-readonly.test.ts` | Exact project/root/source/host/station/WorkUnit assignments, bounded refresh, restart, partial failure, no prose inference, and no observed-source mutation pass 16/16 focused cases | `IMPLEMENTED_FINAL_REWORK_ROUND2__PENDING_DELTA_REVIEW` | Remote collectors/multi-host transport remain gated |
| R3.3 Evidence-correct freshness | `src/runtime/observation-coordinator.ts`, `src/application/hosts/freshness.ts`, `src/runtime/projection.ts` | `tests/integration/observation-coordinator.test.ts`, `tests/integration/runtime-composition.test.ts`, `tests/integration/project-freshness.test.ts` | Current requires accepted structured activity plus current verified actor sources; stale/offline/missing/identity/dirty/unverified/restart cases fail closed; unconditional CURRENT labels are absent | `IMPLEMENTED_FINAL_REWORK_ROUND2__PENDING_DELTA_REVIEW` | Remote clock/envelope trust remains gated |
| R3.4 Durable runtime alerts | `src/application/alerts/index.ts`, `src/persistence/file-store/artifact-store.ts`, `src/runtime/projection.ts` | `tests/integration/runtime-composition.test.ts`, `tests/integration/alert-application.test.ts` | Hash-verified detail artifacts project type, lifecycle, question/options/recommendation/safe default/evidence/actions; open/resolved/suppressed and idempotent projection pass without raw paths or terminal data | `IMPLEMENTED_FINAL_REWORK_ROUND2__PENDING_DELTA_REVIEW` | Real live alert delivery still requires approved auth/gateway |
| R3.5 Authenticated application office scene | `src/runtime/projection.ts`, `src/ui/runtime/runtime-app.tsx`, `src/ui/scene/` | `tests/ui/office-scene.component.test.tsx`, `tests/e2e-composed/application-office-scene.spec.ts` | Eight controlled stations render in the composed application; unknown evidence suppresses cues; desktop/mobile/reduced-motion composed baselines and WCAG checks pass and were directly inspected | `IMPLEMENTED_FINAL_REWORK_ROUND2__PENDING_DELTA_REVIEW` | Real authenticated private-run visual audit remains gated |
| R3.6/R3.8 Advisor gateway and composed lifecycle | `src/runtime/composition.ts`, `src/runtime/composition-core.ts`, `src/adapters/gateways/tmux-advisor/`, `src/application/advisor-inbox/` | `tests/integration/runtime-composition.test.ts`, `tests/integration/tmux-advisor-gateway.test.ts`, `tests/integration/decision-authority-evidence.test.ts`, `tests/integration/exact-advisor-delivery.test.ts` | Production selects TmuxAdvisorGateway, never Hermes; synthetic injection stays test-only. Matching trusted v3/v2 config can internally compose the exact journaled port, while the committed default/disabled example cannot activate it | `IMPLEMENTED_DISABLED__PENDING_FABLE5_IMPLEMENTATION_SECURITY_REVIEW` | No live descriptor/lease/capability/proof exists; actual input is AO-WU-21 gated |
| R3.9 Exact canonical as-built documentation | These seven canonical files | `tests/acceptance/batch-gates.test.ts`, `git diff --check` | Round-2 implementation paths, tests, evidence, limitations, and gates are recorded without weakening the reviewed requirements | `DOCUMENTED_FINAL_REWORK_ROUND2__PENDING_DELTA_REVIEW` | Fable5 delta review, Advisor verification, AO-WU-14, Leo/GPT final approval |

### 6.3 LocalBootstrap gate divergence classification

- `CODE_DEFECT`: the previously absent production provider, trusted LocalBootstrap
  selection, exchange/logout lifecycle, real canonical-manifest enforcement, and
  production login state are implemented at
  `2623922877bd52dc7f5b6c6cd45fae755e5ff228`.
- `DOCUMENTATION_STALE`: statements that LocalBootstrap is only future design,
  that production always has no provider, that canonical manifest v1 is current,
  or that AO-WU-14 is `WAITING_DEPENDENCY` are superseded here. The actual
  canonical manifest is version 2 and AO-WU-14 is `WAITING_LEO`.
- `DEFERRED_WITH_GATE`: real credential creation, the real port-4317 private run,
  any approved SSH-forward operation, and Advisor evidence remain behind Fable5
  code/security `PASS` and explicit Advisor authority. Real tmux delivery remains
  separately disabled.
- `DESIGN_DEFECT`: none encountered in this Worker pass.
- `NEEDS_LEO_GPT_DECISION`: none newly introduced; Leo/GPT already authorized
  this code/test/documentation gate. Final mission approval remains external.

## 7. Explicit Deferred and Forbidden Gates

| Capability | Current status | Required gate |
|---|---|---|
| Real LocalBootstrap credential/proof use | Provider implemented; no real value created or accessed | Fable5 code/security PASS plus explicit Advisor private-run authority and local-only handling |
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

## 8. LocalBootstrap Gate Closure Checklist

- the seven canonical design documents remain owned only by Agent Office;
- independent design PASS and final dual-review `NEEDS_PATCH` evidence are
  referenced without claiming a passing delta review or final approval;
- Batch A-D acceptance, Batch E/final-rework evidence, and LocalBootstrap
  implementation paths/tests/code commits are exact;
- the approved 15-WorkUnit source bytes, path, source commit, hash, labels,
  dependencies, and current facts are preserved;
- all A-D regression plus Batch E/final-rework composition, authority,
  HTTP/SSE/PWA/security/recovery/browser paths and lint/typecheck/build/audit/
  diff/boundary/WCAG/smoke gates pass;
- no DB, real secret/credential, remote collector, private/public
  exposure, TLS/HSTS claim, deployment, production/live operation, Hermes
  implementation, real tmux input, browser role dispatch, or off-host backup
  exists; and
- LocalBootstrap remains pending Fable5 code/security review, Advisor authority
  and real private-run evidence, and final approval; another mission does not
  start automatically.
