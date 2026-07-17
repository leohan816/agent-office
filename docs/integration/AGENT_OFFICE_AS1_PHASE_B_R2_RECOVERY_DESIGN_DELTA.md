# Agent Office AS1 Phase B R2 Recovery Design Delta

Status: F02 FIXED LAUNCHER COMPATIBILITY PATCH CANDIDATE — same-Reviewer delta
review and an exact Advisor implementation handoff are still required.

Mission: AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_PILOT_001

Work unit: PHASE_B_R2_RECOVERY_F02_FIXED_LAUNCHER_COMPATIBILITY_PATCH

Original F02 authority: the committed Designer handoff
advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/102_PHASE_B_R2_RECOVERY_F02_DESIGNER_HANDOFF.md
and run prompt 102A at governance commit
50507326ee3c4e2dba9b6defd45ab73d3b599cc2.

Bounded patch authority: committed Designer patch handoff
advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/105_PHASE_B_R2_RECOVERY_F02_DESIGN_PATCH_HANDOFF.md
at governance commit ea8783b9572bfeb30f9896de273dd70c25b92878.

Same-Reviewer NEEDS_PATCH result: governance commit
7b0bdb43f2fcd00f1aceba6f9c1a23c5a2ea5132, findings F02-D1 through
F02-D6 only.

Same-Reviewer F02-D1-D6 PASS result: governance commit
3df77ffba0d95dac96abfdbabe1b0e897d273313.

Fixed-launcher patch authority: committed Designer handoff
advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001/110_PHASE_B_R2_RECOVERY_F02_LAUNCHER_COMPATIBILITY_DESIGN_PATCH_HANDOFF.md
at governance commit 9ed0d1d256dd8ea62949a0509cd5e25acd66df13. Governance record 109 at that
commit records the Worker preflight HOLD on the two symlink aliases.

Accepted R2 design commit:
a837bbf9d4072638a6dac676fb5ccc8da9bfa1ff.

Current patch base:
e8c8f529e08ea547e1504d425c80fc8a2216b51b.

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

This bounded patch changes only the fixed launcher-object literals, their
role-specific trust proof, and the corresponding synthetic rejection proof.
The same Reviewer's F02-D1 through F02-D6 PASS and every algorithm-level,
original-root no-follow, and scratch-sequencing invariant remain unchanged.

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

#### 4.4.1 One noninteractive invocation and pre-execution trust root

There is one production command construction and, after evidence binding,
exactly one byte sequence that may be invoked. The source commit cannot contain
the final manifest digest or journal inode identities before those exist.
Therefore the setup document in source commit S contains a non-runnable
bootstrap template. After manifest M and journal-anchor receipt J exist,
evidence-binding commit E replaces its one `@F02_REVIEW_BINDING@` marker with a
canonical literal containing the same Reviewer's accepted manifest-file
SHA-256 plus J's exact ancestor/directory/file device, inode, mount-id,
ownership, mode, link, and flag facts; E contains no marker. The same
Reviewer pins the complete final command and bootstrap-literal SHA-256. Only
that E command may appear in an operator handoff. A template, locally edited
digest, command assembled from shell variables, or command from another commit
is not an invocation. The command hash covers the UTF-8 bytes inside its setup
document code fence, including physical line continuations/newlines and one
final LF, but excluding the fence lines.

The normative construction is below. `F02_BOOTSTRAP_SOURCE_E` denotes the one
POSIX-single-quoted literal committed in E, with the reviewed digest already
embedded; the notation is never present in the final command:

~~~bash
/usr/bin/setsid --fork --wait -- \
  /usr/lib/cargo/bin/coreutils/env -i LANG=C.UTF-8 LC_ALL=C.UTF-8 \
  /usr/lib/cargo/bin/sudo -n -- \
  /usr/lib/cargo/bin/coreutils/env -i LANG=C.UTF-8 LC_ALL=C.UTF-8 \
  /usr/bin/python3.14 -I -S -B -c 'F02_BOOTSTRAP_SOURCE_E' \
  </dev/null 2>/dev/null
~~~

The fixed launcher compatibility contract has exactly three concerns:

1. **Literal selection.** The preservation and journal-installer constructions
   use the final regular-file literals `/usr/lib/cargo/bin/coreutils/env` and
   `/usr/lib/cargo/bin/sudo`. `/usr/bin/setsid`, `/usr/bin/python3.14`,
   `/usr/bin/git`, and
   `/home/leo/.nvm/versions/node/v24.18.0/bin/node` remain their existing fixed
   literals. `/usr/bin/env`, `/usr/bin/sudo`, either intervening symlink,
   `realpath`, PATH search, alternatives lookup, a caller/environment selector,
   fallback, or a generic launcher resolver is invalid.
2. **Role-specific inode trust.** Each manifest launcher path is compiled into
   the bootstrap/generator/reproducer, walked from a no-follow `/` descriptor,
   and opened with a no-follow final component that must be a regular inode.
   Its path, device, inode, UID 0, GID 0, complete mode, link count, byte count,
   and content SHA-256 are fixed in M; group/other write is forbidden. The
   non-sudo launchers must have their exact manifest-pinned executable,
   non-setuid/non-setgid mode. `env` is specifically mode `0755`. `sudo` is
   specifically mode `4755` and one-link. Every launcher other than the fixed
   env object remains one-link. The fixed env multicall inode alone may have a
   manifest-pinned `links` greater than one because every hard link shares the
   authenticated inode, root ownership and mode, no non-root writer is
   permitted, and the exact link count and content are re-proved. Any metadata,
   link-count, identity, size, or content drift is HOLD before root access.
3. **Retained proof.** Fixed launcher descriptors are retained through
   manifest authentication and re-proved against their same literal paths
   immediately before helper/root access. S contains only the resolved-path
   template; M fixes the resolved objects; J remains only the journal-anchor
   receipt; E embeds M's digest and pins the final command. Synthetic vectors
   and command-construction tests reject the two original aliases, any changed
   resolved path, symlink final component, non-root or writable target, wrong
   executable/setuid mode, non-env multi-link object, env link-count drift,
   inode replacement, and size/content/hash drift before any helper or root
   adapter can be called.

This exception is only for the fixed env launcher's authenticated multicall
inode. Every original-root evidence file, repository tree file, helper,
manifest, journal file, and arbitrary regular object retains its existing
no-follow and one-link rule.

The fixed resolved-path invocation remains a non-circular pre-execution trust
boundary. The literals select no data; M records the bytes and identities at
those literals without containing its own hash; E embeds the independently
reviewed hash of M and pins the command bytes; the bootstrap authenticates M,
then the already-open objects, before helper/root access. No symlink target,
resolved pathname, hash, or metadata value is discovered from a caller or fed
back into M. Any mismatch is HOLD rather than a wrapper, alternate lookup, or
weaker execution path.

