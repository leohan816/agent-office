# Agent Office AS1 Phase B Live Composition Design Delta

Status: `REVIEW_READY_PATCHED_3_DESIGN_ONLY`

Mission: `AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_PILOT_001`

Pass: `PHASE_B_F05_EXACT_BRIDGE_DESIGN_PATCH_3`

Authority: committed Designer patch-3 handoff
`56_PHASE_B_DESIGN_PATCH_3_HANDOFF.md` at
`6186503f7e2c45dacbce83869aa2579d4bf073bd`

Exact patch-2 design candidate and parent:
`1fad9734e83c751b911accffbb12d65df9e775c8`

First patched design and exact parent:
`7ed79bbfd7deea0f8458a3965734ebd1de98eb35`

Original reviewed design commit:
`3d359639c4d819f1c601481245daa81d5de9d5fc`

Complete same-Reviewer `NEEDS_PATCH` input:
`55_PHASE_B_DESIGN_DELTA_REVIEW_2_RESULT.md` at governance commit
`fea560eaea284e0b84d864d470cddd331568cdc8`

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
unit, HTTP/UI surface, or external product-code change. This third patch changes
only F05-D1. It preserves the same Reviewer's closed F01, F02-D1, F03-R1, and
F04 contracts byte-for-contract except for direct F05 consistency references.
F05-D1 now fixes the complete bridge literal, interpreter object identity and
per-use pinned-FD execution binding, exact schemas and bounds, and a capability
preflight that precedes every startup mutation. Implementation may therefore
proceed only after the exact same Reviewer accepts this delta and the Advisor
issues a new exact implementation handoff.

The delta is deliberately small:

1. load one exact Advisor-created receive grant from fixed committed operator
   activation material;
2. assemble the existing store, service, Slack Web/Socket, exact delivery,
   evidence-ingress, and outbox modules into one foreground process;
3. add the missing production Git-artifact reader and narrow AS1 tmux port,
   including exact scoped-writer pointer bytes, two complete precommit
   destination observations, and one complete post-load/pre-paste observation;
4. keep the Socket in authenticated quarantine until the durable receive state
   is armed;
5. make the closed lifecycle CLI work with a long-running process, including
   distinct fixed clean-stop and durable incident-kill actions whose exact
   owner proof and fixed signal share one Linux `pidfd` incarnation;
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

This is not a `HOLD`: the authorized Linux target supplies `pidfd_open(2)` and
`pidfd_send_signal(2)` through a fixed standard-library bridge that fits in the
already-listed writer-lock/lifecycle paths. It needs no package, helper path,
schema, listener, generic command surface, or implementation-map expansion.

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
| `src/runtime/as1-slack-pilot/composition.ts` | Replace the Phase A disconnected stub with the single-profile, one-workspace/Leo-only foreground composition for one root-to-result round trip; keep the receive grant's frozen evidence hashes distinct from the construction-bound live control/latch predicate; bind the selected profile into delivery; provide bounded authority/evidence polling, startup order, incident gating, drain, and redacted status. |
| `src/runtime/as1-slack-pilot/cli.ts` | Keep a closed verb-specific grammar and fixed descriptor/state-root construction; reject descriptor/profile/grant/PID/signal/path/reason overrides; hold explicit `start` in foreground; implement distinct lock-bound zero-operand `stop` and `incident-kill`, plus read-only `status`; keep `restart` live-disabled. |
| `src/adapters/gateways/slack-pilot/git-artifact-source.ts` | New read-only, fixed-root Git source for the receive grant, delivery grant, readiness lease, and evidence. It uses closed `/usr/bin/git` argv, never fetches, and distinguishes `NOT_READY` from accepted-artifact divergence. |
| `src/adapters/gateways/slack-pilot/socket-client.ts` | Add authenticated-quarantine arming so no event is parsed or delivered between verified `hello` and the durable `RECEIVING_ONE_PROFILE` transition. |
| `src/adapters/gateways/slack-pilot/exact-transport.ts` | Add the production `NodeAs1TmuxPort` behind the existing journal/one-use transport; require the scoped writer's exact canonical-plus-LF pointer bytes, raw hash, content-addressed filename, private mode, and 32-KiB bound; pin once and load only through closed stdin; bind the selected profile; perform two complete exact-key/all-15-field observations before `PREPARED` and a third complete observation after `BUFFER_LOADED` immediately before `PASTE_STARTED`; preserve manual reconciliation and the no-retry boundary. |
| `src/application/slack-pilot/inbound-store.ts` | Add read-only typed accessors for the terminal tmux delivery record and atomic grant/lease consumption record needed by `buildEvidenceAuthority`; do not change record shapes or paths. |
| `src/operations/readiness/as1-slack-control.ts` | Add a construction-bound live delivery-actionability predicate and redacted observation, plus the fixed operator-incident kill transition; retain the frozen authority fields, state vocabulary, transition table, latches, and lock ownership. |
| `src/persistence/file-store/writer-lock.ts` | Retain the original close-on-exec `O_EXCL` lock descriptor for the foreground lifetime without changing `agent-office.writer-lock.v1`; before startup mutation verify and execute the exact Python `3.14.4` object through its pinned inherited FD using the full sealed bridge literal, exact two-key environment, exact schemas/bounds, and no-signal capability operation; for closed `stop`/`incident-kill`, bind two complete observations and the fixed signal to one pidfd plus the lock descriptor/inode, PID start ticks, UID, boot, executable inode, exact AS1 entry, root, and build. |
| `docs/operations/AGENT_OFFICE_AS1_SLACK_SETUP.md` | Add the exact `AS1_SLACK_STATE_ROOT` owner instruction and the closed foreground start, clean-stop, and zero-operand incident-kill procedure for the private pilot. |
| `tests/adapters/as1-slack-socket-client.test.ts` | Prove authenticated quarantine, receive arm, pre-arm bounds, disconnect, and no pre-arm parse/ACK. |
| `tests/integration/as1-slack-exact-transport.test.ts` | Prove exact canonical-plus-one-LF pointer representation, raw hash/filename, private mode, 32-KiB boundary, no-follow/type/owner/grammar/correlation checks, pin/no-reopen and closed stdin/argv; prove profile-bound equality in two complete precommit observations plus one complete post-load/pre-paste observation, precommit rejection versus postcommit manual reconciliation, one-use delivery, and unchanged no-retry behavior. |
| `tests/integration/as1-slack-live-composition.test.ts` | New single focused composition test: prove distinct frozen/live control records complete unchanged evidence equality only while the live predicate is actionable; then run one fixed-workspace/Leo-only Agent Office root-to-result round trip and stop followed by one isolated Foundation round trip. |
| `tests/integration/as1-slack-git-artifact-source.test.ts` | New focused fixed-path test proving ready/not-ready observation, exact committed bytes, and no acceptance of a changed artifact. |
| `tests/operations/as1-slack-lifecycle.test.ts` | Extend the focused lifecycle test for explicit foreground start; zero-mutation interpreter/API preflight; exact interpreter device/inode/hash/version and pinned-FD replacement resistance; literal/schema/byte/count/time bounds; retained original lock-descriptor ownership; fast valid acquisition; distinct same-pidfd clean stop and durable incident kill; exit/reap/PID-reuse and identity-race rejection; bounded shutdown/lock release; live-disabled restart; and stable redacted status. |

No other source, test, configuration, package, lockfile, Registry, v2, UI, or
external project path is needed. In particular, the implementation must not modify
`src/adapters/gateways/tmux-advisor/*`, `src/application/advisor-inbox/*`, the
organization Registry, Phase A contract schemas, or package dependencies.

F03 does not require `src/adapters/gateways/slack-pilot/exact-authority.ts`.
The selected closed `As1Profile` is already available to composition and is
bound once into `As1ExactTransport`; the same exact-transport path owns the
complete three-observation shape and comparison. F05's fixed bridge is a
compile-time literal in the already-listed `writer-lock.ts`, not a helper file.
The implementation map therefore remains 14 paths, not 15.

The Worker does not modify the default-disabled descriptor; the value-only
activation is a later exact reviewed pilot operation. No separate Phase B
as-built document is created: the existing Worker result, independent Reviewer
result, and Advisor audit hold implementation and live evidence.

### 3.2 Reviewed Phase A boundaries reused

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
- the existing `As1ExactTransport` durable journal, capability, one-use
  consumption, and no-retry semantics, with only the F01-F03 checks and port
  shape boundedly repaired in its already-listed path;
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

