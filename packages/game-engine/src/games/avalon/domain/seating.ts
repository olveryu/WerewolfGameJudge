/** Lobby-only Avalon seating using the shared roster decisions. */

import {
  type CommandContext,
  reject,
  resolveUncontrolledUserActorId,
} from '../../../platform/engine';
import { REASON_NOT_HOST, REASON_NOT_SEATED } from '../../../platform/protocol/reasons';
import { type Rng, secureRng, shuffleArray } from '../../../platform/random';
import {
  decideRosterClearSeats,
  decideRosterFillBots,
  decideRosterKickSeat,
  decideRosterLeaveSeat,
  decideRosterTakeSeat,
  findRosterSeatByUserId,
  hasOccupantAtOrBeyond,
  isBotOccupant,
  type RosterChange,
} from '../../../platform/room/seating';
import type { AvalonCommand } from '../commands/types';
import {
  AVALON_BOARDS,
  type AvalonHumanSeat,
  type AvalonPlayerCount,
  type AvalonRoleId,
  type AvalonState,
  isValidAvalonConfig,
} from '../state/types';
import { AVALON_REASONS, type AvalonDecision, commitAvalon, requireAvalonHost } from './decision';

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

function seats(changes: readonly RosterChange<AvalonHumanSeat>[]): AvalonDecision {
  return commitAvalon([{ type: 'avalon.seats.changed', changes }]);
}

function rejectSeatOperation(reason: string): AvalonDecision {
  return reject(reason);
}

/** Decides lobby and profile changes with authenticated ownership. */
export function decideAvalonRoom(
  state: AvalonState,
  command: RoomCommand,
  context: CommandContext,
): AvalonDecision {
  if (command.type === 'room.profile.update') {
    const actor = resolveUncontrolledUserActorId(context);
    if (actor.kind === 'rejected') return reject(actor.reason);
    const seat = findRosterSeatByUserId(state.roster, state.config.numberOfPlayers, actor.value);
    if (seat === null) return reject(REASON_NOT_SEATED);
    const occupant = state.roster[seat];
    if (occupant == null || isBotOccupant(occupant)) return reject(REASON_NOT_SEATED);
    return seats([
      {
        seat,
        previous: occupant,
        next: { ...occupant, profile: { ...occupant.profile, ...command.profile } },
      },
    ]);
  }
  if (state.phase.kind !== 'lobby') return reject(AVALON_REASONS.phase);
  if (command.type === 'room.seat.take' || command.type === 'room.seat.leave') {
    const actor = resolveUncontrolledUserActorId(context);
    if (actor.kind === 'rejected') return reject(actor.reason);
    if (command.type === 'room.seat.take' && command.profile.displayName.trim().length === 0)
      return reject(AVALON_REASONS.config);
    const result =
      command.type === 'room.seat.take'
        ? decideRosterTakeSeat(
            state.roster,
            state.config.numberOfPlayers,
            command.seat,
            actor.value,
            (seat): AvalonHumanSeat => ({
              seat,
              userId: actor.value,
              profile: { ...command.profile },
            }),
          )
        : decideRosterLeaveSeat(state.roster, state.config.numberOfPlayers, actor.value);
    if (result.kind === 'rejected') return rejectSeatOperation(result.reason);
    return seats(result.changes);
  }
  const hostRejection = requireAvalonHost(state, context, REASON_NOT_HOST);
  if (hostRejection !== null) return hostRejection;
  switch (command.type) {
    case 'avalon.config.update': {
      if (!isValidAvalonConfig(command.config)) return reject(AVALON_REASONS.config);
      if (hasOccupantAtOrBeyond(state.roster, command.config.numberOfPlayers))
        return reject(AVALON_REASONS.occupied);
      return commitAvalon([{ type: 'avalon.config.updated', config: { ...command.config } }]);
    }
    case 'room.seat.fillBots': {
      const result = decideRosterFillBots(state.roster, state.config.numberOfPlayers);
      return result.kind === 'rejected'
        ? rejectSeatOperation(result.reason)
        : seats(result.changes);
    }
    case 'room.seat.kick': {
      const result = decideRosterKickSeat(state.roster, state.config.numberOfPlayers, command.seat);
      return result.kind === 'rejected'
        ? rejectSeatOperation(result.reason)
        : seats(result.changes);
    }
    case 'room.seat.clear': {
      const result = decideRosterClearSeats(state.roster, state.config.numberOfPlayers);
      return result.kind === 'rejected'
        ? rejectSeatOperation(result.reason)
        : seats(result.changes);
    }
    default:
      return reject(AVALON_REASONS.phase);
  }
}
