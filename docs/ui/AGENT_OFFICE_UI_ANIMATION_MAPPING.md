# Agent Office UI and Animation Mapping

Status: `FINAL_PRODUCTION_RUNTIME_CLIENT_REWORK_IMPLEMENTED__REAL_AUTH_OPERATION_GATED__PENDING_DELTA_REVIEW`

This reviewed design defines the responsive, private PWA surface and the only
allowed mapping from structured events to visual activity. Batch B implements the
read-only local base dashboard, locale, pinned local icons, and stable responsive
layout at code commit `85e66d856e33a0df73041cb4b33aba30a8f9f96d`.
Advisor accepted that base as the Batch C dependency. The structured-event office
scene, bounded presentation cues, responsive mapping, local assets, reduced
motion, and Batch C accessibility/visual tests are implemented at code commit
`e30a6cda52e14a4bf30b2d1b7445fa26645496e5`. Visual baseline correction
`ad74b9e8f98298269534676237a66cfaac055e00` and Playwright process-locale
correction `243d3a5731a6b22c29caeaba6567aed505f78d59` make the committed images
reproducible across the approved `C.UTF-8` and `ko_KR.UTF-8` caller contexts on
the configured local browser/font runtime. Advisor accepted Batch C as the Batch
D dependency. Batch D Inbox/Alerts code/tests are implemented at
`7366036f8a1e6fc9d4e911e8d193e17eeb95f54c` and were accepted as the Batch E
dependency. Batch E PWA/runtime-strip code/tests/assets are implemented at
`e0a11f69fffc9d35d67cc478cbefbb92d93cf528`. Final rework commit
`0f90e39d3995ffca97eb7a05ef051d8f9a3719c1` replaces the production fixture
entry with the typed status/projection/SSE client and keeps synthetic fixtures
behind explicit `test-demo` mode. Real authenticated operation remains gated
because no real provider/credential is approved.

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

### 2.3 Batch D as-built communication center

- `src/ui/communication/communication-center.tsx` is mounted after the existing
  operations grid and exposes Inbox/Alerts tabs only. Compose fields are mission,
  one of five message kinds, subject, body, and allowlisted entity checkboxes.
- A stable request ID is visible before submission. The direct typed application
  port can report only a `PERSISTED` receipt; delivery, acknowledgement, intake,
  decision, resume, and close remain distinct timeline rows with evidence refs.
- The test/demo fixture is explicitly `SYNTHETIC_READ_ONLY`: submit and alert
  lifecycle mutations are disabled, no acknowledgement is claimed, and pause/
  cancel/reply actions prepare an unsent Advisor draft only. It is no longer the
  production default and is selected only by explicit `test-demo` build mode.
- Alert cards render the nine canonical kinds, severity/state/occurrence/dedup,
  blocker reason, resolution owner, next action, safe default, facts, unknowns,
  question, options, recommendation, blocked capability, and evidence. Critical
  alerts persist when switching Inbox/Alerts.
- GPT copy is byte-equal to the domain package renderer's exact 13-field ordered
  Markdown. Copy/open/hold never approves, acknowledges, resolves, or executes.
- React text nodes and inert fenced code render hostile markup as text. At
  1440/1024/390/320, mobile landscape, and 200% text, the center has no page
  overflow or hidden submit/actions; all controls have at least 44px targets.
- Semantic role/status lists, roving keyboard focus, icon/text/shape semantics,
  44px scene controls, polite/assertive live regions, reduced-motion behavior,
  and an accessible activity log are implemented and browser-tested.

### 2.4 Final production runtime-client boundary

- `src/ui/main.tsx` mounts a virtual entry selected by Vite: production resolves
  only `src/ui/runtime/entry.tsx`; explicit `test-demo` resolves only
  `src/ui/demo-entry.tsx`.
- `AgentOfficeRuntimeClient` reads redacted status, validates the protected
  application projection/session context, tracks the revision cursor, consumes
  SSE projection/reset/revocation events, reconnects after a bounded delay, and
  clears protected state on auth failure, expiry, or revocation.
- The Advisor action port exists only when a parsed protected session includes
  `leo_input` and a bounded CSRF token. Alert acknowledgement separately rechecks
  `advisor_operator`. No role/session/pane/tmux/terminal target exists.
- With the production no-provider composition, the responsive UI renders the
  exact `AUTH_BLOCKED / READ_ONLY`, `AUTH_PROVIDER_UNAVAILABLE`, mutation-disabled,
  and disconnected-SSE facts. It does not display a fixture projection.
- A guarded synthetic composition test exercises this same client against the
  real HTTP/application/store/SSE path; this is test evidence only, not a claim of
  an approved real provider or private authenticated run.

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

Batch D implements this local typed-port UI under `src/ui/communication/`.
The final-rework production default is the runtime client, not a fixture. Because
no real authentication provider is approved, it receives only redacted status and
renders `AUTH_BLOCKED`/read-only; protected projection and the compose action port
remain absent. The explicit guarded synthetic composition proves the client/
application wiring without becoming a production login or provider switch.

