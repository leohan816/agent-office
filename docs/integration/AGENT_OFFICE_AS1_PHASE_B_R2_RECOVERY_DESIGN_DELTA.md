# Agent Office AS1 Phase B R2 Recovery Design Delta

Status: F02 DESIGN CANDIDATE — same-Reviewer review and an exact Advisor
implementation handoff are still required.

Mission: AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_PILOT_001

Work unit: PHASE_B_R2_RECOVERY_F02_FIXED_ORIGINAL_ROOT_PRESERVATION_DESIGN

F02 authority: the committed Designer handoff
advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/102_PHASE_B_R2_RECOVERY_F02_DESIGNER_HANDOFF.md
and run prompt 102A at governance commit
50507326ee3c4e2dba9b6defd45ab73d3b599cc2.

Accepted R2 design commit:
a837bbf9d4072638a6dac676fb5ccc8da9bfa1ff.

Current F01-reviewed product baseline:
d0b14949181d89c2caeb4e93bca91a2ea1647c80.

## 1. Decision and scope

F02_DESIGN_HOLD: NO.

LIVE_R2_SLACK_ACTIVATION: BLOCKED pending implementation, fixed-scratch
privilege/filesystem validation, same-Reviewer PASS, and a separate live
handoff.

The exact recovery fits the existing Phase B architecture without a new
authority schema, durable-store schema, database, or notification framework.
The smallest safe delta is:

1. replace only the post-hello Socket structural walk with a Socket-local
   maximum depth of 10, leaving the general JSON contract at 8;
2. bind every active owner and observer path to one new fixed R2 state root and
   root ID, while making the original root operationally read-only forensic
   evidence; and
3. add four closed user-status values to the existing profile-local durable
   outbox, deriving their target from the already-accepted root correlation.

This document is additive and controls the R2 recovery where it differs from
the accepted Phase B design. Every identity, provenance, one-use delivery,
incident gate, no-blind-resend, and single-profile rule not changed here
remains in force.

This F02 delta closes only the concrete production preservation-helper,
invocation, manifest, result, and validation surfaces left open by Advisor
audit 101. It does not redesign F01, Exact Delivery, Slack routing, identity,
status behavior, or the sequential two-profile architecture.

This is a design result only. It grants no implementation, activation, secret
access, Slack connection, state-root mutation, tmux mutation, risk acceptance,
or live-pilot authority.

## 2. Incident facts and non-goals

The accepted evidence establishes:

- the live Socket passed receive-grant, secret, workspace, App, channel, Leo,
  and hello gates;
- the first bounded top-level Leo message then latched the profile at
  2026-07-17T03:40:08.755Z with the redacted reason
  malformed frame after ready;
- no receipt, intake, delivery authority, tmux mutation, Advisor ACK, status,
  or result was created;
- the raw frame was correctly neither logged nor persisted; and
- the owner was stopped, the descriptor was restored disabled, the fixed lock
  is absent, and no AS1 process remains.

The raw frame is intentionally unavailable and must remain unavailable. R2
does not add capture, debug logging, payload logging, a parser bypass, a
fallback root, a reset, or a second simultaneous profile.

## 3. Socket rich-text compatibility

### 3.1 Exact entry point

The only changed parser boundary is parseTrustedJson in:

src/adapters/gateways/slack-pilot/socket-frame.ts

The live call path remains:

1. As1RawSocketTransport.dispatchAfterReady receives a post-hello text frame;
2. parseTrustedJson checks the raw UTF-8 size, parses JSON to unknown, and
   performs the bounded structural walk;
3. isDisconnectFrame may recognize a shallow provider control frame;
4. parseEventsApiValue enforces the exact Events API outer contract; and
5. As1InboundService performs the unchanged workspace, App, authorization,
   channel, Leo, surface, replay, timestamp, and bounded event.text checks.

The first-frame hello lexer is unchanged. General JSON parsing remains
permitted only after App-ID proof. socket-client.ts requires no runtime change;
its existing malformed-frame latch remains the fail-closed consumer of a
local-walk rejection.

### 3.2 Exact local limit

Define a Socket-only constant in socket-frame.ts:

    SOCKET_EVENT_JSON_DEPTH_MAX = 10

The local walk uses the same counting convention as the current shared walk:
the outer value starts at depth 1 and every object property or array element,
including a primitive leaf, advances depth by one.

For the required ordinary plain rich-text message, the deepest path is:

| Depth | Value |
| ---: | --- |
| 1 | Events API outer object |
| 2 | payload object |
| 3 | event object |
| 4 | blocks array |
| 5 | rich_text block object |
| 6 | block elements array |
| 7 | rich_text_section object |
| 8 | section elements array |
| 9 | inline text element object |
| 10 | inline text primitive |

Ten is therefore sufficient for the approved ordinary top-level message and
is two levels narrower than an unbounded or arbitrary Slack block parser. The
pilot does not interpret blocks. The authoritative message content remains
the separately bounded event.text string. Optional deeper block structures,
including an inline child object with a primitive below it, fail closed. A
future need for styled elements, nested rich-text lists, or another deeper
shape requires new evidence and explicit authority; it is not inferred here.

The Socket-local walk preserves all existing bounds:

- raw UTF-8 frame size is at most 32,768 bytes;
- JSON.stringify of the parsed value is also at most 32,768 UTF-8 bytes;
- every array has at most 16 entries;
- known envelope identifiers, retry fields, event identifiers, timestamps,
  authorization fields, and event.text retain their existing field bounds;
- all otherwise-unused strings are bounded by the enclosing 32,768-byte frame;
- malformed JSON, over-depth values, oversized arrays, and oversized frames
  still reject before field access; and
- no rejection includes raw bytes, values, IDs, URLs, tokens, or provider
  error text.

The shared LIMITS.JSON_NESTING_DEPTH_MAX remains exactly 8. The general
assertBoundedJsonStructure implementation and all unrelated callers remain
unchanged. Direct code evidence shows socket-frame.ts is its only current
runtime caller, but a local boundary still avoids silently redefining the
general contract.

### 3.3 Exact accepted fixture

The focused parser and Socket tests use this exact value, serialized with
JSON.stringify. Placeholder IDs are test identities, never live values:

~~~json
{
  "type": "events_api",
  "envelope_id": "Env0AGENTOFFICE01",
  "accepts_response_payload": false,
  "payload": {
    "type": "event_callback",
    "team_id": "TWORKSPACE001",
    "api_app_id": "AAGENTOFFICE01",
    "event_id": "Ev0AGENTOFFICE01",
    "event_time": 1720000000,
    "authorizations": [
      {
        "enterprise_id": null,
        "team_id": "TWORKSPACE001",
        "user_id": "UAGENTBOT001",
        "is_bot": true,
        "is_enterprise_install": false
      }
    ],
    "event": {
      "type": "message",
      "user": "ULEO0000001",
      "channel": "CAGENTOFFICE01",
      "channel_type": "group",
      "ts": "1720000000.000100",
      "event_ts": "1720000000.000100",
      "text": "please start a new mission",
      "blocks": [
        {
          "type": "rich_text",
          "block_id": "b1",
          "elements": [
            {
              "type": "rich_text_section",
              "elements": [
                {
                  "type": "text",
                  "text": "please start a new mission"
                }
              ]
            }
          ]
        }
      ]
    }
  }
}
~~~

The maximum-depth assertion is the inline text value at depth 10. The test
must prove both parseEventsApiFrame acceptance and delivery through an armed
As1RawSocketTransport without a malformed-frame latch.

