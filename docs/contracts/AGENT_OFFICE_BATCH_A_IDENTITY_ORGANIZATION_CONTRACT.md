# Agent Office Batch A — Identity and Organization Contract

Status: `CONTROL_MASTER_DESIGN_CONTRACT__PLUS_SENTINEL_FINAL_SOURCE_EXACTNESS_FDR1_FDR2__PENDING_ADVISOR_DIFF_VALIDATION_THEN_SAME_SENTINEL_REREVIEW` (§2.7 unchanged; §3 `advisorTeam`=(A)-registry-owned, §2.3.2 `aiRuntimeState`=projector RT+(B); §3.1 PRC-5 total layout + FDR-1: sole `projectKey`, 14-state current-actor priority, ADVISOR-role/matching-**non-sentinel-`AdvisorTeam`**/membership responsible-Advisor with pod-omit/`M1_FIXED_STATIONS`, literal `DEFAULT_VIEWPORT`/`DEFAULT_LOGICAL_TIME_MS` + camera via `fullOfficeCamera`→`FULL_OFFICE`/`cameraOverride=null` (no `FIT_ALL`), pod `advisorTeamId: AdvisorTeam` non-sentinel; §3.1.1 PRC-6 wrapper interface; §3.1.2 FDR-2 complete raw `livingOffice` parser — revision===enclosing snapshot, canonical-UTC, 16 envelopes, diagnostic codes)

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

### 2.3 Projection-time process & AI-runtime facts (from committed local attestation evidence input **(B)** only) — S1/S3
These facts are **absent from the runtime projection** (`RuntimeActorObservation`/`AuthenticatedSpatialActorObservationInput` carry no such field), so **(B)** supplies them. ★`mission`, `workUnit`, activity, and `operationalState` are **not** here — they are owned solely by the existing runtime projection/cue reducer (§2.4/§2.5), never by (B).

| Field | Closed vocabulary | Fail-closed sentinel | Exact accepted evidence (record `kind` — §2.3.1) |
|---|---|---|---|
| `sessionProcess` | `SESSION_PROCESS_UNKNOWN` \| `SESSION_OFFLINE` \| `NO_AI_PROCESS` \| `AI_PROCESS_DETECTED` | `SESSION_PROCESS_UNKNOWN` | `process_offline`/`process_absent`/`process_detected` respectively; missing/malformed/unverified/no-evidence/`STALE` → `SESSION_PROCESS_UNKNOWN` (a missing observation never asserts offline or no-process) |
| `aiIdentity` | `AI_IDENTITY_UNKNOWN` \| a value in `allowedAiIdentities` | `AI_IDENTITY_UNKNOWN` | `ai_identity_attestation` whose `value ∈ allowedAiIdentities`; never inferred from names |
| `model` | `MODEL_UNKNOWN` \| a value in `allowedModels` | `MODEL_UNKNOWN` | `model_attestation` whose `value ∈ allowedModels` (mission-proven) |
| `effort` | `EFFORT_UNKNOWN` \| a value in `allowedEfforts` | `EFFORT_UNKNOWN` | `effort_attestation` whose `value ∈ allowedEfforts` (mission-proven); not a work state |
| `aiRuntimeState` | `AI_RUNTIME_UNKNOWN` \| `AI_READY` \| `AI_WORKING` \| `AI_WAITING` \| `AI_ERROR` | `AI_RUNTIME_UNKNOWN` | computed by the §2.3.2 total arbitration from the runtime work/wait/error signal + `ai_ready`/`ai_error` records |

