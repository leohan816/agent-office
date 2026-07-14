# AS1 Multi-Team Slack Pilot Integration Design

Status: `DESIGN_CANDIDATE__PENDING_INDEPENDENT_DESIGN_REVIEW`

Mission: `AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_PILOT_001`

Mode: `BOUNDED_SECURITY_TRANSPORT_DESIGN_MODE`

Design base: `50124a1ea720e162e906c04c6f6fb2591c4974b8`

Setup Pack checkpoint:
`a1c54eabfda832b70bb974c288386237a8843e32`

This document specifies an additive, private Socket Mode pilot for exactly two
Advisor routes. It is implementation guidance, not runtime authority. No Slack
client, token, capability, server, listener, tmux mutation, or live pilot is
created by this design.

## 1. Decision and fixed boundary

The additive design is implementable without weakening Exact Delivery v2.
Existing v2 types, activation parsing, authority snapshots, lease consumption,
transport journal, evidence ingress, historical evidence, and fixed Agent
Office Advisor behavior remain byte-compatible and continue to use their
existing paths and state namespaces.

AS1 adds a sibling service with a closed two-member profile union. It does not
turn Exact Delivery v2 into a multi-destination transport and does not make the
current mission-bound Advisor Inbox accept a fabricated Mission ID.

In scope:

- one local gateway process with two separately authenticated Slack client
  slots;
- private Socket Mode only;
- one fixed Agent Office Advisor route and one fixed Foundation Advisor route;
- top-level Leo messages as immutable `NEW_MISSION` intake only;
- correlated same-thread Leo replies;
- structured Advisor ACK, intake, question, and result evidence;
- exact profile-specific Advisor pointer delivery under fresh one-use authority;
- durable file-backed state, replay, redaction, failure isolation, kill switch,
  shutdown, and rollback;
- synthetic Phase A validation with no real tokens or Slack connection.

Out of scope:

- VibeNews, DMs, MPIMs, public channels, Slack Connect, App Home, slash commands,
  shortcuts, interactive components, workflows, files, reactions, canvases, or
  public Request URLs;
- `status`, `agents`, or `missions` command surfaces;
- arbitrary Team, Actor, session, pane, workspace, model, effort, executable,
  command, or path selection;
- direct Worker, Reviewer, Designer, or Control dispatch;
- browser-to-actor dispatch, browser-to-terminal input, or a generic execution
  endpoint;
- database, schema, migration, Hermes, public ingress, production rollout, or
  reusable/broad Slack authority;
- Mission Manifest creation by Slack or by the gateway.

## 2. Current baseline facts

The design relies on these directly inspected baseline facts:

1. `src/application/organization/registry.ts` separates immutable
   `roleInstanceId` from current routable `actorId`.
2. The continuing Agent Office Advisor has immutable `roleInstanceId`
   `foundation-advisor` and current `actorId` `agent-office-advisor`.
3. The new Foundation Advisor has immutable `roleInstanceId`
   `foundation-advisor-20260714-01` and current `actorId`
   `foundation-advisor`; it inherits no historical Agent Office evidence.
4. Exact Delivery v2 is mission-specific and physically fixed to the current
   Agent Office Advisor. It rejects other missions and destinations before tmux
   mutation.
5. `AdvisorInboxService` is bound to one loaded Mission Manifest. Its
   `persistMessage` path cannot represent a pre-Mission Slack intake without
   falsely supplying a Mission ID and manifest version.
6. Current Advisor evidence ingress supports ACK, intake, decision, and resume
   for the existing governed mission. It has no Slack final-result contract and
   is bound to the existing activation job.
7. Current delivery control and exact transport journals have global v2 paths.
   AS1 must not reuse those paths for either profile.

## 3. Closed route profiles

The exported profile contract is a discriminated union with exactly these two
members. There is no constructor that accepts free-form identity or destination
fields.

| Field | Agent Office profile | Foundation profile |
|---|---|---|
| `profileId` | `AGENT_OFFICE_ADVISOR` | `FOUNDATION_ADVISOR` |
| `profileStateSlug` | `agent-office-advisor` | `foundation-advisor` |
| `advisorTeam` | `AGENT_OFFICE_ADVISOR_TEAM` | `FOUNDATION_ADVISOR_TEAM` |
| immutable `roleInstanceId` | `foundation-advisor` | `foundation-advisor-20260714-01` |
| routable `actorId` | `agent-office-advisor` | `foundation-advisor` |
| required role | `ADVISOR` | `ADVISOR` |
| session name | `agent-office-advisor` | `foundation-advisor` |
| workspace | `/home/leo/Project/agent-office` | `/home/leo/Project/FOUNDATION` |
| current command | `codex` | `codex` |
| private channel | exact external `SLACK_AGENT_OFFICE_CHANNEL_ID` | exact external `SLACK_FOUNDATION_CHANNEL_ID` |
| Slack app | exact external `SLACK_AGENT_OFFICE_APP_ID` | exact external `SLACK_FOUNDATION_APP_ID` |
| Slack app display name | `agent-office-advisor` | `foundation-advisor` |
| Slack bot display name | `agent-office-advisor` | `foundation-advisor` |
| evidence namespace | `agent-office-advisor` | `foundation-advisor` |