The outer-envelope contract remains exact. The only permitted outer key names
remain:

    type
    envelope_id
    accepts_response_payload
    retry_attempt
    retry_reason
    payload

The required type remains events_api; envelope_id remains bounded;
accepts_response_payload remains absent or false; retry_attempt remains a
safe integer from 0 through 64; retry_reason remains at most 256 characters;
and payload remains an object. An unknown outer key still rejects.

### 3.4 Exact one-level-over reject fixture

The rejected fixture is byte-for-byte the accepted fixture except that the
sole inline text element is:

~~~json
{
  "type": "text",
  "text": "please start a new mission",
  "unexpected": {
    "leaf": true
  }
}
~~~

The unexpected object is depth 10 and its leaf is depth 11. The local walk
must reject it before parseEventsApiValue or the inbound service sees the
payload. The pure parser test expects INVALID_SCHEMA with stable non-payload
detail. The armed Socket test expects the existing stable
REJECTED_MALFORMED_FRAME observation, one durable owning-profile latch, no
handler call, no Socket ACK, and no raw-frame text in logs or errors.

Existing exact 32,768-byte acceptance/32,769-byte rejection, array-16/17,
outer-key, disconnect, hello quarantine, and identity tests remain required.

## 4. Versioned fixed R2 state root

### 4.1 Fixed values

The sole active R2 state root is:

    /home/leo/.local/state/agent-office/as1-slack-pilot-r2

The sole active R2 state-root ID is:

    as1-slack-pilot-r2

The preserved original forensic root is:

    /home/leo/.local/state/agent-office/as1-slack-pilot

There is no environment-selected alternative, old-root fallback, discovery,
copy-forward, compatibility read, repair path, or root search.

### 4.2 Active invariants

The implementation must enforce all of the following:

1. cli.ts exports AS1_OWNER_STATE_ROOT as the exact R2 path.
2. start and redacted-check require AS1_SLACK_STATE_ROOT to equal that literal.
3. initializeStateRoot receives stateRootId as1-slack-pilot-r2.
4. As1SlackControl opens only that initialized root, and its marker, control,
   profile latch, intake, pointer, delivery, status, outbox, and recovery
   records are therefore below R2.
5. stop, incident-kill, status, restart, lock-removal proof, and durable-kill
   proof resolve only R2. They accept no root operand.
6. writer-lock.ts exports the exact fixed R2 lock:

       /home/leo/.local/state/agent-office/as1-slack-pilot-r2/locks/writer.lock

7. The sealed pidfd bridge has the same R2 lock literal and requires the lock
   record stateRootId to equal as1-slack-pilot-r2.
8. WriterLock.acquire still validates the format marker against the supplied
   stateRootId; the CLI supplies only the R2 ID.
9. A new receive grant must bind the new R2 marker-derived
   profileStateRootHash. An original-root grant or hash cannot be reused.
10. The build ID remains as1-slack-pilot. The internal durable namespace
    indexes/as1-slack-pilot, profile slugs, pilot ID, descriptor name, secret
    file name, and executable argv remain protocol/product namespaces, not
    state-root selectors, and do not change.

After implementation, the exact old state-root path must have zero occurrence
in active src code. Historical accepted design evidence may continue to name
the original root, and the setup document must name it only in the explicit
forensic-preservation section.

### 4.3 Sealed bridge identity

Only two substitutions are permitted inside PIDFD_BRIDGE_SOURCE:

- LOCK_PATH gains -r2; and
- the expected lock record stateRootId gains -r2.

No operation, environment, interpreter fact, owner argv, signal, schema,
deadline, bound, or result changes. With exactly those substitutions against
the frozen source, the new sealed literal identity is:

    PIDFD_BRIDGE_SOURCE_BYTES = 17989
    PIDFD_BRIDGE_SOURCE_SHA256 =
      sha256:d5b831e29dfb19b23f194e928258d74f2a43a2bfb51fa76350ec6595537a8de2

Implementation must recompute the UTF-8 length and SHA-256 from its staged
literal and prove they equal these values. A different result is design drift,
not a value to update opportunistically.

### 4.4 Original-root preservation gate

This is a later, exact operator step. The Designer did not execute it and did
not inspect or mutate either real state root. A shell `find`/path-based `chmod`
sequence is insufficient because a path or writer can race its checks. The
single repository-owned production helper artifact is exactly:

    scripts/as1-preserve-original-root.mjs

It is a self-contained Node ESM script using only Node built-ins and one
byte/hash-identified embedded Python literal for Linux `openat`, `fstatat`,
mount-id, `fchmod`, and `FS_IOC_GETFLAGS`/`FS_IOC_SETFLAGS`. It imports no
product module, package, configuration, secret, or runtime composition. The
existing TypeScript `preserveOriginalRootTree` remains the accepted injected-
seam algorithm proof; it is not a second production helper and is unchanged.

The helper's sole production state-root literals are:

    /home/leo/.local/state/agent-office/as1-slack-pilot
    /home/leo/.local/state/agent-office/as1-slack-pilot-r2

The original literal is used only by this forensic helper and the setup
document's forensic section, never by active owner source. The R2 literal is
used only for the installed-build proof; the helper never initializes, opens,
or writes R2. There is no second helper, shell wrapper, package-script alias,
CLI verb, root/path/environment operand, discovery, fallback, copy, migration,
repair, or unseal surface.

#### 4.4.1 One fixed no-argument invocation

The sole production invocation is byte-for-byte:

~~~bash
/usr/bin/sudo -- /usr/bin/env -i LANG=C.UTF-8 LC_ALL=C.UTF-8 \
  /home/leo/.nvm/versions/node/v24.18.0/bin/node \
  --disable-proto=throw \
  /home/leo/Project/.worktrees/agent-office/AGENT_OFFICE_AS1_PHASE_B_LIVE_PILOT_001/scripts/as1-preserve-original-root.mjs
~~~

The helper requires exactly the script entry in `process.argv`, exact
`LANG`/`LC_ALL`, closes and never reads stdin, resets cwd to `/`, and rejects
inherited `NODE_OPTIONS` or other environment. Any argument, redirected
instruction, unexpected environment key, non-root launcher, or second invocation mode returns
`INVOCATION_REJECTED` before manifest or state-root access. The invocation
contains no path operand: every path above is part of the reviewed surface.

The root Node parent opens no state root. It verifies the manifest, helper,
installed build, descriptor, Node object, and exact `/usr/bin/python3.14`
object, retains the no-follow interpreter descriptor, and executes that same
file description as child `/proc/self/fd/3` with a fixed argv and complete
two-key environment. Before opening the original root, the Python child drops
to UID/GID 1000, drops every bounding/permitted/effective capability except
`CAP_LINUX_IMMUTABLE`, sets `no_new_privs`, and verifies the resulting
`/proc/self/status` capability mask. Failure is HOLD. The privileged parent
does not inspect either state root and only records the child's bounded result.

The script has no normal unseal code. It permits only two journal-derived
behaviors through the same invocation: no terminal journal means one
preservation attempt; an already durable `PRESERVED` journal means read-only
seal/digest reverification. A STARTED, HOLD, malformed, or conflicting journal
blocks all root access and requires Advisor routing.

#### 4.4.2 Install R2-only code before preservation

The descriptor remains committed disabled throughout this sequence. Before
opening the original root, the later operator must install the exact
independently accepted implementation commit at the fixed active executable
argv and record its build manifest. Against both the reviewed `src` tree and
the installed `dist/core` tree, the gate must prove:

