# Agent Office Batch A — Implementation WorkUnit Plan

Status: `CONTROL_MASTER_DESIGN_PLAN__PENDING_ADVISOR_VALIDATION_AND_FABLE5_DESIGN_REVIEW`

Mode: `CONTROL_MASTER_DESIGN_MODE`. Companion to the integration design delta and the identity/organization contract. Base `ac8ba75`.

★This plan is a design artifact. It grants **no implementation authority**. The Worker (`agent-office-opus`, Opus 4.8 Ultracode, `/fable-builder`) implements only after Advisor validates this design and publishes the exact Worker handoff. No agents/sub-agents. No file-wide suppression or inaccurate test totals. Exact-path staging, non-force push, then stop.

## 1. Dependency order (Founder item 14)

```
BA-WU-01 shell + Office-first nav
   |-> BA-WU-02 local/static registry + organization/identity projection
   |       |-> BA-WU-03 first-layer actor summary + truthful state vocabulary
   |       |       |-> BA-WU-04 second-layer accessible actor drawer
   |       |-> BA-WU-05 role-specific symbolic surfaces
   |-> BA-WU-06 Channy + modern-office integration
BA-WU-03..06 -> BA-WU-07 responsive/a11y/fallback/regression integration
BA-WU-07 -> BA-WU-08 local-run tooling + current visual evidence + docs
BA-WU-08 -> BA-WU-09 Worker result + exact Git evidence
```

Serialize dependent units. The registry/projection (WU-02) precedes any summary/drawer/surface consuming it. WU-07 integrates only after the surfaces exist. WU-08 rehearses only after WU-07 is green.

## 2. WorkUnits

Each unit lists intent, primary source scope (pending exact handoff), tests, per-unit gate, and rollback. All source scope is bounded by the delta §9 required/forbidden areas.

### BA-WU-01 — Application shell and Office-first navigation
- Intent: new Application Shell in the authenticated runtime client; Office surface primary; Dashboard/comm/control/evidence secondary behind keyboard-reachable navigation; fallback chain wired. (items 1, 2, 3)
- Source: `src/ui/` (shell + nav), additive `livingOffice` field in `src/runtime/projection.ts`.
- Tests: shell/nav unit + ui tests; secondary-view reachability; composition test unchanged-green.
- Gate: lint/type clean; secondary views reachable; no deletion of existing surfaces; production-bundle isolation preserved (U-3).
- Rollback: remove shell + additive projection field; runtime reverts to current selection.

### BA-WU-02 — Local/static registry and organization projection
- Intent: local/static registry fixture + organization/identity projector; identity-vs-assignment separation; fail-closed `UNASSIGNED`; single derived frame source. (items 6, 7)
- Source: new module under `src/application/` (reuse `spatial-office/` projector/validation patterns); fixtures under `fixtures/`.
- Tests: identity persistence across assignment change; `UNASSIGNED` cannot receive work; single-source-of-truth (no second store); provenance on every row.
- Gate: contract tests green; no live discovery; no inference path.
- Rollback: remove module + fixture; no consumer if WU-03+ not merged.

### BA-WU-03 — Compact actor summaries and truthful state vocabulary
- Intent: first-layer label card (role glyph+ring, role/model/session/state, source tag; text+glyph+ring); complete 14-value state vocabulary coverage; literal `UNKNOWN`. (items 4, 8)
- Source: `src/ui/` (label/overlay integration reusing `src/ui/pixel/` overlay).
- Tests: label field coverage; `UNKNOWN` fail-closed; non-color-only encoding; label tracking under focus/zoom/route.
- Gate: ui + snapshot tests; no name/proximity inference.
- Rollback: revert label integration; drawer/summary independent.

### BA-WU-04 — Accessible actor detail drawer
- Intent: second-layer ten-field dialog with per-fact source attribution; `role="dialog"`, Escape, Tab containment, close-button focus on open, invoker focus restore; semantic/static parity. (item 5)
- Source: `src/ui/` (drawer reusing existing prototype drawer).
- Tests: keyboard/focus/Escape/Tab; ten-field coverage; semantic/static parity; source attribution present.
- Gate: accessibility ui tests green (WCAG A/AA).
- Rollback: revert drawer integration.

### BA-WU-05 — Role-specific symbolic surfaces
- Intent: symbolic facility/work surfaces; no terminal/source/private content. (item 9)
- Source: `src/ui/` (symbolic assets/placeholders; reuse existing spatial/pixel facility assets).
- Tests: symbolic-surface content safety (no terminal/source/path/credential); no authority/live-state.
- Gate: security/content-safety tests green.
- Rollback: revert surface integration.

