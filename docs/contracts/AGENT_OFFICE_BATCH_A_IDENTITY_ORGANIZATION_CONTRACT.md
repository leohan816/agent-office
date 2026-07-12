# Agent Office Batch A — Identity and Organization Contract

Status: `CONTROL_MASTER_DESIGN_CONTRACT__REWORKED_CD_4_5_6_7_AND_SENTINEL_P1_P2_P3_R1_R2_R3__PENDING_INDEPENDENT_SENTINEL_DELTA_REREVIEW`

Mode: `CONTROL_MASTER_DESIGN_MODE`. Companion to `AGENT_OFFICE_BATCH_A_APPLICATION_INTEGRATION_DESIGN_DELTA.md`. Independent reviewer: the authorized **independent Sentinel** (`foundation-reviewer-sol`, currently GPT-5.6 SOL xhigh); Fable5 is a possible secondary/fallback runtime only.

Base: `ac8ba75d3a128385beaeeac58ae5bf54c03d23f2`. Local/static organization/identity rules for Batch A only; no live discovery, no runtime, no authority change. Reworked per Advisor validation `15_ADVISOR_CONTROL_DESIGN_VALIDATION.md` (CD-4/5/6/7) and Sentinel design review `SENTINEL_DESIGN_REVIEW_RESULT.md` findings P1/P2/P3. Vocabularies below are the **exact inherited source vocabularies** (cited), not new invention.

## 1. Stable identity vs current bindings (CD-6, Founder item 6)

- **Stable identity key**: `roleInstanceId` (durable actor/role-instance key; never re-keyed/cloned/merged by any binding change). A row without a valid `roleInstanceId` is invalid, not rendered, and reported — it does not become `UNKNOWN`.
- **Identity attributes** (change only by reviewed identity change): `role`, `project`, `stableDisplayName`.
- **Current bindings / separately-sourced facts** (may change under explicit authority without re-keying): `sessionName`, `advisorTeam`, `reportsToAdvisor`, `assignedBy`, `returnsResultTo`, `mission`, `workUnit`, and all AI-runtime facts of §2.3 and the operational state of §2.4.
- A session is a current operational binding, not identity; `sessionName` may be replaced without changing `roleInstanceId`. One character renders per active `roleInstanceId`; an active instance is never cloned.

## 2. Actor field contract (P1, P2, P3, R1, R2, R3, CD-4, CD-5)

Every field is a **fact envelope** (§2.5). The compact summary renders a subset (§2.7); the drawer renders the complete ordered set (§2.7). Two committed data layers feed **one** projection (§2.5/§3): a **committed identity/organization registry** (stable, immutable per reviewed commit) and **committed accepted-structured-evidence records** (the Batch A local/static stand-in for live observation — Batch A performs no live discovery; these are provenance-tagged committed fixture/artifact records, never runtime-inferred). The live `RuntimeActorObservation` has no process/ready/model/effort field (`src/runtime/observation-coordinator.ts:39-50`), so those facts are derived only from committed accepted-evidence records.

### 2.1 Identity attributes (committed identity/organization registry; immutable per reviewed commit)
| Field | Type | Non-failure values | Fail-closed sentinel (missing/blank/malformed/unverified) |
|---|---|---|---|
| `roleInstanceId` | string key | any valid stable key | row invalid → dropped + reported (never a sentinel) |
| `role` | enum | `ADVISOR`\|`WORKER`\|`REVIEWER`\|`CONTROL`\|`DESIGNER` | literal `UNKNOWN` |
| `project` | enum | approved project family id | literal `UNKNOWN` |
| `stableDisplayName` | string | stable display name | literal `UNKNOWN` |

### 2.2 Organizational bindings (committed identity/organization registry) + allowed-token metadata
| Field | Non-failure values | Fail-closed sentinel |
|---|---|---|
| `sessionName` | exact verified registry session name (no alias) | literal `UNKNOWN` |
| `advisorTeam` | `FOUNDATION_ADVISOR_TEAM`\|`VIBENEWS_ADVISOR_TEAM` | `UNASSIGNED` |
| `reportsToAdvisor` | responsible Advisor id | literal `UNKNOWN` |
| `assignedBy` | assigning actor id | literal `UNKNOWN` |
| `returnsResultTo` | return target (Advisor) | literal `UNKNOWN` |

