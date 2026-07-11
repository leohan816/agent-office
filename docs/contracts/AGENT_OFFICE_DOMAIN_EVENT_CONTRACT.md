# Agent Office Domain and Event Contract

Status: `FINAL_AUTHORITY_REWORK_IMPLEMENTED__PENDING_FABLE5_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE`

Contract version: `agent-office.domain.v1`

This document is the canonical contract for mission entities, state machines,
commands, events, ordering, idempotency, evidence, and deterministic projection.
The Batch A local domain/store/projection subset is implemented at code commit
`7edc8f79bedb059ab6697e64ddaf57fbebde2c87` and accepted by Advisor as the Batch B
dependency. Batch B consumes the contract through read-only observation and
dashboard projections at code commit
`85e66d856e33a0df73041cb4b33aba30a8f9f96d`. Batch C consumes the same
contract in a pure presentation runtime at code commit
`e30a6cda52e14a4bf30b2d1b7445fa26645496e5`; it appends no event and cannot
change a durable projection. Advisor accepted Batch C as the Batch D dependency.
Batch D implements the local message/notification/alert/lifecycle application at
`7366036f8a1e6fc9d4e911e8d193e17eeb95f54c` and was accepted as the Batch E
dependency. Batch E commit `e0a11f69fffc9d35d67cc478cbefbb92d93cf528`
adds HTTP/session/SSE and recovery boundaries without adding or changing a
domain event type, transition, actor authority, completion rule, or manifest
denominator. Its typed server maps only to the Batch D application ports; backup
and restore copy/replay the same version-1 ledger rather than rewriting it.
Final rework commit `0f90e39d3995ffca97eb7a05ef051d8f9a3719c1`
closes the reproduced authority-link divergence without inventing a new decision
authority: it extends the existing link command/artifact/event/projection evidence
and adds an immutable authority-verification port. The same-Reviewer delta review
and Advisor acceptance remain pending.

## 1. Contract Principles

1. Mission state comes only from a versioned manifest, accepted structured events,
   and verified immutable evidence.
2. Terminal prose, animation, process names, and browser-local state never create
   domain truth.
3. The event ledger is append-only. Corrections are new events; prior records are
   never edited or deleted.
4. One writer serializes each mission stream. Stream sequence, not wall-clock
   time, determines order.
5. Commands are idempotent and optimistic-concurrency checked.
6. Invalid transitions do not partially mutate state and do not consume a domain
   stream sequence.
7. Worker reporting is not review or completion. Completion requires the
   manifest-declared evidence and authority gates.
8. Browser messages target one logical endpoint, Advisor. There is no Worker,
   Reviewer, session, pane, or raw-command target in the public command schema.

### 1.1 Batch A as-built boundary

Batch A implements:

- strict manifest, scope-change, command/event, activity, state-machine,
  blocker/alert, message, ResumeProof, GPT-package, evidence, and completion
  contracts under `src/domain/` and `src/contracts/`;
- the exact approved M01 manifest bytes plus committed source metadata under
  `fixtures/manifests/`;
- canonical hashing, one-writer idempotent event persistence, immutable artifacts,
  deterministic projection/checkpoint replay, and fail-closed recovery under
  `src/persistence/file-store/` and `src/application/`; and
- all 15 required Batch A test paths, totaling 36 passing tests at the code
  commit above.

The Fable5 R-1 residual is pinned fail-closed: absent, expired, or incompatible
activity for primary-only `DISPATCHED`, `RUNNING`, `RESULT_REPORTED`, or
`REVIEW_PENDING`, and the unmapped `WAITING_ADVISOR`/`HOLD` states, projects
`UNKNOWN_OR_STALE`. Batch B preserves that required-observable fallback while
separately rendering the durable primary `WAITING_ADVISOR` and `HOLD` states with
fixed locale entries; it does not invent an active observable alias.

### 1.2 Batch C as-built consumer boundary

`src/ui/scene/state-machine.ts` consumes only typed `RoleSceneProjection` fields,
accepted UUIDv7 event IDs, durable primary state, structured RoleActivity,
freshness/connection state, and typed blocker/decision/recovery/result evidence.
It projects all 16 exact required observable names plus the reviewed durable
`WAITING_ADVISOR`, `HOLD`, `UNKNOWN_OR_STALE`, presentation-only `IDLE`, and
bounded `RECOVERY` states. Missing/unaccepted source IDs, stale/offline/conflicted
evidence, incompatible activity, or a result return without verified result and
pointer refs fails closed and suppresses motion. Fixture choice, cue expiry,
animation completion, reload, and tab resume never append or mutate domain state.

### 1.3 Batch D as-built application boundary

`src/application/advisor-inbox/` persists one scoped owner-only message artifact
before `AdvisorMessagePersisted`, reconstructs message/notification state from the
hash-chained ledger, and keeps delivery, Advisor acknowledgement, intake,
decision link, ResumeProof, and close as separate artifacts/events. It completes
partial outbox writes after restart and reconciles a started delivery by receipt
lookup only; an absent/ambiguous receipt becomes manual fallback and is never
blindly resent.

`src/application/alerts/` preserves the closed nine-kind policy, canonical dedup
key, occurrence folding, acknowledgement/snooze/resolution/suppression, and an
immutable detail artifact. `src/application/audit/` exposes only allowlisted IDs,
states, hashes, sequence, actor role, and the existing event hash chain. No
message body enters gateway requests or the redacted audit projection.

### 1.4 Final authority-link as-built boundary

`LinkAdvisorDecision` now carries `authorityRole`. The field is included in the
actor-bound idempotency command hash, exact version-2 immutable link artifact,
`AdvisorMessageDecisionLinked` event, projector, restart replay, and durable
message projection. Before any link artifact/event is written,
`ArtifactDecisionAuthorityEvidenceVerifier` resolves only an exact registered
repository/commit/path/SHA-256 reference through `ArtifactSource`, requires
immutable `VERIFIED` bytes and metadata, parses the closed version-1 authority
record, and matches decision ID, mission, exact nonempty WorkUnit scope, named
authority, and time ordering. The application independently rechecks the returned
evidence hash and correspondence.

Missing, unreadable, mutable, stale, malformed, hash/path/commit/repository,
mission, scope, or named-authority mismatch returns the stable
`AUTHORITY_ARTIFACT_INVALID` code and appends neither a decision-link artifact nor
event. Advisor remains the actor recording the link; this does not grant Advisor
the recorded canonical authority. The current approved contract defines no safe
bounded Advisor routine decision scope, so `authorityRole=Advisor` rejects closed
until a separate authority decision defines one.

## 2. Identity, Encoding, Time, and Hashing

### 2.1 IDs

