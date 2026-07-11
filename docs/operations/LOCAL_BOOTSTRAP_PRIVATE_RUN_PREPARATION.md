# LocalBootstrap Private-Run Preparation

Status: `PREPARATION_ONLY__REAL_RUN_REQUIRES_FABLE5_PASS_AND_ADVISOR_AUTHORITY`

This is a non-secret runbook for the later AO-WU-14 private-run gate. It records
how an authorized Advisor can prepare local paths and trusted configuration after
independent code/security review. It is not authority to create a credential,
start the real server, access a remote host, or activate tmux delivery.

## 1. Required gates

Do not perform the real procedure until all of the following are durable:

1. Fable5 records code/security `PASS` for LocalBootstrap commit
   `2623922877bd52dc7f5b6c6cd45fae755e5ff228` or an explicitly reviewed
   descendant.
2. Advisor records authority for one loopback private run and names the exact
   target and foundation-docs commits.
3. `shadow/agent-office-m01` and the sibling `foundation-docs` source are clean,
   expected, and non-protected; no unreviewed change is present.
4. Port `4317` is free and the approved host requires only `127.0.0.1` binding.
5. The credential-reading method is local, owner-only, and absent from terminal
   transcripts, tmux/chat, URLs, argv, environment, logs, and browser storage.

If any item is absent, retain the committed `NONE_READ_ONLY` configuration and
the `AUTH_BLOCKED / READ_ONLY` runtime posture.

## 2. Owner-only locations outside Git

After the gates pass, the Advisor may prepare these example locations (or an
equivalent explicitly reviewed set):

```text
/home/leo/.config/agent-office/private-run/
/home/leo/.local/state/agent-office/private-run/
/home/leo/.local/run/agent-office/private-run/
```

Every directory must be owned by the runtime UID and mode `0700`. Deployment and
operational JSON files must be owner-owned regular files, no-follow readable,
bounded, and mode `0400` or `0600`. The proof-delivery file must not exist before
startup; its parent is mode `0700`, outside all Git, application, state, static,
and observed roots. LocalBootstrap creates the file exclusively as mode `0600`.

The reviewed deployment document has exactly this non-secret shape:

```json
{
  "schemaVersion": "agent-office.loopback-deployment.v2",
  "networkMode": "LOOPBACK_PRIVATE",
  "bindAddresses": ["127.0.0.1"],
  "port": 4317,
  "allowedHosts": ["127.0.0.1:4317"],
  "authProvider": "LOCAL_BOOTSTRAP",
  "mutationMode": "ENABLED_LOCAL_BOOTSTRAP",
  "bootstrapProofFile": "/home/leo/.local/run/agent-office/private-run/local-bootstrap-proof.json",
  "cors": false,
  "trustProxy": false,
  "tls": false,
  "hsts": false
}
```

The separate operational document must retain the reviewed schema and complete
project/actor/source registrations. Its selected mission source must be the
actual current file
`advisor/jobs/20260711_agent_office_m01_advisor_managed_office_web_control_plane/10_MISSION_MANIFEST.json`
under `/home/leo/Project/foundation-docs`, with repository `foundation-docs`, the
current exact Git commit, the exact file SHA-256, and a Git source bound to that
same canonical root. It must contain no fixture source, gateway capability, or
credential. Recompute commit/hash evidence immediately before the authorized
run; never copy the test operational configuration.

## 3. State preparation and start shape

The future Advisor initializes a fresh owner-only state root with the reviewed
`initializeStateRoot` API, builds the reviewed commit, and starts only this CLI
shape:

```text
npm run start:loopback -- \
  --app-root /home/leo/Project/agent-office \
  --config /home/leo/.config/agent-office/private-run/deployment.json \
  --runtime-config /home/leo/.config/agent-office/private-run/operational.json \
  --state-root /home/leo/.local/state/agent-office/private-run/state \
  --static-root /home/leo/Project/agent-office/dist/dashboard
```

No credential appears in that command. Startup verifies the canonical manifest,
root isolation, state/store, LocalBootstrap output path, and manual-only Advisor
gateway before generating the proof and before binding `127.0.0.1:4317`. Any
invalid, missing, insecure, dirty, stale, conflicting, or fixture authority fails
startup; it must not be bypassed by flags or environment values.

## 4. Credential and browser handling

- A generated proof is valid for at most 15 minutes and one successful exchange.
- Leo reads it only through the separately approved local owner-only channel and
  enters it into the password-style LocalBootstrap form. Do not print it, copy it
  into tmux/chat, place it in a URL, or preserve it in notes/evidence.
- Successful exchange removes the exact proof file and establishes only the
  server-side `viewer` plus `leo_input` session. The browser receives a host-only
  `HttpOnly`, `SameSite=Strict` cookie.
- Logout/revocation closes SSE and removes mutation authority. A consumed or
  expired proof is never regenerated in the running process; restart is required
  for a fresh proof.
- A crash may leave an ambiguous proof file. Restart must fail rather than
  overwrite it. After confirming no process is running, the authorized Advisor
  treats the file as sensitive, removes it locally without displaying it, and
  starts a new process. Never reuse or restore the old proof.

## 5. Network and delivery boundary

The run binds only `127.0.0.1:4317`. If a later separately approved remote-host
mission uses SSH local forwarding, both ends must preserve port `4317` and the
remote target remains `127.0.0.1:4317`; this document does not authorize that
host, SSH command, Tailscale, public exposure, proxying, TLS claims, or ACL work.

`TmuxAdvisorGateway` remains capability-less and has no delivery port in
LocalBootstrap mode. The UI and status must show
`MANUAL_FALLBACK_REQUIRED`. No test or real run may send tmux input under this
gate.

## 6. Evidence and shutdown

Permitted evidence is non-secret: reviewed commits, configuration paths and
hashes, owner/mode checks, canonical manifest evidence, bind/status codes,
redacted lifecycle outcomes, browser containment/accessibility results, clean
shutdown, listener rebind, and writer-lock release. Never record proof, cookie,
CSRF token, provider/browser session handle, host credential, or environment
contents.

Stop with the normal signal path, require listener closure and writer-lock
release, and confirm no Agent Office process remains. A successful private run is
only evidence for Advisor review; it does not activate delivery, approve M01, or
start another mission.
