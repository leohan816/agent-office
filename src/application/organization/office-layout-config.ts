// Agent Office Batch A — committed office layout presentation configuration (contract §3.1, PRC-5).
//
// Presentation configuration ONLY (pod lanes, closed role-category map, project visual identities,
// selection). It carries no mission/WorkUnit/activity/operational state and owns no operational plan;
// it is immutable per reviewed commit (same change control as the (A) registry / (B) evidence).
import type {
  CommittedOfficeLayoutConfigV1,
  PixelProjectIdentity,
} from '../../ui/pixel/contracts.js';

/** Literal committed viewport default (contract §3.1, FDR-1) — used when a wrapper viewport is invalid. */
export const DEFAULT_VIEWPORT = { width: 1280, height: 720 } as const;
/** Literal committed logical-time default (monotonic zero is valid) — used when logicalTimeMs is invalid. */
export const DEFAULT_LOGICAL_TIME_MS = 0 as const;

const FOUNDATION_IDENTITY: PixelProjectIdentity = {
  identityId: 'identity.foundation',
  projectId: 'FOUNDATION',
  displayName: 'Foundation Advisor Team',
  shortLabel: 'FND',
  primaryColor: 0x4a6a8a,
  secondaryColor: 0x8fb0cf,
  glyph: 'F',
  pattern: 'BANDS',
};

const VIBENEWS_IDENTITY: PixelProjectIdentity = {
  identityId: 'identity.vibenews',
  projectId: 'VIBENEWS',
  displayName: 'VibeNews Advisor Team',
  shortLabel: 'VBN',
  primaryColor: 0x8a5a72,
  secondaryColor: 0xcf8fb0,
  glyph: 'V',
  pattern: 'DOTS',
};

const DEFAULT_IDENTITY: PixelProjectIdentity = {
  identityId: 'identity.default',
  projectId: 'GENERIC',
  displayName: 'Registered Team',
  shortLabel: 'REG',
  primaryColor: 0x6a6d70,
  secondaryColor: 0xa2a5a8,
  glyph: '?',
  pattern: 'GRID',
};

/**
 * The committed layout. Pods are declared in ascending `podId` order; `selectedDefaultPodId` equals
 * the first pod. Each renderable pod names exactly one responsible Advisor that must resolve to a
 * single ADVISOR-role registry actor of the matching (non-sentinel) Team who is a pod member.
 */
export const COMMITTED_OFFICE_LAYOUT_CONFIG_V1: CommittedOfficeLayoutConfigV1 = {
  schemaVersion: 'agent-office.committed-office-layout-config.v1',
  pods: [
    {
      // Foundation Advisor Team. After the pre-AS1 identity migration the responsible Advisor is the
      // newly created Foundation Advisor (roleInstanceId `foundation-advisor-20260714-01`). The former
      // `foundation-advisor` roleInstanceId, `agent-office-worker`, and the migrated Reviewer
      // `foundation-reviewer` are now Agent Office Team actors and are no longer Foundation pod
      // members; the pod lists exactly the current Foundation Team registry actors. This is the minimal
      // layout reconciliation needed to keep the composed render valid — no new office pod is introduced.
      podId: 'pod:foundation',
      advisorTeamId: 'FOUNDATION_ADVISOR_TEAM',
      responsibleAdvisorRoleInstanceId: 'foundation-advisor-20260714-01',
      projectKey: 'FOUNDATION',
      podLabel: 'Foundation Advisor Team',
      memberRoleInstanceIds: [
        'foundation-advisor-20260714-01',
        'foundation-control',
        'foundation-designer',
        'foundation-worker',
        'cosmile-worker',
        'siasiu-worker',
        'foundation-reviewer-fable5',
      ],
    },
    {
      podId: 'pod:vibenews',
      advisorTeamId: 'VIBENEWS_ADVISOR_TEAM',
      responsibleAdvisorRoleInstanceId: 'vibenews-advisor',
      projectKey: 'VIBENEWS',
      podLabel: 'VibeNews Advisor Team',
      memberRoleInstanceIds: ['vibenews-advisor', 'vibenews-worker'],
    },
  ],
  selectedDefaultPodId: 'pod:foundation',
  roleCategoryByRole: {
    ADVISOR: 'ADVISOR_ROUTING',
    WORKER: 'WORKER_BUILD',
    REVIEWER: 'INDEPENDENT_REVIEW',
    CONTROL: 'CONTROL_RECOVERY',
    DESIGNER: 'GENERIC_REGISTERED',
    STRATEGY: 'GENERIC_REGISTERED',
  },
  defaultRoleCategory: 'GENERIC_REGISTERED',
  projectIdentityByProject: {
    FOUNDATION: FOUNDATION_IDENTITY,
    VIBENEWS: VIBENEWS_IDENTITY,
  },
  defaultProjectIdentity: DEFAULT_IDENTITY,
};
