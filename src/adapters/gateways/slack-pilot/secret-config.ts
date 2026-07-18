// AS1 Multi-Team Slack Pilot — strict external secret-file parser and redacted projection.
//
// Canonical design: docs/integration/AGENT_OFFICE_AS1_MULTI_TEAM_SLACK_DESIGN.md §5.1 (filesystem gate +
// data grammar), docs/security/AGENT_OFFICE_AS1_SLACK_SECURITY_AUTHORITY_MODEL.md §4.1/§6.3 (owner
// boundary + token handling), docs/operations/AGENT_OFFICE_AS1_SLACK_SETUP.md §5/§6 (external file +
// redacted check). The file crosses the owner filesystem trust boundary; type, UID, modes, no-follow
// open, bounded size, double-stat, and exact data grammar are SECURITY checks. The file is parsed as
// data only — never `source`, `eval`, a shell, dotenv expansion, or a `process.env` merge. No token,
// prefix, length, or hash is ever echoed: errors name only a key/field category and a stable reason.
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import path from 'node:path';

import { DomainError } from '../../../contracts/types.js';
import { isNodeError } from '../../../persistence/file-store/path-safety.js';
import { LIMITS, SLACK_ID_GRAMMARS, TOKEN_GRAMMARS } from '../../../application/slack-pilot/contracts.js';
import {
  AS1_PROFILE_IDS,
  AS1_STRATEGY_PROFILE_IDS,
  selectProfile,
  selectStrategyProfile,
  type As1ProfileId,
  type As1StrategyProfileId,
} from '../../../application/slack-pilot/profiles.js';

/** The sole planned secret path (setup §5). Overridable only by the operator via `--env-file`. */
export const DEFAULT_SECRET_FILE_PATH = '/home/leo/.config/agent-office/as1-slack-pilot.env';

/** The only accepted Slack user is Leo (setup §4). */
export const APPROVED_LEO_USER_ID = 'U0BD3523C1F';

/** Exactly the ten template keys (setup §2; config/slack/as1-slack-pilot.env.example). */
const SECRET_KEYS = [
  'SLACK_WORKSPACE_ID',
  'SLACK_LEO_USER_ID',
  'SLACK_AGENT_OFFICE_APP_ID',
  'SLACK_AGENT_OFFICE_CHANNEL_ID',
  'SLACK_AGENT_OFFICE_BOT_TOKEN',
  'SLACK_AGENT_OFFICE_APP_TOKEN',
  'SLACK_FOUNDATION_APP_ID',
  'SLACK_FOUNDATION_CHANNEL_ID',
  'SLACK_FOUNDATION_BOT_TOKEN',
  'SLACK_FOUNDATION_APP_TOKEN',
] as const;

const LINE = /^([A-Z][A-Z0-9_]*)=([!-~]+)$/u;

/** Per-profile Slack identity resolved from the file (App/channel IDs are non-secret but redacted). */
export interface As1ProfileSecret {
  readonly appId: string;
  readonly channelId: string;
  /** Opaque bearer material — never logged, hashed for display, copied to state, or serialized. */
  readonly botToken: string;
  readonly appToken: string;
}

/**
 * The setup §6 redacted-check projection. Contains no token, raw ID, prefix, length, or hash. Every status is
 * scoped to LOCAL SYNTAX / GRAMMAR validation of the owner-only file — this command performs NO live identity
 * proof (no auth.test, bots.info, or Socket hello pairing), so it never claims network verification (review B09).
 */
export interface As1RedactedCheckReport {
  readonly scope: 'LOCAL_SYNTAX_ONLY';
  readonly configFile: 'VALID_OWNER_ONLY';
  readonly keySet: 'EXACT';
  readonly workspace: 'GRAMMAR_VALID_REDACTED';
  readonly leoUser: 'GRAMMAR_MATCHES_APPROVED_ID';
  readonly agentOfficeProfile: 'GRAMMAR_VALID_REDACTED';
  readonly foundationProfile: 'GRAMMAR_VALID_REDACTED';
  readonly profileSeparation: 'LOCAL_DISTINCT';
  readonly tokens: 'PRESENT_AND_REDACTED';
  readonly liveIdentityProof: 'NOT_PERFORMED';
  readonly result: 'LOCAL_SYNTAX_PASS';
}

