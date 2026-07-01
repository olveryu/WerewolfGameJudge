/** Zod schemas for /room/* endpoints */

import { z } from 'zod';

/** POST /room/create */
export const createRoomSchema = z.strictObject({
  roomCode: z.string().min(1).max(20),
  /** Game type is always explicit; no server-side defaulting at the API boundary. */
  gameType: z.string().min(1).max(40),
  /** Game-specific create config; validated by the gameType create registry. */
  config: z.unknown().refine((value) => value !== undefined, {
    message: 'config is required',
  }),
});

/** POST /room/get, /room/delete, /room/state, /room/revision */
export const roomCodeBodySchema = z.object({
  roomCode: z.string().min(1).max(20),
});
