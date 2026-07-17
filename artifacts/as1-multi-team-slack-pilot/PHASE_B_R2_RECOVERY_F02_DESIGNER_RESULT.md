# AS1 Phase B R2 Recovery F02 Designer Result

MISSION_ID: AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_PILOT_001

WORK_UNIT: PHASE_B_R2_RECOVERY_F02_FIXED_ORIGINAL_ROOT_PRESERVATION_DESIGN

ACTOR: agent-office-designer

ROLE: Agent Office Designer

AUTHORITY:
advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/102_PHASE_B_R2_RECOVERY_F02_DESIGNER_HANDOFF.md

RUN_PROMPT:
advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/102A_PHASE_B_R2_RECOVERY_F02_DESIGNER_RUN_PROMPT.md

AUTHORITY_COMMIT: 50507326ee3c4e2dba9b6defd45ab73d3b599cc2

AUTHORITY_SHA256:
739a740fc44cc0137a007c9b0436cd9ae74d0cbd06dbf809d44602a443bb49fe

RUN_PROMPT_SHA256:
928755d45af034486decfa5c8abe2d29f28933525a3a8ccb3e19054bf0e2a2f2

ADVISOR_AUDIT_101_SHA256:
6222c6d8a51e8f8fb376c8ceac4ab85b346fff91b797afdf123099491ff64ea8

PRODUCT_BRANCH: feature/as1-phase-b-live-pilot-001

PRODUCT_BASELINE: d0b14949181d89c2caeb4e93bca91a2ea1647c80

ACCEPTED_R2_DESIGN_COMMIT: a837bbf9d4072638a6dac676fb5ccc8da9bfa1ff

DESIGN_STATE: READY_FOR_SAME_REVIEWER_F02_DESIGN_REVIEW

F02_DESIGN_HOLD: NO

LIVE_R2_SLACK_ACTIVATION: BLOCKED

RUNTIME_IMPLEMENTATION: NONE

REAL_STATE_ROOT_ACCESS_OR_MUTATION: NONE

SECRET_ACCESS: NONE

SLACK_CONNECTION_OR_POST: NONE

TMUX_INPUT: NONE

PRODUCT_TEST_SUITES: NOT_RUN_BY_DESIGNER

PROPOSED_IMPLEMENTATION_PATH_COUNT: 4

RETURN_TO: agent-office-advisor

## Result

The F02 design is review-ready. It closes the concrete helper/invocation gap
identified by Advisor audit 101 without changing F01, Exact Delivery, Slack
routing, identity, status behavior, or sequential profile operation.

The patched design is:

docs/integration/AGENT_OFFICE_AS1_PHASE_B_R2_RECOVERY_DESIGN_DELTA.md

Its SHA-256 is:

1d31ce8b096f48780b7129e1e8516b89ae3b9a1d684a1fbb991d438b686e24a5

## Exact production helper and invocation

The sole repository-owned production helper artifact is:

scripts/as1-preserve-original-root.mjs

The sole production invocation is the fixed, zero-argument command recorded
in design section 4.4.1. It uses `/usr/bin/sudo`, an empty environment with
only fixed locale keys, the fixed Node executable, and the absolute helper
path. The helper accepts no root/path/environment/CLI operand, discovery,
fallback, copy, migration, repair, or unseal input.

The self-contained script uses only Node built-ins and a byte/hash-identified
embedded Python literal executed through a no-follow-pinned
`/usr/bin/python3.14` descriptor. Before original-root access, the child drops
to UID/GID 1000 with only CAP_LINUX_IMMUTABLE and verifies that boundary.

## Required design closure

1. One helper artifact: `scripts/as1-preserve-original-root.mjs`.
2. One direct no-argument production invocation; no wrapper, package alias, or
   AS1 CLI verb.
3. Four future implementation paths, below the six-path ceiling.
4. A canonical reviewed build/install manifest proves helper, source,
   `dist/core`, descriptor, Node/Python, R2 literals, and sealed bridge facts
   before original-root open.
5. The only production state roots remain the fixed original and R2 literals.
6. No caller-selected or environment-selected path/operation exists.
7. The helper retains no-follow descriptors and pins ancestor/root/entry
   identity, mount/device/type/link/entry set while rejecting path escape,
   symlink, hard-link ambiguity, special files, and mount transitions.
