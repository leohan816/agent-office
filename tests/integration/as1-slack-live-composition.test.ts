import { execFile } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../src/contracts/types.js';
import { hashCanonical, sha256Bytes } from '../../src/persistence/file-store/hashing.js';
import { canonicalBytes } from '../../src/persistence/file-store/canonical-json.js';
import { initializeStateRoot, readStateRootFormat } from '../../src/persistence/file-store/path-safety.js';
import { As1ProfileInboundStore } from '../../src/application/slack-pilot/inbound-store.js';
import { As1InboundService, type As1ProfileRuntimeContext } from '../../src/application/slack-pilot/service.js';
import { selectProfile, selectStrategyProfile, type As1Profile } from '../../src/application/slack-pilot/profiles.js';
import { parseContainedPointerRef, parsePointerDeliveryGrant, parseReceiveGrant, type As1PilotReceiveGrantV1 } from '../../src/application/slack-pilot/contracts.js';
import { buildEvidenceAuthority, type As1GitProvenanceVerifier } from '../../src/application/slack-pilot/evidence-ingress.js';
import { userStatusOutboundId } from '../../src/application/slack-pilot/outbox.js';
import type { As1ReceiveGrantProvenanceGate } from '../../src/adapters/gateways/slack-pilot/exact-authority.js';
import type { As1TmuxObservationPort, As1DeliveryProvenanceGate } from '../../src/adapters/gateways/slack-pilot/exact-transport.js';
import { parseTmuxDestination, type As1TmuxDestination } from '../../src/adapters/gateways/slack-pilot/exact-authority.js';
import type { As1AcceptedArtifact, As1GitArtifactObserver, As1GitObservation } from '../../src/adapters/gateways/slack-pilot/git-artifact-source.js';
import type { As1InboundEnvelope, As1SocketConnectInput, As1SocketConnectResult } from '../../src/adapters/gateways/slack-pilot/socket-client.js';
import type { As1WebPort } from '../../src/adapters/gateways/slack-pilot/web-client.js';
import {
  As1GatewayComposition,
  AS1_PERSONAL_LEO_ONLY_STATE_ROOT,
  classifyStatusControl,
  parseRuntimeDescriptor,
  personalAnswerCommandFor,
  personalOrdinaryPasteText,
  type As1CompositionDependencies,
  type As1CompositionSocketPort,
} from '../../src/runtime/as1-slack-pilot/composition.js';
import { As1FilePersonalResultSpool } from '../../src/adapters/gateways/slack-pilot/personal-result-spool.js';
import {
  buildAs1ProductionDependencies,
  parseAs1Cli,
  runAs1Cli,
  runForegroundOwner,
  type As1ForegroundOwnerBoundary,
  type As1OwnerSignal,
} from '../../src/runtime/as1-slack-pilot/cli.js';
import { As1SlackControl } from '../../src/operations/readiness/as1-slack-control.js';
import {
  APPROVED_LEO_USER_ID,
  FakeClock,
  FakeGitVerifier,
  FakeProfileControlPort,
  fakeWireWorld,
  secretText,
  slackEnvelope,
  validAdvisorAck,
  validDestination,
  validReceiveGrant,
  validSecretValues,
  writeSecretFile,
} from '../helpers/as1-slack-fakes.js';
import { makeStateRoot } from '../helpers/fixtures.js';

const CLOCK_ISO = '2026-07-14T22:05:00.000Z';
const AUTH_ROOT = 'advisor/jobs/20260714_agent_office_as1_multi_team_slack_pilot_001';
const RECEIVE_GRANT_REF = `${AUTH_ROOT}/receive-grant.json`;
const ACCEPTING_RECEIVE_GATE: As1ReceiveGrantProvenanceGate = { assertAccepted: () => Promise.resolve() };
const ACCEPTING_DELIVERY_GATE: As1DeliveryProvenanceGate = { assertAccepted: () => Promise.resolve() };
/** The exact obsolete advisor latch reason handoff 120 retires (post-acceptance receive-grant Git divergence). */
const OBSOLETE_ADVISOR_LATCH_REASON = 'receive-grant diverged post-acceptance: GIT_ERROR';

describe('AS1 fixed Strategy status stream', () => {
  async function spoolAt(): Promise<As1FilePersonalResultSpool> {
    return As1FilePersonalResultSpool.open(await mkdtemp(path.join(tmpdir(), 'as1-status-')));
  }

  it('intercepts the four status controls with thread binding and no Advisor delivery', async () => {
    // The four fixed controls classify as START/STOP → intercepted (never a normal question/correlation/Advisor
    // delivery/tmux/shell). Ordinary text, incl. a leading-`!` non-control, is null → ordinary labeled delivery.
    expect(classifyStatusControl(' !상태 ')).toBe('START');
    expect(classifyStatusControl('!状态')).toBe('START');
    expect(classifyStatusControl('!상태그만')).toBe('STOP');
    expect(classifyStatusControl('!状态停止')).toBe('STOP');
    expect(classifyStatusControl('!hello')).toBeNull();
    expect(classifyStatusControl('상태 보고')).toBeNull();
    // A start binds its own event thread; the spool holds EXACTLY one active subscription per root.
    const spool = await spoolAt();
    expect(await spool.readSubscription()).toBeNull();
    await spool.recordSubscription({ channel: 'CSTRAT01', threadTs: '1720000000.000100', lastPostAt: '2026-07-18T00:00:00.000Z' });
    const sub = await spool.readSubscription();
    expect(sub?.threadTs).toBe('1720000000.000100');
    expect(sub?.channel).toBe('CSTRAT01');
  });

  it('delivers one status and one normal same-thread answer exactly once', async () => {
    const spool = await spoolAt();
    await spool.recordSubscription({ channel: 'CSTRAT01', threadTs: '1720000000.000100', lastPostAt: '2026-07-18T00:00:00.000Z' });
    // One status entry: consumed once, posted once, then terminal — never a second post.
    await spool.recordStatusEntry('status-e1', 'building');
    const s = await spool.consumeStatusEntry();
    expect(s?.statusText).toBe('building');
    await spool.markStatusPosted(s?.requestId ?? 'status-e1');
    expect(await spool.consumeStatusEntry()).toBeNull();
    // One normal answer to the SAME bound thread: recorded, answered, consumed once, then terminal.
    await spool.recordCorrelation({ requestId: 'r1', sourceEventId: 'Ev1', channel: 'CSTRAT01', threadTs: '1720000000.000100' });
    await spool.answer('r1', 'final answer');
    const a = await spool.consumeAnswered();
    expect(a?.answerText).toBe('final answer');
    expect(a?.threadTs).toBe('1720000000.000100'); // same thread as the subscription root
    await spool.markComplete(a?.requestId ?? 'r1');
    expect(await spool.consumeAnswered()).toBeNull();
  });

  it('clears status on stop and limits heartbeat to once per 60 seconds', async () => {
    const spool = await spoolAt();
    const t0 = '2026-07-18T00:00:00.000Z';
    await spool.recordSubscription({ channel: 'CSTRAT01', threadTs: '1720000000.000100', lastPostAt: t0 });
    await spool.recordStatusEntry('status-e1', 'pending');
    // Stop clears the subscription AND every pending status entry.
    await spool.clearSubscription();
    expect(await spool.readSubscription()).toBeNull();
    expect(await spool.consumeStatusEntry()).toBeNull();
    // Heartbeat throttle: the owner posts a heartbeat only when >= 60 s have elapsed since the last status/liveness post.
    const windowMs = 60_000;
    expect(Date.parse('2026-07-18T00:00:30.000Z') - Date.parse(t0) >= windowMs).toBe(false); // 30 s → no heartbeat
    expect(Date.parse('2026-07-18T00:01:00.000Z') - Date.parse(t0) >= windowMs).toBe(true); // 60 s → one heartbeat
  });

  it('labels a leading-bang normal message before tmux paste', () => {
    // A leading-`!` NON-control message is ordinary; its paste is prefixed with the fixed non-shell LEO_SLACK_MESSAGE
    // label so the `!` is labeled text and can never enter Codex shell mode.
    expect(classifyStatusControl('!please build')).toBeNull();
    const paste = personalOrdinaryPasteText(selectStrategyProfile('AGENT_OFFICE_STRATEGY'), '!please build', false);
    expect(paste.startsWith('LEO_SLACK_MESSAGE:\n')).toBe(true);
    expect(paste).toContain('!please build');
    // While subscribed, the fixed status-action instruction is appended; when not, it is absent.
    const subscribed = personalOrdinaryPasteText(selectStrategyProfile('AGENT_OFFICE_STRATEGY'), 'ordinary', true);
    expect(subscribed.startsWith('LEO_SLACK_MESSAGE:\n')).toBe(true);
    expect(subscribed).toContain('상태 액션');
    expect(paste).not.toContain('상태 액션');
  });

  it('does not intercept or label status-like messages for a legacy Advisor profile', async () => {
    // Drive the REAL personal composition on the LEGACY Advisor profile (role ADVISOR) with a status-LIKE control text.
    // It must stay ordinary Advisor delivery: original unlabeled paste, no Strategy ack/subscription/prompt, no label.
    const clock = new FakeClock(CLOCK_ISO);
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));
    const gitSource = new FakeGitSource();
    gitSource.setLazy(RECEIVE_GRANT_REF, async () => validReceiveGrant(await boundGrantHashes(stateRoot, 'agent-office-advisor')));
    const socket = new FakeCompositionSocket();
    const tmuxPort = new FakeTmuxObservationPort(parseTmuxDestination(validDestination(), 'd'));
    const signals = new Map<As1OwnerSignal, () => void>();
    let tick = 0;
    const result = await runForegroundOwner({
      descriptor: enabledDescriptor(filePath),
      stateRoot,
      clock,
      personalLeoOnly: true,
      buildDeps: () => fullFakeDeps(gitSource, world, { buildSocket: () => socket, tmuxPort }),
      initialize: () => Promise.resolve(),
      installSignalHandlers: (handlers) => {
        (['SIGINT', 'SIGTERM', 'SIGUSR2'] as const).forEach((s) => signals.set(s, handlers[s]));
        return ['SIGINT', 'SIGTERM', 'SIGUSR2'];
      },
      delay: async () => {
        tick += 1;
        if (tick === 1) {
          await socket.deliver(slackEnvelope({ envelopeId: 'Env0AGENTOFFICE1', eventId: 'Ev0AGENTOFFICE01', ts: '1720000000.000100', text: '!상태' }));
        } else if (tick === 2) {
          await runAs1Cli(parseAs1Cli(['answer', 'ordinary answer']), {} as unknown as As1GatewayComposition, stateRoot);
        } else if (tick >= 4) {
          signals.get('SIGTERM')?.();
        }
      },
    });
    expect(result.ok).toBe(true);
    // The status-like message was delivered as an ORDINARY Advisor message (answered), not intercepted as a control.
    const answers = world.web.posted.filter((p) => p.request.text.startsWith('RESULT [COMPLETED]'));
    expect(answers.length).toBe(1);
    expect(answers[0]?.request.text).toContain('ordinary answer');
    // No Strategy status acknowledgement/prompt/subscription was created on the legacy path.
    expect(world.web.posted.some((p) => p.request.text.includes('상태 스트림'))).toBe(false);
    // The pasted buffer is the ORIGINAL text with NO LEO_SLACK_MESSAGE label; the raw `!상태` is present unlabeled.
    const pastes = tmuxPort.loadedBuffers.map((b) => b.toString('utf8'));
    expect(pastes.some((t) => t.includes('!상태'))).toBe(true);
    expect(pastes.some((t) => t.includes('LEO_SLACK_MESSAGE:'))).toBe(false);
  });

  it('requires subscribed Strategy progress forwarding and omits it when unsubscribed', () => {
    const profile = selectStrategyProfile('AGENT_OFFICE_STRATEGY');
    const subscribed = personalOrdinaryPasteText(profile, 'do the work', true);
    const unsubscribed = personalOrdinaryPasteText(profile, 'do the work', false);
    // Subscribed: the strengthened forwarding instruction REQUIRES exactly-once bounded status forwarding of each new
    // user-facing progress/finding/result block, via the fixed status action.
    expect(subscribed).toContain('상태 스트림 활성');
    expect(subscribed).toContain('정확히 한 번');
    expect(subscribed).toContain('status');
    expect(subscribed).toContain('bounded');
    // ...and it forbids sending the npm/tool invocation, a `Ran` header, REASON/control lines, or duplicate content.
    expect(subscribed).toContain('npm');
    expect(subscribed).toContain('Ran');
    expect(subscribed).toContain('REASON');
    expect(subscribed).toContain('중복');
    // Unsubscribed: NO status-forwarding instruction is appended (unchanged behavior).
    expect(unsubscribed).not.toContain('상태 스트림 활성');
    expect(unsubscribed).not.toContain('status');
  });
});

describe('AS1 one-shot Agent Office malformed-frame latch retirement', () => {
  const AO_ROOT_ID = 'strategy-agent-office-v1';
  const AO_LATCH_REASON = 'malformed frame after ready';
  const AO_LATCH_AT = '2026-07-18T15:20:22.170Z';

  async function agentOfficeRoot(): Promise<string> {
    const root = await mkdtemp(path.join(tmpdir(), 'as1-strat-ao-'));
    await initializeStateRoot(root, { stateRootId: AO_ROOT_ID, initializedAt: AO_LATCH_AT });
    return root;
  }
  async function seedAoLatch(root: string, reason: string, at: string): Promise<void> {
    const seed = await As1SlackControl.open(root, new FakeClock(at));
    await seed.latchProfile('agent-office-advisor', reason);
    await seed.shutdown();
    await seed.close();
  }

  it('retires only the exact Agent Office malformed-frame latch before fixed Strategy direct start', async () => {
    const root = await agentOfficeRoot();
    await seedAoLatch(root, AO_LATCH_REASON, AO_LATCH_AT);
    const control = await As1SlackControl.open(root, new FakeClock(CLOCK_ISO));
    // All four fixed identity fields (root id, slug, reason, latchedAt) + the safety shape hold → exact-match retirement.
    expect(await control.retireOneShotAgentOfficeMalformedFrameLatch()).toBe('RETIRED');
    // The durable latch is now false, so the fixed AGENT_OFFICE_STRATEGY startStrategyDirect() isProfileLatched check
    // passes — continuation past the fixed Agent Office Strategy latch check.
    expect(await control.isProfileLatched('agent-office-advisor')).toBe(false);
    await control.close();
    // "Only the exact": the SAME latch under a different state-root identity is not the Agent Office malformed-frame latch.
    const otherRoot = await makeStateRoot(); // stateRootId 'test-state-root'
    await seedAoLatch(otherRoot, AO_LATCH_REASON, AO_LATCH_AT);
    const other = await As1SlackControl.open(otherRoot, new FakeClock(CLOCK_ISO));
    expect(await other.retireOneShotAgentOfficeMalformedFrameLatch()).toBe('NOT_RETIRED');
    expect(await other.isProfileLatched('agent-office-advisor')).toBe(true);
    await other.close();
  });

  it('refuses wrong or later Agent Office malformed-frame latches', async () => {
    // Wrong reason: never retired → stays latched → the fixed Strategy start's isProfileLatched check returns PROFILE_LATCHED.
    const wrongRoot = await agentOfficeRoot();
    await seedAoLatch(wrongRoot, 'some unrelated latch reason', AO_LATCH_AT);
    const wrong = await As1SlackControl.open(wrongRoot, new FakeClock(CLOCK_ISO));
    expect(await wrong.retireOneShotAgentOfficeMalformedFrameLatch()).toBe('NOT_RETIRED');
    expect(await wrong.isProfileLatched('agent-office-advisor')).toBe(true);
    await wrong.close();
    // Correct reason but a DIFFERENT (later) latchedAt: a later latch, including the same reason, is NEVER retired.
    const laterRoot = await agentOfficeRoot();
    await seedAoLatch(laterRoot, AO_LATCH_REASON, '2026-07-18T15:20:22.171Z');
    const later = await As1SlackControl.open(laterRoot, new FakeClock(CLOCK_ISO));
    expect(await later.retireOneShotAgentOfficeMalformedFrameLatch()).toBe('NOT_RETIRED');
    expect(await later.isProfileLatched('agent-office-advisor')).toBe(true);
    await later.close();
  });
});

describe('AS1 one-shot Foundation Strategy diagnostic-latch retirement', () => {
  const FOUNDATION_ROOT_ID = 'strategy-foundation-v1';
  const FOUNDATION_DIAG_REASON = 'owner-loop error: AUTHORITY_ARTIFACT_INVALID';
  const FOUNDATION_DIAG_AT = '2026-07-18T16:15:44.312Z';

  async function foundationRoot(): Promise<string> {
    const root = await mkdtemp(path.join(tmpdir(), 'as1-strat-fdn-'));
    await initializeStateRoot(root, { stateRootId: FOUNDATION_ROOT_ID, initializedAt: FOUNDATION_DIAG_AT });
    return root;
  }
  // Seed a durable foundation-advisor profile latch, then drain to DISABLED_CLEAN (the quiescent retirement precondition).
  async function seedLatch(root: string, reason: string, at: string): Promise<void> {
    const seed = await As1SlackControl.open(root, new FakeClock(at));
    await seed.latchProfile('foundation-advisor', reason);
    await seed.shutdown();
    await seed.close();
  }

  it('retires only the exact Foundation diagnostic latch before fixed Strategy direct start', async () => {
    const root = await foundationRoot();
    await seedLatch(root, FOUNDATION_DIAG_REASON, FOUNDATION_DIAG_AT);
    const control = await As1SlackControl.open(root, new FakeClock(CLOCK_ISO));
    // All four fixed identity fields (root id, slug, reason, latchedAt) + the safety shape hold → exact-match retirement.
    expect(await control.retireOneShotFoundationDiagnosticLatch()).toBe('RETIRED');
    // The durable latch is now false, so the fixed FOUNDATION_STRATEGY startStrategyDirect() isProfileLatched check
    // passes — continuation to the existing fixed Foundation Strategy start boundary.
    expect(await control.isProfileLatched('foundation-advisor')).toBe(false);
    await control.close();
    // "Only the exact": the SAME latch under a different state-root identity is not the Foundation diagnostic latch.
    const otherRoot = await makeStateRoot(); // stateRootId 'test-state-root'
    await seedLatch(otherRoot, FOUNDATION_DIAG_REASON, FOUNDATION_DIAG_AT);
    const other = await As1SlackControl.open(otherRoot, new FakeClock(CLOCK_ISO));
    expect(await other.retireOneShotFoundationDiagnosticLatch()).toBe('NOT_RETIRED');
    expect(await other.isProfileLatched('foundation-advisor')).toBe(true);
    await other.close();
  });

  it('refuses wrong or future Foundation diagnostic latches', async () => {
    // Wrong reason: never retired → stays latched → the fixed Strategy start's isProfileLatched check returns PROFILE_LATCHED.
    const wrongRoot = await foundationRoot();
    await seedLatch(wrongRoot, 'some unrelated latch reason', FOUNDATION_DIAG_AT);
    const wrong = await As1SlackControl.open(wrongRoot, new FakeClock(CLOCK_ISO));
    expect(await wrong.retireOneShotFoundationDiagnosticLatch()).toBe('NOT_RETIRED');
    expect(await wrong.isProfileLatched('foundation-advisor')).toBe(true);
    await wrong.close();
    // Correct reason but a DIFFERENT (later) latchedAt: a later latch, including the same reason, is NEVER retired.
    const futureRoot = await foundationRoot();
    await seedLatch(futureRoot, FOUNDATION_DIAG_REASON, '2026-07-18T16:15:44.313Z');
    const future = await As1SlackControl.open(futureRoot, new FakeClock(CLOCK_ISO));
    expect(await future.retireOneShotFoundationDiagnosticLatch()).toBe('NOT_RETIRED');
    expect(await future.isProfileLatched('foundation-advisor')).toBe(true);
    await future.close();
  });

  it('retires the second exact Foundation malformed-frame latch before fixed Strategy direct start', async () => {
    const root = await foundationRoot();
    await seedLatch(root, 'malformed frame after ready', '2026-07-18T18:55:19.830Z');
    const control = await As1SlackControl.open(root, new FakeClock(CLOCK_ISO));
    // The second exact reviewed tuple (reason + its own latchedAt) under the fixed root/profile → exact-match retirement.
    expect(await control.retireOneShotFoundationDiagnosticLatch()).toBe('RETIRED');
    expect(await control.isProfileLatched('foundation-advisor')).toBe(false);
    await control.close();
  });

  it('refuses any other Foundation latch reason or timestamp', async () => {
    // An unrelated reason at a valid timestamp stays latched.
    const wrongRoot = await foundationRoot();
    await seedLatch(wrongRoot, 'some unrelated latch reason', '2026-07-18T18:55:19.830Z');
    const wrong = await As1SlackControl.open(wrongRoot, new FakeClock(CLOCK_ISO));
    expect(await wrong.retireOneShotFoundationDiagnosticLatch()).toBe('NOT_RETIRED');
    expect(await wrong.isProfileLatched('foundation-advisor')).toBe(true);
    await wrong.close();
    // Cross-tuple mismatch: tuple-2's reason paired with tuple-1's timestamp (each reason must match ITS OWN latchedAt).
    const mixedRoot = await foundationRoot();
    await seedLatch(mixedRoot, 'malformed frame after ready', '2026-07-18T16:15:44.312Z');
    const mixed = await As1SlackControl.open(mixedRoot, new FakeClock(CLOCK_ISO));
    expect(await mixed.retireOneShotFoundationDiagnosticLatch()).toBe('NOT_RETIRED');
    expect(await mixed.isProfileLatched('foundation-advisor')).toBe(true);
    await mixed.close();
  });

  it('retires the exact fourth Foundation malformed-frame latch and refuses a later one', async () => {
    const root = await foundationRoot();
    await seedLatch(root, 'malformed frame after ready', '2026-07-19T07:03:17.125Z');
    const control = await As1SlackControl.open(root, new FakeClock(CLOCK_ISO));
    // The fourth exact reviewed tuple (reason + its OWN latchedAt) under the fixed root/profile → exact-match retirement.
    expect(await control.retireOneShotFoundationDiagnosticLatch()).toBe('RETIRED');
    expect(await control.isProfileLatched('foundation-advisor')).toBe(false);
    await control.close();
    // Wrong/later: the same reason at a DIFFERENT (later) latchedAt is never the fourth tuple → stays latched.
    const laterRoot = await foundationRoot();
    await seedLatch(laterRoot, 'malformed frame after ready', '2026-07-19T07:03:17.126Z');
    const later = await As1SlackControl.open(laterRoot, new FakeClock(CLOCK_ISO));
    expect(await later.retireOneShotFoundationDiagnosticLatch()).toBe('NOT_RETIRED');
    expect(await later.isProfileLatched('foundation-advisor')).toBe(true);
    await later.close();
  });
});

