// Agent Office Batch A — committed local/static organization registry + accepted-evidence fixture.
//
// This is the committed (A) identity/organization registry and (B) accepted-evidence input for the
// Batch A local/static organization projection (contract §2.1/§2.2/§2.3.1/§3). Batch A performs NO
// live discovery; every fact is a provenance-tagged committed record, changed only by a normal
// reviewed commit. No prototype/synthetic-fixture marker is present (production-safe).
//
// The committed data itself lives in the application module (`src/application/organization/{registry,
// evidence}.ts`) so the core build (`tsconfig.build.json`, rootDir=src) emits it into `dist/core` and
// the loopback runtime can serve it; this repo-root fixture re-exports that single authority so tests
// keep their committed-fixture entry point with no duplicated / split-brain data.
export { ORGANIZATION_EVIDENCE, ORGANIZATION_REGISTRY } from '../src/application/organization/index.js';

import { ORGANIZATION_EVIDENCE, ORGANIZATION_REGISTRY } from '../src/application/organization/index.js';

export const ORGANIZATION_FIXTURE = {
  registry: ORGANIZATION_REGISTRY,
  evidence: ORGANIZATION_EVIDENCE,
} as const;