- the original absolute state-root literal has zero active occurrence;
- an old `stateRootId` comparison has zero active occurrence;
- the exact R2 root, R2 root ID, fixed R2 lock, and sealed R2 bridge facts are
  present at their specified sites;
- start and observer surfaces accept no state-root operand, alternative
  environment value, discovery, compatibility read, or fallback; and
- the installed executable and every loaded product module are regular,
  no-follow-opened, one-link objects whose hashes match the reviewed build
  manifest.

Only after that proof may preservation begin. Thus any newly started exact AS1
owner would be R2-only. The gate then proves from `/proc` that no exact AS1
owner argv is active and proves through the pinned original-root descriptor
that `locks/writer.lock` is absent. A process or lock produces a fixed
`ORIGINAL_ROOT_BUSY` outcome before any tree permission change.

#### 4.4.3 Fixed descriptor-relative preservation algorithm

The helper runs with the exact reviewed interpreter and only the privilege
needed for the Linux immutable inode flag. It performs these ordered steps:

1. Starting at a no-follow-opened `/` descriptor, open every fixed ancestor,
   the parent, root, and `locks` directory with `openat` plus
   `O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC`. Retain the descriptors and record each
   `(st_dev, st_ino, mount-id)` tuple. At every phase, `fstatat` from the pinned
   parent with `AT_SYMLINK_NOFOLLOW` must still name the same pinned root.
2. Walk only by sorted directory entries and `openat` relative to retained
   directory descriptors. Never reopen a concatenated pathname. Reject `.`,
   `..`, slash-bearing or otherwise non-contained components, symlinks,
   devices, sockets, FIFOs, mount transitions, duplicate `(device,inode)`
   identities, and every regular file whose link count is not one. Every
   opened entry must retain the root mount ID.
3. Retain a no-follow descriptor for every accepted directory and regular file
   until its identity and seal are verified. Descriptor exhaustion or any
   unapproved changed type, link count, device, inode, mount ID, size, data
   modification time, or entry set before that inode's seal fails closed.
   Ctime changes caused only by the prescribed mode/immutable operations are
   expected metadata, not evidence-byte or path drift.
4. Compute the initial byte/path digest from the pinned descriptors. The
   canonical stream is the sorted sequence of
   `type NUL relative-path NUL size NUL file-SHA256 NUL`; it includes empty
   directories and excludes only the mode/immutable metadata intentionally
   changed by this gate.
5. Re-prove the installed R2-only manifest, disabled descriptor, absent exact
   AS1 process, absent original lock, full ancestor/root identity, unchanged
   traversal, and unchanged initial digest.
6. Establish exclusive original namespace quiescence before changing the
   remainder: through the retained descriptors, remove write bits from the
   root and `locks` directory and set `FS_IMMUTABLE_FL` on both with
   `FS_IOC_SETFLAGS`. Immediately re-prove process absence, lock absence,
   ancestor/root/locks identity, the complete entry set, and the initial
   digest. If a lock or substitution won the preceding interval, the helper
   reports `ORIGINAL_ROOT_PRESERVATION_RACE` and does not continue. With the
   exact lock namespace immutable and no old-root-capable active executable,
   no AS1 owner can reacquire the original root during the remaining work.
7. For every remaining pinned directory and regular file, remove all write
   bits with descriptor `fchmod`, set `FS_IMMUTABLE_FL` with descriptor ioctl,
   and verify the same descriptor identity and flag. Never clear an existing
   immutable bit. A partial failure remains fail-closed and makes no
   preservation-success claim; it does not unseal or roll back protected
   entries.
8. Before calculating the final digest, re-prove no AS1 process, no original
   lock, the complete pinned ancestor/root relationship, one mount ID, the
   exact same sorted path/inode set, allowed types, one-link regular files,
   zero write bits, and the immutable flag on every root entry. Only after all
   of those final proofs may the helper read the pinned regular-file
   descriptors, calculate the final byte/path digest, and require it to equal
   the initial digest.

The recorded success evidence contains both equal digests, the reviewed build
manifest hash, the pinned parent/root identity, the entry count, and fixed
boolean process/lock/no-follow/one-link/single-mount/zero-write/immutable
proofs. It contains no evidence bytes or secret values.

Immutable flags plus removed write bits are the persistent forensic seal; the
R2-only executable is the independent namespace barrier. Every later AS1
preflight and rollback must re-run the read-only descriptor-relative identity,
digest, zero-write, and immutable proof. Any missing flag, writable inode,
identity drift, old-root reference, or digest mismatch is HOLD. No normal
rollback clears the seal. Clearing it requires a new, explicit forensic-risk
decision outside this mission, so preservation does not rest on narrative or
one reversible mode-bit check.

The lifecycle proof uses only a temporary synthetic tree and injected
filesystem/process seams. At the deterministic boundary after the initial
scan and before namespace quiescence, a child creates the synthetic old lock
and presents the exact synthetic owner marker. The immediate recheck must
return `ORIGINAL_ROOT_PRESERVATION_RACE`, perform no remaining permission
changes, emit no final digest or success record, and never resolve either real
state-root literal. A sibling identity-swap assertion verifies that a replaced
root inode is likewise rejected through the pinned-parent comparison. These
are test-only seams; the production helper remains fixed-root and
no-argument.

The production helper applies fixed bounds before sealing: at most 8,192
retained entries, depth 32, 255 UTF-8 bytes per component, 4,096 UTF-8 bytes
per relative path, 8 MiB per regular file, and 256 MiB total file bytes. It
requires a descriptor limit sufficient to retain every accepted entry plus
the fixed ancestor/result/manifest descriptors. A bound or descriptor shortfall
is HOLD before success, never truncation, streaming path re-open, or discovery.

#### 4.4.4 Reviewed build/install manifest

The fixed manifest evidence path is:

    artifacts/as1-multi-team-slack-pilot/PHASE_B_R2_PRESERVATION_BUILD_INSTALL_MANIFEST.json

It is canonical JSON plus LF, generated only after the future implementation
source commit is clean and `npm run build:core` succeeds. It is committed with
the future implementation result evidence, independently regenerated, and its
file SHA-256 is pinned by the same Reviewer's result and the later operator
handoff. It is evidence and an integrity precondition, not delivery or live
authority.

The closed schema records: schema version; implementation source commit; exact
build command; fixed worktree identity; complete sorted regular-file counts and
canonical path/size/SHA-256 tree digests for `src` and `dist/core`; helper byte
count and SHA-256; package-lock, package, and build-tsconfig SHA-256 values;
disabled descriptor SHA-256; exact Node and Python device/inode/owner/mode/
link/size/SHA-256 facts; sealed Python-literal byte count/SHA-256; zero active
old-root and old-root-ID comparison counts; and exact R2 CLI/lock/root-ID/
bridge proof digests. It contains no token, secret, environment value, state
byte, caller-selected path, or executable operand.

The helper owns the fixed paths and exact manifest keys. It never executes or
opens a path supplied by the manifest. Before the original-root descriptor is
opened, it no-follow opens and pins the fixed worktree, helper, manifest,
disabled descriptor, `src`, and `dist/core`; rejects a symlink, special file,
mount transition, multiply-linked regular file, entry-set drift, or unexpected
manifest key; recomputes every byte/tree/static proof; and requires the
committed descriptor to remain `enabled: false` and `receiveGrantRef: null`
with accepted SHA-256
`8e3b9985f09b366e046d03392bd60b2157264ec1f2eb4498bfa92e615802f5d7`.
Any missing or mismatched provenance fact is `HOLD_PROVENANCE`; no state root
is opened and no weaker source-only or caller assertion is accepted.