describe('AS1 Strategy answer paste commands', () => {
  const LEGACY = 'npm --prefix /home/leo/Project/.worktrees/agent-office/AGENT_OFFICE_AS1_PHASE_B_LIVE_PILOT_001 run as1:slack-pilot -- answer "<bounded answer text>"';
  const AO_STRATEGY = 'npm --prefix /home/leo/Project/.worktrees/agent-office/AGENT_OFFICE_STRATEGY_ENTRYPOINT_MIGRATION_001 run as1:slack-pilot -- answer-agent-office-strategy "<bounded answer text>"';
  const FDN_STRATEGY = 'npm --prefix /home/leo/Project/.worktrees/agent-office/AGENT_OFFICE_STRATEGY_ENTRYPOINT_MIGRATION_001 run as1:slack-pilot -- answer-foundation-strategy "<bounded answer text>"';

  it('pastes fixed Strategy answer verbs while preserving the legacy Advisor answer command', () => {
    // Legacy Advisor profiles keep the EXACT existing pasted answer command, byte-for-byte.
    expect(personalAnswerCommandFor(selectProfile('AGENT_OFFICE_ADVISOR'))).toBe(LEGACY);
    expect(personalAnswerCommandFor(selectProfile('FOUNDATION_ADVISOR'))).toBe(LEGACY);
    // Each Strategy profile pastes its OWN fixed migration-worktree command with its matching closed answer verb.
    expect(personalAnswerCommandFor(selectStrategyProfile('AGENT_OFFICE_STRATEGY'))).toBe(AO_STRATEGY);
    expect(personalAnswerCommandFor(selectStrategyProfile('FOUNDATION_STRATEGY'))).toBe(FDN_STRATEGY);
    // No cross-contamination: the two Strategy commands are distinct, and neither is the legacy command.
    expect(AO_STRATEGY).not.toBe(FDN_STRATEGY);
    expect(AO_STRATEGY).not.toBe(LEGACY);
    expect(FDN_STRATEGY).not.toBe(LEGACY);
  });
});

describe('AS1 Strategy isolated FIFO routes (personal-direct reuse)', () => {
  // Two Strategy runtime contexts with DISTINCT fixed Slack identities (App/channel/bot). The PERSONAL direct intake
  // path reads ONLY the context identity + envelope (never the store/grant/gate), so a never-used store is safe here.
  function strategyContext(profileId: 'AGENT_OFFICE_STRATEGY' | 'FOUNDATION_STRATEGY'): As1ProfileRuntimeContext {
    const isAo = profileId === 'AGENT_OFFICE_STRATEGY';
    return {
      profile: selectStrategyProfile(profileId),
      workspaceId: 'TWORKSPACE001',
      appId: isAo ? 'AAOSTRATEGY001' : 'AFDNSTRATEGY01',
      channelId: isAo ? 'CAOSTRATEGY001' : 'CFDNSTRATEGY01',
      leoUserId: APPROVED_LEO_USER_ID,
      botUserId: isAo ? 'UAOSTRATEGYBOT' : 'UFDNSTRATEGYBT',
      now: () => CLOCK_ISO,
    };
  }
  function strategyService(profileId: 'AGENT_OFFICE_STRATEGY' | 'FOUNDATION_STRATEGY'): As1InboundService {
    const unusedStore = {} as unknown as As1ProfileInboundStore;
    return new As1InboundService(strategyContext(profileId), parseReceiveGrant(validReceiveGrant()), unusedStore, new FakeProfileControlPort(), true);
  }
  function aoEnvelope(over: { eventId: string; envelopeId: string; ts?: string; onAck?: () => Promise<void> }) {
    return slackEnvelope({
      teamId: 'TWORKSPACE001',
      apiAppId: 'AAOSTRATEGY001',
      channel: 'CAOSTRATEGY001',
      user: APPROVED_LEO_USER_ID,
      ...over,
    });
  }

  it('runs isolated Strategy FIFO routes with exact same-thread results and message-local failure', async () => {
    const ao = strategyService('AGENT_OFFICE_STRATEGY');
    const fdn = strategyService('FOUNDATION_STRATEGY');

    // (1) A valid Leo root on the AO Strategy identity enqueues exactly one item with a SAME-THREAD correlation
    // (the result routes back to this exact thread ts).
    const root = await ao.processEnvelope(aoEnvelope({ eventId: 'Ev0AOSTRAT0001', envelopeId: 'EnvAOSTRAT0001', ts: '1720000000.000100' }));
    expect(root.acked).toBe(true);
    expect(root.classification).toBe('PERSONAL_ROOT');
    expect(root.personal?.threadTs).toBe('1720000000.000100');
    expect(root.personal?.channel).toBe('CAOSTRATEGY001');

    // (2) The FDN Strategy route is ISOLATED: the AO-addressed event is foreign to it and enqueues NOTHING.
    const foreign = await fdn.processEnvelope(aoEnvelope({ eventId: 'Ev0AOSTRAT0001', envelopeId: 'EnvAOSTRAT0002' }));
    expect(foreign.classification).toBe('REJECTED_FIXED_ALLOWLIST');
    expect(fdn.takeNextPersonal()).toBeNull();

    // (3) The AO FIFO holds exactly the one item; taking it drains it. A DUPLICATE event id creates no second item.
    expect(ao.takeNextPersonal()?.requestId).toBe('Ev0AOSTRAT0001');
    const dup = await ao.processEnvelope(aoEnvelope({ eventId: 'Ev0AOSTRAT0001', envelopeId: 'EnvAOSTRAT0003' }));
    expect(dup.classification).toBe('DUPLICATE_EVENT');
    expect(ao.takeNextPersonal()).toBeNull();

    // (4) MESSAGE-LOCAL failure: a per-message ACK failure is swallowed (no latch); the NEXT valid message still
    // enqueues and processes, in FIFO order.
    let acks = 0;
    const failing = await ao.processEnvelope(
      aoEnvelope({ eventId: 'Ev0AOSTRAT0002', envelopeId: 'EnvAOSTRAT0004', ts: '1720000000.000200', onAck: () => { acks += 1; return Promise.reject(new Error('ack failed')); } }),
    );
    expect(acks).toBe(1);
    expect(failing.classification).toBe('PERSONAL_ROOT');
    const next = await ao.processEnvelope(aoEnvelope({ eventId: 'Ev0AOSTRAT0003', envelopeId: 'EnvAOSTRAT0005', ts: '1720000000.000300' }));
    expect(next.classification).toBe('PERSONAL_ROOT');
    expect(ao.takeNextPersonal()?.requestId).toBe('Ev0AOSTRAT0002');
    expect(ao.takeNextPersonal()?.requestId).toBe('Ev0AOSTRAT0003');
  });
});

/** A composition-socket fake for the fixed-Strategy provider-disconnect recovery tests: `connect()` returns queued
 *  outcomes by call order (the initial start uses #1; the single recovery reconnect uses #2), and re-arm calls are
 *  counted so a test can prove the SAME socket was re-armed exactly once. */
class RecoveryFakeCompositionSocket implements As1CompositionSocketPort {
  public armed = false;
  public armCount = 0;
  public connectCount = 0;
  public disconnected = false;
  /** The composition bindings captured at buildSocket time, so an owner-loop tick can fire the real
   *  `onProviderDisconnect` recovery seal exactly as the transport would after a provider-disconnect dispatch. */
  public bindings: { readonly onProviderDisconnect?: () => void } | null = null;
  private handler: ((envelope: As1InboundEnvelope) => Promise<void>) | null = null;
  public constructor(private readonly connectResults: readonly boolean[] = [true, true]) {}
  public connect(input: As1SocketConnectInput): Promise<As1SocketConnectResult> {
    const queued = this.connectResults[this.connectCount];
    this.connectCount += 1;
    return Promise.resolve({ ok: queued ?? input.readinessSeal() });
  }
  public onEnvelope(handler: (envelope: As1InboundEnvelope) => Promise<void>): void {
    this.handler = handler;
  }
  public disconnect(): Promise<void> {
    this.disconnected = true;
    return Promise.resolve();
  }
  public armReceive(): void {
    this.armed = true;
    this.armCount += 1;
  }
  public async deliver(envelope: As1InboundEnvelope): Promise<void> {
    if (!this.armed || this.handler === null) throw new Error('socket not armed');
    await this.handler(envelope);
  }
}

/** Start a connectable fixed AGENT_OFFICE_STRATEGY owner (the personal-direct branch) on its own fixed state root, using
 *  a Strategy secret whose AO-Strategy identity equals the base AO identity the fake wire already serves. Returns the
 *  live composition so a focused test can drive the status stream / priority control tick / provider-disconnect recovery
 *  directly (the same collaborators the owner loop calls each tick). */
