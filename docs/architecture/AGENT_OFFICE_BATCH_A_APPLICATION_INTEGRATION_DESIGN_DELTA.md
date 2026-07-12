# Agent Office Batch A — Application Integration Design Delta

Status: `CONTROL_MASTER_DESIGN_DELTA__PENDING_ADVISOR_VALIDATION_AND_FABLE5_DESIGN_REVIEW`

Mode: `CONTROL_MASTER_DESIGN_MODE` (design coordination only; no runtime implementation, no independent review, no final approval).

Author actor: Control (foundation-control session).
Decision owner / final approver: Leo/GPT. Field manager / mission auditor: Advisor. Independent reviewer: Fable5 (`foundation-reviewer-sol`).

## 0. Anchor and provenance

- Mission: `AGENT_OFFICE_BATCH_A_MODERN_OFFICE_IDENTITY_COMPLETION_001` (`00_INTAKE.md` = `PROCEED_WITH_LIMITS`).
- Source Advisor job: `../foundation-docs/advisor/jobs/20260712_agent_office_batch_a_modern_office_identity_completion_001`.
- Exact implementation base: `ac8ba75d3a128385beaeeac58ae5bf54c03d23f2` on `batch-a/modern-office-identity-001` (isolated worktree, clean, upstream equal to `origin`).
- Corrected brief (17 items authoritative): `02_CONTROL_DESIGN_BRIEF.md` at correction commit `99e3e4109fd8d77cf64e58d3892541a4dacad947`.
- This is an **integration delta**. It does not re-derive accepted M1/M1.2 foundations. It reuses the reviewed living pixel-office candidate, `AO12-D` authenticated projection, security/authority model, exact Advisor delivery, PWA, and static/M1 fallback unchanged.
- ★No implementation, package/config/source/test/media change is authorized in this pass. Batch B–E is out of scope.

## 1. Product outcome (bounded)

Produce an actually runnable **loopback/private** Agent Office in which the reviewed living pixel office is the **primary application experience** inside the real authenticated shell, and the existing Dashboard, communication, control, and evidence surfaces remain **secondary** (moved behind navigation, never deleted). Batch A uses a **local/static registry projection**; it does not implement live tmux/process/model discovery. Every M1/M1.2 security, authority, delivery, PWA, and fallback boundary is preserved.

## 2. Architecture / component map

### 2.1 Current (as-built at `ac8ba75`, read directly)

- Real app entry: `index.html` → `src/ui/main.tsx` (authenticated shell / runtime client).
- Runtime projection (one truth build): `src/runtime/projection.ts` builds `sceneRoles` (M1 authoritative surface) plus optional `spatialOffice` via `authenticatedSpatialPresentation({...})` (`src/application/spatial-office/authenticated-projection.ts`, `AO12-D`). It clears protected cues on stop/logout/expiry/revocation and selects static or M1 on degradation/schema failure.
- Living pixel renderer: reachable **only** from the synthetic test-demo router `src/ui/demo-entry.tsx` under exact `surface=living-pixel-prototype`, which lazy-imports `src/ui/pixel/prototype-entry.tsx`; on import failure it renders a `role="alert"` fallback and the static M1 surface remains available. Default demo path renders `Dashboard`.
- Renderer stack (isolated test-demo only): React `19.2.7` lazy + `@pixi/react` `8.0.5` + PixiJS `8.19.0`, WebGL preferred, tested Canvas fallback, DOM/M1 always available. A fresh production bundle contains **zero** Pixi or prototype markers.
- Frame projector: `normalizeActorFact` maps null/undefined/non-object/`UNVERIFIED`-source/blank to `PIXEL_ACTOR_UNKNOWN`; state must be a `SYNTHETIC_FIXTURE`-sourced member of a closed 14-value enum else `UNKNOWN`; facts flow only from explicit inputs (no project/pod/position/proximity/prose inference path).

### 2.2 Batch A target composition (delta)

```
authenticated runtime client (src/ui/main.tsx)
  -> runtime projection (src/runtime/projection.ts)              [one validated frame source]
       sceneRoles (M1 authoritative) + spatialOffice (AO12-D) + livingOffice (Batch A projection, additive)
  -> Application Shell (Batch A, new)                            [Office-first navigation]
       primary route  : LivingOffice surface (lazy renderer composition)
                          Pixi visual world  (WebGL -> Canvas -> static)  [visual world only]
                          DOM overlay layer   (labels, drawer, semantic mirror, HUD)  [navigation/labels/detail/fallback]
       secondary routes: Dashboard, Communication, Control/Evidence, Advisor delivery (preserved, behind nav)
       fallback path   : reduced-motion -> static semantic mirror -> M1 fixed-station view
```

