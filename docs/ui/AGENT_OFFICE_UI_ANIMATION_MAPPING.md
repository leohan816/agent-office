# Agent Office UI and Animation Mapping

Status: `REVIEWED_DESIGN__BATCH_B_ACCEPTED__BATCH_C_SCENE_IMPLEMENTED__PWA_GATED`

This reviewed design defines the responsive, private PWA surface and the only
allowed mapping from structured events to visual activity. Batch B implements the
read-only local base dashboard, locale, pinned local icons, and stable responsive
layout at code commit `85e66d856e33a0df73041cb4b33aba30a8f9f96d`.
Advisor accepted that base as the Batch C dependency. The structured-event office
scene, bounded presentation cues, responsive mapping, local assets, reduced
motion, and Batch C accessibility/visual tests are implemented at code commit
`e30a6cda52e14a4bf30b2d1b7445fa26645496e5`. Advisor Inbox, HTTP/live data,
auth, SSE, PWA, and service worker remain unimplemented.

## 1. Experience Principles

- Quiet operations first: hierarchy, status, evidence, staleness, blockers, and
  decisions are clearer than decoration.
- Every animated state has adjacent text and icon semantics; motion is never the
  sole carrier of meaning.
- The scene reflects accepted structured events and verified projections only.
- Terminal prose, model text, CPU activity, process title, pane contents, and
  elapsed silence never determine a role's activity.
- State changes are restrained, deterministic, bounded, pauseable, and compatible
  with reduced motion.
- Desktop and mobile expose the same authority/evidence facts, not a simplified
  mobile truth.
- Stale/offline/conflicted evidence is visually explicit and never made to look
  current by animation.

## 2. Information Architecture

The PWA has five primary destinations:

1. **Office**: stable role stations and current structured activity.
2. **Missions**: Initiative -> Package -> Mission -> Phase -> WorkUnit hierarchy,
   numerator/denominator, dependencies, states, and evidence.
3. **Advisor Inbox**: immutable message receipt, delivery, acknowledgement,
   intake, decision, and resume status.
4. **Alerts**: blockers, stale evidence, security/transport/recovery alerts, and
   acknowledgement/resolution distinction. Alert cards consume only the canonical
   `AlertKind` and `BlockerKind` vocabularies in the domain contract.
5. **Evidence**: verified Git/artifact/review/decision references, hashes,
   freshness, and projection revision.

Global chrome always shows network mode (`LOOPBACK_PRIVATE` or a future approved
mode), projection revision, freshness, transport delivery state, and an offline
indicator. It never shows a generic command box.

### 2.1 Batch B as-built base dashboard

- `src/application/queries/dashboard-view-model.ts` projects only a versioned
  mission snapshot, typed observations, typed blockers, required gates, and
  verified evidence. Terminal prose/process/pane content is not an input.
- `src/ui/dashboard.tsx` renders the actual mission operations first screen:
  hierarchy, distinct WorkUnit/gate progress, future-unapproved scope, operational
  table, freshness banners, blocker reason/owner/action detail, and copyable
  read-only evidence.
- UI controls are limited to filtering, selection, native expansion, navigation,
  and clipboard copy. No form or handler can dispatch to Advisor, a role, Git,
  tmux, shell, or arbitrary path/target.
- `src/ui/styles.css` fixes desktop/mobile geometry, semantic table scrolling,
  `min-width: 0`, long-value wrapping, 320px reflow, and contains no animation or
  transition declaration.
- `src/ui/fixtures/dashboard.ts` supplies one approved-source snapshot plus a
  clearly named synthetic review fixture. The approved immutable manifest is not
  rewritten to claim later WorkUnit progress.
- React/React DOM 19.2.7, Lucide React 1.24.0, and Vite 8.1.4 are exact-pinned;
  `src/ui/assets/LICENSES.md` records local bundle licensing. No remote asset is
  loaded.

### 2.2 Batch C as-built office scene

- `src/ui/scene/types.ts` defines eight stable station identities and the only
  typed `RoleSceneProjection` input. `state-machine.ts` is a pure projector over
  accepted UUIDv7 IDs, primary WorkUnit state, RoleActivity, explicit evaluation
  time, freshness/connection, and typed safety/evidence overlays.