- Stable business IDs (`initiativeId`, `packageId`, `missionId`, `phaseId`,
  `workUnitId`, `hostId`) are manifest-defined, case-sensitive ASCII tokens
  matching `^[A-Z0-9][A-Z0-9._-]{0,127}$` unless an imported canonical manifest
  already defines a compatible ID.
- Generated IDs (`eventId`, `requestId`, `messageId`, `blockerId`, `alertId`,
  `decisionId`, `notificationId`, `artifactId`, `correlationId`) are UUIDv7 text.
- IDs are never reused. A display name is not an ID.

### 2.2 JSON and hashes

- Stored JSON is UTF-8 without a byte-order mark.
- Hash input uses RFC 8785 JSON Canonicalization Scheme bytes.
- Hashes use SHA-256 and lowercase hexadecimal, represented as
  `sha256:<64-hex>`.
- A hash proves byte identity/tamper evidence, not actor identity. Authority still
  requires a trusted artifact source and role decision.
- Unknown fields are rejected at command boundaries. Event readers preserve but
  do not interpret fields from a future declared schema version.

### 2.3 Time

All timestamps are UTC RFC 3339 strings with milliseconds and trailing `Z`.

| Field | Meaning | Ordering authority |
|---|---|---|
| `occurredAt` | Claimed source time of the activity | Informational only |
| `observedAt` | Time a collector observed external state | Freshness only |
| `receivedAt` | Time Agent Office received a command/observation | Diagnostics |
| `recordedAt` | Time the single writer durably recorded the event | Audit timestamp, not sequence |
| `sequence` | Contiguous mission-stream integer starting at 1 | Canonical mission ordering |
| `hostSequence` | Contiguous counter within one host `bootId` | Remote observation gap detection |

Clock rollback never reorders events. A clock-quality flag is attached when skew
or rollback is detected. UI relative-time calculations use a supplied evaluation
time and cannot change stored domain status.

## 3. Versioned Mission Manifest

### 3.1 Required shape

```json
{
  "schemaVersion": "agent-office.mission-manifest.v1",
  "manifestVersion": 1,
  "missionId": "AGENT_OFFICE_M01_ADVISOR_MANAGED_OFFICE_WEB_CONTROL_PLANE",
  "initiative": {"id": "AGENT_OFFICE", "label": "Agent Office"},
  "package": {"id": "AGENT_OFFICE_M01", "label": "M01"},
  "approvedBy": "Leo/GPT",
  "source": {
    "repository": "foundation-docs",
    "commit": "<40-hex>",
    "path": "<allowlisted-relative-path>",
    "sha256": "sha256:<64-hex>"
  },
  "counting": {
    "denominator": 15,
    "basis": "Only approved WorkUnits in this manifest version"
  },
  "phases": [
    {
      "id": "DESIGN",
      "order": 2,
      "workUnitIds": ["AO-WU-04", "AO-WU-05", "AO-WU-06"]
    }
  ],
  "workUnits": [
    {
      "id": "AO-WU-04",
      "phaseId": "DESIGN",
      "actor": "Agent Office Worker",
      "title": "Author canonical design candidate and contracts",
      "initialState": "READY",
      "dependsOn": ["AO-WU-03"],
      "completionPolicyId": "DESIGN_CANDIDATE_PUBLISHED"
    }
  ]
}
```

The imported M01 source may retain fields such as `labelKo`; the adapter maps
them losslessly to presentation metadata. It must not invent phases or WorkUnits.

### 3.2 Manifest invariants

- `manifestVersion` is a positive integer and increments by exactly one.
- Initiative, package, and mission IDs cannot change across revisions.
- Phase order is unique; each WorkUnit belongs to exactly one phase.
- WorkUnit IDs are unique and all `dependsOn` references exist.
- The dependency graph is acyclic.
- `counting.denominator` equals the number of WorkUnits in that manifest version.
- An initial state must be a valid WorkUnit state and must agree with dependencies
  or carry an explicit imported-state evidence reference.
- A completion policy must be registered before it can be used.
- The source commit, path, and file hash must be verifiable. An unverified import
  is quarantined and not projected.

### 3.3 Scope-change contract

`ChangeMissionScope` requires:

```text
requestId, missionId, expectedStreamVersion,
fromManifestVersion, toManifestVersion,
oldTotal, newTotal,
addedWorkUnits[], removedWorkUnitIds[], changedWorkUnits[],
reason, approvingAuthority, authorityArtifactRef,
oldManifestHash, newManifestHash
```

It emits `MissionScopeChanged` only when:

- versions are consecutive and both manifest hashes verify;
- `oldTotal` equals the active projection's denominator;
- `newTotal` equals the new manifest WorkUnit count;
- the three change lists exactly explain the manifest diff;
- completed history is preserved for removed WorkUnits;
- no ID is reused; and
- `approvingAuthority` and authority evidence meet role V2.

Otherwise it is rejected atomically. Historical progress remains tied to its
then-current manifest version.

## 4. Event Envelope

Each JSONL line contains one envelope:

```json
{
  "schemaVersion": "agent-office.event-envelope.v1",
  "eventId": "018f0000-0000-7000-8000-000000000001",
  "eventType": "WorkUnitStateTransitioned",
  "eventVersion": 1,
  "missionId": "AGENT_OFFICE_M01_ADVISOR_MANAGED_OFFICE_WEB_CONTROL_PLANE",
  "streamId": "mission:AGENT_OFFICE_M01_ADVISOR_MANAGED_OFFICE_WEB_CONTROL_PLANE",
  "sequence": 42,
  "manifestVersion": 1,
  "requestId": "018f0000-0000-7000-8000-000000000002",
  "correlationId": "018f0000-0000-7000-8000-000000000003",
  "causationId": "018f0000-0000-7000-8000-000000000004",
  "predecessorEventIds": ["018f0000-0000-7000-8000-000000000005"],
  "actor": {"role": "Advisor", "subjectId": "advisor-local"},
  "occurredAt": "2026-07-10T00:00:00.000Z",
  "receivedAt": "2026-07-10T00:00:00.010Z",
  "recordedAt": "2026-07-10T00:00:00.012Z",
  "payloadHash": "sha256:<64-hex>",
  "previousEventHash": "sha256:<64-hex-or-genesis>",
  "payload": {},
  "eventHash": "sha256:<64-hex>"
}
```

`eventHash` covers the canonical envelope excluding `eventHash` itself.
`previousEventHash` forms a mission-stream hash chain. Sequence must be previous
sequence plus one. Hash-chain verification occurs before replay.

No event payload may contain credentials, session cookies, CSRF values, raw
terminal input, raw terminal output, auth headers, or private keys.

## 5. Event Vocabulary

