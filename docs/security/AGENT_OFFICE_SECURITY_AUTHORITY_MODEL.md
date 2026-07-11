# Agent Office Security and Authority Model

Status: `REVIEWED_DESIGN__BATCH_B_C_ACCEPTED__BATCH_D_LOCAL_AUTHORITY_BOUNDARY_IMPLEMENTED__SERVER_SECURITY_GATED`

This reviewed design defines browser, service, adapter, actor, and deployment
trust boundaries. Batch B implements only the local read-only adapter and static
dashboard subset at code commit
`85e66d856e33a0df73041cb4b33aba30a8f9f96d`. It contains no real secret,
credential, token, key, cookie, auth action, HTTP server, or network authority.
Advisor accepted that subset as the Batch C dependency. Batch C adds only the
structured-event scene and deterministic browser tests at
`e30a6cda52e14a4bf30b2d1b7445fa26645496e5`; it adds no server, gateway,
credential, adapter call, role target, process execution, or durable mutation.

Advisor accepted Batch C as the Batch D dependency. Batch D code commit
`7366036f8a1e6fc9d4e911e8d193e17eeb95f54c` adds the typed Advisor-only command
port, owner-only immutable message/lifecycle artifacts, capability-gated pointer
gateway, disabled Hermes stub, content-redacted lifecycle audit projection, inert
Inbox/Alerts rendering, and no-role-target acceptance tests. It adds no HTTP,
auth credential, CSRF/rate server, real tmux input, process/network gateway,
private exposure, or live deployment.

## 1. Security Objectives

Agent Office must:

- remain private and loopback-bound by default;
- authenticate every browser mutation and authorize it by narrow capability;
- prevent CSRF, cross-origin use, injection, path traversal, unsafe file access,
  arbitrary commands, and role-target manipulation;
- record tamper-evident, redacted audit evidence for mutations and security
  failures;
- preserve canonical role authority instead of granting authority to a browser,
  service process, gateway, projection, or animation;
- fail closed when identity, transport activation, kill-switch, host trust,
  evidence, or configuration is missing or ambiguous; and
- make manual Advisor routing available when automated delivery is unsafe.

Availability never outranks actor separation or evidence integrity.

### 1.1 Batch B-D as-built security subset

- `src/application/projects/registry.ts` validates trusted absolute roots and
  rejects cross-project overlap; browser summaries contain IDs, not paths.
- `src/adapters/observations/filesystem.ts` uses bounded regular-file reads,
  no-follow opens, component checks, and opened-descriptor containment.
- `process-runner.ts` exposes typed Git/tmux reads only, constructs direct argv,
  sets `shell: false`, disables optional Git locks/prompts, and enforces fixed
  timeout/combined-output caps.
- Git callers select configured namespace/pair IDs; tmux callers select one
  configured source ID whose only command shape is exact-pane structured
  `display-message`. No capture, input, buffer, shell, signal, or mutation method
  is exposed.
- `src/ui/dashboard.tsx` retains filtering, selection, expansion, and evidence
  copy; `src/ui/communication/` adds only the closed Advisor message form and
  typed alert actions. There is no server route, arbitrary path/role/session/
  pane/command target, or auth surface.
- `src/ui/scene/` receives only typed scene projections and accepted event IDs.
  Extra prose/process-shaped properties are ignored; stale, conflicted,
  disconnected, incompatible, or unaccepted sources fail closed and suppress
  motion. Fixture selection, animation completion, and motion preferences are
  presentation-only and cannot append an event or call an adapter.
- `src/application/advisor-inbox/` accepts Leo/GPT submission only for the fixed
  mission and allowlisted entity IDs. Advisor alone records acknowledgement,
  intake, decision link, ResumeProof, and close evidence. Message content stays
  in the scoped immutable artifact and is excluded from event/gateway/audit
  summaries.
- `src/adapters/gateways/` exposes no process/network primitive. A prevalidated
  opaque `ADVISOR_ONLY` capability gates the canonical pointer envelope; any
  disabled/kill/stale/conflict/ambiguous state is manual fallback.
- Adapter/security boundary tests are deterministic and use fake tool runners;
  traversal, symlink, special-file, hostile argv/ref/name, timeout/cap, root
  isolation, malicious inert text, capability matrix, and Batch E forbidden-scope
  cases pass in the 149-test suite plus 15 Chromium tests.

