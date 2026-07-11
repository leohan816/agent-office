# Agent Office M01 Master Design

Status: `REVIEWED_DESIGN__BATCH_A_B_ACCEPTED__BATCH_C_IMPLEMENTED__PENDING_ADVISOR_ACCEPTANCE`

Canonical owner: Agent Office repository

Mission: `AGENT_OFFICE_M01_ADVISOR_MANAGED_OFFICE_WEB_CONTROL_PLANE`

## 1. Purpose and Audience

Agent Office is a private, responsive operations control plane that projects
canonical mission state and gives Leo a structured path to Advisor. It makes
mission hierarchy, evidence, blockers, decisions, alerts, and role activity easy
to understand without turning a browser into a role dispatcher or terminal.

This design is for:

- Leo/GPT, who owns mission intent, risk acceptance, final approval, and the next
  mission;
- Advisor, who routes approved work and audits evidence;
- Agent Office Worker, who will implement only separately handed-off repo-local
  batches;
- Fable5, which independently reviews design and implementation; and
- operators maintaining the private local service and its evidence store.

The intended UI is quiet and operations-focused: low visual noise, explicit
staleness and authority labels, readable evidence, and animation that reflects
structured events only.

## 2. Current Truth and Batch C Boundary

Bootstrap commit `937f0c5f92cd3b39d81796c13bc00b4afe3407fb` remains the
repository-governance baseline. Canonical design commit
`82821afe48b08f70b6888e3ebf12dee3095cd2bb` received independent Fable5 delta
`DESIGN_REVIEW: PASS` in foundation-docs commit
`6c9d94f31ae5dd5424b511afb68188681ff95349`.

Batch A code/config/test commit
`7edc8f79bedb059ab6697e64ddaf57fbebde2c87` implements the strict TypeScript
domain contracts, approved manifest import/fixture, local single-writer JSONL
event store, immutable artifacts, deterministic projections/checkpoints, and
startup/recovery primitives. Advisor accepted it as the Batch B dependency in
`22_ADVISOR_BATCH_A_VALIDATION.md`.

Batch B code/config/test commit
`85e66d856e33a0df73041cb4b33aba30a8f9f96d` implements trusted local project/root
registration, bounded manifest/artifact verification, fixed direct-argv read-only
Git and exact-pane structured tmux observation, deterministic local freshness and
restart projection, and a responsive read-only operations dashboard. The full
suite is 23 test files/84 tests with lint, strict typecheck, production build, and
zero-vulnerability dependency audit passing. Advisor accepted it as the Batch C
dependency in `25_ADVISOR_BATCH_B_VALIDATION.md`.

Batch C code/config/test/asset commit
`e30a6cda52e14a4bf30b2d1b7445fa26645496e5` implements the full-width,
structured-event-only office scene, eight stable stations, deterministic
precedence/deduplication/bounded cue runtime, local code-native assets, responsive
mobile pagination, reduced-motion and visibility handling, semantic/live-region
accessibility, visible courier/keyboard/checklist/document/tool cues, and
deterministic Chromium visual/layout audits. The full
regression suite is 27 Vitest files/123 tests plus 10 Playwright tests, with lint,
strict typecheck, production builds, dependency audit, and diff/boundary checks
passing. It does not implement an HTTP server, auth, PWA, SSE, Advisor Inbox,
gateway, remote collector, DB, network exposure, deployment, or durable mutation.
Batch C is pending Advisor acceptance and does not authorize Batch D.

The byte-exact approved governance manifest remains version 1 with denominator
15. Its imported facts record AO-WU-01 through AO-WU-05 as `COMPLETED`, AO-WU-06
as `REVIEWING`, and later WorkUnits as `WAITING_DEPENDENCY`. The Batch A projector
preserves those facts without terminal-text inference.

## 3. Non-Goals and Fixed Prohibitions

M01 does not design or authorize:

- public Internet exposure, production/live deployment, or a protected-branch
  merge;
