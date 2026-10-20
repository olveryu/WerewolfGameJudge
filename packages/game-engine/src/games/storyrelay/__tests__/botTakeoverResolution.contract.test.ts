/**
 * Bot Takeover Resolution — storyrelay scenario (bot wave PR-2).
 *
 * Runs the shared acting-seat propositions against the real
 * storyrelay engine, whose task commands resolve through the shared
 * relay task machine. The probe command is storyrelay.text.submit
 * in the settling phase; its commit event's entry names the author
 * seat. Layout: host at seat 0, a human guest at seat 1, bots at
 * seats 2-3.
 */

import type { CommandContext } from '../../../platform/engine';
import { dispatchCommand } from '../../../platform/engine/__tests__/engineSession';
import { REASON_NOT_SEATED, REASON_USER_ACTOR_REQUIRED } from '../../../platform/protocol/reasons';
import {
  type ActingSeatProbe,
  type ActingSeatProbeActor,
  describeBotTakeoverResolution,
} from '../../../platform/room/__tests__/actingSeatScenarios';
import type { StoryRelayCommand } from '../commands/types';
import { getStoryRelayTaskForSeat } from '../domain/relay';
import { storyRelayEngine } from '../engine';
import { DEFAULT_STORY_RELAY_CONFIG, type StoryRelayState } from '../state/types';

function user(userId: string, controlledSeat: number | null = null): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat,
    nowMs: 1000,
    commandId: 'probe',
    randomSeed: 'round',
  };
}

function settlingState(): StoryRelayState {
  let state = storyRelayEngine.createInitialState(
    { ...DEFAULT_STORY_RELAY_CONFIG, numberOfPlayers: 4, transitionDurationSeconds: 0 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  const dispatch = (command: StoryRelayCommand, context: CommandContext) => {
    state = dispatchCommand(storyRelayEngine, state, command, context);
    return state;
  };
  dispatch({ type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } }, user('host'));
  dispatch({ type: 'room.seat.take', seat: 1, profile: { displayName: 'Guest' } }, user('guest'));
  dispatch({ type: 'room.seat.fillBots' }, user('host'));
  dispatch({ type: 'storyrelay.game.begin' }, user('host'));
  dispatch({ type: 'storyrelay.phase.finish', phaseRevision: state.phaseRevision }, user('host'));
  if (state.phase !== 'settling') throw new Error('Expected settling phase');
  return state;
}

describeBotTakeoverResolution({
  game: 'storyrelay',
  hostUserId: 'host',
  hostSeat: 0,
  guestUserId: 'guest',
  guestSeat: 1,
  botSeat: 2,
  systemActorReason: REASON_USER_ACTOR_REQUIRED,
  unseatedReason: REASON_NOT_SEATED,
  makeSession() {
    const state = settlingState();
    return {
      probe(actor: ActingSeatProbeActor): ActingSeatProbe {
        const expectedSeat =
          actor.kind === 'user' ? (actor.controlledSeat ?? (actor.userId === 'host' ? 0 : 1)) : 0;
        const task = getStoryRelayTaskForSeat(state, expectedSeat);
        if (task === null) throw new Error('Missing task for probe seat');
        const context: CommandContext =
          actor.kind === 'system'
            ? {
                actor: { kind: 'system', effectId: 'probe' },
                controlledSeat: null,
                nowMs: 1000,
                commandId: 'probe',
                randomSeed: 'round',
              }
            : user(actor.userId, actor.controlledSeat);
        const decision = storyRelayEngine.decide(
          state,
          {
            type: 'storyrelay.text.submit',
            roundId: task.roundId,
            stepIndex: task.stepIndex,
            chainId: task.chainId,
            text: '探针稿件',
          },
          context,
        );
        if (decision.kind === 'reject') return { kind: 'rejected', reason: decision.reason };
        const event = decision.events.find(
          (entry): entry is Extract<typeof entry, { type: 'storyrelay.entries.appended' }> =>
            entry.type === 'storyrelay.entries.appended',
        );
        if (event === undefined) throw new Error('Submit commit carried no appended event');
        return { kind: 'resolved', seat: event.entry.authorSeat };
      },
    };
  },
});
