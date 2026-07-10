# Agent Office

Agent Office is an Advisor-managed web control-plane project. The intended
product will project canonical mission state and support structured
Leo-to-Advisor communication while preserving strict actor boundaries.

This repository now contains the reviewed M01 design, the Advisor-accepted Batch
A local domain/store/projection core, and the implemented Batch B read-only local
observation boundary plus base operations dashboard. Batch B code/config/tests are
at commit `85e66d856e33a0df73041cb4b33aba30a8f9f96d` and remain pending Advisor
acceptance as the dependency for Batch C.

Implemented through Batch B:

- strict TypeScript contracts and state machines;
- exact approved 15-WorkUnit manifest import/fixture;
- append-only local JSONL event store and immutable artifacts;
- deterministic projections, checkpoints, restart, and corruption quarantine;
- trusted project/root registration and bounded no-follow manifest/artifact reads;
- fixed direct-argv, no-shell Git and structured exact-pane tmux observation;
- deterministic local freshness/restart and dashboard view-model projection;
- responsive React/Vite operations UI with exact Korean hierarchy/state labels,
  separate WorkUnit/gate progress, typed freshness/blocker detail, and read-only
  evidence copy; and
- exact pinned dependencies, license inventory, 23 test files, and 84 passing
  tests.

The repository still contains no HTTP server or authority boundary, PWA/service
worker, SSE, Advisor Inbox, Advisor gateway, role dispatch, office animation,
real authentication/secret, database, remote collector, public/private network
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
  evidence copy only. Future structured Advisor communication remains Batch D;
  the browser may never dispatch directly to Workers or Reviewers or provide
  arbitrary terminal execution.

The working branch is `shadow/agent-office-m01`. Public exposure, databases,
secrets, live/production access, protected-branch changes, force pushes, and
automatic mission progression are not authorized.

See `AGENTS.md`, `CLAUDE.md`, and `docs/agent/` before doing any work.
