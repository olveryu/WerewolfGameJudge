/** Lobby-only Story Relay seating using shared seat operations; profiles do not rewrite authors. */

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
  { readonly type: `room.${string}` | 'storyrelay.config.update' | 'storyrelay.bots.clear' }
>;

function seats(
  changes: readonly SeatChange<StoryRelayHumanSeat>[],
  botSeats: readonly number[],
): StoryRelayDecision {
  return commitStoryRelay([{ type: 'storyrelay.seats.changed', changes, botSeats }]);
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
    const seat = findSeatByUserId(state.realSeats, state.config.numberOfPlayers, actor.value);
    if (seat === null) return reject(REASON_NOT_SEATED);
    if (
      command.profile.displayName !== undefined &&
      command.profile.displayName.trim().length === 0
    )
      return reject(STORY_RELAY_REASONS.config);
    const occupant = state.realSeats[seat]!;
    return seats(
      [
        {
          seat,
          previous: occupant,
          next: { ...occupant, profile: { ...occupant.profile, ...command.profile } },
        },
      ],
      state.botSeats,
    );
  }
  if (state.phase !== 'lobby') return reject(STORY_RELAY_REASONS.phase);
  if (command.type === 'room.seat.take' || command.type === 'room.seat.leave') {
    const actor = resolveUncontrolledUserActorId(context);
    if (actor.kind === 'rejected') return reject(actor.reason);
    if (command.type === 'room.seat.take' && command.profile.displayName.trim().length === 0)
      return reject(STORY_RELAY_REASONS.config);
    const result =
      command.type === 'room.seat.take'
        ? decideTakeSeat(
            state.realSeats,
            state.config.numberOfPlayers,
            command.seat,
            actor.value,
            (seat): StoryRelayHumanSeat => ({
              seat,
              userId: actor.value,
              profile: { ...command.profile },
            }),
          )
        : decideLeaveSeat(state.realSeats, state.config.numberOfPlayers, actor.value);
    return result.kind === 'rejected'
      ? reject(result.reason)
      : seats(
          result.changes,
          command.type === 'room.seat.take'
            ? state.botSeats.filter((seat) => seat !== command.seat)
            : state.botSeats,
        );
  }
  const hostRejection = requireStoryRelayHost(state, context);
  if (hostRejection !== null) return hostRejection;
  switch (command.type) {
    case 'storyrelay.config.update':
      if (!isValidStoryRelayConfig(command.config)) return reject(STORY_RELAY_REASONS.config);
      if (
        Object.keys(state.realSeats).some((seat) => Number(seat) >= command.config.numberOfPlayers)
      )
        return reject(STORY_RELAY_REASONS.occupied);
      return commitStoryRelay([
        { type: 'storyrelay.config.updated', config: { ...command.config } },
      ]);
    case 'room.seat.fillBots':
      return seats(
        [],
        Array.from({ length: state.config.numberOfPlayers }, (_, seat) => seat).filter(
          (seat) => state.realSeats[seat] === undefined,
        ),
      );
    case 'storyrelay.bots.clear':
      return seats([], []);
    case 'room.seat.kick': {
      if (state.botSeats.includes(command.seat))
        return seats(
          [],
          state.botSeats.filter((seat) => seat !== command.seat),
        );
      const result = decideKickSeat(state.realSeats, state.config.numberOfPlayers, command.seat);
      return result.kind === 'rejected'
        ? reject(result.reason)
        : seats(result.changes, state.botSeats);
    }
    case 'room.seat.clear': {
      const result = decideClearSeats(state.realSeats, state.config.numberOfPlayers);
      return result.kind === 'rejected' ? reject(result.reason) : seats(result.changes, []);
    }
  }
}
