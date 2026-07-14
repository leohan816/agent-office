# AS1 Slack Security and Authority Model

Status: `DESIGN_CANDIDATE__PENDING_INDEPENDENT_SECURITY_REVIEW`

Mission: `AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_PILOT_001`

Risk: `LEVEL_3_SECURITY_AUTHORITY_AND_EXTERNAL_TRANSPORT`

This model constrains the additive design in
`docs/integration/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_DESIGN.md`. It does not
authorize implementation, secret access, a Slack connection, tmux input, a
pilot, or risk acceptance.

## 1. Authority statement

Slack is an external transport and untrusted content source. It is never an
authority source for Team, Actor, role, Mission, WorkUnit, repository, session,
pane, workspace, model, effort, command, file path, review, risk acceptance, or
approval.

The authority chain is fixed:

```text
Leo/GPT accepted bounded mission
  -> Agent Office Advisor exact committed Designer handoff
  -> independently reviewed design
  -> Agent Office Advisor exact committed Worker handoff
  -> Worker implementation evidence
  -> independent implementation/security review
  -> Advisor audit
  -> OWNER_SETUP_COMPLETE
  -> fresh expiring single-profile pilot receive grant
  -> durable one-root receive binding before Socket ACK
  -> immutable intake and pointer artifact
  -> fresh one-use post-intake pointer-delivery grant
  -> fresh single-use destination lease
  -> in-memory pointer-bound capability
  -> one exact Advisor pointer attempt
```

No later link can repair a missing earlier link. Setup files, token possession,
a connected Socket, a Slack message, a successful Web API response, or a live
tmux pane grants no mission authority by itself.

## 2. Security objectives

The pilot must preserve:

1. **Route integrity** — exactly one of two reviewed profile routes, never a
   text-selected target.
2. **Actor lineage integrity** — the continuing Agent Office Actor and the new
   Foundation Actor retain distinct immutable identities.
3. **Credential separation** — each app-level/bot-token pair proves one exact
   App ID; swapping fails before acceptance.
4. **Workspace/channel/user integrity** — only the fixed workspace, fixed
   private channel, and approved Leo user enter policy processing.
5. **Durability before acknowledgement** — no accepted Socket envelope is ACKed
   before immutable receipt, dedupe, and required root/question transition
   state are durable.
6. **At-most-once intake** — retries, duplicate connections, and restart do not
   create a second intake.
7. **Pre-Mission truth** — a top-level Slack message is `NEW_MISSION` intake,
   not a canonical Mission Manifest.
8. **Thread integrity** — a reply binds one root and one open question; text
   never chooses a route or continuation kind.
9. **Authority-stage separation** — pre-event receive authority cannot name an
   event/intake/pointer/destination; only a later Advisor-created delivery grant
   may bind an immutable intake/pointer and authorize a lease/capability.
10. **Exact Advisor delivery** — every attempt uses a fresh profile-bound
   pointer-delivery grant, lease, and capability and a twice-verified
   destination.
11. **No blind resend** — uncertain tmux or Slack writes require manual
    reconciliation.
12. **Profile isolation** — state, evidence, authority consumption, and latches
    do not cross profiles.
13. **Secret and content confidentiality** — no token or raw message enters
    logs, Git, tmux pointer bytes, status output, or review artifacts.
14. **Fail-closed recovery** — corruption, identity contradiction, or ambiguous
    side effect never self-heals by deletion or retry.

Availability is subordinate to these objectives. A delayed or manually
reconciled reply is acceptable; a duplicate intake, wrong Advisor, leaked token,
or ambiguous resend is not.

## 3. Protected assets

| Asset | Required protection |
|---|---|
| app-level and bot tokens | external owner-only file; never committed, logged, hashed for display, or copied to state |
| ephemeral WebSocket URL | memory only; contains bearer-like ticket material; never logged or persisted |
| raw Leo message | owner-only immutable profile artifact; never in indexes, pointer, status, or chat logs |
| workspace/App/channel/user IDs | exact comparison in memory; raw values redacted from routine output |
| profile mapping | compile-time closed union plus runtime exact registry check |
| root/thread correlation | immutable profile-local state; atomic single-consumption |
| pilot receive grant/binding | Advisor-created committed/pushed pre-event grant; one profile/root, exclusive expiry, atomic binding before ACK |
| pointer-delivery grant/lease/capability | separate post-intake exact authority refs/hashes, exclusive TTLs, permanent use limit one |
| tmux and Slack journals | owner-only, hash-chained, append-order validated |
| Advisor evidence | exact Git blob/path/commit/hash/ancestry; immutable after acceptance |
| Foundation identity | fresh roleInstanceId only; no historical Agent Office evidence |
| existing Exact Delivery v2 | unchanged schemas, state, destination, behavior, and evidence |