#### 4.4.5 Durable redacted result and recovery

The fixed operator-result journal is:

    artifacts/as1-multi-team-slack-pilot/PHASE_B_R2_ORIGINAL_ROOT_PRESERVATION_OPERATOR_RESULT.jsonl

Before original-root access, the helper no-follow pins the existing artifacts
directory, exclusively creates the absent journal at mode 0600, writes one
canonical STARTED record, `fchown`s the retained file to UID/GID 1000 while
preserving mode 0600, `fdatasync`s the file, and `fsync`s the directory. It
re-verifies the retained file identity/owner/mode/link count and keeps that
descriptor for the whole operation. Every terminal record is appended plus LF
and `fdatasync`ed; the helper never overwrites or deletes the journal. A crash
or durability failure leaving STARTED without a terminal record is HOLD and
forbids automatic retry.

A PRESERVED record contains only: schema/version, phase, reviewed manifest
SHA-256, equal initial/final byte-path digests, hashed parent/root identity,
entry/file-byte counts, and fixed true/false proofs for disabled, R2-only,
process-absent, lock-absent, no-follow, single-mount, one-link, zero-write, and
immutable. It contains no evidence bytes, raw inode, PID, argv, path, secret,
provider text, exception, or stack. Reinvocation after PRESERVED performs only
the same descriptor-relative traversal, process/lock/identity/seal checks and
digest comparison, then appends REVERIFIED; it performs no `fchmod` or
`FS_IOC_SETFLAGS`.

The helper emits exactly one bounded canonical redacted result line and empty
stderr. Fixed outcomes are PRESERVED, REVERIFIED, INVOCATION_REJECTED,
HOLD_PROVENANCE, HOLD_PRIVILEGE_OR_FILESYSTEM, ORIGINAL_ROOT_BUSY,
ORIGINAL_ROOT_PRESERVATION_RACE, HOLD_TRAVERSAL, HOLD_PARTIAL_SEAL,
HOLD_DIGEST, and RESULT_DURABILITY_FAILED. Dynamic exceptions map to one of
those codes and are never included in output or the journal.

#### 4.4.6 Exact HOLD behavior

- Missing privilege, unsupported ioctl/immutable behavior, unproved interpreter
  or build provenance, enabled descriptor, process/old-lock presence,
  identity/mount/traversal drift, rejected type/link/path, insufficient bound,
  incomplete zero-write/immutable seal, digest mismatch, or result durability
  failure never produces PRESERVED.
- A pre-seal failure opens no state root when possible and changes no original
  metadata. Once any seal step begins, every failure is
  HOLD_PARTIAL_SEAL or a stronger race/digest code; the helper never clears an
  immutable flag, restores a write bit, retries, repairs, or deletes evidence.
- ORIGINAL_ROOT_BUSY before sealing and any ambiguous STARTED journal require
  Advisor routing. No status permits a Worker, Reviewer, or later owner to
  infer activation authority.
- Rollback has no preservation-helper mutation. It stops only an R2 owner,
  keeps the descriptor disabled, retains both roots, and may invoke the same
  helper only for read-only REVERIFIED proof after a durable PRESERVED record.

#### 4.4.7 Synthetic and server-filesystem validation

`tests/operations/as1-slack-preservation-helper.test.ts` imports the actual
helper module without executing its direct-entry main and tests its production
core through injected in-memory descriptors/process facts. It covers exact
argv/env rejection before root access; manifest and helper-byte drift; all
type/link/mount/path rejections; entry and byte bounds; process/lock at entry
and at every race boundary; root/entry substitution; namespace-first sealing;
unsupported or partial immutable behavior; final-proof-before-final-digest
ordering; digest mismatch; journal STARTED/PRESERVED/REVERIFIED recovery; and
redaction. Normal tests resolve neither real state-root literal.

The existing `tests/operations/as1-slack-lifecycle.test.ts` changes only its
stale F02 HOLD assertion: it requires this one helper artifact and invocation,
keeps the accepted TypeScript seam tests, and proves the seam and helper core
share the closed outcomes. No F01 test or behavior changes.

Real privilege/filesystem support is a separate, later exact validation on
this server, not part of implementation tests and not run by this Designer.
The focused test named `F02_SERVER_FILESYSTEM_PRIVILEGE_VALIDATION` runs only
under an explicit privileged validation handoff. It uses the helper's fixed
test-only capability routine on the sole exclusive scratch path
`/home/leo/.local/state/agent-office/.as1-f02-preservation-filesystem-validation`;
it never stats, opens, names as a target, traverses, or mutates either real
state root. The scratch is a validation fixture, never a third state root or a
selectable path. It proves same-filesystem descriptor `fchmod`, immutable
set/get, write/create rejection while sealed, and cleanup by clearing
immutable only on the synthetic scratch, removing it, and fsyncing the parent.
Pre-existing scratch, cleanup failure, unexpected mount identity, or any
skipped assertion is HOLD. Its redacted committed result and hash require the
same independent Reviewer before preservation.

The original tree is never copied into R2. R2 starts as a new root under a
separately authorized initialization. No receipt, latch, marker, index,
pointer, delivery journal, outbox record, or other byte is migrated.

## 5. Minimal same-thread user status contract

### 5.1 Closed vocabulary

Define the following internal, closed TypeScript status kind. It is not a
durable schema and is not accepted from Slack, CLI, evidence, or an external
caller:

    ACCEPTED
    DELIVERY_CONFIRMED
    DELIVERY_FAILED
    PROCESSING_FAILED

The renderer is a total constant map:

| Kind | Exact text |
| --- | --- |
| ACCEPTED | 요청 접수 완료 · Advisor에게 전달 중 |
| DELIVERY_CONFIRMED | 메시지 전달 완료 · 답변 대기 중 |
| DELIVERY_FAILED | 전달 실패 · 요청은 실행되지 않았습니다 |
| PROCESSING_FAILED | 처리 실패 · 안전하게 중지되었습니다 |

No API accepts free-form status text. The request uses the existing
chat.postMessage port, whose production adapter fixes mrkdwn false,
reply_broadcast false, unfurl_links false, and unfurl_media false. The full
plain Korean sentence is available to visual and screen-reader clients without
blocks, emoji-only meaning, mentions, or layout assumptions.

Final RESULT evidence remains a business result, not a status. No fifth
progress/failure status is introduced. For this R2 private composition,
accepted INTAKE evidence is still validated and durably checkpointed but its
legacy fixed English ACK projection is not sent; DELIVERY_CONFIRMED replaces
that progress acknowledgement. Accepted RESULT projection is unchanged.
Questions and continuation UX remain outside this one-root live recovery.

### 5.2 Existing outbox fit

No new store file or schema is required. Each status uses the existing
profile-local slack-outbox journal and the existing phases:

    PREPARED
    REQUEST_STARTED
    RESPONSE_RECORDED
    MANUAL_RECONCILIATION_REQUIRED

The existing journal already binds immutable request and response artifact
hashes, rejects illegal transitions, resumes PREPARED only with identical
request bytes, never resends REQUEST_STARTED, and treats ambiguity as manual
reconciliation plus a profile latch. Its capacity of 128 records is sufficient
for the bounded one-intake pilot.

