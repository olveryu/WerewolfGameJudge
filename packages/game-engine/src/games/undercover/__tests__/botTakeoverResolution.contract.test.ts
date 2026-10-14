/**
 * Bot Takeover Resolution — undercover scenario (bot wave PR-2).
 *
 * Runs the shared acting-seat propositions against the real
 * undercover engine. The probe command is undercover.round.confirm
 * in the viewing phase, whose commit event names the seat that
 * confirmed. Layout: host at seat 0, a human guest at seat 1, bots
 * filling seats 2-7.
 */

import type { CommandContext } from '../../../platform/engine';
import { dispatchCommand } from '../../../platform/engine/__tests__/engineSession';
import { REASON_NOT_SEATED, REASON_USER_ACTOR_REQUIRED } from '../../../platform/protocol/reasons';
import {
  type ActingSeatProbe,
  type ActingSeatProbeActor,
  describeBotTakeoverResolution,
} from '../../../platform/room/__tests__/actingSeatScenarios';
import type { UndercoverCommand } from '../commands/types';
import { undercoverEngine } from '../engine';
import type { UndercoverState } from '../state/types';

const CONFIG = { numberOfPlayers: 8, hasBlank: true, category: 'all' } as const;

function user(userId: string, controlledSeat: number | null = null): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat,
    commandId: 'probe',
    randomSeed: 'takeover-resolution',
    nowMs: 1000,
  };
}

function system(): CommandContext {
  return {
    actor: { kind: 'system', effectId: 'word-selection' },
    controlledSeat: null,
    commandId: 'complete',
    randomSeed: 'takeover-resolution',
    nowMs: 1200,
  };
}

function viewingState(): UndercoverState {
  let state = undercoverEngine.createInitialState(CONFIG, {
    roomCode: '1234',
    hostUserId: 'host',
    nowMs: 0,
    commandId: 'create',
  });
  const dispatch = (command: UndercoverCommand, context: CommandContext) =>
    dispatchCommand(undercoverEngine, state, command, context);
  state = dispatch(
    { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } },
    user('host'),
  );
  state = dispatch(
    { type: 'room.seat.take', seat: 1, profile: { displayName: 'Guest' } },
    user('guest'),
  );
  state = dispatch({ type: 'room.seat.fillBots' }, user('host'));
  state = dispatch({ type: 'undercover.round.start', shouldAllowRepeated: false }, user('host'));
  if (state.phase !== 'preparing') throw new Error('Expected preparing state');
  state = dispatch(
    {
      type: 'undercover.round.complete',
      roundId: state.pendingRound.roundId,
      wordPair: { id: 'pair-1', wordA: 'Milk', wordB: 'Soy milk', category: 'food' },
    },
    system(),
  );
  if (state.phase !== 'viewing' || state.round === null) throw new Error('Expected viewing state');
  return state;
}

describeBotTakeoverResolution({
  game: 'undercover',
  hostUserId: 'host',
  hostSeat: 0,
  guestUserId: 'guest',
  guestSeat: 1,
  botSeat: 2,
  systemActorReason: REASON_USER_ACTOR_REQUIRED,
  unseatedReason: REASON_NOT_SEATED,
  makeSession() {
    const state = viewingState();
    const roundId = state.round!.roundId;
    return {
      probe(actor: ActingSeatProbeActor): ActingSeatProbe {
        const context: CommandContext =
          actor.kind === 'system'
            ? { ...system(), commandId: 'probe' }
            : user(actor.userId, actor.controlledSeat);
        const decision = undercoverEngine.decide(
          state,
          { type: 'undercover.round.confirm', roundId },
          context,
        );
        if (decision.kind === 'reject') return { kind: 'rejected', reason: decision.reason };
        const event = decision.events.find(
          (entry): entry is Extract<typeof entry, { type: 'undercover.round.confirmed' }> =>
            entry.type === 'undercover.round.confirmed',
        );
        if (event === undefined) throw new Error('Confirm commit carried no confirmed event');
        return { kind: 'resolved', seat: event.seat };
      },
    };
  },
});
