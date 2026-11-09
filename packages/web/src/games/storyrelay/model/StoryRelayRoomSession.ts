/** Story Relay specialization of the shared session; transport and command recovery stay platform-owned. */

import type {
  StoryRelayCommand,
  StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';

import type { RoomLink } from '@/platform/realtime/types';

export type StoryRelayRoomSession = RoomLink<StoryRelayState, StoryRelayCommand>;
