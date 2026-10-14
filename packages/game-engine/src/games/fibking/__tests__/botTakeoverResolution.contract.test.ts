/**
 * Bot Takeover Resolution — fibking scenario (bot wave PR-2).
 *
 * Runs the shared acting-seat propositions against the real fibking
 * engine. The probe command is fibking.round.confirmRoleView in the
 * viewing phase, whose commit event names the seat that viewed.
 * Layout: host at seat 0, a human guest at seat 1, bots at seats 2-3.
 */

import type { CommandContext, CreateGameContext, Decision } from '../../../platform/engine';
import { REASON_NOT_SEATED, REASON_USER_ACTOR_REQUIRED } from '../../../platform/protocol/reasons';
import {
  type ActingSeatProbe,
  type ActingSeatProbeActor,
  describeBotTakeoverResolution,
} from '../../../platform/room/__tests__/actingSeatScenarios';
import type { FibCommand } from '../commands/types';
import type { FibEvent } from '../domain/events';
import type { FibEffect } from '../effects/types';
import { decideFibCommand, fibEngine } from '../engine';
import { FIB_PREPARATION_STAGES, type FibState } from '../state/types';

const CREATE_CONTEXT: CreateGameContext = {
  roomCode: '4321',
  hostUserId: 'host',
  nowMs: 1_000,
  commandId: 'create-1',
};

function user(userId: string, controlledSeat: number | null = null): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat,
    nowMs: 2_000,
    commandId: 'probe',
    randomSeed: 'seed-1',
  };
}

function system(): CommandContext {
  return {
    actor: { kind: 'system', effectId: 'effect-1' },
    controlledSeat: null,
    nowMs: 2_100,
    commandId: 'effect-command-1',
    randomSeed: 'role-seed-1',
  };
}

function applyDecision(state: FibState, decision: Decision<FibEvent, FibEffect>): FibState {
  if (decision.kind !== 'commit') {
    throw new Error(`Expected committed Fib decision, received ${decision.reason}`);
  }
  let nextState = state;
  for (const event of decision.events) {
    nextState = fibEngine.evolve(nextState, event);
  }
  return fibEngine.normalize(nextState);
}

function dispatch(state: FibState, command: FibCommand, context: CommandContext): FibState {
  return applyDecision(state, decideFibCommand(state, command, context));
}

function viewingState(): FibState {
  let state = fibEngine.createInitialState({ numberOfPlayers: 4 }, CREATE_CONTEXT);
  state = dispatch(
    state,
    { type: 'room.seat.take', seat: 0, profile: { displayName: 'host' } },
    user('host'),
  );
  state = dispatch(
    state,
    { type: 'room.seat.take', seat: 1, profile: { displayName: 'guest' } },
    user('guest'),
  );
  state = dispatch(state, { type: 'room.seat.fillBots' }, user('host'));
  state = dispatch(state, { type: 'fibking.round.start' }, user('host'));
  if (state.phase !== 'preparing') throw new Error('Expected preparing state');
  const { roundId } = state.pendingRound;
  state = dispatch(
    state,
    {
      type: 'fibking.round.updatePreparationStage',
      roundId,
      stage: FIB_PREPARATION_STAGES.selecting,
    },
    system(),
  );
  state = dispatch(
    state,
    {
      type: 'fibking.round.updatePreparationStage',
      roundId,
      stage: FIB_PREPARATION_STAGES.finalizing,
    },
    system(),
  );
  state = dispatch(
    state,
    {
      type: 'fibking.round.complete',
      roundId,
      word: '云朵',
      definition: {
        coreMeaning: '悬浮在空中的水滴或冰晶集合。',
        usageNote: '常用于说明该词所指事物的具体含义和适用语境。',
      },
      source: 'local',
    },
    system(),
  );
  if (state.phase !== 'viewing') throw new Error('Expected viewing state');
  return state;
}

describeBotTakeoverResolution({
  game: 'fibking',
  hostUserId: 'host',
  hostSeat: 0,
  guestUserId: 'guest',
  guestSeat: 1,
  botSeat: 2,
  systemActorReason: REASON_USER_ACTOR_REQUIRED,
  unseatedReason: REASON_NOT_SEATED,
  makeSession() {
    const state = viewingState();
    return {
      probe(actor: ActingSeatProbeActor): ActingSeatProbe {
        const context: CommandContext =
          actor.kind === 'system' ? system() : user(actor.userId, actor.controlledSeat);
        const decision = decideFibCommand(
          state,
          { type: 'fibking.round.confirmRoleView' },
          context,
        );
        if (decision.kind === 'reject') return { kind: 'rejected', reason: decision.reason };
        const event = decision.events.find(
          (entry): entry is Extract<typeof entry, { type: 'fibking.role.viewed' }> =>
            entry.type === 'fibking.role.viewed',
        );
        if (event === undefined) throw new Error('Confirm commit carried no viewed event');
        return { kind: 'resolved', seat: event.seat };
      },
    };
  },
});
