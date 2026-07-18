import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { chmod, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { As1SlackControl, readDurableKillProof } from '../../src/operations/readiness/as1-slack-control.js';
import { As1GatewayComposition, AS1_STRATEGY_STATE_ROOTS, controlProfileControlPort, parseRuntimeDescriptor, strategyDirectBindingFor, type As1CompositionDependencies } from '../../src/runtime/as1-slack-pilot/composition.js';
import { assertAs1StrategyProfileId } from '../../src/application/slack-pilot/profiles.js';
import {
  allStrategyEntries,
  resolveStrategyEntry,
  AS1_FIXED_TRUSTED_NODE,
  AS1_OWNER_STATE_ROOT,
  checkTrustedNode,
  parseAs1Cli,
  preflightTrustedNode,
  runAs1Cli,
  runForegroundOwner,
  runObserverSignal,
  TRUSTED_NODE_REQUIRED,
  type As1ForegroundOwnerBoundary,
  type As1OwnerSignal,
} from '../../src/runtime/as1-slack-pilot/cli.js';
import { canonicalBytes } from '../../src/persistence/file-store/canonical-json.js';
import {
  AS1_FIXED_OWNER_LOCK_PATH,
  AS1_PIDFD_BRIDGE_LITERAL_IDENTITY,
  deriveSignalRequest,
  preserveOriginalRootTree,
  probeCapability,
  WriterLock,
  type As1BridgeChildOutput,
  type As1BridgeResult,
  type As1OriginalRootPreservationSeams,
  type As1PreservationEntry,
} from '../../src/persistence/file-store/writer-lock.js';
import { FakeClock, secretText, validSecretValues, writeSecretFile } from '../helpers/as1-slack-fakes.js';
import { makeStateRoot } from '../helpers/fixtures.js';
/** A dependency graph with the COMPLETE method shape `assertCompleteDependencies` probes (the owner build gate); the
 *  composition factory is spied out, so it is never actually invoked. */
function dummyCompleteDeps(): As1CompositionDependencies {
  const fn = (): Promise<null> => Promise.resolve(null);
  return {
    gitSource: { observe: fn, getRepositoryId: () => 'foundation-docs' },
    web: { authTest: fn, botsInfo: fn, postMessage: fn },
    tmuxPort: { observe: fn, bufferExists: fn, loadVerifiedBuffer: fn, pasteBuffer: fn, sendEnter: fn, deleteBuffer: fn },
    buildSocket: () => ({}),
    buildReceiveGrantProvenance: () => ({ assertAccepted: fn }),
    buildDeliveryProvenance: () => ({ assertAccepted: fn }),
    evidenceVerifier: { verify: fn },
    missionAuthorityRoot: 'advisor/jobs/x',
  } as unknown as As1CompositionDependencies;
}

const BRIDGE_RESULT_SCHEMA = 'agent-office.as1-pidfd-bridge-result.v1';

describe('AS1 Strategy fixed CLI bindings', () => {
  it('binds fixed Strategy commands and roots without caller-selected routing', () => {
    // Exactly two fixed entries, in closed order — never a lookup by arbitrary string.
    const entries = allStrategyEntries();
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.profileId)).toStrictEqual(['AGENT_OFFICE_STRATEGY', 'FOUNDATION_STRATEGY']);

    const ao = resolveStrategyEntry('AGENT_OFFICE_STRATEGY');
    expect(ao.stateRoot).toBe('/home/leo/.local/state/agent-office/strategy-agent-office-v1');
    expect(ao.secretFilePath).toBe('/home/leo/.config/agent-office/strategy-slack-apps.env');
    expect(ao.binding.destinationPaneId).toBe('%48');
    expect(ao.binding.sessionName).toBe('agent-office-strategy-sol');
    expect(ao.binding.workspace).toBe('/home/leo/Project/agent-office');
    expect(ao.binding.currentCommand).toBe('codex');

    const fdn = resolveStrategyEntry('FOUNDATION_STRATEGY');
    expect(fdn.stateRoot).toBe('/home/leo/.local/state/agent-office/strategy-foundation-v1');
    expect(fdn.secretFilePath).toBe('/home/leo/.config/agent-office/strategy-slack-apps.env');
    expect(fdn.binding.destinationPaneId).toBe('%31');
    expect(fdn.binding.sessionName).toBe('foundation-strategy-sol');
    expect(fdn.binding.workspace).toBe('/home/leo/Project/FOUNDATION');

    // The fixed roots are DISTINCT and match the composition's fixed root map (the sole isolation source).
    expect(AS1_STRATEGY_STATE_ROOTS.AGENT_OFFICE_STRATEGY).toBe(ao.stateRoot);
    expect(AS1_STRATEGY_STATE_ROOTS.FOUNDATION_STRATEGY).toBe(fdn.stateRoot);
    expect(ao.stateRoot).not.toBe(fdn.stateRoot);

    // No caller-selected routing: bindings are a pure function of the closed literal; both resolve, secret path shared.
    expect(strategyDirectBindingFor('AGENT_OFFICE_STRATEGY').destinationPaneId).toBe('%48');
    expect(ao.secretFilePath).toBe(fdn.secretFilePath);
    // An arbitrary / Advisor string is not a Strategy literal — fails closed (never a third route).
    expect(() => assertAs1StrategyProfileId('AGENT_OFFICE_ADVISOR')).toThrow();
    expect(() => assertAs1StrategyProfileId('strategy-agent-office-v1')).toThrow();
  });
});
/** Craft a canonical bridge child output (F05 strict-decode / deadline tests). */
function craftBridgeOutput(record: Record<string, unknown>, code: number): As1BridgeChildOutput {
  return {
    stdout: Buffer.concat([canonicalBytes(record), Buffer.from('\n', 'utf8')]),
    stderrBytes: 0,
    code,
    signal: null,
    timedOut: false,
    overflow: false,
  };
}

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

  it('F01 (Patch 4): shutdown() with admission CLOSED between its internal transitions never reaches DISABLED_CLEAN', async () => {
    const { control } = await makeControl();
    try {
      await control.transition('DISABLED_DEFAULT', 'RECEIVE_GRANTED_ONE_PROFILE', 'agent-office-advisor');
      await control.transition('RECEIVE_GRANTED_ONE_PROFILE', 'AUTHENTICATING_ONE_PROFILE');
      await control.transition('AUTHENTICATING_ONE_PROFILE', 'RECEIVING_ONE_PROFILE');
      // The clean drain is active -> DRAINING -> DISABLED_CLEAN. An incident that closed admission before/DURING the
      // first transition must stop the synchronous guard BEFORE the DISABLED_CLEAN transition — the object is left at
      // DRAINING so the caller (finishCleanup) then engages the durable kill instead of a masked clean disable.
      await control.shutdown(() => false);
      expect(control.getState()).toBe('DRAINING');
      expect(control.getState()).not.toBe('DISABLED_CLEAN');
      // The caller escalates the DRAINING object to the durable kill (as finishCleanup does on a pending incident).
      await control.operatorIncidentKill();
      expect(control.getState()).toBe('DISABLED_LATCHED');
      expect(control.isGloballyLatched()).toBe(true);
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

  it('signal-key derivation against an absent owner lock fails closed as OWNER_EXITED (no signal, no pidfd)', async () => {
    const root = await makeStateRoot();
    const derived = await deriveSignalRequest(path.join(root, 'locks', 'absent-writer.lock'));
    expect(derived.ok).toBe(false);
    if (!derived.ok) expect(derived.outcome).toBe('OWNER_EXITED');
  });

  it('signal-key derivation rejects a wrong-mode owner lock as OWNER_MISMATCH (no signal)', async () => {
    const root = await makeStateRoot();
    const lockPath = path.join(root, 'locks', 'writer.lock');
    await writeFile(lockPath, '{"schemaVersion":"agent-office.writer-lock.v1","pid":1}\n', { mode: 0o644 });
    const derived = await deriveSignalRequest(lockPath);
    expect(derived.ok).toBe(false);
    if (!derived.ok) expect(derived.outcome).toBe('OWNER_MISMATCH');
  });

  it('F05: the strict bridge decoder rejects a failure result whose keys are not exactly {operation,outcome,schemaVersion}', async () => {
    const bad = await probeCapability({
      childRunner: () => Promise.resolve(craftBridgeOutput({ extra: 'x', outcome: 'OWNER_MISMATCH', schemaVersion: BRIDGE_RESULT_SCHEMA }, 66)),
    });
    expect(bad.outcome).toBe('INTERNAL_ERROR'); // wrong third key → never a trusted outcome
    const unparsed = await probeCapability({
      childRunner: () => Promise.resolve(craftBridgeOutput({ operation: 'UNPARSED', outcome: 'REQUEST_REJECTED', schemaVersion: BRIDGE_RESULT_SCHEMA }, 64)),
    });
    expect(unparsed.outcome).toBe('REQUEST_REJECTED'); // operation === UNPARSED is the reviewed accepted sentinel
    expect(unparsed.ok).toBe(false);
  });

  it('F05: a bridge result arriving after the total-operation deadline is BRIDGE_TIMEOUT even on exit 0 (late success is failure)', async () => {
    let t = 0;
    const monoClock = (): number => {
      const value = t;
      t += 5_000; // the completion reading exceeds the 3,000 ms total-operation bound
      return value;
    };
    const success = craftBridgeOutput({ operation: 'CAPABILITY_PROBE', outcome: 'CAPABILITY_READY', pythonVersion: '3.14.4', schemaVersion: BRIDGE_RESULT_SCHEMA }, 0);
    const result: As1BridgeResult = await probeCapability({ nowMs: monoClock, childRunner: () => Promise.resolve(success) });
    expect(result.outcome).toBe('BRIDGE_TIMEOUT');
    expect(result.ok).toBe(false);
  });

  it('F05: release rejects a JSON-equivalent but NONCANONICAL lock tampering (exact-byte ownership)', async () => {
    const root = await makeStateRoot();
    const lock = await WriterLock.acquire(root, { buildId: 'as1-slack-pilot', stateRootId: 'test-state-root', acquiredAt: '2026-07-14T22:00:00.000Z' });
    const lockPath = path.join(root, 'locks', 'writer.lock');
    const record = JSON.parse(await readFile(lockPath, 'utf8')) as Record<string, unknown>;
    // Same JSON value, reversed key order → JSON-equivalent but not the exact canonical-plus-one-LF bytes.
    await writeFile(lockPath, `${JSON.stringify(record, Object.keys(record).sort().reverse())}\n`, { mode: 0o600 });
    // Noncanonical bytes prove ownership NOT positively → release fails closed (LOST), unlinking nothing. The
    // throwing `release()` delegate surfaces the phase-aware LOST outcome (F01-B); the F05 exact-byte contract holds.
    await expect(lock.release()).rejects.toThrow(/did not prove a clean namespace release \(LOST:/u);
  });

  const NEVER = (): Promise<never> => new Promise<never>(() => undefined);

  it('F05: the observer STOP proves lock removal after SIGNAL_SENT (STOPPED_CLEAN vs STOP_TIMEOUT)', async () => {
    const sent = (): Promise<As1BridgeResult> => Promise.resolve({ ok: true, operation: 'CLEAN_STOP', outcome: 'SIGNAL_SENT', exitCode: 0 });
    // Removed within the bound: the deadline never fires (never-resolving timer), the lock-removal observation wins.
    const clean = await runObserverSignal('CLEAN_STOP', { signal: sent, lockRemoved: () => Promise.resolve(true), delay: () => Promise.resolve(), deadlineTimer: NEVER });
    expect(clean.ok).toBe(true);
    expect(clean.lines.join('|')).toContain('STOPPED_CLEAN');
    // Never removed: the single monotonic deadline fires, the poll loop is bounded, and STOP_TIMEOUT is returned.
    const timedOut = await runObserverSignal('CLEAN_STOP', { signal: sent, lockRemoved: () => Promise.resolve(false), delay: () => Promise.resolve(), deadlineTimer: () => Promise.resolve() });
    expect(timedOut.ok).toBe(false);
    expect(timedOut.lines.join('|')).toContain('STOP_TIMEOUT');
  });

  it('F05: incident-kill maps every reviewed post-signal outcome (engaged/already-engaged/persist-failed/no-live-owner)', async () => {
    const sent = (): Promise<As1BridgeResult> => Promise.resolve({ ok: true, operation: 'INCIDENT_KILL', outcome: 'SIGNAL_SENT', exitCode: 0 });
    // Fresh engage: NOT durably killed before signaling, killed AFTER lock removal → INCIDENT_KILL_ENGAGED.
    let killReads = 0;
    const freshlyKilled = (): Promise<boolean> => Promise.resolve(killReads++ > 0);
    const engaged = await runObserverSignal('INCIDENT_KILL', { signal: sent, lockRemoved: () => Promise.resolve(true), durableKilled: freshlyKilled, delay: () => Promise.resolve(), deadlineTimer: NEVER });
    expect(engaged.ok).toBe(true);
    expect(engaged.lines.join('|')).toContain('INCIDENT_KILL_ENGAGED');
    // Already killed BEFORE signaling → idempotent INCIDENT_KILL_ALREADY_ENGAGED.
    const already = await runObserverSignal('INCIDENT_KILL', { signal: sent, lockRemoved: () => Promise.resolve(true), durableKilled: () => Promise.resolve(true), delay: () => Promise.resolve(), deadlineTimer: NEVER });
    expect(already.lines.join('|')).toContain('INCIDENT_KILL_ALREADY_ENGAGED');
    // Lock removed within the bound but the kill is never durable → INCIDENT_KILL_PERSIST_FAILED (never success).
    const persistFailed = await runObserverSignal('INCIDENT_KILL', { signal: sent, lockRemoved: () => Promise.resolve(true), durableKilled: () => Promise.resolve(false), delay: () => Promise.resolve(), deadlineTimer: NEVER });
    expect(persistFailed.ok).toBe(false);
    expect(persistFailed.lines.join('|')).toContain('INCIDENT_KILL_PERSIST_FAILED');
    // An absent owner (OWNER_EXITED) → NO_LIVE_OWNER.
    const absent = await runObserverSignal('CLEAN_STOP', { signal: () => Promise.resolve({ ok: false, operation: 'CLEAN_STOP', outcome: 'OWNER_EXITED', exitCode: null }) });
    expect(absent.lines.join('|')).toContain('NO_LIVE_OWNER');
  });

  it('F05: a NEVER-resolving lock-removal observation is bounded by the deadline and returns INCIDENT_KILL_TIMEOUT', async () => {
    const sent = (): Promise<As1BridgeResult> => Promise.resolve({ ok: true, operation: 'INCIDENT_KILL', outcome: 'SIGNAL_SENT', exitCode: 0 });
    // The lock-removal proof never settles; the single monotonic deadline must win the race and return the stable
    // timeout WITHIN the bound (measuring an eventual return is not enforcement).
    const late = await runObserverSignal('INCIDENT_KILL', {
      signal: sent,
      lockRemoved: NEVER,
      durableKilled: () => Promise.resolve(true),
      delay: () => Promise.resolve(),
      deadlineTimer: () => Promise.resolve(),
    });
    expect(late.ok).toBe(false);
    expect(late.lines.join('|')).toContain('INCIDENT_KILL_TIMEOUT');
  });

  it('F05: a NEVER-resolving POST-signal durable-kill proof (after the lock is removed) is bounded by the deadline and returns INCIDENT_KILL_TIMEOUT', async () => {
    const sent = (): Promise<As1BridgeResult> => Promise.resolve({ ok: true, operation: 'INCIDENT_KILL', outcome: 'SIGNAL_SENT', exitCode: 0 });
    // The pre-signal idempotency read resolves (not-already-killed), then the lock is observed removed; only the
    // POST-signal durable-kill *proof* read never settles. The same single monotonic deadline must still win THAT
    // race and return the stable timeout WITHIN the bound — a durable-kill read past the bound is NOT proof. The
    // short real deadline (20ms) lets microtask-immediate lock removal win first, isolating the post-signal read.
    let durableKilledCalls = 0;
    const late = await runObserverSignal('INCIDENT_KILL', {
      signal: sent,
      lockRemoved: () => Promise.resolve(true),
      durableKilled: () => {
        durableKilledCalls += 1;
        // Call #1 is the pre-signal idempotency observation; call #2 is the bounded post-signal proof read.
        return durableKilledCalls >= 2 ? NEVER() : Promise.resolve(false);
      },
      delay: () => Promise.resolve(),
      deadlineTimer: () => new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 20);
        if (typeof timer.unref === 'function') timer.unref();
      }),
    });
    expect(late.ok).toBe(false);
    expect(late.lines.join('|')).toContain('INCIDENT_KILL_TIMEOUT');
    expect(durableKilledCalls).toBe(2);
  });

  it('F05: the durable-kill decoder accepts only an EXACT killed record; malformed/extra-key/non-kill is never proof', async () => {
    const controlFile = (root: string): string => path.join(root, 'indexes/as1-slack-pilot/global-control.json');
    // A durably killed owner record → KILLED.
    const killed = await makeControl();
    await killed.control.engageGlobalKill('operator incident test');
    await killed.control.close();
    expect(await readDurableKillProof(killed.root)).toBe('KILLED');
    // A fresh, well-formed but non-killed record → NOT_KILLED (never a false positive).
    const clean = await makeControl();
    await clean.control.close();
    expect(await readDurableKillProof(clean.root)).toBe('NOT_KILLED');
    // A malformed/extra-key replacement of the killed record is NEVER accepted as proof → UNREADABLE.
    const raw = JSON.parse(await readFile(controlFile(killed.root), 'utf8')) as Record<string, unknown>;
    await writeFile(controlFile(killed.root), `${JSON.stringify({ ...raw, injected: true })}\n`, { mode: 0o600 });
    expect(await readDurableKillProof(killed.root)).toBe('UNREADABLE');
  });

  it('F05: the durable-kill decoder rejects a JSON-EQUIVALENT but NONCANONICAL killed record (exact canonical bytes are the proof)', async () => {
    const controlFile = (root: string): string => path.join(root, 'indexes/as1-slack-pilot/global-control.json');
    const killed = await makeControl();
    await killed.control.engageGlobalKill('operator incident test');
    await killed.control.close();
    // The EXACT canonical record (canonical bytes + one terminal LF) is the ONLY accepted durable-kill proof.
    expect(await readDurableKillProof(killed.root)).toBe('KILLED');
    const record = JSON.parse(await readFile(controlFile(killed.root), 'utf8')) as Record<string, unknown>;
    // Pretty-printed: byte-different, JSON-equivalent. A JSON-only decoder would still accept it as KILLED; the exact
    // canonical-byte decoder must reject the noncanonical whitespace as UNPROVEN.
    await writeFile(controlFile(killed.root), `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
    expect(await readDurableKillProof(killed.root)).toBe('UNREADABLE');
    // Reordered keys: byte-different, JSON-equivalent. Same rejection — acceptance is never inferred from the parsed
    // value alone.
    const reordered = Object.fromEntries(Object.entries(record).reverse());
    await writeFile(controlFile(killed.root), `${JSON.stringify(reordered)}\n`, { mode: 0o600 });
    expect(await readDurableKillProof(killed.root)).toBe('UNREADABLE');
    // Whitespace-extended (a trailing space before the LF): byte-different, JSON-equivalent. Still not proof.
    await writeFile(controlFile(killed.root), `${JSON.stringify(record)} \n`, { mode: 0o600 });
    expect(await readDurableKillProof(killed.root)).toBe('UNREADABLE');
  });

  it('F05: a retained-object REPLACEMENT after the read (fixed leaf unlinked+replaced) is rejected — stale bytes are not proof', async () => {
    const controlFile = (root: string): string => path.join(root, 'indexes/as1-slack-pilot/global-control.json');
    const killed = await makeControl();
    await killed.control.engageGlobalKill('operator incident test');
    await killed.control.close();
    const canonical = await readFile(controlFile(killed.root));
    // The retained descriptor reads the valid killed bytes, but BEFORE the post-read identity re-check the fixed leaf
    // is unlinked and replaced with a fresh object: the retained descriptor's link count is now zero and the leaf
    // names another inode. Even though a fresh open would find a valid killed record, the STALE retained bytes bound
    // to an object no longer at the fixed leaf must NOT be accepted.
    const proof = await readDurableKillProof(killed.root, {
      afterRetainedRead: async () => {
        await rm(controlFile(killed.root));
        await writeFile(controlFile(killed.root), canonical, { mode: 0o600 }); // a NEW inode with identical content
      },
    });
    expect(proof).toBe('UNREADABLE');
    // The seam alone does not reject: with no interleaved mutation the same record still proves KILLED.
    expect(await readDurableKillProof(killed.root)).toBe('KILLED');
  });

  it('F05: a SAME-SIZE in-place tamper of the retained object after the read is rejected (mutation metadata moved)', async () => {
    const controlFile = (root: string): string => path.join(root, 'indexes/as1-slack-pilot/global-control.json');
    const killed = await makeControl();
    await killed.control.engageGlobalKill('operator incident test');
    await killed.control.close();
    const canonical = await readFile(controlFile(killed.root));
    // In-place overwrite of the SAME inode with the SAME byte length: size is unchanged, but mtime/ctime move, so the
    // post-read re-fstat rejects the object — the bytes already read are no longer trustworthy proof of current state.
    const sameSize = Buffer.alloc(canonical.length, 0x20);
    const proof = await readDurableKillProof(killed.root, {
      afterRetainedRead: async () => {
        await writeFile(controlFile(killed.root), sameSize, { mode: 0o600 });
      },
    });
    expect(proof).toBe('UNREADABLE');
  });

  it('F05: an owner-only-mode/metadata change of the retained object after the read is rejected', async () => {
    const controlFile = (root: string): string => path.join(root, 'indexes/as1-slack-pilot/global-control.json');
    const killed = await makeControl();
    await killed.control.engageGlobalKill('operator incident test');
    await killed.control.close();
    // A metadata change (group-readable) after the read: the post-read re-fstat sees a changed mode and a no-longer
    // owner-only object, so the record is not accepted as proof.
    const proof = await readDurableKillProof(killed.root, {
      afterRetainedRead: async () => {
        await chmod(controlFile(killed.root), 0o640);
      },
    });
    expect(proof).toBe('UNREADABLE');
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

  it('F01-B: a POST-unlink release failure CEDES authority irrevocably; a second writer acquires the freed namespace and the old lock never re-releases', async () => {
    const root = await makeStateRoot();
    const first = await WriterLock.acquire(root, {
      buildId: 'as1-slack-pilot',
      stateRootId: 'test-state-root',
      acquiredAt: '2026-07-14T22:00:00.000Z',
      retainForForeground: true,
    });
    const acquired: { second: WriterLock | null } = { second: null };
    try {
      const outcome = await first.releaseAuthority({
        afterNamespaceUnlink: async () => {
          // The namespace lock is now FREE (unlinked). A SECOND writer acquires it at this exact interleaving — proving
          // the old owner already ceded the namespace...
          acquired.second = await WriterLock.acquire(root, {
            buildId: 'as1-slack-pilot',
            stateRootId: 'test-state-root',
            acquiredAt: '2026-07-14T22:00:01.000Z',
            retainForForeground: true,
          });
          // ...and a post-unlink durability failure is simulated; the old owner's authority is ALREADY irrevocably gone.
          throw new Error('post-unlink durability failure');
        },
      });
      expect(acquired.second).not.toBeNull(); // a second writer holds the freed namespace before any old-owner mutation
      expect(outcome.authority).toBe('RELEASED'); // authority is IRREVOCABLY ceded despite the post-unlink failure
      if (outcome.authority !== 'RELEASED') throw new Error('expected RELEASED');
      expect(outcome.cleanupAmbiguity).not.toBeNull(); // the ambiguity is surfaced, never a clean claim
      expect(first.isReleased()).toBe(true); // the old lock can no longer act
      // Idempotent + non-authority-bearing: the old lock never re-acquires or re-unlinks the now-second-owned leaf.
      expect(await first.releaseAuthority()).toEqual({ authority: 'RELEASED', cleanupAmbiguity: null });
    } finally {
      if (acquired.second !== null) await acquired.second.release();
    }
  });
});

describe('AS1 R2 fixed root/ID and sealed bridge identity (R2 recovery design §4)', () => {
  const R2_ROOT = '/home/leo/.local/state/agent-office/as1-slack-pilot-r2';
  const OLD_ROOT = '/home/leo/.local/state/agent-office/as1-slack-pilot';

  it('resolves ONLY the fixed R2 owner state root and R2 writer lock — never the original root', () => {
    // start / redacted-check compare AS1_SLACK_STATE_ROOT to this literal, and the zero-operand observer verbs resolve
    // only it, so the original root and any other value fail closed before initialization.
    expect(AS1_OWNER_STATE_ROOT).toBe(R2_ROOT);
    expect(AS1_FIXED_OWNER_LOCK_PATH).toBe(`${R2_ROOT}/locks/writer.lock`);
    expect(AS1_OWNER_STATE_ROOT).not.toBe(OLD_ROOT);
    expect(AS1_FIXED_OWNER_LOCK_PATH).not.toBe(`${OLD_ROOT}/locks/writer.lock`);
    // The internal durable namespace and protocol names are NOT state-root selectors and are unchanged.
    expect(AS1_OWNER_STATE_ROOT.endsWith('as1-slack-pilot-r2')).toBe(true);
  });

  it('is the frozen sealed bridge with EXACTLY 17,989 bytes, sha256 d5b831e2…, and only the two -r2 substitutions', () => {
    const { bytes, sha256, source } = AS1_PIDFD_BRIDGE_LITERAL_IDENTITY;
    // The declared identity equals the design-normative values.
    expect(bytes).toBe(17_989);
    expect(sha256).toBe('sha256:d5b831e29dfb19b23f194e928258d74f2a43a2bfb51fa76350ec6595537a8de2');
    // The declared identity is RECOMPUTED from the staged literal and must equal it (drift fails the sealed spawn).
    expect(Buffer.byteLength(source, 'utf8')).toBe(bytes);
    expect(`sha256:${createHash('sha256').update(Buffer.from(source, 'utf8')).digest('hex')}`).toBe(sha256);
    // Substitution 1: the embedded LOCK_PATH is the R2 lock and equals the TS-exported fixed lock; the old path is gone.
    expect(source).toContain(`LOCK_PATH = "${R2_ROOT}/locks/writer.lock"`);
    expect(source).toContain(`LOCK_PATH = "${AS1_FIXED_OWNER_LOCK_PATH}"`);
    expect(source).not.toContain(`LOCK_PATH = "${OLD_ROOT}/locks/writer.lock"`);
    // Substitution 2: the expected lock-record stateRootId is R2; the old comparison is gone.
    expect(source).toContain('value["stateRootId"] == "as1-slack-pilot-r2"');
    expect(source).not.toContain('value["stateRootId"] == "as1-slack-pilot"');
    // buildId and every other sealed fact are UNCHANGED: buildId stays as1-slack-pilot; the executable argv and secret
    // file name (protocol namespaces, not state-root selectors) are unchanged.
    expect(source).toContain('value["buildId"] == "as1-slack-pilot"');
    expect(source).not.toContain('value["buildId"] == "as1-slack-pilot-r2"');
    expect(source).toContain('dist/core/runtime/as1-slack-pilot/cli.js');
    expect(source).toContain('/home/leo/.config/agent-office/as1-slack-pilot.env');
  });
});

// R2 recovery design §4.4: the fixed descriptor-relative original-root preservation ALGORITHM, proven over a
// TEMPORARY SYNTHETIC tree with injected filesystem/process seams. No real state-root literal is opened, inspected,
// chmod-ed, sealed, or digested — the seams model everything, and a synthetic old lock/owner is created only at the
// deterministic boundary AFTER the initial scan.
interface SyntheticState {
  entries: As1PreservationEntry[];
  process: boolean;
  lock: boolean;
  root: { dev: string; ino: string; mountId: string };
  scans: number;
  sealNamespaceCalls: number;
  sealedEntries: string[];
}

const ROOT_ID = { dev: '2049', ino: '100', mountId: 'm1' };
const baseEntries = (): As1PreservationEntry[] => [
  { type: 'DIR', relativePath: '.', identity: ROOT_ID, writable: true, immutable: false },
  { type: 'DIR', relativePath: 'locks', identity: { dev: '2049', ino: '101', mountId: 'm1' }, writable: true, immutable: false },
  { type: 'DIR', relativePath: 'indexes/as1-slack-pilot', identity: { dev: '2049', ino: '102', mountId: 'm1' }, writable: true, immutable: false },
  { type: 'FILE', relativePath: 'indexes/as1-slack-pilot/global-control.json', identity: { dev: '2049', ino: '103', mountId: 'm1' }, writable: true, immutable: false },
];

function makeSeams(opts: {
  onInitialScan?: (s: SyntheticState) => void;
  process?: boolean;
  lock?: boolean;
  rejectEntry?: boolean;
  manifestUnproven?: boolean;
  incompleteSeal?: boolean;
} = {}): { seams: As1OriginalRootPreservationSeams; state: SyntheticState } {
  const state: SyntheticState = {
    entries: baseEntries(),
    process: opts.process ?? false,
    lock: opts.lock ?? false,
    root: { ...ROOT_ID },
    scans: 0,
    sealNamespaceCalls: 0,
    sealedEntries: [],
  };
  const seal = (path: string): void => {
    if (opts.incompleteSeal === true) return; // simulate a partial/unsupported seal — the entry stays writable
    for (const entry of state.entries) {
      if (entry.relativePath === path || (path === 'namespace' && (entry.relativePath === '.' || entry.relativePath === 'locks'))) {
        const i = state.entries.indexOf(entry);
        state.entries[i] = { ...entry, writable: false, immutable: true };
      }
    }
  };
  const seams: As1OriginalRootPreservationSeams = {
    reproveInstalledR2Manifest: () => opts.manifestUnproven !== true,
    as1ProcessActive: () => state.process,
    originalLockPresent: () => state.lock,
    currentRootIdentity: () => state.root,
    scanEntries: () => {
      state.scans += 1;
      if (opts.rejectEntry === true) throw new DomainError('INVALID_SCHEMA', 'symlink component rejected');
      if (state.scans === 1 && opts.onInitialScan !== undefined) opts.onInitialScan(state); // inject the race AFTER the initial scan
      return state.entries.map((e) => ({ ...e }));
    },
    computeDigest: (entries) =>
      // Byte/path digest EXCLUDES mode/immutable metadata (design §4.4.2 step 4), so it is stable across sealing.
      canonicalBytes(entries.map((e) => [e.type, e.relativePath, e.identity.dev, e.identity.ino, e.identity.mountId])).toString('hex'),
    sealNamespace: () => {
      state.sealNamespaceCalls += 1;
      seal('namespace');
    },
    sealEntry: (path) => {
      state.sealedEntries.push(path);
      seal(path);
    },
  };
  return { seams, state };
}

describe('AS1 R2 original-root preservation algorithm (R2 recovery design §4.4)', () => {
  it('PRESERVES a quiescent synthetic tree: equal initial/final byte-path digest, complete zero-write + immutable seal', () => {
    const { seams, state } = makeSeams();
    const outcome = preserveOriginalRootTree(seams);
    expect(outcome.kind).toBe('PRESERVED');
    if (outcome.kind !== 'PRESERVED') throw new Error('expected PRESERVED');
    expect(outcome.initialDigest).toBe(outcome.finalDigest); // final digest computed only after final proofs, equals initial
    expect(outcome.entryCount).toBe(4);
    expect(state.sealNamespaceCalls).toBe(1);
    expect(state.entries.every((e) => !e.writable && e.immutable)).toBe(true);
  });

  it('reports ORIGINAL_ROOT_BUSY (before ANY permission change) when a process or lock exists at entry', () => {
    const withProcess = makeSeams({ process: true });
    expect(preserveOriginalRootTree(withProcess.seams).kind).toBe('ORIGINAL_ROOT_BUSY');
    expect(withProcess.state.sealNamespaceCalls).toBe(0);
    const withLock = makeSeams({ lock: true });
    expect(preserveOriginalRootTree(withLock.seams).kind).toBe('ORIGINAL_ROOT_BUSY');
    expect(withLock.state.sealNamespaceCalls).toBe(0);
  });

  it('reports ORIGINAL_ROOT_PRESERVATION_RACE when a synthetic lock is created AFTER the initial scan — no seal, no success', () => {
    const { seams, state } = makeSeams({ onInitialScan: (s) => { s.lock = true; } });
    const outcome = preserveOriginalRootTree(seams);
    expect(outcome.kind).toBe('ORIGINAL_ROOT_PRESERVATION_RACE');
    expect(state.sealNamespaceCalls).toBe(0); // NO remaining permission change
    expect(state.sealedEntries).toHaveLength(0);
  });

  it('rejects a root-inode SUBSTITUTION through the pinned-parent comparison', () => {
    const { seams, state } = makeSeams({ onInitialScan: (s) => { s.root = { dev: '2049', ino: '999', mountId: 'm1' }; } });
    const outcome = preserveOriginalRootTree(seams);
    expect(outcome.kind).toBe('ORIGINAL_ROOT_PRESERVATION_RACE');
    if (outcome.kind !== 'ORIGINAL_ROOT_PRESERVATION_RACE') throw new Error('expected RACE');
    expect(outcome.reason).toContain('ROOT_IDENTITY_DRIFT');
    expect(state.sealNamespaceCalls).toBe(0);
  });

  it('fails closed to HOLD on a rejected contained component (symlink/hard-link/mount/path escape)', () => {
    expect(preserveOriginalRootTree(makeSeams({ rejectEntry: true }).seams).kind).toBe('HOLD');
  });

  it('fails closed to HOLD when the seal is incomplete (a writable/mutable inode remains — unsupported immutable flag)', () => {
    const outcome = preserveOriginalRootTree(makeSeams({ incompleteSeal: true }).seams);
    expect(outcome.kind).toBe('HOLD');
    if (outcome.kind !== 'HOLD') throw new Error('expected HOLD');
    expect(outcome.reason).toBe('INCOMPLETE_SEAL');
  });

  it('fails closed to HOLD when the installed R2-only manifest is unproven', () => {
    expect(preserveOriginalRootTree(makeSeams({ manifestUnproven: true }).seams).kind).toBe('HOLD');
  });
});

// handoff 112 (Founder Leo-only minimal recovery): the enterprise F02 privileged-helper/manifest/journal/immutable-seal
// model is SUPERSEDED and deferred; setup §10.6 is now the concise trusted-server rule, and the CLI adds only the fixed
// trusted-Node preflight. These prove the superseded documentation, the deterministic preflight, and its CLI ordering.
describe('AS1 R2 original-root handling — trusted-server rule (setup §10.6, handoff 112)', () => {
  const setup = readFileSync(path.join(REPO_ROOT, 'docs/operations/AGENT_OFFICE_AS1_SLACK_SETUP.md'), 'utf8');
  const section106 = setup.slice(setup.indexOf('### 10.6'));

  it('marks the enterprise F02 helper/manifest/journal/immutable-seal model superseded and deferred, with no sealing claim', () => {
    expect(section106).toContain('trusted-server rule');
    expect(section106).toContain('SUPERSEDES the enterprise-grade F02 threat model');
    expect(section106).toContain('deferred to a separate later commercial hardening mission');
    expect(section106).toContain('no immutable sealing'); // do NOT claim sealing occurred
    expect(section106).toContain('The only active state root is the fixed R2 root');
    expect(section106).toContain('resets, deletes, modifies, reuses, copies, migrates, or actively resolves');
    // The trusted-Node CLI preflight replaces the privileged gate; the old false "helper exists"/HOLD text is gone.
    expect(section106).toContain('TRUSTED_NODE_REQUIRED');
    expect(section106).not.toContain('Production helper status — HOLD');
  });

  it('names the original-root STATE-ROOT literal ONLY inside §10.6, never before it, and keeps R2 the sole active root', () => {
    const beforeForensic = setup.slice(0, setup.indexOf('### 10.6'));
    // The bare original state-root literal (not the R2 root, not the internal namespace, not the cli.js argv path).
    expect(beforeForensic).not.toMatch(/state\/agent-office\/as1-slack-pilot(?![-/\w])/u);
    expect(AS1_OWNER_STATE_ROOT).toBe('/home/leo/.local/state/agent-office/as1-slack-pilot-r2');
  });
});

// handoff 112 §5.1/§6: the fixed trusted-Node preflight is a pure, deterministic seam — it requires ONLY the exact NVM
// path, a regular non-symlink file, an execute bit, and no group/world write; it may be owned by Leo, needs no root
// ownership/content-hash/inode-pin, and fails closed with the single redacted TRUSTED_NODE_REQUIRED (no path/metadata).
describe('AS1 fixed trusted-Node preflight (handoff 112 §5.1)', () => {
  const OK_FACTS = { isSymbolicLink: false, isFile: true, mode: 0o755 } as const;

  it('accepts exactly the fixed regular NVM Node executable (execute bit, no group/world write)', () => {
    expect(checkTrustedNode(AS1_FIXED_TRUSTED_NODE, OK_FACTS)).toBeNull();
    expect(checkTrustedNode(AS1_FIXED_TRUSTED_NODE, { isSymbolicLink: false, isFile: true, mode: 0o555 })).toBeNull();
  });

  it('rejects a wrong execPath with the single redacted reason and no path leak', () => {
    const reason = checkTrustedNode('/usr/bin/node', OK_FACTS);
    expect(reason).toBe(TRUSTED_NODE_REQUIRED);
    expect(reason).not.toContain('/home/leo');
  });

  it('rejects a symlink, a non-regular file, or a missing/unreadable fixed path', () => {
    expect(checkTrustedNode(AS1_FIXED_TRUSTED_NODE, { isSymbolicLink: true, isFile: false, mode: 0o777 })).toBe(TRUSTED_NODE_REQUIRED);
    expect(checkTrustedNode(AS1_FIXED_TRUSTED_NODE, { isSymbolicLink: false, isFile: false, mode: 0o755 })).toBe(TRUSTED_NODE_REQUIRED);
    expect(checkTrustedNode(AS1_FIXED_TRUSTED_NODE, null)).toBe(TRUSTED_NODE_REQUIRED);
  });

  it('rejects a file with no execute bit', () => {
    expect(checkTrustedNode(AS1_FIXED_TRUSTED_NODE, { isSymbolicLink: false, isFile: true, mode: 0o644 })).toBe(TRUSTED_NODE_REQUIRED);
  });

  it('rejects a group-writable or world-writable file', () => {
    expect(checkTrustedNode(AS1_FIXED_TRUSTED_NODE, { isSymbolicLink: false, isFile: true, mode: 0o775 })).toBe(TRUSTED_NODE_REQUIRED);
    expect(checkTrustedNode(AS1_FIXED_TRUSTED_NODE, { isSymbolicLink: false, isFile: true, mode: 0o757 })).toBe(TRUSTED_NODE_REQUIRED);
  });

  it('the async wrapper fails closed to the redacted reason on an unstattable path or a wrong interpreter', async () => {
    expect(await preflightTrustedNode(AS1_FIXED_TRUSTED_NODE, () => Promise.reject(new Error('ENOENT')))).toBe(TRUSTED_NODE_REQUIRED);
    expect(await preflightTrustedNode('/somewhere/else/node', () => Promise.resolve(OK_FACTS))).toBe(TRUSTED_NODE_REQUIRED);
    expect(await preflightTrustedNode(AS1_FIXED_TRUSTED_NODE, () => Promise.resolve(OK_FACTS))).toBeNull();
  });

  it('fails closed BEFORE dependency build / state-root initialization in the foreground-owner ordering seam', async () => {
    const calls = { buildDeps: false, initialize: false };
    const boundary = {
      descriptor: parseRuntimeDescriptor(JSON.parse(readFileSync(DESCRIPTOR_PATH, 'utf8'))),
      stateRoot: AS1_OWNER_STATE_ROOT,
      clock: { now: () => '2026-07-14T22:00:00.000Z' },
      buildDeps: () => { calls.buildDeps = true; return {}; },
      initialize: () => { calls.initialize = true; return Promise.resolve(); },
      installSignalHandlers: () => ['SIGINT', 'SIGTERM', 'SIGUSR2'],
      delay: () => Promise.resolve(),
      trustedNodePreflight: () => Promise.resolve(TRUSTED_NODE_REQUIRED),
    } as unknown as As1ForegroundOwnerBoundary;
    const result = await runForegroundOwner(boundary);
    expect(result.ok).toBe(false);
    expect(result.lines.join('|')).toContain(TRUSTED_NODE_REQUIRED);
    expect(result.lines.join('|')).not.toContain('.nvm'); // no path/metadata leak
    expect(calls.buildDeps).toBe(false); // no dependency graph (Web/tmux/network) built
    expect(calls.initialize).toBe(false); // no state-root mutation
  });
});

describe('AS1 PERSONAL_LEO_ONLY direct-result spool (handoff 119)', () => {
  it('isolates one PERSONAL_LEO_ONLY result failure and accepts the next message', async () => {
    // Drive the REAL runForegroundOwner loop against a minimal owner-shaped fake (one contained vi.spyOn of the
    // composition factory) — no full harness. The owner auto-consumes: the FIRST PERSONAL result post FAILS
    // (message-local), and the loop must NOT halt — it delivers + consumes a SECOND message (POSTED) before a clean stop.
    let deliverCalls = 0;
    let consumeCalls = 0;
    let observeCalls = 0;
    const events: string[] = [];
    const fakeComposition = {
      start: () => Promise.resolve({ connected: true, reason: 'RECEIVING_ARMED', state: 'RECEIVING_ONE_PROFILE' }),
      isPersonalLeoOnly: () => true,
      hasFailureBarrier: () => false,
      // Legacy grant re-observation MUST NOT be called in PERSONAL — record any call so the assertion below fails if the
      // owner ever consults the receive-grant/Git expiry for the direct %26 path.
      observeReceiveGrantOnce: () => {
        observeCalls += 1;
        return Promise.resolve('RECEIVING');
      },
      deliverPending: () => {
        deliverCalls += 1;
        events.push(`deliver:${deliverCalls}`);
        return Promise.resolve({ phase: 'TRANSPORT_RECORDED', outcome: 'DELIVERED', reason: 'personal-direct-%26' });
      },
      consumePersonalResult: () => {
        consumeCalls += 1;
        const outcome = consumeCalls === 1 ? 'PERSONAL_RESULT:FAILED' : 'PERSONAL_RESULT:POSTED';
        events.push(outcome);
        return Promise.resolve([outcome]);
      },
      closeIncidentGateNow: () => undefined,
      stop: () => Promise.resolve({ cleanupProven: true, state: 'DISABLED_CLEAN', detail: 'STOPPED_CLEAN', incidentDominated: false }),
      incidentKill: () => Promise.resolve({ cleanupProven: true, state: 'DISABLED_LATCHED', detail: 'INCIDENT', incidentDominated: true }),
      close: () => Promise.resolve(),
      isOpen: () => true,
      status: () => ({ state: 'RECEIVING_ONE_PROFILE' }),
      consumeLastCleanup: () => null,
    };
    const open = vi.spyOn(As1GatewayComposition, 'open').mockImplementation((_descriptor, options) => {
      (options as { onLockAcquired?: () => void }).onLockAcquired?.(); // install the owner signal handlers
      return Promise.resolve(fakeComposition as unknown as As1GatewayComposition);
    });
    try {
      const signals = new Map<As1OwnerSignal, () => void>();
      const boundary = {
        descriptor: parseRuntimeDescriptor(committedDescriptorSync()),
        stateRoot: AS1_OWNER_STATE_ROOT,
        clock: { now: () => '2026-07-14T22:05:00.000Z' },
        personalLeoOnly: true,
        buildDeps: () => dummyCompleteDeps(),
        initialize: () => Promise.resolve(),
        installSignalHandlers: (handlers: Record<As1OwnerSignal, () => void>) => {
          (['SIGINT', 'SIGTERM', 'SIGUSR2'] as const).forEach((s) => signals.set(s, handlers[s]));
          return ['SIGINT', 'SIGTERM', 'SIGUSR2'];
        },
        // After the FAILED-then-POSTED sequence over two delivered messages, request a clean stop.
        delay: () => {
          if (deliverCalls >= 2 && consumeCalls >= 2) signals.get('SIGTERM')?.();
          return Promise.resolve();
        },
      } as unknown as As1ForegroundOwnerBoundary;
      const result = await runForegroundOwner(boundary);
      expect(observeCalls).toBe(0); // PERSONAL bypasses the legacy grant re-observation ENTIRELY (no Git/grant-expiry terminal)
      expect(deliverCalls).toBe(2); // TWO delivery attempts — the first result failure did NOT halt the loop
      expect(events).toEqual(['deliver:1', 'PERSONAL_RESULT:FAILED', 'deliver:2', 'PERSONAL_RESULT:POSTED']);
      expect(result.ok).toBe(true); // clean stop after the second message
    } finally {
      open.mockRestore();
    }
  });
});
