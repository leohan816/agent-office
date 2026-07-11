# Agent Office M1.2 Character and Project Identity System

Status: `AO12_C_IDENTITY_OVERLAYS_AND_CHANNY_PRESENTATION_IMPLEMENTED_TEST_DEMO_ONLY__PENDING_FOCUSED_REVIEW__PRODUCTION_ASSETS_DEFERRED`

Identity catalog candidate: `agent-office.project-identity.v1`

Asset manifest candidate: `agent-office.character-assets.v1`

This document defines supplemental project and actor presentation identity for
M1.2. Identity never changes actor authority, assignment, mission state,
freshness, severity, evidence, or transport. AO12-B now implements original
code-native inline SVG/CSS/DOM placeholders and an internal license record only.
AO12-C reuses those exact bytes for bounded, structured-event presentation and
adds no external image, font, asset, purchase, import, generation, or
dependency.

## 1. Current evidence and limitations

The current M1 scene uses:

- one generic local project-authored `ActorAsset` for every station in
  `src/ui/scene/assets/scene-assets.tsx`;
- stable dimensions and source hash in `src/ui/scene/asset-registry.ts` and
  `src/ui/scene/assets/ASSET_INVENTORY.md`;
- fixed actor-role/station text in `src/ui/scene/types.ts`;
- Lucide icons plus text and state shapes in `src/ui/scene/office-scene.tsx`;
- operational semantic color tokens and severity overrides in
  `src/ui/styles.css`; and
- exact ownership/licensing records in `src/ui/assets/LICENSES.md`.

This paragraph is historical M1 evidence: at exact base M1 there was no project
identity palette, character customization, role-specific silhouette, Channy
definition, production art style, asset vendor, or asset-generation pipeline.
AO12-B adds only the fixture/test-scoped `src/ui/spatial/project-identity.ts`,
`character.tsx`, original placeholder source, registry, and inventory. It does
not change the existing M1 generic asset, production presentation, model/person
identity, or authority. The six existing M1 baselines still prove the generic
M1 assets only; six separate M1.2 static baselines prove the new placeholders
under the configured local browser/font runtime.

## 2. Identity-layer precedence

Every rendered actor/Team area separates six layers:

```text
1. Safety/operational severity and freshness
2. Canonical role and authority text/icon/shape
3. Exact actor role-instance identity
4. Responsible Advisor Team identity
5. Project assignment identity
6. Decorative character style
```

Higher layers win. Project hue or character decoration can never replace or
obscure critical/warning/stale/conflict/unknown/completed semantics. The system
must remain unambiguous with color removed, CSS images disabled, SVG hidden,
forced colors active, or the static/reduced-motion tier selected.

## 3. Deterministic project identity

### 3.1 Primary identity

Project identity is primarily visible text:

- trusted exact `projectId`;
- trusted `displayName`;
- a locally derived short label; and
- the source/freshness status shown separately.

Color, pattern, and glyph are supplemental navigation aids. A browser cannot
rename a project, assign a palette slot, or persist a competing identity.

### 3.2 Approved current palette and versioned fallback derivation

Spatial grouping is Advisor Team first. The current project palette is fixed:

| Current project/role | Approved supplemental palette |
|---|---|
| Cosmile | coral/pink |
| SIASIU | mint/emerald |
| Foundation | navy/blue |
| VibeNews | purple |
| Agent Office | orange/amber |
| Control | slate/charcoal with blue accent |

The palette is repeated through clothing, desk accents, project signs, visible
text, glyphs, and patterns. Color is never the sole identifier. Operational
severity, focus, accessibility, and alerts override every project color.

The official current project name is `SIASIU`. Historical/forbidden-name note
(not current product naming): the legacy tokens `Shashu`, `샤슈`, `SHASHU`, and
`shashu` are forbidden in current UI, fixtures, actor labels, locale resources,
tests, and baselines. A canonical naming test must reject every current-product
use; an explicitly labelled historical citation is the only documentation
exception.