The app and bot display names are fixed operator-facing setup labels, not
routing authority. Only the selected closed profile and its exact immutable
workspace, App, channel, and Leo user IDs participate in Slack identity and
route validation.

The intake observed Agent Office at `$26/@26/%26` and Foundation at
`$27/@27/%27`. Those locator values are evidence at one time, not permanent
configuration. Each real pilot requires a fresh exact lease that records and
binds the then-current session ID, window ID/index, pane ID/index, pane PID,
window name, workspace, current command, synchronized-panes state, activity
time, observation time, and registry/authority hashes. Any mismatch fails
closed. Slack content can never supply or override a locator.

The only external values admitted into a profile are the exact ten keys in
`config/slack/as1-slack-pilot.env.example`. The parser assigns each value to its
already-selected union member; it never builds a route from text.

## 4. Service topology

```text
owner-only exact-key secret file
        |
        v
strict data parser + startup identity verifier
        |
        v
AS1 Slack Gateway (one process, global kill switch)
        |
        +-- Agent Office client slot -- profile-local durable state
        |
        +-- Foundation client slot ---- profile-local durable state
                 |
                 v
persisted Socket envelope -> transport ACK -> async classifier
                 |
                 v
immutable NEW_MISSION / thread-continuation intake
                 |
                 v
fresh profile lease + in-memory capability + exact tmux pointer
                 |
                 v
responsible Advisor -> committed structured evidence
                 |
                 v
profile evidence ingress -> durable Slack outbox -> exact thread reply
```

There is one lifecycle owner and one global kill switch, but no shared mutable
profile data. Client, token references, receipt artifacts, dedupe indexes,
intakes, root correlations, pending questions, activation, capability
consumption, tmux journal, evidence checkpoint, outbound journal, and failure
latch are profile-local.

The service has two statically constructed client slots. A fresh pilot
activation selects exactly one slot for live connection. The second real pilot
uses a separate activation after the first is cleanly stopped and reconciled.
No command-line or Slack-supplied profile selector exists; the reviewed
activation artifact names one literal `profileId`.

## 5. Setup and secret parsing

### 5.1 Filesystem gate

The only secret path is:

```text
/home/leo/.config/agent-office/as1-slack-pilot.env
```

Before reading bytes, the implementation must:

1. require the parent to be a real non-symlink directory owned by the runtime
   UID with mode exactly `0700`;
2. open the file with no-follow semantics and require a regular file owned by
   the runtime UID with mode exactly `0600`;
3. cap the file at 32 KiB;
4. read from the already-open handle and re-check identity/metadata to prevent a
   check/use swap;
5. reject NUL, non-UTF-8, CR, control characters, BOM, blank lines, comments,
   whitespace around names or values, quoting, interpolation, export syntax,
   duplicate keys, unknown keys, and multiline values;
6. require exactly the ten keys, once each and in any order;
7. parse as data only. Never call `source`, `eval`, a shell, dotenv expansion,
   or merge with `process.env`.

IDs use bounded Slack-ID syntax and tokens use only token-class prefixes and
bounded printable bytes. Token values remain opaque. Parser and error output may
name a key but must not echo a value, prefix, length, or hash.

### 5.2 Minimum Slack permissions

Each bot requests exactly:

- `groups:history` for the `message.groups` private-channel event;
- `chat:write` for a reply in the bot's already-joined private channel;
- `users:read` only so `bots.info` can return the bot's `app_id` during startup
  pair verification. The application must never call `users.list`,
  `users.info`, or read profiles.

Each app-level token has only `connections:write`. There is no user token,
signing secret, incoming webhook, OAuth server, Request URL, or impersonation
scope.

## 6. Startup authentication and pair verification

No profile becomes `READY` on token shape alone. For the activated profile,
startup executes this exact sequence with bounded time/output and redacted
errors:

1. Parse both profile records and require different App IDs, channel IDs, bot
   tokens, and app tokens. Require the same configured workspace and the exact
   approved Leo user ID.
2. Call `auth.test` with the selected profile's bot token. Require `ok: true`,
   exact configured workspace ID, bounded bot user ID, and bounded bot ID.
3. Call `bots.info` with that bot token and the returned bot ID. Require
   `ok: true`, the same bot ID/user ID, `deleted: false`, and `bot.app_id` equal
   to the selected profile's configured App ID.
