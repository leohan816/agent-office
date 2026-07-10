# Agent Office

Agent Office is an Advisor-managed web control-plane project. The intended
product will project canonical mission state and support structured
Leo-to-Advisor communication while preserving strict actor boundaries.

This repository now contains the reviewed M01 design and the Batch A local
domain/store/projection core. Batch A is implemented at code commit
`7edc8f79bedb059ab6697e64ddaf57fbebde2c87` and is pending Advisor acceptance.
It does not include the browser product or authorize Batch B.

Implemented Batch A scope:

- strict TypeScript contracts and state machines;
- exact approved 15-WorkUnit manifest import/fixture;
- append-only local JSONL event store and immutable artifacts;
- deterministic projections, checkpoints, restart, and corruption quarantine;
- zero runtime dependencies and a pinned development lockfile; and
- 15 required test files with 36 passing tests.

The repository still contains no UI, web server, PWA, Git/tmux adapter, Advisor
gateway, animation, real authentication/secret, database, public/private network
exposure, deployment, backup/restore operation, or live runtime.

## Batch A Verification

```text
npm ci
npm run test:unit
npm run test:property
npm run test:integration
npm run check
npm run audit:dependencies
```

Tests use disposable local state roots and synthetic evidence only.

## Operating Boundary

- Agent Office Worker performs only explicitly approved repo-local design and
  implementation and returns every result to Advisor.
- Advisor routes work and audits evidence.
- Fable5 independently reviews work in a separate Reviewer session.
- Leo/GPT is the final approver and selects any next mission.
- The future browser surface may send structured communication to Advisor; it
  may not dispatch directly to Workers or Reviewers and may not provide arbitrary
  terminal execution.

The working branch is `shadow/agent-office-m01`. Public exposure, databases,
secrets, live/production access, protected-branch changes, force pushes, and
automatic mission progression are not authorized.

See `AGENTS.md`, `CLAUDE.md`, and `docs/agent/` before doing any work.
