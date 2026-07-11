# Agent Office Operations and Recovery Design

Status: `REVIEWED_DESIGN__BATCH_A_B_ACCEPTED__BATCH_C_PRESENTATION_IMPLEMENTED`

This design defines local durability, failure handling, restart, corruption
quarantine, backup, restore, rollback, disable, and proof-of-recovery behavior.
Batch A implements the local state-root, ledger, immutable-artifact,
checkpoint/projection, and startup/replay primitives at code commit
`7edc8f79bedb059ab6697e64ddaf57fbebde2c87` and is Advisor-accepted. Batch B adds
only local read-only observation/freshness/dashboard behavior at code commit
`85e66d856e33a0df73041cb4b33aba30a8f9f96d`. Backup, restore, service operation,
credentials, deployment, and live/private operation remain unimplemented.

Batch C code commit `e30a6cda52e14a4bf30b2d1b7445fa26645496e5`
adds only a presentation-side recovery/staleness scene. Its recovery step count,
read-only label, blocker/decision overlays, cue expiry, and visibility state do
not call the state root, append an event, resolve a blocker, or re-enable any
operation.

## 1. Operating Model

M01 is a single-instance private service on one local Linux host:

- loopback bind by default;
- one process and one append writer per state root;
- local filesystem only, not NFS/shared/network storage;
- no DB, replication, leader election, production cluster, or public ingress;
- read-only observation of allowlisted repositories/tmux/host metadata;
- typed immutable inbox and event writes under the Agent Office state root; and
- fixed Advisor delivery with explicit kill-switch/manual fallback.

Future private-network/remote-host/Mac capabilities do not change the controller's
single-writer authority and remain separately gated.

### 1.1 Batch A as-built boundary

- `src/persistence/file-store/path-safety.ts` explicitly initializes and validates
  an owner-only local state root with a versioned `FORMAT.json` marker.
- `writer-lock.ts` uses create-exclusive OS-mediated lock-file ownership with
  PID/boot/build/root metadata; a second writer fails closed, and stale recovery
  requires explicit operator authorization and preserves the prior lock in
  quarantine.
- `artifact-store.ts` uses content addressing, create-exclusive writes,
  descriptor verification, owner-only modes, no-follow checks, file and directory
  fsync, and idempotent same-byte reuse.
- `event-store.ts` implements append-only hash-chained JSONL segments, request
  replay/conflict across restart, expected stream/manifest versions, rotation,
  incomplete-tail preservation/recovery, and durable midstream quarantine.
- `checkpoint-store.ts`, `projection-store.ts`, and
  `src/application/startup/recovery.ts` implement atomic publication, verified
  checkpoint use/fallback, genesis equivalence, and deterministic restart replay.
- `tests/recovery/` plus persistence/acceptance tests pass in the 36-test Batch A
  suite. No real state root, backup, secret, DB, network, or service was used.

### 1.2 Batch B as-built boundary

- Observation reads are outside the Agent Office writable state root and are
  strictly bounded, no-follow, containment-checked, and regular-file-only.
- Direct child-tool reads have fixed operation unions, executable paths, cwd,
  timeouts, combined output caps, and a no-shell environment. Timeout/cap/tool
  failures are stable typed errors and raw stderr is not exposed to the UI.
- Local observations retain source/receipt/policy/evidence identity. The pure
  freshness projection distinguishes current/stale/offline/unknown/conflict/error
  and survives restart without changing its stored durable value.
- Stale/nonverified observations fail the exported completion-eligibility check;
  the dashboard shows the last typed status but never appends a domain event or
  resumes/completes a WorkUnit.
- The static Vite dashboard is a build artifact and optional loopback development
  preview only. No service process, listener authority, persistence writer,
  gateway, PWA cache, backup, restore, or deployment operation was added.
- The full 23-file/84-test suite, production builds, audit, diff check, and bounded
  real read-only Git/tmux smoke pass at the Batch B code commit.

### 1.3 Batch C as-built presentation boundary

- `src/ui/scene/state-machine.ts` treats `RECOVERY` as a bounded structured-step
  overlay with exact event provenance and safety precedence; it has no
  persistence or operation port.
