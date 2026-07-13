# Agent Office A-1R — Static Mockup Spec

Status: `CONTROL_STATIC_MOCKUP_SPEC__PENDING_INDEPENDENT_DESIGN_REVIEW_THEN_LEO_MOCKUP_APPROVAL`
Mode: `PRODUCT_EXPERIENCE_DESIGN_MODE`. Base `58a484b`. These mockups are **static, non-clickable design sources** — not a prototype, not code.

**Format (A1R-U07):** each mockup is a committed **SVG design source** + an exported **full-size PNG** review evidence. SVGs are hand-authored vector; PNGs are rasterized at deviceScaleFactor 2 (crisp review evidence) from the SVG viewBox via headless Chromium with the Noto Sans CJK KR font — no repo tooling/config was added. Korean renders as Korean; technical IDs/SHAs/model names remain exact.

All actor content is **registry-derived** (`src/application/organization/registry.ts` + `office-layout-config.ts`): two Teams (Foundation, VibeNews), eight actors, Agent Office as a Foundation member. State values shown are illustrative accepted-evidence examples, not live data; unknown is shown as the fail-closed neutral sentinel.

---

## Assets

| File | Design px (viewBox) | PNG px (@2×) | Purpose / requirements covered |
|---|---|---|---|
| `mockups/a1r-full-office-desktop.svg` / `.png` | 1440 × 900 | 2880 × 1800 | Whole shared office at the normal 1440×900 canvas **and** an inset reflow at Leo's wide/short 1512×619 capture shape. Two spatially separated Team Pods on one floor; Foundation (larger, left) with 6 members incl. Agent Office; VibeNews (right) with 2. Mission Boards, compact Korean labels, one hover quick card, disabled Advisor chat dock, Channy, collapsed agent-list control. (Founder 1, 9, 10; Space S-1..S-6) |
| `mockups/a1r-full-office-mobile.svg` / `.png` | 390 × 844 | 780 × 1688 | Full mobile Living Office: stacked separated Pods, collapsed agent list, and the compact **bottom sheet** with `상세 보기`. (Founder 2, 8; I-6) |
| `mockups/a1r-advisor-team-pod.svg` / `.png` | 1000 × 720 | 2000 × 1440 | Detailed Foundation Pod: role anchors (① Advisor coordination desk + Mission Board, ② Control architecture surface, ③ Worker individual desks, ④ Reviewer independent booth, idle peripheral seat, Channy), 45°/diamond tiles, consistent furniture depth. (Founder 3; S-4, S-5) |
| `mockups/a1r-information-interaction-states.svg` / `.png` | 1200 × 880 | 2400 × 1760 | Layered information: ① compact label → ② hover quick card → ③ pinned card (exactly one) → ④ full 17-field drawer → ⑤ mobile bottom sheet; the eight critical-state badges; interaction rules; reduced/static/high-text/semantic equivalence. (Founder 4–8, 11, 13; L/D/C/I contract) |
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