The final E command has no argument after the bootstrap literal, no shell
substitution, pipeline, wrapper, alias, function, retry, password, askpass, or
alternate mode. The outer empty environment makes `SUDO_ASKPASS`, `DISPLAY`,
`SSH_ASKPASS`, `HOME`, and every `PYTHON*`/`NODE_OPTIONS` key absent. `setsid
--fork` creates a new session with no controlling terminal, `/dev/null` is the
only stdin object, and `sudo -n` refuses instead of prompting. The second
`env -i` gives the privileged bootstrap interpreter only the two locale keys. The
bootstrap closes fd 0 without reading it and resets cwd to `/`.

Sudo denial occurs before any bootstrap/helper outcome. For a password or
policy denial, `sudo -n` exits 1, `setsid --wait` propagates 1, stdout is empty,
stderr is discarded by the fixed redirection, and no journal byte exists.
That is the external operator classification
`SUDO_NONINTERACTIVE_DENIED_BEFORE_HELPER`, never a helper result. Any other
nonzero launcher exit, any stdout byte without a valid helper record, or an
unexpected signal is `PRE_HELPER_LAUNCH_FAILED`; neither classification may be
retried automatically. The later operator records only the fixed
classification and numeric exit, never launcher text.

The focused synthetic command-construction test builds the complete argv,
environment, redirections, session policy, and single-quoted literal from an
explicit fake binding. It requires `setsid --fork --wait`, outer and inner
resolved-path `env -i`, resolved-path `sudo -n`, `/dev/null` stdin, discarded
external stderr, zero shell expansions, zero retry edge, and exactly one
`-I -S -B -c` literal operand. It rejects `/usr/bin/env`, `/usr/bin/sudo`, and
every resolver, selector, or alternate literal.
Fake password,
askpass, stdin, terminal, and retry adapters must remain uncalled. It also
round-trips shell quoting and proves that adding an argument, environment key,
second command, pipe, substitution, or redirection fails construction.

The inline bootstrap literal is the independently checkable trust root. It is
reviewed code carried by the exact command, not loaded from the worktree. Its
embedded review binding contains `MANIFEST_BYTES_SHA256`, the lowercase
SHA-256 of the exact canonical manifest bytes including final LF, and only the
fixed journal-anchor facts above. The helper hash is inside that authenticated
manifest; neither helper, manifest, nor anchor receipt contains the manifest-
file hash or final bootstrap hash, so no hash cycle exists. The same Reviewer's
E result pins manifest SHA-256, helper SHA-256,
bootstrap-template SHA-256, final bootstrap SHA-256, final command SHA-256,
and the device/inode/owner/mode/link/size/SHA-256 tuples of the root-owned
`/usr/bin/setsid`, `/usr/lib/cargo/bin/coreutils/env`,
`/usr/lib/cargo/bin/sudo`, and `/usr/bin/python3.14` objects plus `/dev/null`
facts.
The later operator handoff repeats those values and the fixed journal-anchor
identity; it supplies none as an argv, environment, stdin, or path input.

Before any worktree byte is executed, the bootstrap:

1. verifies its exact argv, two-key environment, root identity, cwd, closed
   stdin, and embedded 64-hex digest; requires `getsid(0) == getpid()`,
   `getpgrp() == getpid()`, fd 0 to be the fixed `/dev/null` object, and an
   `O_NOCTTY` open of `/dev/tty` to fail with `ENXIO`, proving there is no
   controlling terminal;
2. proves `/proc/self/exe` is the root-owned, one-link `/usr/bin/python3.14`
   object pinned by the same Reviewer, then starts from a no-follow `/`
   descriptor and retains no-follow final regular descriptors for every fixed
   launcher object, every fixed worktree ancestor, the fixed manifest, helper,
   current `/proc/self/exe`, the fixed Node object, and the fixed journal anchor
   described in section 4.4.5;
3. requires the role-specific launcher ownership/mode/link policy above and
   exact manifest-bound metadata/content, reads the pinned manifest to EOF
   under its byte cap, and matches `MANIFEST_BYTES_SHA256` before parsing one
   byte;
4. parses the exact schema in section 4.4.4, hashes the already-open helper to
   EOF, requires its byte count and hash to equal the authenticated manifest,
   and re-proves every retained pathname-to-descriptor identity; and
5. maps the pinned Node object, helper, authenticated manifest, and journal
   descriptors to child fds 3, 4, 5, and 6, then executes Node only as
   `/proc/self/fd/3 --disable-proto=throw --preserve-symlinks-main
   /proc/self/fd/4` with cwd `/`, the exact two-key environment, closed stdin,
   4,096-byte stdout, 512-byte stderr (any byte is failure), and a 310,000 ms
   monotonic deadline. The main-symlink flag prevents Node from
   canonicalizing fd 4 back to a mutable worktree pathname.

The helper is therefore loaded from fd 4, never by reopening its worktree
pathname. It rehashes fds 4 and 5, rechecks fd 6, and re-proves every retained
launcher descriptor against its fixed literal before its private direct entry
proceeds; the bootstrap retains all descriptors until the child exits.
A path replacement, inode drift, truncated read, manifest mismatch, helper
mismatch, unexpected key, fd-map drift, or child launch through any pathname is
`HOLD_PROVENANCE` before original-root access. The bootstrap contains neither
state-root literal and cannot open either root.

The script has no normal unseal code. Authenticated journal state permits only
one mutation attempt from the preinstalled empty anchor, or read-only
reverification after durable PRESERVED. STARTED, HOLD, malformed, missing,
replaced, truncated, conflicting, or unauthenticated journal state blocks a
fresh mutation attempt and routes to the Advisor.

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
4. Compute the initial byte/path digest from the pinned descriptors using the
   complete `ORIGINAL_TREE_V1` byte grammar below. It includes the root, empty
   directories, every regular-file byte, and an explicit terminator; it
   excludes only mode/immutable metadata intentionally changed by this gate.
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

`ORIGINAL_TREE_V1` is an octet stream, not JSON or host text. `NUL` is one
`00` byte. `<u64>` is minimal unsigned base-10 ASCII (`0` or `[1-9][0-9]*`),
with values limited to `0..9007199254740991`. `<path>` is a strict UTF-8 NFC
relative path using `/` separators; it has no leading/trailing slash, empty,
`.` or `..` component, NUL/control byte, or normalization alias. `<pathLen>`
is its UTF-8 byte count. Paths are ordered by unsigned lexicographic comparison
of complete UTF-8 bytes; prefix sorts before longer. Invalid encoding or two
paths with equal normalized bytes is HOLD. `<fileHash>` is the raw 32-byte
SHA-256 of exactly `st_size` bytes read from offset zero through the retained
regular-file descriptor, followed by proven EOF.

The complete stream is:

~~~text
"agent-office.as1-f02-original-tree.v1" NUL
"R" NUL
for each sorted contained entry:
  directory: "D" NUL <pathLen> NUL <path> NUL
  file:      "F" NUL <pathLen> NUL <path> NUL <size> NUL <fileHash> NUL
"E" NUL <entryCount> NUL <fileCount> NUL <totalFileBytes> NUL
~~~

