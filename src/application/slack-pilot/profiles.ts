// AS1 Multi-Team Slack Pilot — closed two-member profile union and registry-lineage validation.
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_DESIGN.md §3 (closed route
// profiles) and docs/security/AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md §5 (immutable profile
// identity). The exported profile contract is a discriminated union with EXACTLY two members. There is
// no constructor that accepts free-form identity/destination fields, and no lookup by arbitrary string.
// A `switch` with an exhaustive `never` branch selects a profile (design §5.3). The runtime exact
// registry check binds each profile to its committed organization-registry row by immutable join key.
import { DomainError } from '../../contracts/types.js';
import { ORGANIZATION_REGISTRY, partitionRegistry } from '../organization/registry.js';

/** The two — and only two — reviewed profile identities (design §3). */
export const AS1_PROFILE_IDS = ['AGENT_OFFICE_ADVISOR', 'FOUNDATION_ADVISOR'] as const;
export type As1ProfileId = (typeof AS1_PROFILE_IDS)[number];

/** The environment key names that supply a profile's external Slack identity (setup §5, design §3). */
export interface As1ProfileEnvKeys {
  readonly appIdKey: string;
  readonly channelIdKey: string;
  readonly botTokenKey: string;
  readonly appTokenKey: string;
}

/**
 * One immutable closed profile. Every field is a compile-time literal fixed by the reviewed design; no
 * field is derived from Slack, CLI, or environment text. The external Slack workspace/App/channel/Leo
 * IDs are NOT here — they arrive only through the exact-key secret file and the Advisor receive grant.
 */
export interface As1Profile {
  readonly profileId: As1ProfileId;
  readonly profileStateSlug: 'agent-office-advisor' | 'foundation-advisor';
  readonly advisorTeam: 'AGENT_OFFICE_ADVISOR_TEAM' | 'FOUNDATION_ADVISOR_TEAM';
  /** Immutable internal join key (never a physical destination). */
  readonly roleInstanceId: string;
  /** Current routable actor identity. */
  readonly actorId: string;
  readonly role: 'ADVISOR';
  readonly sessionName: string;
  readonly workspace: string;
  readonly currentCommand: 'codex';
  readonly evidenceNamespace: string;
  /** Operator-facing setup labels only — never routing authority (design §3). */
  readonly appDisplayName: string;
  readonly botDisplayName: string;
  readonly env: As1ProfileEnvKeys;
}

const AGENT_OFFICE_ADVISOR_PROFILE: As1Profile = {
  profileId: 'AGENT_OFFICE_ADVISOR',
  profileStateSlug: 'agent-office-advisor',
  advisorTeam: 'AGENT_OFFICE_ADVISOR_TEAM',
  roleInstanceId: 'foundation-advisor',
  actorId: 'agent-office-advisor',
  role: 'ADVISOR',
  sessionName: 'agent-office-advisor',
  workspace: '/home/leo/Project/agent-office',
  currentCommand: 'codex',
  evidenceNamespace: 'agent-office-advisor',
  appDisplayName: 'agent-office-advisor',
  botDisplayName: 'agent-office-advisor',
  env: {
    appIdKey: 'SLACK_AGENT_OFFICE_APP_ID',
    channelIdKey: 'SLACK_AGENT_OFFICE_CHANNEL_ID',
    botTokenKey: 'SLACK_AGENT_OFFICE_BOT_TOKEN',
    appTokenKey: 'SLACK_AGENT_OFFICE_APP_TOKEN',
  },
};

const FOUNDATION_ADVISOR_PROFILE: As1Profile = {
  profileId: 'FOUNDATION_ADVISOR',
  profileStateSlug: 'foundation-advisor',
  advisorTeam: 'FOUNDATION_ADVISOR_TEAM',
  roleInstanceId: 'foundation-advisor-20260714-01',
  actorId: 'foundation-advisor',
  role: 'ADVISOR',
  sessionName: 'foundation-advisor',
  workspace: '/home/leo/Project/FOUNDATION',
  currentCommand: 'codex',
  evidenceNamespace: 'foundation-advisor',
  appDisplayName: 'foundation-advisor',
  botDisplayName: 'foundation-advisor',
  env: {
    appIdKey: 'SLACK_FOUNDATION_APP_ID',
    channelIdKey: 'SLACK_FOUNDATION_CHANNEL_ID',
    botTokenKey: 'SLACK_FOUNDATION_BOT_TOKEN',
    appTokenKey: 'SLACK_FOUNDATION_APP_TOKEN',
  },
};

/**
 * `roleInstanceId: foundation-advisor` is the CONTINUING Agent Office Actor's historical join key. It is
 * forbidden anywhere in Foundation profile state/evidence (security §5.2/§11.3). This constant makes the
 * ban explicit and testable.
 */
export const FOUNDATION_FORBIDDEN_ROLE_INSTANCE_ID = 'foundation-advisor' as const;

/** Exhaustive selector with a `never` default (design §5.3 — required at every adapter boundary). */
export function selectProfile(profileId: As1ProfileId): As1Profile {
  switch (profileId) {
    case 'AGENT_OFFICE_ADVISOR':
      return AGENT_OFFICE_ADVISOR_PROFILE;
    case 'FOUNDATION_ADVISOR':
      return FOUNDATION_ADVISOR_PROFILE;
    default: {
      const exhaustive: never = profileId;
      throw new DomainError('FORBIDDEN_TARGET', `as1 profile is not a reviewed literal: ${String(exhaustive)}`);
    }
  }
}

export function isAs1ProfileId(value: unknown): value is As1ProfileId {
  return typeof value === 'string' && (AS1_PROFILE_IDS as readonly string[]).includes(value);
}

/** Narrow untrusted bytes to a closed profile literal; never build a profile from free text. */
export function assertAs1ProfileId(value: unknown, label = 'profileId'): As1ProfileId {
  if (!isAs1ProfileId(value)) {
    throw new DomainError('FORBIDDEN_TARGET', `${label} is not one of the two reviewed profile literals`);
  }
  return value;
}

/**
 * Runtime exact registry check (security §5.3). Bind the closed profile to its committed
 * organization-registry row by immutable `roleInstanceId` and require actorId/role/team/session/project
 * to match. The Foundation profile additionally may never carry the continuing Actor's historical
 * `foundation-advisor` join key. Fails closed on any mismatch.
 */
export function validateProfileLineage(profile: As1Profile): void {
  if (
    profile.profileId === 'FOUNDATION_ADVISOR' &&
    profile.roleInstanceId === FOUNDATION_FORBIDDEN_ROLE_INSTANCE_ID
  ) {
    throw new DomainError('UNAUTHORIZED_ACTOR', 'foundation profile must not use the historical join key');
  }
  const resolved = partitionRegistry(ORGANIZATION_REGISTRY).rows.get(profile.roleInstanceId);
  if (resolved === undefined) {
    throw new DomainError('UNAUTHORIZED_ACTOR', `profile roleInstanceId is not a resolved registry identity: ${profile.profileId}`);
  }
  const expectedProject = profile.profileId === 'AGENT_OFFICE_ADVISOR' ? 'AGENT_OFFICE' : 'FOUNDATION';
  if (
    resolved.actorId !== profile.actorId ||
    resolved.role !== profile.role ||
    resolved.advisorTeam !== profile.advisorTeam ||
    resolved.sessionName !== profile.sessionName ||
    resolved.project !== expectedProject
  ) {
    throw new DomainError('UNAUTHORIZED_ACTOR', `profile lineage does not match the committed registry row: ${profile.profileId}`);
  }
}

/** Both closed profiles, validated against the registry once. Never a lookup-by-arbitrary-string map. */
export function allAs1Profiles(): readonly As1Profile[] {
  return AS1_PROFILE_IDS.map(selectProfile);
}

// ── Strategy entrypoints (Strategy migration) ────────────────────────────────
// Two closed optional Leo-facing Strategy profiles ADDED ALONGSIDE the unchanged legacy Advisor profiles above.
// A Strategy profile is a separate closed literal set (its own exhaustive `never` selector); it never joins the
// Advisor `As1ProfileId` union, so the legacy Advisor active code path, secret parser, descriptor, and lifecycle
// stay byte-unchanged and usable as rollback. Each Strategy profile REUSES its responsible Advisor's control
// identity (`profileStateSlug`) — isolation comes SOLELY from its own fixed Strategy state root — and delivers to
// its own fixed tmux pane. It may dispatch only to its responsible Advisor; it never implements, reviews, accepts
// risk, selects a destination, or becomes a Team leader.

/** The two — and only two — reviewed Strategy profile identities. */
export const AS1_STRATEGY_PROFILE_IDS = ['AGENT_OFFICE_STRATEGY', 'FOUNDATION_STRATEGY'] as const;
export type As1StrategyProfileId = (typeof AS1_STRATEGY_PROFILE_IDS)[number];

/**
 * One immutable closed Strategy profile. Every field is a compile-time literal fixed by the reviewed handoff; no
 * field is derived from Slack, CLI, or environment text. The external Slack workspace/App/channel/Leo IDs are NOT
 * here — they arrive only through the exact-key Strategy secret file. `profileStateSlug` REUSES the responsible
 * Advisor's control identity; `stateRoot` and `destinationPaneId` are the fixed per-profile isolation/destination.
 */
export interface As1StrategyProfile {
  readonly profileId: As1StrategyProfileId;
  /** Reused responsible-Advisor control identity (never a new control slug); isolation is via `stateRoot` only. */
  readonly profileStateSlug: 'agent-office-advisor' | 'foundation-advisor';
  readonly advisorTeam: 'AGENT_OFFICE_ADVISOR_TEAM' | 'FOUNDATION_ADVISOR_TEAM';
  /** Immutable internal join key = current routable actor identity for the Strategy actor. */
  readonly roleInstanceId: string;
  readonly actorId: string;
  readonly role: 'STRATEGY';
  readonly sessionName: string;
  readonly workspace: string;
  readonly currentCommand: 'codex';
  /** The fixed tmux destination pane this Strategy entrypoint validates at startup and delivers into. */
  readonly destinationPaneId: string;
  /** The fixed Strategy state root — the SOLE source of isolation between the two Strategy routes and from legacy. */
  readonly stateRoot: string;
  readonly evidenceNamespace: string;
  /** Operator-facing setup labels only — never routing authority. */
  readonly appDisplayName: string;
  readonly botDisplayName: string;
  readonly env: As1ProfileEnvKeys;
}

const AGENT_OFFICE_STRATEGY_PROFILE: As1StrategyProfile = {
  profileId: 'AGENT_OFFICE_STRATEGY',
  profileStateSlug: 'agent-office-advisor',
  advisorTeam: 'AGENT_OFFICE_ADVISOR_TEAM',
  roleInstanceId: 'agent-office-strategy-sol',
  actorId: 'agent-office-strategy-sol',
  role: 'STRATEGY',
  sessionName: 'agent-office-strategy-sol',
  workspace: '/home/leo/Project/agent-office',
  currentCommand: 'codex',
  destinationPaneId: '%48',
  stateRoot: '/home/leo/.local/state/agent-office/strategy-agent-office-v1',
  evidenceNamespace: 'agent-office-strategy',
  appDisplayName: 'agent-office-strategy',
  botDisplayName: 'agent-office-strategy',
  env: {
    appIdKey: 'SLACK_AGENT_OFFICE_STRATEGY_APP_ID',
    channelIdKey: 'SLACK_AGENT_OFFICE_STRATEGY_CHANNEL_ID',
    botTokenKey: 'SLACK_AGENT_OFFICE_STRATEGY_BOT_TOKEN',
    appTokenKey: 'SLACK_AGENT_OFFICE_STRATEGY_APP_TOKEN',
  },
};

const FOUNDATION_STRATEGY_PROFILE: As1StrategyProfile = {
  profileId: 'FOUNDATION_STRATEGY',
  profileStateSlug: 'foundation-advisor',
  advisorTeam: 'FOUNDATION_ADVISOR_TEAM',
  roleInstanceId: 'foundation-strategy-sol',
  actorId: 'foundation-strategy-sol',
  role: 'STRATEGY',
  sessionName: 'foundation-strategy-sol',
  workspace: '/home/leo/Project/FOUNDATION',
  currentCommand: 'codex',
  destinationPaneId: '%31',
  stateRoot: '/home/leo/.local/state/agent-office/strategy-foundation-v1',
  evidenceNamespace: 'foundation-strategy',
  appDisplayName: 'foundation-strategy',
  botDisplayName: 'foundation-strategy',
  env: {
    appIdKey: 'SLACK_FOUNDATION_STRATEGY_APP_ID',
    channelIdKey: 'SLACK_FOUNDATION_STRATEGY_CHANNEL_ID',
    botTokenKey: 'SLACK_FOUNDATION_STRATEGY_BOT_TOKEN',
    appTokenKey: 'SLACK_FOUNDATION_STRATEGY_APP_TOKEN',
  },
};

/** Exhaustive Strategy selector with a `never` default. Never builds a profile from free text. */
export function selectStrategyProfile(profileId: As1StrategyProfileId): As1StrategyProfile {
  switch (profileId) {
    case 'AGENT_OFFICE_STRATEGY':
      return AGENT_OFFICE_STRATEGY_PROFILE;
    case 'FOUNDATION_STRATEGY':
      return FOUNDATION_STRATEGY_PROFILE;
    default: {
      const exhaustive: never = profileId;
      throw new DomainError('FORBIDDEN_TARGET', `as1 strategy profile is not a reviewed literal: ${String(exhaustive)}`);
    }
  }
}

export function isAs1StrategyProfileId(value: unknown): value is As1StrategyProfileId {
  return typeof value === 'string' && (AS1_STRATEGY_PROFILE_IDS as readonly string[]).includes(value);
}

/** Narrow untrusted bytes to a closed Strategy profile literal; never build a profile from free text. */
export function assertAs1StrategyProfileId(value: unknown, label = 'strategyProfileId'): As1StrategyProfileId {
  if (!isAs1StrategyProfileId(value)) {
    throw new DomainError('FORBIDDEN_TARGET', `${label} is not one of the two reviewed Strategy profile literals`);
  }
  return value;
}

/**
 * Runtime exact registry check for a Strategy profile. Bind the closed profile to its committed
 * organization-registry row by immutable `roleInstanceId` and require actorId/role/team/session/project to match.
 * Fails closed on any mismatch. Mirrors `validateProfileLineage` for the Advisor profiles.
 */
export function validateStrategyProfileLineage(profile: As1StrategyProfile): void {
  const resolved = partitionRegistry(ORGANIZATION_REGISTRY).rows.get(profile.roleInstanceId);
  if (resolved === undefined) {
    throw new DomainError('UNAUTHORIZED_ACTOR', `strategy profile roleInstanceId is not a resolved registry identity: ${profile.profileId}`);
  }
  const expectedProject = profile.profileId === 'AGENT_OFFICE_STRATEGY' ? 'AGENT_OFFICE' : 'FOUNDATION';
  if (
    resolved.actorId !== profile.actorId ||
    resolved.role !== profile.role ||
    resolved.advisorTeam !== profile.advisorTeam ||
    resolved.sessionName !== profile.sessionName ||
    resolved.project !== expectedProject
  ) {
    throw new DomainError('UNAUTHORIZED_ACTOR', `strategy profile lineage does not match the committed registry row: ${profile.profileId}`);
  }
}

/** Both closed Strategy profiles, validated against the registry once. Never a lookup-by-arbitrary-string map. */
export function allStrategyProfiles(): readonly As1StrategyProfile[] {
  return AS1_STRATEGY_PROFILE_IDS.map(selectStrategyProfile);
}
