# Agent Office A-1R — Founder UX Contract

Status: `CONTROL_STATIC_UX_CONTRACT__PENDING_INDEPENDENT_DESIGN_REVIEW_THEN_LEO_MOCKUP_APPROVAL`
Mode: `PRODUCT_EXPERIENCE_DESIGN_MODE`. Companion to `docs/architecture/AGENT_OFFICE_A1R_LIVING_OFFICE_PRODUCT_EXPERIENCE_DESIGN.md`. Base `58a484b`.
This is the **enforceable product-experience contract** for A-1R Living Office. It is a design artifact; it grants **no implementation authority**. Later canonicalized as Founder UX Principle 001 in Batch A-2 (A-2 not authorized here). Tests will later protect these rules; the rules are not derived from tests.

The prior always-visible seven/nine-field first-layer contract and the five test reworks that hardened it are **SUPERSEDED** (see §8). Facts remain truthful and available through card/drawer/semantic/Technical Dashboard.

---

## 1. Space contract

- **S-1** One shared floor holds **≥2 spatially separated Advisor Team Pods**; one floor never means one actor cluster.
- **S-2** Pods are **registry-derived** from the committed two Teams only (`FOUNDATION_ADVISOR_TEAM`, `VIBENEWS_ADVISOR_TEAM`). No Team inference, no new Team, no delivery/authority change.
- **S-3** **Agent Office has no Pod** — `agent-office-worker` is a Foundation member. A Pod exists only for a registered Advisor Team with a resolvable responsible Advisor.
- **S-4** Every actor has a **distinct position**; **proximity never creates authority**. Role anchors: Advisor = coordination desk + Mission Board; Control = architecture/design surface; each Worker = individual desk; Reviewer = independent booth/zone; idle/reference = quiet peripheral seat; Designer = design board only when a Designer is registered (none now).
- **S-5** Coherent 45°/three-quarter perspective, square/diamond tiles, angled furniture/monitors, consistent depth/occlusion.
- **S-6** Team identity = short text + optional configured mark + **restrained accent** + Mission Board motif + limited props. **No full-room saturated fill.** **Color is never the only Team signal** (short Team text always present).

## 2. Default canvas label contract

- **L-1** The always-visible label contains **only**: `stableDisplayName`, `role`, **one concise critical state**, Team accent, **short Team text**. Nothing else is forced onto the always-visible layer.
- **L-2** No technical microcopy is placed in the default world merely to prove a fact exists.
- **L-3** Fixed label **width**; height grows only with wrapped text (high-text/200%). **Zero** label overlap, silhouette overlap, required-content truncation, off-screen label.

## 3. Layered disclosure contract (desktop)

- **D-1** **Hover/focus quick card** shows: current mission, WorkUnit, model, effort, blocker/Leo state, **KST last-verified**, concise evidenced runtime. It **auto-places without covering the actor or essential furniture**. It closes on focus/hover exit.
- **D-2** **Click pins exactly one compact card**: **all D-1 hover facts** (incl. **blocker/Leo state**) **plus** runtime, progress, next action, reports-to, and a `상세 보기` affordance. Blocker/Leo state is never dropped from the pinned card. Progress/WorkUnit that has no committed source renders **fail-closed** (§K-2). **At most one card is pinned at a time.**
- **D-3** **Another actor selection replaces** the pinned card. **Empty-space click and Escape close** it, restoring focus.
- **D-4** **Full drawer** preserves the **complete accepted 17-field actor facts and provenance** (unchanged from Batch A — preserved, not rewritten).

## 4. Critical-state visibility contract

- **C-1** These states are **directly visible on the label** (never hidden behind interaction), each with **icon + Korean text + color** (color is never the only signal):

  | State | Label (Korean) | Source vocabulary |
  |---|---|---|
  | ACTIVE | `● 진행 중` | `operationalState = WORKING`/`TESTING` (accepted work evidence) |
  | WAITING | `◐ 대기` | `WAITING_DEPENDENCY` |
  | BLOCKED | `■ 차단됨` | `BLOCKED` |
  | NEEDS_LEO | `◆ Leo 필요` | `WAITING_LEO` |
  | SESSION_OFFLINE | `◌ 세션 오프라인` | `sessionProcess = SESSION_OFFLINE` |
  | NO_AI_PROCESS | `◌ AI 프로세스 없음` | `sessionProcess = NO_AI_PROCESS` |
  | AI_ERROR | `⚠ AI 오류` | `aiRuntimeState = AI_ERROR` |
  | operational unknown | `◦ 상태 불명` | `operationalState = UNKNOWN` (fail-closed) |