- The Application Shell composes the renderer **lazily** (React lazy + capability probe). Pixi remains the **visual world**; DOM remains **navigation, compact labels, detail drawer, semantic mirror, reduced/static fallback, and the secondary control surface** — never the second source of truth.
- One validated frame/projection source only: the Batch A `livingOffice` projection is a **derived view of the same runtime projection** used by `sceneRoles`/`spatialOffice`. No second truth model, no parallel fact store.
- Production bundle discipline is preserved: the living renderer is loaded through the same isolation the prototype uses; a non-selected production build must still contain zero Pixi/prototype markers unless a later batch explicitly promotes it. (See §12 unknown U-3 on the exact isolation the Worker must reuse.)

## 3. Data contract (see companion `AGENT_OFFICE_BATCH_A_IDENTITY_ORGANIZATION_CONTRACT.md`)

- **Immutable ten-field actor fact model** (verified from the drawer/overlay): `role`, `project`, `advisorTeam`, `reportsToAdvisor`, `sessionName`, `model`, `state`, `mission`, `workUnit`, `evidenceFreshness`.
- **Source discriminator** per fact: `verifiedRegistryFact` | `verifiedMissionArtifactFact` | `canonicalFixture` | `syntheticFixture` | `unverified`. Labels/drawer carry per-fact `data-actor-fact-source` attribution.
- **Fail-closed**: any missing/null/malformed/unverified value normalizes to literal `UNKNOWN` (`PIXEL_ACTOR_UNKNOWN`). Only mission-proven models render non-`UNKNOWN`.
- **No inference**: runtime/model/effort/state are never inferred from names, position, timestamps, attached state, proximity, or terminal prose.

## 4. State model

- **Operational-state vocabulary**: the closed 14-value state enum inherited from the frame projector; any non-member or non-`SYNTHETIC_FIXTURE`/registry-sourced value → `UNKNOWN`. Batch A completes the required vocabulary coverage **without** adding a live-discovery path.
- **Surface capability state machine** (renderer lifecycle, inherited): `WebGL` → (context loss / unsupported) `Canvas` → (renderer failure / reduced-motion / schema failure) `static semantic mirror` → `M1 fixed-station view`. Every downgrade is deterministic and observable; protected cues are cleared on stop/logout/expiry/revocation.
- **Channy state sequence**: the existing slow eased eight-state Bedlington sequence (`walk/stop/sniff/sit/eat/drink/sleep/play`) with `authorityRole: none`; integrated unchanged, ambient/non-operational.

## 5. Routes / navigation

- **Primary**: Office-first. The default authenticated view is the Living Office surface. Item hierarchy favors the office world; technical/control data is secondary.
- **Secondary (preserved, behind clear navigation, never deleted)**: Dashboard (technical), Communication center, Control/Evidence/Advisor-inbox surfaces, Advisor delivery. These retain their current contracts.
- **Fallback structure**: reduced-motion and non-WebGL users receive the static semantic mirror; schema/degradation failures fall to the unchanged M1 fixed-station view. Keyboard navigation reaches every secondary view and the actor drawer.
- Navigation selection is UI-local; it never changes authority, session target, or capability. Proximity/selection never grants authority.

## 6. Organization model (see companion contract)

- Every active actor belongs to **exactly one responsible Advisor Team** or is `UNASSIGNED` and cannot receive work.
- `FOUNDATION_ADVISOR_TEAM`: Foundation Advisor, Control, Foundation Worker, Cosmile Worker, SIASIU Worker, Agent Office Worker, and the assigned independent Reviewer.
- `VIBENEWS_ADVISOR_TEAM`: exists only with a valid responsible Advisor plus its assigned Worker, Designer, and Reviewer.
- **Stable identity is independent from mutable Team/Advisor assignment and `reportsTo` relationship.** Identity persists; assignment can change without changing identity.
- One character per active `Advisor roleInstanceId`; never clone an active instance. Proximity never creates authority.

## 7. The 17 Founder-requested items — design resolution (authoritative list from `02_CONTROL_DESIGN_BRIEF.md`)