/**
 * A parsed, validated secret config. Holds bearer tokens in memory for the client slots but never exposes
 * them to any diagnostic surface. `redactedProjection()`/`renderRedactedCheck()` are the only allowed
 * outputs. Tokens are accessed only by the narrow Slack clients through `secretFor()`.
 */
export class As1SecretConfig {
  private readonly profiles: ReadonlyMap<As1ProfileId, As1ProfileSecret>;

  private constructor(
    private readonly workspaceId: string,
    private readonly leoUserId: string,
    profiles: ReadonlyMap<As1ProfileId, As1ProfileSecret>,
  ) {
    this.profiles = profiles;
  }

  public getWorkspaceId(): string {
    return this.workspaceId;
  }

  public getLeoUserId(): string {
    return this.leoUserId;
  }

  /** Secret material for one closed profile slot. Callers must never log or persist the tokens. */
  public secretFor(profileId: As1ProfileId): As1ProfileSecret {
    const secret = this.profiles.get(profileId);
    if (secret === undefined) {
      throw new DomainError('FORBIDDEN_TARGET', 'requested secret for a non-reviewed profile');
    }
    return secret;
  }

  public redactedProjection(): As1RedactedCheckReport {
    return {
      scope: 'LOCAL_SYNTAX_ONLY',
      configFile: 'VALID_OWNER_ONLY',
      keySet: 'EXACT',
      workspace: 'GRAMMAR_VALID_REDACTED',
      leoUser: 'GRAMMAR_MATCHES_APPROVED_ID',
      agentOfficeProfile: 'GRAMMAR_VALID_REDACTED',
      foundationProfile: 'GRAMMAR_VALID_REDACTED',
      profileSeparation: 'LOCAL_DISTINCT',
      tokens: 'PRESENT_AND_REDACTED',
      liveIdentityProof: 'NOT_PERFORMED',
      result: 'LOCAL_SYNTAX_PASS',
    };
  }

  /** The exact successful text block (setup §6). Deterministic and secret-free; LOCAL SYNTAX only (review B09). */
  public renderRedactedCheck(): string {
    const report = this.redactedProjection();
    return [
      'AS1_SLACK_REDACTED_CHECK',
      `SCOPE: ${report.scope}`,
      `CONFIG_FILE: ${report.configFile}`,
      `KEY_SET: ${report.keySet}`,
      `WORKSPACE: ${report.workspace}`,
      `LEO_USER: ${report.leoUser}`,
      `AGENT_OFFICE_PROFILE: ${report.agentOfficeProfile}`,
      `FOUNDATION_PROFILE: ${report.foundationProfile}`,
      `PROFILE_SEPARATION: ${report.profileSeparation}`,
      `TOKENS: ${report.tokens}`,
      `LIVE_IDENTITY_PROOF: ${report.liveIdentityProof}`,
      `RESULT: ${report.result}`,
      'NOTE: local syntax validation only — NOT a live identity proof (no auth.test/bots.info/Socket hello).',
    ].join('\n');
  }

  public static fromValidatedValues(values: ReadonlyMap<string, string>): As1SecretConfig {
    const workspaceId = requireGrammar(values, 'SLACK_WORKSPACE_ID', SLACK_ID_GRAMMARS.workspaceId);
    const leoUserId = requireGrammar(values, 'SLACK_LEO_USER_ID', SLACK_ID_GRAMMARS.userId);
    if (leoUserId !== APPROVED_LEO_USER_ID) {
      throw new DomainError('UNAUTHORIZED_ACTOR', 'SLACK_LEO_USER_ID is not the approved Leo user');
    }
    const profiles = new Map<As1ProfileId, As1ProfileSecret>();
    for (const profileId of AS1_PROFILE_IDS) {
      const profile = selectProfile(profileId);
      profiles.set(profileId, {
        appId: requireGrammar(values, profile.env.appIdKey, SLACK_ID_GRAMMARS.appId),
        channelId: requireGrammar(values, profile.env.channelIdKey, SLACK_ID_GRAMMARS.channelId),
        botToken: requireGrammar(values, profile.env.botTokenKey, TOKEN_GRAMMARS.botToken),
        appToken: requireGrammar(values, profile.env.appTokenKey, TOKEN_GRAMMARS.appToken),
      });
    }
    assertProfileSeparation(profiles);
    return new As1SecretConfig(workspaceId, leoUserId, profiles);
  }
}