## 2. Threat Model

### 2.1 Protected assets

- mission manifests, event ledgers, immutable messages, decisions, reviews, and
  result artifacts;
- Git and evidence metadata used for completion;
- authenticated sessions and CSRF state;
- private host/session registry metadata;
- Advisor delivery receipts and kill-switch state; and
- projection integrity and audit history.

### 2.2 Threat actors and failure sources

- an untrusted web page attempting cross-origin requests;
- a local unprivileged process connecting to loopback;
- a malicious or malformed browser message;
- a compromised browser session;
- path traversal or symlink races into another repository/state root;
- injection into Git/tmux/process arguments;
- a stale, spoofed, or reconnected remote host;
- replayed/reordered requests and duplicate delivery;
- corrupted/truncated files or stale evidence;
- accidental operator scope expansion; and
- a product component attempting to assume Advisor, Worker, Reviewer, or Leo/GPT
  authority.

### 2.3 Explicit non-protection claims

Loopback binding does not protect against a compromised local account. Hash chains
do not authenticate an actor. Tailscale membership alone does not grant product
authority. The M01 design is not a public, hostile-Internet, multi-tenant, or
high-availability security design.

## 3. Actor Authority Matrix

| Actor/principal | May do | Must not do |
|---|---|---|
| Leo/GPT | Submit structured input, make material decisions through a canonical Advisor record, accept risk, approve final closure/next mission | Directly target Worker/Reviewer from browser; turn message receipt into automatic execution |
| Advisor | Acknowledge/intake messages, route approved work outside the browser under canonical transport, record routine decisions/evidence, operate kill switch/manual fallback | Implement as Worker, independently review, accept unapproved risk, grant final approval |
| Agent Office Worker | Implement exact repo-local handed-off scope and return evidence | Receive browser dispatch, self-review, broaden scope, select next mission |
| Fable5 Reviewer | Independently review exact committed design/implementation and return verdict to Advisor | Receive browser dispatch, patch implementation, self-approve |
| Browser `viewer` | Read authorized projections and redacted evidence | Mutate mission state or view secrets/raw terminal data |
| Browser `leo_input` | Viewer plus submit Advisor messages and see their receipts/status | Choose role/session target, acknowledge as Advisor, execute command |
| Browser `advisor_operator` | Viewer plus acknowledge/intake, record already-authorized routing/decision evidence, operate app-local delivery disable/manual fallback | Use a generic shell, bypass canonical tmux authority, accept Leo-only decisions |
| Agent Office service | Validate commands, append events/artifacts, project state, call narrow ports | Invent authority, infer state from prose, hold a generic role-dispatch capability |
| TmuxAdvisorGateway | Deliver an immutable pointer envelope to the one configured Advisor endpoint when active authority passes | Accept target/session/argv/body-as-command; send to Worker/Reviewer; bypass kill switch |
| HermesAdvisorGateway stub | Compile-time/interface placeholder only | Connect, send, receive, or make a Hermes decision in M01 |

Browser capabilities are application permissions, not canonical actor authority.
An `advisor_operator` session cannot turn a Leo/GPT-only decision into an Advisor
decision.

## 4. Trust Boundaries

```text
Untrusted browser input
  -> HTTP parsing and size bounds
  -> authentication/session
  -> Origin + Fetch Metadata + CSRF
  -> capability authorization
  -> strict schema/canonical hash/idempotency
  -> domain command service
  -> single-writer state root

State root -> typed fixed ports -> read-only repos/tmux OR Advisor-only outbox
```

Every arrow validates data anew. Objects from a lower-trust zone are not passed as
file paths, argv, HTML, session targets, or actor identities without typed mapping
and allowlist validation.

## 5. Network Exposure Modes

### 5.1 `LOOPBACK_PRIVATE` (M01 default)

- Bind only to explicit `127.0.0.1` and/or `[::1]`; do not use wildcard bind.
- Accept only loopback peer addresses and exact configured Host values.
- Disable CORS; allow same-origin requests only.
- Do not trust forwarding headers or a proxy.
- Show a persistent `LOOPBACK_PRIVATE` indicator in UI and health evidence.
- Startup fails if configuration requests non-loopback bind.

