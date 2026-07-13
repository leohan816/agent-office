# Agent Office A-1R — Deferred Capability Register

Status: `CONTROL_STATIC_DEFERRED_REGISTER__PENDING_INDEPENDENT_DESIGN_REVIEW_THEN_LEO_MOCKUP_APPROVAL`
Mode: `PRODUCT_EXPERIENCE_DESIGN_MODE`. Companion to the A-1R product-experience design and Founder UX contract. Base `58a484b`.

**A-1R activates only role-specific basic presentation.** Every capability below is **deferred and gated**. A row's capability may not be built or enabled until its activation condition is met and Leo/GPT authorizes it. Forbidden current behavior is enforced now. No source/test/config change accompanies this register.

Legend — Current level: `NONE` (not present) · `STATIC_PRESENTATION` (neutral, non-operational visual only) · `DISABLED_SHELL` (truthful shell, action inert).

---

## 1. Capability rows

### DCR-01 — Role-specific basic presentation
- **Current level:** `STATIC_PRESENTATION` — **the only capability A-1R activates.**
- **Deferred batch/reason:** not deferred (in scope); role anchors/desks/poses are static and evidence-neutral.
- **Early risk:** implying activity/authority from a pose. **Mitigation:** unknown = neutral; poses express only accepted role/state.
- **Prerequisites:** committed registry + layout config.
- **Owner:** Agent Office Worker (impl) under Advisor handoff after mockup approval.
- **Activation condition:** design-review `PASS` + Leo mockup approval.
- **Forbidden now:** operational/runtime-driven motion; celebratory pre-verdict poses.
- **Tests/evidence (later):** neutral-state rendering; no motion in reduced mode.
- **Final authority:** Leo/GPT.

### DCR-02 — Role animation (idle character motion)
- **Current level:** `NONE`. **Deferred:** Batch B. **Reason:** motion must not imply un-evidenced activity.
- **Early risk:** ambient motion read as work. **Prereq:** DCR-01 accepted; reduced-motion + non-color rules proven.
- **Owner:** Worker. **Activation:** Batch B authorization + evidence that idle motion carries no state meaning.
- **Forbidden now:** any looping role/idle animation in production default. **Tests (later):** reduced-motion stop; state-independence. **Authority:** Leo/GPT.

### DCR-03 — Runtime/operational-state-driven animation
- **Current level:** `NONE`. **Deferred:** Batch B (A1R-U04). **Reason:** state→motion mapping needs accepted evidence + safety.
- **Early risk:** motion outrunning verified state; leaking exact activity. **Prereq:** DCR-02; accepted operational-state contract.
- **Owner:** Worker. **Activation:** Batch B + verified state-source. **Forbidden now:** any state-conditioned animation. **Tests (later):** motion only on accepted evidence; unknown stays neutral. **Authority:** Leo/GPT.

### DCR-04 — Dynamic Team/actor admission
- **Current level:** `NONE`. **Deferred:** Batch C (A1R-U05). **Reason:** admission changes the org graph.
- **Early risk:** rendering unregistered/inferred actors/Teams. **Prereq:** committed-registry-only rule held; admission authority defined.
- **Owner:** Worker + Advisor. **Activation:** Batch C + Leo. **Forbidden now:** any non-committed actor/Team; Team inference; Agent Office Pod. **Tests (later):** registry-only membership. **Authority:** Leo/GPT.

### DCR-05 — Real Advisor delivery (send/dispatch)
- **Current level:** `DISABLED_SHELL` (`DELIVERY_DISABLED`). **Deferred:** technical-evidence-gated (A1R-U03). **Reason:** delivery touches authority/security/routing/audit.
- **Early risk:** browser-direct Worker/Reviewer dispatch; audit/route change. **Prereq:** direct evidence of **literally zero change** to authority, security, routing, audit, command target, and the browser-direct prohibition.
- **Owner:** Advisor + Worker + independent review. **Activation:** proven zero-change compatibility + Leo. **Forbidden now:** any real send; input unlocked; browser→agent instruction. **Tests (later):** zero-change compatibility proof. **Authority:** Leo/GPT.

### DCR-06 — Live status response (real-time actor state)
- **Current level:** `STATIC_PRESENTATION` (committed fixture/accepted-evidence state only). **Deferred:** Batch B. **Reason:** live feed needs a verified source + fail-closed staleness.
- **Early risk:** fabricated/stale state shown as current. **Prereq:** verified live source; KST-from-verified-UTC only; STALE→sentinel.
- **Owner:** Worker. **Activation:** Batch B + verified source. **Forbidden now:** live polling/inference; fabricated KST. **Tests (later):** STALE fail-closed; no fabrication. **Authority:** Leo/GPT.

### DCR-07 — Handoff movement (actor/task travel)
- **Current level:** `NONE`. **Deferred:** Batch B. **Reason:** movement implies routing/authority.
- **Early risk:** motion implying command/handoff not evidenced. **Prereq:** DCR-03; accepted handoff evidence.
- **Owner:** Worker. **Activation:** Batch B + evidence. **Forbidden now:** any inter-actor movement animation. **Tests (later):** movement only on accepted handoff. **Authority:** Leo/GPT.

### DCR-08 — Completion choreography
- **Current level:** `NONE`. **Deferred:** Batch B. **Reason:** celebration must follow a verified verdict, never precede it.
- **Early risk:** celebratory pose before verified completion/verdict. **Prereq:** accepted completion evidence.
- **Owner:** Worker. **Activation:** Batch B + verified verdict source. **Forbidden now:** any completion/celebration animation. **Tests (later):** no pre-verdict celebration. **Authority:** Leo/GPT.

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
| DCR-01 | Role-specific basic presentation | STATIC_PRESENTATION | A-1R | design PASS + Leo mockup approval |
| DCR-02 | Role animation | NONE | B | Batch B + no-state-meaning evidence |
| DCR-03 | Runtime-driven animation | NONE | B (A1R-U04) | Batch B + verified state source |
| DCR-04 | Dynamic Team/actor admission | NONE | C (A1R-U05) | Batch C + Leo |
| DCR-05 | Real Advisor delivery | DISABLED_SHELL | evidence-gated (A1R-U03) | zero-change proof + Leo |
| DCR-06 | Live status response | STATIC_PRESENTATION | B | Batch B + verified source |
| DCR-07 | Handoff movement | NONE | B | Batch B + accepted handoff |
| DCR-08 | Completion choreography | NONE | B | Batch B + verified verdict |
| DCR-09 | Recovery / Channy watchdog | NONE | E (A1R-U06) | Batch E + explicit Leo authority |
| DCR-10 | Bounded retry | NONE | E | Batch E + Leo |
| DCR-11 | Ambient sound | NONE | E-2 opt-in | E-2 + Leo + opt-in |

Batch B–E and E-2 remain **gated**. A-1R activates only DCR-01. Final authority for every row is **Leo/GPT**.
