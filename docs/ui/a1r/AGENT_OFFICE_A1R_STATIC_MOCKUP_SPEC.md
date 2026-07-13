# Agent Office A-1R — Static Mockup Spec

Status: `CONTROL_STATIC_MOCKUP_SPEC__PENDING_INDEPENDENT_DESIGN_REVIEW_THEN_LEO_MOCKUP_APPROVAL`
Mode: `PRODUCT_EXPERIENCE_DESIGN_MODE`. Base `58a484b`. These mockups are **static, non-clickable design sources** — not a prototype, not code.

**Format (A1R-U07):** each mockup is a committed **SVG design source** + an exported **full-size PNG** review evidence. SVGs are hand-authored vector; PNGs are rasterized at deviceScaleFactor 2 (crisp review evidence) from the SVG viewBox via headless Chromium with the Noto Sans CJK KR font — no repo tooling/config was added. Korean renders as Korean; technical IDs/SHAs/model names remain exact.

All actor content is **registry-derived** (`src/application/organization/registry.ts` + `office-layout-config.ts`): two Teams (Foundation, VibeNews), eight actors, Agent Office as a Foundation member. Technical tokens use **exact source values** (e.g. `agent-office-worker` model `claude-opus-4-8`, effort `ULTRACODE`, `src/application/organization/evidence.ts:273-279`). Progress/WorkUnit/mission have **no committed A-1R source** (`production-render-input.ts:199-213` → `completed/total WorkUnits/Gates = 0`) and render **fail-closed** (`—`/`0/0 (미확정)`); no fabricated KST stamp is shown. Any remaining illustrative state is watermarked **`설계 예시 · 실제 운영 아님`**; unknown is the fail-closed neutral sentinel.

---

## Assets

| File | Design px (viewBox) | PNG px (@2×) | Purpose / requirements covered |
|---|---|---|---|
| `mockups/a1r-full-office-desktop.svg` / `.png` | 1440 × 900 | 2880 × 1800 | Whole shared office at the normal 1440×900 canvas **and** an inset reflow at Leo's wide/short 1512×619 capture shape. Two spatially separated Team Pods on one floor; Foundation (larger, left) with 6 members incl. Agent Office; VibeNews (right) with 2. Mission Boards, compact Korean labels, one hover quick card, disabled Advisor chat dock, Channy, collapsed agent-list control. (Founder 1, 9, 10; Space S-1..S-6) |
| `mockups/a1r-full-office-mobile.svg` / `.png` | 390 × 1200 | 780 × 2400 | Full mobile Living Office: stacked separated Pods with per-row Team text (FND/VBN); ① the actor **bottom sheet** (`상세 보기`, exact tokens, fail-closed) and ② the **`DELIVERY_DISABLED` Advisor conversation sheet** with selection/unread/notifications/input-lock/close/focus/arbitration (mutually exclusive with the actor sheet). This tall artifact is a **static state-comparison sheet** — one Office frame followed by the two alternative bottom-sheet states shown side-by-side for review only; the runtime viewport never shows both sheets open at once (K-3.1). (Founder 2, 8, 10; I-6, K-3.1, SDR-04/05) |
| `mockups/a1r-advisor-team-pod.svg` / `.png` | 1040 × 760 | 2080 × 1520 | Detailed Foundation Pod (re-laid-out to three clear columns — no label/silhouette/furniture collisions): role anchors (① Advisor coordination desk + Mission Board, ② Control architecture surface, ③ Worker individual desks, ④ Reviewer independent booth, idle peripheral seat, Channy), 45°/diamond tiles, consistent furniture depth. (Founder 3; S-4, S-5) |
| `mockups/a1r-information-interaction-states.svg` / `.png` | 1200 × 920 | 2400 × 1840 | Layered information: ① compact label → ② hover quick card → ③ pinned card (exactly one) → ④ full 17-field drawer → ⑤ mobile bottom sheet; the eight critical-state badges; the **read-only critical-status overlay** (권한/보안 홀드 ▲ · 범위 충돌 ◆) sourced from AlertRaised/BlockerOpened; interaction rules; reduced/static/high-text/semantic equivalence. Disclosure values use exact source tokens (`claude-opus-4-8`/`ULTRACODE`) + fail-closed (`—`) + a `설계 예시 · 실제 운영 아님` watermark. (Founder 4–8, 11, 13; L/D/C/I contract; SDR-02/03/06) |
| `mockups/a1r-channy-character-poses.svg` / `.png` | 960 × 620 | 1920 × 1240 | Channy Bedlington silhouette features, scale vs actor, ambient poses (walk/patrol, sniff, head-tilt, light-scratch/curiosity, eat, drink, sleep/rest, affectionate, neutral idle), and the non-operational authority boundary. (Founder 12; CH-1) |
| `../../FEATURE_INDEX.md` | — | — | Pointer/status entry for the A-1R static design package. |

---

## Reading guidance for review

- Read PNGs at **original full size**; the mockups are designed to be legible unscaled.
- The default world deliberately carries **minimal** text (name/role/Team/state). Technical facts appear only in the quick card / pinned card / drawer / semantic mirror panels shown in the info-states mockup — this is the intended layering, not missing information.
- Colors are paired with **icon + Korean text** everywhere (color is never the only signal).
- The desktop mockup's right dock is the Advisor conversation location in a **`DELIVERY_DISABLED`, input-locked** state — it demonstrates placement and truthful state, not an active channel.
- These are **design sources**. Exact pixel geometry, spacing, and final aesthetics are Leo's decision (A1R-U01); independent design review evaluates contract/clarity/accessibility/authority/implementability, not final aesthetic preference.

## Non-goals

No clickable behavior, no route, no source/test/config/dependency, no asset purchase/import, no ambient sound. The mockups do not re-implement the product; they specify the intended experience for the later Worker WorkUnits that Advisor will define **after** Leo approves these mockups.
