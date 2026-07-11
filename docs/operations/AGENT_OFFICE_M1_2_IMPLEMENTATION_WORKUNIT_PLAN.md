# Agent Office M1.2 Implementation WorkUnit Plan

Status: `AO12_A_IMPLEMENTED__PENDING_FOCUSED_FABLE5_REVIEW_AND_ADVISOR_ACCEPTANCE__AO12_B_NOT_AUTHORIZED`

Design mission: `AGENT_OFFICE_M1_2_SPATIAL_ANIMATED_ADVISOR_TEAM_OFFICE`

This plan records the frozen reversible implementation train and AO12-A
as-built status. It is not an implementation launcher, handoff, permission,
review verdict, branch decision, asset approval, or authority change. Every
later batch requires a new exact Advisor handoff after the preceding dependency
and review gate are accepted.

## 1. Two distinct WorkUnit namespaces

### 1.1 Reviewed five-unit design mission and current narrow patch

The current governance manifest is
`advisor.design-mission-manifest.v1`, denominator 5:

| Design WorkUnit | Actor | Purpose | State after original reviewed package |
|---|---|---|---|
| `AO12-DWU-01` | Advisor | Repository inventory, entry gate, frozen unknown register | `COMPLETED` |
| `AO12-DWU-02` | Agent Office Worker | Canonical spatial-office design package | `COMPLETED` |
| `AO12-DWU-03` | Advisor | Design result/evidence validation | `COMPLETED` |
| `AO12-DWU-04` | Fable5 Reviewer | Independent Level-3 design review | `COMPLETED__PASS` |
| `AO12-DWU-05` | Advisor | Final design audit and Leo/GPT decision package | `COMPLETED` |

Those rows are prior reviewed evidence, not current execution state. The current
narrow patch applies chained product decisions P-01 through P-08 to the same
five canonical design documents. It cannot start an implementation WorkUnit.

### 1.2 Frozen implementation namespace

The clean same-context Level-3 design delta review returned `PASS` with no risk,
unresolved defect, new decision, or scope expansion. Advisor then froze
`AO12-IWU-01` through `AO12-IWU-14` in the exact versioned implementation
manifest. The separate AO12-A handoff authorized `AO12-IWU-01..04`, which are
implemented pending independent focused review and Advisor acceptance.
`AO12-IWU-05..14` remain waiting and unauthorized. These implementation IDs do
not change the five-WorkUnit design-mission denominator and no later batch may be
projected as active scope.

No Designer session is assumed or created. The existing Agent Office Worker is
the candidate implementation owner unless a later exact manifest identifies an
already existing, authorized Designer role.

## 2. Serial gate before implementation

No `AO12-IWU-*` may start unless all are true:

1. the narrow patch result and exact five-file diff are published;
2. Advisor validates the result/branch/upstream evidence;
3. the same existing Fable5 context performs Level-3 delta review of the exact
   patched design commit;
4. the delta result is clean `PASS` with no risk, unresolved defect, new
   decision, or scope expansion;
5. Advisor freezes `AO12-IWU-01` through `AO12-IWU-14` into an exact versioned
   implementation manifest and explicitly authorizes the first serial batch;
6. Advisor publishes an exact batch handoff with branch, base, allowlist, tests,
   exclusions, result, and pointer paths; and
7. every dependency and preceding-batch review gate is accepted.

`NEEDS_PATCH`, any risk, or any new decision returns to Advisor. `FAIL` stops.
Silence, a design commit, or a passing local check is not authorization.

These entry conditions were satisfied for the exact AO12-A handoff only. Local
AO12-A verification is not independent review or Advisor acceptance and does not
satisfy the gate for AO12-B.

## 3. Reversible batch overview

| Batch | Future WorkUnits | Reversible boundary | Required gate after batch |
|---|---|---|---|
| `AO12-A` Contracts, compatibility, Team/Advisor invariants, and SIASIU correction | `AO12-IWU-01` through `AO12-IWU-04` | No production spatial-UI selection; existing `sceneRoles` and M1 component remain authoritative presentation, apart from the exact naming-only correction | Focused contract/compatibility/authority/naming review plus Advisor acceptance |
| `AO12-B` Shared static floor and identity | `AO12-IWU-05` through `AO12-IWU-08` | New shared-floor component remains fixture/test-only; no task motion or production projection wiring | Fable5 UI/accessibility/asset-boundary review plus Advisor acceptance |
| `AO12-C` Evidence-backed spatial motion | `AO12-IWU-09` through `AO12-IWU-11` | Cue runtime remains isolated behind typed spatial projection; static tier and M1 adapter remain immediate fallback | Fable5 event-truth/accessibility/performance review plus Advisor acceptance |
| `AO12-D` Composed integration and as-built closure | `AO12-IWU-12` through `AO12-IWU-14` | Additive projection field and version selector can fall back to unchanged M1 without ledger/schema rewrite | Full implementation/security review, Advisor private verification, then Leo/GPT decision |