- `office-scene.tsx` renders a full-width unframed first-screen workspace before
  the Batch B dashboard grid. Desktop/tablet use an eight-station 4x2 plan;
  narrow/short viewports use explicit two-station pagination.
- Initial load, reload, and tab resume are static. New accepted live IDs can
  produce one bounded cue; event IDs deduplicate, same-entity bursts honor safety
  precedence, and at most three transient cues remain.
- Dispatch/result/decision paths carry exactly one local courier actor and one
  typed document. Working animates the local keyboard/actor, while testing,
  result writing, review, and recovery animate distinct checklist/document/tool
  assets. WAITING_LEO leaves a persistent red decision document at Leo.
- Motion preference, visibility pause, cue completion, selection, pagination,
  and deterministic fixture selection are browser-local presentation state only.
  They do not append events, change a WorkUnit, call an adapter, or claim live
  observation.
- Semantic role/status lists, roving keyboard focus, icon/text/shape semantics,
  44px scene controls, polite/assertive live regions, reduced-motion behavior,
  and an accessible activity log are implemented and browser-tested.

## 3. Hierarchy and Mission Views

### 3.1 Hierarchy rail/tree

- Initiative and Package nodes expand to Missions; Mission expands to Phases;
  Phase expands to WorkUnits.
- Each node has stable ID, display label, state text, count, open-alert count, and
  stale/conflict marker.
- WorkUnits display `dependsOn`, actor, attempt, last accepted event sequence, and
  evidence policy status.
- Keyboard Left/Right collapses/expands; Up/Down changes node; Home/End moves to
  boundaries. Screen readers receive level, expanded state, position, and count.

### 3.2 Counting

Mission progress displays `completed / denominator` plus manifest version. A scope
change opens a history view with old/new totals, exact changed WorkUnits, reason,
authority artifact, and hashes. Historical percentages retain their historical
denominator. The UI never animates or smooths a denominator change as ordinary
progress.

### 3.3 WorkUnit detail

The detail view has fixed sections:

- current state and prior resumable state;
- phase/dependencies/attempt/assigned actor;
- accepted transition timeline ordered by mission sequence;
- blockers, decisions, review verdict routing, and alerts;
- completion policy checklist with verified/stale/missing evidence; and
- immutable result, review, Git, and authority references.

`RESULT_REPORTED` is labeled "Result reported - not completed" until policy
evidence is satisfied. `PASS_WITH_RISK` never appears as green/completed without a
linked Leo/GPT acceptance record.

### 3.4 Canonical Korean user-facing vocabulary

Fixed system nouns and state/action labels come from the reviewed Korean locale
table below. An implementer must not invent, paraphrase, or machine-translate them.
Dynamic entity names preserve the manifest's `labelKo` byte-for-byte. If
`labelKo` is absent, the UI shows the canonical `label` plus a locale-missing
indicator; it does not silently synthesize Korean.

#### Hierarchy labels

| Locale key | Canonical English concept | Canonical Korean label |
|---|---|---|
| `hierarchy.initiative` | Initiative | `활성 작업 묶음` |
| `hierarchy.package` | Package | `패키지` |
| `hierarchy.mission` | Mission | `현재 미션` |
| `hierarchy.phase` | Phase | `단계` |
| `hierarchy.workUnit` | WorkUnit | `세부 작업` |

#### Required WorkUnit observable labels

| Exact observable name | Canonical Korean label |
|---|---|
| `QUEUED` | `대기열` |
| `READY` | `준비됨` |
| `DISPATCHING` | `작업 전달 중` |
| `READING` | `읽는 중` |
| `WORKING` | `작업 중` |
| `TESTING` | `테스트 중` |
| `WRITING_RESULT` | `결과 작성 중` |
| `RETURNING_RESULT` | `결과 반환 중` |
| `REVIEWING` | `검토 중` |
| `NEEDS_PATCH` | `수정 필요` |
| `WAITING_DEPENDENCY` | `선행 작업 대기` |
| `WAITING_LEO` | `Leo/GPT 결정 대기` |
| `BLOCKED` | `차단됨` |
| `COMPLETED` | `완료` |
| `FAILED` | `실패` |
| `CANCELLED` | `취소됨` |

