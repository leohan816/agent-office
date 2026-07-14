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
  -> fresh single-use profile activation
  -> fresh single-use destination lease
  -> in-memory notification-bound capability
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
   before immutable receipt and dedupe state are durable.
6. **At-most-once intake** — retries, duplicate connections, and restart do not
   create a second intake.
7. **Pre-Mission truth** — a top-level Slack message is `NEW_MISSION` intake,
   not a canonical Mission Manifest.
8. **Thread integrity** — a reply binds one root and one open question; text
   never chooses a route or continuation kind.
9. **Exact Advisor delivery** — every attempt uses a fresh profile-bound lease
   and capability and a twice-verified destination.
10. **No blind resend** — uncertain tmux or Slack writes require manual
    reconciliation.
11. **Profile isolation** — state, evidence, authority consumption, and latches
    do not cross profiles.
12. **Secret and content confidentiality** — no token or raw message enters
    logs, Git, tmux pointer bytes, status output, or review artifacts.
13. **Fail-closed recovery** — corruption, identity contradiction, or ambiguous
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
| activation/lease/capability | exact authority refs, hashes, TTLs, use limit one |
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

Advisor evidence becomes trusted only as an exact committed/pushed Git blob
under the activated profile prefix, after ancestry, dirty-state, first-addition,
schema, identity, correlation, and ordering checks. Chat prose, pane capture,
working-tree bytes, branch names, filenames from Slack, and historical evidence
are not authority.

### 4.6 Tmux mutation boundary

Only the new AS1 exact transport can write one pointer to one prevalidated
Advisor pane under a fresh lease/capability. Observation, generic tmux APIs,
browser input, and Slack text cannot cross this boundary.

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

The activated profile comes from an exact reviewed activation artifact. No CLI
profile flag, Slack field, environment key, browser request, or evidence field
selects it.

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
  -> ARMED_ONE_PROFILE (exact reviewed activation)
  -> DRAINING
  -> DISABLED_CLEAN

any state -> DISABLED_LATCHED (global integrity failure)
```

Only one profile can be armed. `DISABLED_CLEAN` does not authorize another
pilot; the next pilot needs a new activation. `DISABLED_LATCHED` has no reset in
AS1.

### 7.2 Profile state

```text
INACTIVE
  -> AUTHENTICATING
  -> AUTHENTICATED_QUARANTINE
  -> READY_ONE_PILOT
  -> DRAINING
  -> STOPPED_CLEAN

any live state -> RECONCILIATION_REQUIRED -> LATCHED
```

No transition is inferred from a process existing. Each transition is an exact
state-machine operation with expected prior state, request ID, timestamp,
authority hash, hash-chained receipt, and atomic persistence.

## 8. Activation, lease, and capability invariants

### 8.1 Activation

An activation is invalid unless it:

- descends from independently reviewed implementation and Advisor acceptance;
- names one fixed profile and one pilot ID;
- binds one exact intake/event identity;
- binds current organization registry and role lineage;
- binds global/profile control states and evidence prefix;
- names exact authority roots and snapshot hashes;
- has no alternate/fallback profile or destination;
- is committed, pushed, clean, and upstream-ancestral;
- remains unchanged through the attempt.

### 8.2 Readiness lease

A lease is invalid unless it:

- is newly added once under the exact activation path;
- names the same profile/pilot/intake/event/pointer hash;
- has exact Team, actorId, roleInstanceId, session, workspace, and process;
- records a current complete structured tmux destination;
- records synchronized panes off, pane live, input enabled, and no copy mode;
- has `useLimit: 1` and an exclusive short expiry no longer than 30 seconds;
- descends from every activation authority snapshot;
- is clean, pushed, and byte-stable;
- matches the first live preflight.

Lease consumption is durable before buffer load. Consumption is permanent,
including a subsequent validation failure.

### 8.3 In-memory capability

The capability is valid only for one:

```text
activation + pilot + profile + intake + Slack event + pointer hash
+ lease + destination fingerprint + authority hashes + expiry
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
durable immutable receipt + durable dedupe acceptance
  happens-before
Socket ACK write
  happens-before