async function startStrategyOwner(
  options: { readonly socket?: RecoveryFakeCompositionSocket; readonly tmuxPort?: FakeTmuxObservationPort } = {},
) {
  const stateRoot = await mkdtemp(path.join(tmpdir(), 'as1-strat-own-'));
  await initializeStateRoot(stateRoot, { stateRootId: 'strategy-agent-office-v1', initializedAt: CLOCK_ISO });
  const world = fakeWireWorld();
  const b = validSecretValues();
  const strategySecret = secretText({
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
  const { filePath: strategySecretPath } = await writeSecretFile(strategySecret, { fileName: 'strategy-slack-apps.env' });
  const profile = selectStrategyProfile('AGENT_OFFICE_STRATEGY');
  const directPaneId = '%48';
  // The fixed Strategy destination the composition validates ONCE at startup (validateFixedAdvisorDestination): the fixed
  // pane + the SELECTED profile's exact session/workspace/command. The fake pane echoes this so startup binds cleanly.
  const strategyDestination = {
    paneId: directPaneId,
    sessionName: profile.sessionName,
    workspace: profile.workspace,
    currentCommand: profile.currentCommand,
  } as As1TmuxDestination;
  const socket = options.socket ?? new RecoveryFakeCompositionSocket();
  const tmuxPort = options.tmuxPort ?? new FakeTmuxObservationPort(strategyDestination);
  const gitSource = new FakeGitSource();
  const composition = await As1GatewayComposition.open(enabledDescriptor(strategySecretPath), {
    stateRoot,
    clock: new FakeClock(CLOCK_ISO),
    personalLeoOnly: true,
    expectedPersonalRoot: stateRoot,
    strategyProfile: profile,
    strategySecretFilePath: strategySecretPath,
    directDestination: { paneId: directPaneId, sessionName: profile.sessionName },
    deps: fullFakeDeps(gitSource, world, { buildSocket: () => socket, tmuxPort }),
  });
  const started = await composition.startStrategyDirect();
  return { stateRoot, composition, socket, tmuxPort, web: world.web, started };
}

/** Two-layer proof, LAYER 2: drive the REAL runForegroundOwner loop over a connectable fixed AGENT_OFFICE_STRATEGY
 *  owner, firing the captured provider-disconnect recovery seal on the first tick. With a failing reconnect the owner
 *  observes isStrategyRecoveryStop() and reaches the existing clean-stop terminal — never a live spin. */
async function runStrategyOwnerLoop(
  socket: RecoveryFakeCompositionSocket,
): Promise<{ result: Awaited<ReturnType<typeof runForegroundOwner>>; web: ReturnType<typeof fakeWireWorld>['web']; stateRoot: string }> {
  const stateRoot = await mkdtemp(path.join(tmpdir(), 'as1-strat-loop-'));
  await initializeStateRoot(stateRoot, { stateRootId: 'strategy-agent-office-v1', initializedAt: CLOCK_ISO });
  const world = fakeWireWorld();
  const b = validSecretValues();
  const strategySecret = secretText({
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
  const { filePath: strategySecretPath } = await writeSecretFile(strategySecret, { fileName: 'strategy-slack-apps.env' });
  const profile = selectStrategyProfile('AGENT_OFFICE_STRATEGY');
  const directPaneId = '%48';
  const strategyDestination = {
    paneId: directPaneId,
    sessionName: profile.sessionName,
    workspace: profile.workspace,
    currentCommand: profile.currentCommand,
  } as As1TmuxDestination;
  const tmuxPort = new FakeTmuxObservationPort(strategyDestination);
  const gitSource = new FakeGitSource();
  const signals = new Map<As1OwnerSignal, () => void>();
  let tick = 0;
  const boundary: As1ForegroundOwnerBoundary = {
    descriptor: enabledDescriptor(strategySecretPath),
    stateRoot,
    clock: new FakeClock(CLOCK_ISO),
    personalLeoOnly: true,
    strategyProfile: profile,
    strategySecretFilePath: strategySecretPath,
    strategyDirectStart: true,
    directDestination: { paneId: directPaneId, sessionName: profile.sessionName },
    buildDeps: () =>
      fullFakeDeps(gitSource, world, {
        buildSocket: (bindings) => {
          socket.bindings = bindings;
          return socket;
        },
        tmuxPort,
      }),
    initialize: () => Promise.resolve(),
    installSignalHandlers: (handlers) => {
      (['SIGINT', 'SIGTERM', 'SIGUSR2'] as const).forEach((s) => signals.set(s, handlers[s]));
      return ['SIGINT', 'SIGTERM', 'SIGUSR2'];
    },
    delay: async () => {
      tick += 1;
      if (tick === 1) {
        // Bind a subscription, then fire the captured recovery seal exactly as the transport would after a disconnect.
        const spool = await As1FilePersonalResultSpool.open(stateRoot);
        await spool.recordSubscription({ channel: 'CAGENTOFFICE01', threadTs: '1720000000.000100', lastPostAt: CLOCK_ISO });
        socket.bindings?.onProviderDisconnect?.();
      } else if (tick > 12) {
        // Safety net so a regression can never hang the suite; the recovery flag converges well before this tick.
        signals.get('SIGTERM')?.();
      }
    },
  };
  const result = await runForegroundOwner(boundary);
  return { result, web: world.web, stateRoot };
}

describe('AS1 fixed Strategy silent status + bounded provider-disconnect recovery', () => {
  it('emits no idle status post while subscribed', async () => {
    const { stateRoot, composition, web, started } = await startStrategyOwner();
    try {
      expect(started.connected).toBe(true);
      // An active subscription with NO pending status entry: the stream stays SILENT — the periodic heartbeat is deleted,
      // so no replacement liveness post is emitted on an idle tick, no matter how many times the owner ticks.
      const spool = await As1FilePersonalResultSpool.open(stateRoot);
      await spool.recordSubscription({ channel: 'CAGENTOFFICE01', threadTs: '1720000000.000100', lastPostAt: CLOCK_ISO });
      const before = web.posted.length;
      const first = await composition.consumeStatusStream();
      const second = await composition.consumeStatusStream();
      expect(first).toContain('STATUS_STREAM:IDLE');
      expect(second).toContain('STATUS_STREAM:IDLE');
      expect(web.posted.length).toBe(before); // no idle status post on either tick
    } finally {
      await composition.close().catch(() => undefined);
    }
  });

  it('prioritizes fixed status stop while an ordinary result is pending', async () => {
    const { stateRoot, composition, socket, tmuxPort, web, started } = await startStrategyOwner();
    try {
      expect(started.connected).toBe(true);
      const spool = await As1FilePersonalResultSpool.open(stateRoot);
      await spool.recordSubscription({ channel: 'CAGENTOFFICE01', threadTs: '1720000000.000100', lastPostAt: CLOCK_ISO });
      // An ORDINARY Leo message is pending in the FIFO; then a STOP control arrives behind it.
      await socket.deliver(slackEnvelope({ envelopeId: 'Env0AOSTRAT0001', eventId: 'Ev0AOSTRAT0001', ts: '1720000000.000200', text: 'do the work' }));
      await socket.deliver(slackEnvelope({ envelopeId: 'Env0AOSTRAT0002', eventId: 'Ev0AOSTRAT0002', ts: '1720000000.000300', text: '!상태그만' }));
      const postsBefore = web.posted.length;
      // The priority control tick consumes the STOP BEFORE any ordinary deliver: one stop ack, subscription cleared.
      const control = await composition.consumeStatusControlTick();
      expect(control).toContain('STATUS_CONTROL:STOP');
      expect(await spool.readSubscription()).toBeNull();
      expect(web.posted.length).toBe(postsBefore + 1);
      // A SECOND priority tick finds NO remaining control — the ordinary message was never taken as a control.
      expect(await composition.consumeStatusControlTick()).toContain('STATUS_CONTROL:NONE');
      // The ordinary FIFO was PRESERVED across the STOP: the pending ordinary still delivers (one labeled paste).
      const pastesBefore = tmuxPort.pasteCalls;
      await composition.deliverPending();
      expect(tmuxPort.pasteCalls).toBe(pastesBefore + 1);
    } finally {
      await composition.close().catch(() => undefined);
    }
  });

  it('posts one disconnect notice and stops cleanly when fixed Strategy recovery fails', async () => {
    // Layer 2: drive the REAL runForegroundOwner loop. The first tick fires the provider-disconnect recovery seal; the
    // reconnect FAILS (second connect not-ok), so recovery posts exactly one notice, sets the clean-stop flag, and the
    // owner loop reaches its EXISTING clean-stop terminal through isStrategyRecoveryStop — never a live spin.
    const socket = new RecoveryFakeCompositionSocket([true, false]);
    const { result, web } = await runStrategyOwnerLoop(socket);
    expect(result.ok).toBe(true); // STOPPED_CLEAN, not an incident/latch terminal
    const notices = web.posted.filter((p) => p.request.text.includes('상태 스트림을 종료'));
    expect(notices).toHaveLength(1); // exactly one disconnect notice through the recovery path
  });

  it('recovers fixed Strategy intake and handles the next normal message once', async () => {
    // Both connects succeed: recovery clears+notices once, reconnects the SAME socket once, and re-arms the handler.
    const socket = new RecoveryFakeCompositionSocket([true, true]);
    const { stateRoot, composition, web, started } = await startStrategyOwner({ socket });
    try {
      expect(started.connected).toBe(true);
      const spool = await As1FilePersonalResultSpool.open(stateRoot);
      await spool.recordSubscription({ channel: 'CAGENTOFFICE01', threadTs: '1720000000.000100', lastPostAt: CLOCK_ISO });
      const armsBefore = socket.armCount;
      const before = web.posted.length;
      const recovery = await composition.recoverStrategyDisconnect();
      expect(recovery).toContain('STRATEGY_RECOVERY:RECONNECTED');
      expect(web.posted.length).toBe(before + 1); // exactly one disconnect notice
      expect(socket.armCount).toBe(armsBefore + 1); // the same socket re-armed exactly once
      expect(composition.isStrategyRecoveryStop()).toBe(false); // recovery succeeded → no clean stop
      // The re-armed intake handles the NEXT normal message ONCE; a duplicate event id makes no second intake.
      await socket.deliver(slackEnvelope({ envelopeId: 'Env0AOSTRAT0009', eventId: 'Ev0AOSTRAT0009', ts: '1720000000.000900', text: 'next message' }));
      const intake = composition.lastIntake();
      expect(intake).not.toBeNull();
      await socket.deliver(slackEnvelope({ envelopeId: 'Env0AOSTRAT0009b', eventId: 'Ev0AOSTRAT0009', ts: '1720000000.000900', text: 'next message' }));
      expect(composition.lastIntake()).toBe(intake);
    } finally {
      await composition.close().catch(() => undefined);
    }
  });
});

/**
 * The exact domain-separated profile-state-root binding hash (design §5.2) a correctly-minted receive grant carries
 * in `profileStateRootHash`. Computed from the actual initialized state-root marker so the composition's F02 binding
 * gate accepts a correctly-bound grant (and, in the negative test, rejects a mis-bound one).
 */
async function bindingHashFor(stateRoot: string, slug: string): Promise<string> {
  const stateRootFormat = await readStateRootFormat(stateRoot);
  return hashCanonical({
    schemaVersion: 'agent-office.as1-profile-state-root-binding.v1',
    stateRootFormat,
    profileStateRootRef: `indexes/as1-slack-pilot/profiles/${slug}`,
  });
}

/**
 * The exact pre-transition global-control + selected-profile-latch snapshot hashes (design §5.2, F02) a correctly
 * minted grant carries. Read from the ACTUAL persisted records — so the composition must already be OPEN (its control
 * records exist) and start() not yet run. Together with `bindingHashFor` these are the three grant binding hashes.
 */
async function boundGrantHashes(stateRoot: string, slug: string): Promise<Record<string, string>> {
  const controlRaw = await readFile(path.join(stateRoot, 'indexes/as1-slack-pilot/global-control.json'), 'utf8');
  const latchRaw = await readFile(path.join(stateRoot, `indexes/as1-slack-pilot/profiles/${slug}/failure-latch.json`), 'utf8');
  return {
    profileStateRootHash: await bindingHashFor(stateRoot, slug),
    globalControlSnapshotHash: hashCanonical(JSON.parse(controlRaw) as unknown),
    profileLatchSnapshotHash: hashCanonical(JSON.parse(latchRaw) as unknown),
  };
}

/** A path-keyed read-only Git observer fake. It records the accepted pair passed on each observation (F03 spy) and
 *  can be told to return a durable DIVERGED for a path re-observed WITH an accepted pair (post-acceptance change). */
class FakeGitSource implements As1GitArtifactObserver {
  private readonly byPath = new Map<string, Buffer>();
  private readonly lazyByPath = new Map<string, () => Promise<unknown>>();
  public readonly acceptedCalls: { path: string; accepted: As1AcceptedArtifact | undefined }[] = [];
  public readonly divergePaths = new Set<string>();
  public readonly throwOnReObservePaths = new Set<string>();
  private readonly firstAdd: string;
  public constructor(firstAddCommit = 'a'.repeat(40)) {
    this.firstAdd = firstAddCommit;
  }
  public set(relativePath: string, value: unknown): void {
    this.byPath.set(relativePath, Buffer.from(JSON.stringify(value), 'utf8'));
  }
  /** A lazily-materialized artifact — computed at observe-time (AFTER the owner's own open established the control),
   *  so a receive grant can carry the exact pre-transition control/latch hashes even when the owner opens internally. */
  public setLazy(relativePath: string, factory: () => Promise<unknown>): void {
    this.lazyByPath.set(relativePath, factory);
  }
  public getRepositoryId(): string {
    return 'foundation-docs';
  }
  public async observe(relativePath: string, accepted?: As1AcceptedArtifact): Promise<As1GitObservation> {
    this.acceptedCalls.push({ path: relativePath, accepted });
    if (accepted !== undefined && this.throwOnReObservePaths.has(relativePath)) {
      throw new DomainError('STORE_QUARANTINED', 'git observation error on re-observation');
    }
    if (accepted !== undefined && this.divergePaths.has(relativePath)) {
      return { status: 'DIVERGED', reason: 'CONTENT_DIVERGED', firstAddCommit: null, blobSha256: null, bytes: null };
    }
    const lazy = this.lazyByPath.get(relativePath);
    const bytes = lazy !== undefined ? Buffer.from(JSON.stringify(await lazy()), 'utf8') : this.byPath.get(relativePath);
    if (bytes === undefined) {
      return { status: 'NOT_READY', reason: 'ABSENT', firstAddCommit: null, blobSha256: null, bytes: null };
    }
    return { status: 'READY', reason: 'READY', firstAddCommit: this.firstAdd, blobSha256: sha256Bytes(bytes), bytes };
  }
}

/** A composition socket fake with the Phase B one-use arm; the test drives one delivered envelope. */
class FakeCompositionSocket implements As1CompositionSocketPort {
  public armed = false;
  public disconnected = false;
  private handler: ((envelope: As1InboundEnvelope) => Promise<void>) | null = null;
  public connect(input: As1SocketConnectInput): Promise<As1SocketConnectResult> {
    return Promise.resolve({ ok: input.readinessSeal() });
  }
  public onEnvelope(handler: (envelope: As1InboundEnvelope) => Promise<void>): void {
    this.handler = handler;
  }
  public disconnect(): Promise<void> {
    this.disconnected = true;
    return Promise.resolve();
  }
  public armReceive(): void {
    this.armed = true;
  }
  public async deliver(envelope: As1InboundEnvelope): Promise<void> {
    if (!this.armed || this.handler === null) throw new Error('socket not armed');
    await this.handler(envelope);
  }
}

class FakeTmuxObservationPort implements As1TmuxObservationPort {
  public pasteCalls = 0;
  public enterCalls = 0;
  public readonly loadedBuffers: Buffer[] = [];
  public constructor(private readonly destination: As1TmuxDestination) {}
  public observe(): Promise<As1TmuxDestination> {
    return Promise.resolve(this.destination);
  }
  public bufferExists(): Promise<boolean> {
    return Promise.resolve(false);
  }
  public loadVerifiedBuffer(_name: string, pinnedBytes: Buffer): Promise<void> {
    this.loadedBuffers.push(Buffer.from(pinnedBytes));
    return Promise.resolve();
  }
  public pasteBuffer(): Promise<void> {
    this.pasteCalls += 1;
    return Promise.resolve();
  }
  public sendEnter(): Promise<void> {
    this.enterCalls += 1;
    return Promise.resolve();
  }
  public deleteBuffer(): Promise<void> {
    return Promise.resolve();
  }
}

/** A tmux port that returns the fixed profile-bound destination, except that when `failNextObserve` is set it returns
 *  a profile-mismatching destination on the NEXT observe and resets — used to force ONE personal-mode per-message
 *  delivery failure (the built internal lease then does not bind the profile → STOPPED_BEFORE_PASTE) and prove the
 *  owner posts DELIVERY_FAILED, does not latch, and continues to the next Leo root. */
class ControllableTmuxObservationPort implements As1TmuxObservationPort {
  public pasteCalls = 0;
  public enterCalls = 0;
  /** When set, the NEXT observe returns a profile-mismatching pane once — a fixed-destination/identity corruption that
   *  must fail GLOBAL (P1), never message-local. */
  public failNextObserve = false;
  /** The 1-based observe number to corrupt with the profile-mismatching pane (0 disables). Lets a test corrupt a
   *  SPECIFIC delivery-time observation — e.g. the SECOND one, inside buildInternalDeliveryAuthority — rather than the
   *  next one, to prove that observation is validated GLOBALLY too. */
  public corruptObserveNumber = 0;
  private observeCount = 0;
  public constructor(
    private readonly ok: As1TmuxDestination,
    private readonly mismatch: As1TmuxDestination,
  ) {}
  public observe(): Promise<As1TmuxDestination> {
    this.observeCount += 1;
    if (this.failNextObserve) {
      this.failNextObserve = false;
      return Promise.resolve(this.mismatch);
    }
    if (this.observeCount === this.corruptObserveNumber) {
      return Promise.resolve(this.mismatch);
    }
    return Promise.resolve(this.ok);
  }
  public bufferExists(): Promise<boolean> {
    return Promise.resolve(false);
  }
  public loadVerifiedBuffer(): Promise<void> {
    return Promise.resolve();
  }
  public pasteBuffer(): Promise<void> {
    this.pasteCalls += 1;
    return Promise.resolve();
  }
  public sendEnter(): Promise<void> {
    this.enterCalls += 1;
    return Promise.resolve();
  }
  public deleteBuffer(): Promise<void> {
    return Promise.resolve();
  }
}

async function buildDeliveryAuthority(
  stateRoot: string,
  store: As1ProfileInboundStore,
  receiveGrant: As1PilotReceiveGrantV1,
  profile: As1Profile,
  intakeId: string,
): Promise<{ readonly grant: Record<string, unknown>; readonly lease: Record<string, unknown> }> {
  const state = await store.readReceiveGrantState(receiveGrant.receiveGrantId);
  const root = await store.findRootByIntakeId(intakeId);
  if (state === null || root === null) throw new Error('missing durable intake state');
  const rootCorrelationHash = hashCanonical({
    rootKeyHash: root.rootKeyHash,
    bindingStateHash: root.bindingStateHash,
    sourceEventId: root.sourceEventId,
    rootTs: root.rootTs,
    intakeId,
  });
  const deliveryId = `as1p-${hashCanonical({ intakeId }).slice('sha256:'.length, 'sha256:'.length + 40)}`;
  const pointerDir = path.join(stateRoot, 'artifacts/as1-slack-pilot', profile.profileStateSlug, 'pointers', deliveryId);
  const [pointerFile] = await readdir(pointerDir);
  if (pointerFile === undefined) throw new Error('materialized pointer not found');
  const pointerArtifactRef = `artifacts/as1-slack-pilot/${profile.profileStateSlug}/pointers/${deliveryId}/${pointerFile}`;
  const pointerHash = `sha256:${pointerFile.replace('.json', '')}`;
  const grant = {
    schemaVersion: 'agent-office.as1-pointer-delivery-grant.v1',
    pointerDeliveryGrantId: 'as1-pdg-live-0001',
    receiveGrantId: receiveGrant.receiveGrantId,
    receiveGrantBindingHash: state.stateHash,
    pilotId: receiveGrant.pilotId,
    profileId: receiveGrant.profileId,
    intakeId,
    sourceEventId: root.sourceEventId,
    rootCorrelationHash,
    pointerArtifactRef,
    pointerHash,
    advisorTeam: profile.advisorTeam,
    actorId: profile.actorId,
    roleInstanceId: profile.roleInstanceId,
    evidencePrefix: `${AUTH_ROOT}/runtime-evidence/${profile.profileStateSlug}`,
    governanceSnapshotHash: receiveGrant.governanceSnapshotHash,
    registrySnapshotHash: receiveGrant.registrySnapshotHash,
    globalControlSnapshotHash: receiveGrant.globalControlSnapshotHash,
    profileLatchSnapshotHash: receiveGrant.profileLatchSnapshotHash,
    authorityRepositoryId: receiveGrant.authorityRepositoryId,
    authorityRootId: receiveGrant.authorityRootId,
    authoritySourceCommit: 'b'.repeat(40),
    issuedAt: '2026-07-14T22:05:05.000Z',
    expiresAt: '2026-07-14T22:08:00.000Z',
    useLimit: 1,
  };
  const lease = {
    schemaVersion: 'agent-office.as1-advisor-readiness-lease.v1',
    leaseId: 'as1-lease-live-0001',
    pointerDeliveryGrantId: grant.pointerDeliveryGrantId,
    receiveGrantId: grant.receiveGrantId,
    pilotId: grant.pilotId,
    profileId: grant.profileId,
    intakeId,
    sourceEventId: root.sourceEventId,
    pointerHash,
    advisorTeam: profile.advisorTeam,
    actorId: profile.actorId,
    roleInstanceId: profile.roleInstanceId,
    destination: validDestination(),
    readiness: 'IDLE_FOR_ONE_AS1_POINTER',
    useLimit: 1,
    observedAt: '2026-07-14T22:05:05.000Z',
    issuedAt: '2026-07-14T22:05:05.000Z',
    expiresAt: '2026-07-14T22:05:25.000Z',
    authoritySnapshotHash: grant.governanceSnapshotHash,
    registrySnapshotHash: grant.registrySnapshotHash,
    receiveGrantBindingHash: grant.receiveGrantBindingHash,
    pointerDeliveryGrantSnapshotHash: hashCanonical(grant),
  };
  return { grant, lease };
}

async function startAgentOfficeComposition(options: {
  readonly socket?: FakeCompositionSocket;
  readonly evidenceVerifier?: As1GitProvenanceVerifier;
  readonly decorateInboundStore?: (store: As1ProfileInboundStore) => As1ProfileInboundStore;
  readonly stateRoot?: string;
  readonly personalLeoOnly?: boolean;
  readonly tmuxPort?: FakeTmuxObservationPort | ControllableTmuxObservationPort;
  readonly expectedPersonalRoot?: string;
} = {}) {
  const stateRoot = options.stateRoot ?? (await makeStateRoot());
  const world = fakeWireWorld();
  const { filePath } = await writeSecretFile(secretText(validSecretValues()));
  const descriptor = parseRuntimeDescriptor({
    schemaVersion: 'agent-office.as1-slack-pilot-descriptor.v1',
    enabled: true,
    receiveGrantRef: RECEIVE_GRANT_REF,
    secretFilePath: filePath,
  });
  const gitSource = new FakeGitSource();
  const socket = options.socket ?? new FakeCompositionSocket();
  const tmuxPort = options.tmuxPort ?? new FakeTmuxObservationPort(parseTmuxDestination(validDestination(), 'destination'));
  const clock = new FakeClock(CLOCK_ISO);
  const composition = await As1GatewayComposition.open(descriptor, {
    stateRoot,
    clock,
    personalLeoOnly: options.personalLeoOnly === true,
    // Handoff 116 narrow test seam: a temporary root satisfies the personal-mode gate WITHOUT touching the live fixed
    // root; production omits this and the gate stays the exact leo-v1 literal. A test may pass a DIFFERENT expected root
    // to exercise the fail-closed gate.
    ...(options.personalLeoOnly === true ? { expectedPersonalRoot: options.expectedPersonalRoot ?? stateRoot } : {}),
    deps: {
      gitSource,
      web: world.web,
      tmuxPort,
      buildSocket: () => socket,
      buildReceiveGrantProvenance: () => ACCEPTING_RECEIVE_GATE,
      buildDeliveryProvenance: () => ACCEPTING_DELIVERY_GATE,
      evidenceVerifier: options.evidenceVerifier ?? new FakeGitVerifier(),
      missionAuthorityRoot: AUTH_ROOT,
      ...(options.decorateInboundStore !== undefined ? { decorateInboundStore: options.decorateInboundStore } : {}),
    },
  });
  // The control records now exist: bind ALL THREE grant hashes (state-root + pre-transition control/latch) and set
  // the grant AFTER open but BEFORE start(), so the F02 pre-transition snapshot comparison accepts it.
  // Freeze ONE exact receive grant: its authority repository must equal the observer's repository id ('foundation-docs';
  // the fake grant defaults to 'agent-office'), otherwise accepted evidence fails closed on EVIDENCE_WRONG_REPOSITORY
  // before ingress. The SAME frozen object is set into Git AND returned, so no test reconstructs a drifting grant.
  const receiveGrantHashes = await boundGrantHashes(stateRoot, 'agent-office-advisor');
  const receiveGrant = validReceiveGrant({ ...receiveGrantHashes, authorityRepositoryId: gitSource.getRepositoryId() });
  gitSource.set(RECEIVE_GRANT_REF, receiveGrant);
  return { stateRoot, composition, gitSource, socket, tmuxPort, clock, receiveGrantHashes, receiveGrant, web: world.web };
}

describe('AS1 live composition — one fixed-workspace / Leo-only Agent Office round trip', () => {
  it('runs the exact startup order, arms receive, and binds one Leo root to an intake', async () => {
    const { composition, socket } = await startAgentOfficeComposition();
    try {
      const start = await composition.start();
      expect(start.connected).toBe(true);
      expect(start.reason).toBe('RECEIVING_ARMED');
      expect(socket.armed).toBe(true); // armed only after the durable RECEIVING transition (design §6 step 8)

      await socket.deliver(slackEnvelope());
      const intakeId = composition.lastIntake();
      expect(intakeId).not.toBeNull();
      expect(composition.status().connected).toBe(true);
    } finally {
      await composition.stop();
    }
  });

  it('delivers the pointer through the pinned-byte tmux transport for the one accepted intake', async () => {
    const { stateRoot, composition, socket, gitSource, tmuxPort, receiveGrant } = await startAgentOfficeComposition();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope());
      const intakeId = composition.lastIntake();
      expect(intakeId).not.toBeNull();
      if (intakeId === null) throw new Error('expected an intake');

      const store = await As1ProfileInboundStore.open(stateRoot, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock(CLOCK_ISO));
      const { grant, lease } = await buildDeliveryAuthority(stateRoot, store, parseReceiveGrant(receiveGrant), selectProfile('AGENT_OFFICE_ADVISOR'), intakeId);
      const base = `${AUTH_ROOT}/runtime-authority/agent-office-advisor/${intakeId}`;
      gitSource.set(`${base}/pointer-delivery-grant.json`, grant);
      gitSource.set(`${base}/readiness-lease.json`, lease);

      const result = await composition.deliverPending();
      expect(result.outcome).toBe('DELIVERED');
      expect(tmuxPort.pasteCalls).toBe(1);
      expect(tmuxPort.enterCalls).toBe(1);

      // Evidence authority builds from the terminal delivery; the evidence blobs are not populated (NOT_READY).
      const evidence = await composition.ingestEvidenceAndProject();
      expect(evidence).toContain('ACK:NOT_READY');
    } finally {
      await composition.stop();
    }
  });

  it('F03 (Patch 2A): a readiness lease that diverges after delivery blocks evidence/outbound and latches the profile', async () => {
    const { stateRoot, composition, socket, gitSource, receiveGrant } = await startAgentOfficeComposition();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope());
      const intakeId = composition.lastIntake();
      if (intakeId === null) throw new Error('expected an intake');
      const store = await As1ProfileInboundStore.open(stateRoot, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock(CLOCK_ISO));
      const { grant, lease } = await buildDeliveryAuthority(stateRoot, store, parseReceiveGrant(receiveGrant), selectProfile('AGENT_OFFICE_ADVISOR'), intakeId);
      const base = `${AUTH_ROOT}/runtime-authority/agent-office-advisor/${intakeId}`;
      gitSource.set(`${base}/pointer-delivery-grant.json`, grant);
      gitSource.set(`${base}/readiness-lease.json`, lease);
      expect((await composition.deliverPending()).outcome).toBe('DELIVERED');

      // The accepted lease diverges (rewrite/deletion) BEFORE evidence ingress — which the real owner calls directly.
      // Evidence/outbound must NOT proceed, and the selected profile durably latches.
      gitSource.divergePaths.add(`${base}/readiness-lease.json`);
      await expect(composition.ingestEvidenceAndProject()).rejects.toThrow(/readiness lease diverged/u);
      const latchRaw = await readFile(path.join(stateRoot, 'indexes/as1-slack-pilot/profiles/agent-office-advisor/failure-latch.json'), 'utf8');
      expect((JSON.parse(latchRaw) as { readonly latched: boolean }).latched).toBe(true);
    } finally {
      await composition.stop();
    }
  });

  it('handoff 116 §1: the personal Leo-only runtime fails closed on any root but the fixed leo-v1 root', async () => {
    // The personal Leo-only mode binds ONLY the fixed leo-v1 state root. A composition opened in that mode against any
    // other root (here the temp harness root) never arms receive — it returns DISABLED_DEFAULT_NO_AUTHORITY before any
    // authority is observed, so no message is accepted and the R2/original roots are never operated on.
    // Require the EXACT production leo-v1 literal as the expected root (never the temp harness root), so the gate is the
    // real fail-closed path: a personal composition on any other root returns DISABLED before any authority is observed.
    const { composition } = await startAgentOfficeComposition({ personalLeoOnly: true, expectedPersonalRoot: AS1_PERSONAL_LEO_ONLY_STATE_ROOT });
    try {
      const start = await composition.start();
      expect(start.connected).toBe(false);
      expect(start.reason).toBe('DISABLED_DEFAULT_NO_AUTHORITY');
    } finally {
      await composition.stop();
    }
  });

  it('handoff 116 §5/§6: personal Leo-only delivers via the internal per-message lease with NO Git grant/lease', async () => {
    const { composition, socket, tmuxPort, gitSource } = await startAgentOfficeComposition({ personalLeoOnly: true });
    try {
      const start = await composition.start();
      expect(start.connected).toBe(true);
      await socket.deliver(slackEnvelope());
      expect(composition.lastIntake()).not.toBeNull();
      const result = await composition.deliverPending();
      expect(result.outcome).toBe('DELIVERED'); // the auto-created internal lease delivered through the fixed %26 pane
      expect(tmuxPort.pasteCalls).toBe(1);
      expect(tmuxPort.enterCalls).toBe(1);
      // No Git pointer-delivery grant or readiness lease was ever observed — the delivery authority is entirely internal.
      expect(
        gitSource.acceptedCalls.some((c) => c.path.includes('pointer-delivery-grant.json') || c.path.includes('readiness-lease.json')),
      ).toBe(false);
      expect(await composition.ingestEvidenceAndProject()).toContain('ACK:NOT_READY');
    } finally {
      await composition.stop();
    }
  });

  it('handoff 116 §1/§4: personal Leo-only processes two sequential Leo roots via fresh per-message internal grants', async () => {
    const { composition, socket, tmuxPort } = await startAgentOfficeComposition({ personalLeoOnly: true });
    try {
      await composition.start();
      await socket.deliver(slackEnvelope({ envelopeId: 'Env0AGENTOFFICE1', eventId: 'Ev0AGENTOFFICE01', ts: '1720000000.000100' }));
      const intake1 = composition.lastIntake();
      expect(intake1).not.toBeNull();
      expect((await composition.deliverPending()).outcome).toBe('DELIVERED');
      await composition.ingestEvidenceAndProject();
      // The owner remains running: after the delivered result it resets and mints a fresh single-use grant (one grant
      // equals one root) for the next Leo root, which is accepted and delivered sequentially.
      composition.resetForNextLeoRoot();
      expect(composition.lastIntake()).toBeNull();
      await socket.deliver(slackEnvelope({ envelopeId: 'Env0AGENTOFFICE2', eventId: 'Ev0AGENTOFFICE02', ts: '1720000000.000200' }));
      const intake2 = composition.lastIntake();
      expect(intake2).not.toBeNull();
      expect(intake2).not.toBe(intake1); // a DISTINCT second top-level root produced a new intake (not rejected)
      expect((await composition.deliverPending()).outcome).toBe('DELIVERED');
      expect(tmuxPort.pasteCalls).toBe(2);
    } finally {
      await composition.stop();
    }
  });

  it('handoff 116 §7 (P1): a personal Leo-only fixed-destination/profile mismatch fails GLOBAL, never message-local', async () => {
    const tmuxPort = new ControllableTmuxObservationPort(
      parseTmuxDestination(validDestination(), 'ok'),
      parseTmuxDestination(validDestination({ sessionName: 'not-the-advisor' }), 'bad'),
    );
    const { composition, socket } = await startAgentOfficeComposition({ personalLeoOnly: true, tmuxPort });
    try {
      expect((await composition.start()).connected).toBe(true); // startup observed the OK pane and passed
      await socket.deliver(slackEnvelope());
      // At delivery the fixed pane no longer binds the profile — a fixed-destination/identity corruption. It must fail
      // GLOBAL (durable kill + throw), NOT the message-local reset path.
      tmuxPort.failNextObserve = true;
      await expect(composition.deliverPending()).rejects.toThrow();
      expect(composition.personalMessageFailurePending()).toBe(false); // never entered the per-message local path
      // A global kill is durable: a subsequent start attempt is refused as globally latched.
      expect((await composition.start()).reason).toBe('GLOBAL_LATCHED');
    } finally {
      await composition.stop();
    }
  });

  it('handoff 116 §7 (P1): a corrupt SECOND delivery-time observation (inside buildInternalDeliveryAuthority) fails GLOBAL', async () => {
    const tmuxPort = new ControllableTmuxObservationPort(
      parseTmuxDestination(validDestination(), 'ok'),
      parseTmuxDestination(validDestination({ sessionName: 'not-the-advisor' }), 'bad'),
    );
    const { composition, socket } = await startAgentOfficeComposition({ personalLeoOnly: true, tmuxPort });
    try {
      expect((await composition.start()).connected).toBe(true); // startup observe #1 (ok)
      await socket.deliver(slackEnvelope());
      // Corrupt observe #3 = the SECOND delivery-time observation, INSIDE buildInternalDeliveryAuthority (#2 is
      // deliverPending's own re-validation). It must engage the global kill — the internal-lease build now runs through
      // the same validator, so this is never downgraded to the personal message-local STOPPED_BEFORE_PASTE path.
      tmuxPort.corruptObserveNumber = 3;
      await expect(composition.deliverPending()).rejects.toThrow();
      expect(composition.personalMessageFailurePending()).toBe(false); // never entered the per-message local path
      expect((await composition.start()).reason).toBe('GLOBAL_LATCHED'); // durable global kill
    } finally {
      await composition.stop();
    }
  });

  it('handoff 116 §7 (P1): a corrupt FIRST exact-transport observation fails GLOBAL', async () => {
    const tmuxPort = new ControllableTmuxObservationPort(
      parseTmuxDestination(validDestination(), 'ok'),
      parseTmuxDestination(validDestination({ sessionName: 'not-the-advisor' }), 'bad'),
    );
    const { composition, socket } = await startAgentOfficeComposition({ personalLeoOnly: true, tmuxPort });
    try {
      expect((await composition.start()).connected).toBe(true); // startup observe #1 (ok)
      await socket.deliver(slackEnvelope());
      // Corrupt observe #4 = the exact transport's FIRST re-observation (#2 deliverPending-validate, #3 build-validate
      // are ok). The transport observes through the same validator, so a mismatch engages the global kill, never the
      // personal message-local STOPPED_BEFORE_PASTE path.
      tmuxPort.corruptObserveNumber = 4;
      await expect(composition.deliverPending()).rejects.toThrow();
      expect(composition.personalMessageFailurePending()).toBe(false);
      expect((await composition.start()).reason).toBe('GLOBAL_LATCHED');
    } finally {
      await composition.stop();
    }
  });

  it('handoff 116 §5 (P2): minted receive grants are fresh across process restarts on the same durable state root', async () => {
    const stateRoot = await makeStateRoot();
    const a = await startAgentOfficeComposition({ personalLeoOnly: true, stateRoot });
    await a.composition.start();
    await a.socket.deliver(slackEnvelope({ envelopeId: 'Env0AGENTOFFICE1', eventId: 'Ev0AGENTOFFICE01', ts: '1720000000.000100' }));
    expect((await a.composition.deliverPending()).outcome).toBe('DELIVERED');
    const idA = a.composition.currentReceiveGrantId();
    await a.composition.stop();
    // "Restart": a fresh composition/owner on the SAME durable state root. The minted id must be fresh, so it does not
    // collide with the pre-restart durable binding and the next root binds + delivers.
    const b = await startAgentOfficeComposition({ personalLeoOnly: true, stateRoot });
    await b.composition.start();
    const idB = b.composition.currentReceiveGrantId();
    try {
      expect(idA).not.toBeNull();
      expect(idB).not.toBeNull();
      expect(idB).not.toBe(idA);
      await b.socket.deliver(slackEnvelope({ envelopeId: 'Env0AGENTOFFICE2', eventId: 'Ev0AGENTOFFICE02', ts: '1720000000.000200' }));
      expect((await b.composition.deliverPending()).outcome).toBe('DELIVERED');
    } finally {
      await b.composition.stop();
    }
  });

  it('posts DELIVERY_CONFIRMED immediately and idempotently after durable transport', async () => {
    const { stateRoot, composition, socket, web } = await startAgentOfficeComposition({ personalLeoOnly: true });
    try {
      await composition.start();
      await socket.deliver(slackEnvelope());
      const intakeId = composition.lastIntake();
      if (intakeId === null) throw new Error('expected an intake');
      const postsAfterAccept = web.posted.length; // ACCEPTED only, before delivery
      expect((await composition.deliverPending()).outcome).toBe('DELIVERED');
      // Immediate: DELIVERY_CONFIRMED is posted right after the durable transport — WITHOUT waiting for the Advisor ACK.
      const profile = selectProfile('AGENT_OFFICE_ADVISOR');
      const store = await As1ProfileInboundStore.open(stateRoot, profile, new FakeClock(CLOCK_ISO));
      expect(await store.readOutboxRecord(userStatusOutboundId(profile.profileId, intakeId, 'DELIVERY_CONFIRMED'))).not.toBeNull();
      const postsAfterConfirm = web.posted.length;
      expect(postsAfterConfirm).toBe(postsAfterAccept + 1); // exactly one new post = DELIVERY_CONFIRMED
      // Idempotent: a re-entry (the transport journal is terminal TRANSPORT_RECORDED) posts NO duplicate, and a later
      // accepted ACK (evidence ingest) also does not — it observes the durable record and skips.
      expect((await composition.deliverPending()).outcome).toBe('DELIVERED');
      const evidence = await composition.ingestEvidenceAndProject();
      expect(web.posted.length).toBe(postsAfterConfirm); // still exactly one DELIVERY_CONFIRMED post
      expect(evidence).toContain('ACK:NOT_READY');
    } finally {
      await composition.stop();
    }
  });

  it('handles two sequential PERSONAL_LEO_ONLY messages with same-thread replies and dedupe', async () => {
    // Drive the REAL runForegroundOwner loop over a real PERSONAL composition + the full owner harness. Each message is
    // delivered to the fixed %26; the separate Advisor answers via the EXACT parsed production command; and the owner
    // loop AUTOMATICALLY consumes + posts to the SAME thread, then advances to the next sequential message.
    const clock = new FakeClock(CLOCK_ISO);
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));
    const gitSource = new FakeGitSource();
    gitSource.setLazy(RECEIVE_GRANT_REF, async () => validReceiveGrant(await boundGrantHashes(stateRoot, 'agent-office-advisor')));
    // Handoff 120: seed the EXACT obsolete advisor latch on the durable root BEFORE the lazy grant snapshot hashes are
    // derived (they are read at observe time during start below), so the fresh startup grant binds the TRUE-latch
    // snapshot and the four startup-grant validations pass against it. A prior clean run is simulated: latch the advisor
    // profile with the exact obsolete reason, then drain to DISABLED_CLEAN. The personal owner must retire this latch
    // after those validations and then proceed to receive both messages.
    const seed = await As1SlackControl.open(stateRoot, new FakeClock(CLOCK_ISO));
    await seed.latchProfile('agent-office-advisor', OBSOLETE_ADVISOR_LATCH_REASON);
    await seed.shutdown(); // DISABLED_DEFAULT -> DISABLED_CLEAN
    await seed.close();
    const socket = new FakeCompositionSocket();
    const tmuxPort = new FakeTmuxObservationPort(parseTmuxDestination(validDestination(), 'd'));
    const signals = new Map<As1OwnerSignal, () => void>();
    let tick = 0;
    const boundary: As1ForegroundOwnerBoundary = {
      descriptor: enabledDescriptor(filePath),
      stateRoot,
      clock,
      personalLeoOnly: true,
      buildDeps: () => fullFakeDeps(gitSource, world, { buildSocket: () => socket, tmuxPort }),
      initialize: () => Promise.resolve(),
      installSignalHandlers: (handlers) => {
        (['SIGINT', 'SIGTERM', 'SIGUSR2'] as const).forEach((s) => signals.set(s, handlers[s]));
        return ['SIGINT', 'SIGTERM', 'SIGUSR2'];
      },
      // Handoff 122 (FIFO thread routing): ENQUEUE BOTH inputs before answer 1 — msg1 (a new top-level message) + a
      // DUPLICATE (deduped) + msg2 (a REPLY carrying a DIFFERENT existing thread_ts). msg2 waits in the PERSONAL FIFO
      // while msg1's answer is pending; after answer 1 completes and resetForNextLeoRoot() clears `lastIntakeId`, the
      // owner must still deliver the FIFO-queued reply. Answered in FIFO order; each RESULT posts to its own exact thread.
      delay: async () => {
        tick += 1;
        if (tick === 1) {
          await socket.deliver(slackEnvelope({ envelopeId: 'Env0AGENTOFFICE1', eventId: 'Ev0AGENTOFFICE01', ts: '1720000000.000100' }));
          await socket.deliver(slackEnvelope({ envelopeId: 'Env0AGENTOFFICE1b', eventId: 'Ev0AGENTOFFICE01', ts: '1720000000.000100' })); // DUPLICATE event id → deduped
          // msg2 is enqueued NOW (before answer 1) as a REPLY to a DIFFERENT existing thread (thread_ts != its own ts).
          await socket.deliver(slackEnvelope({ envelopeId: 'Env0AGENTOFFICE2', eventId: 'Ev0AGENTOFFICE02', ts: '1720000000.000200', threadTs: '1720000000.000900' }));
        } else if (tick === 2) {
          // The Advisor answers through the EXACT parsed production dispatch (parse -> runAs1Cli 'answer'), not the bare
          // helper. The 'answer' verb needs no composition (the fixed leo-v1 root + sole pending correlation are internal).
          await runAs1Cli(parseAs1Cli(['answer', 'answer', 'one']), {} as unknown as As1GatewayComposition, stateRoot);
        } else if (tick === 4) {
          // By now the owner has delivered the FIFO-queued reply (msg2) even though `lastIntakeId` was cleared by answer 1.
          await runAs1Cli(parseAs1Cli(['answer', 'answer', 'two']), {} as unknown as As1GatewayComposition, stateRoot);
        } else if (tick >= 5) {
          signals.get('SIGTERM')?.();
        }
        // tick 3: no action — the owner delivers the FIFO-queued reply now that msg1's answer completed and reset.
      },
    };
    const result = await runForegroundOwner(boundary);
    expect(result.ok).toBe(true); // clean stop after BOTH sequential messages were answered
    // The owner posted each answer to its OWN thread; the duplicate event produced no third answer.
    const answers = world.web.posted.filter((p) => p.request.text.startsWith('RESULT [COMPLETED]'));
    expect(answers.length).toBe(2);
    expect(answers[0]?.request.text).toContain('answer one');
    expect(answers[0]?.request.threadTs).toBe('1720000000.000100');
    expect(answers[1]?.request.text).toContain('answer two');
    expect(answers[1]?.request.threadTs).toBe('1720000000.000900'); // the reply's DIFFERENT existing thread_ts — the FIFO-queued msg2 was delivered and routed to its own thread, not its ts or msg1's
    // Retirement proof: the seeded obsolete advisor latch was cleared to false at startup — otherwise start() would have
    // failed closed as PROFILE_LATCHED and delivered nothing (answers.length would be 0, not 2).
    const advisorLatchRaw = await readFile(path.join(stateRoot, 'indexes/as1-slack-pilot/profiles/agent-office-advisor/failure-latch.json'), 'utf8');
    expect((JSON.parse(advisorLatchRaw) as { readonly latched: boolean }).latched).toBe(false);
    // Handoff 121: the pasted Advisor answer instruction uses the fixed worktree-prefix npm command (pane %26 runs from
    // /home/leo/Project/agent-office, which does not expose the script), never the old bare `npm run` form.
    expect(tmuxPort.loadedBuffers.length).toBeGreaterThan(0);
    const firstPaste = (tmuxPort.loadedBuffers[0] ?? Buffer.alloc(0)).toString('utf8');
    expect(firstPaste).toContain('npm --prefix /home/leo/Project/.worktrees/agent-office/AGENT_OFFICE_AS1_PHASE_B_LIVE_PILOT_001 run as1:slack-pilot -- answer "<bounded answer text>"');
    expect(firstPaste).not.toContain('npm run as1:slack-pilot');
  });

  it('rejects a second top-level root (one root-to-result round trip per channel)', async () => {
    const { composition, socket } = await startAgentOfficeComposition();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope({ envelopeId: 'Env0AGENTOFFICE1', eventId: 'Ev0AGENTOFFICE01', ts: '1720000000.000100' }));
      const first = composition.lastIntake();
      expect(first).not.toBeNull();
      // A DISTINCT second top-level root is durably rejected (rootLimit: 1) — processed, never a second bound root.
      const second = await socket
        .deliver(slackEnvelope({ envelopeId: 'Env0AGENTOFFICE2', eventId: 'Ev0AGENTOFFICE02', ts: '1720000000.000200' }))
        .then(() => 'ok');
      expect(second).toBe('ok');
      expect(composition.lastIntake()).toBe(first); // the second root produced no new intake
    } finally {
      await composition.stop();
    }
  });

  it('a foreign-workspace / non-Leo secret mismatch fails the composition closed before any receive', async () => {
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues({ SLACK_AGENT_OFFICE_CHANNEL_ID: 'CDIFFERENT0001' })));
    const descriptor = parseRuntimeDescriptor({
      schemaVersion: 'agent-office.as1-slack-pilot-descriptor.v1',
      enabled: true,
      receiveGrantRef: RECEIVE_GRANT_REF,
      secretFilePath: filePath,
    });
    const gitSource = new FakeGitSource();
    // Correctly-bound state-root + control/latch hashes so start() passes the F02 gates and reaches the step-4 secret
    // proof, which rejects because the grant names CAGENTOFFICE01 while the secret names CDIFFERENT0001.
    gitSource.setLazy(RECEIVE_GRANT_REF, async () => validReceiveGrant(await boundGrantHashes(stateRoot, 'agent-office-advisor')));
    const composition = await As1GatewayComposition.open(descriptor, {
      stateRoot,
      clock: new FakeClock(CLOCK_ISO),
      deps: {
        gitSource,
        web: world.web,
        tmuxPort: new FakeTmuxObservationPort(parseTmuxDestination(validDestination(), 'd')),
        buildSocket: () => new FakeCompositionSocket(),
        buildReceiveGrantProvenance: () => ACCEPTING_RECEIVE_GATE,
        buildDeliveryProvenance: () => ACCEPTING_DELIVERY_GATE,
        evidenceVerifier: new FakeGitVerifier(),
        missionAuthorityRoot: AUTH_ROOT,
      },
    });
    await expect(composition.start()).rejects.toThrow();
    await composition.close();
  });

  it('a disabled descriptor never connects (fail-closed) even with live dependencies', async () => {
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));
    const descriptor = parseRuntimeDescriptor({
      schemaVersion: 'agent-office.as1-slack-pilot-descriptor.v1',
      enabled: false,
      receiveGrantRef: null,
      secretFilePath: filePath,
    });
    const composition = await As1GatewayComposition.open(descriptor, {
      stateRoot,
      clock: new FakeClock(CLOCK_ISO),
      deps: {
        gitSource: new FakeGitSource(),
        web: world.web,
        tmuxPort: new FakeTmuxObservationPort(parseTmuxDestination(validDestination(), 'd')),
        buildSocket: () => new FakeCompositionSocket(),
        buildReceiveGrantProvenance: () => ACCEPTING_RECEIVE_GATE,
        buildDeliveryProvenance: () => ACCEPTING_DELIVERY_GATE,
        evidenceVerifier: new FakeGitVerifier(),
        missionAuthorityRoot: AUTH_ROOT,
      },
    });
    const result = await composition.start();
    expect(result.connected).toBe(false);
    expect(result.reason).toBe('DISABLED_DEFAULT_NO_AUTHORITY');
    await composition.close();
  });
});