No batch may be combined to bypass its dependency or review. No batch may add
an auth, network, Advisor delivery, role dispatch, DB, secret, or asset-purchase
change.

Current batch state: AO12-A is implemented and locally verified, pending focused
Fable5 review and Advisor acceptance. AO12-B, AO12-C, and AO12-D remain
unauthorized.

## 4. Batch AO12-A - contracts, compatibility, Team/Advisor invariants, and SIASIU correction

### `AO12-IWU-01` Spatial projection types and validators

State: `IMPLEMENTED_AO12_A__PENDING_FOCUSED_FABLE5_REVIEW_AND_ADVISOR_ACCEPTANCE`

As-built scope:

- `src/application/spatial-office/types.ts`
- `src/application/spatial-office/validation.ts`
- `tests/contract/spatial-office-projection.test.ts`

Acceptance criteria:

- exact `agent-office.spatial-office-projection.v1` validation;
- stable Advisor Team/project/pod/mission/actor/assignment/responsible-Advisor
  references and catalog version;
- exact mission-board facts with redacted registered model/session display
  identities, explicit unknown/stale/conflict values, and no raw pane/session,
  path, credential, private transport, terminal, proximity, or prose inference;
- unknown fields/versions, duplicate IDs, inconsistent project/mission refs, and
  unsafe path/target-shaped data reject;
- no event, command, adapter, authority, transport, credential, or persistence
  dependency; and
- deterministic canonical serialization fixtures.

### `AO12-IWU-02` M1 fixed-station compatibility adapter

State: `IMPLEMENTED_AO12_A__PENDING_FOCUSED_FABLE5_REVIEW_AND_ADVISOR_ACCEPTANCE`

As-built scope:

- `src/application/spatial-office/m1-fixed-station-adapter.ts`
- `tests/ui/m1-spatial-adapter.test.ts`
- existing M1 scene tests and six baselines as read-only compatibility evidence

Acceptance criteria:

- exact eight station IDs/order/coordinates and canonical SIASIU role
  normalization preserved;
- exact M1 state/activity mapping, precedence, route phases, duration caps,
  accepted IDs, deduplication, and two-station mobile pagination preserved;
- existing role/assignment meaning remains exact while the separately specified
  current-name alias/fixture correction removes forbidden naming tokens;
- legacy view labelled `M1_FIXED_STATIONS` without invented project history;
- unknown spatial versions fall back static/M1; and
- existing M1 test results and baseline bytes remain unchanged.

### `AO12-IWU-03` Dynamic Team Pod projector

State: `IMPLEMENTED_AO12_A__PENDING_FOCUSED_FABLE5_REVIEW_AND_ADVISOR_ACCEPTANCE`

As-built scope:

- `src/application/spatial-office/projector.ts`
- `src/application/spatial-office/fixtures.ts`
- `tests/ui/spatial-office-projector.test.ts`

Acceptance criteria:

- one shared American-style open-office floor with one stable Team area/Pod per
  trusted registration and every registered Advisor Team spatially visible on
  wide desktop;
- one explicitly selected Team area expands detail and full choreography while
  every non-selected Team remains a recognizable office area, never an ordinary
  card;
- verified manifest required for active mission board;
- deterministic selection fallback by stable `projectId`, never activity;
- every non-selected Team shows Team name, responsible Advisor, current main
  mission, current actor/state, and gate/blocker summary without full task
  choreography;
- tablet/mobile focused paging, minimap, or Team navigation preserves the same
  facts and relationships; and
- replay from equal inputs is byte-equivalent excluding explicit evaluation
  metadata.

### `AO12-IWU-04` Assignment, Single Advisor, and SIASIU current-name invariants

State: `IMPLEMENTED_AO12_A__PENDING_FOCUSED_FABLE5_REVIEW_AND_ADVISOR_ACCEPTANCE`

As-built scope:

- `src/application/spatial-office/assignment-resolver.ts`
- `tests/ui/spatial-assignment.test.ts`
- exact naming-only correction in `src/runtime/operational-config.ts` and
  `src/ui/scene/types.ts`
- exact negative-fixture correction in
  `tests/integration/exact-advisor-delivery.test.ts`
- a repository-boundary current-name regression path named by the exact batch
  handoff, covering current UI, fixtures, actor labels, locale strings, tests,
  and baselines without retaining forbidden fixture tokens

Acceptance criteria:

- `(projectId, missionId, workUnitId)` resolves to exactly one compatible
  `roleInstanceId`;
- one canonical actor may have several static assignment refs but at most one
  full character;
- missing, duplicate, cross-project/host/source, or simultaneous active
  conflicts fail closed and suppress motion;
