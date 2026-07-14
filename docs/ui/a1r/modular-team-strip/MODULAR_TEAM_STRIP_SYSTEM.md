# Agent Office A-1R Modular Team Strip System

Status: `DESIGN_CANDIDATE_FOR_ADVISOR`

This package defines a reusable office construction system. It does not define
one bespoke office illustration, runtime application code, or implementation
authorization. The SVG module source, manifest, composition data, and static
exporter are the source of truth; PNGs are review evidence only.

## Review entry points

- Canonical source: [`canonical-modules.svg`](canonical-modules.svg)
- Machine-readable manifest: [`module-manifest.json`](module-manifest.json)
- Fixed geometry and proof occupancy: [`compositions.json`](compositions.json)
- Deterministic static exporter: [`export-proofs.mjs`](export-proofs.mjs)
- Machine-readable validation: [`validation-report.json`](validation-report.json)
- Canonical catalog: [`module-catalog.png`](module-catalog.png)
- Small proof: [`team-strip-small.png`](team-strip-small.png)
- Medium proof: [`team-strip-medium.png`](team-strip-medium.png)
- Large proof: [`team-strip-large.png`](team-strip-large.png)
- Stacked proof: [`stacked-team-strips.png`](stacked-team-strips.png)

The five matching `.svg` files are deterministic evidence sources emitted by
the exporter. They retain a `data-module-id` and `data-instance-id` mapping for
every visible instance.

## Construction-source contract

1. `canonical-modules.svg` defines every reusable visual as one canonical SVG
   `<symbol>`.
2. `module-manifest.json` maps stable module IDs to symbol/viewBox, anchor,
   state, tint, and assembly-component metadata.
3. `compositions.json` owns one shared strip geometry, four fixed lanes, ten
   fixed role slots, proof occupancy, and stacked data order.
4. `export-proofs.mjs` is static design/export tooling. It validates all module
   and assembly references, emits mapped SVG instances, rasterizes the five
   proofs with `ffmpeg`/librsvg, and writes `validation-report.json`.
5. No exported PNG is read back as a design source. Re-export always starts
   from the four source-of-truth files above.

Every visible proof object is created through the registered emitter. The final
validation report records `visibleObjectsWithoutModuleId: 0` for all five
exports. Internal assembly components also resolve recursively to canonical
module IDs.

## Fixed geometry

| Property | Canonical value |
| --- | ---: |
| Single-strip canvas | `2400 x 720` |
| Strip content bounds | `x=36, y=36, w=2328, h=614` |
| Canonical standing-character height | `144px` |
| Required corridor target | `>=180px` (`1.25x`) |
| Actual stacked corridor | `190px` |
| Actual corridor ratio | `1.3194x` |
| Stacked strip offset | `804px` |
| Stacked canvas | `2400 x 2480` |

The two stacked corridors occupy `y=650..840` and `y=1454..1644`.
Validation rejects any Team-owned instance whose bounds leave its shared content
bounds. Floor and corridor surfaces are the only surfaces in those ranges; no
furniture, sign, board, plant, handle, decoration, actor, or Channy instance
intersects either clear corridor.

### Fixed lane geometry

| Lane order | Lane | x | y | width | height |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1 | Designer Zone | 56 | 118 | 424 | 470 |
| 2 | Advisor + Mission Board | 480 | 118 | 400 | 470 |
| 3 | Worker Zone | 880 | 118 | 1050 | 470 |
| 4 | Reviewer Zone | 1930 | 118 | 414 | 470 |

Lane fields are restrained floor treatments, not walls or divider lines. The
four lanes remain on one continuous office floor.

### Fixed slot anchors

| Slot | Lane | x | y | Capacity meaning |
| --- | --- | ---: | ---: | --- |
| D1 | Designer | 88 | 260 | first Designer |
| D2 | Designer | 282 | 260 | second Designer |
| A1 | Advisor | 500 | 226 | exactly one Advisor |
| W1 | Worker | 888 | 260 | nearest Advisor; filled first |
| W2 | Worker | 1084 | 260 | second Worker |
| W3 | Worker | 1280 | 260 | third Worker |
| W4 | Worker | 1476 | 260 | fourth Worker |
| W5 | Worker | 1672 | 260 | fifth Worker |
| R1 | Reviewer | 1942 | 260 | first independent Reviewer |
| R2 | Reviewer | 2144 | 260 | second independent Reviewer |

