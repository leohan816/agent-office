# Agent Office M1.2 Spatial Advisor-Team Office Master Design

Status: `AO12_A_IMPLEMENTED__PENDING_FOCUSED_FABLE5_REVIEW_AND_ADVISOR_ACCEPTANCE__AO12_B_NOT_AUTHORIZED`

Canonical owner: Agent Office repository

Design mission: `AGENT_OFFICE_M1_2_SPATIAL_ANIMATED_ADVISOR_TEAM_OFFICE`

Target implementation status: `AO12_IWU_01_THROUGH_04_IMPLEMENTED__NOT_PRODUCTION_SELECTED`

This document is the frozen additive design over the closed M1 base
`2f663304a88c432f19fe56055641b66e57f18ef2`. It defines a spatial,
evidence-backed office projection for Advisor-led teams across registered
projects. The later exact AO12-A handoff authorized only the additive contracts,
compatibility adapter, pure projectors, invariants, tests, and naming correction
recorded here. This design document itself does not authorize AO12-B, assets,
authority, transport, authentication, network, database, deployment, or runtime
activation.

## 1. Purpose and binding inheritance

M1.2 should make the relationship among projects, missions, actors, work,
evidence, alerts, review, and Leo/GPT decisions legible as one spatial office. It
must remain an operations control plane, not become a simulation whose movement
is mistaken for mission truth.

This design inherits without weakening:

- the authority and source precedence in
  [`AGENT_OFFICE_MASTER_DESIGN.md`](AGENT_OFFICE_MASTER_DESIGN.md);
- the versioned manifest, event, activity, evidence, ordering, and completion
  rules in
  [`../contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md`](../contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md);
- the browser, actor, Advisor-only, and adapter boundaries in
  [`../security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md`](../security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md);
- the project/host registry and freshness rules in
  [`../integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md`](../integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md);
- the existing event-only scene, accessibility, reduced-motion, and responsive
  guarantees in
  [`../ui/AGENT_OFFICE_UI_ANIMATION_MAPPING.md`](../ui/AGENT_OFFICE_UI_ANIMATION_MAPPING.md); and
- the fail-closed presentation, rollback, and degradation rules in
  [`../operations/AGENT_OFFICE_OPERATIONS_RECOVERY.md`](../operations/AGENT_OFFICE_OPERATIONS_RECOVERY.md).

Where this document and an inherited M1 authority conflict, M1 remains binding
and the M1.2 implementation must stop for a reviewed design correction. Spatial
position, character pose, project color, animation, selection, camera/view
state, and lounge placement are presentation only. None can create or transfer
authority, mutate mission state, acknowledge evidence, dispatch a role, or prove
completion.

## 2. Non-goals and fixed prohibitions

M1.2 does not design or authorize:

- a new actor, Advisor, reviewer, authority role, decision route, or completion
  policy;
- browser-direct Worker or Reviewer dispatch, a generic role target, or a
  terminal/shell/tmux command surface;
- changes to Advisor-only communication, exact delivery, authentication,
  security, network exposure, Hermes, or canonical transport authority;
- a database, schema migration, secret, credential, public/private-network
  exposure, deployment, production/live operation, or remote collector;
- inference from terminal prose, pane contents, process names, CPU activity,
  elapsed silence, CSS state, or character position;
- purchase, import, download, generation, or selection of production artwork;
- a Canvas, WebGL, Three.js, game-engine, physics, or 3D dependency; or
- implementation, launch, review verdict, risk acceptance, final approval, or
  automatic next-mission selection.

## 3. As-is M1 evidence map

The design was derived from the following current repository evidence. The
limitations are design inputs, not defects silently reclassified by M1.2.

