import { readFileSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { As1SlackControl } from '../../src/operations/readiness/as1-slack-control.js';
import { As1GatewayComposition, controlProfileControlPort, parseRuntimeDescriptor } from '../../src/runtime/as1-slack-pilot/composition.js';
import { parseAs1Cli, runAs1Cli } from '../../src/runtime/as1-slack-pilot/cli.js';
import { probeCapability, signalOwner, WriterLock } from '../../src/persistence/file-store/writer-lock.js';
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
  const control = await reopenControl(root, '2026-07-14T22:00:00.000Z');
  return { root, control };
}

/** Open the control through its only (lock-owning) path. The caller closes it (releasing the owned lock). */
function reopenControl(root: string, iso: string): Promise<As1SlackControl> {
  return As1SlackControl.open(root, new FakeClock(iso));
}

/** A fresh state root with the control fully established and its lock released (ready for tamper + reopen tests). */
async function establishedRoot(): Promise<string> {
  const root = await makeStateRoot();
  const control = await reopenControl(root, '2026-07-14T22:00:00.000Z');
  await control.close();
  return root;
}

describe('AS1 control lifecycle', () => {
  it('starts default-disabled and walks the reviewed live-receive states then shuts down clean', async () => {
    const { control } = await makeControl();
    try {
      expect(control.getState()).toBe('DISABLED_DEFAULT');
      expect(control.isDefaultDisabled()).toBe(true);
      await control.transition('DISABLED_DEFAULT', 'RECEIVE_GRANTED_ONE_PROFILE', 'agent-office-advisor');
      await control.transition('RECEIVE_GRANTED_ONE_PROFILE', 'AUTHENTICATING_ONE_PROFILE');
      await control.transition('AUTHENTICATING_ONE_PROFILE', 'RECEIVING_ONE_PROFILE');
      await control.shutdown();
      expect(control.getState()).toBe('DISABLED_CLEAN');
    } finally {
      await control.close();
    }
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
    await control.close();

    // A fresh process (restart) still sees the latch — no automatic reset.
    const restarted = await reopenControl(root, '2026-07-14T22:30:00.000Z');
    expect(restarted.isGloballyLatched()).toBe(true);
    await restarted.close();
  });

  it('latches a single profile independently', async () => {
    const { control } = await makeControl();
    try {
      expect(await control.isProfileLatched('foundation-advisor')).toBe(false);
      await control.latchProfile('agent-office-advisor', 'evidence rewrite');
      expect(await control.isProfileLatched('agent-office-advisor')).toBe(true);
      expect(await control.isProfileLatched('foundation-advisor')).toBe(false);
    } finally {
      await control.close();
    }
  });

  it('owns the single-process lock and rejects mutation after close (B05)', async () => {
    const { root, control } = await makeControl();
    // A second open on the same root cannot acquire the owned lock.
    await expect(As1SlackControl.open(root, new FakeClock('2026-07-14T22:01:00.000Z'))).rejects.toThrow();
    await control.close();
    // A released control rejects every durable mutation.
    await expect(control.engageGlobalKill('after close')).rejects.toThrow(DomainError);
    await expect(control.transition('DISABLED_DEFAULT', 'RECEIVE_GRANTED_ONE_PROFILE', 'agent-office-advisor')).rejects.toThrow(DomainError);
    // The lock is free again after close.
    const relocked = await reopenControl(root, '2026-07-14T22:02:00.000Z');
    await relocked.close();
  });

  it('persists control state across a restart', async () => {
    const { root, control } = await makeControl();
    await control.transition('DISABLED_DEFAULT', 'RECEIVE_GRANTED_ONE_PROFILE', 'agent-office-advisor');
    await control.close();
    const restarted = await reopenControl(root, '2026-07-14T22:30:00.000Z');
    expect(restarted.getState()).toBe('RECEIVE_GRANTED_ONE_PROFILE');
    await restarted.close();
  });

  it('rolls back to default-disabled from a non-latched state', async () => {
    const { control } = await makeControl();
    try {
      await control.transition('DISABLED_DEFAULT', 'RECEIVE_GRANTED_ONE_PROFILE', 'agent-office-advisor');
      await control.rollbackToDisabled();
      expect(control.getState()).toBe('DISABLED_DEFAULT');
      expect(control.isDefaultDisabled()).toBe(true);
    } finally {
      await control.close();
    }
  });
});

