/**
 * Phase Deadline Protocol — story relay scenario (E-2).
 *
 * Story Relay's registered assembly: system only (D3, 2026-11-05 —
 * the public expire command was deleted). There is no public expire
 * command at all; the scheduled `storyrelay.settle.due` effect is
 * the sole expiry channel and dispatches the internal settleExpired
 * command on the system channel. The command carries no revision;
 * correctness rides on the worker's pinned-arming staleness gate.
 * Same-named scenario files live in each switched game's __tests__.
 */

import type { CommandContext } from '../../../platform/engine';
import {
  describePhaseDeadlineProtocol,
  type PhaseDeadlineSession,
} from '../../../platform/room/__tests__/phaseDeadlineScenarios';
import type { StoryRelayCommand } from '../commands/types';
import { STORY_RELAY_REASONS, type StoryRelayDecision } from '../domain/decision';
import { storyRelayEngine } from '../engine';
import { parseStoryRelayState } from '../state/parseState';
import { DEFAULT_STORY_RELAY_CONFIG, type StoryRelayState } from '../state/types';

function makeSession(): PhaseDeadlineSession {
  const hostUserId = 'host';
  let state: StoryRelayState = storyRelayEngine.createInitialState(
    { ...DEFAULT_STORY_RELAY_CONFIG, numberOfPlayers: 4, transitionDurationSeconds: 0 },
    { roomCode: '1234', hostUserId, nowMs: 1000, commandId: 'create' },
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
    randomSeed: 'round',
  });
  const systemContext = (nowMs: number): CommandContext => ({
    actor: { kind: 'system', effectId: 'settle' },
    controlledSeat: null,
    nowMs,
    commandId: `command:${commandNumber++}`,
    randomSeed: 'round',
  });
  const apply = (decision: StoryRelayDecision) => {
    if (decision.kind !== 'commit') return;
    state = parseStoryRelayState(
      JSON.parse(
        JSON.stringify(
          storyRelayEngine.normalize(decision.events.reduce(storyRelayEngine.evolve, state)),
        ),
      ),
    );
  };
  const attempt = (command: StoryRelayCommand, context: CommandContext) => {
    const decision = storyRelayEngine.decide(state, command, context);
    apply(decision);
    return decision;
  };
  const send = (command: StoryRelayCommand) => {
    const decision = attempt(command, userContext(hostUserId, null, 1000));
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
  };
  const takeSeat = (seat: number, userId: string, displayName: string) => {
    const decision = attempt(
      { type: 'room.seat.take', seat, profile: { displayName } },
      userContext(userId, null, 1000),
    );
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
  };

  takeSeat(0, hostUserId, 'Host');
  takeSeat(1, 'player-1', 'Player 2');
  send({ type: 'room.seat.fillBots' });
  send({ type: 'storyrelay.game.begin' });
  const armedPhase = state.phase;

  const expireSettle = (context: CommandContext) =>
    attempt({ type: 'storyrelay.phase.settleExpired' }, context);

  return {
    expireSettleAsSystem: (nowMs) => expireSettle(systemContext(nowMs)),
    expireSettleAsUser: (nowMs) => expireSettle(userContext(hostUserId, null, nowMs)),
    expireWithStaleRevision: () => {
      throw new Error('Story Relay settle commands carry no revision');
    },
    deadlineAt: () => {
      if (state.deadlineAt === null) throw new Error('Expected an armed deadline');
      return state.deadlineAt;
    },
    hasAdvanced: () => state.phase !== armedPhase,
  };
}

describePhaseDeadlineProtocol({
  game: 'storyrelay',
  makeSession,
  expectations: {
    notExpiredReason: STORY_RELAY_REASONS.deadline,
    hasSettleCommand: true,
    stalePolicy: 'none',
    staleReason: null,
    dispatchAdvances: true,
  },
});