Historical M1 compatibility evidence at design base `3ba65e0` contained a
legacy alias normalizer and negative fixture in `src/runtime/operational-config.ts`,
`src/ui/scene/types.ts`, and `tests/integration/exact-advisor-delivery.test.ts`.
Those citations are explicitly historical, not accepted current naming. The
separately authorized AO12-A SIASIU correction removed the forbidden current
tokens from those current source/test surfaces, rejects such configuration
instead of rewriting identity, and preserves actor authority/assignment
meaning. The repository current-product scanner retains no raw negative token
in its own source or fixtures.

For an otherwise unmapped future registered project under catalog
`agent-office.project-identity.v1`, use this deterministic fallback:

```text
normalizedId = Unicode NFC(projectId)
digest = SHA-256(UTF-8(normalizedId))
hueSlot = digest[0] mod HUE_SLOT_COUNT
patternSlot = digest[1] mod PATTERN_SLOT_COUNT
glyphSlot = digest[2] mod GLYPH_SLOT_COUNT
edgeSlot = digest[3] mod EDGE_SLOT_COUNT
collisionMarker = lowercase hex digest[0..3]
```

Counts and ordered catalogs are fixed within the version. Registry order,
selection time, alert state, display-name changes, host, mission, browser, and
locale cannot change the tuple. No mutable color-assignment store is required.
Every spatial projection carries `identityCatalogVersion` so cached and current
views cannot silently mix catalogs.

Candidate catalogs contain at least:

- 8 project hue tokens;
- 6 monochrome patterns: solid, diagonal, crosshatch, dots, horizontal, and
  stepped;
- 8 simple geometric project glyphs; and
- 4 edge styles: solid, double, dashed, and dot-dash.

Exact light/dark/high-contrast values for both fixed and fallback palettes are
implemented in `project-identity.ts/css` and pass the focused contrast gate. A hue
whose tested values are too close to an operational semantic token must be
adjusted within its approved family or replaced in the fallback catalog, not
accepted by relying on pattern alone.

### 3.3 Collision behavior and persistence

An exact hue/pattern/glyph/edge collision is allowed because it carries no
authority and full project text remains primary. Collision handling is stable:

1. do not reorder or reassign either project's tuple;
2. show full `displayName` and `projectId` in selector/detail;
3. add the deterministic eight-hex `collisionMarker` to condensed labels;
4. expose an accessible `PROJECT_IDENTITY_COLLISION` note; and
5. retain separate source/freshness and alert facts.

This prevents a newly registered project from changing every existing color.
Changing the catalog requires a new catalog version, reviewed screenshots,
explicit compatibility behavior, and an identity migration note. Historical
screenshots/projections retain their recorded version; no domain history is
rewritten.

### 3.4 Project short label

The short label is display-only:

- use the first two Unicode grapheme clusters from up to two display-name words
  when available;
- otherwise use the first two grapheme clusters of `projectId`;
- preserve the full name and ID in adjacent text/accessibility name; and
- add the collision marker when two visible projects share the short label.

The short label never becomes an ID, route target, assignment key, or evidence
reference.

## 4. Project identity placement

Project identity may appear only in bounded supplemental regions:

- Team-area/Pod header ribbon and project glyph;
- floor/zone hatch at low contrast;
- actor assignment badge/scarf/lanyard marker;
- Team navigation/minimap marker; and
- mission-board project chip.

It must not color:

- a primary state icon or state shape;
- critical/warning/stale/conflict/unknown banners or borders;
- evidence verification states;
- completion, review verdict, decision, or transport status;
- focus indicators; or
- Advisor/Leo/Fable5 authority markers.

When an operational overlay is present, it occupies the primary border/banner
and project identity collapses to its labelled chip/pattern. Completion green,
warning amber, critical red, stale/unknown violet/gray, and focus tokens remain
semantically reserved by M1.

## 5. Canonical actor identity

### 5.1 Identity fields

One future `ActorCharacterIdentity` read model contains:

```text
schemaVersion
roleInstanceId
actorRole
roleCategory
displayLabel
responsibleAdvisorTeamId
responsibleAdvisorRoleInstanceId
projectAssignmentRefs[]
currentAssignmentRef (optional)
assignmentStatus
evidenceFreshness
connectionState
identityCatalogVersion
characterAssetId
characterAssetStatus: PLACEHOLDER | PRODUCTION_APPROVED | MISSING | INVALID
```

