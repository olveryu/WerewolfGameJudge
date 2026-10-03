/** Lobby-only DrawGuess seating using shared seat operations; implicit bot seats need no records. */

import {
  type CommandContext,
  reject,
  resolveUncontrolledUserActorId,
} from '../../../platform/engine';
import { REASON_NOT_SEATED } from '../../../platform/protocol/reasons';
import {
  decideClearSeats,
  decideKickSeat,
  decideLeaveSeat,
  decideTakeSeat,
  findSeatByUserId,
  type SeatChange,
} from '../../../platform/room/seating';
import type { DrawGuessCommand } from '../commands/types';
import {
  type DrawGuessHumanSeat,
  type DrawGuessState,
  isDrawGuessImplicitBotSeat,
  isValidDrawGuessConfig,
} from '../state/types';
import {
  commitDrawGuess,
  DRAWGUESS_REASONS,
  type DrawGuessDecision,
  requireDrawGuessHost,
} from './decision';

type RoomCommand = Extract<
  DrawGuessCommand,
  { readonly type: `room.${string}` | 'drawguess.config.update' }
>;

function seats(
  changes: readonly SeatChange<DrawGuessHumanSeat>[],
  excludedBotSeats: readonly number[],
): DrawGuessDecision {
  return commitDrawGuess([{ type: 'drawguess.seats.changed', changes, excludedBotSeats }]);
}

function rejectSeatOperation(reason: string): DrawGuessDecision {
  return reject(reason);
}

/** Decides lobby and profile changes with authenticated ownership and implicit bots. */
export function decideDrawGuessRoom(
  state: DrawGuessState,
  command: RoomCommand,
  context: CommandContext,
): DrawGuessDecision {
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
    );
  }
  if (state.phase.kind !== 'lobby') return reject(DRAWGUESS_REASONS.phase);
  if (command.type === 'room.seat.take' || command.type === 'room.seat.leave') {
    const actor = resolveUncontrolledUserActorId(context);
    if (actor.kind === 'rejected') return reject(actor.reason);
    if (command.type === 'room.seat.take' && command.profile.displayName.trim().length === 0)
      return reject(DRAWGUESS_REASONS.config);
    const result =
      command.type === 'room.seat.take'
        ? decideTakeSeat(
            state.realSeats,
            state.config.numberOfPlayers,
            command.seat,
            actor.value,
            (seat): DrawGuessHumanSeat => ({
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
    );
  }
  const hostRejection = requireDrawGuessHost(state, context);
  if (hostRejection !== null) return hostRejection;
  switch (command.type) {
    case 'drawguess.config.update': {
      if (!isValidDrawGuessConfig(command.config)) return reject(DRAWGUESS_REASONS.config);
      if (
        Object.keys(state.realSeats).some((seat) => Number(seat) >= command.config.numberOfPlayers)
      )
        return reject(DRAWGUESS_REASONS.occupied);
      const excludedBotSeats = command.config.fillEmptySeatsWithBots
        ? state.excludedBotSeats.filter((seat) => seat < command.config.numberOfPlayers)
        : [];
      return commitDrawGuess([
        { type: 'drawguess.config.updated', config: { ...command.config } },
        { type: 'drawguess.seats.changed', changes: [], excludedBotSeats },
      ]);
    }
    case 'room.seat.fillBots':
      return commitDrawGuess([
        {
          type: 'drawguess.config.updated',
          config: { ...state.config, fillEmptySeatsWithBots: true },
        },
        { type: 'drawguess.seats.changed', changes: [], excludedBotSeats: [] },
      ]);
    case 'room.seat.kick': {
      if (isDrawGuessImplicitBotSeat(state, command.seat)) {
        return seats([], [...state.excludedBotSeats, command.seat]);
      }
      const result = decideKickSeat(state.realSeats, state.config.numberOfPlayers, command.seat);
      if (result.kind === 'rejected') return rejectSeatOperation(result.reason);
      return seats(result.changes, state.excludedBotSeats);
    }
    case 'room.seat.clear': {
      const result = decideClearSeats(state.realSeats, state.config.numberOfPlayers);
      if (result.kind === 'rejected') return rejectSeatOperation(result.reason);
      return commitDrawGuess([
        {
          type: 'drawguess.config.updated',
          config: { ...state.config, fillEmptySeatsWithBots: false },
        },
        { type: 'drawguess.seats.changed', changes: result.changes, excludedBotSeats: [] },
      ]);
    }
    default:
      return reject(DRAWGUESS_REASONS.phase);
  }
}
