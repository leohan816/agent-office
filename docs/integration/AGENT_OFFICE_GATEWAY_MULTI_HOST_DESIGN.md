# Agent Office Gateway and Multi-Host Design

Status: `CANDIDATE__NOT_IMPLEMENTED__PENDING_FABLE5_DESIGN_REVIEW`

This candidate defines typed integration ports, the M01 Advisor gateway, read-only
observations, multi-project topology, and designed-but-gated remote host support.
It does not authorize a network connection, tmux input, Hermes implementation,
Tailscale action, key provisioning, or external exposure.

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

An HTTP response can confirm only `PERSISTED`. The browser observes later states
through projections/SSE.

## 4. TmuxAdvisorGateway

### 4.1 Fixed purpose

TmuxAdvisorGateway notifies the one logical Advisor inbox that an immutable Agent
Office message is ready. It cannot send to Agent Office Worker, Fable5 Reviewer,
Control, Foundation, Cosmile, SIASIU, a wildcard, or a caller-selected pane.

The dynamic message body is never pasted into tmux. The candidate delivery shape
uses a separately committed, static Advisor inbox notification launcher that tells
Advisor to read the durable Agent Office inbox/outbox index. Per-message identity
and hash stay in the durable outbox/receipt, not interpolated shell or pane input.
This preserves exact-launcher transport and prevents message text from becoming a
prompt or command.

The static launcher and any Advisor-side inbox consumer are future Batch D
implementation artifacts and require exact Advisor approval/review. They do not
exist now.

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

An Advisor-owned transport capability/profile must provide the exact committed
launcher, verified Advisor locator, and preflight result. Without that capability,
the gateway returns `MANUAL_FALLBACK_REQUIRED`. Agent Office cannot synthesize it.

### 4.3 Required preflight evidence

Before each delivery attempt, the adapter requires a fresh, immutable reference
showing:

- active mode and disengaged kill switch;
- valid final activation record;
- exact committed static launcher commit/blob/SHA-256;
- live Advisor session/pane/workspace/process/readiness matching the registry;
- synchronized panes off and exact single target;
- no repository/branch/dependency write conflict;
- unique notification/result receipt path; and
- bounded timeout/stall handling.

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
| `getReceipt(...)` | `NOT_FOUND_NOT_IMPLEMENTED` |
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
authority owner. Registry changes require trusted configuration, audit, restart or
explicit reload receipt, and a later implementation handoff.

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

- manifest commit/path/hash and denominator validation;
- Git fixed-argv snapshots, hostile refs/pathspecs, timeout/output cap, and proof no
  writable subcommand exists;
- artifact traversal/symlink/special-file/hash/staleness cases;
- tmux structured parsing with hostile names and proof observation is read-only;
- multi-project root isolation and stale-evidence projection; and
- local offline/restart observation behavior.

### Batch D

- same notification ID/same hash returns one receipt; different hash conflicts;
- static launcher bytes/commit/hash and fixed Advisor target validation;
- inactive transport, engaged kill switch, stale registry, synchronized panes,
  ambiguous receipt, timeout, and restart all fail to manual fallback;
- message text cannot appear in launcher input or argv;
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
| AO-INT-001 TmuxAdvisorGateway fixed Advisor-only pointer delivery | `src/adapters/gateways/tmux-advisor/` | `tests/integration/tmux-advisor-gateway.test.ts` | `NOT_IMPLEMENTED`; Sections 3-4 | `DESIGNED_CANDIDATE` | Batch D plus approved transport profile |
| AO-INT-002 Hermes interface/stub only | `src/adapters/gateways/hermes/` | `tests/adapters/hermes-disabled.test.ts` | `NOT_IMPLEMENTED`; Section 5 | `DEFERRED_WITH_GATE` | Separate Leo/GPT Hermes mission |
| AO-INT-003 Read-only manifest/Git/artifact/tmux adapters | `src/adapters/observations/` | `tests/adapters/read-only-boundaries.test.ts` | `NOT_IMPLEMENTED`; Section 6 | `DESIGNED_CANDIDATE` | Batch B |
| AO-INT-004 Multi-project registry/root isolation | `src/application/projects/` | `tests/integration/multi-project-isolation.test.ts` | `NOT_IMPLEMENTED`; Section 7 | `DESIGNED_CANDIDATE` | Batch B |
| AO-INT-005 Linux/Mac multi-host trust and observation envelope | `src/adapters/hosts/` | `tests/contract/host-observation.test.ts` | `NOT_IMPLEMENTED`; Sections 7-9 | `DEFERRED_WITH_GATE` | Private-network, key, remote-host mission |
| AO-INT-006 Offline/reconnect/gap/stale evidence | `src/application/hosts/` | `tests/integration/host-reconnect.test.ts` | `NOT_IMPLEMENTED`; Section 9 | `DESIGNED_FOR_EXTENSION` | Local behavior Batch B; remote behavior gated |
| AO-INT-007 Canonical AlertKind notification, deterministic deduplication, and manual fallback | `src/application/notifications/` | `tests/integration/notification-recovery.test.ts`, `tests/contract/alert-notification-vocabulary.test.ts` | `NOT_IMPLEMENTED`; Section 10 and Domain 7.3 | `DESIGNED_CANDIDATE` | Batch D |

Cross-document traceability is indexed in `docs/FEATURE_INDEX.md`.