business classification
```

Tests must observe the exact call order. A receipt write failure results in no
ACK. A process crash between persistence and ACK produces a safe Slack retry,
which finds identical durable bytes and cannot create a second intake.

### 9.3 Identity filter

The classifier compares raw IDs to the selected in-memory profile using
constant-time byte comparison where practical. Names, display names, channel
names, topics, URLs, mentions, and deprecated verification tokens are ignored.

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

Root correlation binds profile, workspace, app, channel, root timestamp,
Slack event, intake, and message hash. It cannot be reassigned.

Question correlation binds root, question ID, expected response kind, evidence
ref/hash, and consumption state. Reply acceptance atomically changes
`OPEN -> CONSUMED` under expected version. Concurrent or repeated replies lose
the compare-and-append and are rejected.

A Slack retry never refreshes time-to-live, reopens a question, or resets an
attempt counter.

## 11. Evidence authority security

### 11.1 Source constraints

Evidence paths are derived from the activation's fixed prefix, profile state
slug, validated intake UUID, and fixed filename grammar. Evidence cannot provide
its own path. The reader uses closed `/usr/bin/git` argv, `shell: false`, fixed
environment, bounded timeout/output, exact commits, and no `--follow` history.

### 11.2 Stage order

```text
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
- receipt/dedupe/root/question store corruption;
- exact destination/lease/capability failure;
- tmux transport ambiguity;
- evidence rewrite/removal/order/profile defect;
- Slack outbound ambiguity;
- retention/capacity bound exhaustion.

### 14.2 Global latch causes

- secret file grammar, ownership, or mode failure;
- token/App swap or equality across profiles;
- shared profile state path or cross-profile hash/reference;
- organization registry cannot resolve both exact identities;
- active-profile mutual exclusion violation;
- global control corruption;
- an event/evidence/capability crosses profile roots;
- attempted generic target or bypass of the closed profile union.

### 14.3 Latch behavior

Latch persistence happens before client close where possible. New inbound
messages are not accepted, new tmux/outbound attempts do not start, and status
reports only stable reason codes. If latch persistence itself fails, terminate
both clients and fail startup on the next run due to unverifiable control state.

There is no runtime enable/reset endpoint, browser action, Slack command, signal
shortcut, state deletion, or automatic backoff reset.

## 15. Denial-of-service bounds

- one active profile and one Socket connection for its pilot;
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

Future skew, non-monotonic journal time, expired lease/capability, and evidence
recorded before its predecessor fail closed. Restart does not extend an expiry.
Slack event time never determines Team, Actor, or Mission authority.

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
| Slack retry creates duplicate | two durable profile-local dedupe keys | ACK only, no second intake |
| crash before ACK | persist-before-ACK | provider retry, same intake |
| crash after ACK before classify | durable receipt replay | async resume, same intake |
| root/thread confusion | immutable root plus single pending question | reject continuation |
| content names a Worker/pane/command | opaque body; closed route union | no routing effect |
| path traversal | paths derived from validated IDs and fixed roots | schema rejection/latch |
| state symlink or corruption | no-follow/containment/exact schema/hash chain | quarantine/latch |
| stale/changed Advisor pane | exact lease + double preflight + authority recheck | stop before paste |
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
6. every crash boundary and duplicate/conflict case;
7. exact root/question concurrency and restart behavior;
8. one-use lease/capability and every tmux journal boundary for both profiles;
9. evidence wrong-lineage, wrong-prefix, premature, rewritten, removed, dirty,
   and non-ancestral negatives;
10. exact outbound request plus all safe/ambiguous retry classes;
11. global/profile latch separation and no reset;
12. clean stop, forced drain timeout, lock contention, and restart;
13. unchanged Exact Delivery v2 focused tests;
14. secret/static scan over changed files and generated test artifacts.

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
rewriting Git evidence, reusing an activation/lease/capability, or switching to
the other profile.

## 21. Residual risks and explicit safe defaults

| Residual risk/unknown | Safe default |
|---|---|
| Slack provider may accept a post whose response is lost | no resend; manual reconciliation |
| SDK versions and internal retry/ACK behavior are not yet pinned | no dependency or implementation until design PASS; reject unsuitable SDK |
| live App/workspace/channel IDs and tokens are unset | no connection |
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
- pre-Mission and thread contracts;
- v2 non-regression boundary;
- profile state/evidence/capability separation;
- tmux and outbound ambiguity handling;
- global/profile latches, clean shutdown, and rollback;
- no live secret, Slack, tmux, public, DB, browser-dispatch, or self-review
  activity.

This Designer package is evidence for that review, not a security verdict.
Implementation approval, pilot authority, risk acceptance, and final closure
remain separate and belong to the assigned Reviewer, Advisor, and Leo/GPT under
their respective roles.