4. Call `apps.connections.open` with the selected profile's app-level token and
   connect the returned ephemeral WebSocket URL without logging it.
5. Require the first bounded Socket message to be `hello` and require
   `connection_info.app_id` to equal the selected profile's configured App ID.
6. Mark the client `AUTHENTICATED_QUARANTINE`; it still cannot accept a message
   until its profile activation, global control, state store, registry lineage,
   and exact destination authority all validate.
7. On the first Events API callback, additionally require `team_id`,
   `api_app_id`, and bot authorization identity to agree with the startup facts
   before the event can enter policy classification.

Swapped bot tokens fail step 3. Swapped app tokens fail step 5. A token from a
different workspace fails step 2 or event validation. Any credential or identity
mismatch fails the complete start before message acceptance; it is not a
profile-local transient retry.

SDK automatic retries and automatic event acknowledgements must be disabled.
If the selected official SDK version cannot give application code exclusive
control over persist-before-ACK and outbound retry classification, that version
is not acceptable.

## 7. Durable state layout

AS1 uses the existing owner-only atomic-file and immutable-artifact primitives,
but a new root namespace. It does not introduce a database.

```text
<state-root>/
  indexes/as1-slack-pilot/global-control.json
  indexes/as1-slack-pilot/active-pilot.json
  indexes/as1-slack-pilot/profiles/agent-office-advisor/
    activation.json
    failure-latch.json
    inbound-dedupe.json
    root-correlations.json
    pending-questions.json
    readiness-lease-consumption.json
    evidence-ingress-checkpoint.json
    tmux-delivery/<deliveryId>.json
    slack-outbox/<outboundId>.json
  indexes/as1-slack-pilot/profiles/foundation-advisor/
    <same names, independent bytes and hash chains>
  artifacts/as1-slack-pilot/agent-office-advisor/
    inbound/<eventId>/<sha256>.json
    intake/<intakeId>/<sha256>.json
    pointers/<deliveryId>/<sha256>.json
    evidence/<evidenceId>/<sha256>.json
    outbound/<outboundId>/<sha256>.json
  artifacts/as1-slack-pilot/foundation-advisor/
    <same names, independent bytes>
```

Every mutable index is exact-key, versioned, bounded, hash-chained where order
matters, and atomically replaced with file and parent-directory durability. A
malformed, missing-after-acceptance, rewritten, cross-profile, or hash-invalid
record quarantines only that profile unless it affects global control or proves
cross-profile contamination; those cases latch the global kill switch.

The following existing paths are never read as AS1 state and never written by
AS1:

- `indexes/advisor-readiness-leases.json`;
- `indexes/tmux-delivery/`;
- `indexes/advisor-evidence-ingress.json`;
- `indexes/delivery-control.json`;
- existing `artifacts/inbox/`, `gateway-pointers/`, and exact-delivery evidence.

## 8. Socket envelope contract and ACK order

### 8.1 Outer shape gate

The Socket client accepts only a bounded UTF-8 JSON object with exact fields
supported by the selected SDK's raw Events API envelope:

```text
type: events_api
envelope_id: bounded nonempty opaque ID
accepts_response_payload: false | absent
retry_attempt: bounded nonnegative integer | absent
retry_reason: bounded known string | absent
payload: bounded Events API callback object
```

Maximum raw envelope size is 32 KiB; maximum message text is 16 KiB UTF-8 and
4,000 Unicode scalar values. Arrays, nesting depth, and individual ID lengths
are bounded. Unknown top-level Socket envelope fields are rejected unless the
selected SDK documents them and the reviewed parser version adds them.

### 8.2 Required order

For every syntactically valid envelope with a usable `envelope_id`:

1. validate the outer shape and selected client/profile binding;
2. canonicalize the raw received object without token material;
3. derive `envelopeHash` and Events API `eventIdentity`;
4. write the immutable owner-only envelope artifact;
5. atomically insert/check both profile-local dedupe identities;
6. durably record `RECEIPT_PERSISTED`;
7. only then send `{ "envelope_id": <exact received ID> }` on the same client;
8. record `TRANSPORT_ACK_RECORDED`;
9. schedule asynchronous policy classification.

If steps 4-6 fail, send no ACK so Slack may retry. If the ACK write is
ambiguous, retain the durable receipt and rely on dedupe when Slack retries; do
not create a second intake. A replay with the same identity and bytes is ACKed
again after verifying the durable receipt. The same identity with different
bytes quarantines the profile.

This Socket ACK means only that the gateway durably received the envelope. It
is not an Advisor ACK, intake decision, Mission creation, dispatch, or result.

### 8.3 Dedupe identities

Both keys are required:

```text
(profileId, envelope_id)
(profileId, team_id, api_app_id, event_id)
```