- Stale/offline/conflict/error/unaccepted scene inputs immediately select
  `UNKNOWN_OR_STALE`, preserve the last accepted state as text, and suppress all
  motion. A fresh fixture cannot resume a WorkUnit or resolve a blocker.
- Initial load, reload, and tab resume queue no presentation cue. Page visibility
  pauses CSS animation, and resume renders the current projection without replay.
- Batch C regression/browser tests pass without creating a state root, running a
  recovery operation, or mutating observed repositories/tmux.

## 2. Durability Objectives

- An acknowledged accepted command has zero designed data loss on a correctly
  functioning local filesystem: its immutable artifact (if any) and event have
  been flushed before acknowledgement.
- An unacknowledged command may be absent or durably present after crash. The
  mandatory request ID makes retry safe and discoverable.
- Projections, indexes, and checkpoints may lag or be lost; replay reconstructs
  them from verified manifests/events/artifacts.
- Corruption is detected and quarantined, never silently ignored or rewritten.
- Recovery prioritizes evidence integrity and read-only availability over write
  availability.
- No recovery step sends role input, changes mission authority, accepts risk,
  resolves a blocker, or starts a next mission automatically.

No wall-clock RTO or backup-retention business commitment is invented here.
Recovery tests record elapsed time and bytes/events replayed so Advisor/Leo can set
future objectives from evidence.

## 3. State-Root Requirements

The configured state root must:

- be absolute, outside the Git worktree and static web root;
- be owned by the service OS user and not group/world writable;
- reside on a local filesystem with documented atomic rename and file/directory
  fsync behavior;
- reject symlinked root/critical subdirectories, special files, and ownership/mode
  mismatch;
- have free-space and inode preflight thresholds; and
- contain a format/version marker before mutation is enabled.

Startup never creates or modifies a DB. A missing state root may be initialized
only by an explicit initialization mode under an implementation handoff, with an
immutable initialization receipt.

## 4. Single-Writer and Locking

1. Startup opens an owner-only writer lock file and acquires an exclusive
   nonblocking OS lock.
2. Lock metadata records process ID, boot ID, executable/build ID, state-root ID,
   and acquired time for diagnostics only.
3. Failure to acquire returns `SECOND_WRITER_DETECTED` and starts no HTTP mutation
   surface.
4. A stale-looking metadata file is not authority to break a live OS lock.
5. Lock override/break requires the process to be stopped, ownership verified,
   an explicit operator action, and an audit/recovery receipt.

Collectors and HTTP handlers never open stream files for append. They send typed
commands to the in-process writer queue, which is bounded and applies backpressure.

## 5. Durable Write Protocols

### 5.1 Immutable artifact before event

For a message, decision, evidence copy, or receipt:

1. Validate schema, size, containment, and canonical hash in memory.
2. Create a temporary file in the destination directory with owner-only mode and
   create-exclusive semantics.
3. Write exact bytes and flush the file.
4. Verify byte count/hash from the open descriptor.
5. Atomically link/rename to the content-addressed final name without overwrite.
6. Flush the containing directory.
7. Append the referencing event using Section 5.2.
8. Return acknowledgement only after the event is durable.

If the artifact already exists with the same hash, it is reused idempotently. Same
identity/different bytes is corruption/idempotency conflict and no event appends.
An orphan artifact created before a crash is harmless, reported by audit, and
retained/quarantined according to an explicit later cleanup policy; it never
becomes state without an event.

### 5.2 Event append

1. Verify current stream sequence/hash and expected version.
2. Serialize one canonical event with hash chain and terminating newline.
3. Append using one writer operation where supported; reject oversize event before
   append.
4. Flush file data before acknowledgement.
5. Update the in-memory last-sequence/hash only after flush succeeds.
6. If a segment threshold is reached, close/flush it, write a hashed segment
   manifest, flush the directory, and open the next numbered segment.

The exact segment size is an implementation constant selected/tested in Batch A;
it is not derived from request input. No accepted line is edited in place.

### 5.3 Projection/checkpoint publication

1. Fold verified events into an in-memory candidate projection.
2. Serialize canonical projection content plus source sequence/hash.
3. Write/flush a same-directory temporary file.
4. Atomically rename it over the rebuildable projection file.
5. Flush the projection directory.
6. Publish the new revision to queries/SSE.

