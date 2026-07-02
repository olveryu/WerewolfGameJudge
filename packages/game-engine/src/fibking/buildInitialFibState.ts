/**
 * buildInitialFibState — the fibking Factory (createInitialState).
 *
 * Server-authoritative: builds a fresh Lobby state from a validated config + create context.
 * Seats start empty; host joins via a SIT action like any other player.
 */

import type { CreateCtx } from '../engine/registry/types';
import { FIB_GAME_TYPE } from '../protocol/gameTypes';
import { emptySeats } from './reducer';
import type { FibConfig, FibState } from './types';
import { FIB_MIN_PLAYERS } from './types';

export function buildInitialFibState(config: FibConfig, ctx: CreateCtx): FibState {
  if (!Number.isInteger(config.numberOfPlayers) || config.numberOfPlayers < FIB_MIN_PLAYERS) {
    throw new Error(`buildInitialFibState: numberOfPlayers must be >= ${FIB_MIN_PLAYERS}`);
  }

  return {
    gameType: FIB_GAME_TYPE,
    roomCode: ctx.roomCode,
    hostUserId: ctx.hostUserId,
    phase: 'Lobby',
    numberOfPlayers: config.numberOfPlayers,
    seats: emptySeats(),
    roster: {},
    usedWords: [],
  };
}
