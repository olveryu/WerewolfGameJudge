/** Lobby-only Spotmatch seating over the shared room-command skeleton. */

import { type CommandContext, reject } from '../../../platform/engine';
import { decideRoomCommands } from '../../../platform/room/roomCommands';
import type { SpotmatchCommand } from '../commands/types';
import { isValidSpotmatchConfig, type SpotmatchState } from '../state/types';
import { commitSpotmatch, SPOTMATCH_REASONS, type SpotmatchDecision } from './decision';

type RoomCommand = Extract<
  SpotmatchCommand,
  { readonly type: `room.${string}` | 'spotmatch.config.update' }
>;

/** Decides lobby and profile changes with authenticated ownership. */
export function decideSpotmatchRoom(
  state: SpotmatchState,
  command: RoomCommand,
  context: CommandContext,
): SpotmatchDecision {
  return decideRoomCommands({
    facts: {
      roster: state.roster,
      seatCount: state.config.numberOfPlayers,
      hostUserId: state.hostUserId,
    },
    command,
    context,
    options: {
      lobbyRejection: state.phase.kind !== 'lobby' ? reject(SPOTMATCH_REASONS.phase) : null,
      phaseReason: SPOTMATCH_REASONS.phase,
      configReason: SPOTMATCH_REASONS.config,
      occupiedReason: SPOTMATCH_REASONS.occupied,
      profileLanding: { kind: 'rosterChange' },
      resolveConfigFacts: (resolved) =>
        resolved.type === 'spotmatch.config.update'
          ? {
              invalidReason: isValidSpotmatchConfig(resolved.config)
                ? null
                : SPOTMATCH_REASONS.config,
              newSeatCount: resolved.config.numberOfPlayers,
              buildEvent: () => ({
                type: 'spotmatch.config.updated',
                config: { ...resolved.config },
              }),
            }
          : null,
      buildSeatsChangedEvent: (changes) => ({ type: 'spotmatch.seats.changed', changes }),
      commit: commitSpotmatch,
    },
  });
}
