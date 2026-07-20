# Common Role Documents

Status: `ACTIVE`

These are the one common, deduplicated role definitions shared by every
Advisor-led Team (see `../TEAM_OPERATING_MODEL.md`). Each Team reuses them; it
does not fork a second role system or duplicate full definitions into project
roots.

| Role | Document | One-line authority |
|------|----------|--------------------|
| Strategy | [strategy.md](strategy.md) | Canonical cross-project rule steward; classifies, proposes, and distributes Leo-approved governance revisions via the Advisor; never dispatches, implements, reviews, or promotes without Leo. |
| Advisor | [advisor.md](advisor.md) | Orchestration controller; assigns, routes, audits; never implements or self-reviews. |
| Designer | [designer.md](designer.md) | Turns approved intent into reviewable product design; no runtime implementation. |
| Worker | [worker.md](worker.md) | Implements only the exact committed handoff; returns evidence; no self-review. |
| Reviewer | [reviewer.md](reviewer.md) | Independent read-only verdict; no patch, no commit, no approval. |
| Control | [control.md](control.md) | Internal architecture/contract design; anti-expansion; no implementation. |

The reusable cross-project governance chain — `Strategy -> Advisor -> Worker ->
independent Reviewer -> Advisor -> Strategy -> Leo/GPT` — and its closed lesson
loop are defined in [strategy.md](strategy.md). Implementation and review still
route only through the responsible Advisor.

Common invariants for all roles:

- One responsible Advisor per actor; assignment and result routing pass through
  that Advisor.
- Start only from an exact committed handoff; fail closed on anything unclear.
- No unauthorized agent, sub-agent, delegated context, temporary session, or
  substitute actor.
- No self-review, risk acceptance, or final approval by a subordinate; Leo/GPT
  owns final approval.
- No push/merge to `main`, protected-branch change, or force push.