`entryCount` excludes the `R` record and includes every `D`/`F` record.
`fileCount` counts `F`; `totalFileBytes` is the checked sum of file sizes.
There is exactly one final NUL and no LF. The reported digest is lowercase
64-hex SHA-256 of the entire stream including domain and terminator. Initial
and final generation use the same retained inode set and grammar; a file short
read, growth, trailing byte, order difference, or count mismatch is HOLD.

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

The file is at most 32,768 bytes and is `MANIFEST_V1` canonical JSON followed
by exactly one LF. SHA-256 always covers that LF. The JSON value is one object;
all leaves are strings, arrays, or objects. Numbers, booleans, null, duplicate
keys, unknown keys, non-ASCII strings, and escaped alternate spellings reject.
Strings permit ASCII `20..7e`; `"` and `\` are escaped as `\"` and `\\`, with
no other escape. Object keys are serialized in unsigned UTF-8 byte order,
arrays retain the specified order, and there is no whitespace. Decimal values
are strings matching `0|[1-9][0-9]*`; hashes are lowercase 64-hex without a
`sha256:` prefix; Git commits are lowercase 40-hex; modes are four lowercase
octal digits. The serializer emits exactly one JSON value plus LF.

The top-level keys and only permitted nested shapes are exact:

~~~text
schemaVersion = "agent-office.as1-f02-preservation-manifest.v1"
sourceCommit = <40hex source commit S>
buildCommand = "npm run build:core"
worktreePath = "/home/leo/Project/.worktrees/agent-office/AGENT_OFFICE_AS1_PHASE_B_LIVE_PILOT_001"
trees = [TREE("src"), TREE("dist/core")]
files = [FILE("helper"), FILE("packageLock"), FILE("packageJson"),
         FILE("buildTsconfig"), FILE("disabledDescriptor")]
launcherObjects = [OBJECT("setsid"), OBJECT("env"), OBJECT("sudo"),
                   OBJECT("node"), OBJECT("python")]
nullDevice = NULL_DEVICE
preservationPythonLiteral = LITERAL
staticProofs = STATIC_PROOFS

TREE keys = name, entryCount, fileCount, totalFileBytes, streamSha256
FILE keys = name, path, bytes, sha256
OBJECT keys = name, path, device, inode, uid, gid, mode, links, bytes, sha256
NULL_DEVICE keys = path, device, inode, uid, gid, mode, links, rdevMajor, rdevMinor
LITERAL keys = bytes, sha256
STATIC_PROOFS keys = oldRootActiveSourceMatches,
  oldRootIdActiveSourceMatches, r2CliProofSha256, r2LockProofSha256,
  r2RootIdProofSha256, sealedBridgeBytes, sealedBridgeSha256,
  descriptorEnabled, descriptorReceiveGrantRef
~~~

The fixed `FILE` paths in array order are
`scripts/as1-preserve-original-root.mjs`, `package-lock.json`, `package.json`,
`tsconfig.build.json`, and
`config/agent-office.as1-slack-pilot.disabled.json`. The fixed `OBJECT` paths
in order are `/usr/bin/setsid`, `/usr/lib/cargo/bin/coreutils/env`,
`/usr/lib/cargo/bin/sudo`,
`/home/leo/.nvm/versions/node/v24.18.0/bin/node`, and
`/usr/bin/python3.14`. `nullDevice.path` is `/dev/null`; it must be the
root-owned character device with the manifest-bound major/minor tuple.
Each `OBJECT` name/path pair is positional and exact; a parser rejects a
different name, path, order, or cardinality. Each is a no-follow-opened final
regular inode with UID/GID `0`/`0`, no group/other write bit, exact executable
mode, device, inode, mode, links, bytes, and SHA-256 from M. `env` requires mode
`0755` and may alone record a `links` value greater than `1`; `sudo` requires
mode `4755` and `links` equal to `1`; every other launcher requires `links`
equal to `1`, its exact M-pinned executable mode, and no setuid/setgid bit.
The env exception accepts no link-count range: generation records one exact
minimal decimal and every reproduction/bootstrap check requires equality.
`descriptorEnabled` is the string `false` and
`descriptorReceiveGrantRef` is `null`; the descriptor SHA-256 remains
`8e3b9985f09b366e046d03392bd60b2157264ec1f2eb4498bfa92e615802f5d7`.
Both old-root match counts are `0`; bridge bytes are `17989`; all other proof
values are lowercase hashes. No path or object read from the manifest is ever
used for opening: code opens only its corresponding compiled fixed literal,
then compares the manifest value.

Every `FILE.sha256`/`OBJECT.sha256` is SHA-256 of bytes read from offset zero
through the exact recorded size followed by EOF. The three R2 proof digests use
`STATIC_PROOF_V1`: ASCII domain `agent-office.as1-f02-static-proof.v1` plus NUL,
then proof-name length/name plus NUL, then for each assertion in listed order
path length/path NUL, pattern length/raw UTF-8 pattern NUL, minimal decimal
expected occurrence count NUL, raw 32-byte full-file SHA-256 NUL, and final
`E` NUL plus assertion count NUL. The assertions are exact:

- `r2CliProofSha256` / name `r2-cli`: in
  `src/runtime/as1-slack-pilot/cli.ts`, R2 root literal count 1, then
  `stateRootId: 'as1-slack-pilot-r2'` count 1;
- `r2LockProofSha256` / name `r2-lock`: in
  `src/persistence/file-store/writer-lock.ts`, exact R2 writer-lock literal
  count 2; and
- `r2RootIdProofSha256` / name `r2-root-id`: in the same writer-lock file,
  `value["stateRootId"] == "as1-slack-pilot-r2"` count 1.

Occurrence counting is non-overlapping raw-byte matching over the retained
regular file. The two old-root counts scan every sorted `src` regular-file byte
for the exact old-root-with-trailing-slash literal and exact old-root ID
comparison from section 7.5; invalid UTF-8 is irrelevant because matching is
raw. The sealed bridge hash covers the exact UTF-8 literal bytes, not its source
quoting. These definitions leave no implementation-selected proof preimage.

Each `TREE.streamSha256` hashes the exact `REPO_TREE_V1` octet grammar. Path,
count, size, raw file-hash, sorting, and numeric rules equal
`ORIGINAL_TREE_V1`. The stream is:

~~~text
"agent-office.as1-f02-repo-tree.v1" NUL
<treeNameLen> NUL <treeName> NUL
"R" NUL
for each sorted contained entry:
  directory: "D" NUL <pathLen> NUL <path> NUL
  file:      "F" NUL <pathLen> NUL <path> NUL <size> NUL <fileHash> NUL
"E" NUL <entryCount> NUL <fileCount> NUL <totalFileBytes> NUL
~~~

`treeName` is exactly `src` or `dist/core`; the digest domain therefore cannot
be replayed between them. Directories, including empty directories, are
represented. Symlink, special file, mount transition, multiply linked file,
invalid path encoding, changing metadata/content, extra entry, short read, or
trailing read fails generation/reproduction. All numeric additions are checked
within the stated unsigned range.

