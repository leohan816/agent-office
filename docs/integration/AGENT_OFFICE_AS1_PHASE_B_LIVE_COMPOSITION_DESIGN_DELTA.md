# Agent Office AS1 Phase B Live Composition Design Delta

Status: `REVIEW_READY_DESIGN_ONLY`

Mission: `AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_PILOT_001`

Pass: `PHASE_B_SECURITY_TRANSPORT_DESIGN_DELTA`

Authority: committed Designer handoff
`47_PHASE_B_DESIGNER_HANDOFF.md`

Active scope correction:
`47B_PHASE_B_SCOPE_AUDIT_AND_DESIGN_CORRECTION.md` at
`e070ee25b2f22635459bd8abf8841ab4f1925d0f`

Active private single-user lock:
`47D_PHASE_B_PRIVATE_SINGLE_USER_LOCK.md` at
`b159f5c33d6b07468d98253db39807fd0f7d15f1`

Product baseline: `0dfb4398be2ecd9295b35a94e3b461e25dad6f7c`

This document is an additive design delta. It does not authorize implementation,
live setup, Slack access, tmux input, or a pilot start. The Phase A design,
security model, Socket identity delta, reviewed implementation, and final Phase A
audit remain controlling except where this document supplies the missing live
composition and operator wiring.

## 1. Decision

The reviewed Phase A contracts support the Phase B pilot without a database,
authority-schema change, Registry change, Exact Delivery v2 change, systemd
unit, HTTP/UI surface, or external product-code change. The implementation may
therefore proceed after independent design review and a new exact Advisor
implementation handoff.

The delta is deliberately small:

1. load one exact Advisor-created receive grant from fixed committed operator
   activation material;
2. assemble the existing store, service, Slack Web/Socket, exact delivery,
   evidence-ingress, and outbox modules into one foreground process;
3. add the missing production Git-artifact reader and narrow AS1 tmux port;
4. keep the Socket in authenticated quarantine until the durable receive state
   is armed;
5. make the existing closed lifecycle CLI work with a long-running process;
6. document the owner state root and the two strictly sequential rehearsals.

The live scope is one configured Slack workspace, Leo as the only authorized
user, two fixed Apps with immutable private-channel mappings, and one selected
profile at a time. Each profile receives exactly one real Leo root-to-final-
result round trip, Agent Office first and Foundation only after the first
process is manually stopped and audited. Start and stop are foreground manual
operator actions; there is no automatic restart, reconnect, or rollover.
Phase B preserves the already-reviewed identity, secret, fail-closed, dedupe,
exact-tmux, and same-thread-result protections only as needed for those two
private runs; it does not generalize them.

This is not a `HOLD`: the gaps are adapter/composition gaps, not material
contract, authority, or security redesigns.

Corrected active implementation-map count: `14` paths. Estimated implementation
and focused synthetic validation time: `3-5 hours`, excluding time waiting for
Leo's two Slack messages.

## 2. Frozen boundary

Exactly one foreground AS1 process owns one common AS1 state root and its
existing `WriterLock`. Within that root the two reviewed profiles have
physically non-overlapping contained roots. One immutable receive grant selects
one closed profile. The other profile has no Socket, secret use, receive state,
delivery authority, capability, or polling loop during that run.

Both fixed profile records bind the same one configured workspace and the same
sole authorized user, Leo. Each binds its own fixed App and immutable private
channel. Existing extensible allowlist structures remain unchanged, but Phase B
must neither add an entry nor construct, accept, or exercise a workspace/user
set beyond that Leo singleton. Workspace, user, App, and channel values are
configuration-bound facts, never runtime selectors.

The gateway never creates either authority grant or a readiness lease. It never
selects a tmux destination from Slack, a pointer, a CLI argument, an environment
value, prior evidence, or a historical pane observation. It never reads pane
content. It only consumes exact committed/pushed artifacts and performs the
already-reviewed bounded side effects.

The live data flow is:

```text
fixed committed descriptor
  -> exact committed receive grant -> one closed profile
  -> owner-only secret parse -> Web identity -> Socket hello identity
  -> durable RECEIVING arm -> one bounded Leo root -> Mission intake + pointer
  -> exact post-intake delivery grant -> fresh one-use lease -> exact tmux pointer
  -> committed Advisor evidence -> evidence ingress -> same-thread Slack outbox
```

No second route exists.

## 3. Exact implementation component map

### 3.1 Files an implementation handoff may authorize

The following 14 paths are the complete corrected Phase B implementation map.
Each exists only to make one of the two bounded live pilots work safely. This is
not current edit permission.

