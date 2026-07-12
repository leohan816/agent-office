# Agent Office M1.2 Pixi Public-Export Compatibility Bridge

Status: `CANDIDATE_PROTOTYPE_ONLY_PUBLIC_EXPORT_COMPATIBILITY_BRIDGE__PENDING_CLEAN_FABLE5_LEVEL3_DESIGN_PASS__IMPLEMENTATION_PAUSED_NOT_AUTHORIZED__FULL_INTEGRATION_DEFERRED_WITH_GATE`

Decision date: `2026-07-12`

Design-delta base: `9611d0da1479ca5e7a9677641fe767a6b39b4a38`

Binding Leo/GPT decision:
`APPROVE_OPTION_A_PROTOTYPE_ONLY_PUBLIC_EXPORT_COMPATIBILITY_BRIDGE`

This document is a technical design delta for the isolated synthetic
living-pixel-office prototype. It does not authorize implementation. A clean
Fable5 Level-3 design `PASS` for this exact delta and a later exact Advisor
implementation handoff are both required before any source, test, package,
lockfile, configuration, baseline, media, ignore-file, or feature-index change.

The bridge is not an authenticated renderer, a production renderer, or a
general Pixi typing policy. Full authenticated integration remains
`DEFERRED_WITH_GATE`. Nothing here changes M1 authority, authentication,
Advisor delivery, transport, persistence, network, presentation truth, or the
DOM-static and M1 fixed-station fallbacks.

## 1. Problem and bounded decision

The prepared prototype exercised the intended visual direction and demonstrated
a bounded runtime path, but its current TypeScript workaround is not acceptable
for publication. With the repository compiler and strictness settings, the
public Pixi declaration
graph produces 52 vendor diagnostics involving WebGPU/DOM declarations,
pointer events, and bitmap-font exact-optional types. The prepared prototype
therefore has six `@ts-expect-error` directives paired with six relative
`node_modules` or package-internal imports across four files:

```text
src/ui/pixel/facility-sprites.tsx
src/ui/pixel/pixel-world-scene.tsx
src/ui/pixel/renderer-boundary.tsx
src/ui/pixel/world-clock.tsx
```

Those imports bypass public package exports and the suppressions can hide
future application defects. They must be removed, not normalized or expanded.
The selected correction is one prototype-local runtime bridge whose JavaScript
uses public package roots while one adjacent declaration file describes only
the runtime values and call shapes the prepared prototype actually consumes.

The following alternatives remain prohibited:

- a relative `node_modules` import or any package-internal/deep import;
- `@ts-expect-error`, `@ts-ignore`, or another diagnostic suppression;
- `skipLibCheck: true`, a TypeScript downgrade, or relaxed strictness;
- an ambient wildcard module, global declaration override, or vendor type
  shadowing;
- a broad `any`, unbounded namespace facade, or re-export of a vendor type
  graph; and
- a package version change, fork, patch, override, or replacement renderer.

## 2. Preserved toolchain and package invariants

The compatibility design preserves these exact repository facts:

| Boundary | Required value | Bridge consequence |
|---|---:|---|
| TypeScript | `6.0.3` | No downgrade, alternate compiler, or per-file compiler escape |
| `skipLibCheck` | `false` globally | Repository type checking remains strict; the local contract is application-owned rather than a vendor declaration mutation |
| `exactOptionalPropertyTypes` | `true` | Every optional bridge property is intentional and exact |
| `noUncheckedIndexedAccess` | `true` | The contract does not weaken indexed access |
| React / React DOM | `19.2.7` | The bridge uses only the public `react` package root for its small host wrappers |
| `pixi.js` | `8.19.0` | Public root only; runtime `VERSION` must equal `8.19.0` |
| `@pixi/react` | `8.0.5` | Public root only; installed manifest and lock identity must equal `8.0.5` |

The exact five approved runtime dependencies remain `@pixi/react`,
`lucide-react`, `pixi.js`, `react`, and `react-dom`. The bridge adds none. It
does not authorize a package or lockfile rewrite, and it does not make the
prepared dependency changes publishable by itself.

## 3. Verified public-root runtime surface

The installed public export maps and public root modules provide every runtime
value used by the prepared prototype:

| Public package root | Exact runtime values | Prototype use |
|---|---|---|
| `@pixi/react` | `Application`, `extend`, `useTick` | Application lifecycle, explicit catalogue registration, fixed-step hook |
| `pixi.js` | `Container`, `Graphics`, `Sprite`, `Texture`, `VERSION` | Registered host objects, canvas-backed texture creation/destruction, runtime version identity |
| `react` | `createElement`, `forwardRef` | Typed local wrappers for the three registered Pixi host elements |

`AnimatedSprite` is not part of this bridge. Although it appears in the broader
renderer design, the prepared prototype does not call it. No unused Pixi value
may be added on speculation.

The `@pixi/react` public root is a browser/bundler runtime boundary. A direct
bare-Node ESM import is not accepted as identity evidence because the installed
module's extensionless internal `react-reconciler` specifier is rejected by
Node's native loader. This does not authorize a deep import. The public root is
instead exercised through the same Vite browser build and Playwright runtime as
the prototype. Static contract tests separately verify public-root source
imports and exact installed/locked package identities.

## 4. Exact bridge topology and import direction

The proposed future files are exactly:

```text
src/ui/pixel/pixi-public-export-bridge.js
src/ui/pixel/pixi-public-export-bridge.d.ts
tests/ui/pixi-public-export-bridge.test.ts
```

The dependency direction is one way:

```text
prepared pixel TS/TSX files
  -> ./pixi-public-export-bridge.js
       -> @pixi/react        (public package root)
       -> pixi.js            (public package root)
       -> react              (public package root)

TypeScript compiler
  -> pixi-public-export-bridge.d.ts
       -> type-only react public declarations
       -> type-only ./contracts.js application/container ports
       -X-> no Pixi vendor declaration import
```

The `.js` module is the only executable prototype module allowed to import Pixi
packages. The adjacent `.d.ts` file is the only TypeScript view of that module.
It must not import from `@pixi/react` or `pixi.js`, augment JSX globals, declare
either vendor module, or expose an escape hatch for arbitrary constructors,
props, callbacks, or texture sources.

At module initialization the runtime bridge:

1. reads the named values from the three public roots;
2. validates the exact expected value/call shapes and PixiJS `VERSION`;
3. calls `extend` once with exactly `Container`, `Graphics`, and `Sprite`;
4. creates typed local wrappers for `pixiContainer`, `pixiGraphics`, and
   `pixiSprite`, forwarding refs only for Container and Graphics; and
5. exports only the bounded application component, wrappers, tick hook, texture
   factory, and frozen identity record defined below.

The bridge must not expose raw vendor namespaces or a generic `extend` function.
Registration is internal so later prototype code cannot enlarge the catalogue
without a reviewed contract change.

The initialization checks are exact: `Application` must be a non-null React
component value; `extend`, `useTick`, `createElement`, and `forwardRef` must be
functions; `Container`, `Graphics`, and `Sprite` must be constructor functions;
`Texture.from` must be a function; and `VERSION` must be the string `8.19.0`.
No truthiness-only namespace check is sufficient.

## 5. Exact local declaration contract

The declaration file exposes this semantic surface and no more. Names below are
binding; implementation syntax may vary only where it preserves these exact
shapes.

The normative declaration skeleton is:

```ts
import type {
  ComponentType,
  ForwardRefExoticComponent,
  ReactNode,
  RefAttributes,
} from 'react';
import type {
  PixelApplicationPort,
  PixelContainerPort,
} from './contracts.js';

export interface PixelApplicationRefPort {
  getApplication(): PixelApplicationPort | null;
  getCanvas(): HTMLCanvasElement | null;
}

export interface PixelApplicationProps {
  readonly children: ReactNode;
  readonly antialias: boolean;
  readonly autoDensity: boolean;
  readonly autoStart: boolean;
  readonly backgroundColor: number;
  readonly className: string;
  readonly preference: 'canvas' | readonly ['webgl', 'canvas'];
  readonly resizeTo: { readonly current: HTMLDivElement | null };
  readonly resolution: number;
  readonly sharedTicker: boolean;
  readonly onInit: (application: PixelApplicationPort) => void;
}

export interface PixelBridgeGraphicsPort {
  clear(): PixelBridgeGraphicsPort;
  rect(x: number, y: number, width: number, height: number): PixelBridgeGraphicsPort;
  roundRect(x: number, y: number, width: number, height: number, radius: number): PixelBridgeGraphicsPort;
  ellipse(x: number, y: number, radiusX: number, radiusY: number): PixelBridgeGraphicsPort;
  circle(x: number, y: number, radius: number): PixelBridgeGraphicsPort;
  moveTo(x: number, y: number): PixelBridgeGraphicsPort;
  lineTo(x: number, y: number): PixelBridgeGraphicsPort;
  fill(style: number | { readonly color: number; readonly alpha?: number }): PixelBridgeGraphicsPort;
  stroke(style: { readonly color: number; readonly width: number; readonly alpha?: number }): PixelBridgeGraphicsPort;
}

export interface PixelTexturePort {
  readonly source: { scaleMode: string };
  destroy(destroySource?: boolean): void;
}

export interface PixelTickPort {
  readonly deltaMS: number;
}

export interface PixelTickOptions {
  readonly callback: (ticker: PixelTickPort) => void;
  readonly isEnabled: boolean;
}

export interface PixelContainerProps {
  readonly children?: ReactNode;
}

export interface PixelGraphicsProps {
  readonly draw: (graphics: PixelBridgeGraphicsPort) => void;
}

export interface PixelSpriteProps {
  readonly roundPixels: boolean;
  readonly texture: PixelTexturePort;
}

export interface PixelPublicExportRuntime {
  readonly contractId: 'agent-office.pixi-public-export-bridge.v1';
  readonly expectedPixiReactVersion: '8.0.5';
  readonly expectedPixiJsVersion: '8.19.0';
  readonly actualPixiJsVersion: '8.19.0';
  readonly valueNames: readonly [
    'Application', 'extend', 'useTick', 'Container',
    'Graphics', 'Sprite', 'Texture', 'VERSION',
  ];
}

export const PixelApplication: ForwardRefExoticComponent<
  PixelApplicationProps & RefAttributes<PixelApplicationRefPort>
>;
export const PixelContainer: ForwardRefExoticComponent<
  PixelContainerProps & RefAttributes<PixelContainerPort>
>;
export const PixelGraphics: ForwardRefExoticComponent<
  PixelGraphicsProps & RefAttributes<PixelBridgeGraphicsPort>
>;
export const PixelSprite: ComponentType<PixelSpriteProps>;
export const PIXEL_PUBLIC_EXPORT_RUNTIME: PixelPublicExportRuntime;
export function createPixelTexture(source: HTMLCanvasElement): PixelTexturePort;
export function usePixelTick(options: PixelTickOptions): void;
```

### 5.1 Application lifecycle

`PixelApplication` is a ref-forwarding React element with:

- required `children: ReactNode`;
- required booleans `antialias`, `autoDensity`, `autoStart`, and
  `sharedTicker`;
- required `backgroundColor: number`, `className: string`, and
  `resolution: number`;
- required `preference: 'canvas' | readonly ['webgl', 'canvas']`;
- required `resizeTo: { readonly current: HTMLDivElement | null }`; and
- required `onInit: (application: PixelApplicationPort) => void`.

Its ref exposes exactly:

```text
getApplication(): PixelApplicationPort | null
getCanvas(): HTMLCanvasElement | null
```

`PixelApplicationPort` remains the application-owned contract from
`src/ui/pixel/contracts.ts`: canvas identity, ticker start/stop plus `maxFPS` and
`minFPS`, and renderer constructor-name inspection. The compatibility contract
does not add vendor lifecycle methods.

### 5.2 Registered host elements

The runtime exports three React components:

| Export | Exact props/ref |
|---|---|
| `PixelContainer` | optional `children: ReactNode`; ref is `PixelContainerPort` |
| `PixelGraphics` | required `draw: (graphics: PixelBridgeGraphicsPort) => void`; ref is `PixelBridgeGraphicsPort` |
| `PixelSprite` | required `roundPixels: boolean`; required `texture: PixelTexturePort`; no ref |

`PixelContainerPort` remains limited to `position.set(x, y)` and
`scale.set(scale)`. The declaration owns a narrower
`PixelBridgeGraphicsPort`, limited to the exact chainable prototype drawing
calls: `clear`, `rect`, `roundRect`, `ellipse`, `circle`, `moveTo`, `lineTo`,
`fill`, and `stroke`. `fill` accepts a numeric color or
`{ color: number; alpha?: number }`; `stroke` accepts
`{ color: number; width: number; alpha?: number }`. The unused optional
`cacheAsTexture` and `updateCacheTexture` members in the prepared pure drawing
port are deliberately absent from the bridge. Structural compatibility lets the
existing draw functions consume the narrower runtime value without exposing
those speculative calls. No vendor graphics type is re-exported.