`redacted-check` and `start` require this exact environment instruction and the
descriptor's exact secret path. The observer verbs `stop`, `incident-kill`,
`status`, and live-disabled `restart` resolve only the construction-bound state-
root literal above; they accept no state-root, secret, profile, PID, signal,
destination, or reason operand. `redacted-check` remains local syntax only and
does not open Slack or tmux.

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

The receive grant freezes `globalControlSnapshotHash` as
`hashCanonical(<exact parsed pre-transition
agent-office.as1-global-control.v1 record>)` and freezes
`profileLatchSnapshotHash` from the exact parsed selected latch record. Those
two evidence-authority values are immutable lineage, not live readiness. The
pointer-delivery grant must copy them byte-for-byte from the receive grant; the
capability and terminal delivery facts must copy them from that delivery grant.
No delivery path recomputes either frozen field from the later live control
record. This preserves the unchanged `buildEvidenceAuthority` equalities across
receive grant, pointer-delivery grant, and delivery facts. No second durable
snapshot field or schema change is introduced.

### 5.3 Separate construction-bound live actionability

Live control and latch state is proven by a separate, non-serializable predicate
bound at composition construction to the owned `As1SlackControl`, selected
profile slug, canonical common root, and writer lock. A fresh evaluation parses
the current exact control and selected latch facts and is true only when:

- the control still owns the one writer lock;
- `state` is exactly `RECEIVING_ONE_PROFILE`;
- `killEngaged` is false, `latchReason` is null, and `activeProfileSlug` equals
  the selected closed profile slug;
- the selected profile latch is exactly unlatched with null reason/time; and
- the synchronous incident gate is open.

The delivery-grant poll may parse a candidate, but it does not accept it until
this live predicate succeeds. The exact transport evaluates it again before
all three complete destination observations, `PREPARED`, authority consumption,
buffer lookup/deletion/load, every journal transition, paste, and Enter. A false
or unreadable predicate stops before the next boundary; after `PREPARED` it
follows the existing manual-reconciliation rule. The live record and its hash
are never placed in a grant, capability, delivery fact, evidence artifact, or
new durable field. The hello seal continues to use its separate construction-
owned authentication predicate.

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

1. After the closed argv/environment grammar has identified `start`, but before
   resolving, opening, validating, or initializing the state root, run the
   exact interpreter-identity/API/no-signal bridge preflight in section 11.1.
   It may open only the pinned interpreter and read `/proc` facts about its own
   helper incarnation. Failure returns the stable preflight error with zero
   state-root directory, marker, control, latch, lock, secret, Web, Socket, or
   tmux residue. Only after success resolve and validate the fixed state root;
   initialize only an owner-prepared fresh root; acquire its one `WriterLock`;
   validate the state-root marker, global control, and both latch records under
   the lock. Reject a second process or stale lock. Retain and prove
   close-on-exec on the original lock descriptor. No profile is selected and no
   secret or network access has occurred. Install the clean-stop and fixed
   SIGUSR2 incident handlers as soon as ownership is established and before any
   later side effect.
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
governance/Registry snapshots, the receive grant's unchanged frozen
`globalControlSnapshotHash` and `profileLatchSnapshotHash`, and the fixed
evidence prefix. It must be newly added, committed, pushed, clean, upstream-
ancestral, unexpired, and unused. Parsing or observing a candidate is not
acceptance: the construction-bound live predicate in section 5.3 must also be
actionable immediately before acceptance. The gateway cannot create or
complete the grant, substitute a fresh live hash into it, or add another
snapshot field.

Only after that grant is accepted does the composition poll the sibling fixed
path `readiness-lease.json`. The Advisor creates that lease from a fresh
structured read-only observation of the live destination. It must be committed,
pushed, exact to the grant, `useLimit: 1`, readiness exactly
`IDLE_FOR_ONE_AS1_POINTER`, and live for no more than 30 seconds. A missing or
expired lease causes no fallback; the Advisor must create a new grant/lease
chain under new explicit authority if another attempt is wanted.

### 9.2 Exact pointer-byte seal

Composition binds the exact selected profile artifact root and the durable
pointer ref produced by that profile's just-completed materialization. The
validated grant must name that same ref; the shared contained-pointer parser
then derives the profile slug, delivery ID, and content-addressed JSON filename,
and the private buffer name follows from those values. The transport accepts no
path parameter. Before `PREPARED`, authority consumption, buffer inspection, or
any tmux mutation, its construction-bound resolver resolves that one agreed
relative ref below the selected artifact root and performs one bounded open:

1. validate every parent as contained, owner-UID, private, and non-symlink;
2. open the leaf once with `O_RDONLY | O_NOFOLLOW` and retain that file
   descriptor through the final precommit path-identity check;
3. `fstat` the descriptor and require an owner-UID regular file, one link, no
   group/other permission bits at all (`(mode & 0o077) === 0`), and an inclusive
   byte length of `1..(32 * 1024)`; this is the unchanged
   `putScopedCanonicalJson` pointer-writer ceiling, not the generic one-megabyte
   durable-index ceiling;
4. read only from that retained descriptor into one buffer bounded by the
   `fstat` size, require the exact byte count and EOF, decode UTF-8 fatally,
   parse JSON, and run the exact-key `agent-office.as1-advisor-pointer.v1`
   decoder to produce `strictlyParsedPointer`;
5. construct the one accepted representation with this exact formula:

   ```ts
   Buffer.concat([canonicalBytes(strictlyParsedPointer), Buffer.from("\n")])
   ```

   and require the on-disk buffer to equal it byte-for-byte. This admits exactly
   one terminal LF and rejects a missing LF, a double LF, other trailing bytes,
   or JSON-equivalent but noncanonical bytes;
6. compute one `rawSha256 = sha256Bytes(onDiskBytes)`, require
   `grant.pointerHash === rawSha256`, and require the content-addressed leaf name
   to be exactly `${rawSha256.slice("sha256:".length)}.json`; and
7. require exact pointer correlations for receive grant/binding, pilot, profile,
   intake, source event, root correlation, and the grant-derived pointer
   artifact path/delivery ID.

Immediately before the pre-commit boundary, `lstat` of the contained leaf must
still match the retained descriptor's device, inode, type, owner, and link
facts. Replacement before that check is `POINTER_ARTIFACT_INVALID` and leaves
the journal absent, authority unconsumed, and tmux untouched. Replacement after
that check cannot change the operation: the path is never opened again and only
the already-pinned bytes are loadable.

`NodeAs1TmuxPort` therefore exposes a construction-only `loadVerifiedBuffer`
operation accepting the pinned bytes, not a file path. It invokes only fixed
`/usr/bin/tmux load-buffer -b <derived-private-name> -` argv with `shell: false`,
writes the exact bytes to a closed stdin, and closes stdin before awaiting the
bounded result. It never places pointer bytes in argv, environment, logs, a
temporary path, or a caller-selected buffer. Buffer name, argv, target, source
root, and source relative path all remain construction-bound and must agree
with the validated grant.

### 9.3 Complete profile and destination binding

Before capability creation, the lease destination must satisfy this immutable
profile invariant:

```text
lease.profileId == selectedProfile.profileId
lease.destination.sessionName == selectedProfile.sessionName
lease.destination.workspace == selectedProfile.workspace
lease.destination.currentCommand == selectedProfile.currentCommand
```

A profile-lineage match without these three physical-destination equalities is
insufficient. A Foundation lease naming the Agent Office session/workspace (or
the reverse) is rejected before `PREPARED`, consumption, or tmux mutation.

The lease envelope's grant/profile/lineage IDs, `readiness`, `useLimit`,
`observedAt`, `issuedAt`, and `expiresAt` are authority metadata. They are
validated and correlated statically but are not fabricated by tmux. Every field
inside `lease.destination` is a security-relevant live fact and must be returned
with the same exact-key decoder by all three structured destination
observations:

| Live destination fact | Required rule in each of the three observations |
|---|---|
| `sessionName`, `sessionId` | exact lease equality; `sessionName` also equals the selected profile |
| `windowName`, `windowId`, `windowIndex` | exact lease equality |
| `paneId`, `paneIndex`, `panePid` | exact lease equality; the construction-derived pane ID is the only query target |
| `workspace`, `currentCommand` | exact lease equality and exact selected-profile equality |
| `paneDead`, `paneInMode`, `inputOff`, `synchronizePanes` | present and exactly false |
| `activityTime` | exact lease equality and unchanged across all three observations |

