// AS1 Slack Pilot — synthetic Phase A fixtures and fake ports. Contains ONLY placeholder IDs/tokens.
// No real Slack workspace/App/channel/user ID or token appears here. No real network or tmux mutation is
// reachable through any fake (design §19; security §19). Every fake fails closed on an attempted real
// side effect.
import { chmod, mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { AgentOfficeRuntimeIdentity } from '../../src/runtime/identity.js';
import { uuidV7 } from './fixtures.js';

/** Deterministic, advanceable trusted-local clock + UUIDv7 source for AS1 synthetic tests. */
export class FakeClock implements AgentOfficeRuntimeIdentity {
  private ms: number;
  private seq = 0;

  public constructor(startIso: string) {
    this.ms = Date.parse(startIso);
  }

  public now(): string {
    return new Date(this.ms).toISOString();
  }

  public nextId(): string {
    this.seq += 1;
    return uuidV7(this.seq);
  }

  public advanceMs(delta: number): void {
    this.ms += delta;
  }

  public setIso(iso: string): void {
    this.ms = Date.parse(iso);
  }
}

const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;
const HASH_C = `sha256:${'c'.repeat(64)}`;
const HASH_D = `sha256:${'d'.repeat(64)}`;
const HASH_E = `sha256:${'e'.repeat(64)}`;
const HASH_F = `sha256:${'f'.repeat(64)}`;
const HASH_1 = `sha256:${'1'.repeat(64)}`;
const HASH_2 = `sha256:${'2'.repeat(64)}`;
const HASH_3 = `sha256:${'3'.repeat(64)}`;
const HASH_4 = `sha256:${'4'.repeat(64)}`;

export const APPROVED_LEO_USER_ID = 'U0BD3523C1F';

/** A valid pre-event receive grant record for the Agent Office profile (plain object; mutate freely). */
export function validReceiveGrant(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 'agent-office.as1-pilot-receive-grant.v1',
    receiveGrantId: 'as1-receive-grant-0001',
    pilotId: 'as1-pilot-0001',
    profileId: 'AGENT_OFFICE_ADVISOR',
    workspaceId: 'TWORKSPACE001',
    appId: 'AAGENTOFFICE01',
    channelId: 'CAGENTOFFICE01',
    leoUserId: APPROVED_LEO_USER_ID,
    profileStateRootRef: 'indexes/as1-slack-pilot/profiles/agent-office-advisor',
    profileStateRootHash: HASH_A,
    rootLimit: 1,
    conversationLimit: 1,
    governanceSnapshotHash: HASH_B,
    registrySnapshotHash: HASH_C,
    ownerSetupGateHash: HASH_D,
    implementationReviewGateHash: HASH_E,
    globalControlSnapshotHash: HASH_F,
    profileLatchSnapshotHash: HASH_1,
    authorityRepositoryId: 'agent-office',
    authorityRootId: 'advisor-jobs-root',
    authoritySourceCommit: 'a'.repeat(40),
    issuedAt: '2026-07-14T22:00:00.000Z',
    expiresAt: '2026-07-14T22:10:00.000Z',
    ...overrides,
  };
}

/** A valid post-intake pointer-delivery grant for the Agent Office profile. */
export function validPointerDeliveryGrant(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 'agent-office.as1-pointer-delivery-grant.v1',
    pointerDeliveryGrantId: 'as1-pdg-0001',
    receiveGrantId: 'as1-receive-grant-0001',
    receiveGrantBindingHash: HASH_2,
    pilotId: 'as1-pilot-0001',
    profileId: 'AGENT_OFFICE_ADVISOR',
    intakeId: 'as1-intake-0001',
    sourceEventId: 'Ev0AGENTOFFICE01',
    rootCorrelationHash: HASH_3,
    pointerArtifactRef: 'artifacts/as1-slack-pilot/agent-office-advisor/pointers/p1',
    pointerHash: HASH_4,
    advisorTeam: 'AGENT_OFFICE_ADVISOR_TEAM',
    actorId: 'agent-office-advisor',
    roleInstanceId: 'foundation-advisor',
    evidencePrefix: 'advisor/jobs/20260714_as1/runtime-evidence/agent-office-advisor',
    governanceSnapshotHash: HASH_B,
    registrySnapshotHash: HASH_C,
    globalControlSnapshotHash: HASH_F,
    profileLatchSnapshotHash: HASH_1,
    authorityRepositoryId: 'agent-office',
    authorityRootId: 'advisor-jobs-root',
    authoritySourceCommit: 'b'.repeat(40),
    issuedAt: '2026-07-14T22:00:00.000Z',
    expiresAt: '2026-07-14T22:04:00.000Z',
    useLimit: 1,
    ...overrides,
  };
}

