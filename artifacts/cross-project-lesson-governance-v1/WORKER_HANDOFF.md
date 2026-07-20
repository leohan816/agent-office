# Cross-Project Lesson Governance V1 — Worker Handoff

Status: `ACTIVE`

## Authority and binding

- Mission: `AGENT_OFFICE_CROSS_PROJECT_LESSON_GOVERNANCE_V1`.
- Advisor gate: `PROCEED_WITH_LIMITS`; review classification: `HARD_IMPORTANT_AUTHORITY`.
- Authority: Leo's direct governance mission plus the queued scope refinement and measurement decision, supervised by `agent-office-strategy-sol` and routed by `agent-office-advisor`.
- Worker: Agent Office Worker, existing session `agent-office-opus` only. The Advisor must live-verify actor, model, effort, path, readiness, and role before dispatch; a session label is not proof.
- Repository: `/home/leo/Project/agent-office`.
- Worktree: `/home/leo/Project/.worktrees/agent-office/AGENT_OFFICE_CROSS_PROJECT_LESSON_GOVERNANCE_V1`.
- Branch: `governance/cross-project-lesson-governance-v1`.
- Baseline: `f66a55b390b69d34bab388ebbd9bcd42e6fa4b52` (verified equal to fetched `origin/shadow/agent-office-m1-2-spatial-office`).
- Remote: `origin`; non-force push only to the matching dedicated branch. Merge is forbidden.

Read the exact current handoff, `AGENTS.md`, `CLAUDE.md`, `docs/agent/TEAM_OPERATING_MODEL.md`, `docs/agent/roles/worker.md`, `docs/agent/RUN_PROTOCOL.md`, and `docs/agent/RESULT_REPORTING_PROTOCOL.md`. Confirm the exact branch/worktree, clean start, and live binding before editing. Return one concrete blocker on any mismatch.

## Objective

Make the smallest documentation-only governance correction:

1. Add the one missing canonical Strategy role and make authority depend on Leo authority plus verified runtime/actor binding, never the session name.
2. Encode the reusable chain `Strategy -> Advisor -> Worker -> independent Reviewer -> Advisor -> Strategy` and the closed loop: project incident -> Leo report/authorization -> Agent Office Strategy classification/proposal -> Advisor/Worker/Reviewer -> Leo-approved canonical revision -> exact affected-rule delta to affected project Strategies -> selective reload and concrete conflict/defect feedback -> the same Leo-controlled promotion gate.
3. Define Agent Office Strategy as canonical rule steward, impact selector, and distribution coordinator without superseding Leo approval or project-local execution authority. It may route implementation/review work only through Advisor; Leo-approved revision notices to affected project Strategies are governance distribution, not work dispatch.
4. Require incident classification as exactly one of `ENFORCEMENT`, `CLARIFICATION`, `NEW_INVARIANT`, or `PROJECT_LOCAL`; incident facts never auto-promote into common rules.
5. Add fail-closed `COLD`/`DELTA` authority loading. New or cleared context, or any authority-revision mismatch, uses `COLD`. Only a continuing verified context on the same exact committed authority revision may use `DELTA`, naming exact changed files and headings. A stale-context assertion is never proof.
6. Have Advisor package only the affected rule delta, exact committed revision, changed file headings, and affected recipients for Strategy's post-Leo-approval distribution; do not require unaffected projects to reload unchanged authority.
7. Add one concise Worker verification-truth invariant: verification reveals observed truth and must not add unapproved paths/fallbacks, suppress the first actionable failure, reinterpret non-zero as success, or mutate outside the handoff. On non-zero or unexpected tracked delta, preserve bounded diagnostics, classify the first failing stage or `UNCLASSIFIED`, then stop.
8. Make every normative delta operational by naming its actor, trigger/precondition, required read/action, stop/escalation point, and evidence return where applicable; prefer links/routing and rewrite redundancy instead of adding prose. Keep compact incident intake outside mandatory reads. Do not create a hierarchy, registry, policy import, framework, automation, or duplicate policy.

## Leo/Foundation compatibility acceptance

Treat this as relayed authority only; do not contact Foundation or inspect its repository. The candidate and later direct clean-context Reviewer traversal must prove all five executable paths:

1. A project actor using `DELTA` still reads the current mission handoff and every project-local mandatory product/safety authority; `DELTA` can reduce only unchanged common authority. Missing or conflicting authority stops to its responsible Advisor.
2. Context reset, compaction, an unknown or mismatched authority revision, or an unverifiable prior acknowledgement always triggers `COLD`; no actor may self-attest continuity.
3. Agent Office common authority never overrides project-specific authority. Agent Office Strategy never dispatches project actors directly; it only classifies intake, coordinates a Leo-approved canonical revision, and notifies affected project Strategies.
4. A new project starts `COLD` and onboards through minimal pointers to common role contracts; it does not copy those contracts.
5. An affected project Strategy may reject and report an incompatible rule to Agent Office Strategy instead of silently applying it; Strategy returns the conflict through the same Leo-controlled promotion gate.

The independent Reviewer must traverse these as five direct navigation cases and return any conflict to Agent Office Strategy through Advisor. Ambiguous ownership, hidden mandatory reads, or a path that cannot be executed is a blocking finding.

## Exact writable allowlist

Change fewer only if every objective remains coherent; do not write outside:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/agent/roles/README.md`
- `docs/agent/roles/strategy.md` (the only new canonical role file)
- `docs/agent/roles/advisor.md`
- `docs/agent/RUN_PROTOCOL.md`
- `artifacts/cross-project-lesson-governance-v1/WORKER_RESULT.md`
- `artifacts/cross-project-lesson-governance-v1/WORKER_RESULT_POINTER.txt`

The intake and this handoff are committed Advisor authority and read-only to the Worker. Do not edit `docs/agent/TEAM_OPERATING_MODEL.md`, any product/runtime/source/test/config file, another artifact tree, or another project.

## Required content boundaries

- In `AGENTS.md` and `CLAUDE.md`, minimally add Strategy entry authority and the `COLD`/`DELTA` router without duplicating role policy.
- In `docs/agent/roles/README.md`, add Strategy to the role index and make the reusable canonical chain discoverable.
- In new `docs/agent/roles/strategy.md`, keep the role compact. Include classification, supplied-intake fields (source project, observed failure, frozen boundary, first bad effect, where caught, local status, evidence pointer, do-not-inspect/resume), closed-loop routing/distribution/feedback, and every Strategy prohibition from the mission.
- In `docs/agent/roles/advisor.md`, add only affected-rule delta packaging/distribution responsibility and preserve Advisor-only subordinate routing.
- In `docs/agent/RUN_PROTOCOL.md`, add the single verification-truth invariant in the best existing gate; do not spread variants into other files.

Strategy must never command Worker/Reviewer directly, implement, independently review, accept risk, close a mission, inspect/resume source-project work, override project-local execution authority, or promote without Leo. Newly onboarded projects start `COLD` and reuse the canonical chain; no new onboarding system is authorized.

## Focused evidence only

Run no product test, broad test, build, lint, typecheck, server, browser, or external-system check. Produce only:

1. `git diff --check` against the baseline.
2. Exact changed-path allowlist proof and staged diff inspection.
3. Direct Markdown link-resolution checks for every added/changed relative link.
4. Direct clean-context heading/route evidence showing the role chain, four classifications, Leo promotion gate, Strategy/Advisor boundary, `COLD`/`DELTA` fail-closed rules, and the one verification-truth invariant, including actor/trigger/action/stop/return and any ambiguity, duplicate, or hidden read found.
5. Before/after mandatory-read impact using identical repository-local commands: `wc -l` and clearly labeled whitespace-token proxy `wc -w`. Report the exact file set for each `COLD` role set measured and the limitation that `wc -w` is not a model tokenizer. Separately list and measure the exact candidate file headings selected by this mission's `DELTA`; do not fetch/install a tokenizer.
6. Git base, candidate commit, evidence commit, push/upstream/ancestry, and clean allowed worktree state.

## Commit, result, and stop

Commit the canonical documentation delta first. Then write a compact evidence-bearing result and pointer at the two allowed result paths, naming the candidate commit, and commit those two evidence files separately. Push both commits non-force to the matching remote branch. The result is Worker evidence, not review or approval.

Confirm explicitly: no Foundation/Cosmile access or change; no runtime/product change; no unrelated expansion; no agent/sub-agent/delegation; no self-review; no merge/main/force push. Return the pointer to `agent-office-advisor` and stop. Independent review is a separate Advisor dispatch.
