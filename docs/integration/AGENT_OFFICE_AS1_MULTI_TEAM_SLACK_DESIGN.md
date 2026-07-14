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
configuration. Only after an exact post-intake pointer-delivery grant exists,
each pointer attempt requires a fresh exact lease that records and binds the
then-current session ID, window ID/index, pane ID/index, pane PID, window name,
workspace, current command, synchronized-panes state, activity time,
observation time, and registry/authority hashes. No lease exists at pre-event
receive time. Any mismatch fails closed. Slack content can never supply or
override a locator.

The only external values admitted into a profile are the exact ten keys in
`config/slack/as1-slack-pilot.env.example`. The parser assigns each value to its
already-selected union member; it never builds a route from text.

## 4. Service topology

```text
owner-only exact-key secret file
        +
committed/pushed expiring pilot receive grant
        |
        v
strict data parser + grant/startup identity verifier
        |
        v
AS1 Slack Gateway (one process, global kill switch)
        |
        +-- selected Agent Office client slot -- profile-local durable state
        |
        +-- selected Foundation client slot ---- profile-local durable state
                 |
                 v
persisted Socket envelope + atomic one-root grant binding
                 |
                 v
transport ACK -> async intake/pointer materialization
                 |
                 v
immutable NEW_MISSION / thread-continuation intake
                 |
                 v
committed/pushed post-intake pointer-delivery grant
                 |
                 v
fresh profile lease + in-memory capability + one exact tmux pointer
                 |
                 v
responsible Advisor -> committed structured evidence
                 |
                 v
profile evidence ingress -> durable Slack outbox -> exact thread reply
```

There is one lifecycle owner and one global kill switch, but no shared mutable
profile data. Client, token references, receipt artifacts, dedupe indexes,
intakes, root correlations, pending questions, receive-grant binding,
pointer-delivery-grant/lease/capability consumption, tmux journal, evidence
checkpoint, outbound journal, and failure latch are profile-local.

The service has two statically constructed client slots. A fresh pilot
receive grant selects exactly one slot for a bounded live receive window. The
second real pilot uses a different receive grant after the first is cleanly
stopped and reconciled. No command-line or Slack-supplied profile selector
exists; the reviewed receive grant names one literal `profileId`. A receive
grant authorizes no tmux destination or pointer delivery.

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

No profile authenticates or opens Socket Mode on token shape alone. For the
receive-granted profile, startup executes this exact sequence with bounded
time/output and redacted errors:

1. Load exactly one Advisor-created `As1PilotReceiveGrantV1`; require its exact
   Git blob/path/commit/hash to be committed, pushed, clean, upstream-ancestral,
   unexpired, and byte-stable. Validate its one literal profile, pilot,
   workspace/App/channel/Leo identity, governance/registry snapshots,
   profile-local state root, one-root limit, and clean kill/latch snapshots.
   Reject any event, root, intake, pointer, destination, lease, or capability
   field. The gateway cannot create or complete this grant.
2. Parse both profile records and require different App IDs, channel IDs, bot
   tokens, and app tokens. Require the same configured workspace and the exact
   approved Leo user ID.
3. Call `auth.test` with the selected profile's bot token. Require `ok: true`,
   exact configured workspace ID, bounded bot user ID, and bounded bot ID.
4. Call `bots.info` with that bot token and the returned bot ID. Require
   `ok: true`, the same bot ID/user ID, `deleted: false`, and `bot.app_id` equal
   to the selected profile's configured App ID.
5. Call `apps.connections.open` with the selected profile's app-level token and
   connect the returned ephemeral WebSocket URL without logging it.
6. Require the first bounded Socket message to be `hello` and require
   `connection_info.app_id` to equal the selected profile's configured App ID.
7. Mark the client `AUTHENTICATED_QUARANTINE`; it still cannot accept a message
   until the receive grant, its profile-local unbound-or-consistently-bound
   state, global control, state store, and registry lineage all validate. Tmux
   destination authority is intentionally absent at this stage.
8. On every Events API callback, additionally require `team_id`,
   `api_app_id`, and bot authorization identity to agree with the startup facts
   before the event can enter the pre-ACK eligibility decision.