#### Batch B durable-primary and fallback labels

These entries close the reviewed Fable5 R-1 residual without changing the
required observable mapping. `WAITING_ADVISOR` and `HOLD` are durable primary
states; `UNKNOWN_OR_STALE` is the fail-closed observable fallback.

| Exact projection name | Canonical Korean label |
|---|---|
| `WAITING_ADVISOR` | `Advisor 확인 대기` |
| `HOLD` | `보류` |
| `UNKNOWN_OR_STALE` | `알 수 없거나 오래된 상태` |

The UI obtains the exact observable name from the deterministic two-axis mapping
in Domain Section 6.3, then performs this direct lookup. It never labels primary
`DISPATCHED`, `RUNNING`, `RESULT_REPORTED`, or `REVIEW_PENDING` as a renamed
user-facing substitute without the required activity pair.

#### Alert kinds and actions

| AlertKind | Canonical Korean label |
|---|---|
| `NEEDS_LEO_DECISION` | `Leo/GPT 결정 필요` |
| `PASS_WITH_RISK` | `위험 조건부 통과` |
| `BLOCKED` | `차단됨` |
| `AUTHENTICATION_REQUIRED` | `인증 필요` |
| `MANUAL_ACTION_REQUIRED` | `수동 조치 필요` |
| `FINAL_APPROVAL_REQUIRED` | `최종 승인 필요` |
| `MISSION_COMPLETE` | `미션 완료` |
| `MISSION_FAILED` | `미션 실패` |
| `INFORMATION` | `안내` |

| Canonical action code | Canonical Korean label |
|---|---|
| `COPY_GPT_PACKAGE` | `GPT용 패키지 복사` |
| `OPEN_EVIDENCE` | `증거 열기` |
| `REPLY_TO_ADVISOR` | `Advisor에게 답변` |
| `HOLD` | `보류` |
| `PAUSE_MISSION` | `미션 일시정지` |
| `CANCEL_MISSION` | `미션 취소` |

Rendering an action never grants its authority. The UI shows only action codes
allowed by the canonical `AlertKind` payload and the authenticated capability;
disabled/hidden actions do not become alternate routes.

#### Blocker labels

| BlockerKind | Canonical Korean label |
|---|---|
| `MISSING_LEO_DECISION` | `Leo/GPT 결정 필요` |
| `MISSING_EVIDENCE` | `증거 누락` |
| `SESSION_NOT_READY` | `세션 준비 안 됨` |
| `SESSION_OFFLINE` | `세션 오프라인` |
| `WRONG_ACTOR_OR_WORKSPACE` | `역할 또는 작업공간 불일치` |
| `GIT_CONFLICT` | `Git 충돌` |
| `DIRTY_WORKTREE_CONFLICT` | `정리되지 않은 작업 트리 충돌` |
| `TEST_FAILURE` | `테스트 실패` |
| `AUTHENTICATION_REQUIRED` | `인증 필요` |
| `UNEXPECTED_APPROVAL_PROMPT` | `예상하지 못한 승인 요청` |
| `SCOPE_CONFLICT` | `범위 충돌` |
| `DEPENDENCY_FAILED` | `선행 작업 실패` |
| `TIMEOUT` | `시간 초과` |
| `ARTIFACT_MISSING` | `산출물 누락` |
| `COMMIT_NOT_PUSHED` | `커밋이 푸시되지 않음` |
| `MANUAL_KILL_SWITCH` | `수동 킬 스위치 작동` |

`reasonCode` detail uses an explicitly reviewed locale entry
`blocker.reason.<reasonCode>`. If that entry is absent, the UI renders the
canonical `BlockerKind` Korean label followed by the stable reason code in
parentheses. It never machine-translates or invents a detail string.

#### Progress labels

| Progress key | Canonical Korean label | Required rendering |
|---|---|---|
| `progress.workUnitCount` | `세부 작업 진행률` | Evidence-backed completed WorkUnits / manifest denominator, with manifest version |
| `progress.requiredGate` | `필수 게이트 진행률` | Passed required gates / required-gate denominator |

The two progress values are displayed separately and are never merged into one
percentage. A scope change updates only the WorkUnit-count denominator for its new
manifest version; gate progress changes only through structured gate evidence.

