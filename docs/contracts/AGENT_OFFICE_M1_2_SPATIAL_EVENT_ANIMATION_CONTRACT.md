# Agent Office M1.2 Spatial Event and Animation Contract

Status: `AO12_D_A1_PRODUCTION_FIXTURE_BOUNDARY_CORRECTED__FULL_TIER_MEASURED_ON_CONFIGURED_RUNTIME__PENDING_INDEPENDENT_REVIEW_AND_ADVISOR_ACCEPTANCE`

Contract candidate: `agent-office.spatial-cue.v1`

Projection dependency: `agent-office.spatial-office-projection.v1`

This document defines how already-accepted M1 structured evidence may produce a
bounded M1.2 presentation cue. It does not add a domain event, state, command,
authority, transport route, timer-based mission transition, or persistence
requirement. The canonical M1 event and activity contract remains
[`AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md`](AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md).
The design patch received a clean delta `PASS`, Advisor freeze, exact manifest,
and separate AO12-A/AO12-B/AO12-C handoffs. AO12-A implements the versioned source
projection, closed validation, M1 fallback, pure Team Pod projection, and
assignment/name invariants. AO12-B implements only the test-demo static shared
floor and the immediate text/icon/shape/list equivalents: it creates zero cue or
animation object and consumes no live delta. After corrected AO12-B review and
Advisor acceptance, AO12-C implements the pure cue projector/reducer and bounded
route, pose, verified-idle, and Channy presentation behind the explicit
`surface=spatial-motion` synthetic test-demo selector. After focused AO12-C
review and Advisor acceptance, AO12-D now validates and selects the same pure
contract from an additive authenticated application read model. The
authenticated path never imports or consumes the synthetic fixtures and remains
pending independent implementation/security/accessibility review and Advisor
acceptance.

The `AO12-D-A1` correction makes that boundary executable: the production
component requires an explicit projection and contains no fixture import or
implicit fixture default, while test-demo composition injects its fixture and
marker explicitly. A fresh-production-build acceptance test rejects the exact
AO12-B/C fixture markers and IDs.

## 1. Contract principles

1. A cue is a disposable presentation projection, never evidence or domain
   truth.
2. Only a new accepted structured source ID may create task-signifying motion.
3. Current, connected, non-conflicting source evidence is required in addition
   to a compatible domain state/activity pair.
4. Initial snapshots, reload, cursor reset, tab resume, Team selection,
   non-selected Team areas, and wall-clock passage never replay task motion.
5. Safety and authority ambiguity render immediately as static text/icon/shape
   and suppress movement.
6. One canonical actor identity is never cloned to satisfy multiple assignment
   views.
7. Motion never delays blocker, alert, decision, evidence, STOP, or focus
   content.
8. Reduced-motion and static tiers expose semantically equivalent facts without
   spatial movement.
9. M1 event bytes, sequence, meaning, state/activity mapping, and historical
   presentation remain unchanged.
10. Cue completion, cancellation, selection, expiry, or acknowledgement cannot
    append an event or mutate a WorkUnit.

## 2. Input boundary

### 2.1 Required source projection

The spatial cue projector receives a validated
`agent-office.authenticated-spatial-cue-slice.v1` tied to the
`agent-office.spatial-office-projection.v1` read model:

```text
projectionRevision
evaluatedAt
selectedPodId
podId, advisorTeamId, projectId
missionId, manifestVersion, missionSequence
roleInstanceId
responsibleAdvisorTeamId
assignmentRef: projectId + missionId + workUnitId
workUnitState
requiredObservableName
activity and activity.sourceEventIds[]
stateSourceEventId
acceptedEventIds[]
evidenceFreshness
connectionState
assignmentStatus
responsibleAdvisorStatus
openAlertSeverity
blocker/decision/result/recovery evidence
accepted handoff/review-verdict/completion-acknowledgement evidence
redacted mission-board display facts
channyPresentationEligibility
zone anchors
updateOrigin
```

The projector cannot query Git, tmux, a filesystem, process state, network
state, terminal output, or wall-clock time. Freshness has already been evaluated
from an explicit `evaluatedAt`. Components receive only the typed result.