## 4. Trust boundaries

### 4.1 Owner filesystem boundary

The secret file crosses from owner-controlled storage into process memory. File
type, UID, modes, no-follow open, bounded size, and exact data grammar are
security checks, not setup conveniences. `process.env`, cwd, PATH, shell config,
dotenv expansion, and inherited environment are outside the trust boundary.

### 4.2 Slack control plane boundary

`auth.test`, `bots.info`, `apps.connections.open`, Socket `hello`, Events API
envelopes, and `chat.postMessage` responses are external data. TLS and an
authenticated Socket are necessary but not sufficient: every response has an
exact-key/bounded parser and must agree with committed profile identity.

### 4.3 Slack content boundary

Leo's text is authorized product intent only after exact immutable user/channel
identity checks. It remains untrusted data for routing and execution. It cannot
become argv, shell, tmux target, repository path, evidence path, schema name,
Web API method, model, effort, or Actor identifier.

### 4.4 Durable local state boundary

Only canonical atomic-file and immutable-artifact primitives write state.
Indexes hold hashes, refs, state, reason codes, and correlations; raw content is
separate. Every read revalidates schema, exact keys, bounds, hashes, ordering,
and profile-root containment.

### 4.5 Git evidence boundary

Receive and pointer-delivery grants plus Advisor evidence become trusted only as
exact committed/pushed Git blobs under their fixed authority roots, after
ancestry, dirty-state, first-addition, schema, identity, correlation, and
ordering checks. Chat prose, pane capture, working-tree bytes, branch names,
filenames from Slack, gateway output, and historical evidence are not authority.

### 4.6 Tmux mutation boundary

Only the new AS1 exact transport can write one pointer to one prevalidated
Advisor pane under a fresh post-intake pointer-delivery grant,
lease/capability, and permanently consumed authority state. Observation,
receive authority, generic tmux APIs, browser input, and Slack text cannot cross
this boundary.

## 5. Immutable profile identity

### 5.1 Agent Office profile

```text
profileId: AGENT_OFFICE_ADVISOR
advisorTeam: AGENT_OFFICE_ADVISOR_TEAM
roleInstanceId: foundation-advisor
actorId: agent-office-advisor
role: ADVISOR
sessionName: agent-office-advisor
workspace: /home/leo/Project/agent-office
currentCommand: codex
```

The roleInstanceId is historical in name but remains the continuing Actor's
immutable join key. It is valid only with the current Agent Office actor/team
binding. It is not a Foundation route.

### 5.2 Foundation profile

```text
profileId: FOUNDATION_ADVISOR
advisorTeam: FOUNDATION_ADVISOR_TEAM
roleInstanceId: foundation-advisor-20260714-01
actorId: foundation-advisor
role: ADVISOR
sessionName: foundation-advisor
workspace: /home/leo/Project/FOUNDATION
currentCommand: codex
```

`roleInstanceId: foundation-advisor` is forbidden in Foundation profile state,
evidence, lease, capability, pointer, and result. The Foundation Actor starts
with no inherited Agent Office evidence.

### 5.3 No generic representation

The application may expose `profileId` only as the above two literals. It must
not expose a structure with freely supplied Actor/session/workspace fields or a
lookup by arbitrary string. A `switch` with an exhaustive `never` branch is
required at every external adapter boundary.

The receive-granted profile comes from an exact Advisor-created
`As1PilotReceiveGrantV1`. No CLI profile flag, Slack field, environment key,
browser request, gateway-created object, or later evidence field selects it.

## 6. Least privilege and credential proof

### 6.1 Permission set

The bot scopes are:

- `groups:history` — required by `message.groups`;
- `chat:write` — required for a reply in the bot's joined private channel;
- `users:read` — used only for `bots.info` to return `bot.app_id` during startup.

The app-level scope is only `connections:write`. There is no user token,
`chat:write.customize`, `channels:*`, `im:*`, `mpim:*`, commands, files,
reactions, admin, workflow, remote, or public-ingress permission.

The `users:read` exception is narrower than accepting an undocumented App-ID
field. Runtime code permits exactly one `bots.info` call with the bot ID returned
by `auth.test`; it has no `users.list`/`users.info` adapter method.

### 6.2 Pair proof

For a profile to pass authentication, all facts must converge:

```text
configured workspace ID
  == auth.test.team_id

configured App ID
  == bots.info(bot_id from auth.test).bot.app_id
  == Socket hello.connection_info.app_id
  == every accepted callback.payload.api_app_id

auth.test.bot_id/user_id
  == bots.info.bot.id/user_id
  == accepted callback bot authorization identity
```

The two profiles must have different configured App IDs, channel IDs, bot IDs,
bot user IDs, bot token bytes, and app token bytes. Equality is a global
configuration-integrity failure. The workspace and Leo user values are shared
only because the accepted pilot explicitly fixes one workspace and one owner.

### 6.3 Token handling

- tokens exist only in the external file and selected client memory;
- never place a token in argv, URL query, exception, metrics label, state,
  artifact, Git, test snapshot, or `JSON.stringify` target;
- send bearer tokens only in Authorization headers through the official client;
- redact complete provider response/error objects before any diagnostic;
- zero or drop in-memory references on stop where the runtime permits;
- never inspect token components beyond bounded token-class validation;
- never display token prefixes, lengths, equality hashes, or last characters.

## 7. Control states

### 7.1 Global state

```text
DISABLED_DEFAULT
  -> RECEIVE_GRANTED_ONE_PROFILE (exact reviewed receive grant)
  -> AUTHENTICATING_ONE_PROFILE
  -> RECEIVING_ONE_PROFILE
  -> DRAINING
  -> DISABLED_CLEAN

any state -> DISABLED_LATCHED (global integrity failure)
```

Only one profile can hold the live receive slot. `DISABLED_CLEAN` does not
authorize another pilot or renew authority. An exact same-pilot clean restart
may revalidate the same unexpired nonretired grant/state; the next pilot needs a
different Advisor-created receive grant. `DISABLED_LATCHED` has no reset in
AS1.

### 7.2 Profile state

```text
INACTIVE | STOPPED_CLEAN
  -> RECEIVE_GRANT_VALIDATED_UNBOUND |
     RECEIVE_GRANT_VALIDATED_ROOT_BOUND
  -> AUTHENTICATING
  -> AUTHENTICATED_QUARANTINE
  -> RECEIVE_READY_UNBOUND | ROOT_BOUND_RECEIVING
  -> DRAINING
  -> STOPPED_CLEAN

any live state -> RECONCILIATION_REQUIRED -> LATCHED
```

The `STOPPED_CLEAN` branch is same-pilot restart only: it accepts the same
unexpired grant and exact preserved `UNBOUND` or `ROOT_BOUND` state, then still
performs authentication and quarantine before either ready state. It cannot
convert a bound state back to unbound or skip startup identity proof.

No transition is inferred from a process existing. Each transition is an exact
state-machine operation with expected prior state, request ID, timestamp,
authority hash, hash-chained receipt, and atomic persistence.

### 7.3 Delivery state

Delivery state is independent from the receive state:

```text
AWAITING_POINTER_DELIVERY_GRANT
  -> POINTER_DELIVERY_GRANT_VALIDATED
  -> READINESS_LEASE_VALIDATED
  -> GRANT_AND_LEASE_CONSUMED
  -> CAPABILITY_LIVE
  -> TRANSPORT_RECORDED | MANUAL_RECONCILIATION_REQUIRED
```

Receive state can never enter a delivery state. A bound root or intake does not
advance this machine. Only a separate Advisor-created pointer-delivery grant
can start it.

## 8. Two-stage authority invariants

### 8.1 Pre-event pilot receive grant

`As1PilotReceiveGrantV1` is invalid unless it:

- descends from independently reviewed implementation, Advisor acceptance, and
  `OWNER_SETUP_COMPLETE`;
- is newly added by the responsible Advisor as a committed, pushed, clean,
  upstream-ancestral, byte-stable Git artifact;
- names exactly one fixed profile and pilot ID;
- binds the exact workspace, App, channel, Leo user, organization registry,
  role lineage, governance, implementation-review, owner-setup, global-control,
  and profile-latch snapshots;
- binds one contained profile-local state root with `rootLimit: 1` and
  `conversationLimit: 1`;
- has an exclusive expiry and no refresh/reuse mechanism;
- has no alternate/fallback profile or destination;
- contains no event/envelope ID, source event, root timestamp, intake ID,
  message/pointer ref or hash, evidence prefix derived from input, tmux
  destination, readiness lease, capability, pointer-delivery grant, wildcard,
  nullable placeholder, or gateway-completable authority field.

The grant authorizes only opening/authenticating the fixed Socket client and
receiving one bounded root conversation. It is not delivery authority. The
gateway can validate and record it but cannot create, derive, complete, renew,
or clone it.

