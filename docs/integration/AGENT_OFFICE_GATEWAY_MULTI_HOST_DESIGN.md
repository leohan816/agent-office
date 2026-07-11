# Agent Office Gateway and Multi-Host Design

Status: `LOCALBOOTSTRAP_PRIVATE_RUN_PASS__EXACT_ADVISOR_DELIVERY_DESIGN_CANDIDATE__REAL_TRANSPORT_STILL_INACTIVE`

This reviewed design defines typed integration ports, the M01 Advisor gateway,
read-only observations, multi-project topology, and designed-but-gated remote host
support. Batch B implements only the local read-only observation, trusted registry,
and freshness subset at code commit
`85e66d856e33a0df73041cb4b33aba30a8f9f96d`. It does not authorize or implement
a network connection, tmux input, Tailscale action, key provisioning, remote
collector, or external exposure.
Advisor accepted the Batch B local observation boundary as the Batch C
dependency. Batch C code commit
`e30a6cda52e14a4bf30b2d1b7445fa26645496e5` adds a pure scene consumer over
typed projection fixtures only; it does not call these ports, observe a process,
connect to a host, or add any gateway/mutation method.

Advisor accepted Batch C as the Batch D dependency. Batch D code commit
`7366036f8a1e6fc9d4e911e8d193e17eeb95f54c` implements the transport-neutral
contract, fixed logical Advisor-only tmux adapter over an injected inert pointer
delivery port, disabled Hermes stub, durable outbox/receipt application, and
manual fallback. Tests used fakes only; no tmux input, launcher execution,
network, credential, host mutation, or remote capability was used.
AO-D-R1 rework commit `04809004bfd863181f4af8260879f56bc8b6ede6`
closes runtime vocabulary and temporal boundary validation without adding a
transport or authority surface. Advisor accepted Batch D as the Batch E
dependency. Batch E commit `e0a11f69fffc9d35d67cc478cbefbb92d93cf528`
adds the typed loopback HTTP application binding and read-only SSE only. It does
not activate or inspect real tmux, Hermes, remote hosts, keys, Tailscale, or any
external network capability.
Final rework commit `0f90e39d3995ffca97eb7a05ef051d8f9a3719c1`
adds the executable loopback composition, production HTTP projection/SSE browser
client, and immutable decision-authority verification integration. It activates
no external transport, credential, remote host, or provider; delta review and
Advisor acceptance remain pending.

Final rework round 2 commit `10fdee75dca73c4fb5cde09019c403d4dc1682bb`
wires the previously isolated local ports into the executable. An explicit
`agent-office.operational-runtime.v1` document registers projects, roots, Git,
manifest, exact tmux panes, artifacts, actors, WorkUnits, freshness policies, and
the optional Advisor transport capability. Startup requires one Git-VERIFIED
external manifest. The coordinator performs bounded read-only refreshes and
keeps project/host/mission/WorkUnit/evidence identities isolated. Production
injects `TmuxAdvisorGateway`, not Hermes; a delivery port remains a trusted
server-side injection. Real tmux input and real auth remain inactive.

LocalBootstrap private-run gate commit
`2623922877bd52dc7f5b6c6cd45fae755e5ff228` activates only the local production
authentication port, not an external gateway. Trusted v2 configuration binds
exact `127.0.0.1:4317`, creates one verifier-backed owner-only proof, and exposes
a bounded same-origin exchange/logout session lifecycle. Production accepts only
the actual canonical sibling foundation-docs mission source. In this mode the
composition rejects both Advisor transport capability and delivery-port
injection before proof creation/bind; therefore every durable message remains
manual fallback and no tmux input, remote host, key, or network is activated.

## 1. Integration Principles

1. Browser input terminates at Agent Office command schemas; it is never process
   argv, tmux input, a repository path, or a role target.
2. Every adapter has a narrow typed port. No generic `execute`, `send`, `target`,
   `shell`, or arbitrary path method exists.
3. Mission state is imported from structured manifests/events/evidence, never
   inferred from terminal prose.
4. Tmux observation is strictly read-only and separate from Advisor notification
   delivery.
5. TmuxAdvisorGateway is fixed to logical Advisor and can deliver only an
   immutable inbox pointer notification under existing transport authority.
6. HermesAdvisorGateway is a no-side-effect interface stub in M01.
7. Remote hosts emit signed structured observations only; they cannot dispatch
   roles or mutate the controller's canonical ledger directly.
8. Stale, gapped, untrusted, or offline observations cannot satisfy completion.
9. LocalBootstrap authenticates one local browser only; it cannot create or
   activate an Advisor gateway capability, host trust, or remote route.

## 2. Port Catalog