The exact fixed-input generator is the setup document's reviewed
`F02_MANIFEST_GENERATOR_V1` Node literal, invoked from the fixed worktree with
the fixed Node object, empty environment plus the two locale keys, cwd fixed to
the worktree, no argv/stdin, and output path compiled into the literal. It
spawns fixed `/usr/bin/git` directly (never a shell) only for
`rev-parse --verify HEAD^{commit}` and
`status --porcelain=v1 --untracked-files=all`, caps both outputs at 4,096 bytes,
requires one lowercase 40-hex HEAD and empty status, records that HEAD as S,
then no-follow opens only the fixed source/build/helper/package/config/descriptor
surfaces above, calls the import-safe `encodeF02TreeStream` and
`encodeF02Manifest` pure exports, creates the absent manifest with
`O_CREAT|O_EXCL|O_WRONLY|O_NOFOLLOW|O_CLOEXEC` mode 0600, writes all bytes,
`fdatasync`s, fsyncs the artifacts directory, and re-reads/hash-checks the
retained inode. It has no state-root literal, operation selector, path input,
or alternate mode.

Independent reproduction uses a separately authored setup-document literal
`F02_MANIFEST_REPRODUCER_V1`. It imports no helper serializer, writes nothing,
implements this grammar independently, opens the same compiled fixed inputs,
recomputes the candidate bytes and file hash, byte-compares the committed
manifest, requires clean E with `E^ == sourceCommit S`, proves every committed
manifest-covered E blob byte-identical to S, requires `dist/core` to be the
fresh fixed build from S-equivalent source, and emits only one fixed PASS/HOLD
line.
Its only subprocess is fixed `/usr/bin/git` with the same closed environment,
argv/output caps, and exact rev-parse/status/blob-comparison operations. The
focused tests use
synthetic entries to cross-check the production pure encoder, generator
literal, and independent reproducer against hand-written byte vectors,
including root, empty directory, one file, ordering, terminator, invalid UTF-8,
numeric, unknown-key, and final-LF cases. Launcher vectors additionally prove
the exact resolved env/sudo literals, env mode `0755` with an exact multi-link
value, sudo mode `4755` and one link, and rejection of aliases, wrong owner,
writable/wrong-mode objects, a multi-link non-env object, unexpected env link
count, inode replacement, and size/content/hash drift.

Their sole command shapes, run from the fixed worktree, are:

~~~bash
/usr/lib/cargo/bin/coreutils/env -i LANG=C.UTF-8 LC_ALL=C.UTF-8 \
  /home/leo/.nvm/versions/node/v24.18.0/bin/node \
  --disable-proto=throw --input-type=module \
  --eval 'F02_MANIFEST_GENERATOR_V1' </dev/null

/usr/lib/cargo/bin/coreutils/env -i LANG=C.UTF-8 LC_ALL=C.UTF-8 \
  /home/leo/.nvm/versions/node/v24.18.0/bin/node \
  --disable-proto=throw --input-type=module \
  --eval 'F02_MANIFEST_REPRODUCER_V1' </dev/null
~~~

The quoted names denote the exact POSIX-single-quoted literal bytes committed
in S and pinned by the Reviewer; the names themselves are never executable
operands. There is no flag, argv, environment, stdin, path, or mode variant.

The commit/build/evidence sequence is closed:

1. source commit S changes only the four allowed implementation paths, has no
   manifest, contains the non-runnable one-binding-marker bootstrap template
   and both fixed manifest literals, and is clean;
2. from clean S, run all focused checks and `npm run build:core`, then run the
   one fixed resolved-env generator once to create manifest M whose
   `sourceCommit` is S and whose launcher objects contain only the exact final
   regular paths and role-specific metadata above;
3. independently reproduce M, compute `sha256(M including LF)`, and change no
   helper, test, source, build output, package, config, or descriptor byte;
4. under a separate exact no-root journal-install handoff, create and sync the
   fixed empty anchor, commit redacted receipt J, and obtain same-Reviewer
   agreement on its exact identity/flag facts;
5. evidence-binding commit E replaces only the setup template's one review-
   binding marker with M's digest and J's facts and adds M plus exact result/
   pointer evidence; E records S/J and its parent relationship, while the
   helper and every manifest-covered blob remain byte-identical to S; and
6. the same Reviewer rebuilds from S, reproduces M with the independent
   resolved-env literal, verifies E's sole binding edit and no marker, rejects
   either original alias or launcher-object drift, and pins generator,
   reproducer, M, helper, bootstrap, and command byte counts/hashes before any
   operator handoff.

The final bootstrap verifies manifest bytes before trusting its fields. The
helper then re-verifies fds 4/5, every tree/file/object/static proof, the exact
disabled descriptor values, and fixed path-to-retained-descriptor identities
before its Python child may open the original root. Any ambiguity is
`HOLD_PROVENANCE`; no source-only, current-path, or caller assertion is enough.

#### 4.4.5 Durable redacted result and recovery

The monotonic authority journal is not an owner-writable worktree artifact.
Its sole fixed host path is:

    /var/lib/agent-office/as1-f02-original-root-preservation/records.jsonl

A later exact, separately reviewed install step creates the root-owned
`/var/lib/agent-office` ancestor, dedicated directory, and empty file before
any preservation invocation. The helper has no create, repair, reset, rename,
delete, truncate, copy, or alternate-journal mode. The dedicated directory is
UID/GID 0/0, mode 0500, link count 2, one mount, and `FS_IMMUTABLE_FL`; the
regular journal is UID/GID 0/0, mode 0600, link count 1, size 0, and
`FS_APPEND_FL`. Every ancestor is no-follow opened from `/`, root-owned, and
not group/other writable. Installation fsyncs file, dedicated directory, and
parent, then returns their `(device,inode,mount-id)`, modes, ownership, link
counts, flags, and empty-file SHA-256 for same-Reviewer and exact operator-
handoff binding. E embeds those facts in its one closed review-binding literal;
they are reviewed code constants, never argv/environment/stdin/path input.
Missing or mismatched install evidence means E and an operator handoff cannot
exist.

The install surface is one separately authorized, noninteractive, no-argument
setup-document literal named `F02_JOURNAL_ANCHOR_INSTALL_V1`. It runs under the
same detached/empty-environment/isolated root Python launcher shape as section
4.4.1, contains no state-root or scratch literal, and may only create the fixed
absent `/var/lib` ancestor/directory/file chain, set the exact metadata/flags,
sync, verify, and emit the receipt. Any pre-existing target, partial create,
unexpected ancestor, unsupported flag, or sync uncertainty is HOLD; it has no
repair/delete/reset/resume mode. It is provisioning, not a second preservation
helper or invocation, and never loads the repository helper.

Its sole command shape is:

~~~bash
/usr/bin/setsid --fork --wait -- \
  /usr/lib/cargo/bin/coreutils/env -i LANG=C.UTF-8 LC_ALL=C.UTF-8 \
  /usr/lib/cargo/bin/sudo -n -- \
  /usr/lib/cargo/bin/coreutils/env -i LANG=C.UTF-8 LC_ALL=C.UTF-8 \
  /usr/bin/python3.14 -I -S -B -c 'F02_JOURNAL_ANCHOR_INSTALL_V1' \
  </dev/null 2>/dev/null
~~~

The quoted name denotes the exact S literal pinned in the preliminary S/M
review; the name itself is never an executable operand. Sudo/launcher denial
uses the same pre-literal external contract as section 4.4.1 and cannot retry
inside the command.

The fixed redacted receipt evidence path is:

    artifacts/as1-multi-team-slack-pilot/PHASE_B_R2_PRESERVATION_JOURNAL_ANCHOR_INSTALL_RECEIPT.json

It contains only schema, fixed-path hash, identity/mode/link/flag facts,
empty-file hash, sync booleans, and install-result code; it contains no state,
secret, process, environment, or dynamic error text. Its exact canonical bytes
and SHA-256 are pinned in J and E.

The bootstrap no-follow opens the directory and file, requires every embedded
identity and structural fact, records and retains the current tuples, and maps
the already-open journal to helper fd 6. It never creates an absent path.
Missing, renamed, deleted, truncated, grown before the
first attempt, relinked, replaced, writable, wrong-owner/mode, wrong-flag,
wrong-mount, or identity-drifted authority is
`HOLD_JOURNAL_AUTHORITY_BEFORE_HELPER`; it can never be interpreted as UNUSED.
The immutable root-owned directory prevents supported non-root rename/delete/
replacement, and the append-only file prevents truncation and non-append
writes. Explicit root-administrator flag clearing invalidates the bound tuple/
flags and requires new Advisor authority; it is never self-healed.

The helper opens fd 6 for reading and a same-inode write description with
`O_WRONLY|O_APPEND|O_NOFOLLOW|O_CLOEXEC`, requires both descriptions to match,
and takes `flock(LOCK_EX|LOCK_NB)` on the retained inode before parsing. Lock
failure is `HOLD_JOURNAL_CONCURRENT` with zero root access. It holds the lock
and both descriptions until all child/result work ends. The file cap is 65,536
bytes, each LF-terminated line cap is 4,096 bytes, and at most 32 records are
legal. Each append is one complete checked `write`, then `fdatasync`, complete
read from offset zero through proven EOF, canonical parse/state reduction, and
identity/flag recheck. A short write/read or durability uncertainty is
`RESULT_DURABILITY_FAILED` and never success.

Every line is section 4.4.4 canonical JSON plus LF, with exactly the common
keys `schemaVersion`, `sequence`, `transition`, `attemptId`,
`manifestSha256`, `previousRecordSha256`, and `data`. The schema literal is
`agent-office.as1-f02-preservation-journal.v1`; `sequence` is minimal decimal
starting at `0`; `attemptId` is lowercase SHA-256 of domain
`agent-office.as1-f02-attempt.v1` NUL plus raw manifest hash plus the bound
journal/root-directory identity encodings; `previousRecordSha256` is 64 zeroes
at sequence 0 and otherwise the SHA-256 of the complete preceding line
including LF. `data` has only transition-specific keys:

An identity encoding is `<device>` NUL `<inode>` NUL `<mountId>` NUL using the
same minimal decimal grammar. Attempt input orders the dedicated directory
then journal file and ends after the file mount-id NUL. `rootIdentityHash` is
SHA-256 of ASCII domain `agent-office.as1-f02-original-root-identity.v1` NUL
plus pinned parent identity encoding then root identity encoding. Hash inputs
use raw 32-byte digests where named raw and ASCII lowercase hex where stored in
JSON; no host-endian integer encoding exists.

- `STARTED`: `operation` (`PRESERVE` only) and `disabled` (`true` only);
- `PRESERVED`: `initialDigest`, `finalDigest`, `rootIdentityHash`,
  `entryCount`, `fileCount`, `totalFileBytes`, and exact string-boolean keys
  `r2Only`, `processAbsent`, `lockAbsent`, `noFollow`, `singleMount`,
  `oneLink`, `zeroWrite`, `immutable` (all `true`);
- `REVERIFY_STARTED`: `operation` (`REVERIFY` only) and
  `preservedRecordSha256`;
- `REVERIFIED`: `digest`, `rootIdentityHash`, `preservedRecordSha256`, and the
  same eight `true` proof keys; and
- `HOLD`: `code`, where the value is one member of the closed helper outcome
  set and never dynamic text.

Digests/hashes are lowercase 64-hex, counts are decimal strings, and
`rootIdentityHash` is a domain-separated hash, never raw device/inode/path.
No timestamp, PID, argv, exception, stack, evidence/state byte, secret,
provider value, or caller-selected field is legal.

The pure journal reducer accepts only these transitions:

~~~text
empty -> STARTED
STARTED -> PRESERVED | HOLD
PRESERVED -> REVERIFY_STARTED
REVERIFY_STARTED -> REVERIFIED | HOLD
REVERIFIED -> REVERIFY_STARTED
HOLD -> no transition
~~~

Only the preinstalled, identity-bound empty file is UNUSED. Before appending
STARTED, the helper performs a complete read/EOF/metadata/flag recheck, appends
and syncs STARTED, then performs another complete re-read and requires the
exact singleton state. Only then may the child open the original root. A later
invocation that finds terminal PRESERVED/REVERIFIED may enter read-only
reverification. A lone STARTED is an ambiguous prior mutation attempt and
blocks all root access; it may only append a monotonic HOLD after full reread.
A lone REVERIFY_STARTED may resume read-only reverification but can never enter
mutation. HOLD, malformed JSON, broken hash chain, sequence gap, duplicate or
unknown key, illegal transition, noncanonical line, partial final line,
conflicting success, or extra bytes blocks all root access and permits no
append except the specified unambiguous STARTED-to-HOLD terminalization.

Immediately before a PRESERVED or REVERIFIED append, the parent re-reads the
entire file under lock and requires the exact predecessor, same attempt,
manifest, inode, flags, length, EOF, and hash chain it observed before child
launch. It appends the terminal line, `fdatasync`s, re-reads the full file
again, requires the exact new terminal state and line hash, and only then emits
success. Thus a concurrent writer, deletion, rename, replacement, truncation,
tamper, ambiguous crash, or stale child result cannot become a fresh mutation
or success claim.

The fixed worktree evidence path remains a redacted post-operation projection,
never authority or helper input:

    artifacts/as1-multi-team-slack-pilot/PHASE_B_R2_ORIGINAL_ROOT_PRESERVATION_OPERATOR_RESULT.jsonl