Loopback still requires authentication for mutations. A narrowly marked local
development read-only mode may use a fake provider only in tests; it cannot expose
message or decision mutations.

### 5.2 `PRIVATE_NETWORK_GATED` (designed, disabled)

Enabling a Tailscale/private-network mode requires all of:

- explicit Leo/GPT private-network approval for the exact host and users;
- updated threat review and Fable5 review of the actual configuration;
- a non-public Tailscale ACL/tag policy, no Funnel/public ingress;
- TLS/secure-context operation;
- an approved identity provider and server-side authorization mapping;
- trusted-proxy configuration that strips client-supplied identity headers and
  accepts them only from a pinned local proxy/socket;
- host enrollment, key/credential provisioning, rotation, and revocation runbook;
- CSRF/origin/Host rules for the exact private origin; and
- rollback to loopback plus evidence of the disable action.

Tailscale identity proves a network identity, not Leo/GPT/Advisor product
authority. Public exposure is not an M01 mode and cannot be enabled by config.

## 6. Authentication Design Without Embedded Secrets

### 6.1 Provider contract

`AuthenticationProvider` is a server-side port:

```text
beginLocalBootstrap() -> one-time delivery descriptor
exchangeOneTimeProof(proof) -> subject + capabilities
validateSession(sessionHandle) -> subject + capabilities + expiry
revokeSession(sessionHandle) -> receipt
```

It never returns signing keys to application code or browser JavaScript. Provider
implementations are selected by trusted startup configuration, not a request.

### 6.2 Candidate providers

- `TestAuthenticationProvider`: deterministic fake identities for automated tests
  only; build/runtime guard prevents non-test startup.
- `LocalBootstrapAuthenticationProvider`: future loopback provider that generates
  a high-entropy, single-use proof, stores only its verifier, delivers the proof
  through an owner-only runtime channel outside Git/logs, and exchanges it for a
  short-lived server-side session. Implementing/using the real proof is gated by
  an explicit secret-handling implementation handoff.
- `PrivateNetworkAuthenticationProvider`: future gated provider that maps a
  verified private-network/OIDC identity to capabilities. Interface only in M01.

There is no `NoAuth` mutation provider. Missing/invalid provider configuration
disables mutation endpoints and reports a redacted health failure.

### 6.3 Session handling

- Session handles are opaque random values; authorization state remains server
  side and is revocable.
- Cookies are host-only, `HttpOnly`, `SameSite=Strict`, `Path=/`, short-lived, and
  rotated after authentication/privilege change.
- TLS/private-network mode requires `Secure` and a `__Host-` cookie name.
- Loopback HTTP, if separately accepted for local development, uses a distinct
  host-only cookie and is rejected for non-loopback peers; the exception is never
  reused for private-network mode.
- No access/refresh token is stored in localStorage, IndexedDB, service-worker
  cache, URL query, or application log.
- Logout/revocation invalidates the server-side session and emits a redacted audit
  event.

## 7. CSRF, Origin, and Browser Request Controls

Every mutation requires:

- an authenticated session and required capability;
- exact same-origin `Origin` (and `Referer` fallback where applicable);
- Fetch Metadata policy rejecting cross-site requests;
- JSON `Content-Type` with no form fallback;
- a session-bound synchronizer CSRF token in `X-AO-CSRF`;
- an idempotency `requestId`; and
- a route-specific strict schema and body limit.

CSRF tokens are never authority evidence and are not logged. CORS headers are not
enabled. State mutation through GET, SSE, image, form, or service-worker background
sync is forbidden.

SSE requires an authenticated cookie, same-origin request, bounded concurrent
connections, heartbeat, and server-side revocation checks. Sensitive payloads are
not placed in SSE event IDs or URLs.

## 8. Browser API Allowlist

Candidate mutation routes are closed and typed:

