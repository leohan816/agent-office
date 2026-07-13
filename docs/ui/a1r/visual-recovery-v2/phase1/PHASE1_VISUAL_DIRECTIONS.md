# A-1R Phase 1 Living Office Visual Directions

Status: `FOUNDER_VISUAL_DIRECTION_SELECTION_REQUIRED`

This package contains exactly three scene-only direction candidates. It is a
rapid Phase 1 exploration, not a complete desktop composition, implementation
specification, independent review, or Founder approval.

## Direction A — Courtyard Commons

- Artifact: [`direction-a.png`](direction-a.png)
- Size: `1536x1024`
- One-line theme: A bright, plant-filled coordination commons where work is
  visible around a shared diagonal path.
- Visual rationale: Morning light, an open Mission Board, two grounded
  production desks, and a slatted independent review zone make the organization
  feel welcoming and immediately active without UI cards.
- Generation provenance: OpenAI built-in `image_gen`; first generation selected;
  no regeneration; copied byte-for-byte from generated source
  `exec-920d2e26-083b-468d-9659-34c2e6a458ad.png`.
- SHA-256: `3f224519e0988a4021db70faea61fd3a1c3c0d0f1b3233140c6c5ed1a4062614`

## Direction B — Lantern Loft

- Artifact: [`direction-b.png`](direction-b.png)
- Size: `1536x1024`
- One-line theme: A blue-hour loft where warm task lights bind a compact Pod
  while the Reviewer works from a raised alcove.
- Visual rationale: The long-room composition, U-shaped work surfaces, pools of
  amber light, and Channy crossing the aisle create a focused, intimate, and
  distinctly nocturnal office personality.
- Generation provenance: OpenAI built-in `image_gen`; first generation selected;
  no regeneration; copied byte-for-byte from generated source
  `exec-34c64339-b9b4-4a06-95f9-82056b5698cb.png`.
- SHA-256: `d377e180f795be58c0486b6b603d54a889a54ac60053a9c2357b67802b6f1ebd`

## Direction C — Garden Circuit

- Artifact: [`direction-c.png`](direction-c.png)
- Size: `1536x1024`
- One-line theme: A daylight garden studio where a looping path connects work
  islands without erasing the Reviewer's independence.
- Visual rationale: The planted lightwell creates movement and spatial identity;
  the inhabited front Pod, separate production island, walking colleague, and
  glass review booth keep the scene lively but disciplined.
- Generation provenance: OpenAI built-in `image_gen`; first generation selected;
  no regeneration; copied byte-for-byte from generated source
  `exec-616822a8-93f5-462f-afb4-88227ae633ff.png`.
- SHA-256: `022b612ddb202762f2ff4bbc2294e0d9dc0bb1ce3a25fd581128a7c7af00a466`

## Direction separation

| Dimension | A — Courtyard Commons | B — Lantern Loft | C — Garden Circuit |
| --- | --- | --- | --- |
| Spatial composition | Open diagonal commons | Long U-shaped loft | Loop around a planted lightwell |
| Atmosphere | Bright late morning | Amber-lit blue hour | Clear spring daylight |
| Visual personality | Welcoming craft studio | Intimate, cinematic library loft | Restorative biophilic campus |
| Reviewer separation | Slatted side zone | Raised rear alcove | Detached glass booth |
| Channy behavior | Sniffing a planter | Crossing the aisle with a toy | Drinking beside the garden path |

## Direct full-size inspection

- Direction A: four recognizable adults are visible; the Advisor points at a
  physical coordination board, two Workers type at complete workstations, and
  the Reviewer compares a paper proof with a monitor. Channy is prominent,
  long-legged, narrow-headed, curly-coated, and immediately dog-like.
- Direction B: four recognizable adults are visible; the seated Advisor gestures
  across a planning surface, two Workers use distinct keyboard/monitor stations,
  and the Reviewer marks papers under a separate task light. The darkest areas
  retain readable hands, chairs, tools, and floor contact. Channy is clearly in
  motion with a soft toy.