Swapped bot tokens fail step 4. Swapped app tokens fail step 6. A token from a
different workspace fails step 3 or event validation. Any credential or identity
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
    receive-grant-state.json
    pointer-delivery-grant-consumption.json
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
    receive-grant-bindings/<receiveGrantId>/<sha256>.json
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

For every envelope, the gateway first performs the bounded outer parse. If it
cannot safely recover a usable `envelope_id`, it cannot ACK. For a usable
`envelope_id`, the required order is:

1. validate the outer shape, selected client/profile binding, global control,
   and receive-grant state without extending the grant expiry;
2. validate the bounded callback/message identity and surface sufficiently to
   decide one terminal pre-ACK class: eligible first root, eligible correlated
   continuation, exact duplicate, or a stable rejection reason;
3. canonicalize the raw received object without token material and derive
   `envelopeHash` plus Events API `eventIdentity`;
4. write the immutable owner-only envelope artifact;
5. atomically insert/check both profile-local dedupe identities;
6. for the first eligible top-level Leo event only, compare-and-append the
   receive-grant state from `UNBOUND` to `ROOT_BOUND`, binding exactly its
   observed `sourceEventId`, `rootTs`, receipt/message hashes, and root key and
   consuming the sole root slot; this durable transition happens before ACK;
7. for an eligible continuation only, require that same bound root and
   atomically consume exactly one compatible open Advisor question before ACK;
8. durably record `RECEIPT_PERSISTED` plus the terminal pre-ACK class and the
   receive-grant/question state hash, if any;
9. only then send `{ "envelope_id": <exact received ID> }` on the same client;
10. record `TRANSPORT_ACK_RECORDED`;
11. schedule asynchronous materialization only for the already-bound root or
    already-consumed continuation. That stage creates the immutable intake and
    pointer; it cannot bind another root or mint authority.

If any required persistence or compare-and-append through step 8 fails, send no
ACK so Slack may retry. If the ACK write is ambiguous, retain the durable
receipt, dedupe, root binding/question consumption, and rely on those records
when Slack retries; do not create a second intake, bind a second root, or
consume a second question. A replay with the same identity and bytes is ACKed
again after verifying the complete durable state. The same identity with
different bytes quarantines the profile.

A syntactically valid but ineligible envelope is durably recorded with its
stable rejection reason and may then be transport-ACKed; it never changes the
receive-grant root slot, creates an intake/pointer, or creates delivery
authority. An authenticated-profile identity contradiction also latches the
profile after durable audit. Rejected input never mints a grant.

This Socket ACK means only that the gateway durably received the envelope. It
is not an Advisor ACK, intake decision, Mission creation, dispatch, or result.

### 8.3 Dedupe identities

Both keys are required:

```text
(profileId, envelope_id)
(profileId, team_id, api_app_id, event_id)
```

The record also binds raw hash, inner-event hash, first/last received time,
retry attempt/reason, pre-ACK class, receive-grant state hash, intake ID if later
materialized, and terminal reason code. Neither profile can see, collide with,
or satisfy the other's key.

The dedupe/index phase is exact:

```text
PREACK_PENDING -> PREACK_ROOT_BOUND | PREACK_CONTINUATION_CONSUMED |
                  PREACK_REJECTED
               -> TRANSPORT_ACK_RECORDED
               -> MATERIALIZED | TERMINAL_NO_INTAKE
```

A crash after receipt/dedupe but before root binding, question consumption, or
terminal rejection leaves `PREACK_PENDING`. Startup revalidates the same bytes
and state and completes exactly one missing pre-ACK transition before reopening
the Socket; it does not materialize or invent an ACK. If the receive grant has
expired before that missing transition, the pending event becomes a durable
expiry rejection, not a late root binding. A later identical Slack retry may be
ACKed from the completed state. Any contradictory partial state latches.

## 9. Inbound policy matrix

The pre-ACK eligibility decision and later asynchronous materialization use the
same exact policy function and require all common facts:

- selected fixed profile has one valid, unexpired receive grant and is not
  killed or latched;
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
| Leo message with no `thread_ts` while receive grant is `UNBOUND` | `NEW_MISSION_ROOT_CANDIDATE` | persist and atomically bind the grant's sole root slot before ACK; later materialize one immutable pre-Mission intake |
| Leo message with no `thread_ts` after root binding | `REJECTED_ROOT_SLOT_CONSUMED` | durable rejection and transport ACK only; no second intake/root |
| Leo reply whose `thread_ts` equals a known root and exactly one compatible question is pending | question's fixed response kind | one `CLARIFICATION` or `DECISION_RESPONSE` continuation |
| replay/retry with identical identities and bytes | `DUPLICATE` | no new intake; ACK transport receipt only |
| `message_changed`, `message_deleted`, any subtype, or `hidden: true` | `REJECTED_MUTATION_OR_SUBTYPE` | minimal durable audit, no intake |
| bot/app/echoed outbound message | `REJECTED_NON_LEO_OR_BOT` | minimal durable audit, no intake |
| wrong workspace/app/channel/user or shared channel | `REJECTED_IDENTITY` | minimal durable audit and profile latch on authenticated-profile contradiction |
| DM, MPIM, public channel, App Home, interactive, command, or unknown envelope type | `REJECTED_SURFACE` | minimal durable audit, no intake |
| thread reply with no root, wrong root, no pending question, or already-consumed question | `REJECTED_THREAD_CORRELATION` | minimal durable audit, no intake |
| any otherwise eligible input at or after receive-grant expiry | `REJECTED_RECEIVE_GRANT_EXPIRED` | no root/question transition or intake; drain/close per lifecycle |
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

Before ACK, one immutable receive-grant binding artifact binds that key to one
`receiveGrantId`, binding-state hash, `eventId`, receipt hash, and
message-artifact hash; it contains no future `intakeId`. After ACK,
materialization may create exactly one immutable root-correlation record that
adds one `intakeId` while referencing the unchanged binding artifact. The
root's `ts` must equal the event's `ts`; a top-level event carrying `thread_ts`
is not a root. The only source for root correlation is the durable
`UNBOUND -> ROOT_BOUND` receive-grant transition before Socket ACK.

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
  receiveGrantId
  receiveGrantBindingHash
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

Asynchronous materialization runs only from a durable bound-root or
question-consumption record. It generates the exact `intakeId`, immutable
pointer artifact, and pointer hash once. Those facts remain intake evidence,
not delivery authority: the gateway must wait for a separate Advisor-created
`As1PointerDeliveryGrantV1` before it may request a readiness lease or create a
capability.

## 12. Two-stage exact authority and Advisor pointer transport

AS1 adds a separate exact transport implementation. It may reuse low-level
atomic-file and hashing primitives, but it must not relax, overload, or branch
inside Exact Delivery v2 schemas or state. AS1 has no undifferentiated
`activation` contract: permission to receive one bounded conversation and
permission to deliver one already-created pointer are different authority
artifacts with different identities, fields, state, and expiries.

### 12.1 Pre-event pilot receive grant

Before `apps.connections.open`, the responsible Advisor supplies exactly one
committed and pushed authority artifact:

```text
As1PilotReceiveGrantV1
  schemaVersion: agent-office.as1-pilot-receive-grant.v1
  receiveGrantId
  pilotId
  profileId: AGENT_OFFICE_ADVISOR | FOUNDATION_ADVISOR
  workspaceId
  appId
  channelId
  leoUserId
  profileStateRootRef
  profileStateRootHash
  rootLimit: 1
  conversationLimit: 1
  governanceSnapshotHash
  registrySnapshotHash
  ownerSetupGateHash
  implementationReviewGateHash
  globalControlSnapshotHash
  profileLatchSnapshotHash
  authorityRepositoryId
  authorityRootId
  authoritySourceCommit
  issuedAt
  expiresAt
```

The grant names one literal profile and no fallback. Its exact workspace, App,
channel, and Leo IDs must equal the selected static profile and external secret
record. `profileStateRootRef` resolves to exactly that profile's contained
owner-only root and cannot alias the other profile. Expiry is exclusive, is
checked before connection and every receive decision, and is never extended by
a retry, reconnect, restart, root binding, or thread reply.

The receive-grant schema rejects every field or wildcard for a future
`sourceEventId`, envelope/event ID, `rootTs`, `intakeId`, message/pointer ref or
hash, tmux session/pane/destination, readiness lease, capability, delivery
grant, or evidence path. It authorizes only opening/authenticating the selected
Socket and durably receiving at most one root conversation before expiry. It
does not authorize tmux or outbound Slack side effects.