| Route | Capability | Purpose |
|---|---|---|
| `POST /api/v1/advisor/messages` | `leo_input` | Persist immutable message to Advisor only |
| `POST /api/v1/advisor/messages/:id/ack` | `advisor_operator` | Record Advisor acknowledgement artifact |
| `POST /api/v1/advisor/intakes` | `advisor_operator` | Record canonical intake/routing classification |
| `POST /api/v1/decisions` | `advisor_operator` with authority evidence | Record a decision already made by the named canonical authority |
| `POST /api/v1/alerts/:id/ack` | `advisor_operator` | Acknowledge, not resolve, an alert |
| `POST /api/v1/delivery/disable` | `advisor_operator` | Disable app delivery and require manual fallback |

The service has no `/terminal`, `/shell`, `/exec`, `/command`, `/tmux/send`,
`/dispatch`, `/worker`, or `/reviewer` route. It has no generic role/session target
field. Advisor routing to roles remains outside these browser APIs and under the
active canonical transport protocol.

Read routes return projections or explicitly authorized redacted artifacts. Raw
state-root paths, raw terminal capture, environment, process command lines,
credentials, and private keys are never returned.

## 9. Input, Output, and Content Safety

- Message subject: at most 200 Unicode scalar values.
- Message body: plain text/limited Markdown source, at most 16 KiB UTF-8.
- Whole mutation body: at most 32 KiB; at most 50 referenced entity IDs.
- Control characters except newline/tab are rejected; Unicode is normalized to
  NFC for display but the original accepted bytes/hash remain in the artifact.
- Raw HTML, script, style, data URLs, remote images, iframes, and embedded objects
  are rejected or rendered as text.
- Markdown renders through a strict allowlist and output escaping. Links receive
  safe protocols and `rel=noopener noreferrer`; remote content is not fetched.
- UI uses text nodes by default and never evaluates event/message content.
- Errors use stable codes and correlation IDs, not stack traces or filesystem
  paths.

Security headers include a nonce/hash-based CSP with no unsafe inline/eval,
`frame-ancestors 'none'`, `object-src 'none'`, restrictive `connect-src`,
`X-Content-Type-Options: nosniff`, strict referrer policy, and permissions policy.
Private-network HTTPS adds HSTS only after exact host/TLS review; it is not emitted
carelessly on generic localhost names.

Batch D implements only the non-HTTP content subset: subject is at most 200
Unicode scalars, body at most 16 KiB, the whole structured command/artifact at
most 32 KiB, and references at most 50 allowlisted IDs; disallowed control
characters and unknown fields fail closed. React text nodes and an inert fenced
code renderer never interpret supplied HTML or code as a control. HTTP headers,
link policy, request parsing, and rate limiting remain Batch E.

## 10. Rate Limits and Resource Bounds

Initial candidate limits are configuration constants reviewed in Batch E:

| Surface | Limit |
|---|---|
| Local bootstrap exchange | 5 attempts per 15 minutes per peer plus global lockout delay |
| Advisor message submission | 10 per minute, burst 5 per authenticated subject; 60 per hour |
| Other mutations | 30 per minute per subject |
| Reads | 120 per minute per subject |
| SSE | 2 concurrent connections per session; 6 connection attempts per minute |
| Message body / total body | 16 KiB / 32 KiB |
| Request processing | bounded timeout and cancellation; no unbounded child process |

Limits return `429` with bounded `Retry-After` and append a redacted audit record.
In-memory limiter reset after restart is acceptable only because durable request
idempotency remains enforced; private-network/multi-instance operation requires a
new shared-limit design and is deferred.

The message body/whole-payload/reference bounds in this table are enforced in
Batch D domain/application code. Per-subject and HTTP rate limits are not.

## 11. Filesystem and Adapter Security

- All repository, artifact, state, and tool executable roots come from trusted
  startup configuration and are resolved to absolute canonical paths.
- Request data can select only known entity IDs; it cannot supply a filesystem
  path or executable.
- File access uses openat-style containment or equivalent realpath/descriptor
  checks, rejects `..`, absolute paths, NUL, unexpected symlinks, device/FIFO/
  socket files, and ownership/mode violations.
- Immutable writes use create-exclusive, owner-only permissions, size limits,
  fsync, and atomic directory placement.
- Git/tmux adapters use direct process execution with a fixed executable and
  fixed argv templates, clean environment allowlist, cwd allowlist, timeout,
  output cap, and no shell.