- Direction C: five recognizable adults are visible; the Advisor coordinates at
  the inhabited front Pod, two Workers use separate production surfaces, a
  colleague carries a tray along the loop, and the Reviewer remains inside a
  detached booth. Dense planting does not obscure work surfaces. Channy's
  Bedlington silhouette and water-bowl behavior are clear.
- In all three scenes, tiny screen and paper marks are non-semantic pixel texture,
  not readable generated prose or operational claims.

## Scene-contract boolean self-check

`true` means the exported scene visibly satisfies the contract at original
size. This is Designer self-check evidence only.

| Required scene contract | A | B | C |
| --- | :---: | :---: | :---: |
| Warm, original pixel or pixel-inspired 2D/2.5D living office | true | true | true |
| Coherent 45-degree/3/4 camera, floor, furniture, people, and depth | true | true | true |
| Three or more recognizable human characters with consistent proportions | true | true | true |
| Seated working pose with visible chair, desk, keyboard, monitor, hands/body orientation, and believable activity | true | true | true |
| Advisor coordination, Worker production, and independent Reviewer behavior are visually distinct | true | true | true |
| Believable inhabited Advisor Team Pod fragment | true | true | true |
| Paths, props, lighting, and environmental detail imply movement | true | true | true |
| Channy is appropriately visible and recognizable as a Bedlington Terrier | true | true | true |
| Production-intended palette, atmosphere, and emotional tone | true | true | true |
| Secondary UI is absent/minimal and the office world dominates | true | true | true |

## Automatic-rejection boolean self-check

`false` means the rejection condition is not present in the exported scene.

| Rejection condition present? | A | B | C |
| --- | :---: | :---: | :---: |
| Reads as a slide, mood board, floor plan, dashboard, wireframe, or specification sheet | false | false | false |
| Uses circles, blocks, or abstract tokens as people | false | false | false |
| Requires labels to explain who is working | false | false | false |
| Hides desks, chairs, keyboard, monitor, hands, or work posture | false | false | false |
| Uses inconsistent perspective or floating/disconnected furniture | false | false | false |
| Is mostly empty floor, large cards, or flat Team-color polygons | false | false | false |
| Makes Channy cloud-like, generic, tiny, or unrecognizable | false | false | false |
| Feels sterile, emotionally flat, or implementation-convenient | false | false | false |
| Contains illegible generated prose or unsupported operational claims | false | false | false |

## Interaction and accessibility boundary

- Phase 1 contains static, scene-only direction images, so it does not claim
  desktop/mobile interaction, keyboard, reduced-motion, high-text, or
  screen-reader implementation coverage.
- The scenes do preserve the intended accessibility direction: roles read from
  pose and work surface rather than color or labels; spatial separation does not
  imply authority; Channy is ambient and performs no authority action.
- The complete responsive and accessibility behavior contract remains a later
  design phase after Founder visual-direction selection. No runtime behavior is
  specified or implemented here.

## Limitations and unresolved selection

- Founder selection among A, B, and C is intentionally unresolved.
- These are compact direction scenes, not final-production-polished screens.
- Exact canonical character sprites, final Team identity treatment, minimal
  supporting UI, mobile composition, motion, and interaction states remain
  deferred to their authorized later phases.
- The built-in image tool exposed no backend image-model identifier; provenance
  is therefore reported at the available tool and generated-source level.
- Implementation authorization and Founder approval remain separate and have
  not been granted.

## Final prompt set

The following are the final prompts used with the built-in `image_gen` path.

<details>
<summary>Direction A prompt</summary>