Projection publication failure does not roll back a durable event. The service
stops mutation, reports projection lag, and rebuilds. An acknowledgement can cite
the event receipt even if the query projection has not yet published.

Indexes and checkpoints use the same temp/flush/rename/directory-flush pattern and
always include the source event sequence/hash. They are discarded on mismatch.

## 6. Startup and Restart State Machine

Startup phases are explicit and observable:

```text
STARTING
  -> CONFIG_VALIDATING
  -> LOCK_ACQUIRING
  -> STORE_VERIFYING
  -> REPLAYING
  -> ADAPTER_PREFLIGHT
  -> READ_ONLY_READY
  -> MUTATION_READY
```

Failure enters one of:

- `CONFIG_BLOCKED`
- `SECOND_WRITER_BLOCKED`
- `STORE_QUARANTINED`
- `REPLAY_FAILED`
- `AUTH_BLOCKED`
- `READ_ONLY_DEGRADED`

Restart verification:

1. Validate state-root ownership/mode/format and acquire lock.
2. Verify manifest source hashes and every closed segment manifest/hash chain.
3. Scan the active segment to the last complete newline and validate every event.
4. Classify any invalid tail or corruption before serving.
5. Load a checkpoint only if schema, sequence, event hash, and projection hash
   match; otherwise replay from genesis.
6. Rebuild idempotency/evidence/message/alert indexes.
7. Compare a replayed projection hash with any stored snapshot.
8. Start read-only queries only after a verified projection exists.
9. Enable mutations only after auth/security and required writer dependencies pass.
10. Enable Advisor delivery separately and only after current transport preflight.

No queued notification is assumed delivered. Durable receipt lookup decides
whether to retry, require manual fallback, or await acknowledgement.

## 7. Crash-Consistency Matrix

| Crash point | Expected restart state | Recovery behavior |
|---|---|---|
| Before artifact create | No artifact/event | Same request can execute normally |
| During artifact temp write | Temp/orphan only | Hash/age scan quarantines temp; no domain state |
| After final artifact, before event append | Orphan immutable artifact | Same request/hash reuses artifact and appends event; different hash conflicts |
| During event line append before flush | Missing or incomplete final line, never acknowledged | Preserve original bytes, classify tail, recover verified prefix under tail procedure |
| After event flush, before HTTP ack | Durable event, client uncertain | Same request/hash returns original receipt after replay |
| After event, before projection rename | Durable event, stale projection | Replay/publish projection; no duplicate event |
| During projection temp/rename | Old or new complete snapshot | Verify source sequence/hash; rebuild if mismatch |
| After notification queued, before send | Durable queue item | Receipt lookup then bounded delivery/manual fallback |
| After send, before receipt persisted | Ambiguous external delivery | Never blindly resend; mark ambiguous/manual fallback and require Advisor reconciliation |
| During backup | Backup marked incomplete | Never eligible for restore; create a new checkpoint backup |

## 8. Corruption Detection and Quarantine

### 8.1 Detectors

- invalid UTF-8/JSON/schema;
- missing newline or partial tail;
- noncontiguous sequence;
- event/payload/previous hash mismatch;
- unknown major schema version;
- segment manifest/hash mismatch;
- artifact missing/hash/type/containment mismatch;
- projection/checkpoint source mismatch;
- manifest source commit/hash/count/dependency mismatch; and
- duplicate request/event identity with different content.

### 8.2 Tail truncation versus midstream corruption

An incomplete active-segment tail can occur before acknowledgement. Recovery does
not edit the original file. It:

1. disables mutation and copies/links the original segment plus metadata to a
   content-addressed quarantine directory;
2. verifies the prefix through the last valid newline;
3. creates a new replacement active segment from that verified prefix with a
   recovery provenance manifest;
4. flushes files/directories and records `RecoveryCompleted` in the next segment;
5. replays and compares deterministic projection; and
6. requires an Advisor-visible recovery proof before writes re-enable.

Midstream/hash-chain/schema corruption is never auto-repaired or skipped. The
store remains `STORE_QUARANTINED` and read-only from the last independently
verified backup/projection if safe. Restore or a separately reviewed forensic
reconstruction is required.

