# Agent Office M1.2 Character and Project Identity System

Status: `DESIGN_CANDIDATE__NO_ASSET_CREATED_OR_SELECTED__IMPLEMENTATION_NOT_AUTHORIZED__PENDING_FABLE5_REVIEW`

Identity catalog candidate: `agent-office.project-identity.v1`

Asset manifest candidate: `agent-office.character-assets.v1`

This document defines supplemental project and actor presentation identity for
M1.2. Identity never changes actor authority, assignment, mission state,
freshness, severity, evidence, or transport. No image, SVG, font, animation,
purchase, license, import, generation, or dependency is added by this design.

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

There is no current project identity palette, character customization,
role-specific silhouette, Channy definition, production art style, asset vendor,
or asset-generation pipeline. Model/provider names and tmux identities are not
character identities. The six current visual baselines prove the generic M1
assets only.

## 2. Identity-layer precedence

Every rendered actor/pod separates five layers:

```text
1. Safety/operational severity and freshness
2. Canonical role and authority text/icon/shape
3. Exact actor role-instance identity
4. Project assignment identity
5. Decorative character style
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

### 3.2 Versioned derivation

For catalog `agent-office.project-identity.v1`:

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

Exact light/dark/high-contrast color values are an implementation deliverable
and must pass the contrast gate before use. A hue whose tested values are too
close to any operational semantic token must be replaced in the catalog, not
accepted by relying on pattern alone.

### 3.3 Collision behavior and persistence

An exact hue/pattern/glyph/edge collision is allowed because it carries no
authority and full project text remains primary. Collision handling is stable:

1. do not reorder or reassign either project's tuple;
2. show full `displayName` and `projectId` in selector/detail;
3. add the deterministic eight-hex `collisionMarker` to compact labels;
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

- pod header ribbon and project glyph;
- floor/zone hatch at low contrast;
- actor assignment badge/scarf/lanyard marker;
- compact pod selector marker; and
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
projectAssignmentRefs[]
currentAssignmentRef (optional)
assignmentStatus
evidenceFreshness
connectionState
identityCatalogVersion
characterAssetId
characterAssetStatus: PLACEHOLDER | PRODUCTION_APPROVED | MISSING | INVALID
```

`roleInstanceId` is the identity key. `actorRole` and role category must agree
with trusted configuration/canonical actor vocabulary. Display label, station,
project badge, asset, model name, session, pane, process, or location cannot
create a new actor identity.

### 5.2 Role categories and silhouettes

M1.2 defines semantic categories, not personalized likenesses:

| Role category | Candidate silhouette cue | Required visible semantics |
|---|---|---|
| `LEO_DECISION` | Decision document/door or seated neutral figure | `Leo/GPT`, final-decision destination; never an execution target |
| `ADVISOR_ROUTING` | Route tray, inbox, or directional sash | `Advisor`, one global canonical identity, responsibility refs |
| `CONTROL_RECOVERY` | Tool/console silhouette | Exact Control role, recovery/operations state |
| `INDEPENDENT_REVIEW` | Lens/checklist silhouette spatially separated | `Fable5 Reviewer`, independent review label |
| `WORKER_BUILD` | Desk/tool silhouette | Exact Worker role and project assignment label |
| `GENERIC_REGISTERED` | Neutral local placeholder | Exact registered role text; no inferred person/model identity |

Silhouette is supplemental. Role text plus a locally bundled semantic icon and
distinct shape remain visible. Leo/GPT, Advisor, Reviewer, and Worker cannot be
distinguished by project hue alone.

### 5.3 One actor, multiple assignment views

A role instance is rendered as at most one full character in the selected pod.
Other projects/pods may show labelled assignment references, counts, or a small
static identity chip. They do not clone the character or show simultaneous live
motion.

If accepted evidence says one role instance has incompatible simultaneous active
assignments, render one character with `ASSIGNMENT_CONFLICT`, list every exact
assignment reference, use the operational conflict overlay, and suppress all
task/lounging motion. Do not choose the visually nearest pod or the greatest
timestamp.

### 5.4 Advisor and Reviewer distinction

- Advisor has one global character at the Advisor Hub. Pod headers reference
  that exact `roleInstanceId`; no pod-local Advisor clone is drawn.
- A responsibility line/badge is a relationship projection, not authority.
- Fable5 is rendered only at the independent review desk or as a compact static
  review assignment. It does not sit at a Worker desk or share a work animation.
- A patch-return cue may travel from Fable5 to the exact assigned Worker, but it
  is not a new dispatch and does not imply approval.