The registry also stores **allowed-token metadata** (immutable per reviewed commit): `allowedAiIdentities`, `allowedModels`, `allowedEfforts`. These are the closed value sets against which §2.3 projection-time facts are validated; they are metadata, not live values.

### 2.3 Projection-time process & AI-runtime facts — one sentinel each, each tied to an exact named accepted structured evidence kind (P1, R1). These are **not** stored in the registry; they are computed at projection time from committed accepted-evidence records (§2.5), because `RuntimeActorObservation`/`AuthenticatedSpatialActorObservationInput` carry no such field.
| Field | Closed vocabulary | Fail-closed sentinel | Exact accepted evidence for each non-sentinel value |
|---|---|---|---|
| `sessionProcess` | `SESSION_PROCESS_UNKNOWN` \| `SESSION_OFFLINE` \| `NO_AI_PROCESS` \| `AI_PROCESS_DETECTED` | `SESSION_PROCESS_UNKNOWN` | each of `SESSION_OFFLINE`/`NO_AI_PROCESS`/`AI_PROCESS_DETECTED` requires a committed accepted structured process-fact of that **exact kind** (`process_offline`/`process_absent`/`process_detected`); missing/malformed/unverified/no-evidence → `SESSION_PROCESS_UNKNOWN` (a missing observation never asserts offline or no-process) |
| `aiIdentity` | `AI_IDENTITY_UNKNOWN` \| a value in `allowedAiIdentities` | `AI_IDENTITY_UNKNOWN` | an accepted `ai_identity_attestation` fact whose value ∈ `allowedAiIdentities`; never inferred from names |
| `model` | `MODEL_UNKNOWN` \| a value in `allowedModels` | `MODEL_UNKNOWN` | an accepted `model_attestation` fact whose value ∈ `allowedModels` (mission-proven) |
| `effort` | `EFFORT_UNKNOWN` \| a value in `allowedEfforts` | `EFFORT_UNKNOWN` | an accepted `effort_attestation` fact whose value ∈ `allowedEfforts` (mission-proven); not a work state |
| `aiRuntimeState` | `AI_RUNTIME_UNKNOWN` \| `AI_READY` \| `AI_WORKING` \| `AI_WAITING` \| `AI_ERROR` | `AI_RUNTIME_UNKNOWN` | see rules below |
| `mission` | `AI_RUNTIME_UNKNOWN`-independent id from accepted work evidence | literal `UNKNOWN` | current mission id from an accepted work-context fact |
| `workUnit` | current WorkUnit id from accepted work evidence | literal `UNKNOWN` | current WorkUnit id from an accepted work-context fact |

`aiRuntimeState` evidence rules (fail-closed; each requires a **named accepted structured fact/cue** — attached metadata, timestamps, names, positions, proximity, and terminal prose are **never** proof):
- `AI_READY`: `sessionProcess = AI_PROCESS_DETECTED` **and** an accepted `ai_ready` structured fact (a defined accepted fact kind, not attached-metadata inference) **and** no accepted work/wait/error fact.
- `AI_WORKING`: an accepted structured activity/cue that the §2.4 projector resolves to an active-work observable (`DISPATCHING`\|`READING`\|`WORKING`\|`TESTING`\|`WRITING_RESULT`\|`RETURNING_RESULT`\|`REVIEWING`).
- `AI_WAITING`: an accepted structured cue resolving to `WAITING_DEPENDENCY`\|`WAITING_LEO`.
- `AI_ERROR`: an accepted structured cue resolving to `FAILED`, or a defined accepted `ai_error` fact.
- If `sessionProcess ∈ {SESSION_PROCESS_UNKNOWN, SESSION_OFFLINE, NO_AI_PROCESS}`, or evidence is missing/expired/conflicting → `AI_RUNTIME_UNKNOWN`.

★`aiRuntimeState` is not the operational work state (§2.4). The literal `UNKNOWN` (`PIXEL_ACTOR_UNKNOWN`) is used **only** for the free-text fields in §2.1/§2.2 and `mission`/`workUnit`; every enum field uses exactly its own sentinel.

