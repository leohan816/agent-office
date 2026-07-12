# Agent Office Batch A — Application Integration Design Delta

Status: `CONTROL_MASTER_DESIGN_DELTA__REWORKED_CD_1_TO_CD_8__PENDING_ADVISOR_VALIDATION_AND_INDEPENDENT_SENTINEL_DESIGN_REVIEW`

Mode: `CONTROL_MASTER_DESIGN_MODE` (design coordination only; no runtime implementation, no independent review, no final approval).

Author actor: Control (foundation-control session).
Decision owner / final approver: Leo/GPT. Field manager / mission auditor: Advisor. Independent reviewer: the authorized **independent Sentinel** in `foundation-reviewer-sol` (currently GPT-5.6 SOL xhigh); Fable5 is a possible secondary/fallback review runtime only. Model names are evidence, not authority (master design §4 authority-vs-data precedence).

## 0. Anchor and provenance

- Mission: `AGENT_OFFICE_BATCH_A_MODERN_OFFICE_IDENTITY_COMPLETION_001` (`00_INTAKE.md` = `PROCEED_WITH_LIMITS`).
- Source Advisor job: `../foundation-docs/advisor/jobs/20260712_agent_office_batch_a_modern_office_identity_completion_001`.
- Exact implementation base: `ac8ba75d3a128385beaeeac58ae5bf54c03d23f2` on `batch-a/modern-office-identity-001` (isolated worktree, clean, upstream equal to `origin`).
- Corrected brief (17 items authoritative): `02_CONTROL_DESIGN_BRIEF.md` at `99e3e4109fd8d77cf64e58d3892541a4dacad947`.
- Rework driver: Advisor validation `15_ADVISOR_CONTROL_DESIGN_VALIDATION.md` (`NEEDS_IN_SCOPE_CONTROL_DESIGN_PATCH`, findings CD-1..CD-8). This revision patches CD-1..CD-8 without a new Founder decision. See §13 for per-finding closure.
- This is an **integration delta**. It does not re-derive accepted M1/M1.2 foundations. It reuses the reviewed living pixel-office candidate, the `AO12-D` authenticated projection and cue reducer, the security/authority model, exact Advisor delivery, PWA, and static/M1 fallback unchanged. The canonical full-integration surfaces and behavior in `AGENT_OFFICE_M1_2_LIVING_PIXEL_OFFICE_IMPLEMENTATION_PLAN.md` §6.2/§6.3 are the alignment source for source scope and isolation.
- ★No implementation, package/config/source/test/media change is authorized in this pass. Batch B–E is out of scope.

## 1. Product outcome (bounded)

Produce an actually runnable **loopback/private** Agent Office in which the reviewed living pixel office is the **primary application experience** inside the real authenticated shell **by default** (Founder-decided; CD-2), and the existing Dashboard, communication, control, and evidence surfaces remain **secondary** (moved behind navigation, never deleted). Batch A uses a **local/static organization registry projection**; it does not implement live tmux/process/model discovery. Every M1/M1.2 security, authority, delivery, PWA, and fallback boundary is preserved.

## 2. Architecture / component map

### 2.1 Current (as-built at `ac8ba75`, read directly)

- Real app entry: `index.html` → `src/ui/main.tsx` (authenticated runtime client).
- Runtime projection (one truth build): `src/runtime/projection.ts` builds `sceneRoles` (M1 authoritative) plus optional `spatialOffice` via `authenticatedSpatialPresentation({...})` (`src/application/spatial-office/authenticated-projection.ts`, `AO12-D`). It clears protected cues on stop/logout/expiry/revocation and selects static or M1 on degradation/schema failure. The existing authenticated projection and cue reducer are the **only** data source (impl plan §6.2/§6.3).
- Living pixel renderer today: reachable **only** from the synthetic test-demo router `src/ui/demo-entry.tsx` under exact `surface=living-pixel-prototype`, which lazy-imports `src/ui/pixel/prototype-entry.tsx`; on import failure it renders a `role="alert"` fallback and the static M1 surface remains available. That `surface=` demo path is test-demo-only and **is not used in the real app** (CD-2).
- Renderer stack: React `19.2.7` lazy + `@pixi/react` `8.0.5` + PixiJS `8.19.0`, WebGL preferred, tested Canvas fallback, DOM/M1 always available.
- Frame projector: `normalizeActorFact` maps null/undefined/non-object/`UNVERIFIED`-source/blank to `PIXEL_ACTOR_UNKNOWN`; a state must be a `SYNTHETIC_FIXTURE`/registry-sourced member of its closed enum else `UNKNOWN`; facts flow only from explicit inputs (no project/pod/position/proximity/prose inference path).

