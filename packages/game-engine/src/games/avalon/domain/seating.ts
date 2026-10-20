/** Lobby-only Avalon seating over the shared room-command skeleton. */

import { type CommandContext, reject } from '../../../platform/engine';
import { type Rng, secureRng, shuffleArray } from '../../../platform/random';
import { decideRoomCommands } from '../../../platform/room/roomCommands';
import type { AvalonCommand } from '../commands/types';
import {
  AVALON_BOARDS,
  type AvalonPlayerCount,
  type AvalonRoleId,
  type AvalonState,
  isValidAvalonConfig,
} from '../state/types';
import { AVALON_REASONS, type AvalonDecision, commitAvalon } from './decision';

type RoomCommand = Extract<
  AvalonCommand,
  { readonly type: `room.${string}` | 'avalon.config.update' }
>;

/**
 * 按人数取固定板子并用 Web Crypto 洗牌发牌（seat -> role）。
 * 纯函数；rng 可注入以便测试，默认 secureRng（禁 Math.random）。
 */
export function dealAvalonRoles(
  numberOfPlayers: AvalonPlayerCount,
  rng: Rng = secureRng,
): Readonly<Record<number, AvalonRoleId>> {
  const shuffled = shuffleArray([...AVALON_BOARDS[numberOfPlayers]], rng);
  const roles: Record<number, AvalonRoleId> = {};
  shuffled.forEach((role, seat) => {
    roles[seat] = role;
  });
  return roles;
}

/** Decides lobby and profile changes with authenticated ownership. */
export function decideAvalonRoom(
  state: AvalonState,
  command: RoomCommand,
  context: CommandContext,
): AvalonDecision {
  return decideRoomCommands({
    facts: {
      roster: state.roster,
      seatCount: state.config.numberOfPlayers,
      hostUserId: state.hostUserId,
    },
    command,
    context,
    options: {
      lobbyRejection: state.phase.kind !== 'lobby' ? reject(AVALON_REASONS.phase) : null,
      phaseReason: AVALON_REASONS.phase,
      configReason: AVALON_REASONS.config,
      occupiedReason: AVALON_REASONS.occupied,
      profileLanding: { kind: 'rosterChange' },
      resolveConfigFacts: (resolved) =>
        resolved.type === 'avalon.config.update'
          ? {
              invalidReason: isValidAvalonConfig(resolved.config) ? null : AVALON_REASONS.config,
              newSeatCount: resolved.config.numberOfPlayers,
              buildEvent: () => ({
                type: 'avalon.config.updated',
                config: { ...resolved.config },
              }),
            }
          : null,
      buildSeatsChangedEvent: (changes) => ({ type: 'avalon.seats.changed', changes }),
      commit: commitAvalon,
    },
  });
}