Mission-board inputs are canonical projection facts only: Team/project names,
responsible Advisor, redacted registered Advisor model/session display identity,
mission, Phase/WorkUnit, redacted registered current-actor model/session display
identity, Reviewer, next actor/handoff, WorkUnit and gate progress, exact
blocker, Leo/GPT decision state, latest verified evidence time/pointer, and explicit
stale/unknown/conflict state. Raw pane/session locators, filesystem paths,
credentials, private transport, and terminal content are prohibited. A missing
fact remains `UNKNOWN`; timestamps, prose, proximity, selection, and stale or
unverified fixtures cannot fill it.

### 2.2 Eligible update origins

```text
INITIAL_SNAPSHOT
LIVE_DELTA
RELOAD_SNAPSHOT
CURSOR_RESET_SNAPSHOT
TAB_RESUME
POD_SELECTION
```

Only `LIVE_DELTA` may enqueue a transient task cue. Every other origin folds the
latest verified state, marks all current accepted source IDs seen, renders a
static pose, and queues nothing. A Team area that was not selected when an event
arrived does not replay that event when later selected.

### 2.3 Source eligibility gate

A candidate cue is eligible only when every applicable condition is true:

- `podId` is the currently selected trusted Team area for a full operational
  cue; a non-selected Team area receives static state only;
- manifest and projection versions are supported and source authority is
  verified;
- every source ID is a syntactically valid accepted event ID and occurs in the
  exact mission's accepted-event set;
- state/activity/evidence correspondence satisfies the M1 domain contract;
- the assignment resolves to exactly one compatible role instance and project/
  host/source boundary;
- the actor resolves to exactly one responsible Advisor Team and one canonical
  responsible Advisor; missing or multiple assignments are `UNASSIGNED` and
  ineligible for work/task motion;
- evidence freshness is `CURRENT` and connection is `CONNECTED`;
- responsible Advisor status is exact when the cue uses an Advisor route;
- result, decision, blocker, review, or recovery evidence required by the cue is
  present and verified;
- no source ID has already produced the same semantic cue;
- the activity has not expired at the explicit `evaluatedAt`; and
- no suppression rule in Section 6 applies.

Failure produces a static diagnostic state, never a best-effort cue.

### 2.4 Authenticated timestamp and correspondence gate

AO12-D validates the authenticated wrapper before calling the cue projector.
Projection and slice revisions must match; pod, actor, mission, manifest, and
source-event references must resolve inside the same projection; accepted event
IDs must be unique UUIDv7 values; and every cue source must occur in that exact
accepted-event set. `projection.evaluatedAt`, `slice.evaluatedAt`, optional
`activityEffectiveFrom`, and optional `activity.optionalExpiresAt` must pass the
canonical domain UTC timestamp validator. Slice/projection evaluation times
must be byte-equal, and an optional expiry must be later than its activity
effective time. An offset, local time, impossible date, non-canonical fraction,
reversed expiry, unknown key, or cross-projection identity rejects the complete
authenticated spatial candidate and selects the M1 compatibility view. It is
never repaired from wall-clock time or prose.

## 3. Spatial cue envelope

An eligible presentation cue has this exact candidate shape:

```text
schemaVersion: agent-office.spatial-cue.v1
cueId
cueKind
projectId
podId
missionId
workUnitId (optional)
roleInstanceId
sourceEventIds[]
missionSequence
projectionRevision
sourceZoneId
targetZoneId (optional)
evidenceFreshness: CURRENT
connectionState: CONNECTED
createdFromOrigin: LIVE_DELTA
durationMs
staticEquivalentCode
```

`cueId` is deterministic:

```text
sha256(canonical-json([
  schemaVersion,
  projectId,
  missionId,
  roleInstanceId,
  workUnitId-or-null,
  cueKind,
  sorted-sourceEventIds
]))
```

It contains no random value, browser session handle, terminal target, tmux
identity, path, message body, credential, authority capability, or actor command.
`durationMs` is a reviewed presentation constant. It is not derived from event
timestamps and has no domain effect.