The grant is created outside the gateway under the Advisor authority chain.
The gateway may validate an exact grant and record its state; it cannot derive,
fill, mint, renew, clone, or select a grant from Slack/config bytes.

### 12.2 Atomic receive-grant state and root binding

The immutable Git grant is never rewritten. Its profile-local mutable state is
an exact, hash-chained compare-and-append record:

```text
As1PilotReceiveGrantStateV1
  schemaVersion: agent-office.as1-pilot-receive-grant-state.v1
  receiveGrantId
  pilotId
  profileId
  phase:
    UNBOUND | ROOT_BOUND | EXPIRED_UNBOUND | EXPIRED_BOUND |
    RETIRED_UNBOUND | RETIRED_BOUND | LATCHED
  rootLimit: 1
  rootSlotConsumed: boolean
  boundSourceEventId: null | exact Slack event ID
  boundRootTs: null | exact Slack root timestamp
  boundRootKeyHash: null | SHA-256
  boundReceiptArtifactRef: null | profile-local immutable ref
  boundReceiptArtifactHash: null | SHA-256
  boundMessageArtifactHash: null | SHA-256
  boundAt: null | UTC
  previousStateHash
  stateHash
  version
```

`UNBOUND -> ROOT_BOUND` is one atomic expected-version transition after the
eligible envelope, message, and dedupe records are durable and before the
Socket ACK write. It stores only the observed event/root facts in the mutable
state and immutable binding artifact; those facts were not and could not be in
the pre-event grant. The compare-and-append loser re-reads durable state and is
classified as duplicate or `REJECTED_ROOT_SLOT_CONSUMED`; it never creates a
second root.

`ROOT_BOUND` permits only replies whose `thread_ts` equals that exact root while
the receive grant remains unexpired and exactly one compatible Advisor question
is open. A reply atomically consumes that question before ACK. It cannot alter
the root slot or create a new root. No rejected event changes receive-grant
state or creates authority.

### 12.3 Receive lifecycle decision table

| Condition | Required durable action before ACK | Later effect |
|---|---|---|
| first eligible exact-identity top-level Leo event while `UNBOUND` and unexpired | receipt + both dedupe keys + atomic `ROOT_BOUND` record | ACK, then materialize exactly one `NEW_MISSION` intake/pointer |
| identical envelope/event retry, including after receive-grant expiry | verify exact receipt, dedupe, and binding bytes from the earlier decision | reproduce transport ACK only; no second binding/intake or expiry extension |
| eligible correlated reply | persist receipt/dedupe and atomically consume the one open question under the bound root | ACK, then materialize one fixed-kind continuation/pointer |
| second top-level event after `ROOT_BOUND` | persist `REJECTED_ROOT_SLOT_CONSUMED` without changing grant state | ACK only; no intake or delivery authority |
| malformed input without a safely parsed envelope ID | no state mutation | no ACK and no authority |
| valid-envelope wrong surface, bot echo, edit/delete, hidden/subtype, deferred query, or uncorrelated reply | persist exact rejection/dedupe; never bind/consume | ACK only after durability; no authority |
| authenticated-profile identity contradiction | persist audit/reason and latch profile | close/refuse; no root or grant creation |
| crash/restart with an unexpired valid grant | revalidate immutable grant and complete state tree before network; keep original expiry | resume `UNBOUND` or `ROOT_BOUND` without a new slot |
| receive-grant expiry before root | atomically record `EXPIRED_UNBOUND` | refuse input and close; no root/intake |
| receive-grant expiry after root | atomically record `EXPIRED_BOUND` | refuse new input and drain already-durable work; do not revoke a separately valid delivery grant |
| provider disconnect | persist profile latch with grant/binding state unchanged | no automatic reconnect or grant renewal |
| ACK write ambiguous | retain receipt/dedupe/binding or question consumption | exact retry may be ACKed; never repeat business state |
| global kill or profile latch | persist killed/latched control before close where possible | no receive, delivery grant acceptance, lease, capability, or side effect |
| other-profile grant, event state, binding, pointer, lease, or evidence ref | never read/write it through the selected profile; persist cross-profile contradiction under global control | global latch; no fallback, copied state, ACK-derived authority, or delivery |
| state corruption or cross-profile ref | profile latch, or global latch for cross-profile/global contradiction | no ACK/authority based on unverifiable state |

