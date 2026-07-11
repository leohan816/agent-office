# Agent Office M1.2 Spatial Advisor-Team Office Master Design

Status: `DESIGN_CANDIDATE__IMPLEMENTATION_NOT_STARTED_NOT_AUTHORIZED__PENDING_FABLE5_REVIEW`

Canonical owner: Agent Office repository

Design mission: `AGENT_OFFICE_M1_2_SPATIAL_ANIMATED_ADVISOR_TEAM_OFFICE`

Target implementation status: `NOT_STARTED_NOT_AUTHORIZED`

This document is an additive design candidate over the closed M1 base
`2f663304a88c432f19fe56055641b66e57f18ef2`. It defines a spatial,
evidence-backed office projection for one Advisor-led team across registered
projects. It does not authorize source, configuration, test, asset, authority,
transport, authentication, network, database, deployment, or runtime changes.

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

The frozen IDs remain stable. Technical resolutions below are candidates for
independent review; Leo/GPT-owned decisions remain unresolved.

| Unknown | Candidate resolution | Status/gate |
|---|---|---|
| `AO12-U01` Dynamic Team Pod Model | One selected pod is expanded; other registered pods are compact verified summaries. Pod identity is stable and derived from trusted project/mission references. | `TECHNICALLY_RESOLVED__PENDING_REVIEW` |
| `AO12-U02` Single Advisor Team Principle | One canonical Advisor character remains in a global Advisor Hub. Every pod has exactly one responsibility reference to an Advisor role instance; missing or multiple references fail closed. | `TECHNICALLY_RESOLVED__NO_AUTHORITY_CHANGE` |
| `AO12-U03` Project Color System | A versioned deterministic project identity tuple combines color, pattern, glyph, and text. Severity always overrides project color. | `TECHNICALLY_RESOLVED__PENDING_CONTRAST_TESTS` |
| `AO12-U04` Actor Character Identity | Code-native role silhouettes plus visible role/project labels and existing state overlays; project-authored placeholders only until the asset gate. | `TECHNICALLY_RESOLVED__PRODUCTION_ASSET_DEFERRED` |
| `AO12-U05` Channy Definition | Reserved disabled slot with no rendered actor, state, authority, route, notification, or behavior. | `LEO_GPT_DECISION_REQUIRED` |
| `AO12-U06` Lounge Semantics | Selected-pod ambient zone for verified `IDLE` actors only; it never implies collaboration, availability, or assignment. | `TECHNICALLY_RESOLVED__PENDING_REVIEW` |
| `AO12-U07` Truthful Animation | Only new accepted structured source IDs create bounded cues; compact pods do not show task-signifying motion. | `TECHNICALLY_RESOLVED__CONTRACT_REQUIRED` |
| `AO12-U08` Mission Board | One selected mission board shows exact hierarchy, manifest version, counts, phase, WorkUnit, actor, evidence, gates, alerts, and Leo decision path. | `TECHNICALLY_RESOLVED__PENDING_COMPONENT_TESTS` |
| `AO12-U09` Rendering Architecture | Accessible DOM for semantics and layout, local SVG for characters/routes, CSS transform/opacity for motion. No Canvas/WebGL/3D engine. | `TECHNICALLY_RESOLVED` |
| `AO12-U10` Responsive Navigation | Desktop spatial floor; tablet simplified floor; mobile semantic pod/list/detail. No miniature unreadable floor. | `TECHNICALLY_RESOLVED__PENDING_BROWSER_TESTS` |
| `AO12-U11` Reduced Motion/Performance | Static semantic equivalence, fixed cue/visible-actor caps, and separately measured benchmark targets with fallbacks. | `TECHNICALLY_RESOLVED__BENCHMARK_REQUIRED` |
| `AO12-U12` Multi-Project Identity/Host Boundaries | One canonical actor identity may have assignment views, never duplicated live actors. Conflicting active assignments or sources render `CONFLICT`. | `TECHNICALLY_RESOLVED__NO_TRUST_EXPANSION` |
| `AO12-U13` Asset Source/Style | Define a versioned inventory/license/hash/replacement contract now; production art style/source remains Leo/GPT-gated. | `LEO_GPT_DECISION_REQUIRED__ASSET_GATE` |
| `AO12-U14` Compatibility/Migration | Add a versioned spatial projection and an M1 fixed-station adapter. Existing M1 events, station IDs, mapping, tests, and baselines remain unchanged. | `TECHNICALLY_RESOLVED__ADDITIVE_ONLY` |

Detailed traceability appears in
[`../operations/AGENT_OFFICE_M1_2_IMPLEMENTATION_WORKUNIT_PLAN.md`](../operations/AGENT_OFFICE_M1_2_IMPLEMENTATION_WORKUNIT_PLAN.md).

## 5. Spatial information architecture

### 5.1 Global office frame

The top-level semantic order is fixed:

```text
Global status and authority facts
  -> Initiative and registered Team Pod selector
  -> Selected Team Pod
       -> Pod identity and responsible-Advisor reference
       -> Selected mission board
       -> Spatial team floor or static equivalent
       -> Actor/WorkUnit detail
  -> Evidence, Inbox, Alerts, and decision inspector
```