| Path | Exact Phase B purpose |
|---|---|
| `src/runtime/as1-slack-pilot/composition.ts` | Replace the Phase A disconnected stub with the single-profile, one-workspace/Leo-only foreground composition for one root-to-result round trip, bounded authority/evidence polling, startup order, drain, and redacted status. |
| `src/runtime/as1-slack-pilot/cli.ts` | Keep the existing closed grammar; use the fixed descriptor path; reject descriptor/profile/grant overrides; hold explicit `start` in foreground; implement lock-bound manual `stop` and read-only `status`; keep `restart` live-disabled. |
| `src/adapters/gateways/slack-pilot/git-artifact-source.ts` | New read-only, fixed-root Git source for the receive grant, delivery grant, readiness lease, and evidence. It uses closed `/usr/bin/git` argv, never fetches, and distinguishes `NOT_READY` from accepted-artifact divergence. |
| `src/adapters/gateways/slack-pilot/socket-client.ts` | Add authenticated-quarantine arming so no event is parsed or delivered between verified `hello` and the durable `RECEIVING_ONE_PROFILE` transition. |
| `src/adapters/gateways/slack-pilot/exact-transport.ts` | Add the production `NodeAs1TmuxPort` behind the existing `As1ExactTransport`; preserve the reviewed journal, two preflights, one-use consumption, and no-retry boundary. |
| `src/application/slack-pilot/inbound-store.ts` | Add read-only typed accessors for the terminal tmux delivery record and atomic grant/lease consumption record needed by `buildEvidenceAuthority`; do not change record shapes or paths. |
| `src/operations/readiness/as1-slack-control.ts` | Add stable control/latch snapshot projection and read-only redacted observation; retain the state vocabulary, transition table, latches, and lock ownership. |
| `src/persistence/file-store/writer-lock.ts` | Add strict read-only lock-metadata observation for the closed `stop`/`status` path; reuse `agent-office.writer-lock.v1` without changing it. |
| `docs/operations/AGENT_OFFICE_AS1_SLACK_SETUP.md` | Add the exact `AS1_SLACK_STATE_ROOT` owner instruction and the manual foreground start/stop procedure for the private pilot. |
| `tests/adapters/as1-slack-socket-client.test.ts` | Prove authenticated quarantine, receive arm, pre-arm bounds, disconnect, and no pre-arm parse/ACK. |
| `tests/integration/as1-slack-exact-transport.test.ts` | Prove the production tmux port's closed argv and the unchanged exact transport behavior. |
| `tests/integration/as1-slack-live-composition.test.ts` | New single focused composition test: one fixed-workspace/Leo-only Agent Office root-to-result round trip and stop, then one Foundation round trip through the same boundaries with isolated state. |
| `tests/integration/as1-slack-git-artifact-source.test.ts` | New focused fixed-path test proving ready/not-ready observation, exact committed bytes, and no acceptance of a changed artifact. |
| `tests/operations/as1-slack-lifecycle.test.ts` | Extend the existing focused lifecycle test for explicit foreground start, manual/signal-bound bounded stop, lock release, live-disabled restart, and redacted status used by the two pilots. |

No other source, test, configuration, package, lockfile, Registry, v2, UI, or
external project path is needed. In particular, the implementation must not modify
`src/adapters/gateways/tmux-advisor/*`, `src/application/advisor-inbox/*`, the
organization Registry, Phase A contract schemas, or package dependencies.

The Worker does not modify the default-disabled descriptor; the value-only
activation is a later exact reviewed pilot operation. No separate Phase B
as-built document is created: the existing Worker result, independent Reviewer
result, and Advisor audit hold implementation and live evidence.

### 3.2 Reviewed Phase A modules reused unchanged

The live composition constructs these existing modules rather than replacing
their logic:

- `allAs1Profiles`, `selectProfile`, and `validateProfileLineage`;
- `parseSecretConfigFile` and its exact ten-key/two-profile separation check;
- `As1ProfileInboundStore` and `As1InboundService`;
- `NodeAs1AuthorityProvenanceVerifier`,
  `GitAs1ReceiveGrantProvenanceGate`, and
  `GitAs1DeliveryProvenanceGate`;
- `As1StartupIdentityVerifier`, `parseReadinessLease`, and the in-memory
  one-use capability construction;
- `NodeAs1WebClient`, `NodeAs1ConnectionsOpener`,
  `NodeAs1WebSocketFactory`, and `As1RawSocketTransport`;
- `As1ExactTransport` and its existing durable profile journal;
- `buildEvidenceAuthority`, `As1EvidenceIngress`, and `As1Outbox`;
- existing atomic-file, immutable-artifact, hashing, path-safety, runtime-clock,
  and `WriterLock` primitives.

## 4. Fixed activation and profile selection

### 4.1 One fixed descriptor path

The CLI resolves the repository root from its own installed module and reads
only:

```text
config/agent-office.as1-slack-pilot.disabled.json
```

`AS1_SLACK_DESCRIPTOR`, a descriptor CLI flag, a grant CLI flag, a profile CLI
flag, and a path supplied by Slack are rejected or ignored as unsupported; they
are not production seams. The existing descriptor v1 exact-key schema remains:

```text
schemaVersion, enabled, receiveGrantRef, secretFilePath
```

The Worker leaves the file byte-unchanged at `enabled: false` and
`receiveGrantRef: null`. A later Advisor-authorized pilot activation operation may
set `enabled: true` and set `receiveGrantRef` to one exact contained governance
artifact path. The activation file itself must be clean, committed, pushed, and
read from the exact product commit being rehearsed. Its secret path must remain
the one reviewed absolute owner path.