## 6. Character pose and state overlays

### 6.1 Base pose vocabulary

Candidate poses are presentation-only:

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

### 6.3 Lounge character rules

`IDLE_LOUNGE` requires current verified actor identity and the lounge eligibility
rules in the master design. A lounge character:

- has no work document, keyboard typing, review lens, test checklist, message
  bubble, availability badge, or collaboration cue;
- may show one bounded neutral ambient shift under the cue contract;
- remains a single actor identity even if several pod assignments exist;
- leaves only on a new accepted structured source; and
- becomes static/unknown immediately on stale, offline, conflict, critical,
  hidden, or reduced-motion state.

Two characters in the lounge do not imply conversation or shared context.

## 7. Channy decision gate

No current Agent Office source or canonical document defines Channy. The only
valid version-1 state is:

```text
channyMode: DISABLED
characterAssetId: none
authorityRole: none
assignmentRefs: []
eventSubscriptions: []
routes: []
notifications: []
interactions: []
```

No visible placeholder labelled Channy should be rendered in production merely
because a design slot exists; that could imply a product role. Design diagrams
may show a dashed `CHANNY_DISABLED / LEO_GPT_DECISION_REQUIRED` annotation only.

Enabling any Channy variant requires all of:

1. Leo/GPT decision `AO12-FD-01` defining purpose and non-authority boundary;
2. updated canonical design and unknown register;
3. a new character/spatial contract version;
4. Fable5 design review; and
5. separate implementation authorization and tests.

Channy cannot be introduced as an Advisor, Worker, Reviewer, autonomous router,
approval agent, notification authority, terminal actor, or inferred presence.

## 8. Placeholder asset contract

### 8.1 Slot geometry

Future project-authored placeholders use deterministic slots:

| Slot | Candidate intrinsic size/viewBox | Use |
|---|---|---|
| `character-full` | 96 x 96 / `0 0 96 96` | Selected-pod full character |
| `character-route` | 48 x 48 / `0 0 48 48` | One bounded route cue |
| `role-glyph` | 24 x 24 / `0 0 24 24` | Compact identity and static fallback |
| `project-glyph` | 24 x 24 / `0 0 24 24` | Supplemental project marker |
| `assignment-badge` | 48 x 20 / `0 0 48 20` | Pattern/project short label backing |

The existing M1 `actor` 96 x 72 asset remains unchanged inside the M1 adapter.
M1.2 slot selection does not resize or replace the historical asset.

### 8.2 Required asset-manifest fields

Every future asset entry must include:

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

## 9. Production asset and replacement gate

No production asset source or style is selected. Before purchase/import/
generation/commissioning or replacement, a separately authorized proposal must
provide:

- Leo/GPT decision `AO12-FD-02` for art direction and source class;
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

Future implementation must prove:

- normal text contrast >= 4.5:1 and large text >= 3:1;
- focus and essential graphical/state objects >= 3:1 against adjacent colors;
- every hue/pattern/glyph combination in light and dark palettes;
- severity overrides remain distinguishable from every project tuple;
- exact-tuple and short-label collision cases;
- monochrome, forced-color, and CSS-image/SVG-hidden fallbacks;
- no layout shift when an asset is missing, invalid, or replaced;
- no remote asset request or executable SVG behavior; and
- M1 asset hash, inventory, dimensions, and six baseline bytes remain unchanged.

Candidate future tests are named in
[`../operations/AGENT_OFFICE_M1_2_IMPLEMENTATION_WORKUNIT_PLAN.md`](../operations/AGENT_OFFICE_M1_2_IMPLEMENTATION_WORKUNIT_PLAN.md).

## 12. Founder decisions

This system does not decide:

- `AO12-FD-01`: whether Channy exists and, if so, the exact product role; or
- `AO12-FD-02`: production art direction and project-authored versus separately
  approved licensed/commissioned source.

Safe defaults remain `CHANNY_DISABLED` and local code-native placeholders. No
other customization, likeness, purchase, import, or generation is implied.

## 13. Authority, security, and privacy non-change

Character identity is not authentication. Project identity is not trust.
Advisor styling is not Advisor authority. A Reviewer silhouette is not a review
verdict. A Leo decision destination is not approval. A connected/animated actor
is not completion. No asset or identity field may contain or reveal a credential,
session/pane target, raw path, terminal content, message body, capability, or
private host detail. All M1 browser, security, Advisor-only, and redaction
boundaries remain unchanged.