Global status retains network, authentication, projection revision, freshness,
delivery/manual-fallback, offline, and recovery facts from M1. The M1.2 surface
does not add a global command box, destination selector, or role dispatcher.

The Initiative selector groups trusted registered projects. A project may have
zero or more visible mission summaries, but only a canonical, Git-verified
manifest may create a mission board. A registered project without mission
authority renders `NO_VERIFIED_MISSION`, not an empty active office.

### 5.2 Hierarchy mapping

The existing canonical hierarchy maps to the spatial surface without changing
identity or count semantics:

| Canonical entity | Spatial projection |
|---|---|
| Initiative | Global office campus/header and pod collection |
| Project registration | Team Pod identity and source boundary |
| Package | Mission-board grouping label |
| Mission | One selectable versioned mission board inside its project pod |
| Phase | Ordered board lane; never inferred from floor location |
| WorkUnit | Board item linked to exactly one verified assignment view |
| Actor role instance | One canonical character identity plus zero or more non-authoritative assignment references |
| Evidence | Evidence cabinet/inspector with verification/freshness text |
| Alert/blocker | Persistent severity overlay and accessible alert item |
| Leo/GPT decision | Explicit decision path from Advisor Hub to the Leo decision destination |

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
  podId, projectId, displayName, projectIdentity
  authorityStatus, evidenceFreshness, connectionState
  responsibleAdvisorRoleInstanceId
  selectedMissionRef, missionSummaries[]
  actorAssignments[], alertSummary, evidenceSummary
actorsByRoleInstanceId{}
selectedMissionBoard
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

## 7. Dynamic Team Pod model

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

### 7.2 One selected pod versus compact summaries

Exactly one pod may be expanded in a browser view. Selection precedence is:

1. a still-valid explicit browser selection;
2. an exact mission deep link that resolves to a trusted visible pod; or
3. the first pod by stable `projectId` lexical order.

A missing selection never guesses from activity, alert severity, model output,
or most-recent terminal use. Compact non-selected pods show only:

- project text ID/name plus color/pattern/glyph identity;
- responsible Advisor reference or `AUTHORITY_UNKNOWN/CONFLICT`;
- selected/most recently explicitly viewed mission label, if any;
- manifest version and exact completed/denominator count;
- freshness/connection text and icon;
- open alert count and highest severity; and
- actor counts by verified static state category.

Compact summaries never show walking, typing, handoff, review, testing, result,
or decision motion. They may update text/icon/shape immediately from a new
projection. This both preserves truth and bounds rendering work.

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
are assignment views, not multiple live identities. Only the selected pod may
render the full character, and only when the exact assignment and sources are
non-conflicting.

## 8. Single Advisor Team Principle

The visual invariant is:

```text
For every visible Team Pod:
  exactly one responsibleAdvisorRoleInstanceId
  exactly one responsibility marker
  zero duplicated Advisor authority characters
```

One canonical Advisor character is rendered at the global Advisor Hub. A single
Advisor may responsibly reference multiple pods; each pod header names the same
role instance without cloning the character. If a future configuration contains
multiple Advisor role instances, every pod still requires one explicit
responsible assignment from reviewed trusted configuration.

Missing assignment renders `ADVISOR_RESPONSIBILITY_UNKNOWN`. Multiple assignments
render `ADVISOR_RESPONSIBILITY_CONFLICT`. Both suppress dispatch/result/decision
route motion. Spatial proximity, route lines, pod selection, project ownership,
or an inbox receipt never creates Advisor authority. Fable5 remains a separate
independent review identity and desk, never inside the Worker execution chain.

## 9. Selected Team Pod zones

The expanded pod uses stable semantic zones rather than free-form coordinates:

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
10. **Lounge** - ambient presentation for verified `IDLE` actors only.

### 9.1 Mission board behavior

The board shows one explicitly selected mission and must always display:

- mission ID, package, manifest version, projection sequence, and source status;
- exact phase order and the selected WorkUnit's dependencies;
- WorkUnit state separately from required observable/activity;
- assigned actor role instance and assignment confidence;
- completion/evidence checklist and required review/decision gates;
- open blocker/alert severity, owner, next action, and freshness; and
- links into existing Inbox, Alerts, Evidence, and decision detail surfaces.

Changing board selection moves no character and emits no cue. A route cue needs
the structured event contract in the companion document.

### 9.2 Lounge semantics

The lounge is not a collaboration or presence system. A character may appear
there only when the actor registration is verified/current and either:

- an accepted `RoleActivityChanged(IDLE)` is current; or
- the actor has no assigned active WorkUnit and the projection explicitly marks
  it unassigned/idle.

Lounge appearance means only `verified IDLE at evaluatedAt`. It does not mean
available, online for new work, communicating, waiting for assignment, or sharing
context with another actor. No speech bubble, conversation, group huddle,
autonomous roaming, or cross-actor interaction is defined. Entry/exit motion
requires a new accepted structured source ID; initial load and reload are static.

### 9.3 Channy reserved slot

