# Advisor Scope Clarification 01

MISSION_ID: `AGENT_OFFICE_PRE_AS1_MACHINE_REGISTRY_BINDING_RECONCILIATION_001`

STATUS: `AUTHORIZED_BOUNDED_DEPENDENCY_FIXTURE_DELTA`

TypeScript typecheck directly proved that the required
`OrganizationRegistryRow.actorId` field reaches two existing UI test fixture
builders that construct this exact schema:

- `tests/ui/actor-detail-drawer.test.tsx`
- `tests/ui/actor-summary.test.tsx`

These two files are added to the handoff allowlist solely for the minimum
mechanical fixture update needed to provide a valid `actorId`. Preserve every
test's existing UI behavior, assertions, snapshots, and product semantics.

Requirements:

- Keep `actorId` required in `OrganizationRegistryRow`; do not make it optional
  to avoid updating a typed fixture.
- In each affected local row helper, default `actorId` consistently from that
  fixture row's immutable `roleInstanceId`, while preserving explicit override
  support if the helper already accepts row overrides.
- Do not change UI source, assertions, snapshots, rendering behavior, labels,
  layout, accessibility behavior, or test expectations.
- Run TypeScript typecheck again after the fixture-only updates.
- Do not run the broad UI suite. A focused execution of only these two test
  files is authorized if needed to prove the fixture update is behavior-neutral.
- No other file is added to scope by this clarification.

All original handoff boundaries remain active. Continue the same Worker run,
record the initial typecheck failure and this exact correction, and STOP after
the original result contract is complete.