| Current evidence | Proven behavior | M1.2 limitation |
|---|---|---|
| `src/ui/scene/types.ts` | Closed eight-value `OfficeStationId`, fixed 4-by-2 coordinates, typed `RoleSceneProjection` | No dynamic pod, project identity, actor-character identity, or multi-mission spatial model |
| `src/ui/scene/state-machine.ts` | Accepted UUIDv7 provenance, exact M1 activity mapping, safety precedence, reload deduplication, maximum three transient cues | Routes depend on fixed station coordinates and cannot address dynamic pod zones |
| `src/ui/scene/office-scene.tsx` | Semantic station list, roving focus, selected detail, live regions, motion control, two-station mobile pages | One fixed floor; no project switcher, mission board, compact pod summary, lounge, or dynamic actor layout |
| `src/ui/scene/assets/scene-assets.tsx`, `asset-registry.ts`, `assets/ASSET_INVENTORY.md` | Local project-authored generic actor/desk/document/tool SVG with stable dimensions, license classification, and SHA-256 | The same generic actor is used for every role and project; no production art direction exists |
| `src/ui/styles.css` | CSS grid, stable geometry, transform/opacity-only cues, reduced-motion removal, 320px and short-landscape reflow | Desktop is a dense station matrix; project color and spatial-zone tokens do not exist |
| `src/application/projects/registry.ts` | Multiple trusted project registrations, stable IDs, path-free browser summaries, cross-project root isolation | Registry summaries are not a spatial project/pod projection and contain no mission selection or identity catalog |
| `src/runtime/operational-config.ts` | Exactly eight unique station/role registrations and exact WorkUnit assignments | Configuration and validation are intentionally closed to the M1 station model |
| `src/runtime/observation-coordinator.ts` | One isolated actor registration per WorkUnit, evidence-correct freshness, exactly eight scene roles | `selectActorWorkUnit()` and station output are single-mission/fixed-scene behavior, not a multi-pod assignment contract |
| `src/runtime/projection.ts` | Authenticated application projection carries dashboard, communication, alerts, and `sceneRoles` | No versioned spatial-office projection or pod summary exists |
| `src/application/queries/dashboard-view-model.ts` | Initiative/package/mission/phase/WorkUnit facts, separate denominators, evidence and freshness | Hierarchy is an operations view, not yet spatially coordinated with a selected pod |
| `src/domain/manifest/index.ts`, `src/application/projections/mission-projector.ts` | Versioned manifest and deterministic mission projection | Project pods must consume these facts without changing their meaning or history |
| `src/domain/activity/index.ts`, `src/domain/events/index.ts` | Closed activity and accepted structured-event contracts | M1.2 may map existing events to presentation cues but cannot invent live activity |
| `tests/ui/activity-mapping.test.ts`, `tests/ui/activity-precedence.test.ts` | Exact state/activity mapping, source acceptance, precedence, dedup, three-cue cap | M1.2 must retain these as compatibility tests and add spatial cases |
| `tests/ui/office-scene.component.test.tsx`, `tests/ui/scene-boundary.test.ts` | Eight stable stations, keyboard behavior, fixture isolation, no observation/process/write/network import | The new surface needs equivalent semantic and source-boundary tests |
| `tests/e2e/office-scene.spec.ts`, `tests/e2e/accessibility.spec.ts` | Desktop/tablet/mobile/320px/200% text, no overlap, 44px controls, WCAG A/AA, reduced motion | These baselines cover only the M1 fixed floor |
| `tests/e2e-composed/application-office-scene.spec.ts` | Authenticated production projection suppresses unverified motion and omits fixture controls | It covers one mission and the fixed eight-station application view |
| Six PNGs under `tests/e2e/baselines/office-scene.spec.ts/` and `tests/e2e-composed/baselines/application-office-scene.spec.ts/` | Directly inspected M1 desktop, mobile, and reduced-motion visual truth | They are compatibility evidence, not an M1.2 visual target or portable font/runtime claim |
| `package.json`, `package-lock.json` | React 19, TypeScript, Vite, Lucide, DOM/CSS/local SVG; no spatial/game/Canvas/WebGL dependency | A new rendering dependency has no evidenced need and is not selected |

No source, test, configuration, dependency, lockfile, or baseline is changed by
this design mission.

## 4. Resolution of the frozen unknowns

The frozen IDs remain stable. The technical resolutions passed the original
Fable5 Level-3 design review. Leo/GPT then authorized the narrow product-intent
patch recorded by the exact status
`DESIGN_PATCH_AUTHORIZED__IMPLEMENTATION_CONDITIONAL_ON_CLEAN_FABLE5_PASS`.
Implementation is not authorized until the same existing Fable5 context returns
a clean Level-3 delta `PASS` and Advisor freezes and routes the patched package.

