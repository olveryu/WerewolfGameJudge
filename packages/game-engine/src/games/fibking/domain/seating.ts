/** Lobby-only FibKing seating over the shared room-command skeleton. */

import { type CommandContext, reject } from '../../../platform/engine';
import { REASON_GAME_IN_PROGRESS } from '../../../platform/protocol/reasons';
import { decideRoomCommands } from '../../../platform/room/roomCommands';
import type { FibCommand } from '../commands/types';
import { type FibState, isValidFibPlayerCount } from '../state/types';
import { commitFib, type FibDecision } from './decision';
import { REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE, REASON_FIB_PLAYER_COUNT_INVALID } from './reasons';

type RoomCommand = Extract<
  FibCommand,
  { readonly type: `room.${string}` | 'fibking.config.update' }
>;

/** Decides lobby and profile changes with authenticated ownership. */
export function decideFibRoom(
  state: FibState,
  command: RoomCommand,
  context: CommandContext,
): FibDecision {
  return decideRoomCommands({
    facts: {
      roster: state.roster,
      seatCount: state.numberOfPlayers,
      hostUserId: state.hostUserId,
    },
    command,
    context,
    options: {
      lobbyRejection: state.phase === 'lobby' ? null : reject(REASON_GAME_IN_PROGRESS),
      phaseReason: REASON_GAME_IN_PROGRESS,
      configReason: REASON_FIB_PLAYER_COUNT_INVALID,
      occupiedReason: REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE,
      profileLanding: {
        kind: 'event',
        buildEvent: (seat, profile) => ({
          type: 'fibking.profile.updated',
          seat,
          profile: { ...profile },
        }),
      },
      resolveConfigFacts: (resolved) =>
        resolved.type === 'fibking.config.update'
          ? {
              invalidReason: isValidFibPlayerCount(resolved.numberOfPlayers)
                ? null
                : REASON_FIB_PLAYER_COUNT_INVALID,
              newSeatCount: resolved.numberOfPlayers,
              isNoop: resolved.numberOfPlayers === state.numberOfPlayers,
              buildEvent: () => ({
                type: 'fibking.config.updated',
                numberOfPlayers: resolved.numberOfPlayers,
              }),
            }
          : null,
      buildSeatsChangedEvent: (changes) => ({ type: 'fibking.seats.changed', changes }),
      commit: commitFib,
    },
  });
}