8. Namespace-first and then complete zero-write plus FS_IMMUTABLE_FL sealing
   has no weaker fallback and no unseal code.
9. The final canonical byte/path digest is computed only after final proofs and
   must equal the initial digest; a fixed append-only redacted journal is
   durably synced.
10. Privilege, filesystem, provenance, quiescence, identity, traversal,
    bounds, sealing, digest, or result-durability uncertainty is HOLD.
11. Synthetic helper tests never resolve either root; a separately authorized
    fixed-scratch test validates actual server filesystem/capability support
    without touching either root.
12. Activation is one-way: reviewed build and disabled proof, preserve,
    read-only reverify, initialize only R2, reverify the Agent Office
    destination, one round trip, then stop/audit.

Rollback never modifies or unseals the original root. It may only stop the R2
owner, retain/restore disabled configuration, retain both roots and evidence,
and perform journal-derived read-only reverification after PRESERVED.

## Exact future implementation allowlist

1. scripts/as1-preserve-original-root.mjs
2. docs/operations/AGENT_OFFICE_AS1_SLACK_SETUP.md
3. tests/operations/as1-slack-preservation-helper.test.ts
4. tests/operations/as1-slack-lifecycle.test.ts

Evidence manifest/result/pointer and later validation/operator journals require
their own exact handoff but do not expand these four implementation paths.
`writer-lock.ts`, `cli.ts`, `composition.ts`, `outbox.ts`, Exact Delivery, F01,
the sealed pidfd bridge, package/dependencies, configuration, descriptor,
secret, generated output, and both roots remain unchanged by this design.

## Exact evidence surfaces for later handoffs

- Build/install manifest:
  `artifacts/as1-multi-team-slack-pilot/PHASE_B_R2_PRESERVATION_BUILD_INSTALL_MANIFEST.json`
- Durable operator journal:
  `artifacts/as1-multi-team-slack-pilot/PHASE_B_R2_ORIGINAL_ROOT_PRESERVATION_OPERATOR_RESULT.jsonl`
- Test-only server scratch:
  `/home/leo/.local/state/agent-office/.as1-f02-preservation-filesystem-validation`

The manifest and journal contain redacted hashes/proofs only. They confer no
activation or delivery authority.

## Required reads completed

The Designer read the exact committed handoff/run prompt at 5050732, current
repository entry instructions, Team operating model, Designer role, accepted
design at a837bbf, current candidate d0b1494, the F02 HOLD in Advisor audit 101,
the existing injected-seam algorithm in `writer-lock.ts`, and only the bounded
setup, CLI, build, package, and lifecycle-test surfaces needed to name the
helper and invocation.

The accepted design file is byte-identical between a837bbf and d0b1494. The
current product worktree began clean and upstream-equal at the exact baseline.

## Validation and attempts

The Designer ran only document, exact-path, hash, and Git checks. The design
check passed with exactly four future implementation paths, one helper, one
production invocation, ten Markdown fence lines, and clean `git diff --check`.
No product lint, typecheck, build, test, privilege validation, or live check was
run.

One read-only hash command mistyped the audit directory as
`as1_multi_TEAM_SLACK_PILOT_001`. The authority/run-prompt hashes completed,
but the audit read failed with a path-not-found error and wrote nothing. The
exact lowercase-path retry succeeded and produced the audit SHA-256 recorded
above.

The first combined docs-only precheck expected the capitalized fragment
`The single repository-owned production helper artifact is exactly:`. The
document line contains the lowercase fragment after a line break, so `rg`
returned no count and the shell integer assertion stopped. The check wrote
nothing; the retry used the exact lowercase fragment and passed.

## Bounded unknowns

1. The future implementation source commit, helper/Python-literal byte hashes,
   source/dist tree digests, and final manifest hash do not yet exist; Worker
   and same-Reviewer evidence must fix them.
2. CAP_LINUX_IMMUTABLE, descriptor fchmod, and immutable ioctl behavior on the
   intended server filesystem are untested. The separately authorized scratch
   validation must PASS or F02 remains HOLD.
3. The production helper, manifest, scratch validation, preservation, R2
   initialization, live destination preflight, and Slack round trip have not
   been implemented or executed.

This Designer result is not independent review, implementation authority,
privilege-validation authority, state-root authority, live authority, risk
acceptance, final approval, or mission closure.

Return this result and its committed pointer to agent-office-advisor, then
STOP.