- **C-2** Authority/security hold and decision-critical conflict are also directly visible — as a **read-only adjacent critical-status overlay** (SDR-06), **not** a `PixelOperationalState` value and **not** a new authority source. It grants no command/approval/routing/recovery/resolution authority. Exact source, precedence, fail-closed, tokens, and announcement in **§4.1**. Metadata unknowns (identity/model/effort when unproven) may be **summarized compactly** and are not forced onto the label.
- **C-3** **Unknown is neutral** — never rendered as active-work animation or inferred activity.

### 4.1 Read-only critical-status overlay — authority/security hold & decision-critical conflict (SDR-06)

Two Founder-required critical states are rendered as an **adjacent, read-only overlay** driven **only by existing accepted, active (unresolved) structured records** — `AlertRaised` (`docs/contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md` §7.3; `src/domain/alerts/index.ts`) and `BlockerOpened` (§7.2; `src/domain/blockers/index.ts`). It is **not** a `PixelOperationalState` value (that enum has neither a HOLD nor a CONFLICT member, `src/ui/pixel/contracts.ts:27-41`), introduces **no** new enum, and grants **no** command/approval/routing/recovery/resolution authority. If no approved source can supply it without runtime-authority expansion, that decision returns through Advisor to Leo/GPT — the Worker must not decide it.

| Overlay category | Exact accepted source (active, unresolved) | Canonical Korean detail (retained verbatim) | Icon + non-color token |
|---|---|---|---|
| **`AUTHORITY_SECURITY_HOLD`** | `BlockerKind.AUTHENTICATION_REQUIRED`, `BlockerKind.UNEXPECTED_APPROVAL_PROMPT`, `BlockerKind.WRONG_ACTOR_OR_WORKSPACE`, `BlockerKind.MANUAL_KILL_SWITCH`, or `AlertKind.AUTHENTICATION_REQUIRED` | `인증 필요` · `예상하지 못한 승인 요청` · `역할 또는 작업공간 불일치` · `수동 킬 스위치 작동` (the exact source label, per `src/ui/i18n/ko.ts`) | `▲` + text `권한/보안 홀드` |
| **`DECISION_CRITICAL_CONFLICT`** | `BlockerKind.SCOPE_CONFLICT` **only** | `범위 충돌` | `◆` + text `범위 충돌` |

- A generic `AlertKind.MANUAL_ACTION_REQUIRED` alone is **not** enough to assert a hold. `MISSING_LEO_DECISION` / `AlertKind.NEEDS_LEO_DECISION` remain the **separate** existing `Leo/GPT 결정 필요` presentation (the C-1 NEEDS_LEO path) and are **not** renamed as conflict.
- **Precedence (deterministic):** `AUTHORITY_SECURITY_HOLD` > `DECISION_CRITICAL_CONFLICT` > the C-1 operational states. When multiple accepted critical sources coexist, the highest-precedence one is the label icon, and **all** meanings remain available in the pinned card / drawer / semantic announcement — a higher-severity or decision-required condition is **never** hidden.
- **Fail-closed:** resolved/suppressed sources do not render; missing, stale, malformed, conflicting, or unverified source evidence → the existing **neutral unknown** presentation (`◦ 상태 불명`); it must **not** assert a hold or conflict.
- **Non-color meaning:** every overlay carries icon + Korean text (color is never the only signal); the semantic mirror announces the exact category + source label.

## 5. Interaction contract

- **I-1** hover/focus → quick card; blur/exit → close.
- **I-2** click/tap → pin one compact card (desktop) / open compact bottom sheet (mobile).
- **I-3** select another actor → replace the pinned card/sheet content (never a second pinned card).
- **I-4** empty-space click / empty-Office tap → close; **Escape → close**; focus restored to the invoker.
- **I-5** `상세 보기` → full drawer; drawer is keyboard-reachable with focus trap + Escape.
- **I-6** Mobile flow is exactly `Tap actor → compact bottom sheet → 상세 보기 → full drawer`.
- **I-7** **Relationship lines are hidden by default**; they appear **only** for explicit actor/Team/relationship selection and are never ambient.

## 6. Korean-first, Mission Board, and Advisor conversation contract