| Unknown | Candidate resolution | Status/gate |
|---|---|---|
| `AO12-U01` Dynamic Team Pod Model | One shared American-style open-office floor keeps every registered Advisor Team Pod spatially visible on wide desktop. Selection expands detail and choreography without turning other Team areas into cards or hiding them. | `PRODUCT_INTENT_RESOLVED__PENDING_DELTA_REVIEW` |
| `AO12-U02` Single Advisor Team Principle | Every active actor belongs to exactly one responsible Advisor Team. Current and future Advisor-character rules are explicit below; missing or multiple assignments fail closed. | `PRODUCT_INTENT_RESOLVED__NO_AUTHORITY_CHANGE` |
| `AO12-U03` Project Color System | Team-first grouping and a fixed approved project palette combine clothing, desk accents, signs, text, glyphs, and patterns. Severity, focus, accessibility, and alerts override project color. | `PRODUCT_INTENT_RESOLVED__PENDING_CONTRAST_TESTS` |
| `AO12-U04` Actor Character Identity | Code-native role silhouettes plus visible role/project labels and existing state overlays; project-authored placeholders only until the asset gate. | `TECHNICALLY_RESOLVED__PRODUCTION_ASSET_DEFERRED` |
| `AO12-U05` Channy Definition | Channy is enabled only as a non-operational ambient companion and structured-status reflector under the exact boundary in Section 9.3. | `PRODUCT_INTENT_RESOLVED__NO_AUTHORITY` |
| `AO12-U06` Lounge Semantics | Verified-idle actors may use bounded office/lounging presentations that never imply availability, assignment, shared context, collaboration, communication, or approval. | `PRODUCT_INTENT_RESOLVED__PENDING_DELTA_REVIEW` |
| `AO12-U07` Truthful Animation | Only new accepted structured source IDs create bounded operational cues. Selection controls detail, not truth; non-selected Team areas retain exact visible state without full choreography. | `PRODUCT_INTENT_RESOLVED__CONTRACT_REQUIRED` |
| `AO12-U08` Mission Board | Every Team area exposes the required summary fields; the selected board exposes the complete exact field set in Section 9.1. | `PRODUCT_INTENT_RESOLVED__PENDING_COMPONENT_TESTS` |
| `AO12-U09` Rendering Architecture | Accessible DOM for semantics and layout, local SVG for characters/routes, CSS transform/opacity for motion. No Canvas/WebGL/3D engine. | `TECHNICALLY_RESOLVED` |
| `AO12-U10` Responsive Navigation | Desktop spatial floor; tablet simplified floor; mobile semantic pod/list/detail. No miniature unreadable floor. | `TECHNICALLY_RESOLVED__PENDING_BROWSER_TESTS` |
| `AO12-U11` Reduced Motion/Performance | Static semantic equivalence, fixed cue/visible-actor caps, and separately measured benchmark targets with fallbacks. | `TECHNICALLY_RESOLVED__BENCHMARK_REQUIRED` |
| `AO12-U12` Multi-Project Identity/Host Boundaries | One canonical actor identity may have assignment views, never duplicated live actors. Conflicting active assignments or sources render `CONFLICT`. | `TECHNICALLY_RESOLVED__NO_TRUST_EXPANSION` |
| `AO12-U13` Asset Source/Style | M1.2 uses project-authored code-native placeholders in the approved warm retro pixel/pixel-inspired 2D/2.5D direction; external acquisition remains prohibited. | `PRODUCT_INTENT_RESOLVED__PLACEHOLDER_ONLY` |
| `AO12-U14` Compatibility/Migration | Add a versioned spatial projection and an M1 fixed-station adapter. Existing M1 events, station IDs, mapping, tests, and baselines remain unchanged. | `TECHNICALLY_RESOLVED__ADDITIVE_ONLY` |

Detailed traceability appears in
[`../operations/AGENT_OFFICE_M1_2_IMPLEMENTATION_WORKUNIT_PLAN.md`](../operations/AGENT_OFFICE_M1_2_IMPLEMENTATION_WORKUNIT_PLAN.md).

## 5. Spatial information architecture

### 5.1 Global office frame

The top-level semantic order is fixed:

```text
Global status and authority facts
  -> Shared office floor and registered Advisor Team navigation
       -> Every registered Team area and its required visible summary
       -> Selected Team area expanded in place
            -> Team identity and responsible-Advisor reference
            -> Selected mission board
            -> Full spatial choreography or static equivalent
            -> Actor/WorkUnit detail
  -> Evidence, Inbox, Alerts, and decision inspector
```

Global status retains network, authentication, projection revision, freshness,
delivery/manual-fallback, offline, and recovery facts from M1. The M1.2 surface
does not add a global command box, destination selector, or role dispatcher.

The Initiative navigation groups trusted registered projects without replacing
the floor. On wide desktop, every registered Advisor Team remains a
recognizable office area on one shared American-style open-office floor. A
project may have zero or more visible mission summaries, but only a canonical,
Git-verified manifest may create a mission board. A registered project without
mission authority renders `NO_VERIFIED_MISSION`, not an empty active office.

### 5.2 Hierarchy mapping

The existing canonical hierarchy maps to the spatial surface without changing
identity or count semantics:

| Canonical entity | Spatial projection |
|---|---|
| Initiative | Global office campus/header and pod collection |
| Advisor Team plus project registration | Team area/Pod identity and source boundary |
| Package | Mission-board grouping label |
| Mission | One selectable versioned mission board inside its project pod |
| Phase | Ordered board lane; never inferred from floor location |
| WorkUnit | Board item linked to exactly one verified assignment view |
| Actor role instance | One canonical character identity plus zero or more non-authoritative assignment references |
| Evidence | Evidence cabinet/inspector with verification/freshness text |
| Alert/blocker | Persistent severity overlay and accessible alert item |
| Leo/GPT decision | Explicit decision path from Advisor Hub to the Leo/GPT decision destination |

Progress always remains `completed / manifest denominator` plus manifest
version, with required-gate progress separate. Pod size, character count, board
position, animation duration, or color never represents progress.

