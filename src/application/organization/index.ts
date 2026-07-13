// Agent Office Batch A — local/static organization module public surface.
//
// One committed identity/organization registry (A) + committed accepted-evidence (B) join with the
// existing runtime projection (RT) into one final frame (contract §2.5/§3). No live discovery.
export * from './types.js';
export {
  ORGANIZATION_EVIDENCE,
  arbitrateAiRuntimeState,
  dedupeByEvidenceId,
  isAttestationKind,
  isEffectiveValidEvidence,
  isUtcTimestamp,
  recordsFieldIdentical,
  resolveAttestation,
  resolveSessionProcess,
} from './evidence.js';
export {
  ORGANIZATION_REGISTRY,
  normalizeAdvisorTeam,
  normalizeRegistryRole,
  normalizeRegistryText,
  partitionRegistry,
} from './registry.js';
export { mapOperationalState, projectOrganizationFrame } from './projector.js';
export {
  COMMITTED_OFFICE_LAYOUT_CONFIG_V1,
  DEFAULT_LOGICAL_TIME_MS,
  DEFAULT_VIEWPORT,
} from './office-layout-config.js';
export {
  assembleOfficeLayout,
  composeLivingOfficeProductionRenderInput,
  parseLivingOfficeProductionRenderInput,
  parseRawLivingOfficePresentation,
  type OfficeLayoutAssembly,
  type ProductionRenderInputResult,
} from './production-render-input.js';
