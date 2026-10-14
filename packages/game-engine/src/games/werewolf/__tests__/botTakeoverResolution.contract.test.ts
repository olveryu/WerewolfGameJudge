/**
 * Bot Takeover Resolution — werewolf scenario (bot wave PR-2).
 *
 * Runs the shared acting-seat propositions against the real
 * werewolf engine. Werewolf's resolver is the shared one composed
 * behind its two state-model gates (a controlled seat outside the
 * players map is invalid; a seat with no roster occupant is empty);
 * neither gate can trigger in this layout, so the shared
 * propositions apply verbatim. The probe command is
 * werewolf.role.view in the Assigned status; a commit is applied
 * and the seat whose viewed flag flipped names the acting seat.
 * Layout: host at seat 0, a human guest at seat 1, a bot at seat 2.
 */

import type { CommandContext } from '../../../platform/engine';
import { REASON_NOT_SEATED, REASON_USER_ACTOR_REQUIRED } from '../../../platform/protocol/reasons';
import {
  type ActingSeatProbe,
  type ActingSeatProbeActor,
  describeBotTakeoverResolution,
} from '../../../platform/room/__tests__/actingSeatScenarios';
import type { WerewolfCommand } from '../commands/types';
import type { GameState } from '../domain/protocol/types';
import { werewolfEngine } from '../engine';

function user(userId: string, controlledSeat: number | null = null): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat,
    nowMs: 1_000,
    commandId: 'command-1',
    randomSeed: 'seed-1',
  };
}

function evolveCommitted(state: GameState, command: WerewolfCommand, context: CommandContext) {
  const decision = werewolfEngine.decide(state, command, context);
  if (decision.kind === 'reject') {
    throw new Error(`Expected command commit, received ${decision.reason}`);
  }
  return decision.events.reduce(werewolfEngine.evolve, state);
}

function assignedState(): GameState {
  let state = werewolfEngine.createInitialState(
    {
      templateRoles: ['wolf', 'seer', 'villager'],
      rules: { isSheriffElectionEnabled: false },
    },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1, commandId: 'create' },
  );
  state = evolveCommitted(
    state,
    { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } },
    user('host'),
  );
  state = evolveCommitted(
    state,
    { type: 'room.seat.take', seat: 1, profile: { displayName: 'Guest' } },
    user('guest'),
  );
  state = evolveCommitted(state, { type: 'room.seat.fillBots' }, user('host'));
  state = evolveCommitted(state, { type: 'werewolf.roles.assign' }, user('host'));
  return state;
}

describeBotTakeoverResolution({
  game: 'werewolf',
  hostUserId: 'host',
  hostSeat: 0,
  guestUserId: 'guest',
  guestSeat: 1,
  botSeat: 2,
  systemActorReason: REASON_USER_ACTOR_REQUIRED,
  unseatedReason: REASON_NOT_SEATED,
  makeSession() {
    const state = assignedState();
    return {
      probe(actor: ActingSeatProbeActor): ActingSeatProbe {
        const context: CommandContext =
          actor.kind === 'system'
            ? {
                actor: { kind: 'system', effectId: 'effect-1' },
                controlledSeat: null,
                nowMs: 1_000,
                commandId: 'command-1',
                randomSeed: 'seed-1',
              }
            : user(actor.userId, actor.controlledSeat);
        const decision = werewolfEngine.decide(state, { type: 'werewolf.role.view' }, context);
        if (decision.kind === 'reject') return { kind: 'rejected', reason: decision.reason };
        const next = decision.events.reduce(werewolfEngine.evolve, state);
        for (const player of Object.values(next.players)) {
          if (
            player !== null &&
            player.hasViewedRole &&
            !state.players[player.seat]?.hasViewedRole
          ) {
            return { kind: 'resolved', seat: player.seat };
          }
        }
        throw new Error('Role view commit flipped no viewed flag');
      },
    };
  },
});