- **K-1** Natural user-facing UI is Korean. Technical IDs, SHAs, schema names, WorkUnit IDs, and model names remain **exact**.
- **K-2** Each Pod exposes a compact **Team Mission Board**: Team/project, current mission, progress, state, blocker, Leo decision, next action, **KST verification time** — **without fabrication**. Unknown remains unknown. KST is converted **only from accepted verified UTC** (A1R-U08).
- **K-3** Advisor selection and conversation belong in the Living Office: accessible Advisor selector, selected-Advisor identity, desktop chat panel / mobile sheet, Founder-facing transcript, unread state, completion/decision notifications, truthful delivery state.
- **K-3.1 Mobile Advisor conversation sheet (SDR-05).** On mobile, the Advisor conversation is a bottom sheet, `DELIVERY_DISABLED` and **input-locked**, that shares mobile space with the actor bottom sheet under these exact rules:
  - **Mutual exclusion / replacement:** the Advisor sheet and the actor bottom sheet **never stack** — at most one sheet is open. Opening one **replaces** the other (and closes any open quick/pinned surface).
  - **Open trigger:** the `Advisor ▾` selector opens the Advisor sheet; tapping an actor opens the actor sheet.
  - **Selected-Advisor identity:** the sheet shows the selected Advisor (e.g. `Foundation Advisor`) and the Advisor selector; changing the selection replaces the sheet content, not a second sheet.
  - **Notifications / unread:** unread count and completion/decision notifications are shown as truthful state; no fabricated content.
  - **Input lock:** the composer is visibly locked with the exact `DELIVERY_DISABLED` reason; no send; no browser→agent dispatch.
  - **Close / focus:** back gesture, outside tap, and **Escape** close the sheet and **restore focus** to the invoking control.
  - **Drawer transition:** the actor sheet's `상세 보기` opens the full drawer; the Advisor sheet has no drawer transition (conversation-only).
- **K-4** The default transcript **excludes** raw tmux, full launchers, full test output, and repetitive patch chatter (safe summary only).
- **K-5** **`DELIVERY_DISABLED` by default.** Reuse of existing delivery is permitted **only** if later direct evidence proves literally **zero change** to authority, security, routing, audit, command target, and the browser-direct Worker/Reviewer prohibition (A1R-U03). Otherwise the shell designs only truthful selection/transcript/notification with **input locked**; no browser-to-agent dispatch.

## 7. Channy, accessibility, and semantic-equivalent contract

- **CH-1** Channy is a **recognizable Bedlington Terrier**, correctly scaled (~knee height), peripherally placed, **non-operational**. Ambient poses only (walk/patrol/sniff/head-tilt/light-scratch/eat/drink/sleep/affectionate). Channy has **no authority** (no interruption classification, tmux input, continue/retry/recover, approval, or capacity/billing/credential/DB/production/Git handling).
- **CH-2** **Ordinary visual mode:** the large actor list collapses behind `접근 가능한 에이전트 목록 (N)`; **screen-reader parity preserved**.
- **CH-3** The **semantic list becomes primary** for static/no-canvas, high-text, renderer failure, or explicit accessibility mode, opening the **same** single drawer and same facts.
- **CH-4** **Reduced motion** and **non-color meaning** are mandatory. Keyboard/focus reachability, 200% zoom, and contrast are required.

## 8. Superseded and preserved

**SUPERSEDED:** always-visible seven/nine sourced facts on every label/roster row; fixed 244×180 production card; required connector lines for displaced labels; always-visible complete semantic roster in ordinary mode; E2E gates asserting the seven facts on every visible label. Automated gates that force complete sourced facts into the always-visible layer are revised/removed **after** mockup approval.

**PRESERVED (not rewritten):** registry truth, identity/organization separation, fail-closed unknown sentinels, provenance, the full 17-field drawer, Technical Dashboard as secondary view, local/private runtime, auth/authority boundaries, no browser-direct Worker/Reviewer dispatch, rollback/safe stop, Grok quarantine, excluded historical-session boundary.

## 9. Later implementation acceptance gates (informative; not run during static design)

Implementation review begins with the **real product at original scale and 100% browser zoom**, then interactions, then truth/authority, then diff/tests. Automated `PASS` cannot override a failed product contract. Gates: zero label/silhouette overlap, zero required-content truncation, zero off-screen labels; **exactly one** pinned card; **zero default relationship lines**; named Team text; directly-visible critical states; separated Pods/desks; collapsed ordinary semantic list with preserved access; Korean labels; evidence-driven animation only; recognizable non-operational Channy; verified at actual default viewport, 1440×900, 1920×1080, mobile, elevated text, 200%, reduced/static, keyboard/focus; unscaled full-size actual screenshots.

## 10. Requirement traceability

Founder deliverables 1–14 and the spatial/behavior/information/Korean/Channy/semantic/deferred requirements map to §1–§9 of this contract and to `AGENT_OFFICE_A1R_LIVING_OFFICE_PRODUCT_EXPERIENCE_DESIGN.md` §5 and the mockups. Deferred capabilities and their gates are in `AGENT_OFFICE_A1R_DEFERRED_CAPABILITY_REGISTER.md`.