function requireGrammar(values: ReadonlyMap<string, string>, key: string, pattern: RegExp): string {
  const value = values.get(key);
  if (value === undefined || !pattern.test(value)) {
    // Never echo the value — only the key name and a stable reason.
    throw new DomainError('INVALID_SCHEMA', `secret value for ${key} does not match its required grammar`);
  }
  return value;
}

/**
 * The two profiles must have different App IDs, channel IDs, bot tokens, and app tokens (security §6.2).
 * Any equality is a configuration-integrity failure. Compared by exact bytes; never displayed.
 */
function assertProfileSeparation(profiles: ReadonlyMap<As1ProfileId, As1ProfileSecret>): void {
  const agentOffice = profiles.get('AGENT_OFFICE_ADVISOR');
  const foundation = profiles.get('FOUNDATION_ADVISOR');
  if (agentOffice === undefined || foundation === undefined) {
    throw new DomainError('INVALID_SCHEMA', 'secret config is missing a closed profile');
  }
  if (
    agentOffice.appId === foundation.appId ||
    agentOffice.channelId === foundation.channelId ||
    agentOffice.botToken === foundation.botToken ||
    agentOffice.appToken === foundation.appToken
  ) {
    throw new DomainError('FORBIDDEN_TARGET', 'the two profiles must not share App ID, channel ID, or tokens');
  }
}

/** Reject the raw bytes on any non-data grammar violation (design §5.1 step 5). */
function parseSecretText(text: string): ReadonlyMap<string, string> {
  if (text.charCodeAt(0) === 0xfeff) {
    throw new DomainError('INVALID_SCHEMA', 'secret file must not begin with a BOM');
  }
  if (text.includes('\0')) {
    throw new DomainError('INVALID_SCHEMA', 'secret file must not contain NUL');
  }
  if (text.includes('\r')) {
    throw new DomainError('INVALID_SCHEMA', 'secret file must not contain CR');
  }
  const body = text.endsWith('\n') ? text.slice(0, -1) : text;
  const lines = body.split('\n');
  const values = new Map<string, string>();
  for (const line of lines) {
    if (line.length === 0) {
      throw new DomainError('INVALID_SCHEMA', 'secret file must not contain a blank line');
    }
    if (line.startsWith('#')) {
      throw new DomainError('INVALID_SCHEMA', 'secret file must not contain a comment');
    }
    if (line.startsWith('export ')) {
      throw new DomainError('INVALID_SCHEMA', 'secret file must not use export syntax');
    }
    const match = LINE.exec(line);
    if (match === null) {
      throw new DomainError('INVALID_SCHEMA', 'secret file line is not an exact KEY=VALUE data pair');
    }
    const key = match[1];
    const rawValue = match[2];
    if (key === undefined || rawValue === undefined) {
      throw new DomainError('INVALID_SCHEMA', 'secret file line failed to parse');
    }
    if (rawValue.includes('$') || rawValue.includes('"') || rawValue.includes("'") || rawValue.includes('`')) {
      throw new DomainError('INVALID_SCHEMA', `secret value for ${key} must not use quoting or interpolation`);
    }
    if (!(SECRET_KEYS as readonly string[]).includes(key)) {
      throw new DomainError('UNKNOWN_FIELD', `secret file contains an unknown key: ${key}`);
    }
    if (values.has(key)) {
      throw new DomainError('INVALID_SCHEMA', `secret file contains a duplicate key: ${key}`);
    }
    values.set(key, rawValue);
  }
  const missing = SECRET_KEYS.filter((key) => !values.has(key));
  if (missing.length > 0) {
    throw new DomainError('INVALID_SCHEMA', `secret file is missing a required key: ${missing[0] ?? 'unknown'}`);
  }
  if (values.size !== SECRET_KEYS.length) {
    throw new DomainError('INVALID_SCHEMA', 'secret file does not contain exactly the ten required keys');
  }
  return values;
}

