/** Lobby-only Demo seating using the shared roster decisions. */

import {
  type CommandContext,
  reject,
  resolveUncontrolledUserActorId,
} from '../../../platform/engine';
import { REASON_NOT_HOST, REASON_NOT_SEATED } from '../../../platform/protocol/reasons';
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
import type { DemoCommand } from '../commands/types';
import { type DemoHumanSeat, type DemoState, isValidDemoConfig } from '../state/types';
import { commitDemo, DEMO_REASONS, type DemoDecision, requireDemoHost } from './decision';

type RoomCommand = Extract<DemoCommand, { readonly type: `room.${string}` | 'demo.config.update' }>;

function seats(changes: readonly RosterChange<DemoHumanSeat>[]): DemoDecision {
  return commitDemo([{ type: 'demo.seats.changed', changes }]);
}

/** Decides lobby and profile changes with authenticated ownership. */
export function decideDemoRoom(
  state: DemoState,
  command: RoomCommand,
  context: CommandContext,
): DemoDecision {
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
  if (state.phase.kind !== 'lobby') return reject(DEMO_REASONS.phase);
  if (command.type === 'room.seat.take' || command.type === 'room.seat.leave') {
    const actor = resolveUncontrolledUserActorId(context);
    if (actor.kind === 'rejected') return reject(actor.reason);
    if (command.type === 'room.seat.take' && command.profile.displayName.trim().length === 0)
      return reject(DEMO_REASONS.config);
    const result =
      command.type === 'room.seat.take'
        ? decideRosterTakeSeat(
            state.roster,
            state.config.numberOfPlayers,
            command.seat,
            actor.value,
            (seat): DemoHumanSeat => ({
              seat,
              userId: actor.value,
              profile: { ...command.profile },
            }),
          )
        : decideRosterLeaveSeat(state.roster, state.config.numberOfPlayers, actor.value);
    if (result.kind === 'rejected') return reject(result.reason);
    return seats(result.changes);
  }
  const hostRejection = requireDemoHost(state, context, REASON_NOT_HOST);
  if (hostRejection !== null) return hostRejection;
  switch (command.type) {
    case 'demo.config.update': {
      if (!isValidDemoConfig(command.config)) return reject(DEMO_REASONS.config);
      if (hasOccupantAtOrBeyond(state.roster, command.config.numberOfPlayers))
        return reject(DEMO_REASONS.occupied);
      return commitDemo([{ type: 'demo.config.updated', config: { ...command.config } }]);
    }
    case 'room.seat.fillBots': {
      const result = decideRosterFillBots(state.roster, state.config.numberOfPlayers);
      return result.kind === 'rejected' ? reject(result.reason) : seats(result.changes);
    }
    case 'room.seat.kick': {
      const result = decideRosterKickSeat(state.roster, state.config.numberOfPlayers, command.seat);
      return result.kind === 'rejected' ? reject(result.reason) : seats(result.changes);
    }
    case 'room.seat.clear': {
      const result = decideRosterClearSeats(state.roster, state.config.numberOfPlayers);
      return result.kind === 'rejected' ? reject(result.reason) : seats(result.changes);
    }
    default:
      return reject(DEMO_REASONS.phase);
  }
}
