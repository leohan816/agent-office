# Agent Office M1.2 Future Implementation WorkUnit Plan

Status: `DESIGN_ONLY__ALL_IMPLEMENTATION_WORKUNITS_NOT_STARTED_NOT_AUTHORIZED__PENDING_FABLE5_DESIGN_REVIEW_AND_LEO_GPT_DECISION`

Design mission: `AGENT_OFFICE_M1_2_SPATIAL_ANIMATED_ADVISOR_TEAM_OFFICE`

This plan describes a reversible future implementation train. It is not an
implementation launcher, handoff, permission, review verdict, branch decision,
asset approval, or authority change. Every future batch requires a new exact
Advisor handoff after the preceding dependency and review gate are accepted.

## 1. Two distinct WorkUnit namespaces

### 1.1 Current five-unit design mission

The current governance manifest is
`advisor.design-mission-manifest.v1`, denominator 5:

| Design WorkUnit | Actor | Purpose | State at design handoff |
|---|---|---|---|
| `AO12-DWU-01` | Advisor | Repository inventory, entry gate, frozen unknown register | `COMPLETED` |
| `AO12-DWU-02` | Agent Office Worker | Canonical spatial-office design package | `WORKING` |
| `AO12-DWU-03` | Advisor | Design result/evidence validation | `WAITING_DEPENDENCY` |
| `AO12-DWU-04` | Fable5 Reviewer | Independent Level-3 design review | `WAITING_DEPENDENCY` |
| `AO12-DWU-05` | Advisor | Final design audit and Leo/GPT decision package | `WAITING_DEPENDENCY` |

Publishing this design candidate can provide evidence for `AO12-DWU-02`. It
does not complete the design mission and cannot start an implementation WorkUnit.

### 1.2 Proposed future implementation namespace

`AO12-IWU-*` below is a proposal only. Every row has the immutable state:

```text
NOT_STARTED_NOT_AUTHORIZED
```

These IDs are not part of a current canonical implementation manifest. They do
not change the design-mission denominator and must not be projected as approved
scope until Leo/GPT approves an implementation mission and exact versioned
manifest.

## 2. Serial gate before implementation

No `AO12-IWU-*` may start unless all are true:

1. `AO12-DWU-02` result and exact five-file diff are published;
2. Advisor validates the result/branch/upstream evidence;
3. Fable5 performs independent Level-3 review of the exact design commit;
4. review routing is `PASS`, or `PASS_WITH_RISK` plus an explicit Leo/GPT risk
   acceptance artifact;
5. Leo/GPT decides whether to authorize an implementation mission and its exact
   scope/denominator;
6. Advisor publishes an exact batch handoff with branch, base, allowlist, tests,
   exclusions, result, and pointer paths; and
7. any product/asset decision needed by that batch is explicitly resolved.

`NEEDS_PATCH` returns to this design Worker/reviewer loop. `FAIL` stops.
Silence, a design commit, or a passing local check is not authorization.

## 3. Reversible batch overview

| Batch | Future WorkUnits | Reversible boundary | Required gate after batch |
|---|---|---|---|
| `AO12-A` Contract and M1 compatibility | `AO12-IWU-01` through `AO12-IWU-04` | No production UI selection; existing `sceneRoles` and M1 component remain authoritative presentation | Focused contract/compatibility review plus Advisor acceptance |
| `AO12-B` Static pods and identity | `AO12-IWU-05` through `AO12-IWU-08` | New static component remains fixture/test-only; no task motion or production projection wiring | Fable5 UI/accessibility/asset-boundary review plus Advisor acceptance |
| `AO12-C` Evidence-backed spatial motion | `AO12-IWU-09` through `AO12-IWU-11` | Cue runtime remains isolated behind typed spatial projection; static tier and M1 adapter remain immediate fallback | Fable5 event-truth/accessibility/performance review plus Advisor acceptance |
| `AO12-D` Composed integration and as-built closure | `AO12-IWU-12` through `AO12-IWU-14` | Additive projection field and version selector can fall back to unchanged M1 without ledger/schema rewrite | Full implementation/security review, Advisor private verification, then Leo/GPT decision |