No destination field is metadata-only or optional. An omitted or additional
field is a decoder failure, not a default. Freshness requires
`observedAt <= issuedAt < expiresAt`, a maximum 30-second lease, and a fresh
trusted-clock check after each observation, with all three observations
completed before the exclusive expiry. Observations one and two are complete
precommit observations. The second follows the first without any journal write,
authority consumption, tmux mutation, or caller work between them; divergence in
either rejects before `PREPARED` and leaves authority unconsumed. Observation
three is another complete query of the same construction-derived pane after
`BUFFER_LOADED` and immediately before `PASTE_STARTED`; all 15 live facts must
still equal the lease, the selected-profile equalities, and both prior
observations. Because this final divergence is postcommit, it records
`MANUAL_RECONCILIATION_REQUIRED` and performs no paste or Enter; it is never
reported as a clean precommit rejection.

### 9.4 Closed delivery sequence

The bounded F01-F03 repair preserves the existing journal and one-use model in
this exact order:

1. validate grant/lease/provenance and unchanged frozen evidence hashes;
2. require the live control/latch predicate and exact selected-profile
   destination invariant;
3. open, validate, hash, correlate, and pin the pointer bytes;
4. require the live predicate, then perform complete destination observation
   one with the exact-key/all-15-field decoder and a fresh trusted clock;
5. without intervening caller work or mutation, require the live predicate and
   perform complete destination observation two with the identical query,
   decoder, profile equalities, field comparisons, clock, and expiry checks;
6. confirm the pinned descriptor/path identity and live predicate one final time;
7. only now create the in-memory capability, record `PREPARED`, and atomically
   consume the delivery grant and lease;
8. inspect/delete only the derived unpasted buffer when existing recovery proof
   permits, load only the pinned bytes through closed stdin, record
   `BUFFER_LOADED`;
9. after that load, require the live predicate and perform complete destination
   observation three with the same construction-derived pane query, selected-
   profile equalities, exact-key/all-15-field decoder, fresh trusted clock, and
   exclusive lease-expiry check. Compare it with the lease and both precommit
   observations; and
10. only an exact match may immediately record `PASTE_STARTED`, paste, and send
    Enter to that same destination under the existing per-boundary capability
    and live-predicate checks.

Every failure through step 6 has zero tmux mutation, no `PREPARED` record, and
unconsumed authority. A step-9 false predicate, expiry, decoder failure, target
change after observation two, or target change during/after buffer load is
postcommit: transition `BUFFER_LOADED` to
`MANUAL_RECONCILIATION_REQUIRED`, leave the private buffer for manual evidence,
perform no paste or Enter, and never retry or clean up as if it were a
precommit rejection. `PASTE_STARTED` remains the side-effect no-retry boundary;
paste or Enter is never repeated. The complete fixed `/usr/bin/tmux` argv set
uses `shell: false`, fixed environment, bounded time/output, and strict
decoders. It has no capture/show pane, show-buffer, run-shell, new-session,
arbitrary argv, caller file/bytes/target, generic command, or message-body
input. Exact Delivery v2 and `NodeExactTmuxMutationRunner` remain byte- and
behavior-compatible.

The terminal `TRANSPORT_RECORDED` record and atomic consumption record carry the
receive grant's frozen control/latch hashes through the capability unchanged and
become direct inputs to `buildEvidenceAuthority`; they are never reconstructed
from logs or replaced with the current live record.

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
lifetime. It installs the clean SIGINT/SIGTERM handlers and one fixed SIGUSR2
incident handler before secrets, network, polling, or delivery can begin. It
opens no local TCP/HTTP listener, Unix command socket, systemd unit, daemon,
browser route, or general command endpoint.

The existing writer-lock record already binds PID, boot ID, build ID,
state-root ID, acquisition time, and an ownership token. Its exact
`agent-office.writer-lock.v1` keys, values, canonical-plus-LF bytes, and path do
not change. Acquisition changes only the live handle invariant: the foreground
owner retains the exact `O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW` file handle
that created `locks/writer.lock` after writing/fsyncing the existing mode-0600
record and fsyncing its directory. Before startup continues it reads the fixed
Linux `/proc/self/fdinfo/<fd>` projection and requires that descriptor to be
close-on-exec. It stores the handle in `WriterLock`, never places it in child
stdio, and does not close it until release. Release requires the retained
descriptor and a no-follow reopen of the current path to agree on device,
inode, regular type, owner, one link, private mode, and exact v1 bytes; it then
unlinks, fsyncs the lock directory, and closes the retained descriptor. A crash
closes the descriptor but leaves the existing stale-lock artifact and existing
fail-closed recovery boundary.

That retained original descriptor is the causal acquisition proof. A live owner
is valid only when the process named by the unchanged lock record still holds
exactly one close-on-exec descriptor whose device/inode is the device/inode of
that same no-follow-opened lock. `acquiredAt` remains strictly parsed evidence,
but process birth is not ordered against it or inode timestamps. `/proc/<pid>/stat`
start ticks are an exact incarnation identity value only; neither integer
`btime`, `_SC_CLK_TCK` conversion, nor subsecond clock inference participates in
acceptance. Therefore a legitimate owner that acquires the lock immediately
after process birth satisfies the invariant with no uncertainty window.

The incarnation-stable observation-and-signal primitive is Linux `pidfd_open(2)`
plus `pidfd_send_signal(2)`. Node does not expose the latter on this target, so
`writer-lock.ts` contains the one byte-exact compile-time Python source literal
below and only three private operations: `CAPABILITY_PROBE`, `CLEAN_STOP`, and
`INCIDENT_KILL`. No source, module, executable, path, PID, signal, profile,
state root, reason, or argv comes from CLI input or a public reusable API.

#### 11.1.1 Normative interpreter object and per-use execution binding

The only accepted interpreter pathname is `/usr/bin/python3.14`. On this target
the accepted object is exactly: non-symlink regular file; UID `0`; GID `0`;
mode `0755`; link count `1`; device `2049` (`0x801`); inode `14996`; size
`7,481,192` bytes; Python `3.14.4`; and SHA-256
`b8d8288faefdd300201f43fcf00f6f539a27218eeed3a3dff5ab10b9c4c99700`.
These are acceptance constants, not merely recorded evidence. Any target drift
requires a newly reviewed design; it is never accepted by updating a runtime
file, environment value, or request.

Every operation, including the startup preflight, performs this same binding:

1. Start a monotonic `1,000 ms` pre-spawn verification deadline. Require
   `realpath("/usr/bin/python3.14")` to equal that literal, `lstat` it as a
   non-symlink regular file, then open it once with
   `O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC`.
2. On that open descriptor, require the exact UID/GID/mode/link/device/inode/
   size tuple above. Hash from offset zero through exact EOF in `64 KiB` chunks,
   reject byte `8,388,609`, and require the exact SHA above. A
   short read, growth, shrink, non-EOF after the expected size, or elapsed
   pre-spawn deadline fails before child creation.
3. Immediately before spawn, repeat `lstat` on the fixed pathname and require
   its device/inode to equal the still-open descriptor. Replacement before this
   check rejects; replacement after it cannot change the open object.
4. With `shell: false` and `cwd: "/"`, duplicate that same verified descriptor
   to child FD `3`, set child stdio exactly to
   `[pipe-request, pipe-response, pipe-stderr, verified-interpreter-fd]`, and
   execute the absolute proc-fd pathname `/proc/self/fd/3` with argv exactly
   `[/proc/self/fd/3, -I, -S, -c, PIDFD_BRIDGE_SOURCE]`. The child starts only
   after FD `3` is installed; `execve` therefore resolves the verified open file
   description, never `/usr/bin/python3.14` again. All other non-stdio child FDs
   are closed, and the retained writer-lock FD is never inherited.
5. The literal requires `sys.executable == "/proc/self/fd/3"`, `fstat(3)` to
   equal the exact accepted object, Python version `3.14.4`, isolated/no-site/
   ignore-environment/safe-path flags, and the exact result schema. The parent
   accepts success only with that version result. Thus path/object identity and
   hash are checked before spawn, while FD identity and version are rechecked by
   the object actually executing before its operation on every use.