- a database, schema, migration, multi-user database service, or secret embedded
  in source, Markdown, browser storage, logs, or events;
- direct browser dispatch to a Worker or Reviewer;
- a browser, API, gateway, or adapter accepting arbitrary terminal commands;
- terminal-prose parsing as mission truth;
- Hermes implementation, automatic mission selection, automatic risk acceptance,
  automatic review, or automatic next-mission execution;
- replacement or duplication of Advisor-managed tmux transport authority; or
- changes to Foundation, foundation-control, SIASIU, Cosmile, or their canonical
  product authority.

Private-network and remote-host capabilities are extension designs only. They
remain disabled until their explicit gates are approved.

## 4. Authority and Source-of-Truth Precedence

Authority and data precedence are distinct. Higher rows win on conflict:

| Rank | Source | Authoritative for | Never authoritative for |
|---:|---|---|---|
| 1 | Explicit Leo/GPT decision artifact | Mission intent, material scope, risk acceptance, final approval, next mission | Routine Worker state inferred by UI |
| 2 | Canonical role V2 and active Advisor mission handoff | Actor authority, routing, review separation, exact current scope | Runtime projection cache |
| 3 | Versioned mission manifest plus approved scope-change records | Hierarchy, denominator, dependencies, required gates | Completion without evidence |
| 4 | Append-only accepted Agent Office domain events | Ordered state transitions and acknowledgements | Product-policy invention |
| 5 | Immutable Git, result, review, decision, and intake artifacts verified by hash and commit | Evidence cited by events | Unverified prose or mutable files |
| 6 | Read-only Git/tmux/host observations | Current observations with freshness metadata | Mission status or approval by inference |
| 7 | Deterministic projections and UI caches | Rebuildable presentation | Independent truth |

On disagreement, the projector marks the affected entity `CONFLICTED` in an
alert overlay, preserves both references, and refuses evidence-backed completion.
It does not silently choose a lower-precedence value. Advisor resolves routine
evidence discrepancies; material authority conflicts return to Leo/GPT.

The active tmux authority remains the committed canonical V2 Section 12A and:

- `../foundation-docs/advisor/_system/tmux_transport/TRANSPORT_PROTOCOL.md`
- `../foundation-docs/advisor/_system/tmux_transport/ACTIVATION_STATE.md`
- `../foundation-docs/advisor/_system/tmux_transport/KILL_SWITCH_AND_FALLBACK.md`

Agent Office references their state and receipts; it does not copy their rules
into executable product policy.

## 5. Domain Hierarchy and Counting

The immutable identity hierarchy is:

```text
Initiative -> Package -> Mission -> Phase -> WorkUnit
```

- An Initiative groups related approved packages.
- A Package is an approved delivery package inside one initiative.
- A Mission is a routed execution record with one versioned manifest.
- A Phase orders WorkUnits and expresses release-train gates.
- A WorkUnit is the smallest counted unit of approved work.

IDs are stable, case-sensitive strings and are never reused. Display labels may
change through a manifest revision; IDs and event history do not.

For manifest version `v`, the denominator is exactly the number declared by
`counting.denominator`, and it must equal the count of approved WorkUnit IDs in
that version. The numerator is the count of those WorkUnits whose evidence-backed
projection is `COMPLETED`. Removed historical WorkUnits remain in audit history
but are not silently deleted or renumbered.

A denominator or membership change requires a new manifest version and one
`MissionScopeChanged` event containing:

- `oldTotal`, `newTotal`, and consecutive `fromManifestVersion` and
  `toManifestVersion`;
- exact added, removed, and changed WorkUnit IDs;
- a human-readable reason;
- `approvingAuthority` and immutable authority-artifact reference/hash; and
- the prior and new manifest hashes.

The command is rejected if totals do not reconcile, IDs collide, the version is
not consecutive, or authority evidence is absent. UI history always shows the
numerator and denominator associated with each manifest version; it never
recalculates historical percentages against a newer denominator.

The exact schema, event envelope, entity state machines, and rejection behavior
are canonical in
[`../contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md`](../contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md).

