# AS1 Socket App-Identity Transport Design Delta

Status: `DESIGN_DELTA_CANDIDATE__PENDING_INDEPENDENT_REVIEW`

Terminal design decision: `SAFE_NARROW_DELTA_READY_FOR_REVIEW`

Mission: `AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_PILOT_001`

Actor: `Agent Office Designer`

Mode: `SECURITY_TRANSPORT_DESIGN_DELTA_ONLY`

## 1. Decision and scope

A supported pre-event App-identity path exists without weakening the frozen
credential-pair boundary. Replace the inbound use of
`@slack/socket-mode@3.0.0` with a narrow adapter composed only from:

1. the public-root `WebClient` and public `apps.connections.open` method in the
   already-pinned `@slack/web-api@8.0.0`; and
2. an exact new direct dependency on public-root `ws@8.21.1`, configured with
   `maxPayload: 32768`, `maxBufferedChunks: 64`, `maxFragments: 64`, and
   `perMessageDeflate: false` before the connection is opened.

The adapter must own the raw Socket Mode stream from the temporary URL through
the first `hello`. It must keep the connection in a zero-buffer quarantine,
parse only the exact bounded `hello` grammar, compare
`hello.connection_info.app_id` inside the transport boundary, and synchronously
seal the already-verified fixed profile before it enables Events API parsing or
application delivery.

This is a design delta only. It does not implement the adapter, authorize a
live connection, alter owner setup, accept risk, close `B01`, or change any
other review finding. All frozen AS1 design/security contracts remain in force
except that the selected inbound transport implementation is now the raw
public-API adapter specified here rather than `@slack/socket-mode`.

## 2. Immutable authority and exact question

This delta was derived directly from:

- frozen design commit
  `81a8c3474380a7e427516d6f5e57c97ad88c6c9b`;
- rejected source candidate
  `aac3e515ca05b89545688f84a4c17e4be12fa29d`;
- independent implementation review commit
  `3100a717418d8a4dc17d0114aaa3daa8b14ac083` and exact review-result SHA256
  `c06bbad3ce948829b6e192b30f07f2144e57efec9fa441e21b87580e4dcccf6b`;
- Worker patch handoff commit
  `a61207fb81de2fe21f5519348bffbceab51782fe`; and
- Designer delta handoff/run-prompt governance commit
  `f9d6ad1a0a7ce3b7a5f9bfb71bf043bdbad7c13c`.

The exact security question is whether, before any Team event body is parsed by
or delivered to AS1 application code, one fixed profile can prove that these
facts all belong together:

```text
owner-configured App ID
  == receive-grant App ID
  == bots.info(bot token, auth.test.bot_id).bot.app_id
  == Socket hello.connection_info.app_id for the app-level token

owner-configured workspace ID
  == receive-grant workspace ID
  == auth.test(bot token).team_id

owner-configured channel ID + Leo user ID + fixed Advisor lineage
  == selected closed profile + receive grant + sealed profile state
```

The answer is yes only with the raw quarantine contract below. A callback's
later `api_app_id` is defense in depth and per-event validation; it is not a
substitute for the pre-event app-token proof.

## 3. Exact SDK and platform evidence

### 3.1 Evidence classification