| Port | Direction | Candidate implementation | Mutation boundary |
|---|---|---|---|
| `MissionManifestSource` | external -> Agent Office | Committed foundation-docs manifest reader | Read only; imported bytes/hash become event evidence |
| `GitObservationSource` | repo -> Agent Office | Fixed read-only Git argv adapter | Read only; no add/commit/push/checkout/reset |
| `ArtifactSource` | filesystem -> Agent Office | Allowlisted immutable artifact verifier | Read only outside Agent Office state root |
| `TmuxObservationSource` | tmux -> Agent Office | Structured metadata adapter | Read only; no pane input/config mutation |
| `HostObservationSource` | host -> Agent Office | Local collector first; signed remote envelope later | Observations only |
| `AdvisorGateway` | Agent Office -> Advisor | `TmuxAdvisorGateway` in M01 | Fixed pointer notification only |
| `NotificationSink` | Agent Office -> UI/Advisor | In-app plus Advisor gateway outbox | Typed notifications, idempotent |
| `ClockSource` | platform -> application | System UTC/monotonic pair | No domain ordering authority |
| `HermesAdvisorGateway` | Agent Office -> Hermes | Stub only | Always disabled/not implemented in M01 |
| `DecisionAuthorityEvidenceVerifier` | immutable authority source -> application | Exact registered `ArtifactSource` reference verifier | Read/verify only; no link artifact/event until authority correspondence succeeds |
| `AuthenticationProvider` / `AuthenticationExchange` | owner-only local proof -> Agent Office session | Production `LocalBootstrapAuthenticationProvider` | Exact loopback one-time exchange only; no external identity/network authority |
| `BrowserSessionRegistry` | server auth session -> protected HTTP/SSE | In-memory opaque session registry | Host-only cookie handle, CSRF and fixed capabilities; no browser token storage |

### 2.1 Batch B as-built port boundary

- `MissionManifestSource`, `GitObservationSource`, `ArtifactSource`, and
  `TmuxObservationSource` are exported from
  `src/adapters/observations/ports.ts` with no generic execute/send/target API.
- `LocalGitObservationSource` maps stable source/namespace/commit-pair IDs to
  reviewed read-only argv shapes for top-level, HEAD/upstream, porcelain-v2,
  exact ref namespaces, ancestry, and exact commit diffs.
- Manifest/artifact sources map stable IDs to trusted roots and configured paths,
  then perform bounded regular-file/no-follow/containment/hash/commit/dirty checks.
- `LocalTmuxObservationSource` accepts one configured source ID and reads exactly
  one pane through structured `display-message` fields. It retains tmux activity
  time only as observation metadata; it never projects WorkUnit activity from it.
- `NodeReadonlyToolRunner` uses trusted absolute executables, direct argv with
  `shell: false`, fixed environment/timeout/output limits, and capped redacted
  errors. Tests use a deterministic fake runner.
- A bounded local smoke verified the implemented Git and exact `%13` tmux paths
  without pane capture, tmux input, or repository mutation.
- Batch C `src/ui/scene/` has no import from observation adapters or process
  runners. Its event/provenance, freshness, connection, and evidence fields are
  supplied through `RoleSceneProjection`; stale/conflicted inputs remain visible
  and cannot become fresh or complete through animation.

### 2.2 Batch D as-built gateway boundary

- `src/adapters/gateways/advisor.ts` validates the exact nine-field request,
  canonical pointer envelope, receipt vocabulary, and receipt hash.
- `src/adapters/gateways/tmux-advisor/` accepts one immutable
  `ADVISOR_ONLY` capability snapshot with authority/activation/registry hashes,
  exact active/kill/synchronization vocabulary, issue time, and exclusive expiry.
  It has no role/session/pane, executable, argv, shell, or generic target method.
- Missing, disabled, malformed, future-issued, expired, conflicting, or
  kill-switched capability produces a typed manual receipt without invoking the
  delivery port. Health, new queue, and uncached receipt lookup validate their
  runtime clock; an ambiguous started delivery is looked up and never blindly
  resent.
- `src/adapters/gateways/hermes/` has health/queue/lookup interface parity only;
  it returns disabled/not implemented and stores no endpoint or receipt cache.

### 2.3 LocalBootstrap as-built integration boundary

- Deployment config is a separate owner-controlled no-follow JSON document from
  the operational source registry. Group/other-writable modes reject; `0400` and
  `0600` are accepted.
- The proof delivery path is absolute and separate from both config files. Its
  canonical parent must be an isolated owner-only directory outside application,
  state, static and every observed project root.
- `POST /api/v1/auth/local-bootstrap/exchange` accepts exactly one 43-character
  base64url proof in a bounded JSON body. Exact loopback peer, Host, Origin,
  Fetch Metadata and content type are required before the rate-limited exchange.
- `POST /api/v1/auth/logout` is session/CSRF/rate protected. It revokes provider
  and browser sessions, closes session SSE, and clears the cookie.
- The session has only `viewer` and `leo_input`; it cannot call Advisor
  acknowledgement, intake, decision, alert-operator, delivery-disable, Worker,
  Reviewer, or command routes.