A clean process restart is not a new authority. It may resume the same
unexpired receive grant only after exact state replay. A clean stop preserves
the grant phase while process/profile lifecycle becomes stopped. Before a later
sequential pilot, the Advisor-controlled close step records `RETIRED_UNBOUND` or
`RETIRED_BOUND`; that pilot requires a different Advisor-created receive grant.
A retired, expired, or latched grant is never reused.

### 12.4 Post-intake pointer-delivery grant

Only after asynchronous materialization has committed the exact intake and
pointer artifact may the responsible Advisor create and push:

```text
As1PointerDeliveryGrantV1
  schemaVersion: agent-office.as1-pointer-delivery-grant.v1
  pointerDeliveryGrantId
  receiveGrantId
  receiveGrantBindingHash
  pilotId
  profileId
  intakeId
  sourceEventId
  rootCorrelationHash
  pointerArtifactRef
  pointerHash
  advisorTeam
  actorId
  roleInstanceId
  evidencePrefix
  governanceSnapshotHash
  registrySnapshotHash
  globalControlSnapshotHash
  profileLatchSnapshotHash
  authorityRepositoryId
  authorityRootId
  authoritySourceCommit
  issuedAt
  expiresAt
  useLimit: 1
```

This is the only AS1 authority stage permitted to bind `sourceEventId`,
`intakeId`, root correlation, pointer ref/hash, and permission to request one
fresh readiness lease and create one in-memory capability. Every value must
equal the immutable receive binding/intake/pointer artifacts. The grant is an
Advisor-created, committed, pushed, clean, upstream-ancestral, newly added
artifact; the gateway cannot synthesize it from its own output or from Slack.

The delivery grant authorizes neither another receive/root nor a direct tmux
target. It is profile-local, expires exclusively, has permanent one-use
consumption, and has no alternate/fallback profile. A root conversation with
later accepted continuations requires a distinct delivery grant for each exact
pointer attempt.

Grant creation is a separate Advisor authority operation, not an automatic
gateway transition. The Advisor independently reads the immutable
intake/pointer through the fixed profile authority root and commits the exact
grant under its normal controlled Git workflow. Until that artifact appears and
validates, the profile remains `AWAITING_POINTER_DELIVERY_GRANT`; the pointer is
durable but no lease, capability, tmux journal, or delivery attempt exists.
Fixed-prefix polling may observe a grant; it cannot accept a path/ref from
Slack, infer approval from absence/presence alone, or create the grant.

### 12.5 Readiness lease

Under one valid unconsumed pointer-delivery grant, the responsible Advisor
supplies a fresh, committed, pushed, single-use lease:

```text
As1AdvisorReadinessLeaseV1
  schemaVersion
  leaseId
  pointerDeliveryGrantId
  receiveGrantId
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
  authoritySnapshotHash, registrySnapshotHash,
  receiveGrantBindingHash, pointerDeliveryGrantSnapshotHash
  evidenceRefs
```

All identity fields must equal the selected static profile and delivery grant.
Exact live fields must match two bounded structured tmux preflights. The lease
and pointer-delivery grant are consumed and fsynced before the first tmux
mutation. Either consumed record can never be reused, even when the attempt
fails before paste.

### 12.6 Capability and pointer

After static validation and first preflight, the service creates an in-memory
capability bound to receive-grant binding, pointer-delivery grant, lease, pilot,
profile, intake, Slack event, pointer hash, destination fingerprint, authority
hashes, issue time, and exclusive expiry. It is not serialized into config,
Slack, or a browser and it is never accepted from a caller.

Pointer bytes use an exact schema and contain no body or target selector:

```text
As1AdvisorPointerV1
  schemaVersion
  receiveGrantId
  receiveGrantBindingHash
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
never from receive grant, delivery grant, pointer, or Slack bytes.

### 12.7 Journal and ambiguity

Each profile has the phases:

```text
PREPARED -> BUFFER_LOADED -> PASTE_STARTED -> PASTE_CONFIRMED
         -> SUBMIT_STARTED -> TRANSPORT_RECORDED