#### 2.3.1 Accepted-evidence input record (exact schema, identity, dedup, ordering; the only shape (B) may hold) — T1
A committed `AcceptedEvidenceRecord` (one exact type, `schemaVersion = 'agent-office.batch-a.accepted-evidence.v1'`, modeled on the existing `CurrentActivity` discipline in `src/domain/activity/index.ts:43-49`):
```ts
type AcceptedEvidenceKind =
  | 'process_offline' | 'process_absent' | 'process_detected'
  | 'ai_identity_attestation' | 'model_attestation' | 'effort_attestation'
  | 'ai_ready' | 'ai_error';
interface AcceptedEvidenceRecord {
  readonly schemaVersion: 'agent-office.batch-a.accepted-evidence.v1';
  readonly evidenceId: string;              // immutable stable identity; exact format: UUIDv7
  readonly evidenceRef: string;             // immutable artifact reference proving acceptance; exact format: `sha256:<64 lowercase hex>`
  readonly kind: AcceptedEvidenceKind;
  readonly roleInstanceId: string;          // join key
  readonly missionId?: string;              // correlation only; never the source of mission/workUnit display
  readonly workUnitId?: string;
  readonly value?: string;                  // required for identity/model/effort attestations; validated against the (A) allowed-token set
  readonly provenance: PixelActorFactSource; // UPPER_SNAKE
  readonly acceptanceStatus: 'ACCEPTED' | 'REJECTED';
  readonly sourceEventIds: readonly string[]; // non-empty; each UUIDv7; correlation evidence, not identity
  readonly observedAt: string;              // ISO-8601; when observed
  readonly effectiveFrom: string;           // ISO-8601; when the fact takes effect
  readonly optionalExpiresAt?: string;      // ISO-8601
}
```
- **Validation (fail-closed)**: a record is *valid* only if `schemaVersion` matches, `evidenceId` is a well-formed UUIDv7, `evidenceRef` matches `sha256:<64 hex>`, `acceptanceStatus === 'ACCEPTED'`, `provenance !== 'UNVERIFIED'`, `sourceEventIds.length >= 1` (all UUIDv7), `observedAt`/`effectiveFrom` are valid ISO-8601, `optionalExpiresAt` (when present) is `> effectiveFrom`, and it is **not expired** at `evaluatedAt` (`optionalExpiresAt` absent or `> evaluatedAt`); for attestations `value` must be in the corresponding (A) allowed-token set. Any other record is dropped and its field falls to the field sentinel. Recency alone is never proof (no time-only freshness inference); an expired record does not contribute even if newest.
- **Identity, replay vs collision, dedup (U2; input-order independent)**: group all records by `evidenceId`. If every record sharing an `evidenceId` is **field-identical** (all contract fields equal) it is an **idempotent replay** → collapse to one. If any two records share an `evidenceId` but differ in **any** contract field (`kind`/`evidenceRef`/`roleInstanceId`/`value`/`effectiveFrom`/`observedAt`/`optionalExpiresAt`/`provenance`/`acceptanceStatus`/`sourceEventIds`) it is an **`evidenceId` collision** → **all records bearing that `evidenceId` are dropped** (none contributes) + a reported diagnostic. This is set-based and does not depend on arrival order. Distinct `evidenceId`s are distinct records even if all other fields match.
- **Deterministic selection among multiple valid same-`kind` records for one `roleInstanceId`**: choose the greatest `effectiveFrom`; on equal `effectiveFrom`, the greatest `evidenceId` (lexicographic) — **unless** the tied records carry **conflicting `value`s** (for attestations), in which case that field yields its **fail-closed sentinel** + a diagnostic (never a silent pick).
- **`sessionProcess` total cross-kind arbitration (U1; conservative, input-order independent)**: after same-kind selection, consider the set of **present kinds** among `{process_detected, process_absent, process_offline}` (a kind is *present* iff it has a valid selected record).
  1. **zero** present → `SESSION_PROCESS_UNKNOWN`;
  2. **exactly one** present → its value (`process_detected`→`AI_PROCESS_DETECTED`, `process_absent`→`NO_AI_PROCESS`, `process_offline`→`SESSION_OFFLINE`);
  3. **two or more** present (contradictory kinds) → `SESSION_PROCESS_UNKNOWN` + a reported diagnostic (a contradictory observation never asserts a positive process claim; the newest kind is **not** chosen).

  This makes `sessionProcess` total over missing / single-kind / multi-kind-unequal-time / multi-kind-tie / expired / contradictory inputs, and produces the `P` consumed by §2.3.2.
- Records are never inferred from names/positions/timestamps/proximity/prose. The §2.3.2 total runtime-state arbitration then runs with the arbitrated `P` and the selected `ai_ready`/`ai_error` records.

#### 2.3.2 `aiRuntimeState` total arbitration (deterministic; every combination decided)
Let `P = sessionProcess`; let `W`/`WA`/`E` be true iff the runtime projector output resolves to an active-work observable / a `WAITING_DEPENDENCY`|`WAITING_LEO` observable / `FAILED` (or a valid `ai_error` record); let `R` be true iff a valid `ai_ready` record is current.
1. if `P ≠ AI_PROCESS_DETECTED` → `AI_RUNTIME_UNKNOWN`;
2. else if `E` → `AI_ERROR` (an error always surfaces; a co-present ready/work never hides it);
3. else if `W && WA` → `AI_RUNTIME_UNKNOWN` (mutually-exclusive conflict);
4. else if `W` → `AI_WORKING`;
5. else if `WA` → `AI_WAITING`;
6. else if `R` → `AI_READY`;
7. else → `AI_RUNTIME_UNKNOWN`.

