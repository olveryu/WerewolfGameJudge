/** Zod schemas for /room/* endpoints */

import { z } from 'zod';

/** POST /room/create */
export const createRoomSchema = z.object({
  roomCode: z.string().min(1).max(20),
  initialState: z.unknown().optional(),
});

/** POST /room/get, /room/delete, /room/state, /room/revision */
export const roomCodeBodySchema = z.object({
  roomCode: z.string().min(1).max(20),
});