No batch may be combined to bypass its dependency or review. No batch may add
an auth, network, Advisor delivery, role dispatch, DB, secret, or asset-purchase
change.

## 4. Batch AO12-A - contract and M1 compatibility

### `AO12-IWU-01` Spatial projection types and validators

State: `NOT_STARTED_NOT_AUTHORIZED`

Candidate scope:

- `src/application/spatial-office/types.ts`
- `src/application/spatial-office/validation.ts`
- `tests/contract/spatial-office-projection.test.ts`

Acceptance criteria:

- exact `agent-office.spatial-office-projection.v1` validation;
- stable project/pod/mission/actor/assignment references and catalog version;
- unknown fields/versions, duplicate IDs, inconsistent project/mission refs, and
  unsafe path/target-shaped data reject;
- no event, command, adapter, authority, transport, credential, or persistence
  dependency; and
- deterministic canonical serialization fixtures.

### `AO12-IWU-02` M1 fixed-station compatibility adapter

State: `NOT_STARTED_NOT_AUTHORIZED`

Candidate scope:

- `src/application/spatial-office/m1-fixed-station-adapter.ts`
- `tests/ui/m1-spatial-adapter.test.ts`
- existing M1 scene tests and six baselines as read-only compatibility evidence

Acceptance criteria:

- exact eight station IDs/order/coordinates and role normalization preserved;
- exact M1 state/activity mapping, precedence, route phases, duration caps,
  accepted IDs, deduplication, and two-station mobile pagination preserved;
- legacy view labelled `M1_FIXED_STATIONS` without invented project history;
- unknown spatial versions fall back static/M1; and
- existing M1 test results and baseline bytes remain unchanged.

### `AO12-IWU-03` Dynamic Team Pod projector

State: `NOT_STARTED_NOT_AUTHORIZED`

Candidate scope:

- `src/application/spatial-office/projector.ts`
- `src/application/spatial-office/fixtures.ts`
- `tests/ui/spatial-office-projector.test.ts`

Acceptance criteria:

- one stable pod per trusted project registration;
- one explicitly selected expanded pod and compact truthful summaries for all
  others;
- verified manifest required for active mission board;
- deterministic selection fallback by stable `projectId`, never activity;
- compact summaries contain exact progress/freshness/alert facts and no task
  cue; and
- replay from equal inputs is byte-equivalent excluding explicit evaluation
  metadata.

### `AO12-IWU-04` Assignment and Single Advisor invariant resolver

State: `NOT_STARTED_NOT_AUTHORIZED`

Candidate scope:

- `src/application/spatial-office/assignment-resolver.ts`
- `tests/ui/spatial-assignment.test.ts`

Acceptance criteria:

- `(projectId, missionId, workUnitId)` resolves to exactly one compatible
  `roleInstanceId`;
- one canonical actor may have several static assignment refs but at most one
  full character;
- missing, duplicate, cross-project/host/source, or simultaneous active
  conflicts fail closed and suppress motion;
- exactly one responsible Advisor reference per pod with one global Advisor
  identity and no pod-local clone; and
- Reviewer remains independent from Worker execution assignments.

### AO12-A verification and rollback

Required checks:

- focused contract/projector/assignment/adapter tests;
- all existing domain, activity, scene, project-freshness, runtime projection,
  UI, and visual tests;
- lint, strict typecheck, both builds, dependency audit, and `git diff --check`;
- source-boundary scan for process/network/write/dispatch imports; and
- exact changed-path/staged-path audit.

Rollback: delete the additive `src/application/spatial-office/` consumer and
tests; no production surface, ledger, manifest, projection store, config,
baseline, or authority state has changed.

Gate: independent focused design/contract implementation review and Advisor
acceptance before AO12-B.

## 5. Batch AO12-B - static pods and identity

### `AO12-IWU-05` Deterministic project identity catalog

State: `NOT_STARTED_NOT_AUTHORIZED`

Candidate scope:

- `src/ui/spatial/project-identity.ts`
- `src/ui/spatial/project-identity.css`
- `tests/ui/project-identity.test.ts`

Acceptance criteria:

- exact SHA-256 catalog-v1 derivation, independent of registry order;
- visible text/pattern/glyph/edge identity and collision marker;
- no local mutable assignment store;
- severity/freshness/focus tokens override project hue;
- light/dark/monochrome/forced-color and exact collision fixtures pass; and
- all tested text/graphical/focus contrast thresholds pass.

### `AO12-IWU-06` Project-authored character placeholders and inventory

State: `NOT_STARTED_NOT_AUTHORIZED`

Candidate scope:

- `src/ui/spatial/character.tsx`
- `src/ui/spatial/assets/placeholder-characters.tsx`
- `src/ui/spatial/assets/ASSET_INVENTORY.md`
- `src/ui/spatial/asset-registry.ts`
- `tests/ui/spatial-asset-contract.test.ts`

Acceptance criteria:

- only Agent Office project-authored code-native placeholders;
- stable slot geometry, ownership, internal license, and source SHA-256;
- role category plus text/icon/shape, project assignment separately layered;
- no real person/model/provider claim, script, remote ref, runtime fetch,
  executable SVG, sound, or new rendering dependency;
- missing/invalid asset falls back without layout shift; and
- `CHANNY_DISABLED` is the only Channy state and renders no actor/control.

This WorkUnit does not authorize production art, purchase, import, generation,
vendor selection, or Channy behavior. `AO12-FD-01` and `AO12-FD-02` remain open.

### `AO12-IWU-07` Static Team Pod, mission board, and semantic zones

State: `NOT_STARTED_NOT_AUTHORIZED`

Candidate scope:

- `src/ui/spatial/spatial-office.tsx`
- `src/ui/spatial/team-pod.tsx`
- `src/ui/spatial/mission-board.tsx`
- `src/ui/spatial/spatial-office.css`
- `tests/ui/spatial-office.component.test.tsx`

Acceptance criteria:

- global status, pod selector, one expanded pod, compact summaries, mission
  board, zones, actor detail, evidence/alert links in canonical DOM order;
- exact manifest version, counts, phase, WorkUnit, dependencies, assignment,
  evidence, gates, freshness, and alert facts;
- work/testing/result/review/Advisor/Leo/evidence/lounge zones are labelled but
  static;
- no movement, dispatch control, role target, fake live state, or direct adapter
  import; and
- one global Advisor and spatially separate independent review desk.

### `AO12-IWU-08` Responsive and accessible static architecture

State: `NOT_STARTED_NOT_AUTHORIZED`

Candidate scope:

- static component/style refinements within the AO12-B allowlist;
- reviewed new locale entries in `src/ui/i18n/ko.ts` only if an exact handoff
  supplies approved vocabulary;
- `tests/ui/spatial-accessibility.test.tsx`
- `tests/e2e/spatial-office-static.spec.ts`

Acceptance criteria:

- desktop/tablet/mobile/320px/200% text/short-landscape no-overlap and no page
  overflow;
- mobile semantic list/detail and maximum two full actor tiles, no miniature
  floor;
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

State: `NOT_STARTED_NOT_AUTHORIZED`

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
- initial/reload/reset/tab resume/pod selection/orientation never replay;
- stale/offline/unknown/conflict/error/critical cues are discarded, not delayed;
- terminal/model/process-shaped properties cannot affect output; and
- reducer completion/cancellation appends no event and calls no adapter.

### `AO12-IWU-10` Spatial routes, poses, and lounge

State: `NOT_STARTED_NOT_AUTHORIZED`

Candidate scope:

- `src/ui/spatial/spatial-routes.tsx`
- `src/ui/spatial/actor-zone.tsx`
- `src/ui/spatial/lounge.tsx`
- bounded transform/opacity rules in the spatial stylesheet;
- `tests/ui/spatial-routes.component.test.tsx`

Acceptance criteria:

- exact delivery, reading, working, testing, writing, review, blocker, decision,
  result, patch, recovery, and idle-relocation mappings;
- semantic zone endpoints; unresolved/hidden endpoints use static timeline only;
- one actor/document route, <=1200ms, transform/opacity only, no auto-scroll or
  focus movement;
- lounge only for verified IDLE, no conversation/availability/collaboration
  semantics, maximum one bounded ambient actor; and
- reduced-motion/motion-off/static tier has immediate exact equivalent.