## 6. Logical Architecture

```text
Browser/PWA
  | same-origin HTTPS/loopback HTTP; POST commands + SSE reads
  v
HTTP Boundary -> Auth/CSRF/Rate Limit -> Command Service
                                          |
                                          v
                               Single-Writer Event Store
                                          |
                    +---------------------+---------------------+
                    v                                           v
        Deterministic Projectors                         Immutable Artifacts
                    |                                           |
                    v                                           v
            Query/SSE Service                     Advisor Gateway Outbox
                                                               |
                                         fixed Advisor-only delivery adapter

Read-only adapters: Mission Manifest, Git, Artifact, tmux metadata, Host status
```

### 6.1 Process and module boundaries

The candidate implementation is one TypeScript service and one browser bundle in
a single repository, with strict module boundaries:

- `src/domain/`: dependency-free schemas, state machines, invariants, and events;
- `src/application/`: commands, query services, projection orchestration, and
  policy ports;
- `src/persistence/file-store/`: single-writer append-only store, checkpoints,
  snapshots, and quarantine;
- `src/adapters/`: read-only Git/tmux/artifact/manifest/host adapters plus fixed
  Advisor gateway adapters;
- `src/server/`: HTTP, SSE, auth, CSRF, rate limiting, headers, and audit wiring;
- `src/ui/`: responsive React UI, scene mapping, and accessible components; and
- `src/pwa/`: manifest, service worker, cache policy, and update behavior.

The implemented Batch A-C local surface is strict TypeScript on Node.js 24 or
later. React 19.2.7, React DOM 19.2.7, Lucide React 1.24.0, Vite 8.1.4,
Playwright 1.61.1, and the axe Playwright adapter 4.12.1 are exact-pinned for the
static local UI and deterministic verification. HTTP/server, auth, SSE, and PWA
dependencies remain unselected and deferred to exact later-batch handoffs.

### 6.2 Single-writer rule

Exactly one process owns the event append lock for a state root. HTTP handlers,
collectors, and gateways submit typed commands to that writer; none writes JSONL
directly. A second writer fails startup. Network/shared filesystem operation is
unsupported in M01. This avoids cross-process partial ordering without a DB.

### 6.3 State-root layout