For the second pilot, the first process is stopped and audited before a new
Advisor-authorized value-only activation commit names the new receive-grant
path. There is never a descriptor list, profile list, fallback, wildcard, or
runtime chooser. Both activation commits retain the same one configured
workspace and Leo-only principal; they change only which of the two fixed
App/channel profiles is selected.

### 4.2 The grant is the only profile selector

The Git source reads the immutable blob at the unique commit that first added
the activation-fixed path and parses it with `parseReceiveGrant`. Only then does
the composition call `selectProfile(grant.profileId)` and
`validateProfileLineage(profile)`.

The following values do not select or alter the profile:

- the command (`start`, `restart`, or any other closed lifecycle command);
- `AS1_SLACK_STATE_ROOT`;
- `--env-file` or any key/value inside the owner secret file;
- App/channel/token values;
- any Socket frame, Slack event, message text, thread, evidence, pointer,
  delivery grant, lease, tmux observation, or prior run state.

Every later artifact must equal the receive grant's profile and immutable
lineage. A mismatch is a cross-profile contradiction, not a fallback request.

### 4.3 Exact Git readiness behavior

The trusted governance repository root, repository ID, mission authority root,
and upstream branch are construction-bound constants for this Phase B mission.
The Git source accepts no repository or ref from a caller. It uses bounded,
shell-free `/usr/bin/git` calls and no network/fetch.

The exact constants are:

```text
repository root: /home/leo/Project/.worktrees/foundation-docs/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_PILOT_001
repository ID: foundation-docs
upstream: refs/remotes/origin/advisor/as1-multi-team-slack-pilot-001
mission authority root: advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001
```

Before first acceptance, absence, an uncommitted file, or an unpushed commit is
`NOT_READY`; it causes no side effect and is not a security latch. This permits
the responsible Advisor to create an artifact under normal atomic Git workflow.
Once a particular artifact ID/path/hash has been accepted, deletion, dirty
change, committed rewrite, path reuse, ancestry change, or content divergence
is a durable profile latch. Malformed content at a fully committed/pushed fixed
path is also a latch. The receive-grant path must already be fully ready at
startup; otherwise start fails before secrets or network.

## 5. State-root and isolation contract

### 5.1 Owner instruction

The one approved Phase B state root is:

```text
/home/leo/.local/state/agent-office/as1-slack-pilot
```

The owner prepares it outside every repository with a private umask and mode
`0700`, then supplies the exact literal to every closed command:

```sh
umask 077
install -d -m 0700 /home/leo/.local/state/agent-office/as1-slack-pilot
export AS1_SLACK_STATE_ROOT=/home/leo/.local/state/agent-office/as1-slack-pilot
```

The CLI requires an absolute, real, owner-UID, non-symlink root with the existing
`agent-office.state-root.v1` marker and state-root ID `as1-slack-pilot`. A fresh
owner-prepared directory may be initialized through the existing
`initializeStateRoot` primitive before any live start. Repository paths,
`/tmp`, a shared/group-writable directory, a symlink, a second arbitrary root,
or a relative path fail closed. No secret is stored below this root.

`redacted-check`, `start`, `stop`, `restart`, and `status` all require this same
environment instruction. `redacted-check` remains local syntax only and does
not open Slack or tmux.

### 5.2 Independent contained profile roots

The two profile roots are the existing non-overlapping contained paths:

```text
indexes/as1-slack-pilot/profiles/agent-office-advisor
indexes/as1-slack-pilot/profiles/foundation-advisor
```

`profileStateRootRef` must equal the selected literal above.
`profileStateRootHash` must equal this exact domain-separated formula:

```text
hashCanonical({
  schemaVersion: "agent-office.as1-profile-state-root-binding.v1",
  stateRootFormat: <exact parsed agent-office.state-root.v1 marker>,
  profileStateRootRef: <the selected literal contained ref>
})
```

The environment supplies only the common root; it cannot choose a contained
profile root. `resolveContainedPath` and realpath/no-follow checks must prove the
selected path neither aliases nor escapes to the other profile.

At an authority gate, `globalControlSnapshotHash` is
`hashCanonical(<exact parsed agent-office.as1-global-control.v1 record>)` and
`profileLatchSnapshotHash` is
`hashCanonical(<exact parsed selected failure-latch record>)`. Receive-grant
comparison occurs before its first live transition. Delivery-grant comparison
uses a fresh snapshot immediately before delivery acceptance. The hello seal
continues to bind the live construction-owned control projection after those
authority snapshots have been checked.

The existing common `WriterLock` and global control make simultaneous starts
impossible. Under it, each profile keeps its own receive-grant state, receipts,
dedupe indexes, message/intake/pointer artifacts, root/question correlations,
delivery consumption, tmux journal, evidence checkpoint, outbox journal, and
failure latch. No object, ID, hash, or artifact path is copied between these
roots. Foundation must use role instance
`foundation-advisor-20260714-01`; the continuing Agent Office historical join
key is invalid in Foundation state or evidence.