### 8.2 Receive binding and consumption

The grant's immutable Git blob is never mutated. Its exact profile-local
`As1PilotReceiveGrantStateV1` starts `UNBOUND`. For the first eligible top-level
Leo event only, the implementation must establish this happens-before chain:

```text
immutable envelope/message receipt + both dedupe identities
  happens-before
atomic UNBOUND -> ROOT_BOUND compare-and-append that stores observed
sourceEventId/rootTs/root key and consumes rootLimit=1
  happens-before
Socket ACK write
  happens-before
asynchronous intake/pointer materialization
```

The observed event/root facts live in the binding state and immutable binding
artifact, not in the pre-event grant. A compare-and-append loser cannot create
a root. An identical retry verifies the same durable bytes and may reproduce
only the Socket ACK. A second top-level event is durably rejected. A thread
reply is eligible only under the exact bound root and one open fixed-kind
question, which is atomically consumed before ACK.

Malformed input with no safe envelope ID is not ACKed. A usable but rejected
envelope may be ACKed only after its rejection/dedupe state is durable; it does
not change the root slot or mint authority. Wrong identity on an authenticated
profile latches after durable audit. Bot echoes, edits/deletes, hidden/subtype,
wrong surface, deferred query, and uncorrelated replies never bind or consume a
grant.

Restart revalidates the same grant/state and does not extend expiry. Expiry
before root records `EXPIRED_UNBOUND`; expiry after root records
`EXPIRED_BOUND`, refuses new input, and drains only already-durable work. A
provider disconnect latches without renewing. Ambiguous ACK retains binding and
dedupe for exact retry. Kill/latch forbids receive and delivery; corruption
fails closed, with cross-profile/global contradictions engaging the global
latch.

A receipt/dedupe crash before the required binding/consumption/rejection is a
durable `PREACK_PENDING` state. Replay may complete only that already-decided
transition from the exact stored bytes and expected state. It does not
materialize intake or claim an ACK. If exclusive receive-grant expiry occurs
before the missing transition, replay records expiry rejection and cannot bind
a late root. Contradictory partial state latches.

### 8.3 Post-intake pointer-delivery grant

`As1PointerDeliveryGrantV1` is invalid unless it:

- is newly added by the responsible Advisor only after an immutable intake and
  pointer artifact exist;
- is committed, pushed, clean, upstream-ancestral, byte-stable, unexpired, and
  permanently single-use;
- names the exact receive grant and binding hash, pilot, profile, intake ID,
  source event ID, root correlation hash, pointer ref/hash, Team, actorId,
  roleInstanceId, evidence prefix, authority roots, registry/governance, and
  clean kill/latch snapshots;
- matches those immutable artifacts byte-for-byte and has no other/fallback
  profile;
- authorizes only creation of one fresh readiness lease and one in-memory
  capability for one exact pointer attempt.

This is the only stage that may bind event/intake/pointer facts as authority.
The gateway's receipt, binding, intake, or pointer output cannot create or
substitute for the Advisor grant. The grant authorizes no new receive/root and
contains no caller-selected tmux destination; that volatile destination exists
only in the later readiness lease.

### 8.4 Readiness lease

A lease is invalid unless it:

- is newly added once under the exact pointer-delivery-grant authority path;
- names the same receive grant/binding, delivery grant,
  profile/pilot/intake/event/pointer hash;
- has exact Team, actorId, roleInstanceId, session, workspace, and process;
- records a current complete structured tmux destination;
- records synchronized panes off, pane live, input enabled, and no copy mode;
- has `useLimit: 1` and an exclusive short expiry no longer than 30 seconds;
- descends from every receive-binding and pointer-delivery-grant authority
  snapshot;
- is clean, pushed, byte-stable, and matches the first live preflight.

Delivery-grant and lease consumption are durable before buffer load.
Consumption is permanent, including a subsequent validation failure.

### 8.5 In-memory capability

The capability is valid only for one:

```text
receive-grant binding + pointer-delivery grant + pilot + profile
+ intake + Slack event + pointer hash + lease + destination fingerprint
+ authority hashes + expiry
```

It is never accepted from config, disk, Slack, a browser, or a caller-provided
production object. It is checked before buffer load, after the second preflight,
and immediately before pane input. Capability expiry is exclusive.

## 9. Inbound security pipeline

### 9.1 Shape before content

The raw Socket adapter first checks bounded JSON and envelope identity. It does
not run a content listener, regex command router, or Bolt automatic handler.
Unsupported or malformed envelope types cannot reach the application service.