### BA-WU-06 — Channy and modern-office integration
- Intent: integrate eight-state Bedlington Channy and modern light palette in the real shell; `authorityRole: none`, non-operational boundary unchanged. (item 10)
- Source: `src/ui/` (reuse existing Channy timeline + palette).
- Tests: Channy sequence present; non-operational/no-authority assertion; palette applied.
- Gate: visual + unit green; non-operational boundary proven.
- Rollback: revert Channy/palette integration.

### BA-WU-07 — Responsive, accessibility, fallback, regression integration
- Intent: 200%/contrast/keyboard/reduced-motion/static + mobile navigation; static semantic mirror and M1 fixed-station fallback proven in the integrated shell; full regression. (item 11)
- Source: `src/ui/` responsive/fallback wiring; `tests/` integration.
- Tests: responsive/a11y/reduced-motion/static parity; M1 fallback; full vitest + e2e regression with accurate totals.
- Gate: `test:ui`, `test:security`, `test:authority`, `test:composition`, e2e green; historical baselines byte-identical unless authorized delta.
- Rollback: revert responsive/fallback wiring.

### BA-WU-08 — Local run tooling, current visual evidence, documentation
- Intent: one documented start/open/verify/stop procedure rehearsed on loopback; current visual evidence; docs. (items 1, 11, 15)
- Source: `scripts/` + docs (evidence); no config change that promotes Pixi into default production bundle.
- Tests/checks: `npm run dev`/`preview`/`start:loopback` + `smoke:runtime`; `npm run check`; direct visual inspection of captured evidence.
- Gate: local rehearsal succeeds on `127.0.0.1`; `check` green.
- Rollback: revert tooling/doc additions.

### BA-WU-09 — Worker result and exact Git evidence
- Intent: durable Worker result + exact Git evidence; return to Advisor. (item 17)
- Source: `../foundation-docs/runs/agent-office/20260712_.../WORKER_RESULT.md` + pointer `12_WORKER_RESULT_POINTER.md` (foundation-docs, Worker pass).
- Gate: evidence-bearing completion package per V2 §5; exact-path staging; non-force push.
- Rollback: n/a (evidence only).

## 3. Gate set (Founder item 15)

- **Static**: `npm run lint`, `npm run typecheck` clean; no file-wide suppression; strict rules unchanged.
- **Unit/contract/snapshot/property**: `npm test` (and focused `test:unit`/`test:property`) green with accurate totals.
- **Integration/security/authority/composition**: `test:integration`, `test:security`, `test:authority`, `test:composition`, `test:recovery`, `test:pwa` green; zero authority expansion; LOOPBACK_PRIVATE + protected-cue clearing proven.
- **UI/accessibility**: `test:ui` + browser specs; keyboard/focus/Escape/Tab; 200%/contrast/reduced-motion/static parity; mobile nav.
- **Visual**: living-office baselines captured + directly inspected; historical baselines byte-identical unless an authorized delta; production bundle zero-Pixi-marker check.
- **Performance**: renderer startup/active-frame/camera p95 within inherited local budgets; zero long tasks > 50ms; retained-heap non-growth over mount/unmount cycles.
- **Local rehearsal**: documented start/open/verify/stop on loopback; `npm run check` green.

## 4. Rollback and failure isolation (Founder item 16)

- Whole batch reverts by discarding branch `batch-a/modern-office-identity-001`; `ac8ba75` untouched.
- Each WorkUnit is independently revertible; a failed Office surface degrades to static/M1 without blocking secondary views.
- No DB/schema/migration/secret/remote/production state is touched; nothing to un-migrate.
- Prototype/production isolation preserved: a default production build stays zero-Pixi-marker.

## 5. Exact implementation completion criteria (Founder item 17)

Batch A is complete only when **all** hold:

1. all 17 Founder items are implemented and traceable to source + tests;
2. Office surface is the authenticated primary experience on loopback; all secondary views preserved and reachable;
3. identity/organization contract enforced (identity vs assignment, fail-closed `UNASSIGNED`/`UNKNOWN`, provenance, no inference);
4. single validated frame source (no second truth model);
5. full gate set (§3) green with accurate totals; no weakened rules or file-wide suppression;
6. security/authority/PWA/delivery/M1 fallback preserved unchanged; zero authority expansion; historical baselines byte-identical unless authorized delta;
7. one documented start/open/verify/stop procedure rehearsed directly on `127.0.0.1`;
8. Batch B–E untouched;
9. evidence-bearing Worker completion package + exact Git evidence returned to Advisor;
10. independent Fable5 implementation review `PASS`, then Advisor audit, then Leo/GPT final approval.

★Completion is proven by actual source/diff/test output/branch/commit evidence and independent review — not by narrative. Worker does not self-approve or select the next mission.