- Read-only Git allows inspection commands only. Read-only tmux allows structured
  metadata commands only; no `send-keys`, `load-buffer`, `paste-buffer`, `run-shell`,
  or config mutation.
- The TmuxAdvisorGateway is a separate fixed delivery port governed by active
  transport authority; its input is an immutable pointer envelope, not argv.

## 12. Advisor Delivery and Authority Safety

Message persistence and delivery are separate. The Batch D application receipt
means only that the immutable message and event are durable. Delivery may later become
`MANUAL_FALLBACK_REQUIRED` without losing the message.

Before TmuxAdvisorGateway delivery, a trusted adapter must verify, by reference:

- transport activation is `ACTIVE` and kill switch `DISENGAGED`;
- the committed final activation record is valid;
- the registered Advisor endpoint is freshly revalidated;
- the envelope is the fixed schema and hashes match;
- no synchronized/broadcast/wildcard target exists; and
- the request is a notification pointer to Advisor, not role work.

Agent Office does not reimplement the transport decision matrix. A failed or
ambiguous check disables delivery, records a typed receipt, and surfaces manual
fallback. It never sends a retry, approval, Ctrl-C, auth response, or alternate
target automatically.

The as-built capability contains only an opaque UUID, fixed `ADVISOR_ONLY` route,
TMUX transport tag, active/disabled/conflict and kill/synchronization state,
issue/expiry times, and authority/activation/registry hashes. Locator and process
details stay outside Agent Office. The injected delivery port receives only the
capability ID, notification ID, and canonical pointer-envelope bytes.

## 13. Audit and Redaction

The append-only security audit stream records:

- auth success/failure/revocation without proof or cookie value;
- CSRF/origin/schema/rate-limit rejection;
- idempotency conflict and invalid transition code;
- artifact verification/path-containment failure;
- gateway enabled/disabled/delivery receipt/manual fallback;
- configuration mode and bind-address class, not sensitive values;
- recovery/quarantine/backup/restore actions; and
- capability changes and decision-application references.

Each record includes audit schema version, audit ID, request/correlation ID,
subject reference where known, route/action, stable outcome code, recordedAt,
payload hash where safe, and previous/audit hash. It excludes message body,
credentials, cookies, CSRF tokens, auth headers, environment values, raw terminal
content, and key material.

Audit files are owner-only, segmented, hash chained, backed up, and never served
directly. UI presents a redacted projection. Audit deletion/retention policy is a
future Leo/GPT/operations decision; M01 does not auto-delete history.

Batch D implements a narrower redacted projection over the already durable
hash-chained domain ledger in `src/application/audit/`. It filters to lifecycle
events and allowlists IDs, state, hashes, sequence, actor role, and timestamps;
tests prove message/note content is absent. The separate security audit stream,
auth/CSRF/rate rejections, backup/retention, and server presentation remain
Batch E and are not claimed here.

## 14. Kill Switch, Disable, and Manual Fallback

Two distinct controls exist:

1. The canonical Advisor tmux transport kill switch remains external authority.
   Agent Office reads its state through a verified adapter and treats anything
   other than active/disengaged as no-delivery.
2. The Agent Office app-local delivery enable is default-off until configured.
   Disabling it stops new gateway sends, leaves reads and durable inbox storage
   available, and marks queued messages for manual fallback.

Neither switch terminates role processes, deletes data, or authorizes rollback.

Batch D implements the gateway side of these semantics only: absent, disabled,
kill-switched, stale, or conflicting capability invokes no delivery port and
returns manual fallback; ambiguous started delivery performs lookup only and
persists manual evidence when no receipt exists. It does not read or mutate the
real external transport state.
The UI always shows delivery state and the manual pointer path. Re-enable requires
fresh configuration/authority validation and an audit receipt; it is never timed
or automatic.

## 15. PWA and Offline Security

- Service worker precaches only content-hashed static app-shell assets.
- API/SSE/auth/message/artifact responses use `no-store` and are never cached.
- Offline mode is read-only and labels the last verified projection revision/time.
- No background sync or offline mutation queue exists in M01.
- Logout, session expiry, or capability reduction clears in-memory sensitive UI
  state and navigates to authentication; it cannot reliably erase browser history,
  so sensitive raw artifacts are not rendered by default.