- every active actor belongs to exactly one responsible Advisor Team; missing or
  multiple assignments render `UNASSIGNED`, block work receipt, and suppress
  task motion;
- current single-Advisor mode renders one global character for the exact active
  `Advisor roleInstanceId`; future multi-Advisor mode renders one distinct Hub
  character per exact instance, with no active instance cloned;
- initial `FOUNDATION_ADVISOR_TEAM` and conditional `VIBENEWS_ADVISOR_TEAM`
  assignments match canonical authority evidence, and reassignment requires
  canonical authority evidence rather than proximity;
- Reviewer remains independent from Worker execution assignments;
- official current naming is only `SIASIU`; the exact forbidden-token scan is
  zero across current product surfaces while explicitly marked historical
  documentation citations remain outside that product scan; and
- the naming-only correction changes no actor ID, authority, assignment,
  transport, event, state, or baseline pixels.

### AO12-A verification and rollback

Required checks:

- focused contract/projector/assignment/adapter tests;
- all existing domain, activity, scene, project-freshness, runtime projection,
  UI, and visual tests;
- lint, strict typecheck, both builds, dependency audit, and `git diff --check`;
- source-boundary scan for process/network/write/dispatch imports;
- current-product forbidden-name scan with zero hits across source, UI,
  fixtures, actor labels, locale strings, tests, and baselines; and
- exact changed-path/staged-path audit.

AO12-A local as-built evidence, pending independent review:

- five focused files pass 22 tests;
- the full sequential Vitest suite passes 61 files and 318 tests;
- existing Playwright demo and composed suites pass 18/18 and 3/3;
- lint, strict typecheck, core/dashboard builds, and dependency audit pass;
- the repository current-product name gate passes 214 scanned files;
- the spatial application folder has no process, network, write, adapter,
  gateway, persistence, transport, or dispatch dependency;
- all six pre-existing visual baseline SHA-256 values equal exact base
  `b7d8cdb`; and
- no package, lockfile, asset, production projection, authority, transport,
  authentication, DB, network, or runtime-selection path changed.

Rollback: revert the additive `src/application/spatial-office/` consumer/tests
and the exact naming-only source/test correction as one reviewed AO12-A unit.
The prior M1 surface remains operable but is ineligible for M1.2 until the
SIASIU correction is reapplied. No ledger, manifest, projection store,
authority, transport, or baseline bytes change.

Gate: independent focused design/contract implementation review and Advisor
acceptance before AO12-B.

## 5. Batch AO12-B - shared static floor and identity

### `AO12-IWU-05` Deterministic project identity catalog

State: `NOT_STARTED_NOT_AUTHORIZED_PENDING_PRECEDING_BATCH_REVIEW_AND_ADVISOR_ACCEPTANCE`

Candidate scope:

- `src/ui/spatial/project-identity.ts`
- `src/ui/spatial/project-identity.css`
- `tests/ui/project-identity.test.ts`

Acceptance criteria:

- exact fixed palette: Cosmile coral/pink, SIASIU mint/emerald, Foundation
  navy/blue, VibeNews purple, Agent Office orange/amber, and Control
  slate/charcoal with blue accent;
- Advisor Team-first grouping plus clothing, desk accent, sign, text, glyph, and
  pattern identity; deterministic SHA-256 catalog-v1 fallback only for unmapped
  future projects, independent of registry order;
- visible text/pattern/glyph/edge identity and collision marker;
- canonical current `SIASIU` naming in every M1.2 identity output, with the
  AO12-A repository-wide forbidden-name gate retained as regression evidence;
- no local mutable assignment store;
- severity/freshness/focus tokens override project hue;
- light/dark/monochrome/forced-color and exact collision fixtures pass; and
- all tested text/graphical/focus contrast thresholds pass.

### `AO12-IWU-06` Project-authored character placeholders and inventory

State: `NOT_STARTED_NOT_AUTHORIZED_PENDING_PRECEDING_BATCH_REVIEW_AND_ADVISOR_ACCEPTANCE`

Candidate scope:

- `src/ui/spatial/character.tsx`
- `src/ui/spatial/assets/placeholder-characters.tsx`
- `src/ui/spatial/assets/ASSET_INVENTORY.md`
- `src/ui/spatial/asset-registry.ts`
- `tests/ui/spatial-asset-contract.test.ts`

Acceptance criteria:

- only original Agent Office project-authored CSS/DOM/SVG/simple local
  sprite-like placeholders in the approved cute 2D/2.5D pixel/pixel-inspired,
  warm retro 16/32-bit-console, friendly blocky American open-office direction;
- wood desks, glass meeting room, coffee lounge, shared paths, project signs,
  mission boards, Reviewer booth, Advisor desk/Hub, and Channy bed/food/water slots
  remain code-native placeholders and copy no protected style;
