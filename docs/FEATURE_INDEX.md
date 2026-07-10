# Agent Office M01 Feature and Traceability Index

Status: `CANDIDATE__NOT_IMPLEMENTED__PENDING_FABLE5_DESIGN_REVIEW`

Mission: `AGENT_OFFICE_M01_ADVISOR_MANAGED_OFFICE_WEB_CONTROL_PLANE`

This is the canonical discoverability and material-requirement traceability index
for the M01 candidate package. It is not an implementation inventory and does not
claim a Fable5 verdict or final approval.

## 1. Current Implemented Scope

Implemented today: bootstrap only, commit
`937f0c5f92cd3b39d81796c13bc00b4afe3407fb`.

That commit contains only:

- `.gitignore`
- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `docs/agent/RESULT_REPORTING_PROTOCOL.md`
- `docs/agent/RUN_PROTOCOL.md`

There is no application source, package manifest, scaffold, server, browser UI,
PWA, event store, data, DB, adapter, gateway, asset, test, auth implementation,
secret, deployment, or runtime. All implementation and test paths below are exact
future targets and currently `NOT_IMPLEMENTED`.

## 2. Canonical Candidate Documents

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
| `DESIGNED_CANDIDATE` | Specified here; not implemented; pending Fable5 design review |
| `DESIGNED_FOR_EXTENSION` | Interface/invariant reserved; only local subset may be in M01 |
| `DEFERRED_WITH_GATE` | Explicitly disabled until named authority/review gate |
| `OUT_OF_SCOPE` | Not part of M01; requires a new mission, not a toggle |

Every `CURRENT_EVIDENCE` value beginning with `NOT_IMPLEMENTED` is honest design
evidence only. A document section is not proof that behavior exists.

## 4. Material Requirement Traceability

