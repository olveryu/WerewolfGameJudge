/**
 * Phase Deadline Protocol — avalon scenario (E-2).
 *
 * Avalon's registered assembly: dual channel — the public expire
 * command travels on the uncontrolled-user channel (any foreground
 * client may accelerate the settlement), while the internal
 * settleExpired command, dispatched by the scheduled
 * `avalon.settle.due` effect, travels on the system channel.
 * Neither command carries a revision; correctness for the internal
 * channel rides on the worker's pinned-arming staleness gate, not
 * on a revision check. Same-named scenario files live in each
 * switched game's __tests__.
 */

import type { CommandContext } from '../../../platform/engine';
import { applyDecision } from '../../../platform/engine/__tests__/engineSession';
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
  send({ type: 'avalon.team.updateDraft', seats: [0, 1] }, asUser(seatUser(leader)));
  send({ type: 'avalon.team.preselect' }, asUser(seatUser(leader)));
  send({ type: 'avalon.team.propose' }, asUser(seatUser(leader)));
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
    expireAsUser: (nowMs) =>
      harness.attempt({ type: 'avalon.phase.expire' }, harness.userContext('host', null, nowMs)),
    expireAsControlledUser: (nowMs) =>
      harness.attempt({ type: 'avalon.phase.expire' }, harness.userContext('host', 1, nowMs)),
    expirePublicAsSystem: (nowMs) =>
      harness.attempt({ type: 'avalon.phase.expire' }, harness.systemContext(nowMs)),
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
    publicChannel: 'uncontrolledUser',
    hasSettleCommand: true,
    stalePolicy: 'none',
    staleReason: null,
    dispatchAdvances: true,
  },
});
