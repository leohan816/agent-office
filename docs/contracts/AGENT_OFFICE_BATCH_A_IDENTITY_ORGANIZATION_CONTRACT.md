# Agent Office Batch A — Identity and Organization Contract

Status: `CONTROL_MASTER_DESIGN_CONTRACT__REWORKED_CD_4_5_6_7_AND_SENTINEL_P1_P2_P3__PENDING_INDEPENDENT_SENTINEL_DELTA_REVIEW`

Mode: `CONTROL_MASTER_DESIGN_MODE`. Companion to `AGENT_OFFICE_BATCH_A_APPLICATION_INTEGRATION_DESIGN_DELTA.md`. Independent reviewer: the authorized **independent Sentinel** (`foundation-reviewer-sol`, currently GPT-5.6 SOL xhigh); Fable5 is a possible secondary/fallback runtime only.

Base: `ac8ba75d3a128385beaeeac58ae5bf54c03d23f2`. Local/static organization/identity rules for Batch A only; no live discovery, no runtime, no authority change. Reworked per Advisor validation `15_ADVISOR_CONTROL_DESIGN_VALIDATION.md` (CD-4/5/6/7) and Sentinel design review `SENTINEL_DESIGN_REVIEW_RESULT.md` findings P1/P2/P3. Vocabularies below are the **exact inherited source vocabularies** (cited), not new invention.

## 1. Stable identity vs current bindings (CD-6, Founder item 6)

- **Stable identity key**: `roleInstanceId` (durable actor/role-instance key; never re-keyed/cloned/merged by any binding change). A row without a valid `roleInstanceId` is invalid, not rendered, and reported — it does not become `UNKNOWN`.
- **Identity attributes** (change only by reviewed identity change): `role`, `project`, `stableDisplayName`.
- **Current bindings / separately-sourced facts** (may change under explicit authority without re-keying): `sessionName`, `advisorTeam`, `reportsToAdvisor`, `assignedBy`, `returnsResultTo`, `mission`, `workUnit`, and all AI-runtime facts of §2.3 and the operational state of §2.4.
- A session is a current operational binding, not identity; `sessionName` may be replaced without changing `roleInstanceId`. One character renders per active `roleInstanceId`; an active instance is never cloned.

## 2. Actor field contract (P1, P2, P3, CD-4, CD-5)

Every field is a **fact envelope** (§2.6). The compact summary renders a subset (§2.7); the drawer renders the complete ordered set (§2.7).

### 2.1 Identity attributes (owned by the committed static registry)
| Field | Type | Non-failure values | Fail-closed sentinel (missing/blank/malformed/unverified) |
|---|---|---|---|
| `roleInstanceId` | string key | any valid stable key | row invalid → dropped + reported (never a sentinel) |
| `role` | enum | `ADVISOR`\|`WORKER`\|`REVIEWER`\|`CONTROL`\|`DESIGNER` | literal `UNKNOWN` |
| `project` | enum | approved project family id | literal `UNKNOWN` |
| `stableDisplayName` | string | stable display name | literal `UNKNOWN` |

### 2.2 Current bindings
| Field | Owner | Non-failure values | Fail-closed sentinel |
|---|---|---|---|
| `sessionName` | registry | exact verified registry session name (no alias) | literal `UNKNOWN` |
| `advisorTeam` | registry | `FOUNDATION_ADVISOR_TEAM`\|`VIBENEWS_ADVISOR_TEAM` | `UNASSIGNED` |
| `reportsToAdvisor` | registry | responsible Advisor id | literal `UNKNOWN` |
| `assignedBy` | registry | assigning actor id | literal `UNKNOWN` |
| `returnsResultTo` | registry | return target (Advisor) | literal `UNKNOWN` |
| `mission` | runtime | current mission id (synthetic marked) | literal `UNKNOWN` |
| `workUnit` | runtime | current WorkUnit id (synthetic marked) | literal `UNKNOWN` |