const CONTROL_DIR = 'indexes/as1-slack-pilot';

describe('AS1 control durable-state integrity (B05)', () => {
  it('rejects an illegal state jump and enforces the state↔slug correlation', async () => {
    const { control } = await makeControl();
    // A jump not in the closed adjacency table is illegal.
    await expect(control.transition('DISABLED_DEFAULT', 'RECEIVING_ONE_PROFILE', 'agent-office-advisor')).rejects.toThrow(DomainError);
    // A transition into an active state requires exactly one closed slug.
    await expect(control.transition('DISABLED_DEFAULT', 'RECEIVE_GRANTED_ONE_PROFILE')).rejects.toThrow(DomainError);
    // An arbitrary slug is refused.
    await expect(control.transition('DISABLED_DEFAULT', 'RECEIVE_GRANTED_ONE_PROFILE', 'intruder')).rejects.toThrow(DomainError);
    await control.transition('DISABLED_DEFAULT', 'RECEIVE_GRANTED_ONE_PROFILE', 'agent-office-advisor');
    expect(control.getActiveProfileSlug()).toBe('agent-office-advisor');
    await control.rollbackToDisabled(); // a disabled state clears the slug
    expect(control.getActiveProfileSlug()).toBeNull();
    await control.close();
  });

  it('preserves the first profile latch and refuses an arbitrary slug', async () => {
    const { root, control } = await makeControl();
    await expect(control.latchProfile('intruder', 'x')).rejects.toThrow(DomainError);
    await control.latchProfile('agent-office-advisor', 'first reason');
    await control.latchProfile('agent-office-advisor', 'second reason');
    const latch = JSON.parse(
      await readFile(path.join(root, CONTROL_DIR, 'profiles/agent-office-advisor/failure-latch.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(latch.reason).toBe('first reason'); // the first latch is preserved, never overwritten
    await control.close();
  });

  it('quarantines a deleted established marker with residual control (partial init)', async () => {
    const root = await establishedRoot();
    await rm(path.join(root, CONTROL_DIR, 'control-established.json'));
    await expect(reopenControl(root, '2026-07-14T22:30:00.000Z')).rejects.toThrow(DomainError);
  });

  it('quarantines a deleted global-control file when the marker proves it was established', async () => {
    const root = await establishedRoot();
    await rm(path.join(root, CONTROL_DIR, 'global-control.json'));
    await expect(reopenControl(root, '2026-07-14T22:30:00.000Z')).rejects.toThrow(DomainError);
  });

  it('quarantines a deleted profile latch record', async () => {
    const root = await establishedRoot();
    await rm(path.join(root, CONTROL_DIR, 'profiles/foundation-advisor/failure-latch.json'));
    await expect(reopenControl(root, '2026-07-14T22:30:00.000Z')).rejects.toThrow(DomainError);
  });

  it('quarantines a malformed global-control record instead of coercing it', async () => {
    const root = await establishedRoot();
    await writeFile(
      path.join(root, CONTROL_DIR, 'global-control.json'),
      JSON.stringify({ schemaVersion: 'agent-office.as1-global-control.v1', state: 'DISABLED_DEFAULT', killEngaged: 'yes', latchReason: null, activeProfileSlug: null, updatedAt: '2026-07-14T22:00:00.000Z' }),
      'utf8',
    );
    await expect(reopenControl(root, '2026-07-14T22:30:00.000Z')).rejects.toThrow(DomainError);
  });

  it('quarantines a non-latched control that carries a stale latch reason', async () => {
    const root = await establishedRoot();
    await writeFile(
      path.join(root, CONTROL_DIR, 'global-control.json'),
      JSON.stringify({ schemaVersion: 'agent-office.as1-global-control.v1', state: 'DISABLED_DEFAULT', killEngaged: false, latchReason: 'stale', activeProfileSlug: null, updatedAt: '2026-07-14T22:00:00.000Z' }),
      'utf8',
    );
    await expect(reopenControl(root, '2026-07-14T22:30:00.000Z')).rejects.toThrow(DomainError);
  });

  it('rejects an established marker with a wrong stateRootId, wrong schema, or non-UTC time', async () => {
    for (const marker of [
      { schemaVersion: 'agent-office.as1-control-established.v1', stateRootId: 'some-other-root', establishedAt: '2026-07-14T22:00:00.000Z' },
      { schemaVersion: 'agent-office.WRONG.v1', stateRootId: 'as1-slack-pilot', establishedAt: '2026-07-14T22:00:00.000Z' },
      { schemaVersion: 'agent-office.as1-control-established.v1', stateRootId: 'as1-slack-pilot', establishedAt: 'not-a-time' },
    ]) {
      const root = await establishedRoot();
      await writeFile(path.join(root, CONTROL_DIR, 'control-established.json'), JSON.stringify(marker), 'utf8');
      await expect(reopenControl(root, '2026-07-14T22:30:00.000Z')).rejects.toThrow(DomainError);
    }
  });

  it('close() serializes behind an in-flight mutation and never drops committed work (B05)', async () => {
    const { root, control } = await makeControl();
    // The latch is queued in the mutex first; close is queued second and waits for it before releasing.
    const latch = control.latchProfile('agent-office-advisor', 'in flight');
    await control.close();
    await latch; // completed durably, under the lock, before close released it
    const reopened = await reopenControl(root, '2026-07-14T22:05:00.000Z');
    expect(await reopened.isProfileLatched('agent-office-advisor')).toBe(true);
    await reopened.close();
  });
});

describe('AS1 receive/recovery control gate (B05)', () => {
  it('the receive gate is closed by default-disabled, wrong active profile, kill, and close', async () => {
    const { control } = await makeControl(); // DISABLED_DEFAULT
    const gate = controlProfileControlPort(control, 'agent-office-advisor');
    // Fail-open fix: a default-disabled control (activeProfileSlug null) is NOT receive-actionable.
    expect(await gate.isReceiveActionable()).toBe(false);
    await expect(gate.assertReceiveActionable()).rejects.toThrow(DomainError);

    await control.transition('DISABLED_DEFAULT', 'RECEIVE_GRANTED_ONE_PROFILE', 'agent-office-advisor');
    await control.transition('RECEIVE_GRANTED_ONE_PROFILE', 'AUTHENTICATING_ONE_PROFILE');
    await control.transition('AUTHENTICATING_ONE_PROFILE', 'RECEIVING_ONE_PROFILE');
    expect(await gate.isReceiveActionable()).toBe(true); // exactly RECEIVING for this profile

    // The same RECEIVING state is NOT actionable for the OTHER closed profile.
    const wrong = controlProfileControlPort(control, 'foundation-advisor');
    expect(await wrong.isReceiveActionable()).toBe(false);
    await expect(wrong.assertReceiveActionable()).rejects.toThrow(DomainError);

    await control.engageGlobalKill('kill');
    expect(await gate.isReceiveActionable()).toBe(false); // a global kill closes the gate
    await control.close();
    expect(await gate.isReceiveActionable()).toBe(false); // a closed control fails closed
    await expect(gate.assertDrainActionable()).rejects.toThrow(DomainError);
  });

  it('a durably latched profile closes the receive, recovery, and drain gates', async () => {
    const { control } = await makeControl();
    await control.transition('DISABLED_DEFAULT', 'RECEIVE_GRANTED_ONE_PROFILE', 'agent-office-advisor');
    await control.transition('RECEIVE_GRANTED_ONE_PROFILE', 'AUTHENTICATING_ONE_PROFILE');
    await control.transition('AUTHENTICATING_ONE_PROFILE', 'RECEIVING_ONE_PROFILE');
    const gate = controlProfileControlPort(control, 'agent-office-advisor');
    expect(await gate.isReceiveActionable()).toBe(true);
    await control.latchProfile('agent-office-advisor', 'evidence rewrite');
    expect(await gate.isReceiveActionable()).toBe(false);
    expect(await gate.isReceiveRecoveryActionable()).toBe(false);
    await expect(gate.assertReceiveActionable()).rejects.toThrow(DomainError);
    await expect(gate.assertDrainActionable()).rejects.toThrow(DomainError);
    await control.close();
  });

  it('offline drain: DISABLED_CLEAN permits post-ACK drain but denies PREACK_PENDING recovery and live receive (B05)', async () => {
    const { control } = await makeControl();
    await control.transition('DISABLED_DEFAULT', 'RECEIVE_GRANTED_ONE_PROFILE', 'agent-office-advisor');
    await control.transition('RECEIVE_GRANTED_ONE_PROFILE', 'AUTHENTICATING_ONE_PROFILE');
    await control.transition('AUTHENTICATING_ONE_PROFILE', 'RECEIVING_ONE_PROFILE');
    await control.shutdown(); // drains to DISABLED_CLEAN (expired + disconnected)
    expect(control.getState()).toBe('DISABLED_CLEAN');
    const gate = controlProfileControlPort(control, 'agent-office-advisor');
    await expect(gate.assertDrainActionable()).resolves.toBeUndefined(); // post-ACK materialization permitted
    expect(await gate.isReceiveRecoveryActionable()).toBe(false); // PREACK_PENDING recovery denied while disabled
    expect(await gate.isReceiveActionable()).toBe(false); // live receive denied
    await control.close();
    await expect(gate.assertDrainActionable()).rejects.toThrow(DomainError); // a closed control fails closed
  });

  it('denies a cross-profile drain while another profile is the active RECEIVING profile (B05)', async () => {
    const { control } = await makeControl();
    await control.transition('DISABLED_DEFAULT', 'RECEIVE_GRANTED_ONE_PROFILE', 'agent-office-advisor');
    await control.transition('RECEIVE_GRANTED_ONE_PROFILE', 'AUTHENTICATING_ONE_PROFILE');
    await control.transition('AUTHENTICATING_ONE_PROFILE', 'RECEIVING_ONE_PROFILE'); // agent-office active
    // The bound-to-agent-office drain is permitted; the foundation drain is NOT (wrong active profile).
    await expect(controlProfileControlPort(control, 'agent-office-advisor').assertDrainActionable()).resolves.toBeUndefined();
    await expect(controlProfileControlPort(control, 'foundation-advisor').assertDrainActionable()).rejects.toThrow(DomainError);
    await control.close();
  });

  it('the pre-event hello seal requires EXACTLY AUTHENTICATING_ONE_PROFILE (B05)', async () => {
    const { control } = await makeControl();
    const slug = 'agent-office-advisor';
    expect(control.isConnectReady(slug)).toBe(false); // DISABLED_DEFAULT
    await control.transition('DISABLED_DEFAULT', 'RECEIVE_GRANTED_ONE_PROFILE', slug);
    expect(control.isConnectReady(slug)).toBe(false); // RECEIVE_GRANTED is not the hello state
    await control.transition('RECEIVE_GRANTED_ONE_PROFILE', 'AUTHENTICATING_ONE_PROFILE');
    expect(control.isConnectReady(slug)).toBe(true); // exactly AUTHENTICATING
    expect(control.isConnectReady('foundation-advisor')).toBe(false); // wrong active profile
    await control.transition('AUTHENTICATING_ONE_PROFILE', 'RECEIVING_ONE_PROFILE');
    expect(control.isConnectReady(slug)).toBe(false); // already RECEIVING is not the hello state
    await control.close();
  });
});

describe('AS1 composition restart and lock ownership (B05)', () => {
  const clock = (): FakeClock => new FakeClock('2026-07-14T22:00:00.000Z');

  it('a stopped composition is closed and refuses every further lifecycle call', async () => {
    const root = await makeStateRoot();
    const composition = await As1GatewayComposition.open(parseRuntimeDescriptor(await committedDescriptor()), { stateRoot: root, clock: clock() });
    await composition.stop();
    await expect(composition.start()).rejects.toThrow(DomainError);
    await expect(composition.stop()).rejects.toThrow(DomainError);
    expect(() => composition.restartDisabled()).toThrow(DomainError);
  });

  it('restart is live-disabled and returns a fail-closed result without opening a live connection (§11.1.3)', async () => {
    const root = await makeStateRoot();
    const composition = await As1GatewayComposition.open(parseRuntimeDescriptor(await committedDescriptor()), { stateRoot: root, clock: clock() });
    const result = composition.restartDisabled();
    expect(result.connected).toBe(false);
    expect(result.reason).toBe('DISABLED_DEFAULT_NO_AUTHORITY');
    await composition.close();
  });

  it('incident-kill engages the durable irreversible global kill and closes the incident gate (§11.2)', async () => {
    const root = await makeStateRoot();
    const composition = await As1GatewayComposition.open(parseRuntimeDescriptor(await committedDescriptor()), { stateRoot: root, clock: clock() });
    const status = await composition.incidentKill();
    expect(status.killEngaged).toBe(true);
    expect(status.incidentGateOpen).toBe(false);
    expect(status.state).toBe('DISABLED_LATCHED');
    // A fresh process still sees the durable latch — no automatic reset.
    const restarted = await reopenControl(root, '2026-07-14T22:30:00.000Z');
    expect(restarted.isGloballyLatched()).toBe(true);
    await restarted.close();
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
    try {
      const result = await composition.start();
      expect(result.connected).toBe(false);
      expect(result.reason).toBe('DISABLED_DEFAULT_NO_AUTHORITY');
      expect(composition.status().liveConnection).toBe('NOT_STARTED');
    } finally {
      await composition.close();
    }
  });

  it('owns the single-process lock: a second composition on the same root fails closed until close (B05)', async () => {
    const root = await makeStateRoot();
    const descriptor = parseRuntimeDescriptor(await committedDescriptor());
    const clock = new FakeClock('2026-07-14T22:00:00.000Z');
    const first = await As1GatewayComposition.open(descriptor, { stateRoot: root, clock });
    await expect(As1GatewayComposition.open(descriptor, { stateRoot: root, clock })).rejects.toThrow();
    await first.close(); // release the owned lock
    const second = await As1GatewayComposition.open(descriptor, { stateRoot: root, clock });
    await second.close();
  });

  it('a descriptor with a grant ref but no live dependencies never connects (fail-closed)', async () => {
    const root = await makeStateRoot();
    const descriptor = parseRuntimeDescriptor({
      ...committedDescriptorSync(),
      enabled: true,
      receiveGrantRef: 'advisor/jobs/20260714_as1/receive-grant.json',
    });
    const composition = await As1GatewayComposition.open(descriptor, { stateRoot: root, clock: new FakeClock('2026-07-14T22:00:00.000Z') });
    try {
      const result = await composition.start();
      expect(result.connected).toBe(false);
      expect(result.reason).toBe('DISABLED_DEFAULT_NO_AUTHORITY');
    } finally {
      await composition.close();
    }
  });

  it('parses the closed lifecycle commands and rejects anything else', () => {
    expect(parseAs1Cli(['start', '--env-file', '/x/as1.env'])).toStrictEqual({ command: 'start', envFilePath: '/x/as1.env' });
    expect(() => parseAs1Cli(['agents', '--env-file', '/x'])).toThrow(DomainError);
    expect(() => parseAs1Cli(['start'])).toThrow(DomainError);
    expect(() => parseAs1Cli(['start', '--profile', 'FOUNDATION_ADVISOR', '--env-file', '/x'])).toThrow(DomainError);
    expect(() => parseAs1Cli(['start', '--env-file', '/x', '--env-file', '/y'])).toThrow(DomainError);
    // Phase B zero-operand observer verbs accept no operand at all.
    expect(parseAs1Cli(['stop'])).toStrictEqual({ command: 'stop', envFilePath: null });
    expect(parseAs1Cli(['incident-kill'])).toStrictEqual({ command: 'incident-kill', envFilePath: null });
    expect(parseAs1Cli(['status'])).toStrictEqual({ command: 'status', envFilePath: null });
    expect(() => parseAs1Cli(['stop', '--env-file', '/x'])).toThrow(DomainError);
    expect(() => parseAs1Cli(['incident-kill', '5'])).toThrow(DomainError);
  });

  it('status output is redacted and reports no live connection', async () => {
    const root = await makeStateRoot();
    const composition = await As1GatewayComposition.open(parseRuntimeDescriptor(await committedDescriptor()), {
      stateRoot: root,
      clock: new FakeClock('2026-07-14T22:00:00.000Z'),
    });
    const result = await runAs1Cli({ command: 'status', envFilePath: null }, composition);
    expect(result.lines).toContain('REASON: LIVE_CONNECTION_NOT_STARTED');
    expect(result.lines.join('\n')).not.toContain('xoxb');
    expect(result.lines.join('\n')).not.toContain('TWORKSPACE001');
    await composition.close();
  });

  it('redacted-check validates a disposable synthetic file without contacting Slack', async () => {
    const root = await makeStateRoot();
    const composition = await As1GatewayComposition.open(parseRuntimeDescriptor(await committedDescriptor()), {
      stateRoot: root,
      clock: new FakeClock('2026-07-14T22:00:00.000Z'),
    });
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));
    const result = await runAs1Cli({ command: 'redacted-check', envFilePath: filePath }, composition);
    expect(result.lines).toContain('RESULT: LOCAL_SYNTAX_PASS');
    expect(result.lines).toContain('SCOPE: LOCAL_SYNTAX_ONLY');
    expect(result.lines).toContain('LIVE_IDENTITY_PROOF: NOT_PERFORMED');
    expect(result.lines.join('\n')).not.toContain('xoxb');
    await composition.close();
  });
});

/** The exact DomainError code a control open rejects with, or null for a raw/code-less error (the pre-patch defect). */
async function openRejectionCode(root: string, iso: string): Promise<string | null> {
  try {
    const control = await reopenControl(root, iso);
    await control.close();
  } catch (error) {
    return error instanceof DomainError ? error.code : null;
  }
  throw new Error('expected the control open to reject but it resolved');
}

describe('AS1 durable global-control corruption normalization (B08)', () => {
  // The immutable Reviewer V4 result (caf808f6, SHA256 93c4eda5) reproduced a corrupt global-control.json ({)
  // surfacing a raw, code-less SyntaxError instead of the reviewed quarantine class, so no durable global
  // fail-closed was proven. Fatal UTF-8 decode / JSON parse / oversize corruption now normalizes to
  // STORE_QUARANTINED, and — because the corrupt bytes are never silently healed — the control stays fail-closed
  // on every restart.
  const CORRUPTIONS: readonly (readonly [string, Buffer])[] = [
    ['malformed JSON', Buffer.from('{', 'utf8')],
    ['invalid UTF-8 bytes', Buffer.from([0x80, 0xff, 0xfe])],
    ['oversize beyond the 1 MiB durable bound', Buffer.from('['.padEnd(1_048_577, ' '), 'utf8')],
  ];
  for (const [label, bytes] of CORRUPTIONS) {
    it(`quarantines a ${label} global-control file as STORE_QUARANTINED and stays fail-closed across restart`, async () => {
      const root = await establishedRoot();
      await writeFile(path.join(root, CONTROL_DIR, 'global-control.json'), bytes);
      // First open: the durable corruption is the reviewed quarantine class, not a raw SyntaxError/TypeError.
      expect(await openRejectionCode(root, '2026-07-14T22:30:00.000Z')).toBe('STORE_QUARANTINED');
      // Restart: the corruption is never auto-healed; the durable global fail-closed persists.
      expect(await openRejectionCode(root, '2026-07-14T23:00:00.000Z')).toBe('STORE_QUARANTINED');
    });
  }
});

describe('AS1 F05 pidfd capability bridge + retained writer-lock descriptor (§11.1)', () => {
  it('executes the sealed byte-identified literal through the pinned interpreter FD and returns CAPABILITY_READY', async () => {
    // The mutation-free capability probe verifies the exact interpreter object, hashes and pins its no-follow FD,
    // executes that same FD as child /proc/self/fd/3, and self-pidfd polls — signalling nothing.
    const result = await probeCapability();
    expect(result.operation).toBe('CAPABILITY_PROBE');
    expect(result.outcome).toBe('CAPABILITY_READY');
    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  it('the mutation-free probe is repeatable and never signals a process', async () => {
    const first = await probeCapability();
    const second = await probeCapability();
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
  });

  it('a signal request against an absent owner lock fails closed as OWNER_EXITED before any signal', async () => {
    const root = await makeStateRoot();
    const result = await signalOwner(path.join(root, 'locks', 'absent-writer.lock'), 'CLEAN_STOP');
    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('OWNER_EXITED');
  });

  it('retains a close-on-exec descriptor for a foreground lock and releases it under identity agreement', async () => {
    const root = await makeStateRoot();
    const lock = await WriterLock.acquire(root, {
      buildId: 'as1-slack-pilot',
      stateRootId: 'test-state-root',
      acquiredAt: '2026-07-14T22:00:00.000Z',
      retainForForeground: true,
    });
    expect(typeof lock.retainedFd()).toBe('number');
    await lock.release(); // no-follow reopen must agree on device/inode/type/owner/one-link/mode/bytes
    expect(lock.retainedFd()).toBeNull();
  });

  it('a one-shot (non-foreground) acquire closes its descriptor but still releases the same v1 record', async () => {
    const root = await makeStateRoot();
    const lock = await WriterLock.acquire(root, {
      buildId: 'as1-slack-pilot',
      stateRootId: 'test-state-root',
      acquiredAt: '2026-07-14T22:00:00.000Z',
    });
    expect(lock.retainedFd()).toBeNull();
    await lock.release();
  });

  it('a second foreground acquire on the same root fails closed until the first releases', async () => {
    const root = await makeStateRoot();
    const first = await WriterLock.acquire(root, {
      buildId: 'as1-slack-pilot',
      stateRootId: 'test-state-root',
      acquiredAt: '2026-07-14T22:00:00.000Z',
      retainForForeground: true,
    });
    await expect(
      WriterLock.acquire(root, {
        buildId: 'as1-slack-pilot',
        stateRootId: 'test-state-root',
        acquiredAt: '2026-07-14T22:00:01.000Z',
        retainForForeground: true,
      }),
    ).rejects.toThrow();
    await first.release();
    const second = await WriterLock.acquire(root, {
      buildId: 'as1-slack-pilot',
      stateRootId: 'test-state-root',
      acquiredAt: '2026-07-14T22:00:02.000Z',
      retainForForeground: true,
    });
    await second.release();
  });
});
