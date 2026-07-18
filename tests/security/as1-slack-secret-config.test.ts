import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { parseSecretConfigFile, parseStrategySecretConfigFile } from '../../src/adapters/gateways/slack-pilot/secret-config.js';
import {
  makeNestedSecret,
  secretText,
  validSecretValues,
  writeSecretBytes,
  writeSecretFile,
  writeSecretSymlink,
} from '../helpers/as1-slack-fakes.js';

async function grabDomainError(fn: () => Promise<unknown>): Promise<DomainError> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof DomainError) return error;
    throw error;
  }
  throw new Error('expected a DomainError but none was thrown');
}

function strategySecretText(): string {
  const b = validSecretValues();
  return secretText({
    SLACK_WORKSPACE_ID: b.SLACK_WORKSPACE_ID,
    SLACK_LEO_USER_ID: b.SLACK_LEO_USER_ID,
    SLACK_AGENT_OFFICE_STRATEGY_APP_ID: b.SLACK_AGENT_OFFICE_APP_ID,
    SLACK_AGENT_OFFICE_STRATEGY_CHANNEL_ID: b.SLACK_AGENT_OFFICE_CHANNEL_ID,
    SLACK_AGENT_OFFICE_STRATEGY_BOT_TOKEN: b.SLACK_AGENT_OFFICE_BOT_TOKEN,
    SLACK_AGENT_OFFICE_STRATEGY_APP_TOKEN: b.SLACK_AGENT_OFFICE_APP_TOKEN,
    SLACK_FOUNDATION_STRATEGY_APP_ID: b.SLACK_FOUNDATION_APP_ID,
    SLACK_FOUNDATION_STRATEGY_CHANNEL_ID: b.SLACK_FOUNDATION_CHANNEL_ID,
    SLACK_FOUNDATION_STRATEGY_BOT_TOKEN: b.SLACK_FOUNDATION_BOT_TOKEN,
    SLACK_FOUNDATION_STRATEGY_APP_TOKEN: b.SLACK_FOUNDATION_APP_TOKEN,
  });
}

describe('AS1 Strategy secret-config parser', () => {
  it('parses only the fixed Strategy secret key set without exposing values', async () => {
    const { filePath } = await writeSecretFile(strategySecretText(), { fileName: 'strategy-slack-apps.env' });
    const config = await parseStrategySecretConfigFile(filePath);
    expect(config.getWorkspaceId()).toBe('TWORKSPACE001');
    expect(config.getLeoUserId()).toBe('U0BD3523C1F');
    // The projection is LOCAL SYNTAX only and exposes NO token/raw ID/prefix/length/hash.
    const rendered = config.renderRedactedCheck();
    expect(rendered).toContain('AS1_STRATEGY_SLACK_REDACTED_CHECK');
    expect(rendered).toContain('SCOPE: LOCAL_SYNTAX_ONLY');
    expect(rendered).toContain('RESULT: LOCAL_SYNTAX_PASS');
    expect(rendered).toContain('LIVE_IDENTITY_PROOF: NOT_PERFORMED');
    expect(rendered).toContain('TOKENS: PRESENT_AND_REDACTED');
    expect(rendered).not.toContain('xoxb');
    expect(rendered).not.toContain('xapp');
    expect(rendered).not.toContain('TWORKSPACE001');
    // The key set is EXACTLY the Strategy ten: a legacy (non-Strategy) key is an unknown key.
    const withLegacyKey = strategySecretText().replace('SLACK_AGENT_OFFICE_STRATEGY_APP_ID', 'SLACK_AGENT_OFFICE_APP_ID');
    const { filePath: badPath } = await writeSecretFile(withLegacyKey, { fileName: 'bad-strategy.env' });
    expect((await grabDomainError(() => parseStrategySecretConfigFile(badPath))).code).toBe('UNKNOWN_FIELD');
  });
});

