# Agent Office M1.2 Living Pixel-Office Implementation Plan

Original plan status: `DESIGNED_TWO_STAGE_LIVING_PIXEL_OFFICE_PLAN__PROTOTYPE_CONDITIONAL_ON_CLEAN_FABLE5_PASS__FULL_INTEGRATION_BLOCKED_ON_LEO_GPT_VISUAL_APPROVAL`

Historical compatibility-delta status:
`CANDIDATE_PROTOTYPE_ONLY_PUBLIC_EXPORT_COMPATIBILITY_BRIDGE__PENDING_CLEAN_FABLE5_LEVEL3_DESIGN_PASS__IMPLEMENTATION_PAUSED_NOT_AUTHORIZED__FULL_INTEGRATION_DEFERRED_WITH_GATE`

Current as-built visual-patch status:
`IMPLEMENTED_BOUNDED_FOUNDER_VISUAL_PATCH_AO12_PWU_11_P1__PENDING_FABLE5_AO12_PWU_11_R1__FULL_INTEGRATION_BLOCKED`

Plan base: `48c8dbd9f2c5ecea68c28e85137d75db595ef5f9`

Public-export compatibility-delta base:
`9611d0da1479ca5e7a9677641fe767a6b39b4a38`

Governing patch manifest:
`agent-office.m1.2.living-pixel-office-patch-manifest.v1`, version `2`

This is a plan, not an implementation grant. No command in this document may be
run until an exact committed Advisor handoff authorizes its WorkUnit, branch,
base, files, tests, dependency change, and push. The current design pass changes
canonical Markdown only.

## 1. Hard-gated sequence

```text
AO12-PWU-01..05  Worker canonical design package (this design pass)
  -> AO12-PWU-06 Fable5 Level-3 design review
       clean PASS only
  -> Stage 1: bounded synthetic prototype
       AO12-PWU-07 renderer/world/camera
       AO12-PWU-08 sprites/Channy/HUD/detail/accessibility
       AO12-PWU-09 visual/performance/media evidence
       AO12-PWU-10 Fable5 visual/product-intent prototype review
  -> AO12-PWU-11 Leo/GPT visual-direction decision
       explicit approval only
  -> Stage 2: full authenticated integration
       AO12-PWU-12 implementation and evidence
       AO12-PWU-13 independent review, Advisor audit, Founder package
```

`PASS_WITH_RISK`, `NEEDS_PATCH`, or `FAIL` at `AO12-PWU-06` does not authorize a
prototype. A clean design `PASS` authorizes only Stage 1. It cannot be construed
as production selection or Stage 2 authority. `AO12-PWU-12` remains `BLOCKED`
until Leo/GPT records explicit prototype visual-direction approval in
`AO12-PWU-11` and Advisor issues a new exact implementation handoff.

The prepared prototype later reached a public Pixi declaration-compatibility
blocker. The supplemental hard gate is:

```text
prepared isolated synthetic prototype (uncommitted and not publication-ready)
  -> public-export compatibility bridge canonical design delta
  -> clean Fable5 Level-3 PASS for that exact delta
  -> new exact Advisor implementation handoff
  -> bounded bridge/import/test correction only
  -> complete prototype verification and later review gates resume
```

The earlier renderer-design `PASS`, prototype preparation, or this plan does not
skip either new gate. No compatibility implementation is currently authorized.

## 2. WorkUnit map

| WorkUnit | Actor | Exact outcome | Entry gate | Exit gate |
|---|---|---|---|---|
| `AO12-PWU-01` | Agent Office Worker | Official-library renderer evaluation and selected candidate | Exact design handoff | Canonical renderer decision written |
| `AO12-PWU-02` | Agent Office Worker | Shared world, coordinate, Pod, camera, pan/zoom/focus/mobile design | PWU-01 | World/camera invariants written |
| `AO12-PWU-03` | Agent Office Worker | Actor/Channy atlas and accepted-event animation design | PWU-01 | Sprite/asset/cue contract written |
| `AO12-PWU-04` | Agent Office Worker | Concise HUD, DOM detail/semantic mirror, accessibility/static/M1 design | PWU-01/02 | Correspondence and fallback contract written |
| `AO12-PWU-05` | Agent Office Worker | Two-stage batches, file/test/performance/media/rollback plan and 13-scene matrix | PWU-02/03/04 | This exact implementation plan written |
| `AO12-PWU-06` | Fable5 Reviewer | Independent Level-3 product-intent and renderer architecture verdict | PWU-01..05 committed/pushed | Clean `PASS` only opens Stage 1 |
| `AO12-PWU-07` | Agent Office Worker | Isolated loopback synthetic renderer, one shared world, camera, deterministic clock | Clean PWU-06 `PASS`; exact new handoff; media tool preflight | Directly viewable prototype route; no production import |
| `AO12-PWU-08` | Agent Office Worker | Original code-native actor/Channy/facility atlases, state cycles, HUD/detail/DOM mirror | PWU-07 | Ten Founder scene classes executable from synthetic script |
| `AO12-PWU-09` | Agent Office Worker | Complete gates, 13 visual rows, five PNGs, 20-30s WebM, MP4, GIF, hashes and reproduction evidence | PWU-08 and all capture/conversion tools | Exact evidence package; server stopped; media ignored/untracked |
| `AO12-PWU-10` | Fable5 Reviewer | Independent live visual/product-intent/media review | PWU-09 committed code and retrievable media | Verdict returned to Advisor; Reviewer makes no patch |
| `AO12-PWU-11` | Leo/GPT | Explicit approve/reject/patch visual-direction decision | PWU-10 result and media | Only explicit approval may unblock PWU-12 |
| `AO12-PWU-12` | Agent Office Worker | Authenticated lazy pixel renderer, production selector, PWA/bundle/accessibility/fallback/rollback proof | Explicit PWU-11 approval plus new exact handoff | Implementation result only; no self-review or final approval |
| `AO12-PWU-13` | Fable5 Reviewer and Advisor | Independent implementation/security/accessibility review, Advisor audit, final Founder package | PWU-12 exact result | Leo/GPT retains final approval and next-mission authority |

