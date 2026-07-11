# Agent Office Operations and Recovery Design

Status: `LOCAL_BOOTSTRAP_PRIVATE_RUN_GATE_IMPLEMENTED__REAL_RUN_PENDING_FABLE5_AND_ADVISOR`

This design defines local durability, failure handling, restart, corruption
quarantine, backup, restore, rollback, disable, and proof-of-recovery behavior.
Batch A implements the local state-root, ledger, immutable-artifact,
checkpoint/projection, and startup/replay primitives at code commit
`7edc8f79bedb059ab6697e64ddaf57fbebde2c87` and is Advisor-accepted. Batch B adds
only local read-only observation/freshness/dashboard behavior at code commit
`85e66d856e33a0df73041cb4b33aba30a8f9f96d`.

Batch C code commit `e30a6cda52e14a4bf30b2d1b7445fa26645496e5`
adds only a presentation-side recovery/staleness scene. Its recovery step count,
read-only label, blocker/decision overlays, cue expiry, and visibility state do
not call the state root, append an event, resolve a blocker, or re-enable any
operation.

Advisor accepted Batch C as the Batch D dependency. Batch D code commit
`7366036f8a1e6fc9d4e911e8d193e17eeb95f54c` adds only the authorized local
durable Advisor message/outbox/receipt/acknowledgement/intake/decision/resume and
alert application. It does not implement service backup/restore, deployment,
credentials, HTTP, PWA, remote recovery, or live transport operation.

Advisor accepted Batch D as the Batch E dependency. Batch E implements the local
disposable-fixture backup/restore/compatibility/readiness/delivery-disable/
recovery-proof boundary at
`e0a11f69fffc9d35d67cc478cbefbb92d93cf528`. Actual deployment, real-root
operation, credentials, remote recovery, off-host/encrypted/scheduled backup,
retention, and live transport operation remain unimplemented and gated.
Final rework commit `0f90e39d3995ffca97eb7a05ef051d8f9a3719c1`
adds the executable local composition and directly verified listener/writer-lock
cleanup without touching a real root, credential, deployment, or transport.
Final rework round 2 commit `10fdee75dca73c4fb5cde09019c403d4dc1682bb`
adds fail-closed operational authority import, periodic read-only observation
refresh, restart/partial-failure isolation, observation-driven SSE revision,
durable alert/scene projection, and injected Advisor gateway recovery. Every test
uses explicit synthetic or disposable inputs. Real-root supervision, provider,
delivery activation, tmux input, and deployment remain gated.
Operational config mode patch commit
`ae7dd5ea1d92b025dd74b79806a26c086ab76de0` makes the existing owner-controlled
startup claim executable by rejecting group- or other-writable operational
configuration. It changes no runtime composition, recovery state, gateway,
provider, delivery, or network behavior.

LocalBootstrap private-run gate commit
`2623922877bd52dc7f5b6c6cd45fae755e5ff228` makes the previously gated local
provider executable without performing the real run. It adds exact
`127.0.0.1:4317` trusted config, owner-only verifier-backed proof delivery,
actual-canonical-manifest enforcement, login/logout/session lifecycle, and
ordered proof cleanup. No real credential/state root/private server was created;
all operational evidence uses disposable roots and synthetic proofs. Future
preparation is documented in
[`LOCAL_BOOTSTRAP_PRIVATE_RUN_PREPARATION.md`](LOCAL_BOOTSTRAP_PRIVATE_RUN_PREPARATION.md)
and remains blocked on Fable5 code/security `PASS` plus Advisor authority.

## 1. Operating Model

M01 is a single-instance private service on one local Linux host:

- loopback bind by default;
- one process and one append writer per state root;
- local filesystem only, not NFS/shared/network storage;
- no DB, replication, leader election, production cluster, or public ingress;
- read-only observation of allowlisted repositories/tmux/host metadata;
- typed immutable inbox and event writes under the Agent Office state root; and
- fixed Advisor delivery with explicit kill-switch/manual fallback.
- default no-provider read-only startup, with an explicit narrower
  LocalBootstrap loopback mode only under trusted configuration.

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
- Batch C visual verification is a test-only local-runtime operation. Commit
  `243d3a5731a6b22c29caeaba6567aed505f78d59` normalizes Playwright,
  Chromium, and the loopback Vite server to `ko_KR.UTF-8`; the ordinary 10-test
  command passes from both `C.UTF-8` and `ko_KR.UTF-8` callers. The installed
  Korean locale plus configured local browser/font root remain host
  prerequisites. Batch E reverified all three regenerated status-strip baselines
  under that configured runtime but makes no cross-host/browser/font portability
  claim. No product or service process locale is changed.

