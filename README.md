# Agent Office

Agent Office is an Advisor-managed web control-plane project. The intended
product will project canonical mission state and support structured
Leo-to-Advisor communication while preserving strict actor boundaries.

This repository now contains the reviewed M01 design, Advisor-accepted Batch A/B,
and the implemented Batch C structured-event office scene. Batch C
code/config/tests/assets are at commit
`22baff7cf0d1cb6ccd41d1c9f810af37a53e1413` and remain pending Advisor
acceptance as the dependency for Batch D.

Implemented through Batch C:

- strict TypeScript contracts and state machines;
- exact approved 15-WorkUnit manifest import/fixture;
- append-only local JSONL event store and immutable artifacts;
- deterministic projections, checkpoints, restart, and corruption quarantine;
- trusted project/root registration and bounded no-follow manifest/artifact reads;
- fixed direct-argv, no-shell Git and structured exact-pane tmux observation;
- deterministic local freshness/restart and dashboard view-model projection;
- responsive React/Vite operations UI with exact Korean hierarchy/state labels,
  separate WorkUnit/gate progress, typed freshness/blocker detail, and read-only
  evidence copy;
- full-width office scene with eight stable stations, exact structured-event
  mapping, accepted-ID provenance/deduplication, safety precedence, bounded
  delivery/result/patch cues, stale fail-closed behavior, and no prose inference;
- local code-native actor/desk/document/barrier/tool/warning assets with pinned
  dimensions, ownership/license classification, and source SHA-256;
- explicit mobile pagination, reduced motion and visibility pause, keyboard/focus,
  text/icon/shape semantics, semantic status list, and polite/assertive live
  regions; and
- exact-pinned dependencies, license inventory, 27 Vitest files/122 passing
  tests, 10 passing Playwright Chromium tests, axe audits, and deterministic
  desktop/mobile/reduced-motion visual baselines.

The repository still contains no HTTP server or authority boundary, PWA/service
worker, SSE, Advisor Inbox, Advisor gateway, role dispatch, real
authentication/secret, database, remote collector, public/private network
exposure, deployment, backup/restore operation, or live runtime. The dashboard is
a local static build over deterministic approved/synthetic fixtures; it does not
claim live collection or completion.

## Verification

```text
npm ci
npm run test:unit
npm run test:property
npm run test:integration
npm run test:ui
npm run check
npm run audit:dependencies
npx playwright install chromium
npm run test:e2e
```

Tests use disposable local roots and deterministic fake tool adapters. A bounded
manual smoke check may read the registered local Git metadata and exact structured
tmux pane identity; it never reads pane prose or sends tmux input.

## Operating Boundary

- Agent Office Worker performs only explicitly approved repo-local design and
  implementation and returns every result to Advisor.
- Advisor routes work and audits evidence.
- Fable5 independently reviews work in a separate Reviewer session.
- Leo/GPT is the final approver and selects any next mission.
- The Batch B dashboard supports filtering, selection, native expansion, and
  evidence copy only. Batch C adds presentation-only scene fixture, station,
  pagination, and motion controls; none changes durable state or calls an adapter.
  Structured Advisor communication remains Batch D; the browser may never
  dispatch directly to Workers or Reviewers or provide arbitrary terminal
  execution.

The working branch is `shadow/agent-office-m01`. Public exposure, databases,
secrets, live/production access, protected-branch changes, force pushes, and
automatic mission progression are not authorized.

See `AGENTS.md`, `CLAUDE.md`, and `docs/agent/` before doing any work.