- stable slot geometry, ownership, internal license, and source SHA-256;
- role category plus text/icon/shape, project assignment separately layered;
- no real person/model/provider claim, script, remote ref, runtime fetch,
  executable SVG, sound, or new rendering dependency;
- missing/invalid asset falls back without layout shift; and
- one cute Bedlington Terrier Channy placeholder carries no actor role,
  authority, assignment, notification, terminal/session inspection, command,
  approval, repair, or inferred state.

This WorkUnit does not authorize production art, purchase, import, external
generation, commission, vendor selection, paid license, or behavior outside
`CHANNY_ENABLED__NON_OPERATIONAL_AMBIENT_COMPANION_AND_STRUCTURED_STATUS_REFLECTOR`.
The placeholder decision is
`APPROVE_PROJECT_AUTHORED_CODE_NATIVE_PLACEHOLDERS_FOR_M1_2_IMPLEMENTATION`.

### `AO12-IWU-07` Static Team Pod, mission board, and semantic zones

State: `NOT_STARTED_NOT_AUTHORIZED_PENDING_PRECEDING_BATCH_REVIEW_AND_ADVISOR_ACCEPTANCE`

Candidate scope:

- `src/ui/spatial/spatial-office.tsx`
- `src/ui/spatial/team-pod.tsx`
- `src/ui/spatial/mission-board.tsx`
- `src/ui/spatial/spatial-office.css`
- `tests/ui/spatial-office.component.test.tsx`

Acceptance criteria:

- global status, one shared floor, every registered Team area, one selected area
  expanded in place, Team navigation/minimap, mission board, zones, actor
  detail, and evidence/alert links in canonical DOM order;
- non-selected areas remain recognizable office spaces and expose Team name,
  responsible Advisor, current main mission, current actor/state, and
  gate/blocker summary;
- selected board exposes Team/project names, responsible Advisor, redacted
  registered Advisor model/session identity, mission, Phase/WorkUnit, redacted
  current-actor model/session identity, Reviewer, next actor/handoff, WorkUnit
  and gate progress, exact blocker, Leo/GPT decision state, latest verified
  evidence time/pointer, and stale/unknown/conflict;
- exact manifest version, dependencies, assignment, evidence, freshness, and
  alert facts remain additive and contain no raw pane/session locator, path,
  credential, private transport, terminal prose, or inferred value;
- work/testing/result/review/Advisor/Leo-GPT/evidence/lounge zones are labelled
  but static;
- no movement, dispatch control, role target, fake live state, or direct adapter
  import; and
- current/future Advisor-instance uniqueness and a spatially separate
  independent review desk.

### `AO12-IWU-08` Responsive and accessible static architecture

State: `NOT_STARTED_NOT_AUTHORIZED_PENDING_PRECEDING_BATCH_REVIEW_AND_ADVISOR_ACCEPTANCE`

Candidate scope:

- static component/style refinements within the AO12-B allowlist;
- reviewed new locale entries in `src/ui/i18n/ko.ts` only if an exact handoff
  supplies approved vocabulary;
- `tests/ui/spatial-accessibility.test.tsx`
- `tests/e2e/spatial-office-static.spec.ts`

Acceptance criteria:

- desktop/tablet/mobile/320px/200% text/short-landscape no-overlap and no page
  overflow;
- mobile focused Team list/detail and maximum two full actor tiles, with
  explicit navigation preserving every Team's meaning and no unreadable
  miniature floor;
- pod and actor roving focus, skip links, modal inspector focus/restore, 44px
  controls, visible focus, semantic state list, and live regions;
- WCAG 2.2 A/AA automated audit plus keyboard/screen-reader-oriented assertions;
- project/actor/state identity survives color/SVG removal and forced colors; and
- no M1 baseline or behavior changes.

### AO12-B verification and rollback

Required checks:

- focused identity/asset/component/accessibility/browser suites;
- current M1 full regression and unchanged baseline hashes;
- visual baselines for static M1.2 fixtures only under the configured local
  browser/font runtime, with direct inspection and no portability claim;
- asset inventory/hash/license/source-boundary scans;
- lint, typecheck, builds, audit, diff, exact path, and no dependency/lockfile
  change unless separately authorized.

Rollback: the new component remains test/fixture-only and can be removed without
changing `src/runtime/projection.ts`, production entry, ledger, config, or M1
surface.

Gate: Fable5 UI/accessibility/asset-boundary review and Advisor acceptance before
AO12-C.

## 6. Batch AO12-C - evidence-backed spatial motion

### `AO12-IWU-09` Spatial cue projector and reducer

State: `NOT_STARTED_NOT_AUTHORIZED_PENDING_PRECEDING_BATCH_REVIEW_AND_ADVISOR_ACCEPTANCE`

Candidate scope:

- `src/ui/spatial/cue-projector.ts`
- `src/ui/spatial/cue-reducer.ts`
- `tests/ui/spatial-cue-mapping.test.ts`
- `tests/ui/spatial-cue-precedence.test.ts`

Acceptance criteria:

- exact `agent-office.spatial-cue.v1` envelope and deterministic `cueId`;
- only `LIVE_DELTA` plus new accepted source IDs can enqueue;
- exact source/evidence/assignment/Advisor gate, suppression, precedence, tie
  break, three-cue/one-route/one-actor caps, and overflow-to-log behavior;
- exact accepted structured Leo/GPT-to-Advisor handoff, Advisor dispatch,
  Worker/test, review handoff/verdict return, patch/result, `WAITING_LEO`, and
  completion-acknowledgement presentation mappings;
- initial/reload/reset/tab resume/Team selection/orientation never replay;
- stale/offline/unknown/conflict/error/critical cues are discarded, not delayed;
- terminal/model/process-shaped properties cannot affect output; and
- reducer completion/cancellation appends no event and calls no adapter.

### `AO12-IWU-10` Spatial routes, poses, and lounge

State: `NOT_STARTED_NOT_AUTHORIZED_PENDING_PRECEDING_BATCH_REVIEW_AND_ADVISOR_ACCEPTANCE`

Candidate scope:

- `src/ui/spatial/spatial-routes.tsx`
- `src/ui/spatial/actor-zone.tsx`
- `src/ui/spatial/lounge.tsx`
- bounded transform/opacity rules in the spatial stylesheet;
- `tests/ui/spatial-routes.component.test.tsx`

Acceptance criteria:

- exact delivery, reading, working, testing, writing, review handoff/verdict,
  blocker, decision, result, patch, completion acknowledgement, recovery, and
  verified-idle mappings;
- semantic zone endpoints; unresolved/hidden endpoints use static timeline only;
- one actor/document route, <=1200ms, transform/opacity only, no auto-scroll or
  focus movement;
- verified-idle actors may use bounded coffee/read/rest/game/window/whiteboard/
  Channy/visual-talk presentations, but never imply availability, assignment,
  shared context, collaboration, communication, or approval; operational events
  interrupt immediately;
- one global Channy may roam verified paths, visit/sit/eat/drink/sleep/rest/play/
  observe, briefly follow an accepted route, and reflect structured
  `WAITING_LEO`, `BLOCKED`, stale/offline, mission-complete, and valid routing;
  it remains neutral without evidence and never performs operational behavior;
  and
- reduced-motion/motion-off/static tier has immediate exact equivalent.

### `AO12-IWU-11` Motion, visual, accessibility, and performance proof

State: `NOT_STARTED_NOT_AUTHORIZED_PENDING_PRECEDING_BATCH_REVIEW_AND_ADVISOR_ACCEPTANCE`

Candidate scope:

- `tests/e2e/spatial-office-motion.spec.ts`
- `tests/e2e/spatial-office-accessibility.spec.ts`
- `tests/performance/spatial-office-budget.test.ts`
- new M1.2 baseline paths named by an exact implementation handoff only

Acceptance criteria:

- direct desktop/tablet/mobile/reduced-motion/static visual inspection;
- no overlap/layout shift, flash, shake, parallax, sound, perpetual task loop, or
  hidden critical content;
- same facts/focus/log in reduced/static mode;
- wide shared-floor visibility, non-selected Team recognizability, and
  tablet/mobile focused-navigation equivalence;
- exact Team ownership, current/future Advisor character uniqueness, mission
  board redaction/no-inference, SIASIU naming, and Channy boundary cases;
- configured-runtime deterministic baselines and exact locale prerequisites;
- benchmark fixture/hash/method/results for every target in the cue contract;
- honest `FULL`, `RESTRAINED`, or `STATIC` classification; and
- unmount/logout retains zero cue/listener/observer/animation state.

### AO12-C verification and rollback

Required checks include all AO12-A/B checks plus the full cue matrix, source-
boundary scans, reduced motion, axe, layout, benchmark, composed fixture, and M1
unchanged-baseline gates.

Rollback: remove/disable the cue layer while retaining the reviewed static M1.2
component; if the static component is also unsafe, return to the unchanged M1
adapter. No event or durable data is rolled back.

Gate: independent event-truth, accessibility, and performance review plus
Advisor acceptance before AO12-D.

## 7. Batch AO12-D - composed integration and closure

### `AO12-IWU-12` Additive authenticated application projection wiring

State: `NOT_STARTED_NOT_AUTHORIZED_PENDING_PRECEDING_BATCH_REVIEW_AND_ADVISOR_ACCEPTANCE`

Candidate scope, subject to a future exact allowlist:

- `src/runtime/projection.ts`
- `src/server/application.ts`
- `src/ui/runtime/runtime-app.tsx`
- `src/ui/spatial/` integration adapters
- `tests/integration/runtime-composition.test.ts`
- `tests/e2e-composed/application-spatial-office.spec.ts`

