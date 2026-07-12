# Agent Office Batch A — Identity and Organization Contract

Status: `CONTROL_MASTER_DESIGN_CONTRACT__PENDING_ADVISOR_VALIDATION_AND_FABLE5_DESIGN_REVIEW`

Mode: `CONTROL_MASTER_DESIGN_MODE`. Companion to `AGENT_OFFICE_BATCH_A_APPLICATION_INTEGRATION_DESIGN_DELTA.md`.

Base: `ac8ba75d3a128385beaeeac58ae5bf54c03d23f2`. This contract records **local/static** projection rules for Batch A only. It authorizes no live discovery, no runtime, no authority change. It inherits and does not weaken the frame-projector fail-closed rules and the security/authority model.

## 1. Identity vs assignment separation (Founder item 6)

- **Stable identity** is the durable "who" of an actor and is **independent from mutable assignment**. It does not change when Team, responsible Advisor, `reportsTo`, mission, WorkUnit, or state change.
- **Mutable assignment** is the current "where/under whom": `advisorTeam`, `reportsToAdvisor`, `mission`, `workUnit`, `state`, `evidenceFreshness`.
- Stable identity fields (do not mutate within a batch): `roleInstanceId` (canonical instance key), `role`, `project`, `sessionName`.
- Mutable assignment fields: `advisorTeam`, `reportsToAdvisor`, `mission`, `workUnit`, `state`, `model` (proven vs `UNKNOWN`), `evidenceFreshness`.
- A change of assignment MUST NOT rename, clone, merge, or re-key identity. One character renders per active `roleInstanceId`; an active instance is never cloned.

## 2. Ten-field actor fact contract (Founder items 4, 5, 8)

Immutable ten-field model (order fixed; each field carries a source discriminator):

| Field | Meaning | `UNKNOWN` when |
|---|---|---|
| `role` | canonical role (Advisor/Worker/Reviewer/Control/Designer) | missing/unverified |
| `project` | project identity family | missing/unverified |
| `advisorTeam` | responsible Advisor Team or `UNASSIGNED` | not resolvable to one team |
| `reportsToAdvisor` | responsible Advisor for the current assignment | missing/unverified |
| `sessionName` | exact registry session name (no alias) | not a verified registry session |
| `model` | proven model | not mission-proven → `UNKNOWN` |
| `state` | closed 14-value operational-state enum member | non-member / non-fixture-sourced |
| `mission` | current mission | missing/synthetic marked |
| `workUnit` | current WorkUnit | missing/synthetic marked |
| `evidenceFreshness` | freshness of the backing evidence | missing/unverified |

### 2.1 Source discriminator (provenance)

Every fact declares exactly one provenance: `verifiedRegistryFact` | `verifiedMissionArtifactFact` | `canonicalFixture` | `syntheticFixture` | `unverified`.

- Labels and drawer render per-fact `data-actor-fact-source` attribution.
- Synthetic state/mission/WorkUnit/freshness are explicitly marked in label/detail/semantic UI and are never presented as current live operations.
- Only mission-proven models render non-`UNKNOWN` (`model`). Verified sessions use exact active registry names, never aliases.

### 2.2 Fail-closed normalization (inherited, must not weaken)

- Any null/undefined/non-object/blank-after-trim/`UNVERIFIED`-source value → literal `UNKNOWN` (`PIXEL_ACTOR_UNKNOWN`).
- `state` must be a `SYNTHETIC_FIXTURE`/registry-sourced member of the closed 14-value enum, else `UNKNOWN`.
- No fact is derived from names, position, timestamps, attached state, proximity, or terminal prose.

## 3. Local/static registry schema and source-of-truth rules (Founder item 7)

- Batch A projects actors from a **local/static registry fixture** (no live tmux/process/model discovery).
- **Single source of truth**: the registry projection is a **derived view of the one runtime projection** (`src/runtime/projection.ts`); it is not a second parallel fact store. The Pixi world, DOM labels, drawer, semantic mirror, and static fallback all consume the **same** projected frame.
- Registry entry (conceptual): `{ roleInstanceId, role, project, sessionName, advisorTeam | UNASSIGNED, reportsToAdvisor, model | UNKNOWN, provenance }`.
- **Fail-closed `UNASSIGNED`**: an actor that does not resolve to exactly one responsible Advisor Team is `UNASSIGNED` and **cannot receive work**. `UNASSIGNED` is a first-class, visible state, never hidden and never defaulted to a team.
- Missing/malformed registry rows do not fabricate values; they render `UNKNOWN`/`UNASSIGNED` and are marked as such.

## 4. Organization model (Founder item 6, 9)

- Every active actor belongs to **exactly one responsible Advisor Team** or is `UNASSIGNED`.
- `FOUNDATION_ADVISOR_TEAM`: Foundation Advisor, Control, Foundation Worker, Cosmile Worker, SIASIU Worker, Agent Office Worker, and the assigned independent Reviewer.
- `VIBENEWS_ADVISOR_TEAM`: exists only with a valid responsible Advisor plus its assigned Worker, Designer, and Reviewer.
- **Proximity never creates authority.** Spatial position, Pod membership, or selection does not grant or imply authority, assignment, or model.
- Current configuration renders exactly one character for the single active `Advisor roleInstanceId`; a future reviewed multi-Advisor configuration (Batch B–E) renders one distinct character per exact instance and never clones an active instance.
- Project identity uses the approved palette families (Cosmile, SIASIU, Foundation, VibeNews, Agent Office, Control) plus text/glyph/pattern cues — never color alone. Official current project name is `SIASIU`; the historical/forbidden-name registry stays in the identity document.

## 5. Role-specific symbolic work-surface contract (Founder item 9)

- Facility/work surfaces are **symbolic only**. They convey role/facility identity through approved art-direction placeholders.
- They MUST NOT render terminal output, source code, file paths, raw locators, credentials, secrets, or any private/raw operational content.
- Symbolic surfaces carry no authority and no live state; any status shown is the same provenance-marked projected fact, never inferred from the surface.

## 6. Channy non-operational boundary (Founder item 10)

- Channy is `CHANNY_ENABLED__NON_OPERATIONAL_AMBIENT_COMPANION_AND_STRUCTURED_STATUS_REFLECTOR` with `authorityRole: none`.
- Channy renders the existing slow eased eight-state Bedlington sequence (`walk/stop/sniff/sit/eat/drink/sleep/play`). It performs no operation, holds no authority, and never infers or mutates state.

## 7. Preserved contracts (must not change in Batch A)

M1 authentication/session, exact Advisor delivery, communication, transport/tmux boundary, PWA, security/authority model (actor authority matrix, LOOPBACK_PRIVATE, trust boundaries), and the M1 fixed-station static fallback remain **byte-contract unchanged**. Batch A adds an additive projection and presentation only.

## 8. Contract test obligations (for the Worker pass, not implemented here)

- identity persists across assignment change (no re-key/clone/merge);
- `UNASSIGNED` cannot receive work and is visibly marked;
- every fact renders its provenance; synthetic facts are marked non-live;
- unproven model → literal `UNKNOWN`; non-member state → `UNKNOWN`;
- no inference path from name/position/timestamp/proximity/prose;
- symbolic surfaces contain no terminal/source/private content;
- one character per active `roleInstanceId`.
