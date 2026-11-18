/** Lobby-only Secrethitler seating over the shared room-command skeleton. */

import { type CommandContext, reject } from '../../../platform/engine';
import { decideRoomCommands } from '../../../platform/room/roomCommands';
import type { SecrethitlerCommand } from '../commands/types';
import { isValidSecrethitlerConfig, type SecrethitlerState } from '../state/types';
import { commitSecrethitler, SECRETHITLER_REASONS, type SecrethitlerDecision } from './decision';

type RoomCommand = Extract<
  SecrethitlerCommand,
  { readonly type: `room.${string}` | 'secrethitler.config.update' }
>;

/** Decides lobby and profile changes with authenticated ownership. */
export function decideSecrethitlerRoom(
  state: SecrethitlerState,
  command: RoomCommand,
  context: CommandContext,
): SecrethitlerDecision {
  return decideRoomCommands({
    facts: {
      roster: state.roster,
      seatCount: state.config.numberOfPlayers,
      hostUserId: state.hostUserId,
    },
    command,
    context,
    options: {
      lobbyRejection: state.phase.kind !== 'lobby' ? reject(SECRETHITLER_REASONS.phase) : null,
      phaseReason: SECRETHITLER_REASONS.phase,
      configReason: SECRETHITLER_REASONS.config,
      occupiedReason: SECRETHITLER_REASONS.occupied,
      profileLanding: { kind: 'rosterChange' },
      resolveConfigFacts: (resolved) =>
        resolved.type === 'secrethitler.config.update'
          ? {
              invalidReason: isValidSecrethitlerConfig(resolved.config)
                ? null
                : SECRETHITLER_REASONS.config,
              newSeatCount: resolved.config.numberOfPlayers,
              buildEvent: () => ({
                type: 'secrethitler.config.updated',
                config: { ...resolved.config },
              }),
            }
          : null,
      buildSeatsChangedEvent: (changes) => ({ type: 'secrethitler.seats.changed', changes }),
      commit: commitSecrethitler,
    },
  });
}
