# AS1 Phase B R2 Recovery F02 Fixed Launcher Compatibility Designer Result

MISSION_ID: AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_PILOT_001

WORK_UNIT: PHASE_B_R2_RECOVERY_F02_FIXED_LAUNCHER_COMPATIBILITY_PATCH

ACTOR: agent-office-designer

ROLE: Agent Office Designer

AUTHORITY:
advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/110_PHASE_B_R2_RECOVERY_F02_LAUNCHER_COMPATIBILITY_DESIGN_PATCH_HANDOFF.md

AUTHORITY_COMMIT: 9ed0d1d256dd8ea62949a0509cd5e25acd66df13

AUTHORITY_SHA256:
bab393eddbd39448a0eb811138d262ab91e83a2137c9329c42c68ec08db01f68

REVIEW_RESULT:
advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/107_PHASE_B_R2_RECOVERY_F02_DESIGN_PATCH_INDEPENDENT_DELTA_REVIEW_RESULT.md

REVIEW_RESULT_COMMIT: 3df77ffba0d95dac96abfdbabe1b0e897d273313

REVIEW_RESULT_SHA256:
d4a23e3dcb806af065c455752fd886198fff02f624d6e602859cced4017aaf9f

WORKER_PREFLIGHT_RECORD:
advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/109_PHASE_B_R2_RECOVERY_F02_SOURCE_PREFLIGHT_HOLD.md

WORKER_PREFLIGHT_RECORD_COMMIT: 9ed0d1d256dd8ea62949a0509cd5e25acd66df13

WORKER_PREFLIGHT_RECORD_SHA256:
e29bf87114527d3e74abf01c604f7c0a8e73f5fdaafc05537a7b864a6e67110a

PRODUCT_BRANCH: feature/as1-phase-b-live-pilot-001

PATCH_BASE: e8c8f529e08ea547e1504d425c80fc8a2216b51b

ACCEPTED_R2_DESIGN_COMMIT: a837bbf9d4072638a6dac676fb5ccc8da9bfa1ff

DESIGN_STATE: READY_FOR_SAME_REVIEWER_F02_FIXED_LAUNCHER_COMPATIBILITY_DELTA_REVIEW

LAUNCHER_COMPATIBILITY_DISPOSITION: READY_FOR_SAME_REVIEWER

F02_DESIGN_HOLD: NO_KNOWN_FIXED_LAUNCHER_CONFLICT

LIVE_R2_SLACK_ACTIVATION: BLOCKED_F02

RUNTIME_IMPLEMENTATION: NONE

ROOT_OR_SCRATCH_ACCESS_OR_MUTATION: NONE

SECRET_OR_ENVIRONMENT_VALUE_ACCESS: NONE

SLACK_OR_NETWORK_CONNECTION: NONE

DESCRIPTOR_OR_PROCESS_ACTION: NONE

TMUX_INPUT_OR_OTHER_ACTOR_ACTION: NONE

PRODUCT_TEST_SUITES: NOT_RUN_BY_DESIGNER

PROPOSED_IMPLEMENTATION_PATH_COUNT: 4

RETURN_TO: agent-office-advisor

## Result

The bounded patch candidate changes only three fixed-launcher concerns: final
env/sudo literals, role-specific no-follow inode trust (including the sole
manifest-pinned env multicall link-count exception), and corresponding
construction/vector/drift rejection proofs. It preserves the same Reviewer's
F02-D1 through F02-D6 PASS, the accepted traversal/sealing algorithm,
original-root no-follow/one-link rules, scratch validation sequence,
R2/F01/Exact Delivery behavior, descriptor-disabled state, private bindings,
and sequential one-profile operation.

The patched design is:

docs/integration/AGENT_OFFICE_AS1_PHASE_B_R2_RECOVERY_DESIGN_DELTA.md

Its SHA-256 is:

70d711e724169f10a6b5c62a3e56dd17726ed3630844d2b55d69f6cc83678a0f

## Fixed launcher compatibility disposition

- Every executable command shape now uses final regular-file literals
  `/usr/lib/cargo/bin/coreutils/env` and `/usr/lib/cargo/bin/sudo`.
  `/usr/bin/setsid`, `/usr/bin/python3.14`, `/usr/bin/git`, and the fixed Node
  literal remain unchanged. Generic symlink resolution, `realpath`, PATH,
  alternatives, caller/environment selectors, fallback, and launcher
  abstraction are explicitly forbidden.
