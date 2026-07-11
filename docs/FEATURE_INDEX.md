# Agent Office M01 Feature and Traceability Index

Status: `REVIEWED_DESIGN__BATCH_A_B_C_ACCEPTED__BATCH_D_IMPLEMENTED__PENDING_ADVISOR_ACCEPTANCE`

Mission: `AGENT_OFFICE_M01_ADVISOR_MANAGED_OFFICE_WEB_CONTROL_PLANE`

This is the canonical discoverability and material-requirement traceability index
for M01. It records the independent design PASS, Advisor-accepted Batches A-C,
and Batch D as-built evidence. It does not claim Advisor Batch D acceptance,
implementation review, private-run verification, or final approval.

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

There is still no HTTP authority server, PWA/service worker, SSE, real tmux input,
real authentication/secret, DB, remote collector, private/public network
exposure, deployment, backup/restore operation, or live runtime. Batch D is
pending Advisor acceptance; Batch E has not started.

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

Every `CURRENT_EVIDENCE` value beginning with `NOT_IMPLEMENTED` is honest design
evidence only. A document section is not proof that behavior exists.

## 4. Material Requirement Traceability

| DESIGN_REQUIREMENT | IMPLEMENTATION_PATH | TEST_PATH | CURRENT_EVIDENCE | STATUS | DEFERRED_GATE |
|---|---|---|---|---|---|
| AO-REQ-001 Purpose, audience, operations focus, non-goals | `src/ui/`, `src/application/advisor-inbox/`; future `src/server/` | `tests/acceptance/batch-gates.test.ts`, `tests/ui/dashboard.component.test.tsx`, `tests/ui/communication-center.component.test.tsx`, `tests/e2e/communication-center.spec.ts` | Quiet operations UI now includes a typed Advisor-only communication center; Batch E server/private-product completion remains absent | `IMPLEMENTED_BATCH_D_LOCAL_SUBSET__PENDING_ADVISOR_ACCEPTANCE` | Advisor Batch D acceptance; full private product remains Batch E |
| AO-REQ-002 Actor authority and source-of-truth precedence | `src/contracts/types.ts`, `src/application/evidence/index.ts`, future authority application policy | `tests/domain/transitions.test.ts`, later authority tests | Actor/evidence references and fail-closed verification primitives are in code commit `7edc8f79bedb059ab6697e64ddaf57fbebde2c87`; full cross-source conflict application remains absent | `IMPLEMENTED_BATCH_A_CONTRACT_ONLY` | Canonical V2 remains external authority; application integration in later batches |
| AO-REQ-003 Responsive private PWA and quiet UI | `src/ui/`; future `src/pwa/` | `tests/ui/dashboard.component.test.tsx`, `tests/ui/communication-center.component.test.tsx`, `tests/e2e/office-scene.spec.ts`, `tests/e2e/communication-center.spec.ts` | Dashboard, scene, Inbox, and Alerts pass desktop/tablet/390/320/landscape/200%-text gates; PWA, server/live data, auth, and private runtime are absent | `IMPLEMENTED_BATCH_D_UI_SUBSET__PENDING_ADVISOR_ACCEPTANCE` | PWA/private runtime remains Batch E |
| AO-REQ-004 Initiative -> Package -> Mission -> Phase -> WorkUnit with fixed Korean hierarchy labels | `src/domain/manifest/index.ts`, `fixtures/manifests/`, `src/ui/i18n/ko.ts`, `src/ui/dashboard.tsx` | `tests/domain/manifest.test.ts`, `tests/ui/korean-vocabulary.test.ts`, `tests/ui/dashboard.component.test.tsx` | Exact source hierarchy/`labelKo` and fixed Korean hierarchy labels were Advisor-accepted after Batch B and remain unchanged in Batch C | `IMPLEMENTED_THROUGH_BATCH_B__ADVISOR_ACCEPTED` | None for the local hierarchy subset |
| AO-REQ-005 Versioned denominator and exact scope accounting | `src/domain/manifest/index.ts`, `src/application/projections/mission-projector.ts`, `src/application/queries/dashboard-view-model.ts` | `tests/property/scope-counting.test.ts`, `tests/ui/dashboard-view-model.test.ts` | Advisor-accepted scope core plus distinct declared WorkUnit denominator/future-unapproved rendering pass unchanged | `IMPLEMENTED_THROUGH_BATCH_B__ADVISOR_ACCEPTED` | Authority artifact still required for any scope change |
| AO-REQ-006 Durable WorkUnit states/transitions/dependencies plus exact 16-name primary/activity conformance | `src/domain/state-machines/work-unit.ts`, `src/domain/activity/index.ts`, `src/ui/scene/state-machine.ts` | `tests/property/transition-matrix.test.ts`, `tests/contract/required-observable-conformance.test.ts`, `tests/ui/activity-mapping.test.ts` | Batch C exact scene mapping and evidence/source fail-closed coverage are Advisor-accepted and remain regression-locked | `IMPLEMENTED_THROUGH_BATCH_C__ADVISOR_ACCEPTED` | None for the Batch C scene subset |
| AO-REQ-007 Message states and immutable Advisor flow | `src/domain/messages/index.ts`, `src/domain/state-machines/entities.ts`, `src/application/advisor-inbox/` | `tests/domain/transitions.test.ts`, `tests/integration/advisor-inbox.test.ts`, `tests/recovery/advisor-message-crash-consistency.test.ts` | Exact five-kind no-target schema, scoped immutable artifact, durable message/outbox/delivery/manual/ack/intake/decision/close projection, and restart reconciliation pass at the Batch D code commit | `IMPLEMENTED_BATCH_D__PENDING_ADVISOR_ACCEPTANCE` | HTTP boundary remains Batch E |
| AO-REQ-008 Typed BlockerKind, exact BlockerOpened fields/lifecycle/resume proof, and Korean labels | `src/domain/blockers/index.ts`, `src/domain/decisions/resume-proof.ts`, `src/application/advisor-inbox/service.ts`, `src/ui/` | `tests/contract/blocker-alert-vocabulary.test.ts`, `tests/integration/advisor-inbox.test.ts`, `tests/ui/communication-center.component.test.tsx` | Batch C blocker presentation is accepted; Batch D validates and persists decision-linked ResumeProof evidence before `WorkUnitStateTransitioned` without automatic resume | `IMPLEMENTED_BATCH_D_APPLICATION_SUBSET__PENDING_ADVISOR_ACCEPTANCE` | Live mission runtime remains Batch E |
| AO-REQ-009 Typed AlertKind, deterministic payload/dedup, lifecycle, actions, and Korean labels | `src/domain/alerts/index.ts`, `src/application/alerts/index.ts`, `src/ui/communication/` | `tests/contract/blocker-alert-vocabulary.test.ts`, `tests/integration/alert-application.test.ts`, `tests/ui/communication-center.component.test.tsx` | All nine kinds preserve severity/actions/dedup; occurrence, acknowledge, snooze, resolve, suppress, safe-default detail, and six Korean actions pass | `IMPLEMENTED_BATCH_D__PENDING_ADVISOR_ACCEPTANCE` | Server notification transport remains Batch E |
| AO-REQ-010 Decision states, exact deterministic GPT package fields, application | `src/domain/decisions/`, `src/application/advisor-inbox/`, `src/ui/communication/` | `tests/snapshot/gpt-package.test.ts`, `tests/integration/advisor-inbox.test.ts`, `tests/ui/communication-center.component.test.tsx` | Exact ordered 13-field JSON/Markdown is byte-equal in UI copy; decision link and ResumeProof artifacts remain separate from acknowledgement/intake | `IMPLEMENTED_BATCH_D__PENDING_ADVISOR_ACCEPTANCE` | Leo/GPT remains decision authority |
| AO-REQ-011 Notification states/idempotency using canonical AlertKind/dedup | `src/domain/state-machines/entities.ts`, `src/application/advisor-inbox/`, `src/application/alerts/` | `tests/integration/advisor-inbox.test.ts`, `tests/recovery/advisor-message-crash-consistency.test.ts`, `tests/integration/alert-application.test.ts` | Durable queued/delivering/delivered/failed/manual/acknowledged state, same-message outbox dedup, ambiguous recovery, and alert trigger dedup pass | `IMPLEMENTED_BATCH_D__PENDING_ADVISOR_ACCEPTANCE` | HTTP/live delivery remains Batch E |
| AO-REQ-012 Event transition validation and stable rejection | `src/contracts/`, `src/domain/events/index.ts`, `src/domain/state-machines/` | `tests/domain/event-envelope.test.ts`, `tests/property/transition-matrix.test.ts` | Versioned boundaries, stable rejection codes, closed transitions, and unknown-field rejection pass; Advisor accepted Batch A | `IMPLEMENTED_BATCH_A__ADVISOR_ACCEPTED` | Later application commands remain gated |
| AO-REQ-013 UTC timestamps, stream/host sequence, clock quality | `src/domain/time/index.ts`, `src/domain/events/index.ts`, `src/application/hosts/freshness.ts` | `tests/domain/event-envelope.test.ts`, `tests/persistence/hash-chain.test.ts`, `tests/integration/project-freshness.test.ts` | Canonical event time/sequence plus explicit local source/receipt/clock-quality freshness inputs were accepted; remote host sequence/clock handshake absent | `IMPLEMENTED_BATCH_B_LOCAL_SUBSET__ADVISOR_ACCEPTED` | Remote host behavior gated |
| AO-REQ-014 Request idempotency, ordering, causal links | `src/domain/events/index.ts`, `src/persistence/file-store/event-store.ts`, `src/application/advisor-inbox/`, `src/adapters/gateways/` | `tests/recovery/crash-consistency.test.ts`, `tests/integration/advisor-inbox.test.ts`, `tests/integration/tmux-advisor-gateway.test.ts` | Batch A ledger behavior remains accepted; Batch D same message/notification identity replay and changed-hash conflict survive application and gateway boundaries | `IMPLEMENTED_THROUGH_BATCH_D__PENDING_ADVISOR_ACCEPTANCE` | None for the local Batch D subset |
| AO-REQ-015 Append-only hash-chained audit history | `src/persistence/file-store/event-store.ts`, `src/domain/events/index.ts` | `tests/persistence/hash-chain.test.ts`, `tests/recovery/corruption-quarantine.test.ts` | Mission ledger segments/hash chain implemented and tamper-quarantined; separate redacted security audit stream absent | `IMPLEMENTED_BATCH_A_DOMAIN_LEDGER_ONLY` | Security audit stream Batch E |
| AO-REQ-016 Deterministic projections and rebuild equivalence | `src/application/projections/mission-projector.ts`, `src/persistence/file-store/checkpoint-store.ts`, `src/persistence/file-store/projection-store.ts` | `tests/persistence/replay.test.ts`, `tests/recovery/restart-replay.test.ts` | Genesis/checkpoint canonical equivalence, atomic publication, invalid-checkpoint fallback, and scope replay pass; Advisor accepted Batch A | `IMPLEMENTED_BATCH_A__ADVISOR_ACCEPTED` | None for local Batch A core |
| AO-REQ-017 Evidence-backed completion and review routing | `src/application/evidence/index.ts`, `src/domain/completion/index.ts`, `src/application/advisor-inbox/`, `src/ui/scene/` | `tests/integration/advisor-inbox.test.ts`, `tests/ui/activity-mapping.test.ts` | Accepted completion evidence remains unchanged; Batch D adds only separate acknowledgement/intake/decision/resume evidence and never treats delivery/copy/animation as completion | `IMPLEMENTED_BATCH_D_LOCAL_EVIDENCE_SUBSET__PENDING_ADVISOR_ACCEPTANCE` | Review/private runtime remains Batch E |
| AO-REQ-018 Immutable message requestId/hash/receipt | `src/application/advisor-inbox/`, `src/persistence/file-store/artifact-store.ts` | `tests/integration/advisor-inbox.test.ts`, `tests/persistence/scoped-artifact.test.ts`, `tests/recovery/advisor-message-crash-consistency.test.ts` | Owner-only scoped artifact precedes durable event; same ID/bytes returns the receipt and changed bytes conflict across restart | `IMPLEMENTED_BATCH_D__PENDING_ADVISOR_ACCEPTANCE` | HTTP transport remains Batch E |
| AO-REQ-019 Advisor acknowledgement/intake/decision/resume chain | `src/application/advisor-inbox/`, `src/domain/decisions/` | `tests/integration/advisor-inbox.test.ts`, `tests/recovery/advisor-message-crash-consistency.test.ts` | Delivery, Advisor acknowledgement artifact, intake artifact, decision link, ResumeProof, and close are separately persisted/projected | `IMPLEMENTED_BATCH_D__PENDING_ADVISOR_ACCEPTANCE` | Canonical Leo/GPT decision authority remains external |
| AO-REQ-020 No browser-to-Worker/Reviewer route | `src/ui/communication/`, `src/application/advisor-inbox/`, `src/adapters/gateways/`; future `src/server/routes/` | `tests/ui/communication-center.component.test.tsx`, `tests/integration/tmux-advisor-gateway.test.ts`, `tests/acceptance/batch-gates.test.ts` | Compose exposes only mission/kind/subject/body/allowlisted refs; gateway port has no role/session/pane/command target and is logically Advisor-only | `IMPLEMENTED_THROUGH_BATCH_D__PENDING_ADVISOR_ACCEPTANCE` | Re-prove at Batch E HTTP boundary |
| AO-REQ-021 No arbitrary terminal/command surface | `src/adapters/observations/process-runner.ts`, `src/adapters/gateways/`, `src/ui/communication/` | `tests/adapters/tmux-readonly.test.ts`, `tests/integration/tmux-advisor-gateway.test.ts`, `tests/acceptance/batch-gates.test.ts` | Existing read-only direct-argv boundary remains accepted; Batch D gateway accepts one canonical pointer envelope through an inert injected port and imports no process/network primitive | `IMPLEMENTED_THROUGH_BATCH_D__PENDING_ADVISOR_ACCEPTANCE` | Re-prove at Batch E routes |
| AO-REQ-022 TmuxAdvisorGateway fixed Advisor-only delivery | `src/adapters/gateways/tmux-advisor/` | `tests/integration/tmux-advisor-gateway.test.ts`, `tests/recovery/advisor-message-crash-consistency.test.ts` | Fixed logical route, prevalidated capability hashes, exact runtime state/kill/synchronization vocabulary, future-issued/exclusive-expiry rejection, idempotent receipt, and ambiguous no-resend pass with inert fakes | `IMPLEMENTED_BATCH_D__PENDING_ADVISOR_ACCEPTANCE` | Real transport capability/activation remains external and was not used |
| AO-REQ-023 HermesAdvisorGateway interface/stub only | `src/adapters/gateways/hermes/` | `tests/adapters/hermes-disabled.test.ts` | Interface-compatible health/queue/lookup stub returns `DISABLED_NOT_IMPLEMENTED`/typed disabled receipt with no endpoint, credential, discovery, network, process, or write | `IMPLEMENTED_BATCH_D_DISABLED_STUB__PENDING_ADVISOR_ACCEPTANCE` | Separate Leo/GPT Hermes mission |
| AO-REQ-024 Read-only tmux observation, no prose inference | `src/adapters/observations/tmux/source.ts`, `src/application/queries/dashboard-view-model.ts`, `src/ui/scene/state-machine.ts` | `tests/adapters/tmux-readonly.test.ts`, `tests/ui/dashboard-view-model.test.ts`, `tests/ui/scene-boundary.test.ts` | Batch B/C observation and presentation boundaries are Advisor-accepted; Batch D adds no terminal-text read or inference | `IMPLEMENTED_THROUGH_BATCH_C__ADVISOR_ACCEPTED` | None for local observation |
| AO-REQ-025 Read-only Git and immutable artifact contracts | `src/adapters/observations/git/source.ts`, `src/adapters/observations/artifacts/source.ts`, `src/adapters/observations/manifest/source.ts` | `tests/adapters/git-readonly.test.ts`, `tests/adapters/artifact-manifest.test.ts` | Fixed Git argv/root/ref/pair and bounded file evidence were Advisor-accepted after Batch B | `IMPLEMENTED_BATCH_B__ADVISOR_ACCEPTED` | None for the Batch B local subset |
| AO-REQ-026 Transport authority reference/kill switch/manual fallback | `src/adapters/gateways/tmux-advisor/`, `src/ui/communication/` | `tests/integration/tmux-advisor-gateway.test.ts`, `tests/recovery/advisor-message-crash-consistency.test.ts`, `tests/e2e/communication-center.spec.ts` | Missing/disabled/malformed/stale/conflicting/kill-switch capability makes no delivery or receipt-lookup call and produces manual fallback; authority remains injected and external | `IMPLEMENTED_BATCH_D__PENDING_ADVISOR_ACCEPTANCE` | Real capability use remains separately controlled |
| AO-REQ-027 Loopback private default/fail-closed non-loopback | `src/server/network/` | `tests/security/bind-policy.test.ts` | `NOT_IMPLEMENTED`; [Security Section 5](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md#5-network-exposure-modes) | `DESIGNED_CANDIDATE` | Batch E |
| AO-REQ-028 Auth/session design without embedded real secret | `src/server/auth/` | `tests/security/auth-session.test.ts` | `NOT_IMPLEMENTED`; [Security Section 6](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md#6-authentication-design-without-embedded-secrets) | `DESIGNED_CANDIDATE` | Batch E; real-secret use separately authorized |
| AO-REQ-029 CSRF/origin/Host/CORS/cookie controls | `src/server/security/` | `tests/security/http-boundary.test.ts` | `NOT_IMPLEMENTED`; [Security Section 7](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md#7-csrf-origin-and-browser-request-controls) | `DESIGNED_CANDIDATE` | Batch E |
| AO-REQ-030 Rate limits, body bounds, output/content safety | `src/domain/messages/`, `src/ui/communication/`; future `src/server/security/` | `tests/domain/transitions.test.ts`, `tests/ui/communication-center.component.test.tsx` | Batch D enforces subject/body/whole-payload/reference/control bounds and inert limited rendering; HTTP rate/CSRF/request controls remain absent | `IMPLEMENTED_BATCH_D_CONTENT_SUBSET__PENDING_ADVISOR_ACCEPTANCE` | HTTP controls remain Batch E |
| AO-REQ-031 PWA cache confidentiality/offline read-only | `src/pwa/` | `tests/e2e/pwa-cache-security.spec.ts` | `NOT_IMPLEMENTED`; [Security Section 15](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md#15-pwa-and-offline-security) | `DESIGNED_CANDIDATE` | Batch E |
| AO-REQ-032 Tailscale/private-network plan disabled by default | `src/server/network/private-network/` | `tests/security/private-network-disabled.test.ts` | `NOT_IMPLEMENTED`; [Security 5.2](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md#52-private_network_gated-designed-disabled) | `DEFERRED_WITH_GATE` | Leo/GPT approval, threat review, credentials/TLS, Fable5 review |
| AO-REQ-033 Multi-project registry and root isolation | `src/application/projects/registry.ts` | `tests/integration/project-freshness.test.ts` | Trusted stable IDs, path-free summaries, cross-project denial, and overlap rejection were Advisor-accepted after Batch B | `IMPLEMENTED_BATCH_B__ADVISOR_ACCEPTED` | Browser registry editing remains absent |
| AO-REQ-034 Linux server/future Mac host topology and trust | `src/adapters/hosts/` | `tests/contract/host-observation.test.ts` | `NOT_IMPLEMENTED`; [Integration Sections 7-8](integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md#8-host-identity-and-trust) | `DEFERRED_WITH_GATE` | Remote-host/private-network/key mission; Mac host approval |
| AO-REQ-035 Host clock/offline/reconnect/gap/stale evidence | `src/application/hosts/freshness.ts`, `src/ui/scene/state-machine.ts` | `tests/integration/project-freshness.test.ts`, `tests/ui/activity-mapping.test.ts` | Batch C local freshness/presentation is Advisor-accepted; remote host envelopes/gaps/reconnect remain absent | `IMPLEMENTED_BATCH_C_LOCAL_PRESENTATION_SUBSET__ADVISOR_ACCEPTED` | Remote collectors remain gated |
| AO-REQ-036 Structured activity and exact observable mapping: dispatching/reading/working/testing/writing-result/returning-result/reviewing/block/wait/recovery | `src/domain/activity/index.ts`, `src/ui/scene/` | `tests/domain/writing-result-activity.test.ts`, `tests/contract/required-observable-conformance.test.ts`, `tests/ui/activity-mapping.test.ts` | All exact Batch C mappings and prose exclusion are Advisor-accepted and pass in Batch D regression | `IMPLEMENTED_BATCH_C__ADVISOR_ACCEPTED` | None for scene mapping |
| AO-REQ-037 Animation precedence, dedup, bounded motion | `src/ui/scene/state-machine.ts`, `src/ui/styles.css` | `tests/ui/activity-precedence.test.ts`, `tests/e2e/office-scene.spec.ts` | Batch C precedence/dedup/bounded motion is accepted and all three visual baselines remain byte-unchanged in the 15-test browser suite | `IMPLEMENTED_BATCH_C__ADVISOR_ACCEPTED` | Cross-host visual portability remains Batch E |
| AO-REQ-038 Accessibility and reduced motion | `src/ui/scene/office-scene.tsx`, `src/ui/communication/`, `src/ui/styles.css` | `tests/ui/office-scene.component.test.tsx`, `tests/ui/communication-center.component.test.tsx`, `tests/e2e/accessibility.spec.ts`, `tests/e2e/communication-center.spec.ts` | Scene accessibility remains accepted; Inbox/Alerts add 44px controls, visible focus, persistent critical state, polite/assertive policy, inert text, and WCAG A/AA-clean audits | `IMPLEMENTED_THROUGH_BATCH_D__PENDING_ADVISOR_ACCEPTANCE` | PWA accessibility remains Batch E |
| AO-REQ-039 Local visual asset/icon/license strategy | `src/ui/assets/LICENSES.md`, `src/ui/scene/asset-registry.ts`, `src/ui/scene/assets/`, `playwright.config.ts` | `tests/ui/layout-contract.test.ts`, `tests/e2e/office-scene.spec.ts` | Batch C asset/baseline/locale evidence is Advisor-accepted and unchanged by Batch D | `IMPLEMENTED_BATCH_C__ADVISOR_ACCEPTED` | Cross-host/browser/font portability remains Batch E |
| AO-REQ-040 Desktop/mobile stable dimensions, overflow, Korean expansion, and no silent translation | `src/ui/styles.css`, `src/ui/i18n/ko.ts`, `src/ui/communication/` | `tests/ui/korean-vocabulary.test.ts`, `tests/ui/communication-center.component.test.tsx`, `tests/e2e/communication-center.spec.ts` | Batch D adds exact five message/nine alert/six action labels and passes 1440/1024/390/320/landscape/200%-text no-overflow and direct visual inspection | `IMPLEMENTED_BATCH_D_UI__PENDING_ADVISOR_ACCEPTANCE` | PWA content remains Batch E |
| AO-REQ-041 PWA installability/update/offline UX | `src/pwa/`, `src/ui/pwa/` | `tests/e2e/pwa-lifecycle.spec.ts` | `NOT_IMPLEMENTED`; [UI Section 14](ui/AGENT_OFFICE_UI_ANIMATION_MAPPING.md#14-pwa-install-offline-and-update-ux) | `DESIGNED_CANDIDATE` | Batch E |
| AO-REQ-042 SSE over WebSocket with cursor/reset | `src/server/sse/`, `src/ui/live/` | `tests/integration/sse-reconnect.test.ts` | `NOT_IMPLEMENTED`; [Master 8.2](architecture/AGENT_OFFICE_MASTER_DESIGN.md#82-sse-decision) | `DESIGNED_CANDIDATE` | Batch E; WebSocket needs new reviewed decision |
| AO-REQ-043 Single-writer JSONL/artifact/projection crash consistency | `src/persistence/file-store/`, `src/application/startup/recovery.ts` | `tests/recovery/crash-consistency.test.ts`, `tests/recovery/restart-replay.test.ts` | Owner-only init, writer recovery, content-addressed artifacts, fsynced segments, atomic projections, rotation/restart pass; Advisor accepted Batch A | `IMPLEMENTED_BATCH_A__ADVISOR_ACCEPTED` | Backup/restore remains Batch E |
| AO-REQ-044 Corruption quarantine and stale/conflict behavior | `src/persistence/file-store/`, `src/application/advisor-inbox/`, `src/application/hosts/freshness.ts`, `src/ui/scene/` | `tests/recovery/corruption-quarantine.test.ts`, `tests/recovery/advisor-message-crash-consistency.test.ts` | Accepted store quarantine remains unchanged; Batch D orphan/event/outbox/started-delivery restart fixtures fail closed to reuse/replay/manual fallback | `IMPLEMENTED_THROUGH_BATCH_D__PENDING_ADVISOR_ACCEPTANCE` | Full service/remote recovery remains Batch E |
| AO-REQ-045 Backup and isolated restore | `src/operations/backup/`, `src/operations/restore/` | `tests/recovery/backup-restore.test.ts` | `NOT_IMPLEMENTED`; [Operations Sections 11-12](operations/AGENT_OFFICE_OPERATIONS_RECOVERY.md#11-backup-design) | `DESIGNED_CANDIDATE` | Batch E; off-host/encryption separately gated |
| AO-REQ-046 Application rollback and disable strategy | `src/operations/`, `src/application/startup/` | `tests/recovery/rollback-disable.test.ts` | `NOT_IMPLEMENTED`; [Operations Sections 13-14](operations/AGENT_OFFICE_OPERATIONS_RECOVERY.md#13-application-rollback-and-data-compatibility) | `DESIGNED_CANDIDATE` | Batch E; no Git/deployment authority implied |
| AO-REQ-047 Evidence-bearing proof of recovery | `src/operations/evidence/` | `tests/recovery/recovery-result.test.ts` | `NOT_IMPLEMENTED`; [Operations Section 16](operations/AGENT_OFFICE_OPERATIONS_RECOVERY.md#16-proof-of-recovery) | `DESIGNED_CANDIDATE` | Batch E and Advisor audit |
| AO-REQ-048 Batch A-E dependencies, acceptance tests, reviews | `package.json`, `playwright.config.ts`, `tests/acceptance/batch-gates.test.ts`, future result artifacts | `tests/acceptance/batch-gates.test.ts` | Batches A-C accepted; 35-file/149-test Vitest regression and 15-test Chromium suite cover Batch D while Batch E remains absent | `IMPLEMENTED_THROUGH_BATCH_D__PENDING_ADVISOR_ACCEPTANCE` | Advisor must accept Batch D before Batch E |
| AO-REQ-049 Current bootstrap truth, unknowns, limitations | canonical docs and `README.md` | `tests/acceptance/batch-gates.test.ts` | Bootstrap/design/A-C acceptance and exact Batch D code/test/UI/gateway evidence are recorded without claiming Batch D acceptance | `IMPLEMENTED_THROUGH_BATCH_D__PENDING_ADVISOR_ACCEPTANCE` | Update after Advisor validation |
| AO-REQ-050 No DB/public/prod/Hermes implementation/automatic next mission | module/import/route/build policy | `tests/acceptance/batch-gates.test.ts` | Batch D source boundary proves no DB/public/prod/HTTP/PWA or Hermes implementation; the Hermes class is a disabled no-side-effect stub only | `OUT_OF_SCOPE` | New explicit Leo/GPT mission where applicable; Hermes separately gated |

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
| Batch D | Advisor Inbox, alerts, GPT package, TmuxAdvisorGateway, acknowledgement/resume | Batch C dependency/evidence accepted; transport capability remains injected/disabled unless valid | Code/config/tests `7366036f8a1e6fc9d4e911e8d193e17eeb95f54c`; AO-D-R1 rework `04809004bfd863181f4af8260879f56bc8b6ede6`; 35 Vitest files/155 tests, 15 Playwright tests, lint/typecheck/build/audit/diff/boundary/WCAG/responsive/visual inspection pass; pending Advisor acceptance |
| Batch E | PWA, security, recovery, full end-to-end tests | Batch D dependency/evidence accepted; any real auth/private gate | `NOT_IMPLEMENTED` |
| Worker result | Exact as-built evidence package | Advisor verification | `NOT_IMPLEMENTED` |
| Implementation review | Actual code/tests/design conformance | Fable5 `IMPLEMENTATION_REVIEW` | `NOT_IMPLEMENTED` |
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

### 6.1 Batch D divergence classification

- `DOCUMENTATION_STALE`: Batch C-pending and Batch D-not-implemented statements,
  future inbox/gateway/test paths, and prior 124/10 test counts became stale after
  Advisor accepted Batch C and Batch D code commit
  `7366036f8a1e6fc9d4e911e8d193e17eeb95f54c` landed; this docs commit corrects
  only materially affected canonical evidence.
- `DEFERRED_WITH_GATE`: Batch E, private-network, real-auth, remote-host/Mac,
  Hermes implementation, DB, public, production/live, backup/restore,
  server/SSE/PWA, real transport activation, remote collectors, and
  cross-host/browser/font portability remain at named gates.
- `CODE_DEFECT`: none encountered in the Batch D implementation boundary.
- `DESIGN_DEFECT`: none encountered.
- `NEEDS_LEO_GPT_DECISION`: none.

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

## 8. Batch D Closure Checklist

- the seven canonical design documents remain owned only by Agent Office;
- independent design PASS evidence is referenced without claiming implementation
  review or final approval;
- Batch A-C acceptance and Batch D implementation paths/tests/code commit are
  exact, while Batch E remains explicitly unimplemented;
- the approved 15-WorkUnit source bytes, path, source commit, hash, labels,
  dependencies, and current facts are preserved;
- all required A-C regression plus Batch D durability/gateway/alert/UI/browser
  paths and lint/typecheck/build/audit/diff/boundary/WCAG gates pass;
- no server, PWA, HTTP/SSE, DB, secret, auth action, remote collector, network
  exposure, production/live operation, Hermes implementation, real tmux input,
  or browser role dispatch exists; and
- Batch D remains pending Advisor acceptance; Batch E or another mission does not
  start automatically.
