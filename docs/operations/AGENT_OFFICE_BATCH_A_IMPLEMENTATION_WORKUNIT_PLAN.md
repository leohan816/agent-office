# Agent Office Batch A — Implementation WorkUnit Plan

Status: `CONTROL_MASTER_DESIGN_PLAN__REWORKED_THROUGH_S4_AND_ADVISOR_T2__PENDING_INDEPENDENT_SENTINEL_THIRD_DELTA_REREVIEW` (T2: literal baseline dir + `scripts/local-office-rehearsal.mjs` exact, no deferral)

★Source paths are a **closed enumeration** (no globs). Any path not named per WorkUnit returns to Advisor for a handoff amendment before editing.

Mode: `CONTROL_MASTER_DESIGN_MODE`. Companion to the integration design delta and the identity/organization contract. Base `ac8ba75`. Reworked per Advisor validation `15_ADVISOR_CONTROL_DESIGN_VALIDATION.md` (CD-1..CD-7).

★This plan is a design artifact. It grants **no implementation authority**. The Worker (`agent-office-opus`, Opus 4.8 Ultracode, `/fable-builder`) implements only after Advisor validates this design and publishes the exact Worker handoff. The independent reviewer is the authorized **independent Sentinel** (`foundation-reviewer-sol`, currently GPT-5.6 SOL xhigh); Fable5 is a possible secondary/fallback runtime only (CD-1). No agents/sub-agents. No file-wide suppression or inaccurate test totals. Exact-path staging, non-force push, then stop.

## 1. Dependency order (Founder item 14)

```
BA-WU-01 shell + Office-first-by-default nav + eager-shell isolation
   |-> BA-WU-02 local/static organization registry (src/application/organization/) + identity/binding separation
   |       |-> BA-WU-03 first-layer actor summary + separated state vocabularies
   |       |       |-> BA-WU-04 second-layer accessible actor drawer (complete field contract)
   |       |-> BA-WU-05 role-specific symbolic surfaces
   |-> BA-WU-06 Channy + modern-office integration
BA-WU-03..06 -> BA-WU-07 responsive/a11y/fallback/regression integration
BA-WU-07 -> BA-WU-08 local-run tooling + current visual evidence + docs
BA-WU-08 -> BA-WU-09 Worker result + exact Git evidence
```

Serialize dependent units. The organization registry/projection (WU-02) precedes any summary/drawer/surface consuming it. WU-07 integrates only after the surfaces exist. WU-08 rehearses only after WU-07 is green.

## 2. WorkUnits

Each unit lists intent, primary source scope (pending exact handoff; aligned to impl plan §6.2), tests, per-unit gate, and rollback. Source scope is bounded by delta §9 required/forbidden areas.

### BA-WU-01 — Application shell, Office-first-by-default navigation, eager-shell isolation
- Intent: new Application Shell in the authenticated runtime client; Office surface **default primary** (no `surface=` in the real app; CD-2); Dashboard/comm/control/evidence secondary behind keyboard-reachable navigation; degradation chain wired; **eager-shell isolation** so the eager shell + fallback graph never import/execute Pixi (CD-3). (items 1, 2, 3)
- Source (exact; no broad `src/ui/*`): `src/ui/runtime/runtime-app.tsx`, `src/ui/runtime/client.ts`, `src/ui/dashboard.tsx`, `src/ui/spatial/compatibility.ts` (selector `PIXEL_FULL`/`PIXEL_RESTRAINED`/`DOM_STATIC`/`M1_FIXED_STATIONS`), additive `livingOffice` field in `src/runtime/projection.ts`, `vite.config.ts` (lazy Office chunk only), and the conditional `src/pwa/cache-policy.ts`/`public/sw.js`/`src/server/http/static-shell.ts` **only if** emitted renderer files require them (same-origin hashed chunk + atomic cache-version bump; impl plan §6.2). Any file beyond this list requires an exact Advisor handoff amendment.
- Tests: shell/nav unit + ui; secondary-view reachability; composition test; **bundle chunk-separation acceptance** (`tests/acceptance/production-spatial-bundle-boundary.test.ts`, `tests/acceptance/production-pixel-prototype-boundary.test.ts`) proving no eager Pixi + fixture-marker rejection.
- Gate: lint/type clean; Office-first default; secondary views reachable; no deletion; eager-shell isolation verified.
- Rollback: remove shell + additive projection field; in-app rollback is a presentation selection to static/M1.