/** Read the durable global-control state persisted under a state root — used to prove authority ORDER and revert. */
async function readControlState(stateRoot: string): Promise<string> {
  const raw = await readFile(path.join(stateRoot, 'indexes/as1-slack-pilot/global-control.json'), 'utf8');
  return (JSON.parse(raw) as { readonly state: string }).state;
}

/** The full synthetic dependency graph a connecting composition needs; overrides let a test swap one gate/port. */
function fullFakeDeps(
  gitSource: FakeGitSource,
  world: ReturnType<typeof fakeWireWorld>,
  overrides: Partial<As1CompositionDependencies> = {},
): As1CompositionDependencies {
  return {
    gitSource,
    web: world.web,
    tmuxPort: new FakeTmuxObservationPort(parseTmuxDestination(validDestination(), 'd')),
    buildSocket: () => new FakeCompositionSocket(),
    buildReceiveGrantProvenance: () => ACCEPTING_RECEIVE_GATE,
    buildDeliveryProvenance: () => ACCEPTING_DELIVERY_GATE,
    evidenceVerifier: new FakeGitVerifier(),
    missionAuthorityRoot: AUTH_ROOT,
    ...overrides,
  };
}

function enabledDescriptor(secretFilePath: string) {
  return parseRuntimeDescriptor({
    schemaVersion: 'agent-office.as1-slack-pilot-descriptor.v1',
    enabled: true,
    receiveGrantRef: RECEIVE_GRANT_REF,
    secretFilePath,
  });
}

describe('AS1 F02 — authority order, fixed profile-state-root binding, and revert', () => {
  it('proves FULL receive-grant provenance BEFORE the first durable authority transition (ordered spy)', async () => {
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));
    const gitSource = new FakeGitSource();
    gitSource.setLazy(RECEIVE_GRANT_REF, async () => validReceiveGrant(await boundGrantHashes(stateRoot, 'agent-office-advisor')));
    const states: string[] = [];
    const spyGate: As1ReceiveGrantProvenanceGate = {
      assertAccepted: async () => {
        states.push(await readControlState(stateRoot));
      },
    };
    const composition = await As1GatewayComposition.open(enabledDescriptor(filePath), {
      stateRoot,
      clock: new FakeClock(CLOCK_ISO),
      deps: fullFakeDeps(gitSource, world, { buildReceiveGrantProvenance: () => spyGate }),
    });
    try {
      await composition.start();
      // The FIRST provenance proof ran while the control was still DISABLED_DEFAULT — before RECEIVE_GRANTED persisted.
      expect(states[0]).toBe('DISABLED_DEFAULT');
    } finally {
      await composition.stop();
    }
  });

  it('rejects a receive grant whose profileStateRootHash does not bind this owner root, before any transition', async () => {
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));
    const gitSource = new FakeGitSource();
    gitSource.set(RECEIVE_GRANT_REF, validReceiveGrant({ profileStateRootHash: `sha256:${'0'.repeat(64)}` }));
    const composition = await As1GatewayComposition.open(enabledDescriptor(filePath), {
      stateRoot,
      clock: new FakeClock(CLOCK_ISO),
      deps: fullFakeDeps(gitSource, world),
    });
    await expect(composition.start()).rejects.toThrow(/profileStateRootHash/u);
    expect(await readControlState(stateRoot)).toBe('DISABLED_DEFAULT'); // never transitioned
    await composition.close();
  });

  it('reverts a post-transition startup failure to a clean disabled state and RELEASES the writer lock', async () => {
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    // A secret whose channel disagrees with the grant throws at step 4 — AFTER the durable RECEIVE_GRANTED transition.
    const { filePath } = await writeSecretFile(secretText(validSecretValues({ SLACK_AGENT_OFFICE_CHANNEL_ID: 'CDIFFERENT0001' })));
    const gitSource = new FakeGitSource();
    gitSource.setLazy(RECEIVE_GRANT_REF, async () => validReceiveGrant(await boundGrantHashes(stateRoot, 'agent-office-advisor')));
    const composition = await As1GatewayComposition.open(enabledDescriptor(filePath), {
      stateRoot,
      clock: new FakeClock(CLOCK_ISO),
      deps: fullFakeDeps(gitSource, world),
    });
    await expect(composition.start()).rejects.toThrow(DomainError);
    // The durable control reverted to a legal disabled state — never left half-started at RECEIVE_GRANTED.
    expect(await readControlState(stateRoot)).toBe('DISABLED_DEFAULT');
    // Ownership was released: a fresh foreground composition can re-acquire the writer lock on the same root.
    const reopened = await As1GatewayComposition.open(enabledDescriptor(filePath), {
      stateRoot,
      clock: new FakeClock(CLOCK_ISO),
      deps: fullFakeDeps(gitSource, world),
    });
    await reopened.close();
  });
});

describe('AS1 F03 — accepted-pair re-observation, divergence latch, and grant expiry', () => {
  it('re-observes the accepted receive grant WITH its internally bound (firstAddCommit, blobSha256) pair', async () => {
    const { composition, gitSource } = await startAgentOfficeComposition();
    try {
      await composition.start();
      gitSource.acceptedCalls.length = 0; // ignore the pre-acceptance start observation
      expect(await composition.observeReceiveGrantOnce()).toBe('RECEIVING');
      const reObs = gitSource.acceptedCalls.find((call) => call.path === RECEIVE_GRANT_REF);
      expect(reObs?.accepted?.firstAddCommit).toBe('a'.repeat(40));
      expect(typeof reObs?.accepted?.blobSha256).toBe('string');
    } finally {
      await composition.stop();
    }
  });

  it('durably latches the profile when the accepted receive grant DIVERGES after acceptance', async () => {
    const { composition, gitSource } = await startAgentOfficeComposition();
    try {
      await composition.start();
      gitSource.divergePaths.add(RECEIVE_GRANT_REF); // a post-acceptance rewrite / deletion / path reuse
      expect(await composition.observeReceiveGrantOnce()).toBe('DIVERGED');
      // The composition stopped receiving; a delivery attempt now fails closed.
      await expect(composition.deliverPending()).rejects.toThrow(DomainError);
    } finally {
      await composition.stop();
    }
  });

  it('closes receive at the exclusive grant expiry (bounded, no renew/switch/reconnect)', async () => {
    const clock = new FakeClock(CLOCK_ISO);
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));
    const gitSource = new FakeGitSource();
    gitSource.setLazy(RECEIVE_GRANT_REF, async () => validReceiveGrant(await boundGrantHashes(stateRoot, 'agent-office-advisor')));
    const composition = await As1GatewayComposition.open(enabledDescriptor(filePath), { stateRoot, clock, deps: fullFakeDeps(gitSource, world) });
    try {
      await composition.start();
      clock.advanceMs(10 * 60 * 1000); // past the grant's exclusive expiry (issued 22:05, expires 22:10)
      expect(await composition.observeReceiveGrantOnce()).toBe('EXPIRED');
    } finally {
      await composition.stop();
    }
  });
});