## 4. Cue vocabulary and spatial mapping

The exact high-level operational presentation states are `IDLE`, `WORKING`,
`TESTING`, `ROUTING / DISPATCH`, `REVIEWING`, `RETURNING_RESULT`, `NEEDS_PATCH`,
`WAITING_DEPENDENCY`, `WAITING_LEO`, `BLOCKED`, `COMPLETED`, `FAILED`, and
`CANCELLED`. Existing M1 state/activity labels remain compatible source detail;
they do not create another high-level truth vocabulary. Operational state
always overrides ambient behavior.

The M1.2 cue vocabulary is additive at the presentation layer:

```text
LEO_GPT_TO_ADVISOR_HANDOFF
DELIVERY
READING
WORKING
TESTING
WRITING_RESULT
REVIEW_HANDOFF
REVIEW
REVIEW_VERDICT_RETURN
BLOCKED
WAITING_LEO
RESULT_RETURN
PATCH_RETURN
COMPLETION_ACKNOWLEDGEMENT
RECOVERY
IDLE_RELOCATE
```

Existing M1 `SceneMotionCueKind` values preserve their exact meaning. New names
are M1.2 presentation projections only and do not add domain events, authority,
transport, or completion state. `IDLE_RELOCATE` presents a verified transition
to an ambient office zone and is not a new activity or mission state.

| Projected fact | Required accepted source | Source -> target zones | Full-motion cue | Static equivalent/end condition |
|---|---|---|---|---|
| Leo/GPT handoff to Advisor | Accepted durable structured Leo/GPT-to-Advisor handoff fact with exact Advisor target | Leo/GPT decision destination -> responsible Advisor Hub | One handoff document, maximum 900ms | Handoff/receipt text and evidence pointer; never inferred acknowledgement or approval |
| WorkUnit dispatch | `READY -> DISPATCHED` plus correlated `DELIVERY / WORKUNIT_DISPATCH` and exact Advisor route evidence | Global Advisor Hub -> assigned work desk | One Advisor courier plus one work document, maximum 1100ms | Route text and `DISPATCHING`; ends on start/failure/block/hold/expiry |
| Reading | Compatible `READING` activity with immutable input/ack source | Assigned desk -> reading pose at same desk | One document highlight, 900ms | Open-document icon/text; ends on higher sequence/expiry |
| Working | `RUNNING + WORKING` with accepted activity source | Assigned desk | Bounded character/keyboard pose, maximum 900ms | Tool icon, `WORKING`, WorkUnit ID |
| Testing | `TESTING + TESTING` with command/evidence refs | Assigned desk -> testing bench | Checklist/tool sequence, maximum 1200ms | Testing icon/text; never a pass claim |
| Writing result | `RUNNING|TESTING + WRITING_RESULT` and `RESULT_DRAFT_STARTED` | Work/testing zone -> result desk | Bounded document-line cue, 900ms | Result-edit icon/text; ends before `RESULT_REPORTED` |
| Review handoff | `REVIEW_PENDING` plus accepted structured handoff and exact independent Reviewer assignment | Result desk/Advisor Hub -> independent review desk | One review document, maximum 900ms | Review handoff text, Reviewer identity, evidence pointer |
| Independent review | `REVIEW_PENDING + REVIEW` with exact reviewer assignment | Independent review desk only | Lens/checklist sweep, 1000ms | Reviewer label, review state, evidence link |
| Review verdict return | Accepted structured Reviewer verdict/result evidence with exact mission/WorkUnit correlation | Independent review desk -> responsible Advisor Hub | One verdict document, maximum 800ms | Exact verdict/evidence text; receipt is not approval, dispatch, or completion |
| Blocked | Accepted blocker evidence plus compatible blocked projection | Actor's current verified zone | No route; barrier fade, maximum 150ms | Persistent barrier/reason/owner/route until structured resolution/resume |
| Waiting for Leo/GPT | `WAITING_LEO + WAITING_LEO` plus verified decision request | Advisor Hub -> Leo/GPT decision destination | One decision document, 900ms | Persistent decision path/text until decision/resume |
| Result return | `RESULT_REPORTED + RESULT_RETURN` plus verified result and pointer refs | Result desk/actor -> Advisor Hub | One actor plus one result document, 800ms | `RETURNING_RESULT`; receipt is not review/completion |
| Patch return | Accepted `NEEDS_PATCH` review/audit source and exact assigned Worker | Independent review desk -> assigned Worker desk | One patch document, 800ms | Patch route text; does not dispatch implementation |
| Completion acknowledgement | Canonical completion evidence plus an accepted structured acknowledgement correlated to the exact mission | Responsible Advisor Hub -> Team mission board | One bounded board acknowledgement, maximum 700ms | `COMPLETED` plus acknowledgement evidence; never selects or starts another mission |
| Recovery | Accepted recovery event and exact structured step | Control/recovery zone | Step-based tool cue, maximum 1000ms | Step/total/read-only/quarantine text |
| Ambient relocation | New accepted `IDLE` activity or accepted end of an active assignment, current verified actor | Prior actor zone -> verified office/lounging zone | One bounded relocation, maximum 700ms | `VERIFIED_IDLE`; implies no availability, assignment, communication, collaboration, or approval |