### 1.4 Batch D as-built durability boundary

- `ImmutableArtifactStore.putScopedCanonicalJson` confines generated paths below
  `artifacts/<kind>/<identity...>/<sha>.json`, enforces one immutable byte
  identity, owner-only/no-follow/create-exclusive writes, byte bounds,
  descriptor hash verification, file fsync, link, and directory fsync.
- `AdvisorInboxService` writes the message artifact before the persisted event,
  derives its outbox from durable events, and writes gateway receipts before
  notification/message terminal events. Separate scoped artifacts back
  acknowledgement, intake, decision link, alert detail, and ResumeProof.
- Startup reconstruction completes a message-queued/outbox-missing crash. A
  `DELIVERING` notification performs receipt lookup only; missing/ambiguous
  receipt records `FAILED -> MANUAL_FALLBACK_REQUIRED` and no blind resend.
- Disposable tests cover orphan artifact, durable event before observed receipt,
  partial outbox, and started delivery without receipt. No real state root,
  observed repository, tmux input, process, network, or live data is used.

### 1.5 Batch E as-built operations boundary

Commit `e0a11f69fffc9d35d67cc478cbefbb92d93cf528` adds `src/operations/` and extends
the owner-only state-root layout with `audit/` and `backups/`:

- backup requires the writer lock to be absent, scans only regular owner-owned
  `0700`/`0600` entries, requires an exact projection/checkpoint/idempotency/event
  checkpoint, writes hashes/schema/build/source sequence, and publishes
  `COMPLETE.json` last;
- restore rejects incomplete/schema/path/mode/hash/build violations before use,
  creates only a new owner-controlled candidate outside both active and backup
  roots, replays/verifies projection/hash/idempotency, and returns
  `selected: false`; explicit stopped-service selection remains a separate plan;
- compatibility classification permits mutation only for a stopped,
  read-write-compatible build and never performs destructive downgrade;
- `DurableDeliveryControl` defaults off and durably replays/conflicts disable
  requests; readiness exposes config/lock/store/replay/auth/SSE/delivery modes
  without automatic re-enable; and
- `writeRecoveryResult` creates an immutable proof with build/commit, hashes,
  replay/idempotency, before/after denominator states, control receipts, elapsed
  steps, forbidden scope, and Advisor review route.

All recovery tests use disposable owner-only roots. No active/real root,
off-host/cloud target, encryption key, schedule, retention action, deployment,
Git rollback, process termination, or real transport state is touched.

### 1.6 Final executable-runtime round-2 as-built boundary

- `npm run start:loopback -- --state-root <absolute-path> --runtime-config
  <absolute-path>` invokes compiled `src/runtime/cli.ts`; neither writable state
  nor manifest/observation authority has an implicit fallback.
- The CLI loads an absolute owner-owned no-follow bounded UTF-8 JSON deployment
  descriptor plus an owner-owned no-follow bounded versioned operational config.
  The operational config must be a regular file with `(mode & 0o022) === 0`;
  owner-controlled `0400` and `0600` are accepted, while any group/other write
  bit blocks startup. Composition validates application/static/observed
  directories, disjoint state root, exact loopback binds/Host allowlist, and a
  Git-VERIFIED registered external manifest before opening the writer.
- `src/runtime/composition-core.ts` opens one event-store writer, artifact store,
  security audit, default-off delivery control, injected `TmuxAdvisorGateway`,
  inbox, alerts, observation coordinator, application/scene projection, SSE
  broker, and built static shell in one process. It does not instantiate Hermes.
  The production wrapper injects no session provider, real delivery port, or
  decision-authority registration.