### 9.2 Persistence before ACK

Security invariant:

```text
durable immutable receipt + durable dedupe decision
  + atomic first-root receive binding OR durable terminal rejection
  happens-before
Socket ACK write
  happens-before
asynchronous intake/pointer materialization
```

Tests must observe the exact call order. The bounded identity/surface decision
needed to bind/reject a root occurs before ACK; no untrusted content becomes
authority. A receipt, dedupe, binding, question-consumption, or terminal-state
write failure results in no ACK. A process crash between persistence and ACK
produces a safe Slack retry, which finds identical durable bytes and cannot
create a second binding, intake, or question consumption.

### 9.3 Identity filter

The classifier compares raw IDs to the receive grant and selected in-memory
profile using constant-time byte comparison where practical. Names, display
names, channel names, topics, URLs, mentions, and deprecated verification
tokens are ignored.

An authenticated Socket from the right app does not excuse a wrong workspace,
channel, user, callback App ID, shared-channel flag, or bot identity. These
contradictions are audited and latched.

### 9.4 Message filter

Accepted inner messages have:

- `type: message`;
- `channel_type: group`;
- exact Leo user;
- no subtype;
- no `hidden`, `bot_id`, `app_id`, or `bot_profile`;
- bounded text and timestamps;
- either no `thread_ts` for a root, or an exact known root for a continuation.

Any edit, delete, bot message, hidden subtype, App Home/DM/MPIM/public event,
unknown event, echoed outbound, or shared-channel event is rejected. Rejection
is not a alternate command path.

### 9.5 Content injection resistance

The raw text may contain shell syntax, paths, JSON, Markdown, mentions, code,
role names, session IDs, prompts, or commands. It remains an opaque body in the
intake artifact. No interpolation or structured-field extraction is allowed.

The only parsing is:

- bounded Unicode/control validation;
- exact deferred-query first-token rejection;
- top-level versus thread shape;
- fixed response kind from an already-durable pending question.

## 10. Replay and correlation security

Two dedupe keys prevent envelope and Events API replay. A record is immutable
after first acceptance. Same identity/same hash is replay; same identity/new
hash is corruption or attack.

Before ACK, the receive-binding artifact binds profile, workspace, app,
channel, root timestamp, receive-grant ID/binding hash, Slack event, receipt,
and message hash without an intake ID. After ACK, root correlation adds exactly
one intake while referencing that immutable binding. It cannot be reassigned,
and only a valid receive-state `UNBOUND -> ROOT_BOUND` transition can seed it.

Question correlation binds root, question ID, expected response kind, evidence
ref/hash, and consumption state. Reply acceptance atomically changes
`OPEN -> CONSUMED` under expected version. Concurrent or repeated replies lose
the compare-and-append and are rejected.

A Slack retry never refreshes time-to-live, reopens a question, or resets an
attempt counter. It never renews a receive grant, reopens its root slot, or
creates a pointer-delivery grant.

## 11. Evidence authority security

### 11.1 Source constraints

Evidence paths are derived from the pointer-delivery grant's fixed prefix,
profile state slug, validated intake UUID, and fixed filename grammar. Evidence
cannot provide its own path. The reader uses closed `/usr/bin/git` argv,
`shell: false`, fixed environment, bounded timeout/output, exact commits, and no
`--follow` history.

### 11.2 Stage order

```text
pointer-delivery grant + readiness lease consumed
  ->
pointer transport recorded
  -> Advisor ACK accepted
  -> Advisor intake accepted
  -> zero or more ordered QUESTION/continuation pairs
  -> final RESULT accepted
```

Later evidence appearing before its predecessor is an authority defect, not a
queue hint. First accepted blob identity is frozen. Dirty, rewritten, deleted,
non-ancestral, duplicate-history, wrong profile, wrong actor lineage, wrong
root, wrong pointer/lease/journal, or future-dated evidence quarantines the
profile.

### 11.3 Foundation separation

Every Foundation evidence schema, path checkpoint, capability, and result must
carry:

```text
actorId: foundation-advisor
roleInstanceId: foundation-advisor-20260714-01
advisorTeam: FOUNDATION_ADVISOR_TEAM
```

Any `foundation-advisor` roleInstanceId in Foundation evidence is rejected even
though it is the current routable actorId. Historical Agent Office evidence
cannot satisfy Foundation ACK, intake, result, readiness, or completion.

## 12. Outbound security

### 12.1 Fixed method and destination

Only `chat.postMessage` is representable. Channel and root thread are loaded
from the accepted root correlation, then compared to the selected profile.
Advisor evidence cannot provide them. The request contains no identity override,
dynamic method, block, attachment, metadata, action, or response URL.