Copying that projection requires a later evidence-only handoff after the
helper has exited; loss or editing of the projection never changes journal
state. The helper emits exactly one bounded canonical redacted result line and
empty stderr. Fixed outcomes are PRESERVED, REVERIFIED,
INVOCATION_REJECTED, HOLD_PROVENANCE, HOLD_JOURNAL_AUTHORITY,
HOLD_JOURNAL_CONCURRENT, HOLD_PRIVILEGE_OR_FILESYSTEM, ORIGINAL_ROOT_BUSY,
ORIGINAL_ROOT_PRESERVATION_RACE, HOLD_TRAVERSAL, HOLD_PARTIAL_SEAL,
HOLD_DIGEST, and RESULT_DURABILITY_FAILED. Dynamic failures map to one code
and are never included in output or journal.

#### 4.4.6 Exact interpreter and privilege transition

After bootstrap authentication, the root Node helper opens the fixed
`/usr/bin/python3.14` object with `O_RDONLY|O_NOFOLLOW|O_CLOEXEC|O_NONBLOCK`,
requires the authenticated manifest tuple/hash, retains the descriptor, and
spawns only:

~~~text
executable: /proc/self/fd/3
argv:       ["/proc/self/fd/3", "-I", "-S", "-B", "-c", PRESERVATION_PYTHON_LITERAL]
cwd:        /
env:        LANG=C.UTF-8, LC_ALL=C.UTF-8 (and no other key)
fd 0:       retained, manifest-verified /dev/null opened read-only/no-follow
fd 1:       dedicated pipe, maximum 4096 bytes
fd 2:       dedicated pipe, maximum 512 bytes; any byte is failure
fd 3:       retained /usr/bin/python3.14 executable description
other fds:  closed on exec
deadline:   300000 monotonic milliseconds
~~~

`-I` implies isolated, environment-ignoring, safe-path, no-user-site startup;
`-S` prevents `site` and `sitecustomize`; `-B` prevents bytecode writes. No
`PYTHON*` key exists. The literal
imports/resolves its fixed standard-library/libc/syscall surface, sets umask
0077, closes fd 3, and closes every unintended fd before reducing privilege.
It never evaluates a file/module/path operand, accepts no stdin, and contains
no post-drop import, dlopen, fork, exec, subprocess, shell, callback, or
extension hook. Only retained descriptor operations and already-resolved libc
calls remain after the final proof.

The literal performs this exact Linux transition before opening the original
root:

1. require `/proc/sys/kernel/cap_last_cap` to be exactly `40`; require
   `getresuid() == (0,0,0)`, `getresgid() == (0,0,0)`, fsuid/fsgid 0,
   `PR_GET_NO_NEW_PRIVS == 0`, `PR_GET_KEEPCAPS == 0`, ambient set empty, and
   effective/permitted/bounding membership for CAP_SETGID 6, CAP_SETUID 7,
   CAP_SETPCAP 8, and CAP_LINUX_IMMUTABLE 9;
2. call `PR_CAP_AMBIENT_CLEAR_ALL`, call `setgroups([])`, and verify the
   supplementary group vector is empty;
3. for every capability 0 through 40 except 9, call
   `PR_CAPBSET_DROP`; require `PR_CAPBSET_READ` false for each dropped value and
   true only for 9;
4. set permitted/effective to exactly `{6,7,8,9}` (mask `0x3c0`), inheritable
   to zero, and set temporary securebits to exactly
   `SECBIT_NOROOT|SECBIT_NO_SETUID_FIXUP` (`0x05`), while keep-caps remains off;
5. call `setresgid(1000,1000,1000)`, verify real/effective/saved/fs GID 1000,
   then call `setresuid(1000,1000,1000)` and verify real/effective/saved/fs UID
   1000; the temporary no-setuid-fixup bit retains only the explicitly bounded
   transition capabilities during these two calls;
6. set final securebits to exactly
   `SECBIT_NOROOT|SECBIT_NOROOT_LOCKED|SECBIT_NO_SETUID_FIXUP|`
   `SECBIT_NO_SETUID_FIXUP_LOCKED|SECBIT_KEEP_CAPS_LOCKED` (`0x2f`), with
   `SECBIT_KEEP_CAPS` off and `PR_GET_KEEPCAPS == 0`;
7. set permitted/effective to only CAP_LINUX_IMMUTABLE 9 (mask `0x200`),
   inheritable to zero, clear ambient again, call
   `PR_SET_NO_NEW_PRIVS(1)`, and prove none of those operations can be reversed;
8. parse `/proc/self/status` under a 16,384-byte cap and require exactly
   `Uid: 1000 1000 1000 1000`, `Gid: 1000 1000 1000 1000`, empty `Groups`,
   `CapInh: 0000000000000000`, each of `CapPrm`, `CapEff`, and `CapBnd` equal
   to `0000000000000200`, `CapAmb: 0000000000000000`, and `NoNewPrivs: 1`;
   independently require `PR_GET_SECUREBITS == 0x2f`,
   `PR_GET_KEEPCAPS == 0`, and the exact UID/GID/group syscalls again; and
9. only after every proof succeeds, no-follow open the fixed original-root
   ancestor chain and begin section 4.4.3.

Any initial-state, syscall, ordering, return-code, `/proc`, ID, group,
securebit, keep-caps, bounding/permitted/effective/inheritable/ambient, fd,
environment, cwd, or `no_new_privs` mismatch returns the one canonical child
outcome `HOLD_PRIVILEGE_OR_FILESYSTEM` with exit 25 before original-root open.

The child emits exactly one section 4.4.4-canonical JSON line plus LF with
top-level keys `schemaVersion`, `outcome`, and `data`; schema is
`agent-office.as1-f02-preservation-child.v1`. Failure `data` is the empty
object. PRESERVED/REVERIFIED `data` has only the digest/count/proof fields
needed for the corresponding section 4.4.5 journal transition; BUSY/RACE/HOLD
contains no dynamic reason. The exact exit map is:

~~~text
0  PRESERVED or REVERIFIED (outcome line disambiguates)
20 ORIGINAL_ROOT_BUSY
21 ORIGINAL_ROOT_PRESERVATION_RACE
22 HOLD_TRAVERSAL
23 HOLD_PARTIAL_SEAL
24 HOLD_DIGEST
25 HOLD_PRIVILEGE_OR_FILESYSTEM
~~~

Empty/multiple/noncanonical/oversized stdout, any stderr byte, unlisted exit,
signal, spawn error, or deadline/pipe overflow is never interpreted as child
success. Because the parent cannot prove whether such a child failed before or
after a seal side effect, it monotonically records `HOLD_PARTIAL_SEAL`, emits no
digest/success, and forbids mutation retry. The root parent never opens,
stats, traverses, or mutates either state root.

#### 4.4.7 Exact HOLD behavior

- Missing privilege, unsupported ioctl/immutable behavior, unproved interpreter
  or build/bootstrap/journal provenance, enabled descriptor, process/old-lock presence,
  identity/mount/traversal drift, rejected type/link/path, insufficient bound,
  incomplete zero-write/immutable seal, digest mismatch, or result durability
  failure never produces PRESERVED.