`Channy` has no definition in current source or canonical documents. M1.2
therefore defines only `CHANNY_DISABLED`, which renders no character, control,
state, route, notification, authority marker, autonomous behavior, or analytics.
The slot cannot consume mission events. Any enabled Channy design requires a
Leo/GPT product decision, an updated frozen register, a new reviewed contract
version, and separate implementation authorization.

## 10. Responsive and accessible architecture

### 10.1 Wide desktop (`>= 1200px`)

- global status bar across the top;
- 240-280px Team Pod selector with compact summaries;
- flexible selected-pod stage with mission board and spatial zones;
- 340-380px evidence/inbox/alerts inspector; and
- only the selected pod mounts full character SVGs or cue layers.

The floor uses CSS grid semantic zones. Local SVG route overlays use named zone
anchors, never hardcoded station-array coordinates. The DOM reading order
follows the information order in Section 5.1, not visual x/y position.

### 10.2 Tablet (`768px-1199px`)

- pod summaries become a horizontal or collapsible selector;
- the selected pod remains the only detailed floor;
- mission board and floor stack when required by content;
- inspector becomes a labelled modal or non-modal drawer with explicit open
  state, focus containment when modal, and focus restoration; and
- spatial depth/decorative routes may simplify, but facts and labels do not.

### 10.3 Mobile (`< 768px`)

- one selected pod, one mission board, and one semantic actor/zone list;
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
  once assertively; rerender, tab resume, pod selection, or compact-summary
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

- one expanded pod;
- at most eight full actor tiles on desktop/tablet and two on mobile;
- additional actors use a semantic paged/virtualized list, never tiny avatars;
- at most three pending transient cues across the selected pod;
- at most one route actor/document cue at a time;
- compact pods have no task-signifying motion;
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

- keep all eight `OfficeStationId` values, station labels, role normalization,
  state/activity mapping, precedence, cue phase order, accepted-event-ID rules,
  and mobile two-station pagination;
- keep existing M1 component, contract, accessibility, source-boundary, E2E, and
  six visual baseline tests unchanged and passing;
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

## 13. Deferred asset-production gate

This design creates no asset. A future asset proposal must provide, before any
asset enters source:

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

Until Leo/GPT chooses an art direction and source, implementation may use only
newly reviewed Agent Office project-authored code-native placeholder geometry.
Placeholder art cannot be relabelled as approved production art.

## 14. Founder decisions returned to Leo/GPT

Only genuine product choices are returned here. Technical defaults above do not
resolve them.

### `AO12-FD-01`: Channy product role

Leo/GPT must choose whether Channy is absent, a non-operational companion, a
guide, or another explicitly defined product concept. If present, Leo/GPT must
define purpose, allowed information, location, interaction, and whether any
notification is permitted. No option may silently grant authority or role
dispatch. Safe state until decision: `CHANNY_DISABLED`.

### `AO12-FD-02`: Production character/art direction and asset source

Leo/GPT must choose the production visual style and whether assets remain
project-authored or use a separately approved licensed/commissioned source.
Purchase, import, generation, and vendor selection are not authorized by this
design. Safe state until decision: code-native placeholders only, with the asset
gate in Section 13.

No other Leo/GPT decision is required to review the technical design candidate.

## 15. Acceptance boundary for this design candidate

The design candidate is ready for independent review only when the four new
canonical documents and the Feature Index pointer/status addition:

- resolve or gate all `AO12-U01` through `AO12-U14` without renaming them;
- define exact source, precedence, deduplication, reload, stale/offline,
  reduced-motion, accessibility, responsive, and performance behavior;
- distinguish the five design-mission WorkUnits from all unauthorized future
  implementation WorkUnits;
- provide future file/test/gate traceability and reversible batches;
- preserve M1 authority, communication, security, event, and compatibility
  boundaries; and
- contain no implementation, asset, credential, external fetch, or runtime
  activation claim.

Fable5 independent design review and Advisor/Leo routing remain mandatory. A
design `PASS` would still not authorize implementation.

## 16. Canonical M1.2 design map

- Spatial architecture and IA: this document.
- Structured spatial cue contract:
  [`../contracts/AGENT_OFFICE_M1_2_SPATIAL_EVENT_ANIMATION_CONTRACT.md`](../contracts/AGENT_OFFICE_M1_2_SPATIAL_EVENT_ANIMATION_CONTRACT.md).
- Character/project identity and asset contract:
  [`../ui/AGENT_OFFICE_M1_2_CHARACTER_PROJECT_IDENTITY_SYSTEM.md`](../ui/AGENT_OFFICE_M1_2_CHARACTER_PROJECT_IDENTITY_SYSTEM.md).
- Future batches, acceptance, rollback, and unknown traceability:
  [`../operations/AGENT_OFFICE_M1_2_IMPLEMENTATION_WORKUNIT_PLAN.md`](../operations/AGENT_OFFICE_M1_2_IMPLEMENTATION_WORKUNIT_PLAN.md).
- Discoverability/status pointer: [`../FEATURE_INDEX.md`](../FEATURE_INDEX.md).
