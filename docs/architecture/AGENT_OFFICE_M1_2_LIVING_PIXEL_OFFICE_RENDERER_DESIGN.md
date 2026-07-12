# Agent Office M1.2 Living Pixel-Office Renderer Design

Status: `DESIGNED_LIVING_PIXEL_OFFICE_PRIMARY_RENDERER_CANDIDATE__PENDING_CLEAN_FABLE5_LEVEL3_DESIGN_PASS__NO_PROTOTYPE_OR_RUNTIME_IMPLEMENTATION_AUTHORIZED`

Decision date: `2026-07-12`

Design base: `48c8dbd9f2c5ecea68c28e85137d75db595ef5f9`

Design WorkUnits: `AO12-PWU-01..05`

Review gate: `AO12-PWU-06`

This document supersedes the DOM/SVG/CSS dashboard as the intended primary
M1.2 product experience. It does not remove or reinterpret the reviewed M1.2
projection, cue reducer, Single Advisor Team invariant, security boundary, or
rollback behavior. The existing DOM spatial dashboard remains the required
semantic/static detail surface, and the unchanged M1 fixed-station scene remains
the final compatibility fallback.

No package, source, configuration, test, asset, server, authority, transport,
authentication, database, or network change is authorized by this design.

## 1. Binding product decision and inheritance

Leo/GPT classified the existing M1.2 technical foundation as complete but the
visual product experience as not accepted. The required correction is an
original, cute, living, warm-retro pixel or pixel-inspired office world. The
primary viewport must look and behave like one spatial office world, not like
dashboard cards rearranged inside a canvas.

The following reviewed foundations remain binding:

- [`AGENT_OFFICE_M1_2_SPATIAL_OFFICE_MASTER_DESIGN.md`](AGENT_OFFICE_M1_2_SPATIAL_OFFICE_MASTER_DESIGN.md);
- [`../contracts/AGENT_OFFICE_M1_2_SPATIAL_EVENT_ANIMATION_CONTRACT.md`](../contracts/AGENT_OFFICE_M1_2_SPATIAL_EVENT_ANIMATION_CONTRACT.md);
- [`../ui/AGENT_OFFICE_M1_2_CHARACTER_PROJECT_IDENTITY_SYSTEM.md`](../ui/AGENT_OFFICE_M1_2_CHARACTER_PROJECT_IDENTITY_SYSTEM.md);
- [`../security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md`](../security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md);
- [`../operations/AGENT_OFFICE_OPERATIONS_RECOVERY.md`](../operations/AGENT_OFFICE_OPERATIONS_RECOVERY.md); and
- the current authenticated `agent-office.spatial-office-projection.v1` and
  `agent-office.authenticated-spatial-presentation.v1` read models.

The pixel renderer consumes presentation data. It cannot append an event,
acknowledge evidence, dispatch a role, call an adapter, infer activity, create
authority, or alter a WorkUnit. Camera position, zoom, animation frame, path,
sprite, prop, pose, and Channy behavior are browser-local presentation only.

## 2. Current repository evidence

The design decision is based on the actual repository at the design base:

| Evidence | Current fact | Consequence |
|---|---|---|
| `package.json` and `package-lock.json` | React and React DOM are exactly `19.2.7`; `pixi.js` and `@pixi/react` are absent | The candidate adds two new runtime dependencies only in a later authorized prototype |
| `src/ui/runtime/entry.tsx` | Production mounts React under `StrictMode` | Renderer setup and cleanup must survive the development setup-cleanup-setup cycle |
| `vite.config.ts` | Production and `test-demo` use separate virtual entries; Vite binds dev/preview to `127.0.0.1` | The prototype can remain a synthetic test-demo-only route without entering the production graph |
| `src/ui/spatial/spatial-office.tsx` | Authenticated and synthetic inputs are explicit; the current floor is DOM/SVG/CSS | The projection boundary is reusable, while the current renderer becomes fallback/detail evidence |
| `src/ui/spatial/cue-projector.ts` and `cue-reducer.ts` | Accepted-event mapping, precedence, deduplication, live-delta-only cues, and bounded queues already exist | The pixel world must consume their output and must not create a second event interpretation |
| `src/ui/spatial/compatibility.ts` | `FULL`, `RESTRAINED`, `STATIC`, and `M1_FIXED_STATIONS` are fail-closed presentation choices | The pixel selector is additive and must retain immediate DOM-static and M1 selection |
| `src/ui/spatial/assets/placeholder-characters.tsx` | Original code-native SVG placeholders exist with a license/hash inventory | They remain fallback evidence; they are not sprite atlases or accepted final visual direction |
| `src/pwa/cache-policy.ts`, `public/sw.js`, and `src/server/http/static-shell.ts` | Hashed same-origin script/style/image assets are cacheable; protected API data is never cached | The renderer must be a hashed lazy chunk with local assets and no remote fetch |
| `playwright.config.ts` | Chromium, UTC, `ko-KR`, one worker, and a configured local font/runtime are deterministic test inputs | New baselines must use the same explicit runtime and must not claim cross-runtime pixel identity |
| `.gitignore` | The required prototype artifact root is not currently ignored | A later prototype must add and prove the exact ignore rule before producing media |
| Local tool check on 2026-07-12 | `ffmpeg`, `gifski`, ImageMagick `convert`, and `magick` are unavailable on PATH | Prototype media conversion is fail-closed until an exact later handoff supplies or authorizes a local converter |