- Production source authority is fixed to the current canonical M01 path under
  the actual sibling foundation-docs root with matching Git source, commit and
  bytes. Fixture fallback and an alternate root fail before a proof exists.
- Fixed port `4317` is compatible with a later separately approved SSH local
  forward using the same local/remote port, but no remote-host or SSH operation
  is authorized by this implementation gate.

### 2.4 Exact Advisor delivery design extension

The separately authorized design candidate is canonical at
[`../architecture/AGENT_OFFICE_EXACT_ADVISOR_DELIVERY_BRIDGE_DESIGN.md`](../architecture/AGENT_OFFICE_EXACT_ADVISOR_DELIVERY_BRIDGE_DESIGN.md).
It does not change the as-built boundary above. It specifies the later reviewed
production integration as:

```text
trusted loopback deployment v3 + operational runtime v2
  -> Git-verified V2/transport/activation/registry/kill/mission snapshots
  -> one-use structured Advisor readiness lease
  -> double live structured preflight for foundation-advisor/$9/0/%9
  -> in-memory notification-bound capability
  -> owner-only pointer artifact + durable no-resend transport journal
  -> exact no-shell tmux buffer/paste/Enter sequence
  -> Git-verified internal Advisor evidence ingress
```

The default and current LocalBootstrap configurations still provide no
capability or port. The production factory must reject caller-injected transport
objects, build the exact port internally only under the two-key selection, and
keep browser `advisor_operator` absent. A tmux receipt remains distinct from ACK;
Advisor evidence enters through exact committed structured blobs, not an HTTP
operator route or chat prose.

## 3. AdvisorGateway Contract

### 3.1 Request

`queueAdvisorNotification` accepts exactly:

```text
notificationId
requestId
missionId
messageId
messageArtifactRef
messageArtifactHash
persistedEventId
persistedMissionSequence
correlationId
```

There is no target role/session/pane, body text, prompt, command, argv, executable,
or arbitrary path. `messageArtifactRef` is an internal typed reference resolved
under the Agent Office state root after hash verification.

### 3.2 Receipt

The gateway returns one immutable receipt:

```text
notificationId
adapter: TMUX_ADVISOR | HERMES_ADVISOR | MANUAL
adapterVersion
status: DELIVERED | ALREADY_DELIVERED | RETRYABLE_FAILURE |
        MANUAL_FALLBACK_REQUIRED | DISABLED
attempt
queuedAt
attemptedAt
transportEvidenceRefs[]
failureCode
receiptHash
```

The same `notificationId` and same request hash returns the original successful
receipt. A changed payload is an idempotency conflict. Delivery does not imply
Advisor acknowledgement, intake, decision, or execution.

### 3.3 State separation

```text
message PERSISTED
  -> notification QUEUED
  -> gateway DELIVERED or MANUAL_FALLBACK_REQUIRED
  -> Advisor ACKNOWLEDGED (separate artifact/event)
  -> Advisor INTAKE_RECORDED (separate artifact/event)
  -> optional DECISION_RECORDED/APPLIED
```

The Batch D direct application receipt confirms only `PERSISTED`. Batch E
`src/server/application.ts` and `src/server/http/server.ts` preserve that exact
boundary: HTTP returns the durable persistence receipt only; delivery,
acknowledgement, intake, decision, resume, and close remain separate typed ports
and evidence. `tests/integration/http-advisor-message.test.ts` proves the same
request returns the original persistence receipt after store/server restart and
changed bytes return 409 without a second event.

Batch E SSE is projection notification only. `src/server/sse/index.ts` carries
revision plus notification IDs, never the message body/pointer artifact/terminal
data. It enforces authentication, two concurrent streams per session, six
attempts/minute, bounded cursor replay/reset, heartbeat validation, and immediate
server-side session revocation. It does not call a gateway or mutation port.

The final composition under `src/runtime/` binds these pieces into one executable
local process. `npm run start:loopback` loads the exact loopback-only descriptor,
requires explicit absolute state and operational-config paths, validates the
state root outside application/static/observed roots, imports one registered
external manifest only after hash/commit/Git verification, opens the event and
artifact application, serves the built
production shell, and closes listeners before releasing the writer lock. The
production `src/ui/runtime/client.ts` fetches public status, then protected
projection/session context, and consumes SSE using cursor/reconnect/reset rules.
It supplies the Advisor message action port only with the `leo_input` capability
and parsed session CSRF token, and removes it on expiry/revocation. The production
composition has no session registry/provider, so protected routes remain
`AUTH_PROVIDER_UNAVAILABLE`; guarded synthetic authentication exists only in the
separate test composition and no proof route exists.

Decision linkage remains a typed Advisor application operation, not a gateway
delivery action. `ArtifactDecisionAuthorityEvidenceVerifier` binds the registered
repository, commit, path, SHA-256, mission, exact message WorkUnit scope, decision,
and named authority before `AdvisorMessageDecisionLinked`. The current contract
contains no approved bounded Advisor routine scope, so that authority variant is
rejected rather than inferred.