No cue is triggered by string matching such as "working", "done", "review",
"blocked", or "idle" in user/model/terminal text.

### 4.1 Channy presentation layer

The exact product decision is
`CHANNY_ENABLED__NON_OPERATIONAL_AMBIENT_COMPANION_AND_STRUCTURED_STATUS_REFLECTOR`.
Channy has no `roleInstanceId`, Team assignment, authority, direct domain-event
subscription, or command target. One global Channy presentation may:

- use browser-local neutral roaming, visiting, sitting, eating, drinking,
  sleeping, resting, playing, or observing motion with no operational meaning;
- briefly follow an already eligible accepted routing cue using the same source
  IDs, duration, deduplication, reload, suppression, and route cap; or
- reflect accepted structured `WAITING_LEO`, `BLOCKED`, mission-complete, valid
  dispatch/routing, or explicit stale/offline presentation facts.

Stale/offline reflection is static and never bypasses stale-motion suppression.
Absent accepted evidence, Channy is neutral. Channy never inspects terminal or
session content, infers state, creates evidence, dispatches, carries a command,
approves, changes sessions, repairs, replaces alerts/boards, or implies
communication/collaboration. Session/system checks remain structured-adapter
responsibility.
Reduced-motion/static mode shows an equivalent labelled pose. Status, alerts,
the mission board, and the accessible activity log remain independently complete.

## 5. Zone and route resolution

Zone IDs are stable semantic identifiers scoped by `podId`, for example:

```text
pod-header
mission-board
work:<roleInstanceId>
testing-bench
result-desk
review-desk
lounge
evidence-cabinet
advisor-anchor
leo-decision-destination
shared-path:<pathId>
channy-bed
channy-food-water
```

Coordinates are a responsive rendering detail and never enter `cueId`. A route
must resolve both semantic endpoints in the current layout before motion. If an
endpoint is hidden, paged out, unresolved, non-selected, or ambiguous, the projector
emits the static equivalent and activity-log entry only.

Advisor route resolution additionally requires exactly one responsible Advisor
Team and one responsible Advisor reference for the actor and Team area. Missing
or multiple values render `UNASSIGNED`/conflict and suppress work receipt and
task motion. The visual route anchor does not create that authority.
Review routes require an independent Reviewer assignment and can never target a
Worker as the reviewer. Leo/GPT decision routes can carry only a decision-document
cue, not a generic message, command, or WorkUnit dispatch.

## 6. Suppression and fail-closed diagnostics

Suppression runs before precedence or queue selection.