/** Owner-only filesystem gate + double-stat + strict data grammar (design §5.1). */
export async function parseSecretConfigFile(filePath: string): Promise<As1SecretConfig> {
  if (!path.isAbsolute(filePath)) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'secret file path must be absolute');
  }
  await assertOwnerOnlyParentDirectory(path.dirname(filePath));

  const handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK).catch(() => {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'secret file could not be opened with no-follow semantics');
  });
  try {
    const before = await handle.stat({ bigint: false });
    assertOwnerOnlyRegularFile(before, 'secret file');
    if (before.size > LIMITS.SECRET_FILE_MAX_BYTES) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'secret file exceeds its 32 KiB bound');
    }
    const bytes = await handle.readFile();
    // Double-stat: re-check the still-open descriptor to defeat a check/use swap.
    const after = await handle.stat({ bigint: false });
    if (
      after.ino !== before.ino ||
      after.dev !== before.dev ||
      after.uid !== before.uid ||
      after.mode !== before.mode ||
      after.size !== before.size ||
      after.size !== bytes.byteLength
    ) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'secret file changed identity during read');
    }
    let text: string;
    try {
      // ignoreBOM keeps a leading U+FEFF in the output so the explicit BOM check below can reject it.
      text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch {
      throw new DomainError('INVALID_SCHEMA', 'secret file is not valid UTF-8');
    }
    // Reject remaining C0/C1 control characters (newline handled by the line split; CR already rejected).
    for (const line of text.split('\n')) {
      for (const ch of line) {
        const code = ch.codePointAt(0) ?? 0;
        if (code < 0x20 || code === 0x7f) {
          throw new DomainError('INVALID_SCHEMA', 'secret file contains a control character');
        }
      }
    }
    return As1SecretConfig.fromValidatedValues(parseSecretText(text));
  } finally {
    await handle.close();
  }
}

async function assertOwnerOnlyParentDirectory(directory: string): Promise<void> {
  const handle = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW).catch(
    (error: unknown) => {
      if (isNodeError(error, 'ELOOP') || isNodeError(error, 'ENOTDIR')) {
        throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'secret parent directory is not a real non-symlink directory');
      }
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'secret parent directory could not be opened');
    },
  );
  try {
    const info = await handle.stat({ bigint: false });
    const currentUid = process.getuid?.();
    if (!info.isDirectory()) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'secret parent is not a directory');
    }
    if (currentUid !== undefined && info.uid !== currentUid) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'secret parent directory is not owned by the runtime user');
    }
    if ((info.mode & 0o777) !== 0o700) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'secret parent directory mode is not exactly 0700');
    }
  } finally {
    await handle.close();
  }
}

interface StatLike {
  isFile(): boolean;
  readonly uid: number;
  readonly mode: number;
  readonly size: number;
}

function assertOwnerOnlyRegularFile(info: StatLike, label: string): void {
  const currentUid = process.getuid?.();
  if (!info.isFile()) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', `${label} is not a regular file`);
  }
  if (currentUid !== undefined && info.uid !== currentUid) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', `${label} is not owned by the runtime user`);
  }
  if ((info.mode & 0o777) !== 0o600) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', `${label} mode is not exactly 0600`);
  }
}

// ── Strategy secret config (Strategy migration) ──────────────────────────────
// A DEDICATED exact-key parser for the two Strategy Slack entrypoints, ADDED ALONGSIDE the unchanged legacy
// `As1SecretConfig`/`parseSecretConfigFile`/`parseSecretText` above (which stay byte-for-byte usable as rollback). It
// reuses the same owner-only filesystem gate helpers, grammar constants, and line grammar, but binds a DIFFERENT
// fixed path and a DIFFERENT closed ten-key set. The file is parsed as data only — never sourced/eval'd/dotenv-merged —
// and no token, prefix, length, or hash is ever echoed: errors name only a key/field category and a stable reason.