★`aiRuntimeState` is not the operational work state (§2.4). Literal `UNKNOWN` (`PIXEL_ACTOR_UNKNOWN`) is used only for the free-text fields in §2.1/§2.2; `mission`/`workUnit`/`operationalState` are runtime-owned (§2.4/§2.5).

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

### 2.5 Fact envelope, three sources, the exact join, and STALE behavior (P3, R3, S3)
- **Fact envelope** (per field): `{ value, source, status, evidenceTimestamp }`.
  - `source` = the exact inherited discriminators (`src/ui/pixel/contracts.ts:6-11`): `VERIFIED_REGISTRY` | `VERIFIED_MISSION_ARTIFACT` | `CANONICAL_FIXTURE` | `SYNTHETIC_FIXTURE` | `UNVERIFIED` (UPPER_SNAKE).
  - `status`: `VERIFIED` | `UNVERIFIED` | `STALE` | `INVALID` | `MISSING`.
  - `evidenceTimestamp`: ISO-8601 or `null`; recorded evidence only — **no time-only freshness inference**.
- **Exactly three sources; one final frame; no duplicated truth (S3)**:
  - **(A) committed identity/organization registry** (immutable per reviewed commit) owns the **stable** facts: §2.1 identity attributes, §2.2 organizational bindings, and allowed-token metadata (`allowedAiIdentities`/`allowedModels`/`allowedEfforts`). It stores no changing fact.
  - **(RT) the existing authenticated runtime projection / cue reducer** is the **sole truth** for `mission`, `workUnit`, activity, and `operationalState` (`src/runtime/observation-coordinator.ts:269-320`, `authenticated-projection.ts`). Batch A **does not** re-source these; `livingOffice` is a derived view of that same runtime projection.
  - **(B) committed local attestation evidence** (§2.3.1) is limited to facts **genuinely absent** from (RT): `sessionProcess`, `aiIdentity`, `model`, `effort`, and the `ai_ready`/`ai_error` inputs. (B) never carries `mission`/`workUnit`/activity/`operationalState`; there is no second work-state store.
- **Projection-time computation (owner = the projector, never a committed store)**: `operationalState` = the §2.4 total map of the (RT) projector output; `sessionProcess`/`aiIdentity`/`model`/`effort` = validated (B) attestations vs (A) allowed-tokens; `aiRuntimeState` = the §2.3.2 arbitration over the (RT) work/wait/error signal + (B) `ai_ready`/`ai_error`. No changing fact is written back into (A) or (B).
- **Exact flow**: `load (A), (RT), (B) → validate/compute changing facts → FULL OUTER JOIN (union) on roleInstanceId across (A) and the (RT)+(B)-derived fact rows → one final frame`.
- **Full outer join (union) on `roleInstanceId`**:
  - **both present**: identity/org from (A); mission/workUnit/operationalState from (RT); process/AI-runtime from (B)-derived.
  - **registry-only** (`roleInstanceId` in (A), no (RT)/(B)): identity/org from (A); every changing fact = its field sentinel.
  - **runtime/evidence-only** (`roleInstanceId` in (RT)/(B), no (A) row): changing facts as computed; all §2.1/§2.2 fields = literal `UNKNOWN` and `advisorTeam` = `UNASSIGNED` (cannot receive work).
- **STALE normalization per field (S3)**: a fact whose `status = STALE` (or `INVALID`/`MISSING`/`UNVERIFIED`) yields **exactly its field sentinel** — `sessionProcess`→`SESSION_PROCESS_UNKNOWN`, `aiIdentity`→`AI_IDENTITY_UNKNOWN`, `model`→`MODEL_UNKNOWN`, `effort`→`EFFORT_UNKNOWN`, `aiRuntimeState`→`AI_RUNTIME_UNKNOWN`, `operationalState`→`UNKNOWN`, `advisorTeam`→`UNASSIGNED`, and every free-text field (incl. `mission`/`workUnit` when (RT) reports stale) → literal `UNKNOWN`. A `STALE` value is never displayed as if current.
- **Conflict**: conflicting non-sentinel values for the same owned field → that field's sentinel + a reported diagnostic (never a silent pick). If (RT) and any (B)/(A) content ever disagree about a (RT)-owned field, **(RT) wins** and (B)/(A) may not override it (no second truth).