describe('AS1 secret-config parser — positive', () => {
  it('parses an owner-only exact-ten-key file and exposes only a redacted projection', async () => {
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));
    const config = await parseSecretConfigFile(filePath);

    expect(config.getWorkspaceId()).toBe('TWORKSPACE001');
    expect(config.getLeoUserId()).toBe('U0BD3523C1F');
    // The projection is scoped to LOCAL SYNTAX only and never claims a live identity proof (B09).
    expect(config.redactedProjection().scope).toBe('LOCAL_SYNTAX_ONLY');
    expect(config.redactedProjection().liveIdentityProof).toBe('NOT_PERFORMED');
    expect(config.redactedProjection().result).toBe('LOCAL_SYNTAX_PASS');

    const rendered = config.renderRedactedCheck();
    expect(rendered).toContain('AS1_SLACK_REDACTED_CHECK');
    expect(rendered).toContain('SCOPE: LOCAL_SYNTAX_ONLY');
    expect(rendered).toContain('RESULT: LOCAL_SYNTAX_PASS');
    expect(rendered).toContain('LIVE_IDENTITY_PROOF: NOT_PERFORMED');
    expect(rendered).toContain('NOT a live identity proof');
    expect(rendered).toContain('TOKENS: PRESENT_AND_REDACTED');
    // The redacted output must contain no token, prefix, or raw ID.
    expect(rendered).not.toContain('xoxb');
    expect(rendered).not.toContain('xapp');
    expect(rendered).not.toContain('TWORKSPACE001');
    expect(rendered).not.toContain('placeholder');
  });
});

describe('AS1 secret-config parser — filesystem gate', () => {
  it('rejects a file whose mode is not exactly 0600', async () => {
    const { filePath } = await writeSecretFile(secretText(validSecretValues()), { fileMode: 0o644 });
    expect((await grabDomainError(() => parseSecretConfigFile(filePath))).code).toBe('AUTHORITY_ARTIFACT_INVALID');
  });

  it('rejects a parent directory whose mode is not exactly 0700', async () => {
    const { filePath } = await makeNestedSecret(secretText(validSecretValues()), 0o755);
    expect((await grabDomainError(() => parseSecretConfigFile(filePath))).code).toBe('AUTHORITY_ARTIFACT_INVALID');
  });

  it('rejects a symlinked secret path (no-follow open)', async () => {
    const { symlinkPath } = await writeSecretSymlink(secretText(validSecretValues()));
    expect((await grabDomainError(() => parseSecretConfigFile(symlinkPath))).code).toBe('AUTHORITY_ARTIFACT_INVALID');
  });

  it('rejects a relative path', async () => {
    expect((await grabDomainError(() => parseSecretConfigFile('relative/as1.env'))).code).toBe(
      'AUTHORITY_ARTIFACT_INVALID',
    );
  });

  it('rejects a file larger than the 32 KiB bound', async () => {
    const { filePath } = await writeSecretBytes(Buffer.alloc(40_000, 0x41));
    expect((await grabDomainError(() => parseSecretConfigFile(filePath))).code).toBe('AUTHORITY_ARTIFACT_INVALID');
  });
});