Acceptance criteria:

- additive versioned `spatialOffice` read model while existing `sceneRoles`
  remains available for M1 compatibility;
- projection consumes only verified manifest/events/evidence/observations and
  trusted project/actor registrations;
- no synthetic fixture in production, no unverified motion, no raw path/body/
  terminal/capability data;
- default auth-blocked/read-only and LocalBootstrap boundaries remain exact;
- Inbox/Alerts/Evidence and manual/exact-delivery status semantics unchanged;
- no browser destination/enable/Worker/Reviewer/command route; and
- logout/revocation/expiry clears spatial protected state and cues.

### `AO12-IWU-13` Compatibility selection, degradation, and rollback proof

State: `NOT_STARTED_NOT_AUTHORIZED_PENDING_PRECEDING_BATCH_REVIEW_AND_ADVISOR_ACCEPTANCE`

Candidate scope:

- `src/ui/spatial/compatibility.ts`
- presentation-only runtime selection named by future reviewed design;
- `tests/recovery/spatial-presentation-rollback.test.ts`
- `tests/e2e-composed/application-office-scene.spec.ts` compatibility coverage

Acceptance criteria:

- unknown/invalid spatial version falls back to verified static/M1 view;
- M1/M1.2 selection changes no ledger, manifest, artifact, authority, config
  trust, gateway, session, or completion state;
- stale/conflict/performance failure selects static behavior without hiding
  diagnostic truth;
- current M1 composed tests and six baselines remain unchanged;
- rollback requires no data migration or process-side effect; and
- recovery/read-only/quarantine behavior remains fail closed.

### `AO12-IWU-14` As-built evidence and implementation result

State: `NOT_STARTED_NOT_AUTHORIZED_PENDING_PRECEDING_BATCH_REVIEW_AND_ADVISOR_ACCEPTANCE`

Candidate scope:

- update the four M1.2 canonical documents and Feature Index from actual reviewed
  implementation evidence only;
- exact Worker result/pointer paths supplied by the later handoff; and
- no unrelated M1 canonical rewrite.

Acceptance criteria:

- exact commit, paths, tests, baseline hashes, benchmark results, limitations,
  divergences, rollback, and forbidden-boundary evidence;
- every `CURRENT_EVIDENCE` statement tied to actual artifacts;
- resolved Channy and project-authored-placeholder boundaries are recorded
  exactly, with production/external asset acquisition still prohibited;
- target and result commits pushed non-force with upstream equality; and
- factual result only, no self-review or final approval claim.

### AO12-D final gates

1. full lint/typecheck/unit/contract/integration/recovery/security/UI/E2E/build/
   dependency/diff/boundary/visual/performance suite;
2. direct configured-runtime desktop/tablet/mobile/320px/200%/reduced/static/
   offline/stale/conflict/critical inspection;
3. independent Fable5 Level-3 implementation/security/accessibility review over
   the exact commit;
4. Advisor evidence audit and any separately authorized private verification;
5. Leo/GPT risk/final product decision; and
6. no automatic activation or next mission.

## 8. Cross-cutting acceptance invariants

Every future batch must prove:

- canonical mission/event/evidence/authority precedence unchanged;
- Advisor-only communication, exact delivery, authentication, transport,
  network, DB, secret, and role-routing surfaces unchanged unless a separate
  mission explicitly authorizes them;
- every active actor belongs to exactly one responsible Advisor Team;
  missing/multiple assignments are `UNASSIGNED`, cannot receive work, and
  suppress task motion;
- current single-Advisor presentation uses one character for the exact active
  instance; future multi-Advisor presentation uses one distinct character per
  exact `Advisor roleInstanceId`, never cloning an active instance;
- exact Foundation and conditional VibeNews Team assignment, Agent Office's
  non-privileged Foundation membership, and authority-evidenced reassignment;
- independent Reviewer identity and review route separation;
- one canonical actor identity, exact assignment, and conflict fail-closed;
- Team-first spatial grouping, exact approved project palette, SIASIU current
  naming, and project color never carrying status/identity alone; severity wins;
- exact mission-board fields use redacted registered display identity and never
  raw session/pane/path/credential/private transport or inference;
- current/stale/offline/conflict/critical semantics are textual and motion-safe;
- reduced-motion/static equivalence and keyboard/screen-reader support;
- no purchased/imported/externally generated/commissioned/licensed asset;
- Channy remains a non-operational ambient companion and structured-status
  reflector, never authority, evidence, dispatch, command, approval, repair,
  terminal/session inspection, or substitute alert/board; and
- no historical M1 event reinterpretation or existing baseline update to hide a
  regression.

## 9. Frozen unknown traceability AO12-U01 through AO12-U14

