import { describe, expect, it } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { As1SlackControl } from '../../src/operations/readiness/as1-slack-control.js';
import { FakeClock } from '../helpers/as1-slack-fakes.js';
import { makeStateRoot } from '../helpers/fixtures.js';

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