### 12.2 Rendering and redaction

Outbound text is produced from an exact ACK/QUESTION/RESULT schema. Before
persistence and again before send, reject:

- token-like sequences, secret key names with values, or WebSocket URLs;
- control characters other than newline/tab;
- raw filesystem secret/state paths;
- Slack mention control forms and broadcast mentions;
- unbounded links or content over the fixed scalar/byte limit;
- profile, channel, app, root, or thread target fields embedded as routing
  instructions.

Use `mrkdwn: false`, disabled unfurls, no reply broadcast, and the app's natural
bot identity. The top-level text is complete for accessibility; there are no
visual-only blocks.

### 12.3 Write ambiguity

The durable outbox records request bytes and intended root before network I/O.
The adapter disables SDK automatic retries.

Safe automatic retry classes:

- connection/DNS/TLS failure proven before request bytes are handed off;
- explicit provider rate-limit response with a bounded `Retry-After` and no
  accepted message;
- maximum three attempts, bounded backoff, cancelled by drain/kill.

Ambiguous classes requiring latch/manual reconciliation:

- timeout or reset after request write starts;
- 5xx or malformed response;
- process crash in `REQUEST_STARTED`;
- success without exact channel/timestamp correspondence;
- lost durable write after provider success;
- any SDK behavior that obscures whether it retried.

No lookup or client-generated ID is treated as proof unless the selected
Slack API version documents an exact idempotency contract and a later reviewed
design adds it. AS1 therefore never blind-resends an ambiguous message.

## 13. Tmux mutation security

The AS1 runner exposes only:

```text
structured preflight
buffer-exists check for internally derived private name
load internally derived pointer file
paste validated buffer to leased pane
send Enter to leased pane
delete unpasted buffer under exact recovery proof
```

It has no capture-pane, run-shell, new-session, arbitrary argv, generic target,
or caller-supplied file path. The pointer path is resolved under the selected
profile artifact root and checked for containment.

Journal durability precedes each side effect. `PASTE_STARTED` is the no-retry
boundary. Target changes between preflights, synchronized panes, dead/copy-mode
pane, input-off, wrong process/workspace, authority change, kill/latch, or
expired capability stops before paste.

## 14. State isolation and latching

### 14.1 Profile-local latch causes

- provider disconnect or bounded authentication expiry after a valid start;
- wrong callback identity on an authenticated profile connection;
- receive-grant binding, receipt/dedupe/root/question store corruption;
- pointer-delivery-grant, exact destination, lease, or capability failure;
- tmux transport ambiguity;
- evidence rewrite/removal/order/profile defect;
- Slack outbound ambiguity;
- retention/capacity bound exhaustion.

### 14.2 Global latch causes

- secret file grammar, ownership, or mode failure;
- token/App swap or equality across profiles;
- shared profile state path or cross-profile hash/reference;
- organization registry cannot resolve both exact identities;
- active receive-grant/profile mutual exclusion violation;
- global control corruption;
- an event/evidence/capability crosses profile roots;
- gateway creation/completion of a receive or pointer-delivery grant;
- attempted generic target or bypass of the closed profile union.

### 14.3 Latch behavior

Latch persistence happens before client close where possible. Receive grants
cannot bind or continue, new inbound messages are not accepted, new delivery
grants/leases/capabilities are not accepted, new tmux/outbound attempts do not
start, and status reports only stable reason codes. If latch persistence itself
fails, terminate both clients and fail startup on the next run due to
unverifiable control state.

There is no runtime enable/reset endpoint, browser action, Slack command, signal
shortcut, state deletion, or automatic backoff reset.

## 15. Denial-of-service bounds

- one active profile and one Socket connection for its pilot;
- one Advisor-created receive grant, one root slot, and one bound conversation
  per sequential pilot;
- raw envelope at most 32 KiB;
- message text at most 16 KiB and 4,000 scalar values;
- bounded nesting, arrays, identifiers, evidence refs, and response sizes;
- serial per-profile receipt/index mutations;
- bounded async queue and outbox; overflow latches instead of dropping accepted
  work;
- provider timeout and output bounds;
- at most three safe outbound retries;
- one open pending question per root;
- bounded state counts; capacity exhaustion is visible and fail-closed;
- no event-body or ID as a metrics label.

The exact numeric record/retention bounds must be fixed in the Worker handoff and
tested before implementation acceptance. Silent eviction of dedupe, consumed
leases, or correlations is forbidden.

## 16. Time and ordering

