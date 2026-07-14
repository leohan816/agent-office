# Advisor Completeness Patch 01

MISSION_ID: `AGENT_OFFICE_PRE_AS1_MACHINE_REGISTRY_BINDING_RECONCILIATION_001`

STATUS: `ROUTINE_NEEDS_PATCH_BEFORE_INDEPENDENT_REVIEW`

BASE_CANDIDATE: `7f29388f3a824b7f3a149a68eae35b9df32cf3ea`

SAME_WORKER: `agent-office-opus` / Opus 4.8 / Ultracode / `/fable-builder`

## Finding

The candidate correctly separates immutable `roleInstanceId` from routable
`actorId`, preserves the continuing Advisor's evidence, creates the new
Foundation Advisor, and re-parents the Agent Office Worker. It does not yet
complete the already-authorized machine binding reconciliation against the
committed current Team/runtime record.

The committed source of current bindings is:

- `docs/agent/TEAM_OPERATING_MODEL.md` sections 5-6;
- `docs/agent/ACTOR_PROJECT_BINDING_MIGRATION.md` sections 3-4; and
- the prior accepted final audit named by the handoff, which distinguishes Actor
  identity from tmux session binding.

The current candidate still carries stale or missing machine rows:

- immutable `foundation-reviewer` still routes as a Foundation Reviewer and
  names nonexistent session `foundation-reviewer-sol`, although that continuing
  reviewed Actor is now the Agent Office Reviewer in session
  `agent-office-reviewer`;
- no Agent Office Designer row;
- no Foundation Designer row;
- no Foundation Worker row for session `foundation`;
- no current Foundation Reviewer row for session
  `foundation-reviewer-fable5`;
- `cosmile-worker` and `siasiu-worker` retain stale session bindings
  `cosmile-worker`/`siasiu-worker` instead of committed current sessions
  `cosmile`/`siasiu`.

Submitting that state would leave the machine registry semantically different
from the organization record and would make future `status/agents` projection
misidentify registered actors. Correct it before independent review.

## Exact required reconciliation

Preserve every pre-existing immutable `roleInstanceId` and all evidence joins.
Apply these current bindings:

### Agent Office Team

1. Keep the continuing Advisor row exactly as approved:
   - `roleInstanceId: foundation-advisor`
   - `actorId: agent-office-advisor`
   - session `agent-office-advisor`.
2. Keep `roleInstanceId: agent-office-worker` as the immutable Worker key and
   `actorId: agent-office-worker`; session remains `agent-office-opus`; Team and
   route remain Agent Office / `agent-office-advisor`.
3. Migrate the existing immutable Reviewer row without re-keying or moving its
   evidence:
   - `roleInstanceId: foundation-reviewer`
   - `actorId: agent-office-reviewer`
   - role `REVIEWER`
   - project `AGENT_OFFICE`
   - Team `AGENT_OFFICE_ADVISOR_TEAM`
   - route fields `agent-office-advisor`
   - session `agent-office-reviewer`.
4. Add a registry-only Agent Office Designer row with no historical evidence:
   - `roleInstanceId: agent-office-designer`
   - `actorId: agent-office-designer`
   - role `DESIGNER`
   - project `AGENT_OFFICE`
   - Team `AGENT_OFFICE_ADVISOR_TEAM`
   - route fields `agent-office-advisor`
   - session `agent-office-designer`.

Do not add `agent-office-sol`; it remains excluded historical capacity, not a
current dispatchable Team actor.

### Foundation Team

1. Keep the newly created Advisor row exactly as approved:
   - `roleInstanceId: foundation-advisor-20260714-01`
   - `actorId: foundation-advisor`
   - session `foundation-advisor`.
2. Preserve `foundation-control`; it routes through `foundation-advisor` and
   remains an internal Control actor, not a Team leader.
3. Add a registry-only Designer row:
   - `roleInstanceId: foundation-designer`
   - `actorId: foundation-designer`
   - role `DESIGNER`
   - project `FOUNDATION`
   - Team `FOUNDATION_ADVISOR_TEAM`
   - route fields `foundation-advisor`
   - session `foundation-designer`.
4. Add the Foundation Worker row:
   - `roleInstanceId: foundation-worker`
   - `actorId: foundation-worker`
   - role `WORKER`
   - project `FOUNDATION`
   - Team `FOUNDATION_ADVISOR_TEAM`
   - route fields `foundation-advisor`
   - session `foundation`.
5. Preserve immutable `cosmile-worker` and `siasiu-worker` identities and routes;
   update only their current session bindings to `cosmile` and `siasiu`.
6. Add the current independent Foundation Reviewer row:
   - `roleInstanceId: foundation-reviewer-fable5`
   - `actorId: foundation-reviewer-fable5`
   - role `REVIEWER`
   - project `FOUNDATION`
   - Team `FOUNDATION_ADVISOR_TEAM`
   - assignment/result route fields `foundation-advisor`
   - session `foundation-reviewer-fable5`.

Reviewer verdict independence remains unchanged; only assignment and result
routing go through the responsible Advisor.

### VibeNews

Leave both VibeNews rows byte-for-byte unchanged from candidate `7f29388`.

## Layout constraint

Keep this mission free of Living Office product/visual design. Do not add an
Agent Office pod. Reconcile the existing Foundation pod member list only as
needed so it contains the current Foundation Team registry actors and its new
responsible Advisor, with no duplicate actor across pods. Update only directly
affected deterministic assertions.

## Allowed files

- `src/application/organization/registry.ts`
- `src/application/organization/office-layout-config.ts`
- `tests/contract/organization-registry.test.ts`
- `tests/contract/production-render-input.test.ts`
- `tests/integration/runtime-composition.test.ts`
- `artifacts/pre-as1-registry-reconciliation/WORKER_RESULT.md`
- `artifacts/pre-as1-registry-reconciliation/WORKER_RESULT_POINTER.txt`

No other file is authorized. In particular, do not edit `types.ts`,
`evidence.ts`, transport/exact-delivery code, UI source/tests, docs, dependencies,
or config outside the listed organization files.

## Targeted proof

Extend the focused registry tests to prove:

- all original eight immutable keys still exist;
- continuing Advisor and continuing Reviewer evidence remains joined to their
  original immutable keys;
- new Advisor/Designer/Worker/Reviewer rows inherit no historical evidence;
- all `actorId` values and route targets are unique/resolvable;
- both current Teams have exactly one responsible `ADVISOR` by `actorId`;
- each current subordinate row routes to its Team's responsible Advisor;
- Reviewer role remains `REVIEWER` and no verdict authority field is introduced;
- exact current session bindings above;
- VibeNews rows are unchanged;
- `UNASSIGNED` fail-closed behavior remains intact.

Run only:

- the focused registry contract test;
- the focused production-render-input contract test;
- the single runtime-composition test if its real-directory fixture is
  available; otherwise preserve and report the already-demonstrated environment
  limitation accurately;
- TypeScript typecheck;
- ESLint over the changed files;
- `git diff --check`.

Update the same Worker result and pointer with the final candidate identity,
exact failures/retries, test totals, and attestations. Commit and non-force push
the same isolated branch. Return to `agent-office-advisor` and STOP. Do not
dispatch the Reviewer or start AS1.
