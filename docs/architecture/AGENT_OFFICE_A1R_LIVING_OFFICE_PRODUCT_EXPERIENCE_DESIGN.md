# Agent Office A-1R — Living Office Product Experience Design

Status: `CONTROL_PRODUCT_EXPERIENCE_DESIGN__STATIC__PENDING_INDEPENDENT_DESIGN_REVIEW_THEN_LEO_MOCKUP_APPROVAL`
Mode: `PRODUCT_EXPERIENCE_DESIGN_MODE` (user-facing label `제품 설계·아키텍처`). Control remains Control — not a permanent Designer/Worker/Reviewer/approver.
Mission: `AGENT_OFFICE_A1R_LIVING_OFFICE_EXPERIENCE_REFINEMENT_001` · Base `58a484b088b4e57e7b3ee6e582f54c7f3ce6dc85` · Branch `a1r/living-office-experience-refinement-001`
Scope: **static design + mockup assets only.** No source/test/config/package/dependency change; no clickable prototype; no Worker/Reviewer invocation; no self-review; no aesthetic approval (Leo alone).

Companions: `docs/contracts/AGENT_OFFICE_A1R_FOUNDER_UX_CONTRACT.md` · `docs/operations/AGENT_OFFICE_A1R_DEFERRED_CAPABILITY_REGISTER.md` · `docs/ui/a1r/AGENT_OFFICE_A1R_STATIC_MOCKUP_SPEC.md` (+ SVG/PNG mockups).

---

## 0. The real product defect (inspected directly, not from tests)

Leo's actual capture `/home/leo/uploads/clip-20260713-223828.png` (1512×619) shows the default Living Office viewport failing as a **debug-like spatial dashboard**, confirmed against source:

- **Oversized cards dominate.** `living-office-actor-overlay.tsx:34-35` fixes the production card at `PRODUCTION_LABEL_WIDTH=244` × `PRODUCTION_LABEL_HEIGHT=180`; the cards cover actors and furniture.
- **Seven technical facts on every label.** The first layer renders `advisorTeam/sessionProcess/aiIdentity/model/effort/aiRuntimeState/operationalState` + role/name (`living-office-actor-overlay.tsx:55-65`), truncated to noise ("FO… REG", "M… UNV").
- **Connector lines cross the world** when labels are displaced through the global placement grid.
- **Actors cluster** in the middle; **one card escapes the Office boundary** (CONTROL, top-left); the **lower floor is largely empty**.
- The **semantic mirror always renders the full visible-actor roster** in ordinary mode; there is no compact collapsed control.

This is an **in-scope Batch A correction**, not post-approval polish. The prior always-visible nine/seven-field first-layer requirement and the five test reworks that hardened it are **superseded** (Founder mission §"Superseded first-layer contract"; Advisor brief superseded/gate inventory).

**Governing hierarchy:** `Space → Behavior → Information → Technology`. Living Office is primary; Technical Dashboard secondary. Review begins with the product.

---

## 1. Space — one shared floor, spatially separated registry-derived Team Pods

The default world is a coherent **45°/three-quarter** office: **square/diamond floor tiles**, angled desks/monitors, consistent furniture **depth and occlusion**. One shared floor holds **multiple spatially separated Advisor Team Pods**; one floor does **not** mean one actor cluster.

**Registry-derived Pods (committed `src/application/organization/registry.ts` + `office-layout-config.ts`; two Teams only — no Team inference, no new Team, no Agent Office Pod):**