## 4. TmuxAdvisorGateway

### 4.1 Fixed purpose

TmuxAdvisorGateway notifies the one logical Advisor inbox that an immutable Agent
Office message is ready. It cannot send to Agent Office Worker, Fable5 Reviewer,
Control, Foundation, Cosmile, SIASIU, a wildcard, or a caller-selected pane.

The dynamic message body is never pasted into tmux. Batch D serializes exactly one
canonical JSON pointer envelope containing only the validated nine request fields.
The adapter passes that envelope plus opaque capability and notification IDs to an
injected `TmuxPointerDeliveryPort`; it does not import a process runner or build a
launcher, target, prompt, command, executable, or argv. The port is an integration
boundary supplied only by prevalidated external transport authority; Batch D tests
use inert fakes and never send real tmux input.

### 4.2 Authority dependency, not duplication

The canonical authority remains:

- canonical role V2 Section 12A;
- `../foundation-docs/advisor/_system/tmux_transport/TRANSPORT_PROTOCOL.md`;
- `ACTIVATION_STATE.md`, `SESSION_REGISTRY.md`,
  `KILL_SWITCH_AND_FALLBACK.md`, and the final activation record.

Agent Office stores references to the verified authority snapshot and returned
transport receipt. It does not define which session is Advisor, declare transport
active, disengage a kill switch, clear a ledger lock, answer a prompt, or route a
follow-up.

An Advisor-owned transport capability/profile must provide a prevalidated opaque
capability ID, fixed `ADVISOR_ONLY` logical route, active/kill/synchronization
state, issue/expiry times, and immutable authority/activation/registry snapshot
hashes. Locator details stay behind the external port and never cross the Agent
Office request schema. Without a valid capability, the gateway returns
`MANUAL_FALLBACK_REQUIRED`. Agent Office cannot synthesize or repair it.

Runtime validation admits only `ACTIVE | DISABLED | CONFLICT`,
`DISENGAGED | ENGAGED`, and
`SINGLE_PREVALIDATED_DESTINATION | CONFLICT` for the state, kill-switch, and
synchronization fields respectively. A non-canonical gateway clock, `now` before
`issuedAt`, or `now` equal to or later than `expiresAt` cannot reach delivery or
receipt lookup.

### 4.3 Required preflight evidence

Before each delivery attempt, the adapter requires a fresh, immutable reference
showing:

- active mode and disengaged kill switch;
- valid final activation record;
- valid immutable authority, activation, and registry snapshot hashes;
- prevalidated single Advisor destination and synchronized state;
- unique notification receipt identity; and
- bounded expiry and external receipt lookup behavior.

Any absent, malformed, stale, or conflicting field produces no tmux write and
routes to manual fallback. The gateway never retries a successful receipt,
switches target, sends Ctrl-C, answers auth/approval, or terminates a process.

### 4.4 Manual fallback

Manual fallback presents Advisor with the exact artifact pointer and hash through
the existing approved manual channel. It does not copy message body into a command
and does not mark delivery/acknowledgement without an Advisor receipt. Re-enable is
explicit after authority revalidation; queued items retain notification IDs.

## 5. HermesAdvisorGateway Stub

M01 defines interface parity only:

| Operation | M01 behavior |
|---|---|
| `health()` | `DISABLED_NOT_IMPLEMENTED` |
| `queueAdvisorNotification(...)` | `DISABLED`, no network/files/process side effect |
| `getDeliveryReceipt(...)` | `undefined`/not implemented |
| `acknowledge(...)` | Unsupported; Advisor acknowledgement remains a domain command |

The stub has no endpoint, credential, discovery, transport, retry loop, mock that
can reach a real service, or automatic fallback selection. A future Hermes mission
must preserve the exact Advisor-only semantics, idempotency, receipts, audit, and
authority boundaries and must receive separate design/implementation reviews.

## 6. Read-Only Local Adapters

### 6.1 MissionManifestSource

Trusted configuration supplies an allowlisted repository root and relative
manifest paths. The adapter:

1. resolves containment and rejects symlink/path escape;
2. reads the file and source Git commit without changing the repo;
3. computes file hash and validates schema/count/dependencies;
4. records source repository/branch/commit/path/hash; and
5. submits a typed import command.

It does not edit foundation-docs, infer scope changes, or accept an uncommitted
manifest as authority unless an exact later handoff explicitly defines that mode.

### 6.2 GitObservationSource

Allowed operations use fixed direct argv templates such as:

- repository top-level verification;
- `rev-parse` for HEAD/upstream;
- `status --porcelain=v2 -z`;
- `for-each-ref` for an exact allowlisted ref namespace;
- `merge-base --is-ancestor`; and
- `diff-tree --name-status` for exact verified commits.

Repository IDs map to trusted absolute roots. Browser/entity input never becomes
cwd, ref syntax, revision expression, option, or pathspec without a typed validated
mapping. Writable Git commands and shell execution do not exist in the adapter.