### 5.3 Texture and ticker calls

`createPixelTexture(source: HTMLCanvasElement): PixelTexturePort` is the only
texture constructor surface. `PixelTexturePort` exposes exactly mutable
`source.scaleMode: string` and `destroy(destroySource?: boolean): void`.

`usePixelTick` accepts exactly:

```text
{
  readonly callback: (ticker: { readonly deltaMS: number }) => void;
  readonly isEnabled: boolean;
}
```

It returns `void`. The callback and `onInit`/`draw` functions above are the only
vendor-adjacent callbacks in the contract.

### 5.4 Runtime identity record

The frozen `PIXEL_PUBLIC_EXPORT_RUNTIME` record contains:

- contract ID `agent-office.pixi-public-export-bridge.v1`;
- expected `@pixi/react` version `8.0.5`;
- expected PixiJS version `8.19.0`;
- the actual public-root PixiJS `VERSION`; and
- the exact value-name list `Application,extend,useTick,Container,Graphics,Sprite,Texture,VERSION`.

The expected `@pixi/react` string is not treated as self-authenticating. The
contract regression must match it against both the installed package manifest
and lockfile. Browser success proves that the public-root runtime values used by
the bridge are callable; source and package checks prove their origin and exact
package identity.

## 6. Ownership and fail-closed behavior

The bridge adapts types and registration only. Ownership does not move:

| Resource | Owner | Required release |
|---|---|---|
| Pixi application/canvas | existing renderer boundary and `@pixi/react` application lifecycle | stop ticker; React unmount removes/destroys application resources |
| Private ticker | existing renderer boundary/world clock | stop on pause, fallback, error, context loss, and unmount |
| Container and Graphics handles | Pixi React reconciler; observed only through refs | refs clear on unmount; application teardown owns objects |
| Canvas-backed facility texture | `FacilitySprites` | deferred `destroy(true)` remains symmetric under StrictMode |
| Resize/context/visibility listeners | existing renderer boundary registry | exact existing cleanup and zero-resource assertions |

Missing or malformed `Application`, `extend`, `useTick`, `Container`,
`Graphics`, `Sprite`, `Texture.from`, React wrapper primitives, or a PixiJS
version other than `8.19.0` throws a bridge-specific compatibility error before
the canvas becomes authoritative presentation. A lazy-chunk rejection keeps or
selects the complete DOM-static/M1 path. A later call or lifecycle failure is
caught by the existing renderer boundary and selects the same fallback. The
bridge cannot retry indefinitely, retain a stale canvas, downgrade a backend,
or silently widen its contract.

Call-boundary validation is equally narrow. Before forwarding `onInit`, the
wrapper requires the exact canvas, ticker `start`/`stop`/rate fields, and renderer
constructor-name port. Container and Graphics refs are validated for the exact
declared methods before reaching prototype callbacks. The texture factory
requires `source.scaleMode` and `destroy`; the tick adapter requires a finite
numeric `deltaMS`. A validation exception must exercise and prove the existing
DOM-static/M1 fallback in browser tests. If that propagation cannot be proven,
implementation stops rather than adding a global error handler or widening the
bridge API.

## 7. Required implementation regressions

A later implementation handoff must require all of these gates without updating
existing snapshots or weakening an existing assertion:

1. **Root-only source contract:** the bridge imports Pixi only from literal
   `@pixi/react` and `pixi.js`; all other prototype source imports Pixi only via
   `./pixi-public-export-bridge.js`.
2. **No escape hatch:** no prototype source contains a relative `node_modules`
   path, Pixi package subpath, `@ts-expect-error`, or `@ts-ignore`.
3. **Exact declaration surface:** an explicit expected export/property/callback
   manifest equals the adjacent declaration; no `any`, wildcard module,
   augmentation, global override, index signature, or vendor type import exists.
4. **Runtime and version identity:** the bridge assertions execute in the Vite
   browser build; PixiJS reports `8.19.0`; installed manifests and lock entries
   report `pixi.js@8.19.0` and `@pixi/react@8.0.5`; the exact identity-name list
   matches the contract.
5. **Compiler invariant:** TypeScript remains `6.0.3`, `skipLibCheck` remains
   `false`, and the repository typecheck succeeds without Pixi suppression.
6. **Dependency invariant:** `tests/acceptance/batch-gates.test.ts` changes only
   its exact runtime dependency expectation from the approved original three
   (`lucide-react`, `react`, `react-dom`) to the approved five
   (`@pixi/react`, `lucide-react`, `pixi.js`, `react`, `react-dom`).