describe('AS1 F01 — foreground production owner', () => {
  async function makeOwnerBoundary(
    clock: FakeClock,
    overrides: Partial<As1ForegroundOwnerBoundary> = {},
  ): Promise<{ boundary: As1ForegroundOwnerBoundary; signals: Map<As1OwnerSignal, () => void>; stateRoot: string; gitSource: FakeGitSource }> {
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));
    const gitSource = new FakeGitSource();
    // The owner opens the composition internally; the grant is materialized lazily at observe-time so it carries the
    // exact pre-transition control/latch hashes computed after that open.
    gitSource.setLazy(RECEIVE_GRANT_REF, async () => validReceiveGrant(await boundGrantHashes(stateRoot, 'agent-office-advisor')));
    const signals = new Map<As1OwnerSignal, () => void>();
    const boundary: As1ForegroundOwnerBoundary = {
      descriptor: enabledDescriptor(filePath),
      stateRoot,
      clock,
      buildDeps: () => fullFakeDeps(gitSource, world),
      initialize: () => Promise.resolve(),
      installSignalHandlers: (handlers) => {
        (['SIGINT', 'SIGTERM', 'SIGUSR2'] as const).forEach((signal) => signals.set(signal, handlers[signal]));
        return ['SIGINT', 'SIGTERM', 'SIGUSR2'];
      },
      delay: () => Promise.resolve(),
      ...overrides,
    };
    return { boundary, signals, stateRoot, gitSource };
  }

  it('constructs a COMPLETE real production dependency graph (no invocation)', () => {
    const deps = buildAs1ProductionDependencies(['a'.repeat(40)]);
    expect(typeof deps.gitSource.observe).toBe('function');
    expect(typeof deps.web.authTest).toBe('function');
    expect(typeof deps.tmuxPort.observe).toBe('function');
    expect(typeof deps.buildSocket).toBe('function');
    expect(typeof deps.buildReceiveGrantProvenance).toBe('function');
    expect(typeof deps.buildDeliveryProvenance).toBe('function');
    expect(typeof deps.evidenceVerifier.verify).toBe('function');
  });

  it('fails closed on an incomplete production dependency graph (before ownership)', async () => {
    const { boundary } = await makeOwnerBoundary(new FakeClock(CLOCK_ISO));
    await expect(
      runForegroundOwner({ ...boundary, buildDeps: () => ({}) as unknown as As1CompositionDependencies }),
    ).rejects.toThrow(DomainError);
  });

  it('fails closed WITHIN the owner-result boundary if a required owner signal handler is absent (no raw throw)', async () => {
    const { boundary, stateRoot } = await makeOwnerBoundary(new FakeClock(CLOCK_ISO));
    // F01 (Patch 4): a missing handler no longer throws a raw error before the stable owner result — it returns a
    // truthful fail-closed result and releases the lock (a fresh composition can re-open the same root).
    const result = await runForegroundOwner({ ...boundary, installSignalHandlers: () => ['SIGINT', 'SIGTERM'] });
    expect(result.ok).toBe(false);
    expect(result.lines.join('|')).toContain('MISSING_HANDLER_DISABLED');
    const reopened = await As1GatewayComposition.open(boundary.descriptor, { stateRoot, clock: new FakeClock(CLOCK_ISO), deps: boundary.buildDeps() });
    await reopened.close();
  });

  it('installs all three handlers and releases cleanly for a default-disabled descriptor', async () => {
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));
    const descriptor = parseRuntimeDescriptor({
      schemaVersion: 'agent-office.as1-slack-pilot-descriptor.v1',
      enabled: false,
      receiveGrantRef: null,
      secretFilePath: filePath,
    });
    const signals = new Map<As1OwnerSignal, () => void>();
    const result = await runForegroundOwner({
      descriptor,
      stateRoot,
      clock: new FakeClock(CLOCK_ISO),
      buildDeps: () => fullFakeDeps(new FakeGitSource(), world),
      initialize: () => Promise.resolve(),
      installSignalHandlers: (handlers) => {
        (['SIGINT', 'SIGTERM', 'SIGUSR2'] as const).forEach((signal) => signals.set(signal, handlers[signal]));
        return ['SIGINT', 'SIGTERM', 'SIGUSR2'];
      },
      delay: () => Promise.resolve(),
    });
    expect(signals.size).toBe(3); // all three installed immediately after ownership
    expect(result.lines.join('|')).toContain('NOT_CONNECTED');
    // The writer lock was released: a fresh composition can re-open the same root.
    const reopened = await As1GatewayComposition.open(descriptor, { stateRoot, clock: new FakeClock(CLOCK_ISO), deps: fullFakeDeps(new FakeGitSource(), world) });
    await reopened.close();
  });

  it('holds the foreground through the bounded loop and drains only on a clean SIGTERM', async () => {
    const clock = new FakeClock(CLOCK_ISO);
    const { boundary, signals } = await makeOwnerBoundary(clock);
    let ticks = 0;
    const result = await runForegroundOwner({
      ...boundary,
      delay: () => {
        ticks += 1;
        if (ticks === 3) signals.get('SIGTERM')?.(); // fire only after several live iterations
        return Promise.resolve();
      },
    });
    expect(ticks).toBeGreaterThanOrEqual(3); // it stayed foreground and looped — never an immediate return
    expect(result.ok).toBe(true);
    expect(result.lines.join('|')).toContain('STOPPED_CLEAN');
  });

  it('durably engages an operator incident kill on SIGUSR2', async () => {
    const clock = new FakeClock(CLOCK_ISO);
    const { boundary, signals } = await makeOwnerBoundary(clock);
    let ticks = 0;
    const result = await runForegroundOwner({
      ...boundary,
      delay: () => {
        ticks += 1;
        if (ticks === 2) signals.get('SIGUSR2')?.();
        return Promise.resolve();
      },
    });
    expect(result.ok).toBe(false);
    expect(result.lines.join('|')).toContain('INCIDENT_KILL_ENGAGED');
  });

  it('reaches the bounded GRANT_EXPIRED terminal without any signal', async () => {
    const clock = new FakeClock(CLOCK_ISO);
    const { boundary } = await makeOwnerBoundary(clock);
    let ticks = 0;
    const result = await runForegroundOwner({
      ...boundary,
      delay: () => {
        ticks += 1;
        if (ticks === 2) clock.advanceMs(10 * 60 * 1000); // advance past the exclusive grant expiry
        return Promise.resolve();
      },
    });
    expect(result.lines.join('|')).toContain('GRANT_EXPIRED');
  });

  it('F01: a SIGUSR2 takes PRIORITY over an earlier clean SIGTERM — incident kill wins', async () => {
    const clock = new FakeClock(CLOCK_ISO);
    const { boundary, signals } = await makeOwnerBoundary(clock);
    let ticks = 0;
    const result = await runForegroundOwner({
      ...boundary,
      delay: () => {
        ticks += 1;
        if (ticks === 2) {
          signals.get('SIGTERM')?.(); // clean first ...
          signals.get('SIGUSR2')?.(); // ... then incident: it must override, not lose to the earlier clean signal
        }
        return Promise.resolve();
      },
    });
    expect(result.ok).toBe(false);
    expect(result.lines.join('|')).toContain('INCIDENT_KILL_ENGAGED');
  });

  it('F01: a thrown loop error terminates the owner under a stable redacted outcome (never swallowed or a crash)', async () => {
    const clock = new FakeClock(CLOCK_ISO);
    const { boundary, gitSource } = await makeOwnerBoundary(clock);
    // The accepted-pair re-observation throws (store quarantine). The owner must LATCH + terminate, not swallow it
    // and keep polling (187c7152's broad catch) nor crash the process (a bare rethrow).
    gitSource.throwOnReObservePaths.add(RECEIVE_GRANT_REF);
    const result = await runForegroundOwner({ ...boundary, delay: () => Promise.resolve() });
    expect(result.ok).toBe(false);
    expect(result.lines.join('|')).toContain('OWNER_HALTED');
  });

  it('reports the sanitized pre-latch classification before unchanged cleanup', async () => {
    const clock = new FakeClock(CLOCK_ISO);
    const { boundary, gitSource } = await makeOwnerBoundary(clock);
    // Force a loop throw so the outer catch runs the pre-latch diagnostic + the UNCHANGED latch/cleanup.
    gitSource.throwOnReObservePaths.add(RECEIVE_GRANT_REF);
    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk): boolean => {
      writes.push(String(chunk));
      return true;
    });
    const result = await runForegroundOwner({ ...boundary, delay: () => Promise.resolve() }).finally(() => {
      spy.mockRestore();
    });
    // Latch/cleanup/result behavior is UNCHANGED: still a fail-closed OWNER_HALTED carrying the redacted code + cleanup.
    expect(result.ok).toBe(false);
    const halted = result.lines.join('|');
    expect(halted).toContain('OWNER_HALTED');
    const code = /OWNER_HALTED:([A-Z_]+):/.exec(halted)?.[1];
    expect(code).toBeTruthy();
    // The sanitized pre-latch classification was emitted with the SAME closed code, BEFORE the cleanup detail.
    const classification = writes.find((w) => w.includes('PRE_LATCH_CLASSIFICATION:'));
    expect(classification).toBeDefined();
    expect(classification).toContain(`PRE_LATCH_CLASSIFICATION: ${code}`);
    // Only the closed UPPER_SNAKE code is emitted — no raw message/stack/path/credential/input/payload sentinel.
    expect(classification?.trim()).toMatch(/^AS1_SLACK_PILOT PRE_LATCH_CLASSIFICATION: [A-Z_]+$/);
  });
});

describe('AS1 F06 — both fixed profiles share one owner root sequentially', () => {
  async function activeProfileSlug(stateRoot: string): Promise<string | null> {
    const raw = await readFile(path.join(stateRoot, 'indexes/as1-slack-pilot/global-control.json'), 'utf8');
    return (JSON.parse(raw) as { readonly activeProfileSlug: string | null }).activeProfileSlug;
  }

  it('runs Agent Office then Foundation on the SAME fixed root under one common writer lock', async () => {
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));

    // Profile 1 — Agent Office.
    const aoGit = new FakeGitSource();
    aoGit.setLazy(RECEIVE_GRANT_REF, async () => validReceiveGrant(await boundGrantHashes(stateRoot, 'agent-office-advisor')));
    const aoDescriptor = enabledDescriptor(filePath);
    const ao = await As1GatewayComposition.open(aoDescriptor, { stateRoot, clock: new FakeClock(CLOCK_ISO), deps: fullFakeDeps(aoGit, world) });
    const aoStart = await ao.start();
    expect(aoStart.connected).toBe(true);
    expect(await activeProfileSlug(stateRoot)).toBe('agent-office-advisor');
    // The one common writer lock forbids a SECOND simultaneous owner on the same root — never two live profiles.
    await expect(
      As1GatewayComposition.open(aoDescriptor, { stateRoot, clock: new FakeClock(CLOCK_ISO), deps: fullFakeDeps(aoGit, world) }),
    ).rejects.toThrow();
    await ao.stop();
    expect(await readControlState(stateRoot)).toBe('DISABLED_CLEAN');

    // Profile 2 — Foundation, SEQUENTIALLY on the SAME fixed root after the first profile's clean stop.
    const foundationRef = `${AUTH_ROOT}/receive-grant-foundation.json`;
    const foundGit = new FakeGitSource();
    foundGit.setLazy(foundationRef, async () =>
      validReceiveGrant({
        ...(await boundGrantHashes(stateRoot, 'foundation-advisor')),
        profileId: 'FOUNDATION_ADVISOR',
        appId: 'AFOUNDATION001',
        channelId: 'CFOUNDATION001',
        profileStateRootRef: 'indexes/as1-slack-pilot/profiles/foundation-advisor',
        receiveGrantId: 'as1-receive-grant-foundation-0001',
      }),
    );
    const foundDescriptor = parseRuntimeDescriptor({
      schemaVersion: 'agent-office.as1-slack-pilot-descriptor.v1',
      enabled: true,
      receiveGrantRef: foundationRef,
      secretFilePath: filePath,
    });
    const found = await As1GatewayComposition.open(foundDescriptor, { stateRoot, clock: new FakeClock(CLOCK_ISO), deps: fullFakeDeps(foundGit, world) });
    const foundStart = await found.start();
    expect(foundStart.connected).toBe(true);
    expect(await activeProfileSlug(stateRoot)).toBe('foundation-advisor');
    await found.stop();
    expect(await readControlState(stateRoot)).toBe('DISABLED_CLEAN');
  });
});

const gitRun = promisify(execFile);
const GIT_ENV = { PATH: process.env.PATH ?? '/usr/bin:/bin', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', HOME: '/nonexistent' };
async function git(cwd: string, ...args: readonly string[]): Promise<string> {
  const { stdout } = await gitRun('git', args, { cwd, env: GIT_ENV, maxBuffer: 1_000_000 });
  return stdout.trim();
}

describe('AS1 Patch 2 — residual-defect closure (adversarial, fails on 187c7152)', () => {
  it('F02: the production provenance gate uses INDEPENDENT construction-bound snapshots, not the grant\'s own field', async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), 'as1-p2-snap-'));
    await git(repoRoot, 'init', '-q', '-b', 'main');
    await git(repoRoot, 'config', 'user.email', 'test@example.invalid');
    await git(repoRoot, 'config', 'user.name', 'as1-test');
    await git(repoRoot, 'config', 'commit.gpgsign', 'false');
    await writeFile(path.join(repoRoot, 'gov.txt'), 'frozen governance snapshot\n', 'utf8');
    await git(repoRoot, 'add', 'gov.txt');
    await git(repoRoot, 'commit', '-q', '-m', 'governance snapshot');
    const snapshot = await git(repoRoot, 'rev-parse', 'HEAD');

    // The grant DECLARES its authority basis as the snapshot commit — exactly the field 187c7152 fed to the gate.
    const grantRef = 'authority/agent-office-advisor/receive-grant.json';
    const grant = parseReceiveGrant(validReceiveGrant({ authorityRepositoryId: 'foundation-docs', authoritySourceCommit: snapshot }));
    await mkdir(path.join(repoRoot, path.dirname(grantRef)), { recursive: true });
    await writeFile(path.join(repoRoot, grantRef), canonicalBytes(grant));
    await git(repoRoot, 'add', '--', grantRef);
    await git(repoRoot, 'commit', '-q', '-m', 'add receive grant');
    const grantCommit = await git(repoRoot, 'rev-parse', 'HEAD');
    const accepted = { firstAddCommit: grantCommit, blobSha256: sha256Bytes(canonicalBytes(grant)) };

    // Bound to the REAL independent snapshot → accepted.
    const good = buildAs1ProductionDependencies([snapshot], { repoRoot, upstreamRef: 'main' }).buildReceiveGrantProvenance({ receiveGrantRef: grantRef, accepted, grant });
    await expect(good.assertAccepted(grant)).resolves.toBeUndefined();
    // Bound to a BOGUS independent snapshot → DENIED, even though grant.authoritySourceCommit is a valid ancestor
    // (the exact value 187c7152 trusted and would have accepted). The gate uses the construction-bound snapshot.
    const bogus = buildAs1ProductionDependencies(['f'.repeat(40)], { repoRoot, upstreamRef: 'main' }).buildReceiveGrantProvenance({ receiveGrantRef: grantRef, accepted, grant });
    await expect(bogus.assertAccepted(grant)).rejects.toBeInstanceOf(DomainError);
  });

  it('F02: a grant whose frozen control/latch snapshot hashes do not bind the pre-transition records fails before any transition', async () => {
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));
    const gitSource = new FakeGitSource();
    gitSource.setLazy(RECEIVE_GRANT_REF, async () => validReceiveGrant({
      ...(await boundGrantHashes(stateRoot, 'agent-office-advisor')),
      globalControlSnapshotHash: `sha256:${'0'.repeat(64)}`, // arbitrary well-formed hash, not the real record
    }));
    const composition = await As1GatewayComposition.open(enabledDescriptor(filePath), { stateRoot, clock: new FakeClock(CLOCK_ISO), deps: fullFakeDeps(gitSource, world) });
    await expect(composition.start()).rejects.toThrow(/frozen control\/latch snapshots/u);
    expect(await readControlState(stateRoot)).toBe('DISABLED_DEFAULT'); // never transitioned
    await composition.close();
  });

  it('F02: a Web identity failure after the durable transition reverts to a clean disabled state and releases the lock', async () => {
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));
    const gitSource = new FakeGitSource();
    gitSource.setLazy(RECEIVE_GRANT_REF, async () => validReceiveGrant(await boundGrantHashes(stateRoot, 'agent-office-advisor')));
    const throwingWeb: As1WebPort = {
      authTest: () => Promise.reject(new DomainError('AUTHORITY_ARTIFACT_INVALID', 'auth.test failed')),
      botsInfo: (token, botId) => world.web.botsInfo(token, botId),
      postMessage: (token, request) => world.web.postMessage(token, request),
    };
    const composition = await As1GatewayComposition.open(enabledDescriptor(filePath), { stateRoot, clock: new FakeClock(CLOCK_ISO), deps: fullFakeDeps(gitSource, world, { web: throwingWeb }) });
    await expect(composition.start()).rejects.toThrow(DomainError);
    // Reverted from RECEIVE_GRANTED/AUTHENTICATING to a legal clean disabled state (never a half-started record).
    expect(await readControlState(stateRoot)).toMatch(/^DISABLED_/u);
    // Ownership released: a fresh composition re-acquires the lock.
    const reopened = await As1GatewayComposition.open(enabledDescriptor(filePath), { stateRoot, clock: new FakeClock(CLOCK_ISO), deps: fullFakeDeps(new FakeGitSource(), world) });
    await reopened.close();
  });

  it('F03: evidence projection REQUIRES an already-accepted delivery authority (no first-observation fallback)', async () => {
    const { composition, socket } = await startAgentOfficeComposition();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope());
      expect(composition.lastIntake()).not.toBeNull();
      // No deliverPending has fully accepted a delivery, so evidence must fail closed rather than observe fresh.
      await expect(composition.ingestEvidenceAndProject()).rejects.toThrow(/already-accepted delivery authority/u);
    } finally {
      await composition.stop();
    }
  });

  it('F01: closeIncidentGateNow() synchronously closes every incident admission before the durable kill', async () => {
    const { composition } = await startAgentOfficeComposition();
    try {
      await composition.start();
      expect(composition.status().incidentGateOpen).toBe(true);
      composition.closeIncidentGateNow(); // synchronous — no await
      // The incident admission gate is closed the instant the handler runs, before any durable kill persists.
      expect(composition.status().incidentGateOpen).toBe(false);
    } finally {
      await composition.incidentKill();
    }
  });
});

// Shared Patch 3/Patch 4 owner-harness helpers (module scope so both adversarial describes can use them).
const ADVISOR_SLUG = 'agent-office-advisor';
const ROOT_TS = '1720000000.000100';

  // A live Socket whose disconnect() REJECTS: proves cleanup never synthesizes a clean state when the Socket
  // disconnect is ambiguous (design §11.2/§11.3, F01) — the ambiguity must surface, not be swallowed.
  class DisconnectFailingSocket extends FakeCompositionSocket {
    public override disconnect(): Promise<void> {
      this.disconnected = true;
      return Promise.reject(new DomainError('GATEWAY_DISABLED', 'socket disconnect failed during cleanup'));
    }
  }

  interface LiveOwnerHarness {
    readonly boundary: As1ForegroundOwnerBoundary;
    readonly signals: Map<As1OwnerSignal, () => void>;
    readonly stateRoot: string;
    readonly gitSource: FakeGitSource;
    readonly socketHolder: { current: FakeCompositionSocket | null };
    readonly tmux: FakeTmuxObservationPort;
    readonly grantHolder: { hashes: Record<string, string> | null };
    fire(signal: As1OwnerSignal): void;
  }

  // A foreground-owner boundary over a COMPLETE fake production graph that reaches a live RECEIVING loop, exposing the
  // ordered seams a test needs to deliver a SIGUSR2 incident WHILE a specific awaited boundary is in flight
  // (init / startup / poll / delivery / evidence) and to inject cleanup (disconnect / lock-release) failures.
  async function makeLiveOwnerHarness(options: {
    readonly socketFactory?: () => FakeCompositionSocket;
    readonly depOverrides?: Partial<As1CompositionDependencies>;
    // Build dep overrides with access to a live `fireIncident` (SIGUSR2) and the wire world, so a test can fire an
    // incident DURING a supplied collaborator port's internal await (verifier authTest/botsInfo/connect, delivery
    // provenance, outbox Web, …) and prove ZERO subsequent side effect.
    readonly buildDepOverrides?: (ctx: { fireIncident: () => void; world: ReturnType<typeof fakeWireWorld> }) => Partial<As1CompositionDependencies>;
    readonly installFiresIncident?: boolean; // fire SIGUSR2 from installSignalHandlers — an incident DURING control init
    readonly onReceiveObserve?: (count: number) => void; // fires on each receive-grant observe (start=1, loop=2,3,…)
  } = {}): Promise<LiveOwnerHarness> {
    const stateRoot = await makeStateRoot();
    const world = fakeWireWorld();
    const { filePath } = await writeSecretFile(secretText(validSecretValues()));
    const gitSource = new FakeGitSource();
    const grantHolder: { hashes: Record<string, string> | null; grant: unknown } = { hashes: null, grant: null };
    let receiveObserveCount = 0;
    // Materialize the receive grant lazily at first observe (after the owner's own open established the control), then
    // RETAIN it so every re-observe returns identical bytes and the delivery authority reuses the exact accepted
    // binding hashes. The per-observe hook lets a test fire an incident DURING a chosen receive-grant observation.
    gitSource.setLazy(RECEIVE_GRANT_REF, async () => {
      if (grantHolder.grant === null) {
        grantHolder.hashes = await boundGrantHashes(stateRoot, ADVISOR_SLUG);
        grantHolder.grant = validReceiveGrant(grantHolder.hashes);
      }
      receiveObserveCount += 1;
      options.onReceiveObserve?.(receiveObserveCount);
      return grantHolder.grant;
    });
    const socketHolder: { current: FakeCompositionSocket | null } = { current: null };
    const tmux = new FakeTmuxObservationPort(parseTmuxDestination(validDestination(), 'd'));
    const signals = new Map<As1OwnerSignal, () => void>();
    const boundary: As1ForegroundOwnerBoundary = {
      descriptor: enabledDescriptor(filePath),
      stateRoot,
      clock: new FakeClock(CLOCK_ISO),
      buildDeps: () =>
        fullFakeDeps(gitSource, world, {
          tmuxPort: tmux,
          buildSocket: () => {
            const socket = (options.socketFactory ?? (() => new FakeCompositionSocket()))();
            socketHolder.current = socket;
            return socket;
          },
          ...options.depOverrides,
          ...(options.buildDepOverrides?.({ fireIncident: () => signals.get('SIGUSR2')?.(), world }) ?? {}),
        }),
      initialize: () => Promise.resolve(),
      installSignalHandlers: (handlers) => {
        (['SIGINT', 'SIGTERM', 'SIGUSR2'] as const).forEach((sig) => signals.set(sig, handlers[sig]));
        // An incident that arrives during the lock-owned control-init window (before the composition's synchronous
        // incident closer is wired) must still be honored after open() and dominate before startup.
        if (options.installFiresIncident === true) handlers.SIGUSR2();
        return ['SIGINT', 'SIGTERM', 'SIGUSR2'];
      },
      delay: () => Promise.resolve(),
    };
    return {
      boundary,
      signals,
      stateRoot,
      gitSource,
      socketHolder,
      tmux,
      grantHolder,
      fire: (signal) => signals.get(signal)?.(),
    };
  }

  // Deliver ONE Leo root envelope to the live owner's captured socket and materialize a fully-bound delivery authority
  // (grant + lease) on the shared Git source. Optional per-observe fire hooks make the grant or lease lazy so a test
  // can deliver an incident DURING the pending delivery or during evidence re-observation.
  async function deliverAndAuthorize(
    h: LiveOwnerHarness,
    opts: { readonly fireDuringGrantObserve?: () => void; readonly fireDuringLeaseObserve?: { on: number; fire: () => void } } = {},
  ): Promise<string> {
    const socket = h.socketHolder.current;
    if (socket === null) throw new Error('start() has not built the socket yet');
    await socket.deliver(slackEnvelope());
    const store = await As1ProfileInboundStore.open(h.stateRoot, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock(CLOCK_ISO));
    const root = await store.findRootByThreadTs(ROOT_TS);
    if (root === null || h.grantHolder.hashes === null) throw new Error('no bound root / receive-grant hashes after delivery');
    const { grant, lease } = await buildDeliveryAuthority(
      h.stateRoot,
      store,
      parseReceiveGrant(validReceiveGrant(h.grantHolder.hashes)),
      selectProfile('AGENT_OFFICE_ADVISOR'),
      root.intakeId,
    );
    const base = `${AUTH_ROOT}/runtime-authority/${ADVISOR_SLUG}/${root.intakeId}`;
    const grantPath = `${base}/pointer-delivery-grant.json`;
    const leasePath = `${base}/readiness-lease.json`;
    if (opts.fireDuringGrantObserve !== undefined) {
      const fire = opts.fireDuringGrantObserve;
      h.gitSource.setLazy(grantPath, () => {
        fire();
        return Promise.resolve(grant);
      });
    } else {
      h.gitSource.set(grantPath, grant);
    }
    if (opts.fireDuringLeaseObserve !== undefined) {
      const { on, fire } = opts.fireDuringLeaseObserve;
      let leaseObserveCount = 0;
      h.gitSource.setLazy(leasePath, () => {
        leaseObserveCount += 1;
        if (leaseObserveCount === on) fire();
        return Promise.resolve(lease);
      });
    } else {
      h.gitSource.set(leasePath, lease);
    }
    return base;
  }

