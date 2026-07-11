/** Test-only cleanup for Durable Object alarms that bypass per-file storage isolation. */

import { env, listDurableObjectIds, runInDurableObject } from 'cloudflare:test';

import type { GameRoom } from '../platform/room/GameRoom';

export async function deleteCurrentRoomAlarms(): Promise<void> {
  const roomIds = await listDurableObjectIds(env.GAME_ROOM);
  for (const roomId of roomIds) {
    const stub = env.GAME_ROOM.get(roomId);
    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      await state.storage.deleteAlarm();
    });
  }
}