As1Outbox gains a narrow sendStatus(intakeId, statusKind) entry. It accepts
neither a target nor text. Internally it shares the exact existing
root-resolution, request-artifact, phase, retry, response-validation, and
reconciliation path used by accepted evidence. The existing branded
As1AcceptedOutbound path remains required for ACK/QUESTION/RESULT evidence and
is not weakened.

### 5.3 Deterministic identity

For profile P, intake I, and closed status kind K:

    digest = lowercase SHA-256 hex of canonical JSON:
      {
        "schemaVersion": "agent-office.as1-user-status-identity.v1",
        "profileId": P,
        "intakeId": I,
        "statusKind": K
      }

    outboundId = "as1status-" followed by digest

The ID is 74 ASCII bytes, a valid opaque ID and path segment. The same status
for the same profile/intake can have only one journal identity. A different
kind has a different identity. No timestamp, retry counter, reason, channel,
or caller nonce participates.

The immutable request artifact is exactly:

~~~json
{
  "kind": "USER_STATUS",
  "statusKind": "<closed kind>",
  "profileId": "<selected closed profile>",
  "intakeId": "<accepted intake>",
  "rootTs": "<accepted root timestamp>",
  "rootKeyHash": "<accepted root hash>",
  "sourceEventId": "<accepted source event>",
  "channel": "<selected profile channel>",
  "threadTs": "<same accepted root timestamp>",
  "text": "<exact constant text>"
}
~~~

The token is never persisted. A replay re-derives byte-identical request
content or moves to manual reconciliation; it never replaces the artifact.

### 5.4 Safe target validation

Before every status durable write or Web call, the outbox must:

1. resolve findRootByIntakeId(intakeId) from the selected profile store below
   R2;
2. require the returned root intakeId to equal the requested intake;
3. recompute rootKeyHash from selected profile ID plus the construction-bound
   workspace, App, channel, and rootTs;
4. require exact equality with the durable rootKeyHash;
5. derive channel only from the selected validated profile secret;
6. derive threadTs only from the immutable root rootTs; and
7. pass the current incident/control/profile-latch predicate immediately
   before each durable or network side effect.

The initial ACCEPTED trigger is additionally limited to a
NEW_MISSION_ROOT result from As1InboundService. That result occurs only after
the service has validated workspace, App, the exact single authorization,
private-channel surface, channel, Leo user, top-level shape, timestamps, and
bounded event.text, then durably materialized the intake, pointer, and root
correlation. A rejected, duplicate, continuation, bot, wrong-user,
wrong-channel, wrong-App, wrong-workspace, mutated, threaded, or malformed
event sends no status.

No status target comes from the raw blocks tree, Advisor evidence, CLI,
delivery grant, failure object, or status caller.

### 5.5 Durable lifecycle

The following table is normative. “Recorded” means the status's outbox phase
is RESPONSE_RECORDED, not merely that a Web call began.

| State/fact | Required proof | Status action | Permitted next state |
| --- | --- | --- | --- |
| No accepted intake | Identity/root validation incomplete | None | Durable accepted new root only |
| Durable accepted new root | MATERIALIZED transport, matching root correlation, valid reply target | Send ACCEPTED; do not expose the intake to delivery until recorded | Delivery pending |
| Delivery awaiting authority | ACCEPTED recorded; grant or lease not READY | None; 250 ms bounded owner polling continues | Another pending observation or exact delivery attempt |
| Proven pre-paste stop | Exact transport returns STOPPED_BEFORE_PASTE and a fresh derived-delivery journal read is null | Send DELIVERY_FAILED | Terminal owner halt |
| Ambiguous/in-flight delivery | PREPARED or any later nonterminal/manual journal exists | None; never claim non-execution | Manual reconciliation and halt |
| Terminal tmux, ACK absent | Exact journal is TRANSPORT_RECORDED; accepted server Advisor ACK evidence is not READY | None; evidence polling continues | ACK acceptance or post-delivery failure |
| Advisor ACK accepted | TRANSPORT_RECORDED is re-read, ACK evidence passes the full accepted evidence authority, and both failure-status records are absent in every phase | Send DELIVERY_CONFIRMED before considering INTAKE or RESULT projection | Await/process remaining evidence |
| Post-delivery processing failure | TRANSPORT_RECORDED is re-read; a non-benign evidence/projection operation fails while incident/control output remains open | Start PROCESSING_FAILED once; its first durable phase immediately becomes the processing terminal barrier | Failure-only recovery, then durable latch/stop |
| Any durable DELIVERY_FAILED phase | Its deterministic sibling record exists, including PREPARED | Enter delivery-failure-only recovery; never inspect or mutate tmux or reuse delivery authority | Complete only the identical PREPARED failure status if permitted, then durable latch/stop |
| Any durable PROCESSING_FAILED phase | Its deterministic sibling record exists, including PREPARED | Enter processing-failure-only recovery; never resume evidence, status progression, or business projection | Complete only the identical PREPARED failure status if permitted, then durable latch/stop |
| Security latch or incident already closed | Profile/global latch, divergence latch, incident gate, or unsafe target is active | None; status never bypasses the gate | Existing fail-closed halt |
| Final result accepted | ACK and INTAKE chain accepted, RESULT authority accepted, and neither failure record exists in any phase | Send the existing RESULT business outbound | Manual clean stop/audit |

STOPPED_BEFORE_PASTE is safe for DELIVERY_FAILED only because the exact
transport returns it before PREPARED and before buffer load, paste, or Enter.
Composition must derive the delivery ID from the already-parsed grant and
freshly prove readTmuxPhase(deliveryId) is null before posting. A
MANUAL_RECONCILIATION_REQUIRED result, any PREPARED-or-later record, an
exception with unknown commit point, or a missing proof sends no delivery
failure. Thus “요청은 실행되지 않았습니다” is never asserted after possible
execution.

Processing-failure eligibility is narrow: it is invoked only by the catch
around post-TRANSPORT_RECORDED evidence/projection work, not by the global
owner catch. NOT_READY is benign and never a failure. Planned SIGINT/SIGTERM,
grant expiry before an exact delivery attempt, operator stop, and incident
kill do not synthesize a user failure. If the underlying defect has already
latched or closed incident admission, the status gate refuses and the
existing latch wins.

### 5.6 Ordering and mutual exclusion

Before any status or post-intake work, composition derives all four sibling
IDs and reads their outbox records. Record *existence*, not successful Slack
delivery, is the durable fact. Define the closed classifier:

    no DELIVERY_FAILED record + no PROCESSING_FAILED record -> OPEN
    any DELIVERY_FAILED phase + no PROCESSING_FAILED record -> DELIVERY_FAILED_BARRIER
    no DELIVERY_FAILED record + any PROCESSING_FAILED phase -> PROCESSING_FAILED_BARRIER
    both failure records present -> FAILURE_STATUS_CONFLICT

`PREPARED`, `REQUEST_STARTED`, `RESPONSE_RECORDED`, and
`MANUAL_RECONCILIATION_REQUIRED` all count. The classifier uses the existing
deterministic status IDs and existing outbox records; it adds no store or
schema.

The exact rules are:

1. Every later status requires ACCEPTED at RESPONSE_RECORDED.
2. A later status with absent or nonterminal ACCEPTED is corrupt/ambiguous;
   latch and send nothing.
3. DELIVERY_FAILED may begin only while DELIVERY_CONFIRMED and
   PROCESSING_FAILED are wholly absent.