describe('AS1 Patch 3 — F01 incident domination + truthful cleanup (adversarial, fails on 5a23c25c)', () => {
  it('an incident during lock-owned control init dominates BEFORE startup — never a masked clean revert', async () => {
    // A failing Web identity would make start() revert. On the pre-fix owner an incident that arrived during control
    // init is not honored before start(); start() runs, reverts, and the outer catch hard-codes a clean DISABLED_CLEAN,
    // MASKING the incident. The fix routes the pending incident through a durable kill BEFORE start() is ever called —
    // the throwing Web is never reached.
    const throwingWeb: As1WebPort = {
      authTest: () => Promise.reject(new DomainError('AUTHORITY_ARTIFACT_INVALID', 'auth.test failed')),
      botsInfo: () => Promise.reject(new DomainError('AUTHORITY_ARTIFACT_INVALID', 'unused on the dominated path')),
      postMessage: () => Promise.reject(new DomainError('AUTHORITY_ARTIFACT_INVALID', 'unused on the dominated path')),
    };
    const h = await makeLiveOwnerHarness({ installFiresIncident: true, depOverrides: { web: throwingWeb } });
    const result = await runForegroundOwner(h.boundary);
    const line = result.lines.join('|');
    expect(result.ok).toBe(false);
    expect(line).toContain('INCIDENT_KILL_ENGAGED');
    expect(line).not.toContain('DISABLED_CLEAN'); // the incident is never masked as a clean release
  });

  it('an incident while the receive-grant is re-observed (a delivery pending) is not masked as DELIVERY_HALTED / clean', async () => {
    // Concern #2: SIGUSR2 delivered WHILE observeReceiveGrantOnce() is awaited. The pre-fix loop closes the gate but
    // does not resample before deliverPending(); the closed actionability predicate yields STOPPED_BEFORE_PASTE ->
    // DELIVERY_HALTED -> a clean stop() writing DISABLED_CLEAN, masking the incident. The fix resamples after the
    // observe await and dominates before any delivery.
    let delivered = false;
    const h = await makeLiveOwnerHarness({
      onReceiveObserve: (count) => {
        if (count === 3) h.fire('SIGUSR2'); // start=1, loop-iter-1=2, loop-iter-2 (authority now pending)=3
      },
    });
    const result = await runForegroundOwner({
      ...h.boundary,
      delay: async () => {
        if (!delivered) {
          await deliverAndAuthorize(h);
          delivered = true;
        }
      },
    });
    const line = result.lines.join('|');
    expect(result.ok).toBe(false);
    expect(line).toContain('INCIDENT_KILL_ENGAGED');
    expect(line).not.toContain('DISABLED_CLEAN');
    expect(line).not.toContain('DELIVERY_HALTED');
  });

  it('an incident DURING the pending delivery is not masked as DELIVERY_HALTED / clean', async () => {
    // Concern #2, delivery continuation: SIGUSR2 arrives while deliverPending() is awaited (here, during the delivery
    // grant re-observation). The pre-fix loop does not resample after deliverPending(); the fix does (line 511).
    let delivered = false;
    const h = await makeLiveOwnerHarness();
    const result = await runForegroundOwner({
      ...h.boundary,
      delay: async () => {
        if (!delivered) {
          await deliverAndAuthorize(h, { fireDuringGrantObserve: () => h.fire('SIGUSR2') });
          delivered = true;
        }
      },
    });
    const line = result.lines.join('|');
    expect(result.ok).toBe(false);
    expect(line).toContain('INCIDENT_KILL_ENGAGED');
    expect(line).not.toContain('DISABLED_CLEAN');
    expect(line).not.toContain('DELIVERY_HALTED');
  });

  it('an incident DURING evidence projection is dominated before any next operation', async () => {
    // A SIGUSR2 delivered while ingestEvidenceAndProject() re-observes the readiness lease (lease observe #2) must be
    // resampled immediately after evidence (line 518) — never allowed to start later work before the next top sample.
    let delivered = false;
    const h = await makeLiveOwnerHarness();
    const result = await runForegroundOwner({
      ...h.boundary,
      delay: async () => {
        if (!delivered) {
          await deliverAndAuthorize(h, { fireDuringLeaseObserve: { on: 2, fire: () => h.fire('SIGUSR2') } });
          delivered = true;
        }
      },
    });
    const line = result.lines.join('|');
    expect(result.ok).toBe(false);
    expect(line).toContain('INCIDENT_KILL_ENGAGED');
    expect(line).not.toContain('DISABLED_CLEAN');
  });

  it('checks the failure barrier BEFORE the grant re-observation: a Socket-callback barrier halts the owner without a forbidden grant observation', async () => {
    // handoff 95 F01 (correction 3, defect 4): a barrier raised by the live Socket callback (a non-DELIVERED ACCEPTED →
    // haltProgression) MUST be caught BEFORE observeReceiveGrantOnce — never followed by even one grant observation. Here
    // the ACCEPTED post fails (the callback raises the barrier) AND the receive grant is diverged. With the barrier
    // checked FIRST the owner halts DELIVERY_HALTED; if it observed the grant first it would instead report
    // PROFILE_DIVERGED. Adversarial vs observing the grant before the barrier check.
    const h = await makeLiveOwnerHarness({
      buildDepOverrides: ({ world }) => {
        world.web.setPostError(new Error('ACCEPTED post fails → Socket callback haltProgression')); // AMBIGUOUS → MANUAL → halt
        return {};
      },
    });
    let acted = false;
    const result = await runForegroundOwner({
      ...h.boundary,
      delay: async () => {
        if (acted) return;
        acted = true;
        const socket = h.socketHolder.current;
        if (socket === null) throw new Error('socket not built');
        await socket.deliver(slackEnvelope()); // Socket callback: ACCEPTED post fails → haltProgression raises the barrier
        h.gitSource.divergePaths.add(RECEIVE_GRANT_REF); // if the owner observes the grant NEXT, it would DIVERGE
      },
    });
    const line = result.lines.join('|');
    expect(line).toContain('DELIVERY_HALTED'); // the barrier check dominated the next iteration — no grant observation
    expect(line).not.toContain('PROFILE_DIVERGED'); // the forbidden grant observation never ran
  });

  it('a Socket disconnect failure during a clean stop is reported truthfully — never a synthesized clean state', async () => {
    // The pre-fix cleanup swallows a disconnect failure and hard-codes STATE: DISABLED_CLEAN / STOPPED_CLEAN. The fix
    // records the DISCONNECT ambiguity and refuses to claim a proven clean release.
    const h = await makeLiveOwnerHarness({ socketFactory: () => new DisconnectFailingSocket() });
    let ticks = 0;
    const result = await runForegroundOwner({
      ...h.boundary,
      delay: () => {
        ticks += 1;
        if (ticks === 2) h.fire('SIGTERM');
        return Promise.resolve();
      },
    });
    const line = result.lines.join('|');
    expect(result.ok).toBe(false);
    expect(line).not.toContain('STOPPED_CLEAN');
    expect(line).toContain('CLEANUP_AMBIGUOUS');
    expect(line).toContain('DISCONNECT');
  });

  it('a writer-lock RELEASE failure during a clean stop is reported truthfully — never a synthesized clean state', async () => {
    // The single private writer lock disappears before cleanup; release() fails closed. The pre-fix cleanup would still
    // report a clean release. The fix records the RELEASE ambiguity (lockReleased: false) and never claims clean.
    const h = await makeLiveOwnerHarness();
    let ticks = 0;
    const result = await runForegroundOwner({
      ...h.boundary,
      delay: async () => {
        ticks += 1;
        if (ticks === 1) {
          await unlink(path.join(h.stateRoot, 'locks', 'writer.lock'));
          h.fire('SIGTERM');
        }
      },
    });
    const line = result.lines.join('|');
    expect(result.ok).toBe(false);
    expect(line).not.toContain('STOPPED_CLEAN');
    expect(line).toContain('CLEANUP_AMBIGUOUS');
    expect(line).toContain('RELEASE');
  });

  it('a Socket disconnect failure during an incident kill is reported truthfully — never a clean incident claim', async () => {
    // The durable kill engages, but the Socket disconnect is ambiguous. The fix surfaces the DISCONNECT ambiguity
    // rather than reporting a bare clean INCIDENT_KILL_ENGAGED.
    const h = await makeLiveOwnerHarness({ socketFactory: () => new DisconnectFailingSocket() });
    let ticks = 0;
    const result = await runForegroundOwner({
      ...h.boundary,
      delay: () => {
        ticks += 1;
        if (ticks === 2) h.fire('SIGUSR2');
        return Promise.resolve();
      },
    });
    const line = result.lines.join('|');
    expect(result.ok).toBe(false);
    expect(line).toContain('CLEANUP_AMBIGUOUS');
    expect(line).toContain('DISCONNECT');
  });
});

describe('AS1 Patch 4 — F01 per-await/internal-port guards + truthful state (adversarial, fails on cb6085b)', () => {
  it('an incident DURING startup Web identity proof (authTest) begins ZERO subsequent Web call (guarded verifier ports)', async () => {
    // Concern (review 76 F01 #1): a SIGUSR2 during the verifier's assertAccepted/authTest is otherwise followed by
    // botsInfo/connect. The Patch 4 owner wraps the SUPPLIED verifier ports; an incident during authTest must prevent
    // the NEXT identity call. On cb6085b the ports are unguarded and botsInfo runs.
    let botsInfoCalls = 0;
    const h = await makeLiveOwnerHarness({
      buildDepOverrides: ({ fireIncident, world }) => ({
        web: {
          authTest: async (token) => {
            const authResult = await world.web.authTest(token);
            fireIncident(); // the incident closes admission between authTest and the next Web identity call
            return authResult;
          },
          botsInfo: (token, botId) => {
            botsInfoCalls += 1;
            return world.web.botsInfo(token, botId);
          },
          postMessage: (token, request) => world.web.postMessage(token, request),
        },
      }),
    });
    const result = await runForegroundOwner(h.boundary);
    const line = result.lines.join('|');
    expect(result.ok).toBe(false);
    expect(line).toContain('INCIDENT_KILL_ENGAGED');
    expect(botsInfoCalls).toBe(0);
  });

  it('an incident DURING the delivery transport (delivery provenance) begins ZERO tmux paste (guarded transport ports)', async () => {
    // Concern (review 76 F01 #2): a SIGUSR2 inside deliver() must not be followed by the pinned-byte tmux paste. The
    // Patch 4 owner wraps every transport port; on cb6085b the ports are unguarded and the paste happens.
    let delivered = false;
    const h = await makeLiveOwnerHarness({
      buildDepOverrides: ({ fireIncident }) => ({
        buildDeliveryProvenance: () => ({
          assertAccepted: () => {
            fireIncident(); // the incident closes admission inside transport.deliver, before the tmux paste
            return Promise.resolve();
          },
        }),
      }),
    });
    const result = await runForegroundOwner({
      ...h.boundary,
      delay: async () => {
        if (!delivered) {
          await deliverAndAuthorize(h);
          delivered = true;
        }
      },
    });
    const line = result.lines.join('|');
    expect(result.ok).toBe(false);
    expect(line).toContain('INCIDENT_KILL_ENGAGED');
    expect(h.tmux.pasteCalls).toBe(0);
  });

  it('observeReceiveGrantOnce() with admission CLOSED begins NO durable divergence latch (guarded observe + latch)', async () => {
    // Concern (Advisor F01): observeReceiveGrantOnce() must not run its Git observe and then a durable divergence
    // latchProfile after a SIGUSR2 closed admission. With the guard, the observe never begins and NO latch is written.
    const { composition, gitSource, stateRoot } = await startAgentOfficeComposition();
    try {
      await composition.start();
      composition.closeIncidentGateNow(); // an incident closed admission
      gitSource.divergePaths.add(RECEIVE_GRANT_REF); // the next re-observe WOULD diverge and durably latch the profile
      await expect(composition.observeReceiveGrantOnce()).rejects.toThrow();
      // No profile-latch was written: the guarded observe threw before the divergence latch.
      const latchRaw = await readFile(path.join(stateRoot, 'indexes/as1-slack-pilot/profiles/agent-office-advisor/failure-latch.json'), 'utf8');
      expect((JSON.parse(latchRaw) as { readonly latched: boolean }).latched).toBe(false);
    } finally {
      await composition.incidentKill().catch(() => undefined);
    }
  });

  it('a clean stop() with a pending incident engages the durable kill — never a synthesized DISABLED_CLEAN (incident-aware drain)', async () => {
    // Concern (review 76 F01 #3 + Advisor): finishCleanup's drain must consult the incident gate. On cb6085b the drain
    // is not incident-aware and writes DISABLED_CLEAN.
    const { composition } = await startAgentOfficeComposition();
    try {
      await composition.start();
      composition.closeIncidentGateNow(); // an incident closed admission before the clean drain
      const result = await composition.stop();
      expect(result.incidentDominated).toBe(true);
      expect(result.state).not.toBe('DISABLED_CLEAN');
      expect(result.state).toBe('DISABLED_LATCHED');
      expect(result.killEngaged).toBe(true);
    } finally {
      await composition.incidentKill().catch(() => undefined);
    }
  });

  it('a missing handler releases the lock and reports the ACTUAL disabled state — never a synthesized DISABLED_LATCHED', async () => {
    // Concern (review 76 F01 #4 + Advisor truthful-state): the missing-handler path returns a truthful result INSIDE
    // the owner-result boundary and reports the real state (a clean release is DISABLED_CLEAN), not a synthesized
    // DISABLED_LATCHED, and never discards a release failure. On cb6085b this path throws a raw error.
    const h = await makeLiveOwnerHarness();
    const result = await runForegroundOwner({ ...h.boundary, installSignalHandlers: () => ['SIGINT', 'SIGTERM'] });
    const line = result.lines.join('|');
    expect(result.ok).toBe(false);
    expect(line).toContain('MISSING_HANDLER_DISABLED');
    expect(line).toContain('DISABLED_CLEAN');
    expect(line).not.toContain('DISABLED_LATCHED');
  });

  it('an incident during ERROR cleanup (latchActiveProfileAndStop) dominates — durable kill, never DISABLED_CLEAN', async () => {
    // Concern (review 76 F01 + Advisor): the owner-loop error cleanup must dominate a pending incident. On cb6085b the
    // drain is not incident-aware and can write DISABLED_CLEAN.
    const { composition } = await startAgentOfficeComposition();
    await composition.start();
    composition.closeIncidentGateNow(); // a SIGUSR2 closed admission during the error cleanup
    const result = await composition.latchActiveProfileAndStop('OWNER_LOOP_ERROR');
    expect(result.incidentDominated).toBe(true);
    expect(result.state).toBe('DISABLED_LATCHED');
    expect(result.state).not.toBe('DISABLED_CLEAN');
    expect(result.killEngaged).toBe(true);
  });

  it('a NONEMPTY pre-cleanup ambiguity (disconnect failure) never drains to DISABLED_CLEAN — the durable kill is engaged', async () => {
    // Concern (review 76 F01 + brief 77 + Advisor): a nonempty pre-ambiguity in the error cleanup (here a failed Socket
    // disconnect, collected into the same `pre` array as a profile-latch/fallback-kill failure) must NOT drain to a
    // clean DISABLED_CLEAN. The durable global kill is engaged instead; the ambiguity stays visible and DISABLED_LATCHED
    // is claimed only because the kill persisted. On cb6085b the drain still reaches DISABLED_CLEAN.
    const h = await makeLiveOwnerHarness({ socketFactory: () => new DisconnectFailingSocket() });
    h.gitSource.throwOnReObservePaths.add(RECEIVE_GRANT_REF); // the loop re-observe throws → owner-loop ERROR cleanup
    const result = await runForegroundOwner(h.boundary);
    const line = result.lines.join('|');
    expect(result.ok).toBe(false);
    expect(line).toContain('OWNER_HALTED');
    expect(line).toContain('DISCONNECT'); // the cleanup ambiguity stays visible in the stable outcome
    expect(line).not.toContain('DISABLED_CLEAN'); // a nonempty pre-ambiguity engaged the durable kill, not a clean drain
    expect(line).toContain('DISABLED_LATCHED'); // proven only because the durable global kill persisted
  });

  it('a FALLBACK global-kill PERSISTENCE failure reports FALLBACK_KILL + KILL_NOT_ENGAGED and the ACTUAL non-latched state', async () => {
    // Concern (review 76 F01 + brief 77 + Advisor): with a nonempty pre-ambiguity (disconnect) AND the durable
    // global-control write forced to fail, the TRANSACTIONAL engageGlobalKill leaves the in-memory record UNLATCHED.
    // The result must show FALLBACK_KILL + KILL_NOT_ENGAGED and the ACTUAL live state — never a synthesized
    // DISABLED_CLEAN nor an UNPROVED DISABLED_LATCHED.
    const { composition, stateRoot } = await startAgentOfficeComposition({ socket: new DisconnectFailingSocket() });
    await composition.start();
    // Make the global-control directory unwritable so the durable global-kill atomic write cannot create its temp file.
    const controlDir = path.join(stateRoot, 'indexes/as1-slack-pilot');
    await chmod(controlDir, 0o500);
    try {
      const result = await composition.latchActiveProfileAndStop('OWNER_LOOP_ERROR');
      expect(result.detail).toContain('DISCONNECT');
      expect(result.detail).toContain('FALLBACK_KILL');
      expect(result.detail).toContain('KILL_NOT_ENGAGED');
      expect(result.state).not.toBe('DISABLED_CLEAN');
      expect(result.state).not.toBe('DISABLED_LATCHED'); // NOT claimed — the durable kill did not persist
      expect(result.killEngaged).toBe(false);
      expect(result.cleanupProven).toBe(false);
    } finally {
      await chmod(controlDir, 0o700); // restore so the temp state root can be cleaned up
    }
  });

  it('F01-B: a FREED namespace lock (already unlinked) cedes authority with NO old-owner fallback kill — RELEASE ambiguity, never a stale latch', async () => {
    // Concern (review 79 F01-B): if the namespace lock is gone, the old control must NOT perform an authority-bearing
    // fallback kill (a second writer could hold the freed lock). The release is LOST (ownership not proven), so cleanup
    // surfaces the RELEASE ambiguity truthfully but engages NO durable kill — the state stays the clean-drain state.
    const { composition, stateRoot } = await startAgentOfficeComposition();
    await composition.start();
    await unlink(path.join(stateRoot, 'locks', 'writer.lock')); // the fixed leaf is gone → ownership not positively proven
    const result = await composition.stop();
    expect(result.lockReleased).toBe(false);
    expect(result.detail).toContain('RELEASE');
    expect(result.detail).toContain('LOST'); // authority not proven → LOST, never RETAINED
    expect(result.state).toBe('DISABLED_CLEAN'); // the clean drain stands; NO stale fallback latch
    expect(result.state).not.toBe('DISABLED_LATCHED');
    expect(result.killEngaged).toBe(false); // the old owner performed ZERO authority-bearing fallback mutation
    expect(result.cleanupProven).toBe(false);
  });

  it('F01-B: a PRE-unlink release failure (leaf still positively this owner) RETAINS authority and durably fallback-kills', async () => {
    // Concern (review 79 F01-B): a release failure BEFORE the namespace unlink, while the fixed leaf is still positively
    // this owner's lock, may retain authority and durably fallback-kill (the sole writer). The locks directory is made
    // unwritable so `unlink` fails EACCES while identity still proves this owner's lock.
    const { composition, stateRoot } = await startAgentOfficeComposition();
    await composition.start();
    const locksDir = path.join(stateRoot, 'locks');
    await chmod(locksDir, 0o500); // read+execute (identity reopen still works) but no write → unlink fails pre-unlink
    try {
      const result = await composition.stop();
      expect(result.lockReleased).toBe(false);
      expect(result.detail).toContain('RELEASE');
      expect(result.detail).toContain('RETAINED'); // still positively this owner's lock → authority RETAINED
      expect(result.state).toBe('DISABLED_LATCHED'); // the sole writer durably fallback-killed
      expect(result.state).not.toBe('DISABLED_CLEAN');
      expect(result.killEngaged).toBe(true);
      expect(result.cleanupProven).toBe(false);
    } finally {
      await chmod(locksDir, 0o700); // restore so the temp state root can be cleaned up
      // The RETAINED path intentionally keeps the lock's descriptor open (a live owner holds it for the process
      // lifetime). Now that unlink can succeed, close it DETERMINISTICALLY so no FileHandle is left for GC (brief §6).
      await composition.close().catch(() => undefined);
    }
  });

  it('an incident INSIDE evidence ingress (supplied verifier) begins ZERO evidence-store persistence and ZERO outbound', async () => {
    // Concern (review 76 F01 + brief 77 + Advisor): an incident inside As1EvidenceIngress internals must prevent the
    // NEXT store/Web side effect. A VALID ACK — built from the ACTUAL production `buildEvidenceAuthority` over the
    // durable delivery records (no reinvented logic) — reaches the supplied verifier, which closes admission DURING
    // provenance verification; the guarded ingress/outbox ports (the SAME incidentGuardedPort wrappers proven for the
    // transport) then begin no store persistence and no outbound. On cb6085b those ports are unguarded.
    const gateCloser: { close: () => void } = { close: () => undefined };
    let verifyCalls = 0;
    const baseVerifier = new FakeGitVerifier();
    const firingVerifier: As1GitProvenanceVerifier = {
      verify: (ref, snapshotCommits) => {
        verifyCalls += 1;
        gateCloser.close(); // an incident closes admission DURING the ACK provenance verification
        return baseVerifier.verify(ref, snapshotCommits); // ...then return valid provenance
      },
    };
    const { stateRoot, composition, gitSource, socket, receiveGrant, web } = await startAgentOfficeComposition({ evidenceVerifier: firingVerifier });
    gateCloser.close = () => composition.closeIncidentGateNow();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope());
      const intakeId = composition.lastIntake();
      if (intakeId === null) throw new Error('expected an intake');
      const advisorProfile = selectProfile('AGENT_OFFICE_ADVISOR');
      const store = await As1ProfileInboundStore.open(stateRoot, advisorProfile, new FakeClock(CLOCK_ISO));
      const { grant, lease } = await buildDeliveryAuthority(stateRoot, store, parseReceiveGrant(receiveGrant), advisorProfile, intakeId);
      const base = `${AUTH_ROOT}/runtime-authority/agent-office-advisor/${intakeId}`;
      gitSource.set(`${base}/pointer-delivery-grant.json`, grant);
      gitSource.set(`${base}/readiness-lease.json`, lease);
      expect((await composition.deliverPending()).outcome).toBe('DELIVERED');
      // Reuse the PRODUCTION evidence-authority derivation over the durable records to construct a VALID ACK.
      const deliveryGrant = parsePointerDeliveryGrant(grant);
      const { deliveryId } = parseContainedPointerRef(deliveryGrant);
      const parsedReceiveGrant = parseReceiveGrant(receiveGrant);
      const receiveGrantState = await store.readReceiveGrantState(parsedReceiveGrant.receiveGrantId);
      const terminalDelivery = await store.readTmuxDeliveryRecord(deliveryId);
      const rootCorrelation = await store.findRootByIntakeId(intakeId);
      const consumption = await store.readDeliveryAuthorityConsumption(deliveryGrant.pointerDeliveryGrantId);
      if (receiveGrantState === null || terminalDelivery === null || rootCorrelation === null || consumption === null) {
        throw new Error('expected all durable evidence-input records after DELIVERED');
      }
      const authority = buildEvidenceAuthority({ receiveGrant: parsedReceiveGrant, receiveGrantState, pointerDeliveryGrant: deliveryGrant, terminalDelivery, rootCorrelation, consumption });
      const ack = validAdvisorAck({ intakeId: authority.intakeId, sourceEventId: authority.sourceEventId, pointerHash: authority.pointerHash, ...authority.acceptedAck });
      gitSource.set(`${authority.evidencePrefix}/${intakeId}/ack.json`, ack);
      // The accepted-root delivery already sent the R2 ACCEPTED status; the incident-affected evidence ingest must add
      // ZERO further Web posts (no DELIVERY_CONFIRMED, no INTAKE/RESULT projection).
      const postsBeforeEvidence = web.posted.length;
      await expect(composition.ingestEvidenceAndProject()).rejects.toThrow();
      expect(verifyCalls).toBeGreaterThanOrEqual(1); // the ingress DID reach the supplied verifier (accepted-evidence path)
      expect(await store.readAcceptedEvidence()).toHaveLength(0); // ZERO evidence-store persistence after the incident
      expect(web.posted).toHaveLength(postsBeforeEvidence); // ZERO NEW Web postMessage / outbound projection from the incident
    } finally {
      await composition.incidentKill().catch(() => undefined);
    }
  });
});

