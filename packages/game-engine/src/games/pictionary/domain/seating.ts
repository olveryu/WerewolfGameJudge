/** Lobby-only Pictionary seating over the shared room-command skeleton. */

import { type CommandContext, reject } from '../../../platform/engine';
import { REASON_GAME_IN_PROGRESS } from '../../../platform/protocol/reasons';
import { decideRoomCommands } from '../../../platform/room/roomCommands';
import type { PictionaryCommand } from '../commands/types';
import { isValidPictionaryConfig, type PictionaryState } from '../state/types';
import { commitPictionary, type PictionaryDecision } from './decision';
import {
  REASON_PICTIONARY_CONFIG_INVALID,
  REASON_PICTIONARY_OCCUPIED_SEAT_OUT_OF_RANGE,
} from './reasons';

type RoomCommand = Extract<
  PictionaryCommand,
  { readonly type: `room.${string}` | 'pictionary.config.update' }
>;

/** Decides lobby and profile changes with authenticated ownership. */
export function decidePictionaryRoom(
  state: PictionaryState,
  command: RoomCommand,
  context: CommandContext,
): PictionaryDecision {
  return decideRoomCommands({
    facts: {
      roster: state.roster,
      seatCount: state.config.numberOfPlayers,
      hostUserId: state.hostUserId,
    },
    command,
    context,
    options: {
      lobbyRejection: state.phase === 'lobby' ? null : reject(REASON_GAME_IN_PROGRESS),
      phaseReason: REASON_GAME_IN_PROGRESS,
      configReason: REASON_PICTIONARY_CONFIG_INVALID,
      occupiedReason: REASON_PICTIONARY_OCCUPIED_SEAT_OUT_OF_RANGE,
      profileLanding: {
        kind: 'event',
        buildEvent: (seat, profile) => ({
          type: 'pictionary.profile.updated',
          seat,
          profile: { ...profile },
        }),
      },
      resolveConfigFacts: (resolved) =>
        resolved.type === 'pictionary.config.update'
          ? {
              invalidReason: isValidPictionaryConfig(resolved.config)
                ? null
                : REASON_PICTIONARY_CONFIG_INVALID,
              newSeatCount: resolved.config.numberOfPlayers,
              buildEvent: () => ({
                type: 'pictionary.config.updated',
                config: resolved.config,
              }),
            }
          : null,
      buildSeatsChangedEvent: (changes) => ({ type: 'pictionary.seats.changed', changes }),
      commit: commitPictionary,
    },
  });
}