`roleInstanceId` is the identity key. `actorRole`, role category, responsible
Advisor Team, and responsible Advisor must agree with canonical authority
evidence. Display label, station, project badge, asset, model name, session,
pane, process, or location cannot create a new actor identity, Team assignment,
or authority relationship. Missing or multiple responsible assignments produce
`UNASSIGNED`, suppress task motion, and make the actor unable to receive work.

### 5.2 Role categories and silhouettes

M1.2 defines semantic categories, not personalized likenesses:

| Role category | Candidate silhouette cue | Required visible semantics |
|---|---|---|
| `LEO_DECISION` | Decision document/door or seated neutral figure | `Leo/GPT`, final-decision destination; never an execution target |
| `ADVISOR_ROUTING` | Route tray, inbox, or directional sash | `Advisor`, exact role-instance identity and responsibility refs |
| `CONTROL_RECOVERY` | Tool/console silhouette | Exact Control role, recovery/operations state |
| `INDEPENDENT_REVIEW` | Lens/checklist silhouette spatially separated | `Fable5 Reviewer`, independent review label |
| `WORKER_BUILD` | Desk/tool silhouette | Exact Worker role and project assignment label |
| `GENERIC_REGISTERED` | Neutral local placeholder | Exact registered role text; no inferred person/model identity |

Silhouette is supplemental. Role text plus a locally bundled semantic icon and
distinct shape remain visible. Leo/GPT, Advisor, Reviewer, and Worker cannot be
distinguished by project hue alone.

### 5.3 Initial Advisor Team assignment and one actor identity

An Advisor creates and leads an Advisor Team, and every actor obeying that
Advisor is a member of exactly that Team. The exact initial product-intent
assignment, subject to matching canonical authority evidence, is:

- `FOUNDATION_ADVISOR_TEAM`: Foundation Advisor, Control, Foundation Worker,
  Cosmile Worker, SIASIU Worker, Agent Office Worker, and the assigned
  independent Reviewer when required.
- `VIBENEWS_ADVISOR_TEAM`: a distinct Team area only with a valid responsible
  Advisor, containing its assigned Worker, Designer, and Reviewer members.

Agent Office belongs to `FOUNDATION_ADVISOR_TEAM`; it is neither privileged nor
independent. Reviewer membership preserves independent-review separation and
verdict authority. A future Agent Office Team requires a newly appointed
Advisor, recorded Team-assignment authority, formal member reassignment, and an
effective command hierarchy. Reassignment cannot be inferred from project
identity or spatial proximity.

### 5.4 One actor, multiple assignment views

A role instance is rendered as at most one character across the entire floor.
If its exact current assignment is in the selected Team area, that one character
may use full operational choreography. If its exact current assignment is in a
non-selected Team area, it may remain static/ambient there while every other
Team uses only labelled text/glyph assignment references. The actor is never
cloned and never shows simultaneous operational motion.

If accepted evidence says one role instance has incompatible simultaneous active
assignments, render one character with `ASSIGNMENT_CONFLICT`, list every exact
assignment reference, use the operational conflict overlay, and suppress all
task/lounging motion. Do not choose the visually nearest pod or the greatest
timestamp.

### 5.5 Advisor and Reviewer distinction

- In the current single-Advisor-instance configuration, one global Advisor Hub
  character represents that exact `Advisor roleInstanceId`; Team areas reference
  it without cloning it.
- In a future reviewed multi-Advisor configuration, render one distinct Advisor
  Hub character for each exact `Advisor roleInstanceId`. Every Team references
  exactly one responsible instance, and one active instance is never cloned.
- A responsibility line/badge is a relationship projection, not authority.
- Fable5 is rendered only at the independent review desk or as a condensed static
  review assignment. It does not sit at a Worker desk or share a work animation.
- A patch-return cue may travel from Fable5 to the exact assigned Worker, but it
  is not a new dispatch and does not imply approval.

## 6. Character pose and state overlays

### 6.1 Operational and detail pose vocabulary

The exact M1.2 high-level operational presentation states are:

```text
IDLE
WORKING
TESTING
ROUTING / DISPATCH
REVIEWING
RETURNING_RESULT
NEEDS_PATCH
WAITING_DEPENDENCY
WAITING_LEO
BLOCKED
COMPLETED
FAILED
CANCELLED
```

Existing M1 detail poses remain additive presentation-only compatibility facts:

```text
NEUTRAL
READING
WORKING
TESTING
WRITING_RESULT
REVIEWING
BLOCKED
WAITING_DECISION
RETURNING_RESULT
RECOVERY
IDLE_LOUNGE
```

A task pose requires the exact eligible source defined by
[`../contracts/AGENT_OFFICE_M1_2_SPATIAL_EVENT_ANIMATION_CONTRACT.md`](../contracts/AGENT_OFFICE_M1_2_SPATIAL_EVENT_ANIMATION_CONTRACT.md).
Initial/reload/static views may show a current non-moving pose only when the
underlying projection is verified; they must not run an entry animation.

### 6.2 Operational overlay precedence

Overlay order is fixed:

```text
store quarantine/recovery
  > critical alert
  > connection/freshness conflict
  > blocker/WAITING_LEO/HOLD/NEEDS_PATCH
  > current state/activity
  > project identity
  > decorative character detail
```

Existing M1 state shapes remain compatible:

- circle: ordinary lifecycle/activity;
- diamond: decision/patch/hold attention;
- square: unknown/stale/recovery; and
- octagon: blocked/failed/critical safety.

Every overlay includes exact text and a semantic icon. Pattern/color never
replaces the shape.

### 6.3 Verified-idle character rules

`IDLE_LOUNGE` requires current verified actor identity and the lounge eligibility
rules in the master design. A verified-idle character:

- has no work document, keyboard typing, review lens, test checklist, message
  bubble, availability badge, or collaboration cue;
- may show bounded coffee, reading, resting, small-game, window, whiteboard,
  Channy-interaction, or visual-talk presentation under the cue contract;
- remains a single actor identity even if several pod assignments exist;
- leaves only on a new accepted structured source; and
- becomes static/unknown immediately on stale, offline, conflict, critical,
  hidden, or reduced-motion state.

Operational state always interrupts and overrides ambient behavior. Two
characters in an ambient zone or a visual-talk pose do not imply availability,
assignment, shared context, collaboration, communication, approval, or evidence.

## 7. Channy ambient companion identity

The exact product decision is
`CHANNY_ENABLED__NON_OPERATIONAL_AMBIENT_COMPANION_AND_STRUCTURED_STATUS_REFLECTOR`.
Channy is presented as a cute Bedlington Terrier with one global, non-actor
identity:

```text
channyMode: NON_OPERATIONAL_AMBIENT_COMPANION_AND_STRUCTURED_STATUS_REFLECTOR
characterAssetId: project-authored placeholder slot
authorityRole: none
assignmentRefs: []
directDomainEventSubscriptions: []
presentationInputs: accepted structured projections only
routes: verified shared-office paths only
notifications: []
```

Channy may roam verified paths; visit Team areas/shared spaces; sit near a
verified-idle actor; eat, drink, sleep, rest, play, or observe; briefly follow an
accepted routing cue; and reflect structured `WAITING_LEO`, `BLOCKED`,
stale/offline, mission-complete, or valid dispatch/routing facts. A
stale/offline reflector pose is static. Without accepted evidence, Channy stays
neutral. Reduced-motion/static mode provides equivalent text and pose without
movement.

Channy never inspects terminal/session content, infers unstructured state,
creates evidence, dispatches work, carries commands, approves, changes sessions,
repairs systems, replaces an alert/mission board, or implies communication or
collaboration. Session/system checks remain structured-adapter responsibility.
Channy is not an Advisor, Worker, Reviewer, router, notification authority,
terminal actor, or inferred presence.

AO12-C implements this presentation boundary only in
`channy-presentation.tsx` behind the explicit synthetic motion selector. Its
fixed precedence is stale/offline static reflection, structured `BLOCKED`,
structured `WAITING_LEO`, completion, accepted-route follow, then neutral
ambient. It receives only already-reduced cue/status inputs, renders one global
non-actor, has no control or direct event subscription, and leaves primary
status, alerts, mission board, and activity log independently complete.

