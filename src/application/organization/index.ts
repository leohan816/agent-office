// Agent Office Batch A — local/static organization module public surface.
//
// One committed identity/organization registry (A) + committed accepted-evidence (B) join with the
// existing runtime projection (RT) into one final frame (contract §2.5/§3). No live discovery.
export * from './types.js';
export {
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
  normalizeAdvisorTeam,
  normalizeRegistryRole,
  normalizeRegistryText,
  partitionRegistry,
} from './registry.js';
export { mapOperationalState, projectOrganizationFrame } from './projector.js';