```

Any interrupted nonterminal journal becomes
`MANUAL_RECONCILIATION_REQUIRED`. Paste or Enter is never repeated after
`PASTE_STARTED`. Buffer cleanup is allowed only when the journal proves paste
did not start and a fresh preflight proves the same destination. Receive-grant
binding, pointer-delivery grant, capability, lease, profile, pointer,
destination, and authority hashes are invariant across the hash chain.

## 13. Advisor evidence source and contracts

AS1 evidence is committed, pushed Git evidence under two non-overlapping
prefixes fixed by the selected pointer-delivery grant, for example:

```text
advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/
  runtime-evidence/agent-office-advisor/<intakeId>/
  runtime-evidence/foundation-advisor/<intakeId>/
```

The exact authority repository, root, Git source, prefix, receive-grant commit,
binding hash, and pointer-delivery-grant commit are reviewed inputs. A Slack
field cannot supply a repository or path. Each new evidence path must have
exactly one Git-addition history, be upstream-ancestral, descend from both grant
snapshot chains, and remain byte-identical after first acceptance. Rewrite,
deletion, dirty state, wrong ancestry, premature stage, or cross-profile
reference quarantines that profile.

### 13.1 Advisor ACK

`agent-office.as1-advisor-ack.v1` binds profile, pilot, receive grant/binding,
pointer-delivery grant, intake, source event, root correlation, pointer ref/hash,
transport journal ref/hash, consumed delivery grant and lease, exact
Actor/roleInstanceId/Team, Advisor acknowledgement ID/time, and evidence refs.
It proves the responsible Advisor read the pointer artifact. It is not the
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

1. validate global control, the exact receive-grant authority ref, and both
   profile state trees;
2. quarantine corruption before network access;
3. complete any exact `PREACK_PENDING` binding, question-consumption, or
   terminal-rejection transition from its immutable bytes and expected state,
   subject to the original receive-grant expiry; do not claim an ACK or start
   materialization from this recovery step;
4. convert interrupted tmux or outbound network phases into manual
   reconciliation as specified above;
5. resume asynchronous materialization only from a durable
   `TRANSPORT_ACK_RECORDED` bound-root or consumed-continuation decision, plus
   definitely-unsent outbox entries; a pre-ACK or ACK-ambiguous record waits
   for exact transport retry and cannot create an intake;
6. preserve receive-grant phase/root binding, pointer-delivery-grant and lease
   consumption, dedupe, root correlations, question consumption, evidence
   checkpoints, and latches;
7. open/reopen a client only when the same receive grant remains unexpired and
   its state is exactly `UNBOUND` or consistently `ROOT_BOUND`; restart never
   changes its expiry or root slot.

### 15.2 Failure isolation

A profile-local state failure, Slack disconnect, rate limit, exact-destination
mismatch, transport ambiguity, evidence defect, or outbound ambiguity latches
that profile. The other profile retains its prior state and may operate only if
it has a separate valid receive grant and the global switch remains disengaged.

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
- `src/adapters/gateways/slack-pilot/exact-authority.ts` — AS1 receive-grant,
  pointer-delivery-grant, readiness-lease, capability, Git authority, and
  consumption validation.
- `src/adapters/gateways/slack-pilot/exact-transport.ts` — separate exact tmux
  journal/runner.
- `src/operations/readiness/as1-slack-control.ts` — global and profile latches,
  lifecycle, lock, and status.
- `src/runtime/as1-slack-pilot/composition.ts` — shared service composition.
- `src/runtime/as1-slack-pilot/cli.ts` — closed lifecycle command parser.

### Proposed configuration/package changes

- one committed, default-disabled, non-secret AS1 runtime descriptor whose live
  receive-grant authority ref remains unset and which cannot represent a
  pointer-delivery grant, lease, or capability;
- one exact `as1:slack-pilot` package script;
- pinned official Slack Socket Mode/Web API packages and lockfile changes only
  after design PASS and package/security review;
- no generic HTTP server, Request URL, browser route, or dynamic method client.

### Proposed focused tests

- `tests/contract/as1-slack-profiles.test.ts`;
- `tests/security/as1-slack-secret-config.test.ts`;
- `tests/integration/as1-slack-startup-auth.test.ts`;
- `tests/security/as1-slack-authority-lifecycle.test.ts`;
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
| `AS1-WU-01` | closed profiles, two-stage grant schemas, strict parsers, redaction primitives | design PASS | receive-grant forbidden-field and delivery-grant required-field contract/security tests |
| `AS1-WU-02` | profile state roots, receive-grant binding, receipt/dedupe/root/question stores | WU-01 | atomic first-root, corruption, expiry, isolation, and replay tests |
| `AS1-WU-03` | narrow Socket/Web clients, receive-grant startup gate, and pair verification | WU-01, WU-02 | no-grant/expired-grant and all swap/wrong-workspace fakes fail closed |
| `AS1-WU-04` | persist/bind-before-ACK, inbound materializer, and thread correlation | WU-02, WU-03 | first-root/retry/second-root/reply ordering and rejection tests |
| `AS1-WU-05` | post-intake pointer-delivery grant, lease, capability, and tmux journal | WU-01, WU-02, WU-04 | exact-after-intake, no-gateway-mint, single-use, and ambiguity tests |
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
4. receive grants accept exactly their bounded pre-event fields and reject every
   event/root/intake/pointer/destination/lease/capability field or wildcard;
5. no receive grant, expired grant, kill/latch mismatch, or gateway-created
   grant can open/arm message acceptance;
6. receipt/dedupe plus atomic first-root binding happen before Socket ACK, and
   any persistence/binding failure sends no ACK;
7. identical retry ACKs without a second binding/intake; correlated reply,
   second root, restart, expiry before/after root, disconnect, ambiguous ACK,
   kill, corruption, and profile-isolation traces match section 12.3;
8. post-intake delivery grants are impossible before exact source event,
   intake, root correlation, pointer ref/hash, and receive-binding hash exist;
9. top-level/thread classification and root/question single-consumption plus
   every rejection row in section 9 under concurrency and restart;
10. delivery-grant/lease/capability one-use, two preflights, target mismatch,
   consumed replay, and every journal crash boundary for each profile;
11. evidence wrong-profile, historical Foundation identity, rewrite, removal,
   dirty, ancestry, ordering, and final-result cases;
12. outbound exact request, redaction, same-thread binding, explicit safe retry,
    ambiguous response, and bot echo rejection;
13. global kill, profile isolation, corruption, lock, SIGTERM, bounded drain,
    restart, and rollback tests;
14. existing `organization-registry`, `advisor-inbox`, and
    `exact-advisor-delivery` focused tests unchanged and passing;
15. typecheck, changed-file lint, dependency audit, secret scan, and `git
    diff --check`;
16. no Living Office, broad browser E2E, VibeNews, live Slack, real token, real
    tmux input, or unrelated suite.

All Slack calls use fakes in Phase A. Tests must make an attempted real network
or tmux mutation fail immediately.

## 20. Completion criteria

Phase A is complete only when independent review can verify all of the
following directly:

- exactly two fixed profiles and no generic target path;
- strict external secret parsing and fully redacted errors/status;
- exact bot workspace/App and app-token App verification, including swaps;
- an Advisor-created committed/pushed expiring receive grant is required before
  connection, contains no future event/intake/pointer/destination authority,
  and is bounded to one literal profile/root conversation;
- durable receipt/dedupe and atomic first-root receive-grant binding happen
  before Socket ACK;
- retry, second root, restart, expiry, disconnect, kill, corruption, and
  profile-isolation behavior preserves one root and at-most-one intake;
- a separate Advisor-created post-intake pointer-delivery grant binds the exact
  source event, intake, root, pointer, and receive binding before it can
  authorize one fresh lease/capability/pointer attempt;
- thread replies are root/question bound and cannot create a second Mission;
- all forbidden message/surface/identity cases fail closed;
- existing Exact Delivery v2 remains byte-compatible and behavior-compatible;
- receive-grant binding, pointer-delivery-grant/lease/capability consumption,
  journal, ingress, dedupe, and latch are physically separate per profile;
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
- exact live pilot receive-grant refs, post-intake pointer-delivery grants,
  fresh destination locators, and one-use readiness leases;
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