These coordinates, strip dimensions, character viewBoxes, furniture viewBoxes,
camera, and scale are shared by Small, Medium, and Large. Empty capacity uses
the reusable `ui.slot-anchor-empty` floor inlay; it never moves or redesigns a
neighboring slot.

## Proof occupancy

| Proof | Designers | Advisor | Workers | Reviewers | State evidence |
| --- | ---: | ---: | ---: | ---: | --- |
| Small | 1 | 1 | 1 | 1 | coordinating Advisor; working displays; Channy present |
| Medium | 1 | 1 | 3 | 1 | seated idle Advisor; W3 idle/off monitor |
| Large | 2 | 1 | 5 | 2 | maximum occupancy; all working displays |
| Stacked | Large → Small → Medium | fixed per proof | fixed per proof | fixed per proof | order changes only; geometry unchanged |

Worker occupancy must be a contiguous prefix beginning at W1. The exporter
rejects any proof that fills a farther Worker slot before a nearer one.

## Role and state behavior

- Advisor `coordinating`: standing at the shared Advisor anchor, gesturing
  between the Mission Board and Team; monitor uses bright-white working state.
- Advisor `idle`: same proportions and anchor, seated in the same chair;
  monitor is black/off.
- Designer `working`: seated at the same desk/chair geometry, using the canonical
  pen display with visible stylus posture.
- Worker `working`: rear-facing seated pose, hands extended to the canonical
  keyboard, bright-white monitor UI.
- Worker `idle`: same rear-facing proportions and anchor, hands lowered,
  black/off monitor. Medium W3 proves this state.
- Reviewer `reviewing`: visually separate lane, canonical desk/chair/monitor,
  paper proof in hand, no celebratory verdict pose.
- Channy `walking`: recognizable Bedlington Terrier silhouette, ambient only,
  no operational or authority behavior.

Monitor state is the primary visual work indicator. Semantic state must still be
exposed as text to assistive technology and must never be inferred from motion.
Unknown remains neutral and uses `ui.state-indicator:unknown`; it does not
activate a working pose or bright monitor.

Team color is passed through SVG `currentColor` only to clothing and restrained
module accents. It never changes geometry, fills a Team room, or becomes the
only identity signal. Team signs keep short stable text visible.

## Complete module reuse table

Counts below are assembly-expanded visible instance counts from
`validation-report.json`. Catalog counts include the catalog's own reusable
cards and labels.

| Canonical module ID | Catalog | Small | Medium | Large | Stacked |
| --- | ---: | ---: | ---: | ---: | ---: |
| `surface.floor` | 3 | 1 | 1 | 1 | 4 |
| `surface.corridor` | 1 | 0 | 0 | 0 | 2 |
| `surface.lane` | 1 | 4 | 4 | 4 | 12 |
| `ambient.light-pool` | 4 | 3 | 5 | 9 | 17 |
| `ui.team-sign` | 1 | 1 | 1 | 1 | 3 |
| `ui.lane-sign` | 1 | 4 | 4 | 4 | 12 |
| `ui.drag-handle` | 1 | 1 | 1 | 1 | 3 |
| `ui.focus-ring` | 1 | 0 | 0 | 0 | 0 |
| `ui.state-indicator` | 1 | 1 | 1 | 1 | 3 |
| `ui.slot-anchor-empty` | 1 | 6 | 4 | 0 | 10 |
| `ui.continuation` | 1 | 0 | 0 | 0 | 1 |
| `ui.catalog-card` | 34 | 0 | 0 | 0 | 0 |
| `ui.catalog-label` | 36 | 0 | 0 | 0 | 0 |
| `furniture.desk` | 5 | 4 | 6 | 10 | 20 |
| `furniture.chair` | 5 | 4 | 6 | 10 | 20 |
| `device.monitor` | 4 | 3 | 5 | 8 | 16 |
| `device.pen-display` | 2 | 1 | 1 | 2 | 4 |
| `device.keyboard` | 2 | 1 | 3 | 5 | 9 |
| `furniture.mission-board` | 2 | 1 | 1 | 1 | 3 |
| `furniture.shelf` | 2 | 1 | 1 | 1 | 3 |
| `prop.plant` | 1 | 2 | 2 | 2 | 6 |
| `prop.mug` | 4 | 3 | 5 | 8 | 16 |
| `prop.paper-stack` | 2 | 1 | 1 | 2 | 4 |
| `prop.task-lamp` | 3 | 2 | 2 | 4 | 8 |
| `actor.advisor` | 1 | 1 | 1 | 1 | 3 |
| `actor.designer` | 1 | 1 | 1 | 2 | 4 |
| `actor.worker` | 1 | 1 | 3 | 5 | 9 |
| `actor.reviewer` | 1 | 1 | 1 | 2 | 4 |
| `pet.channy` | 1 | 1 | 0 | 0 | 1 |
| `assembly.worker-workstation` | 1 | 1 | 3 | 5 | 9 |
| `assembly.designer-station` | 1 | 1 | 1 | 2 | 4 |
| `assembly.advisor-station` | 1 | 1 | 1 | 1 | 3 |
| `assembly.reviewer-station` | 1 | 1 | 1 | 2 | 4 |

