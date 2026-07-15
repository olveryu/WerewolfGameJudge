/** Complete the client acknowledgement side of one server-created room record. */

import { addRecentRoom } from '@/lib/recentRooms';
import type { CreatedRoom, IRoomDirectoryService } from '@/services/types/IRoomDirectoryService';

type RoomCreationAcknowledger = Pick<IRoomDirectoryService, 'acknowledgeRoomCreation'>;

export function completeRoomCreation(
  roomDirectory: RoomCreationAcknowledger,
  record: CreatedRoom,
): CreatedRoom {
  addRecentRoom(record.roomCode);
  roomDirectory.acknowledgeRoomCreation(record.creationId);
  return record;
}
