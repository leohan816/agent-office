# Agent Office Security and Authority Model

Status: `REVIEWED_DESIGN__BATCH_B_C_D_ACCEPTED__BATCH_E_LOOPBACK_SECURITY_IMPLEMENTED__REAL_AUTH_PRIVATE_NETWORK_GATED__PENDING_REVIEW`

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
AO-D-R1 rework commit `04809004bfd863181f4af8260879f56bc8b6ede6`
adds strict runtime capability vocabulary, clock, and temporal validation without
adding any authority or transport surface.

Advisor accepted Batch D as the Batch E dependency. Batch E commit
`e0a11f69fffc9d35d67cc478cbefbb92d93cf528` implements only the loopback,
test-auth/session-contract, closed HTTP/SSE, PWA-cache, redacted audit, and local
recovery security boundary described here. It accesses no real credential and
does not enable private/public ingress, TLS/HSTS, deployment, DB, remote host,
Hermes, real tmux input, off-host backup, or production/live mode.

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

### 1.1 Batch B-E as-built security boundary

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
  typed alert actions. Batch E `src/server/http/` exposes only the documented
  static/read/status/SSE routes and six exact typed mutations; arbitrary
  path/role/session/pane/command/Worker/Reviewer targets do not exist.
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
  disabled/kill/malformed/stale/conflict/ambiguous state is manual fallback.
- `src/server/network/`, `src/server/auth/`, and `src/server/security/` enforce
  loopback peer/bind, exact Host/same origin, no forwarding/CORS, guarded test
  auth, opaque revocable sessions, capability/CSRF/Fetch Metadata, strict JSON,
  body/time/rate bounds, CSP/no-store, and owner-only hash-chained audit. Default
  config selects no provider and mutation-disabled read-only mode.
- `src/pwa/`, `public/sw.js`, and `src/ui/pwa/` precache the built hashed shell,
  exclude all API/auth/message/evidence routes, provide no sync queue, and show
  loopback/auth/read-only/delivery/offline/update/recovery state.
- Adapter/security boundary tests are deterministic and use fake tool runners;
  traversal, symlink, special-file, hostile argv/ref/name, timeout/cap, root
  isolation, malicious inert text, capability matrix, and forbidden-scope cases
  pass in 50 Vitest files/196 tests plus 18 Chromium tests at
  `e0a11f69fffc9d35d67cc478cbefbb92d93cf528`.

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

Batch E preserves the Batch D content bounds and adds exact HTTP enforcement:
subject at most 200 Unicode scalars, body at most 16 KiB, whole mutation at most
32 KiB, at most 50 allowlisted IDs, fatal UTF-8/JSON parsing, unknown-field and
control rejection, bounded timeout, CSP with no unsafe inline/eval, redacted
error bodies, and typed application responses. React text nodes and the inert
fenced-code renderer continue to treat hostile markup as content only.

## 10. Rate Limits and Resource Bounds

The implemented single-instance loopback limits are:

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

`src/server/security/rate-limiter.ts` and `src/server/http/server.ts` enforce the
table, including the two-connection SSE cap in `src/server/sse/index.ts`.
`tests/security/rate-limit.test.ts`, `tests/security/http-boundary.test.ts`, and
`tests/integration/sse-reconnect.test.ts` pass. The limiter is intentionally
in-memory and makes no shared/multi-host safety claim.

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
Runtime checks accept only the exact three closed vocabularies, require a
canonical UTC clock on health/new-queue/uncached-lookup paths, reject a future
`issuedAt`, and treat `expiresAt` as an exclusive boundary.

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
tests prove message/note content is absent. Batch E adds serialized owner-only
`audit/security-000001.jsonl` records for startup/bind class and HTTP outcomes,
with IDs, stable codes, subject/request/correlation refs and safe payload hashes
only. Restart hash-chain validation, concurrent append ordering, tamper rejection,
and canary redaction pass in `tests/security/audit-log.test.ts` and
`tests/security/http-boundary.test.ts`. A real auth provider and its lifecycle
audit, audit rotation, and retention remain gated because no real provider or
retention authority exists.

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
malformed, future-issued, expired, kill-switched, stale, or conflicting
capability invokes no delivery port and returns manual fallback; invalid
authority also suppresses receipt lookup. Ambiguous started delivery performs
lookup only and persists manual evidence when no receipt exists. It does not read
or mutate the real external transport state.
The UI always shows delivery state and the manual pointer path. Re-enable requires
fresh configuration/authority validation and an audit receipt; it is never timed
or automatic.

Batch E adds `DurableDeliveryControl`, which starts disabled, writes an immutable
disable receipt plus owner-only idempotency index, replays the same request after
restart, conflicts on changed input, and exposes no enable method. It neither
changes nor bypasses the external canonical transport kill switch.

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

The Batch E default UI has no live authenticated provider and therefore holds no
server-loaded sensitive projection. It remains visibly `AUTH_BLOCKED` and
`READ_ONLY`; the real logout/session-expiry client binding remains part of the
separately gated real-provider work rather than a hidden fake login.

## 16. Security Acceptance Tests

Batch E evidence includes:

- non-loopback bind fail-closed tests;
- missing/invalid auth provider mutation denial;
- session fixation, expiry, rotation, revocation, and capability tests;
- cross-origin, Fetch Metadata, CSRF, CORS, Host, content-type, and cookie tests;
- rate-limit, size-limit, Unicode/control-character, Markdown/XSS, and CSP tests;
- path traversal, symlink race, special file, repo allowlist, and output-cap tests;
- command/target field rejection and proof no browser route reaches Worker/Reviewer;
- direct-exec argv tests proving no shell and no writable Git/tmux observation;
- same-ID/same-hash replay and same-ID/different-hash conflict after restart;
- gateway invalid-vocabulary/inactive/kill-switch/registry/time-boundary/manual
  fallback tests;
- audit redaction tests seeded with canary secret-like values; and
- service-worker cache inspection proving API/auth/message data is absent.

Tests use synthetic credentials/canaries only. No real secret, external exposure,
Tailscale action, or production identity is permitted by this design.

At commit `e0a11f69fffc9d35d67cc478cbefbb92d93cf528`, all listed applicable local
tests pass within the 50-file/196-test Vitest and 18-test Chromium suites. The
path/special-file/direct-exec items also remain covered by the accepted Batch B-D
adapter regression. Local built-shell smoke confirms `127.0.0.1`, CSP, immutable
hashed assets, redacted status, and `AUTH_PROVIDER_UNAVAILABLE` mutation denial.

## 17. Local Traceability

| DESIGN_REQUIREMENT | IMPLEMENTATION_PATH | TEST_PATH | CURRENT_EVIDENCE | STATUS | DEFERRED_GATE |
|---|---|---|---|---|---|
| AO-SEC-001 Loopback private fail-closed bind | `src/server/network/`, `src/server/http/static-shell.ts`, `config/agent-office.loopback.json` | `tests/security/bind-policy.test.ts`, `tests/security/static-shell.test.ts`, `tests/security/private-network-disabled.test.ts` | Explicit loopback bind/peer/Host only; proxy/wildcard/nonloopback/private-mode changes and unsafe static paths fail closed; no CORS/TLS/HSTS claim | `IMPLEMENTED_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Private/public network and deployment separately gated |
| AO-SEC-002 Auth/session/capability model without embedded secrets | `src/server/auth/`, `src/server/config.ts` | `tests/security/auth-session.test.ts`, `tests/security/http-boundary.test.ts` | Provider interface, guarded synthetic provider, opaque host-only session/cookie, rotation/expiry/revocation/capability checks pass; no-provider default denies mutation | `IMPLEMENTED_BATCH_E_TEST_BOUNDARY_ONLY__PENDING_ADVISOR_ACCEPTANCE` | Real provider/credential and lifecycle audit need secret-handling authority |
| AO-SEC-003 CSRF/origin/rate/input/output controls | `src/domain/messages/`, `src/server/network/`, `src/server/security/`, `src/server/http/`, `src/ui/communication/` | `tests/security/http-boundary.test.ts`, `tests/security/rate-limit.test.ts`, `tests/integration/http-advisor-message.test.ts` | Exact Host/origin/fetch/CSRF/content/schema/size/time/rate controls, CSP/no-store, typed receipt-only POST, restart replay/conflict, inert text and redacted errors/audit pass | `IMPLEMENTED_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Shared limiter/private origin/TLS remain gated |
| AO-SEC-004 No browser role dispatch or arbitrary command | `src/adapters/observations/`, `src/adapters/gateways/`, `src/application/advisor-inbox/`, `src/server/http/`, `src/ui/communication/` | `tests/security/http-boundary.test.ts`, `tests/integration/tmux-advisor-gateway.test.ts`, `tests/acceptance/batch-gates.test.ts` | Six exact typed mutations and read/static routes only; command/target/role/path/Worker/Reviewer/terminal routes and fields reject; server has no process primitive | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Fixed prohibition; real Advisor transport remains external |
| AO-SEC-005 Audit/kill-switch/manual fallback | `src/application/audit/`, `src/adapters/gateways/`, `src/operations/readiness/delivery-control.ts`, `src/server/security/audit.ts` | `tests/security/audit-log.test.ts`, `tests/recovery/rollback-disable.test.ts`, `tests/recovery/advisor-message-crash-consistency.test.ts` | Accepted gateway fail-closed/manual behavior plus owner-only security audit and default-off durable app disable/replay/conflict pass | `IMPLEMENTED_THROUGH_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Real transport state/re-enable and audit retention remain external/gated |
| AO-SEC-006 PWA/offline confidentiality | `src/pwa/`, `src/ui/pwa/`, `public/sw.js` | `tests/pwa/cache-policy.test.ts`, `tests/e2e/pwa-cache-security.spec.ts`, `tests/e2e/pwa-lifecycle.spec.ts` | Hashed shell install cache, sensitive-prefix/no-store exclusion, GET-only runtime cache, no sync queue, offline read-only, user update, unregister recovery pass | `IMPLEMENTED_BATCH_E__PENDING_ADVISOR_ACCEPTANCE` | Live authenticated UI requires separately approved real provider |

Cross-document traceability is indexed in `docs/FEATURE_INDEX.md`.