## 3. Stage 0 - original documentation-only pass

The original renderer-design pass authorized exactly:

```text
docs/architecture/AGENT_OFFICE_M1_2_LIVING_PIXEL_OFFICE_RENDERER_DESIGN.md
docs/ui/AGENT_OFFICE_M1_2_PIXEL_WORLD_SPRITE_ANIMATION_SYSTEM.md
docs/operations/AGENT_OFFICE_M1_2_LIVING_PIXEL_OFFICE_IMPLEMENTATION_PLAN.md
docs/architecture/AGENT_OFFICE_M1_2_SPATIAL_OFFICE_MASTER_DESIGN.md
docs/FEATURE_INDEX.md
```

Those checks were documentation and Git-boundary checks only. That pass did not
install packages, update a lockfile, create an atlas, start a server, update a
snapshot, generate media, or touch source/test/configuration/runtime files.

### 3.1 Current public-export compatibility design delta

The current design-only correction is governed by
[`../architecture/AGENT_OFFICE_M1_2_PIXI_PUBLIC_EXPORT_COMPATIBILITY_BRIDGE.md`](../architecture/AGENT_OFFICE_M1_2_PIXI_PUBLIC_EXPORT_COMPATIBILITY_BRIDGE.md).
Its exact Agent Office mutation set is limited to that new document, this plan,
and the companion renderer design. The prepared source, tests, package,
lockfile, media, configuration, baselines, `docs/FEATURE_INDEX.md`, and ignore
changes remain preserved, uncommitted prototype work. This delta grants no
implementation or staging authority for them.

Only Markdown/link/path/Git-scope checks apply to the current design delta. It
must not install a package, run or modify the prototype, update snapshots,
start a server/browser, regenerate media, or reinterpret prepared evidence as
an accepted final implementation.

## 4. Stage 1 - bounded prototype `AO12-PWU-07..10`

### 4.1 Entry conditions

All conditions are required before the first prototype mutation:

1. the exact design commit is pushed on the Advisor-approved branch;
2. Fable5 reads that commit and returns a clean Level-3 `PASS` for PWU-06;
3. Advisor validates the verdict and issues an exact PWU-07 handoff;
4. the handoff names the exact new base, branch, file allowlist, dependency pins,
   result path, pointer path, and push authority;
5. Agent Office is clean or unrelated dirt is non-overlapping and preservable;
6. no server is listening on the selected loopback port;
7. Playwright Chromium and its configured local runtime are available;
8. `ffmpeg` and `ffprobe` are available as exact local executables; and
9. the required artifact root is proven ignored and contains no tracked file.

The 2026-07-12 design-time preflight found `ffmpeg`, `ffprobe`-class conversion
support, `gifski`, `convert`, and `magick` unavailable from PATH. Therefore a
future prototype handoff must first identify an approved local conversion tool
or separately authorize its installation. Design `PASS` alone does not
authorize system-package or npm-tool installation. If capture or conversion
preflight fails, stop before dependency installation or source edits and return
a prerequisite blocker to Advisor.

### 4.2 Prototype dependency boundary

Only the following new runtime dependencies are proposed, with exact pins:

```text
pixi.js@8.19.0
@pixi/react@8.0.5
```

React/React DOM remain `19.2.7`. A later authorized command is expected to use
the repository package manager and exact-save semantics, for example:

```text
npm install --save-exact pixi.js@8.19.0 @pixi/react@8.0.5
```

That command is **not authorized now**. The prototype may not add a game engine,
physics library, camera library, state manager, font, asset generator, remote
loader, video package, or second animation dependency. Any peer-dependency,
license, audit, type, or build failure stops for a design/implementation
classification; versions are not changed opportunistically.

#### 4.2.1 Public-export compatibility gate

The exact pinned packages remain TypeScript `6.0.3`, `@pixi/react@8.0.5`,
`pixi.js@8.19.0`, React/React DOM `19.2.7`, and global
`skipLibCheck: false`. The selected prototype-only correction is one JavaScript
runtime bridge importing public package roots plus one adjacent exact local
declaration contract. Prototype TypeScript imports that local bridge only.

The bridge design, bounded values/calls, fail-closed behavior, regressions, and
promotion gate are binding in the compatibility document. No deep path,
relative `node_modules` path, suppression, broad type, wildcard/ambient module,
global override, dependency/compiler/strictness change, or production/auth
promotion is an alternate implementation. The correction remains paused until
its clean Fable5 Level-3 design `PASS` and a new exact Advisor handoff.

