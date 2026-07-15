# Canonical Role Index

Status: `ACTIVE`

These are the one common, deduplicated role definitions shared by every
Advisor-led Team (see `../TEAM_OPERATING_MODEL.md`). Each Team reuses them; it
does not fork a second role system or duplicate full definitions into project
roots.

For every role, the project-local `AGENTS.md` and `CLAUDE.md`, the central
[`TEAM_OPERATING_MODEL.md`](../TEAM_OPERATING_MODEL.md), the exact central role
file listed below, and the current role-appropriate authority input are required
entry reads. Every Actor also reads any canonical authority named by those
documents or by its current mission or handoff.

| Role | Use | Exact central role file | Additional required entry reads |
|------|-----|-------------------------|---------------------------------|
| Advisor | Required responsible Advisor | [`docs/agent/roles/advisor.md`](advisor.md) | Current Leo/GPT mission or decision. |
| Designer | Optional; only when registered or assigned | [`docs/agent/roles/designer.md`](designer.md) | Current exact committed Advisor handoff. |
| Control | Optional; only when registered or assigned | [`docs/agent/roles/control.md`](control.md) | Current exact committed Advisor handoff. |
| Worker | Optional; only when Leo-nominated or registered and assigned | [`docs/agent/roles/worker.md`](worker.md) | Current exact committed Advisor handoff, [`docs/agent/RUN_PROTOCOL.md`](../RUN_PROTOCOL.md), and [`docs/agent/RESULT_REPORTING_PROTOCOL.md`](../RESULT_REPORTING_PROTOCOL.md). |
| Reviewer | Optional; only when registered or assigned | [`docs/agent/roles/reviewer.md`](reviewer.md) | Current exact committed Advisor review handoff or launcher. |

If a role is absent from the Team, skip it; do not create or substitute an Actor
to complete the index. A Team without Control simply skips Control. Common role
manuals remain centralized here and are not copied into project repositories.

Common invariants for all roles:

- One responsible Advisor per actor; assignment and result routing pass through
  that Advisor.
- The responsible Advisor starts only from the current Leo/GPT mission or
  decision; each subordinate starts only from an exact committed Advisor
  handoff. Unclear authority fails closed.
- No unauthorized agent, sub-agent, delegated context, temporary session, or
  substitute actor.
- No self-review, risk acceptance, or final approval by a subordinate; Leo/GPT
  owns final approval.
- No push/merge to `main`, protected-branch change, or force push.

On a new session, role change, or new mission, every Actor rereads all applicable
entry files above and the current role-appropriate authority input—including the
current exact handoff for a subordinate—instead of relying on memory.