### 8.3 Artifact/evidence corruption

The projector marks referenced evidence `INVALID`, raises a critical alert, and
prevents new completion. If completed state depended on that evidence, Advisor may
record `WorkUnitCompletionRevoked -> HOLD`; the service does not do so silently.
No corrupt artifact is deleted automatically.

## 9. Failure and Degradation Matrix

| Failure | User-visible state | Mutation behavior | Recovery/fallback |
|---|---|---|---|
| Disk full/inode exhaustion | Critical storage alert | Stop before partial write; `503 STORE_UNAVAILABLE` | Free/extend storage under operator authority, verify/replay, explicit re-enable |
| Writer lock conflict | Second-writer alert | Disabled | Stop duplicate process or investigate; never break live lock automatically |
| Event/hash corruption | Quarantine banner | Disabled | Preserve bytes, restore/forensic path |
| Projection crash/mismatch | Projection rebuilding/stale | Disabled until deterministic rebuild | Replay from verified checkpoint/genesis |
| Manifest source unavailable/changed | Authority source stale/conflict | Scope/completion mutations disabled | Restore exact commit/path/hash or Advisor resolves |
| Git/artifact adapter timeout | Evidence stale | Completion blocked; other safe writes may continue | Retry bounded read; no shell/alternate root |
| tmux observation unavailable | Session observation stale | No inferred state; domain writes unaffected | Manual evidence; adapter retry |
| Transport inactive/kill switch | Manual fallback required | Inbox persistence continues; delivery disabled | Canonical revalidation, no auto re-enable |
| Ambiguous delivery receipt | Delivery ambiguous | No blind resend | Advisor reconciles and records receipt/ack |
| Auth provider unavailable | Auth blocked | Mutations disabled; health redacted | Restore approved provider/config |
| SSE disconnect | Offline/reconnecting banner | POST remains independently idempotent if online | Resume by cursor or full snapshot reset |
| Remote host offline/gapped | Host/evidence stale | Remote evidence cannot complete | Reconnect/sequence reconciliation |
| Clock skew critical | Clock alert | Source time non-authoritative; completion needing fresh remote evidence blocked | Fix clock/trust and accept new structured observation |
| Service worker bad cache | Update/recovery banner | Server unaffected | Unregister/reload app shell; no server data deletion |

## 10. Stale State and Conflict Handling

Freshness is computed from explicit policy, source receipt, evaluation time, and
clock quality. It is never guessed from terminal activity.

- UI shows last verified time, source host/commit/hash, and stale reason.
- Stale Git/session/host evidence cannot satisfy a new completion check.
- Immutable artifacts remain valid until source/hash/commit changes or an explicit
  policy invalidates them.
- Conflicting high/low-precedence sources create a conflict alert and block the
  affected transition.
- Reconnection does not erase the stale interval; events preserve offline/gap
  history.
- A fresh observation clears only the freshness overlay; it does not resume a
  WorkUnit or resolve a blocker without a domain event.

## 11. Backup Design

### 11.1 Consistent checkpoint backup

An operator-authorized backup flow:

1. enters `BACKUP_BARRIER`, rejecting or draining new mutations;
2. flushes/rotates active event and audit segments;
3. writes a projection/checkpoint at exact sequence/hash;
4. snapshots manifests, closed event/audit segments, immutable artifacts,
   checkpoint, configuration descriptors excluding secrets, and build/schema IDs;
5. writes a backup manifest listing every relative path, size, mode class, and
   SHA-256 plus source sequence/event hash;
6. flushes the backup tree and marks it complete atomically; and
7. exits the barrier with an immutable operation receipt.

Incomplete backups are never restore candidates. Backup destination must be local
and owner-controlled in M01. Off-host/cloud backup, encryption key management,
schedule, retention, and automatic deletion require later authority and design.

### 11.2 Backup confidentiality

Backups contain messages/decisions/audit metadata and are sensitive. They are not
placed in Git, web roots, shared temp directories, or public storage. The backup
manifest contains hashes, not credential values. If encryption is later required,
key provisioning/rotation/recovery is a separate secret-handling gate.

