/** Spotmatch per-seat view model: the stage projection every client renders from. */

import { getBotDisplayName } from '../../../platform/room/getBotDisplayName';
import { buildSeatIdentityView } from '../../../platform/room/seatIdentity';
import {
  getSpotmatchUserSeat,
  isSpotmatchOccupiedSeat,
  type SpotmatchPhaseKind,
  type SpotmatchState,
} from '../state/types';
import type { SpotmatchCard } from './cards';

export interface SpotmatchSeatView {
  readonly seat: number;
  readonly displayName: string;
  readonly isBot: boolean;
  readonly remaining: number | null;
  readonly correct: number;
  readonly mistakes: number;
  readonly rank: number | null;
}

export interface SpotmatchViewModel {
  readonly phase: SpotmatchPhaseKind;
  readonly mySeat: number | null;
  readonly seats: readonly SpotmatchSeatView[];
  readonly central: SpotmatchCard | null;
  readonly ownTop: SpotmatchCard | null;
  readonly lockedUntil: number;
}

/**
 * Builds the view model for one viewer.
 * @param viewerSeat Seat of the viewer; null for spectators without a seat.
 */
export function getSpotmatchViewModel(
  state: SpotmatchState,
  viewerSeat: number | null,
): SpotmatchViewModel {
  const seats: SpotmatchSeatView[] = [];
  for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
    if (!isSpotmatchOccupiedSeat(state, seat)) continue;
    const player = state.round?.players.find((entry) => entry.seat === seat);
    seats.push({
      ...buildSeatIdentityView(state.roster, seat, getBotDisplayName),
      remaining: player?.remaining ?? null,
      correct: player?.correct ?? 0,
      mistakes: player?.mistakes ?? 0,
      rank:
        player === undefined || state.phase.kind !== 'ended'
          ? null
          : 1 +
            (state.round?.players.filter((entry) => entry.remaining < player.remaining).length ??
              0),
    });
  }
  return {
    phase: state.phase.kind,
    mySeat: viewerSeat,
    seats,
    central: state.round?.central ?? null,
    ownTop: state.round?.players.find((player) => player.seat === viewerSeat)?.top ?? null,
    lockedUntil:
      state.round?.players.find((player) => player.seat === viewerSeat)?.lockedUntil ?? 0,
  };
}

/** Transport projection, applied before both realtime and HTTP serialization. */
export function projectSpotmatchStateForUser(
  state: SpotmatchState,
  userId: string,
): SpotmatchState {
  if (state.round === null) return state;
  const ownSeat = getSpotmatchUserSeat(state, userId);
  return {
    ...state,
    round: {
      ...state.round,
      players: state.round.players.map((player) => ({
        ...player,
        lastMistake:
          player.seat === ownSeat || (userId === state.hostUserId && player.isBot)
            ? player.lastMistake
            : null,
        top:
          player.seat === ownSeat || (userId === state.hostUserId && player.isBot)
            ? player.top
            : null,
      })),
    },
  };
}