### 4.3 Proposed prototype file surfaces

The exact future handoff should narrow or approve this proposal. Existing
production runtime files are deliberately absent.

**Repository/package and explicit test-demo entry**

```text
.gitignore
package.json
package-lock.json
src/ui/demo-entry.tsx
```

`.gitignore` adds exactly:

```text
/artifacts/m1-2-visual-prototype/
```

`src/ui/demo-entry.tsx` recognizes exactly
`surface=living-pixel-prototype`. It dynamically imports the prototype entry.
The ordinary demo, `spatial-static`, and `spatial-motion` selectors retain their
current behavior. `src/ui/runtime/entry.tsx`, production runtime composition,
and `Dashboard` must not import the prototype graph.

**New pure pixel contracts and projection**

```text
src/ui/pixel/contracts.ts
src/ui/pixel/frame-projector.ts
src/ui/pixel/world-layout.ts
src/ui/pixel/pathfinder.ts
src/ui/pixel/camera.ts
src/ui/pixel/presentation-clock.ts
```

These modules may import the existing spatial projection/cue types but no Pixi,
React, DOM, observation, process, filesystem, gateway, transport, HTTP mutation,
or persistence implementation.

**New candidate renderer and DOM correspondence surface**

```text
src/ui/pixel/prototype-entry.tsx
src/ui/pixel/renderer-boundary.tsx
src/ui/pixel/pixel-world-chunk.tsx
src/ui/pixel/pixel-world-scene.tsx
src/ui/pixel/world-clock.tsx
src/ui/pixel/actor-sprite.tsx
src/ui/pixel/channy-sprite.tsx
src/ui/pixel/facility-sprites.tsx
src/ui/pixel/world-camera.tsx
src/ui/pixel/living-office-hud.tsx
src/ui/pixel/living-office-semantic-mirror.tsx
src/ui/pixel/living-office-detail-drawer.tsx
src/ui/pixel/living-office.css
```

The Pixi catalogue is explicitly extended only with the classes needed by the
approved scene. DOM components receive the same immutable frame model and never
read pixels or run a second source projector.

Before the prepared renderer can be publication-ready, a later exact bridge
handoff must add only these new compatibility files:

```text
src/ui/pixel/pixi-public-export-bridge.js
src/ui/pixel/pixi-public-export-bridge.d.ts
tests/ui/pixi-public-export-bridge.test.ts
```

It must clean the imports/suppressions only in
`facility-sprites.tsx`, `pixel-world-scene.tsx`,
`renderer-boundary.tsx`, and `world-clock.tsx`. The only newly proposed legacy
path is `tests/acceptance/batch-gates.test.ts`, whose dependency expectation may
change only from the exact original three runtime dependencies to the exact
approved five. This proposed future allowlist is not current implementation
authority.

**New original code-native atlas sources**

```text
src/ui/pixel/assets/palette.ts
src/ui/pixel/assets/office-world-atlas.source.ts
src/ui/pixel/assets/actor-base-atlas.source.ts
src/ui/pixel/assets/actor-identity-atlas.source.ts
src/ui/pixel/assets/channy-atlas.source.ts
src/ui/pixel/assets/atlas-builder.ts
src/ui/pixel/assets/atlas-manifest.ts
src/ui/pixel/assets/ASSET_INVENTORY.md
```

No external asset, URL, font, SVG import, purchase, protected reference, or
runtime asset service is allowed. The builder and generated RGBA bytes must be
deterministic and hash-verified.

**Synthetic prototype only**

```text
src/ui/pixel/fixtures/prototype-projection.ts
src/ui/pixel/fixtures/prototype-scenarios.ts
src/ui/pixel/fixtures/prototype-timeline.ts
```

These paths, fixture IDs, marker strings, and scenario controls must be absent
from a fresh production build. They contain no real credential, path, session
locator, message content, DB value, private host, or live source.

**Focused and browser proof**

```text
tests/ui/pixel-world-frame.test.ts
tests/ui/pixel-world-layout.test.ts
tests/ui/pixel-world-camera.test.ts
tests/ui/pixel-world-atlas.test.ts
tests/ui/pixel-world-animation.test.ts
tests/ui/pixel-world-semantic-parity.test.tsx
tests/ui/pixel-renderer-lifecycle.test.tsx
tests/performance/pixel-world-budget.test.ts
tests/acceptance/production-pixel-prototype-boundary.test.ts
tests/e2e/living-pixel-prototype.spec.ts
tests/e2e/living-pixel-prototype.recording.spec.ts
tests/e2e/baselines/living-pixel-prototype.spec.ts/
playwright.pixel-prototype.config.ts
scripts/verify-living-pixel-prototype-evidence.mjs
```

New screenshots use only the new baseline directory. Existing M1, AO12-B,
AO12-C, and AO12-D PNG bytes may not change.

### 4.4 `AO12-PWU-07` - renderer, world, and camera

Implement only:

- pure `PixelWorldFrameV1`, deterministic one-floor placement, walkability map,
  named anchors, pathfinder, and camera state;
- lazy `@pixi/react`/PixiJS chunk under the exact synthetic selector;
- WebGL-preferred, tested-Canvas fallback and immediate DOM static fallback;
- one private fixed-step ticker, scripted clock option, resize, pan, zoom,
  selected-Team focus, full-office return, mobile Pod navigation, and focus
  restoration;