- Startup therefore reports `AUTH_BLOCKED`, `UNAVAILABLE_READ_ONLY`, and mutation
  `DISABLED`; only shell/liveness/readiness/status are unauthenticated. Protected
  projection, SSE, messages, lifecycle, alerts, and delivery control fail closed.
- Shutdown closes all listeners/SSE before closing the event store and releasing
  `locks/writer.lock`. Partial startup unwinds listeners and the writer in the
  same order.
- `scripts/runtime-smoke.mjs` uses a disposable initialized root and ephemeral
  loopback port, serves the production build, verifies no synthetic fixture in
  its asset, supplies explicit trusted test manifest inputs, proves no CLI fixture
  fallback and manual delivery without provider, requires exact auth/projection
  denial, closes the composition, then requires same-port rebind and absent writer
  lock.

### 1.7 LocalBootstrap private-run gate as-built boundary

- Deployment v2 is selected only from an absolute owner-controlled no-follow
  file. Its exact mode is `LOCAL_BOOTSTRAP` / `ENABLED_LOCAL_BOOTSTRAP`, one bind
  and Host `127.0.0.1:4317`, with CORS/proxy/TLS/HSTS false. The committed v1
  descriptor remains no-provider/read-only.
- Before store/listener startup, production requires the current canonical
  foundation-docs M01 source/root/Git correspondence and rejects fixture or
  alternate authority. It also rejects gateway capability/delivery-port
  injection and overlapping proof/application/state/static/observed roots.
- Authentication startup exclusively creates a bounded `0600` regular proof
  file in a canonical owner/UID directory with group/other bits clear and owner
  write/execute (the runbook uses `0700`), then fsyncs file and parent. A
  pre-existing regular/symlink/special file, insecure directory, owner/mode
  mismatch, or stale crash output fails startup without overwrite.
- Provider state retains only salted verifier bytes. Success consumes/removes
  the exact inode; expiry and orderly shutdown remove it; replay rejects. A crash
  may leave an ambiguous file, and restart intentionally fails until an
  authorized local operator removes it without displaying/reusing the value.
- The process does not mint another proof after consumption/expiry. A fresh proof
  requires a clean restart, preventing recovery from resurrecting authority.
- Shutdown closes listeners/SSE first, closes provider sessions and pending proof,
  then releases the writer. Partial startup performs the same cleanup.
- `LOCAL_BOOTSTRAP_READY` plus configured sessions reports
  `MUTATION_READY`/`ENABLED_LOCAL_BOOTSTRAP`; delivery independently stays
  `MANUAL_FALLBACK_REQUIRED`.

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

The executable composition realizes both explicit safe branches. Committed v1
no-provider config validates roots/manifest/store and stops at `AUTH_BLOCKED`
with mutation disabled. Trusted v2 LocalBootstrap additionally validates the
isolated owner-only proof path, actual canonical authority, and absent delivery
capability/port, creates the proof before binding, and reaches `MUTATION_READY`
only with `LOCAL_BOOTSTRAP_READY` sessions. Any LocalBootstrap validation/startup
failure aborts before listener binding and cleans any exact file it safely owns.
The guarded synthetic composition remains test evidence only.

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
| Transport capability inactive/invalid/stale/kill-switched | Manual fallback required | Inbox persistence continues; delivery and receipt lookup disabled | Canonical revalidation, no auto re-enable |
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
LocalBootstrap additionally excludes proof bytes and proof verifiers from
stdout/stderr, startup/status, URLs/query, argv/environment, response bodies,
cookie values, payload hashes, security audit, state artifacts, static/PWA cache,
browser storage, source, and recovery evidence. The delivery path may be named in
trusted local config/runbook evidence, but its contents never may.

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

At `7366036f8a1e6fc9d4e911e8d193e17eeb95f54c`, with AO-D-R1 correction
`04809004bfd863181f4af8260879f56bc8b6ede6`,
`tests/recovery/advisor-message-crash-consistency.test.ts`,
`tests/persistence/scoped-artifact.test.ts`, and the inbox/gateway integration
tests pass:

- artifact/event/outbox/started-delivery/receipt crash points;
- ambiguous receipt produces durable manual fallback and no blind resend; and
- malformed vocabulary, future issue, exact expiry, kill-switch, inactive,
  stale, and conflicting transport persist messages without delivery loss or
  process side effect; all clock-consuming gateway paths validate UTC time.

