/** Lobby-only DrawGuess seating on the unified roster; bot seats are explicit occupants. */

import {
  type CommandContext,
  reject,
  resolveUncontrolledUserActorId,
} from '../../../platform/engine';
import { REASON_NOT_SEATED } from '../../../platform/protocol/reasons';
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
import type { DrawGuessCommand } from '../commands/types';
import {
  type DrawGuessHumanSeat,
  type DrawGuessState,
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

function seats(changes: readonly RosterChange<DrawGuessHumanSeat>[]): DrawGuessDecision {
  return commitDrawGuess([{ type: 'drawguess.seats.changed', changes }]);
}

function rejectSeatOperation(reason: string): DrawGuessDecision {
  return reject(reason);
}

/** Decides lobby and profile changes with authenticated ownership. */
export function decideDrawGuessRoom(
  state: DrawGuessState,
  command: RoomCommand,
  context: CommandContext,
): DrawGuessDecision {
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
  if (state.phase.kind !== 'lobby') return reject(DRAWGUESS_REASONS.phase);
  if (command.type === 'room.seat.take' || command.type === 'room.seat.leave') {
    const actor = resolveUncontrolledUserActorId(context);
    if (actor.kind === 'rejected') return reject(actor.reason);
    if (command.type === 'room.seat.take' && command.profile.displayName.trim().length === 0)
      return reject(DRAWGUESS_REASONS.config);
    const result =
      command.type === 'room.seat.take'
        ? decideRosterTakeSeat(
            state.roster,
            state.config.numberOfPlayers,
            command.seat,
            actor.value,
            (seat): DrawGuessHumanSeat => ({
              seat,
              userId: actor.value,
              profile: { ...command.profile },
            }),
          )
        : decideRosterLeaveSeat(state.roster, state.config.numberOfPlayers, actor.value);
    if (result.kind === 'rejected') return rejectSeatOperation(result.reason);
    return seats(result.changes);
  }
  const hostRejection = requireDrawGuessHost(state, context);
  if (hostRejection !== null) return hostRejection;
  switch (command.type) {
    case 'drawguess.config.update': {
      if (!isValidDrawGuessConfig(command.config)) return reject(DRAWGUESS_REASONS.config);
      if (hasOccupantAtOrBeyond(state.roster, command.config.numberOfPlayers))
        return reject(DRAWGUESS_REASONS.occupied);
      return commitDrawGuess([{ type: 'drawguess.config.updated', config: { ...command.config } }]);
    }
    case 'room.seat.fillBots': {
      const result = decideRosterFillBots(state.roster, state.config.numberOfPlayers);
      if (result.kind === 'rejected') return rejectSeatOperation(result.reason);
      return result.changes.length === 0 ? commitDrawGuess([]) : seats(result.changes);
    }
    case 'room.seat.kick': {
      const result = decideRosterKickSeat(state.roster, state.config.numberOfPlayers, command.seat);
      if (result.kind === 'rejected') return rejectSeatOperation(result.reason);
      return seats(result.changes);
    }
    case 'room.seat.clear': {
      const result = decideRosterClearSeats(state.roster, state.config.numberOfPlayers);
      if (result.kind === 'rejected') return rejectSeatOperation(result.reason);
      return result.changes.length === 0 ? commitDrawGuess([]) : seats(result.changes);
    }
    default:
      return reject(DRAWGUESS_REASONS.phase);
  }
}