### BA-WU-02 — Local/static organization registry + identity/binding separation
- Intent: **new committed** `src/application/organization/` registry; `roleInstanceId`-stable identity vs mutable bindings; provenance + evidence timestamp/status per row; no auto refresh, no time-only freshness; fail-closed `UNASSIGNED`; single derived frame source. (items 6, 7; CD-6, CD-7)
- Source (exact): `src/application/organization/index.ts`, `types.ts`, `registry.ts`, `evidence.ts`, `projector.ts`, and the committed fixture `fixtures/organization-registry.ts` (reuse `spatial-office/` projector/validation patterns). (A) identity/org registry + allowed-token metadata; (B) accepted-evidence records; projector computes changing facts + full-outer join on `roleInstanceId` (contract §2.5/§3).
- Tests: identity persists across binding change (incl. `sessionName` replacement, no re-key); `UNASSIGNED` cannot receive work; single-source-of-truth (no second store); provenance + evidence-status on every row; no time-only freshness inference.
- Gate: contract tests green; no live discovery; no inference path; changes are reviewed-commit only.
- Rollback: remove module + fixture; no consumer if WU-03+ not merged.

### BA-WU-03 — Compact actor summaries and separated state vocabularies (P1/P2)
- Intent: first-layer label card = contract §2.7 compact subset (`role` glyph+ring · `stableDisplayName` · `sessionProcess` · `aiIdentity` · `model` · `effort` · `aiRuntimeState` · `operationalState`, each with `source` tag; text+glyph+ring); separated closed vocabularies with one sentinel each (contract §2.3, incl. `SESSION_PROCESS_UNKNOWN`); `operationalState` = `PixelOperationalState` as a **total function of the projector output** `projectRequiredObservable(...)` (contract §2.4), never a raw-state shortcut. (items 4, 8; CD-4, P1, P2, R1, R2)
- Source (exact): `src/ui/pixel/living-office-hud.tsx`, `src/ui/pixel/actor-sprite.tsx` (label overlay).
- Tests: per-field sentinel coverage (`SESSION_PROCESS_UNKNOWN`/`SESSION_OFFLINE`/`NO_AI_PROCESS`/`AI_PROCESS_DETECTED`/`AI_IDENTITY_UNKNOWN`/`MODEL_UNKNOWN`/`EFFORT_UNKNOWN`/`AI_READY`/`AI_WORKING`/`AI_WAITING`/`AI_ERROR`/`AI_RUNTIME_UNKNOWN`/`UNASSIGNED`); each §2.3 non-sentinel value requires its exact named accepted fact/cue; missing process evidence → `SESSION_PROCESS_UNKNOWN` (never `SESSION_OFFLINE`); the `ObservableProjectionName`(16+`UNKNOWN_OR_STALE`)→`PixelOperationalState` map is exhaustive with default `UNKNOWN`; a bare `RUNNING`/`HOLD`/`WAITING_ADVISOR` with no compatible accepted activity displays `UNKNOWN`; literal `UNKNOWN` only on free-text fields; non-color-only encoding; label tracking under focus/zoom/route.
- Gate: ui + snapshot; no name/proximity inference; runtime-state not conflated with work state.
- Rollback: revert label integration; drawer/summary independent.

### BA-WU-04 — Accessible actor detail drawer (complete field contract) (P3)
- Intent: second-layer dialog implementing the **complete ordered field contract** of contract §2.7 (17 fields: `roleInstanceId`·`role`·`project`·`stableDisplayName`·`advisorTeam`·`reportsToAdvisor`·`assignedBy`·`returnsResultTo`·`sessionName`·`sessionProcess`·`aiIdentity`·`model`·`effort`·`aiRuntimeState`·`operationalState`·`mission`·`workUnit`), each rendering `value`+`source`(UPPER_SNAKE)+`status`; `role="dialog"`, Escape, Tab containment, close-button focus on open, invoker focus restore; semantic/static parity. (item 5; CD-5, P3)
- Source: `src/ui/pixel/living-office-detail-drawer.tsx` (reuse existing drawer).
- Tests: the contract §2.7 drawer test matrix (per field × {non-failure, sentinel, provenance rendered, status rendered}); keyboard/focus/Escape/Tab; semantic/static parity.
- Gate: accessibility ui tests green (WCAG A/AA); complete-field + envelope coverage.
- Rollback: revert drawer integration.

