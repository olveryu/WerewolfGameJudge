/** Story Relay specialization of the shared session; transport and command recovery stay platform-owned. */

import type {
  StoryRelayCommand,
  StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';

import type { RoomSessionClient } from '@/features/room/session/types';

export type StoryRelayRoomSession = RoomSessionClient<StoryRelayState, StoryRelayCommand>;

/** Finds the current user's real seat without treating controlled bots as the user's identity. */
export function getStoryRelayUserSeat(state: StoryRelayState, userId: string): number | null {
  return (
    Object.values(state.realSeats).find((occupant) => occupant?.userId === userId)?.seat ?? null
  );
}