### 2.6 Fail-closed normalization (inherited, must not weaken)
- Free-text identity/binding fields → literal `UNKNOWN` (`PIXEL_ACTOR_UNKNOWN`) on any null/undefined/non-object/blank-after-trim/`UNVERIFIED`-source value.
- Each enum field → its own §2.3/§2.4 sentinel (never literal `UNKNOWN`).
- Invalid/unresolvable assignment → `UNASSIGNED`.
- `AI_WORKING` and `operationalState = WORKING`/`TESTING`/etc. require accepted structured work evidence; no field is derived from names, positions, timestamps, attached state, proximity, or terminal prose.

### 2.7 Compact summary subset and complete drawer field order (P3)
- **Compact summary (first layer)**, in order: `role` (glyph+ring) · `stableDisplayName` · `sessionProcess` · `aiIdentity` · `model` · `effort` · `aiRuntimeState` · `operationalState`, each with its `source` tag; text+glyph+ring, never color alone.
- **Detail drawer (second layer)**, complete ordered set: `roleInstanceId` · `role` · `project` · `stableDisplayName` · `advisorTeam` · `reportsToAdvisor` · `assignedBy` · `returnsResultTo` · `sessionName` · `sessionProcess` · `aiIdentity` · `model` · `effort` · `aiRuntimeState` · `operationalState` · `mission` · `workUnit` — each rendering `value` + `source` (`data-actor-fact-source`) + `status`; `role="dialog"`, Escape, Tab containment, close-button focus on open, invoker focus restore; semantic/static parity.
- **Drawer test matrix**: one row per field × {non-failure value, fail-closed sentinel, provenance rendered, status rendered}; plus focus/keyboard cases; plus the §2.4 total-mapping cases; plus the §2.3 evidence-rule cases.
- **Landing site (scope-correction)**: both the compact labels and the actor-specific 17-field detail dialog land in `src/ui/pixel/living-office-actor-overlay.tsx` (the actor overlay renders the `living-office-actor-label` cards and the `living-office-actor-detail-heading` `role="dialog"`). `src/ui/pixel/living-office-detail-drawer.tsx` is the **separate, non-duplicating frame/evidence technical panel** (frame contract/key/projection revision) and is **not** the actor drawer. Tests: `tests/ui/pixel-actor-overlay.test.tsx` + `tests/ui/pixel-world-semantic-parity.test.tsx`.

## 3. Local/static organization registry (CD-7, P3, Founder item 7)

Batch A adds **two committed local/static inputs** under a new exact module `src/application/organization/` (no live tmux/process/model discovery); together with the existing runtime projection **(RT)** they feed one projector into one final frame (§2.5):

- **(A) identity/organization registry** — stable identity attributes (§2.1), organizational bindings (§2.2), and allowed-token metadata; immutable per reviewed commit; stores **no** changing fact.
- **(B) local attestation evidence** — `AcceptedEvidenceRecord`s (§2.3.1) **limited to facts absent from (RT)**: process detection, identity/model/effort attestations, and `ai_ready`/`ai_error`. (B) never carries `mission`/`workUnit`/activity/`operationalState`.
- **(RT) is the sole truth** for `mission`/`workUnit`/activity/`operationalState`; Batch A does not re-source these into a committed store. ★Production-render scope (delta §2.3 PR-1): the runtime `LivingOfficePresentationV1` supplies **only** `frame: OrganizationFrame`, and `OrganizationFrame` supplies **only** `actors` (`OrganizationFrameActor`, per-field envelopes) + `diagnostics` — it does **not** supply pods / `PixelWorldLayout` / cues / selected Team / camera / clock. Those are **committed visual/identity configuration** ((A) registry + a `CommittedOfficeLayoutConfigV1` derived from it + `createPixelWorldLayout` + `presentation-clock`), composed with RT into the versioned `LivingOfficeProductionRenderInputV1` and **runtime-validated** by `parseLivingOfficeProductionRenderInput` (delta §2.3 PR-3; a type cast is not validation). ★The production pixel frame consuming this composed input is built **fixture-free** by `src/ui/pixel/production-frame-projector.ts` (delta §2.3 PR-2) — it imports no `fixtures/prototype-*` and no `frame-projector.ts`; synthetic fixtures remain test-demo-only.
- **Mint order (not reversed)**: (A), (RT), (B) are inputs; the projector computes changing facts (§2.5) and a **full outer join (union) on `roleInstanceId`** yields one frame — no "registry derived from runtime", no second work-state truth store.
- **Envelope on every field** (per-field `{ value, source, status, evidenceTimestamp }`); `STALE`/`INVALID`/`MISSING`/`UNVERIFIED` → the field sentinel (§2.5); an actor not resolvable to exactly one responsible Advisor Team → `UNASSIGNED` and cannot receive work; changing facts are never written back into (A)/(B).
- **Change control**: (A) and (B) change only by a normal reviewed commit (no runtime mutation, no live edit path, no automatic refresh, no time-only freshness inference).