### BA-WU-05 — Role-specific symbolic surfaces
- Intent: symbolic facility/work surfaces; no terminal/source/private content. (item 9)
- Source (exact): `src/ui/pixel/facility-sprites.tsx` and the exact existing placeholder assets `src/ui/pixel/assets/office-world-atlas.source.ts`, `atlas-builder.ts`, `atlas-manifest.ts`, `palette.ts`, `ASSET_INVENTORY.md` (no new external asset; delta §9 asset list).
- Tests: content-safety (no terminal/source/path/credential); no authority/live-state; scene-source boundary.
- Gate: security/content-safety tests green.
- Rollback: revert surface integration.

### BA-WU-06 — Channy and modern-office integration
- Intent: integrate eight-state Bedlington Channy + modern light palette in the real shell; `authorityRole: none`, non-operational boundary unchanged. (item 10)
- Source (exact): `src/ui/pixel/channy-sprite.tsx`, `src/ui/pixel/living-office.css` (reuse existing timeline + palette).
- Tests: Channy sequence present; non-operational/no-authority assertion; palette applied.
- Gate: visual + unit green; non-operational boundary proven.
- Rollback: revert Channy/palette integration.

### BA-WU-07 — Responsive, accessibility, fallback, regression integration
- Intent: 200%/contrast/keyboard/reduced-motion/static + mobile navigation; static semantic Office and M1 fixed-station fallback proven in the integrated shell; full regression. (item 11)
- Source (exact): `src/ui/pixel/living-office-semantic-mirror.tsx`, `src/ui/spatial/compatibility.ts`, `src/ui/runtime/runtime-app.tsx` (responsive/fallback wiring); tests `tests/ui/authenticated-spatial-compatibility.test.ts`, `tests/ui/authenticated-spatial-surface.test.tsx`, `tests/recovery/spatial-presentation-rollback.test.ts`, `tests/integration/runtime-composition.test.ts`.
- Tests: responsive/a11y/reduced-motion/static parity; degradation chain; full vitest + e2e with accurate totals.
- Gate: `test:ui`, `test:security`, `test:authority`, `test:composition`, e2e green; historical baselines byte-identical unless authorized delta.
- Rollback: revert responsive/fallback wiring.

### BA-WU-08 — Local run tooling, current visual evidence, documentation
- Intent: one documented start/open/verify/stop procedure rehearsed on loopback; current visual evidence; docs. (items 1, 11, 15)
- Source (exact): `scripts/runtime-smoke.mjs` (reuse) and one new script at the exact path `scripts/local-office-rehearsal.mjs`; plus the four Batch A documentation paths. No config change beyond the lazy Office chunk isolation (no eager Pixi; fixture markers stay rejected). Any path not on this list returns to Advisor before edit.
- Tests/checks: `npm run dev`/`preview`/`start:loopback` + `smoke:runtime`; `npm run check`; direct visual inspection.
- Gate: local rehearsal succeeds on `127.0.0.1`; `check` green.
- Rollback: revert tooling/doc additions.

### BA-WU-09 — Worker result and exact Git evidence
- Intent: durable evidence-bearing Worker result + exact Git evidence; return to Advisor. (item 17)
- Source (exact): `/home/leo/Project/foundation-docs/runs/agent-office/20260712_agent_office_batch_a_modern_office_identity_completion_001/WORKER_RESULT.md` and pointer `/home/leo/Project/foundation-docs/advisor/jobs/20260712_agent_office_batch_a_modern_office_identity_completion_001/12_WORKER_RESULT_POINTER.md` (Worker pass).
- Gate: evidence-bearing completion package per V2 §5 / repo `RESULT_REPORTING_PROTOCOL.md`; exact-path staging; non-force push.
- Rollback: n/a (evidence only).