4. DELIVERY_CONFIRMED may begin only while both DELIVERY_FAILED and
   PROCESSING_FAILED are wholly absent. Recheck this immediately before its
   PREPARED write, REQUEST_STARTED write, Web call, response write, and
   RESPONSE_RECORDED write.
5. PROCESSING_FAILED may begin only after terminal tmux proof and while
   DELIVERY_FAILED is wholly absent. It may follow DELIVERY_CONFIRMED or, if
   processing failed before ACK acceptance, ACCEPTED directly.
6. Once either failure record reaches its first durable phase, no other
   status, evidence checkpoint, business outbound, or delivery operation may
   begin. The only exception is exact recovery of that same failure kind from
   its own PREPARED record with an identical request hash.
7. Same-failure PREPARED recovery may execute only the existing bounded safe
   outbox path for that byte-identical request. It never observes a grant,
   lease, capability, tmux pane, ACK, INTAKE, or RESULT. REQUEST_STARTED is
   never resent; RESPONSE_RECORDED is already terminal; manual remains
   terminal.
8. A failure-status conflict sends nothing and uses the stronger fixed
   `status-terminal-conflict` latch code. No conflict repair, deletion, or
   precedence-based retry exists.
9. The single foreground writer lock, one in-flight Socket handler, and
   sequential owner loop remain the concurrency boundary; no parallel status
   sender is added.

The outbox record itself is the crash-durable terminal barrier. It therefore
survives a crash before the separate profile latch, which is defense in depth
rather than the sole authority stop.

#### 5.6.1 Deterministic recovery and latch transition

On observing a failure barrier, composition synchronously enters a closed
failure-only admission state before returning the intake to the owner. It
sets `lastIntakeId` to unavailable for delivery, discards retained in-memory
delivery-grant/lease pairs, and refuses every pointer-grant, lease, capability,
tmux, evidence, nonmatching status, and business-output entry point.

It then performs exactly one deterministic transition:

- DELIVERY_FAILED_BARRIER uses latch code
  `status-terminal-delivery-failed`;
- PROCESSING_FAILED_BARRIER uses latch code
  `status-terminal-processing-failed`; and
- FAILURE_STATUS_CONFLICT uses latch code `status-terminal-conflict`.

For PREPARED only, the failure-only admission state may first let the same
status ID finish through the identical-request safe outbox path. It then
durably latches and stops whether that completion delivered, reconciled, or
was refused. For REQUEST_STARTED, RESPONSE_RECORDED, manual, or conflict, it
latches and stops immediately without a Web retry. If the process crashes
before or during latch, the unchanged failure outbox record recreates the
same failure-only state and same latch decision on the next start. No reset or
operator retry can reinterpret that record as delivery or processing
authority.

### 5.7 Trigger placement and crash recovery

Terminal-status inspection is the first post-store recovery decision. During
startup, after the fixed receive grant selects the one R2 profile and its
existing receive state/root correlation identifies an intake, but before
Socket arm, `lastIntakeId` exposure, pointer-grant/lease observation, tmux,
evidence, status replay, or business outbound, composition derives and reads
the failure siblings. It handles a barrier exactly as section 5.6.1 and does
not enter the live owner loop. Only an OPEN classification may continue with
ordinary ACCEPTED recovery and receive arm.

The same classifier is re-read at these immediate boundaries:

- at `deliverPending` entry, before observing a pointer-delivery grant or
  readiness lease, and again immediately before invoking exact transport;
- at `ingestEvidenceAndProject` entry, before observing ACK or other evidence,
  and before every evidence checkpoint, status, or business projection;
- at `sendStatus` entry and before each durable or Web side effect; and
- before assigning or reusing an in-memory accepted grant/lease pair.

Because the owner loop is sequential and no parallel sender is added, these
checks close every permitted interleaving. The exact transport need not be
weakened or changed.

ACCEPTED:

- In the Socket handler, await processEnvelope.
- Only for classification NEW_MISSION_ROOT with a non-null intakeId, invoke
  the closed status sender.
- Require DELIVERY of the status through RESPONSE_RECORDED.
- Only then assign lastIntakeId, allowing deliverPending to observe it.

A crash after MATERIALIZED but before lastIntakeId assignment is closed on
startup. After the terminal-sibling OPEN proof and service.recoverPending, and
before armReceive:

1. read the current receive-grant state;
2. if it is bound, resolve the matching root by boundRootTs;
3. require receiveGrantId, sourceEventId, bindingStateHash, and root facts to
   agree;
4. require the source transport to be MATERIALIZED with the same intake and
   pointer; and
5. re-read the failure siblings; only while still OPEN, replay ACCEPTED through
   its deterministic outbox ID, assigning lastIntakeId only after
   RESPONSE_RECORDED and one final OPEN proof.

If the prior process stopped at REQUEST_STARTED, replay moves to manual
reconciliation and latches without resend or delivery. If RESPONSE_RECORDED
was durable, no second Slack post occurs.

DELIVERY_CONFIRMED:

- deliverPending retains its accepted grant/lease pair only after the exact
  transport returns DELIVERED.
- The owner continues calling ingestEvidenceAndProject on the existing
  250 ms loop after delivery, rather than calling it only once.
- ACK NOT_READY is benign.
- When ACK ingestion returns ACCEPTED, buildEvidenceAuthority has already
  required and hash-bound TRANSPORT_RECORDED. Re-require complete absence of
  both failure records, then post DELIVERY_CONFIRMED before
  observing/projecting INTAKE and RESULT in that tick.
- Re-observed identical ACK evidence produces the same status ID and no
  duplicate post.
- Stop evidence polling after RESULT_OUTBOUND:DELIVERED; a restart may perform
  one idempotent replay to rediscover that terminal fact.

DELIVERY_FAILED:

- It is emitted inside the delivery composition while the parsed grant and
  derived delivery ID are still available, after the null-journal proof and
  before the owner drains.
- As soon as PREPARED is durable, its record is the terminal delivery barrier.
  The grant, lease, and capability are never observed or consumed again, and
  neither tmux nor a contradictory result can resume after a crash.

PROCESSING_FAILED:

- It is attempted only by the narrow post-delivery evidence/projection catch.
- It re-reads TRANSPORT_RECORDED and sibling status state.
- Its first durable phase becomes the processing barrier before any later ACK,
  DELIVERY_CONFIRMED, INTAKE, RESULT, business, or alternate failure action.
- After the attempt, successful or not, the original processing error remains
  terminal and the owner latches/stops; no dynamic reason is posted. Restart
  can only complete its own identical PREPARED status, never processing.

### 5.8 Failure of a status post

All existing safe-retry rules remain:

- at most three attempts;
- retry only a proven connection-before-send failure or explicit rate limit;
- no blind resend after ambiguous request write, timeout/reset, 5xx,
  malformed success, lost response, or interrupted REQUEST_STARTED; and
- success only for the exact channel and a valid Slack response timestamp.

Any status outcome other than DELIVERED is a status-projection failure.
Composition must:

1. preserve the exact outbox phase/artifacts;
2. durably latch the selected profile with one stable local reason code if a
   stronger latch is not already active;
3. stop further delivery, evidence, status, and business outbound work;
4. never change a tmux delivery result, evidence checkpoint, or status sibling
   to success;
5. never attempt a different failure status as a fallback; and
6. expose no provider reason, stack, token, ID, path, payload, or raw text to
   Slack or CLI output.

