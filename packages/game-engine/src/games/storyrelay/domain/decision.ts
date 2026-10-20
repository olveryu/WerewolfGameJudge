/** Story Relay decision outcomes and common permission gates; no IO. */

import { commit, type Decision } from '../../../platform/engine';
import type { RosterChange } from '../../../platform/room/seating';
import type {
  StoryRelayConfig,
  StoryRelayEntry,
  StoryRelayHumanSeat,
  StoryRelayState,
} from '../state/types';

export const STORY_RELAY_REASONS = {
  config: 'storyrelay_config_invalid',
  phase: 'storyrelay_phase_invalid',
  task: 'storyrelay_task_changed',
  submitted: 'storyrelay_already_submitted',
  text: 'storyrelay_text_invalid',
  full: 'storyrelay_room_not_full',
  occupied: 'storyrelay_occupied_seat_out_of_range',
  deadline: 'storyrelay_deadline_not_reached',
  manual: 'storyrelay_manual_paging',
} as const;

export type StoryRelayEvent =
  | {
      readonly type: 'storyrelay.seats.changed';
      readonly changes: readonly RosterChange<StoryRelayHumanSeat>[];
    }
  | { readonly type: 'storyrelay.config.updated'; readonly config: StoryRelayConfig }
  | {
      readonly type: 'storyrelay.round.started';
      readonly round: Pick<
        StoryRelayState,
        | 'roundId'
        | 'startedAt'
        | 'participants'
        | 'seatOrder'
        | 'stepOffsets'
        | 'chains'
        | 'deadlineAt'
      >;
    }
  | { readonly type: 'storyrelay.task.ready'; readonly seat: number; readonly isReady: boolean }
  | {
      readonly type: 'storyrelay.entries.appended';
      readonly chainId: string;
      readonly entry: StoryRelayEntry;
    }
  | {
      readonly type: 'storyrelay.phase.changed';
      readonly phase: StoryRelayState['phase'];
      readonly stepIndex: number;
      readonly deadlineAt: number | null;
      readonly gallery: StoryRelayState['gallery'];
    }
  | { readonly type: 'storyrelay.round.completed'; readonly completedAt: number }
  | { readonly type: 'storyrelay.round.aborted'; readonly abortedAt: number }
  | { readonly type: 'storyrelay.game.returnedToLobby' };

export interface StoryRelayEffect {
  readonly type: 'storyrelay.game.completed';
  readonly payload: {
    readonly roundId: string;
    readonly completedAt: number;
    readonly participantUserIds: readonly string[];
  };
}
export type StoryRelayDecision = Decision<StoryRelayEvent, StoryRelayEffect>;

/** Commits domain events and durable completion effects through the shared runtime. */
export function commitStoryRelay(
  events: readonly StoryRelayEvent[],
  effects: readonly StoryRelayEffect[] = [],
): StoryRelayDecision {
  return commit({ events, effects });
}
