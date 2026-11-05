/**
 * Phase Deadline Protocol — avalon scenario (E-2).
 *
 * Avalon's registered assembly: system only (D3, 2026-11-05 —
 * the public expire command was deleted). There is no public expire
 * command at all; the scheduled `avalon.settle.due` effect is the
 * sole expiry channel and dispatches the internal settleExpired
 * command on the system channel. Neither command carries a
 * revision; correctness rides on the worker's pinned-arming
 * staleness gate, not on a revision check. Same-named scenario
 * files live in each switched game's __tests__.
 */

import type { CommandContext } from '../../../platform/engine';
import { applyDecision } from '../../../platform/engine/__tests__/engineSession';
import { REASON_CONTROLLED_SEAT_NOT_ALLOWED } from '../../../platform/protocol/reasons';
import {
  describePhaseDeadlineProtocol,
  type PhaseDeadlineSession,
} from '../../../platform/room/__tests__/phaseDeadlineScenarios';
import type { AvalonCommand } from '../commands/types';
import { AVALON_REASONS, type AvalonDecision } from '../domain/decision';
import { getAvalonNightParticipants } from '../domain/rules';
import { avalonEngine } from '../engine';
import { parseAvalonState } from '../state/parseState';
import { type AvalonState, DEFAULT_AVALON_CONFIG } from '../state/types';

interface AvalonHarness {
  readonly state: () => AvalonState;
  userContext(userId: string, controlledSeat: number | null, nowMs: number): CommandContext;
  systemContext(nowMs: number): CommandContext;
  attempt(command: AvalonCommand, context: CommandContext): AvalonDecision;
}