## 3.1 Committed visual layout configuration — `CommittedOfficeLayoutConfigV1` (PRC-5; presentation only)

The production pod/visual fields that are **not** literal `OrganizationRegistryRow` fields (pod identity, `roleCategory`, `presentationPodId`, `responsibleAdvisorRoleInstanceId`, the eight `PixelProjectIdentity` fields, selection, labels) come from **one committed presentation config**, not from RT and not inferred from location. Canonical source: committed constant `COMMITTED_OFFICE_LAYOUT_CONFIG_V1` in **`src/application/organization/office-layout-config.ts`**; type `CommittedOfficeLayoutConfigV1` in `src/ui/pixel/contracts.ts`. Immutable per reviewed commit (same change control as (A)/(B)). It carries **presentation configuration only** — never mission/WorkUnit/activity/operational state, and it owns no operational plan.

```ts
interface CommittedOfficeLayoutConfigV1 {
  readonly schemaVersion: 'agent-office.committed-office-layout-config.v1';
  readonly pods: readonly CommittedPodConfig[];   // canonical order = ascending podId (deterministic)
  readonly selectedDefaultPodId: string;          // MUST equal the first pod by canonical order
  readonly roleCategoryByRole: Readonly<Record<OrganizationRole,        // closed TOTAL map (all OrganizationRole keys)
    'LEO_DECISION'|'ADVISOR_ROUTING'|'CONTROL_RECOVERY'|'INDEPENDENT_REVIEW'|'WORKER_BUILD'|'GENERIC_REGISTERED'>>;
  readonly defaultRoleCategory: 'GENERIC_REGISTERED';                   // for OrganizationUnknown / unmapped
  readonly projectIdentityByProject: Readonly<Record<string, PixelProjectIdentity>>;  // sole key = CommittedPodConfig.projectKey (never registryRow.project)
  readonly defaultProjectIdentity: PixelProjectIdentity;               // all 8 fields; for unmapped project
}
interface CommittedPodConfig {
  readonly podId: string;                            // unique across pods
  readonly advisorTeamId: AdvisorTeam;               // the pod's Advisor Team lane — NON-sentinel (FOUNDATION_ADVISOR_TEAM|VIBENEWS_ADVISOR_TEAM); never the actor sentinel UNASSIGNED
  readonly responsibleAdvisorRoleInstanceId: string | null;  // valid only as exactly one ADVISOR+matching-Team+member; null/empty/multiple/unresolvable → pod OMITTED with diagnostic (never a role-instance UNASSIGNED sentinel)
  readonly projectKey: string;                       // → projectIdentityByProject
  readonly podLabel: string;
  readonly memberRoleInstanceIds: readonly string[]; // exact membership; an actor may appear in at most one pod
}
```

**Deterministic construction of `PixelPodInput[]` (config + RT; no inference):**