- M fixes each launcher object's exact final path, no-follow regular inode,
  root ownership/group, non-writability, role-specific mode, device, inode,
  link count, byte count, and content hash. Env alone may carry its exact
  reviewed multi-link count at mode 0755; sudo remains one-link mode 4755;
  every other launcher and every original-root evidence object retains its
  one-link rule. Retained descriptors and all facts are re-proved before
  helper/root access; drift is HOLD.
- The fixed literals preserve the non-circular boundary: M does not contain
  its own hash, E embeds the independently reviewed M hash, and the bootstrap
  authenticates M and retained objects before root access. Synthetic command,
  manifest, generator, reproducer, and S/M/J/E requirements reject the former
  aliases, changed paths, symlink/writable/non-root/wrong-mode targets,
  unexpected link counts, replacement, and content/hash drift.

LAUNCHER_COMPATIBILITY_DISPOSITION: READY_FOR_SAME_REVIEWER

## Finding disposition for same-Reviewer delta review

### F02-D1 — noninteractive fixed invocation

The candidate replaces interactive sudo with one detached `setsid --fork
--wait`, empty-environment, `sudo -n`, isolated-Python bootstrap construction
using fixed `/dev/null` stdin and discarded external stderr. S contains no
runnable command; E binds the one reviewed M/J object and contains the sole
final preservation command. Sudo denial is separately classified before helper output.
A synthetic constructor must prove password, askpass, stdin, controlling-
terminal, shell expansion, and retry paths are unreachable. The final E
literal binds one canonical reviewed object containing M's digest and J's
exact immutable journal-anchor facts.

PATCH_DISPOSITION_F02_D1: READY_FOR_REVIEW

### F02-D2 — non-circular pre-execution trust

The final command carries an inline, independently reviewed isolated-Python
bootstrap. It embeds the reviewed manifest-file digest, authenticates that
manifest before parsing, derives the helper digest from the authenticated
manifest, retains no-follow Node/helper/manifest descriptors, and executes only
`/proc/self/fd/3` plus `/proc/self/fd/4`. The manifest/helper do not contain the
manifest-file or final-bootstrap hash, so the binding has no hash cycle and no
pathname-reopen interval.

PATCH_DISPOSITION_F02_D2: READY_FOR_REVIEW

### F02-D3 — exact reproducible grammar

The candidate fixes every manifest key and nested shape, ASCII canonical-JSON
serializer and LF rule, decimal/hash/mode grammar, `REPO_TREE_V1` and
`ORIGINAL_TREE_V1` domains/records/order/terminators, fixed generator and
independently authored read-only reproducer, and the source S -> manifest M ->
evidence-binding E sequence. Neither evidence surface has a state-root or
operation selector.

PATCH_DISPOSITION_F02_D3: READY_FOR_REVIEW

### F02-D4 — closed import-safe seam

The helper module exposes exactly seven named pure functions. Its exact
direct-entry predicate alone reaches an unexported private production main;
fixed paths, filesystem/process/journal/privilege adapters and scratch behavior
remain private and non-injectable. Import evaluation has an explicit zero-I/O,
zero-spawn, zero-root contract and namespace test.

PATCH_DISPOSITION_F02_D4: READY_FOR_REVIEW

### F02-D5 — interpreter and privilege transition

The candidate fixes `/usr/bin/python3.14`, `-I -S -B -c`, literal operand, cwd,
two-key environment, fd mapping, `/dev/null`, output caps, deadline, exit map,
and conservative child-failure handling. It gives an ordered transition for
all real/effective/saved/fs IDs, supplementary groups, securebits/keep-caps,
bounding/permitted/effective/inheritable/ambient sets, `no_new_privs`, and exact
`/proc/self/status` values. Any mismatch maps to one HOLD before root open.

PATCH_DISPOSITION_F02_D5: READY_FOR_REVIEW

### F02-D6 — monotonic anti-retry journal

The authoritative journal moves from an owner-writable worktree file to one
preinstalled root-owned fixed `/var/lib` path. Its dedicated directory is
immutable and file append-only. The helper never creates or repairs it; it
requires no-follow identity/owner/mode/link/flag proofs, `O_APPEND`, exclusive
nonblocking flock, exact canonical hash-chained states, sync and complete
pre/post-terminal rereads. Absence, deletion, replacement, truncation, tamper,
ambiguity, HOLD, or concurrency can never become a fresh mutation attempt.
The worktree JSONL is only a later redacted evidence projection.

PATCH_DISPOSITION_F02_D6: READY_FOR_REVIEW

## Exact future implementation allowlist retained