The complete child environment has exactly two entries and inherits none:
`LANG=C.UTF-8` and `LC_ALL=C.UTF-8`. There is no `PATH`, `HOME`, `PYTHONPATH`,
or other key. The literal and fixed arguments are compile-time values. The
literal between the next fence lines is exactly `PIDFD_BRIDGE_SOURCE`; it has
UTF-8 byte length `17,983` and SHA-256
`557e32a2ab54beea3b3ec8ce1a68bb69a7f3b756db4e3b007d18a452f7a22d75`. The terminal LF after the final source line is part
of the literal; the fence lines are not. `writer-lock.ts` encodes these bytes as
one `String.raw` compile-time template with no leading LF and exactly that final
LF; the source contains neither a backtick nor a `${` interpolation opener.
Before every spawn, TypeScript requires the UTF-8 length and SHA above, so a
build-time escape, newline, or source edit fails before child creation.

```python
import datetime
import errno
import hashlib
import json
import os
import re
import select
import signal
import stat
import sys

EXPECTED_PYTHON_VERSION = "3.14.4"
EXPECTED_ENVIRONMENT = {"LANG": "C.UTF-8", "LC_ALL": "C.UTF-8"}
EXPECTED_INTERPRETER_DEVICE = 2049
EXPECTED_INTERPRETER_INODE = 14996
EXPECTED_INTERPRETER_MODE = 0o755
EXPECTED_INTERPRETER_SIZE = 7481192
EXPECTED_OWNER_UID = 1000
EXPECTED_OWNER_EXECUTABLE = "/home/leo/.nvm/versions/node/v24.18.0/bin/node"
EXPECTED_OWNER_EXECUTABLE_DEVICE = 2049
EXPECTED_OWNER_EXECUTABLE_INODE = 397924
EXPECTED_OWNER_ARGV = (
    "/home/leo/.nvm/versions/node/v24.18.0/bin/node",
    "/home/leo/Project/.worktrees/agent-office/AGENT_OFFICE_AS1_PHASE_B_LIVE_PILOT_001/dist/core/runtime/as1-slack-pilot/cli.js",
    "start",
    "--env-file",
    "/home/leo/.config/agent-office/as1-slack-pilot.env",
)
LOCK_PATH = "/home/leo/.local/state/agent-office/as1-slack-pilot/locks/writer.lock"
EXPECTED_LOCK_KEYS = frozenset((
    "acquiredAt", "bootId", "buildId", "ownershipToken", "pid",
    "schemaVersion", "stateRootId",
))
CAPABILITY_REQUEST_KEYS = frozenset(("operation", "schemaVersion"))
SIGNAL_REQUEST_KEYS = frozenset((
    "expectedLockDevice", "expectedLockInode", "expectedLockSha256",
    "expectedOwnerPid", "expectedOwnerStartTicks", "operation", "schemaVersion",
))
REQUEST_SCHEMA = "agent-office.as1-pidfd-bridge-request.v1"
RESULT_SCHEMA = "agent-office.as1-pidfd-bridge-result.v1"
OPERATIONS = frozenset(("CAPABILITY_PROBE", "CLEAN_STOP", "INCIDENT_KILL"))
SIGNALS = {"CLEAN_STOP": signal.SIGTERM, "INCIDENT_KILL": signal.SIGUSR2}
STDIN_MAX_BYTES = 8192
REQUEST_MAX_BYTES = 8191
STDOUT_MAX_BYTES = 512
RESPONSE_MAX_BYTES = 511
LOCK_MAX_BYTES = 4096
BOOT_ID_MAX_BYTES = 64
STAT_MAX_BYTES = 4096
STATUS_MAX_BYTES = 16384
CMDLINE_MAX_BYTES = 8192
FDINFO_MAX_BYTES = 4096
PROC_LINK_MAX_BYTES = 4096
FD_ENTRY_MAX_COUNT = 4096
INTERNAL_DEADLINE_SECONDS = 1.5

class RequestRejected(Exception):
    pass

class CapabilityUnavailable(Exception):
    pass

class OwnerMismatch(Exception):
    pass

class OwnerExited(Exception):
    pass

class SignalRejected(Exception):
    pass

class BridgeDeadline(Exception):
    pass

def _raise(error_type):
    raise error_type()

def _on_deadline(_signum, _frame):
    raise BridgeDeadline()

def _read_fd(fd, limit, error_type):
    data = bytearray()
    while True:
        chunk = os.read(fd, min(4096, limit + 1 - len(data)))
        if not chunk:
            return bytes(data)
        data.extend(chunk)
        if len(data) > limit:
            raise error_type()

def _read_regular_path(path, limit, error_type):
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC)
        try:
            if not stat.S_ISREG(os.fstat(fd).st_mode):
                raise error_type()
            return _read_fd(fd, limit, error_type)
        finally:
            os.close(fd)
    except error_type:
        raise
    except OSError:
        raise error_type() from None

def _decode_canonical_line(raw, payload_limit, error_type):
    if not raw or len(raw) > payload_limit + 1 or raw[-1:] != b"\n":
        raise error_type()
    payload = raw[:-1]
    if not payload or len(payload) > payload_limit:
        raise error_type()
    def unique_object(pairs):
        value = {}
        for key, item in pairs:
            if key in value:
                raise error_type()
            value[key] = item
        return value
    try:
        text = payload.decode("utf-8", "strict")
        value = json.loads(
            text,
            object_pairs_hook=unique_object,
            parse_constant=lambda _value: _raise(error_type),
        )
        canonical = json.dumps(
            value, ensure_ascii=True, sort_keys=True, separators=(",", ":")
        ).encode("ascii")
    except error_type:
        raise
    except (UnicodeError, ValueError, TypeError):
        raise error_type() from None
    if canonical != payload:
        raise error_type()
    return value

def _decimal_string(value):
    if type(value) is not str or re.fullmatch(r"(?:0|[1-9][0-9]{0,19})", value) is None:
        raise RequestRejected()
    number = int(value, 10)
    if number > 18446744073709551615:
        raise RequestRejected()
    return number

def _validate_request(value):
    if type(value) is not dict:
        raise RequestRejected()
    operation = value.get("operation")
    if type(operation) is not str or operation not in OPERATIONS:
        raise RequestRejected()
    expected_keys = CAPABILITY_REQUEST_KEYS if operation == "CAPABILITY_PROBE" else SIGNAL_REQUEST_KEYS
    if frozenset(value) != expected_keys or value.get("schemaVersion") != REQUEST_SCHEMA:
        raise RequestRejected()
    if operation != "CAPABILITY_PROBE":
        digest = value["expectedLockSha256"]
        if type(digest) is not str or re.fullmatch(r"sha256:[0-9a-f]{64}", digest) is None:
            raise RequestRejected()
        _decimal_string(value["expectedLockDevice"])
        _decimal_string(value["expectedLockInode"])
        _decimal_string(value["expectedOwnerStartTicks"])
        pid = value["expectedOwnerPid"]
        if type(pid) is not int or not 1 <= pid <= 4194304:
            raise RequestRejected()
    return value

def _read_request():
    raw = _read_fd(0, STDIN_MAX_BYTES, RequestRejected)
    value = _decode_canonical_line(raw, REQUEST_MAX_BYTES, RequestRejected)
    return _validate_request(value)

def _emit(operation, outcome, success):
    value = {"operation": operation, "outcome": outcome, "schemaVersion": RESULT_SCHEMA}
    if success:
        value["pythonVersion"] = EXPECTED_PYTHON_VERSION
    payload = json.dumps(
        value, ensure_ascii=True, sort_keys=True, separators=(",", ":")
    ).encode("ascii")
    if len(payload) > RESPONSE_MAX_BYTES or len(payload) + 1 > STDOUT_MAX_BYTES:
        raise RuntimeError()
    output = payload + b"\n"
    offset = 0
    while offset < len(output):
        offset += os.write(1, output[offset:])

def _check_runtime():
    if sys.executable != "/proc/self/fd/3":
        raise CapabilityUnavailable()
    if sys.version_info[:3] != (3, 14, 4):
        raise CapabilityUnavailable()
    flags = sys.flags
    if not (flags.isolated == 1 and flags.no_site == 1 and
            flags.ignore_environment == 1 and flags.safe_path):
        raise CapabilityUnavailable()
    if dict(os.environ) != EXPECTED_ENVIRONMENT:
        raise CapabilityUnavailable()
    try:
        interpreter = os.fstat(3)
    except OSError:
        raise CapabilityUnavailable() from None
    if not (
        stat.S_ISREG(interpreter.st_mode)
        and interpreter.st_uid == 0
        and interpreter.st_gid == 0
        and stat.S_IMODE(interpreter.st_mode) == EXPECTED_INTERPRETER_MODE
        and interpreter.st_nlink == 1
        and interpreter.st_dev == EXPECTED_INTERPRETER_DEVICE
        and interpreter.st_ino == EXPECTED_INTERPRETER_INODE
        and interpreter.st_size == EXPECTED_INTERPRETER_SIZE
        and callable(getattr(os, "pidfd_open", None))
        and callable(getattr(signal, "pidfd_send_signal", None))
        and hasattr(select, "poll")
        and callable(getattr(signal, "setitimer", None))
    ):
        raise CapabilityUnavailable()

def _pidfd_is_live(pidfd, pid, error_type):
    raw = _read_regular_path(f"/proc/self/fdinfo/{pidfd}", FDINFO_MAX_BYTES, error_type)
    pid_values = []
    try:
        for line in raw.decode("ascii", "strict").splitlines():
            if line.startswith("Pid:"):
                pid_values.append(int(line.split(":", 1)[1].strip(), 10))
    except (UnicodeError, ValueError):
        raise error_type() from None
    if pid_values != [pid]:
        raise error_type()
    poller = select.poll()
    poller.register(pidfd, select.POLLIN | select.POLLHUP | select.POLLERR)
    if poller.poll(0):
        raise OwnerExited()

def _capability_probe():
    try:
        pidfd = os.pidfd_open(os.getpid(), 0)
    except OSError:
        raise CapabilityUnavailable() from None
    try:
        _pidfd_is_live(pidfd, os.getpid(), CapabilityUnavailable)
    finally:
        os.close(pidfd)

def _read_boot_id():
    raw = _read_regular_path(
        "/proc/sys/kernel/random/boot_id", BOOT_ID_MAX_BYTES, OwnerMismatch
    )
    if len(raw) != 37 or raw[-1:] != b"\n":
        raise OwnerMismatch()
    try:
        value = raw[:-1].decode("ascii", "strict")
    except UnicodeError:
        raise OwnerMismatch() from None
    if re.fullmatch(
        r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", value
    ) is None:
        raise OwnerMismatch()
    return value

def _read_lock(request):
    try:
        fd = os.open(
            LOCK_PATH, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC
        )
        try:
            lock_stat = os.fstat(fd)
            raw = _read_fd(fd, LOCK_MAX_BYTES, OwnerMismatch)
        finally:
            os.close(fd)
    except OwnerMismatch:
        raise
    except FileNotFoundError:
        raise OwnerExited() from None
    except OSError:
        raise OwnerMismatch() from None
    if not (
        stat.S_ISREG(lock_stat.st_mode)
        and lock_stat.st_uid == EXPECTED_OWNER_UID
        and stat.S_IMODE(lock_stat.st_mode) == 0o600
        and lock_stat.st_nlink == 1
        and str(lock_stat.st_dev) == request["expectedLockDevice"]
        and str(lock_stat.st_ino) == request["expectedLockInode"]
    ):
        raise OwnerMismatch()
    digest = "sha256:" + hashlib.sha256(raw).hexdigest()
    if digest != request["expectedLockSha256"]:
        raise OwnerMismatch()
    value = _decode_canonical_line(raw, LOCK_MAX_BYTES - 1, OwnerMismatch)
    if type(value) is not dict or frozenset(value) != EXPECTED_LOCK_KEYS:
        raise OwnerMismatch()
    if not (
        value["schemaVersion"] == "agent-office.writer-lock.v1"
        and type(value["pid"]) is int
        and value["pid"] == request["expectedOwnerPid"]
        and value["bootId"] == _read_boot_id()
        and value["buildId"] == "as1-slack-pilot"
        and value["stateRootId"] == "as1-slack-pilot"
        and type(value["ownershipToken"]) is str
        and re.fullmatch(r"[0-9a-f]{64}", value["ownershipToken"]) is not None
        and type(value["acquiredAt"]) is str
        and re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z", value["acquiredAt"]) is not None
    ):
        raise OwnerMismatch()
    try:
        datetime.datetime.strptime(value["acquiredAt"], "%Y-%m-%dT%H:%M:%S.%fZ")
    except ValueError:
        raise OwnerMismatch() from None
    return (digest, lock_stat.st_dev, lock_stat.st_ino, value["bootId"])

def _read_process_stat(pid, expected_start_ticks):
    raw = _read_regular_path(f"/proc/{pid}/stat", STAT_MAX_BYTES, OwnerMismatch)
    try:
        text = raw.decode("ascii", "strict").strip()
        right = text.rfind(")")
        if not text.startswith(f"{pid} (") or right < 0 or text[right + 1:right + 2] != " ":
            raise OwnerMismatch()
        fields = text[right + 2:].split()
        if len(fields) < 20 or fields[0] in ("Z", "X", "x"):
            raise OwnerExited()
        start_ticks = fields[19]
    except (UnicodeError, IndexError):
        raise OwnerMismatch() from None
    if re.fullmatch(r"(?:0|[1-9][0-9]{0,19})", start_ticks) is None:
        raise OwnerMismatch()
    if start_ticks != expected_start_ticks:
        raise OwnerMismatch()
    return start_ticks

def _read_process_uids(pid):
    raw = _read_regular_path(f"/proc/{pid}/status", STATUS_MAX_BYTES, OwnerMismatch)
    uid_lines = []
    try:
        for line in raw.decode("ascii", "strict").splitlines():
            if line.startswith("Uid:"):
                uid_lines.append(tuple(int(item, 10) for item in line[4:].split()))
    except (UnicodeError, ValueError):
        raise OwnerMismatch() from None
    if uid_lines != [(EXPECTED_OWNER_UID,) * 4]:
        raise OwnerMismatch()
    return uid_lines[0]

def _read_process_executable(pid):
    path = f"/proc/{pid}/exe"
    try:
        target = os.readlink(path)
        target_bytes = os.fsencode(target)
        executable = os.stat(path, follow_symlinks=True)
    except OSError:
        raise OwnerMismatch() from None
    if not (
        0 < len(target_bytes) <= PROC_LINK_MAX_BYTES
        and target == EXPECTED_OWNER_EXECUTABLE
        and stat.S_ISREG(executable.st_mode)
        and executable.st_dev == EXPECTED_OWNER_EXECUTABLE_DEVICE
        and executable.st_ino == EXPECTED_OWNER_EXECUTABLE_INODE
    ):
        raise OwnerMismatch()
    return (target, executable.st_dev, executable.st_ino)

def _read_process_argv(pid):
    raw = _read_regular_path(f"/proc/{pid}/cmdline", CMDLINE_MAX_BYTES, OwnerMismatch)
    if not raw or raw[-1:] != b"\0":
        raise OwnerMismatch()
    try:
        argv = tuple(item.decode("ascii", "strict") for item in raw[:-1].split(b"\0"))
    except UnicodeError:
        raise OwnerMismatch() from None
    if argv != EXPECTED_OWNER_ARGV:
        raise OwnerMismatch()
    return argv

def _read_retained_lock_fd(pid, lock_device, lock_inode):
    matches = []
    count = 0
    try:
        with os.scandir(f"/proc/{pid}/fd") as entries:
            for entry in entries:
                count += 1
                if count > FD_ENTRY_MAX_COUNT:
                    raise OwnerMismatch()
                if re.fullmatch(r"[0-9]+", entry.name) is None:
                    continue
                try:
                    target_stat = entry.stat(follow_symlinks=True)
                except FileNotFoundError:
                    continue
                if target_stat.st_dev != lock_device or target_stat.st_ino != lock_inode:
                    continue
                raw = _read_regular_path(
                    f"/proc/{pid}/fdinfo/{entry.name}", FDINFO_MAX_BYTES, OwnerMismatch
                )
                flag_values = []
                try:
                    for line in raw.decode("ascii", "strict").splitlines():
                        if line.startswith("flags:"):
                            flag_values.append(int(line.split(":", 1)[1].strip(), 8))
                except (UnicodeError, ValueError):
                    raise OwnerMismatch() from None
                if len(flag_values) != 1:
                    raise OwnerMismatch()
                flags = flag_values[0]
                if not (
                    flags & os.O_ACCMODE == os.O_WRONLY
                    and flags & os.O_CLOEXEC == os.O_CLOEXEC
                    and flags & os.O_NOFOLLOW == os.O_NOFOLLOW
                ):
                    raise OwnerMismatch()
                matches.append((int(entry.name, 10), flags))
    except OwnerMismatch:
        raise
    except FileNotFoundError:
        raise OwnerExited() from None
    except OSError:
        raise OwnerMismatch() from None
    if len(matches) != 1:
        raise OwnerMismatch()
    return matches[0]

def _observe(request, pidfd):
    pid = request["expectedOwnerPid"]
    _pidfd_is_live(pidfd, pid, OwnerMismatch)
    lock = _read_lock(request)
    start_ticks = _read_process_stat(pid, request["expectedOwnerStartTicks"])
    uids = _read_process_uids(pid)
    executable = _read_process_executable(pid)
    argv = _read_process_argv(pid)
    retained_fd = _read_retained_lock_fd(pid, lock[1], lock[2])
    _pidfd_is_live(pidfd, pid, OwnerMismatch)
    return (lock, pid, start_ticks, uids, executable, argv, retained_fd)

def _send_fixed_signal(request):
    if os.getuid() != EXPECTED_OWNER_UID:
        raise OwnerMismatch()
    pid = request["expectedOwnerPid"]
    try:
        pidfd = os.pidfd_open(pid, 0)
    except ProcessLookupError:
        raise OwnerExited() from None
    except OSError:
        raise OwnerMismatch() from None
    try:
        _pidfd_is_live(pidfd, pid, OwnerMismatch)
        first = _observe(request, pidfd)
        second = _observe(request, pidfd)
        if second != first:
            raise OwnerMismatch()
        _pidfd_is_live(pidfd, pid, OwnerMismatch)
        try:
            signal.pidfd_send_signal(pidfd, SIGNALS[request["operation"]], None, 0)
        except ProcessLookupError:
            raise OwnerExited() from None
        except OSError as error:
            if error.errno == errno.ESRCH:
                raise OwnerExited() from None
            raise SignalRejected() from None
    finally:
        os.close(pidfd)

def _run():
    operation = "UNPARSED"
    timer_armed = False
    try:
        if not callable(getattr(signal, "setitimer", None)):
            raise CapabilityUnavailable()
        signal.signal(signal.SIGALRM, _on_deadline)
        signal.setitimer(signal.ITIMER_REAL, INTERNAL_DEADLINE_SECONDS)
        timer_armed = True
        request = _read_request()
        operation = request["operation"]
        _check_runtime()
        if operation == "CAPABILITY_PROBE":
            _capability_probe()
            _emit(operation, "CAPABILITY_READY", True)
        else:
            _send_fixed_signal(request)
            _emit(operation, "SIGNAL_SENT", True)
        return 0
    except RequestRejected:
        _emit("UNPARSED", "REQUEST_REJECTED", False)
        return 64
    except CapabilityUnavailable:
        _emit(operation, "CAPABILITY_UNAVAILABLE", False)
        return 65
    except OwnerMismatch:
        _emit(operation, "OWNER_MISMATCH", False)
        return 66
    except OwnerExited:
        _emit(operation, "OWNER_EXITED", False)
        return 67
    except SignalRejected:
        _emit(operation, "SIGNAL_REJECTED", False)
        return 68
    except BridgeDeadline:
        _emit(operation, "BRIDGE_TIMEOUT", False)
        return 69
    except BaseException:
        _emit(operation, "INTERNAL_ERROR", False)
        return 70
    finally:
        if timer_armed:
            try:
                signal.setitimer(signal.ITIMER_REAL, 0.0)
            except BaseException:
                pass

raise SystemExit(_run())
```

