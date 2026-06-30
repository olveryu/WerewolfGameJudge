/**
 * buildInitialFibState — the fibking Factory (createInitialState).
 *
 * Server-authoritative: builds a fresh Lobby state from a validated config + create context.
 * Seats start empty; host joins via a SIT action like any other player.
 */

import type { CreateCtx } from '../engine/registry/types';
import { emptySeats } from './reducer';
import type { FibConfig, FibState } from './types';
import { FIB_GAME_TYPE } from './types';

export function buildInitialFibState(config: FibConfig, ctx: CreateCtx): FibState {
  return {
    gameType: FIB_GAME_TYPE,
    roomCode: ctx.roomCode,
    hostUserId: ctx.hostUserId,
    phase: 'Lobby',
    numberOfPlayers: config.numberOfPlayers,
    seats: emptySeats(config.numberOfPlayers),
    roster: {},
    usedWords: [],
  };
}