### 2.4 Operational work state — owned display vocabulary as a total function of the current projector output (P2, R2)
- **Owned display vocabulary** = `PixelOperationalState` (`src/ui/pixel/contracts.ts:24-38`), exactly 14 values: `UNKNOWN`, `IDLE`, `WORKING`, `TESTING`, `ROUTING / DISPATCH`, `REVIEWING`, `RETURNING_RESULT`, `NEEDS_PATCH`, `WAITING_DEPENDENCY`, `WAITING_LEO`, `BLOCKED`, `COMPLETED`, `FAILED`, `CANCELLED`.
- **Source** = the existing projector `projectRequiredObservable(primaryState, acceptedActivity, evaluatedAt).requiredObservableName` (`src/domain/activity/index.ts:115-151`). The display is a **total function of that projector output**, never of the raw `WorkUnitState`. The projector already refuses to elevate: with no compatible accepted activity it returns `UNKNOWN_OR_STALE` for `DISPATCHED`/`RUNNING`/`RESULT_REPORTED`/`REVIEW_PENDING`/`WAITING_ADVISOR`/`HOLD` (`:199-205`); it emits task-signifying `DISPATCHING`/`READING`/`WORKING`/`TESTING`/`WRITING_RESULT`/`RETURNING_RESULT`/`REVIEWING` only through a compatible accepted activity (`:58-113,153-181`); `RECOVERY` → `UNKNOWN_OR_STALE` (`:180`). Batch A adds no new activity acceptance.
- **Total map** `ObservableProjectionName → PixelOperationalState` (exhaustive over the 16 `REQUIRED_OBSERVABLE_NAMES` + `UNKNOWN_OR_STALE`; any other/expired/conflicting → `UNKNOWN`):

| `ObservableProjectionName` | Displayed `PixelOperationalState` |
|---|---|
| `QUEUED` | `IDLE` |
| `READY` | `IDLE` |
| `DISPATCHING` | `ROUTING / DISPATCH` |
| `READING` | `WORKING` |
| `WORKING` | `WORKING` |
| `TESTING` | `TESTING` |
| `WRITING_RESULT` | `WORKING` |
| `RETURNING_RESULT` | `RETURNING_RESULT` |
| `REVIEWING` | `REVIEWING` |
| `NEEDS_PATCH` | `NEEDS_PATCH` |
| `WAITING_DEPENDENCY` | `WAITING_DEPENDENCY` |
| `WAITING_LEO` | `WAITING_LEO` |
| `BLOCKED` | `BLOCKED` |
| `COMPLETED` | `COMPLETED` |
| `FAILED` | `FAILED` |
| `CANCELLED` | `CANCELLED` |
| `UNKNOWN_OR_STALE` | `UNKNOWN` |
| (any other value) | `UNKNOWN` |

★Because the source is the projector output (not the raw state), a bare `RUNNING`/`HOLD`/`WAITING_ADVISOR` without a compatible accepted activity displays `UNKNOWN`, never `WORKING`/`BLOCKED` — the UI never asserts operational meaning the projector withholds. `READING`/`WRITING_RESULT` map to `WORKING` (both are evidence-backed active work; neither elevates to a completion/return claim).

### 2.5 Fact envelope, provenance, ownership, and the exact join (P3, R3)
- **Fact envelope** (per field): `{ value, source, status, evidenceTimestamp }`.
  - `source` = the exact inherited discriminators (`src/ui/pixel/contracts.ts:6-11`): `VERIFIED_REGISTRY` | `VERIFIED_MISSION_ARTIFACT` | `CANONICAL_FIXTURE` | `SYNTHETIC_FIXTURE` | `UNVERIFIED` (UPPER_SNAKE).
  - `status`: `VERIFIED` | `UNVERIFIED` | `STALE` | `INVALID` | `MISSING`.
  - `evidenceTimestamp`: ISO-8601 or `null`; recorded evidence only — **no time-only freshness inference**.
- **Two committed inputs, one projected output — exact ownership**:
  - **(A) Committed identity/organization registry** (immutable per reviewed commit) owns the **stable** facts: §2.1 identity attributes, §2.2 organizational bindings, and the allowed-token metadata (`allowedAiIdentities`/`allowedModels`/`allowedEfforts`). It stores **no** changing process/runtime/work fact.
  - **(B) Committed accepted-structured-evidence records** (provenance-tagged; the Batch A local/static stand-in for live observation) are the inputs from which the **changing** facts are computed: §2.3 (`sessionProcess`, `aiIdentity`, `model`, `effort`, `aiRuntimeState`, `mission`, `workUnit`) and §2.4 (`operationalState`).