Version 1 reserves these accepted domain events:

| Area | Events |
|---|---|
| Manifest | `MissionManifestRegistered`, `MissionScopeChanged`, `ManifestImportRejected` (audit stream only) |
| WorkUnit | `WorkUnitStateTransitioned`, `WorkUnitCompletionRevoked`, `WorkUnitRetryAuthorized`, `RoleActivityChanged` |
| Evidence | `EvidenceAttached`, `EvidenceVerified`, `EvidenceMarkedStale`, `EvidenceInvalidated`, `ReviewResultRecorded` |
| Message | `AdvisorMessagePersisted`, `AdvisorMessageDeliveryQueued`, `AdvisorMessageDelivered`, `AdvisorMessageDeliveryFailed`, `AdvisorMessageManualFallbackRequired`, `AdvisorMessageAcknowledged`, `AdvisorIntakeRecorded`, `AdvisorMessageDecisionLinked`, `AdvisorMessageClosed` |
| Decision | `DecisionRequested`, `DecisionAcknowledged`, `DecisionRecorded`, `DecisionApplied`, `DecisionSuperseded`, `DecisionWithdrawn` |
| Blocker | `BlockerOpened`, `BlockerAcknowledged`, `BlockerRouteChanged`, `BlockerResolved`, `BlockerSuperseded` |
| Alert | `AlertRaised`, `AlertAcknowledged`, `AlertSnoozed`, `AlertResolved`, `AlertSuppressed` |
| Notification | `NotificationQueued`, `NotificationDeliveryStarted`, `NotificationDelivered`, `NotificationAcknowledged`, `NotificationFailed`, `NotificationManualFallbackRequired`, `NotificationCancelled` |
| Projection/ops | `ProjectionCheckpointed`, `RecoveryStarted`, `RecoveryCompleted`, `RecoveryFailed`, `StoreQuarantined` |
| Host observation | `HostObservationAccepted`, `HostObservationGapDetected`, `HostMarkedStale`, `HostReconnected` |

Rejected commands and security failures are append-only `CommandRejected` or
`SecurityAuditRecorded` entries in the separate security audit stream. They do
not pose as accepted domain events.

## 6. WorkUnit State Machine

### 6.1 States

| State | Meaning |
|---|---|
| `QUEUED` | Approved in the manifest but not yet dependency-evaluated |
| `WAITING_DEPENDENCY` | At least one declared dependency is incomplete |
| `READY` | Dependencies and current gate are satisfied; no dispatch implied |
| `DISPATCHED` | Advisor transport evidence records an exact authorized handoff |
| `RUNNING` | Assigned actor has started structured work |
| `TESTING` | Assigned actor is running approved verification |
| `RESULT_REPORTED` | Durable Worker result exists; not yet accepted as completion |
| `REVIEW_PENDING` | Required independent review is routed or awaiting result |
| `NEEDS_PATCH` | Review/audit evidence requires an in-scope patch loop |
| `BLOCKED` | An operational/dependency/evidence blocker prevents progress |
| `WAITING_ADVISOR` | Routine Advisor intake/routing is required |
| `WAITING_LEO` | Material authority, risk, scope, or final decision is required |
| `HOLD` | Advisor has fail-closed the WorkUnit pending evidence/condition repair |
| `COMPLETED` | Completion policy and required immutable evidence are satisfied |
| `FAILED` | Attempt ended unsuccessfully; retry needs explicit authorization |
| `CANCELLED` | Scope authority ended the WorkUnit; terminal for that ID/version |

### 6.2 Allowed transitions

Every transition requires `from`, `to`, `reasonCode`, `expectedStreamVersion`,
actor role, and evidence/decision references required by the row.

| From | Allowed to | Additional rule |
|---|---|---|
| `QUEUED` | `WAITING_DEPENDENCY`, `READY`, `CANCELLED` | `READY` only if all dependencies are `COMPLETED` |
| `WAITING_DEPENDENCY` | `READY`, `BLOCKED`, `HOLD`, `CANCELLED` | Projector never auto-dispatches when dependencies complete; a structured readiness event is required |
| `READY` | `DISPATCHED`, `BLOCKED`, `WAITING_ADVISOR`, `HOLD`, `CANCELLED` | `DISPATCHED` requires exact Advisor handoff and transport receipt |
| `DISPATCHED` | `RUNNING`, `BLOCKED`, `WAITING_ADVISOR`, `HOLD`, `FAILED` | Start evidence must identify the assigned actor/session |
| `RUNNING` | `TESTING`, `RESULT_REPORTED`, `BLOCKED`, `WAITING_ADVISOR`, `WAITING_LEO`, `HOLD`, `FAILED` | No direct transition to `COMPLETED` |
| `TESTING` | `RUNNING`, `RESULT_REPORTED`, `BLOCKED`, `WAITING_ADVISOR`, `WAITING_LEO`, `HOLD`, `FAILED` | Results include command and evidence refs |
| `RESULT_REPORTED` | `REVIEW_PENDING`, `NEEDS_PATCH`, `COMPLETED`, `BLOCKED`, `WAITING_ADVISOR`, `WAITING_LEO`, `HOLD` | `COMPLETED` only when completion policy verifies |
| `REVIEW_PENDING` | `NEEDS_PATCH`, `COMPLETED`, `WAITING_ADVISOR`, `WAITING_LEO`, `BLOCKED`, `HOLD`, `FAILED` | Verdict/risk routing must match canonical V2 |
| `NEEDS_PATCH` | `READY`, `DISPATCHED`, `BLOCKED`, `WAITING_ADVISOR`, `WAITING_LEO`, `HOLD`, `CANCELLED` | Same mission and in-scope patch authority required |
| `BLOCKED` | prior resumable state, `WAITING_ADVISOR`, `WAITING_LEO`, `HOLD`, `FAILED`, `CANCELLED` | Requires resolved blocker and `ResumeProof`; prior state is stored |
| `WAITING_ADVISOR` | prior resumable state, `BLOCKED`, `WAITING_LEO`, `HOLD`, `CANCELLED` | Requires canonical intake/routing record |
| `WAITING_LEO` | prior resumable state, `BLOCKED`, `WAITING_ADVISOR`, `HOLD`, `CANCELLED` | Requires canonical Leo/GPT decision artifact and `ResumeProof` |
| `HOLD` | prior resumable state, `BLOCKED`, `WAITING_ADVISOR`, `WAITING_LEO`, `FAILED`, `CANCELLED` | Advisor must record the repaired condition and resume destination |
| `FAILED` | `READY`, `HOLD`, `CANCELLED` | `READY` requires `WorkUnitRetryAuthorized`; attempt number increments |
| `COMPLETED` | `HOLD` only | Requires `WorkUnitCompletionRevoked` by Advisor with invalidated-evidence proof |
| `CANCELLED` | none | New scope needs a new WorkUnit ID or an approved manifest revision, never ID reuse |

