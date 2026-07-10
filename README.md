# Agent Office

Agent Office is an Advisor-managed web control-plane project. The intended
product will project canonical mission state and support structured
Leo-to-Advisor communication while preserving strict actor boundaries.

This repository is currently at **bootstrap only**. It contains repo-local role,
run, and result-reporting instructions; it contains no product design, runtime
source, package manifest, application scaffold, database integration, or tests.

## Operating Boundary

- Agent Office Worker performs only explicitly approved repo-local design and
  implementation and returns every result to Advisor.
- Advisor routes work and audits evidence.
- Fable5 independently reviews work in a separate Reviewer session.
- Leo/GPT is the final approver and selects any next mission.
- The future browser surface may send structured communication to Advisor; it
  may not dispatch directly to Workers or Reviewers and may not provide arbitrary
  terminal execution.

The bootstrap branch is `shadow/agent-office-m01`. Public exposure, databases,
secrets, live/production access, protected-branch changes, force pushes, and
automatic mission progression are not authorized.

See `AGENTS.md`, `CLAUDE.md`, and `docs/agent/` before doing any work.
