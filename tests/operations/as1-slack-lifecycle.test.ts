import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { As1SlackControl } from '../../src/operations/readiness/as1-slack-control.js';
import { As1GatewayComposition, parseRuntimeDescriptor } from '../../src/runtime/as1-slack-pilot/composition.js';
import { parseAs1Cli, runAs1Cli } from '../../src/runtime/as1-slack-pilot/cli.js';
import { FakeClock, secretText, validSecretValues, writeSecretFile } from '../helpers/as1-slack-fakes.js';
import { makeStateRoot } from '../helpers/fixtures.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

const DESCRIPTOR_PATH = path.join(REPO_ROOT, 'config/agent-office.as1-slack-pilot.disabled.json');

async function committedDescriptor(): Promise<unknown> {
  return JSON.parse(await readFile(DESCRIPTOR_PATH, 'utf8')) as unknown;
}

function committedDescriptorSync(): Record<string, unknown> {
  return JSON.parse(readFileSync(DESCRIPTOR_PATH, 'utf8')) as Record<string, unknown>;
}

async function makeControl() {
  const root = await makeStateRoot();
  const control = await As1SlackControl.open(root, new FakeClock('2026-07-14T22:00:00.000Z'));
  return { root, control };
}

describe('AS1 control lifecycle', () => {
  it('starts default-disabled and walks the reviewed live-receive states then shuts down clean', async () => {
    const { control } = await makeControl();
    expect(control.getState()).toBe('DISABLED_DEFAULT');
    expect(control.isDefaultDisabled()).toBe(true);

    await control.transition('DISABLED_DEFAULT', 'RECEIVE_GRANTED_ONE_PROFILE', 'agent-office-advisor');
    await control.transition('RECEIVE_GRANTED_ONE_PROFILE', 'AUTHENTICATING_ONE_PROFILE');
    await control.transition('AUTHENTICATING_ONE_PROFILE', 'RECEIVING_ONE_PROFILE');
    await control.shutdown();
    expect(control.getState()).toBe('DISABLED_CLEAN');
  });

  it('engages an irreversible global kill switch with no reset', async () => {
    const { root, control } = await makeControl();
    await control.engageGlobalKill('cross-profile contradiction');
    expect(control.getState()).toBe('DISABLED_LATCHED');
    expect(control.isGloballyLatched()).toBe(true);

    await expect(control.transition('DISABLED_LATCHED', 'RECEIVING_ONE_PROFILE')).rejects.toThrow(DomainError);
    await control.shutdown();
    await control.rollbackToDisabled();
    expect(control.getState()).toBe('DISABLED_LATCHED'); // neither shutdown nor rollback clears a latch

    // A fresh process (restart) still sees the latch — no automatic reset.
    const restarted = await As1SlackControl.open(root, new FakeClock('2026-07-14T22:30:00.000Z'));
    expect(restarted.isGloballyLatched()).toBe(true);
  });

  it('latches a single profile independently', async () => {
    const { control } = await makeControl();
    expect(await control.isProfileLatched('foundation-advisor')).toBe(false);
    await control.latchProfile('agent-office-advisor', 'evidence rewrite');
    expect(await control.isProfileLatched('agent-office-advisor')).toBe(true);
    expect(await control.isProfileLatched('foundation-advisor')).toBe(false);
  });

  it('enforces a single-process lock', async () => {
    const { control } = await makeControl();
    const lock = await control.acquireProcessLock();
    await expect(control.acquireProcessLock()).rejects.toThrow();
    await lock.release();
    const relocked = await control.acquireProcessLock();
    await relocked.release();
  });

  it('persists control state across a restart', async () => {
    const { root, control } = await makeControl();
    await control.transition('DISABLED_DEFAULT', 'RECEIVE_GRANTED_ONE_PROFILE', 'agent-office-advisor');
    const restarted = await As1SlackControl.open(root, new FakeClock('2026-07-14T22:30:00.000Z'));
    expect(restarted.getState()).toBe('RECEIVE_GRANTED_ONE_PROFILE');
  });

  it('rolls back to default-disabled from a non-latched state', async () => {
    const { control } = await makeControl();
    await control.transition('DISABLED_DEFAULT', 'RECEIVE_GRANTED_ONE_PROFILE', 'agent-office-advisor');
    await control.rollbackToDisabled();
    expect(control.getState()).toBe('DISABLED_DEFAULT');
    expect(control.isDefaultDisabled()).toBe(true);
  });
});

