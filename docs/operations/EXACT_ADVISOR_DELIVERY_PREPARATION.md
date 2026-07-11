# Exact Advisor Delivery Preparation

Status: `IMPLEMENTED_DISABLED__PENDING_FABLE5_IMPLEMENTATION_SECURITY_REVIEW`

This runbook records the AO-WU-19 as-built boundary. It does not activate the
bridge, create a LocalBootstrap proof, create an Advisor readiness lease, start
a listener, or authorize tmux input. AO-WU-21 remains a separate Advisor-owned
gate after Fable5 implementation/security `PASS`.

## Safe current state

- `config/agent-office.loopback.json` remains the v1 read-only descriptor.
- `config/agent-office.exact-delivery.disabled.example.json` is deliberately
  non-runnable and is rejected by production parsers.
- No v3 deployment descriptor, v2 operational descriptor, activation grant,
  readiness lease, capability, proof, credential, or state root is committed.
- No server or real tmux command is required to verify AO-WU-19.

## Production selection boundary

Exact delivery can be selected only when owner-controlled, no-follow deployment
v3 and operational v2 files agree on one activation ID. All v1/v2 deployment and
v1 operational combinations remain manual. Production rejects a caller-supplied
capability or delivery port; those seams exist only in the explicit synthetic
test composition.

The operational activation must register the sibling `foundation-docs` root and
the eight immutable authority snapshots named by the reviewed design. Static
validation requires exact Git blob/hash/ancestry, clean trusted paths, active V2
role and transport state, disengaged global kill, the fixed `$9/@9/%9` registry
row, Leo/GPT Option A, and parent manifest v5 with 21 WorkUnits. Each current
upstream path must still have the frozen blob; committed kill/authority changes
therefore invalidate the attempt. The full authority set is checked again after
buffer load before pane input.

## Per-attempt boundary

Before one pointer attempt, the existing Advisor session must publish a fresh,
committed, pushed, one-use readiness record. Agent Office then requires both
fixed structured preflights, creates an in-memory notification-bound capability,
consumes the lease durably, writes the immutable pointer bytes, and permits only:

```text
/usr/bin/tmux load-buffer -b <derived-private-buffer> <derived-pointer-file>
/usr/bin/tmux paste-buffer -p -b <derived-private-buffer> -t %9 -d
/usr/bin/tmux send-keys -t %9 Enter
```

These are implementation contracts, not commands authorized for this run.
AO-WU-19 verification uses fake runners and disposable state roots only.

## Failure and recovery

Every attempt is journaled and fsynced before its next side effect. Any existing
non-terminal journal becomes manual reconciliation; `PASTE_STARTED` and later
can never retry paste or Enter. Authority conflict, preflight mismatch, journal
corruption, or local disable latches delivery off across restart. There is no
HTTP/browser enable route and this implementation version cannot re-enable a
latched instance.

ACK, intake, decision, and resume are separate committed Git evidence stages.
The observer derives their paths from validated message/WorkUnit IDs, reads exact
blobs only, freezes the first accepted ref, rejects rewrite/removal/reordering,
and preserves `authorityRole`. Advisor routine routing is accepted only for the
already-authorized `ROUTE_ALREADY_AUTHORIZED_WORK` subset whose exact manifest
WorkUnits are `READY`, have completed dependencies, and are not `FINAL_AUDIT`;
material decisions remain Leo/GPT-only.

## Deferred AO-WU-21 inputs

Advisor and Fable5 must independently approve the actual configuration,
authority hashes, narrow instruction reload, synthetic message, disposable
state/proof roots, one-use lease, and cleanup plan. The rehearsal must prove one
send, idempotent replay, negative cases, separate evidence stages, latch/restart,
listener/proof/buffer cleanup, and no Worker/Reviewer/Hermes/public/remote input.