### Batch E

- startup state/failure modes, read-only/quarantine UI, and adapter staleness;
- complete backup manifest, intentionally incomplete backup rejection;
- isolated restore, tampered backup/path/mode/hash/schema rejection;
- replay/projection equivalence and idempotency after restore;
- compatible application rollback and incompatible write-build fail-closed;
- service-worker unregister/update recovery; and
- evidence-bearing recovery result generation.

All listed Batch E cases pass in `tests/recovery/backup-restore.test.ts`,
`tests/recovery/rollback-disable.test.ts`,
`tests/recovery/recovery-result.test.ts`,
`tests/operations/readiness.test.ts`, and the PWA/security suites at commit
`e0a11f69fffc9d35d67cc478cbefbb92d93cf528`. The complete gate is 50 Vitest
files/196 tests and 18 Chromium tests.

Final rework additionally passes `tests/integration/runtime-composition.test.ts`
4/4 and the complete 52-file/205-test Vitest plus 18-test Chromium regression.
The disposable production smoke returns shell/asset/status 200,
`AUTH_BLOCKED`/`UNAVAILABLE_READ_ONLY`/`DISABLED`, protected projection 503 with
`AUTH_PROVIDER_UNAVAILABLE`, `listenerRebind=true`, and
`writerLockReleased=true`. Desktop, mobile, and reduced-motion production views
were inspected directly; no committed PNG changed.

Final rework round 2 passes 53 Vitest files/228 tests, 21/21 sequential
Playwright tests, 10/10 composition, and 16/16 observation coordinator cases.
The smoke additionally reports an explicit manifest source ID,
`noFixtureFallback=true`, `MANUAL_FALLBACK_REQUIRED`, auth denial, listener
rebind, and writer-lock release. Three composed application-projection baselines
were added and directly inspected at desktop/mobile/reduced motion for nonblank
rendering, containment, stable stations, honest unknown state, and absent
unverified motion.

Operational config mode patch commit
`ae7dd5ea1d92b025dd74b79806a26c086ab76de0` adds five direct mode cases:
`0400`/`0600` accept and `0620`/`0602`/`0666` reject. The focused coordinator
file passes 21/21, the complete Vitest gate passes 53 files/233 tests, and all
21 sequential Playwright tests, runtime smoke, dependency audit, lint, strict
typecheck, builds, and diff check pass. No generated result directory is tracked
or staged.

LocalBootstrap gate commit
`2623922877bd52dc7f5b6c6cd45fae755e5ff228` passes 55 Vitest files/255 tests and
21/21 sequential Playwright tests. Provider coverage proves owner/mode/no-follow/
special/pre-existing/bounded output, verifier-only state, entropy, single use,
replay, expiry, restart and cleanup. Composition coverage proves actual manifest
v2/no fixture fallback, fixed port 4317, root isolation, manual delivery, restart
fresh proof, and rejection of capability/port injection. Full lint/typecheck/
build, disposable no-provider smoke, zero-high dependency audit, diff and
credential-pattern scans, and direct desktop/mobile/reduced-motion inspection
pass. The smoke intentionally remains the default `AUTH_BLOCKED` branch; no real
LocalBootstrap process is started by that gate.

All tests use disposable local fixtures and synthetic canary data. No real secret,
DB, production/live system, remote host, protected branch, or public service is
accessed.

## 18. Local Traceability