- startup, StrictMode, hidden/resume, orientation, context-loss, and teardown
  diagnostics; and
- primitive code-native floor/facility visuals sufficient to prove the world is
  one game-like spatial floor rather than a canvas of cards.

Exit evidence:

- ordinary production build contains no Pixi/prototype marker or fixture;
- test-demo prototype loads only at the exact selector;
- all registered synthetic Teams coexist in stable world coordinates;
- WebGL success, Canvas core-subset classification, both-fail DOM fallback,
  context loss, StrictMode, resize, camera clamp, mobile navigation, and zero
  retained lifecycle resources pass; and
- no screenshot or media is accepted yet as final prototype proof.

### 4.5 `AO12-PWU-08` - sprites, Channy, HUD, and semantic mirror

Implement only:

- all atlas manifests and required actor animation IDs;
- project clothing/sign/prop/glyph/pattern/palette layers;
- one canonical actor sprite per exact role instance and one global Advisor
  character per exact Advisor instance;
- bounded walking, typing, reviewing, document carry/return, coffee/rest/lounge,
  and exact static state frames from the existing accepted cue reducer;
- one Channy with roam/sit/eat/drink/sleep/play and structured reaction frames,
  no authority or operational input;
- concise HUD, Team/mission signs and boards, DOM detail drawer, route log,
  screen-reader mirror, keyboard controls, high contrast, 200-percent text,
  reduced-motion/static equivalent, and M1 fallback link; and
- the deterministic 26-second synthetic prototype timeline below.

Exit evidence:

- every atlas/source/hash/license/geometry test passes;
- every cue has valid, invalid, stale, conflict, duplicate, replay, and
  non-selected cases;
- no actor/Advisor/Channy clone exists;
- Pixi/DOM entity and state correspondence is exact for every frame key; and
- the ten Founder scene classes run continuously in the browser with no
  hover-only substitute.

### 4.6 Deterministic 26-second prototype timeline

| Time | Visible scene |
|---:|---|
| `0.0-2.0s` | Full shared office, all Teams, complete facilities, concise boards |
| `2.0-4.0s` | Camera pans/zooms to Foundation and restores full-office affordance |
| `4.0-6.0s` | Foundation/VibeNews project clothing, signs, props, glyphs, patterns, and colors are compared without color-only identity |
| `6.0-8.0s` | One exact Worker walks on a bounded route to the assigned desk |
| `8.0-10.0s` | Channy roams one verified shared walkway |
| `10.0-13.0s` | One Advisor carries and hands one document to the exact Worker; no clone |
| `13.0-15.0s` | Worker uses the bounded typing microcycle from accepted synthetic `WORKING` |
| `15.0-17.0s` | Fable5 uses review frames in the independent Reviewer booth |
| `17.0-19.0s` | One verified-idle actor uses the coffee lounge; no work/collaboration implication |
| `19.0-20.5s` | Channy eats at the exact food anchor |
| `20.5-22.0s` | Channy sleeps at the exact bed anchor |
| `22.0-24.0s` | `WAITING_LEO` transitions to `BLOCKED`; HUD/detail/static route facts remain primary |
| `24.0-26.0s` | Secondary DOM technical panel opens/closes, camera returns to full office |

The `6.0-13.0s` contiguous segment contains actor walking, Channy roaming, and
Advisor document handoff and is the source segment for the required GIF. The
timeline does not claim real activity; every fact is visibly labelled
`SYNTHETIC PROTOTYPE`.

### 4.7 `AO12-PWU-09` - exact visual, performance, and media evidence

#### Artifact root and fail-closed preflight

The only media root is:

```text
/home/leo/Project/agent-office/artifacts/m1-2-visual-prototype/
```

Before creating it or writing media, the later Worker must prove:

```text
git check-ignore -q -- artifacts/m1-2-visual-prototype/.ignore-probe
test -z "$(git ls-files -- artifacts/m1-2-visual-prototype/)"
command -v ffmpeg
command -v ffprobe
```

It must also prove the installed Playwright API can start/stop browser
screencast recording and the configured Chromium launches. Any failure stops.
The artifact directory, when authorized, is owner-only (`0700`). Large media is
never staged or committed.

#### Required files

```text
/home/leo/Project/agent-office/artifacts/m1-2-visual-prototype/agent-office-living-office-prototype.webm
/home/leo/Project/agent-office/artifacts/m1-2-visual-prototype/agent-office-living-office-prototype.mp4
/home/leo/Project/agent-office/artifacts/m1-2-visual-prototype/agent-office-living-office-prototype.gif
/home/leo/Project/agent-office/artifacts/m1-2-visual-prototype/full-office.png
/home/leo/Project/agent-office/artifacts/m1-2-visual-prototype/team-activity.png
/home/leo/Project/agent-office/artifacts/m1-2-visual-prototype/lounge.png
/home/leo/Project/agent-office/artifacts/m1-2-visual-prototype/channy.png
/home/leo/Project/agent-office/artifacts/m1-2-visual-prototype/mobile.png
```

The recording test uses Playwright's actual running page and precise screencast
start/stop. The expected exact command is:

```text
npx playwright test tests/e2e/living-pixel-prototype.recording.spec.ts --config playwright.pixel-prototype.config.ts --project=chromium --workers=1
```