### 2.3 AI-runtime facts — separate closed vocabularies, one sentinel each (P1; owned by the committed static registry because the runtime projection has no such fields — `authenticated-projection.ts:53-61`)
| Field | Closed vocabulary | Fail-closed sentinel | Accepted evidence for each non-sentinel value |
|---|---|---|---|
| `sessionProcess` | `SESSION_OFFLINE` \| `NO_AI_PROCESS` \| `AI_PROCESS_DETECTED` | `SESSION_OFFLINE` | `AI_PROCESS_DETECTED`/`NO_AI_PROCESS` require an accepted committed process-detection fact |
| `aiIdentity` | `AI_IDENTITY_UNKNOWN` \| a value in the committed registry's allowed-identity set | `AI_IDENTITY_UNKNOWN` | a `VERIFIED_MISSION_ARTIFACT`/`VERIFIED_REGISTRY` identity fact; never inferred from names |
| `model` | `MODEL_UNKNOWN` \| a mission-proven model token in the committed allowed-model set | `MODEL_UNKNOWN` | only a mission-proven model fact renders non-unknown |
| `effort` | `EFFORT_UNKNOWN` \| a mission-proven effort token in the committed allowed-effort set | `EFFORT_UNKNOWN` | only a mission-proven effort fact; not a work state |
| `aiRuntimeState` | `AI_RUNTIME_UNKNOWN` \| `AI_READY` \| `AI_WORKING` \| `AI_WAITING` \| `AI_ERROR` | `AI_RUNTIME_UNKNOWN` | see rules below |

`aiRuntimeState` evidence rules (fail-closed; each requires accepted structured evidence — attached state, timestamps, names, positions, proximity, and terminal prose prove none):
- `AI_READY`: `sessionProcess = AI_PROCESS_DETECTED` **and** a verified ready/attached signal **and** no active work/wait/error cue.
- `AI_WORKING`: an accepted structured work-start/in-progress cue.
- `AI_WAITING`: an accepted structured waiting/dependency cue.
- `AI_ERROR`: an accepted structured error/failure cue.
- If `sessionProcess ∈ {SESSION_OFFLINE, NO_AI_PROCESS}` then `aiRuntimeState = AI_RUNTIME_UNKNOWN` (no runtime state without a detected process).
- Any missing/blank/malformed/unverified/ambiguous case → `AI_RUNTIME_UNKNOWN`.

★`aiRuntimeState` is not the operational work state (§2.4) and never substitutes for it. `MODEL_UNKNOWN`/`EFFORT_UNKNOWN`/`AI_IDENTITY_UNKNOWN`/`SESSION_OFFLINE` are not work states. The literal `UNKNOWN` (`PIXEL_ACTOR_UNKNOWN`) is used **only** for the free-text identity/binding fields in §2.1/§2.2; every enum field uses exactly its own sentinel above.

### 2.4 Operational work state — exact owned display vocabulary + total mapping (P2)
- **Owned display vocabulary** = `PixelOperationalState` (`src/ui/pixel/contracts.ts:24-38`), exactly 14 values:
  `UNKNOWN`, `IDLE`, `WORKING`, `TESTING`, `ROUTING / DISPATCH`, `REVIEWING`, `RETURNING_RESULT`, `NEEDS_PATCH`, `WAITING_DEPENDENCY`, `WAITING_LEO`, `BLOCKED`, `COMPLETED`, `FAILED`, `CANCELLED`.
- **Source of truth** = the domain `WORK_UNIT_STATES` (16 values, `src/domain/state-machines/work-unit.ts:3-20`), refined by accepted activity/observable cues (`REQUIRED_OBSERVABLE_NAMES` + `UNKNOWN_OR_STALE`, `src/domain/activity/index.ts:21-41`). No `e.g.` list is used.
- **Total fail-closed mapping** `WorkUnitState → PixelOperationalState` (default and any non-member / stale / no-accepted-cue → `UNKNOWN`):

| WorkUnitState | Displayed `PixelOperationalState` |
|---|---|
| `QUEUED` | `IDLE` |
| `READY` | `IDLE` |
| `DISPATCHED` | `ROUTING / DISPATCH` |
| `RUNNING` | `WORKING` |
| `TESTING` | `TESTING` |
| `RESULT_REPORTED` | `RETURNING_RESULT` |
| `REVIEW_PENDING` | `REVIEWING` |
| `NEEDS_PATCH` | `NEEDS_PATCH` |
| `WAITING_DEPENDENCY` | `WAITING_DEPENDENCY` |
| `WAITING_ADVISOR` | `WAITING_DEPENDENCY` |
| `WAITING_LEO` | `WAITING_LEO` |
| `HOLD` | `BLOCKED` |
| `BLOCKED` | `BLOCKED` |
| `COMPLETED` | `COMPLETED` |
| `FAILED` | `FAILED` |
| `CANCELLED` | `CANCELLED` |
| (any other / stale / missing cue) | `UNKNOWN` |