describe('AS1 default-disabled composition and CLI', () => {
  it('parses the committed default-disabled descriptor', async () => {
    const descriptor = parseRuntimeDescriptor(await committedDescriptor());
    expect(descriptor.enabled).toBe(false);
    expect(descriptor.receiveGrantRef).toBeNull();
  });

  it('rejects a descriptor whose enabled flag is not a boolean', () => {
    expect(() => parseRuntimeDescriptor({ ...(committedDescriptorSync()), enabled: 'yes' })).toThrow(DomainError);
  });

  it('start fails closed with no authority and never connects', async () => {
    const root = await makeStateRoot();
    const composition = await As1GatewayComposition.open(parseRuntimeDescriptor(await committedDescriptor()), {
      stateRoot: root,
      clock: new FakeClock('2026-07-14T22:00:00.000Z'),
    });
    const result = composition.start();
    expect(result.connected).toBe(false);
    expect(result.reason).toBe('DISABLED_DEFAULT_NO_AUTHORITY');
    expect(composition.status().liveConnection).toBe('NOT_STARTED');
  });

  it('even a descriptor with a grant ref does not connect in Phase A', async () => {
    const root = await makeStateRoot();
    const descriptor = parseRuntimeDescriptor({
      ...committedDescriptorSync(),
      enabled: true,
      receiveGrantRef: 'advisor/jobs/20260714_as1/receive-grant.json',
    });
    const composition = await As1GatewayComposition.open(descriptor, { stateRoot: root, clock: new FakeClock('2026-07-14T22:00:00.000Z') });
    const result = composition.start();
    expect(result.connected).toBe(false);
    expect(result.reason).toBe('LIVE_START_REQUIRES_SEPARATE_AUTHORIZATION');
  });

  it('parses the closed lifecycle commands and rejects anything else', () => {
    expect(parseAs1Cli(['start', '--env-file', '/x/as1.env'])).toStrictEqual({ command: 'start', envFilePath: '/x/as1.env' });
    expect(() => parseAs1Cli(['agents', '--env-file', '/x'])).toThrow(DomainError);
    expect(() => parseAs1Cli(['start'])).toThrow(DomainError);
    expect(() => parseAs1Cli(['start', '--profile', 'FOUNDATION_ADVISOR', '--env-file', '/x'])).toThrow(DomainError);
    expect(() => parseAs1Cli(['start', '--env-file', '/x', '--env-file', '/y'])).toThrow(DomainError);
  });

  it('status output is redacted and reports no live connection', async () => {
    const root = await makeStateRoot();
    const composition = await As1GatewayComposition.open(parseRuntimeDescriptor(await committedDescriptor()), {
      stateRoot: root,
      clock: new FakeClock('2026-07-14T22:00:00.000Z'),
    });
    const result = await runAs1Cli({ command: 'status', envFilePath: '/x/as1.env' }, composition);
    expect(result.lines).toContain('LIVE_CONNECTION: NOT_STARTED');
    expect(result.lines.join('\n')).not.toContain('xoxb');
    expect(result.lines.join('\n')).not.toContain('TWORKSPACE001');
  });

  it('redacted-check validates a disposable synthetic file without contacting Slack', async () => {
    const root = await makeStateRoot();
    const composition = await As1GatewayComposition.open(parseRuntimeDescriptor(await committedDescriptor()), {
      stateRoot: root,
      clock: new FakeClock('2026-07-14T22:00:00.000Z'),
    });
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));
    const result = await runAs1Cli({ command: 'redacted-check', envFilePath: filePath }, composition);
    expect(result.lines).toContain('RESULT: PASS');
    expect(result.lines.join('\n')).not.toContain('xoxb');
  });
});
