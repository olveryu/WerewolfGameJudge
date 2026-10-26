/** Lobby-only Undercover seating over the shared room-command skeleton. */

import { type CommandContext, reject } from '../../../platform/engine';
import { decideRoomCommands } from '../../../platform/room/roomCommands';
import type { UndercoverPublicCommand } from '../commands/types';
import { isValidUndercoverConfig, type UndercoverState } from '../state/types';
import { commitUndercover, UNDERCOVER_REASONS, type UndercoverDecision } from './decision';

type RoomCommand = Extract<
  UndercoverPublicCommand,
  { readonly type: `room.${string}` | 'undercover.config.update' }
>;

/** Decides shared room and configuration commands with game-specific lobby gates. */
export function decideUndercoverRoom(
  state: UndercoverState,
  command: RoomCommand,
  context: CommandContext,
): UndercoverDecision {
  return decideRoomCommands({
    facts: {
      roster: state.roster,
      seatCount: state.config.numberOfPlayers,
      hostUserId: state.hostUserId,
    },
    command,
    context,
    options: {
      lobbyRejection: state.phase !== 'lobby' ? reject(UNDERCOVER_REASONS.phase) : null,
      phaseReason: UNDERCOVER_REASONS.phase,
      configReason: UNDERCOVER_REASONS.config,
      occupiedReason: UNDERCOVER_REASONS.occupied,
      profileLanding: { kind: 'rosterChange' },
      resolveConfigFacts: (resolved) =>
        resolved.type === 'undercover.config.update'
          ? {
              invalidReason: isValidUndercoverConfig(resolved.config)
                ? null
                : UNDERCOVER_REASONS.config,
              newSeatCount: resolved.config.numberOfPlayers,
              buildEvent: () => ({
                type: 'undercover.config.updated',
                config: { ...resolved.config },
              }),
            }
          : null,
      buildSeatsChangedEvent: (changes) => ({ type: 'undercover.seats.changed', changes }),
      commit: commitUndercover,
    },
  });
}