- Noninteractive sudo denial, launcher failure, missing/mismatched binding,
  journal lock conflict, anchor deletion/replacement/truncation/tamper, an
  illegal journal transition, or a privilege-transition mismatch is terminal
  for that invocation and has no automatic retry path.
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

#### 4.4.8 Import-safe seam and server-filesystem validation

The `.mjs` module's exact and complete export namespace is, in sorted order:

~~~text
buildF02BootstrapArgv
encodeF02Manifest
encodeF02TreeStream
parseF02ChildResult
parseF02Manifest
reduceF02Journal
reduceF02Preservation
~~~

Those seven functions are deterministic and side-effect-free. Every value,
entry, record, state, event, or fake binding is an explicit argument; there is
no default path, environment, fd, process observer, filesystem adapter,
journal adapter, spawn adapter, callback, or production constant. They return
only bytes or plain data and cannot open, stat, traverse, mutate, spawn, signal,
change privilege, or resolve either state-root literal. In particular,
`reduceF02Preservation` is the event/state-machine form of section 4.4.3, not
an injected production I/O surface.

The exact direct-entry predicate is `process.argv.length === 2 &&
import.meta.url === pathToFileURL(process.argv[1]).href`. Only that branch may
call the unexported `privateProductionMain`. The fixed-path constants,
bootstrap fd verifier, manifest/file adapters, journal adapters, `/proc`
observer, Node/Python child launchers, original-root traversal/sealer, scratch
behavior, and production main are private lexical bindings, accept no injected
adapter, and are absent from the module namespace. Execution through pinned
`/proc/self/fd/4` satisfies the predicate; Vitest/import evaluation does not.

Module evaluation consists only of built-in-module bindings, frozen literal
declarations, pure function/class definitions, and the false direct-entry
test. Once the module bytes have been supplied to the loader, import evaluation
must make zero helper-initiated filesystem, `/proc`, journal, fd, spawn, signal,
privilege, timer, stdout/stderr, root, or scratch call. It must register no
handler and leave no timer/promise. A fresh isolated import test instruments
all of those boundaries, asserts zero calls, and requires
`Object.keys(namespace).sort()` to equal the seven-line list above. Calling
every export with hostile absolute paths and both real-root literals still
causes zero I/O because the functions only validate/encode explicit data.

`tests/operations/as1-slack-preservation-helper.test.ts` tests the pure state
machines with synthetic events and hand-written byte vectors. It covers the
exact noninteractive command, bootstrap binding/quoting, manifest/helper drift,
all type/link/mount/path rejections, bounds, process/lock races, substitution,
namespace-first sealing, complete tree grammar, privilege transition event
order, child exit/output mapping, journal metadata/hash-chain/legal states,
concurrent lock, deletion/replacement/truncation/tamper, final reread, digest,
redaction, and zero-I/O import. Normal tests resolve neither real state-root
literal.

The existing `tests/operations/as1-slack-lifecycle.test.ts` changes only its
stale F02 HOLD assertion: it requires this one helper artifact and invocation,
keeps the accepted TypeScript seam tests, and proves the seam and helper core
share the closed outcomes. No F01 test or behavior changes.

Real privilege/filesystem support is a separate, later exact validation on
this server, not part of implementation tests and not run by this Designer.
The focused test named `F02_SERVER_FILESYSTEM_PRIVILEGE_VALIDATION` runs only
under an explicit privileged validation handoff. It uses a test-file-private,
fixed capability routine (never a helper export or production mode) on the
sole exclusive scratch path
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
  exact seven-function import-safe pure namespace, private direct entry,
  authenticated-fd verifier, pinned-interpreter privilege boundary,
  descriptor-relative traversal/sealer/reverifier, and monotonic-journal
  protocol.
- The setup document replaces only its F02 HOLD text with the non-runnable S
  template, exact generator/reproducer literals, E-bound final bootstrap
  command, journal-anchor installation/identity contract, validation, one-way
  activation, and rollback contract.
- The focused helper test owns command construction, zero-I/O import, manifest/
  tree byte vectors, pure preservation/journal reducers, privilege event order,
  child decoder, redaction/race/tamper, and separately gated fixed-scratch
  privilege validation.
- The lifecycle test keeps every existing seam/F01 proof and replaces only the
  stale assertion that no production helper exists.

The later implementation/result handoff may additionally name only the
manifest, implementation result/pointer, journal-anchor install receipt,
fixed-scratch validation result/pointer, authoritative host journal, and its
eventual redacted evidence projection. Those are evidence/host artifacts, not
source or an expansion of the four-path implementation allowlist.

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
  `scripts/as1-preserve-original-root.mjs`; S has one non-runnable marker and E
  has zero marker plus exactly one final invocation constructed by section
  4.4.1;
- the final command is detached, noninteractive, stdin-closed, askpass-free,
  environment-closed, retry-free, and has the separate sudo-denial contract;
  synthetic password/askpass/stdin/terminal/retry fakes remain uncalled;
- the preservation command, journal-installer command, generator, and
  reproducer contain only `/usr/lib/cargo/bin/coreutils/env` and
  `/usr/lib/cargo/bin/sudo`; `/usr/bin/env`, `/usr/bin/sudo`, symlink/realpath/
  PATH/alternatives discovery, caller selection, fallback, and generic
  launcher resolution reject;
- every fixed launcher is a no-follow-opened final regular root-owned inode
  with exact M-bound mode/device/inode/link/size/hash and no group/other write;
  env alone accepts its exact M-pinned multi-link count at mode 0755, sudo is
  one-link mode 4755, every other launcher is one-link/non-setuid, and all
  target replacement or metadata/content drift rejects before helper/root
  access;
- the inline bootstrap authenticates the exact manifest before parse, derives
  the helper hash only from that authenticated manifest, re-proves the helper
  fd, and executes only retained Node/helper descriptors; path replacement and
  every digest/fd drift reject before helper/root access without a hash cycle;
- `MANIFEST_V1`, `REPO_TREE_V1`, and `ORIGINAL_TREE_V1` match every exact key,
  type, encoding, ordering, domain, record, count, terminator, final-LF, and
  digest vector; the fixed generator and independent reproducer produce
  byte-identical M from S and E changes no covered blob;
- import has zero helper I/O and exposes exactly the seven pure functions; the
  private direct entry alone owns fixed paths, adapters, journal, spawn,
  privilege, traversal, root, and scratch boundaries;
- the Python child has exact fd/argv/env/cwd/stdio/deadline/output/exit behavior,
  performs the ordered UID/GID/groups/securebits/capability/no-new-privileges
  transition, matches every final `/proc/self/status` field, and opens no root
  on any transition mismatch;
- the preinstalled journal anchor requires exact identity/ownership/mode/link/
  immutable/append flags, exclusive nonblocking lock, canonical hash chain and
  legal state, full pre-terminal/post-sync rereads, and never treats deletion,
  replacement, truncation, tamper, ambiguity, or concurrency as UNUSED;