#### 11.1.2 Exact bridge protocol and bounds

The capability request has exactly the sorted canonical JSON keys
`operation,schemaVersion`, with `schemaVersion` equal to
`agent-office.as1-pidfd-bridge-request.v1` and `operation` equal to
`CAPABILITY_PROBE`. A signal request has exactly
`expectedLockDevice,expectedLockInode,expectedLockSha256,expectedOwnerPid,expectedOwnerStartTicks,operation,schemaVersion`.
The device, inode, and start-tick values are canonical unsigned-decimal strings
in `[0, 2^64-1]`; the PID is a JSON integer in `[1, 4194304]`; the digest is
exactly `sha256:` plus 64 lowercase hex characters; and `operation` is exactly
`CLEAN_STOP` or `INCIDENT_KILL`. The TypeScript boundary derives every signal
field from its private no-follow lock/process observation after the closed
zero-operand grammar; no field is caller-controlled.

Stdin is exactly one canonical, ASCII-only, sorted-key JSON value plus one LF
and EOF: at most `8,191` request bytes before LF and `8,192` stdin bytes total.
The duplicate-key hook and canonical byte comparison reject missing, extra,
duplicate, malformed, noncanonical, oversized, non-ASCII, or trailing data.
The bridge result is exactly one canonical sorted-key JSON value plus one LF and
EOF. Success has exactly `operation,outcome,pythonVersion,schemaVersion`, with
version `3.14.4` and outcome `CAPABILITY_READY` or `SIGNAL_SENT` as appropriate.
Failure has exactly `operation,outcome,schemaVersion`; operation is the parsed
operation or `UNPARSED`, and the only outcomes/exit codes are
`REQUEST_REJECTED/64`, `CAPABILITY_UNAVAILABLE/65`, `OWNER_MISMATCH/66`,
`OWNER_EXITED/67`, `SIGNAL_REJECTED/68`, `BRIDGE_TIMEOUT/69`, and
`INTERNAL_ERROR/70`. Success is exit `0`; every other exit/status/result pair,
signal death, missing output, extra key, duplicate key, malformed byte, or
trailing byte is rejected. Response JSON is at most `511` bytes and stdout,
including LF, at most `512` bytes.