### 6.3 ArtifactSource

Artifact kinds map to configured roots and schemas. The adapter opens regular
files only, within size bounds, verifies containment, bytes/hash, expected Git
commit when applicable, and extracts only declared metadata. It never follows an
artifact-provided pointer outside an allowlist. A missing, changed, uncommitted, or
stale artifact is explicit evidence state, not completion.

### 6.4 TmuxObservationSource

Allowed observations are structured tmux format fields for session/window/pane
IDs, names, indexes, current path, current command, dead/alive state, activity
time, and synchronization option. Output is parsed as an exact field protocol with
caps/timeouts.

The observation adapter does not expose or invoke `send-keys`, buffer/paste,
`run-shell`, source/config changes, pane/session creation/destruction, or process
signals. Pane capture text is excluded from mission-state derivation. If later
diagnostic capture is approved, it remains redacted untrusted evidence and cannot
drive statuses or animation.

## 7. Multi-Project Topology

### 7.1 Project registry

Agent Office supports multiple read-only project projections through trusted
configuration:

```text
projectId
displayName
authorityOwner
hostId
repoRootId
allowedRepoRelativeRoots[]
allowedArtifactRootIds[]
canonicalManifestSourceId
expectedBranchPolicy
enabledObservationKinds[]
```

The registry contains IDs and root references, not credentials. Browser users may
filter registered projects but cannot add/edit a root, host, branch policy, or
authority owner. Batch B constructs the local registry only from trusted startup
registrations, canonicalizes non-symlink directories, rejects cross-project root
overlap, and exposes path-free project summaries. Browser add/edit and runtime
reload do not exist; future registry mutation still requires audit and a later
handoff.

### 7.2 Controller and collectors

```text
Agent Office controller (Linux, loopback, single writer)
  +-- local Linux observation adapters (M01 implementation target)
  +-- remote Linux collector port (designed, disabled)
  +-- future Mac collector port (designed, disabled)
  +-- browser/PWA clients (loopback; private network separately gated)
```

Collectors are read-only observers. They emit structured envelopes; they do not
accept browser commands, Advisor decisions, work dispatch, Git writes, tmux input,
or event-ledger append access. The controller validates and records observations
through its single writer.

## 8. Host Identity and Trust

### 8.1 Stable identity

A host envelope identifies:

```text
hostId, enrollmentId, platform: LINUX | MACOS,
collectorId, collectorVersion, bootId,
hostSequence, observedAt, monotonicNanos,
observationKind, payload, payloadHash, signature, keyId
```

`hostId` is provisioned and stable across boots. `bootId` changes on collector or
host restart. Hostname/IP is display metadata, never identity.

### 8.2 Trust states

`UNENROLLED -> PENDING_APPROVAL -> TRUSTED`.

`TRUSTED` may become `QUARANTINED` on identity/key/sequence/signature anomalies or
`REVOKED` by operator authority. `QUARANTINED` may return to `PENDING_APPROVAL`,
never directly to trusted. `REVOKED` requires a new enrollment ID to return.

M01 does not generate, read, or provision signing keys. Remote verification is an
interface and fixture-only design until a separate key/secret/private-network gate.

## 9. Clock, Ordering, Offline, and Reconnect

### 9.1 Ordering

- Controller mission sequence is canonical for accepted observations.
- Host sequence is canonical only for gap detection within one boot ID.
- Host `observedAt` is informational/freshness input, never cross-host ordering.
- The controller records `receivedAt` and estimates skew using an authenticated
  handshake plus round-trip sample when remote support is enabled.
- Clock-quality values are `GOOD`, `SKEW_WARNING`, `SKEW_CRITICAL`, `UNKNOWN`, and
  are visible beside source time.

Candidate defaults for review are warning beyond 2 seconds estimated skew and
critical beyond 30 seconds. These thresholds affect freshness/alerts, never
rewrite timestamps or event order.

### 9.2 Freshness

Each observation carries a policy ID. Initial candidate policies:

| Observation | Stale after | Offline/critical after | Completion use |
|---|---:|---:|---|
| local tmux/session metadata | 30 seconds | 90 seconds | Never direct completion evidence |
| host heartbeat | 30 seconds | 90 seconds | Host availability only |
| Git head/status | 5 minutes | 30 minutes | Must be refreshed for completion audit |
| immutable committed artifact | no time-only expiry | stale immediately if hash/commit/source changes | May satisfy evidence while verified |
| transport activation/registry preflight | per delivery attempt | any missing current check | Delivery only |

Staleness is a query overlay plus explicit alert/event where required. It never
silently changes a WorkUnit to completed/failed.

Batch B implements the local pure overlay in
`src/application/hosts/freshness.ts`: `CURRENT`, `STALE`, `OFFLINE`, `UNKNOWN`,
`CONFLICT`, and `ERROR` are deterministic from explicit clock/policy/condition
inputs. Restart snapshots preserve the last value while it ages, and only
`CURRENT` plus `VERIFIED` may satisfy the exported completion predicate. Remote
clock/signature/gap/reconnect collection remains unimplemented.