| DESIGN_REQUIREMENT | IMPLEMENTATION_PATH | TEST_PATH | CURRENT_EVIDENCE | STATUS | DEFERRED_GATE |
|---|---|---|---|---|---|
| AO-REQ-001 Purpose, audience, operations focus, non-goals | `src/ui/`, `src/server/` | `tests/acceptance/product-boundary.test.ts` | `NOT_IMPLEMENTED`; [Master Sections 1-3](architecture/AGENT_OFFICE_MASTER_DESIGN.md#1-purpose-and-audience) | `DESIGNED_CANDIDATE` | Fable5 design PASS |
| AO-REQ-002 Actor authority and source-of-truth precedence | `src/domain/authority/`, `src/application/evidence/` | `tests/domain/authority-precedence.test.ts` | `NOT_IMPLEMENTED`; [Master Section 4](architecture/AGENT_OFFICE_MASTER_DESIGN.md#4-authority-and-source-of-truth-precedence) | `DESIGNED_CANDIDATE` | Batch A; canonical V2 remains external authority |
| AO-REQ-003 Responsive private PWA and quiet UI | `src/ui/`, `src/pwa/` | `tests/e2e/responsive-pwa.spec.ts` | `NOT_IMPLEMENTED`; [Master Section 8](architecture/AGENT_OFFICE_MASTER_DESIGN.md#8-browser-and-real-time-product-surface), [UI Sections 1-3](ui/AGENT_OFFICE_UI_ANIMATION_MAPPING.md#1-experience-principles) | `DESIGNED_CANDIDATE` | Batches B/E |
| AO-REQ-004 Initiative -> Package -> Mission -> Phase -> WorkUnit with fixed Korean hierarchy labels | `src/domain/manifest/`, `src/ui/missions/`, `src/ui/i18n/` | `tests/domain/hierarchy.test.ts`, `tests/ui/korean-vocabulary.test.ts` | `NOT_IMPLEMENTED`; [Domain Section 3](contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md#3-versioned-mission-manifest), [UI 3.4](ui/AGENT_OFFICE_UI_ANIMATION_MAPPING.md#34-canonical-korean-user-facing-vocabulary) | `DESIGNED_CANDIDATE` | Batch A/B |
| AO-REQ-005 Versioned denominator and exact scope accounting | `src/domain/manifest/`, `src/application/projections/` | `tests/property/scope-counting.test.ts` | `NOT_IMPLEMENTED`; [Master Section 5](architecture/AGENT_OFFICE_MASTER_DESIGN.md#5-domain-hierarchy-and-counting), [Domain 3.3](contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md#33-scope-change-contract) | `DESIGNED_CANDIDATE` | Batch A; authority artifact required |
| AO-REQ-006 Durable WorkUnit states/transitions/dependencies plus exact 16-name primary/activity conformance | `src/domain/state-machines/work-unit.ts`, `src/domain/activity/` | `tests/property/work-unit-transitions.test.ts`, `tests/contract/required-observable-conformance.test.ts` | `NOT_IMPLEMENTED`; [Domain Sections 6.1-6.3](contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md#6-workunit-state-machine), [UI Sections 3.4-6](ui/AGENT_OFFICE_UI_ANIMATION_MAPPING.md#34-canonical-korean-user-facing-vocabulary) | `DESIGNED_CANDIDATE` | Batch A/C |
| AO-REQ-007 Message states and immutable Advisor flow | `src/domain/state-machines/message.ts`, `src/application/advisor-inbox/` | `tests/integration/advisor-message-flow.test.ts` | `NOT_IMPLEMENTED`; [Domain 7.1 and 8](contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md#71-advisor-message) | `DESIGNED_CANDIDATE` | Batch D |
| AO-REQ-008 Typed BlockerKind, exact BlockerOpened fields/lifecycle/resume proof, and Korean labels | `src/domain/blockers/`, `src/domain/state-machines/blocker.ts`, `src/ui/i18n/` | `tests/domain/blocker-resume.test.ts`, `tests/contract/blocker-alert-vocabulary.test.ts` | `NOT_IMPLEMENTED`; [Domain 7.2 and 8.5](contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md#72-blocker), [UI 3.4](ui/AGENT_OFFICE_UI_ANIMATION_MAPPING.md#34-canonical-korean-user-facing-vocabulary) | `DESIGNED_CANDIDATE` | Batch A/D |
| AO-REQ-009 Typed AlertKind, deterministic payload/dedup, lifecycle, actions, and Korean labels | `src/domain/alerts/`, `src/ui/alerts/`, `src/ui/i18n/` | `tests/domain/alert-state.test.ts`, `tests/contract/alert-notification-vocabulary.test.ts`, `tests/e2e/alerts.spec.ts` | `NOT_IMPLEMENTED`; [Domain 7.3](contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md#73-alert), [UI 3.4](ui/AGENT_OFFICE_UI_ANIMATION_MAPPING.md#34-canonical-korean-user-facing-vocabulary) | `DESIGNED_CANDIDATE` | Batch A/D/E |
| AO-REQ-010 Decision states, exact deterministic GPT package fields, application | `src/domain/decisions/`, `src/application/decision-packages/` | `tests/domain/decision-flow.test.ts`, `tests/snapshot/gpt-package.test.ts` | `NOT_IMPLEMENTED`; [Domain 7.4 and 8.4-8.5](contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md#74-decision) | `DESIGNED_CANDIDATE` | Batch D; Leo/GPT authority when required |
| AO-REQ-011 Notification states/idempotency using canonical AlertKind/dedup | `src/application/notifications/` | `tests/integration/notification-recovery.test.ts`, `tests/contract/alert-notification-vocabulary.test.ts` | `NOT_IMPLEMENTED`; [Domain 7.3/7.5](contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md#73-alert), [Integration 10](integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md#10-notification-and-alert-integration) | `DESIGNED_CANDIDATE` | Batch D |
| AO-REQ-012 Event transition validation and stable rejection | `src/domain/commands/`, `src/application/command-service/` | `tests/property/transition-matrix.test.ts` | `NOT_IMPLEMENTED`; [Domain Section 9](contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md#9-command-validation-and-invalid-transitions) | `DESIGNED_CANDIDATE` | Batch A |
| AO-REQ-013 UTC timestamps, stream/host sequence, clock quality | `src/domain/time/`, `src/application/hosts/` | `tests/domain/time-ordering.test.ts` | `NOT_IMPLEMENTED`; [Domain 2.3](contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md#23-time), [Integration 9](integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md#9-clock-ordering-offline-and-reconnect) | `DESIGNED_CANDIDATE` | Local Batch A/B; remote gated |
| AO-REQ-014 Request idempotency, ordering, causal links | `src/domain/events/`, `src/application/idempotency/` | `tests/property/idempotency-ordering.test.ts` | `NOT_IMPLEMENTED`; [Domain Section 10](contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md#10-idempotency-ordering-and-causality) | `DESIGNED_CANDIDATE` | Batch A/D |
| AO-REQ-015 Append-only hash-chained audit history | `src/persistence/file-store/`, `src/application/audit/` | `tests/persistence/hash-chain.test.ts`, `tests/security/audit-redaction.test.ts` | `NOT_IMPLEMENTED`; [Domain Section 4](contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md#4-event-envelope), [Security 13](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md#13-audit-and-redaction) | `DESIGNED_CANDIDATE` | Batch A/E |
| AO-REQ-016 Deterministic projections and rebuild equivalence | `src/application/projections/` | `tests/persistence/replay-equivalence.test.ts` | `NOT_IMPLEMENTED`; [Domain Section 11](contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md#11-deterministic-projection-contract) | `DESIGNED_CANDIDATE` | Batch A |
| AO-REQ-017 Evidence-backed completion and review routing | `src/application/evidence/`, `src/domain/completion/` | `tests/domain/completion-policy.test.ts` | `NOT_IMPLEMENTED`; [Domain Section 12](contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md#12-evidence-and-completion-contract) | `DESIGNED_CANDIDATE` | Batches A-D and Fable5 gates |
| AO-REQ-018 Immutable message requestId/hash/receipt | `src/application/advisor-inbox/`, `src/persistence/artifacts/` | `tests/integration/message-crash-idempotency.test.ts` | `NOT_IMPLEMENTED`; [Domain 8.1-8.2](contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md#81-browser-command) | `DESIGNED_CANDIDATE` | Batch D |
| AO-REQ-019 Advisor acknowledgement/intake/decision/resume chain | `src/application/advisor-inbox/`, `src/domain/decisions/` | `tests/e2e/advisor-decision-resume.spec.ts` | `NOT_IMPLEMENTED`; [Domain 8.3-8.5](contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md#83-canonical-advisor-intake) | `DESIGNED_CANDIDATE` | Batch D; canonical decision authority |
| AO-REQ-020 No browser-to-Worker/Reviewer route | `src/server/routes/`, `src/adapters/gateways/` | `tests/security/no-role-dispatch.test.ts` | `NOT_IMPLEMENTED`; [Security Sections 3 and 8](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md#8-browser-api-allowlist) | `DESIGNED_CANDIDATE` | Batches D/E |
| AO-REQ-021 No arbitrary terminal/command surface | `src/server/routes/`, `src/adapters/process/` | `tests/security/no-command-surface.test.ts` | `NOT_IMPLEMENTED`; [Security Sections 8 and 11](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md#11-filesystem-and-adapter-security) | `DESIGNED_CANDIDATE` | Batches B/D/E |
| AO-REQ-022 TmuxAdvisorGateway fixed Advisor-only delivery | `src/adapters/gateways/tmux-advisor/` | `tests/integration/tmux-advisor-gateway.test.ts` | `NOT_IMPLEMENTED`; [Integration Sections 3-4](integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md#3-advisorgateway-contract) | `DESIGNED_CANDIDATE` | Batch D and approved transport capability/profile |
| AO-REQ-023 HermesAdvisorGateway interface/stub only | `src/adapters/gateways/hermes/` | `tests/adapters/hermes-disabled.test.ts` | `NOT_IMPLEMENTED`; [Integration Section 5](integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md#5-hermesadvisorgateway-stub) | `DEFERRED_WITH_GATE` | Separate Leo/GPT Hermes mission |
| AO-REQ-024 Read-only tmux observation, no prose inference | `src/adapters/observations/tmux/` | `tests/adapters/tmux-readonly.test.ts`, `tests/ui/no-prose-inference.test.ts` | `NOT_IMPLEMENTED`; [Integration 6.4](integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md#64-tmuxobservationsource) | `DESIGNED_CANDIDATE` | Batch B |
| AO-REQ-025 Read-only Git and immutable artifact contracts | `src/adapters/observations/git/`, `src/adapters/observations/artifacts/` | `tests/adapters/read-only-boundaries.test.ts` | `NOT_IMPLEMENTED`; [Integration 6.2-6.3](integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md#62-gitobservationsource) | `DESIGNED_CANDIDATE` | Batch B |
| AO-REQ-026 Transport authority reference/kill switch/manual fallback | `src/adapters/gateways/tmux-advisor/`, `src/ui/inbox/` | `tests/integration/kill-switch-fallback.test.ts` | `NOT_IMPLEMENTED`; [Integration 4.2-4.4](integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md#42-authority-dependency-not-duplication), [Security 14](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md#14-kill-switch-disable-and-manual-fallback) | `DESIGNED_CANDIDATE` | Batch D; authority remains canonical V2/transport files |
| AO-REQ-027 Loopback private default/fail-closed non-loopback | `src/server/network/` | `tests/security/bind-policy.test.ts` | `NOT_IMPLEMENTED`; [Security Section 5](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md#5-network-exposure-modes) | `DESIGNED_CANDIDATE` | Batch E |
| AO-REQ-028 Auth/session design without embedded real secret | `src/server/auth/` | `tests/security/auth-session.test.ts` | `NOT_IMPLEMENTED`; [Security Section 6](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md#6-authentication-design-without-embedded-secrets) | `DESIGNED_CANDIDATE` | Batch E; real-secret use separately authorized |
| AO-REQ-029 CSRF/origin/Host/CORS/cookie controls | `src/server/security/` | `tests/security/http-boundary.test.ts` | `NOT_IMPLEMENTED`; [Security Section 7](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md#7-csrf-origin-and-browser-request-controls) | `DESIGNED_CANDIDATE` | Batch E |
| AO-REQ-030 Rate limits, body bounds, output/content safety | `src/server/security/`, `src/ui/content/` | `tests/security/rate-input-xss.test.ts` | `NOT_IMPLEMENTED`; [Security Sections 9-10](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md#9-input-output-and-content-safety) | `DESIGNED_CANDIDATE` | Batch E |
| AO-REQ-031 PWA cache confidentiality/offline read-only | `src/pwa/` | `tests/e2e/pwa-cache-security.spec.ts` | `NOT_IMPLEMENTED`; [Security Section 15](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md#15-pwa-and-offline-security) | `DESIGNED_CANDIDATE` | Batch E |
| AO-REQ-032 Tailscale/private-network plan disabled by default | `src/server/network/private-network/` | `tests/security/private-network-disabled.test.ts` | `NOT_IMPLEMENTED`; [Security 5.2](security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md#52-private_network_gated-designed-disabled) | `DEFERRED_WITH_GATE` | Leo/GPT approval, threat review, credentials/TLS, Fable5 review |
| AO-REQ-033 Multi-project registry and root isolation | `src/application/projects/` | `tests/integration/multi-project-isolation.test.ts` | `NOT_IMPLEMENTED`; [Integration Section 7](integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md#7-multi-project-topology) | `DESIGNED_CANDIDATE` | Batch B |
| AO-REQ-034 Linux server/future Mac host topology and trust | `src/adapters/hosts/` | `tests/contract/host-observation.test.ts` | `NOT_IMPLEMENTED`; [Integration Sections 7-8](integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md#8-host-identity-and-trust) | `DEFERRED_WITH_GATE` | Remote-host/private-network/key mission; Mac host approval |
| AO-REQ-035 Host clock/offline/reconnect/gap/stale evidence | `src/application/hosts/` | `tests/integration/host-reconnect.test.ts` | `NOT_IMPLEMENTED`; [Integration Section 9](integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md#9-clock-ordering-offline-and-reconnect) | `DESIGNED_FOR_EXTENSION` | Local freshness Batch B; remote collectors gated |
| AO-REQ-036 Structured activity and exact observable mapping: dispatching/reading/working/testing/writing-result/returning-result/reviewing/block/wait/recovery | `src/ui/scene/`, `src/domain/activity/` | `tests/ui/activity-mapping.test.ts`, `tests/domain/writing-result-activity.test.ts`, `tests/contract/required-observable-conformance.test.ts` | `NOT_IMPLEMENTED`; [Domain 6.3/13](contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md#63-required-observable-name-conformance), [UI Section 5](ui/AGENT_OFFICE_UI_ANIMATION_MAPPING.md#5-structured-event-to-animation-mapping) | `DESIGNED_CANDIDATE` | Batch C |
| AO-REQ-037 Animation precedence, dedup, bounded motion | `src/ui/scene/` | `tests/ui/activity-precedence.test.ts` | `NOT_IMPLEMENTED`; [UI Sections 6-7](ui/AGENT_OFFICE_UI_ANIMATION_MAPPING.md#6-visual-precedence-and-concurrency) | `DESIGNED_CANDIDATE` | Batch C |
| AO-REQ-038 Accessibility and reduced motion | `src/ui/a11y/`, `src/ui/scene/` | `tests/e2e/accessibility.spec.ts` | `NOT_IMPLEMENTED`; [UI Section 8](ui/AGENT_OFFICE_UI_ANIMATION_MAPPING.md#8-reduced-motion-and-accessibility) | `DESIGNED_CANDIDATE` | Batch C/E |
| AO-REQ-039 Local visual asset/icon/license strategy | `src/ui/assets/`, `src/ui/scene/asset-registry.ts` | `tests/ui/assets-layout.test.ts` | `NOT_IMPLEMENTED`; [UI Section 9](ui/AGENT_OFFICE_UI_ANIMATION_MAPPING.md#9-color-icon-and-asset-strategy) | `DESIGNED_CANDIDATE` | Batch C; exact assets/licenses reviewed |
| AO-REQ-040 Desktop/mobile stable dimensions, overflow, Korean expansion, and no silent translation | `src/ui/layout/`, `src/ui/i18n/` | `tests/e2e/responsive-overflow.spec.ts`, `tests/ui/korean-vocabulary.test.ts` | `NOT_IMPLEMENTED`; [UI Sections 3.4 and 10-11](ui/AGENT_OFFICE_UI_ANIMATION_MAPPING.md#34-canonical-korean-user-facing-vocabulary) | `DESIGNED_CANDIDATE` | Batch B/C/E |
| AO-REQ-041 PWA installability/update/offline UX | `src/pwa/`, `src/ui/pwa/` | `tests/e2e/pwa-lifecycle.spec.ts` | `NOT_IMPLEMENTED`; [UI Section 14](ui/AGENT_OFFICE_UI_ANIMATION_MAPPING.md#14-pwa-install-offline-and-update-ux) | `DESIGNED_CANDIDATE` | Batch E |
| AO-REQ-042 SSE over WebSocket with cursor/reset | `src/server/sse/`, `src/ui/live/` | `tests/integration/sse-reconnect.test.ts` | `NOT_IMPLEMENTED`; [Master 8.2](architecture/AGENT_OFFICE_MASTER_DESIGN.md#82-sse-decision) | `DESIGNED_CANDIDATE` | Batch E; WebSocket needs new reviewed decision |
| AO-REQ-043 Single-writer JSONL/artifact/projection crash consistency | `src/persistence/file-store/` | `tests/recovery/crash-consistency.test.ts` | `NOT_IMPLEMENTED`; [Operations Sections 3-7](operations/AGENT_OFFICE_OPERATIONS_RECOVERY.md#3-state-root-requirements) | `DESIGNED_CANDIDATE` | Batch A |
| AO-REQ-044 Corruption quarantine and stale/conflict behavior | `src/persistence/quarantine/`, `src/application/freshness/` | `tests/recovery/corruption-quarantine.test.ts` | `NOT_IMPLEMENTED`; [Operations Sections 8-10](operations/AGENT_OFFICE_OPERATIONS_RECOVERY.md#8-corruption-detection-and-quarantine) | `DESIGNED_CANDIDATE` | Batch A/E |
| AO-REQ-045 Backup and isolated restore | `src/operations/backup/`, `src/operations/restore/` | `tests/recovery/backup-restore.test.ts` | `NOT_IMPLEMENTED`; [Operations Sections 11-12](operations/AGENT_OFFICE_OPERATIONS_RECOVERY.md#11-backup-design) | `DESIGNED_CANDIDATE` | Batch E; off-host/encryption separately gated |
| AO-REQ-046 Application rollback and disable strategy | `src/operations/`, `src/application/startup/` | `tests/recovery/rollback-disable.test.ts` | `NOT_IMPLEMENTED`; [Operations Sections 13-14](operations/AGENT_OFFICE_OPERATIONS_RECOVERY.md#13-application-rollback-and-data-compatibility) | `DESIGNED_CANDIDATE` | Batch E; no Git/deployment authority implied |
| AO-REQ-047 Evidence-bearing proof of recovery | `src/operations/evidence/` | `tests/recovery/recovery-result.test.ts` | `NOT_IMPLEMENTED`; [Operations Section 16](operations/AGENT_OFFICE_OPERATIONS_RECOVERY.md#16-proof-of-recovery) | `DESIGNED_CANDIDATE` | Batch E and Advisor audit |
| AO-REQ-048 Batch A-E dependencies, acceptance tests, reviews | future batch paths named throughout package | `tests/acceptance/batch-gates.test.ts` | `NOT_IMPLEMENTED`; [Master Section 11](architecture/AGENT_OFFICE_MASTER_DESIGN.md#11-batch-a-e-release-plan) | `DESIGNED_CANDIDATE` | Fable5 design PASS then exact Advisor handoff per batch |
| AO-REQ-049 Current bootstrap truth, unknowns, limitations | documentation and future evidence projector | `tests/acceptance/current-scope.test.ts` | Bootstrap commit verified; [Master Sections 2 and 12](architecture/AGENT_OFFICE_MASTER_DESIGN.md#2-current-truth-and-candidate-boundary) | `IMPLEMENTED_BOOTSTRAP_ONLY` | Update only from reviewed as-built evidence |
| AO-REQ-050 No DB/public/prod/Hermes implementation/automatic next mission | module/import/route/build policy | `tests/acceptance/forbidden-scope.test.ts` | `NOT_IMPLEMENTED`; fixed design prohibition in all candidates | `OUT_OF_SCOPE` | New explicit Leo/GPT mission where applicable; Hermes separately gated |

### 4.1 Fable5 F-1/F-2/F-3 rework anchors

| Finding | Exact canonical closure | Reproduction test path | Current status |
|---|---|---|---|
| `F-1` | Domain 6.3 maps all 16 exact required observable names across durable primary state plus structured activity; Domain 13 adds `WRITING_RESULT`; UI 5-6 maps triggers/end/precedence | `tests/contract/required-observable-conformance.test.ts`, `tests/domain/writing-result-activity.test.ts`, `tests/ui/activity-mapping.test.ts` | `DESIGNED_CANDIDATE__PENDING_FABLE5_DELTA_REREVIEW` |
| `F-2` | Domain 7.2 defines closed `BlockerKind` plus exact `BlockerOpened` contract/lifecycle; Domain 7.3 defines closed `AlertKind`, payload, dedup, actions; Domain 8.4 pins all 13 GPT package fields; Integration 10 consumes canonical kinds only | `tests/contract/blocker-alert-vocabulary.test.ts`, `tests/contract/alert-notification-vocabulary.test.ts`, `tests/snapshot/gpt-package.test.ts` | `DESIGNED_CANDIDATE__PENDING_FABLE5_DELTA_REREVIEW` |
| `F-3` | UI 3.4 fixes Korean hierarchy, all 16 status labels, nine alert labels, six alert actions, 16 blocker labels/fallback, two distinct progress labels, and `labelKo` preservation | `tests/ui/korean-vocabulary.test.ts` | `DESIGNED_CANDIDATE__PENDING_FABLE5_DELTA_REREVIEW` |

## 5. Batch and Review Coverage

| Stage | Canonical scope | Required independent gate | Evidence status now |
|---|---|---|---|
| Candidate design | Exact seven files in this index | Fable5 Level 3 `DESIGN_REVIEW` over exact commit | `NEEDS_PATCH` at `fedf716`; F-1/F-2/F-3 document delta authored, pending independent delta re-review |
| Batch A | Domain contract, manifest, state machines, single-writer store, projections | Prior design PASS; Advisor batch acceptance | `NOT_IMPLEMENTED` |
| Batch B | Read-only adapters and base dashboard | Batch A dependency/evidence accepted | `NOT_IMPLEMENTED` |
| Batch C | Structured-event office scene/responsive accessibility | Batch B dependency/evidence accepted | `NOT_IMPLEMENTED` |
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

## 8. Closure Checklist for This Design WorkUnit

- exactly the seven candidate files exist and no canonical mirror exists in
  foundation-docs;
- all seven say candidate/not implemented/pending Fable5 review;
- every material handoff requirement has a row above or a directly linked local
  trace row;
- future implementation/test paths are exact but do not exist yet;
- current evidence is honest about bootstrap-only scope;
- no source, package, scaffold, test, asset, runtime, DB, secret, auth action,
  external exposure, production/live, Hermes implementation, or role dispatch was
  created;
- exact commit/push and Worker result return to Advisor; and
- only Advisor may route the independent Fable5 design review.