"Prior resumable state" is one of `READY`, `DISPATCHED`, `RUNNING`, `TESTING`,
`RESULT_REPORTED`, or `REVIEW_PENDING`, captured when entering the waiting state.
The caller cannot choose a different state without an explicit Advisor correction.

### 6.3 Required observable-name conformance

The primary WorkUnit state and the structured RoleActivity are two independent,
event-sourced axes. The primary state is the durable lifecycle/audit truth. The
activity is durable as event history but transient as the current visual
observable. They must not be flattened into one state machine.

`requiredObservableName` is a deterministic projection field derived from the
pair. It uses the exact names below; an implementation must not silently rename
them. An incompatible primary/activity pair is rejected before append.

| Required observable name | Primary WorkUnit state | RoleActivity | Structured trigger | End condition | Persistence semantics | Rationale |
|---|---|---|---|---|---|---|
| `QUEUED` | `QUEUED` | `IDLE` or none | Manifest import or `WorkUnitStateTransitioned(..., QUEUED)` | Primary state changes | Primary durable; idle presentation transient | Exact approved-but-not-evaluated lifecycle state |
| `READY` | `READY` | `IDLE` or none | Accepted readiness transition after dependency/gate checks | Dispatch/block/wait/cancel transition | Primary durable | Ready does not imply dispatch or active work |
| `DISPATCHING` | `DISPATCHED` | `DELIVERY` with `reasonCode=WORKUNIT_DISPATCH` | Correlated `READY -> DISPATCHED` and `RoleActivityChanged(DELIVERY)` after exact handoff/transport evidence | `RUNNING`, dispatch failure/block/hold, or explicit activity expiry | Primary durable; delivery event durable; current activity transient | `DISPATCHING -> DISPATCHED + DELIVERY` keeps transport evidence separate from the observable in-progress cue |
| `READING` | `DISPATCHED` or `RUNNING` | `READING` | `RoleActivityChanged(READING)` citing immutable handoff/input acknowledgement | A higher-sequence activity, block/wait/fail, or explicit expiry | Activity event durable; current activity transient | Reading is observable work, not a lifecycle milestone |
| `WORKING` | `RUNNING` | `WORKING` | Correlated `... -> RUNNING` and `RoleActivityChanged(WORKING)` | Testing, result writing, block/wait/fail, or explicit activity change | Primary durable; activity event durable/current transient | `WORKING -> RUNNING + WORKING` preserves durable execution and visible activity |
| `TESTING` | `TESTING` | `TESTING` | Accepted `... -> TESTING` plus command/evidence-linked activity | Return to work, result writing/report, block/wait/fail | Primary and activity events durable; current activity transient | Testing is both an auditable lifecycle phase and observable activity |
| `WRITING_RESULT` | `RUNNING` or `TESTING` | `WRITING_RESULT` | `RoleActivityChanged(WRITING_RESULT)` with `reasonCode=RESULT_DRAFT_STARTED` and accepted work/test source event | `RESULT_REPORTED`, return to work/testing, block/wait/fail, or explicit expiry | Activity event durable; primary remains unchanged until immutable result exists | Result drafting is now observable but cannot claim `RESULT_REPORTED` before durable evidence |
| `RETURNING_RESULT` | `RESULT_REPORTED` | `RESULT_RETURN` | Verified immutable result/pointer causes `... -> RESULT_REPORTED` and correlated `RoleActivityChanged(RESULT_RETURN)` | Review/Advisor route, block/hold, or explicit activity expiry | Primary durable; return activity event durable/current transient | `RETURNING_RESULT -> RESULT_REPORTED + RESULT_RETURN` distinguishes evidence existence from the bounded return cue |
| `REVIEWING` | `REVIEW_PENDING` | `REVIEW` | Accepted review route and correlated `RoleActivityChanged(REVIEW)` | Review verdict, route change, block/hold/fail | Primary durable; review activity event durable/current transient | `REVIEWING -> REVIEW_PENDING + REVIEW` preserves independent-review lifecycle truth |
| `NEEDS_PATCH` | `NEEDS_PATCH` | none required | Review/audit finding accepted under canonical verdict routing | Patch handoff, block/wait/hold/cancel | Primary durable | Exact rework lifecycle state, not inferred animation |
| `WAITING_DEPENDENCY` | `WAITING_DEPENDENCY` | none required | Dependency evaluation finds an incomplete declared dependency | Dependency readiness, block/hold/cancel | Primary durable | Exact dependency gate state |
| `WAITING_LEO` | `WAITING_LEO` | `WAITING_LEO` | Material decision request with immutable decision package/evidence | Canonical decision plus resume, route change, hold/cancel | Primary and activity events durable; current cue persists while state persists | Exact authority-waiting state with visible structured cue |
| `BLOCKED` | `BLOCKED` | `BLOCKED` | Valid `BlockerOpened` and WorkUnit blocked transition | `BlockerResolved` plus valid resume, fail/cancel/hold | Primary/blocker/activity history durable; current cue persists while blocked | Exact fail-closed operational state |
| `COMPLETED` | `COMPLETED` | none required | Completion policy and required evidence/authority verify | Terminal, except explicit completion revocation to `HOLD` | Primary durable | Exact evidence-backed terminal state |
| `FAILED` | `FAILED` | none required | Accepted attempt failure with reason/evidence | Authorized retry, hold, or cancel | Primary durable | Exact failed-attempt lifecycle state |
| `CANCELLED` | `CANCELLED` | none required | Scope authority cancels the WorkUnit | Terminal | Primary durable | Exact authority-backed terminal cancellation |

When a required observable has both axes, both accepted events share a
`correlationId` and explicit causation links. The projector exposes primary state,
activity, source event IDs, and `requiredObservableName`; the UI never derives the
name from prose or substitutes an alias.

## 7. Message, Blocker, Alert, Decision, and Notification States

### 7.1 Advisor message