| Condition | Visible static result | Motion result |
|---|---|---|
| Manifest/source unverified or missing | `SOURCE_UNVERIFIED` plus exact evidence state | Suppress all affected cues |
| Freshness `STALE`, `OFFLINE`, `UNKNOWN`, `CONFLICT`, or `ERROR` | Last verified state, evaluated/observed time, reason code | Suppress all affected cues |
| Connection not `CONNECTED` | Exact connection state and last verified assignment | Suppress all affected cues |
| Source event absent/unaccepted/incompatible | `STRUCTURED_SOURCE_UNAVAILABLE` | Suppress candidate |
| Assignment or responsible Team missing | `ASSIGNMENT_UNKNOWN` plus `UNASSIGNED` | Suppress actor work receipt and routes |
| Assignment duplicated/incompatible | `ASSIGNMENT_CONFLICT` | Suppress actor and routes; never clone |
| Responsible Advisor missing/multiple | `ADVISOR_RESPONSIBILITY_UNKNOWN/CONFLICT` | Suppress Advisor routes |
| Result/decision/blocker/recovery evidence missing | Evidence-specific missing diagnostic | Suppress affected cue |
| Critical alert on actor/WorkUnit/pod source | Persistent critical border/banner/text | Suppress task and ambient motion for affected scope |
| Store quarantine or recovery read-only | Recovery/quarantine facts first | Only verified recovery step cue may render; otherwise static |
| Reduced motion or motion off | Same text/icon/shape/activity-log update | No translation/sweep/pulse/interpolation |
| Non-selected Team area | Recognizable spatial Team area with verified static summary/state | No full task-signifying choreography |
| Hidden document/tab | Latest static projection on resume | Pause, then clear without replay |

A suppressed cue is not retained for later playback. Fresh evidence may render
the current state statically; it does not replay the prior transition.

## 7. Precedence and concurrency

The M1 precedence remains exact:

```text
RECOVERY
  > WAITING_LEO
  > BLOCKED
  > HOLD
  > NEEDS_PATCH
  > REVIEWING
  > RETURNING_RESULT
  > WRITING_RESULT
  > TESTING
  > DISPATCHING
  > READING
  > WORKING
  > WAITING_ADVISOR
  > WAITING_DEPENDENCY
  > UNKNOWN_OR_STALE
  > COMPLETED | FAILED | CANCELLED
  > READY
  > QUEUED
  > IDLE
```

Conflict/critical/stale/offline states are suppression overlays rather than a
lower-priority animation. For candidates concerning the same actor or WorkUnit,
the highest precedence wins. Equal precedence uses greater mission sequence,
then lexical source event ID only for deterministic presentation.

Queue rules:

- maximum three transient cues across the selected Team area;
- maximum one route cue (`LEO_GPT_TO_ADVISOR_HANDOFF`, `DELIVERY`, `REVIEW_HANDOFF`,
  `REVIEW_VERDICT_RETURN`, `RESULT_RETURN`, `PATCH_RETURN`, `WAITING_LEO`, or
  `COMPLETION_ACKNOWLEDGEMENT`) at once;
- maximum one cue per canonical actor identity;
- same-entity bursts coalesce to the precedence winner;
- safety facts display immediately even when the queue is full;
- excess eligible cues become ordered activity-log text and are marked seen; and
- cue completion removes presentation state only.

## 8. Deduplication, reload, and live-cursor behavior

The browser maintains a bounded non-sensitive set of `cueId` values for the
current projection session. The set is presentation state only and grants no
authority.

### 8.1 Initial and full snapshots

On initial load, authentication restore, full fetch, incompatible-cursor reset,
or projection-schema reset:

1. validate the complete projection;
2. render the latest static state;
3. derive and mark all currently referenced eligible `cueId` values seen; and
4. enqueue zero cues.

### 8.2 Live delta

A live delta may enqueue a cue only when its projection revision is strictly
newer than the applied revision and its source IDs were not present in the
baseline. Duplicate revision plus byte-equivalent content is idempotent.
Duplicate revision with different content is `PROJECTION_CONFLICT`, clears the
queue, and requires a full verified snapshot.

### 8.3 Reload, tab resume, and pod selection

- Reload repeats the full-snapshot behavior and never replays history.
- Hidden tabs pause animation. Resume cancels incomplete visuals, folds the
  newest verified projection, marks sources seen, and queues nothing.