## 4. Office Scene Model

### 4.1 Stable stations

Role stations have stable keys independent of screen position:

- Leo/GPT decision station;
- Advisor routing/inbox station;
- Agent Office Worker station;
- Fable5 Reviewer station; and
- optional registered project/role stations shown only from trusted registry data.

Stations do not imply a session exists. Missing/stale registry evidence shows an
outlined unavailable station with last verified time. The scene never invents a
person/avatar from a model name.

Batch C fixes the visible plan to Leo/GPT, Advisor, Control, Fable5 Reviewer,
Foundation Worker, Shashu Worker, Cosmile Worker, and Agent Office Worker. Neutral
project-authored actor shapes represent stations rather than model/person
identity. Leo is the decision-document destination; Advisor is the dispatch and
result-tray destination.

### 4.2 Render input

The scene consumes a `RoleSceneProjection` only:

```text
projectionRevision
roleInstanceId
actorRole
missionId/workUnitId (optional)
activity enum
activitySourceEventIds[]
effectiveFrom/optionalExpiresAt
workUnitState
evidenceFreshness
openAlertSeverity
connectionState
```

Components cannot query tmux, Git, filesystem, or terminal output directly. If a
source event is unavailable or projection revision conflicts, the station renders
`UNKNOWN/STALE` without activity motion.

The as-built consumer is `RoleSceneProjection` in `src/ui/scene/types.ts`. A
source ID must be a valid accepted UUIDv7 included in the projection. Result
return additionally requires verified immutable result and pointer refs;
blocker/decision/recovery overlays retain their exact typed evidence. Extra
prose/process-shaped object properties are ignored.

## 5. Structured Event-to-Animation Mapping

All durations below are presentation constants, not domain timers. Each transition
runs at most once per accepted source event ID and is deduplicated across reloads.

| Required activity | Structured trigger | Full-motion cue | Static/text cue | End condition |
|---|---|---|---|---|
| `IDLE` | Explicit `RoleActivityChanged(IDLE)` or expiry overlay with no persistent blocking state | Very subtle 4-second status-light opacity cycle, no object movement | Neutral desk, `Idle` label | New higher-sequence activity |
| `DELIVERY` | Correlated WorkUnit `READY -> DISPATCHED` plus `RoleActivityChanged(DELIVERY, WORKUNIT_DISPATCH)`, or `NotificationDeliveryStarted` for fixed Advisor delivery | Envelope/pointer moves along a fixed path for 700 ms once | `Dispatching` for WorkUnit dispatch; `Delivering to Advisor` for Advisor notification | WorkUnit starts/fails/blocks, delivery receipt/failure, or 2-second visual expiry |
| `READING` | `AdvisorMessageAcknowledged`, `AdvisorIntakeRecorded`, or explicit structured reading activity | Document highlight moves once over 900 ms | Open-document icon plus `Advisor reading` | Intake/decision activity or explicit expiry |
| `WORKING` | `WorkUnitStateTransitioned(..., RUNNING)` or structured working event | Low-amplitude desk indicator cycle, max 2 repeats per event | Tool/desk icon plus `Working` and WorkUnit ID | State/activity transition |
| `TESTING` | WorkUnit enters `TESTING` with command/evidence refs | Checklist rows illuminate sequentially once, 1.2 s | Checklist icon plus `Testing` | Test result/state transition |
| `WRITING_RESULT` | `RoleActivityChanged(WRITING_RESULT, RESULT_DRAFT_STARTED)` while primary state remains `RUNNING` or `TESTING` | Result document gains bounded lines/check marks once, 900 ms | Document-edit icon plus `Writing result` | Verified `RESULT_REPORTED`, return to work/testing, block/wait/fail, or expiry |
| `REVIEW` | WorkUnit enters `REVIEW_PENDING` or structured Fable5 review event | Review lens sweeps one bounded panel once, 1 s | Review icon plus `Independent review` | Verdict/state transition |
| `BLOCKED` | WorkUnit `BLOCKED`, open blocker, critical evidence conflict | No repeated motion; barrier appears with 150 ms fade | Barrier icon, blocker reason, route, age/freshness | `BlockerResolved` plus resume transition |
| `WAITING_LEO` | WorkUnit `WAITING_LEO` and open Decision `REQUESTED/ACKNOWLEDGED` | One gentle decision beacon expansion, then static | Decision icon plus `Waiting for Leo/GPT` | Canonical decision/resume or route change |
| `RESULT_RETURN` | `RESULT_REPORTED` plus immutable Worker result/pointer verified | Result folder moves once to Advisor tray for 800 ms | Return icon plus `Result returned to Advisor` | Advisor intake/review route or visual expiry |
| `RECOVERY` | `RecoveryStarted`, store rebuild, restore, or quarantine workflow | Bounded progress arc driven by structured recovery step count, never indeterminate spin over 10 s | Recovery icon, exact step/status, read-only/quarantine label | `RecoveryCompleted`/`RecoveryFailed` |

