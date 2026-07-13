# Agent Office A-1R — Deferred Capability Register

Status: `CONTROL_STATIC_DEFERRED_REGISTER__PENDING_INDEPENDENT_DESIGN_REVIEW_THEN_LEO_MOCKUP_APPROVAL`
Mode: `PRODUCT_EXPERIENCE_DESIGN_MODE`. Companion to the A-1R product-experience design and Founder UX contract. Base `58a484b`.

**A-1R scope is role-specific basic presentation plus basic role animation** — the latter designed for the later A-1R Worker implementation using **only accepted fixture/evidence state** with **neutral/reduced/static equivalents**; this does **not** authorize live runtime-state integration (that is Batch B). Every other capability below is **deferred and gated** to the exact Founder activation table: dynamic admission = **C**; real Advisor delivery, live current-status response, Worker→Reviewer→Advisor movement, and completion/handoff choreography = **D**; operational Channy watchdog and bounded retry = **E**; ambient sound = **E-2**. A row's capability may not be built or enabled until its activation condition is met and Leo/GPT authorizes it. **`DELIVERY_DISABLED` is kept; this documentation correction creates no runtime or implementation authority.** Forbidden current behavior is enforced now. No source/test/config change accompanies this register.

Legend — Current level: `NONE` (not present) · `STATIC_PRESENTATION` (neutral, non-operational visual only) · `DISABLED_SHELL` (truthful shell, action inert).

---

## 1. Capability rows

### DCR-01 — Role-specific basic presentation
- **Current level:** `STATIC_PRESENTATION` — **A-1R scope** (role anchors/desks/labels/poses), alongside DCR-02 basic role animation.
- **Deferred batch/reason:** **A-1R** (in scope); role anchors/desks/poses are static and evidence-neutral.
- **Early risk:** implying activity/authority from a pose. **Mitigation:** unknown = neutral; poses express only accepted role/state.
- **Prerequisites:** committed registry + layout config.
- **Owner:** Agent Office Worker (impl) under Advisor handoff after mockup approval.
- **Activation condition:** design-review `PASS` + Leo mockup approval.
- **Forbidden now:** operational/runtime-driven motion; celebratory pre-verdict poses.
- **Tests/evidence (later):** neutral-state rendering; no motion in reduced mode.
- **Final authority:** Leo/GPT.

### DCR-02 — Basic role animation (fixture/evidence-driven; **A-1R scope**)
- **Current level:** `STATIC_PRESENTATION` (designed now; **implemented later in the A-1R Worker pass**, not live).
- **Deferred batch/reason:** **A-1R** (Founder: "role-specific basic animation implemented in A-1R"). It is driven **only by accepted fixture/evidence state**, with **neutral/reduced/static equivalents**; it is **not** live runtime-state integration (that is DCR-03/Batch B).
- **Early risk:** ambient motion read as un-evidenced work. **Mitigation:** motion expresses only accepted role/state; unknown stays neutral; reduced-motion stops it; non-color meaning preserved.
- **Prerequisites:** DCR-01 accepted; committed registry + accepted-evidence fixtures.
- **Owner:** Agent Office Worker under Advisor handoff after mockup approval.
- **Activation condition:** design-review `PASS` + Leo mockup approval (same A-1R implementation gate as DCR-01).
- **Forbidden now:** any live-runtime-driven motion; celebratory/pre-verdict poses; motion in reduced mode. **Tests (later):** motion only from accepted fixture/evidence; reduced-motion stop; static/semantic equivalence. **Authority:** Leo/GPT.