The parent simultaneously drains stdout and stderr, retains at most `512` bytes
from each, and terminates the bridge on byte `513` from either pipe. It accepts
stderr only when it is exactly zero bytes and logs neither pipe's rejected
content; stderr is retained only long enough to derive a redacted boolean. The
fixed projection ceilings are: lock `4,096`, boot ID `64`,
`/proc/<pid>/stat` `4,096`, status `16,384`, cmdline `8,192`, each fdinfo
`4,096`, each proc link `4,096`, and `/proc/<pid>/fd` at most `4,096` directory
entries total. Each ceiling is inclusive; the next byte/entry fails ambiguous.

The bridge arms its own `1,500 ms` monotonic real-time deadline before reading
stdin. The parent starts a `2,000 ms` direct-child deadline immediately before
spawn, uses the fixed child handle to send only SIGKILL to that verified helper
if it has not been reaped, and never directs that containment signal at the
owner. An unreaped direct child PID cannot be reused; this is not an owner
numeric-PID fallback. Including the `1,000 ms` pre-spawn verifier, one complete
operation is bounded to `3,000 ms`. A helper timeout during or after a fixed
pidfd send is ambiguous, never success. Post-send clean-stop and incident-kill
proof each use a separate exact `10,000 ms` owner shutdown deadline.

#### 11.1.3 Mutation-free capability gate and owner signaling

At process entry, after only the closed grammar and before any call to
`initializeStateRoot`, `validateStateRoot`, `WriterLock.acquire`, directory/file
open below the state root, secret read, or other startup mutation, `start` and
`redacted-check` run the pinned interpreter with the exact capability request.
The literal verifies its execution binding and APIs, opens one self pidfd,
requires its pidfd fdinfo `Pid` to equal itself, and requires a zero-event poll.
It checks but never invokes `pidfd_send_signal`. Failure or timeout exits with
zero state-root/marker/control/latch/lock residue, even for a fresh absent root.
Only a successful exact `CAPABILITY_READY` permits state-root initialization.
Every non-success, timeout, spawn error, or strict-decoder rejection maps to the
single redacted startup code `LIFECYCLE_CAPABILITY_UNAVAILABLE` and process exit
`2`; it never falls through to startup or prints bridge bytes.

Read-only target evidence on 2026-07-16 confirms the exact interpreter tuple,
Python `3.14.4`, the two-key environment, inherited-FD execution through
`/proc/self/fd/3`, `os.pidfd_open`, `signal.pidfd_send_signal`, pidfd fdinfo,
and zero-event polling. No process was signaled by those checks.

