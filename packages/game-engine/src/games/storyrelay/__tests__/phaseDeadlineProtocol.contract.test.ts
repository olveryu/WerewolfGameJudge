/**
 * Phase Deadline Protocol — story relay scenario (E-2).
 *
 * Story Relay's registered assembly: the public expire command
 * travels on the uncontrolled-user channel with no extra actor
 * gate, and its revision policy is 'reject', assembled at the
 * decide entry — every revisioned command is rejected there
 * before dispatch, so the guard itself injects no revision gate.
 * No settle.due: expiry is pure client acceleration through the
 * shared countdown hook. Same-named scenario files live in each
 * switched game's __tests__.
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
  let state: StoryRelayState = storyRelayEngine.createInitialState(
    { ...DEFAULT_STORY_RELAY_CONFIG, numberOfPlayers: 4, transitionDurationSeconds: 0 },
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
    const decision = attempt(command, userContext('host', null, 1000));
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
  };

  send({ type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } });
  send({ type: 'room.seat.fillBots' });
  send({ type: 'storyrelay.game.begin' });
  const armedPhase = state.phase;

  const expire = (phaseRevision: number, context: CommandContext) =>
    attempt({ type: 'storyrelay.phase.expire', phaseRevision }, context);

  return {
    expireAsUser: (nowMs) => expire(state.phaseRevision, userContext('host', null, nowMs)),
    expireAsControlledUser: (nowMs) => expire(state.phaseRevision, userContext('host', 1, nowMs)),
    expirePublicAsSystem: (nowMs) => expire(state.phaseRevision, systemContext(nowMs)),
    expireSettleAsSystem: () => {
      throw new Error('Story Relay has no internal settle command');
    },
    expireSettleAsUser: () => {
      throw new Error('Story Relay has no internal settle command');
    },
    expireWithStaleRevision: (nowMs) =>
      expire(state.phaseRevision + 1, userContext('host', null, nowMs)),
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
    publicChannel: 'uncontrolledUser',
    hasSettleCommand: false,
    stalePolicy: 'reject',
    staleReason: STORY_RELAY_REASONS.task,
    dispatchAdvances: true,
  },
});