Provider timestamps are correlation data, not sole authority. UUIDv7 runtime
IDs and local recorded timestamps are generated by the trusted runtime. Every
timestamp parser requires canonical UTC or exact Slack timestamp grammar.

Future skew, non-monotonic journal time, expired receive grant,
pointer-delivery grant, lease/capability, and evidence recorded before its
predecessor fail closed. Restart, retry, root binding, and reply do not extend
an expiry. Slack event time never determines Team, Actor, or Mission authority;
trusted durable receive time decides whether the receive-grant expiry was
exclusive.

## 17. Logging, status, and review evidence

Allowed routine output:

- schema/profile name;
- stable state and reason code;
- count and boolean facts;
- internal UUIDs when needed for local audit;
- artifact refs only when they contain no secret/raw provider ID;
- Git commit and SHA-256 refs for committed non-secret authority/evidence.

Forbidden output:

- secret file contents;
- tokens, prefixes, lengths, equality hashes, or token-derived values;
- ephemeral WebSocket URL or Slack response body;
- raw Leo text, subject, or rendered result body;
- raw workspace, App, channel, bot, or Slack user IDs in routine status;
- tmux pane content;
- provider error objects before redaction;
- arbitrary paths supplied by an event or error.

Redacted validation output is exactly the shape in
`docs/operations/AGENT_OFFICE_AS1_SLACK_SETUP.md`. A failure names only the
profile/field category and stable reason code.

## 18. Threat analysis

| Threat | Control | Failure result |
|---|---|---|
| app and bot tokens swapped | `auth.test` + `bots.info.app_id` + Socket `hello.app_id` | global start failure |
| other workspace token | exact `auth.test.team_id` and callback `team_id` | start failure/latch |
| wrong private channel or user | exact ID comparison after durable receipt | rejection; contradiction latch |
| display-name impersonation | names never used; natural bot identity only | ignored/rejected |
| Slack Connect leakage | `is_ext_shared_channel` must be absent/false | rejection |
| bot echo loop | startup bot IDs plus bot/app/subtype checks | rejection |
| edit/delete changes intent | every subtype/hidden mutation rejected | no intake |
| pre-event grant predicts future event/intake | receive schema forbids event/root/intake/pointer/destination fields and wildcards | grant rejection before connection |
| gateway mints authority from received bytes | grants must be Advisor-created committed/pushed first-add Git artifacts | global latch/no authority |
| concurrent first roots consume one grant | expected-version `UNBOUND -> ROOT_BOUND`, rootLimit=1 before ACK | one winner; other root rejected |
| Slack retry creates duplicate | two durable profile-local dedupe keys | ACK only, no second intake |
| crash before ACK | receipt/dedupe/root binding before ACK | provider retry, same binding/intake |
| crash after ACK before classify | durable receipt replay | async resume, same intake |
| second top-level after binding | consumed root slot and immutable root | durable rejection, no intake |
| receive expiry/restart ambiguity | exclusive persisted expiry; no extension | no new receive; drain durable work only |
| root/thread confusion | immutable root plus single pending question | reject continuation |
| content names a Worker/pane/command | opaque body; closed route union | no routing effect |
| path traversal | paths derived from validated IDs and fixed roots | schema rejection/latch |
| state symlink or corruption | no-follow/containment/exact schema/hash chain | quarantine/latch |
| stale/changed Advisor pane | exact lease + double preflight + authority recheck | stop before paste |
| delivery attempted without post-intake grant | exact intake/pointer-bound grant required before lease | no tmux authority |
| tmux result ambiguity | journal no-retry boundary | manual reconciliation |
| evidence forged or rewritten | exact Git commit/path/hash/ancestry/first-add history | quarantine |
| Foundation inherits Agent Office evidence | exact fresh roleInstanceId and prefix | reject |
| outbound response lost | durable `REQUEST_STARTED`, no blind resend | manual reconciliation |
| provider/SDK automatic retry | disabled and verified by fakes | implementation rejection/latch |
| token leaked in error | structured redaction before output/persistence | test failure/global latch |
| one profile corrupts the other | separate roots/hash chains and cross-ref ban | global latch |
| kill switch bypass | checked before every dequeue/side effect | operation abort/latch |
| capacity attack | explicit bounds; no silent eviction | profile latch |

## 19. Synthetic validation requirements

Phase A must use fake Slack and tmux ports and disposable owner-only state roots.
It must prove:

1. no real DNS, HTTP, WebSocket, Slack, or tmux mutation is reachable;
2. all secret-parser failures redact values;
3. four pair permutations: correct/correct, swapped bots, swapped apps, both
   swapped;
