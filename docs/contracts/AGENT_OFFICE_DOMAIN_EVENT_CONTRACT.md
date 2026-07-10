# Agent Office Domain and Event Contract

Status: `CANDIDATE__NOT_IMPLEMENTED__PENDING_FABLE5_DESIGN_REVIEW`

Contract version: `agent-office.domain.v1`

This document is the canonical candidate for mission entities, state machines,
commands, events, ordering, idempotency, evidence, and deterministic projection.
It defines contracts only; no schema or runtime exists yet.

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
| Message | `AdvisorMessagePersisted`, `AdvisorMessageDeliveryQueued`, `AdvisorMessageDelivered`, `AdvisorMessageDeliveryFailed`, `AdvisorMessageAcknowledged`, `AdvisorIntakeRecorded`, `AdvisorMessageClosed` |
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

### 7.3 Alert

`OPEN -> ACKNOWLEDGED -> SNOOZED -> OPEN | RESOLVED`.
`OPEN` or `ACKNOWLEDGED` may resolve directly. `SUPPRESSED` is allowed only for a
documented deterministic suppression rule and expires to `OPEN` if the condition
persists. Severity (`INFO`, `WARNING`, `CRITICAL`) is a field, not a state.
Acknowledgement never resolves the underlying condition.

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

### 8.1 Browser command

`SubmitAdvisorMessage` contains only:

```text
requestId, missionId, manifestVersion,
kind: NOTE | QUESTION | DECISION_INPUT | SCOPE_REQUEST | ACKNOWLEDGEMENT,
subject, bodyText, referencedEntityIds[], clientCreatedAt
```

There is no `targetRole`, `targetSession`, `pane`, `command`, `shell`, `argv`,
`reviewer`, or `worker` field. Unknown fields are rejected.

### 8.2 Immutable message artifact

After validation, the server builds canonical JSON containing the accepted fields,
authenticated subject reference, `receivedAt`, and content hash. It writes with
create-exclusive semantics at:

```text
artifacts/inbox/<missionId>/<requestId>/<payloadSha256>.json
```

Only after file and directory durability does it append
`AdvisorMessagePersisted`. The HTTP acknowledgement includes:

```text
requestId, messageId, artifactRef, artifactHash,
eventId, missionSequence, acceptedAt, status=PERSISTED
```

A retry with the same `requestId` and same payload hash returns byte-equivalent
receipt fields. Same ID/different hash returns `409 IDEMPOTENCY_KEY_REUSED`.

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
          BLOCKED | WAITING_LEO | RESULT_RETURN | RECOVERY,
reasonCode, sourceEventIds[], effectiveFrom, optionalExpiresAt
```

Activity must be caused by an accepted structured event or an explicit Advisor
observation record. It cannot be inferred from words in a pane, CPU usage,
process title, animation state, or elapsed time. Expiry returns the visual to
`IDLE` or the WorkUnit-derived blocking state without creating a domain event.

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
| AO-DOM-001 Manifest hierarchy/counting/scope change | `src/domain/manifest/` | `tests/domain/manifest.test.ts`, `tests/property/scope-counting.test.ts` | `NOT_IMPLEMENTED`; Sections 3 and 6 | `DESIGNED_CANDIDATE` | Fable5 design PASS, Batch A |
| AO-DOM-002 Event envelope/hash chain/order/causality | `src/domain/events/`, `src/persistence/file-store/` | `tests/domain/event-envelope.test.ts`, `tests/persistence/hash-chain.test.ts` | `NOT_IMPLEMENTED`; Sections 4-5, 10 | `DESIGNED_CANDIDATE` | Batch A |
| AO-DOM-003 Complete entity state machines and invalid-transition handling | `src/domain/state-machines/` | `tests/domain/transitions.test.ts`, `tests/property/transition-matrix.test.ts` | `NOT_IMPLEMENTED`; Sections 6-9 | `DESIGNED_CANDIDATE` | Batch A |
| AO-DOM-004 Idempotent Advisor message/intake/decision/resume | `src/application/advisor-inbox/`, `src/domain/decisions/` | `tests/integration/advisor-message-flow.test.ts` | `NOT_IMPLEMENTED`; Sections 7-10 | `DESIGNED_CANDIDATE` | Batch D |
| AO-DOM-005 Deterministic projection and evidence completion | `src/application/projections/`, `src/application/evidence/` | `tests/persistence/replay.test.ts`, `tests/domain/completion-policy.test.ts` | `NOT_IMPLEMENTED`; Sections 11-12 | `DESIGNED_CANDIDATE` | Batches A-D |
| AO-DOM-006 Structured-event-only activity | `src/domain/activity/` | `tests/domain/activity-source.test.ts` | `NOT_IMPLEMENTED`; Section 13 | `DESIGNED_CANDIDATE` | Batch C |

The cross-document matrix in `docs/FEATURE_INDEX.md` is authoritative for package
discoverability and links these contract IDs to the remaining security, gateway,
UI, and operations requirements.