## 12. Restore Design

Restore never overlays the active state root in place:

1. Stop mutation/delivery and preserve current root.
2. Copy backup into a new isolated candidate root.
3. Verify completion marker, path containment, modes, every file hash, segment
   chain, manifest source, and supported schema/build compatibility.
4. Replay from genesis/checkpoint and produce canonical projection hash/counts.
5. Compare backup-declared sequence/hash/projection with replay.
6. Run read-only smoke checks and synthetic no-secret acceptance fixtures.
7. Atomically select the restored root only while the service is stopped.
8. Start in read-only mode, verify UI/evidence, then explicitly enable mutations.
9. Enable Advisor delivery only after separate transport revalidation.
10. Record restore receipt with backup ID, old/new root IDs, hashes, operator,
    times, checks, and outcome.

Failed validation leaves both roots untouched, keeps quarantine/read-only mode,
and emits no success receipt.

## 13. Application Rollback and Data Compatibility

Application rollback is separate from data restore:

- Build metadata declares readable/writable event, manifest, projection, and
  artifact schema versions.
- Startup with an older build that cannot read the current ledger fails before
  mutation; it never down-converts in place.
- Projection-only code can be rolled back by rebuilding projections if event
  compatibility is proven.
- A write-schema change requires forward/backward fixtures, upgrade/rollback
  design, backup, and a separately reviewed handoff.
- Rollback selects a previously verified build/commit and re-runs startup/replay
  checks against a copy or compatible active state.
- Git rollback, protected-branch changes, deployment, or process termination are
  not authorized by this design document.

## 14. Disable and Safe Modes

Independent fail-closed controls:

| Control | Effect | Does not do |
|---|---|---|
| `mutation disabled` | Serves verified read-only projections; rejects commands | Delete data, mark failure, stop process automatically |
| `Advisor delivery disabled` | Persists inbox; routes notifications to manual fallback | Disable message storage or clear canonical transport kill switch |
| `observation adapter disabled` | Marks source stale; no new observation | Change WorkUnit state |
| `SSE disabled/degraded` | Browser polls verified snapshots with backoff or shows offline | Enable WebSocket or lose event ledger |
| `store quarantine` | Stops mutation and unverified reads | Auto-repair/delete corruption |
| external transport kill switch | Stops new tmux delivery under canonical authority | Terminate sessions/processes or undo work |

Controls are explicit configuration/operation actions, audited, visible, and never
auto-reenabled on a timer.

## 15. Observability Without Secrets

Health endpoints are split:

- liveness: process event loop only, no sensitive detail;
- readiness: store/projection/auth mode/bind class, redacted failure codes;
- detailed local operator health: authenticated, exact component versions,
  sequence/hash prefixes, queue depth, disk threshold state, adapter freshness,
  gateway/kill-switch/manual-fallback status.

Metrics/logs use IDs, counts, durations, states, and stable codes. They exclude
message bodies, artifact contents, cookies, CSRF/auth values, environment values,
terminal content, and key material. Correlation IDs link HTTP/audit/domain/gateway
receipts. Raw stderr from child tools is capped, redacted, and not browser-visible.

## 16. Proof of Recovery

No recovery is complete from a green UI alone. The durable recovery result must
include:

- incident/recovery ID, actor, exact build/commit, state-root ID, and mode;
- failure classification and STOP/authority route;
- preserved/quarantined path hashes;
- backup/checkpoint/segment/event/artifact hashes and source sequence;
- commands or test harness steps performed, with concise results;
- replay event count, first/last sequence/hash, and deterministic projection hash;
- idempotency retry checks across the crash boundary;
- manifest denominator, WorkUnit states, open blockers/decisions/alerts before and
  after;
- read-only startup, mutation re-enable, and separate gateway re-enable receipts;
- unchanged forbidden scope and absence of secret/DB/public/prod access;
- elapsed times as evidence, without claiming an unapproved SLA; and
- Advisor audit route plus required Fable5/Leo decision where risk or design
  divergence exists.

## 17. Recovery and Operations Tests

### Batch A