The config must start `npm run build:dashboard:test` and a non-reused
`127.0.0.1:4173` preview, fix viewport `1440x900`, DPR `1`, locale `ko-KR`,
timezone `UTC`, dark theme, and one worker, and stop the preview after the test.
The WebM must be `>=20.000s` and `<=30.000s` by `ffprobe`.

The exact MP4 conversion command is:

```text
ffmpeg -nostdin -hide_banner -loglevel error -y -i /home/leo/Project/agent-office/artifacts/m1-2-visual-prototype/agent-office-living-office-prototype.webm -an -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart /home/leo/Project/agent-office/artifacts/m1-2-visual-prototype/agent-office-living-office-prototype.mp4
```

The exact GIF conversion command uses the contiguous `6.0-13.0s` segment:

```text
ffmpeg -nostdin -hide_banner -loglevel error -y -ss 00:00:06.000 -t 00:00:07.000 -i /home/leo/Project/agent-office/artifacts/m1-2-visual-prototype/agent-office-living-office-prototype.webm -vf "fps=12,scale=720:-2:flags=neighbor,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=none" -loop 0 /home/leo/Project/agent-office/artifacts/m1-2-visual-prototype/agent-office-living-office-prototype.gif
```

Substitution with concatenated still images, CSS hover captures, another
browser session, or a re-rendered animation is forbidden. If the approved
converter lacks `libx264`, `palettegen`, or `paletteuse`, stop and return a tool
prerequisite; do not silently change codec or evidence format.

#### Visual evidence

Run all thirteen matrix rows in
[`../architecture/AGENT_OFFICE_M1_2_LIVING_PIXEL_OFFICE_RENDERER_DESIGN.md`](../architecture/AGENT_OFFICE_M1_2_LIVING_PIXEL_OFFICE_RENDERER_DESIGN.md).
The five delivery PNGs must be copied directly from those exact Playwright
captures, not rescaled or edited. Inspect every image directly against the
effective scenario/frame code. Record backend, browser version, viewport, DPR,
locale, timezone, theme, fixture ID/hash, logical time, and source commit.

#### Performance and lifecycle evidence

Measure every hard budget from the renderer design, plus:

- eager production build with a fresh output directory and exact zero fixture
  marker/source-graph gate;
- lazy chunk gzip bytes separated from entry shell;
- frame p50/p95/max over at least `600` active frames after `60` warm-up frames;
- camera latency over at least `100` focus/full-office cycles;
- long tasks during the exact 10-second busy subsection;
- display-object and texture-source counts at 12 Pods/64 actors/200 WorkUnits;
- WebGL estimated texture allocation and accepted Canvas subset results;
- heap before/after 20 focus cycles and 20 mount/unmount cycles with explicit
  garbage collection when the configured browser permits it; and
- zero canvases, tickers, observers, listeners, timers, cues, texture sources,
  and pointer captures after cleanup.

Any miss is reported honestly. It selects a lower/static tier or blocks the
prototype result; budgets are not rewritten to make evidence pass.

#### Evidence pointer fields

The prototype Worker result must list, for every one of the eight required
files:

```text
absolutePath
sizeBytes
sha256
scenarioDescription
prototypeCommitSha
captureCommand
conversionCommand or NOT_APPLICABLE
durationSeconds or NOT_APPLICABLE
viewport and logicalTime
```

It must additionally record the fixture source hash, configured runtime,
dependency versions/licenses/audit, all commands and outcomes, direct-inspection
notes, ignored/untracked proof, Git status, server cleanup, and known portability
limits. Hashes and sizes are computed only after all file handles and browser
contexts close.

### 4.8 Prototype verification train

The exact later handoff may add checks but must not omit:

```text
npx vitest run --maxWorkers=1 tests/ui/pixi-public-export-bridge.test.ts
npm run lint
npm run typecheck
npm test
npm run build:core
npm run build:dashboard
npm run build:dashboard:test
npm run audit:dependencies
npm run test:e2e:demo
npm run test:e2e:composed
npx playwright test --config playwright.pixel-prototype.config.ts --project=chromium --workers=1
git diff --check
```

Additional required assertions:

- only the compatibility bridge imports `@pixi/react` or `pixi.js`, and it uses
  their public roots only;
- no prototype source contains a Pixi deep/package-internal/relative
  `node_modules` import, `@ts-expect-error`, or `@ts-ignore`;
- the adjacent declaration equals the exact bounded surface, imports no Pixi
  vendor type, and contains no broad `any`, wildcard module, or global override;
- installed/locked/runtime identity remains exactly `@pixi/react@8.0.5` and
  `pixi.js@8.19.0`, TypeScript remains `6.0.3`, and `skipLibCheck` remains
  `false`;
- every historical baseline hash equals the design base;
- only the new living-office baseline directory is added;
- a fresh production bundle contains no synthetic projection, scenario,
  timeline, fixture marker, or media path;
- production source has no import path to prototype fixtures;
- no network request leaves `127.0.0.1`, and no remote asset request occurs;
- no DB, secret, credential, proof, environment value, real auth provider,
  real gateway capability, tmux input, Hermes, or public listener exists; and
- all Playwright servers and browser processes are stopped at completion.

### 4.9 `AO12-PWU-10` - independent prototype review