## Reorder contract

- The drag handle belongs to the Team Strip data item, not to an Advisor or
  Team authority relationship.
- Reordering changes only the `stacked.order` array. It does not change strip
  width, lane geometry, slot anchors, capacity, Team identity, reports-to, or
  authority.
- New Teams append below using the same strip source and `804px` offset.
- The bottom `ui.continuation` module indicates additional continuous office
  canvas; it is not an add-Team command or implementation affordance.
- The static proofs show affordance only. No interaction is implemented here.

## Responsive and accessibility contract

### Desktop and keyboard

- The complete strip is a named Team region; each lane is a stable subregion and
  each slot exposes role, occupancy, and semantic state.
- Drag handle is the only reorder grab target. Focus uses the canonical
  `ui.focus-ring`, independent of Team color.
- Intended keyboard contract: focus handle → Space/Enter to enter reorder mode →
  Up/Down to move one Team → Space/Enter to commit → Escape to cancel.
- A polite live region announces original position, current position, total
  Team count, commit, and cancellation. Reorder never dispatches an agent.

### Mobile

- Mobile retains the same office strip and lane order inside a pannable game
  camera; it does not convert Teams into a vertical card dashboard.
- One Team region may be focused at a time. Horizontal pan reveals the fixed
  lanes; vertical pan moves between strips and preserves the clear corridor.
- Role/detail disclosure remains `Tap actor → compact bottom sheet → detail`.
  The static proof does not implement this behavior.

### Reduced motion and static

- Reduced motion stops Channy, ambient light, monitor flicker, and reorder
  transition. Geometry and semantic state remain unchanged.
- Static/no-canvas mode presents the same Team/role/slot/state facts as a
  semantic ordered list and keeps Team reorder unavailable unless an equivalent
  keyboard control is provided.

### High text and screen reader equivalent

- High-text mode enlarges stable Team/lane labels and state text without
  changing slot order or using the technical dashboard as the primary view.
- Screen reader order follows Team order, then Designer, Advisor, Worker W1–W5,
  Reviewer R1–R2. Empty slots announce availability without implying an active
  session.
- Working/off monitor appearance has an equivalent semantic state. Color,
  proximity, and animation are never the only signal.

## Image-generation provenance

Built-in `image_gen` was used once and only for the canonical Channy asset
reference. No Small, Medium, Large, stacked, catalog, background, furniture, or
complete office scene was generated.

- Generated source:
  [`assets/pet-channy-walk-chroma.png`](assets/pet-channy-walk-chroma.png)
- Final visible reusable module: `pet.channy` / SVG symbol
  `#pet-channy-walk` in `canonical-modules.svg`.
- Generation count: `1`.
- Backend image-model identifier: not exposed by the built-in tool.
- The generated silhouette informed the original locally authored SVG module;
  proof exports do not embed the flattened generated raster.

Final prompt:

```text
Use case: stylized-concept
Asset type: canonical reusable management-simulation game sprite for the Agent Office module system
Primary request: one full-body Bedlington Terrier named Channy, walking toward the right in a coherent 45-degree three-quarter game-camera pose
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for local background removal
Subject: unmistakable Bedlington Terrier with a blue-gray and warm off-white curly lamb-like coat, narrow pear-shaped head, tasselled triangular ears, arched roach back, tucked waist, long slim legs, small dark eyes, and a restrained teal collar; friendly alert walking pose; all four legs readable; entire dog visible
Style/medium: original high-fidelity pixel-art sprite, crisp stepped silhouette, limited warm management-sim palette, readable at small in-product scale, no imitation of any named game or protected style
Composition/framing: single centered dog with generous padding, no crop, no other object
Lighting/mood: neutral soft sprite lighting baked only into the dog
Text: no text
Constraints: background must be exactly one uniform #ff00ff color with no shadows, gradients, texture, reflections, floor plane, or lighting variation; no cast shadow, no contact shadow, no reflection, no watermark; do not use #ff00ff anywhere in the dog; no props, no floor, no frame, no duplicate pose, no label; keep silhouette crisp for chroma-key removal
```

Two local transparent derivatives were rejected during original-size inspection:
the first created partial-alpha speckling inside white fur; a conservative matte
retry retained nontransparent corner pixels. Both failed derivatives were
removed and are not referenced by the system. This limitation is why the final
proof uses the canonical SVG Channy symbol instead of a flattened raster.

## Full-size export inspection

| PNG | Dimensions | SHA-256 | Direct finding |
| --- | --- | --- | --- |
| `module-catalog.png` | `2400x1400` | `4f6eaac57b4b2adb8bec05d4d05f180ac4ec22d8a6a8692a6a968b858124b1be` | all 33 IDs visible; canonical geometry and assemblies readable |
| `team-strip-small.png` | `2400x720` | `b8fdda00ee61ccdf49aebf970e1277445b9ef27c85e3e0f979097e971a244f41` | intentional empty anchors; one of each role; Channy readable |
| `team-strip-medium.png` | `2400x720` | `07ee789f3bea4c1b09d004f988022726f258a5f649c7cfb8840e59bedc4acc91` | W1–W3 filled in order; W3 and idle Advisor black/off screens visible |
| `team-strip-large.png` | `2400x720` | `0e9e510102a196ceb4c64db1a903169fc864f0828f900939ae764308bb7c431d` | all fixed slots filled without geometry changes or overlap |
| `stacked-team-strips.png` | `2400x2480` | `98edcdd24875506d9c4066a5e2b3f538601473bb42641249ae80ce34cd7c148d` | three open strips; two empty 190px corridors; no walls; continuation visible |

All five PNGs were opened from their final paths at original size. The first
stacked/catalog render revealed transparent letterboxing caused by scaling the
floor source. The exporter was corrected to repeat the same `surface.floor`
module at its canonical height; the final exports above have no black or
transparent gaps.

## Acceptance criteria for implementation handoff

Implementation remains separate and unauthorized. When implementation is later
authorized, it must satisfy all of the following without inventing UX policy:

- Resolve every visible instance to one manifest module ID and supported state.
- Preserve the exact lane and slot coordinates or a uniformly scaled transform
  of the complete strip; never reflow individual lanes or slots.
- Fill Designer ≤2, Advisor =1, Worker ≤5, Reviewer ≤2; leave unused slots empty.
- Fill Worker slots from W1 outward.
- Use the same desk, chair, monitor, keyboard, body proportions, and assembly
  geometry for every repeated instance.
- Use bright-white working monitors and black/off idle monitors; expose semantic
  equivalents.
- Restrict Team tint to approved clothing and accents.
- Preserve corridor height above one standing sprite and at least `1.25x` target;
  no static object may enter the clear corridor.
- Reorder Team data only; never mutate Team authority or geometry.
- Preserve Channy as ambient/no-authority.
- Meet the desktop, mobile, keyboard, reduced-motion, static, high-text, and
  screen-reader contracts above.

## Limitations and unresolved work

- This is a static construction proof, not runtime implementation, motion proof,
  or final Founder-approved visual package.
- Canonical actors intentionally prioritize reusable geometry and role posture;
  selected art may receive later bounded fidelity refinement without changing
  viewBoxes, anchors, assemblies, or placement rules.
- The generated Channy raster did not produce an acceptable transparent final;
  the current visible module is the locally authored reusable SVG version.
- Mobile and interactive states are specified but not exported as additional
  screens because they are outside the authorized proof list.
- Sample Team labels and colors are design evidence, not live registry or
  operational claims.
- No new Founder product decision is required. Implementation and Founder
  approval remain separate and have not been granted.