## 6. Versioned spatial projection boundary

M1.2 introduces a future presentation contract named
`agent-office.spatial-office-projection.v1`. It is a deterministic read model,
not a domain ledger or authority schema. Its candidate shape is:

```text
schemaVersion
projectionRevision
evaluatedAt
initiativeRef
selectedPodId
identityCatalogVersion
pods[]
  podId, advisorTeamId, projectId, displayName, projectIdentity
  authorityStatus, evidenceFreshness, connectionState
  responsibleAdvisorRoleInstanceId
  responsibleAdvisorDisplayIdentity
  selectedMissionRef, missionSummaries[], missionBoardSummary
  actorAssignments[], alertSummary, evidenceSummary
actorsByRoleInstanceId{}
selectedMissionBoard
channyPresentation
sourceManifestRefs[]
sourceEventIds[]
compatibilityMode: M1_FIXED_STATIONS | M1_2_TEAM_PODS
```

The future projector may consume only:

- trusted `LocalProjectRegistry` summaries and reviewed extensions;
- Git-verified `MissionManifest` instances and deterministic mission projections;
- exact runtime actor registrations and their project/host/source identity;
- accepted structured domain events and immutable evidence references;
- explicit observation freshness/connection/conflict evaluations; and
- an explicit selection stored as non-sensitive browser presentation state.

It must not read terminal text, execute adapters, assign authority by proximity,
or generate domain events. `evaluatedAt` affects only a freshness overlay. A
change of selection does not alter the projection revision or source truth.

## 7. Dynamic Advisor Team Pod model

### 7.1 Stable pod identity

`podId` is a stable typed identifier bound to an exact `projectId`. If multiple
missions for a project are supported later, they remain mission boards within
the same project pod unless a reviewed product decision changes that hierarchy.
Display-name changes do not change `podId`.

Pod creation requires a trusted project registration. Active mission content
additionally requires a verified manifest whose source maps to that project.
Path/root details remain absent from browser summaries. An unknown, stale,
unverified, dirty, or conflicting source produces a static pod shell with exact
reason text and no task-signifying motion.

### 7.2 One shared floor and one detailed Team area

Exactly one pod may be expanded in a browser view. Selection precedence is:

1. a still-valid explicit browser selection;
2. an exact mission deep link that resolves to a trusted visible pod; or
3. the first pod by stable `projectId` lexical order.

A missing selection never guesses from activity, alert severity, model output,
or most-recent terminal use. On wide desktop, selection changes emphasis and
detail within the same floor; it does not remove, collapse into ordinary cards,
or relocate the other registered Team areas. Every non-selected Team area
remains spatially recognizable through its desks, project sign, mission board,
actor positions, and shared paths, and shows at least:

- Team name;
- responsible Advisor;
- current main mission;
- current actor;
- current operational state; and
- gate/blocker summary.

Those minimum fields are supplemented by project text ID/name and
color/pattern/glyph identity, manifest progress, freshness/connection, and alert
severity when canonical evidence exists. Non-selected Team areas update
text/icon/shape from projection truth but do not run the selected area's full
walking, typing, handoff, review, testing, result, or decision choreography.
They are office areas, not summary cards. Tablet and mobile may use focused
paging plus a minimap or explicit Team navigation, but must preserve the same
facts, relationships, and access to every Team.

A future reviewed multi-floor model may be additive to this one-floor baseline;
it cannot silently replace, partition, or reinterpret the M1.2 shared floor.

### 7.3 Actor assignment and conflict rules

Actor identity is keyed by exact `roleInstanceId`, not display label, model
name, station, project color, or tmux pane text. A WorkUnit assignment is keyed
by `(projectId, missionId, workUnitId)` and must resolve through trusted
configuration to exactly one compatible role instance.

Rules are fail closed:

- no matching actor: `ASSIGNMENT_UNKNOWN`, static unoccupied desk, no cue;
- more than one matching actor: `ASSIGNMENT_CONFLICT`, all affected cues
  suppressed;
- actor project/host/source mismatch: `SOURCE_CONFLICT`, no live presence;
- one actor with multiple nonterminal assignments but no accepted structured
  current-activity source: show an assignment list, not an active character;
- one actor with incompatible simultaneous accepted active assignments: show one
  canonical actor in a conflict state and no cloned character; and
- stale/offline/unknown/error evidence: preserve last verified assignment text,
  mark it stale, and suppress movement.

An actor may be referenced in several pods for historical or pending work. Those
are assignment views, not multiple live identities. One `roleInstanceId` may
have a character presentation in at most one Team area across the floor. The
selected Team area may render full operational choreography for actors whose
exact current assignment resolves there. A current actor in a non-selected Team
area may remain static or ambient there; every other reference is text/glyph
only. Exact assignment and sources must be current and non-conflicting, and a
live actor is never cloned.

### 7.4 Exact initial Team and project identity