| Evidence | Exact observation | Classification and consequence |
|---|---|---|
| Repository lockfile | `@slack/socket-mode@3.0.0` integrity is `sha512-QShO60SB0E+HH+TbcKj3CBEQbodToRyiXnxuSB4t1kvUlqEmuGA1nOOjrRDkDJbOECAZ13PLe4ek9SrntpfoYg==`; `@slack/web-api@8.0.0` integrity is `sha512-ORx3XQryQPq2Jnxv5giSKXVoQRUeylrrymIR2S9fPzLjPcCts8RayMeBSZMcpfpAqp6fnBRuPW2UB6dUPUTEZA==`. | Exact pinned artifacts inspected; no floating version assumption. |
| `@slack/socket-mode` package root | `main` is `dist/src/index.js`; `types` is `dist/src/index.d.ts`. The root exports `SocketModeClient`, options, logger/error types, and no raw WebSocket type or typed `hello`/`ws_message` contract. | Public package-root authority. No supported raw-hello export. |
| `SocketModeOptions` declaration | Public options include `autoReconnectEnabled` and `clientOptions`, so HTTP retries can be set to zero and reconnect can be disabled. | Supported controls, but insufficient for pre-event identity. |
| `SocketModeClient` declaration | `start()` returns `AppsConnectionsOpenResponse`; `onWebSocketMessage` is `protected`; ACK send is `private`; the underlying `SlackWebSocket` is not a root export. | A subclass cannot both replace raw handling and retain a supported public ACK path. Deep imports or private access are forbidden. |
| Published package README | Documents ordinary event names, `slack_event`, lifecycle events, and `ack`; it does not document `hello` or `ws_message` as consumer events. `connected` is documented without a raw hello payload. | Public documentation. Neither `hello` nor `ws_message` is an identity authority. |
| Pinned runtime internals | The internal socket emits `ws_message`; the client registers its listener in its constructor before consumer listeners can be added. Its handler logs the full raw payload at debug, calls unrestricted `JSON.parse`, consumes `hello`, and emits `connected` with the saved `apps.connections.open` response. | Negative evidence only. It proves the pinned implementation is unsafe for this boundary; it does not make `ws_message` a supported API. |
| Pinned runtime internals | When `clientOptions.retryConfig` is absent, the Socket client sets `{ retries: 100, factor: 1.3 }`. It emits application events after parsing and exposes manual `ack`, but the raw log/parse has already happened. | Negative evidence only. Explicit retry configuration cannot repair the missing pre-parse identity gate. |
| `@slack/web-api@8.0.0` public root | Exports `WebClient`, `WebClientOptions`, `RetryOptions`, request/response types, and a typed `apps.connections.open()` method. `WebClientOptions` publicly supports `retryConfig`, `fetch`, `timeout`, `logger`, `rejectRateLimitedCalls`, and `allowAbsoluteUrls`. | Supported package-root seam for one bounded URL request. |
| `AppsConnectionsOpenResponse` declaration | The typed response contains `ok`, `url`, and error/scope fields; it contains no supported App-ID field. | The response cannot prove the app token's App ID. The URL remains opaque secret transport material. |
| Node 24 platform WebSocket | Runtime is Node `v24.18.0`, but the public constructor exposes no `maxPayload`, fragment-count, or buffered-chunk option. The complete message is presented only at the JS `message` callback. | Supported API but `NOT_BOUNDED_ENOUGH`; it does not prove the frozen pre-callback 32-KiB raw-message/memory boundary and is not selected. |
| `ws@8.21.1` public package root | Exact npm artifact SHA512 is `sha512-+0NTnW77fFN/DjQi6k/Sq/Yvk4Sgajw7urW8V+asjXnRgDs9gyGkdb7EzgfhA4goXsRIZKE28fzIXBHEzhuiWw==`. Its public client options document `maxPayload`, `maxBufferedChunks`, `maxFragments`, `perMessageDeflate`, `handshakeTimeout`, redirects, UTF-8 validation, and a finite force-close timeout. | Supported bounded transport. Exact configuration below prevents an over-limit/over-part message from reaching the consumer `message` callback. |
| `ws@8.21.1` release evidence | Release `8.21.0` introduced `maxBufferedChunks` and `maxFragments` to fix remote memory exhaustion; release `8.21.1` additionally counts empty fragments and reduces defaults. | Exact `8.21.1` is the minimum selected pin. Earlier `8.x` versions and version ranges are forbidden. |
| `@types/ws@8.18.1` | Exact npm artifact SHA512 is `sha512-ThVF6DCVhA8kUGy+aazFQ4kXQ7E1Ty7A3ypFOe0IcJV8O/M511G99AW24irKrW56Wt44yG9+ij8FaqoBGkuBXg==`. It types the public client, `maxPayload`, compression, redirect, handshake, UTF-8, and close APIs, but omits exactly three selected public runtime options used by this design: `closeTimeout`, `maxBufferedChunks`, and `maxFragments`. | Add as an exact dev dependency. A local structural intersection adds exactly those three documented runtime fields; no `any`, cast, module augmentation, deep import, suppression, or `skipLibCheck` exception is allowed. |
| Project TypeScript configuration | `target: ES2024`, `module/moduleResolution: NodeNext`, `strict: true`, `exactOptionalPropertyTypes: true`, `verbatimModuleSyntax: true`, and `skipLibCheck: false`. | The ESM package-root import, exact structural three-field type extension, direct public constructor call, and public `terminate()` call must compile unchanged under TypeScript `6.0.3`; no suppression is permitted. |

The `@slack/socket-mode` internals above are cited only to reject unsupported
behavior. The recommended contract relies on package-root declarations,
published upstream `ws` API documentation/release contracts, official Slack
protocol documentation, and Node platform primitives used beneath those public
packages.

### 3.2 Official protocol facts

Slack's official [Socket Mode protocol](https://docs.slack.dev/apis/events-api/using-socket-mode/)
states that:

- an app-level token is used with `apps.connections.open` to obtain a temporary
  WebSocket URL;
- implementing the Socket Mode protocol directly is supported;
- after connection Slack sends `hello` with
  `connection_info.app_id`;
- Events API messages use an outer object containing `payload`, `envelope_id`,
  `type`, and `accepts_response_payload`;
- the client acknowledges an event by sending its exact `envelope_id`; and
- provider `disconnect` messages and periodic connection refreshes must be
  expected.

