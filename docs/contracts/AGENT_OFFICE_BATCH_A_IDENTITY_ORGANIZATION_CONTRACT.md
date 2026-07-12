# Agent Office Batch A — Identity and Organization Contract

Status: `CONTROL_MASTER_DESIGN_CONTRACT__REWORKED_CD_4_5_6_7__PENDING_ADVISOR_VALIDATION_AND_INDEPENDENT_SENTINEL_DESIGN_REVIEW`

Mode: `CONTROL_MASTER_DESIGN_MODE`. Companion to `AGENT_OFFICE_BATCH_A_APPLICATION_INTEGRATION_DESIGN_DELTA.md`. Independent reviewer: the authorized **independent Sentinel** (`foundation-reviewer-sol`, currently GPT-5.6 SOL xhigh); Fable5 is a possible secondary/fallback runtime only (CD-1).

Base: `ac8ba75d3a128385beaeeac58ae5bf54c03d23f2`. This contract records **local/static** organization/identity rules for Batch A only. It authorizes no live discovery, no runtime, no authority change. It inherits and does not weaken the frame-projector fail-closed rules and the security/authority model. Reworked per Advisor validation `15_ADVISOR_CONTROL_DESIGN_VALIDATION.md` findings CD-4/CD-5/CD-6/CD-7.

## 1. Stable identity vs current bindings (CD-6, Founder item 6)

- **Stable identity key**: `roleInstanceId` is the durable actor/role-instance key. It is never re-keyed, cloned, or merged by any binding change.
- **Identity attributes** (change only by explicit reviewed identity change, not by assignment): `role`, `project`, `stableDisplayName`.
- **Current bindings / separately-sourced facts** (may change under explicit authority **without** re-keying the actor): `sessionName`, `advisorTeam`, `reportsToAdvisor`, `assignedBy`, `returnsResultTo`, `mission`, `workUnit`, and all AI-runtime facts of §3.
- ★A session is a **current operational binding**, not identity. `sessionName` may be replaced under explicit authority without changing `roleInstanceId` (corrects the prior draft that listed `sessionName` as stable identity).
- One character renders per active `roleInstanceId`; an active instance is never cloned.

## 2. Actor field contract (CD-5, Founder items 4, 5, 8)

The compact first-layer summary and the second-layer detail drawer share one field contract. It is **not frozen to the historical ten fields**. Each field carries an explicit evidence-source discriminator.

### 2.1 Identity attributes
| Field | Meaning | `UNKNOWN` when |
|---|---|---|
| `roleInstanceId` | stable actor/role-instance key | never `UNKNOWN` for an active actor |
| `role` | canonical role (Advisor/Worker/Reviewer/Control/Designer) | missing/unverified |
| `project` | project identity family | missing/unverified |
| `stableDisplayName` | stable human display name | missing/unverified |

### 2.2 Current bindings
| Field | Meaning | Empty/invalid → |
|---|---|---|
| `sessionName` | exact registry session name (no alias) | not a verified registry session → `UNKNOWN` |
| `advisorTeam` | responsible Advisor Team | not resolvable to one team → `UNASSIGNED` |
| `reportsToAdvisor` | responsible Advisor for current assignment | missing/unverified → `UNKNOWN` |
| `assignedBy` | who assigned the current work | missing/unverified → `UNKNOWN` |
| `returnsResultTo` | where the actor returns its result (Advisor) | missing/unverified → `UNKNOWN` |
| `mission` | current mission | missing/synthetic marked |
| `workUnit` | current WorkUnit | missing/synthetic marked |

### 2.3 AI-runtime facts (CD-4 — separate fields and closed vocabularies)
| Field | Closed vocabulary | Notes |
|---|---|---|
| `sessionProcess` | `SESSION_OFFLINE` \| `NO_AI_PROCESS` \| `AI_PROCESS_DETECTED` | availability/process detection only |
| `aiIdentity` | `AI_IDENTITY_UNKNOWN` \| `<verified AI identity>` | never inferred from names |
| `model` | `MODEL_UNKNOWN` \| `<mission-proven model>` | only mission-proven models render non-`UNKNOWN` |
| `effort` | `EFFORT_UNKNOWN` \| `<mission-proven effort>` | not a work state |
| `aiRuntimeState` | `AI_READY` \| `AI_WORKING` \| `AI_WAITING` \| `AI_ERROR` | `AI_WORKING` requires accepted structured work evidence |

`aiRuntimeState` is **not** the operational work-state animation enum and never substitutes for it. `MODEL_UNKNOWN`/`EFFORT_UNKNOWN` are not work states.

### 2.4 Operational work state
- `operationalState`: the existing structured workflow/animation vocabulary (e.g. `WORKING`/`WRITING_RESULT`/`WAITING_DEPENDENCY`/`WAITING_LEO`/`WAITING_ADVISOR`/`BLOCKED`/`HOLD`/`REVIEW_PENDING`/`COMPLETED`/`IDLE`/`UNKNOWN_OR_STALE`), sourced only from accepted structured cues. Non-member / non-cue-sourced → `UNKNOWN_OR_STALE`.

### 2.5 Evidence source (provenance)
Every field declares exactly one provenance: `verifiedRegistryFact` | `verifiedMissionArtifactFact` | `canonicalFixture` | `syntheticFixture` | `unverified`. Labels and drawer render per-field `data-actor-fact-source`. Synthetic values are explicitly marked and never presented as current live operations.

