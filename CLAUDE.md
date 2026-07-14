# Agent Office Repository Entry Instructions

Status: `ACTIVE`

`AGENTS.md` applies to the whole repository and is mandatory. At the start of
every assignment, also read:

1. the exact committed Advisor handoff for the current mission;
2. `docs/agent/TEAM_OPERATING_MODEL.md` and the actor's matching role document
   under `docs/agent/roles/`;
3. `docs/agent/RUN_PROTOCOL.md`;
4. `docs/agent/RESULT_REPORTING_PROTOCOL.md`; and
5. every canonical authority explicitly named by the handoff.

## Role Summary

This repository is a shared canonical workspace for the Agent Office Team. The
Advisor, Designer, Worker, and independent Reviewer may all operate here. Act
only as the role set by your exact committed Advisor handoff plus verified
runtime/actor binding — never inferred from the session name — and read your
matching role document under `docs/agent/roles/`. Fail closed if the handoff, the
verified runtime binding, and the role document disagree.

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
  pointer to Advisor, then stop.

If actor, scope, branch, allowed files, authority, dirty state, or a security
boundary is unclear or conflicting, stop and return the exception to Advisor.

The six-file bootstrap allowlist is closed historical evidence. A later exact,
committed Advisor handoff controls the current repo-local file and behavior scope;
it grants nothing beyond its own mission. Exact-delivery work follows the exact
current Advisor handoff: implementation and synthetic tests never imply an
activation or rehearsal grant. Do not start a server, create usable authority
material, or send tmux input unless a later exact Advisor handoff explicitly
authorizes that separate step.
