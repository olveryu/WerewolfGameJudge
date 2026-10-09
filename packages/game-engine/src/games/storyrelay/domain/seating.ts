/** Lobby-only Story Relay seating using the shared roster decisions; profiles do not rewrite authors. */

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
import type { StoryRelayCommand } from '../commands/types';
import {
  isValidStoryRelayConfig,
  type StoryRelayHumanSeat,
  type StoryRelayState,
} from '../state/types';
import {
  commitStoryRelay,
  requireStoryRelayHost,
  STORY_RELAY_REASONS,
  type StoryRelayDecision,
} from './decision';

type RoomCommand = Extract<
  StoryRelayCommand,
  { readonly type: `room.${string}` | 'storyrelay.config.update' }
>;

function seats(changes: readonly RosterChange<StoryRelayHumanSeat>[]): StoryRelayDecision {
  return commitStoryRelay([{ type: 'storyrelay.seats.changed', changes }]);
}

/** Decides lobby and profile changes with authenticated ownership and explicit bots. */
export function decideStoryRelayRoom(
  state: StoryRelayState,
  command: RoomCommand,
  context: CommandContext,
): StoryRelayDecision {
  if (command.type === 'room.profile.update') {
    const actor = resolveUncontrolledUserActorId(context);
    if (actor.kind === 'rejected') return reject(actor.reason);
    const seat = findRosterSeatByUserId(state.roster, state.config.numberOfPlayers, actor.value);
    if (seat === null) return reject(REASON_NOT_SEATED);
    if (
      command.profile.displayName !== undefined &&
      command.profile.displayName.trim().length === 0
    )
      return reject(STORY_RELAY_REASONS.config);
    const occupant = state.roster[seat];
    if (occupant == null || isBotOccupant(occupant))
      throw new Error('Story Relay profile update resolved to a non-human seat');
    return seats([
      {
        seat,
        previous: occupant,
        next: { ...occupant, profile: { ...occupant.profile, ...command.profile } },
      },
    ]);
  }
  if (state.phase !== 'lobby') return reject(STORY_RELAY_REASONS.phase);
  if (command.type === 'room.seat.take' || command.type === 'room.seat.leave') {
    const actor = resolveUncontrolledUserActorId(context);
    if (actor.kind === 'rejected') return reject(actor.reason);
    if (command.type === 'room.seat.take' && command.profile.displayName.trim().length === 0)
      return reject(STORY_RELAY_REASONS.config);
    const result =
      command.type === 'room.seat.take'
        ? decideRosterTakeSeat(
            state.roster,
            state.config.numberOfPlayers,
            command.seat,
            actor.value,
            (seat): StoryRelayHumanSeat => ({
              seat,
              userId: actor.value,
              profile: { ...command.profile },
            }),
          )
        : decideRosterLeaveSeat(state.roster, state.config.numberOfPlayers, actor.value);
    return result.kind === 'rejected' ? reject(result.reason) : seats(result.changes);
  }
  const hostRejection = requireStoryRelayHost(state, context);
  if (hostRejection !== null) return hostRejection;
  switch (command.type) {
    case 'storyrelay.config.update':
      if (!isValidStoryRelayConfig(command.config)) return reject(STORY_RELAY_REASONS.config);
      if (hasOccupantAtOrBeyond(state.roster, command.config.numberOfPlayers))
        return reject(STORY_RELAY_REASONS.occupied);
      return commitStoryRelay([
        { type: 'storyrelay.config.updated', config: { ...command.config } },
      ]);
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
  }
}