### 9.3 Offline behavior

When a host misses its policy window, the UI marks last-seen time, host/boot ID,
clock quality, and evidence as stale. Agent Office continues to show last verified
data with a prominent stale label. No remote evidence from that host can newly
satisfy completion; no automatic failover, dispatch, or host substitution occurs.

### 9.4 Reconnect protocol

1. Collector authenticates its enrollment/key and declares hostId/bootId.
2. Controller returns last accepted hostSequence and observation hash.
3. Collector resumes at next sequence or declares a new boot.
4. Duplicate sequence plus same hash returns prior receipt.
5. Duplicate sequence plus different hash quarantines the host.
6. A forward gap emits `HostObservationGapDetected`; later records may be stored
   but remain non-completion evidence until reconciled.
7. New boot resets hostSequence only with explicit `HostReconnected` evidence.
8. Fresh observations clear stale overlays only after trust, signature, sequence,
   and clock checks pass.

No queued remote command is replayed because collectors accept no commands.

## 10. Notification and Alert Integration

NotificationSink consumes the closed `AlertKind` enum and exact `AlertRaised`
payload from Domain Section 7.3 plus typed message events. It cannot define an
adapter-local alert kind, severity, action code, or deduplication rule. The alert
`deduplicationKey` is supplied by the verified domain event; the sink creates
`notificationId` deterministically from that key, the triggering event ID, and
the fixed channel. UI notifications are projection entries. Advisor notifications
enter the gateway outbox. No email, push, webhook, or external channel is enabled
in M01.

Retries are bounded exponential backoff with jitter chosen server-side, maximum
attempts recorded by policy, and idempotent receipt lookup before every retry.
Kill-switch/authority failures do not retry automatically; they immediately become
manual fallback. Recovery after restart scans durable queued receipts, not memory.

## 11. Failure Codes

Stable integration failures include:

- `SOURCE_NOT_ALLOWLISTED`
- `PATH_CONTAINMENT_FAILED`
- `SOURCE_UNCOMMITTED_OR_HASH_MISMATCH`
- `TOOL_NOT_AVAILABLE`
- `TOOL_TIMEOUT_OR_OUTPUT_LIMIT`
- `READ_ONLY_OPERATION_FORBIDDEN`
- `TRANSPORT_INACTIVE`
- `KILL_SWITCH_ENGAGED`
- `ADVISOR_LOCATOR_STALE_OR_MISMATCHED`
- `STATIC_LAUNCHER_UNVERIFIED`
- `DELIVERY_RECEIPT_AMBIGUOUS`
- `HOST_UNTRUSTED_OR_REVOKED`
- `HOST_SIGNATURE_INVALID`
- `HOST_SEQUENCE_GAP_OR_CONFLICT`
- `HOST_CLOCK_CRITICAL`
- `OBSERVATION_STALE`
- `HERMES_NOT_IMPLEMENTED`

Failures are structured, redacted, auditable, and mapped to alert/manual fallback
without exposing tool stderr or raw terminal content to the browser.

## 12. Acceptance and Contract Tests

### Batch B

All listed Batch B cases pass at code commit
`85e66d856e33a0df73041cb4b33aba30a8f9f96d` through
`tests/adapters/`, `tests/integration/project-freshness.test.ts`, and the Batch B
acceptance gate:

- manifest commit/path/hash and denominator validation;
- Git fixed-argv snapshots, hostile refs/pathspecs, timeout/output cap, and proof no
  writable subcommand exists;
- artifact traversal/symlink/special-file/hash/staleness cases;
- tmux structured parsing with hostile names and proof observation is read-only;
- multi-project root isolation and stale-evidence projection; and
- local offline/restart observation behavior.

### Batch D

All listed local Batch D cases pass at
`7366036f8a1e6fc9d4e911e8d193e17eeb95f54c` through the gateway, inbox,
alert, recovery, audit, UI, and acceptance tests:

- same notification ID/same hash returns one receipt; different hash conflicts;
- exact canonical pointer-envelope bytes and fixed `ADVISOR_ONLY` capability
  validation;
- inactive transport, engaged kill switch, stale registry, synchronized panes,
  ambiguous receipt, timeout, and restart all fail to manual fallback;
- message text cannot appear in the pointer envelope or any process input;
- no Worker/Reviewer/session/command field crosses the gateway port;
- successful delivery remains distinct from Advisor acknowledgement/intake; and
- every canonical `AlertKind` preserves the domain dedup key/action codes through
  UI and Advisor notification, while an unknown/adapter-invented kind is rejected;
- repeated alert occurrences with one open dedup key do not create duplicate
  outbound notifications for the same triggering event; and
- Hermes stub produces no network, file, process, or ledger side effect except a
  typed disabled receipt when invoked through the application.

### Final rework