Fable5, in its existing Reviewer session, must inspect the actual committed
prototype and retrievable WebM, MP4, GIF, and five PNGs. It verifies source
commit, paths, sizes, hashes, duration, ignored/not-committed state, live
Playwright recording, continuous motion, visual direction, originality, all
Teams, actors, Channy, camera, secondary DOM panels, accessibility/static
equivalence, performance, cleanup, and authority/security isolation.

The Reviewer returns `PASS`, `PASS_WITH_RISK`, `NEEDS_PATCH`, or `FAIL` to
Advisor and does not patch. Only Advisor routes the result to Leo/GPT. The
Worker does not self-review and does not start Stage 2.

## 5. Founder gate `AO12-PWU-11`

Advisor returns the prototype review and exact media package to Leo/GPT. The
decision must explicitly identify the reviewed prototype commit and choose one
of:

```text
APPROVE_LIVING_PIXEL_OFFICE_VISUAL_DIRECTION
REQUEST_LIVING_PIXEL_OFFICE_PROTOTYPE_PATCH
REJECT_LIVING_PIXEL_OFFICE_VISUAL_DIRECTION
```

Silence, chat approval without a durable record, Fable5 `PASS`, Advisor
validation, or successful tests do not unblock full integration.

## 6. Stage 2 - full runtime integration `AO12-PWU-12..13`

### 6.1 Entry conditions

Stage 2 requires all of:

1. clean design `PASS`;
2. completed PWU-07..09 evidence;
3. Fable5 prototype review routed by Advisor;
4. durable explicit Leo/GPT
   `APPROVE_LIVING_PIXEL_OFFICE_VISUAL_DIRECTION` for the exact prototype;
5. Advisor audit and a new exact PWU-12 handoff;
6. exact integration base/branch/file/test/dependency/rollback authority; and
7. clean or safely non-overlapping worktrees.

Without any item, `AO12-PWU-12` stays `BLOCKED`.

### 6.2 Proposed production file surfaces

The later exact handoff must approve an exact subset. The anticipated surfaces
are:

**Pixel renderer promoted without prototype fixtures**

```text
src/ui/pixel/contracts.ts
src/ui/pixel/frame-projector.ts
src/ui/pixel/world-layout.ts
src/ui/pixel/pathfinder.ts
src/ui/pixel/camera.ts
src/ui/pixel/presentation-clock.ts
src/ui/pixel/renderer-boundary.tsx
src/ui/pixel/pixel-world-chunk.tsx
src/ui/pixel/pixel-world-scene.tsx
src/ui/pixel/world-clock.tsx
src/ui/pixel/actor-sprite.tsx
src/ui/pixel/channy-sprite.tsx
src/ui/pixel/facility-sprites.tsx
src/ui/pixel/world-camera.tsx
src/ui/pixel/living-office-hud.tsx
src/ui/pixel/living-office-semantic-mirror.tsx
src/ui/pixel/living-office-detail-drawer.tsx
src/ui/pixel/living-office.css
src/ui/pixel/assets/*
```

Prototype fixture/timeline modules remain test-demo-only and must not be
reachable from the production graph.

**Authenticated selection and existing UI integration**

```text
src/ui/dashboard.tsx
src/ui/runtime/runtime-app.tsx
src/ui/runtime/client.ts
src/ui/spatial/compatibility.ts
vite.config.ts
```

The existing authenticated projection and cue reducer remain the only data
source. The selector adds `PIXEL_FULL` and `PIXEL_RESTRAINED`, retains
`DOM_STATIC`, and retains `M1_FIXED_STATIONS`. Logout, expiry, revocation,
restart, invalid schema, stale/conflict/critical state, reduced motion, context
loss, and performance failure clear pixel state and select the existing safe
path. No fixture default is permitted.

**PWA/static shell only if exact emitted files require it**

```text
src/pwa/cache-policy.ts
public/sw.js
src/server/http/static-shell.ts
```

Any change is limited to same-origin hashed renderer chunks/assets and an atomic
cache-version bump. Protected API/event/evidence/message/alert content remains
never-cache. If Vite embeds atlas metadata in JavaScript and emits only already
allowed hashed extensions, `static-shell.ts` must remain unchanged.

**Tests and new baselines**

```text
tests/contract/authenticated-spatial-projection.test.ts
tests/ui/authenticated-spatial-compatibility.test.ts
tests/ui/authenticated-spatial-surface.test.tsx
tests/ui/pixel-*.test.ts*
tests/integration/runtime-composition.test.ts
tests/recovery/spatial-presentation-rollback.test.ts
tests/security/authenticated-spatial-redaction.test.ts
tests/security/scene-source-boundary.test.ts
tests/performance/authenticated-spatial-budget.test.ts
tests/performance/pixel-world-budget.test.ts
tests/acceptance/production-spatial-bundle-boundary.test.ts
tests/acceptance/production-pixel-prototype-boundary.test.ts
tests/e2e/living-pixel-office.spec.ts
tests/e2e-composed/application-office-scene.spec.ts
new living-pixel baseline directories only
```

The existing production bundle gate must continue to reject every synthetic
AO12-B/C/prototype fixture marker while permitting the reviewed production pixel
renderer.

**Canonical as-built documentation after implementation evidence exists**