The record also binds raw hash, inner-event hash, first/last received time,
retry attempt/reason, classification, intake ID if any, and terminal reason
code. Neither profile can see, collide with, or satisfy the other's key.

## 9. Inbound policy matrix

After transport ACK, asynchronous policy classification requires all common
facts:

- selected fixed profile is active and not latched;
- outer payload type is exactly `event_callback`;
- exact configured workspace `team_id`;
- exact configured `api_app_id`;
- exact configured private channel ID;
- inner `type: message` and `channel_type: group`;
- exact approved Leo `user` ID;
- `is_ext_shared_channel` is absent or false;
- no bot/app identity field, no `bot_profile`, no hidden flag, and no subtype;
- bounded `event_id`, `event_time`, `ts`, `event_ts`, and text;
- event time is not unreasonably future-dated; ordering uses durable receive
  time and Slack identity, never wall-clock inference alone.

| Input | Classification | Effect |
|---|---|---|
| Leo message with no `thread_ts` | `NEW_MISSION` | one immutable pre-Mission intake and root correlation |
| Leo reply whose `thread_ts` equals a known root and exactly one compatible question is pending | question's fixed response kind | one `CLARIFICATION` or `DECISION_RESPONSE` continuation |
| replay/retry with identical identities and bytes | `DUPLICATE` | no new intake; ACK transport receipt only |
| `message_changed`, `message_deleted`, any subtype, or `hidden: true` | `REJECTED_MUTATION_OR_SUBTYPE` | minimal durable audit, no intake |
| bot/app/echoed outbound message | `REJECTED_NON_LEO_OR_BOT` | minimal durable audit, no intake |
| wrong workspace/app/channel/user or shared channel | `REJECTED_IDENTITY` | minimal durable audit and profile latch on authenticated-profile contradiction |
| DM, MPIM, public channel, App Home, interactive, command, or unknown envelope type | `REJECTED_SURFACE` | minimal durable audit, no intake |
| thread reply with no root, wrong root, no pending question, or already-consumed question | `REJECTED_THREAD_CORRELATION` | minimal durable audit, no intake |
| exact deferred query command | `REJECTED_DEFERRED_QUERY` | minimal durable audit, no Mission/query behavior |

The deferred-query matcher trims Unicode whitespace, applies Unicode
case-folding, and rejects when the first token is exactly `status`, `agents`,
or `missions`, with or without a leading slash. It does not execute or parse the
remaining text.

Rejected artifacts retain only the minimum correlation and reason code needed
for audit. Wrong-profile content is never copied to the other profile.

## 10. Root and thread correlation

For an accepted top-level message, the root key is:

```text
(profileId, workspaceId, appId, channelId, rootTs)
```

Exactly one immutable root-correlation record may bind that key to one
`intakeId`, `eventId`, and message-artifact hash. The root's `ts` must equal the
event's `ts`; a top-level event carrying `thread_ts` is not a root.

A thread continuation is accepted only when:

1. `thread_ts` exactly equals an existing accepted `rootTs` in the same profile;
2. `ts` differs from `thread_ts`;
3. the common identity gate still passes;
4. exactly one latest unanswered Advisor question is open for that root;
5. the question fixes `expectedResponseKind` to `CLARIFICATION` or
   `DECISION_RESPONSE`;
6. the question has not already consumed a reply;
7. the reply atomically consumes that question before any new delivery.

Slack text never chooses its kind. A reply's kind comes only from the pending
question record produced by validated Advisor evidence. Unsolicited thread
messages cannot create a second Mission intake.

## 11. Pre-Mission intake contracts

AS1 has a separate application boundary, not an extension of the current
mission stream.

```text
As1NewMissionIntakeV1
  schemaVersion: agent-office.as1-new-mission-intake.v1
  intakeId: UUIDv7
  kind: NEW_MISSION
  profileId: closed union
  advisorTeam: exact profile value
  advisorActorId: exact profile value
  advisorRoleInstanceId: exact profile value
  sourceEventId: Slack event ID
  rootTs: Slack root timestamp
  messageArtifactRef: profile-local immutable ref
  messageArtifactHash: SHA-256
  receiptArtifactRef: profile-local immutable ref
  receivedAt: UTC
  recordedAt: UTC
  authorityState: INTAKE_ONLY
  canonicalMissionCreated: false
  canonicalMissionRef: null
```

The raw text exists only in the owner-only immutable message artifact. Indexes,
logs, tmux pointer bytes, and Slack-visible receipts contain hashes/references
and bounded summaries, not the body.

An Advisor may later create a canonical Mission Manifest under its normal
authority. If that occurs, separately committed Advisor intake evidence may
carry an exact `SourceArtifactRef`. The gateway verifies it but never derives,
mints, edits, or approves it.

