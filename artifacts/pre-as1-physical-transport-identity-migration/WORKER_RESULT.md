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

## Patch 01 — F01/F02 authority fence (handoff `07_WORKER_PATCH_HANDOFF.md` + path fence `07A`)

Advisor validation of candidate `b523b5c` found two defects; both closed on top of it
(allowed files only: `exact-config.ts`, `exact-authority.ts`, the exact-delivery test).
The valid destination migration is preserved.

- **F01 — real registry row structurally validated.** `assertRegistry` no longer
  loose-substring-matches a fabricated `| Advisor |` row; it structurally parses the
  committed markdown and requires **exactly one** routable `| Agent Office Advisor |` row
  whose exact columns are `agent-office-advisor` / `$26` / `0` / `@26` / `0` / `%26` /
  `/home/leo/Project/agent-office` / `codex` (backtick-extracted; the command cell may
  carry trailing version text). Zero, duplicate, or malformed rows fail closed.
- **F02 — versioned current-destination authority fence.** Added a ninth authority
  snapshot `physicalMigrationDecision`, required to be the exact committed artifact
  `advisor/jobs/20260714_agent_office_pre_as1_physical_transport_identity_migration/01A_ACTIVE_REFERENCE_SCOPE_CLARIFICATION.md`
  (identical decision bytes at any other trusted-repository path fail closed — `07A`).
  `assertPhysicalMigrationDecision` requires the current destination plus the exact stable
  prohibition clauses (no active code may resolve/deliver/fall back to the historical
  destination; historical evidence is byte-for-byte non-routable and non-authoritative;
  the historical roleInstanceId is evidence-only and never a current destination/authority
  subject; no VibeNews/Slack/AS1/tmux change) — not mere legacy-token presence. The snapshot
  is folded into the capability authority hash. The activation descriptor schema is bumped
  `v1 -> v2`, so a legacy v1 descriptor / the historical activation chain alone fails closed.
  Active readiness-lease and Advisor-evidence path validation moved from the historical
  `20260711` activation job to the current `20260714` migration job.
- **Preserved:** the live two-preflight, one-use capability, single exact pane, kill switch,
  manual fallback, and journal fail-closed behavior are unchanged. No tmux input, no transport
  activation. No historical artifact modified. This patch changed only `exact-config.ts` +
  `exact-authority.ts` in source; `exact-transport.ts` / `decision-authority.ts` /
  `evidence-ingress.ts` / the config json were not touched.
- **Tests (all pass):** the real `| Agent Office Advisor |` row + v2 + migration-decision
  snapshot positive; and negatives — fabricated `| Advisor |`, duplicate, and malformed
  registry rows; legacy v1 descriptor; a snapshot set without the migration decision; a
  wrong/tampered migration decision; the migration decision at a different path; readiness/
  evidence paths under the old `20260711` job; and all historical destination fields
  `FORBIDDEN_TARGET`. `physicalMigrationDecision` added to the exact-snapshot-required set.
- **07B — real-artifact fence.** The committed `01A_ACTIVE_REFERENCE_SCOPE_CLARIFICATION.md`
  wraps three prohibition clauses across Markdown line breaks (`…or fall`↵`back to`,
  `byte-for-byte,`↵`non-routable`, `interpreted as a`↵`current physical destination`), so a
  one-space `includes()` check would have rejected the canonical artifact while a synthetic
  single-line fixture passed. `assertPhysicalMigrationDecision` now collapses only Unicode
  whitespace runs to one ASCII space before matching the prose clauses; destination tokens,
  clause punctuation, the exact `01A` path, the snapshot Git hash, and every `SourceArtifactRef`
  check stay byte-exact. The positive fixture was replaced with one that preserves the real
  mid-clause wrapping (it fails without the normalization). Negatives retained/added: opposite
  wording (permits fallback), partial wording (a clause truncated), wrong path, a tampered
  decision blob (bytes changed / snapshot hash unchanged → `AUTHORITY_ARTIFACT_INVALID`), and
  missing clauses — all fail closed.
- **Checks:** `tsc` 0 errors; exact-delivery suite **55/55**; eslint clean; `git diff --check`
  clean. Active-surface: the authority assert enforces prohibition **clauses**, so no
  historical physical-destination token remains in active `src`/`config`; remaining historical
  tokens are classified (1) org-registry evidence join key / (2) historical-only negative
  fixtures that cannot route.

RETURN_TO: Advisor
PROPOSED_NEXT_ACTOR: Advisor
