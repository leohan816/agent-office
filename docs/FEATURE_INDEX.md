# Agent Office M01 Feature and Traceability Index

Status: `REVIEWED_DESIGN__BATCH_A_B_ACCEPTED__BATCH_C_IMPLEMENTED__PENDING_ADVISOR_ACCEPTANCE`

Mission: `AGENT_OFFICE_M01_ADVISOR_MANAGED_OFFICE_WEB_CONTROL_PLANE`

This is the canonical discoverability and material-requirement traceability index
for M01. It records the independent design PASS, Advisor-accepted Batches A/B,
and Batch C as-built evidence. It does not claim Advisor Batch C acceptance,
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
desktop/mobile/reduced-motion baselines. All 27 Vitest files pass (123 tests), all
10 Playwright Chromium tests pass, and lint, strict typecheck, production builds,
dependency audit, diff, source boundary, axe, and layout/no-overlap gates pass.

There is still no HTTP authority server, PWA/service worker, SSE, Advisor Inbox or
gateway, real authentication/secret, DB, remote collector,
private/public network exposure, deployment, backup/restore operation, or live
runtime. Batch C is pending Advisor acceptance; Batch D has not started.

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
| `IMPLEMENTED_BATCH_C__PENDING_ADVISOR_ACCEPTANCE` | Present and verified in Batch C code/tests/assets; not yet accepted as the dependency for Batch D |
| `IMPLEMENTED_BATCH_C_LOCAL_SUBSET__PENDING_ADVISOR_ACCEPTANCE` | Only the named Batch C presentation subset exists; server/gateway/PWA/later behavior remains gated |

Every `CURRENT_EVIDENCE` value beginning with `NOT_IMPLEMENTED` is honest design
evidence only. A document section is not proof that behavior exists.

## 4. Material Requirement Traceability