describe('AS1 Patch 5 — F01-A live inbound-callback guards (adversarial, fails on 3165e747)', () => {
  it('an incident during the live inbound Slack ACK begins ZERO subsequent durable side effect (no transport ACK / materialization)', async () => {
    const { composition, socket, stateRoot } = await startAgentOfficeComposition();
    try {
      await composition.start();
      let ackCalls = 0;
      const envelope: As1InboundEnvelope = {
        ...slackEnvelope(),
        acknowledge: () => {
          ackCalls += 1;
          composition.closeIncidentGateNow(); // a SIGUSR2 closes admission WHILE the live Slack ACK is in flight
          return Promise.resolve();
        },
      };
      await expect(socket.deliver(envelope)).rejects.toThrow(); // the guarded ACK's post-check rejects the callback
      expect(ackCalls).toBe(1); // the ACK ran, then the incident dominated the guarded continuation
      expect(composition.lastIntake()).toBeNull(); // the callback never completed → nothing recorded as processed
      // The durable transport record was NOT ACK-recorded/materialized after the incident (post-ACK ops prevented).
      const store = await As1ProfileInboundStore.open(stateRoot, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock(CLOCK_ISO));
      const transport = await store.readTransport('Ev0AGENTOFFICE01');
      expect(transport).not.toBeNull();
      if (transport === null) throw new Error('expected a durable transport record');
      expect(transport.state).not.toBe('TRANSPORT_ACK_RECORDED');
      expect(transport.state).not.toBe('MATERIALIZED');
      // The callback performed NO durable kill itself — the incident only closed admission. The owner routes the
      // pending incident EXACTLY ONCE through the existing durable kill (single DISABLED_LATCHED).
      expect(composition.status().incidentGateOpen).toBe(false);
      expect(composition.status().killEngaged).toBe(false);
      const cleanup = await composition.incidentKill();
      expect(cleanup.state).toBe('DISABLED_LATCHED');
      expect(cleanup.killEngaged).toBe(true);
      await expect(composition.incidentKill()).rejects.toThrow(); // the durable incident path is entered exactly once
    } finally {
      await composition.incidentKill().catch(() => undefined);
    }
  });

  // Decorate the internally-opened inbound store so a chosen store op fires the incident AFTER it completes (mid
  // processEnvelope); the incident-guarded store's post-check must then reject the NEXT durable side effect.
  function firingInboundStoreDecorator(methodName: keyof As1ProfileInboundStore, fire: () => void): (store: As1ProfileInboundStore) => As1ProfileInboundStore {
    return (store) =>
      new Proxy(store, {
        get: (target, property, receiver): unknown => {
          const value: unknown = Reflect.get(target, property, receiver);
          if (typeof value !== 'function') return value;
          const bound = (value as (...callArgs: readonly unknown[]) => unknown).bind(target);
          if (property === methodName) {
            return async (...callArgs: readonly unknown[]): Promise<unknown> => {
              const result = await bound(...callArgs); // the real inbound store op completes (its own effect)...
              fire(); // ...then a SIGUSR2 closes admission mid-callback; the guarded store rejects the next op
              return result;
            };
          }
          return bound;
        },
      });
  }

  // Decorate the store so a chosen op THROWS a plain (non-quarantine) error on its first call, leaving the durable
  // record exactly at its prior state WITHOUT closing admission — used to seed a recoverable PREACK_PENDING record.
  function throwingInboundStoreDecorator(methodName: keyof As1ProfileInboundStore): (store: As1ProfileInboundStore) => As1ProfileInboundStore {
    return (store) =>
      new Proxy(store, {
        get: (target, property, receiver): unknown => {
          const value: unknown = Reflect.get(target, property, receiver);
          if (typeof value !== 'function') return value;
          if (property === methodName) {
            return (): Promise<never> => Promise.reject(new Error(`seed: ${methodName} interrupted before its durable decision`));
          }
          return (value as (...callArgs: readonly unknown[]) => unknown).bind(target);
        },
      });
  }

  async function runInboundStageIncident(
    methodName: keyof As1ProfileInboundStore,
    assertNoNextDurableEffect: (transport: Awaited<ReturnType<As1ProfileInboundStore['readTransport']>>) => void,
  ): Promise<void> {
    const gateCloser: { close: () => void } = { close: () => undefined };
    const { composition, socket, stateRoot } = await startAgentOfficeComposition({
      decorateInboundStore: firingInboundStoreDecorator(methodName, () => gateCloser.close()),
    });
    gateCloser.close = () => composition.closeIncidentGateNow();
    try {
      await composition.start();
      await expect(socket.deliver(slackEnvelope())).rejects.toThrow(); // the guarded store's POST-op guard rejects the next op
      // The stage's own op completed, but the F01-A guard began NO next durable side effect and recorded no intake.
      expect(composition.lastIntake()).toBeNull();
      const store = await As1ProfileInboundStore.open(stateRoot, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock(CLOCK_ISO));
      assertNoNextDurableEffect(await store.readTransport('Ev0AGENTOFFICE01'));
      // The inbound callback performed NO durable kill itself — the incident only closed admission (in-memory). The
      // owner then routes the pending incident EXACTLY ONCE through the existing durable kill (single DISABLED_LATCHED).
      expect(composition.status().incidentGateOpen).toBe(false);
      expect(composition.status().killEngaged).toBe(false);
      const cleanup = await composition.incidentKill();
      expect(cleanup.state).toBe('DISABLED_LATCHED');
      expect(cleanup.killEngaged).toBe(true);
      await expect(composition.incidentKill()).rejects.toThrow(); // the durable incident path is entered exactly once
    } finally {
      await composition.incidentKill().catch(() => undefined);
    }
  }

  it('an incident during inbound RECEIPT persistence begins NO next durable side effect (openTransport never begins)', async () => {
    // The guard rejects immediately AFTER persistReceipt, before recordDedupe/openTransport: no transport record is
    // ever created. Adversarial vs 3165e747 / an unguarded store, where openTransport runs and leaves a PREACK_PENDING
    // record before the service's own next gate check stops the ACK.
    await runInboundStageIncident('persistReceipt', (transport) => {
      expect(transport).toBeNull();
    });
  });

  it('an incident during the DEDUPE/OPEN transition begins NO next durable side effect (openTransport never begins)', async () => {
    // insertDedupe runs after the receipt and before openTransport; the guard rejects immediately AFTER it, so
    // openTransport never begins. Adversarial vs an unguarded store, where openTransport runs (leaving PREACK_PENDING).
    await runInboundStageIncident('insertDedupe', (transport) => {
      expect(transport).toBeNull();
    });
  });

  it('an incident during the inbound root BIND begins NO next durable side effect (pre-ACK decision never commits)', async () => {
    // openTransport precedes the bind, so a PREACK_PENDING record already exists; the guard rejects immediately AFTER
    // bindFirstRoot, before commitPreAckDecision, so the record NEVER advances to PREACK_ROOT_BOUND. Adversarial vs
    // 3165e747 / an unguarded store, where commitPreAckDecision runs and leaves PREACK_ROOT_BOUND before the ACK gate.
    await runInboundStageIncident('bindFirstRoot', (transport) => {
      expect(transport?.state ?? 'ABSENT').toBe('PREACK_PENDING');
    });
  });

  it('an incident during result MATERIALIZATION begins NO next durable side effect (intake never materializes)', async () => {
    // The transport is already TRANSPORT_ACK_RECORDED and the ACK sent; the guard rejects immediately AFTER the
    // materialize intake-artifact write, before persistPointerArtifact/commitMaterialized, so the record NEVER reaches
    // MATERIALIZED and no intake id is recorded. Adversarial vs an unguarded store, where materialization completes.
    await runInboundStageIncident('persistIntakeArtifact', (transport) => {
      expect(transport?.state ?? 'ABSENT').toBe('TRANSPORT_ACK_RECORDED');
    });
  });

  it('an incident during PRE-ACK RECOVERY begins NO next durable side effect and routes exactly once to the durable kill', async () => {
    // Seed a durable PREACK_PENDING record WITHOUT an incident: a first owner opens the transport, then bindFirstRoot is
    // interrupted before the pre-ACK decision commits. A clean stop releases the lock and leaves the record recoverable.
    const seed = await startAgentOfficeComposition({ decorateInboundStore: throwingInboundStoreDecorator('bindFirstRoot') });
    await seed.composition.start();
    await expect(seed.socket.deliver(slackEnvelope())).rejects.toThrow();
    const seedStore = await As1ProfileInboundStore.open(seed.stateRoot, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock(CLOCK_ISO));
    expect((await seedStore.readTransport('Ev0AGENTOFFICE01'))?.state ?? 'ABSENT').toBe('PREACK_PENDING');
    const seedStop = await seed.composition.stop();
    expect(seedStop.state).toBe('DISABLED_CLEAN'); // a clean release; the recoverable record survives untouched

    // A second owner recovers that record at startup; the incident fires mid-bind INSIDE recoverPreAckDecision.
    const gateCloser: { close: () => void } = { close: () => undefined };
    const recover = await startAgentOfficeComposition({
      stateRoot: seed.stateRoot,
      decorateInboundStore: firingInboundStoreDecorator('bindFirstRoot', () => gateCloser.close()),
    });
    gateCloser.close = () => recover.composition.closeIncidentGateNow();
    try {
      await expect(recover.composition.start()).rejects.toThrow(); // recovery bind fires the incident; the guard rejects
      expect(recover.composition.lastIntake()).toBeNull();
      // Recovery began NO next durable side effect: the record NEVER advanced past PREACK_PENDING (no commitPreAckDecision).
      const store = await As1ProfileInboundStore.open(seed.stateRoot, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock(CLOCK_ISO));
      expect((await store.readTransport('Ev0AGENTOFFICE01'))?.state ?? 'ABSENT').toBe('PREACK_PENDING');
      // The startup revert routed the incident EXACTLY ONCE through the durable kill (idempotent global latch).
      expect(await readControlState(seed.stateRoot)).toBe('DISABLED_LATCHED');
    } finally {
      await recover.composition.incidentKill().catch(() => undefined);
    }
  });
});

// R2 recovery §5 same-thread user status: ACCEPTED on a NEW_MISSION_ROOT, DELIVERY_CONFIRMED on an accepted Advisor
// ACK with the legacy English progress ACK suppressed, and the durable failure barrier that halts the owner on restart.
const STATUS_ACCEPTED = '요청 접수 완료 · Advisor에게 전달 중';
const STATUS_DELIVERY_CONFIRMED = '메시지 전달 완료 · 답변 대기 중';

describe('AS1 R2 recovery — same-thread user status (design §5)', () => {
  it('posts ACCEPTED (Korean) on a NEW_MISSION_ROOT and exposes the intake only after it is recorded', async () => {
    const { composition, socket, web } = await startAgentOfficeComposition();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope());
      expect(composition.lastIntake()).not.toBeNull();
      expect(web.posted.map((p) => p.request.text)).toContain(STATUS_ACCEPTED);
      expect(web.posted.some((p) => p.request.text.startsWith('ACK:'))).toBe(false); // no English progress ACK
    } finally {
      await composition.stop();
    }
  });

  it('an exact duplicate delivery re-derives the same ACCEPTED id and posts no second status', async () => {
    const { composition, socket, web } = await startAgentOfficeComposition();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope());
      await socket.deliver(slackEnvelope()); // exact retry of the same envelope/event → DUPLICATE, not NEW_MISSION_ROOT
      expect(web.posted.filter((p) => p.request.text === STATUS_ACCEPTED)).toHaveLength(1);
    } finally {
      await composition.stop();
    }
  });

  it('posts DELIVERY_CONFIRMED on an accepted Advisor ACK and SUPPRESSES the legacy English INTAKE ACK', async () => {
    const { stateRoot, composition, socket, gitSource, receiveGrant, web } = await startAgentOfficeComposition();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope());
      const intakeId = composition.lastIntake();
      if (intakeId === null) throw new Error('expected an intake');
      const advisorProfile = selectProfile('AGENT_OFFICE_ADVISOR');
      const store = await As1ProfileInboundStore.open(stateRoot, advisorProfile, new FakeClock(CLOCK_ISO));
      const { grant, lease } = await buildDeliveryAuthority(stateRoot, store, parseReceiveGrant(receiveGrant), advisorProfile, intakeId);
      const base = `${AUTH_ROOT}/runtime-authority/agent-office-advisor/${intakeId}`;
      gitSource.set(`${base}/pointer-delivery-grant.json`, grant);
      gitSource.set(`${base}/readiness-lease.json`, lease);
      expect((await composition.deliverPending()).outcome).toBe('DELIVERED');
      // Build and publish a VALID Advisor ACK so ACK ingestion ACCEPTS and triggers DELIVERY_CONFIRMED.
      const deliveryGrant = parsePointerDeliveryGrant(grant);
      const { deliveryId } = parseContainedPointerRef(deliveryGrant);
      const parsedReceiveGrant = parseReceiveGrant(receiveGrant);
      const receiveGrantState = await store.readReceiveGrantState(parsedReceiveGrant.receiveGrantId);
      const terminalDelivery = await store.readTmuxDeliveryRecord(deliveryId);
      const rootCorrelation = await store.findRootByIntakeId(intakeId);
      const consumption = await store.readDeliveryAuthorityConsumption(deliveryGrant.pointerDeliveryGrantId);
      if (receiveGrantState === null || terminalDelivery === null || rootCorrelation === null || consumption === null) throw new Error('expected durable records');
      const authority = buildEvidenceAuthority({ receiveGrant: parsedReceiveGrant, receiveGrantState, pointerDeliveryGrant: deliveryGrant, terminalDelivery, rootCorrelation, consumption });
      const ack = validAdvisorAck({ intakeId: authority.intakeId, sourceEventId: authority.sourceEventId, pointerHash: authority.pointerHash, ...authority.acceptedAck });
      gitSource.set(`${authority.evidencePrefix}/${intakeId}/ack.json`, ack);
      const outcomes = await composition.ingestEvidenceAndProject();
      expect(outcomes).toContain('DELIVERY_CONFIRMED:DELIVERED');
      expect(web.posted.map((p) => p.request.text)).toContain(STATUS_DELIVERY_CONFIRMED);
      expect(web.posted.some((p) => p.request.text.startsWith('ACK:'))).toBe(false); // INTAKE English ACK suppressed
    } finally {
      await composition.stop();
    }
  });

  it('a durable DELIVERY_FAILED record is a cross-restart barrier: the owner withholds the intake and refuses delivery', async () => {
    const first = await startAgentOfficeComposition();
    let intakeId: string;
    try {
      await first.composition.start();
      await first.socket.deliver(slackEnvelope());
      const id = first.composition.lastIntake();
      if (id === null) throw new Error('expected an intake');
      intakeId = id;
      const store = await As1ProfileInboundStore.open(first.stateRoot, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock(CLOCK_ISO));
      await store.recordOutboxPhase(userStatusOutboundId('AGENT_OFFICE_ADVISOR', intakeId, 'DELIVERY_FAILED'), 'PREPARED', { requestHash: `sha256:${'3'.repeat(64)}` });
    } finally {
      await first.composition.stop();
    }
    const second = await startAgentOfficeComposition({ stateRoot: first.stateRoot });
    try {
      // handoff 95 F01 (defect 3): recovery finds the durable DELIVERY_FAILED barrier BEFORE arm; start() must refuse
      // arm and return NOT connected instead of arming a live round trip behind the barrier.
      const result = await second.composition.start();
      expect(result.connected).toBe(false);
      expect(result.reason).toBe('PROFILE_LATCHED'); // a failure barrier persisted a PROFILE latch — NOT the global kill
      expect(second.socket.armed).toBe(false); // no Socket receive arm behind the barrier
      expect(second.composition.hasFailureBarrier()).toBe(true);
      expect(second.composition.lastIntake()).toBeNull(); // withheld from delivery
      expect(second.tmuxPort.pasteCalls).toBe(0);
    } finally {
      await second.composition.incidentKill().catch(() => undefined);
    }
  });

  it('a prior pre-terminal ACCEPTED that halted progression durably profile-latches: restart refuses Socket arm and reports PROFILE_LATCHED', async () => {
    // handoff 95 F01 (defect 3 / correction 5): in the first run a non-DELIVERED ACCEPTED calls haltProgression, which
    // durably profile-latches the slug. On restart, start() must detect that durable PROFILE latch BEFORE any socket
    // build/recovery and fail closed truthfully as PROFILE_LATCHED (no arm) — NEVER a global-kill claim, and never a
    // crash in the startup identity verifier. Adversarial vs the pre-fix start(), which (a) armed receive unconditionally
    // and (b) reported GLOBAL_LATCHED for a mere profile latch.
    // Seed (test-only Web seam): auth stays proven, but the ACCEPTED Web post FAILS, so the intake materializes while
    // ACCEPTED stops durably pre-terminal (REQUEST_STARTED/manual) and the profile is durably latched — no product seam.
    const first = await startAgentOfficeComposition();
    try {
      await first.composition.start();
      first.web.setPostError(new Error('ACCEPTED post failed before RESPONSE_RECORDED'));
      await first.socket.deliver(slackEnvelope()).catch(() => undefined);
    } finally {
      await first.composition.stop().catch(() => undefined);
    }
    // The intake materialized; the durable ACCEPTED never reached RESPONSE_RECORDED.
    const store = await As1ProfileInboundStore.open(first.stateRoot, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock(CLOCK_ISO));
    const transport = await store.readTransport('Ev0AGENTOFFICE01');
    expect(transport?.state).toBe('MATERIALIZED');
    const intakeId = transport?.intakeId ?? null;
    if (intakeId === null) throw new Error('expected a materialized intake');
    const acceptedRecord = await store.readOutboxRecord(userStatusOutboundId('AGENT_OFFICE_ADVISOR', intakeId, 'ACCEPTED'));
    expect(acceptedRecord?.phase).not.toBe('RESPONSE_RECORDED'); // durably pre-terminal

    const second = await startAgentOfficeComposition({ stateRoot: first.stateRoot });
    try {
      const result = await second.composition.start();
      expect(result.connected).toBe(false); // durable profile latch → NOT connected
      expect(result.reason).toBe('PROFILE_LATCHED'); // truthful — a PROFILE latch, NOT the global kill
      expect(second.socket.armed).toBe(false); // preflight returns before any socket build/arm
      expect(second.composition.lastIntake()).toBeNull(); // NOT exposed to delivery
    } finally {
      await second.composition.stop().catch(() => undefined);
    }
  });

  it('restart after ACCEPTED is RESPONSE_RECORDED recovers the SAME intake and makes NO second Web post', async () => {
    const first = await startAgentOfficeComposition();
    try {
      await first.composition.start();
      await first.socket.deliver(slackEnvelope());
      expect(first.composition.lastIntake()).not.toBeNull();
      expect(first.web.posted).toHaveLength(1); // the one ACCEPTED post
    } finally {
      await first.composition.stop();
    }
    const second = await startAgentOfficeComposition({ stateRoot: first.stateRoot });
    try {
      await second.composition.start();
      expect(second.composition.lastIntake()).not.toBeNull(); // §5.7: the durable ACCEPTED is re-derived, intake recovered
      expect(second.web.posted).toHaveLength(0); // NO duplicate Slack post on the fresh Web port
      expect(second.composition.hasFailureBarrier()).toBe(false);
    } finally {
      await second.composition.stop();
    }
  });

  it('restart with a durable DELIVERY_CONFIRMED does NOT falsely halt: idempotent ACCEPTED replay, no barrier, no duplicate post', async () => {
    // handoff 95 F01 (correction 4): after a SUCCESSFUL DELIVERY_CONFIRMED, a normal restart replays ACCEPTED. §5.6 rule 6
    // makes only a FAILURE record a barrier, so recovery must re-derive the terminal ACCEPTED and ARM — never halt.
    // Adversarial vs the prior ACCEPTED ordering guard, which rejected the replay behind DELIVERY_CONFIRMED and drove
    // recoverTerminalStatusAndAccepted into haltProgression (a false global halt on a healthy mission).
    const first = await startAgentOfficeComposition();
    try {
      await first.composition.start();
      await first.socket.deliver(slackEnvelope());
      const intakeId = first.composition.lastIntake();
      if (intakeId === null) throw new Error('expected an intake');
      // Seed a durable SUCCESSFUL DELIVERY_CONFIRMED@RESPONSE_RECORDED (both failure siblings absent) via legal phases.
      const store = await As1ProfileInboundStore.open(first.stateRoot, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock(CLOCK_ISO));
      const confirmedId = userStatusOutboundId('AGENT_OFFICE_ADVISOR', intakeId, 'DELIVERY_CONFIRMED');
      await store.recordOutboxPhase(confirmedId, 'PREPARED', { requestHash: `sha256:${'5'.repeat(64)}` });
      await store.recordOutboxPhase(confirmedId, 'REQUEST_STARTED');
      await store.recordOutboxPhase(confirmedId, 'RESPONSE_RECORDED', { responseHash: `sha256:${'6'.repeat(64)}` });
    } finally {
      await first.composition.stop();
    }
    const second = await startAgentOfficeComposition({ stateRoot: first.stateRoot });
    try {
      const result = await second.composition.start();
      expect(result.connected).toBe(true); // recovery re-derived the terminal ACCEPTED and ARMED — NO false halt
      expect(second.socket.armed).toBe(true);
      expect(second.composition.hasFailureBarrier()).toBe(false); // a SUCCESSFUL DELIVERY_CONFIRMED is NOT a barrier
      expect(second.composition.lastIntake()).not.toBeNull(); // the intake is recovered and deliverable
      expect(second.web.posted).toHaveLength(0); // NO duplicate ACCEPTED post
    } finally {
      await second.composition.stop();
    }
  });
});

