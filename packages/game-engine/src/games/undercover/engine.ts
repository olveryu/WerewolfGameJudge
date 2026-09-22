/** Authoritative Undercover engine; no IO, platform effects select approved word pairs. */

import type {
  CommandContext,
  CommonGameLifecycle,
  CreateGameContext,
  GameEngineDefinition,
} from '../../platform/engine';
import type { UndercoverCommand } from './commands/types';
import type { UndercoverDecision } from './domain/decision';
import type { UndercoverEffect, UndercoverEvent } from './domain/events';
import { evolveUndercoverState } from './domain/evolve';
import { decideUndercoverRound } from './domain/round';
import { decideUndercoverRoom } from './domain/seating';
import { normalizeUndercoverState } from './state/normalize';
import {
  UNDERCOVER_STATE_VERSION,
  type UndercoverConfig,
  type UndercoverState,
} from './state/types';

function createInitialState(config: UndercoverConfig, context: CreateGameContext): UndercoverState {
  return normalizeUndercoverState({
    gameType: 'undercover',
    stateVersion: UNDERCOVER_STATE_VERSION,
    roomCode: context.roomCode,
    hostUserId: context.hostUserId,
    config: { ...config },
    realSeats: {},
    botSeats: [],
    usedWordPairIds: [],
    phase: 'lobby',
    round: null,
  });
}

function decide(
  state: UndercoverState,
  command: UndercoverCommand,
  context: CommandContext,
): UndercoverDecision {
  switch (command.type) {
    case 'room.seat.take':
    case 'room.seat.leave':
    case 'room.seat.kick':
    case 'room.seat.clear':
    case 'room.seat.fillBots':
    case 'room.profile.update':
    case 'undercover.config.update':
    case 'undercover.bots.clear':
      return decideUndercoverRoom(state, command, context);
    default:
      return decideUndercoverRound(state, command, context);
  }
}

function getLifecycle(state: UndercoverState): CommonGameLifecycle {
  switch (state.phase) {
    case 'lobby':
      return 'setup';
    case 'ended':
    case 'aborted':
      return 'ended';
    case 'preparing':
    case 'preparationFailed':
    case 'reading':
    case 'ongoing':
      return 'ongoing';
  }
}

export const undercoverEngine = {
  gameType: 'undercover',
  stateVersion: UNDERCOVER_STATE_VERSION,
  createInitialState,
  decide,
  evolve: evolveUndercoverState,
  normalize: normalizeUndercoverState,
  getLifecycle,
} satisfies GameEngineDefinition<
  'undercover',
  UndercoverState,
  UndercoverConfig,
  UndercoverCommand,
  UndercoverEvent,
  UndercoverEffect
>;

export type UndercoverEngine = typeof undercoverEngine;
