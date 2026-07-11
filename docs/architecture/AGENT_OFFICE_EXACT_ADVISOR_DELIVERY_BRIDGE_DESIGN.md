# Agent Office Exact Advisor Delivery Bridge Design

Status: `DESIGN_PASS__AO_WU_19_IMPLEMENTED_DISABLED__PENDING_FABLE5_IMPLEMENTATION_SECURITY_REVIEW`

Mission: `AGENT_OFFICE_M01_EXACT_ADVISOR_DELIVERY_ACTIVATION`

Governed mission:
`AGENT_OFFICE_M01_ADVISOR_MANAGED_OFFICE_WEB_CONTROL_PLANE`

Design WorkUnit: `AO-WU-17`

Implementation WorkUnit: `AO-WU-19`

Canonical owner: Agent Office repository

## 1. Decision and implementation boundary

Leo/GPT selected
`OPTION_A__OPEN_SEPARATE_EXACT_ADVISOR_DELIVERY_ACTIVATION_MISSION`.
This candidate designs one bridge and nothing else:

```text
immutable Agent Office Leo message artifact
  -> canonical pointer-only envelope
  -> exact existing foundation-advisor/$9/%9 pane
  -> transport receipt (not acknowledgement)
  -> Git-verified structured Advisor acknowledgement/intake/decision/resume evidence
  -> Agent Office durable projection and visible state
```

This file remains the reviewed design, not runtime/rehearsal evidence. At the
reviewed candidate commit `d170880`:

- no delivery activation configuration exists;
- no runtime transport capability exists;
- no production `TmuxPointerDeliveryPort` exists;
- LocalBootstrap still rejects a gateway capability or delivery-port injection;
- no Advisor evidence-ingress adapter exists;
- no server was started and no tmux input was sent; and
- manual fallback remains the only real delivery behavior.

Fable5 Level-3 design review returned `PASS` at foundation-docs commit
`62973c4`. AO-WU-19 subsequently implemented this design with no enabled
descriptor, readiness lease, capability instance, credential, listener, or real
tmux input. Implementation/security review and the actual rehearsal remain
strictly serial AO-WU-20 then AO-WU-21.

## 2. Governing evidence read for this design

The design resolves its questions from the following current evidence rather
than from pane prose or prior chat summaries:

- Leo/GPT Option A decision and exact mission intake under
  `foundation-docs/advisor/jobs/20260711_agent_office_m01_exact_advisor_delivery_activation/`;
- canonical role protocol V2, especially Sections 1, 3, 9, 10, 12A, 14-17,
  and 20;
- active tmux transport `TRANSPORT_PROTOCOL.md`, `ACTIVATION_STATE.md`,
  `SESSION_REGISTRY.md`, `KILL_SWITCH_AND_FALLBACK.md`, and
  `FINAL_ACTIVATION_RECORD.md`;
- manifest version 5, denominator 21, with AO-WU-16 through AO-WU-21 and
  AO-WU-15 depending on AO-WU-21;
- current Agent Office gateway, inbox, decision-authority, runtime composition,
  operational configuration, delivery-control, HTTP, observation, recovery,
  UI, and test surfaces at base
  `9c403da5662aeedc28a8c677c37a134aaa44dce3`; and
- current Foundation Advisor instructions, which authorize Advisor to publish
  durable routing and evidence artifacts only under `foundation-docs/advisor/**`.

The active transport record fixes the only destination to the existing
Foundation Advisor session `foundation-advisor`, observed session ID `$9`,
window index `0`, pane index `0`, observed pane ID `%9`, workspace
`/home/leo/Project/foundation-advisor`, and process `codex`. Registry data is a
locator, never live proof.

## 3. DQ-01 through DQ-08 resolution register

| Question | Resolution state | Evidence-backed resolution |
|---|---|---|
| DQ-01 Authority source | `RESOLVED__NO_CAPABILITY_YET` | A trusted owner-only activation descriptor may select validation, but cannot contain or invent a usable capability. The runtime validates exact Git blob/SHA-256 references for V2, transport protocol, activation state, final activation record, session registry, kill switch, Leo/GPT Option A, and manifest v5. It then validates a one-use Advisor readiness lease and live structured metadata before minting an in-memory notification-bound capability. Any absent, dirty-at-path, stale, inactive, killed, mismatched, expired, or non-ancestor input means manual fallback. |
| DQ-02 Exact destination preflight | `RESOLVED__REGISTRY_REFRESH_PREREQUISITE` | Immediately before the sole paste, direct-argv `tmux display-message` must match the fixed session/window/pane IDs and indexes, exact workspace, `codex` process, live pane, synchronization off, and the one-use structured Advisor readiness lease for this mission. The implementation must require the registry/readiness evidence to contain the current exact window ID; the present registry omits it, so Advisor must publish a refreshed reviewed row before activation. Product code never parses pane prose to infer role, readiness, or mission. |
| DQ-03 Pointer envelope and transport | `RESOLVED` | Preserve the existing exact v1 pointer envelope and write its canonical JSON bytes to an owner-only immutable pointer artifact. Load that file into a deterministic unique tmux buffer, paste with `-p` to `%9`, delete the buffer on successful paste with `-d`, and submit exactly `Enter`. Every executable and argument is fixed trusted data, `shell:false`; browser data cannot set target, path, buffer, command, key, role, or executable. |
| DQ-04 Idempotency/no blind resend | `RESOLVED__DURABLE_PORT_REQUIRED` | `requestId`, canonical message payload hash, `messageId`, `notificationId`, pointer-envelope hash, readiness lease ID, destination fingerprint, and capability ID bind one attempt. A fsynced transport journal records every crash boundary. Once `PASTE_STARTED` is durable, every missing/timeout/crash outcome is ambiguous and can never be resent automatically. A successful durable receipt returns `ALREADY_DELIVERED` on replay. The current gateway `Map` is only a cache and must not be the authority. |
| DQ-05 Advisor ACK/canonical evidence ingress | `RESOLVED__EXISTING_V2_AUTHORITY_ONLY` | The existing Advisor session publishes closed-schema JSON evidence under its normal `foundation-docs/advisor/**` write scope. Agent Office discovers only exact derived stage paths, reads committed Git blobs by direct argv, verifies repository/commit/path/blob/SHA-256/ancestry and all message correlations, and invokes an internal application port. No HTTP/browser `advisor_operator` is used. Advisor may acknowledge, classify intake, and record an exact V2 routine route already authorized by the current mission. New scope, risk, final approval, next mission, or other material decision still requires immutable Leo/GPT evidence. Delivery never equals ACK, and ACK never equals intake, decision, or resume. |
| DQ-06 Kill/manual fallback | `RESOLVED` | External inactive/kill state, local durable disable, expired lease/capability, stale registry, failed preflight, unexpected target state, timeout, ambiguous transport, restart, or evidence conflict all fail closed before new input and project manual fallback. External state becoming healthy cannot clear a locally latched disable. Re-enable requires a new exact activation grant and explicit governed operation; no browser or restart can auto-enable. |
| DQ-07 Rehearsal proof | `RESOLVED__EXECUTION_DEFERRED_TO_AO-WU-21` | After both Fable5 passes, Advisor performs one synthetic, non-sensitive actual send, verifies pointer bytes and fixed-pane transport, publishes separate ACK/intake/decision/resume evidence, proves duplicate non-execution and fail-closed negatives, then stops the server, consumes/removes proof material, deletes any remaining test buffer, latches delivery disabled, and records listener/lock/credential absence. |
| DQ-08 Scope isolation | `RESOLVED` | The bridge composes only with exact `127.0.0.1:4317` LocalBootstrap and the one fixed local tmux destination. No public/private-network listener, remote host, DB, Hermes, Worker/Reviewer route, general terminal port, arbitrary command, browser transport field, production/live deployment, protected branch, or automatic next mission is introduced. |