| # | Founder item | Batch A design resolution | Primary WorkUnit |
|---|---|---|---|
| 1 | Living Pixel Office becomes the real private/local app shell | Promote reviewed renderer into the authenticated runtime client via a new Application Shell; loopback/private only | BA-WU-01 |
| 2 | Primary Office route + preserved secondary technical/control views | Office-first default route; Dashboard/comm/control/evidence moved behind navigation, not deleted | BA-WU-01 |
| 3 | Navigation and fallback structure | Keyboard-reachable nav; reduced-motion→static→M1 fallback chain | BA-WU-01, BA-WU-07 |
| 4 | First-layer actor summary contract | Compact label card: role glyph+ring, role/model/session/state, source tag; text+glyph+ring (never color alone) | BA-WU-03 |
| 5 | Second-layer actor detail-drawer contract | Ten-field accessible dialog with per-fact source attribution, focus management | BA-WU-04 |
| 6 | Stable identity vs mutable Team/Advisor assignment | Identity/assignment separation in registry contract | BA-WU-02 |
| 7 | Local/static registry schema + source-of-truth rules | Fail-closed local/static registry projection; single derived frame source | BA-WU-02 |
| 8 | Truthful `UNKNOWN` and operational-state model | Literal `UNKNOWN`, closed 14-value enum, no inference | BA-WU-03 |
| 9 | Role-specific symbolic work-surface contracts | Symbolic facility surfaces only; no terminal/source/private content | BA-WU-05 |
| 10 | Channy presentation + explicit non-operational boundary | Integrate eight-state sequence, `authorityRole: none`, ambient only | BA-WU-06 |
| 11 | Responsive/keyboard/accessibility/reduced-motion/static | 200%/contrast/keyboard/reduced-motion/static + mobile navigation | BA-WU-07 |
| 12 | Exact Batch A/B/C/D/E boundaries | §11 exclusion; Batch A = integration + local/static registry only | this doc §11 |
| 13 | Required + forbidden source areas | §9 proposed source scope | this doc §9 |
| 14 | Internal WorkUnits + dependency order | Companion WorkUnit plan (BA-WU-01..09) | ops plan |
| 15 | Test/browser/visual/accessibility/performance/local-rehearsal gates | §10 acceptance gates | this doc §10 |
| 16 | Rollback and failure isolation | §12 rollback; per-WU isolation | this doc §12 |
| 17 | Exact implementation completion criteria | Companion WorkUnit plan completion criteria + §10 gates | ops plan |

★A per-item current-evidence/gap matrix is consolidated in the requirement matrix (§8), tracing each item to its state at `ac8ba75` and the exact Batch A gap.

## 8. Requirement matrix (17 items → current evidence at `ac8ba75` → Batch A gap)

| # | Current evidence at `ac8ba75` | Batch A gap |
|---|---|---|
| 1 | Living renderer reachable only under synthetic `surface=living-pixel-prototype` | Compose into authenticated runtime client as primary shell |
| 2 | Dashboard/spatial/comm surfaces exist and dominate hierarchy | Office-first primary + secondary navigation; zero deletion |
| 3 | Prototype has static/M1 fallback; lazy import alert fallback | Integrated nav + full fallback chain in real shell |
| 4 | Overlay label card verified in 13 baselines | Extend to all required fields + integrated/static/mobile modes |
| 5 | Ten-field drawer with keyboard/focus tests | Integrate stable identity, Team, reports-to, evidence source/freshness |
| 6 | Spatial projection has assignment invariants | Explicit identity-vs-assignment separation contract |
| 7 | Fact projection is explicit-input, fail-closed | Local/static registry schema + source-of-truth + fail-closed `UNASSIGNED` |
| 8 | `normalizeActorFact`→`UNKNOWN`; 14-value enum | Complete vocabulary without live discovery or name inference |
| 9 | Spatial/pixel world has role/facility assets | Safe symbolic contracts; no terminal/source/private content |
| 10 | Eight-state Bedlington sequence exists | Integrate with non-operational boundary unchanged |
| 11 | Prototype/spatial baselines cover mobile/reduced/static | Prove integrated shell nav/labels/drawer at 200%/contrast/keyboard |
| 12 | Batch scope defined per M1.2 docs | Fix exact Batch A/B–E line for this integration |
| 13 | Source areas exist across `src/ui`, `src/application`, `src/runtime` | Name required + forbidden areas precisely |
| 14 | Advisor brief lists BA-WU-01..09 | Refine WorkUnits + dependency order |
| 15 | vitest/playwright suites + budgets exist | Define integrated gate set + local rehearsal |
| 16 | Prototype isolation + M1 fallback exist | Per-WU rollback + failure isolation |
| 17 | Worker brief fixes constraints | Explicit completion criteria |