| State | Entry event | Allowed next states |
|---|---|---|
| `PERSISTED` | `AdvisorMessagePersisted` after artifact fsync | `DELIVERY_PENDING`, `CLOSED` |
| `DELIVERY_PENDING` | `AdvisorMessageDeliveryQueued` | `DELIVERED`, `DELIVERY_FAILED`, `MANUAL_FALLBACK_REQUIRED` |
| `DELIVERED` | fixed Advisor gateway receipt | `ACKNOWLEDGED`, `DELIVERY_FAILED`, `MANUAL_FALLBACK_REQUIRED` |
| `DELIVERY_FAILED` | typed gateway failure | `DELIVERY_PENDING`, `MANUAL_FALLBACK_REQUIRED`, `CLOSED` |
| `MANUAL_FALLBACK_REQUIRED` | kill switch/inactive transport/ambiguous target | `DELIVERY_PENDING`, `ACKNOWLEDGED`, `CLOSED` |
| `ACKNOWLEDGED` | Advisor acknowledgement artifact | `INTAKE_RECORDED`, `CLOSED` |
| `INTAKE_RECORDED` | canonical Advisor intake artifact | `DECISION_LINKED`, `CLOSED` |
| `DECISION_LINKED` | canonical decision reference | `CLOSED` |
| `CLOSED` | Advisor close record | none |

An invalid HTTP request is rejected before a Message entity exists. Delivery
acknowledgement means receipt by Advisor, not acceptance of the requested action.

### 7.2 Blocker

`OPEN -> ACKNOWLEDGED -> WAITING_ADVISOR | WAITING_LEO -> RESOLVED`.
`OPEN` or `ACKNOWLEDGED` may route directly to a waiting state. Any nonterminal
state may become `SUPERSEDED` with a replacement blocker reference. `RESOLVED` and
`SUPERSEDED` are terminal. A resolution contains evidence and the exact resume
destination; closing a UI card is not resolution.

`BlockerKind` is the closed M01 vocabulary:

| BlockerKind | Required safe default | Default resolution owner |
|---|---|---|
| `MISSING_LEO_DECISION` | `WAIT_FOR_LEO` | `LEO_GPT` |
| `MISSING_EVIDENCE` | `STOP_AND_HOLD` | `ADVISOR` |
| `SESSION_NOT_READY` | `STOP_AND_HOLD` | `ADVISOR` |
| `SESSION_OFFLINE` | `STOP_AND_HOLD` | `ADVISOR` |
| `WRONG_ACTOR_OR_WORKSPACE` | `STOP_AND_HOLD` | `ADVISOR` |
| `GIT_CONFLICT` | `STOP_AND_HOLD` | `ADVISOR` |
| `DIRTY_WORKTREE_CONFLICT` | `STOP_AND_HOLD` | `ADVISOR` |
| `TEST_FAILURE` | `STOP_AND_HOLD` | `ASSIGNED_WORKER` |
| `AUTHENTICATION_REQUIRED` | `NO_AUTOMATIC_ACTION` | `ADVISOR` |
| `UNEXPECTED_APPROVAL_PROMPT` | `NO_AUTOMATIC_ACTION` | `ADVISOR` |
| `SCOPE_CONFLICT` | `WAIT_FOR_LEO` | `LEO_GPT` |
| `DEPENDENCY_FAILED` | `STOP_AND_HOLD` | `ADVISOR` |
| `TIMEOUT` | `STOP_AND_HOLD` | `ADVISOR` |
| `ARTIFACT_MISSING` | `STOP_AND_HOLD` | `ASSIGNED_WORKER` |
| `COMMIT_NOT_PUSHED` | `STOP_AND_HOLD` | `ASSIGNED_WORKER` |
| `MANUAL_KILL_SWITCH` | `MANUAL_FALLBACK` | `ADVISOR` |

Safe defaults are limited to `STOP_AND_HOLD`, `WAIT_FOR_LEO`,
`NO_AUTOMATIC_ACTION`, `MANUAL_FALLBACK`, and `READ_ONLY`. A mission policy may
choose a stricter value but never a weaker automatic action. Resolution-owner
values are `ADVISOR`, `LEO_GPT`, `ASSIGNED_WORKER`, `FABLE5_REVIEWER`, and
`LOCAL_OPERATOR`; naming an owner does not grant authority absent a handoff.

The logical `BlockerOpened` record is exactly the event envelope plus this typed
payload. Envelope fields are shown here for conformance and are serialized only
once, not duplicated inside `payload`:

```text
blockerId
missionId
entityRefs[]: { entityType, entityId }
kind: BlockerKind
reasonCode
explanation
safeDefault
resolutionOwner
nextAction: { actionCode, description, targetActor, requiresNewHandoff }
blockedSince
evidenceRefs[]
priorWorkUnitState
resumeTo
requestId
manifestVersion
expectedStreamVersion
causationId
correlationId
```

`explanation` is human-readable but cannot override the typed kind/default/owner.
`reasonCode` is a stable reviewed code under the kind. `entityRefs` contains at
least the blocked WorkUnit or mission. `evidenceRefs` may be empty only when the
kind itself proves evidence is missing; the missing expected pointer is then named
in `nextAction`. `priorWorkUnitState` and `resumeTo` are required for a WorkUnit
blocker and must follow Section 6.2.

Opening is idempotent by `requestId` and optimistic-concurrency checked by
`expectedStreamVersion`/`manifestVersion`. `BlockerResolved` must cite the same
blocker ID, resolution owner, resolution code, immutable resolution evidence,
`resolvedAt`, and valid `ResumeProof`. No timeout, UI acknowledgement, reconnect,
or new observation auto-resolves a blocker. Invalid/unknown kinds or weaker safe
defaults are rejected atomically.

### 7.3 Alert

`OPEN -> ACKNOWLEDGED -> SNOOZED -> OPEN | RESOLVED`.
`OPEN` or `ACKNOWLEDGED` may resolve directly. `SUPPRESSED` is allowed only for a
documented deterministic suppression rule and expires to `OPEN` if the condition
persists. Severity (`INFO`, `WARNING`, `CRITICAL`) is a field, not a state.
Acknowledgement never resolves the underlying condition.

`AlertKind` is the closed M01 vocabulary:

| AlertKind | Default severity | Canonical action codes |
|---|---|---|
| `NEEDS_LEO_DECISION` | `WARNING` | `COPY_GPT_PACKAGE`, `OPEN_EVIDENCE`, `REPLY_TO_ADVISOR`, `HOLD` |
| `PASS_WITH_RISK` | `WARNING` | `COPY_GPT_PACKAGE`, `OPEN_EVIDENCE`, `HOLD` |
| `BLOCKED` | `WARNING` | `OPEN_EVIDENCE`, `REPLY_TO_ADVISOR`, `HOLD` |
| `AUTHENTICATION_REQUIRED` | `WARNING` | `OPEN_EVIDENCE`, `HOLD` |
| `MANUAL_ACTION_REQUIRED` | `WARNING` | `OPEN_EVIDENCE`, `REPLY_TO_ADVISOR`, `HOLD` |
| `FINAL_APPROVAL_REQUIRED` | `WARNING` | `COPY_GPT_PACKAGE`, `OPEN_EVIDENCE`, `HOLD` |
| `MISSION_COMPLETE` | `INFO` | `OPEN_EVIDENCE` |
| `MISSION_FAILED` | `CRITICAL` | `OPEN_EVIDENCE`, `REPLY_TO_ADVISOR`, `PAUSE_MISSION`, `CANCEL_MISSION` |
| `INFORMATION` | `INFO` | `OPEN_EVIDENCE` when evidence exists |