An unsafe or unavailable reply target therefore causes zero network sends.
An ambiguous status may have reached Slack, so it is never retried and no
ordering claim is invented. For either failure status, a crash before step 2
does not reopen work: startup derives the failure-only admission state from
the preserved outbox record before any actionable boundary and repeats the
same fixed latch transition.

## 6. Accepted prior scope and exact F02 implementation allowlist

The earlier 12-path R2/F01 train is accepted history at the current baseline;
F02 does not reopen any of its source, status, delivery, Socket, CLI, bridge,
or test behavior. The future F02 implementation handoff must authorize exactly
these four source/script/doc/test paths and no others before result/pointer
evidence:

1. scripts/as1-preserve-original-root.mjs
2. docs/operations/AGENT_OFFICE_AS1_SLACK_SETUP.md
3. tests/operations/as1-slack-preservation-helper.test.ts
4. tests/operations/as1-slack-lifecycle.test.ts

Path responsibilities are exact:

- `scripts/as1-preserve-original-root.mjs` is the sole production helper,
  direct-entry parser, pinned-interpreter child boundary, manifest verifier,
  descriptor-relative traversal/sealer/reverifier, and redacted result-journal
  writer.
- The setup document replaces only its F02 HOLD text with the exact helper,
  manifest, validation, invocation, one-way activation, and rollback contract.
- The focused helper test owns synthetic production-core, manifest, journal,
  redaction, race, and separately gated fixed-scratch privilege validation.
- The lifecycle test keeps every existing seam/F01 proof and replaces only the
  stale assertion that no production helper exists.

The later implementation/result handoff may additionally name only the
manifest, implementation result/pointer, fixed-scratch validation
result/pointer, and eventual operator journal as evidence artifacts. Those are
not source or an expansion of the four-path implementation allowlist.

No change is required or permitted to `package.json`, a dependency, active
`src`, generated `dist`, configuration, descriptor, secret, accepted F01
evidence, either state root, or another project. In particular,
`writer-lock.ts`, `cli.ts`, `composition.ts`, `outbox.ts`, Exact Delivery, and
the sealed pidfd bridge remain byte-identical to baseline d0b1494.

## 7. Focused proof contract

### 7.1 Parser tests

The tests must prove:

- the exact fixture in section 3.3 reaches depth 10 and is accepted;
- the exact depth-11 mutation in section 3.4 rejects;
- the accepted fixture traverses an armed Socket without latch and reaches the
  handler once;
- the rejected fixture produces one durable malformed-frame latch, no
  handler, no ACK, and no raw value in logs;
- the general depth constant is still 8;
- 32,768/32,769-byte, array-16/17, hello, disconnect, and outer-key behavior
  does not regress.

### 7.2 Root/lifecycle tests

The tests must prove:

- AS1_OWNER_STATE_ROOT and AS1_FIXED_OWNER_LOCK_PATH are exact R2 literals;
- start rejects the old root and any other value before initialization;
- initialization receives only stateRootId as1-slack-pilot-r2;
- zero-operand observer commands resolve only the R2 lock/control root;
- the bridge literal is exactly 17,989 UTF-8 bytes with SHA-256
  d5b831e29dfb19b23f194e928258d74f2a43a2bfb51fa76350ec6595537a8de2;
- its embedded LOCK_PATH and stateRootId are exact R2 values while buildId and
  all other sealed facts remain unchanged;
- active source and installed output have no original state-root path or old
  expected root-ID comparison;
- exactly one production helper exists at
  `scripts/as1-preserve-original-root.mjs`, and the setup document contains
  exactly one production invocation equal to section 4.4.1;
- any argv/environment addition rejects before manifest or root access, and
  no package alias, CLI verb, wrapper, alternate mode, unseal, or generic path
  exists;
- the reviewed manifest is canonical, independently reproducible, and fully
  reverified before the original-root descriptor is opened;
- the fixed production preservation helper accepts no root input, uses only
  retained no-follow descriptors, rejects symlink/hard-link/mount/path escape
  and parent/root identity drift, and requires zero-write plus immutable flags
  on the complete synthetic tree;
- its final digest is calculated only after final process, lock, identity,
  traversal, and immutable proofs and equals the initial byte/path digest; and
- the deterministic temporary-tree race creates the synthetic old lock/owner
  after the initial scan and receives ORIGINAL_ROOT_PRESERVATION_RACE with no
  final digest or success. A root-inode substitution is also rejected. Neither
  real root is opened or mutated;
- STARTED without a terminal journal blocks retry, PRESERVED permits only
  read-only REVERIFIED, and every durable line is canonical/redacted; and
- normal tests make zero real-root calls, while the separately authorized
  fixed-scratch server validation proves immutable support and cleanup without
  touching either real root.

Tests use temporary roots and injected observer seams. They do not inspect or
mutate either real root.

### 7.3 Status/outbox tests

The tests must prove:

- each kind renders exactly its Korean text and accepts no caller text;
- all four deterministic IDs are stable and distinct;
- the same kind replay posts once;
- every request targets the profile channel and accepted rootTs;
- a missing/mismatched root produces no network;
- ACCEPTED is required before later statuses;
- DELIVERY_FAILED and PROCESSING_FAILED are mutually exclusive across every
  durable phase, not only successful phases, and DELIVERY_CONFIRMED requires
  both failure siblings to be wholly absent;
- REQUEST_STARTED/manual replay never resends;
- failure PREPARED replay requires the identical request hash and may complete
  only that same failure kind;
- ambiguous status posting latches and no alternate status is attempted; and
- no status artifact or message includes a token, dynamic error, stack, path,
  session ID, raw frame, or payload.

### 7.4 Composition/recovery tests

The tests must prove:

- wrong identity/surface and duplicate/continuation messages send no status;
- an accepted root records ACCEPTED before lastIntake becomes deliverable;
- restart after materialization recovers the same accepted status and intake;
- restart after status RESPONSE_RECORDED makes no second Web call;
- restart after REQUEST_STARTED makes no Web call, latches, and performs no
  delivery;
- a benign AWAITING delivery or evidence NOT_READY sends no failure;
- STOPPED_BEFORE_PASTE plus a null journal sends DELIVERY_FAILED and halts;
- PREPARED/manual/unknown delivery ambiguity sends no delivery failure;
- DELIVERY_CONFIRMED occurs only after TRANSPORT_RECORDED and accepted ACK
  evidence, and before INTAKE/RESULT processing;
- repeated 250 ms evidence polling produces no duplicate status or result;
- INTAKE remains accepted but its legacy English progress ACK is suppressed;
- final RESULT projection remains unchanged;
- an eligible post-delivery processing exception produces exactly one
  PROCESSING_FAILED and then halts;
- a pre-existing latch/incident sends no status; and
- status failure stops all subsequent tmux/evidence/outbound work.

The restart matrix is exact and runs once for each of PREPARED,
REQUEST_STARTED, RESPONSE_RECORDED, and MANUAL_RECONCILIATION_REQUIRED:

- with a DELIVERY_FAILED record plus otherwise-ready unused grant/lease, each
  restart makes zero tmux observe/buffer/load/paste/Enter calls, zero delivery
  authority observations or consumptions, and zero DELIVERY_CONFIRMED or
  RESULT sends. PREPARED may make only the byte-identical DELIVERY_FAILED Web
  attempt; the other three phases make no Web attempt. Every case ends with
  the fixed delivery-failure latch;