```text
Use case: ui-mockup
Asset type: Phase 1 scene-only product image for the Agent Office “Living Office” canvas
Primary request: Create a shippable high-fidelity 2.5D pixel-art product scene that immediately reads as a living AI organization where recognizable AI employees are visibly working. Direction A is a sunlit “Courtyard Commons” office: an open diagonal circulation path wraps around one compact inhabited Advisor Team Pod.
Scene/backdrop: a warm contemporary studio office viewed consistently from a 45-degree three-quarter camera, complete tiled floor plane, waist-high partitions, windows, plants, shelves, cables, desk lamps, mugs, papers, and small lived-in props. The office world fills nearly the entire landscape frame.
Subject: exactly four recognizable adult human characters with consistent proportions, distinct faces, hair, clothing, arms, hands, legs, and clear postures. The Advisor stands at a compact coordination table beside a physical mission board, one hand pointing to pinned notes while looking toward the team. Two Workers sit in visible wheeled chairs at separate angled production desks; each desk clearly shows monitor, keyboard, mouse, hands actively typing or adjusting work, and believable body orientation. The independent Reviewer sits apart behind a slatted partition at a smaller review desk, comparing a paper proof against a monitor with a pencil in hand; calm and independent, no celebration. Include Channy prominently but naturally on the central path: unmistakable Bedlington Terrier, blue-gray and off-white curly lamb-like coat, narrow pear-shaped head, tasselled triangular ears, arched roach back, tucked waist, long slim legs, small dark eyes; sniffing near a planter, clearly a dog, not a cloud, sheep, poodle, or generic blob.
Style/medium: original crisp production-quality pixel art with sophisticated 2.5D depth, readable human anatomy and expressive poses, fine furniture detail, clean sprite silhouettes, subtle ambient animation cues captured in a still; not imitating any named game or protected style.
Composition/framing: 3:2 landscape, target 1536x1024 or larger. Strong diagonal path from foreground to back windows; Advisor Team Pod anchors the middle-left, Workers make a readable production rhythm, Reviewer is spatially independent at right, Channy sits in the foreground-middle at useful scale. All furniture shares one coherent 45-degree perspective and sits firmly on the floor with correct occlusion and contact shadows.
Lighting/mood: bright late-morning sunlight, honey wood, muted teal, cream, sage, small restrained cobalt team accents; warm, optimistic, inhabited, focused.
Text: no readable text anywhere.
Constraints: scene-only product screenshot; no title, no caption, no labels, no speech bubbles, no annotation, no explanatory prose, no dashboard panels, no status cards, no floor-plan polygons, no large empty floor, no abstract people, no floating furniture, no watermark. Office world must dominate. Desks, chairs, keyboards, monitors, hands, and work posture must be plainly visible at full size. No operational claims.
```

</details>

<details>
<summary>Direction B prompt</summary>

```text
Use case: ui-mockup
Asset type: Phase 1 scene-only product image for the Agent Office “Living Office” canvas
Primary request: Create a shippable high-fidelity 2D/2.5D pixel-art product scene that immediately reads as a living AI office with recognizable employees actively working. Direction B is a cozy evening “Lantern Loft”: a narrow long-room office with a U-shaped Advisor Team Pod at the near end and an elevated independent review alcove at the far end.
Scene/backdrop: one coherent loft interior from a 45-degree three-quarter camera, dark indigo window wall with city glow, warm pendant lamps, exposed brick, wood floor runners, bookcases, rolling whiteboard, server cabinet, coat hooks, plants, task lights, paper trays, coffee cups, and a clear aisle suggesting movement. The world fills the full landscape frame.
Subject: exactly four recognizable adult human characters in consistent detailed pixel proportions. The Advisor is seated sideways at the open end of a U-shaped coordination desk, turning from a physical planning board to gesture calmly toward two Workers. Both Workers occupy separate visible chairs and workstations within the same Pod: one types with both hands at a keyboard and monitor, the other leans forward manipulating a trackpad beside a second monitor; desks, chair backs, legs, arms, hands, and work tools are unobscured. The independent Reviewer is clearly separated in a raised rear alcove behind a half-height bookcase, standing at a narrow review bench under a task lamp, comparing two printed sheets and marking one with a pencil; no celebratory pose. Include Channy crossing the lit aisle at a clearly readable scale while carrying a small soft toy: unmistakable Bedlington Terrier with blue-gray/off-white curly coat, narrow pear-shaped head, tasselled triangular ears, arched roach back, tucked waist, long slim legs, small dark eyes; a dog rather than a cloud, sheep, poodle, or blob.
Style/medium: original premium pixel-inspired 2.5D illustration for a real product, slightly chunkier sprites and richer material texture than Direction A, coherent anatomy, expressive working gestures, precise furniture; no imitation of any named game or protected style.
Composition/framing: 3:2 landscape, target 1536x1024 or larger. Dramatic lengthwise room perspective; U-shaped Team Pod is clearly inhabited in foreground/midground, aisle leads the eye to the independent review alcove, Channy moves across the aisle. Correct 45-degree furniture angles, grounded contact shadows, consistent depth and occlusion.
Lighting/mood: blue-hour city ambience plus warm amber pools of lamp light, walnut, rust, ink blue, parchment, restrained violet team accents; intimate, industrious, humane, quietly cinematic.
Text: no readable text anywhere.
Constraints: scene-only product screenshot; no title, no labels, no UI cards, no dashboard, no diagrams, no annotation, no fake operational text, no giant color zones, no empty floor, no abstract tokens, no floating furniture, no watermark. Office dominates. Make seated activity and visible monitor/keyboard/hands/chair unmistakable.
```