The logical `AlertRaised` record (event envelope plus payload, without duplicated
serialization) is exactly:

```text
alertId
missionId
kind: AlertKind
severity
primaryEntityRef: { entityType, entityId }
relatedEntityRefs[]
conditionKey
titleKey
messageParameters
actionCodes[]
sourceEventIds[]
evidenceRefs[]
deduplicationKey
firstObservedAt
lastObservedAt
occurrenceCount
resolutionCondition
requestId
manifestVersion
expectedStreamVersion
causationId
correlationId
```

`deduplicationKey` is exactly the SHA-256 of RFC 8785 canonical JSON containing
`missionId`, `kind`, `primaryEntityRef`, `conditionKey`, and `manifestVersion`.
Repeated observations with the same open key fold into the same alert and
increment `occurrenceCount`/`lastObservedAt`; same request/hash remains idempotent.
A changed condition produces a new key. Severity/action overrides require a
reviewed policy ID and may only be stricter. UI and notification adapters consume
this enum and payload; they cannot invent kinds, dedup keys, or action codes.

### 7.4 Decision

`REQUESTED -> ACKNOWLEDGED -> RECORDED -> APPLIED`.
`REQUESTED` or `ACKNOWLEDGED` may become `WITHDRAWN`. A recorded decision may
become `SUPERSEDED` only by a newer canonical decision referencing the former.
`RECORDED` requires an immutable decision artifact, authority role, hash, and
scope. `APPLIED` requires an event citing both the decision and resulting state
transition. Browser submission alone cannot enter `RECORDED`.

### 7.5 Notification

`QUEUED -> DELIVERING -> DELIVERED -> ACKNOWLEDGED`.
`DELIVERING` may become `FAILED`; `FAILED` may return to `QUEUED` under a bounded
retry policy or become `MANUAL_FALLBACK_REQUIRED`. Any undelivered notification
may become `CANCELLED` by Advisor. Delivery uses `notificationId` idempotency;
acknowledgement is distinct from message/decision acknowledgement.

## 8. Advisor Message, Intake, Decision, and Resume Proof

### 8.1 Typed browser/application command

`SubmitAdvisorMessage` contains only:

```text
requestId, missionId, manifestVersion,
kind: NEW_MISSION | CLARIFICATION | DECISION_RESPONSE | PAUSE | CANCEL,
subject, bodyText, referencedEntityIds[], clientCreatedAt
```

There is no `targetRole`, `targetSession`, `pane`, `command`, `shell`, `argv`,
`reviewer`, or `worker` field. Unknown fields are rejected.

### 8.2 Immutable message artifact

After validation, the application builds canonical JSON containing the accepted
fields and content identity. It writes with
create-exclusive semantics at:

```text
artifacts/inbox/<missionId>/<requestId>/<payloadSha256>.json
```

Only after file and directory durability does it append
`AdvisorMessagePersisted`. The direct application persistence receipt includes:

```text
requestId, messageId, messageArtifactRef, messageArtifactHash, messagePayloadHash,
persistedEventId, persistedMissionSequence, acceptedAt, status=PERSISTED, replayed
```

A retry with the same `requestId` and same payload hash returns the prior durable
receipt. Same ID/different hash returns `IDEMPOTENCY_KEY_REUSED`; the Batch E HTTP
boundary maps that stable rejection to 409 and returns no second domain event.
`tests/integration/http-advisor-message.test.ts` proves both outcomes across a
server/store restart.

### 8.3 Canonical Advisor intake

Advisor acknowledgement is another immutable artifact/event. Advisor then records
an intake artifact that classifies the message, cites its hash, identifies the
mission/WorkUnit, and states `ROUTINE_ROUTE`, `NEEDS_LEO_DECISION`, `NO_ACTION`, or
`REJECTED_OUT_OF_SCOPE`. No state resumes merely because delivery occurred.

### 8.4 Deterministic GPT decision package

When Leo/GPT authority is required, the package builder consumes only canonical
manifest fields, open decision/blocker records, immutable evidence refs, hashes,
and current projection revision. It emits canonical JSON plus a deterministic
Markdown rendering. `packageId` is the SHA-256 of canonical JSON. Terminal prose,
animation labels, and unverified observations are excluded.

Version 1 contains exactly these fields in this order:

```text
TARGET_ACTOR
MISSION
REQUEST_ID
SOURCE_ADVISOR_JOB
READ_DECISION_REQUEST
CONFIRMED_FACTS
UNKNOWNS
QUESTION
OPTIONS
ADVISOR_RECOMMENDATION
SAFE_DEFAULT
RETURN_RESULT_TO
DO_NOT_START_ANOTHER_MISSION_AUTOMATICALLY
```

- `TARGET_ACTOR` is the canonical decision owner, normally `Leo/GPT`.
- `MISSION` is the exact mission ID.
- `REQUEST_ID` is the UUIDv7 idempotency/correlation request ID.
- `SOURCE_ADVISOR_JOB` is the committed job path plus commit and file hash.
- `READ_DECISION_REQUEST` is the immutable decision-request artifact ref/hash.
- `CONFIRMED_FACTS` and `UNKNOWNS` are arrays sorted by stable fact/unknown ID.
- `QUESTION` is one bounded decision question.
- `OPTIONS` is an ordered array of `{ optionId, label, impact }` from the approved
  decision request; the builder invents no option.
- `ADVISOR_RECOMMENDATION` is `{ optionId, rationale }` or explicit `NONE`.
- `SAFE_DEFAULT` is the fail-closed action while waiting.
- `RETURN_RESULT_TO` is `Advisor`.
- `DO_NOT_START_ANOTHER_MISSION_AUTOMATICALLY` is boolean `true`.

Unknown/additional fields are rejected in v1. The deterministic Markdown renderer
prints the exact uppercase headings in the same order. It cannot add terminal
prose, hidden instructions, or an automatic execution field.

### 8.5 Decision and resume proof

A `DecisionRecorded` artifact contains decision ID, authority (`Leo/GPT` when
required), exact question/scope, outcome, constraints, referenced package/hash,
source artifact/hash, and recorded time. A `ResumeProof` contains:

```text
workUnitId, waitingEventId, previousState, resumeTo,
decisionId, decisionArtifactHash, intakeArtifactHash,
resolvedBlockerIds[], expectedStreamVersion
```