No cue is triggered by substring matching such as "testing", "done", or
"blocked" in terminal/model text.

Batch C implements every row through direct lookup of the exact required
observable name. Delivery is pinned to Advisor pickup -> target -> handoff ->
Advisor return; result return is target pickup -> Advisor -> tray handoff; patch
return is Fable5 -> Agent Office Worker. Each full-motion sequence is 1200 ms or
less, uses transform/opacity only, and ends in the static projected state.

## 6. Visual Precedence and Concurrency

One station renders one primary activity. The winner is selected from accepted
events using this deterministic precedence:

```text
RECOVERY
  > WAITING_LEO
  > BLOCKED
  > REVIEW
  > RESULT_RETURN
  > WRITING_RESULT
  > TESTING
  > DELIVERY
  > READING
  > WORKING
  > IDLE
```

A `CRITICAL` alert is a persistent station border/banner overlay, not a replacement
activity. Offline/stale/conflicted overlays suppress all motion and display the
last accepted activity as stale text. For equal precedence, greater mission
sequence wins; ties use event ID lexical order only for deterministic display.

The Batch C reducer implements this exact precedence. Persistent safety winners
suppress lower-precedence cues for the same station; a critical alert is an
immediate static border/warning overlay. Missing/stale sources select
`UNKNOWN_OR_STALE` and suppress the queue rather than preserving apparent
activity.

Transient presentation expiry does not append domain state. Persistent WorkUnit,
blocker, decision, recovery, and stale states remain until their structured exit
event.

## 7. Motion Rules

- Initial navigation never replays the entire event history. Only a not-yet-shown
  live source event may run a transition; current state otherwise renders static.
- Spatial transitions are 150-1200 ms and never loop indefinitely except the
  optional low-amplitude idle/status indicator.
- No flashing, rapid color alternation, shaking, screen-scale zoom, parallax, or
  autoplay sound.
- Live events arriving in a burst are coalesced by entity: persistent states win;
  at most three transient cues queue, with the rest summarized as text.
- Page visibility pause stops animation. Resume renders current projection and
  does not replay stale cues.
- Animation cannot delay display of blocker, decision, alert, or evidence text.

The as-built CSS contains only bounded transform/opacity keyframes, no transition,
flash, shake, parallax, sound, or indeterminate progress. Visibility applies
`animation-play-state: paused`; resume folds the current fixture with
`TAB_RESUME`, marks IDs seen, and queues nothing.

## 8. Reduced Motion and Accessibility

Target: WCAG 2.2 AA for implemented surfaces.

When `prefers-reduced-motion: reduce` is set or the in-app motion control is off:

- all object translation, sweep, pulse, and progress interpolation is removed;
- state changes use an immediate icon/text/color update or a single opacity change
  no longer than 100 ms;
- live changes remain available in a user-configurable, non-interruptive activity
  log; and
- the setting persists as non-sensitive preference only.

Accessibility requirements:

- full keyboard operation with visible focus and skip links;
- semantic landmarks, headings, lists, tables, buttons, dialogs, and tree roles;
- no color-only status; every state has icon and text;
- text/interactive contrast meets AA; focus indicators meet non-text contrast;
- a polite live region announces ordinary state changes; critical blockers use an
  assertive announcement once, never repeatedly;
- dialogs trap and restore focus; drawers do not hide focused elements;
- touch targets are at least 44 by 44 CSS pixels;
- zoom to 200% and reflow at 320 CSS-pixel width without loss of function; and
- timestamps expose absolute UTC/local rendering and freshness, not relative text
  alone.

