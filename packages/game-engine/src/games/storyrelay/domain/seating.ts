/** Lobby-only Story Relay seating over the shared room-command skeleton. */

import { type CommandContext, reject } from '../../../platform/engine';
import { decideRoomCommands } from '../../../platform/room/roomCommands';
import type { StoryRelayCommand } from '../commands/types';
import { isValidStoryRelayConfig, type StoryRelayState } from '../state/types';
import { commitStoryRelay, STORY_RELAY_REASONS, type StoryRelayDecision } from './decision';

type RoomCommand = Extract<
  StoryRelayCommand,
  { readonly type: `room.${string}` | 'storyrelay.config.update' }
>;

/** Decides lobby and profile changes with authenticated ownership and explicit bots. */
export function decideStoryRelayRoom(
  state: StoryRelayState,
  command: RoomCommand,
  context: CommandContext,
): StoryRelayDecision {
  return decideRoomCommands({
    facts: {
      roster: state.roster,
      seatCount: state.config.numberOfPlayers,
      hostUserId: state.hostUserId,
    },
    command,
    context,
    options: {
      lobbyRejection: state.phase !== 'lobby' ? reject(STORY_RELAY_REASONS.phase) : null,
      phaseReason: STORY_RELAY_REASONS.phase,
      configReason: STORY_RELAY_REASONS.config,
      occupiedReason: STORY_RELAY_REASONS.occupied,
      profileLanding: { kind: 'rosterChange' },
      resolveConfigFacts: (resolved) =>
        resolved.type === 'storyrelay.config.update'
          ? {
              invalidReason: isValidStoryRelayConfig(resolved.config)
                ? null
                : STORY_RELAY_REASONS.config,
              newSeatCount: resolved.config.numberOfPlayers,
              buildEvent: () => ({
                type: 'storyrelay.config.updated',
                config: { ...resolved.config },
              }),
            }
          : null,
      buildSeatsChangedEvent: (changes) => ({ type: 'storyrelay.seats.changed', changes }),
      commit: commitStoryRelay,
    },
  });
}
