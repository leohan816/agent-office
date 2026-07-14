# Pre-AS1 Physical Transport Identity Migration — Worker Result

## Identity

- Mission: `AGENT_OFFICE_PRE_AS1_PHYSICAL_TRANSPORT_IDENTITY_MIGRATION_001`
- Actor: **Agent Office Worker**, existing session `agent-office-opus`, model Opus
  4.8 (1M context), effort Ultracode, skill `/fable-builder`.
- Isolated worktree:
  `/home/leo/Project/.worktrees/agent-office/AGENT_OFFICE_PRE_AS1_PHYSICAL_TRANSPORT_IDENTITY_MIGRATION_001`
- Branch: `config/pre-as1-physical-transport-identity-migration-001`; baseline
  `88c6cbd757ed205eb1aadd68d8ea7629865d5765` (verified ancestor/HEAD; handoff blob
  `0116a471`/clarification file hashes verified before editing).
- Applied scope clarification `01A_ACTIVE_REFERENCE_SCOPE_CLARIFICATION.md`.

## Change

Rebind every **active** delivery/routing/preflight/allowlist/session/workspace/
fallback reference in the exact-delivery stack from the historical physical
destination to the verified current one:

```text
historical  foundation-advisor / $9 / @9 / %9 / /home/leo/Project/foundation-advisor / codex
current     agent-office-advisor / $26 / @26 / %26 / /home/leo/Project/agent-office / codex
authority subject:  foundation-advisor -> agent-office-advisor
```

`windowIndex`/`paneIndex` (0/0) and `currentCommand` (`codex`) are unchanged. The
session/subject name (`agent-office-advisor`) and the workspace path
(`/home/leo/Project/agent-office`) are distinct and were migrated separately.

## Exact changed files (7; all within the allowlist)

- `src/adapters/gateways/tmux-advisor/exact-config.ts` — `ExactAdvisorDestination`
  literal type, `parseDestination` accepted values, and `issuerSubjectId` on the
  readiness lease migrated to the current identity.
- `src/adapters/gateways/tmux-advisor/exact-authority.ts` — `assertRegistry` now
  requires the current `| Advisor | agent-office-advisor | $26 | @26 | %26 |
  /home/leo/Project/agent-office | codex |` row and returns `@26`.
- `src/adapters/gateways/tmux-advisor/exact-transport.ts` — tmux command targets
  (`display-message`/`paste-buffer`/`send-keys`), the `target` literal type and
  const, the journal-target parser, and the live preflight destination validator
  migrated to `%26` / current pane.
- `src/adapters/observations/artifacts/decision-authority.ts` — the Advisor
  `authoritySubjectId` check migrated to `agent-office-advisor`.
- `src/application/advisor-inbox/evidence-ingress.ts` — Advisor
  `authoritySubjectId`/`advisorSubjectId`/actor `subjectId` checks and the exact
  evidence-destination validator migrated to the current identity.
- `config/agent-office.exact-delivery.disabled.example.json` — `fixedDestination`
  migrated to the current identity (still `DISABLED_TEMPLATE_ONLY`; parsers still
  reject this example schema).
- `tests/integration/exact-advisor-delivery.test.ts` — all 27 fixture/assertion
  identity sites migrated to the current destination/subject; added an explicit
  legacy-rejection negative (below).

## Versioning choice

Narrowest current-version contract: **no schema-version string was bumped.** The
fail-closed destination/subject checks (`parseDestination`, `assertRegistry`, the
preflight validator, and the subject validators) reject the historical identity
by value, so a historical v1 artifact (foundation destination/subject) cannot
parse as current — it does not "look current." A version bump was therefore
unnecessary to fence legacy material; rejection-by-value is the fence. Historical
artifacts are non-routable because they fail the current active checks.

## Historical preservation proof

- No historical evidence/job artifact was modified. Only the 7 files above
  changed; `git diff 88c6cbd -- src/application/organization/ advisor/` is empty.
- The organization `evidence.ts` and `registry.ts` are byte-for-byte untouched
  (verified). The immutable `roleInstanceId: foundation-advisor` evidence join key
  for the continuing Actor remains only as an evidence/organization key, never as
  a physical destination or authority subject.

## Active-surface classification (targeted search)

Physical-destination tokens (`$9`/`%9`/`@9`/`/home/leo/Project/foundation-advisor`)
are **absent from all active `src` and `config`.** Remaining legacy tokens are
classified:

1. **Immutable historical evidence / organization key** (unchanged, not a physical
   destination; forbidden-to-touch files): `src/application/organization/registry.ts`
   and `evidence.ts` (`roleInstanceId`/`actorId`/route + evidence join
   `foundation-advisor`); `src/runtime/projection.ts` station→`roleInstanceId` map.
2. **Explicit historical-only fixture that cannot route** (asserted rejected):
   `tests/integration/exact-advisor-delivery.test.ts` legacy-rejection negative
   (historical destination → `FORBIDDEN_TARGET`); `src/ui/pixel/fixtures/prototype-projection.ts`
   synthetic prototype `sessionName` (visual prototype, not transport; not in scope).
3. **Defects to remove:** none found.

## Current-target negative tests

- Migrated wrong-target negatives (`paneId '%5'`, `windowId '@10'`, `workspace
  '/tmp'`, unexpected `browserTarget`/`target` keys) now reject against the current
  pane.
- Added: "rejects the historical foundation-advisor physical destination as
  FORBIDDEN_TARGET (legacy is non-routable)" — feeds the full historical
  destination and each historical field (`sessionName`/`sessionId`/`paneId`/
  `workspace`) and asserts `FORBIDDEN_TARGET`.

## Commands / checks

- `tsc --noEmit -p tsconfig.json` — clean (0 errors), before and after the test
  edits.
- Focused `vitest run` of the exact-delivery suites — **53/53 passed**
  (`exact-advisor-delivery` 42, `decision-authority-evidence`, `advisor-inbox`,
  `advisor-message-crash-consistency`): exact config/authority/preflight,
  legacy-rejection, ACK/intake/decision-authority lineage, idempotency, and
  wrong-target negatives.
- `eslint` over the 6 changed source/test files — clean (exit 0).
- `git diff --check` — clean.
- The full `runtime-composition` integration test was **not run**: the production
  organization composition boundary is unchanged (exact-delivery stays DISABLED),
  and it carries the known isolated-worktree `foundation-docs` sibling limitation;
  it is not among this mission's named focused checks.
- Node dependencies were provided for validation via a temporary untracked
  (gitignored, since-removed) `node_modules` symlink to the main checkout's
  identical-lockfile modules; no tracked file was affected.

## Security / boundary status

- No actual tmux input sent; no Slack/AS1/transport activation, connection,
  server start, capability/lease/activation issuance, destination selection,
  wildcard/broadcast, shell interpolation, or authority expansion.
- No database, schema/migration, secret, remote, production, or dependency change.
- No historical artifact modification; no VibeNews or organization registry-row
  change; no merge, `main` push, or force push.
- No agent/sub-agent/substitute-Worker/Reviewer dispatch; no self-review.

## Git state

- Base `88c6cbd` is an ancestor; changed files = the 7 authorized paths + these
  result artifacts. Commit + non-force push of this isolated branch only.

## Known limitations / residual risk

- Independent security review is mandatory (per the Advisor brief) because the
  target and authority subject are security-sensitive; this Worker report is
  evidence for review, not a review.
- The migration is a DISABLED, fail-closed identity rebind; no live delivery was
  exercised (no tmux input). Live activation remains a separate, later gate.

RETURN_TO: Advisor
PROPOSED_NEXT_ACTOR: Advisor
