/** Strict schemas for the game-agnostic /room HTTP boundary. */

import { GAME_TYPES } from '@werewolf/game-engine/platform/protocol/gameTypes';
import { z } from 'zod';

const roomCodeSchema = z.string().min(1).max(20);
const commandIdSchema = z.string().min(1).max(200);

/** POST /room/create */
export const createRoomSchema = z.strictObject({
  roomCode: roomCodeSchema,
  gameType: z.enum(GAME_TYPES),
  config: z.record(z.string(), z.unknown()),
  creationId: z.string().min(1).max(128),
});

/** POST /room/command */
export const roomCommandSchema = z.strictObject({
  roomCode: roomCodeSchema,
  commandId: commandIdSchema,
  command: z.looseObject({ type: z.string().min(1) }),
  controlledSeat: z.number().int().nonnegative().nullable(),
});

/** POST /room/get, /room/delete, /room/state, /room/revision */
export const roomCodeBodySchema = z.strictObject({
  roomCode: roomCodeSchema,
});