### `AO12-IWU-11` Motion, visual, accessibility, and performance proof

State: `NOT_STARTED_NOT_AUTHORIZED`

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

State: `NOT_STARTED_NOT_AUTHORIZED`

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

State: `NOT_STARTED_NOT_AUTHORIZED`

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

State: `NOT_STARTED_NOT_AUTHORIZED`

Candidate scope:

- update the four M1.2 canonical documents and Feature Index from actual reviewed
  implementation evidence only;
- exact Worker result/pointer paths supplied by the later handoff; and
- no unrelated M1 canonical rewrite.

Acceptance criteria:

- exact commit, paths, tests, baseline hashes, benchmark results, limitations,
  divergences, rollback, and forbidden-boundary evidence;
- every `CURRENT_EVIDENCE` statement tied to actual artifacts;
- unresolved Channy/production-art choices remain gated unless Leo/GPT decided;
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
- one canonical Advisor character and exactly one responsibility reference per
  visible pod;
- independent Reviewer identity and review route separation;
- one canonical actor identity, exact assignment, and conflict fail-closed;
- project color never carries status or identity alone and severity wins;
- current/stale/offline/conflict/critical semantics are textual and motion-safe;
- reduced-motion/static equivalence and keyboard/screen-reader support;
- no purchased/imported/generated asset without the separate asset gate;
- no Channy behavior without `AO12-FD-01`; and
- no historical M1 event reinterpretation or existing baseline update to hide a
  regression.

## 9. Frozen unknown traceability AO12-U01 through AO12-U14

Future paths below are proposals, not current files or authorization.

| Unknown | Canonical design resolution | Proposed WorkUnit/files | Proposed proof | Blocking gate |
|---|---|---|---|---|
| `AO12-U01` Dynamic Team Pod Model | Master Sections 5-7 | `AO12-IWU-01/03`; `types.ts`, `projector.ts` | `spatial-office-projection.test.ts`, `spatial-office-projector.test.ts` | AO12-A handoff and review |
| `AO12-U02` Single Advisor Team Principle | Master Section 8; Identity Section 5.4 | `AO12-IWU-04`; `assignment-resolver.ts` | missing/multiple/shared Advisor and no-clone cases | No authority change; AO12-A review |
| `AO12-U03` Project Color System | Identity Sections 2-4 | `AO12-IWU-05`; `project-identity.ts/css` | deterministic order, collisions, contrast, severity precedence | AO12-B handoff; contrast PASS |
| `AO12-U04` Actor Character Identity | Identity Sections 5-6 and 8 | `AO12-IWU-06`; placeholder character/registry/inventory | role/project/state separation, hash/license/dimension/fallback | Placeholder-only AO12-B; production gate remains closed |
| `AO12-U05` Channy Definition | Master Section 9.3; Identity Section 7 | No enabled implementation; `CHANNY_DISABLED` validation only in `AO12-IWU-06` | absence of actor/control/event/route/notification | `AO12-FD-01` plus new reviewed version |
| `AO12-U06` Lounge Semantics | Master Section 9.2; Cue Sections 4 and 9; Identity 6.3 | `AO12-IWU-10`; `lounge.tsx` | verified IDLE, stale/conflict suppression, no collaboration semantics | AO12-C handoff/review |
| `AO12-U07` Truthful Animation/Ambient | Entire cue contract | `AO12-IWU-09/10/11`; cue reducer/routes/tests | exact source matrix, dedup, suppression, budgets, benchmarks | AO12-C event-truth review |
| `AO12-U08` Mission Board/Actor Visibility | Master Sections 5 and 9.1 | `AO12-IWU-07`; `mission-board.tsx`, `team-pod.tsx` | hierarchy/version/count/assignment/evidence/alert component cases | AO12-B handoff/review |
| `AO12-U09` Rendering Architecture | Master Section 11 | `AO12-IWU-07/10`; DOM/SVG/CSS only | dependency/lockfile boundary, semantics, visual/layout tests | No engine selected; new dependency needs new decision |
| `AO12-U10` Responsive Navigation | Master Section 10; Cue Section 11 | `AO12-IWU-08/11`; static and E2E accessibility suites | desktop/tablet/mobile/320/200%/orientation/focus/axe | AO12-B/C browser reviews |
| `AO12-U11` Reduced Motion/Performance | Master Section 11; Cue Sections 9-12 | `AO12-IWU-11`; performance and motion E2E | static equivalence and every measured budget | Benchmark PASS or lower tier/design return |
| `AO12-U12` Multi-Project/Host Conflicts | Master Sections 7.3 and 8; Identity 5.3 | `AO12-IWU-03/04/12`; projector/resolver/runtime integration | cross-project/host/source and simultaneous assignment fail-closed | No trust expansion; AO12-A/D review |
| `AO12-U13` Asset Source/License/Style | Master Section 13; Identity Sections 8-9 | `AO12-IWU-06` placeholders only | inventory/license/hash/safety/replacement tests | `AO12-FD-02` before production asset action |
| `AO12-U14` Compatibility/Migration | Master Section 12; Cue Section 13 | `AO12-IWU-02/13`; M1 adapter/compatibility | existing suites and six baseline bytes unchanged; rollback proof | AO12-A then AO12-D review |