4. wrong hello, workspace, App, channel, user, authorization, and shared-channel
   negatives;
5. receipt/fsync before ACK and no ACK on persistence failure;
6. receive-grant schema rejects all event/intake/pointer/destination authority,
   no/expired/wrong-profile grant fails before connection, and no gateway code
   path creates a grant;
7. exact atomic first-root binding before ACK plus identical retry, correlated
   reply, second root, restart, expiry before/after root, disconnect, ambiguous
   ACK, kill, corruption, and profile-isolation traces;
8. pointer-delivery grant is impossible before exact immutable
   sourceEventId/intakeId/root/pointer/binding facts, and gateway output cannot
   substitute for the Advisor-created Git grant;
9. exact root/question concurrency and restart behavior;
10. one-use delivery-grant/lease/capability and every tmux journal boundary for
    both profiles;
11. evidence wrong-lineage, wrong-prefix, premature, rewritten, removed, dirty,
   and non-ancestral negatives;
12. exact outbound request plus all safe/ambiguous retry classes;
13. global/profile latch separation and no reset;
14. clean stop, forced drain timeout, lock contention, and restart;
15. unchanged Exact Delivery v2 focused tests;
16. secret/static scan over changed files and generated test artifacts.

Any test seam that accepts a caller-supplied production capability, generic
Slack method, generic route, or raw tmux target must remain test-only and be
unrepresentable in production composition.

## 20. Rollback and incident response

### Before a live connection

1. leave committed runtime selection disabled;
2. delete the external secret file if abandonment is intended;
3. revoke both app-level and bot tokens in Slack;
4. uninstall/remove both apps from pilot channels;
5. preserve non-secret commits as historical evidence.

### During or after a live connection

1. engage the global kill switch;
2. stop inbound dequeue and new side effects;
3. durably mark any started tmux/Slack write for manual reconciliation;
4. close both clients and revoke app-level tokens first, then bot tokens;
5. preserve state, journals, dedupe, correlations, and evidence unchanged;
6. compare Slack thread history and local journals manually without posting;
7. require a new reviewed recovery version before any reconnect.

Never recover by deleting a journal, clearing a latch, resetting dedupe,
rewriting Git evidence, reopening a receive-grant root slot, reusing a
retired/expired/latched receive grant or any consumed pointer-delivery
grant/lease/capability, or switching to the other profile. The only receive
grant resume is the exact same-pilot clean-restart case defined above.

## 21. Residual risks and explicit safe defaults

| Residual risk/unknown | Safe default |
|---|---|
| Slack provider may accept a post whose response is lost | no resend; manual reconciliation |
| SDK versions and internal retry/ACK behavior are not yet pinned | no dependency or implementation until design PASS; reject unsuitable SDK |
| live App/workspace/channel IDs and tokens are unset | no connection |
| live receive and pointer-delivery grants are unset | no receive or tmux authority |
| live pane IDs can change | fresh exact lease and double preflight for every pilot |
| Foundation evidence has no prior namespace | new isolated prefix; historical evidence invalid |
| capacity/retention values not yet fixed | Worker handoff must fix bounded values; no silent eviction |
| local same-UID compromise | outside AS1's ability to prevent completely; owner-only modes, no logs, rapid token revocation limit exposure |
| Slack service compromise | exact local authority still prevents route/command selection; kill and revoke |

The design deliberately does not claim that Socket Mode eliminates all provider
risk. It removes public ingress while retaining an external authenticated
transport and provider-controlled delivery semantics.

## 22. Independent review gates

The independent Reviewer should issue a verdict only after direct inspection
of:

- the two manifests and exact scope rationale;
- exact-key secret template and setup runbook;
- closed profile union and Actor lineage;
- startup pair proof and swapped-token tests;
- persist-before-ACK ordering and dedupe replay;
- pre-event receive-grant field exclusion, atomic one-root binding, expiry, and
  restart/retry/second-root behavior;
- post-intake pointer-delivery grant provenance and exact intake/pointer binding;
- pre-Mission and thread contracts;
- v2 non-regression boundary;
- profile receive/delivery-grant state, evidence, and capability separation;
- tmux and outbound ambiguity handling;
- global/profile latches, clean shutdown, and rollback;
- no live secret, Slack, tmux, public, DB, browser-dispatch, or self-review
  activity.

This Designer package is evidence for that review, not a security verdict.
Implementation approval, pilot authority, risk acceptance, and final closure
remain separate and belong to the assigned Reviewer, Advisor, and Leo/GPT under
their respective roles.