- **Projection-time owner of changing facts**: the projector, not the registry. Each changing fact is computed per projection from (B), validated against (A)'s allowed-token metadata and its §2.3/§2.4 rules; invalid/missing/conflicting → the field's fail-closed sentinel. A changing fact is **never written back into (A)**.
- **Exact flow**: `load (A) and (B) → compute changing facts from (B) validated vs (A) → FULL OUTER JOIN (union) on roleInstanceId between (A)'s rows and the computed changing-fact rows → project one final frame (no second store)`.
- **Join is a full outer join (union) on `roleInstanceId`** (not registry-left):
  - **both present**: identity/org from (A); changing facts from the projector.
  - **registry-only** (`roleInstanceId` in (A), no evidence): identity/org from (A); every changing fact = its §2.3/§2.4 sentinel (`SESSION_PROCESS_UNKNOWN`/`AI_IDENTITY_UNKNOWN`/`MODEL_UNKNOWN`/`EFFORT_UNKNOWN`/`AI_RUNTIME_UNKNOWN`/`UNKNOWN`).
  - **evidence-only** (`roleInstanceId` in (B), no registry row): changing facts from the projector; all §2.1/§2.2 identity/org fields = literal `UNKNOWN` and `advisorTeam` = `UNASSIGNED` (cannot receive work); the actor is rendered but marked unassigned/unknown-identity.
- **Merge precedence / separation**: each field has exactly one owner (stable→(A); changing→projector). Conflicting non-sentinel values for the same owned field → that field's sentinel + a reported diagnostic (never a silent lower-precedence pick). This removes any reversed "registry derived from runtime" direction: (A) and (B) are inputs mint-first, joined into one projected frame.

### 2.6 Fail-closed normalization (inherited, must not weaken)
- Free-text identity/binding fields → literal `UNKNOWN` (`PIXEL_ACTOR_UNKNOWN`) on any null/undefined/non-object/blank-after-trim/`UNVERIFIED`-source value.
- Each enum field → its own §2.3/§2.4 sentinel (never literal `UNKNOWN`).
- Invalid/unresolvable assignment → `UNASSIGNED`.
- `AI_WORKING` and `operationalState = WORKING`/`TESTING`/etc. require accepted structured work evidence; no field is derived from names, positions, timestamps, attached state, proximity, or terminal prose.

### 2.7 Compact summary subset and complete drawer field order (P3)
- **Compact summary (first layer)**, in order: `role` (glyph+ring) · `stableDisplayName` · `sessionProcess` · `aiIdentity` · `model` · `effort` · `aiRuntimeState` · `operationalState`, each with its `source` tag; text+glyph+ring, never color alone.
- **Detail drawer (second layer)**, complete ordered set: `roleInstanceId` · `role` · `project` · `stableDisplayName` · `advisorTeam` · `reportsToAdvisor` · `assignedBy` · `returnsResultTo` · `sessionName` · `sessionProcess` · `aiIdentity` · `model` · `effort` · `aiRuntimeState` · `operationalState` · `mission` · `workUnit` — each rendering `value` + `source` (`data-actor-fact-source`) + `status`; `role="dialog"`, Escape, Tab containment, close-button focus on open, invoker focus restore; semantic/static parity.
- **Drawer test matrix**: one row per field × {non-failure value, fail-closed sentinel, provenance rendered, status rendered}; plus focus/keyboard cases; plus the §2.4 total-mapping cases; plus the §2.3 evidence-rule cases.

## 3. Local/static organization registry (CD-7, P3, Founder item 7)

Batch A holds **two committed local/static inputs** under a new exact module `src/application/organization/` (no live tmux/process/model discovery), consumed by one projector into one final frame (§2.5):

- **(A) identity/organization registry** — stable identity attributes (§2.1), organizational bindings (§2.2), and allowed-token metadata; immutable per reviewed commit; stores **no** changing process/runtime/work fact.
- **(B) accepted-structured-evidence records** — the committed, provenance-tagged inputs from which the changing §2.3/§2.4 facts are computed at projection time.
- **Mint order (not reversed)**: (A) and (B) are inputs; the projector computes changing facts from (B) validated against (A), then a **full outer join (union) on `roleInstanceId`** yields one frame. There is no "registry derived from runtime"; there is one projected frame and no second store.
- **Envelope on every field** (per-field `{ value, source, status, evidenceTimestamp }`, not one row-level stamp); unverified → the field's fail-closed sentinel; an actor not resolvable to exactly one responsible Advisor Team → `UNASSIGNED` and cannot receive work; changing facts are never written back into (A).
- **Change control**: both inputs change only by a normal reviewed commit (no runtime mutation, no live edit path, no automatic refresh, no time-only freshness inference).

