/** D1 room-directory identity used to route public room codes to immutable DO instances. */

import { eq } from 'drizzle-orm';

import { createDb } from '../../db';
import { rooms } from '../../db/schema';
import type { Env } from '../../env';

export interface RoomInstanceIdentity {
  readonly roomCode: string;
  readonly roomInstanceId: string;
}

/** Allocate an immutable DO identity. Public room codes may be reused; this ID may not. */
export function createRoomInstanceId(env: Env): string {
  return env.GAME_ROOM.newUniqueId().toString();
}

/** Resolve a public room code through the authoritative D1 directory. */
export async function findRoomInstance(
  env: Env,
  roomCode: string,
): Promise<RoomInstanceIdentity | null> {
  const row = await createDb(env.DB)
    .select({ roomCode: rooms.code, roomInstanceId: rooms.id })
    .from(rooms)
    .where(eq(rooms.code, roomCode))
    .get();
  return row ?? null;
}