- **Ordering / selection**: pods sorted ascending by `podId`; a user selection resolving to no valid pod falls to `selectedDefaultPodId`; if `selectedDefaultPodId` is not a valid pod id **or no valid pod remains** → the surface falls back to `M1_FIXED_STATIONS` (selection never becomes `UNASSIGNED`, which is not a pod id).
- **`projectIdentity`** = `projectIdentityByProject[pod.projectKey]` — **`CommittedPodConfig.projectKey` is the sole key** (never `registryRow.project`; a pod may contain actors of several projects, so the pod's identity is config-declared), else `defaultProjectIdentity` (all eight fields — `identityId`/`projectId`/`displayName`/`shortLabel`/`primaryColor`/`secondaryColor`/`glyph`/`pattern` — always present).
- **`responsibleAdvisorRoleInstanceId`** is **valid only if** it resolves to **exactly one** resolved registry actor whose `role === 'ADVISOR'`, whose `advisorTeam` matches the pod's `advisorTeamId`, and who is a valid pod member; otherwise the pod is **omitted with a diagnostic** — the literal `'UNASSIGNED'` is **never** written into `PixelPodInput.responsibleAdvisorRoleInstanceId` (that field is an unrestricted required string, `contracts.ts:110-124`; an authority-looking sentinel there is forbidden). If **no valid pod remains** after omission → the surface falls back to `M1_FIXED_STATIONS`.
- **`advisorTeamId`** from `CommittedPodConfig`.
- **`roleCategory`** per actor = `roleCategoryByRole[registryRow.role]`, else `defaultRoleCategory` (`GENERIC_REGISTERED`).
- **Membership / `actorRoleInstanceIds`** = `memberRoleInstanceIds` ∩ the resolved registry actors; a member absent from the resolved registry is dropped with a diagnostic; an actor listed in **more than one** pod is dropped from **all** pods with a diagnostic (no cloned membership); a pod with zero resolved members is omitted (diagnostic).
- **`currentActorRoleInstanceId`** = deterministic: the member whose RT `operationalState` ranks highest by the **complete literal priority order below**, tie-broken by ascending `roleInstanceId`; empty pod → omitted (diagnostic). The total priority over all 14 `PixelOperationalState` values (highest first — a conservative order surfacing in-progress work, then attention/waiting, then terminal, then idle/unknown): **`WORKING` > `TESTING` > `REVIEWING` > `ROUTING / DISPATCH` > `RETURNING_RESULT` > `NEEDS_PATCH` > `BLOCKED` > `WAITING_DEPENDENCY` > `WAITING_LEO` > `FAILED` > `CANCELLED` > `COMPLETED` > `IDLE` > `UNKNOWN`**. **`missionShortLabel`/`currentWorkUnitShortId`** = truncated RT `mission`/`workUnit` of that current actor (RT-owned); **`operationalState`** = that actor's RT operational state.
- **Counts** `completedWorkUnits`/`totalWorkUnits`/`completedGates`/`totalGates` = literal **`0`** (PRC-2 fail-closed; display-only, not operational truth; no pod shown "complete"); **`blockerSummary`** = `null`.
- **Literal committed defaults (PRC-5/PRC-6, FDR-1)**: `DEFAULT_VIEWPORT = { width: 1280, height: 720 }` (used when a wrapper `viewport.width`/`height` is not a finite `> 0`); `DEFAULT_LOGICAL_TIME_MS = 0` (monotonic zero is valid; used when `logicalTimeMs` is not a finite `>= 0`). **Camera** uses the actual source vocabulary, not a synthetic default: production `cameraOverride = null`, and the initial camera is computed by `fullOfficeCamera(layout, viewport.width, viewport.height, selectedPodId)` (`src/ui/pixel/camera.ts:9-24`) → a complete `PixelCameraState` with `mode='FULL_OFFICE'` (`PixelCameraState.mode ∈ FULL_OFFICE|FOCUSED_POD|MANUAL|SCRIPTED`, `contracts.ts:249-255`). No `FIT_ALL` and no second camera enum/mapping. These are explicit values, not "undefined".
- **Config validation**: duplicate `podId` → deterministic hard-fail; every `advisorTeamId ∈ AdvisorTeam` (non-sentinel — a pod whose `advisorTeamId` is the actor sentinel `UNASSIGNED` is not a renderable lane and is omitted); the responsible Advisor's own `advisorTeam.value` must equal that same non-sentinel `AdvisorTeam`; `projectKey` resolvable (else `defaultProjectIdentity`); `roleCategoryByRole` total over `OrganizationRole`. A pod failing the responsible-Advisor rule is omitted (diagnostic); no valid pods → `M1_FIXED_STATIONS`. Actor-level `advisorTeam=UNASSIGNED` remains a valid fail-closed **actor** state (§2.5) but can never define a renderable pod lane.

### 3.1.1 Production render input wrapper — `LivingOfficeProductionRenderInputV1` (PRC-6)

The composed render input validated before the lazy renderer (delta §2.3 PR-3 boundary 2). Distinct from the **raw** `LivingOfficePresentationV1` (`{ schemaVersion, projectionRevision, evaluatedAt, frame }`, validated first at `client.ts:parseProjection`). Every field declared and validated/consumed exactly once:

```ts
interface LivingOfficeProductionRenderInputV1 {
  readonly schemaVersion: 'agent-office.living-office-production-render-input.v1';
  readonly operational: LivingOfficePresentationV1;         // the already-raw-validated RT view
  readonly committedLayout: CommittedOfficeLayoutConfigV1;   // §3.1
  readonly viewport: { readonly width: number; readonly height: number };  // finite > 0 else DEFAULT_VIEWPORT
  readonly logicalTimeMs: number;                           // finite >= 0 (zero valid) else DEFAULT_LOGICAL_TIME_MS
  readonly selection: { readonly selectedPodId: string };   // invalid → selectedDefaultPodId → M1
  readonly cues: readonly [];                               // always-empty (PRC-3); non-empty rejected
}
```

Camera is not an input field: production `cameraOverride` is always `null`; the initial camera is computed by `fullOfficeCamera(layout, viewport.width, viewport.height, selectedPodId)` → `mode='FULL_OFFICE'` (§3.1, FDR-1).

### 3.1.2 Raw `livingOffice` untrusted-boundary parser (FDR-2; the first gate — distinct from the §3.1.1 wrapper)

The **first** boundary (delta §2.3 PR-3) validates the raw `livingOffice` bytes inside `parseProjection` **before** they enter client state — this is a **separate, complete** nested contract from the §3.1.1 wrapper (§3.1/§3.1.1 do **not** define these keys). Any unknown/missing/invalid field fails closed (the `livingOffice` subtree is dropped; the shell falls back `DOM_STATIC`→`M1_FIXED_STATIONS`). All keys are **exact** (unknown keys reject).

- **Raw helper + call site**: a new `parseRawLivingOfficePresentation(value: unknown, enclosingRevision: number): LivingOfficePresentationV1 | null` in `src/ui/runtime/client.ts`, invoked by `parseProjection` at the point it validates the enclosing `RuntimeProjectionSnapshot` (`client.ts:519-549`); a `null` result drops `livingOffice` from the returned snapshot (no cast). Focused test: `tests/contract/production-render-input.test.ts` (same single literal path).
- **Raw top-level exact keys** `{ schemaVersion, projectionRevision, evaluatedAt, frame }` (`src/runtime/projection.ts:54-59`):
  - `schemaVersion === 'agent-office.living-office-presentation.v1'` (directly on the raw object; no `operational`).
  - `projectionRevision`: `Number.isSafeInteger` **and** `>= 0` **and** **exactly equal to** the enclosing `RuntimeProjectionSnapshot.revision` already validated at the same boundary (`client.ts:519-549`; the presentation is built with that same `services.projectionRevision`, `projection.ts:94-108,203-216`).
  - `evaluatedAt`: canonical UTC per the repo's existing `isCanonicalUtc` (`client.ts:610`), exactly `YYYY-MM-DDTHH:mm:ss.sssZ`, parseable, and round-tripping through `toISOString()`.
- **`frame` exact keys** `{ actors, diagnostics }`, both arrays.
- **Actor exact keys**: `roleInstanceId` (non-blank string; duplicates fail closed per the already-closed drop-all rule, `registry.ts:58-80`) + the **sixteen fact envelopes** `role, project, stableDisplayName, advisorTeam, reportsToAdvisor, assignedBy, returnsResultTo, sessionName, sessionProcess, aiIdentity, model, effort, aiRuntimeState, operationalState, mission, workUnit` + `canReceiveWork` (`types.ts:164-189`).
- **Every fact envelope exact keys** `{ value, source, status, evidenceTimestamp }`: `status ∈ OrganizationFactStatus` (`VERIFIED|UNVERIFIED|STALE|INVALID|MISSING`, `types.ts:21`); `source ∈ PixelActorFactSource` (`contracts.ts:8-13`); `evidenceTimestamp` is `null` or canonical UTC; `value` validated against that field's own vocabulary/sentinel (enum fields — `advisorTeam`/`aiRuntimeState`/`operationalState`/`sessionProcess`/`role` — against their unions incl. sentinels; free-text fields as string).
- **`canReceiveWork`**: boolean, and **must be `false` whenever `advisorTeam.value === 'UNASSIGNED'`** (never inferred `true` from other fields).
- **Diagnostic exact keys** `{ code, roleInstanceId, detail }` (`types.ts:149-161`): `code ∈ OrganizationDiagnosticCode` (`INVALID_REGISTRY_ROLE_INSTANCE_ID | DUPLICATE_REGISTRY_ROLE_INSTANCE_ID | EVIDENCE_ID_COLLISION | SESSION_PROCESS_CONTRADICTION | ATTESTATION_VALUE_CONFLICT | RUNTIME_OWNED_FIELD_CONFLICT`); `roleInstanceId` is `null` or a non-blank string; `detail` a non-blank string.

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
- `AcceptedEvidenceRecord` (§2.3.1) validates by `acceptanceStatus`/`provenance`/`sourceEventIds`/`effectiveFrom`/expiry/allowed-token; `aiRuntimeState` follows the §2.3.2 total arbitration (error surfaces; work+wait → `AI_RUNTIME_UNKNOWN`); `ai_ready+ai_error` → `AI_ERROR`;
- three sources: (A) identity/org registry + allowed-tokens, **(RT) existing runtime projection = sole truth for `mission`/`workUnit`/activity/`operationalState`**, (B) attestation evidence limited to facts absent from (RT); **full outer join (union) on `roleInstanceId`**; registry-only → changing sentinels; runtime/evidence-only → `UNKNOWN` identity + `UNASSIGNED`; (RT) wins any conflict over a (RT)-owned field; changing facts never stored; every field renders `value`+`source`(UPPER_SNAKE)+`status`;
- `STALE`/`INVALID`/`MISSING`/`UNVERIFIED` on any field → exactly that field's sentinel (never displayed as current); no time-only freshness inference;
- `UNASSIGNED` cannot receive work; symbolic surfaces contain no terminal/source/private content; one character per active `roleInstanceId`; no name/position/timestamp/proximity/prose inference.

## As-built implementation (Batch A Worker)

Implemented on branch `batch-a/modern-office-identity-001`; this section records actual implementation and pre-claims no independent review or final approval.

- The module lives under `src/application/organization/`: `types.ts` (fact envelope + enums), `registry.ts` (§2.1/§2.2 normalization **and** the committed (A) identity/organization registry data), `evidence.ts` (§2.3.1 validation/arbitration **and** the committed (B) accepted-evidence data), `projector.ts` (§2.3–§2.5 changing-fact computation + full-outer join on `roleInstanceId`), `office-layout-config.ts` (committed presentation config), `production-render-input.ts` (§3.1 composition + `parseLivingOfficeProductionRenderInput`), and `index.ts`. The repo-root `fixtures/organization-registry.ts` re-exports the single `registry`/`evidence` authority from the module (no duplicated data), so `build:core` emits the committed data into `dist/core` for the loopback runtime.
- (RT) remains the sole truth for `mission`/`workUnit`/activity/`operationalState` (`src/runtime/projection.ts` `buildLivingOfficePresentation`); (A)+(B) supply only facts absent from (RT); the union join, `UNKNOWN`/`UNASSIGNED` sentinels, provenance+status envelope, and §5 symbolic-content safety are enforced and tested.
- Tests: `tests/contract/organization-registry.test.ts`, `tests/contract/production-render-input.test.ts`, `tests/ui/actor-summary.test.tsx`, `tests/ui/actor-detail-drawer.test.tsx` (exact 17-field §2.7 detail set), `tests/security/scene-source-boundary.test.ts` (no terminal/source/path/credential content in any rendered office field, and the committed data files carry no raw locator/credential). The authenticated 17-field detail drawer is additionally proven end-to-end against the real runtime by `tests/e2e/living-pixel-office.spec.ts`.
- Implementation-review rework (SIR-4): the second untrusted boundary `parseLivingOfficeProductionRenderInput` (§3.1.1/§3.1.2) now performs total runtime validation of the complete nested `CommittedOfficeLayoutConfigV1` — shape/unknown-keys, unique pod/actor ids, closed `AdvisorTeam`/role-category enums, the total role-category map, responsible-Advisor membership (via assembly), and identity/pattern/numerics — before assembly, wrapping every hard failure as the declared `{ok:false, reason, fallbackTier}` and never throwing (hostile-shape + no-throw cases in `tests/contract/production-render-input.test.ts`).