## 10. Requirement-to-future-file/test matrix

| Design requirement | Proposed implementation paths | Proposed test paths | Acceptance gate |
|---|---|---|---|
| `AO12-REQ-001` Versioned spatial projection | `src/application/spatial-office/types.ts`, `validation.ts` | `tests/contract/spatial-office-projection.test.ts` | AO12-A review |
| `AO12-REQ-002` Dynamic selected/compact pods | `projector.ts`, `team-pod.tsx` | `spatial-office-projector.test.ts`, static E2E | AO12-A/B reviews |
| `AO12-REQ-003` Single Advisor invariant | `assignment-resolver.ts` | `spatial-assignment.test.ts` | No authority conflict; AO12-A review |
| `AO12-REQ-004` Project identity and collision | `project-identity.ts/css` | `project-identity.test.ts` | Contrast/collision PASS |
| `AO12-REQ-005` Character/asset boundary | character/placeholder registry/inventory | `spatial-asset-contract.test.ts` | Placeholder review; production gate closed |
| `AO12-REQ-006` Mission board/zones | `mission-board.tsx`, `spatial-office.tsx` | component/static E2E | AO12-B review |
| `AO12-REQ-007` Exact assignment/conflict | `assignment-resolver.ts`, `projector.ts` | assignment/projector tests | AO12-A review |
| `AO12-REQ-008` Evidence-backed cue contract | `cue-projector.ts`, `cue-reducer.ts` | cue mapping/precedence tests | AO12-C review |
| `AO12-REQ-009` Routes/review/decision/lounge | `spatial-routes.tsx`, `actor-zone.tsx`, `lounge.tsx` | route component and motion E2E | AO12-C review |
| `AO12-REQ-010` Responsive/a11y/reduced equivalence | spatial components/styles | accessibility/static/motion E2E | WCAG/layout/reduced PASS |
| `AO12-REQ-011` Performance tiers | cue runtime/components | performance budget suite | Measured classification |
| `AO12-REQ-012` M1 adapter/additive rollback | `m1-fixed-station-adapter.ts`, `compatibility.ts` | adapter/rollback plus all M1 suites | Existing baseline hashes equal |
| `AO12-REQ-013` Composed authenticated read model | runtime/server/UI integration paths | runtime composition/composed E2E | AO12-D security review |
| `AO12-REQ-014` No authority/transport expansion | module/route/config boundary | acceptance/security/source scans | Zero forbidden surface change |

## 11. Asset and founder-decision routing

`AO12-FD-01` and `AO12-FD-02` are not silently converted into implementation
defaults:

- batches may validate `CHANNY_DISABLED`, but cannot render/subscribe/route an
  enabled Channy;
- batches may create project-authored placeholders only under an exact handoff;
- no purchase/import/generation/commission/vendor action occurs without a new
  exact asset mission after `AO12-FD-02`; and
- a production-asset mission must use the inventory/license/hash/replacement
  contract and independent security/visual/license review.

The rest of the technical implementation can be reviewed using placeholders and
Channy disabled; founder decisions do not justify inventing product behavior.

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
- Channy or production art would require an unresolved founder decision;
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