Continuation records bind the original `intakeId`, root key, pending
`questionId`, source event, immutable message ref/hash, and fixed continuation
kind. They cannot alter the root profile or Advisor identity.

## 12. Exact Advisor pointer transport

AS1 adds a separate exact transport implementation. It may reuse low-level
atomic-file and hashing primitives, but it must not relax, overload, or branch
inside Exact Delivery v2 schemas or state.

### 12.1 Activation

Each pilot activation is an exact, committed, pushed authority artifact that
binds:

- schema and activation IDs;
- one literal profile ID;
- one pilot ID and one intake/event identity;
- exact organization-registry row and hash;
- exact profile evidence prefix;
- global kill state and profile-local activation state;
- exact authority repository/root/source IDs;
- capability/preflight TTLs and tool limits;
- use limit `1`;
- no second route and no fallback route.

The two real pilots use different activation IDs and never coexist as active.

### 12.2 Readiness lease

The responsible Advisor supplies a fresh, committed, pushed, single-use lease:

```text
As1AdvisorReadinessLeaseV1
  schemaVersion
  leaseId
  activationId
  pilotId
  profileId
  intakeId
  sourceEventId
  pointerHash
  advisorTeam
  actorId
  roleInstanceId
  destination:
    sessionName, sessionId, windowName, windowId, windowIndex,
    paneId, paneIndex, panePid, workspace, currentCommand,
    paneDead=false, paneInMode=false, inputOff=false,
    synchronizePanes=false, activityTime
  readiness: IDLE_FOR_ONE_AS1_POINTER
  useLimit: 1
  observedAt, issuedAt, expiresAt
  authoritySnapshotHash, registrySnapshotHash, activationSnapshotHash
  evidenceRefs
```

All identity fields must equal the selected static profile. Exact live fields
must match two bounded structured tmux preflights. The lease is consumed and
fsynced before the first tmux mutation. A consumed lease can never be reused,
even when the attempt fails before paste.

### 12.3 Capability and pointer

After static validation and first preflight, the service creates an in-memory
capability bound to activation, lease, pilot, profile, intake, Slack event,
pointer hash, destination fingerprint, authority hashes, issue time, and
exclusive expiry. It is not serialized into config, Slack, or a browser.

Pointer bytes use an exact schema and contain no body or target selector:

```text
As1AdvisorPointerV1
  schemaVersion
  pilotId
  profileId
  intakeId
  intakeKind
  sourceEventId
  rootCorrelationHash
  intakeArtifactRef
  intakeArtifactHash
  recordedAt
```

The transport destination is derived solely from the validated profile lease,
never from pointer or Slack bytes.

### 12.4 Journal and ambiguity

Each profile has the phases:

```text
PREPARED -> BUFFER_LOADED -> PASTE_STARTED -> PASTE_CONFIRMED
         -> SUBMIT_STARTED -> TRANSPORT_RECORDED
```

Any interrupted nonterminal journal becomes
`MANUAL_RECONCILIATION_REQUIRED`. Paste or Enter is never repeated after
`PASTE_STARTED`. Buffer cleanup is allowed only when the journal proves paste
did not start and a fresh preflight proves the same destination. Capability,
lease, profile, pointer, destination, and authority hashes are invariant across
the hash chain.

## 13. Advisor evidence source and contracts

AS1 evidence is committed, pushed Git evidence under two non-overlapping
prefixes derived from the selected activation, for example:

```text
advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/
  runtime-evidence/agent-office-advisor/<intakeId>/
  runtime-evidence/foundation-advisor/<intakeId>/
```

The exact authority repository, root, Git source, prefix, and activation commit
are reviewed inputs. A Slack field cannot supply a repository or path. Each new
evidence path must have exactly one Git-addition history, be upstream-ancestral,
descend from the activation snapshots, and remain byte-identical after first
acceptance. Rewrite, deletion, dirty state, wrong ancestry, premature stage, or
cross-profile reference quarantines that profile.

### 13.1 Advisor ACK

`agent-office.as1-advisor-ack.v1` binds profile, pilot, intake, source event,
root correlation, pointer ref/hash, transport journal ref/hash, consumed lease,
exact Actor/roleInstanceId/Team, Advisor acknowledgement ID/time, and evidence
refs. It proves the responsible Advisor read the pointer artifact. It is not the
Socket transport ACK.

### 13.2 Advisor intake

`agent-office.as1-advisor-intake.v1` binds the accepted ACK plus one
classification:

```text
ACCEPTED_NEW_MISSION
CLARIFICATION_RECORDED
DECISION_RESPONSE_RECORDED
REJECTED_BY_ADVISOR
```