- Selecting another Team area renders its current static state and marks its
  current sources seen. Events that occurred while non-selected are not delayed
  entertainment.
- Returning to a previously selected Team area does not replay cues.

### 8.4 Bounded seen-set behavior

The implementation may discard seen IDs older than the server's bounded SSE
replay floor only after a newer verified full snapshot has marked its current
sources seen. Eviction can never make a historical event eligible again. If that
cannot be proven, clear all cues and remain static until a full snapshot.

## 9. Cue and ambient budgets

These are hard presentation limits:

| Budget | Limit |
|---|---:|
| Shared wide floors | 1 |
| Expanded Team areas | 1 |
| Visible full actor tiles | 8 desktop/tablet; 2 mobile page |
| Pending transient cues | 3 |
| Concurrent route cues | 1 |
| Concurrent cue per actor | 1 |
| Cue duration | 150-1200ms |
| Route actor/document pairs | 1 pair |
| Full task choreography in non-selected Team areas | 0 |
| Ambient actors | 1 across the floor, plus one global Channy presentation |
| Ambient movement burst | maximum 600ms followed by at least 8s static |
| Infinite task loop, flash, shake, parallax, sound | 0 |

Actor ambient motion is allowed only for current, connected, verified `IDLE`
and is visually distinct from task cues. It may present coffee, reading for
leisure, resting, a small game, a window/whiteboard pose, visual interaction
with Channy, or visual talk without content. It never implies availability,
assignment, shared context, collaboration, communication, approval, evidence,
document transfer, review, testing, delivery, or progress. A new operational
event interrupts it immediately. It stops on stale/offline/conflict/critical/
reduced-motion/hidden state. Neutral Channy ambient timing is likewise
browser-local and has no event, evidence, availability, or ordering meaning.

## 10. Reduced-motion and static equivalence

`prefers-reduced-motion: reduce` or the existing in-app motion-off control selects
the static tier immediately. No cue waits for an animation end handler to expose
its outcome.

| Full cue | Required static equivalent |
|---|---|
| Delivery/result/patch/decision route | Origin -> destination text, document kind icon, source event reference, timeline row |
| Reading/working/testing/writing/review | Immediate exact state/activity label, role, WorkUnit, evidence/freshness icon |
| Blocked | Persistent barrier shape, reason, owner, route, alert announcement |
| Recovery | Exact step/total/status/read-only text and tool icon |
| Lounge relocation/ambient | Static actor in lounge with `VERIFIED_IDLE` and evaluated time |
| Channy route/status/ambient | Static neutral or structured-reflector pose plus the independent primary status text |

Static equivalence preserves semantic ordering, focus, live-region policy, and
activity-log content. An opacity change up to 100ms is permitted only if the
user agent does not suppress it and the final content is present from the first
frame. No essential information is located only on a path or in a pose.

## 11. Responsive behavior

- Wide desktop keeps every registered Advisor Team spatially visible on one
  shared floor; only the selected Team area runs full operational choreography.
- Tablet/mobile may focus one Team through paging, minimap, or explicit
  navigation, but preserves the same summary facts and route timeline meaning
  for every Team.
- Wide/tablet spatial routes use named zone anchors and local SVG overlays.
- If route endpoints are not simultaneously visible, use the static timeline
  equivalent; never auto-scroll or move focus to complete a cue.
- Mobile never draws a miniature route across hidden pages. It appends an
  origin/destination row and updates the destination actor/status tile.
- At 320px or 200% text, cue labels wrap and IDs use controlled overflow. The
  visual layer cannot change layout dimensions.
- Orientation change cancels active visual interpolation, renders the current
  static state at new anchors, marks the cue seen, and does not restart it.

## 12. Performance tiers and benchmark targets

Hard truth/source rules never vary by tier.

| Tier | Presentation | Selection rule |
|---|---|---|
| `FULL` | Up to three bounded cues, one route, one bounded idle ambient actor | Only after the implementation benchmark gate passes on the configured reference runtime |
| `RESTRAINED` | One cue at a time, no ambient motion, non-selected Team areas static | Explicit reviewed presentation setting or benchmark fallback |
| `STATIC` | No motion layer; semantic text/icon/shape/log equivalence | Reduced motion, motion off, unsupported layout, or fail-closed performance fallback |