- no package alias, CLI verb, wrapper artifact, alternate production mode,
  unseal, reset, repair, or generic/caller-selected path exists;
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
- lone STARTED blocks mutation retry, PRESERVED permits only a durable
  REVERIFY_STARTED/read-only REVERIFIED transition, HOLD is terminal, and every
  durable line is canonical, chained, bounded, synced, re-read, and redacted;
- normal tests make zero real-root calls, while the separately authorized
  fixed-scratch server validation proves immutable support and cleanup without
  touching either real root.

Tests use explicit pure events and a test-file-private temporary-root harness;
no production adapter is exported. They do not inspect or mutate either real
root.

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

After those commands pass at clean source commit S, the implementation Worker
runs the setup document's exact no-argument
`F02_MANIFEST_GENERATOR_V1` command once. After M exists, the Worker runs the
separately authored, read-only `F02_MANIFEST_REPRODUCER_V1` command and requires
byte equality plus identical SHA-256. Both commands have the fixed empty/two-
locale environment, fixed cwd and Node path, closed stdin, compiled paths, and
no state-root literal or selector described in section 4.4.4. The Worker
returns S/M evidence and stops. Only after a separately authorized, reviewed
journal-anchor receipt J exists may a new exact handoff create E by making the
one setup review-binding edit with M/J facts and adding authorized manifest/
result evidence. Neither handoff executes the bootstrap/helper. The
independent Reviewer rebuilds from S, reruns the focused checks and independent
reproducer against E, and pins the final command before server validation.

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
4. implement the helper, setup template, manifest literals, and synthetic tests
   without root access; commit/push S, run its checks/build, generate/reproduce
   M, and obtain the same Reviewer's preliminary S/M PASS;
5. under a separate exact journal-anchor installation handoff, create only the
   fixed root-owned empty `/var/lib` anchor, sync it, commit redacted receipt J,
   and obtain the same Reviewer's anchor PASS; do not access either root or run
   the helper;
6. create E by replacing only the one setup review-binding marker with M/J
   facts and adding authorized evidence; obtain the same Reviewer's final
   source/test/manifest/bootstrap/command PASS;
7. under a separate exact server-validation handoff, run only the fixed-scratch
   privilege/filesystem test, commit its redacted result, and obtain the same
   Reviewer's validation PASS;
8. install the exact reviewed E helper/build/manifest at the fixed worktree
   while still disabled, then re-prove the reviewed manifest, helper bytes, active
   R2-only source/output, exact disabled descriptor, bootstrap command, and
   bound empty journal anchor;
9. run the sole noninteractive no-argument command once; require journal
   STARTED durability before root open and durable PRESERVED with equal
   byte/path digests;
10. run the same invocation again in authenticated journal-derived read-only
    mode and require durable REVERIFIED seal/digest proof;
11. under a separate live-owner handoff, initialize only the R2 root with ID
   as1-slack-pilot-r2;
12. mint fresh R2-bound grant/lease evidence; never copy or reuse original-root
   state;
13. reverify the live Agent Office destination and redacted preflight with no
    tmux mutation, including another read-only original-root seal proof;
14. only Leo/GPT may authorize value-only activation and exactly one Agent
    Office Slack round trip; and
15. stop the R2 owner, prove lock/process absence, retain both roots and the
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
   repair, merge, or copy either tree;
7. retain the immutable journal directory, append-only authority file, hash
   chain, and redacted projection; never clear, truncate, replace, or reset
   them; and
8. return both root states and redacted process/lock/journal proof to the Advisor.

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

The `/var/lib` journal is a single fixed preservation-attempt authority, not a
product state root: it stores no intake, grant, profile, Slack, delivery,
evidence, or root-selected data; the owner/observer never opens it; and it
cannot select either root or any helper behavior outside its closed legal
state.

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
- Source commit S, evidence commit E, helper/bootstrap/Python-literal hashes,
  exact launcher/journal-anchor identities, tree digests, and manifest SHA-256
  do not exist yet. The implementation, installation, and same-Reviewer
  evidence must record them; none is a caller runtime operand or guessed by
  this design.
- The fixed production helper, manifest literals, root-owned journal anchor,
  and fixed-scratch validation are designed but not implemented, installed, or
  executed. F02 therefore remains a live-activation HOLD even though this
  patch has no known allowlist conflict.
- No live Slack post, real status delivery, real R2 initialization, or real
  tmux delivery has been performed by this Designer.

Implementation readiness:

DESIGN_STATE: READY_FOR_SAME_REVIEWER_F02_FIXED_LAUNCHER_COMPATIBILITY_DELTA_REVIEW.

LAUNCHER_COMPATIBILITY_DISPOSITION: READY_FOR_SAME_REVIEWER. The direct fixed
regular-file literals preserve the non-circular E -> authenticated M ->
retained object proof and introduce no runtime path resolution.

Implementation is ready only if the same independent Reviewer accepts this
delta and the responsible Advisor issues an exact implementation handoff with
the four-path allowlist. Live readiness remains blocked until the implemented
helper, reproducible manifest, fixed-scratch privilege result, actual
PRESERVED/REVERIFIED journal, R2-only initialization, and live destination
preflight each pass their separate authority and review gates.

This Designer result is not independent review, implementation approval, risk
acceptance, final closure, or authority to start the next mission.

## 11. F02-D1 through F02-D6 and fixed-launcher traceability

| Finding | Bounded disposition | Normative sections |
| --- | --- | --- |
| F02-D1 | One detached `sudo -n` construction; no tty/stdin/askpass/retry path; pre-helper denial is external and synthetic construction is required. | 4.4.1, 7.2 |
| F02-D2 | Reviewed inline isolated bootstrap embeds manifest-file hash, authenticates manifest/helper before executing retained fds, and has no helper/manifest hash cycle. | 4.4.1, 4.4.4 |
| F02-D3 | Exact JSON, repo-tree, original-tree, numeric/path/hash/terminator grammars; fixed generator/reproducer and S/M/E sequence. | 4.4.3, 4.4.4, 7.5 |
| F02-D4 | Seven pure exports, exact direct-entry guard, zero-I/O import, and private non-injectable production adapters. | 4.4.8, 6, 7.2 |
| F02-D5 | Exact `-I -S -B -c` child, fd/cwd/env/output/exit contract, ordered UID/GID/groups/securebits/capability/no-new-privileges proof. | 4.4.6, 7.2 |
| F02-D6 | Root-owned immutable/append-only preinstalled anchor, nonblocking exclusive lock, exact hash-chained states, sync/full reread, and no fresh state after loss/tamper/ambiguity. | 4.4.5, 7.2, 8 |
| F02 launcher compatibility | Final regular env/sudo literals, manifest-pinned role-specific mode/link rules, retained no-follow descriptors, and alias/drift rejection with no generic resolution. | 4.4.1, 4.4.4, 7.2 |

No F01, status, Socket, Exact Delivery, descriptor, private binding,
sequential-profile, or accepted preservation-algorithm behavior is reopened.
