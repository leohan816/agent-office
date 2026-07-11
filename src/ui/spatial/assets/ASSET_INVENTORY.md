# Agent Office M1.2 AO12-B Placeholder Asset Inventory

Status: `PLACEHOLDER_ONLY__NOT_PRODUCTION_ART__PENDING_INDEPENDENT_REVIEW`

Schema: `agent-office.character-assets.v1`

License: `AGENT-OFFICE-INTERNAL-PLACEHOLDER-1.0`

These original code-native React/DOM/SVG placeholders were authored inside the
Agent Office repository for the synthetic AO12-B test/demo fixture. They contain
no copied, purchased, commissioned, imported, downloaded, externally generated,
or third-party material. They are not approved production art. Redistribution
outside the Agent Office project requires a separate reviewed decision.

## Source record

| Field | Value |
|---|---|
| Source path | `src/ui/spatial/assets/placeholder-characters.tsx` |
| Owner | `Agent Office project-authored` |
| Origin | `Original code-native AO12-B placeholder implementation` |
| SHA-256 | `adacf982a568bffefe1a6eddefb58584ff706f9408fdf5ab81a42ce49b19bd63` |
| Format | `TSX_INLINE_SVG` |
| Script | `false` |
| External reference | `false` |
| External acquisition | `none` |
| Purchase evidence | `none` |
| Reviewed commit | `none; pending independent AO12-B review` |

## Stable slots

| Asset ID | Semantic role | Geometry/viewBox | Variants | Status |
|---|---|---|---|---|
| `ao12.character-full.v1` | `character-full` | `96 x 96 / 0 0 96 96` | six semantic role categories | `PLACEHOLDER` |
| `ao12.character-route.v1` | `character-route` | `48 x 48 / 0 0 48 48` | static route slot only; AO12-B adds no route behavior | `PLACEHOLDER` |
| `ao12.role-glyph.v1` | `role-glyph` | `24 x 24 / 0 0 24 24` | six semantic role categories | `PLACEHOLDER` |
| `ao12.project-glyph.v1` | `project-glyph` | `24 x 24 / 0 0 24 24` | geometric text fallback | `PLACEHOLDER` |
| `ao12.assignment-badge.v1` | `assignment-badge` | `48 x 20 / 0 0 48 20` | project text/pattern | `PLACEHOLDER` |
| `ao12.channy-full.v1` | `channy-full` | `72 x 72 / 0 0 72 72` | neutral static Bedlington Terrier | `PLACEHOLDER` |
| `ao12.channy-facility.v1` | `channy-facility` | `120 x 64 / 0 0 120 64` | bed, food bowl, water bowl | `PLACEHOLDER` |
| `ao12.office-facilities.v1` | `office-facilities` | `120 x 64 / 0 0 120 64` | wood desk, glass room, lounge, path, signs, boards, review booth, Advisor Hub | `PLACEHOLDER` |

## Fixed safety boundary

- Inline SVG is decorative next to complete text semantics and has stable
  intrinsic dimensions.
- No script, handler, embedded HTML, external font/link/reference, data URL,
  runtime fetch, sound, video, shader, user SVG, credential, terminal material,
  real-person likeness, provider logo, or protected-style claim is present.
- A missing or unknown asset ID resolves to `ao12.character-full.v1` without
  changing the slot size.
- Channy has no actor role, authority, assignment, notification, inspection,
  command, approval, repair, inferred state, motion, or status-reaction behavior
  in AO12-B.
