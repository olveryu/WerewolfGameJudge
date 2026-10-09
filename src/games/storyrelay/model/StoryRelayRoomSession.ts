/** Story Relay specialization of the shared session; transport and command recovery stay platform-owned. */

import type {
  StoryRelayCommand,
  StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';

import type { RoomSessionClient } from '@/features/room/session/types';

export type StoryRelayRoomSession = RoomSessionClient<StoryRelayState, StoryRelayCommand>;
