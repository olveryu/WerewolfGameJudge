/** Pushes a saved account-profile change into the active room, shared by settings and appearance. */
import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
} from '@/features/room/link/roomCommandResult';
import type {
  ActiveRoomAccountSnapshot,
  RoomProfilePatch,
} from '@/features/room/model/RoomAccountCapability';
import { createLogger } from '@/utils/logger';

const syncLog = createLogger('RoomProfileSync');

/**
 * Applies `patch` to the active room's seat. True when there is no room to update (idle or the
 * game cannot sync profiles) or the room accepted it; false when the room rejected it or the
 * command failed — the account write already succeeded, so the caller only warns.
 */
export async function syncActiveRoomProfile(
  activeRoom: ActiveRoomAccountSnapshot,
  patch: RoomProfilePatch,
): Promise<boolean> {
  if (activeRoom.phase === 'idle' || !activeRoom.canSyncProfile) return true;
  try {
    const result = await activeRoom.updateProfile(patch);
    if (isSuccessfulRoomCommand(result)) return true;
    syncLog.warn('Profile sync to active room rejected', {
      reason: getRoomCommandFailureReason(result),
    });
  } catch (error: unknown) {
    syncLog.warn('Profile sync to active room failed', error);
  }
  return false;
}