## 9. Proposed source scope

**Required source areas (Worker may change, pending exact handoff):**

- `src/ui/` — new Application Shell + Office-first navigation, label/drawer integration, secondary-view routing, semantic/static fallback wiring (reuse existing `src/ui/pixel/`, `src/ui/spatial/`, `src/ui/dashboard`, `src/ui/communication`).
- `src/application/` — Batch A local/static registry projection + organization/identity projector (new module under `src/application/`; reuse `spatial-office/` projector/validation patterns).
- `src/runtime/projection.ts` — additive `livingOffice` projection field (mirrors the additive `spatialOffice` pattern; no removal of `sceneRoles`).
- `tests/` — new/updated unit, contract, snapshot, ui, security, and e2e tests for the above (Worker pass only).
- `scripts/` + docs — local-run rehearsal tooling and evidence docs (BA-WU-08).

**Forbidden source areas (must not change in Batch A):**

- authentication/session, exact Advisor delivery, transport/tmux, PWA, security/authority modules, and the M1 fixed-station fallback contract — preserve unchanged.
- `package.json`/lockfile/config/build in a way that promotes Pixi into the default production bundle beyond the reviewed isolation.
- any DB/schema/migration, secret/credential/env, remote/public exposure, protected branch, `main`.
- excluded historical `.grok/`, `grok-max`, `grokx`, `grokx-max` and any Grok code — no reuse/copy/adaptation.
- Batch B–E surfaces (live discovery, multi-Advisor rendering beyond the single active instance, private-network mode, production activation).

## 10. Acceptance gates

- **Static**: `npm run lint`, `npm run typecheck` clean; no file-wide suppression; no weakened strict rules.
- **Unit/contract/snapshot**: vitest suites green with accurate totals; new identity/registry/organization + shell tests added.
- **Security/authority**: `test:security`, `test:authority`, `test:composition` green; zero authority expansion; LOOPBACK_PRIVATE preserved; protected-cue clearing on stop/logout/expiry/revocation proven.
- **UI/accessibility**: `test:ui` + browser specs; keyboard/focus/Escape/Tab-containment for drawer; 200% zoom, contrast, reduced-motion, static parity; mobile navigation.
- **Visual**: living-office baselines captured and directly inspected; historical baselines byte-identical unless an authorized delta; production bundle zero-Pixi-marker check.
- **Performance**: renderer startup/active-frame/camera p95 within the inherited local budgets; zero long tasks > 50ms; retained-heap non-growth over mount/unmount cycles.
- **Local rehearsal**: one documented start/open/verify/stop procedure (`npm run dev`/`preview`/`start:loopback` + `smoke:runtime`) rehearsed directly by the Worker on loopback; `npm run check` passes.

## 11. Explicit Batch B–E exclusion

Batch A is **integration + local/static registry projection only**. Out of scope and forbidden this pass: live tmux/process/model discovery; real credential creation or the real port-`4317` private run activation; private-network/Tailscale mode; multi-Advisor rendering beyond the single active `roleInstanceId`; production/live deployment; any authority/transport expansion; Hermes; and any Batch B, C, D, or E work. No gate may be skipped because a prior batch had a similar shape.

## 12. Rollback, failure isolation, and unknowns

**Rollback / failure isolation:**

- The branch `batch-a/modern-office-identity-001` is isolated; the whole batch reverts by discarding the branch or reverting its commits — `ac8ba75` remains the untouched base.
- Each WorkUnit is independently revertible; the Office surface degrades to static/M1 without blocking secondary views.
- No protected data, DB, or remote state is touched; nothing to un-migrate.

**Unknowns / open questions for Advisor (not resolvable inside this design pass):**

- **U-1**: exact required coverage of the 14-value operational-state enum for the integrated shell (which members are in-scope for Batch A vs deferred).
- **U-2**: whether the integrated Office shell is selected by an authenticated runtime capability (not a `surface=` demo param), and the exact default-vs-opt-in policy for the first private run — this is a product/policy choice reserved to Leo/GPT via Advisor.
- **U-3**: the exact production-bundle isolation mechanism the Worker must reuse so a default build still contains zero Pixi/prototype markers while the authenticated shell can load the renderer.
- **U-4**: exact local/static registry fixture source and its refresh/staleness policy (Batch A is static; no live discovery).

Control does not resolve product policy, authority, or these unknowns; they return to Advisor and, where they are product/authority decisions, to Leo/GPT. Companion documents: identity/organization contract and WorkUnit plan.