The initial product-intent assignment is exact, but runtime presentation still
requires matching canonical authority evidence:

- `FOUNDATION_ADVISOR_TEAM`: Foundation Advisor, Control, Foundation Worker,
  Cosmile Worker, SIASIU Worker, Agent Office Worker, and the assigned
  independent Reviewer when review is required.
- `VIBENEWS_ADVISOR_TEAM`: a separate Team area only when a valid responsible
  Advisor exists, with its assigned Worker, Designer, and Reviewer members.

Agent Office belongs to `FOUNDATION_ADVISOR_TEAM`; it is not privileged or an
independent authority. Reviewer Team membership is a responsibility grouping
and does not weaken reviewer independence, verdict authority, or separation
from the Worker execution chain. A future Agent Office Team requires a newly
appointed Advisor, recorded Team-assignment authority, formal member
reassignment, and an effective command hierarchy before it may appear active.

Spatial grouping is Advisor Team first. Project identity is then repeated in
clothing, desk accents, project signs, text, glyphs, and patterns with this
approved palette: Cosmile coral/pink; SIASIU mint/emerald; Foundation
navy/blue; VibeNews purple; Agent Office orange/amber; Control slate/charcoal
with a blue accent. Color is never the sole identifier. Severity, focus,
accessibility, and alert semantics override project color.

The official current project name is `SIASIU`. Historical/forbidden-name note
(not current product naming): the legacy tokens `Shashu`, `샤슈`, `SHASHU`, and
`shashu` are forbidden in current UI, fixtures, actor labels, locale resources,
tests, and baselines. A naming test must fail on any such current-product use;
an explicitly labelled historical citation is the only documentation exception.

## 8. Single Advisor Team Principle

The visual invariant is:

```text
For every active actor:
  exactly one responsible Advisor Team
  exactly one canonical responsibleAdvisorRoleInstanceId
  zero authority inferred from spatial proximity
```

An Advisor creates and leads an Advisor Team. Every actor obeying that Advisor
is a member of that Team. An actor without one valid canonical Advisor
assignment is `UNASSIGNED` and cannot receive work. Missing or multiple Team or
Advisor assignments fail closed and suppress task-signifying motion. A
reassignment requires canonical authority evidence; project color, office
location, adjacency, route lines, selection, or visual proximity never creates
or transfers authority. There is no exception to this invariant.

In the current single-Advisor-instance configuration, exactly one global
Advisor Hub character represents that one `Advisor roleInstanceId`; Team areas
reference it without cloning it. In a future reviewed multi-Advisor
configuration, the office renders one distinct Advisor Hub character for each
exact `Advisor roleInstanceId`, and every Team area references exactly one
responsible instance. One active Advisor instance is never cloned across Team
areas.

Missing assignment renders `ADVISOR_RESPONSIBILITY_UNKNOWN` plus `UNASSIGNED`.
Multiple assignments render `ADVISOR_RESPONSIBILITY_CONFLICT`. Both suppress
dispatch/result/decision route motion and work receipt. Project ownership or an
Inbox receipt never creates Advisor authority. Fable5 remains a separate
independent review identity and desk, never inside the Worker execution chain.

## 9. Shared floor and selected Team-area zones

Every Team area uses stable semantic zones rather than free-form coordinates.
The selected Team area expands its detail and enables full choreography:

1. **Pod header** - project identity, source/freshness, responsible Advisor,
   selected mission, manifest version, and exact progress.
2. **Mission board** - Initiative/package/mission/phase/WorkUnit hierarchy,
   dependencies, gates, current actor, evidence, alerts, and selected detail.
3. **Work zone** - verified Worker/Control assignments and their static current
   poses.
4. **Testing bench** - only an accepted `TESTING` projection uses the testing
   cue; its presence does not claim a passing result.
5. **Result desk** - writing and verified result-return cues remain distinct.
6. **Independent review desk** - spatially separated and labelled Fable5 review;
   review is never drawn as co-working at a Worker desk.
7. **Advisor Hub route anchor** - a non-authoritative visual endpoint linked to
   the single global Advisor character.
8. **Leo/GPT decision destination** - explicit decision-document endpoint,
   never a general message or dispatch route.
9. **Evidence cabinet** - exact verification state, hashes/commits through the
   existing redacted evidence surface, and freshness.
10. **Lounge and shared office paths** - bounded ambient presentation for
    verified `IDLE` actors and Channy only under Sections 9.2-9.3.

### 9.1 Mission board behavior

Every Advisor Team area contains a visible mission/electronic board. The
selected board shows one explicitly selected mission. When canonical evidence
exists, it must display this exact product field set:

- Team and project names;
- responsible Advisor;
- redacted registered Advisor model/session display identity;
- current mission;
- current Phase or WorkUnit;
- redacted registered current-actor model/session display identity;
- assigned Reviewer;
- next actor/handoff;
- WorkUnit progress and required-gate progress as separate facts;
- exact blocker;
- Leo/GPT decision state;
- latest verified evidence time and pointer; and
- explicit stale, unknown, or conflict state.

The detailed board may also show mission ID, package, manifest version,
projection sequence, source status, exact phase order, dependencies, observable,
evidence checklist, alert owner/next action, and links into existing Inbox,
Alerts, Evidence, and decision detail surfaces. Model/session identity is only a
registered, redacted display value. It never exposes raw pane/session locators,
filesystem paths, credentials, private transport details, or terminal content.
If a required display value lacks canonical evidence, the board shows
`UNKNOWN`; it does not infer from terminal prose, timestamps, nearest pod,
character proximity, model output, or stale/unverified fixtures.

Changing board selection moves no character and emits no cue. A route cue needs
the structured event contract in the companion document.

### 9.2 Lounge semantics

The lounge and other ambient office zones are not a collaboration,
communication, or presence system. A character may appear there only when the
actor registration is verified/current and either:

- an accepted `RoleActivityChanged(IDLE)` is current; or
- the actor has no active WorkUnit, retains one current canonical Advisor Team
  assignment, and the projection explicitly marks it verified idle.

Verified-idle presentation may include coffee, reading, resting, a small game,
looking through a window, using a whiteboard, visually interacting with Channy,
or a bounded visual talk pose. It means only `verified IDLE at evaluatedAt` and
never availability, assignment, shared context, collaboration, communication,
approval, or evidence. No dialogue content is generated. A new accepted
operational event immediately overrides ambient presentation. Entry/exit motion
requires a new accepted structured source ID; initial load and reload are
static.

### 9.3 Channy ambient companion boundary

The exact decision is
`CHANNY_ENABLED__NON_OPERATIONAL_AMBIENT_COMPANION_AND_STRUCTURED_STATUS_REFLECTOR`.
Channy is a cute Bedlington Terrier presentation character, not an actor,
authority, evidence source, adapter, notification channel, or workflow state.

Allowed behavior is bounded to verified shared-office paths and presentation:
roaming, visiting Team areas/shared spaces, sitting near a verified-idle actor,
eating, drinking, sleeping, resting, playing, observing, briefly following an
accepted routing cue, and reacting to structured `WAITING_LEO`, `BLOCKED`,
stale/offline, mission-complete, or valid dispatch/routing facts. A stale/offline
reaction is static and cannot bypass stale-motion suppression. When no accepted
source supports a reaction, Channy remains neutral ambient presentation.

Channy never inspects terminal/session content, infers unstructured state,
creates evidence, dispatches work, carries commands, approves a decision,
changes sessions, repairs a system, replaces an alert/mission board, or implies
communication or collaboration. Session/system checks remain structured-adapter
responsibility.
Reduced-motion/static mode exposes an equivalent neutral or status-reflector
pose and text without movement. The primary status, alert, mission board, and
accessible log always carry the meaning independently of Channy.

### 9.4 Operational presentation vocabulary

The exact M1.2 high-level operational presentation states are `IDLE`,
`WORKING`, `TESTING`, `ROUTING / DISPATCH`, `REVIEWING`, `RETURNING_RESULT`,
`NEEDS_PATCH`, `WAITING_DEPENDENCY`, `WAITING_LEO`, `BLOCKED`, `COMPLETED`,
`FAILED`, and `CANCELLED`. Existing M1 activity labels remain compatible detail
facts; they do not create additional high-level state truth. Operational state
always overrides ambient behavior.

## 10. Responsive and accessible architecture

### 10.1 Wide desktop (`>= 1200px`)

- global status bar across the top;
- one shared wide open-office floor with every registered Advisor Team area
  spatially visible;
- explicit Team navigation/minimap plus an in-place expanded selected Team area;
- 340-380px evidence/inbox/alerts inspector; and
- only the selected Team area mounts full operational choreography; other Team
  areas retain recognizable static or bounded ambient office presentation.

The floor uses CSS grid semantic zones. Local SVG route overlays use named zone
anchors, never hardcoded station-array coordinates. The DOM reading order
follows the information order in Section 5.1, not visual x/y position.

### 10.2 Tablet (`768px-1199px`)

- Team navigation/minimap becomes horizontal or collapsible focused paging;
- the selected Team remains detailed while every other Team remains reachable
  with the same summary meaning;
- mission board and floor stack when required by content;
- inspector becomes a labelled modal or non-modal drawer with explicit open
  state, focus containment when modal, and focus restoration; and
- spatial depth/decorative routes may simplify, but facts and labels do not.

### 10.3 Mobile (`< 768px`)

- one focused Team area, one mission board, and one semantic actor/zone list at
  a time, with explicit navigation to every other Team;