### 2.2 Batch A target composition (delta)

```
authenticated runtime client (src/ui/main.tsx -> src/ui/runtime/runtime-app.tsx, client.ts)
  -> runtime projection (src/runtime/projection.ts)              [one validated frame source]
       sceneRoles (M1 authoritative) + spatialOffice (AO12-D) + livingOffice (Batch A, additive derived view)
  -> Application Shell (Batch A, new)                            [Office-first by default]
       primary (default) : LivingOffice surface via a lazy-emitted Office renderer chunk
                             Pixi visual world (WebGL -> Canvas)  [visual world only]
                             DOM overlay layer  (labels, drawer, semantic mirror, HUD)  [navigation/labels/detail/fallback]
       secondary routes  : Dashboard, Communication, Control/Evidence, Advisor delivery (preserved, behind nav)
       degradation path  : reduced-motion / no-WebGL / schema-invalid / stale -> static semantic Office (DOM) -> M1 fixed stations
```

- **Eager-shell isolation (CD-3).** The main entry / eager shell and the non-Office fallback graph MUST NOT eagerly import or execute Pixi. Pixi is permitted **only inside a separately emitted lazy Office renderer chunk**, loaded only after an authenticated valid Office selection. The gate is **not** whole-`dist` absence of Pixi (Batch A promotes the reviewed renderer, so a built lazy chunk legitimately contains Pixi). The production bundle gate continues to **reject every synthetic AO12-B/C/prototype fixture marker** while permitting the reviewed production renderer (impl plan §6.2). Acceptance verifies chunk separation, fallback independence, and no eager renderer startup — not zero Pixi across all build output.
- Selector reuse: the compatibility selector (`src/ui/spatial/compatibility.ts`) adds `PIXEL_FULL`/`PIXEL_RESTRAINED`, retains `DOM_STATIC` and `M1_FIXED_STATIONS`; logout/expiry/revocation/restart/invalid-schema/stale/reduced-motion/context-loss/perf-failure clear pixel state and select the existing safe path. No fixture default is permitted (impl plan §6.2).
- One validated frame/projection source only: the Batch A `livingOffice` projection is a **derived view of the same runtime projection**; the Pixi world, DOM labels, drawer, semantic mirror, and static fallback all consume the same projected frame. No second truth model.
- Pixi = visual world; DOM = navigation, compact labels, detail drawer, semantic mirror, reduced/static fallback, and secondary control surface — never the second source of truth. Rollback is an immediate presentation selection, not a Git/data/runtime rollback (impl plan §6.3).

## 3. Data contract (see companion `AGENT_OFFICE_BATCH_A_IDENTITY_ORGANIZATION_CONTRACT.md`)

The companion contract is authoritative for fields. Summary of the corrected model (CD-4, CD-5, CD-6):

- **Stable identity (does not re-key on binding change):** `roleInstanceId` (stable key), plus identity attributes `role`, `project`, `stableDisplayName`.
- **Current bindings / separately-sourced facts (mutable):** `sessionName`, `advisorTeam`, `reportsToAdvisor`, `assignedBy`, `returnsResultTo`, `mission`, `workUnit`.
- **Separated AI-runtime facts (CD-4), each with its own closed vocabulary:** session/process availability, AI identity, model, effort, and AI-runtime state — distinct from the operational work-state animation enum (§4).
- **Actor detail contract (CD-5) is not frozen to the historical ten fields.** It adds `stableDisplayName`, `assignedBy`, `returnsResultTo`, AI-runtime identity, `effort`, and an explicit per-fact evidence **source** discriminator (`verifiedRegistryFact` | `verifiedMissionArtifactFact` | `canonicalFixture` | `syntheticFixture` | `unverified`).
- **Fail-closed / no inference:** missing/null/malformed/unverified → literal `UNKNOWN`; invalid assignment → `UNASSIGNED`; nothing is inferred from names, positions, timestamps, attached state, proximity, or terminal prose.