| DESIGN_REQUIREMENT | IMPLEMENTATION_PATH | TEST_PATH | CURRENT_EVIDENCE | STATUS | DEFERRED_GATE |
|---|---|---|---|---|---|
| AO-OPS-001 Single-writer durable artifact/event/projection protocol | `src/persistence/file-store/`, `src/operations/backup/` | `tests/recovery/crash-consistency.test.ts`, `tests/persistence/hash-chain.test.ts`, `tests/recovery/backup-restore.test.ts` | Accepted append protocol remains; backup refuses a live writer and captures only a complete exact checkpoint with modes/hashes/source metadata | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Off-host/real-root operation remains gated |
| AO-OPS-002 Restart/idempotent recovery | `src/runtime/`, `src/application/startup/recovery.ts`, `src/persistence/file-store/`, `src/operations/restore/` | `tests/integration/runtime-composition.test.ts`, `tests/security/local-bootstrap-provider.test.ts`, `tests/recovery/restart-replay.test.ts`, `scripts/runtime-smoke.mjs` | Default restart stays AUTH_BLOCKED/manual; LocalBootstrap success/expiry/shutdown removes exact proof, replay rejects, and restart creates a distinct fresh proof. Ambiguous stale output fails without overwrite | `IMPLEMENTED_LOCAL_BOOTSTRAP_GATE__PENDING_FABLE5_AND_ADVISOR` | Real-root/private-run supervision and restore selection remain gated |
| AO-OPS-003 Corruption quarantine and stale/conflict handling | `src/persistence/file-store/`, `src/runtime/operational-config.ts`, `src/runtime/observation-coordinator.ts`, `src/server/auth/local-bootstrap.ts`, `src/operations/readiness/` | `tests/integration/observation-coordinator.test.ts`, `tests/integration/runtime-composition.test.ts`, `tests/security/local-bootstrap-provider.test.ts`, `tests/recovery/corruption-quarantine.test.ts` | Config/manifest failures block startup; both trusted configs reject group/other write. Proof directory/file symlink, special, stale, owner/mode/identity or overlap failures reject; observed source failures never become CURRENT | `IMPLEMENTED_LOCAL_BOOTSTRAP_GATE__PENDING_FABLE5_AND_ADVISOR` | Remote collectors/service supervision remain gated |
| AO-OPS-004 Backup/restore proof | `src/operations/backup/`, `src/operations/restore/` | `tests/recovery/backup-restore.test.ts` | Complete marker, schema/path/mode/hash/build/tamper checks, disjoint candidate, replay/projection/idempotency equality, and explicit non-selection pass | `IMPLEMENTED_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Off-host/encryption/schedule/retention/real-root operation gated |
| AO-OPS-005 Rollback/disable/kill-switch/manual fallback | `src/runtime/composition.ts`, `src/adapters/gateways/tmux-advisor/`, `src/application/advisor-inbox/`, `src/operations/readiness/delivery-control.ts` | `tests/integration/runtime-composition.test.ts`, `tests/integration/tmux-advisor-gateway.test.ts`, `tests/recovery/rollback-disable.test.ts` | LocalBootstrap composition forbids both gateway capability and delivery port, so every persisted message stays manual with no transport call; existing kill/ambiguous protections remain | `IMPLEMENTED_LOCAL_BOOTSTRAP_GATE__PENDING_FABLE5_AND_ADVISOR` | Real transport activation remains separate and external |
| AO-OPS-006 Redacted health/observability and recovery proof | `src/runtime/`, `src/application/audit/`, `src/server/security/audit.ts`, `src/server/application.ts`, `src/operations/evidence/` | `tests/integration/runtime-composition.test.ts`, `tests/security/local-bootstrap-http.test.ts`, `tests/security/audit-log.test.ts`, `scripts/runtime-smoke.mjs` | Status exposes LocalBootstrap readiness/mutation/manual-delivery only; proof canary scans cover audit, response, URL, state/static/source/committed files and browser stores/cache without disclosure | `IMPLEMENTED_LOCAL_BOOTSTRAP_GATE__PENDING_FABLE5_AND_ADVISOR` | Real-run audit/metrics/retention and Advisor review remain gated |
| AO-OPS-007 Non-secret private-run preparation | `docs/operations/LOCAL_BOOTSTRAP_PRIVATE_RUN_PREPARATION.md`, `src/runtime/cli.ts`, `src/server/config.ts` | `tests/security/private-network-disabled.test.ts`, `tests/integration/runtime-composition.test.ts` | Runbook fixes owner-only outside-Git paths, actual manifest, port 4317, startup/cleanup/stale-file/evidence rules and review gates without creating a credential or run | `DOCUMENTED_LOCAL_BOOTSTRAP_GATE__PENDING_FABLE5_AND_ADVISOR` | Execute only after Fable5 PASS and explicit Advisor authority |

Cross-document traceability is indexed in `docs/FEATURE_INDEX.md`.
