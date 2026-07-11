# Agent Office Gateway and Multi-Host Design

Status: `REVIEWED_DESIGN__BATCH_B_C_ACCEPTED__BATCH_D_LOCAL_GATEWAYS_IMPLEMENTED__REMOTE_GATED`

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
  active/kill/synchronization state, and expiry. It has no role/session/pane,
  executable, argv, shell, or generic target method.
- Missing, disabled, stale, conflicting, or kill-switched capability produces a
  typed manual receipt without invoking the delivery port. An ambiguous started
  delivery is looked up and never blindly resent.
- `src/adapters/gateways/hermes/` has health/queue/lookup interface parity only;
  it returns disabled/not implemented and stores no endpoint or receipt cache.

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

The Batch D direct application receipt confirms only `PERSISTED`. Future HTTP/SSE
wiring remains Batch E and must preserve this separation.

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

### 4.3 Required preflight evidence

Before each delivery attempt, the adapter requires a fresh, immutable reference
showing:

- active mode and disengaged kill switch;
- valid final activation record;
- valid immutable authority, activation, and registry snapshot hashes;
- prevalidated single Advisor destination and synchronized state;
- unique notification receipt identity; and
- bounded expiry and external receipt lookup behavior.

Any absent, stale, or conflicting field produces no tmux write and routes to
manual fallback. The gateway never retries a successful receipt, switches target,
sends Ctrl-C, answers auth/approval, or terminates a process.

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

### Deferred multi-host tests

Use synthetic keys and loopback fixtures only: enrollment, revoked/quarantined
identity, signature failure, skew, duplicate/gap, offline, new boot, reconnect,
Linux/Mac schema parity, and stale evidence. Real hosts/network credentials remain
gated.

## 13. Local Traceability

| DESIGN_REQUIREMENT | IMPLEMENTATION_PATH | TEST_PATH | CURRENT_EVIDENCE | STATUS | DEFERRED_GATE |
|---|---|---|---|---|---|
| AO-INT-001 TmuxAdvisorGateway fixed Advisor-only pointer delivery | `src/adapters/gateways/tmux-advisor/`, `src/adapters/gateways/advisor.ts` | `tests/integration/tmux-advisor-gateway.test.ts`, `tests/recovery/advisor-message-crash-consistency.test.ts` | Exact request/receipt/pointer schema, same-ID replay/conflict, active/kill/stale/conflict/manual matrix, ambiguous lookup/no resend, and no process/network import pass at Batch D commit | `IMPLEMENTED_BATCH_D__PENDING_ADVISOR_ACCEPTANCE` | Real approved transport capability remains external and unused |
| AO-INT-002 Hermes interface/stub only | `src/adapters/gateways/hermes/` | `tests/adapters/hermes-disabled.test.ts` | Health is `DISABLED_NOT_IMPLEMENTED`; queue returns typed `DISABLED`; lookup returns undefined with no endpoint/credential/network/process/write/cache | `IMPLEMENTED_BATCH_D_DISABLED_STUB__PENDING_ADVISOR_ACCEPTANCE` | Separate Leo/GPT Hermes mission |
| AO-INT-003 Read-only manifest/Git/artifact/tmux adapters | `src/adapters/observations/` | `tests/adapters/git-readonly.test.ts`, `tests/adapters/artifact-manifest.test.ts`, `tests/adapters/tmux-readonly.test.ts` | Fixed argv, no-shell/no-write, hostile input, cap/timeout, bounded file, exact structured tmux, and real read-only smoke were Advisor-accepted after Batch B | `IMPLEMENTED_BATCH_B__ADVISOR_ACCEPTED` | None for the local Batch B subset |
| AO-INT-004 Multi-project registry/root isolation | `src/application/projects/registry.ts` | `tests/integration/project-freshness.test.ts` | Stable ID lookup, path-free summary, wrong-project denial, and cross-project overlap rejection were Advisor-accepted after Batch B | `IMPLEMENTED_BATCH_B__ADVISOR_ACCEPTED` | Browser registry mutation remains absent |
| AO-INT-005 Linux/Mac multi-host trust and observation envelope | `src/adapters/hosts/` | `tests/contract/host-observation.test.ts` | `NOT_IMPLEMENTED`; Sections 7-9 | `DEFERRED_WITH_GATE` | Private-network, key, remote-host mission |
| AO-INT-006 Offline/reconnect/gap/stale evidence | `src/application/hosts/freshness.ts`, `src/ui/scene/state-machine.ts` | `tests/integration/project-freshness.test.ts`, `tests/ui/activity-mapping.test.ts` | Batch B/C local freshness/presentation is Advisor-accepted; remote envelope/gap/reconnect remains absent | `IMPLEMENTED_BATCH_C_LOCAL_PRESENTATION_SUBSET__ADVISOR_ACCEPTED` | Remote behavior remains gated |
| AO-INT-007 Canonical AlertKind notification, deterministic deduplication, and manual fallback | `src/application/alerts/`, `src/application/advisor-inbox/`, `src/ui/communication/` | `tests/integration/alert-application.test.ts`, `tests/recovery/advisor-message-crash-consistency.test.ts`, `tests/ui/communication-center.component.test.tsx` | Nine-kind dedup/action preservation, durable message notification recovery/manual fallback, and persistent alert UI pass | `IMPLEMENTED_BATCH_D_LOCAL_SUBSET__PENDING_ADVISOR_ACCEPTANCE` | HTTP/live notification sink remains Batch E |

Cross-document traceability is indexed in `docs/FEATURE_INDEX.md`.