## 4. State model (CD-4: separate runtime state from operational work state)

Batch A defines **separate fields and closed vocabularies**; these are not the same enum.

1. **Session / process availability** — `SESSION_OFFLINE` | `NO_AI_PROCESS` | `AI_PROCESS_DETECTED`.
2. **AI identity** — `AI_IDENTITY_UNKNOWN` | `<verified AI identity>`.
3. **Model** — `MODEL_UNKNOWN` | `<mission-proven model>`.
4. **Effort** — `EFFORT_UNKNOWN` | `<mission-proven effort>`.
5. **AI-runtime state** — `AI_READY` | `AI_WORKING` | `AI_WAITING` | `AI_ERROR`. `AI_WORKING` requires **accepted structured work evidence**; attached state, timestamps, names, positions, proximity, and terminal prose prove none of these.
6. **Assignment** — `<responsible Advisor Team>` | `UNASSIGNED` (cannot receive work).
7. **Operational work state** — the existing structured workflow/animation vocabulary (e.g. `WORKING`/`WRITING_RESULT`/`WAITING_DEPENDENCY`/`WAITING_LEO`/`WAITING_ADVISOR`/`BLOCKED`/`HOLD`/`REVIEW_PENDING`/`COMPLETED`/`IDLE`/`UNKNOWN_OR_STALE`), sourced only from accepted structured cues. It is **not** the AI-runtime state and never substitutes for it.

Required visible values preserved (CD-4): `NO_AI_PROCESS`, `AI_PROCESS_DETECTED`, `AI_IDENTITY_UNKNOWN`, `MODEL_UNKNOWN`, `EFFORT_UNKNOWN`, `AI_READY`, `AI_WORKING`, `AI_WAITING`, `AI_ERROR`, `SESSION_OFFLINE`, `UNASSIGNED`.

- **Surface capability state machine** (renderer lifecycle, inherited): `WebGL` → (context loss / unsupported) `Canvas` → (renderer failure / reduced-motion / schema-invalid / stale) `static semantic Office (DOM)` → `M1 fixed-station view`. Every downgrade is deterministic and observable; protected cues cleared on stop/logout/expiry/revocation.
- **Channy state sequence**: the existing slow eased eight-state Bedlington sequence (`walk/stop/sniff/sit/eat/drink/sleep/play`) with `authorityRole: none`; ambient/non-operational, integrated unchanged.

## 5. Routes / navigation (CD-2: Office-first by default)

- **Primary (default):** the authenticated app opens on the Living Office surface **by default** whenever the authenticated/private projection is ready. This is Founder-decided; no new capability flag and **no `surface=` demo parameter is used in the real app**.
- **Degradation:** a missing/invalid/failed presentation degrades to the **static semantic Office (DOM)** and then to the **M1 fixed-station view** — never a blank or a demo route.
- **Secondary (preserved, behind clear keyboard-reachable navigation, never deleted):** Dashboard (technical), Communication center, Control/Evidence/Advisor-inbox surfaces, Advisor delivery — current contracts unchanged.
- Navigation selection is UI-local; it never changes authority, session target, or capability. Proximity/selection never grants authority.

## 6. Organization model (see companion contract)

- Every active actor belongs to **exactly one responsible Advisor Team** or is `UNASSIGNED` and cannot receive work.
- `FOUNDATION_ADVISOR_TEAM`: Foundation Advisor, Control, Foundation Worker, Cosmile Worker, SIASIU Worker, Agent Office Worker, and the assigned independent Reviewer.
- `VIBENEWS_ADVISOR_TEAM`: exists only with a valid responsible Advisor plus its assigned Worker, Designer, and Reviewer.
- **Stable identity (`roleInstanceId` + role + project + display name) is independent from mutable assignment** (`sessionName`, Team, reports-to, `assignedBy`, `returnsResultTo`, model, effort, mission, WorkUnit, state). A session is a current operational binding and may be replaced under explicit authority **without re-keying the actor** (CD-6).
- One character per active `Advisor roleInstanceId`; never clone an active instance. Proximity never creates authority.