Runtime state is outside the Git worktree under a configured absolute local state
root (Linux default design: the user's XDG state directory):

```text
state-root/
  locks/writer.lock
  manifests/<missionId>/v<version>/manifest.json
  streams/<missionId>/events-<segment>.jsonl
  artifacts/inbox/<missionId>/<requestId>/<sha256>.json
  artifacts/decisions/<missionId>/<decisionId>/<sha256>.json
  artifacts/evidence/<missionId>/<artifactId>/<sha256>.<ext>
  projections/<missionId>/snapshot.json
  indexes/idempotency.json
  checkpoints/<missionId>.json
  quarantine/
  audit/security-<segment>.jsonl
  backups/
```

The ledger and immutable artifacts are authoritative. Snapshots, checkpoints,
and indexes are rebuildable. The state root must not be served as static content.
Its exact crash-consistency protocol is in the operations design.

## 7. Command, Event, Projection, and Evidence Flow

1. A typed command enters through an authenticated application port.
2. Boundary validation rejects unknown fields, oversized values, invalid IDs,
   disallowed paths, or unsupported command kinds.
3. The command service verifies `requestId`, payload hash, expected stream
   version, current manifest version, actor authority, dependencies, and state
   transition.
4. A repeated `requestId` with the same canonical payload hash returns the prior
   receipt. The same ID with a different hash returns a conflict and appends only
   a redacted security/audit rejection.
5. Accepted immutable artifacts are written with create-exclusive semantics and
   fsynced before their referencing event.
6. The writer appends one canonical event plus newline, flushes it durably, and
   only then returns an acknowledgement.
7. Projectors consume mission sequence order and atomically publish a new
   projection revision.
8. SSE announces the revision. The browser reads the projection and verifies the
   visible freshness/evidence labels; it never mutates its own canonical state.

Completion is evidence-backed, never animation-backed or prose-backed. A Worker
result can produce `RESULT_REPORTED`; `COMPLETED` requires the manifest's explicit
completion policy, immutable evidence references, hash/commit verification, and
the required Advisor/review decision event. Missing or stale evidence produces a
blocker or alert and prevents completion.

## 8. Browser and Real-Time Product Surface

### 8.1 PWA

The browser bundle is an installable private PWA with a web manifest, local icons,
service worker, responsive shell, update prompt, and offline read-only view. The
service worker caches only versioned static application assets. It never caches
API responses, message bodies, auth responses, SSE content, artifacts, or secrets.
Offline state is visibly stale and cannot submit or queue writes.

### 8.2 SSE decision

M01 selects Server-Sent Events, not WebSocket:

- live state is server-to-browser only;
- browser writes are explicit same-origin HTTP POSTs with CSRF and idempotency;
- SSE has a smaller bidirectional attack surface and native reconnect semantics;
- `Last-Event-ID` maps cleanly to projection revisions; and
- a generic bidirectional socket could be mistaken for a dispatch/terminal path.

SSE carries projection notifications, alert changes, heartbeat, and
`reset_required`; it does not carry commands. A bounded replay window serves a
valid cursor. An expired/unknown cursor receives `reset_required` and must fetch a
full verified snapshot. Heartbeats do not change domain state.

WebSocket remains an unimplemented extension point requiring a proven use case,
security review, and an explicit later design change.

### 8.3 Responsive information architecture

Desktop uses a persistent hierarchy rail, stable office scene, mission/work-unit
workspace, and evidence/Advisor inbox drawer. Mobile uses a compact app bar,
bounded scene, tabbed detail/inbox/alerts, and bottom navigation. Exact animation,
overflow, asset, reduced-motion, and accessibility behavior is canonical in the
UI mapping document.

The Batch C as-built scene occupies the full-width first-screen workspace before
the Batch B dashboard grid. It uses eight stable stations, two-station mobile
pagination, local code-native SVG assets, and a deterministic fixture selector;
it remains static on initial navigation/reload/tab resume and has no live adapter
or mutation authority.

## 9. Adapter and Gateway Boundaries

- MissionManifestAdapter imports exact committed, hashed mission manifests and
  scope records; it never edits foundation-docs.
- GitObservationAdapter runs a reviewed read-only argument allowlist with fixed
  repository roots; it cannot accept raw command strings.
- ArtifactAdapter reads/writes only typed immutable artifacts beneath allowlisted
  roots and rejects traversal/symlink escapes.
- TmuxObservationAdapter reads structured tmux metadata only. Terminal text is
  untrusted diagnostic material and cannot produce domain transitions.
- TmuxAdvisorGateway is the current fixed logical gateway for delivering an
  immutable message pointer to Advisor only. It has no target parameter and no
  raw-command method. Its transport side must obey the existing active authority,
  kill switch, registry, and manual fallback.
- HermesAdvisorGateway is an interface-compatible stub only. Constructing or
  enabling a Hermes implementation is outside M01.
- Notification ports are typed, idempotent, Advisor/Leo-facing, and never route
  Worker or Reviewer prompts.

The gateway and multi-host design defines exact interfaces and trust behavior.

## 10. Security Posture

Default bind is loopback only. M01 must fail closed on a non-loopback bind unless
an explicit private-network gate and secure auth configuration are present.
Authentication is provider-based; no credential or signing key is committed or
embedded. Same-origin enforcement, session cookies, CSRF, CSP, rate limits,
request size limits, output escaping, audit records, and fixed adapter allowlists
are mandatory. Browser input becomes an immutable request to Advisor, never
canonical authority on submission.

Tailscale/private-network access is a separately gated design. Public exposure is
not an extension point inside M01; it requires a new mission and threat model.

See the security authority model for detailed controls and failure semantics.

## 11. Batch A-E Release Plan

All batches are sequential because the mission manifest declares dependencies.
Each needs a new exact Advisor handoff. A factual batch check is not independent
review and does not authorize the next batch.

| Gate/Batch | Scope | Entry gate | Required acceptance evidence | Exit/routing gate |
|---|---|---|---|---|
| Design gate | These seven candidate documents | Bootstrap validated | Exact seven-file commit, critical traceability, no runtime diff | Fable5 Level 3 `DESIGN_REVIEW: PASS`; `NEEDS_PATCH` returns to same Worker/reviewer, `PASS_WITH_RISK` to Leo/GPT, `FAIL` stops |
| A | Domain schemas, manifest import, state machines, event store, projections | Design PASS plus exact Batch A handoff | Schema/transition/property/replay/crash-tail tests; 15-unit manifest projection; no DB | Advisor validates evidence before Batch B handoff |
| B | Read-only manifest/Git/artifact/tmux adapters and base dashboard | Batch A evidence accepted | Allowlist/path-escape tests, no-write tmux/Git tests, deterministic dashboard projection, stale indicators | Advisor validates evidence before Batch C handoff |
| C | Structured-event office scene and responsive mapping | Batch B evidence accepted | Every required activity mapping, no prose inference, reduced-motion, accessibility, stable-layout visual tests | Advisor validates evidence before Batch D handoff |
| D | Advisor Inbox, alerts, deterministic GPT package, gateway outbox, acknowledgement and resume proof | Batch C evidence accepted | Same-ID replay, ID/hash conflict, crash-before-ack retry, fixed Advisor target, kill-switch/manual fallback, no Worker/Reviewer route | Advisor validates evidence before Batch E handoff |
| E | PWA, auth/CSRF/rate limits/security headers, recovery/backup/rollback, end-to-end tests | Batch D evidence accepted plus any secret/private-run gate | Install/offline/update tests, auth/CSRF/rate tests, corruption/rebuild/restore tests, desktop/mobile E2E | Worker result package -> Fable5 `IMPLEMENTATION_REVIEW` |

After all batches, AO-WU-12 publishes evidence. Fable5 independently reviews the
actual implementation in AO-WU-13. Advisor privately verifies only after the
required review result. Leo/GPT alone closes the mission or chooses another one.

### 11.1 Batch exclusions

Every batch excludes DBs, public access, production/live deployment, Hermes
implementation, arbitrary command execution, direct role dispatch, protected
branches, force push, self-review, and automatic next-work progression. Batch E
may implement a credential provider contract and test doubles without accessing
or embedding a real credential; activating a real private-network credential is a
separate gate.

### 11.2 Batch A as-built evidence

- Code/config/tests: `7edc8f79bedb059ab6697e64ddaf57fbebde2c87`.
- Domain: `src/domain/`, `src/contracts/`, and
  `fixtures/manifests/agent-office-m01.v1*.json`.
- Persistence/recovery: `src/persistence/file-store/` and
  `src/application/startup/recovery.ts`.
- Projection/evidence: `src/application/projections/` and
  `src/application/evidence/`.
- Verification: 15 required test files, 36 tests passing; lint, strict typecheck,
  production TypeScript build, and dependency audit all passing with zero known
  vulnerabilities.
- Exit state: `IMPLEMENTED__ADVISOR_ACCEPTED_AS_BATCH_B_DEPENDENCY`.

### 11.3 Batch B as-built evidence

- Code/config/tests/assets:
  `85e66d856e33a0df73041cb4b33aba30a8f9f96d`.
- Observation boundary: `src/adapters/observations/`, with no-shell direct Git
  operations, bounded no-follow reads, and `display-message`-only tmux metadata.
- Local registry/freshness/query projection: `src/application/projects/`,
  `src/application/hosts/`, and `src/application/queries/`.
- Base dashboard: `src/ui/`, `index.html`, and `vite.config.ts`; local preview is
  fixed to loopback and no server authority/PWA capability exists.
- Verification: 23 test files/84 tests; lint, strict typecheck, production core
  and dashboard builds, dependency audit, diff check, and bounded read-only local
  Git/tmux adapter smoke pass.
- Exit state: `IMPLEMENTED__ADVISOR_ACCEPTED_AS_BATCH_C_DEPENDENCY`.

### 11.4 Batch C as-built evidence

- Code/config/tests/assets:
  `e30a6cda52e14a4bf30b2d1b7445fa26645496e5`.
- Scene projection/runtime: `src/ui/scene/types.ts` and
  `src/ui/scene/state-machine.ts`; accepted event IDs, exact primary/activity
  mapping, safety precedence, deduplication, burst coalescing, reload/resume
  suppression, and bounded delivery/result/patch sequences are pure presentation
  logic.
- Scene/accessibility/assets: `src/ui/scene/office-scene.tsx`, local code-native
  assets and SHA-256 inventory under `src/ui/scene/assets/`, responsive rules in
  `src/ui/styles.css`, semantic status list, polite/assertive live regions,
  persisted non-sensitive motion preference, and visibility pause.
- Verification: 27 Vitest files/123 tests plus 10 Playwright Chromium tests;
  1440x900, 390x844, reduced-motion baselines; tablet/320px/landscape/200% text,
  bounding/no-overlap, keyboard/touch, WCAG A/AA axe audits, lint, strict
  typecheck, production builds, dependency audit, and boundary/diff checks pass.
- Exit state: `IMPLEMENTED__PENDING_ADVISOR_BATCH_C_ACCEPTANCE`; Batch D is not
  started.

## 12. Unknowns, Limitations, and Deferred Extensions

| Item | Candidate decision | Current status | Gate |
|---|---|---|---|
| Application stack versions | Strict TypeScript/Node core plus exact pinned React 19.2.7, React DOM 19.2.7, Lucide React 1.24.0, Vite 8.1.4, Playwright 1.61.1, and axe Playwright 4.12.1 for the local static dashboard/scene and tests; server/PWA stack remains unselected | `IMPLEMENTED_THROUGH_BATCH_C_LOCAL_UI` | Batch C Advisor acceptance; server/PWA only under later handoff |
| Persistence | Local append-only JSONL, immutable artifacts, atomic projections; no DB | `IMPLEMENTED_BATCH_A__ADVISOR_ACCEPTED` | Backup/restore remains Batch E |
| Real-time | SSE plus POST, no WebSocket | `NOT_IMPLEMENTED` | Fable5 design PASS, Batch E |
| Loopback authentication | Provider contract, ephemeral/local secure provisioning, no embedded credential | `NOT_IMPLEMENTED` | Batch E and explicit secret-handling authority if a real credential is used |
| Tailscale/private network | Designed disabled; identity/TLS/trust requirements reserved | `DEFERRED_WITH_GATE` | Leo/GPT private-network approval and threat review |
| Remote Linux collectors | Signed structured observation interface only | `DEFERRED_WITH_GATE` | Multi-host implementation mission and key-provisioning approval |
| Future Mac hosts | Same observation contract with platform adapter | `DEFERRED_WITH_GATE` | Mac implementation/test host approval |
| Hermes gateway | Interface/stub only | `DEFERRED_WITH_GATE` | Separate Leo/GPT Hermes mission |
| Database/multi-user service | No design selection beyond replaceable ports | `OUT_OF_SCOPE` | New mission, data/security/operations design |
| Public exposure | Explicitly unsupported | `OUT_OF_SCOPE` | New Leo/GPT mission; not a deployment toggle |

## 13. Canonical Document Map

- Domain/event truth:
  [`../contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md`](../contracts/AGENT_OFFICE_DOMAIN_EVENT_CONTRACT.md)
- Security/authority:
  [`../security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md`](../security/AGENT_OFFICE_SECURITY_AUTHORITY_MODEL.md)
- Gateways/multi-host:
  [`../integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md`](../integration/AGENT_OFFICE_GATEWAY_MULTI_HOST_DESIGN.md)
- UI/animation:
  [`../ui/AGENT_OFFICE_UI_ANIMATION_MAPPING.md`](../ui/AGENT_OFFICE_UI_ANIMATION_MAPPING.md)
- Operations/recovery:
  [`../operations/AGENT_OFFICE_OPERATIONS_RECOVERY.md`](../operations/AGENT_OFFICE_OPERATIONS_RECOVERY.md)
- Complete requirement traceability:
  [`../FEATURE_INDEX.md`](../FEATURE_INDEX.md)

## 14. Local Traceability

| DESIGN_REQUIREMENT | IMPLEMENTATION_PATH | TEST_PATH | CURRENT_EVIDENCE | STATUS | DEFERRED_GATE |
|---|---|---|---|---|---|
| AO-ARCH-001 Hierarchy and versioned denominator | `src/domain/manifest/index.ts`, `src/application/queries/dashboard-view-model.ts` | `tests/domain/manifest.test.ts`, `tests/property/scope-counting.test.ts`, `tests/ui/dashboard-view-model.test.ts` | Batch A exact 15-unit fixture/hash remains accepted; Batch B declared scope/future-work rendering was accepted as the Batch C dependency | `IMPLEMENTED_THROUGH_BATCH_B__ADVISOR_ACCEPTED` | Any scope change still requires exact authority |
| AO-ARCH-002 Append-only store and deterministic projection | `src/persistence/file-store/`, `src/application/projections/mission-projector.ts` | `tests/persistence/replay.test.ts`, `tests/recovery/crash-consistency.test.ts`, `tests/recovery/restart-replay.test.ts`, `tests/recovery/corruption-quarantine.test.ts` | Code commit `7edc8f79bedb059ab6697e64ddaf57fbebde2c87`; replay/crash/restart/quarantine tests pass and Advisor accepted Batch A | `IMPLEMENTED_BATCH_A__ADVISOR_ACCEPTED` | Backup/restore remains Batch E |
| AO-ARCH-003 Private responsive PWA over POST plus SSE | `src/ui/`; future `src/server/`, `src/pwa/` | `tests/ui/dashboard.component.test.tsx`, `tests/ui/layout-contract.test.ts`, `tests/e2e/office-scene.spec.ts`; future SSE/PWA tests | Responsive read-only dashboard and structured-event office scene implemented through Batch C; HTTP authority, SSE, auth, and PWA remain `NOT_IMPLEMENTED` | `IMPLEMENTED_BATCH_C_UI_SUBSET__PENDING_ADVISOR_ACCEPTANCE` | Batch C acceptance; server/SSE/PWA remain Batch E |
| AO-ARCH-004 Fixed Advisor gateway and read-only adapters | `src/adapters/observations/`; future `src/adapters/gateways/` | `tests/adapters/git-readonly.test.ts`, `tests/adapters/artifact-manifest.test.ts`, `tests/adapters/tmux-readonly.test.ts` | Read-only observation subset was Advisor-accepted after Batch B; Advisor/Hermes gateways remain `NOT_IMPLEMENTED` | `IMPLEMENTED_BATCH_B_OBSERVATION_SUBSET__ADVISOR_ACCEPTED` | Advisor gateway Batch D; Hermes separately gated |
| AO-ARCH-005 Sequential Batch A-E review train | `package.json`, `tests/acceptance/batch-gates.test.ts`, future batch result artifacts | `tests/acceptance/batch-gates.test.ts` | Batch A/B dependencies accepted; Batch A/B regression plus Batch D/E forbidden-scope guards pass in the 123-test Batch C Vitest suite and 10-test browser suite | `IMPLEMENTED_THROUGH_BATCH_C__PENDING_ADVISOR_ACCEPTANCE` | Advisor must accept Batch C before any Batch D handoff |

The exhaustive material-requirement matrix is in `docs/FEATURE_INDEX.md`; local
rows above are architecture anchors, not a substitute for that index.