## 6. Exact startup order

`start` performs the following sequence. A failure closes/reverts the owned
control as defined below and never skips forward.

1. Resolve and validate the fixed state root; initialize only an owner-prepared
   fresh root; acquire its one `WriterLock`; validate the state-root marker,
   global control, and both latch records under the lock. Reject a second
   process or stale lock. No profile is selected and no secret or network access
   has occurred.
2. Read the fixed descriptor and exact committed receive-grant blob. Parse it,
   derive the one profile from `grant.profileId`, validate Registry lineage,
   selected contained-root/store integrity, state-root binding, `rootLimit: 1`,
   `conversationLimit: 1`, exclusive expiry, profile/global latch snapshots,
   and full Git provenance. The grant contains no event, intake, pointer,
   evidence, destination, lease, capability, or
   gateway-completable field.
3. If the prior clean state is `DISABLED_CLEAN`, make its legal transition to
   `DISABLED_DEFAULT`; then durably transition to
   `RECEIVE_GRANTED_ONE_PROFILE` for the grant-selected slug. Any other active,
   retired, expired, latched, or contradictory state fails closed.
4. Parse the owner-only secret file through `parseSecretConfigFile`. Parse both
   records, prove their one shared workspace and sole Leo identity, require any
   existing authorized-user collection to be exactly the Leo singleton, and
   prove cross-profile App, immutable channel, bot-token, and app-token
   separation. Retain only the selected record in the live client objects. No
   value is copied to logs, status, process environment, argv, or durable state.
5. Open the selected profile store; initialize/replay the exact receive-grant
   state; construct the service and bind the Socket envelope handler. Construct
   one `NodeAs1WebClient`, `NodeAs1ConnectionsOpener`,
   `NodeAs1WebSocketFactory`, and selected-profile raw Socket. The other client
   slot remains unconstructed.
6. Durably transition to `AUTHENTICATING_ONE_PROFILE`. Run `auth.test` with the
   selected bot token and require exact workspace; run `bots.info` and require
   exact bot/user/App identity. Only then call `apps.connections.open` with the
   selected app token and open its bounded ephemeral WSS URL.
7. Require the first bounded Socket frame to be `hello`; inside the raw message
   callback require exact `connection_info.app_id` and the construction-bound
   control/readiness seal. Leave the transport in
   `AUTHENTICATED_QUARANTINE`: no Events API frame is parsed, queued for the
   application, or acknowledged yet.
8. Durably transition `AUTHENTICATING_ONE_PROFILE` to
   `RECEIVING_ONE_PROFILE`, recheck the same selected profile/control/latch
   facts, then call the new one-use `armReceive()` transition. Only now may the
   raw transport parse and deliver an Events API envelope.
9. Run bounded recovery, then receive. A grant-expiry timer closes new receive
   at the exclusive expiry; it never renews, switches profiles, or reconnects.

The small `hello`/arm interval is explicit. The adapter may hold at most one
already-bounded raw post-hello frame without parsing it while the durable arm is
in flight; a second frame, an activation failure, or any malformed frame
latches and closes. On successful arm the one raw frame is parsed through the
normal path. This is not a second queue or authority path, and no ACK is possible
before arm. Tests must also prove the zero-held-frame normal case. If independent
review rejects even this one bounded handoff, the safe alternative is a
fail-closed close before receive; implementation must not silently reintroduce
the current pre-gate race.

## 7. Receive, expiry, and Mission intake

The existing `As1InboundService` remains the only event classifier and
persist-before-ACK state machine. The selected profile accepts only the exact
workspace, App, private channel, Leo user, root/thread shape, and bounded
message union already reviewed in Phase A.

For this private Phase B run, the accepted principal set is exactly Leo in the
one configured workspace. A different workspace or user is rejected before
root binding, and the implementation adds no multi-user/workspace branch or
allowlist-management seam. Existing continuation contracts remain unchanged,
but the real rehearsal does not exercise them: it admits one top-level Leo root
and waits for one final result in that root.

For the first eligible top-level message it preserves this happens-before
chain:

```text
immutable receipt + envelope/event dedupe
  -> atomic UNBOUND to ROOT_BOUND at trusted boundAt < expiresAt
  -> payload-free one-use Socket ACK
  -> TRANSPORT_ACK_RECORDED
  -> canonical As1MissionIntakeV1 + As1AdvisorPointerV1 materialization
```

The grant has exactly one root slot and one conversation. A second top-level
message is durably rejected. A continuation is accepted only under the exact
bound root and one open, exact-kind pending question; consumption linearizes at
`consumedAt < expiresAt`. Root binding and question consumption are the only
receive-expiry decision points. Slack timestamps, receipt time, retries, restarts,
and evidence never extend expiry.

The generated `As1MissionIntakeV1` is the canonical AS1 Mission intake. It is
not an Agent Office Mission Manifest and cannot dispatch an actor. Creation of a
canonical Mission Manifest remains an Advisor operation under separate
authority and may only be referenced by later accepted Advisor evidence.