At `0f90e39d3995ffca97eb7a05ef051d8f9a3719c1`,
`tests/integration/runtime-composition.test.ts` passes 4/4 and
`tests/integration/decision-authority-evidence.test.ts` passes 5/5:

- production composition serves the built shell on loopback, reports
  `AUTH_BLOCKED`/mutation-disabled, denies protected projection/message access,
  exposes no generic dispatch route, and releases both listener and writer lock;
- the guarded synthetic composition drives the production runtime client through
  protected projection, SSE, and one idempotent durable Advisor message;
- session revocation/expiry closes SSE and removes the mutation action port;
- explicit `test-demo` is the only synthetic UI selection; and
- immutable verified Leo/GPT evidence is accepted and persisted, while Advisor
  routine, claimed-role, mission, scope, hash, missing, mutable, unreadable, and
  stale cases reject without a decision-link event or artifact.

### Final rework round 2

At `10fdee75dca73c4fb5cde09019c403d4dc1682bb`, composition passes
10/10 and the new coordinator passes 16/16:

- explicit external manifest startup succeeds only with exact verified authority;
- missing/unverified/stale/hash-mismatched/out-of-scope authority fails startup;
- all eight stations and all 15 WorkUnits have exact isolated registrations;
- current/stale/offline/missing/identity-mismatch/dirty/unverified/restart and
  partial actor failure remain structured and fail closed;
- periodic semantic observation changes produce monotonic projection SSE without
  appending a mission event;
- production composes `TmuxAdvisorGateway` only; absent capability/port, kill,
  and ambiguity become manual fallback;
- the deterministic approved test port receives one canonical Advisor pointer,
  never message text, and the full ack/intake/authority/resume lifecycle completes
  without duplicate execution; and
- no real tmux input, provider, credential, remote host, or network is used.

### LocalBootstrap gate

At `2623922877bd52dc7f5b6c6cd45fae755e5ff228`, focused provider/HTTP/config/
composition coverage and the complete 55-file/255-test regression prove:

- high-entropy verifier-only proof delivery, exact owner/mode/no-follow/bounded
  file rules, single use, replay/expiry/restart rejection, and cleanup;
- exact loopback Host/Origin/Fetch Metadata/content-type/body/rate controls with
  response/URL/audit/state/static/committed-file non-disclosure;
- cookie/session rotation, CSRF, logout, expiry/revocation and SSE close;
- actual current canonical manifest projection with fixture/alternate-root
  rejection before proof/bind;
- durable `leo_input` message persistence with manual gateway fallback and
  rejection of capability or delivery-port injection; and
- 18 demo/PWA plus 3 composed browser tests with no proof in browser storage,
  cache, URL or request URL. No real credential, tmux input, or remote network is
  used.

### Deferred multi-host tests

Use synthetic keys and loopback fixtures only: enrollment, revoked/quarantined
identity, signature failure, skew, duplicate/gap, offline, new boot, reconnect,
Linux/Mac schema parity, and stale evidence. Real hosts/network credentials remain
gated.

## 13. Local Traceability