## 4. Organization model (Founder items 6, 9)

- Every active actor belongs to **exactly one responsible Advisor Team** or is `UNASSIGNED`.
- `FOUNDATION_ADVISOR_TEAM`: Foundation Advisor, Control, Foundation Worker, Cosmile Worker, SIASIU Worker, Agent Office Worker, and the assigned independent Reviewer.
- `VIBENEWS_ADVISOR_TEAM`: exists only with a valid responsible Advisor plus its assigned Worker, Designer, and Reviewer.
- **Proximity never creates authority.** Position/Pod/selection grants no authority, assignment, model, or state.
- One character per active `Advisor roleInstanceId`; a future reviewed multi-Advisor configuration (Batch B–E) renders one distinct character per instance and never clones an active instance.
- Project identity uses the approved palette families plus text/glyph/pattern cues — never color alone. Official current project name is `SIASIU`.

## 5. Role-specific symbolic work-surface contract (Founder item 9)

- Facility/work surfaces are **symbolic only**; they MUST NOT render terminal output, source code, file paths, raw locators, credentials, secrets, or any private/raw operational content, and carry no authority or live state.

## 6. Channy non-operational boundary (Founder item 10)

- Channy is `CHANNY_ENABLED__NON_OPERATIONAL_AMBIENT_COMPANION_AND_STRUCTURED_STATUS_REFLECTOR` with `authorityRole: none`, rendering the existing slow eased eight-state Bedlington sequence. It performs no operation, holds no authority, and never infers or mutates state.

## 7. Preserved contracts (must not change in Batch A)

M1 authentication/session, exact Advisor delivery, communication, transport/tmux and Hermes-disabled boundary, PWA (same-origin hashed chunks + atomic cache-version bump only), security/authority model, and the M1 fixed-station static fallback remain contract unchanged. Batch A adds an additive projection and presentation only.

## 8. Contract test obligations (for the Worker pass, not implemented here)

- `roleInstanceId` identity persists across any binding change (no re-key/clone/merge); `sessionName` replacement does not re-key; a row without a valid `roleInstanceId` is dropped + reported;
- each field normalizes to exactly its §2.1–§2.4 sentinel (incl. `SESSION_PROCESS_UNKNOWN` for missing/unverified process evidence — never `SESSION_OFFLINE`/`NO_AI_PROCESS`); literal `UNKNOWN` only for free-text identity fields and `mission`/`workUnit`;
- the §2.4 display is the total map of `projectRequiredObservable(...).requiredObservableName` (not raw `WorkUnitState`); a bare `RUNNING`/`HOLD`/`WAITING_ADVISOR` without a compatible accepted activity displays `UNKNOWN`, never `WORKING`/`BLOCKED`; every `ObservableProjectionName` (16 + `UNKNOWN_OR_STALE`) has an exact row; every `ROLE_ACTIVITY` routes through `isActivityCompatible`/`deriveObservable`;
- each §2.3 non-sentinel value requires its exact named accepted structured fact/cue kind; `SESSION_OFFLINE`/`NO_AI_PROCESS`/`AI_PROCESS_DETECTED` each need their own accepted process-fact; `AI_READY` needs an accepted `ai_ready` fact (never attached-metadata); offline/no-process/unknown forces `AI_RUNTIME_UNKNOWN`;
- ownership: (A) committed identity/organization registry (stable + allowed-token metadata) vs (B) accepted-evidence records → projector computes changing facts → **full outer join (union) on `roleInstanceId`**; registry-only → changing sentinels; evidence-only → `UNKNOWN` identity + `UNASSIGNED`; changing facts never stored in (A); no time-only freshness inference; every field renders `value`+`source`(UPPER_SNAKE)+`status`;
- `UNASSIGNED` cannot receive work; symbolic surfaces contain no terminal/source/private content; one character per active `roleInstanceId`; no name/position/timestamp/proximity/prose inference.
