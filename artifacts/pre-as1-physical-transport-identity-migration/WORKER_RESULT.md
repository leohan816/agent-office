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
  carry trailing version text). Zero and duplicate rows fail closed. **Correction (closed in
  Patch 02):** this initial extraction was start-anchored, so it still reduced a
  suffix-contaminated cell (e.g. `` `%26`JUNK ``) to its expected value and accepted a row
  truncated after the process column. The claim that "malformed rows fail closed" was therefore
  inaccurate at candidate `9a7e944`; the independent Sentinel flagged this (F01) and it is fixed
  in Patch 02 below.
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

## Patch 02 — Sentinel finding closure (handoff `09` + grammar fence `09A`)

The independent SOL Sentinel review (`08_SENTINEL_REVIEW_RESULT.md`, verdict `NEEDS_PATCH`)
found two defects in candidate `9a7e944`. Both are closed on top of it. Allowed files only:
`exact-authority.ts` and the exact-delivery test (plus these Worker evidence files).

- **F01 (HIGH) — malformed registry cells were accepted as exact authority.** The prior
  `assertRegistry` selected rows on `cells.length >= 11` and extracted each identity value with
  the start-anchored `/^`([^`]+)`/u`, which reduced suffix-contaminated cells (`` `%26`JUNK ``)
  to their expected value and accepted a row truncated after the process column. Rewritten to a
  true structural fence: select rows whose Actor label is exactly `Agent Office Advisor`, require
  **exactly one**, then require the **complete canonical 13-field shape** (leading/trailing table
  edges + eleven content columns, including non-empty role-evidence and dispatch-status cells) and
  validate every identity/location/index cell as a **byte-exact whole cell** — `` `agent-office-advisor` ``
  / `` `$26` `` / `0` / `` `@26` `` / `0` / `` `%26` `` / `` `/home/leo/Project/agent-office` ``.
- **F01 process-cell grammar fence (`09A`).** The process cell must be exactly `` `codex` `` or that
  command followed by the **complete current canonical observation-annotation grammar**, end-anchored:
  `` `codex` v<numeric semver>; live launch record identifies `<model>` / `<effort>` at this observation ``.
  The interim `; \S.*` shape was too permissive (arbitrary text after the semicolon); it is replaced
  by `` /^`codex` v\d+\.\d+\.\d+; live launch record identifies `[^`]+` \/ `[^`]+` at this observation$/u ``.
  It rejects `` `codex`JUNK ``, arbitrary text after the version, and any appended/reordered text.
- **F02 (LOW) — stale legacy pane token in a test title.** The integration title `paste-to-%9` (whose
  assertions already require `%26`) was renamed to `paste-to-%26`.
- **Tests.** The positive path now uses the **actual current canonical Advisor row** verbatim from the
  committed `SESSION_REGISTRY.md` (including the real process annotation with embedded `` `gpt-5.6-sol` ``
  / `` `max` `` tokens). New negatives (each isolates one defect against a valid base): suffix
  contamination on session / sessionId / windowId / paneId / workspace cells; suffix contamination on
  the `codex` command token; a permissive-but-non-canonical annotation (`; arbitrary trailing…`, which
  passes the old `; \S.*` shape); appended text after the full annotation; a row truncated after the
  process column; a row with an unexpected extra structural column. The prior fabricated-label,
  duplicate-row, and wrong-pane (`%99`) negatives are retained; positive re-validation still resolves.
- **Corrected classification (F02 completeness).** Targeted legacy physical-target search over the
  changed surface: active `src` (`exact-authority.ts`) contains **no** historical physical-destination
  token (the registry fence now hard-codes only the current destination). In the changed test:
  `foundation-advisor/$9/@9/%9//home/leo/Project/foundation-advisor` appears only in (2) the
  intentional legacy-rejection negative asserted `FORBIDDEN_TARGET` and in the migration-decision
  fixture that *prohibits* those references; `foundation-docs` is (1) the authority/role-storage
  **repository** identifier in the canonical registry row and the `SourceArtifactRef` repository field,
  not a physical transport destination. No unclassified active legacy token remains.
- **Checks:** `tsc` 0 errors; exact-delivery focused suite **55/55** (4 files); eslint clean on the two
  changed paths; `git diff --check` from `9a7e944` clean. No tmux input; no Slack/AS1/transport
  activation; no historical-artifact or governance change. Same independent Sentinel delta re-review is
  required before any activation.

### Patch 02 — Git state, checks, and result contract (evidence correction `09B`)

- **Source candidate commit:** `1a4e1e98a0ea07c3f383da3761792298cd807f29`.
- **Ancestry:** patch base `9a7e9444208b613752dc4ab42e23b3cc70cc1516` and mission baseline
  `88c6cbd757ed205eb1aadd68d8ea7629865d5765` are both ancestors of the source candidate.
- **Exact four changed paths in the source candidate** (`git diff --name-only 9a7e944 1a4e1e9`):
  - `src/adapters/gateways/tmux-advisor/exact-authority.ts`
  - `tests/integration/exact-advisor-delivery.test.ts`
  - `artifacts/pre-as1-physical-transport-identity-migration/WORKER_RESULT.md`
  - `artifacts/pre-as1-physical-transport-identity-migration/WORKER_RESULT_POINTER.txt`
- **Checks already obtained (not rerun under this evidence-only correction):** `tsc --noEmit -p
  tsconfig.json` — 0 errors; exact-delivery focused suite — 55/55 across 4 files (`exact-advisor-delivery`,
  `decision-authority-evidence`, `advisor-inbox`, `advisor-message-crash-consistency`); ESLint — clean on
  the two changed TypeScript/test paths; `git diff --check` from `9a7e944` — clean.
- **Failed commands for Patch 02:** none.
- **Git state at the source candidate:** the four paths above were staged; there were no other staged,
  unstaged, or untracked entries (the temporary `node_modules` validation symlink was removed before
  commit); the worktree was clean after commit; the branch
  `config/pre-as1-physical-transport-identity-migration-001` was non-force fast-forward pushed
  (`9a7e944..1a4e1e9`), and HEAD equalled its configured upstream.
- **Durable result path:** `artifacts/pre-as1-physical-transport-identity-migration/WORKER_RESULT.md`.
  **Pointer path:** `artifacts/pre-as1-physical-transport-identity-migration/WORKER_RESULT_POINTER.txt`.
- **`FOUNDATION_DOCS_COMMIT`: not applicable** — the Advisor owns governance/foundation-docs; this Worker
  changed no foundation-docs or governance content.
- **This evidence-only amendment (`09B`):** updates only the two result files above; it introduces no
  source, test, configuration, governance, or historical-evidence change and reruns no tests. It is a
  separate two-file, non-force-pushed commit on the same branch; its commit hash is returned to the
  Advisor in the pane result and is deliberately not self-referenced in these files.
- **Boundaries / STOP (unchanged):** no tmux input; no Slack/AS1/transport activation; no
  DB/schema/secret/environment/PII/runtime/public/production access; no protected-branch or `main`
  merge/push; no force push; no agent/sub-agent/delegation, browser dispatch, or arbitrary terminal
  execution; no self-review; no next-mission inference. The same independent Sentinel delta re-review of
  `9a7e944..1a4e1e9` remains required before any activation.

RETURN_TO: Advisor
PROPOSED_NEXT_ACTOR: Advisor