The official [`apps.connections.open`](https://docs.slack.dev/reference/methods/apps.connections.open/)
contract authenticates with an app-level token and returns a temporary `url`.
Its example URL contains query material, but the documentation does not define
any query parameter as a stable App-identity assertion. AS1 therefore treats
the entire URL as an opaque secret and never derives identity from it.

Official [`auth.test`](https://docs.slack.dev/reference/methods/auth.test/)
returns workspace, user, and bot identity for a bot token but no App ID.
Official [`bots.info`](https://docs.slack.dev/reference/methods/bots.info/)
states that `bot.app_id` identifies the Slack app to which the bot belongs.
Official [token documentation](https://docs.slack.dev/authentication/tokens/#app-level)
says an `xapp-` token represents an app across organizations, but documents no
API that maps that token to a caller-supplied immutable App ID before the
Socket opens. The documented `hello.connection_info.app_id` remains the needed
pairing assertion.

Node's official [global `WebSocket` documentation](https://nodejs.org/docs/latest-v24.x/api/globals.html#class-websocket)
defines a stable browser-compatible API but no pre-callback payload or fragment
limit, so it is not selected. The public [`ws@8.21.1` client API](https://github.com/websockets/ws/blob/8.21.1/doc/ws.md#new-websocketaddress-protocols-options)
defines `maxPayload` as the maximum allowed message size and separately defines
maximum buffered chunks and message fragments. Its public
[`8.21.0` release](https://github.com/websockets/ws/releases/tag/8.21.0)
states that the two part-count options fixed remote memory exhaustion; the
public [`8.21.1` release](https://github.com/websockets/ws/releases/tag/8.21.1)
states that empty fragments are now counted. Those are hard dependency facts,
not a residual for risk acceptance.

## 4. Why the pinned Socket client cannot satisfy the boundary

### 4.1 Documented events and state

The documented event surface is already post-parse. `connected` does not carry
the raw `hello`; in the pinned runtime it carries only the saved
`apps.connections.open` response, whose public response type has no App ID.
`slack_event` carries parsed event data and therefore occurs too late.

Result: documented/public `@slack/socket-mode@3.0.0` events are
`NOT_SECURITY_EQUIVALENT`.

### 4.2 `ws_message`

`ws_message` is absent from the public root declarations and published README.
The pinned internal `SlackWebSocket` emits it, but the client installs its own
listener during construction. A consumer can attach only afterward; normal
EventEmitter ordering causes the SDK's full-payload debug log, unrestricted
parse, hello consumption, and possible application-event emission before the
consumer listener. There is no supported cancellation/stop-propagation
contract.

Result: `ws_message` is `UNSUPPORTED_AND_TOO_LATE`.

### 4.3 Protected override or deep import

Overriding the declared protected `onWebSocketMessage` could intercept raw data,
but calling the base method reintroduces the unsafe log/parse path. Replacing it
entirely loses the client's private ACK sender. Reaching the internal
`SlackWebSocket`, private sender, saved response, or listener collection would
require a deep/private API. A version pin does not convert those internals into
a supported contract.

Result: there is `NO_COMPLETE_PUBLIC_ROOT_RAW_HOOK` in version 3.0.0.

## 5. Swapped app-token threat trace

The critical trace is a correct fixed Agent Office profile and bot token paired
with the Foundation app-level token (and the symmetric case):

```text
1. DEFAULT_DISCONNECTED
2. select literal profile; bind immutable workspace/App/channel/Leo/Advisor facts
3. validate exact pre-event receive grant and isolated profile-state seal
4. auth.test(correct bot token) -> expected workspace + bot/user IDs
5. bots.info(correct bot token, bot ID) -> expected configured App ID
6. apps.connections.open(swapped xapp token) -> temporary URL for the wrong App
7. `ws@8.21.1` enforces 32-KiB payload plus 64-chunk/64-fragment caps,
   with compression disabled, before emitting the first text message
8. hello-only quarantine parser extracts wrong connection_info.app_id
9. compare fails inside the transport message callback
10. persist stable pair-mismatch/global-start-failure reason where possible
11. close that socket; close the peer client if open; enable no event parser,
    call no application handler, ACK nothing, perform no retry or fallback
12. remain disconnected/latched pending separately authorized recovery
```

An event frame sent instead of `hello`, or placed before `type` in a malicious
object, cannot smuggle content through the check. The pre-hello parser permits
only hello keys. It rejects an unknown top-level key before scanning that key's
value, and rejects a non-`hello` type before parsing any later field. It never
calls general `JSON.parse`.

Process or profile isolation limits the blast radius but does not change step 8:
the wrong token still authenticates the wrong Slack App inside the correct
process/profile. Isolation is mandatory defense in depth, never proof.

## 6. Option matrix

| Option | Pre-event security equivalence | API support | Implementation impact and testability | Rollback | Residual unknowns / decision |
|---|---|---|---|---|---|
| 1. Documented `@slack/socket-mode@3.0.0` lifecycle/event payloads | No; raw hello is consumed before consumer events. | Public, but post-parse only. | Small code impact; cannot express the invariant, so a passing fake would be misleading. | Easy. | `REJECT`. |
| 2. Consumer `ws_message` listener | No; SDK listener is registered first and logs/parses before a later consumer listener. | Undocumented and absent from root types. | Fragile ordering/private-event tests; no safe cancellation. | Easy but unsafe. | `REJECT`. |
| 3. Protected override, internal socket, or deep import | No complete path; retaining base reintroduces unsafe handling, replacing base loses public ACK. | Protected/private/deep, not a complete root contract. | High coupling to internals; version pin does not cure support risk. | Difficult across patch versions. | `REJECT`. |
| 4. Public `apps.connections.open` + Node 24 platform WebSocket | No proof of the frozen memory boundary; no public pre-callback `maxPayload`, buffered-chunk, or fragment cap. | Official Slack method plus stable platform API. | Fakeable, but a JS-callback size check occurs after platform buffering and cannot prove the required boundary. | Easy. | `REJECT__NOT_BOUNDED_ENOUGH`. |
| 5. Official pre-open API mapping `xapp` to App ID | No such documented method was found. `auth.test`/`bots.info` prove the bot side only; `apps.connections.open` returns an opaque URL. | No supported identity field/API. | None available. URL query parsing would be undocumented. | N/A. | `REJECT`. |
| 6. Separate processes/profile state only | No; a swapped token remains valid for the other App. | Platform architecture, not Slack identity. | Retain as mandatory defense in depth and no-fallback control. | Existing process isolation rollback. | `DEFENSE_IN_DEPTH_ONLY`. |
| 7a. Upgrade `@slack/socket-mode` hoping for a new raw hook | Not proved. Any candidate must expose pre-log/pre-parse hello, bounded parsing, manual ACK, and retry controls at its public root. | Unknown until a separately pinned artifact is reviewed. | Dependency/source/type/retry/logging review plus full regression. | Pin rollback. | `MATERIAL_REVIEW_COST__NOT_SELECTED`. |
| 7b. Replace inbound SDK use with `@slack/web-api@8.0.0` + exact `ws@8.21.1` | Yes under the hard options below: 32-KiB `maxPayload`, 64 chunks, 64 fragments including empty fragments, compression off, UTF-8 validation on, no redirects/retries. | Public package roots and published upstream limit contract. | Remove Socket SDK; add one runtime and one exact type dependency; pure fake transport and raw-frame tests. Requires full dependency/transport delta review, not risk acceptance. | Revert bounded dependency/adapter package and remain disabled; never fall back to rejected Socket SDK. | `SELECTED__BOUNDED_SECURITY_TRANSPORT_DEPENDENCY_DELTA`. |

## 7. Recommended exact transport contract

### 7.1 Fixed construction and isolation

Each closed profile owns a distinct, immutable transport instance containing:

- one literal `profileId` and its fixed workspace, App, channel, Leo user, and
  Advisor lineage;
- one profile-local app-token handle and no token setter;
- one profile-local bot-identity proof from `auth.test` + `bots.info`;
- one profile-local Web API client for `apps.connections.open`;
- at most one public-root `ws` client and one generation counter;
- one message handler, one readiness seal, one ACK registry, and no cross-profile
  maps, queues, callbacks, or fallback; and
- a profile-local state root/hash chain physically separate from the other
  profile.

No constructor accepts a generic route or derives a profile from a token,
temporary URL, event, display name, or caller-selected string. The exact
profile is selected before either credential is used. A contradiction between
profiles engages the frozen global-latch behavior; it never swaps clients.

### 7.2 Exact limits

| Item | Exact bound |
|---|---|
| Complete startup identity deadline | 10,000 ms from immediately before `apps.connections.open` through accepted hello; one deadline, never reset |
| `apps.connections.open` response body | 65,536 bytes before SDK JSON parsing |
| Temporary WebSocket URL | 4,096 UTF-8 bytes; memory only |
| `ws` `maxPayload` | exactly 32,768 bytes; over-limit frame or fragmented message errors before `message` emission |
| `ws` buffered data chunks | maximum 64 before `message` emission |
| `ws` message fragments | maximum 64, including empty fragments, before `message` emission |
| WebSocket compression | exactly disabled (`perMessageDeflate: false`); no compressed expansion path |
| Trusted parsed nesting | maximum depth 8 |
| Any trusted parsed array | maximum 16 elements |
| Hello `app_id` | exact Slack App-ID grammar `A[A-Z0-9]{6,30}` |
| Envelope ID | nonempty ASCII opaque-ID grammar, maximum 128 bytes |
| Retry reason / hello debug scalar | maximum 256 UTF-8 bytes; never logged |
| ACK frame | exact one-field JSON, maximum 256 UTF-8 bytes |
| Message text after identity | existing 16,384-byte and 4,000-scalar bounds |
| In-memory inbound queue | existing maximum 32, with zero pre-hello/quarantine buffering |
| Drain and shutdown | existing single 15,000 ms deadline; never reset |

The selected receiver enforces the message-length and retained-part caps before
the consumer `message` event. With compression unoffered, it has no inflate path.
The application then checks the emitted buffer length again before any hello
lexing or general JSON parse. An implementation that omits, widens, dynamically
overrides, or cannot deterministically prove any of these four options fails the
design; it cannot proceed as `PASS_WITH_RISK`.

The value 64 is an AS1 constant, not provider configuration. It bounds both
retained input-part collections while allowing ordinary Slack hello/envelope
delivery and fragmentation far beyond the expected single-frame case. At most
32,768 payload bytes and at most 64 entries in each receiver part collection
can be retained for one message; a 65th entry fails before consumer delivery.
The exact 8.21.1 empty-fragment fix prevents zero-byte fragments from bypassing
that count.

### 7.3 Bounded `apps.connections.open`

Use `new WebClient(appToken, options)` from `@slack/web-api` package root with
exactly:

```text
retryConfig: { retries: 0 }
rejectRateLimitedCalls: true
maxRequestConcurrency: 1
timeout: remaining portion of the one 10,000 ms startup deadline
allowAbsoluteUrls: false
logger: AS1 redacting/suppressing logger
fetch: fixed-endpoint bounded response wrapper over globalThis.fetch
```

The fetch wrapper accepts only the fixed HTTPS Slack Web API endpoint selected
by the typed `apps.connections.open()` method. It streams at most 65,536 response
bytes, cancels/aborts on overflow, and returns a bounded platform `Response` to
the Web client. It never logs headers, token, URL, response bytes, or provider
errors. All logger methods discard untrusted arguments and emit, at most, one
fixed AS1 phase/reason code.

There is one method call and no surrounding retry loop. Rate limit, timeout,
network error, malformed response, `ok !== true`, missing URL, response overflow,
or deadline expiry fails the start. Caught values are mapped without
stringification to a stable reason.

Treat `response.url` as secret/untrusted. Before constructing a WebSocket,
require:

- a string of at most 4,096 UTF-8 bytes;
- successful platform `URL` parsing;
- protocol exactly `wss:`;
- no username, password, fragment, explicit port, or caller-added query;
- hostname exactly `wss.slack.com` or a DNS-label-safe subdomain ending exactly
  `.slack.com`; and
- pathname exactly `/link/`.

Query parameters are retained unchanged for connection but never inspected,
copied, persisted, or logged. AS1 does not append `debug_reconnects` or any
other parameter. Standard platform TLS verification is mandatory; no custom CA,
agent, dispatcher, certificate bypass, or TLS override is representable.

### 7.4 Exact bounded `ws` construction

Import the default `WebSocket` class and public types only from package root
`ws`. Construct the client with an immutable options literal equivalent to:

```text
allowSynchronousEvents: false
autoPong: true
closeTimeout: 5_000
followRedirects: false
handshakeTimeout: remaining portion of the one 10,000 ms startup deadline
maxBufferedChunks: 64
maxFragments: 64
maxPayload: 32_768
maxRedirects: 0
perMessageDeflate: false
protocolVersion: 13
skipUTF8Validation: false
```

No `headers`, `agent`, `createConnection`, `finishRequest`, `origin`, custom CA,
custom server-identity function, `rejectUnauthorized` override, or environment-
selected option is permitted. The URL is already validated and is passed
unchanged. `binaryType` is fixed to `nodebuffer`.

`@types/ws@8.18.1` does not declare exactly three selected public runtime
options used by this literal: `closeTimeout`, `maxBufferedChunks`, and
`maxFragments`. Strict code therefore defines only this local structural
extension:

```text
WebSocket.ClientOptions & {
  readonly closeTimeout: 5_000;
  readonly maxBufferedChunks: 64;
  readonly maxFragments: 64;
}
```

The immutable literal must use `as const satisfies` against that intersection
and is passed directly to the public constructor. `as any`, `unknown`
coercion, module augmentation, `@ts-ignore`, deep imports, and `skipLibCheck`
changes are forbidden. This keeps the three published runtime options visible
to strict TypeScript without pretending the older declaration already contains
them.

Mandatory type-contract evidence is an exact package-root NodeNext no-emit
compile probe against `ws@8.21.1` and `@types/ws@8.18.1` under TypeScript
`6.0.3`, all repository strict options, and `skipLibCheck: false`. The probe
imports only from package root `ws`, defines the full immutable options literal
with `as const satisfies` against the intersection above, passes it to a direct
`new WebSocket(..., options)` call, and includes a public `terminate()` call on
that client. It must compile with zero diagnostics and without `any`, casts,
module augmentation, deep imports, suppressions, or configuration weakening.

Public `ws` behavior supplies three independent pre-emission gates:

1. `maxPayload` rejects a single frame or cumulative fragmented message above
   32,768 bytes with an over-size receiver error/close before `message`;
2. `maxFragments` rejects the 65th message fragment, including empty fragments
   in exact version 8.21.1; and
3. `maxBufferedChunks` rejects the 65th retained input chunk.

`perMessageDeflate: false` prevents negotiation and therefore prevents a
compressed-message expansion path. UTF-8 validation remains enabled. The
consumer still checks `isBinary === false`, `Buffer.isBuffer(data)`, and
`data.byteLength <= 32_768` before the hello lexer or general parser. These are
hard gates; no activation or review verdict may waive one.

### 7.5 Complete state machine

| State | Permitted transition and action | Any other input |
|---|---|---|
| `DEFAULT_DISCONNECTED` | Verify Node 24, exact pinned dependency/constructor policy, exact profile, pre-event receive grant, isolated state/control/registry lineage, and unexpired connection authority; create an immutable local readiness seal. -> `LOCAL_SEAL_VERIFIED` | No network; stable failure; remain disconnected. |
| `LOCAL_SEAL_VERIFIED` | Run bot-token `auth.test`, then `bots.info`; require exact workspace, bot ID/user ID, `deleted:false`, and configured App ID. -> `BOT_PAIR_VERIFIED` | Complete start failure; no app-token call. |
| `BOT_PAIR_VERIFIED` | Call bounded `apps.connections.open` once with this profile's app token. -> `OPEN_URL_PENDING` | No fallback or token swap. |
| `OPEN_URL_PENDING` | Validate one bounded successful URL response as above. -> `WS_CONNECTING` | Close/no socket; stable start failure; no retry. |
| `WS_CONNECTING` | Construct with the exact options above and install `open`, `message`, `error`, and `close` handlers before any application handler. On `open`, require the immutable options/generation seal and -> `HELLO_QUARANTINE`. | Error/close/deadline -> fail start and latch as required; no reconnect. |
| `HELLO_QUARANTINE` | Receive exactly one already-transport-bounded non-binary Buffer, recheck 32,768 bytes, and run the hello-only parser below. Exact App-ID equality -> `AUTHENTICATED_QUARANTINE`. | Receiver limit/part error -> 1008/1009 and latch; binary -> 1003; malformed/non-hello/unknown -> 1008; mismatch -> global pair-identity start failure and 1008. Buffer nothing and ACK nothing. |
| `AUTHENTICATED_QUARANTINE` | In the same synchronous `message` callback, compare the precomputed readiness seal with the current immutable profile/control/latch/generation facts. Exact match -> `EVENT_RECEIVE_READY` before the callback returns. | Any failed seal or any reentrant data message -> close/latch; no buffering or parse. |
| `EVENT_RECEIVE_READY` | Accept bounded text frames; handle exact `disconnect` as control; otherwise apply bounded Events API parsing and deliver one profile-bound envelope/one-use ACK closure. | Binary, oversize, malformed, wrong outer shape, identity contradiction, queue overflow, or stale generation -> stable rejection/latch per frozen policy; no auto-ACK. |
| `DRAINING` | Disable new envelope delivery immediately; finish only already accepted durable decisions within the existing 15,000 ms deadline, then call `close(1000, "AS1_STOP")`. -> `CLOSING` | New data is not buffered or ACKed. Deadline/corruption -> latch and forced process exit path. |
| `CLOSING` | Accept only public `ws` `close`; its exact 5,000 ms `closeTimeout` forcibly terminates a stalled closing handshake. Remove handlers and secret/URL references. -> `CLOSED` | Data/error/shared deadline -> `LATCHED`; call public `terminate()` and exit nonzero if closure remains unconfirmed. |
| `CLOSED` | Remain disconnected. A new socket requires the frozen separately authorized clean-start/recovery gate and a still-valid exact receive grant. | No implicit transition. |
| `LATCHED` | Close socket(s), disable receive and delivery, retain evidence, expose only stable status. | No reset, reconnect, token fallback, or peer-profile substitution. |

The overall startup timer is created once before the Web API call and cancelled
only after `EVENT_RECEIVE_READY` or terminal close. Web API completion, socket
open, and hello do not reset or extend it.

Provider `disconnect` reasons, close/error events, and missed deadlines never
cause `apps.connections.open` or `new WebSocket` to run again. The raw adapter
has no automatic heartbeat/reconnect loop. RFC 6455 control-frame handling is
limited to the client's automatic pong response; it is not a Socket event ACK
or reconnect. A provider disconnect follows the existing durable latch/recovery
design, including its requirement for separately reviewed recovery before
reconnect where applicable.

### 7.6 Hello-only quarantine parser

The first data message is not passed to `JSON.parse`. A pure purpose-built lexer
accepts JSON whitespace and an order-independent object with only:

```text
required: type = exact unescaped string "hello"
required: connection_info = exact object { app_id: exact unescaped App ID }
optional: num_connections = bounded nonnegative integer
optional: debug_info = exact object containing only:
          host, started (bounded strings),
          build_number, approximate_connection_time (bounded nonnegative integers)
```

Rules:

- raw byte count is checked first;
- JSON nesting may never exceed 8 and arrays may never exceed 16, while this
  hello schema permits no array at all and has effective depth 3;
- duplicate keys, escaped key names, escaped `type`/`app_id`, unknown keys,
  non-finite/fractional/negative numbers, invalid UTF-16/JSON escapes, trailing
  tokens, and over-limit scalars are rejected;
- an unknown top-level key is rejected immediately after its key token, before
  its value is scanned;
- a parsed `type` other than exact `hello` is rejected immediately;
- only the bounded App ID is returned; debug data and raw bytes are discarded;
  and
- no parser error includes source text, key value, URL, token, App ID, host, or
  provider error.

Thus a first `events_api` object is rejected either at its `type` value or at an
unknown `payload` key, whichever comes first, without event-body parsing. The
transport necessarily receives the opaque text frame, but no Team content is
interpreted or delivered before App proof.

### 7.7 Post-proof envelope and identity gate

Only `EVENT_RECEIVE_READY` enables the general JSON path. For each text frame:

1. enforce the 32,768-byte limit;
2. parse to `unknown`; the result remains untrusted;
3. perform an iterative structural walk with depth 8 and array length 16 before
   field access or application delivery;
4. accept only the frozen exact Socket outer keys and `type: events_api`;
5. require one bounded `envelope_id`, `accepts_response_payload` absent/false,
   bounded optional retry fields, and a bounded callback object;
6. require callback `team_id`, `api_app_id`, authorization/bot identity, channel,
   Leo user, and fixed profile facts to agree before the pre-ACK application
   decision; and
7. expose no generic event listener or raw object channel.

An exact bounded `disconnect` object is transport control and never reaches the
application. Unknown Socket types, interactions, commands, DMs, App Home, and
other surfaces retain the frozen fail-closed policy.

### 7.8 Manual ACK contract

The adapter creates a one-use closure bound to:

- literal profile and socket generation;
- exact validated `envelope_id`;
- exact public-root `ws` instance; and
- `accepts_response_payload: false | absent`.

It sends only:

```json
{"envelope_id":"<validated exact ID>"}
```

The closure is never invoked by transport code. The application may invoke it
only after the frozen immutable receipt, dedupe, root/question transition or
terminal decision, and `RECEIPT_PERSISTED` ordering have completed. Before
`send`, require the same generation, state `EVENT_RECEIVE_READY` or an exact
already-accepted drain state, `readyState === WebSocket.OPEN`, zero prior ACK
use, and `bufferedAmount === 0`. After exact bounded serialization, call
public `ws.send` once and mark the closure consumed synchronously. There is no
send retry. Throw, close, nonzero pre-send buffer, duplicate use, or ambiguous
shutdown follows the frozen ACK-ambiguity/latch path.

No response payload is representable. The adapter never sends business content,
opens a generic send method, or treats Socket ACK as Advisor ACK, intake,
Mission, delivery grant, or final result.

### 7.9 Logging and secret disposal

Before either client is constructed, install the redacting/suppressing logger
and stable reason mapper. Allowed output is only fixed profile/phase/state and a
closed reason code. Forbidden at every level:

- bot/app tokens or token-shaped substrings;
- temporary WebSocket URL or any portion/query/hash of it;
- raw hello, event, ACK, provider response, provider error, close reason, or
  logger arguments;
- workspace/App/channel/user/bot/event/envelope IDs;
- event text or array/object content; and
- dynamic metrics labels from provider data.

On every terminal transition, remove listeners and clear references to app
token, URL, raw frame, and WebSocket. Durable records retain only the already
reviewed hashes/stable facts. No new secret artifact is introduced.

## 8. Exact later implementation scope

This delta grants no implementation authority. A later exact Advisor Worker
handoff that closes `B01` should authorize only these source/test/package paths:

1. `src/adapters/gateways/slack-pilot/socket-client.ts` — replace the SDK client
   with the exact raw state machine and one-use ACK contract;
2. `src/adapters/gateways/slack-pilot/socket-frame.ts` — new pure hello lexer and
   post-proof structural/envelope guards;
3. `src/adapters/gateways/slack-pilot/exact-authority.ts` — bind the expected App
   ID and immutable readiness seal into `connect`, so comparison occurs inside
   the message callback before readiness;
4. `src/application/slack-pilot/contracts.ts` — add only the 4,096-byte URL,
   256-byte ACK, 64-chunk, 64-fragment, and 5,000 ms close constants while
   reusing the frozen 32-KiB/depth/array/startup/deadline constants;
5. `tests/helpers/as1-slack-fakes.ts` — public-`ws`-shaped fake factory/client,
   bounded-fetch fake, frame controls, logger sink, and updated exact socket
   port;
6. `tests/integration/as1-slack-startup-auth.test.ts` — preserve the full pair
   permutation suite and assert the pre-event boundary;
7. `tests/adapters/as1-slack-socket-client.test.ts` — new deterministic raw
   transport/state/parser/ACK suite;
8. `package.json` — remove direct `@slack/socket-mode@3.0.0`, add exact runtime
   `ws@8.21.1`, and add exact dev-only `@types/ws@8.18.1`; and
9. `package-lock.json` — lockfile-only consequence of those three exact edits.

No other source, test, runtime composition, config, setup/as-built document,
existing reviewed design, Worker result, registry, Exact Delivery v2 file, or
external system belongs to this `B01` delta. In particular, this scope does not
repair `B02`-`B09` and does not enable the default-disabled runtime.

## 9. Required acceptance tests

All tests are synthetic, deterministic, and no-network. Real `fetch`, real
`WebSocket`, Slack, DNS, token, app, owner setup, and tmux are forbidden.

1. Static/package test: no production import of `@slack/socket-mode`, no deep
   Slack/Undici/`ws` import, no private member access, exact Socket SDK removal,
   and only exact `ws@8.21.1` + dev `@types/ws@8.18.1` additions.
2. Run the exact package-root NodeNext no-emit compile probe with `ws@8.21.1`,
   `@types/ws@8.18.1`, TypeScript `6.0.3`, all repository strict options, and
   `skipLibCheck:false`. It must use the three-field local intersection and
   immutable `as const satisfies` literal, pass that literal in a direct
   `new WebSocket(..., options)` call, include a public `terminate()` call, and
   produce zero diagnostics without `any`, casts, module augmentation, deep
   imports, suppressions, or configuration weakening. Then run lint, targeted
   tests, full tests, and build under Node 24.
3. Correct bot/app pairing reaches `EVENT_RECEIVE_READY` only after exact hello
   App-ID equality and a synchronous readiness-seal check.
4. Correct/correct, swapped bot, swapped app, both swapped, foreign workspace,
   wrong hello, wrong configured App, expired/wrong-profile grant, stale seal,
   and peer-profile interleaving traces preserve zero fallback.
5. A wrong-app hello followed immediately by a valid-looking Team event closes
   before general JSON parse or application callback; ACK count stays zero.
6. An event object as the first frame, with `payload` before or after `type`, is
   rejected without scanning/parsing payload content. Instrumented general
   parser call count remains zero.
7. Hello key-order permutations pass; duplicate, escaped, unknown, missing,
   malformed, over-depth, array, wrong type, wrong App grammar, trailing-token,
   and 32,769-byte hello cases fail closed without source-text logging.
8. The injected constructor spy proves the immutable options are exactly
   `maxPayload:32768`, `maxBufferedChunks:64`, `maxFragments:64`,
   `perMessageDeflate:false`, UTF-8 validation on, redirects off, one remaining
   handshake deadline, and 5-second force-close; widening/omission fails.
9. Public upstream contract evidence and pinned-integrity checks prove
   32,769-byte single/fragmented messages, a 65th fragment (including empty),
   and a 65th buffered chunk error before `message`. The fake also bypasses the
   receiver deliberately so the application defense recheck rejects them.
10. Text at the exact byte boundary, multibyte UTF-8 boundary cases, binary
   Buffers, and unexpected raw-data representations prove byte/binary behavior
   and close codes 1003/1008/1009.
11. URL tests accept only the exact Slack `wss` host/path class and reject HTTP,
   suffix confusion, credentials, port, fragment, malformed/oversize URL, and
   caller-added query. No URL reaches logs or persistence.
12. The bounded fetch fake proves one `apps.connections.open` call, response cap,
    one non-resetting 10-second deadline, `retries:0`, rate-limit rejection, and
    no retry on timeout/network/malformed/provider error.
13. After identity proof, exact envelope acceptance enforces 32,768 bytes,
    depth 8, arrays 16, exact keys, bounded IDs/retry fields, and callback
    workspace/App/bot/channel/user identity before pre-ACK classification.
14. Persist/decision happens-before ACK; persistence failure sends no ACK; exact
    duplicate replay may reproduce only the frozen durable decision; ACK is
    one-use, same-generation, exact-ID, payload-free, and never auto-retried.
15. Disconnect warning/refresh, error, close-before-hello, close-after-hello,
    startup timeout, event during quarantine, drain, close timeout, and shutdown
    all produce no implicit `apps.connections.open`, no new WebSocket, no
    fallback, and the exact latch/exit behavior.
16. Logger spies receive hostile token/URL/frame/provider-error material at every
    seam and prove that output/artifacts contain only closed stable reason codes.
17. Two profile transports use distinct fake clients, generation counters,
    handlers, ACK registries, readiness seals, and state roots; a cross-reference
    engages the global latch.
18. Existing focused Exact Delivery v2 tests remain unchanged and pass. Existing
    `B02`-`B09` evidence is neither rewritten nor represented as fixed.

## 10. Dependency, migration, and rollback

### Dependency impact

- Keep `@slack/web-api` exactly `8.0.0`.
- Keep Node engine `>=24.0.0`, TypeScript `6.0.3`, and
  `@types/node@24.13.3` unchanged.
- Remove direct `@slack/socket-mode@3.0.0` and only lockfile entries no longer
  reachable from any other direct/transitive dependency.
- Add exact runtime dependency `ws: "8.21.1"` with integrity
  `sha512-+0NTnW77fFN/DjQi6k/Sq/Yvk4Sgajw7urW8V+asjXnRgDs9gyGkdb7EzgfhA4goXsRIZKE28fzIXBHEzhuiWw==`.
- Add exact dev dependency `@types/ws: "8.18.1"` with integrity
  `sha512-ThVF6DCVhA8kUGy+aazFQ4kXQ7E1Ty7A3ypFOe0IcJV8O/M511G99AW24irKrW56Wt44yG9+ij8FaqoBGkuBXg==`.
- Do not install `ws` optional peer packages `bufferutil` or
  `utf-8-validate`; Node 24 supplies the required built-in primitives and no
  optional native path is approved.
- Add no other JSON, retry, logging, TLS, WebSocket, or testing dependency.
- Independently inspect the exact lockfile diff and dependency audit. Do not
  hand-edit the lockfile or upgrade adjacent packages.

Dependency/design classification:

`BOUNDED_SECURITY_TRANSPORT_DEPENDENCY_DELTA__FULL_INDEPENDENT_REVIEW_REQUIRED`

This class is not `PASS_WITH_RISK`. Independent review must positively verify
the exact artifacts, root exports/docs, release fixes, literal constructor
options, strict type bridge, fake traces, and lockfile/audit. Any missing proof,
version drift, option widening, optional native dependency, or unresolved audit
finding returns the package to default disconnected and prevents a PASS.

Retaining the unused Socket package would leave an attractive but unsafe import
available. Removal makes the selected boundary mechanically visible. Restoring
or upgrading it is a separate dependency/security decision, not rollback of a
live system.

### Migration

1. Keep the runtime descriptor disabled and all real credentials absent.
2. Implement only the exact file scope above on a new exact Worker handoff.
3. Run the fake acceptance suite and static/package checks with no network.
4. Obtain independent implementation/security review of source, package diff,
   strict types, tests, and this design delta.
5. Preserve `B02`-`B09` as open until separately corrected and reviewed.
6. Do not perform owner setup or live activation until all existing gates,
   including those findings, independently pass and Leo/GPT grants final
   authority.

### Rollback

Before any live activation, revert the bounded implementation/package commit
and remain default disconnected. Do not fall back to the rejected SDK adapter.
After any future live connection, use the frozen kill/latch/evidence-preserving
rollback: stop receive, close both clients, preserve journals/dedupe/state,
revoke under owner authority, and require a separately reviewed recovery before
reconnect. Never clear state, reuse a retired grant, swap tokens/profiles, or
blindly retry.

## 11. Review findings and preserved boundaries

### `B01`

This delta supplies a supported design-level resolution for:

- real raw hello access before event-body parse/delivery;
- app-token-to-configured-App proof;
- exact actual Socket envelope/ACK ownership;
- zero provider retry/reconnect;
- bounded pre-hello and post-proof parsing; and
- redaction before SDK/provider logging.

`B01` remains open. It may close only after a later exact implementation is
independently reviewed against this contract and the frozen design.

### `B02`-`B09`

These findings remain exactly unchanged and open as recorded:

- `B02` duplicate/crash recovery and incomplete ACK decision;
- `B03` continuation incorrectly persisted as `NEW_MISSION`;
- `B04` caller-selected authority/exact-delivery values;
- `B05` non-durable control/latch/capacity/shutdown behavior;
- `B06` insufficient Git/content evidence provenance;
- `B07` blind outbox resend and caller-selected target;
- `B08` unenforced external-input/durable-index bounds; and
- `B09` overstated setup/as-built/Worker evidence.

Nothing in this delta downgrades, patches, supersedes, or offers acceptance
evidence for those findings.

## 12. Residual risks and safe defaults

| Residual risk / unknown | Required safe default |
|---|---|
| Node platform WebSocket has no public pre-callback payload/part caps. | It is explicitly rejected and absent from production imports. No Reviewer discretion or risk acceptance can select it under this delta. |
| Slack may extend hello/debug fields. | Exact unknown-key rejection and remain disconnected until a reviewed parser update. |
| `ws@8.21.1` is a new security-critical direct dependency, and `@types/ws@8.18.1` omits exactly three selected runtime options used here: `closeTimeout` plus the two newer part-count options. | Exact immutable pin/integrities, public-doc/release inspection, local three-field structural type, exact package-root NodeNext strict compile probe with direct constructor and public `terminate()` calls and no casts/suppressions, exact option-spy tests, lockfile/audit, and full independent transport delta review. Any failure blocks activation; it is not accepted risk. |
| A future edit omits/widens `maxPayload`, `maxBufferedChunks`, `maxFragments`, or enables compression. | Exact literal/static test plus constructor-spy test fails; default disconnected. No configuration surface may override the literals. |
| The peer exceeds payload/fragment/chunk bounds. | `ws` receiver errors before `message`; close/latch with stable code, no hello/event parse, no ACK, no retry. |
| Closing handshake stalls. | Exact 5-second public `closeTimeout` force-terminates; shared 15-second lifecycle deadline and public `terminate()` are secondary hard stops; no reconnect. |
| WebSocket `send()` proves synchronous enqueue, not provider receipt. | Preserve frozen durable ACK ambiguity/dedupe behavior; never auto-resend. |
| Official URL host/path form may evolve. | Exact validation failure and no connection until a reviewed delta. Never weaken TLS or parse identity from query material. |
| Custom hello lexer is security-sensitive. | Pure module, exact grammar, hostile corpus/boundary tests, strict types, independent source review. |
| A future SDK may expose a better supported raw seam. | No migration without exact pin, root API/runtime review, full tests, and independent design/security approval. |
| No live proof was performed. | This is intentional. Default disconnected, fake-only Phase A, no token/App/Slack/owner action. |

## 13. Terminal design decision

`SAFE_NARROW_DELTA_READY_FOR_REVIEW`

This decision means one public-API design preserves or strengthens every
mandatory pre-event identity boundary and is sufficiently exact for independent
design review. It is not an independent-review verdict, implementation
authorization, risk acceptance, owner-setup instruction, activation approval,
or mission closure.

`RETURN_TO: agent-office-advisor`

`PROPOSED_NEXT_ACTOR: Agent Office Advisor`

`STOP`