- no miniature floor plan and no hover dependency;
- pod selector, Overview, Team, Mission, Evidence, Inbox, and Alerts are explicit
  destinations;
- at most two full actor tiles are visible in a spatial page, preserving the M1
  bounded mobile model;
- route motion becomes an immediate origin -> destination timeline row; and
- the legacy M1 adapter retains its existing two-station pagination.

### 10.4 320px, 200% text, orientation, and touch

- one column, `min-width: 0`, normal label wrapping, and `overflow-wrap:anywhere`
  for IDs/hashes;
- no fixed-height text container that clips state, evidence, STOP, or alert
  content;
- controls and actor targets at least 44 by 44 CSS pixels;
- landscape/short viewport may hide decorative descriptions but not status,
  selection, motion control, alert, or decision facts;
- safe-area insets and software-keyboard resizing cannot cover the current
  selection or critical actions; and
- project identity, severity, assignment, and state remain text/icon/shape
  equivalent when color or spatial layout is unavailable.

### 10.5 Keyboard, screen reader, and focus model

- A skip link reaches global status, pod selector, selected mission board,
  spatial team/list equivalent, and inspector.
- The pod selector uses one roving tab stop; Arrow keys move, Home/End reach
  bounds, and Enter/Space selects. Selection leaves focus on the selector and a
  polite live region announces the new pod and freshness.
- The selected floor uses stable DOM order and one roving actor/zone tab stop.
  Arrow keys may follow spatial adjacency on desktop; the accessible list and
  mobile use linear order. Home/End remain deterministic.
- Opening a modal inspector moves focus to its heading/first meaningful control,
  traps it only while modal, and restores it to the invoker on close.
- SVG artwork and routes are decorative. A semantic state list and bounded
  activity log expose actor, WorkUnit, source status, cue origin/destination, and
  result in text.
- Ordinary changes announce once politely. A new critical blocker/alert announces
  once assertively; rerender, tab resume, Team selection, or non-selected-area
  updates do not repeat it.
- Reduced motion and static fallback expose the same state change immediately in
  text, icon, shape, focus order, and the activity log.

Target conformance remains WCAG 2.2 AA for implemented surfaces.

## 11. Rendering and performance architecture

M1.2 selects accessible DOM/SVG/CSS 2D/2.5D rendering because it directly extends
the current stack, retains semantic DOM/focus/zoom behavior, supports deterministic
component and Playwright tests, and satisfies the required zones/routes without
a new engine. Canvas/WebGL/3D would duplicate accessibility semantics and add
asset/rendering complexity without an evidenced requirement.

Hard design limits:

- one shared wide floor and one expanded Team area;
- at most eight full actor tiles on desktop/tablet and two on mobile;
- additional actors use a semantic paged/virtualized list, never tiny avatars;
- at most three pending transient cues across the selected Team area;
- at most one route actor/document cue at a time;
- non-selected Team areas have no full task-signifying choreography;
- every cue is 150-1200ms and transform/opacity only;
- no layout, width, height, top, left, scroll, camera, or focus animation; and
- reduced-motion/static mode mounts no route animation layer.

Measurable target budgets, which implementation must benchmark rather than claim
in advance, are canonical in the spatial animation contract. A benchmark miss
selects a reviewed lower presentation tier or blocks release; it does not weaken
source validation or hide stale/conflict/critical evidence.

## 12. M1 additive compatibility and rollback

M1.2 must not change the meaning or bytes of historical M1 manifests/events. It
adds a presentation schema and a pure `M1FixedStationAdapter`:

```text
existing RoleSceneProjection[8]
  -> existing M1 projector and exact mappings
  -> M1FixedStationAdapter
  -> spatialOffice.compatibilityMode=M1_FIXED_STATIONS
```

Compatibility requirements:

- keep all eight `OfficeStationId` values, station semantics, state/activity
  mapping, precedence, cue phase order, accepted-event-ID rules, and mobile
  two-station pagination; the only naming exception is the P-03 SIASIU
  correction, which removes forbidden current aliases/labels without changing
  actor authority or assignment meaning;
- keep existing M1 component behavior, contract, accessibility,
  source-boundary, E2E behavior, and six visual baseline bytes passing and
  unchanged; source fixtures/tests containing a forbidden current-name token
  must instead be corrected under the exact AO12-A naming scope;
- do not synthesize project/pod history for old events; the adapter presents a
  clearly labelled legacy fixed-station pod/view;
- add new M1.2 projection fields rather than replacing existing `sceneRoles`
  until compatibility review authorizes removal in a later major version;
- make presentation rollback select the M1 adapter without ledger, manifest,
  artifact, authority, or transport migration; and
- reject an unknown spatial projection version and retain the verified M1 view
  or static semantic fallback.

Rollback is presentation-only. It must not invoke Git rollback, rewrite data,
change runtime authority, or restart another mission automatically.

## 13. Approved placeholder art direction and deferred production gate