| DESIGN_REQUIREMENT | IMPLEMENTATION_PATH | TEST_PATH | CURRENT_EVIDENCE | STATUS | DEFERRED_GATE |
|---|---|---|---|---|---|
| AO-REQ-001 Purpose, audience, operations focus, non-goals | `src/ui/`, future `src/server/` | `tests/acceptance/batch-gates.test.ts`, `tests/ui/dashboard.component.test.tsx`, `tests/e2e/office-scene.spec.ts` | Quiet read-only operations first screen plus full-width structured-event office and Batch D/E forbidden-scope guards pass; server/product completion remains absent | `IMPLEMENTED_BATCH_C_UI_SUBSET__PENDING_ADVISOR_ACCEPTANCE` | Advisor Batch C acceptance; full private product remains Batch E |
| AO-REQ-002 Actor authority and source-of-truth precedence | `src/contracts/types.ts`, `src/application/evidence/index.ts`, future authority application policy | `tests/domain/transitions.test.ts`, later authority tests | Actor/evidence references and fail-closed verification primitives are in code commit `7edc8f79bedb059ab6697e64ddaf57fbebde2c87`; full cross-source conflict application remains absent | `IMPLEMENTED_BATCH_A_CONTRACT_ONLY` | Canonical V2 remains external authority; application integration in later batches |
| AO-REQ-003 Responsive private PWA and quiet UI | `src/ui/`; future `src/pwa/` | `tests/ui/dashboard.component.test.tsx`, `tests/ui/layout-contract.test.ts`, `tests/e2e/office-scene.spec.ts` | Static dashboard and scene pass desktop/tablet/390/320/landscape/200%-text browser layout gates; PWA, server/live data, auth, and private runtime are absent | `IMPLEMENTED_BATCH_C_UI_SUBSET__PENDING_ADVISOR_ACCEPTANCE` | PWA/private runtime remains Batch E |
| AO-REQ-004 Initiative -> Package -> Mission -> Phase -> WorkUnit with fixed Korean hierarchy labels | `src/domain/manifest/index.ts`, `fixtures/manifests/`, `src/ui/i18n/ko.ts`, `src/ui/dashboard.tsx` | `tests/domain/manifest.test.ts`, `tests/ui/korean-vocabulary.test.ts`, `tests/ui/dashboard.component.test.tsx` | Exact source hierarchy/`labelKo` and fixed Korean hierarchy labels were Advisor-accepted after Batch B and remain unchanged in Batch C | `IMPLEMENTED_THROUGH_BATCH_B__ADVISOR_ACCEPTED` | None for the local hierarchy subset |
| AO-REQ-005 Versioned denominator and exact scope accounting | `src/domain/manifest/index.ts`, `src/application/projections/mission-projector.ts`, `src/application/queries/dashboard-view-model.ts` | `tests/property/scope-counting.test.ts`, `tests/ui/dashboard-view-model.test.ts` | Advisor-accepted scope core plus distinct declared WorkUnit denominator/future-unapproved rendering pass unchanged | `IMPLEMENTED_THROUGH_BATCH_B__ADVISOR_ACCEPTED` | Authority artifact still required for any scope change |
| AO-REQ-006 Durable WorkUnit states/transitions/dependencies plus exact 16-name primary/activity conformance | `src/domain/state-machines/work-unit.ts`, `src/domain/activity/index.ts`, `src/ui/scene/state-machine.ts` | `tests/property/transition-matrix.test.ts`, `tests/contract/required-observable-conformance.test.ts`, `tests/ui/activity-mapping.test.ts` | Accepted domain matrix/fallback plus Batch C exact scene mapping and evidence/source fail-closed coverage pass at code commit `e30a6cda52e14a4bf30b2d1b7445fa26645496e5` | `IMPLEMENTED_THROUGH_BATCH_C__PENDING_ADVISOR_ACCEPTANCE` | Advisor Batch C acceptance |
| AO-REQ-007 Message states and immutable Advisor flow | `src/domain/messages/index.ts`, `src/domain/state-machines/entities.ts`, future `src/application/advisor-inbox/` | `tests/domain/transitions.test.ts`, later integration tests | Exact no-target message schema and lifecycle contract implemented; persistence/delivery/intake flow absent | `IMPLEMENTED_BATCH_A_CONTRACT_ONLY` | Batch D |
| AO-REQ-008 Typed BlockerKind, exact BlockerOpened fields/lifecycle/resume proof, and Korean labels | `src/domain/blockers/index.ts`, `src/domain/decisions/resume-proof.ts`, `src/ui/i18n/ko.ts`, `src/ui/scene/` | `tests/contract/blocker-alert-vocabulary.test.ts`, `tests/ui/korean-vocabulary.test.ts`, `tests/ui/activity-mapping.test.ts`, `tests/e2e/office-scene.spec.ts` | Accepted contract/presentation plus Batch C immediate barrier, exact reason/route, critical overlay, and assertive announcement; mutation/resume application absent | `IMPLEMENTED_BATCH_C_PRESENTATION_SUBSET__PENDING_ADVISOR_ACCEPTANCE` | Blocker application and notifications remain Batch D |
| AO-REQ-009 Typed AlertKind, deterministic payload/dedup, lifecycle, actions, and Korean labels | `src/domain/alerts/index.ts`, `src/domain/state-machines/entities.ts` | `tests/contract/blocker-alert-vocabulary.test.ts` | Closed nine-kind policy, exact payload/action checks, canonical dedup, and lifecycle implemented; UI/notification absent | `IMPLEMENTED_BATCH_A_CONTRACT_ONLY` | Batches D/E |
| AO-REQ-010 Decision states, exact deterministic GPT package fields, application | `src/domain/decisions/` | `tests/domain/transitions.test.ts`, `tests/snapshot/gpt-package.test.ts` | Decision lifecycle/ResumeProof and exact ordered 13-field canonical JSON/Markdown snapshot implemented; decision application absent | `IMPLEMENTED_BATCH_A_CONTRACT_ONLY` | Batch D; Leo/GPT authority when required |
| AO-REQ-011 Notification states/idempotency using canonical AlertKind/dedup | `src/domain/state-machines/entities.ts`, `src/domain/alerts/index.ts`, future `src/application/notifications/` | `tests/domain/transitions.test.ts`, `tests/contract/blocker-alert-vocabulary.test.ts` | Notification lifecycle plus canonical alert/dedup contract implemented; notification application/delivery absent | `IMPLEMENTED_BATCH_A_CONTRACT_ONLY` | Batch D |
| AO-REQ-012 Event transition validation and stable rejection | `src/contracts/`, `src/domain/events/index.ts`, `src/domain/state-machines/` | `tests/domain/event-envelope.test.ts`, `tests/property/transition-matrix.test.ts` | Versioned boundaries, stable rejection codes, closed transitions, and unknown-field rejection pass; Advisor accepted Batch A | `IMPLEMENTED_BATCH_A__ADVISOR_ACCEPTED` | Later application commands remain gated |
| AO-REQ-013 UTC timestamps, stream/host sequence, clock quality | `src/domain/time/index.ts`, `src/domain/events/index.ts`, `src/application/hosts/freshness.ts` | `tests/domain/event-envelope.test.ts`, `tests/persistence/hash-chain.test.ts`, `tests/integration/project-freshness.test.ts` | Canonical event time/sequence plus explicit local source/receipt/clock-quality freshness inputs were accepted; remote host sequence/clock handshake absent | `IMPLEMENTED_BATCH_B_LOCAL_SUBSET__ADVISOR_ACCEPTED` | Remote host behavior gated |
| AO-REQ-014 Request idempotency, ordering, causal links | `src/domain/events/index.ts`, `src/persistence/file-store/event-store.ts` | `tests/recovery/crash-consistency.test.ts`, `tests/persistence/hash-chain.test.ts` | Same-request replay and changed-command conflict survive restart; sequence/hash/causal fields pass; Advisor accepted Batch A | `IMPLEMENTED_BATCH_A__ADVISOR_ACCEPTED` | Gateway idempotency remains Batch D |
| AO-REQ-015 Append-only hash-chained audit history | `src/persistence/file-store/event-store.ts`, `src/domain/events/index.ts` | `tests/persistence/hash-chain.test.ts`, `tests/recovery/corruption-quarantine.test.ts` | Mission ledger segments/hash chain implemented and tamper-quarantined; separate redacted security audit stream absent | `IMPLEMENTED_BATCH_A_DOMAIN_LEDGER_ONLY` | Security audit stream Batch E |
| AO-REQ-016 Deterministic projections and rebuild equivalence | `src/application/projections/mission-projector.ts`, `src/persistence/file-store/checkpoint-store.ts`, `src/persistence/file-store/projection-store.ts` | `tests/persistence/replay.test.ts`, `tests/recovery/restart-replay.test.ts` | Genesis/checkpoint canonical equivalence, atomic publication, invalid-checkpoint fallback, and scope replay pass; Advisor accepted Batch A | `IMPLEMENTED_BATCH_A__ADVISOR_ACCEPTED` | None for local Batch A core |
| AO-REQ-017 Evidence-backed completion and review routing | `src/application/evidence/index.ts`, `src/domain/completion/index.ts`, `src/adapters/observations/`, `src/application/hosts/freshness.ts`, `src/ui/scene/state-machine.ts` | `tests/domain/transitions.test.ts`, `tests/adapters/artifact-manifest.test.ts`, `tests/integration/project-freshness.test.ts`, `tests/ui/activity-mapping.test.ts` | Accepted evidence core plus Batch C verified result+pointer requirement and stale/unaccepted motion suppression; review/application flow absent | `IMPLEMENTED_BATCH_C_LOCAL_EVIDENCE_SUBSET__PENDING_ADVISOR_ACCEPTANCE` | Review/application routing remains Batches D/E |
| AO-REQ-018 Immutable message requestId/hash/receipt | `src/application/advisor-inbox/`, `src/persistence/artifacts/` | `tests/integration/message-crash-idempotency.test.ts` | `NOT_IMPLEMENTED`; [Domain 8.1-8.2](contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md#81-browser-command) | `DESIGNED_CANDIDATE` | Batch D |
| AO-REQ-019 Advisor acknowledgement/intake/decision/resume chain | `src/application/advisor-inbox/`, `src/domain/decisions/` | `tests/e2e/advisor-decision-resume.spec.ts` | `NOT_IMPLEMENTED`; [Domain 8.3-8.5](contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md#83-canonical-advisor-intake) | `DESIGNED_CANDIDATE` | Batch D; canonical decision authority |
| AO-REQ-020 No browser-to-Worker/Reviewer route | `src/ui/dashboard.tsx`, `src/ui/scene/`; future `src/server/routes/`, `src/adapters/gateways/` | `tests/ui/dashboard.component.test.tsx`, `tests/ui/scene-boundary.test.ts`, `tests/acceptance/batch-gates.test.ts` | Batch B boundary is accepted; Batch C adds fixture/selection/motion presentation only and no dispatch handler/server/gateway | `IMPLEMENTED_BATCH_C_STATIC_UI_BOUNDARY__PENDING_ADVISOR_ACCEPTANCE` | Re-prove for Batch D/E server/gateway surfaces |
| AO-REQ-021 No arbitrary terminal/command surface | `src/adapters/observations/process-runner.ts`, `src/ui/dashboard.tsx`, `src/ui/scene/` | `tests/adapters/git-readonly.test.ts`, `tests/adapters/tmux-readonly.test.ts`, `tests/ui/scene-boundary.test.ts`, `tests/acceptance/batch-gates.test.ts` | Accepted direct-argv/no-shell boundary plus Batch C proof of no scene adapter/process/network/write import or prose-driven change | `IMPLEMENTED_BATCH_C_LOCAL_SUBSET__PENDING_ADVISOR_ACCEPTANCE` | Re-prove for Batch D/E routes/gateways |
| AO-REQ-022 TmuxAdvisorGateway fixed Advisor-only delivery | `src/adapters/gateways/tmux-advisor/` | `tests/integration/tmux-advisor-gateway.test.ts` | `NOT_IMPLEMENTED`; [Integration Sections 3-4](integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md#3-advisorgateway-contract) | `DESIGNED_CANDIDATE` | Batch D and approved transport capability/profile |
| AO-REQ-023 HermesAdvisorGateway interface/stub only | `src/adapters/gateways/hermes/` | `tests/adapters/hermes-disabled.test.ts` | `NOT_IMPLEMENTED`; [Integration Section 5](integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md#5-hermesadvisorgateway-stub) | `DEFERRED_WITH_GATE` | Separate Leo/GPT Hermes mission |
| AO-REQ-024 Read-only tmux observation, no prose inference | `src/adapters/observations/tmux/source.ts`, `src/application/queries/dashboard-view-model.ts`, `src/ui/scene/state-machine.ts` | `tests/adapters/tmux-readonly.test.ts`, `tests/ui/dashboard-view-model.test.ts`, `tests/ui/scene-boundary.test.ts` | Batch B exact read-only tmux boundary was accepted; Batch C ignores extra prose/process-shaped properties and consumes accepted IDs only | `IMPLEMENTED_THROUGH_BATCH_C__PENDING_ADVISOR_ACCEPTANCE` | Advisor Batch C acceptance |
| AO-REQ-025 Read-only Git and immutable artifact contracts | `src/adapters/observations/git/source.ts`, `src/adapters/observations/artifacts/source.ts`, `src/adapters/observations/manifest/source.ts` | `tests/adapters/git-readonly.test.ts`, `tests/adapters/artifact-manifest.test.ts` | Fixed Git argv/root/ref/pair and bounded file evidence were Advisor-accepted after Batch B | `IMPLEMENTED_BATCH_B__ADVISOR_ACCEPTED` | None for the Batch B local subset |
| AO-REQ-026 Transport authority reference/kill switch/manual fallback | `src/adapters/gateways/tmux-advisor/`, `src/ui/inbox/` | `tests/integration/kill-switch-fallback.test.ts` | `NOT_IMPLEMENTED`; [Integration 4.2-4.4](integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md#42-authority-dependency-not-duplication), [Security 14](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md#14-kill-switch-disable-and-manual-fallback) | `DESIGNED_CANDIDATE` | Batch D; authority remains canonical V2/transport files |
| AO-REQ-027 Loopback private default/fail-closed non-loopback | `src/server/network/` | `tests/security/bind-policy.test.ts` | `NOT_IMPLEMENTED`; [Security Section 5](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md#5-network-exposure-modes) | `DESIGNED_CANDIDATE` | Batch E |
| AO-REQ-028 Auth/session design without embedded real secret | `src/server/auth/` | `tests/security/auth-session.test.ts` | `NOT_IMPLEMENTED`; [Security Section 6](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md#6-authentication-design-without-embedded-secrets) | `DESIGNED_CANDIDATE` | Batch E; real-secret use separately authorized |
| AO-REQ-029 CSRF/origin/Host/CORS/cookie controls | `src/server/security/` | `tests/security/http-boundary.test.ts` | `NOT_IMPLEMENTED`; [Security Section 7](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md#7-csrf-origin-and-browser-request-controls) | `DESIGNED_CANDIDATE` | Batch E |
| AO-REQ-030 Rate limits, body bounds, output/content safety | `src/server/security/`, `src/ui/content/` | `tests/security/rate-input-xss.test.ts` | `NOT_IMPLEMENTED`; [Security Sections 9-10](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md#9-input-output-and-content-safety) | `DESIGNED_CANDIDATE` | Batch E |
| AO-REQ-031 PWA cache confidentiality/offline read-only | `src/pwa/` | `tests/e2e/pwa-cache-security.spec.ts` | `NOT_IMPLEMENTED`; [Security Section 15](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md#15-pwa-and-offline-security) | `DESIGNED_CANDIDATE` | Batch E |
| AO-REQ-032 Tailscale/private-network plan disabled by default | `src/server/network/private-network/` | `tests/security/private-network-disabled.test.ts` | `NOT_IMPLEMENTED`; [Security 5.2](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md#52-private_network_gated-designed-disabled) | `DEFERRED_WITH_GATE` | Leo/GPT approval, threat review, credentials/TLS, Fable5 review |
| AO-REQ-033 Multi-project registry and root isolation | `src/application/projects/registry.ts` | `tests/integration/project-freshness.test.ts` | Trusted stable IDs, path-free summaries, cross-project denial, and overlap rejection were Advisor-accepted after Batch B | `IMPLEMENTED_BATCH_B__ADVISOR_ACCEPTED` | Browser registry editing remains absent |
| AO-REQ-034 Linux server/future Mac host topology and trust | `src/adapters/hosts/` | `tests/contract/host-observation.test.ts` | `NOT_IMPLEMENTED`; [Integration Sections 7-8](integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md#8-host-identity-and-trust) | `DEFERRED_WITH_GATE` | Remote-host/private-network/key mission; Mac host approval |
| AO-REQ-035 Host clock/offline/reconnect/gap/stale evidence | `src/application/hosts/freshness.ts`, `src/ui/scene/state-machine.ts` | `tests/integration/project-freshness.test.ts`, `tests/ui/activity-mapping.test.ts` | Accepted local freshness plus Batch C stale/offline/unknown/conflict/error scene suppression; remote host envelopes/gaps/reconnect absent | `IMPLEMENTED_BATCH_C_LOCAL_PRESENTATION_SUBSET__PENDING_ADVISOR_ACCEPTANCE` | Remote collectors remain gated |
| AO-REQ-036 Structured activity and exact observable mapping: dispatching/reading/working/testing/writing-result/returning-result/reviewing/block/wait/recovery | `src/domain/activity/index.ts`, `src/ui/scene/` | `tests/domain/writing-result-activity.test.ts`, `tests/contract/required-observable-conformance.test.ts`, `tests/ui/activity-mapping.test.ts`, `tests/ui/scene-boundary.test.ts` | Accepted domain pairing plus all exact scene mappings, result/pointer gate, stale/unaccepted failure, and prose exclusion pass at Batch C code commit | `IMPLEMENTED_BATCH_C__PENDING_ADVISOR_ACCEPTANCE` | Advisor Batch C acceptance |
| AO-REQ-037 Animation precedence, dedup, bounded motion | `src/ui/scene/state-machine.ts`, `src/ui/styles.css` | `tests/ui/activity-precedence.test.ts`, `tests/ui/layout-contract.test.ts`, `tests/e2e/office-scene.spec.ts` | Exact precedence, event-ID dedup, maximum-three burst queue, no reload/resume replay, bounded ordered transform/opacity cues, and visibility pause pass | `IMPLEMENTED_BATCH_C__PENDING_ADVISOR_ACCEPTANCE` | Advisor Batch C acceptance |
| AO-REQ-038 Accessibility and reduced motion | `src/ui/scene/office-scene.tsx`, `src/ui/styles.css` | `tests/ui/office-scene.component.test.tsx`, `tests/e2e/accessibility.spec.ts`, `tests/e2e/office-scene.spec.ts` | Semantic/status/live-region/focus/touch behavior, persisted motion toggle, media reduced motion, and axe A/AA audits pass; later dialogs/PWA absent | `IMPLEMENTED_BATCH_C_SCENE_SUBSET__PENDING_ADVISOR_ACCEPTANCE` | Later dialog/PWA accessibility remains Batch D/E |
| AO-REQ-039 Local visual asset/icon/license strategy | `src/ui/assets/LICENSES.md`, `src/ui/scene/asset-registry.ts`, `src/ui/scene/assets/` | `tests/ui/layout-contract.test.ts`, `tests/e2e/office-scene.spec.ts` | Locally bundled Lucide plus project-authored actor/desk/document/barrier/tool/warning assets have exact dimensions, ownership/license, source hash, and visual baselines | `IMPLEMENTED_BATCH_C__PENDING_ADVISOR_ACCEPTANCE` | Advisor Batch C acceptance |
| AO-REQ-040 Desktop/mobile stable dimensions, overflow, Korean expansion, and no silent translation | `src/ui/styles.css`, `src/ui/i18n/ko.ts`, `src/ui/dashboard.tsx`, `src/ui/scene/` | `tests/ui/layout-contract.test.ts`, `tests/ui/korean-vocabulary.test.ts`, `tests/e2e/office-scene.spec.ts` | Batch B reflow/vocabulary plus Batch C 1440/1024/390/320/landscape/200%-text, pagination, no-overlap, and screenshot gates pass | `IMPLEMENTED_BATCH_C__PENDING_ADVISOR_ACCEPTANCE` | Later inbox/PWA content remains Batch D/E |
| AO-REQ-041 PWA installability/update/offline UX | `src/pwa/`, `src/ui/pwa/` | `tests/e2e/pwa-lifecycle.spec.ts` | `NOT_IMPLEMENTED`; [UI Section 14](ui/AGENT_OFFICE_UI_ANIMATION_MAPPING.md#14-pwa-install-offline-and-update-ux) | `DESIGNED_CANDIDATE` | Batch E |
| AO-REQ-042 SSE over WebSocket with cursor/reset | `src/server/sse/`, `src/ui/live/` | `tests/integration/sse-reconnect.test.ts` | `NOT_IMPLEMENTED`; [Master 8.2](architecture/AGENT_OFFICE_MASTER_DESIGN.md#82-sse-decision) | `DESIGNED_CANDIDATE` | Batch E; WebSocket needs new reviewed decision |
| AO-REQ-043 Single-writer JSONL/artifact/projection crash consistency | `src/persistence/file-store/`, `src/application/startup/recovery.ts` | `tests/recovery/crash-consistency.test.ts`, `tests/recovery/restart-replay.test.ts` | Owner-only init, writer recovery, content-addressed artifacts, fsynced segments, atomic projections, rotation/restart pass; Advisor accepted Batch A | `IMPLEMENTED_BATCH_A__ADVISOR_ACCEPTED` | Backup/restore remains Batch E |
| AO-REQ-044 Corruption quarantine and stale/conflict behavior | `src/persistence/file-store/`, `src/application/hosts/freshness.ts`, `src/ui/dashboard.tsx`, `src/ui/scene/state-machine.ts` | `tests/recovery/corruption-quarantine.test.ts`, `tests/integration/project-freshness.test.ts`, `tests/ui/activity-mapping.test.ts` | Accepted durable/local behavior plus Batch C unknown/stale static overlay and motion suppression pass | `IMPLEMENTED_THROUGH_BATCH_C__PENDING_ADVISOR_ACCEPTANCE` | Service/remote recovery remains Batch E |
| AO-REQ-045 Backup and isolated restore | `src/operations/backup/`, `src/operations/restore/` | `tests/recovery/backup-restore.test.ts` | `NOT_IMPLEMENTED`; [Operations Sections 11-12](operations/AGENT_OFFICE_OPERATIONS_RECOVERY.md#11-backup-design) | `DESIGNED_CANDIDATE` | Batch E; off-host/encryption separately gated |
| AO-REQ-046 Application rollback and disable strategy | `src/operations/`, `src/application/startup/` | `tests/recovery/rollback-disable.test.ts` | `NOT_IMPLEMENTED`; [Operations Sections 13-14](operations/AGENT_OFFICE_OPERATIONS_RECOVERY.md#13-application-rollback-and-data-compatibility) | `DESIGNED_CANDIDATE` | Batch E; no Git/deployment authority implied |
| AO-REQ-047 Evidence-bearing proof of recovery | `src/operations/evidence/` | `tests/recovery/recovery-result.test.ts` | `NOT_IMPLEMENTED`; [Operations Section 16](operations/AGENT_OFFICE_OPERATIONS_RECOVERY.md#16-proof-of-recovery) | `DESIGNED_CANDIDATE` | Batch E and Advisor audit |
| AO-REQ-048 Batch A-E dependencies, acceptance tests, reviews | `package.json`, `tests/acceptance/batch-gates.test.ts`, future result artifacts | `tests/acceptance/batch-gates.test.ts` | Batches A/B accepted; 123-test regression includes exact Batch C dependencies/tests plus Batch D/E forbidden-scope guards, and 10 browser tests pass | `IMPLEMENTED_THROUGH_BATCH_C__PENDING_ADVISOR_ACCEPTANCE` | Advisor must accept before any Batch D handoff |
| AO-REQ-049 Current bootstrap truth, unknowns, limitations | canonical docs and `README.md` | `tests/acceptance/batch-gates.test.ts` | Bootstrap/design/A/B acceptance and exact Batch C commit, paths, tests, assets, local browser limits, and later-batch exclusions are recorded as-built | `IMPLEMENTED_THROUGH_BATCH_C__PENDING_ADVISOR_ACCEPTANCE` | Update only from later reviewed as-built evidence |
| AO-REQ-050 No DB/public/prod/Hermes implementation/automatic next mission | module/import/route/build policy | `tests/acceptance/batch-gates.test.ts` | Batch C source-tree/import/route guards prove these surfaces remain absent | `OUT_OF_SCOPE` | New explicit Leo/GPT mission where applicable; Hermes separately gated |

### 4.1 Fable5 F-1/F-2/F-3 rework anchors

| Finding | Exact canonical closure | Reproduction test path | Current status |
|---|---|---|---|
| `F-1` | Domain 6.3 maps all 16 exact required observable names across durable primary state plus structured activity; Domain 13 adds `WRITING_RESULT`; UI 5-6 maps triggers/end/precedence | `tests/contract/required-observable-conformance.test.ts`, `tests/domain/writing-result-activity.test.ts`, `tests/ui/activity-mapping.test.ts`, `tests/ui/activity-precedence.test.ts` | `DESIGN_PASS`; accepted domain/fallback behavior plus Batch C exact event-only mapping, order, precedence, deduplication, stale/evidence failure, and bounded cues pass |
| `F-2` | Domain 7.2 defines closed `BlockerKind` plus exact `BlockerOpened` contract/lifecycle; Domain 7.3 defines closed `AlertKind`, payload, dedup, actions; Domain 8.4 pins all 13 GPT package fields; Integration 10 consumes canonical kinds only | `tests/contract/blocker-alert-vocabulary.test.ts`, `tests/snapshot/gpt-package.test.ts`, later notification tests | `DESIGN_PASS`; Batch A contracts/snapshots implemented at code commit; notification integration deferred |
| `F-3` | UI 3.4 fixes Korean hierarchy, all 16 status labels, nine alert labels, six alert actions, 16 blocker labels/fallback, two distinct progress labels, and `labelKo` preservation | `tests/domain/manifest.test.ts`, `tests/ui/korean-vocabulary.test.ts`, `tests/ui/dashboard.component.test.tsx` | `DESIGN_PASS`; Batch A preserves source `labelKo`; Batch B renders hierarchy/status/blocker/freshness/progress plus reviewed R-1 locale entries; inbox alert actions remain Batch D |

## 5. Batch and Review Coverage

| Stage | Canonical scope | Required independent gate | Evidence status now |
|---|---|---|---|
| Candidate design | Exact seven files in this index | Fable5 Level 3 `DESIGN_REVIEW` over exact commit | Delta `DESIGN_REVIEW: PASS` over `82821afe48b08f70b6888e3ebf12dee3095cd2bb`, recorded in foundation-docs `6c9d94f31ae5dd5424b511afb68188681ff95349` |
| Batch A | Domain contract, manifest, state machines, single-writer store, projections | Prior design PASS; Advisor batch acceptance | Code/config/tests `7edc8f79bedb059ab6697e64ddaf57fbebde2c87`; 15 files/36 tests plus lint/typecheck/build/audit pass; Advisor verdict `PASS__BATCH_A_ACCEPTED_AS_BATCH_B_DEPENDENCY` |
| Batch B | Read-only adapters and base dashboard | Batch A dependency/evidence accepted | Code/config/tests/assets `85e66d856e33a0df73041cb4b33aba30a8f9f96d`; 23 files/84 tests, lint/typecheck/build/audit/diff and read-only smoke pass; Advisor verdict `PASS__BATCH_B_ACCEPTED_AS_BATCH_C_DEPENDENCY` |
| Batch C | Structured-event office scene/responsive accessibility | Batch B dependency/evidence accepted | Code/config/tests/assets `e30a6cda52e14a4bf30b2d1b7445fa26645496e5`; 27 Vitest files/123 tests and 10 Playwright tests, lint/typecheck/build/audit/diff/boundary/axe/visual/layout pass; pending Advisor acceptance |
| Batch D | Advisor Inbox, alerts, GPT package, TmuxAdvisorGateway, acknowledgement/resume | Batch C dependency/evidence accepted; transport profile gate | `NOT_IMPLEMENTED` |
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

### 6.1 Batch C divergence classification

- `DOCUMENTATION_STALE`: Batch B-pending and Batch C-not-implemented statements,
  future scene/asset/test paths, and F-1 visual evidence became stale after
  Advisor accepted Batch B and code commit
  `e30a6cda52e14a4bf30b2d1b7445fa26645496e5` landed; this docs commit corrects
  only materially affected canonical rows and `README.md`.
- `DEFERRED_WITH_GATE`: Batch D-E, private-network, real-auth, remote-host/Mac,
  Hermes, DB, public, production/live, backup/restore, server/SSE/PWA, inbox,
  gateway, and remote collector capabilities remain at named gates.
- `CODE_DEFECT`: none known after the passing 123-test Vitest and 10-test
  Playwright Batch C verification.
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

## 8. Batch C Closure Checklist

- the seven canonical design documents remain owned only by Agent Office;
- independent design PASS evidence is referenced without claiming implementation
  review or final approval;
- Batch A/B acceptance and Batch C implementation paths/tests/code/assets commit
  are exact, while Batch D-E paths remain explicitly unimplemented;
- the approved 15-WorkUnit source bytes, path, source commit, hash, labels,
  dependencies, and current facts are preserved;
- all required Batch A/B regression and Batch C unit/browser/visual/accessibility
  paths plus lint/typecheck/build/audit/diff/boundary gates pass;
- only a static read-only base UI, local observation subset, and structured-event
  scene were created; no server, PWA, gateway, DB, secret, auth action, remote collector,
  network exposure, production/live operation, Hermes implementation, or role
  dispatch exists; and
- Batch C remains pending Advisor acceptance; Batch D or another mission does not
  start automatically.