After `TRANSPORT_ACK_RECORDED`, local intake/pointer materialization may drain
once even if receive authority has since expired. A kill, latch, corruption, or
ambiguous state still forbids the drain.

## 8. Actual Slack Web/Socket and same-thread outbound composition

There is exactly one selected-profile Web port. Its representable calls remain:

- `auth.test`;
- `bots.info`;
- `chat.postMessage`.

There is exactly one selected-profile raw Socket port. Automatic provider ACK,
automatic reconnect, SDK retry, token swap, and `@slack/socket-mode` remain
absent. The Socket envelope handler calls only
`As1InboundService.processEnvelope`.

After exact Advisor evidence is accepted, only the branded
`As1AcceptedOutbound` returned by `As1EvidenceIngress` may enter `As1Outbox`:

- accepted Advisor ACK evidence proves transport but creates no Slack post;
- accepted Advisor INTAKE evidence creates the bounded `ACK` projection;
- accepted RESULT evidence creates the bounded terminal `RESULT` projection.

The reused ingress retains its reviewed Phase A `QUESTION` variant unchanged,
but the private Phase B Git source does not enumerate or submit question
evidence. The live run therefore cannot open a question cycle and exercises only
the same-thread ACK/result path.

`As1Outbox` resolves `channel` and `thread_ts` from the immutable root
correlation and compares the channel to the selected profile. Evidence cannot
supply either destination. Posts use plain bounded text, `mrkdwn: false`, no
blocks/attachments/metadata/mentions, and the existing safe-retry/ambiguous
no-resend rules. Every projection therefore remains in the one original Leo
root thread.

## 9. Post-intake delivery authority and exact tmux transport

### 9.1 Fixed artifact discovery

Only after the intake and pointer are durable does the composition poll the
construction-bound mission authority root for one path derived from:

```text
<fixed authority root>/runtime-authority/<profile-state-slug>/<intakeId>/pointer-delivery-grant.json
```

Absence is `AWAITING_POINTER_DELIVERY_GRANT`, not implied approval. The parsed
`As1PointerDeliveryGrantV1` must match the receive binding, pilot, profile,
intake, event, root correlation, pointer ref/hash, Team/Actor/role lineage,
governance/Registry/control/latch snapshots, and fixed evidence prefix. It must
be newly added, committed, pushed, clean, upstream-ancestral, unexpired, and
unused. The gateway cannot create or complete it.

Only after that grant is accepted does the composition poll the sibling fixed
path `readiness-lease.json`. The Advisor creates that lease from a fresh
structured read-only observation of the live destination. It must be committed,
pushed, exact to the grant, `useLimit: 1`, readiness exactly
`IDLE_FOR_ONE_AS1_POINTER`, and live for no more than 30 seconds. A missing or
expired lease causes no fallback; the Advisor must create a new grant/lease
chain under new explicit authority if another attempt is wanted.

### 9.2 Runner reuse and fresh destination proof

The composition reuses the existing `As1ExactTransport` unchanged. The only
new production adapter is `NodeAs1TmuxPort`, implementing its already-reviewed
closed port. It exposes only structured preflight, private-buffer existence,
load of the internally derived contained pointer file, paste to the lease-bound
pane, Enter to that same pane, and deletion of an unpasted private buffer under
the existing recovery proof.

The port uses fixed `/usr/bin/tmux`, `shell: false`, a fixed environment, bounded
time/output, the reviewed structured preflight format/decoder, strict pane-ID
grammar, and internal paths. It has no capture-pane, show-buffer, run-shell,
new-session, arbitrary argv, caller file, generic command, or message-body
input. Exact Delivery v2 and `NodeExactTmuxMutationRunner` remain byte- and
behavior-compatible; AS1 does not route through v2 or widen its fixed target.

`As1ExactTransport` performs the first live preflight against every lease field,
creates the in-memory capability only after that match, records `PREPARED`,
atomically consumes the delivery grant and lease, loads the private buffer,
then performs a second fresh preflight immediately before paste. No pane/session
value from a previous run, current shell, historical evidence, stale lease, or
the other profile may substitute. Target change stops before paste or records
manual reconciliation according to the existing journal boundary.

`PASTE_STARTED` remains the no-retry boundary. Paste or Enter is never repeated.
The terminal `TRANSPORT_RECORDED` record plus the atomic consumption record are
read through the new typed store accessors and become inputs to
`buildEvidenceAuthority`; they are never reconstructed from logs.

## 10. Evidence ingress without terminal or prompt exposure

The delivery grant fixes a profile-specific evidence prefix. The Git source
derives only these bounded paths below `<evidencePrefix>/<intakeId>/`:

```text
ack.json
intake.json
result.json
```

The existing question schema and Phase A continuation behavior remain
unchanged, but this private one-round-trip composition neither enumerates nor
projects question artifacts. The reader accepts no filename, path, repository,
or kind from Slack or a caller.