## 7. The 17 Founder-requested items — design resolution (authoritative list from `02_CONTROL_DESIGN_BRIEF.md`)

| # | Founder item | Batch A design resolution | Primary WorkUnit |
|---|---|---|---|
| 1 | Living Pixel Office becomes the real private/local app shell | Promote reviewed renderer into the authenticated runtime client as the default primary surface; loopback/private only; eager-shell isolation | BA-WU-01 |
| 2 | Primary Office route + preserved secondary technical/control views | Office-first **default** (no `surface=`); Dashboard/comm/control/evidence behind nav, not deleted | BA-WU-01 |
| 3 | Navigation and fallback structure | Keyboard-reachable nav; reduced-motion/no-WebGL/schema/stale → static semantic Office → M1 | BA-WU-01, BA-WU-07 |
| 4 | First-layer actor summary contract | Compact label card: role glyph+ring, role/AI-identity/model/effort/runtime-state, source tag; text+glyph+ring (never color alone) | BA-WU-03 |
| 5 | Second-layer actor detail-drawer contract | Complete field contract (identity + bindings + AI-runtime + evidence source), not frozen to historical ten fields | BA-WU-04 |
| 6 | Stable identity vs mutable Team/Advisor assignment | `roleInstanceId` stable key; sessionName/Team/reports-to = current bindings | BA-WU-02 |
| 7 | Local/static registry schema + source-of-truth rules | Committed local/static registry under `src/application/organization/`; single derived frame source | BA-WU-02 |
| 8 | Truthful `UNKNOWN` and operational-state model | Literal `UNKNOWN`, separated closed vocabularies (§4), no inference | BA-WU-03 |
| 9 | Role-specific symbolic work-surface contracts | Symbolic facility surfaces only; no terminal/source/private content | BA-WU-05 |
| 10 | Channy presentation + explicit non-operational boundary | Eight-state sequence, `authorityRole: none`, ambient only | BA-WU-06 |
| 11 | Responsive/keyboard/accessibility/reduced-motion/static | 200%/contrast/keyboard/reduced-motion/static + mobile navigation | BA-WU-07 |
| 12 | Exact Batch A/B/C/D/E boundaries | §11 exclusion; Batch A = integration + local/static registry only | §11 |
| 13 | Required + forbidden source areas | §9 proposed source scope | §9 |
| 14 | Internal WorkUnits + dependency order | Companion WorkUnit plan (BA-WU-01..09) | ops plan |
| 15 | Test/browser/visual/accessibility/performance/local-rehearsal gates | §10 acceptance gates | §10 |
| 16 | Rollback and failure isolation | §12 rollback; per-WU isolation | §12 |
| 17 | Exact implementation completion criteria | Companion WorkUnit plan completion criteria + §10 gates | ops plan |

## 8. Requirement matrix (17 items → current evidence at `ac8ba75` → Batch A gap)

| # | Current evidence at `ac8ba75` | Batch A gap |
|---|---|---|
| 1 | Living renderer reachable only under synthetic `surface=living-pixel-prototype` | Compose into authenticated runtime client as default primary shell with eager-shell isolation |
| 2 | Dashboard/spatial/comm surfaces exist and dominate hierarchy | Office-first default + secondary navigation; zero deletion; no `surface=` in real app |
| 3 | Prototype has static/M1 fallback; lazy import alert fallback | Integrated nav + full degradation chain in real shell |
| 4 | Overlay label card verified in 13 baselines | Extend to AI-runtime fields (identity/model/effort/runtime-state) + integrated/static/mobile modes |
| 5 | Ten-field drawer with keyboard/focus tests | Complete field contract (identity/bindings/AI-runtime/evidence source); not frozen to ten fields |
| 6 | Spatial projection has assignment invariants | Explicit `roleInstanceId`-stable identity vs mutable-binding separation |
| 7 | Fact projection is explicit-input, fail-closed | Committed local/static registry (`src/application/organization/`) + source-of-truth + fail-closed `UNASSIGNED` |
| 8 | `normalizeActorFact`→`UNKNOWN` per closed enum | Separated runtime vs operational-work vocabularies (§4) without live discovery or name inference |
| 9 | Spatial/pixel world has role/facility assets | Safe symbolic contracts; no terminal/source/private content |
| 10 | Eight-state Bedlington sequence exists | Integrate with non-operational boundary unchanged |
| 11 | Prototype/spatial baselines cover mobile/reduced/static | Prove integrated shell nav/labels/drawer at 200%/contrast/keyboard |
| 12 | Batch scope defined per M1.2 docs | Fix exact Batch A/B–E line for this integration |
| 13 | Source areas exist across `src/ui`, `src/application`, `src/runtime` | Name required + forbidden areas precisely (align to impl plan §6.2) |
| 14 | Advisor brief lists BA-WU-01..09 | Refine WorkUnits + dependency order |
| 15 | vitest/playwright suites + budgets exist | Define integrated gate set + local rehearsal (incl. bundle chunk-separation) |
| 16 | Prototype isolation + M1 fallback exist | Per-WU rollback + failure isolation |
| 17 | Worker brief fixes constraints | Explicit completion criteria |