For `stop` and `incident-kill`, the TypeScript boundary first no-follow opens
and strictly parses the construction-bound owner-UID private one-link lock,
requires its exact bytes/device/inode and the caller UID, and derives the seven
signal-request keys internally. The sealed literal reopens the same fixed lock,
opens one pidfd for its record PID, performs both complete lock/process/retained-
FD observations through that still-open pidfd, requires exact equality, polls
the pidfd live immediately before send, and uses that same pidfd for only
SIGTERM (`CLEAN_STOP`) or SIGUSR2 (`INCIDENT_KILL`). It never calls `kill(2)` on
the owner by numeric PID and has no fallback or generic signal branch.

The complete observation requires exact lock bytes/hash/device/inode/type/UID/
link/mode and v1 fields; exact current boot, build, and root IDs; all four owner
UIDs `1000`; unchanged start ticks without any `acquiredAt`, `btime`, clock-tick,
or inode-time ordering inference; the fixed Node path/device/inode and exact
absolute five-item start argv embedded in the literal; exactly one retained
write-only, no-follow, close-on-exec descriptor for the lock inode; matching
pidfd identity; and a non-exit poll. If the owner exits, becomes a zombie, is
reaped, or its numeric PID is reused after either observation, the still-open
pidfd remains bound to the old incarnation and cannot retarget the replacement.

To make that argv literal true, the later setup-document change replaces the
`npm` wrapper for the live start with this direct five-item Node invocation
(the state-root assignment is environment, not argv):

```sh
AS1_SLACK_STATE_ROOT=/home/leo/.local/state/agent-office/as1-slack-pilot /home/leo/.nvm/versions/node/v24.18.0/bin/node /home/leo/Project/.worktrees/agent-office/AGENT_OFFICE_AS1_PHASE_B_LIVE_PILOT_001/dist/core/runtime/as1-slack-pilot/cli.js start --env-file /home/leo/.config/agent-office/as1-slack-pilot.env
```

No `npm` or shell wrapper in the owner argv, alternate worktree, relative entry,
or caller-selected path is accepted for the owner whose lock may be signaled.

A missing process/fact/held descriptor, changed lock, duplicate matching lock
descriptor, FD-enumeration overflow, PID reuse, executable/UID/boot/entry/root/
build mismatch, pidfd identity mismatch, interpreter path/object/version/hash
drift, schema/bound/deadline failure, or bridge error maps to
`STALE_OR_AMBIGUOUS_OWNER` and never reports success. `NO_LIVE_OWNER` remains
the only separate absent-lock status. No stale-lock recovery is implicit.

After a successful same-pidfd send, `stop` waits the fixed shutdown deadline for
the exact lock inode to disappear and returns only `STOPPED_CLEAN`,
`STALE_OR_AMBIGUOUS_OWNER`, `NO_LIVE_OWNER`, or `STOP_TIMEOUT`. It accepts no
PID, signal, profile, path, destination, or reason, and no reusable API accepts
an arbitrary signal.

`status` reads only strict lock/control projections and prints no IDs, paths,
grant values, payloads, token facts, Slack response, or tmux coordinate. The
existing closed `restart` verb remains grammar-compatible but is live-disabled:
it fails closed without opening Web/Socket/tmux activity. Only a separately
issued foreground `start` may begin either private pilot.

### 11.2 Fixed operator incident kill

The exact zero-operand verb is `incident-kill`. It resolves only the fixed state
root and lock above, performs both complete observations through one open pidfd,
and sends only SIGUSR2 through that same pidfd to the proven incarnation. It
accepts no `--env-file`, PID, signal, profile, path, destination, or free-form
reason. Unknown or extra tokens fail the closed parser. `stop` and
`incident-kill` are separate TypeScript entrypoints; neither is a parameterized
signal command.

On SIGUSR2, the foreground owner synchronously closes its in-memory receive,
Git-poll, delivery, evidence, and outbound admission gates. Under its existing
control mutex and writer lock it then calls `engageGlobalKill` with only the
fixed internal reason code `OPERATOR_INCIDENT_KILL`, persists and fsyncs
`DISABLED_LATCHED`/`killEngaged: true`, and preserves the first durable kill
reason if already engaged. No new side effect may start between the synchronous
gate close and durable kill; only after persistence may bounded shutdown close
the Socket, settle/mark already-started ambiguous work, and release the process
lock. It never transitions the killed control to `DISABLED_CLEAN`.

The operator command waits to the fixed deadline for both durable kill proof
and owner-lock removal. It returns only stable redacted codes:
`INCIDENT_KILL_ENGAGED`, `INCIDENT_KILL_ALREADY_ENGAGED`,
`STALE_OR_AMBIGUOUS_OWNER`, `NO_LIVE_OWNER`,
`INCIDENT_KILL_PERSIST_FAILED`, or `INCIDENT_KILL_TIMEOUT`. It prints no PID,
signal, profile, path, destination, lock token, durable reason text, or process
fact. Persistence failure leaves all in-memory admission gates closed and never
reports success.

Automatic cross-profile, secret-pair, global-control, or root-alias
contradictions continue to engage the same irreversible durable global kill
under the owning lock. A selected-profile provider, state, delivery, evidence,
or outbound ambiguity uses the existing profile latch. Neither kill nor latch
has a reset/clear command or startup auto-recovery path.

### 11.3 Clean drain order

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
6. only when global kill remains disengaged, persist `DISABLED_CLEAN`, fsync
   control, release the writer lock, remove the foreground process, and emit
   redacted status.

Clean stop never clears a global kill, profile latch, grant, journal,
consumption, dedupe record, or evidence. If kill engages during drain, the
incident path wins and `DISABLED_LATCHED` remains terminal.

### 11.4 Manual re-entry and existing replay boundaries

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
3. Before `redacted-check`, state-root initialization, or any other startup
   mutation, run only the exact pinned-FD no-signal capability request from
   section 11.1. Require the target-locked interpreter object/version/literal,
   exact environment/result/bounds, `pidfd_open`, pidfd identity/poll semantics,
   and `pidfd_send_signal` API; record only its stable pass/fail code. Failure
   must prove an absent state-root path remains absent or an existing root stays
   byte-unchanged, and in both cases that no writer lock exists.
4. Verify the owner secret file only through `redacted-check`; record only
   `LOCAL_SYNTAX_PASS`. This offline command repeats the same capability gate,
   then initializes/validates the local state-root/control records needed for
   later snapshotting but performs no Web, Socket, or tmux call. Require its
   `--env-file` path to equal the descriptor's one reviewed secret path. Do not
   print or copy values.
5. Verify the canonical state root, format marker, control/latches, absent
   writer lock, zero AS1 process, and zero AS1 listener.
6. Verify both profile Registry rows, the global kill disengaged, the selected
   profile unlatched, and the other profile inactive.
7. Verify the selected receive grant is unexpired immediately before `start`.
8. Prove both fixed records name the same one configured workspace and Leo as
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
- State-root/ref/hash binding, Registry lineage, frozen evidence-authority
  equality, the separate fresh live control/latch predicate, and common writer
  mutual exclusion are proven for both profiles.
- The Git source proves fixed path, unique first addition, exact blob, pushed
  ancestry, dirty/rewrite behavior, bounded output/time, no shell, and no fetch.
- The Socket proves wrong Web/App/token pairs fail before receive, hello remains
  pre-event, arm is one-use, no pre-arm parse/ACK occurs, and the bounded raw
  handoff cannot overflow or cross generations.
- The exact transport proves the pointer leaf is no-follow, regular, owner-UID,
  one-link, exactly private by `(mode & 0o077) === 0`, and no larger than
  `32 * 1024` bytes. It requires on-disk bytes to equal
  `Buffer.concat([canonicalBytes(strictlyParsedPointer), Buffer.from("\n")])`
  and requires the grant hash and content-addressed filename digest to equal
  SHA-256 of those same raw bytes before commitment. The Node tmux port's
  complete argv/stdin allowlist is asserted; static scans prove no path reopen,
  capture/show pane, show-buffer, generic command/target, caller file/path,
  shell, or historical fallback.
- Observations one and two use the identical construction-derived query and
  exact-key decoder, require every one of the 15 destination fields, bind
  session/workspace/command to the selected profile, and compare all fields
  before `PREPARED`, consumption, or tmux mutation. Observation three repeats
  that complete proof after `BUFFER_LOADED` immediately before
  `PASTE_STARTED`; divergence is terminal manual reconciliation with no paste,
  Enter, cleanup-as-rejection, or retry.
