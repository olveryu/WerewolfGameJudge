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
    | 'storyrelay.game.abort'
    | 'storyrelay.gallery.pause'
    | 'storyrelay.gallery.resume'
    | 'storyrelay.gallery.advance'
    | 'storyrelay.gallery.rewind'
    | 'storyrelay.gallery.finish';
};

export type StoryRelayPublicCommand =
  | RoomSeatCommand<RoomSeatProfile>
  | RoomProfileUpdateCommand<RoomProfileUpdate>
  | { readonly type: 'storyrelay.config.update'; readonly config: StoryRelayConfig }
  | {
      readonly type:
        | 'storyrelay.game.begin'
        | 'storyrelay.game.next'
        | 'storyrelay.game.returnToLobby';
    }
  | (StoryRelayTaskIdentity & {
      readonly type: 'storyrelay.task.ready.set';
      readonly isReady: boolean;
    })
  | (StoryRelayTaskIdentity & { readonly type: 'storyrelay.text.submit'; readonly text: string })
  | (StoryRelayTaskIdentity & { readonly type: 'storyrelay.task.empty.submit' })
  | RevisionCommand;

/**
 * Worker-originated settle command: the room runtime fires the armed
 * stage deadline through a scheduled `storyrelay.settle.due` effect,
 * and the effect handler dispatches this as the system actor. It runs
 * the same expiry decide as the public expire command; the public
 * expire stays as a client acceleration path only.
 */
export type StoryRelayInternalCommand = { readonly type: 'storyrelay.phase.settleExpired' };

export type StoryRelayCommand = StoryRelayPublicCommand | StoryRelayInternalCommand;
