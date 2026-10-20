/** Lobby-only DrawGuess seating over the shared room-command skeleton. */

import { type CommandContext, reject } from '../../../platform/engine';
import { decideRoomCommands } from '../../../platform/room/roomCommands';
import type { DrawGuessCommand } from '../commands/types';
import { type DrawGuessState, isValidDrawGuessConfig } from '../state/types';
import { commitDrawGuess, DRAWGUESS_REASONS, type DrawGuessDecision } from './decision';

type RoomCommand = Extract<
  DrawGuessCommand,
  { readonly type: `room.${string}` | 'drawguess.config.update' }
>;

/** Decides lobby and profile changes with authenticated ownership. */
export function decideDrawGuessRoom(
  state: DrawGuessState,
  command: RoomCommand,
  context: CommandContext,
): DrawGuessDecision {
  return decideRoomCommands({
    facts: {
      roster: state.roster,
      seatCount: state.config.numberOfPlayers,
      hostUserId: state.hostUserId,
    },
    command,
    context,
    options: {
      lobbyRejection: state.phase.kind !== 'lobby' ? reject(DRAWGUESS_REASONS.phase) : null,
      phaseReason: DRAWGUESS_REASONS.phase,
      configReason: DRAWGUESS_REASONS.config,
      occupiedReason: DRAWGUESS_REASONS.occupied,
      profileLanding: { kind: 'rosterChange' },
      resolveConfigFacts: (resolved) =>
        resolved.type === 'drawguess.config.update'
          ? {
              invalidReason: isValidDrawGuessConfig(resolved.config)
                ? null
                : DRAWGUESS_REASONS.config,
              newSeatCount: resolved.config.numberOfPlayers,
              buildEvent: () => ({
                type: 'drawguess.config.updated',
                config: { ...resolved.config },
              }),
            }
          : null,
      buildSeatsChangedEvent: (changes) => ({ type: 'drawguess.seats.changed', changes }),
      commit: commitDrawGuess,
    },
  });
}