## 9. Proposed source scope (aligned to impl plan §6.2)

**Required source areas (Worker may change, pending exact handoff):**

- `src/ui/pixel/*` — reviewed renderer promoted without prototype fixtures (renderer-boundary, chunk, scene, world-camera, HUD, semantic-mirror, detail-drawer, sprites, CSS, assets).
- `src/ui/runtime/runtime-app.tsx`, `src/ui/runtime/client.ts`, `src/ui/dashboard.tsx` — authenticated selection + Office-first navigation; secondary-view routing.
- `src/ui/spatial/compatibility.ts` — selector adds `PIXEL_FULL`/`PIXEL_RESTRAINED`, retains `DOM_STATIC`/`M1_FIXED_STATIONS`.
- `src/runtime/projection.ts` — additive `livingOffice` derived-view field (mirrors additive `spatialOffice`; no removal of `sceneRoles`).
- `src/application/organization/` — **new** committed local/static organization registry module (CD-7).
- `vite.config.ts` — only lazy Office chunk emission for eager-shell isolation (no eager Pixi).
- `tests/` — new/updated unit, contract, ui, security, performance, acceptance (bundle-boundary), and e2e tests.
- `scripts/` + docs — local-run rehearsal tooling and evidence (BA-WU-08).

**Forbidden source areas (must not change in Batch A):**

- authentication/session, exact Advisor delivery, transport/tmux, Hermes-disabled, PWA cache beyond same-origin hashed chunks + atomic cache-version bump, security/authority modules, and the M1 fixed-station fallback contract — preserve unchanged.
- prototype fixture/timeline modules must stay test-demo-only and unreachable from the production graph.
- any DB/schema/migration, secret/credential/env, remote/public exposure, protected branch, `main`.
- excluded historical `.grok/`, `grok-max`, `grokx`, `grokx-max` and any Grok code — no reuse/copy/adaptation.
- Batch B–E surfaces (live discovery, multi-Advisor rendering beyond the single active instance, private-network mode, production activation).

## 10. Acceptance gates

- **Static**: `npm run lint`, `npm run typecheck` clean; no file-wide suppression; strict rules unchanged.
- **Unit/contract/snapshot/property**: vitest green with accurate totals; new identity/registry/organization + separated-state + shell tests added.
- **Security/authority**: `test:security`, `test:authority`, `test:composition` green; zero authority expansion; LOOPBACK_PRIVATE preserved; protected-cue clearing on stop/logout/expiry/revocation proven; scene-source boundary (no terminal/source/private content).
- **Bundle isolation (CD-3)**: acceptance tests prove eager-shell/fallback graph does **not** import/execute Pixi; Pixi confined to a separately emitted lazy Office chunk; prototype fixture markers rejected; no eager renderer startup. (Not a whole-`dist` zero-Pixi assertion.)
- **UI/accessibility**: `test:ui` + browser specs; keyboard/focus/Escape/Tab for drawer; 200% zoom, contrast, reduced-motion, static parity; mobile navigation.
- **Visual**: living-office baselines captured and directly inspected; historical baselines byte-identical unless an authorized delta.
- **Performance**: renderer startup/active-frame/camera p95 within inherited local budgets; zero long tasks > 50ms; retained-heap non-growth over mount/unmount cycles.
- **Local rehearsal**: one documented start/open/verify/stop procedure (`npm run dev`/`preview`/`start:loopback` + `smoke:runtime`) rehearsed directly on loopback; `npm run check` passes.
- **Independent review (CD-1)**: a clean independent-Sentinel `DESIGN_REVIEW` (then implementation review) routed by Advisor; not a self-review; final approval remains Leo/GPT.

