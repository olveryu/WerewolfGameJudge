/** Canonical transitions for room creation and room-owned subflows. */
import { parseRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';
import type { NavigateFunction } from 'react-router';

/** Navigation state marking a room entered right after its creation. */
export interface RoomLocationState {
  readonly entryReason: 'created';
}

export function roomPath(roomCode: string): string {
  return `/room/${parseRoomCode(roomCode)}`;
}

/** Leaves the room flow for Home, replacing the room entry so Back does not reopen it. */
export function exitRoomFlow(navigate: NavigateFunction): void {
  void navigate('/', { replace: true });
}

/** Replaces the creation flow with the new room. */
export function replaceWithCreatedRoom(navigate: NavigateFunction, roomCode: string): void {
  const state: RoomLocationState = { entryReason: 'created' };
  void navigate(roomPath(roomCode), { replace: true, state });
}

/** Returns from a room subpage (config, guide, notepad) to its room. */
export function returnToActiveRoom(navigate: NavigateFunction, roomCode: string): void {
  void navigate(roomPath(roomCode), { replace: true });
}

/** Opens a room from the admin room list; Back returns to the admin page. */
export function enterRoomFromAdmin(navigate: NavigateFunction, roomCode: string): void {
  void navigate(roomPath(roomCode));
}