The compose form contains mission, structured kind, subject, text, and allowlisted
entity references. It never contains role/session/pane/command fields.

Submission behavior:

1. Generate/preserve `requestId` before direct application or authenticated HTTP
   submission.
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

### 14.1 Batch E as-built PWA boundary

Commit `e0a11f69fffc9d35d67cc478cbefbb92d93cf528` adds:

- `public/manifest.webmanifest` and two project-authored local SVG icons;
- `public/sw.js`, which install-caches the fixed shell plus built hashed assets,
  caches only same-origin static GETs, excludes API/health/auth/message/artifact/
  alert/decision paths and `no-store`, and has no sync handler or mutation queue;
- `PwaRuntimeController`, with install-prompt capture, waiting-worker update only
  after user action, controller-change reload, offline/online state, and shell-
  cache-only unregister/reload recovery; and
- the persistent `RuntimeBoundary` showing `LOOPBACK_PRIVATE`, read-only/auth,
  app delivery/manual fallback, online/offline, worker/update, and recovery state.

Final rework makes `src/ui/runtime/entry.tsx` the production build entry and
`src/ui/demo-entry.tsx` an explicit `test-demo` entry. The production runtime
shell renders server-derived status and, only when authenticated, the application
projection and Advisor action port. It never silently imports the approved-source
or synthetic communication fixtures.

Because no approved real provider exists, the current UI truthfully renders
`AUTH_BLOCKED`, `READ_ONLY`, and delivery-disabled/manual-safe state; it does not
render a fake authenticated projection or queue offline submissions.

## 15. UI Acceptance Tests

Batch B component/view-model tests cover the base hierarchy, all reviewed
Korean labels including the three R-1 entries, separate progress denominators,
typed freshness banners, blocker detail, evidence copy, terminal-prose exclusion,
long IDs/hashes/Korean expansion, table scrolling, 320px rules, and absence of
PWA/server surfaces. Batch C adds 27 Vitest files/124 total regression tests and
10 Playwright Chromium tests, including three committed deterministic visual
baselines. `playwright.config.ts` normalizes `LANG` and `LC_ALL` to
`ko_KR.UTF-8` in the Playwright process and explicitly passes the same locale to
Chromium and the loopback Vite server; a focused acceptance contract verifies
that configuration without self-spawning the browser suite. The ordinary
10-test command passes from both `C.UTF-8` and `ko_KR.UTF-8` callers. Advisor
accepted that Batch C evidence as the Batch D dependency.

Batch D expands the complete regression to 35 Vitest files/149 tests and 15
sequential Chromium tests. Inbox/Alerts component and browser coverage verifies
the exact closed compose schema, read-only fixture, separate durable stages,
manual pointer/hash, canonical GPT copy, nine alert kinds/six Korean actions,
acknowledge-versus-resolve controls, inert hostile content, persistent critical
alerts, visible keyboard focus, 44px controls, WCAG A/AA, and
1440/1024/390/320/mobile-landscape/200%-text layout. Desktop, tablet Alerts, and
mobile Inbox were directly inspected. Existing three Batch C baselines remain
unchanged.

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
  tmux/prose; and
- caller-locale-independent browser/font selection on the configured host, with
  the three baseline bytes unchanged after process-locale normalization.

Batch E expands the complete regression to 50 Vitest files/196 tests and 18
sequential Chromium tests. `tests/ui/runtime-boundary.component.test.tsx`,
`tests/pwa/cache-policy.test.ts`, `tests/e2e/pwa-lifecycle.spec.ts`, and
`tests/e2e/pwa-cache-security.spec.ts` cover install prompt, user-gated update,
offline read-only state, no mutation queue, install-time hashed assets, sensitive
cache exclusion, and unregister recovery. The required runtime strip caused the
only visual delta: exactly the three scene baselines were regenerated under the
configured locale/runtime, directly inspected at desktop/mobile/reduced-motion,
and the 18/18 suite passes. Dialog/drawer focus remains inapplicable because no
new dialog/drawer was added.

Final rework expands the complete regression to 52 Vitest files/205 tests while
the same 18/18 Chromium suite and all three committed scene baselines pass
unchanged. `tests/integration/runtime-composition.test.ts` passes 4/4 for the
production no-provider shell, protected-route denial, guarded client projection/
SSE/idempotent message path, expiry/revocation, explicit demo mode, and cleanup.
The new production fail-closed page was directly inspected at desktop, mobile,
and reduced motion; it reflows without clipping and caused no snapshot update.

## 16. Local Traceability