/** The sole planned Strategy secret path (handoff). Parsed as exact-key data only; never sourced/eval'd. */
export const DEFAULT_STRATEGY_SECRET_FILE_PATH = '/home/leo/.config/agent-office/strategy-slack-apps.env';

/** Exactly the ten Strategy template keys (handoff). */
const STRATEGY_SECRET_KEYS = [
  'SLACK_WORKSPACE_ID',
  'SLACK_LEO_USER_ID',
  'SLACK_AGENT_OFFICE_STRATEGY_APP_ID',
  'SLACK_AGENT_OFFICE_STRATEGY_CHANNEL_ID',
  'SLACK_AGENT_OFFICE_STRATEGY_BOT_TOKEN',
  'SLACK_AGENT_OFFICE_STRATEGY_APP_TOKEN',
  'SLACK_FOUNDATION_STRATEGY_APP_ID',
  'SLACK_FOUNDATION_STRATEGY_CHANNEL_ID',
  'SLACK_FOUNDATION_STRATEGY_BOT_TOKEN',
  'SLACK_FOUNDATION_STRATEGY_APP_TOKEN',
] as const;

/** The setup redacted-check projection for the Strategy secret file. Contains no token, raw ID, prefix, length, or hash. */
export interface As1StrategyRedactedCheckReport {
  readonly scope: 'LOCAL_SYNTAX_ONLY';
  readonly configFile: 'VALID_OWNER_ONLY';
  readonly keySet: 'EXACT';
  readonly workspace: 'GRAMMAR_VALID_REDACTED';
  readonly leoUser: 'GRAMMAR_MATCHES_APPROVED_ID';
  readonly agentOfficeStrategyProfile: 'GRAMMAR_VALID_REDACTED';
  readonly foundationStrategyProfile: 'GRAMMAR_VALID_REDACTED';
  readonly profileSeparation: 'LOCAL_DISTINCT';
  readonly tokens: 'PRESENT_AND_REDACTED';
  readonly liveIdentityProof: 'NOT_PERFORMED';
  readonly result: 'LOCAL_SYNTAX_PASS';
}

/**
 * A parsed, validated Strategy secret config. Holds bearer tokens in memory for the client slots but never exposes
 * them to any diagnostic surface. `redactedProjection()`/`renderRedactedCheck()` are the only allowed outputs.
 * Tokens are accessed only by the narrow Slack clients through `secretFor()`.
 */
export class As1StrategySecretConfig {
  private readonly profiles: ReadonlyMap<As1StrategyProfileId, As1ProfileSecret>;

  private constructor(
    private readonly workspaceId: string,
    private readonly leoUserId: string,
    profiles: ReadonlyMap<As1StrategyProfileId, As1ProfileSecret>,
  ) {
    this.profiles = profiles;
  }

  public getWorkspaceId(): string {
    return this.workspaceId;
  }

  public getLeoUserId(): string {
    return this.leoUserId;
  }

  /** Secret material for one closed Strategy profile slot. Callers must never log or persist the tokens. */
  public secretFor(profileId: As1StrategyProfileId): As1ProfileSecret {
    const secret = this.profiles.get(profileId);
    if (secret === undefined) {
      throw new DomainError('FORBIDDEN_TARGET', 'requested secret for a non-reviewed strategy profile');
    }
    return secret;
  }

  public redactedProjection(): As1StrategyRedactedCheckReport {
    return {
      scope: 'LOCAL_SYNTAX_ONLY',
      configFile: 'VALID_OWNER_ONLY',
      keySet: 'EXACT',
      workspace: 'GRAMMAR_VALID_REDACTED',
      leoUser: 'GRAMMAR_MATCHES_APPROVED_ID',
      agentOfficeStrategyProfile: 'GRAMMAR_VALID_REDACTED',
      foundationStrategyProfile: 'GRAMMAR_VALID_REDACTED',
      profileSeparation: 'LOCAL_DISTINCT',
      tokens: 'PRESENT_AND_REDACTED',
      liveIdentityProof: 'NOT_PERFORMED',
      result: 'LOCAL_SYNTAX_PASS',
    };
  }

