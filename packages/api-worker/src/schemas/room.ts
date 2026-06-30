/** Zod schemas for /room/* endpoints */

import { z } from 'zod';

/** POST /room/create */
export const createRoomSchema = z.object({
  roomCode: z.string().min(1).max(20),
  /** Werewolf legacy path: client builds & posts the full initial state. */
  initialState: z.unknown().optional(),
  /** Engine path (fibking, …): server builds the initial state from `config`. */
  gameType: z.string().min(1).max(40).optional(),
  /** Engine-path create config; validated per gameType at the boundary. */
  config: z.unknown().optional(),
});

/** POST /room/get, /room/delete, /room/state, /room/revision */
export const roomCodeBodySchema = z.object({
  roomCode: z.string().min(1).max(20),
});