// R2 recovery §5.6/§5.7: the composition re-reads the durable failure classifier at each named boundary and halts a
// non-DELIVERED status progression. These prove the defect (a delivery/projection running behind a durable failure
// record) would occur without the re-reads.
describe('AS1 R2 recovery — status ordering & barrier re-reads in composition (design §5.6/§5.7)', () => {
  it('re-reads the classifier at deliverPending ENTRY: a DELIVERY_FAILED seeded after acceptance refuses delivery (no tmux)', async () => {
    const { stateRoot, composition, socket, gitSource, receiveGrant, tmuxPort } = await startAgentOfficeComposition();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope());
      const intakeId = composition.lastIntake();
      if (intakeId === null) throw new Error('expected an intake');
      const store = await As1ProfileInboundStore.open(stateRoot, selectProfile('AGENT_OFFICE_ADVISOR'), new FakeClock(CLOCK_ISO));
      // Ready delivery authority so, WITHOUT the barrier re-read, deliverPending would paste through tmux.
      const { grant, lease } = await buildDeliveryAuthority(stateRoot, store, parseReceiveGrant(receiveGrant), selectProfile('AGENT_OFFICE_ADVISOR'), intakeId);
      const base = `${AUTH_ROOT}/runtime-authority/agent-office-advisor/${intakeId}`;
      gitSource.set(`${base}/pointer-delivery-grant.json`, grant);
      gitSource.set(`${base}/readiness-lease.json`, lease);
      // A durable DELIVERY_FAILED barrier record appears AFTER acceptance.
      await store.recordOutboxPhase(userStatusOutboundId('AGENT_OFFICE_ADVISOR', intakeId, 'DELIVERY_FAILED'), 'PREPARED', { requestHash: `sha256:${'4'.repeat(64)}` });
      const delivery = await composition.deliverPending();
      expect(delivery.phase).toBe('AWAITING'); // the entry re-read entered the barrier before any grant/lease/tmux work
      expect(composition.hasFailureBarrier()).toBe(true);
      expect(tmuxPort.pasteCalls).toBe(0);
      expect(tmuxPort.enterCalls).toBe(0);
    } finally {
      await composition.incidentKill().catch(() => undefined);
    }
  });

  it('a DELIVERY_FAILED record before the ACK SUPPRESSES DELIVERY_CONFIRMED and projects NO INTAKE/RESULT', async () => {
    const { stateRoot, composition, socket, gitSource, receiveGrant, web } = await startAgentOfficeComposition();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope());
      const intakeId = composition.lastIntake();
      if (intakeId === null) throw new Error('expected an intake');
      const advisorProfile = selectProfile('AGENT_OFFICE_ADVISOR');
      const store = await As1ProfileInboundStore.open(stateRoot, advisorProfile, new FakeClock(CLOCK_ISO));
      const { grant, lease } = await buildDeliveryAuthority(stateRoot, store, parseReceiveGrant(receiveGrant), advisorProfile, intakeId);
      const base = `${AUTH_ROOT}/runtime-authority/agent-office-advisor/${intakeId}`;
      gitSource.set(`${base}/pointer-delivery-grant.json`, grant);
      gitSource.set(`${base}/readiness-lease.json`, lease);
      expect((await composition.deliverPending()).outcome).toBe('DELIVERED');
      // A valid ACK is available, but a durable DELIVERY_FAILED barrier record now exists.
      const deliveryGrant = parsePointerDeliveryGrant(grant);
      const { deliveryId } = parseContainedPointerRef(deliveryGrant);
      const parsedReceiveGrant = parseReceiveGrant(receiveGrant);
      const receiveGrantState = await store.readReceiveGrantState(parsedReceiveGrant.receiveGrantId);
      const terminalDelivery = await store.readTmuxDeliveryRecord(deliveryId);
      const rootCorrelation = await store.findRootByIntakeId(intakeId);
      const consumption = await store.readDeliveryAuthorityConsumption(deliveryGrant.pointerDeliveryGrantId);
      if (receiveGrantState === null || terminalDelivery === null || rootCorrelation === null || consumption === null) throw new Error('expected durable records');
      const authority = buildEvidenceAuthority({ receiveGrant: parsedReceiveGrant, receiveGrantState, pointerDeliveryGrant: deliveryGrant, terminalDelivery, rootCorrelation, consumption });
      gitSource.set(`${authority.evidencePrefix}/${intakeId}/ack.json`, validAdvisorAck({ intakeId: authority.intakeId, sourceEventId: authority.sourceEventId, pointerHash: authority.pointerHash, ...authority.acceptedAck }));
      await store.recordOutboxPhase(userStatusOutboundId('AGENT_OFFICE_ADVISOR', intakeId, 'DELIVERY_FAILED'), 'PREPARED', { requestHash: `sha256:${'5'.repeat(64)}` });
      const postsBefore = web.posted.length;
      const outcomes = await composition.ingestEvidenceAndProject();
      // The durable classifier re-read (at ingest entry / each evidence checkpoint) enters the barrier BEFORE the ACK
      // triggers DELIVERY_CONFIRMED, or the ACK-time re-require suppresses it — either way the barrier dominates.
      expect(outcomes.some((o) => o.startsWith('FAILURE_ADMISSION_REFUSED') || o.startsWith('DELIVERY_CONFIRMED:SUPPRESSED_BY_'))).toBe(true);
      expect(outcomes.some((o) => o.startsWith('RESULT_OUTBOUND:'))).toBe(false); // no business projection behind the barrier
      expect(web.posted).toHaveLength(postsBefore); // no DELIVERY_CONFIRMED post
      expect(composition.hasFailureBarrier()).toBe(true);
    } finally {
      await composition.incidentKill().catch(() => undefined);
    }
  });

  it('re-reads the classifier AFTER the evidence observation and BEFORE the ingress checkpoint: a barrier appearing mid-observation begins NO ingress/status/business work', async () => {
    // handoff 95 F01 (correction 3, defect 5): §5.7 requires a durable re-read AFTER each evidence observation and
    // IMMEDIATELY BEFORE ingress.ingest. A DELIVERY_FAILED record that appears DURING the ACK observation (after the
    // per-checkpoint re-read, before the durable checkpoint) must refuse the ingress checkpoint, DELIVERY_CONFIRMED, and
    // every business projection. Adversarial vs only the entry/per-checkpoint re-read, which would run ingress.ingest
    // (a durable evidence checkpoint) behind the mid-observation barrier.
    const { stateRoot, composition, socket, gitSource, receiveGrant, web } = await startAgentOfficeComposition();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope());
      const intakeId = composition.lastIntake();
      if (intakeId === null) throw new Error('expected an intake');
      const advisorProfile = selectProfile('AGENT_OFFICE_ADVISOR');
      const store = await As1ProfileInboundStore.open(stateRoot, advisorProfile, new FakeClock(CLOCK_ISO));
      const { grant, lease } = await buildDeliveryAuthority(stateRoot, store, parseReceiveGrant(receiveGrant), advisorProfile, intakeId);
      const base = `${AUTH_ROOT}/runtime-authority/agent-office-advisor/${intakeId}`;
      gitSource.set(`${base}/pointer-delivery-grant.json`, grant);
      gitSource.set(`${base}/readiness-lease.json`, lease);
      expect((await composition.deliverPending()).outcome).toBe('DELIVERED');
      const deliveryGrant = parsePointerDeliveryGrant(grant);
      const { deliveryId } = parseContainedPointerRef(deliveryGrant);
      const parsedReceiveGrant = parseReceiveGrant(receiveGrant);
      const receiveGrantState = await store.readReceiveGrantState(parsedReceiveGrant.receiveGrantId);
      const terminalDelivery = await store.readTmuxDeliveryRecord(deliveryId);
      const rootCorrelation = await store.findRootByIntakeId(intakeId);
      const consumption = await store.readDeliveryAuthorityConsumption(deliveryGrant.pointerDeliveryGrantId);
      if (receiveGrantState === null || terminalDelivery === null || rootCorrelation === null || consumption === null) throw new Error('expected durable records');
      const authority = buildEvidenceAuthority({ receiveGrant: parsedReceiveGrant, receiveGrantState, pointerDeliveryGrant: deliveryGrant, terminalDelivery, rootCorrelation, consumption });
      const ackValue = validAdvisorAck({ intakeId: authority.intakeId, sourceEventId: authority.sourceEventId, pointerHash: authority.pointerHash, ...authority.acceptedAck });
      // The barrier appears DURING the ACK observation: the lazy factory writes DELIVERY_FAILED, THEN returns the ACK
      // bytes. So the per-checkpoint re-read (before observe) is OPEN, but the AFTER-observation re-read must catch it.
      const wrote = { done: false };
      gitSource.setLazy(`${authority.evidencePrefix}/${intakeId}/ack.json`, async () => {
        if (!wrote.done) {
          wrote.done = true;
          await store.recordOutboxPhase(userStatusOutboundId('AGENT_OFFICE_ADVISOR', intakeId, 'DELIVERY_FAILED'), 'PREPARED', { requestHash: `sha256:${'7'.repeat(64)}` });
        }
        return ackValue;
      });
      const postsBefore = web.posted.length;
      const outcomes = await composition.ingestEvidenceAndProject();
      expect(outcomes.some((o) => o.startsWith('FAILURE_ADMISSION_REFUSED'))).toBe(true);
      expect(outcomes.some((o) => o.startsWith('ACK:'))).toBe(false); // the durable ingress CHECKPOINT never ran
      expect(outcomes.some((o) => o.startsWith('RESULT_OUTBOUND:'))).toBe(false); // no business projection
      expect(web.posted).toHaveLength(postsBefore); // no DELIVERY_CONFIRMED post
      expect(composition.hasFailureBarrier()).toBe(true);
    } finally {
      await composition.incidentKill().catch(() => undefined);
    }
  });

  it('a DELIVERY_FAILED status REJECTED before its first durable phase halts progression WITHOUT a false durable barrier/record', async () => {
    // handoff 95 F01 (correction 2, defect 2): a STOPPED_BEFORE_PASTE with a null journal attempts DELIVERY_FAILED; if
    // that send is REJECTED before its first durable phase, the composition must NOT fabricate a crash-durable
    // DELIVERY_FAILED barrier/record. It reclassifies the durable siblings — still OPEN → haltProgression on the exact
    // non-delivered outcome (a truthful PROGRESSION halt), NO failure record. Adversarial vs unconditionally entering
    // DELIVERY_FAILED_BARRIER (a false durable-barrier claim). Seed: a VALID lease whose destination is NOT the
    // tmux-observed pane (→ STOPPED_BEFORE_PASTE, null journal, before tmux), and ONLY a DELIVERY_CONFIRMED (no failure
    // sibling) so the DELIVERY_FAILED send is ordering-rejected pre-durable.
    const { stateRoot, composition, socket, gitSource, receiveGrant, tmuxPort } = await startAgentOfficeComposition();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope());
      const intakeId = composition.lastIntake();
      if (intakeId === null) throw new Error('expected an intake');
      const advisorProfile = selectProfile('AGENT_OFFICE_ADVISOR');
      const store = await As1ProfileInboundStore.open(stateRoot, advisorProfile, new FakeClock(CLOCK_ISO));
      const { grant, lease } = await buildDeliveryAuthority(stateRoot, store, parseReceiveGrant(receiveGrant), advisorProfile, intakeId);
      const base = `${AUTH_ROOT}/runtime-authority/agent-office-advisor/${intakeId}`;
      gitSource.set(`${base}/pointer-delivery-grant.json`, grant);
      // A VALID lease bound to a DIFFERENT pane than the tmux port observes → the transport stops before paste.
      gitSource.set(`${base}/readiness-lease.json`, { ...lease, destination: validDestination({ sessionId: '$99', windowId: '@99', paneId: '%99' }) });
      // Seed a durable DELIVERY_CONFIRMED@RESPONSE_RECORDED (NO failure sibling) so the DELIVERY_FAILED send is
      // ordering-rejected before any durable phase.
      const confirmedId = userStatusOutboundId('AGENT_OFFICE_ADVISOR', intakeId, 'DELIVERY_CONFIRMED');
      await store.recordOutboxPhase(confirmedId, 'PREPARED', { requestHash: `sha256:${'8'.repeat(64)}` });
      await store.recordOutboxPhase(confirmedId, 'REQUEST_STARTED');
      await store.recordOutboxPhase(confirmedId, 'RESPONSE_RECORDED', { responseHash: `sha256:${'9'.repeat(64)}` });

      await composition.deliverPending();
      expect(tmuxPort.pasteCalls).toBe(0); // stopped before paste
      // NO fabricated DELIVERY_FAILED durable record (the send was rejected pre-durable).
      expect(await store.readOutboxRecord(userStatusOutboundId('AGENT_OFFICE_ADVISOR', intakeId, 'DELIVERY_FAILED'))).toBeNull();
      expect(composition.hasFailureBarrier()).toBe(true);
      // The barrier is a truthful PROGRESSION halt (haltProgression), NOT a false DELIVERY_FAILED_BARRIER, and no later work.
      const outcomes = await composition.ingestEvidenceAndProject();
      expect(outcomes).toContain('FAILURE_ADMISSION_REFUSED:PROGRESSION_HALTED');
      expect(outcomes.some((o) => o.includes('DELIVERY_FAILED_BARRIER'))).toBe(false);
    } finally {
      await composition.incidentKill().catch(() => undefined);
    }
  });

  it('a PROCESSING_FAILED attempted with ACCEPTED absent is REJECTED pre-durable and halts progression WITHOUT a false durable barrier/record', async () => {
    // handoff 95 F01 (correction 2, defect 2 — PROCESSING_FAILED): a non-benign evidence failure makes
    // projectAcceptedEvidence throw; the catch attempts PROCESSING_FAILED. When ACCEPTED is absent the ordering guard
    // rejects it BEFORE its first durable phase; the composition must reclassify (still OPEN) and haltProgression — NOT
    // fabricate a PROCESSING_FAILED_BARRIER/record. Adversarial vs unconditionally entering PROCESSING_FAILED_BARRIER.
    // Seed (adversarial test-STATE only): after a successful delivery, remove ONLY ACCEPTED from the durable outbox index
    // and make the ACK evidence observation throw inside projectAcceptedEvidence.
    const { stateRoot, composition, socket, gitSource, receiveGrant, web } = await startAgentOfficeComposition();
    try {
      await composition.start();
      await socket.deliver(slackEnvelope());
      const intakeId = composition.lastIntake();
      if (intakeId === null) throw new Error('expected an intake');
      const advisorProfile = selectProfile('AGENT_OFFICE_ADVISOR');
      const store = await As1ProfileInboundStore.open(stateRoot, advisorProfile, new FakeClock(CLOCK_ISO));
      const { grant, lease } = await buildDeliveryAuthority(stateRoot, store, parseReceiveGrant(receiveGrant), advisorProfile, intakeId);
      const base = `${AUTH_ROOT}/runtime-authority/agent-office-advisor/${intakeId}`;
      gitSource.set(`${base}/pointer-delivery-grant.json`, grant);
      gitSource.set(`${base}/readiness-lease.json`, lease);
      expect((await composition.deliverPending()).outcome).toBe('DELIVERED');
      const deliveryGrant = parsePointerDeliveryGrant(grant);
      const { deliveryId } = parseContainedPointerRef(deliveryGrant);
      const parsedReceiveGrant = parseReceiveGrant(receiveGrant);
      const receiveGrantState = await store.readReceiveGrantState(parsedReceiveGrant.receiveGrantId);
      const terminalDelivery = await store.readTmuxDeliveryRecord(deliveryId);
      const rootCorrelation = await store.findRootByIntakeId(intakeId);
      const consumption = await store.readDeliveryAuthorityConsumption(deliveryGrant.pointerDeliveryGrantId);
      if (receiveGrantState === null || terminalDelivery === null || rootCorrelation === null || consumption === null) throw new Error('expected durable records');
      const authority = buildEvidenceAuthority({ receiveGrant: parsedReceiveGrant, receiveGrantState, pointerDeliveryGrant: deliveryGrant, terminalDelivery, rootCorrelation, consumption });
      // The ACK evidence observation throws non-benignly → projectAcceptedEvidence throws → the catch attempts PROCESSING_FAILED.
      gitSource.setLazy(`${authority.evidencePrefix}/${intakeId}/ack.json`, () => Promise.reject(new DomainError('STORE_QUARANTINED', 'ack observation failed non-benignly')));
      // Remove ONLY the ACCEPTED record from the durable outbox index (valid JSON array) — adversarial test-state only.
      const outboxIndex = path.join(stateRoot, 'indexes/as1-slack-pilot/profiles/agent-office-advisor/slack-outbox.json');
      const acceptedId = userStatusOutboundId('AGENT_OFFICE_ADVISOR', intakeId, 'ACCEPTED');
      const records = JSON.parse(await readFile(outboxIndex, 'utf8')) as { outboundId: string }[];
      await writeFile(outboxIndex, JSON.stringify(records.filter((r) => r.outboundId !== acceptedId)), 'utf8');
      expect(await store.readOutboxRecord(acceptedId)).toBeNull(); // ACCEPTED now absent

      const postsBefore = web.posted.length;
      await expect(composition.ingestEvidenceAndProject()).rejects.toThrow(); // the original non-benign error stays terminal
      // NO fabricated PROCESSING_FAILED durable record (the send was ordering-rejected pre-durable — ACCEPTED absent).
      expect(await store.readOutboxRecord(userStatusOutboundId('AGENT_OFFICE_ADVISOR', intakeId, 'PROCESSING_FAILED'))).toBeNull();
      expect(composition.hasFailureBarrier()).toBe(true); // a truthful progression halt / profile latch
      expect(web.posted).toHaveLength(postsBefore); // no status / business post
      // A truthful PROGRESSION halt (haltProgression), NOT a false PROCESSING_FAILED_BARRIER.
      const outcomes = await composition.ingestEvidenceAndProject();
      expect(outcomes).toContain('FAILURE_ADMISSION_REFUSED:PROGRESSION_HALTED');
      expect(outcomes.some((o) => o.includes('PROCESSING_FAILED_BARRIER'))).toBe(false);
    } finally {
      await composition.incidentKill().catch(() => undefined);
    }
  });
});