- with a PROCESSING_FAILED record plus ready ACK/INTAKE/RESULT artifacts, each
  restart performs zero delivery-authority reuse, evidence observation or
  checkpoint, INTAKE/RESULT projection, business output, DELIVERY_CONFIRMED,
  DELIVERY_FAILED, or other status. PREPARED may make only the byte-identical
  PROCESSING_FAILED Web attempt; the other phases make no Web attempt. Every
  case ends with the fixed processing-failure latch; and
- with both failure records present, restart performs no Web, tmux, evidence,
  status, or business work and records only the fixed conflict latch.

### 7.5 Exact focused commands for a later Worker

Run from the authorized product worktree:

~~~bash
npx eslint scripts/as1-preserve-original-root.mjs tests/operations/as1-slack-preservation-helper.test.ts tests/operations/as1-slack-lifecycle.test.ts

npx tsc --noEmit -p tsconfig.json

npx vitest run --maxWorkers=1 tests/operations/as1-slack-preservation-helper.test.ts tests/operations/as1-slack-lifecycle.test.ts

npm run build:core

git diff --check

test -z "$(rg -l -F '/home/leo/.local/state/agent-office/as1-slack-pilot/' src || true)"

test -z "$(rg -l -F 'value["stateRootId"] == "as1-slack-pilot"' src || true)"

test "$(rg -l -F '/home/leo/.local/state/agent-office/as1-slack-pilot' scripts docs/operations/AGENT_OFFICE_AS1_SLACK_SETUP.md | sort)" = "docs/operations/AGENT_OFFICE_AS1_SLACK_SETUP.md
scripts/as1-preserve-original-root.mjs"
~~~

The implementation Worker then generates the fixed canonical build/install
manifest from the clean source commit and build, commits it only with result
evidence, and returns without executing the helper. The independent Reviewer
must reproduce the commands and manifest before any server validation.

The real-filesystem test is not part of the command block above. Only a later
exact privilege-validation handoff may run the one focused
`F02_SERVER_FILESYSTEM_PRIVILEGE_VALIDATION` test as the fixed privileged user;
the result is invalid if any other test runs privileged, the named test skips,
the scratch cleanup is unproved, or either real root is accessed.

The implementation handoff may require inherited documentation/Git gates but
must not expand the four source/script/doc/test paths. The Designer ran no
product suite.

## 8. Disabled rollout and rollback

### 8.1 Rollout gates

The safe order is:

1. keep the committed descriptor disabled;
2. obtain the same independent Reviewer's PASS on this F02 design;
3. issue an exact four-path implementation handoff;
4. implement the helper, setup delta, and synthetic tests without root access;
   commit/push the source patch, build from that clean commit, generate the
   manifest and result evidence, and obtain the same Reviewer's source/test/
   manifest PASS;
5. under a separate exact server-validation handoff, run only the fixed-scratch
   privilege/filesystem test, commit its redacted result, and obtain the same
   Reviewer's validation PASS;
6. install the exact reviewed helper/build/manifest at the fixed worktree while
   still disabled, then re-prove the reviewed manifest, helper bytes, active
   R2-only source/output, and exact disabled descriptor;
7. prove no AS1 process and no original lock, run the sole no-argument helper
   once, and require a durable PRESERVED journal with equal byte/path digests;
8. run the same invocation again in journal-derived read-only mode and require
   durable REVERIFIED seal/digest proof;
9. under a separate live-owner handoff, initialize only the R2 root with ID
   as1-slack-pilot-r2;
10. mint fresh R2-bound grant/lease evidence; never copy or reuse original-root
   state;
11. reverify the live Agent Office destination and redacted preflight with no
    tmux mutation, including another read-only original-root seal proof;
12. only Leo/GPT may authorize value-only activation and exactly one Agent
    Office Slack round trip; and
13. stop the R2 owner, prove lock/process absence, retain both roots and the
    journal, and return the complete audit before any further pilot.

No step here authorizes those later actions.

### 8.2 Rollback

Operational rollback is disabled configuration, not restoration of the old
root binding:

1. stop the foreground owner through the fixed R2 observer path;
2. prove the R2 writer lock absent and no AS1 process;
3. restore or retain the committed disabled descriptor;
4. make no further Socket, Web, evidence, status, or tmux attempt;
5. retain the original root byte/path-identical, zero-write, and immutable;
6. retain the entire R2 root as recovery evidence; do not reset, delete,
   repair, merge, or copy either tree; and
7. return both root states and redacted process/lock proof to the Advisor.

A source revert must never restore an active reference to the original root.
If parser/status code must later be backed out, a new reviewed patch must keep
the R2 path/ID and descriptor disabled. Re-enabling the original root is not a
rollback option. Rollback never clears an original-root immutable flag or
changes its digest, relative paths, or bytes. It never runs a preservation
mutation again: after PRESERVED, the sole helper invocation is read-only
REVERIFIED or HOLD.

## 9. Non-expansion confirmation

This delta introduces none of the following:

- database, database access, migration, or durable schema version;
- Registry or canonical authority-schema change;
- generic notification/status framework;
- systemd or other service manager;
- UI, browser dispatch, responsive-layout surface, or arbitrary terminal
  execution;
- new Slack method, channel, workspace, App, user, profile selector, or raw
  logging;
- VibeNews or another product/project/repository;
- secret, credential, token logging, or token persistence;
- automatic reconnect, reset, fallback, cross-root read, or state migration;
- simultaneous two-profile operation; or
- direct browser-to-Worker/Reviewer dispatch.

The fixed private pilot remains one workspace, Leo only, two committed Apps
with immutable channel/profile mappings, and one manually selected foreground
profile at a time.

## 10. Residual unknowns and readiness

Known, bounded unknowns:

- The incident frame is unavailable by design. The accepted max-10 fixture is
  based on the Founder-approved classification and the load-bearing ordinary
  rich-text shape, not a recovered payload.
- Slack may emit a legitimate deeper optional rich-text structure. R2 rejects
  and latches it; no speculative widening or logging is authorized.
- The sealed R2 bridge identity is calculated from exactly two substitutions
  against the frozen baseline. Any other literal edit invalidates this design
  identity.
- The later preservation gate must prove that descriptor `fchmod` and
  `FS_IMMUTABLE_FL` are supported with the authorized privilege on the actual
  original-root filesystem. Unsupported behavior is HOLD, never a weaker
  fallback; this Designer did not probe the real root or filesystem.
- The future source commit, helper/Python-literal hashes, tree digests, and
  manifest SHA-256 do not exist yet. The implementation and same-Reviewer
  evidence must record them; they are never supplied as runtime operands or
  guessed by this design.
- The fixed production helper and fixed-scratch validation are designed but
  not implemented or executed. F02 therefore remains a live-activation HOLD
  even though this design has no unresolved architectural HOLD.
- No live Slack post, real status delivery, real R2 initialization, or real
  tmux delivery has been performed by this Designer.

Implementation readiness:

DESIGN_STATE: READY_FOR_SAME_REVIEWER_F02_DESIGN_REVIEW.

Implementation is ready only if the same independent Reviewer accepts this
delta and the responsible Advisor issues an exact implementation handoff with
the four-path allowlist. Live readiness remains blocked until the implemented
helper, reproducible manifest, fixed-scratch privilege result, actual
PRESERVED/REVERIFIED journal, R2-only initialization, and live destination
preflight each pass their separate authority and review gates.

This Designer result is not independent review, implementation approval, risk
acceptance, final closure, or authority to start the next mission.