## 11. Explicit Batch B–E exclusion

Batch A is **integration + local/static organization registry projection only**. Out of scope and forbidden this pass: live tmux/process/model discovery; real credential creation or the real port-`4317` private-run activation; private-network/Tailscale mode; multi-Advisor rendering beyond the single active `roleInstanceId`; production/live deployment; any authority/transport expansion; Hermes; and any Batch B, C, D, or E work. No gate may be skipped because a prior batch had a similar shape.

## 12. Rollback, failure isolation, and unknowns

**Rollback / failure isolation:**

- Branch `batch-a/modern-office-identity-001` is isolated; the whole batch reverts by discarding the branch or reverting its commits — `ac8ba75` remains the untouched base.
- In-app rollback is an immediate **presentation selection** (Office → static semantic Office → M1), not a Git/data/runtime rollback.
- Each WorkUnit is independently revertible; the Office surface degrades without blocking secondary views.
- No protected data, DB, or remote state is touched; nothing to un-migrate.

**Unknowns / open questions (residual after CD-7):**

- **U-3 (residual, technical)**: the exact `vite.config.ts` chunk-emission configuration that yields the eager-shell isolation in CD-3 (which manual chunk boundary and test assertions). This is an implementation detail for the Worker within the approved isolation rule, not a product/authority decision.
- Resolved this rework: **U-1** (state coverage) via the separated closed vocabularies in §4; **U-2** (Office-first default) is Founder-decided (CD-2), not an open policy; **U-4** (registry) via the committed `src/application/organization/` module (CD-7).

Control does not resolve product policy, authority, or residual technical detail beyond design; residual items return to Advisor and, where product/authority, to Leo/GPT. Companion documents: identity/organization contract and WorkUnit plan.

## 13. CD-1..CD-8 rework closure

| Finding | Change in this package |
|---|---|
| CD-1 reviewer authority | Header + §10 + status now name the **independent Sentinel** (foundation-reviewer-sol, GPT-5.6 SOL xhigh); Fable5 = secondary/fallback runtime only; model names framed as evidence not authority (master design §4). Mirrored in the contract and WorkUnit plan. |
| CD-2 U-2 Founder-decided | §1/§5 make Office-first the **default** when authenticated projection is ready; no new capability; **no `surface=` in the real app**; degrade static semantic Office → M1. U-2 removed from unknowns. |
| CD-3 bundle gate | §2.2/§10 replace whole-`dist` zero-Pixi with **eager-shell isolation** + lazy Office chunk; tests assert chunk separation, fallback independence, no eager renderer startup; fixture markers still rejected. |
| CD-4 runtime vs work state | §4 defines separate fields + closed vocabularies (session/process, AI identity, model, effort, AI-runtime state) distinct from the operational work-state enum; required visible values preserved; `AI_WORKING` requires structured evidence. |
| CD-5 detail contract | §3 + companion contract expand beyond ten fields (stableDisplayName, assignedBy, returnsResultTo, AI-runtime identity, effort, explicit evidence source). |
| CD-6 identity vs session | §3/§6 + contract make `roleInstanceId` the stable key; `sessionName` is a current binding, not identity. |
| CD-7 U-1/U-4 resolvable | U-1 via §4 separated states; U-4 via new `src/application/organization/` committed registry (provenance + evidence timestamp/status, no auto-refresh, no time-only freshness, unverified→`UNKNOWN`, invalid→`UNASSIGNED`, changes via reviewed commit). |
| CD-8 direct reads | The same Control session directly read the previously-referenced docs; exact coverage recorded in the rework Control result. |