### 2.6 Fail-closed normalization (inherited, must not weaken)
- Any null/undefined/non-object/blank-after-trim/`UNVERIFIED`-source value → literal `UNKNOWN` (`PIXEL_ACTOR_UNKNOWN`).
- Invalid/unresolvable assignment → `UNASSIGNED`.
- `AI_WORKING` and `operationalState=WORKING` require accepted structured work evidence. Attached state, timestamps, names, positions, proximity, and terminal prose prove none of them.
- No field is derived from names, position, timestamps, attached state, proximity, or terminal prose.

## 3. Local/static organization registry (CD-7, Founder item 7)

Batch A projects actors from **one committed local/static organization registry** under a new exact module `src/application/organization/` (no live tmux/process/model discovery).

- **Single source of truth**: the registry projection is a **derived view of the one runtime projection** (`src/runtime/projection.ts`); it is not a second parallel fact store. The Pixi world, DOM labels, drawer, semantic mirror, and static fallback consume the same projected frame.
- **Row shape (conceptual)**: `{ roleInstanceId, role, project, stableDisplayName, sessionName, advisorTeam | UNASSIGNED, reportsToAdvisor, assignedBy, returnsResultTo, aiIdentity, model, effort, provenance, evidenceTimestamp, evidenceStatus }`.
- **Provenance + evidence on every row**: each row carries its provenance discriminator and an evidence timestamp/status. There is **no automatic refresh** and **no time-only freshness inference** — an old timestamp does not by itself downgrade a value, and a recent timestamp does not by itself prove liveness.
- **Fail-closed**: unverified fields stay `UNKNOWN`; an actor not resolvable to exactly one responsible Advisor Team is `UNASSIGNED` and **cannot receive work**. `UNASSIGNED`/`UNKNOWN` are first-class visible values, never hidden or defaulted.
- **Change control**: registry changes require a normal reviewed commit (no runtime mutation, no live edit path).

## 4. Organization model (Founder items 6, 9)

- Every active actor belongs to **exactly one responsible Advisor Team** or is `UNASSIGNED`.
- `FOUNDATION_ADVISOR_TEAM`: Foundation Advisor, Control, Foundation Worker, Cosmile Worker, SIASIU Worker, Agent Office Worker, and the assigned independent Reviewer.
- `VIBENEWS_ADVISOR_TEAM`: exists only with a valid responsible Advisor plus its assigned Worker, Designer, and Reviewer.
- **Proximity never creates authority.** Spatial position, Pod membership, or selection does not grant or imply authority, assignment, model, or state.
- Current configuration renders exactly one character for the single active `Advisor roleInstanceId`; a future reviewed multi-Advisor configuration (Batch B–E) renders one distinct character per exact instance and never clones an active instance.
- Project identity uses the approved palette families (Cosmile, SIASIU, Foundation, VibeNews, Agent Office, Control) plus text/glyph/pattern cues — never color alone. Official current project name is `SIASIU`; the historical/forbidden-name registry stays in the identity document.

## 5. Role-specific symbolic work-surface contract (Founder item 9)

- Facility/work surfaces are **symbolic only** and convey role/facility identity through approved art-direction placeholders.
- They MUST NOT render terminal output, source code, file paths, raw locators, credentials, secrets, or any private/raw operational content.
- Symbolic surfaces carry no authority and no live state; any status shown is the same provenance-marked projected fact, never inferred from the surface.

## 6. Channy non-operational boundary (Founder item 10)

- Channy is `CHANNY_ENABLED__NON_OPERATIONAL_AMBIENT_COMPANION_AND_STRUCTURED_STATUS_REFLECTOR` with `authorityRole: none`.
- Channy renders the existing slow eased eight-state Bedlington sequence (`walk/stop/sniff/sit/eat/drink/sleep/play`). It performs no operation, holds no authority, and never infers or mutates state.

## 7. Preserved contracts (must not change in Batch A)

M1 authentication/session, exact Advisor delivery, communication, transport/tmux and Hermes-disabled boundary, PWA (same-origin hashed chunks + atomic cache-version bump only), security/authority model (actor authority matrix, LOOPBACK_PRIVATE, trust boundaries), and the M1 fixed-station static fallback remain **contract unchanged**. Batch A adds an additive projection and presentation only.

## 8. Contract test obligations (for the Worker pass, not implemented here)

- `roleInstanceId` identity persists across any binding change (no re-key/clone/merge); `sessionName` replacement does not re-key;
- `UNASSIGNED` cannot receive work and is visibly marked; invalid assignment → `UNASSIGNED`;
- AI-runtime fields use their separate closed vocabularies; `AI_WORKING`/`WORKING` require structured work evidence;
- `MODEL_UNKNOWN`/`EFFORT_UNKNOWN`/`AI_IDENTITY_UNKNOWN`/`SESSION_OFFLINE`/`NO_AI_PROCESS`/`AI_PROCESS_DETECTED` render literally;
- every field renders its provenance; synthetic facts are marked non-live; registry rows carry evidence timestamp/status with no time-only freshness inference;
- no inference path from name/position/timestamp/proximity/prose;
- symbolic surfaces contain no terminal/source/private content;
- one character per active `roleInstanceId`.