- property/replay equivalence from genesis and checkpoints;
- kill at every artifact/event/projection fsync boundary;
- same-request retry after durable-event/before-ack crash;
- incomplete tail, orphan artifact, segment rotation, disk full, inode exhaustion,
  writer lock, hash chain, schema version, and projection mismatch;
- proof no acknowledged event is lost in the supported local filesystem fixture.

### Batch D

- notification queued/sent/receipt crash points;
- ambiguous receipt produces manual fallback and no blind resend;
- kill-switch/inactive transport persists messages without delivery loss.

### Batch E

- startup state/failure modes, read-only/quarantine UI, and adapter staleness;
- complete backup manifest, intentionally incomplete backup rejection;
- isolated restore, tampered backup/path/mode/hash/schema rejection;
- replay/projection equivalence and idempotency after restore;
- compatible application rollback and incompatible write-build fail-closed;
- service-worker unregister/update recovery; and
- evidence-bearing recovery result generation.

All tests use disposable local fixtures and synthetic canary data. No real secret,
DB, production/live system, remote host, protected branch, or public service is
accessed.

## 18. Local Traceability

| DESIGN_REQUIREMENT | IMPLEMENTATION_PATH | TEST_PATH | CURRENT_EVIDENCE | STATUS | DEFERRED_GATE |
|---|---|---|---|---|---|
| AO-OPS-001 Single-writer durable artifact/event/projection protocol | `src/persistence/file-store/` | `tests/recovery/crash-consistency.test.ts`, `tests/persistence/hash-chain.test.ts` | Commit `7edc8f79bedb059ab6697e64ddaf57fbebde2c87`; owner-only init, writer exclusion/stale recovery, artifact/event durability, rotation, and hash-chain tests pass; Advisor accepted Batch A | `IMPLEMENTED_BATCH_A__ADVISOR_ACCEPTED` | Backup/restore remains Batch E |
| AO-OPS-002 Restart/idempotent recovery | `src/application/startup/recovery.ts`, `src/persistence/file-store/event-store.ts`, `src/persistence/file-store/checkpoint-store.ts` | `tests/recovery/restart-replay.test.ts`, `tests/recovery/crash-consistency.test.ts` | Same-request replay/conflict, event-before-projection rebuild, verified checkpoint, and invalid-checkpoint genesis fallback pass; Advisor accepted Batch A | `IMPLEMENTED_BATCH_A__ADVISOR_ACCEPTED` | Service recovery remains Batch E |
| AO-OPS-003 Corruption quarantine and stale/conflict handling | `src/persistence/file-store/`, `src/application/hosts/freshness.ts`, `src/application/queries/dashboard-view-model.ts`, `src/ui/scene/state-machine.ts` | `tests/recovery/corruption-quarantine.test.ts`, `tests/integration/project-freshness.test.ts`, `tests/ui/activity-mapping.test.ts`, `tests/ui/office-scene.component.test.tsx` | Batch A quarantine and Batch B local freshness are accepted; Batch C fail-closed suppression and visibility/reload/resume behavior pass at `e30a6cda52e14a4bf30b2d1b7445fa26645496e5` | `IMPLEMENTED_BATCH_C_LOCAL_OVERLAY__PENDING_ADVISOR_ACCEPTANCE` | Remote/service recovery remains Batch E |
| AO-OPS-004 Backup/restore proof | `src/operations/backup/`, `src/operations/restore/` | `tests/recovery/backup-restore.test.ts` | `NOT_IMPLEMENTED`; Sections 11-12, 16 | `DESIGNED_CANDIDATE` | Batch E; off-host/encryption gated |
| AO-OPS-005 Rollback/disable/kill-switch/manual fallback | `src/operations/`, `src/adapters/gateways/` | `tests/recovery/rollback-disable.test.ts` | `NOT_IMPLEMENTED`; Sections 13-14 | `DESIGNED_CANDIDATE` | Batch E; external transport remains canonical |
| AO-OPS-006 Redacted health/observability | `src/server/health/`, `src/application/audit/` | `tests/security/observability-redaction.test.ts` | `NOT_IMPLEMENTED`; Section 15 | `DESIGNED_CANDIDATE` | Batch E |

Cross-document traceability is indexed in `docs/FEATURE_INDEX.md`.