- A service-worker update is versioned, integrity checked, and activated through a
  visible reload flow. A broken worker has a documented unregister/recovery path.

## 16. Security Acceptance Tests

Batch E must include at least:

- non-loopback bind fail-closed tests;
- missing/invalid auth provider mutation denial;
- session fixation, expiry, rotation, revocation, and capability tests;
- cross-origin, Fetch Metadata, CSRF, CORS, Host, content-type, and cookie tests;
- rate-limit, size-limit, Unicode/control-character, Markdown/XSS, and CSP tests;
- path traversal, symlink race, special file, repo allowlist, and output-cap tests;
- command/target field rejection and proof no browser route reaches Worker/Reviewer;
- direct-exec argv tests proving no shell and no writable Git/tmux observation;
- same-ID/same-hash replay and same-ID/different-hash conflict after restart;
- gateway inactive/kill-switch/registry mismatch/manual fallback tests;
- audit redaction tests seeded with canary secret-like values; and
- service-worker cache inspection proving API/auth/message data is absent.

Tests use synthetic credentials/canaries only. No real secret, external exposure,
Tailscale action, or production identity is permitted by this design.

## 17. Local Traceability

| DESIGN_REQUIREMENT | IMPLEMENTATION_PATH | TEST_PATH | CURRENT_EVIDENCE | STATUS | DEFERRED_GATE |
|---|---|---|---|---|---|
| AO-SEC-001 Loopback private fail-closed bind | `src/server/network/` | `tests/security/bind-policy.test.ts` | `NOT_IMPLEMENTED`; Section 5 | `DESIGNED_CANDIDATE` | Batch E; private network separately gated |
| AO-SEC-002 Auth/session/capability model without embedded secrets | `src/server/auth/` | `tests/security/auth-session.test.ts` | `NOT_IMPLEMENTED`; Sections 3 and 6 | `DESIGNED_CANDIDATE` | Batch E and real-secret authority if activated |
| AO-SEC-003 CSRF/origin/rate/input/output controls | `src/domain/messages/`, `src/ui/communication/`; future `src/server/security/` | `tests/domain/transitions.test.ts`, `tests/ui/communication-center.component.test.tsx` | Batch D implements closed fields, message/artifact bounds, allowlisted refs, control rejection, and inert text/code rendering only; CSRF/origin/rate/HTTP controls remain absent | `IMPLEMENTED_BATCH_D_CONTENT_SUBSET__PENDING_ADVISOR_ACCEPTANCE` | HTTP security remains Batch E |
| AO-SEC-004 No browser role dispatch or arbitrary command | `src/adapters/observations/`, `src/adapters/gateways/`, `src/application/advisor-inbox/`, `src/ui/communication/`; future `src/server/routes/` | `tests/integration/tmux-advisor-gateway.test.ts`, `tests/ui/communication-center.component.test.tsx`, `tests/acceptance/batch-gates.test.ts` | Batch D form exposes no target field; gateway accepts one exact pointer schema, has no process/network import, and cannot route Worker/Reviewer/session/pane/command | `IMPLEMENTED_THROUGH_BATCH_D__PENDING_ADVISOR_ACCEPTANCE` | Re-prove at Batch E HTTP boundary |
| AO-SEC-005 Audit/kill-switch/manual fallback | `src/application/audit/`, `src/adapters/gateways/`, `src/application/advisor-inbox/` | `tests/integration/lifecycle-audit.test.ts`, `tests/integration/tmux-advisor-gateway.test.ts`, `tests/recovery/advisor-message-crash-consistency.test.ts` | Redacted ledger projection, capability/kill/stale/conflict fail-closed behavior, durable receipt/manual evidence, and ambiguous no-resend pass | `IMPLEMENTED_BATCH_D_LOCAL_SUBSET__PENDING_ADVISOR_ACCEPTANCE` | Separate security audit/server and real transport remain Batch E/external |
| AO-SEC-006 PWA/offline confidentiality | `src/pwa/` | `tests/e2e/pwa-cache-security.spec.ts` | `NOT_IMPLEMENTED`; Section 15 | `DESIGNED_CANDIDATE` | Batch E |

Cross-document traceability is indexed in `docs/FEATURE_INDEX.md`.