| Pod | `advisorTeamId` | Members (registry `roleInstanceId` → `role`/`project`) |
|---|---|---|
| `pod:foundation` — **Foundation Advisor Team** (larger, left) | `FOUNDATION_ADVISOR_TEAM` | `foundation-advisor` (ADVISOR/FOUNDATION), `foundation-control` (CONTROL/FOUNDATION), `agent-office-worker` (WORKER/**AGENT_OFFICE**), `foundation-reviewer` (REVIEWER/FOUNDATION), `cosmile-worker` (WORKER/COSMILE), `siasiu-worker` (WORKER/SIASIU) |
| `pod:vibenews` — **VibeNews Advisor Team** (smaller, right) | `VIBENEWS_ADVISOR_TEAM` | `vibenews-advisor` (ADVISOR/VIBENEWS), `vibenews-worker` (WORKER/VIBENEWS) |

★**Agent Office is a Foundation Team member** (`agent-office-worker.advisorTeam = FOUNDATION_ADVISOR_TEAM`) → it lives **inside** the Foundation Pod, never its own Pod. A Pod is created only for a registered Advisor Team with a resolvable responsible Advisor (companion contract §3.1); Agent Office has no registered Agent Office Advisor, so no Agent Office Pod.

**Role anchors within a Pod** (distinct position per actor; proximity never creates authority):
- **Advisor** — coordination desk + **Team Mission Board** owner.
- **Control** — architecture/design surface (board + desk).
- **Worker** — an individual desk each (Agent Office, Cosmile, SIASIU under Foundation; VibeNews Worker under VibeNews).
- **Reviewer** — an independent **booth/zone** (dashed boundary; separation is spatial, not decorative).
- **Idle/reference** actor — a quiet peripheral seat.
- **Designer** — a design board **only when a Designer is registered** (none today; not invented — A1R-U10 `OUT_OF_SCOPE`).

**Team identity** = short text + optional configured mark + **restrained accent** + Mission Board motif + limited props. **Never full-room saturated fills.** Color is never the only Team signal (short Team text `FND`/`VBN` accompanies every accent).

Empty lower floor is reduced: Pods and a peripheral band (plants, corridor, Channy) fill the shared floor without adding actors. See `mockups/a1r-full-office-desktop.svg` (1440×900 + the Leo wide/short 1512×619 reflow inset) and `mockups/a1r-advisor-team-pod.svg`.

---

## 2. Behavior — evidence-backed, before information

- **Unknown state is neutral**, never active-work animation. A missing observation never asserts activity, offline, or no-process.
- Actor poses express **only accepted role/state evidence**. No celebratory Reviewer pose precedes a verified verdict. Monitor motion exposes **no secret, source, or unsupported exact activity**.
- **A-1R scope = role-specific basic presentation + basic role animation** (the latter driven **only by accepted fixture/evidence state**, with neutral/reduced/static equivalents; **not** live runtime-state integration). Deferred per the Founder activation table (register): **real runtime-state-driven animation = Batch B**; dynamic Team/actor admission = **C**; real Advisor delivery, live current-status response, Worker→Reviewer→Advisor movement, and completion/handoff choreography = **D**; operational Channy watchdog and bounded retry = **E**; ambient sound = **E-2**. `DELIVERY_DISABLED` is kept; this design grants no implementation or runtime authority.
- **Channy** is a recognizable **Bedlington Terrier** at appropriate scale (~knee height / ~1.2 tiles), placed on the quiet periphery, with ambient walk/patrol/sniff/head-tilt/light-scratch/eat/drink/sleep/affectionate poses. Channy has **no authority** and cannot classify interruption, send tmux input, continue/retry/recover, approve, or handle capacity/billing/credential/DB/production/Git risk. Reduced motion stops all ambient motion. See `mockups/a1r-channy-character-poses.svg`.

---

## 3. Information — layered, minimal by default, complete on demand

**Default canvas label (always visible)** contains only: `stableDisplayName`, `role`, **concise critical state**, Team accent + **short Team text**. Nothing else is forced onto the always-visible layer. Technical facts remain truthful and reachable through quick card → pinned card → full drawer → semantic mirror → Technical Dashboard.

**Directly-visible critical states** (never hidden behind interaction): session offline, no AI process, AI error, blocked, needs Leo, operational unknown, authority/security hold, decision-critical conflict. Metadata unknowns may be summarized compactly.

**Progressive disclosure (desktop):** compact label → **hover/focus quick card** (current mission, WorkUnit, model, effort, blocker/Leo, KST last-verified, concise evidenced runtime; auto-placed, never covering the actor/essential furniture) → **click-pinned compact card** (hover facts + runtime, progress, next action, reports-to, `상세 보기`; **exactly one** pinned; another actor replaces it; empty-space click and Escape close it) → **full drawer** (complete accepted 17-field actor facts + provenance, preserved).

**Mobile:** `Tap actor → compact bottom sheet → 상세 보기 → full drawer`. Another actor replaces content; empty Office closes it.

**Relationship lines are hidden by default** and appear only for **explicit actor/Team/relationship selection** — they are never ambient.

**Team Mission Board** (per Pod): Team/project, current mission, progress, state, blocker, Leo decision, next action, and **KST verification time** — **without fabrication** (unknown stays unknown; convert only accepted verified UTC → KST, A1R-U08). See `mockups/a1r-information-interaction-states.svg`.

**Advisor conversation lives in the Living Office** (not a separate app): accessible Advisor selector, selected-Advisor identity, desktop chat panel / mobile sheet, Founder-facing transcript (safe summary — excludes raw tmux, full launchers, full test output, repetitive patch chatter), unread state, completion/decision notifications, truthful delivery state. **Delivery stays `DELIVERY_DISABLED`** unless later technical evidence proves literally zero change to authority/security/routing/audit/command-target and the browser-direct Worker/Reviewer prohibition (A1R-U03). The static package designs only the **truthful selection/transcript/notification shell**, input locked.

Korean is the natural user-facing language; **technical IDs, SHAs, schema names, WorkUnit IDs, and model names remain exact** (e.g. `BA-WU-03`, `claude-opus-4-8`, `FOUNDATION_ADVISOR_TEAM`).

---

## 4. Technology — accessibility, truth, fallback (last, never first)

- **Ordinary visual mode:** the large actor list collapses behind **`접근 가능한 에이전트 목록 (N)`** while **screen-reader parity is preserved**.
- **Static/no-canvas, high-text, renderer failure, explicit accessibility mode:** the semantic list becomes **primary**, opening the same single drawer and the same facts.
- **Reduced motion** and **non-color meaning** are mandatory (icon + Korean text accompany every state color).
- **High-text (≥1.3×) / 200%:** label width is fixed; only wrapped height grows → zero label/silhouette overlap, zero required-content truncation, zero off-screen labels.
- **Truth & authority preserved:** registry truth, identity/organization separation, fail-closed unknown sentinels, provenance, full drawer, Technical Dashboard secondary role, local/private runtime, auth/authority boundaries, no browser-direct Worker/Reviewer dispatch, rollback/safe stop, Grok quarantine, excluded historical-session boundary.

---

## 5. Requirement-to-design traceability (Founder deliverables 1–14)

| # | Founder deliverable | Design location |
|---|---|---|
| 1 | Full desktop Living Office | `mockups/a1r-full-office-desktop.svg/.png` (1440×900 + 1512×619 reflow) |
| 2 | Full mobile Living Office | `mockups/a1r-full-office-mobile.svg/.png` (390×844) |
| 3 | Detailed Advisor Team Pod | `mockups/a1r-advisor-team-pod.svg/.png` |
| 4 | Compact default actor label | §3; info-states mockup ① |
| 5 | Desktop hover/focus quick card | §3; info-states mockup ② |
| 6 | Click-pinned compact card | §3; info-states mockup ③ (exactly one) |
| 7 | Full drawer transition | §3; info-states mockup ④ |
| 8 | Mobile bottom sheet | §3; mobile mockup + info-states ⑤ |
| 9 | Team Mission Board | §3; desktop + pod mockups |
| 10 | Advisor selection + Living Office chat-panel location | §3; desktop mockup (right dock, disabled) |
| 11 | States ACTIVE/WAITING/BLOCKED/NEEDS_LEO/SESSION_OFFLINE/NO_AI_PROCESS/AI_ERROR/unknown | info-states mockup badge legend; UX contract §4 |
| 12 | Channy silhouette/scale/placement/poses | §2; `mockups/a1r-channy-character-poses.svg/.png` |
| 13 | Interaction notes (hover/focus/click/tap/outside/Escape/replace/drawer) | §3; UX contract §5; info-states mockup |
| 14 | Founder-requirement traceability | this table + UX contract §7 |

Spatial/behavior/information/Korean/Channy/semantic/deferred requirements map to §1–§4 and the companion contract/register.

---

## 6. Rationale — why this avoids the prior test-driven failure

The prior failure came from a contract that **forced complete sourced facts into the always-visible layer** and then hardened it with gates. Tests projected a debug view, and the product inherited it. A-1R inverts the order: **the product experience is the contract; tests will later protect the intended experience** (Founder principles 1–4). The compact label + layered disclosure removes the 244×180 cards, the seven always-on facts, and the ambient connectors — the exact sources of overlap, truncation, escape, and noise — while **preserving every fact** through cards/drawer/semantic/Dashboard. Pods separate space so "one floor" no longer means "one cluster." Automated `PASS` cannot override a failed product contract; implementation review begins with the real product at original scale and 100% zoom.

---

## 7. Boundaries this design does not cross

No A-2 implementation, Batch B–E activation, Team/role mutation, new Advisor command authority, delivery activation, browser-to-agent expansion, operational recovery/auto-continue, auth expansion, DB/schema/migration, Hermes, remote/public deploy, protected merge, force push, asset purchase/import, ambient sound, or automatic next mission. Accepted registry/provenance/fail-closed/full-drawer boundaries are not rewritten. Aesthetic approval is Leo's alone.