Tier selection is browser-local presentation state. It cannot alter a projection,
freshness, severity, authority, or event. Runtime CPU/process heuristics must not
silently label state or fabricate activity.

The AO12-C implementation benchmarks a synthetic, non-secret fixture with
12 registered pods, 64 actor assignments, 200 WorkUnits, long Korean/English
labels, six open alerts, and a three-cue burst. These are design-load targets,
not claims about current supported production scale.

Candidate measurable targets:

- pure projection plus cue reduction: p95 <= 8ms after warm-up;
- selected-Team switch to committed DOM: p95 <= 100ms on the configured reference
  desktop and <= 200ms under the reviewed constrained-browser profile;
- spatial animation main-thread work: p95 <= 8ms per active frame;
- no spatial-surface long task greater than 50ms during the scripted 10-second
  cue sequence;
- M1.2 incremental production JavaScript: <= 80KiB gzip over the M1 base;
- selected view: <= 1600 DOM nodes and <= 800 SVG elements;
- retained heap growth after 20 pod-selection cycles: <= 25MiB; and
- zero cue, event listener, animation, or observer retained after unmount/logout.

Implementation must record reference host/browser/build, fixture hash, sample
count, percentile calculation, bundle report, DOM/SVG counts, heap method, and
results. AO12-C configured-reference evidence uses fixture SHA-256
`sha256:6fc7fe9aee1811575c99b4c6b9972626053f26e645827b16e77c2363b4f201cf`,
200 reducer samples after 20 warm-ups, nearest-rank p95, configured Playwright
Chromium, and a 4x-CPU-throttled constrained profile. The measured reducer p95
is 0.252ms; configured-browser selected-Team p95 is 51.4ms desktop and 68.1ms
constrained; 600 active frames have p95 0.4ms; the scripted 10-second sequence
has a supported long-task observer and zero long tasks over 50ms; the exact
design-load render has 1324 DOM and 224 SVG nodes; and Chromium CDP garbage
collection around 20 selection cycles records 197548 bytes retained-heap
growth. The production entry remains
unchanged and excludes the test-demo spatial modules, so incremental production
JavaScript at this selection boundary is zero; the six AO12-C presentation
source modules are separately 12314 gzip bytes as a diagnostic. Unmount and
navigation retain zero cue animation; component cleanup removes its timers and
media/visibility listeners. These results select `FULL` only on this configured
reference runtime and remain pending independent review. A future miss blocks
`FULL` or selects a reviewed lower tier; accessible semantics cannot be removed
to meet a budget.

AO12-D separately measures the authenticated selected path from exact AO12-C
base `f9d0533437c0cf9efa7be76650ad79f0cb0d9353`. Across 1000 in-process
parse/select/project/reduce samples, authenticated reducer p95 is 1.949ms.
Configured Playwright Chromium records pod-selection p95 16.9ms, zero long
tasks over 50ms during 10 seconds, 377 DOM nodes, 84 SVG elements, zero pending
cues after the sequence, and 305608 bytes retained-heap growth after collection.
The exact production build grows by 27102 gzip bytes of JavaScript and 4268
gzip bytes of CSS from that base. These measurements pass the hard targets and
select `FULL` only on the configured runtime. The selector still exposes
`RESTRAINED`, `STATIC`, and `M1_FIXED_STATIONS`; a performance miss may lower
presentation but cannot bypass validation, redaction, authority, source, or
accessibility gates.

## 13. M1 compatibility adapter

`M1FixedStationAdapter` consumes the existing eight `RoleSceneProjection`
records and preserves:

- exact `OfficeStationId` and station ordering/coordinates;
- current `SceneStateName`, activity mapping, source validation, precedence,
  deduplication, cue types, route phase order, and duration caps;