The only evidence bytes are committed canonical JSON artifacts. The gateway
does not call `capture-pane`, read a tmux scrollback, inspect a prompt, scrape a
terminal, read session stdout, infer an ACK from idle state, or project chat
prose. Evidence must pass the existing exact schema, source-commit/blob/hash,
first-addition, upstream, clean-state, ancestry, profile/lineage, intake,
cross-stage, and result-artifact checks.

Stage order is:

```text
ACK -> INTAKE -> RESULT
```

Exact re-observation is idempotent. Reorder, rewrite, removal, divergent
duplicate, wrong profile, historical Foundation identity, wrong result ref, or
accepted-stage regression latches the selected profile. Polling stops before a
new outbound begins whenever control is draining or latched.

## 11. Lifecycle, kill, manual stop, drain, and replay

### 11.1 Foreground ownership and closed process control

`start` is a foreground process and holds the existing writer lock for its full
lifetime. It installs only SIGINT/SIGTERM shutdown handlers. It opens no local
TCP/HTTP listener, Unix command socket, systemd unit, daemon, browser route, or
general command endpoint.

The existing writer-lock record already binds PID, boot ID, build ID,
state-root ID, acquisition time, and an ownership token. The read-only lock
observer strictly parses that existing record. A separate `stop` command may
send only SIGTERM to the PID from the exact owner-only AS1 writer lock after it
proves the same boot, build ID `as1-slack-pilot`, state-root ID, owner UID, live
process, and exact AS1 CLI entry. There is no PID argument and no arbitrary
signal. It waits a bounded deadline for lock removal and reports stable codes.

`status` reads only strict lock/control projections and prints no IDs, paths,
grant values, payloads, token facts, Slack response, or tmux coordinate. The
existing closed `restart` verb remains grammar-compatible but is live-disabled:
it fails closed without opening Web/Socket/tmux activity. Only a separately
issued foreground `start` may begin either private pilot.

### 11.2 Clean drain order

SIGINT, SIGTERM, grant expiry, or planned stop executes once:

1. atomically set `DRAINING`, close Socket admission, and abort new Git polls,
   exact-delivery starts, and outbox starts;
2. allow only already-admitted envelope work and exact atomic writes to reach
   their reviewed durable boundary;
3. materialize already-`TRANSPORT_ACK_RECORDED` decisions under the offline
   drain gate, without accepting new receive state;
4. wait to a fixed deadline for in-flight store, delivery, evidence, and outbox
   operations; any ambiguous tmux/Slack side effect becomes
   `MANUAL_RECONCILIATION_REQUIRED` and latches;
5. disconnect the selected raw Socket, await durable latch persistence, discard
   the ephemeral URL, and prove no second Socket exists;
6. persist `DISABLED_CLEAN`, fsync control, release the writer lock, remove the
   foreground process, and emit redacted status.

An irreversible global kill or profile latch closes admission and every new
side effect immediately. Global kill is used for cross-profile, secret-pair,
global-control, or root-alias contradictions. Profile latch is used for a
selected-profile provider, state, delivery, evidence, or outbound ambiguity.
Neither has a reset command.

### 11.3 Manual re-entry and existing replay boundaries

There is no automatic restart or reconnect. After a clean stop, only a new
explicit foreground `start` under separate operator action may re-open the
composition, and the two-run rehearsal retires each one-round-trip grant rather
than re-entering it. Any later separately authorized manual start replays
immutable receipt/dedupe/receive/transport/outbox journals and does not create a
root slot, renew expiry, or resend past an ambiguous boundary. An expired or
retired grant remains disconnected; only bounded offline materialization of
already-ACK-recorded work is permitted.

Any interrupted tmux nonterminal journal and any outbound request at or beyond
the ambiguous boundary becomes manual reconciliation; it is never replayed as a
new send. A provider disconnect durably latches and never reconnects
automatically.

A hard crash continues to follow the existing writer-lock and journal behavior:
the next start fails closed and no Phase B code auto-deletes, auto-recovers, or
adds a recovery framework. Any later stale-lock recovery is a separate
operator-authorized action outside this implementation map. Deleting the lock,
a journal, a latch, or dedupe state is not recovery.

## 12. Exact sequential pilot procedure

Every step below requires the later independent implementation/security PASS
and an exact Advisor live-pilot handoff. This Designer did not execute it.

### 12.1 Common preflight

1. Verify the exact reviewed product commit is clean and upstream-equal.
2. Verify the fixed descriptor is committed/pushed and names exactly the one
   intended receive-grant path; verify that grant and its frozen basis.
3. Verify the owner secret file only through `redacted-check`; record only
   `LOCAL_SYNTAX_PASS`. This offline command initializes/validates the local
   state-root/control records needed for later snapshotting but performs no Web,
   Socket, or tmux call. Require its `--env-file` path to equal the descriptor's
   one reviewed secret path. Do not print or copy values.
4. Verify the canonical state root, format marker, control/latches, absent
   writer lock, zero AS1 process, and zero AS1 listener.
5. Verify both profile Registry rows, the global kill disengaged, the selected
   profile unlatched, and the other profile inactive.