No DQ requires a new Leo/GPT authority decision. DQ-02 has a mechanical
pre-activation evidence prerequisite, not a policy choice. If Fable5 finds that
the existing V2 routine-routing boundary cannot support the DQ-05 subset, this
candidate must return to Leo/GPT rather than silently broaden Advisor authority.

## 4. Non-negotiable invariants

1. Browser input can create only the existing typed Leo message. It is persisted
   and fsynced before any notification or pointer exists.
2. The message body, subject, evidence prose, and any browser-supplied string do
   not enter tmux. Only the closed canonical pointer envelope enters the pane.
3. The destination is exactly `foundation-advisor/$9/0/%9` after immediate live
   revalidation. There is no destination selector.
4. Transport receipt, Advisor ACK, intake, decision, resume, completion, review,
   final approval, and next-mission selection are distinct facts.
5. There is at most one pane-input attempt per `notificationId`. Ambiguity is a
   terminal automatic-delivery outcome.
6. The runtime never evaluates a shell string, broadcasts, uses a wildcard,
   enables synchronized panes, sends an approval answer, or sends any key except
   the one final `Enter` after the exact pointer paste.
7. Product code consumes structured tmux fields and structured committed
   evidence only. Pane prose, animation, UI text, chat narration, and terminal
   scrollback never create state.
8. A local or external kill is fail-closed and latched locally. Recovery never
   implies re-enable.
9. Advisor routine authority is a strict subset of an already-approved current
   mission. Leo/GPT remains the authority for material decisions and final
   closure.
10. LocalBootstrap stays single-user, exact IPv4 loopback, same-origin,
    owner-controlled, server-session based, and separate from delivery authority.

## 5. Trusted configuration and authority schemas

### 5.1 Two-key production selection

The implementation introduces new versions rather than weakening current
schemas:

- deployment `agent-office.loopback-deployment.v3` retains every v2
  LocalBootstrap field and exact value, and adds only
  `deliveryMode=EXACT_ADVISOR_POINTER` plus a stable `deliveryActivationId`;
- operational `agent-office.operational-runtime.v2` retains current project,
  root, source, actor, freshness, and gateway validation, but replaces literal
  production capability injection with one exact activation registration; and
- production composition constructs the port internally only when the two files
  agree. The default v1 read-only and v2 LocalBootstrap descriptors continue to
  compose no usable port and report `MANUAL_FALLBACK_REQUIRED`.

Both files remain absolute-path, no-follow, current-owner regular files with no
group/other write bit. Requests, environment variables, URLs, cookies, browser
storage, feature flags, and HTTP fields cannot select delivery. A caller-injected
`capability` or `tmuxDeliveryPort` remains test-harness-only and is rejected by
the production composition.

### 5.2 Activation registration

The operational v2 `gateway.activation` object has exactly this logical schema:

```text
schemaVersion: agent-office.exact-advisor-delivery-activation.v1
activationId: stable bounded ID equal to deployment.deliveryActivationId
mode: EXACT_ADVISOR_POINTER
authorityProjectId: foundation-docs
authorityRootId: exact registered sibling foundation-docs root
authorityGitSourceId: exact registered foundation-docs Git source
governedMissionId: AGENT_OFFICE_M01_ADVISOR_MANAGED_OFFICE_WEB_CONTROL_PLANE
activationMissionId: AGENT_OFFICE_M01_EXACT_ADVISOR_DELIVERY_ACTIVATION
destination:
  sessionName: foundation-advisor
  sessionId: $9
  windowIndex: 0
  paneIndex: 0
  paneId: %9
  workspace: /home/leo/Project/foundation-advisor
  currentCommand: codex
snapshotRefs: exact closed object described below
readinessLeasePath: fixed Advisor-job-relative path
advisorEvidencePrefix: fixed Advisor-job-relative directory
capabilityTtlMs: integer 1..30000
preflightMaxAgeMs: integer 1..30000
toolLimits: timeout 1..30000 ms, aggregate output 1..65536 bytes
tmuxExecutable: /usr/bin/tmux
```