## 3. Gate set (Founder item 15)

- **Static**: `npm run lint`, `npm run typecheck` clean; no file-wide suppression; strict rules unchanged.
- **Unit/contract/snapshot/property**: `npm test` (+ focused) green with accurate totals.
- **Integration/security/authority/composition/recovery/pwa**: green; zero authority expansion; LOOPBACK_PRIVATE + protected-cue clearing proven.
- **Bundle isolation (CD-3)**: `tests/acceptance/production-spatial-bundle-boundary.test.ts` + `tests/acceptance/production-pixel-prototype-boundary.test.ts` prove eager-shell/fallback graph imports/executes no Pixi; Pixi only in a separately emitted lazy Office chunk; prototype fixture markers rejected; no eager renderer startup.
- **Full-integration failure & PWA matrix (P4, impl plan §6.4/§6.5)**: production PWA first-online/cached-reload/offline-after-cache/offline-before-pixel-cache DOM fallback; both-backend failure, lazy chunk/import/init failure, atlas/hash failure, semantic divergence, context loss/restore, performance fallback, user-static; invalid/stale/conflict/critical/logout/expiry/revocation/restart/source-mismatch → exact rollback checkpoint (`DOM_STATIC`/`M1_FIXED_STATIONS`), no retry/replay, cues/camera/textures cleared; complete teardown + memory evidence; historical baseline hashes unchanged. A generic "pwa green" label is insufficient.
- **UI/accessibility**: `test:ui` + browser specs; keyboard/focus/Escape/Tab; 200%/contrast/reduced-motion/static parity; mobile nav.
- **Visual**: living-office baselines captured + directly inspected; historical baselines byte-identical unless authorized delta.
- **Performance**: renderer startup/active-frame/camera p95 within inherited local budgets; zero long tasks > 50ms; retained-heap non-growth.
- **Local rehearsal**: documented start/open/verify/stop on loopback; `npm run check` green.
- **Independent review**: clean independent-Sentinel `DESIGN_REVIEW` then `IMPLEMENTATION_REVIEW` routed by Advisor; no self-review.

## 4. Rollback and failure isolation (Founder item 16)

- Whole batch reverts by discarding branch `batch-a/modern-office-identity-001`; `ac8ba75` untouched.
- In-app rollback is an immediate presentation selection (Office → static semantic Office → M1), not a Git/data/runtime rollback.
- Each WorkUnit is independently revertible; a failed Office surface degrades to static/M1 without blocking secondary views.
- No DB/schema/migration/secret/remote/production state is touched; nothing to un-migrate.
- Eager-shell isolation preserved: the eager shell + fallback graph stay Pixi-free; prototype fixture markers stay rejected.

## 5. Exact implementation completion criteria (Founder item 17)

Batch A is complete only when **all** hold:

1. all 17 Founder items are implemented and traceable to source + tests;
2. Office surface is the authenticated **default** primary experience on loopback (no `surface=` in the real app); all secondary views preserved and reachable;
3. identity/organization contract enforced (`roleInstanceId`-stable identity vs mutable bindings; separated AI-runtime vs operational-work vocabularies; complete detail field contract; fail-closed `UNASSIGNED`/`UNKNOWN`; provenance + evidence status; no inference);
4. single validated frame source (no second truth model); local/static organization registry committed under `src/application/organization/`;
5. eager-shell isolation verified (no eager Pixi; lazy Office chunk; fixture markers rejected);
6. full gate set (§3) green with accurate totals; no weakened rules or file-wide suppression;
7. security/authority/PWA/delivery/M1 fallback preserved unchanged; zero authority expansion; historical baselines byte-identical unless authorized delta;
8. one documented start/open/verify/stop procedure rehearsed directly on `127.0.0.1`;
9. Batch B–E untouched;
10. evidence-bearing Worker completion package + exact Git evidence returned to Advisor;
11. independent-Sentinel implementation review `PASS`, then Advisor audit, then Leo/GPT final approval.

★Completion is proven by actual source/diff/test output/branch/commit evidence and independent review — not by narrative. Worker does not self-approve or select the next mission.