6. Verify the selected receive grant is unexpired immediately before `start`.
7. Prove both fixed records name the same one configured workspace and Leo as
   the sole authorized user, while each names its own immutable App/channel
   pair. No second workspace, user, App, or channel is admitted.

### 12.2 Agent Office pilot

1. Activate only the receive grant whose parsed profile is
   `AGENT_OFFICE_ADVISOR`; start one foreground process.
2. Record redacted proof of ordered grant provenance, secret parse, Web identity,
   Socket hello identity, and receive arm. No value or WSS URL is evidence.
3. Leo supplies exactly one bounded root in the fixed private Agent Office
   channel. This is the channel's sole real round trip. Prove one receipt/root
   binding, Socket ACK, canonical Mission intake, and pointer.
4. The responsible Advisor independently commits/pushes the exact post-intake
   delivery grant and a fresh <=30-second one-use destination lease. The
   composition performs one exact pointer attempt.
5. The Advisor commits/pushes ACK and INTAKE evidence, then one RESULT evidence
   artifact. Prove the projections stay in the original Slack root and no
   question or second conversation is exercised.
6. Stop, drain, and audit. Require terminal or explicit reconciliation state,
   no unconsumed ambiguity, Socket closed, lock absent, zero AS1 process, and
   zero AS1 listener. Retire the Agent Office receive grant under separate
   Advisor authority. Do not start Foundation until the audit is accepted.

### 12.3 Foundation pilot

1. Make a new committed/pushed value-only activation at the same fixed
   descriptor path naming a different immutable receive grant whose parsed
   profile is `FOUNDATION_ADVISOR`.
2. Re-run the complete preflight. Require the Foundation contained root,
   `foundation-advisor-20260714-01`, new receive/delivery grants, new lease and
   capability, new evidence prefix, empty Foundation root slot, and no inherited
   Agent Office state/evidence.
3. Repeat exactly one Leo root-to-final-result round trip in the fixed Foundation
   channel, including exact pointer, evidence, and same-thread outbound. No
   question or second conversation is exercised.
4. Stop and audit exactly as above. Retire the Foundation receive grant. Leave
   the descriptor committed/pushed default-disabled and the process stopped.

At no point are both profiles live, authenticating, receiving, polling, or
delivering. No other workspace or user participates. A failure in Agent Office
does not authorize switching to Foundation.

## 13. Validation gates

### 13.1 Changed-file and focused adapter gates

- Changed-file checks, `npm run typecheck`, and `npm run build` pass without
  suppressions for the affected TypeScript paths.
- Descriptor parsing remains exact-key v1; default disabled is proven; profile,
  descriptor, grant, repository, and destination inputs are absent from argv and
  environment.
- State-root/ref/hash binding, Registry lineage, control/latch snapshots, and
  common writer mutual exclusion are proven for both profiles.
- The Git source proves fixed path, unique first addition, exact blob, pushed
  ancestry, dirty/rewrite behavior, bounded output/time, no shell, and no fetch.
- The Socket proves wrong Web/App/token pairs fail before receive, hello remains
  pre-event, arm is one-use, no pre-arm parse/ACK occurs, and the bounded raw
  handoff cannot overflow or cross generations.
- The Node tmux port's complete argv allowlist is asserted. Static scans prove
  no capture/show pane, generic command/target, caller file, shell, or historical
  fallback path.
- The closed stop path proves exact AS1 lock ownership, sends only SIGTERM to
  that owner, drains, releases the lock, and redacts status; it has no caller PID
  or signal input.

### 13.2 Focused composition and direct regressions

- Run the directly affected existing Phase A startup-identity, raw-Socket,
  inbound/thread, exact-transport, evidence-ingress, outbound/replay, lifecycle,
  and Exact Delivery regressions; do not run unrelated suites.
- Run one focused synthetic Agent Office composition and then one focused
  synthetic Foundation composition against the same disposable common root;
  prove one fixed workspace, the Leo singleton, immutable per-profile App/
  channel bindings, one profile at a time, one root-to-result round trip each,
  and separate contained state.
- Prove exact startup call order with spies and zero Web/Socket calls on every
  earlier failure.
- Prove one root, second-root rejection, exclusive expiry, post-ACK
  materialization, delivery-grant/lease one-use, two live preflights, no-retry
  ambiguity, and typed evidence-authority construction.
- Prove the pilot path's ACK -> INTAKE -> RESULT order, immutable Git evidence,
  exact same-thread result, and replay without a second outbound.
- Prove manual/signal-bound stop, bounded drain, lock release, redacted status,
  and that `restart` cannot open a live connection.
- Run changed-file secret/static scans and only the directly affected Phase A
  and Exact Delivery regressions.

No automated test may use a real token, Slack network, tmux mutation, live pane,
or owner state root. Synthetic placeholders and fake ports only.

### 13.3 Owner-only live rehearsal gates

Live rehearsal is a separate, explicitly authorized operation. It records only
stable booleans/reason codes and Git artifact refs/hashes:

- process count exactly one during a pilot and zero before/after;
- listening-socket count for the AS1 PID exactly zero throughout (Socket Mode is
  outbound) and no remaining AS1 socket/process after stop;