```text
docs/architecture/AGENT_OFFICE_M1_2_SPATIAL_OFFICE_MASTER_DESIGN.md
docs/architecture/AGENT_OFFICE_M1_2_LIVING_PIXEL_OFFICE_RENDERER_DESIGN.md
docs/ui/AGENT_OFFICE_M1_2_PIXEL_WORLD_SPRITE_ANIMATION_SYSTEM.md
docs/operations/AGENT_OFFICE_M1_2_LIVING_PIXEL_OFFICE_IMPLEMENTATION_PLAN.md
docs/FEATURE_INDEX.md
```

As-built updates cannot pre-claim review, portability, production/live use, or
final approval.

### 6.3 Full integration behavior

PWU-12 must:

- lazy-load the reviewed pixel chunk only after an authenticated valid spatial
  selection and retain the always-ready DOM semantic/static view;
- use the exact existing accepted cue projector/reducer and current projection;
- make the living world the primary supported visual viewport only after all
  startup, bundle, accessibility, performance, teardown, and fallback gates pass;
- preserve every Team, mission board fact, actor/Advisor uniqueness rule,
  project identity, Channy non-authority boundary, and no-replay rule;
- preserve all authentication/session/CSRF/redaction/network/security behavior;
- preserve exact Advisor delivery, tmux, Hermes-disabled, gateway, authority,
  transport, persistence, manifest, and event behavior byte-for-byte unless the
  handoff separately and explicitly names a necessary presentation-only type
  addition; and
- make rollback an immediate presentation selection, not a Git/data/runtime
  rollback.

It must not activate a real server run, create a credential, send tmux input,
alter a capability, expose a network interface, access a DB, or import an
external asset.

### 6.4 Full integration verification

In addition to the complete repository train, require:

- all thirteen rows from authenticated fixtures/projections plus exact invalid,
  stale, conflict, critical, logout, expiry, revocation, restart, and source
  mismatch cases;
- WebGL and accepted Canvas-subset paths, both-backend failure, chunk failure,
  context loss/restore, atlas/hash failure, semantic divergence, performance
  fallback, and user-selected static mode;
- production PWA first-online load, cached reload, offline-after-cache, and
  offline-before-pixel-cache DOM fallback;
- eager and lazy bundle budgets, no fixture graph, dependency license/audit, and
  source-boundary scans;
- keyboard, screen reader, live regions, 320px, mobile, tablet, desktop,
  200-percent text, forced colors, reduced motion, static equivalent, focus
  restoration, and WCAG 2.2 AA automated/manual evidence;
- deterministic configured-runtime screenshots and direct visual inspection;
- all historical baseline hashes unchanged;
- complete unmount/logout/expiry/revocation/context-loss teardown and memory
  evidence; and
- stopped server/browser processes and clean explicit-path Git state.

### 6.5 Rollback checkpoints

| Checkpoint | Rollback |
|---|---|
| Lazy chunk/import/init failure | Keep already-rendered `DOM_STATIC`; no retry/replay |
| WebGL unavailable | Use accepted Canvas core subset; otherwise `DOM_STATIC` |
| Context/atlas/frame/parity failure | Stop/destroy Pixi and select `DOM_STATIC` |
| Invalid spatial projection/version | Existing `M1_FIXED_STATIONS` |
| Reduced motion/forced colors/performance miss | `DOM_STATIC` or explicit restrained tier |
| Logout/expiry/revocation/runtime stop | Clear cues/camera/textures and unmount; protected projection absent |
| Reviewer/Advisor rejection | Revert only the separately identified presentation commit or keep selector disabled; do not rewrite evidence/data |

No checkpoint invokes `git reset`, changes a ledger/manifest, restarts another
role, changes delivery/auth/authority, or starts a new mission automatically.

### 6.6 `AO12-PWU-13` review and routing

Fable5 independently reviews implementation, security, accessibility,
performance, visual evidence, asset provenance, lifecycle, PWA, and rollback.
Advisor validates the evidence and prepares the exact Founder package. Worker
reporting is not review. Only Leo/GPT may accept risk, grant final product
approval, close the mission, or select another mission.

## 7. Security and forbidden-boundary verification

Every stage must prove:

- no DB/schema/migration;
- no secret, credential, proof, auth-provider activation, environment value, or
  PII;
- no public, remote, private-network, production/live, or non-loopback listener;
- no real tmux input, gateway capability, Hermes implementation, role dispatch,
  arbitrary terminal/shell, adapter write, or browser-to-Worker/Reviewer route;
- no change to immutable Advisor authority, exact delivery, transport,
  acknowledgement, decision, review, or completion semantics;
- no unstructured state inference, actor cloning, or Channy authority;
- no external asset purchase/import/download/generation service or protected
  style imitation;
- no snapshot overwrite outside an exact new living-office baseline path;
- no force push, main push/merge, self-review, risk acceptance, final approval,
  or automatic next mission; and
- no server, browser, recording process, media file, cache, or generated build
  output left outside the exact cleanup policy.

## 8. STOP conditions

Stop and return to Advisor if:

- the current branch/base/file scope differs from the exact handoff;
- required tool, browser, converter, package, license, peer dependency, or audit
  evidence is unavailable;
- the artifact root is not ignored or any media path is tracked;
- a production bundle imports a synthetic fixture/scenario/clock/marker;
- the Pixi and DOM frame models diverge;
- WebGL/Canvas failure does not select a complete static fallback;
- context loss, StrictMode, logout, expiry, revocation, or unmount retains a
  canvas/ticker/listener/observer/texture/cue;