The transition is rejected if the decision scope does not cover the WorkUnit, a
hash fails, blockers remain open, or `resumeTo` differs from the captured prior
state without an Advisor correction.

The as-built `AdvisorMessageDecisionLinked` path is narrower than decision
creation or application. Its HTTP/application command contains `authorityRole`
and one immutable `SourceArtifactRef`. The verifier must prove exact correspondence
between that claim and the canonical authority record before the application
writes `agent-office.advisor-decision-link.v2`. The durable event/projection then
contains the verified role, authority subject, evidence ref/hash, and exact scope.
Same request/same actor/same command returns the prior projection; changing the
role or other command bytes conflicts because authority participates in the
command hash. Linkage alone does not create `DecisionApplied`, construct a
`ResumeProof`, resolve a blocker, resume a WorkUnit, or transfer final authority
to the Advisor actor.

## 9. Command Validation and Invalid Transitions

Validation order is deterministic:

1. transport/body bounds and JSON media type;
2. authentication, same-origin/CSRF, and rate limit;
3. schema and unknown-field rejection;
4. request ID and canonical payload hash lookup;
5. mission/manifest existence and version;
6. actor authority and fixed target constraints;
7. expected stream version;
8. entity existence and transition table;
9. dependency, blocker, evidence, review, and decision invariants;
10. durable artifact/event append.

Rejections use stable codes:

- `INVALID_SCHEMA`
- `UNKNOWN_FIELD`
- `UNAUTHORIZED_ACTOR`
- `FORBIDDEN_TARGET`
- `ARBITRARY_COMMAND_FORBIDDEN`
- `MISSION_NOT_FOUND`
- `MANIFEST_VERSION_CONFLICT`
- `STREAM_VERSION_CONFLICT`
- `INVALID_TRANSITION`
- `DEPENDENCY_INCOMPLETE`
- `EVIDENCE_MISSING_OR_STALE`
- `AUTHORITY_ARTIFACT_INVALID`
- `IDEMPOTENCY_KEY_REUSED`
- `STORE_QUARANTINED`
- `GATEWAY_DISABLED`

The response discloses no sensitive detail. A redacted rejection record includes
requestId, subject reference, code, route, receivedAt, and payload hash, never raw
credentials or rejected body content.

## 10. Idempotency, Ordering, and Causality

- `requestId` is mandatory for every mutation.
- Idempotency scope is the entire Agent Office state root, not one browser tab.
- Same ID and same canonical command hash returns the original durable receipt,
  even after restart.
- Same ID and different hash is a hard conflict; neither command is appended.
- `expectedStreamVersion` implements optimistic concurrency. Stale versions return
  conflict with current sequence and projection revision.
- Mission `sequence` is contiguous and authoritative. Cross-mission displays sort
  by recorded time plus mission ID only for presentation; no global causal order
  is invented.
- `causationId` points to the command/event/artifact that directly caused an event.
- `correlationId` groups one routed flow such as message -> intake -> decision ->
  resume.
- `predecessorEventIds` carries explicit cross-stream dependencies.
- Remote observations include hostId, bootId, hostSequence, and source time. Agent
  Office recorded sequence decides receipt order; gaps/staleness are explicit.

## 11. Deterministic Projection Contract

Each projector is a pure fold:

```text
projection[n] = apply(projection[n-1], verifiedEvent[n])
```

Inputs are the verified manifest version and accepted events in sequence. The
fold cannot read wall-clock time, filesystem modification time, Git status,
terminal text, network state, or random values. Time-dependent freshness is a
separate query overlay computed from an explicit `evaluatedAt` and shown as such.

Projection output includes:

- `projectionSchemaVersion`, missionId, manifestVersion, sequence, eventHash;
- hierarchy and WorkUnit states/attempts/dependencies;
- numerator, denominator, and scope history;
- open blockers, decisions, alerts, messages, and notification receipts;
- evidence verification/freshness state;
- host observation freshness and gap markers; and
- `rebuiltAt` as non-domain metadata.

Replay from genesis and replay from a verified checkpoint must produce
byte-equivalent canonical projection content excluding `rebuiltAt`. A mismatch
quarantines the projection and serves no mutable command endpoint until recovery.

## 12. Evidence and Completion Contract

An `EvidenceRef` contains:

```text
artifactId, kind, repository, commit, path, sha256,
producerRole, producedAt, verifiedAt, verifier,
freshnessPolicyId, verificationStatus
```

Verification states are `UNVERIFIED`, `VERIFIED`, `STALE`, and `INVALID`.
Filesystem existence alone is not verification. Git evidence includes branch,
commit, upstream/ref, changed files, and ancestry. Review evidence includes review
pass, reviewed commit/files, coverage, verdict, and independent actor/session.

Candidate completion policies:

| Policy | Minimum evidence |
|---|---|
| `DESIGN_CANDIDATE_PUBLISHED` | Exact allowed design files, design commit and upstream equality, clean target scope, Worker result/pointer; state becomes `RESULT_REPORTED`, not final mission completion |
| `DESIGN_REVIEW_ACCEPTED` | Independent Fable5 design result over exact commit with `PASS`; `PASS_WITH_RISK` additionally needs Leo/GPT risk acceptance |
| `IMPLEMENTATION_BATCH_ACCEPTED` | Exact batch diff, tests, Worker evidence, Advisor audit, prior dependency complete |
| `IMPLEMENTATION_REVIEW_ACCEPTED` | Independent implementation review over exact code/test/design commits with routed verdict |
| `PRIVATE_RUN_VERIFIED` | Advisor private run evidence, security boundary, desktop/mobile/PWA/recovery checks |
| `FINAL_AUDIT_ACCEPTED` | All declared WorkUnits/gates complete and Leo/GPT final approval artifact |

`PASS_WITH_RISK`, `NEEDS_PATCH`, and `FAIL` route exactly as canonical V2 requires;
the projector never converts them to completion by convenience.

## 13. Structured Activity Contract for UI

`RoleActivityChanged` may contain only:

```text
roleInstanceId, missionId, workUnitId,
activity: IDLE | DELIVERY | READING | WORKING | TESTING | REVIEW |
          WRITING_RESULT | BLOCKED | WAITING_LEO | RESULT_RETURN | RECOVERY,
reasonCode, sourceEventIds[], effectiveFrom, optionalExpiresAt
```

Activity must be caused by an accepted structured event or an explicit Advisor
observation record. It cannot be inferred from words in a pane, CPU usage,
process title, animation state, or elapsed time. Expiry returns the visual to
`IDLE` or the WorkUnit-derived blocking state without creating a domain event.