  /** The exact successful text block. Deterministic and secret-free; LOCAL SYNTAX only. */
  public renderRedactedCheck(): string {
    const report = this.redactedProjection();
    return [
      'AS1_STRATEGY_SLACK_REDACTED_CHECK',
      `SCOPE: ${report.scope}`,
      `CONFIG_FILE: ${report.configFile}`,
      `KEY_SET: ${report.keySet}`,
      `WORKSPACE: ${report.workspace}`,
      `LEO_USER: ${report.leoUser}`,
      `AGENT_OFFICE_STRATEGY_PROFILE: ${report.agentOfficeStrategyProfile}`,
      `FOUNDATION_STRATEGY_PROFILE: ${report.foundationStrategyProfile}`,
      `PROFILE_SEPARATION: ${report.profileSeparation}`,
      `TOKENS: ${report.tokens}`,
      `LIVE_IDENTITY_PROOF: ${report.liveIdentityProof}`,
      `RESULT: ${report.result}`,
      'NOTE: local syntax validation only — NOT a live identity proof (no auth.test/bots.info/Socket hello).',
    ].join('\n');
  }

  public static fromValidatedValues(values: ReadonlyMap<string, string>): As1StrategySecretConfig {
    const workspaceId = requireGrammar(values, 'SLACK_WORKSPACE_ID', SLACK_ID_GRAMMARS.workspaceId);
    const leoUserId = requireGrammar(values, 'SLACK_LEO_USER_ID', SLACK_ID_GRAMMARS.userId);
    if (leoUserId !== APPROVED_LEO_USER_ID) {
      throw new DomainError('UNAUTHORIZED_ACTOR', 'SLACK_LEO_USER_ID is not the approved Leo user');
    }
    const profiles = new Map<As1StrategyProfileId, As1ProfileSecret>();
    for (const profileId of AS1_STRATEGY_PROFILE_IDS) {
      const profile = selectStrategyProfile(profileId);
      profiles.set(profileId, {
        appId: requireGrammar(values, profile.env.appIdKey, SLACK_ID_GRAMMARS.appId),
        channelId: requireGrammar(values, profile.env.channelIdKey, SLACK_ID_GRAMMARS.channelId),
        botToken: requireGrammar(values, profile.env.botTokenKey, TOKEN_GRAMMARS.botToken),
        appToken: requireGrammar(values, profile.env.appTokenKey, TOKEN_GRAMMARS.appToken),
      });
    }
    assertStrategyProfileSeparation(profiles);
    return new As1StrategySecretConfig(workspaceId, leoUserId, profiles);
  }
}

/**
 * The two Strategy profiles must have different App IDs, channel IDs, bot tokens, and app tokens. Any equality is a
 * configuration-integrity failure. Compared by exact bytes; never displayed.
 */
function assertStrategyProfileSeparation(profiles: ReadonlyMap<As1StrategyProfileId, As1ProfileSecret>): void {
  const agentOffice = profiles.get('AGENT_OFFICE_STRATEGY');
  const foundation = profiles.get('FOUNDATION_STRATEGY');
  if (agentOffice === undefined || foundation === undefined) {
    throw new DomainError('INVALID_SCHEMA', 'strategy secret config is missing a closed profile');
  }
  if (
    agentOffice.appId === foundation.appId ||
    agentOffice.channelId === foundation.channelId ||
    agentOffice.botToken === foundation.botToken ||
    agentOffice.appToken === foundation.appToken
  ) {
    throw new DomainError('FORBIDDEN_TARGET', 'the two strategy profiles must not share App ID, channel ID, or tokens');
  }
}