- an existing baseline changes;
- a hard visual, accessibility, performance, bundle, memory, or security gate
  fails;
- implementation would require a new dependency, asset source, server,
  capability, authority, transport, auth, DB, network, or runtime permission;
- prototype work is attempted without clean design `PASS`;
- the public-export bridge correction is attempted without its own clean
  Fable5 Level-3 design `PASS` and a new exact Advisor handoff;
- the bridge would require a deep import, diagnostic suppression, broad/global
  declaration, compiler/strictness/package change, or unlisted file; or
- full integration is attempted without explicit Leo/GPT prototype approval and
  a new exact Advisor handoff.

## 9. Requirement traceability

| Requirement | Canonical location | Planned proof |
|---|---|---|
| Renderer evaluation, lifecycle, context, PWA/SSR/bundle | Renderer design Sections 3-5, 8, 11 | PWU-07 lifecycle/browser/bundle gates |
| One shared world and every Team | Renderer design Section 6 | Layout invariants plus V01-V03 |
| Camera pan/zoom/focus/full/mobile/focus restore | Renderer design Section 7 | Camera unit/component/browser cases plus V12 |
| Actor/Channy sprites and state cycles | Sprite design Sections 5-8 | Atlas/mapping tests plus V02/V04-V09 |
| Structured-event truth, precedence, dedup, stale/conflict, no replay/clone | Sprite design Sections 8-10 | Existing cue regression plus pixel mapping negatives |
| Project identity not color-only | Sprite design Section 6 | Identity tests and V02/V03 |
| Concise HUD and DOM detail | Renderer design Section 9; sprite design Section 13 | Semantic parity, drawer/focus, V10/V11 |
| Accessibility/static/M1 fallback | Renderer design Section 10 | axe/keyboard/200%/forced/reduced/context failure and V12/V13 |
| Original assets/license/hash/no protected imitation | Sprite design Sections 2-3 | Inventory, byte/hash, external-reference and license gates |
| Determinism/visual/performance/teardown/security/rollback | Renderer design Sections 8, 11-15 | PWU-09 full evidence and PWU-12 regression |
| Exact 13-scene matrix | Renderer design Section 14 | Thirteen configured-runtime captures and recording segments |
| Exact media contract | This plan Section 4.7 | Eight files, hashes/sizes/duration/commands/ignored proof |
| Prototype/full integration hard gates | This plan Sections 1, 4-6 | PWU-06 clean PASS then PWU-11 explicit approval |
| Pixi public-export compatibility and prototype-only promotion boundary | Compatibility bridge design; this plan Sections 3.1, 4.2.1, 4.8 | Clean delta PASS, exact later handoff, contract/browser/build/full regressions |

## 10. Final boundary

This plan grants no implementation by itself. The current outcome is the
prototype-only public-export compatibility design delta, pending a clean Fable5
Level-3 `PASS` for that exact delta. The prepared prototype remains uncommitted
and implementation remains paused. Full authenticated integration remains
`DEFERRED_WITH_GATE`. After publishing the design result and pointer, the Worker
returns to Advisor and stops.

## 11. AO12-PWU-11-P1 bounded visual patch execution

After the reviewed prototype reached `c535877`, Leo/GPT chose
`REQUEST_VISUAL_PATCH` and authorized exactly `AO12-PWU-11-P1`. The as-built
patch is limited to the existing synthetic test-demo graph, its canonical
documents, focused/unit/browser/performance tests, evidence verifier, exact 13
living baselines, and the ignored eight-file media package.

Required and implemented gates are:

1. normalize all ten explicit actor facts fail closed to `UNKNOWN`;
2. render collision-bounded camera-aware DOM labels with role/model/session/state,
   glyph, ring, keyboard activation, ten-field drawer, Escape close, and focus
   return in pixel and static modes;
3. run Channy's slow deterministic walk/stop/sniff/sit/eat/drink/sleep/play
   schedule with bounded easing and unchanged non-authority precedence;
4. use original Bedlington-specific code-native atlas/runtime drawing and the
   light-oak/ivory/sand/glass-blue/muted-charcoal palette;
5. update only all exact 13 living prototype baselines and prove the exact 26
   reconciled historical baselines byte-identical to `c535877`;
6. regenerate the exact WebM, MP4, GIF, and five PNGs from the running loopback
   prototype and directly inspect stills and representative changing frames;
7. pass focused bridge, lint, strict typecheck, full tests/builds/audit/naming,
   default/composed no-update trains, dedicated 20-case prototype train,
   accessibility/performance/lifecycle/security gates, and the exact verifier
   before stage, after stage, and after commit; and
8. leave media ignored, the runtime stopped, the branch upstream-equal, and all
   M1/authentication/authority/delivery/transport/DB/network boundaries intact.

The serial exit remains:

```text
AO12-PWU-11-P1 Worker patch
  -> AO12-PWU-11-R1 same-session Fable5 narrow visual/accessibility review
  -> AO12-PWU-11-D2 Leo/GPT decision on the exact patched candidate
```

Neither this patch nor its local gates grant visual acceptance, full integration,
production/live use, risk acceptance, closure, or another mission.
