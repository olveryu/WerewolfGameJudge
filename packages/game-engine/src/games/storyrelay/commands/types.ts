/** Story Relay commands bind tasks to a round and step; actors come from platform authentication. */

import type {
  RoomProfileUpdateCommand,
  RoomSeatCommand,
} from '../../../platform/protocol/commands';
import type { RoomProfileUpdate, RoomSeatProfile } from '../../../platform/room/roster';
import type { StoryRelayConfig } from '../state/types';

export interface StoryRelayTaskIdentity {
  readonly roundId: string;
  readonly stepIndex: number;
  readonly chainId: string;
}

type RevisionCommand = { readonly phaseRevision: number } & {
  readonly type:
    | 'storyrelay.phase.expire'
    | 'storyrelay.phase.finish'
    | 'storyrelay.round.abort'
    | 'storyrelay.gallery.pause'
    | 'storyrelay.gallery.resume'
    | 'storyrelay.gallery.advance'
    | 'storyrelay.gallery.rewind'
    | 'storyrelay.gallery.finish';
};

export type StoryRelayCommand =
  | RoomSeatCommand<RoomSeatProfile>
  | RoomProfileUpdateCommand<RoomProfileUpdate>
  | { readonly type: 'storyrelay.config.update'; readonly config: StoryRelayConfig }
  | { readonly type: 'storyrelay.bots.clear' }
  | {
      readonly type:
        | 'storyrelay.round.start'
        | 'storyrelay.round.next'
        | 'storyrelay.game.returnToLobby';
    }
  | (StoryRelayTaskIdentity & {
      readonly type: 'storyrelay.task.ready.set';
      readonly isReady: boolean;
    })
  | (StoryRelayTaskIdentity & { readonly type: 'storyrelay.text.submit'; readonly text: string })
  | (StoryRelayTaskIdentity & { readonly type: 'storyrelay.task.empty.submit' })
  | RevisionCommand;