Future paths below are proposals, not current files or authorization.

| Unknown | Canonical design resolution | Proposed WorkUnit/files | Proposed proof | Blocking gate |
|---|---|---|---|---|
| `AO12-U01` Dynamic Team Pod Model | Master Sections 5-7 | `AO12-IWU-01/03`; `types.ts`, `projector.ts` | shared-floor visibility, non-card Team areas, selected-detail and responsive equivalence | AO12-A handoff and review |
| `AO12-U02` Single Advisor Team Principle | Master Section 8; Identity Sections 5.3-5.5 | `AO12-IWU-04`; `assignment-resolver.ts` | exact Team membership, `UNASSIGNED`, current/future Advisor uniqueness, no-proximity authority | No authority change; AO12-A review |
| `AO12-U03` Project Color System | Identity Sections 2-4 | `AO12-IWU-04/05`; current-name correction plus `project-identity.ts/css` | zero current forbidden tokens, approved palette, fallback collisions, contrast, severity precedence | AO12-A naming PASS, then AO12-B contrast PASS |
| `AO12-U04` Actor Character Identity | Identity Sections 5-6 and 8 | `AO12-IWU-06`; placeholder character/registry/inventory | role/project/state separation, hash/license/dimension/fallback | Placeholder-only AO12-B; production gate remains closed |
| `AO12-U05` Channy Definition | Master Section 9.3; Identity Section 7; Cue Section 4.1 | `AO12-IWU-06/09/10`; Channy placeholder/facilities and presentation layer | exact allowed ambient/reflection cases and exhaustive operational prohibitions | Clean delta PASS, AO12-B/C handoffs and reviews |
| `AO12-U06` Lounge Semantics | Master Section 9.2; Cue Sections 4 and 9; Identity 6.3 | `AO12-IWU-10`; `lounge.tsx` | verified IDLE ambient menu, operational interruption, no implied communication/collaboration | AO12-C handoff/review |
| `AO12-U07` Truthful Animation/Ambient | Entire cue contract | `AO12-IWU-09/10/11`; cue reducer/routes/tests | exact source matrix, dedup, suppression, budgets, benchmarks | AO12-C event-truth review |
| `AO12-U08` Mission Board/Actor Visibility | Master Sections 5 and 9.1 | `AO12-IWU-01/07`; projection validator, `mission-board.tsx`, `team-pod.tsx` | complete field set, redaction, unknown/stale/conflict, and non-inference cases | AO12-A/B handoff/review |
| `AO12-U09` Rendering Architecture | Master Section 11 | `AO12-IWU-07/10`; DOM/SVG/CSS only | dependency/lockfile boundary, semantics, visual/layout tests | No engine selected; new dependency needs new decision |
| `AO12-U10` Responsive Navigation | Master Section 10; Cue Section 11 | `AO12-IWU-08/11`; static and E2E accessibility suites | desktop/tablet/mobile/320/200%/orientation/focus/axe | AO12-B/C browser reviews |
| `AO12-U11` Reduced Motion/Performance | Master Section 11; Cue Sections 9-12 | `AO12-IWU-11`; performance and motion E2E | static equivalence and every measured budget | Benchmark PASS or lower tier/design return |
| `AO12-U12` Multi-Project/Host Conflicts | Master Sections 7.3 and 8; Identity Sections 5.3-5.5 | `AO12-IWU-03/04/12`; projector/resolver/runtime integration | cross-project/host/source and simultaneous assignment fail-closed | No trust expansion; AO12-A/D review |
| `AO12-U13` Asset Source/License/Style | Master Section 13; Identity Sections 8-9 | `AO12-IWU-06` project-authored placeholders only | approved direction, inventory/hash/safety, protected-style and external-acquisition negatives | Clean delta PASS and AO12-B review; production replacement needs a new decision |
| `AO12-U14` Compatibility/Migration | Master Section 12; Cue Section 13 | `AO12-IWU-02/13`; M1 adapter/compatibility | existing suites and six baseline bytes unchanged; rollback proof | AO12-A then AO12-D review |

## 10. Requirement-to-future-file/test matrix