## 8. Approved placeholder asset contract

The exact product decision is
`APPROVE_PROJECT_AUTHORED_CODE_NATIVE_PLACEHOLDERS_FOR_M1_2_IMPLEMENTATION`.
AO12-B implements only original project-authored CSS/DOM/SVG/simple local
sprite-like placeholders. The direction is cute
2D/2.5D pixel or pixel-inspired, warm retro 16/32-bit console, friendly and
blocky, in an American startup/open-office setting. Environmental placeholders
may include wood desks, glass meeting room, coffee lounge, shared paths, project
signs, mission boards, Reviewer booth, Advisor desk/Hub, and Channy
bed/food/water.
They must not copy a protected artist, franchise, game, or distinctive protected
style.

### 8.1 Slot geometry

AO12-B project-authored placeholders use deterministic slots:

| Slot | Candidate intrinsic size/viewBox | Use |
|---|---|---|
| `character-full` | 96 x 96 / `0 0 96 96` | Selected-Team full character |
| `character-route` | 48 x 48 / `0 0 48 48` | One bounded route cue |
| `role-glyph` | 24 x 24 / `0 0 24 24` | Condensed identity and static fallback |
| `project-glyph` | 24 x 24 / `0 0 24 24` | Supplemental project marker |
| `assignment-badge` | 48 x 20 / `0 0 48 20` | Pattern/project short label backing |
| `channy-full` | 72 x 72 / `0 0 72 72` | One global Channy placeholder |
| `channy-facility` | stable slot-specific viewBox | Bed/food/water presentation objects |

The existing M1 `actor` 96 x 72 asset remains unchanged inside the M1 adapter.
M1.2 slot selection does not resize or replace the historical asset.

### 8.2 Required asset-manifest fields

Every current or future asset entry must include:

```text
schemaVersion: agent-office.character-assets.v1
assetId
semanticRole
status: PLACEHOLDER | PRODUCTION_APPROVED | RETIRED
format
intrinsicWidth, intrinsicHeight, viewBox
variants[]
sourcePath
sourceOwner
sourceOrigin
licenseId and licenseTextPath
attribution
acquiredAt (if external)
purchaseEvidenceRef (if purchased)
sourceSha256
optimizedSha256
containsScript: false
containsExternalReference: false
replacementFor (optional)
reviewedCommit
```

Missing license, ownership, hash, stable geometry, or safety fields makes an
asset `INVALID`; the UI uses the local neutral placeholder/static role glyph.

### 8.3 Prohibited asset behavior

- remote URL or runtime fetch;
- script, event handler, embedded HTML, external font, link, data URL, tracking
  marker, or executable SVG feature;
- credential, token, path, user content, or terminal material;
- model/provider logo or real-person likeness claim without explicit licensed
  approval;
- layout-dependent intrinsic dimensions;
- autoplay sound, video, Lottie/runtime interpreter, shader, or unreviewed
  animation format; and
- user-supplied SVG execution.

## 9. External acquisition prohibition and replacement gate

This M1.2 decision does not authorize purchase, import, download, generation,
commissioning, vendor selection, paid licensing, or any external asset source.
Project-authored placeholders are not approved production art. A future
separately authorized replacement proposal must provide:

- a new explicit Leo/GPT decision for the proposed replacement/source class;
- exact inventory and license/redistribution terms;
- source provenance, receipt/contract when relevant, and byte hashes;
- security inspection and format allowlist;
- light, dark, high-contrast, forced-color, reduced-motion, 320px, 200% text,
  desktop/tablet/mobile visual evidence;
- bundle, parse, render, memory, and frame measurements;
- accessible semantic fallback independent of the asset;
- same-slot replacement geometry or an explicit layout migration;
- exact before/after visual baselines and direct inspection; and
- reversible commit and fallback asset.

Replacement never changes `roleInstanceId`, role category, project identity,
state, severity, authority, evidence, or assignment. An asset may be retired only
after every reference and license/inventory record is updated atomically in the
same reviewed implementation batch.