/** The ten synthetic secret key/value pairs. Placeholder tokens only — never a real bearer value. */
export function validSecretValues(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    SLACK_WORKSPACE_ID: 'TWORKSPACE001',
    SLACK_LEO_USER_ID: APPROVED_LEO_USER_ID,
    SLACK_AGENT_OFFICE_APP_ID: 'AAGENTOFFICE01',
    SLACK_AGENT_OFFICE_CHANNEL_ID: 'CAGENTOFFICE01',
    SLACK_AGENT_OFFICE_BOT_TOKEN: 'xoxb-agentoffice-placeholder-0001',
    SLACK_AGENT_OFFICE_APP_TOKEN: 'xapp-agentoffice-placeholder-0001',
    SLACK_FOUNDATION_APP_ID: 'AFOUNDATION001',
    SLACK_FOUNDATION_CHANNEL_ID: 'CFOUNDATION001',
    SLACK_FOUNDATION_BOT_TOKEN: 'xoxb-foundation-placeholder-00001',
    SLACK_FOUNDATION_APP_TOKEN: 'xapp-foundation-placeholder-00001',
    ...overrides,
  };
}

export function secretText(values: Record<string, string>): string {
  return `${Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\n`;
}

export interface SecretFileHandle {
  readonly dir: string;
  readonly filePath: string;
}

/** Write an owner-only synthetic secret file in a fresh temp dir. Modes are overridable for negatives. */
export async function writeSecretFile(
  content: string,
  options: { readonly dirMode?: number; readonly fileMode?: number; readonly fileName?: string } = {},
): Promise<SecretFileHandle> {
  const dir = await mkdtemp(path.join(tmpdir(), 'as1-slack-secret-'));
  const filePath = path.join(dir, options.fileName ?? 'as1-slack-pilot.env');
  await writeFile(filePath, content, { mode: options.fileMode ?? 0o600 });
  await chmod(filePath, options.fileMode ?? 0o600);
  await chmod(dir, options.dirMode ?? 0o700);
  return { dir, filePath };
}

/** Write raw bytes as an owner-only secret file (for UTF-8, BOM, NUL, and oversize negatives). */
export async function writeSecretBytes(bytes: Uint8Array): Promise<SecretFileHandle> {
  const dir = await mkdtemp(path.join(tmpdir(), 'as1-slack-secret-'));
  const filePath = path.join(dir, 'as1-slack-pilot.env');
  await writeFile(filePath, bytes, { mode: 0o600 });
  await chmod(filePath, 0o600);
  await chmod(dir, 0o700);
  return { dir, filePath };
}

/** Create a symlink alongside a real secret file and return the symlink path (no-follow negative). */
export async function writeSecretSymlink(content: string): Promise<{ dir: string; symlinkPath: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), 'as1-slack-secret-'));
  const realPath = path.join(dir, 'real.env');
  const symlinkPath = path.join(dir, 'as1-slack-pilot.env');
  await writeFile(realPath, content, { mode: 0o600 });
  await chmod(realPath, 0o600);
  await symlink(realPath, symlinkPath);
  await chmod(dir, 0o700);
  return { dir, symlinkPath };
}

/** A dir whose child is a nested owner-only dir, for parent-mode negatives. */
export async function makeTempDir(mode = 0o700): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'as1-slack-'));
  await chmod(dir, mode);
  return dir;
}

export async function makeNestedSecret(content: string, dirMode: number): Promise<SecretFileHandle> {
  const base = await mkdtemp(path.join(tmpdir(), 'as1-slack-'));
  const dir = path.join(base, 'agent-office');
  await mkdir(dir, { mode: dirMode });
  const filePath = path.join(dir, 'as1-slack-pilot.env');
  await writeFile(filePath, content, { mode: 0o600 });
  await chmod(filePath, 0o600);
  await chmod(dir, dirMode);
  return { dir, filePath };
}