### DCR-03 — Real runtime-state-driven animation (live integration)
- **Current level:** `NONE`. **Deferred:** **Batch B** (A1R-U04). **Reason:** live state→motion mapping needs a verified source + safety (distinct from DCR-02's fixture/evidence animation).
- **Early risk:** motion outrunning verified state; leaking exact activity. **Prereq:** DCR-02; accepted operational-state contract.
- **Owner:** Worker. **Activation:** Batch B + verified state-source. **Forbidden now:** any state-conditioned animation. **Tests (later):** motion only on accepted evidence; unknown stays neutral. **Authority:** Leo/GPT.

### DCR-04 — Dynamic Team/actor admission
- **Current level:** `NONE`. **Deferred:** Batch C (A1R-U05). **Reason:** admission changes the org graph.
- **Early risk:** rendering unregistered/inferred actors/Teams. **Prereq:** committed-registry-only rule held; admission authority defined.
- **Owner:** Worker + Advisor. **Activation:** Batch C + Leo. **Forbidden now:** any non-committed actor/Team; Team inference; Agent Office Pod. **Tests (later):** registry-only membership. **Authority:** Leo/GPT.

### DCR-05 — Real Advisor delivery (send/dispatch)
- **Current level:** `DISABLED_SHELL` (`DELIVERY_DISABLED`). **Deferred:** **Batch D** — unless **unchanged approved reuse** of existing delivery is proven with literally zero authority/security/routing/audit change (A1R-U03). **Reason:** delivery touches authority/security/routing/audit.
- **Early risk:** browser-direct Worker/Reviewer dispatch; audit/route change. **Prereq:** direct evidence of **literally zero change** to authority, security, routing, audit, command target, and the browser-direct prohibition.
- **Owner:** Advisor + Worker + independent review. **Activation:** Batch D + proven zero-change compatibility (or proven unchanged reuse) + Leo. **Forbidden now:** any real send; input unlocked; browser→agent instruction. **Tests (later):** zero-change compatibility proof. **Authority:** Leo/GPT.

### DCR-06 — Live current-status response (real-time actor state)
- **Current level:** `STATIC_PRESENTATION` (committed fixture/accepted-evidence state only). **Deferred:** **Batch D**. **Reason:** a live status feed needs a verified source + fail-closed staleness and is an operational integration.
- **Early risk:** fabricated/stale state shown as current. **Prereq:** verified live source; KST-from-verified-UTC only; STALE→sentinel.
- **Owner:** Worker. **Activation:** Batch D + verified source + Leo. **Forbidden now:** live polling/inference; fabricated KST. **Tests (later):** STALE fail-closed; no fabrication. **Authority:** Leo/GPT.

### DCR-07 — Worker→Reviewer→Advisor movement (handoff travel)
- **Current level:** `NONE`. **Deferred:** **Batch D**. **Reason:** movement implies routing/authority.
- **Early risk:** motion implying command/handoff not evidenced. **Prereq:** accepted handoff evidence.
- **Owner:** Worker. **Activation:** Batch D + evidence + Leo. **Forbidden now:** any inter-actor movement animation. **Tests (later):** movement only on accepted handoff. **Authority:** Leo/GPT.

### DCR-08 — Real completion and handoff choreography
- **Current level:** `NONE`. **Deferred:** **Batch D**. **Reason:** celebration must follow a verified verdict, never precede it.
- **Early risk:** celebratory pose before verified completion/verdict. **Prereq:** accepted completion evidence.
- **Owner:** Worker. **Activation:** Batch D + verified verdict source + Leo. **Forbidden now:** any completion/celebration animation. **Tests (later):** no pre-verdict celebration. **Authority:** Leo/GPT.

### DCR-09 — Recovery / Channy watchdog
- **Current level:** `NONE`. **Deferred:** Batch E (A1R-U06). **Reason:** recovery is operational authority.
- **Early risk:** Channy classifying interruption / continuing / recovering. **Prereq:** none authorize this in A-1R.
- **Owner:** Leo/GPT only. **Activation:** Batch E + explicit Leo authority. **Forbidden now:** any Channy operational action; interruption classification; tmux input; continue/retry/recover; approval; capacity/billing/credential/DB/production/Git handling. **Tests (later):** Channy inert. **Authority:** Leo/GPT.

### DCR-10 — Bounded retry
- **Current level:** `NONE`. **Deferred:** Batch E. **Reason:** retry is operational continuation.
- **Early risk:** automatic continuation without Leo. **Prereq:** defined safe-stop/rollback + explicit authority.
- **Owner:** Leo/GPT. **Activation:** Batch E + Leo. **Forbidden now:** any automatic retry/continue. **Tests (later):** no auto-continue. **Authority:** Leo/GPT.

### DCR-11 — Ambient sound (future opt-in)
- **Current level:** `NONE`. **Deferred:** E-2 (opt-in). **Reason:** out of A-1R scope; must be opt-in.
- **Early risk:** unsolicited audio. **Prereq:** explicit opt-in design + Leo.
- **Owner:** Worker + Advisor. **Activation:** E-2 + Leo + opt-in. **Forbidden now:** any audio. **Tests (later):** silent by default; opt-in gated. **Authority:** Leo/GPT.

---

## 2. Summary gate

| ID | Capability | Level | Batch | Activation gate |
|---|---|---|---|---|
| DCR-01 | Role-specific basic presentation | STATIC_PRESENTATION | **A-1R** | design PASS + Leo mockup approval |
| DCR-02 | Basic role animation (fixture/evidence) | STATIC_PRESENTATION | **A-1R** | design PASS + Leo mockup approval (fixture/evidence only; neutral/reduced/static; not live) |
| DCR-03 | Real runtime-state-driven animation | NONE | **B** (A1R-U04) | Batch B + verified live state source |
| DCR-04 | Dynamic Team/actor admission | NONE | **C** (A1R-U05) | Batch C + Leo |
| DCR-05 | Real Advisor delivery | DISABLED_SHELL | **D** | Batch D + zero-change proof (or proven unchanged reuse) + Leo (A1R-U03) |
| DCR-06 | Live current-status response | STATIC_PRESENTATION | **D** | Batch D + verified source + Leo |
| DCR-07 | Worker→Reviewer→Advisor movement | NONE | **D** | Batch D + accepted handoff + Leo |
| DCR-08 | Real completion/handoff choreography | NONE | **D** | Batch D + verified verdict + Leo |
| DCR-09 | Recovery / Channy watchdog | NONE | **E** (A1R-U06) | Batch E + explicit Leo authority |
| DCR-10 | Bounded retry | NONE | **E** | Batch E + Leo |
| DCR-11 | Ambient sound | NONE | **E-2** opt-in | E-2 + Leo + opt-in |

**A-1R scope = DCR-01 (basic presentation) + DCR-02 (basic role animation, fixture/evidence-driven, neutral/reduced/static equivalents; not live).** Batch B (real runtime-state-driven animation), C (dynamic admission), D (real delivery, live current-status response, movement, completion/handoff choreography), E (watchdog, retry), and E-2 (ambient sound) remain **gated**. Final authority for every row is **Leo/GPT**.