7. **Behavior and cleanup:** focused frame, layout, camera, atlas, animation,
   semantic-parity, renderer-lifecycle, production-boundary, and performance
   tests remain green, including StrictMode and zero retained resources.
8. **Browser/static evidence:** the configured prototype Playwright train proves
   public-root startup, WebGL/Canvas behavior, DOM-static fallback,
   accessibility, deterministic screenshots, and recording behavior.
9. **Build and media evidence:** production/test-demo bundle boundaries, media
   verification, all existing baseline bytes, and ignored/untracked media
   evidence remain exact.
10. **Full regression:** lint, typecheck, the complete sequential test suite,
    core/dashboard/test-demo builds, and every security/authority boundary gate
    from the reviewed prototype plan remain required.

The focused contract test may inspect package manifests and source text in
Node, but it must not execute the public `@pixi/react` root with the bare Node
ESM loader. Runtime execution belongs to the actual Vite/browser boundary.

## 8. Proposed future implementation allowlist

This is a proposal for a later exact handoff, not current mutation authority.

**Existing prepared files requiring import/suppression cleanup:**

```text
src/ui/pixel/facility-sprites.tsx
src/ui/pixel/pixel-world-scene.tsx
src/ui/pixel/renderer-boundary.tsx
src/ui/pixel/world-clock.tsx
```

Their behavioral logic must remain unchanged; only the local bridge imports and
names necessary to consume the bounded contract are proposed.

**Exact new bridge/declaration/test files:**

```text
src/ui/pixel/pixi-public-export-bridge.js
src/ui/pixel/pixi-public-export-bridge.d.ts
tests/ui/pixi-public-export-bridge.test.ts
```

**One newly proposed legacy test path:**

```text
tests/acceptance/batch-gates.test.ts
```

No other existing source, test, package, lockfile, configuration, snapshot,
baseline, media, asset, script, feature-index, ignore, authority, auth,
transport, database, network, or production-runtime path is in this proposed
allowlist. The already prepared prototype changes remain separate uncommitted
work and are neither approved nor published by this design delta.

## 9. Promotion and retirement gates

This bridge cannot enter authenticated or production composition by file move,
import reuse, or an interpretation of prototype review. Promotion requires all
of the following in a new mission:

1. fresh public-root compatibility and exact-version evidence;
2. explicit canonical architecture and implementation-plan updates;
3. security, authority, accessibility, lifecycle, bundle, and rollback review;
4. a clean independent design/review verdict for the promoted boundary;
5. explicit Leo/GPT production/integration authority; and
6. an exact Advisor handoff naming files, base, tests, and push authority.

If a future pinned upstream release compiles cleanly under the preserved
compiler settings, removing the local declaration facade is an additive,
separately reviewed migration. Tests must first prove semantic, lifecycle,
runtime-identity, and fallback parity. The bridge contract may not drift or be
silently replaced merely because upstream declarations changed.

## 10. STOP conditions

Stop and return to Advisor if implementation would require a broad type, vendor
declaration import, deep import, suppression, compiler/strictness change,
dependency change, another existing file, runtime behavior redesign, production
mount, authenticated input, authority/auth/transport/DB/network change, or
failure weakening. Also stop if either public package root cannot provide the
bounded runtime values through the actual Vite/browser boundary or if the
static/M1 fallback is not complete before bridge initialization.

## 11. Canonical companions

- Renderer architecture and lifecycle:
  [`AGENT_OFFICE_M1_2_LIVING_PIXEL_OFFICE_RENDERER_DESIGN.md`](AGENT_OFFICE_M1_2_LIVING_PIXEL_OFFICE_RENDERER_DESIGN.md).
- Hard-gated implementation sequence:
  [`../operations/AGENT_OFFICE_M1_2_LIVING_PIXEL_OFFICE_IMPLEMENTATION_PLAN.md`](../operations/AGENT_OFFICE_M1_2_LIVING_PIXEL_OFFICE_IMPLEMENTATION_PLAN.md).
- Sprite and animation system:
  [`../ui/AGENT_OFFICE_M1_2_PIXEL_WORLD_SPRITE_ANIMATION_SYSTEM.md`](../ui/AGENT_OFFICE_M1_2_PIXEL_WORLD_SPRITE_ANIMATION_SYSTEM.md).
