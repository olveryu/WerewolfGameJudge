/**
 * Bot Takeover Resolution — avalon scenario (bot wave PR-2).
 *
 * Runs the shared acting-seat propositions against the real avalon
 * engine. The probe command is avalon.role.viewed in the viewing
 * stage, whose commit event names the seat that viewed. Layout:
 * host at seat 0, a human guest at seat 1, bots at seats 2-4.
 */

import type { CommandContext } from '../../../platform/engine';
import { dispatchCommand } from '../../../platform/engine/__tests__/engineSession';
import { REASON_NOT_SEATED, REASON_USER_ACTOR_REQUIRED } from '../../../platform/protocol/reasons';
import {
  type ActingSeatProbe,
  type ActingSeatProbeActor,
  describeBotTakeoverResolution,
} from '../../../platform/room/__tests__/actingSeatScenarios';
import type { AvalonCommand } from '../commands/types';
import { avalonEngine } from '../engine';
import { type AvalonState, DEFAULT_AVALON_CONFIG } from '../state/types';

function user(userId: string, controlledSeat: number | null = null): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat,
    nowMs: 1000,
    commandId: 'probe',
    randomSeed: 'takeover-resolution',
  };
}

function viewingState(): AvalonState {
  let state: AvalonState = avalonEngine.createInitialState(DEFAULT_AVALON_CONFIG, {
    roomCode: '1234',
    hostUserId: 'host',
    nowMs: 1000,
    commandId: 'create',
  });
  const dispatch = (command: AvalonCommand, context: CommandContext) => {
    state = dispatchCommand(avalonEngine, state, command, context);
    return state;
  };
  dispatch({ type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } }, user('host'));
  dispatch({ type: 'room.seat.take', seat: 1, profile: { displayName: 'Guest' } }, user('guest'));
  dispatch({ type: 'room.seat.fillBots' }, user('host'));
  dispatch({ type: 'avalon.game.start' }, user('host'));
  if (state.phase.kind !== 'viewing') throw new Error('Expected viewing stage');
  return state;
}

describeBotTakeoverResolution({
  game: 'avalon',
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
          actor.kind === 'system'
            ? {
                actor: { kind: 'system', effectId: 'probe' },
                controlledSeat: null,
                nowMs: 1000,
                commandId: 'probe',
                randomSeed: 'takeover-resolution',
              }
            : user(actor.userId, actor.controlledSeat);
        const decision = avalonEngine.decide(state, { type: 'avalon.role.viewed' }, context);
        if (decision.kind === 'reject') return { kind: 'rejected', reason: decision.reason };
        const event = decision.events.find(
          (entry): entry is Extract<typeof entry, { type: 'avalon.role.viewed' }> =>
            entry.type === 'avalon.role.viewed',
        );
        if (event === undefined) throw new Error('View commit carried no viewed event');
        return { kind: 'resolved', seat: event.seat };
      },
    };
  },
});