describe('AS1 secret-config parser — data grammar', () => {
  it('rejects non-UTF-8 bytes', async () => {
    const { filePath } = await writeSecretBytes(Buffer.from([0x53, 0x4c, 0xff, 0x0a]));
    expect((await grabDomainError(() => parseSecretConfigFile(filePath))).code).toBe('INVALID_SCHEMA');
  });

  it('rejects a leading BOM', async () => {
    const { filePath } = await writeSecretBytes(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(secretText(validSecretValues()))]));
    expect((await grabDomainError(() => parseSecretConfigFile(filePath))).code).toBe('INVALID_SCHEMA');
  });

  it('rejects a CR', async () => {
    const { filePath } = await writeSecretFile(secretText(validSecretValues()).replace('\n', '\r\n'));
    expect((await grabDomainError(() => parseSecretConfigFile(filePath))).code).toBe('INVALID_SCHEMA');
  });

  it('rejects a blank line', async () => {
    const { filePath } = await writeSecretFile(`${secretText(validSecretValues())}\n`);
    expect((await grabDomainError(() => parseSecretConfigFile(filePath))).code).toBe('INVALID_SCHEMA');
  });

  it('rejects a comment', async () => {
    const { filePath } = await writeSecretFile(`# comment\n${secretText(validSecretValues())}`);
    expect((await grabDomainError(() => parseSecretConfigFile(filePath))).code).toBe('INVALID_SCHEMA');
  });

  it('rejects export syntax', async () => {
    const values = validSecretValues();
    const text = secretText(values).replace('SLACK_WORKSPACE_ID=', 'export SLACK_WORKSPACE_ID=');
    const { filePath } = await writeSecretFile(text);
    expect((await grabDomainError(() => parseSecretConfigFile(filePath))).code).toBe('INVALID_SCHEMA');
  });

  it('rejects quoting or interpolation in a value', async () => {
    const { filePath } = await writeSecretFile(secretText(validSecretValues({ SLACK_WORKSPACE_ID: '"TWORKSPACE001"' })));
    expect((await grabDomainError(() => parseSecretConfigFile(filePath))).code).toBe('INVALID_SCHEMA');
  });

  it('rejects a duplicate key', async () => {
    const { filePath } = await writeSecretFile(`${secretText(validSecretValues())}SLACK_WORKSPACE_ID=TWORKSPACE001\n`);
    expect((await grabDomainError(() => parseSecretConfigFile(filePath))).code).toBe('INVALID_SCHEMA');
  });

  it('rejects an unknown key', async () => {
    const { filePath } = await writeSecretFile(`${secretText(validSecretValues())}SLACK_EXTRA_KEY=xoxb-extra-placeholder-00\n`);
    expect((await grabDomainError(() => parseSecretConfigFile(filePath))).code).toBe('UNKNOWN_FIELD');
  });

  it('rejects a missing key (only nine present)', async () => {
    const values = validSecretValues();
    Reflect.deleteProperty(values, 'SLACK_FOUNDATION_APP_TOKEN');
    const { filePath } = await writeSecretFile(secretText(values));
    expect((await grabDomainError(() => parseSecretConfigFile(filePath))).code).toBe('INVALID_SCHEMA');
  });
});

describe('AS1 secret-config parser — identity and separation', () => {
  it('rejects a workspace ID that fails the bounded Slack grammar', async () => {
    const { filePath } = await writeSecretFile(secretText(validSecretValues({ SLACK_WORKSPACE_ID: 'workspace' })));
    expect((await grabDomainError(() => parseSecretConfigFile(filePath))).code).toBe('INVALID_SCHEMA');
  });

  it('rejects a Leo user ID that is not the approved owner', async () => {
    const { filePath } = await writeSecretFile(secretText(validSecretValues({ SLACK_LEO_USER_ID: 'U0000000000' })));
    expect((await grabDomainError(() => parseSecretConfigFile(filePath))).code).toBe('UNAUTHORIZED_ACTOR');
  });

  it('rejects two profiles that share an App ID', async () => {
    const { filePath } = await writeSecretFile(secretText(validSecretValues({ SLACK_FOUNDATION_APP_ID: 'AAGENTOFFICE01' })));
    expect((await grabDomainError(() => parseSecretConfigFile(filePath))).code).toBe('FORBIDDEN_TARGET');
  });

  it('rejects two profiles that share a bot token', async () => {
    const { filePath } = await writeSecretFile(
      secretText(validSecretValues({ SLACK_FOUNDATION_BOT_TOKEN: 'xoxb-agentoffice-placeholder-0001' })),
    );
    expect((await grabDomainError(() => parseSecretConfigFile(filePath))).code).toBe('FORBIDDEN_TARGET');
  });
});

describe('AS1 secret-config parser — redaction', () => {
  it('never echoes a rejected value in the error message', async () => {
    const canary = 'LEAKCANARY-not-a-token';
    const { filePath } = await writeSecretFile(secretText(validSecretValues({ SLACK_AGENT_OFFICE_BOT_TOKEN: canary })));
    const error = await grabDomainError(() => parseSecretConfigFile(filePath));
    expect(error.code).toBe('INVALID_SCHEMA');
    expect(error.message).not.toContain('LEAKCANARY');
    expect(error.message).toContain('SLACK_AGENT_OFFICE_BOT_TOKEN');
  });
});