The exact destination object and all paths are trusted configuration. No part is
copied from `SubmitAdvisorMessage` or any HTTP body.

### 5.3 Required Git-visible snapshot set

`snapshotRefs` contains exact `SourceArtifactRef` values
`{repository, commit, path, sha256}` for:

1. canonical role protocol V2;
2. active tmux `TRANSPORT_PROTOCOL.md`;
3. `ACTIVATION_STATE.md`;
4. `FINAL_ACTIVATION_RECORD.md`;
5. `SESSION_REGISTRY.md` with exact window identity refreshed;
6. `KILL_SWITCH_AND_FALLBACK.md`;
7. the Leo/GPT Option A decision package/intake; and
8. parent mission manifest version 5.

For every ref, the runtime requires the registered repository/root, a 40-hex
commit, bounded normalized relative path, exact Git blob bytes at that commit,
and matching `sha256:` value. The configured commits must be ancestors of the
currently configured local upstream ref; the current HEAD and upstream must
agree for the trusted authority namespace, and the current upstream blob at
each trusted path must still match the frozen ref. A worktree or later committed
change to any trusted path is a conflict even if unrelated repository dirt
exists elsewhere. The complete set is checked once while composing and again
after buffer load immediately before pane input.

The runtime parses closed fields rather than accepting hashes alone:

- V2 status is active and preserves Advisor/Worker/Reviewer/Leo separation;
- transport mode and final record are active/approved;
- global kill is `DISENGAGED`, manual fallback remains active, and product
  mission authority is not inferred from transport activation;
- the registry row matches the fixed destination and says synchronized panes
  are off subject to live recheck;
- Option A names this exact activation mission and boundaries; and
- manifest version is 5, denominator is 21, AO-WU-17 through AO-WU-21 have the
  expected dependency chain, and AO-WU-15 depends on AO-WU-21.

Canonical hashes are deterministic:

```text
authoritySnapshotHash = sha256(canonical JSON of refs 1, 7, and 8)
activationSnapshotHash = sha256(canonical JSON of refs 2, 3, 4, and 6)
registrySnapshotHash = sha256(canonical JSON of ref 5 plus fixed destination)
```

Sorting is by the fixed field order above, not filesystem enumeration.

### 5.4 Structured one-use Advisor readiness lease

The current product cannot prove a Codex prompt is idle from tmux metadata and
must not parse pane prose. Before any real send, the existing Advisor session
publishes one closed-schema JSON file under the fixed Advisor job path:

```text
schemaVersion: agent-office.advisor-delivery-readiness.v1
leaseId: UUIDv7
activationMissionId: exact activation mission
governedMissionId: exact parent mission
issuerRole: Advisor
issuerSubjectId: foundation-advisor
destination: exact session/window/pane/workspace/process including live windowId
readiness: IDLE_FOR_ONE_POINTER
useLimit: 1
observedAt: UTC
issuedAt: UTC
expiresAt: UTC, exclusive and no more than 30 seconds after issuedAt
registrySnapshotHash: exact current hash
authoritySnapshotHash: exact current hash
activationSnapshotHash: exact current hash
evidenceRefs: bounded non-secret dispatch/preflight evidence IDs
```

The lease must be a committed/pushed Git blob, the trusted path must match its
blob, and its commit must be a descendant of all configured snapshot commits and
an ancestor of/equal to current upstream. Agent Office durably consumes the
`leaseId` for the first matching `notificationId`; it cannot be reused after
failure, crash, restart, or success. This record is structured role evidence,
not chat prose and not a capability by itself.

### 5.5 In-memory single-use attempt capability

Only after Sections 5.1-5.4 and the first live preflight pass may the runtime
mint this non-serializable, process-local value:

```text
schemaVersion: agent-office.advisor-transport-capability.v2
capabilityId: UUIDv7
activationId: exact trusted activation ID
logicalRoute: ADVISOR_ONLY
transport: TMUX
state: ACTIVE
killSwitch: DISENGAGED
synchronization: SINGLE_PREVALIDATED_DESTINATION
activationMissionId: exact activation mission
governedMissionId: exact parent mission
notificationId: exact queued notification
pointerEnvelopeHash: sha256 of exact canonical envelope bytes
destinationFingerprint: sha256 of exact live structured destination record
readinessLeaseId: exact unconsumed lease
issuedAt: UTC
expiresAt: UTC exclusive, no later than configured 30-second bound
authoritySnapshotHash: exact validated hash
activationSnapshotHash: exact validated hash
registrySnapshotHash: exact validated hash
```

It is consumed before `PASTE_STARTED` is written. A capability is never accepted
from operational JSON, a browser, HTTP, environment, a test injection into the
production factory, or a persisted prior process.

## 6. Exact pointer envelope and immutable pointer artifact

The transport preserves the current
`agent-office.advisor-pointer-envelope.v1` schema and canonical JSON field set:

```text
schemaVersion
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

`messageArtifactRef` remains the validated relative
`artifacts/inbox/<missionId>/<requestId>/<sha256>.json` reference. The fixed
Advisor operating instruction maps that relative ref to the one Agent Office
state root selected for the rehearsal/runtime; the root is never carried in the
browser request or pointer. Advisor reads exactly that file, rejects symlinks,
requires current-owner regular-file identity and bounds, and verifies its bytes
against `messageArtifactHash` before ACK.

The envelope contains no message body, subject, Markdown, command, target,
session, pane, executable, key sequence, absolute path, state-root path, role,
approval answer, or browser-controlled transport value.

Before tmux access, Agent Office writes the exact canonical envelope bytes with
create-exclusive, owner-only, no-follow semantics to the internally derived
path:

```text
artifacts/gateway-pointers/<missionId>/<notificationId>/<envelope-sha256>.json
```

It fsyncs file and parent directory and rereads/verifies the bytes. The absolute
load path is obtained by containment-safe resolution from the trusted state root;
it is never accepted as input.

## 7. Immediate preflight and exact tmux argv

### 7.1 Structured preflight record

The production transport runner has a closed operation vocabulary. It cannot
execute caller-provided commands. Immediately before capability minting and again
after buffer load but before paste, it executes only direct-argv
`/usr/bin/tmux display-message -p -t %9 -F <fixed-format>` with a fixed unit
separator format that returns:

```text
session_id, window_id, pane_id, escaped session name, escaped window name,
window index, pane index, escaped current path, escaped current command,
pane PID, pane dead, pane in mode, input off, synchronize-panes, activity time
```

The decoder requires one bounded UTF-8 record, the exact field count, no NUL/new
line, closed numeric/boolean forms, and safe escaped fields. Both observations
must match each other, the trusted destination, the refreshed registry, and the
readiness lease. Required values include `$9`, `%9`, indexes `0/0`, exact live
window ID, session `foundation-advisor`, workspace
`/home/leo/Project/foundation-advisor`, command `codex`, live pane, not in tmux
mode, input enabled, and `synchronize-panes=0`.

The readiness lease supplies the governed role/mission/idle assertion that tmux
does not expose structurally. Agent Office never reads or interprets capture-pane
content. A mismatch, changed pane ID after restart, expired lease, or target
change between observations stops before paste.

### 7.2 Buffer identity

The unique buffer name is derived only from the validated notification UUID:

```text
ao_<notificationId lowercase hex with hyphens removed>
```

The runner first checks that this exact buffer name is absent. Any collision is
manual fallback; it never overwrites a pre-existing buffer.

### 7.3 Sole transport sequence

With fixed executable, fixed subcommands, trusted internally derived path, exact
buffer name, and exact `%9` target, the only mutating argv are:

```text
/usr/bin/tmux load-buffer -b <exact-buffer> <absolute-pointer-artifact>
/usr/bin/tmux paste-buffer -p -b <exact-buffer> -t %9 -d
/usr/bin/tmux send-keys -t %9 Enter
```

Each process uses `shell:false`, cwd `/`, a minimal fixed environment, ignored
stdin, separately capped stdout/stderr, and a hard timeout. There is no `eval`,
shell, command substitution, here-document, wildcard, target alias, multi-pane
target, broadcast, synchronization change, `capture-pane`, or arbitrary key.

`load-buffer` does not touch the pane. The second live preflight occurs after it.
The journal is fsynced as `PASTE_STARTED` before invoking `paste-buffer` and as
`SUBMIT_STARTED` before invoking `send-keys`. Therefore a timeout or process
death at either boundary cannot cause a blind retry.

## 8. Durable idempotency, crash boundaries, and receipt lookup

### 8.1 Identity tuple

The authoritative delivery key is:

```text
notificationId
requestId
messagePayloadHash
messageId
messageArtifactHash
pointerEnvelopeHash
readinessLeaseId
destinationFingerprint
```

Same `notificationId` plus identical tuple returns the prior durable outcome.
Same `notificationId` or `requestId` with any changed member returns
`IDEMPOTENCY_KEY_REUSED` and performs no tmux operation.

### 8.2 Journal schema

The port persists an atomic owner-only journal and immutable phase evidence under
the state root. Each record contains schema version, identity tuple, capability
ID/hashes/expiry, buffer name, fixed target, exact preflight evidence hashes,
phase, timestamps, tool exit classification, evidence refs, prior-record hash,
and record hash. Closed phases are:

```text
PREPARED
BUFFER_LOADED
PASTE_STARTED
PASTE_CONFIRMED
SUBMIT_STARTED
TRANSPORT_RECORDED
MANUAL_RECONCILIATION_REQUIRED
```

Every transition is atomic and fsynced before the next side effect. There is one
attempt only.

### 8.3 Crash/timeout result matrix

| Last durable phase | Proven pane effect | Automatic recovery result |
|---|---|---|
| No record | none | A new attempt may begin only with a fresh unconsumed lease and full validation. |
| `PREPARED` | none | Mark manual fallback and consume lease; no automatic retry. |
| `BUFFER_LOADED` | none | Delete only the exact private buffer if identity still matches, then mark manual fallback; no pane input and no automatic retry. |
| `PASTE_STARTED` | unknown | Mark ambiguous/manual fallback; never paste or submit automatically. |
| `PASTE_CONFIRMED` | pointer may be present but not submitted | Mark ambiguous/manual fallback; never send `Enter` after restart. |
| `SUBMIT_STARTED` | unknown or submitted | Mark ambiguous/manual fallback; never resend either operation. |
| `TRANSPORT_RECORDED` | tmux accepted paste and submit argv | Return `ALREADY_DELIVERED` with original receipt; still not Advisor ACK. |
| malformed/hash-chain conflict | unknown | Quarantine delivery state, latch disabled, manual reconciliation only. |

A zero tmux exit code proves only that tmux accepted the operation. After both
mutating commands return zero, the port durably writes a transport receipt before
returning `DELIVERED`. Any timeout, output overflow, signal, missing exit, failed
receipt write, or process death at/after `PASTE_STARTED` is ambiguous.

`TmuxAdvisorGateway` may keep an in-memory lookup cache, but
`lookupPointerReceipt` must read the durable journal. The application startup
reconciler must never turn `NOT_FOUND` after a started attempt into a second send.

## 9. Production Advisor evidence ingress

### 9.1 Trust boundary and discovery

The HTTP `advisor_operator` routes remain unavailable to LocalBootstrap and are
not the production ingress. The new internal `AdvisorEvidenceIngress` reads only
the registered local `foundation-docs` Git repository with fixed direct Git argv,
no shell and no network. For a known validated `messageId`, it derives only these
paths under the exact activation job prefix:

```text
advisor-evidence/<messageId>/01_ACKNOWLEDGEMENT.json
advisor-evidence/<messageId>/02_INTAKE.json
advisor-evidence/<messageId>/03_DECISION.json
advisor-evidence/<messageId>/04_RESUME_<workUnitId>.json
```

The complete prefix is trusted operational configuration. `messageId` and
`workUnitId` have already passed closed domain validation; no path comes from
the browser. Reads use exact committed blob bytes (`git show`-equivalent direct
argv with an exact 40-hex commit and normalized path), not mutable worktree prose.
For every stage the ingress requires:

- local upstream ref resolved to one exact commit with no prompt/network;
- commit ancestry from configured mission/snapshot commits;
- exact repository, path, blob ID, and `sha256:` match;
- file absent at all earlier commits once first observed, and unchanged after its
  first accepted commit;
- valid UTF-8 JSON, exact keys, bounded arrays/strings, closed enums, UTC/UUIDv7,
  and no unknown fields;
- exact message, request, notification, mission, pointer, artifact, receipt, and
  prior-stage correlations; and
- chronological ordering and no accepted-stage rewrite/removal.

It stores the immutable `SourceArtifactRef` for every accepted stage before
calling the inbox application service. Polling observes evidence; it never writes
foundation-docs, executes a prompt, or resumes work by inference.

This trust model is the existing M01/V2 local-operator model: Git hashes prove
bytes and history, not the human or model actor, and a compromised local account
is outside M01 protection. Role authority is therefore anchored by the exact
Advisor-only path, registered existing Advisor session, committed structured
record, active instructions, and V2 review/audit process. No signing key or secret
is invented. If cryptographic actor attestation is later required, that is a new
key-provisioning/security mission.

Before rehearsal, Advisor must publish and reload a narrowly scoped instruction
that permits the existing `foundation-advisor` session to read only the one
configured Agent Office state root and only the derived inbox artifact named by a
validated pointer. Its current general allowed-read list does not name Agent
Office. Option A authorizes this exact message-artifact flow, but the instruction
must be made explicit and independently reviewed; no broad Agent Office repo or
state-root read authority is implied. Missing reload evidence blocks activation,
not design publication.

### 9.2 ACK record

`agent-office.advisor-acknowledgement-evidence.v1` contains exactly:

```text
schemaVersion, missionId, activationMissionId, requestId, messageId,
notificationId, acknowledgementId, acknowledgedAt,
advisorRole=Advisor, advisorSubjectId=foundation-advisor,
destination (exact fixed tuple), readinessLeaseId,
pointerEnvelopeHash, messageArtifactRef, messageArtifactHash,
transportReceiptHash, artifactReadStatus=VERIFIED,
evidenceRefs
```

ACK means the existing Advisor session independently opened the one derived
message artifact and verified its bytes/hash. Seeing a tmux receipt or pane text
is insufficient. The ingress accepts ACK only after the notification has a
durable `DELIVERED` or `MANUAL_FALLBACK_REQUIRED` receipt and all correlations
match. It writes the current Agent Office acknowledgement artifact/event through
an internal `Advisor` context whose subject is fixed by the trusted adapter.

### 9.3 Intake record

`agent-office.advisor-intake-evidence.v1` contains exactly:

```text
schemaVersion, missionId, requestId, messageId, notificationId,
intakeId, classification, recordedAt,
acknowledgementArtifact (SourceArtifactRef),
messageArtifactHash, referencedWorkUnitIds, evidenceRefs
```

Classification remains the existing closed vocabulary:
`ROUTINE_ROUTE`, `NEEDS_LEO_DECISION`, `NO_ACTION`, or
`REJECTED_OUT_OF_SCOPE`. It must cite the accepted ACK artifact and exactly the
message WorkUnit set. No later stage is accepted without intake.

### 9.4 Decision record and authority proof

`agent-office.advisor-decision-evidence.v1` contains exactly:

```text
schemaVersion, missionId, requestId, messageId, decisionId,
decisionKind=ROUTINE_ROUTE|LEO_GPT_DECISION,
authorityRole=Advisor|Leo/GPT, authoritySubjectId,
scope={kind:WORK_UNIT_SET, workUnitIds}, decidedAt,
intakeArtifact (SourceArtifactRef),
governingLeoAuthorityArtifact (SourceArtifactRef),
decisionAuthorityArtifact (SourceArtifactRef),
decisionCode, evidenceRefs
```

The existing immutable decision-authority verifier remains the final gate. The
implementation may accept `authorityRole=Advisor` only for `ROUTINE_ROUTE` when
all of the following are proven:

1. intake classification is `ROUTINE_ROUTE`;
2. the exact current Leo/GPT mission decision and manifest already authorize the
   same WorkUnit set and next actor/action;
3. dependencies and current state permit that already-defined transition;
4. there is no scope/denominator, product, safety, privacy, DB, secret,
   credential, production/live, protected-branch, risk-acceptance, review
   verdict, final-approval, or next-mission decision;
5. `authorityRole=Advisor` remains visible in artifact, verified evidence,
   event, projection, replay, and UI; and
6. the governing Leo artifact and Advisor route artifact are both immutable and
   exactly correlated.

The as-built exact verifier additionally requires every cited manifest WorkUnit
to be currently `READY`, all declared dependencies to be `COMPLETED`, and the
phase not to be `FINAL_AUDIT`. This is the executable current-state proof for the
already-authorized routine subset; it cannot create review, final-audit, or new
scope authority.

If any condition is absent, the record must use `authorityRole=Leo/GPT` and cite
an exact immutable Leo/GPT decision artifact, or classification remains
`NEEDS_LEO_DECISION` and no decision/resume is ingested. This implements existing
V2 routine routing; it does not grant Advisor canonical material authority.

### 9.5 Resume record

Each `agent-office.advisor-resume-evidence.v1` contains exactly:

```text
schemaVersion, missionId, requestId, messageId, workUnitId,
decisionArtifact (SourceArtifactRef), intakeArtifact (SourceArtifactRef),
recordedAt, resumeProof
```

`resumeProof` is the existing exact `ResumeProof`: workUnit ID, waiting event,
captured previous/resume state, decision ID, decision/intake hashes, resolved
blocker IDs, and expected stream version. The ingress accepts it only after the
exact intake and verified decision link, requires `resumeTo=previousState`, and
uses expected-stream concurrency. Delivery, ACK, elapsed time, UI action, SSE,
process restart, or an Advisor `NEEDS_LEO_DECISION` classification can never
resume work.

## 10. State ordering and visible projection

The durable order remains:

```text
PERSISTED
-> DELIVERY_PENDING
-> DELIVERED | DELIVERY_FAILED | MANUAL_FALLBACK_REQUIRED
-> ACKNOWLEDGED
-> INTAKE_RECORDED
-> DECISION_LINKED
-> per-WorkUnit ResumeProof transition when separately valid
-> CLOSED only by separately authorized evidence
```

The projection and UI show at least:

- activation `DISABLED`, `READY`, `STALE`, `KILLED`, or `CONFLICTED`;
- transport `QUEUED`, `DELIVERING`, `DELIVERED`, `AMBIGUOUS`, or
  `MANUAL_FALLBACK_REQUIRED`;
- Advisor evidence `NOT_ACKNOWLEDGED`, `ACKNOWLEDGED`, `INTAKE_RECORDED`,
  `NEEDS_LEO_DECISION`, `DECISION_LINKED`, and `RESUME_RECORDED`; and
- the exact evidence refs/hashes without message body, state-root path, terminal
  content, capability bytes, proof value, or secret.

No success toast, animation, green transport badge, or SSE receipt can collapse
these stages. Mutation controls remain Leo-message-only under LocalBootstrap;
there is no browser Advisor control and no delivery target editor.

## 11. Kill switch, disable, fallback, and recovery

The existing local delivery-control design is extended from a disable-only
receipt list to a durable, hash-chained latch:

```text
DISABLED_DEFAULT -> ENABLED_BY_EXACT_GRANT -> DISABLED_LATCHED
```

- The first transition requires the reviewed v3/v2 two-key configuration, all
  authority snapshots, a new activation-grant ID, and no prior conflicting state.
- External kill, local disable, authority conflict, journal corruption, or
  explicit operator disable transitions to `DISABLED_LATCHED` before any later
  send.
- Capability/lease expiry makes the current attempt manual fallback and cannot
  mint a replacement from stale evidence.
- Restart replays the latch and journals before gateway health. Config presence,
  external kill becoming disengaged, a new browser session, or server restart
  cannot re-enable.
- Re-enable requires a new exact reviewed activation grant whose authority
  explicitly cites resolution of the prior disable/kill reason. It has no HTTP
  or browser route.
- An unexpected target prompt, authentication request, privilege request,
  approval, DB/secret/prod/live request, timeout, or role ambiguity engages local
  disable and returns to manual routing; it never auto-answers or sends `Ctrl-C`.

Manual fallback preserves the immutable message and pointer for Leo/Advisor
manual routing. It never marks delivery, ACK, intake, decision, or resume without
their own evidence.

## 12. LocalBootstrap and scope isolation

The reviewed LocalBootstrap properties remain exact:

- bind exactly `127.0.0.1:4317`, exact Host/Origin and no CORS/proxy/TLS/HSTS;
- one cryptographic, single-use, owner-only proof file outside Git;
- server-side `viewer` plus `leo_input` only; no `advisor_operator`;
- HttpOnly/Strict host-only cookie, CSRF, expiry/revocation/logout/SSE close;
- actual Git-verified parent manifest; no fixture fallback;
- state, static, proof, application, and observed roots remain isolated; and
- no remote/private/public/Tailscale listener.

Exact tmux delivery is an outbound local capability independent of browser auth.
Successful LocalBootstrap login cannot create, refresh, choose, or re-enable it.
The bridge exposes no generic process runner to the server or UI. Hermes remains
an uncomposed disabled stub. Worker and Reviewer sessions are unrepresentable as
gateway destinations.

## 13. AO-WU-19 implementation as built after design PASS

The same Agent Office Worker may implement only the reviewed plan in AO-WU-19:

| Surface | As-built change |
|---|---|
| `src/server/config.ts`, `src/runtime/operational-config.ts` | Add closed v3/v2 two-key selection and exact activation registration; preserve v1/v2 defaults and all owner/mode/no-follow/loopback checks. |
| `src/runtime/composition.ts`, `composition-core.ts`, `cli.ts`, test composition | Construct the production bridge internally only after trusted validation; move arbitrary capability/port injection behind an unmistakable synthetic-only factory; compose evidence polling without a browser port. |
| `src/adapters/gateways/tmux-advisor/` | Add authority validator, one-use capability provider, exact production tmux runner/port, pointer artifact, durable journal/lookup, fixed buffer sequence, bounded process execution, and receipt evidence. |
| `src/adapters/observations/process-runner.ts` and tmux/Git adapters | Keep read-only observation vocabulary separate; add only closed exact-pointer tmux operations and exact committed-blob reads with fixed argv/no shell. |
| `src/operations/readiness/delivery-control.ts` | Add durable default-disabled/enabled-by-grant/latched-disable state, replay, hash/integrity checks, and no automatic re-enable. |
| `src/application/advisor-inbox/` | Make durable port lookup authoritative, ingest closed Advisor evidence stages idempotently, preserve strict ordering, and keep receipt separate from ACK. |
| `src/adapters/observations/artifacts/decision-authority.ts` | Verify exact Leo/GPT decisions and the narrowly bounded V2 Advisor routine-route subset against the immutable governing decision plus current manifest `READY`/dependency state, without conflating link actor and authority role. |
| `src/runtime/projection.ts`, `src/ui/runtime/`, `src/ui/communication/` | Project separate activation/transport/ACK/intake/decision/resume states and evidence without transport controls or sensitive paths/body. |
| configuration/runbook docs | Provide disabled examples and exact rehearsal preparation only. Do not commit a live activation grant, readiness lease, capability, proof, credential, or enabled production descriptor. |

No Foundation Advisor source/runtime is required. Advisor publishes the exact
structured evidence files through its existing foundation-docs write boundary.
Before rehearsal, Advisor must publish the refreshed destination row, readiness
lease, evidence templates, and narrow read/reload instruction under its governed
authority, and Fable5 must review the actual cross-boundary schemas/instruction.

### 13.1 Safe restrictive divergence

Classification:
`DESIGN_DEFECT__PRIOR_DISABLE_RESOLUTION_CORRELATION_NOT_CLOSED_IN_V1_SCHEMA`.
Section 11 requires a later reviewed grant to cite resolution of the prior local
disable, but activation v1 defines no closed field that can carry and bind that
prior transition hash. AO-WU-19 therefore does not guess: v1 permits the initial
`DISABLED_DEFAULT -> ENABLED_BY_EXACT_GRANT` transition and permanently refuses
re-enable after `DISABLED_LATCHED`. A later reviewed schema/version must add the
exact prior-transition/resolution correlation before re-enable can exist. This
is a fail-closed restriction, not acceptance of an under-specified grant.

## 14. Required verification and threat cases

### 14.1 Unit/contract/integration tests

Implementation tests must cover:

- exact/unknown-field schema rejection for every new configuration and evidence
  version;
- v1/v2 default/manual behavior unchanged and LocalBootstrap exact loopback
  unchanged;
- no production injected port/capability and no test provider in production;
- all eight snapshot refs, Git blob/hash/ancestry/path-dirty checks, parsed status,
  and every stale/conflict/kill combination;
- lease role/destination/mission/expiry/single-use checks;
- live preflight exact match, second-check TOCTOU mismatch, pane restart, wrong
  window/process/path, dead/mode/input-off/synchronized pane;
- byte-exact envelope, no body/subject/command/target/path-root leakage, exact
  buffer name and argv, `shell:false`, output/timeout bounds;
- duplicate same bytes, same-ID changed bytes, lease/capability replay, process
  restart, and every journal crash boundary;
- no second paste or submit after `PASTE_STARTED`, including ambiguous lookup;
- successful transport receipt not creating ACK;
- ACK hash/read proof, intake ordering, exact Advisor routine subset, Leo-required
  decisions, authorityRole preservation, and resume concurrency;
- evidence file rewrite/removal/non-ancestor/dirty/wrong-path/wrong-message/wrong
  stage/time/scope/hash rejection with zero domain append;
- external kill and local disable latching, restart persistence, and absence of an
  enable HTTP/browser route;
- no Worker/Reviewer/Hermes/generic target or process route; and
- full existing 55-file/255-test, 21-Playwright, build, lint, audit, smoke,
  recovery, PWA, visual, and source-boundary regression gates, adjusted only for
  the reviewed implementation.

### 14.2 Threat/failure matrix

| Threat/failure | Required result |
|---|---|
| Browser supplies pane, command, path, role, key, or target field | Boundary rejects unknown field; no transport record. |
| Hostile message contains shell/Markdown/control text | Body stays only in immutable inbox artifact; pointer bytes remain closed JSON refs/IDs/hashes. |
| Authority file hash valid but parsed state inactive/kill engaged | No capability; local manual fallback. |
| Trusted authority path dirty while unrelated repo dirt exists | Trusted-path conflict fails; unrelated path is reported but does not replace exact path proof. |
| Registry stale or pane restarted | Live identity mismatch before paste; lease consumed/manual fallback. |
| Synchronize-panes on, wildcard, or multiple pane target | Unrepresentable/rejected before input. |
| Target busy/mission unclear | No unexpired structured one-use readiness lease; no input. |
| Target changes after buffer load | Second preflight fails; exact buffer cleanup only, no paste. |
| Crash/timeout after paste might start | Ambiguous journal; no paste/Enter retry. |
| Duplicate message/notification after restart | Prior durable receipt or conflict; zero additional tmux operation. |
| Forged/rewritten Advisor ACK or intake | Git/path/blob/hash/ancestry/correlation failure; zero event. |
| Advisor tries material decision as routine | Authority verifier rejects; state remains `NEEDS_LEO_DECISION`. |
| Receipt or ACK presented as resume | State-order and ResumeProof rejection. |
| External kill clears after restart | Local latch stays disabled; new explicit grant required. |
| Proof/cookie/capability leakage attempt | Values excluded from pointer, logs, audit, projection, SSE, UI, and browser storage. |
| Public/private/remote config or Hermes/Worker target | Schema/composition rejection before proof creation or bind. |

## 15. Synthetic actual rehearsal, rollback, and cleanup

AO-WU-21 may run only after Fable5 design `PASS`, same-Worker implementation,
and Fable5 implementation/security `PASS`. Advisor owns the rehearsal.

### 15.1 Positive actual send

1. Use disposable isolated state/proof/config roots, the real reviewed executable,
   exact `127.0.0.1:4317`, a fresh one-use LocalBootstrap proof, a reviewed exact
   activation grant, and a fresh one-use readiness lease.
2. Submit one non-sensitive synthetic message such as
   `AO-WU-21 exact delivery rehearsal; acknowledge and classify NO_ACTION; do not
   start work` with only approved parent-mission WorkUnit refs.
3. Record message artifact bytes/hash, v1 pointer bytes/hash, capability hashes,
   both live preflights, journal, buffer argv, exact `%9` receipt, and proof that
   no other pane/buffer/target was used.
4. Advisor independently reads and hashes the message artifact, then commits the
   exact ACK and intake (`NO_ACTION`) evidence. A synthetic decision/resume chain
   is separately exercised only against a disposable already-waiting fixture and
   exact reviewed authority; it cannot start real work.
5. Agent Office ingests each committed stage and shows the stages separately.

### 15.2 Negative and idempotency proof

- Replay the same browser `requestId`/payload and notification lookup; prove the
  original receipts return and tmux operation counters remain exactly one.
- Prove changed payload under the same ID conflicts.
- In synthetic ports, reproduce stale registry, sync on, wrong pane/workspace,
  expired lease/capability, external kill, local latch, timeout, crash at every
  journal boundary, forged ACK, material Advisor decision, and premature resume;
  every case must produce zero additional pane input.
- Scan process argv, journal, audit, SSE, HTTP responses, UI, caches, storage,
  source, config, and committed artifacts for message-body transport leakage,
  proof/cookie/capability values, generic commands, and alternate targets.

### 15.3 Cleanup and rollback evidence

After evidence capture, Advisor must:

1. latch Agent Office delivery disabled and verify restart stays disabled;
2. stop the server normally, close SSE/session, release writer lock, and prove no
   listener/process remains;
3. consume/remove the LocalBootstrap proof and verify no credential/proof value
   remains;
4. delete only an exact leftover rehearsal tmux buffer if one exists, without
   sending pane input;
5. preserve immutable state/journal/evidence needed for review while removing
   disposable non-evidence files;
6. record no Worker/Reviewer pane input, no public/remote listener, no DB/Hermes,
   and no automatic next mission; and
7. return the complete rehearsal evidence to Advisor final audit. Rollback is
   application disable plus process stop, not Git reset, pane termination, or
   global transport reconfiguration.

## 16. Nine Leo/GPT success criteria traceability

The nine criteria are the nine boundaries in the approved Option A decision.

| # | Success criterion | Implementation path | Test/review proof | Actual rehearsal proof |
|---:|---|---|---|---|
| 1 | Immutable operational message artifact and exact pointer delivery | Inbox artifact/event, pointer artifact, canonical v1 envelope, exact port | Byte/hash/order and no-body transport tests; Fable5 data-flow review | Message/pointer/blob hashes and exact received pointer |
| 2 | Fixed existing Advisor target only | Trusted config plus `$9/0/%9` double preflight | Wrong-target/window/pane/path/process/sync tests; argv review | Two live structured records and exact one-pane receipt |
| 3 | requestId/content hash idempotency and no blind resend | Durable inbox/outbox plus port journal/lookup | Duplicate/conflict/restart and every crash-boundary test | Same request returns prior receipts; operation count remains one |
| 4 | Advisor ACK and canonical intake/decision evidence | Git-verified internal ingress and authority verifier | Stage-order, forged evidence, authorityRole, Leo/Advisor boundary tests | Separate committed ACK/intake and bounded synthetic decision/resume evidence |
| 5 | Manual kill switch and fallback | External snapshot checks plus local durable latch | kill/disable/expiry/restart/no-auto-enable tests | Cleanup latches disabled and restart remains manual |
| 6 | No Worker/Reviewer choice or direct browser dispatch | Closed Leo message HTTP/UI and fixed adapter | Unknown field/route/module scans and negative E2E | Browser exposes no target/role/terminal control |
| 7 | No command/shell/broadcast/wildcard/automatic approval | Closed transport runner and exact argv/key | Process-spawn/hostile-content/sync/wildcard/key tests and security review | Captured non-secret argv evidence shows only fixed sequence |
| 8 | Loopback-only unless separately decided | Exact LocalBootstrap v3 preserving v2 network values | Full network/auth/PWA/private-network-disabled regression | Exact 127.0.0.1 listener only; stopped/absent after cleanup |
| 9 | Dual Fable5 review and synthetic actual rehearsal before use | AO-WU-18 -> 19 -> 20 -> 21 -> 15 train | Two independent PASS artifacts; no skipped dependency | Advisor AO-WU-21 package and final audit evidence |

No criterion is complete from this design candidate. Each remains
`IMPLEMENTED_DISABLED__PENDING_FABLE5_IMPLEMENTATION_SECURITY_REVIEW`.

## 17. Deferred gates and explicit non-goals

Deferred or separately governed:

- actual capability/activation grant, enabled descriptor, readiness lease, real
  proof, server start, tmux input, and rehearsal;
- Fable5 design and implementation/security verdicts;
- Advisor final M01 audit and Leo/GPT final approval;
- private-network/Tailscale/SSH/Mac/remote collection, TLS/proxy, public or
  production/live deployment;
- DB/schema/migration, multi-user auth, secrets or long-lived credentials;
- Hermes implementation;
- Worker/Reviewer dispatch or any non-Advisor destination;
- arbitrary terminal/shell/key/process access;
- changing the external tmux transport protocol, global kill state, or other
  repositories from Agent Office runtime; and
- final closure or automatic next-mission selection.

The safe current state remains: server stopped, enabled deployment/operational
descriptor absent, readiness lease and capability instance absent, global manual
fallback available, Agent Office exact delivery unconfigured/default-disabled,
and no tmux input. The reviewed production port code exists but is unreachable
from committed configuration until later authority gates are satisfied.