Batch C automated axe audits report no WCAG A/AA violations for current and
safety fixtures. Chromium tests cover roving focus, visible focus styling,
44-pixel controls, status text/icon/shape, semantic lists, polite/assertive live
regions, and reduced-motion suppression. Dialog/drawer requirements remain tied
to later surfaces because Batch C creates neither.

## 9. Color, Icon, and Asset Strategy

### 9.1 Design tokens

Semantic tokens, not hardcoded entity colors, cover background, surface, border,
text, focus, info, success, warning, critical, blocked, waiting, stale, and
conflicted. Light/dark palettes are tested independently. Completion success is
reserved for evidence-backed completion; result reporting uses an informational
color.

### 9.2 Icons

- Use a small locally bundled SVG icon registry mapped to semantic names.
- Pin the source/version/license during implementation and keep a license inventory.
- Normalize view boxes and stroke/fill; do not load icons from a CDN.
- Icons are decorative beside visible text unless they have an explicit accessible
  label.
- Emoji and model/provider logos are not status icons.
- Security/authority states use distinct shapes, not merely colors.

### 9.3 Scene assets

The default scene is code-rendered layout plus reviewed local SVG assets. Raster
assets, if later approved, have deterministic dimensions, content hashes,
attribution/license records, and 1x/2x variants. No remote image fetch, tracking
pixel, user-supplied SVG execution, or image-generated claim is allowed.

Batch C assets live under `src/ui/scene/assets/`; semantic dimensions/source are
in `src/ui/scene/asset-registry.ts`; ownership, license classification, stable
view boxes, and source SHA-256
`abdeeae29cb351a7739684f7e059130e3e1c11cf02f42dd8f8caccb63db5de72` are
recorded in `ASSET_INVENTORY.md`. They are local project-authored code-native SVG
components with no script, remote fetch, user SVG execution, model logo, or real
person claim.

## 10. Stable Layout and Text Overflow

### 10.1 Geometry invariants

- Every station uses a fixed aspect-ratio box and reserved status/label areas.
- Icons and avatars use explicit width/height; image load cannot shift layout.
- Animation uses transforms/opacity, not layout-changing width/height/top/left.
- Skeletons match final component dimensions.
- Count/state badges reserve bounded space and use tabular numerals.
- Drawers/panels animate over content or use a predefined grid track; they do not
  cause repeated scene reflow.

### 10.2 Text rules

- Flex/grid children that hold text use `min-width: 0`.
- Human labels wrap normally; long IDs/hashes use controlled `overflow-wrap:
  anywhere` in a monospace detail field.
- Primary cards allow at most two label lines, then expose the full value through
  focus/click detail, never hover alone.
- Message subject/body wrap without horizontal page overflow; code/hash blocks get
  their own scroll container and copy action.
- Tables remain semantic and use a labeled horizontal scroller on narrow screens.
- Dynamic translated text is tested with 200% expansion even though M01 content
  may initially be English/Korean.

## 11. Responsive Layout

Breakpoints are content-driven candidate defaults:

### Wide (`>= 1200px`)

- 280px hierarchy rail;
- flexible office/workspace center with 16:9 bounded scene;
- 360px evidence/inbox inspector;
- global status bar across the top.

### Medium (`768px-1199px`)

- collapsible 240px hierarchy rail;
- center scene/workspace;
- inspector as overlay drawer with explicit open state and focus management.

### Small (`< 768px`)

- compact top bar and persistent network/stale badge;
- office scene with min/max height and horizontal station pagination only when
  necessary;
- bottom navigation for Office, Missions, Inbox, Alerts, Evidence;
- detail content in full-screen sheets, not nested narrow columns; and
- no hover dependency.

Orientation change, software keyboard, display cutout safe areas, 320px width,
200% zoom, and long content cannot hide the message submit/receipt state or STOP
alerts.

## 12. Advisor Inbox UI

The compose form contains mission, structured kind, subject, text, and allowlisted
entity references. It never contains role/session/pane/command fields.

Submission behavior:

1. Generate/preserve `requestId` before POST.
2. Disable only duplicate local submission while request is in flight.
3. On timeout, present retry with the same request ID, never a new implicit ID.
4. Show durable `PERSISTED` receipt fields and hash after success.
5. Separately show delivery, Advisor acknowledgement, intake, decision, and resume
   states with timestamps/evidence.
6. `MANUAL_FALLBACK_REQUIRED` shows the pointer/hash and tells the user Advisor
   routing is required; it does not offer Worker/Reviewer alternatives.
7. Offline mode disables submission and background queueing.

Message content is rendered as sanitized text/limited Markdown. The UI never
turns fenced code or shell-looking text into an executable control.

## 13. Alerts and Recovery UI

- Alerts group by entity and deterministic deduplication key.
- Acknowledge and resolve are separate controls/statuses.
- Snoozed alerts show wake time; suppressed alerts show the rule/evidence.
- Critical security, corruption, transport, stale-evidence, and WAITING_LEO items
  remain visible across navigation.
- Recovery mode replaces mutation controls with read-only/quarantine status,
  exact recovery step, checkpoint/hash, and manual runbook link.
- Backup/restore/rollback proof is displayed from immutable operation receipts, not
  a success toast alone.

## 14. PWA Install, Offline, and Update UX

- Install prompt is user-initiated and appears only after installability criteria
  pass; no coercive repeated banner.
- Installed display mode preserves visible private/network/offline status.
- Offline shell shows last verified projection revision and time, disables all
  mutation controls, and never claims queued delivery.
- A new service worker displays `Update available`; activation occurs after user
  consent or a safe no-dirty-form point.
- If schema versions are incompatible, the app requires reload and full snapshot;
  it never applies old cached projection logic.
- A failed service worker exposes a browser-specific unregister/reload recovery
  instruction without deleting server data.

## 15. UI Acceptance Tests

Batch B component/view-model tests cover the base hierarchy, all reviewed
Korean labels including the three R-1 entries, separate progress denominators,
typed freshness banners, blocker detail, evidence copy, terminal-prose exclusion,
long IDs/hashes/Korean expansion, table scrolling, 320px rules, and absence of
PWA/server surfaces. Batch C adds 27 Vitest files/123 total regression tests and
10 Playwright Chromium tests, including three committed deterministic visual
baselines; the remaining Batch D/E scope stays gated.

Batch C test paths now cover:

- the exact 16 required observable names, every primary/activity pairing in Domain
  Section 6.3, `WRITING_RESULT` between work/testing and result return, and
  event-ID deduplication;
- proof that terminal/prose/process fixtures cannot change activity;
- precedence, stale/offline suppression, burst coalescing, reload, and tab resume;
- reduced motion and no-flash behavior;
- keyboard/focus, semantic status list, live region, touch target, and axe
  contrast audits; later dialog/drawer focus remains gated;
- wide/medium/320px mobile, portrait/landscape, 200% zoom, and text expansion;
- long IDs, hashes, labels, messages, tables, and translated content without page
  overflow or layout shift;
- deterministic visual regression snapshots using projection fixtures, not live
  tmux/prose.

Remaining Batch D/E test paths must cover:

- PWA installability, offline read-only, no mutation queue, update, and cache
  exclusion tests;
- Advisor form schema proving no role/session/command target; and
- exact Korean alert/action/inbox usage beyond the already implemented
  hierarchy/status/blocker/progress labels, unknown
  reasonCode fallback, preserved `labelKo`, and proof no silent translation; and
- later dialog/drawer focus restoration and PWA offline/update accessibility.

## 16. Local Traceability