- Accepted activity cues may only refine the live indicator **within** the mapped state's family (e.g. `WORKING`↔`TESTING`↔`REVIEWING`↔`RETURNING_RESULT` when the WorkUnit is `RUNNING`/`TESTING`/`REVIEW_PENDING`/`RESULT_REPORTED`); a cue never elevates progress beyond the WorkUnit state and any conflict → `UNKNOWN`. `WAITING_ADVISOR` and `HOLD` have no exact display member and map to the nearest non-progress state (`WAITING_DEPENDENCY`/`BLOCKED`); they never display as `WORKING`/`COMPLETED`.

### 2.5 Fact envelope, provenance, and registry mint/join/merge (P3)
- **Fact envelope** (per field): `{ value, source, status, evidenceTimestamp }`.
  - `source` uses the exact inherited discriminators (`src/ui/pixel/contracts.ts:6-11`): `VERIFIED_REGISTRY` | `VERIFIED_MISSION_ARTIFACT` | `CANONICAL_FIXTURE` | `SYNTHETIC_FIXTURE` | `UNVERIFIED` (UPPER_SNAKE; the earlier lower-camel spellings are replaced).
  - `status`: `VERIFIED` | `UNVERIFIED` | `STALE` | `INVALID` | `MISSING` (aligned to `authenticated-projection.ts:64` `manifestStatus`, minus `DIRTY`).
  - `evidenceTimestamp`: ISO-8601 string or `null`; it is recorded evidence only — **no time-only freshness inference** (an old timestamp never by itself downgrades a value; a recent one never by itself proves liveness).
- **Field ownership** (which layer mints each fact):
  - **Committed static registry** owns: all §2.1 identity attributes, §2.2 registry bindings (`sessionName`, `advisorTeam`, `reportsToAdvisor`, `assignedBy`, `returnsResultTo`), and all §2.3 AI-runtime facts (`sessionProcess`, `aiIdentity`, `model`, `effort`, `aiRuntimeState`) — because the runtime projection has none of these (`authenticated-projection.ts:53-61`).
  - **Runtime/work evidence** (joined, not stored) owns: `mission`, `workUnit`, and `operationalState` (§2.4), derived from the accepted `WorkUnitState`/activity/cue projection and joined on `roleInstanceId`.
- **Flow**: `mint (registry row per roleInstanceId) → validate (each field against its §2.1–§2.4 vocabulary; invalid → the field's fail-closed sentinel) → join (registry ⟕ runtime projection on roleInstanceId) → project (one frame; no second store)`.
- **Merge precedence / separation rule**: each field has exactly one owner. A committed-registry field is never overwritten by runtime data; a runtime/work field (`mission`/`workUnit`/`operationalState`) is never written back into the committed static registry. If a `roleInstanceId` appears only in the registry, its runtime fields are their sentinels; if only in the runtime projection with no registry row, it is `UNASSIGNED` and cannot receive work. Conflicting non-sentinel values for the **same owned field** → that field's fail-closed sentinel + a reported diagnostic (never a silent lower-precedence pick).

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

Batch A projects actors from **one committed local/static organization registry** under a new exact module `src/application/organization/` (no live tmux/process/model discovery).

- **Single source of truth**: the registry projection is a **derived view of the one runtime projection** joined on `roleInstanceId`; it is not a second parallel fact store.
- **Row shape** = a fact-envelope map: for each `roleInstanceId`, every §2.1/§2.2 registry field and every §2.3 AI-runtime field carries its own `{ value, source, status, evidenceTimestamp }`. Runtime/work fields (`mission`/`workUnit`/`operationalState`) are **joined at projection time and never stored** here.
- **Provenance + evidence on every field** (not one row-level stamp); unverified fields → their fail-closed sentinel; an actor not resolvable to exactly one responsible Advisor Team → `UNASSIGNED` and cannot receive work.
- **Change control**: registry changes require a normal reviewed commit (no runtime mutation, no live edit path, no automatic refresh).

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
- each field normalizes to exactly its §2.1–§2.4 sentinel; literal `UNKNOWN` only for free-text identity/binding fields;
- the §2.4 total `WorkUnitState → PixelOperationalState` mapping is exhaustive and defaults to `UNKNOWN`; cues never elevate progress;
- each §2.3 non-sentinel runtime value requires its accepted structured evidence; offline/no-process forces `AI_RUNTIME_UNKNOWN`;
- every field renders `value`+`source`(UPPER_SNAKE)+`status`; no time-only freshness inference; committed-registry fields are never overwritten by runtime and runtime/work fields are never stored in the registry;
- `UNASSIGNED` cannot receive work; symbolic surfaces contain no terminal/source/private content; one character per active `roleInstanceId`; no name/position/timestamp/proximity/prose inference.
