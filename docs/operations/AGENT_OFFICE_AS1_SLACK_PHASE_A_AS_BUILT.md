# AS1 Multi-Team Slack Pilot — Phase A As-Built

Status: `PHASE_A_IMPLEMENTATION_CANDIDATE_DEFAULT_DISABLED_SYNTHETIC_ONLY__PENDING_INDEPENDENT_IMPLEMENTATION_SECURITY_REVIEW`

Mission: `AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_PILOT_001`

Frozen parent: `81a8c3474380a7e427516d6f5e57c97ad88c6c9b`

This records the additive Phase A implementation of the reviewed design in
`docs/integration/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_DESIGN.md` and
`docs/security/AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md`. The committed
source is an **implementation candidate** — it has NOT yet received an
independent Reviewer PASS and must not be read as accepted Phase A. It claims no
enabled descriptor, live Slack connection, real tmux input, usable authority
material, owner setup, implementation-review `PASS`, risk acceptance, or mission
closure. All Phase A validation is synthetic with fake Slack/tmux ports.

## 1. Implemented modules (exact allowlist)

| Module | Responsibility |
|---|---|
| `src/application/slack-pilot/profiles.ts` | Closed two-member profile union; exhaustive `never` selector; runtime registry-lineage check; Foundation historical-join-key ban |
| `src/application/slack-pilot/contracts.ts` | Fixed AS1 `LIMITS`; bounded ID/token/ref/timestamp grammars; redaction; receive-grant & pointer-delivery-grant parsers; intake/pointer builders; message-text bounds; deferred-query matcher |
| `src/application/slack-pilot/inbound-store.ts` | Profile-local receipt/dedupe; hash-chained receive-grant state with sole linearization-time expiry binding; question state; root correlation; transport journal; delivery-authority one-use consumption; outbox/evidence logs; immutable artifacts |
| `src/application/slack-pilot/service.ts` | Persist/bind-before-ACK orchestration; inbound policy matrix; separate post-ACK materializer; thread correlation |
| `src/application/slack-pilot/evidence-ingress.ts` | Profile-bound ACK/intake/question/result schemas; injected Git-provenance verification; ordered stages; Foundation separation |
| `src/application/slack-pilot/outbox.ts` | Rendered same-thread outbound; safe-retry classification; no blind resend |
| `src/adapters/gateways/slack-pilot/secret-config.ts` | Strict owner-only exact-key secret parser; no-follow + double-stat; redacted projection |
| `src/adapters/gateways/slack-pilot/socket-client.ts` | Narrow raw `ws` public-root Socket Mode port (no `@slack/socket-mode`; auto-reconnect disabled); manual ACK; bounded FIFO admission (`INMEMORY_QUEUE_PER_PROFILE`/`INFLIGHT_SIDE_EFFECTS_PER_PROFILE`) with drain-deadline and forced-terminate latch |
| `src/adapters/gateways/slack-pilot/web-client.ts` | Narrow Web port (auth.test/bots.info/chat.postMessage only) + SDK adapter (auto-retry disabled) |
| `src/adapters/gateways/slack-pilot/exact-authority.ts` | Receive-grant startup gate + pair verification; readiness-lease parser; delivery-chain consistency; in-memory capability |
| `src/adapters/gateways/slack-pilot/exact-transport.ts` | Separate exact tmux journal/runner; two preflights; PASTE_STARTED no-retry boundary |
| `src/operations/readiness/as1-slack-control.ts` | Global/profile control; single-process lock (WriterLock); shutdown; rollback; irreversible latch |
| `src/runtime/as1-slack-pilot/composition.ts` | Descriptor parser; default-disabled fail-closed composition |
| `src/runtime/as1-slack-pilot/cli.ts` | Closed lifecycle command parser + redacted CLI + guarded operator entry |

Configuration: `config/agent-office.as1-slack-pilot.disabled.json` (default-disabled,
`receiveGrantRef: null`). Dependencies pinned: `ws@8.21.1` (raw Socket Mode
WebSocket) and `@slack/web-api@8.0.0` (package-root imports only); there is no
`@slack/socket-mode` dependency. Package script `as1:slack-pilot`.

## 2. Two-stage authority (as built)

Pre-event `As1PilotReceiveGrantV1` authorizes only opening/authenticating one
Socket client and durably receiving at most one root conversation before an
exclusive expiry. Its parser rejects every future event/intake/pointer/
destination/lease/capability/delivery field. The sole receive-expiry decision is
made at the serialized atomic `UNBOUND -> ROOT_BOUND` (or `OPEN -> CONSUMED`)
transition under the trusted local clock; receipt/parse/dedupe time never freeze
eligibility. A separate post-intake `As1PointerDeliveryGrantV1` (created outside
the gateway) is required before any lease/capability/tmux state; it binds the
exact source event, intake, root correlation, and pointer ref/hash and is
permanently single-use. The readiness lease and in-memory capability are one-use,
`<= 30 s`, and destination-bound.

## 3. Fixed limits

The Worker-handoff numeric limits (brief §4) are implemented as
`contracts.LIMITS` and referenced by their owning modules. Crossing a count/size/
time/retention bound persists a stable reason and fails closed; there is no
automatic deletion, compaction, or silent eviction.

## 4. Synthetic validation

All sixteen focused `as1-slack-*` test files use fake Slack/tmux ports and
disposable owner-only state roots with placeholder IDs/tokens only. No real DNS/HTTP/WebSocket/Slack or
tmux mutation is reachable. The narrow SDK adapters (`NodeAs1WebClient`,
`NodeAs1SocketClient`) exist for production composition and are never executed in
Phase A. There is no real tmux mutation runner in Phase A.

## 5. Default-disabled proof

With the committed descriptor and no reviewed receive-grant ref, `start` returns
a stable disconnected `DISABLED_DEFAULT_NO_AUTHORITY` result without opening Slack
or tmux. Even a descriptor carrying a grant ref yields
`LIVE_START_REQUIRES_SEPARATE_AUTHORIZATION`; Phase A never performs the live
connection or profile selection. `status` and `redacted-check` output are
secret-free.

## 6. Compatibility

Exact Delivery v2 (`src/adapters/gateways/tmux-advisor/*`,
`src/application/advisor-inbox/*`) and the organization registry identity/history
are byte-unchanged. AS1 owns separate schemas, roots, journals, ingress, latches,
grants, and capabilities and adds no profile selector or generic target to v2.

## 7. Remaining owner-only / deferred (unset)

Live workspace/App/channel IDs and tokens; owner setup; the actual reviewed
`As1PilotReceiveGrantV1` ref, post-intake pointer-delivery grants, fresh
destination locators, and one-use readiness leases; the real live connection and
the two sequential pilot round trips. These remain unset and unauthorized in
Phase A and require the separate later gates in
`docs/operations/AGENT_OFFICE_AS1_SLACK_SETUP.md`.
