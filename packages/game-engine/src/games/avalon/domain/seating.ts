/** Lobby-only Avalon seating using shared seat operations; implicit bot seats need no records. */

import {
  type CommandContext,
  reject,
  resolveUncontrolledUserActorId,
} from '../../../platform/engine';
import { REASON_NOT_HOST, REASON_NOT_SEATED } from '../../../platform/protocol/reasons';
import { type Rng, secureRng, shuffleArray } from '../../../platform/random';
import {
  decideClearSeats,
  decideKickSeat,
  decideLeaveSeat,
  decideTakeSeat,
  findSeatByUserId,
  type SeatChange,
} from '../../../platform/room/seating';
import type { AvalonCommand } from '../commands/types';
import {
  AVALON_BOARDS,
  type AvalonHumanSeat,
  type AvalonPlayerCount,
  type AvalonRoleId,
  type AvalonState,
  isAvalonImplicitBotSeat,
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

function seats(
  changes: readonly SeatChange<AvalonHumanSeat>[],
  excludedBotSeats: readonly number[],
  fillEmptySeatsWithBots: boolean,
): AvalonDecision {
  return commitAvalon([
    { type: 'avalon.seats.changed', changes, excludedBotSeats, fillEmptySeatsWithBots },
  ]);
}

function rejectSeatOperation(reason: string): AvalonDecision {
  return reject(reason);
}

/** Decides lobby and profile changes with authenticated ownership and implicit bots. */
export function decideAvalonRoom(
  state: AvalonState,
  command: RoomCommand,
  context: CommandContext,
): AvalonDecision {
  if (command.type === 'room.profile.update') {
    const actor = resolveUncontrolledUserActorId(context);
    if (actor.kind === 'rejected') return reject(actor.reason);
    const seat = findSeatByUserId(state.realSeats, state.config.numberOfPlayers, actor.value);
    if (seat === null) return reject(REASON_NOT_SEATED);
    const occupant = state.realSeats[seat];
    if (occupant === undefined) return reject(REASON_NOT_SEATED);
    return seats(
      [
        {
          seat,
          previous: occupant,
          next: { ...occupant, profile: { ...occupant.profile, ...command.profile } },
        },
      ],
      state.excludedBotSeats,
      state.fillEmptySeatsWithBots,
    );
  }
  if (state.phase.kind !== 'lobby') return reject(AVALON_REASONS.phase);
  if (command.type === 'room.seat.take' || command.type === 'room.seat.leave') {
    const actor = resolveUncontrolledUserActorId(context);
    if (actor.kind === 'rejected') return reject(actor.reason);
    if (command.type === 'room.seat.take' && command.profile.displayName.trim().length === 0)
      return reject(AVALON_REASONS.config);
    const result =
      command.type === 'room.seat.take'
        ? decideTakeSeat(
            state.realSeats,
            state.config.numberOfPlayers,
            command.seat,
            actor.value,
            (seat): AvalonHumanSeat => ({
              seat,
              userId: actor.value,
              profile: { ...command.profile },
            }),
          )
        : decideLeaveSeat(state.realSeats, state.config.numberOfPlayers, actor.value);
    if (result.kind === 'rejected') return rejectSeatOperation(result.reason);
    return seats(
      result.changes,
      command.type === 'room.seat.take'
        ? state.excludedBotSeats.filter((seat) => seat !== command.seat)
        : state.excludedBotSeats,
      state.fillEmptySeatsWithBots,
    );
  }
  const hostRejection = requireAvalonHost(state, context, REASON_NOT_HOST);
  if (hostRejection !== null) return hostRejection;
  switch (command.type) {
    case 'avalon.config.update': {
      if (!isValidAvalonConfig(command.config)) return reject(AVALON_REASONS.config);
      if (
        Object.keys(state.realSeats).some((seat) => Number(seat) >= command.config.numberOfPlayers)
      )
        return reject(AVALON_REASONS.occupied);
      const excludedBotSeats = state.excludedBotSeats.filter(
        (seat) => seat < command.config.numberOfPlayers,
      );
      return commitAvalon([
        { type: 'avalon.config.updated', config: { ...command.config } },
        {
          type: 'avalon.seats.changed',
          changes: [],
          excludedBotSeats,
          fillEmptySeatsWithBots: state.fillEmptySeatsWithBots,
        },
      ]);
    }
    case 'room.seat.fillBots':
      return commitAvalon([
        {
          type: 'avalon.seats.changed',
          changes: [],
          excludedBotSeats: [],
          fillEmptySeatsWithBots: true,
        },
      ]);
    case 'room.seat.kick': {
      if (isAvalonImplicitBotSeat(state, command.seat)) {
        return seats([], [...state.excludedBotSeats, command.seat], state.fillEmptySeatsWithBots);
      }
      const result = decideKickSeat(state.realSeats, state.config.numberOfPlayers, command.seat);
      if (result.kind === 'rejected') return rejectSeatOperation(result.reason);
      return seats(result.changes, state.excludedBotSeats, state.fillEmptySeatsWithBots);
    }
    case 'room.seat.clear': {
      const result = decideClearSeats(state.realSeats, state.config.numberOfPlayers);
      if (result.kind === 'rejected') return rejectSeatOperation(result.reason);
      return seats(result.changes, [], false);
    }
    default:
      return reject(AVALON_REASONS.phase);
  }
}