For `ACCEPTED_NEW_MISSION`, `canonicalMissionCreated` remains false unless the
evidence includes a separately authorized exact canonical manifest ref. The
gateway validates such a ref but never creates it. Intake cannot name a
different profile, Team, Actor, root, or Slack identity.

### 13.3 Advisor outbound and result

`agent-office.as1-advisor-outbound.v1` is a closed union:

```text
ACK
  intakeId, advisorAckId, bounded summary

QUESTION
  intakeId, questionId, questionKind,
  expectedResponseKind: CLARIFICATION | DECISION_RESPONSE,
  bounded question text

RESULT
  intakeId, resultId, terminalStatus,
  exact durable result SourceArtifactRef, bounded summary
```

The evidence contains no channel, app, workspace, thread target, bot identity,
tmux locator, token, username/icon override, blocks, attachment, or Web API
method. Channel and `thread_ts` are derived from the immutable root correlation.

A final `agent-office.as1-advisor-result.v1` binds the latest accepted intake,
all consumed questions/replies, the durable result ref, and the `RESULT`
outbound record. Foundation evidence must use
`roleInstanceId: foundation-advisor-20260714-01`; the historical
`foundation-advisor` join key is invalid for Foundation output.

## 14. Durable outbound Slack transport

Validated Advisor evidence is rendered into a bounded plain-text reply. The
request is exact:

```text
method: chat.postMessage
token: selected profile bot token (Authorization header only)
channel: immutable root channel ID
thread_ts: immutable rootTs
text: validated rendered ACK, QUESTION, or RESULT
mrkdwn: false
reply_broadcast: false
unfurl_links: false
unfurl_media: false
```

No `username`, `icon_url`, `icon_emoji`, `as_user`, blocks, attachments,
metadata, or arbitrary method name is permitted.

Before network I/O, write immutable rendered bytes and an outbox journal record
`PREPARED`. Journal phases are:

```text
PREPARED -> REQUEST_STARTED -> RESPONSE_RECORDED
                           \-> MANUAL_RECONCILIATION_REQUIRED
```

Retry is permitted only when the adapter proves no request bytes were handed to
the network, or Slack returned an explicit rate-limit response that proves the
method was not accepted. Retry count is at most three with bounded backoff and
shutdown cancellation. Timeout/reset after request write, malformed success,
5xx, lost response, or any uncertain state is ambiguous: latch the profile,
record manual reconciliation, and never blind-resend. A success must return the
exact channel plus a bounded Slack message timestamp; the response and request
hash are durably recorded before the outbox becomes terminal.

Echoed bot events are rejected by exact startup bot ID/user ID, App ID,
`bot_id`/`app_id`/`bot_profile`, and subtype checks. They never become a Leo
reply.

## 15. Replay, retry, kill switch, and shutdown

### 15.1 Restart replay

On startup, before opening Socket Mode:

1. validate global control and both profile state trees;
2. quarantine corruption before network access;
3. convert interrupted inbound receipt after persistence into replayable async
   work without a second intake;
4. convert interrupted tmux or outbound network phases into manual
   reconciliation as specified above;
5. resume only durable `RECEIPT_PERSISTED`/`TRANSPORT_ACK_RECORDED` async
   classifications and definitely-unsent outbox entries;
6. preserve dedupe, consumed leases, root correlations, question consumption,
   evidence checkpoints, and latches.

### 15.2 Failure isolation

A profile-local state failure, Slack disconnect, rate limit, exact-destination
mismatch, transport ambiguity, evidence defect, or outbound ambiguity latches
that profile. The other profile retains its prior state and may operate only if
it has a separate valid activation and the global switch remains disengaged.

Credential cross-pairing, shared state/path identity, cross-profile evidence,
global-control corruption, secret-parser failure, or impossible profile union
state engages the global kill switch and closes both clients.

No latch has an automatic reset. Recovery requires a separately reviewed
procedure/version. Deleting state is not recovery.

### 15.3 Clean shutdown

On SIGTERM/SIGINT or planned `stop`:

1. atomically change lifecycle to `DRAINING` and refuse new envelopes;
2. ACK only envelopes already durably persisted;
3. stop async dequeue, exact delivery, evidence polling, and outbound starts;
4. wait a bounded deadline for in-flight atomic writes;
5. close the active Socket client and discard its ephemeral URL;
6. fsync final control state and release the single-process lock;
7. report redacted state only.

If an operation is ambiguous at the deadline, record reconciliation-required
and latch the profile. `restart` never clears it.

## 16. Additive compatibility strategy

The Worker must treat these files and contracts as protected compatibility
surfaces unless an independent review explicitly finds an unavoidable conflict:

- `src/adapters/gateways/tmux-advisor/exact-config.ts`;
- `src/adapters/gateways/tmux-advisor/exact-authority.ts`;
- `src/adapters/gateways/tmux-advisor/exact-transport.ts`;
- `src/application/advisor-inbox/evidence-ingress.ts`;
- existing Exact Delivery v2 tests, journals, schemas, artifact paths, and
  accepted evidence;
- current Agent Office `AdvisorInboxService` semantics.

AS1 must not add a profile field to v2, widen `AdvisorNotificationRequest`,
permit another v2 mission, move v2 state, reinterpret historical
`roleInstanceId`, or make `NodeExactTmuxMutationRunner` accept an arbitrary
target.

AS1 may import shared validation, canonical JSON, hashing, path-safety, atomic
file, immutable artifact, runtime identity, and organization-registry read
primitives. It owns new schemas and namespaces.

## 17. Exact source-area proposal

This is a Worker scope proposal, not current edit permission. The Advisor must
convert the reviewed proposal into an exact implementation handoff.

### New source

- `src/application/slack-pilot/contracts.ts` — exact schema types/parsers.
- `src/application/slack-pilot/profiles.ts` — closed two-member union and
  registry-lineage validation.
- `src/application/slack-pilot/inbound-store.ts` — receipt, dedupe, root, and
  continuation persistence.
- `src/application/slack-pilot/service.ts` — persist/ACK/async classification
  orchestration.
- `src/application/slack-pilot/evidence-ingress.ts` — profile-specific Git
  evidence verification.
- `src/application/slack-pilot/outbox.ts` — rendered outbound state machine.
- `src/adapters/gateways/slack-pilot/secret-config.ts` — strict file parser and
  redacted projection.
- `src/adapters/gateways/slack-pilot/socket-client.ts` — narrow raw Socket Mode
  port; manual ACK only.
- `src/adapters/gateways/slack-pilot/web-client.ts` — fixed `auth.test`,
  `bots.info`, and `chat.postMessage` calls only.
- `src/adapters/gateways/slack-pilot/exact-authority.ts` — AS1 activation,
  readiness lease, capability, Git authority, and consumption.
- `src/adapters/gateways/slack-pilot/exact-transport.ts` — separate exact tmux
  journal/runner.
- `src/operations/readiness/as1-slack-control.ts` — global and profile latches,
  lifecycle, lock, and status.
- `src/runtime/as1-slack-pilot/composition.ts` — shared service composition.
- `src/runtime/as1-slack-pilot/cli.ts` — closed lifecycle command parser.

### Proposed configuration/package changes

- one committed, default-disabled, non-secret AS1 runtime descriptor whose live
  activation refs remain unset;
- one exact `as1:slack-pilot` package script;
- pinned official Slack Socket Mode/Web API packages and lockfile changes only
  after design PASS and package/security review;
- no generic HTTP server, Request URL, browser route, or dynamic method client.

### Proposed focused tests

- `tests/contract/as1-slack-profiles.test.ts`;
- `tests/security/as1-slack-secret-config.test.ts`;
- `tests/integration/as1-slack-startup-auth.test.ts`;
- `tests/integration/as1-slack-inbound.test.ts`;
- `tests/integration/as1-slack-thread-correlation.test.ts`;
- `tests/integration/as1-slack-exact-transport.test.ts`;
- `tests/integration/as1-slack-evidence-ingress.test.ts`;
- `tests/integration/as1-slack-outbound.test.ts`;
- `tests/recovery/as1-slack-recovery.test.ts`;
- `tests/operations/as1-slack-lifecycle.test.ts`;
- synthetic fixtures containing placeholder IDs/tokens only.

## 18. Worker WorkUnits and dependency order

| WorkUnit | Scope | Depends on | Completion evidence |
|---|---|---|---|
| `AS1-WU-01` | closed profiles, contracts, strict parsers, redaction primitives | design PASS | contract/security tests |
| `AS1-WU-02` | profile state roots, receipt/dedupe/root/question stores | WU-01 | corruption, atomicity, replay tests |
| `AS1-WU-03` | narrow Socket/Web clients and startup pair verification | WU-01 | all swap/wrong-workspace fakes fail closed |
| `AS1-WU-04` | persist-before-ACK and inbound classifier/thread correlation | WU-02, WU-03 | ordering/retry/rejection tests |
| `AS1-WU-05` | AS1 exact activation, lease, capability, and tmux journal | WU-01, WU-02 | single-use and ambiguity tests |
| `AS1-WU-06` | ACK/intake/outbound/result evidence ingress | WU-02, WU-05 | ancestry/rewrite/profile tests |
| `AS1-WU-07` | rendered outbox and no-blind-resend Web API adapter | WU-02, WU-03, WU-06 | retry/ambiguity/thread tests |
| `AS1-WU-08` | global/profile control, startup replay, shutdown, rollback | WU-04, WU-05, WU-07 | latch/restart/shutdown tests |
| `AS1-WU-09` | default-disabled composition, CLI, dependency/lock changes | WU-08 | synthetic composition and redacted CLI tests |
| `AS1-WU-10` | compatibility, focused regression, evidence package | WU-09 | v2 + AS1 checks and exact diff evidence |