- exact identity-proof stages completed, with no IDs/tokens/URL bodies logged;
- the one configured workspace and Leo singleton held throughout;
- exactly one root-to-final-result round trip consumed in the fixed channel;
- one exact fresh leased destination and two matching preflights;
- one terminal tmux journal or explicit manual reconciliation, never retry;
- exact evidence stages and same-thread outbound journal;
- clean stop, lock absence, and profile isolation before the next pilot.

Live failure stops the sequence and returns evidence to the Advisor; it does not
authorize a workaround or the other profile.

## 14. Rollback and token order

### 14.1 Before any live connection

1. Keep or restore the fixed descriptor to `enabled: false` and
   `receiveGrantRef: null`, committed and pushed.
2. Prove writer lock absent, AS1 process count zero, and AS1 listening-socket
   count zero.
3. If abandoning setup, delete the external owner secret file without reading
   or recording it.
4. Revoke both app-level tokens, then both bot tokens; remove/uninstall both
   apps if directed.
5. Preserve non-secret commits and evidence.

### 14.2 During or after a live connection

1. Engage the durable global kill before any new receive/delivery/outbound
   start.
2. Stop dequeue and new side effects; mark every started ambiguous tmux/Slack
   write `MANUAL_RECONCILIATION_REQUIRED`.
3. Close the selected Socket and prove the AS1 process, writer lock, outbound
   Socket, and listening-socket count are all zero.
4. Revoke app-level tokens first, Agent Office then Foundation (or both in the
   owner-approved order); only after Socket closure revoke bot tokens, Agent
   Office then Foundation. Never revoke bot tokens first while an app-level
   Socket can still receive.
5. Preserve state, journals, dedupe, correlations, grants, consumption, and
   evidence byte-for-byte. Compare Slack history to journals read-only and do
   not post a probe.
6. Require a new reviewed recovery version and new authority before reconnect.

Never delete/clear/rewrite a lock without explicit stale-lock recovery,
journal, latch, dedupe record, evidence artifact, root binding, or consumption
record. Never reuse or extend an expired/retired/latched receive grant or a
consumed delivery grant, lease, or capability. Never switch profiles as
rollback.

## 15. Explicit non-expansion proof

This design requires:

- no database, database schema, migration, queue service, or cache;
- no change to any existing AS1 receive/delivery/lease/evidence/outbox schema or
  durable record layout;
- no organization Registry row, identity, join-key, or Registry-schema change;
- no Exact Delivery v2 type, target, activation, journal, state, or behavior
  change;
- no systemd unit, daemon supervisor, cron job, permanent service, or auto-start;
- no HTTP server, webhook, Request URL, OAuth server, browser route, UI,
  Dashboard, Living Office, or arbitrary command surface;
- no Agent Office pixel/scene/UI change and no VibeNews change;
- no FOUNDATION, SIASIU, or Cosmile product change and no `foundation-docs`,
  Slack platform, or other external product-code modification by the Phase B
  implementation Worker;
- no simultaneous/open-ended two-profile operation and no unrelated exhaustive
  test matrix;
- no second workspace or authorized user, no mutable App/channel routing, and
  no extension or exercise of existing allowlist structures beyond Leo;
- no multi-user/multi-workspace framework, admin plane, high availability,
  generic rollout machinery, or enterprise-scale test matrix;
- no new package or lockfile change; the already-pinned public-root
  `@slack/web-api@8.0.0` and `ws@8.21.1` adapters are sufficient.

The new Git source is read-only. The new AS1 tmux port is behind the existing
exact authority and journal. The lock observer reads an existing schema. The
Socket arm is an adapter lifecycle transition. The two store additions are
typed reads of existing records. These are composition changes, not authority
or persistence redesigns.

## 16. Implementation readiness and deliberately unset live facts

Design state: `READY_FOR_INDEPENDENT_DESIGN_REVIEW`.

Corrected proposed implementation path count: `14`.

Revised completion estimate: `3-5 hours`, excluding time waiting for Leo's two
Slack messages.

Private pilot lock: one configured workspace, Leo only, two fixed Apps and
immutable channel mappings, one manually started foreground profile at a time,
one real root-to-result round trip per channel in strict sequence, and manual
stop before the next profile.

Implementation must not begin until an independent Reviewer issues a design
verdict and the responsible Advisor creates an exact implementation handoff.
This document does not issue its own review verdict.

The following live facts remain intentionally unset and are not blockers to
implementation:

- all real Slack workspace/App/channel/user IDs and token values;
- the exact future receive-grant, delivery-grant, readiness-lease, and evidence
  artifact commits/IDs;
- the fresh live tmux session/window/pane coordinates and PID for each attempt;
- the final reviewed Phase B implementation commit and independent review
  evidence;
- owner execution of the state-root instruction and live zero-process/listener
  checks.

They become inputs only through later owner setup evidence, exact committed
Advisor authority, fresh read-only observation, and independent review. No
placeholder or fallback may be substituted in production.