function createHarness(): AvalonHarness {
  let state: AvalonState = avalonEngine.createInitialState(
    { ...DEFAULT_AVALON_CONFIG, numberOfPlayers: 5 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  let commandNumber = 0;
  const userContext = (
    userId: string,
    controlledSeat: number | null,
    nowMs: number,
  ): CommandContext => ({
    actor: { kind: 'user', userId },
    controlledSeat,
    nowMs,
    commandId: `command:${commandNumber++}`,
    randomSeed: 'phase-deadline',
  });
  const systemContext = (nowMs: number): CommandContext => ({
    actor: { kind: 'system', effectId: 'settle' },
    controlledSeat: null,
    nowMs,
    commandId: `command:${commandNumber++}`,
    randomSeed: 'phase-deadline',
  });
  const attempt = (command: AvalonCommand, context: CommandContext): AvalonDecision => {
    const decision = avalonEngine.decide(state, command, context);
    if (decision.kind === 'commit') {
      state = applyDecision(avalonEngine, state, decision, parseAvalonState);
    }
    return decision;
  };
  return { state: () => state, userContext, systemContext, attempt };
}

const seatUser = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);

/** Five seated humans driven to an armed vote countdown in round 1. */
function armedHarness(): AvalonHarness {
  const harness = createHarness();
  const send = (command: AvalonCommand, context: CommandContext) => {
    const decision = harness.attempt(command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
  };
  const asUser = (userId: string) => harness.userContext(userId, null, 1000);
  const ackAudio = () => {
    while (harness.state().isAudioPlaying) {
      send(
        { type: 'avalon.audio.ack', audioBatchId: harness.state().audioBatchId },
        asUser('host'),
      );
    }
  };
  for (let seat = 0; seat < 5; seat += 1) {
    send(
      { type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } },
      asUser(seatUser(seat)),
    );
  }
  send({ type: 'avalon.roles.assign' }, asUser('host'));
  for (let seat = 0; seat < 5; seat += 1) {
    send({ type: 'avalon.role.viewed' }, asUser(seatUser(seat)));
  }
  send({ type: 'avalon.game.begin' }, asUser('host'));
  ackAudio();
  while (harness.state().phase.kind === 'night') {
    const phase = harness.state().phase;
    if (phase.kind !== 'night') throw new Error('Expected a night phase');
    for (const seat of getAvalonNightParticipants(harness.state().roles, phase.step)) {
      send({ type: 'avalon.night.confirm' }, asUser(seatUser(seat)));
    }
    ackAudio();
  }
  const leader = harness.state().leaderSeat;
  send({ type: 'avalon.team.preselect', seats: [0, 1] }, asUser(seatUser(leader)));
  send({ type: 'avalon.team.propose', seats: [0, 1] }, asUser(seatUser(leader)));
  for (let seat = 0; seat < 5; seat += 1) {
    send({ type: 'avalon.team.vote', vote: 'approve' }, asUser(seatUser(seat)));
  }
  const armed = harness.state().phase;
  if (armed.kind !== 'vote' || armed.deadlineAt === null) {
    throw new Error('Expected an armed vote countdown');
  }
  return harness;
}

function makeSession(): PhaseDeadlineSession {
  const harness = armedHarness();
  const armedPhase = harness.state().phase;
  const current = () => harness.state();

  return {
    expireSettleAsSystem: (nowMs) =>
      harness.attempt({ type: 'avalon.phase.settleExpired' }, harness.systemContext(nowMs)),
    expireSettleAsUser: (nowMs) =>
      harness.attempt(
        { type: 'avalon.phase.settleExpired' },
        harness.userContext('host', null, nowMs),
      ),
    expireWithStaleRevision: () => {
      throw new Error('Avalon expire commands carry no revision');
    },
    deadlineAt: () => {
      const phase = current().phase;
      if (phase.kind !== 'vote' || phase.deadlineAt === null) {
        throw new Error('Expected an armed vote countdown');
      }
      return phase.deadlineAt;
    },
    hasAdvanced: () => current().phase !== armedPhase,
  };
}

describePhaseDeadlineProtocol({
  game: 'avalon',
  makeSession,
  expectations: {
    notExpiredReason: AVALON_REASONS.deadline,
    hasSettleCommand: true,
    stalePolicy: 'none',
    staleReason: null,
    dispatchAdvances: true,
  },
});

/**
 * Host self-rescue (D3 follow-up): `avalon.phase.retrySettle`
 * re-drives the current phase's settle through the same guard
 * sequence and dispatch as the scheduled delivery. It is not an
 * expire send — the host gate runs first, and the guard still
 * rejects before the deadline, for non-hosts, and for a host acting
 * through a takeover seat.
 */
describe('avalon.phase.retrySettle (host self-rescue)', () => {
  let harness: AvalonHarness;
  let armedPhase: AvalonState['phase'];
  let deadlineAt: number;
  const retry = (userId: string, controlledSeat: number | null, nowMs: number) =>
    harness.attempt(
      { type: 'avalon.phase.retrySettle' },
      harness.userContext(userId, controlledSeat, nowMs),
    );

  beforeEach(() => {
    harness = armedHarness();
    armedPhase = harness.state().phase;
    if (armedPhase.kind !== 'vote' || armedPhase.deadlineAt === null) {
      throw new Error('Expected an armed vote countdown');
    }
    deadlineAt = armedPhase.deadlineAt;
  });

  it('rejects the host before the deadline', () => {
    expect(retry('host', null, deadlineAt - 1)).toEqual({
      kind: 'reject',
      reason: AVALON_REASONS.deadline,
    });
    expect(harness.state().phase).toBe(armedPhase);
  });

  it('rejects a non-host after the deadline', () => {
    expect(retry('u1', null, deadlineAt)).toEqual({
      kind: 'reject',
      reason: AVALON_REASONS.notHostRetrySettle,
    });
    expect(harness.state().phase).toBe(armedPhase);
  });

  it('rejects a host acting through a takeover seat', () => {
    expect(retry('host', 0, deadlineAt)).toEqual({
      kind: 'reject',
      reason: REASON_CONTROLLED_SEAT_NOT_ALLOWED,
    });
    expect(harness.state().phase).toBe(armedPhase);
  });

  it('settles the phase for the host after the deadline', () => {
    expect(retry('host', null, deadlineAt).kind).toBe('commit');
    expect(harness.state().phase).not.toBe(armedPhase);
  });

  it('is a no-op once the phase has advanced', () => {
    expect(retry('host', null, deadlineAt).kind).toBe('commit');
    expect(harness.state().phase).not.toBe(armedPhase);
    expect(retry('host', null, deadlineAt + 1_000).kind).toBe('reject');
  });
});