Target elapsed time is 8-12 hours with a 16-hour hard stop. At the hard stop the
Worker returns bounded evidence; it does not cut security scope, activate a
client, or continue without a new Advisor decision.

## 19. Required Worker checks

The exact Worker handoff should include:

1. exact-key secret parser positives/negatives, modes, no-follow, swap, race,
   size, UTF-8, duplicate/unknown key, and redaction tests;
2. compile-time and runtime proof that only two profile literals exist;
3. all bot/app-token swap combinations and wrong workspace/App/hello failures;
4. receipt persistence failure sends no Socket ACK;
5. persisted retry ACKs without a second intake;
6. top-level and thread classification plus every rejection row in section 9;
7. root/question single-consumption under concurrency and restart;
8. lease/capability one-use, two preflights, target mismatch, consumed replay,
   and every journal crash boundary for each profile;
9. evidence wrong-profile, historical Foundation identity, rewrite, removal,
   dirty, ancestry, ordering, and final-result cases;
10. outbound exact request, redaction, same-thread binding, explicit safe retry,
    ambiguous response, and bot echo rejection;
11. global kill, profile isolation, corruption, lock, SIGTERM, bounded drain,
    restart, and rollback tests;
12. existing `organization-registry`, `advisor-inbox`, and
    `exact-advisor-delivery` focused tests unchanged and passing;
13. typecheck, changed-file lint, dependency audit, secret scan, and `git
    diff --check`;
14. no Living Office, broad browser E2E, VibeNews, live Slack, real token, real
    tmux input, or unrelated suite.

All Slack calls use fakes in Phase A. Tests must make an attempted real network
or tmux mutation fail immediately.

## 20. Completion criteria

Phase A is complete only when independent review can verify all of the
following directly:

- exactly two fixed profiles and no generic target path;
- strict external secret parsing and fully redacted errors/status;
- exact bot workspace/App and app-token App verification, including swaps;
- durable receipt and dedupe before Socket ACK;
- one top-level event produces at most one pre-Mission `NEW_MISSION` intake;
- thread replies are root/question bound and cannot create a second Mission;
- all forbidden message/surface/identity cases fail closed;
- existing Exact Delivery v2 remains byte-compatible and behavior-compatible;
- activation, consumption, journal, ingress, dedupe, and latch are physically
  separate per profile;
- Foundation uses its fresh roleInstanceId and no Agent Office historical
  evidence;
- ACK/intake/question/result evidence is exact, immutable, ordered, and
  profile-bound;
- outbound replies are redacted, same-thread, durable, and never blindly resent;
- restart replay, bounded retry, global kill, profile isolation, clean shutdown,
  and rollback are proven synthetically;
- default configuration cannot connect to Slack or issue usable authority;
- no secret, live Slack access, real tmux input, DB, public ingress, Worker or
  Reviewer dispatch, risk acceptance, or final approval occurred.

## 21. Owner-only unresolved values and limits

These remain deliberately unset:

- workspace ID;
- both App IDs;
- both immutable private channel IDs;
- both bot tokens and both app-level tokens;
- final reviewed Slack SDK package versions;
- exact live pilot activation refs, fresh destination locators, and one-use
  readiness leases;
- exact state root and authority snapshot hashes selected by the later
  implementation/pilot handoff.

The approved Leo user ID is the only populated external ID in the Setup Pack.
No design artifact contains a real token or any other live Slack value.

Known platform limitation: a successful Web API response can be lost after
Slack accepts a message. AS1 therefore chooses manual reconciliation over blind
retry. This may delay a reply but prevents an unbounded duplicate.

## 22. Protocol references

The design pins behavior to official Slack documentation inspected for this
package:

- [Socket Mode setup, `hello`, envelope, and ACK](https://docs.slack.dev/apis/events-api/using-socket-mode/)
- [`connections:write`](https://docs.slack.dev/reference/scopes/connections.write/)
- [`auth.test`](https://docs.slack.dev/reference/methods/auth.test)
- [`bots.info`](https://docs.slack.dev/reference/methods/bots.info/)
- [`message.groups`](https://docs.slack.dev/reference/events/message.groups)
- [`chat.postMessage`](https://docs.slack.dev/reference/methods/chat.postmessage)
- [App manifest reference](https://docs.slack.dev/reference/app-manifest/)

SDK behavior is not authority when it conflicts with these explicit contracts.
Implementation and independent review remain separate. Final mission approval
and risk acceptance remain with Leo/GPT.