The exact product decision is
`APPROVE_PROJECT_AUTHORED_CODE_NATIVE_PLACEHOLDERS_FOR_M1_2_IMPLEMENTATION`.
Implementation may create project-authored CSS/DOM/SVG/simple local sprite-like
placeholders in an original cute 2D/2.5D pixel or pixel-inspired, warm retro
16/32-bit-console direction. The office should feel like a friendly, blocky
American startup/open office, with wood desks, glass meeting room, coffee
lounge, shared paths, project signs, mission boards, Reviewer booth, Advisor
desk/Hub, and Channy bed/food/water areas. It must not copy a protected artist,
franchise, game, or distinctive protected style.

This documentation patch creates no asset. Purchase, import, download,
commission, external generation, vendor selection, paid licensing, and external
asset acquisition remain prohibited. Any later production asset proposal must
provide, before an asset enters source:

- asset ID, semantic role, variant/state matrix, stable viewBox/dimensions, and
  1x/2x policy when raster;
- original source, creator/vendor, acquisition date, license text/type, permitted
  redistribution/modification, attribution, and purchase receipt if applicable;
- exact source and optimized-output SHA-256 values;
- no script, external link, remote fetch, tracking, embedded credential, real
  person/model/provider claim, or user-supplied SVG execution;
- light/dark/high-contrast/reduced-motion behavior and text/icon/shape fallback;
- performance measurements and deterministic browser snapshots on the configured
  runtime; and
- replacement compatibility: same semantic asset ID, stable dimensions,
  reviewed visual delta, updated license/hash inventory, and reversible commit.

Project-authored placeholder art cannot be relabelled as approved production
art. Replacing it later is additive, separately reviewed, inventory/hash/license
controlled, and must preserve semantic asset IDs and stable geometry.

## 14. Resolved Leo/GPT product decisions

Both formerly gated product choices are resolved by the chained Leo/GPT decision
record. They do not grant runtime, asset-acquisition, authority, transport, or
implementation permission.

### `AO12-FD-01`: Channy product role

Resolved as
`CHANNY_ENABLED__NON_OPERATIONAL_AMBIENT_COMPANION_AND_STRUCTURED_STATUS_REFLECTOR`
with the exhaustive allowed/prohibited boundary in Section 9.3.

### `AO12-FD-02`: Character/art direction and asset source

Resolved as
`APPROVE_PROJECT_AUTHORED_CODE_NATIVE_PLACEHOLDERS_FOR_M1_2_IMPLEMENTATION` with
the original direction and external-acquisition prohibition in Section 13.

## 15. Acceptance boundary for this patched design candidate

The narrow patch is ready for the same-existing-Fable5 Level-3 delta review only
when the four canonical documents and the Feature Index status/pointer:

- resolve or gate all `AO12-U01` through `AO12-U14` without renaming them;
- define exact source, precedence, deduplication, reload, stale/offline,
  reduced-motion, accessibility, responsive, and performance behavior;
- distinguish the five design-mission WorkUnits from all unauthorized future
  implementation WorkUnits;
- provide future file/test/gate traceability and reversible batches;
- preserve M1 authority, communication, security, event, and compatibility
  boundaries; and
- keep design intent distinct from as-built status and contain no asset,
  credential, external fetch, or runtime activation claim.

The original Fable5 design review and clean same-context Level-3 delta review
passed. Advisor froze `AO12-IWU-01` through `AO12-IWU-14` into the exact serial,
reversible manifest and issued a separate AO12-A handoff. `AO12-IWU-01..04` are
now implemented as a non-production-selected application layer with unchanged
M1 baselines. Independent focused implementation review and Advisor acceptance
remain open, so AO12-B is not authorized. No later WorkUnit, asset, spatial cue
runtime, or production projection wiring is claimed.

## 16. Canonical M1.2 design map

- Spatial architecture and IA: this document.
- Structured spatial cue contract:
  [`../contracts/AGENT_OFFICE_M1_2_SPATIAL_EVENT_ANIMATION_CONTRACT.md`](../contracts/AGENT_OFFICE_M1_2_SPATIAL_EVENT_ANIMATION_CONTRACT.md).
- Character/project identity and asset contract:
  [`../ui/AGENT_OFFICE_M1_2_CHARACTER_PROJECT_IDENTITY_SYSTEM.md`](../ui/AGENT_OFFICE_M1_2_CHARACTER_PROJECT_IDENTITY_SYSTEM.md).
- Future batches, acceptance, rollback, and unknown traceability:
  [`../operations/AGENT_OFFICE_M1_2_IMPLEMENTATION_WORKUNIT_PLAN.md`](../operations/AGENT_OFFICE_M1_2_IMPLEMENTATION_WORKUNIT_PLAN.md).
- Discoverability/status pointer: [`../FEATURE_INDEX.md`](../FEATURE_INDEX.md).
