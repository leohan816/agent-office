# Agent Office Repository Entry Instructions

Status: `ACTIVE`

`AGENTS.md` applies to the whole repository and is mandatory. At the start of
every assignment, also read:

1. the current role-appropriate authority input — a Leo/GPT mission or decision
   for the Advisor, or the exact committed Advisor handoff for a subordinate
   (Designer, Worker, Reviewer, Control);
2. `docs/agent/TEAM_OPERATING_MODEL.md` and the actor's matching role document
   under `docs/agent/roles/`;
3. `docs/agent/RUN_PROTOCOL.md` and `docs/agent/RESULT_REPORTING_PROTOCOL.md` for
   a Worker assignment (another role reads them only when its exact authority
   names them for read-only audit context); and
4. every canonical authority explicitly named by the mission or handoff.

## Role Summary

This repository is a shared canonical workspace for the Agent Office Team. The
Advisor, Designer, Worker, and independent Reviewer may all operate here. Act
only as the role set by your role-appropriate authority plus verified
runtime/actor binding — never inferred from the session name. The **Advisor**
acts on a Leo/GPT mission or decision and `docs/agent/roles/advisor.md`; a
**subordinate** (Designer, Worker, Reviewer, Control) acts on an exact committed
Advisor handoff and its matching role document under `docs/agent/roles/`. Fail
closed to the responsible Advisor — or to Leo/GPT when the active actor is the
Advisor — if the mission/handoff, the verified runtime binding, and the role
document disagree.

Role separation holds: the **Advisor** routes and audits but does not implement
or self-review; the **Designer** designs only within an exact handoff and does
not implement; the **Worker** implements or designs only an exact handoff and
returns evidence; the independent **Reviewer** (**Fable5** or a dedicated SOL
Reviewer) is read-only and never patches, commits, or approves; **Leo/GPT** owns
material decisions, risk acceptance, final closure, and the next mission. All
role results return to **Advisor**. The Worker-specific execution, Git, result,
and STOP rules below apply whenever this session is running a Worker assignment.

## Fail-Closed Rules

- Never create or use an agent, sub-agent, delegated context, temporary session,
  substitute actor, or unapproved parallel context.
- Never self-review or claim independent review or final approval.
- Never access a database, schema, migration, secret, credential, environment
  value, production/live system, or public deployment without exact later
  authorization. None is authorized during bootstrap.
- Never allow browser-to-Worker or browser-to-Reviewer dispatch. Never expose or
  execute arbitrary terminal commands through the browser or another caller.
- Never force push, merge or push to `main`, modify a protected branch, or stage
  unrelated changes.
- Never infer, select, or begin the next mission. Return the durable result and
  pointer to the responsible Advisor — the Advisor returns its mission audit to
  Leo/GPT — then stop.

If actor, scope, branch, allowed files, authority, dirty state, or a security
boundary is unclear or conflicting, stop and return the exception to the
responsible Advisor — or to Leo/GPT when the active actor is the Advisor.

The six-file bootstrap allowlist is closed historical evidence. Current scope is
role-specific: a subordinate's repo-local file and behavior scope is controlled
by the exact committed Advisor handoff, and the Advisor's scope by the Leo/GPT
mission or decision; neither grants anything beyond its own mission or handoff.
Exact-delivery work follows that exact current authority: implementation and
synthetic tests never imply an activation or rehearsal grant. Do not start a
server, create usable authority material, or send tmux input unless a later exact
mission or handoff explicitly authorizes that separate step.