| Design requirement | Proposed implementation paths | Proposed test paths | Acceptance gate |
|---|---|---|---|
| `AO12-REQ-001` Versioned spatial projection | `src/application/spatial-office/types.ts`, `validation.ts` | `tests/contract/spatial-office-projection.test.ts` | AO12-A review |
| `AO12-REQ-002` Shared floor and selected Team detail | `projector.ts`, `team-pod.tsx` | `spatial-office-projector.test.ts`, static E2E | AO12-A/B reviews |
| `AO12-REQ-003` Single Advisor Team invariant | `assignment-resolver.ts` | `spatial-assignment.test.ts` | Exact Team/current-future Advisor cases; AO12-A review |
| `AO12-REQ-004` Approved project identity and naming | AO12-A current-name correction plus `project-identity.ts/css` | repository current-name gate plus `project-identity.test.ts` | Zero forbidden current tokens and palette/contrast/collision PASS |
| `AO12-REQ-005` Character/Channy/asset boundary | character/Channy placeholder registry/inventory | `spatial-asset-contract.test.ts` | Approved placeholder direction; external/production gate closed |
| `AO12-REQ-006` Exact mission board/zones | projection validator, `mission-board.tsx`, `spatial-office.tsx` | contract/component/static E2E | Field/redaction/non-inference PASS; AO12-A/B review |
| `AO12-REQ-007` Exact assignment/conflict | `assignment-resolver.ts`, `projector.ts` | assignment/projector tests | AO12-A review |
| `AO12-REQ-008` Evidence-backed cue contract | `cue-projector.ts`, `cue-reducer.ts` | cue mapping/precedence tests | AO12-C review |
| `AO12-REQ-009` Structured routes/review/decision/ambient/Channy | `spatial-routes.tsx`, `actor-zone.tsx`, `lounge.tsx`, Channy presentation | route component and motion E2E | AO12-C review |
| `AO12-REQ-010` Responsive/a11y/reduced equivalence | spatial components/styles | accessibility/static/motion E2E | WCAG/layout/reduced PASS |
| `AO12-REQ-011` Performance tiers | cue runtime/components | performance budget suite | Measured classification |
| `AO12-REQ-012` M1 adapter/additive rollback | `m1-fixed-station-adapter.ts`, `compatibility.ts` | adapter/rollback plus all M1 suites | Existing baseline hashes equal |
| `AO12-REQ-013` Composed authenticated read model | runtime/server/UI integration paths | runtime composition/composed E2E | AO12-D security review |
| `AO12-REQ-014` No authority/transport expansion | module/route/config boundary | acceptance/security/source scans | Zero forbidden surface change |

## 11. Resolved product decisions and conditional routing

`AO12-FD-01` is resolved exactly as
`CHANNY_ENABLED__NON_OPERATIONAL_AMBIENT_COMPANION_AND_STRUCTURED_STATUS_REFLECTOR`.
`AO12-FD-02` is resolved exactly as
`APPROVE_PROJECT_AUTHORED_CODE_NATIVE_PLACEHOLDERS_FOR_M1_2_IMPLEMENTATION`.
Those decisions define product intent but do not start implementation:

- only after clean Fable5 delta `PASS`, Advisor freeze, and an exact batch
  handoff may a batch implement its scoped Channy/placeholder work;
- Channy may consume only the accepted structured presentation projection and
  may perform only the allowed ambient/status-reflector behavior;
- project-authored code-native placeholders must follow the approved original
  direction and inventory/hash/safety contract; and
- purchase, import, external generation, commission, vendor/paid-license action,
  and production replacement remain prohibited without a new exact decision and
  mission.

Neither decision permits invented authority, transport, state inference,
terminal/session inspection, operational Channy behavior, protected-style
copying, or an unreviewed asset source.

## 12. Evidence required from every future Worker result

- exact mission ID, actor/session/model, branch/base/upstream/worktree;
- exact handoff and allowlist;
- changed/staged/committed paths and diff summary;
- focused and full checks, failures/skips, visual and benchmark methods/results;
- M1 baseline hash equality and additive compatibility status;
- runtime/source/test/config/dependency/lockfile counts;
- no DB, secret, environment value, external asset/fetch, public/private network,
  production/live, real tmux input, authority/transport, protected/main, force
  push, self-review, or automatic next mission;
- known limitations/divergences/STOP conditions;
- target commit/upstream equality and durable result/pointer commits; and
- `RETURN_TO: Advisor`, `PROPOSED_NEXT_ACTOR: Advisor`, `STOP`.

## 13. Stop and rollback conditions

Stop the active future batch and return to Advisor if:

- an exact assignment or responsible Advisor cannot be resolved;
- a source would require terminal prose/process inference;
- a project identity obscures status/severity/focus or fails contrast;
- an asset lacks provenance/license/hash/safe format;
- Channy would exceed its exact ambient/status-reflector boundary, or any asset
  would exceed the project-authored placeholder decision;
- M1 behavior/test/baseline bytes change outside an explicitly reviewed
  compatibility correction;
- reduced/static mode loses information or focus behavior;
- benchmark targets miss without an accepted lower tier;
- production integration would widen auth, network, gateway, route, authority,
  DB, secret, or deployment scope;
- unrelated worktree changes overlap; or
- review/push/result evidence cannot be verified.

Rollback selects the last reviewed presentation boundary: cue layer -> static
M1.2 -> unchanged M1 adapter. It never rewrites the event ledger, manifest,
evidence, artifact, authority, transport journal, credential, or canonical
mission state.