- initial/reload/tab-resume suppression;
- current motion preference and two-station mobile pagination;
- existing semantic role/status lists and live regions; and
- all six committed M1 baselines as unchanged compatibility evidence.

The adapter may wrap the fixed scene in a visibly labelled legacy pod, but it
cannot assign project history to old events, change source IDs, replay a cue, or
convert station proximity into an assignment. Unknown spatial contract versions
fail to the verified M1/static view.

## 14. Verification contract

AO12-A implements focused projection/adapter/projector/assignment/current-name
tests. AO12-B implements the applicable static rendering, identity, mission-board,
responsive, keyboard/focus, forced-color, WCAG A/AA, and zero-motion proofs in
four focused Vitest files (24 tests) and one Playwright file (10 tests). Six new
configured-runtime static baselines were directly inspected, with desktop and
reduced-motion bytes identical. AO12-C adds 76 focused cue/route/Channy/
performance tests, 15 motion/accessibility browser cases, and seven directly
inspected configured-runtime PNGs covering full, restrained, reduced/static,
tablet, mobile, forced-colors, and 200%-text presentation. AO12-D adds strict
authenticated wrapper/UTC/source tests, live-delta/restart/logout/expiry/
revocation runtime tests, selector/rollback/redaction/performance/UI tests, and
seven composed authenticated PNGs. The AO12-D-A1 gate additionally proves the
production source graph and freshly emitted JavaScript contain no synthetic
spatial fixture dependency or marker. The complete local train passes 77
Vitest files/452 tests, 43/43 default-demo browser cases, and 3/3 composed browser
cases; all 19 prior PNG hashes remain equal to the AO12-C base. The complete
train must continue to prove at least:

- every cue row has valid and invalid source/evidence cases;
- terminal/model/process-shaped prose cannot change a cue;
- assignment and Advisor-responsibility missing/duplicate/cross-project cases
  fail closed;
- every active actor has exactly one responsible Advisor Team, and `UNASSIGNED`
  actors cannot receive work or task motion;
- current single-Advisor and future per-`Advisor roleInstanceId` character
  uniqueness, with no clone or proximity-derived authority;
- exact Foundation and conditional VibeNews Team assignments, approved project
  palette, and the SIASIU current-name forbidden-token gate;
- the complete mission-board field set, redaction, and prose/timestamp/proximity/
  stale-fixture non-inference boundary;
- Channy allowed ambient/status-reflector behavior, prohibited operational
  behavior, static stale/offline response, and reduced-motion equivalence;
- accepted structured Leo/GPT handoff, Advisor dispatch, Worker/test, review
  handoff/verdict, patch/result, `WAITING_LEO`, and completion-acknowledgement
  cases, with unaccepted/prose-shaped negatives;
- exact precedence, one-actor rule, three-cue cap, one-route cap, overflow-to-log,
  and deterministic tie-breaking;
- initial/reload/reset/resume/selection/orientation never replay;
- stale/offline/unknown/conflict/error/critical suppression and no delayed replay;
- reduced-motion/static equivalence, 44px controls, focus, live regions, and WCAG
  A/AA automated checks;
- desktop/tablet/mobile/320px/200% text containment and no pair overlap;
- M1 compatibility suites and baseline bytes remain unchanged;
- source modules have no observation/process/network/write/dispatch import; and
- every benchmark target is measured and honestly classified.

Exact as-built AO12-A/AO12-B/AO12-C/AO12-D paths and WorkUnits are in
[`../operations/AGENT_OFFICE_M1_2_IMPLEMENTATION_WORKUNIT_PLAN.md`](../operations/AGENT_OFFICE_M1_2_IMPLEMENTATION_WORKUNIT_PLAN.md).

## 15. Authority and transport non-change

This contract has no browser command, Advisor gateway, exact-delivery,
authentication, tmux, Hermes, Worker/Reviewer routing, authority evidence, or
completion behavior. A route drawing is not a transport receipt. A delivery cue
is not Advisor acknowledgement. A review cue is not a verdict. A decision cue is
not a decision. A result cue is not completion. Leo/GPT and Advisor authority
remain exactly as defined by M1.