| DESIGN_REQUIREMENT | IMPLEMENTATION_PATH | TEST_PATH | CURRENT_EVIDENCE | STATUS | DEFERRED_GATE |
|---|---|---|---|---|---|
| AO-INT-001 TmuxAdvisorGateway fixed Advisor-only pointer delivery | `src/runtime/composition.ts`, `src/runtime/composition-core.ts`, `src/adapters/gateways/tmux-advisor/` | `tests/integration/runtime-composition.test.ts`, `tests/integration/tmux-advisor-gateway.test.ts` | Existing synthetic gateway lifecycle remains; production LocalBootstrap explicitly rejects a capability or delivery port and always reports manual fallback, so local login cannot activate tmux | `IMPLEMENTED_LOCAL_BOOTSTRAP_GATE__PENDING_FABLE5_AND_ADVISOR` | Any real capability/delivery requires separate authority and is unused |
| AO-INT-002 Hermes interface/stub only | `src/adapters/gateways/hermes/`, `src/runtime/composition.ts` | `tests/adapters/hermes-disabled.test.ts`, `tests/integration/runtime-composition.test.ts` | Disabled stub remains contract-compatible but is not imported or instantiated by either production or synthetic M01 composition | `IMPLEMENTED_DISABLED_STUB_NOT_COMPOSED__PENDING_DELTA_REVIEW` | Separate Leo/GPT Hermes mission |
| AO-INT-003 Read-only manifest/Git/artifact/tmux adapters | `src/runtime/operational-config.ts`, `src/runtime/observation-coordinator.ts`, `src/adapters/observations/` | `tests/integration/observation-coordinator.test.ts`, `tests/adapters/git-readonly.test.ts`, `tests/adapters/artifact-manifest.test.ts`, `tests/adapters/tmux-readonly.test.ts` | Existing bounded ports are operationally composed from exact config; external manifest, refresh, stale/offline/error/conflict, restart, partial failure, and no-mutation cases pass | `IMPLEMENTED_FINAL_REWORK_ROUND2__PENDING_DELTA_REVIEW` | Remote adapters remain gated |
| AO-INT-004 Multi-project registry/root isolation | `src/application/projects/registry.ts`, `src/runtime/observation-coordinator.ts` | `tests/integration/project-freshness.test.ts`, `tests/integration/observation-coordinator.test.ts` | Cross-project roots remain disjoint and runtime additionally validates project/host/source/station/WorkUnit/artifact correspondence with exact complete assignments | `IMPLEMENTED_FINAL_REWORK_ROUND2__PENDING_DELTA_REVIEW` | Browser registry mutation and remote enrollment remain absent |
| AO-INT-005 Linux/Mac multi-host trust and observation envelope | `src/adapters/hosts/` | `tests/contract/host-observation.test.ts` | `NOT_IMPLEMENTED`; Sections 7-9 | `DEFERRED_WITH_GATE` | Private-network, key, remote-host mission |
| AO-INT-006 Offline/reconnect/gap/stale evidence | `src/runtime/observation-coordinator.ts`, `src/application/hosts/freshness.ts`, `src/runtime/composition-core.ts`, `src/ui/scene/state-machine.ts` | `tests/integration/observation-coordinator.test.ts`, `tests/integration/runtime-composition.test.ts`, `tests/integration/project-freshness.test.ts` | Bounded periodic local refresh uses existing policies; semantic changes publish SSE and active activity requires accepted events plus CURRENT sources; stale/offline/restart/partial failure pass | `IMPLEMENTED_FINAL_REWORK_ROUND2_LOCAL_SUBSET__PENDING_DELTA_REVIEW` | Remote envelope/gap/reconnect remains gated |
| AO-INT-007 Canonical AlertKind notification, deterministic deduplication, manual fallback, and decision authority port | `src/application/alerts/`, `src/application/advisor-inbox/`, `src/adapters/observations/artifacts/decision-authority.ts`, `src/server/application.ts`, `src/ui/communication/` | `tests/integration/alert-application.test.ts`, `tests/integration/decision-authority-evidence.test.ts`, `tests/recovery/advisor-message-crash-consistency.test.ts`, `tests/security/http-boundary.test.ts` | Accepted alert/manual behavior remains; decision linkage now requires exact immutable registered authority correspondence and preserves the named role separately from the Advisor link actor; the unapproved Advisor routine variant fails closed | `IMPLEMENTED_FINAL_REWORK__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Real gateway delivery/re-enable and bounded Advisor routine authority remain externally gated |
| AO-INT-008 Executable closed HTTP persistence, projection, and SSE | `src/runtime/`, `src/ui/runtime/`, `src/server/application.ts`, `src/server/http/`, `src/server/sse/` | `tests/integration/runtime-composition.test.ts`, `tests/integration/observation-coordinator.test.ts`, `tests/e2e-composed/application-office-scene.spec.ts`, `scripts/runtime-smoke.mjs` | Default no-provider remains fail-closed; trusted LocalBootstrap composes production login/projection/message/logout/SSE over actual canonical manifest while delivery stays manual. Gate passes 55/255 and 21/21 | `IMPLEMENTED_LOCAL_BOOTSTRAP_GATE__PENDING_FABLE5_AND_ADVISOR` | Real credential/private run and remote fanout remain gated |
| AO-INT-009 LocalBootstrap proof/session integration | `src/server/auth/local-bootstrap.ts`, `src/server/http/server.ts`, `src/server/config.ts`, `src/runtime/composition.ts`, `src/ui/runtime/` | `tests/security/local-bootstrap-provider.test.ts`, `tests/security/local-bootstrap-http.test.ts`, `tests/security/private-network-disabled.test.ts`, `tests/integration/runtime-composition.test.ts` | Exact port 4317, verifier-only owner-file proof, bounded exchange, host-only session, logout/revocation and actual-manifest/no-delivery composition pass with no secret disclosure | `IMPLEMENTED_LOCAL_BOOTSTRAP_GATE__PENDING_FABLE5_AND_ADVISOR` | Real proof and private-run evidence require Fable5 PASS plus Advisor authority |
| AO-INT-010 Exact Advisor delivery bridge | planned trusted config/composition, `src/adapters/gateways/tmux-advisor/`, durable delivery control, and internal Advisor evidence ingress | planned gateway/runtime/inbox/crash/security/E2E suites plus Advisor actual rehearsal | DQ-01 through DQ-08, exact argv, crash matrix, fixed destination, Git trust, and nine criteria are frozen in the canonical candidate; no source/config/test/capability/port/input exists | `DESIGNED_EXACT_ADVISOR_DELIVERY_CANDIDATE__PENDING_FABLE5` | AO-WU-18 design PASS before implementation; refreshed exact window-ID registry evidence required before activation |

Cross-document traceability is indexed in `docs/FEATURE_INDEX.md`.