- The closed `stop` and `incident-kill` paths prove retained original lock-FD
  ownership, executable, UID, boot, entry, root, build, and identical complete
  observations through one open pidfd; send only their fixed signal through
  that same pidfd; perform bounded shutdown; and redact stable status. The
  exact interpreter tuple, pinned-FD exec, literal hash/length, two-key
  environment, request/result schemas, exit/outcome pairs, zero accepted
  stderr, every inclusive byte/count ceiling, and `1,000`/`1,500`/`2,000`/
  `3,000`/`10,000 ms` deadlines are assertions, not configurable values.
  Neither path accepts caller PID/signal/profile/path/destination/reason, uses
  a numeric-PID owner-signal fallback, or exposes a generic command/signal/reset
  surface.

### 13.2 Focused composition and direct regressions

- Run the directly affected existing Phase A startup-identity, raw-Socket,
  inbound/thread, exact-transport, evidence-ingress, outbound/replay, lifecycle,
  and Exact Delivery regressions; do not run unrelated suites.
- Run one focused synthetic Agent Office composition and then one focused
  synthetic Foundation composition against the same disposable common root;
  prove one fixed workspace, the Leo singleton, immutable per-profile App/
  channel bindings, one profile at a time, one root-to-result round trip each,
  and separate contained state.
- Prove exact startup call order with spies. Interpreter path/type/UID/GID/mode/
  link/device/inode/size/hash/version drift, API absence, pre-spawn deadline,
  capability timeout, wrong/missing/extra/duplicate/malformed/oversized/trailing
  request or result data, any stderr byte, and every other capability failure
  must precede `initializeStateRoot`, state-root validation/open, lock creation,
  secret access, and all Web/Socket/tmux calls. Each case leaves an initially
  absent disposable state-root path absent and an existing disposable root
  byte-for-byte unchanged with no writer-lock residue.
- Using distinct pre-transition and live control records (`S0 != S1`), prove the
  pointer-delivery grant and terminal facts retain the receive grant's frozen
  `globalControlSnapshotHash`, the live `RECEIVING_ONE_PROFILE` predicate is
  separately actionable, and unchanged `buildEvidenceAuthority` succeeds with
  every existing equality intact. Then prove live `DRAINING`, global kill, or a
  selected-profile latch rejects before the next delivery boundary.
- Prove one exact terminal LF succeeds. Prove a missing LF, double LF,
  noncanonical-but-JSON-equivalent bytes, raw pointer-hash mismatch,
  content-addressed filename-digest mismatch, symlink, non-regular file, wrong
  ownership, group/other read permission, malformed grammar/correlation, and a
  `32,769`-byte leaf fail. Prove a `32,768`-byte leaf passes the size gate and is
  decided only by the remaining exact formula/grammar gates. Every rejection
  before the final identity check produces zero tmux mutation, no `PREPARED`,
  and unconsumed authority. A replacement after the final identity check must
  still load the original pinned bytes through closed stdin and never the
  replacement.
- Prove wrong-profile session/workspace/command, an omitted/additional
  destination field, and any field divergence in observations one or two reject
  before `PREPARED`, consumption, or tmux mutation; exact all-field equality is
  the only capability-creation case. Change the target after observation two
  and again during/after buffer load; observation three must detect each case,
  record `MANUAL_RECONCILIATION_REQUIRED`, perform no paste or Enter, retain the
  postcommit private-buffer evidence, and never retry.
- Prove one root, second-root rejection, exclusive expiry, post-ACK
  materialization, delivery-grant/lease one-use, the exact sequence of two
  complete precommit observations plus one complete post-load/pre-paste
  observation, no-retry ambiguity, and typed evidence-authority construction.
- Prove the pilot path's ACK -> INTAKE -> RESULT order, immutable Git evidence,
  exact same-thread result, and replay without a second outbound.
- Prove clean SIGTERM stop remains distinct from SIGUSR2 incident kill; the
  incident gate closes before durable kill, durable global kill fsyncs before
  bounded shutdown, and clean stop never clears it. Prove a valid owner whose
  process birth and lock acquisition share the same coarse clock interval is
  accepted through the retained lock FD without a time-order test. Prove owner
  exit, zombie/reap, and numeric-PID reuse after verification but before the
  send cannot retarget the same pidfd; also prove stale lock, changed lock/held
  FD, reuse between observations, wrong executable/UID/boot/entry/root/build,
  missing facts, interpreter/API drift, and bridge failure send no signal.
  Replace `/usr/bin/python3.14` before open, after open/before re-`lstat`, and
  after re-`lstat`/before exec: the first two cases reject device/inode/hash
  drift, while the last must execute only the already-verified inherited FD.
  Separately reject wrong interpreter device, inode, mode, owner, size, hash,
  version, or child-FD identity and unavailable `pidfd_open`,
  `pidfd_send_signal`, poll, or timer APIs.
- At exact-minus-one, exact, and exact-plus-one boundaries, cover the `8 MiB`
  interpreter read cap; `17,983`-byte literal identity; `8,191` request/
  `8,192` stdin; `511` response/`512` stdout; zero accepted and `512` captured
  stderr; `4,096` lock/stat/fdinfo/proc-link; `64` boot ID; `16,384` status;
  `8,192` cmdline; and `4,096` FD-entry ceilings. Cover PID and unsigned-decimal
  ranges, all request/result enum and exact-key variants, exit/outcome mismatch,
  the `1,000 ms` verifier, `1,500 ms` internal deadline, `2,000 ms` child
  timeout, `3,000 ms` total operation, and `10,000 ms` owner shutdown deadline.
  A timeout after a same-pidfd send is ambiguous, never success. Prove stable
  redacted codes, no package/helper file/numeric owner-signal fallback/generic
  command/reset surface, and that `restart` cannot open a live connection.
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
- one selected-profile-bound fresh leased destination, two complete all-field
  matching observations before delivery commitment, and one complete matching
  observation after buffer load immediately before `PASTE_STARTED`;
- one exact pinned pointer byte hash loaded through closed stdin, with the
  receive grant's frozen evidence hashes retained unchanged;
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

1. Run the exact zero-operand `incident-kill` action. Require the redacted
   `INCIDENT_KILL_ENGAGED` or `INCIDENT_KILL_ALREADY_ENGAGED` proof before any
   new receive/delivery/outbound start; any stale/ambiguous/persistence/timeout
   status keeps the sequence failed closed and returns to the Advisor.
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
exact authority and journal. The writer lock retains its original handle but
does not change the v1 record or path. The fixed `pidfd` bridge is the exact
length/hash-identified literal in the already-listed writer-lock path, executes
only the verified inherited interpreter FD under the fixed bounds in section
11.1, uses the target's standard library, and adds no package, helper file,
listener, or caller-controlled command. The Socket arm is an adapter lifecycle
transition. The two store
additions are typed reads of existing records. These are composition changes,
not authority or persistence redesigns.

## 16. Implementation readiness and deliberately unset live facts

Design state: `READY_FOR_EXACT_SAME_REVIEWER_F05_DELTA_REVIEW`.

Patch disposition submitted for independent verification:

- F01 — frozen receive authority is copied unchanged through delivery/evidence;
  a separate construction-bound live predicate gates acceptance and every side
  effect.
- F02-D1 — the contained pointer is no-follow opened under the exact private
  mode and 32-KiB writer bound; on-disk canonical-plus-one-LF bytes, grant hash,
  and content-addressed filename share one raw SHA-256; those pinned bytes alone
  reach closed stdin, without a path reopen.
- F03-R1 — the closed profile binds immutable session/workspace/command and all
  15 destination facts in two complete precommit observations and one complete
  post-load/pre-paste observation; final divergence is postcommit manual
  reconciliation with no paste, Enter, or retry.
- F04 — zero-operand `incident-kill` retains its closed contract: prove the
  owner, send only SIGUSR2, durably kill before bounded shutdown, and remain
  distinct from clean stop.
- F05-D1 — every use accepts one exact interpreter object, hashes and pins its
  open FD through exec, and runs the full byte-identified literal under exact
  environment/schema/byte/count/time bounds. Its no-signal capability probe
  precedes all state-root/lock/startup mutation. Both fixed signal paths retain
  the original lock descriptor, observe exact executable/UID/boot/entry/root/
  build facts twice through one pidfd, and send through that same pidfd; fast
  startup needs no time-order inference, and exit/reap/PID reuse cannot retarget
  the signal.

These are Designer dispositions, not an independent PASS or final approval.

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