| DESIGN_REQUIREMENT | IMPLEMENTATION_PATH | TEST_PATH | CURRENT_EVIDENCE | STATUS | DEFERRED_GATE |
|---|---|---|---|---|---|
| AO-UI-001 Quiet responsive hierarchy/operations UI with fixed Korean hierarchy/progress vocabulary | `src/ui/dashboard.tsx`, `src/ui/styles.css`, `src/ui/i18n/ko.ts`, `src/ui/communication/`, `src/ui/runtime/`, `src/ui/pwa/` | `tests/integration/runtime-composition.test.ts`, `tests/ui/dashboard.component.test.tsx`, `tests/ui/runtime-boundary.component.test.tsx`, `tests/e2e/communication-center.spec.ts`, `tests/e2e/pwa-lifecycle.spec.ts` | Accepted dashboard/scene/communication remain; production now uses the application runtime client and an exact responsive fail-closed page, while fixtures require explicit demo mode; desktop/mobile/reduced output is directly inspected and 18/18 browser tests pass unchanged | `IMPLEMENTED_FINAL_REWORK__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Real authenticated data/provider and AO-WU-14 posture remain gated |
| AO-UI-002 Structured-event-only 16-name conformance and animations including result writing | `src/ui/scene/` | `tests/ui/activity-mapping.test.ts`, `tests/ui/activity-precedence.test.ts`, `tests/ui/scene-boundary.test.ts` | Exact Batch C scene mapping is Advisor-accepted and all visual baselines remain unchanged in Batch D | `IMPLEMENTED_BATCH_C__ADVISOR_ACCEPTED` | None for scene mapping |
| AO-UI-003 Accessibility/reduced motion | `src/ui/scene/office-scene.tsx`, `src/ui/communication/`, `src/ui/pwa/`, `src/ui/styles.css` | `tests/ui/office-scene.component.test.tsx`, `tests/ui/runtime-boundary.component.test.tsx`, `tests/e2e/accessibility.spec.ts`, `tests/e2e/communication-center.spec.ts`, `tests/e2e/pwa-lifecycle.spec.ts` | Runtime strip uses semantic status/details/buttons; 44px, keyboard, reduced-motion, WCAG A/AA, offline warning, 320/200%-text and landscape gates pass | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Future live-auth focus transitions require real-provider review |
| AO-UI-004 Local asset/icon licensing and stable dimensions | `src/ui/assets/LICENSES.md`, `src/ui/scene/asset-registry.ts`, `src/ui/scene/assets/`, `public/icons/`, `playwright.config.ts` | `tests/ui/layout-contract.test.ts`, `tests/pwa/cache-policy.test.ts`, `tests/e2e/office-scene.spec.ts` | Accepted scene/local-font runtime remains; Batch E adds two licensed project-authored local PWA SVGs and intentionally updates exactly three inspected baselines for the visible status strip | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Cross-host/browser/font portability remains an operations prerequisite |
| AO-UI-005 Advisor inbox receipt/ack/intake/decision UX | `src/ui/communication/`, `src/ui/runtime/client.ts`, `src/server/application.ts`, `src/server/http/` | `tests/integration/runtime-composition.test.ts`, `tests/ui/communication-center.component.test.tsx`, `tests/integration/http-advisor-message.test.ts`, `tests/e2e/communication-center.spec.ts` | Production client supplies the existing action port only with protected `leo_input` plus CSRF context; guarded synthetic composition proves one PERSISTED/replayed message and SSE update, while production no-provider UI remains read-only | `IMPLEMENTED_FINAL_REWORK__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Real authenticated operation requires separate provider/AO-WU-14 authority |
| AO-UI-006 Canonical typed alert/blocker/recovery/stale evidence UX | `src/application/alerts/`, `src/ui/communication/`, `src/ui/scene/`, `src/ui/pwa/`, `src/operations/` | `tests/integration/alert-application.test.ts`, `tests/recovery/recovery-result.test.ts`, `tests/ui/runtime-boundary.component.test.tsx` | Accepted alert UI remains; PWA runtime exposes read-only/offline/manual/recovery controls while backup/restore success remains evidence artifacts, not a UI toast | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Rich live recovery projection awaits approved real binding |
| AO-UI-007 PWA install/offline/update and runtime selection | `src/pwa/`, `src/ui/pwa/`, `src/ui/runtime/`, `src/ui/demo-entry.tsx`, `vite.config.ts`, `public/` | `tests/integration/runtime-composition.test.ts`, `tests/pwa/cache-policy.test.ts`, `tests/ui/runtime-boundary.component.test.tsx`, `tests/e2e/pwa-lifecycle.spec.ts`, `tests/e2e/pwa-cache-security.spec.ts` | Existing PWA gates pass; production build resolves only the runtime client, explicit `test-demo` resolves fixtures, and smoke verifies the production asset excludes the synthetic critical fixture | `IMPLEMENTED_FINAL_REWORK__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Real authenticated operation remains gated |
| AO-UI-008 Canonical Korean status/action/blocker vocabulary and deterministic fallback | `src/ui/i18n/ko.ts`, `src/ui/scene/office-scene.tsx`, `src/ui/communication/`, `src/ui/pwa/` | `tests/ui/korean-vocabulary.test.ts`, `tests/ui/communication-center.component.test.tsx`, `tests/ui/runtime-boundary.component.test.tsx` | Accepted domain labels remain exact; Batch E security/PWA state codes are deliberately visible stable operational codes with no silent authority translation | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Product localization of new security codes requires a reviewed vocabulary change |

Cross-document traceability is indexed in `docs/FEATURE_INDEX.md`.