1. scripts/as1-preserve-original-root.mjs
2. docs/operations/AGENT_OFFICE_AS1_SLACK_SETUP.md
3. tests/operations/as1-slack-preservation-helper.test.ts
4. tests/operations/as1-slack-lifecycle.test.ts

No package, dependency, config, descriptor, active `src`, generated `dist`,
accepted F01 evidence, root, scratch, secret, Slack, tmux, process, or other
actor surface is added to implementation scope.

## Exact later evidence and host surfaces

- Build/install manifest:
  `artifacts/as1-multi-team-slack-pilot/PHASE_B_R2_PRESERVATION_BUILD_INSTALL_MANIFEST.json`
- Journal-anchor install receipt:
  `artifacts/as1-multi-team-slack-pilot/PHASE_B_R2_PRESERVATION_JOURNAL_ANCHOR_INSTALL_RECEIPT.json`
- Authoritative monotonic journal:
  `/var/lib/agent-office/as1-f02-original-root-preservation/records.jsonl`
- Redacted journal evidence projection:
  `artifacts/as1-multi-team-slack-pilot/PHASE_B_R2_ORIGINAL_ROOT_PRESERVATION_OPERATOR_RESULT.jsonl`
- Test-only server scratch:
  `/home/leo/.local/state/agent-office/.as1-f02-preservation-filesystem-validation`

Those paths require later exact handoffs. This Designer did not stat, open,
create, traverse, hash, chmod, seal, or mutate any of them except editing this
design's text references to the future evidence paths.

## Required reads completed

The Designer read handoff 110 from exact governance commit
`9ed0d1d256dd8ea62949a0509cd5e25acd66df13`, repository entry instructions,
Team operating model, Designer role, the three current design evidence files at
exact product base `e8c8f529e08ea547e1504d425c80fc8a2216b51b`, the same-
Reviewer PASS at governance commit
`3df77ffba0d95dac96abfdbabe1b0e897d273313`, and Worker preflight record 109.
The handoff, prior review, and preflight hashes matched the coordinates above.
The product worktree began clean and upstream-equal on the authorized branch at
the exact patch base.

## Validation and attempts

The successful docs-only checks proved: exact base/branch/upstream binding;
exactly the three authorized modified paths; clean `git diff --check`; balanced
Markdown fences; exactly four future implementation paths and seven pure
exports; all six frozen F02 finding markers; exactly one preservation
invocation; exact resolved env/sudo executable literals in every normative
command; the former aliases only in explicit rejection requirements; no
generic resolution or fallback; manifest-pinned root ownership, modes,
metadata, content, retained descriptors, and the env-only exact multi-link
exception; unchanged original-root no-follow/one-link language; and the
non-circular S/M/J/E disposition. Final design/result hash linkage and exact
staged scope were rechecked before commit.

No product lint, typecheck, build, test, privilege, filesystem, helper, env,
sudo, installer, root, scratch, live, network, descriptor, process, or tmux
check was run by this Designer.

The first aggregate mandatory-read display exceeded the tool output cap and
was truncated. The underlying read commands succeeded, but the omitted display
was not used as evidence; the mandatory role document and both named governance
records were reread completely in bounded calls. No file read failed.

The first aggregate docs-only precheck stopped without output because four
prose-marker assertions omitted Markdown backticks or crossed wrapped lines.
A read-only diagnostic showed the exact literal counts, scope, diff, and hashes
were correct and isolated the assertion-pattern defect. The corrected check
uses shorter bounded markers; the failed assertion wrote nothing and is not
used as positive evidence.

The first corrected-check wrapper then treated shell finding-loop text as
JavaScript template interpolation and failed before invoking the shell; it
read or wrote no repository path. The first attempt to append this note used
singular context where the file said `were correct`, so `apply_patch` rejected
the context and changed nothing. This exact-context retry succeeded; the final
check uses shell concatenation instead.

## Remaining bounded unknowns

1. Source S, manifest M, evidence commit E, helper/bootstrap/Python literal
   bytes and hashes, exact system/journal-anchor identities, and final command
   hash do not yet exist; later Worker/install/Reviewer evidence must bind them.
2. The intended server's exact capability, securebits, immutable, append-only,
   flock, descriptor-fchmod, and filesystem behavior is untested. Fixed-scratch
   and journal-anchor validation remain separate HOLD gates.
3. The helper, generator/reproducer, journal anchor, preservation, R2
   initialization, live destination preflight, and Slack round trip have not
   been implemented or executed.

This result is Designer evidence, not independent review, implementation or
installation authority, privilege/root/scratch/live authority, risk acceptance,
final approval, or mission closure.

Return this result and its committed pointer to agent-office-advisor, then
STOP.