## 3. Direct official-library evidence

The following primary documentation was checked on `2026-07-12`. Versions are
recommendations for a later prototype, not installed state.

| Source | Direct evidence used by this decision |
|---|---|
| [React `useEffect`](https://react.dev/reference/react/useEffect) and [StrictMode](https://react.dev/reference/react/StrictMode) | Effects run cleanup before changed setup and once more in development Strict Mode; renderer lifecycle must be symmetric and idempotent |
| [React `useLayoutEffect`](https://react.dev/reference/react/useLayoutEffect) | Layout effects run only on the client and can block paint; the world must initialize asynchronously behind an already-visible semantic fallback |
| [`@pixi/react` getting started](https://react.pixijs.io/getting-started/) | Version 8 supports React 19 and PixiJS 8 and is a thin JSX wrapper over PixiJS |
| [`@pixi/react` package](https://www.npmjs.com/package/%40pixi/react) | Current stable evidence is `8.0.5`, with React 19 and PixiJS 8 support |
| [`@pixi/react` `Application`](https://react.pixijs.io/components/application/) | The component accepts PixiJS application options and a React ref for `resizeTo` |
| [`@pixi/react` `extend`](https://react.pixijs.io/extend/) | Only explicitly registered Pixi classes enter the JSX catalogue, supporting a bounded import surface |
| [`@pixi/react` `useTick`](https://react.pixijs.io/hooks/useTick/) | Ticker callbacks must be memoized or they can be removed and re-added on rerenders |
| [PixiJS package](https://www.npmjs.com/package/pixi.js) | Current stable PixiJS 8 evidence is `8.19.0` |
| [PixiJS `Application`](https://pixijs.com/8.x/guides/components/application) | Initialization is asynchronous; application options cover renderer preference, private/shared ticker, resize, density, and texture garbage collection |
| [PixiJS ticker plugin](https://pixijs.com/8.x/guides/components/application/ticker-plugin) | A private ticker provides deterministic ordering and can be started and stopped explicitly |
| [PixiJS v8.19 update](https://pixijs.com/blog/june-2026) | Renderer preference arrays can constrain the fallback chain; Canvas fallback exists but still requires product-subset parity proof |
| [PixiJS accessibility](https://pixijs.com/8.x/guides/components/accessibility) | Pixi accessibility is opt-in and creates positioned DOM overlays over the canvas |
| [PixiJS textures](https://pixijs.com/8.x/guides/components/textures) and [AnimatedSprite](https://pixijs.download/release/docs/scene.AnimatedSprite.html) | Sprite sheets share texture sources; `AnimatedSprite` can disable automatic updates and use explicit frames |
| [PixiJS performance tips](https://pixijs.com/8.x/guides/concepts/performance-tips) | Sprite sheets, small texture counts, bounded scene complexity, and avoiding per-frame text/graphics rebuilds are preferred |
| [PixiJS application cleanup](https://pixijs.download/v8.18.0/docs/app.html) | Application teardown must remove the canvas and destroy children and texture sources |
| [MDN `webglcontextlost`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event), [Canvas `contextlost`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/contextlost_event), and [`getContext`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext) | Contexts can be absent or lost; loss is observable and must select fallback rather than preserve stale animation |
| [MDN `ResizeObserver`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver) | Element-size observation is the correct responsive input; the observer must be disconnected on teardown |
| [Vite features](https://vite.dev/guide/features) | Dynamic imports create lazy chunks and imported static assets receive hashed URLs |
| [Playwright videos](https://playwright.dev/docs/videos) and [screencast release](https://playwright.dev/docs/release-notes#version-159) | Browser video is written only after recording/context close; precise start/stop recording is available in the installed Playwright line |

The official PixiJS renderer guide and the later 8.16-8.19 release notes do not
provide a basis for treating Canvas parity as universal. This design therefore
uses WebGL as the preferred backend, Canvas only for the tested core subset, and
the DOM/M1 path for every unsupported or failed case.

## 4. Technology evaluation and selection

### 4.1 Candidate A - React 19 plus `@pixi/react` 8 and PixiJS 8

**Selected primary candidate.** The later prototype should pin exactly:

```text
react: already 19.2.7
react-dom: already 19.2.7
@pixi/react: 8.0.5
pixi.js: 8.19.0
```

Reasons for selection:

- the official wrapper explicitly supports the repository's React major and
  PixiJS 8;
- JSX components can mirror the stable world hierarchy while a pure frame model
  keeps operational truth outside the renderer;
- `extend` permits a small explicit catalogue (`Container`, `Sprite`,
  `AnimatedSprite`, and only the Graphics primitives proven necessary);
- React owns selection, HUD, drawer, error boundary, and semantic mirror while
  Pixi owns only the visual scene graph;
- the private application ticker can be controlled by one world-clock component;
  no React state update is allowed on each animation frame; and
- a lazy import can exclude Pixi and every prototype fixture from the eager M1
  shell and production entry until a later authorized integration.

Prototype proof is mandatory because support claims do not prove this
repository's StrictMode teardown, Canvas parity, bundle budget, context-loss
behavior, or deterministic baselines.

### 4.2 Candidate B - direct imperative PixiJS 8 under React

**Rejected as the primary candidate.** A React effect could construct
`Application`, await `init`, append the canvas, reconcile a custom scene graph,
own resize/ticker/listeners, and call `destroy` on cleanup. That gives explicit
startup and teardown control and avoids an additional reconciler.

It is not selected because Agent Office would also need to implement and test
its own React-to-Pixi identity reconciliation, prop diffing, child destruction,
texture ownership, and error propagation. That duplicates work already provided
by the official React integration and increases the chance that the Pixi world
and React HUD diverge. Direct imperative integration is not an automatic runtime
fallback. If the prototype finds a blocking `@pixi/react` defect, work stops for
a reviewed design correction rather than silently switching architectures.

### 4.3 Candidate C - DOM/SVG/CSS-only continuation

**Rejected as the primary visual experience; preserved as a mandatory
fallback/detail layer.** It provides excellent semantics, 200-percent text,
forced-colors behavior, and deterministic component tests, but the current
result is visibly an evidence dashboard, not a living pixel-office world. It
cannot satisfy the Founder direction merely by adding more cards, gradients, or
CSS hover effects.

The existing DOM surface remains valuable and binding for:

- the complete semantic Team, mission, actor, state, progress, blocker, alert,
  evidence, and route log;
- the detailed drawer/popover;
- keyboard and screen-reader interaction;
- reduced-motion, forced-colors, 200-percent text, unsupported-renderer, and
  context-loss presentation; and
- the unchanged M1 fixed-station fallback.

## 5. Selected renderer topology

```text
AuthenticatedSpatialPresentation / explicit synthetic prototype fixture
  -> existing validation, cue projector, and cue reducer
  -> LivingOfficeFrameProjector (pure, no Pixi/React/DOM imports)
       -> immutable LivingOfficeFrameModel
            + worldLayout
            + actorVisuals
            + channyVisual
            + cueVisuals
            + conciseHud
            + semanticFacts
            + sourceRevision/sourceEventIds
  -> LivingOfficeViewportBoundary (React)
       -> RendererCapabilitySelector
       -> lazy PixelWorldChunk
            -> @pixi/react Application
            -> PixelWorldScene
            -> one private FixedStepWorldClock
       -> LivingOfficeHud (DOM, always present)
       -> LivingOfficeSemanticMirror (DOM, always present)
       -> LivingOfficeDetailDrawer (DOM, on demand)
       -> existing SpatialOffice DOM static fallback
       -> unchanged M1 OfficeScene fallback
```

`LivingOfficeFrameModel` is the only renderer input. Pixi and DOM do not run
separate activity, assignment, freshness, precedence, or identity projection.
Every frame carries `projectionRevision`, a deterministic `frameKey`, the exact
visible entity IDs, and the accepted cue IDs that produced a transient visual.
The semantic mirror asserts the same `frameKey` and entity set as the canvas.
Failure to establish correspondence selects DOM static presentation.

The Pixi canvas is decorative for accessibility purposes and has
`aria-hidden="true"`. All operational controls are real DOM buttons, links,
lists, headings, dialogs, and live regions. The opt-in Pixi accessibility module
is not imported: camera-aligned overlay elements would duplicate the semantic
mirror, couple focus to zoom/pan, and create another divergence surface. A later
proposal to use it requires a separate reviewed reason and cannot replace the
DOM mirror.

## 6. Office-world coordinate system and shared floor

### 6.1 Logical coordinates

- One logical pixel is the smallest authored unit.
- One floor tile is `16 x 16` logical pixels.
- Sprites use integer logical positions and nearest-neighbor texture sampling.
- Actor base slots are `32 x 48`; Channy is `48 x 40`; route documents and props
  use fixed atlas slots.
- Renderer resolution is clamped to `1..2`; camera transforms and final sprite
  positions are rounded to device pixels.
- Visual baselines fix viewport, device scale factor, locale, timezone, theme,
  projection fixture, frame time, camera state, and renderer backend.

No world coordinate enters an authority, event, assignment, cue ID, evidence
hash, or progress calculation.

### 6.2 Deterministic one-floor layout

Every registered Advisor Team Pod coexists on one bounded floor. Pods are sorted
by stable `projectId`, then placed into a four-column deterministic grid. A Pod
cell is `18 x 12` tiles. The floor grows by complete rows; selection never
reorders or relocates a Pod.

```text
outer wall and north signs
  -> shared facility band, 10 tiles deep
       glass meeting room | Advisor hubs | Reviewer booth | coffee lounge
       Channy bed/food/water | Leo/GPT decision destination
  -> east-west main walkway, 3 tiles deep
  -> Pod grid, four deterministic columns
       Pod sign, desks/computers, concise board, work/testing/result zones
  -> south service walkway and evidence/detail anchors
```

Floor bounds are calculated from tile constants and Pod count, never from label
width or activity. The minimum full-office world is `80 x 48` tiles; additional
rows extend height. Walls, doors, glass partitions, desks, computers, floor
patterns, signs, and props are visual collision tiles. Walkways and route anchors
form a separate versioned navigation graph.

The shared facility band contains one distinct global Advisor Hub character per
exact Advisor `roleInstanceId`; Pods reference the responsible Advisor and never
clone that character. The Reviewer booth is visually separate from Worker desks.
Channy is one global non-actor. A registered Pod with unverified mission evidence
keeps its room/sign but shows a static `NO_VERIFIED_MISSION` state.

### 6.3 Path and occupancy rules

- Navigation nodes are tile-center coordinates in a committed walkability map.
- A deterministic A* implementation uses Manhattan distance and tie-breaks by
  `y`, then `x`, then stable route-anchor ID.
- A route is computed only after the existing cue projector resolves exact
  semantic endpoints.
- No endpoint, no unique path, hidden target, stale/conflicting source, or actor
  conflict produces movement; it produces the existing static route row.
- At most one canonical actor and one document prop participate in a route.
- A selected Team enables full route presentation; non-selected Teams retain
  current static poses and concise state.
- Actor location after a cue is derived from the current frame model. Animation
  completion cannot persist or invent a new location.

## 7. Camera and navigation contract

Camera state is browser-local and contains only `centerX`, `centerY`, `zoom`,
`mode`, and the selected presentation target. It is never written to the event
store or authenticated projection.

### 7.1 Desktop and tablet

- Pointer drag and trackpad pan operate only inside floor bounds.
- Wheel/pinch zoom is clamped to the supported range `0.5..3.0` and normalized
  to one of the tested steps `0.5`, `0.75`, `1`, `1.5`, `2`, or `3`.
- `Focus selected Team` centers the exact selected Pod without moving it.
- `Full office` computes a fit view with one-tile safe padding.
- `Zoom in`, `Zoom out`, four pan buttons, `Focus selected Team`, and
  `Full office` are DOM controls with at least `44 x 44` CSS-pixel targets.
- A keyboard-focused camera control accepts Arrow keys for bounded pan,
  `+`/`-` for zoom, `Home` for full office, and `Enter` for selected-Team focus.
- Camera changes do not announce operational activity. The live region announces
  only the selected Team and the resulting view mode.

### 7.2 Mobile

Below `768px`, the primary visual shows one Pod region at a time rather than an
unreadable miniature floor. Previous/next Team controls, a labelled Team picker,
`Full office overview`, and the semantic Pod list expose every Team. Full-office
overview is a non-interactive fit image/state, while the focused Pod supports
bounded pan and the tested zoom steps `1` and `2`.

### 7.3 Focus restoration and resize

- Selecting a Team leaves focus on its selector.
- Opening detail moves focus to the drawer heading or first meaningful control;
  closing restores the exact invoker.
- Full-office return leaves focus on the `Full office` button.
- `ResizeObserver` recomputes the camera viewport, preserves selected-Team focus
  when possible, clamps bounds, and never replays a cue.
- Orientation change cancels interpolation, renders the current deterministic
  frame at recomputed bounds, marks any in-flight visual complete/seen, and does
  not move DOM focus.

## 8. Renderer lifecycle and ownership

### 8.1 Startup state machine

```text
DOM_FALLBACK_READY
  -> PIXEL_CHUNK_LOADING
  -> PIXI_INITIALIZING
  -> ATLAS_VALIDATING
  -> PIXEL_READY_WEBGL | PIXEL_READY_CANVAS

any failure
  -> DOM_STATIC_SELECTED
  -> M1_FIXED_STATIONS if the spatial projection itself is absent/invalid
```

The DOM semantic/static surface renders first. The Pixi chunk is imported only
when the projection is valid, the user has not requested static presentation,
and the environment exposes a canvas capability. There is no blank loading
screen. A failed import, initialization, asset validation, or first render keeps
the already-visible DOM result.

WebGL is preferred. PixiJS 8.19 may try the constrained preference chain
`['webgl', 'canvas']`. Canvas is accepted only if prototype parity tests pass for
sprites, nearest scaling, alpha, masks actually used by the office, screenshots,
and teardown. WebGPU is not selected in this version. If both supported backends
fail, the session remains DOM static; there is no retry loop.

### 8.2 Resize and density

The React wrapper passes its exact viewport element to `Application.resizeTo`.
One `ResizeObserver` owns camera reflow. `autoDensity` is enabled, antialiasing is
disabled, the background is opaque, and resolution is clamped. CSS determines
the viewport size; Pixi never writes surrounding dashboard layout dimensions.
Zero width/height pauses rendering until a positive observed size exists.

### 8.3 Ticker ownership

- `sharedTicker=false`; no global ticker is used.
- Exactly one memoized `FixedStepWorldClock` callback is registered.
- The clock advances a `1000/30ms` fixed simulation step with a maximum of two
  catch-up steps; excess wall-clock delta is dropped, never used as mission
  evidence.
- `AnimatedSprite.autoUpdate=false`; the frame projector chooses every sprite
  frame from the fixed world time.
- The ticker stops for hidden tabs, reduced motion, static mode, context loss,
  logout, expiry, revocation, projection invalidation, and unmount.
- Resume takes a verified full snapshot, marks current cue IDs seen, renders a
  static current frame, and does not replay elapsed movement.

Prototype recording uses a scripted clock. Production presentation may use the
private real-time clock, but the same fixture plus the same logical time must
always produce the same world frame.

### 8.4 Context loss and capability failure

On `webglcontextlost` or Canvas `contextlost`:

1. prevent new Pixi work and stop the ticker;
2. cancel routes and ambient motion without retaining them for replay;
3. expose `RENDERER_CONTEXT_LOST` in the DOM status surface;
4. select the DOM static equivalent immediately; and
5. clear Pixi-only camera interpolation and transient resources.

One bounded reinitialization may occur after a matching restore event and a new
verified full projection. It starts from the current static state with all
current source IDs seen. A second loss, failed restore, or mismatched projection
keeps DOM static for the browser session. Tests use `WEBGL_lose_context` where
available and an injected renderer-fault port for Canvas/initialization failures.

### 8.5 Teardown

React cleanup must, in order:

1. mark initialization aborted so a late promise cannot append a canvas;
2. stop the private ticker and remove its one callback;
3. disconnect `ResizeObserver` and remove visibility, orientation, pointer,
   keyboard, and context listeners;
4. cancel pointer capture, routes, timers, and scripted clocks;
5. unmount the Pixi React tree;
6. unload the living-office asset bundle; and
7. destroy the Pixi application with canvas removal, children, textures, and
   texture sources enabled.

StrictMode setup-cleanup-setup must leave exactly one canvas, one ticker callback,
one observer, and one listener set. Logout, expiry, revocation, runtime stop, and
M1 fallback execute the same cleanup path.

## 9. HUD, detail, and semantic architecture

The world carries only concise information:

- global renderer/backend/freshness and fallback state;
- selected Team and project sign;
- mission short label, current actor, state, exact WorkUnit progress, and gate
  progress;
- one blocker or `WAITING_LEO` banner when applicable; and
- a Leo-alert badge that opens the existing alert detail.

Detailed Team, mission, actor, evidence, alert, Inbox, decision, source,
timestamp, hash, and pointer facts remain in a DOM drawer/popover/detail view.
They are never painted as dense text over the world. Raw paths, pane/session
locators, credentials, terminal content, and private transport details remain
absent.

The always-mounted DOM semantic mirror provides:

- Team navigation and exact selected state;
- one ordered list of every visible actor and zone;
- exact state/activity/freshness/assignment text;
- an origin-to-destination route log;
- blocker, alert, decision, evidence, and progress facts;
- polite selection/activity announcements and one bounded assertive critical
  alert announcement; and
- links/buttons into the existing detail surfaces.

Canvas signs, colors, clothing, props, and poses are redundant visual cues. No
essential meaning is available only from a pixel, animation, path, sound, hover,
or camera position.

## 10. Accessibility and presentation modes

| Condition | Visual world | Semantic result |
|---|---|---|
| `PIXEL_FULL` | WebGL/accepted Canvas, camera, bounded routes and microcycles | Full DOM mirror and drawer remain present |
| `PIXEL_RESTRAINED` | One cue, no neutral actor ambient, lower frame cap | Same DOM facts and controls |
| `DOM_STATIC` | Existing M1.2 DOM/SVG/CSS floor, no Pixi ticker | Complete semantic/static equivalent |
| `M1_FIXED_STATIONS` | Unchanged M1 office scene | Existing M1 semantics and two-station mobile pagination |

`prefers-reduced-motion`, the in-app motion-off control, forced-colors when the
pixel palette cannot remain clear, unsupported canvas, failed context, and a
measured performance miss select `DOM_STATIC`. A user may choose static mode at
any time. Static selection is immediate and cannot wait for animation
completion.

Keyboard, screen-reader, 200-percent text, high contrast, 320px, touch target,
orientation, and focus requirements remain those of the current master design.
At 200-percent text, the DOM HUD reflows outside the canvas and no essential
label is clipped. In forced colors, the DOM mirror and M1 fallback carry full
meaning even if the decorative canvas is hidden.

## 11. SSR, PWA, bundle, and asset-loading implications

The current product is a client-rendered loopback PWA, not an SSR application.
Pixi imports must remain inside the browser-only lazy chunk. If a future server
renders markup, it renders only the DOM semantic/static shell; effects do not
run server-side and hydration cannot depend on canvas pixels.

The eager production shell must not import Pixi. Vite dynamic import creates a
hashed renderer chunk. Code-native atlas source and any committed local image
are bundled as same-origin hashed assets; no CDN, remote URL, runtime asset
registry, user-supplied SVG, or external font is allowed. Offline behavior is:

- before the pixel chunk has ever been cached, an offline import failure selects
  DOM static/M1;
- after a successful same-origin load, the existing service worker may cache the
  hashed chunk/assets under a reviewed cache-version bump; and
- protected projections, events, evidence, messages, alerts, and API responses
  remain `no-store` and never enter the pixel asset cache.

The prototype must report eager-entry and lazy-renderer gzip deltas separately.
Tree shaking and `extend` are strategies, not evidence of a passing budget.

## 12. Security and authority non-change

- Canvas pointer input may change only camera, selection, or detail-open state.
- Every operational action remains in existing authenticated DOM surfaces and
  existing capability checks; the pixel world adds none.
- The renderer imports no observation adapter, process runner, filesystem,
  gateway, tmux, Hermes, HTTP mutation, event store, credential, or shell code.
- A route animation is not delivery. A document sprite is not receipt,
  acknowledgement, review, decision, approval, or completion.
- Channy is never a target, actor, notification channel, or authority source.
- Synthetic prototype fixtures stay reachable only from the explicit loopback
  test-demo entry and must be absent from the fresh production bundle.
- Project identity never establishes trust, and camera proximity never assigns
  an actor or Advisor.

## 13. Performance budgets and degradation

The prototype and later integration must measure, not assume, these gates on the
configured Chromium runtime:

| Measure | Hard gate |
|---|---:|
| Eager production entry growth from design base | `<= 12 KiB` gzip JavaScript |
| Lazy Pixi/React/world chunk | `<= 300 KiB` gzip JavaScript |
| Code-native atlas and local image payload | `<= 256 KiB` compressed total |
| Cached renderer startup to first complete frame, p95 | `<= 500ms` |
| Cold loopback startup under 4x CPU throttle, p95 | `<= 1500ms` |
| Pure frame projection, p95 | `<= 8ms` |
| Active-frame main-thread work, p95 | `<= 8ms` |
| Camera input to committed frame, p95 | `<= 50ms` desktop; `<= 100ms` constrained |
| Long tasks over 50ms in the scripted 10-second scene | `0` |
| Display objects at 12 Pods / 64 actors / 200 WorkUnits | `<= 1600` |
| Texture sources | `<= 4`; estimated GPU allocation `<= 32 MiB` |
| Retained heap after 20 focus cycles and teardown | `<= 25 MiB` growth |
| Retained canvases/tickers/observers/listeners after teardown | `0` |

A frame, startup, or memory miss selects `PIXEL_RESTRAINED` or `DOM_STATIC` and
blocks production selection until reviewed. It cannot remove semantics, hide a
critical state, reduce source validation, or raise an entity/cue cap.

## 14. Required visual acceptance matrix

All fixtures are explicit synthetic prototype facts until `AO12-PWU-12` maps the
same scenes from authenticated projection evidence. A screenshot freezes the
scripted clock at the named checkpoint; a recording segment must show continuous
movement into and out of that checkpoint.

| ID | Viewport | State fixture and evidence source | Expected visible content | Required proof |
|---|---|---|---|---|
| `PIXEL-V01` | `1440x900`, DPR 1 | `prototype.full-office.v1`, synthetic registered Teams, clock `0ms` | Complete bounded floor, all Pods, walls/floor/desks/computers, glass room, lounge, walkways, Advisor hubs, Reviewer booth, signs, concise boards, Channy facilities | `full-office.png`; opening recording segment |
| `PIXEL-V02` | `1440x900`, DPR 1 | `prototype.foundation-active.v1`, accepted synthetic `WORKING` cue, clock `4500ms` | Foundation Team focused; exact Worker at desk, typing microcycle, project clothing/sign/prop/glyph/pattern, concise mission/progress HUD | `team-activity.png`; continuous typing segment |
| `PIXEL-V03` | `1440x900`, DPR 1 | `prototype.vibenews-active.v1`, accepted synthetic `WORKING` cue, clock `7500ms` | VibeNews Pod focused while Foundation remains spatially present; distinct text/glyph/pattern/clothing identity and current state | Recording segment plus deterministic screenshot retained by test |
| `PIXEL-V04` | `1440x900`, DPR 1 | `prototype.advisor-handoff.v1`, accepted synthetic `DELIVERY`, clock `10500ms` | One Advisor character and one document traverse the resolved walkway to exact Worker; no clone; route log mirrors origin/destination | Recording segment and GIF segment |
| `PIXEL-V05` | `1440x900`, DPR 1 | `prototype.reviewer-active.v1`, accepted synthetic `REVIEW`, clock `13500ms` | Fable5 at separate Reviewer booth with review frames, exact label and no Worker co-location/approval claim | Recording segment and deterministic screenshot retained by test |
| `PIXEL-V06` | `1440x900`, DPR 1 | `prototype.lounge-idle.v1`, verified synthetic `IDLE`, clock `16000ms` | One verified-idle actor at coffee lounge, no work prop; complete DOM `VERIFIED_IDLE` meaning | `lounge.png`; recording segment |
| `PIXEL-V07` | `1440x900`, DPR 1 | `prototype.channy-roam.v1`, neutral synthetic ambient, clock `18000ms` | One Channy walking on a valid path; bed/food/water visible; non-actor label in DOM | `channy.png`; recording and GIF segment |
| `PIXEL-V08` | `1440x900`, DPR 1 | `prototype.channy-eat.v1`, neutral synthetic ambient, clock `20000ms` | Channy at food bowl using eat frames; no alert, command, or mission implication | Recording segment and deterministic screenshot retained by test |
| `PIXEL-V09` | `1440x900`, DPR 1 | `prototype.channy-sleep.v1`, neutral synthetic ambient, clock `22000ms` | Channy at bed using sleep frames; primary Team status remains independently visible | Recording segment and deterministic screenshot retained by test |
| `PIXEL-V10` | `1440x900`, DPR 1 | `prototype.waiting-leo.v1`, accepted synthetic `WAITING_LEO`, clock `23500ms` | Decision document route/status, persistent HUD/banner, static-equivalent route row; no decision claim | Deterministic screenshot and recording segment |
| `PIXEL-V11` | `1440x900`, DPR 1 | `prototype.blocked.v1`, accepted synthetic `BLOCKED`, clock `25000ms` | Immediate blocker barrier/banner/reason/owner; task and ambient motion suppressed; Channy reaction static | Deterministic screenshot and closing recording state |
| `PIXEL-V12` | `390x844`, DPR 1 | `prototype.mobile-foundation.v1`, selected Foundation Pod | One readable focused Pod, Team previous/next/full-office controls, concise HUD, openable DOM detail; no tiny full-floor text or overlap | `mobile.png` |
| `PIXEL-V13` | `1440x900`, DPR 1, reduced motion | Same accepted source set as V04/V10/V11 at frozen current state | Existing DOM static floor or static pixel frame, exact text/icon/shape/route log, zero ticker/translation/replay | Reduced-motion screenshot and zero-motion trace |

The five named PNG delivery files cover V01, V02, V06, V07, and V12. The other
matrix frames remain deterministic Playwright baseline evidence. The 20-to-30
second recording must cover all ten Founder scene classes: full office, actor
walking, Worker typing, Advisor handoff, Reviewer activity, idle lounge, Channy
roam/eat/sleep, project identity, camera focus/zoom/full return, and the
secondary DOM technical panels. Channy's three poses are one Founder scene class
but three independently testable acceptance rows.

## 15. Verification and review gates

The later prototype must prove:

- the world is a continuous office, not DOM cards rendered into a canvas;
- the exact `@pixi/react` lifecycle, private ticker, resize, StrictMode cleanup,
  WebGL/Canvas capability, context-loss, and dynamic-import fallbacks;
- one frame model drives Pixi and DOM with no divergent inference;
- all Teams, actor uniqueness, Advisor uniqueness, project identity, cue
  precedence, stale/conflict suppression, deduplication, and no replay;
- all actor and Channy atlas states in the companion sprite contract;
- keyboard, screen reader, 200-percent text, forced colors, reduced motion,
  mobile, focus restoration, and static/M1 equivalence;
- exact bundle/frame/startup/object/texture/memory/teardown budgets;
- all thirteen visual rows and the required live media package; and
- zero production-bundle fixture markers and no authority/transport mutation.

Only a clean Fable5 Level-3 design `PASS` may authorize the bounded prototype
`AO12-PWU-07..10`. `PASS_WITH_RISK`, `NEEDS_PATCH`, or `FAIL` does not. Even a
clean prototype review cannot authorize full integration: `AO12-PWU-12` remains
blocked until the explicit Leo/GPT `AO12-PWU-11` visual-direction decision.

## 16. Companion canonical documents

- Sprite, atlas, actor, Channy, and animation contract:
  [`../ui/AGENT_OFFICE_M1_2_PIXEL_WORLD_SPRITE_ANIMATION_SYSTEM.md`](../ui/AGENT_OFFICE_M1_2_PIXEL_WORLD_SPRITE_ANIMATION_SYSTEM.md).
- Hard-gated prototype and integration plan:
  [`../operations/AGENT_OFFICE_M1_2_LIVING_PIXEL_OFFICE_IMPLEMENTATION_PLAN.md`](../operations/AGENT_OFFICE_M1_2_LIVING_PIXEL_OFFICE_IMPLEMENTATION_PLAN.md).
- Product and authority inheritance:
  [`AGENT_OFFICE_M1_2_SPATIAL_OFFICE_MASTER_DESIGN.md`](AGENT_OFFICE_M1_2_SPATIAL_OFFICE_MASTER_DESIGN.md).
- Discoverability and current status: [`../FEATURE_INDEX.md`](../FEATURE_INDEX.md).