</details>

<details>
<summary>Direction C prompt</summary>

```text
Use case: ui-mockup
Asset type: Phase 1 scene-only product image for the Agent Office “Living Office” canvas
Primary request: Create a shippable high-fidelity 2D/2.5D pixel-art product scene that reads in five seconds as a living AI organization. Direction C is an airy “Garden Circuit” office: three small work islands connected by a looping terracotta walkway around a planted indoor lightwell, with one compact Advisor Team Pod fragment occupying the front-left island and the Reviewer in a detached glass-sided booth.
Scene/backdrop: a bright biophilic office under skylights, coherent 45-degree three-quarter view, terrazzo and wood floor, curved low planters translated into crisp pixel geometry, glass partitions, acoustic panels, pinboard, shelves, printer cart, rolling stools, visible cable runs, water carafe, notebooks, lamps, and a looping path with footprints and moved chairs implying circulation. World fills nearly all of the landscape frame.
Subject: exactly five recognizable adult human pixel characters with consistent proportions, faces, hair, clothing, limbs, and readable poses. At the front-left Team Pod, the Advisor stands between a compact coordination console and a physical mission board, arranging a note with one hand and gesturing toward a seated Worker with the other. That Worker sits in a visible ergonomic chair at an angled desk, both hands on a keyboard, facing a monitor with a second small reference display; chair, desk, screen, keyboard, hands, and feet all readable. A second Worker sits at a separate production island using a pen tablet beside a monitor. One colleague walks on the loop carrying a document tray to imply movement without authority. The independent Reviewer is in a detached glass-sided booth at back-right, seated at a review table with monitor, keyboard, paper checklist, and pencil, posture focused and separate. Include Channy clearly near a water bowl beside the planted lightwell, head tilted: unmistakable Bedlington Terrier with blue-gray/off-white curly coat, narrow pear-shaped head, tasselled triangular ears, arched roach back, tucked waist, long slim legs, small dark eyes; clearly a dog, not a cloud, sheep, poodle, or blob.
Style/medium: original polished pixel-inspired 2.5D product illustration, finer brighter pixels, soft-edged daylight translated into crisp clusters, charming but professional recognizable characters, coherent environmental storytelling; do not imitate any named game or protected style.
Composition/framing: 3:2 landscape, target 1536x1024 or larger. Central planted lightwell creates a circular flow; front-left Team Pod, middle-right production island, and back-right Reviewer booth are distinct but share one world. Dense useful detail with no clutter wall; grounded contact shadows and consistent perspective/occlusion.
Lighting/mood: clear spring daylight, pale oak, warm white, sage, terracotta, soft sky blue, restrained coral team accents; energetic, restorative, collaborative but disciplined.
Text: no readable text anywhere.
Constraints: scene-only product image; no title, captions, labels, cards, dashboard chrome, floor-plan diagram, annotations, fake text, giant saturated polygons, geometric placeholder people, empty space, floating furniture, or watermark. Office world dominates. Role behavior must be legible from pose and work surface, not labels.
```

</details>