## 10. Accessibility and responsive identity

- Character and project SVGs are decorative when adjacent text carries their
  semantics; otherwise a concise accessible label is mandatory.
- Project selector accessible names include full display name, project ID,
  freshness, responsible Advisor status, progress, and alert count.
- Actor accessible names include exact actor role, role-instance-safe label,
  project assignment, WorkUnit, state/activity, freshness, and alert severity.
- Color-blind simulations do not replace WCAG contrast testing. Project
  combinations must remain distinguishable by text/pattern/glyph.
- In forced-colors mode, project fills may disappear; border style, glyph, text,
  and system focus/severity colors remain.
- At 200% text and 320px, short labels may be omitted in favor of full wrapped
  text; no identity is truncated to color/glyph only.
- Mobile may use role/project glyphs instead of full characters, but facts and
  interaction order remain equivalent.
- Focus rings always use the operational focus token and cannot inherit project
  color.
- Motion-off and reduced-motion remove pose interpolation without removing
  identity, state, or the activity log.

## 11. Contrast and visual verification gates

AO12-B implementation proves for its static fixture, and every replacement must
continue to prove:

- normal text contrast >= 4.5:1 and large text >= 3:1;
- focus and essential graphical/state objects >= 3:1 against adjacent colors;
- every hue/pattern/glyph combination in light and dark palettes;
- severity overrides remain distinguishable from every project tuple;
- exact-tuple and short-label collision cases;
- monochrome, forced-color, and CSS-image/SVG-hidden fallbacks;
- no layout shift when an asset is missing, invalid, or replaced;
- no remote asset request or executable SVG behavior; and
- M1 asset hash, inventory, dimensions, and six baseline bytes remain unchanged.

Current AO12-B tests and later train tests are named in
[`../operations/AGENT_OFFICE_M1_2_IMPLEMENTATION_WORKUNIT_PLAN.md`](../operations/AGENT_OFFICE_M1_2_IMPLEMENTATION_WORKUNIT_PLAN.md).

## 12. Resolved Leo/GPT decisions and implementation gate

`AO12-FD-01` is resolved as
`CHANNY_ENABLED__NON_OPERATIONAL_AMBIENT_COMPANION_AND_STRUCTURED_STATUS_REFLECTOR`.
`AO12-FD-02` is resolved as
`APPROVE_PROJECT_AUTHORED_CODE_NATIVE_PLACEHOLDERS_FOR_M1_2_IMPLEMENTATION`.
The chained decision status is
`DESIGN_PATCH_AUTHORIZED__IMPLEMENTATION_CONDITIONAL_ON_CLEAN_FABLE5_PASS`.

The clean delta review, Advisor freeze, AO12-A focused `PASS`/Advisor acceptance,
corrected AO12-B review/Advisor acceptance, and exact AO12-C handoff occurred.
AO12-A retains the current-name gate and
identity-safe projection references. AO12-B implements deterministic fixed and
fallback identities plus only original placeholder assets with stable geometry,
internal license, and actual source hash
`adacf982a568bffefe1a6eddefb58584ff706f9408fdf5ab81a42ce49b19bd63`.
Four AO12-B focused files pass 24 tests and six static configured-runtime
baselines were directly inspected. AO12-C adds the bounded verified-idle and
Channy/status-reflector behavior above, with 76 focused/benchmark tests, 15
browser cases, and seven directly inspected configured-runtime baselines.
Independent AO12-C review and Advisor acceptance remain required; AO12-D
production selection is not authorized. No personalized likeness, purchase,
import, external generation, production-art approval, operational Channy
behavior, authority, transport, or runtime activation is implied.

## 13. Authority, security, and privacy non-change

Character identity is not authentication. Project identity is not trust.
Advisor styling is not Advisor authority. A Reviewer silhouette is not a review
verdict. A Leo/GPT decision destination is not approval. A connected/animated actor
is not completion. No asset or identity field may contain or reveal a credential,
session/pane target, raw path, terminal content, message body, capability, or
private host detail. All M1 browser, security, Advisor-only, and redaction
boundaries remain unchanged.