/** Reject the raw bytes on any non-data grammar violation. Mirrors `parseSecretText` for the Strategy key set. */
function parseStrategySecretText(text: string): ReadonlyMap<string, string> {
  if (text.charCodeAt(0) === 0xfeff) {
    throw new DomainError('INVALID_SCHEMA', 'strategy secret file must not begin with a BOM');
  }
  if (text.includes('\0')) {
    throw new DomainError('INVALID_SCHEMA', 'strategy secret file must not contain NUL');
  }
  if (text.includes('\r')) {
    throw new DomainError('INVALID_SCHEMA', 'strategy secret file must not contain CR');
  }
  const body = text.endsWith('\n') ? text.slice(0, -1) : text;
  const lines = body.split('\n');
  const values = new Map<string, string>();
  for (const line of lines) {
    if (line.length === 0) {
      throw new DomainError('INVALID_SCHEMA', 'strategy secret file must not contain a blank line');
    }
    if (line.startsWith('#')) {
      throw new DomainError('INVALID_SCHEMA', 'strategy secret file must not contain a comment');
    }
    if (line.startsWith('export ')) {
      throw new DomainError('INVALID_SCHEMA', 'strategy secret file must not use export syntax');
    }
    const match = LINE.exec(line);
    if (match === null) {
      throw new DomainError('INVALID_SCHEMA', 'strategy secret file line is not an exact KEY=VALUE data pair');
    }
    const key = match[1];
    const rawValue = match[2];
    if (key === undefined || rawValue === undefined) {
      throw new DomainError('INVALID_SCHEMA', 'strategy secret file line failed to parse');
    }
    if (rawValue.includes('$') || rawValue.includes('"') || rawValue.includes("'") || rawValue.includes('`')) {
      throw new DomainError('INVALID_SCHEMA', `strategy secret value for ${key} must not use quoting or interpolation`);
    }
    if (!(STRATEGY_SECRET_KEYS as readonly string[]).includes(key)) {
      throw new DomainError('UNKNOWN_FIELD', `strategy secret file contains an unknown key: ${key}`);
    }
    if (values.has(key)) {
      throw new DomainError('INVALID_SCHEMA', `strategy secret file contains a duplicate key: ${key}`);
    }
    values.set(key, rawValue);
  }
  const missing = STRATEGY_SECRET_KEYS.filter((key) => !values.has(key));
  if (missing.length > 0) {
    throw new DomainError('INVALID_SCHEMA', `strategy secret file is missing a required key: ${missing[0] ?? 'unknown'}`);
  }
  if (values.size !== STRATEGY_SECRET_KEYS.length) {
    throw new DomainError('INVALID_SCHEMA', 'strategy secret file does not contain exactly the ten required keys');
  }
  return values;
}

/**
 * Owner-only filesystem gate + double-stat + strict data grammar for the Strategy secret file. Mirrors
 * `parseSecretConfigFile`, reusing the same owner-only stat helpers, and leaves the legacy parser byte-unchanged.
 */
export async function parseStrategySecretConfigFile(filePath: string): Promise<As1StrategySecretConfig> {
  if (!path.isAbsolute(filePath)) {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'strategy secret file path must be absolute');
  }
  await assertOwnerOnlyParentDirectory(path.dirname(filePath));

  const handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK).catch(() => {
    throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'strategy secret file could not be opened with no-follow semantics');
  });
  try {
    const before = await handle.stat({ bigint: false });
    assertOwnerOnlyRegularFile(before, 'strategy secret file');
    if (before.size > LIMITS.SECRET_FILE_MAX_BYTES) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'strategy secret file exceeds its 32 KiB bound');
    }
    const bytes = await handle.readFile();
    // Double-stat: re-check the still-open descriptor to defeat a check/use swap.
    const after = await handle.stat({ bigint: false });
    if (
      after.ino !== before.ino ||
      after.dev !== before.dev ||
      after.uid !== before.uid ||
      after.mode !== before.mode ||
      after.size !== before.size ||
      after.size !== bytes.byteLength
    ) {
      throw new DomainError('AUTHORITY_ARTIFACT_INVALID', 'strategy secret file changed identity during read');
    }
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch {
      throw new DomainError('INVALID_SCHEMA', 'strategy secret file is not valid UTF-8');
    }
    // Reject remaining C0/C1 control characters (newline handled by the line split; CR already rejected).
    for (const line of text.split('\n')) {
      for (const ch of line) {
        const code = ch.codePointAt(0) ?? 0;
        if (code < 0x20 || code === 0x7f) {
          throw new DomainError('INVALID_SCHEMA', 'strategy secret file contains a control character');
        }
      }
    }
    return As1StrategySecretConfig.fromValidatedValues(parseStrategySecretText(text));
  } finally {
    await handle.close();
  }
}