| DESIGN_REQUIREMENT | IMPLEMENTATION_PATH | TEST_PATH | CURRENT_EVIDENCE | STATUS | DEFERRED_GATE |
|---|---|---|---|---|---|
| AO-UI-001 Quiet responsive hierarchy/operations UI with fixed Korean hierarchy/progress vocabulary | `src/ui/dashboard.tsx`, `src/ui/styles.css`, `src/application/queries/dashboard-view-model.ts`, `src/ui/i18n/ko.ts` | `tests/ui/dashboard.component.test.tsx`, `tests/ui/dashboard-view-model.test.ts`, `tests/ui/korean-vocabulary.test.ts`, `tests/ui/layout-contract.test.ts` | Responsive Batch B operations base was Advisor-accepted; Batch C preserves it and inserts the scene before the grid | `IMPLEMENTED_THROUGH_BATCH_C__PENDING_ADVISOR_ACCEPTANCE` | Live/server/PWA behavior remains Batch E |
| AO-UI-002 Structured-event-only 16-name conformance and animations including result writing | `src/ui/scene/` | `tests/ui/activity-mapping.test.ts`, `tests/ui/activity-precedence.test.ts`, `tests/ui/scene-boundary.test.ts`, `tests/contract/required-observable-conformance.test.ts` | Exact mapping, accepted-ID provenance, evidence fail-closed, precedence, bounded order, dedup/burst/reload/resume, and prose exclusion pass at `e30a6cda52e14a4bf30b2d1b7445fa26645496e5` | `IMPLEMENTED_BATCH_C__PENDING_ADVISOR_ACCEPTANCE` | Advisor Batch C acceptance |
| AO-UI-003 Accessibility/reduced motion | `src/ui/scene/office-scene.tsx`, `src/ui/styles.css` | `tests/ui/office-scene.component.test.tsx`, `tests/e2e/accessibility.spec.ts`, `tests/e2e/office-scene.spec.ts` | Semantic list/live regions/roving focus/44px controls, motion toggle, visibility pause, reduced-motion suppression, axe A/AA, and responsive browser gates pass | `IMPLEMENTED_BATCH_C_SCENE_SUBSET__PENDING_ADVISOR_ACCEPTANCE` | Later dialog/drawer/PWA accessibility remains Batch D/E |
| AO-UI-004 Local asset/icon licensing and stable dimensions | `src/ui/assets/LICENSES.md`, `src/ui/scene/asset-registry.ts`, `src/ui/scene/assets/` | `tests/ui/layout-contract.test.ts`, `tests/e2e/office-scene.spec.ts` | Exact-pinned Lucide plus project-authored local actor/desk/document/barrier/tool/warning SVG source with pinned SHA-256, ownership/license inventory, explicit dimensions, and stable screenshots | `IMPLEMENTED_BATCH_C__PENDING_ADVISOR_ACCEPTANCE` | Advisor Batch C acceptance |
| AO-UI-005 Advisor inbox receipt/ack/intake/decision UX | `src/ui/inbox/` | `tests/e2e/advisor-inbox.spec.ts` | `NOT_IMPLEMENTED`; Section 12 | `DESIGNED_CANDIDATE` | Batch D/E |
| AO-UI-006 Canonical typed alert/blocker/recovery/stale evidence UX | `src/application/queries/dashboard-view-model.ts`, `src/ui/dashboard.tsx`, `src/ui/scene/` | `tests/ui/dashboard-view-model.test.ts`, `tests/ui/activity-mapping.test.ts`, `tests/e2e/office-scene.spec.ts` | Accepted Batch B blocker/freshness detail plus Batch C immediate typed blocker, WAITING_LEO, patch, bounded recovery, critical, and stale scene overlays; lifecycle controls remain absent | `IMPLEMENTED_BATCH_C_PRESENTATION_SUBSET__PENDING_ADVISOR_ACCEPTANCE` | Full alert/recovery controls remain Batch D/E |
| AO-UI-007 PWA install/offline/update | `src/pwa/`, `src/ui/pwa/` | `tests/e2e/pwa-lifecycle.spec.ts` | `NOT_IMPLEMENTED`; Section 14 | `DESIGNED_CANDIDATE` | Batch E |
| AO-UI-008 Canonical Korean status/action/blocker vocabulary and deterministic fallback | `src/ui/i18n/ko.ts`, `src/ui/scene/office-scene.tsx` | `tests/ui/korean-vocabulary.test.ts`, `tests/ui/activity-mapping.test.ts`, `tests/e2e/office-scene.spec.ts` | Batch B exact vocabulary was accepted; Batch C directly renders all exact observable/durable fallback labels without translation or aliases | `IMPLEMENTED_THROUGH_BATCH_C__PENDING_ADVISOR_ACCEPTANCE` | Alert action/inbox usage remains Batch D |

Cross-document traceability is indexed in `docs/FEATURE_INDEX.md`.