`DELIVERY` with `reasonCode=WORKUNIT_DISPATCH` is valid only with primary
`DISPATCHED`; `WORKING` only with `RUNNING`; `TESTING` only with `TESTING`;
`WRITING_RESULT` only with `RUNNING` or `TESTING`; `RESULT_RETURN` only with
`RESULT_REPORTED`; and `REVIEW` only with `REVIEW_PENDING`. These pair constraints
are command-validated and reproduce Section 6.3 exactly.

Batch C implements the scene consumer at
`e30a6cda52e14a4bf30b2d1b7445fa26645496e5`. Initial load, reload, and tab resume
mark accepted IDs as already seen and render a static current pose. Only a new
accepted live event ID may create one bounded presentation cue; same-ID updates
are deduplicated, bursts retain safety precedence and at most three cues, and
presentation completion does not produce an event.

Batch D uses `WorkUnitStateTransitioned` for an optional decision-backed resume,
with the immutable `ResumeProof` artifact reference/hash carried alongside the
exact `from` waiting state and `to=resumeTo`. The message projection records the
resume evidence reference but does not treat GPT copy, delivery, acknowledgement,
or intake as a resume transition.

## 14. Schema Evolution

- Event and manifest schemas use explicit versions.
- Readers reject an unknown major version and quarantine the affected stream.
- Additive optional fields require a new minor event version and deterministic
  default semantics.
- Changing meaning, required fields, or state transitions requires a new event
  version, migration/replay design, Fable5 design review, and an explicit later
  implementation handoff.
- Historical JSONL is never rewritten in place. A transformed stream, if ever
  approved, is a new ledger with a signed/hashed provenance record and rollback.

## 15. Local Traceability

| DESIGN_REQUIREMENT | IMPLEMENTATION_PATH | TEST_PATH | CURRENT_EVIDENCE | STATUS | DEFERRED_GATE |
|---|---|---|---|---|---|
| AO-DOM-001 Manifest hierarchy/counting/scope change | `src/domain/manifest/index.ts`, `fixtures/manifests/` | `tests/domain/manifest.test.ts`, `tests/property/scope-counting.test.ts` | Commit `7edc8f79bedb059ab6697e64ddaf57fbebde2c87`; exact source SHA-256 `195b65b5afa1cd71833f67aa63aa85dd3c869e63f2a017f122584b374a835ac8`; Advisor accepted Batch A | `IMPLEMENTED_BATCH_A__ADVISOR_ACCEPTED` | Dashboard consumption implemented in Batch B; later scope changes still require authority |
| AO-DOM-002 Event envelope/hash chain/order/causality | `src/domain/events/index.ts`, `src/persistence/file-store/event-store.ts`, `src/application/audit/`, `src/server/security/audit.ts` | `tests/domain/event-envelope.test.ts`, `tests/persistence/hash-chain.test.ts`, `tests/integration/lifecycle-audit.test.ts`, `tests/security/audit-log.test.ts` | Accepted ledger remains intact; Batch E adds a separate owner-only serialized/tamper-checked redacted security audit without changing domain sequence | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Real-auth lifecycle audit/retention remain gated |
| AO-DOM-003 Complete entity state machines, required observable conformance, and invalid-transition handling | `src/domain/state-machines/`, `src/domain/activity/index.ts`, `src/application/advisor-inbox/projector.ts`, `src/ui/scene/state-machine.ts` | `tests/property/transition-matrix.test.ts`, `tests/integration/advisor-inbox.test.ts`, `tests/recovery/advisor-message-crash-consistency.test.ts` | Batch C mapping and Batch D transitions are Advisor-accepted; final rework changes no transition table and the full 205-test regression preserves all rejections/reconciliation | `IMPLEMENTED_THROUGH_BATCH_D__ADVISOR_ACCEPTED` | None for the local domain application |
| AO-DOM-004 Idempotent Advisor message/intake/decision/resume | `src/domain/messages/index.ts`, `src/domain/decisions/resume-proof.ts`, `src/application/advisor-inbox/`, `src/adapters/observations/artifacts/decision-authority.ts`, `src/server/application.ts`, `src/server/http/` | `tests/integration/advisor-inbox.test.ts`, `tests/integration/decision-authority-evidence.test.ts`, `tests/recovery/advisor-message-crash-consistency.test.ts`, `tests/integration/http-advisor-message.test.ts` | Accepted lifecycle/replay remains; verified Leo/GPT authority is preserved through HTTP, v2 artifact, event, replay, projection, and command hash. Role/mission/scope/hash/mutable/stale/missing/unreadable mismatches return one stable code with zero link artifact/event; unapproved Advisor routine scope fails closed | `IMPLEMENTED_FINAL_REWORK__PENDING_DELTA_REVIEW_AND_ADVISOR_ACCEPTANCE` | Real authenticated operation remains gated; bounded Advisor routine authority requires an explicit canonical decision |
| AO-DOM-005 Deterministic projection and evidence completion | `src/application/projections/mission-projector.ts`, `src/application/evidence/index.ts`, `src/application/advisor-inbox/projector.ts`, `src/operations/restore/`, `src/server/sse/` | `tests/persistence/replay.test.ts`, `tests/recovery/restart-replay.test.ts`, `tests/recovery/backup-restore.test.ts`, `tests/integration/sse-reconnect.test.ts` | Accepted projection/completion authority remains; isolated restore proves the same projection hash and SSE exposes revision/notification IDs only, never creates truth | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Remote evidence remains gated |
| AO-DOM-006 Structured-event-only activity including result writing/return | `src/domain/activity/index.ts`, `src/ui/scene/` | `tests/domain/writing-result-activity.test.ts`, `tests/ui/activity-mapping.test.ts`, `tests/ui/scene-boundary.test.ts` | Batch C event-ID-only activity/result mapping is Advisor-accepted and remains unchanged in Batch D regression | `IMPLEMENTED_BATCH_C__ADVISOR_ACCEPTED` | None for scene activity |
| AO-DOM-007 Typed blocker/alert/GPT package contracts | `src/domain/blockers/index.ts`, `src/domain/alerts/index.ts`, `src/domain/decisions/gpt-package.ts`, `src/application/alerts/`, `src/server/application.ts`, `src/ui/communication/` | `tests/contract/blocker-alert-vocabulary.test.ts`, `tests/snapshot/gpt-package.test.ts`, `tests/integration/alert-application.test.ts`, `tests/security/http-boundary.test.ts` | Accepted closed vocabularies and byte-exact package remain; Batch E typed alert acknowledgement/intake/decision routes add no new kind or authority | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Real Advisor/Leo decision authority remains external |

The cross-document matrix in `docs/FEATURE_INDEX.md` is authoritative for package
discoverability and links these contract IDs to the remaining security, gateway,
UI, and operations requirements.
