/** Undercover room commands using the shared roster decisions; no IO or direct writes.
 * @remarks Roster changes are lobby-only; profile changes preserve frozen participant identity.
 */

import {
  type CommandContext,
  reject,
  resolveUncontrolledUserActorId,
} from '../../../platform/engine';
import { REASON_NOT_SEATED, REASON_SEAT_TAKEN } from '../../../platform/protocol/reasons';
import {
  decideRosterClearSeats,
  decideRosterFillBots,
  decideRosterKickSeat,
  decideRosterLeaveSeat,
  decideRosterTakeSeat,
  findRosterSeatByUserId,
  hasOccupantAtOrBeyond,
  isBotOccupant,
  isBotSeat,
  type RosterChange,
} from '../../../platform/room/seating';
import type { UndercoverPublicCommand } from '../commands/types';
import { isValidUndercoverConfig } from '../state/normalize';
import type { UndercoverHumanSeat, UndercoverState } from '../state/types';
import {
  commitUndercover,
  requireUndercoverHost,
  UNDERCOVER_REASONS,
  type UndercoverDecision,
} from './decision';

type RoomCommand = Extract<
  UndercoverPublicCommand,
  { readonly type: `room.${string}` | 'undercover.config.update' }
>;

function seatDecision(changes: readonly RosterChange<UndercoverHumanSeat>[]): UndercoverDecision {
  return commitUndercover([{ type: 'undercover.seats.changed', changes }]);
}

function decideProfile(
  state: UndercoverState,
  command: Extract<RoomCommand, { type: 'room.profile.update' }>,
  context: CommandContext,
): UndercoverDecision {
  const actor = resolveUncontrolledUserActorId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  const seat = findRosterSeatByUserId(state.roster, state.config.numberOfPlayers, actor.value);
  if (seat === null) return reject(REASON_NOT_SEATED);
  const occupant = state.roster[seat];
  if (occupant == null || isBotOccupant(occupant))
    throw new Error('Undercover profile update resolved to a non-human seat');
  if (command.profile.displayName !== undefined && command.profile.displayName.trim().length === 0)
    return reject(UNDERCOVER_REASONS.config);
  return seatDecision([
    {
      seat,
      previous: occupant,
      next: { ...occupant, profile: { ...occupant.profile, ...command.profile } },
    },
  ]);
}

/** Decides shared room and configuration commands with game-specific lobby gates. */
export function decideUndercoverRoom(
  state: UndercoverState,
  command: RoomCommand,
  context: CommandContext,
): UndercoverDecision {
  if (command.type === 'room.profile.update') return decideProfile(state, command, context);
  if (state.phase !== 'lobby') return reject(UNDERCOVER_REASONS.phase);
  if (command.type === 'room.seat.take' || command.type === 'room.seat.leave') {
    const actor = resolveUncontrolledUserActorId(context);
    if (actor.kind === 'rejected') return reject(actor.reason);
    if (command.type === 'room.seat.take') {
      if (isBotSeat(state.roster, command.seat)) return reject(REASON_SEAT_TAKEN);
      if (command.profile.displayName.trim().length === 0) return reject(UNDERCOVER_REASONS.config);
    }
    const result =
      command.type === 'room.seat.take'
        ? decideRosterTakeSeat(
            state.roster,
            state.config.numberOfPlayers,
            command.seat,
            actor.value,
            (seat): UndercoverHumanSeat => ({
              seat,
              userId: actor.value,
              profile: { ...command.profile },
            }),
          )
        : decideRosterLeaveSeat(state.roster, state.config.numberOfPlayers, actor.value);
    return result.kind === 'rejected' ? reject(result.reason) : seatDecision(result.changes);
  }
  const hostRejection = requireUndercoverHost(state, context);
  if (hostRejection !== null) return hostRejection;
  switch (command.type) {
    case 'undercover.config.update': {
      if (!isValidUndercoverConfig(command.config)) return reject(UNDERCOVER_REASONS.config);
      if (hasOccupantAtOrBeyond(state.roster, command.config.numberOfPlayers))
        return reject(UNDERCOVER_REASONS.occupied);
      return commitUndercover([
        { type: 'undercover.config.updated', config: { ...command.config } },
      ]);
    }
    case 'room.seat.fillBots': {
      const result = decideRosterFillBots(state.roster, state.config.numberOfPlayers);
      return result.kind === 'rejected' ? reject(result.reason) : seatDecision(result.changes);
    }
    case 'room.seat.kick': {
      const result = decideRosterKickSeat(state.roster, state.config.numberOfPlayers, command.seat);
      return result.kind === 'rejected' ? reject(result.reason) : seatDecision(result.changes);
    }
    case 'room.seat.clear': {
      const result = decideRosterClearSeats(state.roster, state.config.numberOfPlayers);
      return result.kind === 'rejected' ? reject(result.reason) : seatDecision(result.changes);
    }
  }
}
